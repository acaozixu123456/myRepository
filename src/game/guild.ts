// 公会「纸箱营」：三个由模拟玩家组成的公会。互助 / 捐献 / 每日纸箱都只记玩家自己的数据，
// 成员的贡献、公会等级是墙上时钟的纯函数（和 npc.ts 一样不进存档）。
import { rnd, NPC_BY_ID, EPOCH, DAY } from './npc';
import { addItem } from './inventory';
import { dayIndex } from './premium';
import { track } from './quests';
import type { PlayerState } from './state';

export interface GuildDef { id: string; name: string; motto: string; color: string; members: string[] }
export const GUILDS: GuildDef[] = [
  { id: 'g_box', name: '纸箱同盟', motto: '没有纸箱解决不了的事；如果有，就换个更大的。', color: '#c88a58', members: ['n01', 'n04', 'n07', 'n10', 'n13', 'n16', 'n19'] },
  { id: 'g_sun', name: '窗台晒太阳会', motto: '会长的唯一会规：别挡着我的光。', color: '#f0b030', members: ['n02', 'n05', 'n08', 'n11', 'n14', 'n17', 'n20'] },
  { id: 'g_moon', name: '午夜追逐团', motto: '凌晨三点跑酷，白天一起补觉。', color: '#6a5acd', members: ['n03', 'n06', 'n09', 'n12', 'n15', 'n18'] },
];
export const GUILD_BY_ID: Record<string, GuildDef> = Object.fromEntries(GUILDS.map((g) => [g.id, g]));

export const HELP_PER_DAY = 5;
export const DONATE_PER_DAY = 3;
export const DONATE_COST = 3000; // 小鱼干
export const HELP_REWARD = { tokens: 20, fish: 500, contrib: 10 };
export const DONATE_REWARD = { tokens: 20, contrib: 30 };
export const GUILD_MAX_LEVEL = 10;

export interface GuildState {
  id: string | null;
  contrib: number; // 在当前公会累计的贡献
  weekly: { key: number; v: number }; // 本周贡献（key = 周一的日序号）
  day: number; helps: number; donates: number; chest: boolean; // 当日计数
  leftDay: number; // 退会当日：同一天不能再入会
}

export function ensureGuild(s: PlayerState, now = Date.now()): GuildState {
  s.guild ??= { id: null, contrib: 0, weekly: { key: 0, v: 0 }, day: -1, helps: 0, donates: 0, chest: false, leftDay: -1 };
  const g = s.guild;
  g.contrib ??= 0; g.weekly ??= { key: 0, v: 0 }; g.leftDay ??= -1;
  const d = dayIndex(now);
  if (g.day !== d) { g.day = d; g.helps = 0; g.donates = 0; g.chest = false; }
  const wk = weekStart(d);
  if (g.weekly.key !== wk) g.weekly = { key: wk, v: 0 };
  return g;
}
/** 周一的日序号（dayIndex 的第 0 天是周四，所以 +3） */
const weekStart = (d: number) => d - ((d + 3) % 7);

export const myGuild = (s: PlayerState): GuildDef | null => (s.guild?.id ? GUILD_BY_ID[s.guild.id] ?? null : null);

// ---------- 公会进度（时间的纯函数） ----------
/** 某个成员某天的贡献 */
export function memberDaily(npcId: string, day: number): number {
  const n = NPC_BY_ID[npcId];
  return Math.round((20 + rnd('gd', npcId, day) * 70) * n.grind * (0.6 + n.chatty * 0.6));
}
const dayOfEpoch = (now: number) => Math.max(0, Math.floor((now - EPOCH) / DAY));
export function guildExp(g: GuildDef, now: number, mine = 0): number {
  let sum = mine;
  for (let d = 0; d <= dayOfEpoch(now); d++) for (const m of g.members) sum += memberDaily(m, d);
  return sum;
}
/** 升级所需累计经验：第 L 级门槛 = 600 * (L-1)^1.6 */
const need = (lv: number) => Math.round(600 * Math.pow(lv - 1, 1.6));
export function guildLevel(g: GuildDef, now: number, mine = 0): { level: number; exp: number; from: number; to: number | null } {
  const exp = guildExp(g, now, mine);
  let level = 1;
  while (level < GUILD_MAX_LEVEL && exp >= need(level + 1)) level++;
  return { level, exp, from: need(level), to: level < GUILD_MAX_LEVEL ? need(level + 1) : null };
}
/** 公会周榜：三个公会本周总贡献 */
export function guildWeekBoard(now: number, s?: PlayerState): { guild: GuildDef; score: number; mine: boolean }[] {
  const d = dayIndex(now), wk = weekStart(d);
  const my = s ? ensureGuild(s, now) : null;
  return GUILDS.map((guild) => {
    let score = 0;
    for (let x = wk; x <= d; x++) for (const m of guild.members) score += memberDaily(m, x);
    const mine = my?.id === guild.id;
    if (mine) score += my!.weekly.v;
    return { guild, score, mine };
  }).sort((a, b) => b.score - a.score);
}
export interface GuildMemberRow { id: string; name: string; avatar: string; score: number; me: boolean; leader: boolean }
/** 本公会成员周贡献榜（含玩家本人） */
export function guildMemberBoard(s: PlayerState, now = Date.now()): GuildMemberRow[] {
  const g = myGuild(s);
  if (!g) return [];
  const d = dayIndex(now), wk = weekStart(d);
  const rows: GuildMemberRow[] = g.members.map((id, i) => {
    let score = 0; for (let x = wk; x <= d; x++) score += memberDaily(id, x);
    return { id, name: NPC_BY_ID[id].name, avatar: NPC_BY_ID[id].avatar, score, me: false, leader: i === 0 };
  });
  rows.push({ id: 'me', name: s.name, avatar: '', score: ensureGuild(s, now).weekly.v, me: true, leader: false });
  return rows.sort((a, b) => b.score - a.score);
}

// ---------- 动作 ----------
export type Res<T = object> = ({ ok: true } & T) | { ok: false; reason: string };
export function joinGuild(s: PlayerState, id: string, now = Date.now()): Res {
  const g = ensureGuild(s, now);
  if (g.id) return { ok: false, reason: '已经在公会里了' };
  if (!GUILD_BY_ID[id]) return { ok: false, reason: '没有这个公会' };
  if (g.leftDay === dayIndex(now)) return { ok: false, reason: '今天刚退会，明天再来挑一个吧' };
  g.id = id; g.contrib = 0;
  return { ok: true };
}
export function leaveGuild(s: PlayerState, now = Date.now()): Res {
  const g = ensureGuild(s, now);
  if (!g.id) return { ok: false, reason: '还没加入公会' };
  g.id = null; g.contrib = 0; g.weekly.v = 0; g.leftDay = dayIndex(now);
  return { ok: true };
}
export const helpsLeft = (s: PlayerState, now = Date.now()) => HELP_PER_DAY - ensureGuild(s, now).helps;
export const donatesLeft = (s: PlayerState, now = Date.now()) => DONATE_PER_DAY - ensureGuild(s, now).donates;

/** 今天第 n 次互助的对象：成员里按日期轮转，保证同一天不重复 */
export function helpTarget(g: GuildDef, day: number, n: number): string {
  return g.members[(day + n) % g.members.length];
}
export function guildHelp(s: PlayerState, now = Date.now()): Res<{ target: string; fish: number; tokens: number }> {
  const st = ensureGuild(s, now), def = myGuild(s);
  if (!def) return { ok: false, reason: '先加入一个公会' };
  if (st.helps >= HELP_PER_DAY) return { ok: false, reason: '今天的互助次数用完了' };
  const target = helpTarget(def, st.day, st.helps);
  st.helps++; st.contrib += HELP_REWARD.contrib; st.weekly.v += HELP_REWARD.contrib;
  s.res.fish += HELP_REWARD.fish;
  addItem(s, 'guild_token', HELP_REWARD.tokens);
  track(s, 'guild_help');
  return { ok: true, target, fish: HELP_REWARD.fish, tokens: HELP_REWARD.tokens };
}
export function guildDonate(s: PlayerState, now = Date.now()): Res<{ tokens: number; contrib: number }> {
  const st = ensureGuild(s, now);
  if (!st.id) return { ok: false, reason: '先加入一个公会' };
  if (st.donates >= DONATE_PER_DAY) return { ok: false, reason: '今天的捐献次数用完了' };
  if (s.res.fish < DONATE_COST) return { ok: false, reason: '小鱼干不够' };
  s.res.fish -= DONATE_COST;
  st.donates++; st.contrib += DONATE_REWARD.contrib; st.weekly.v += DONATE_REWARD.contrib;
  addItem(s, 'guild_token', DONATE_REWARD.tokens);
  return { ok: true, tokens: DONATE_REWARD.tokens, contrib: DONATE_REWARD.contrib };
}
/** 每日纸箱：按公会等级发放，每天一次 */
export function chestReward(level: number) { return { tokens: 40 + 10 * level, fish: 1500 * level, bells: 20 }; }
export function guildChest(s: PlayerState, now = Date.now()): Res<{ tokens: number; fish: number; bells: number }> {
  const st = ensureGuild(s, now), def = myGuild(s);
  if (!def) return { ok: false, reason: '先加入一个公会' };
  if (st.chest) return { ok: false, reason: '今天的纸箱已经拆过了' };
  const r = chestReward(guildLevel(def, now, st.contrib).level);
  st.chest = true; s.res.fish += r.fish; s.res.bells += r.bells;
  addItem(s, 'guild_token', r.tokens);
  return { ok: true, ...r };
}
