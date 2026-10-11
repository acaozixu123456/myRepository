// 长程浸泡测试：把所有新玩法串起来连续玩 90 天（时间注入），每天随机做一批操作，
// 检查：不抛异常、资源与道具始终是非负有限数、存档序列化后能原样读回（含旧存档缺字段的迁移）。
import { describe, expect, it } from 'vitest';
import { Rng } from '../src/engine/rng';
import { claimIdle, tickIdle } from '../src/game/stage';
import { signIn } from '../src/game/daily';
import { arenaFinish, arenaStart, addFriend, visitFriend } from '../src/game/social';
import { NPCS } from '../src/game/npc';
import { guildChest, guildDonate, guildHelp, joinGuild } from '../src/game/guild';
import { finishAttempt, startAttempt } from '../src/game/worldboss';
import {
  PACKS, PASS_MAX, answerQuiz, buyGrowth, buyPack, buyPass, claimCarnival, claimCum, claimFirstPay, claimGrowth, claimPass, claimPull, claimRank, claimSprint, claimSprintChest, claimUp, claimOpen,
  claimFestival, ensureEvents, quizToday, setWishHero, spin, wish, SPRINT, CARNIVAL_TIERS, CUM_TIERS, GROWTH_TIERS, PULL_TIERS, UP_TIERS, buyFestivalPack,
} from '../src/game/events';
import { POOLS, pull } from '../src/game/gacha';
import { buyCard, claimCard, claimVip, topUp, TOPUPS } from '../src/game/premium';
import { track } from '../src/game/quests';
import { load, newPlayer, save } from '../src/game/state';
import type { PlayerState } from '../src/game/state';
import { itemCount } from '../src/game/inventory';

const H = 3600000;
const sane = (s: PlayerState) => {
  for (const [k, v] of Object.entries(s.res)) { expect(Number.isFinite(v), `res.${k}`).toBe(true); expect(v, `res.${k}`).toBeGreaterThanOrEqual(0); }
  for (const [id, n] of Object.entries(s.inventory.items)) { expect(Number.isFinite(n), id).toBe(true); expect(n, id).toBeGreaterThanOrEqual(0); }
  for (const h of Object.values(s.heroes)) { expect(Number.isFinite(h.shards)).toBe(true); expect(h.shards).toBeGreaterThanOrEqual(0); }
  const e = s.events;
  if (e) for (const v of [e.pts, e.xp, e.pulls, e.up.pulls, e.weekYuan, e.dayPts]) { expect(Number.isFinite(v)).toBe(true); expect(v).toBeGreaterThanOrEqual(0); }
};

describe('长程浸泡：90 天、全部玩法', () => {
  it.each([1, 2, 3])('种子 %i：每天随机操作不出错，存档可读回', (seed) => {
    const rng = new Rng(seed * 7919);
    const s = newPlayer(new Date(2026, 9, 5).getTime());
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    const day0 = new Date(2026, 9, 5).getTime();
    s.res.tickets = 30; s.res.bells = 5000;
    for (let day = 0; day < 90; day++) {
      const now = day0 + day * 24 * H;
      const t = (h: number) => now + h * H;
      const p = (x: number) => rng.next() < x;
      track(s, 'login');
      tickIdle(s, t(8)); claimIdle(s);
      if (p(0.9)) signIn(s, t(8));
      if (p(0.7)) for (const n of NPCS.slice(0, 5)) { addFriend(s, n.id); visitFriend(s, n.id, t(10)); }
      if (p(0.6)) for (let i = 0; i < 5; i++) if (arenaStart(s, t(12)).ok) arenaFinish(s, NPCS[i].id, rng.next() < 0.5, t(12));
      if (p(0.5)) { joinGuild(s, ['g_box', 'g_sun', 'g_moon'][seed % 3], t(9)); guildChest(s, t(9)); for (let i = 0; i < 5; i++) guildHelp(s, t(9)); guildDonate(s, t(9)); }
      if (p(0.6)) for (let i = 0; i < 3; i++) if (startAttempt(s, t(11)).ok) finishAttempt(s, rng.next(), t(11));
      if (p(0.8)) for (let i = 0; i < 12; i++) { s.res.fish += 1000; track(s, 'clear_stage'); }
      s.best = { chapter: 1 + Math.min(5, Math.floor(day / 15)), index: 1 + ((day * 3) % 24) };
      if (p(0.5)) { try { pull(s, POOLS[rng.next() < 0.5 ? 0 : 1], rng.next() < 0.5 ? 1 : 10, () => rng.next()); } catch { throw new Error('pull failed'); } }
      // 活动中心
      for (let i = 0; i < 6; i++) spin(s, 0, false, () => rng.next(), t(13));
      for (const q of quizToday(t(13))) if (p(0.8)) answerQuiz(s, p(0.6) ? q.a : 0, t(13));
      setWishHero(s, 'wei_guojia', t(13)); if (p(0.85)) wish(s, 0, false, t(13));
      for (let i = 0; i < CARNIVAL_TIERS.length; i++) claimCarnival(s, i, t(22));
      for (let i = 0; i < SPRINT.length; i++) claimSprint(s, i, t(22));
      claimSprintChest(s, t(22)); claimOpen(s, t(22)); claimRank(s, t(22));
      for (let i = 0; i < PULL_TIERS.length; i++) claimPull(s, i, t(22));
      for (let i = 0; i < UP_TIERS.length; i++) claimUp(s, i, t(22));
      claimFestival(s, day % 7, t(22));
      for (let l = 1; l <= PASS_MAX; l++) claimPass(s, 'free', l, t(22));
      // 氪金（模拟支付）：偶尔发生
      if (p(0.08)) topUp(s, TOPUPS[Math.floor(rng.next() * TOPUPS.length)].id, t(14));
      if (p(0.03)) buyCard(s, t(14)); claimCard(s, t(14)); claimVip(s, t(14));
      if (p(0.05)) buyPack(s, PACKS[Math.floor(rng.next() * PACKS.length)].id, t(14));
      if (p(0.02)) buyGrowth(s, t(14));
      if (p(0.02)) buyPass(s, rng.next() < 0.5 ? 1 : 2, t(14));
      if (p(0.03)) buyFestivalPack(s, t(14));
      claimFirstPay(s, t(14));
      for (let i = 0; i < CUM_TIERS.length; i++) claimCum(s, i, t(22));
      for (let i = 0; i < GROWTH_TIERS.length; i++) claimGrowth(s, i, t(22));
      for (let l = 1; l <= PASS_MAX; l++) { claimPass(s, 'prem', l, t(22)); claimPass(s, 'lux', l, t(22)); }
      sane(s);
      if (day % 10 === 0) {
        save(storage, s);
        const back = load(storage, t(23));
        expect(JSON.stringify(back.events)).toBe(JSON.stringify(s.events));
        expect(back.res).toEqual(s.res);
      }
    }
    // 90 天的累计检查
    const e = ensureEvents(s, day0 + 90 * 24 * H);
    expect(e.spinTotal).toBeGreaterThan(300);
    expect(itemCount(s, 'guild_token')).toBeGreaterThan(0);
    expect(s.pay === undefined || s.pay.total >= 0).toBe(true);
  });

  it('旧存档（没有任何新字段）读取后，所有新系统都能正常初始化', () => {
    const base = newPlayer(0) as unknown as Record<string, unknown>;
    for (const k of ['events', 'guild', 'wboss', 'social', 'pay', 'daily', 'dungeon']) delete base[k];
    const storage = { getItem: () => JSON.stringify(base), setItem: () => undefined };
    const s = load(storage, 5 * 24 * H);
    expect(() => { ensureEvents(s); joinGuild(s, 'g_box'); startAttempt(s); spin(s, 0, false); }).not.toThrow();
    sane(s);
  });
});
