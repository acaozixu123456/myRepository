// Issue #51：直接调用游戏结算入口，固定快照与行动轨迹；不修改游戏数值。
import { ITEM_VALUE_FISH, QUESTS } from '../src/content/economy';
import { ITEMS } from '../src/content/items';
import { expToNext, levelUpFishCost, starUpShards } from '../src/content/progression';
import { HERO_BY_ID } from '../src/data/heroes';
import { Rng } from '../src/engine/rng';
import { fastExplore, fastFree, signIn } from '../src/game/daily';
import { HELP_PER_DAY, guildChest, guildHelp, joinGuild, myGuild } from '../src/game/guild';
import { FESTIVALS, FESTIVAL_PACK, OPEN_DAYS, OPEN_REWARDS, PULL_TIERS, RANK_REWARDS, UP_DAYS, festivalGift, wishShards } from '../src/game/events';
import type { Reward } from '../src/game/events';
import { answerQuiz, carnivalReady, claimCarnival, claimPass, ensureEvents, passLevel, quizToday, spin, spinsLeft } from '../src/game/events';
import { ATTEMPTS_PER_DAY, claimMilestone, claimable, finishAttempt, startAttempt } from '../src/game/worldboss';
import { DAILY_TRIES, DUNGEONS, TIERS, dungeonStart, dungeonSweep, dungeonWin, tierLevel, tierUnlocked } from '../src/game/dungeon';
import { COST, POOLS, pull } from '../src/game/gacha';
import { YARN_MINUTES, useYarn } from '../src/game/inventory';
import { DAY, NPCS, npcProgress } from '../src/game/npc';
import { MOON_PER_YUAN, VIP_STEPS, buyCard, claimCard, claimVip, ensurePay, vipLevel } from '../src/game/premium';
import { claim, isClaimable, isQuestAvailable, rollover, track } from '../src/game/quests';
import { ARENA_FREE, ARENA_START, FRIEND_MAX, addFriend, arenaFinish, arenaStart, ensureSocial, npcRating, visitFriend } from '../src/game/social';
import { applyGain, claimIdle, getStage, idleCapHours, idleRate, paceLevel, recommendedPowerOf, tickIdle, winReward } from '../src/game/stage';
import { heroLevelCap, levelUp, newPlayer, starUp, teamPower } from '../src/game/state';
import type { PlayerState } from '../src/game/state';

export type Quantities = Record<string, number>;
export interface Valuation { pricedFish: number; unpriced: Quantities }
export interface IncomeDay { date: string; sources: Record<string, Quantities>; claimed: string[] }
export interface IncomeScenario {
  ordinal: number; accountLevel: number; baseVip: number; effectiveVip: number; monthly: boolean;
  cumulativeYuan: number; instantaneousMoon: number; idleCap: number; freeFast: number; tier: number;
  days: IncomeDay[]; average: Quantities; averageSources: Record<string, Quantities>; valuation: Valuation;
}
export interface ArenaDay { date: string; wins: number; losses: number; rating: number; gain: number; paw: number }
export interface ArenaTrajectory { strategy: 'weakest' | 'nearest'; assumedWinRate: number; days: ArenaDay[]; finalRating: number }
export interface GrowthPoint {
  day: number; date: string; power: number; levels: number[]; stars: number[]; pulls: number;
  resources: Quantities; capBlocked: number; medianNpcPower: number; grinderMaxPower: number;
}
export interface GrowthScenario { giftsPerDay: number; seed: number; points: GrowthPoint[] }
export interface EconomyPaidReport {
  start: string; timezone: string; seed: number; scenarios: IncomeScenario[];
  offline: { ordinal: number; accountLevel: number; vip: number; capHours: number; fish: number; exp: number; capturedHours: number }[];
  tiers: { tier: number; unlockOrdinal: number; enemyLevel: number; quantities: Quantities; valuation: Valuation }[];
  questCeilings: { kind: 'daily' | 'weekly'; available: number; unavailable: string[]; quantities: Quantities; valuation: Valuation }[];
  arena: ArenaTrajectory[];
  npcs: { id: string; name: string; profile: string; vip: number; joinDay: number; days: { day: number; level: number; power: number; rating: number }[] }[];
  growth: GrowthScenario[];
  costs: { ordinal: number; level: number; referenceStar: number; minimumStar: number; fish: number; exp: number; dedicatedShards: number; recommendedPower: number }[];
  gifts: { count: number; quantities: Quantities; valuation: Valuation }[];
  yarnUses: { ordinal: number; vip: number; count: number; minutes: number; fish: number; exp: number }[];
}
export const DEFAULT_START = Date.UTC(2026, 9, 5);
export const DEFAULT_SEED = 20261011;
/** main.ts 的 gift 动作：每天一次 */
export const BOSS_PCT = 0.4;
export const GIFT_BELLS = 400, GIFT_TICKETS = 2;
const HOUR = 3600000;
const POINTS = [{ ordinal: 1, accountLevel: 1, star: 1 }, { ordinal: 24, accountLevel: 20, star: 2 }, { ordinal: 72, accountLevel: 45, star: 3 }, { ordinal: 144, accountLevel: 80, star: 5 }];
const BASE_VIPS = [0, 3, 8, 12];
const RES_KEYS = { fish: 'fish', exp: 'exp', bells: 'bells', catnip: 'catnip_small', tickets: 'recruit_ticket', yarn: 'yarn_small', moon: 'moon' } as const;
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const median = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); const i = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[i] : (sorted[i - 1] + sorted[i]) / 2; };
const date = (now: number) => new Date(now).toISOString().slice(0, 10);

export function addQuantities(target: Quantities, more: Quantities, scale = 1): void {
  for (const [key, amount] of Object.entries(more)) if (amount) target[key] = (target[key] ?? 0) + amount * scale;
}
export function balances(s: PlayerState): Quantities {
  const out: Quantities = { ...s.inventory.items };
  for (const [key, id] of Object.entries(RES_KEYS)) out[id] = s.res[key as keyof typeof RES_KEYS];
  return out;
}
function delta(before: Quantities, after: Quantities): Quantities {
  return Object.fromEntries([...new Set([...Object.keys(before), ...Object.keys(after)])].map((id) => [id, (after[id] ?? 0) - (before[id] ?? 0)]).filter(([, amount]) => amount !== 0));
}
/** 定价表是审查锚点，不是兑换。毛线球原注释禁止据静态价格折现奖励。 */
export function valueIncome(quantities: Quantities): Valuation {
  const out: Valuation = { pricedFish: 0, unpriced: {} };
  for (const [id, count] of Object.entries(quantities)) {
    if (!count) continue;
    if (Object.hasOwn(YARN_MINUTES, id) || !Object.hasOwn(ITEM_VALUE_FISH, id)) out.unpriced[id] = count;
    else out.pricedFish += ITEM_VALUE_FISH[id] * count;
  }
  return out;
}
function emptyPlayer(now: number): PlayerState {
  const p = newPlayer(now);
  for (const key of Object.keys(p.res) as (keyof PlayerState['res'])[]) p.res[key] = 0;
  return p;
}
function setOrdinal(p: PlayerState, ordinal: number): void {
  const chapter = Math.floor((ordinal - 1) / 24) + 1, index = (ordinal - 1) % 24 + 1;
  p.stage = { chapter, index, wins: 0 }; p.best = { chapter, index };
}
function check(ok: boolean, description: string): void { if (!ok) throw new Error(`审查情景不能完成：${description}`); }
function highestTier(p: PlayerState): number { let tier = 1; for (let t = 1; t <= TIERS; t++) if (tierUnlocked(p, t)) tier = t; return tier; }
function claimRecurring(p: PlayerState, row: IncomeDay): void {
  for (const q of QUESTS) {
    if ((q.kind !== 'daily' && q.kind !== 'weekly') || !isClaimable(p, q)) continue;
    const before = balances(p), result = claim(p, q.id);
    if (!result.ok) throw new Error(`任务 ${q.id} 领奖失败：${result.reason}`);
    addQuantities(row.sources.quests ??= {}, delta(before, balances(p))); row.claimed.push(q.id);
  }
}
/** 固定快照的日常；胜利是假设输入，不能当成战斗实测胜率。 */
function incomeDay(p: PlayerState, now: number, day: number, frozenLevel?: number, friends = 1): IncomeDay {
  const row: IncomeDay = { date: date(now), sources: {}, claimed: [] };
  rollover(p, now + 5 * HOUR); track(p, 'login');
  const record = (source: string, operation: () => void) => {
    const before = balances(p); operation(); addQuantities(row.sources[source] ??= {}, delta(before, balances(p)));
    if (frozenLevel !== undefined) { p.level = frozenLevel; p.exp = 0; }
  };
  const collect = (hour: number) => record('idle', () => { tickIdle(p, now + hour * HOUR); claimIdle(p); });
  collect(7);
  record('signin', () => check(signIn(p, now + 8 * HOUR).ok, '签到'));
  record('fast', () => {
    const free = fastFree(p, now + 8 * HOUR);
    for (let i = 0; i < free; i++) { const r = fastExplore(p, now + 8 * HOUR); check(r.ok && !r.paid, '免费快速探索'); }
  });
  record('dungeon', () => {
    const tier = highestTier(p);
    for (const d of DUNGEONS) for (let i = 0; i < DAILY_TRIES; i++) {
      if ((p.dungeon?.best[d.id] ?? 0) >= tier) check(dungeonSweep(p, d.id, tier, now + 9 * HOUR).ok, '已通关档位扫荡');
      else { check(dungeonStart(p, d.id, tier, now + 9 * HOUR).ok, '首个秘境通关'); dungeonWin(p, d.id, tier, now + 9 * HOUR); }
    }
  });
  record('friend', () => { for (const n of NPCS.slice(0, friends)) { addFriend(p, n.id); check(visitFriend(p, n.id, now + 10 * HOUR).ok, '拜访好友'); } });
  record('events', () => {
    // 免费活动：猫抓机（固定种子）、问答全对、嘉年华可领档、通行证免费轨；氪金活动是人民币购买，不在免费收入里
    const rng = new Rng(20261011 + day);
    const card = !!p.pay?.card && p.pay.card.until > now;
    while (spinsLeft(p, vipLevel(p), card, now + 11 * HOUR).free > 0) check(spin(p, vipLevel(p), card, () => rng.next(), now + 11 * HOUR).ok, '猫抓机');
    for (const q of quizToday(now + 11 * HOUR)) check(answerQuiz(p, q.a, now + 11 * HOUR).ok, '问答');
    const ev = ensureEvents(p, now + 23 * HOUR);
    carnivalReady(ev.pts, ev.carn).forEach((ok, i) => { if (ok) check(claimCarnival(p, i, now + 23 * HOUR).ok, '嘉年华'); });
    for (let l = 1; l <= passLevel(p, now + 23 * HOUR); l++) if (!ev.passFree.includes(l)) check(claimPass(p, 'free', l, now + 23 * HOUR).ok, '通行证免费轨');
  });
  record('guild', () => {
    if (!myGuild(p)) check(joinGuild(p, 'g_box', now + 10 * HOUR).ok, '加入公会');
    check(guildChest(p, now + 10 * HOUR).ok, '每日纸箱');
    for (let i = 0; i < HELP_PER_DAY; i++) check(guildHelp(p, now + 10 * HOUR).ok, '公会互助');
  });
  record('boss', () => {
    // 假设每次稳定打掉 BOSS_PCT 的生命（校准基线：默认五猫约 40%）；这是显式输入，不是战斗实测
    for (let i = 0; i < ATTEMPTS_PER_DAY; i++) { check(startAttempt(p, now + 10 * HOUR).ok, '世界Boss挑战'); finishAttempt(p, BOSS_PCT, now + 10 * HOUR); }
    claimable(p, now + 10 * HOUR).forEach((ok, i) => { if (ok) check(claimMilestone(p, i, now + 10 * HOUR).ok, 'Boss里程碑'); });
  });
  record('campaign', () => {
    const st = getStage(p.stage.chapter, p.stage.index)!;
    for (let i = 0; i < 10; i++) { applyGain(p, winReward(st)); track(p, 'clear_stage'); }
  });
  record('arena', () => {
    for (let i = 0; i < ARENA_FREE; i++) {
      check(arenaStart(p, now + 12 * HOUR).ok, '免费竞技次数');
      const index = day * ARENA_FREE + i;
      const win = Math.floor((index + 1) * 0.7) > Math.floor(index * 0.7);
      arenaFinish(p, NPCS[0].id, win, now + 12 * HOUR);
    }
  });
  record('vip', () => { claimVip(p, now + 13 * HOUR); });
  record('card', () => { claimCard(p, now + 13 * HOUR); });
  collect(15); collect(23);
  claimRecurring(p, row);
  return row;
}
export function runIncomeScenario(ordinal: number, accountLevel: number, baseVip: number, monthly: boolean, start = DEFAULT_START): IncomeScenario {
  if (!Number.isInteger(ordinal) || ordinal < 1 || ordinal > 144 || !Number.isInteger(accountLevel) || accountLevel < 1 || accountLevel > 80
    || !Number.isInteger(baseVip) || baseVip < 0 || baseVip >= VIP_STEPS.length || typeof monthly !== 'boolean') throw new Error('收益快照关数/城镇等级/VIP/月卡参数无效');
  const p = emptyPlayer(start);
  setOrdinal(p, ordinal); p.level = accountLevel; p.idle.last = start - HOUR;
  ensurePay(p).total = VIP_STEPS[baseVip];
  let instantaneousMoon = 0;
  if (monthly) { const r = buyCard(p, start); check(r.ok, '买月卡'); instantaneousMoon = r.ok ? r.moon : 0; p.res.moon = 0; }
  const out: IncomeScenario = {
    ordinal, accountLevel, baseVip, effectiveVip: vipLevel(p), monthly,
    cumulativeYuan: p.pay!.total, instantaneousMoon, idleCap: idleCapHours(p), freeFast: fastFree(p, start), tier: highestTier(p),
    days: [], average: {}, averageSources: {}, valuation: { pricedFish: 0, unpriced: {} },
  };
  for (let day = 0; day < 7; day++) {
    const row = incomeDay(p, start + day * DAY, day, accountLevel);
    out.days.push(row);
    for (const [source, quantities] of Object.entries(row.sources)) {
      addQuantities(out.averageSources[source] ??= {}, quantities, 1 / 7); addQuantities(out.average, quantities, 1 / 7);
    }
  }
  out.valuation = valueIncome(out.average);
  return out;
}
export function arenaTrajectory(strategy: ArenaTrajectory['strategy'], assumedWinRate: number, start = DEFAULT_START): ArenaTrajectory {
  const p = emptyPlayer(start), days: ArenaDay[] = [];
  for (let day = 0; day < 7; day++) {
    const now = start + day * DAY + 12 * HOUR;
    const beforeRating = ensureSocial(p).arena.rating; let wins = 0, paw = 0;
    for (let i = 0; i < ARENA_FREE; i++) {
      const rating = ensureSocial(p).arena.rating;
      const rivals = [...NPCS].sort((a, b) => {
        const va = npcRating(a, now), vb = npcRating(b, now);
        return strategy === 'weakest' ? va - vb : Math.abs(va - rating) - Math.abs(vb - rating);
      });
      const index = day * ARENA_FREE + i;
      const win = Math.floor((index + 1) * assumedWinRate) > Math.floor(index * assumedWinRate);
      check(arenaStart(p, now).ok, '竞技轨迹次数');
      const r = arenaFinish(p, rivals[0].id, win, now); paw += r.paw; if (win) wins++;
    }
    const rating = ensureSocial(p).arena.rating;
    days.push({ date: date(now), wins, losses: ARENA_FREE - wins, rating, gain: rating - beforeRating, paw });
  }
  return { strategy, assumedWinRate, days, finalRating: ensureSocial(p).arena.rating };
}
export function runGrowthScenario(giftsPerDay: number, seed: number, start = DEFAULT_START): GrowthScenario {
  const p = emptyPlayer(start), rng = new Rng(seed), points: GrowthPoint[] = [];
  p.idle.last = start;
  let pulls = 0;
  for (let day = 0; day < 30; day++) {
    const now = start + day * DAY;
    const row = incomeDay(p, now, day, undefined, FRIEND_MAX);
    // 首页 gift 无纯逻辑入口；按 main.ts 的每日福利实际数值（每天一次：400 金铃铛 + 2 招福符）单列。
    p.res.bells += giftsPerDay * GIFT_BELLS; p.res.tickets += giftsPerDay * GIFT_TICKETS;
    const grow = () => {
      while (p.res.tickets >= COST.single.tickets || p.res.bells >= COST.single.bells) { check(pull(p, POOLS[1], 1, () => rng.next()).ok, '常驻单抽'); pulls++; }
      const team = p.lineup.map((id) => p.heroes[id!]);
      for (const hero of team) while (starUp(p, hero.id).ok) { /* 专属碎片来自实际重复招募 */ }
      let upgraded = true;
      while (upgraded) {
        upgraded = false;
        for (const hero of [...team].sort((a, b) => a.lv - b.lv || a.id.localeCompare(b.id))) if (levelUp(p, hero.id).ok) { upgraded = true; break; }
      }
    };
    grow(); claimRecurring(p, row); grow(); claimRecurring(p, row); grow();
    if ([1, 7, 30].includes(day + 1)) {
      const nps = NPCS.map((n) => npcProgress(n, now + 23 * HOUR).power);
      const team = p.lineup.map((id) => p.heroes[id!]);
      points.push({ day: day + 1, date: date(now), power: teamPower(p), levels: team.map((h) => h.lv), stars: team.map((h) => h.star), pulls,
        resources: balances(p), capBlocked: team.filter((h) => h.lv >= heroLevelCap(h.star)).length,
        medianNpcPower: median(nps), grinderMaxPower: Math.max(...NPCS.filter((n) => n.profile === 'grinder').map((n) => npcProgress(n, now + 23 * HOUR).power)) });
    }
  }
  return { giftsPerDay, seed, points };
}
export function runEconomyPaid(options: { start?: number; seed?: number } = {}): EconomyPaidReport {
  const start = options.start ?? DEFAULT_START, seed = options.seed ?? DEFAULT_SEED;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(seed) || seed < 1 || seed > 0xffffffff) throw new Error('start 须为有效整数，seed 须为正uint32');
  if (new Date(start).getUTCDay() !== 1 || start % DAY !== 0) throw new Error('七日复算从 UTC 周一零点开始');
  if (new Date(start).getTimezoneOffset() !== 0) throw new Error('本报告固定 UTC；请用 TZ=UTC 运行，避免本地周期改变');
  const scenarios = POINTS.flatMap((point) => BASE_VIPS.flatMap((vip) => [false, true].map((card) => runIncomeScenario(point.ordinal, point.accountLevel, vip, card, start))));
  const offline = POINTS.flatMap((point) => BASE_VIPS.map((vip) => {
    const p = emptyPlayer(start); setOrdinal(p, point.ordinal); p.level = point.accountLevel; ensurePay(p).total = VIP_STEPS[vip];
    tickIdle(p, start + DAY); const got = claimIdle(p), r = idleRate(p);
    return { ...point, vip, capHours: idleCapHours(p), ...got, capturedHours: got.fish / r.fish / 60 };
  }));
  const tiers = Array.from({ length: TIERS }, (_, i) => {
    const tier = i + 1, p = emptyPlayer(start); let unlockOrdinal = 1;
    while (unlockOrdinal <= 144) { setOrdinal(p, unlockOrdinal); if (tierUnlocked(p, tier)) break; unlockOrdinal++; }
    for (const d of DUNGEONS) for (let attempt = 0; attempt < DAILY_TRIES; attempt++) {
      if (!attempt) { check(dungeonStart(p, d.id, tier, start).ok, '档位首通'); dungeonWin(p, d.id, tier, start); }
      else check(dungeonSweep(p, d.id, tier, start).ok, '档位扫荡');
    }
    const quantities = balances(p);
    return { tier, unlockOrdinal, enemyLevel: tierLevel(tier), quantities, valuation: valueIncome(quantities) };
  });
  const questCeilings = (['daily', 'weekly'] as const).map((kind) => {
    const p = emptyPlayer(start), unavailable: string[] = []; let available = 0;
    for (const q of QUESTS.filter((q) => q.kind === kind)) {
      if (!isQuestAvailable(q)) { unavailable.push(q.id); continue; }
      // 仅算全部达标的毛奖励上限，绝不拿这一人工进度冒充日常轨迹。
      p.quests.progress[q.id] = q.goal.target; const r = claim(p, q.id); check(r.ok, `${kind} 毛奖励上限`); available++;
    }
    const quantities = balances(p);
    return { kind, available, unavailable, quantities, valuation: valueIncome(quantities) };
  });
  const npcs = NPCS.map((n) => ({ id: n.id, name: n.name, profile: n.profile, vip: n.vip, joinDay: n.joinDay,
    days: [1, 7, 30].map((day) => { const now = start + (day - 1) * DAY + 23 * HOUR, p = npcProgress(n, now); return { day, level: p.level, power: p.power, rating: npcRating(n, now) }; }) }));
  const starter = newPlayer(start);
  const costs = POINTS.map((point) => {
    const level = paceLevel(point.ordinal); let fish = 0, exp = 0, dedicatedShards = 0;
    for (const hero of Object.values(starter.heroes)) {
      for (let lv = hero.lv; lv < level; lv++) { fish += levelUpFishCost(lv); exp += expToNext(lv); }
      for (let star = 2; star <= point.star; star++) dedicatedShards += starUpShards(star)[HERO_BY_ID[hero.id].rarity];
    }
    return { ordinal: point.ordinal, level, referenceStar: point.star, minimumStar: Math.max(1, Math.ceil((level - 20) / 20)), fish, exp, dedicatedShards,
      recommendedPower: recommendedPowerOf(Math.floor((point.ordinal - 1) / 24) + 1, (point.ordinal - 1) % 24 + 1) };
  });
  const gifts = [1, 7, 30].map((count) => { const quantities = { bells: count * GIFT_BELLS, recruit_ticket: count * GIFT_TICKETS }; return { count, quantities, valuation: valueIncome(quantities) }; });
  const yarnUses = scenarios.filter((s) => !s.monthly).map((s) => {
    const p = emptyPlayer(start); setOrdinal(p, s.ordinal); ensurePay(p).total = VIP_STEPS[s.baseVip];
    const count = Math.round((s.average.yarn_small ?? 0) * 7); p.res.yarn = count;
    const result = useYarn(p, 'yarn_small', count); check(result.ok, '本周两个毛线球使用');
    if (!result.ok) throw new Error(result.reason);
    return { ordinal: s.ordinal, vip: s.baseVip, count, minutes: result.minutes, fish: result.fish, exp: result.exp };
  });
  return { start: new Date(start).toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, seed, scenarios, offline, tiers, questCeilings,
    arena: (['weakest', 'nearest'] as const).flatMap((strategy) => [0.5, 0.7, 1].map((rate) => arenaTrajectory(strategy, rate, start))), npcs,
    growth: [0, 1].map((gifts) => runGrowthScenario(gifts, seed, start)), costs, gifts, yarnUses };
}

const names: Record<string, string> = Object.fromEntries(ITEMS.map((item) => [item.id, item.name]));
names.exp = '成长经验'; names.moon = '月光珠';
const n = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(2);
const pct = (ratio: number) => `${(ratio * 100).toFixed(2)}%`;
const bundle = (quantities: Quantities) => Object.entries(quantities).filter(([, value]) => value).map(([id, value]) => `${names[id] ?? id} ${n(value)}`).join('；') || '0';
const table = (headers: string[], rows: (string | number)[][]) => `| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |\n${rows.map((row) => `| ${row.join(' | ')} |`).join('\n')}\n`;

const rewardQ = (r: Reward): Quantities => ({ fish: r.fish ?? 0, bells: r.bells ?? 0, recruit_ticket: r.tickets ?? 0, catnip_small: r.catnip ?? 0, yarn_small: r.yarn ?? 0, moon: r.moon ?? 0, ...(r.items ?? {}) });
function supplement(): (string | number)[][] {
  const row = (name: string, scope: string, q: Quantities, days: number) => {
    const v = valueIncome(q), per: Quantities = {};
    addQuantities(per, v.unpriced, 1 / days);
    return [name, scope, n(v.pricedFish / days), bundle(per) || '无'];
  };
  const sum = (list: Reward[]) => { const q: Quantities = {}; for (const r of list) addQuantities(q, rewardQ(r)); return q; };
  const festTotal: Quantities = {}; let fdays = 0;
  for (const f of FESTIVALS) {
    const days = f.to[0] === f.from[0] ? f.to[1] - f.from[1] + 1 : f.to[0] < f.from[0] ? (31 - f.from[1] + 1) + f.to[1] : (30 - f.from[1] + 1) + f.to[1];
    fdays += days; for (let i = 0; i < days; i++) addQuantities(festTotal, rewardQ(festivalGift(i, days)));
  }
  const wishQ = { [`wish_shard_vip0`]: wishShards(0, false), [`wish_shard_vip12`]: wishShards(12, true) };
  return [
    row('节日签到（全年 7 个节日）', `全年约 ${fdays} 天，按 365 天平均`, festTotal, 365),
    row('周战力冲榜（参与奖）', '每周 1 次，按 7 天平均', rewardQ(RANK_REWARDS[RANK_REWARDS.length - 1].r), 7),
    row('招募盛典（周累计 100 抽）', '每周拿满全部 5 档', sum(PULL_TIERS.map((t) => t.r)), 7),
    row('UP 累抽有礼（不含送猫）', `每期 ${UP_DAYS} 天抽满 100 次，前两档`, sum([{ tickets: 3 }, { bells: 300, items: { fishbone_large: 1 } }]), UP_DAYS),
    row('开服冲榜（前 15 名下限）', `仅新号前 ${OPEN_DAYS} 天，按 ${OPEN_DAYS} 天平均`, sum(Array.from({ length: OPEN_DAYS }, () => OPEN_REWARDS[OPEN_REWARDS.length - 1].r)), OPEN_DAYS),
    ['许愿池', '每天 1 次，免费 / VIP12+月卡', 0, `升星碎片 ${wishQ.wish_shard_vip0} / ${wishQ.wish_shard_vip12} 个/天，连续 7 天另 +20`],
    ['节日礼盒（氪金）', `¥${FESTIVAL_PACK.yuan}/届，限购 1 次`, 0, `按人民币计：${bundle(valueIncome(rewardQ(FESTIVAL_PACK.r)).unpriced)}（含已定价部分另算）`],
  ];
}

export function renderEconomyPaid(r: EconomyPaidReport, sourceRevision: string, spSummary?: string): string {
  const free = r.scenarios.filter((s) => s.baseVip === 0 && !s.monthly);
  const row = (s: IncomeScenario) => {
    const base = free.find((f) => f.ordinal === s.ordinal)!;
    return [s.ordinal, `VIP${s.baseVip}${s.monthly ? '+月卡' : ''}→${s.effectiveVip}`, s.cumulativeYuan, n(s.valuation.pricedFish), n(s.valuation.pricedFish - base.valuation.pricedFish), n(s.valuation.pricedFish / base.valuation.pricedFish), n(s.average.exp ?? 0), n(s.average.moon ?? 0)];
  };
  const sections = [
    '# 付费经济、秘境与竞技场审查（Issue #51）',
    `代码基线：\`${sourceRevision}\`。固定开始时间：${r.start}；时区：${r.timezone}；种子：${r.seed}。所有金额取游戏函数实际账本增量。`,
    '## 复算与边界',
    '`npm run economy:paid -- --out docs/ECONOMY_PAID.md`；SP 独立复算：`npm run balance:sp -- --out docs/SP_BALANCE_PAID.md`。两个工具均使用现有依赖，不修改游戏常量。',
    '主表固定在关卡1/24/72/144，城镇等级1/20/45/80；这些是已达进度快照，不是新号第几天保证达到。连续七天从周一开始；每日07/15/23点各领取一次挂机，稳态覆盖前日23点到本日23点共24小时，08点签到及免费快速探索，09点每类秘境3次，10点拜访1位好友，11点重复当前关10胜，12点竞技5场，13点领VIP/月卡，23点领实际达标的日/周任务。战役与秘境成功、竞技35场24胜为显式情景输入，不是这些战斗的模拟结论。首次秘境1次通关+2次扫荡，以后3次扫荡，共享同一3次额度。',
    '冻结城镇等级仅为比较相同进度的挂机上限；收益仍从结算入口读取。所有新号初始资源、首通主线、新手/成就、充值即时赠送均未并入每日收入。日常、秘境、竞技和付费领取按当地00:00，任务与商店按05:00；本工具强制UTC固定情景。七日签到漏签不清零，本表无漏签。周任务在实际达标日入账，再除7平均，没有把每周奖励每天领一次。',
    '对照 ITEM_VALUE_FISH 的“已定价子集”是价格审查锚点，不是可交易兑换价，更不等于养成速度。原始成长经验和月光珠没有定价：单列实物，不能当作0价值或自行补价。猫薄荷按真实资源别名 catnip_small 的250锚点列账；中/大薄荷任务奖励实际转换为4/16份。毛线球原定价注释禁止折现奖励，本表保留原物；可使用后的收益另列，避免同物与收益重复计价。',
    '招福符静态锚点30000鱼干，与实际常驻单抽可替代160金铃铛（按铃铛锚点为16000）并非同一价格；本表严格使用前者，不能把混合资源倍数直接解读成多养成多少级或多抽多少次。',
    '## 每日收益与付费差距',
    table(['全局关数', '购买前VIP/买卡后实际VIP', '累计充值元', '日均已定价子集', '相对VIP0额外', '子集倍数', '未定价EXP/日', '未定价月光珠/日'], r.scenarios.map(row)),
    '初始VIP0买30元月卡后实际VIP2；月卡即时300月光珠仅在购买时获得，不算每天收入。VIP3/8/12门槛分别98/2000/20000元，已经建立的付费权益用于本表；此前充值得到的月光珠不属于每日产出。',
    '### 免费玩家的来源与实物',
    table(['关数', '来源', '每日实物平均', '已定价子集/日', '未定价/特殊锚点'], free.flatMap((s) => Object.entries(s.averageSources).map(([source, quantities]) => { const value = valueIncome(quantities); return [s.ordinal, source, bundle(quantities), n(value.pricedFish), bundle(value.unpriced)]; }))),
    '签到按整个七日循环平均：普通七日共8000小鱼干、420金铃铛、8猫薄荷、13招福符、100月光珠；VIP3以上全部翻倍。快速探索免费次数VIP0/3/8/12为1/1/3/4次，已计入。购买额外快速探索每次扣50金铃铛、奖励当前VIP挂机120分钟；并非免费收入，不并入主表。',
    '### 本周实际获得的毛线球：使用收益另列',
    table(['关数', 'VIP', '本周颗数', '实际加速分钟', '使用后新增鱼干', '使用后新增EXP'], r.yarnUses.map((y) => [y.ordinal, y.vip, y.count, y.minutes, y.fish, y.exp])),
    '这些是本周任务实际获得的2颗小毛线球在该进度使用后的额外一次收益，未与主表保留的原物重复相加。以初关VIP0为例，两颗只发2880鱼干+1440EXP，不能按静态标价20000鱼干折现。',
    '### 一天只上线领取一次的挂机',
    table(['关数', '城镇等级', 'VIP', '缓存上限小时', '24h实际捕获小时', '小鱼干', 'EXP'], r.offline.map((o) => [o.ordinal, o.accountLevel, o.vip, o.capHours, n(o.capturedHours), o.fish, o.exp])),
    '前期低频上线者还受VIP缓存时长影响，不能用24小时在线收益的倍数替代这条曲线。主表三次领取都不触顶，因此只计算速率与免费加速次数差异。',
    '## 秘境与扫荡',
    table(['档位', '解锁最高关数', '敌方等级', '每日每类3次实物合计', '已定价子集', '未定价EXP'], r.tiers.map((t) => [t.tier, t.unlockOrdinal, t.enemyLevel, bundle(t.quantities), n(t.valuation.pricedFish), n(t.quantities.exp ?? 0)])),
    table(['快照关数', '已通关秘境档', '秘境鱼干/24h挂机鱼干', '秘境子集/全部免费子集', '加每日福利后的占比'], free.map((s) => {
      const dungeon = valueIncome(s.averageSources.dungeon).pricedFish;
      return [s.ordinal, s.tier, pct((s.averageSources.dungeon.fish ?? 0) / (s.averageSources.idle.fish ?? 1)), pct(dungeon / s.valuation.pricedFish), pct(dungeon / (s.valuation.pricedFish + r.gifts[0].valuation.pricedFish))];
    })),
    '小鱼干/经验副本单次取该档强度对应关卡挂机150分钟（DUNGEON_MINUTES，原120分钟），三次为450分钟；它不使用VIP挂机倍率。解锁门槛低于强度所用关卡，早期秘境鱼干可能接近整日挂机。EXP未计价使“20%–35%全部收入”无法严格裁定，表内占比只适用于已定价子集，不能冒充完整总收入。',
    '#### EXP计价口径提案（仅用于审查，不改常量）',
    '提案：1 EXP 折 “该进度单级升级的鱼干费用 ÷ 单级所需经验”，即升级时每份经验需要陪同消耗的鱼干，使“鱼干与经验”两条养成通路在同一把尺上。这是内部换算，不是可交易价。',
    table(['快照关数', '参考等级', '1 EXP≈鱼干', '秘境(含EXP)/全部免费收入(含EXP)'], free.map((s) => {
      const c = r.costs.find((x) => x.ordinal === s.ordinal)!;
      const price = levelUpFishCost(c.level) / expToNext(c.level);
      const exp = (q: Quantities) => (q.exp ?? 0) * price;
      const dungeon = valueIncome(s.averageSources.dungeon).pricedFish + exp(s.averageSources.dungeon);
      const all = s.valuation.pricedFish + exp(s.average);
      return [s.ordinal, c.level, n(price), pct(dungeon / all)];
    })),
    '#### 完整口径裁决（EXP 与月光珠）',
    '裁决：①EXP 采用上面的“升级陪同鱼干”换算，计入完整收入；②月光珠是付费货币，**不折算成鱼干**，改以人民币计：10 月光珠 = 1 元（MOON_PER_YUAN），只用来回答“免费玩家每天能攒多少、相当于多少钱”。下表给出含 EXP 的完整免费收入，以及免费 / VIP12 两档的月光珠日产出和折合元。',
    table(['快照关数', '含EXP的免费日收入（鱼干当量）', '免费月光珠/日', '折合元/日', 'VIP12 月光珠/日', '折合元/日'], free.map((s) => {
      const c = r.costs.find((x) => x.ordinal === s.ordinal)!;
      const price = levelUpFishCost(c.level) / expToNext(c.level);
      const v12 = r.scenarios.find((p) => p.ordinal === s.ordinal && p.baseVip === 12 && !p.monthly)!;
      const moon = s.average.moon ?? 0, moon12 = v12.average.moon ?? 0;
      return [s.ordinal, n(s.valuation.pricedFish + (s.average.exp ?? 0) * price), n(moon), n(moon / MOON_PER_YUAN), n(moon12), n(moon12 / MOON_PER_YUAN)];
    })),
    '按此口径，原 120 分钟折算下秘境约占全部免费收入的 14%–20%，低于 20%–35% 目标下沿；已裁决调为 150 分钟（见下表为 150 分钟的实测占比），仍偏低的快照留待后续观察。',
    '## 任务毛奖励上限',
    table(['周期', '现已开放条数', '未开放', '全部达标毛实物', '已定价子集'], r.questCeilings.map((q) => [q.kind, q.available, q.unavailable.join('、') || '无', bundle(q.quantities), n(q.valuation.pricedFish)])),
    '此表仅在人工完成全部目标后调用实际领奖核对账目，未包含升级、招募、强化等达标支出，绝不当成每个玩家每天稳定净收入。主表真正领取的每日任务为登录、挂机、战役、竞技、好友；每周为战役、挂机、竞技。活动中心的免费活动（猫抓机按固定种子抽、每日问答全对、嘉年华可领档、通行证免费轨）已并入主表的 events 来源；氪金活动（首充、周累充、成长基金、通行证付费轨、限时礼包）是人民币购买，不计入免费收入，其档位奖励见 src/game/events.ts；世界 Boss 按每次稳定打掉 40% 生命（默认五猫校准值）、每天 3 次、周内累计里程碑自动领取并入主表的 boss 来源，这是显式假设而非战斗实测；公会已开放，其每日纸箱+5次互助已并入主表的 guild 来源（鱼牌单价取 ITEM_VALUE_FISH 锚点；捐献是小鱼干支出，不计入）；爬塔只能首次过层计数，层数有限，不能永久把每日/每周爬塔毛额当作持续收入。',
    '## 额外首页福利：对经济结论的敏感性',
    table(['累计领取天数', '额外实物', '额外已定价子集'], r.gifts.map((g) => [g.count, bundle(g.quantities), n(g.valuation.pricedFish)])),
    '当前 home.ts 永久显示“每日福利”，main.ts 仅限制300000ms冷却，点击即发1600金铃铛+5招福符。一次310000、三次930000；每天288次是24小时持续操作的理论上限，不是典型玩法。主表按Issue指定来源列出；这个额外来源确实可重复领取，不能省略后宣称全经济已达付费快15%–40%的目标。它还改变免费招募与专属碎片获得速度。需Claude确认是否原型福利或正式每日一次；本PR不改应用行为。',
    table(['关数', '无额外福利VIP12倍数', '双方每天各领1次后的VIP12倍数'], free.map((s) => {
      const paid = r.scenarios.find((p) => p.ordinal === s.ordinal && p.baseVip === 12 && !p.monthly)!;
      return [s.ordinal, n(paid.valuation.pricedFish / s.valuation.pricedFish), n((paid.valuation.pricedFish + r.gifts[0].valuation.pricedFish) / (s.valuation.pricedFish + r.gifts[0].valuation.pricedFish))];
    })),
    '## 活动中心补充估算（不并入主表）',
    '以下活动不是每天稳定发放，按“长期平均每天”单列已定价子集，月光珠/碎片等未定价项另列。假设玩家参与并拿满；周冲榜按“只拿参与奖”的保守下限，UP 累抽按“每期抽满 100 次且拿完全部档位”的上限。',
    table(['活动', '口径', '日均已定价子集', '未定价'], supplement()),
    '## 竞技场积分与NPC成长',
    `实际Elo入口 arenaFinish 使用K=24；同积分胜/负分别+12/-12。起点${ARENA_START}，每天免费${ARENA_FREE}次，35场即使每胜都取+24，七日理论上限也仅${ARENA_START + 7 * ARENA_FREE * 24}。以下是固定胜负序列下的积分轨迹，不是假定这些NPC可被当前新号击败。50%/70%情景取35场17/24胜；100%取35胜。`,
    table(['对手策略', '假定胜率', '7天实际胜/负', '末日积分', '净增长', '各日末积分'], r.arena.map((a) => [a.strategy, pct(a.assumedWinRate), `${sum(a.days.map((d) => d.wins))}/${sum(a.days.map((d) => d.losses))}`, a.finalRating, a.finalRating - ARENA_START, a.days.map((d) => d.rating).join('→')])),
    table(['NPC', '职业画像/VIP/相对开服入服日', '第1天等级/战力/积分', '第7天等级/战力/积分', '第30天等级/战力/积分'], r.npcs.map((p) => [p.name, `${p.profile}/VIP${p.vip}/${p.joinDay}`, ...p.days.map((d) => `${d.level}/${d.power}/${d.rating}`)])),
    'NPC不是同日注册：joinDay为开服前5–25天，固定10月5日工具首日已比当日新号早入服9–29天。成长公式按墙钟、指数时间常数22天、grind与每日小噪声推等级，最高100；不支付资源或专属碎片。NPC显示战力还乘VIP最高25%加成，但 arenaStage→waveSetups 的实际战斗配置不带该VIP乘数，且英雄星级/技能等级另由敌方等级分档，因此显示战力不能直接当作同战力实战。',
    '### 无SP实际免费养成轨迹',
    table(['每日福利（0=不领，1=每天一次）', '天数', '固定初始五猫等级', '对应星级', '累计实际单抽', '队伍战力', '星级上限阻塞猫数', 'NPC中位战力', '高肝NPC最大战力'], r.growth.flatMap((g) => g.points.map((p) => [g.giftsPerDay, p.day, p.levels.join('/'), p.stars.join('/'), p.pulls, p.power, p.capBlocked, p.medianNpcPower, p.grinderMaxPower]))),
    '养成轨迹固定挂机第一关，20位好友全部每日拜访、三个挂机领取节点、每类秘境最低档3胜、每日重复主线10胜、35场24胜竞技；排除初始资源、首通、新手、成就和付费。使用真实常驻单抽（招福符优先，再用160铃铛）、真实重复碎片与starUp/levelUp，将资源均衡投入原始五猫，不添SP、装备或技能升级。三次福利情景另按首页真实数值增加；种子固定。只声称此资源轨迹可执行，不声称第1关有高等级敌人、最优招募/阵容或这些战斗成功已实测。NPC比较列使用同一日23点。',
    '### 主线参考养成门槛',
    table(['关数', '参考等级', '参考星级', '仅等级上限所需最低星级', '五猫从8级升级所需鱼干', '原始EXP', '参考星级专属碎片合计', '界面推荐战力'], r.costs.map((c) => [c.ordinal, c.level, c.referenceStar, c.minimumStar, c.fish, c.exp, c.dedicatedShards, c.recommendedPower])),
    '成本不含技能/装备，不把猫薄荷单向换500EXP反推经验通用售价。专属碎片必须落到具体英雄，通用碎片目前没有使用入口。阶段24/72/144的参考星级是2/3/5，不等于仅能升到该等级的最低星级；资源够升级也不能绕过升星等级上限。上表及固定种子养成轨迹不足以证明所有新号第1/7/30天能到20/45/95，需完整招募策略和推进实战共同验证。',
    '## SP验证与待裁决建议',
    'SP替换、同战力配对及无SP实际波次验证见 [SP_BALANCE_PAID.md](SP_BALANCE_PAID.md)。该报告与本报告分别复算，避免把技能效果、显示战力与货币价格合并成一个速度指标。最终SP胜率结论以独立报告为准。',
    'SP压到 +15~20pp 的单点改动评估（两次试验，常量均未改，试验后已还原）：①去掉 3 只 SP 绝技 lv9 的 +25% 与觉醒 A 的 +20% 整体倍率，1 SP 配对提升 +35.6pp→+32.8pp；②再把队伍级被动一并削弱（司马「隐忍」护佑 20%→10%、庞「涅槃」回血 50%→30%、嫦「月魄」起身生命 35%→20%），1 SP 提升为 +35.3pp（司马 +38.8 / 庞 +34.2 / 嫦 +32.8），基本不动。结论：提升并不由 kit 倍率或被动数值决定，逐猫调 kit 到不了 +15~20pp；SP 的优势来自“同战力配对”下单体属性集中（RARITY_MULT.SP）与「SP 必定在场」这件事本身。若确要压到该区间，只能动引擎常量 RARITY_MULT.SP（此前试过同战力配对会把等级拉低来抵消，敏感度也很低）或改 SP 的获取与定位，而不是改 kit。用户已明确“不压”，此条仅作备案。',
    spSummary ?? '独立SP报告尚未读取；先生成SP报告，再运行本工具可自动带入带样本口径的摘要。',
    '建议优先确认首页福利的正式频率，再用完整经验/月光珠定价口径评估付费15%–40%及2倍上限。VIP单独日常铃铛在低进度占比高，若已定价子集早期超过2倍，优先按进度调整 vipPerks.dailyBells（当前100×VIP）；不要只降低最高VIP挂机倍率而保留其它叠加收益。EXP/月光珠价格未定，未提出盲算的新倍率。',
    '秘境若在完整口径确认过高，可调整 dungeonReward 的180分钟或档位强度/解锁映射；三次共享额度已正确，不应再砍“扫荡额外三次”。若包含首页福利后占比反而过低，先修福利口径，不按受其扭曲的分母提高秘境。',
    '竞技K=24本身能在固定胜率下给出稳定小步变化；若要求七日进入NPC榜中段，35次的+840硬上界与npcRating绝对基线必须一起处理，优先令初始积分/匹配分层与当期NPC相接，再决定K。NPC早入服、时间常数22及grind无需资源导致其与高肝玩家比较受碎片瓶颈影响；建议使用可复算的同注册日资源轨迹重标定，而非直接提高所有NPC战力。',
    '所有建议由Claude裁决。本PR只提交审查、脚本与测试；未修改任何游戏经济或战斗常量。月光珠/原始EXP计价、任务常态活动档位和首页福利口径已在Issue #51询问；答案到来前已定价子集与实物结果可独立复算。',
  ];
  return `${sections.join('\n\n')}\n`;
}
