import {
  shiftDateKey,
  type NhkMorningSession,
  type NhkRecallIntervalDay,
  type NhkRecallRating,
} from './nhkMorning';

export const NHK_WEEKLY_EVIDENCE_VERSION = 'nhk-weekly-evidence-v1';

export type NhkEvidenceTrend = 'improved' | 'declined' | 'steady' | 'building';
export type NhkEvidenceMetricKey = 'shadowOmission' | 'recapContent' | 'worldTransfer' | 'recallSuccess';

export type NhkRecallEvidence = {
  intervalDay: NhkRecallIntervalDay;
  attempts: number;
  good: number;
  close: number;
  miss: number;
  successRate: number | null;
};

export type NhkEvidencePeriod = {
  startDateKey: string;
  endDateKey: string;
  completedDays: number;
  speechReviewCount: number;
  recallAttemptCount: number;
  shadowCount: number;
  shadowOmissionRate: number | null;
  shadowTextAccuracy: number | null;
  recapCount: number;
  recapContentScore: number | null;
  worldCount: number;
  worldTransferRate: number | null;
  recallSuccessRate: number | null;
  averageSpeakingSeconds: number | null;
  recallByInterval: NhkRecallEvidence[];
};

export type NhkEvidenceMetric = {
  key: NhkEvidenceMetricKey;
  label: string;
  current: number | null;
  previous: number | null;
  currentCount: number;
  previousCount: number;
  unit: '%' | '/100';
  lowerIsBetter: boolean;
  delta: number | null;
  trend: NhkEvidenceTrend;
};

export type NhkWeeklyEvidence = {
  version: 1;
  todayKey: string;
  current: NhkEvidencePeriod;
  previous: NhkEvidencePeriod;
  metrics: NhkEvidenceMetric[];
  headline: string;
  detailZh: string;
  comparableMetricCount: number;
  improvedMetricCount: number;
  declinedMetricCount: number;
  evidenceCount: number;
  isBuildingBaseline: boolean;
};

const RECALL_INTERVALS: NhkRecallIntervalDay[] = [1, 3, 7];

const inRange = (dateKey: string, startDateKey: string, endDateKey: string): boolean =>
  dateKey >= startDateKey && dateKey <= endDateKey;

const average = (values: number[]): number | null => {
  const finite = values.filter(value => Number.isFinite(value));
  if (!finite.length) return null;
  return Math.round(finite.reduce((sum, value) => sum + value, 0) / finite.length);
};

const percentage = (matched: number, total: number): number | null =>
  total ? Math.round(matched / total * 100) : null;

const countRatings = (ratings: NhkRecallRating[], rating: NhkRecallRating): number =>
  ratings.filter(value => value === rating).length;

const periodEvidence = (
  sessions: NhkMorningSession[],
  startDateKey: string,
  endDateKey: string,
): NhkEvidencePeriod => {
  const completed = sessions.filter(session => Boolean(session.completedAt)
    && inRange(session.dateKey, startDateKey, endDateKey));
  const shadowReviews = completed.flatMap(session => session.speechReviews?.shadow ? [session.speechReviews.shadow] : []);
  const recapReviews = completed.flatMap(session => session.speechReviews?.recap ? [session.speechReviews.recap] : []);
  const worldReviews = completed.flatMap(session => session.speechReviews?.world ? [session.speechReviews.world] : []);
  const speakingSeconds = completed.flatMap(session => [
    session.shadowRecordingSeconds,
    session.recapRecordingSeconds,
    session.worldRecordingSeconds,
  ]).filter(value => value > 0);
  const attempts = sessions.flatMap(session => session.recallAttempts || [])
    .filter(attempt => inRange(attempt.dateKey, startDateKey, endDateKey));
  const recallByInterval = RECALL_INTERVALS.map(intervalDay => {
    const intervalAttempts = attempts.filter(attempt => attempt.intervalDay === intervalDay);
    const ratings = intervalAttempts.map(attempt => attempt.rating);
    const good = countRatings(ratings, 'good');
    const close = countRatings(ratings, 'close');
    const miss = countRatings(ratings, 'miss');
    return {
      intervalDay,
      attempts: intervalAttempts.length,
      good,
      close,
      miss,
      successRate: percentage(good, intervalAttempts.length),
    };
  });
  const allRatings = attempts.map(attempt => attempt.rating);
  const completedDates = new Set(completed.map(session => session.dateKey));

  return {
    startDateKey,
    endDateKey,
    completedDays: completedDates.size,
    speechReviewCount: shadowReviews.length + recapReviews.length + worldReviews.length,
    recallAttemptCount: attempts.length,
    shadowCount: shadowReviews.length,
    shadowOmissionRate: average(shadowReviews.map(review => review.metrics.omissionRate)),
    shadowTextAccuracy: average(shadowReviews.map(review => review.metrics.textAccuracy)),
    recapCount: recapReviews.length,
    recapContentScore: average(recapReviews.map(review => review.metrics.contentScore)),
    worldCount: worldReviews.length,
    worldTransferRate: percentage(
      worldReviews.filter(review => review.metrics.targetExpressionUsed).length,
      worldReviews.length,
    ),
    recallSuccessRate: percentage(countRatings(allRatings, 'good'), attempts.length),
    averageSpeakingSeconds: average(speakingSeconds),
    recallByInterval,
  };
};

const metric = ({
  key,
  label,
  current,
  previous,
  currentCount,
  previousCount,
  unit,
  lowerIsBetter,
}: Omit<NhkEvidenceMetric, 'delta' | 'trend'>): NhkEvidenceMetric => {
  if (current === null || previous === null || !currentCount || !previousCount) {
    return {
      key,
      label,
      current,
      previous,
      currentCount,
      previousCount,
      unit,
      lowerIsBetter,
      delta: null,
      trend: 'building',
    };
  }
  const delta = current - previous;
  const threshold = 2;
  const trend: NhkEvidenceTrend = Math.abs(delta) < threshold
    ? 'steady'
    : lowerIsBetter
      ? delta < 0 ? 'improved' : 'declined'
      : delta > 0 ? 'improved' : 'declined';
  return {
    key,
    label,
    current,
    previous,
    currentCount,
    previousCount,
    unit,
    lowerIsBetter,
    delta,
    trend,
  };
};

export const buildNhkWeeklyEvidence = (
  sessions: NhkMorningSession[],
  todayKey: string,
): NhkWeeklyEvidence => {
  const current = periodEvidence(sessions, shiftDateKey(todayKey, -6), todayKey);
  const previous = periodEvidence(sessions, shiftDateKey(todayKey, -13), shiftDateKey(todayKey, -7));
  const metrics = [
    metric({
      key: 'shadowOmission',
      label: '跟读漏词',
      current: current.shadowOmissionRate,
      previous: previous.shadowOmissionRate,
      currentCount: current.shadowCount,
      previousCount: previous.shadowCount,
      unit: '%',
      lowerIsBetter: true,
    }),
    metric({
      key: 'recapContent',
      label: '新闻复述',
      current: current.recapContentScore,
      previous: previous.recapContentScore,
      currentCount: current.recapCount,
      previousCount: previous.recapCount,
      unit: '/100',
      lowerIsBetter: false,
    }),
    metric({
      key: 'worldTransfer',
      label: '主动迁移',
      current: current.worldTransferRate,
      previous: previous.worldTransferRate,
      currentCount: current.worldCount,
      previousCount: previous.worldCount,
      unit: '%',
      lowerIsBetter: false,
    }),
    metric({
      key: 'recallSuccess',
      label: '延迟回忆',
      current: current.recallSuccessRate,
      previous: previous.recallSuccessRate,
      currentCount: current.recallAttemptCount,
      previousCount: previous.recallAttemptCount,
      unit: '%',
      lowerIsBetter: false,
    }),
  ];
  const comparableMetricCount = metrics.filter(item => item.trend !== 'building').length;
  const improvedMetricCount = metrics.filter(item => item.trend === 'improved').length;
  const declinedMetricCount = metrics.filter(item => item.trend === 'declined').length;
  const evidenceCount = current.speechReviewCount + current.recallAttemptCount;
  const isBuildingBaseline = !comparableMetricCount;

  let headline = '从第一次开口开始证明进步';
  let detailZh = '完成一次语音分析后，这里会留下可以比较的学习证据。';
  if (evidenceCount > 0 && isBuildingBaseline) {
    headline = '本周证据已经开始积累';
    detailZh = '前一周出现同类记录后，会自动显示真正的升降变化。';
  } else if (improvedMetricCount > declinedMetricCount) {
    headline = '这周已经有可以看见的进步';
    detailZh = `${improvedMetricCount} 项比前一周更好，变化来自实际转写和回忆记录。`;
  } else if (declinedMetricCount > improvedMetricCount) {
    headline = '这周的薄弱点已经被找出来';
    detailZh = `${declinedMetricCount} 项需要继续回收，下一次训练会优先看到这些证据。`;
  } else if (comparableMetricCount > 0) {
    headline = '这周表现整体保持稳定';
    detailZh = '继续完成真实输入、复述和延迟回忆，趋势会越来越可靠。';
  }

  return {
    version: 1,
    todayKey,
    current,
    previous,
    metrics,
    headline,
    detailZh,
    comparableMetricCount,
    improvedMetricCount,
    declinedMetricCount,
    evidenceCount,
    isBuildingBaseline,
  };
};
