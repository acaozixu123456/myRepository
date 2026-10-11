// 关卡与战斗配置：把阵容、关卡数据转成引擎的 BattleConfig；结算奖励；挂机收益。
import { CHAPTERS } from '../content/campaign';
import type { StageDef } from '../content/types';
import { HERO_BY_ID } from '../data/heroes';
import type { UnitSetup } from '../engine/types';
import type { PlayerState, Resources } from './state';

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

/** 我方 UnitSetup（可带继承状态） */
export function lineupSetups(s: PlayerState, carry?: Record<string, { hpPct: number; energy: number }>): UnitSetup[] {
  const out: UnitSetup[] = [];
  s.lineup.forEach((id, pos) => {
    if (!id) return;
    const h = s.heroes[id];
    if (!h) return;
    const c = carry?.[id];
    out.push({ heroId: id, level: h.lv, star: h.star, awaken: h.awaken, skillLv: h.skillLv, pos, hpPct: c?.hpPct, energy: c?.energy });
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
    star: HERO_BY_ID[e.unit] ? 3 : 1,
    awaken: 'A' as const,
    skillLv: HERO_BY_ID[e.unit] ? 3 : 1,
    pos: e.pos,
    statMul: eliteMul * (e.mods?.includes('elite') ? 1.15 : 1),
  }));
}

const catnipOf = (r: { items?: { id: string; count: number }[] }) => (r.items ?? []).filter((i) => i.id.startsWith('catnip')).reduce((a, i) => a + i.count, 0);

// ---------- 奖励与挂机 ----------
export interface Gain { fish: number; catnip: number; exp: number; bells: number }

export function winReward(stage: StageDef): Gain {
  return { fish: Math.round((stage.rewards.fish ?? 0) * 0.3), catnip: Math.round(catnipOf(stage.rewards) * 0.3 * 10) / 10, exp: stage.rewards.exp ?? 0, bells: 0 };
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
  s.exp += g.exp;
  while (s.exp >= EXP_PER_LEVEL(s.level)) {
    s.exp -= EXP_PER_LEVEL(s.level);
    s.level++;
  }
}


/** 挂机速率（每分钟）：约等于每分钟 4 场胜利的完整关卡奖励 */
export function idleRate(s: PlayerState): { fish: number; catnip: number } {
  const st = getStage(s.stage.chapter, s.stage.index);
  if (!st) return { fish: 0, catnip: 0 };
  return { fish: (st.rewards.fish ?? 0) * 4, catnip: catnipOf(st.rewards) * 4 * 0.5 };
}
export const idleCapHours = (s: PlayerState) => 8 + Math.floor(s.level / 5);

export function tickIdle(s: PlayerState, now = Date.now()) {
  const dtMin = Math.max(0, (now - s.idle.last) / 60000);
  const capMin = idleCapHours(s) * 60;
  const r = idleRate(s);
  s.idle.fish = Math.min(r.fish * capMin, s.idle.fish + r.fish * dtMin);
  s.idle.catnip = Math.min(r.catnip * capMin, s.idle.catnip + r.catnip * dtMin);
  s.idle.last = now;
}
export function claimIdle(s: PlayerState): { fish: number; catnip: number } {
  const got = { fish: Math.floor(s.idle.fish), catnip: Math.floor(s.idle.catnip * 10) / 10 };
  s.res.fish += got.fish;
  s.res.catnip = Math.round((s.res.catnip + got.catnip) * 10) / 10;
  s.idle.fish = 0;
  s.idle.catnip = 0;
  return got;
}
export type { Resources };
