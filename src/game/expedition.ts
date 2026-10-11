// 猫猫远征（派遣）：把没上阵的猫派出去，按真实时间结算，下线也在跑。
// 每条路线有 3 个「需要」（人数 / 职业 / 同阵营 / 平均等级），满足得越多收益倍数越高——鼓励养不同职业和阵营的猫。
import { HERO_BY_ID } from '../data/heroes';
import type { Role } from '../data/heroes';
import { addItem } from './inventory';
import { addPoints } from './events';
import { cardDaysLeft, vipLevel } from './premium';
import { applyGain, idleRate } from './stage';
import { isInLineup } from './state';
import type { PlayerState } from './state';

export type Need =
  | { k: 'size'; n: number }
  | { k: 'role'; role: Role; n: number }
  | { k: 'faction'; n: number } // 队里至少 n 只同阵营
  | { k: 'level'; n: number }; // 平均等级
export interface Route { id: string; name: string; desc: string; minutes: number; max: number; needs: Need[]; catnip: number; tokens: number; tickets: number }
export const ROUTES: Route[] = [
  { id: 'patrol', name: '纸箱街巡逻', desc: '沿着纸箱街转一圈，顺手把迷路的小猫送回家。', minutes: 30, max: 3, needs: [{ k: 'size', n: 2 }, { k: 'role', role: '先锋', n: 1 }, { k: 'level', n: 10 }], catnip: 2, tokens: 0, tickets: 0 },
  { id: 'watch', name: '窗台观察哨', desc: '蹲在窗台数鸽子，数完再把消息带回营地。', minutes: 120, max: 4, needs: [{ k: 'size', n: 3 }, { k: 'role', role: '医者', n: 1 }, { k: 'faction', n: 2 }], catnip: 8, tokens: 20, tickets: 0 },
  { id: 'mint', name: '远山寻薄荷', desc: '翻过三座山头，据说山后的薄荷田一年四季都开花。', minutes: 480, max: 5, needs: [{ k: 'size', n: 4 }, { k: 'role', role: '守护', n: 1 }, { k: 'faction', n: 3 }], catnip: 30, tokens: 60, tickets: 1 },
];
export const ROUTE_BY_ID: Record<string, Route> = Object.fromEntries(ROUTES.map((r) => [r.id, r]));
/** 满足 0 / 1 / 2 / 3 个需要时的收益倍数 */
export const MULTS = [1, 1.3, 1.7, 2.4];
export const BASE_SHARE = 0.5; // 一支队伍基础收益 = 同时长挂机收益的 50%

export interface Team { id: number; route: string; heroes: string[]; start: number; end: number; mult: number; met: number }
export interface ExpeditionState { teams: Team[]; seq: number; done: number }
export function ensureExpedition(s: PlayerState): ExpeditionState {
  s.expedition ??= { teams: [], seq: 0, done: 0 };
  s.expedition.teams ??= [];
  return s.expedition;
}
export const slotsOf = (s: PlayerState, now = Date.now()) => 1 + (vipLevel(s) >= 3 ? 1 : 0) + (vipLevel(s) >= 8 ? 1 : 0) + (cardDaysLeft(s, now) > 0 ? 1 : 0);
export const busyHeroes = (s: PlayerState) => new Set(ensureExpedition(s).teams.flatMap((t) => t.heroes));
export const isBusy = (s: PlayerState, id: string) => busyHeroes(s).has(id);
/** 可以派出去的猫：已拥有、没在阵容里、没在别的队伍里 */
export const availableHeroes = (s: PlayerState) => Object.keys(s.heroes).filter((id) => HERO_BY_ID[id] && !isInLineup(s, id) && !isBusy(s, id));

export function needMet(s: PlayerState, need: Need, heroes: string[]): boolean {
  if (need.k === 'size') return heroes.length >= need.n;
  if (need.k === 'role') return heroes.filter((id) => HERO_BY_ID[id]?.role === need.role).length >= need.n;
  if (need.k === 'faction') { const c: Record<string, number> = {}; for (const id of heroes) { const f = HERO_BY_ID[id]?.faction; if (f) c[f] = (c[f] ?? 0) + 1; } return Math.max(0, ...Object.values(c)) >= need.n; }
  const lvs = heroes.map((id) => s.heroes[id]?.lv ?? 0);
  return lvs.length > 0 && lvs.reduce((a, b) => a + b, 0) / lvs.length >= need.n;
}
export const needsMet = (s: PlayerState, route: Route, heroes: string[]) => route.needs.filter((n) => needMet(s, n, heroes)).length;
export const needText = (n: Need): string => (n.k === 'size' ? `至少 ${n.n} 只猫` : n.k === 'role' ? `至少 ${n.n} 只${n.role}` : n.k === 'faction' ? `至少 ${n.n} 只同阵营` : `平均等级 ≥ ${n.n}`);

export function rewardFor(s: PlayerState, route: Route, met: number) {
  const m = MULTS[met], r = idleRate(s), k = route.minutes * BASE_SHARE * m;
  const perfect = met === route.needs.length;
  return { fish: Math.round(r.fish * k), exp: Math.round(r.exp * k), catnip: Math.round(route.catnip * m), tokens: perfect ? route.tokens : 0, tickets: perfect ? route.tickets : 0, mult: m };
}
export function dispatch(s: PlayerState, routeId: string, heroes: string[], now = Date.now()): { ok: true; team: Team } | { ok: false; reason: string } {
  const route = ROUTE_BY_ID[routeId], ex = ensureExpedition(s);
  if (!route) return { ok: false, reason: '没有这条路线' };
  if (ex.teams.length >= slotsOf(s, now)) return { ok: false, reason: '队伍都出门了，先等一支回来' };
  const uniq = [...new Set(heroes)];
  if (!uniq.length) return { ok: false, reason: '至少派一只猫' };
  if (uniq.length > route.max) return { ok: false, reason: `这条路线最多派 ${route.max} 只` };
  const free = new Set(availableHeroes(s));
  if (uniq.some((id) => !free.has(id))) return { ok: false, reason: '有猫在阵容里或已经出门了' };
  const met = needsMet(s, route, uniq);
  const team: Team = { id: ++ex.seq, route: routeId, heroes: uniq, start: now, end: now + route.minutes * 60000, mult: MULTS[met], met };
  ex.teams.push(team);
  return { ok: true, team };
}
export const teamDone = (t: Team, now = Date.now()) => now >= t.end;
export const minutesLeft = (t: Team, now = Date.now()) => Math.max(0, Math.ceil((t.end - now) / 60000));
export function claimTeam(s: PlayerState, teamId: number, now = Date.now()): { ok: true; reward: ReturnType<typeof rewardFor>; perfect: boolean } | { ok: false; reason: string } {
  const ex = ensureExpedition(s), i = ex.teams.findIndex((t) => t.id === teamId);
  if (i < 0) return { ok: false, reason: '没有这支队伍' };
  const t = ex.teams[i], route = ROUTE_BY_ID[t.route];
  if (!teamDone(t, now)) return { ok: false, reason: `还要 ${minutesLeft(t, now)} 分钟才回来` };
  const reward = rewardFor(s, route, t.met);
  applyGain(s, { fish: reward.fish, exp: reward.exp, catnip: reward.catnip, bells: 0 });
  if (reward.tokens) addItem(s, 'guild_token', reward.tokens);
  s.res.tickets += reward.tickets;
  ex.teams.splice(i, 1); ex.done++;
  addPoints(s, 'dispatch', 1, now);
  return { ok: true, reward, perfect: t.met === route.needs.length };
}
