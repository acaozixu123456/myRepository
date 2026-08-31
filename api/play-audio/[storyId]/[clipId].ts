import type { VercelRequest, VercelResponse } from '@vercel/node';

const OLD_BACKEND = 'https://api-v2.appdeploy.ai/app/nihongo-discovery-e819sz/api';
const SUPABASE_PUBLIC = 'https://kivebsjsdfdobxzaokbj.supabase.co/storage/v1/object/public/nihongo-audio/play-audio-v2/by-story';

async function getSupabaseClip(storyId: string, clipId: string) {
  const base = `${SUPABASE_PUBLIC}/${encodeURIComponent(storyId)}/${encodeURIComponent(clipId)}`;
  try {
    const metaResponse = await fetch(`${base}.json`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(2500),
    });
    if (!metaResponse.ok) return null;
    const meta = await metaResponse.json() as {
      storyId?: string;
      clipId?: string;
      text?: string | null;
      model?: string | null;
      source?: string | null;
      migratedFrom?: string;
    };
    if (meta.storyId !== storyId || meta.clipId !== clipId) return null;
    return {
      ok: true,
      clipId,
      status: 'ready',
      url: `${base}.mp3`,
      text: meta.text || undefined,
      model: meta.model || undefined,
      source: meta.source || 'play-v2',
      storage: 'supabase',
      migratedFrom: meta.migratedFrom || 'appdeploy',
    };
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, reason: 'method_not_allowed' });
  const storyId = String(req.query.storyId || '');
  const clipId = String(req.query.clipId || '');
  if (!storyId || !clipId) return res.status(400).json({ ok: false, reason: 'missing_audio_target' });

  const migrated = await getSupabaseClip(storyId, clipId);
  if (migrated) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(migrated);
  }

  try {
    const upstream = await fetch(`${OLD_BACKEND}/play-audio/${encodeURIComponent(storyId)}/${encodeURIComponent(clipId)}`, { signal: AbortSignal.timeout(6000) });
    const body = await upstream.text();
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Nihongo-Audio-Storage', 'appdeploy-fallback');
    return res.status(upstream.status).send(body);
  } catch (error) {
    console.error('audio fallback proxy failed', error);
    return res.status(502).json({ ok: false, status: 'pending', reason: 'audio_backend_unavailable' });
  }
}
