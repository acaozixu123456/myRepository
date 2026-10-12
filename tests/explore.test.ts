import { describe, expect, it } from 'vitest';
import { relocateOutOfSafe } from '../src/game/explore';
import { KILL_CAP, TRAIL, autoKey, killsLeft, pickAutoTarget, bossStage, claimTrail, totals, trailRows, claimDaily, dailyProgress, dailyReady, ensureExplore, farmStage, killReward, openChest, pickHerb, recordBossWin, spawnPlan } from '../src/game/explore';
import { COVER_R, LEVELS, PORTAL_R, portalSpotsOf, zonesOf, SAFE_R, coverSpotsOf, herbsOf, hiddenSpotsOf, inSafeZone, levelColliders, poisOf, reachableCells } from '../src/world/levels';
import { newPlayer } from '../src/game/state';
import { PROPS } from '../src/world/props';

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
    expect(plan.filter((p) => p.kind === 'chest' && !p.hidden)).toHaveLength(4);
    expect(plan.filter((p) => p.hidden)).toHaveLength(3);
    expect(new Set(plan.map((p) => p.id)).size).toBe(plan.length);
    for (const p of plan) if (p.kind === 'enemy' || p.kind === 'boss') expect(p.units?.length).toBeGreaterThan(0);
  });
  it('每个关卡的实体都摆在可走的格子上（不在建筑 / 道具碰撞盒里），且出生点可走', () => {
    for (const L of Object.values(LEVELS)) {
      const cols = levelColliders(L);
      const pts: [string, number, number][] = [...L.enemySpots.map((p, i) => [`e${i}`, p[0], p[1]] as [string, number, number]), ...L.chestSpots.map((p, i) => [`c${i}`, p[0], p[1]] as [string, number, number]), ...herbsOf(L).map((p, i) => [`h${i}`, p[0], p[1]] as [string, number, number]), ...poisOf(L).map((p) => [`poi-${p.id}`, p.x, p.z] as [string, number, number]), ['boss', L.bossSpot[0], L.bossSpot[1]], ['npc', L.npcSpot[0], L.npcSpot[1]], ['spawn', L.spawn[0], L.spawn[1]]];
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
    const t0 = Date.now(); // killReward / openChest 内部用真实时间，所以这里也用真实时间（写死日期会在跨天后失败）
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

describe('场景道具', () => {
  it('道具不在建筑里，种类都已注册', () => {
    for (const L of Object.values(LEVELS)) {
      for (const p of L.props) {
        expect(Object.keys(PROPS), `${L.id}:${p.kind} 未注册`).toContain(p.kind);
        for (const b of L.buildings) {
          const inside = Math.abs(p.x - b.x) < b.spec.w / 2 && Math.abs(p.z - b.z) < b.spec.d / 2;
          expect(inside, `${L.id}:${p.kind}(${p.x},${p.z}) 在楼 (${b.x},${b.z}) 里`).toBe(false);
        }
      }
    }
  });
});

describe('道路畅通', () => {
  it('第 1~3 章的道具不会摆在马路中间车道上挡路', () => {
    for (const L of [LEVELS[1], LEVELS[2], LEVELS[3]]) {
      for (const p of L.props) {
        const onRoad = Math.abs(p.x) < 3 || Math.abs(p.z) < 3; // 两条 9 宽的马路的中间车道（路边 1.5 允许摆自动贩卖机之类）
        expect(onRoad, `${L.id}:${p.kind}(${p.x},${p.z}) 摆在马路上`).toBe(false);
      }
    }
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
    for (const stat of ['kills', 'chests', 'herbs', 'bosses', 'fish', 'ramen', 'found', 'mush', 'chime', 'lantern'] as const) {
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

describe('场景玩法入口（POI）', () => {
  it('赤壁港有钓鱼点，会出现在刷新计划里；没有水的场景没有钓鱼点', () => {
    expect(poisOf(LEVELS[3]).map((p) => p.game)).toContain('fish');
    for (const L of Object.values(LEVELS)) if (!L.water) expect(poisOf(L).some((p) => p.game === 'fish'), `${L.id} 没水却有钓鱼点`).toBe(false);
    const s = newPlayer(); s.best = { chapter: 3, index: 1 };
    const plan = spawnPlan(s);
    expect(plan.filter((p) => p.kind === 'poi' && p.game === 'fish')).toHaveLength(1);
    expect(new Set(plan.map((p) => p.id)).size).toBe(plan.length);
  });
  it('喵洲夜市有拉面屋台（在主街西侧摊位排的空档里，离招财猫广场不远）', () => {
    expect(poisOf(LEVELS[2]).map((p) => p.game)).toContain('ramen');
    const p = poisOf(LEVELS[2]).find((q) => q.game === 'ramen')!;
    expect(Math.abs(Math.abs(p.x) - 9.6)).toBeLessThan(1.5); // 摊位排上
    expect(Math.hypot(p.x, p.z)).toBeLessThan(14);
  });
  it('纸箱街有纸箱寻猫入口', () => { expect(poisOf(LEVELS[1]).map((p) => p.game)).toContain('boxcat'); });
  it('光之森有蘑菇地入口', () => { expect(poisOf(LEVELS[4]).map((p) => p.game)).toContain('mushroom'); });
  it('云端雾岛有风铃架入口', () => { expect(poisOf(LEVELS[5]).map((p) => p.game)).toContain('windchime'); });
  it('九重宫阙有宫灯阵入口，六章都有各自的玩法', () => { expect(poisOf(LEVELS[6]).map((p) => p.game)).toContain('lanterns'); for (let c = 1; c <= 6; c++) expect(poisOf(LEVELS[c]).length, `第 ${c} 章没有玩法入口`).toBeGreaterThan(0); });
  it('钓鱼点贴着水边，离水不超过 3 个单位', () => {
    for (const L of Object.values(LEVELS)) for (const p of poisOf(L)) if (p.game === 'fish' && L.water) {
      const [x0, z0, x1, z1] = L.water;
      const dz = Math.max(z0 - p.z, 0, p.z - z1), dx = Math.max(x0 - p.x, 0, p.x - x1);
      expect(Math.hypot(dx, dz), `${L.id} 钓鱼点离水太远`).toBeLessThanOrEqual(3);
    }
  });
});

describe('玩法入口安全区', () => {
  it('每章的野猫刷新点都在安全区外、不在建筑里、在地图内', () => {
    for (let ch = 1; ch <= 6; ch++) {
      const s = newPlayer(); s.best = { chapter: ch, index: 1 }; s.stage = { chapter: ch, index: 1, wins: 0 };
      const L = LEVELS[ch], cols = levelColliders(L);
      for (const p of spawnPlan(s).filter((q) => q.kind === 'enemy')) {
        expect(inSafeZone(L, p.x, p.z), `${L.id}:${p.id} 在安全区里`).toBe(false);
        expect(cols.some((c) => p.x >= c.x0 && p.x <= c.x1 && p.z >= c.z0 && p.z <= c.z1), `${L.id}:${p.id} 在建筑里`).toBe(false);
        expect(Math.abs(p.x)).toBeLessThan(L.half); expect(Math.abs(p.z)).toBeLessThan(L.half);
      }
    }
  });
  it('原本在区外的点不动，在区内的点被挪到区外的近处', () => {
    const L = LEVELS[1], poi = poisOf(L)[0];
    expect(relocateOutOfSafe(L, 25, 20)).toEqual([25, 20]);
    const [x, z] = relocateOutOfSafe(L, poi.x + 1, poi.z + 1);
    expect(Math.hypot(x - poi.x, z - poi.z)).toBeGreaterThanOrEqual(SAFE_R);
    expect(Math.hypot(x - poi.x, z - poi.z)).toBeLessThan(SAFE_R + 8);
  });
  it('入口本身、猫薄荷丛、宝箱都不会被野猫的刷新点占位（入口在安全区中心）', () => {
    for (const L of Object.values(LEVELS)) for (const p of poisOf(L)) expect(inSafeZone(L, p.x, p.z)).toBe(true);
  });
});

describe('场景切换', () => {
  it('默认跟主线进度；只能切到已解锁的场景；首领只在进度所在场景出现', async () => {
    const { newPlayer } = await import('../src/game/state');
    const { sceneChapter, setScene, unlockedScenes, explorerLevel, spawnPlan } = await import('../src/game/explore');
    const s = newPlayer(Date.now());
    expect(sceneChapter(s)).toBe(1);
    expect(unlockedScenes(s)).toEqual([1]);
    expect(setScene(s, 3)).toBe(false);
    s.best = { chapter: 3, index: 5 }; s.stage.chapter = 3;
    expect(unlockedScenes(s)).toEqual([1, 2, 3]);
    expect(sceneChapter(s)).toBe(3);
    expect(setScene(s, 1)).toBe(true);
    expect(sceneChapter(s)).toBe(1);
    expect(explorerLevel(s).chapter).toBe(1);
    expect(spawnPlan(s).some((p) => p.kind === 'boss')).toBe(false);
    expect(spawnPlan(s).some((p) => p.kind === 'poi' && p.game === 'boxcat')).toBe(true);
    expect(setScene(s, 3)).toBe(true);
    expect(spawnPlan(s).some((p) => p.kind === 'boss')).toBe(true);
    expect(setScene(s, 99)).toBe(false);
  });
});

describe('隐藏宝箱（灵视 / 死角）', () => {
  it('每个场景 3 个：走得到、不在碰撞盒里、不在安全区、彼此相隔 > 16；位置固定', () => {
    for (const L of Object.values(LEVELS)) {
      const spots = hiddenSpotsOf(L);
      expect(spots, L.id).toHaveLength(3);
      expect(hiddenSpotsOf(L)).toBe(spots);
      const { N, seen } = reachableCells(L);
      const cols = levelColliders(L);
      for (const [x, z] of spots) {
        expect(seen[Math.floor(z + L.half) * N + Math.floor(x + L.half)], `${L.id} 走不到 ${x},${z}`).toBe(1);
        for (const c of cols) expect(x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1, `${L.id} 在碰撞盒里`).toBe(false);
        expect(inSafeZone(L, x, z)).toBe(false);
      }
      for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) expect(Math.hypot(spots[i][0] - spots[j][0], spots[i][1] - spots[j][1])).toBeGreaterThan(16);
    }
  });
  it('隐藏宝箱的奖励是普通宝箱的两倍以上，且一定有猫薄荷和金铃铛', () => {
    const s = newPlayer();
    const a = openChest(s, 'c0')!, b = openChest(s, 'x0')!;
    expect(b.fish).toBeGreaterThanOrEqual(a.fish * 2 - 1);
    expect(b.catnip).toBeGreaterThan(0);
    expect(b.bells).toBeGreaterThan(0);
  });
});

describe('掩体（草丛 / 纸箱堆…）', () => {
  it('每个场景每只野怪附近一个：5.5~9.5 米、走得到、不在碰撞盒 / 安全区里，位置固定', () => {
    for (const L of Object.values(LEVELS)) {
      const spots = coverSpotsOf(L);
      expect(coverSpotsOf(L)).toBe(spots);
      expect(spots.length, L.id).toBeGreaterThanOrEqual(Math.floor(L.enemySpots.length * 0.6));
      const { N, seen } = reachableCells(L);
      const cols = levelColliders(L);
      for (const [x, z] of spots) {
        expect(seen[Math.floor(z + L.half) * N + Math.floor(x + L.half)], `${L.id} 走不到掩体`).toBe(1);
        for (const c of cols) expect(x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1, `${L.id} 掩体在碰撞盒里`).toBe(false);
        expect(inSafeZone(L, x, z)).toBe(false);
        expect(L.enemySpots.some(([ex, ez]) => { const d = Math.hypot(ex - x, ez - z); return d >= 5.5 && d <= 9.5; })).toBe(true);
      }
    }
    expect(COVER_R).toBeGreaterThan(2);
  });
});

describe('传送门', () => {
  it('每个场景一对：走得到、不在碰撞盒 / 安全区里、相距足够远，位置固定', () => {
    for (const L of Object.values(LEVELS)) {
      const spots = portalSpotsOf(L);
      expect(portalSpotsOf(L)).toBe(spots);
      expect(spots, L.id).toHaveLength(2);
      const { N, seen } = reachableCells(L);
      const cols = levelColliders(L);
      for (const [x, z] of spots) {
        expect(seen[Math.floor(z + L.half) * N + Math.floor(x + L.half)]).toBe(1);
        for (const c of cols) expect(x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1).toBe(false);
        expect(inSafeZone(L, x, z)).toBe(false);
      }
      expect(Math.hypot(spots[0][0] - spots[1][0], spots[0][1] - spots[1][1])).toBeGreaterThanOrEqual(18);
    }
    expect(PORTAL_R).toBeGreaterThan(1);
  });
});

describe('场景机关（风口 / 潮汐滩 / 琉璃滑地）', () => {
  it('云岛 = 风口、码头 = 潮汐滩、宫阙 = 滑地，各至少 3 处；其他场景没有；都走得到、不在碰撞盒 / 安全区里', () => {
    const want: Record<string, string | undefined> = { cloud: 'wind', harbor: 'tide', palace: 'slide' };
    for (const L of Object.values(LEVELS)) {
      const zs = zonesOf(L), kind = want[L.theme ?? 'street'];
      expect(zonesOf(L)).toBe(zs);
      if (!kind) { expect(zs, L.id).toHaveLength(0); continue; }
      expect(zs.length, L.id).toBeGreaterThanOrEqual(3);
      const { N, seen } = reachableCells(L);
      const cols = levelColliders(L);
      for (const z of zs) {
        expect(z.kind).toBe(kind);
        expect(Math.hypot(z.dx, z.dz)).toBeCloseTo(1, 5);
        expect(seen[Math.floor(z.z + L.half) * N + Math.floor(z.x + L.half)]).toBe(1);
        for (const c of cols) expect(z.x >= c.x0 && z.x <= c.x1 && z.z >= c.z0 && z.z <= c.z1).toBe(false);
        expect(inSafeZone(L, z.x, z.z)).toBe(false);
      }
    }
  });
});
