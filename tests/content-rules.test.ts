import { describe, expect, it } from 'vitest';
import { CHAPTERS, RULES_TODO } from '../src/content/campaign';
import { simulate } from '../src/engine/battle';
import type { BattleConfig, BattleResult, UnitSetup } from '../src/engine/types';
import { STATUS_RULES } from '../src/engine/statuses';

const stages = CHAPTERS.flatMap((chapter) => chapter.stages);
const team = (faction: string): UnitSetup[] => ['guard', 'vanguard', 'guard', 'archer', 'healer'].map((role, pos) => ({ heroId: `mob_${faction}_${role}`, level: 60, pos }));
const fixed = (rules: BattleConfig['rules'], seed = 2, maxRounds = 4): BattleResult => simulate({ seed, A: team('wei'), B: team('man'), rules, maxRounds, noBonds: true });
const stage = (id: string) => stages.find((entry) => entry.id === id)!;
const beforeRound = (result: BattleResult) => result.events.slice(0, result.events.findIndex((event) => event.t === 'round'));

describe('machine readable campaign rules', () => {
  it('accounts for all 48 rules exactly once, with real effects or a specific missing primitive', () => {
    const active = stages.filter((entry) => entry.ruleFx?.length);
    expect(stages.filter((entry) => entry.rule)).toHaveLength(48);
    expect(new Set(RULES_TODO.map((entry) => entry.stageId)).size).toBe(RULES_TODO.length);
    expect(new Set([...active.map((entry) => entry.id), ...RULES_TODO.map((entry) => entry.stageId)]).size).toBe(48);
    for (const entry of stages.filter((entry) => entry.rule)) {
      const todo = RULES_TODO.find((candidate) => candidate.stageId === entry.id);
      expect(Boolean(entry.ruleFx?.length)).not.toBe(Boolean(todo));
      if (todo) { expect(todo.text).toBe(entry.rule); expect(todo.need.length).toBeGreaterThan(10); }
    }
    for (const chapter of CHAPTERS) {
      const effects = chapter.stages.filter((entry) => entry.ruleFx).map((entry) => JSON.stringify(entry.ruleFx));
      expect(new Set(effects).size).toBe(effects.length);
    }
  });

  it('validates nested references and runs every active stage with a fixed five cat lineup', () => {
    for (const entry of stages.filter((candidate) => candidate.ruleFx)) {
      for (const effect of entry.ruleFx!) {
        if ('id' in effect) expect(Object.hasOwn(STATUS_RULES, effect.id)).toBe(true);
        expect(['A', 'B', 'both']).toContain(effect.side);
        for (const value of Object.values(effect)) if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
      }
      const result = fixed(entry.ruleFx);
      expect(result.events.at(-1)?.t, entry.id).toBe('end');
      for (const unit of result.units) expect(Number.isFinite(unit.hp) && unit.hp >= 0 && unit.hp <= unit.maxHp).toBe(true);
    }
  });

  it('1-6 gives only the enemy its own maximum HP based opening shields', () => {
    const result = fixed(stage('1-6').ruleFx, 2, 1);
    const shields = beforeRound(result).filter((event) => event.t === 'shield');
    expect(shields).toHaveLength(5);
    for (const event of shields) if (event.t === 'shield') {
      const unit = result.units.find((candidate) => candidate.uid === event.dst)!;
      expect(unit.side).toBe('B');
      expect(event.amount).toBe(Math.round(unit.maxHp * 0.1));
    }
  });

  it('3-3 makes both teams wet at the start and the wet fire attack deals more damage', () => {
    const result = fixed(stage('3-3').ruleFx, 2, 1);
    expect(beforeRound(result).filter((event) => event.t === 'status' && event.id === 'wet' && event.op === 'add')).toHaveLength(10);
    const setup: Omit<BattleConfig, 'rules'> = { seed: 7, A: [{ heroId: 'wu_zhoumiaoyu', level: 60, pos: 0 }], B: [{ heroId: 'mob_wei_guard', level: 60, pos: 0 }], maxRounds: 1, noBonds: true };
    const firstFire = (battle: BattleResult) => battle.events.find((event) => event.t === 'damage' && event.elem === 'fire');
    const plain = firstFire(simulate(setup));
    const wet = firstFire(simulate({ ...setup, rules: stage('3-3').ruleFx }));
    expect(plain?.t).toBe('damage');
    expect(wet?.t).toBe('damage');
    if (plain?.t === 'damage' && wet?.t === 'damage') expect(wet.amount).toBeGreaterThan(plain.amount);
  });

  it('3-9 limits the extra dodge to enemy Man cats and the first two whole rounds', () => {
    const rules = stage('3-9').ruleFx;
    const dodges = (result: BattleResult) => result.events.filter((event) => event.t === 'text' && event.text === '闪避' && result.units.find((unit) => unit.uid === event.uid)?.side === 'B').length;
    expect(dodges(fixed(rules, 2, 2))).toBeGreaterThan(dodges(fixed(undefined, 2, 2)));
    const otherFaction = { seed: 2, A: team('wei'), B: team('qun'), maxRounds: 2, noBonds: true };
    expect(simulate({ ...otherFaction, rules }).events).toEqual(simulate(otherFaction).events);
    // 规则期限为整轮；不存在用行动次数冒充两整轮的状态补丁。
    expect(rules).toEqual([{ t: 'dodgeAdd', side: 'B', to: 'faction:man', add: 0.1, rounds: 2 }]);
  });

  it('3-12 reapplies wet only on even rounds and only to surviving front positions', () => {
    const result = fixed(stage('3-12').ruleFx, 2, 4);
    let round = 0;
    const rounds = new Set<number>();
    for (const event of result.events) {
      if (event.t === 'round') round = event.n;
      if (event.t === 'status' && event.id === 'wet' && event.op === 'add') {
        rounds.add(round);
        expect(round % 2).toBe(0);
        expect(round).toBeGreaterThan(0);
        expect(result.units.find((unit) => unit.uid === event.dst)!.pos).toBeLessThanOrEqual(2);
      }
    }
    expect([...rounds]).toEqual([2, 4]);
  });
});
