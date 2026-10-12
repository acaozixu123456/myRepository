// 夜市（第 2 章，黄昏）的布局数据：一条南北向的主街，两侧各一排摊位，摊位后面是两层的木楼，中央是招财猫凉亭广场，北头是戏台。
import type { AABB, LevelDef } from '../levels';

export const MARKET_STALL_X = 9.6;
export const MARKET_STALL_Z = [-23, -16, -9, 9, 16, 23]; // 中间 (-3..3) 留给广场与拉面屋台
export const MARKET_SHOP_X = 17;
export const MARKET_SHOP_Z = [-20, -6, 8, 22];
export const MARKET_SHOP = { w: 8.6, d: 8 };
export const MARKET_STAGE = { z: -29, w: 20, d: 5.4 };
export const MARKET_WALL_X = 26.5;
export const MARKET_PLAZA = { x: 0, z: 0, r: 9 };
const POI: [number, number] = [-9.6, 0];
const SPAWN: [number, number] = [0, 25];
const ENEMIES: [number, number][] = [[17, -13], [-17, 15], [-2, 16], [3, 9], [-4, -10], [3, -16]];
const CHESTS: [number, number][] = [[24, -13], [24, 15], [-24, -13], [-24, 1]];
const HERBS: [number, number][] = [[-5, 20], [6, 2], [-6, -4], [4, -22], [-4, 22]];
const NPC: [number, number] = [6, 21];
const BOSS: [number, number] = [0, -22];

export function marketSolids(): AABB[] {
  const s: AABB[] = [];
  for (const side of [-1, 1]) for (const z of MARKET_STALL_Z) s.push({ x0: side * MARKET_STALL_X - 1.15, x1: side * MARKET_STALL_X + 1.15, z0: z - 1.55, z1: z + 1.55 });
  for (const side of [-1, 1]) for (const z of MARKET_SHOP_Z) s.push({ x0: side * MARKET_SHOP_X - MARKET_SHOP.w / 2 - 0.4, x1: side * MARKET_SHOP_X + MARKET_SHOP.w / 2 + 0.4, z0: z - MARKET_SHOP.d / 2 - 0.4, z1: z + MARKET_SHOP.d / 2 + 0.4 });
  s.push({ x0: -2.8, x1: 2.8, z0: -2.8, z1: 2.8 }); // 招财猫凉亭的基座
  s.push({ x0: -MARKET_STAGE.w / 2, x1: MARKET_STAGE.w / 2, z0: MARKET_STAGE.z - MARKET_STAGE.d / 2 - 2, z1: MARKET_STAGE.z + MARKET_STAGE.d / 2 }); // 戏台
  s.push({ x0: -MARKET_WALL_X - 6, x1: -MARKET_WALL_X, z0: -33, z1: 33 }, { x0: MARKET_WALL_X, x1: MARKET_WALL_X + 6, z0: -33, z1: 33 }); // 两侧围墙
  for (const sx of [-5, 5]) s.push({ x0: sx - 0.9, x1: sx + 0.9, z0: 28.1, z1: 29.9 }); // 南牌楼两柱
  return s;
}

export function marketLevel(): LevelDef {
  return {
    id: 'neon-night-market', chapter: 2, name: '霓虹夜市', mood: 'market', half: 32, theme: 'market', weather: 'none',
    buildings: [], poles: [], props: [], lamps: [], cones: [], arches: [], lanterns: [], tram: false,
    vents: [[-9.6, 1.6, -9], [9.6, 1.6, 9], [-9.6, 1.6, 16], [9.6, 1.6, -16], [-3.4, 1.0, -2]],
    glows: [[0, 0, '#ffb04a', 22], [-9.6, 16, '#ff7a3a', 12], [9.6, -9, '#ffd070', 12], [0, -23, '#ff5a3a', 18]],
    lights: [[0, 5, 0, 0xffb060, 80, 24], [0, 5, 16, 0xff9a50, 60, 20], [0, 5, -16, 0xffc070, 60, 20], [0, 6, -25, 0xff6a40, 60, 20]],
    solids: marketSolids(),
    enemySpots: ENEMIES, chestSpots: CHESTS, herbSpots: HERBS,
    pois: [{ id: 'ramen', game: 'ramen', x: POI[0], z: POI[1], label: '拉面屋台' }],
    bossSpot: BOSS, npcSpot: NPC, spawn: SPAWN,
  };
}
