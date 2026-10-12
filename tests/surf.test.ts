import { describe, expect, it } from 'vitest';
import { DURATION, PERFECT, RUNS_PER_DAY, WINDOW, WOBBLES, advance, comboMul, makeSet, newRide, recordTricks, runsLeft, surfGain, tap, tierOf, useRun } from '../src/game/surf';
import { mulberry } from '../src/fx/util';
import { newPlayer } from '../src/game/state';
import { totals } from '../src/game/explore';

/** 机器人：在每个浪头附近点，时机误差 ~ 均匀分布 ±jitter，偶尔漏点 */
function play(seed: number, jitter: number, skip: number) {
  const rnd = mulberry(seed), r = newRide(makeSet(mulberry(seed * 5 + 2)));
  for (const lip of r.set) {
    if (r.over) break;
    if (rnd() < skip) continue;
    tap(r, lip.t + (rnd() - 0.5) * 2 * jitter);
  }
  advance(r, DURATION);
  return r;
}

describe('冲浪', () => {
  it('浪头表：时间递增、在局内、越往后越密；种子固定', () => {
    for (let s = 1; s <= 30; s++) {
      const p = makeSet(mulberry(s));
      expect(p.length).toBeGreaterThan(18);
      for (let i = 1; i < p.length; i++) { expect(p[i].t - p[i - 1].t).toBeGreaterThan(0.75); expect(p[i].t).toBeLessThan(DURATION); }
    }
    expect(makeSet(mulberry(3))).toEqual(makeSet(mulberry(3)));
  });
  it('准点是完美、偏一点是不错、太偏算晃；晃三次落水', () => {
    const r = newRide([{ id: 0, t: 2, kind: 'wave' }, { id: 1, t: 4, kind: 'big' }, { id: 2, t: 6, kind: 'wave' }]);
    expect(tap(r, 2 + PERFECT / 2)).toMatchObject({ kind: 'perfect', gain: 3 });
    expect(tap(r, 4 + WINDOW.big * 0.9)).toMatchObject({ kind: 'good', gain: 2 });
    expect(r.combo).toBe(2);
    for (let k = 0; k < WOBBLES; k++) expect(tap(r, 5 + k * 0.01).kind).toBe('wobble');
    expect(r.over).toBe(true); expect(r.combo).toBe(0);
  });
  it('浪头过去没点只断连击，不算晃', () => {
    const r = newRide([{ id: 0, t: 1, kind: 'wave' }, { id: 1, t: 2, kind: 'wave' }]);
    tap(r, 1); expect(r.combo).toBe(1);
    expect(advance(r, 3).length).toBe(1);
    expect(r.combo).toBe(0); expect(r.wobbles).toBe(0);
  });
  it('连击倍率每 5 次 +0.5，最多 ×3', () => {
    expect(comboMul(0)).toBe(1); expect(comboMul(5)).toBe(1.5); expect(comboMul(40)).toBe(3);
  });
  it('平衡：手准的大多 2~3 星且 3 星明显多于手慢的；手慢的也能拿星', () => {
    const tiers = (j: number, sk: number) => { const n = [0, 0, 0, 0]; for (let s = 1; s <= 200; s++) n[tierOf(play(s, j, sk).score)]++; return n; };
    const good = tiers(0.1, 0.03), slow = tiers(0.22, 0.12);
    console.log('surf tiers', good, slow);
    expect(good[2] + good[3]).toBeGreaterThan(160);
    expect(good[3]).toBeGreaterThan(slow[3] * 2);
    expect(slow[0]).toBeLessThan(25);
  });
  it('每天 RUNS_PER_DAY 局；奖励随档位递增；足迹累计花样数', () => {
    const s = newPlayer();
    for (let i = 0; i < RUNS_PER_DAY; i++) expect(useRun(s)).toBe(true);
    expect(useRun(s)).toBe(false); expect(runsLeft(s)).toBe(0);
    expect(surfGain(s, 2).fish).toBeGreaterThan(surfGain(s, 1).fish);
    recordTricks(s, 9); recordTricks(s, 1);
    expect(totals(s).surf).toBe(10);
  });
});
