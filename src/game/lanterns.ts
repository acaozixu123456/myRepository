// 点灯小游戏的规则（纯逻辑，可测试）：3×3 九盏宫灯，点一盏会翻转它和上下左右相邻的灯，目标是全部点亮。
// 题目 = 从「全亮」出发随机点几盏灯得到，所以一定有解；最少步数用 512 种点法穷举得出。奖励以当前最高关挂机奖励为基数。
import { farmStage, ensureExplore, totals } from './explore';
import { winReward } from './stage';
import type { Gain } from './stage';
import type { PlayerState } from './state';

export const N = 3, CELLS = 9, ALL = (1 << CELLS) - 1;
export const RUNS_PER_DAY = 6;
export const PUZZLES = 3; // 一局三道题，一道比一道难

/** 点第 i 盏：翻转它和上下左右（位掩码，第 i 位 = 第 i 盏是否亮） */
const MASK = Array.from({ length: CELLS }, (_, i) => {
  const r = Math.floor(i / N), c = i % N;
  let m = 1 << i;
  if (r > 0) m |= 1 << (i - N); if (r < N - 1) m |= 1 << (i + N);
  if (c > 0) m |= 1 << (i - 1); if (c < N - 1) m |= 1 << (i + 1);
  return m;
});
export const tap = (state: number, i: number) => state ^ MASK[i];
export const solved = (state: number) => state === ALL;
export const lit = (state: number, i: number) => ((state >> i) & 1) === 1;

/** 最少需要点几盏：点两次等于没点，且点的顺序无关，所以只需枚举「点哪些灯」的 512 种组合 */
export function minMoves(state: number): number {
  let best = Infinity;
  for (let sub = 0; sub < 1 << CELLS; sub++) {
    let s = state, n = 0;
    for (let i = 0; i < CELLS; i++) if ((sub >> i) & 1) { s = tap(s, i); n++; }
    if (s === ALL && n < best) best = n;
  }
  return best;
}

export interface Puzzle { start: number; par: number }
/** 第 level 道（1~3）：随机点 level+1 盏不同的灯得到题面，最少步数至少 2（不出一步就解的题） */
export function makePuzzle(level: number, rnd: () => number): Puzzle {
  for (let tries = 0; tries < 200; tries++) {
    const cells = Array.from({ length: CELLS }, (_, i) => i);
    let s = ALL;
    for (let k = 0; k < level + 1; k++) s = tap(s, cells.splice(Math.floor(rnd() * cells.length), 1)[0]);
    const par = minMoves(s);
    if (par >= 2 && par <= level + 2) return { start: s, par };
  }
  return { start: tap(tap(ALL, 0), 8), par: 2 }; // 兜底：一定是 2 步的题
}

/** 一局的星级：三道都解开才有星；总共多点的步数 0 → 3 星，≤3 → 2 星，其余 1 星 */
export function stars(solvedAll: boolean, extraMoves: number): number {
  if (!solvedAll) return 0;
  return extraMoves <= 0 ? 3 : extraMoves <= 3 ? 2 : 1;
}

const MUL = [0, 1.5, 3.5, 7];
export function lanternGain(s: PlayerState, st: number): Gain {
  const base = winReward(farmStage(s).stage);
  return { fish: Math.round(base.fish * MUL[st]), exp: 0, catnip: st === 3 ? 3 : st === 2 ? 1 : 0, bells: st === 3 ? 8 : 0 };
}

export const runsLeft = (s: PlayerState, now = Date.now()) => Math.max(0, RUNS_PER_DAY - (ensureExplore(s, now).lanternRuns ?? 0));
export function useRun(s: PlayerState, now = Date.now()): boolean {
  const e = ensureExplore(s, now);
  if ((e.lanternRuns ?? 0) >= RUNS_PER_DAY) return false;
  e.lanternRuns = (e.lanternRuns ?? 0) + 1;
  return true;
}
/** 点亮过的题数累计进足迹 */
export function recordSolved(s: PlayerState, n = 1) { if (n > 0) { const t = totals(s); t.lantern = (t.lantern ?? 0) + n; } }
