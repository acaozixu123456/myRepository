import { describe, expect, it } from 'vitest';
import { CHAPTERS, PENDING_CAMPAIGN_ITEMS, powerCurve } from '../src/content/campaign';
import { MOBS } from '../src/content/mobs';
import { HERO_BY_ID } from '../src/data/heroes';
import { FACTIONS } from '../src/data/factions';
import type { ItemDef, RewardDef } from '../src/content/types';

const stages = CHAPTERS.flatMap((chapter) => chapter.stages);
const mobById = Object.fromEntries(MOBS.map((mob) => [mob.id, mob]));
const optionalItems = import.meta.glob<{ ITEMS: ItemDef[] }>('../src/content/items.ts', { eager: true });
const catalogue = Object.values(optionalItems).flatMap((module) => module.ITEMS);
const itemIds = new Set(catalogue.length ? catalogue.map((item) => item.id) : PENDING_CAMPAIGN_ITEMS);

describe('战役内容', () => {
  it('六章各二十四关，标识连续，精英与首领位置固定', () => {
    expect(CHAPTERS).toHaveLength(6);
    expect(stages).toHaveLength(144);
    expect(new Set(stages.map((stage) => stage.id)).size).toBe(144);
    CHAPTERS.forEach((chapter, c) => {
      expect(chapter.id).toBe(c + 1);
      expect(chapter.stages).toHaveLength(24);
      expect(chapter.intro.length).toBeGreaterThanOrEqual(80);
      expect(chapter.intro.length).toBeLessThanOrEqual(150);
      expect(chapter.theme.trim()).not.toBe('');
      expect(chapter.bossNote.trim()).not.toBe('');
      chapter.stages.forEach((stage, s) => {
        expect(stage.id).toBe(`${c + 1}-${s + 1}`);
        expect(stage.name.trim()).not.toBe('');
        expect(stage.kind).toBe(s === 23 ? 'boss' : [5, 11, 17].includes(s) ? 'elite' : 'normal');
      });
    });
  });

  it('每波三至五敌人，站位唯一，英雄与杂兵存在且站在对应排', () => {
    for (const stage of stages) {
      expect(stage.waves.length).toBeGreaterThanOrEqual(1);
      expect(stage.waves.length).toBeLessThanOrEqual(3);
      for (const wave of stage.waves) {
        expect(wave.enemies.length).toBeGreaterThanOrEqual(3);
        expect(wave.enemies.length).toBeLessThanOrEqual(5);
        expect(new Set(wave.enemies.map((enemy) => enemy.pos)).size).toBe(wave.enemies.length);
        for (const enemy of wave.enemies) {
          const unit = HERO_BY_ID[enemy.unit] ?? mobById[enemy.unit];
          expect(unit, `${stage.id}: ${enemy.unit}`).toBeTruthy();
          expect(Number.isInteger(enemy.pos)).toBe(true);
          expect(enemy.pos).toBeGreaterThanOrEqual(0);
          expect(enemy.pos).toBeLessThanOrEqual(4);
          expect(Number.isInteger(enemy.level)).toBe(true);
          expect(enemy.level).toBeGreaterThanOrEqual(1);
          expect(enemy.level).toBeLessThanOrEqual(120);
          expect(enemy.pos <= 2).toBe(['守护', '先锋'].includes(unit.role));
        }
      }
      const heroes = stage.waves.flatMap((wave) => wave.enemies).filter((enemy) => HERO_BY_ID[enemy.unit]);
      if (stage.kind === 'normal') expect(heroes).toHaveLength(0);
      else expect(heroes.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('首领严格匹配六章约定，首通有金铃铛与英雄碎片', () => {
    const bosses = ['qun_dongzhuo', 'wei_caomiaode', 'wu_zhoumiaoyu', 'man_mengmiaohuo', 'xian_zuoci', 'qun_lvbuding'];
    let previousShards = 0;
    for (const chapter of CHAPTERS) {
      const stage = chapter.stages[23];
      expect(stage.waves.at(-1)!.enemies.some((enemy) => enemy.unit === bosses[chapter.id - 1])).toBe(true);
      expect(stage.firstClear.bells).toBeGreaterThan(0);
      const shards = stage.firstClear.heroShards!;
      expect(shards[0].heroId).toBe(bosses[chapter.id - 1]);
      expect(shards[0].count).toBeGreaterThanOrEqual(previousShards);
      previousShards = shards[0].count;
    }
  });

  it('推荐战力跨章严格递增，保留首尾锚点与首领百分之十二跃升', () => {
    expect(powerCurve(1, 1)).toBe(300);
    expect(powerCurve(6, 24)).toBe(30_000);
    for (let i = 1; i < stages.length; i++) {
      const ratio = stages[i].recommendedPower / stages[i - 1].recommendedPower;
      expect(stages[i].recommendedPower).toBeGreaterThan(stages[i - 1].recommendedPower);
      if (stages[i].kind === 'boss') expect(ratio).toBeCloseTo(1.12, 2);
      else {
        expect(ratio).toBeGreaterThan(1.027);
        expect(ratio).toBeLessThan(1.032);
      }
    }
    for (const [chapter, index] of [[0, 1], [7, 1], [1, 0], [1, 25], [NaN, 1], [1, 1.5]]) {
      expect(() => powerCurve(chapter, index)).toThrow(RangeError);
    }
  });

  it('基础奖励跨关非递减，奖励数值安全，所有道具与碎片引用有效', () => {
    for (const key of ['rewards', 'firstClear'] as const) {
      for (let i = 0; i < stages.length; i++) {
        const reward: RewardDef = stages[i][key];
        for (const value of [reward.fish ?? 0, reward.exp ?? 0, reward.bells ?? 0]) {
          expect(Number.isSafeInteger(value)).toBe(true);
          expect(value).toBeGreaterThanOrEqual(0);
        }
        for (const item of reward.items ?? []) {
          expect(itemIds.has(item.id), item.id).toBe(true);
          expect(Number.isSafeInteger(item.count)).toBe(true);
          expect(item.count).toBeGreaterThan(0);
        }
        for (const shard of reward.heroShards ?? []) {
          expect(HERO_BY_ID[shard.heroId]).toBeTruthy();
          expect(Number.isSafeInteger(shard.count)).toBe(true);
          expect(shard.count).toBeGreaterThan(0);
        }
        if (i === 0) continue;
        const previous = stages[i - 1][key];
        for (const field of ['fish', 'exp', 'bells'] as const) expect(reward[field] ?? 0).toBeGreaterThanOrEqual(previous[field] ?? 0);
        for (const item of previous.items ?? []) {
          expect(reward.items?.find((entry) => entry.id === item.id)?.count ?? 0).toBeGreaterThanOrEqual(item.count);
        }
      }
    }
  });

  it('每章中段敌军克制主焦点阵营，终章包含六族', () => {
    for (const chapter of CHAPTERS) {
      for (const stage of chapter.stages.slice(8, 16)) {
        const units = stage.waves.flatMap((wave) => wave.enemies).map((enemy) => HERO_BY_ID[enemy.unit] ?? mobById[enemy.unit]);
        expect(units.every((unit) => FACTIONS[unit.faction].counters === chapter.focusFactions[0])).toBe(true);
      }
    }
    const lastFactions = new Set(CHAPTERS[5].stages.flatMap((stage) => stage.waves.flatMap((wave) => wave.enemies))
      .map((enemy) => (HERO_BY_ID[enemy.unit] ?? mobById[enemy.unit]).faction));
    expect(lastFactions.size).toBe(6);
  });

  it('规则恰好覆盖三分之一关卡并有变化，赤壁体现水火联动', () => {
    const rules = stages.flatMap((stage) => stage.rule ? [stage.rule] : []);
    expect(rules).toHaveLength(48);
    expect(new Set(rules).size).toBe(48);
    expect(CHAPTERS[2].stages.some((stage) => stage.rule?.includes('淋湿') && stage.rule.includes('火焰'))).toBe(true);
    const copy = CHAPTERS.flatMap((chapter) => [chapter.name, chapter.intro, chapter.theme, chapter.bossNote,
      ...chapter.stages.flatMap((stage) => [stage.name, stage.rule ?? ''])]).join('');
    expect(copy).not.toMatch(/[a-zA-Z]/);
  });

  it('开场、中场与首领前后剧情挂接符合约定', () => {
    for (const chapter of CHAPTERS) {
      expect(chapter.stages[0].storyId).toBe(`c${chapter.id}_open`);
      expect(chapter.stages[11].storyId).toBe(`c${chapter.id}_mid`);
      expect(chapter.stages[23].storyId).toBe(`c${chapter.id}_boss_pre`);
      expect(chapter.stages[23].storyPostId).toBe(`c${chapter.id}_boss_post`);
      expect(chapter.stages.filter((stage) => stage.storyId)).toHaveLength(3);
      expect(chapter.stages.filter((stage) => stage.storyPostId)).toHaveLength(1);
    }
  });
});
