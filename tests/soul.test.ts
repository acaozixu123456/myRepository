import { describe, expect, it } from 'vitest';
import { SOUL_MARKS, SOUL_MAX, SOUL_PER, soulCost, soulMark, soulMul, soulUp } from '../src/game/soul';
import { heroPower, heroStats, newPlayer } from '../src/game/state';
import { lineupSetups } from '../src/game/stage';
import { simulate } from '../src/engine/battle';

describe('星魂', () => {
  it('★5 才能点亮；扣碎片；满级封顶；倍率每级 +1%', () => {
    const h = { star: 4, shards: 9999, soul: 0 };
    expect(soulUp(h, 'UR').ok).toBe(false);
    h.star = 5;
    expect(soulUp(h, 'UR')).toEqual({ ok: true });
    expect(h.soul).toBe(1); expect(h.shards).toBe(9999 - 30);
    expect(soulMul(h)).toBeCloseTo(1.01);
    const poor = { star: 5, shards: 1, soul: 0 };
    expect(soulUp(poor, 'SR').ok).toBe(false);
    const full = { star: 5, shards: 1e6, soul: SOUL_MAX };
    expect(soulUp(full, 'SR').ok).toBe(false);
    expect(soulMul(full)).toBeCloseTo(1 + SOUL_MAX * SOUL_PER);
  });
  it('费用随等级和稀有度单调递增；魂印按 5 级一档', () => {
    for (const r of ['SR', 'SSR', 'UR', 'SP'] as const) for (let n = 1; n < SOUL_MAX; n++) expect(soulCost(n, r)).toBeGreaterThan(soulCost(n - 1, r));
    expect(soulCost(0, 'SR')).toBeLessThan(soulCost(0, 'SSR'));
    expect(soulCost(0, 'UR')).toBeLessThan(soulCost(0, 'SP'));
    expect(soulMark({ soul: 4 })).toBeNull();
    expect(soulMark({ soul: 5 })?.name).toBe(SOUL_MARKS[0].name);
    expect(soulMark({ soul: 20 })?.name).toBe(SOUL_MARKS[3].name);
  });
  it('显示战力与实战口径一致：星魂同时抬高 heroStats 和战斗里的单位属性', () => {
    const s = newPlayer(1000);
    const id = s.lineup.find(Boolean)!;
    const h = s.heroes[id];
    const p0 = heroPower(h);
    const hp0 = simulate({ seed: 1, A: lineupSetups(s), B: lineupSetups(s) }).units.find((u) => u.side === 'A' && u.heroId === id)!.maxHp;
    h.star = 5; h.soul = SOUL_MAX;
    const base = { ...h, soul: 0 };
    expect(heroStats(h).hp).toBeGreaterThan(heroStats(base).hp);
    expect(heroPower(h)).toBeGreaterThan(p0);
    const hp1 = simulate({ seed: 1, A: lineupSetups(s), B: lineupSetups(s) }).units.find((u) => u.side === 'A' && u.heroId === id)!.maxHp;
    expect(hp1).toBeGreaterThan(hp0);
    // 满星魂的实战生命 ≈ 无星魂 ×1.20（再叠 ★5 本身的倍率）
    h.soul = 0;
    const hp2 = simulate({ seed: 1, A: lineupSetups(s), B: lineupSetups(s) }).units.find((u) => u.side === 'A' && u.heroId === id)!.maxHp;
    expect(hp1 / hp2).toBeCloseTo(1 + SOUL_MAX * SOUL_PER, 1);
  });
});
