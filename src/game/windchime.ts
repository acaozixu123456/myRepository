// 风铃节奏小游戏的规则（纯逻辑，可测试）：音符沿 3 条轨道落下，在它落到判定线的一刻点对应轨道。
// 奖励以当前最高关挂机奖励为基数；每天最多 RUNS_PER_DAY 局。
import { farmStage, ensureExplore, totals } from './explore';
import { winReward } from './stage';
import type { Gain } from './stage';
import type { PlayerState } from './state';

export const RUNS_PER_DAY = 6;
export const LANES = 3;
export const LANE_NAMES = ['叮', '咚', '铃'] as const;
export const FALL = 1.4; // 音符从出现到落到判定线的秒数
export const NOTES = 32;
export const PERFECT_MS = 80, GOOD_MS = 170, REACH_MS = 220; // 判定窗口（±毫秒）；超过 REACH 视为没点中任何音符

export interface Note { t: number; lane: number }

/** 一张谱：32 个音符，间隔 0.45~0.9 秒，同一轨道至少隔 0.3 秒；开头留 2 秒预备 */
export function makeChart(rnd: () => number): Note[] {
  const out: Note[] = [];
  const lastIn = new Array<number>(LANES).fill(-9);
  let t = 2.0;
  for (let i = 0; i < NOTES; i++) {
    t += 0.45 + rnd() * 0.45;
    let lane = Math.floor(rnd() * LANES);
    for (let k = 0; k < LANES && t - lastIn[lane] < 0.3; k++) lane = (lane + 1) % LANES;
    lastIn[lane] = t;
    out.push({ t: +t.toFixed(3), lane });
  }
  return out;
}

export type Grade = 'perfect' | 'good' | 'miss';
export const gradeOf = (dtMs: number): Grade => { const a = Math.abs(dtMs); return a <= PERFECT_MS ? 'perfect' : a <= GOOD_MS ? 'good' : 'miss'; };

/** 在第 lane 轨、第 now 秒点了一下：找这条轨上最近的、还没处理的音符。找不到（太远）返回 null。 */
export function matchTap(chart: readonly Note[], done: ReadonlySet<number>, lane: number, now: number): { index: number; grade: Grade } | null {
  let best = -1, bd = Infinity;
  chart.forEach((n, i) => { if (n.lane !== lane || done.has(i)) return; const d = Math.abs(n.t - now) * 1000; if (d < bd) { bd = d; best = i; } });
  if (best < 0 || bd > REACH_MS) return null;
  return { index: best, grade: gradeOf((chart[best].t - now) * 1000 * -1) };
}

/** 命中率 = (完美 + 0.6×好) / 总数；档位线 50% / 70% / 88% */
export const accuracy = (perfect: number, good: number, total = NOTES) => (perfect + good * 0.6) / total;
export const TIERS = [0.5, 0.7, 0.88];
export const tierOf = (acc: number) => TIERS.filter((x) => acc >= x).length;

const MUL = [0, 1.6, 3.8, 7.5];
export function chimeGain(s: PlayerState, tier: number): Gain {
  const base = winReward(farmStage(s).stage);
  return { fish: Math.round(base.fish * MUL[tier]), exp: 0, catnip: tier === 3 ? 3 : tier === 2 ? 1 : 0, bells: tier === 3 ? 8 : 0 };
}

export const runsLeft = (s: PlayerState, now = Date.now()) => Math.max(0, RUNS_PER_DAY - (ensureExplore(s, now).chimeRuns ?? 0));
export function useRun(s: PlayerState, now = Date.now()): boolean {
  const e = ensureExplore(s, now);
  if ((e.chimeRuns ?? 0) >= RUNS_PER_DAY) return false;
  e.chimeRuns = (e.chimeRuns ?? 0) + 1;
  return true;
}
/** 命中的音符数（完美 + 好）累计进足迹 */
export function recordHits(s: PlayerState, n: number) { if (n > 0) { const t = totals(s); t.chime = (t.chime ?? 0) + n; } }
