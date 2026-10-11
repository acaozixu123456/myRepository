import { describe, expect, it } from 'vitest';
import { itemCount } from '../src/game/inventory';
import { NPCS, NPC_BY_ID, npcOnline } from '../src/game/npc';
import {
  ARENA_EXTRA_COST, ARENA_FREE, ARENA_START, CHAT_GAP_MS, CHAT_MAX_LEN, FRIEND_MAX, addFriend, announce, arenaBoard, arenaBuyExtra, arenaFinish, arenaLeft, arenaStage, arenaStart,
  canVisit, chatFeed, ensureSocial, markRead, sendChat, unreadCount, visitFriend,
} from '../src/game/social';
import { newPlayer, teamPower } from '../src/game/state';
import { simulate } from '../src/engine/battle';
import { waveSetups, lineupSetups } from '../src/game/stage';
import { questProgress, isQuestAvailable } from '../src/game/quests';
import { QUESTS } from '../src/content/economy';

const at = (day: number, hour: number, min = 0, sec = 0) => new Date(2026, 9, 1 + day, hour, min, sec).getTime();

describe('世界聊天', () => {
  it('发言校验：空、超长、过快', () => {
    const s = newPlayer(0); const t = at(5, 21);
    expect(sendChat(s, '   ', t).ok).toBe(false);
    expect(sendChat(s, 'a'.repeat(CHAT_MAX_LEN + 1), t).ok).toBe(false);
    expect(sendChat(s, '大家好', t).ok).toBe(true);
    expect(sendChat(s, '再来一句', t + CHAT_GAP_MS - 1).ok).toBe(false);
    expect(sendChat(s, '再来一句', t + CHAT_GAP_MS).ok).toBe(true);
  });
  it('我的发言出现在聊天流里，NPC 回应按延迟逐步出现，且之后保持稳定', () => {
    const s = newPlayer(0); const t = at(5, 21, 5);
    sendChat(s, '大家好，求推荐阵容？', t);
    const early = chatFeed(s, t + 1000);
    expect(early.some((m) => m.kind === 'me')).toBe(true);
    expect(early.some((m) => m.kind === 'reply' && m.id.startsWith('re:'))).toBe(false);
    const later = chatFeed(s, t + 60000);
    const replies = later.filter((m) => m.id.startsWith('re:'));
    expect(replies.length).toBeGreaterThanOrEqual(1);
    expect(replies.every((m) => npcOnline(NPC_BY_ID[m.from], t))).toBe(true);
    expect(chatFeed(s, t + 60000)).toEqual(later);
  });
  it('喜报与存档：只保留最近 40 条', () => {
    const s = newPlayer(0);
    for (let i = 0; i < 60; i++) announce(s, `喜报${i}`, at(5, 21) + i);
    expect(ensureSocial(s).mine).toHaveLength(40);
    expect(chatFeed(s, at(5, 22), 6).filter((m) => m.kind === 'sys' && m.text.startsWith('喜报')).length).toBeGreaterThan(0);
  });
  it('未读数：已读后清零，之后随时间重新增加，封顶 99', () => {
    const s = newPlayer(0); const t = at(6, 21);
    expect(unreadCount(s, t)).toBeGreaterThan(0);
    markRead(s, t); expect(unreadCount(s, t)).toBe(0);
    expect(unreadCount(s, t + 3600000)).toBeGreaterThan(0);
    expect(unreadCount(s, t + 10 * 24 * 3600000)).toBeLessThanOrEqual(99);
  });
});

describe('好友', () => {
  it('加好友、重复、上限；拜访每人每天一次并发奖励、计入任务（visit_friend 已开放）', () => {
    const s = newPlayer(0); const t = at(7, 12);
    expect(addFriend(s, 'n01').ok).toBe(true); expect(addFriend(s, 'n01').ok).toBe(false); expect(addFriend(s, 'zzz').ok).toBe(false);
    expect(visitFriend(s, 'n02', t).ok).toBe(false);
    const fish = s.res.fish; const r = visitFriend(s, 'n01', t);
    expect(r.ok).toBe(true); expect(s.res.fish).toBeGreaterThan(fish);
    expect(canVisit(s, 'n01', t + 1000)).toBe(false); expect(canVisit(s, 'n01', t + 86400000)).toBe(true);
    const q = QUESTS.find((x) => x.goal.type === 'visit_friend')!;
    expect(isQuestAvailable(q)).toBe(true); expect(questProgress(s, q)).toBe(1);
    for (const n of NPCS) addFriend(s, n.id);
    expect(ensureSocial(s).friends.length).toBeLessThanOrEqual(FRIEND_MAX);
  });
});

describe('竞技场', () => {
  it('每日 5 次，用完可买 5 次，次日重置', () => {
    const s = newPlayer(0); const t = at(8, 12);
    expect(arenaLeft(s, t)).toBe(ARENA_FREE);
    for (let i = 0; i < ARENA_FREE; i++) expect(arenaStart(s, t).ok).toBe(true);
    expect(arenaStart(s, t).ok).toBe(false);
    s.res.bells = 1000;
    expect(arenaBuyExtra(s, t).ok).toBe(true); expect(s.res.bells).toBe(1000 - ARENA_EXTRA_COST);
    expect(arenaStart(s, t).ok).toBe(true);
    for (let i = 0; i < 4; i++) arenaBuyExtra(s, t);
    expect(arenaBuyExtra(s, t).ok).toBe(false);
    expect(arenaLeft(s, t + 86400000)).toBe(ARENA_FREE);
  });
  it('结算：赢加分 / 输扣分、猫爪印入账、任务计数；Elo 对强者赢得更多', () => {
    const s = newPlayer(0); const t = at(10, 12);
    const weak = NPC_BY_ID.n19, strong = NPC_BY_ID.n20;
    const w = arenaFinish(s, weak.id, true, t);
    const s2 = newPlayer(0); const w2 = arenaFinish(s2, strong.id, true, t);
    expect(w2.delta).toBeGreaterThanOrEqual(w.delta);
    expect(itemCount(s, 'paw_seal')).toBe(w.paw);
    const l = arenaFinish(s, weak.id, false, t + 1);
    expect(l.delta).toBeLessThan(0);
    const q = QUESTS.find((x) => x.goal.type === 'arena_battle')!;
    expect(isQuestAvailable(q)).toBe(true); expect(questProgress(s, q)).toBeGreaterThan(0);
    expect(ensureSocial(s).arena.wins).toBe(1); expect(ensureSocial(s).arena.losses).toBe(1);
  });
  it('排行榜包含 20 位 NPC 与我，按积分降序', () => {
    const s = newPlayer(0); const b = arenaBoard(s, teamPower(s), at(10, 12));
    expect(b).toHaveLength(21); expect(b.filter((r) => r.me)).toHaveLength(1);
    for (let i = 1; i < b.length; i++) expect(b[i - 1].rating).toBeGreaterThanOrEqual(b[i].rating);
    expect(ensureSocial(s).arena.rating).toBe(ARENA_START);
  });
  it('NPC 关卡可以直接开打：阵容合法、引擎能跑完', () => {
    const s = newPlayer(0); const t = at(12, 12);
    for (const n of NPCS) {
      const st = arenaStage(n, t);
      expect(st.waves[0].enemies).toHaveLength(5);
      const sim = simulate({ seed: 3, A: lineupSetups(s), B: waveSetups(st, 0) });
      expect(['A', 'B']).toContain(sim.winner);
    }
  });
});
