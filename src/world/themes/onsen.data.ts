// 樱汤乡（附加场景，不在主线章节里）的布局数据（纯数据，无 three）：
// 北边是锦鲤池（挡路，池上一座红色拱桥），南岸西边打水漂、东边钓锦鲤；东侧寿司小铺，西侧冒着热气的露天温泉，
// 南边入口一座红鸟居，石灯笼沿着石板路摆，到处是樱花树。
import type { AABB, LevelDef } from '../levels';

/** 锦鲤池 [x0, z0, x1, z1]（挡路） */
export const POND: [number, number, number, number] = [-14, -30, 14, -14];
export const SKIP_POI: [number, number] = [-7, -12];
export const FISH_POI: [number, number] = [7, -12];
export const SUSHI_POI: [number, number] = [20, 4];
/** 寿司小铺 [x, z, 宽, 深]（正面朝 +z，门口对着入口） */
export const SHOP: [number, number, number, number] = [23, -5, 9, 6];
/** 露天温泉 [x, z, 半径] */
export const ONSEN: [number, number, number] = [-21, 6, 5];
export const TORII: [number, number] = [0, 19];
export const TORII_SPAN = 6;
/** 石灯笼 [x, z] */
export const STONE_LANTERNS: [number, number][] = [[-3.5, 12], [3.5, 12], [-3.5, 25], [3.5, 25], [-12, -11], [12, -11], [15, 8], [-14, 0]];
/** 樱花树 [x, z, 缩放] */
export const SAKURA: [number, number, number][] = [[-27, -10, 1.1], [-20, -20, 1.0], [24, -18, 1.1], [28, 10, 1.0], [-28, 22, 1.2], [-12, 26, 0.9], [13, 27, 1.0], [27, 26, 1.1], [-9, 4, 0.8], [10, 14, 0.9], [-27, -24, 0.9], [20, -26, 0.9]];
/** 竹丛 [x, z] */
export const BAMBOO: [number, number][] = [[-30, 8], [-30, 0], [-30, 14], [30, -8], [30, 0]];

const SPAWN: [number, number] = [0, 27];
const BOSS: [number, number] = [0, 2];
const NPC: [number, number] = [ONSEN[0] + 7, ONSEN[1] + 4];
const ENEMIES: [number, number][] = [[-10, 18], [12, 20], [-8, -2], [9, -2], [-22, 20], [22, 18]];
const CHESTS: [number, number][] = [[-28, -4], [28, -12], [-26, 28], [28, 28]];
const HERBS: [number, number][] = [[-16, 14], [16, 12], [-4, -6], [24, 20], [-18, -8]];

export function onsenSolids(): AABB[] {
  const s: AABB[] = [];
  for (const [x, z, sc] of SAKURA) { const r = 0.5 * sc; s.push({ x0: x - r, x1: x + r, z0: z - r, z1: z + r }); }
  const [hx, hz, hw, hd] = SHOP; s.push({ x0: hx - hw / 2 - 0.6, x1: hx + hw / 2 + 0.6, z0: hz - hd / 2 - 0.6, z1: hz + hd / 2 + 0.6 });
  const [ox, oz, or] = ONSEN; s.push({ x0: ox - or, x1: ox + or, z0: oz - or, z1: oz + or });
  for (const sx of [-1, 1]) s.push({ x0: TORII[0] + sx * TORII_SPAN / 2 - 0.5, x1: TORII[0] + sx * TORII_SPAN / 2 + 0.5, z0: TORII[1] - 0.5, z1: TORII[1] + 0.5 });
  for (const [x, z] of STONE_LANTERNS) s.push({ x0: x - 0.5, x1: x + 0.5, z0: z - 0.5, z1: z + 0.5 });
  for (const [x, z] of BAMBOO) s.push({ x0: x - 1.2, x1: x + 1.2, z0: z - 1.2, z1: z + 1.2 });
  return s;
}

export function onsenLevel(): LevelDef {
  return {
    id: 'sakura-onsen', chapter: 104, name: '樱汤乡', mood: 'onsen', half: 32, theme: 'onsen', weather: 'none', water: POND,
    buildings: [], poles: [], props: [], lamps: [], cones: [], arches: [], lanterns: [], tram: false, vents: [],
    glows: [[SKIP_POI[0], SKIP_POI[1], '#ffc0d8', 14], [FISH_POI[0], FISH_POI[1], '#9ae8ff', 14], [SUSHI_POI[0], SUSHI_POI[1], '#ffb08a', 14]],
    lights: [[SHOP[0], 4, SHOP[1] + 4, 0xffb060, 40, 16], [ONSEN[0], 3, ONSEN[1], 0xffd0a0, 30, 14]],
    solids: onsenSolids(),
    enemySpots: ENEMIES, chestSpots: CHESTS, herbSpots: HERBS,
    pois: [
      { id: 'skip', game: 'skip', x: SKIP_POI[0], z: SKIP_POI[1], label: '池畔 · 打水漂' },
      { id: 'fish', game: 'fish', x: FISH_POI[0], z: FISH_POI[1], label: '锦鲤池钓鱼' },
      { id: 'sushi', game: 'sushi', x: SUSHI_POI[0], z: SUSHI_POI[1], label: '喵鮨 · 回转寿司' },
    ],
    bossSpot: BOSS, npcSpot: NPC, spawn: SPAWN,
  };
}
