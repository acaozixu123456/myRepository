import { describe, expect, it } from 'vitest';
import { ACROSS_BONUS, ANGLE_PERIOD, IDEAL, MAX_SKIPS, POWER_PERIOD, RUNS_PER_DAY, SINK_ANGLE, THROWS, angleAt, angleQ, powerAt, recordSkips, runsLeft, skipGain, throwStone, tierOf, totalScore, tri, useRun } from '../src/game/stoneskip';
import { mulberry } from '../src/fx/util';
import { newPlayer } from '../src/game/state';
import { totals } from '../src/game/explore';

/** 机器人：瞄着理想时刻点，时机误差 ±jitter 秒均匀分布；jitter 为 null 时随手乱点 */
function play(seed: number, jitter: number | null) {
  const rnd = mulberry(seed), ts = [];
  // 角度：上行段到 IDEAL 的时刻；力度：满格的时刻
  const tA = (IDEAL / 45) * ANGLE_PERIOD / 2, tP = POWER_PERIOD / 2;
  for (let i = 0; i < THROWS; i++) {
    const a = jitter === null ? angleAt(rnd() * 10) : angleAt(tA + (rnd() - 0.5) * 2 * jitter);
    const p = jitter === null ? powerAt(rnd() * 10) : powerAt(tP + (rnd() - 0.5) * 2 * jitter);
    ts.push(throwStone(a, p));
  }
  return totalScore(ts);
}

describe('打水漂', () => {
  it('三角波：两端是 0，中间是 1；角度在 0~45 之间来回', () => {
    expect(tri(0, 2)).toBe(0); expect(tri(1, 2)).toBe(1); expect(tri(2, 2)).toBeCloseTo(0);
    for (let t = 0; t < 5; t += 0.07) { expect(angleAt(t)).toBeGreaterThanOrEqual(0); expect(angleAt(t)).toBeLessThanOrEqual(45); expect(powerAt(t)).toBeLessThanOrEqual(1); }
  });
  it('理想角度满力能飞过池塘拿奖励；太陡沉底；越偏离理想角度漂得越少', () => {
    expect(throwStone(IDEAL, 1)).toMatchObject({ skips: MAX_SKIPS, across: true, score: MAX_SKIPS + ACROSS_BONUS });
    expect(throwStone(SINK_ANGLE + 1, 1)).toMatchObject({ skips: 0, sank: true });
    expect(throwStone(1, 1).sank).toBe(true);
    expect(throwStone(IDEAL + 8, 1).skips).toBeLessThan(throwStone(IDEAL + 3, 1).skips);
    expect(throwStone(IDEAL, 0.5).skips).toBeLessThan(throwStone(IDEAL, 0.9).skips);
    expect(angleQ(IDEAL)).toBe(1);
  });
  it('平衡：手稳的大多 3 星，一般的多为 2 星，随手乱点很少过 1 星', () => {
    const tiers = (j: number | null) => { const n = [0, 0, 0, 0]; for (let s = 1; s <= 300; s++) n[tierOf(play(s, j))]++; return n; };
    const steady = tiers(0.05), ok = tiers(0.12), rand = tiers(null);
    console.log('stoneskip tiers', steady, ok, rand);
    expect(steady[3]).toBeGreaterThan(200);
    expect(ok[2] + ok[3]).toBeGreaterThan(180);
    expect(ok[3]).toBeLessThan(steady[3]);
    expect(rand[2] + rand[3]).toBeLessThan(40);
  });
  it('每天 RUNS_PER_DAY 局；奖励随档位递增；足迹累计漂的下数', () => {
    const s = newPlayer();
    for (let i = 0; i < RUNS_PER_DAY; i++) expect(useRun(s)).toBe(true);
    expect(useRun(s)).toBe(false); expect(runsLeft(s)).toBe(0);
    expect(skipGain(s, 3).fish).toBeGreaterThan(skipGain(s, 2).fish);
    recordSkips(s, 9); recordSkips(s, 3);
    expect(totals(s).skips).toBe(12);
  });
});
