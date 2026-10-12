import { describe, expect, it } from 'vitest';
import { LIVES, ROUNDS, RUNS_PER_DAY, SPOTS, START_LEN, TIERS, fireflyGain, flashTime, newMemo, recordRounds, roundSeq, runsLeft, tap, tierOf, useRun } from '../src/game/firefly';
import type { Memo } from '../src/game/firefly';
import { mulberry } from '../src/fx/util';
import { newPlayer } from '../src/game/state';
import { totals } from '../src/game/explore';

/** 完美玩家打到第 n 轮结束时故意连错两次 */
function playTo(m: Memo, rounds: number) {
  for (let r = 0; r < rounds && !m.over; r++) for (const k of roundSeq(m)) tap(m, k);
  while (!m.over) tap(m, (roundSeq(m)[m.pos] + 1) % SPOTS);
}

describe('萤火虫记忆', () => {
  it('顺序：长度够用、灯号合法、相邻不重复；每轮是上一轮多一个；种子固定', () => {
    for (let s = 1; s <= 50; s++) {
      const m = newMemo(mulberry(s));
      expect(m.seq.length).toBe(START_LEN + ROUNDS - 1);
      for (let i = 0; i < m.seq.length; i++) { expect(m.seq[i]).toBeGreaterThanOrEqual(0); expect(m.seq[i]).toBeLessThan(SPOTS); if (i) expect(m.seq[i]).not.toBe(m.seq[i - 1]); }
    }
    const m = newMemo(mulberry(3));
    expect(roundSeq(m).length).toBe(START_LEN);
    for (const k of roundSeq(m)) tap(m, k);
    expect(roundSeq(m).length).toBe(START_LEN + 1);
    expect(newMemo(mulberry(8))).toEqual(newMemo(mulberry(8)));
  });
  it('点对推进、一轮点完计分进下一轮；点错先重看这一轮，命用完就结束', () => {
    const m = newMemo(mulberry(4)), s = roundSeq(m);
    expect(tap(m, s[0])).toBe('ok');
    expect(tap(m, s[1])).toBe('round');
    expect(m.score).toBe(2);
    expect(tap(m, (roundSeq(m)[0] + 1) % SPOTS)).toBe('retry');
    expect(m.pos).toBe(0); expect(m.lives).toBe(LIVES - 1);
    expect(tap(m, (roundSeq(m)[0] + 1) % SPOTS)).toBe('miss');
    expect(m.over).toBe(true);
  });
  it('全部记住：ROUNDS 轮后通关，分数够 3 星', () => {
    const m = newMemo(mulberry(9));
    let last = '';
    for (let r = 0; r < ROUNDS; r++) for (const k of roundSeq(m)) last = tap(m, k);
    expect(last).toBe('clear'); expect(m.over).toBe(true);
    expect(tierOf(m.score)).toBe(3);
  });
  it('档位：完成 2 / 4 / 6 轮分别是 1 / 2 / 3 星；播放随轮数变快', () => {
    for (const [n, t] of [[1, 0], [2, 1], [3, 1], [4, 2], [5, 2], [6, 3]] as [number, number][]) { const m = newMemo(mulberry(n)); playTo(m, n); expect(tierOf(m.score), `${n} 轮`).toBe(t); }
    expect(TIERS).toEqual([5, 14, 27]);
    expect(flashTime(5)).toBeLessThan(flashTime(0));
  });
  it('每天 RUNS_PER_DAY 局；奖励随档位递增；足迹累计轮数', () => {
    const s = newPlayer();
    for (let i = 0; i < RUNS_PER_DAY; i++) expect(useRun(s)).toBe(true);
    expect(useRun(s)).toBe(false); expect(runsLeft(s)).toBe(0);
    const g = [0, 1, 2, 3].map((t) => fireflyGain(s, t).fish);
    expect(g[0]).toBe(0); expect(g[1]).toBeLessThan(g[2]); expect(g[2]).toBeLessThan(g[3]);
    recordRounds(s, 4); expect(totals(s).firefly).toBe(4);
  });
});
