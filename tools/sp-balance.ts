import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { CHAPTERS } from '../src/content/campaign';
import { HERO_BY_ID, PREMIUM_HEROES, STANDARD_HEROES } from '../src/data/heroes';
import type { Role } from '../src/data/heroes';
import { FACTION_ORDER } from '../src/data/factions';
import { RARITY_MULT, ROLES } from '../src/data/systems';
import { simulate } from '../src/engine/battle';
import type { UnitSetup } from '../src/engine/types';
import { Rng } from '../src/engine/rng';
import { buildLineup } from '../src/game/balance';
import { heroLevelCap, heroPower, newPlayer } from '../src/game/state';
import { paceLevel, recommendedPowerOf, stageOrdinal, waveSetups } from '../src/game/stage';

export interface SpBalanceOptions {
  pairs?: number;
  seed?: number;
  level?: number;
  star?: number;
  skillLv?: number;
  campaignSeeds?: number;
  equalLevel?: boolean;
}
export interface ResolvedSpBalanceOptions {
  pairs: number; seed: number; level: number; star: number; skillLv: number;
  campaignSeeds: number; equalLevel: boolean;
}
export const SP_POWER_TOLERANCE = 0.005;
export const SP_IDS = PREMIUM_HEROES.map((h) => h.id);
export const SP_SUBSETS: readonly string[][] = [
  ...SP_IDS.map((id) => [id]),
  ...SP_IDS.flatMap((id, i) => SP_IDS.slice(i + 1).map((other) => [id, other])),
  [...SP_IDS],
];
const COHORTS = ['混搭续航', '混搭快攻', '混搭双医', ...FACTION_ORDER.map((f) => `${f}同族`)];
const FRONT = STANDARD_HEROES.filter((h) => ROLES[h.role].row === '前排').map((h) => h.id);
const HEALERS = STANDARD_HEROES.filter((h) => h.role === '医者').map((h) => h.id);
const OFFENSE = STANDARD_HEROES.filter((h) => ROLES[h.role].row === '后排' && h.role !== '医者').map((h) => h.id);
const STANDARD_IDS = STANDARD_HEROES.map((h) => h.id);
const MAX_ROUNDS = 30;

export function resolveSpBalanceOptions(input: SpBalanceOptions = {}): ResolvedSpBalanceOptions {
  const options = { pairs: 360, seed: 20261011, level: 60, star: 5, skillLv: 10, campaignSeeds: 8, equalLevel: true, ...input };
  for (const key of ['pairs', 'campaignSeeds'] as const) {
    if (!Number.isSafeInteger(options[key]) || options[key] < 1) throw new Error(`${key} 须为正安全整数。`);
  }
  if (!Number.isInteger(options.seed) || options.seed < 0 || options.seed > 0xffffffff) throw new Error('seed 须为 uint32。');
  if (!Number.isInteger(options.star) || options.star < 1 || options.star > 5) throw new Error('star 须为 1 至 5。');
  if (!Number.isInteger(options.level) || options.level < 1 || options.level > heroLevelCap(options.star)) throw new Error('level 超出当前星级的合法等级范围。');
  if (!Number.isInteger(options.skillLv) || options.skillLv < 1 || options.skillLv > 10) throw new Error('skillLv 须为 1 至 10。');
  if (typeof options.equalLevel !== 'boolean') throw new Error('equalLevel 须为布尔值。');
  return options;
}

function seedFor(seed: number, key: string): number {
  let hash = seed >>> 0;
  for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619) >>> 0;
  return hash;
}
function powerOf(unit: UnitSetup): number {
  if (!HERO_BY_ID[unit.heroId] || unit.statMul !== undefined) throw new Error('审计战力只接受真实英雄、不带模拟属性倍率的配置。');
  return heroPower({ id: unit.heroId, lv: unit.level, star: unit.star ?? 1, skillLv: unit.skillLv ?? 1, shards: 0, awaken: unit.awaken }, unit.gear);
}
export const lineupPower = (team: readonly UnitSetup[]): number => team.reduce((sum, u) => sum + powerOf(u), 0);

/** 只调合法整数等级；星级、技能、觉醒、站位与装备不变。各猫最初按各自目标战力取最近等级。 */
export function matchPower(team: readonly UnitSetup[], targetPower: number, slotTargets?: readonly number[]): UnitSetup[] {
  if (team.length !== 5 || new Set(team.map((u) => u.heroId)).size !== 5 || new Set(team.map((u) => u.pos)).size !== 5
    || team.some((u) => !Number.isInteger(u.pos) || u.pos < 0 || u.pos > 4)) throw new Error('匹配需要五只不同猫和五个合法站位。');
  if (team.some((u) => !Number.isInteger(u.star ?? 1) || (u.star ?? 1) < 1 || (u.star ?? 1) > 5
    || !Number.isInteger(u.level) || u.level < 1 || u.level > heroLevelCap(u.star ?? 1))) throw new Error('匹配配置的等级/星级非法。');
  if (!Number.isFinite(targetPower) || targetPower <= 0 || slotTargets && (slotTargets.length !== 5 || slotTargets.some((p) => !Number.isFinite(p) || p <= 0))) throw new Error('目标战力非法。');
  const weights = slotTargets ?? team.map((u) => targetPower * powerOf(u) / lineupPower(team));
  const out = team.map((unit, index) => {
    const candidate = { ...unit };
    let bestError = Infinity;
    for (let level = 1; level <= heroLevelCap(unit.star ?? 1); level++) {
      const error = Math.abs(powerOf({ ...unit, level }) - weights[index]);
      if (error < bestError) { bestError = error; candidate.level = level; }
    }
    return candidate;
  });
  // 消除整队整数取整残差；只有严格缩小误差才移动一只猫一级，不看战斗结果。
  for (let step = 0; step < 600; step++) {
    const current = lineupPower(out);
    let bestError = Math.abs(current - targetPower);
    let chosen = -1;
    let chosenLevel = 0;
    for (let i = 0; i < out.length; i++) {
      for (const level of [out[i].level - 1, out[i].level + 1]) {
        if (level < 1 || level > heroLevelCap(out[i].star ?? 1)) continue;
        const error = Math.abs(current - powerOf(out[i]) + powerOf({ ...out[i], level }) - targetPower);
        if (error < bestError) { bestError = error; chosen = i; chosenLevel = level; }
      }
    }
    if (chosen < 0) break;
    out[chosen].level = chosenLevel;
  }
  if (Math.abs(lineupPower(out) / targetPower - 1) > SP_POWER_TOLERANCE) throw new Error(`合法整数等级无法在 ${SP_POWER_TOLERANCE * 100}% 内匹配战力 ${targetPower}。`);
  return out;
}

export interface Replacement {
  spId: string; replacedId: string; pos: number; fromRole: Role; toRole: Role;
  fromFaction: string; toFaction: string;
}
export interface SpVariant { spIds: string[]; team: UnitSetup[]; equalLevelTeam: UnitSetup[]; replacements: Replacement[] }
export interface SpScenario {
  index: number; seed: number; cohort: string; baseline: UnitSetup[]; opponent: UnitSetup[]; power: number; variants: SpVariant[];
}
function awakening(heroId: string, star: number, seed: number): 'A' | 'B' | undefined {
  return star < 5 ? undefined : new Rng(seedFor(seed, `awaken:${heroId}`)).chance(0.5) ? 'A' : 'B';
}

/** 替换位置由职业、排位、阵营匹配静态决定，绝不根据胜负挑位置。 */
export function replaceSp(baseline: readonly UnitSetup[], spIds: readonly string[], seed: number): SpVariant {
  if (!spIds.length || spIds.length > 3 || new Set(spIds).size !== spIds.length || spIds.some((id) => !SP_IDS.includes(id))) throw new Error('SP 子集非法。');
  if (baseline.length !== 5 || baseline.some((u) => !HERO_BY_ID[u.heroId] || HERO_BY_ID[u.heroId].rarity === 'SP')) throw new Error('普通基线不得包含 SP。');
  let best: number[] = [];
  let bestCost = Infinity;
  const enumerate = (slots: number[]) => {
    if (slots.length === spIds.length) {
      const cost = slots.reduce((sum, slot, i) => {
        const from = HERO_BY_ID[baseline[slot].heroId], to = HERO_BY_ID[spIds[i]];
        return sum + (from.role === to.role ? 0 : 100) + (baseline[slot].pos < 3 ? 10 : 0) + (from.faction === to.faction ? 0 : 1);
      }, 0);
      if (cost < bestCost) { bestCost = cost; best = slots.slice(); }
      return;
    }
    for (let i = 0; i < baseline.length; i++) if (!slots.includes(i)) enumerate([...slots, i]);
  };
  enumerate([]);
  const equalLevelTeam = baseline.map((u) => ({ ...u }));
  const replacements = best.map((slot, i): Replacement => {
    const old = equalLevelTeam[slot], from = HERO_BY_ID[old.heroId], to = HERO_BY_ID[spIds[i]];
    equalLevelTeam[slot] = { ...old, heroId: to.id, awaken: awakening(to.id, old.star ?? 1, seed) };
    return { spId: to.id, replacedId: from.id, pos: old.pos, fromRole: from.role, toRole: to.role, fromFaction: from.faction, toFaction: to.faction };
  });
  return { spIds: spIds.slice(), replacements, equalLevelTeam, team: matchPower(equalLevelTeam, lineupPower(baseline), baseline.map(powerOf)) };
}

function regularIds(cohort: number, rng: Rng): string[] {
  if (cohort >= 3) {
    const faction = FACTION_ORDER[cohort - 3];
    const candidates = STANDARD_HEROES.filter((h) => h.faction === faction).map((h) => h.id);
    if (candidates.length < 4) throw new Error('同族审计需要每族至少四只常规英雄。');
    // 当前四猫名册保留原顺序/随机流；名册扩充时仍只选四只，不让队伍超过五人。
    const main = candidates.length === 4 ? candidates : rng.shuffle(candidates).slice(0, 4);
    // 四猫同族/命名组合 + 一只其他阵营；所有成员都可由常规招募获得。
    return [...main, rng.pick(STANDARD_IDS.filter((id) => !main.includes(id)))];
  }
  const front = rng.shuffle(FRONT).slice(0, 3);
  const back = cohort === 0 ? [rng.pick(HEALERS), rng.pick(OFFENSE)]
    : cohort === 1 ? rng.shuffle(OFFENSE).slice(0, 2) : rng.shuffle(HEALERS).slice(0, 2);
  return [...front, ...back];
}

export function buildSpScenarios(input: SpBalanceOptions = {}): SpScenario[] {
  const options = resolveSpBalanceOptions(input);
  return Array.from({ length: options.pairs }, (_, index) => {
    const seed = seedFor(options.seed, `pair:${index}`), rng = new Rng(seed);
    const cohort = index % COHORTS.length;
    const asLineup = (ids: string[], label: string) => buildLineup(ids, { level: options.level, star: options.star, randomAwakening: true }, seedFor(seed, label)).map((u) => ({ ...u, skillLv: options.skillLv }));
    const baseline = asLineup(regularIds(cohort, rng), 'baseline');
    const power = lineupPower(baseline);
    // 敌队在相同九类中均匀随机，保持职业/阵营多样；双方本来就不是同等级的假定同战力。
    const opponent = matchPower(asLineup(regularIds(Math.floor(rng.next() * COHORTS.length), rng), 'opponent'), power);
    return { index, seed, cohort: COHORTS[cohort], baseline, opponent, power, variants: SP_SUBSETS.map((ids) => replaceSp(baseline, ids, seed)) };
  });
}

export interface Interval { low: number; high: number }
export interface SpResultRow {
  label: string; spCount: number; noBonds: boolean; matching: 'power' | 'level'; pairs: number; games: number;
  wins: number; losses: number; draws: number; winRate: number; baselineWinRate: number; delta: number;
  interval: Interval | null; deltaInterval: Interval | null;
  maxPowerGap: number; avgPowerRatio: number; frontSpRate: number; roleChanges: number; factionChanges: number;
}
interface PairObservation { score: number; wins: number; losses: number; draws: number; rounds: number; timeouts: number }
function pairedOutcome(team: UnitSetup[], opponent: UnitSetup[], seed: number, noBonds: boolean): PairObservation {
  const first = simulate({ A: team, B: opponent, seed, noBonds, startEnergy: 0, maxRounds: MAX_ROUNDS });
  const second = simulate({ A: opponent, B: team, seed, noBonds, startEnergy: 0, maxRounds: MAX_ROUNDS });
  const outcomes = [first.winner === 'draw' ? 0.5 : first.winner === 'A' ? 1 : 0, second.winner === 'draw' ? 0.5 : second.winner === 'B' ? 1 : 0];
  const timeouts = [first, second].filter((r) => r.rounds === MAX_ROUNDS && r.units.some((u) => u.side === 'A' && u.alive) && r.units.some((u) => u.side === 'B' && u.alive)).length;
  return { score: (outcomes[0] + outcomes[1]) / 2, wins: outcomes.filter((n) => n === 1).length, losses: outcomes.filter((n) => n === 0).length, draws: outcomes.filter((n) => n === 0.5).length, rounds: first.rounds + second.rounds, timeouts };
}
function mean(values: readonly number[]): number { return values.reduce((sum, v) => sum + v, 0) / values.length; }
function interval(values: readonly number[], min: number, max: number): Interval | null {
  if (values.length < 2) return null;
  const average = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
  // 小样本与全胜/全败不能用零标准误伪装确定；有界独立簇使用 Hoeffding 区间兜底。
  const half = values.length < 30 || variance === 0
    ? (max - min) * Math.sqrt(Math.log(40) / (2 * values.length))
    : 1.96 * Math.sqrt(variance / values.length);
  return { low: Math.max(min, average - half), high: Math.min(max, average + half) };
}
interface Observation { scenario: SpScenario; variant?: SpVariant; base: PairObservation; result: PairObservation; team: UnitSetup[] }
function resultRow(label: string, spCount: number, noBonds: boolean, matching: 'power' | 'level', observations: Observation[]): SpResultRow {
  const clusters = new Map<number, Observation[]>();
  for (const observation of observations) {
    const group = clusters.get(observation.scenario.index) ?? [];
    group.push(observation); clusters.set(observation.scenario.index, group);
  }
  const scores = [...clusters.values()].map((cluster) => mean(cluster.map((o) => o.result.score)));
  const deltas = [...clusters.values()].map((cluster) => mean(cluster.map((o) => o.result.score - o.base.score)));
  const replacements = observations.flatMap((o) => o.variant?.replacements ?? []);
  const ratios = observations.map((o) => lineupPower(o.team) / o.scenario.power);
  return {
    label, spCount, noBonds, matching, pairs: clusters.size, games: observations.length * 2,
    wins: observations.reduce((n, o) => n + o.result.wins, 0), losses: observations.reduce((n, o) => n + o.result.losses, 0), draws: observations.reduce((n, o) => n + o.result.draws, 0),
    winRate: mean(scores), baselineWinRate: mean(observations.map((o) => o.base.score)), delta: mean(deltas),
    interval: interval(scores, 0, 1), deltaInterval: spCount === 0 ? { low: 0, high: 0 } : interval(deltas, -1, 1),
    maxPowerGap: Math.max(...ratios.map((r) => Math.abs(r - 1))), avgPowerRatio: mean(ratios),
    frontSpRate: observations.filter((o) => o.variant?.replacements.some((r) => r.pos < 3)).length / observations.length,
    roleChanges: replacements.filter((r) => r.fromRole !== r.toRole).length, factionChanges: replacements.filter((r) => r.fromFaction !== r.toFaction).length,
  };
}

export interface CampaignRow {
  team: string; chapter: number; trials: number; wins: number; failedStages: string[];
  endLevel: number; endStar: number; power: number; recommendedPower: number;
  bossTrials: number; bossWins: number;
}
export const FREE_CAMPAIGN_TEAMS: readonly { name: string; ids: string[] }[] = [
  { name: '初始五猫（保证拥有）', ids: newPlayer(0).lineup.filter((id): id is string => id !== null) },
  { name: '魏守护治疗（常规招募）', ids: ['wei_xiahoudun', 'wei_xuhuchi', 'man_wutugu', 'wei_caomiaode', 'wei_guojia'] },
  { name: '蜀结义（常规招募）', ids: ['shu_guanyunmiao', 'shu_zhangmiaofei', 'man_wutugu', 'shu_zhugemiaoliang', 'shu_liumiaobei'] },
  { name: '吴火攻（常规招募）', ids: ['wu_sunxiaoba', 'wu_huanggai', 'wei_xiahoudun', 'wu_zhoumiaoyu', 'qun_huatuo'] },
];
const referenceStar = (level: number) => level < 20 ? 1 : level < 40 ? 2 : level < 65 ? 3 : level < 90 ? 4 : 5;
export function runFreeCampaignProbe(seed: number, seedsPerStage: number): { rows: CampaignRow[]; simulations: number } {
  if (!Number.isSafeInteger(seedsPerStage) || seedsPerStage < 1) throw new Error('主线种子数量非法。');
  let simulations = 0;
  const rows = FREE_CAMPAIGN_TEAMS.flatMap((team) => CHAPTERS.map((chapter): CampaignRow => {
    const endLevel = paceLevel(stageOrdinal(chapter.id, 24)), endStar = referenceStar(endLevel);
    const teamAt = (level: number): UnitSetup[] => team.ids.map((heroId, pos) => ({ heroId, pos, level, star: referenceStar(level), skillLv: 1 }));
    const row: CampaignRow = { team: team.name, chapter: chapter.id, trials: 0, wins: 0, failedStages: [], endLevel, endStar, power: lineupPower(teamAt(endLevel)), recommendedPower: recommendedPowerOf(chapter.id, 24), bossTrials: 0, bossWins: 0 };
    for (const stage of chapter.stages) {
      let stageWins = 0;
      for (let sample = 0; sample < seedsPerStage; sample++) {
        let A = teamAt(paceLevel(stageOrdinal(chapter.id, Number(stage.id.split('-')[1]))));
        let win = true;
        // 与 BattleLoop 相同：生命比例/元气跨波继承，状态/护盾/被动限额随新 simulate 重建；睡着成员 hpPct=0。
        for (let wave = 0; wave < stage.waves.length; wave++) {
          const result = simulate({ seed: seedFor(seed, `campaign:${stage.id}:${sample}:${wave}`), A, B: waveSetups(stage, wave), rules: stage.ruleFx, startEnergy: 0, maxRounds: MAX_ROUNDS });
          simulations++;
          if (result.winner !== 'A') { win = false; break; }
          const survivors = new Map(result.units.filter((u) => u.side === 'A').map((u) => [u.heroId, u]));
          A = A.map((setup) => {
            const unit = survivors.get(setup.heroId);
            return { ...setup, hpPct: unit?.alive ? unit.hp / unit.maxHp : 0, energy: unit?.energy ?? 0 };
          });
        }
        row.trials++;
        if (stage.kind === 'boss') row.bossTrials++;
        if (win) { row.wins++; stageWins++; if (stage.kind === 'boss') row.bossWins++; }
      }
      if (stageWins < seedsPerStage) row.failedStages.push(stage.id);
    }
    return row;
  }));
  return { rows, simulations };
}

export function probeChangRevive(): { seed: number; deaths: number; revivals: { hp: number; maxHp: number; fraction: number }[] } {
  const seed = 31;
  const result = simulate({ seed, maxRounds: 5,
    A: [{ heroId: 'wei_guojia', pos: 0, level: 1, star: 1, skillLv: 1 }, { heroId: 'xian_changmiao', pos: 3, level: 120, star: 5, skillLv: 10, awaken: 'B' }],
    B: [{ heroId: 'qun_lvbuding', pos: 0, level: 120, star: 5, skillLv: 10, awaken: 'A' }],
  });
  const target = result.units.find((u) => u.heroId === 'wei_guojia')!;
  return {
    seed, deaths: result.events.filter((e) => e.t === 'death' && e.uid === target.uid).length,
    revivals: result.events.flatMap((e) => e.t === 'revive' && e.uid === target.uid ? [{ hp: e.hp, maxHp: target.maxHp, fraction: e.hp / target.maxHp }] : []),
  };
}

export interface SpBalanceReport {
  commit: string | null;
  heroCount: number; standardHeroCount: number; spHeroCount: number;
  options: ResolvedSpBalanceOptions; rows: SpResultRow[]; cohorts: SpResultRow[];
  scenarios: SpScenario[]; campaign: CampaignRow[]; campaignSimulations: number;
  replacementCounts: { label: string; count: number }[];
  simulations: number; timeouts: number; avgRounds: number;
  changRevive: ReturnType<typeof probeChangRevive>;
}
export function runSpBalance(input: SpBalanceOptions = {}): SpBalanceReport {
  const options = resolveSpBalanceOptions(input), scenarios = buildSpScenarios(options);
  const rows: SpResultRow[] = [], cohorts: SpResultRow[] = [];
  let simulations = 0, timeouts = 0, rounds = 0;
  const noteResult = (result: PairObservation) => { simulations += 2; timeouts += result.timeouts; rounds += result.rounds; };
  for (const noBonds of [false, true]) {
    const baseline = scenarios.map((scenario): Observation => {
      const result = pairedOutcome(scenario.baseline, scenario.opponent, scenario.seed, noBonds); noteResult(result);
      return { scenario, base: result, result, team: scenario.baseline };
    });
    rows.push(resultRow('无 SP', 0, noBonds, 'power', baseline));
    for (const matching of options.equalLevel ? ['power', 'level'] as const : ['power'] as const) {
      const observations = scenarios.flatMap((scenario, index) => scenario.variants.map((variant): Observation => {
        const team = matching === 'power' ? variant.team : variant.equalLevelTeam;
        const result = pairedOutcome(team, scenario.opponent, scenario.seed, noBonds); noteResult(result);
        return { scenario, variant, result, base: baseline[index].result, team };
      }));
      for (const subset of SP_SUBSETS) {
        const label = subset.map((id) => HERO_BY_ID[id].name).join(' + ');
        rows.push(resultRow(label, subset.length, noBonds, matching, observations.filter((o) => o.variant!.spIds.join(',') === subset.join(','))));
      }
      for (const count of [1, 2, 3]) {
        const filtered = observations.filter((o) => o.variant!.spIds.length === count);
        rows.push(resultRow(`${count} SP 汇总`, count, noBonds, matching, filtered));
        if (matching === 'power') for (const cohort of COHORTS) {
          const inCohort = filtered.filter((o) => o.scenario.cohort === cohort);
          if (inCohort.length) cohorts.push(resultRow(`${cohort} / ${count} SP`, count, noBonds, matching, inCohort));
        }
      }
    }
  }
  const counts = new Map<string, number>();
  for (const scenario of scenarios) for (const variant of scenario.variants) for (const r of variant.replacements) {
    const label = `${HERO_BY_ID[r.spId].name} ← ${HERO_BY_ID[r.replacedId].name}（${r.fromRole}/${r.fromFaction} → ${r.toRole}/${r.toFaction}；${r.pos < 3 ? '前' : '后'}排）`;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const campaign = runFreeCampaignProbe(options.seed, options.campaignSeeds);
  return { commit: null, heroCount: STANDARD_HEROES.length + PREMIUM_HEROES.length, standardHeroCount: STANDARD_HEROES.length, spHeroCount: PREMIUM_HEROES.length,
    options, rows, cohorts, scenarios, campaign: campaign.rows, campaignSimulations: campaign.simulations,
    replacementCounts: [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([label, count]) => ({ label, count })),
    simulations, timeouts, avgRounds: rounds / simulations, changRevive: probeChangRevive() };
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const points = (n: number) => `${n >= 0 ? '+' : ''}${(n * 100).toFixed(1)} pp`;
const relative = (row: SpResultRow) => row.baselineWinRate === 0 ? '基线0，无定义' : `${pct(row.delta / row.baselineWinRate)} 相对提升`;
const ci = (n: Interval | null, isDelta = false) => n ? `${isDelta ? points(n.low) : pct(n.low)} ～ ${isDelta ? points(n.high) : pct(n.high)}` : '样本不足';
const setupLabel = (team: readonly UnitSetup[]) => team.map((u) => `${u.pos}:${HERO_BY_ID[u.heroId].name} L${u.level}/${u.awaken ?? '无觉醒'}`).join('；');
export function renderSpBalance(report: SpBalanceReport): string {
  const o = report.options;
  const primary = report.rows.filter((r) => !r.noBonds && r.matching === 'power' && r.label.endsWith('汇总'));
  const lines = [
    '# SP 强度与免费主线实战审计', '',
    `运行时 HEAD：${report.commit ?? 'API调用未提供Git版本'}；名册 ${report.heroCount} 只（常规 ${report.standardHeroCount}、付费 SP ${report.spHeroCount}）。未合并的第二批14只不在样本中，结论不外推到后续名册；合入后用同一命令复算。`, '',
    `基线：Issue #51，当前 RARITY_MULT.SP=${RARITY_MULT.SP}、UR=${RARITY_MULT.UR}。工具直接读取现有 KITS、simulate 与 heroPower，不改任何游戏数值。`, '',
    `启用命名羁绊、同战力汇总：${primary.map((r) => `${r.spCount} SP 胜率 ${pct(r.winRate)}，配对提升 ${points(r.delta)}（95% ${ci(r.deltaInterval, true)}；${relative(r)}）`).join('；')}。逐猫与分层结果见下表。`, '',
    '## 复算', '', '```sh',
    `node tools/run-sp-balance.mjs --pairs ${o.pairs} --seed ${o.seed} --level ${o.level} --star ${o.star} --skill-lv ${o.skillLv} --campaign-seeds ${o.campaignSeeds}${o.equalLevel ? '' : ' --no-equal-level'} --out docs/SP_BALANCE_PAID.md`, '```', '',
    `PvP ${report.simulations} 局，${o.pairs} 个种子/阵容对，每对复用敌队、种子与镜像交换；主线另 ${report.campaignSimulations} 波战斗。PvP 平均 ${report.avgRounds.toFixed(2)} 回合，30 回合双方仍清醒 ${report.timeouts} 局。超时沿真实引擎剩余生命比例判胜，平局记半胜。`, '',
    '## 控制口径', '',
    `普通基线 ${o.level} 级、${o.star} 星、技能 ${o.skillLv}；五星觉醒 A/B 由英雄与种子固定抽取。无装备、满生命、0 元气。SP 子集全部列举为 3 单猫、3 双猫、1 三猫，不根据战斗胜负选猫或位置。`, '',
    `同战力使用真实 heroPower 求和，按替换前各猫的战力寻找最近合法整数等级，再仅以整队误差缩小调整一级；双方与每个 SP 版本均距同一普通基线 ≤${pct(SP_POWER_TOLERANCE)}。未匹配成功直接报错，不筛掉输局。星级/技能/觉醒/站位不因匹配改变；SP 通常降等级而非白送属性倍率。`, '',
    'heroPower 只含生命、攻击、防御、速度，不含技能、控制、复活、持续治疗、命名羁绊和同族收益，因此这里的“同战力”是界面战力相近，并非实际战斗能力相等。替换会改变职业、阵营、克制、同族与命名组合；这正是可观察的阵容效果，不能全部归因于 SP 稀有度。', '',
    '九类预先固定阵容：混搭续航、三前排加双输出的快攻、双医，以及六族各自四只常规猫加一只外族。敌队从相同九类均匀抽取。部分纯后排阵营原本就有后排职业站前排；替换优先同职业，然后后排位置、同阵营，不重排其余成员。三只 SP 都是后排职业，至少一只占据前排，职业保护/输出变化不能当作纯叠加增益。', '',
    '分别启用与关闭命名羁绊；两者均保留阵营同族机制。以一个种子/阵容对为簇，先平均两次镜像，再计算跨簇标准误。1/2/3 SP 汇总先在同簇内平均同数量的全部子集；不会把镜像或同簇不同 SP 当作独立样本。95% 区间通常为正态近似；少于30簇或零方差（例如全胜）时用有界独立簇的 Hoeffding 区间，避免零误差。区间只描述该固定抽样设计。提升单位 pp 为绝对胜率百分点，摘要另列相对普通队胜率的增幅，两者不能混用。', '',
    '## 同战力结果', '',
    '| 命名羁绊 | SP 组合 | 簇/局 | 胜/平/负 | 普通队胜率 | SP 胜率（95%） | 配对提升（95%） | 最大战力误差 | 含前排 SP 的样本 |',
    '|---|---|---:|---:|---:|---|---|---:|---:|',
  ];
  for (const row of report.rows.filter((r) => r.matching === 'power')) lines.push(`| ${row.noBonds ? '关闭' : '启用'} | ${row.label} | ${row.pairs}/${row.games} | ${row.wins}/${row.draws}/${row.losses} | ${pct(row.baselineWinRate)} | ${pct(row.winRate)}（${ci(row.interval)}） | ${points(row.delta)}（${ci(row.deltaInterval, true)}） | ${pct(row.maxPowerGap)} | ${pct(row.frontSpRate)} |`);
  if (o.equalLevel) {
    lines.push('', '## 同等级对照（战力未控制，不能用于同战力目标验收）', '',
      '| 命名羁绊 | SP 组合 | 局 | SP 胜率 | 对普通队提升 | 平均战力比 |', '|---|---|---:|---:|---:|---:|');
    for (const row of report.rows.filter((r) => r.matching === 'level')) lines.push(`| ${row.noBonds ? '关闭' : '启用'} | ${row.label} | ${row.games} | ${pct(row.winRate)} | ${points(row.delta)} | ${row.avgPowerRatio.toFixed(3)} |`);
  }
  lines.push('', '## 阵容分层（同战力，不能只看总体均值）', '',
    '| 命名羁绊 | 基线 / SP 数 | 簇/局 | 普通队胜率 | SP 胜率 | 提升（95%） | 职业/阵营改变次数 |', '|---|---|---:|---:|---:|---|---:|');
  for (const row of report.cohorts) lines.push(`| ${row.noBonds ? '关闭' : '启用'} | ${row.label} | ${row.pairs}/${row.games} | ${pct(row.baselineWinRate)} | ${pct(row.winRate)} | ${points(row.delta)}（${ci(row.deltaInterval, true)}） | ${row.roleChanges}/${row.factionChanges} |`);
  lines.push('', '## 免费主线验证', '',
    '遍历全 144 关，每关使用界面 paceLevel 与参考星级（<20 级一星、<40 二星、<65 三星、<90 四星，其余五星）。每关独立满生命起步、技能 1、无觉醒、无装备、无 SP、无 VIP。波间按 BattleLoop 继承生命比例与元气；真实 waveSetups、ruleFx 与敌方精英倍率全部保留，跨波不会给睡着猫重新满血。', '',
    '这是“给定养成状态能否过关”的实战探针，不是连续从零积累资源的账号模拟。只有初始五猫保证拥有，其余三队需要常规招募；星级碎片、升级资源与达到这些等级所需天数须与 [经济审计](./ECONOMY_PAID.md) 联看，不能仅凭这里声称第 30 天必定全五星或保证抽齐阵容。推荐战力采用界面 recommendedPowerOf，不把内容原始 300～30000 曲线混作界面战力。', '',
    '| 无 SP 队伍 | 章 | 章末等级/星 | 章末战力 / 界面推荐 | 全章独立关卡成功 / 尝试 | 章末首领成功 / 尝试 | 出现失败的关卡 |', '|---|---:|---:|---:|---:|---:|---|');
  for (const row of report.campaign) lines.push(`| ${row.team} | ${row.chapter} | ${row.endLevel}/${row.endStar} | ${row.power}/${row.recommendedPower} | ${row.wins}/${row.trials} | ${row.bossWins}/${row.bossTrials} | ${row.failedStages.join('、') || '无'} |`);
  lines.push('', '## 嫦喵觉醒实战边界', '',
    '该报告测量现有 DSL，不以文案补出效果。满月 A 的 scaleMul=1.2 同时缩放绝技伤害/治疗/护盾 scale；配合 Lv9，护盾从 125% 攻击变为 150% 攻击，差为 25% 攻击；追加 fluff 为攻击增益，不是暴击率。Lv6先加一层25%炸毛，A再加一层20%；状态刷新保留较大power并叠层，所以原无炸毛的目标当次获得两层×25%=50%攻击增益，已有层数则按三层上限。', '',
    `玉兔归巢 B 的短探针：seed=${report.changRevive.seed}，郭嘉喵 L1/一星/技能1 前排，嫦喵 L120/五星/B/技能10 后排，对吕布丁 L120/五星/A/技能10，最多5回合。郭嘉喵睡着 ${report.changRevive.deaths} 次，实际起身 ${report.changRevive.revivals.length} 次：${report.changRevive.revivals.map((r) => `${r.hp}/${r.maxHp}（${pct(r.fraction)}）`).join('、') || '无'}。两条 onAllyDeath 分别有独立一次限额；原35%复活先执行，追加50%对已醒目标跳过但仍消耗触发限额。此观察用于定位当前描述差异，不作为应当固定的玩法契约；Issue #51 等待 Claude 决定。`, '',
    '## Claude 可决定的调整方向', '',
    '目标原文为单 SP 胜率「+10%～20%」；本报告同时列百分点和相对增幅，具体验收口径待 Claude 确认。逐只查看表与九类分层；平均落在目标区间不代表每只都合格。当前不改 RARITY_MULT.SP 或技能，建议以配对区间和分层重复结果决定试调对象。', '',
    '同战力匹配大部分抵消 RARITY_MULT 对生命/攻防的直接作用，调整 SP=1.55 首先改变同等级养成优势与匹配等级，不能靠一个更小常量保证同战力目标。若同等级优势过大，可另做 1.35/1.40/1.45/1.55 的批准分支对照；只有跨多阵容复算后再选常量。', '',
    `本次单 SP 的逐猫观察：${report.rows.filter((r) => !r.noBonds && r.matching === 'power' && r.spCount === 1 && !r.label.endsWith('汇总')).map((r) => `${r.label} ${points(r.delta)}（95% ${ci(r.deltaInterval, true)}）`).join('；')}。若按百分点口径，区间下界高于20 pp 的对象优先复核；区间跨过20 pp 的对象暂不能声称在该口径下稳定超标。`, '',
    '建议先由 Claude 批准一次单点对照：司马喵懿可先试绝技基础2.7→2.43/2.16（原倍率的90%/80%），或单独试全队元气20→15，保留其他机制以辨认来源；庞喵统可先试每段1.6→1.44/1.28，而非同步改普攻、灼烧与涅槃；嫦喵先澄清 A/B 后，再单独试治疗3.0→2.7/2.4或护盾1.0→0.9/0.8。上述是明确的试验点，尚未实测，不是已验证的最终平衡值。三只叠加接近全胜，还需分别拆验团队减伤、治疗/增攻与元气循环；不把单猫均值当作多 SP 的线性叠加。每次只试一处，复用完全相同场景/种子再选值；本 PR 不修改常量或 KITS。', '',
    '## 替换职业/阵营清单', '', '计数只按每个场景的七个子集计算一次，不重复计羁绊开关、同等级组与镜像。', '', '| SP ← 普通猫（职业/阵营；站位） | 次数 |', '|---|---:|');
  for (const replacement of report.replacementCounts) lines.push(`| ${replacement.label} | ${replacement.count} |`);
  lines.push('', '## 前九个场景（完整其余场景由固定算法与命令重建）', '');
  for (const scenario of report.scenarios.slice(0, 9)) {
    lines.push(`### ${scenario.index}：${scenario.cohort}，seed=${scenario.seed}，普通基线战力=${scenario.power}`, '',
      `普通队：${setupLabel(scenario.baseline)}。`, '', `敌队：${setupLabel(scenario.opponent)}；战力=${lineupPower(scenario.opponent)}。`, '',
      '| SP 子集 | 同战力配置 | 战力 |', '|---|---|---:|');
    for (const variant of scenario.variants) lines.push(`| ${variant.spIds.map((id) => HERO_BY_ID[id].name).join('+')} | ${setupLabel(variant.team)} | ${lineupPower(variant.team)} |`);
    lines.push('');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

export function parseSpBalanceArgs(args: readonly string[]): { options: SpBalanceOptions; output: string; help: boolean } {
  const options: SpBalanceOptions = {};
  let output = 'docs/SP_BALANCE_PAID.md', help = false;
  const numeric = new Map<string, 'pairs' | 'seed' | 'level' | 'star' | 'skillLv' | 'campaignSeeds'>([
    ['--pairs', 'pairs'], ['--seed', 'seed'], ['--level', 'level'], ['--star', 'star'], ['--skill-lv', 'skillLv'], ['--campaign-seeds', 'campaignSeeds'],
  ]);
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === '--help' || flag === '-h') { help = true; continue; }
    if (flag === '--no-equal-level') { options.equalLevel = false; continue; }
    const key = numeric.get(flag);
    if (!key && flag !== '--out') throw new Error(`未知参数 ${flag}。`);
    const value = args[++i];
    if (!value || value.startsWith('--')) throw new Error(`${flag} 缺少值。`);
    if (key) {
      if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error(`${flag} 须为安全整数。`);
      options[key] = Number(value);
    } else {
      if (!value.trim()) throw new Error('--out 不能为空。');
      output = value;
    }
  }
  resolveSpBalanceOptions(options);
  return { options, output, help };
}
export function runSpBalanceCli(args: readonly string[]): void {
  const parsed = parseSpBalanceArgs(args);
  if (parsed.help) {
    console.log('node tools/run-sp-balance.mjs [--pairs N] [--seed N] [--level N] [--star 1..5] [--skill-lv 1..10] [--campaign-seeds N] [--no-equal-level] [--out PATH]');
    return;
  }
  const report = runSpBalance(parsed.options);
  report.commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  writeFileSync(parsed.output, renderSpBalance(report), 'utf8');
  console.log(`已写 ${parsed.output}；PvP ${report.simulations} 局，主线 ${report.campaignSimulations} 波。`);
  for (const row of report.rows.filter((r) => !r.noBonds && r.matching === 'power' && r.label.endsWith('汇总'))) console.log(`${row.label}：${pct(row.winRate)}，配对 ${points(row.delta)}（${ci(row.deltaInterval, true)}），最大战力误差 ${pct(row.maxPowerGap)}。`);
}
