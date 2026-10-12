import { describe, expect, it } from 'vitest';
import { BITE_WINDOW, DEX_TOTAL, FISH, FISH_DAILY_CAP, PERFECT_MS, biteDelay, castsLeft, dexCount, fishGain, judge, recordCatch, rollFish, useCast } from '../src/game/fishing';
import { mulberry } from '../src/fx/util';
import { newPlayer } from '../src/game/state';

describe('钓鱼规则', () => {
  it('判定：太早 / 太慢 / 普通 / 完美', () => {
    expect(judge(null, true)).toBe('early');
    expect(judge(null)).toBe('miss');
    expect(judge(BITE_WINDOW * 1000 + 1)).toBe('miss');
    expect(judge(PERFECT_MS)).toBe('perfect');
    expect(judge(PERFECT_MS + 1)).toBe('good');
    expect(judge(BITE_WINDOW * 1000)).toBe('good');
  });
  it('咬钩等待时间在 1.2~4 秒之间', () => {
    const r = mulberry(1);
    for (let i = 0; i < 200; i++) { const d = biteDelay(r); expect(d).toBeGreaterThanOrEqual(1.2); expect(d).toBeLessThanOrEqual(4); }
  });
  it('鱼表：id 唯一，越稀有越值钱，传说最值钱', () => {
    expect(new Set(FISH.map((f) => f.id)).size).toBe(FISH.length);
    const worth = (f: (typeof FISH)[number]) => f.fish + f.catnip * 2 + f.bells;
    const by = (r: string) => Math.max(...FISH.filter((f) => f.rarity === r).map(worth));
    expect(by('junk')).toBeLessThan(by('common'));
    expect(by('common')).toBeLessThan(by('fine'));
    expect(by('fine')).toBeLessThan(by('rare'));
    expect(by('rare')).toBeLessThan(by('legend'));
  });
  it('普通提竿能钓到杂物；完美提竿钓不到杂物，稀有以上更常见', () => {
    const N = 4000;
    const count = (grade: 'good' | 'perfect') => { const r = mulberry(7); const c = { junk: 0, rare: 0 }; for (let i = 0; i < N; i++) { const f = rollFish(r, grade); if (f.rarity === 'junk') c.junk++; if (f.rarity === 'rare' || f.rarity === 'legend') c.rare++; } return c; };
    const g = count('good'), p = count('perfect');
    expect(g.junk).toBeGreaterThan(0);
    expect(p.junk).toBe(0);
    expect(p.rare).toBeGreaterThan(g.rare);
  });
  it('奖励跟着主线进度涨：推得越远，同一种鱼越值钱', () => {
    const early = newPlayer(), late = newPlayer();
    late.best = { chapter: 3, index: 12 };
    const koi = FISH.find((f) => f.id === 'koi')!;
    expect(fishGain(late, koi).fish).toBeGreaterThan(fishGain(early, koi).fish);
    expect(fishGain(early, FISH[0]).fish).toBeGreaterThanOrEqual(1);
  });
  it('每天抛竿有上限，隔天刷新', () => {
    const s = newPlayer();
    const t0 = Date.UTC(2026, 9, 11, 12);
    for (let i = 0; i < FISH_DAILY_CAP; i++) expect(useCast(s, t0)).toBe(true);
    expect(useCast(s, t0)).toBe(false);
    expect(castsLeft(s, t0)).toBe(0);
    expect(castsLeft(s, t0 + 86400_000)).toBe(FISH_DAILY_CAP);
  });
  it('图鉴：同一种鱼只记一次，杂物不计', () => {
    const s = newPlayer();
    recordCatch(s, FISH.find((f) => f.id === 'koi')!);
    recordCatch(s, FISH.find((f) => f.id === 'koi')!);
    recordCatch(s, FISH.find((f) => f.id === 'boot')!);
    expect(dexCount(s)).toBe(1);
    expect(DEX_TOTAL).toBe(FISH.length - 1);
  });
});
