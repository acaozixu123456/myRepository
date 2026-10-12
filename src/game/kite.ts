// 云海放纸鸢的规则（纯逻辑，可测试）：云端雾岛东边风车旁的小游戏。
// 一只猫猫纸鸢在云海上飞，按住收线纸鸢往上升，松手就往下飘；从右边飘来的小鱼干 +1、金铃铛 +3，乌云要躲（−3，纸鸢淋湿变沉一会儿）。
// 限时 DURATION 秒，按分数拿 1~3 档奖励；每天最多 RUNS_PER_DAY 局。
import { farmStage, ensureExplore, totals } from './explore';
import { winReward } from './stage';
import type { Gain } from './stage';
import type { PlayerState } from './state';

export const RUNS_PER_DAY = 5;
export const DURATION = 25;
export const LIFT = 4.2; // 按住时向上的加速度（高度 0~1 / 秒²）
export const DROP = 2.6; // 松手时向下的加速度
export const VMAX = 1.1; // 最大升降速度
export const WET_TIME = 1.4; // 碰到乌云后变沉的秒数
export const KITE_X = 0.22; // 纸鸢在画面里的横向位置（0 = 左边，1 = 右边）
export const SPEED = 0.42; // 东西从右往左飘的速度（画面宽 / 秒）
export const HIT_R = 0.1; // 高度差在这个以内算碰到
export type Kind = 'fish' | 'bell' | 'storm';
export const SCORE: Record<Kind, number> = { fish: 1, bell: 3, storm: -3 };
export const NAME: Record<Kind, string> = { fish: '小鱼干', bell: '金铃铛', storm: '乌云' };

/** t：飘到纸鸢那一列的时刻；y：高度（0 = 云海面，1 = 顶） */
export interface Item { id: number; t: number; y: number; kind: Kind }

/** 一局的出场表：越往后越密；高度连着变化，不会上一个在最顶、下一个瞬间在最底 */
export function makeSchedule(rnd: () => number): Item[] {
  const out: Item[] = [];
  let t = 1.4, y = 0.5;
  while (t < DURATION - 0.3) {
    const r = rnd(), k = t / DURATION;
    const kind: Kind = r < 0.12 ? 'bell' : r < 0.12 + 0.16 + k * 0.1 ? 'storm' : 'fish';
    y = Math.max(0.1, Math.min(0.9, y + (rnd() - 0.5) * 0.7));
    out.push({ id: out.length, t: +t.toFixed(3), y: +y.toFixed(3), kind });
    t += 0.62 - k * 0.2 + rnd() * 0.25;
  }
  return out;
}

/** now 秒时东西在画面里的横向位置（1 = 刚从右边出现）；还没出现或已飘出左边返回 null */
export function xOf(it: Item, now: number): number | null {
  const x = KITE_X + (it.t - now) * SPEED;
  return x > 1.05 || x < -0.05 ? null : x;
}

export interface Game { plan: Item[]; t: number; y: number; vy: number; wet: number; score: number; got: number; done: Set<number> }
export const newGame = (plan: Item[]): Game => ({ plan, t: 0, y: 0.5, vy: 0, wet: 0, score: 0, got: 0, done: new Set() });

/** 推进 dt 秒：hold = 是否按住收线。返回这一步结算的东西（碰到的 / 错过的） */
export function step(g: Game, hold: boolean, dt: number): { it: Item; hit: boolean }[] {
  const prev = g.t;
  g.t += dt;
  const lift = hold ? LIFT * (g.wet > 0 ? 0.55 : 1) : 0;
  g.vy = Math.max(-VMAX, Math.min(VMAX, g.vy + (lift - DROP) * dt));
  g.y += g.vy * dt;
  if (g.y <= 0) { g.y = 0; g.vy = Math.max(0, g.vy); }
  if (g.y >= 1) { g.y = 1; g.vy = Math.min(0, g.vy); }
  g.wet = Math.max(0, g.wet - dt);
  const out: { it: Item; hit: boolean }[] = [];
  for (const it of g.plan) {
    if (g.done.has(it.id) || it.t <= prev || it.t > g.t) continue;
    g.done.add(it.id);
    const hit = Math.abs(it.y - g.y) <= HIT_R;
    if (hit) {
      g.score = Math.max(0, g.score + SCORE[it.kind]);
      if (it.kind === 'storm') g.wet = WET_TIME; else g.got++;
    }
    out.push({ it, hit });
  }
  return out;
}
export const isOver = (g: Game) => g.t >= DURATION;

export const TIERS = [10, 24, 34]; // 分数达到这些依次拿 1 / 2 / 3 档
export const tierOf = (score: number) => TIERS.filter((x) => score >= x).length;

const MUL = [0, 1.5, 3.5, 7];
export function kiteGain(s: PlayerState, tier: number): Gain {
  const base = winReward(farmStage(s).stage);
  return { fish: Math.round(base.fish * MUL[tier]), exp: 0, catnip: tier === 3 ? 3 : tier === 2 ? 1 : 0, bells: tier === 3 ? 8 : 0 };
}

export const runsLeft = (s: PlayerState, now = Date.now()) => Math.max(0, RUNS_PER_DAY - (ensureExplore(s, now).kiteRuns ?? 0));
export function useRun(s: PlayerState, now = Date.now()): boolean {
  const e = ensureExplore(s, now);
  if ((e.kiteRuns ?? 0) >= RUNS_PER_DAY) return false;
  e.kiteRuns = (e.kiteRuns ?? 0) + 1;
  return true;
}
/** 收到的东西累计进足迹 */
export function recordKite(s: PlayerState, n: number) { const t = totals(s); t.kite = (t.kite ?? 0) + n; }
