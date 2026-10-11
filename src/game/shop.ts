// 商店只处理玩家数据。count 表示购买份数；一份包含 offer.item.count 件道具。
import { SHOP_ITEMS, SHOP_ITEM_READINESS } from '../content/economy';
import { ITEMS } from '../content/items';
import type { ItemDef, ShopItemDef } from '../content/types';
import { addItem, itemCount, removeItem } from './inventory';
import type { PlayerState, Resources } from './state';
import { rollover, track } from './quests';
import { weeklyKey as shopWeeklyKey } from './periods';
export { shopWeeklyKey };

export type ShopId = ShopItemDef['shop'];
export interface ShopState {
  weeklyKey: string;
  bought: Record<string, number>; // 商品 id → 本周购买份数，不是入库件数
}
export interface ShopEntry {
  offer: ShopItemDef;
  item: ItemDef;
  currency: ItemDef;
  available: boolean; // 数据准备状态；余额不足、满仓和限购另由 reason/maxCount 表达
  reason?: string;
  balance: number;
  bought: number;
  remaining: number | null;
  maxCount: number;
}
export type ShopBuyResult = {
  ok: true;
  offerId: string;
  quantity: number;
  item: { id: string; count: number };
  cost: { item: string; count: number };
  remaining: number | null;
} | { ok: false; reason: string };

const ITEM_BY_ID = new Map(ITEMS.map((item) => [item.id, item]));
const OFFER_BY_ID = new Map(SHOP_ITEMS.map((offer) => [offer.id, offer]));
// 仅用于检查原始账本，实际收支仍统一经过 inventory 的 addItem/removeItem。
const RESOURCE_ITEMS = new Map<string, keyof Resources>([
  ['fish', 'fish'], ['bells', 'bells'], ['catnip_small', 'catnip'],
  ['recruit_ticket', 'tickets'], ['yarn_small', 'yarn'],
]);
const validCount = (n: number) => Number.isSafeInteger(n) && n > 0;
const validTime = (now: number) => Number.isFinite(now) && Number.isFinite(new Date(now).getTime());
const fail = (reason: string): { ok: false; reason: string } => ({ ok: false, reason });
const object = (raw: unknown): Record<string, unknown> | null => raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : null;

export function createShopState(now = Date.now()): ShopState {
  return { weeklyKey: shopWeeklyKey(now), bought: {} };
}

/** 旧存档补空账；跨周清零。坏字段只影响对应的商店记录。 */
export function normalizeShopState(raw: unknown, now = Date.now()): ShopState {
  const out = createShopState(now);
  const input = object(raw);
  if (!input || input.weeklyKey !== out.weeklyKey) return out;
  const bought = object(input.bought);
  if (!bought) return out;
  for (const [id, amount] of Object.entries(bought)) {
    const offer = OFFER_BY_ID.get(id);
    if (!offer || typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount > Number.MAX_SAFE_INTEGER) continue;
    const n = Math.min(offer.weeklyLimit ?? Number.MAX_SAFE_INTEGER, Math.floor(amount));
    if (n > 0) out.bought[id] = n;
  }
  return out;
}

function rawAmount(s: PlayerState, id: string): unknown {
  const resource = RESOURCE_ITEMS.get(id);
  return resource ? s.res[resource] : Object.hasOwn(s.inventory.items, id) ? s.inventory.items[id] : 0;
}

function validAmount(s: PlayerState, id: string): boolean {
  const n = rawAmount(s, id);
  // 旧存档的猫薄荷可能按经验折算留下小数，不把它截掉或另开一份库存。
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= Number.MAX_SAFE_INTEGER && (id === 'catnip_small' || Number.isSafeInteger(n));
}

function entryFor(s: PlayerState, offer: ShopItemDef, shop: ShopState): ShopEntry {
  const item = ITEM_BY_ID.get(offer.item.id)!;
  const currency = ITEM_BY_ID.get(offer.price.item)!;
  const available = SHOP_ITEM_READINESS[offer.id] === true;
  const balance = itemCount(s, currency.id);
  const bought = shop.bought[offer.id] ?? 0;
  const remaining = offer.weeklyLimit === undefined ? null : Math.max(0, offer.weeklyLimit - bought);
  const ledgerValid = validAmount(s, currency.id) && validAmount(s, item.id);
  const priceValid = validCount(offer.price.count) && validCount(offer.item.count);
  const affordable = priceValid ? Math.floor(balance / offer.price.count) : 0;
  const room = priceValid ? Math.max(0, Math.floor(((item.stack ?? 9999) - itemCount(s, item.id)) / offer.item.count)) : 0;
  const maxCount = available && ledgerValid && priceValid ? Math.max(0, Math.min(
    remaining ?? Number.MAX_SAFE_INTEGER, affordable, room,
    Math.floor(Number.MAX_SAFE_INTEGER / offer.price.count),
    Math.floor(Number.MAX_SAFE_INTEGER / offer.item.count),
  )) : 0;
  let reason: string | undefined;
  if (!available) reason = '暂未开放';
  else if (!ledgerValid || !priceValid) reason = '账本有一笔没写清，先整理一下再结账';
  else if (remaining === 0) reason = '本周限购已用完，掌柜也要留一点备货时间';
  else if (affordable === 0) reason = balance === 0 && currency.id !== 'fish' && currency.id !== 'bells' ? `${currency.name}暂未获得` : `${currency.name}不够`;
  else if (room === 0) reason = '背包放不下这一份，先腾个窝';
  return {
    offer: { ...offer, item: { ...offer.item }, price: { ...offer.price } },
    item: { ...item }, currency: { ...currency }, available, reason,
    balance, bought, remaining, maxCount,
  };
}

/** 查询不修改玩家：跨周时展示新份额，首次成功购买或读档才写回周记录。 */
export function listShop(s: PlayerState, shopId: ShopId, now = Date.now()): ShopEntry[] {
  const shop = normalizeShopState(s.shop, now);
  return SHOP_ITEMS.filter((offer) => offer.shop === shopId).map((offer) => entryFor(s, offer, shop));
}

/** 同步原子交易；任何失败都保留扣款前的全部玩家状态，包括跨周记录。 */
export function buy(s: PlayerState, offerId: string, count = 1, now = Date.now()): ShopBuyResult {
  const offer = OFFER_BY_ID.get(offerId);
  if (!offer) return fail('柜台上没有这件商品');
  if (!validCount(count)) return fail('购买份数要是正整数，半份猫还没学会打包');
  if (!validTime(now)) return fail('钟上的时间没对好，先别急着结账');
  const shop = normalizeShopState(s.shop, now);
  const entry = entryFor(s, offer, shop);
  if (!entry.available) return fail('暂未开放');
  if (!validAmount(s, offer.price.item) || !validAmount(s, offer.item.id)) return fail('账本有一笔没写清，先整理一下再结账');
  const cost = offer.price.count * count;
  const amount = offer.item.count * count;
  if (!validCount(cost) || !validCount(amount)) return fail('这一单太大，算盘珠子要挤出去了');
  if (entry.remaining !== null && count > entry.remaining) return fail('超过本周剩余限购份数');
  if (entry.balance < cost) return fail(entry.balance === 0 && entry.currency.id !== 'fish' && entry.currency.id !== 'bells' ? `${entry.currency.name}暂未获得` : `${entry.currency.name}不够`);
  if (count > entry.maxCount) return fail(entry.reason ?? '背包放不下这么多，先腾个窝');

  const trial: PlayerState = {
    ...s,
    res: { ...s.res },
    inventory: { ...s.inventory, items: { ...s.inventory.items } },
    shop,
  };
  const paid = removeItem(trial, offer.price.item, cost);
  if (!paid.ok) return paid;
  const received = addItem(trial, offer.item.id, amount);
  if (!received.ok) return received;
  trial.shop.bought[offerId] = entry.bought + count;
  Object.assign(s.res, trial.res);
  s.inventory.items = trial.inventory.items;
  s.shop = trial.shop;
  if (offer.price.item === 'fish') {
    rollover(s, now);
    track(s, 'spend_fish', cost);
  }
  return {
    ok: true, offerId, quantity: count,
    item: { id: offer.item.id, count: amount },
    cost: { item: offer.price.item, count: cost },
    remaining: entry.remaining === null ? null : entry.remaining - count,
  };
}
