export type NhkStudyMode = 'voice' | 'quiet';

const STORAGE_KEY = 'nihongo-study-mode-v1';
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const resolveStorage = (storage?: StorageLike): StorageLike | null => {
  if (storage) return storage;
  return typeof localStorage === 'undefined' ? null : localStorage;
};

export const normalizeNhkStudyMode = (value: unknown): NhkStudyMode =>
  value === 'quiet' ? 'quiet' : 'voice';

export const loadNhkStudyMode = (storage?: StorageLike): NhkStudyMode => {
  const target = resolveStorage(storage);
  if (!target) return 'voice';
  try {
    return normalizeNhkStudyMode(target.getItem(STORAGE_KEY));
  } catch {
    return 'voice';
  }
};

export const saveNhkStudyMode = (
  mode: NhkStudyMode,
  storage?: StorageLike,
): void => {
  const target = resolveStorage(storage);
  if (!target) return;
  try {
    target.setItem(STORAGE_KEY, normalizeNhkStudyMode(mode));
  } catch {
    // Learning continues even when private browsing blocks local storage.
  }
};

export const isQuietNhkStudyMode = (mode: NhkStudyMode): boolean => mode === 'quiet';
