import { describe, expect, it } from 'vitest';
import { GACHA_POOLS, GACHA_POOL_READINESS, GACHA_RULES, ITEM_VALUE_FISH, QUEST_CATEGORIES, QUEST_GOALS, QUESTS, SHOP_ITEMS, SHOP_ITEM_READINESS } from '../src/content/economy';
import { ITEMS } from '../src/content/items';
import { EQUIPS } from '../src/content/equipment';
import { CHAPTERS } from '../src/content/campaign';
import { FACTION_ORDER } from '../src/data/factions';
import { HEROES } from '../src/data/heroes';
import type { RewardDef } from '../src/content/types';

const itemIds = new Set(ITEMS.map((item) => item.id));
const equipIds = new Set(EQUIPS.map((equip) => equip.id));
const heroIds = new Set(HEROES.map((hero) => hero.id));
const positiveInteger = (n: number) => { expect(Number.isSafeInteger(n)).toBe(true); expect(n).toBeGreaterThan(0); };
function checkReward(reward: RewardDef) {
  for (const n of [reward.fish, reward.exp, reward.bells]) if (n !== undefined) positiveInteger(n);
  for (const item of reward.items ?? []) { expect(itemIds.has(item.id), item.id).toBe(true); positiveInteger(item.count); }
  for (const equip of reward.equips ?? []) { expect(equipIds.has(equip.id), equip.id).toBe(true); positiveInteger(equip.count); }
  for (const shard of reward.heroShards ?? []) { expect(heroIds.has(shard.heroId), shard.heroId).toBe(true); positiveInteger(shard.count); }
  expect(Object.keys(reward).length).toBeGreaterThan(0);
}

describe('economic catalogue integrity', () => {
  it('has 12 daily, 8 weekly, 60 achievements and 10 newbie quests with unique ids and names', () => {
    expect(QUESTS.length).toBe(90);
    expect(new Set(QUESTS.map((quest) => quest.id)).size).toBe(90);
    expect(new Set(QUESTS.map((quest) => quest.name)).size).toBe(90);
    expect(new Set(QUESTS.map((quest) => quest.desc)).size).toBe(90);
    for (const [kind, count] of [['daily', 12], ['weekly', 8], ['achievement', 60], ['newbie', 10]] as const) {
      expect(QUESTS.filter((quest) => quest.kind === kind).length, kind).toBe(count);
    }
    for (const quest of QUESTS) {
      expect(quest.id).toMatch(/^[a-z]+(?:_[a-z0-9]+)*$/);
      expect(quest.name.trim()).not.toBe(''); expect(quest.desc.trim()).not.toBe('');
      expect(`${quest.name}${quest.desc}`).not.toMatch(/[a-z]/i);
      expect(Object.keys(QUEST_GOALS)).toContain(quest.goal.type);
      positiveInteger(quest.goal.target); checkReward(quest.reward);
    }
  });

  it('gives every achievement its own flavour text beyond the numeric goal', () => {
    const achievements = QUESTS.filter((quest) => quest.kind === 'achievement');
    const flavours = achievements.map((quest) => {
      const separator = quest.desc.indexOf('；');
      expect(separator, quest.id).toBeGreaterThan(0);
      const flavour = quest.desc.slice(separator + 1).trim();
      expect(flavour.length, quest.id).toBeGreaterThan(10);
      // 统一目标提示可复用；去掉数字与标点后，风味仍须各自不同。
      return flavour.replace(/[0-9零一二三四五六七八九十百千万两\s，。！？、]+/g, '');
    });
    expect(new Set(flavours).size).toBe(60);
  });

  it('provides 12 achievements and at least two valid growth tracks per category', () => {
    expect(Object.keys(QUEST_CATEGORIES).length).toBe(60);
    for (const category of ['养成', '战役', '竞技', '收集', '社交']) {
      const quests = QUESTS.filter((quest) => QUEST_CATEGORIES[quest.id] === category);
      expect(quests.length, category).toBe(12);
      const types = new Set(quests.map((quest) => quest.goal.type));
      expect(types.size, category).toBeGreaterThanOrEqual(2);
      for (const type of types) {
        const track = quests.filter((quest) => quest.goal.type === type);
        for (let i = 1; i < track.length; i++) {
          expect(track[i].goal.target).toBeGreaterThan(track[i - 1].goal.target);
          for (const field of ['fish', 'exp', 'bells'] as const) expect(track[i].reward[field]!).toBeGreaterThanOrEqual(track[i - 1].reward[field]!);
        }
      }
    }
    const stageCount = CHAPTERS.reduce((sum, chapter) => sum + chapter.stages.length, 0);
    for (const quest of QUESTS) {
      if (quest.goal.type === 'reach_stage') expect(quest.goal.target).toBeLessThanOrEqual(stageCount);
      if (quest.goal.type === 'hero_level') expect(quest.goal.target).toBeLessThanOrEqual(120);
      if (quest.goal.type === 'collect_hero') expect(quest.goal.target).toBeLessThanOrEqual(HEROES.length);
    }
  });

  it('defines nine recruitment pools with valid rates, pity, costs and existing featured heroes', () => {
    expect(GACHA_POOLS.length).toBe(9);
    expect(new Set(GACHA_POOLS.map((pool) => pool.id)).size).toBe(9);
    expect(GACHA_POOLS.filter((pool) => pool.kind === 'faction').map((pool) => pool.faction).sort()).toEqual([...FACTION_ORDER].sort());
    for (const pool of GACHA_POOLS) {
      expect(pool.name.trim()).not.toBe(''); expect(pool.name).not.toMatch(/[a-z]/i);
      expect(Object.values(pool.rates).reduce((sum, rate) => sum + rate, 0)).toBeCloseTo(1, 10);
      expect(pool.rates.UR).toBeCloseTo(0.015); expect(pool.rates.SSR).toBeCloseTo(0.12); expect(pool.rates.SR).toBeCloseTo(0.865);
      for (const rate of Object.values(pool.rates)) { expect(Number.isFinite(rate)).toBe(true); expect(rate).toBeGreaterThan(0); expect(rate).toBeLessThan(1); }
      expect(pool.pity.ssrWithin).toBe(10); expect(pool.pity.urWithin).toBe(80);
      for (const cost of [pool.cost.single, pool.cost.ten]) { expect(itemIds.has(cost.item), cost.item).toBe(true); positiveInteger(cost.count); }
      expect(pool.cost.ten.item).toBe(pool.cost.single.item); expect(pool.cost.ten.count).toBe(pool.cost.single.count * 10);
      expect(pool.pity.upGuarantee).toBe(pool.kind === 'up');
      if (pool.kind === 'up') { expect(pool.upHeroes?.length).toBeGreaterThan(0); for (const id of pool.upHeroes!) expect(HEROES.find((hero) => hero.id === id)?.rarity).toBe('UR'); }
      else expect(pool.upHeroes).toBeUndefined();
    }
    expect(GACHA_RULES.ssrPityIncludesUr).toBe(true); expect(GACHA_RULES.upUrShare).toBe(0.5);
    expect(GACHA_RULES.newbieDrawLimit).toBe(80); expect(GACHA_RULES.newbiePriceFactor).toBe(0.8);
    expect(GACHA_POOLS.find((pool) => pool.kind === 'newbie')!.cost.single.count).toBe(GACHA_POOLS.find((pool) => pool.kind === 'up')!.cost.single.count * GACHA_RULES.newbiePriceFactor);
  });

  it('derives availability from actual hero candidates and exposes the unsupported Shu low-rarity tier', () => {
    for (const pool of GACHA_POOLS) {
      const readiness = GACHA_POOL_READINESS[pool.id];
      for (const rarity of ['UR', 'SSR', 'SR'] as const) {
        const expected = HEROES.filter((hero) => hero.rarity === rarity && (!pool.faction || hero.faction === pool.faction)).map((hero) => hero.id);
        expect(readiness.candidates[rarity], pool.id).toEqual(expected);
        expect(readiness.missingRarities.includes(rarity), pool.id).toBe(pool.rates[rarity] > 0 && expected.length === 0);
      }
      expect(readiness.ready, pool.id).toBe(readiness.missingRarities.length === 0 && readiness.invalidUpHeroes.length === 0);
    }
    expect(GACHA_POOL_READINESS.faction_shu.ready).toBe(false);
    expect(GACHA_POOL_READINESS.faction_shu.missingRarities).toEqual(['SR']);
    expect(GACHA_POOL_READINESS.faction_shu.candidates.SR).toEqual([]);
    expect(GACHA_POOLS.find((pool) => pool.id === 'faction_shu')!.rates.SR).toBe(0.865);
    expect(SHOP_ITEM_READINESS.faction_recruit_shu).toBe(false);
    for (const pool of GACHA_POOLS.filter((pool) => pool.id !== 'faction_shu')) expect(GACHA_POOL_READINESS[pool.id].ready, pool.id).toBe(true);
  });

  it('provides 12 fairly priced offers per shop with valid currencies and weekly limits', () => {
    expect(SHOP_ITEMS.length).toBe(60);
    expect(new Set(SHOP_ITEMS.map((offer) => offer.id)).size).toBe(60);
    const currencies = { general: ['fish', 'bells'], arena: ['paw_seal'], guild: ['guild_token'], tower: ['tower_token'], faction: ['faction_token'] };
    for (const shop of Object.keys(currencies)) expect(SHOP_ITEMS.filter((offer) => offer.shop === shop).length, shop).toBe(12);
    for (const offer of SHOP_ITEMS) {
      expect(itemIds.has(offer.item.id), offer.id).toBe(true); expect(itemIds.has(offer.price.item), offer.id).toBe(true);
      expect(ITEMS.find((item) => item.id === offer.item.id)?.kind, offer.id).not.toBe('currency');
      expect(currencies[offer.shop], offer.id).toContain(offer.price.item);
      positiveInteger(offer.item.count); positiveInteger(offer.price.count); positiveInteger(offer.weeklyLimit!);
      expect(offer.weeklyLimit).toBeLessThanOrEqual(14);
      const received = ITEM_VALUE_FISH[offer.item.id] * offer.item.count;
      const paid = ITEM_VALUE_FISH[offer.price.item] * offer.price.count;
      expect(Number.isFinite(received), offer.id).toBe(true); expect(Number.isFinite(paid), offer.id).toBe(true);
      expect(paid, offer.id).toBeGreaterThanOrEqual(received);
      expect(paid, offer.id).toBeLessThanOrEqual(received * 1.3);
      const pool = GACHA_POOLS.find((entry) => entry.cost.single.item === offer.item.id);
      expect(SHOP_ITEM_READINESS[offer.id], offer.id).toBe(!pool || GACHA_POOL_READINESS[pool.id].ready);
    }
    for (const [id, value] of Object.entries(ITEM_VALUE_FISH)) { expect(itemIds.has(id), id).toBe(true); positiveInteger(value); }
  });

  it('never sells a fish pouch for less fish than opening it returns', () => {
    const amounts = { fish_pouch_small: 1000, fish_pouch_medium: 5000, fish_pouch_large: 20000 };
    for (const offer of SHOP_ITEMS) {
      const returned = amounts[offer.item.id as keyof typeof amounts];
      if (returned !== undefined && offer.price.item === 'fish') expect(offer.price.count, offer.id).toBeGreaterThanOrEqual(returned * offer.item.count);
      expect(offer.item.id, offer.id).not.toBe(offer.price.item);
    }
  });

  it('offers quest sources for all shop currencies, including one-time faction collection rewards', () => {
    const rewardCurrencies = new Set<string>();
    for (const quest of QUESTS) {
      if ((quest.reward.fish ?? 0) > 0) rewardCurrencies.add('fish');
      if ((quest.reward.bells ?? 0) > 0) rewardCurrencies.add('bells');
      for (const item of quest.reward.items ?? []) {
        if (ITEMS.find((entry) => entry.id === item.id)?.kind === 'currency') rewardCurrencies.add(item.id);
      }
    }
    for (const offer of SHOP_ITEMS) expect(rewardCurrencies.has(offer.price.item), offer.id).toBe(true);
    const factionRewards = QUESTS.filter((quest) => quest.reward.items?.some((item) => item.id === 'faction_token'));
    expect(factionRewards).toHaveLength(6);
    for (const quest of factionRewards) {
      expect(quest.kind).toBe('achievement');
      expect(quest.goal.type).toBe('collect_hero');
    }
  });
});
