import { describe, expect, it } from 'vitest';
import {
  DONATE_COST, DONATE_PER_DAY, GUILDS, GUILD_MAX_LEVEL, HELP_PER_DAY, chestReward, ensureGuild, guildChest, guildDonate, guildHelp, guildLevel, guildMemberBoard,
  guildWeekBoard, helpTarget, joinGuild, leaveGuild, memberDaily, myGuild,
} from '../src/game/guild';
import { itemCount } from '../src/game/inventory';
import { NPCS } from '../src/game/npc';
import { questProgress } from '../src/game/quests';
import { newPlayer } from '../src/game/state';
import { QUESTS } from '../src/content/economy';

const at = (day: number, hour = 12) => new Date(2026, 9, 5 + day, hour).getTime();

describe('公会数据', () => {
  it('三个公会、成员互不重叠且都是已登记的模拟玩家', () => {
    const all = GUILDS.flatMap((g) => g.members);
    expect(new Set(all).size).toBe(all.length);
    expect(all.sort()).toEqual(NPCS.map((n) => n.id).sort());
    expect(new Set(GUILDS.map((g) => g.name)).size).toBe(3);
  });
  it('成员贡献是时间的纯函数，公会等级随时间单调不降且封顶', () => {
    expect(memberDaily('n01', 3)).toBe(memberDaily('n01', 3));
    for (const g of GUILDS) {
      let prev = 0;
      for (let d = 0; d < 400; d += 10) {
        const lv = guildLevel(g, at(d)).level;
        expect(lv).toBeGreaterThanOrEqual(prev); expect(lv).toBeLessThanOrEqual(GUILD_MAX_LEVEL); prev = lv;
      }
    }
    expect(guildLevel(GUILDS[0], at(0)).level).toBeGreaterThanOrEqual(1);
  });
});

describe('公会动作', () => {
  it('入会 / 退会：同一天退会不能再入会', () => {
    const s = newPlayer(0), t = at(0);
    expect(guildHelp(s, t).ok).toBe(false);
    expect(joinGuild(s, 'g_box', t).ok).toBe(true);
    expect(joinGuild(s, 'g_sun', t).ok).toBe(false);
    expect(myGuild(s)?.id).toBe('g_box');
    expect(leaveGuild(s, t).ok).toBe(true);
    expect(joinGuild(s, 'g_sun', t).ok).toBe(false);
    expect(joinGuild(s, 'g_sun', at(1)).ok).toBe(true);
    expect(joinGuild(s, 'nope', at(2)).ok).toBe(false);
  });
  it('互助每天 5 次，发鱼牌与小鱼干、计入任务，次日重置', () => {
    const s = newPlayer(0); joinGuild(s, 'g_box', at(0));
    const fish0 = s.res.fish;
    const targets = new Set<string>();
    for (let i = 0; i < HELP_PER_DAY; i++) { const r = guildHelp(s, at(0)); expect(r.ok).toBe(true); if (r.ok) targets.add(r.target); }
    expect(targets.size).toBe(HELP_PER_DAY);
    expect(guildHelp(s, at(0)).ok).toBe(false);
    expect(itemCount(s, 'guild_token')).toBe(10 * HELP_PER_DAY);
    expect(s.res.fish - fish0).toBe(500 * HELP_PER_DAY);
    const daily = QUESTS.find((q) => q.id === 'daily_guild')!;
    expect(questProgress(s, daily)).toBe(daily.goal.target);
    expect(guildHelp(s, at(1)).ok).toBe(true);
    expect(helpTarget(GUILDS[0], 100, 0)).toBe(GUILDS[0].members[100 % GUILDS[0].members.length]);
  });
  it('捐献扣小鱼干、每天 3 次、鱼干不足被拒', () => {
    const s = newPlayer(0); joinGuild(s, 'g_sun', at(0));
    s.res.fish = DONATE_COST * DONATE_PER_DAY + 10;
    for (let i = 0; i < DONATE_PER_DAY; i++) expect(guildDonate(s, at(0)).ok).toBe(true);
    expect(s.res.fish).toBe(10);
    expect(guildDonate(s, at(0)).ok).toBe(false);
    s.res.fish = 5;
    expect(guildDonate(s, at(1)).ok).toBe(false);
    expect(ensureGuild(s, at(0)).contrib).toBe(30 * DONATE_PER_DAY);
  });
  it('每日纸箱每天一次，奖励随公会等级', () => {
    const s = newPlayer(0); joinGuild(s, 'g_moon', at(0));
    const lv = guildLevel(GUILDS[2], at(0), 0).level;
    const r = guildChest(s, at(0));
    expect(r.ok && r.tokens).toBe(chestReward(lv).tokens);
    expect(guildChest(s, at(0)).ok).toBe(false);
    expect(guildChest(s, at(1)).ok).toBe(true);
    expect(chestReward(5).fish).toBeGreaterThan(chestReward(1).fish);
  });
  it('周榜：玩家贡献计入本公会与成员榜，下周清零', () => {
    const s = newPlayer(0); joinGuild(s, 'g_box', at(0));
    for (let i = 0; i < HELP_PER_DAY; i++) guildHelp(s, at(0));
    const me = guildMemberBoard(s, at(0)).find((r) => r.me)!;
    expect(me.score).toBe(10 * HELP_PER_DAY);
    expect(guildWeekBoard(at(0), s).find((w) => w.mine)?.guild.id).toBe('g_box');
    expect(guildWeekBoard(at(0), s)).toHaveLength(3);
    expect(guildMemberBoard(s, at(14)).find((r) => r.me)!.score).toBe(0);
  });
});
