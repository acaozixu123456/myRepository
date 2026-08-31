export type ParsedMojiArticle = {
  sourceUrl: string;
  title: string;
  sentences: string[];
};

const ALLOWED_HOSTS = new Set(['mojidict.com', 'www.mojidict.com', 'm.mojidict.com']);
const ARTICLE_PATH = /^\/article\/[A-Za-z0-9_-]+\/?$/;
const MAX_SENTENCES = 48;

const UI_NOISE = [
  '显示译文', '点击显示译文', '隐藏译文', '点击重新加载', '点赞', '收藏', '评论',
  '登录MOJi', '注册', '下载MOJi', '完整内容请下载', '阅读', '扫码', '扫一扫',
  '请选择', '上一篇', '下一篇', '相关推荐', '打开APP', 'APP内打开', '版权',
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
  const meta = firstMatch(html, [
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["'][^>]*>/i,
    /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:title["'][^>]*>/i,
  ]);
  const heading = firstMatch(html, [/<h1\b[^>]*>([\s\S]*?)<\/h1>/i]);
  const documentTitle = firstMatch(html, [/<title\b[^>]*>([\s\S]*?)<\/title>/i]);
  const candidates = [meta, heading, documentTitle].map(cleanTitle).filter(Boolean);
  return candidates.find(title => !/^MOJi(?:辞書|辞书)?$/i.test(title)) || 'NHK日语听力';
};

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
      // Visible extraction below handles non-JSON script payloads.
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
  .replace(/^\s*(?:[•●▪︎◆◇■□▶︎▷]|[-–—*#>]|\d+[.)、．])\s*/u, '')
  .replace(/^Image:\s*/i, '')
  .replace(/\s+/g, ' '))
  .replace(/^[「『]\s*/, match => match.trim())
  .trim();

const count = (value: string, pattern: RegExp): number => value.match(pattern)?.length || 0;

const sentenceScore = (sentence: string): number => {
  if (sentence.length < 10 || sentence.length > 220) return -1;
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
  return kana * 2 + kanji + punctuation + conversational - Math.max(0, sentence.length - 150) / 5;
};

const splitIntoCandidates = (source: string): string[] => source
  .split(/\n+/)
  .flatMap(line => line.match(/[^。！？!?]+[。！？!?]?/g) || [])
  .map(cleanSentence)
  .filter(Boolean);

export const extractJapaneseSentences = (html: string): string[] => {
  const sources = [...extractJsonText(html), htmlToText(html)];
  const seen = new Set<string>();
  const accepted: Array<{sentence: string; score: number; order: number}> = [];
  let order = 0;

  for (const source of sources) {
    for (const sentence of splitIntoCandidates(source)) {
      const key = sentence.replace(/[\s「」『』]/g, '');
      if (seen.has(key)) continue;
      seen.add(key);
      const score = sentenceScore(sentence);
      if (score < 0) continue;
      accepted.push({sentence, score, order: order++});
    }
  }

  return accepted
    .filter(item => item.score >= 20)
    .sort((a, b) => a.order - b.order)
    .slice(0, MAX_SENTENCES)
    .map(item => item.sentence);
};

export const parseMojiArticleHtml = (html: string, sourceUrl: string): ParsedMojiArticle => ({
  sourceUrl: normalizeMojiArticleUrl(sourceUrl) || sourceUrl,
  title: extractTitle(html),
  sentences: extractJapaneseSentences(html),
});
