import { describe, expect, it } from 'vitest';
import { simulate } from '../src/engine/battle';
import { HEROES } from '../src/data/heroes';
import { KITS } from '../src/data/kits';
import type { UnitSetup } from '../src/engine/types';

const team = (ids: string[], lv = 60, extra: Partial<UnitSetup> = {}): UnitSetup[] => ids.map((heroId, i) => ({ heroId, level: lv, pos: i, star: 5, awaken: 'A', skillLv: 9, ...extra }));
const A = ['shu_guanyunmiao', 'shu_zhangmiaofei', 'shu_zhugemiaoliang', 'shu_liumiaobei', 'wu_zhoumiaoyu'];
const B = ['qun_lvbuding', 'man_mengmiaohuo', 'xian_zuoci', 'wei_caomiaode', 'man_zhurong'];

describe('battle engine', () => {
  it('is deterministic for the same seed', () => {
    const r1 = simulate({ seed: 7, A: team(A), B: team(B) });
    const r2 = simulate({ seed: 7, A: team(A), B: team(B) });
    expect(JSON.stringify(r1.events)).toBe(JSON.stringify(r2.events));
  });
  it('always terminates with an end event', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const r = simulate({ seed, A: team(A), B: team(B) });
      expect(r.events.at(-1)?.t).toBe('end');
      expect(r.rounds).toBeLessThanOrEqual(30);
    }
  });
  it('hp never goes negative and dead units stop acting', () => {
    const r = simulate({ seed: 3, A: team(A), B: team(B) });
    const dead = new Set<number>();
    for (const e of r.events) {
      if (e.t === 'damage') expect(e.hp).toBeGreaterThanOrEqual(0);
      if (e.t === 'death') dead.add(e.uid);
      if (e.t === 'act') expect(dead.has(e.uid)).toBe(false);
      if (e.t === 'revive') dead.delete(e.uid);
    }
  });
  it('every kit hero can fight with both awakening branches', () => {
    for (const id of Object.keys(KITS)) {
      for (const aw of ['A', 'B'] as const) {
        const r = simulate({ seed: 11, A: team([id], 50, { awaken: aw }), B: team(['wei_xuhuchi', 'man_wutugu'], 50) });
        expect(r.events.some((e) => e.t === 'act')).toBe(true);
      }
    }
  });
  it('generic kit works for heroes without a handcrafted kit', () => {
    const ids = HEROES.map((h) => h.id);
    const r = simulate({ seed: 5, A: team(ids.slice(0, 5)), B: team(ids.slice(5, 10)) });
    expect(r.events.at(-1)?.t).toBe('end');
  });
  it('mirror matches are roughly balanced across seeds', () => {
    let a = 0;
    const n = 60;
    for (let seed = 1; seed <= n; seed++) if (simulate({ seed, A: team(A), B: team(A) }).winner === 'A') a++;
    expect(a / n).toBeGreaterThan(0.25);
    expect(a / n).toBeLessThan(0.75);
  });
});
