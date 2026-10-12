// 网咖「鼠标大作战」的规则（纯逻辑，可测试）：赛博街区「赛博猫网咖」里的街机。
// 4 条跑道上，鼠标（老鼠）从屏幕一边窜到另一边；点中就算抓到，金鼠标分高，扫地机器人别点。
// 连续抓到不漏有连击倍率；让老鼠跑掉或点到机器人会断连击。限时 DURATION 秒，按分数拿 1~3 档奖励。
import { farmStage, ensureExplore, totals } from './explore';
import { winReward } from './stage';
import type { Gain } from './stage';
import type { PlayerState } from './state';

export const RUNS_PER_DAY = 6;
export const DURATION = 25;
export const LANES = 4;
export type Kind = 'mouse' | 'gold' | 'robot';
export const SCORE: Record<Kind, number> = { mouse: 1, gold: 3, robot: -3 };
export const NAME: Record<Kind, string> = { mouse: '鼠标', gold: '金鼠标', robot: '扫地机器人' };
/** 横穿屏幕要的秒数：金鼠标最快 */
export const CROSS: Record<Kind, number> = { mouse: 2.6, gold: 1.7, robot: 3.2 };
/** 点中判定：离目标中心多少（屏幕宽 = 1） */
export const HIT_R = 0.09;

export interface Runner { id: number; t: number; lane: number; kind: Kind; dir: 1 | -1; cross: number }

/** 一局的出场表：按时间排好；同一条跑道上前一只还没跑过半屏不会再放新的 */
export function makeSchedule(rnd: () => number): Runner[] {
  const out: Runner[] = [];
  const freeAt = new Array<number>(LANES).fill(0);
  let t = 0.5;
  while (t < DURATION - 1.5) {
    const free = freeAt.map((f, i) => (f <= t ? i : -1)).filter((i) => i >= 0);
    if (free.length) {
      const lane = free[Math.floor(rnd() * free.length)];
      const r = rnd();
      const kind: Kind = r < 0.14 ? 'gold' : r < 0.36 ? 'robot' : 'mouse';
      // 越到后面越快：最后 5 秒快 25%
      const cross = +(CROSS[kind] * (1 - 0.25 * Math.min(1, t / DURATION))).toFixed(3);
      out.push({ id: out.length, t: +t.toFixed(3), lane, kind, dir: rnd() < 0.5 ? 1 : -1, cross });
      freeAt[lane] = t + cross * 0.55;
    }
    t += 0.45 + rnd() * 0.35;
  }
  return out;
}

/** now 秒时 runner 的横向位置（0~1）；没出场或已跑掉返回 null */
export function posOf(r: Runner, now: number): number | null {
  const p = (now - r.t) / r.cross;
  if (p < 0 || p > 1) return null;
  const x = -0.06 + p * 1.12;
  return r.dir === 1 ? x : 1 - x;
}

export interface Game { plan: Runner[]; caught: Set<number>; score: number; combo: number; best: number; got: number }
export const newGame = (plan: Runner[]): Game => ({ plan, caught: new Set(), score: 0, combo: 0, best: 0, got: 0 });
/** 连击倍率：每连抓 5 只 +0.5，最多 ×3 */
export const comboMul = (combo: number) => Math.min(3, 1 + Math.floor(combo / 5) * 0.5);

/** 在 now 秒点了跑道 lane 的 x 处：返回被点中的 runner 和得分变化 */
export function tap(g: Game, lane: number, x: number, now: number): { r: Runner | null; delta: number } {
  let hit: Runner | null = null, best = HIT_R;
  for (const r of g.plan) {
    if (r.lane !== lane || g.caught.has(r.id)) continue;
    const p = posOf(r, now);
    if (p == null) continue;
    const d = Math.abs(p - x);
    if (d <= best) { best = d; hit = r; }
  }
  if (!hit) return { r: null, delta: 0 };
  g.caught.add(hit.id);
  let delta: number;
  if (hit.kind === 'robot') { delta = SCORE.robot; g.combo = 0; }
  else { g.combo++; g.best = Math.max(g.best, g.combo); g.got++; delta = Math.round(SCORE[hit.kind] * comboMul(g.combo)); }
  g.score = Math.max(0, g.score + delta);
  return { r: hit, delta };
}

/** 推进到 now：没抓到就跑掉的鼠标会断连击。返回这一步跑掉的个数 */
export function escapes(g: Game, prev: number, now: number): number {
  let n = 0;
  for (const r of g.plan) {
    if (r.kind === 'robot' || g.caught.has(r.id)) continue;
    const end = r.t + r.cross;
    if (end > prev && end <= now) { n++; g.combo = 0; }
  }
  return n;
}

export const TIERS = [15, 30, 48]; // 分数达到这些依次拿 1 / 2 / 3 档
export const tierOf = (score: number) => TIERS.filter((x) => score >= x).length;

const MUL = [0, 1.5, 3.5, 7];
export function whackGain(s: PlayerState, tier: number): Gain {
  const base = winReward(farmStage(s).stage);
  return { fish: Math.round(base.fish * MUL[tier]), exp: 0, catnip: tier === 3 ? 3 : tier === 2 ? 1 : 0, bells: tier === 3 ? 8 : 0 };
}

export const runsLeft = (s: PlayerState, now = Date.now()) => Math.max(0, RUNS_PER_DAY - (ensureExplore(s, now).whackRuns ?? 0));
export function useRun(s: PlayerState, now = Date.now()): boolean {
  const e = ensureExplore(s, now);
  if ((e.whackRuns ?? 0) >= RUNS_PER_DAY) return false;
  e.whackRuns = (e.whackRuns ?? 0) + 1;
  return true;
}
/** 抓到的鼠标个数累计进足迹 */
export function recordCaught(s: PlayerState, n: number) { const t = totals(s); t.whack = (t.whack ?? 0) + n; }
