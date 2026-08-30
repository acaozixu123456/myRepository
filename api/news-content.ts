import type { VercelRequest, VercelResponse } from '@vercel/node';

const RAW_URL = 'https://raw.githubusercontent.com/acaozixu123456/myRepository/nihongo-content/nihongo-discovery/content/manifest.json';
const ALLOWED = new Set(['published', 'audio_validation_failed']);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, reason: 'method_not_allowed' });
  try {
    const upstream = await fetch(`${RAW_URL}?ts=${Date.now()}`, {
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
      signal: AbortSignal.timeout(6000),
    });
    if (!upstream.ok) return res.status(502).json({ ok: false, source: 'github', stories: [] });
    const manifest = await upstream.json() as { schemaVersion?: number; updatedAt?: string; items?: Array<{ status?: string; story?: unknown }> };
    const stories = Array.isArray(manifest.items)
      ? manifest.items.filter(item => ALLOWED.has(item.status || '') && item.story).map(item => item.story)
      : [];
    res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=30');
    return res.status(200).json({ ok: true, source: 'github', updatedAt: manifest.updatedAt || '', stories });
  } catch (error) {
    console.error('news-content fetch failed', error);
    return res.status(502).json({ ok: false, source: 'github', stories: [] });
  }
}
