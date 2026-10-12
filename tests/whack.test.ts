import { describe, expect, it } from 'vitest';
import { DURATION, HIT_R, LANES, RUNS_PER_DAY, comboMul, escapes, makeSchedule, newGame, posOf, recordCaught, runsLeft, tap, tierOf, useRun, whackGain } from '../src/game/whack';
import type { Runner } from '../src/game/whack';
import { mulberry } from '../src/fx/util';
import { newPlayer } from '../src/game/state';
import { totals } from '../src/game/explore';

/** 机器人：每只鼠标以概率 p 在它跑到 20%~80% 时点下去，手偏 ±0.04 */
function play(seed: number, p: number) {
  const rnd = mulberry(seed), plan = makeSchedule(rnd), g = newGame(plan);
  const ev: [number, Runner][] = [];
  for (const r of plan) if (r.kind !== 'robot' && rnd() < p) ev.push([r.t + r.cross * (0.2 + rnd() * 0.6), r]);
  ev.sort((a, b) => a[0] - b[0]);
  let prev = 0;
  for (const [t, r] of ev) { escapes(g, prev, t); prev = t; tap(g, r.lane, posOf(r, t)! + (rnd() - 0.5) * 0.08, t); }
  escapes(g, prev, DURATION + 5);
  return g;
}

describe('网咖鼠标大作战', () => {
  it('出场表：时间递增、在局内、跑道合法；同一跑道不会挤在一起；种子固定', () => {
    for (let s = 1; s <= 30; s++) {
      const plan = makeSchedule(mulberry(s));
      expect(plan.length).toBeGreaterThan(25);
      for (let i = 0; i < plan.length; i++) {
        const r = plan[i];
        expect(r.lane).toBeGreaterThanOrEqual(0); expect(r.lane).toBeLessThan(LANES);
        expect(r.t).toBeLessThan(DURATION);
        if (i) expect(r.t).toBeGreaterThanOrEqual(plan[i - 1].t);
        const prev = plan.slice(0, i).filter((q) => q.lane === r.lane).pop();
        if (prev) expect(r.t).toBeGreaterThanOrEqual(prev.t + prev.cross * 0.55 - 1e-6);
      }
    }
    let withGold = 0; for (let s = 1; s <= 30; s++) if (makeSchedule(mulberry(s)).some((r) => r.kind === 'gold')) withGold++;
    expect(withGold).toBeGreaterThan(26);
    expect(makeSchedule(mulberry(9))).toEqual(makeSchedule(mulberry(9)));
  });
  it('点中：在判定范围内才算，同一只只能点一次；机器人扣分并断连击', () => {
    const plan: Runner[] = [{ id: 0, t: 0, lane: 1, kind: 'mouse', dir: 1, cross: 2 }, { id: 1, t: 0, lane: 2, kind: 'robot', dir: -1, cross: 2 }];
    const g = newGame(plan), x = posOf(plan[0], 1)!;
    expect(tap(g, 1, x + HIT_R + 0.01, 1).r).toBeNull();
    expect(tap(g, 0, x, 1).r).toBeNull();
    expect(tap(g, 1, x, 1)).toEqual({ r: plan[0], delta: 1 });
    expect(tap(g, 1, x, 1).r).toBeNull();
    expect(g.combo).toBe(1);
    expect(tap(g, 2, posOf(plan[1], 1)!, 1).delta).toBe(-3);
    expect(g.combo).toBe(0); expect(g.score).toBe(0);
  });
  it('连击倍率：每 5 连 +0.5，最多 ×3；鼠标跑掉会断连击', () => {
    expect(comboMul(1)).toBe(1); expect(comboMul(5)).toBe(1.5); expect(comboMul(40)).toBe(3);
    const g = newGame([{ id: 0, t: 0, lane: 0, kind: 'mouse', dir: 1, cross: 1 }]);
    g.combo = 7;
    expect(escapes(g, 0, 0.5)).toBe(0); expect(g.combo).toBe(7);
    expect(escapes(g, 0.5, 1.2)).toBe(1); expect(g.combo).toBe(0);
  });
  it('平衡：手快全抓的稳拿 3 星；漏一半的大多 1~2 星', () => {
    const tiers = (p: number) => { const n = [0, 0, 0, 0]; for (let s = 1; s <= 200; s++) n[tierOf(play(s, p).score)]++; return n; };
    expect(tiers(1)[3]).toBe(200);
    const half = tiers(0.5);
    expect(half[3]).toBeLessThan(20);
    expect(half[1] + half[2]).toBeGreaterThan(120);
  });
  it('每天 RUNS_PER_DAY 局；奖励随档位递增；足迹累计抓到的个数', () => {
    const s = newPlayer();
    for (let i = 0; i < RUNS_PER_DAY; i++) expect(useRun(s)).toBe(true);
    expect(useRun(s)).toBe(false); expect(runsLeft(s)).toBe(0);
    const g = [0, 1, 2, 3].map((t) => whackGain(s, t).fish);
    expect(g[0]).toBe(0); expect(g[1]).toBeLessThan(g[2]); expect(g[2]).toBeLessThan(g[3]);
    recordCaught(s, 5); expect(totals(s).whack).toBe(5);
  });
});
