import { describe, expect, it } from 'vitest';
import { GOOD_MS, LANES, NOTES, PERFECT_MS, REACH_MS, RUNS_PER_DAY, TIERS, accuracy, chimeGain, gradeOf, makeChart, matchTap, recordHits, runsLeft, tierOf, useRun } from '../src/game/windchime';
import { totals } from '../src/game/explore';
import { mulberry } from '../src/fx/util';
import { newPlayer } from '../src/game/state';

describe('风铃节奏规则', () => {
  it('谱子：32 个音符，时间递增，间隔 0.45~0.9 秒，轨道合法，同轨至少隔 0.3 秒，总长不超过 30 秒', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const c = makeChart(mulberry(seed));
      expect(c).toHaveLength(NOTES);
      const last = new Array(LANES).fill(-9);
      c.forEach((n, i) => {
        expect(n.lane).toBeGreaterThanOrEqual(0); expect(n.lane).toBeLessThan(LANES);
        if (i > 0) { const gap = n.t - c[i - 1].t; expect(gap).toBeGreaterThanOrEqual(0.449); expect(gap).toBeLessThanOrEqual(0.901); }
        expect(n.t - last[n.lane], `seed ${seed} 同轨太近`).toBeGreaterThanOrEqual(0.3 - 1e-6);
        last[n.lane] = n.t;
      });
      expect(c[0].t).toBeGreaterThanOrEqual(2.4); expect(c[c.length - 1].t).toBeLessThan(30);
    }
    expect(makeChart(mulberry(7))).toEqual(makeChart(mulberry(7)));
  });
  it('判定窗口：±80ms 完美，±170ms 好，再远算失误', () => {
    expect(gradeOf(0)).toBe('perfect'); expect(gradeOf(PERFECT_MS)).toBe('perfect'); expect(gradeOf(-PERFECT_MS)).toBe('perfect');
    expect(gradeOf(PERFECT_MS + 1)).toBe('good'); expect(gradeOf(GOOD_MS)).toBe('good'); expect(gradeOf(-GOOD_MS - 1)).toBe('miss');
  });
  it('点击匹配：只匹配同一轨道、最近的、还没处理的音符；太远返回 null', () => {
    const chart = [{ t: 3, lane: 0 }, { t: 3.5, lane: 1 }, { t: 4, lane: 0 }];
    expect(matchTap(chart, new Set(), 0, 3.02)).toEqual({ index: 0, grade: 'perfect' });
    expect(matchTap(chart, new Set(), 1, 3.02)).toBeNull(); // 3.5 的音符离 480ms，超出可及范围
    expect(matchTap(chart, new Set([0]), 0, 3.02)).toBeNull(); // 3.0 已处理；4.0 离 980ms
    expect(matchTap(chart, new Set([0]), 0, 3.95)?.index).toBe(2);
    expect(matchTap(chart, new Set(), 0, 3 - (GOOD_MS + 20) / 1000)?.grade).toBe('miss'); // 在可及范围里但超出「好」窗口：算失误并消耗这个音符
    expect(matchTap(chart, new Set(), 0, 3 - (REACH_MS + 20) / 1000)).toBeNull();
    expect(matchTap(chart, new Set(), 2, 3)).toBeNull();
  });
  it('提早 / 滞后同样判定（前后对称）', () => {
    const chart = [{ t: 5, lane: 2 }];
    expect(matchTap(chart, new Set(), 2, 5 - 0.05)?.grade).toBe('perfect');
    expect(matchTap(chart, new Set(), 2, 5 + 0.05)?.grade).toBe('perfect');
    expect(matchTap(chart, new Set(), 2, 5 - 0.12)?.grade).toBe('good');
    expect(matchTap(chart, new Set(), 2, 5 + 0.12)?.grade).toBe('good');
  });
  it('命中率与档位：全完美 100%；全「好」只有 60%（2 档，拿不到 3 档）；一半命中拿不到档', () => {
    expect(accuracy(NOTES, 0)).toBe(1);
    expect(tierOf(accuracy(NOTES, 0))).toBe(3);
    expect(tierOf(accuracy(0, NOTES))).toBe(1);
    expect(tierOf(accuracy(0, NOTES / 2))).toBe(0);
    expect(tierOf(accuracy(20, 12))).toBe(2);
    expect(TIERS).toEqual([0.5, 0.7, 0.88]);
  });
  it('档位越高奖励越多；3 档带猫薄荷和金铃铛；奖励随主线进度涨', () => {
    const s = newPlayer(), late = newPlayer(); late.best = { chapter: 3, index: 12 };
    const g = [0, 1, 2, 3].map((t) => chimeGain(s, t));
    expect(g[0].fish).toBe(0);
    for (let i = 1; i < 4; i++) expect(g[i].fish).toBeGreaterThan(g[i - 1].fish);
    expect(g[3].bells).toBeGreaterThan(0); expect(g[2].bells).toBe(0);
    expect(chimeGain(late, 3).fish).toBeGreaterThan(g[3].fish);
  });
  it('每天 6 局，隔天刷新；命中数累计（0 不计）', () => {
    const s = newPlayer(); const t0 = Date.UTC(2026, 9, 11, 12);
    for (let i = 0; i < RUNS_PER_DAY; i++) expect(useRun(s, t0)).toBe(true);
    expect(useRun(s, t0)).toBe(false);
    expect(runsLeft(s, t0 + 86400_000)).toBe(RUNS_PER_DAY);
    recordHits(s, 0); expect(totals(s).chime ?? 0).toBe(0);
    recordHits(s, 25); expect(totals(s).chime).toBe(25);
  });
});
