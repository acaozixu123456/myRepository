import { describe, expect, it } from 'vitest';
import { ALL_BONUS, CLAMS, CRABS, CRAB_COST, DIGS, RUNS_PER_DAY, SIZE, bubbles, clamsGain, dig, neighbors, newBeach, recordClams, runsLeft, scoreOf, tierOf, useRun } from '../src/game/clams';
import type { Beach } from '../src/game/clams';
import { mulberry } from '../src/fx/util';
import { newPlayer } from '../src/game/state';
import { totals } from '../src/game/explore';

/** 会推理的机器人：按已露出的气泡数估每格有蛤蜊的概率，挑最可能的挖（0 气泡周围的格子肯定没有） */
function smart(b: Beach, rnd: () => number): number {
  const N = SIZE * SIZE, left = CLAMS - b.found;
  const unknown = b.cells.map((_, i) => i).filter((i) => !b.dug[i]);
  const prior = left / Math.max(1, unknown.length);
  let best = -1, bp = -1;
  for (const i of unknown) {
    const ests: number[] = [];
    for (const n of neighbors(i)) {
      if (!b.dug[n] || b.cells[n] !== 'sand') continue;
      const nb = neighbors(n), known = nb.filter((m) => b.dug[m] && b.cells[m] === 'clam').length, open = nb.filter((m) => !b.dug[m]).length;
      ests.push(open ? (bubbles(b, n) - known) / open : 0);
    }
    const p = ests.length ? (Math.min(...ests) === 0 ? 0 : ests.reduce((a, x) => a + x, 0) / ests.length) : prior;
    const v = p + rnd() * 0.01;
    if (v > bp) { bp = v; best = i; }
  }
  void N;
  return best;
}
function play(seed: number, mode: 'smart' | 'random') {
  const rnd = mulberry(seed), b = newBeach(mulberry(seed * 11 + 3));
  while (!b.over) {
    const free = b.cells.map((_, i) => i).filter((i) => !b.dug[i]);
    dig(b, mode === 'smart' ? smart(b, rnd) : free[Math.floor(rnd() * free.length)]);
  }
  return b;
}

describe('赶海挖蛤蜊', () => {
  it('沙地里正好 CLAMS 只蛤蜊、CRABS 只螃蟹；种子固定', () => {
    for (let s = 1; s <= 20; s++) { const b = newBeach(mulberry(s)); expect(b.cells.filter((c) => c === 'clam').length).toBe(CLAMS); expect(b.cells.filter((c) => c === 'crab').length).toBe(CRABS); }
    expect(newBeach(mulberry(7)).cells).toEqual(newBeach(mulberry(7)).cells);
  });
  it('邻格：角 3、边 5、中间 8；气泡数 = 周围蛤蜊数', () => {
    expect(neighbors(0).length).toBe(3); expect(neighbors(2).length).toBe(5); expect(neighbors(SIZE + 1).length).toBe(8);
    const b = newBeach(mulberry(1));
    for (let i = 0; i < SIZE * SIZE; i++) expect(bubbles(b, i)).toBe(neighbors(i).filter((n) => b.cells[n] === 'clam').length);
  });
  it('挖一格扣一铲，螃蟹再扣；同一格不能挖两次；铲子用完结束', () => {
    const b = newBeach(mulberry(2));
    const crab = b.cells.indexOf('crab'), clam = b.cells.indexOf('clam');
    expect(dig(b, clam)).toBe('clam'); expect(b.found).toBe(1); expect(b.digs).toBe(DIGS - 1);
    expect(dig(b, clam)).toBe('already'); expect(b.digs).toBe(DIGS - 1);
    expect(dig(b, crab)).toBe('crab'); expect(b.digs).toBe(DIGS - 2 - CRAB_COST);
    let i = 0; while (!b.over) { if (!b.dug[i]) dig(b, i); i++; }
    expect(b.digs).toBe(0);
  });
  it('全部挖到有奖励分', () => {
    const b = newBeach(mulberry(4));
    b.cells.forEach((c, i) => { if (c === 'clam') dig(b, i); });
    expect(b.over).toBe(true); expect(scoreOf(b)).toBe(CLAMS * 2 + ALL_BONUS + DIGS - CLAMS);
  });
  it('平衡：会推理的大多 2~3 星且 3 星明显多于乱挖的；乱挖的也常有星', () => {
    const tiers = (m: 'smart' | 'random') => { const n = [0, 0, 0, 0]; for (let s = 1; s <= 200; s++) n[tierOf(scoreOf(play(s, m)))]++; return n; };
    const good = tiers('smart'), rand = tiers('random');
    console.log('clams tiers', good, rand);
    expect(good[2] + good[3]).toBeGreaterThan(140);
    expect(good[3]).toBeGreaterThan(rand[3] * 2);
    expect(rand[0]).toBeLessThan(100);
  });
  it('每天 RUNS_PER_DAY 局；奖励随档位递增；足迹累计蛤蜊', () => {
    const s = newPlayer();
    for (let i = 0; i < RUNS_PER_DAY; i++) expect(useRun(s)).toBe(true);
    expect(useRun(s)).toBe(false); expect(runsLeft(s)).toBe(0);
    expect(clamsGain(s, 2).fish).toBeGreaterThan(clamsGain(s, 1).fish);
    recordClams(s, 3); recordClams(s, 4);
    expect(totals(s).clams).toBe(7);
  });
});
