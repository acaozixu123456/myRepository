import { describe, expect, it } from 'vitest';
import { BOX_GAMES_PER_DAY, MAX_ROUND, consolation, gamesLeft, makeRound, recordFound, rewardFor, slotAfter, useGame } from '../src/game/boxcat';
import { totals } from '../src/game/explore';
import { mulberry } from '../src/fx/util';
import { newPlayer } from '../src/game/state';

describe('纸箱寻猫规则', () => {
  it('每轮的箱子数、交换次数越来越多，速度越来越快（有下限）', () => {
    const r = mulberry(3);
    const rounds = Array.from({ length: MAX_ROUND }, (_, i) => makeRound(i + 1, r));
    expect(rounds.map((x) => x.boxes)).toEqual([3, 3, 4, 4, 5]);
    for (let i = 1; i < rounds.length; i++) { expect(rounds[i].swaps.length).toBeGreaterThan(rounds[i - 1].swaps.length); expect(rounds[i].stepMs).toBeLessThanOrEqual(rounds[i - 1].stepMs); }
    expect(Math.min(...rounds.map((x) => x.stepMs))).toBeGreaterThanOrEqual(260);
  });
  it('交换总是两个不同的合法位置，猫在合法的箱子里', () => {
    const r = mulberry(11);
    for (let round = 1; round <= MAX_ROUND; round++) for (let k = 0; k < 50; k++) {
      const x = makeRound(round, r);
      expect(x.cat).toBeGreaterThanOrEqual(0); expect(x.cat).toBeLessThan(x.boxes);
      for (const [a, b] of x.swaps) { expect(a).not.toBe(b); expect(a).toBeLessThan(x.boxes); expect(b).toBeLessThan(x.boxes); expect(a).toBeGreaterThanOrEqual(0); expect(b).toBeGreaterThanOrEqual(0); }
    }
  });
  it('跟踪猫的位置：和逐步模拟一致，且是一个合法位置', () => {
    const r = mulberry(5);
    for (let k = 0; k < 100; k++) {
      const x = makeRound(3, r);
      const slots = Array.from({ length: x.boxes }, (_, i) => i); // slots[位置] = 箱子编号
      for (const [a, b] of x.swaps) [slots[a], slots[b]] = [slots[b], slots[a]];
      expect(slotAfter(x.cat, x.swaps)).toBeLessThan(x.boxes);
      // 箱子编号为 cat 的那个箱子，最后所在的位置 = slotAfter(cat)
      expect(slots.indexOf(x.cat)).toBe(slotAfter(x.cat, x.swaps));
    }
  });
  it('连胜越多奖励越高；3 连起带猫薄荷，5 连带金铃铛；猜错拿一半；奖励随主线进度涨', () => {
    const s = newPlayer(), late = newPlayer(); late.best = { chapter: 3, index: 12 };
    const g = [0, 1, 2, 3, 4, 5].map((k) => rewardFor(s, k));
    expect(g[0].fish).toBe(0);
    for (let k = 1; k <= 5; k++) expect(g[k].fish).toBeGreaterThan(g[k - 1].fish);
    expect(g[2].catnip).toBe(0); expect(g[3].catnip).toBeGreaterThan(0); expect(g[4].bells).toBe(0); expect(g[5].bells).toBeGreaterThan(0);
    expect(consolation(s, 3).fish).toBe(Math.floor(g[3].fish / 2));
    expect(consolation(s, 3).fish).toBeLessThan(g[3].fish);
    expect(consolation(s, 3).fish).toBeGreaterThan(g[2].fish / 2 - 1);
    expect(rewardFor(late, 3).fish).toBeGreaterThan(g[3].fish);
    expect(rewardFor(s, 99)).toEqual(g[5]);
  });
  it('每天最多 6 局，隔天刷新；找到的猫累计', () => {
    const s = newPlayer(); const t0 = Date.UTC(2026, 9, 11, 12);
    for (let i = 0; i < BOX_GAMES_PER_DAY; i++) expect(useGame(s, t0)).toBe(true);
    expect(useGame(s, t0)).toBe(false);
    expect(gamesLeft(s, t0)).toBe(0);
    expect(gamesLeft(s, t0 + 86400_000)).toBe(BOX_GAMES_PER_DAY);
    recordFound(s, 2); recordFound(s); expect(totals(s).found).toBe(3);
  });
});
