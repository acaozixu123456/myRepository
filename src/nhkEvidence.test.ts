import {describe, expect, it} from 'vitest';
import type {NhkSpeechMode, NhkSpeechReview} from './NhkSpeechCoach';
import {buildNhkWeeklyEvidence} from './nhkEvidence';
import {createNhkSession, type NhkRecallAttempt} from './nhkMorning';

const review = (
  id: string,
  mode: NhkSpeechMode,
  analyzedAt: number,
  metrics: Partial<NhkSpeechReview['metrics']> = {},
): NhkSpeechReview => ({
  id,
  mode,
  transcript: '今日は会議の予定を確認します。',
  summaryZh: '完成了表达。',
  strengthsZh: ['句子完整。'],
  omissions: [],
  substitutions: [],
  particles: [],
  pauseAdviceZh: [],
  minimalRevisionJa: '今日は会議の予定を確認します。',
  naturalVersionJa: '今日は会議の予定を確認します。',
  characterReactionJa: '',
  characterReactionZh: '',
  metrics: {
    textAccuracy: 0,
    contentScore: 0,
    omissionRate: 0,
    substitutionCount: 0,
    particleIssueCount: 0,
    targetExpressionUsed: false,
    charactersPerSecond: 0,
    ...metrics,
  },
  analyzedAt,
  transcriptionModel: 'test-transcribe',
  feedbackModel: 'test-feedback',
});

const recallAttempt = (
  intervalDay: 1 | 3 | 7,
  dateKey: string,
  rating: 'good' | 'close' | 'miss',
  speechReview?: NhkSpeechReview,
): NhkRecallAttempt => ({
  intervalDay,
  dueDateKey: dateKey,
  dateKey,
  rating,
  recordingSeconds: 12,
  completedAt: speechReview?.analyzedAt || 1,
  ...(speechReview ? {review: speechReview} : {}),
});

describe('NHK weekly learning evidence', () => {
  it('aggregates this week from actual speech reviews and recording durations', () => {
    const first = {
      ...createNhkSession('2026-08-30'),
      completedAt: 1,
      shadowRecordingSeconds: 10,
      recapRecordingSeconds: 20,
      speechReviews: {
        shadow: review('shadow-1', 'shadow', 10, {textAccuracy: 60, omissionRate: 25}),
        recap: review('recap-1', 'recap', 11, {contentScore: 62, targetExpressionUsed: false, charactersPerSecond: 2.4}),
      },
    };
    const recent = {
      ...createNhkSession('2026-09-01'),
      completedAt: 2,
      shadowRecordingSeconds: 12,
      recapRecordingSeconds: 24,
      speechReviews: {
        shadow: review('shadow-2', 'shadow', 20, {textAccuracy: 88, omissionRate: 6}),
        recap: review('recap-2', 'recap', 21, {contentScore: 84, targetExpressionUsed: true, charactersPerSecond: 3.6}),
      },
    };

    const evidence = buildNhkWeeklyEvidence([first, recent], '2026-09-01');
    expect(evidence.completedInputs).toBe(2);
    expect(evidence.analyzedResponses).toBe(4);
    expect(evidence.speakingSeconds).toBe(66);
    expect(evidence.current.shadowAccuracy.value).toBe(74);
    expect(evidence.current.omissionRate.value).toBe(16);
    expect(evidence.current.outputScore.value).toBe(73);
    expect(evidence.current.targetUseRate.value).toBe(50);
    expect(evidence.current.speakingDensity.value).toBe(3);
    expect(evidence.headlineZh).toContain('提高');
  });

  it('compares non-overlapping earliest and recent evidence', () => {
    const sessions = [60, 68, 82, 92].map((accuracy, index) => ({
      ...createNhkSession(`2026-08-${28 + index}`),
      completedAt: index + 1,
      speechReviews: {
        shadow: review(`shadow-${index}`, 'shadow', index + 1, {
          textAccuracy: accuracy,
          omissionRate: [30, 22, 10, 4][index],
        }),
      },
    }));
    const evidence = buildNhkWeeklyEvidence(sessions, '2026-09-01');
    const accuracy = evidence.comparisons.find(item => item.key === 'shadowAccuracy');
    const omission = evidence.comparisons.find(item => item.key === 'omissionRate');
    expect(accuracy).toMatchObject({baseline: 64, recent: 87, delta: 23, sampleCount: 4});
    expect(omission).toMatchObject({baseline: 26, recent: 7, delta: -19, lowerIsBetter: true});
  });

  it('summarizes day 1, 3 and 7 retrieval separately', () => {
    const session = {
      ...createNhkSession('2026-08-20'),
      completedAt: 1,
      recallAttempts: [
        recallAttempt(1, '2026-08-21', 'good', review('r1', 'recall', 10, {contentScore: 90, omissionRate: 2})),
        recallAttempt(3, '2026-08-23', 'close', review('r3', 'recall', 20, {contentScore: 72, omissionRate: 12})),
        recallAttempt(7, '2026-08-27', 'miss'),
      ],
    };
    const evidence = buildNhkWeeklyEvidence([session], '2026-09-01');
    expect(evidence.recall[0]).toMatchObject({intervalDay: 1, attempts: 1, masteryPercent: 100, averageScore: 90});
    expect(evidence.recall[1]).toMatchObject({intervalDay: 3, attempts: 1, masteryPercent: 60, averageScore: 72});
    expect(evidence.recall[2]).toMatchObject({intervalDay: 7, attempts: 1, masteryPercent: 0, averageScore: null});
  });

  it('shows an honest empty baseline before any spoken evidence exists', () => {
    const evidence = buildNhkWeeklyEvidence([], '2026-09-01');
    expect(evidence.hasEvidence).toBe(false);
    expect(evidence.current.shadowAccuracy.value).toBeNull();
    expect(evidence.comparisons).toEqual([]);
    expect(evidence.headlineZh).toContain('完成一次语音分析');
  });
});
