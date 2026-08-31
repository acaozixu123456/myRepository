import {describe, expect, it} from 'vitest';
import type {Story} from './content';
import type {MemoryMap} from './memory';
import {getSeasonProgress, resolveActiveSeason} from './seasonProgress';

const episode = (seasonId: string, episodeNo: number, episodeCount: number): Story => ({
  id: `${seasonId}-ep${String(episodeNo).padStart(2, '0')}`,
  title: '', category: '', level: 'N3', emoji: '', visual: '', prompt: '', guesses: [], guessCorrect: 0,
  twist: '', key: {term: '', reading: '', meaning: '', insight: '', anchor: ''}, jp: '', cn: '', points: [],
  use: {prompt: '', choices: [], correct: 0, feedback: ''},
  transfer: {prompt: '', choices: [], correct: 0, feedback: ''},
  review: {prompt: '', cloze: '', answer: '', feedback: ''},
  series: {worldId: 'life-in-japan', seasonId, episodeNo, episodeCount},
  nextId: '',
});

const seen = (...stories: Story[]): MemoryMap => Object.fromEntries(stories.map(story => [story.id, {
  version: 2 as const,
  strength: 1,
  nextReviewAt: 0,
  lastSeen: 1,
}]));

describe('season frontier semantics', () => {
  it('does not treat a fully consumed 3/12 published buffer as season completion', () => {
    const episodes = [1, 2, 3].map(no => episode('s2', no, 12));
    const progress = getSeasonProgress(episodes, seen(...episodes));

    expect(progress.completedCount).toBe(3);
    expect(progress.episodeCount).toBe(12);
    expect(progress.complete).toBe(false);
    expect(progress.waitingForNext).toBe(true);
    expect(progress.nextEpisodeNo).toBe(4);
  });

  it('marks the season complete only when the canonical episode count is published and learned', () => {
    const episodes = Array.from({length: 12}, (_, index) => episode('s1', index + 1, 12));
    const progress = getSeasonProgress(episodes, seen(...episodes));

    expect(progress.complete).toBe(true);
    expect(progress.waitingForNext).toBe(false);
    expect(progress.nextEpisodeNo).toBeNull();
  });

  it('keeps the learner in the current incomplete season instead of falling back to an older one', () => {
    const season1 = Array.from({length: 12}, (_, index) => episode('s1', index + 1, 12));
    const season2 = [1, 2, 3].map(no => episode('s2', no, 12));
    const memories = seen(...season1, ...season2);

    expect(resolveActiveSeason([...season1, ...season2], memories, ['s1', 's2'])).toBe('s2');
  });
});
