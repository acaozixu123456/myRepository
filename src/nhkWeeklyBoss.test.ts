import {describe, expect, it} from 'vitest';
import type {NhkSpeechMode, NhkSpeechReview} from './NhkSpeechCoach';
import {buildFallbackCoach} from './nhkCoach';
import {
  applyNhkDailyInput,
  buildNhkDailyInput,
  createNhkSession,
  type NhkMorningSession,
} from './nhkMorning';
import {
  bossTurnNeedsRecovery,
  buildNhkWeeklyBossPlan,
  completeNhkWeeklyBoss,
  createNhkWeeklyBossProgress,
  loadNhkWeeklyBossProgress,
  recordNhkWeeklyBossReview,
  saveNhkWeeklyBossProgress,
} from './nhkWeeklyBoss';

const review = (
  id: string,
  targetExpressionUsed: boolean,
  contentScore: number,
  mode: NhkSpeechMode = 'world',
): NhkSpeechReview => ({
  id,
  mode,
  transcript: '自分の考えを話しました。',
  summaryZh: '测试反馈',
  strengthsZh: [],
  omissions: [],
  substitutions: [],
  particles: [],
  pauseAdviceZh: [],
  minimalRevisionJa: '自分の考えを話しました。',
  naturalVersionJa: '自分の考えを話しました。',
  characterReactionJa: '',
  characterReactionZh: '',
  metrics: {
    textAccuracy: 0,
    contentScore,
    omissionRate: 0,
    substitutionCount: 0,
    particleIssueCount: 0,
    targetExpressionUsed,
    charactersPerSecond: 2,
  },
  analyzedAt: Number(id.replace(/\D/g, '')) || 1,
  transcriptionModel: 'test-transcribe',
  feedbackModel: 'test-feedback',
});

const sessionFor = (index: number, expressionSuffix = ''): NhkMorningSession => {
  const dateKey = `2026-08-${String(31 - index).padStart(2, '0')}`;
  const sourceSentence = `仕様変更${expressionSuffix}を受けて、確認方法を見直しました。`;
  const candidates = [
    sourceSentence,
    `このニュースについて${index}回目の説明をします。`,
    `来週から運用が変わります${index}。`,
  ];
  const base = {
    ...createNhkSession(dateKey),
    sourceUrl: `https://www.mojidict.com/article/boss-${index}`,
    title: `今週のニュース${index}`,
  };
  const coach = buildFallbackCoach(base.title, candidates);
  const selected = coach.recommendations[0];
  const result = applyNhkDailyInput(base, buildNhkDailyInput({
    session: base,
    coach,
    selectedSentences: [selected.sentence],
    candidateSentences: candidates,
    coachModel: 'test-model',
    generatedAt: index,
  }));
  return {
    ...result,
    completedAt: index + 1,
    keyExpression: `〜を受けて${expressionSuffix || index}`,
    dailyVersion: `その話を受けて、もう一度考えました${index}。`,
    workVersion: `仕様変更を受けて、テストケースを見直しました${index}。`,
    speechReviews: {
      world: review(`world-${index}`, index % 2 === 0, 55 + index),
    },
  };
};

const memoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) || null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
};

describe('NHK weekly Boss', () => {
  it('requires five unique expressions from the same Monday-Sunday week', () => {
    const sessions = [0, 1, 2, 3, 4].map(index => sessionFor(index));
    const plan = buildNhkWeeklyBossPlan(sessions, '2026-08-31');
    expect(plan.ready).toBe(true);
    expect(plan.turns).toHaveLength(5);
    expect(plan.availableExpressionCount).toBe(5);
    expect(new Set(plan.turns.map(turn => turn.targetExpression)).size).toBe(5);
    expect(new Set(plan.turns.map(turn => turn.register))).toEqual(new Set(['daily', 'polite', 'business']));
  });

  it('does not count duplicate expressions twice', () => {
    const duplicate = [0, 1, 2, 3, 4].map(index => ({...sessionFor(index), keyExpression: '〜を受けて'}));
    for (const session of duplicate) {
      const primary = session.dailyInput?.selectedTrainingSentences[0];
      if (primary) primary.expression = '〜を受けて';
    }
    const plan = buildNhkWeeklyBossPlan(duplicate, '2026-08-31');
    expect(plan.ready).toBe(false);
    expect(plan.availableExpressionCount).toBe(1);
  });

  it('offers one recovery turn when the first answer misses the expression', () => {
    const plan = buildNhkWeeklyBossPlan([0, 1, 2, 3, 4].map(index => sessionFor(index)), '2026-08-31');
    const progress = createNhkWeeklyBossProgress(plan, 10);
    const first = recordNhkWeeklyBossReview(progress, plan.turns[0].turnId, review('attempt-1', false, 45));
    expect(bossTurnNeedsRecovery(first.turnResults[0].attempts)).toBe(true);
    const second = recordNhkWeeklyBossReview(first, plan.turns[0].turnId, review('attempt-2', true, 72));
    expect(bossTurnNeedsRecovery(second.turnResults[0].attempts)).toBe(false);
  });

  it('summarizes recovered and still-weak expressions honestly', () => {
    const plan = buildNhkWeeklyBossPlan([0, 1, 2, 3, 4].map(index => sessionFor(index)), '2026-08-31');
    let progress = createNhkWeeklyBossProgress(plan, 10);
    plan.turns.forEach((turn, index) => {
      progress = recordNhkWeeklyBossReview(progress, turn.turnId, review(`first-${index}`, index > 1, 55 + index));
      if (index === 0) progress = recordNhkWeeklyBossReview(progress, turn.turnId, review('recovered-0', true, 75));
    });
    const completed = completeNhkWeeklyBoss(progress, plan, 100);
    expect(completed.outcome?.recoveredExpressionCount).toBe(1);
    expect(completed.outcome?.usedExpressionCount).toBe(4);
    expect(completed.outcome?.weakExpressions).toHaveLength(1);
  });

  it('persists progress by stable plan id', () => {
    const plan = buildNhkWeeklyBossPlan([0, 1, 2, 3, 4].map(index => sessionFor(index)), '2026-08-31');
    const progress = createNhkWeeklyBossProgress(plan, 10);
    const storage = memoryStorage();
    saveNhkWeeklyBossProgress(progress, storage);
    expect(loadNhkWeeklyBossProgress(plan.planId, storage)).toEqual(progress);
  });
});
