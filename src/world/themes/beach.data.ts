// 椰风海湾（附加场景，不在主线章节里）的布局数据（纯数据，无 three）：
// 北边是大海（挡路），沙滩从南往北铺到海边；西侧浪区（冲浪）、正中栈桥边（钓鱼）、东侧退潮的滩涂（赶海）、
// 东北角灯塔、西南的椰子小吧台、到处是椰树、遮阳伞和沙堡。
import type { AABB, LevelDef } from '../levels';

/** 海面 [x0, z0, x1, z1]（挡路） */
export const SEA: [number, number, number, number] = [-32, -32, 32, -15];
export const SHORE_Z = SEA[3];
export const SURF_POI: [number, number] = [-18, -11];
export const FISH_POI: [number, number] = [0, -12];
export const CLAM_POI: [number, number] = [18, -9];
/** 退潮滩涂 [x, z, 半轴 x, 半轴 z]（可走，只是颜色深） */
export const FLAT: [number, number, number, number] = [18, -10, 8, 4];
export const LIGHTHOUSE: [number, number] = [27, 4];
export const BAR: [number, number] = [-15, 15];
/** 栈桥：从岸边伸进海里（装饰，走不上去） */
export const PIER = { x: 0, z0: -15, z1: -26, w: 2.6 };

const SPAWN: [number, number] = [0, 26];
const BOSS: [number, number] = [0, 2];
const NPC: [number, number] = [BAR[0] + 4.5, BAR[1] + 2];
const ENEMIES: [number, number][] = [[-8, 18], [10, 18], [9, 4], [-10, 2], [22, 14], [-25, 2]];
const CHESTS: [number, number][] = [[27, 24], [-27, 25], [28, -6], [-28, -8]];
const HERBS: [number, number][] = [[-4, 20], [14, 8], [-16, 5], [8, -2], [20, 24]];

/** 椰树 [x, z, 缩放] */
export const PALMS: [number, number, number][] = [[-26, 12, 1.1], [-22, 24, 1.0], [-8, 10, 0.9], [12, 12, 1.1], [24, 22, 1.0], [6, 22, 0.9], [-29, -4, 1.2], [29, -10, 1.0], [-12, -6, 1.0], [10, -4, 0.9], [-20, 18, 0.9], [18, 28, 1.1]];
/** 遮阳伞 + 躺椅 [x, z, 颜色] */
export const UMBRELLAS: [number, number, string][] = [[-6, -4, '#ff6a5a'], [6, 12, '#4ac8ff'], [-20, -3, '#ffd24a'], [14, -2, '#7fe08a'], [-2, 14, '#ff9ad0']];
export const CASTLE: [number, number] = [5, -8];

export function beachSolids(): AABB[] {
  const s: AABB[] = [{ x0: SEA[0], z0: SEA[1], x1: SEA[2], z1: SEA[3] }];
  for (const [x, z, sc] of PALMS) { const r = 0.45 * sc; s.push({ x0: x - r, x1: x + r, z0: z - r, z1: z + r }); }
  s.push({ x0: LIGHTHOUSE[0] - 2.2, x1: LIGHTHOUSE[0] + 2.2, z0: LIGHTHOUSE[1] - 2.2, z1: LIGHTHOUSE[1] + 2.2 });
  s.push({ x0: BAR[0] - 3, x1: BAR[0] + 3, z0: BAR[1] - 2, z1: BAR[1] + 2 });
  s.push({ x0: CASTLE[0] - 1.2, x1: CASTLE[0] + 1.2, z0: CASTLE[1] - 1.2, z1: CASTLE[1] + 1.2 });
  return s;
}

export function beachLevel(): LevelDef {
  return {
    id: 'coco-bay', chapter: 103, name: '椰风海湾', mood: 'beach', half: 32, theme: 'beach', weather: 'none', water: SEA,
    buildings: [], poles: [], props: [], lamps: [], cones: [], arches: [], lanterns: [], tram: false, vents: [],
    glows: [[SURF_POI[0], SURF_POI[1], '#7ff0ff', 16], [CLAM_POI[0], CLAM_POI[1], '#ffd0a0', 16], [FISH_POI[0], FISH_POI[1], '#9ae8ff', 14]],
    lights: [[LIGHTHOUSE[0], 10, LIGHTHOUSE[1], 0xfff0c0, 40, 20], [BAR[0], 4, BAR[1] + 3, 0xffb060, 40, 14]],
    solids: beachSolids(),
    enemySpots: ENEMIES, chestSpots: CHESTS, herbSpots: HERBS,
    pois: [
      { id: 'surf', game: 'surf', x: SURF_POI[0], z: SURF_POI[1], label: '浪区 · 冲浪' },
      { id: 'fish', game: 'fish', x: FISH_POI[0], z: FISH_POI[1], label: '栈桥钓鱼' },
      { id: 'clams', game: 'clams', x: CLAM_POI[0], z: CLAM_POI[1], label: '滩涂 · 赶海' },
    ],
    bossSpot: BOSS, npcSpot: NPC, spawn: SPAWN,
  };
}
