// 赶海挖蛤蜊的规则（纯逻辑，可测试）：椰风海湾东侧滩涂的小游戏（有点像扫雷，但要找的是好东西）。
// 6×6 的湿沙地里埋着 CLAMS 只蛤蜊和 CRABS 只螃蟹。挖一格：挖到蛤蜊 +1；挖到空沙会冒出气泡，气泡数 = 周围 8 格里的蛤蜊数；
// 挖到螃蟹会被夹一下，额外扣 CRAB_COST 铲。铲子用完（涨潮）就结束；全部挖到还有奖励分。
import { farmStage, ensureExplore, totals } from './explore';
import { winReward } from './stage';
import type { Gain } from './stage';
import type { PlayerState } from './state';

export const RUNS_PER_DAY = 5;
export const SIZE = 6;
export const CLAMS = 8;
export const CRABS = 2;
export const DIGS = 15;
export const CRAB_COST = 2;
export const ALL_BONUS = 5;
export type Cell = 'sand' | 'clam' | 'crab';

export interface Beach { cells: Cell[]; dug: boolean[]; digs: number; found: number; pinched: number; over: boolean }
export function newBeach(rnd: () => number): Beach {
  const cells: Cell[] = new Array(SIZE * SIZE).fill('sand');
  const idx = Array.from({ length: SIZE * SIZE }, (_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  for (let k = 0; k < CLAMS; k++) cells[idx[k]] = 'clam';
  for (let k = 0; k < CRABS; k++) cells[idx[CLAMS + k]] = 'crab';
  return { cells, dug: new Array(SIZE * SIZE).fill(false), digs: DIGS, found: 0, pinched: 0, over: false };
}
export function neighbors(i: number): number[] {
  const x = i % SIZE, y = Math.floor(i / SIZE), out: number[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE) out.push(ny * SIZE + nx); }
  return out;
}
/** 空沙格冒出的气泡数 */
export const bubbles = (b: Beach, i: number) => neighbors(i).filter((n) => b.cells[n] === 'clam').length;

export type DigResult = 'clam' | 'crab' | 'sand' | 'already' | 'over';
export function dig(b: Beach, i: number): DigResult {
  if (b.over) return 'over';
  if (b.dug[i]) return 'already';
  b.dug[i] = true; b.digs--;
  const c = b.cells[i];
  if (c === 'clam') b.found++;
  if (c === 'crab') { b.pinched++; b.digs -= CRAB_COST; }
  if (b.digs <= 0 || b.found >= CLAMS) { b.digs = Math.max(0, b.digs); b.over = true; }
  return c;
}
/** 结算分：蛤蜊每只 2 分；全部挖到再加 ALL_BONUS 和剩下的铲数 */
export const scoreOf = (b: Beach) => b.found * 2 + (b.found >= CLAMS ? ALL_BONUS + b.digs : 0);

export const TIERS = [6, 10, 14];
export const tierOf = (score: number) => TIERS.filter((x) => score >= x).length;

const MUL = [0, 1.5, 3.5, 7];
export function clamsGain(s: PlayerState, tier: number): Gain {
  const base = winReward(farmStage(s).stage);
  return { fish: Math.round(base.fish * MUL[tier]), exp: 0, catnip: tier === 3 ? 3 : tier === 2 ? 1 : 0, bells: tier === 3 ? 8 : 0 };
}
export const runsLeft = (s: PlayerState, now = Date.now()) => Math.max(0, RUNS_PER_DAY - (ensureExplore(s, now).clamRuns ?? 0));
export function useRun(s: PlayerState, now = Date.now()): boolean {
  const e = ensureExplore(s, now);
  if ((e.clamRuns ?? 0) >= RUNS_PER_DAY) return false;
  e.clamRuns = (e.clamRuns ?? 0) + 1;
  return true;
}
/** 挖到的蛤蜊累计进足迹 */
export function recordClams(s: PlayerState, n: number) { const t = totals(s); t.clams = (t.clams ?? 0) + n; }
