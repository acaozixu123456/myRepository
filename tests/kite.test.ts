import { describe, expect, it } from 'vitest';
import { DROP, DURATION, HIT_R, LIFT, KITE_X, RUNS_PER_DAY, SPEED, isOver, kiteGain, makeSchedule, newGame, recordKite, runsLeft, step, tierOf, useRun, xOf } from '../src/game/kite';
import { mulberry } from '../src/fx/util';
import { newPlayer } from '../src/game/state';
import { totals } from '../src/game/explore';

/** 机器人：盯着下一个要到的好东西，按住 / 松手让纸鸢往那个高度去；下一个是乌云就躲开。skill 越低看得越慢、估得越偏 */
function play(seed: number, skill: number) {
  const rnd = mulberry(seed), g = newGame(makeSchedule(rnd));
  let target = 0.5, think = 0;
  while (!isOver(g)) {
    think -= 1 / 60;
    if (think <= 0) {
      think = 0.1 + (1 - skill) * 0.5;
      const next = g.plan.filter((it) => !g.done.has(it.id) && it.t > g.t).slice(0, 2);
      const good = next.find((it) => it.kind !== 'storm');
      const storm = next[0]?.kind === 'storm' ? next[0] : null;
      target = good ? good.y : g.y;
      if (storm && Math.abs(storm.y - target) < HIT_R * 2 && storm.t - g.t < 0.8) target = storm.y > 0.5 ? storm.y - 0.25 : storm.y + 0.25;
      target += (rnd() - 0.5) * (1 - skill) * 0.4;
    }
    // 估算现在松手 / 按住后会停在哪个高度，和目标比
    const stop = g.vy > 0 ? g.y + (g.vy * g.vy) / (2 * DROP) : g.y - (g.vy * g.vy) / (2 * (LIFT - DROP));
    step(g, stop < target, 1 / 60);
  }
  return g;
}

describe('云海放纸鸢', () => {
  it('出场表：时间递增、在局内、高度在 0.1~0.9，相邻高度变化有限；种子固定', () => {
    for (let s = 1; s <= 30; s++) {
      const p = makeSchedule(mulberry(s));
      expect(p.length).toBeGreaterThan(30);
      for (let i = 0; i < p.length; i++) { expect(p[i].y).toBeGreaterThanOrEqual(0.1); expect(p[i].y).toBeLessThanOrEqual(0.9); expect(p[i].t).toBeLessThan(DURATION); if (i) { expect(p[i].t).toBeGreaterThan(p[i - 1].t); expect(Math.abs(p[i].y - p[i - 1].y)).toBeLessThanOrEqual(0.351); } }
    }
    expect(makeSchedule(mulberry(5))).toEqual(makeSchedule(mulberry(5)));
  });
  it('按住往上、松手往下，不会飞出画面', () => {
    const g = newGame([]);
    for (let i = 0; i < 60; i++) step(g, true, 1 / 30);
    expect(g.y).toBe(1);
    for (let i = 0; i < 90; i++) step(g, false, 1 / 30);
    expect(g.y).toBe(0);
  });
  it('碰到小鱼干 / 金铃铛加分，乌云扣分并让纸鸢变沉；每样只结算一次', () => {
    const g2 = newGame([{ id: 0, t: 0.1, y: 0.5, kind: 'fish' }, { id: 1, t: 0.1, y: 0.52, kind: 'bell' }, { id: 2, t: 0.1, y: 0.9, kind: 'fish' }]);
    const out = step(g2, false, 0.1);
    expect(out.length).toBe(3);
    expect(g2.score).toBe(4); expect(g2.got).toBe(2);
    expect(step(g2, false, 0.1).length).toBe(0);
    const g3 = newGame([{ id: 0, t: 0.05, y: 0.5, kind: 'storm' }]); g3.score = 5;
    step(g3, false, 0.05);
    expect(g3.score).toBe(2); expect(g3.wet).toBeGreaterThan(0);
  });
  it('东西从右边飘进来，在纸鸢那一列结算', () => {
    const it0 = { id: 0, t: 5, y: 0.5, kind: 'fish' as const };
    expect(xOf(it0, 5)).toBeCloseTo(KITE_X);
    expect(xOf(it0, 5 - (1 - KITE_X) / SPEED)).toBeCloseTo(1);
    expect(xOf(it0, 0)).toBeNull();
  });
  it('平衡：反应快的大多 2~3 星且 3 星明显多于反应慢的；反应慢的也能拿到星', () => {
    const tiers = (k: number) => { const n = [0, 0, 0, 0]; for (let s = 1; s <= 200; s++) n[tierOf(play(s, k).score)]++; return n; };
    const good = tiers(1), slow = tiers(0.4);
    console.log('kite tiers', good, slow);
    expect(good[2] + good[3]).toBeGreaterThan(160);
    expect(good[3]).toBeGreaterThan(slow[3] * 2);
    expect(slow[0]).toBeLessThan(20);
  });
  it('每天 RUNS_PER_DAY 局；奖励随档位递增；足迹累计收到的东西', () => {
    const s = newPlayer();
    for (let i = 0; i < RUNS_PER_DAY; i++) expect(useRun(s)).toBe(true);
    expect(useRun(s)).toBe(false); expect(runsLeft(s)).toBe(0);
    expect(kiteGain(s, 0).fish).toBe(0);
    expect(kiteGain(s, 2).fish).toBeGreaterThan(kiteGain(s, 1).fish);
    expect(kiteGain(s, 3).bells).toBeGreaterThan(0);
    recordKite(s, 7); recordKite(s, 3);
    expect(totals(s).kite).toBe(10);
  });
});
