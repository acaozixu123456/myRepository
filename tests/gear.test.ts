import { describe, expect, it } from 'vitest';
import { EQUIPS, EQUIP_SETS } from '../src/content/equipment';
import { simulate } from '../src/engine/battle';
import type { UnitSetup } from '../src/engine/types';
import { heroGear } from '../src/game/gear';
import { addEquipment, equipEquipment } from '../src/game/inventory';
import { lineupSetups } from '../src/game/stage';
import { heroPower, newPlayer, teamPower } from '../src/game/state';

const team = (ids: string[], lv = 30, extra: Partial<UnitSetup> = {}): UnitSetup[] => ids.map((heroId, i) => ({ heroId, level: lv, pos: i, star: 3, skillLv: 3, ...extra }));
const ME = ['wei_xiahoudun', 'wei_xuhuchi', 'wei_guojia', 'wu_huanggai', 'man_wutugu'];
const FOE = ['qun_lvbuding', 'man_mengmiaohuo', 'xian_zuoci', 'shu_guanyunmiao', 'man_zhurong'];

function wear(s: ReturnType<typeof newPlayer>, heroId: string, setId: string, n = 4) {
  const pieces = EQUIPS.filter((e) => e.setId === setId).slice(0, n);
  for (const p of pieces) {
    const r = addEquipment(s, p.id);
    if (!r.ok) throw new Error(r.reason);
    expect(equipEquipment(s, r.uids[0], heroId).ok).toBe(true);
  }
}

describe('gear in battle', () => {
  it('flat stats and percent stats reach the unit', () => {
    const base = simulate({ seed: 1, A: team(ME), B: team(FOE), maxRounds: 1 });
    const geared = simulate({ seed: 1, A: team(ME, 30, { gear: { hp: 500, atk: 40, def: 25, spd: 6, crit: 0.1, dmgReduce: 0.2 } }), B: team(FOE), maxRounds: 1 });
    const u = (r: typeof base) => r.units.find((x) => x.heroId === 'wei_guojia')!;
    expect(u(geared).maxHp - u(base).maxHp).toBeGreaterThanOrEqual(500);
    expect(u(geared).atk - u(base).atk).toBeGreaterThanOrEqual(40); // 同阵营加成会再乘一点
    expect(u(geared).spd - u(base).spd).toBeGreaterThanOrEqual(6);
    expect(u(geared).crit - u(base).crit).toBeCloseTo(0.1);
    expect(u(geared).dmgReduce).toBeCloseTo(0.2);
  });
  it('damage reduction leaves the team with more health', () => {
    let tank = 0, plain = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const left = (r: ReturnType<typeof simulate>) => r.units.filter((u) => u.side === 'A').reduce((x, u) => x + u.hp / u.maxHp, 0);
      tank += left(simulate({ seed, A: team(ME, 30, { gear: { dmgReduce: 0.4 } }), B: team(FOE, 30), maxRounds: 3 }));
      plain += left(simulate({ seed, A: team(ME, 30), B: team(FOE, 30), maxRounds: 3 }));
    }
    expect(tank).toBeGreaterThan(plain);
  });
  it('四件套 effects fire: 虎卫玄甲 shield and 静夜锦囊 energy at battle start', () => {
    const r = simulate({ seed: 1, A: team(ME, 30, { set4: ['wei_tiger_guard', 'wei_sleep_strategy'] }), B: team(FOE), maxRounds: 1 });
    expect(r.events.some((e) => e.t === 'text' && e.text === '虎卫玄甲')).toBe(true);
    expect(r.events.some((e) => e.t === 'text' && e.text === '静夜锦囊')).toBe(true);
    expect(r.events.some((e) => e.t === 'shield')).toBe(true);
  });
  it('no gear keeps battles identical (determinism)', () => {
    const a = simulate({ seed: 5, A: team(ME), B: team(FOE) });
    const b = simulate({ seed: 5, A: team(ME, 30, { gear: {}, set4: [] }), B: team(FOE) });
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
  });
});

describe('all twelve 四件套', () => {
  it('run without errors and each shows its marker in some battle', () => {
    const all = EQUIP_SETS.map((x) => x.id);
    const markers = ['虎卫玄甲', '静夜锦囊', '桃园守约', '合上箱盖', '热毯反击', '琴火', '百兽应声', '云台免疫'];
    const seen = new Set<string>();
    const mine = ['wei_xiahoudun', 'wu_zhoumiaoyu', 'man_mengmiaohuo', 'xian_zuoci', 'shu_zhugemiaoliang'];
    for (let seed = 1; seed <= 40; seed++) {
      const r = simulate({ seed, A: team(mine, 40, { set4: all, gear: { dmgReduce: 0.05 } }), B: team(FOE, 50, { set4: all }), rules: [{ t: 'startStatus', side: 'B', to: 'all', id: 'wet', turns: 3 }] });
      expect(r.events.at(-1)?.t).toBe('end');
      for (const e of r.events) if (e.t === 'text') seen.add(e.text);
    }
    for (const m of markers) expect(seen.has(m), m).toBe(true);
  });
});

describe('heroGear', () => {
  it('sums pieces and set panels, reports set4', () => {
    const s = newPlayer();
    const set = EQUIP_SETS.find((x) => x.id === 'wei_tiger_guard')!;
    wear(s, 'wei_xiahoudun', set.id, 2);
    const two = heroGear(s, 'wei_xiahoudun');
    expect(two.setCounts[set.id]).toBe(2);
    expect(two.set4).toEqual([]);
    wear(s, 'wei_guojia', set.id, 4);
    const four = heroGear(s, 'wei_guojia');
    expect(four.set4).toEqual([set.id]);
    expect((four.stats.dmgReduce ?? 0)).toBeGreaterThanOrEqual((set.bonus4.stats.dmgReduce ?? 0) + (set.bonus2.stats.dmgReduce ?? 0));
  });
  it('lineup setups and power include gear', () => {
    const s = newPlayer();
    const before = teamPower(s);
    wear(s, 'wei_xiahoudun', 'wei_tiger_guard', 4);
    expect(teamPower(s)).toBeGreaterThan(before);
    const setup = lineupSetups(s).find((x) => x.heroId === 'wei_xiahoudun')!;
    expect(setup.gear?.hp ?? setup.gear?.def ?? setup.gear?.atk).toBeGreaterThan(0);
    expect(setup.set4).toContain('wei_tiger_guard');
    expect(heroPower(s.heroes['wei_xiahoudun'])).toBeLessThan(heroPower(s.heroes['wei_xiahoudun'], heroGear(s, 'wei_xiahoudun').stats));
  });
});
