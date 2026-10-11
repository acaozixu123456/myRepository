import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';
import { QUESTS } from '../src/content/economy';
import type { QuestDef, RewardDef } from '../src/content/types';
import { createQuestState, claim, isClaimable, isQuestAvailable, normalizeQuestState, questProgress, rollover, track } from '../src/game/quests';
import { SAVE_KEY, load, newPlayer, save } from '../src/game/state';

const localTime = (year: number, month: number, day: number, hour = 12, minute = 0) => new Date(year, month - 1, day, hour, minute).getTime();
const NOW = localTime(2026, 10, 11);
const quest = (id: string): QuestDef => QUESTS.find((entry) => entry.id === id)!;
const storageOf = (value: unknown) => ({ getItem: () => JSON.stringify(value), setItem: () => undefined });

describe('quest progress', () => {
  it('starts empty and gives each player an independent ledger', () => {
    const a = newPlayer(NOW);
    const b = newPlayer(NOW);
    expect(a.quests).toEqual({ progress: {}, claimed: {}, dailyKey: '2026-10-11', weeklyKey: '2026-10-05' });
    track(a, 'login');
    expect(b.quests.progress).toEqual({});
    expect(b.pending).toEqual({});
  });

  it('counts a ten-pull in daily, weekly, lifetime and newbie tasks, with separate caps', () => {
    const s = newPlayer(NOW);
    track(s, 'recruit', 10);
    expect(questProgress(s, quest('daily_recruit'))).toBe(1);
    expect(questProgress(s, quest('weekly_recruit'))).toBe(10);
    expect(questProgress(s, quest('achievement_recruit_count_1'))).toBe(10);
    expect(questProgress(s, quest('achievement_recruit_count_2'))).toBe(10);
    expect(questProgress(s, quest('newbie_recruit'))).toBe(1);
    track(s, 'recruit', 15);
    expect(questProgress(s, quest('weekly_recruit'))).toBe(20);
    expect(questProgress(s, quest('achievement_recruit_count_2'))).toBe(25);
  });

  it.each([
    ['reach_stage', 'achievement_stage_reach_6', 48, 12],
    ['hero_level', 'achievement_hero_level_6', 40, 10],
    ['collect_hero', 'achievement_hero_collection_6', 12, 4],
  ])('keeps %s as a maximum rather than adding repeated observations', (type, id, high, low) => {
    const s = newPlayer(NOW);
    track(s, type as string, high as number);
    track(s, type as string, low as number);
    track(s, type as string, high as number);
    expect(questProgress(s, quest(id as string))).toBe(high);
    track(s, type as string, Number.MAX_VALUE);
    expect(questProgress(s, quest(id as string))).toBe(quest(id as string).goal.target);
  });

  it('ignores invalid amounts and unknown goal types without changing any state', () => {
    const s = newPlayer(NOW);
    const before = structuredClone(s);
    for (const amount of [NaN, Infinity, -Infinity, 0, -1]) track(s, 'clear_stage', amount);
    track(s, 'not_a_goal', 100);
    track(s, 'constructor', 100);
    expect(s).toEqual(before);
  });

  it('does not grow completed or already claimed tasks', () => {
    const s = newPlayer(NOW);
    track(s, 'login');
    expect(claim(s, 'daily_login').ok).toBe(true);
    const before = structuredClone(s.quests);
    track(s, 'login', 10);
    expect(s.quests).toEqual(before);
  });

  it.each(['arena_battle', 'arena_win', 'guild_help', 'tower_clear', 'equip_upgrade', 'visit_friend'])('keeps unavailable %s tasks at zero and forbids forged claims', (type) => {
    const s = newPlayer(NOW);
    const entries = QUESTS.filter((entry) => entry.goal.type === type);
    expect(entries.length).toBeGreaterThan(0);
    const before = structuredClone(s);
    track(s, type, 999999);
    expect(s).toEqual(before);
    for (const entry of entries) {
      s.quests.progress[entry.id] = entry.goal.target;
      expect(isQuestAvailable(entry)).toBe(false);
      expect(questProgress(s, entry)).toBe(0);
      expect(isClaimable(s, entry)).toBe(false);
      const forged = structuredClone(s);
      expect(claim(s, entry.id).ok).toBe(false);
      expect(s).toEqual(forged);
    }
  });
});

describe('quest periods', () => {
  it('uses local 5 AM, including the year boundary', () => {
    expect(createQuestState(localTime(2026, 10, 12, 4, 59))).toMatchObject({ dailyKey: '2026-10-11', weeklyKey: '2026-10-05' });
    expect(createQuestState(localTime(2026, 10, 12, 5))).toMatchObject({ dailyKey: '2026-10-12', weeklyKey: '2026-10-12' });
    expect(createQuestState(localTime(2027, 1, 1, 4, 59))).toMatchObject({ dailyKey: '2026-12-31', weeklyKey: '2026-12-28' });
  });

  it('resets daily progress and claims without clearing weekly or permanent tasks', () => {
    const s = newPlayer(localTime(2026, 10, 12));
    track(s, 'login');
    track(s, 'clear_stage', 20);
    expect(claim(s, 'daily_campaign').ok).toBe(true);
    expect(claim(s, 'achievement_stage_clears_1').ok).toBe(true);
    expect(claim(s, 'newbie_arrive').ok).toBe(true);
    const res = structuredClone(s.res);
    expect(rollover(s, localTime(2026, 10, 13, 4, 59))).toBe(false);
    expect(rollover(s, localTime(2026, 10, 13, 5))).toBe(true);
    expect(questProgress(s, quest('daily_campaign'))).toBe(0);
    expect(s.quests.claimed.daily_campaign).toBeUndefined();
    expect(questProgress(s, quest('weekly_campaign'))).toBe(20);
    expect(questProgress(s, quest('achievement_stage_clears_1'))).toBe(20);
    expect(s.quests.claimed.achievement_stage_clears_1).toBe(true);
    expect(s.quests.claimed.newbie_arrive).toBe(true);
    expect(s.res).toEqual(res);
    expect(rollover(s, localTime(2026, 10, 13, 12))).toBe(false);
  });

  it('resets the week only at Monday 5 AM and permits the next daily claim', () => {
    const s = newPlayer(NOW);
    track(s, 'login');
    track(s, 'recruit', 20);
    expect(claim(s, 'daily_login').ok).toBe(true);
    expect(claim(s, 'weekly_recruit').ok).toBe(true);
    expect(rollover(s, localTime(2026, 10, 12, 4, 59))).toBe(false);
    expect(s.quests.claimed.weekly_recruit).toBe(true);
    expect(rollover(s, localTime(2026, 10, 12, 5))).toBe(true);
    expect(questProgress(s, quest('weekly_recruit'))).toBe(0);
    expect(s.quests.claimed.weekly_recruit).toBeUndefined();
    expect(questProgress(s, quest('achievement_recruit_count_2'))).toBe(20);
    track(s, 'login');
    expect(claim(s, 'daily_login').ok).toBe(true);
    expect(rollover(s, localTime(2026, 10, 12, 5))).toBe(false);
  });

  it('handles DST in an isolated real local timezone', async () => {
    const bundle = await build({
      stdin: {
        resolveDir: process.cwd(), sourcefile: 'quest-dst-check.ts', loader: 'ts',
        contents: `import { createQuestState } from './src/game/quests';
          const moments = [[2026, 2, 8, 4, 59], [2026, 2, 8, 5, 0], [2026, 2, 9, 0, 30], [2026, 10, 1, 5, 0]];
          console.log(JSON.stringify(moments.map(([y,m,d,h,min]) => createQuestState(new Date(y,m,d,h,min).getTime()))));`,
      },
      bundle: true, write: false, platform: 'node', format: 'esm',
    });
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', bundle.outputFiles[0].text], {
      env: { ...process.env, TZ: 'America/New_York' }, encoding: 'utf8', timeout: 5000,
    });
    expect(child.status, child.stderr).toBe(0);
    const results = JSON.parse(child.stdout);
    expect(results.map((entry: { dailyKey: string; weeklyKey: string }) => [entry.dailyKey, entry.weeklyKey])).toEqual([
      ['2026-03-07', '2026-03-02'], ['2026-03-08', '2026-03-02'],
      ['2026-03-08', '2026-03-02'], ['2026-11-01', '2026-10-26'],
    ]);
  });
});

describe('claiming quest rewards', () => {
  it('rejects incomplete, unknown and duplicate claims without side effects', () => {
    const s = newPlayer(NOW);
    const fresh = structuredClone(s);
    for (const id of ['daily_login', 'missing_quest', 'constructor', '__proto__']) expect(claim(s, id).ok).toBe(false);
    expect(s).toEqual(fresh);
    track(s, 'login');
    expect(isClaimable(s, quest('daily_login'))).toBe(true);
    expect(claim(s, 'daily_login')).toEqual({ ok: true, reward: quest('daily_login').reward });
    expect(s.res.fish).toBe(fresh.res.fish + 1000);
    expect(s.res.exp).toBe(fresh.res.exp + 100);
    expect(s.res.bells).toBe(fresh.res.bells + 10);
    expect(s.res.catnip).toBe(fresh.res.catnip + 2);
    expect(isClaimable(s, quest('daily_login'))).toBe(false);
    const claimed = structuredClone(s);
    expect(claim(s, 'daily_login').ok).toBe(false);
    expect(s).toEqual(claimed);
  });

  it('puts recruit tickets in their existing resource ledger', () => {
    const s = newPlayer(NOW);
    const before = structuredClone(s);
    track(s, 'login');
    expect(claim(s, 'newbie_arrive').ok).toBe(true);
    expect(s.res.tickets).toBe(before.res.tickets + 1);
    expect(s.inventory).toEqual(before.inventory);
    expect(s.pending).toEqual({});
    expect(s.exp).toBe(before.exp);
    expect(s.level).toBe(before.level);
    expect(s.idle).toEqual(before.idle);
  });

  it('converts all three catnip sizes by 1/4/16, adds duplicate item rows and returns a detached reward', () => {
    const entry = quest('daily_login');
    const original = entry.reward;
    const reward: RewardDef = { fish: 7, exp: 11, bells: 13, items: [
      { id: 'catnip_small', count: 1 }, { id: 'catnip_small', count: 1 },
      { id: 'catnip_medium', count: 3 }, { id: 'catnip_large', count: 1 },
      { id: 'recruit_ticket', count: 2 },
    ] };
    entry.reward = reward;
    try {
      const s = newPlayer(NOW);
      s.res.catnip = 2.5;
      const before = structuredClone(s.res);
      track(s, 'login');
      const result = claim(s, entry.id);
      expect(result).toEqual({ ok: true, reward });
      expect(s.res).toEqual({ ...before, fish: before.fish + 7, exp: before.exp + 11, bells: before.bells + 13, catnip: 32.5, tickets: before.tickets + 2 });
      if (result.ok) result.reward.items![0].count = 999;
      expect(reward.items![0].count).toBe(1);
    } finally { entry.reward = original; }
  });

  it('does not issue partial rewards or mark claimed if any reward entry is invalid', () => {
    const entry = quest('daily_login');
    const original = entry.reward;
    entry.reward = { fish: 1000, items: [{ id: 'catnip_small', count: Infinity }] };
    try {
      const s = newPlayer(NOW);
      track(s, 'login');
      const before = structuredClone(s);
      expect(claim(s, entry.id).ok).toBe(false);
      expect(s).toEqual(before);
    } finally { entry.reward = original; }
  });
});

describe('quest save migration', () => {
  it('loads an old save with empty task ledgers and preserves heroes, lineup, resources and inventory', () => {
    const current = newPlayer(NOW);
    current.name = '窗边军师';
    current.res.fish = 87654;
    current.heroes.wei_guojia.lv = 23;
    current.stage = { chapter: 3, index: 12, wins: 8 };
    current.inventory.items.fishbone_small = 17;
    current.inventory.equipment.push({ uid: 'eq_2', equipId: 'camp_rare_charm', level: 4, heroId: 'wei_guojia' });
    current.inventory.nextUid = 3;
    const { quests: _quests, pending: _pending, ...legacy } = current;
    const result = load(storageOf(legacy), NOW);
    expect(result).toEqual(current);
    expect(result.quests).toEqual(createQuestState(NOW));
    expect(result.pending).toEqual({});
  });

  it('sanitizes only broken task fields and keeps claimed bits that prevent double rewards', () => {
    const current = newPlayer(NOW);
    current.res.fish = 98765;
    const raw = { ...current, quests: {
      dailyKey: current.quests.dailyKey, weeklyKey: current.quests.weeklyKey,
      progress: { daily_campaign: 999, weekly_recruit: -2, daily_idle: '2', newbie_growth: NaN, achievement_hero_level_6: 20, daily_arena: 3, missing: 77 },
      claimed: { daily_login: true, newbie_arrive: true, weekly_growth: 'true', daily_arena: true, missing: true },
    }, pending: { fishbone_small: 3.9, bad: -1, broken: { toString: 1 }, infinity: Infinity } };
    const result = load(storageOf(raw), NOW);
    expect(result.res).toEqual(current.res);
    expect(result.heroes).toEqual(current.heroes);
    expect(result.inventory).toEqual(current.inventory);
    expect(result.quests.progress).toEqual({ daily_campaign: 10, achievement_hero_level_6: 20, daily_login: 1, newbie_arrive: 1 });
    expect(result.quests.claimed).toEqual({ daily_login: true, newbie_arrive: true });
    expect(result.pending).toEqual({ fishbone_small: 3 });
    track(result, 'login');
    expect(claim(result, 'daily_login').ok).toBe(false);
  });

  it.each([null, [], { progress: [], claimed: 'broken' }, { dailyKey: { toString: 1 }, weeklyKey: null, progress: { daily_login: 1, weekly_recruit: 20 } }])('handles malformed quest ledgers without replacing the rest of a real save', (quests) => {
    const current = newPlayer(NOW);
    current.res.fish = 54321;
    current.heroes.wei_guojia.shards = 42;
    current.stage = { chapter: 4, index: 8, wins: 6 };
    const result = load(storageOf({ ...current, quests }), NOW);
    expect(result).toEqual({ ...current, quests: createQuestState(NOW) });
  });

  it('clears stale or unkeyed daily/weekly data and preserves permanent progress and rewards', () => {
    const raw = {
      dailyKey: '2026-10-04', weeklyKey: '2026-09-28',
      progress: { daily_login: 1, weekly_recruit: 20, newbie_recruit: 1, achievement_stage_reach_6: 96 },
      claimed: { daily_login: true, weekly_recruit: true, newbie_recruit: true },
    };
    const expected = { ...createQuestState(NOW), progress: { achievement_stage_reach_6: 96, newbie_recruit: 1 }, claimed: { newbie_recruit: true } };
    expect(normalizeQuestState(raw, NOW)).toEqual(expected);
    const { dailyKey: _daily, weeklyKey: _weekly, ...unkeyed } = raw;
    expect(normalizeQuestState(unkeyed, NOW)).toEqual(expected);
  });

  it('round-trips progress, claimed rewards and pending items without another grant', () => {
    const s = newPlayer(NOW);
    track(s, 'login');
    track(s, 'clear_stage', 4);
    expect(claim(s, 'daily_login').ok).toBe(true);
    s.pending.fishbone_small = 3;
    const mem = new Map<string, string>();
    const storage = { getItem: (id: string) => mem.get(id) ?? null, setItem: (id: string, value: string) => void mem.set(id, value) };
    save(storage, s);
    expect(mem.has(SAVE_KEY)).toBe(true);
    const result = load(storage, NOW);
    expect(result).toEqual(s);
    const before = structuredClone(result);
    expect(claim(result, 'daily_login').ok).toBe(false);
    expect(result).toEqual(before);
  });
});
