// 沙漠绿洲（附加场景，不在主线章节里）的布局数据（纯数据，无 three）：
// 西边一汪绿洲（棕榈 + 钓鱼点）、东边一圈卡丁车赛道（发车门 + 轮胎墙）、北边金字塔、仙人掌、风蚀石拱、沙丘与流沙。
// 渲染（themes/desert.ts）和寻路（碰撞盒）都从这里来。
import type { AABB, LevelDef } from '../levels';

/** 绿洲水面 [x0,z0,x1,z1] */
export const OASIS: [number, number, number, number] = [-26, -4, -15, 8];
/** 卡丁车赛道：椭圆环，中心 + 半轴；发车门在南侧（+z）中点 */
export const KART_TRACK = { cx: 20, cz: -9, rx: 9.5, rz: 6.5 };
export const KART_GATE: [number, number] = [KART_TRACK.cx, KART_TRACK.cz + KART_TRACK.rz];
export const PYRAMID = { x: 0, z: -31, half: 8 };
export const ARCH: [number, number] = [-9, -13]; // 风蚀石拱中心
export const CAMP: [number, number] = [-8, 20];

const SPAWN: [number, number] = [0, 26];
const BOSS: [number, number] = [0, -20];
const NPC: [number, number] = [CAMP[0] + 3, CAMP[1] - 1.5];
const ENEMIES: [number, number][] = [[-4, 10], [7, -12], [-14, -19], [8, 19], [27, -22], [-5, -5]];
const CHESTS: [number, number][] = [[27, 18], [-27, 22], [28, -14], [-28, -12]];
const HERBS: [number, number][] = [[-7, 26], [14, 23], [2, -5], [-21, 15], [17, -20]];
const FISH_POI: [number, number] = [-12.5, 2];
const KART_POI: [number, number] = [KART_GATE[0], KART_GATE[1] + 3.5];

/** 仙人掌 [x, z, 缩放]：既是装饰也是障碍 */
export const CACTI: [number, number, number][] = [[-10, -6, 1.2], [12, 12, 1.0], [-22, -14, 1.4], [14, -22, 1.1], [-3, 4, 0.9], [24, 10, 1.0], [-17, 26, 1.1], [5, -27, 1.3], [30, -4, 1.0], [-29, 4, 1.2]];
/** 棕榈 [x, z, 缩放]：绿洲岸边 */
export const PALMS: [number, number, number][] = [[-14, -5.6, 1.1], [-14.4, 9.6, 1.0], [-27.5, -5.5, 1.2], [-27.5, 9.5, 1.0], [-20, 10.6, 1.2], [-20.5, -6.2, 1.0], [-14.6, 4.4, 0.9]];
/** 沙丘 [x, z, 半宽, 高]：外圈的压在地图边上只露内坡（不盖住能走的地面），角上两座有碰撞 */
export const DUNES: [number, number, number, number][] = [[-22, -25, 4.5, 4], [24, -36, 7, 3.6], [-36, 34, 7, 3.2], [33, 27, 4, 3.4], [0, 44, 14, 3], [44, 0, 12, 3.6], [-44, 0, 12, 3.2]];

export function desertSolids(): AABB[] {
  const s: AABB[] = [];
  s.push({ x0: OASIS[0], z0: OASIS[1], x1: OASIS[2], z1: OASIS[3] });
  for (const [x, z, sc] of CACTI) { const r = 0.5 * sc + 0.1; s.push({ x0: x - r, x1: x + r, z0: z - r, z1: z + r }); }
  for (const [x, z, sc] of PALMS) { const r = 0.45 * sc; s.push({ x0: x - r, x1: x + r, z0: z - r, z1: z + r }); }
  s.push({ x0: PYRAMID.x - PYRAMID.half, x1: PYRAMID.x + PYRAMID.half, z0: PYRAMID.z - PYRAMID.half, z1: PYRAMID.z + PYRAMID.half - 1 });
  for (const sx of [-3, 3]) s.push({ x0: ARCH[0] + sx - 0.9, x1: ARCH[0] + sx + 0.9, z0: ARCH[1] - 0.9, z1: ARCH[1] + 0.9 }); // 石拱两柱
  s.push({ x0: CAMP[0] - 1.6, x1: CAMP[0] + 1.6, z0: CAMP[1] - 1.2, z1: CAMP[1] + 1.2 }); // 帐篷
  s.push({ x0: -26, x1: -18, z0: -29, z1: -21 }, { x0: 29, x1: 32, z0: 22, z1: 32 }); // 角上的沙丘
  return s;
}

export function desertLevel(): LevelDef {
  return {
    id: 'sun-oasis', chapter: 101, name: '日落绿洲', mood: 'desert', half: 32, theme: 'desert', weather: 'none', water: OASIS,
    buildings: [], poles: [], props: [], lamps: [], cones: [], arches: [], lanterns: [], tram: false, vents: [],
    glows: [[FISH_POI[0], FISH_POI[1], '#7ff0ff', 16], [KART_GATE[0], KART_GATE[1], '#ffb04a', 18]],
    lights: [[KART_GATE[0], 5, KART_GATE[1], 0xffb04a, 50, 20], [-20, 4, 2, 0x7ff0ff, 40, 20]],
    solids: desertSolids(),
    enemySpots: ENEMIES, chestSpots: CHESTS, herbSpots: HERBS,
    pois: [
      { id: 'kart', game: 'kart', x: KART_POI[0], z: KART_POI[1], label: '卡丁车赛道' },
      { id: 'fish', game: 'fish', x: FISH_POI[0], z: FISH_POI[1], label: '绿洲钓鱼' },
    ],
    bossSpot: BOSS, npcSpot: NPC, spawn: SPAWN,
  };
}
