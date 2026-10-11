// 战斗单位解析：英雄与杂兵统一入口（引擎、回放器、界面都用它）。
import type { CatLook } from '../art/types';
import { MOBS } from '../content/mobs';
import type { FactionId } from './factions';
import { HERO_BY_ID } from './heroes';
import type { Rarity, Role } from './heroes';
import { MOB_LOOKS } from './mob-looks';

export { MOB_LOOKS } from './mob-looks';

export interface UnitInfo {
  id: string;
  name: string;
  title: string;
  faction: FactionId;
  role: Role;
  rarity: Rarity;
  hpMul: number;
  atkMul: number;
  isMob: boolean;
}

export const MOB_BY_ID = Object.fromEntries(MOBS.map((m) => [m.id, m]));

export function unitInfo(id: string): UnitInfo {
  const h = HERO_BY_ID[id];
  if (h) return { id, name: h.name, title: h.title, faction: h.faction, role: h.role, rarity: h.rarity, hpMul: 1, atkMul: 1, isMob: false };
  const m = MOB_BY_ID[id];
  if (!m) throw new Error(`unknown unit ${id}`);
  return { id, name: m.name, title: '杂兵', faction: m.faction, role: m.role, rarity: 'SR', hpMul: m.hpMul, atkMul: m.atkMul, isMob: true };
}

/** 英雄仍用图鉴外观；杂兵只使用逐只校验过的正式外观，不再按哈希拼装。 */
export function lookOf(id: string): CatLook {
  const h = HERO_BY_ID[id];
  if (h) return h.look;
  if (MOB_LOOKS[id]) return MOB_LOOKS[id];
  unitInfo(id); // 保持未知单位原有的报错语义。
  throw new Error(`missing mob look ${id}`);
}
