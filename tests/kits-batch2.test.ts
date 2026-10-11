import { describe, expect, it } from 'vitest';
import { HERO_BY_ID } from '../src/data/heroes';
import { KITS } from '../src/data/kits';
import { KITS_B2 } from '../src/data/kits/batch2';
import { simulate } from '../src/engine/battle';
import type { BattleResult } from '../src/engine/battle';
import type { BEvent, BattleConfig, UnitSetup } from '../src/engine/types';

// 尚未合入图鉴/索引时，以同职业旧猫作为战斗载体；执行的始终是真实 KITS_B2。
// 图鉴一旦注册新猫即自动使用新猫，测试不承担阵营/稀有度覆盖验收。
const carriers: Record<string, string> = {
  wu_ganning: 'man_zhurong', qun_huaxiong: 'qun_lvbuding', xian_yuji: 'xian_zhangzhua',
  shu_huangzhong: 'wu_sunxiangxiang', shu_machao: 'shu_guanyunmiao', shu_jiangwei: 'xian_zhangzhua',
};

interface ProbeOptions extends Omit<BattleConfig, 'A' | 'B'> {
  setup?: Partial<UnitSetup>;
  allies?: UnitSetup[];
  B?: UnitSetup[];
}

function probe(heroId: string, options: ProbeOptions): { result: BattleResult; uid: number } {
  const { setup = {}, allies = [], B, ...cfg } = options;
  const id = Object.hasOwn(HERO_BY_ID, heroId) ? heroId : carriers[heroId];
  const original = KITS[id];
  KITS[id] = KITS_B2[heroId];
  try {
    const result = simulate({
      noBonds: true,
      maxRounds: 1,
      ...cfg,
      A: [{ heroId: id, level: 60, star: 5, skillLv: 1, pos: 0, ...setup }, ...allies],
      B: B ?? [{ heroId: 'mob_qun_guard', level: 60, pos: 0, statMul: 0.05, gear: { hp: 100000 } }],
    });
    return { result, uid: result.units.find((unit) => unit.side === 'A' && unit.heroId === id)!.uid };
  } finally {
    if (original) KITS[id] = original;
    else delete KITS[id];
  }
}

function actionWindow(events: BEvent[], actionIndex: number): BEvent[] {
  const end = events.findIndex((event, index) => index > actionIndex && event.t === 'act');
  return events.slice(actionIndex + 1, end < 0 ? undefined : end);
}

const actionsOf = (events: BEvent[], uid: number) => events.flatMap((event, index) => event.t === 'act' && event.uid === uid ? [{ event, index }] : []);

describe('batch two skill behavior', () => {
  it('keeps draft identifiers distinct from registered skills and every ultimate upgrade at levels 3, 6 and 9', () => {
    const ids = Object.values({ ...KITS, ...KITS_B2 }).flatMap((kit) => [kit.basic.id, kit.ultimate.id, kit.passive.id]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [heroId, kit] of Object.entries(KITS_B2)) {
      expect(kit.heroId).toBe(heroId);
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
      seed: 4, setup: { skillLv: 9 }, startEnergy: { A: 100, B: 0 },
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
});
