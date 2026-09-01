import {describe, expect, it} from 'vitest';
import {
  loadNhkPracticeMode,
  normalizeNhkPracticeMode,
  saveNhkPracticeMode,
} from './nhkPracticeMode';

describe('NHK practice mode preference', () => {
  it('defaults to voice and accepts only the explicit quiet mode', () => {
    expect(normalizeNhkPracticeMode(undefined)).toBe('voice');
    expect(normalizeNhkPracticeMode('voice')).toBe('voice');
    expect(normalizeNhkPracticeMode('quiet')).toBe('quiet');
    expect(normalizeNhkPracticeMode('silent')).toBe('voice');
  });

  it('persists the latest mode locally', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) || null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
    expect(loadNhkPracticeMode(storage)).toBe('voice');
    saveNhkPracticeMode('quiet', storage);
    expect(loadNhkPracticeMode(storage)).toBe('quiet');
  });
});
