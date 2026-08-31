import type { VercelRequest, VercelResponse } from '@vercel/node';

const OLD_BACKEND = 'https://api-v2.appdeploy.ai/app/nihongo-discovery-e819sz/api';
const SUPABASE_PUBLIC = 'https://kivebsjsdfdobxzaokbj.supabase.co/storage/v1/object/public/nihongo-audio/play-audio-v2/by-story';
const CLIPS = ['listen','replyPrompt','reply','daily','polite','business','scene0','scene1','scene2','scene3','scene4','recall'] as const;
type ClipState = 'ready' | 'pending' | 'failed';

async function getSupabaseReady(storyId: string) {
  const entries = await Promise.all(CLIPS.map(async clipId => {
    const url = `${SUPABASE_PUBLIC}/${encodeURIComponent(storyId)}/${clipId}.json`;
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(2500) });
      if (!r.ok) return [clipId, false] as const;
      const meta = await r.json() as { storyId?: string; clipId?: string };
      return [clipId, meta.storyId === storyId && meta.clipId === clipId] as const;
    } catch {
      return [clipId, false] as const;
    }
  }));
  return new Set(entries.filter(([, ready]) => ready).map(([clipId]) => clipId));
}

async function getLegacyStatus(storyId: string) {
  try {
    const response = await fetch(`${OLD_BACKEND}/play-audio-status/${encodeURIComponent(storyId)}`, { signal: AbortSignal.timeout(6000) });
    const text = await response.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch {}
    return { status: response.status, data };
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, reason: 'method_not_allowed' });
  const storyId = String(req.query.storyId || '');
  if (!storyId) return res.status(400).json({ ok: false, reason: 'missing_story_id' });

  const [supabaseReady, legacy] = await Promise.all([getSupabaseReady(storyId), getLegacyStatus(storyId)]);
  if (!supabaseReady.size && legacy?.status === 404) {
    return res.status(404).json(legacy.data || { ok: false, reason: 'not_allowed', clips: {} });
  }

  const legacyClips = legacy?.data?.clips && typeof legacy.data.clips === 'object' ? legacy.data.clips : {};
  const clips: Record<string, ClipState> = {};
  for (const clipId of CLIPS) {
    const legacyState = legacyClips[clipId];
    clips[clipId] = supabaseReady.has(clipId)
      ? 'ready'
      : legacyState === 'ready' || legacyState === 'failed' || legacyState === 'pending'
        ? legacyState
        : 'pending';
  }

  const ready = Object.values(clips).filter(v => v === 'ready').length;
  const pending = Object.values(clips).filter(v => v === 'pending').length;
  const failed = Object.values(clips).filter(v => v === 'failed').length;
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    ok: true,
    storyId,
    clips,
    total: CLIPS.length,
    ready,
    pending,
    failed,
    storage: {
      supabaseReady: supabaseReady.size,
      appdeployFallback: CLIPS.length - supabaseReady.size,
      mode: 'supabase-first-appdeploy-fallback',
    },
  });
}
