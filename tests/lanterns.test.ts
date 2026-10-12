import { describe, expect, it } from 'vitest';
import { ALL, CELLS, PUZZLES, RUNS_PER_DAY, lanternGain, lit, makePuzzle, minMoves, recordSolved, runsLeft, solved, stars, tap, useRun } from '../src/game/lanterns';
import { totals } from '../src/game/explore';
import { mulberry } from '../src/fx/util';
import { newPlayer } from '../src/game/state';

describe('点灯规则', () => {
  it('点一盏会翻转它和上下左右：角 3 盏、边 4 盏、中心 5 盏；点两次等于没点', () => {
    const flipped = (i: number) => { const s = tap(ALL, i); return Array.from({ length: CELLS }, (_, k) => k).filter((k) => !lit(s, k)).length; };
    expect([0, 2, 6, 8].map(flipped)).toEqual([3, 3, 3, 3]);
    expect([1, 3, 5, 7].map(flipped)).toEqual([4, 4, 4, 4]);
    expect(flipped(4)).toBe(5);
    for (let i = 0; i < CELLS; i++) expect(tap(tap(0b101010101, i), i)).toBe(0b101010101);
    expect(solved(ALL)).toBe(true); expect(solved(ALL ^ 1)).toBe(false);
  });
  it('点的顺序无关（所以最少步数可以穷举点法）', () => {
    expect(tap(tap(0b110011001, 2), 7)).toBe(tap(tap(0b110011001, 7), 2));
  });
  it('3×3 的每一种灯阵都有解（512 种全部能在 ≤ 9 步解开）', () => {
    for (let s = 0; s < 1 << CELLS; s++) { const m = minMoves(s); expect(Number.isFinite(m), `灯阵 ${s} 无解`).toBe(true); expect(m).toBeLessThanOrEqual(CELLS); }
    expect(minMoves(ALL)).toBe(0);
  });
  it('出题：一定有解，最少步数 ≥ 2，三道题一道比一道难（上限递增），并且题不是已经解开的', () => {
    const r = mulberry(21);
    for (let level = 1; level <= PUZZLES; level++) for (let k = 0; k < 60; k++) {
      const p = makePuzzle(level, r);
      expect(solved(p.start)).toBe(false);
      expect(p.par).toBe(minMoves(p.start));
      expect(p.par).toBeGreaterThanOrEqual(2); expect(p.par).toBeLessThanOrEqual(level + 2);
    }
    const avg = (lv: number) => { const rr = mulberry(5); let t = 0; for (let k = 0; k < 120; k++) t += makePuzzle(lv, rr).par; return t / 120; };
    expect(avg(3)).toBeGreaterThan(avg(1));
  });
  it('星级：没解完 0；多点 0 步 3 星；≤3 步 2 星；更多 1 星', () => {
    expect([stars(false, 0), stars(true, 0), stars(true, 1), stars(true, 3), stars(true, 4), stars(true, 20)]).toEqual([0, 3, 2, 2, 1, 1]);
  });
  it('星越多奖励越多；3 星带猫薄荷和金铃铛；奖励随主线进度涨', () => {
    const s = newPlayer(), late = newPlayer(); late.best = { chapter: 3, index: 12 };
    const g = [0, 1, 2, 3].map((t) => lanternGain(s, t));
    expect(g[0].fish).toBe(0);
    for (let i = 1; i < 4; i++) expect(g[i].fish).toBeGreaterThan(g[i - 1].fish);
    expect(g[3].bells).toBeGreaterThan(0); expect(g[2].bells).toBe(0);
    expect(lanternGain(late, 3).fish).toBeGreaterThan(g[3].fish);
  });
  it('每天 6 局，隔天刷新；点亮的题数累计（0 不计）', () => {
    const s = newPlayer(); const t0 = Date.UTC(2026, 9, 11, 12);
    for (let i = 0; i < RUNS_PER_DAY; i++) expect(useRun(s, t0)).toBe(true);
    expect(useRun(s, t0)).toBe(false);
    expect(runsLeft(s, t0 + 86400_000)).toBe(RUNS_PER_DAY);
    recordSolved(s, 0); expect(totals(s).lantern ?? 0).toBe(0);
    recordSolved(s, 3); expect(totals(s).lantern).toBe(3);
  });
});
