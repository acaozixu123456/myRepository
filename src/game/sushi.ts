// 回转寿司的规则（纯逻辑，可测试）：樱汤乡汤屋旁的寿司小铺。
// 传送带从右往左转，盘子上是六样寿司；柜台前坐着 SEATS 位猫客，每位头顶一个想吃的寿司和一条耐心条。
// 盘子转到哪位客人面前（左右 REACH 以内），点它就端给这位客人：正是 TA 想吃的就上菜（越快端到越多分），不是就是拿错了，扣分。
// 耐心耗完客人会气鼓鼓走掉，换下一位。时间到结束。位置都用 0~1 的归一化坐标（x = 1 在右边入口，x < 0 出了画面）。
import { farmStage, ensureExplore, totals } from './explore';
import { winReward } from './stage';
import type { Gain } from './stage';
import type { PlayerState } from './state';

export const RUNS_PER_DAY = 5;
export const DURATION = 45;
export const SEATS = 3;
/** 三个座位在传送带上的位置，和能够到的范围 */
export const SEAT_X = [0.8, 0.5, 0.2];
export const REACH = 0.11;
export const DISHES = ['salmon', 'shrimp', 'onigiri', 'naruto', 'tamago', 'tuna'] as const;
export type Dish = (typeof DISHES)[number];
export const DISH_EMOJI: Record<Dish, string> = { salmon: '🍣', shrimp: '🍤', onigiri: '🍙', naruto: '🍥', tamago: '🍳', tuna: '🐟' };
export const DISH_NAME: Record<Dish, string> = { salmon: '三文鱼', shrimp: '炸虾', onigiri: '饭团', naruto: '鱼板', tamago: '玉子烧', tuna: '金枪鱼' };
/** 新盘子的间隔（秒）；有 WANTED_P 的概率放某位客人正想要的 */
export const SPAWN_GAP = 0.85;
export const WANTED_P = 0.5;
export const PLATE_GAP = 0.14;
/** 传送带速度（每秒走多少屏宽）随时间加快 */
export const speedAt = (t: number) => 0.15 + t * 0.0018;
/** 客人的耐心（秒）随时间变短 */
export const patienceAt = (t: number) => Math.max(5.5, 9.5 - t * 0.08);
/** 端到时剩余耐心比例 ≥ FAST 算「上菜真快」，多加 1 分 */
export const FAST = 0.6;
export const SERVE_PTS = 2;
export const WRONG_PTS = 2;
/** 走掉的客人空座位多久再坐人 */
export const REFILL = 0.7;

export interface Plate { id: number; dish: Dish; x: number }
export interface Guest { dish: Dish | null; left: number; max: number; wait: number }
export interface Belt { t: number; plates: Plate[]; guests: Guest[]; next: number; seq: number; score: number; served: number; fast: number; angry: number; wrong: number; over: boolean }

const pick = <T>(arr: readonly T[], rnd: () => number) => arr[Math.floor(rnd() * arr.length) % arr.length];
function seat(b: Belt, g: Guest, rnd: () => number) { g.dish = pick(DISHES, rnd); g.max = patienceAt(b.t); g.left = g.max; g.wait = 0; }

export function newBelt(rnd: () => number): Belt {
  const b: Belt = { t: 0, plates: [], guests: [], next: 0, seq: 0, score: 0, served: 0, fast: 0, angry: 0, wrong: 0, over: false };
  for (let i = 0; i < SEATS; i++) { const g: Guest = { dish: null, left: 0, max: 1, wait: 0 }; seat(b, g, rnd); g.left = g.max = g.max + i * 1.5; b.guests.push(g); }
  // 开局传送带上就摆了一些盘子
  for (let x = 0.15; x < 1; x += 0.2) b.plates.push({ id: b.seq++, dish: pick(DISHES, rnd), x });
  return b;
}

/** 推进 dt 秒；返回这一步气走的客人数 */
export function step(b: Belt, dt: number, rnd: () => number): number {
  if (b.over) return 0;
  b.t += dt;
  const v = speedAt(b.t);
  for (const p of b.plates) p.x -= v * dt;
  b.plates = b.plates.filter((p) => p.x > -0.12);
  b.next -= dt;
  const last = b.plates.reduce((m, p) => Math.max(m, p.x), -1);
  if (b.next <= 0 && last < 1.1 - PLATE_GAP) {
    b.next = SPAWN_GAP;
    const want = b.guests.filter((g) => g.dish).map((g) => g.dish as Dish);
    const dish = want.length && rnd() < WANTED_P ? pick(want, rnd) : pick(DISHES, rnd);
    b.plates.push({ id: b.seq++, dish, x: 1.1 });
  }
  let angry = 0;
  for (const g of b.guests) {
    if (g.dish) { g.left -= dt; if (g.left <= 0) { g.dish = null; g.wait = REFILL; b.angry++; angry++; } }
    else { g.wait -= dt; if (g.wait <= 0) seat(b, g, rnd); }
  }
  if (b.t >= DURATION) b.over = true;
  return angry;
}

export type TapResult = { kind: 'serve'; seat: number; fast: boolean } | { kind: 'wrong' } | { kind: 'none' };
/** 点了某个盘子：只有在画面里（0 ≤ x ≤ 1）的能点 */
export function tapPlate(b: Belt, id: number, rnd: () => number): TapResult {
  if (b.over) return { kind: 'none' };
  const i = b.plates.findIndex((p) => p.id === id);
  if (i < 0 || b.plates[i].x < -0.02 || b.plates[i].x > 1.02) return { kind: 'none' };
  const p = b.plates[i];
  // 盘子面前的客人（离得最近的那位）
  let best = -1;
  SEAT_X.forEach((sx, k) => { if (Math.abs(p.x - sx) <= REACH && (best < 0 || Math.abs(p.x - sx) < Math.abs(p.x - SEAT_X[best]))) best = k; });
  const g = best >= 0 ? b.guests[best] : null;
  if (!g || g.dish !== p.dish) { b.plates.splice(i, 1); b.wrong++; b.score = Math.max(0, b.score - WRONG_PTS); return { kind: 'wrong' }; }
  b.plates.splice(i, 1);
  const fast = g.left / g.max >= FAST;
  b.served++; if (fast) b.fast++;
  b.score += SERVE_PTS + (fast ? 1 : 0);
  g.dish = null; g.wait = REFILL * 0.5; void rnd;
  return { kind: 'serve', seat: best, fast };
}

export const TIERS = [24, 44, 62];
export const tierOf = (score: number) => TIERS.filter((x) => score >= x).length;

const MUL = [0, 1.5, 3.5, 7];
export function sushiGain(s: PlayerState, tier: number): Gain {
  const base = winReward(farmStage(s).stage);
  return { fish: Math.round(base.fish * MUL[tier]), exp: 0, catnip: tier === 3 ? 3 : tier === 2 ? 1 : 0, bells: tier === 3 ? 8 : 0 };
}
export const runsLeft = (s: PlayerState, now = Date.now()) => Math.max(0, RUNS_PER_DAY - (ensureExplore(s, now).sushiRuns ?? 0));
export function useRun(s: PlayerState, now = Date.now()): boolean {
  const e = ensureExplore(s, now);
  if ((e.sushiRuns ?? 0) >= RUNS_PER_DAY) return false;
  e.sushiRuns = (e.sushiRuns ?? 0) + 1;
  return true;
}
/** 端出去的寿司累计进足迹 */
export function recordSushi(s: PlayerState, n: number) { const t = totals(s); t.sushi = (t.sushi ?? 0) + n; }
