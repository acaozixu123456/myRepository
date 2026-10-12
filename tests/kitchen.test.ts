import { describe, expect, it } from 'vitest';
import { BIG_AT, DURATION, FOODS, PENALTY, RUNS_PER_DAY, elapsed, isOver, kitchenGain, newKitchen, recordServed, runsLeft, tap, tierOf, useRun } from '../src/game/kitchen';
import type { Food } from '../src/game/kitchen';
import { mulberry } from '../src/fx/util';
import { newPlayer } from '../src/game/state';
import { totals } from '../src/game/explore';

/** 机器人：每 react 秒点一下，有 err 的概率点错 */
function play(seed: number, react: number, err: number) {
  const rnd = mulberry(seed), k = newKitchen(mulberry(seed * 7 + 1));
  let now = 0;
  while (true) {
    now += react * (0.75 + rnd() * 0.5);
    if (isOver(k, now)) break;
    const left = k.order.need.filter((f) => !k.order.got.includes(f));
    const f: Food = rnd() < err ? FOODS.find((x) => !left.includes(x))! : left[0];
    tap(k, f, now);
  }
  return k;
}

describe('御膳房配菜', () => {
  it('菜单不重样、样数 3 → 4；点齐上菜，换下一张', () => {
    const k = newKitchen(mulberry(3));
    expect(new Set(k.order.need).size).toBe(3);
    const need = [...k.order.need];
    expect(tap(k, need[0], 0.5)).toBe('ok');
    expect(tap(k, need[1], 1)).toBe('ok');
    expect(tap(k, need[2], 1.5)).toBe('fast');
    expect(k.served).toBe(1); expect(k.score).toBe(5);
    expect(k.order.got).toEqual([]);
    const need2 = [...k.order.need];
    for (const f of need2) tap(k, f, BIG_AT + 1);
    expect(k.order.need.length).toBe(4);
  });
  it('点错或重复点扣时间，满时间就结束', () => {
    const k = newKitchen(mulberry(4));
    const wrong = FOODS.find((f) => !k.order.need.includes(f))!;
    expect(tap(k, wrong, 1)).toBe('wrong');
    tap(k, k.order.need[0], 2);
    expect(tap(k, k.order.need[0], 3)).toBe('wrong');
    expect(elapsed(k, 3)).toBeCloseTo(3 + PENALTY * 2);
    expect(isOver(k, DURATION - PENALTY * 2)).toBe(true);
    expect(tap(k, k.order.need[1], DURATION)).toBe('over');
  });
  it('平衡：手快的大多 2~3 星，手慢的也能拿星；乱点没有好处', () => {
    const tiers = (r: number, e: number) => { const n = [0, 0, 0, 0]; for (let s = 1; s <= 200; s++) n[tierOf(play(s, r, e).score)]++; return n; };
    const fast = tiers(0.45, 0.05), slow = tiers(0.8, 0.12), wild = tiers(0.2, 0.6);
    console.log('kitchen tiers', fast, slow, wild);
    expect(fast[2] + fast[3]).toBeGreaterThan(160);
    expect(fast[3]).toBeGreaterThan(slow[3] * 2);
    expect(slow[0]).toBeLessThan(20);
    expect(wild[3]).toBeLessThan(fast[3]);
  });
  it('每天 RUNS_PER_DAY 局；奖励随档位递增；足迹累计上的菜', () => {
    const s = newPlayer();
    for (let i = 0; i < RUNS_PER_DAY; i++) expect(useRun(s)).toBe(true);
    expect(useRun(s)).toBe(false); expect(runsLeft(s)).toBe(0);
    expect(kitchenGain(s, 2).fish).toBeGreaterThan(kitchenGain(s, 1).fish);
    recordServed(s, 4); recordServed(s, 2);
    expect(totals(s).kitchen).toBe(6);
  });
});
