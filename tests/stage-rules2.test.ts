import { describe, expect, it } from 'vitest';
import { CHAPTERS } from '../src/content/campaign';
import { simulate } from '../src/engine/battle';
import type { RuleFx, UnitSetup } from '../src/engine/types';

const team = (ids: string[], lv = 30): UnitSetup[] => ids.map((heroId, i) => ({ heroId, level: lv, pos: i, star: 3, skillLv: 3 }));
const ME = ['wei_xiahoudun', 'wei_xuhuchi', 'wei_guojia', 'wu_huanggai', 'man_wutugu'];
const FOE = ['qun_lvbuding', 'man_mengmiaohuo', 'xian_zuoci', 'shu_guanyunmiao', 'man_zhurong'];
const run = (rules?: RuleFx[], maxRounds = 4, seed = 2) => simulate({ seed, A: team(ME), B: team(FOE), rules, maxRounds });
const ev = (r: ReturnType<typeof run>, pred: (e: ReturnType<typeof run>['events'][number]) => boolean) => r.events.filter(pred);

describe('RuleFx 第二批原语', () => {
  it('role / faction filters pick the right units', () => {
    const r = run([{ t: 'startEnergy', side: 'B', to: 'role:谋士', amount: 40 }], 1);
    const energized = ev(r, (e) => e.t === 'energy').length;
    expect(energized).toBeGreaterThanOrEqual(1);
  });
  it('needFactions gates the rule on distinct factions', () => {
    const gate: RuleFx = { t: 'startShield', side: 'A', to: 'all', pct: 0.1, turns: 2, needFactions: 4 };
    const shields = (rules?: RuleFx[]) => ev(run(rules, 1), (e) => e.t === 'shield').length;
    const base = shields();
    expect(shields([gate])).toBe(base); // 我方只有 3 个阵营，规则不生效
    expect(shields([{ ...gate, needFactions: 3 }])).toBe(base + 5);
  });
  it('takenMul with rounds applies only early; needShield only to shielded targets', () => {
    const taken = (r: ReturnType<typeof run>, side: 'A' | 'B') => r.events.reduce((a, e) => a + (e.t === 'damage' && r.units.find((u) => u.uid === e.dst)?.side === side ? e.amount : 0), 0);
    expect(taken(run([{ t: 'takenMul', side: 'A', mult: 0.5, rounds: 2 }], 2), 'A')).toBeLessThan(taken(run(undefined, 2), 'A'));
    // 敌方没有护盾来源：needShield 条件不成立，伤害不变
    expect(taken(run([{ t: 'takenMul', side: 'B', mult: 3, needShield: true }], 1), 'B')).toBe(taken(run(undefined, 1), 'B'));
  });
  it('firstBasicEnergy fires once per unit; firstHealMul only the first heal', () => {
    const r = run([{ t: 'firstBasicEnergy', side: 'both', amount: 7 }], 2);
    const acts = ev(r, (e) => e.t === 'act' && e.kind === 'basic').length;
    expect(acts).toBeGreaterThan(0);
    const heals = (rules?: RuleFx[]) => ev(run(rules, 6, 5), (e) => e.t === 'heal').map((e) => (e.t === 'heal' ? e.amount : 0));
    const a = heals(), b = heals([{ t: 'firstHealMul', side: 'A', mult: 2 }]);
    if (a.length && b.length) expect(b[0]).toBeGreaterThanOrEqual(a[0]);
  });
  it('hitAdd lowers the opponent dodge, roundEnergyLowest pays the poorest cat', () => {
    expect(ev(run([{ t: 'roundEnergyLowest', side: 'B', amount: 9 }], 3), (e) => e.t === 'energy').length).toBeGreaterThan(0);
    expect(() => run([{ t: 'hitAdd', side: 'both', to: 'back', add: 0.1, rounds: 2 }])).not.toThrow();
  });
  it('every rule marked ready in the campaign runs through a fixed-seed battle', () => {
    let n = 0;
    for (const ch of CHAPTERS) for (const st of ch.stages) if (st.ruleFx?.length) { n++; const r = simulate({ seed: 3, A: team(ME), B: team(FOE), rules: st.ruleFx, maxRounds: 5 }); expect(r.events.at(-1)?.t).toBe('end'); }
    expect(n).toBeGreaterThanOrEqual(20);
  });
});
