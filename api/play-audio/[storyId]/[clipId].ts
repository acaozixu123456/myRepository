import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPABASE_PUBLIC = 'https://kivebsjsdfdobxzaokbj.supabase.co/storage/v1/object/public/nihongo-audio/play-audio-v2/by-story';
const ALLOWED_CLIPS = new Set(['listen','replyPrompt','reply','daily','polite','business','scene0','scene1','scene2','scene3','scene4','recall']);

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
      generatedBy?: string;
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
      ...(meta.migratedFrom ? { migratedFrom: meta.migratedFrom } : {}),
      ...(meta.generatedBy ? { generatedBy: meta.generatedBy } : {}),
    };
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, reason: 'method_not_allowed' });
  const storyId = String(req.query.storyId || '');
  const clipId = String(req.query.clipId || '');
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(storyId) || !ALLOWED_CLIPS.has(clipId)) {
    return res.status(400).json({ ok: false, reason: 'invalid_audio_target' });
  }

  const clip = await getSupabaseClip(storyId, clipId);
  res.setHeader('Cache-Control', 'no-store');
  if (clip) return res.status(200).json(clip);

  return res.status(200).json({
    ok: true,
    clipId,
    status: 'pending',
    storage: 'supabase',
    reason: 'audio_not_ready',
    generation: 'supabase-native-backfill',
  });
}
