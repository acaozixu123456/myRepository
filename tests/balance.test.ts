import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as battleEngine from '../src/engine/battle';
import type { BattleConfig, BEvent, UnitSetup } from '../src/engine/types';
import { HEROES, HERO_BY_ID } from '../src/data/heroes';
import { FACTION_ORDER } from '../src/data/factions';
import { BONDS, COUNTER_RING, ROLES } from '../src/data/systems';
import { BALANCE_MIN_SAMPLES, buildBondProbeMatch, buildCounterProbeMatch, buildLineup, runBalance, summarizeBattle } from '../src/game/balance';
import type { BalanceReport, BattleSnapshot, WinStats } from '../src/game/balance';
import { renderBalanceReport } from '../tools/balance-report';

const smallOptions = { games: 60, level: 60, star: 5, randomAwakening: true, seed: 20261011 } as const;
const integer = (value: number) => { expect(Number.isSafeInteger(value)).toBe(true); expect(value).toBeGreaterThanOrEqual(0); };
const probability = (value: number | null) => {
  if (value === null) return;
  expect(Number.isFinite(value)).toBe(true); expect(value).toBeGreaterThanOrEqual(0); expect(value).toBeLessThanOrEqual(1);
};
function winStats(stats: WinStats) {
  for (const value of [stats.samples, stats.wins, stats.losses, stats.draws]) integer(value);
  expect(stats.wins + stats.losses + stats.draws).toBe(stats.samples);
  expect(stats.lowSample).toBe(stats.samples < BALANCE_MIN_SAMPLES);
  probability(stats.winRate);
  if (!stats.samples) { expect(stats.winRate).toBeNull(); expect(stats.deviation).toBeNull(); }
  else {
    expect(stats.winRate).toBeCloseTo((stats.wins + stats.draws / 2) / stats.samples);
    expect(stats.deviation).toBeCloseTo(stats.winRate! - 0.5);
  }
}
function lineup(team: UnitSetup[]) {
  expect(team).toHaveLength(5);
  expect(new Set(team.map((unit) => unit.heroId)).size).toBe(5);
  expect(team.map((unit) => unit.pos).sort()).toEqual([0, 1, 2, 3, 4]);
  const frontPreferred = team.filter((unit) => ROLES[HERO_BY_ID[unit.heroId].role].row === '前排');
  expect(frontPreferred.filter((unit) => unit.pos < 3).length).toBe(Math.min(frontPreferred.length, 3));
  for (const unit of team) {
    expect(HERO_BY_ID[unit.heroId]).toBeDefined();
    expect(unit.level).toBe(60); expect(unit.star).toBe(5);
    expect(['A', 'B']).toContain(unit.awaken);
  }
}

const damage = (src: number, dst: number, amount: number, absorbed = 0): BEvent => ({ t: 'damage', src, dst, amount, absorbed, crit: false, elem: 'phys', hp: 900, shield: 0, killed: false, hit: 0, hits: 1 });
const status = (dst: number, src: number, id: string, op: 'add' | 'remove' = 'add'): BEvent => ({ t: 'status', dst, src, id, op, stacks: op === 'add' ? 1 : 0 });
const dot = (dst: number, id: string, amount: number): BEvent => ({ t: 'dot', dst, id, amount, hp: 800, killed: false });
const act = (uid: number, kind: 'basic' | 'ultimate'): BEvent => ({ t: 'act', uid, kind, skill: '试作', fx: 'ult.generic', targets: [], melee: false });

/** 手工账本：敌伤160/50，治疗40/5，自损与友伤730，未知DOT35。 */
function eventFixture(): BattleSnapshot {
  return {
    winner: 'A', rounds: 7,
    units: [
      { uid: 1, heroId: 'wei_caomiaode', side: 'A', alive: true },
      { uid: 2, heroId: 'wei_guojia', side: 'A', alive: true },
      { uid: 3, heroId: 'wu_zhoumiaoyu', side: 'B', alive: true },
      { uid: 4, heroId: 'shu_guanyunmiao', side: 'B', alive: true },
    ],
    events: [
      { t: 'round', n: 1 }, act(1, 'basic'),
      { t: 'shield', src: 3, dst: 3, amount: 60, total: 60 }, damage(1, 3, 100, 60),
      damage(1, 1, 700), damage(1, 2, 30),
      status(3, 1, 'burn'), status(3, 2, 'burn'), dot(3, 'burn', 20),
      status(3, 2, 'scratch'), dot(3, 'scratch', 30),
      status(3, 1, 'burn', 'remove'), status(3, 2, 'burn'), dot(3, 'burn', 10),
      { t: 'death', uid: 3 }, { t: 'revive', uid: 3, hp: 300 }, dot(3, 'burn', 20),
      { t: 'heal', src: 2, dst: 1, amount: 30, hp: 900 },
      status(1, 2, 'purr'), { t: 'heal', src: 1, dst: 1, amount: 10, hp: 910 },
      { t: 'heal', src: 3, dst: 3, amount: 5, hp: 305 }, damage(3, 2, 50), dot(2, 'burn', 15),
      { t: 'death', uid: 2 }, { t: 'revive', uid: 2, hp: 300 }, { t: 'death', uid: 2 }, { t: 'revive', uid: 2, hp: 300 },
      { t: 'round', n: 4 }, act(3, 'ultimate'), act(1, 'ultimate'),
      { t: 'end', winner: 'A', rounds: 7 },
    ],
  };
}

describe('balance event accounting', () => {
  it('counts shield-inclusive enemy damage once, preserves DOT ownership, and attributes actual healing by src', () => {
    const fixture = eventFixture();
    const before = structuredClone(fixture);
    const observed = summarizeBattle(fixture);
    const commander = observed.units.find((unit) => unit.uid === 1)!;
    const adviser = observed.units.find((unit) => unit.uid === 2)!;
    expect(observed.teamDamage).toEqual({ A: 160, B: 50 });
    expect(commander.damage).toBe(120); expect(adviser.damage).toBe(40);
    expect(commander.damageShare).toBe(0.75); expect(adviser.damageShare).toBe(0.25);
    expect(observed.unattributedDotDamage).toBe(35);
    expect(observed.excludedFriendlyDamage).toBe(730);
    expect(observed.teamHealing).toEqual({ A: 40, B: 5 });
    expect(commander.healing).toBe(10); expect(adviser.healing).toBe(30);
    expect(commander.healingShare).toBe(0.25); expect(adviser.healingShare).toBe(0.75);
    expect(fixture).toEqual(before);
  });

  it('records a death even after revival and gets first ultimate from round markers', () => {
    const observed = summarizeBattle(eventFixture());
    expect(observed.units.find((unit) => unit.uid === 2)).toMatchObject({ slept: true, asleepAtEnd: false });
    expect(observed.units.find((unit) => unit.uid === 3)).toMatchObject({ slept: true, asleepAtEnd: false, ultimateCasts: 1 });
    expect(observed.firstUltimateRound).toBe(4);
    expect(observed.units.find((unit) => unit.uid === 1)?.ultimateCasts).toBe(1);
  });

  it('distinguishes both-sides-alive at the cap from a true draw and a last-round elimination', () => {
    const fixture = eventFixture();
    expect(summarizeBattle({ ...fixture, rounds: 30, winner: 'A' })).toMatchObject({ timedOut: true, draw: false });
    expect(summarizeBattle({ ...fixture, rounds: 30, winner: 'draw' })).toMatchObject({ timedOut: true, draw: true });
    const eliminated = fixture.units.map((unit) => unit.side === 'B' ? { ...unit, alive: false } : unit);
    expect(summarizeBattle({ ...fixture, units: eliminated, rounds: 30 })).toMatchObject({ timedOut: false, draw: false });
    expect(summarizeBattle({ ...fixture, rounds: 29 })).toMatchObject({ timedOut: false });
    expect(summarizeBattle({ ...fixture, events: [] }).firstUltimateRound).toBeNull();
    expect(summarizeBattle({ ...fixture, events: [] }).units.every((unit) => unit.damageShare === 0 && unit.healingShare === 0)).toBe(true);
  });
});

describe('balance sampling and complete report', () => {
  let report: BalanceReport;
  let elapsedMs = Infinity;
  const calls: BattleConfig[] = [];
  beforeAll(() => {
    const original = battleEngine.simulate;
    const spy = vi.spyOn(battleEngine, 'simulate').mockImplementation((config) => {
      calls.push(structuredClone(config));
      return original(config);
    });
    try {
      const start = performance.now();
      report = runBalance(smallOptions);
      elapsedMs = performance.now() - start;
    } finally { spy.mockRestore(); }
  });

  it('covers all heroes, factions, counter directions and bonds in under five seconds', () => {
    expect(elapsedMs).toBeLessThan(5000);
    expect(report.heroes.map((hero) => hero.heroId).sort()).toEqual(HEROES.map((hero) => hero.id).sort());
    expect(report.heroes).toHaveLength(24);
    expect(report.factions.map((faction) => faction.faction).sort()).toEqual([...FACTION_ORDER].sort());
    expect(report.counters.map((counter) => `${counter.advantagedFaction}:${counter.disadvantagedFaction}`).sort()).toEqual(COUNTER_RING.map((faction, index) => `${faction}:${COUNTER_RING[(index + 1) % 6]}`).sort());
    expect(report.bonds.map((bond) => bond.name).sort()).toEqual(BONDS.map((bond) => bond.name).sort());
    expect(report.summary.randomGames).toBe(60);
    expect(report.summary.totalSimulations).toBe(60 + report.summary.counterProbeGames + report.summary.bondProbeGames);
    expect(report.heroes.reduce((sum, hero) => sum + hero.appearances, 0)).toBe(600);
    expect(report.counters.reduce((sum, counter) => sum + counter.games, 0)).toBe(report.summary.counterProbeGames);
    expect(report.bonds.reduce((sum, bond) => sum + bond.probeWithBond.samples + bond.probeControl.samples, 0)).toBe(report.summary.bondProbeGames);
    expect(report.anomalies).toHaveLength(0);
    expect(report.lowSamples.length).toBeGreaterThan(0);
  });

  it('has valid numerical probabilities and keeps probe samples out of main statistics', () => {
    for (const hero of report.heroes) {
      winStats(hero); expect(hero.samples).toBe(hero.appearances);
      for (const value of [hero.avgDamageShare, hero.avgHealingShare, hero.sleepRate, hero.finalSleepRate]) probability(value);
      integer(hero.ultimateCasts); integer(hero.sleepAppearances);
      if (hero.appearances) {
        expect(hero.avgUltimateCasts).toBeCloseTo(hero.ultimateCasts / hero.appearances);
        expect(hero.sleepRate).toBeCloseTo(hero.sleepAppearances / hero.appearances);
        expect(hero.finalSleepRate!).toBeLessThanOrEqual(hero.sleepRate!);
      }
    }
    for (const faction of report.factions) { winStats(faction); expect(faction.samples).toBe(faction.appearances); }
    for (const counter of report.counters) { winStats(counter); expect(counter.samples).toBe(counter.games); }
    for (const bond of report.bonds) {
      for (const stats of [bond.randomWithBond, bond.randomWithoutBond, bond.probeWithBond, bond.probeControl]) winStats(stats);
      expect(bond.randomWithBond.samples + bond.randomWithoutBond.samples).toBe(120);
      if (bond.randomLift !== null) expect(bond.randomLift).toBeCloseTo(bond.randomWithBond.winRate! - bond.randomWithoutBond.winRate!);
      if (bond.probeLift !== null) expect(bond.probeLift).toBeCloseTo(bond.probeWithBond.winRate! - bond.probeControl.winRate!);
    }
    probability(report.summary.timeoutRate); probability(report.summary.drawRate);
    expect(report.summary.timeoutRate).toBeCloseTo(report.summary.timeoutGames / 60);
    expect(report.summary.drawRate).toBeCloseTo(report.summary.drawGames / 60);
    expect(report.summary.gamesWithUltimate + report.summary.gamesWithoutUltimate).toBe(60);
    expect(report.summary.avgRounds).toBeGreaterThan(0); expect(report.summary.avgRounds).toBeLessThanOrEqual(30);
    if (report.summary.avgFirstUltimateRound !== null) { expect(report.summary.avgFirstUltimateRound).toBeGreaterThanOrEqual(1); expect(report.summary.avgFirstUltimateRound).toBeLessThanOrEqual(30); }
    for (const value of [report.summary.enemyDamage, report.summary.healing, report.summary.unattributedDotDamage, report.summary.excludedFriendlyDamage]) integer(value);
  });

  it('actually swaps complete main lineups and seeds, with sensible roles and no teammate duplicates', () => {
    expect(calls.length).toBe(report.summary.totalSimulations);
    for (let index = 0; index < smallOptions.games; index += 2) {
      const first = calls[index], swapped = calls[index + 1];
      expect(swapped.A).toEqual(first.B); expect(swapped.B).toEqual(first.A); expect(swapped.seed).toBe(first.seed);
      lineup(first.A); lineup(first.B);
    }
  });

  it('repeats exactly for a fixed seed and does not mutate explicit roster input', () => {
    expect(runBalance(smallOptions)).toEqual(report);
    const ids = ['shu_guanyunmiao', 'wei_caomiaode', 'shu_zhangmiaofei', 'man_mengmiaohuo', 'shu_liumiaobei'];
    const before = [...ids];
    const one = buildLineup(ids, smallOptions, 17);
    expect(buildLineup(ids, smallOptions, 17)).toEqual(one); expect(ids).toEqual(before); lineup(one);
    expect(buildLineup(ids, { ...smallOptions, star: 4 }, 17).every((unit) => unit.awaken === undefined)).toBe(true);
  });

  it('keeps counter neutrals identical and changes exactly one hero for bond controls', () => {
    for (const faction of COUNTER_RING) {
      const probe = buildCounterProbeMatch(faction, smallOptions, 91);
      lineup(probe.advantagedTeam); lineup(probe.disadvantagedTeam);
      expect(probe.advantagedTeam.filter((unit) => HERO_BY_ID[unit.heroId].faction === faction).length).toBeGreaterThanOrEqual(3);
      expect(probe.disadvantagedTeam.filter((unit) => HERO_BY_ID[unit.heroId].faction === probe.disadvantagedFaction).length).toBeGreaterThanOrEqual(3);
      expect(probe.neutralHeroIds).toHaveLength(2);
      for (const id of probe.neutralHeroIds) {
        const left = probe.advantagedTeam.find((unit) => unit.heroId === id), right = probe.disadvantagedTeam.find((unit) => unit.heroId === id);
        expect(left).toBeDefined(); expect(right).toBeDefined();
        expect(left?.awaken).toBe(right?.awaken);
        expect([faction, probe.disadvantagedFaction]).not.toContain(HERO_BY_ID[id].faction);
      }
    }
    for (const bond of BONDS) {
      const probe = buildBondProbeMatch(bond.name, smallOptions, 92);
      lineup(probe.withBond); lineup(probe.control); lineup(probe.opponent);
      const full = new Set(probe.withBond.map((unit) => unit.heroId));
      const control = new Set(probe.control.map((unit) => unit.heroId));
      expect(bond.heroes.every((id) => full.has(id))).toBe(true);
      expect(bond.heroes.every((id) => control.has(id))).toBe(false);
      expect([...full].filter((id) => !control.has(id))).toEqual([probe.replacedHeroId]);
      expect([...control].filter((id) => !full.has(id))).toEqual([probe.replacementHeroId]);
      expect([...full].filter((id) => control.has(id))).toHaveLength(4);
      for (const id of [...full].filter((heroId) => control.has(heroId))) {
        expect(probe.withBond.find((unit) => unit.heroId === id)?.awaken).toBe(probe.control.find((unit) => unit.heroId === id)?.awaken);
      }
    }
  });

  it('rejects unusable parameters and invalid explicit rosters', () => {
    for (const games of [0, -2, 1, 61, NaN, Infinity]) expect(() => runBalance({ games })).toThrow();
    for (const level of [0, -1, 1.5, NaN]) expect(() => runBalance({ games: 2, level })).toThrow();
    for (const star of [0, 6, 2.5, NaN]) expect(() => runBalance({ games: 2, star })).toThrow();
    expect(() => buildLineup(HEROES.slice(0, 4).map((hero) => hero.id), smallOptions, 1)).toThrow();
    expect(() => buildLineup(Array(5).fill('wei_caomiaode'), smallOptions, 1)).toThrow();
    expect(() => buildLineup(['unknown', ...HEROES.slice(0, 4).map((hero) => hero.id)], smallOptions, 1)).toThrow();
  });

  it('renders every requested field, external generation time, missing samples and stated limitations', () => {
    const time = '2026-10-11T12:34:56.000Z';
    const markdown = renderBalanceReport(report, time);
    expect(renderBalanceReport(report, time)).toBe(markdown); expect(markdown).toContain(time);
    for (const hero of HEROES) expect(markdown).toContain(hero.id);
    for (const bond of BONDS) expect(markdown).toContain(bond.name);
    for (const phrase of ['平均伤害占比', '平均治疗占比', '绝技总次数', '曾睡着次数', '首个绝技平均回合', '克制环探针', '羁绊探针', 'Top 5', '异常摘要', '待 Claude 裁决', 'absorbed', 'DOT', '呼噜', '复活', '混杂', '低样本']) expect(markdown).toContain(phrase);
    expect(markdown).not.toMatch(/\b(?:NaN|Infinity|undefined)\b/);
    const emptyHero = { ...report.heroes[0], samples: 0, appearances: 0, wins: 0, losses: 0, draws: 0, winRate: null, deviation: null, avgDamageShare: null, avgHealingShare: null, ultimateCasts: 0, avgUltimateCasts: null, sleepAppearances: 0, sleepRate: null, finalSleepRate: null, lowSample: true };
    expect(renderBalanceReport({ ...report, heroes: [emptyHero, ...report.heroes.slice(1)] }, time)).toContain('—（无样本）');
    expect(renderBalanceReport(report, 'next-generation')).toContain('next-generation');
  });
});
