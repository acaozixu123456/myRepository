import { describe, expect, it } from 'vitest';
import { KILL_CAP, bossStage, ensureExplore, farmStage, killReward, openChest, spawnPlan } from '../src/game/explore';
import { LEVELS, levelColliders } from '../src/world/levels';
import { newPlayer } from '../src/game/state';

describe('探索模式规则', () => {
  it('首领是下一关，野怪是当前关', () => {
    const s = newPlayer(1);
    const b = bossStage(s), f = farmStage(s);
    expect(b.fresh).toBe(true);
    expect(`${b.chapter}-${b.index}`).not.toBe(`${f.chapter}-${f.index}`);
    expect(b.stage).toBeTruthy(); expect(f.stage).toBeTruthy();
  });
  it('地图实体：1 个首领、6 只野怪、4 个宝箱、1 个向导；id 唯一', () => {
    const plan = spawnPlan(newPlayer(1));
    expect(plan.filter((p) => p.kind === 'boss')).toHaveLength(1);
    expect(plan.filter((p) => p.kind === 'enemy')).toHaveLength(6);
    expect(plan.filter((p) => p.kind === 'chest')).toHaveLength(4);
    expect(new Set(plan.map((p) => p.id)).size).toBe(plan.length);
    for (const p of plan) if (p.kind === 'enemy' || p.kind === 'boss') expect(p.units?.length).toBeGreaterThan(0);
  });
  it('每个关卡的实体都摆在可走的格子上（不在建筑 / 道具碰撞盒里），且出生点可走', () => {
    for (const L of Object.values(LEVELS)) {
      const cols = levelColliders(L);
      const pts: [string, number, number][] = [...L.enemySpots.map((p, i) => [`e${i}`, p[0], p[1]] as [string, number, number]), ...L.chestSpots.map((p, i) => [`c${i}`, p[0], p[1]] as [string, number, number]), ['boss', L.bossSpot[0], L.bossSpot[1]], ['npc', L.npcSpot[0], L.npcSpot[1]], ['spawn', L.spawn[0], L.spawn[1]]];
      for (const [id, x, z] of pts) {
        for (const c of cols) expect(x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1, `${L.id}:${id} 在碰撞盒里`).toBe(false);
        expect(Math.abs(x)).toBeLessThan(L.half - 2); expect(Math.abs(z)).toBeLessThan(L.half - 2);
      }
    }
  });
  it('六章都有关卡，章节与名字对得上', () => {
    for (let c = 1; c <= 6; c++) { expect(LEVELS[c]).toBeTruthy(); expect(LEVELS[c].chapter).toBe(c); expect(LEVELS[c].name.length).toBeGreaterThan(1); }
  });
  it('野怪奖励每天有上限，宝箱每天每个一次，隔天刷新', () => {
    const s = newPlayer(1);
    const st = farmStage(s).stage;
    let got = 0;
    for (let i = 0; i < KILL_CAP + 5; i++) if (killReward(s, st)) got++;
    expect(got).toBe(KILL_CAP);
    expect(openChest(s, 'c0')).toBeTruthy();
    expect(openChest(s, 'c0')).toBeNull();
    const e = ensureExplore(s, Date.now() + 86400_000 * 1.2);
    expect(e.kills).toBe(0); expect(e.chests).toEqual([]);
  });
});
