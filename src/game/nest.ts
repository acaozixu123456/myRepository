// 猫窝：给猫猫们布置的家。家具一次性购买，提供「舒适度」；舒适度越高，每天攒下的小鱼干越多（最多攒 3 天）。
// 免费路线用小鱼干 / 金铃铛，高级家具用月光珠，舒适度和每日收益拉开差距。纯逻辑，时间可注入。
import { dayIndex } from './premium';
import type { PlayerState } from './state';

export interface Furniture { id: string; name: string; desc: string; comfort: number; cost: { fish?: number; bells?: number; moon?: number } }
export const FURNITURE: Furniture[] = [
  { id: 'f_cushion', name: '软垫窝', desc: '最基础的一张软垫，凹下去的形状刚好是一只猫。', comfort: 5, cost: { fish: 3000 } },
  { id: 'f_scratch', name: '抓板', desc: '瓦楞纸的，抓起来沙沙作响，沙发因此幸免于难。', comfort: 8, cost: { fish: 8000 } },
  { id: 'f_perch', name: '窗台木架', desc: '正对着太阳和鸽子，是个绝佳的观察哨。', comfort: 12, cost: { fish: 20000 } },
  { id: 'f_tank', name: '小鱼缸', desc: '里面的鱼很安全，毕竟玻璃是真的。', comfort: 20, cost: { fish: 50000 } },
  { id: 'f_tower', name: '猫爬架', desc: '三层，带吊球，顶层永远是会长的位置。', comfort: 30, cost: { bells: 600 } },
  { id: 'f_fountain', name: '月光喷泉', desc: '夜里会发出淡淡的蓝光，水声比任何摇篮曲都管用。', comfort: 80, cost: { moon: 600 } },
  { id: 'f_hammock', name: '云朵吊床', desc: '像是把一小块云拴在了窗边，躺上去会不想起来。', comfort: 160, cost: { moon: 1200 } },
  { id: 'f_shrine', name: '九命神龛', desc: '供着九个小小的铃铛，据说每一只都对应一条命。', comfort: 400, cost: { moon: 3000 } },
];
export const NEST_FISH_PER_COMFORT = 60; // 每点舒适度每天攒的小鱼干
export const NEST_MAX_DAYS = 3;
export interface NestState { owned: string[]; last: number }

export function ensureNest(s: PlayerState, now = Date.now()): NestState {
  s.nest ??= { owned: [], last: dayIndex(now) };
  s.nest.owned ??= [];
  if (!Number.isFinite(s.nest.last)) s.nest.last = dayIndex(now);
  return s.nest;
}
export const comfortOf = (s: PlayerState) => ensureNest(s).owned.reduce((a, id) => a + (FURNITURE.find((f) => f.id === id)?.comfort ?? 0), 0);
export const nestDaysReady = (s: PlayerState, now = Date.now()) => { const n = ensureNest(s, now); return Math.max(0, Math.min(NEST_MAX_DAYS, dayIndex(now) - n.last)); };
export const nestPending = (s: PlayerState, now = Date.now()) => nestDaysReady(s, now) * comfortOf(s) * NEST_FISH_PER_COMFORT;

export function buyFurniture(s: PlayerState, id: string, now = Date.now()): { ok: true; f: Furniture } | { ok: false; reason: string } {
  const f = FURNITURE.find((x) => x.id === id), n = ensureNest(s, now);
  if (!f) return { ok: false, reason: '没有这件家具' };
  if (n.owned.includes(id)) return { ok: false, reason: '已经摆好啦' };
  const c = f.cost;
  if ((c.fish ?? 0) > s.res.fish) return { ok: false, reason: '小鱼干不够' };
  if ((c.bells ?? 0) > s.res.bells) return { ok: false, reason: '金铃铛不够' };
  if ((c.moon ?? 0) > (s.res.moon ?? 0)) return { ok: false, reason: '月光珠不够' };
  // 买之前先把已攒的收益结清，避免新家具追溯加成
  if (nestDaysReady(s, now) > 0) collectNest(s, now);
  s.res.fish -= c.fish ?? 0; s.res.bells -= c.bells ?? 0; s.res.moon = (s.res.moon ?? 0) - (c.moon ?? 0);
  n.owned.push(id);
  return { ok: true, f };
}
export function collectNest(s: PlayerState, now = Date.now()): { ok: true; fish: number; days: number } | { ok: false; reason: string } {
  const n = ensureNest(s, now), days = nestDaysReady(s, now), fish = days * comfortOf(s) * NEST_FISH_PER_COMFORT;
  if (days <= 0) return { ok: false, reason: '今天的收益已经领过了' };
  n.last = dayIndex(now);
  if (fish <= 0) return { ok: false, reason: '还没摆家具，先去买一件吧' };
  s.res.fish += fish;
  return { ok: true, fish, days };
}
