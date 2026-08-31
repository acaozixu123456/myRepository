import type { VercelRequest, VercelResponse } from '@vercel/node';

const STYLE_BIBLE =
  'warm modern Japanese editorial illustration, anime-inspired, cinematic but clean, soft lighting, no text in image, not photorealistic, consistent recurring cast';
const MANIFEST_URL =
  'https://raw.githubusercontent.com/acaozixu123456/myRepository/nihongo-content/nihongo-discovery/content/manifest.json';
const ALLOWED_STATUSES = new Set(['published', 'audio_validation_failed']);

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kivebsjsdfdobxzaokbj.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpdmVic2pzZGZkb2J4emFva2JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxMzA2NDIsImV4cCI6MjEwMzcwNjY0Mn0.rzB2Yhn0vn1WqLJ2cq62WcSTsauNAm9vmn8MfNzgiYM';
const SCENE_EDGE_URL = `${SUPABASE_URL}/functions/v1/nihongo-scene-image`;
const SCENE_BUCKET = 'nihongo-audio';
const SCENE_PREFIX = 'scene-images-v1';

const DEFAULT_GRADIENT = 'linear-gradient(145deg, #4a6fa5 0%, #7ba7d9 55%, #c9d6e8 100%)';

type VisualMeta = {
  palette?: string[];
  imagePrompt?: string;
};

type CanonicalStory = {id: string; visualMeta?: VisualMeta};

let manifestCache: {at: number; byId: Map<string, CanonicalStory>} | null = null;

async function loadCanonicalStories(): Promise<Map<string, CanonicalStory>> {
  const now = Date.now();
  if (manifestCache && now - manifestCache.at < 60_000) return manifestCache.byId;
  const upstream = await fetch(`${MANIFEST_URL}?ts=${now}`, {
    headers: {Accept: 'application/json', 'Cache-Control': 'no-cache'},
  });
  if (!upstream.ok) throw new Error(`manifest_http_${upstream.status}`);
  const manifest = (await upstream.json()) as {items?: Array<{status?: string; story?: CanonicalStory}>};
  const byId = new Map<string, CanonicalStory>();
  for (const item of manifest.items || []) {
    const story = item.story;
    if (!story?.id || !ALLOWED_STATUSES.has(item.status || '')) continue;
    byId.set(story.id, story);
  }
  manifestCache = {at: now, byId};
  return byId;
}

async function resolveCanonicalVisual(storyId: string): Promise<VisualMeta | null> {
  const stories = await loadCanonicalStories();
  const story = stories.get(storyId);
  const imagePrompt = story?.visualMeta?.imagePrompt?.trim();
  if (!imagePrompt) return null;
  return story!.visualMeta!;
}

function buildGradient(palette?: string[]): string {
  if (!palette?.length) return DEFAULT_GRADIENT;
  const [a, b, c] = palette;
  return `linear-gradient(145deg, ${a} 0%, ${b || a} 55%, ${c || b || a} 100%)`;
}

async function cachedImageUrl(storyId: string): Promise<string | null> {
  const path = `${SCENE_PREFIX}/${storyId}.webp`;
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${SCENE_BUCKET}/${path}`;
  try {
    const head = await fetch(publicUrl, {method: 'HEAD'});
    return head.ok ? publicUrl : null;
  } catch {
    return null;
  }
}

async function generateViaEdge(storyId: string, prompt: string): Promise<{url?: string; blocker?: string}> {
  try {
    const res = await fetch(SCENE_EDGE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({storyId, prompt: `${STYLE_BIBLE}. ${prompt}`}),
    });
    const payload = await res.json().catch(() => ({})) as {ok?: boolean; url?: string; reason?: string; status?: string};
    if (res.ok && payload.url) return {url: payload.url};
    const cached = await cachedImageUrl(storyId);
    if (cached) return {url: cached};
    return {blocker: payload.reason || payload.status || `edge_http_${res.status}`};
  } catch {
    const cached = await cachedImageUrl(storyId);
    if (cached) return {url: cached};
    return {blocker: 'edge_timeout'};
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const storyId = String(req.query.storyId || '');
  try {
    if (req.method !== 'GET') return res.status(405).json({ok: false, reason: 'method_not_allowed'});
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(storyId)) return res.status(400).json({ok: false, reason: 'invalid_story'});

    const cached = await cachedImageUrl(storyId);
    if (cached) {
      res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
      return res.status(200).json({ok: true, status: 'ready', url: cached, storyId, cached: true});
    }

    let visualMeta: VisualMeta | null = null;
    try {
      visualMeta = await resolveCanonicalVisual(storyId);
    } catch {
      visualMeta = null;
    }

    const canGenerate = req.query.canary === '1' && visualMeta?.imagePrompt;
    let canaryBlocker: string | undefined;
    if (canGenerate) {
      const result = await generateViaEdge(storyId, visualMeta!.imagePrompt!);
      if (result.url) {
        res.setHeader('Cache-Control', 'public, max-age=300');
        return res.status(200).json({ok: true, status: 'ready', url: result.url, storyId, generated: true});
      }
      canaryBlocker = result.blocker || 'generation_failed';
    } else if (req.query.canary === '1') {
      try {
        const stories = await loadCanonicalStories();
        const story = stories.get(storyId);
        canaryBlocker = story?.visualMeta?.imagePrompt ? 'generation_failed' : 'not_eligible';
      } catch {
        canaryBlocker = 'manifest_unavailable';
      }
    }

    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.status(200).json({
      ok: true,
      status: 'fallback',
      storyId,
      gradient: buildGradient(visualMeta?.palette),
      palette: visualMeta?.palette || ['#4a6fa5', '#7ba7d9', '#c9d6e8'],
      ...(canaryBlocker ? {canaryAttempted: true, canaryBlocker} : {}),
    });
  } catch (error) {
    console.error('scene-image handler failed', error);
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.status(200).json({
      ok: true,
      status: 'fallback',
      storyId,
      gradient: DEFAULT_GRADIENT,
      palette: ['#4a6fa5', '#7ba7d9', '#c9d6e8'],
      canaryBlocker: 'handler_error',
    });
  }
}
