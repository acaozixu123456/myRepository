// 霓虹森林（第 4 章）的布局数据（纯数据，无 three）：蜿蜒的小径 + 一条小溪（只有一座木桥能过）+ 发光巨树林 + 营地 + 蘑菇圈 + 古老石门 + 母树空地。
// 渲染（themes/forest.ts）和寻路（碰撞盒）都从这里来，布局改了两边一起变。
import { mulberry } from '../../fx/util';
import type { AABB, LevelDef } from '../levels';

export const FOREST_PATH: [number, number][] = [[0, 27], [-3, 19], [-3, 10.5], [3, 4], [8, -4], [3, -12], [-6, -18], [0, -24]];
/** 小溪（东西向）：z 在 [STREAM_Z0, STREAM_Z1]，桥在 x ∈ BRIDGE_X */
export const STREAM = { z0: 8.5, z1: 12.5 };
export const BRIDGE_X: [number, number] = [-5.6, -0.6];
export const CAMP: [number, number] = [6, 22];
export const MUSH_RING: [number, number] = [-17, 3];
export const RUINS: [number, number] = [14, -8];
export const TREEHOUSE: [number, number, number] = [-23, -13, 2.0]; // x z 树干半径
export const MOTHER_TREE: [number, number] = [0, -33];

const SPAWN: [number, number] = [0, 26];
const ENEMIES: [number, number][] = [[-12, 19], [14, 18], [12, 1], [-11, -10], [14, -16], [-9, -19]];
const CHESTS: [number, number][] = [[24, 16], [-25, 17], [25, -25], [-24, -26]];
const HERBS: [number, number][] = [[-7, 22], [8, 14.5], [-10, -1], [18, -2], [4, -9]];
const NPC: [number, number] = [CAMP[0] - 2.5, CAMP[1] - 2];
const BOSS: [number, number] = [0, -23];
const KEEP: [number, number][] = [SPAWN, ...ENEMIES, ...CHESTS, ...HERBS, NPC, BOSS, MUSH_RING, CAMP, RUINS, [TREEHOUSE[0], TREEHOUSE[1]]];

const segDist = (px: number, pz: number, a: [number, number], b: [number, number]) => {
  const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / l2));
  return Math.hypot(px - (a[0] + dx * t), pz - (a[1] + dz * t));
};
export const distToPath = (x: number, z: number) => Math.min(...FOREST_PATH.slice(0, -1).map((a, i) => segDist(x, z, a, FOREST_PATH[i + 1])));

/** 发光树：[x, z, 缩放, 种子, 颜色]。避开小径、溪流、所有玩法点；外圈加密成林墙 */
export function forestTrees(): [number, number, number, number, string][] {
  const out: [number, number, number, number, string][] = [];
  const cols = ['#4fe08a', '#7ff0ff', '#b0ff6a', '#ff7ad9'];
  const rnd = mulberry(404);
  let k = 0;
  for (let gx = -29; gx <= 29; gx += 4.6) for (let gz = -29; gz <= 29; gz += 4.6) {
    k++;
    const x = gx + (rnd() - 0.5) * 3.2, z = gz + (rnd() - 0.5) * 3.2;
    const edge = Math.max(Math.abs(x), Math.abs(z)) > 23;
    if (!edge && rnd() < 0.55) continue; // 内圈疏一点，留出林间空地
    if (distToPath(x, z) < (edge ? 3.4 : 5.2)) continue;
    if (z > STREAM.z0 - 3 && z < STREAM.z1 + 3) continue;
    if (KEEP.some(([sx, sz]) => Math.hypot(sx - x, sz - z) < 5.6)) continue;
    if (Math.hypot(x - MUSH_RING[0], z - MUSH_RING[1]) < 9.5) continue;
    if (Math.hypot(x - MOTHER_TREE[0], z - (MOTHER_TREE[1] + 8)) < 8) continue;
    out.push([+x.toFixed(1), +z.toFixed(1), +(0.8 + rnd() * 0.55 + (edge ? 0.15 : 0)).toFixed(2), k, cols[k % cols.length]]);
  }
  return out;
}
/** 蘑菇（装饰，不挡路）：沿小径两侧与蘑菇圈周围 */
export function forestMushrooms(): [number, number, number, string][] {
  const out: [number, number, number, string][] = [];
  const cols = ['#ff7ad9', '#7ff0ff', '#ffe27a', '#b0ff6a'];
  const rnd = mulberry(77);
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; out.push([MUSH_RING[0] + Math.cos(a) * 6.4, MUSH_RING[1] + Math.sin(a) * 6.4, 1.3 + (i % 3) * 0.35, cols[i % 4]]); }
  for (let i = 0; i < 26; i++) {
    const a = FOREST_PATH[i % (FOREST_PATH.length - 1)], b = FOREST_PATH[(i % (FOREST_PATH.length - 1)) + 1];
    const t = rnd(), x = a[0] + (b[0] - a[0]) * t + (rnd() < 0.5 ? -1 : 1) * (2.3 + rnd() * 2.2), z = a[1] + (b[1] - a[1]) * t + (rnd() - 0.5) * 2;
    if (z > STREAM.z0 - 0.5 && z < STREAM.z1 + 0.5) continue;
    out.push([+x.toFixed(1), +z.toFixed(1), 0.6 + rnd() * 0.5, cols[i % 4]]);
  }
  return out;
}

export function forestSolids(): AABB[] {
  const s: AABB[] = [];
  for (const [x, z, sc] of forestTrees()) { const r = 0.72 * sc + 0.15; s.push({ x0: x - r, x1: x + r, z0: z - r, z1: z + r }); }
  const half = 32;
  s.push({ x0: -half, x1: BRIDGE_X[0], z0: STREAM.z0, z1: STREAM.z1 }, { x0: BRIDGE_X[1], x1: half, z0: STREAM.z0, z1: STREAM.z1 }); // 小溪（桥处留口）
  const [tx, tz, tr] = TREEHOUSE; s.push({ x0: tx - tr, x1: tx + tr, z0: tz - tr, z1: tz + tr });
  s.push({ x0: RUINS[0] - 4.6, x1: RUINS[0] - 3.6, z0: RUINS[1] - 0.5, z1: RUINS[1] + 0.5 }, { x0: RUINS[0] + 3.6, x1: RUINS[0] + 4.6, z0: RUINS[1] - 0.5, z1: RUINS[1] + 0.5 }); // 石门两柱
  s.push({ x0: MOTHER_TREE[0] - 4.5, x1: MOTHER_TREE[0] + 4.5, z0: MOTHER_TREE[1] - 4.5, z1: MOTHER_TREE[1] + 4.5 }); // 母树（在地图外缘）
  s.push({ x0: CAMP[0] + 1.6, x1: CAMP[0] + 4.2, z0: CAMP[1] - 1.4, z1: CAMP[1] + 1.4 }); // 帐篷
  return s;
}

export function forestLevel(): LevelDef {
  return {
    id: 'neon-forest', chapter: 4, name: '霓虹森林', mood: 'forest', half: 32, theme: 'forest', weather: 'none',
    buildings: [], poles: [], props: [], lamps: [], cones: [], arches: [], lanterns: [], tram: false, vents: [],
    glows: [[0, 18, '#4fe08a', 20], [MUSH_RING[0], MUSH_RING[1], '#ff7ad9', 18], [BOSS[0], BOSS[1], '#7ff0ff', 22]],
    lights: [[0, 6, 20, 0x4fe08a, 70, 24], [MUSH_RING[0], 4, MUSH_RING[1], 0xff7ad9, 60, 20], [RUINS[0], 4, RUINS[1], 0x7ff0ff, 60, 20], [BOSS[0], 5, BOSS[1] + 3, 0xb0ff6a, 70, 22]],
    solids: forestSolids(), trees: forestTrees(), mushrooms: forestMushrooms(),
    enemySpots: ENEMIES, chestSpots: CHESTS, herbSpots: HERBS,
    pois: [{ id: 'mushroom', game: 'mushroom', x: MUSH_RING[0], z: MUSH_RING[1], label: '蘑菇地' }],
    bossSpot: BOSS, npcSpot: NPC, spawn: SPAWN,
  };
}
