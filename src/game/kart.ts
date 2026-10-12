// 沙漠卡丁车的规则（纯逻辑，可测试）：椭圆赛道跑 2 圈，对手是 3 辆 AI 小车。
// 玩家只管左右打方向：捡加速带、绕开流沙和油渍，攒够氮气随时喷一口；按名次拿 1~3 档奖励，每天最多 RUNS_PER_DAY 场。
import { farmStage, ensureExplore, totals } from './explore';
import { winReward } from './stage';
import type { Gain } from './stage';
import type { PlayerState } from './state';

export const RUNS_PER_DAY = 5;
export const LAPS = 2;
export const BASE_SPEED = 0.047; // 圈/秒（玩家和最慢的对手差不多）
export const BOOST_MUL = 1.55;
export const NITRO_MUL = 1.5;
export const NITRO_TIME = 1.4;
export const NITRO_CHARGES = 2;
export const STEER_RATE = 2.1; // 横向最大速度（车道宽 = 2）
export const HIT_R = 0.2; // 圈内路程差：撞到道具的判定
export const LANE_R = 0.34; // 横向判定

export type ItemKind = 'boost' | 'sand' | 'oil' | 'fuel';
export interface Item { s: number; lane: number; kind: ItemKind }
export const ITEM_NAME: Record<ItemKind, string> = { boost: '加速带', sand: '流沙', oil: '油渍', fuel: '氮气瓶' };

/** 赛道上的道具：每圈 10 个，前 1/10 圈留空（发车区）；两圈道具位置一样 */
export function makeTrack(rnd: () => number): Item[] {
  const out: Item[] = [];
  for (let i = 0; i < 10; i++) {
    const s = 0.1 + (i / 10) * 0.9 - 0.02 + rnd() * 0.02;
    const r = rnd();
    out.push({ s, lane: [-0.62, 0, 0.62][Math.floor(rnd() * 3)], kind: r < 0.3 ? 'boost' : r < 0.55 ? 'sand' : r < 0.78 ? 'oil' : 'fuel' });
  }
  return out;
}

export interface Racer { id: string; name: string; emoji: string; s: number; lane: number; slow: number; boost: number; nitro: number; spin: number; done: number | null }
export interface Race { items: Item[]; me: Racer; ai: Racer[]; t: number; charges: number; hits: Record<ItemKind, number>; over: boolean; place: number }
const AI_DEF = [
  { id: 'ai1', name: '黑猫闪电', emoji: '🐈‍⬛', v: 0.0505, lane: -0.62, ph: 0.4 },
  { id: 'ai2', name: '橘猫火箭', emoji: '🐱', v: 0.0475, lane: 0.0, ph: 2.1 },
  { id: 'ai3', name: '三花飞轮', emoji: '😸', v: 0.0445, lane: 0.62, ph: 4.0 },
];
const mkRacer = (id: string, name: string, emoji: string, lane: number): Racer => ({ id, name, emoji, s: 0, lane, slow: 0, boost: 0, nitro: 0, spin: 0, done: null });
export function newRace(rnd: () => number): Race {
  return { items: makeTrack(rnd), me: mkRacer('me', '我', '😺', 0), ai: AI_DEF.map((a) => mkRacer(a.id, a.name, a.emoji, a.lane)), t: 0, charges: NITRO_CHARGES, hits: { boost: 0, sand: 0, oil: 0, fuel: 0 }, over: false, place: 0 };
}

const wrap = (x: number) => x - Math.floor(x);
/** 当前速度（圈/秒） */
export function speedOf(r: Racer, base: number): number {
  if (r.spin > 0) return base * 0.35;
  let k = 1;
  if (r.slow > 0) k *= 0.58;
  if (r.boost > 0) k *= BOOST_MUL;
  if (r.nitro > 0) k *= NITRO_MUL;
  return base * k;
}
/** 在 racer 当前位置撞到的道具（同一个道具一圈只触发一次，由调用方记录） */
function hitOf(items: Item[], r: Racer, prevS: number): number {
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (Math.abs(r.lane - it.lane) > LANE_R) continue;
    // 这一步经过了道具所在的圈内位置
    const a = wrap(prevS), b = wrap(r.s), p = it.s;
    const passed = a <= b ? p > a && p <= b : p > a || p <= b;
    if (passed) return i;
  }
  return -1;
}
function apply(r: Racer, kind: ItemKind, race?: Race) {
  if (kind === 'boost') r.boost = 1.4;
  else if (kind === 'sand') r.slow = 1.6;
  else if (kind === 'oil') r.spin = 0.9;
  else if (race && r === race.me) race.charges = Math.min(NITRO_CHARGES + 1, race.charges + 1);
}

/** 推进 dt 秒。steer ∈ [-1,1]；nitro 为 true 表示这一帧按了氮气。AI 不看道具，但会随机吃到几个。 */
export function step(race: Race, steer: number, nitro: boolean, dt: number, rnd: () => number = Math.random) {
  if (race.over) return;
  race.t += dt;
  const me = race.me;
  if (nitro && race.charges > 0 && me.nitro <= 0) { race.charges--; me.nitro = NITRO_TIME; }
  const racers = [me, ...race.ai];
  for (const r of racers) {
    if (r.done != null) continue;
    const prev = r.s;
    let base = BASE_SPEED;
    if (r !== me) {
      const d = AI_DEF.find((a) => a.id === r.id)!;
      base = d.v * (1 + 0.05 * Math.sin(race.t * 0.9 + d.ph));
      // AI 偶尔吃到流沙 / 油渍，落后几秒；每圈 ~2 次，和玩家的失误率差不多
      if (rnd() < dt * 0.08) { if (rnd() < 0.5) r.slow = 1.6; else r.spin = 0.9; }
      if (rnd() < dt * 0.05) r.boost = 1.4;
      r.lane += (d.lane + Math.sin(race.t * 0.7 + d.ph) * 0.15 - r.lane) * Math.min(1, dt * 2);
    } else {
      r.lane = Math.max(-1, Math.min(1, r.lane + steer * STEER_RATE * dt));
    }
    r.s += speedOf(r, base) * dt;
    r.slow = Math.max(0, r.slow - dt); r.boost = Math.max(0, r.boost - dt); r.nitro = Math.max(0, r.nitro - dt); r.spin = Math.max(0, r.spin - dt);
    if (r === me) {
      const i = hitOf(race.items, r, prev);
      if (i >= 0) { const k = race.items[i].kind; apply(r, k, race); race.hits[k]++; }
    }
    if (r.s >= LAPS && r.done == null) r.done = race.t;
  }
  // 名次：先到终点的按完成时间，没到的按路程
  if (me.done != null) { race.over = true; race.place = 1 + race.ai.filter((a) => a.done != null && a.done < me.done!).length; }
}

/** 当前名次（1~4），按路程算 */
export const placeNow = (race: Race) => 1 + race.ai.filter((a) => a.s > race.me.s).length;

export const TIER_BY_PLACE = [0, 3, 2, 1, 0];
export const tierOf = (place: number) => TIER_BY_PLACE[place] ?? 0;

const MUL = [0, 1.5, 3.5, 7];
export function kartGain(s: PlayerState, tier: number): Gain {
  const base = winReward(farmStage(s).stage);
  return { fish: Math.round(base.fish * MUL[tier]), exp: 0, catnip: tier === 3 ? 3 : tier === 2 ? 1 : 0, bells: tier === 3 ? 8 : 0 };
}

export const runsLeft = (s: PlayerState, now = Date.now()) => Math.max(0, RUNS_PER_DAY - (ensureExplore(s, now).kartRuns ?? 0));
export function useRun(s: PlayerState, now = Date.now()): boolean {
  const e = ensureExplore(s, now);
  if ((e.kartRuns ?? 0) >= RUNS_PER_DAY) return false;
  e.kartRuns = (e.kartRuns ?? 0) + 1;
  return true;
}
/** 跑完的场数累计进足迹 */
export function recordRace(s: PlayerState) { const t = totals(s); t.kart = (t.kart ?? 0) + 1; }
