import { describe, expect, it } from 'vitest';
import { FURNITURE, NEST_FISH_PER_COMFORT, NEST_MAX_DAYS, buyFurniture, collectNest, comfortOf, ensureNest, nestDaysReady, nestPending } from '../src/game/nest';
import { newPlayer } from '../src/game/state';

const at = (day: number) => new Date(2026, 9, 5 + day, 12).getTime();

describe('猫窝', () => {
  it('家具数据：id 唯一、舒适度为正、免费路线便宜、高级家具（月光珠）舒适度更高', () => {
    expect(new Set(FURNITURE.map((f) => f.id)).size).toBe(FURNITURE.length);
    for (const f of FURNITURE) expect(f.comfort).toBeGreaterThan(0);
    const free = Math.max(...FURNITURE.filter((f) => !f.cost.moon).map((f) => f.comfort));
    for (const f of FURNITURE.filter((f) => f.cost.moon)) expect(f.comfort).toBeGreaterThan(free);
    const fl = FURNITURE.filter((f) => f.cost.moon);
    for (let i = 1; i < fl.length; i++) expect(fl[i].comfort / (fl[i].cost.moon ?? 1)).toBeGreaterThanOrEqual(fl[i - 1].comfort / (fl[i - 1].cost.moon ?? 1) * 0.6); // 越贵越划算（大致）
  });
  it('买家具扣对应货币、不能重复买、不够钱被拒', () => {
    const s = newPlayer(0); s.res.fish = 100000; s.res.bells = 1000;
    expect(buyFurniture(s, 'f_tank', at(0)).ok).toBe(true); expect(s.res.fish).toBe(50000);
    expect(buyFurniture(s, 'f_tank', at(0)).ok).toBe(false);
    expect(buyFurniture(s, 'f_fountain', at(0)).ok).toBe(false);
    expect(buyFurniture(s, 'f_tower', at(0)).ok).toBe(true); expect(s.res.bells).toBe(400);
    expect(buyFurniture(s, 'nope', at(0)).ok).toBe(false);
    s.res.moon = 700; expect(buyFurniture(s, 'f_fountain', at(0)).ok).toBe(true); expect(s.res.moon).toBe(100);
    expect(comfortOf(s)).toBe(20 + 30 + 80);
  });
  it('收益按天累积、最多攒 3 天、领取后清零；没家具不能领', () => {
    const s = newPlayer(0); s.res.fish = 50000;
    ensureNest(s, at(0));
    expect(collectNest(s, at(5)).ok).toBe(false);
    buyFurniture(s, 'f_perch', at(5));
    expect(nestDaysReady(s, at(5))).toBe(0);
    expect(nestPending(s, at(7))).toBe(2 * 12 * NEST_FISH_PER_COMFORT);
    expect(nestDaysReady(s, at(30))).toBe(NEST_MAX_DAYS);
    const before = s.res.fish;
    const r = collectNest(s, at(30));
    expect(r.ok && r.fish).toBe(NEST_MAX_DAYS * 12 * NEST_FISH_PER_COMFORT); expect(s.res.fish - before).toBe(NEST_MAX_DAYS * 12 * NEST_FISH_PER_COMFORT);
    expect(collectNest(s, at(30)).ok).toBe(false);
  });
  it('买新家具之前先结清已攒收益，新家具不追溯加成', () => {
    const s = newPlayer(0); s.res.fish = 200000;
    buyFurniture(s, 'f_cushion', at(0));
    const before = s.res.fish;
    buyFurniture(s, 'f_scratch', at(2)); // 攒了 2 天按舒适度 5 结算
    expect(s.res.fish - before).toBe(2 * 5 * NEST_FISH_PER_COMFORT - 8000);
    expect(nestPending(s, at(2))).toBe(0);
  });
});
