import { describe, expect, it } from 'vitest';
import { BOAT_HALF, BOAT_SPEED, CATCH_Y, DURATION, RUNS_PER_DAY, arrowsGain, heightOf, isOver, makeSchedule, newGame, recordArrows, runsLeft, step, tierOf, useRun } from '../src/game/arrows';
import type { Shot } from '../src/game/arrows';
import { mulberry } from '../src/fx/util';
import { newPlayer } from '../src/game/state';
import { totals } from '../src/game/explore';

/** 机器人：每隔一会儿看一眼，追最早落下、来得及的普通箭 / 箭捆；skill 越低看得越慢、对得越偏 */
function play(seed: number, skill: number) {
  const rnd = mulberry(seed), g = newGame(makeSchedule(rnd));
  let target = 0, think = 0;
  while (!isOver(g)) {
    think -= 1 / 60;
    if (think <= 0) {
      think = 0.15 + (1 - skill) * 0.8;
      const land = (s: Shot) => s.t + s.fall * (1 - CATCH_Y) - g.t;
      const pick = g.plan.filter((s) => !g.done.has(s.id) && heightOf(s, g.t) != null && s.kind !== 'fire' && Math.abs(s.x - g.boat) - BOAT_HALF < land(s) * BOAT_SPEED).sort((a, b) => land(a) - land(b))[0];
      target = pick ? pick.x + (rnd() - 0.5) * (1 - skill) * 0.5 : g.boat;
    }
    const d = target - g.boat; step(g, Math.abs(d) < 0.03 ? 0 : Math.sign(d), 1 / 60);
  }
  return g;
}

describe('草船借箭', () => {
  it('出场表：时间递增、在局内、落点在江面上，越往后越快；种子固定', () => {
    for (let s = 1; s <= 30; s++) {
      const p = makeSchedule(mulberry(s));
      expect(p.length).toBeGreaterThan(35);
      for (let i = 0; i < p.length; i++) { expect(Math.abs(p[i].x)).toBeLessThanOrEqual(0.9); expect(p[i].t).toBeLessThan(DURATION); if (i) expect(p[i].t).toBeGreaterThan(p[i - 1].t); }
      expect(p[p.length - 1].fall).toBeLessThan(p[0].fall);
    }
    expect(makeSchedule(mulberry(5))).toEqual(makeSchedule(mulberry(5)));
  });
  it('船在江面里左右动；中火箭扣分并让船变慢', () => {
    const g = newGame([{ id: 0, t: 0, x: 0, kind: 'fire', fall: 1 }, { id: 1, t: 0.2, x: 0.95, kind: 'arrow', fall: 1 }]);
    g.score = 5;
    step(g, 0, 0.95);
    expect(g.score).toBe(2); expect(g.burn).toBeGreaterThan(0);
    const b = g.boat; step(g, 1, 0.1);
    expect(g.boat - b).toBeCloseTo(BOAT_SPEED * 0.45 * 0.1);
    for (let i = 0; i < 100; i++) step(g, 1, 0.05);
    expect(g.boat).toBeCloseTo(1 - BOAT_HALF);
  });
  it('接到箭加分、箭捆 +3；没接到的落水不扣分；每支只结算一次', () => {
    const g = newGame([{ id: 0, t: 0, x: 0.05, kind: 'arrow', fall: 1 }, { id: 1, t: 0, x: -0.05, kind: 'bundle', fall: 1 }, { id: 2, t: 0, x: 0.8, kind: 'arrow', fall: 1 }]);
    const r = step(g, 0, 1);
    expect(r.length).toBe(3);
    expect(g.score).toBe(4); expect(g.got).toBe(4);
    expect(step(g, 0, 1).length).toBe(0);
  });
  it('平衡：反应快的大多 2~3 星且 3 星明显多于反应慢的；反应慢的也能拿到 1~2 星', () => {
    const tiers = (k: number) => { const n = [0, 0, 0, 0]; for (let s = 1; s <= 200; s++) n[tierOf(play(s, k).score)]++; return n; };
    const good = tiers(1), slow = tiers(0.4);
    expect(good[2] + good[3]).toBeGreaterThan(160);
    expect(good[3]).toBeGreaterThan(slow[3] * 2);
    expect(slow[0]).toBeLessThan(10);
  });
  it('每天 RUNS_PER_DAY 局；奖励随档位递增；足迹累计借到的箭', () => {
    const s = newPlayer();
    for (let i = 0; i < RUNS_PER_DAY; i++) expect(useRun(s)).toBe(true);
    expect(useRun(s)).toBe(false); expect(runsLeft(s)).toBe(0);
    const g = [0, 1, 2, 3].map((t) => arrowsGain(s, t).fish);
    expect(g[0]).toBe(0); expect(g[1]).toBeLessThan(g[2]); expect(g[2]).toBeLessThan(g[3]);
    recordArrows(s, 7); expect(totals(s).arrows).toBe(7);
  });
});
