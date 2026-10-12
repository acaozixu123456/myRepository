// 萤火虫记忆的规则（纯逻辑，可测试）：光之森遗迹旁的小游戏。
// 遗迹周围有 SPOTS 盏萤火虫灯，每轮按顺序亮一串（第 1 轮 2 个，之后每轮多 1 个，前面的顺序不变），玩家照着顺序点回去。
// 点错一次可以重看这一轮，再错就结束。按完成的轮数计分，拿 1~3 档奖励；每天最多 RUNS_PER_DAY 局。
import { farmStage, ensureExplore, totals } from './explore';
import { winReward } from './stage';
import type { Gain } from './stage';
import type { PlayerState } from './state';

export const RUNS_PER_DAY = 5;
export const SPOTS = 6;
export const ROUNDS = 8; // 最多 8 轮（最长 9 个）
export const START_LEN = 2;
export const LIVES = 2;

export interface Memo { seq: number[]; round: number; pos: number; lives: number; score: number; over: boolean }

/** 整局的顺序：相邻两个不会是同一盏灯 */
export function newMemo(rnd: () => number): Memo {
  const seq: number[] = [];
  for (let i = 0; i < START_LEN + ROUNDS - 1; i++) {
    let k = Math.floor(rnd() * SPOTS);
    if (i && k === seq[i - 1]) k = (k + 1 + Math.floor(rnd() * (SPOTS - 1))) % SPOTS;
    seq.push(k);
  }
  return { seq, round: 0, pos: 0, lives: LIVES, score: 0, over: false };
}
/** 这一轮要亮的那一串 */
export const roundSeq = (m: Memo) => m.seq.slice(0, START_LEN + m.round);
/** 每轮播放时每盏灯亮多久（秒）：越往后越快 */
export const flashTime = (round: number) => Math.max(0.32, 0.6 - round * 0.04);

export type TapResult = 'ok' | 'round' | 'retry' | 'miss' | 'clear';
/** 玩家点了第 spot 盏灯 */
export function tap(m: Memo, spot: number): TapResult {
  if (m.over) return 'miss';
  const want = roundSeq(m);
  if (want[m.pos] !== spot) {
    m.lives--; m.pos = 0;
    if (m.lives <= 0) { m.over = true; return 'miss'; }
    return 'retry';
  }
  m.pos++;
  if (m.pos < want.length) return 'ok';
  m.score += want.length; m.round++; m.pos = 0;
  if (m.round >= ROUNDS) { m.over = true; return 'clear'; }
  return 'round';
}

// 完成 2 轮（2+3）= 5、4 轮（…+5）= 14、6 轮（…+7）= 27
export const TIERS = [5, 14, 27];
export const tierOf = (score: number) => TIERS.filter((x) => score >= x).length;

const MUL = [0, 1.5, 3.5, 7];
export function fireflyGain(s: PlayerState, tier: number): Gain {
  const base = winReward(farmStage(s).stage);
  return { fish: Math.round(base.fish * MUL[tier]), exp: 0, catnip: tier === 3 ? 3 : tier === 2 ? 1 : 0, bells: tier === 3 ? 8 : 0 };
}

export const runsLeft = (s: PlayerState, now = Date.now()) => Math.max(0, RUNS_PER_DAY - (ensureExplore(s, now).fireflyRuns ?? 0));
export function useRun(s: PlayerState, now = Date.now()): boolean {
  const e = ensureExplore(s, now);
  if ((e.fireflyRuns ?? 0) >= RUNS_PER_DAY) return false;
  e.fireflyRuns = (e.fireflyRuns ?? 0) + 1;
  return true;
}
/** 完成的轮数累计进足迹 */
export function recordRounds(s: PlayerState, n: number) { const t = totals(s); t.firefly = (t.firefly ?? 0) + n; }
