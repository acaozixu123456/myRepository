import { describe, expect, it } from 'vitest';
import { BAR_SECONDS, LOOP_BARS, bgmBar } from '../src/app/bgm';

describe('背景音乐（程序合成）', () => {
  it('四小节一循环，第 i 小节与第 i+4 小节完全相同，负数下标也合法', () => {
    expect(LOOP_BARS).toBe(4);
    for (let i = 0; i < 8; i++) expect(bgmBar(i)).toEqual(bgmBar(i + LOOP_BARS));
    expect(bgmBar(-1)).toEqual(bgmBar(3));
  });
  it('每个音的频率为正有限数、起止时间落在小节内、音量在 0~1，且每小节都有旋律与和弦', () => {
    for (let i = 0; i < LOOP_BARS; i++) {
      const notes = bgmBar(i);
      expect(notes.length).toBeGreaterThanOrEqual(8);
      for (const n of notes) {
        expect(Number.isFinite(n.f)).toBe(true); expect(n.f).toBeGreaterThan(60); expect(n.f).toBeLessThan(2400);
        expect(n.t).toBeGreaterThanOrEqual(0); expect(n.t).toBeLessThan(BAR_SECONDS);
        expect(n.d).toBeGreaterThan(0); expect(n.v).toBeGreaterThan(0); expect(n.v).toBeLessThanOrEqual(1);
      }
      expect(notes.some((n) => n.type === 'triangle')).toBe(true);
      expect(notes.filter((n) => n.t === 0 && n.type === 'sine' && n.f < 300).length).toBeGreaterThanOrEqual(2);
    }
  });
});
