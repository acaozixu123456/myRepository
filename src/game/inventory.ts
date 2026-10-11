// 背包操作：只处理玩家数据，不依赖 DOM。已有资源仍以 res 为唯一账本。
import { EQUIPS, EQUIP_QUALITIES } from '../content/equipment';
import { ITEMS } from '../content/items';
import type { StatBlock } from '../content/types';
import { HERO_BY_ID } from '../data/heroes';
import { getStage, idleRate } from './stage';
import type { HeroState, OpResult, PlayerState, Resources } from './state';

export interface EquipmentInstance {
  uid: string;
  equipId: string;
  level: number;
  heroId?: string;
}

export interface InventoryState {
  v: 1;
  nextUid: number;
  items: Record<string, number>;
  equipment: EquipmentInstance[];
}

const ITEM_BY_ID = new Map(ITEMS.map((item) => [item.id, item]));
const EQUIP_BY_ID = new Map(EQUIPS.map((equip) => [equip.id, equip]));
const RESOURCE_ITEMS = new Map<string, keyof Resources>([
  ['fish', 'fish'], ['bells', 'bells'], ['catnip_small', 'catnip'],
  ['recruit_ticket', 'tickets'], ['yarn_small', 'yarn'],
]);
const MAX_BATCH = 9999;
const validCount = (n: number) => Number.isSafeInteger(n) && n > 0;
const fail = (reason: string): { ok: false; reason: string } => ({ ok: false, reason });
const object = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

export function createInventory(): InventoryState {
  return { v: 1, nextUid: 1, items: {}, equipment: [] };
}

/** 老存档没有背包时补空库存；坏条目不影响其余资源、英雄及阵容。 */
export function normalizeInventory(raw: unknown, heroes: Record<string, HeroState>): InventoryState {
  const out = createInventory();
  const input = object(raw);
  if (!input || input.v !== 1) return out;
  const items = object(input.items);
  if (items) for (const [id, amount] of Object.entries(items)) {
    const def = ITEM_BY_ID.get(id);
    if (!def || RESOURCE_ITEMS.has(id) || typeof amount !== 'number' || !Number.isFinite(amount)) continue;
    const n = Math.min(def.stack ?? 9999, Math.max(0, Math.floor(amount)));
    if (n) out.items[id] = n;
  }
  if (typeof input.nextUid === 'number' && validCount(input.nextUid) && input.nextUid <= Number.MAX_SAFE_INTEGER - MAX_BATCH) out.nextUid = input.nextUid;
  const used = new Set<string>();
  const worn = new Set<string>();
  const rows = Array.isArray(input.equipment) ? input.equipment : [];
  // 先保留合法实例编号，让修复出的新编号不占用后面的合法条目。
  const reserved = new Set(rows.flatMap((row) => {
    const entry = object(row);
    return entry && typeof entry.uid === 'string' && /^eq_[1-9]\d*$/.test(entry.uid) && typeof entry.equipId === 'string' && EQUIP_BY_ID.has(entry.equipId) ? [entry.uid] : [];
  }));
  const allocate = () => {
    while (reserved.has(`eq_${out.nextUid}`) || used.has(`eq_${out.nextUid}`)) out.nextUid++;
    return `eq_${out.nextUid++}`;
  };
  for (const row of rows) {
    const entry = object(row);
    const def = entry && typeof entry.equipId === 'string' ? EQUIP_BY_ID.get(entry.equipId) : undefined;
    if (!entry || !def) continue;
    const candidate = typeof entry.uid === 'string' && /^eq_[1-9]\d*$/.test(entry.uid) ? entry.uid : '';
    const index = Number(candidate.slice(3));
    const validUid = candidate && validCount(index) && index <= Number.MAX_SAFE_INTEGER - MAX_BATCH && !used.has(candidate);
    const uid = validUid ? candidate : allocate();
    used.add(uid);
    if (validUid) out.nextUid = Math.max(out.nextUid, index + 1);
    const level = typeof entry.level === 'number' && Number.isFinite(entry.level) ? Math.min(def.levelCap, Math.max(1, Math.floor(entry.level))) : 1;
    const instance: EquipmentInstance = { uid, equipId: def.id, level };
    if (typeof entry.heroId === 'string' && Object.hasOwn(heroes, entry.heroId) && Object.hasOwn(HERO_BY_ID, entry.heroId)) {
      const slot = `${entry.heroId}:${def.slot}`;
      if (!worn.has(slot)) { instance.heroId = entry.heroId; worn.add(slot); }
    }
    out.equipment.push(instance);
  }
  return out;
}

export function itemCount(s: PlayerState, id: string): number {
  if (!ITEM_BY_ID.has(id)) return 0;
  const resource = RESOURCE_ITEMS.get(id);
  const n = resource ? s.res[resource] : s.inventory.items[id] ?? 0;
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function setItemCount(s: PlayerState, id: string, n: number): void {
  const resource = RESOURCE_ITEMS.get(id);
  if (resource) s.res[resource] = n;
  else if (n) s.inventory.items[id] = n;
  else delete s.inventory.items[id];
}

export function addItem(s: PlayerState, id: string, count: number): OpResult {
  const def = ITEM_BY_ID.get(id);
  if (!def) return fail('这件东西还没登记进账本');
  if (!validCount(count)) return fail('请按整份数量收好道具');
  const next = itemCount(s, id) + count;
  if (!Number.isFinite(next) || next > (def.stack ?? 9999)) return fail('这一叠装满了，先腾个位置');
  setItemCount(s, id, next);
  return { ok: true };
}

export function removeItem(s: PlayerState, id: string, count: number): OpResult {
  if (!ITEM_BY_ID.has(id)) return fail('这件东西还没登记进账本');
  if (!validCount(count)) return fail('请按整份数量取用道具');
  const have = itemCount(s, id);
  if (have < count) return fail('数量不够，猫猫已经认真数过了');
  setItemCount(s, id, have - count);
  return { ok: true };
}

export function addEquipment(s: PlayerState, equipId: string, count = 1): { ok: true; uids: string[] } | { ok: false; reason: string } {
  if (!EQUIP_BY_ID.has(equipId)) return fail('还没有这件装备的登记');
  if (!validCount(count) || count > MAX_BATCH) return fail('请分批收好整件装备');
  if (!validCount(s.inventory.nextUid) || s.inventory.nextUid > Number.MAX_SAFE_INTEGER - count) return fail('装备编号需要重新整理');
  const used = new Set(s.inventory.equipment.map((e) => e.uid));
  const entries: EquipmentInstance[] = [];
  let next = s.inventory.nextUid;
  for (let i = 0; i < count; i++) {
    while (used.has(`eq_${next}`)) {
      if (next >= Number.MAX_SAFE_INTEGER - count) return fail('装备编号需要重新整理');
      next++;
    }
    const uid = `eq_${next++}`;
    used.add(uid);
    entries.push({ uid, equipId, level: 1 });
  }
  s.inventory.nextUid = next;
  s.inventory.equipment.push(...entries);
  return { ok: true, uids: entries.map((e) => e.uid) };
}

export function removeEquipment(s: PlayerState, uid: string): OpResult {
  const index = s.inventory.equipment.findIndex((e) => e.uid === uid);
  if (index < 0) return fail('箱子里没有这件装备');
  if (s.inventory.equipment[index].heroId) return fail('先把装备卸下来，再收走');
  s.inventory.equipment.splice(index, 1);
  return { ok: true };
}

/** 装备穿戴独立于 state.equip 的上阵操作；换同槽装备时自动卸下旧件。 */
export function equipEquipment(s: PlayerState, uid: string, heroId: string): OpResult {
  if (!Object.hasOwn(s.heroes, heroId) || !Object.hasOwn(HERO_BY_ID, heroId)) return fail('先请这只猫来营中');
  const instance = s.inventory.equipment.find((e) => e.uid === uid);
  const def = instance && EQUIP_BY_ID.get(instance.equipId);
  if (!instance || !def) return fail('箱子里没有这件装备');
  for (const other of s.inventory.equipment) {
    if (other.heroId === heroId && EQUIP_BY_ID.get(other.equipId)?.slot === def.slot) delete other.heroId;
  }
  instance.heroId = heroId;
  return { ok: true };
}

export function unequipEquipment(s: PlayerState, uid: string): OpResult {
  const instance = s.inventory.equipment.find((e) => e.uid === uid);
  if (!instance) return fail('箱子里没有这件装备');
  if (!instance.heroId) return fail('这件装备已经收在箱子里了');
  delete instance.heroId;
  return { ok: true };
}

export function equipmentStats(instance: EquipmentInstance): StatBlock {
  const def = EQUIP_BY_ID.get(instance.equipId);
  if (!def) return {};
  const level = Number.isFinite(instance.level) ? Math.min(def.levelCap, Math.max(1, Math.floor(instance.level))) : 1;
  const stats: StatBlock = {};
  for (const key of new Set([...Object.keys(def.base), ...Object.keys(def.growth)]) as Set<keyof StatBlock>) {
    stats[key] = Math.round(((def.base[key] ?? 0) + (level - 1) * (def.growth[key] ?? 0)) * 1_000_000) / 1_000_000;
  }
  return stats;
}

/** 原型强化成本：当前等级 × 品质序号 × 40 小鱼干；满级无下一次收费。 */
export function enhanceCost(instance: EquipmentInstance): number {
  const def = EQUIP_BY_ID.get(instance.equipId);
  return def && validCount(instance.level) && instance.level < def.levelCap ? 40 * (EQUIP_QUALITIES.indexOf(def.quality) + 1) * instance.level : 0;
}

export function enhanceEquipment(s: PlayerState, uid: string): OpResult {
  const instance = s.inventory.equipment.find((e) => e.uid === uid);
  const def = instance && EQUIP_BY_ID.get(instance.equipId);
  if (!instance || !def) return fail('箱子里没有这件装备');
  if (!validCount(instance.level) || instance.level > def.levelCap) return fail('装备等级需要重新整理');
  if (instance.level === def.levelCap) return fail('已经缝得很结实了，装备已满级');
  const cost = enhanceCost(instance);
  if (!Number.isFinite(s.res.fish) || s.res.fish < cost) return fail('小鱼干不够，军需官捂住了盘子');
  s.res.fish -= cost;
  instance.level++;
  return { ok: true };
}

export function equippedSetCounts(s: PlayerState, heroId: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const instance of s.inventory.equipment) {
    const def = EQUIP_BY_ID.get(instance.equipId);
    if (instance.heroId === heroId && def?.setId) counts[def.setId] = (counts[def.setId] ?? 0) + 1;
  }
  return counts;
}

export const YARN_MINUTES: Readonly<Record<string, number>> = { yarn_small: 60, yarn_medium: 120, yarn_large: 240 };
const YARN_TYPES = new Map(Object.entries(YARN_MINUTES));

export function useYarn(s: PlayerState, id: string, count = 1): { ok: true; minutes: number; fish: number; exp: number } | { ok: false; reason: string } {
  const duration = YARN_TYPES.get(id);
  if (!duration || !validCount(count)) return fail('请选好整颗毛线球');
  if (itemCount(s, id) < count) return fail('毛线球用完了，尾巴可不能拿来充数');
  if (!getStage(s.stage.chapter, s.stage.index)) return fail('先选一处能挂机的营地');
  const rate = idleRate(s);
  const minutes = duration * count;
  const fish = Math.floor(rate.fish * minutes);
  const exp = Math.floor(rate.exp * minutes);
  if (![minutes, fish, exp, s.res.fish + fish, s.res.exp + exp].every((n) => Number.isSafeInteger(n) && n >= 0)) return fail('收益太多了，请分批解开线头');
  const taken = removeItem(s, id, count);
  if (!taken.ok) return taken;
  s.res.fish += fish;
  s.res.exp += exp;
  return { ok: true, minutes, fish, exp };
}

/** 仅供 rich=1 预览；补足演示数量，不重置已有实例的等级、穿戴和碎片。 */
export function seedDemoInventory(s: PlayerState): void {
  const demo = EQUIPS.filter((e) => e.id.startsWith('camp_') || e.setId === 'wei_tiger_guard');
  for (const def of demo) if (!s.inventory.equipment.some((e) => e.equipId === def.id)) addEquipment(s, def.id);
  const amounts: Record<string, number> = { paw_seal: 12, fishbone_small: 8, claw_scroll_small: 6, bell_thread: 10, awaken_jade: 2, yarn_medium: 3, yarn_large: 1, equip_chest_rare: 2 };
  for (const [id, n] of Object.entries(amounts)) if (itemCount(s, id) < n) addItem(s, id, n - itemCount(s, id));
  Object.values(s.heroes).forEach((hero, index) => { hero.shards = Math.max(hero.shards, 5 + index * 3); });
}
