import { describe, expect, it } from 'vitest';
import { KILL_CAP, TRAIL, autoKey, killsLeft, pickAutoTarget, bossStage, claimTrail, totals, trailRows, claimDaily, dailyProgress, dailyReady, ensureExplore, farmStage, killReward, openChest, pickHerb, recordBossWin, spawnPlan } from '../src/game/explore';
import { LEVELS, herbsOf, levelColliders } from '../src/world/levels';
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
      const pts: [string, number, number][] = [...L.enemySpots.map((p, i) => [`e${i}`, p[0], p[1]] as [string, number, number]), ...L.chestSpots.map((p, i) => [`c${i}`, p[0], p[1]] as [string, number, number]), ...herbsOf(L).map((p, i) => [`h${i}`, p[0], p[1]] as [string, number, number]), ['boss', L.bossSpot[0], L.bossSpot[1]], ['npc', L.npcSpot[0], L.npcSpot[1]], ['spawn', L.spawn[0], L.spawn[1]]];
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

describe('猫薄荷丛', () => {
  it('每天每丛一次，给猫薄荷，隔天刷新；不算进宝箱委托', () => {
    const s = newPlayer();
    const t0 = Date.UTC(2026, 9, 11, 12);
    const g = pickHerb(s, 'h0', t0)!;
    expect(g.catnip).toBeGreaterThanOrEqual(3);
    expect(pickHerb(s, 'h0', t0)).toBeNull();
    expect(pickHerb(s, 'h1', t0)).not.toBeNull();
    expect(dailyProgress(s, t0)[1].have).toBe(0);
    expect(pickHerb(s, 'h0', t0 + 86400_000)).not.toBeNull();
  });
  it('地图上有 3 丛猫薄荷，id 不与别的实体重复', () => {
    const plan = spawnPlan(newPlayer());
    expect(plan.filter((p) => p.kind === 'herb')).toHaveLength(3);
    expect(new Set(plan.map((p) => p.id)).size).toBe(plan.length);
  });
});

describe('探索足迹（长期累计）', () => {
  it('累计数据随击杀 / 宝箱 / 猫薄荷 / 首领增加，不受每日上限影响，隔天不清零', () => {
    const s = newPlayer();
    const st = farmStage(s).stage;
    for (let i = 0; i < KILL_CAP + 5; i++) killReward(s, st);
    expect(totals(s).kills).toBe(KILL_CAP + 5);
    openChest(s, 'c0'); pickHerb(s, 'h0'); recordBossWin(s);
    expect(totals(s)).toMatchObject({ chests: 1, herbs: 1, bosses: 1 });
    openChest(s, 'c0');
    expect(totals(s).chests).toBe(1);
    ensureExplore(s, Date.now() + 2 * 86400_000);
    expect(totals(s).kills).toBe(KILL_CAP + 5);
  });
  it('足迹奖励够数才能领，只能领一次', () => {
    const s = newPlayer();
    expect(claimTrail(s, 'k20')).toBeNull();
    totals(s).kills = 25;
    expect(trailRows(s).find((r) => r.id === 'k20')!.ready).toBe(true);
    const g = claimTrail(s, 'k20')!;
    expect(g.fish).toBeGreaterThan(0);
    expect(claimTrail(s, 'k20')).toBeNull();
    expect(trailRows(s).find((r) => r.id === 'k20')!.claimed).toBe(true);
    expect(claimTrail(s, 'nope')).toBeNull();
  });
  it('里程碑 id 唯一，同类目标越来越大、奖励越来越多', () => {
    expect(new Set(TRAIL.map((m) => m.id)).size).toBe(TRAIL.length);
    for (const stat of ['kills', 'chests', 'herbs', 'bosses'] as const) {
      const ms = TRAIL.filter((m) => m.stat === stat);
      expect(ms.length).toBeGreaterThanOrEqual(3);
      for (let i = 1; i < ms.length; i++) { expect(ms[i].need).toBeGreaterThan(ms[i - 1].need); expect(ms[i].reward.fish).toBeGreaterThan(ms[i - 1].reward.fish); }
    }
  });
});

describe('自动探索选目标', () => {
  const ents = [
    { kind: 'enemy' as const, x: 3, z: 0 }, { kind: 'boss' as const, x: 0, z: -100 }, { kind: 'npc' as const, x: 0.5, z: 0 },
    { kind: 'chest' as const, x: 20, z: 0 }, { kind: 'herb' as const, x: 10, z: 0 },
  ];
  it('先捡最近的猫薄荷 / 宝箱，再找野猫；首领和嫦喵永远不去', () => {
    expect(pickAutoTarget({ x: 0, z: 0 }, ents, true)).toMatchObject({ kind: 'herb' });
    expect(pickAutoTarget({ x: 0, z: 0 }, ents.filter((e) => e.kind !== 'herb'), true)).toMatchObject({ kind: 'chest' });
    expect(pickAutoTarget({ x: 0, z: 0 }, ents.filter((e) => e.kind === 'enemy' || e.kind === 'boss' || e.kind === 'npc'), true)).toMatchObject({ kind: 'enemy' });
    expect(pickAutoTarget({ x: 0, z: 0 }, ents.filter((e) => e.kind === 'boss' || e.kind === 'npc'), true)).toBeNull();
  });
  it('每日野怪奖励拿满后不再主动找野猫，但仍会去采集', () => {
    expect(pickAutoTarget({ x: 0, z: 0 }, ents.filter((e) => e.kind === 'enemy'), false)).toBeNull();
    expect(pickAutoTarget({ x: 0, z: 0 }, ents, false)).toMatchObject({ kind: 'herb' });
  });
  it('靠近首领的宝箱 / 野猫不自动去，免得误打首领', () => {
    const near = [{ kind: 'boss' as const, x: 0, z: -23 }, { kind: 'chest' as const, x: -2.5, z: -26 }, { kind: 'enemy' as const, x: 4, z: -20 }];
    expect(pickAutoTarget({ x: 0, z: 0 }, near, true)).toBeNull();
    expect(pickAutoTarget({ x: 0, z: 0 }, [...near, { kind: 'herb' as const, x: -2.4, z: -9 }], true)).toMatchObject({ kind: 'herb' });
  });
  it('走不到的点（skip 里的）会被跳过，转去下一个目标', () => {
    const list = [{ kind: 'herb' as const, x: 5, z: 0 }, { kind: 'chest' as const, x: 20, z: 0 }];
    expect(pickAutoTarget({ x: 0, z: 0 }, list, true, new Set([autoKey(list[0])]))).toMatchObject({ kind: 'chest' });
    expect(pickAutoTarget({ x: 0, z: 0 }, list, true, new Set(list.map(autoKey)))).toBeNull();
  });
  it('killsLeft 跟着每日上限走', () => {
    const s = newPlayer();
    expect(killsLeft(s)).toBe(true);
    const st = farmStage(s).stage;
    for (let i = 0; i < KILL_CAP; i++) killReward(s, st);
    expect(killsLeft(s)).toBe(false);
  });
});
