// 月光珠商铺：用月光珠兑换养成大件，按周限购；VIP 越高越便宜、限购越多。纯逻辑，时间可注入。
import { addItem } from './inventory';
import { dayIndex, ensurePay, vipLevel } from './premium';
import type { PlayerState } from './state';

export interface MoonOffer { id: string; item: string; count: number; price: number; weekly: number; label: string; tickets?: number }
export const MOON_OFFERS: MoonOffer[] = [
  { id: 'ms_ticket', item: '', count: 1, price: 50, weekly: 10, label: '招福符', tickets: 1 },
  { id: 'ms_catnip', item: 'catnip_large', count: 5, price: 80, weekly: 5, label: '高阶猫薄荷 ×5' },
  { id: 'ms_yarn', item: 'yarn_medium', count: 1, price: 40, weekly: 7, label: '中毛线球' },
  { id: 'ms_bone', item: 'fishbone_large', count: 1, price: 120, weekly: 5, label: '金纹突破鱼骨' },
  { id: 'ms_shard', item: 'hero_shard_ur', count: 3, price: 250, weekly: 2, label: '金冠通用碎片 ×3' },
  { id: 'ms_jade', item: 'awaken_jade', count: 1, price: 300, weekly: 1, label: '九命醒玉' },
  { id: 'ms_chest', item: 'equip_chest_legend', count: 1, price: 400, weekly: 1, label: '九命金铃装备箱' },
];
export interface MoonShopState { week: number; bought: Record<string, number> }
const weekStart = (d: number) => d - ((d + 3) % 7);

export function ensureMoonShop(s: PlayerState, now = Date.now()): MoonShopState {
  const p = ensurePay(s);
  p.moonShop ??= { week: 0, bought: {} };
  const wk = weekStart(dayIndex(now));
  if (p.moonShop.week !== wk) p.moonShop = { week: wk, bought: {} };
  p.moonShop.bought ??= {};
  return p.moonShop;
}
/** VIP 折扣：VIP5 起 -5%，VIP8 -10%，VIP10 -15%，VIP12 -20% */
export const moonDiscount = (vip: number) => (vip >= 12 ? 0.2 : vip >= 10 ? 0.15 : vip >= 8 ? 0.1 : vip >= 5 ? 0.05 : 0);
/** VIP3 起每周限购 +1，VIP8 起 +2（每周限购为 1 的大件不加） */
export const weeklyLimit = (o: MoonOffer, vip: number) => (o.weekly <= 1 ? o.weekly : o.weekly + (vip >= 8 ? 2 : vip >= 3 ? 1 : 0));
export const priceOf = (o: MoonOffer, vip: number) => Math.max(1, Math.round(o.price * (1 - moonDiscount(vip))));
export const leftOf = (s: PlayerState, o: MoonOffer, now = Date.now()) => weeklyLimit(o, vipLevel(s)) - (ensureMoonShop(s, now).bought[o.id] ?? 0);

export function buyMoon(s: PlayerState, id: string, now = Date.now()): { ok: true; paid: number; label: string } | { ok: false; reason: string } {
  const o = MOON_OFFERS.find((x) => x.id === id);
  if (!o) return { ok: false, reason: '没有这件商品' };
  const st = ensureMoonShop(s, now), vip = vipLevel(s), price = priceOf(o, vip);
  if (leftOf(s, o, now) <= 0) return { ok: false, reason: '本周已售罄' };
  if ((s.res.moon ?? 0) < price) return { ok: false, reason: '月光珠不够' };
  if (o.tickets) s.res.tickets += o.tickets * o.count;
  else { const r = addItem(s, o.item, o.count); if (!r.ok) return { ok: false, reason: r.reason ?? '背包放不下了' }; }
  s.res.moon -= price; st.bought[id] = (st.bought[id] ?? 0) + 1;
  return { ok: true, paid: price, label: o.label };
}
