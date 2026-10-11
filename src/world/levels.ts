// 关卡数据（纯数据，不依赖 DOM / three：寻路、实体摆放合法性测试、玩法规则都读它）。
// 一个关卡 = 十字路口街区；楼、道具、灯、电线杆、实体出生点都在这里摆。新增关卡：加一份 LevelDef，必要时在 kit / props 里补新道具。
import type { BuildingSpec } from './kit';

export interface Placed { spec: BuildingSpec; x: number; z: number; face: 1 | -1 }
export interface PropDef { kind: string; x: number; z: number; ry?: number; seed?: number; arg?: number }
export interface AABB { x0: number; x1: number; z0: number; z1: number }
export type MoodId = 'neon' | 'street' | 'market' | 'redcliff' | 'forest' | 'mist' | 'palace' | 'meadow';
export interface LevelDef {
  id: string; chapter: number; name: string; mood: MoodId; half: number;
  buildings: Placed[];
  poles: [number, number][];
  props: PropDef[];
  lamps: [number, number, string][];
  cones: [number, number][];
  glows: [number, number, string, number][];
  lights: [number, number, number, number, number, number][]; // x y z 颜色 强度 范围
  tram: boolean;
  arches: [number, number, number, string, string][]; // x z 朝向(rad) 文字 颜色
  lanterns: [number, number, number, number, number, string][]; // x0 z0 x1 z1 高度 颜色
  vents: [number, number, number][];
  /** 水面矩形 [x0,z0,x1,z1]（不可走）+ 码头景物 */
  water?: [number, number, number, number];
  /** 地面配色（缺省是城市沥青 + 灰紫地砖）*/
  ground?: { pave: string; road: number };
  /** 森林：大发光树 [x,z,缩放,种子,光色] 与发光蘑菇 [x,z,缩放,颜色] */
  trees?: [number, number, number, number, string][];
  mushrooms?: [number, number, number, string][];
  containers?: [number, number, number, string][]; // x z 朝向 颜色
  cranes?: [number, number, number][];
  ships?: [number, number, number][];
  enemySpots: [number, number][]; chestSpots: [number, number][]; herbSpots?: [number, number][]; bossSpot: [number, number]; npcSpot: [number, number]; spawn: [number, number];
}

const L1_BUILDINGS: Placed[] = [
  // 北侧（面朝南 +z）
  { x: -14, z: -12, face: 1, spec: { w: 10, d: 9, floors: 5, style: 'cream', seed: 1, roof: 'garden', shop: { name: '海洋寿司', color: '#7ff0ff', awning: ['#e8f4ee', '#4a9a82'] }, signs: [{ text: '永喵拉面', color: '#ff7ad9', vertical: true }, { text: '熊猫当铺', color: '#7ff0ff' }], neon: '#7ff0ff' } },
  { x: -25, z: -11.5, face: 1, spec: { w: 8, d: 8, floors: 4, style: 'teal', seed: 2, roof: 'tank', shop: { name: '九命电器', color: '#ffe27a', awning: ['#fff', '#d9483b'] }, signs: [{ text: '电', color: '#ffe27a', vertical: true }], neon: '#ffe27a' } },
  { x: 13, z: -12, face: 1, spec: { w: 11, d: 10, floors: 4, style: 'pink', seed: 3, roof: 'tile', shop: { name: '山之男居酒屋', color: '#ff9a4a', awning: ['#3a2a30', '#ff7a4a'] }, signs: [{ text: '酒', color: '#ff4aa8', vertical: true }], neon: '#ff4aa8' } },
  { x: 25, z: -11.5, face: 1, spec: { w: 8, d: 8, floors: 6, style: 'dark', seed: 4, roof: 'flat', shop: { name: '赛博猫网咖', color: '#9a7aff', awning: ['#2a2a4a', '#7a5aff'] }, signs: [{ text: '网咖', color: '#7ff0ff', vertical: true }, { text: '24H', color: '#ff4aa8' }], neon: '#9a7aff' } },
  // 南侧（面朝北 -z，旋转 π）
  { x: -14, z: 12, face: -1, spec: { w: 10, d: 9, floors: 4, style: 'brick', seed: 5, roof: 'tank', shop: { name: '猫抓板药局', color: '#4fe08a', awning: ['#f4fff4', '#3aa86a'] }, signs: [{ text: '药', color: '#4fe08a', vertical: true }], neon: '#4fe08a' } },
  { x: -25, z: 11.5, face: -1, spec: { w: 8, d: 8, floors: 5, style: 'cream', seed: 6, roof: 'garden', shop: { name: '小鱼干酒场', color: '#ff7ad9', awning: ['#ffe9f4', '#ff5aa8'] }, signs: [{ text: '鱼', color: '#7ff0ff', vertical: true }], neon: '#ff7ad9' } },
  { x: 14, z: 12, face: -1, spec: { w: 10, d: 9, floors: 5, style: 'teal', seed: 7, roof: 'tile', shop: { name: '喵喵便利店', color: '#7ff0ff', awning: ['#fff', '#2aa8c8'] }, signs: [{ text: '24H', color: '#ffe27a' }], neon: '#7ff0ff' } },
  { x: 25, z: 11.5, face: -1, spec: { w: 8, d: 8, floors: 4, style: 'dark', seed: 8, roof: 'flat', shop: { name: '夜猫当铺', color: '#ff4a6a', awning: ['#2a1a2a', '#c8284a'] }, signs: [{ text: '当', color: '#ff4a6a', vertical: true }], neon: '#ff4a6a' } },
];
const SPOTS = {
  enemySpots: [[12, 0], [-14, -2], [0, -13], [-2, 15], [18, 5.8], [-22, 5.8]] as [number, number][],
  chestSpots: [[24, 0], [-2.5, -26], [3, 26], [-26, 5.8]] as [number, number][],
  bossSpot: [0, -23] as [number, number], npcSpot: [6, 5.8] as [number, number], spawn: [0, 8] as [number, number],
};
/** 猫薄荷丛默认摆在马路上（所有关卡都空着）；关卡可以用 herbSpots 覆盖 */
export const DEFAULT_HERBS: [number, number][] = [[9, -2.4], [-2.4, -9], [2.4, 12]];
export const herbsOf = (L: LevelDef): [number, number][] => L.herbSpots ?? DEFAULT_HERBS;
const L1_POLES: [number, number][] = [[-20, -5.2], [-6, -5.2], [6, 5.2], [20, 5.2], [-5.2, 18], [5.2, -18]];
const L1_PROPS: PropDef[] = [
  { kind: 'vending', x: -5.0, z: -7.4, ry: 0 }, { kind: 'vendingCyan', x: -3.6, z: -7.4, ry: 0 }, { kind: 'vendingGold', x: 8, z: 7.4, ry: Math.PI },
  { kind: 'cardboard', x: -6.6, z: -7.2, seed: 1 }, { kind: 'cardboard', x: 17, z: -6.6, seed: 2 }, { kind: 'cardboard', x: -18, z: 6.8, seed: 3 }, { kind: 'cardboard', x: 5.8, z: 8.2, seed: 4 },
  { kind: 'trash', x: 9.5, z: -7.0 }, { kind: 'trashB', x: -22, z: 7.0 },
  { kind: 'tree', x: -8, z: -6.6, seed: 3, arg: 3.4 }, { kind: 'tree', x: 10, z: 6.8, seed: 4, arg: 3.0 }, { kind: 'tree', x: 21, z: -6.4, seed: 5, arg: 3.6 }, { kind: 'tree', x: -21, z: 6.8, seed: 6, arg: 3.2 },
  { kind: 'planter', x: -17, z: -6.9, arg: 2.4 }, { kind: 'planter', x: 20, z: 6.9, arg: 2.0 }, { kind: 'bush', x: 4.6, z: -6.8, seed: 7, arg: 0.8 }, { kind: 'bush', x: -4.8, z: 6.9, seed: 8, arg: 0.7 },
];
const L1_LAMPS: [number, number, string][] = [[-2.5, -7, '#ffd8a0'], [3, 7, '#ff9ad0'], [-12, 6.8, '#7ff0ff'], [12, -6.9, '#ffd8a0'], [-6.8, 12, '#ffd8a0'], [6.8, -12, '#7ff0ff']];
const CONES: [number, number][] = [[1.5, 4.8], [-1.5, 4.8], [14, 4.8], [-14, -4.8], [4.8, 14], [-4.8, -14]];

export const LEVEL_1: LevelDef = {
  id: 'carton-street', chapter: 1, name: '纸箱街 · 霓虹巷口', mood: 'neon', half: 32,
  buildings: L1_BUILDINGS, poles: L1_POLES, props: L1_PROPS, lamps: L1_LAMPS, cones: CONES,
  glows: [[0, 0, '#ff2ea8', 22], [-12, -6, '#7ff0ff', 14], [12, 6, '#9a7aff', 16], [-22, 6, '#ff7ad9', 12]],
  lights: [[0, 5, 0, 0xff2ea8, 90, 26], [-14, 6, -4, 0x7ff0ff, 70, 22], [14, 6, 4, 0x9a7aff, 70, 22]],
  tram: true, arches: [], lanterns: [],
  vents: [[-3, 0.5, -7.6], [3.4, 0.5, 7.6], [-19.5, 0.5, -7.4], [20, 0.5, -7.4], [-8, 0.5, 7.7], [8.5, 0.5, -7.5]],
  ...SPOTS,
};

// ---------- 关卡 2：霓虹夜市 ----------
const L2_BUILDINGS: Placed[] = [
  { x: -14, z: -12, face: 1, spec: { w: 10, d: 9, floors: 5, style: 'pink', seed: 11, roof: 'tile', shop: { name: '章鱼烧', color: '#ff9a4a', awning: ['#fff0d8', '#ff7a3a'] }, signs: [{ text: '夜市', color: '#ff2ea8', vertical: true }, { text: '热卖', color: '#ffe27a' }], neon: '#ff9a4a' } },
  { x: -25, z: -11.5, face: 1, spec: { w: 8, d: 8, floors: 4, style: 'brick', seed: 12, roof: 'flat', shop: { name: '串烧屋', color: '#ff4a4a', awning: ['#3a1a1a', '#e03a3a'] }, signs: [{ text: '串', color: '#ff4a4a', vertical: true }], neon: '#ff4a4a' } },
  { x: 13, z: -12, face: 1, spec: { w: 11, d: 10, floors: 5, style: 'dark', seed: 13, roof: 'garden', shop: { name: '喵喵拉面', color: '#ffe27a', awning: ['#2a2230', '#d9483b'] }, signs: [{ text: '面', color: '#ffe27a', vertical: true }, { text: '24H', color: '#7ff0ff' }], neon: '#ffe27a' } },
  { x: 25, z: -11.5, face: 1, spec: { w: 8, d: 8, floors: 4, style: 'teal', seed: 14, roof: 'tank', shop: { name: '鱼市', color: '#7ff0ff', awning: ['#e8fff8', '#2aa8c8'] }, signs: [{ text: '鲜', color: '#7ff0ff', vertical: true }], neon: '#7ff0ff' } },
  { x: -14, z: 12, face: -1, spec: { w: 10, d: 9, floors: 4, style: 'cream', seed: 15, roof: 'tile', shop: { name: '糖水铺', color: '#ff7ad9', awning: ['#fff0f8', '#ff5aa8'] }, signs: [{ text: '甜', color: '#ff7ad9', vertical: true }], neon: '#ff7ad9' } },
  { x: -25, z: 11.5, face: -1, spec: { w: 8, d: 8, floors: 5, style: 'dark', seed: 16, roof: 'flat', shop: { name: '夜市酒场', color: '#9a7aff', awning: ['#22223a', '#7a5aff'] }, signs: [{ text: '酒', color: '#9a7aff', vertical: true }, { text: 'BAR', color: '#ff4aa8' }], neon: '#9a7aff' } },
  { x: 14, z: 12, face: -1, spec: { w: 10, d: 9, floors: 5, style: 'brick', seed: 17, roof: 'garden', shop: { name: '猫薄荷茶馆', color: '#4fe08a', awning: ['#f0fff4', '#3aa86a'] }, signs: [{ text: '茶', color: '#4fe08a', vertical: true }], neon: '#4fe08a' } },
  { x: 25, z: 11.5, face: -1, spec: { w: 8, d: 8, floors: 4, style: 'pink', seed: 18, roof: 'tile', shop: { name: '烧烤摊', color: '#ff7a3a', awning: ['#fff0e0', '#ff5a2a'] }, signs: [{ text: '烤', color: '#ff7a3a', vertical: true }], neon: '#ff7a3a' } },
];
const L2_PROPS: PropDef[] = [
  { kind: 'stall', x: -5.0, z: -7.4, ry: 0, arg: 0 }, { kind: 'stall', x: -3.6, z: -7.4, ry: 0, arg: 1 }, { kind: 'stall', x: 8, z: 7.4, ry: Math.PI, arg: 2 },
  { kind: 'cardboard', x: -6.6, z: -7.2, seed: 5 }, { kind: 'cardboard', x: 17, z: -6.6, seed: 6 }, { kind: 'cardboard', x: -18, z: 6.8, seed: 7 }, { kind: 'cardboard', x: 5.8, z: 8.2, seed: 8 },
  { kind: 'trash', x: 9.5, z: -7.0 }, { kind: 'trashB', x: -22, z: 7.0 },
  { kind: 'stall', x: -8, z: -6.6, ry: 0, arg: 3 }, { kind: 'stall', x: 10, z: 6.8, ry: Math.PI, arg: 4 }, { kind: 'stall', x: 21, z: -6.4, ry: 0, arg: 5 }, { kind: 'stall', x: -21, z: 6.8, ry: Math.PI, arg: 0 },
  { kind: 'planter', x: -17, z: -6.9, arg: 2.4 }, { kind: 'planter', x: 20, z: 6.9, arg: 2.0 }, { kind: 'bush', x: 4.6, z: -6.8, seed: 9, arg: 0.8 }, { kind: 'bush', x: -4.8, z: 6.9, seed: 10, arg: 0.7 },
];
export const LEVEL_2: LevelDef = {
  id: 'neon-night-market', chapter: 2, name: '霓虹夜市', mood: 'market', half: 32,
  buildings: L2_BUILDINGS, poles: L1_POLES, props: L2_PROPS, lamps: [[-2.5, -7, '#ffb060'], [3, 7, '#ff8a60'], [-12, 6.8, '#ffd070'], [12, -6.9, '#ffb060'], [-6.8, 12, '#ff9a60'], [6.8, -12, '#ffd070']], cones: CONES,
  glows: [[0, 0, '#ff9a2e', 24], [-12, -6, '#ff4a4a', 14], [12, 6, '#ff2ea8', 16], [-22, 6, '#ffe27a', 12]],
  lights: [[0, 5, 0, 0xffa030, 95, 26], [-14, 6, -4, 0xff4a4a, 70, 22], [14, 6, 4, 0xff2ea8, 70, 22]],
  tram: false,
  arches: [[-17, 0, Math.PI / 2, '夜市', '#ff4a4a'], [17, 0, Math.PI / 2, '欢迎', '#ffe27a']],
  lanterns: [[-4.5, -10, 4.5, -10, 7, '#ff4a3a'], [-4.5, 10, 4.5, 10, 7, '#ffb03a'], [-4.5, -17, 4.5, -17, 7, '#ff4a3a']],
  vents: [[-3, 0.5, -7.6], [3.4, 0.5, 7.6], [-19.5, 0.5, -7.4], [20, 0.5, -7.4], [-8, 0.5, 7.7], [8.5, 0.5, -7.5]],
  ...SPOTS,
};

// ---------- 关卡 3：赤壁霓虹港（码头：南面是水，集装箱 + 吊机 + 货轮）----------
const L3_POLES: [number, number][] = [[-20, -5.2], [-6, -5.2], [6, 5.2], [20, 5.2], [5.2, -18]];
export const LEVEL_3: LevelDef = {
  id: 'redcliff-harbor', chapter: 3, name: '赤壁霓虹港', mood: 'redcliff', half: 32,
  buildings: L1_BUILDINGS.slice(0, 4).map((b, i) => ({ ...b, spec: { ...b.spec, seed: b.spec.seed + 60, style: (['brick', 'dark', 'brick', 'dark'] as const)[i] } })),
  poles: L3_POLES, props: L1_PROPS.filter((p) => p.z < 9 && p.kind !== 'tree'), lamps: [[-2.5, -7, '#ffb060'], [3, 7, '#ff8a60'], [12, -6.9, '#ffd070'], [-12, 6.8, '#ff6a50']], cones: [[1.5, 4.8], [-1.5, 4.8], [14, 4.8], [-14, -4.8]],
  glows: [[0, 0, '#ff5a3a', 22], [-12, -6, '#ffb040', 14], [14, 9, '#ff2e5a', 16], [-22, 9, '#ffe27a', 12]],
  lights: [[0, 5, 0, 0xff5a3a, 90, 26], [-14, 6, -4, 0xffb040, 70, 22], [14, 6, 9, 0xff2e5a, 70, 22]],
  tram: false, arches: [], lanterns: [],
  vents: [[-3, 0.5, -7.6], [-19.5, 0.5, -7.4], [20, 0.5, -7.4]],
  water: [-31, 12.5, 31, 31],
  containers: [[-27, 10, 0, '#d9483b'], [-9, 10.2, 0, '#2a8ac8'], [22, 10, 0, '#e8a23a'], [27, 10, 0, '#4a9a62']],
  cranes: [[-16, 18, 0], [18, 17, 0]],
  ships: [[0, 24, 0], [-22, 27, 0.2]],
  enemySpots: [[12, 0], [-14, -2], [0, -13], [-20, 9.5], [18, 9.5], [2, 10]],
  chestSpots: [[24, 0], [-2.5, -26], [3, -26], [-26, 5.8]],
  bossSpot: [0, -23], npcSpot: [6, 5.8], spawn: [0, 8],
};

// ---------- 关卡 4：霓虹森林（树屋 + 发光巨树 + 蘑菇）----------
const HUTS: Placed[] = [
  { x: -14, z: -12, face: 1, spec: { w: 7, d: 7, floors: 3, style: 'teal', seed: 81, roof: 'tile', shop: { name: '树屋茶馆', color: '#4fe08a', awning: ['#f0fff4', '#3aa86a'] }, signs: [{ text: '茶', color: '#b0ff6a', vertical: true }], neon: '#4fe08a' } },
  { x: 14, z: -12, face: 1, spec: { w: 7, d: 7, floors: 3, style: 'cream', seed: 82, roof: 'garden', shop: { name: '蘑菇铺', color: '#ff7ad9', awning: ['#fff0f8', '#ff5aa8'] }, signs: [{ text: '菇', color: '#7ff0ff', vertical: true }], neon: '#7ff0ff' } },
  { x: -14, z: 12, face: -1, spec: { w: 7, d: 7, floors: 3, style: 'brick', seed: 83, roof: 'tile', shop: { name: '藤编坊', color: '#ffe27a', awning: ['#fffbe8', '#d9a23a'] }, signs: [{ text: '藤', color: '#4fe08a', vertical: true }], neon: '#ffe27a' } },
  { x: 14, z: 12, face: -1, spec: { w: 7, d: 7, floors: 3, style: 'teal', seed: 84, roof: 'tank', shop: { name: '泉水站', color: '#7ff0ff', awning: ['#f0ffff', '#2aa8c8'] }, signs: [{ text: '泉', color: '#7ff0ff', vertical: true }], neon: '#7ff0ff' } },
];
function forestTrees(): [number, number, number, number, string][] {
  const out: [number, number, number, number, string][] = [];
  const cols = ['#4fe08a', '#7ff0ff', '#b0ff6a', '#ff7ad9'];
  const spots = [...SPOTS.enemySpots, ...SPOTS.chestSpots, SPOTS.bossSpot, SPOTS.npcSpot, SPOTS.spawn];
  let k = 0;
  for (const x of [-29, -24, -19, -9, -7.5, 7.5, 9, 19, 24, 29]) for (const z of [-29, -24, -19, -8, 8, 19, 24, 29]) {
    k++;
    if (HUTS.some((b) => Math.abs(x - b.x) < b.spec.w / 2 + 3 && Math.abs(z - b.z) < b.spec.d / 2 + 3)) continue;
    if (spots.some(([sx, sz]) => Math.hypot(sx - x, sz - z) < 4)) continue;
    if (Math.abs(x) < 6.5 || Math.abs(z) < 6.5) continue; // 留出小路
    out.push([x + ((k * 7) % 5 - 2) * 0.35, z + ((k * 11) % 5 - 2) * 0.35, 0.38 + ((k * 13) % 7) * 0.04, k, cols[k % cols.length]]);
  }
  return out;
}
function forestMushrooms(): [number, number, number, string][] {
  const out: [number, number, number, string][] = [];
  const cols = ['#ff7ad9', '#7ff0ff', '#ffe27a', '#b0ff6a'];
  for (let i = 0; i < 36; i++) { const x = ((i * 37) % 59) - 29, z = ((i * 53) % 61) - 30; if (Math.abs(x) < 5.5 || Math.abs(z) < 5.5) continue; if (HUTS.some((b) => Math.abs(x - b.x) < 5 && Math.abs(z - b.z) < 5)) continue; out.push([x, z, 0.7 + (i % 4) * 0.25, cols[i % 4]]); }
  return out;
}
export const LEVEL_4: LevelDef = {
  id: 'neon-forest', chapter: 4, name: '霓虹森林', mood: 'forest', half: 32,
  buildings: HUTS, poles: [], props: [{ kind: 'cardboard', x: -6.6, z: -7.2, seed: 11 }, { kind: 'bush', x: 4.6, z: -6.8, seed: 7, arg: 0.8 }, { kind: 'bush', x: -4.8, z: 6.9, seed: 8, arg: 0.7 }],
  lamps: [[-5.2, -7, '#b0ff6a'], [5.2, 7, '#7ff0ff'], [-6.8, 12, '#4fe08a'], [6.8, -12, '#ff7ad9']], cones: [],
  glows: [[0, 0, '#4fe08a', 24], [-14, -6, '#7ff0ff', 16], [14, 6, '#b0ff6a', 16], [0, -18, '#ff7ad9', 14]],
  lights: [[0, 5, 0, 0x4fe08a, 90, 26], [-14, 6, -4, 0x7ff0ff, 70, 22], [14, 6, 4, 0xff7ad9, 70, 22]],
  tram: false, arches: [], lanterns: [[-4.5, -10, 4.5, -10, 7, '#b0ff6a'], [-4.5, 10, 4.5, 10, 7, '#7ff0ff']],
  vents: [[-9, 0.5, -7.6], [9, 0.5, 7.6]],
  ground: { pave: '#1f3a2a', road: 0x5a7a60 },
  trees: forestTrees(), mushrooms: forestMushrooms(),
  ...SPOTS,
};

// ---------- 关卡 5：云端雾岛 / 关卡 6：九重宫阙 ----------
const SPOT_LIST = [...SPOTS.enemySpots, ...SPOTS.chestSpots, SPOTS.bossSpot, SPOTS.npcSpot, SPOTS.spawn];
/** 在人行道区域撒道具（避开道路、出生点、建筑） */
function scatter(buildings: Placed[], n: number, seed: number, mk: (i: number, x: number, z: number) => PropDef | null): PropDef[] {
  const out: PropDef[] = []; let k = seed * 17;
  for (let tries = 0; out.length < n && tries < n * 12; tries++) {
    k = (k * 1103515245 + 12345) % 2147483647;
    const x = ((k % 5800) / 100) - 29, z = (((k >> 7) % 5800) / 100) - 29;
    if (Math.abs(x) < 6 || Math.abs(z) < 6) continue;
    if (buildings.some((b) => Math.abs(x - b.x) < b.spec.w / 2 + 2.5 && Math.abs(z - b.z) < b.spec.d / 2 + 2.5)) continue;
    if (SPOT_LIST.some(([sx, sz]) => Math.hypot(sx - x, sz - z) < 4)) continue;
    if (out.some((p) => Math.hypot(p.x - x, p.z - z) < 3)) continue;
    const p = mk(out.length, x, z); if (p) out.push(p);
  }
  return out;
}
const B5: Placed[] = [
  { x: -14, z: -12, face: 1, spec: { w: 9, d: 8, floors: 4, style: 'dark', seed: 91, roof: 'tile', shop: { name: '云茶馆', color: '#9ab8ff', awning: ['#e8f0ff', '#6a8ad8'] }, signs: [{ text: '云', color: '#9ab8ff', vertical: true }], neon: '#9ab8ff' } },
  { x: 14, z: -12, face: 1, spec: { w: 9, d: 8, floors: 5, style: 'teal', seed: 92, roof: 'tile', shop: { name: '星象台', color: '#c08aff', awning: ['#f0e8ff', '#8a5ae0'] }, signs: [{ text: '星', color: '#c08aff', vertical: true }], neon: '#c08aff' } },
  { x: -14, z: 12, face: -1, spec: { w: 9, d: 8, floors: 4, style: 'cream', seed: 93, roof: 'tank', shop: { name: '风铃铺', color: '#7ff0ff', awning: ['#f0ffff', '#2aa8c8'] }, signs: [{ text: '铃', color: '#7ff0ff', vertical: true }], neon: '#7ff0ff' } },
  { x: 14, z: 12, face: -1, spec: { w: 9, d: 8, floors: 5, style: 'dark', seed: 94, roof: 'tile', shop: { name: '雾灯屋', color: '#e0e8ff', awning: ['#f4f8ff', '#9ab0e0'] }, signs: [{ text: '灯', color: '#e0e8ff', vertical: true }], neon: '#e0e8ff' } },
];
export const LEVEL_5: LevelDef = {
  id: 'cloud-isle', chapter: 5, name: '云端雾岛', mood: 'mist', half: 32,
  buildings: B5, poles: [], lamps: [[-5.2, -7, '#c8d8ff'], [5.2, 7, '#e0c8ff'], [-6.8, 12, '#9ab8ff'], [6.8, -12, '#c8d8ff']], cones: [],
  props: [...scatter(B5, 14, 5, (i, x, z) => ({ kind: i % 3 === 0 ? 'crystalPink' : 'crystal', x, z, arg: 0.9 + (i % 4) * 0.25 })), ...scatter(B5, 8, 9, (_i, x, z) => ({ kind: 'stoneLantern', x, z })), { kind: 'rock', x: -29, z: -3, seed: 3, arg: 1.2 }, { kind: 'rock', x: 29, z: 3, seed: 4, arg: 1.4 }],
  glows: [[0, 0, '#9ab8ff', 24], [-14, -6, '#c08aff', 16], [14, 6, '#7ff0ff', 16], [0, -18, '#e0e8ff', 14]],
  lights: [[0, 5, 0, 0x9ab8ff, 90, 26], [-14, 6, -4, 0xc08aff, 70, 22], [14, 6, 4, 0x7ff0ff, 70, 22]],
  tram: false, arches: [[0, -15, 0, '云梯', '#9ab8ff']], lanterns: [[-4.5, -9, 4.5, -9, 7, '#c8d8ff'], [-4.5, 9, 4.5, 9, 7, '#e0c8ff']],
  vents: [[-9, 0.5, -7.6], [9, 0.5, 7.6], [-3, 0.5, 8]],
  ground: { pave: '#3a4a7a', road: 0x8aa0d0 }, ...SPOTS,
};
const B6: Placed[] = [
  { x: -14, z: -12, face: 1, spec: { w: 10, d: 8, floors: 4, style: 'pink', seed: 101, roof: 'tile', shop: { name: '御膳房', color: '#ffd24a', awning: ['#fff8d8', '#d9a23a'] }, signs: [{ text: '膳', color: '#ffd24a', vertical: true }], neon: '#ffd24a' } },
  { x: 14, z: -12, face: 1, spec: { w: 10, d: 8, floors: 5, style: 'brick', seed: 102, roof: 'tile', shop: { name: '钦天监', color: '#ff7ad9', awning: ['#fff0f8', '#d9489a'] }, signs: [{ text: '天', color: '#ff7ad9', vertical: true }], neon: '#ff7ad9' } },
  { x: -14, z: 12, face: -1, spec: { w: 10, d: 8, floors: 4, style: 'brick', seed: 103, roof: 'tile', shop: { name: '藏经阁', color: '#c08aff', awning: ['#f0e8ff', '#8a5ae0'] }, signs: [{ text: '经', color: '#c08aff', vertical: true }], neon: '#c08aff' } },
  { x: 14, z: 12, face: -1, spec: { w: 10, d: 8, floors: 5, style: 'pink', seed: 104, roof: 'tile', shop: { name: '银库', color: '#ff5a5a', awning: ['#fff0f0', '#c83a3a'] }, signs: [{ text: '银', color: '#ff5a5a', vertical: true }], neon: '#ff5a5a' } },
];
export const LEVEL_6: LevelDef = {
  id: 'nine-palaces', chapter: 6, name: '九重宫阙', mood: 'palace', half: 32,
  buildings: B6, poles: [], lamps: [[-5.2, -7, '#ffd070'], [5.2, 7, '#ff9ad0'], [-6.8, 12, '#ffd070'], [6.8, -12, '#ffb070']], cones: [],
  props: [
    ...[-20, -10].flatMap((z) => [{ kind: 'pillar', x: -7, z, arg: 6 }, { kind: 'pillar', x: 7, z, arg: 6 }]) as PropDef[],
    { kind: 'stoneCat', x: -6.5, z: -17, ry: 0.3 }, { kind: 'stoneCat', x: 6.5, z: -17, ry: -0.3 },
    ...scatter(B6, 10, 6, (_i, x, z) => ({ kind: 'stoneLantern', x, z })), ...scatter(B6, 8, 11, (i, x, z) => ({ kind: i % 2 ? 'crystalPink' : 'bush', x, z, seed: i, arg: 0.9 })),
  ],
  glows: [[0, 0, '#ffd24a', 24], [-14, -6, '#ff7ad9', 16], [14, 6, '#c08aff', 16], [0, -18, '#ff5a5a', 14]],
  lights: [[0, 5, 0, 0xffd24a, 90, 26], [-14, 6, -4, 0xff7ad9, 70, 22], [14, 6, 4, 0xc08aff, 70, 22]],
  tram: false, arches: [[0, -15, 0, '九重宫阙', '#ffd24a'], [0, 17, 0, '午门', '#ff5a5a']],
  lanterns: [[-4.5, -9, 4.5, -9, 7, '#ff4a3a'], [-4.5, 9, 4.5, 9, 7, '#ffd24a'], [-4.5, -25, 4.5, -25, 7, '#ff4a3a']],
  vents: [[-9, 0.5, -7.6], [9, 0.5, 7.6]],
  ground: { pave: '#4a2a3a', road: 0xb09070 }, ...SPOTS,
};

export const LEVELS: Record<number, LevelDef> = { 1: LEVEL_1, 2: LEVEL_2, 3: LEVEL_3, 4: LEVEL_4, 5: LEVEL_5, 6: LEVEL_6 };
export const levelOf = (chapter: number): LevelDef => LEVELS[chapter] ?? LEVEL_1;

/** 碰撞盒（纯数据）：楼、电车、杆、拱门柱、道具 */
export function levelColliders(L: LevelDef): AABB[] {
  const out: AABB[] = [];
  for (const p of L.buildings) out.push({ x0: p.x - p.spec.w / 2 - 0.3, x1: p.x + p.spec.w / 2 + 0.3, z0: p.z - p.spec.d / 2 - 0.3, z1: p.z + p.spec.d / 2 + 0.3 });
  if (L.tram) out.push({ x0: -14, x1: -4.2, z0: 0.8, z1: 4.4 });
  for (const [x, z] of L.poles) out.push({ x0: x - 0.4, x1: x + 0.4, z0: z - 0.4, z1: z + 0.4 });
  for (const [x, z, ry] of L.arches) for (const s of [-1, 1]) { const px = x + (Math.abs(Math.sin(ry)) > 0.5 ? 0 : s * 4.9), pz = z + (Math.abs(Math.sin(ry)) > 0.5 ? s * 4.9 : 0); out.push({ x0: px - 0.5, x1: px + 0.5, z0: pz - 0.5, z1: pz + 0.5 }); }
  for (const p of L.props) out.push({ x0: p.x - 0.7, x1: p.x + 0.7, z0: p.z - 0.7, z1: p.z + 0.7 });
  if (L.water) out.push({ x0: L.water[0], x1: L.water[2], z0: L.water[1], z1: L.water[3] });
  for (const [x, z, sc] of L.trees ?? []) out.push({ x0: x - 1.1 * sc, x1: x + 1.1 * sc, z0: z - 1.1 * sc, z1: z + 1.1 * sc });
  for (const [x, z, ry] of L.containers ?? []) { const w = Math.abs(Math.sin(ry)) > 0.5 ? [1.6, 3.3] : [3.3, 1.6]; out.push({ x0: x - w[0], x1: x + w[0], z0: z - w[1], z1: z + w[1] }); }
  return out;
}
