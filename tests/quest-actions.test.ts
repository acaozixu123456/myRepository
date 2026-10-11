import { describe, expect, it } from 'vitest';
import { newPlayer, levelUp, levelUpCost, skillUp, skillUpCost } from '../src/game/state';
import { claimIdle } from '../src/game/stage';
import { POOLS, pull } from '../src/game/gacha';
import { EQUIPS } from '../src/content/equipment';
import { addEquipment, enhanceCost, enhanceEquipment } from '../src/game/inventory';

describe('quest tracking at actual operation points', () => {
  it('counts only successful hero and skill upgrades, with each fish payment counted once', () => {
    const s = newPlayer(0);
    const id = s.lineup[0]!;
    s.res.fish = 100000;
    s.res.exp = 100000;
    const levelCost = levelUpCost(s.heroes[id].lv).fish;
    expect(levelUp(s, id).ok).toBe(true);
    expect(s.quests.progress.daily_growth).toBe(1);
    expect(s.quests.progress.achievement_hero_level_1).toBe(9);
    expect(s.quests.progress.daily_spend).toBe(levelCost);
    const skillCost = skillUpCost(s.heroes[id].skillLv).fish;
    expect(skillUp(s, id).ok).toBe(true);
    expect(s.quests.progress.daily_skill).toBe(1);
    expect(s.quests.progress.daily_spend).toBe(levelCost + skillCost);
    s.res.fish = 0;
    const before = JSON.stringify(s.quests);
    expect(levelUp(s, id).ok).toBe(false);
    expect(skillUp(s, id).ok).toBe(false);
    expect(JSON.stringify(s.quests)).toBe(before);
  });

  it('counts ten completed pulls as ten and keeps distinct collection separate from duplicates', () => {
    const s = newPlayer(0);
    s.res.tickets = 10;
    expect(pull(s, POOLS[1], 10, () => 0.99).ok).toBe(true);
    expect(s.quests.progress.weekly_recruit).toBe(10);
    expect(s.quests.progress.daily_recruit).toBe(1);
    const collection = Object.keys(s.heroes).length;
    s.res.tickets = 1;
    expect(pull(s, POOLS[1], 1, () => 0.99).ok).toBe(true);
    expect(Object.keys(s.heroes)).toHaveLength(collection);
    expect(s.quests.progress.weekly_recruit).toBe(11);
    s.res.tickets = 0;
    s.res.bells = 0;
    const before = JSON.stringify(s.quests);
    expect(pull(s, POOLS[1], 10).ok).toBe(false);
    expect(JSON.stringify(s.quests)).toBe(before);
  });

  it('tracks actual idle collections, including an experience-only collection, while empty claims do not count', () => {
    const s = newPlayer(0);
    claimIdle(s);
    expect(s.quests.progress.daily_idle ?? 0).toBe(0);
    s.idle.fish = 8;
    s.idle.exp = 2;
    claimIdle(s);
    expect(s.quests.progress.daily_idle).toBe(1);
    claimIdle(s);
    expect(s.quests.progress.daily_idle).toBe(1);
    s.idle.exp = 1;
    claimIdle(s);
    expect(s.quests.progress.daily_idle).toBe(2);
    expect(s.quests.progress.weekly_idle).toBe(2);
  });

  it('includes equipment enhancement in actual fish spending and ignores rejected attempts', () => {
    const s = newPlayer(0);
    const def = EQUIPS.find((equip) => equip.quality === 'common')!;
    expect(addEquipment(s, def.id).ok).toBe(true);
    const instance = s.inventory.equipment[0];
    const cost = enhanceCost(instance);
    expect(enhanceEquipment(s, instance.uid).ok).toBe(true);
    expect(s.quests.progress.daily_spend).toBe(cost);
    s.res.fish = 0;
    const before = JSON.stringify(s.quests);
    expect(enhanceEquipment(s, instance.uid).ok).toBe(false);
    expect(JSON.stringify(s.quests)).toBe(before);
  });
});
