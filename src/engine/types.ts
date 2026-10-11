// 战斗引擎类型：技能 DSL、单位、事件。引擎只产出“事件时间线”，渲染层负责播放。
import type { FactionId } from '../data/factions';
import type { Role } from '../data/heroes';

export type Elem = 'phys' | 'magic' | 'fire' | 'water' | 'thunder' | 'true';
export type StatKey = 'atk' | 'def' | 'spd' | 'maxHp';

/** 伤害 / 治疗 / 护盾的取值公式（按施法者当前属性换算） */
export interface Scale {
  atk?: number; // 攻击力倍率
  def?: number; // 防御倍率
  maxHp?: number; // 自身最大生命倍率
  curHp?: number; // 当前生命倍率
  missingHp?: number; // 已损失生命倍率
  targetMaxHp?: number; // 目标最大生命倍率
}

export type SelPick =
  | 'front' // 站位最靠前的
  | 'back' // 站位最靠后的
  | 'random'
  | 'all'
  | 'lowestHp'
  | 'lowestHpPct'
  | 'highestAtk'
  | 'lowestEnergy'
  | 'highestEnergy'
  | 'self'
  | 'frontRow'
  | 'backRow'
  | 'column' // 与首个目标同列（前+后）
  | 'attacker' // 触发者（被动用）
  | 'source'; // 事件来源

export interface TargetSel {
  side: 'enemy' | 'ally' | 'self';
  pick: SelPick;
  n?: number;
  faction?: FactionId;
  role?: Role;
  hasStatus?: string;
  noStatus?: string;
  exclSelf?: boolean;
}

export type Cond =
  | { c: 'hpBelow'; pct: number; who?: 'self' | 'target' }
  | { c: 'hpAbove'; pct: number; who?: 'self' | 'target' }
  | { c: 'status'; id: string; who?: 'self' | 'target'; atLeast?: number }
  | { c: 'allyFaction'; faction: FactionId; atLeast: number }
  | { c: 'heroAlive'; hero: string; side?: 'ally' | 'enemy' }
  | { c: 'chance'; p: number }
  | { c: 'crit' }
  | { c: 'targetFaction'; faction: FactionId }
  | { c: 'targetRole'; role: Role }
  | { c: 'round'; atLeast: number }
  | { c: 'counter'; key: string; atLeast: number }
  | { c: 'killed' }
  | { c: 'not'; cond: Cond }
  | { c: 'and'; conds: Cond[] }
  | { c: 'or'; conds: Cond[] };

export interface DamageBonus { cond: Cond; mult: number }

export type Effect = EffectBody & { to?: TargetSel };
export type EffectBody =
  | { t: 'damage'; scale: Scale; elem?: Elem; hits?: number; ignoreDef?: number; bonus?: DamageBonus[]; lifesteal?: number; critBonus?: number; noCrit?: boolean }
  | { t: 'heal'; scale: Scale }
  | { t: 'shield'; scale: Scale; turns: number }
  | { t: 'status'; id: string; turns: number; stacks?: number; p?: number; power?: number; snap?: Scale }
  | { t: 'energy'; amount: number }
  | { t: 'cleanse'; n?: number; kind?: 'debuff' | 'buff' }
  | { t: 'revive'; hpPct: number }
  | { t: 'extraTurn' }
  | { t: 'counter'; key: string; add: number; max?: number } // 阵营资源计数器（图腾 / 层数 …）
  | { t: 'selfDamage'; pctMaxHp: number }
  | { t: 'summon'; beast: string; count: number; perCounter?: string; scale: Scale; elem?: Elem; applyStatus?: { id: string; turns: number; power?: number; snap?: Scale } }
  | { t: 'when'; cond: Cond; then: Effect[]; else?: Effect[] }
  | { t: 'repeat'; n: number; effects: Effect[] }
  | { t: 'text'; text: string }; // 仅用于表现：头顶弹出字

export type TriggerOn =
  | 'battleStart' | 'roundStart' | 'roundEnd' | 'beforeAct' | 'afterAct'
  | 'onBasic' | 'onUlt' | 'onHit' | 'onCrit' | 'onHurt' | 'onKill' | 'onDeath'
  | 'onAllyDeath' | 'onEnemyUlt' | 'onHealed' | 'onAllyAct' | 'lowHp';

export interface PassiveDef {
  on: TriggerOn;
  cond?: Cond;
  limit?: { per: 'battle' | 'round'; n: number };
  target?: TargetSel; // 默认自身
  effects: Effect[];
  hpPct?: number; // lowHp 的阈值
}

export interface Patch {
  skill: 'basic' | 'ultimate' | 'passive';
  scaleMul?: number; // 所有伤害/治疗/护盾倍率乘算
  addEffects?: Effect[];
  replaceEffects?: Effect[];
  addPassive?: PassiveDef;
  retarget?: TargetSel;
}

export interface LevelMod { lv: number; desc: string; patch: Patch }
export interface AwakenBranch { name: string; desc: string; patches: Patch[] }

export interface SkillDef {
  id: string;
  name: string;
  fx: string; // 动画与特效 id（src/fx/skills.ts）
  melee?: boolean;
  target?: TargetSel;
  effects: Effect[];
  desc: string;
  levelMods?: LevelMod[];
}

export interface PassiveSkillDef {
  id: string;
  name: string;
  desc: string;
  passive: PassiveDef[];
}

export interface Kit {
  heroId: string;
  basic: SkillDef;
  ultimate: SkillDef;
  passive: PassiveSkillDef;
  awaken: { A: AwakenBranch; B: AwakenBranch };
}

// ---------- 战斗配置 ----------
export interface UnitSetup {
  heroId: string;
  level: number;
  star?: number; // 1~5，★5 解锁觉醒分支
  awaken?: 'A' | 'B';
  skillLv?: number; // 绝技等级 1~10
  pos: number; // 0-2 前排，3-4 后排
  statMul?: number; // 额外属性倍率（关卡词缀）
  hpPct?: number; // 开局生命比例（多波战斗时继承；0 表示已倒下，不上场）
  energy?: number; // 开局元气（多波战斗继承）
}
export interface BattleConfig { seed: number; A: UnitSetup[]; B: UnitSetup[]; maxRounds?: number; startEnergy?: number | { A: number; B: number }; noBonds?: boolean /* 平衡实验用：关闭命名羁绊（阵营同族加成保留） */ }

export interface StatusInst { id: string; turns: number; stacks: number; power: number; snap: number; src: number }

export interface Unit {
  uid: number;
  side: 'A' | 'B';
  pos: number;
  heroId: string;
  name: string;
  faction: FactionId;
  role: Role;
  level: number;
  maxHp: number;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  crit: number;
  critDmg: number;
  energy: number;
  shield: { v: number; turns: number }[];
  statuses: StatusInst[];
  alive: boolean;
  kit: Kit;
  counters: Record<string, number>;
  used: Record<string, number>; // 被动触发次数记录
  acted: number;
  extraTurn: boolean;
  invuln: number; // 无敌回合
  dmgMul: number; // 羁绊等永久倍率
}

// ---------- 事件 ----------
export type BEvent =
  | { t: 'start'; units: { uid: number; side: 'A' | 'B'; pos: number; heroId: string; name: string; maxHp: number; hp: number; faction: FactionId }[] }
  | { t: 'round'; n: number }
  | { t: 'act'; uid: number; skill: string; fx: string; kind: 'basic' | 'ultimate'; targets: number[]; melee: boolean }
  | { t: 'damage'; src: number; dst: number; amount: number; crit: boolean; elem: Elem; hp: number; shield: number; killed: boolean; hit: number; hits: number; absorbed: number }
  | { t: 'heal'; src: number; dst: number; amount: number; hp: number }
  | { t: 'shield'; src: number; dst: number; amount: number; total: number }
  | { t: 'status'; dst: number; id: string; op: 'add' | 'remove'; stacks: number; src: number }
  | { t: 'dot'; dst: number; id: string; amount: number; hp: number; killed: boolean }
  | { t: 'energy'; uid: number; energy: number }
  | { t: 'death'; uid: number }
  | { t: 'revive'; uid: number; hp: number }
  | { t: 'skip'; uid: number; reason: string }
  | { t: 'text'; uid: number; text: string }
  | { t: 'passive'; uid: number; name: string }
  | { t: 'summon'; uid: number; beast: string; count: number; targets: number[] }
  | { t: 'end'; winner: 'A' | 'B' | 'draw'; rounds: number };
