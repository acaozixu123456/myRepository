import { describe, expect, it } from 'vitest';
import { MOBS } from '../src/content/mobs';
import { FACTIONS, FACTION_ORDER } from '../src/data/factions';
import { HEROES } from '../src/data/heroes';
import { baseStats, ROLES } from '../src/data/systems';

const roleSuffix = {
  守护: 'guard', 先锋: 'vanguard', 神射: 'archer',
  谋士: 'strategist', 医者: 'healer', 刺客: 'assassin',
} as const;

describe('mob catalogue integrity', () => {
  it('has unique ids and names, without colliding with hero ids', () => {
    expect(MOBS.length).toBe(36);
    expect(new Set(MOBS.map((mob) => mob.id)).size).toBe(MOBS.length);
    expect(new Set(MOBS.map((mob) => mob.name)).size).toBe(MOBS.length);
    const heroIds = new Set(HEROES.map((hero) => hero.id));
    for (const mob of MOBS) {
      expect(mob.id, mob.name).toMatch(/^mob_(wei|shu|wu|qun|man|xian)_[a-z]+$/);
      expect(mob.id, mob.name).toBe(`mob_${mob.faction}_${roleSuffix[mob.role]}`);
      expect(heroIds.has(mob.id), mob.id).toBe(false);
    }
  });

  it('provides all six roles in each of the six valid factions', () => {
    for (const mob of MOBS) {
      expect(FACTIONS[mob.faction], mob.id).toBeDefined();
      expect(ROLES[mob.role], mob.id).toBeDefined();
    }
    for (const faction of FACTION_ORDER) {
      const factionMobs = MOBS.filter((mob) => mob.faction === faction);
      expect(factionMobs.length, faction).toBe(6);
      expect(new Set(factionMobs.map((mob) => mob.role)), faction).toEqual(new Set(Object.keys(ROLES)));
    }
  });

  it('uses finite positive multipliers and stays weaker than the same-role lowest-rarity hero', () => {
    for (const mob of MOBS) {
      for (const value of [mob.hpMul, mob.atkMul]) {
        expect(Number.isFinite(value), mob.id).toBe(true);
        expect(value, mob.id).toBeGreaterThanOrEqual(0.4);
        expect(value, mob.id).toBeLessThan(0.82);
      }
      const role = ROLES[mob.role].base;
      const weakestHero = baseStats(mob.role, 'SR');
      expect(role.hp * mob.hpMul, mob.id).toBeLessThan(weakestHero.hp);
      expect(role.atk * mob.atkMul, mob.id).toBeLessThan(weakestHero.atk);
    }
  });

  it('keeps guards durable, ranged and assassin damage high, and healer attacks low', () => {
    for (const faction of FACTION_ORDER) {
      const factionMobs = MOBS.filter((mob) => mob.faction === faction);
      const guard = factionMobs.find((mob) => mob.role === '守护')!;
      const healer = factionMobs.find((mob) => mob.role === '医者')!;
      for (const mob of factionMobs) {
        const stats = ROLES[mob.role].base;
        if (mob !== guard) {
          expect(ROLES.守护.base.hp * guard.hpMul, mob.id).toBeGreaterThan(stats.hp * mob.hpMul);
        }
        if (mob !== healer) {
          expect(ROLES.医者.base.atk * healer.atkMul, mob.id).toBeLessThan(stats.atk * mob.atkMul);
        }
        if (mob.role === '神射' || mob.role === '刺客') {
          expect(stats.atk * mob.atkMul, mob.id).toBeGreaterThan(ROLES.先锋.base.atk * factionMobs.find((unit) => unit.role === '先锋')!.atkMul);
        }
      }
    }
  });

  it('supplies complete Chinese text and cat appearance directions', () => {
    for (const mob of MOBS) {
      expect(mob.name.trim(), mob.id).not.toBe('');
      expect(mob.desc.trim().length, mob.id).toBeGreaterThanOrEqual(15);
      expect(mob.lookHint.trim().length, mob.id).toBeGreaterThanOrEqual(15);
      expect(mob.lookHint, mob.id).toContain('猫');
      expect(`${mob.name}${mob.desc}${mob.lookHint}`, mob.id).not.toMatch(/[a-z]/i);
    }
  });

  it('includes the requested flavour examples while keeping the water-village unit a cat', () => {
    const names = new Set(MOBS.map((mob) => mob.name));
    for (const name of ['山贼喵', '纸箱守卫', '藤甲小喵', '水寨鼠兵']) {
      expect(names.has(name), name).toBe(true);
    }
    const waterGuard = MOBS.find((mob) => mob.name === '水寨鼠兵')!;
    expect(waterGuard.faction).toBe('wu');
    expect(waterGuard.desc).toContain('戴鼠耳帽的猫');
  });
});
