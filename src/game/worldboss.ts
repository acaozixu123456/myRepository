// 世界 Boss「巨猫来袭」：每周轮换一只巨型 Boss，玩家每天 3 次挑战，按打掉的生命比例（伤害%）计奖励。
// 周累计伤害以「条」（1 条 = 100% 生命）计，达到里程碑一次性领周奖；排行榜上的模拟玩家同样是时间的纯函数。
import { addPoints } from './events';
import type { EnemySpawn, StageDef } from '../content/types';
import { HERO_BY_ID } from '../data/heroes';
import { NPCS, npcOnline, npcProgress, rnd } from './npc';
import { dayIndex } from './premium';
import { addItem } from './inventory';
import { bestOrdinal } from './dungeon';
import { idleRate, paceLevel } from './stage';
import type { PlayerState } from './state';

export interface BossDef { id: string; hero: string; title: string; desc: string; hpMul: number; theme: number }
/** hpMul 由校准得出：默认五猫在各进度点约能打掉 40% 生命（战力越强越多） */
export const BOSSES: BossDef[] = [
  { id: 'wb_cao', hero: 'wei_caomiaode', title: '丞相巨猫曹喵德', desc: '把整座纸箱城当成棋盘的巨猫，每一步都像在下棋。', hpMul: 26, theme: 2 },
  { id: 'wb_zhou', hero: 'wu_zhoumiaoyu', title: '赤壁琴师周喵瑜', desc: '一曲终了，整片江面的毛线球都在打节拍。', hpMul: 10, theme: 3 },
  { id: 'wb_meng', hero: 'man_mengmiaohuo', title: '南疆巨藤孟喵获', desc: '七次被捉又七次放回的巨猫，这回想换你被抓一次。', hpMul: 12, theme: 4 },
  { id: 'wb_zuo', hero: 'xian_zuoci', title: '云端幻师左慈喵', desc: '分不清哪只是真身，不过没关系，打到最后一只就是了。', hpMul: 29, theme: 5 },
  { id: 'wb_lv', hero: 'qun_lvbuding', title: '无双布丁吕布丁', desc: '天下第一的布丁勇士，一人当关，万猫莫开。', hpMul: 22, theme: 6 },
  { id: 'wb_dong', hero: 'qun_dongzhuo', title: '桌下霸王董桌', desc: '体型是桌子的三倍，脾气是桌子的五倍。', hpMul: 3, theme: 1 },
];
export const ATTEMPTS_PER_DAY = 3;
export const MILESTONES: { bars: number; bells: number; paw: number; tickets: number }[] = [
  { bars: 1, bells: 20, paw: 50, tickets: 0 },
  { bars: 2, bells: 30, paw: 75, tickets: 0 },
  { bars: 4, bells: 50, paw: 125, tickets: 0 },
  { bars: 7, bells: 80, paw: 200, tickets: 1 },
  { bars: 10, bells: 100, paw: 300, tickets: 2 },
];

export interface BossState {
  day: number; used: number; // 当日已挑战次数
  week: number; bars: number; best: number; claimed: number[]; // 本周累计「条」、单次最高伤害%、已领里程碑下标
}
const weekStart = (d: number) => d - ((d + 3) % 7);
export function ensureBoss(s: PlayerState, now = Date.now()): BossState {
  s.wboss ??= { day: -1, used: 0, week: 0, bars: 0, best: 0, claimed: [] };
  const b = s.wboss;
  b.claimed ??= []; b.bars ??= 0; b.best ??= 0;
  const d = dayIndex(now);
  if (b.day !== d) { b.day = d; b.used = 0; }
  const wk = weekStart(d);
  if (b.week !== wk) { b.week = wk; b.bars = 0; b.best = 0; b.claimed = []; }
  return b;
}
export const bossOfWeek = (now = Date.now()): BossDef => BOSSES[(weekStart(dayIndex(now)) / 7) % BOSSES.length | 0];
export const attemptsLeft = (s: PlayerState, now = Date.now()) => ATTEMPTS_PER_DAY - ensureBoss(s, now).used;
export const bossLevel = (s: PlayerState) => Math.max(1, paceLevel(bestOrdinal(s)));

export function bossStage(s: PlayerState, now = Date.now(), def: BossDef = bossOfWeek(now)): StageDef {
  const enemy: EnemySpawn = { unit: def.hero, level: bossLevel(s), pos: 2, hpMul: def.hpMul };
  return { id: `WB-${def.id}`, name: def.title, kind: 'boss', recommendedPower: 0, waves: [{ enemies: [enemy] }], rewards: { fish: 0 }, firstClear: { fish: 0 } };
}
export const bossHero = (now = Date.now()) => HERO_BY_ID[bossOfWeek(now).hero];

export function startAttempt(s: PlayerState, now = Date.now()): { ok: boolean; reason?: string } {
  const b = ensureBoss(s, now);
  if (b.used >= ATTEMPTS_PER_DAY) return { ok: false, reason: '今天的挑战次数用完了' };
  b.used++;
  return { ok: true };
}
/** 单次挑战的奖励：保底 + 随伤害增长 */
export function attemptReward(s: PlayerState, pct: number) {
  const fish = Math.round(idleRate(s).fish * 60 * (0.5 + pct));
  return { fish, catnip: 5 + Math.round(10 * pct), paw: 10 + Math.round(15 * pct) };
}
export function finishAttempt(s: PlayerState, pct: number, now = Date.now()) {
  const b = ensureBoss(s, now);
  const p = Math.max(0, Math.min(1, pct));
  b.bars += p; b.best = Math.max(b.best, p);
  addPoints(s, 'boss', 1, now);
  const r = attemptReward(s, p);
  s.res.fish += r.fish; s.res.catnip += r.catnip; addItem(s, 'paw_seal', r.paw);
  return { pct: p, ...r };
}
export const claimable = (s: PlayerState, now = Date.now()) => { const b = ensureBoss(s, now); return MILESTONES.map((m, i) => b.bars >= m.bars && !b.claimed.includes(i)); };
export function claimMilestone(s: PlayerState, i: number, now = Date.now()): { ok: true; m: (typeof MILESTONES)[number] } | { ok: false; reason: string } {
  const b = ensureBoss(s, now), m = MILESTONES[i];
  if (!m) return { ok: false, reason: '没有这一档' };
  if (b.claimed.includes(i)) return { ok: false, reason: '已经领过了' };
  if (b.bars < m.bars) return { ok: false, reason: '累计伤害还不够' };
  b.claimed.push(i);
  s.res.bells += m.bells; s.res.tickets += m.tickets; addItem(s, 'paw_seal', m.paw);
  return { ok: true, m };
}

// ---------- 排行榜（模拟玩家） ----------
const participates: Record<string, number> = { lurker: 0.4, casual: 0.7, grinder: 1 };
export function npcBars(npcId: string, now = Date.now()): number {
  const n = NPCS.find((x) => x.id === npcId)!;
  const d = dayIndex(now), wk = weekStart(d);
  let bars = 0;
  for (let x = wk; x <= d; x++) {
    if (rnd('wb', npcId, x) > (participates[n.profile] ?? 0.85)) continue;
    const t = new Date(0).getTime() + x * 86400000;
    const power = npcProgress(n, Math.min(now, t + 12 * 3600000)).power;
    for (let a = 0; a < ATTEMPTS_PER_DAY; a++) {
      if (x === d && !npcOnline(n, now) && rnd('wbo', npcId, x, a) > 0.5) continue; // 今天还没轮到
      bars += Math.min(0.95, 0.12 + 0.45 * Math.min(1.4, power / 9000) * (0.6 + 0.8 * rnd('wbd', npcId, x, a)));
    }
  }
  return bars;
}
export interface BossRow { id: string; name: string; avatar: string; bars: number; me: boolean }
export function bossBoard(s: PlayerState, now = Date.now()): BossRow[] {
  const rows: BossRow[] = NPCS.map((n) => ({ id: n.id, name: n.name, avatar: n.avatar, bars: npcBars(n.id, now), me: false }));
  rows.push({ id: 'me', name: s.name, avatar: '', bars: ensureBoss(s, now).bars, me: true });
  return rows.sort((a, b) => b.bars - a.bars);
}
