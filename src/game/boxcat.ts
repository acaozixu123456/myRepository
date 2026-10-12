// 纸箱寻猫小游戏的规则（纯逻辑，可测试）：猫躲进一个纸箱 → 箱子互换位置越来越快 → 猜猫在哪个箱子。
// 连续猜对越多奖励越高；每猜对一轮可以「收手领奖」或「继续」，猜错只能拿走一半。奖励以当前最高关挂机奖励为基数。
import { farmStage, ensureExplore, totals } from './explore';
import { winReward } from './stage';
import type { Gain } from './stage';
import type { PlayerState } from './state';

export const BOX_GAMES_PER_DAY = 6;
export const MAX_ROUND = 5;

export interface Round { round: number; boxes: number; cat: number; swaps: [number, number][]; stepMs: number }

/** 第 round 轮（从 1 起）：箱子数 3→4→5，交换次数和速度越来越难 */
export function makeRound(round: number, rnd: () => number): Round {
  const boxes = round <= 2 ? 3 : round <= 4 ? 4 : 5;
  const n = 3 + round * 2;
  const swaps: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.floor(rnd() * boxes);
    let b = Math.floor(rnd() * (boxes - 1));
    if (b >= a) b++;
    swaps.push([a, b]);
  }
  return { round, boxes, cat: Math.floor(rnd() * boxes), swaps, stepMs: Math.max(260, 560 - round * 60) };
}

/** 箱子互换后，原来在 slot 的东西跑到了哪个 slot（UI 用它摆位置，测试用它核对） */
export function slotAfter(start: number, swaps: readonly [number, number][]): number {
  let p = start;
  for (const [a, b] of swaps) { if (p === a) p = b; else if (p === b) p = a; }
  return p;
}

const MUL = [0, 1.2, 2.5, 5, 9, 16];
/** 连续猜对 streak 轮拿到的奖励；3 轮起带猫薄荷，5 轮带金铃铛 */
export function rewardFor(s: PlayerState, streak: number): Gain {
  const k = Math.max(0, Math.min(MAX_ROUND, streak));
  const base = winReward(farmStage(s).stage);
  return { fish: Math.round(base.fish * MUL[k]), exp: 0, catnip: k >= 3 ? k - 1 : 0, bells: k >= 5 ? 12 : 0 };
}
/** 猜错：只能拿走已赢下那档的一半 */
export function consolation(s: PlayerState, streak: number): Gain {
  const g = rewardFor(s, streak);
  return { fish: Math.floor(g.fish / 2), exp: 0, catnip: Math.floor(g.catnip / 2), bells: 0 };
}

export const gamesLeft = (s: PlayerState, now = Date.now()) => Math.max(0, BOX_GAMES_PER_DAY - (ensureExplore(s, now).boxGames ?? 0));
export function useGame(s: PlayerState, now = Date.now()): boolean {
  const e = ensureExplore(s, now);
  if ((e.boxGames ?? 0) >= BOX_GAMES_PER_DAY) return false;
  e.boxGames = (e.boxGames ?? 0) + 1;
  return true;
}
/** 每猜对一轮计一只「找到的猫」 */
export function recordFound(s: PlayerState, n = 1) { const t = totals(s); t.found = (t.found ?? 0) + n; }
