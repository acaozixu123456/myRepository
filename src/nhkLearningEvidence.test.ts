import {describe, expect, it} from 'vitest';
import type {NhkSpeechMode, NhkSpeechReview} from './NhkSpeechCoach';
import {
  createNhkSession,
  type NhkMorningSession,
  type NhkRecallAttempt,
} from './nhkMorning';
import {buildNhkWeeklyEvidence} from './nhkLearningEvidence';

const review = (
  mode: NhkSpeechMode,
  overrides: Partial<NhkSpeechReview['metrics']>,
  analyzedAt: number,
): NhkSpeechReview => ({
  id: `${mode}-${analyzedAt}`,
  mode,
  transcript: 'ニュースについて自分の言葉で話しました。',
  summaryZh: '测试反馈',
  strengthsZh: [],
  omissions: [],
  substitutions: [],
  particles: [],
  pauseAdviceZh: [],
  minimalRevisionJa: 'ニュースについて自分の言葉で話しました。',
  naturalVersionJa: 'ニュースについて、自分の言葉で話しました。',
  characterReactionJa: mode === 'world' ? 'なるほど。' : '',
  characterReactionZh: mode === 'world' ? '田中听懂了。' : '',
  metrics: {
    textAccuracy: 0,
    contentScore: 0,
    omissionRate: 0,
    substitutionCount: 0,
    particleIssueCount: 0,
    targetExpressionUsed: false,
    charactersPerSecond: 2,
    ...overrides,
  },
  analyzedAt,
  transcriptionModel: 'test-transcribe',
  feedbackModel: 'test-feedback',
});

const completed = (
  dateKey: string,
  speechReviews: NhkMorningSession['speechReviews'],
  completedAt: number,
): NhkMorningSession => ({
  ...createNhkSession(dateKey),
  completedAt,
  speechReviews,
  shadowRecordingSeconds: speechReviews.shadow ? 18 : 0,
  recapRecordingSeconds: speechReviews.recap ? 31 : 0,
  worldRecordingSeconds: speechReviews.world ? 16 : 0,
});

const recallAttempt = (
  dateKey: string,
  intervalDay: 1 | 3 | 7,
  rating: 'good' | 'close' | 'miss',
  completedAt: number,
): NhkRecallAttempt => ({
  dateKey,
  intervalDay,
  dueDateKey: dateKey,
  rating,
  recordingSeconds: 12,
  completedAt,
});

describe('NHK weekly learning evidence', () => {
  it('compares the current seven days with the previous seven days', () => {
    const previous = completed('2026-09-05', {
      shadow: review('shadow', {omissionRate: 22, textAccuracy: 72}, 1),
      recap: review('recap', {contentScore: 61}, 2),
      world: review('world', {targetExpressionUsed: false, contentScore: 55}, 3),
    }, 10);
    const current = completed('2026-09-12', {
      shadow: review('shadow', {omissionRate: 8, textAccuracy: 91}, 4),
      recap: review('recap', {contentScore: 83}, 5),
      world: review('world', {targetExpressionUsed: true, contentScore: 80}, 6),
    }, 20);
    previous.recallAttempts = [recallAttempt('2026-09-06', 1, 'miss', 11)];
    current.recallAttempts = [recallAttempt('2026-09-13', 1, 'good', 21)];

    const evidence = buildNhkWeeklyEvidence([previous, current], '2026-09-14');
    expect(evidence.current.startDateKey).toBe('2026-09-08');
    expect(evidence.previous.endDateKey).toBe('2026-09-07');
    expect(evidence.current.shadowOmissionRate).toBe(8);
    expect(evidence.previous.shadowOmissionRate).toBe(22);
    expect(evidence.current.recapContentScore).toBe(83);
    expect(evidence.current.worldTransferRate).toBe(100);
    expect(evidence.current.recallSuccessRate).toBe(100);
    expect(evidence.metrics.every(metric => metric.trend === 'improved')).toBe(true);
    expect(evidence.improvedMetricCount).toBe(4);
    expect(evidence.isBuildingBaseline).toBe(false);
  });

  it('groups recall evidence by the date of the attempt rather than the source article', () => {
    const source = completed('2026-08-31', {}, 1);
    source.recallAttempts = [
      recallAttempt('2026-09-08', 1, 'good', 2),
      recallAttempt('2026-09-10', 3, 'close', 3),
      recallAttempt('2026-09-14', 7, 'miss', 4),
    ];

    const evidence = buildNhkWeeklyEvidence([source], '2026-09-14');
    expect(evidence.current.recallAttemptCount).toBe(3);
    expect(evidence.current.recallByInterval.map(item => item.attempts)).toEqual([1, 1, 1]);
    expect(evidence.current.recallByInterval[0].successRate).toBe(100);
    expect(evidence.current.recallByInterval[1].successRate).toBe(0);
  });

  it('does not count unfinished sessions as weekly speech evidence', () => {
    const unfinished = {
      ...createNhkSession('2026-09-14'),
      speechReviews: {shadow: review('shadow', {omissionRate: 4}, 1)},
    };
    const evidence = buildNhkWeeklyEvidence([unfinished], '2026-09-14');
    expect(evidence.current.speechReviewCount).toBe(0);
    expect(evidence.evidenceCount).toBe(0);
    expect(evidence.isBuildingBaseline).toBe(true);
  });

  it('keeps an honest baseline state when there is no comparable previous week', () => {
    const current = completed('2026-09-14', {
      recap: review('recap', {contentScore: 75}, 1),
    }, 2);
    const evidence = buildNhkWeeklyEvidence([current], '2026-09-14');
    expect(evidence.evidenceCount).toBe(1);
    expect(evidence.isBuildingBaseline).toBe(true);
    expect(evidence.metrics.find(metric => metric.key === 'recapContent')?.trend).toBe('building');
    expect(evidence.headline).toContain('开始积累');
  });
});
