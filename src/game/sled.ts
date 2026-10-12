// 雪橇滑坡的规则（纯逻辑，可测试）：喵雪岭西北大雪坡的小游戏。
// 猫猫坐雪橇从坡上冲下来，三条雪道左右换道：躲开雪松和石头（撞上 −1 颗心，减速一会儿），接小鱼干 +1、金铃铛 +3，
// 穿过小旗门 +2。越滑越快，滑满 DURATION 秒或三颗心都没了就结束；剩下的心每颗再加 3 分。
import { farmStage, ensureExplore, totals } from './explore';
import { winReward } from './stage';
import type { Gain } from './stage';
import type { PlayerState } from './state';

export const RUNS_PER_DAY = 5;
export const DURATION = 30;
export const LANES = 3;
export const HEARTS = 3;
export const STUN = 0.8;
export const HEART_BONUS = 3;
export type Kind = 'tree' | 'rock' | 'fish' | 'bell' | 'gate';
export const SCORE: Record<Kind, number> = { tree: 0, rock: 0, fish: 1, bell: 3, gate: 2 };
export const isHazard = (k: Kind) => k === 'tree' || k === 'rock';
/** 第 t 秒的速度（雪道单位 / 秒） */
export const speedAt = (t: number) => 7 + t * 0.25;

export interface Item { lane: number; kind: Kind }
export interface Row { id: number; d: number; items: Item[] }

/** 整条雪道：每隔 8~12 个单位一排（越往后越密一点）；每排最多两个障碍，至少留一条空道，空道上常常放小鱼干 */
export function makeCourse(rnd: () => number): Row[] {
  const rows: Row[] = [];
  const total = 7 * DURATION + 0.125 * DURATION * DURATION + 20;
  for (let d = 16; d < total; d += 8 + rnd() * 4 - (d / total) * 1.5) {
    const k = d / total, items: Item[] = [];
    if (rnd() < 0.12) { items.push({ lane: Math.floor(rnd() * LANES), kind: 'gate' }); rows.push({ id: rows.length, d: +d.toFixed(2), items }); continue; }
    const nHaz = rnd() < 0.35 + k * 0.4 ? 2 : 1;
    const lanes = [0, 1, 2].sort(() => rnd() - 0.5);
    for (let i = 0; i < nHaz; i++) items.push({ lane: lanes[i], kind: rnd() < 0.55 ? 'tree' : 'rock' });
    const free = lanes.slice(nHaz);
    if (rnd() < 0.7) items.push({ lane: free[0], kind: rnd() < 0.12 ? 'bell' : 'fish' });
    rows.push({ id: rows.length, d: +d.toFixed(2), items });
  }
  return rows;
}

export interface Game { course: Row[]; t: number; pos: number; lane: number; hearts: number; stun: number; score: number; fish: number; done: number; crashes: number }
export const newGame = (course: Row[]): Game => ({ course, t: 0, pos: 0, lane: 1, hearts: HEARTS, stun: 0, score: 0, fish: 0, done: 0, crashes: 0 });
export const isOver = (g: Game) => g.t >= DURATION || g.hearts <= 0;
/** 换道：dir = −1 左 / +1 右 */
export function steer(g: Game, dir: number) { if (!isOver(g)) g.lane = Math.max(0, Math.min(LANES - 1, g.lane + Math.sign(dir))); }

/** 推进 dt 秒，返回这一步经过的排里，雪橇所在道上碰到的东西 */
export function step(g: Game, dt: number): { row: Row; hit: Item | null }[] {
  if (isOver(g)) return [];
  g.t = Math.min(DURATION, g.t + dt);
  g.pos += speedAt(g.t) * (g.stun > 0 ? 0.5 : 1) * dt;
  g.stun = Math.max(0, g.stun - dt);
  const out: { row: Row; hit: Item | null }[] = [];
  while (g.done < g.course.length && g.course[g.done].d <= g.pos) {
    const row = g.course[g.done++];
    const hit = row.items.find((it) => it.lane === g.lane) ?? null;
    if (hit) {
      if (isHazard(hit.kind)) { g.hearts--; g.crashes++; g.stun = STUN; }
      else { g.score += SCORE[hit.kind]; if (hit.kind !== 'gate') g.fish += hit.kind === 'bell' ? 3 : 1; }
    }
    out.push({ row, hit });
    if (g.hearts <= 0) break;
  }
  return out;
}
/** 结算分：一路攒的分 + 滑到底时剩下的心 × HEART_BONUS */
export const finalScore = (g: Game) => g.score + (g.t >= DURATION ? g.hearts * HEART_BONUS : 0);

export const TIERS = [10, 28, 38];
export const tierOf = (score: number) => TIERS.filter((x) => score >= x).length;

const MUL = [0, 1.5, 3.5, 7];
export function sledGain(s: PlayerState, tier: number): Gain {
  const base = winReward(farmStage(s).stage);
  return { fish: Math.round(base.fish * MUL[tier]), exp: 0, catnip: tier === 3 ? 3 : tier === 2 ? 1 : 0, bells: tier === 3 ? 8 : 0 };
}
export const runsLeft = (s: PlayerState, now = Date.now()) => Math.max(0, RUNS_PER_DAY - (ensureExplore(s, now).sledRuns ?? 0));
export function useRun(s: PlayerState, now = Date.now()): boolean {
  const e = ensureExplore(s, now);
  if ((e.sledRuns ?? 0) >= RUNS_PER_DAY) return false;
  e.sledRuns = (e.sledRuns ?? 0) + 1;
  return true;
}
/** 滑行距离（取整）累计进足迹 */
export function recordSled(s: PlayerState, dist: number) { const t = totals(s); t.sled = (t.sled ?? 0) + Math.round(dist); }
