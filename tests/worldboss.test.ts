import { describe, expect, it } from 'vitest';
import { simulate } from '../src/engine/battle';
import { HERO_BY_ID } from '../src/data/heroes';
import { itemCount } from '../src/game/inventory';
import { NPCS } from '../src/game/npc';
import { lineupSetups, waveSetups } from '../src/game/stage';
import { newPlayer } from '../src/game/state';
import {
  ATTEMPTS_PER_DAY, BOSSES, MILESTONES, attemptReward, attemptsLeft, bossBoard, bossOfWeek, bossStage, claimMilestone, claimable, ensureBoss, finishAttempt, npcBars, startAttempt,
} from '../src/game/worldboss';

const at = (day: number, hour = 12) => new Date(2026, 9, 5 + day, hour).getTime(); // 2026-10-05 是周一

describe('世界 Boss', () => {
  it('六只 Boss 都是已登记的英雄，倍率为正，按周轮换且一周内不变', () => {
    expect(new Set(BOSSES.map((b) => b.hero)).size).toBe(6);
    for (const b of BOSSES) { expect(HERO_BY_ID[b.hero]).toBeTruthy(); expect(b.hpMul).toBeGreaterThan(0); }
    expect(bossOfWeek(at(0)).id).toBe(bossOfWeek(at(6)).id);
    expect(new Set(Array.from({ length: 6 }, (_, w) => bossOfWeek(at(7 * w)).id)).size).toBe(6);
  });
  it('每天 3 次，次日重置', () => {
    const s = newPlayer(0);
    for (let i = 0; i < ATTEMPTS_PER_DAY; i++) expect(startAttempt(s, at(0)).ok).toBe(true);
    expect(startAttempt(s, at(0)).ok).toBe(false);
    expect(attemptsLeft(s, at(1))).toBe(ATTEMPTS_PER_DAY);
  });
  it('结算累加伤害并发奖励，里程碑只能领一次，周一清零', () => {
    const s = newPlayer(0); const fish0 = s.res.fish;
    const r = finishAttempt(s, 0.5, at(0));
    expect(r.pct).toBe(0.5); expect(s.res.fish - fish0).toBe(r.fish); expect(itemCount(s, 'paw_seal')).toBe(r.paw);
    expect(attemptReward(s, 1).fish).toBeGreaterThan(attemptReward(s, 0).fish);
    expect(claimMilestone(s, 0, at(0)).ok).toBe(false);
    for (let i = 0; i < 4; i++) finishAttempt(s, 0.5, at(0));
    expect(claimable(s, at(0))).toEqual([true, true, false, false, false]);
    const bells = s.res.bells;
    expect(claimMilestone(s, 0, at(0)).ok).toBe(true);
    expect(s.res.bells - bells).toBe(MILESTONES[0].bells);
    expect(claimMilestone(s, 0, at(0)).ok).toBe(false);
    expect(ensureBoss(s, at(7)).bars).toBe(0);
    expect(ensureBoss(s, at(7)).claimed).toEqual([]);
    expect(finishAttempt(s, 9, at(7)).pct).toBe(1);
  });
  it('里程碑单调递增，高档才发招福符', () => {
    for (let i = 1; i < MILESTONES.length; i++) { expect(MILESTONES[i].bars).toBeGreaterThan(MILESTONES[i - 1].bars); expect(MILESTONES[i].bells).toBeGreaterThan(MILESTONES[i - 1].bells); }
    expect(MILESTONES.reduce((a, m) => a + m.tickets, 0)).toBeLessThanOrEqual(3);
  });
  it('Boss 关卡：单只巨型敌人，实际战斗中血量按倍率放大', () => {
    const s = newPlayer(0);
    const stage = bossStage(s, at(0));
    expect(stage.kind).toBe('boss'); expect(stage.waves[0].enemies).toHaveLength(1);
    const setups = waveSetups(stage, 0);
    expect(setups[0].hpMul).toBe(bossOfWeek(at(0)).hpMul);
    const normal = simulate({ seed: 1, A: lineupSetups(s), B: waveSetups({ ...stage, waves: [{ enemies: [{ ...stage.waves[0].enemies[0], hpMul: undefined }] }] }, 0) });
    const big = simulate({ seed: 1, A: lineupSetups(s), B: setups });
    expect(big.units.find((u) => u.side === 'B')!.maxHp).toBeGreaterThan(normal.units.find((u) => u.side === 'B')!.maxHp);
  });
  it('排行榜：模拟玩家贡献确定、随周内时间不降，且包含玩家', () => {
    for (const n of NPCS) { expect(npcBars(n.id, at(2))).toBe(npcBars(n.id, at(2))); expect(npcBars(n.id, at(5))).toBeGreaterThanOrEqual(npcBars(n.id, at(1))); }
    const s = newPlayer(0); finishAttempt(s, 0.3, at(2));
    const board = bossBoard(s, at(2));
    expect(board).toHaveLength(NPCS.length + 1);
    expect(board.find((r) => r.me)!.bars).toBeCloseTo(0.3);
    const week = NPCS.map((n) => npcBars(n.id, at(6, 23)));
    console.log('NPC week bars', Math.min(...week).toFixed(2), Math.max(...week).toFixed(2));
  });
});
