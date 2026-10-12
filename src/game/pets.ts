// 宠物养成：蛋 → 孵化（R/SR/SSR，带保底）→ 升级 / 升星；出战的宠物给全队百分比加成，并在战斗里每 3 回合出手一次。
// 重复宠物转为该宠的碎片，碎片用来升星（升星提高等级上限、加成和技能威力）。
import { PETS, PET_BY_ID } from '../data/pets';
import type { PetRarity } from '../data/pets';
import type { PlayerState } from './state';

export interface PetOwned { lv: number; star: number; shards: number }
export interface PetState {
  owned: Record<string, PetOwned>;
  active: string | null;
  eggs: number;
  /** 距上次 SSR 已孵了几颗（保底 20 颗必出 SSR） */
  pity: number;
  hatched: number;
  /** 小游戏三星 / 探索奖励的每日蛋计数 */
  eggDay?: number;
  eggToday?: number;
}

export const PET_STAR_MAX = 5;
export const PET_LV_MAX = 30;
export const PET_EGG_BELLS = 200;
export const PET_PITY = 20;
export const HATCH_RATE: Record<PetRarity, number> = { R: 0.7, SR: 0.25, SSR: 0.05 };
const DUP_SHARDS: Record<PetRarity, number> = { R: 8, SR: 14, SSR: 30 };

export const newPetState = (): PetState => ({ owned: {}, active: null, eggs: 1, pity: 0, hatched: 0 });
export function petsOf(s: PlayerState): PetState {
  s.pets ??= newPetState();
  s.pets.owned ??= {};
  s.pets.eggs ??= 0;
  s.pets.pity ??= 0;
  s.pets.hatched ??= 0;
  if (s.pets.active && !s.pets.owned[s.pets.active]) s.pets.active = null;
  return s.pets;
}

export const petLvCap = (star: number) => Math.min(PET_LV_MAX, 10 + 4 * star);
export const petLvCost = (lv: number) => 400 * lv;
export const petStarCost = (star: number) => Math.floor(10 * star + 5 * star * star); // 1→2: 15, 2→3: 40, 3→4: 75, 4→5: 120
/** 技能威力倍率：等级 +2.5%/级，星级 +8%/星 */
export const PET_SKILL_K = 0.45; // 平衡抽样：Lv5 宠物约等于全队 +2 级（原系数约 +3 级，前期首领通关率 +40 个点）
export const petPower = (o: PetOwned) => PET_SKILL_K * (1 + (o.lv - 1) * 0.025) * (1 + (o.star - 1) * 0.08);
/** 全队属性加成（hp / atk / def 同比例），< 10% */
export function petBonus(o: PetOwned | undefined): number {
  if (!o) return 0;
  return 0.015 + 0.0012 * (o.lv - 1) + 0.008 * (o.star - 1);
}
export const petMul = (s: PlayerState): number => {
  const p = s.pets;
  return 1 + (p?.active ? petBonus(p.owned[p.active]) : 0);
};
export const activePet = (s: PlayerState): { id: string; owned: PetOwned } | null => {
  const p = s.pets;
  if (!p?.active || !p.owned[p.active]) return null;
  return { id: p.active, owned: p.owned[p.active] };
};

export type PetResult = { ok: true } | { ok: false; reason: string };

export function addEggs(s: PlayerState, n: number) { petsOf(s).eggs += n; }

/** 抽一颗蛋的稀有度（rand 取 [0,1)） */
export function rollRarity(p: PetState, rand: () => number): PetRarity {
  if (p.pity + 1 >= PET_PITY) return 'SSR';
  const r = rand();
  return r < HATCH_RATE.SSR ? 'SSR' : r < HATCH_RATE.SSR + HATCH_RATE.SR ? 'SR' : 'R';
}

export interface HatchOut { id: string; rarity: PetRarity; isNew: boolean; shards: number }
export function hatch(s: PlayerState, rand: () => number = Math.random): HatchOut | { ok: false; reason: string } {
  const p = petsOf(s);
  if (p.eggs <= 0) return { ok: false, reason: '没有宠物蛋了' };
  p.eggs--;
  const rarity = rollRarity(p, rand);
  p.pity = rarity === 'SSR' ? 0 : p.pity + 1;
  p.hatched++;
  const pool = PETS.filter((x) => x.rarity === rarity);
  const def = pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))];
  const own = p.owned[def.id];
  if (own) {
    const shards = DUP_SHARDS[rarity];
    own.shards += shards;
    return { id: def.id, rarity, isNew: false, shards };
  }
  p.owned[def.id] = { lv: 1, star: 1, shards: 0 };
  if (!p.active) p.active = def.id;
  return { id: def.id, rarity, isNew: true, shards: 0 };
}

export function buyEgg(s: PlayerState): PetResult {
  if (s.res.bells < PET_EGG_BELLS) return { ok: false, reason: '金铃铛不够' };
  s.res.bells -= PET_EGG_BELLS;
  addEggs(s, 1);
  return { ok: true };
}

export function setActive(s: PlayerState, id: string | null): PetResult {
  const p = petsOf(s);
  if (id && !p.owned[id]) return { ok: false, reason: '还没有这只宠物' };
  p.active = id;
  return { ok: true };
}

export function petLevelUp(s: PlayerState, id: string): PetResult {
  const o = petsOf(s).owned[id];
  if (!o) return { ok: false, reason: '还没有这只宠物' };
  if (o.lv >= petLvCap(o.star)) return { ok: false, reason: o.star >= PET_STAR_MAX ? '已满级' : '已到当前星级的等级上限，升星可提高' };
  const c = petLvCost(o.lv);
  if (s.res.fish < c) return { ok: false, reason: '小鱼干不够' };
  s.res.fish -= c;
  o.lv++;
  return { ok: true };
}

export function petStarUp(s: PlayerState, id: string): PetResult {
  const o = petsOf(s).owned[id];
  if (!o) return { ok: false, reason: '还没有这只宠物' };
  if (o.star >= PET_STAR_MAX) return { ok: false, reason: '已满星' };
  const c = petStarCost(o.star);
  if (o.shards < c) return { ok: false, reason: `碎片不够（${o.shards}/${c}）` };
  o.shards -= c;
  o.star++;
  return { ok: true };
}

export const petName = (id: string) => PET_BY_ID[id]?.name ?? id;

/** 战斗配置里的我方出战宠物（没有出战宠物就是 undefined） */
export function petCfg(s: PlayerState): { A: { id: string; power: number } } | undefined {
  const a = activePet(s);
  return a ? { A: { id: a.id, power: petPower(a.owned) } } : undefined;
}

export const EGG_DAILY_CAP = 3;
/** 每日最多从小游戏三星 / 快速探索拿 3 颗蛋；day 是日序号 */
export function dailyEgg(s: PlayerState, day: number): boolean {
  const p = petsOf(s);
  if (p.eggDay !== day) { p.eggDay = day; p.eggToday = 0; }
  if ((p.eggToday ?? 0) >= EGG_DAILY_CAP) return false;
  p.eggToday = (p.eggToday ?? 0) + 1;
  p.eggs++;
  return true;
}
