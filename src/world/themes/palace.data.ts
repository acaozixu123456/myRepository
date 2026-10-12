// 九重宫阙（第 6 章，午后金光）的布局数据：对称的宫城。南面午门，中轴御道北上，一条金水河上三座石桥，两侧长廊、钟鼓楼，
// 北面台阶之上是金殿。碰撞盒：长廊 / 金水河（桥处留口）/ 钟鼓楼 / 铜香炉 / 金殿台基 / 午门城墙。
import type { AABB, LevelDef } from '../levels';

export const GATE_Z = 29;
export const RIVER = { z0: 6.5, z1: 9.5 };
export const BRIDGES = [{ x: 0, w: 8 }, { x: -13.5, w: 5 }, { x: 13.5, w: 5 }];
export const GALLERY_X = 27.5;
export const PAVILIONS: [number, number][] = [[-14, -4], [14, -4]];
export const BURNERS: [number, number][] = [[-5.5, 16], [5.5, 16], [-5.5, -8], [5.5, -8]];
export const HALL = { z0: -33, z1: -19.5, x: 17 };
const POI: [number, number] = [-14, 14];
const KITCHEN_POI: [number, number] = [14, 14]; // 东侧御膳房：配菜
const SPAWN: [number, number] = [0, 23];
const ENEMIES: [number, number][] = [[10, 17], [4, 23], [-9, -12], [10, -12], [18, 1], [-18, 2]];
const CHESTS: [number, number][] = [[19, 22], [-19, -14], [19, -14], [-19, 22]];
const HERBS: [number, number][] = [[-9, 12], [7, 12], [-7, 2], [6, -5], [-4, -14]];
const NPC: [number, number] = [6, 20];
const BOSS: [number, number] = [0, -14];

export function palaceSolids(): AABB[] {
  const s: AABB[] = [];
  for (const sx of [-1, 1]) s.push({ x0: sx > 0 ? GALLERY_X - 2.8 : -GALLERY_X - 2.8 - 0.2, x1: sx > 0 ? GALLERY_X + 3.2 : -GALLERY_X + 2.8 + 0.2, z0: -18, z1: 26 });
  // 金水河：桥洞处留口
  const xs = BRIDGES.map((b) => [b.x - b.w / 2, b.x + b.w / 2]).sort((a, b) => a[0] - b[0]);
  let x = -32; for (const [a, b] of xs) { s.push({ x0: x, x1: a, z0: RIVER.z0, z1: RIVER.z1 }); x = b; } s.push({ x0: x, x1: 32, z0: RIVER.z0, z1: RIVER.z1 });
  for (const [px, pz] of PAVILIONS) s.push({ x0: px - 3.8, x1: px + 3.8, z0: pz - 3.8, z1: pz + 3.8 });
  for (const [bx, bz] of BURNERS) s.push({ x0: bx - 1.1, x1: bx + 1.1, z0: bz - 1.1, z1: bz + 1.1 });
  s.push({ x0: -HALL.x, x1: HALL.x, z0: HALL.z0, z1: HALL.z1 }); // 金殿 + 台阶
  s.push({ x0: -32, x1: -4.2, z0: GATE_Z, z1: 34 }, { x0: 4.2, x1: 32, z0: GATE_Z, z1: 34 }); // 午门城墙（中间是门洞）
  return s;
}

export function palaceLevel(): LevelDef {
  return {
    id: 'nine-palaces', chapter: 6, name: '九重宫阙', mood: 'palace', half: 32, theme: 'palace', weather: 'none',
    buildings: [], poles: [], props: [], lamps: [], cones: [], arches: [], lanterns: [], tram: false, vents: [],
    glows: [[0, 12, '#ffe6a0', 26], [0, -10, '#ffd070', 22], [POI[0], POI[1], '#ffb0d8', 14]],
    lights: [[0, 8, 14, 0xffe8b8, 36, 30], [0, 8, -10, 0xffd890, 36, 28]],
    solids: palaceSolids(),
    enemySpots: ENEMIES, chestSpots: CHESTS, herbSpots: HERBS,
    pois: [{ id: 'lanterns', game: 'lanterns', x: POI[0], z: POI[1], label: '宫灯阵' }, { id: 'kitchen', game: 'kitchen', x: KITCHEN_POI[0], z: KITCHEN_POI[1], label: '御膳房 · 配菜' }],
    bossSpot: BOSS, npcSpot: NPC, spawn: SPAWN,
  };
}
