import { describe, expect, it } from 'vitest';
import { CHAPTERS } from '../src/content/campaign';
import { GACHA_POOLS, QUESTS, SHOP_ITEMS } from '../src/content/economy';
import { EQUIPS, EQUIP_SETS } from '../src/content/equipment';
import { ITEMS } from '../src/content/items';
import { MOBS } from '../src/content/mobs';
import { STORIES } from '../src/content/story';
import type { RuleAct, RuleFx } from '../src/engine/types';
import {
  isChapterDef, isDialogueLine, isEnemySpawn, isEquipDef, isEquipSetDef, isGachaPoolDef,
  isItemDef, isMobDef, isQuestDef, isRewardDef, isRuleAct, isRuleFx, isRuleTo, isShopItemDef,
  isStageDef, isStatBlock, isStoryDef, isWaveDef,
} from '../tools/content-guards';

type Check = (value: unknown) => boolean;
interface Case { name: string; guard: Check; value: Record<string, unknown>; required: string[]; optional?: string[][] }

const acts = {
  energy: { k: 'energy', amount: -10, who: 'actor' },
  status: { k: 'status', id: 'wet', turns: 2, power: 0.2, stacks: 2, snapAtk: 0.3, who: 'foes' },
  cleanse: { k: 'cleanse', n: 1, who: 'allies' },
  removeStack: { k: 'removeStack', id: 'scratch', who: 'target' },
  shield: { k: 'shield', pct: 0.25, turns: 3, who: 'actor' },
  heal: { k: 'heal', pct: 0.1, who: 'lowestAlly' },
  extend: { k: 'extend', turns: 1 },
  totem: { k: 'totem', amount: 1 },
} satisfies Record<RuleAct['k'], RuleAct>;
const rules = {
  startStatus: { t: 'startStatus', side: 'both', to: 'all', pick: 'highestSpd', id: 'wet', turns: 1, power: 0.2, stacks: 2, needFactions: 3 },
  roundStatus: { t: 'roundStatus', side: 'B', to: 'front', pick: 'lowestSpd', id: 'burn', every: 2, at: 2, turns: 1, power: 0.1, needFactions: 2 },
  startShield: { t: 'startShield', side: 'A', to: 'role:先锋', pct: 0.1, turns: 3, needFactions: 1 },
  startEnergy: { t: 'startEnergy', side: 'A', to: 'back', amount: -10, needFactions: 1 },
  dmgMul: { t: 'dmgMul', side: 'B', to: 'faction:wu', elem: 'fire', mult: 1.2, rounds: 2, needFactions: 2 },
  takenMul: { t: 'takenMul', side: 'both', to: 'all', elem: 'thunder', mult: 0.8, rounds: 2, needShield: false, needStatus: 'wet', needFactions: 2 },
  healMul: { t: 'healMul', side: 'A', mult: 1.2, needStatus: 'purr', needFactions: 1 },
  firstHealMul: { t: 'firstHealMul', side: 'A', to: 'back', mult: 1.1, needFactions: 2 },
  firstHealTakenMul: { t: 'firstHealTakenMul', side: 'B', to: 'front', mult: 1.1, needFactions: 2 },
  firstBasicEnergy: { t: 'firstBasicEnergy', side: 'A', to: 'role:守护', amount: -5, needFactions: 2 },
  roundEnergyLowest: { t: 'roundEnergyLowest', side: 'both', amount: 10, needFactions: 1 },
  on: { t: 'on', ev: 'hurt', side: 'B', to: 'all', hero: 'man_mengmiaohuo', hpBelow: 0.5, status: 'wet', cc: false, every: 2, max: 1, per: 'actor', act: acts.status, needFactions: 2 },
  telegraph: { t: 'telegraph', side: 'B', to: 'all', hero: 'wu_zhoumiaoyu', first: false, needFactions: 2 },
  critAdd: { t: 'critAdd', side: 'A', to: 'all', add: -0.1, needFactions: 1 },
  hitAdd: { t: 'hitAdd', side: 'B', to: 'front', add: 0.1, rounds: 2, needFactions: 1 },
  dodgeAdd: { t: 'dodgeAdd', side: 'both', to: 'all', add: 0.1, rounds: 2, needFactions: 1 },
} satisfies Record<RuleFx['t'], RuleFx>;

const reward = { fish: 100, exp: 20, bells: 3, items: [{ id: 'catnip_small', count: 2 }], equips: [{ id: EQUIPS[0].id, count: 1 }], heroShards: [{ heroId: 'qun_dongzhuo', count: 1 }] };
const stats = { hp: 20, atk: 3, def: 2, spd: 1, crit: 0.05, critDmg: 0.1, hit: 0.1, dodge: -0.1, healBonus: 0.1, dmgReduce: 0.1 };
const stage = { ...CHAPTERS[0].stages[0], rewards: reward, firstClear: reward, storyId: 'c1_open', storyPostId: 'c1_boss_post', rule: '规则说明', ruleFx: Object.values(rules) };
const contentCases: Case[] = [
  { name: 'ItemDef', guard: isItemDef, value: { ...ITEMS[0], stack: 9999 }, required: ['id', 'name', 'kind', 'quality', 'desc'], optional: [['stack']] },
  { name: 'StatBlock', guard: isStatBlock, value: stats, required: [], optional: Object.keys(stats).map((key) => [key]) },
  { name: 'RewardDef', guard: isRewardDef, value: reward, required: [], optional: Object.keys(reward).map((key) => [key]) },
  { name: 'EquipDef', guard: isEquipDef, value: { ...EQUIPS[0], setId: EQUIP_SETS[0].id, base: stats, growth: stats }, required: ['id', 'name', 'slot', 'quality', 'base', 'growth', 'levelCap', 'flavor'], optional: [['setId']] },
  { name: 'EquipSetDef', guard: isEquipSetDef, value: { ...EQUIP_SETS[0], faction: 'wei', bonus4: { ...EQUIP_SETS[0].bonus4, note: '特殊效果' } }, required: ['id', 'name', 'flavor', 'bonus2', 'bonus4'], optional: [['faction'], ['bonus4', 'note']] },
  { name: 'EnemySpawn', guard: isEnemySpawn, value: { unit: 'mob_wei_guard', level: 8, pos: 0, mods: ['elite'] }, required: ['unit', 'level', 'pos'], optional: [['mods']] },
  { name: 'WaveDef', guard: isWaveDef, value: { ...stage.waves[0] }, required: ['enemies'] },
  { name: 'StageDef', guard: isStageDef, value: stage, required: ['id', 'name', 'kind', 'recommendedPower', 'waves', 'rewards', 'firstClear'], optional: [['storyId'], ['storyPostId'], ['rule'], ['ruleFx']] },
  { name: 'ChapterDef', guard: isChapterDef, value: { ...CHAPTERS[0], stages: [stage] }, required: ['id', 'name', 'theme', 'focusFactions', 'intro', 'stages', 'bossNote'] },
  { name: 'MobDef', guard: isMobDef, value: { ...MOBS[0] }, required: ['id', 'name', 'faction', 'role', 'hpMul', 'atkMul', 'desc', 'lookHint'] },
  { name: 'DialogueLine', guard: isDialogueLine, value: { ...STORIES[0].lines[0], mood: 'normal' }, required: ['who', 'text'], optional: [['mood']] },
  { name: 'StoryDef', guard: isStoryDef, value: { ...STORIES[0] }, required: ['id', 'title', 'lines'] },
  { name: 'QuestDef', guard: isQuestDef, value: { ...QUESTS[0], reward }, required: ['id', 'kind', 'name', 'desc', 'goal', 'reward'] },
  { name: 'GachaPoolDef', guard: isGachaPoolDef, value: { ...GACHA_POOLS[0], faction: 'wei', upHeroes: ['wei_caomiaode'] }, required: ['id', 'name', 'kind', 'rates', 'pity', 'cost'], optional: [['faction'], ['upHeroes']] },
  { name: 'ShopItemDef', guard: isShopItemDef, value: { ...SHOP_ITEMS[0], weeklyLimit: 2 }, required: ['id', 'shop', 'item', 'price'], optional: [['weeklyLimit']] },
];
const actCases: Case[] = Object.entries(acts).map(([name, value]) => ({ name: `RuleAct.${name}`, guard: isRuleAct, value,
  required: Object.keys(value).filter((key) => !['power', 'stacks', 'snapAtk'].includes(key)),
  optional: name === 'status' ? [['power'], ['stacks'], ['snapAtk']] : [] }));
const ruleOptional: Record<RuleFx['t'], string[]> = {
  startStatus: ['pick', 'power', 'stacks'], roundStatus: ['pick', 'at', 'power'], startShield: [], startEnergy: [],
  dmgMul: ['to', 'elem', 'rounds'], takenMul: ['to', 'elem', 'rounds', 'needShield', 'needStatus'], healMul: ['needStatus'],
  firstHealMul: ['to'], firstHealTakenMul: ['to'], firstBasicEnergy: ['to'], roundEnergyLowest: [],
  on: ['to', 'hero', 'hpBelow', 'status', 'cc', 'every', 'max', 'per'], telegraph: ['to', 'hero', 'first'],
  critAdd: [], hitAdd: ['rounds'], dodgeAdd: ['rounds'],
};
const ruleCases: Case[] = Object.values(rules).map((value) => {
  const optional = [...ruleOptional[value.t], 'needFactions'];
  return { name: `RuleFx.${value.t}`, guard: isRuleFx, value, required: Object.keys(value).filter((key) => !optional.includes(key)), optional: optional.map((key) => [key]) };
});
const cases = [...contentCases, ...actCases, ...ruleCases];
const stages = CHAPTERS.flatMap((chapter) => chapter.stages);
const allRules = stages.flatMap((s) => s.ruleFx ?? []);

function replaceAt(value: unknown, path: string[], replacement: unknown): unknown {
  if (!path.length) return replacement;
  const [key, ...rest] = path;
  if (Array.isArray(value)) { const out = value.slice(); out[Number(key)] = replaceAt(value[Number(key)], rest, replacement); return out; }
  if (!value || typeof value !== 'object') throw new Error('损坏样例路径不在对象上');
  const out: Record<string, unknown> = Object.fromEntries(Object.entries(value));
  out[key] = replaceAt(out[key], rest, replacement); return out;
}
function leaves(value: unknown, path: string[] = []): { path: string[]; value: unknown }[] {
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([key, child]) => leaves(child, [...path, key]));
  return [{ path, value }];
}
function freezeDeep(value: unknown): void {
  if (value && typeof value === 'object') { Object.freeze(value); for (const child of Object.values(value)) freezeDeep(child); }
}

describe('全部真实内容记录与嵌套结构', () => {
  const catalogues = [
    { name: 'items', guard: isItemDef, values: ITEMS },
    { name: 'equips', guard: isEquipDef, values: EQUIPS },
    { name: 'sets', guard: isEquipSetDef, values: EQUIP_SETS },
    { name: 'stats', guard: isStatBlock, values: [...EQUIPS.flatMap((e) => [e.base, e.growth]), ...EQUIP_SETS.flatMap((s) => [s.bonus2.stats, s.bonus4.stats])] },
    { name: 'rewards', guard: isRewardDef, values: [...stages.flatMap((s) => [s.rewards, s.firstClear]), ...QUESTS.map((q) => q.reward)] },
    { name: 'enemies', guard: isEnemySpawn, values: stages.flatMap((s) => s.waves.flatMap((w) => w.enemies)) },
    { name: 'waves', guard: isWaveDef, values: stages.flatMap((s) => s.waves) },
    { name: 'stages', guard: isStageDef, values: stages },
    { name: 'chapters', guard: isChapterDef, values: CHAPTERS },
    { name: 'mobs', guard: isMobDef, values: MOBS },
    { name: 'lines', guard: isDialogueLine, values: STORIES.flatMap((s) => s.lines) },
    { name: 'stories', guard: isStoryDef, values: STORIES },
    { name: 'quests', guard: isQuestDef, values: QUESTS },
    { name: 'pools', guard: isGachaPoolDef, values: GACHA_POOLS },
    { name: 'shops', guard: isShopItemDef, values: SHOP_ITEMS },
    { name: 'rules', guard: isRuleFx, values: allRules },
    { name: 'actions', guard: isRuleAct, values: allRules.flatMap((r) => r.t === 'on' ? [r.act] : []) },
  ];
  it.each(catalogues)('$name 每条真实记录均通过且不变', ({ name, guard, values }) => {
    expect(values.length).toBeGreaterThan(0);
    const before = structuredClone(values);
    for (const [index, value] of values.entries()) expect(guard(value), `${name}[${index}]`).toBe(true);
    expect(values).toEqual(before);
  });
});

describe('固定完整正例与逐字段损坏', () => {
  it.each(cases)('$name 检查必填字段、非null对象并允许额外字段', (spec) => {
    const frozen = structuredClone(spec.value); freezeDeep(frozen);
    expect(spec.guard(frozen)).toBe(true);
    for (const bad of [null, undefined, [], 'record', 1, true, () => ({})]) expect(spec.guard(bad)).toBe(false);
    for (const key of spec.required) {
      const missing = Object.fromEntries(Object.entries(spec.value).filter(([k]) => k !== key));
      expect(spec.guard(missing), `缺少 ${key}`).toBe(false);
      expect(spec.guard({ ...spec.value, [key]: null }), `${key}=null`).toBe(false);
    }
    expect(spec.guard({ ...spec.value, futureField: { n: NaN } })).toBe(true);
  });

  it.each(cases)('$name 所有声明可选字段检查类型并允许undefined', (spec) => {
    for (const path of spec.optional ?? []) {
      expect(spec.guard(replaceAt(spec.value, path, undefined)), path.join('.')).toBe(true);
      expect(spec.guard(replaceAt(spec.value, path, null)), path.join('.')).toBe(false);
    }
  });

  it.each(cases)('$name 深层数字NaN/Infinity及其它原始类型损坏均被拒绝', (spec) => {
    const before = structuredClone(spec.value);
    for (const { path, value } of leaves(spec.value)) {
      const invalid = typeof value === 'number' ? [NaN, Infinity, -Infinity, '1'] : typeof value === 'string' ? [1, true] : typeof value === 'boolean' ? [1, 'false'] : [];
      for (const replacement of invalid) expect(spec.guard(replaceAt(spec.value, path, replacement)), `${path.join('.')} → ${String(replacement)}`).toBe(false);
    }
    expect(spec.value).toEqual(before);
  });
});

describe('选择器、联合类型和结构边界', () => {
  it('精确接受全部RuleTo而拒绝拼错、前后缀和原型键', () => {
    for (const selector of ['all', 'front', 'back', ...['wei', 'shu', 'wu', 'qun', 'man', 'xian'].map((f) => `faction:${f}`), ...['守护', '先锋', '神射', '谋士', '医者', '刺客'].map((r) => `role:${r}`)]) expect(isRuleTo(selector), selector).toBe(true);
    for (const selector of ['frontRow', 'faction:weix', 'faction:Wei', 'role:guard', 'role:先锋猫', 'xrole:先锋', 'role:先锋 ', 'faction:constructor', 'constructor', '__proto__', null, 1]) expect(isRuleTo(selector), String(selector)).toBe(false);
    for (const t of ['newRule', '__proto__', 'constructor', 'toString']) expect(isRuleFx({ ...rules.startEnergy, t })).toBe(false);
    for (const k of ['damage', '__proto__', 'constructor']) expect(isRuleAct({ ...acts.energy, k })).toBe(false);
  });

  it('验证每个事件/actor/period/元素/pick联合值，并拒绝未知或错误值', () => {
    for (const ev of ['basic', 'basicHit', 'heal', 'cleanse', 'shieldExpire', 'shieldBreak', 'crit', 'hurt', 'statusApply']) expect(isRuleFx({ ...rules.on, ev })).toBe(true);
    for (const who of ['actor', 'target', 'lowestAlly', 'foes', 'allies', 'randomFoeFront']) expect(isRuleAct({ ...acts.heal, who })).toBe(true);
    for (const per of ['actor', 'side', 'round']) expect(isRuleFx({ ...rules.on, per })).toBe(true);
    for (const elem of ['phys', 'magic', 'fire', 'water', 'thunder', 'true']) expect(isRuleFx({ ...rules.takenMul, elem })).toBe(true);
    for (const pick of ['highestSpd', 'lowestSpd']) expect(isRuleFx({ ...rules.startStatus, pick })).toBe(true);
    for (const value of [true, 'actorish']) {
      expect(isRuleFx({ ...rules.on, ev: value })).toBe(false); expect(isRuleFx({ ...rules.on, per: value })).toBe(false);
      expect(isRuleFx({ ...rules.startStatus, pick: value })).toBe(false); expect(isRuleAct({ ...acts.heal, who: value })).toBe(false);
      expect(isRuleFx({ ...rules.takenMul, elem: value })).toBe(false);
    }
    for (const side of ['A', 'B', 'both']) expect(isRuleFx({ ...rules.on, side })).toBe(true);
    expect(isRuleFx({ ...rules.on, side: 'ally' })).toBe(false);
    for (const act of Object.values(acts)) expect(isStageDef({ ...stage, ruleFx: [{ ...rules.on, act }] })).toBe(true);
  });

  it('内容字符串联合类型不接受相似但未声明的值', () => {
    expect(isItemDef({ ...ITEMS[0], kind: 'resource' })).toBe(false); expect(isItemDef({ ...ITEMS[0], quality: 'mythic' })).toBe(false);
    expect(isEquipDef({ ...EQUIPS[0], slot: 'helmet' })).toBe(false); expect(isStageDef({ ...stage, kind: 'raid' })).toBe(false);
    expect(isMobDef({ ...MOBS[0], role: 'guard' })).toBe(false); expect(isMobDef({ ...MOBS[0], faction: 'neutral' })).toBe(false);
    expect(isDialogueLine({ ...STORIES[0].lines[0], mood: 'sleepy' })).toBe(false); expect(isQuestDef({ ...QUESTS[0], kind: 'event' })).toBe(false);
    expect(isGachaPoolDef({ ...GACHA_POOLS[0], kind: 'premium' })).toBe(false); expect(isShopItemDef({ ...SHOP_ITEMS[0], shop: 'premium' })).toBe(false);
  });

  it('拒绝稀疏数组、数组冒充记录和错误深层分支', () => {
    const hole = new Array(1);
    const invalid: [Check, unknown][] = [
      [isRewardDef, { items: hole }], [isRewardDef, { equips: [{ id: 'x' }] }], [isRewardDef, { heroShards: [{ id: 'x', count: 1 }] }],
      [isStatBlock, []], [isEnemySpawn, { unit: 'x', level: 1, pos: 0, mods: hole }], [isWaveDef, { enemies: hole }],
      [isStageDef, { ...stage, waves: hole }], [isStageDef, { ...stage, ruleFx: hole }], [isStageDef, { ...stage, ruleFx: [{ ...rules.on, act: [acts.heal] }] }],
      [isStageDef, { ...stage, ruleFx: [{ t: 'on', ev: 'hurt', side: 'A', act: { k: 'shield', who: 'actor', pct: 0.1 } }] }],
      [isChapterDef, { ...CHAPTERS[0], stages: hole }], [isChapterDef, { ...CHAPTERS[0], focusFactions: hole }],
      [isStoryDef, { id: 'x', title: 'x', lines: hole }], [isQuestDef, { ...QUESTS[0], goal: [] }],
      [isGachaPoolDef, { ...GACHA_POOLS[0], upHeroes: hole }], [isGachaPoolDef, { ...GACHA_POOLS[0], cost: { single: [], ten: [] } }],
      [isEquipSetDef, { ...EQUIP_SETS[0], bonus4: { desc: 'x', stats: { crit: '0.1' } } }],
      [isShopItemDef, { ...SHOP_ITEMS[0], price: { id: 'bells', count: 1 } }],
    ];
    for (const [guard, value] of invalid) expect(guard(value)).toBe(false);
  });

  it('保留结构类型合法空值、负数、额外循环字段，不增设语义或曲线约束', () => {
    expect(isStatBlock({})).toBe(true); expect(isRewardDef({})).toBe(true);
    expect(isStatBlock({ crit: undefined, atk: -1 })).toBe(true); expect(isRewardDef({ fish: undefined, items: [] })).toBe(true);
    expect(isWaveDef({ enemies: [] })).toBe(true); expect(isStoryDef({ id: '', title: '', lines: [] })).toBe(true);
    expect(isRuleAct({ k: 'energy', amount: -10, who: 'actor' })).toBe(true); expect(isRuleFx({ t: 'critAdd', side: 'A', to: 'all', add: -0.1 })).toBe(true);
    const cyclic = { ...ITEMS[0], extra: {} }; cyclic.extra = cyclic;
    expect(isItemDef(cyclic)).toBe(true); expect(cyclic.extra).toBe(cyclic);
    expect(isGachaPoolDef({ ...GACHA_POOLS[0], rates: { UR: 0.2, SSR: 0.2, SR: 0.2 } })).toBe(true);
    expect(isRewardDef({ heroShards: [{ heroId: 'unresolved_reference', count: 1 }] })).toBe(true);
    expect(isRuleAct({ k: 'extend', turns: 1, who: null })).toBe(true); // who 并非该分支声明字段。
  });
});
