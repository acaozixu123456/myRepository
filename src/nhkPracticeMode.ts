export type NhkPracticeMode = 'voice' | 'quiet';

const STORAGE_KEY = 'nihongo-practice-mode-v1';
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const resolveStorage = (storage?: StorageLike): StorageLike | null => {
  if (storage) return storage;
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
};

export const normalizeNhkPracticeMode = (value: unknown): NhkPracticeMode =>
  value === 'quiet' ? 'quiet' : 'voice';

export const loadNhkPracticeMode = (storage?: StorageLike): NhkPracticeMode => {
  const target = resolveStorage(storage);
  if (!target) return 'voice';
  try { return normalizeNhkPracticeMode(target.getItem(STORAGE_KEY)); } catch { return 'voice'; }
};

export const saveNhkPracticeMode = (mode: NhkPracticeMode, storage?: StorageLike): boolean => {
  try {
    const target = resolveStorage(storage);
    if (!target) return false;
    target.setItem(STORAGE_KEY, normalizeNhkPracticeMode(mode));
    return true;
  } catch { return false; }
};
