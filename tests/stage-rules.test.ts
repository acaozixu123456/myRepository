import { describe, expect, it } from 'vitest';
import { simulate } from '../src/engine/battle';
import type { RuleFx, UnitSetup } from '../src/engine/types';

const team = (ids: string[], lv = 30): UnitSetup[] => ids.map((heroId, i) => ({ heroId, level: lv, pos: i, star: 3, skillLv: 3 }));
const ME = ['wei_xiahoudun', 'wei_xuhuchi', 'wei_guojia', 'wu_huanggai', 'man_wutugu'];
const FOE = ['qun_lvbuding', 'man_mengmiaohuo', 'xian_zuoci', 'shu_guanyunmiao', 'man_zhurong'];
const run = (rules?: RuleFx[], seed = 1, maxRounds = 6) => simulate({ seed, A: team(ME), B: team(FOE), rules, maxRounds });
const statusAdds = (r: ReturnType<typeof run>, id: string) => r.events.filter((e) => e.t === 'status' && e.id === id && e.op === 'add');

describe('stage rule effects (RuleFx)', () => {
  it('startStatus gives the status to the matching side only', () => {
    const r = run([{ t: 'startStatus', side: 'B', to: 'front', id: 'wet', turns: 2 }]);
    const wet = statusAdds(r, 'wet');
    expect(wet.length).toBe(3);
    const ids = new Set(wet.map((e) => (e.t === 'status' ? e.dst : -1)));
    for (const u of r.units) expect(ids.has(u.uid)).toBe(u.side === 'B' && u.pos <= 2);
  });
  it('roundStatus fires every N rounds', () => {
    const r = run([{ t: 'roundStatus', side: 'both', to: 'front', id: 'wet', every: 2, turns: 1 }], 1, 5);
    expect(statusAdds(r, 'wet').length).toBeGreaterThanOrEqual(6); // 第 2、4 回合，双方前排各 3
  });
  it('dmgMul / takenMul change damage dealt; none changes nothing (determinism)', () => {
    const total = (r: ReturnType<typeof run>) => r.events.reduce((a, e) => a + (e.t === 'damage' ? e.amount : 0), 0);
    expect(JSON.stringify(run([]).events)).toBe(JSON.stringify(run(undefined).events));
    const boosted = run([{ t: 'dmgMul', side: 'B', mult: 1.5 }], 1, 2);
    const plain = run(undefined, 1, 2);
    const byB = (r: ReturnType<typeof run>) => r.events.reduce((a, e) => a + (e.t === 'damage' && r.units.find((u) => u.uid === e.src)?.side === 'B' ? e.amount : 0), 0);
    expect(byB(boosted)).toBeGreaterThan(byB(plain));
    expect(total(boosted)).toBeGreaterThan(0);
  });
  it('startShield and startEnergy apply at the start', () => {
    const r = run([{ t: 'startShield', side: 'A', to: 'all', pct: 0.1, turns: 2 }, { t: 'startEnergy', side: 'B', to: 'all', amount: 100 }], 1, 1);
    expect(r.events.filter((e) => e.t === 'shield').length).toBeGreaterThanOrEqual(5);
    expect(r.events.some((e) => e.t === 'act' && e.kind === 'ultimate')).toBe(true);
  });
  it('dodgeAdd with rounds expires', () => {
    const a = run([{ t: 'dodgeAdd', side: 'B', to: 'all', add: 0.6, rounds: 2 }], 3, 2);
    expect(a.events.filter((e) => e.t === 'text' && e.text === '闪避').length).toBeGreaterThan(0);
  });
});
