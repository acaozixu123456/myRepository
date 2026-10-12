import { describe, expect, it } from 'vitest';
import { GRABS, RUNS_PER_DAY, TOY_HALF, TOY_SCORE, clawGain, clawX, grab, gripChance, isOver, newMachine, recordWon, runsLeft, tierOf, useRun } from '../src/game/claw';
import type { Machine } from '../src/game/claw';
import { mulberry } from '../src/fx/util';
import { newPlayer } from '../src/game/state';
import { totals } from '../src/game/explore';

/** 机器人：瞄最值钱的娃娃，手抖 sig */
function play(seed: number, sig: number): Machine {
  const rnd = mulberry(seed), m = newMachine(rnd);
  while (!isOver(m)) {
    const t = [...m.toys].sort((a, b) => TOY_SCORE[b.kind] * TOY_HALF[b.kind] - TOY_SCORE[a.kind] * TOY_HALF[a.kind])[0];
    grab(m, t.x + (rnd() + rnd() + rnd() - 1.5) * 2 * sig, rnd);
  }
  return m;
}

describe('夹娃娃机', () => {
  it('机器：6 个娃娃（1 金 1 大 4 小）互不重叠、都在机器里，种子固定', () => {
    for (let s = 1; s <= 50; s++) {
      const m = newMachine(mulberry(s));
      expect(m.toys.map((t) => t.kind).sort()).toEqual(['big', 'gold', 'plush', 'plush', 'plush', 'plush']);
      for (let i = 1; i < m.toys.length; i++) { const a = m.toys[i - 1], b = m.toys[i]; expect(b.x - a.x).toBeGreaterThan(TOY_HALF[a.kind] + TOY_HALF[b.kind]); }
      for (const t of m.toys) { expect(t.x - TOY_HALF[t.kind]).toBeGreaterThanOrEqual(0.08); expect(t.x + TOY_HALF[t.kind]).toBeLessThanOrEqual(0.92); }
    }
    expect(newMachine(mulberry(7))).toEqual(newMachine(mulberry(7)));
  });
  it('爪子：在 0.05~0.95 之间来回，每抓一次变快', () => {
    for (let t = 0; t < 10; t += 0.07) { const x = clawX(t, 0); expect(x).toBeGreaterThanOrEqual(0.05 - 1e-9); expect(x).toBeLessThanOrEqual(0.95 + 1e-9); }
    expect(clawX(0, 0)).toBeCloseTo(0.05);
    expect(clawX(1 / 0.32 / 2, 0)).toBeCloseTo(0.95);
    expect(clawX(0.5, 2)).not.toBeCloseTo(clawX(0.5, 0));
  });
  it('成功率：正中最高、越偏越低、出了边就抓空；金猫比毛球滑', () => {
    expect(gripChance('plush', 0)).toBeGreaterThan(gripChance('plush', 0.7));
    expect(gripChance('plush', 0.7)).toBeGreaterThan(gripChance('plush', 1));
    expect(gripChance('plush', 1.01)).toBe(0);
    expect(gripChance('gold', 0)).toBeLessThan(gripChance('plush', 0));
    const m = newMachine(mulberry(3));
    const r = grab(m, -1, () => 0);
    expect(r.ok).toBe(false); expect(r.toy).toBeNull(); expect(m.grabs).toBe(1);
  });
  it('抓到的娃娃从机器里拿走并计分；最多抓 GRABS 次', () => {
    const m = newMachine(mulberry(5)), t = m.toys[0];
    const r = grab(m, t.x, () => 0);
    expect(r.ok).toBe(true); expect(m.score).toBe(TOY_SCORE[t.kind]); expect(m.toys).not.toContain(t);
    while (!isOver(m)) grab(m, 0.5, () => 0.99);
    expect(m.grabs).toBe(GRABS);
    expect(grab(m, 0.5, () => 0).ok).toBe(false);
  });
  it('平衡：手稳的玩家大多 3 星，手抖的大多 1~2 星', () => {
    const tiers = (sig: number) => { const n = [0, 0, 0, 0]; for (let s = 1; s <= 300; s++) n[tierOf(play(s, sig).score)]++; return n; };
    const good = tiers(0.01), shaky = tiers(0.12);
    expect(good[3]).toBeGreaterThan(120);
    expect(shaky[3]).toBeLessThan(40);
    expect(shaky[1] + shaky[2]).toBeGreaterThan(200);
  });
  it('每天 RUNS_PER_DAY 局；奖励随档位递增；足迹累计抓到的个数', () => {
    const s = newPlayer();
    for (let i = 0; i < RUNS_PER_DAY; i++) expect(useRun(s)).toBe(true);
    expect(useRun(s)).toBe(false); expect(runsLeft(s)).toBe(0);
    const g = [0, 1, 2, 3].map((t) => clawGain(s, t).fish);
    expect(g[0]).toBe(0); expect(g[1]).toBeLessThan(g[2]); expect(g[2]).toBeLessThan(g[3]);
    recordWon(s, 2); recordWon(s, 1); expect(totals(s).claw).toBe(3);
  });
});
