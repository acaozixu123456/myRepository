// 冲浪的规则（纯逻辑，可测试）：椰风海湾西侧浪区的小游戏。
// 猫猫踩着冲浪板顺着浪走，每到浪尖（一个个「浪头」时刻）点一下就腾空耍个花样：越准分越高（完美 / 不错），
// 连着成功会叠连击倍率；浪头过去没点只是断连击，没有浪头时乱点会晃一下，晃三次就落水结束。大浪分高但时机更窄。
import { farmStage, ensureExplore, totals } from './explore';
import { winReward } from './stage';
import type { Gain } from './stage';
import type { PlayerState } from './state';

export const RUNS_PER_DAY = 5;
export const DURATION = 30;
export const WOBBLES = 3;
export const PERFECT = 0.07;
export type Kind = 'wave' | 'big';
export const WINDOW: Record<Kind, number> = { wave: 0.26, big: 0.18 };
export const BASE: Record<Kind, number> = { wave: 1, big: 2 };

export interface Lip { id: number; t: number; kind: Kind }
/** 一局的浪头表：间隔 1.0~1.7 秒，越往后越密，大浪约两成 */
export function makeSet(rnd: () => number): Lip[] {
  const out: Lip[] = [];
  for (let t = 1.6; t < DURATION - 0.4;) {
    out.push({ id: out.length, t: +t.toFixed(3), kind: rnd() < 0.2 ? 'big' : 'wave' });
    t += 1.15 + rnd() * 0.55 - (t / DURATION) * 0.35;
  }
  return out;
}

export interface Ride { set: Lip[]; next: number; combo: number; best: number; wobbles: number; score: number; perfect: number; good: number; over: boolean }
export const newRide = (set: Lip[]): Ride => ({ set, next: 0, combo: 0, best: 0, wobbles: 0, score: 0, perfect: 0, good: 0, over: false });
/** 连击倍率：每连 5 次 +0.5，最多 ×3 */
export const comboMul = (combo: number) => Math.min(3, 1 + Math.floor(combo / 5) * 0.5);

/** 推进到 now 秒：把已经过去、没点到的浪头记成错过（断连击）。返回错过的浪头 */
export function advance(r: Ride, now: number): Lip[] {
  const missed: Lip[] = [];
  while (r.next < r.set.length && r.set[r.next].t + WINDOW[r.set[r.next].kind] < now) { missed.push(r.set[r.next++]); r.combo = 0; }
  if (now >= DURATION) r.over = true;
  return missed;
}

export type TapResult = { kind: 'perfect' | 'good'; lip: Lip; gain: number } | { kind: 'wobble' } | { kind: 'over' };
/** now 秒时点了一下 */
export function tap(r: Ride, now: number): TapResult {
  advance(r, now);
  if (r.over) return { kind: 'over' };
  const lip = r.set[r.next];
  if (!lip || Math.abs(now - lip.t) > WINDOW[lip.kind]) {
    r.wobbles++; r.combo = 0;
    if (r.wobbles >= WOBBLES) r.over = true;
    return { kind: 'wobble' };
  }
  r.next++;
  const perfect = Math.abs(now - lip.t) <= PERFECT;
  const gain = Math.round(BASE[lip.kind] * (perfect ? 3 : 1) * comboMul(r.combo));
  r.combo++; r.best = Math.max(r.best, r.combo); r.score += gain;
  if (perfect) r.perfect++; else r.good++;
  return { kind: perfect ? 'perfect' : 'good', lip, gain };
}

export const TIERS = [30, 75, 120];
export const tierOf = (score: number) => TIERS.filter((x) => score >= x).length;

const MUL = [0, 1.5, 3.5, 7];
export function surfGain(s: PlayerState, tier: number): Gain {
  const base = winReward(farmStage(s).stage);
  return { fish: Math.round(base.fish * MUL[tier]), exp: 0, catnip: tier === 3 ? 3 : tier === 2 ? 1 : 0, bells: tier === 3 ? 8 : 0 };
}
export const runsLeft = (s: PlayerState, now = Date.now()) => Math.max(0, RUNS_PER_DAY - (ensureExplore(s, now).surfRuns ?? 0));
export function useRun(s: PlayerState, now = Date.now()): boolean {
  const e = ensureExplore(s, now);
  if ((e.surfRuns ?? 0) >= RUNS_PER_DAY) return false;
  e.surfRuns = (e.surfRuns ?? 0) + 1;
  return true;
}
/** 成功的花样数累计进足迹 */
export function recordTricks(s: PlayerState, n: number) { const t = totals(s); t.surf = (t.surf ?? 0) + n; }
