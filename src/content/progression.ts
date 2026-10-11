import { CHAPTERS } from './campaign';
import type { Rarity } from '../data/heroes';

export const HERO_LEVEL_CAP = 120;
export const CITY_LEVEL_CAP = 80;
export const SKILL_LEVEL_CAP = 10;
export const BREAKTHROUGH_STAGES = 6;

export interface GrowthCost {
  fish: number;
  items: { id: string; count: number }[];
}

function requireInteger(value: number, min: number, max: number, label: string): void {
  if (!Number.isInteger(value) || value < min || value > max) throw new RangeError(`${label}须为${min}至${max}的整数。`);
}

// 参数为当前等级；满级返回零，表示没有下一等级，禁止收取升级费用。
// 升级经验 = 100 + 20L + 4L²，差分为 24 + 8L，平滑增加而不指数膨胀。
export function expToNext(level: number): number {
  requireInteger(level, 1, HERO_LEVEL_CAP, '英雄等级');
  return level === HERO_LEVEL_CAP ? 0 : 100 + 20 * level + 4 * level * level;
}

// 当前等级升一级的小鱼干成本，与经验采用相同的二次增长节奏。
export function levelUpFishCost(level: number): number {
  requireInteger(level, 1, HERO_LEVEL_CAP, '英雄等级');
  return level === HERO_LEVEL_CAP ? 0 : 40 + 10 * level + 2 * level * level;
}

export const HERO_EXP_TABLE = Array.from({ length: HERO_LEVEL_CAP }, (_, index) => ({
  level: index + 1, exp: expToNext(index + 1), fish: levelUpFishCost(index + 1),
}));

// 参数为目标突破阶。解锁等级和战斗加成由架构方定义，此处不虚构第七阶。
const BREAKTHROUGH_ROWS = [
  { fish: 800, bone: 'fishbone_small', bones: 4, catnip: 'catnip_small', catnips: 2 },
  { fish: 2400, bone: 'fishbone_small', bones: 10, catnip: 'catnip_small', catnips: 5 },
  { fish: 7200, bone: 'fishbone_medium', bones: 16, catnip: 'catnip_medium', catnips: 8 },
  { fish: 18000, bone: 'fishbone_medium', bones: 24, catnip: 'catnip_medium', catnips: 12 },
  { fish: 40000, bone: 'fishbone_large', bones: 36, catnip: 'catnip_large', catnips: 18 },
  { fish: 80000, bone: 'fishbone_large', bones: 56, catnip: 'catnip_large', catnips: 28 },
] as const;

export function breakthroughCost(stage: number): GrowthCost {
  requireInteger(stage, 1, BREAKTHROUGH_STAGES, '目标突破阶');
  const row = BREAKTHROUGH_ROWS[stage - 1];
  return { fish: row.fish, items: [{ id: row.bone, count: row.bones }, { id: row.catnip, count: row.catnips }] };
}

// 参数为目标星级；一星是招募时的初始星级，二至五星才需要升星。
export function starUpShards(star: number): Record<Rarity, number> {
  requireInteger(star, 1, 5, '目标星级');
  if (star === 1) return { SR: 0, SSR: 0, UR: 0, SP: 0 };
  const scale = Math.pow(2, star - 2);
  return { SR: 20 * scale, SSR: 30 * scale, UR: 40 * scale, SP: 60 * scale };
}

// 参数为当前技能等级，升至下一技能等级；十级已经满级。
export function skillUpgradeCost(skillLevel: number): GrowthCost {
  requireInteger(skillLevel, 1, SKILL_LEVEL_CAP, '技能等级');
  if (skillLevel === SKILL_LEVEL_CAP) return { fish: 0, items: [] };
  const tier = skillLevel <= 3 ? 'small' : skillLevel <= 6 ? 'medium' : 'large';
  const fish = [200, 400, 700, 1200, 2000, 3500, 6000, 10000, 16000][skillLevel - 1];
  return { fish, items: [{ id: `claw_scroll_${tier}`, count: skillLevel * 2 }] };
}

// 五星后的一次觉醒成本；觉醒分支选择不再收费，效果仍由引擎负责。
export const awakenCost: Record<Rarity, GrowthCost> = {
  SR: { fish: 40000, items: [{ id: 'awaken_jade', count: 2 }, { id: 'awaken_dew', count: 8 }] },
  SSR: { fish: 80000, items: [{ id: 'awaken_jade', count: 4 }, { id: 'awaken_dew', count: 16 }] },
  UR: { fish: 160000, items: [{ id: 'awaken_jade', count: 8 }, { id: 'awaken_dew', count: 32 }] },
  SP: { fish: 320000, items: [{ id: 'awaken_jade', count: 12 }, { id: 'awaken_dew', count: 48 }] },
};

// 主城一级可存八小时，每五级增加一小时，八十级上限二十四小时。
export function idleCap(level: number): number {
  requireInteger(level, 1, CITY_LEVEL_CAP, '主城等级');
  return 8 + Math.floor(level / 5);
}

// 小鱼干/经验采用两分钟一次完成的预算换算；材料不在此函数重复计作经验。
// 正式材料掉落需要独立的周期/概率契约，不将整份 rewards 每分钟重复发放。
export const IDLE_SETTLEMENT_MINUTES = 2;
const STAGES = CHAPTERS.flatMap((chapter) => chapter.stages);
const STAGE_BY_ID = new Map(STAGES.map((stage) => [stage.id, stage]));

export function idleRate(stageId: string): { fish: number; exp: number } {
  const stage = STAGE_BY_ID.get(stageId);
  if (!stage) throw new RangeError('挂机关卡须为现有战役关卡标识。');
  return {
    fish: (stage.rewards.fish ?? 0) / IDLE_SETTLEMENT_MINUTES,
    exp: (stage.rewards.exp ?? 0) / IDLE_SETTLEMENT_MINUTES,
  };
}

function ends<T>(rows: T[]): T[] {
  return rows.length <= 20 ? rows : [...rows.slice(0, 10), ...rows.slice(-10)];
}

// 返回文档所需的实际计算结果，不依赖浏览器；突破仅六阶，完整展示六点。
export function previewTable() {
  return {
    heroLevels: ends(HERO_EXP_TABLE.map((row) => ({ ...row }))),
    cityLevels: ends(Array.from({ length: CITY_LEVEL_CAP }, (_, index) => ({ level: index + 1, hours: idleCap(index + 1) }))),
    idleStages: ends(STAGES.map((stage) => ({ stageId: stage.id, ...idleRate(stage.id) }))),
    breakthroughs: Array.from({ length: BREAKTHROUGH_STAGES }, (_, index) => ({ stage: index + 1, ...breakthroughCost(index + 1) })),
    stars: Array.from({ length: 5 }, (_, index) => ({ star: index + 1, ...starUpShards(index + 1) })),
    skills: Array.from({ length: SKILL_LEVEL_CAP }, (_, index) => ({ level: index + 1, ...skillUpgradeCost(index + 1) })),
  };
}
