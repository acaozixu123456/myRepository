import type {VercelRequest, VercelResponse} from '@vercel/node';

const MAX_HTML_BYTES = 2_500_000;
const MAX_FEED_BYTES = 1_000_000;
const FETCH_TIMEOUT_MS = 8_000;
const FEED_CACHE_MS = 5 * 60_000;
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
  referenceUrl?: string;
  officialUrl?: string;
};

type FeedMatch = {
  title: string;
  sourceUrl: string;
  officialUrl?: string;
  sentences: string[];
  score: number;
};

let feedCache: {at: number; xml: string} | null = null;

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
  const variablePattern = escapeRegex(variable);
  const propertyPattern = escapeRegex(property);
  return new RegExp(`${variablePattern}\\.${propertyPattern}\\s*=\\s*["']([\\s\\S]{1,1200}?)["']\\s*;`, 'i').exec(decoded)?.[1] || '';
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
  const sentences = memberOnly ? [] : extractJapaneseSentences(html);
  return {
    sourceUrl,
    title,
    sentences,
    access: memberOnly ? 'member-only' : sentences.length >= 2 ? 'full' : 'excerpt',
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

const matchNhkFeed = (xml: string, headlineHint: string): FeedMatch | null => {
  const candidates: FeedMatch[] = [];
  for (const item of xml.match(/<item\b[\s\S]*?<\/item>/gi) || []) {
    const title = cleanSentence(decodeHtml(xmlTag(item, 'title')));
    const score = headlineSimilarity(headlineHint, title);
    if (score < 0.78) continue;
    const description = decodeHtml(xmlTag(item, 'description'));
    const sentences = extractJapaneseSentences(description);
    if (sentences.length < 2) continue;
    const sourceUrl = decodeHtml(xmlTag(item, 'link') || xmlTag(item, 'guid'));
    const officialUrl = description.match(/https:\/\/www3\.nhk\.or\.jp\/news\/easy\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.html/i)?.[0];
    candidates.push({title, sourceUrl, officialUrl, sentences, score});
  }
  return candidates.sort((a, b) => b.score - a.score)[0] || null;
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
    headers: {Accept: 'application/rss+xml,application/xml,text/xml', 'User-Agent': 'NihongoDiscovery/0.1 (+private language study)'},
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`nhk_feed_http_${response.status}`);
  const xml = (await response.text()).slice(0, MAX_FEED_BYTES);
  if (!xml.includes('<rss') || !xml.includes('<item')) throw new Error('nhk_feed_invalid');
  feedCache = {at: now, xml};
  return xml;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ok: false, reason: 'method_not_allowed'});

  const inputUrl = req.method === 'GET'
    ? String(req.query.url || '')
    : typeof req.body?.url === 'string' ? req.body.url : '';
  const canonicalUrl = normalizeMojiArticleUrl(inputUrl);
  if (!canonicalUrl) return res.status(400).json({ok: false, reason: 'invalid_moji_article_url'});

  try {
    const pages = await fetchArticlePages(canonicalUrl);
    if (!pages.length) return res.status(502).json({ok: false, reason: 'upstream_unavailable'});
    const articles = pages.map(page => parseMojiArticle(page.html, page.finalUrl));
    const article = articles.sort((a, b) => Number(Boolean(b.headlineHint)) - Number(Boolean(a.headlineHint)) || b.sentences.length - a.sentences.length)[0];
    const headlineHint = articles.find(candidate => candidate.headlineHint)?.headlineHint;

    if (headlineHint) {
      const match = matchNhkFeed(await fetchNhkFeed(), headlineHint);
      if (match) {
        return res.status(200).json({
          ok: true,
          ...article,
          headlineHint,
          sentences: match.sentences,
          access: 'matched-public',
          sentenceCount: match.sentences.length,
          resolvedBy: 'public-nhk-match',
          referenceUrl: match.sourceUrl,
          ...(match.officialUrl ? {officialUrl: match.officialUrl} : {}),
        });
      }
    }

    const direct = articles.find(candidate => candidate.access === 'full' && candidate.sentences.length >= 2);
    if (direct) return res.status(200).json({ok: true, ...direct, sentenceCount: direct.sentences.length, resolvedBy: 'moji-page'});

    return res.status(422).json({
      ok: false,
      reason: articles.some(candidate => candidate.access === 'member-only') ? 'member_transcript_unavailable' : 'no_japanese_sentences',
      title: article.title,
      headlineDetected: Boolean(headlineHint),
      ...(headlineHint ? {headlineHint} : {}),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'parse_failed';
    console.error('moji-article handler failed', reason);
    return res.status(502).json({ok: false, reason});
  }
}
