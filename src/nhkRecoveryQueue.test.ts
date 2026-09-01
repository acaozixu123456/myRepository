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
  buildNhkRecoveryQueue,
  recordNhkRecoveryAttempt,
  recoveryRatingForReview,
} from './nhkRecoveryQueue';

const review = (
  id: string,
  mode: NhkSpeechMode,
  targetExpressionUsed: boolean,
  contentScore: number,
  omissionRate = 0,
): NhkSpeechReview => ({
  id,
  mode,
  transcript: '自分の言葉で答えました。',
  summaryZh: '测试反馈',
  strengthsZh: [],
  omissions: [],
  substitutions: [],
  particles: [],
  pauseAdviceZh: [],
  minimalRevisionJa: '自分の言葉で答えました。',
  naturalVersionJa: '自分の言葉で答えました。',
  characterReactionJa: '',
  characterReactionZh: '',
  metrics: {
    textAccuracy: 80,
    contentScore,
    omissionRate,
    substitutionCount: 0,
    particleIssueCount: 0,
    targetExpressionUsed,
    charactersPerSecond: 2,
  },
  analyzedAt: 1,
  transcriptionModel: 'test-transcribe',
  feedbackModel: 'test-feedback',
});

const sessionFor = (id: number, expression: string): NhkMorningSession => {
  const source = expression.includes('てはいけない')
    ? 'テスト環境では、本番データを使ってはいけません。'
    : expression.includes('を受けて')
      ? '仕様変更を受けて、テストケースを見直しました。'
      : '毎日、日本語を声に出すようにしています。';
  const candidates = [source, `ニュースの説明${id}です。`, `別の文${id}です。`];
  const base = {
    ...createNhkSession(`2026-09-0${id}`),
    sourceUrl: `https://www.mojidict.com/article/recovery-${id}`,
    title: `ニュース${id}`,
  };
  const coach = buildFallbackCoach(base.title, candidates);
  const result = applyNhkDailyInput(base, buildNhkDailyInput({
    session: base,
    coach,
    selectedSentences: [source],
    candidateSentences: candidates,
    coachModel: 'test-model',
    generatedAt: id,
  }));
  const primary = result.dailyInput?.selectedTrainingSentences[0];
  if (primary) primary.expression = expression;
  return {
    ...result,
    completedAt: id,
    keyExpression: expression,
  };
};

describe('NHK evidence-driven recovery queue', () => {
  it('places a Weekly Boss weak expression before lower-priority evidence', () => {
    const bossWeak = sessionFor(1, '〜てはいけない');
    const omission = sessionFor(2, '〜ようにしています');
    omission.speechReviews = {shadow: review('shadow', 'shadow', true, 80, 24)};

    const queue = buildNhkRecoveryQueue([omission, bossWeak], '2026-09-10', ['〜てはいけない']);
    expect(queue[0].sourceSessionId).toBe(bossWeak.id);
    expect(queue[0].reason).toBe('boss-weak');
    expect(queue[0].scenario.referenceAnswerJa).toContain('USB');
  });

  it('queues a missed recall and changes the scenario after another attempt', () => {
    const session = sessionFor(1, '〜を受けて');
    session.recallAttempts = [{
      dateKey: '2026-09-08',
      intervalDay: 3,
      dueDateKey: '2026-09-08',
      rating: 'miss',
      recordingSeconds: 10,
      completedAt: 10,
    }];
    const first = buildNhkRecoveryQueue([session], '2026-09-10')[0];
    expect(first.reason).toBe('recall-miss');
    const attempted = recordNhkRecoveryAttempt(session, first, '2026-09-10', undefined, 'miss', 20);
    const second = buildNhkRecoveryQueue([attempted], '2026-09-11')[0];
    expect(second.scenario.scenarioId).not.toBe(first.scenario.scenarioId);
    expect(second.scenario.referenceAnswerJa).not.toBe(first.scenario.referenceAnswerJa);
  });

  it('suppresses a successfully recovered expression for seven days', () => {
    const session = sessionFor(1, '〜てはいけない');
    session.speechReviews = {world: review('world', 'world', false, 55)};
    const item = buildNhkRecoveryQueue([session], '2026-09-10')[0];
    const recovered = recordNhkRecoveryAttempt(
      session,
      item,
      '2026-09-10',
      review('recovered', 'recall', true, 78),
      undefined,
      20,
    );
    expect(buildNhkRecoveryQueue([recovered], '2026-09-16')).toHaveLength(0);
    expect(buildNhkRecoveryQueue([recovered], '2026-09-17')).toHaveLength(1);
  });

  it('does not repeat the same recovery item twice in one day', () => {
    const session = sessionFor(1, '〜てはいけない');
    session.speechReviews = {world: review('world', 'world', false, 55)};
    const item = buildNhkRecoveryQueue([session], '2026-09-10')[0];
    const attempted = recordNhkRecoveryAttempt(session, item, '2026-09-10', undefined, 'close', 20);
    expect(buildNhkRecoveryQueue([attempted], '2026-09-10')).toHaveLength(0);
  });

  it('turns transcript-grounded review evidence into honest recovery ratings', () => {
    expect(recoveryRatingForReview(review('good', 'recall', true, 72))).toBe('good');
    expect(recoveryRatingForReview(review('close', 'recall', true, 44))).toBe('close');
    expect(recoveryRatingForReview(review('miss', 'recall', false, 38))).toBe('miss');
  });
});
