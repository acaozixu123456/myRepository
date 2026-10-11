// 日常秘境：三种资源副本（小鱼干 / 经验 / 猫薄荷），五档难度，每天每种 3 次；通关过的档位可以扫荡。
import { idleRate as contentIdleRate } from '../content/progression';
import type { EnemySpawn, StageDef } from '../content/types';
import type { FactionId } from '../data/factions';
import { applyGain, getStage, paceLevel, stageOrdinal } from './stage';
import type { Gain } from './stage';
import { dayIndex } from './premium';
import type { PlayerState } from './state';

export type DungeonId = 'fish' | 'exp' | 'catnip';
export interface DungeonDef { id: DungeonId; name: string; desc: string; faction: FactionId; icon: string }
export const DUNGEONS: DungeonDef[] = [
  { id: 'fish', name: '小鱼干秘洞', desc: '洞壁上嵌满了干得刚刚好的小鱼干。守洞的蛮族猫猫只认“礼貌敲门”。', faction: 'man', icon: 'fish' },
  { id: 'exp', name: '猫抓板练功场', desc: '一整面墙的猫抓板，抓一爪涨一点本事。看场的魏族猫猫很严格。', faction: 'wei', icon: 'spark' },
  { id: 'catnip', name: '猫薄荷花园', desc: '风一吹，整座山谷都在打滚。仙族园丁请你别踩花圃。', faction: 'xian', icon: 'catnip' },
];
export const DUNGEON_BY_ID = Object.fromEntries(DUNGEONS.map((d) => [d.id, d])) as Record<DungeonId, DungeonDef>;
export const TIERS = 5;
export const DAILY_TRIES = 3;
const TIER_ORD = [10, 30, 55, 90, 130]; // 敌方强度对应的进度序号
const UNLOCK_ORD = [1, 18, 42, 72, 110]; // 需要主线推进到的序号
const CATNIP_REWARD = [2, 4, 8, 16, 32];
const ROLES = ['guard', 'vanguard', 'guard', 'archer', 'healer'];

export interface DungeonState { day: number; used: Record<DungeonId, number>; best: Record<DungeonId, number> }
export function ensureDungeon(s: PlayerState, now = Date.now()): DungeonState {
  s.dungeon ??= { day: -1, used: { fish: 0, exp: 0, catnip: 0 }, best: { fish: 0, exp: 0, catnip: 0 } };
  const d = s.dungeon;
  d.used ??= { fish: 0, exp: 0, catnip: 0 }; d.best ??= { fish: 0, exp: 0, catnip: 0 };
  if (d.day !== dayIndex(now)) { d.day = dayIndex(now); d.used = { fish: 0, exp: 0, catnip: 0 }; }
  return d;
}
export const dungeonLeft = (s: PlayerState, id: DungeonId, now = Date.now()) => DAILY_TRIES - ensureDungeon(s, now).used[id];
export const bestOrdinal = (s: PlayerState) => { const b = s.best ?? s.stage; return stageOrdinal(b.chapter, b.index); };
export const tierUnlocked = (s: PlayerState, tier: number) => bestOrdinal(s) >= UNLOCK_ORD[tier - 1];
export const tierLevel = (tier: number) => paceLevel(TIER_ORD[tier - 1]);

/** 秘境单次奖励折算的挂机分钟数（经济审查：120 分钟时秘境仅占免费收入 14%–20%，提到 150） */
export const DUNGEON_MINUTES = 150;
/** 某档的奖励：小鱼干 / 经验按“该进度挂机 2.5 小时”折算，猫薄荷按档位递增 */
export function dungeonReward(id: DungeonId, tier: number): Gain {
  const ord = TIER_ORD[tier - 1];
  const chapter = Math.min(6, Math.floor((ord - 1) / 24) + 1);
  const st = getStage(chapter, ord - (chapter - 1) * 24);
  const r = st ? contentIdleRate(st.id) : { fish: 0, exp: 0 };
  return { fish: id === 'fish' ? Math.round(r.fish * DUNGEON_MINUTES) : 0, exp: id === 'exp' ? Math.round(r.exp * DUNGEON_MINUTES) : 0, catnip: id === 'catnip' ? CATNIP_REWARD[tier - 1] : 0, bells: 0 };
}
export function dungeonStage(id: DungeonId, tier: number): StageDef {
  const def = DUNGEON_BY_ID[id];
  const level = tierLevel(tier);
  const enemies: EnemySpawn[] = ROLES.map((role, pos) => ({ unit: `mob_${def.faction}_${role}`, level, pos }));
  return { id: `D-${id}-${tier}`, name: `${def.name} ${tier} 档`, kind: 'normal', recommendedPower: 0, waves: [{ enemies }], rewards: { fish: 0 }, firstClear: { fish: 0 } };
}
export function dungeonStart(s: PlayerState, id: DungeonId, tier: number, now = Date.now()): { ok: boolean; reason?: string } {
  if (tier < 1 || tier > TIERS) return { ok: false, reason: '没有这一档' };
  if (!tierUnlocked(s, tier)) return { ok: false, reason: '主线再推进一点才能进这一档' };
  if (dungeonLeft(s, id, now) <= 0) return { ok: false, reason: '今天的次数用完了' };
  ensureDungeon(s, now).used[id]++;
  return { ok: true };
}
export function dungeonWin(s: PlayerState, id: DungeonId, tier: number, now = Date.now()): Gain {
  const d = ensureDungeon(s, now);
  d.best[id] = Math.max(d.best[id], tier);
  const g = dungeonReward(id, tier);
  applyGain(s, g);
  return g;
}
export function dungeonSweep(s: PlayerState, id: DungeonId, tier: number, now = Date.now()): { ok: true; gain: Gain } | { ok: false; reason: string } {
  const d = ensureDungeon(s, now);
  if (d.best[id] < tier) return { ok: false, reason: '这一档还没通关过，不能扫荡' };
  const r = dungeonStart(s, id, tier, now);
  if (!r.ok) return { ok: false, reason: r.reason ?? '' };
  return { ok: true, gain: dungeonWin(s, id, tier, now) };
}
