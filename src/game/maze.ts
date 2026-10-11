// 纸箱迷宫（肉鸽）：一局 8 层，每层打完在 3 个加成里选 1 个，血量与元气带到下一层；全队倒下则本局结束，按通过层数结算。
// 战斗仍由引擎自动打，决策发生在战斗之间。选项由「日期 + 局数 + 层数」的种子确定，刷新页面不会变；进行中的一局会存档。
import type { EnemySpawn, StageDef } from '../content/types';
import { FACTIONS } from '../data/factions';
import type { FactionId } from '../data/factions';
import type { UnitSetup } from '../engine/types';
import { addItem } from './inventory';
import { rnd } from './npc';
import { dayIndex, vipLevel } from './premium';
import { bestOrdinal } from './dungeon';
import { BOSSES } from './worldboss';
import { lineupSetups, paceLevel } from './stage';
import { heroGear } from './gear';
import { heroStats } from './state';
import type { PlayerState } from './state';

export const MAZE_FLOORS = 8;
export const MAZE_LEVEL_STEP = 2; // 每层敌方等级比上一层高多少
export const MAZE_HP_STEP = 0.3; // 每层敌方生命倍率增加多少（杂兵本身偏脆，靠它拉开难度）
export const MAZE_STAT_STEP = 0.14; // 每层敌方全属性倍率增加多少
export const MAZE_EXTRA_COST = 50, MAZE_EXTRA_MAX = 2;
export const freeRuns = (vip: number) => 1 + (vip >= 3 ? 1 : 0) + (vip >= 8 ? 1 : 0);

// ---------- 加成 ----------
export type Rarity = 'common' | 'rare' | 'epic';
export interface BuffEffect {
  hp?: number; atk?: number; def?: number; spd?: number; // 乘在基础属性上的比例（0.1 = +10%；spd 为百分比折算后的整数加成）
  crit?: number; critDmg?: number; dmgReduce?: number; healBonus?: number; dodge?: number; hit?: number; // 直接加到战斗属性
  heal?: number; energy?: number; // 一次性：立即回复全队这么多比例的生命 / 这么多点元气
}
export interface Buff { id: string; name: string; desc: string; rarity: Rarity; e: BuffEffect }
export const BUFFS: Buff[] = [
  { id: 'atk1', name: '磨利爪子', desc: '全队攻击 +8%', rarity: 'common', e: { atk: 0.08 } },
  { id: 'atk2', name: '猛虎下山', desc: '全队攻击 +14%', rarity: 'rare', e: { atk: 0.14 } },
  { id: 'atk3', name: '一爪定乾坤', desc: '全队攻击 +22%', rarity: 'epic', e: { atk: 0.22 } },
  { id: 'def1', name: '厚实的毛', desc: '全队防御 +10%', rarity: 'common', e: { def: 0.1 } },
  { id: 'def2', name: '纸箱铠甲', desc: '全队防御 +18%', rarity: 'rare', e: { def: 0.18 } },
  { id: 'hp1', name: '吃饱喝足', desc: '全队生命 +8%，并回复 15% 生命', rarity: 'common', e: { hp: 0.08, heal: 0.15 } },
  { id: 'hp2', name: '九命加护', desc: '全队生命 +16%', rarity: 'rare', e: { hp: 0.16 } },
  { id: 'hp3', name: '午睡大法', desc: '全队生命 +12%，并回复 40% 生命', rarity: 'epic', e: { hp: 0.12, heal: 0.4 } },
  { id: 'crit1', name: '敏锐的眼', desc: '全队暴击率 +8%', rarity: 'common', e: { crit: 0.08 } },
  { id: 'crit2', name: '要害一击', desc: '全队暴击率 +12%、暴伤 +25%', rarity: 'rare', e: { crit: 0.12, critDmg: 0.25 } },
  { id: 'cd1', name: '重重一拍', desc: '全队暴击伤害 +30%', rarity: 'rare', e: { critDmg: 0.3 } },
  { id: 'red1', name: '软乎乎', desc: '全队受到伤害 -6%', rarity: 'common', e: { dmgReduce: 0.06 } },
  { id: 'red2', name: '团成一团', desc: '全队受到伤害 -12%', rarity: 'epic', e: { dmgReduce: 0.12 } },
  { id: 'spd1', name: '轻盈步伐', desc: '全队速度 +8%', rarity: 'common', e: { spd: 0.08 } },
  { id: 'spd2', name: '追着光点跑', desc: '全队速度 +15%、闪避 +6%', rarity: 'rare', e: { spd: 0.15, dodge: 0.06 } },
  { id: 'heal1', name: '呼噜疗愈', desc: '全队治疗效果 +20%，并回复 20% 生命', rarity: 'common', e: { healBonus: 0.2, heal: 0.2 } },
  { id: 'eng1', name: '猫薄荷一小口', desc: '全队立刻获得 30 点元气', rarity: 'common', e: { energy: 30 } },
  { id: 'eng2', name: '精神抖擞', desc: '全队立刻获得 60 点元气', rarity: 'rare', e: { energy: 60 } },
  { id: 'rest', name: '钻进纸箱睡一觉', desc: '全队回复 50% 生命', rarity: 'rare', e: { heal: 0.5 } },
  { id: 'all1', name: '喵洲祝福', desc: '全队攻击 +8%、防御 +8%、生命 +8%', rarity: 'epic', e: { atk: 0.08, def: 0.08, hp: 0.08 } },
];
export const BUFF_BY_ID: Record<string, Buff> = Object.fromEntries(BUFFS.map((b) => [b.id, b]));

// ---------- 状态 ----------
export interface MazeRun { id: number; floor: number; pending: 'fight' | 'choose'; buffs: string[]; carry: Record<string, { hpPct: number; energy: number }> }
export interface MazeState { day: number; used: number; bought: number; best: number; runs: number; active: MazeRun | null }
export function ensureMaze(s: PlayerState, now = Date.now()): MazeState {
  s.maze ??= { day: -1, used: 0, bought: 0, best: 0, runs: 0, active: null };
  const m = s.maze, d = dayIndex(now);
  m.active ??= null;
  if (m.day !== d) { m.day = d; m.used = 0; m.bought = 0; }
  return m;
}
export const runsLeft = (s: PlayerState, now = Date.now()) => { const m = ensureMaze(s, now); return freeRuns(vipLevel(s)) + m.bought - m.used; };
export function buyRun(s: PlayerState, now = Date.now()): { ok: boolean; reason?: string } {
  const m = ensureMaze(s, now);
  if (m.bought >= MAZE_EXTRA_MAX) return { ok: false, reason: `今天最多再买 ${MAZE_EXTRA_MAX} 次` };
  if (s.res.bells < MAZE_EXTRA_COST) return { ok: false, reason: '金铃铛不够' };
  s.res.bells -= MAZE_EXTRA_COST; m.bought++;
  return { ok: true };
}
export function startRun(s: PlayerState, now = Date.now()): { ok: true; run: MazeRun } | { ok: false; reason: string } {
  const m = ensureMaze(s, now);
  if (m.active) return { ok: false, reason: '已经有一局进行中了' };
  if (runsLeft(s, now) <= 0) return { ok: false, reason: '今天的迷宫次数用完了' };
  m.used++; m.runs++;
  const carry: MazeRun['carry'] = {};
  for (const id of s.lineup) if (id && s.heroes[id]) carry[id] = { hpPct: 1, energy: 0 };
  m.active = { id: m.runs, floor: 1, pending: 'fight', buffs: [], carry };
  return { ok: true, run: m.active };
}

// ---------- 选项（确定性） ----------
const weights = (floor: number): Record<Rarity, number> => (floor <= 2 ? { common: 70, rare: 28, epic: 2 } : floor <= 5 ? { common: 45, rare: 42, epic: 13 } : { common: 25, rare: 45, epic: 30 });
/** 打完第 floor 层后的 3 个选项：由 day、局 id、层数种子确定，互不重复 */
export function buffChoices(run: MazeRun, day: number, floor = run.floor): Buff[] {
  const out: Buff[] = [], w = weights(floor);
  for (let k = 0; out.length < 3 && k < 60; k++) {
    let x = rnd('maze', day, run.id, floor, k, 'r') * (w.common + w.rare + w.epic);
    const rarity: Rarity = (x -= w.common) < 0 ? 'common' : (x -= w.rare) < 0 ? 'rare' : 'epic';
    const pool = BUFFS.filter((b) => b.rarity === rarity && !out.includes(b));
    if (pool.length) out.push(pool[Math.floor(rnd('maze', day, run.id, floor, k, 'p') * pool.length)]);
  }
  return out;
}
export function chooseBuff(s: PlayerState, id: string, now = Date.now()): { ok: true; buff: Buff } | { ok: false; reason: string } {
  const m = ensureMaze(s, now), run = m.active;
  if (!run || run.pending !== 'choose') return { ok: false, reason: '现在不用选加成' };
  const buff = buffChoices(run, m.day).find((b) => b.id === id);
  if (!buff) return { ok: false, reason: '没有这个选项' };
  run.buffs.push(buff.id);
  for (const c of Object.values(run.carry)) {
    if (c.hpPct > 0 && buff.e.heal) c.hpPct = Math.min(1, c.hpPct + buff.e.heal);
    if (c.hpPct > 0 && buff.e.energy) c.energy = Math.min(100, c.energy + buff.e.energy);
  }
  run.floor++; run.pending = 'fight';
  return { ok: true, buff };
}

// ---------- 战斗配置 ----------
const total = (run: MazeRun, key: keyof BuffEffect) => run.buffs.reduce((a, id) => a + (BUFF_BY_ID[id]?.e[key] ?? 0), 0);
/** 我方出战配置：装备 + 本局加成 + 上一层留下的血量 / 元气 */
export function mazeSetups(s: PlayerState, run: MazeRun): UnitSetup[] {
  return lineupSetups(s, run.carry).map((u) => {
    const h = s.heroes[u.heroId], base = heroStats(h, heroGear(s, u.heroId).stats);
    const g = { ...(u.gear ?? {}) } as Record<string, number>;
    g.hp = (g.hp ?? 0) + Math.round(base.hp * total(run, 'hp'));
    g.atk = (g.atk ?? 0) + Math.round(base.atk * total(run, 'atk'));
    g.def = (g.def ?? 0) + Math.round(base.def * total(run, 'def'));
    g.spd = (g.spd ?? 0) + Math.round(base.spd * total(run, 'spd'));
    for (const k of ['crit', 'critDmg', 'dmgReduce', 'healBonus', 'dodge', 'hit'] as const) g[k] = (g[k] ?? 0) + total(run, k);
    return { ...u, gear: g };
  });
}
const MOB_ROLES = ['guard', 'vanguard', 'guard', 'archer', 'healer'];
const FACTION_LIST = Object.keys(FACTIONS) as FactionId[];
export function mazeStage(s: PlayerState, run: MazeRun, day: number): StageDef {
  const base = paceLevel(Math.max(1, bestOrdinal(s)));
  const f = run.floor, level = Math.max(1, base + Math.round(f * MAZE_LEVEL_STEP));
  const faction = FACTION_LIST[Math.floor(rnd('mazef', day, run.id, f) * FACTION_LIST.length)];
  const boss = f >= MAZE_FLOORS;
  const enemies: EnemySpawn[] = MOB_ROLES.slice(0, boss ? 3 : f >= 5 ? 5 : 4).map((role, pos) => ({ unit: `mob_${faction}_${role}`, level, pos: boss ? [0, 1, 3][pos] : pos, hpMul: 1 + MAZE_HP_STEP * f, statMul: 1 + MAZE_STAT_STEP * f }));
  if (boss) enemies.push({ unit: BOSSES[Math.floor(rnd('mazeb', day, run.id) * BOSSES.length)].hero, level: level + 4, pos: 2, hpMul: 1.6 });
  return { id: `MZ-${run.id}-${f}`, name: boss ? '纸箱迷宫·首领层' : `纸箱迷宫·第 ${f} 层`, kind: boss ? 'boss' : 'normal', recommendedPower: 0, waves: [{ enemies }], rewards: { fish: 0 }, firstClear: { fish: 0 } };
}

// ---------- 结算 ----------
export interface MazeReward { fish: number; catnip: number; bells: number; tickets: number; items: Record<string, number> }
export function mazeRewardFor(cleared: number): MazeReward {
  const r: MazeReward = { fish: 0, catnip: 0, bells: 0, tickets: 0, items: {} };
  for (let f = 1; f <= cleared; f++) { r.fish += 2000 + 1500 * f; r.catnip += f; }
  if (cleared >= 4) { r.bells += 50; r.items.paw_seal = 100; }
  if (cleared >= MAZE_FLOORS) { r.bells += 150; r.tickets += 2; r.items.fishbone_medium = 2; r.items.guild_token = 60; }
  return r;
}
/** 打完当前层。win：全队未灭 → 记录血量，进入选加成（首领层赢了则通关结算）。lose → 本局结束。 */
export function finishFloor(s: PlayerState, win: boolean, survivors: Record<string, { hpPct: number; energy: number }> | null, now = Date.now()): { done: boolean; victory: boolean; cleared: number; reward?: MazeReward } {
  const m = ensureMaze(s, now), run = m.active;
  if (!run) return { done: true, victory: false, cleared: 0 };
  const cleared = win ? run.floor : run.floor - 1;
  if (win && run.floor < MAZE_FLOORS) {
    if (survivors) run.carry = survivors;
    run.pending = 'choose';
    return { done: false, victory: false, cleared };
  }
  return settle(s, m, cleared, win);
}
function settle(s: PlayerState, m: MazeState, cleared: number, victory: boolean) {
  const reward = mazeRewardFor(cleared);
  s.res.fish += reward.fish; s.res.catnip += reward.catnip; s.res.bells += reward.bells; s.res.tickets += reward.tickets;
  for (const [id, n] of Object.entries(reward.items)) addItem(s, id, n);
  m.best = Math.max(m.best, cleared); m.active = null;
  return { done: true as const, victory, cleared, reward };
}
/** 当前已经通过的层数：选加成阶段说明本层刚打赢 */
export const clearedFloors = (run: MazeRun) => (run.pending === 'choose' ? run.floor : run.floor - 1);
export function abandonRun(s: PlayerState, now = Date.now()): MazeReward | null {
  const m = ensureMaze(s, now), run = m.active;
  if (!run) return null;
  return settle(s, m, clearedFloors(run), false).reward;
}
