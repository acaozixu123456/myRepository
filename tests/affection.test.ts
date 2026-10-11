import { describe, expect, it } from 'vitest';
import { simulate } from '../src/engine/battle';
import {
  AFF_MAX_LEVEL, AFF_NAMES, AFF_THRESHOLDS, FISH_SNACK, MOON_SNACK, PET_GAIN, PET_PER_DAY, affLevel, affLevelOf, affLines, affMul, affProgress, ensureAff, feedSnack, petHero,
} from '../src/game/affection';
import { lineupSetups } from '../src/game/stage';
import { heroPower, heroStats, newPlayer } from '../src/game/state';

const at = (day: number) => new Date(2026, 9, 5 + day, 12).getTime();

describe('好感度', () => {
  it('阈值递增，等级名称齐全，每级加成 +1%、最高 +5%', () => {
    for (let i = 1; i < AFF_THRESHOLDS.length; i++) expect(AFF_THRESHOLDS[i]).toBeGreaterThan(AFF_THRESHOLDS[i - 1]);
    expect(AFF_NAMES).toHaveLength(AFF_THRESHOLDS.length);
    expect(affLevelOf(0)).toBe(0); expect(affLevelOf(29)).toBe(0); expect(affLevelOf(30)).toBe(1); expect(affLevelOf(10000)).toBe(AFF_MAX_LEVEL);
    const s = newPlayer(0); const h = s.heroes.wei_guojia;
    expect(affMul(h)).toBe(1); h.aff = { xp: 650, day: 0, pets: 0, fish: 0, moon: 0 };
    expect(affMul(h)).toBeCloseTo(1.05);
  });
  it('撸毛每天每只 3 次，次日重置；没有的猫不能撸', () => {
    const s = newPlayer(0);
    for (let i = 0; i < PET_PER_DAY; i++) { const r = petHero(s, 'wei_guojia', at(0)); expect(r.ok && r.gain).toBe(PET_GAIN); }
    expect(petHero(s, 'wei_guojia', at(0)).ok).toBe(false);
    expect(petHero(s, 'wei_guojia', at(1)).ok).toBe(true);
    expect(petHero(s, 'wu_zhoumiaoyu', at(0)).ok).toBe(false);
    expect(s.heroes.wei_guojia.aff!.xp).toBe(PET_GAIN * 4);
  });
  it('点心：小鱼干 / 月光珠各自每天 3 次，扣费、涨好感、不够钱被拒、升级会提示', () => {
    const s = newPlayer(0); s.res.fish = FISH_SNACK.cost * 3 + 5; s.res.moon = MOON_SNACK.cost * 3;
    for (let i = 0; i < 3; i++) expect(feedSnack(s, 'wei_guojia', 'fish', at(0)).ok).toBe(true);
    expect(s.res.fish).toBe(5);
    expect(feedSnack(s, 'wei_guojia', 'fish', at(0)).ok).toBe(false);
    s.res.fish = 1; expect(feedSnack(s, 'wei_guojia', 'fish', at(1)).ok).toBe(false);
    const r = feedSnack(s, 'wei_guojia', 'moon', at(0));
    expect(r.ok && r.gain).toBe(MOON_SNACK.gain); expect(s.res.moon).toBe(MOON_SNACK.cost * 2);
    expect(ensureAff(s.heroes.wei_guojia, at(0)).moon).toBe(1);
    const lv = feedSnack(newPlayer(0), 'wei_guojia', 'fish', at(0)); // 20 好感，未升级
    expect(lv.ok && lv.leveled).toBe(false);
    const s2 = newPlayer(0); s2.res.moon = 999; for (let i = 0; i < 2; i++) feedSnack(s2, 'wei_guojia', 'moon', at(0));
    expect(affLevel(s2.heroes.wei_guojia)).toBe(2); // 120 好感
    expect(affProgress(s2.heroes.wei_guojia).to).toBe(220);
  });
  it('好感加成真的进入属性、战力和战斗：满级 +5%', () => {
    const s = newPlayer(0); const h = s.heroes.wei_guojia;
    const before = { st: heroStats(h), p: heroPower(h) };
    h.aff = { xp: 650, day: 0, pets: 0, fish: 0, moon: 0 };
    const after = heroStats(h);
    expect(after.hp).toBeGreaterThan(before.st.hp); expect(after.atk / before.st.atk).toBeCloseTo(1.05, 1); expect(heroPower(h)).toBeGreaterThan(before.p);
    const setup = lineupSetups(s).find((u) => u.heroId === 'wei_guojia')!;
    expect(setup.statMul).toBeCloseTo(1.05);
    const hpOf = (st: typeof s) => simulate({ seed: 1, A: lineupSetups(st), B: lineupSetups(newPlayer(0)) }).units.find((u) => u.side === 'A' && u.heroId === 'wei_guojia')!.maxHp;
    expect(hpOf(s)).toBeGreaterThan(hpOf(newPlayer(0)));
  });
  it('好感语录随等级解锁，不超过当前等级', () => {
    expect(affLines('猫', '台词', '背景一。背景二。', 0)).toHaveLength(0);
    expect(affLines('猫', '台词', '背景一。背景二。', 1)).toHaveLength(1);
    expect(affLines('猫', '台词', '背景一。背景二。', 5)).toHaveLength(5);
    expect(affLines('猫', '台词', '背景一。背景二。', 3)[2].text).toBe('背景一。');
  });
});
