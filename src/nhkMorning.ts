import {
  alignCoachRecommendations,
  isNhkCoachResult,
  type NhkCoachLabel,
  type NhkCoachRecommendation,
  type NhkCoachResult,
} from './nhkCoach';
import type {NhkSpeechMode, NhkSpeechReview} from './NhkSpeechCoach';
import {normalizeNhkPracticeMode, type NhkPracticeMode} from './nhkPracticeMode';

export type NhkRecallRating = 'good' | 'close' | 'miss';
export type NhkRecallIntervalDay = 1 | 3 | 7;
export type NhkRecallScenarioKind = 'reconstruct' | 'daily-transfer' | 'work-transfer';
export type NhkRecallRegister = 'core' | 'daily' | 'work';

export type NhkRecallPlan = {
  intervalDay: NhkRecallIntervalDay;
  dueDateKey: string;
  scenarioKind: NhkRecallScenarioKind;
  register: NhkRecallRegister;
  titleZh: string;
  promptZh: string;
  promptJa: string;
  revealLabelZh: string;
  referenceJa: string;
};

export type NhkRecallAttempt = NhkRecallPlan & {
  dateKey: string;
  rating: NhkRecallRating;
  responseMode: NhkPracticeMode;
  quietNote?: string;
  recordingSeconds: number;
  completedAt: number;
  review?: NhkSpeechReview;
};

export type NhkQuietReviewEntry = {
  completedAt: number;
  rating: NhkRecallRating;
  note?: string;
};

export type NhkTrainingSentence = {
  id: string;
  sourceSentence: string;
  sentenceIndex: number;
  selectionOrder: number;
  isPrimary: boolean;
  label: NhkCoachLabel;
  reasonZh: string;
  chunks: string[];
  expression: string;
  meaningZh: string;
  dailyVersion: string;
  workVersion: string;
};

export type NhkWorldCallback = {
  dueDateKey: string;
  setupZh: string;
  promptJa: string;
  answer: string;
  recordingSeconds: number;
  responseMode?: NhkPracticeMode;
  answeredAt?: number;
  targetExpressionUsed?: boolean;
  contentScore?: number;
  completedAt?: number;
  review?: NhkSpeechReview;
  characterReactionJa?: string;
  characterReactionZh?: string;
};

export type NhkDailyInputV2 = {
  version: 2;
  articleId: string;
  sourceUrl: string;
  title: string;
  candidateSentences: string[];
  coach: NhkCoachResult;
  coachModel?: string;
  generatedAt: number;
  selectedTrainingSentences: NhkTrainingSentence[];
  primaryTrainingSentenceId: string;
  userOpinion: string;
  world: {
    eventId: string;
    characterId: 'tanaka';
    characterName: string;
    locationNameZh: string;
    setupZh: string;
    promptJa: string;
    answer: string;
    usedInWorld: boolean;
    enteredAt?: number;
    answeredAt?: number;
    targetExpressionUsed?: boolean;
    contentScore?: number;
    characterReaction?: string;
    characterReactionJa?: string;
    characterReactionZh?: string;
    callback: NhkWorldCallback;
  };
  recallSchedule: NhkRecallPlan[];
};

export type NhkMorningSession = {
  schemaVersion: 2;
  id: string;
  dateKey: string;
  sourceUrl: string;
  title: string;
  shadowText: string;
  selectedSentences: string[];
  dailyInput?: NhkDailyInputV2;
  recapText: string;
  keyExpression: string;
  dailyVersion: string;
  workVersion: string;
  opinion: string;
  worldAnswer: string;
  shadowRecordingSeconds: number;
  recapRecordingSeconds: number;
  worldRecordingSeconds: number;
  practiceMode: NhkPracticeMode;
  completedMode?: NhkPracticeMode;
  quietReviews: NhkQuietReviewEntry[];
  speechFallback: boolean;
  speechReviews: Partial<Record<NhkSpeechMode, NhkSpeechReview>>;
  completedAt?: number;
  recallAttempts: NhkRecallAttempt[];
  recall?: {
    dateKey: string;
    rating: NhkRecallRating;
    recordingSeconds: number;
    completedAt: number;
  };
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
type BuildDailyInputOptions = {
  session: NhkMorningSession;
  coach: NhkCoachResult;
  selectedSentences: string[];
  candidateSentences: string[];
  coachModel?: string;
  generatedAt?: number;
};

const STORAGE_KEY = 'nihongo-nhk-morning-v2';
const LEGACY_STORAGE_KEY = 'nihongo-nhk-morning-v1';
const pad = (value: number) => String(value).padStart(2, '0');
const clean = (value: unknown, max = 400): string => typeof value === 'string'
  ? value.replace(/\s+/g, ' ').trim().slice(0, max)
  : '';

export const toDateKey = (date = new Date()): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const shiftDateKey = (dateKey: string, offset: number): string => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return toDateKey(new Date(year, month - 1, day + offset));
};

const daysBetween = (fromDateKey: string, toDateKeyValue: string): number => {
  const [fromYear, fromMonth, fromDay] = fromDateKey.split('-').map(Number);
  const [toYear, toMonth, toDay] = toDateKeyValue.split('-').map(Number);
  const from = Date.UTC(fromYear, fromMonth - 1, fromDay);
  const to = Date.UTC(toYear, toMonth - 1, toDay);
  return Math.max(0, Math.round((to - from) / 86_400_000));
};

const articleIdFromUrl = (sourceUrl: string): string => {
  try {
    const url = new URL(sourceUrl);
    return url.pathname.split('/').filter(Boolean)[1] || '';
  } catch {
    return '';
  }
};

const stableHash = (value: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

const uniqueSentences = (sentences: string[], limit: number): string[] =>
  Array.from(new Set(sentences.map(value => clean(value, 280)).filter(Boolean))).slice(0, limit);

type NhkRecallSeed = Pick<NhkTrainingSentence, 'sourceSentence' | 'expression' | 'dailyVersion' | 'workVersion'>;

export const buildNhkRecallSchedule = (
  dateKey: string,
  seed?: Partial<NhkRecallSeed> | null,
): NhkRecallPlan[] => {
  const sourceSentence = clean(seed?.sourceSentence, 500) || clean(seed?.expression, 200) || '今日の核心表現';
  const dailyVersion = clean(seed?.dailyVersion, 500) || sourceSentence;
  const workVersion = clean(seed?.workVersion, 500) || dailyVersion;
  return [
    {
      intervalDay: 1,
      dueDateKey: shiftDateKey(dateKey, 1),
      scenarioKind: 'reconstruct',
      register: 'core',
      titleZh: '重建核心',
      promptZh: '不看原句，先用自己的话说清新闻重点，再用今天的核心表达补一句。',
      promptJa: 'ニュースの要点を一文で言い直し、今日の核心表現を使ってもう一文続けてください。',
      revealLabelZh: '核心原句',
      referenceJa: sourceSentence,
    },
    {
      intervalDay: 3,
      dueDateKey: shiftDateKey(dateKey, 3),
      scenarioKind: 'daily-transfer',
      register: 'daily',
      titleZh: '日常迁移',
      promptZh: '朋友问这件事会不会影响日常生活。不要复述新闻，用自然口语回答 1～2 句。',
      promptJa: '友だちに「それ、普段の生活にも関係あるの？」と聞かれました。ニュースをそのまま繰り返さず、自然な話し言葉で答えてください。',
      revealLabelZh: '日常参考',
      referenceJa: dailyVersion,
    },
    {
      intervalDay: 7,
      dueDateKey: shiftDateKey(dateKey, 7),
      scenarioKind: 'work-transfer',
      register: 'work',
      titleZh: '工作迁移',
      promptZh: '会议上说明这项变化对项目的影响，并说下一步要确认什么。用两句工作日语回答。',
      promptJa: '会議で「この変更はプロジェクトにどんな影響がありますか。次に何を確認しますか」と聞かれました。仕事の日本語で二文答えてください。',
      revealLabelZh: '工作参考',
      referenceJa: workVersion,
    },
  ];
};

const RECALL_SCENARIO_KINDS: NhkRecallScenarioKind[] = ['reconstruct', 'daily-transfer', 'work-transfer'];
const RECALL_REGISTERS: NhkRecallRegister[] = ['core', 'daily', 'work'];

const normalizeRecallSchedule = (
  value: unknown,
  dateKey: string,
  seed?: Partial<NhkRecallSeed> | null,
): NhkRecallPlan[] => {
  const defaults = buildNhkRecallSchedule(dateKey, seed);
  const source = Array.isArray(value)
    ? value.filter(item => item && typeof item === 'object').map(item => item as Partial<NhkRecallPlan>)
    : [];
  return defaults.map(fallback => {
    const item = source.find(candidate => candidate.intervalDay === fallback.intervalDay);
    if (!item) return fallback;
    return {
      ...fallback,
      dueDateKey: clean(item.dueDateKey, 10) || fallback.dueDateKey,
      scenarioKind: RECALL_SCENARIO_KINDS.includes(item.scenarioKind as NhkRecallScenarioKind)
        ? item.scenarioKind as NhkRecallScenarioKind
        : fallback.scenarioKind,
      register: RECALL_REGISTERS.includes(item.register as NhkRecallRegister)
        ? item.register as NhkRecallRegister
        : fallback.register,
      titleZh: clean(item.titleZh, 100) || fallback.titleZh,
      promptZh: clean(item.promptZh, 500) || fallback.promptZh,
      promptJa: clean(item.promptJa, 500) || fallback.promptJa,
      revealLabelZh: clean(item.revealLabelZh, 100) || fallback.revealLabelZh,
      referenceJa: clean(item.referenceJa, 500) || fallback.referenceJa,
    };
  });
};

const buildNhkWorldCallback = (dateKey: string, title: string): NhkWorldCallback => ({
  dueDateKey: shiftDateKey(dateKey, 3),
  setupZh: `几天后，田中再次提起「${title || '那条新闻'}」。他记得你上次的回答，想确认你的想法有没有变化。`,
  promptJa: 'この前話したニュースのことですが、今も同じ考えですか。理由も教えてください。',
  answer: '',
  recordingSeconds: 0,
});

const trainingSentenceFromRecommendation = (
  recommendation: NhkCoachRecommendation,
  sourceKey: string,
  selectionOrder: number,
): NhkTrainingSentence => ({
  id: `${sourceKey || 'local'}-${recommendation.sentenceIndex}-${stableHash(recommendation.sentence)}`,
  sourceSentence: recommendation.sentence,
  sentenceIndex: recommendation.sentenceIndex,
  selectionOrder,
  isPrimary: selectionOrder === 0,
  label: recommendation.label,
  reasonZh: recommendation.reasonZh,
  chunks: recommendation.chunks,
  expression: recommendation.expression,
  meaningZh: recommendation.meaningZh,
  dailyVersion: recommendation.dailyVersion,
  workVersion: recommendation.workVersion,
});

export const primaryNhkTrainingSentence = (dailyInput?: NhkDailyInputV2): NhkTrainingSentence | null => {
  if (!dailyInput) return null;
  return dailyInput.selectedTrainingSentences.find(item => item.id === dailyInput.primaryTrainingSentenceId)
    || dailyInput.selectedTrainingSentences.find(item => item.isPrimary)
    || dailyInput.selectedTrainingSentences[0]
    || null;
};

export const buildNhkDailyInput = ({
  session,
  coach,
  selectedSentences,
  candidateSentences,
  coachModel,
  generatedAt = Date.now(),
}: BuildDailyInputOptions): NhkDailyInputV2 => {
  const candidates = uniqueSentences(candidateSentences, 16);
  const aligned = alignCoachRecommendations(coach, selectedSentences, candidates);
  const articleId = articleIdFromUrl(session.sourceUrl);
  const sourceKey = articleId || stableHash(session.sourceUrl || session.id);
  const selectedTrainingSentences = aligned.map((recommendation, index) =>
    trainingSentenceFromRecommendation(recommendation, sourceKey, index));
  const previous = session.dailyInput?.version === 2 && session.dailyInput.sourceUrl === session.sourceUrl
    ? session.dailyInput
    : undefined;
  const primary = selectedTrainingSentences[0];
  const previousPrimary = previous?.primaryTrainingSentenceId === primary?.id ? previous : undefined;
  const previousWorld = previousPrimary?.world;

  return {
    version: 2,
    articleId,
    sourceUrl: session.sourceUrl,
    title: session.title,
    candidateSentences: candidates.length ? candidates : aligned.map(item => item.sentence),
    coach,
    ...(coachModel || previous?.coachModel ? {coachModel: coachModel || previous?.coachModel} : {}),
    generatedAt: previous?.generatedAt || generatedAt,
    selectedTrainingSentences,
    primaryTrainingSentenceId: selectedTrainingSentences[0]?.id || '',
    userOpinion: session.opinion,
    world: {
      eventId: `${sourceKey}-${session.dateKey}-world-event`,
      characterId: 'tanaka',
      characterName: '田中',
      locationNameZh: '公司午休区',
      setupZh: coach.worldSetupZh,
      promptJa: coach.worldPromptJa,
      answer: session.worldAnswer,
      usedInWorld: previousWorld?.usedInWorld || false,
      ...(previousWorld?.enteredAt ? {enteredAt: previousWorld.enteredAt} : {}),
      ...(previousWorld?.answeredAt ? {answeredAt: previousWorld.answeredAt} : {}),
      ...(typeof previousWorld?.targetExpressionUsed === 'boolean' ? {targetExpressionUsed: previousWorld.targetExpressionUsed} : {}),
      ...(typeof previousWorld?.contentScore === 'number' ? {contentScore: previousWorld.contentScore} : {}),
      ...(previousWorld?.characterReaction ? {characterReaction: previousWorld.characterReaction} : {}),
      ...(previousWorld?.characterReactionJa ? {characterReactionJa: previousWorld.characterReactionJa} : {}),
      ...(previousWorld?.characterReactionZh ? {characterReactionZh: previousWorld.characterReactionZh} : {}),
      callback: previousWorld?.callback || buildNhkWorldCallback(session.dateKey, session.title),
    },
    recallSchedule: normalizeRecallSchedule(previousPrimary?.recallSchedule, session.dateKey, primary),
  };
};

export const applyNhkDailyInput = (
  session: NhkMorningSession,
  dailyInput: NhkDailyInputV2,
): NhkMorningSession => {
  const primary = primaryNhkTrainingSentence(dailyInput);
  const selectedSentences = dailyInput.selectedTrainingSentences.map(item => item.sourceSentence);
  return {
    ...session,
    schemaVersion: 2,
    dailyInput,
    selectedSentences,
    shadowText: selectedSentences.join('\n'),
    keyExpression: primary?.expression || '',
    dailyVersion: primary?.dailyVersion || '',
    workVersion: primary?.workVersion || '',
  };
};

export const syncNhkDailyInputUserFields = (session: NhkMorningSession): NhkMorningSession => {
  if (!session.dailyInput) return session;
  return {
    ...session,
    dailyInput: {
      ...session.dailyInput,
      userOpinion: session.opinion,
      world: {
        ...session.dailyInput.world,
        answer: session.worldAnswer,
      },
    },
  };
};

export const applyNhkSpeechReview = (
  session: NhkMorningSession,
  review: NhkSpeechReview,
): NhkMorningSession => {
  let next: NhkMorningSession = {
    ...session,
    speechReviews: {...session.speechReviews, [review.mode]: review},
  };
  if (review.mode === 'recap') next = {...next, recapText: review.transcript};
  if (review.mode === 'world') {
    next = {...next, worldAnswer: review.transcript};
    if (next.dailyInput) {
      const combinedReaction = [review.characterReactionJa, review.characterReactionZh].filter(Boolean).join('\n');
      next = {
        ...next,
        dailyInput: {
          ...next.dailyInput,
          world: {
            ...next.dailyInput.world,
            answer: review.transcript,
            answeredAt: review.analyzedAt,
            targetExpressionUsed: review.metrics.targetExpressionUsed,
            contentScore: review.metrics.contentScore,
            ...(combinedReaction ? {characterReaction: combinedReaction} : {}),
            ...(review.characterReactionJa ? {characterReactionJa: review.characterReactionJa} : {}),
            ...(review.characterReactionZh ? {characterReactionZh: review.characterReactionZh} : {}),
          },
        },
      };
    }
  }
  return syncNhkDailyInputUserFields(next);
};

export const markNhkDailyInputUsedInWorld = (
  session: NhkMorningSession,
  enteredAt = Date.now(),
): NhkMorningSession => {
  const synced = syncNhkDailyInputUserFields(session);
  if (!synced.dailyInput) return synced;
  return {
    ...synced,
    dailyInput: {
      ...synced.dailyInput,
      world: {
        ...synced.dailyInput.world,
        usedInWorld: true,
        enteredAt: synced.dailyInput.world.enteredAt || enteredAt,
      },
    },
  };
};

export const applyNhkWorldCallbackReview = (
  session: NhkMorningSession,
  review: NhkSpeechReview,
  recordingSeconds: number,
): NhkMorningSession => {
  if (!session.dailyInput) return session;
  const callback = session.dailyInput.world.callback;
  return {
    ...session,
    dailyInput: {
      ...session.dailyInput,
      world: {
        ...session.dailyInput.world,
        callback: {
          ...callback,
          answer: review.transcript,
          recordingSeconds,
          responseMode: 'voice',
          answeredAt: review.analyzedAt,
          targetExpressionUsed: review.metrics.targetExpressionUsed,
          contentScore: review.metrics.contentScore,
          review,
          ...(review.characterReactionJa ? {characterReactionJa: review.characterReactionJa} : {}),
          ...(review.characterReactionZh ? {characterReactionZh: review.characterReactionZh} : {}),
        },
      },
    },
  };
};

export const completeNhkWorldCallback = (
  session: NhkMorningSession,
  answer: string,
  recordingSeconds: number,
  review?: NhkSpeechReview,
  completedAt = Date.now(),
  responseMode: NhkPracticeMode = review ? 'voice' : 'quiet',
): NhkMorningSession => {
  const reviewed = review ? applyNhkWorldCallbackReview(session, review, recordingSeconds) : session;
  if (!reviewed.dailyInput) return reviewed;
  return {
    ...reviewed,
    dailyInput: {
      ...reviewed.dailyInput,
      world: {
        ...reviewed.dailyInput.world,
        callback: {
          ...reviewed.dailyInput.world.callback,
          answer: clean(answer, 1200),
          recordingSeconds,
          responseMode,
          answeredAt: reviewed.dailyInput.world.callback.answeredAt || completedAt,
          completedAt,
        },
      },
    },
  };
};

export const createNhkSession = (
  dateKey = toDateKey(),
  practiceMode: NhkPracticeMode = 'voice',
): NhkMorningSession => ({
  schemaVersion: 2,
  id: `nhk-${dateKey}`,
  dateKey,
  sourceUrl: '',
  title: '',
  shadowText: '',
  selectedSentences: [],
  recapText: '',
  keyExpression: '',
  dailyVersion: '',
  workVersion: '',
  opinion: '',
  worldAnswer: '',
  shadowRecordingSeconds: 0,
  recapRecordingSeconds: 0,
  worldRecordingSeconds: 0,
  practiceMode,
  quietReviews: [],
  speechFallback: false,
  speechReviews: {},
  recallAttempts: [],
});

const isNhkSession = (value: unknown): value is NhkMorningSession => {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<NhkMorningSession>;
  return typeof session.id === 'string' && typeof session.dateKey === 'string';
};

const sentenceListFromText = (value: string): string[] => value
  .split(/\n+/)
  .map(sentence => sentence.trim())
  .filter(Boolean)
  .slice(0, 3);

const recallSeedForSession = (session: NhkMorningSession): NhkRecallSeed => {
  const primary = primaryNhkTrainingSentence(session.dailyInput);
  if (primary) return primary;
  const sourceSentence = sentenceListFromText(session.shadowText)[0] || session.keyExpression || '今日の核心表現';
  return {
    sourceSentence,
    expression: session.keyExpression || sourceSentence,
    dailyVersion: session.dailyVersion || sourceSentence,
    workVersion: session.workVersion || session.dailyVersion || sourceSentence,
  };
};

const migratedLegacyAttempt = (
  session: NhkMorningSession,
  schedule: NhkRecallPlan[],
): NhkRecallAttempt[] => {
  if (!session.recall) return [];
  const elapsed = daysBetween(session.dateKey, session.recall.dateKey);
  const intervalDay: NhkRecallIntervalDay = elapsed >= 7 ? 7 : elapsed >= 3 ? 3 : 1;
  const plan = schedule.find(item => item.intervalDay === intervalDay)
    || buildNhkRecallSchedule(session.dateKey, recallSeedForSession(session))[0];
  return [{
    ...plan,
    dateKey: session.recall.dateKey,
    rating: session.recall.rating,
    responseMode: 'voice',
    recordingSeconds: session.recall.recordingSeconds,
    completedAt: session.recall.completedAt,
  }];
};

const SPEECH_MODES: NhkSpeechMode[] = ['shadow', 'recap', 'world', 'recall'];

const normalizeSpeechReview = (value: unknown): NhkSpeechReview | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const review = value as Partial<NhkSpeechReview>;
  if (typeof review.id !== 'string'
    || !SPEECH_MODES.includes(review.mode as NhkSpeechMode)
    || typeof review.transcript !== 'string'
    || typeof review.analyzedAt !== 'number') return undefined;
  return review as NhkSpeechReview;
};

const normalizeSpeechReviews = (value: unknown): Partial<Record<NhkSpeechMode, NhkSpeechReview>> => {
  if (!value || typeof value !== 'object') return {};
  const source = value as Partial<Record<NhkSpeechMode, unknown>>;
  const result: Partial<Record<NhkSpeechMode, NhkSpeechReview>> = {};
  for (const mode of SPEECH_MODES) {
    const review = normalizeSpeechReview(source[mode]);
    if (review) result[mode] = review;
  }
  return result;
};

const normalizeQuietReviews = (value: unknown): NhkQuietReviewEntry[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter(item => item && typeof item === 'object')
    .map(item => item as Partial<NhkQuietReviewEntry>)
    .filter(item => typeof item.completedAt === 'number'
      && ['good', 'close', 'miss'].includes(String(item.rating)))
    .map(item => ({
      completedAt: item.completedAt!,
      rating: item.rating as NhkRecallRating,
      ...(clean(item.note, 800) ? {note: clean(item.note, 800)} : {}),
    }))
    .sort((left, right) => left.completedAt - right.completedAt)
    .slice(-30);
};

const normalizeAttempts = (
  value: unknown,
  fallback: NhkRecallAttempt[],
  schedule: NhkRecallPlan[],
): NhkRecallAttempt[] => {
  if (!Array.isArray(value)) return fallback;
  const attempts: NhkRecallAttempt[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Partial<NhkRecallAttempt>;
    const plan = schedule.find(candidate => candidate.intervalDay === item.intervalDay);
    if (!plan
      || typeof item.dateKey !== 'string'
      || !['good', 'close', 'miss'].includes(String(item.rating))
      || typeof item.completedAt !== 'number') continue;
    const review = normalizeSpeechReview(item.review);
    attempts.push({
      ...plan,
      dueDateKey: clean(item.dueDateKey, 10) || plan.dueDateKey,
      dateKey: item.dateKey,
      rating: item.rating as NhkRecallRating,
      responseMode: normalizeNhkPracticeMode(item.responseMode),
      ...(clean(item.quietNote, 800) ? {quietNote: clean(item.quietNote, 800)} : {}),
      recordingSeconds: Number(item.recordingSeconds) || 0,
      completedAt: item.completedAt,
      ...(review ? {review} : {}),
    });
  }
  return attempts.length ? attempts : fallback;
};

const normalizeWorldCallback = (value: unknown, fallback: NhkWorldCallback): NhkWorldCallback => {
  if (!value || typeof value !== 'object') return fallback;
  const callback = value as Partial<NhkWorldCallback>;
  const review = normalizeSpeechReview(callback.review);
  return {
    ...fallback,
    dueDateKey: clean(callback.dueDateKey, 10) || fallback.dueDateKey,
    setupZh: clean(callback.setupZh, 600) || fallback.setupZh,
    promptJa: clean(callback.promptJa, 500) || fallback.promptJa,
    answer: clean(callback.answer, 1200),
    recordingSeconds: Number(callback.recordingSeconds) || 0,
    ...(callback.responseMode ? {responseMode: normalizeNhkPracticeMode(callback.responseMode)} : {}),
    ...(typeof callback.answeredAt === 'number' ? {answeredAt: callback.answeredAt} : {}),
    ...(typeof callback.targetExpressionUsed === 'boolean' ? {targetExpressionUsed: callback.targetExpressionUsed} : {}),
    ...(typeof callback.contentScore === 'number' ? {contentScore: callback.contentScore} : {}),
    ...(typeof callback.completedAt === 'number' ? {completedAt: callback.completedAt} : {}),
    ...(review ? {review} : {}),
    ...(clean(callback.characterReactionJa, 300) ? {characterReactionJa: clean(callback.characterReactionJa, 300)} : {}),
    ...(clean(callback.characterReactionZh, 300) ? {characterReactionZh: clean(callback.characterReactionZh, 300)} : {}),
  };
};

const normalizeDailyInput = (value: unknown, session: NhkMorningSession): NhkDailyInputV2 | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const input = value as Partial<NhkDailyInputV2>;
  if (input.version !== 2 || !isNhkCoachResult(input.coach)) return undefined;
  const selected = Array.isArray(input.selectedTrainingSentences)
    ? input.selectedTrainingSentences.map(item => clean(item?.sourceSentence, 280)).filter(Boolean)
    : session.selectedSentences;
  if (!selected.length) return undefined;
  const candidateSentences = Array.isArray(input.candidateSentences)
    ? uniqueSentences(input.candidateSentences, 16)
    : selected;
  const rebuilt = buildNhkDailyInput({
    session: {...session, dailyInput: undefined},
    coach: input.coach,
    selectedSentences: selected,
    candidateSentences,
    coachModel: clean(input.coachModel, 80),
    generatedAt: typeof input.generatedAt === 'number' ? input.generatedAt : Date.now(),
  });
  const world = input.world && typeof input.world === 'object' ? input.world : undefined;
  const recallSchedule = normalizeRecallSchedule(
    input.recallSchedule,
    session.dateKey,
    primaryNhkTrainingSentence(rebuilt),
  );
  return {
    ...rebuilt,
    userOpinion: clean(input.userOpinion, 1200) || session.opinion,
    world: {
      ...rebuilt.world,
      eventId: clean(world?.eventId, 180) || rebuilt.world.eventId,
      characterId: 'tanaka',
      characterName: clean(world?.characterName, 80) || rebuilt.world.characterName,
      locationNameZh: clean(world?.locationNameZh, 120) || rebuilt.world.locationNameZh,
      answer: clean(world?.answer, 1200) || session.worldAnswer,
      usedInWorld: Boolean(world?.usedInWorld),
      ...(typeof world?.enteredAt === 'number' ? {enteredAt: world.enteredAt} : {}),
      ...(typeof world?.answeredAt === 'number' ? {answeredAt: world.answeredAt} : {}),
      ...(typeof world?.targetExpressionUsed === 'boolean' ? {targetExpressionUsed: world.targetExpressionUsed} : {}),
      ...(typeof world?.contentScore === 'number' ? {contentScore: world.contentScore} : {}),
      ...(clean(world?.characterReaction, 600) ? {characterReaction: clean(world?.characterReaction, 600)} : {}),
      ...(clean(world?.characterReactionJa, 300) ? {characterReactionJa: clean(world?.characterReactionJa, 300)} : {}),
      ...(clean(world?.characterReactionZh, 300) ? {characterReactionZh: clean(world?.characterReactionZh, 300)} : {}),
      callback: normalizeWorldCallback(world?.callback, rebuilt.world.callback),
    },
    recallSchedule,
  };
};

const normalizeNhkSession = (session: NhkMorningSession): NhkMorningSession => {
  const selectedSentences = Array.isArray(session.selectedSentences)
    ? uniqueSentences(session.selectedSentences, 3)
    : sentenceListFromText(session.shadowText || '');
  const base: NhkMorningSession = {
    ...createNhkSession(session.dateKey),
    ...session,
    schemaVersion: 2,
    selectedSentences,
    shadowRecordingSeconds: Number(session.shadowRecordingSeconds) || 0,
    recapRecordingSeconds: Number(session.recapRecordingSeconds) || 0,
    worldRecordingSeconds: Number(session.worldRecordingSeconds) || 0,
    practiceMode: normalizeNhkPracticeMode(session.practiceMode),
    ...(session.completedMode ? {completedMode: normalizeNhkPracticeMode(session.completedMode)} : {}),
    quietReviews: normalizeQuietReviews(session.quietReviews),
    speechFallback: Boolean(session.speechFallback),
    speechReviews: normalizeSpeechReviews(session.speechReviews),
    recallAttempts: [],
  };
  const dailyInput = normalizeDailyInput(session.dailyInput, base);
  const normalized = dailyInput ? applyNhkDailyInput(base, dailyInput) : base;
  const recallSchedule = dailyInput?.recallSchedule?.length
    ? dailyInput.recallSchedule
    : buildNhkRecallSchedule(normalized.dateKey, recallSeedForSession(normalized));
  normalized.recallAttempts = normalizeAttempts(
    session.recallAttempts,
    migratedLegacyAttempt(normalized, recallSchedule),
    recallSchedule,
  );
  return normalized;
};

const resolveStorage = (storage?: StorageLike): StorageLike | null => {
  if (storage) return storage;
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
};

export const loadNhkSessions = (storage?: StorageLike): NhkMorningSession[] => {
  const target = resolveStorage(storage);
  if (!target) return [];
  try {
    const serialized = target.getItem(STORAGE_KEY) || target.getItem(LEGACY_STORAGE_KEY) || '[]';
    const parsed = JSON.parse(serialized) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isNhkSession).map(normalizeNhkSession) : [];
  } catch {
    return [];
  }
};

export const saveNhkSessions = (sessions: NhkMorningSession[], storage?: StorageLike): boolean => {
  try {
    const target = resolveStorage(storage);
    if (!target) return false;
    target.setItem(STORAGE_KEY, JSON.stringify(sessions.map(normalizeNhkSession)));
    return true;
  } catch { return false; }
};

export const upsertNhkSession = (
  sessions: NhkMorningSession[],
  session: NhkMorningSession,
): NhkMorningSession[] => {
  const next = sessions.filter(item => item.id !== session.id);
  return [...next, normalizeNhkSession(session)].sort((a, b) => b.dateKey.localeCompare(a.dateKey));
};

export const findTodayNhkSession = (
  sessions: NhkMorningSession[],
  todayKey = toDateKey(),
): NhkMorningSession | null => sessions.find(session => session.dateKey === todayKey) || null;

export type NhkWorldCallbackTarget = {
  session: NhkMorningSession;
  dueDateKey: string;
};

export const pickNhkWorldCallbackTarget = (
  sessions: NhkMorningSession[],
  todayKey = toDateKey(),
): NhkWorldCallbackTarget | null => sessions
  .filter(session => Boolean(session.completedAt
    && session.dailyInput?.world.usedInWorld
    && Boolean(session.dailyInput.world.answer.trim())
    && !session.dailyInput.world.callback.completedAt
    && session.dailyInput.world.callback.dueDateKey <= todayKey))
  .sort((a, b) => a.dailyInput!.world.callback.dueDateKey.localeCompare(b.dailyInput!.world.callback.dueDateKey)
    || b.dateKey.localeCompare(a.dateKey))
  .map(session => ({session, dueDateKey: session.dailyInput!.world.callback.dueDateKey}))[0] || null;

export type NhkRecallTarget = NhkRecallPlan & {
  session: NhkMorningSession;
};

export const pickRecallTarget = (
  sessions: NhkMorningSession[],
  todayKey = toDateKey(),
): NhkRecallTarget | null => {
  const targets: NhkRecallTarget[] = [];
  for (const session of sessions) {
    if (!session.completedAt || session.dateKey >= todayKey) continue;
    if (session.recallAttempts.some(attempt => attempt.dateKey === todayKey)) continue;
    const completed = new Set(session.recallAttempts.map(attempt => attempt.intervalDay));
    const schedule = session.dailyInput?.recallSchedule?.length
      ? session.dailyInput.recallSchedule
      : buildNhkRecallSchedule(session.dateKey, recallSeedForSession(session));
    const due = schedule.find(plan => plan.dueDateKey <= todayKey && !completed.has(plan.intervalDay));
    if (due) targets.push({session, ...due});
  }
  return targets.sort((a, b) => a.dueDateKey.localeCompare(b.dueDateKey)
    || b.session.dateKey.localeCompare(a.session.dateKey))[0] || null;
};

export const pickRecallSession = (
  sessions: NhkMorningSession[],
  todayKey = toDateKey(),
): NhkMorningSession | null => pickRecallTarget(sessions, todayKey)?.session || null;

export const recordNhkRecallAttempt = (
  session: NhkMorningSession,
  target: NhkRecallPlan | NhkRecallTarget,
  dateKey: string,
  rating: NhkRecallRating,
  recordingSeconds: number,
  completedAt = Date.now(),
  review?: NhkSpeechReview,
  responseMode: NhkPracticeMode = 'voice',
  quietNote = '',
): NhkMorningSession => {
  const attempt: NhkRecallAttempt = {
    intervalDay: target.intervalDay,
    dueDateKey: target.dueDateKey,
    scenarioKind: target.scenarioKind,
    register: target.register,
    titleZh: target.titleZh,
    promptZh: target.promptZh,
    promptJa: target.promptJa,
    revealLabelZh: target.revealLabelZh,
    referenceJa: target.referenceJa,
    dateKey,
    rating,
    responseMode,
    ...(clean(quietNote, 800) ? {quietNote: clean(quietNote, 800)} : {}),
    recordingSeconds,
    completedAt,
    ...(review ? {review} : {}),
  };
  return {
    ...session,
    recallAttempts: [
      ...session.recallAttempts.filter(item => item.intervalDay !== target.intervalDay),
      attempt,
    ].sort((a, b) => a.intervalDay - b.intervalDay),
  };
};

export const recordNhkQuietReview = (
  session: NhkMorningSession,
  rating: NhkRecallRating,
  note = '',
  completedAt = Date.now(),
): NhkMorningSession => ({
  ...session,
  quietReviews: [
    ...session.quietReviews,
    {
      completedAt,
      rating,
      ...(clean(note, 800) ? {note: clean(note, 800)} : {}),
    },
  ].sort((left, right) => left.completedAt - right.completedAt).slice(-30),
});

export const completedNhkStreak = (
  sessions: NhkMorningSession[],
  todayKey = toDateKey(),
): number => {
  const completed = new Set(sessions.filter(session => session.completedAt).map(session => session.dateKey));
  let cursor = completed.has(todayKey) ? todayKey : shiftDateKey(todayKey, -1);
  let streak = 0;
  while (completed.has(cursor)) {
    streak += 1;
    cursor = shiftDateKey(cursor, -1);
  }
  return streak;
};

export const suggestExpression = (shadowText: string): string => {
  const candidate = shadowText
    .split(/[。！？\n]/)
    .map(part => part.trim())
    .find(Boolean);
  return candidate ? `${candidate}。` : '';
};

export const isNhkSessionReadyToComplete = (session: NhkMorningSession): boolean => {
  const coreReady = Boolean(session.shadowText.trim()
    && session.recapText.trim()
    && session.keyExpression.trim()
    && session.worldAnswer.trim());
  if (!coreReady) return false;
  if (session.practiceMode === 'quiet') return true;
  const recapSpoken = session.recapRecordingSeconds > 0 || session.speechFallback;
  const worldSpoken = session.worldRecordingSeconds > 0 || session.speechFallback;
  return recapSpoken && worldSpoken;
};
