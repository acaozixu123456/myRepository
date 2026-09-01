import {shiftDateKey, type NhkMorningSession} from './nhkMorning';

export const NHK_CAUSAL_WORLD_VERSION = 'nhk-causal-world-v1';

export type NhkCausalWorldEvent = {
  version: 1;
  eventId: string;
  sourceSessionId: string;
  sourceDateKey: string;
  callbackDueDateKey: string;
  title: string;
  setupZh: string;
  promptJa: string;
  answerJa: string;
  targetExpression: string;
  reactionJa: string;
  reactionZh: string;
  isCallback: boolean;
};

export type NhkWorldCallbackTarget = {
  session: NhkMorningSession;
  event: NhkCausalWorldEvent;
};

const FALLBACK_REACTION_JA = '田中はあなたの答えを覚えて、あとでこの話をもう一度考えることにしました。';
const FALLBACK_REACTION_ZH = '田中记住了你的回答，并决定过几天再和你聊这件事。';

const hasResolvedWorldEvent = (session: NhkMorningSession): boolean => Boolean(
  session.completedAt
  && session.dailyInput?.world.usedInWorld
  && (session.dailyInput.world.answer || session.worldAnswer).trim(),
);

export const buildNhkCausalWorldEvent = (
  session: NhkMorningSession,
  isCallback = false,
): NhkCausalWorldEvent | null => {
  if (!hasResolvedWorldEvent(session) || !session.dailyInput) return null;
  const world = session.dailyInput.world;
  return {
    version: 1,
    eventId: `nhk-world-${session.id}`,
    sourceSessionId: session.id,
    sourceDateKey: session.dateKey,
    callbackDueDateKey: shiftDateKey(session.dateKey, 3),
    title: session.dailyInput.title || session.title || '今天的新闻进入了你的世界',
    setupZh: world.setupZh,
    promptJa: world.promptJa,
    answerJa: world.answer || session.worldAnswer,
    targetExpression: session.keyExpression,
    reactionJa: world.characterReactionJa || FALLBACK_REACTION_JA,
    reactionZh: world.characterReactionZh || world.characterReaction || FALLBACK_REACTION_ZH,
    isCallback,
  };
};

export const pickNhkWorldCallback = (
  sessions: NhkMorningSession[],
  todayKey: string,
): NhkWorldCallbackTarget | null => {
  const candidates = sessions
    .filter(session => !session.worldCallbackRevealedAt && session.dateKey < todayKey)
    .map(session => ({session, event: buildNhkCausalWorldEvent(session, true)}))
    .filter((item): item is NhkWorldCallbackTarget => Boolean(item.event))
    .filter(item => item.event.callbackDueDateKey <= todayKey)
    .sort((left, right) => left.event.callbackDueDateKey.localeCompare(right.event.callbackDueDateKey)
      || left.event.sourceDateKey.localeCompare(right.event.sourceDateKey));
  return candidates[0] || null;
};

export const markNhkWorldCallbackRevealed = (
  session: NhkMorningSession,
  revealedAt = Date.now(),
): NhkMorningSession => ({...session, worldCallbackRevealedAt: revealedAt});
