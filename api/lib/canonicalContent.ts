const MANIFEST_URL =
  'https://raw.githubusercontent.com/acaozixu123456/myRepository/nihongo-content/nihongo-discovery/content/manifest.json';
const ALLOWED_STATUSES = new Set(['published', 'audio_validation_failed']);
const CACHE_MS = 60_000;

export type CanonicalVisualMeta = {
  sceneId?: string;
  palette?: string[];
  gradient?: string;
  imagePrompt?: string;
  locationId?: string;
  castInScene?: string[];
};

export type CanonicalStory = {
  id: string;
  visualMeta?: CanonicalVisualMeta;
  series?: {seasonId?: string; episodeNo?: number};
};

type ManifestItem = {status?: string; story?: CanonicalStory};

let cache: {at: number; byId: Map<string, CanonicalStory>} | null = null;

export async function loadCanonicalStories(): Promise<Map<string, CanonicalStory>> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) return cache.byId;
  const upstream = await fetch(`${MANIFEST_URL}?ts=${now}`, {
    headers: {Accept: 'application/json', 'Cache-Control': 'no-cache'},
  });
  if (!upstream.ok) throw new Error(`manifest_http_${upstream.status}`);
  const manifest = (await upstream.json()) as {items?: ManifestItem[]};
  const byId = new Map<string, CanonicalStory>();
  for (const item of manifest.items || []) {
    const story = item.story;
    if (!story?.id || !ALLOWED_STATUSES.has(item.status || '')) continue;
    byId.set(story.id, story);
  }
  cache = {at: now, byId};
  return byId;
}

export async function resolveCanonicalVisual(storyId: string): Promise<CanonicalVisualMeta | null> {
  const stories = await loadCanonicalStories();
  const story = stories.get(storyId);
  const imagePrompt = story?.visualMeta?.imagePrompt?.trim();
  if (!imagePrompt) return null;
  return story!.visualMeta!;
}

export function isEligibleSceneImageStory(story: CanonicalStory | undefined): story is CanonicalStory {
  return Boolean(story?.id && story.visualMeta?.imagePrompt?.trim());
}
