// 叠雪猫的规则（纯逻辑，可测试）：喵雪岭东边雪地的小游戏。
// 顶上一个雪球左右摆，点一下落下去叠在下面那个上；偏得太多会滚下去（−1 次机会），几乎正中算「完美」并自动对正。
// 叠歪了也会倒：整座雪猫的重心偏出底座太远就塌了。一层比一层小、摆得越来越快；叠满 LAYERS 层就给它装上猫头。
import { farmStage, ensureExplore, totals } from './explore';
import { winReward } from './stage';
import type { Gain } from './stage';
import type { PlayerState } from './state';

export const RUNS_PER_DAY = 5;
export const LAYERS = 12;
export const MISSES = 3;
export const AMP = 0.85;
export const PERFECT = 0.05;
export const TOPPLE = 0.32;
/** 第 i 层（0 = 底座）的半径（画面宽 = 2） */
export const radiusOf = (i: number) => Math.max(0.13, 0.3 - i * 0.015);
/** 第 i 层摆动的角速度 */
export const omegaOf = (i: number) => 2.0 + i * 0.22;

export interface Tower { xs: number[]; misses: number; perfect: number; score: number; over: boolean; toppled: boolean; phase: number }
export const newTower = (): Tower => ({ xs: [0], misses: 0, perfect: 0, score: 0, over: false, toppled: false, phase: 0 });
/** 正在摆的这一层的序号 */
export const level = (tw: Tower) => tw.xs.length;
/** 摆了 t 秒时雪球的横向位置 */
export const swingX = (tw: Tower, t: number) => AMP * Math.sin(omegaOf(level(tw)) * t + tw.phase);
/** 底座以上所有雪球的平均横向位置相对底座的偏移 */
export const lean = (tw: Tower) => tw.xs.length <= 1 ? 0 : tw.xs.slice(1).reduce((a, x) => a + x, 0) / (tw.xs.length - 1) - tw.xs[0];

export type DropResult = 'perfect' | 'ok' | 'miss' | 'topple' | 'done';
/** 摆到 t 秒时点了「落下」；nextPhase 是下一层开始摆的相位 */
export function drop(tw: Tower, t: number, nextPhase = 0): DropResult {
  if (tw.over) return 'miss';
  const i = level(tw), x = swingX(tw, t), top = tw.xs[i - 1], off = x - top;
  tw.phase = nextPhase;
  if (Math.abs(off) > radiusOf(i - 1) * 0.8) {
    tw.misses++;
    if (tw.misses >= MISSES) tw.over = true;
    return 'miss';
  }
  const perfect = Math.abs(off) <= PERFECT;
  tw.xs.push(perfect ? top : x);
  tw.score += 2 + (perfect ? 2 : 0); if (perfect) tw.perfect++;
  if (Math.abs(lean(tw)) > TOPPLE) { tw.over = true; tw.toppled = true; tw.score = Math.max(0, tw.score - 4); return 'topple'; }
  if (tw.xs.length > LAYERS) { tw.over = true; tw.score += 6; return 'done'; }
  return perfect ? 'perfect' : 'ok';
}

export const TIERS = [14, 30, 44];
export const tierOf = (score: number) => TIERS.filter((x) => score >= x).length;

const MUL = [0, 1.5, 3.5, 7];
export function snowcatGain(s: PlayerState, tier: number): Gain {
  const base = winReward(farmStage(s).stage);
  return { fish: Math.round(base.fish * MUL[tier]), exp: 0, catnip: tier === 3 ? 3 : tier === 2 ? 1 : 0, bells: tier === 3 ? 8 : 0 };
}
export const runsLeft = (s: PlayerState, now = Date.now()) => Math.max(0, RUNS_PER_DAY - (ensureExplore(s, now).snowcatRuns ?? 0));
export function useRun(s: PlayerState, now = Date.now()): boolean {
  const e = ensureExplore(s, now);
  if ((e.snowcatRuns ?? 0) >= RUNS_PER_DAY) return false;
  e.snowcatRuns = (e.snowcatRuns ?? 0) + 1;
  return true;
}
/** 叠上去的层数累计进足迹 */
export function recordLayers(s: PlayerState, n: number) { const t = totals(s); t.snowcat = (t.snowcat ?? 0) + n; }
