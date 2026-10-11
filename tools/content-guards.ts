// 内容导入/工具的结构检查：只读 unknown，不修复、不校验引用或数值曲线。
import type {
  ChapterDef, DialogueLine, EnemySpawn, EquipDef, EquipSetDef, GachaPoolDef, ItemDef,
  MobDef, QuestDef, RewardDef, ShopItemDef, StageDef, StatBlock, StoryDef, WaveDef,
} from '../src/content/types';
import type { FactionId } from '../src/data/factions';
import type { Role } from '../src/data/heroes';
import type { RuleAct, RuleFx, RuleTo } from '../src/engine/types';

type RecordValue = Record<string, unknown>;
type Check = (value: unknown) => boolean;
const text: Check = (v) => typeof v === 'string';
const number: Check = (v) => typeof v === 'number' && Number.isFinite(v);
const boolean: Check = (v) => typeof v === 'boolean';
const record = (v: unknown): v is RecordValue => typeof v === 'object' && v !== null && !Array.isArray(v);
const optional = (v: RecordValue, key: string, check: Check): boolean => v[key] === undefined || check(v[key]);
const oneOf = (v: unknown, values: readonly string[]): boolean => typeof v === 'string' && values.includes(v);
function arrayOf(v: unknown, check: Check): boolean {
  if (!Array.isArray(v)) return false;
  // every 跳过稀疏洞；这里将每个洞按 undefined 检查。
  for (let i = 0; i < v.length; i++) if (!check(v[i])) return false;
  return true;
}
const texts: Check = (v) => arrayOf(v, text);
const FACTIONS = { wei: true, shu: true, wu: true, qun: true, man: true, xian: true } satisfies Record<FactionId, boolean>;
const ROLES = { 守护: true, 先锋: true, 神射: true, 谋士: true, 医者: true, 刺客: true } satisfies Record<Role, boolean>;
const faction: Check = (v) => typeof v === 'string' && Object.hasOwn(FACTIONS, v);
const role: Check = (v) => typeof v === 'string' && Object.hasOwn(ROLES, v);
const quality: Check = (v) => oneOf(v, ['common', 'fine', 'rare', 'epic', 'legend']);
const side: Check = (v) => oneOf(v, ['A', 'B', 'both']);
const elem: Check = (v) => oneOf(v, ['phys', 'magic', 'fire', 'water', 'thunder', 'true']);
const pick: Check = (v) => oneOf(v, ['highestSpd', 'lowestSpd']);
const who: Check = (v) => oneOf(v, ['actor', 'target', 'lowestAlly', 'foes', 'allies', 'randomFoeFront']);

export function isRuleTo(v: unknown): v is RuleTo {
  if (oneOf(v, ['all', 'front', 'back'])) return true;
  if (typeof v !== 'string') return false;
  return v.startsWith('faction:') ? faction(v.slice(8)) : v.startsWith('role:') && role(v.slice(5));
}

const ACT_CHECKS: Record<RuleAct['k'], (v: RecordValue) => boolean> = {
  energy: (v) => number(v.amount) && who(v.who),
  status: (v) => text(v.id) && number(v.turns) && who(v.who)
    && optional(v, 'power', number) && optional(v, 'stacks', number) && optional(v, 'snapAtk', number),
  cleanse: (v) => number(v.n) && who(v.who),
  removeStack: (v) => text(v.id) && who(v.who),
  shield: (v) => number(v.pct) && number(v.turns) && who(v.who),
  heal: (v) => number(v.pct) && who(v.who),
  extend: (v) => number(v.turns),
  totem: (v) => number(v.amount),
};
function actKind(v: unknown): v is RuleAct['k'] { return typeof v === 'string' && Object.hasOwn(ACT_CHECKS, v); }
export function isRuleAct(v: unknown): v is RuleAct {
  return record(v) && actKind(v.k) && ACT_CHECKS[v.k](v);
}

const optionalTo = (v: RecordValue) => optional(v, 'to', isRuleTo);
const optionalElem = (v: RecordValue) => optional(v, 'elem', elem);
const optionalRounds = (v: RecordValue) => optional(v, 'rounds', number);
const FX_CHECKS: Record<RuleFx['t'], (v: RecordValue) => boolean> = {
  startStatus: (v) => isRuleTo(v.to) && text(v.id) && number(v.turns) && optional(v, 'pick', pick)
    && optional(v, 'power', number) && optional(v, 'stacks', number),
  roundStatus: (v) => isRuleTo(v.to) && text(v.id) && number(v.every) && number(v.turns)
    && optional(v, 'pick', pick) && optional(v, 'at', number) && optional(v, 'power', number),
  startShield: (v) => isRuleTo(v.to) && number(v.pct) && number(v.turns),
  startEnergy: (v) => isRuleTo(v.to) && number(v.amount),
  dmgMul: (v) => number(v.mult) && optionalTo(v) && optionalElem(v) && optionalRounds(v),
  takenMul: (v) => number(v.mult) && optionalTo(v) && optionalElem(v) && optionalRounds(v)
    && optional(v, 'needShield', boolean) && optional(v, 'needStatus', text),
  healMul: (v) => number(v.mult) && optional(v, 'needStatus', text),
  firstHealMul: (v) => number(v.mult) && optionalTo(v),
  firstHealTakenMul: (v) => number(v.mult) && optionalTo(v),
  firstBasicEnergy: (v) => number(v.amount) && optionalTo(v),
  roundEnergyLowest: (v) => number(v.amount),
  on: (v) => oneOf(v.ev, ['basic', 'basicHit', 'heal', 'cleanse', 'shieldExpire', 'shieldBreak', 'crit', 'hurt', 'statusApply'])
    && optionalTo(v) && optional(v, 'hero', text) && optional(v, 'hpBelow', number) && optional(v, 'status', text)
    && optional(v, 'cc', boolean) && optional(v, 'every', number) && optional(v, 'max', number)
    && optional(v, 'per', (p) => oneOf(p, ['actor', 'side', 'round'])) && isRuleAct(v.act),
  telegraph: (v) => optionalTo(v) && optional(v, 'hero', text) && optional(v, 'first', boolean),
  critAdd: (v) => isRuleTo(v.to) && number(v.add),
  hitAdd: (v) => isRuleTo(v.to) && number(v.add) && optionalRounds(v),
  dodgeAdd: (v) => isRuleTo(v.to) && number(v.add) && optionalRounds(v),
};
function fxKind(v: unknown): v is RuleFx['t'] { return typeof v === 'string' && Object.hasOwn(FX_CHECKS, v); }
export function isRuleFx(v: unknown): v is RuleFx {
  return record(v) && fxKind(v.t) && side(v.side) && optional(v, 'needFactions', number) && FX_CHECKS[v.t](v);
}

export function isStatBlock(v: unknown): v is StatBlock {
  return record(v) && ['hp', 'atk', 'def', 'spd', 'crit', 'critDmg', 'hit', 'dodge', 'healBonus', 'dmgReduce'].every((key) => optional(v, key, number));
}
export function isItemDef(v: unknown): v is ItemDef {
  return record(v) && text(v.id) && text(v.name) && text(v.desc) && quality(v.quality)
    && oneOf(v.kind, ['currency', 'material', 'chest', 'shard', 'ticket', 'consumable']) && optional(v, 'stack', number);
}
function itemCount(v: unknown): boolean { return record(v) && text(v.id) && number(v.count); }
function heroShard(v: unknown): boolean { return record(v) && text(v.heroId) && number(v.count); }
export function isRewardDef(v: unknown): v is RewardDef {
  return record(v) && optional(v, 'fish', number) && optional(v, 'exp', number) && optional(v, 'bells', number)
    && optional(v, 'items', (x) => arrayOf(x, itemCount)) && optional(v, 'equips', (x) => arrayOf(x, itemCount))
    && optional(v, 'heroShards', (x) => arrayOf(x, heroShard));
}
export function isEquipDef(v: unknown): v is EquipDef {
  return record(v) && text(v.id) && text(v.name) && oneOf(v.slot, ['weapon', 'armor', 'head', 'charm']) && quality(v.quality)
    && optional(v, 'setId', text) && isStatBlock(v.base) && isStatBlock(v.growth) && number(v.levelCap) && text(v.flavor);
}
function bonus(v: unknown): boolean { return record(v) && text(v.desc) && isStatBlock(v.stats); }
function bonus4(v: unknown): boolean { return record(v) && bonus(v) && optional(v, 'note', text); }
export function isEquipSetDef(v: unknown): v is EquipSetDef {
  return record(v) && text(v.id) && text(v.name) && text(v.flavor) && optional(v, 'faction', faction) && bonus(v.bonus2) && bonus4(v.bonus4);
}
export function isEnemySpawn(v: unknown): v is EnemySpawn {
  return record(v) && text(v.unit) && number(v.level) && number(v.pos) && optional(v, 'mods', texts);
}
export function isWaveDef(v: unknown): v is WaveDef { return record(v) && arrayOf(v.enemies, isEnemySpawn); }
export function isStageDef(v: unknown): v is StageDef {
  return record(v) && text(v.id) && text(v.name) && oneOf(v.kind, ['normal', 'elite', 'boss']) && number(v.recommendedPower)
    && arrayOf(v.waves, isWaveDef) && isRewardDef(v.rewards) && isRewardDef(v.firstClear)
    && optional(v, 'storyId', text) && optional(v, 'storyPostId', text) && optional(v, 'rule', text)
    && optional(v, 'ruleFx', (x) => arrayOf(x, isRuleFx));
}
export function isChapterDef(v: unknown): v is ChapterDef {
  return record(v) && number(v.id) && text(v.name) && text(v.theme) && arrayOf(v.focusFactions, faction)
    && text(v.intro) && arrayOf(v.stages, isStageDef) && text(v.bossNote);
}
export function isMobDef(v: unknown): v is MobDef {
  return record(v) && text(v.id) && text(v.name) && faction(v.faction) && role(v.role)
    && number(v.hpMul) && number(v.atkMul) && text(v.desc) && text(v.lookHint);
}
export function isDialogueLine(v: unknown): v is DialogueLine {
  return record(v) && text(v.who) && text(v.text) && optional(v, 'mood', (x) => oneOf(x, ['normal', 'happy', 'angry', 'sad', 'surprised', 'sly']));
}
export function isStoryDef(v: unknown): v is StoryDef { return record(v) && text(v.id) && text(v.title) && arrayOf(v.lines, isDialogueLine); }
function goal(v: unknown): boolean { return record(v) && text(v.type) && number(v.target); }
export function isQuestDef(v: unknown): v is QuestDef {
  return record(v) && text(v.id) && oneOf(v.kind, ['daily', 'weekly', 'achievement', 'newbie'])
    && text(v.name) && text(v.desc) && goal(v.goal) && isRewardDef(v.reward);
}
function rates(v: unknown): boolean { return record(v) && number(v.UR) && number(v.SSR) && number(v.SR); }
function pity(v: unknown): boolean { return record(v) && number(v.ssrWithin) && number(v.urWithin) && boolean(v.upGuarantee); }
function price(v: unknown): boolean { return record(v) && text(v.item) && number(v.count); }
function costs(v: unknown): boolean { return record(v) && price(v.single) && price(v.ten); }
export function isGachaPoolDef(v: unknown): v is GachaPoolDef {
  return record(v) && text(v.id) && text(v.name) && oneOf(v.kind, ['normal', 'faction', 'up', 'newbie'])
    && optional(v, 'faction', faction) && rates(v.rates) && pity(v.pity) && optional(v, 'upHeroes', texts) && costs(v.cost);
}
export function isShopItemDef(v: unknown): v is ShopItemDef {
  return record(v) && text(v.id) && oneOf(v.shop, ['general', 'arena', 'guild', 'tower', 'faction'])
    && itemCount(v.item) && price(v.price) && optional(v, 'weeklyLimit', number);
}
