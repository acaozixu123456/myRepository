// 喵雪岭（附加场景，不在主线章节里）的布局数据（纯数据，无 three）：
// 西北一座大雪坡（坡脚是雪橇出发点），东边一片空雪地（叠雪猫），东北冒热气的温泉，西南小木屋，西边一汪结冰的湖，北面雪中神社。
// 渲染（themes/snow.ts）和寻路（碰撞盒）都从这里来。
import type { AABB, LevelDef } from '../levels';

/** 大雪坡：[x, z, 半宽] 圆锥山（整座挡路） */
export const HILL: [number, number, number] = [-22, -25, 8];
export const SLED_POI: [number, number] = [-14, -12];
export const SNOWCAT_POI: [number, number] = [17, 5];
/** 温泉：[x, z, 半径]（水面挡路，围一圈石头） */
export const SPRING: [number, number, number] = [21, -17, 3.6];
export const CABIN: [number, number] = [-16, 18];
/** 冰湖（可以走上去，只是装饰）[x, z, 半轴 x, 半轴 z] */
export const LAKE: [number, number, number, number] = [-22, 3, 6, 4];
export const SHRINE: [number, number] = [0, -29];

const SPAWN: [number, number] = [0, 26];
const BOSS: [number, number] = [0, -21];
const NPC: [number, number] = [CABIN[0] + 4.5, CABIN[1] + 3.5];
const ENEMIES: [number, number][] = [[-6, 12], [10, 16], [6, -4], [-8, -2], [12, -25], [-4, -14]];
const CHESTS: [number, number][] = [[26, 22], [-27, 26], [28, -27], [-28, -8]];
const HERBS: [number, number][] = [[-4, 20], [12, -8], [-12, 8], [4, -14], [24, 13]];

/** 雪松 [x, z, 缩放]：避开小路和玩法点，外圈密一些 */
export const PINES: [number, number, number][] = [
  [-8, 22, 1.1], [8, 24, 1.0], [-27, 13, 1.3], [-24, 22, 1.2], [26, 4, 1.2], [27, 28, 1.1], [14, 25, 0.9],
  [-29, -18, 1.3], [-12, -27, 1.1], [10, -15, 1.0], [27, -8, 1.2], [6, 6, 0.9], [-10, -20, 1.0], [16, -28, 1.2],
  [-28, -1, 1.1], [29, 18, 1.0], [-2, 4, 0.8], [22, -30, 1.1],
];
/** 雪猫雪人（装饰，挡路）[x, z] */
export const SNOWMEN: [number, number][] = [[-3, 17], [5, 12], [9, -10]];

export function snowSolids(): AABB[] {
  const s: AABB[] = [];
  const [hx, hz, hr] = HILL; s.push({ x0: hx - hr * 0.8, x1: hx + hr * 0.8, z0: hz - hr * 0.8, z1: hz + hr * 0.8 });
  const [sx, sz, sr] = SPRING; s.push({ x0: sx - sr, x1: sx + sr, z0: sz - sr, z1: sz + sr });
  s.push({ x0: CABIN[0] - 2.6, x1: CABIN[0] + 2.6, z0: CABIN[1] - 2.2, z1: CABIN[1] + 2.2 });
  for (const [x, z, sc] of PINES) { const r = 0.5 * sc; s.push({ x0: x - r, x1: x + r, z0: z - r, z1: z + r }); }
  for (const [x, z] of SNOWMEN) s.push({ x0: x - 0.7, x1: x + 0.7, z0: z - 0.7, z1: z + 0.7 });
  s.push({ x0: SHRINE[0] - 5, x1: SHRINE[0] + 5, z0: SHRINE[1] - 3, z1: SHRINE[1] + 2.5 }); // 神社
  return s;
}

export function snowLevel(): LevelDef {
  return {
    id: 'meow-snowridge', chapter: 102, name: '喵雪岭', mood: 'snow', half: 32, theme: 'snow', weather: 'none',
    buildings: [], poles: [], props: [], lamps: [], cones: [], arches: [], lanterns: [], tram: false, vents: [],
    glows: [[SLED_POI[0], SLED_POI[1], '#9ad8ff', 16], [SNOWCAT_POI[0], SNOWCAT_POI[1], '#ffd0e8', 16], [SPRING[0], SPRING[1], '#ffe0b0', 14]],
    lights: [[SPRING[0], 4, SPRING[1], 0xffc890, 40, 16], [CABIN[0], 4, CABIN[1] + 3, 0xffb060, 50, 16]],
    solids: snowSolids(),
    enemySpots: ENEMIES, chestSpots: CHESTS, herbSpots: HERBS,
    pois: [
      { id: 'sled', game: 'sled', x: SLED_POI[0], z: SLED_POI[1], label: '雪坡 · 雪橇' },
      { id: 'snowcat', game: 'snowcat', x: SNOWCAT_POI[0], z: SNOWCAT_POI[1], label: '雪地 · 叠雪猫' },
    ],
    bossSpot: BOSS, npcSpot: NPC, spawn: SPAWN,
  };
}
