export type NhkPracticeMode = 'voice' | 'quiet';

const STORAGE_KEY = 'nihongo-practice-mode-v1';
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const resolveStorage = (storage?: StorageLike): StorageLike | null => {
  if (storage) return storage;
  return typeof localStorage === 'undefined' ? null : localStorage;
};

export const normalizeNhkPracticeMode = (value: unknown): NhkPracticeMode =>
  value === 'quiet' ? 'quiet' : 'voice';

export const loadNhkPracticeMode = (storage?: StorageLike): NhkPracticeMode => {
  const target = resolveStorage(storage);
  if (!target) return 'voice';
  return normalizeNhkPracticeMode(target.getItem(STORAGE_KEY));
};

export const saveNhkPracticeMode = (
  mode: NhkPracticeMode,
  storage?: StorageLike,
): void => {
  const target = resolveStorage(storage);
  if (!target) return;
  target.setItem(STORAGE_KEY, normalizeNhkPracticeMode(mode));
};
