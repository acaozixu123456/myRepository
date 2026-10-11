// 日常福利：七日签到（漏签不清零）、快速探索（立刻领取 2 小时挂机收益）。
import { dayIndex, vipLevel } from './premium';
import { idleRate } from './stage';
import type { PlayerState } from './state';

export interface SignReward { fish?: number; bells?: number; catnip?: number; tickets?: number; moon?: number }
export const SIGNIN_REWARDS: SignReward[] = [
  { fish: 2000 }, { bells: 120 }, { catnip: 8 }, { tickets: 3 }, { fish: 6000 }, { bells: 300 }, { tickets: 10, moon: 100 },
];
export const SIGNIN_VIP_DOUBLE = 3; // VIP 几级起签到奖励翻倍

export interface DailyState { signDay: number; signStreak: number; signTotal: number; fastDay: number; fastUsed: number }
export function ensureDaily(s: PlayerState): DailyState {
  s.daily ??= { signDay: -1, signStreak: 0, signTotal: 0, fastDay: -1, fastUsed: 0 };
  return s.daily;
}

export const canSign = (s: PlayerState, now = Date.now()) => ensureDaily(s).signDay < dayIndex(now);
/** 下一次签到是第几天（1~7，循环） */
export const nextSignDay = (s: PlayerState) => (ensureDaily(s).signStreak % 7) + 1;
export function signIn(s: PlayerState, now = Date.now()): { ok: true; day: number; reward: SignReward; doubled: boolean } | { ok: false; reason: string } {
  const d = ensureDaily(s);
  if (!canSign(s, now)) return { ok: false, reason: '今天已经签到过啦' };
  const day = nextSignDay(s);
  const base = SIGNIN_REWARDS[day - 1];
  const doubled = vipLevel(s) >= SIGNIN_VIP_DOUBLE;
  const k = doubled ? 2 : 1;
  const reward: SignReward = {};
  for (const key of Object.keys(base) as (keyof SignReward)[]) reward[key] = (base[key] ?? 0) * k;
  s.res.fish += reward.fish ?? 0; s.res.bells += reward.bells ?? 0; s.res.catnip += reward.catnip ?? 0; s.res.tickets += reward.tickets ?? 0; s.res.moon += reward.moon ?? 0;
  d.signDay = dayIndex(now); d.signStreak++; d.signTotal++;
  return { ok: true, day, reward, doubled };
}

// ---------- 快速探索 ----------
export const FAST_MINUTES = 120;
export const FAST_FREE = 1;
export const FAST_COST = 50; // 金铃铛 / 次（超出免费次数后）
export const FAST_MAX = 6; // 每天最多次数（含免费）
export function fastFree(s: PlayerState, now = Date.now()): number {
  const d = ensureDaily(s);
  const free = FAST_FREE + Math.floor(vipLevel(s) / 4);
  return Math.max(0, free - (d.fastDay === dayIndex(now) ? d.fastUsed : 0));
}
export const fastUsed = (s: PlayerState, now = Date.now()) => { const d = ensureDaily(s); return d.fastDay === dayIndex(now) ? d.fastUsed : 0; };
export function fastExplore(s: PlayerState, now = Date.now()): { ok: true; fish: number; exp: number; paid: boolean } | { ok: false; reason: string } {
  const d = ensureDaily(s);
  const today = dayIndex(now);
  if (d.fastDay !== today) { d.fastDay = today; d.fastUsed = 0; }
  if (d.fastUsed >= FAST_MAX) return { ok: false, reason: `今天最多快速探索 ${FAST_MAX} 次` };
  const paid = fastFree(s, now) <= 0;
  if (paid) { if (s.res.bells < FAST_COST) return { ok: false, reason: '金铃铛不够' }; s.res.bells -= FAST_COST; }
  const r = idleRate(s);
  const fish = Math.round(r.fish * FAST_MINUTES), exp = Math.round(r.exp * FAST_MINUTES);
  s.res.fish += fish; s.res.exp += exp; d.fastUsed++;
  return { ok: true, fish, exp, paid };
}
