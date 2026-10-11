import { describe, expect, it } from 'vitest';
import { HEROES, PREMIUM_HEROES, STANDARD_HEROES } from '../src/data/heroes';
import { baseStats } from '../src/data/systems';
import { simulate } from '../src/engine/battle';
import {
  MONTH_CARD, MOON_PER_YUAN, SP_COST, SP_POOL, TOPUPS, VIP_MAX, VIP_STEPS, buyCard, buySpPack, canClaimCard, canClaimVip, claimCard, claimVip, dayIndex,
  ensurePay, grantOnce, pullSp, spRate, topUp, vipLevel, vipPerks,
} from '../src/game/premium';
import { idleCapHours } from '../src/game/stage';
import { newPlayer } from '../src/game/state';
import { Rng } from '../src/engine/rng';
const mulberry32 = (seed: number) => { const r = new Rng(seed); return () => r.next(); };

const DAY = 86400000;

describe('至尊 SP 角色', () => {
  it('只有 3 只 SP，且不进入常规卡池 / 平衡样本', () => {
    expect(PREMIUM_HEROES.map((h) => h.id).sort()).toEqual(['shu_pangmiaotong', 'wei_simamiyi', 'xian_changmiao']);
    expect(STANDARD_HEROES.some((h) => h.rarity === 'SP')).toBe(false);
    expect(HEROES.length).toBe(STANDARD_HEROES.length + 3);
  });
  it('基础属性明显高于 UR（≥ 25%）', () => {
    for (const h of PREMIUM_HEROES) {
      const sp = baseStats(h.role, 'SP'); const ur = baseStats(h.role, 'UR');
      expect(sp.hp / ur.hp).toBeGreaterThan(1.25); expect(sp.atk / ur.atk).toBeGreaterThan(1.25);
    }
  });
  it('SP 在同等练度下稳定击败 UR 阵容的对位', () => {
    let wins = 0; const N = 12;
    for (let seed = 1; seed <= N; seed++) {
      const A = [{ heroId: 'wei_simamiyi', level: 60, star: 5, pos: 3 }, { heroId: 'shu_pangmiaotong', level: 60, star: 5, pos: 4 }, { heroId: 'xian_changmiao', level: 60, star: 5, pos: 2 }];
      const B = ['wei_caomiaode', 'wu_zhoumiaoyu', 'qun_lvbuding'].map((heroId, i) => ({ heroId, level: 60, star: 5, pos: i + 2 }));
      const r = simulate({ seed, A, B }); if (r.winner === 'A') wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(10);
  });
});

describe('充值与 VIP', () => {
  it('档位入账、首充双倍只算一次、累计元数驱动 VIP', () => {
    const s = newPlayer(0);
    const r1 = topUp(s, 'moon68', 1000);
    expect(r1.ok && r1.first).toBe(true);
    const t = TOPUPS.find((x) => x.id === 'moon68')!;
    expect(s.res.moon).toBe(t.moon * 2 + t.bonus);
    const r2 = topUp(s, 'moon68', 2000);
    expect(r2.ok && r2.first).toBe(false);
    expect(s.res.moon).toBe(t.moon * 3 + t.bonus * 2);
    expect(s.pay!.total).toBe(136);
    expect(vipLevel(s)).toBe(VIP_STEPS.findLastIndex((n) => n <= 136));
    expect(topUp(s, 'nope').ok).toBe(false);
  });
  it('档位的基础月光珠 = 元 × 10，赠送随档位单调不降', () => {
    let last = -1;
    for (const t of TOPUPS) { expect(t.moon).toBe(t.yuan * MOON_PER_YUAN); expect(t.bonus / t.moon).toBeGreaterThanOrEqual(last); last = t.bonus / t.moon; }
  });
  it('VIP 权益随等级单调提高', () => {
    for (let lv = 1; lv <= VIP_MAX; lv++) {
      const a = vipPerks(lv - 1), b = vipPerks(lv);
      expect(b.idleRate).toBeGreaterThanOrEqual(a.idleRate); expect(b.dailyMoon).toBeGreaterThan(a.dailyMoon);
    }
  });
  it('VIP 加成体现在挂机上限', () => {
    const s = newPlayer(0); const base = idleCapHours(s);
    grantOnce(s, 'x', 200000);
    expect(vipLevel(s)).toBe(VIP_MAX);
    expect(idleCapHours(s)).toBe(base + vipPerks(VIP_MAX).idleCapHours);
  });
  it('一次性发放不会重复', () => {
    const s = newPlayer(0);
    expect(grantOnce(s, 'dev', 200000)).toBe(true);
    expect(grantOnce(s, 'dev', 200000)).toBe(false);
    expect(s.res.moon).toBe(200000);
    expect(vipLevel(s)).toBe(VIP_MAX);
  });
  it('月卡：立得 + 每天一次，到期失效，续费叠加', () => {
    const s = newPlayer(0); const t0 = 5 * DAY + 3600000;
    expect(canClaimCard(s, t0)).toBe(false);
    buyCard(s, t0);
    expect(s.res.moon).toBe(MONTH_CARD.instant);
    expect(canClaimCard(s, t0)).toBe(true);
    expect(claimCard(s, t0)?.moon).toBe(MONTH_CARD.daily);
    expect(claimCard(s, t0 + 1000)).toBeNull();
    expect(canClaimCard(s, t0 + DAY)).toBe(true);
    expect(canClaimCard(s, t0 + 31 * DAY)).toBe(false);
    const until = s.pay!.card!.until; buyCard(s, t0 + DAY);
    expect(s.pay!.card!.until).toBe(until + 30 * DAY);
  });
  it('VIP 每日福利一天一次', () => {
    const s = newPlayer(0); const t0 = 9 * DAY;
    expect(canClaimVip(s, t0)).toBe(false);
    topUp(s, 'moon30', t0);
    expect(canClaimVip(s, t0)).toBe(true);
    const m = s.res.moon; expect(claimVip(s, t0)).not.toBeNull();
    expect(s.res.moon).toBeGreaterThan(m); expect(claimVip(s, t0)).toBeNull();
    expect(canClaimVip(s, t0 + DAY)).toBe(true);
    expect(dayIndex(t0)).not.toBe(dayIndex(t0 + DAY));
  });
});

describe('至尊招募', () => {
  it('月光珠不足时拒绝，不扣费', () => {
    const s = newPlayer(0); ensurePay(s);
    const r = pullSp(s, 1);
    expect(r.ok).toBe(false); expect(s.res.moon).toBe(0);
  });
  it('单抽 / 十连扣费正确，十连至少 1 个 UR 及以上', () => {
    const s = newPlayer(0); s.res.moon = 100000;
    const rnd = mulberry32(5);
    const r = pullSp(s, 10, rnd);
    expect(r.ok).toBe(true); expect(s.res.moon).toBe(100000 - SP_COST.ten);
    if (r.ok) { expect(r.results).toHaveLength(10); expect(r.results.some((x) => x.rarity === 'SP' || x.rarity === 'UR')).toBe(true); expect(r.results.every((x) => x.rarity !== 'SR')).toBe(true); }
    pullSp(s, 1, rnd); expect(s.res.moon).toBe(100000 - SP_COST.ten - SP_COST.single);
  });
  it('硬保底：任意随机数下最多 60 抽必出 SP', () => {
    const s = newPlayer(0); s.res.moon = 1e7;
    let since = 0, max = 0;
    for (let i = 0; i < 2000; i++) {
      const r = pullSp(s, 1, () => 0.999);
      if (r.ok && r.results[0].rarity === 'SP') { max = Math.max(max, since + 1); since = 0; } else since++;
    }
    expect(max).toBeLessThanOrEqual(SP_POOL.pity);
    expect(spRate(SP_POOL.pity - 1)).toBe(1);
  });
  it('综合出货率约 3%~5%，歪一次后下次必出 UP', () => {
    const s = newPlayer(0); s.res.moon = 1e9;
    const rnd = mulberry32(99); let sp = 0; const N = 6000;
    for (let i = 0; i < N; i++) { const r = pullSp(s, 1, rnd); if (r.ok && r.results[0].rarity === 'SP') sp++; }
    expect(sp / N).toBeGreaterThan(0.025); expect(sp / N).toBeLessThan(0.06);
    const s2 = newPlayer(0); s2.res.moon = 1e6; ensurePay(s2).pity.upLost = true; s2.pay!.pity.sp = 59;
    const r = pullSp(s2, 1, () => 0.5);
    expect(r.ok && r.results[0].isUp && r.results[0].hero.id === PREMIUM_HEROES[0].id).toBe(true);
  });
  it('重复获得转为碎片；至尊礼包限购一次', () => {
    const s = newPlayer(0);
    const a = buySpPack(s, 'xian_changmiao', 1);
    expect(a.ok && a.result?.isNew).toBe(true); expect(s.heroes.xian_changmiao).toBeTruthy();
    expect(buySpPack(s, 'xian_changmiao', 2).ok).toBe(false);
    expect(buySpPack(newPlayer(0), 'wei_caomiaode').ok).toBe(false);
  });
});
