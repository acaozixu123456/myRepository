import { describe, expect, it } from 'vitest';
import { HEROES, HERO_BY_ID } from '../src/data/heroes';
import { FACTIONS } from '../src/data/factions';
import { KITS } from '../src/data/kits';
import { KITS_SR } from '../src/data/kits/sr';
import { KITS_SSR } from '../src/data/kits/ssr';
import { SKILLS } from '../src/data/skills';
import { simulate } from '../src/engine/battle';
import { STATUS_RULES } from '../src/engine/statuses';
import type { BEvent, UnitSetup } from '../src/engine/types';

function walk(value: unknown, visit: (node: Record<string, unknown>) => void): void {
  if (Array.isArray(value)) {
    value.forEach((child) => walk(child, visit));
  } else if (value && typeof value === 'object') {
    const node = value as Record<string, unknown>;
    visit(node);
    Object.values(node).forEach((child) => walk(child, visit));
  }
}

/** 只取该绝技的行动窗口；其他猫的普攻、后续持续伤害不能替它通过验收。 */
function hasUltimateOutput(events: BEvent[], uid: number): boolean {
  let inUltimate = false;
  for (const event of events) {
    if (event.t === 'act') inUltimate = event.uid === uid && event.kind === 'ultimate';
    if (inUltimate && (event.t === 'damage' || event.t === 'heal') && event.src === uid && event.amount > 0) {
      if (event.t === 'heal' || event.dst !== uid) return true;
    }
  }
  return false;
}

const solo = (heroId: string, awaken: 'A' | 'B'): UnitSetup[] => [
  { heroId, level: 60, star: 5, skillLv: 9, awaken, pos: 0 },
];

describe('handcrafted kits', () => {
  it('covers every hero with unique skill ids and complete awakening choices', () => {
    expect(Object.keys(KITS).sort()).toEqual(HEROES.map((hero) => hero.id).sort());
    expect(Object.keys(KITS_SR)).toHaveLength(12);
    const skillIds = new Set<string>();
    for (const [heroId, kit] of Object.entries(KITS)) {
      expect(kit.heroId).toBe(heroId);
      for (const skill of [kit.basic, kit.ultimate, kit.passive]) {
        expect(skill.id.trim()).not.toBe('');
        expect(skillIds.has(skill.id), skill.id).toBe(false);
        skillIds.add(skill.id);
        expect(skill.name.trim()).not.toBe('');
        expect(skill.desc.trim()).not.toBe('');
      }
      for (const branch of [kit.awaken.A, kit.awaken.B]) {
        expect(branch.name.trim()).not.toBe('');
        expect(branch.desc.trim()).not.toBe('');
        expect(branch.patches.length).toBeGreaterThan(0);
      }
      expect(kit.awaken.A.patches).not.toEqual(kit.awaken.B.patches);
    }
  });

  it('has exactly three ultimate upgrades at levels 3, 6 and 9', () => {
    for (const kit of Object.values(KITS)) {
      expect(kit.ultimate.levelMods?.map((mod) => mod.lv), kit.heroId).toEqual([3, 6, 9]);
      for (const mod of kit.ultimate.levelMods ?? []) {
        expect(mod.desc.trim()).not.toBe('');
        if (KITS_SR[kit.heroId] || KITS_SSR[kit.heroId]) {
          const patch = mod.patch;
          expect(Boolean(patch.addEffects?.length || patch.replaceEffects?.length || patch.addPassive || patch.retarget), `${kit.heroId} level ${mod.lv}`).toBe(true);
        }
      }
    }
  });

  it('validates nested effects, modifiers, conditions and selector references', () => {
    const validStatus = (id: unknown): void => expect(typeof id === 'string' && Object.hasOwn(STATUS_RULES, id), String(id)).toBe(true);
    for (const kit of Object.values(KITS)) {
      walk(kit, (node) => {
        if (node.t === 'status' || node.c === 'status') validStatus(node.id);
        if (node.t === 'summon' && node.applyStatus) validStatus((node.applyStatus as Record<string, unknown>).id);
        if (node.hasStatus !== undefined) validStatus(node.hasStatus);
        if (node.noStatus !== undefined) validStatus(node.noStatus);
        if (node.c === 'heroAlive') expect(Object.hasOwn(HERO_BY_ID, String(node.hero))).toBe(true);
        if (node.faction !== undefined) expect(Object.hasOwn(FACTIONS, String(node.faction))).toBe(true);
        for (const value of Object.values(node)) if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
        if (node.p !== undefined) {
          expect(node.p).toBeGreaterThanOrEqual(0);
          expect(node.p).toBeLessThanOrEqual(1);
        }
        if (node.turns !== undefined) {
          expect(Number.isInteger(node.turns)).toBe(true);
          expect(node.turns).toBeGreaterThan(0);
        }
      });
    }
  });

  it('gives each new kit at least two kinds of research mechanics', () => {
    for (const kit of Object.values(KITS_SR)) {
      const mechanics = new Set<string>();
      walk(kit, (node) => {
        if (node.t === 'when' || node.cond) mechanics.add('condition');
        if (node.t === 'counter' || node.c === 'counter' || node.perCounter) mechanics.add('counter');
        if (node.t === 'status' || node.c === 'status' || node.hasStatus || node.noStatus || node.faction || node.c === 'heroAlive') mechanics.add('interaction');
        if ((typeof node.on === 'string' && node.on.startsWith('on')) || node.on === 'lowHp') mechanics.add('trigger');
      });
      expect(mechanics.size, kit.heroId).toBeGreaterThanOrEqual(2);
    }
  });

  it('keeps all new and upgraded display entries aligned with the actual DSL and both awakenings', () => {
    for (const kit of Object.values({ ...KITS_SR, ...KITS_SSR })) {
      const display = SKILLS[kit.heroId];
      expect(display.map((skill) => skill.kind)).toEqual(['basic', 'ultimate', 'passive', 'awaken']);
      expect(display[0].name).toBe(kit.basic.name);
      expect(display[0].desc).toBe(kit.basic.desc);
      expect(display[1].name).toBe(kit.ultimate.name);
      expect(display[1].desc).toContain(kit.ultimate.desc);
      for (const mod of kit.ultimate.levelMods ?? []) expect(display[1].desc).toContain(mod.desc);
      expect(display[2].name).toBe(kit.passive.name);
      expect(display[2].desc).toBe(kit.passive.desc);
      expect(display[3].desc).toContain(kit.awaken.A.desc);
      expect(display[3].desc).toContain(kit.awaken.B.desc);
    }
  });

  it('keeps Water Mirror awakening B illusion past the casting action', () => {
    const result = simulate({
      seed: 3, A: solo('xian_shuijing', 'B'),
      B: [{ heroId: 'mob_qun_archer', level: 60, pos: 0 }],
      startEnergy: { A: 100, B: 0 }, maxRounds: 1,
    });
    const caster = result.units.find((unit) => unit.side === 'A')!;
    const cast = result.events.findIndex((event) => event.t === 'act' && event.uid === caster.uid && event.kind === 'ultimate');
    const nextAction = result.events.findIndex((event, index) => index > cast && event.t === 'act');
    const window = result.events.slice(cast + 1, nextAction < 0 ? undefined : nextAction);
    expect(window.some((event) => event.t === 'status' && event.dst === caster.uid && event.id === 'illusion' && event.op === 'add')).toBe(true);
    expect(window.some((event) => event.t === 'status' && event.dst === caster.uid && event.id === 'illusion' && event.op === 'remove')).toBe(false);
  });

  it.each(Object.keys(HERO_BY_ID))('%s releases a useful ultimate in 20 seeds, with either awakening', (heroId) => {
    for (const awaken of ['A', 'B'] as const) {
      for (let seed = 1; seed <= 20; seed++) {
        // 三只无手工控制技能的杂兵先出手，给治疗型绝技留下实际治疗量；
        // 满元气开局检验绝技执行，而不是把单猫打赢三猫当作平衡要求。
        const result = simulate({
          seed,
          A: solo(heroId, awaken),
          B: ['mob_qun_archer', 'mob_qun_strategist', 'mob_qun_vanguard'].map((id, pos) => ({
            heroId: id, level: 60, pos, statMul: 0.8,
          })),
          startEnergy: { A: 100, B: 100 },
        });
        const caster = result.units.find((unit) => unit.side === 'A')!;
        expect(result.events.at(-1)?.t).toBe('end');
        expect(result.events.some((event) => event.t === 'act' && event.uid === caster.uid && event.kind === 'ultimate'), `${heroId}/${awaken}/${seed}`).toBe(true);
        expect(hasUltimateOutput(result.events, caster.uid), `${heroId}/${awaken}/${seed}`).toBe(true);
        for (const unit of result.units) {
          expect(Number.isFinite(unit.hp)).toBe(true);
          expect(unit.hp).toBeGreaterThanOrEqual(0);
          expect(unit.hp).toBeLessThanOrEqual(unit.maxHp);
        }
      }
    }
  });
});
