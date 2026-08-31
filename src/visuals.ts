import type {Story} from './content';

export type SceneVisual = {
  sceneId: string;
  palette: [string, string, string?];
  gradient: string;
  imagePrompt?: string;
  locationId?: string;
  castInScene?: string[];
  imageUrl?: string;
};

const DEFAULT_PALETTE: [string, string, string?] = ['#4a6fa5', '#7ba7d9', '#c9d6e8'];

export const STYLE_BIBLE =
  'warm modern Japanese editorial illustration, anime-inspired, cinematic but clean, soft lighting, no text in image, not photorealistic, consistent recurring cast';

export const buildSceneVisual = (story: Story): SceneVisual => {
  const meta = story.visualMeta;
  const sceneId = meta?.sceneId || story.visual || story.id;
  const palette = meta?.palette || DEFAULT_PALETTE;
  const [a, b, c] = palette;
  const gradient = meta?.gradient || `linear-gradient(145deg, ${a} 0%, ${b} 55%, ${c || b} 100%)`;
  return {
    sceneId,
    palette,
    gradient,
    imagePrompt: meta?.imagePrompt,
    locationId: meta?.locationId,
    castInScene: meta?.castInScene,
    imageUrl: meta?.imageUrl,
  };
};

export const sceneImageApiPath = (storyId: string) => `/api/scene-image/${encodeURIComponent(storyId)}`;

export const canaryStoryIds = new Set(['release-week-01-ep01']);
