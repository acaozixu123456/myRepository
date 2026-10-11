import { FACTIONS, FACTION_ORDER } from '../data/factions';
import type { FactionId } from '../data/factions';
import { STANDARD_HEROES as HEROES } from '../data/heroes';
import type { Rarity, Role } from '../data/heroes';
import { BONDS, COUNTER_RING } from '../data/systems';
import { KITS } from '../data/kits';
import { simulate } from '../engine/battle';
import { Rng } from '../engine/rng';
import type { BEvent, UnitSetup } from '../engine/types';

export interface BalanceOptions {
  games?: number;
  level?: number;
  star?: number;
  randomAwakening?: boolean;
  noBonds?: boolean;
  seed?: number;
}

export interface ResolvedBalanceOptions {
  games: number;
  level: number;
  star: number;
  randomAwakening: boolean;
  noBonds: boolean;
  seed: number;
}

export const DEFAULT_BALANCE_OPTIONS: Readonly<ResolvedBalanceOptions> = {
  games: 3000, level: 60, star: 5, randomAwakening: true, noBonds: false, seed: 20261011,
};
export const BALANCE_MIN_SAMPLES = 100;
export const BALANCE_MAX_ROUNDS = 30;
export const BALANCE_SKILL_LEVEL = 10;

export interface WinStats {
  samples: number;
  wins: number;
  losses: number;
  draws: number;
  /** 平局计半胜；没有样本时为 null。 */
  winRate: number | null;
  deviation: number | null;
  lowSample: boolean;
}

export interface HeroBalanceStats extends WinStats {
  heroId: string;
  name: string;
  faction: FactionId;
  rarity: Rarity;
  role: Role;
  appearances: number;
  /** 先逐场计算占本队已归因敌伤/治疗的比例，再按该英雄出场次数平均。 */
  avgDamageShare: number | null;
  avgHealingShare: number | null;
  ultimateCasts: number;
  avgUltimateCasts: number | null;
  sleepAppearances: number;
  /** 曾出现 death 的出场比例；复活后再次睡着仍只计一次。 */
  sleepRate: number | null;
  finalSleepRate: number | null;
}

export interface FactionBalanceStats extends WinStats {
  faction: FactionId;
  name: string;
  appearances: number;
}

export interface CounterBalanceStats extends WinStats {
  advantagedFaction: FactionId;
  disadvantagedFaction: FactionId;
  games: number;
  expectedMin: number;
  expectedMax: number;
}

export interface BondBalanceStats {
  name: string;
  heroes: string[];
  randomWithBond: WinStats;
  randomWithoutBond: WinStats;
  randomLift: number | null;
  probeWithBond: WinStats;
  probeControl: WinStats;
  /** 完整成员组与替换一成员组的胜率差；noBonds 时也仅描述成员组合。 */
  probeLift: number | null;
}

export interface BalanceSummary {
  randomGames: number;
  probePairs: number;
  counterProbeGames: number;
  bondProbeGames: number;
  totalSimulations: number;
  /** 以下指标只取随机主样本。 */
  avgRounds: number;
  timeoutGames: number;
  timeoutRate: number;
  drawGames: number;
  drawRate: number;
  gamesWithUltimate: number;
  gamesWithoutUltimate: number;
  avgFirstUltimateRound: number | null;
  enemyDamage: number;
  healing: number;
  unattributedDotDamage: number;
  excludedFriendlyDamage: number;
}

export interface BalanceAnomaly {
  kind: 'hero' | 'faction' | 'counter';
  id: string;
  name: string;
  samples: number;
  winRate: number;
  expectedMin: number;
  expectedMax: number;
  direction: 'high' | 'low';
  message: string;
}

export interface BalanceLowSample {
  kind: 'hero' | 'faction' | 'counter' | 'bond';
  id: string;
  name: string;
  samples: number;
  required: number;
}

export interface BalanceReport {
  options: ResolvedBalanceOptions;
  summary: BalanceSummary;
  heroes: HeroBalanceStats[];
  factions: FactionBalanceStats[];
  counters: CounterBalanceStats[];
  bonds: BondBalanceStats[];
  anomalies: BalanceAnomaly[];
  lowSamples: BalanceLowSample[];
  notes: string[];
}

export interface BattleSnapshot {
  events: readonly BEvent[];
  units: readonly { uid: number; heroId: string; side: 'A' | 'B'; alive: boolean }[];
  winner: 'A' | 'B' | 'draw';
  rounds: number;
}

export interface UnitBattleStats {
  uid: number;
  heroId: string;
  side: 'A' | 'B';
  damage: number;
  healing: number;
  damageShare: number;
  healingShare: number;
  ultimateCasts: number;
  slept: boolean;
  asleepAtEnd: boolean;
}

export interface BattleObservation {
  rounds: number;
  winner: 'A' | 'B' | 'draw';
  timedOut: boolean;
  draw: boolean;
  firstUltimateRound: number | null;
  teamDamage: Record<'A' | 'B', number>;
  teamHealing: Record<'A' | 'B', number>;
  unattributedDotDamage: number;
  excludedFriendlyDamage: number;
  units: UnitBattleStats[];
}

export interface CounterProbeMatch {
  advantagedFaction: FactionId;
  disadvantagedFaction: FactionId;
  seed: number;
  advantagedTeam: UnitSetup[];
  disadvantagedTeam: UnitSetup[];
  neutralHeroIds: string[];
}

export interface BondProbeMatch {
  bondName: string;
  seed: number;
  withBond: UnitSetup[];
  control: UnitSetup[];
  opponent: UnitSetup[];
  replacedHeroId: string;
  replacementHeroId: string;
}

type LineupOptions = Pick<ResolvedBalanceOptions, 'level' | 'star' | 'randomAwakening'>;
type Side = 'A' | 'B';
type Outcome = Side | 'draw';
const HERO_BY_ID = new Map(HEROES.map((hero) => [hero.id, hero]));
const HERO_IDS = HEROES.map((hero) => hero.id);
const FRONT_PRIORITY: Record<Role, number> = { 守护: 0, 先锋: 1, 神射: 2, 谋士: 3, 刺客: 4, 医者: 5 };

export function resolveBalanceOptions(options: BalanceOptions = {}): ResolvedBalanceOptions {
  const { games = 3000, level = 60, star = 5, randomAwakening = true, noBonds = false, seed = 20261011 } = options;
  if (!Number.isSafeInteger(games) || games <= 0 || games % 2 !== 0) throw new Error('对局数必须是正偶数，包含双方交换后的全部随机对局。');
  if (!Number.isInteger(level) || level < 1 || level > 120) throw new Error('等级须为 1 至 120 的整数。');
  if (!Number.isInteger(star) || star < 1 || star > 5) throw new Error('星级须为 1 至 5 的整数。');
  if (typeof randomAwakening !== 'boolean') throw new Error('随机觉醒开关必须是布尔值。');
  if (typeof noBonds !== 'boolean') throw new Error('关闭命名羁绊开关必须是布尔值。');
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('种子须为 0 至 4294967295 的整数。');
  return { games, level, star, randomAwakening, noBonds, seed };
}

function mixSeed(seed: number, label: string): number {
  let hash = seed >>> 0;
  for (let i = 0; i < label.length; i++) hash = Math.imul(hash ^ label.charCodeAt(i), 16777619) >>> 0;
  return hash;
}

function awakeningFor(heroId: string, options: LineupOptions, seed: number): 'A' | 'B' | undefined {
  if (options.star < 5) return undefined;
  return options.randomAwakening && new Rng(mixSeed(seed, `awaken:${heroId}`)).chance(0.5) ? 'B' : 'A';
}

/** 阵容内不重猫；职业数量不足时才把后排职业补到前排，镜像交换复用完整阵容。 */
export function buildLineup(heroIds: readonly string[], options: LineupOptions, seed: number): UnitSetup[] {
  resolveBalanceOptions({ ...options, games: 2, seed });
  if (heroIds.length !== 5 || new Set(heroIds).size !== 5) throw new Error('每队须有 5 只不同的英雄。');
  if (heroIds.some((id) => !HERO_BY_ID.has(id))) throw new Error('阵容引用了不存在的英雄。');
  const ordered = heroIds.slice().sort((a, b) => {
    const roleDiff = FRONT_PRIORITY[HERO_BY_ID.get(a)!.role] - FRONT_PRIORITY[HERO_BY_ID.get(b)!.role];
    return roleDiff || mixSeed(seed, `position:${a}`) - mixSeed(seed, `position:${b}`) || a.localeCompare(b);
  });
  return ordered.map((heroId, pos) => ({ heroId, pos, level: options.level, star: options.star, skillLv: BALANCE_SKILL_LEVEL, awaken: awakeningFor(heroId, options, seed) }));
}

/** status.add 的刷新不改引擎的原 src，因此只在首次 add、remove 或死亡时更新来源簿。 */
export function summarizeBattle(snapshot: BattleSnapshot, maxRounds = BALANCE_MAX_ROUNDS): BattleObservation {
  const unitMap = new Map<number, UnitBattleStats>(snapshot.units.map((u) => [u.uid, {
    uid: u.uid, heroId: u.heroId, side: u.side, damage: 0, healing: 0, damageShare: 0, healingShare: 0,
    ultimateCasts: 0, slept: false, asleepAtEnd: !u.alive,
  }]));
  const statusSources = new Map<number, Map<string, number>>();
  const teamDamage: Record<Side, number> = { A: 0, B: 0 };
  const teamHealing: Record<Side, number> = { A: 0, B: 0 };
  let round = 0;
  let firstUltimateRound: number | null = null;
  let unattributedDotDamage = 0;
  let excludedFriendlyDamage = 0;

  const addDamage = (src: number, dst: number, amount: number): boolean => {
    const caster = unitMap.get(src);
    const target = unitMap.get(dst);
    if (!caster || !target) return false;
    if (src === dst || caster.side === target.side) excludedFriendlyDamage += amount;
    else { caster.damage += amount; teamDamage[caster.side] += amount; }
    return true;
  };

  for (const event of snapshot.events) {
    switch (event.t) {
      case 'round': round = event.n; break;
      case 'act':
        if (event.kind === 'ultimate') {
          if (firstUltimateRound === null) firstUltimateRound = round;
          const unit = unitMap.get(event.uid);
          if (unit) unit.ultimateCasts++;
        }
        break;
      case 'damage':
        // amount 已包含护盾吸收；不能再加 absorbed，也不把自损或混乱误伤算作敌伤。
        addDamage(event.src, event.dst, event.amount);
        break;
      case 'heal': {
        const unit = unitMap.get(event.src);
        if (unit) { unit.healing += event.amount; teamHealing[unit.side] += event.amount; }
        break;
      }
      case 'status': {
        const sources = statusSources.get(event.dst) ?? new Map<string, number>();
        if (event.op === 'remove') sources.delete(event.id);
        else if (!sources.has(event.id)) sources.set(event.id, event.src);
        statusSources.set(event.dst, sources);
        break;
      }
      case 'dot': {
        const source = statusSources.get(event.dst)?.get(event.id);
        if (source === undefined || !addDamage(source, event.dst, event.amount)) unattributedDotDamage += event.amount;
        break;
      }
      case 'death': {
        const unit = unitMap.get(event.uid);
        if (unit) unit.slept = true;
        statusSources.delete(event.uid);
        break;
      }
      default: break;
    }
  }
  const units = [...unitMap.values()];
  for (const unit of units) {
    unit.damageShare = teamDamage[unit.side] ? unit.damage / teamDamage[unit.side] : 0;
    unit.healingShare = teamHealing[unit.side] ? unit.healing / teamHealing[unit.side] : 0;
  }
  return {
    rounds: snapshot.rounds, winner: snapshot.winner,
    timedOut: snapshot.rounds >= maxRounds && snapshot.units.some((u) => u.side === 'A' && u.alive) && snapshot.units.some((u) => u.side === 'B' && u.alive),
    draw: snapshot.winner === 'draw', firstUltimateRound, teamDamage, teamHealing, unattributedDotDamage, excludedFriendlyDamage, units,
  };
}

export function buildCounterProbeMatch(advantagedFaction: FactionId, options: LineupOptions, seed: number): CounterProbeMatch {
  const ringIndex = COUNTER_RING.indexOf(advantagedFaction);
  if (ringIndex < 0) throw new Error('克制探针引用了不存在的阵营。');
  const disadvantagedFaction = COUNTER_RING[(ringIndex + 1) % COUNTER_RING.length];
  const rng = new Rng(seed);
  const selectMain = (faction: FactionId) => rng.shuffle(HEROES.filter((h) => h.faction === faction).map((h) => h.id)).slice(0, 3);
  const advantagedMain = selectMain(advantagedFaction);
  const disadvantagedMain = selectMain(disadvantagedFaction);
  if (advantagedMain.length !== 3 || disadvantagedMain.length !== 3) throw new Error('克制探针需要每阵营至少 3 只不同英雄。');
  const neutralHeroIds = rng.shuffle(HEROES.filter((h) => h.faction !== advantagedFaction && h.faction !== disadvantagedFaction).map((h) => h.id)).slice(0, 2);
  return {
    advantagedFaction, disadvantagedFaction, seed, neutralHeroIds,
    advantagedTeam: buildLineup([...advantagedMain, ...neutralHeroIds], options, seed),
    disadvantagedTeam: buildLineup([...disadvantagedMain, ...neutralHeroIds], options, seed),
  };
}

export function buildBondProbeMatch(bondName: string, options: LineupOptions, seed: number): BondProbeMatch {
  const bond = BONDS.find((candidate) => candidate.name === bondName);
  if (!bond) throw new Error('羁绊探针引用了不存在的羁绊。');
  const rng = new Rng(seed);
  const fillers = rng.shuffle(HERO_IDS.filter((id) => !bond.heroes.includes(id))).slice(0, 5 - bond.heroes.length);
  const ids = [...bond.heroes, ...fillers];
  const replacedHeroId = rng.pick(bond.heroes);
  const replaced = HERO_BY_ID.get(replacedHeroId)!;
  const candidates = rng.shuffle(HEROES.filter((h) => !ids.includes(h.id)));
  const replacement = candidates.find((h) => h.role === replaced.role && h.rarity === replaced.rarity && h.faction === replaced.faction)
    ?? candidates.find((h) => h.role === replaced.role && h.rarity === replaced.rarity)
    ?? candidates.find((h) => h.role === replaced.role)
    ?? candidates.find((h) => h.rarity === replaced.rarity)
    ?? candidates[0];
  const replacementHeroId = replacement.id;
  const withBond = buildLineup(ids, options, seed);
  // 保留其余四猫的站位与觉醒。替换猫优先同职业/稀有度；仍可能改变阵营加成或别的羁绊。
  const control = withBond.map((u) => u.heroId === replacedHeroId
    ? { ...u, heroId: replacementHeroId, awaken: awakeningFor(replacementHeroId, options, seed) }
    : { ...u });
  return {
    bondName, seed, withBond, control, replacedHeroId, replacementHeroId,
    opponent: buildLineup(rng.shuffle(HERO_IDS).slice(0, 5), options, mixSeed(seed, 'opponent')),
  };
}

interface WinCounter { samples: number; wins: number; losses: number; draws: number }
const newWinCounter = (): WinCounter => ({ samples: 0, wins: 0, losses: 0, draws: 0 });
function addOutcome(counter: WinCounter, winner: Outcome, side: Side) {
  counter.samples++;
  if (winner === 'draw') counter.draws++;
  else if (winner === side) counter.wins++;
  else counter.losses++;
}
function winStats(counter: WinCounter): WinStats {
  const winRate = counter.samples ? (counter.wins + counter.draws * 0.5) / counter.samples : null;
  return { ...counter, winRate, deviation: winRate === null ? null : winRate - 0.5, lowSample: counter.samples < BALANCE_MIN_SAMPLES };
}
const rateDifference = (first: WinStats, second: WinStats): number | null => first.winRate === null || second.winRate === null ? null : first.winRate - second.winRate;

interface HeroCounter {
  outcomes: WinCounter;
  damageShareSum: number;
  healingShareSum: number;
  ultimateCasts: number;
  sleepAppearances: number;
  finalSleepAppearances: number;
}

/** 纯批处理：只在局部积累统计，不改全局英雄、技能或引擎配置，也不读写文件。 */
export function runBalance(input: BalanceOptions = {}): BalanceReport {
  const options = resolveBalanceOptions(input);
  const rng = new Rng(options.seed);
  const heroCounters = new Map<string, HeroCounter>(HERO_IDS.map((id) => [id, {
    outcomes: newWinCounter(), damageShareSum: 0, healingShareSum: 0, ultimateCasts: 0, sleepAppearances: 0, finalSleepAppearances: 0,
  }]));
  const factionCounters = new Map(FACTION_ORDER.map((id) => [id, newWinCounter()]));
  const bondCounters = BONDS.map((bond) => ({ bond, randomWith: newWinCounter(), randomWithout: newWinCounter(), probeWith: newWinCounter(), probeControl: newWinCounter() }));
  let roundSum = 0;
  let firstUltimateSum = 0;
  let gamesWithUltimate = 0;
  let timeoutGames = 0;
  let drawGames = 0;
  let enemyDamage = 0;
  let healing = 0;
  let unattributedDotDamage = 0;
  let excludedFriendlyDamage = 0;

  const observeRandom = (A: UnitSetup[], B: UnitSetup[], seed: number) => {
    const result = summarizeBattle(simulate({ A, B, seed, maxRounds: BALANCE_MAX_ROUNDS, startEnergy: 0, noBonds: options.noBonds }));
    roundSum += result.rounds;
    if (result.firstUltimateRound !== null) { gamesWithUltimate++; firstUltimateSum += result.firstUltimateRound; }
    if (result.timedOut) timeoutGames++;
    if (result.draw) drawGames++;
    enemyDamage += result.teamDamage.A + result.teamDamage.B;
    healing += result.teamHealing.A + result.teamHealing.B;
    unattributedDotDamage += result.unattributedDotDamage;
    excludedFriendlyDamage += result.excludedFriendlyDamage;
    for (const unit of result.units) {
      const counter = heroCounters.get(unit.heroId)!;
      addOutcome(counter.outcomes, result.winner, unit.side);
      counter.damageShareSum += unit.damageShare;
      counter.healingShareSum += unit.healingShare;
      counter.ultimateCasts += unit.ultimateCasts;
      if (unit.slept) counter.sleepAppearances++;
      if (unit.asleepAtEnd) counter.finalSleepAppearances++;
    }
    for (const [side, lineup] of [['A', A], ['B', B]] as const) {
      const ids = lineup.map((unit) => unit.heroId);
      for (const faction of FACTION_ORDER) if (ids.filter((id) => HERO_BY_ID.get(id)!.faction === faction).length >= 3) addOutcome(factionCounters.get(faction)!, result.winner, side);
      for (const counter of bondCounters) addOutcome(counter.bond.heroes.every((id) => ids.includes(id)) ? counter.randomWith : counter.randomWithout, result.winner, side);
    }
  };

  // 主样本优先；成对交换整份配置，重复使用战斗种子以减少先后手偏差。
  for (let pair = 0; pair < options.games / 2; pair++) {
    const seed = Math.floor(rng.next() * 0x100000000);
    const A = buildLineup(rng.shuffle(HERO_IDS).slice(0, 5), options, mixSeed(seed, 'lineup:A'));
    const B = buildLineup(rng.shuffle(HERO_IDS).slice(0, 5), options, mixSeed(seed, 'lineup:B'));
    observeRandom(A, B, seed);
    observeRandom(B, A, seed);
  }

  const probePairs = Math.max(1, Math.ceil(options.games / 60));
  const counters: CounterBalanceStats[] = COUNTER_RING.map((faction) => {
    const counter = newWinCounter();
    for (let pair = 0; pair < probePairs; pair++) {
      const match = buildCounterProbeMatch(faction, options, mixSeed(options.seed, `counter:${faction}:${pair}`));
      const first = simulate({ A: match.advantagedTeam, B: match.disadvantagedTeam, seed: match.seed, maxRounds: BALANCE_MAX_ROUNDS, startEnergy: 0, noBonds: true });
      const second = simulate({ A: match.disadvantagedTeam, B: match.advantagedTeam, seed: match.seed, maxRounds: BALANCE_MAX_ROUNDS, startEnergy: 0, noBonds: true });
      addOutcome(counter, first.winner, 'A');
      addOutcome(counter, second.winner, 'B');
    }
    return { ...winStats(counter), advantagedFaction: faction, disadvantagedFaction: COUNTER_RING[(COUNTER_RING.indexOf(faction) + 1) % COUNTER_RING.length], games: counter.samples, expectedMin: 0.55, expectedMax: 0.65 };
  });

  for (const counter of bondCounters) {
    for (let pair = 0; pair < probePairs; pair++) {
      const match = buildBondProbeMatch(counter.bond.name, options, mixSeed(options.seed, `bond:${counter.bond.name}:${pair}`));
      for (const [team, outcomeCounter] of [[match.withBond, counter.probeWith], [match.control, counter.probeControl]] as const) {
        const first = simulate({ A: team, B: match.opponent, seed: match.seed, maxRounds: BALANCE_MAX_ROUNDS, startEnergy: 0, noBonds: options.noBonds });
        const second = simulate({ A: match.opponent, B: team, seed: match.seed, maxRounds: BALANCE_MAX_ROUNDS, startEnergy: 0, noBonds: options.noBonds });
        addOutcome(outcomeCounter, first.winner, 'A');
        addOutcome(outcomeCounter, second.winner, 'B');
      }
    }
  }

  const heroes: HeroBalanceStats[] = HEROES.map((hero) => {
    const counter = heroCounters.get(hero.id)!;
    const appearances = counter.outcomes.samples;
    const average = (sum: number) => appearances ? sum / appearances : null;
    return {
      ...winStats(counter.outcomes), heroId: hero.id, name: hero.name, faction: hero.faction, rarity: hero.rarity, role: hero.role, appearances,
      avgDamageShare: average(counter.damageShareSum), avgHealingShare: average(counter.healingShareSum), ultimateCasts: counter.ultimateCasts,
      avgUltimateCasts: average(counter.ultimateCasts), sleepAppearances: counter.sleepAppearances,
      sleepRate: average(counter.sleepAppearances), finalSleepRate: average(counter.finalSleepAppearances),
    };
  });
  const factions: FactionBalanceStats[] = FACTION_ORDER.map((faction) => ({ ...winStats(factionCounters.get(faction)!), faction, name: FACTIONS[faction].name, appearances: factionCounters.get(faction)!.samples }));
  const bonds: BondBalanceStats[] = bondCounters.map((counter) => {
    const randomWithBond = winStats(counter.randomWith);
    const randomWithoutBond = winStats(counter.randomWithout);
    const probeWithBond = winStats(counter.probeWith);
    const probeControl = winStats(counter.probeControl);
    return { name: counter.bond.name, heroes: counter.bond.heroes.slice(), randomWithBond, randomWithoutBond, randomLift: rateDifference(randomWithBond, randomWithoutBond), probeWithBond, probeControl, probeLift: rateDifference(probeWithBond, probeControl) };
  });
  const anomalies: BalanceAnomaly[] = [];
  const lowSamples: BalanceLowSample[] = [];
  const inspect = (kind: BalanceAnomaly['kind'], id: string, name: string, stats: WinStats, expectedMin: number, expectedMax: number) => {
    if (stats.lowSample) lowSamples.push({ kind, id, name, samples: stats.samples, required: BALANCE_MIN_SAMPLES });
    else if (stats.winRate !== null && (stats.winRate < expectedMin || stats.winRate > expectedMax)) {
      const direction = stats.winRate < expectedMin ? 'low' : 'high';
      anomalies.push({ kind, id, name, samples: stats.samples, winRate: stats.winRate, expectedMin, expectedMax, direction, message: `${name}胜率 ${(stats.winRate * 100).toFixed(1)}%，${direction === 'low' ? '低于' : '高于'}观察区间 ${(expectedMin * 100).toFixed(0)}%～${(expectedMax * 100).toFixed(0)}%，请复核当前阵容与技能。` });
    }
  };
  for (const hero of heroes) inspect('hero', hero.heroId, hero.name, hero, 0.38, 0.62);
  for (const faction of factions) inspect('faction', faction.faction, `${faction.name}主阵营`, faction, 0.42, 0.58);
  for (const counter of counters) inspect('counter', `${counter.advantagedFaction}_${counter.disadvantagedFaction}`, `${FACTIONS[counter.advantagedFaction].name}→${FACTIONS[counter.disadvantagedFaction].name}`, counter, counter.expectedMin, counter.expectedMax);
  for (const bond of bonds) {
    for (const [suffix, label, stats] of [['random_with', '随机完整组', bond.randomWithBond], ['random_without', '随机非完整组', bond.randomWithoutBond], ['probe_with', '探针完整组', bond.probeWithBond], ['probe_control', '替换一猫组', bond.probeControl]] as const) {
      if (stats.lowSample) lowSamples.push({ kind: 'bond', id: `${bond.name}:${suffix}`, name: `${bond.name}·${label}`, samples: stats.samples, required: BALANCE_MIN_SAMPLES });
    }
  }
  const counterProbeGames = counters.reduce((sum, counter) => sum + counter.games, 0);
  const bondProbeGames = bonds.reduce((sum, bond) => sum + bond.probeWithBond.samples + bond.probeControl.samples, 0);
  const handcrafted = HERO_IDS.filter((id) => KITS[id] !== undefined).length;
  return {
    options,
    summary: {
      randomGames: options.games, probePairs, counterProbeGames, bondProbeGames, totalSimulations: options.games + counterProbeGames + bondProbeGames,
      avgRounds: roundSum / options.games, timeoutGames, timeoutRate: timeoutGames / options.games, drawGames, drawRate: drawGames / options.games,
      gamesWithUltimate, gamesWithoutUltimate: options.games - gamesWithUltimate, avgFirstUltimateRound: gamesWithUltimate ? firstUltimateSum / gamesWithUltimate : null,
      enemyDamage, healing, unattributedDotDamage, excludedFriendlyDamage,
    },
    heroes, factions, counters, bonds, anomalies, lowSamples,
    notes: [
      `当前名册 ${HERO_IDS.length} 只英雄，其中 ${handcrafted} 只使用手工技能组、${HERO_IDS.length - handcrafted} 只使用通用技能；报告反映本次运行读取的基线，未合入技能不能当作最终设计。`,
      `随机主样本实际 ${options.games} 局；每两局复用阵容、觉醒、站位和种子并交换双方，同队不重猫。英雄与主阵营统计只取主样本；镜像样本相关，不作独立显著性检验。`,
      `所有猫猫等级 ${options.level}、${options.star} 星、技能 ${BALANCE_SKILL_LEVEL} 级，满生命、0 元气开局；${options.star < 5 ? '不足 5 星不启用觉醒' : options.randomAwakening ? '觉醒 A/B 按英雄与种子随机选择' : '觉醒固定为 A'}。守护、先锋优先前 3 位；职业不足时由其他职业补齐。`,
      '胜率以胜场加半数平局除以样本数计算，无样本为 null；同一英雄可以出现在敌我两队，每次出场各算一份。',
      '贡献占比先逐场取该猫贡献除以本队贡献，再按该猫出场次数平均；本队贡献为零的场次占比计 0。只计对敌伤害，取事件 amount（含护盾吸收及超量伤害），不叠加 absorbed，不含自损或友伤。',
      '持续伤害按目标和状态追踪首次施加者，刷新保留原来源，移除或死亡后清除；无法确认来源的持续伤害单列，不分配给英雄，也不进入团队已归因伤害分母。',
      '治疗按 heal.src 归属，呼噜被引擎记为接受者自疗，因此计给自疗猫；此口径不衡量治疗状态最初施加者的全部贡献。',
      '睡着率表示一次出场中曾有 death 事件，复活后再次睡着不重复计；另列结束时仍睡着的比例。30 回合且双方仍有人清醒为超时；引擎仍按剩余生命比例判胜，超时与真正平局分别统计。',
      `随机主样本与成员组合探针${options.noBonds ? '关闭' : '启用'}命名羁绊；克制环探针始终关闭命名羁绊。所有样本保留阵营同族机制。`,
      '克制环探针每队 3 只不同主阵营猫，加双方相同的 2 只其他阵营支援，交叉交换双方；命名羁绊已关闭，主阵营英雄、职业及站位仍有差异，55%～65% 是观察目标，不是对纯伤害克制系数的因果估计。',
      `成员齐全按全体指定英雄同队出场判定；随机完整/非完整组差值只是相关。独立探针用完整组与替换一成员组对相同敌队、相同种子及双边位置比较，保留其余成员站位和觉醒；替换仍改变英雄技能、可能改变稀有度及同族机制。${options.noBonds ? '命名羁绊全部关闭，齐全/替换成员观察差不代表羁绊收益。' : '其他命名羁绊也可能变化，观察差不称纯羁绊因果提升。'}`,
      `不足 ${BALANCE_MIN_SAMPLES} 次实际样本单列，不据其胜率断言失衡；英雄观察区间 38%～62%，主阵营 42%～58%，克制方 55%～65%，所有标记仅供 Claude 复核，工具不修改任何数值。`,
    ],
  };
}

export function summarizeBalance(report: BalanceReport, limit = 5): { strongest: HeroBalanceStats[]; weakest: HeroBalanceStats[]; anomalyCount: number; lowSampleCount: number } {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('摘要数量须为正整数。');
  const eligible = report.heroes.filter((hero) => !hero.lowSample && hero.winRate !== null);
  return {
    strongest: eligible.slice().sort((a, b) => b.winRate! - a.winRate! || a.heroId.localeCompare(b.heroId)).slice(0, limit),
    weakest: eligible.slice().sort((a, b) => a.winRate! - b.winRate! || a.heroId.localeCompare(b.heroId)).slice(0, limit),
    anomalyCount: report.anomalies.length, lowSampleCount: report.lowSamples.length,
  };
}
