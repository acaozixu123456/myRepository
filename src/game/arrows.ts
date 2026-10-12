// 草船借箭的规则（纯逻辑，可测试）：赤壁港西栈桥尽头的小游戏。
// 大雾江面上，玩家左右划动一条扎满稻草猫的小船，接住对岸射来的箭：普通箭 +1、一捆箭 +3，火箭要躲（−3，船着火变慢一会儿）。
// 限时 DURATION 秒，按借到的箭数（分数）拿 1~3 档奖励；每天最多 RUNS_PER_DAY 局。
import { farmStage, ensureExplore, totals } from './explore';
import { winReward } from './stage';
import type { Gain } from './stage';
import type { PlayerState } from './state';

export const RUNS_PER_DAY = 5;
export const DURATION = 25;
export const BOAT_HALF = 0.17; // 船半宽（江面宽 = 2，x ∈ [-1, 1]）
export const BOAT_SPEED = 1.25; // 每秒横移
export const BURN_TIME = 1.2; // 中火箭后船变慢的秒数
export const CATCH_Y = 0.1; // 箭落到这个高度时判定（顶部 = 1）
export type Kind = 'arrow' | 'bundle' | 'fire';
export const SCORE: Record<Kind, number> = { arrow: 1, bundle: 3, fire: -3 };
export const NAME: Record<Kind, string> = { arrow: '箭', bundle: '一捆箭', fire: '火箭' };

export interface Shot { id: number; t: number; x: number; kind: Kind; fall: number }

/** 一局的出场表：越往后越密、越快；同一时刻附近不会扎堆 */
export function makeSchedule(rnd: () => number): Shot[] {
  const out: Shot[] = [];
  let t = 0.6;
  while (t < DURATION - 1.2) {
    const r = rnd(), k = t / DURATION;
    const kind: Kind = r < 0.12 ? 'bundle' : r < 0.12 + 0.12 + k * 0.12 ? 'fire' : 'arrow';
    out.push({ id: out.length, t: +t.toFixed(3), x: +(-0.9 + rnd() * 1.8).toFixed(3), kind, fall: +(1.9 - k * 0.6).toFixed(3) });
    t += 0.42 - k * 0.14 + rnd() * 0.22;
  }
  return out;
}

/** now 秒时箭的高度（1 = 刚出现在顶上，0 = 落进江里）；没出场或已落水返回 null */
export function heightOf(s: Shot, now: number): number | null {
  const p = (now - s.t) / s.fall;
  return p < 0 || p > 1 ? null : 1 - p;
}

export interface Game { plan: Shot[]; t: number; boat: number; burn: number; score: number; got: number; done: Set<number>; log: { id: number; caught: boolean }[] }
export const newGame = (plan: Shot[]): Game => ({ plan, t: 0, boat: 0, burn: 0, score: 0, got: 0, done: new Set(), log: [] });

/** 推进 dt 秒：steer ∈ [-1, 1]（左 / 右）。返回这一步结算的箭（接到的 / 落水的） */
export function step(g: Game, steer: number, dt: number): { s: Shot; caught: boolean }[] {
  const prev = g.t;
  g.t += dt;
  const v = BOAT_SPEED * (g.burn > 0 ? 0.45 : 1);
  g.boat = Math.max(-1 + BOAT_HALF, Math.min(1 - BOAT_HALF, g.boat + steer * v * dt));
  g.burn = Math.max(0, g.burn - dt);
  const out: { s: Shot; caught: boolean }[] = [];
  for (const s of g.plan) {
    if (g.done.has(s.id)) continue;
    const hitT = s.t + s.fall * (1 - CATCH_Y);
    if (hitT > prev && hitT <= g.t) {
      g.done.add(s.id);
      const caught = Math.abs(s.x - g.boat) <= BOAT_HALF;
      if (caught) {
        g.score = Math.max(0, g.score + SCORE[s.kind]);
        if (s.kind === 'fire') g.burn = BURN_TIME; else g.got += s.kind === 'bundle' ? 3 : 1;
      }
      g.log.push({ id: s.id, caught });
      out.push({ s, caught });
    }
  }
  return out;
}
export const isOver = (g: Game) => g.t >= DURATION;

export const TIERS = [12, 25, 35]; // 分数达到这些依次拿 1 / 2 / 3 档
export const tierOf = (score: number) => TIERS.filter((x) => score >= x).length;

const MUL = [0, 1.5, 3.5, 7];
export function arrowsGain(s: PlayerState, tier: number): Gain {
  const base = winReward(farmStage(s).stage);
  return { fish: Math.round(base.fish * MUL[tier]), exp: 0, catnip: tier === 3 ? 3 : tier === 2 ? 1 : 0, bells: tier === 3 ? 8 : 0 };
}

export const runsLeft = (s: PlayerState, now = Date.now()) => Math.max(0, RUNS_PER_DAY - (ensureExplore(s, now).arrowRuns ?? 0));
export function useRun(s: PlayerState, now = Date.now()): boolean {
  const e = ensureExplore(s, now);
  if ((e.arrowRuns ?? 0) >= RUNS_PER_DAY) return false;
  e.arrowRuns = (e.arrowRuns ?? 0) + 1;
  return true;
}
/** 借到的箭数累计进足迹 */
export function recordArrows(s: PlayerState, n: number) { const t = totals(s); t.arrows = (t.arrows ?? 0) + n; }
