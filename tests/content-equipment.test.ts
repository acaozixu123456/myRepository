import { describe, expect, it } from 'vitest';
import { EQUIPS, EQUIP_SETS, EQUIP_SLOTS, EQUIP_QUALITIES, makeEquip } from '../src/content/equipment';
import { FACTION_ORDER } from '../src/data/factions';
import type { StatKey } from '../src/content/types';

describe('装备与套装', () => {
  it('装备和套装标识、名字唯一，中文文案完整', () => {
    for (const data of [EQUIPS, EQUIP_SETS]) {
      expect(new Set(data.map((entry) => entry.id)).size).toBe(data.length);
      expect(new Set(data.map((entry) => entry.name)).size).toBe(data.length);
      for (const entry of data) {
        expect(entry.id).toMatch(/^[a-z][a-z0-9_]*$/);
        expect(entry.name.trim()).not.toBe('');
        expect(entry.flavor.trim()).not.toBe('');
        expect(entry.name + entry.flavor).not.toMatch(/[a-zA-Z]/);
      }
    }
  });

  it('每阵营两套传说套装，各有且仅有四个部位', () => {
    expect(EQUIP_SETS).toHaveLength(12);
    expect(EQUIPS.filter((equip) => equip.quality === 'legend')).toHaveLength(48);
    for (const faction of FACTION_ORDER) expect(EQUIP_SETS.filter((set) => set.faction === faction)).toHaveLength(2);
    for (const set of EQUIP_SETS) {
      const pieces = EQUIPS.filter((equip) => equip.setId === set.id);
      expect(pieces).toHaveLength(4);
      expect(pieces.map((equip) => equip.slot).sort()).toEqual([...EQUIP_SLOTS].sort());
      expect(pieces.every((equip) => equip.quality === 'legend')).toBe(true);
      expect(set.bonus2.desc.trim()).not.toBe('');
      expect(set.bonus4.desc.trim()).not.toBe('');
      expect(set.bonus4.note?.trim()).toBeTruthy();
    }
    const ids = new Set(EQUIP_SETS.map((set) => set.id));
    for (const equip of EQUIPS) if (equip.setId) expect(ids.has(equip.setId), equip.id).toBe(true);
  });

  it('通用装备覆盖三主题、四品质、四部位且无套装', () => {
    const generic = EQUIPS.filter((equip) => !equip.setId);
    expect(generic).toHaveLength(48);
    for (const theme of ['camp', 'peach', 'ferry']) {
      for (const slot of EQUIP_SLOTS) {
        const variants = EQUIP_QUALITIES.slice(0, 4).map((quality) =>
          generic.find((equip) => equip.id === `${theme}_${quality}_${slot}`)!);
        expect(variants.every(Boolean)).toBe(true);
        for (let i = 1; i < variants.length; i++) {
          for (const key of Object.keys(variants[i - 1].base) as StatKey[]) {
            expect(variants[i].base[key]!).toBeGreaterThan(variants[i - 1].base[key]!);
            expect(variants[i].growth[key]!).toBeGreaterThan(variants[i - 1].growth[key]!);
          }
        }
      }
    }
  });

  it('五档品质的同类属性与满级属性严格递增，上限符合约定', () => {
    const caps = [20, 30, 40, 50, 60];
    for (const profile of ['front', 'back', 'camp', 'peach', 'ferry'] as const) {
      for (const slot of EQUIP_SLOTS) {
        const variants = EQUIP_QUALITIES.map((quality, i) => {
          const equip = makeEquip({ id: 'test', name: '试装', slot, quality, profile, flavor: '试装。' });
          expect(equip.levelCap).toBe(caps[i]);
          return equip;
        });
        for (let i = 1; i < variants.length; i++) {
          for (const key of Object.keys(variants[i - 1].base) as StatKey[]) {
            const before = variants[i - 1];
            const after = variants[i];
            expect(after.base[key]!).toBeGreaterThan(before.base[key]!);
            expect(after.growth[key]!).toBeGreaterThan(before.growth[key]!);
            expect(after.base[key]! + (after.levelCap - 1) * after.growth[key]!)
              .toBeGreaterThan(before.base[key]! + (before.levelCap - 1) * before.growth[key]!);
          }
        }
      }
    }
  });

  it('所有属性有限且为正，副属性保持在合理区间', () => {
    for (const equip of EQUIPS) {
      if (equip.slot === 'weapon') expect(equip.base.atk).toBeGreaterThan(0);
      if (equip.slot === 'armor') {
        expect(equip.base.hp).toBeGreaterThan(0);
        expect(equip.base.def).toBeGreaterThan(0);
      }
      for (const block of [equip.base, equip.growth]) {
        for (const [key, value] of Object.entries(block)) {
          expect(Number.isFinite(value), equip.id).toBe(true);
          expect(value).toBeGreaterThan(0);
          if (!['hp', 'atk', 'def', 'spd'].includes(key)) expect(value).toBeLessThan(0.3);
        }
      }
      for (const key of Object.keys(equip.base) as StatKey[]) {
        if (!['hp', 'atk', 'def', 'spd'].includes(key)) {
          expect(equip.base[key]! + (equip.levelCap - 1) * equip.growth[key]!).toBeLessThan(0.3);
        }
      }
    }
    for (const set of EQUIP_SETS) {
      for (const bonus of [set.bonus2, set.bonus4]) {
        for (const value of Object.values(bonus.stats)) {
          expect(Number.isFinite(value)).toBe(true);
          expect(value).toBeGreaterThan(0);
        }
      }
    }
  });
});
