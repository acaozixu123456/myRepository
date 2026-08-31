import type { VercelRequest, VercelResponse } from '@vercel/node';

const RAW_URL = 'https://raw.githubusercontent.com/acaozixu123456/myRepository/nihongo-content/nihongo-discovery/content/manifest.json';
const SUPABASE_PUBLIC = 'https://kivebsjsdfdobxzaokbj.supabase.co/storage/v1/object/public/nihongo-audio/play-audio-v2/by-story';
const ALLOWED = new Set(['published', 'audio_validation_failed']);
const CLIP_ORDER = ['listen','replyPrompt','reply','daily','polite','business','scene0','scene1','scene2','scene3','scene4','recall'] as const;
type ClipId = typeof CLIP_ORDER[number];
type ClipStyle = 'neutral' | 'casual' | 'polite' | 'business';
type Scenario = { emoji?: string; cue?: string; jp: string; cn?: string };
type StoryLike = {
  id: string;
  key?: { term?: string };
  jp?: string;
  use?: { choices?: string[]; correct?: number };
  transfer?: { prompt?: string; choices?: string[]; correct?: number; feedback?: string };
  review?: { prompt?: string; cloze?: string; answer?: string; feedback?: string };
  practice?: { examples?: Scenario[] };
  play?: {
    daily?: string;
    polite?: string;
    business?: string;
    replyPrompt?: string;
    reply?: string;
    scenarios?: Scenario[];
  };
};

type Clip = { id: ClipId; text: string; style: ClipStyle };

const styleFor = (id: ClipId): ClipStyle => {
  if (id === 'daily') return 'casual';
  if (id === 'polite' || id === 'reply') return 'polite';
  if (id === 'business') return 'business';
  return 'neutral';
};

async function metadataPlan(storyId: string): Promise<Clip[] | null> {
  try {
    const clips = await Promise.all(CLIP_ORDER.map(async id => {
      const url = `${SUPABASE_PUBLIC}/${encodeURIComponent(storyId)}/${encodeURIComponent(id)}.json`;
      const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(2500) });
      if (!response.ok) return null;
      const meta = await response.json() as { storyId?: string; clipId?: string; text?: string };
      if (meta.storyId !== storyId || meta.clipId !== id || !meta.text?.trim()) return null;
      return { id, text: meta.text, style: styleFor(id) } satisfies Clip;
    }));
    return clips.every(Boolean) ? clips as Clip[] : null;
  } catch {
    return null;
  }
}

async function manifestStory(storyId: string): Promise<StoryLike | null> {
  try {
    const upstream = await fetch(`${RAW_URL}?ts=${Date.now()}`, {
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
      signal: AbortSignal.timeout(6000),
    });
    if (!upstream.ok) return null;
    const manifest = await upstream.json() as { items?: Array<{ status?: string; story?: StoryLike }> };
    const item = Array.isArray(manifest.items)
      ? manifest.items.find(entry => ALLOWED.has(entry.status || '') && entry.story?.id === storyId)
      : undefined;
    return item?.story || null;
  } catch {
    return null;
  }
}

const recallText = (story: StoryLike) => {
  const cloze = story.review?.cloze || '';
  const answer = story.review?.answer || '';
  return cloze.replace(/＿+/g, answer);
};

const dialogueLines = (jp?: string) => (jp || '')
  .split('\n')
  .map(line => line.includes('：') ? line.slice(line.indexOf('：') + 1) : line)
  .filter(Boolean);

function storyPlan(story: StoryLike): Clip[] | null {
  const base = story.play?.scenarios?.length
    ? story.play.scenarios.map(item => ({ ...item }))
    : story.practice?.examples?.length
      ? story.practice.examples.map(item => ({ ...item }))
      : [];
  if (!base.length) return null;

  const scenarios = [...base];
  const transferChoice = story.transfer?.choices?.[Number(story.transfer?.correct || 0)] || '';
  const recall = recallText(story);
  const distinctPush = (scenario: Scenario) => {
    if (scenario.jp && !scenarios.some(existing => existing.jp === scenario.jp)) scenarios.push(scenario);
  };
  if (transferChoice) distinctPush({ jp: transferChoice, cue: story.transfer?.prompt, cn: story.transfer?.feedback });
  if (recall) distinctPush({ jp: recall, cue: story.review?.prompt, cn: story.review?.feedback });
  while (scenarios.length < 5) scenarios.push({ ...base[scenarios.length % base.length] });
  const five = scenarios.slice(0, 5);

  const daily = story.play?.daily || five[0]?.jp || '';
  const polite = story.play?.polite || five[1]?.jp || daily;
  const business = story.play?.business || five[2]?.jp || polite;
  const dialogue = dialogueLines(story.jp);
  const replyPrompt = story.play?.replyPrompt || dialogue[0] || story.key?.term || five[0]?.jp || '';
  const reply = story.play?.reply || story.use?.choices?.[Number(story.use?.correct || 0)] || polite;

  const textById: Record<ClipId, string> = {
    listen: five[0]?.jp || daily,
    replyPrompt,
    reply,
    daily,
    polite,
    business,
    scene0: five[0]?.jp || daily,
    scene1: five[1]?.jp || polite,
    scene2: five[2]?.jp || business,
    scene3: five[3]?.jp || five[0]?.jp || daily,
    scene4: five[4]?.jp || five[1]?.jp || polite,
    recall,
  };

  const clips = CLIP_ORDER.map(id => ({ id, text: textById[id], style: styleFor(id) }));
  return clips.every(clip => clip.text.trim()) ? clips : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, reason: 'method_not_allowed' });
  const storyId = String(req.query.storyId || '');
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(storyId)) {
    return res.status(400).json({ ok: false, reason: 'invalid_story_id' });
  }

  let clips = await metadataPlan(storyId);
  let source = 'supabase-metadata';
  if (!clips) {
    const story = await manifestStory(storyId);
    clips = story ? storyPlan(story) : null;
    source = 'manifest-play-plan';
  }
  if (!clips) return res.status(404).json({ ok: false, reason: 'not_allowed' });

  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=300');
  return res.status(200).json({
    ok: true,
    version: 'play-audio-v2',
    model: 'gpt-4o-mini-tts-2025-12-15',
    voice: 'marin',
    storyId,
    source,
    total: clips.length,
    clips,
  });
}
