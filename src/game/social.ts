// 玩家的社交状态：世界聊天、好友、竞技场（和模拟玩家切磋）。NPC 本身见 game/npc.ts（全部由时间推导，不进存档）。
import type { EnemySpawn, StageDef } from '../content/types';
import { addItem } from './inventory';
import { NPCS, NPC_BY_ID, npcLineup, npcOnline, npcProgress, repliesTo, worldFeed } from './npc';
import type { ChatMsg, Npc } from './npc';
import { dayIndex } from './premium';
import { track } from './quests';
import type { PlayerState } from './state';

export interface ArenaLog { t: number; npc: string; win: boolean; delta: number }
export interface SocialState {
  mine: { id: string; t: number; text: string; kind: 'me' | 'sys' }[]; // 玩家自己的发言与自己触发的喜报（最近 40 条）
  readT: number; // 聊天已读到的时间
  friends: string[]; // NPC id
  visit: Record<string, number>; // 好友 → 上次拜访的日序号
  arena: { day: number; used: number; extra: number; rating: number; wins: number; losses: number; best: number; log: ArenaLog[] };
}

export const CHAT_MAX_LEN = 40;
export const CHAT_GAP_MS = 2500;
export const FRIEND_MAX = 20;
export const ARENA_FREE = 5;
export const ARENA_EXTRA_COST = 30; // 金铃铛 / 次，每天最多再买 5 次
export const ARENA_EXTRA_MAX = 5;
export const ARENA_START = 1000;

export function ensureSocial(s: PlayerState): SocialState {
  s.social ??= { mine: [], readT: 0, friends: [], visit: {}, arena: { day: -1, used: 0, extra: 0, rating: ARENA_START, wins: 0, losses: 0, best: ARENA_START, log: [] } };
  const o = s.social;
  o.mine ??= []; o.friends ??= []; o.visit ??= {}; o.readT ??= 0;
  o.arena ??= { day: -1, used: 0, extra: 0, rating: ARENA_START, wins: 0, losses: 0, best: ARENA_START, log: [] };
  o.arena.extra ??= 0; o.arena.log ??= [];
  return o;
}

// ---------- 聊天 ----------
export type SendResult = { ok: true; msg: ChatMsg } | { ok: false; reason: string };
export function sendChat(s: PlayerState, text: string, now = Date.now()): SendResult {
  const o = ensureSocial(s);
  const t = text.trim().replace(/\s+/g, ' ');
  if (!t) return { ok: false, reason: '说点什么吧～' };
  if (t.length > CHAT_MAX_LEN) return { ok: false, reason: `最多 ${CHAT_MAX_LEN} 个字` };
  const last = [...o.mine].reverse().find((m) => m.kind === 'me');
  if (last && now - last.t < CHAT_GAP_MS) return { ok: false, reason: '说话太快啦，歇口气' };
  const m = { id: `me-${now}-${o.mine.length}`, t: now, text: t, kind: 'me' as const };
  o.mine.push(m);
  if (o.mine.length > 40) o.mine.splice(0, o.mine.length - 40);
  return { ok: true, msg: { ...m, from: 'me', name: s.name } };
}
/** 玩家触发的全服喜报（抽到 UR / SP 等） */
export function announce(s: PlayerState, text: string, now = Date.now()) {
  const o = ensureSocial(s);
  o.mine.push({ id: `sys-${now}-${o.mine.length}`, t: now, text, kind: 'sys' });
  if (o.mine.length > 40) o.mine.splice(0, o.mine.length - 40);
}

/** 世界频道：最近 hours 小时的所有消息（NPC 闲聊 + 玩家发言 + NPC 回应 + 喜报），按时间排序，保留最后 limit 条。 */
export function chatFeed(s: PlayerState, now = Date.now(), hours = 12, limit = 120): ChatMsg[] {
  const o = ensureSocial(s);
  const from = now - hours * 3600000;
  const out: ChatMsg[] = worldFeed(from, now);
  for (const m of o.mine) {
    if (m.t < from || m.t > now) continue;
    if (m.kind === 'sys') { out.push({ id: m.id, t: m.t, from: 'sys', name: '喜报', text: m.text, kind: 'sys' }); continue; }
    out.push({ id: m.id, t: m.t, from: 'me', name: s.name, text: m.text, kind: 'me' });
    for (const r of repliesTo(m, s.name)) if (r.t <= now) out.push(r);
  }
  out.sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1));
  return out.slice(-limit);
}
export function unreadCount(s: PlayerState, now = Date.now()): number {
  const o = ensureSocial(s);
  const from = Math.max(o.readT, now - 3 * 3600000);
  return Math.min(99, worldFeed(from + 1, now).filter((m) => m.kind !== 'sys').length);
}
export function markRead(s: PlayerState, now = Date.now()) { ensureSocial(s).readT = now; }

// ---------- 好友 ----------
export function isFriend(s: PlayerState, id: string) { return ensureSocial(s).friends.includes(id); }
export function addFriend(s: PlayerState, id: string): { ok: boolean; msg: string } {
  const o = ensureSocial(s);
  const n = NPC_BY_ID[id];
  if (!n) return { ok: false, msg: '找不到这位玩家' };
  if (o.friends.includes(id)) return { ok: false, msg: '已经是好友啦' };
  if (o.friends.length >= FRIEND_MAX) return { ok: false, msg: `好友已满 ${FRIEND_MAX} 位` };
  o.friends.push(id);
  return { ok: true, msg: `${n.name} 通过了你的好友申请` };
}
export function canVisit(s: PlayerState, id: string, now = Date.now()) {
  const o = ensureSocial(s);
  return o.friends.includes(id) && (o.visit[id] ?? -1) < dayIndex(now);
}
/** 拜访好友（每位每天一次）：得小鱼干，并计入“拜访好友”任务。 */
export function visitFriend(s: PlayerState, id: string, now = Date.now()): { ok: true; fish: number } | { ok: false; reason: string } {
  const o = ensureSocial(s);
  if (!o.friends.includes(id)) return { ok: false, reason: '先加为好友吧' };
  if (!canVisit(s, id, now)) return { ok: false, reason: '今天已经拜访过啦' };
  const fish = 300 + s.level * 20;
  o.visit[id] = dayIndex(now);
  s.res.fish += fish;
  track(s, 'visit_friend');
  return { ok: true, fish };
}

// ---------- 竞技场 ----------
export const npcRating = (n: Npc, now: number) => Math.round(600 + npcProgress(n, now).power * 0.25 + (n.vip >= 9 ? 120 : 0));
export interface ArenaRow { id: string; name: string; rating: number; power: number; level: number; online: boolean; me?: boolean; avatar: string }
export function arenaBoard(s: PlayerState, myPower: number, now = Date.now()): ArenaRow[] {
  const o = ensureSocial(s);
  const rows: ArenaRow[] = NPCS.map((n) => { const p = npcProgress(n, now); return { id: n.id, name: n.name, rating: npcRating(n, now), power: p.power, level: p.level, online: npcOnline(n, now), avatar: n.avatar }; });
  rows.push({ id: 'me', name: s.name, rating: o.arena.rating, power: myPower, level: s.level, online: true, me: true, avatar: s.lineup.find(Boolean) ?? 'wei_xiahoudun' });
  return rows.sort((a, b) => b.rating - a.rating);
}
export function arenaRefresh(s: PlayerState, now = Date.now()) {
  const a = ensureSocial(s).arena;
  const d = dayIndex(now);
  if (a.day !== d) { a.day = d; a.used = 0; a.extra = 0; }
  return a;
}
export const arenaLeft = (s: PlayerState, now = Date.now()) => { const a = arenaRefresh(s, now); return Math.max(0, ARENA_FREE + a.extra - a.used); };
export function arenaBuyExtra(s: PlayerState, now = Date.now()): { ok: boolean; reason?: string } {
  const a = arenaRefresh(s, now);
  if (a.extra >= ARENA_EXTRA_MAX) return { ok: false, reason: `今天最多再买 ${ARENA_EXTRA_MAX} 次` };
  if (s.res.bells < ARENA_EXTRA_COST) return { ok: false, reason: '金铃铛不够' };
  s.res.bells -= ARENA_EXTRA_COST; a.extra++;
  return { ok: true };
}
/** 把 NPC 变成一场可交给战斗循环的“关卡” */
export function arenaStage(npc: Npc, now = Date.now()): StageDef {
  const p = npcProgress(npc, now);
  const enemies: EnemySpawn[] = npcLineup(npc, now, p.level).map((u) => ({ unit: u.heroId, level: u.level, pos: u.pos }));
  return { id: `A-${npc.id}`, name: `切磋 ${npc.name}`, kind: 'normal', recommendedPower: p.power, waves: [{ enemies }], rewards: { fish: 0 }, firstClear: { fish: 0 } };
}
export const ARENA_REWARD = { win: 40, lose: 15 };
/** 结算一场切磋：Elo 积分（K=24）、猫爪印、任务进度。次数在开战前由 arenaStart 扣除。 */
export function arenaStart(s: PlayerState, now = Date.now()): { ok: boolean; reason?: string } {
  const a = arenaRefresh(s, now);
  if (arenaLeft(s, now) <= 0) return { ok: false, reason: '今天的切磋次数用完了，可以用金铃铛再买' };
  a.used++;
  return { ok: true };
}
export function arenaFinish(s: PlayerState, npcId: string, win: boolean, now = Date.now()): { delta: number; paw: number; rating: number } {
  const a = arenaRefresh(s, now);
  const n = NPC_BY_ID[npcId];
  const opp = npcRating(n, now);
  const expect = 1 / (1 + Math.pow(10, (opp - a.rating) / 400));
  const delta = Math.round(24 * ((win ? 1 : 0) - expect));
  a.rating = Math.max(0, a.rating + delta);
  a.best = Math.max(a.best, a.rating);
  if (win) a.wins++; else a.losses++;
  a.log.unshift({ t: now, npc: npcId, win, delta });
  a.log.length = Math.min(a.log.length, 20);
  const paw = win ? ARENA_REWARD.win : ARENA_REWARD.lose;
  addItem(s, 'paw_seal', paw);
  track(s, 'arena_battle');
  if (win) track(s, 'arena_win');
  return { delta, paw, rating: a.rating };
}
