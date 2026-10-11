// 爬塔：100 层，每层一场 5 对 5，只有首次通关有奖励。层数据由公式生成（确定性），可直接当 StageDef 交给战斗循环。
import type { EnemySpawn, RewardDef, StageDef } from '../content/types';
import { FACTION_ORDER } from '../data/factions';
import { HEROES } from '../data/heroes';
import { bossRuleFx } from '../content/campaign';
import { paceLevel } from './stage';
import type { PlayerState } from './state';
import { rollover, track } from './quests';

export const TOWER_FLOORS = 100;
/** 一层大约相当于主线 1.3 关（100 层 ≈ 130 关） */
const ORDINAL_PER_FLOOR = 1.3;

export const towerFaction = (floor: number) => FACTION_ORDER[Math.floor((floor - 1) / 5) % 6];
export const towerKind = (floor: number): StageDef['kind'] => (floor % 10 === 0 ? 'boss' : floor % 5 === 0 ? 'elite' : 'normal');
export const towerBest = (s: PlayerState) => s.tower?.floor ?? 0;

export function towerReward(floor: number): RewardDef {
  const kind = towerKind(floor);
  return {
    fish: 600 + floor * 220,
    exp: 300 + floor * 70,
    bells: kind === 'boss' ? 120 : kind === 'elite' ? 50 : 20,
    items: kind === 'normal' ? [] : [{ id: kind === 'boss' ? 'catnip_large' : 'catnip_medium', count: kind === 'boss' ? 2 : 3 }],
  };
}

export function towerFloor(floor: number): StageDef {
  if (!Number.isInteger(floor) || floor < 1 || floor > TOWER_FLOORS) throw new RangeError(`爬塔层数须为 1~${TOWER_FLOORS}`);
  const faction = towerFaction(floor);
  const kind = towerKind(floor);
  const level = paceLevel(Math.round(floor * ORDINAL_PER_FLOOR));
  const roles = ['guard', 'vanguard', 'guard', floor % 2 ? 'archer' : 'strategist', floor % 3 ? 'assassin' : 'healer'];
  const enemies: EnemySpawn[] = roles.map((role, pos) => ({ unit: `mob_${faction}_${role}`, level, pos }));
  let bossId: string | undefined;
  if (kind !== 'normal') {
    const pool = HEROES.filter((h) => h.faction === faction && (kind === 'boss' ? h.rarity !== 'SR' : true));
    const hero = pool[Math.floor(floor / 5) % pool.length];
    if (kind === 'boss') bossId = hero.id;
    const pos = hero.role === '守护' || hero.role === '先锋' ? 1 : 3;
    enemies[pos] = kind === 'boss' ? { unit: hero.id, level: level - 1, pos, mods: ['elite'] } : { unit: hero.id, level: level - 2, pos };
  }
  const phases = bossId ? bossRuleFx(bossId) : [];
  return {
    id: `T-${floor}`,
    name: `第 ${floor} 层`,
    kind,
    recommendedPower: 0,
    waves: [{ enemies }],
    rewards: { fish: 0 },
    firstClear: towerReward(floor),
    rule: kind === 'boss' ? '守塔首领：每十层一位，通关有大奖励' : undefined,
    ...(phases.length ? { ruleFx: phases } : {}),
  };
}

/** 通关结算：只有刷新最高层才发奖励，返回奖励（重复通关返回 null） */
export function towerClear(s: PlayerState, floor: number): RewardDef | null {
  if (floor !== towerBest(s) + 1) return null;
  rollover(s, Date.now());
  s.tower = { floor };
  track(s, 'tower_clear');
  return towerReward(floor);
}
