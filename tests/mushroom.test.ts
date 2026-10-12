import { describe, expect, it } from 'vitest';
import { CELLS, DURATION, LIFE, RUNS_PER_DAY, SCORE, TIERS, makeSchedule, mushroomGain, recordPicked, runsLeft, tierOf, useRun } from '../src/game/mushroom';
import { totals } from '../src/game/explore';
import { mulberry } from '../src/fx/util';
import { newPlayer } from '../src/game/state';

describe('采蘑菇规则', () => {
  it('出场表：按时间排序、都在一局时间内、格子合法，同一格不会在蘑菇还没缩回去时再冒', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const sc = makeSchedule(mulberry(seed));
      expect(sc.length).toBeGreaterThan(25);
      const until = new Array(CELLS).fill(-1);
      let last = 0;
      for (const sp of sc) {
        expect(sp.t).toBeGreaterThanOrEqual(last); last = sp.t;
        expect(sp.t).toBeLessThan(DURATION); expect(sp.t + sp.life).toBeLessThanOrEqual(DURATION + 1);
        expect(sp.cell).toBeGreaterThanOrEqual(0); expect(sp.cell).toBeLessThan(CELLS);
        expect(sp.t, `seed ${seed} 同一格重叠`).toBeGreaterThanOrEqual(until[sp.cell]);
        expect(sp.life).toBe(LIFE[sp.kind]);
        until[sp.cell] = sp.t + sp.life;
      }
    }
  });
  it('同一个随机种子出场表一样；种类比例大致是 普通 62% / 金 16% / 毒 22%', () => {
    expect(makeSchedule(mulberry(9))).toEqual(makeSchedule(mulberry(9)));
    const c = { normal: 0, gold: 0, poison: 0 }; let n = 0;
    for (let seed = 1; seed <= 80; seed++) for (const sp of makeSchedule(mulberry(seed))) { c[sp.kind]++; n++; }
    expect(c.normal / n).toBeGreaterThan(0.55); expect(c.normal / n).toBeLessThan(0.69);
    expect(c.gold / n).toBeGreaterThan(0.1); expect(c.gold / n).toBeLessThan(0.22);
    expect(c.poison / n).toBeGreaterThan(0.16); expect(c.poison / n).toBeLessThan(0.28);
  });
  it('难度合理：全部好蘑菇都点中能拿满 3 档，但只点一半拿不到；点了毒蘑菇会明显掉分', () => {
    let full = 0, half = 0, withPoison = 0; const N = 40;
    for (let seed = 1; seed <= N; seed++) {
      const sc = makeSchedule(mulberry(seed));
      const good = sc.filter((x) => x.kind !== 'poison').reduce((a, x) => a + SCORE[x.kind], 0);
      full += good; half += good / 2; withPoison += good - sc.filter((x) => x.kind === 'poison').length * 3;
    }
    expect(tierOf(full / N)).toBe(3);
    expect(tierOf(half / N)).toBeLessThan(3);
    expect(withPoison / N).toBeLessThan(full / N - 10);
  });
  it('档位：分数线 10 / 20 / 30；负分是 0 档', () => {
    expect(TIERS).toEqual([10, 20, 30]);
    expect([-5, 0, 9, 10, 19, 20, 29, 30, 99].map(tierOf)).toEqual([0, 0, 0, 1, 1, 2, 2, 3, 3]);
  });
  it('档位越高奖励越多；3 档带猫薄荷和金铃铛；奖励随主线进度涨', () => {
    const s = newPlayer(), late = newPlayer(); late.best = { chapter: 3, index: 12 };
    const g = [0, 1, 2, 3].map((t) => mushroomGain(s, t));
    expect(g[0].fish).toBe(0);
    for (let i = 1; i < 4; i++) expect(g[i].fish).toBeGreaterThan(g[i - 1].fish);
    expect(g[3].catnip).toBeGreaterThan(g[2].catnip); expect(g[3].bells).toBeGreaterThan(0); expect(g[2].bells).toBe(0);
    expect(mushroomGain(late, 3).fish).toBeGreaterThan(g[3].fish);
  });
  it('每天 6 局，隔天刷新；采到的蘑菇累计（0 不计）', () => {
    const s = newPlayer(); const t0 = Date.UTC(2026, 9, 11, 12);
    for (let i = 0; i < RUNS_PER_DAY; i++) expect(useRun(s, t0)).toBe(true);
    expect(useRun(s, t0)).toBe(false);
    expect(runsLeft(s, t0 + 86400_000)).toBe(RUNS_PER_DAY);
    recordPicked(s, 0); expect(totals(s).mush ?? 0).toBe(0);
    recordPicked(s, 17); expect(totals(s).mush).toBe(17);
  });
});
