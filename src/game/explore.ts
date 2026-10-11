// 探索模式的游戏规则（纯逻辑，可测试）：地图上放什么、打赢给什么、每天上限。
// 3D 世界（src/world）只负责「看和走」，这里决定「打什么、拿什么」。
import { CHAPTERS } from '../content/campaign';
import type { StageDef } from '../content/types';
import { getStage, nextStage, winReward } from './stage';
import type { Gain } from './stage';
import type { PlayerState } from './state';
import { mulberry } from '../fx/util';
import { levelOf as sceneOf } from '../world/levels';
import { herbsOf } from '../world/levels';
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
export function recordBossWin(s: PlayerState, now = Date.now()) { const e = ensureExplore(s, now); e.bossWins = (e.bossWins ?? 0) + 1; }
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
  const rnd = mulberry(dayKey(now) * 17 + id.charCodeAt(1));
  const base = winReward(farmStage(s).stage);
  return { fish: Math.round(base.fish * 1.5), exp: 0, catnip: 3 + Math.floor(rnd() * 3), bells: 0 };
}
