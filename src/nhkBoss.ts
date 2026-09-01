import type {NhkSpeechReview} from './NhkSpeechCoach';
import {shiftDateKey, type NhkMorningSession} from './nhkMorning';

export type NhkBossRegister = 'daily' | 'polite' | 'work';

export type NhkBossExpression = {
  id: string;
  sourceDateKey: string;
  title: string;
  expression: string;
  sourceSentence: string;
  dailyVersion: string;
  workVersion: string;
};

export type NhkBossCandidate = {
  weekKey: string;
  weekStartKey: string;
  weekEndKey: string;
  sourceSessionIds: string[];
  expressions: NhkBossExpression[];
  requiredExpressionCount: number;
  eligible: boolean;
};

export type NhkBossTurn = {
  id: string;
  index: number;
  register: NhkBossRegister;
  promptZh: string;
  basePromptJa: string;
  promptJa: string;
  targetExpressionId: string;
  targetExpression: string;
  sourceTitle: string;
  answer: string;
  recordingSeconds: number;
  review?: NhkSpeechReview;
  completedAt?: number;
};

export type NhkBossOutcome = {
  usedExpressionCount: number;
  averageContentScore: number;
  characterReactionJa: string;
  characterReactionZh: string;
  nextWeekHookZh: string;
  completedAt: number;
};

export type NhkBossSession = {
  version: 1;
  id: string;
  weekKey: string;
  weekStartKey: string;
  weekEndKey: string;
  sourceSessionIds: string[];
  sourceSummaryJa: string;
  expressionCount: number;
  turns: NhkBossTurn[];
  startedAt: number;
  updatedAt: number;
  outcome?: NhkBossOutcome;
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const STORAGE_KEY = 'nihongo-weekly-boss-v1';
const REQUIRED_EXPRESSIONS = 5;
const BOSS_TURN_COUNT = 5;

const clean = (value: unknown, max = 500): string => typeof value === 'string'
  ? value.replace(/\s+/g, ' ').trim().slice(0, max)
  : '';

const normalizeKey = (value: string): string => value
  .normalize('NFKC')
  .toLocaleLowerCase('ja-JP')
  .replace(/[\s\u3000、。！？!?「」『』（）()［］\[\]・…—―〜～,.，]/g, '');

const weekStart = (dateKey: string): string => {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  return shiftDateKey(dateKey, offset);
};

const average = (values: number[]): number => values.length
  ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
  : 0;

const firstSentence = (value: string): string => clean(value.split(/[。！？!?]/)[0], 42);

const turnTemplates: Array<Pick<NhkBossTurn, 'register' | 'promptZh' | 'basePromptJa'>> = [
  {
    register: 'daily',
    promptZh: '从本周真实输入里选一件最让你在意的事，用自己的话讲清楚。',
    basePromptJa: '今週いちばん印象に残った話題を一つ選んで、自分の言葉で説明してください。',
  },
  {
    register: 'daily',
    promptZh: '田中继续问：这件事和你的日常生活有什么关系？',
    basePromptJa: 'それは、あなたの普段の生活にどんな関係があると思いますか。',
  },
  {
    register: 'polite',
    promptZh: '换成更礼貌的说法，让不同意见的人也能理解你的立场。',
    basePromptJa: '反対の立場の人にも伝わるように、少し丁寧な言い方で説明してもらえますか。',
  },
  {
    register: 'work',
    promptZh: '场景切到会议：说明对项目的影响，并说出下一步要确认什么。',
    basePromptJa: '同じ問題が職場で起きた場合、プロジェクトへの影響と次に確認することを説明してください。',
  },
  {
    register: 'work',
    promptZh: '最后把本周学到的内容整理成一个具体提案。',
    basePromptJa: '最後に、今週学んだことを一つの具体的な提案としてまとめてください。',
  },
];

export const buildNhkBossCandidate = (
  sessions: NhkMorningSession[],
  todayKey: string,
): NhkBossCandidate => {
  const weekStartKey = weekStart(todayKey);
  const weekEndKey = shiftDateKey(weekStartKey, 6);
  const sourceSessions = sessions
    .filter(session => Boolean(session.completedAt)
      && session.dateKey >= weekStartKey
      && session.dateKey <= weekEndKey
      && session.dailyInput)
    .sort((left, right) => left.dateKey.localeCompare(right.dateKey));
  const expressions: NhkBossExpression[] = [];
  const seen = new Set<string>();

  for (const session of sourceSessions) {
    const input = session.dailyInput!;
    const ordered = [...input.selectedTrainingSentences].sort((left, right) => {
      if (left.isPrimary === right.isPrimary) return left.selectionOrder - right.selectionOrder;
      return left.isPrimary ? -1 : 1;
    });
    for (const item of ordered) {
      const expression = clean(item.expression) || clean(item.sourceSentence);
      const key = normalizeKey(expression);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      expressions.push({
        id: item.id,
        sourceDateKey: session.dateKey,
        title: session.title,
        expression,
        sourceSentence: item.sourceSentence,
        dailyVersion: item.dailyVersion || item.sourceSentence,
        workVersion: item.workVersion || item.dailyVersion || item.sourceSentence,
      });
    }
  }

  return {
    weekKey: weekStartKey,
    weekStartKey,
    weekEndKey,
    sourceSessionIds: sourceSessions.map(session => session.id),
    expressions,
    requiredExpressionCount: REQUIRED_EXPRESSIONS,
    eligible: expressions.length >= REQUIRED_EXPRESSIONS,
  };
};

export const createNhkBossSession = (
  candidate: NhkBossCandidate,
  sessions: NhkMorningSession[],
  startedAt = Date.now(),
): NhkBossSession => {
  if (!candidate.eligible) throw new Error('boss_not_ready');
  const chosen = candidate.expressions.slice(0, BOSS_TURN_COUNT);
  const summaries = candidate.sourceSessionIds
    .map(id => sessions.find(session => session.id === id)?.dailyInput?.coach.summaryJa)
    .filter((value): value is string => Boolean(value));
  const turns = turnTemplates.map((template, index): NhkBossTurn => {
    const expression = chosen[index];
    return {
      id: `${candidate.weekKey}-turn-${index + 1}`,
      index,
      register: template.register,
      promptZh: template.promptZh,
      basePromptJa: template.basePromptJa,
      promptJa: template.basePromptJa,
      targetExpressionId: expression.id,
      targetExpression: expression.expression,
      sourceTitle: expression.title,
      answer: '',
      recordingSeconds: 0,
    };
  });
  return {
    version: 1,
    id: `nhk-boss-${candidate.weekKey}`,
    weekKey: candidate.weekKey,
    weekStartKey: candidate.weekStartKey,
    weekEndKey: candidate.weekEndKey,
    sourceSessionIds: candidate.sourceSessionIds,
    sourceSummaryJa: summaries.join(' '),
    expressionCount: candidate.expressions.length,
    turns,
    startedAt,
    updatedAt: startedAt,
  };
};

export const nextNhkBossTurnIndex = (session: NhkBossSession): number =>
  session.turns.findIndex(turn => !turn.completedAt);

export const recordNhkBossTurn = (
  session: NhkBossSession,
  turnIndex: number,
  review: NhkSpeechReview,
  recordingSeconds: number,
  completedAt = Date.now(),
): NhkBossSession => {
  if (turnIndex < 0 || turnIndex >= session.turns.length || session.outcome) return session;
  const turns: NhkBossTurn[] = session.turns.map(turn => turn.index === turnIndex
    ? {
      ...turn,
      answer: review.transcript,
      recordingSeconds,
      review,
      completedAt,
    }
    : {...turn});
  const next = turns[turnIndex + 1];
  if (next && !next.completedAt) {
    const reactionJa = clean(review.characterReactionJa, 160) || 'なるほど。';
    const reactionZh = clean(review.characterReactionZh, 180);
    next.promptJa = `${reactionJa} ${next.basePromptJa}`;
    next.promptZh = reactionZh ? `${reactionZh} 接着，田中追问：${next.promptZh}` : next.promptZh;
  }
  return {...session, turns, updatedAt: completedAt};
};

export const finalizeNhkBossSession = (
  session: NhkBossSession,
  completedAt = Date.now(),
): NhkBossSession => {
  if (session.outcome) return session;
  if (!session.turns.length || session.turns.some(turn => !turn.completedAt || !turn.review)) return session;
  const reviews = session.turns.map(turn => turn.review!);
  const finalReview = reviews[reviews.length - 1];
  const finalAnswer = firstSentence(session.turns[session.turns.length - 1]?.answer || '你的提案');
  return {
    ...session,
    updatedAt: completedAt,
    outcome: {
      usedExpressionCount: reviews.filter(item => item.metrics.targetExpressionUsed).length,
      averageContentScore: average(reviews.map(item => item.metrics.contentScore)),
      characterReactionJa: clean(finalReview.characterReactionJa, 180) || '来週、その提案をもう少し具体的に考えてみましょう。',
      characterReactionZh: clean(finalReview.characterReactionZh, 180) || '田中记住了你的提案，准备下周继续讨论。',
      nextWeekHookZh: `下周，田中会把你关于「${finalAnswer || '这件事'}」的想法带进一次真实的工作讨论。`,
      completedAt,
    },
  };
};

const isBossSession = (value: unknown): value is NhkBossSession => {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<NhkBossSession>;
  return session.version === 1
    && typeof session.id === 'string'
    && typeof session.weekKey === 'string'
    && Array.isArray(session.turns)
    && session.turns.length === BOSS_TURN_COUNT
    && typeof session.startedAt === 'number';
};

const resolveStorage = (storage?: StorageLike): StorageLike | null => {
  if (storage) return storage;
  return typeof localStorage === 'undefined' ? null : localStorage;
};

export const loadNhkBossSessions = (storage?: StorageLike): NhkBossSession[] => {
  const target = resolveStorage(storage);
  if (!target) return [];
  try {
    const parsed = JSON.parse(target.getItem(STORAGE_KEY) || '[]') as unknown;
    return Array.isArray(parsed) ? parsed.filter(isBossSession) : [];
  } catch {
    return [];
  }
};

export const saveNhkBossSessions = (
  sessions: NhkBossSession[],
  storage?: StorageLike,
): void => {
  const target = resolveStorage(storage);
  if (!target) return;
  target.setItem(STORAGE_KEY, JSON.stringify(sessions));
};

export const upsertNhkBossSession = (
  sessions: NhkBossSession[],
  session: NhkBossSession,
): NhkBossSession[] => [
  session,
  ...sessions.filter(item => item.id !== session.id),
].sort((left, right) => right.weekKey.localeCompare(left.weekKey));

export const findNhkBossSession = (
  sessions: NhkBossSession[],
  weekKey: string,
): NhkBossSession | null => sessions.find(session => session.weekKey === weekKey) || null;
