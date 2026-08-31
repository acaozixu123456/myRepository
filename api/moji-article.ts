import type {VercelRequest, VercelResponse} from '@vercel/node';

const ALLOWED_HOSTS = new Set(['mojidict.com', 'www.mojidict.com', 'm.mojidict.com']);
const ARTICLE_PATH = /^\/article\/[A-Za-z0-9_-]+\/?$/;
const MAX_HTML_BYTES = 2_500_000;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_SENTENCES = 48;
const UI_NOISE = [
  '显示译文', '点击显示译文', '隐藏译文', '点击重新加载', '点赞', '收藏', '评论',
  '登录MOJi', '注册', '下载MOJi', '完整内容请下载', '阅读', '扫码', '扫一扫',
  '请选择', '上一篇', '下一篇', '相关推荐', '打开APP', 'APP内打开', '版权',
];

type ParsedArticle = {sourceUrl: string; title: string; sentences: string[]};

const normalizeMojiArticleUrl = (input: string): string | null => {
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
    try { collectJsonStrings(JSON.parse(raw), output); } catch { /* Visible HTML is parsed separately. */ }
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

const extractJapaneseSentences = (html: string): string[] => {
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
      if (score < 20) continue;
      accepted.push({sentence, score, order: order++});
    }
  }
  return accepted.sort((a, b) => a.order - b.order).slice(0, MAX_SENTENCES).map(item => item.sentence);
};

const parseArticleHtml = (html: string, sourceUrl: string): ParsedArticle => ({
  sourceUrl: normalizeMojiArticleUrl(sourceUrl) || sourceUrl,
  title: extractTitle(html),
  sentences: extractJapaneseSentences(html),
});

const fetchArticleHtml = async (canonicalUrl: string): Promise<{html: string; finalUrl: string}> => {
  const articleId = canonicalUrl.split('/').pop();
  const candidates = [canonicalUrl, `https://m.mojidict.com/article/${articleId}`];
  let lastStatus = 0;
  for (const url of candidates) {
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
      lastStatus = response.status;
      const finalUrl = normalizeMojiArticleUrl(response.url);
      if (!response.ok || !finalUrl) continue;
      const html = (await response.text()).slice(0, MAX_HTML_BYTES);
      if (html.length >= 200) return {html, finalUrl};
    } catch {
      // Try the alternate MOJi host before failing.
    }
  }
  throw new Error(lastStatus ? `upstream_http_${lastStatus}` : 'upstream_unavailable');
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ok: false, reason: 'method_not_allowed'});
  }
  const inputUrl = req.method === 'GET'
    ? String(req.query.url || '')
    : typeof req.body?.url === 'string' ? req.body.url : '';
  const canonicalUrl = normalizeMojiArticleUrl(inputUrl);
  if (!canonicalUrl) return res.status(400).json({ok: false, reason: 'invalid_moji_article_url'});

  try {
    const {html, finalUrl} = await fetchArticleHtml(canonicalUrl);
    const article = parseArticleHtml(html, finalUrl);
    if (!article.sentences.length) {
      return res.status(422).json({ok: false, reason: 'no_japanese_sentences', title: article.title});
    }
    return res.status(200).json({ok: true, ...article, sentenceCount: article.sentences.length});
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'parse_failed';
    return res.status(502).json({ok: false, reason});
  }
}
