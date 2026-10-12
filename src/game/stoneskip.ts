// 打水漂的规则（纯逻辑，可测试）：樱汤乡锦鲤池南岸的小游戏。
// 一局扔 THROWS 块石片，每块分两步定：先看摆动的角度指针点一下定角度，再看来回走的力度条点一下定力度。
// 角度越接近 IDEAL 越好，太陡（> SINK_ANGLE）直接「扑通」沉底；力度越大漂得越远。漂满 MAX_SKIPS 下就飞过池塘落到对岸，额外加分。
import { farmStage, ensureExplore, totals } from './explore';
import { winReward } from './stage';
import type { Gain } from './stage';
import type { PlayerState } from './state';

export const RUNS_PER_DAY = 5;
export const THROWS = 5;
export const ANGLE_MAX = 45;
export const IDEAL = 18;
export const SPREAD = 18;
export const SINK_ANGLE = 38;
export const MAX_SKIPS = 12;
export const ACROSS_BONUS = 5;
/** 角度指针来回一趟（0 → 45 → 0）的秒数，力度条来回一趟的秒数 */
export const ANGLE_PERIOD = 1.6;
export const POWER_PERIOD = 1.2;

/** 三角波：0 → 1 → 0，周期 period */
export const tri = (t: number, period: number) => { const u = ((t / period) % 1 + 1) % 1; return u < 0.5 ? u * 2 : 2 - u * 2; };
export const angleAt = (t: number) => tri(t, ANGLE_PERIOD) * ANGLE_MAX;
export const powerAt = (t: number) => tri(t, POWER_PERIOD);
export const angleQ = (a: number) => Math.max(0, Math.min(1, 1 - Math.abs(a - IDEAL) / SPREAD));

export interface Throw { angle: number; power: number; skips: number; across: boolean; sank: boolean; score: number }
export function throwStone(angle: number, power: number): Throw {
  const p = Math.max(0, Math.min(1, power));
  const sank = angle > SINK_ANGLE || angle < 2;
  const skips = sank ? 0 : Math.min(MAX_SKIPS, Math.round(MAX_SKIPS * p * angleQ(angle) ** 0.8));
  const across = skips >= MAX_SKIPS;
  return { angle, power: p, skips, across, sank, score: skips + (across ? ACROSS_BONUS : 0) };
}
export const totalScore = (ts: Throw[]) => ts.reduce((a, t) => a + t.score, 0);

export const TIERS = [18, 34, 48];
export const tierOf = (score: number) => TIERS.filter((x) => score >= x).length;

const MUL = [0, 1.5, 3.5, 7];
export function skipGain(s: PlayerState, tier: number): Gain {
  const base = winReward(farmStage(s).stage);
  return { fish: Math.round(base.fish * MUL[tier]), exp: 0, catnip: tier === 3 ? 3 : tier === 2 ? 1 : 0, bells: tier === 3 ? 8 : 0 };
}
export const runsLeft = (s: PlayerState, now = Date.now()) => Math.max(0, RUNS_PER_DAY - (ensureExplore(s, now).skipRuns ?? 0));
export function useRun(s: PlayerState, now = Date.now()): boolean {
  const e = ensureExplore(s, now);
  if ((e.skipRuns ?? 0) >= RUNS_PER_DAY) return false;
  e.skipRuns = (e.skipRuns ?? 0) + 1;
  return true;
}
/** 漂了多少下累计进足迹 */
export function recordSkips(s: PlayerState, n: number) { const t = totals(s); t.skips = (t.skips ?? 0) + n; }
