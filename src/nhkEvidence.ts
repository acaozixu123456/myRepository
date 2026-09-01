import type {NhkSpeechReview} from './NhkSpeechCoach';
import {
  shiftDateKey,
  type NhkMorningSession,
  type NhkRecallIntervalDay,
  type NhkRecallRating,
} from './nhkMorning';

export type NhkEvidenceValue = {
  value: number | null;
  count: number;
};

export type NhkEvidenceComparisonKey =
  | 'shadowAccuracy'
  | 'omissionRate'
  | 'outputScore'
  | 'targetUseRate'
  | 'speakingDensity';

export type NhkEvidenceComparison = {
  key: NhkEvidenceComparisonKey;
  label: string;
  unit: string;
  baseline: number;
  recent: number;
  delta: number;
  lowerIsBetter: boolean;
  sampleCount: number;
};

export type NhkRecallEvidence = {
  intervalDay: NhkRecallIntervalDay;
  attempts: number;
  masteryPercent: number | null;
  averageScore: number | null;
  averageOmissionRate: number | null;
};

export type NhkWeeklyEvidence = {
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  hasEvidence: boolean;
  completedInputs: number;
  analyzedResponses: number;
  allTimeAnalyzedResponses: number;
  speakingSeconds: number;
  headlineZh: string;
  current: {
    shadowAccuracy: NhkEvidenceValue;
    omissionRate: NhkEvidenceValue;
    outputScore: NhkEvidenceValue;
    targetUseRate: NhkEvidenceValue;
    speakingDensity: NhkEvidenceValue;
  };
  comparisons: NhkEvidenceComparison[];
  recall: NhkRecallEvidence[];
};

type ReviewSource = 'shadow' | 'recap' | 'world' | 'recall' | 'callback';

type ReviewPoint = {
  key: string;
  dateKey: string;
  source: ReviewSource;
  review: NhkSpeechReview;
  intervalDay?: NhkRecallIntervalDay;
};

const OUTPUT_SOURCES = new Set<ReviewSource>(['recap', 'world', 'callback']);
const TARGET_SOURCES = new Set<ReviewSource>(['recap', 'world', 'recall', 'callback']);
const RECALL_INTERVALS: NhkRecallIntervalDay[] = [1, 3, 7];

const numeric = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const round = (value: number, digits = 0): number => {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
};

const average = (values: Array<number | null>, digits = 0): NhkEvidenceValue => {
  const clean = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (!clean.length) return {value: null, count: 0};
  return {value: round(clean.reduce((sum, value) => sum + value, 0) / clean.length, digits), count: clean.length};
};

const ratingScore = (rating: NhkRecallRating): number => {
  if (rating === 'good') return 100;
  if (rating === 'close') return 60;
  return 0;
};

const dateLabel = (dateKey: string): string => {
  const [, month, day] = dateKey.split('-');
  return `${Number(month)}月${Number(day)}日`;
};

const collectReviewPoints = (sessions: NhkMorningSession[]): ReviewPoint[] => {
  const points: ReviewPoint[] = [];
  const seen = new Set<string>();
  const push = (
    session: NhkMorningSession,
    source: ReviewSource,
    review: NhkSpeechReview | undefined,
    dateKey: string,
    intervalDay?: NhkRecallIntervalDay,
  ) => {
    if (!review) return;
    const key = `${session.id}:${source}:${intervalDay || 0}:${review.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    points.push({key, source, review, dateKey, ...(intervalDay ? {intervalDay} : {})});
  };

  for (const session of sessions) {
    push(session, 'shadow', session.speechReviews.shadow, session.dateKey);
    push(session, 'recap', session.speechReviews.recap, session.dateKey);
    push(session, 'world', session.speechReviews.world, session.dateKey);
    for (const attempt of session.recallAttempts) {
      push(session, 'recall', attempt.review, attempt.dateKey, attempt.intervalDay);
    }
    const callback = session.dailyInput?.world.callback;
    if (callback?.completedAt) push(session, 'callback', callback.review, callback.dueDateKey);
  }
  return points.sort((left, right) => left.review.analyzedAt - right.review.analyzedAt || left.key.localeCompare(right.key));
};

const currentMetrics = (points: ReviewPoint[]): NhkWeeklyEvidence['current'] => {
  const shadow = points.filter(point => point.source === 'shadow');
  const output = points.filter(point => OUTPUT_SOURCES.has(point.source));
  const target = points.filter(point => TARGET_SOURCES.has(point.source));
  return {
    shadowAccuracy: average(shadow.map(point => numeric(point.review.metrics.textAccuracy))),
    omissionRate: average(shadow.map(point => numeric(point.review.metrics.omissionRate))),
    outputScore: average(output.map(point => numeric(point.review.metrics.contentScore))),
    targetUseRate: average(target.map(point => point.review.metrics.targetExpressionUsed ? 100 : 0)),
    speakingDensity: average(target.map(point => numeric(point.review.metrics.charactersPerSecond)), 1),
  };
};

const comparison = (
  key: NhkEvidenceComparisonKey,
  label: string,
  unit: string,
  points: ReviewPoint[],
  selector: (point: ReviewPoint) => number | null,
  lowerIsBetter = false,
  digits = 0,
): NhkEvidenceComparison | null => {
  const values = points
    .map(point => ({point, value: selector(point)}))
    .filter((item): item is {point: ReviewPoint; value: number} => item.value !== null && Number.isFinite(item.value));
  if (values.length < 2) return null;
  const groupSize = Math.min(3, Math.floor(values.length / 2));
  const first = values.slice(0, groupSize).map(item => item.value);
  const last = values.slice(-groupSize).map(item => item.value);
  const baseline = round(first.reduce((sum, value) => sum + value, 0) / first.length, digits);
  const recent = round(last.reduce((sum, value) => sum + value, 0) / last.length, digits);
  return {
    key,
    label,
    unit,
    baseline,
    recent,
    delta: round(recent - baseline, digits),
    lowerIsBetter,
    sampleCount: values.length,
  };
};

const buildComparisons = (points: ReviewPoint[]): NhkEvidenceComparison[] => {
  const shadow = points.filter(point => point.source === 'shadow');
  const output = points.filter(point => OUTPUT_SOURCES.has(point.source));
  const target = points.filter(point => TARGET_SOURCES.has(point.source));
  return [
    comparison('shadowAccuracy', '跟读文本一致度', '分', shadow, point => numeric(point.review.metrics.textAccuracy)),
    comparison('omissionRate', '跟读漏词率', '%', shadow, point => numeric(point.review.metrics.omissionRate), true),
    comparison('outputScore', '脱稿表达完成度', '分', output, point => numeric(point.review.metrics.contentScore)),
    comparison('targetUseRate', '目标表达使用率', '%', target, point => point.review.metrics.targetExpressionUsed ? 100 : 0),
    comparison('speakingDensity', '表达密度', '字/秒', target, point => numeric(point.review.metrics.charactersPerSecond), false, 1),
  ].filter((value): value is NhkEvidenceComparison => Boolean(value));
};

const recallEvidence = (sessions: NhkMorningSession[]): NhkRecallEvidence[] => RECALL_INTERVALS.map(intervalDay => {
  const attempts = sessions.flatMap(session => session.recallAttempts).filter(attempt => attempt.intervalDay === intervalDay);
  const scores = attempts.map(attempt => attempt.review ? numeric(attempt.review.metrics.contentScore) : null);
  const omissions = attempts.map(attempt => attempt.review ? numeric(attempt.review.metrics.omissionRate) : null);
  return {
    intervalDay,
    attempts: attempts.length,
    masteryPercent: attempts.length
      ? round(attempts.reduce((sum, attempt) => sum + ratingScore(attempt.rating), 0) / attempts.length)
      : null,
    averageScore: average(scores).value,
    averageOmissionRate: average(omissions).value,
  };
});

const strongestHeadline = (
  comparisons: NhkEvidenceComparison[],
  analyzedResponses: number,
  completedInputs: number,
): string => {
  const improvements = comparisons
    .map(item => ({item, improvement: item.lowerIsBetter ? -item.delta : item.delta}))
    .filter(value => value.improvement > 0)
    .sort((left, right) => right.improvement - left.improvement);
  const strongest = improvements[0];
  if (strongest) {
    const amount = Math.abs(strongest.item.delta);
    if (strongest.item.key === 'omissionRate') return `跟读漏词率比开始时下降 ${amount}${strongest.item.unit}`;
    return `${strongest.item.label}比开始时提高 ${amount}${strongest.item.unit}`;
  }
  if (analyzedResponses > 0) return `本周留下了 ${analyzedResponses} 次可比较的口语证据`;
  if (completedInputs > 0) return `本周已把 ${completedInputs} 篇真实输入变成主动表达`;
  return '完成一次语音分析后，这里会开始积累真实证据';
};

export const buildNhkWeeklyEvidence = (
  sessions: NhkMorningSession[],
  todayKey: string,
): NhkWeeklyEvidence => {
  const periodStart = shiftDateKey(todayKey, -6);
  const allPoints = collectReviewPoints(sessions);
  const weeklyPoints = allPoints.filter(point => point.dateKey >= periodStart && point.dateKey <= todayKey);
  const metricPoints = weeklyPoints.length ? weeklyPoints : allPoints.slice(-8);
  const completedInputs = sessions.filter(session => Boolean(session.completedAt)
    && session.dateKey >= periodStart
    && session.dateKey <= todayKey).length;
  const speakingSeconds = sessions.reduce((total, session) => {
    const main = session.dateKey >= periodStart && session.dateKey <= todayKey
      ? session.shadowRecordingSeconds + session.recapRecordingSeconds + session.worldRecordingSeconds
      : 0;
    const recall = session.recallAttempts
      .filter(attempt => attempt.dateKey >= periodStart && attempt.dateKey <= todayKey)
      .reduce((sum, attempt) => sum + attempt.recordingSeconds, 0);
    const callback = session.dailyInput?.world.callback;
    const callbackSeconds = callback?.completedAt
      && callback.dueDateKey >= periodStart
      && callback.dueDateKey <= todayKey
      ? callback.recordingSeconds
      : 0;
    return total + main + recall + callbackSeconds;
  }, 0);
  const comparisons = buildComparisons(allPoints);
  return {
    periodStart,
    periodEnd: todayKey,
    periodLabel: `${dateLabel(periodStart)}—${dateLabel(todayKey)}`,
    hasEvidence: Boolean(allPoints.length || completedInputs),
    completedInputs,
    analyzedResponses: weeklyPoints.length,
    allTimeAnalyzedResponses: allPoints.length,
    speakingSeconds,
    headlineZh: strongestHeadline(comparisons, weeklyPoints.length, completedInputs),
    current: currentMetrics(metricPoints),
    comparisons,
    recall: recallEvidence(sessions),
  };
};
