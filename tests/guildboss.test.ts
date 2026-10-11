import { describe, expect, it } from 'vitest';
import { GUILDS, guildLevel, joinGuild } from '../src/game/guild';
import {
  GB_ATTEMPTS, GB_KILL, GB_PERSONAL, ensureGB, gbAttemptsLeft, gbBoard, gbClaimKill, gbClaimPersonal, gbFinish, gbProgress, gbStage, gbStart, guildBossHp, guildBossOf, memberBars,
} from '../src/game/guildboss';
import { itemCount } from '../src/game/inventory';
import { newPlayer } from '../src/game/state';
import { bossOfWeek } from '../src/game/worldboss';

const at = (day: number, hour = 12) => new Date(2026, 9, 5 + day, hour).getTime(); // 2026-10-05 周一

describe('公会 Boss', () => {
  it('每周的公会 Boss 一周内不变，且永远不与世界 Boss 相同', () => {
    for (let w = 0; w < 12; w++) {
      expect(guildBossOf(at(7 * w)).id).toBe(guildBossOf(at(7 * w + 6)).id);
      expect(guildBossOf(at(7 * w)).id).not.toBe(bossOfWeek(at(7 * w)).id);
    }
  });
  it('没入会不能打；每天 2 次，次日重置；战斗关卡是单只 Boss', () => {
    const s = newPlayer(0);
    expect(gbStart(s, at(0)).ok).toBe(false); expect(gbProgress(s, at(0))).toBeNull();
    joinGuild(s, 'g_box', at(0));
    for (let i = 0; i < GB_ATTEMPTS; i++) expect(gbStart(s, at(0)).ok).toBe(true);
    expect(gbStart(s, at(0)).ok).toBe(false);
    expect(gbAttemptsLeft(s, at(1))).toBe(GB_ATTEMPTS);
    const st = gbStage(s, at(0));
    expect(st.kind).toBe('boss'); expect(st.waves[0].enemies).toHaveLength(1); expect(st.waves[0].enemies[0].unit).toBe(guildBossOf(at(0)).hero);
  });
  it('成员贡献是确定的；血量随公会等级增厚；周内累计只增不减', () => {
    expect(memberBars('n01', 100, at(0))).toBe(memberBars('n01', 100, at(0)));
    expect(guildBossHp(GUILDS[0], at(200))).toBeGreaterThanOrEqual(guildBossHp(GUILDS[0], at(0)));
    expect(guildBossHp(GUILDS[0], at(0))).toBe(guildBossHp(GUILDS[0], at(6, 23)));
    const s = newPlayer(0); joinGuild(s, 'g_sun', at(0));
    let prev = 0;
    for (let d = 0; d < 7; d++) { const t = gbProgress(s, at(d))!.total; expect(t).toBeGreaterThanOrEqual(prev); prev = t; }
    expect(gbBoard(s, at(3))).toHaveLength(GUILDS[1].members.length + 1);
  });
  it('结算累计个人伤害、给小鱼干和鱼牌、计入公会贡献；个人档位只领一次', () => {
    const s = newPlayer(0); joinGuild(s, 'g_box', at(0));
    const fish = s.res.fish;
    const r = gbFinish(s, 0.5, at(0));
    expect(r.pct).toBe(0.5); expect(s.res.fish).toBeGreaterThan(fish); expect(itemCount(s, 'guild_token')).toBeGreaterThan(0);
    expect(gbClaimPersonal(s, 0, at(0)).ok).toBe(false);
    for (let i = 0; i < 3; i++) gbFinish(s, 0.9, at(0));
    expect(ensureGB(s, at(0)).bars).toBeGreaterThan(GB_PERSONAL[0].bars);
    expect(gbClaimPersonal(s, 0, at(0)).ok).toBe(true); expect(gbClaimPersonal(s, 0, at(0)).ok).toBe(false);
    expect(gbClaimPersonal(s, 2, at(0)).ok).toBe(false);
    expect(ensureGB(s, at(7)).bars).toBe(0);
  });
  it('讨伐奖：公会累计达到总血量 + 自己出过手才能领，每周一次', () => {
    const s = newPlayer(0); joinGuild(s, 'g_box', at(0));
    expect(gbClaimKill(s, at(0)).ok).toBe(false);
    // 周末所有成员累计早已超过血量；但自己没出手不能领
    expect(gbProgress(s, at(6, 23))!.defeated).toBe(true);
    expect(gbClaimKill(s, at(6, 23)).ok).toBe(false);
    gbFinish(s, 0.2, at(6, 22));
    const tokens = itemCount(s, 'guild_token');
    const r = gbClaimKill(s, at(6, 23));
    expect(r.ok).toBe(true); expect(itemCount(s, 'guild_token') - tokens).toBe(GB_KILL.items!.guild_token);
    expect(gbClaimKill(s, at(6, 23)).ok).toBe(false);
    expect(guildLevel(GUILDS[0], at(0)).level).toBeGreaterThan(0);
  });
});
