import { describe, expect, it } from 'vitest';
import { KILL_CAP, bossStage, ensureExplore, farmStage, killReward, openChest, spawnPlan } from '../src/game/explore';
import { streetColliders } from '../src/world/street';
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
  it('所有实体都摆在可走的格子上（不在建筑 / 道具碰撞盒里）', () => {
    const st = { colliders: streetColliders(), half: 32 };
    for (const p of spawnPlan(newPlayer(1))) {
      for (const c of st.colliders) expect(p.x >= c.x0 && p.x <= c.x1 && p.z >= c.z0 && p.z <= c.z1, `${p.id} 在碰撞盒里`).toBe(false);
      expect(Math.abs(p.x)).toBeLessThan(st.half - 2); expect(Math.abs(p.z)).toBeLessThan(st.half - 2);
    }
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
