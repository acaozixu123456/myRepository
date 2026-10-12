import { describe, expect, it } from 'vitest';
import { ALL_SCENES, CELL, SAFE_R, herbsOf, inSafeZone, poisOf, reachableCells } from '../src/world/levels';
import type { LevelDef } from '../src/world/levels';
import { relocateOutOfSafe } from '../src/game/explore';

const spotsOf = (L: LevelDef): [string, number, number][] => [
  ['spawn', ...L.spawn], ['boss', ...L.bossSpot], ['npc', ...L.npcSpot],
  ...L.enemySpots.map((p, i) => [`enemy${i}`, ...relocateOutOfSafe(L, p[0], p[1])] as [string, number, number]), // 实际刷新位置（落进安全区的会被挪出来）
  ...L.chestSpots.map((p, i) => [`chest${i}`, ...p] as [string, number, number]),
  ...herbsOf(L).map((p, i) => [`herb${i}`, ...p] as [string, number, number]),
  ...poisOf(L).map((p) => [`poi:${p.id}`, p.x, p.z] as [string, number, number]),
];

// 十字街区（旧布局）靠「寻路终点吸附到最近可走格」兜底，只要求落点两格内有走得到的格子；
// 各主题场景（新布局）要求更严：落点本身就是走得到的格子。
describe.each(Object.values(ALL_SCENES))('关卡布局 $chapter $name', (L) => {
  const R = reachableCells(L);
  const themed = !!L.theme && L.theme !== 'street';
  const at = (x: number, z: number) => { const cx = Math.floor((x + L.half) / CELL), cz = Math.floor((z + L.half) / CELL); return cz * R.N + cx; };
  const near = (x: number, z: number, r: number) => { for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) { const cx = Math.floor((x + L.half) / CELL) + dx, cz = Math.floor((z + L.half) / CELL) + dz; if (cx >= 0 && cz >= 0 && cx < R.N && cz < R.N && R.seen[cz * R.N + cx]) return true; } return false; };
  it('出生点能走到所有刷怪点 / 宝箱 / 猫薄荷 / 玩法入口 / 首领 / 向导', () => {
    const bad = spotsOf(L).filter(([, x, z]) => (themed ? !R.seen[at(x, z)] : !near(x, z, 2))).map(([k]) => k);
    expect(bad).toEqual([]);
  });
  it('所有点都在地图内（主题场景还要求不压在碰撞盒里）', () => {
    for (const [k, x, z] of spotsOf(L)) { expect(Math.abs(x), k).toBeLessThan(L.half - 2); expect(Math.abs(z), k).toBeLessThan(L.half - 2); if (themed) expect(R.grid[at(x, z)], k).toBe(0); }
  });
  it('玩法入口的安全区里没有野猫 / 首领，出生点也不在别的入口里', () => {
    for (const [k, x, z] of spotsOf(L)) if (k.startsWith('enemy') || k === 'boss') expect(inSafeZone(L, x, z, SAFE_R - 0.5), k).toBe(false);
  });
  it('场景里走得到的面积够大（>= 28% 的格子）', () => {
    let n = 0; for (const v of R.seen) n += v;
    expect(n / (R.N * R.N)).toBeGreaterThan(0.28);
  });
});
