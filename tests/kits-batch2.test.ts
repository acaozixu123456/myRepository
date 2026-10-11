import { describe, expect, it } from 'vitest';
import { HERO_BY_ID } from '../src/data/heroes';
import { KITS } from '../src/data/kits';
import { KITS_B2 } from '../src/data/kits/batch2';
import { simulate } from '../src/engine/battle';
import type { BattleResult } from '../src/engine/battle';
import type { BEvent, BattleConfig, UnitSetup } from '../src/engine/types';

const BATCH_TWO = [
  'wei_zhangliao', 'wei_xuhuang', 'shu_huangzhong', 'shu_machao', 'shu_zhaomiaoyun', 'shu_jiangwei',
  'wu_ganning', 'wu_luxun', 'qun_zhangjiao', 'qun_huaxiong', 'man_shamoke', 'man_mengyou', 'xian_yuji', 'xian_nanhua',
];

interface ProbeOptions extends Omit<BattleConfig, 'A' | 'B'> {
  setup?: Partial<UnitSetup>;
  allies?: UnitSetup[];
  B?: UnitSetup[];
}

function probe(heroId: string, options: ProbeOptions): { result: BattleResult; uid: number } {
  const { setup = {}, allies = [], B, ...cfg } = options;
  expect(HERO_BY_ID[heroId]).toBeDefined();
  expect(KITS[heroId]).toBe(KITS_B2[heroId]);
  const result = simulate({
    noBonds: true,
    maxRounds: 1,
    ...cfg,
    A: [{ heroId, level: 60, star: 5, skillLv: 1, pos: 0, ...setup }, ...allies],
    B: B ?? [{ heroId: 'mob_qun_guard', level: 60, pos: 0, statMul: 0.05, gear: { hp: 100000 } }],
  });
  return { result, uid: result.units.find((unit) => unit.side === 'A' && unit.heroId === heroId)!.uid };
}

function actionWindow(events: BEvent[], actionIndex: number): BEvent[] {
  const end = events.findIndex((event, index) => index > actionIndex && event.t === 'act');
  return events.slice(actionIndex + 1, end < 0 ? undefined : end);
}

const actionsOf = (events: BEvent[], uid: number) => events.flatMap((event, index) => event.t === 'act' && event.uid === uid ? [{ event, index }] : []);
const damageEvents = (events: BEvent[], src?: number) => events.filter((event): event is Extract<BEvent, { t: 'damage' }> => event.t === 'damage' && (src === undefined || event.src === src));

describe('batch two skill behavior', () => {
  it('registers all fourteen real heroes with unique skill identifiers and mechanical upgrades at levels 3, 6 and 9', () => {
    expect(Object.keys(KITS_B2).sort()).toEqual(BATCH_TWO.slice().sort());
    const ids = Object.values(KITS).flatMap((kit) => [kit.basic.id, kit.ultimate.id, kit.passive.id]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [heroId, kit] of Object.entries(KITS_B2)) {
      expect(kit.heroId).toBe(heroId);
      expect(HERO_BY_ID[heroId].faction).toBe(heroId.split('_')[0]);
      expect(KITS[heroId]).toBe(kit);
      expect(kit.ultimate.levelMods?.map((mod) => mod.lv)).toEqual([3, 6, 9]);
      expect(kit.awaken.A.patches.length).toBeGreaterThan(0);
      expect(kit.awaken.B.patches.length).toBeGreaterThan(0);
    }
  });

  it('counts Gan Ning actions before the strike and caps bell damage instead of multiplying all lower bands', () => {
    const { result, uid } = probe('wu_ganning', {
      seed: 8, maxRounds: 6, setup: { gear: { crit: -1 } },
      rules: [{ t: 'startStatus', side: 'A', to: 'all', id: 'yarn', turns: 99 }],
    });
    const actions = actionsOf(result.events, uid);
    expect(actions).toHaveLength(6);
    const firstBeat = result.events.findIndex((event) => event.t === 'passive' && event.uid === uid);
    expect(firstBeat).toBeGreaterThanOrEqual(0);
    expect(firstBeat).toBeLessThan(actions[0].index);
    const hits = actions.map(({ index }) => actionWindow(result.events, index).find((event) => event.t === 'damage' && event.src === uid));
    expect(hits.every((event) => event?.t === 'damage' && !event.crit)).toBe(true);
    const first = hits[0] as Extract<BEvent, { t: 'damage' }>;
    const last = hits[4] as Extract<BEvent, { t: 'damage' }>;
    // 8% -> 40%，随机伤害浮动只有 ±5%；互斥档位不会产生约两倍的复利伤害。
    expect(last.amount / first.amount).toBeGreaterThan(1.15);
    expect(last.amount / first.amount).toBeLessThan(1.45);
    expect(result.units.find((unit) => unit.uid === uid)!.counters.gn_bells).toBe(5);
  });

  it('lets Gan Ning awakening A act again while awakening B protects an ally after three beats', () => {
    const assault = probe('wu_ganning', { seed: 3, startEnergy: { A: 100, B: 0 }, setup: { awaken: 'A', gear: { crit: 1 } } });
    expect(actionsOf(assault.result.events, assault.uid)).toHaveLength(2);
    expect(assault.result.units.find((unit) => unit.uid === assault.uid)!.counters.gn_bells).toBe(2);
    expect(assault.result.events.filter((event) => event.t === 'text' && event.uid === assault.uid && event.text === '再动！')).toHaveLength(1);

    const escort = probe('wu_ganning', { seed: 3, maxRounds: 3, setup: { awaken: 'B', gear: { crit: 1 } } });
    expect(actionsOf(escort.result.events, escort.uid)).toHaveLength(3);
    expect(escort.result.events.filter((event) => event.t === 'shield' && event.src === escort.uid)).toHaveLength(1);
    expect(escort.result.units.find((unit) => unit.uid === escort.uid)!.shield[0]?.turns).toBe(1);
  });

  it.each(['basic', 'ultimate'] as const)('guarantees Hua Xiong first sober %s strike and does not reuse it', (kind) => {
    for (let seed = 1; seed <= 12; seed++) {
      const { result, uid } = probe('qun_huaxiong', { seed, maxRounds: 2, startEnergy: { A: kind === 'ultimate' ? 100 : 0, B: 0 } });
      const first = actionsOf(result.events, uid)[0];
      expect(first.event.kind).toBe(kind);
      const strike = actionWindow(result.events, first.index).find((event) => event.t === 'damage' && event.src === uid);
      expect(strike?.t === 'damage' && strike.crit).toBe(true);
      expect(result.units.find((unit) => unit.uid === uid)!.counters.hx_first).toBe(1);
    }
    const { result, uid } = probe('qun_huaxiong', { seed: 5, maxRounds: 12 });
    expect(result.events.some((event) => event.t === 'damage' && event.src === uid && !event.crit)).toBe(true);
  });

  it('deducts Hua Xiong wine energy before skill selection and preserves the unused first sober strike', () => {
    const { result, uid } = probe('qun_huaxiong', {
      seed: 2, maxRounds: 2, startEnergy: { A: 100, B: 0 },
      rules: [{ t: 'startStatus', side: 'A', to: 'all', id: 'nip', turns: 1 }],
    });
    const actions = actionsOf(result.events, uid);
    expect(actions[0].event.kind).toBe('basic');
    const energyBeforeFirst = result.events.slice(0, actions[0].index).filter((event) => event.t === 'energy' && event.uid === uid);
    expect(energyBeforeFirst.some((event) => event.t === 'energy' && event.energy === 80)).toBe(true);
    expect(actions[1].event.kind).toBe('ultimate');
    const secondStrike = actionWindow(result.events, actions[1].index).find((event) => event.t === 'damage' && event.src === uid);
    expect(secondStrike?.t === 'damage' && secondStrike.crit).toBe(true);
    expect(result.units.find((unit) => unit.uid === uid)!.counters.hx_first).toBe(1);
  });

  it('keeps Yu Ji purr beyond the casting action and heals at the holder next action start', () => {
    const { result, uid } = probe('xian_yuji', { seed: 7, maxRounds: 2, startEnergy: { A: 100, B: 0 }, setup: { hpPct: 0.4 } });
    const caster = result.units.find((unit) => unit.uid === uid)!;
    const actions = actionsOf(result.events, uid);
    expect(actions[0].event.kind).toBe('ultimate');
    const roundTwo = result.events.findIndex((event) => event.t === 'round' && event.n === 2);
    const healBeforeSecond = result.events.slice(roundTwo + 1, actions[1].index).filter((event) => event.t === 'heal' && event.dst === uid);
    expect(healBeforeSecond.some((event) => event.t === 'heal' && event.amount === Math.round(caster.maxHp * 0.05))).toBe(true);
    expect(caster.statuses.find((status) => status.id === 'purr')?.turns).toBe(1);
  });

  it('cleanses an extra debuff on every second Yu Ji ultimate, then clears the refill counter', () => {
    const { result, uid } = probe('xian_yuji', {
      seed: 11, maxRounds: 7, startEnergy: { A: 100, B: 0 }, setup: { skillLv: 9, hpPct: 0.4 },
      rules: ['fright', 'wet', 'mark', 'burn', 'scratch'].map((id) => ({ t: 'roundStatus' as const, side: 'A' as const, to: 'all' as const, id, turns: 99, power: 0.01, every: 1 })),
    });
    const ultimates = actionsOf(result.events, uid).filter(({ event }) => event.kind === 'ultimate');
    expect(ultimates).toHaveLength(2);
    const cleanCounts = ultimates.map(({ index }) => actionWindow(result.events, index).filter((event) => event.t === 'status' && event.src === uid && event.op === 'remove').length);
    expect(cleanCounts).toEqual([1, 2]);
    expect(result.units.find((unit) => unit.uid === uid)!.counters.yj_refill).toBe(0);
  });

  it('fires Yu Ji awakening B before hostile ultimate damage and does not confuse it with canceling the cast', () => {
    const common: ProbeOptions = { seed: 6, setup: { awaken: 'B' }, startEnergy: { A: 0, B: 100 }, B: [{ heroId: 'mob_qun_vanguard', level: 60, pos: 0, gear: { hp: 100000 } }] };
    const warded = probe('xian_yuji', common);
    const plain = probe('xian_yuji', { ...common, setup: {} });
    const source = warded.result.units.find((unit) => unit.side === 'B')!.uid;
    const cast = warded.result.events.findIndex((event) => event.t === 'act' && event.uid === source && event.kind === 'ultimate');
    const window = actionWindow(warded.result.events, cast);
    const fright = window.findIndex((event) => event.t === 'status' && event.dst === source && event.id === 'fright' && event.op === 'add');
    const hit = window.findIndex((event) => event.t === 'damage' && event.src === source);
    expect(fright).toBeGreaterThanOrEqual(0);
    expect(hit).toBeGreaterThan(fright);
    const reduced = window[hit] as Extract<BEvent, { t: 'damage' }>;
    const untreated = plain.result.events.find((event) => event.t === 'damage' && event.src === source) as Extract<BEvent, { t: 'damage' }>;
    // 新状态不会消耗随机数；同 seed 同一击只改变攻击，仍实实在在施放了绝技。
    expect(reduced.amount).toBeLessThan(untreated.amount);
    expect(reduced.amount / untreated.amount).toBeGreaterThan(0.88);
    expect(reduced.amount / untreated.amount).toBeLessThan(0.92);
    expect(warded.result.events.some((event) => event.t === 'energy' && event.uid === warded.uid && event.energy === 8)).toBe(true);
  });

  it.each([
    { hpPct: 0.51, arrows: 2 }, { hpPct: 0.49, arrows: 4 },
    { hpPct: 0.26, arrows: 4 }, { hpPct: 0.24, arrows: 6 },
  ])('lets Huang Zhong shoot $arrows arrows at $hpPct starting health', ({ hpPct, arrows }) => {
    const { result, uid } = probe('shu_huangzhong', { seed: 4, startEnergy: { A: 100, B: 0 }, setup: { hpPct, gear: { crit: -1 } } });
    const first = actionsOf(result.events, uid)[0];
    expect(first.event.kind).toBe('ultimate');
    const strikes = actionWindow(result.events, first.index).filter((event) => event.t === 'damage' && event.src === uid);
    expect(strikes).toHaveLength(arrows);
    expect(strikes.every((event) => event.t === 'damage' && event.hits === arrows)).toBe(true);
  });

  it('does not redirect Huang Zhong remaining arrows after his original target falls asleep', () => {
    const { result, uid } = probe('shu_huangzhong', {
      seed: 2, startEnergy: { A: 100, B: 0 }, setup: { hpPct: 0.24 },
      B: [
        { heroId: 'mob_qun_guard', level: 60, pos: 0, gear: { hp: 100000 } },
        { heroId: 'mob_qun_healer', level: 1, pos: 3, hpPct: 0.01 },
      ],
    });
    const first = actionsOf(result.events, uid)[0];
    const strikes = actionWindow(result.events, first.index).filter((event) => event.t === 'damage' && event.src === uid);
    expect(strikes).toHaveLength(1);
    expect(strikes[0].t === 'damage' && strikes[0].killed).toBe(true);
    expect(result.units.find((unit) => unit.side === 'B' && unit.pos === 0)!.alive).toBe(true);
  });

  it('checks Huang Zhong health after hostile onEnemyUlt reactions, when the volley actually begins', () => {
    const { result, uid } = probe('shu_huangzhong', {
      seed: 1, startEnergy: { A: 100, B: 0 }, setup: { hpPct: 0.51 },
      B: [{ heroId: 'wu_zhoumiaoyu', level: 60, pos: 0, gear: { hp: 100000 } }],
    });
    const cast = actionsOf(result.events, uid)[0];
    const window = actionWindow(result.events, cast.index);
    const reaction = window.findIndex((event) => event.t === 'damage' && event.dst === uid && event.src !== uid);
    const arrows = window.flatMap((event, index) => event.t === 'damage' && event.src === uid ? [{ event, index }] : []);
    expect(reaction).toBeGreaterThanOrEqual(0);
    expect(arrows).toHaveLength(4);
    expect(arrows[0].index).toBeGreaterThan(reaction);
  });

  it('gives Huang Zhong awakening A one follow-up while awakening B cleanses and protects another ally', () => {
    const pursuit = probe('shu_huangzhong', { seed: 9, startEnergy: { A: 100, B: 0 }, setup: { hpPct: 0.24, awaken: 'A', gear: { crit: 1 } } });
    const cast = actionsOf(pursuit.result.events, pursuit.uid)[0];
    const strikes = actionWindow(pursuit.result.events, cast.index).filter((event) => event.t === 'damage' && event.src === pursuit.uid);
    expect(strikes).toHaveLength(7);

    const guarded = probe('shu_huangzhong', {
      seed: 9, startEnergy: { A: 100, B: 0 }, setup: { hpPct: 0.49, awaken: 'B' },
      allies: [{ heroId: 'mob_wei_healer', level: 60, pos: 1, hpPct: 0.8 }],
      rules: [{ t: 'startStatus', side: 'A', to: 'all', id: 'fright', power: 0.1, turns: 99 }],
    });
    const friend = guarded.result.units.find((unit) => unit.side === 'A' && unit.uid !== guarded.uid)!;
    expect(guarded.result.events.some((event) => event.t === 'status' && event.dst === guarded.uid && event.id === 'fright' && event.op === 'remove')).toBe(true);
    expect(guarded.result.events.some((event) => event.t === 'shield' && event.src === guarded.uid && event.dst === friend.uid)).toBe(true);
    expect(guarded.result.events.some((event) => event.t === 'shield' && event.src === guarded.uid && event.dst === guarded.uid)).toBe(false);
  });

  it('runs Ma Chao opening charge before round one without spending his normal action or energy', () => {
    const { result, uid } = probe('shu_machao', { seed: 10, startEnergy: { A: 100, B: 0 } });
    const opening = result.events.findIndex((event) => event.t === 'damage' && event.src === uid);
    const roundOne = result.events.findIndex((event) => event.t === 'round' && event.n === 1);
    expect(opening).toBeGreaterThanOrEqual(0);
    expect(opening).toBeLessThan(roundOne);
    expect(result.events.slice(0, roundOne).some((event) => event.t === 'act' && event.uid === uid)).toBe(false);
    expect(result.events.slice(0, roundOne).some((event) => event.t === 'energy' && event.uid === uid && event.energy === 0)).toBe(false);
    const actions = actionsOf(result.events, uid);
    expect(actions).toHaveLength(1);
    expect(actions[0].event.kind).toBe('ultimate');
    expect(result.units.find((unit) => unit.uid === uid)!.acted).toBe(1);
  });

  it('queues Ma Chao opening kill for one extra action and stops kill chains in that extra action', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const { result, uid } = probe('shu_machao', {
        seed, B: [
          { heroId: 'mob_qun_guard', level: 1, pos: 0, hpPct: 0.01 },
          { heroId: 'mob_wei_guard', level: 1, pos: 1, hpPct: 0.01 },
          { heroId: 'mob_xian_guard', level: 1, pos: 2, hpPct: 0.01 },
          { heroId: 'mob_man_guard', level: 60, pos: 3, gear: { hp: 100000 }, statMul: 0.05 },
        ],
      });
      const roundOne = result.events.findIndex((event) => event.t === 'round' && event.n === 1);
      expect(result.events.slice(0, roundOne).some((event) => event.t === 'damage' && event.src === uid && event.killed)).toBe(true);
      expect(actionsOf(result.events, uid)).toHaveLength(2);
      expect(result.units.find((unit) => unit.uid === uid)!.acted).toBe(2);
      expect(result.events.filter((event) => event.t === 'text' && event.uid === uid && event.text === '再动！')).toHaveLength(1);
      expect(result.events.some((event) => event.t === 'damage' && event.src === uid && event.killed && result.events.indexOf(event) > roundOne)).toBe(true);
    }
  });

  it('changes Ma Chao awakening A ultimate target while awakening B leaves his ally a shield', () => {
    const options: ProbeOptions = {
      seed: 3, startEnergy: { A: 100, B: 0 },
      B: [
        { heroId: 'mob_qun_guard', level: 60, pos: 0, gear: { hp: 100000 }, statMul: 0.05 },
        { heroId: 'mob_qun_guard', level: 60, pos: 3, gear: { hp: 100000 }, statMul: 0.05 },
      ],
      allies: [{ heroId: 'mob_wei_healer', level: 60, pos: 1, hpPct: 0.1 }],
    };
    const flanker = probe('shu_machao', { ...options, setup: { awaken: 'A' } });
    const rear = flanker.result.units.find((unit) => unit.side === 'B' && unit.pos === 3)!;
    expect(actionsOf(flanker.result.events, flanker.uid)[0].event.targets).toEqual([rear.uid]);
    expect(flanker.result.events.some((event) => event.t === 'energy' && event.uid === flanker.uid && event.energy === 15)).toBe(true);

    const escort = probe('shu_machao', { ...options, setup: { awaken: 'B' } });
    const front = escort.result.units.find((unit) => unit.side === 'B' && unit.pos === 0)!;
    const friend = escort.result.units.find((unit) => unit.side === 'A' && unit.uid !== escort.uid)!;
    expect(actionsOf(escort.result.events, escort.uid)[0].event.targets).toEqual([front.uid]);
    expect(escort.result.events.some((event) => event.t === 'shield' && event.src === escort.uid && event.dst === friend.uid)).toBe(true);
  });

  it('gives Ma Chao one journey follow-up on his second ultimate and clears that counter', () => {
    const { result, uid } = probe('shu_machao', {
      seed: 2, maxRounds: 2, setup: { skillLv: 9, gear: { crit: -1 } },
      rules: [{ t: 'roundEnergyLowest', side: 'A', amount: 100 }],
    });
    const actions = actionsOf(result.events, uid);
    expect(actions.map(({ event }) => event.kind)).toEqual(['ultimate', 'ultimate']);
    const strikes = actions.map(({ index }) => actionWindow(result.events, index).filter((event) => event.t === 'damage' && event.src === uid).length);
    expect(strikes).toEqual([1, 2]);
    expect(result.units.find((unit) => unit.uid === uid)!.counters.mc_journey).toBe(0);
  });

  it('applies Jiang Wei northern campaign boon on round three and resets to one layer on round four', () => {
    const options: ProbeOptions = {
      seed: 7, maxRounds: 3,
      allies: [{ heroId: 'mob_wei_healer', level: 60, pos: 1 }],
      rules: [{ t: 'startStatus', side: 'A', to: 'all', id: 'yarn', turns: 99 }],
    };
    const third = probe('shu_jiangwei', options);
    const roundThree = third.result.events.findIndex((event) => event.t === 'round' && event.n === 3);
    const firstThirdAction = third.result.events.findIndex((event, index) => index > roundThree && event.t === 'act');
    const preparation = third.result.events.slice(roundThree + 1, firstThirdAction);
    expect(preparation.filter((event) => event.t === 'status' && event.src === third.uid && event.id === 'curl' && event.op === 'add')).toHaveLength(2);
    const energies = preparation.filter((event): event is Extract<BEvent, { t: 'energy' }> => event.t === 'energy');
    expect(energies).toHaveLength(2);
    for (const event of energies) {
      const previous = third.result.events.slice(0, roundThree).reverse().find((node) => node.t === 'energy' && node.uid === event.uid);
      expect(event.energy).toBe((previous?.t === 'energy' ? previous.energy : 0) + 10);
    }
    expect(third.result.units.find((unit) => unit.uid === third.uid)!.counters.jw_north).toBe(0);

    const fourth = probe('shu_jiangwei', { ...options, maxRounds: 4 });
    expect(fourth.result.units.find((unit) => unit.uid === fourth.uid)!.counters.jw_north).toBe(1);
  });

  it('settles Jiang Wei level six extra northern layer immediately inside the casting action', () => {
    const { result, uid } = probe('shu_jiangwei', {
      seed: 5, maxRounds: 2, setup: { skillLv: 6 }, startEnergy: { A: 70, B: 0 },
    });
    const actions = actionsOf(result.events, uid);
    expect(actions.map(({ event }) => event.kind)).toEqual(['basic', 'ultimate']);
    const window = actionWindow(result.events, actions[1].index);
    expect(window.some((event) => event.t === 'status' && event.src === uid && event.dst === uid && event.id === 'curl' && event.op === 'add')).toBe(true);
    expect(result.units.find((unit) => unit.uid === uid)!.counters.jw_north).toBe(0);
    expect(result.units.find((unit) => unit.uid === uid)!.statuses.find((status) => status.id === 'curl')?.turns).toBe(1);
  });

  it('lets Jiang Wei awakening A advance by basics while awakening B silences at a full northern count', () => {
    const advancing = probe('shu_jiangwei', { seed: 8, maxRounds: 2, setup: { awaken: 'A' } });
    const second = actionsOf(advancing.result.events, advancing.uid)[1];
    const roundTwo = advancing.result.events.findIndex((event) => event.t === 'round' && event.n === 2);
    expect(advancing.result.events.slice(roundTwo + 1, second.index).some((event) => event.t === 'status' && event.id === 'curl' && event.op === 'add')).toBe(true);
    expect(advancing.result.units.find((unit) => unit.uid === advancing.uid)!.counters.jw_north).toBe(1);

    const quiet = probe('shu_jiangwei', {
      seed: 8, maxRounds: 3, setup: { awaken: 'B' },
      B: [{ heroId: 'mob_qun_guard', level: 60, pos: 0, gear: { hp: 100000, spd: -50 }, statMul: 0.05, energy: 110 }],
      rules: [{ t: 'roundEnergyLowest', side: 'B', amount: 100 }],
    });
    const thirdRound = quiet.result.events.findIndex((event) => event.t === 'round' && event.n === 3);
    const enemy = quiet.result.units.find((unit) => unit.side === 'B')!;
    const enemyThirdAct = quiet.result.events.find((event, index) => index > thirdRound && event.t === 'act' && event.uid === enemy.uid);
    expect(quiet.result.events.slice(thirdRound + 1).some((event) => event.t === 'status' && event.src === quiet.uid && event.dst === enemy.uid && event.id === 'yarn' && event.op === 'add')).toBe(true);
    expect(enemyThirdAct?.t === 'act' && enemyThirdAct.kind).toBe('basic');
  });

  it('returns Jiang Wei level nine energy to his teacher before the base ultimate hits', () => {
    const { result, uid } = probe('shu_jiangwei', {
      seed: 4, setup: { skillLv: 9, gear: { spd: 50 } }, startEnergy: { A: 100, B: 0 },
      allies: [{ heroId: 'shu_zhugemiaoliang', level: 60, pos: 1, energy: 0 }],
    });
    const teacher = result.units.find((unit) => unit.heroId === 'shu_zhugemiaoliang')!;
    const cast = actionsOf(result.events, uid)[0];
    const window = actionWindow(result.events, cast.index);
    const energy = window.findIndex((event) => event.t === 'energy' && event.uid === teacher.uid && event.energy === 42);
    const hit = window.findIndex((event) => event.t === 'damage' && event.src === uid);
    expect(energy).toBeGreaterThanOrEqual(0);
    expect(hit).toBeGreaterThan(energy);
  });

  it.each(BATCH_TWO)('executes %s as its registered faction and skill kit at every upgrade tier and awakening', (heroId) => {
    for (const skillLv of [1, 3, 6, 9]) for (const awaken of [undefined, 'A', 'B'] as const) {
      const { result, uid } = probe(heroId, {
        seed: 2901, startEnergy: { A: 100, B: 0 }, setup: { skillLv, awaken, hpPct: 0.5 },
        B: [0, 1, 3].map((pos) => ({ heroId: 'mob_qun_guard', level: 60, pos, statMul: 0.03, gear: { hp: 100000 } })),
      });
      const actual = result.units.find((unit) => unit.uid === uid)!;
      expect(actual.heroId).toBe(heroId);
      expect(actual.faction).toBe(HERO_BY_ID[heroId].faction);
      expect(actual.role).toBe(HERO_BY_ID[heroId].role);
      const cast = actionsOf(result.events, uid).find(({ event }) => event.kind === 'ultimate');
      expect(cast).toBeDefined();
      expect(cast!.event.fx).toBe(KITS_B2[heroId].ultimate.fx);
      const window = actionWindow(result.events, cast!.index);
      expect(window.some((event) => (event.t === 'damage' || event.t === 'heal') && event.src === uid && event.amount > 0)).toBe(true);
      expect(result.units.every((unit) => Number.isFinite(unit.hp) && unit.hp >= 0)).toBe(true);
    }
  });

  it('raises Zhang Liao critical chance by mutually exclusive live ally counts', () => {
    const critCounts = [0, 1, 2, 3].map((friends) => {
      let crits = 0;
      for (let seed = 1; seed <= 40; seed++) {
        const { result, uid } = probe('wei_zhangliao', {
          seed, setup: { gear: { spd: 200 } },
          allies: ['mob_qun_guard', 'mob_shu_guard', 'mob_wu_guard'].slice(0, friends).map((heroId, i) => ({ heroId, level: 60, pos: i + 1 })),
        });
        const strike = damageEvents(actionWindow(result.events, actionsOf(result.events, uid)[0].index), uid)[0];
        if (strike.crit) crits++;
      }
      return crits;
    });
    expect(critCounts[0]).toBeGreaterThan(critCounts[1]);
    expect(critCounts[1]).toBeGreaterThan(critCounts[2]);
    expect(critCounts[2]).toBeGreaterThan(critCounts[3]);
  });

  it('does not count Zhang Liao ally after an actual opening charge puts that ally to sleep', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const { result, uid } = probe('wei_zhangliao', {
        seed, setup: { pos: 3, gear: { spd: 200, crit: 0.56 } },
        allies: [{ heroId: 'mob_qun_guard', level: 1, pos: 0, hpPct: 0.01 }],
        B: [{ heroId: 'shu_machao', level: 60, pos: 0, gear: { hp: 100000 } }],
      });
      const ally = result.units.find((unit) => unit.side === 'A' && unit.uid !== uid)!;
      const act = actionsOf(result.events, uid)[0];
      expect(result.events.slice(0, act.index).some((event) => event.t === 'death' && event.uid === ally.uid)).toBe(true);
      expect(damageEvents(actionWindow(result.events, act.index), uid)[0].crit).toBe(true);
    }
  });

  it('separates Zhang Liao sparse-party extra action from the ally-loss escort shield', () => {
    const charge = probe('wei_zhangliao', {
      seed: 4, setup: { awaken: 'A' },
      B: [{ heroId: 'mob_qun_guard', level: 1, pos: 0, hpPct: 0.01 }, { heroId: 'mob_wu_guard', level: 60, pos: 3, statMul: 0.05, gear: { hp: 100000 } }],
    });
    expect(actionsOf(charge.result.events, charge.uid)).toHaveLength(2);
    expect(charge.result.events.filter((event) => event.t === 'text' && event.uid === charge.uid && event.text === '再动！')).toHaveLength(1);
    const escort = probe('wei_zhangliao', {
      seed: 4, setup: { awaken: 'B', pos: 3 },
      allies: [{ heroId: 'mob_qun_guard', level: 1, pos: 0, hpPct: 0.01 }, { heroId: 'mob_wu_guard', level: 60, pos: 4, hpPct: 0.4 }],
      B: [{ heroId: 'shu_machao', level: 60, pos: 0, gear: { hp: 100000 } }],
    });
    expect(escort.result.events.some((event) => event.t === 'shield' && event.src === escort.uid && event.dst === escort.uid)).toBe(true);
    expect(escort.result.events.some((event) => event.t === 'heal' && event.src === escort.uid && event.dst !== escort.uid)).toBe(true);
    expect(actionsOf(escort.result.events, escort.uid)).toHaveLength(1);
  });

  it('makes Xu Huang ward reduce his ally actual hit by 15% without adding defense', () => {
    const options: ProbeOptions = {
      seed: 19, setup: { pos: 3, gear: { spd: 200, crit: -1 }, energy: 100 },
      allies: [{ heroId: 'mob_qun_guard', level: 60, pos: 0, energy: 0 }],
      B: [{ heroId: 'mob_xian_vanguard', level: 60, pos: 0, gear: { hp: 100000, crit: -1, spd: 20 } }],
    };
    const warded = probe('wei_xuhuang', options);
    const bare = probe('wei_xuhuang', { ...options, setup: { ...options.setup, energy: 0 } });
    const friend = warded.result.units.find((unit) => unit.side === 'A' && unit.uid !== warded.uid)!;
    const untreated = bare.result.units.find((unit) => unit.side === 'A' && unit.uid !== bare.uid)!;
    const hit = damageEvents(warded.result.events).find((event) => event.dst === friend.uid)!;
    const original = damageEvents(bare.result.events).find((event) => event.dst === untreated.uid)!;
    expect(friend.def).toBe(untreated.def);
    expect(friend.statuses.some((status) => status.id === 'curl')).toBe(false);
    expect(friend.statuses.find((status) => status.id === 'ward')?.power).toBe(0.15);
    expect(hit.amount).toBeCloseTo(original.amount * 0.85, -0.2);
  });

  it('caps Xu Huang military discipline after four hits and preserves its stronger defense tier', () => {
    const { result, uid } = probe('wei_xuhuang', {
      seed: 5, setup: { gear: { hp: 100000 } },
      B: [{ heroId: 'wu_sunxiangxiang', level: 60, pos: 0, energy: 100, gear: { crit: -1 } }],
    });
    const own = result.units.find((unit) => unit.uid === uid)!;
    expect(damageEvents(result.events).filter((event) => event.dst === uid)).toHaveLength(5);
    expect(own.counters.xh_steady).toBe(4);
    expect(own.statuses.find((status) => status.id === 'curl')?.power).toBe(0.2);
    expect(own.statuses.find((status) => status.id === 'curl')?.turns).toBe(1);
  });

  it('lets Xu Huang awakening A draw attention while awakening B shields a companion after the third hit', () => {
    const gate = probe('wei_xuhuang', { seed: 3, setup: { awaken: 'A', energy: 100 } });
    const cast = actionsOf(gate.result.events, gate.uid)[0];
    const window = actionWindow(gate.result.events, cast.index);
    const taunt = window.findIndex((event) => event.t === 'status' && event.dst === gate.uid && event.id === 'taunt' && event.op === 'add');
    expect(taunt).toBeGreaterThanOrEqual(0);
    expect(window.findIndex((event) => event.t === 'damage' && event.src === gate.uid)).toBeGreaterThan(taunt);
    const support = probe('wei_xuhuang', {
      seed: 3, maxRounds: 3, setup: { awaken: 'B', gear: { crit: -1 } },
      allies: [{ heroId: 'mob_qun_guard', level: 60, pos: 3, hpPct: 0.4, gear: { spd: -100 } }],
      B: [{ heroId: 'mob_qun_guard', level: 60, pos: 0, statMul: 0.05, gear: { hp: 100000, spd: 100, crit: -1 } }],
    });
    const own = support.result.units.find((unit) => unit.uid === support.uid)!;
    const shields = support.result.events.filter((event): event is Extract<BEvent, { t: 'shield' }> => event.t === 'shield' && event.src === support.uid && event.dst !== support.uid);
    expect(own.counters.xh_steady).toBe(3);
    expect(shields).toHaveLength(1);
    expect(shields[0].amount).toBe(Math.round(own.def * 1.15 * 0.8));
  });

  it('detonates Lu Xun targets by their individual burn stacks, removes them and prevents their next burn tick', () => {
    const { result, uid } = probe('wu_luxun', {
      seed: 9, setup: { energy: 100, gear: { spd: 200, crit: -1 } },
      B: [{ heroId: 'mob_qun_guard', level: 60, pos: 0, statMul: 0.05, gear: { hp: 100000 } }, { heroId: 'mob_wei_guard', level: 60, pos: 3, statMul: 0.05, gear: { hp: 100000 } }],
      rules: [
        { t: 'startStatus', side: 'B', to: 'front', id: 'burn', turns: 4, stacks: 1 },
        { t: 'startStatus', side: 'B', to: 'back', id: 'burn', turns: 4, stacks: 3 },
      ],
    });
    const cast = actionsOf(result.events, uid)[0];
    const window = actionWindow(result.events, cast.index);
    const stackCounts = result.units.filter((unit) => unit.side === 'B').map((foe) => {
      const previous = result.events.slice(0, cast.index).reverse().find((event) => event.t === 'status' && event.dst === foe.uid && event.id === 'burn' && event.op === 'add');
      expect(previous?.t).toBe('status');
      const stacks = previous!.t === 'status' ? previous!.stacks : 0;
      const hits = damageEvents(window, uid).filter((event) => event.dst === foe.uid);
      expect(hits).toHaveLength(2);
      expect(hits[1].crit).toBe(false);
      expect(hits[1].elem).toBe('fire');
      expect(hits[1].amount / hits[0].amount).toBeGreaterThan(stacks / 3 * 0.89);
      expect(hits[1].amount / hits[0].amount).toBeLessThan(stacks / 3 * 1.12);
      const removal = window.findIndex((event) => event.t === 'status' && event.dst === foe.uid && event.id === 'burn' && event.op === 'remove');
      expect(removal).toBeGreaterThanOrEqual(0);
      expect(window.indexOf(hits[1])).toBeGreaterThan(removal);
      expect(foe.statuses.some((status) => status.id === 'burn')).toBe(false);
      return stacks;
    });
    expect(stackCounts[0]).not.toBe(stackCounts[1]);
    expect(result.events.some((event) => event.t === 'dot' && event.id === 'burn')).toBe(false);
  });

  it('keeps Lu Xun awakening A pre-cast ignition separate from awakening B shield and cleansing', () => {
    const blaze = probe('wu_luxun', { seed: 8, setup: { awaken: 'A', energy: 100 } });
    const window = actionWindow(blaze.result.events, actionsOf(blaze.result.events, blaze.uid)[0].index);
    const ignition = window.findIndex((event) => event.t === 'status' && event.id === 'burn' && event.op === 'add');
    expect(ignition).toBeGreaterThanOrEqual(0);
    expect(window.findIndex((event) => event.t === 'damage' && event.src === blaze.uid)).toBeGreaterThan(ignition);
    expect(damageEvents(window, blaze.uid)).toHaveLength(2);
    const retreat = probe('wu_luxun', {
      seed: 8, setup: { awaken: 'B', energy: 100 },
      allies: [{ heroId: 'mob_wei_guard', level: 60, pos: 1, hpPct: 0.3 }],
      rules: [{ t: 'startStatus', side: 'A', to: 'all', id: 'fright', power: 0.1, turns: 99 }],
    });
    const cover = actionWindow(retreat.result.events, actionsOf(retreat.result.events, retreat.uid)[0].index);
    expect(cover.filter((event) => event.t === 'shield' && event.src === retreat.uid)).toHaveLength(2);
    expect(cover.filter((event) => event.t === 'status' && event.src === retreat.uid && event.id === 'fright' && event.op === 'remove')).toHaveLength(2);
  });

  it('replants Lu Xun level nine burn only after every second detonation and resets the fire counter', () => {
    const { result, uid } = probe('wu_luxun', { seed: 10, maxRounds: 2, setup: { skillLv: 9 }, rules: [{ t: 'roundEnergyLowest', side: 'A', amount: 100 }] });
    const casts = actionsOf(result.events, uid);
    expect(casts.map(({ event }) => event.kind)).toEqual(['ultimate', 'ultimate']);
    const burnCounts = casts.map(({ index }) => actionWindow(result.events, index).filter((event) => event.t === 'status' && event.src === uid && event.id === 'burn' && event.op === 'add').length);
    expect(burnCounts).toEqual([0, 1]);
    expect(result.units.find((unit) => unit.uid === uid)!.counters.lx_fires).toBe(0);
  });

  it('counts only other Qun ally actions for Zhang Jiao and still calls at least two instant helpers', () => {
    const { result, uid } = probe('qun_zhangjiao', {
      seed: 3, setup: { gear: { spd: -50 } },
      allies: [{ heroId: 'mob_qun_vanguard', level: 60, pos: 1 }, { heroId: 'mob_wei_guard', level: 60, pos: 2 }],
    });
    expect(result.units.find((unit) => unit.uid === uid)!.counters.zj_helpers).toBe(2);
    const alone = probe('qun_zhangjiao', { seed: 3, setup: { energy: 100 } });
    const summon = alone.result.events.find((event) => event.t === 'summon' && event.uid === alone.uid);
    expect(summon?.t === 'summon' && summon.count).toBe(2);
    expect(summon?.t === 'summon' && summon.beast).toBe('yellowKitten');
    expect(alone.result.units.find((unit) => unit.uid === alone.uid)!.counters.zj_helpers).toBe(0);
    expect(alone.result.units).toHaveLength(2);
  });

  it('consumes Zhang Jiao capped helper count while awakening A adds a round-start assist without leaving units', () => {
    const { result, uid } = probe('qun_zhangjiao', {
      seed: 4, maxRounds: 2, setup: { awaken: 'A', energy: 70, gear: { spd: -50, hp: 100000 } },
      allies: [{ heroId: 'mob_qun_vanguard', level: 60, pos: 3 }, { heroId: 'mob_qun_guard', level: 60, pos: 4 }],
    });
    const acts = actionsOf(result.events, uid);
    expect(acts.map(({ event }) => event.kind)).toEqual(['basic', 'ultimate']);
    const summons = result.events.filter((event): event is Extract<BEvent, { t: 'summon' }> => event.t === 'summon' && event.uid === uid && event.beast === 'yellowKitten');
    expect(summons.map((event) => event.count)).toEqual([2, 4]);
    expect(result.events.indexOf(summons[0])).toBeLessThan(acts[1].index);
    expect(result.events.indexOf(summons[1])).toBeGreaterThan(acts[1].index);
    expect(result.units.find((unit) => unit.uid === uid)!.counters.zj_helpers).toBe(0);
    expect(result.units).toHaveLength(4);
  });

  it('applies Zhang Jiao awakening B cleansing and ward before the summon and base healing', () => {
    const { result, uid } = probe('qun_zhangjiao', {
      seed: 5, setup: { awaken: 'B', energy: 100, hpPct: 0.3, gear: { spd: 100 } },
      allies: [{ heroId: 'mob_wei_guard', level: 60, pos: 1, hpPct: 0.2 }],
      rules: [{ t: 'startStatus', side: 'A', to: 'all', id: 'fright', power: 0.1, turns: 99 }],
    });
    const window = actionWindow(result.events, actionsOf(result.events, uid)[0].index);
    const summons = window.findIndex((event) => event.t === 'summon' && event.uid === uid);
    const cover = window.flatMap((event, index) => event.t === 'status' && event.src === uid && (event.id === 'ward' || event.id === 'fright') ? [index] : []);
    expect(cover).toHaveLength(4);
    expect(cover.every((index) => index < summons)).toBe(true);
  });

  it('reads shared Man totems before the current basic increments them and stops the bonus after tiger summoning clears them', () => {
    const { result, uid } = probe('man_shamoke', {
      seed: 6, maxRounds: 4, setup: { gear: { spd: 100, crit: -1 } },
      allies: [{ heroId: 'mob_man_guard', level: 60, pos: 1, gear: { crit: -1 } }],
      rules: [{ t: 'startStatus', side: 'A', to: 'all', id: 'yarn', turns: 99 }],
    });
    const acts = actionsOf(result.events, uid);
    const layers = acts.map(({ index }) => actionWindow(result.events, index).filter((event) => event.t === 'status' && event.src === uid && event.id === 'poison' && event.op === 'add').length);
    expect(layers).toEqual([1, 1, 2, 1]);
    const tigers = result.events.filter((event) => event.t === 'summon' && event.beast === 'tiger');
    expect(tigers).toHaveLength(1);
    expect(tigers[0].t === 'summon' && tigers[0].count).toBe(3);
    const own = result.units.find((unit) => unit.uid === uid)!;
    expect(own.counters.totem).toBeUndefined();
    const poison = result.events.filter((event): event is Extract<BEvent, { t: 'dot' }> => event.t === 'dot' && event.id === 'poison');
    expect(poison.length).toBeGreaterThan(0);
    expect(poison[0].amount).toBe(Math.round(own.atk * 0.18));
  });

  it('lets Sha Mo Ke awakening A spread poison while awakening B returns a shield and energy through the team totem condition', () => {
    const spread = probe('man_shamoke', {
      seed: 2, setup: { awaken: 'A', energy: 100 },
      B: [0, 1, 3].map((pos) => ({ heroId: 'mob_qun_guard', level: 60, pos, statMul: 0.05, gear: { hp: 100000 } })),
    });
    expect(spread.result.units.filter((unit) => unit.side === 'B' && unit.statuses.some((status) => status.id === 'poison'))).toHaveLength(3);
    const returnWind = probe('man_shamoke', {
      seed: 2, maxRounds: 3, setup: { awaken: 'B', gear: { spd: 100 } },
      allies: [{ heroId: 'mob_man_guard', level: 60, pos: 1, hpPct: 0.4 }],
      rules: [{ t: 'startStatus', side: 'A', to: 'all', id: 'yarn', turns: 99 }],
    });
    const shields = returnWind.result.events.filter((event) => event.t === 'shield' && event.src === returnWind.uid && event.dst !== returnWind.uid);
    expect(shields).toHaveLength(1);
    const third = actionsOf(returnWind.result.events, returnWind.uid)[2];
    expect(actionWindow(returnWind.result.events, third.index).some((event) => event.t === 'energy' && event.uid !== returnWind.uid)).toBe(true);
  });

  it('reflects Meng You current damage amount including fully absorbed damage, with no defense reduction or critical hit', () => {
    for (const addedAtk of [100, 600]) {
      const { result, uid } = probe('man_mengyou', {
        seed: 13, B: [{ heroId: 'mob_qun_guard', level: 60, pos: 0, statMul: 0.05, gear: { hp: 100000, def: 20000, atk: addedAtk, crit: -1, spd: 100 } }],
      });
      const incoming = damageEvents(result.events).find((event) => event.dst === uid)!;
      const returned = damageEvents(result.events, uid).find((event) => event.elem === 'true')!;
      expect(incoming.absorbed).toBeGreaterThan(0);
      if (addedAtk === 100) expect(incoming.absorbed).toBe(incoming.amount);
      expect(returned.dst).toBe(incoming.src);
      expect(returned.crit).toBe(false);
      expect(returned.amount).toBeGreaterThanOrEqual(Math.floor(incoming.amount * 0.6 * 0.95) - 1);
      expect(returned.amount).toBeLessThanOrEqual(Math.ceil(incoming.amount * 0.6 * 1.05) + 1);
    }
  });

  it('draws front-targeted enemy basics to Meng You even when he stands behind another ally', () => {
    const { result, uid } = probe('man_mengyou', {
      seed: 5, setup: { pos: 3 }, allies: [{ heroId: 'mob_wei_guard', level: 60, pos: 0 }],
      B: [{ heroId: 'mob_qun_guard', level: 60, pos: 0, statMul: 0.05, gear: { hp: 100000, spd: 100 } }],
    });
    const foe = result.units.find((unit) => unit.side === 'B')!;
    expect(actionsOf(result.events, foe.uid)[0].event.targets).toEqual([uid]);
    expect(result.events.findIndex((event) => event.t === 'status' && event.dst === uid && event.id === 'taunt' && event.op === 'add')).toBeLessThan(result.events.findIndex((event) => event.t === 'round'));
  });

  it('marks Meng You attacker after the base reflection in awakening A and protects allies with awakening B', () => {
    const marked = probe('man_mengyou', { seed: 7, setup: { awaken: 'A' }, B: [{ heroId: 'mob_qun_guard', level: 60, pos: 0, statMul: 0.05, gear: { hp: 100000, spd: 100 } }] });
    const reflection = marked.result.events.findIndex((event) => event.t === 'damage' && event.src === marked.uid && event.elem === 'true');
    const bell = marked.result.events.findIndex((event) => event.t === 'status' && event.src === marked.uid && event.id === 'mark' && event.op === 'add');
    expect(reflection).toBeGreaterThanOrEqual(0);
    expect(bell).toBeGreaterThan(reflection);
    const seated = probe('man_mengyou', {
      seed: 7, setup: { awaken: 'B', energy: 100 }, allies: [{ heroId: 'mob_wei_guard', level: 60, pos: 1, hpPct: 0.3 }],
      rules: [{ t: 'startStatus', side: 'A', to: 'all', id: 'fright', power: 0.1, turns: 99 }],
    });
    const cast = actionsOf(seated.result.events, seated.uid)[0];
    const window = actionWindow(seated.result.events, cast.index);
    expect(window.filter((event) => event.t === 'shield' && event.src === seated.uid && event.dst !== seated.uid)).toHaveLength(1);
    expect(window.filter((event) => event.t === 'status' && event.src === seated.uid && event.id === 'fright' && event.op === 'remove')).toHaveLength(2);
  });

  it('lets Nan Hua consume his one granted nine-lives protection on lethal poison, then sleeps on the next lethal tick', () => {
    const { result, uid } = probe('xian_nanhua', {
      seed: 12, maxRounds: 3, setup: { hpPct: 0.05 },
      allies: [{ heroId: 'mob_qun_guard', level: 60, pos: 3, gear: { hp: 100000, spd: -100 } }],
      rules: [{ t: 'on', ev: 'basicHit', side: 'B', max: 1, act: { k: 'status', id: 'poison', turns: 5, snapAtk: 1000, who: 'target' } }],
    });
    const own = result.units.find((unit) => unit.uid === uid)!;
    const poisoned = result.events.flatMap((event, index) => event.t === 'dot' && event.dst === uid && event.id === 'poison' ? [{ event, index }] : []);
    expect(poisoned).toHaveLength(2);
    const first = poisoned[0].index;
    const second = poisoned[1].index;
    const protection = result.events.findIndex((event) => event.t === 'text' && event.uid === uid && event.text === '九命！');
    const death = result.events.findIndex((event) => event.t === 'death' && event.uid === uid);
    expect(protection).toBeGreaterThan(first);
    expect(protection).toBeLessThan(second);
    expect(death).toBeGreaterThan(second);
    expect(result.events.slice(0, second).some((event) => event.t === 'death' && event.uid === uid)).toBe(false);
    expect(result.events.filter((event) => event.t === 'status' && event.dst === uid && event.id === 'nine' && event.op === 'add')).toHaveLength(1);
    expect(result.events.filter((event) => event.t === 'status' && event.dst === uid && event.id === 'nine' && event.op === 'remove')).toHaveLength(1);
    const between = result.events.slice(protection + 1, second);
    const healed = between.find((event) => event.t === 'heal' && event.dst === uid);
    expect(healed?.t === 'heal' && healed.hp - healed.amount).toBe(Math.round(own.maxHp * 0.15));
    expect(own.alive).toBe(false);
    expect(result.events.some((event) => event.t === 'revive' && event.uid === uid)).toBe(false);
  });

  it('keeps Nan Hua awakening A self recovery separate from awakening B pre-ultimate ally protection', () => {
    const rested = probe('xian_nanhua', { seed: 5, setup: { awaken: 'A', hpPct: 0.1 } });
    const cast = actionsOf(rested.result.events, rested.uid)[0];
    const own = rested.result.units.find((unit) => unit.uid === rested.uid)!;
    const heals = rested.result.events.filter((event) => event.t === 'heal' && event.src === rested.uid && event.dst === rested.uid);
    expect(heals.some((event) => event.t === 'heal' && event.amount === Math.round(own.maxHp * 0.12))).toBe(true);
    expect(actionWindow(rested.result.events, cast.index).filter((event) => event.t === 'shield' && event.src === rested.uid)).toHaveLength(2);
    const door = probe('xian_nanhua', {
      seed: 5, setup: { awaken: 'B', pos: 3 },
      allies: [{ heroId: 'mob_wei_guard', level: 60, pos: 0, hpPct: 0.3 }],
      B: [{ heroId: 'mob_qun_guard', level: 60, pos: 0, energy: 100, statMul: 0.05, gear: { hp: 100000, spd: 100 } }],
    });
    const foe = door.result.units.find((unit) => unit.side === 'B')!;
    const window = actionWindow(door.result.events, actionsOf(door.result.events, foe.uid)[0].index);
    const shield = window.findIndex((event) => event.t === 'shield' && event.src === door.uid && event.dst !== door.uid);
    expect(shield).toBeGreaterThanOrEqual(0);
    expect(window.findIndex((event) => event.t === 'damage' && event.src === foe.uid)).toBeGreaterThan(shield);
  });

  it('prevents single-target enemies from selecting Zhao Yun after a kill when another ally remains', () => {
    const { result, uid } = probe('shu_zhaomiaoyun', {
      seed: 3, allies: [{ heroId: 'mob_wei_guard', level: 60, pos: 3, gear: { spd: -100, hp: 100000 } }],
      B: [{ heroId: 'mob_qun_guard', level: 60, pos: 0, statMul: 0.05, gear: { hp: 100000 } }, { heroId: 'mob_wei_healer', level: 1, pos: 3, hpPct: 0.01 }],
    });
    const foe = result.units.find((unit) => unit.side === 'B' && unit.pos === 0)!;
    const ally = result.units.find((unit) => unit.side === 'A' && unit.uid !== uid)!;
    expect(damageEvents(result.events, uid).some((event) => event.killed)).toBe(true);
    expect(result.units.find((unit) => unit.uid === uid)!.statuses.find((status) => status.id === 'stealth')?.turns).toBe(1);
    expect(actionsOf(result.events, foe.uid)[0].event.targets).toEqual([ally.uid]);
    expect(damageEvents(result.events, foe.uid).some((event) => event.dst === uid)).toBe(false);
  });

  it('allows all-target attacks and the last remaining target to include Zhao Yun despite stealth', () => {
    for (const allTarget of [false, true]) {
      const { result, uid } = probe('shu_zhaomiaoyun', {
        seed: 3,
        allies: allTarget ? [{ heroId: 'mob_wei_guard', level: 60, pos: 3, gear: { spd: -100, hp: 100000 } }] : [],
        B: [{ heroId: allTarget ? 'mob_qun_vanguard' : 'mob_qun_guard', level: 60, pos: 0, energy: allTarget ? 100 : 0, statMul: 0.05, gear: { hp: 100000 } }, { heroId: 'mob_wei_healer', level: 1, pos: 3, hpPct: 0.01 }],
      });
      const foe = result.units.find((unit) => unit.side === 'B' && unit.pos === 0)!;
      expect(result.units.find((unit) => unit.uid === uid)!.statuses.some((status) => status.id === 'stealth')).toBe(true);
      expect(actionsOf(result.events, foe.uid)[0].event.targets).toContain(uid);
      expect(damageEvents(result.events, foe.uid).some((event) => event.dst === uid)).toBe(true);
    }
  });

  it('uses Zhao Yun awakening A extra action while awakening B saves its one rescue until an ally actually needs it', () => {
    const returning = probe('shu_zhaomiaoyun', {
      seed: 4, setup: { awaken: 'A' },
      B: [{ heroId: 'mob_qun_guard', level: 60, pos: 0, statMul: 0.05, gear: { hp: 100000 } }, { heroId: 'mob_wei_healer', level: 1, pos: 3, hpPct: 0.01 }],
    });
    expect(actionsOf(returning.result.events, returning.uid)).toHaveLength(2);
    expect(returning.result.units.find((unit) => unit.uid === returning.uid)!.statuses.some((status) => status.id === 'stealth')).toBe(false);
    const options: ProbeOptions = {
      seed: 9, setup: { awaken: 'B', pos: 3 },
      allies: [{ heroId: 'mob_wei_guard', level: 60, pos: 0, hpPct: 0.41, gear: { spd: -100 } }],
      B: [{ heroId: 'mob_qun_guard', level: 60, pos: 0, statMul: 0.05, gear: { hp: 100000, atk: 200, crit: -1 } }],
      rules: [{ t: 'startStatus', side: 'A', to: 'front', id: 'fright', power: 0.1, turns: 99 }],
    };
    const first = probe('shu_zhaomiaoyun', options);
    expect(first.result.units.find((unit) => unit.uid === first.uid)!.counters.zy_rescue ?? 0).toBe(0);
    expect(first.result.events.some((event) => event.t === 'heal' && event.src === first.uid)).toBe(false);
    const later = probe('shu_zhaomiaoyun', { ...options, maxRounds: 3 });
    expect(later.result.units.find((unit) => unit.uid === later.uid)!.counters.zy_rescue).toBe(1);
    expect(later.result.events.filter((event) => event.t === 'heal' && event.src === later.uid)).toHaveLength(1);
    expect(later.result.events.filter((event) => event.t === 'shield' && event.src === later.uid)).toHaveLength(1);
    expect(later.result.events.some((event) => event.t === 'status' && event.src === later.uid && event.id === 'fright' && event.op === 'remove')).toBe(true);
  });
});
