// 夜市套圈的规则（纯逻辑，可测试）：喵洲夜市东侧的套圈摊。
// 地上摆着 3 排奖品桩（近 / 中 / 远），每次扔圈分两步：先定方向（左右来回摆的箭头），再定力度（来回涨落的力度条）。
// 圈落点 = (方向, 力度)，再加一点手抖；落在某个奖品桩的圈套半径里就算套中。一局 RINGS 个圈，按总分拿 1~3 档奖励。
import { farmStage, ensureExplore, totals } from './explore';
import { winReward } from './stage';
import type { Gain } from './stage';
import type { PlayerState } from './state';

export const RUNS_PER_DAY = 5;
export const RINGS = 5;
/** 套中判定：落点离桩心多少以内（场地宽 = 2，纵深 = 1） */
export const RING_R = 0.085;
/** 手抖：落点在方向 / 力度上各随机偏多少（±） */
export const WOBBLE = 0.03;
export type PrizeKind = 'fish' | 'yarn' | 'bell' | 'lucky';
export const PRIZE_NAME: Record<PrizeKind, string> = { fish: '小鱼干串', yarn: '毛线球', bell: '金铃铛', lucky: '招财猫' };
export const PRIZE_SCORE: Record<PrizeKind, number> = { fish: 1, yarn: 2, bell: 3, lucky: 6 };
/** 3 排桩的纵深（力度要对上）：越远分越高 */
export const ROWS = [0.3, 0.58, 0.86];
const ROW_KIND: PrizeKind[] = ['fish', 'yarn', 'bell'];

export interface Peg { id: number; x: number; y: number; kind: PrizeKind }
export interface Toss { pegs: Peg[]; thrown: number; score: number; won: PrizeKind[] }

/** 一局的场地：每排 5 个桩（x ∈ [-0.8, 0.8]，中间一排错开），最远一排随机一个换成招财猫 */
export function newToss(rnd: () => number): Toss {
  const pegs: Peg[] = [];
  ROWS.forEach((y, r) => {
    for (let i = 0; i < 5; i++) {
      const x = (r % 2 ? -0.7 + i * 0.35 : -0.8 + i * 0.4) + (rnd() * 2 - 1) * 0.03;
      pegs.push({ id: pegs.length, x: +x.toFixed(3), y: +(y + (rnd() * 2 - 1) * 0.02).toFixed(3), kind: ROW_KIND[r] });
    }
  });
  const far = pegs.filter((p) => p.kind === 'bell');
  far[Math.floor(rnd() * far.length)].kind = 'lucky';
  return { pegs: pegs.sort((a, b) => a.x - b.x), thrown: 0, score: 0, won: [] };
}

/** 方向箭头（-1~1）与力度条（0.12~1）随时间来回摆；每扔一个圈都稍快一点 */
export const aimSpeed = (thrown: number) => 0.42 + thrown * 0.05;
export const powerSpeed = (thrown: number) => 0.7 + thrown * 0.08;
const tri = (p: number) => { const f = p % 1; return f < 0.5 ? f * 2 : 2 - f * 2; };
export const aimAt = (t: number, thrown: number) => -0.95 + tri(t * aimSpeed(thrown)) * 1.9;
export const powerAt = (t: number, thrown: number) => 0.12 + tri(t * powerSpeed(thrown)) * 0.88;

export interface ThrowResult { x: number; y: number; peg: Peg | null }
/** 按 (方向, 力度) 扔一个圈：加上手抖后找最近的桩，在 RING_R 内就套中 */
export function toss(t: Toss, aim: number, power: number, rnd: () => number = Math.random): ThrowResult {
  if (t.thrown >= RINGS) return { x: aim, y: power, peg: null };
  t.thrown++;
  const x = aim + (rnd() * 2 - 1) * WOBBLE, y = power + (rnd() * 2 - 1) * WOBBLE;
  let best: Peg | null = null, d = RING_R;
  for (const p of t.pegs) { const e = Math.hypot(p.x - x, p.y - y); if (e <= d) { d = e; best = p; } }
  if (best) { t.pegs = t.pegs.filter((p) => p !== best); t.score += PRIZE_SCORE[best.kind]; t.won.push(best.kind); }
  return { x, y, peg: best };
}
export const isOver = (t: Toss) => t.thrown >= RINGS;

export const TIERS = [3, 8, 14]; // 总分达到这些依次拿 1 / 2 / 3 档
export const tierOf = (score: number) => TIERS.filter((x) => score >= x).length;

const MUL = [0, 1.5, 3.5, 7];
export function ringGain(s: PlayerState, tier: number): Gain {
  const base = winReward(farmStage(s).stage);
  return { fish: Math.round(base.fish * MUL[tier]), exp: 0, catnip: tier === 3 ? 3 : tier === 2 ? 1 : 0, bells: tier === 3 ? 8 : 0 };
}

export const runsLeft = (s: PlayerState, now = Date.now()) => Math.max(0, RUNS_PER_DAY - (ensureExplore(s, now).ringRuns ?? 0));
export function useRun(s: PlayerState, now = Date.now()): boolean {
  const e = ensureExplore(s, now);
  if ((e.ringRuns ?? 0) >= RUNS_PER_DAY) return false;
  e.ringRuns = (e.ringRuns ?? 0) + 1;
  return true;
}
/** 套中的个数累计进足迹 */
export function recordWon(s: PlayerState, n: number) { const t = totals(s); t.ring = (t.ring ?? 0) + n; }
