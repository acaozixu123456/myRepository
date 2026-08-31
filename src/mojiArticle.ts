export type MojiArticleAccess = 'full' | 'excerpt' | 'member-only' | 'matched-public';

export type ParsedMojiArticle = {
  sourceUrl: string;
  title: string;
  sentences: string[];
  access: MojiArticleAccess;
  requiresClipboard: boolean;
  excerpt?: string;
  headlineHint?: string;
  referenceUrl?: string;
  officialUrl?: string;
};

export type NhkFeedMatch = {
  title: string;
  sourceUrl: string;
  officialUrl?: string;
  sentences: string[];
  score: number;
};

const ALLOWED_HOSTS = new Set(['mojidict.com', 'www.mojidict.com', 'm.mojidict.com']);
const ARTICLE_PATH = /^\/article\/[A-Za-z0-9_-]+\/?$/;
const MAX_SENTENCES = 48;
const MEMBER_ONLY_PATTERN = /本文为会员专享文章|会员专享文章|请打开\s*App\s*阅读|请打开\s*APP\s*阅读/i;

const UI_NOISE = [
  '显示译文', '点击显示译文', '隐藏译文', '点击重新加载', '点赞', '收藏', '评论',
  '登录MOJi', '注册', '下载MOJi', '完整内容请下载', '阅读', '扫码', '扫一扫',
  '请选择', '上一篇', '下一篇', '相关推荐', '打开APP', 'APP内打开', '版权',
  '点击单词查询释义', '本文为会员专享文章', '专栏推荐',
  'Original', 'Permalink', 'Story illustration', 'Content is missing',
];

const decodeCodePoint = (value: string, radix: number): string => {
  const codePoint = Number.parseInt(value, radix);
  if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return '';
  try { return String.fromCodePoint(codePoint); } catch { return ''; }
};

export const decodeHtml = (value: string): string => value
  .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => decodeCodePoint(code, 16))
  .replace(/&#(\d+);/g, (_, code: string) => decodeCodePoint(code, 10))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&apos;|&#39;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>');

export const normalizeMojiArticleUrl = (input: string): string | null => {
  try {
    const url = new URL(input.trim());
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(host) || !ARTICLE_PATH.test(url.pathname)) return null;
    const articleId = url.pathname.split('/').filter(Boolean)[1];
    return `https://www.mojidict.com/article/${articleId}`;
  } catch {
    return null;
  }
};

const readAttribute = (tag: string, name: string): string => {
  const pattern = new RegExp(`${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i');
  return pattern.exec(tag)?.[2] || '';
};

const extractMetaContent = (html: string, acceptedNames: string[]): string => {
  const accepted = new Set(acceptedNames.map(value => value.toLowerCase()));
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const key = (readAttribute(tag, 'property') || readAttribute(tag, 'name')).toLowerCase();
    if (!accepted.has(key)) continue;
    const content = readAttribute(tag, 'content');
    if (content) return content;
  }
  return '';
};

const cleanTitle = (value: string): string => decodeHtml(value)
  .replace(/<[^>]+>/g, ' ')
  .replace(/^日语阅读\s*[-–—|]\s*/i, '')
  .replace(/\s*[-–—|]\s*MOJi(?:辞書|辞书).*$/i, '')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 160);

const firstMatch = (html: string, patterns: RegExp[]): string => {
  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match?.[1]) return match[1];
  }
  return '';
};

const extractTitle = (html: string): string => {
  const meta = extractMetaContent(html, ['og:title', 'twitter:title']);
  const heading = firstMatch(html, [/<h1\b[^>]*>([\s\S]*?)<\/h1>/i]);
  const documentTitle = firstMatch(html, [/<title\b[^>]*>([\s\S]*?)<\/title>/i]);
  const candidates = [meta, heading, documentTitle].map(cleanTitle).filter(Boolean);
  return candidates.find(title => !/^MOJi(?:辞書|辞书)?$/i.test(title)) || 'NHK日语听力';
};

const cleanExcerpt = (value: string): string => decodeHtml(value)
  .replace(/<[^>]+>/g, ' ')
  .replace(/👉?\s*点击单词查询释义\s*/gi, '\n')
  .replace(/本篇听读难度预估[:：]?\s*N\d(?:\s*[-–]\s*N\d)?/gi, ' ')
  .replace(/[ \t]+/g, ' ')
  .replace(/\n\s+/g, '\n')
  .trim()
  .slice(0, 500);

const removeHiddenMarkup = (html: string): string => html
  .replace(/<(script|style|noscript|svg|canvas|template)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<(rt|rp)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
  .replace(/<(nav|header|footer|button|form)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ');

const htmlToText = (html: string): string => decodeHtml(removeHiddenMarkup(html)
  .replace(/<br\s*\/?\s*>/gi, '\n')
  .replace(/<\/(p|div|li|section|article|h[1-6]|blockquote|tr)>/gi, '\n')
  .replace(/<(p|div|li|section|article|h[1-6]|blockquote|tr)\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' '))
  .replace(/[\u200b-\u200f\u202a-\u202e\ufeff]/g, '')
  .replace(/\r/g, '\n');

const collectJsonStrings = (value: unknown, output: string[], depth = 0): void => {
  if (depth > 14 || output.length > 300) return;
  if (typeof value === 'string') {
    if (value.length >= 8 && /[ぁ-んァ-ヶー]/.test(value)) output.push(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach(item => collectJsonStrings(item, output, depth + 1));
    return;
  }
  if (value && typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach(item => collectJsonStrings(item, output, depth + 1));
  }
};

const extractJsonText = (html: string): string[] => {
  const output: string[] = [];
  const scriptPattern = /<script\b[^>]*(?:type=["']application\/(?:ld\+json|json)["']|id=["']__NEXT_DATA__["'])[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptPattern.exec(html))) {
    const raw = decodeHtml(match[1].trim());
    try {
      collectJsonStrings(JSON.parse(raw), output);
    } catch {
      // Non-JSON application state is intentionally not evaluated.
    }
  }
  return output;
};

const normalizeJapaneseSpacing = (value: string): string => value
  .replace(/([\u3400-\u9fffぁ-んァ-ヶー])\s+(?=[\u3400-\u9fffぁ-んァ-ヶー])/g, '$1')
  .replace(/[（(]\s*[）)]/g, '')
  .replace(/[ \t]+/g, ' ')
  .trim();

const cleanSentence = (value: string): string => normalizeJapaneseSpacing(decodeHtml(value)
  .replace(/<[^>]+>/g, ' ')
  .replace(/👉?\s*点击单词查询释义\s*/gi, '\n')
  .replace(/^\s*(?:[•●▪︎◆◇■□▶︎▷]|[-–—*#>]|\d+[.)、．])\s*/u, '')
  .replace(/^Image:\s*/i, '')
  .replace(/\s+/g, ' '))
  .trim();

const count = (value: string, pattern: RegExp): number => value.match(pattern)?.length || 0;

const sentenceScore = (sentence: string): number => {
  if (sentence.length < 10 || sentence.length > 260) return -1;
  if (UI_NOISE.some(noise => sentence.includes(noise))) return -1;
  if (/https?:\/\//i.test(sentence)) return -1;
  if (/^(?:NHK|MOJi|APP|PR|SNS)[\s\w-]*$/i.test(sentence)) return -1;

  const kana = count(sentence, /[ぁ-んァ-ヶー]/g);
  const kanji = count(sentence, /[\u3400-\u9fff]/g);
  const japanese = kana + kanji;
  const compactLength = sentence.replace(/[\s\p{P}\p{S}\d]/gu, '').length;
  if (kana < 3 || japanese < 8 || japanese / Math.max(compactLength, 1) < 0.42) return -1;

  const punctuation = /[。！？]$/.test(sentence) ? 10 : 0;
  const conversational = /(?:です|ます|ました|ません|でしょう|という|について|によると|しています)/.test(sentence) ? 5 : 0;
  return kana * 2 + kanji + punctuation + conversational - Math.max(0, sentence.length - 170) / 5;
};

const splitIntoCandidates = (source: string): string[] => source
  .split(/\n+/)
  .flatMap(line => line.match(/[^。！？!?]+[。！？!?]?/g) || [])
  .map(cleanSentence)
  .filter(Boolean);

const collectSentences = (sources: string[]): string[] => {
  const seen = new Set<string>();
  const accepted: Array<{sentence: string; score: number; order: number}> = [];
  let order = 0;

  for (const source of sources) {
    for (const sentence of splitIntoCandidates(source)) {
      const key = sentence.replace(/[\s「」『』]/g, '');
      if (seen.has(key)) continue;
      seen.add(key);
      const score = sentenceScore(sentence);
      if (score < 20) continue;
      accepted.push({sentence, score, order: order++});
    }
  }

  return accepted
    .sort((a, b) => a.order - b.order)
    .slice(0, MAX_SENTENCES)
    .map(item => item.sentence);
};

export const extractJapaneseSentencesFromText = (text: string): string[] => collectSentences([text]);

export const extractJapaneseSentences = (html: string): string[] => collectSentences([
  ...extractJsonText(html),
  htmlToText(html),
]);

export const extractMojiHeadlineHint = (html: string): string => {
  const rawDescription = extractMetaContent(html, ['og:description', 'description', 'twitter:description']);
  const lead = decodeHtml(rawDescription).split(/👉|→|点击单词查询释义|點擊單詞查詢釋義/i)[0] || '';
  const runs = lead.match(/[\u3000-\u30ff\u3400-\u9fffA-Za-z0-9０-９「」『』・、。！？!?\s]+/g) || [];
  return runs
    .map(cleanSentence)
    .filter(value => value.length >= 8 && /[ぁ-んァ-ヶー]/.test(value))
    .sort((a, b) => b.length - a.length)[0]
    ?.replace(/[。！？!?]+$/, '') || '';
};

const memberPreviewSentences = (rawDescription: string): string[] => {
  const headline = extractMojiHeadlineHint(`<meta name="description" content="${rawDescription.replace(/"/g, '&quot;')}">`);
  const complete = extractJapaneseSentencesFromText(cleanExcerpt(rawDescription))
    .filter(sentence => /[。！？]$/.test(sentence));
  const preview = sentenceScore(headline) >= 20 ? [headline] : [];
  return [...new Set([...preview, ...complete])].slice(0, 4);
};

export const parseMojiArticleHtml = (html: string, sourceUrl: string): ParsedMojiArticle => {
  const canonicalUrl = normalizeMojiArticleUrl(sourceUrl) || sourceUrl;
  const title = extractTitle(html);
  const rawDescription = extractMetaContent(html, ['og:description', 'description', 'twitter:description']);
  const excerpt = cleanExcerpt(rawDescription);
  const headlineHint = extractMojiHeadlineHint(html);
  const memberOnly = MEMBER_ONLY_PATTERN.test(html);

  if (memberOnly) {
    return {
      sourceUrl: canonicalUrl,
      title,
      sentences: memberPreviewSentences(rawDescription),
      access: 'member-only',
      requiresClipboard: true,
      ...(excerpt ? {excerpt} : {}),
      ...(headlineHint ? {headlineHint} : {}),
    };
  }

  const fullSentences = extractJapaneseSentences(html);
  if (fullSentences.length) {
    return {
      sourceUrl: canonicalUrl,
      title,
      sentences: fullSentences,
      access: 'full',
      requiresClipboard: false,
      ...(excerpt ? {excerpt} : {}),
      ...(headlineHint ? {headlineHint} : {}),
    };
  }

  return {
    sourceUrl: canonicalUrl,
    title,
    sentences: memberPreviewSentences(rawDescription),
    access: 'excerpt',
    requiresClipboard: true,
    ...(excerpt ? {excerpt} : {}),
    ...(headlineHint ? {headlineHint} : {}),
  };
};

const extractXmlTag = (xml: string, tag: string): string => {
  const match = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(xml);
  return (match?.[1] || '').replace(/^<!\[CDATA\[|\]\]>$/g, '').trim();
};

export const normalizeJapaneseHeadline = (value: string): string => cleanSentence(value)
  .replace(/[\s　「」『』・：:、。！？!?（）()\[\]【】]/g, '')
  .toLowerCase();

const bigrams = (value: string): string[] => {
  if (value.length < 2) return value ? [value] : [];
  const output: string[] = [];
  for (let index = 0; index < value.length - 1; index += 1) output.push(value.slice(index, index + 2));
  return output;
};

export const headlineSimilarity = (left: string, right: string): number => {
  const a = normalizeJapaneseHeadline(left);
  const b = normalizeJapaneseHeadline(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return Math.min(a.length, b.length) / Math.max(a.length, b.length);

  const aPairs = bigrams(a);
  const bPairs = bigrams(b);
  const bCounts = new Map<string, number>();
  for (const pair of bPairs) bCounts.set(pair, (bCounts.get(pair) || 0) + 1);
  let overlap = 0;
  for (const pair of aPairs) {
    const remaining = bCounts.get(pair) || 0;
    if (remaining <= 0) continue;
    overlap += 1;
    bCounts.set(pair, remaining - 1);
  }
  return (2 * overlap) / Math.max(aPairs.length + bPairs.length, 1);
};

export const matchNhkEasierFeed = (feedXml: string, headlineHint: string): NhkFeedMatch | null => {
  if (!headlineHint.trim()) return null;
  const items = feedXml.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  const candidates: NhkFeedMatch[] = [];

  for (const item of items) {
    const title = cleanSentence(decodeHtml(extractXmlTag(item, 'title')));
    const score = headlineSimilarity(headlineHint, title);
    if (score < 0.78) continue;

    const description = decodeHtml(extractXmlTag(item, 'description'));
    const sentences = extractJapaneseSentences(description);
    if (sentences.length < 2) continue;

    const sourceUrl = decodeHtml(extractXmlTag(item, 'link') || extractXmlTag(item, 'guid'));
    const officialUrl = description.match(/https:\/\/www3\.nhk\.or\.jp\/news\/easy\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.html/i)?.[0];
    candidates.push({title, sourceUrl, officialUrl, sentences, score});
  }

  return candidates.sort((a, b) => b.score - a.score)[0] || null;
};
