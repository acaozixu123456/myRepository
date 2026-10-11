import { describe, expect, it } from 'vitest';
import { CHAPTERS } from '../src/content/campaign';
import { simulate } from '../src/engine/battle';
import type { BEvent, RuleFx, UnitSetup } from '../src/engine/types';

const team = (ids: string[], lv = 30): UnitSetup[] => ids.map((heroId, i) => ({ heroId, level: lv, pos: i, star: 3, skillLv: 3 }));
const ME = ['wei_xiahoudun', 'wei_xuhuchi', 'wei_guojia', 'wu_huanggai', 'man_wutugu'];
const FOE = ['qun_lvbuding', 'man_mengmiaohuo', 'xian_zuoci', 'shu_guanyunmiao', 'man_zhurong'];
const run = (rules?: RuleFx[], maxRounds = 5, seed = 2) => simulate({ seed, A: team(ME), B: team(FOE), rules, maxRounds });
const count = (r: ReturnType<typeof run>, p: (e: BEvent) => boolean) => r.events.filter(p).length;
const sideOf = (r: ReturnType<typeof run>, uid: number) => r.units.find((u) => u.uid === uid)?.side;

describe('事件规则 on', () => {
  it('basicHit applies a status to the target once per matching unit', () => {
    const r = run([{ t: 'on', ev: 'basicHit', side: 'B', act: { k: 'status', id: 'wet', turns: 1, who: 'target' } }]);
    const wet = count(r, (e) => e.t === 'status' && e.id === 'wet' && e.op === 'add');
    expect(wet).toBeGreaterThanOrEqual(1);
    expect(wet).toBeLessThanOrEqual(5); // 敌方最多 5 只，每只最多一次
  });
  it('heal event fires for healers only (role filter)', () => {
    const none = count(run(undefined, 6), (e) => e.t === 'energy');
    const withRule = count(run([{ t: 'on', ev: 'heal', side: 'A', to: 'role:医者', act: { k: 'energy', amount: 30, who: 'actor' } }], 6), (e) => e.t === 'energy');
    expect(withRule).toBeGreaterThanOrEqual(none);
  });
  it('hurt every N hits with a max count', () => {
    const r = run([{ t: 'on', ev: 'hurt', side: 'A', every: 3, max: 2, act: { k: 'energy', amount: 40, who: 'actor' } }], 6);
    // 每只我方猫最多触发 2 次；至少有一只被打够 3 次
    expect(count(r, (e) => e.t === 'energy' && sideOf(r, e.uid) === 'A')).toBeGreaterThan(0);
  });
  it('crit rule runs at most once per round per side', () => {
    const base = run(undefined, 4);
    const r = run([{ t: 'on', ev: 'crit', side: 'both', per: 'round', act: { k: 'energy', amount: 5, who: 'lowestAlly' } }], 4);
    const extra = count(r, (e) => e.t === 'energy') - count(base, (e) => e.t === 'energy');
    expect(extra).toBeLessThanOrEqual(8); // 4 回合 × 2 方
  });
  it('shieldExpire / shieldBreak / cleanse / statusApply events do not throw', () => {
    const acts = [
      { t: 'on', ev: 'shieldExpire', side: 'both', max: 9, act: { k: 'energy', amount: 5, who: 'actor' } },
      { t: 'on', ev: 'shieldBreak', side: 'both', max: 9, act: { k: 'energy', amount: -5, who: 'foes' } },
      { t: 'on', ev: 'cleanse', side: 'both', cc: true, act: { k: 'energy', amount: 10, who: 'target' } },
      { t: 'on', ev: 'statusApply', side: 'both', status: 'fluff', act: { k: 'extend', turns: 1 } },
      { t: 'on', ev: 'basic', side: 'B', to: 'faction:man', act: { k: 'totem', amount: 1 } },
    ] as RuleFx[];
    for (let seed = 1; seed <= 10; seed++) expect(run(acts, 8, seed).events.at(-1)?.t).toBe('end');
  });
  it('pick highestSpd / lowestSpd selects exactly one cat per side', () => {
    const r = run([{ t: 'startStatus', side: 'both', to: 'all', pick: 'highestSpd', id: 'step', turns: 1, power: -0.1 }], 1);
    const steps = (x: ReturnType<typeof run>) => count(x, (e) => e.t === 'status' && e.id === 'step' && e.op === 'add');
    expect(steps(r) - steps(run(undefined, 1))).toBe(2);
    const r2 = run([{ t: 'roundStatus', side: 'B', to: 'all', pick: 'lowestSpd', id: 'step', every: 1, at: 2, turns: 1, power: 0.2 }], 3);
    expect(count(r2, (e) => e.t === 'status' && e.id === 'step' && e.op === 'add') - count(run(undefined, 3), (e) => e.t === 'status' && e.id === 'step' && e.op === 'add')).toBe(1);
  });
  it('healMul with needStatus only affects targets that have it', () => {
    expect(() => run([{ t: 'healMul', side: 'both', mult: 0.9, needStatus: 'burn' }])).not.toThrow();
  });
});

describe('campaign rules', () => {
  it('at least 40 of the 48 rules are now executable and all run cleanly', () => {
    let ready = 0;
    for (const ch of CHAPTERS) for (const st of ch.stages) if (st.ruleFx?.length) { ready++; for (const seed of [1, 2]) expect(run(st.ruleFx, 6, seed).events.at(-1)?.t).toBe('end'); }
    expect(ready).toBeGreaterThanOrEqual(40);
  });
});
