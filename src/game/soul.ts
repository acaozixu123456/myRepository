// 星魂：★5 满星之后继续抽到的重复碎片不再浪费——用来点亮「星魂」，每级给英雄全属性小幅加成。
// 设计：最高 20 级、每级 +1% 生命 / 攻击 / 防御（满级 +20%，低于 4 个星级的 +32%，不会盖过升星）；
// 每 5 级一枚魂印（铜 / 银 / 金 / 虹），用来在界面上炫耀。加成同时进入「显示战力」与「实战属性」（见 state.heroStats / stage.lineupSetups）。
import type { Rarity } from '../data/heroes';

export const SOUL_MAX = 20;
export const SOUL_PER = 0.01;
const SOUL_BASE: Record<Rarity, number> = { SR: 8, SSR: 16, UR: 30, SP: 80 };
export const SOUL_MARKS = [
  { at: 5, name: '铜魂印', emoji: '🥉' },
  { at: 10, name: '银魂印', emoji: '🥈' },
  { at: 15, name: '金魂印', emoji: '🥇' },
  { at: 20, name: '虹魂印', emoji: '🌈' },
] as const;

export interface SoulHero { star: number; shards: number; soul?: number }

export const soulOf = (h: { soul?: number }) => Math.min(SOUL_MAX, Math.max(0, h.soul ?? 0));
/** 属性倍率（乘在 levelMul × starMul × affMul 之上） */
export const soulMul = (h: { soul?: number }) => 1 + soulOf(h) * SOUL_PER;
/** 从 n 级升到 n+1 级要的碎片 */
export const soulCost = (n: number, rarity: Rarity) => Math.round(SOUL_BASE[rarity] * (1 + 0.15 * n));
/** 当前已点亮的最高魂印 */
export const soulMark = (h: { soul?: number }) => [...SOUL_MARKS].reverse().find((m) => soulOf(h) >= m.at) ?? null;

export function soulUp(h: SoulHero, rarity: Rarity): { ok: true } | { ok: false; reason: string } {
  if (h.star < 5) return { ok: false, reason: '★5 满星后才能点亮星魂' };
  const lv = soulOf(h);
  if (lv >= SOUL_MAX) return { ok: false, reason: '星魂已满' };
  const need = soulCost(lv, rarity);
  if (h.shards < need) return { ok: false, reason: `碎片不够（${h.shards}/${need}）` };
  h.shards -= need;
  h.soul = lv + 1;
  return { ok: true };
}
