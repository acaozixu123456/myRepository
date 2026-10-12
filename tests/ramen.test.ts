import { describe, expect, it } from 'vitest';
import { BOIL_ZONE, CUSTOMERS, ORDERS_PER_DAY, TOPPINGS, judgeBoil, judgeToppings, makeOrder, markerPos, ordersLeft, ramenGain, recordBowl, stars, useOrder } from '../src/game/ramen';
import { totals } from '../src/game/explore';
import { mulberry } from '../src/fx/util';
import { newPlayer } from '../src/game/state';

describe('拉面屋台规则', () => {
  it('一张单是 3 种不同的配料', () => {
    const r = mulberry(5);
    for (let i = 0; i < 100; i++) { const o = makeOrder(r); expect(o).toHaveLength(3); expect(new Set(o).size).toBe(3); for (const t of o) expect(TOPPINGS).toContain(t); }
  });
  it('加料判定：按顺序点对才前进，点错记失误，多点的不算', () => {
    const o = ['叉烧', '溏心蛋', '海苔'] as const;
    expect(judgeToppings(o, ['叉烧', '溏心蛋', '海苔'])).toEqual({ complete: true, mistakes: 0 });
    expect(judgeToppings(o, ['叉烧', '葱花', '溏心蛋', '海苔'])).toEqual({ complete: true, mistakes: 1 });
    expect(judgeToppings(o, ['溏心蛋', '叉烧'])).toEqual({ complete: false, mistakes: 1 });
    expect(judgeToppings(o, [])).toEqual({ complete: false, mistakes: 0 });
    expect(judgeToppings(o, ['叉烧', '溏心蛋', '海苔', '葱花', '鱼板'])).toEqual({ complete: true, mistakes: 0 });
  });
  it('起锅判定：绿区正中完美，绿区内算好，绿区外失手', () => {
    expect(judgeBoil(BOIL_ZONE.center)).toBe('perfect');
    expect(judgeBoil(BOIL_ZONE.center + BOIL_ZONE.half * 0.9)).toBe('good');
    expect(judgeBoil(BOIL_ZONE.center - BOIL_ZONE.half * 0.9)).toBe('good');
    expect(judgeBoil(BOIL_ZONE.center + BOIL_ZONE.half * 1.2)).toBe('miss');
    expect(judgeBoil(0)).toBe('miss'); expect(judgeBoil(1)).toBe('miss');
  });
  it('标记是三角波：始终在 0~1，一个周期回到起点，半周期到另一端', () => {
    for (let t = -3; t < 6; t += 0.07) { const p = markerPos(t); expect(p).toBeGreaterThanOrEqual(0); expect(p).toBeLessThanOrEqual(1); }
    expect(markerPos(0)).toBeCloseTo(0); expect(markerPos(0.8)).toBeCloseTo(1); expect(markerPos(1.6)).toBeCloseTo(0);
  });
  it('星级：没做完 0；做完 1；零失误 +1；起锅完美 +1；起锅失手最多 1', () => {
    const ok = { complete: true, mistakes: 0 }, slip = { complete: true, mistakes: 2 }, no = { complete: false, mistakes: 0 };
    expect(stars(no, 'perfect')).toBe(0);
    expect(stars(ok, null)).toBe(0);
    expect(stars(ok, 'perfect')).toBe(3);
    expect(stars(ok, 'good')).toBe(2);
    expect(stars(slip, 'perfect')).toBe(2);
    expect(stars(slip, 'good')).toBe(1);
    expect(stars(ok, 'miss')).toBe(1);
  });
  it('星越高奖励越多；3 星带猫薄荷和金铃铛；奖励随主线进度涨', () => {
    const early = newPlayer(), late = newPlayer(); late.best = { chapter: 3, index: 12 };
    const g = [0, 1, 2, 3].map((n) => ramenGain(early, n));
    expect(g[0].fish).toBe(0);
    for (let i = 1; i < 4; i++) expect(g[i].fish).toBeGreaterThan(g[i - 1].fish);
    expect(g[3].catnip + g[3].bells).toBeGreaterThan(0);
    expect(g[2].catnip + g[2].bells).toBe(0);
    expect(ramenGain(late, 3).fish).toBeGreaterThan(g[3].fish);
  });
  it('每天最多 12 碗，隔天刷新', () => {
    const s = newPlayer(); const t0 = Date.UTC(2026, 9, 11, 12);
    for (let i = 0; i < ORDERS_PER_DAY; i++) expect(useOrder(s, t0)).toBe(true);
    expect(useOrder(s, t0)).toBe(false);
    expect(ordersLeft(s, t0)).toBe(0);
    expect(ordersLeft(s, t0 + 86400_000)).toBe(ORDERS_PER_DAY);
  });
  it('只有拿到星才计入累计；客人名字都不重复', () => {
    const s = newPlayer();
    recordBowl(s, 0); expect(totals(s).ramen ?? 0).toBe(0);
    recordBowl(s, 2); recordBowl(s, 3); expect(totals(s).ramen).toBe(2);
    expect(new Set(CUSTOMERS.map((c) => c.name)).size).toBe(CUSTOMERS.length);
  });
});
