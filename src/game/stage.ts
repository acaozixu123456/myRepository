// 关卡与战斗配置：把阵容、关卡数据转成引擎的 BattleConfig；结算奖励；挂机收益。
import { CHAPTERS } from '../content/campaign';
import { idleCap, idleRate as contentIdleRate } from '../content/progression';
import type { StageDef } from '../content/types';
import { HERO_BY_ID } from '../data/heroes';
import type { UnitSetup } from '../engine/types';
import { heroGear } from './gear';
import { vipLevel, vipPerks } from './premium';
import { heroPower, newPlayer } from './state';
import type { PlayerState, Resources } from './state';
import { track } from './quests';

export function getStage(chapter: number, index: number): StageDef | undefined {
  return CHAPTERS[chapter - 1]?.stages[index - 1];
}
export function nextStage(chapter: number, index: number): { chapter: number; index: number } | null {
  const ch = CHAPTERS[chapter - 1];
  if (!ch) return null;
  if (index < ch.stages.length) return { chapter, index: index + 1 };
  if (chapter < CHAPTERS.length) return { chapter: chapter + 1, index: 1 };
  return null;
}
export const stageOrdinal = (chapter: number, index: number) => (chapter - 1) * 24 + index;

/**
 * 界面显示的推荐战力。content 里的 recommendedPower 是按“关卡增幅 4%~8%”设计的曲线，
 * 与实际战力公式量纲不同；这里用“按节奏应有的参考阵容”重新标定（经战斗模拟验证：
 * 第 1 / 7 / 30 天的参考等级 20 / 45 / 95 对应推进到第 1 / 3 / 6 章末）。
 */
const PACE: [number, number][] = [[1, 8], [24, 20], [72, 45], [144, 95]];
export function paceLevel(ordinal: number): number {
  for (let i = 1; i < PACE.length; i++) {
    const [o0, l0] = PACE[i - 1], [o1, l1] = PACE[i];
    if (ordinal <= o1) return Math.round(l0 + ((l1 - l0) * (Math.max(o0, ordinal) - o0)) / (o1 - o0));
  }
  return PACE[PACE.length - 1][1];
}
const paceStar = (lv: number) => (lv < 20 ? 1 : lv < 40 ? 2 : lv < 65 ? 3 : lv < 90 ? 4 : 5);
let refCache: Map<number, number> | undefined;
export function recommendedPowerOf(chapter: number, index: number): number {
  const o = stageOrdinal(chapter, index);
  refCache ??= new Map();
  let v = refCache.get(o);
  if (v === undefined) {
    const lv = paceLevel(o);
    const p = newPlayer(0);
    v = Object.values(p.heroes).reduce((a, h) => a + heroPower({ ...h, lv, star: paceStar(lv) }), 0);
    refCache.set(o, v);
  }
  return v;
}

/** 我方 UnitSetup（可带继承状态） */
export function lineupSetups(s: PlayerState, carry?: Record<string, { hpPct: number; energy: number }>): UnitSetup[] {
  const out: UnitSetup[] = [];
  s.lineup.forEach((id, pos) => {
    if (!id) return;
    const h = s.heroes[id];
    if (!h) return;
    const c = carry?.[id];
    const g = heroGear(s, id);
    out.push({ heroId: id, level: h.lv, star: h.star, awaken: h.awaken, skillLv: h.skillLv, pos, hpPct: c?.hpPct, energy: c?.energy, gear: g.stats, set4: g.set4 });
  });
  return out;
}

/** 某一波的敌方 UnitSetup */
export function waveSetups(stage: StageDef, wave: number): UnitSetup[] {
  const w = stage.waves[Math.min(wave, stage.waves.length - 1)];
  const eliteMul = stage.kind === 'boss' ? 1.1 : stage.kind === 'elite' ? 1.05 : 1;
  return w.enemies.map((e) => ({
    heroId: e.unit,
    level: e.level,
    star: HERO_BY_ID[e.unit] ? (e.level < 20 ? 1 : e.level < 40 ? 2 : 3) : 1,
    awaken: 'A' as const,
    skillLv: HERO_BY_ID[e.unit] ? (e.level < 20 ? 1 : e.level < 40 ? 2 : 3) : 1,
    pos: e.pos,
    statMul: eliteMul * (e.mods?.includes('elite') ? 1.15 : 1),
    hpMul: e.hpMul,
  }));
}

const catnipOf = (r: { items?: { id: string; count: number }[] }) => (r.items ?? []).filter((i) => i.id.startsWith('catnip')).reduce((a, i) => a + i.count, 0);

// ---------- 奖励与挂机 ----------
export interface Gain { fish: number; catnip: number; exp: number; bells: number }
export const WIN_SHARE = 0.1; // 画面里每场胜利拿到整关奖励的 10%

export function winReward(stage: StageDef): Gain {
  return { fish: Math.round((stage.rewards.fish ?? 0) * WIN_SHARE), catnip: 0, exp: Math.round((stage.rewards.exp ?? 0) * WIN_SHARE), bells: 0 };
}
export function firstClearReward(stage: StageDef): Gain {
  const fc = stage.firstClear;
  return { fish: fc.fish ?? 0, catnip: catnipOf(fc), exp: fc.exp ?? 0, bells: fc.bells ?? 0 };
}
export const EXP_PER_LEVEL = (lv: number) => 120 + lv * 80;

export function applyGain(s: PlayerState, g: Gain) {
  s.res.fish += g.fish;
  s.res.catnip = Math.round((s.res.catnip + g.catnip) * 10) / 10;
  s.res.bells += g.bells;
  s.res.exp += g.exp;
  s.exp += g.exp;
  while (s.exp >= EXP_PER_LEVEL(s.level)) {
    s.exp -= EXP_PER_LEVEL(s.level);
    s.level++;
  }
}


/** 挂机速率（每分钟）：沿用 content/progression 的口径，按“两分钟完成一次关卡”折算 */
export function idleRate(s: PlayerState): { fish: number; exp: number } {
  const st = getStage(s.stage.chapter, s.stage.index);
  if (!st) return { fish: 0, exp: 0 };
  const r = contentIdleRate(st.id);
  const k = 1 + vipPerks(vipLevel(s)).idleRate; // VIP 加成
  return { fish: Math.round(r.fish * k), exp: Math.round(r.exp * k) };
}
export const idleCapHours = (s: PlayerState) => idleCap(Math.min(80, s.level)) + vipPerks(vipLevel(s)).idleCapHours;

export function tickIdle(s: PlayerState, now = Date.now()) {
  const dtMin = Math.max(0, (now - s.idle.last) / 60000);
  const capMin = idleCapHours(s) * 60;
  const r = idleRate(s);
  s.idle.fish = Math.min(r.fish * capMin, s.idle.fish + r.fish * dtMin);
  s.idle.exp = Math.min(r.exp * capMin, s.idle.exp + r.exp * dtMin);
  s.idle.last = now;
}
export function claimIdle(s: PlayerState): { fish: number; exp: number } {
  const got = { fish: Math.floor(s.idle.fish), exp: Math.floor(s.idle.exp) };
  s.res.fish += got.fish;
  s.res.exp += got.exp;
  s.idle.fish = 0;
  s.idle.exp = 0;
  if (got.fish > 0 || got.exp > 0) track(s, 'claim_idle');
  return got;
}
export type { Resources };
