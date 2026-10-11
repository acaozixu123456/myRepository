import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/content/items';
import { FACTION_ORDER } from '../src/data/factions';
import type { ItemKind, Quality } from '../src/content/types';

const byId = new Map(ITEMS.map((item) => [item.id, item]));
const kinds: ItemKind[] = ['currency', 'material', 'chest', 'shard', 'ticket', 'consumable'];
const qualities: Quality[] = ['common', 'fine', 'rare', 'epic', 'legend'];

describe('item catalogue integrity', () => {
  it('has about 40 items with unique lowercase ids and unique names', () => {
    expect(ITEMS.length).toBeGreaterThanOrEqual(38);
    expect(ITEMS.length).toBeLessThanOrEqual(42);
    expect(byId.size).toBe(ITEMS.length);
    expect(new Set(ITEMS.map((item) => item.name)).size).toBe(ITEMS.length);
    for (const item of ITEMS) {
      expect(item.id, item.name).toMatch(/^[a-z]+(?:_[a-z]+)*$/);
      expect(item.name.trim(), item.id).not.toBe('');
      expect(item.desc.trim(), item.id).not.toBe('');
      expect(`${item.name}${item.desc}`, item.id).not.toMatch(/[a-z]/i);
    }
  });

  it('uses supported kinds, qualities and positive safe stack limits', () => {
    for (const item of ITEMS) {
      expect(kinds, item.id).toContain(item.kind);
      expect(qualities, item.id).toContain(item.quality);
      const stack = item.stack ?? 9999;
      expect(Number.isSafeInteger(stack), item.id).toBe(true);
      expect(stack, item.id).toBeGreaterThan(0);
      expect(stack, item.id).toBeLessThanOrEqual(999999999);
    }
  });

  it('covers core currencies and each shop currency', () => {
    for (const id of ['fish', 'bells', 'paw_seal', 'guild_token', 'tower_token', 'faction_token']) {
      expect(byId.get(id)?.kind, id).toBe('currency');
    }
    expect(byId.get('fish')?.name).toBe('小鱼干');
    expect(byId.get('bells')?.name).toBe('金铃铛');
    expect(byId.get('paw_seal')?.name).toBe('猫爪印');
  });

  it('provides three tiers of experience, breakthrough and skill materials plus awakening materials', () => {
    for (const prefix of ['catnip', 'fishbone', 'claw_scroll']) {
      let lastQuality = -1;
      for (const tier of ['small', 'medium', 'large']) {
        const id = `${prefix}_${tier}`;
        const item = byId.get(id);
        expect(item?.kind, id).toBe('material');
        const quality = qualities.indexOf(item!.quality);
        expect(quality, id).toBeGreaterThan(lastQuality);
        lastQuality = quality;
      }
    }
    for (const id of ['awaken_jade', 'awaken_dew']) {
      expect(byId.get(id)?.kind, id).toBe('material');
      expect(byId.get(id)?.desc, id).toContain('觉醒');
    }
  });

  it('provides three acceleration consumables, ordinary recruitment and all six faction tickets', () => {
    for (const tier of ['small', 'medium', 'large']) {
      const id = `yarn_${tier}`;
      expect(byId.get(id)?.kind, id).toBe('consumable');
      expect(byId.get(id)?.name, id).toContain('毛线球');
      expect(byId.get(id)?.desc, id).toContain('小时');
    }
    expect(byId.get('recruit_ticket')?.kind).toBe('ticket');
    const factionTickets = ITEMS.filter((item) => FACTION_ORDER.some((faction) => item.id === `recruit_${faction}`));
    expect(factionTickets.length).toBe(6);
    for (const faction of FACTION_ORDER) {
      expect(byId.get(`recruit_${faction}`)?.kind, faction).toBe('ticket');
    }
  });

  it('provides all equipment chests, hero shard chests and universal hero shard tiers', () => {
    for (const quality of ['rare', 'epic', 'legend'] as const) {
      const id = `equip_chest_${quality}`;
      expect(byId.get(id)?.kind, id).toBe('chest');
      expect(byId.get(id)?.quality, id).toBe(quality);
    }
    const rarityQuality = { sr: 'rare', ssr: 'epic', ur: 'legend' } as const;
    for (const rarity of ['sr', 'ssr', 'ur'] as const) {
      const chestId = `shard_chest_${rarity}`;
      const shardId = `hero_shard_${rarity}`;
      expect(byId.get(chestId)?.kind, chestId).toBe('chest');
      expect(byId.get(shardId)?.kind, shardId).toBe('shard');
      expect(byId.get(chestId)?.quality, chestId).toBe(rarityQuality[rarity]);
      expect(byId.get(shardId)?.quality, shardId).toBe(rarityQuality[rarity]);
    }
  });
});
