import {describe, expect, it} from 'vitest';
import type {Story} from './content';
import {applyFinish, migrateMemory, pickMemoryEcho, reviewPriority} from './memory';
import {buildPlayPlan, validatePlayPlanClips} from './playPlan';
import {inferSemantics, resolveStep2Cue, validatePlaySemantics} from './playSemantics';
import {buildSceneVisual} from './visuals';

const ep01: Story = {
  id: 'release-week-01-ep01',
  title: 'ep01',
  category: '职场空气',
  level: 'N3',
  emoji: '🌧️',
  visual: 'release-week-ep01',
  prompt: 'p',
  guesses: ['a', 'b', 'c'],
  guessCorrect: 0,
  twist: 't',
  key: {term: '遅れそうです', reading: 'r', meaning: 'm', insight: 'i', anchor: 'a'},
  jp: 'この雨で、電車が遅れそうです。\nわかりました。少し早めに連絡します。',
  cn: 'c',
  points: [],
  use: {prompt: 'q', choices: ['a', 'b', 'c'], correct: 0, feedback: 'f'},
  transfer: {prompt: 'q', choices: ['a', 'b', 'c'], correct: 0, feedback: 'f'},
  review: {prompt: 'q', cloze: 'x', answer: 'y', feedback: 'f'},
  play: {
    replyPrompt: 'この雨で、電車が遅れそうです。',
    reply: 'わかりました。少し早めに連絡します。',
    daily: 'd',
    polite: 'p',
    business: 'b',
    semantics: {
      interactionType: 'self-observation',
      promptSpeaker: 'learner',
      learnerRole: 'decide',
      uiCue: '先听当下的判断，再想你会怎么做。',
    },
    scenarios: [
      {emoji: '🚃', cue: 'c1', jp: '電車が遅れそうなので、少し遅れるかもしれません。', cn: 'cn1'},
      {emoji: '🕘', cue: 'c2', jp: '今のところ、九時には間に合いそうです。', cn: 'cn2'},
      {emoji: '💬', cue: 'c3', jp: '到着が少し遅れそうです。', cn: 'cn3'},
      {emoji: '☔', cue: 'c4', jp: '雨が強くなりそうだから、少し遅れるかも。', cn: 'cn4'},
      {emoji: '🍜', cue: 'c5', jp: 'このままだと、かなり待ちそうです。', cn: 'cn5'},
    ],
  },
  series: {seasonId: 'release-week-01', episodeNo: 1, castIds: ['public-service']},
  nextId: 'release-week-01-ep02',
};

const ep02: Story = {
  ...ep01,
  id: 'release-week-01-ep02',
  play: {
    ...ep01.play!,
    replyPrompt: '今どのあたりですか？',
    reply: '電車が遅れていて、少し遅れるかもしれません。',
    semantics: {
      interactionType: 'exchange',
      promptSpeaker: 'other',
      promptSpeakerId: 'tanaka',
      learnerRole: 'respond',
      uiCue: '先听田中说什么，再决定你怎么回。',
    },
  },
  series: {seasonId: 'release-week-01', episodeNo: 2, castIds: ['tanaka']},
};

describe('play semantics', () => {
  it('uses self-observation cue for EP01', () => {
    const cue = resolveStep2Cue(ep01);
    expect(cue).not.toContain('对方');
    expect(cue).toContain('判断');
  });

  it('uses exchange cue for EP02', () => {
    const cue = resolveStep2Cue(ep02);
    expect(cue).toContain('田中');
  });

  it('validates reply clip alignment', () => {
    expect(validatePlayPlanClips(ep01)).toEqual([]);
    const plan = buildPlayPlan(ep01);
    expect(plan?.clips.replyPrompt.text).toBe('この雨で、電車が遅れそうです。');
    expect(plan?.clips.reply.text).toBe('わかりました。少し早めに連絡します。');
  });

  it('rejects self-observation with 对方 cue', () => {
    const bad = {...ep01, play: {...ep01.play!, semantics: {...ep01.play!.semantics!, uiCue: '先听对方说什么'}}};
    expect(validatePlaySemantics(bad).some(i => i.code === 'self_observation_other_label')).toBe(true);
  });

  it('requires distinct exchange pair', () => {
    const bad = {...ep02, play: {...ep02.play!, reply: ep02.play!.replyPrompt}};
    expect(validatePlaySemantics(bad).some(i => i.code === 'identical_reply_pair')).toBe(true);
  });

  it('infers semantics when explicit block missing', () => {
    const inferred = inferSemantics(ep02);
    expect(inferred?.interactionType).toBe('exchange');
  });
});

describe('memory', () => {
  it('migrates legacy records', () => {
    const migrated = migrateMemory({x: {strength: 1, nextReviewAt: 0, lastSeen: 1}});
    expect(migrated.x.version).toBe(2);
    expect(migrated.x.expressions).toEqual({});
  });

  it('prioritizes due weak review', () => {
    const weak = {strength: 1, nextReviewAt: 0, lastSeen: 1, version: 2 as const, weaknesses: {recall: 2}};
    const strong = {strength: 4, nextReviewAt: Date.now() + 99999, lastSeen: 1, version: 2 as const};
    expect(reviewPriority(weak)).toBeGreaterThan(reviewPriority(strong));
  });

  it('tracks expressions on finish', () => {
    const next = applyFinish({strength: 0, nextReviewAt: 0, lastSeen: 0, version: 2}, 'good', ep01);
    expect(next.expressions?.['遅れそうです']?.strength).toBe(1);
  });

  it('surfaces at most one memory echo', () => {
    const memories = migrateMemory({
      'release-week-01-ep01': {strength: 2, nextReviewAt: 0, lastSeen: 1, version: 2, expressions: {'遅れそうです': {strength: 1, lastSeen: 1, misses: 1}}},
    });
    const echo = pickMemoryEcho({...ep02, callbacks: [{targetId: 'release-week-01-ep01', sourceEpisodeId: 'release-week-01-ep01', role: 'natural_reuse'}]}, memories);
    expect(echo?.label).toBe('以前见过');
  });
});

describe('visual fallback', () => {
  it('builds gradient visual without blocking', () => {
    const visual = buildSceneVisual(ep01);
    expect(visual.gradient).toContain('linear-gradient');
    expect(visual.sceneId).toBeTruthy();
  });
});
