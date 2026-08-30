import type { VercelRequest, VercelResponse } from '@vercel/node';

const OLD_BACKEND = 'https://api-v2.appdeploy.ai/app/nihongo-discovery-e819sz/api';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, reason: 'method_not_allowed' });
  const storyId = String(req.query.storyId || '');
  const clipId = String(req.query.clipId || '');
  if (!storyId || !clipId) return res.status(400).json({ ok: false, reason: 'missing_audio_target' });
  try {
    const upstream = await fetch(`${OLD_BACKEND}/play-audio/${encodeURIComponent(storyId)}/${encodeURIComponent(clipId)}`, { signal: AbortSignal.timeout(6000) });
    const body = await upstream.text();
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(upstream.status).send(body);
  } catch (error) {
    console.error('audio proxy failed', error);
    return res.status(502).json({ ok: false, status: 'pending', reason: 'audio_backend_unavailable' });
  }
}
