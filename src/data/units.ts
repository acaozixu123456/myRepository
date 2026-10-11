// 战斗单位解析：英雄与杂兵统一入口（引擎、回放器、界面都用它）。
import type { CatLook, Coat, EyeStyle, HeadGear, BodyGear, WeaponKind, BackGear } from '../art/types';
import { MOBS } from '../content/mobs';
import { FACTIONS } from './factions';
import type { FactionId } from './factions';
import { HERO_BY_ID } from './heroes';
import type { Rarity, Role } from './heroes';

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

const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

const COATS: Coat[] = [
  { pattern: 'tabby', base: '#a58b72', light: '#e9dccb', stripe: '#6f5846' },
  { pattern: 'solid', base: '#8ea3be', light: '#dfe6f0' },
  { pattern: 'tuxedo', base: '#3b3540', light: '#f7f2ea' },
  { pattern: 'tabby', base: '#e89a4c', light: '#fbe3bd', stripe: '#b8672a' },
  { pattern: 'shaded', base: '#b8b6b0', light: '#ece9e2', accent: '#8f8c86' },
  { pattern: 'solid', base: '#c9a574', light: '#f3e6c8' },
  { pattern: 'spots', base: '#d9a65a', light: '#f6e6c0', accent: '#7a4a1e' },
  { pattern: 'cow', base: '#2e2428', accent: '#2e2428', light: '#f7f3ec' },
];
const HEAD: Record<FactionId, HeadGear> = { wei: 'helmetWei', shu: 'helmetGeneral', wu: 'sailorBandana', qun: 'helmetGeneral', man: 'boneCrown', xian: 'taoistCrown' };

/** 杂兵的默认外观：由阵营 + 职业推导，保证每只杂兵都能直接上场（正式外观可在 MOB_LOOKS 里覆盖）。 */
export const MOB_LOOKS: Record<string, CatLook> = {};

export function lookOf(id: string): CatLook {
  const h = HERO_BY_ID[id];
  if (h) return h.look;
  if (MOB_LOOKS[id]) return MOB_LOOKS[id];
  const u = unitInfo(id);
  const f = u.faction;
  const pal = FACTIONS[f].pal;
  const k = hash(id);
  const coat = COATS[k % COATS.length];
  const man = f === 'man';
  const xian = f === 'xian';
  let head: HeadGear = HEAD[f];
  let body: BodyGear = 'armorLight';
  let weapon: WeaponKind = 'sword';
  let back: BackGear = 'none';
  let eye: EyeStyle = 'keen';
  switch (u.role) {
    case '守护': body = man ? 'rattan' : 'armorHeavy'; weapon = 'mace'; back = man ? 'none' : 'cape'; eye = 'cool'; if (man) head = 'rattanHelm'; break;
    case '先锋': body = man ? 'tribal' : 'armorLight'; weapon = k % 2 ? 'spear' : 'sword'; eye = 'fierce'; break;
    case '神射': body = 'vest'; weapon = 'bow'; head = f === 'wu' ? 'sailorBandana' : man ? 'featherHeaddress' : 'none'; eye = 'sharp'; break;
    case '谋士': body = man ? 'tribal' : xian ? 'robeTaoist' : 'robeScholar'; weapon = k % 2 ? 'fan' : 'scroll'; head = man ? 'featherHeaddress' : xian ? 'lotusCrown' : 'scholarCap'; eye = 'calm'; break;
    case '医者': body = man ? 'tribal' : 'robeTaoist'; weapon = 'herbs'; head = man ? 'featherHeaddress' : f === 'qun' ? 'flowerPin' : 'scholarCap'; eye = 'calm'; break;
    case '刺客': body = 'vest'; weapon = 'knives'; head = f === 'wu' ? 'sailorBandana' : 'none'; eye = 'keen'; break;
  }
  return {
    coat,
    eye: { color: ['#e8c24a', '#6fb25a', '#4a90e0', '#c9863a', '#7fc050'][k % 5], style: eye },
    ear: (['pointy', 'round', 'pointy', 'fold'] as const)[k % 4],
    tail: (['long', 'bushy', 'curl', 'ring'] as const)[(k >> 3) % 4],
    build: u.role === '守护' ? 1.12 : u.role === '刺客' || u.role === '神射' ? 0.92 : 1,
    outfit: { pal, head, body, weapon, back, extra: [] },
  };
}
