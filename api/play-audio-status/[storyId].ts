import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPABASE_PUBLIC = 'https://kivebsjsdfdobxzaokbj.supabase.co/storage/v1/object/public/nihongo-audio/play-audio-v2/by-story';
const CLIPS = ['listen','replyPrompt','reply','daily','polite','business','scene0','scene1','scene2','scene3','scene4','recall'] as const;
type ClipState = 'ready' | 'pending';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, reason: 'method_not_allowed' });
  const storyId = String(req.query.storyId || '');
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(storyId)) return res.status(400).json({ ok: false, reason: 'invalid_story_id' });

  const supabaseReady = await getSupabaseReady(storyId);
  const clips: Record<string, ClipState> = {};
  for (const clipId of CLIPS) clips[clipId] = supabaseReady.has(clipId) ? 'ready' : 'pending';

  const ready = Object.values(clips).filter(v => v === 'ready').length;
  const pending = CLIPS.length - ready;
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    ok: true,
    storyId,
    clips,
    total: CLIPS.length,
    ready,
    pending,
    failed: 0,
    storage: {
      supabaseReady: supabaseReady.size,
      appdeployFallback: 0,
      mode: 'supabase-only',
    },
    generation: 'supabase-native-backfill',
  });
}
