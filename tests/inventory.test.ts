import { describe, expect, it } from 'vitest';
import { EQUIPS, EQUIP_QUALITIES, EQUIP_SLOTS } from '../src/content/equipment';
import { ITEMS } from '../src/content/items';
import {
  addEquipment, addItem, createInventory, enhanceCost, enhanceEquipment, equipmentStats,
  equipEquipment, equippedSetCounts, itemCount, normalizeInventory, removeEquipment,
  removeItem, seedDemoInventory, unequipEquipment, useYarn, YARN_MINUTES,
} from '../src/game/inventory';
import { idleRate } from '../src/game/stage';
import { equip, load, newPlayer, save, SAVE_KEY, unequip } from '../src/game/state';
import type { OpResult, PlayerState, Resources, StorageLike } from '../src/game/state';

const HERO_A = 'wei_guojia';
const HERO_B = 'man_wutugu';
const INVALID_COUNTS = [0, -1, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1];

function failsWithoutChange(s: PlayerState, operation: () => OpResult) {
  const before = structuredClone(s);
  const result = operation();
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.reason).toEqual(expect.any(String));
  expect(s).toEqual(before);
}

function addPiece(s: PlayerState, equipId = 'camp_common_weapon') {
  const result = addEquipment(s, equipId);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.reason);
  expect(result.uids).toHaveLength(1);
  return result.uids[0];
}

function piece(s: PlayerState, uid: string) {
  const found = s.inventory.equipment.find((entry) => entry.uid === uid);
  expect(found).toBeDefined();
  if (!found) throw new Error(`Missing equipment instance ${uid}`);
  return found;
}

function memoryStorage(raw?: string): StorageLike {
  const memory = new Map<string, string>();
  if (raw !== undefined) memory.set(SAVE_KEY, raw);
  return {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => { memory.set(key, value); },
  };
}

describe('inventory item quantities', () => {
  it('starts empty and gives each player independent storage', () => {
    const first = createInventory();
    const second = createInventory();
    expect(first).toMatchObject({ v: 1, items: {}, equipment: [] });
    expect(Number.isSafeInteger(first.nextUid)).toBe(true);
    expect(first.nextUid).toBeGreaterThan(0);
    first.items.bell_thread = 3;
    first.nextUid++;
    expect(second.items).toEqual({});
    expect(second.nextUid).toBe(first.nextUid - 1);
    expect(newPlayer(1000).inventory).toEqual(createInventory());
  });

  it('adds and removes ordinary stock without letting a count go negative', () => {
    const s = newPlayer(1000);
    expect(itemCount(s, 'bell_thread')).toBe(0);
    expect(addItem(s, 'bell_thread', 3).ok).toBe(true);
    expect(itemCount(s, 'bell_thread')).toBe(3);
    expect(removeItem(s, 'bell_thread', 2).ok).toBe(true);
    expect(itemCount(s, 'bell_thread')).toBe(1);
    failsWithoutChange(s, () => removeItem(s, 'bell_thread', 2));
    expect(removeItem(s, 'bell_thread', 1).ok).toBe(true);
    expect(itemCount(s, 'bell_thread')).toBe(0);
    failsWithoutChange(s, () => removeItem(s, 'bell_thread', 1));
  });

  it.each([
    ['fish', 'fish'], ['bells', 'bells'], ['catnip_small', 'catnip'],
    ['recruit_ticket', 'tickets'], ['yarn_small', 'yarn'],
  ] as const)('uses existing resources as the sole quantity for %s', (itemId, resource) => {
    const s = newPlayer(1000);
    const before = structuredClone(s.res);
    expect(itemCount(s, itemId)).toBe(before[resource]);
    expect(addItem(s, itemId, 2).ok).toBe(true);
    expect(s.res[resource]).toBe(before[resource] + 2);
    expect(itemCount(s, itemId)).toBe(before[resource] + 2);
    expect(s.inventory.items).not.toHaveProperty(itemId);
    expect(removeItem(s, itemId, 2).ok).toBe(true);
    expect(s.res).toEqual(before);
    expect(s.inventory.items).not.toHaveProperty(itemId);
    failsWithoutChange(s, () => removeItem(s, itemId, before[resource] + 1));
  });

  it('preserves fractional catnip already earned by the existing reward logic', () => {
    const s = newPlayer(1000);
    s.res.catnip = 12.5;
    expect(itemCount(s, 'catnip_small')).toBe(12.5);
    expect(removeItem(s, 'catnip_small', 12).ok).toBe(true);
    expect(s.res.catnip).toBe(0.5);
    failsWithoutChange(s, () => removeItem(s, 'catnip_small', 1));
    expect(addItem(s, 'catnip_small', 2).ok).toBe(true);
    expect(s.res.catnip).toBe(2.5);
  });

  it('rejects invalid counts atomically for both resource aliases and ordinary stock', () => {
    const s = newPlayer(1000);
    expect(addItem(s, 'bell_thread', 3).ok).toBe(true);
    for (const count of INVALID_COUNTS) {
      for (const id of ['bell_thread', 'fish', 'yarn_small']) {
        failsWithoutChange(s, () => addItem(s, id, count));
        failsWithoutChange(s, () => removeItem(s, id, count));
      }
    }
  });

  it('rejects unknown IDs, including inherited object property names', () => {
    const s = newPlayer(1000);
    for (const id of ['missing_item', '__proto__', 'constructor', 'toString']) {
      expect(itemCount(s, id)).toBe(0);
      failsWithoutChange(s, () => addItem(s, id, 1));
      failsWithoutChange(s, () => removeItem(s, id, 1));
    }
  });

  it.each(['bell_thread', 'equip_chest_rare', 'paw_seal', 'fish', 'catnip_small'])
  ('accepts the exact stack limit and rejects a whole overflowing addition for %s', (id) => {
    const s = newPlayer(1000);
    const definition = ITEMS.find((item) => item.id === id)!;
    const limit = definition.stack ?? 9999;
    if (id === 'fish') s.res.fish = 0;
    if (id === 'catnip_small') s.res.catnip = 0;
    expect(addItem(s, id, limit - 1).ok).toBe(true);
    failsWithoutChange(s, () => addItem(s, id, 2));
    expect(addItem(s, id, 1).ok).toBe(true);
    expect(itemCount(s, id)).toBe(limit);
    failsWithoutChange(s, () => addItem(s, id, 1));
  });
});

describe('equipment instances and wearing', () => {
  it('gives copies of the same equipment independent IDs and enhancement levels', () => {
    const s = newPlayer(1000);
    const result = addEquipment(s, 'camp_common_weapon', 3);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.uids).toHaveLength(3);
    expect(new Set(result.uids).size).toBe(3);
    expect(s.inventory.equipment.map((entry) => entry.level)).toEqual([1, 1, 1]);
    expect(enhanceEquipment(s, result.uids[0]).ok).toBe(true);
    expect(piece(s, result.uids[0]).level).toBe(2);
    expect(piece(s, result.uids[1]).level).toBe(1);
    expect(piece(s, result.uids[2]).level).toBe(1);
    expect(removeEquipment(s, result.uids[1]).ok).toBe(true);
    expect(s.inventory.equipment.map((entry) => entry.uid)).toEqual([result.uids[0], result.uids[2]]);
    expect(addPiece(s)).not.toBe(result.uids[1]);
  });

  it('rejects invalid equipment counts and unknown definitions atomically', () => {
    const s = newPlayer(1000);
    addPiece(s);
    for (const count of INVALID_COUNTS) {
      failsWithoutChange(s, () => addEquipment(s, 'camp_common_weapon', count));
    }
    for (const id of ['missing_equipment', '__proto__', 'constructor']) {
      failsWithoutChange(s, () => addEquipment(s, id, 1));
    }
  });

  it('transfers one instance between heroes and automatically removes a previous same-slot piece', () => {
    const s = newPlayer(1000);
    const first = addPiece(s);
    const replacement = addPiece(s, 'camp_fine_weapon');
    const armor = addPiece(s, 'camp_common_armor');
    const lineup = s.lineup.slice();
    expect(equipEquipment(s, first, HERO_A).ok).toBe(true);
    expect(equipEquipment(s, first, HERO_B).ok).toBe(true);
    expect(piece(s, first).heroId).toBe(HERO_B);
    expect(s.inventory.equipment.filter((entry) => entry.heroId === HERO_A)).toHaveLength(0);
    expect(equipEquipment(s, replacement, HERO_B).ok).toBe(true);
    expect(piece(s, first).heroId).toBeUndefined();
    expect(piece(s, replacement).heroId).toBe(HERO_B);
    expect(equipEquipment(s, armor, HERO_B).ok).toBe(true);
    expect(s.inventory.equipment.filter((entry) => entry.heroId === HERO_B)).toHaveLength(2);
    expect(s.lineup).toEqual(lineup);
    expect(unequipEquipment(s, replacement).ok).toBe(true);
    expect(piece(s, replacement).heroId).toBeUndefined();
    expect(piece(s, armor).heroId).toBe(HERO_B);
  });

  it('refuses deletion while worn and rejects missing instances or unowned wearers without change', () => {
    const s = newPlayer(1000);
    const uid = addPiece(s);
    expect(equipEquipment(s, uid, HERO_A).ok).toBe(true);
    failsWithoutChange(s, () => removeEquipment(s, uid));
    for (const heroId of ['unknown_hero', 'wei_caomiaode', 'constructor']) {
      failsWithoutChange(s, () => equipEquipment(s, uid, heroId));
    }
    failsWithoutChange(s, () => equipEquipment(s, 'missing_uid', HERO_A));
    failsWithoutChange(s, () => unequipEquipment(s, 'missing_uid'));
    failsWithoutChange(s, () => removeEquipment(s, 'missing_uid'));
    failsWithoutChange(s, () => enhanceEquipment(s, 'missing_uid'));
    expect(unequipEquipment(s, uid).ok).toBe(true);
    expect(removeEquipment(s, uid).ok).toBe(true);
    expect(s.inventory.equipment).toHaveLength(0);
  });

  it('keeps hero lineup equip/unequip semantics independent of wearing equipment', () => {
    const s = newPlayer(1000);
    const uid = addPiece(s);
    expect(equipEquipment(s, uid, HERO_A).ok).toBe(true);
    expect(unequip(s, HERO_A).ok).toBe(true);
    expect(s.lineup[3]).toBeNull();
    expect(piece(s, uid).heroId).toBe(HERO_A);
    expect(equip(s, HERO_A).ok).toBe(true);
    expect(s.lineup[3]).toBe(HERO_A);
    failsWithoutChange(s, () => equip(s, HERO_A));
    expect(unequip(s, HERO_A).ok).toBe(true);
    expect(equip(s, HERO_A, 0).ok).toBe(true);
    expect(s.lineup[0]).toBe(HERO_A);
    expect(piece(s, uid).heroId).toBe(HERO_A);
    s.lineup = [HERO_A, null, null, null, null];
    failsWithoutChange(s, () => unequip(s, HERO_A));
    expect(unequipEquipment(s, uid).ok).toBe(true);
    expect(s.lineup).toEqual([HERO_A, null, null, null, null]);
  });

  it('counts only worn pieces of each set for each hero', () => {
    const s = newPlayer(1000);
    const uids = EQUIP_SLOTS.map((slot) => addPiece(s, `wei_tiger_guard_${slot}`));
    addPiece(s, 'wei_tiger_guard_weapon');
    expect(equippedSetCounts(s, HERO_A)).toEqual({});
    for (const uid of uids) expect(equipEquipment(s, uid, HERO_A).ok).toBe(true);
    expect(equippedSetCounts(s, HERO_A)).toEqual({ wei_tiger_guard: 4 });
    expect(equippedSetCounts(s, HERO_B)).toEqual({});
    expect(equipEquipment(s, uids[0], HERO_B).ok).toBe(true);
    expect(equippedSetCounts(s, HERO_A)).toEqual({ wei_tiger_guard: 3 });
    expect(equippedSetCounts(s, HERO_B)).toEqual({ wei_tiger_guard: 1 });
    const genericArmor = addPiece(s, 'camp_common_armor');
    expect(equipEquipment(s, genericArmor, HERO_A).ok).toBe(true);
    expect(equippedSetCounts(s, HERO_A)).toEqual({ wei_tiger_guard: 2 });
  });
});

describe('equipment enhancement', () => {
  it.each(EQUIP_QUALITIES)('charges actual fish up to the %s level cap and never beyond it', (quality) => {
    const s = newPlayer(1000);
    const definition = EQUIPS.find((entry) => entry.quality === quality)!;
    const uid = addPiece(s, definition.id);
    const instance = piece(s, uid);
    const firstCost = { common: 40, fine: 80, rare: 120, epic: 160, legend: 200 }[quality];
    s.res.fish = 1_000_000;
    expect(equipmentStats(instance)).toEqual(definition.base);
    for (let level = 1; level < definition.levelCap; level++) {
      const beforeFish = s.res.fish;
      expect(instance.level).toBe(level);
      expect(enhanceCost(instance)).toBe(firstCost * level);
      expect(enhanceEquipment(s, uid).ok).toBe(true);
      expect(instance.level).toBe(level + 1);
      expect(s.res.fish).toBe(beforeFish - firstCost * level);
    }
    expect(enhanceCost(instance)).toBe(0);
    failsWithoutChange(s, () => enhanceEquipment(s, uid));
    expect(instance.level).toBe(definition.levelCap);
  });

  it('does not charge an unaffordable enhancement and allows one with exactly enough fish', () => {
    const s = newPlayer(1000);
    const uid = addPiece(s, 'wei_tiger_guard_weapon');
    s.res.fish = 199;
    failsWithoutChange(s, () => enhanceEquipment(s, uid));
    s.res.fish = 200;
    expect(equipEquipment(s, uid, HERO_A).ok).toBe(true);
    expect(enhanceEquipment(s, uid).ok).toBe(true);
    expect(s.res.fish).toBe(0);
    expect(piece(s, uid)).toMatchObject({ level: 2, heroId: HERO_A });
    expect(enhanceCost(piece(s, uid))).toBe(400);
    failsWithoutChange(s, () => enhanceEquipment(s, uid));
  });

  it('adds per-level absolute and percentage growth without mutating catalog definitions', () => {
    const s = newPlayer(1000);
    const uid = addPiece(s, 'camp_common_weapon');
    const definition = EQUIPS.find((entry) => entry.id === 'camp_common_weapon')!;
    const original = structuredClone(definition);
    expect(equipmentStats(piece(s, uid))).toEqual({ atk: 12, crit: 0.008 });
    expect(enhanceEquipment(s, uid).ok).toBe(true);
    expect(enhanceEquipment(s, uid).ok).toBe(true);
    const stats = equipmentStats(piece(s, uid));
    expect(stats.atk).toBeCloseTo(13.44, 6);
    expect(stats.crit).toBeCloseTo(0.00896, 6);
    expect(definition).toEqual(original);
    const empty = addPiece(s, 'camp_common_weapon');
    expect(equipmentStats(piece(s, empty))).toEqual({ atk: 12, crit: 0.008 });
  });
});

describe('inventory save compatibility and repair', () => {
  it('loads an old save with an empty inventory while preserving the rest of the player', () => {
    const s = newPlayer(1000);
    s.name = '木箱掌柜';
    s.res = { fish: 777, bells: 888, catnip: 12.5, exp: 999, tickets: 4, yarn: 7 };
    s.heroes[HERO_A] = { ...s.heroes[HERO_A], lv: 19, shards: 23, skillLv: 4 };
    s.lineup = [HERO_A, null, HERO_B, null, 'wu_huanggai'];
    s.stage = { chapter: 3, index: 7, wins: 11 };
    s.best = { chapter: 4, index: 2 };
    s.idle = { last: 555, fish: 44.5, exp: 33.25 };
    const legacy = structuredClone(s) as unknown as Record<string, unknown>;
    delete legacy.inventory;
    const loaded = load(memoryStorage(JSON.stringify(legacy)), 9999);
    expect(loaded).toEqual({ ...s, inventory: createInventory() });
    expect(itemCount(loaded, 'catnip_small')).toBe(12.5);
    expect(itemCount(loaded, 'yarn_small')).toBe(7);
  });

  it('round-trips stock, independent equipment levels, wearers, and the UID allocator', () => {
    const s = newPlayer(1000);
    expect(addItem(s, 'bell_thread', 7).ok).toBe(true);
    expect(addItem(s, 'yarn_medium', 2).ok).toBe(true);
    const worn = addPiece(s);
    const spare = addPiece(s);
    expect(enhanceEquipment(s, worn).ok).toBe(true);
    expect(equipEquipment(s, worn, HERO_A).ok).toBe(true);
    const storage = memoryStorage();
    save(storage, s);
    const loaded = load(storage, 8888);
    expect(loaded).toEqual(s);
    expect(piece(loaded, worn)).toMatchObject({ level: 2, heroId: HERO_A });
    expect(piece(loaded, spare)).toMatchObject({ level: 1 });
    expect(piece(loaded, spare).heroId).toBeUndefined();
    const oldUids = s.inventory.equipment.map((entry) => entry.uid);
    expect(oldUids).not.toContain(addPiece(loaded));
    expect(s.inventory.equipment).toHaveLength(2);
  });

  it('drops duplicate resource aliases from stored items instead of granting them twice', () => {
    const s = newPlayer(1000);
    const raw = { ...createInventory(), items: { fish: 100, bells: 100, catnip_small: 100,
      recruit_ticket: 100, yarn_small: 100, bell_thread: 4 } };
    const storage = memoryStorage(JSON.stringify({ ...s, inventory: raw }));
    const loaded = load(storage, 9999);
    expect(loaded.res).toEqual(s.res);
    expect(loaded.inventory.items).toEqual({ bell_thread: 4 });
    expect(itemCount(loaded, 'fish')).toBe(s.res.fish);
    expect(itemCount(loaded, 'catnip_small')).toBe(s.res.catnip);
    expect(itemCount(loaded, 'yarn_small')).toBe(s.res.yarn);
  });

  it('repairs damaged inventory entries while retaining valid stock and equipment', () => {
    const s = newPlayer(1000);
    const uid = addPiece(s);
    expect(enhanceEquipment(s, uid).ok).toBe(true);
    expect(equipEquipment(s, uid, HERO_A).ok).toBe(true);
    const valid = structuredClone(piece(s, uid));
    const raw = {
      v: 1, nextUid: -4,
      items: { bell_thread: 7, catnip_medium: 3.8, equip_chest_rare: 10000,
        fishbone_small: -3, awaken_jade: Infinity, missing_item: 5, fish: 999 },
      equipment: [
        valid,
        { ...valid, equipId: 'camp_fine_armor', level: 999 },
        { uid: '', equipId: 'camp_rare_weapon', level: 0, heroId: HERO_A },
        { uid: 3, equipId: 'camp_epic_head', level: 1.5, heroId: 'unknown_hero' },
        { uid: 'bad-level', equipId: 'wei_tiger_guard_charm', level: NaN, heroId: HERO_B },
        { uid: 'bad-definition', equipId: 'missing_equipment', level: 1 }, null,
      ],
    };
    s.inventory = normalizeInventory(raw, s.heroes);
    expect(s.inventory.items.bell_thread).toBe(7);
    expect(s.inventory.items.catnip_medium).toBe(3);
    expect(s.inventory.items.equip_chest_rare).toBe(999);
    expect(itemCount(s, 'fishbone_small')).toBe(0);
    expect(itemCount(s, 'awaken_jade')).toBe(0);
    expect(s.inventory.items).not.toHaveProperty('missing_item');
    expect(s.inventory.items).not.toHaveProperty('fish');
    expect(piece(s, uid)).toEqual(valid);
    expect(s.inventory.equipment).toHaveLength(5);
    expect(new Set(s.inventory.equipment.map((entry) => entry.uid)).size).toBe(5);
    const wearerSlots = new Set<string>();
    for (const instance of s.inventory.equipment) {
      const definition = EQUIPS.find((entry) => entry.id === instance.equipId)!;
      expect(definition).toBeDefined();
      expect(instance.uid).toEqual(expect.any(String));
      expect(instance.uid.length).toBeGreaterThan(0);
      expect(Number.isSafeInteger(instance.level)).toBe(true);
      expect(instance.level).toBeGreaterThanOrEqual(1);
      expect(instance.level).toBeLessThanOrEqual(definition.levelCap);
      if (instance.heroId) {
        expect(s.heroes[instance.heroId]).toBeDefined();
        const slot = `${instance.heroId}:${definition.slot}`;
        expect(wearerSlots.has(slot)).toBe(false);
        wearerSlots.add(slot);
      }
    }
    expect(s.inventory.equipment.find((entry) => entry.equipId === 'camp_rare_weapon')?.heroId).toBeUndefined();
    expect(s.inventory.equipment.find((entry) => entry.equipId === 'camp_epic_head')?.heroId).toBeUndefined();
    const restoredUids = s.inventory.equipment.map((entry) => entry.uid);
    expect(restoredUids).not.toContain(addPiece(s));
  });

  it.each([null, [], 'damaged inventory', { items: null, equipment: 42 }])
  ('does not discard an otherwise valid save when inventory is malformed: %j', (inventory) => {
    const s = newPlayer(1000);
    s.res.fish = 777;
    s.heroes[HERO_A].shards = 19;
    s.lineup = [HERO_A, HERO_B, null, null, null];
    const loaded = load(memoryStorage(JSON.stringify({ ...s, inventory })), 9999);
    expect(loaded.res).toEqual(s.res);
    expect(loaded.heroes).toEqual(s.heroes);
    expect(loaded.lineup).toEqual(s.lineup);
    expect(loaded.idle).toEqual(s.idle);
    expect(loaded.inventory).toEqual(createInventory());
  });

  it('preserves the rest of a valid saved player when only some inventory entries are corrupt', () => {
    const s = newPlayer(1000);
    s.name = '暖窝掌柜';
    s.res.fish = 777;
    s.heroes[HERO_A].shards = 19;
    const uid = addPiece(s);
    expect(equipEquipment(s, uid, HERO_A).ok).toBe(true);
    const inventory = {
      ...structuredClone(s.inventory),
      items: { bell_thread: 5, yarn_medium: 'bad', missing_item: 2 },
      equipment: [piece(s, uid), { uid: 'bad', equipId: 'unknown', level: 1 }],
    };
    const loaded = load(memoryStorage(JSON.stringify({ ...s, inventory })), 9999);
    expect({ ...loaded, inventory: undefined }).toEqual({ ...s, inventory: undefined });
    expect(loaded.inventory.items).toEqual({ bell_thread: 5 });
    expect(loaded.inventory.equipment).toEqual(s.inventory.equipment);
  });

  it('drops non-string equipment IDs without resetting an otherwise valid saved player', () => {
    const s = newPlayer(1000);
    s.res.fish = 777;
    s.heroes[HERO_A] = { ...s.heroes[HERO_A], lv: 19, shards: 23 };
    s.stage = { chapter: 2, index: 5, wins: 7 };
    s.best = { chapter: 3, index: 2 };
    const uid = addPiece(s);
    expect(equipEquipment(s, uid, HERO_A).ok).toBe(true);
    const inventory = {
      ...structuredClone(s.inventory),
      equipment: [...s.inventory.equipment, { uid: 'eq_2', equipId: { toString: 1 }, level: 1 }],
    };
    const loaded = load(memoryStorage(JSON.stringify({ ...s, inventory })), 9999);
    expect(loaded.res.fish).toBe(777);
    expect(loaded.heroes).toEqual(s.heroes);
    expect(loaded.stage).toEqual(s.stage);
    expect(loaded.inventory.equipment).toEqual(s.inventory.equipment);
    expect(loaded).toEqual(s);
  });

  it('keeps a later valid UID when an earlier damaged entry needs a new one', () => {
    const s = newPlayer(1000);
    const raw = {
      v: 1, nextUid: 1, items: {},
      equipment: [
        { uid: '', equipId: 'camp_common_armor', level: 1 },
        { uid: 'eq_1', equipId: 'camp_common_weapon', level: 4, heroId: HERO_A },
      ],
    };
    s.inventory = normalizeInventory(raw, s.heroes);
    expect(piece(s, 'eq_1')).toEqual(raw.equipment[1]);
    expect(s.inventory.equipment[0].uid).not.toBe('eq_1');
    const existing = s.inventory.equipment.map((entry) => entry.uid);
    expect(existing).not.toContain(addPiece(s));
  });
});

describe('yarn immediate idle gains', () => {
  it('defines the three documented time amounts', () => {
    expect(YARN_MINUTES).toMatchObject({ yarn_small: 60, yarn_medium: 120, yarn_large: 240 });
  });

  it.each([
    ['yarn_small', 60, 1, 1], ['yarn_medium', 120, 3, 5], ['yarn_large', 240, 6, 24],
  ] as const)('consumes %s for current-stage gains without changing stored idle or player exp',
    (id, minutes, chapter, index) => {
      const s = newPlayer(1000);
      s.stage = { chapter, index, wins: 4 };
      s.best = { chapter: 6, index: 24 };
      s.level = 7;
      s.exp = 42;
      s.res.exp = 13;
      s.idle = { last: 555, fish: 47.5, exp: 19.25 };
      if (id === 'yarn_small') s.res.yarn = 2;
      else expect(addItem(s, id, 2).ok).toBe(true);
      const before = structuredClone(s);
      const rate = idleRate(s);
      const fish = Math.floor(rate.fish * minutes * 2);
      const exp = Math.floor(rate.exp * minutes * 2);
      const result = useYarn(s, id, 2);
      expect(result).toEqual({ ok: true, minutes: minutes * 2, fish, exp });
      expect(s.res.fish).toBe(before.res.fish + fish);
      expect(s.res.exp).toBe(before.res.exp + exp);
      expect(itemCount(s, id)).toBe(0);
      expect(s.idle).toEqual(before.idle);
      expect(s.exp).toBe(before.exp);
      expect(s.level).toBe(before.level);
      expect(s.stage).toEqual(before.stage);
      expect(s.best).toEqual(before.best);
      expect(s.heroes).toEqual(before.heroes);
      expect(s.lineup).toEqual(before.lineup);
      for (const resource of ['bells', 'catnip', 'tickets'] satisfies (keyof Resources)[]) {
        expect(s.res[resource]).toBe(before.res[resource]);
      }
    });

  it('rejects an empty stock, insufficient stock, invalid counts, and non-yarn items atomically', () => {
    const s = newPlayer(1000);
    s.res.yarn = 0;
    failsWithoutChange(s, () => useYarn(s, 'yarn_small'));
    failsWithoutChange(s, () => useYarn(s, 'yarn_medium'));
    expect(addItem(s, 'yarn_large', 1).ok).toBe(true);
    failsWithoutChange(s, () => useYarn(s, 'yarn_large', 2));
    for (const count of INVALID_COUNTS) failsWithoutChange(s, () => useYarn(s, 'yarn_large', count));
    for (const id of ['fish', 'bell_thread', 'missing_yarn', '__proto__', 'constructor']) {
      failsWithoutChange(s, () => useYarn(s, id));
    }
  });

  it.each([
    [0, 1], [7, 1], [1, 0], [1, 25], [1.5, 1], [1, 1.5], [NaN, 1], [1, Infinity],
  ])('rejects nonexistent stage %s-%s without consuming a ball or changing resources', (chapter, index) => {
    const s = newPlayer(1000);
    s.stage = { chapter, index, wins: 0 };
    expect(addItem(s, 'yarn_medium', 1).ok).toBe(true);
    failsWithoutChange(s, () => useYarn(s, 'yarn_medium'));
  });

  it('does not consume stock if the credited resource total would exceed safe integer precision', () => {
    const s = newPlayer(1000);
    s.res.fish = Number.MAX_SAFE_INTEGER;
    failsWithoutChange(s, () => useYarn(s, 'yarn_small'));
    s.res.fish = 3000;
    s.res.exp = Number.MAX_SAFE_INTEGER;
    failsWithoutChange(s, () => useYarn(s, 'yarn_small'));
  });
});

describe('demo inventory', () => {
  it('is idempotent and retains already enhanced or worn equipment', () => {
    const s = newPlayer(1000);
    seedDemoInventory(s);
    expect(s.inventory.equipment).toHaveLength(20);
    expect(new Set(s.inventory.equipment.map((entry) => entry.uid)).size).toBe(20);
    expect(s.inventory.equipment.some((entry) => entry.equipId === 'wei_tiger_guard_weapon')).toBe(true);
    const seeded = structuredClone(s);
    seedDemoInventory(s);
    expect(s).toEqual(seeded);
    const uid = s.inventory.equipment[0].uid;
    expect(enhanceEquipment(s, uid).ok).toBe(true);
    expect(equipEquipment(s, uid, HERO_A).ok).toBe(true);
    const progressed = structuredClone(s);
    seedDemoInventory(s);
    expect(s).toEqual(progressed);
    const storage = memoryStorage();
    save(storage, s);
    const loaded = load(storage, 9999);
    seedDemoInventory(loaded);
    expect(loaded).toEqual(progressed);
  });
});
