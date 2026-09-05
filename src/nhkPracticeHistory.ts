import {type NhkMorningSession} from './nhkMorning';

export const HISTORY_KEY = 'nihongo-nhk-practice-history-v1';
export type SentenceAttempt = {
  id: string; articleId: string; sentence: string; meaning: string;
  answer: string; createdAt: number; updatedAt: number;
  revealedAt?: number; rating?: 'again' | 'good'; completedAt?: number;
  evidence: 'self-assessed';
};
export type PracticeHistory = {version: 1; attempts: SentenceAttempt[]};
type Store = Pick<Storage, 'getItem' | 'setItem'>;
let sequence = 0;
export function practiceId(prefix = 'practice'): string {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${(++sequence).toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}
export function newSentenceAttempt(articleId: string, sentence: string, meaning: string, now = Date.now()): SentenceAttempt {
  return {id: practiceId('sentence'), articleId, sentence, meaning, answer: '', createdAt: now, updatedAt: now, evidence: 'self-assessed'};
}
export function isSentenceAttempt(value: unknown): value is SentenceAttempt {
  if (!value || typeof value !== 'object') return false;
  const item = value as SentenceAttempt;
  return ['id','articleId','sentence','meaning','answer'].every(key => typeof item[key as keyof SentenceAttempt] === 'string')
    && !!item.id && !!item.articleId && !!item.sentence && item.evidence === 'self-assessed'
    && Number.isFinite(item.createdAt) && Number.isFinite(item.updatedAt)
    && (item.rating === undefined || item.rating === 'again' || item.rating === 'good')
    && (item.completedAt === undefined || (Number.isFinite(item.completedAt) && !!item.rating))
    && (item.revealedAt === undefined || Number.isFinite(item.revealedAt));
}
export function loadPracticeHistory(storage?: Store): PracticeHistory {
  try {
    const value = JSON.parse((storage || localStorage).getItem(HISTORY_KEY) || 'null');
    return value?.version === 1 && Array.isArray(value.attempts)
      ? {version: 1, attempts: value.attempts.filter(isSentenceAttempt)} : {version: 1, attempts: []};
  } catch {return {version: 1, attempts: []};}
}
export function savePracticeHistory(value: PracticeHistory, storage?: Store): boolean {
  try {(storage || localStorage).setItem(HISTORY_KEY, JSON.stringify(value)); return true;} catch {return false;}
}
export function upsertSentenceAttempt(history: PracticeHistory, attempt: SentenceAttempt): PracticeHistory {
  if (!isSentenceAttempt(attempt)) return history;
  const old = history.attempts.find(item => item.id === attempt.id);
  // A submitted answer is immutable; a later practice receives a new ID.
  if (old?.completedAt) return history;
  return {version: 1, attempts: [...history.attempts.filter(item => item.id !== attempt.id), attempt]};
}
export function articlePracticeSessions(sessions: NhkMorningSession[], url: string): NhkMorningSession[] {
  return sessions.filter(item => item.sourceUrl === url && (item.recapText.trim() || item.opinion.trim()))
    .sort((a,b) => (b.updatedAt || b.completedAt || 0) - (a.updatedAt || a.completedAt || 0));
}

// Changing a study target must not re-label a previously typed/recorded answer.
// The caller keeps the original persisted session; this returns a new blank attempt.
export function sessionForTarget(session: NhkMorningSession, selected: string[], now = Date.now()): NhkMorningSession {
  const previous = session.selectedSentences?.length ? session.selectedSentences : session.shadowText.split(/\n+/).filter(Boolean);
  const changed = JSON.stringify(previous) !== JSON.stringify(selected);
  const hasEvidence = Boolean(session.recapText.trim() || session.opinion.trim() || session.completedAt
    || session.shadowRecordingSeconds || session.recapRecordingSeconds || session.worldRecordingSeconds
    || Object.keys(session.speechReviews || {}).length || session.quietReviews?.length);
  if (!changed || !hasEvidence) return session;
  return {...session, id:practiceId('nhk'), updatedAt:now,
    selectedSentences:[], shadowText:'', dailyInput:undefined, keyExpression:'', dailyVersion:'', workVersion:'',
    recapText:'', opinion:'', worldAnswer:'', completedAt:undefined, completedMode:undefined,
    shadowRecordingSeconds:0, recapRecordingSeconds:0, worldRecordingSeconds:0,
    speechFallback:false, speechReviews:{}, quietReviews:[], recallAttempts:[], recall:undefined};
}
