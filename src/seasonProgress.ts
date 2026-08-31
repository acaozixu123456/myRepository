import type {Story} from './content';
import type {MemoryMap} from './memory';

export type SeasonProgress = {
  episodeCount: number;
  publishedThrough: number;
  completedCount: number;
  allPublishedDone: boolean;
  complete: boolean;
  waitingForNext: boolean;
  nextEpisodeNo: number | null;
};

export const seasonStoriesFor = (stories: Story[], seasonId: string): Story[] => stories
  .filter(story => story.series?.seasonId === seasonId)
  .sort((a, b) => (a.series?.episodeNo || 0) - (b.series?.episodeNo || 0));

export const getSeasonEpisodeCount = (episodes: Story[]): number => episodes.reduce((max, story) => {
  const meta = story.series;
  return Math.max(max, meta?.episodeCount || 0, meta?.episodeNo || 0);
}, 0);

export const getSeasonProgress = (episodes: Story[], memories: MemoryMap): SeasonProgress => {
  const episodeCount = getSeasonEpisodeCount(episodes);
  const publishedThrough = episodes.reduce((max, story) => Math.max(max, story.series?.episodeNo || 0), 0);
  const completedCount = episodes.filter(story => (memories[story.id]?.lastSeen || 0) > 0).length;
  const allPublishedDone = episodes.length > 0 && episodes.every(story => (memories[story.id]?.lastSeen || 0) > 0);
  const complete = episodeCount > 0
    && publishedThrough >= episodeCount
    && episodes.length >= episodeCount
    && allPublishedDone;
  const waitingForNext = allPublishedDone && !complete && publishedThrough < episodeCount;

  return {
    episodeCount,
    publishedThrough,
    completedCount,
    allPublishedDone,
    complete,
    waitingForNext,
    nextEpisodeNo: waitingForNext ? publishedThrough + 1 : null,
  };
};

export const resolveActiveSeason = (
  stories: Story[],
  memories: MemoryMap,
  seasonOrder: string[],
): string => {
  for (const seasonId of seasonOrder) {
    const episodes = seasonStoriesFor(stories, seasonId);
    if (!episodes.length) continue;
    if (!getSeasonProgress(episodes, memories).complete) return seasonId;
  }

  return seasonOrder.find(seasonId => stories.some(story => story.series?.seasonId === seasonId))
    || stories.find(story => story.series?.seasonId)?.series?.seasonId
    || '';
};
