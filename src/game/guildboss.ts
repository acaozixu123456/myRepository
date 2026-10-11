// 公会 Boss「纸箱大魔王」：每周一只，公会成员（模拟玩家 + 玩家）共同攻打，伤害按「条」累计（1 条 = 打掉 100% 生命）。
// 成员的伤害是时间的纯函数；玩家每天 2 次挑战，战斗结算复用世界 Boss 的伤害比例。公会累计伤害达到总血量即「讨伐成功」，全员可领讨伐奖。
import { addItem } from './inventory';
import { myGuild, guildLevel, ensureGuild } from './guild';
import type { GuildDef } from './guild';
import { NPC_BY_ID, npcProgress, rnd } from './npc';
import { addPoints, grant } from './events';
import type { Reward } from './events';
import { dayIndex } from './premium';
import { BOSSES, bossStage } from './worldboss';
import type { BossDef } from './worldboss';
import type { PlayerState } from './state';

export const GB_ATTEMPTS = 2;
export interface GuildBossState { week: number; day: number; used: number; bars: number; killClaimed: boolean; claimed: number[] }
const weekStart = (d: number) => d - ((d + 3) % 7);

export function ensureGB(s: PlayerState, now = Date.now()): GuildBossState {
  s.gboss ??= { week: 0, day: -1, used: 0, bars: 0, killClaimed: false, claimed: [] };
  const g = s.gboss, d = dayIndex(now);
  g.claimed ??= [];
  if (g.day !== d) { g.day = d; g.used = 0; }
  const wk = weekStart(d);
  if (g.week !== wk) { g.week = wk; g.bars = 0; g.killClaimed = false; g.claimed = []; }
  return g;
}
/** 本周公会 Boss（与世界 Boss 错开 3 位，永不撞车） */
export const guildBossOf = (now = Date.now()): BossDef => BOSSES[((weekStart(dayIndex(now)) / 7) % BOSSES.length + 3) % BOSSES.length | 0];
export const gbAttemptsLeft = (s: PlayerState, now = Date.now()) => GB_ATTEMPTS - ensureGB(s, now).used;

/** 公会 Boss 总血量（条）：公会越高级越厚 */
/** 以周一 00:00 时的公会等级为准，本周内血量不变 */
export const guildBossHp = (g: GuildDef, now = Date.now()) => {
  const wkStart = weekStart(dayIndex(now)) * 86400000 + new Date(now).getTimezoneOffset() * 60000;
  return Math.round((10 + 1.5 * guildLevel(g, wkStart, 0).level) * 10) / 10;
};
/** 某成员某天打出的条数 */
export function memberBars(npcId: string, day: number, now = Date.now()): number {
  const n = NPC_BY_ID[npcId];
  if (rnd('gb', npcId, day) > 0.85) return 0;
  const power = npcProgress(n, now).power;
  let v = 0;
  for (let a = 0; a < GB_ATTEMPTS; a++) v += Math.min(0.9, 0.1 + 0.4 * Math.min(1.4, power / 9000) * (0.6 + 0.8 * rnd('gbd', npcId, day, a)));
  return v;
}
export interface GBRow { id: string; name: string; avatar: string; bars: number; me: boolean }
export function gbBoard(s: PlayerState, now = Date.now()): GBRow[] {
  const g = myGuild(s); if (!g) return [];
  const d = dayIndex(now), wk = weekStart(d);
  const rows: GBRow[] = g.members.map((id) => {
    let bars = 0; for (let x = wk; x <= d; x++) bars += memberBars(id, x, now);
    return { id, name: NPC_BY_ID[id].name, avatar: NPC_BY_ID[id].avatar, bars, me: false };
  });
  rows.push({ id: 'me', name: s.name, avatar: '', bars: ensureGB(s, now).bars, me: true });
  return rows.sort((a, b) => b.bars - a.bars);
}
export function gbProgress(s: PlayerState, now = Date.now()) {
  const g = myGuild(s); if (!g) return null;
  const st = ensureGB(s, now), board = gbBoard(s, now);
  const total = board.reduce((a, r) => a + r.bars, 0), hp = guildBossHp(g, now);
  return { guild: g, boss: guildBossOf(now), hp, total, defeated: total >= hp, board, mine: st.bars };
}
export const GB_PERSONAL: { bars: number; r: Reward }[] = [
  { bars: 1, r: { items: { guild_token: 30 }, fish: 5000 } },
  { bars: 3, r: { bells: 100, items: { guild_token: 40 } } },
  { bars: 6, r: { items: { fishbone_large: 1, guild_token: 60 } } },
];
export const GB_KILL: Reward = { items: { guild_token: 80, fishbone_medium: 2 }, bells: 150, tickets: 1 };

export function gbStage(s: PlayerState, now = Date.now()) { return bossStage(s, now, guildBossOf(now)); }
export function gbStart(s: PlayerState, now = Date.now()): { ok: boolean; reason?: string } {
  if (!myGuild(s)) return { ok: false, reason: '先加入一个公会' };
  const st = ensureGB(s, now);
  if (st.used >= GB_ATTEMPTS) return { ok: false, reason: '今天的公会 Boss 次数用完了' };
  st.used++;
  return { ok: true };
}
export function gbFinish(s: PlayerState, pct: number, now = Date.now()) {
  const st = ensureGB(s, now), p = Math.max(0, Math.min(1, pct));
  st.bars += p;
  const g = ensureGuild(s, now); g.contrib += Math.round(p * 20); g.weekly.v += Math.round(p * 20);
  const fish = Math.round(1500 * (0.5 + p));
  s.res.fish += fish; addItem(s, 'guild_token', Math.round(10 + 10 * p));
  addPoints(s, 'boss', 1, now);
  return { pct: p, fish };
}
export function gbClaimPersonal(s: PlayerState, i: number, now = Date.now()): { ok: true; r: Reward } | { ok: false; reason: string } {
  const st = ensureGB(s, now), t = GB_PERSONAL[i];
  if (!t) return { ok: false, reason: '没有这一档' };
  if (st.claimed.includes(i)) return { ok: false, reason: '已经领过了' };
  if (st.bars < t.bars) return { ok: false, reason: '个人伤害还不够' };
  st.claimed.push(i); grant(s, t.r);
  return { ok: true, r: t.r };
}
export function gbClaimKill(s: PlayerState, now = Date.now()): { ok: true; r: Reward } | { ok: false; reason: string } {
  const pr = gbProgress(s, now);
  if (!pr) return { ok: false, reason: '先加入一个公会' };
  const st = ensureGB(s, now);
  if (st.killClaimed) return { ok: false, reason: '本周讨伐奖已经领过了' };
  if (!pr.defeated) return { ok: false, reason: '公会还没打倒 Boss' };
  if (st.bars <= 0) return { ok: false, reason: '自己至少要出一次手才能领讨伐奖' };
  st.killClaimed = true; grant(s, GB_KILL);
  return { ok: true, r: GB_KILL };
}
