import { describe, expect, it } from 'vitest';
import { DURATION, HEARTS, HEART_BONUS, LANES, RUNS_PER_DAY, finalScore, isHazard, isOver, makeCourse, newGame, recordSled, runsLeft, sledGain, speedAt, steer, step, tierOf, useRun } from '../src/game/sled';
import type { Row } from '../src/game/sled';
import { mulberry } from '../src/fx/util';
import { newPlayer } from '../src/game/state';
import { totals } from '../src/game/explore';

/** 机器人：看最近的下一排，提前 react 秒以上才来得及换到那一排最好的道（每次挪一道） */
function play(seed: number, react: number, slip: number) {
  const rnd = mulberry(seed), g = newGame(makeCourse(mulberry(seed * 3 + 1)));
  let think = 0;
  while (!isOver(g)) {
    think -= 1 / 30;
    if (think <= 0) {
      think = 0.08;
      // 只对还来得及反应的最近一排做决定；已经来不及的那排就保持原道
      const next: Row | undefined = g.course[g.done];
      const far = next && next.d - g.pos > speedAt(g.t) * react;
      if (next && far) {
        const val = (l: number) => { const it = next.items.find((x) => x.lane === l); return !it ? 0 : isHazard(it.kind) ? -10 : it.kind === 'bell' ? 3 : it.kind === 'gate' ? 2 : 1; };
        let best = g.lane; for (let l = 0; l < LANES; l++) if (val(l) - Math.abs(l - g.lane) * 0.1 > val(best) - Math.abs(best - g.lane) * 0.1) best = l;
        if (rnd() < slip) best = Math.floor(rnd() * LANES);
        if (best !== g.lane) steer(g, best - g.lane);
      }
    }
    step(g, 1 / 30);
  }
  return g;
}

describe('雪橇滑坡', () => {
  it('雪道：每排至少一条空道、障碍最多两个，越往后越难；种子固定', () => {
    for (let s = 1; s <= 30; s++) {
      const c = makeCourse(mulberry(s));
      expect(c.length).toBeGreaterThan(28);
      for (let i = 0; i < c.length; i++) {
        const haz = c[i].items.filter((x) => isHazard(x.kind));
        expect(haz.length).toBeLessThanOrEqual(2);
        expect(new Set(c[i].items.map((x) => x.lane)).size).toBe(c[i].items.length);
        if (i) expect(c[i].d).toBeGreaterThan(c[i - 1].d + 4);
      }
      expect(c[c.length - 1].d).toBeGreaterThan(7 * DURATION);
    }
    expect(makeCourse(mulberry(9))).toEqual(makeCourse(mulberry(9)));
  });
  it('换道不出界；撞障碍扣心并减速，接小鱼干加分；心没了就结束', () => {
    const g = newGame([{ id: 0, d: 1, items: [{ lane: 1, kind: 'tree' }] }, { id: 1, d: 2, items: [{ lane: 1, kind: 'fish' }] }, { id: 2, d: 3, items: [{ lane: 1, kind: 'rock' }] }, { id: 3, d: 4, items: [{ lane: 1, kind: 'rock' }] }]);
    steer(g, -1); steer(g, -1); expect(g.lane).toBe(0); steer(g, 1); expect(g.lane).toBe(1);
    step(g, 0.2);
    expect(g.hearts).toBe(HEARTS - 1); expect(g.stun).toBeGreaterThan(0);
    const p = g.pos; step(g, 0.1); expect(g.pos - p).toBeCloseTo(speedAt(g.t) * 0.5 * 0.1, 1);
    for (let i = 0; i < 20; i++) step(g, 0.1);
    expect(g.fish).toBe(1); expect(g.hearts).toBe(0); expect(isOver(g)).toBe(true);
    expect(finalScore(g)).toBe(1);
  });
  it('滑到底剩下的心加分', () => {
    const g = newGame([]);
    for (let i = 0; i < DURATION * 10 + 1; i++) step(g, 0.1);
    expect(isOver(g)).toBe(true); expect(finalScore(g)).toBe(HEARTS * HEART_BONUS);
  });
  it('平衡：反应快的大多 2~3 星且 3 星明显多于反应慢的；反应慢的也能拿星', () => {
    const tiers = (r: number, sl: number) => { const n = [0, 0, 0, 0]; for (let s = 1; s <= 200; s++) n[tierOf(finalScore(play(s, r, sl)))]++; return n; };
    const good = tiers(0.45, 0.02), slow = tiers(0.7, 0.08);
    console.log('sled tiers', good, slow);
    expect(good[2] + good[3]).toBeGreaterThan(160);
    expect(good[3]).toBeGreaterThan(slow[3] * 2);
    expect(slow[0]).toBeLessThan(25);
  });
  it('每天 RUNS_PER_DAY 局；奖励随档位递增；足迹累计滑行距离', () => {
    const s = newPlayer();
    for (let i = 0; i < RUNS_PER_DAY; i++) expect(useRun(s)).toBe(true);
    expect(useRun(s)).toBe(false); expect(runsLeft(s)).toBe(0);
    expect(sledGain(s, 2).fish).toBeGreaterThan(sledGain(s, 1).fish);
    recordSled(s, 120.4); recordSled(s, 80);
    expect(totals(s).sled).toBe(200);
  });
});
