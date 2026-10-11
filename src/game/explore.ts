// 探索模式的游戏规则（纯逻辑，可测试）：地图上放什么、打赢给什么、每天上限。
// 3D 世界（src/world）只负责「看和走」，这里决定「打什么、拿什么」。
import { CHAPTERS } from '../content/campaign';
import type { StageDef } from '../content/types';
import { getStage, nextStage, winReward } from './stage';
import type { Gain } from './stage';
import type { PlayerState } from './state';
import { mulberry } from '../fx/util';
import { herbsOf, levelOf as sceneOf } from '../world/levels';
import type { LevelDef } from '../world/levels';

export interface ExploreState { day: number; kills: number; chests: string[]; talked: string[]; bossWins?: number; claimed?: boolean; herbs?: string[] }
export const KILL_CAP = 40; // 每天拿奖励的野怪场数上限
export const KILL_MUL = 1.5; // 探索里每场野怪胜利 = 挂机胜利奖励 × 1.5（主动玩，比挂机略高）

const dayKey = (now = Date.now()) => Math.floor((now - 5 * 3600_000) / 86400_000); // 与任务一致：每天 5 点刷新

export function ensureExplore(s: PlayerState, now = Date.now()): ExploreState {
  const e = ((s as unknown as { explore?: ExploreState }).explore ??= { day: dayKey(now), kills: 0, chests: [], talked: [] });
  if (e.day !== dayKey(now)) { e.day = dayKey(now); e.kills = 0; e.chests = []; e.talked = []; e.bossWins = 0; e.claimed = false; e.herbs = []; }
  return e;
}

/** 剧情首领：下一个没通的关；全通了就是当前最高关（可重复挑战） */
export function bossStage(s: PlayerState): { chapter: number; index: number; stage: StageDef; fresh: boolean } {
  const best = s.best ?? s.stage;
  const n = nextStage(best.chapter, best.index);
  const t = n ?? { chapter: best.chapter, index: best.index };
  return { ...t, stage: getStage(t.chapter, t.index)!, fresh: !!n };
}
/** 野怪：当前已通的最高关 */
export function farmStage(s: PlayerState): { chapter: number; index: number; stage: StageDef } {
  const b = s.best ?? s.stage;
  return { chapter: b.chapter, index: b.index, stage: getStage(b.chapter, b.index)! };
}

export interface SpawnDef { id: string; kind: 'enemy' | 'boss' | 'chest' | 'herb' | 'npc'; x: number; z: number; units?: string[]; label: string; patrol?: number; stageKey?: string }

/** 当前该进哪个场景：跟着主线章节走（首领所在的章节） */
export const explorerLevel = (s: PlayerState): LevelDef => sceneOf(bossStage(s).chapter);

const unitsOf = (st: StageDef, wave = 0, n = 3): string[] => st.waves[Math.min(wave, st.waves.length - 1)].enemies.slice(0, n).map((e) => e.unit);
const levelOf = (st: StageDef) => st.waves[0].enemies[0]?.level ?? 1;

/** 当前地图上的所有实体（死掉的野怪 / 开过的箱子由调用方过滤） */
export function spawnPlan(s: PlayerState): SpawnDef[] {
  const out: SpawnDef[] = [];
  const L = explorerLevel(s);
  const boss = bossStage(s), farm = farmStage(s);
  const lastWave = boss.stage.waves[boss.stage.waves.length - 1];
  out.push({ id: 'boss', kind: 'boss', x: L.bossSpot[0], z: L.bossSpot[1], units: [lastWave.enemies[0].unit], label: `${boss.stage.id} ${boss.stage.name}`, stageKey: `${boss.chapter}-${boss.index}` });
  const rnd = mulberry(farm.chapter * 100 + farm.index);
  L.enemySpots.forEach(([x, z], i) => {
    const w = Math.floor(rnd() * farm.stage.waves.length);
    out.push({ id: `e${i}`, kind: 'enemy', x, z, units: unitsOf(farm.stage, w, 2 + (i % 2)), label: `${farm.stage.name} Lv${levelOf(farm.stage)}`, patrol: 4 + (i % 3), stageKey: `${farm.chapter}-${farm.index}` });
  });
  L.chestSpots.forEach(([x, z], i) => out.push({ id: `c${i}`, kind: 'chest', x, z, label: '宝箱' }));
  herbsOf(L).forEach(([x, z], i) => out.push({ id: `h${i}`, kind: 'herb', x, z, label: '猫薄荷丛' }));
  out.push({ id: 'npc', kind: 'npc', x: L.npcSpot[0], z: L.npcSpot[1], units: ['xian_changmiao'], label: '嫦喵 · 向导' });
  return out;
}

/** 野怪胜利奖励（每天最多 KILL_CAP 场有奖励） */
export function killReward(s: PlayerState, stage: StageDef): Gain | null {
  const e = ensureExplore(s);
  totals(s).kills++; // 每场野怪胜利都计入足迹（不受每日奖励上限影响）
  if (e.kills >= KILL_CAP) return null;
  e.kills++;
  const g = winReward(stage);
  return { fish: Math.round(g.fish * KILL_MUL), exp: Math.round(g.exp * KILL_MUL), catnip: 0, bells: 0 };
}

/** 宝箱奖励：每天每个箱子一次；小鱼干 + 经验为主，偶尔猫薄荷 / 金铃铛 */
export function openChest(s: PlayerState, id: string): Gain | null {
  const e = ensureExplore(s);
  if (e.chests.includes(id)) return null;
  e.chests.push(id);
  totals(s).chests++;
  const farm = farmStage(s).stage;
  const base = winReward(farm);
  const rnd = mulberry(dayKey() * 31 + id.charCodeAt(1));
  return { fish: Math.round(base.fish * 4 + 80), exp: Math.round(base.exp * 3 + 40), catnip: rnd() < 0.5 ? 2 : 0, bells: rnd() < 0.35 ? 20 : 0 };
}

export const gainText = (g: Gain) => [g.fish ? `${g.fish} 小鱼干` : '', g.exp ? `${g.exp} 经验` : '', g.catnip ? `${g.catnip} 猫薄荷` : '', g.bells ? `${g.bells} 金铃铛` : ''].filter(Boolean).join(' · ');
export const chapterCount = () => CHAPTERS.length;

// ---------- 嫦喵的每日委托 ----------
export const DAILY_GOALS = [
  { key: 'kills', need: 5, label: '击败 5 只野猫' },
  { key: 'chests', need: 3, label: '打开 3 个宝箱' },
  { key: 'boss', need: 1, label: '赢下 1 场首领战' },
] as const;
export interface GoalProgress { label: string; have: number; need: number; done: boolean }
export function dailyProgress(s: PlayerState, now = Date.now()): GoalProgress[] {
  const e = ensureExplore(s, now);
  const have = { kills: e.kills, chests: e.chests.length, boss: e.bossWins ?? 0 };
  return DAILY_GOALS.map((g) => ({ label: g.label, have: Math.min(g.need, have[g.key]), need: g.need, done: have[g.key] >= g.need }));
}
export const dailyReady = (s: PlayerState, now = Date.now()) => dailyProgress(s, now).every((g) => g.done);
export const dailyClaimed = (s: PlayerState, now = Date.now()) => !!ensureExplore(s, now).claimed;
export function recordBossWin(s: PlayerState, now = Date.now()) { const e = ensureExplore(s, now); e.bossWins = (e.bossWins ?? 0) + 1; totals(s).bosses++; }
/** 三项都完成后找嫦喵领奖，每天一次：小鱼干 + 经验为主，外加猫薄荷和金铃铛 */
export function claimDaily(s: PlayerState, now = Date.now()): Gain | null {
  if (!dailyReady(s, now) || dailyClaimed(s, now)) return null;
  ensureExplore(s, now).claimed = true;
  const base = winReward(farmStage(s).stage);
  return { fish: Math.round(base.fish * 10 + 300), exp: Math.round(base.exp * 8 + 200), catnip: 6, bells: 40 };
}

/** 猫薄荷丛：每天每丛一次，主要给猫薄荷（养成素材），带一点小鱼干 */
export function pickHerb(s: PlayerState, id: string, now = Date.now()): Gain | null {
  const e = ensureExplore(s, now);
  e.herbs ??= [];
  if (e.herbs.includes(id)) return null;
  e.herbs.push(id);
  totals(s).herbs++;
  const rnd = mulberry(dayKey(now) * 17 + id.charCodeAt(1));
  const base = winReward(farmStage(s).stage);
  return { fish: Math.round(base.fish * 1.5), exp: 0, catnip: 3 + Math.floor(rnd() * 3), bells: 0 };
}

// ---------- 探索足迹（长期累计目标）----------
export type TrailStat = 'kills' | 'chests' | 'herbs' | 'bosses';
export interface TrailMilestone { id: string; stat: TrailStat; need: number; label: string; reward: Gain }
const G = (fish: number, catnip: number, bells: number, exp = 0): Gain => ({ fish, catnip, bells, exp });
export const TRAIL: TrailMilestone[] = [
  { id: 'k20', stat: 'kills', need: 20, label: '街头新手 · 击败 20 只野猫', reward: G(300, 0, 0, 100) },
  { id: 'k60', stat: 'kills', need: 60, label: '巷口一霸 · 击败 60 只野猫', reward: G(800, 6, 0, 300) },
  { id: 'k150', stat: 'kills', need: 150, label: '横扫街区 · 击败 150 只野猫', reward: G(2000, 12, 40, 800) },
  { id: 'k400', stat: 'kills', need: 400, label: '喵洲传说 · 击败 400 只野猫', reward: G(5000, 30, 120, 2000) },
  { id: 'c10', stat: 'chests', need: 10, label: '寻宝学徒 · 打开 10 个宝箱', reward: G(400, 3, 0) },
  { id: 'c40', stat: 'chests', need: 40, label: '寻宝达人 · 打开 40 个宝箱', reward: G(1500, 10, 30) },
  { id: 'c120', stat: 'chests', need: 120, label: '宝箱收割机 · 打开 120 个宝箱', reward: G(4000, 25, 100) },
  { id: 'h10', stat: 'herbs', need: 10, label: '采药喵 · 采 10 丛猫薄荷', reward: G(200, 8, 0) },
  { id: 'h40', stat: 'herbs', need: 40, label: '猫薄荷园丁 · 采 40 丛猫薄荷', reward: G(600, 20, 20) },
  { id: 'h120', stat: 'herbs', need: 120, label: '薄荷大亨 · 采 120 丛猫薄荷', reward: G(1500, 50, 60) },
  { id: 'b3', stat: 'bosses', need: 3, label: '首领克星 · 赢 3 场首领战', reward: G(500, 4, 10, 200) },
  { id: 'b12', stat: 'bosses', need: 12, label: '首领终结者 · 赢 12 场首领战', reward: G(2000, 15, 50, 800) },
  { id: 'b40', stat: 'bosses', need: 40, label: '九命天敌 · 赢 40 场首领战', reward: G(6000, 40, 150, 2500) },
];
export function totals(s: PlayerState) { return (s.exploreTotals ??= { kills: 0, chests: 0, herbs: 0, bosses: 0, claimed: [] }); }
export interface TrailRow extends TrailMilestone { have: number; ready: boolean; claimed: boolean }
export function trailRows(s: PlayerState): TrailRow[] {
  const t = totals(s);
  return TRAIL.map((m) => ({ ...m, have: Math.min(m.need, t[m.stat]), ready: t[m.stat] >= m.need && !t.claimed.includes(m.id), claimed: t.claimed.includes(m.id) }));
}
export function claimTrail(s: PlayerState, id: string): Gain | null {
  const m = TRAIL.find((x) => x.id === id), t = totals(s);
  if (!m || t.claimed.includes(id) || t[m.stat] < m.need) return null;
  t.claimed.push(id);
  return { ...m.reward };
}

// ---------- 自动探索（挂机与冒险的桥）----------
/** 自动探索离首领至少这么远（首领 4.2 就触发战斗，留出路上的余量） */
export const BOSS_SAFE = 9;
export interface AutoEnt { kind: SpawnDef['kind']; x: number; z: number }
/**
 * 自动探索下一个去哪：先捡离得最近的猫薄荷丛 / 宝箱（不用打架），再去找最近的野猫；
 * 首领和嫦喵永远不自动去。每日野怪奖励拿满（killsLeft = false）后就不再主动找野猫，没有目标返回 null。
 */
export const autoKey = (e: { x: number; z: number }) => `${Math.round(e.x)},${Math.round(e.z)}`;
export function pickAutoTarget(from: { x: number; z: number }, ents: AutoEnt[], killsLeft: boolean, skip?: ReadonlySet<string>): AutoEnt | null {
  const d2 = (e: AutoEnt) => (e.x - from.x) ** 2 + (e.z - from.z) ** 2;
  // 首领会在 4.2 以内触发战斗：靠近首领的宝箱 / 野猫不自动去，免得自动探索误打首领
  const bosses = ents.filter((e) => e.kind === 'boss');
  const safe = (e: AutoEnt) => bosses.every((b) => (b.x - e.x) ** 2 + (b.z - e.z) ** 2 > BOSS_SAFE ** 2);
  ents = ents.filter((e) => safe(e) && !skip?.has(autoKey(e))); // skip：走不到的点（卡住几次后由调用方放进来）
  const nearest = (list: AutoEnt[]) => list.reduce<AutoEnt | null>((b, e) => (!b || d2(e) < d2(b) ? e : b), null);
  return nearest(ents.filter((e) => e.kind === 'herb' || e.kind === 'chest')) ?? (killsLeft ? nearest(ents.filter((e) => e.kind === 'enemy')) : null);
}
export const killsLeft = (s: PlayerState, now = Date.now()) => ensureExplore(s, now).kills < KILL_CAP;
