import { describe, expect, it } from 'vitest';
import { DISHES, DURATION, REACH, RUNS_PER_DAY, SEATS, SEAT_X, SERVE_PTS, WRONG_PTS, newBelt, recordSushi, runsLeft, step, sushiGain, tapPlate, tierOf, useRun } from '../src/game/sushi';
import type { Belt } from '../src/game/sushi';
import { mulberry } from '../src/fx/util';
import { newPlayer } from '../src/game/state';
import { totals } from '../src/game/explore';

/** 机器人：每 react 秒看一眼，点正好转到想吃它的客人面前的盘子；sloppy 的概率点错一个随便的盘子 */
function play(seed: number, react: number, sloppy = 0, random = false) {
  const rnd = mulberry(seed), game = mulberry(seed * 7 + 1), b = newBelt(game);
  let look = 0;
  while (!b.over) {
    step(b, 0.05, game); look -= 0.05;
    if (look > 0) continue;
    look = react;
    const vis = b.plates.filter((p) => p.x >= 0 && p.x <= 1);
    if (!vis.length) continue;
    if (random || rnd() < sloppy) { tapPlate(b, vis[Math.floor(rnd() * vis.length)].id, game); continue; }
    const hit = vis.find((p) => SEAT_X.some((sx, k) => Math.abs(p.x - sx) <= REACH * 0.8 && b.guests[k].dish === p.dish));
    if (hit) tapPlate(b, hit.id, game);
  }
  return b;
}

describe('回转寿司', () => {
  it('开局三位客人都有想吃的；盘子从右往左走、出画面就收走；时间到结束', () => {
    const b = newBelt(mulberry(1));
    expect(b.guests.length).toBe(SEATS);
    for (const g of b.guests) expect(DISHES).toContain(g.dish);
    const p0 = b.plates[0], x0 = p0.x;
    step(b, 0.5, mulberry(2));
    expect(p0.x).toBeLessThan(x0);
    for (let i = 0; i < DURATION * 20 + 10; i++) step(b, 0.05, mulberry(3));
    expect(b.over).toBe(true);
    expect(b.plates.every((p) => p.x > -0.12)).toBe(true);
  });
  it('盘子转到想吃它的客人面前时点才算上菜；不在面前或不是 TA 要的都算拿错', () => {
    const b: Belt = newBelt(mulberry(4));
    b.guests[0].dish = 'salmon'; b.guests[1].dish = 'salmon'; b.guests[2].dish = 'tuna';
    b.plates = [{ id: 90, dish: 'salmon', x: SEAT_X[1] + 0.03 }, { id: 91, dish: 'shrimp', x: SEAT_X[0] }, { id: 92, dish: 'tuna', x: 1.08 }, { id: 93, dish: 'tuna', x: (SEAT_X[0] + SEAT_X[1]) / 2 }];
    expect(tapPlate(b, 90, mulberry(1))).toMatchObject({ kind: 'serve', seat: 1 });
    expect(b.score).toBe(SERVE_PTS + 1);
    expect(b.guests[1].dish).toBeNull();
    expect(tapPlate(b, 91, mulberry(1))).toEqual({ kind: 'wrong' });
    expect(b.score).toBe(SERVE_PTS + 1 - WRONG_PTS);
    expect(tapPlate(b, 92, mulberry(1))).toEqual({ kind: 'none' }); // 还没进画面
    expect(tapPlate(b, 93, mulberry(1))).toEqual({ kind: 'wrong' }); // 两个座位中间，谁也够不着
    expect(b.plates.length).toBe(1);
  });
  it('耐心耗完客人走掉，过一会儿换新客人', () => {
    const b = newBelt(mulberry(5));
    b.guests[0].left = 0.1;
    step(b, 0.2, mulberry(6));
    expect(b.angry).toBe(1); expect(b.guests[0].dish).toBeNull();
    for (let i = 0; i < 20; i++) step(b, 0.05, mulberry(7));
    expect(b.guests[0].dish).not.toBeNull();
  });
  it('平衡：反应快的大多 3 星，一般的 2 星为主，乱点的拿不到 2 星', () => {
    const tiers = (react: number, sloppy = 0, random = false) => { const n = [0, 0, 0, 0]; for (let s = 1; s <= 120; s++) n[tierOf(play(s, react, sloppy, random).score)]++; return n; };
    const fast = tiers(0.4), mid = tiers(0.9, 0.08), rand = tiers(0.5, 0, true);
    const avg = (react: number) => { let a = 0; for (let s = 1; s <= 60; s++) a += play(s, react).score; return a / 60; };
    console.log('sushi tiers', fast, mid, rand, avg(0.4), avg(0.9));
    expect(fast[3]).toBeGreaterThan(80);
    expect(mid[2] + mid[3]).toBeGreaterThan(70);
    expect(mid[3]).toBeLessThan(fast[3]);
    expect(rand[2] + rand[3]).toBe(0);
  });
  it('每天 RUNS_PER_DAY 局；奖励随档位递增；足迹累计端出的盘数', () => {
    const s = newPlayer();
    for (let i = 0; i < RUNS_PER_DAY; i++) expect(useRun(s)).toBe(true);
    expect(useRun(s)).toBe(false); expect(runsLeft(s)).toBe(0);
    expect(sushiGain(s, 2).fish).toBeGreaterThan(sushiGain(s, 1).fish);
    recordSushi(s, 5); recordSushi(s, 6);
    expect(totals(s).sushi).toBe(11);
  });
});
