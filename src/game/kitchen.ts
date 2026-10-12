// 御膳房配菜的规则（纯逻辑，可测试）：九重宫阙东侧御膳房的小游戏。
// 小太监猫一张张递来菜单，每张要 3 样（20 秒后变 4 样）食材，玩家从 6 样里点齐就上菜；点错食材扣 1.5 秒。
// 上得快有赏：在 FAST_PER 秒 × 样数以内配齐加 2 分。限时 DURATION 秒，按分数拿 1~3 档奖励；每天最多 RUNS_PER_DAY 局。
import { farmStage, ensureExplore, totals } from './explore';
import { winReward } from './stage';
import type { Gain } from './stage';
import type { PlayerState } from './state';

export const RUNS_PER_DAY = 5;
export const DURATION = 40;
export const PENALTY = 1.5;
export const FAST_PER = 0.9;
export const BIG_AT = 20;
export const FOODS = ['fish', 'shrimp', 'rice', 'egg', 'dumpling', 'greens'] as const;
export type Food = (typeof FOODS)[number];
export const FOOD_EMOJI: Record<Food, string> = { fish: '🐟', shrimp: '🦐', rice: '🍚', egg: '🥚', dumpling: '🥟', greens: '🥬' };
export const FOOD_NAME: Record<Food, string> = { fish: '小鱼', shrimp: '虾仁', rice: '米饭', egg: '鸡蛋', dumpling: '饺子', greens: '青菜' };

export interface Order { need: Food[]; got: Food[]; at: number }
export interface Kitchen { rnd: () => number; order: Order; served: number; score: number; miss: number; penalty: number; fast: number }

function pick(rnd: () => number, n: number): Food[] {
  const pool = [...FOODS], out: Food[] = [];
  for (let i = 0; i < n; i++) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  return out;
}
const orderSize = (t: number) => (t >= BIG_AT ? 4 : 3);
export function newKitchen(rnd: () => number): Kitchen {
  return { rnd, order: { need: pick(rnd, 3), got: [], at: 0 }, served: 0, score: 0, miss: 0, penalty: 0, fast: 0 };
}
/** 已用掉的时间（算上点错的罚时） */
export const elapsed = (k: Kitchen, now: number) => now + k.penalty;
export const isOver = (k: Kitchen, now: number) => elapsed(k, now) >= DURATION;

export type TapResult = 'ok' | 'served' | 'fast' | 'wrong' | 'over';
/** now 秒时点了一样食材 */
export function tap(k: Kitchen, f: Food, now: number): TapResult {
  if (isOver(k, now)) return 'over';
  const o = k.order;
  if (!o.need.includes(f) || o.got.includes(f)) { k.miss++; k.penalty += PENALTY; return 'wrong'; }
  o.got.push(f);
  if (o.got.length < o.need.length) return 'ok';
  const fast = now - o.at <= FAST_PER * o.need.length;
  k.served++; k.score += o.need.length + (fast ? 2 : 0); if (fast) k.fast++;
  k.order = { need: pick(k.rnd, orderSize(elapsed(k, now))), got: [], at: now };
  return fast ? 'fast' : 'served';
}

export const TIERS = [30, 70, 110];
export const tierOf = (score: number) => TIERS.filter((x) => score >= x).length;

const MUL = [0, 1.5, 3.5, 7];
export function kitchenGain(s: PlayerState, tier: number): Gain {
  const base = winReward(farmStage(s).stage);
  return { fish: Math.round(base.fish * MUL[tier]), exp: 0, catnip: tier === 3 ? 3 : tier === 2 ? 1 : 0, bells: tier === 3 ? 8 : 0 };
}

export const runsLeft = (s: PlayerState, now = Date.now()) => Math.max(0, RUNS_PER_DAY - (ensureExplore(s, now).kitchenRuns ?? 0));
export function useRun(s: PlayerState, now = Date.now()): boolean {
  const e = ensureExplore(s, now);
  if ((e.kitchenRuns ?? 0) >= RUNS_PER_DAY) return false;
  e.kitchenRuns = (e.kitchenRuns ?? 0) + 1;
  return true;
}
/** 上的菜数累计进足迹 */
export function recordServed(s: PlayerState, n: number) { const t = totals(s); t.kitchen = (t.kitchen ?? 0) + n; }
