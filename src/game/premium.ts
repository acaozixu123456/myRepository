// 氪金体系：月光珠（付费货币）、充值档位、月卡、VIP、至尊招募（SP 专属卡池）。纯逻辑，随机数与时间可注入。
// 注意：原型没有接入真实支付渠道——「充值」是模拟下单，直接入账；真正上线时只需把 topUp 的入账放到支付回调里。
import { HERO_BY_ID, HEROES, PREMIUM_HEROES } from '../data/heroes';
import type { HeroDef } from '../data/heroes';
import { DUP_SHARDS } from './gacha';
import type { PullResult } from './gacha';
import { track } from './quests';
import type { PlayerState } from './state';

export const MOON_PER_YUAN = 10;

export interface PayState {
  total: number; // 累计充值（元，含等值发放）
  first: string[]; // 已领过首充双倍的档位
  card?: { until: number; lastDay: number }; // 月卡到期时间 / 上次领取的日序号
  vipDay: number; // 上次领取 VIP 日福利的日序号
  pity: { sp: number; upLost: boolean };
  grants: string[]; // 已发放过的一次性赠礼
  orders: { t: number; id: string; yuan: number; moon: number }[]; // 最近订单（保留 20 条）
  pulls: number; // 至尊招募累计抽数
}

export interface TopUpTier { id: string; yuan: number; moon: number; bonus: number; tag?: string }
/** 档位：base 月光珠 = 元 × 10；bonus 为常驻额外赠送；首次购买该档再送等量 base（首充双倍） */
export const TOPUPS: TopUpTier[] = [
  { id: 'moon6', yuan: 6, moon: 60, bonus: 0 },
  { id: 'moon30', yuan: 30, moon: 300, bonus: 15 },
  { id: 'moon68', yuan: 68, moon: 680, bonus: 60, tag: '热门' },
  { id: 'moon128', yuan: 128, moon: 1280, bonus: 160 },
  { id: 'moon328', yuan: 328, moon: 3280, bonus: 520 },
  { id: 'moon648', yuan: 648, moon: 6480, bonus: 1300, tag: '超值' },
];

export const MONTH_CARD = { id: 'card30', yuan: 30, instant: 300, daily: 100, days: 30, bells: 100 };
/** 至尊自选礼包：一次性，任选一只 SP + 金铃铛。 */
export const SP_PACK = { id: 'sp_pack', yuan: 198, bells: 3000, tickets: 10 };

export const SP_COST = { single: 300, ten: 2850 };
export const SP_POOL = { rateSp: 0.03, rateUr: 0.12, softFrom: 45, softStep: 0.05, pity: 60, tenGuarantee: 'UR' as const };

// ---------- 状态 ----------
export function ensurePay(s: PlayerState): PayState {
  s.pay ??= { total: 0, first: [], vipDay: -1, pity: { sp: 0, upLost: false }, grants: [], orders: [], pulls: 0 };
  s.pay.pity ??= { sp: 0, upLost: false };
  s.pay.first ??= []; s.pay.grants ??= []; s.pay.orders ??= [];
  s.res.moon ??= 0;
  return s.pay;
}
/** 本地日序号（每天 0 点翻页） */
export const dayIndex = (now = Date.now()) => Math.floor((now - new Date(now).getTimezoneOffset() * 60000) / 86400000);

// ---------- VIP ----------
export const VIP_STEPS = [0, 6, 30, 98, 198, 328, 648, 1000, 2000, 3000, 5000, 10000, 20000]; // 累计元，下标 = VIP 等级
export const VIP_MAX = VIP_STEPS.length - 1;
export function vipLevel(s: PlayerState): number {
  const t = s.pay?.total ?? 0;
  for (let i = VIP_MAX; i > 0; i--) if (t >= VIP_STEPS[i]) return i;
  return 0;
}
export interface VipPerks { idleRate: number; idleCapHours: number; dailyMoon: number; dailyBells: number; spDiscount: number }
export function vipPerks(level: number): VipPerks {
  return { idleRate: level * 0.03, idleCapHours: Math.floor(level / 2), dailyMoon: level * 20, dailyBells: level * 100, spDiscount: level >= 8 ? 0.05 : 0 };
}
export function vipProgress(s: PlayerState): { level: number; next: number | null; have: number; need: number } {
  const lv = vipLevel(s); const have = s.pay?.total ?? 0;
  return { level: lv, next: lv < VIP_MAX ? lv + 1 : null, have, need: lv < VIP_MAX ? VIP_STEPS[lv + 1] : VIP_STEPS[VIP_MAX] };
}

// ---------- 入账 ----------
function record(s: PlayerState, id: string, yuan: number, moon: number, now: number) {
  const p = ensurePay(s);
  p.total += yuan;
  p.orders.unshift({ t: now, id, yuan, moon });
  p.orders.length = Math.min(p.orders.length, 20);
}

export type PayResult = { ok: true; moon: number; first: boolean } | { ok: false; reason: string };

/** 购买月光珠档位（模拟下单）。首次购买该档，额外再得一份基础月光珠。 */
export function topUp(s: PlayerState, id: string, now = Date.now()): PayResult {
  const tier = TOPUPS.find((t) => t.id === id);
  if (!tier) return { ok: false, reason: '没有这个档位' };
  const p = ensurePay(s);
  const first = !p.first.includes(id);
  const gain = tier.moon + tier.bonus + (first ? tier.moon : 0);
  s.res.moon += gain;
  if (first) p.first.push(id);
  record(s, id, tier.yuan, gain, now);
  return { ok: true, moon: gain, first };
}

export function cardDaysLeft(s: PlayerState, now = Date.now()): number {
  const c = s.pay?.card; if (!c) return 0;
  return Math.max(0, Math.ceil((c.until - now) / 86400000));
}
/** 购买月卡：立得月光珠，之后 30 天每天可领；续费在剩余天数上累加。 */
export function buyCard(s: PlayerState, now = Date.now()): PayResult {
  const p = ensurePay(s);
  const base = p.card && p.card.until > now ? p.card.until : now;
  p.card = { until: base + MONTH_CARD.days * 86400000, lastDay: p.card?.lastDay ?? -1 };
  s.res.moon += MONTH_CARD.instant;
  record(s, MONTH_CARD.id, MONTH_CARD.yuan, MONTH_CARD.instant, now);
  return { ok: true, moon: MONTH_CARD.instant, first: false };
}
export function canClaimCard(s: PlayerState, now = Date.now()): boolean {
  const c = s.pay?.card; return !!c && c.until > now && c.lastDay < dayIndex(now);
}
export function claimCard(s: PlayerState, now = Date.now()): { moon: number; bells: number } | null {
  if (!canClaimCard(s, now)) return null;
  s.pay!.card!.lastDay = dayIndex(now);
  s.res.moon += MONTH_CARD.daily; s.res.bells += MONTH_CARD.bells;
  return { moon: MONTH_CARD.daily, bells: MONTH_CARD.bells };
}
export function canClaimVip(s: PlayerState, now = Date.now()): boolean {
  return vipLevel(s) > 0 && (s.pay?.vipDay ?? -1) < dayIndex(now);
}
export function claimVip(s: PlayerState, now = Date.now()): { moon: number; bells: number } | null {
  if (!canClaimVip(s, now)) return null;
  const k = vipPerks(vipLevel(s));
  s.pay!.vipDay = dayIndex(now);
  s.res.moon += k.dailyMoon; s.res.bells += k.dailyBells;
  return { moon: k.dailyMoon, bells: k.dailyBells };
}

function giveHero(s: PlayerState, hero: HeroDef): PullResult {
  const owned = s.heroes[hero.id];
  let shards = 0;
  if (owned) { shards = DUP_SHARDS[hero.rarity]; owned.shards += shards; }
  else { s.heroes[hero.id] = { id: hero.id, lv: 1, star: 1, shards: 0, skillLv: 1 }; if (!s.seen.includes(hero.id)) s.seen.push(hero.id); }
  return { hero, rarity: hero.rarity, isNew: !owned, shards, isUp: false };
}
/** 至尊自选礼包（一次性） */
export function buySpPack(s: PlayerState, heroId: string, now = Date.now()): PayResult & { result?: PullResult } {
  const hero = HERO_BY_ID[heroId];
  if (!hero || hero.rarity !== 'SP') return { ok: false, reason: '请选择一只至尊猫猫' };
  const p = ensurePay(s);
  if (p.grants.includes(SP_PACK.id)) return { ok: false, reason: '至尊自选礼包每个账号限购一次' };
  p.grants.push(SP_PACK.id);
  s.res.bells += SP_PACK.bells; s.res.tickets += SP_PACK.tickets;
  record(s, SP_PACK.id, SP_PACK.yuan, 0, now);
  const result = giveHero(s, hero);
  track(s, 'collect_hero', Object.keys(s.heroes).length);
  return { ok: true, moon: 0, first: true, result };
}

/** 开发者发放：给指定账号一次性补发月光珠，并按「等值充值」计入 VIP（每个 id 仅一次）。 */
export function grantOnce(s: PlayerState, id: string, moon: number, now = Date.now()): boolean {
  const p = ensurePay(s);
  if (p.grants.includes(id)) return false;
  p.grants.push(id);
  s.res.moon += moon;
  record(s, id, moon / MOON_PER_YUAN, moon, now);
  return true;
}

// ---------- 至尊招募 ----------
export const spUpHero = (): HeroDef => PREMIUM_HEROES[0];
export function spRate(pity: number): number {
  if (pity + 1 >= SP_POOL.pity) return 1;
  return Math.min(1, SP_POOL.rateSp + (pity >= SP_POOL.softFrom ? (pity - SP_POOL.softFrom + 1) * SP_POOL.softStep : 0));
}
export function spCost(s: PlayerState, n: 1 | 10): number {
  const base = n === 1 ? SP_COST.single : SP_COST.ten;
  return Math.round(base * (1 - vipPerks(vipLevel(s)).spDiscount));
}

function spOnce(s: PlayerState, rnd: () => number, forceUr: boolean, upId: string): PullResult {
  const p = ensurePay(s);
  const rate = spRate(p.pity.sp);
  const r = rnd();
  let hero: HeroDef; let isUp = false;
  if (r < rate) {
    if (p.pity.upLost || rnd() < 0.5) { hero = HERO_BY_ID[upId]; isUp = true; p.pity.upLost = false; }
    else { const others = PREMIUM_HEROES.filter((h) => h.id !== upId); hero = others[Math.floor(rnd() * others.length)]; p.pity.upLost = true; }
    p.pity.sp = 0;
  } else if (forceUr || r < rate + SP_POOL.rateUr) {
    const urs = HEROES.filter((h) => h.rarity === 'UR'); hero = urs[Math.floor(rnd() * urs.length)]; p.pity.sp++;
  } else {
    const ssr = HEROES.filter((h) => h.rarity === 'SSR'); hero = ssr[Math.floor(rnd() * ssr.length)]; p.pity.sp++;
  }
  p.pulls++;
  const res = giveHero(s, hero);
  res.isUp = isUp;
  return res;
}

export type SpPull = { ok: true; results: PullResult[] } | { ok: false; reason: string };
export function pullSp(s: PlayerState, n: 1 | 10, rnd: () => number = Math.random, upId = spUpHero().id): SpPull {
  ensurePay(s);
  const cost = spCost(s, n);
  if (s.res.moon < cost) return { ok: false, reason: '月光珠不够了，去充值中心看看吧' };
  s.res.moon -= cost;
  const results: PullResult[] = [];
  for (let i = 0; i < n; i++) {
    const needUr = n === 10 && i === 9 && !results.some((x) => x.rarity === 'SP' || x.rarity === 'UR');
    results.push(spOnce(s, rnd, needUr, upId));
  }
  track(s, 'recruit', results.length);
  track(s, 'collect_hero', Object.keys(s.heroes).length);
  return { ok: true, results };
}
