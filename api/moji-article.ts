import type {VercelRequest, VercelResponse} from '@vercel/node';
import {inflateRawSync} from 'node:zlib';
import {
  boundedCandidateSentences,
  buildPersistentArticlePayload,
  MOJI_PARSER_VERSION,
  readPersistentArticleCache,
  writePersistentArticleCache,
} from '../src/nhkArticleCache';

const MAX_HTML_BYTES = 2_500_000;
const MAX_FEED_BYTES = 1_000_000;
const MAX_EPUB_BYTES = 750_000;
const FETCH_TIMEOUT_MS = 7_000;
const FEED_CACHE_MS = 5 * 60_000;
const ARCHIVE_CACHE_MS = 30 * 60_000;
const ARCHIVE_MONTHS = 6;
const NHK_EASIER_FEED_URL = 'https://nhkeasier.com/feed/?no-furiganas';
const ALLOWED_HOSTS = new Set(['mojidict.com', 'www.mojidict.com', 'm.mojidict.com']);
const ARTICLE_PATH = /^\/article\/[A-Za-z0-9_-]+\/?$/;
const TRANSLATION_MARKER = /(?:👉|→)?\s*(?:点击单词查询释义|點擊單詞查詢釋義|クリックして単語の意味を調べる)/gi;
const UI_NOISE = [
  '显示译文', '点击显示译文', '隐藏译文', '点击重新加载', '点赞', '收藏', '评论',
  '登录MOJi', '注册', '下载MOJi', '完整内容请下载', '扫码', '扫一扫', '相关推荐',
  '打开APP', 'APP内打开', '点击单词查询释义', '本文为会员专享文章', '专栏推荐',
  'Original', 'Permalink', 'Story illustration', 'Content is missing',
];

type ParsedArticle = {
  sourceUrl: string;
  title: string;
  sentences: string[];
  access: 'full' | 'excerpt' | 'member-only' | 'matched-public';
  headlineHint?: string;
};

type PublicMatch = {
  title: string;
  sourceUrl: string;
  officialUrl?: string;
  publishedAt?: string;
  sentences: string[];
  score: number;
};

type ArchiveStory = {
  title: string;
  sourceUrl: string;
  officialUrl?: string;
  publishedAt?: string;
  sentences: string[];
};

type RequestTiming = {
  startedAt: number;
  cacheLookupMs: number;
  upstreamFetchMs: number;
  publicLookupMs: number;
  cacheWriteMs: number;
};

let feedCache: {at: number; xml: string} | null = null;
const archiveCache = new Map<string, {at: number; stories: ArchiveStory[]}>();

const decodeCodePoint = (value: string, radix: number): string => {
  const codePoint = Number.parseInt(value, radix);
  if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return '';
  try { return String.fromCodePoint(codePoint); } catch { return ''; }
};

const decodeHtml = (value: string): string => value
  .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => decodeCodePoint(code, 16))
  .replace(/&#(\d+);/g, (_, code: string) => decodeCodePoint(code, 10))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&apos;|&#39;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>');

const decodeScriptText = (value: string): string => decodeHtml(value)
  .replace(/\\u([0-9a-f]{4})/gi, (_, code: string) => decodeCodePoint(code, 16))
  .replace(/\\n|\\r|\\t/g, ' ')
  .replace(/\\(["'])/g, '$1');

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeMojiArticleUrl = (input: string): string | null => {
  try {
    const url = new URL(input.trim());
    if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname.toLowerCase()) || !ARTICLE_PATH.test(url.pathname)) return null;
    const articleId = url.pathname.split('/').filter(Boolean)[1];
    return `https://www.mojidict.com/article/${articleId}`;
  } catch {
    return null;
  }
};

const articleIdFromUrl = (url: string): string => url.split('/').filter(Boolean).pop() || '';

const toIsoDate = (value: string): string => {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : '';
};

const timingPayload = (timing: RequestTiming) => ({
  totalMs: Date.now() - timing.startedAt,
  cacheLookupMs: timing.cacheLookupMs,
  upstreamFetchMs: timing.upstreamFetchMs,
  publicLookupMs: timing.publicLookupMs,
  cacheWriteMs: timing.cacheWriteMs,
});

const readAttribute = (tag: string, name: string): string => {
  const match = new RegExp(`${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i').exec(tag);
  return match?.[2] || '';
};

const metaContent = (html: string, names: string[]): string => {
  const accepted = new Set(names.map(value => value.toLowerCase()));
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const property = readAttribute(tag, 'property').toLowerCase();
    const name = readAttribute(tag, 'name').toLowerCase();
    if (!accepted.has(property) && !accepted.has(name)) continue;
    const content = readAttribute(tag, 'content');
    if (content) return decodeHtml(content);
  }
  return '';
};

const findArticleVariable = (decodedHtml: string, articleId: string): string => {
  if (!articleId) return '';
  const id = escapeRegex(articleId);
  return new RegExp(`([A-Za-z_$][\\w$]*)\\.objectId\\s*=\\s*["']${id}["']`, 'i').exec(decodedHtml)?.[1] || '';
};

const targetScriptString = (html: string, articleId: string, property: string): string => {
  const decoded = decodeScriptText(html);
  const variable = findArticleVariable(decoded, articleId);
  if (!variable) return '';
  return new RegExp(`${escapeRegex(variable)}\\.${escapeRegex(property)}\\s*=\\s*["']([\\s\\S]{1,1200}?)["']\\s*;`, 'i').exec(decoded)?.[1] || '';
};

const targetScriptBoolean = (html: string, articleId: string, property: string): boolean | null => {
  const decoded = decodeScriptText(html);
  const variable = findArticleVariable(decoded, articleId);
  if (!variable) return null;
  const value = new RegExp(`${escapeRegex(variable)}\\.${escapeRegex(property)}\\s*=\\s*(true|false)\\s*;`, 'i').exec(decoded)?.[1];
  return value ? value.toLowerCase() === 'true' : null;
};

const cleanTitle = (value: string): string => decodeHtml(value)
  .replace(/<[^>]+>/g, ' ')
  .replace(/^日语阅读\s*[-–—|]\s*/i, '')
  .replace(/\s*[-–—|]\s*MOJi(?:辞書|辞书).*$/i, '')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 160);

const extractTitle = (html: string, articleId: string): string => {
  const heading = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1] || '';
  const documentTitle = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] || '';
  const candidates = [
    targetScriptString(html, articleId, 'notationTitle'),
    targetScriptString(html, articleId, 'title'),
    metaContent(html, ['og:title', 'twitter:title']),
    heading,
    documentTitle,
  ].map(cleanTitle).filter(Boolean);
  return candidates.find(title => !/^MOJi(?:辞書|辞书)?$/i.test(title)) || 'NHK日语听力';
};

const normalizeJapaneseSpacing = (value: string): string => value
  .replace(/([\u3400-\u9fffぁ-んァ-ヶー])\s+(?=[\u3400-\u9fffぁ-んァ-ヶー])/g, '$1')
  .replace(/[ \t]+/g, ' ')
  .trim();

const cleanSentence = (value: string): string => normalizeJapaneseSpacing(decodeHtml(value)
  .replace(/<(rt|rp)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(TRANSLATION_MARKER, ' ')
  .replace(/^\s*(?:[•●▪︎◆◇■□▶︎▷]|[-–—*#>]|\d+[.)、．])\s*/u, '')
  .replace(/\s+/g, ' '))
  .trim();

const count = (value: string, pattern: RegExp): number => value.match(pattern)?.length || 0;

const isJapaneseSentence = (sentence: string): boolean => {
  if (sentence.length < 10 || sentence.length > 280) return false;
  if (UI_NOISE.some(noise => sentence.includes(noise)) || /https?:\/\//i.test(sentence)) return false;
  const kana = count(sentence, /[ぁ-んァ-ヶー]/g);
  const kanji = count(sentence, /[\u3400-\u9fff]/g);
  const compactLength = sentence.replace(/[\s\dA-Za-z.,!?;:'"()\[\]{}<>/\\_-]/g, '').length;
  return kana >= 3 && kana + kanji >= 8 && (kana + kanji) / Math.max(compactLength, 1) >= 0.42;
};

const extractJapaneseSentences = (source: string): string[] => {
  const text = decodeHtml(source)
    .replace(/<(script|style|noscript|svg|canvas|template)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(rt|rp)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|div|li|section|article|h[1-6]|blockquote|tr)>/gi, '\n')
    .replace(/<(p|div|li|section|article|h[1-6]|blockquote|tr)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\u200b-\u200f\u202a-\u202e\ufeff]/g, '');
  const seen = new Set<string>();
  const result: string[] = [];
  for (const line of text.split(/\n+/)) {
    for (const part of line.match(/[^。！？!?]+[。！？!?]?/g) || []) {
      const sentence = cleanSentence(part);
      const key = sentence.replace(/[\s「」『』]/g, '');
      if (!isJapaneseSentence(sentence) || seen.has(key)) continue;
      seen.add(key);
      result.push(sentence);
      if (result.length >= 48) return result;
    }
  }
  return result;
};

const bestHeadlineFromText = (value: string): string => {
  const marker = new RegExp(TRANSLATION_MARKER.source, 'i');
  const lead = value.split(marker)[0] || '';
  const runs = lead.match(/[\u3000-\u30ff\u3400-\u9fffA-Za-z0-9０-９「」『』・、。！？!?\s]+/g) || [];
  return runs
    .map(cleanSentence)
    .filter(candidate => candidate.length >= 8 && /[ぁ-んァ-ヶー]/.test(candidate))
    .sort((a, b) => b.length - a.length)[0]
    ?.replace(/[。！？!?]+$/, '') || '';
};

const extractHeadlineHint = (html: string, articleId: string): string => {
  const descriptions = [
    targetScriptString(html, articleId, 'excerpt'),
    metaContent(html, ['og:description', 'description', 'twitter:description']),
  ].filter(Boolean);
  for (const description of descriptions) {
    const candidate = bestHeadlineFromText(description);
    if (candidate) return candidate;
  }
  return '';
};

const parseMojiArticle = (html: string, sourceUrl: string): ParsedArticle => {
  const articleId = articleIdFromUrl(sourceUrl);
  const title = extractTitle(html, articleId);
  const headlineHint = extractHeadlineHint(html, articleId);
  const targetVip = targetScriptBoolean(html, articleId, 'isVIP');
  const visibleMemberOnly = /本文为会员专享文章|会员专享文章|请打开\s*App\s*阅读|请打开\s*APP\s*阅读/i.test(decodeScriptText(html));
  const memberOnly = targetVip === true || visibleMemberOnly;
  return {
    sourceUrl,
    title,
    sentences: memberOnly ? [] : extractJapaneseSentences(html),
    access: memberOnly ? 'member-only' : 'excerpt',
    ...(headlineHint ? {headlineHint} : {}),
  };
};

const normalizeHeadline = (value: string): string => cleanSentence(value)
  .replace(/[\s　「」『』・：:、。！？!?（）()\[\]【】]/g, '')
  .toLowerCase();

const bigrams = (value: string): string[] => {
  if (value.length < 2) return value ? [value] : [];
  return Array.from({length: value.length - 1}, (_, index) => value.slice(index, index + 2));
};

const headlineSimilarity = (left: string, right: string): number => {
  const a = normalizeHeadline(left);
  const b = normalizeHeadline(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return Math.min(a.length, b.length) / Math.max(a.length, b.length);
  const aPairs = bigrams(a);
  const bPairs = bigrams(b);
  const counts = new Map<string, number>();
  for (const pair of bPairs) counts.set(pair, (counts.get(pair) || 0) + 1);
  let overlap = 0;
  for (const pair of aPairs) {
    const remaining = counts.get(pair) || 0;
    if (!remaining) continue;
    overlap += 1;
    counts.set(pair, remaining - 1);
  }
  return (2 * overlap) / Math.max(aPairs.length + bPairs.length, 1);
};

const xmlTag = (xml: string, tag: string): string => {
  const value = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(xml)?.[1] || '';
  return value.replace(/^<!\[CDATA\[|\]\]>$/g, '').trim();
};

const matchNhkFeed = (xml: string, headlineHint: string): PublicMatch | null => {
  const candidates: PublicMatch[] = [];
  for (const item of xml.match(/<item\b[\s\S]*?<\/item>/gi) || []) {
    const title = cleanSentence(decodeHtml(xmlTag(item, 'title')));
    const score = headlineSimilarity(headlineHint, title);
    if (score < 0.78) continue;
    const description = decodeHtml(xmlTag(item, 'description'));
    const sentences = extractJapaneseSentences(description);
    if (sentences.length < 2) continue;
    const sourceUrl = decodeHtml(xmlTag(item, 'link') || xmlTag(item, 'guid'));
    const officialUrl = description.match(/https:\/\/www3\.nhk\.or\.jp\/news\/easy\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.html/i)?.[0];
    const publishedAt = toIsoDate(decodeHtml(xmlTag(item, 'pubDate')));
    candidates.push({
      title,
      sourceUrl,
      officialUrl,
      sentences,
      score,
      ...(publishedAt ? {publishedAt} : {}),
    });
  }
  return candidates.sort((a, b) => b.score - a.score)[0] || null;
};

const unzipTextEntries = (buffer: Buffer): Array<{name: string; text: string}> => {
  const eocdSignature = 0x06054b50;
  const centralSignature = 0x02014b50;
  const localSignature = 0x04034b50;
  const minOffset = Math.max(0, buffer.length - 0xffff - 22);
  let eocdOffset = -1;
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === eocdSignature) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) return [];

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  let centralOffset = buffer.readUInt32LE(eocdOffset + 16);
  const output: Array<{name: string; text: string}> = [];

  for (let index = 0; index < totalEntries; index += 1) {
    if (centralOffset + 46 > buffer.length || buffer.readUInt32LE(centralOffset) !== centralSignature) break;
    const method = buffer.readUInt16LE(centralOffset + 10);
    const compressedSize = buffer.readUInt32LE(centralOffset + 20);
    const nameLength = buffer.readUInt16LE(centralOffset + 28);
    const extraLength = buffer.readUInt16LE(centralOffset + 30);
    const commentLength = buffer.readUInt16LE(centralOffset + 32);
    const localOffset = buffer.readUInt32LE(centralOffset + 42);
    const nameStart = centralOffset + 46;
    const nameEnd = nameStart + nameLength;
    const name = buffer.toString('utf8', nameStart, nameEnd);

    if (name.startsWith('EPUB/text/') && name.endsWith('.xhtml') && !name.endsWith('title_page.xhtml')) {
      if (localOffset + 30 <= buffer.length && buffer.readUInt32LE(localOffset) === localSignature) {
        const localNameLength = buffer.readUInt16LE(localOffset + 26);
        const localExtraLength = buffer.readUInt16LE(localOffset + 28);
        const dataStart = localOffset + 30 + localNameLength + localExtraLength;
        const dataEnd = dataStart + compressedSize;
        if (dataStart >= 0 && dataEnd <= buffer.length) {
          const compressed = buffer.subarray(dataStart, dataEnd);
          try {
            const data = method === 0 ? compressed : method === 8 ? inflateRawSync(compressed) : null;
            if (data && data.length <= 250_000) output.push({name, text: data.toString('utf8')});
          } catch {
            // Ignore a single malformed entry and continue through the archive.
          }
        }
      }
    }

    centralOffset = nameEnd + extraLength + commentLength;
  }
  return output;
};

const archiveStoryFromXhtml = (xhtml: string): ArchiveStory | null => {
  const titleHtml = /<h3\b[^>]*>([\s\S]*?)<\/h3>/i.exec(xhtml)?.[1] || /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(xhtml)?.[1] || '';
  const title = cleanSentence(titleHtml);
  if (!title) return null;
  const section = /<section\b[^>]*>([\s\S]*?)<\/section>/i.exec(xhtml)?.[1] || xhtml;
  const timeTag = /<time\b[^>]*>[\s\S]*?<\/time>/i.exec(section)?.[0] || '';
  const publishedAt = toIsoDate(readAttribute(timeTag, 'datetime') || cleanSentence(timeTag));
  const body = section
    .replace(/<h3\b[^>]*>[\s\S]*?<\/h3>/i, ' ')
    .replace(/<time\b[^>]*>[\s\S]*?<\/time>/i, ' ')
    .replace(/<ul\b[^>]*>[\s\S]*?<\/ul>/i, ' ');
  const sentences = extractJapaneseSentences(body).filter(sentence => normalizeHeadline(sentence) !== normalizeHeadline(title));
  if (sentences.length < 2) return null;
  const sourceUrl = xhtml.match(/https:\/\/nhkeasier\.com\/story\/\d+\/?/i)?.[0] || '';
  const officialUrl = xhtml.match(/https:\/\/www3\.nhk\.or\.jp\/news\/easy\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.html/i)?.[0];
  return {
    title,
    sourceUrl,
    officialUrl,
    sentences,
    ...(publishedAt ? {publishedAt} : {}),
  };
};

const jstRecentMonths = (): string[] => {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const year = jst.getUTCFullYear();
  const month = jst.getUTCMonth();
  return Array.from({length: ARCHIVE_MONTHS}, (_, offset) => {
    const date = new Date(Date.UTC(year, month - offset, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  });
};

const fetchArchiveMonth = async (monthKey: string): Promise<ArchiveStory[]> => {
  const now = Date.now();
  const cached = archiveCache.get(monthKey);
  if (cached && now - cached.at < ARCHIVE_CACHE_MS) return cached.stories;
  const [year, month] = monthKey.split('-');
  try {
    const response = await fetch(`https://nhkeasier.com/${year}/${month}/epub`, {
      headers: {Accept: 'application/epub+zip,application/zip,*/*', 'User-Agent': 'NihongoDiscovery/0.2 (+private language study)'},
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (response.status === 404) {
      archiveCache.set(monthKey, {at: now, stories: []});
      return [];
    }
    if (!response.ok) throw new Error(`archive_http_${response.status}`);
    const declaredLength = Number(response.headers.get('content-length') || 0);
    if (declaredLength > MAX_EPUB_BYTES) throw new Error('archive_too_large');
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_EPUB_BYTES) throw new Error('archive_too_large');
    const stories = unzipTextEntries(buffer).map(entry => archiveStoryFromXhtml(entry.text)).filter((story): story is ArchiveStory => Boolean(story));
    archiveCache.set(monthKey, {at: now, stories});
    return stories;
  } catch {
    return [];
  }
};

const matchNhkArchive = async (headlineHint: string): Promise<PublicMatch | null> => {
  const months = jstRecentMonths();
  const monthStories = await Promise.all(months.map(month => fetchArchiveMonth(month)));
  const matches: PublicMatch[] = [];
  for (const story of monthStories.flat()) {
    const score = headlineSimilarity(headlineHint, story.title);
    if (score < 0.78) continue;
    matches.push({...story, score});
  }
  return matches.sort((a, b) => b.score - a.score)[0] || null;
};

const fetchArticlePages = async (canonicalUrl: string): Promise<Array<{html: string; finalUrl: string}>> => {
  const articleId = articleIdFromUrl(canonicalUrl);
  const candidates = [canonicalUrl, `https://m.mojidict.com/article/${articleId}`];
  const pages = await Promise.all(candidates.map(async url => {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'ja,en;q=0.8,zh-CN;q=0.6',
          'Cache-Control': 'no-cache',
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      const finalUrl = normalizeMojiArticleUrl(response.url);
      if (!response.ok || !finalUrl) return null;
      const html = (await response.text()).slice(0, MAX_HTML_BYTES);
      return html.length >= 200 ? {html, finalUrl} : null;
    } catch {
      return null;
    }
  }));
  return pages.filter((page): page is {html: string; finalUrl: string} => Boolean(page));
};

const fetchNhkFeed = async (): Promise<string> => {
  const now = Date.now();
  if (feedCache && now - feedCache.at < FEED_CACHE_MS) return feedCache.xml;
  const response = await fetch(NHK_EASIER_FEED_URL, {
    headers: {Accept: 'application/rss+xml,application/xml,text/xml', 'User-Agent': 'NihongoDiscovery/0.2 (+private language study)'},
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`nhk_feed_http_${response.status}`);
  const xml = (await response.text()).slice(0, MAX_FEED_BYTES);
  if (!xml.includes('<rss') || !xml.includes('<item')) throw new Error('nhk_feed_invalid');
  feedCache = {at: now, xml};
  return xml;
};

const matchedResponse = async (
  res: VercelResponse,
  articleId: string,
  article: ParsedArticle,
  headlineHint: string,
  match: PublicMatch,
  resolvedBy: string,
  timing: RequestTiming,
) => {
  const cachePayload = buildPersistentArticlePayload(articleId, {
    ok: true,
    sourceUrl: article.sourceUrl,
    title: article.title,
    sentences: boundedCandidateSentences(match.sentences),
    access: 'matched-public',
    resolvedBy,
    headlineHint,
    referenceUrl: match.sourceUrl,
    ...(match.officialUrl ? {officialUrl: match.officialUrl} : {}),
    ...(match.publishedAt ? {publishedAt: match.publishedAt} : {}),
  });
  const cacheWriteStarted = Date.now();
  const cacheStored = cachePayload ? await writePersistentArticleCache(articleId, cachePayload) : false;
  timing.cacheWriteMs = Date.now() - cacheWriteStarted;
  const payload = cachePayload || {
    ok: true as const,
    sourceUrl: article.sourceUrl,
    title: article.title,
    sentences: boundedCandidateSentences(match.sentences),
    access: 'matched-public' as const,
    sentenceCount: Math.min(match.sentences.length, 16),
    resolvedBy,
    sourceVersion: MOJI_PARSER_VERSION,
    headlineHint,
    referenceUrl: match.sourceUrl,
    ...(match.officialUrl ? {officialUrl: match.officialUrl} : {}),
    ...(match.publishedAt ? {publishedAt: match.publishedAt} : {}),
  };
  return res.status(200).json({
    ...payload,
    cached: false,
    cacheStored,
    timingMs: timingPayload(timing),
  });
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const timing: RequestTiming = {
    startedAt: Date.now(),
    cacheLookupMs: 0,
    upstreamFetchMs: 0,
    publicLookupMs: 0,
    cacheWriteMs: 0,
  };
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ok: false, reason: 'method_not_allowed', timingMs: timingPayload(timing)});
  }

  const inputUrl = req.method === 'GET'
    ? String(req.query.url || '')
    : typeof req.body?.url === 'string' ? req.body.url : '';
  const canonicalUrl = normalizeMojiArticleUrl(inputUrl);
  if (!canonicalUrl) {
    return res.status(400).json({ok: false, reason: 'invalid_moji_article_url', timingMs: timingPayload(timing)});
  }

  const articleId = articleIdFromUrl(canonicalUrl);
  const cacheStarted = Date.now();
  const cached = await readPersistentArticleCache(articleId);
  timing.cacheLookupMs = Date.now() - cacheStarted;
  if (cached) {
    return res.status(200).json({
      ...cached,
      cached: true,
      timingMs: timingPayload(timing),
    });
  }

  try {
    const upstreamStarted = Date.now();
    const pages = await fetchArticlePages(canonicalUrl);
    timing.upstreamFetchMs = Date.now() - upstreamStarted;
    if (!pages.length) {
      return res.status(502).json({ok: false, reason: 'upstream_unavailable', timingMs: timingPayload(timing)});
    }
    const articles = pages.map(page => parseMojiArticle(page.html, page.finalUrl));
    const article = articles.sort((a, b) => Number(Boolean(b.headlineHint)) - Number(Boolean(a.headlineHint)))[0];
    const headlineHint = articles.find(candidate => candidate.headlineHint)?.headlineHint;
    const nhkArticle = Boolean(headlineHint) || /NHK/i.test(article.title);

    if (headlineHint) {
      const publicLookupStarted = Date.now();
      try {
        const recentMatch = matchNhkFeed(await fetchNhkFeed(), headlineHint);
        if (recentMatch) {
          timing.publicLookupMs = Date.now() - publicLookupStarted;
          return matchedResponse(res, articleId, article, headlineHint, recentMatch, 'public-nhk-feed', timing);
        }
      } catch {
        // Continue to the historical archive fallback.
      }

      const archiveMatch = await matchNhkArchive(headlineHint);
      timing.publicLookupMs = Date.now() - publicLookupStarted;
      if (archiveMatch) {
        return matchedResponse(res, articleId, article, headlineHint, archiveMatch, 'public-nhk-archive', timing);
      }
    }

    if (nhkArticle) {
      return res.status(422).json({
        ok: false,
        reason: 'nhk_transcript_not_matched',
        title: article.title,
        headlineDetected: Boolean(headlineHint),
        sourceVersion: MOJI_PARSER_VERSION,
        timingMs: timingPayload(timing),
        ...(headlineHint ? {headlineHint} : {}),
      });
    }

    const direct = articles.find(candidate => candidate.access !== 'member-only' && candidate.sentences.length >= 2);
    if (direct) {
      const sentences = boundedCandidateSentences(direct.sentences);
      return res.status(200).json({
        ok: true,
        ...direct,
        sentences,
        access: 'full',
        sentenceCount: sentences.length,
        resolvedBy: 'moji-page',
        sourceVersion: MOJI_PARSER_VERSION,
        cached: false,
        timingMs: timingPayload(timing),
      });
    }

    return res.status(422).json({
      ok: false,
      reason: 'no_japanese_sentences',
      title: article.title,
      sourceVersion: MOJI_PARSER_VERSION,
      timingMs: timingPayload(timing),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'parse_failed';
    console.error('moji-article handler failed', reason);
    return res.status(502).json({ok: false, reason, timingMs: timingPayload(timing)});
  }
}
