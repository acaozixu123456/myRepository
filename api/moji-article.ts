import type {VercelRequest, VercelResponse} from '@vercel/node';
import {
  matchNhkEasierFeed,
  normalizeMojiArticleUrl,
  parseMojiArticleHtml,
  type ParsedMojiArticle,
} from '../src/mojiArticle';

const MAX_HTML_BYTES = 2_500_000;
const MAX_FEED_BYTES = 1_000_000;
const FETCH_TIMEOUT_MS = 8_000;
const FEED_CACHE_MS = 5 * 60_000;
const NHK_EASIER_FEED_URL = 'https://nhkeasier.com/feed/?no-furiganas';

let feedCache: {at: number; xml: string} | null = null;

const requestHeaders = {
  'Accept-Language': 'ja,en;q=0.8,zh-CN;q=0.6',
  'Cache-Control': 'no-cache',
  'User-Agent': 'NihongoDiscovery/0.1 (+private language study)',
};

const fetchArticleHtml = async (canonicalUrl: string): Promise<{html: string; finalUrl: string}> => {
  const articleId = canonicalUrl.split('/').pop();
  const candidates = [canonicalUrl, `https://m.mojidict.com/article/${articleId}`];
  let lastStatus = 0;

  for (const url of candidates) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: {
          ...requestHeaders,
          Accept: 'text/html,application/xhtml+xml',
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

const fetchNhkEasierFeed = async (): Promise<string> => {
  const now = Date.now();
  if (feedCache && now - feedCache.at < FEED_CACHE_MS) return feedCache.xml;
  const response = await fetch(NHK_EASIER_FEED_URL, {
    headers: {...requestHeaders, Accept: 'application/rss+xml,application/xml,text/xml'},
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`nhk_feed_http_${response.status}`);
  const xml = (await response.text()).slice(0, MAX_FEED_BYTES);
  if (!xml.includes('<rss') || !xml.includes('<item')) throw new Error('nhk_feed_invalid');
  feedCache = {at: now, xml};
  return xml;
};

const resolvePublicNhkTranscript = async (article: ParsedMojiArticle): Promise<ParsedMojiArticle> => {
  if (article.access === 'full' || !article.headlineHint) return article;
  try {
    const feed = await fetchNhkEasierFeed();
    const match = matchNhkEasierFeed(feed, article.headlineHint);
    if (!match) return article;
    return {
      ...article,
      sentences: match.sentences,
      access: 'matched-public',
      requiresClipboard: false,
      referenceUrl: match.sourceUrl,
      ...(match.officialUrl ? {officialUrl: match.officialUrl} : {}),
    };
  } catch {
    return article;
  }
};

export default async function handler(req: VercelRequest, res: VercResponse) {
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
    const parsed = parseMojiArticleHtml(html, finalUrl);
    const article = await resolvePublicNhkTranscript(parsed);
    return res.status(200).json({
      ok: true,
      ...article,
      sentenceCount: article.sentences.length,
      resolvedBy: article.access === 'matched-public' ? 'public-nhk-match' : 'moji-page',
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'parse_failed';
    return res.status(502).json({ok: false, reason});
  }
}
