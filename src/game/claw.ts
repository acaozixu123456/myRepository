// 夹娃娃机的规则（纯逻辑，可测试）：赛博街区「九命电器」门口的娃娃机。
// 爪子在机器顶上左右来回跑，玩家看准时机按「抓」；爪子落点离娃娃中心越近越抓得牢，偏了会滑掉。
// 一局 GRABS 次，娃娃按大小 / 稀有度计分，按总分拿 1~3 档奖励；每天最多 RUNS_PER_DAY 局。
import { farmStage, ensureExplore, totals } from './explore';
import { winReward } from './stage';
import type { Gain } from './stage';
import type { PlayerState } from './state';

export const RUNS_PER_DAY = 5;
export const GRABS = 3;
export type ToyKind = 'plush' | 'big' | 'gold';
export const TOY_NAME: Record<ToyKind, string> = { plush: '毛球喵', big: '大胖橘抱枕', gold: '招财金猫' };
export const TOY_SCORE: Record<ToyKind, number> = { plush: 1, big: 2, gold: 4 };
/** 半宽（机器宽 = 1）：越大越好对准 */
export const TOY_HALF: Record<ToyKind, number> = { plush: 0.05, big: 0.065, gold: 0.035 };
/** 正中时的成功率：大抱枕沉、金猫滑 */
export const TOY_GRIP: Record<ToyKind, number> = { plush: 0.95, big: 0.82, gold: 0.75 };

export interface Toy { id: number; x: number; kind: ToyKind }
export interface Machine { toys: Toy[]; grabs: number; score: number; won: ToyKind[] }

/** 一台机器：6 个娃娃（1 金猫、1 大抱枕、4 毛球）随机排成一排，每个占一格、格内随机偏移，彼此不重叠；固定种子可复现 */
export const SLOTS = 6;
export function newMachine(rnd: () => number): Machine {
  const kinds: ToyKind[] = ['gold', 'big', 'plush', 'plush', 'plush', 'plush'];
  for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
  const w = 0.84 / SLOTS;
  const toys = kinds.map((kind, i): Toy => { const room = w / 2 - TOY_HALF[kind] - 0.004; return { id: i, x: +(0.08 + w * (i + 0.5) + (rnd() * 2 - 1) * room).toFixed(3), kind }; });
  return { toys, grabs: 0, score: 0, won: [] };
}

/** 爪子左右来回的速度（来回一趟 / 秒）：每抓一次快一点 */
export const clawSpeed = (grabs: number) => 0.32 + grabs * 0.1;
/** t 秒时爪子的位置（0.05~0.95 之间的三角波） */
export function clawX(t: number, grabs: number): number {
  const p = (t * clawSpeed(grabs)) % 1, tri = p < 0.5 ? p * 2 : 2 - p * 2;
  return 0.05 + tri * 0.9;
}

/** 偏差 off（0 = 正中，1 = 刚好在娃娃边上）时的成功率 */
export function gripChance(kind: ToyKind, off: number): number {
  if (off > 1) return 0;
  return TOY_GRIP[kind] * (off <= 0.35 ? 1 : Math.max(0.15, 1 - (off - 0.35) * 1.3));
}

export interface GrabResult { toy: Toy | null; ok: boolean; off: number }
/** 在 x 处下爪：抓离落点最近、且在半宽内的那个娃娃 */
export function grab(m: Machine, x: number, rnd: () => number = Math.random): GrabResult {
  if (m.grabs >= GRABS) return { toy: null, ok: false, off: 9 };
  m.grabs++;
  let best: Toy | null = null, off = 9;
  for (const t of m.toys) { const o = Math.abs(t.x - x) / TOY_HALF[t.kind]; if (o < off) { off = o; best = t; } }
  if (!best || off > 1) return { toy: null, ok: false, off };
  const ok = rnd() < gripChance(best.kind, off);
  if (ok) { m.toys = m.toys.filter((t) => t !== best); m.score += TOY_SCORE[best.kind]; m.won.push(best.kind); }
  return { toy: best, ok, off };
}
export const isOver = (m: Machine) => m.grabs >= GRABS || m.toys.length === 0;

export const TIERS = [1, 4, 7]; // 总分达到这些依次拿 1 / 2 / 3 档
export const tierOf = (score: number) => TIERS.filter((x) => score >= x).length;

const MUL = [0, 1.5, 3.5, 7];
export function clawGain(s: PlayerState, tier: number): Gain {
  const base = winReward(farmStage(s).stage);
  return { fish: Math.round(base.fish * MUL[tier]), exp: 0, catnip: tier === 3 ? 3 : tier === 2 ? 1 : 0, bells: tier === 3 ? 8 : 0 };
}

export const runsLeft = (s: PlayerState, now = Date.now()) => Math.max(0, RUNS_PER_DAY - (ensureExplore(s, now).clawRuns ?? 0));
export function useRun(s: PlayerState, now = Date.now()): boolean {
  const e = ensureExplore(s, now);
  if ((e.clawRuns ?? 0) >= RUNS_PER_DAY) return false;
  e.clawRuns = (e.clawRuns ?? 0) + 1;
  return true;
}
/** 抓到的娃娃个数累计进足迹 */
export function recordWon(s: PlayerState, n: number) { const t = totals(s); t.claw = (t.claw ?? 0) + n; }
