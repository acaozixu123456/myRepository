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
  gear?: Partial<Record<'hp' | 'atk' | 'def' | 'spd' | 'crit' | 'critDmg' | 'hit' | 'dodge' | 'healBonus' | 'dmgReduce', number>>; // 装备（含套装面板）提供的属性
  set4?: string[]; // 已凑齐四件的套装 id，启用特殊效果
  hpPct?: number; // 开局生命比例（多波战斗时继承；0 表示已倒下，不上场）
  energy?: number; // 开局元气（多波战斗继承）
}
/** 关卡规则的机器可读形式（StageDef.ruleFx）。side：A = 玩家，B = 敌方。 */
export type RuleSide = 'A' | 'B' | 'both';
export type RuleTo = 'all' | 'front' | 'back' | `faction:${FactionId}` | `role:${Role}`;
/** 事件触发的规则：当“行动者”（见 ev）满足条件时执行 act。 */
export type RuleEv = 'basic' | 'basicHit' | 'heal' | 'cleanse' | 'shieldExpire' | 'shieldBreak' | 'crit' | 'hurt' | 'statusApply';
export type RuleWho = 'actor' | 'target' | 'lowestAlly' | 'foes' | 'allies' | 'randomFoeFront';
export type RuleAct =
  | { k: 'energy'; amount: number; who: RuleWho }
  | { k: 'status'; id: string; turns: number; power?: number; stacks?: number; snapAtk?: number; who: RuleWho }
  | { k: 'cleanse'; n: number; who: RuleWho }
  | { k: 'removeStack'; id: string; who: RuleWho }
  | { k: 'shield'; pct: number; turns: number; who: RuleWho } // 按行动者最大生命的百分比
  | { k: 'heal'; pct: number; who: RuleWho } // 按目标最大生命的百分比
  | { k: 'extend'; turns: number } // statusApply 专用：把刚施加的状态延长
  | { k: 'totem'; amount: number };
/** 所有规则都可以加 needFactions：只有该方（开场时）含不少于 N 个不同阵营才生效。 */
export type RuleFx = ((
  | { t: 'startStatus'; side: RuleSide; to: RuleTo; pick?: 'highestSpd' | 'lowestSpd'; id: string; turns: number; power?: number; stacks?: number } // 开场给状态（turns：持有者行动结束次数）
  | { t: 'roundStatus'; side: RuleSide; to: RuleTo; pick?: 'highestSpd' | 'lowestSpd'; id: string; every: number; at?: number; turns: number; power?: number } // 每 N 回合开始给状态
  | { t: 'startShield'; side: RuleSide; to: RuleTo; pct: number; turns: number } // 开场护体毛（按其最大生命百分比）
  | { t: 'startEnergy'; side: RuleSide; to: RuleTo; amount: number }
  | { t: 'dmgMul'; side: RuleSide; to?: RuleTo; elem?: Elem; mult: number; rounds?: number } // 该方（可限定出手者）造成的伤害倍率；rounds：只在前 N 回合
  | { t: 'takenMul'; side: RuleSide; to?: RuleTo; elem?: Elem; mult: number; rounds?: number; needShield?: boolean; needStatus?: string } // 该方（可限定受击者）受到的伤害倍率
  | { t: 'healMul'; side: RuleSide; mult: number; needStatus?: string } // 该方受到的治疗倍率
  | { t: 'firstHealMul'; side: RuleSide; to?: RuleTo; mult: number } // 治疗者本场第一次有效治疗 ×mult
  | { t: 'firstHealTakenMul'; side: RuleSide; to?: RuleTo; mult: number } // 受治疗者本场第一次受治疗 ×mult
  | { t: 'firstBasicEnergy'; side: RuleSide; to?: RuleTo; amount: number } // 每只猫本场第一次普攻后额外元气
  | { t: 'roundEnergyLowest'; side: RuleSide; amount: number } // 每整轮开始，该方元气最低的猫 +元气
  | { t: 'on'; ev: RuleEv; side: RuleSide; to?: RuleTo; hero?: string; hpBelow?: number; status?: string; cc?: boolean; every?: number; max?: number; per?: 'actor' | 'side' | 'round'; act: RuleAct } // 事件规则：ev 的行动者：basic/basicHit/crit = 出手者，heal = 治疗者，cleanse/statusApply = 施法者，shieldExpire/shieldBreak = 护盾持有者，hurt = 受击者
  | { t: 'critAdd'; side: RuleSide; to: RuleTo; add: number }
  | { t: 'hitAdd'; side: RuleSide; to: RuleTo; add: number; rounds?: number }
  | { t: 'dodgeAdd'; side: RuleSide; to: RuleTo; add: number; rounds?: number } // rounds：只在前 N 回合有效
) & { needFactions?: number });

export interface BattleConfig { seed: number; A: UnitSetup[]; B: UnitSetup[]; maxRounds?: number; startEnergy?: number | { A: number; B: number }; noBonds?: boolean; rules?: RuleFx[] /* 平衡实验用：关闭命名羁绊（阵营同族加成保留） */ }

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
  hit: number; // 命中（抵消对方闪避）
  dodge: number; // 闪避
  dmgReduce: number; // 减伤
  healBonus: number; // 治疗加成
  set4: string[]; // 四件套特效
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
