import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { CHAPTERS } from '../src/content/campaign';
import { HERO_BY_ID, PREMIUM_HEROES, STANDARD_HEROES } from '../src/data/heroes';
import * as battleEngine from '../src/engine/battle';
import type { BattleConfig, UnitSetup } from '../src/engine/types';
import { heroLevelCap, heroPower } from '../src/game/state';
import { recommendedPowerOf } from '../src/game/stage';
import { buildSpScenarios, FREE_CAMPAIGN_TEAMS, lineupPower, matchPower, parseSpBalanceArgs, renderSpBalance, replaceSp, resolveSpBalanceOptions, runSpBalance, SP_IDS, SP_POWER_TOLERANCE, SP_SUBSETS } from '../tools/sp-balance';
import type { SpBalanceReport } from '../tools/sp-balance';

const project = fileURLToPath(new URL('..', import.meta.url));
const runner = fileURLToPath(new URL('../tools/run-sp-balance.mjs', import.meta.url));
const options = { pairs: 9, campaignSeeds: 1, seed: 20261011 } as const;
const actualPower = (team: readonly UnitSetup[]) => team.reduce((sum, u) => sum + heroPower({ id: u.heroId, lv: u.level, star: u.star ?? 1, shards: 0, skillLv: u.skillLv ?? 1, awaken: u.awaken }, u.gear), 0);

describe('SP audit sampling and real displayed power', () => {
  it('uses all seven SP subsets, legal five-cat lineups, diverse ordinary archetypes and deterministic seeds', () => {
    const scenarios = buildSpScenarios(options);
    expect(scenarios).toEqual(buildSpScenarios(options));
    expect(new Set(scenarios.map((s) => s.seed)).size).toBe(9);
    expect(new Set(scenarios.map((s) => s.cohort)).size).toBe(9);
    expect(SP_IDS).toEqual(PREMIUM_HEROES.map((h) => h.id));
    expect(SP_SUBSETS.map((ids) => ids.length)).toEqual([1, 1, 1, 2, 2, 2, 3]);
    for (const scenario of scenarios) {
      expect(scenario.variants).toHaveLength(7);
      expect(scenario.power).toBe(actualPower(scenario.baseline));
      for (const team of [scenario.baseline, scenario.opponent, ...scenario.variants.map((v) => v.team)]) {
        expect(team).toHaveLength(5);
        expect(new Set(team.map((u) => u.heroId)).size).toBe(5);
        expect(team.map((u) => u.pos).sort()).toEqual([0, 1, 2, 3, 4]);
        expect(Math.abs(actualPower(team) / scenario.power - 1)).toBeLessThanOrEqual(SP_POWER_TOLERANCE);
        for (const u of team) {
          expect(Number.isInteger(u.level)).toBe(true);
          expect(u.level).toBeGreaterThanOrEqual(1); expect(u.level).toBeLessThanOrEqual(heroLevelCap(u.star ?? 1));
          expect(u.statMul).toBeUndefined(); expect(u.gear).toBeUndefined();
          expect(u.star).toBe(5); expect(u.skillLv).toBe(10); expect(['A', 'B']).toContain(u.awaken);
        }
      }
      expect([...scenario.baseline, ...scenario.opponent].every((u) => HERO_BY_ID[u.heroId].rarity !== 'SP')).toBe(true);
    }
  });

  it('controls the SP rarity advantage instead of treating equal levels as equal power', () => {
    const scenario = buildSpScenarios({ ...options, pairs: 1 })[0];
    const variant = scenario.variants.find((v) => v.spIds.length === 3)!;
    expect(actualPower(variant.equalLevelTeam)).toBeGreaterThan(scenario.power * 1.2);
    expect(variant.team.some((u) => u.level !== 60)).toBe(true);
    expect(lineupPower(variant.team)).toBe(actualPower(variant.team));
    expect(Math.abs(actualPower(variant.team) / scenario.power - 1)).toBeLessThanOrEqual(SP_POWER_TOLERANCE);
  });

  it('keeps the original position, level profile metadata and unchosen cats when replacing heroes', () => {
    const scenario = buildSpScenarios({ ...options, pairs: 1 })[0];
    const before = structuredClone(scenario.baseline);
    const variant = replaceSp(scenario.baseline, [SP_IDS[0]], scenario.seed);
    expect(scenario.baseline).toEqual(before);
    const replacement = variant.replacements[0];
    expect(replacement.fromRole).toBe(HERO_BY_ID[replacement.replacedId].role);
    expect(replacement.toRole).toBe(HERO_BY_ID[replacement.spId].role);
    for (const old of before) {
      const equal = variant.equalLevelTeam.find((u) => u.pos === old.pos)!;
      if (old.pos !== replacement.pos) expect(equal).toEqual(old);
      else expect(equal).toMatchObject({ heroId: replacement.spId, pos: old.pos, level: old.level, star: old.star, skillLv: old.skillLv });
    }
    for (const u of variant.team) {
      const equal = variant.equalLevelTeam.find((e) => e.pos === u.pos)!;
      expect({ ...u, level: equal.level }).toEqual(equal);
    }
  });

  it('records the unavoidable front placement for all three back-row SP heroes', () => {
    for (const scenario of buildSpScenarios(options)) {
      const triple = scenario.variants.find((v) => v.spIds.length === 3)!;
      expect(triple.replacements.some((r) => r.pos < 3)).toBe(true);
      expect(triple.replacements.every((r) => ['谋士', '神射', '医者'].includes(r.toRole))).toBe(true);
    }
  });

  it('fails atomically for unattainable power, malformed lineups and unknown or duplicate SP subsets', () => {
    const baseline = buildSpScenarios({ ...options, pairs: 1 })[0].baseline;
    const before = structuredClone(baseline);
    for (const target of [0, NaN, Infinity, 1, 1e8]) expect(() => matchPower(baseline, target)).toThrow();
    expect(() => matchPower(baseline.slice(1), 1000)).toThrow();
    expect(() => matchPower([baseline[0], ...baseline.slice(0, 4)], 1000)).toThrow();
    expect(() => matchPower(baseline.map((u) => ({ ...u, level: NaN })), 1000)).toThrow();
    expect(() => matchPower(baseline.map((u) => ({ ...u, star: 9 })), 1000)).toThrow();
    expect(() => matchPower(baseline, 1000, [1, 2])).toThrow();
    expect(() => lineupPower([{ ...baseline[0], statMul: 1.5 }])).toThrow();
    for (const ids of [[], ['unknown'], [SP_IDS[0], SP_IDS[0]]]) expect(() => replaceSp(baseline, ids, 1)).toThrow();
    expect(baseline).toEqual(before);
  });
});

describe('SP audit real simulations and paired accounting', () => {
  let report: SpBalanceReport;
  const calls: { config: BattleConfig; winner: 'A' | 'B' | 'draw'; units: { side: 'A' | 'B'; heroId: string; hp: number; maxHp: number; energy: number; alive: boolean }[] }[] = [];
  beforeAll(() => {
    const original = battleEngine.simulate;
    const spy = vi.spyOn(battleEngine, 'simulate').mockImplementation((config) => {
      const result = original(config);
      calls.push({ config: structuredClone(config), winner: result.winner, units: result.units.map(({ side, heroId, hp, maxHp, energy, alive }) => ({ side, heroId, hp, maxHp, energy, alive })) });
      return result;
    });
    try { report = runSpBalance(options); } finally { spy.mockRestore(); }
  });

  it('pairs ordinary and every SP variant against the identical opponent and seed, then reverses complete configurations', () => {
    const configurations = calls.slice(0, report.simulations).map((c) => c.config);
    expect(report.simulations).toBe(options.pairs * 60);
    const perMode = options.pairs * 30;
    for (const [mode, noBonds] of [false, true].entries()) {
      const offset = mode * perMode;
      for (let i = 0; i < options.pairs; i++) {
        const scenario = report.scenarios[i];
        expect(configurations[offset + i * 2]).toMatchObject({ A: scenario.baseline, B: scenario.opponent, seed: scenario.seed, noBonds, startEnergy: 0, maxRounds: 30 });
        for (const [matchingIndex, matching] of ['power', 'level'].entries()) for (let subset = 0; subset < 7; subset++) {
          const firstIndex = offset + options.pairs * 2 + matchingIndex * options.pairs * 14 + i * 14 + subset * 2;
          const first = configurations[firstIndex], second = configurations[firstIndex + 1];
          expect(first.A).toEqual(matching === 'power' ? scenario.variants[subset].team : scenario.variants[subset].equalLevelTeam);
          expect(first.B).toEqual(scenario.opponent); expect(first.seed).toBe(scenario.seed); expect(first.noBonds).toBe(noBonds);
          expect(second).toEqual({ ...first, A: first.B, B: first.A });
        }
      }
    }
  });

  it('computes wins and differences from real outcomes without treating correlated variants as independent clusters', () => {
    for (const row of report.rows) {
      expect(row.wins + row.losses + row.draws).toBe(row.games);
      expect(row.winRate).toBeCloseTo((row.wins + row.draws / 2) / row.games);
      expect(row.delta).toBeCloseTo(row.winRate - row.baselineWinRate);
      expect(row.pairs).toBe(options.pairs);
      expect(row.interval).not.toBeNull(); expect(row.interval!.low).toBeLessThanOrEqual(row.winRate); expect(row.interval!.high).toBeGreaterThanOrEqual(row.winRate);
      if (row.matching === 'power') expect(row.maxPowerGap).toBeLessThanOrEqual(SP_POWER_TOLERANCE);
      if (row.spCount === 3) expect(row.frontSpRate).toBe(1);
      if (row.label.endsWith('汇总') && row.spCount < 3) expect(row.games).toBe(options.pairs * 6);
    }
    const baseline = report.rows.find((r) => !r.noBonds && r.spCount === 0)!;
    const ordinary = calls.slice(0, options.pairs * 2);
    const wins = ordinary.filter((c, i) => c.winner === (i % 2 ? 'B' : 'A')).length;
    const draws = ordinary.filter((c) => c.winner === 'draw').length;
    expect(baseline.wins).toBe(wins); expect(baseline.draws).toBe(draws);
    expect(report.cohorts).toHaveLength(9 * 3 * 2);
    expect(report.cohorts.every((r) => r.pairs === 1 && r.deltaInterval === null)).toBe(true);
  });

  it('does not report a zero-width confidence interval for all-win/all-loss samples', () => {
    const boundaryRows = report.rows.filter((r) => r.winRate === 0 || r.winRate === 1);
    expect(boundaryRows.length).toBeGreaterThan(0);
    for (const row of boundaryRows) expect(row.interval!.high - row.interval!.low).toBeGreaterThan(0);
  });

  it('records all 144 real stages for four non-SP teams and uses the UI power scale', () => {
    expect(report.heroCount).toBe(STANDARD_HEROES.length + PREMIUM_HEROES.length);
    expect(report.standardHeroCount).toBe(STANDARD_HEROES.length); expect(report.spHeroCount).toBe(3);
    expect(FREE_CAMPAIGN_TEAMS.every((t) => t.ids.every((id) => HERO_BY_ID[id].rarity !== 'SP'))).toBe(true);
    expect(report.campaign).toHaveLength(24);
    expect(report.campaign.reduce((n, r) => n + r.trials, 0)).toBe(CHAPTERS.flatMap((c) => c.stages).length * 4);
    for (const row of report.campaign) {
      expect(row.trials).toBe(24); expect(row.bossTrials).toBe(1);
      expect(row.wins).toBeLessThanOrEqual(row.trials); expect(row.bossWins).toBeLessThanOrEqual(row.bossTrials);
      expect(row.recommendedPower).toBe(recommendedPowerOf(row.chapter, 24));
      expect(row.endLevel).toBeLessThanOrEqual(heroLevelCap(row.endStar));
      if (row.team === FREE_CAMPAIGN_TEAMS[0].name) expect(row.power).toBe(row.recommendedPower);
    }
  });

  it('feeds real stage rules and carries the preceding winning wave HP and energy without reviving absent cats', () => {
    const campaignCalls = calls.slice(report.simulations, report.simulations + report.campaignSimulations);
    expect(campaignCalls.some((c) => c.config.rules?.length)).toBe(true);
    let inherited = 0;
    for (let i = 1; i < campaignCalls.length; i++) {
      const current = campaignCalls[i].config;
      if (!current.A.every((u) => u.hpPct !== undefined)) continue;
      inherited++;
      const previous = campaignCalls[i - 1];
      expect(previous.winner).toBe('A');
      for (const setup of current.A) {
        const unit = previous.units.find((u) => u.side === 'A' && u.heroId === setup.heroId);
        expect(setup.hpPct).toBe(unit?.alive ? unit.hp / unit.maxHp : 0);
        expect(setup.energy).toBe(unit?.energy ?? 0);
      }
    }
    expect(inherited).toBeGreaterThan(100);
    expect(campaignCalls.every((c) => c.config.A.every((u) => u.skillLv === 1 && u.awaken === undefined && u.gear === undefined))).toBe(true);
  });

  it('returns the actual short revival evidence without asserting the disputed SP description as a contract', () => {
    expect(report.changRevive.seed).toBe(31);
    expect(report.changRevive.deaths).toBeGreaterThanOrEqual(2);
    expect(report.changRevive.revivals.length).toBeGreaterThanOrEqual(1);
    for (const revival of report.changRevive.revivals) {
      expect(revival.hp).toBeGreaterThan(0); expect(revival.hp).toBeLessThanOrEqual(revival.maxHp);
      expect(revival.fraction).toBe(revival.hp / revival.maxHp);
    }
  });

  it('renders the reproduction command, matching limits, sample clusters, replacement confounds and failures', () => {
    const text = renderSpBalance(report);
    for (const fragment of ['--pairs 9', '--campaign-seeds 1', 'heroPower', '0.5%', '95%', 'Hoeffding', '职业', '阵营', '前排', 'ECONOMY_PAID.md', 'recommendedPowerOf', '技能 1', '1-24', '24/24']) expect(text).toContain(fragment);
    expect(text).toContain(`常规 ${STANDARD_HEROES.length}`);
    expect(text).toContain('相对提升');
    expect(text).toContain('后续名册');
  });
});

describe('SP audit CLI and validation', () => {
  it('parses every supported control and rejects missing, malformed and unknown options', () => {
    const parsed = parseSpBalanceArgs(['--pairs', '18', '--seed', '0', '--level', '40', '--star', '1', '--skill-lv', '3', '--campaign-seeds', '2', '--no-equal-level', '--out', 'report with spaces.md']);
    expect(parsed).toEqual({ options: { pairs: 18, seed: 0, level: 40, star: 1, skillLv: 3, campaignSeeds: 2, equalLevel: false }, output: 'report with spaces.md', help: false });
    expect(parseSpBalanceArgs(['--help']).help).toBe(true);
    for (const args of [['--pairs'], ['--pairs', '--out'], ['--pairs', '0'], ['--pairs', '1.5'], ['--seed', '-1'], ['--unknown'], ['--out', ' '], ['--star', '0'], ['--star', '1', '--level', '60']]) expect(() => parseSpBalanceArgs(args)).toThrow();
  });

  it('validates runtime options and enforces the actual star-dependent level cap', () => {
    expect(resolveSpBalanceOptions()).toMatchObject({ pairs: 360, campaignSeeds: 8, level: 60, star: 5, skillLv: 10, equalLevel: true });
    for (const invalid of [{ pairs: NaN }, { pairs: Infinity }, { pairs: 0 }, { campaignSeeds: 0 }, { seed: 0x100000000 }, { skillLv: 11 }, { star: 6 }, { level: 41, star: 1 }, { equalLevel: 'yes' as unknown as boolean }]) expect(() => resolveSpBalanceOptions(invalid)).toThrow();
  });

  it('prints help without running simulations and exits unsuccessfully for invalid real CLI input', () => {
    const help = execFileSync(process.execPath, [runner, '--help'], { cwd: project, encoding: 'utf8' });
    expect(help).toContain('--pairs'); expect(help).not.toContain('已写');
    const invalid = spawnSync(process.execPath, [runner, '--pairs', '0'], { cwd: project, encoding: 'utf8' });
    expect(invalid.status).toBe(1); expect(invalid.stdout).not.toContain('已写');
  });

  it('runs a small actual CLI audit, passes arguments into simulations and writes the requested file and Git revision', () => {
    const temp = mkdtempSync(join(tmpdir(), 'maoguozhi-sp-'));
    try {
      const output = join(temp, 'small report.md');
      const stdout = execFileSync(process.execPath, [runner, '--pairs', '1', '--campaign-seeds', '1', '--seed', '123', '--no-equal-level', '--out', output], { cwd: project, encoding: 'utf8' });
      expect(stdout).toContain('PvP 32 局');
      const report = readFileSync(output, 'utf8');
      expect(report).toContain('--seed 123'); expect(report).toContain('--pairs 1'); expect(report).toContain('--no-equal-level');
      expect(report).toContain(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: project, encoding: 'utf8' }).trim());
      expect(report).not.toContain('## 同等级对照');
    } finally { rmSync(temp, { recursive: true, force: true }); }
  });
});
