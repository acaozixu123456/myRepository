import { describe, expect, it } from 'vitest';
import { SHOP_ITEMS, SHOP_ITEM_READINESS } from '../src/content/economy';
import { ITEMS } from '../src/content/items';
import { itemCount } from '../src/game/inventory';
import { buy, createShopState, listShop, normalizeShopState, shopWeeklyKey } from '../src/game/shop';
import type { ShopBuyResult, ShopId } from '../src/game/shop';
import { load, newPlayer, save, SAVE_KEY } from '../src/game/state';
import type { PlayerState, StorageLike } from '../src/game/state';

const NOW = new Date(2026, 9, 7, 12).getTime();
const SHOPS: ShopId[] = ['general', 'arena', 'guild', 'tower', 'faction'];
const INVALID_COUNTS = [0, -1, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1];

function richPlayer(now = NOW): PlayerState {
  const s = newPlayer(now);
  s.res.fish = 1_000_000;
  s.res.bells = 1_000_000;
  for (const id of ['paw_seal', 'guild_token', 'tower_token', 'faction_token']) s.inventory.items[id] = 1_000_000;
  return s;
}

function failsWithoutChange(s: PlayerState, operation: () => ShopBuyResult, reason?: string) {
  const before = structuredClone(s);
  const result = operation();
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.reason.length).toBeGreaterThan(0);
    if (reason) expect(result.reason).toContain(reason);
  }
  expect(s).toEqual(before);
}

function memoryStorage(raw?: string): StorageLike {
  const data = new Map<string, string>();
  if (raw !== undefined) data.set(SAVE_KEY, raw);
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); } };
}

describe('shop catalogue and purchasing', () => {
  it('lists all 60 real offers with their exact prices, bundle sizes and readiness', () => {
    const s = richPlayer();
    const before = structuredClone(s);
    const rows = SHOPS.flatMap((shop) => {
      const entries = listShop(s, shop, NOW);
      expect(entries).toHaveLength(12);
      expect(entries.every((entry) => entry.offer.shop === shop)).toBe(true);
      return entries;
    });
    expect(new Set(rows.map((entry) => entry.offer.id)).size).toBe(60);
    for (const row of rows) {
      expect(row.offer).toEqual(SHOP_ITEMS.find((offer) => offer.id === row.offer.id));
      expect(row.item).toEqual(ITEMS.find((item) => item.id === row.offer.item.id));
      expect(row.currency).toEqual(ITEMS.find((item) => item.id === row.offer.price.item));
      expect(row.available).toBe(SHOP_ITEM_READINESS[row.offer.id]);
      expect(row.bought).toBe(0);
      expect(row.remaining).toBe(row.offer.weeklyLimit);
      expect(row.balance).toBe(itemCount(s, row.offer.price.item));
      expect(Number.isSafeInteger(row.maxCount)).toBe(true);
      expect(row.maxCount).toBeGreaterThanOrEqual(0);
    }
    expect(s).toEqual(before);
  });

  it('purchases every ready offer into its real inventory ledger, without opening boxes or converting shards', () => {
    for (const offer of SHOP_ITEMS) {
      const s = richPlayer();
      const currencyBefore = itemCount(s, offer.price.item);
      const stockBefore = itemCount(s, offer.item.id);
      const heroesBefore = structuredClone(s.heroes);
      const equipmentBefore = structuredClone(s.inventory.equipment);
      const result = buy(s, offer.id, 1, NOW);
      if (!SHOP_ITEM_READINESS[offer.id]) {
        expect(result).toEqual({ ok: false, reason: '暂未开放' });
        expect(itemCount(s, offer.price.item)).toBe(currencyBefore);
        expect(s.shop.bought).toEqual({});
        continue;
      }
      expect(result).toEqual({
        ok: true, offerId: offer.id, quantity: 1,
        item: offer.item, cost: offer.price,
        remaining: (offer.weeklyLimit ?? 1) - 1,
      });
      expect(itemCount(s, offer.price.item)).toBe(currencyBefore - offer.price.count);
      expect(itemCount(s, offer.item.id)).toBe(stockBefore + offer.item.count);
      expect(s.shop.bought[offer.id]).toBe(1);
      expect(s.heroes).toEqual(heroesBefore);
      expect(s.inventory.equipment).toEqual(equipmentBefore);
    }
  });

  it('counts purchases in bundles, multiplies price and stock, and preserves fractional legacy catnip', () => {
    const s = richPlayer();
    s.res.catnip = 2.5;
    const offer = SHOP_ITEMS.find((entry) => entry.id === 'general_catnip_small')!;
    const fishBefore = s.res.fish;
    expect(buy(s, offer.id, 3, NOW)).toMatchObject({ ok: true, quantity: 3, item: { count: 30 }, cost: { count: offer.price.count * 3 }, remaining: 11 });
    expect(s.res.fish).toBe(fishBefore - offer.price.count * 3);
    expect(s.res.catnip).toBe(32.5);
    expect(s.inventory.items).not.toHaveProperty('fish');
    expect(s.inventory.items).not.toHaveProperty('catnip_small');
    expect(s.shop.bought[offer.id]).toBe(3);
  });

  it('keeps bells, ordinary tickets and small yarn on their existing resource ledger', () => {
    const s = richPlayer();
    const bells = s.res.bells;
    const tickets = s.res.tickets;
    const yarn = s.res.yarn;
    const ticket = SHOP_ITEMS.find((offer) => offer.id === 'general_recruit_ticket')!;
    const ball = SHOP_ITEMS.find((offer) => offer.id === 'general_yarn_small')!;
    expect(buy(s, ticket.id, 2, NOW).ok).toBe(true);
    expect(buy(s, ball.id, 1, NOW).ok).toBe(true);
    expect(s.res.bells).toBe(bells - ticket.price.count * 2 - ball.price.count);
    expect(s.res.tickets).toBe(tickets + 2);
    expect(s.res.yarn).toBe(yarn + 1);
    for (const id of ['bells', 'recruit_ticket', 'yarn_small']) expect(s.inventory.items).not.toHaveProperty(id);
  });

  it.each(['arena', 'guild', 'tower', 'faction'] as const)('uses the inventory currency for %s, without charging resource balances', (shop) => {
    const s = richPlayer();
    const offer = SHOP_ITEMS.find((entry) => entry.shop === shop && SHOP_ITEM_READINESS[entry.id])!;
    const currency = itemCount(s, offer.price.item);
    const resBefore = structuredClone(s.res);
    expect(buy(s, offer.id, 1, NOW).ok).toBe(true);
    expect(itemCount(s, offer.price.item)).toBe(currency - offer.price.count);
    // 这四个首项都不是旧资源别名。
    expect(s.res).toEqual(resBefore);
  });

  it.each(['arena', 'guild', 'tower', 'faction'] as const)('explains missing %s currency and does not change any player field', (shop) => {
    const s = newPlayer(NOW);
    const offer = SHOP_ITEMS.find((entry) => entry.shop === shop && SHOP_ITEM_READINESS[entry.id])!;
    const row = listShop(s, shop, NOW).find((entry) => entry.offer.id === offer.id)!;
    expect(row.available).toBe(true);
    expect(row.balance).toBe(0);
    expect(row.maxCount).toBe(0);
    expect(row.reason).toContain('暂未获得');
    failsWithoutChange(s, () => buy(s, offer.id, 1, NOW), '暂未获得');
  });

  it('opens the funded Shu ticket after the faction gains its SR candidates', () => {
    const s = richPlayer();
    const row = listShop(s, 'faction', NOW).find((entry) => entry.offer.id === 'faction_recruit_shu')!;
    expect(row.available).toBe(true);
    expect(row.reason).toBeUndefined();
    expect(row.maxCount).toBeGreaterThan(0);
    const before = itemCount(s, row.offer.item.id);
    expect(buy(s, row.offer.id, 1, NOW).ok).toBe(true);
    expect(itemCount(s, row.offer.item.id)).toBe(before + row.offer.item.count);
  });

  it('retains a read-only catalogue even when the returned detail objects are changed', () => {
    const s = richPlayer();
    const before = structuredClone(SHOP_ITEMS[0]);
    const row = listShop(s, 'general', NOW)[0];
    row.offer.price.count = 1;
    row.offer.item.count = 100;
    row.item.name = '另一个名字';
    expect(SHOP_ITEMS[0]).toEqual(before);
    expect(listShop(s, 'general', NOW)[0].offer).toEqual(before);
    expect(listShop(s, 'general', NOW)[0].item.name).not.toBe('另一个名字');
  });
});

describe('shop atomic failures and purchase limits', () => {
  it('rejects insufficient fish or bells without touching stock, quota or unrelated fields', () => {
    for (const id of ['general_catnip_small', 'general_recruit_ticket']) {
      const s = richPlayer();
      const offer = SHOP_ITEMS.find((entry) => entry.id === id)!;
      if (offer.price.item === 'fish') s.res.fish = offer.price.count - 1;
      else s.res.bells = offer.price.count - 1;
      failsWithoutChange(s, () => buy(s, id, 1, NOW), '不够');
    }
  });

  it.each(INVALID_COUNTS)('rejects invalid bundle count %s atomically', (count) => {
    const s = richPlayer();
    failsWithoutChange(s, () => buy(s, 'general_catnip_small', count, NOW));
  });

  it.each(['missing', 'catnip_small', '__proto__', 'constructor', 'toString'])('rejects unknown offer id %s atomically', (id) => {
    const s = richPlayer();
    failsWithoutChange(s, () => buy(s, id, 1, NOW));
  });

  it('rejects overflowing transaction totals and invalid clocks atomically', () => {
    const s = richPlayer();
    failsWithoutChange(s, () => buy(s, 'general_catnip_small', Number.MAX_SAFE_INTEGER, NOW));
    for (const now of [NaN, Infinity, Number.MAX_SAFE_INTEGER]) failsWithoutChange(s, () => buy(s, 'general_catnip_small', 1, now));
  });

  it('shares the current weekly quota across consecutive buys and rejects a stale larger order', () => {
    const s = richPlayer();
    const id = 'general_catnip_medium';
    expect(buy(s, id, 6, NOW).ok).toBe(true);
    const row = listShop(s, 'general', NOW).find((entry) => entry.offer.id === id)!;
    expect(row).toMatchObject({ bought: 6, remaining: 1, maxCount: 1 });
    failsWithoutChange(s, () => buy(s, id, 2, NOW), '限购');
    expect(buy(s, id, 1, NOW).ok).toBe(true);
    const soldOut = listShop(s, 'general', NOW).find((entry) => entry.offer.id === id)!;
    expect(soldOut).toMatchObject({ available: true, bought: 7, remaining: 0, maxCount: 0 });
    failsWithoutChange(s, () => buy(s, id, 1, NOW), '限购');
  });

  it('caps the maximum by affordability, quota and remaining inventory space', () => {
    const s = richPlayer();
    const id = 'general_catnip_medium';
    const offer = SHOP_ITEMS.find((entry) => entry.id === id)!;
    s.res.fish = offer.price.count * 2;
    expect(listShop(s, 'general', NOW).find((entry) => entry.offer.id === id)!.maxCount).toBe(2);
    s.res.fish = 1_000_000;
    s.inventory.items.catnip_medium = 9994;
    expect(listShop(s, 'general', NOW).find((entry) => entry.offer.id === id)!.maxCount).toBe(1);
    failsWithoutChange(s, () => buy(s, id, 2, NOW), '放不下');
    expect(buy(s, id, 1, NOW).ok).toBe(true);
    expect(itemCount(s, 'catnip_medium')).toBe(9999);
    failsWithoutChange(s, () => buy(s, id, 1, NOW), '放不下');
  });

  it('respects chest stack caps and fractional catnip space without rounding the legacy resource', () => {
    const s = richPlayer();
    const chest = 'general_equip_chest_rare';
    s.inventory.items.equip_chest_rare = 999;
    failsWithoutChange(s, () => buy(s, chest, 1, NOW), '放不下');
    s.res.catnip = 9978.5;
    expect(listShop(s, 'general', NOW).find((entry) => entry.offer.id === 'general_catnip_small')!.maxCount).toBe(2);
    expect(buy(s, 'general_catnip_small', 2, NOW).ok).toBe(true);
    expect(s.res.catnip).toBe(9998.5);
    failsWithoutChange(s, () => buy(s, 'general_catnip_small', 1, NOW), '放不下');
  });

  it.each([-1, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1])('refuses a corrupt currency balance %s without treating it as zero or repairing it', (amount) => {
    const s = richPlayer();
    s.res.fish = amount;
    failsWithoutChange(s, () => buy(s, 'general_catnip_small', 1, NOW), '账本');
    const other = richPlayer();
    other.inventory.items.paw_seal = amount;
    failsWithoutChange(other, () => buy(other, 'arena_catnip_medium', 1, NOW), '账本');
  });

  it.each([-1, NaN, Infinity, 0.5])('refuses corrupt reward stock %s without charging money', (amount) => {
    const s = richPlayer();
    s.inventory.items.catnip_medium = amount;
    failsWithoutChange(s, () => buy(s, 'general_catnip_medium', 1, NOW), '账本');
  });
});

describe('shop weekly rollover and saved state', () => {
  it('changes the local week exactly at Monday 05:00', () => {
    const before = new Date(2026, 9, 12, 4, 59, 59, 999).getTime();
    const boundary = new Date(2026, 9, 12, 5).getTime();
    expect(shopWeeklyKey(before)).toBe('2026-10-05');
    expect(shopWeeklyKey(boundary)).toBe('2026-10-12');
    expect(shopWeeklyKey(new Date(2026, 9, 18, 23, 59).getTime())).toBe('2026-10-12');
    const s = richPlayer(before);
    const id = 'general_catnip_medium';
    expect(buy(s, id, 7, before).ok).toBe(true);
    const old = structuredClone(s);
    expect(listShop(s, 'general', boundary).find((entry) => entry.offer.id === id)!).toMatchObject({ bought: 0, remaining: 7 });
    expect(s).toEqual(old);
    expect(buy(s, id, 1, boundary).ok).toBe(true);
    expect(s.shop).toEqual({ weeklyKey: '2026-10-12', bought: { [id]: 1 } });
  });

  it('keeps calendar rollover correct in a zone with daylight-saving changes', () => {
    const previous = process.env.TZ;
    try {
      process.env.TZ = 'America/New_York';
      expect(new Date(2026, 2, 7, 12).getTimezoneOffset()).toBe(300);
      expect(new Date(2026, 2, 8, 12).getTimezoneOffset()).toBe(240);
      expect(new Date(2026, 9, 31, 12).getTimezoneOffset()).toBe(240);
      expect(new Date(2026, 10, 1, 12).getTimezoneOffset()).toBe(300);
      // 春秋周日发生换钟；下一周仍以当地周一五点换周。
      for (const [month, monday, oldKey, newKey] of [[2, 9, '2026-03-02', '2026-03-09'], [10, 2, '2026-10-26', '2026-11-02']] as const) {
        expect(shopWeeklyKey(new Date(2026, month, monday, 4, 59).getTime())).toBe(oldKey);
        expect(shopWeeklyKey(new Date(2026, month, monday, 5).getTime())).toBe(newKey);
      }
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });

  it('keeps old weekly state unchanged when the first buy of a new week fails', () => {
    const nextWeek = new Date(2026, 9, 12, 5).getTime();
    const s = richPlayer();
    expect(buy(s, 'general_catnip_small', 1, NOW).ok).toBe(true);
    s.res.fish = 0;
    failsWithoutChange(s, () => buy(s, 'general_catnip_small', 1, nextWeek), '不够');
    expect(s.shop.weeklyKey).toBe('2026-10-05');
  });

  it('adds only the shop field to an old v1 save and retains player progress and resources', () => {
    const original = richPlayer();
    original.name = '纸箱掌柜';
    original.best = { chapter: 2, index: 3 };
    original.inventory.items.bell_thread = 5;
    const old = { ...original } as Partial<PlayerState>;
    delete old.shop;
    const restored = load(memoryStorage(JSON.stringify(old)), NOW);
    expect(restored).toEqual({ ...original, shop: createShopState(NOW) });
    expect(restored.v).toBe(1);
    expect(restored.inventory.v).toBe(1);
  });

  it('persists purchased bundles on same-week reload and resets only shop counters next week', () => {
    const s = richPlayer();
    expect(buy(s, 'general_recruit_ticket', 3, NOW).ok).toBe(true);
    const storage = memoryStorage();
    save(storage, s);
    expect(load(storage, NOW)).toEqual(s);
    const next = new Date(2026, 9, 12, 5).getTime();
    expect(load(storage, next)).toEqual({ ...s, shop: createShopState(next) });
  });

  it('repairs only bad shop fields and retains valid known weekly counters', () => {
    const weeklyKey = shopWeeklyKey(NOW);
    const damaged = {
      weeklyKey,
      bought: {
        general_catnip_small: 3.9, general_catnip_medium: 999999,
        general_catnip_large: -1, general_fishbone_small: NaN,
        general_fishbone_medium: '2', unknown: 8, constructor: 2,
      },
    };
    expect(normalizeShopState(damaged, NOW)).toEqual({ weeklyKey, bought: { general_catnip_small: 3, general_catnip_medium: 7 } });
    for (const raw of [undefined, null, [], 'bad', { weeklyKey, bought: [] }, { weeklyKey: '2026-09-28', bought: { general_catnip_small: 3 } }]) {
      expect(normalizeShopState(raw, NOW)).toEqual(createShopState(NOW));
    }
    const s = richPlayer();
    const broken = { ...s, shop: damaged };
    const restored = load(memoryStorage(JSON.stringify(broken)), NOW);
    expect(restored).toEqual({ ...s, shop: normalizeShopState(damaged, NOW) });
  });
});
