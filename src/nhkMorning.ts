export type NhkRecallRating = 'good' | 'close' | 'miss';

export type NhkMorningSession = {
  id: string;
  dateKey: string;
  sourceUrl: string;
  title: string;
  shadowText: string;
  recapText: string;
  keyExpression: string;
  dailyVersion: string;
  workVersion: string;
  opinion: string;
  worldAnswer: string;
  recapRecordingSeconds: number;
  worldRecordingSeconds: number;
  completedAt?: number;
  recall?: {
    dateKey: string;
    rating: NhkRecallRating;
    recordingSeconds: number;
    completedAt: number;
  };
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const STORAGE_KEY = 'nihongo-nhk-morning-v1';
const pad = (value: number) => String(value).padStart(2, '0');

export const toDateKey = (date = new Date()): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const shiftDateKey = (dateKey: string, offset: number): string => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return toDateKey(new Date(year, month - 1, day + offset));
};

export const createNhkSession = (dateKey = toDateKey()): NhkMorningSession => ({
  id: `nhk-${dateKey}`,
  dateKey,
  sourceUrl: '',
  title: '',
  shadowText: '',
  recapText: '',
  keyExpression: '',
  dailyVersion: '',
  workVersion: '',
  opinion: '',
  worldAnswer: '',
  recapRecordingSeconds: 0,
  worldRecordingSeconds: 0,
});

const isNhkSession = (value: unknown): value is NhkMorningSession => {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<NhkMorningSession>;
  return typeof session.id === 'string' && typeof session.dateKey === 'string';
};

const resolveStorage = (storage?: StorageLike): StorageLike | null => {
  if (storage) return storage;
  return typeof localStorage === 'undefined' ? null : localStorage;
};

export const loadNhkSessions = (storage?: StorageLike): NhkMorningSession[] => {
  const target = resolveStorage(storage);
  if (!target) return [];
  try {
    const parsed = JSON.parse(target.getItem(STORAGE_KEY) || '[]') as unknown;
    return Array.isArray(parsed) ? parsed.filter(isNhkSession) : [];
  } catch {
    return [];
  }
};

export const saveNhkSessions = (sessions: NhkMorningSession[], storage?: StorageLike): void => {
  const target = resolveStorage(storage);
  if (!target) return;
  target.setItem(STORAGE_KEY, JSON.stringify(sessions));
};

export const upsertNhkSession = (
  sessions: NhkMorningSession[],
  session: NhkMorningSession,
): NhkMorningSession[] => {
  const next = sessions.filter(item => item.id !== session.id);
  return [...next, session].sort((a, b) => b.dateKey.localeCompare(a.dateKey));
};

export const findTodayNhkSession = (
  sessions: NhkMorningSession[],
  todayKey = toDateKey(),
): NhkMorningSession | null => sessions.find(session => session.dateKey === todayKey) || null;

export const pickRecallSession = (
  sessions: NhkMorningSession[],
  todayKey = toDateKey(),
): NhkMorningSession | null => sessions
  .filter(session => Boolean(session.completedAt) && session.dateKey < todayKey && session.recall?.dateKey !== todayKey)
  .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))[0] || null;

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

export const isNhkSessionReadyToComplete = (session: NhkMorningSession): boolean =>
  Boolean(session.shadowText.trim() && session.recapText.trim() && session.keyExpression.trim() && session.worldAnswer.trim());
