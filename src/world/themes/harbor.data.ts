// 赤壁港（第 3 章，晚霞）的布局数据：北面是海（落日正对着海面），三座木栈桥伸进海里，南面是码头仓库、酒肆、灯塔、货堆。
// 海是碰撞盒（栈桥处留口），所以只能沿栈桥走到海上——钓鱼点在东栈桥尽头，首领守在中央栈桥的战船前。
import type { AABB, LevelDef } from '../levels';

export const SEA_Z = -9.5; // 海岸线：z < SEA_Z 是海
export const PIERS = [
  { x: -18, w: 6, end: -24 }, // 西栈桥
  { x: 0, w: 8, end: -27 }, // 中央栈桥（战船码头）
  { x: 18, w: 6, end: -22 }, // 东栈桥（钓鱼点）
];
export const WAREHOUSES = [{ x: -17, z: 24, w: 14, d: 9 }, { x: 17, z: 24, w: 14, d: 9 }];
export const TAVERN = { x: -22, z: 4, w: 8.6, d: 7 };
export const TEAHOUSE = { x: 22.5, z: 3, w: 8.6, d: 7 };
export const LIGHTHOUSE: [number, number] = [27, -6];
export const CRATES: [number, number][] = [[-8, -4], [9, -2], [-13, 14], [13, 15]];
const POI: [number, number] = [18, -19];
const ARROW_POI: [number, number] = [-18, -20]; // 西栈桥尽头：草船借箭
const SPAWN: [number, number] = [0, 18];
const ENEMIES: [number, number][] = [[-12, 5], [11, 3], [-3, -3], [-23, -3], [23, 14], [-23, 16]];
const CHESTS: [number, number][] = [[-28, -5], [14, -7], [-27, 24], [27, 26]];
const HERBS: [number, number][] = [[-7, 10], [8, 9], [3, -5], [-14, -2], [14, -5]];
const NPC: [number, number] = [6, 15];
const BOSS: [number, number] = [0, -21];

export function harborSolids(): AABB[] {
  const s: AABB[] = [];
  const half = 32, ps = PIERS;
  // 海：栈桥之间的水面 + 栈桥尽头之外
  let x = -half;
  for (const p of ps) { if (p.x - p.w / 2 > x) s.push({ x0: x, x1: p.x - p.w / 2, z0: -half - 2, z1: SEA_Z }); x = p.x + p.w / 2; s.push({ x0: p.x - p.w / 2, x1: p.x + p.w / 2, z0: -half - 2, z1: p.end }); }
  if (x < half) s.push({ x0: x, x1: half, z0: -half - 2, z1: SEA_Z });
  for (const w of WAREHOUSES) s.push({ x0: w.x - w.w / 2 - 0.3, x1: w.x + w.w / 2 + 0.3, z0: w.z - w.d / 2 - 0.3, z1: w.z + w.d / 2 + 0.3 });
  for (const b of [TAVERN, TEAHOUSE]) s.push({ x0: b.x - b.w / 2 - 0.3, x1: b.x + b.w / 2 + 0.3, z0: b.z - b.d / 2 - 0.3, z1: b.z + b.d / 2 + 0.3 });
  s.push({ x0: LIGHTHOUSE[0] - 1.8, x1: LIGHTHOUSE[0] + 1.8, z0: LIGHTHOUSE[1] - 1.8, z1: LIGHTHOUSE[1] + 1.8 });
  for (const [cx, cz] of CRATES) s.push({ x0: cx - 1.4, x1: cx + 1.4, z0: cz - 1.1, z1: cz + 1.1 });
  return s;
}

export function harborLevel(): LevelDef {
  return {
    id: 'redcliff-harbor', chapter: 3, name: '赤壁港', mood: 'redcliff', half: 32, theme: 'harbor', weather: 'none',
    buildings: [], poles: [], props: [], lamps: [], cones: [], arches: [], lanterns: [], tram: false, vents: [[TAVERN.x + 2, 3.2, TAVERN.z + 4.5], [TEAHOUSE.x - 2, 3.2, TEAHOUSE.z + 4.5]],
    glows: [[0, 6, '#ff9a4a', 22], [PIERS[1].x, -18, '#ff7a3a', 18], [POI[0], POI[1], '#ffd070', 14]],
    lights: [[0, 5, 8, 0xff9a50, 60, 22], [-18, 4, -14, 0xffa860, 50, 18], [18, 4, -14, 0xffa860, 50, 18], [0, 5, -20, 0xff7a40, 60, 20]],
    water: [-32, -34, 32, SEA_Z],
    solids: harborSolids(),
    enemySpots: ENEMIES, chestSpots: CHESTS, herbSpots: HERBS,
    pois: [{ id: 'fish', game: 'fish', x: POI[0], z: POI[1], label: '钓鱼点' }, { id: 'arrows', game: 'arrows', x: ARROW_POI[0], z: ARROW_POI[1], label: '草船借箭' }],
    bossSpot: BOSS, npcSpot: NPC, spawn: SPAWN,
  };
}
