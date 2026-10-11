// 内容数据的契约（schema）。内容文件（equipment / campaign / story / economy）都必须符合这里的类型。
// 修改本文件需要 Claude 评审；只往 content 下的数据文件里“填内容”不需要。
import type { FactionId } from '../data/factions';

export type Quality = 'common' | 'fine' | 'rare' | 'epic' | 'legend'; // 普通 精良 稀有 史诗 传说
export type StatKey = 'hp' | 'atk' | 'def' | 'spd' | 'crit' | 'critDmg' | 'hit' | 'dodge' | 'healBonus' | 'dmgReduce';
export type StatBlock = Partial<Record<StatKey, number>>; // hp/atk/def/spd 为绝对值，其余为小数百分比（0.05 = 5%）

// ---------- 道具 ----------
export type ItemKind = 'currency' | 'material' | 'chest' | 'shard' | 'ticket' | 'consumable';
export interface ItemDef {
  id: string; // 小写下划线，如 fish_dry
  name: string;
  kind: ItemKind;
  quality: Quality;
  desc: string; // 一句话描述，带猫味幽默
  stack?: number; // 堆叠上限，默认 9999
}
export interface RewardDef {
  fish?: number; // 小鱼干（金币）
  exp?: number; // 经验
  bells?: number; // 金铃铛（钻石）
  items?: { id: string; count: number }[];
  equips?: { id: string; count: number }[];
  heroShards?: { heroId: string; count: number }[];
}

// ---------- 装备 ----------
export type EquipSlot = 'weapon' | 'armor' | 'head' | 'charm'; // 武器 / 铠甲 / 头饰 / 铃铛饰品
export interface EquipDef {
  id: string;
  name: string; // 猫味名字：如「鱼骨偃月刀」
  slot: EquipSlot;
  quality: Quality;
  setId?: string;
  base: StatBlock; // 1 级属性
  growth: StatBlock; // 每级成长（绝对值同 base 口径）
  levelCap: number;
  flavor: string; // 风味文本
}
export interface EquipSetDef {
  id: string;
  name: string;
  faction?: FactionId; // 偏向阵营（可空 = 通用）
  flavor: string;
  bonus2: { desc: string; stats: StatBlock };
  bonus4: { desc: string; stats: StatBlock; note?: string }; // note 用于描述无法用面板表达的特殊效果
}

// ---------- 战役 ----------
export interface EnemySpawn {
  unit: string; // 英雄 id（Boss / 精英）或 mob id（杂兵）
  level: number;
  pos: number; // 0-2 前排，3-4 后排
  mods?: string[]; // 词缀 id，如 'elite', 'thorns'
}
export interface WaveDef { enemies: EnemySpawn[] }
export type StageKind = 'normal' | 'elite' | 'boss';
export interface StageDef {
  id: string; // '1-1'
  name: string;
  kind: StageKind;
  recommendedPower: number;
  waves: WaveDef[]; // 1~3 波
  rewards: RewardDef; // 每次挂机/战斗奖励（单次）
  firstClear: RewardDef;
  storyId?: string; // 触发的剧情 id（story.ts）
  rule?: string; // 关卡特殊规则，一句话，如「全场淋湿，火焰伤害 +30%」
}
export interface ChapterDef {
  id: number;
  name: string;
  theme: string; // 场景主题：如「黄昏纸箱街」
  focusFactions: FactionId[];
  intro: string;
  stages: StageDef[];
  bossNote: string; // Boss 机制设计说明（给战斗引擎实现者看）
}
export interface MobDef {
  id: string;
  name: string; // 如「山贼喵」
  faction: FactionId;
  role: '守护' | '先锋' | '神射' | '谋士' | '医者' | '刺客';
  hpMul: number; // 相对同等级基础属性的倍率
  atkMul: number;
  desc: string;
  lookHint: string; // 给美术看的外观提示（毛色、装束），不是代码
}

// ---------- 剧情 ----------
export interface DialogueLine {
  who: string; // 英雄 id 或 'narrator' / 'player'
  text: string; // 单句不超过 50 字
  mood?: 'normal' | 'happy' | 'angry' | 'sad' | 'surprised' | 'sly';
}
export interface StoryDef {
  id: string; // 'c1_s1_pre'
  title: string;
  lines: DialogueLine[];
}

// ---------- 经济与任务 ----------
export interface QuestDef {
  id: string;
  kind: 'daily' | 'weekly' | 'achievement' | 'newbie';
  name: string;
  desc: string;
  goal: { type: string; target: number }; // type 例：clear_stage / spend_fish / recruit / level_up_hero
  reward: RewardDef;
}
export interface GachaPoolDef {
  id: string;
  name: string;
  kind: 'normal' | 'faction' | 'up' | 'newbie';
  faction?: FactionId;
  rates: { UR: number; SSR: number; SR: number }; // 小数，和为 1
  pity: { ssrWithin: number; urWithin: number; upGuarantee: boolean };
  upHeroes?: string[];
  cost: { single: { item: string; count: number }; ten: { item: string; count: number } };
}
export interface ShopItemDef {
  id: string;
  shop: 'general' | 'arena' | 'guild' | 'tower' | 'faction';
  item: { id: string; count: number };
  price: { item: string; count: number };
  weeklyLimit?: number;
}
