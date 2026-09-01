import type {NhkSpeechReview} from './NhkSpeechCoach';
import {
  primaryNhkTrainingSentence,
  shiftDateKey,
  type NhkMorningSession,
} from './nhkMorning';

export const NHK_WEEKLY_BOSS_VERSION = 'nhk-weekly-boss-v1';
export const NHK_WEEKLY_BOSS_REQUIRED_EXPRESSIONS = 5;

export type NhkWeeklyBossRegister = 'daily' | 'polite' | 'business';

export type NhkWeeklyBossTurn = {
  turnId: string;
  order: number;
  sourceSessionId: string;
  sourceDateKey: string;
  sourceTitle: string;
  register: NhkWeeklyBossRegister;
  promptJa: string;
  recoveryPromptJa: string;
  referenceAnswerJa: string;
  targetExpression: string;
  weaknessScore: number;
};

export type NhkWeeklyBossPlan = {
  version: 1;
  planId: string;
  weekStartDateKey: string;
  weekEndDateKey: string;
  availableExpressionCount: number;
  requiredExpressionCount: number;
  ready: boolean;
  turns: NhkWeeklyBossTurn[];
};

export type NhkWeeklyBossTurnResult = {
  turnId: string;
  attempts: NhkSpeechReview[];
};

export type NhkWeeklyBossOutcome = {
  usedExpressionCount: number;
  recoveredExpressionCount: number;
  averageContentScore: number;
  weakExpressions: string[];
};

export type NhkWeeklyBossProgress = {
  version: 1;
  planId: string;
  weekStartDateKey: string;
  currentTurnIndex: number;
  turnResults: NhkWeeklyBossTurnResult[];
  startedAt: number;
  completedAt?: number;
  outcome?: NhkWeeklyBossOutcome;
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

type BossSource = {
  sessionId: string;
  dateKey: string;
  title: string;
  expression: string;
  dailyVersion: string;
  workVersion: string;
  weaknessScore: number;
};

const STORAGE_PREFIX = 'nihongo-weekly-boss-v1:';
const REGISTER_ORDER: NhkWeeklyBossRegister[] = ['daily', 'polite', 'business', 'daily', 'business'];

const clean = (value: unknown, max = 420): string => typeof value === 'string'
  ? value.replace(/\s+/g, ' ').trim().slice(0, max)
  : '';

const stableHash = (value: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

const weekStartFor = (dateKey: string): string => {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  return shiftDateKey(dateKey, -mondayOffset);
};

const weaknessFor = (session: NhkMorningSession): number => {
  const recalls = session.recallAttempts || [];
  const recallPenalty = recalls.reduce((sum, attempt) => sum + (attempt.rating === 'miss' ? 45 : attempt.rating === 'close' ? 22 : 0), 0);
  const shadow = session.speechReviews?.shadow;
  const recap = session.speechReviews?.recap;
  const world = session.speechReviews?.world;
  const omissionPenalty = shadow?.metrics.omissionRate || 0;
  const recapPenalty = recap ? Math.max(0, 100 - recap.metrics.contentScore) * 0.35 : 12;
  const transferPenalty = world ? (world.metrics.targetExpressionUsed ? 0 : 32) : 18;
  return Math.round(recallPenalty + omissionPenalty + recapPenalty + transferPenalty);
};

const sourceFromSession = (session: NhkMorningSession): BossSource | null => {
  if (!session.completedAt || !session.dailyInput) return null;
  const primary = primaryNhkTrainingSentence(session.dailyInput);
  const expression = clean(primary?.expression || session.keyExpression, 180);
  if (!expression) return null;
  return {
    sessionId: session.id,
    dateKey: session.dateKey,
    title: clean(session.dailyInput.title || session.title, 180),
    expression,
    dailyVersion: clean(primary?.dailyVersion || session.dailyVersion, 360),
    workVersion: clean(primary?.workVersion || session.workVersion, 360),
    weaknessScore: weaknessFor(session),
  };
};

const promptFor = (register: NhkWeeklyBossRegister, order: number, title: string): {promptJa: string; recoveryPromptJa: string} => {
  if (register === 'business') {
    return order === 4
      ? {
          promptJa: `来週、同じような問題が起きた場合の対応を、会議で提案してください。話題は「${title}」です。`,
          recoveryPromptJa: '結論を先に言ってから、理由を一つだけ加えてもう一度提案してください。',
        }
      : {
          promptJa: `「${title}」が仕事に与える影響を、会議で短く説明してください。`,
          recoveryPromptJa: '「影響」と「次に確認すること」を一つずつ入れて、もう一度説明してください。',
        };
  }
  if (register === 'polite') {
    return {
      promptJa: `初めて会う人に、「${title}」についてのあなたの考えを丁寧に説明してください。`,
      recoveryPromptJa: '短い丁寧語で、結論と理由を一つずつ伝えてください。',
    };
  }
  return order === 3
    ? {
        promptJa: `田中は「${title}」についてあなたと違う意見です。理由を一つ添えて、自分の立場を伝えてください。`,
        recoveryPromptJa: 'まず「私は〜と思います」と立場を言い、そのあと理由を一つだけ話してください。',
      }
    : {
        promptJa: `「${title}」をきっかけに、あなたの生活で似ている例を一つ話してください。`,
        recoveryPromptJa: '身近な例を一つだけ選び、短い二文で話してください。',
      };
};

const turnFromSource = (source: BossSource, order: number): NhkWeeklyBossTurn => {
  const register = REGISTER_ORDER[order] || 'daily';
  const prompts = promptFor(register, order, source.title || '今週のニュース');
  const referenceAnswerJa = register === 'business'
    ? source.workVersion || source.dailyVersion
    : source.dailyVersion || source.workVersion;
  return {
    turnId: `boss-turn-${order + 1}-${source.sessionId}-${stableHash(source.expression)}`,
    order,
    sourceSessionId: source.sessionId,
    sourceDateKey: source.dateKey,
    sourceTitle: source.title,
    register,
    promptJa: prompts.promptJa,
    recoveryPromptJa: prompts.recoveryPromptJa,
    referenceAnswerJa,
    targetExpression: source.expression,
    weaknessScore: source.weaknessScore,
  };
};

export const buildNhkWeeklyBossPlan = (
  sessions: NhkMorningSession[],
  todayKey: string,
): NhkWeeklyBossPlan => {
  const weekStartDateKey = weekStartFor(todayKey);
  const weekEndDateKey = shiftDateKey(weekStartDateKey, 6);
  const sources = sessions
    .filter(session => session.dateKey >= weekStartDateKey && session.dateKey <= weekEndDateKey)
    .map(sourceFromSession)
    .filter((source): source is BossSource => Boolean(source));
  const bestByExpression = new Map<string, BossSource>();
  for (const source of sources) {
    const current = bestByExpression.get(source.expression);
    if (!current || source.weaknessScore > current.weaknessScore
      || (source.weaknessScore === current.weaknessScore && source.dateKey > current.dateKey)) {
      bestByExpression.set(source.expression, source);
    }
  }
  const ranked = [...bestByExpression.values()]
    .sort((left, right) => right.weaknessScore - left.weaknessScore || left.dateKey.localeCompare(right.dateKey));
  const selected = ranked.slice(0, NHK_WEEKLY_BOSS_REQUIRED_EXPRESSIONS);
  const planSeed = selected.map(source => `${source.sessionId}:${source.expression}`).join('|');
  return {
    version: 1,
    planId: `${NHK_WEEKLY_BOSS_VERSION}-${weekStartDateKey}-${stableHash(planSeed || weekStartDateKey)}`,
    weekStartDateKey,
    weekEndDateKey,
    availableExpressionCount: ranked.length,
    requiredExpressionCount: NHK_WEEKLY_BOSS_REQUIRED_EXPRESSIONS,
    ready: selected.length >= NHK_WEEKLY_BOSS_REQUIRED_EXPRESSIONS,
    turns: selected.map(turnFromSource),
  };
};

export const createNhkWeeklyBossProgress = (
  plan: NhkWeeklyBossPlan,
  startedAt = Date.now(),
): NhkWeeklyBossProgress => ({
  version: 1,
  planId: plan.planId,
  weekStartDateKey: plan.weekStartDateKey,
  currentTurnIndex: 0,
  turnResults: [],
  startedAt,
});

const isProgress = (value: unknown, planId: string): value is NhkWeeklyBossProgress => {
  if (!value || typeof value !== 'object') return false;
  const progress = value as Partial<NhkWeeklyBossProgress>;
  return progress.version === 1
    && progress.planId === planId
    && typeof progress.weekStartDateKey === 'string'
    && typeof progress.currentTurnIndex === 'number'
    && Array.isArray(progress.turnResults)
    && typeof progress.startedAt === 'number';
};

const resolveStorage = (storage?: StorageLike): StorageLike | null => {
  if (storage) return storage;
  return typeof localStorage === 'undefined' ? null : localStorage;
};

export const loadNhkWeeklyBossProgress = (
  planId: string,
  storage?: StorageLike,
): NhkWeeklyBossProgress | null => {
  const target = resolveStorage(storage);
  if (!target) return null;
  try {
    const parsed = JSON.parse(target.getItem(`${STORAGE_PREFIX}${planId}`) || 'null') as unknown;
    return isProgress(parsed, planId) ? parsed : null;
  } catch {
    return null;
  }
};

export const saveNhkWeeklyBossProgress = (
  progress: NhkWeeklyBossProgress | null,
  storage?: StorageLike,
): void => {
  const target = resolveStorage(storage);
  if (!target || !progress) return;
  target.setItem(`${STORAGE_PREFIX}${progress.planId}`, JSON.stringify(progress));
};

export const reviewsForBossTurn = (
  progress: NhkWeeklyBossProgress,
  turnId: string,
): NhkSpeechReview[] => progress.turnResults.find(result => result.turnId === turnId)?.attempts || [];

export const bossReviewPassed = (review?: NhkSpeechReview): boolean => Boolean(
  review && review.metrics.targetExpressionUsed && review.metrics.contentScore >= 60,
);

export const bossTurnNeedsRecovery = (attempts: NhkSpeechReview[]): boolean =>
  attempts.length === 1 && !bossReviewPassed(attempts[0]);

export const recordNhkWeeklyBossReview = (
  progress: NhkWeeklyBossProgress,
  turnId: string,
  review: NhkSpeechReview,
): NhkWeeklyBossProgress => {
  const existing = progress.turnResults.find(result => result.turnId === turnId);
  const nextResult = {turnId, attempts: [...(existing?.attempts || []), review].slice(-2)};
  return {
    ...progress,
    turnResults: [...progress.turnResults.filter(result => result.turnId !== turnId), nextResult],
  };
};

export const advanceNhkWeeklyBoss = (
  progress: NhkWeeklyBossProgress,
  plan: NhkWeeklyBossPlan,
): NhkWeeklyBossProgress => ({
  ...progress,
  currentTurnIndex: Math.min(plan.turns.length - 1, progress.currentTurnIndex + 1),
});

export const completeNhkWeeklyBoss = (
  progress: NhkWeeklyBossProgress,
  plan: NhkWeeklyBossPlan,
  completedAt = Date.now(),
): NhkWeeklyBossProgress => {
  const bestReviews = plan.turns.map(turn => {
    const attempts = reviewsForBossTurn(progress, turn.turnId);
    return attempts.slice().sort((left, right) => {
      const leftPassed = bossReviewPassed(left) ? 1 : 0;
      const rightPassed = bossReviewPassed(right) ? 1 : 0;
      return rightPassed - leftPassed || right.metrics.contentScore - left.metrics.contentScore;
    })[0];
  }).filter((review): review is NhkSpeechReview => Boolean(review));
  const usedExpressionCount = bestReviews.filter(review => review.metrics.targetExpressionUsed).length;
  const recoveredExpressionCount = plan.turns.filter(turn => {
    const attempts = reviewsForBossTurn(progress, turn.turnId);
    return attempts.length >= 2 && !bossReviewPassed(attempts[0]) && bossReviewPassed(attempts[attempts.length - 1]);
  }).length;
  const averageContentScore = bestReviews.length
    ? Math.round(bestReviews.reduce((sum, review) => sum + review.metrics.contentScore, 0) / bestReviews.length)
    : 0;
  const weakExpressions = plan.turns
    .filter(turn => !reviewsForBossTurn(progress, turn.turnId).some(bossReviewPassed))
    .map(turn => turn.targetExpression);
  return {
    ...progress,
    currentTurnIndex: Math.max(0, plan.turns.length - 1),
    completedAt,
    outcome: {
      usedExpressionCount,
      recoveredExpressionCount,
      averageContentScore,
      weakExpressions,
    },
  };
};
