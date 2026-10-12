// 采蘑菇小游戏的规则（纯逻辑，可测试）：3×3 的蘑菇地，蘑菇一个个冒出来又缩回去——点普通和金色的，别碰紫色毒蘑菇。
// 奖励以当前最高关挂机奖励为基数；每天最多 RUNS_PER_DAY 局。
import { farmStage, ensureExplore, totals } from './explore';
import { winReward } from './stage';
import type { Gain } from './stage';
import type { PlayerState } from './state';

export const RUNS_PER_DAY = 6;
export const DURATION = 25; // 一局秒数
export const CELLS = 9;
export type Kind = 'normal' | 'gold' | 'poison';
export const SCORE: Record<Kind, number> = { normal: 1, gold: 3, poison: -3 };
export const LIFE: Record<Kind, number> = { normal: 1.4, gold: 1.0, poison: 1.4 }; // 蘑菇停留秒数
export const NAME: Record<Kind, string> = { normal: '香菇', gold: '金蘑菇', poison: '毒蘑菇' };

export interface Spawn { t: number; cell: number; kind: Kind; life: number }

/** 一局的出场表：按时间排好，同一格在上一个蘑菇还没缩回去前不会再冒新的 */
export function makeSchedule(rnd: () => number): Spawn[] {
  const out: Spawn[] = [];
  const freeAt = new Array<number>(CELLS).fill(0);
  let t = 0.6;
  while (t < DURATION - 0.8) {
    const free = freeAt.map((f, i) => (f <= t ? i : -1)).filter((i) => i >= 0);
    if (free.length) {
      const cell = free[Math.floor(rnd() * free.length)];
      const r = rnd();
      const kind: Kind = r < 0.16 ? 'gold' : r < 0.38 ? 'poison' : 'normal';
      out.push({ t: +t.toFixed(3), cell, kind, life: LIFE[kind] });
      freeAt[cell] = t + LIFE[kind] + 0.15;
    }
    t += 0.5 + rnd() * 0.3;
  }
  return out;
}

export const TIERS = [10, 20, 30]; // 达到这些分数依次拿 1 / 2 / 3 档
export const tierOf = (score: number) => TIERS.filter((x) => score >= x).length;

const MUL = [0, 1.5, 3.5, 7];
export function mushroomGain(s: PlayerState, tier: number): Gain {
  const base = winReward(farmStage(s).stage);
  return { fish: Math.round(base.fish * MUL[tier]), exp: 0, catnip: tier === 3 ? 3 : tier === 2 ? 1 : 0, bells: tier === 3 ? 8 : 0 };
}

export const runsLeft = (s: PlayerState, now = Date.now()) => Math.max(0, RUNS_PER_DAY - (ensureExplore(s, now).mushRuns ?? 0));
export function useRun(s: PlayerState, now = Date.now()): boolean {
  const e = ensureExplore(s, now);
  if ((e.mushRuns ?? 0) >= RUNS_PER_DAY) return false;
  e.mushRuns = (e.mushRuns ?? 0) + 1;
  return true;
}
/** 采到的蘑菇数（毒蘑菇不算）累计进足迹 */
export function recordPicked(s: PlayerState, n: number) { if (n > 0) { const t = totals(s); t.mush = (t.mush ?? 0) + n; } }
