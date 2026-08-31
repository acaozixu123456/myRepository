import type { VercelRequest, VercelResponse } from '@vercel/node';
import { stories as bundledStories, type Story } from '../../src/content';
import { buildPlayPlan, PLAY_CLIP_ORDER } from '../../src/playPlan';

const RAW_URL = 'https://raw.githubusercontent.com/acaozixu123456/myRepository/nihongo-content/nihongo-discovery/content/manifest.json';
const ALLOWED = new Set(['published', 'audio_validation_failed']);

async function findStory(storyId: string): Promise<Story | null> {
  const bundled = bundledStories.find(story => story.id === storyId);
  if (bundled) return bundled;

  try {
    const upstream = await fetch(`${RAW_URL}?ts=${Date.now()}`, {
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
      signal: AbortSignal.timeout(6000),
    });
    if (!upstream.ok) return null;
    const manifest = await upstream.json() as {
      items?: Array<{ status?: string; story?: Story }>;
    };
    const item = Array.isArray(manifest.items)
      ? manifest.items.find(entry => ALLOWED.has(entry.status || '') && entry.story?.id === storyId)
      : undefined;
    return item?.story || null;
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, reason: 'method_not_allowed' });
  const storyId = String(req.query.storyId || '');
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(storyId)) {
    return res.status(400).json({ ok: false, reason: 'invalid_story_id' });
  }

  const story = await findStory(storyId);
  const plan = story ? buildPlayPlan(story) : null;
  if (!story || !plan) return res.status(404).json({ ok: false, reason: 'not_allowed' });

  const clips = PLAY_CLIP_ORDER.map(id => ({
    id,
    text: plan.clips[id].text,
    style: plan.clips[id].style,
  }));

  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=300');
  return res.status(200).json({
    ok: true,
    version: 'play-audio-v2',
    model: 'gpt-4o-mini-tts-2025-12-15',
    voice: 'marin',
    storyId,
    total: clips.length,
    clips,
  });
}
