import { describe, expect, it, vi } from 'vitest';
import { newPlayer, levelUp, levelUpCost, skillUp, skillUpCost } from '../src/game/state';
import { claimIdle } from '../src/game/stage';
import { POOLS, pull } from '../src/game/gacha';
import { EQUIPS } from '../src/content/equipment';
import { addEquipment, enhanceCost, enhanceEquipment } from '../src/game/inventory';
import { towerClear } from '../src/game/tower';
import { buy } from '../src/game/shop';
import { track } from '../src/game/quests';

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
    expect(s.quests.progress.daily_equipment).toBe(1);
    expect(s.quests.progress.newbie_equipment).toBe(1);
    s.res.fish = 0;
    const before = JSON.stringify(s.quests);
    expect(enhanceEquipment(s, instance.uid).ok).toBe(false);
    expect(JSON.stringify(s.quests)).toBe(before);
  });

  it('counts only first new tower floors and keeps tower victories separate from campaign victories', () => {
    const before = new Date(2026, 9, 12, 4, 59).getTime();
    const after = new Date(2026, 9, 12, 5).getTime();
    const s = newPlayer(before);
    track(s, 'clear_stage', 3);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(after);
    try {
      expect(towerClear(s, 2)).toBeNull();
      expect(towerClear(s, 1)).not.toBeNull();
      expect(s.quests.dailyKey).toBe('2026-10-12');
      expect(s.quests.progress.daily_tower).toBe(1);
      expect(s.quests.progress.weekly_tower).toBe(1);
      const once = structuredClone(s);
      expect(towerClear(s, 1)).toBeNull();
      expect(towerClear(s, 3)).toBeNull();
      expect(s).toEqual(once);
      expect(towerClear(s, 2)).not.toBeNull();
      expect(s.quests.progress.daily_tower).toBe(2);
      expect(s.quests.progress.weekly_tower).toBe(2);
      expect(s.quests.progress.daily_campaign ?? 0).toBe(0);
      expect(s.quests.progress.weekly_campaign ?? 0).toBe(0);
      expect(s.quests.progress.achievement_stage_clears_1).toBe(3);
    } finally { vi.useRealTimers(); }
  });

  it('counts shop fish payments once, skips other currencies and preserves progress on failed purchases', () => {
    const now = new Date(2026, 9, 11, 12).getTime();
    const s = newPlayer(now);
    s.res.fish = 10000;
    const oldFish = s.res.fish;
    expect(buy(s, 'general_catnip_small', 2, now).ok).toBe(true);
    expect(s.quests.progress.daily_spend).toBe(5000); // 实付6000，日常目标封顶5000。
    const paid = structuredClone(s.quests);
    expect(buy(s, 'general_recruit_ticket', 1, now).ok).toBe(true);
    expect(s.quests).toEqual(paid);
    s.res.fish = 0;
    const before = structuredClone(s);
    expect(buy(s, 'general_catnip_small', 1, now).ok).toBe(false);
    expect(s).toEqual(before);
  });

  it('assigns a first successful Monday shop payment to the new task day and week', () => {
    const before = new Date(2026, 9, 12, 4, 59).getTime();
    const after = new Date(2026, 9, 12, 5).getTime();
    const s = newPlayer(before);
    track(s, 'spend_fish', 123);
    track(s, 'clear_stage', 3);
    const oldFish = s.res.fish;
    expect(buy(s, 'general_catnip_small', 1, after).ok).toBe(true);
    expect(s.quests.dailyKey).toBe('2026-10-12');
    expect(s.quests.weeklyKey).toBe('2026-10-12');
    expect(s.quests.progress.daily_spend).toBe(oldFish - s.res.fish);
    expect(s.quests.progress.achievement_stage_clears_1).toBe(3);
  });
});
