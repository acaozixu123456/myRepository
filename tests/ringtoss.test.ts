import { describe, expect, it } from 'vitest';
import { RINGS, RING_R, ROWS, RUNS_PER_DAY, PRIZE_SCORE, aimAt, isOver, newToss, powerAt, recordWon, ringGain, runsLeft, tierOf, toss, useRun } from '../src/game/ringtoss';
import type { Toss } from '../src/game/ringtoss';
import { mulberry } from '../src/fx/util';
import { newPlayer } from '../src/game/state';
import { totals } from '../src/game/explore';

/** 机器人：瞄最值钱的桩，方向 / 力度各手抖 sig */
function play(seed: number, sig: number): Toss {
  const rnd = mulberry(seed), t = newToss(rnd);
  const g = () => (rnd() + rnd() + rnd() - 1.5) * 2 * sig;
  while (!isOver(t)) {
    const p = [...t.pegs].sort((a, b) => PRIZE_SCORE[b.kind] - PRIZE_SCORE[a.kind])[0];
    toss(t, p.x + g(), p.y + g(), rnd);
  }
  return t;
}

describe('夜市套圈', () => {
  it('场地：3 排 × 5 个桩，桩之间套圈判定不重叠；最远一排有且只有一只招财猫；种子固定', () => {
    for (let s = 1; s <= 50; s++) {
      const t = newToss(mulberry(s));
      expect(t.pegs.length).toBe(15);
      expect(t.pegs.filter((p) => p.kind === 'lucky').length).toBe(1);
      expect(t.pegs.find((p) => p.kind === 'lucky')!.y).toBeGreaterThan(ROWS[2] - 0.05);
      for (const a of t.pegs) for (const b of t.pegs) if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(RING_R * 2);
      for (const p of t.pegs) { expect(Math.abs(p.x)).toBeLessThan(0.9); expect(p.y).toBeGreaterThan(0.12); expect(p.y).toBeLessThan(1); }
    }
    expect(newToss(mulberry(4))).toEqual(newToss(mulberry(4)));
  });
  it('方向在 -0.95~0.95、力度在 0.12~1 之间来回', () => {
    for (let x = 0; x < 20; x += 0.03) {
      expect(Math.abs(aimAt(x, 0))).toBeLessThanOrEqual(0.95 + 1e-9);
      const p = powerAt(x, 2); expect(p).toBeGreaterThanOrEqual(0.12 - 1e-9); expect(p).toBeLessThanOrEqual(1 + 1e-9);
    }
  });
  it('正中套得上、扔空套不上；套中的桩被拿走；最多扔 RINGS 个', () => {
    const t = newToss(mulberry(2)), p = t.pegs[3];
    const r = toss(t, p.x, p.y, () => 0.5);
    expect(r.peg).toBe(p); expect(t.score).toBe(PRIZE_SCORE[p.kind]); expect(t.pegs).not.toContain(p);
    expect(toss(t, 0, 0.02, () => 0.5).peg).toBeNull();
    while (!isOver(t)) toss(t, 0, 0.02, () => 0.5);
    expect(t.thrown).toBe(RINGS);
  });
  it('平衡：手稳的大多 3 星，手抖的大多 0~2 星', () => {
    const tiers = (sig: number) => { const n = [0, 0, 0, 0]; for (let s = 1; s <= 300; s++) n[tierOf(play(s, sig).score)]++; return n; };
    const good = tiers(0.02), shaky = tiers(0.1);
    expect(good[3]).toBeGreaterThan(150);
    expect(shaky[3]).toBeLessThan(30);
  });
  it('每天 RUNS_PER_DAY 局；奖励随档位递增；足迹累计套中个数', () => {
    const s = newPlayer();
    for (let i = 0; i < RUNS_PER_DAY; i++) expect(useRun(s)).toBe(true);
    expect(useRun(s)).toBe(false); expect(runsLeft(s)).toBe(0);
    const g = [0, 1, 2, 3].map((t) => ringGain(s, t).fish);
    expect(g[0]).toBe(0); expect(g[1]).toBeLessThan(g[2]); expect(g[2]).toBeLessThan(g[3]);
    recordWon(s, 3); expect(totals(s).ring).toBe(3);
  });
});
