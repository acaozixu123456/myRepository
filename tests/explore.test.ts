import { describe, expect, it } from 'vitest';
import { KILL_CAP, bossStage, claimDaily, dailyProgress, dailyReady, ensureExplore, farmStage, killReward, openChest, recordBossWin, spawnPlan } from '../src/game/explore';
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

describe('嫦喵的每日委托', () => {
  it('三项都完成后才能领奖，每天只能领一次，隔天重置', () => {
    const s = newPlayer();
    const t0 = Date.UTC(2026, 9, 11, 12);
    expect(dailyReady(s, t0)).toBe(false);
    expect(claimDaily(s, t0)).toBeNull();
    const stage = farmStage(s).stage;
    for (let i = 0; i < 5; i++) { ensureExplore(s, t0); killReward(s, stage); }
    for (const id of ['c0', 'c1', 'c2']) openChest(s, id);
    expect(dailyProgress(s, t0).map((g) => g.done)).toEqual([true, true, false]);
    expect(claimDaily(s, t0)).toBeNull();
    recordBossWin(s, t0);
    expect(dailyReady(s, t0)).toBe(true);
    const g = claimDaily(s, t0)!;
    expect(g.fish).toBeGreaterThan(300);
    expect(g.bells).toBeGreaterThan(0);
    expect(claimDaily(s, t0)).toBeNull();
    const next = t0 + 86400_000;
    expect(dailyProgress(s, next).every((x) => x.have === 0)).toBe(true);
    expect(claimDaily(s, next)).toBeNull();
  });
  it('进度不会超过目标数', () => {
    const s = newPlayer();
    const stage = farmStage(s).stage;
    for (let i = 0; i < 12; i++) killReward(s, stage);
    expect(dailyProgress(s)[0]).toMatchObject({ have: 5, need: 5, done: true });
  });
});
