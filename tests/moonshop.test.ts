import { describe, expect, it } from 'vitest';
import { itemCount } from '../src/game/inventory';
import { MOON_OFFERS, buyMoon, ensureMoonShop, leftOf, moonDiscount, priceOf, weeklyLimit } from '../src/game/moonshop';
import { ITEMS } from '../src/content/items';
import { topUp } from '../src/game/premium';
import { newPlayer } from '../src/game/state';

const at = (day: number) => new Date(2026, 9, 5 + day, 12).getTime(); // 周一

describe('月光珠商铺', () => {
  it('商品都是已登记的道具（招福符除外），价格与限购为正', () => {
    const ids = new Set(ITEMS.map((i) => i.id));
    for (const o of MOON_OFFERS) { if (!o.tickets) expect(ids.has(o.item), o.id).toBe(true); expect(o.price).toBeGreaterThan(0); expect(o.weekly).toBeGreaterThan(0); }
    expect(new Set(MOON_OFFERS.map((o) => o.id)).size).toBe(MOON_OFFERS.length);
  });
  it('月光珠不够不能买；够了扣费发货；超过每周限购被拒；下周刷新', () => {
    const s = newPlayer(0);
    expect(buyMoon(s, 'ms_ticket', at(0)).ok).toBe(false);
    s.res.moon = 100000;
    const tickets = s.res.tickets;
    const r = buyMoon(s, 'ms_ticket', at(0));
    expect(r.ok && r.paid).toBe(50); expect(s.res.moon).toBe(99950); expect(s.res.tickets - tickets).toBe(1);
    for (let i = 1; i < 10; i++) expect(buyMoon(s, 'ms_ticket', at(0)).ok).toBe(true);
    expect(buyMoon(s, 'ms_ticket', at(0)).ok).toBe(false);
    expect(leftOf(s, MOON_OFFERS[0], at(7))).toBe(10);
    expect(buyMoon(s, 'ms_ticket', at(7)).ok).toBe(true);
    expect(buyMoon(s, 'nope', at(0)).ok).toBe(false);
    expect(buyMoon(s, 'ms_bone', at(0)).ok && itemCount(s, 'fishbone_large')).toBe(1);
  });
  it('VIP 折扣与限购加成随等级递增，每周限购 1 的大件不加限购', () => {
    const levels = [0, 3, 5, 8, 10, 12];
    for (let i = 1; i < levels.length; i++) {
      expect(moonDiscount(levels[i])).toBeGreaterThanOrEqual(moonDiscount(levels[i - 1]));
      expect(weeklyLimit(MOON_OFFERS[0], levels[i])).toBeGreaterThanOrEqual(weeklyLimit(MOON_OFFERS[0], levels[i - 1]));
    }
    const jade = MOON_OFFERS.find((o) => o.id === 'ms_jade')!;
    expect(weeklyLimit(jade, 12)).toBe(1);
    expect(priceOf(jade, 12)).toBeLessThan(jade.price);
    const s = newPlayer(0); topUp(s, 'moon648', at(0)); topUp(s, 'moon648', at(0)); // VIP 提升
    expect(ensureMoonShop(s, at(0)).bought).toEqual({});
  });
});
