import { describe, expect, it } from 'vitest';
import {
  awakenCost, breakthroughCost, expToNext, HERO_EXP_TABLE, HERO_LEVEL_CAP, idleCap, idleRate,
  IDLE_SETTLEMENT_MINUTES, levelUpFishCost, previewTable, skillUpgradeCost, starUpShards,
} from '../src/content/progression';
import type { GrowthCost } from '../src/content/progression';
import { ITEMS } from '../src/content/items';
import { CHAPTERS } from '../src/content/campaign';

const itemById = new Map(ITEMS.map((item) => [item.id, item]));
function checkCost(cost: GrowthCost): void {
  expect(Number.isSafeInteger(cost.fish)).toBe(true);
  expect(cost.fish).toBeGreaterThanOrEqual(0);
  for (const item of cost.items) {
    expect(itemById.get(item.id)?.kind, item.id).toBe('material');
    expect(Number.isSafeInteger(item.count)).toBe(true);
    expect(item.count).toBeGreaterThan(0);
  }
}

describe('成长与挂机曲线', () => {
  it('一至一百一十九级升级成本平滑严格递增，满级免费且无下一等级', () => {
    expect(HERO_EXP_TABLE).toHaveLength(120);
    expect(expToNext(1)).toBeGreaterThan(0);
    expect(levelUpFishCost(1)).toBeGreaterThan(0);
    for (let level = 1; level < HERO_LEVEL_CAP; level++) {
      const exp = expToNext(level);
      const fish = levelUpFishCost(level);
      expect(HERO_EXP_TABLE[level - 1]).toEqual({ level, exp, fish });
      for (const value of [exp, fish]) {
        expect(Number.isSafeInteger(value)).toBe(true);
        expect(value).toBeGreaterThan(0);
      }
      if (level > 1) {
        expect(exp).toBeGreaterThan(expToNext(level - 1));
        expect(fish).toBeGreaterThan(levelUpFishCost(level - 1));
      }
      if (level > 2) {
        expect(exp - expToNext(level - 1)).toBeGreaterThan(expToNext(level - 1) - expToNext(level - 2));
      }
    }
    expect(expToNext(120)).toBe(0);
    expect(levelUpFishCost(120)).toBe(0);
    expect(HERO_EXP_TABLE[119]).toEqual({ level: 120, exp: 0, fish: 0 });
  });

  it('六阶突破成本严格递增，鱼骨与猫薄荷品级逐段提升且引用有效', () => {
    let fish = 0;
    let count = 0;
    let materialValue = 0;
    const weights: Record<string, number> = {
      fishbone_small: 1, fishbone_medium: 4, fishbone_large: 16,
      catnip_small: 1, catnip_medium: 4, catnip_large: 16,
    };
    for (let stage = 1; stage <= 6; stage++) {
      const cost = breakthroughCost(stage);
      checkCost(cost);
      expect(cost.items.some((item) => item.id.startsWith('fishbone_'))).toBe(true);
      expect(cost.items.some((item) => item.id.startsWith('catnip_'))).toBe(true);
      const quantity = cost.items.reduce((sum, item) => sum + item.count, 0);
      const value = cost.items.reduce((sum, item) => sum + item.count * weights[item.id], 0);
      expect(cost.fish).toBeGreaterThan(fish);
      expect(quantity).toBeGreaterThan(count);
      expect(value).toBeGreaterThan(materialValue);
      fish = cost.fish; count = quantity; materialValue = value;
    }
  });

  it('升星按目标星级，三档碎片成本不同且逐星递增', () => {
    expect(starUpShards(1)).toEqual({ SR: 0, SSR: 0, UR: 0 });
    for (let star = 2; star <= 5; star++) {
      const cost = starUpShards(star);
      expect(cost.UR).toBeGreaterThan(cost.SSR);
      expect(cost.SSR).toBeGreaterThan(cost.SR);
      for (const rarity of ['SR', 'SSR', 'UR'] as const) {
        expect(Number.isSafeInteger(cost[rarity])).toBe(true);
        expect(cost[rarity]).toBeGreaterThan(starUpShards(star - 1)[rarity]);
        expect(itemById.get(`hero_shard_${rarity.toLowerCase()}`)?.kind).toBe('shard');
      }
    }
  });

  it('技能升级到十级后停止收费，觉醒成本随稀有度增长', () => {
    for (let level = 1; level < 10; level++) {
      const cost = skillUpgradeCost(level);
      checkCost(cost);
      if (level > 1) {
        expect(cost.fish).toBeGreaterThan(skillUpgradeCost(level - 1).fish);
        expect(cost.items[0].count).toBeGreaterThan(skillUpgradeCost(level - 1).items[0].count);
      }
    }
    expect(skillUpgradeCost(10)).toEqual({ fish: 0, items: [] });
    for (const rarity of ['SR', 'SSR', 'UR'] as const) checkCost(awakenCost[rarity]);
    expect(awakenCost.SSR.fish).toBeGreaterThan(awakenCost.SR.fish);
    expect(awakenCost.UR.fish).toBeGreaterThan(awakenCost.SSR.fish);
  });

  it('主城离线容量非递减，收益由战役奖励换算且跨关严格递增', () => {
    expect(idleCap(1)).toBe(8);
    expect(idleCap(80)).toBe(24);
    for (let level = 1; level <= 80; level++) {
      expect(idleCap(level)).toBeGreaterThanOrEqual(8);
      expect(idleCap(level)).toBeLessThanOrEqual(24);
      if (level > 1) expect(idleCap(level)).toBeGreaterThanOrEqual(idleCap(level - 1));
    }
    const stages = CHAPTERS.flatMap((chapter) => chapter.stages);
    stages.forEach((stage, index) => {
      const rate = idleRate(stage.id);
      expect(rate.fish * IDLE_SETTLEMENT_MINUTES).toBe(stage.rewards.fish);
      expect(rate.exp * IDLE_SETTLEMENT_MINUTES).toBe(stage.rewards.exp);
      for (const value of Object.values(rate)) {
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThan(0);
      }
      if (index > 0) {
        const previous = idleRate(stages[index - 1].id);
        expect(rate.fish).toBeGreaterThan(previous.fish);
        expect(rate.exp).toBeGreaterThan(previous.exp);
      }
    });
  });

  it('越界、非整数和非数值输入全部拒绝，关卡标识必须存在', () => {
    const cases = [
      { fn: expToNext, max: 120 }, { fn: levelUpFishCost, max: 120 },
      { fn: breakthroughCost, max: 6 }, { fn: starUpShards, max: 5 },
      { fn: skillUpgradeCost, max: 10 }, { fn: idleCap, max: 80 },
    ];
    for (const { fn, max } of cases) {
      for (const value of [0, -1, max + 1, 1.5, NaN, Infinity]) expect(() => fn(value)).toThrow(RangeError);
    }
    for (const id of ['', '0-1', '7-1', '1-25', '01-1', '1-01', '1-1 ']) expect(() => idleRate(id)).toThrow(RangeError);
  });

  it('预览提供曲线首尾各十点，六阶突破完整展示，调用不会共享可变成本', () => {
    const preview = previewTable();
    expect(preview.heroLevels).toHaveLength(20);
    expect(preview.cityLevels).toHaveLength(20);
    expect(preview.idleStages).toHaveLength(20);
    expect(preview.breakthroughs).toHaveLength(6);
    expect(preview.stars).toHaveLength(5);
    expect(preview.skills).toHaveLength(10);
    expect(preview.heroLevels.map((row) => row.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120]);
    preview.breakthroughs[0].items[0].count = 999;
    preview.heroLevels[0].exp = -1;
    expect(breakthroughCost(1).items[0].count).toBe(4);
    expect(expToNext(1)).toBeGreaterThan(0);
    expect(HERO_EXP_TABLE[0].exp).toBe(expToNext(1));
  });
});
