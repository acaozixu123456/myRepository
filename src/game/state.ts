// 玩家状态与存档。纯逻辑，不依赖 DOM（存档读写通过 Storage 接口注入，便于测试）。
// 养成成本取自 content/progression；初始资源与装备/商店接入仍是原型口径。
import { HERO_BY_ID, HEROES } from '../data/heroes';
import type { Rarity } from '../data/heroes';
import { baseStats } from '../data/systems';
import type { StatBlock } from '../content/types';
import { ITEMS } from '../content/items';
import { HERO_LEVEL_CAP, expToNext, levelUpFishCost, skillUpgradeCost, starUpShards } from '../content/progression';
import { heroGear } from './gear';
import { addItem, createInventory, normalizeInventory } from './inventory';
import type { InventoryState } from './inventory';
import { createQuestState, normalizeQuestState, track } from './quests';
import type { QuestState } from './quests';
import { createShopState, normalizeShopState } from './shop';
import type { ShopState } from './shop';
import type { PayState } from './premium';
import { affMul } from './affection';
import type { AffState } from './affection';
import type { EventState } from './events';
import type { GuildBossState } from './guildboss';
import type { NestState } from './nest';
import type { GuildState } from './guild';
import type { BossState } from './worldboss';
import type { SocialState } from './social';
import type { DailyState } from './daily';
import type { DungeonState } from './dungeon';

export interface HeroState {
  id: string;
  lv: number;
  star: number; // 1~5
  shards: number; // 多余碎片（用于升星）
  skillLv: number; // 绝技等级 1~10
  awaken?: 'A' | 'B';
  aff?: AffState; // 好感度（撸毛 / 点心）
}

export interface Resources {
  fish: number; // 小鱼干
  bells: number; // 金铃铛
  catnip: number; // 猫薄荷（每份 500 点成长经验，经验池不足时自动折算）
  exp: number; // 成长经验池（关卡 / 挂机获得）
  tickets: number; // 招福符
  yarn: number; // 毛线球
  moon: number; // 月光珠（付费货币，见 game/premium.ts）
}

export interface PlayerState {
  v: 1;
  name: string;
  level: number;
  exp: number;
  res: Resources;
  inventory: InventoryState; // 追加的版本化背包；旧资源仍由 res 保存
  quests: QuestState;
  pending?: Record<string, number>; // 仅旧档满叠未迁军需；新奖励不写入
  shop: ShopState; // 每周限购记录；存档 v 仍为 1
  dungeon?: DungeonState; // 日常秘境：每日次数与已通关档位
  daily?: DailyState; // 七日签到 / 快速探索
  events?: EventState; // 活动中心
  wboss?: BossState; // 世界 Boss
  nest?: NestState; // 猫窝
  gboss?: GuildBossState; // 公会 Boss
  guild?: GuildState; // 公会（旧存档读取时补齐）
  social?: SocialState; // 世界聊天 / 好友 / 竞技场（旧存档读取时补齐）
  pay?: PayState; // 氪金：累计充值 / 月卡 / VIP / 至尊保底（旧存档读取时补齐）
  heroes: Record<string, HeroState>;
  lineup: (string | null)[]; // 0-2 前排，3-4 后排
  stage: { chapter: number; index: number; wins: number }; // 当前挂机关卡（≤ best）
  tower?: { floor: number }; // 爬塔：已通关的最高层
  best?: { chapter: number; index: number }; // 已通关的最远关卡（推进进度）
  pity: { ssr: number; ur: number; upLost: boolean };
  idle: { last: number; fish: number; exp: number };
  gift: { last: number };
  seen: string[];
  stories?: string[]; // 已看过的剧情 id
  tips?: string[]; // 已完成的新手引导步骤
  settings: { speed: number; sound?: boolean; music?: boolean; illustSprite?: boolean };
}

export const MAX_STAR = 5;
export const CATNIP_EXP = 500;
export const LINEUP_SIZE = 5;

export function newPlayer(now = Date.now()): PlayerState {
  const start = ['wei_xiahoudun', 'wei_guojia', 'wu_huanggai', 'qun_dongzhuo', 'man_wutugu'];
  const heroes: Record<string, HeroState> = {};
  for (const id of start) heroes[id] = { id, lv: 8, star: 1, shards: 0, skillLv: 1 };
  return {
    v: 1,
    name: '铲屎官',
    level: 1,
    exp: 0,
    res: { fish: 3000, bells: 3200, catnip: 12, exp: 0, tickets: 6, yarn: 3, moon: 0 },
    inventory: createInventory(),
    quests: createQuestState(now),
    shop: createShopState(now),
    heroes,
    lineup: ['wei_xiahoudun', 'wu_huanggai', 'man_wutugu', 'wei_guojia', 'qun_dongzhuo'],
    stage: { chapter: 1, index: 1, wins: 0 },
    best: { chapter: 1, index: 1 },
    pity: { ssr: 0, ur: 0, upLost: false },
    idle: { last: now, fish: 0, exp: 0 },
    gift: { last: 0 },
    seen: start.slice(),
    stories: [],
    tips: [],
    tower: { floor: 0 },
    settings: { speed: 2 },
  };
}

// ---------- 存档 ----------
export const SAVE_KEY = 'maoguozhi.save.v1';
export interface StorageLike { getItem(k: string): string | null; setItem(k: string, v: string): void }

export function load(storage: StorageLike | null, now = Date.now()): PlayerState {
  try {
    const raw = storage?.getItem(SAVE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as PlayerState;
      if (s && s.v === 1 && s.heroes && s.res) {
        s.lineup = [...s.lineup, null, null, null, null, null].slice(0, LINEUP_SIZE);
        s.res.exp ??= 0;
        s.res.moon ??= 0;
        s.idle.exp ??= 0;
        s.stories ??= [];
        s.tips ??= [];
        s.tower ??= { floor: 0 };
        s.best ??= { chapter: s.stage.chapter, index: s.stage.index };
        s.inventory = normalizeInventory(s.inventory, s.heroes);
        s.quests = normalizeQuestState(s.quests, now);
        const pending = s.pending && typeof s.pending === 'object' && !Array.isArray(s.pending) ? s.pending : {};
        const remaining: Record<string, number> = {};
        for (const [id, count] of Object.entries(pending)) {
          if (!ITEMS.some((item) => item.id === id) || typeof count !== 'number' || !Number.isFinite(count) || count <= 0) continue;
          const amount = Math.min(Number.MAX_SAFE_INTEGER, Math.floor(count));
          if (!amount) continue;
          const factor = id === 'catnip_medium' ? 4 : id === 'catnip_large' ? 16 : 1;
          if (!addItem(s, factor > 1 ? 'catnip_small' : id, amount * factor).ok) remaining[id] = amount;
        }
        if (Object.keys(remaining).length) s.pending = remaining;
        else delete s.pending;
        s.shop = normalizeShopState(s.shop, now);
        return s;
      }
    }
  } catch { /* 存档损坏则新开 */ }
  return newPlayer(now);
}
export function save(storage: StorageLike | null, s: PlayerState) {
  try { storage?.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* 存储不可用则忽略 */ }
}

// ---------- 属性与战力 ----------
export const levelMul = (lv: number) => 1 + (lv - 1) * 0.075;
export const starMul = (star: number) => 1 + (star - 1) * 0.08;

export function heroStats(h: HeroState, gear?: StatBlock) {
  const def = HERO_BY_ID[h.id];
  const b = baseStats(def.role, def.rarity);
  const m = levelMul(h.lv) * starMul(h.star) * affMul(h);
  return { hp: Math.round(b.hp * m) + Math.round(gear?.hp ?? 0), atk: Math.round(b.atk * m) + Math.round(gear?.atk ?? 0), def: Math.round(b.def * m) + Math.round(gear?.def ?? 0), spd: b.spd + Math.round(gear?.spd ?? 0) };
}
export function heroPower(h: HeroState, gear?: StatBlock): number {
  const s = heroStats(h, gear);
  return Math.round((s.hp / 10 + s.atk + s.def + s.spd * 0.6) * 0.25);
}
export function teamPower(s: PlayerState): number {
  return s.lineup.reduce((a, id) => a + (id && s.heroes[id] ? heroPower(s.heroes[id], heroGear(s, id).stats) : 0), 0);
}

// ---------- 养成（原型口径） ----------
// 成本口径来自 src/content/progression.ts（Codex 数据，docs/ECONOMY.md）
export const heroLevelCap = (star: number) => Math.min(HERO_LEVEL_CAP, 20 + star * 20);
export const levelUpCost = (lv: number) => ({ fish: levelUpFishCost(lv), exp: expToNext(lv) });
export const skillUpCost = (lv: number) => ({ fish: skillUpgradeCost(lv).fish, catnip: lv });
export const starShards = (star: number, rarity: Rarity) => starUpShards(star + 1)[rarity];

export type OpResult = { ok: true } | { ok: false; reason: string };

export function canAfford(s: PlayerState, c: Partial<Resources>): boolean {
  return (Object.keys(c) as (keyof Resources)[]).every((k) => s.res[k] >= (c[k] ?? 0));
}
export function spend(s: PlayerState, c: Partial<Resources>) {
  for (const k of Object.keys(c) as (keyof Resources)[]) s.res[k] -= c[k] ?? 0;
  if (c.fish) track(s, 'spend_fish', c.fish);
}

export function levelUp(s: PlayerState, id: string): OpResult {
  const h = s.heroes[id];
  if (!h) return { ok: false, reason: '还没有这只猫' };
  if (h.lv >= heroLevelCap(h.star)) return { ok: false, reason: '已达当前星级的等级上限，升星可提高上限' };
  const c = levelUpCost(h.lv);
  if (s.res.fish < c.fish) return { ok: false, reason: '小鱼干不够' };
  const lack = Math.max(0, c.exp - s.res.exp);
  const nip = Math.ceil(lack / CATNIP_EXP);
  if (nip > s.res.catnip) return { ok: false, reason: '成长经验不够（猫薄荷也用完了）' };
  s.res.fish -= c.fish;
  s.res.catnip -= nip;
  s.res.exp = s.res.exp + nip * CATNIP_EXP - c.exp;
  h.lv++;
  track(s, 'level_up_hero');
  track(s, 'hero_level', h.lv);
  track(s, 'spend_fish', c.fish);
  return { ok: true };
}
export function skillUp(s: PlayerState, id: string): OpResult {
  const h = s.heroes[id];
  if (!h) return { ok: false, reason: '还没有这只猫' };
  if (h.skillLv >= 10) return { ok: false, reason: '绝技已满级' };
  const c = skillUpCost(h.skillLv);
  if (!canAfford(s, c)) return { ok: false, reason: c.catnip > s.res.catnip ? '猫薄荷不够' : '小鱼干不够' };
  spend(s, c);
  h.skillLv++;
  track(s, 'upgrade_skill');
  return { ok: true };
}
export function starUp(s: PlayerState, id: string): OpResult {
  const h = s.heroes[id];
  if (!h) return { ok: false, reason: '还没有这只猫' };
  if (h.star >= MAX_STAR) return { ok: false, reason: '已满星' };
  const need = starShards(h.star, HERO_BY_ID[h.id].rarity);
  if (h.shards < need) return { ok: false, reason: `碎片不够（${h.shards}/${need}）` };
  h.shards -= need;
  h.star++;
  return { ok: true };
}
export function setAwaken(s: PlayerState, id: string, branch: 'A' | 'B'): OpResult {
  const h = s.heroes[id];
  if (!h) return { ok: false, reason: '还没有这只猫' };
  if (h.star < MAX_STAR) return { ok: false, reason: '★5 才能觉醒' };
  h.awaken = branch;
  return { ok: true };
}

// ---------- 阵容 ----------
const FRONT_ROLES = new Set(['守护', '先锋']);
export function isInLineup(s: PlayerState, id: string) {
  return s.lineup.includes(id);
}
/** 上阵：自动选择合适的排；满员返回失败 */
export function equip(s: PlayerState, id: string, slot?: number): OpResult {
  if (!s.heroes[id]) return { ok: false, reason: '还没有这只猫' };
  if (isInLineup(s, id)) return { ok: false, reason: '已经在阵容里了' };
  let target = slot;
  if (target === undefined) {
    const front = FRONT_ROLES.has(HERO_BY_ID[id].role);
    const order = front ? [0, 1, 2, 3, 4] : [3, 4, 0, 1, 2];
    target = order.find((i) => !s.lineup[i]);
  }
  if (target === undefined) return { ok: false, reason: '阵容已满，先让一只猫下场' };
  s.lineup[target] = id;
  return { ok: true };
}
export function unequip(s: PlayerState, id: string): OpResult {
  const i = s.lineup.indexOf(id);
  if (i < 0) return { ok: false, reason: '不在阵容里' };
  if (s.lineup.filter(Boolean).length <= 1) return { ok: false, reason: '至少留一只猫在场' };
  s.lineup[i] = null;
  return { ok: true };
}
export function swapSlots(s: PlayerState, a: number, b: number) {
  [s.lineup[a], s.lineup[b]] = [s.lineup[b], s.lineup[a]];
}
/** 一键上阵：战力最高的 5 只，前排优先守护 / 先锋 */
export function autoLineup(s: PlayerState) {
  const owned = Object.values(s.heroes).sort((a, b) => heroPower(b) - heroPower(a));
  const front = owned.filter((h) => FRONT_ROLES.has(HERO_BY_ID[h.id].role));
  const back = owned.filter((h) => !FRONT_ROLES.has(HERO_BY_ID[h.id].role));
  const lineup: (string | null)[] = [null, null, null, null, null];
  const frontPick = front.slice(0, 2);
  const backPick = back.slice(0, 2);
  const rest = owned.filter((h) => !frontPick.includes(h) && !backPick.includes(h));
  frontPick.forEach((h, i) => (lineup[i] = h.id));
  backPick.forEach((h, i) => (lineup[3 + i] = h.id));
  for (const h of rest) {
    const slot = lineup.findIndex((x) => !x);
    if (slot < 0) break;
    lineup[slot] = h.id;
  }
  s.lineup = lineup;
}

// ---------- 图鉴 ----------
export const RARITY_ORDER: Record<Rarity, number> = { SP: -1, UR: 0, SSR: 1, SR: 2 };
export const TOTAL_HEROES = HEROES.length;
