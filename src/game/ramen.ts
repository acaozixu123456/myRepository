// 拉面屋台小游戏的规则（纯逻辑，可测试）：客人点 3 样配料 → 按顺序加料（限时）→ 在绿区里起锅。
// 奖励和主线挂钩：以当前最高关的挂机奖励为基数；每天最多做 ORDERS_PER_DAY 碗。
import { farmStage, ensureExplore, totals } from './explore';
import { winReward } from './stage';
import type { Gain } from './stage';
import type { PlayerState } from './state';

export const ORDERS_PER_DAY = 12;
export const TOPPING_TIME = 8; // 加料限时（秒）
export const TOPPINGS = ['叉烧', '溏心蛋', '海苔', '葱花', '鱼板', '猫薄荷叶'] as const;
export type Topping = (typeof TOPPINGS)[number];

/** 客人：名字谐音 + 一句挑剔的话（语气保持轻松，不油腻） */
export const CUSTOMERS = [
  { name: '夏侯墩', line: '「墩」了一整天，来碗热的。' },
  { name: '吕布丁', line: '面要弹，汤要稠，像我一样。' },
  { name: '董桌', line: '别催，桌子都给你吃塌了就加钱。' },
  { name: '曹喵德', line: '宁可面凉，不可汤淡。' },
  { name: '司马喵懿', line: '……我等得起。（其实已经等了半小时）' },
  { name: '嫦喵', line: '月亮同款，要圆的蛋。' },
];

/** 随机一张单：3 种不同的配料，顺序有意义 */
export function makeOrder(rnd: () => number): Topping[] {
  const pool = [...TOPPINGS];
  const out: Topping[] = [];
  for (let i = 0; i < 3; i++) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  return out;
}

export interface ToppingResult { complete: boolean; mistakes: number }
/** 按点的顺序判定：点对下一样就前进，点错记一次失误；3 样都对才算做完 */
export function judgeToppings(order: readonly Topping[], taps: readonly Topping[]): ToppingResult {
  let i = 0, mistakes = 0;
  for (const t of taps) { if (i >= order.length) break; if (t === order[i]) i++; else mistakes++; }
  return { complete: i >= order.length, mistakes };
}

export type BoilGrade = 'perfect' | 'good' | 'miss';
export const BOIL_ZONE = { center: 0.5, half: 0.1 }; // 绿区占整条的 20%
/** pos：标记当前在条上的位置 0~1；落在绿区正中附近算完美 */
export function judgeBoil(pos: number): BoilGrade {
  const d = Math.abs(pos - BOIL_ZONE.center);
  if (d <= BOIL_ZONE.half * 0.4) return 'perfect';
  return d <= BOIL_ZONE.half ? 'good' : 'miss';
}
/** 标记来回摆动：period 秒一个来回，t 秒时的位置 0~1（三角波） */
export function markerPos(t: number, period = 1.6): number {
  const x = ((t / period) % 1 + 1) % 1;
  return x < 0.5 ? x * 2 : 2 - x * 2;
}

/** 星级 0~3：没做完 0 星；做完 1 星；零失误 +1；起锅完美 +1、起锅失手 −1（泡烂了，最多 1 星） */
export function stars(top: ToppingResult, boil: BoilGrade | null): number {
  if (!top.complete || boil === null) return 0;
  if (boil === 'miss') return 1;
  return Math.min(3, 1 + (top.mistakes === 0 ? 1 : 0) + (boil === 'perfect' ? 1 : 0));
}

const MUL = [0, 1.5, 3, 6];
export function ramenGain(s: PlayerState, st: number): Gain {
  const base = winReward(farmStage(s).stage);
  return { fish: Math.round(base.fish * MUL[st]), exp: 0, catnip: st === 3 ? 2 : 0, bells: st === 3 ? 5 : 0 };
}

export const ordersLeft = (s: PlayerState, now = Date.now()) => Math.max(0, ORDERS_PER_DAY - (ensureExplore(s, now).orders ?? 0));
export function useOrder(s: PlayerState, now = Date.now()): boolean {
  const e = ensureExplore(s, now);
  if ((e.orders ?? 0) >= ORDERS_PER_DAY) return false;
  e.orders = (e.orders ?? 0) + 1;
  return true;
}
/** 做完一碗：有星才计入累计 */
export function recordBowl(s: PlayerState, st: number) { if (st > 0) { const t = totals(s); t.ramen = (t.ramen ?? 0) + 1; } }
