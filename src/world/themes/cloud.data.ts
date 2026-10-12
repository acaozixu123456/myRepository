// 云端雾岛（第 5 章，正午）的布局数据：一座漂在云海上的圆形浮岛（半径 28，碰撞盒把圆外全部挡住），
// 白石小径穿过三道牌坊通向北边的水晶祭坛；东边风车，西边风铃架，岛心一汪莲池。
import type { AABB, LevelDef } from '../levels';

export const ISLE_R = 28;
export const WINDMILL: [number, number] = [19, 2];
export const POND: [number, number, number] = [-8, -8, 3.4];
export const GATES = [12, -2, -14];
export const CRYSTALS: [number, number, number][] = [[-18, 12, 1.2], [20, -12, 1.4], [-4, -17, 1.1], [11, 18, 1.2], [-21, -2, 1.3]];
const POI: [number, number] = [-14, 6];
const SPAWN: [number, number] = [0, 22];
const ENEMIES: [number, number][] = [[12, 9], [-6, 14], [8, -6], [-14, -12], [14, -15], [2, 3]];
const CHESTS: [number, number][] = [[22, -4], [-20, -7], [-12, 20], [16, 19]];
const HERBS: [number, number][] = [[-9, 10], [5, 16], [-11, -2], [9, -16], [16, 8]];
const NPC: [number, number] = [5, 18];
const BOSS: [number, number] = [0, -20];

export function cloudSolids(): AABB[] {
  const s: AABB[] = [];
  const far = 36;
  for (let z = -far; z < far; z += 2) {
    const zc = z + 1, hw = Math.abs(zc) >= ISLE_R ? 0 : Math.sqrt(ISLE_R * ISLE_R - zc * zc);
    s.push({ x0: hw, x1: far, z0: z, z1: z + 2 }, { x0: -far, x1: -hw, z0: z, z1: z + 2 });
  }
  s.push({ x0: WINDMILL[0] - 2.3, x1: WINDMILL[0] + 2.3, z0: WINDMILL[1] - 2.3, z1: WINDMILL[1] + 2.3 });
  s.push({ x0: POND[0] - POND[2], x1: POND[0] + POND[2], z0: POND[1] - POND[2], z1: POND[1] + POND[2] });
  for (const z of GATES) for (const sx of [-1, 1]) s.push({ x0: sx * 4.6 - 0.7, x1: sx * 4.6 + 0.7, z0: z - 0.7, z1: z + 0.7 });
  for (const [x, z, r] of CRYSTALS) s.push({ x0: x - r, x1: x + r, z0: z - r, z1: z + r });
  s.push({ x0: -9, x1: -7, z0: -1.5, z1: 0.5 }); // 西边凉亭一角
  return s;
}

export function cloudLevel(): LevelDef {
  return {
    id: 'cloud-isle', chapter: 5, name: '云端雾岛', mood: 'mist', half: 32, theme: 'cloud', weather: 'none',
    buildings: [], poles: [], props: [], lamps: [], cones: [], arches: [], lanterns: [], tram: false, vents: [],
    glows: [[0, 0, '#fff4c8', 24], [POI[0], POI[1], '#c8e8ff', 16], [BOSS[0], BOSS[1], '#ffd8f0', 20]],
    lights: [[0, 8, 6, 0xfff0d0, 40, 30], [BOSS[0], 5, BOSS[1], 0xffc8f0, 40, 20]],
    solids: cloudSolids(),
    enemySpots: ENEMIES, chestSpots: CHESTS, herbSpots: HERBS,
    pois: [{ id: 'windchime', game: 'windchime', x: POI[0], z: POI[1], label: '风铃架' }],
    bossSpot: BOSS, npcSpot: NPC, spawn: SPAWN,
  };
}
