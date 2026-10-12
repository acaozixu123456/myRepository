import { describe, expect, it } from 'vitest';
import { LAYERS, MISSES, PERFECT, RUNS_PER_DAY, drop, lean, level, newTower, omegaOf, radiusOf, recordLayers, runsLeft, snowcatGain, swingX, tierOf, useRun } from '../src/game/snowcat';
import { mulberry } from '../src/fx/util';
import { newPlayer } from '../src/game/state';
import { totals } from '../src/game/explore';

/** 机器人：等雪球摆到塔顶正上方附近（还会往回拉一点重心）时点，按下的时机有 jitter 秒的误差 */
function play(seed: number, jitter: number) {
  const rnd = mulberry(seed), tw = newTower();
  while (!tw.over) {
    const i = level(tw), w = omegaOf(i), want = tw.xs[i - 1] - lean(tw) * 0.5;
    // 找下一个经过 want 的时刻
    let t = 0.3; while (Math.abs(swingX(tw, t) - want) > 0.01 && t < 10) t += 0.002;
    t += (rnd() - 0.5) * 2 * jitter;
    drop(tw, t, rnd() * Math.PI * 2);
    void w;
  }
  return tw;
}

describe('叠雪猫', () => {
  it('雪球一层比一层小、摆得越来越快', () => {
    for (let i = 1; i < LAYERS; i++) { expect(radiusOf(i)).toBeLessThanOrEqual(radiusOf(i - 1)); expect(omegaOf(i)).toBeGreaterThan(omegaOf(i - 1)); }
  });
  it('正中算完美并对正；偏太多滚下去；三次就结束', () => {
    const tw = newTower();
    // 相位 0：t = 0 时在正中
    expect(drop(tw, 0)).toBe('perfect'); expect(tw.xs[1]).toBe(0); expect(tw.score).toBe(4);
    const t1 = Math.asin(0.1 / 0.85) / omegaOf(2);
    expect(drop(tw, t1)).toBe('ok'); expect(tw.xs[2]).toBeCloseTo(0.1, 5);
    const far = Math.PI / 2 / omegaOf(3);
    for (let k = 0; k < MISSES; k++) expect(drop(tw, far)).toBe('miss');
    expect(tw.over).toBe(true);
    expect(PERFECT).toBeLessThan(radiusOf(LAYERS));
  });
  it('一直往一边偏会塌', () => {
    const tw = newTower();
    let r = '';
    for (let k = 0; k < 12 && !tw.over; k++) { const want = tw.xs[tw.xs.length - 1] + radiusOf(level(tw) - 1) * 0.7; const t = Math.asin(Math.min(1, want / 0.85)) / omegaOf(level(tw)); r = drop(tw, t); }
    expect(r).toBe('topple'); expect(tw.toppled).toBe(true); expect(Math.abs(lean(tw))).toBeGreaterThan(0.3);
  });
  it('平衡：手稳的大多 2~3 星且 3 星明显多于手抖的；手抖的也能拿星', () => {
    const tiers = (j: number) => { const n = [0, 0, 0, 0]; for (let s = 1; s <= 200; s++) n[tierOf(play(s, j).score)]++; return n; };
    const good = tiers(0.035), shaky = tiers(0.09);
    console.log('snowcat tiers', good, shaky);
    expect(good[2] + good[3]).toBeGreaterThan(150);
    expect(good[3]).toBeGreaterThan(shaky[3] * 2);
    expect(shaky[0]).toBeLessThan(30);
  });
  it('每天 RUNS_PER_DAY 局；奖励随档位递增；足迹累计层数', () => {
    const s = newPlayer();
    for (let i = 0; i < RUNS_PER_DAY; i++) expect(useRun(s)).toBe(true);
    expect(useRun(s)).toBe(false); expect(runsLeft(s)).toBe(0);
    expect(snowcatGain(s, 2).fish).toBeGreaterThan(snowcatGain(s, 1).fish);
    recordLayers(s, 5); recordLayers(s, 7);
    expect(totals(s).snowcat).toBe(12);
  });
});
