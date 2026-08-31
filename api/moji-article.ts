import type {VercelRequest, VercelResponse} from '@vercel/node';
import {normalizeMojiArticleUrl, parseMojiArticleHtml} from '../src/mojiArticle';

const MAX_HTML_BYTES = 2_500_000;
const FETCH_TIMEOUT_MS = 10_000;

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
    const article = parseMojiArticleHtml(html, finalUrl);
    return res.status(200).json({ok: true, ...article, sentenceCount: article.sentences.length});
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'parse_failed';
    return res.status(502).json({ok: false, reason});
  }
}
