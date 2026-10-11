import { describe, expect, it } from 'vitest';
import { simulate } from '../src/engine/battle';
import type { UnitSetup } from '../src/engine/types';

const team = (ids: string[], lv = 40): UnitSetup[] => ids.map((heroId, i) => ({ heroId, level: lv, pos: i, star: 5, awaken: 'A', skillLv: 5 }));
const PEACH = ['shu_guanyunmiao', 'shu_zhangmiaofei', 'shu_liumiaobei', 'wei_guojia', 'wu_huanggai'];
const FOE = ['qun_lvbuding', 'man_mengmiaohuo', 'xian_zuoci', 'wei_caomiaode', 'man_zhurong'];

describe('named bonds', () => {
  it('桃园结义 raises the three members by 20%, noBonds turns it off', () => {
    const on = simulate({ seed: 1, A: team(PEACH), B: team(FOE), maxRounds: 1 });
    const off = simulate({ seed: 1, A: team(PEACH), B: team(FOE), maxRounds: 1, noBonds: true });
    const atk = (r: typeof on, id: string) => r.units.find((u) => u.heroId === id)!.atk;
    expect(atk(on, 'shu_guanyunmiao')).toBeGreaterThan(atk(off, 'shu_guanyunmiao') * 1.15);
    expect(atk(on, 'wu_huanggai')).toBe(atk(off, 'wu_huanggai')); // 非成员不受影响
  });
  it('桃园结义: a member falling gives the others a fluff buff', () => {
    let seen = false;
    for (let seed = 1; seed <= 40 && !seen; seed++) {
      const r = simulate({ seed, A: team(PEACH, 30), B: team(FOE, 60) });
      seen = r.events.some((e) => e.t === 'text' && e.text === '桃园·结义');
    }
    expect(seen).toBe(true);
  });
});
