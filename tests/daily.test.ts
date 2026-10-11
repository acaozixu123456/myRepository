import { describe, expect, it } from 'vitest';
import { FAST_COST, FAST_FREE, FAST_MAX, FAST_MINUTES, SIGNIN_REWARDS, canSign, fastExplore, fastFree, nextSignDay, signIn } from '../src/game/daily';
import { grantOnce } from '../src/game/premium';
import { idleRate } from '../src/game/stage';
import { newPlayer } from '../src/game/state';

const D = 86400000;
const t0 = new Date(2026, 9, 12, 10).getTime();

describe('七日签到', () => {
  it('每天一次，七天一轮，漏签不清零', () => {
    const s = newPlayer(0);
    expect(canSign(s, t0)).toBe(true);
    const r1 = signIn(s, t0);
    expect(r1.ok && r1.day).toBe(1);
    expect(signIn(s, t0 + 1000).ok).toBe(false);
    expect(canSign(s, t0 + D)).toBe(true);
    // 隔了三天才来：从第 2 天继续，而不是回到第 1 天
    const r2 = signIn(s, t0 + 4 * D);
    expect(r2.ok && r2.day).toBe(2);
    for (let i = 0; i < 5; i++) signIn(s, t0 + (5 + i) * D);
    expect(nextSignDay(s)).toBe(1); // 满七天回到第一天
    expect(s.daily!.signTotal).toBe(7);
  });
  it('奖励入账；VIP3 起翻倍', () => {
    const a = newPlayer(0); const r = signIn(a, t0);
    expect(r.ok && r.doubled).toBe(false); expect(a.res.fish).toBe(3000 + SIGNIN_REWARDS[0].fish!);
    const b = newPlayer(0); grantOnce(b, 'x', 100 * 10);
    const rb = signIn(b, t0);
    expect(rb.ok && rb.doubled).toBe(true); expect(b.res.fish).toBe(3000 + SIGNIN_REWARDS[0].fish! * 2);
  });
  it('第七天含免费月光珠与招福符，整周价值递增', () => {
    const s = newPlayer(0); const tickets = s.res.tickets;
    for (let i = 0; i < 7; i++) signIn(s, t0 + i * D);
    expect(s.res.moon).toBe(100); expect(s.res.tickets).toBe(tickets + 3 + 10);
  });
});

describe('快速探索', () => {
  it('免费一次，之后每次花金铃铛，每天最多 6 次，次日重置', () => {
    const s = newPlayer(0); s.res.bells = 10000;
    expect(fastFree(s, t0)).toBe(FAST_FREE);
    const f0 = s.res.fish; const r = fastExplore(s, t0);
    expect(r.ok && !r.paid).toBe(true);
    expect(s.res.fish - f0).toBe(Math.round(idleRate(s).fish * FAST_MINUTES));
    expect(s.res.bells).toBe(10000);
    const r2 = fastExplore(s, t0 + 1000);
    expect(r2.ok && r2.paid).toBe(true); expect(s.res.bells).toBe(10000 - FAST_COST);
    for (let i = 2; i < FAST_MAX; i++) expect(fastExplore(s, t0 + 2000).ok).toBe(true);
    expect(fastExplore(s, t0 + 3000).ok).toBe(false);
    expect(fastFree(s, t0 + D)).toBe(FAST_FREE);
    expect(fastExplore(s, t0 + D).ok).toBe(true);
  });
  it('金铃铛不足时拒绝且不扣', () => {
    const s = newPlayer(0); s.res.bells = 10;
    fastExplore(s, t0);
    const b = s.res.bells; expect(fastExplore(s, t0 + 1).ok).toBe(false); expect(s.res.bells).toBe(b);
  });
});
