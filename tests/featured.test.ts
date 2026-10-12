import { describe, expect, it } from 'vitest';
import { FEATURE_MUL, FEATURE_POOL, boostGain, featurePool, featureUsed, featuredGame, setPlaying } from '../src/game/featured';
import { ALL_SCENES } from '../src/world/levels';
import { sceneGames } from '../src/game/explore';
import { newPlayer } from '../src/game/state';

const DAY = 86400_000, T0 = Date.UTC(2026, 9, 12, 8);
const gain = () => ({ fish: 100, exp: 0, catnip: 1, bells: 0 });

describe('每日推荐小游戏', () => {
  it('候选都是已解锁场景里按星级结算的玩法；推荐池里的名字都有场景用到', () => {
    const s = newPlayer();
    for (const g of featurePool(s)) expect(FEATURE_POOL).toContain(g);
    const all = new Set(Object.keys(ALL_SCENES).map(Number).flatMap((c) => sceneGames(c)));
    for (const g of FEATURE_POOL) expect(all.has(g), `${g} 没有场景入口`).toBe(true);
    s.best = { chapter: 6, index: 1 };
    expect(featurePool(s).length).toBeGreaterThan(featurePool(newPlayer()).length);
  });
  it('同一天固定，一个月里会轮到好几个不同的', () => {
    const s = newPlayer(); s.best = { chapter: 6, index: 1 };
    expect(featuredGame(s, T0)).toBe(featuredGame(s, T0 + 3600_000));
    const seen = new Set<string | null>();
    for (let d = 0; d < 30; d++) seen.add(featuredGame(s, T0 + d * DAY));
    expect(seen.size).toBeGreaterThan(5);
  });
  it('玩今天的推荐、拿到奖励时翻倍一次；别的游戏、没奖励、第二次都不翻；隔天恢复', () => {
    const s = newPlayer(); s.best = { chapter: 6, index: 1 };
    const feat = featuredGame(s, T0)!, other = featurePool(s).find((g) => g !== feat)!;
    setPlaying(other); expect(boostGain(s, gain(), undefined, T0).fish).toBe(100);
    setPlaying(feat); expect(boostGain(s, { fish: 0, exp: 0, catnip: 0, bells: 0 }, undefined, T0).fish).toBe(0);
    expect(featureUsed(s, T0)).toBe(false);
    let toasted = 0;
    const g = gain(), out = boostGain(s, g, () => toasted++, T0);
    expect(out).toBe(g); expect(g.fish).toBe(100 * FEATURE_MUL); expect(g.catnip).toBe(FEATURE_MUL); expect(toasted).toBe(1);
    expect(boostGain(s, gain(), undefined, T0).fish).toBe(100);
    const feat2 = featuredGame(s, T0 + DAY)!;
    setPlaying(feat2); expect(boostGain(s, gain(), undefined, T0 + DAY).fish).toBe(100 * FEATURE_MUL);
    setPlaying(null);
  });
});
