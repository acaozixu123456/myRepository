// 关卡数据（纯数据，不依赖 DOM / three：寻路、实体摆放合法性测试、玩法规则都读它）。
// 一个关卡 = 十字路口街区；楼、道具、灯、电线杆、实体出生点都在这里摆。新增关卡：加一份 LevelDef，必要时在 kit / props 里补新道具。
import { cloudLevel } from './themes/cloud.data';
import { desertLevel } from './themes/desert.data';
import { snowLevel } from './themes/snow.data';
import { beachLevel } from './themes/beach.data';
import { onsenLevel } from './themes/onsen.data';
import { forestLevel } from './themes/forest.data';
import { harborLevel } from './themes/harbor.data';
import { marketLevel } from './themes/market.data';
import { palaceLevel } from './themes/palace.data';
import type { BuildingSpec } from './kit';

export interface Placed { spec: BuildingSpec; x: number; z: number; face: 1 | -1 }
/** 场景里的玩法入口：走近触发一个小游戏（game 对应 app 层注册的小游戏名） */
export type ThemeId = 'street' | 'market' | 'harbor' | 'forest' | 'cloud' | 'palace' | 'desert' | 'snow' | 'beach' | 'onsen';
export interface PoiDef { id: string; game: string; x: number; z: number; label: string }
export interface PropDef { kind: string; x: number; z: number; ry?: number; seed?: number; arg?: number }
export interface AABB { x0: number; x1: number; z0: number; z1: number }
export type MoodId = 'neon' | 'street' | 'market' | 'redcliff' | 'forest' | 'mist' | 'palace' | 'meadow' | 'desert' | 'snow' | 'beach' | 'onsen';
export interface LevelDef {
  id: string; chapter: number; name: string; mood: MoodId; half: number;
  /** 场景主题：street = 十字街区（旧逻辑）；其余各有独立布局 / 地面 / 建筑 / 天空（src/world/themes/） */
  theme?: ThemeId;
  /** 主题场景的碰撞盒（布局的唯一数据源：渲染与寻路都从它来）；street 主题不用，走 buildings / props 推导 */
  solids?: AABB[];
  /** 天气：rain = 雨夜（默认）；none = 无雨（森林 / 云岛 / 宫阙靠雾和萤火虫） */
  weather?: 'rain' | 'none';
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
  enemySpots: [number, number][]; chestSpots: [number, number][]; herbSpots?: [number, number][]; pois?: PoiDef[]; bossSpot: [number, number]; npcSpot: [number, number]; spawn: [number, number];
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
/** 玩法入口周围的安全区半径：野猫不会刷在里面，也追不进来；队伍在里面时不会被开战 */
export const SAFE_R = 8;
export const inSafeZone = (L: LevelDef, x: number, z: number, r = SAFE_R) => poisOf(L).some((p) => Math.hypot(p.x - x, p.z - z) < r);
export const poisOf = (L: LevelDef): PoiDef[] => L.pois ?? [];
export const herbsOf = (L: LevelDef): [number, number][] => L.herbSpots ?? DEFAULT_HERBS;
const L1_POLES: [number, number][] = [[-20, -5.2], [-6, -5.2], [6, 5.2], [20, 5.2], [-5.2, 18], [5.2, -18]];
const L1_PROPS: PropDef[] = [
  { kind: 'vending', x: -5.0, z: -7.4, ry: 0 }, { kind: 'vendingCyan', x: -3.6, z: -7.4, ry: 0 }, { kind: 'vendingGold', x: 8, z: 7.4, ry: Math.PI },
  { kind: 'cardboard', x: -6.6, z: -7.2, seed: 1 }, { kind: 'cardboard', x: 17, z: -6.6, seed: 2 }, { kind: 'cardboard', x: -18, z: 6.8, seed: 3 }, { kind: 'cardboard', x: 5.8, z: 8.2, seed: 4 },
  { kind: 'trash', x: 9.5, z: -7.0 }, { kind: 'trashB', x: -22, z: 7.0 },
  { kind: 'tree', x: -8, z: -6.6, seed: 3, arg: 3.4 }, { kind: 'tree', x: 10, z: 6.8, seed: 4, arg: 3.0 }, { kind: 'tree', x: 21, z: -6.4, seed: 5, arg: 3.6 }, { kind: 'tree', x: -21, z: 6.8, seed: 6, arg: 3.2 },
  { kind: 'guardrail', x: -17.5, z: 5.3, arg: 3.2 }, { kind: 'guardrail', x: 15, z: -5.3, arg: 3.2 }, { kind: 'busStop', x: -11.5, z: 5.9, ry: Math.PI }, { kind: 'manhole', x: 11, z: -5.9 }, { kind: 'manhole', x: 13.5, z: 6.0 }, { kind: 'clothesline', x: -12.5, z: -5.6 },
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
  // 店铺玩法：九命电器门口的夹娃娃机、赛博猫网咖里的鼠标大作战
  pois: [{ id: 'boxcat', game: 'boxcat', x: -10.5, z: -5.4, label: '纸箱寻猫' }, { id: 'claw', game: 'claw', x: -25, z: -5.8, label: '九命电器 · 夹娃娃' }, { id: 'whack', game: 'whack', x: 25, z: -5.8, label: '赛博猫网咖 · 鼠标大作战' }],
  ...SPOTS,
};

// ---------- 关卡 2：霓虹夜市 ----------
export const LEVEL_2: LevelDef = marketLevel(); // 独立布局，见 themes/market.data.ts

// ---------- 关卡 3：赤壁霓虹港（独立布局，见 themes/harbor.data.ts）----------
export const LEVEL_3: LevelDef = harborLevel();

// ---------- 关卡 4：霓虹森林（独立布局，见 themes/forest.data.ts）----------
export const LEVEL_4: LevelDef = forestLevel();

// ---------- 关卡 5：云端雾岛 / 关卡 6：九重宫阙 ----------
// 关卡 5：云端雾岛（独立布局，见 themes/cloud.data.ts）
export const LEVEL_5: LevelDef = cloudLevel();
// ---------- 关卡 6：九重宫阙（独立布局，见 themes/palace.data.ts）----------
export const LEVEL_6: LevelDef = palaceLevel();

export const LEVELS: Record<number, LevelDef> = { 1: LEVEL_1, 2: LEVEL_2, 3: LEVEL_3, 4: LEVEL_4, 5: LEVEL_5, 6: LEVEL_6 };

// ---------- 附加场景（不在主线章节里，没有首领；通关到某一章后解锁，专门用来玩各自的小游戏）----------
export const BONUS_BASE = 100;
/** 沙漠绿洲：卡丁车赛道 + 绿洲钓鱼（见 themes/desert.data.ts） */
export const LEVEL_DESERT: LevelDef = desertLevel();
/** 喵雪岭：雪橇 + 叠雪猫（见 themes/snow.data.ts） */
export const LEVEL_SNOW: LevelDef = snowLevel();
/** 椰风海湾：冲浪 + 栈桥钓鱼 + 赶海（见 themes/beach.data.ts） */
export const LEVEL_BEACH: LevelDef = beachLevel();
/** 樱汤乡：打水漂 + 锦鲤池钓鱼 + 回转寿司（见 themes/onsen.data.ts） */
export const LEVEL_ONSEN: LevelDef = onsenLevel();
export const BONUS_LEVELS: Record<number, LevelDef> = { 101: LEVEL_DESERT, 102: LEVEL_SNOW, 103: LEVEL_BEACH, 104: LEVEL_ONSEN };
/** 附加场景解锁条件：主线首领所在章节 ≥ 该值 */
export const BONUS_UNLOCK: Record<number, number> = { 101: 3, 102: 5, 103: 2, 104: 4 };
/** 所有场景（主线 + 附加），测试和场景选择都用它 */
export const ALL_SCENES: Record<number, LevelDef> = { ...LEVELS, ...BONUS_LEVELS };
export const isBonusScene = (id: number) => id > BONUS_BASE;
export const levelOf = (chapter: number): LevelDef => ALL_SCENES[chapter] ?? LEVEL_1;

/** 碰撞盒（纯数据）：楼、电车、杆、拱门柱、道具 */
export function levelColliders(L: LevelDef): AABB[] {
  if (L.theme && L.theme !== 'street') return L.solids ?? [];
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

/** 寻路网格的格子边长（世界单位） */
export const CELL = 1;
/** 阻挡网格：碰撞盒外扩 0.9 再栅格化，四周留 2 格边界。explore.ts 的寻路与可达性测试共用这一份，布局改了不会各走各的 */
export function blockedGrid(cols: AABB[], half: number): Uint8Array {
  const N = (half * 2) / CELL, grid = new Uint8Array(N * N), pad = 0.9;
  for (const c of cols) {
    const x0 = Math.max(0, Math.floor((c.x0 - pad + half) / CELL)), x1 = Math.min(N - 1, Math.floor((c.x1 + pad + half) / CELL));
    const z0 = Math.max(0, Math.floor((c.z0 - pad + half) / CELL)), z1 = Math.min(N - 1, Math.floor((c.z1 + pad + half) / CELL));
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) grid[z * N + x] = 1;
  }
  for (let i = 0; i < N; i++) for (const k of [0, 1, N - 2, N - 1]) { grid[i * N + k] = 1; grid[k * N + i] = 1; }
  return grid;
}
/** 从出生点洪水填充，返回「走得到」的格子集合（8 邻域，不切角） */
export function reachableCells(L: LevelDef): { N: number; grid: Uint8Array; seen: Uint8Array } {
  const N = (L.half * 2) / CELL, grid = blockedGrid(levelColliders(L), L.half), seen = new Uint8Array(N * N);
  const cx = Math.min(N - 1, Math.max(0, Math.floor((L.spawn[0] + L.half) / CELL))), cz = Math.min(N - 1, Math.max(0, Math.floor((L.spawn[1] + L.half) / CELL)));
  const q = [cz * N + cx]; seen[q[0]] = 1;
  for (let i = 0; i < q.length; i++) {
    const x = q[i] % N, z = Math.floor(q[i] / N);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= N || nz >= N || seen[nz * N + nx] || grid[nz * N + nx]) continue;
      if (dx && dz && (grid[z * N + nx] || grid[nz * N + x])) continue;
      seen[nz * N + nx] = 1; q.push(nz * N + nx);
    }
  }
  return { N, grid, seen };
}

const hiddenCache = new Map<string, [number, number][]>();
/** 隐藏宝箱的位置（每关 3 个）：走得到、离出生点 / 其他东西远、四周挡得最多的「死角」格子，种子固定，每次进来都在同一个地方 */
export function hiddenSpotsOf(L: LevelDef): [number, number][] {
  const hit = hiddenCache.get(L.id);
  if (hit) return hit;
  const { N, grid, seen } = reachableCells(L);
  const others: [number, number][] = [L.spawn, L.bossSpot, L.npcSpot, ...L.enemySpots, ...L.chestSpots, ...herbsOf(L), ...poisOf(L).map((p): [number, number] => [p.x, p.z])];
  const cand: { x: number; z: number; score: number }[] = [];
  for (let cz = 3; cz < N - 3; cz++) for (let cx = 3; cx < N - 3; cx++) {
    if (!seen[cz * N + cx]) continue;
    const x = (cx + 0.5) - L.half, z = (cz + 0.5) - L.half;
    if (others.some(([ox, oz]) => Math.hypot(ox - x, oz - z) < 9) || inSafeZone(L, x, z)) continue;
    let blocked = 0;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) blocked += grid[(cz + dz) * N + cx + dx];
    if (blocked >= 6 && blocked <= 18) cand.push({ x, z, score: blocked });
  }
  let seed = 0; for (const ch of L.id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  cand.sort((a, b) => b.score - a.score);
  const pool = cand.slice(0, Math.max(30, Math.floor(cand.length / 3)));
  const out: [number, number][] = [];
  for (let guard = 0; guard < 200 && out.length < 3 && pool.length; guard++) {
    const c = pool[Math.floor(rnd() * pool.length)];
    if (out.every(([ox, oz]) => Math.hypot(ox - c.x, oz - c.z) > 16)) out.push([c.x, c.z]);
  }
  hiddenCache.set(L.id, out);
  return out;
}

export const COVER_R = 3;
const coverCache = new Map<string, [number, number][]>();
/** 掩体（纸箱堆 / 草丛 / 货箱 / 木桶 / 云团 / 屏风，按场景换皮）：每只野怪附近 5~9 米处一个，让玩家有地方躲着摸过去。
 *  可走、不挡路；躲在里面（半径 COVER_R）敌人的视野缩到潜行水平，从里面出手算偷袭。位置固定。 */
export function coverSpotsOf(L: LevelDef): [number, number][] {
  const hit = coverCache.get(L.id);
  if (hit) return hit;
  const { N, grid, seen } = reachableCells(L);
  const taken: [number, number][] = [L.spawn, L.bossSpot, L.npcSpot, ...L.chestSpots, ...herbsOf(L), ...hiddenSpotsOf(L), ...poisOf(L).map((p): [number, number] => [p.x, p.z])];
  let seed = 7; for (const ch of L.id) seed = (seed * 33 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const out: [number, number][] = [];
  for (const [ex, ez] of L.enemySpots) {
    const cand: [number, number][] = [];
    for (let cz = 4; cz < N - 4; cz++) for (let cx = 4; cx < N - 4; cx++) {
      if (!seen[cz * N + cx]) continue;
      const x = cx + 0.5 - L.half, z = cz + 0.5 - L.half, d = Math.hypot(x - ex, z - ez);
      if (d < 5.5 || d > 9.5 || inSafeZone(L, x, z)) continue;
      let blocked = 0;
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) blocked += grid[(cz + dz) * N + cx + dx];
      if (blocked > 4) continue; // 开阔处，别卡在墙角
      if (taken.some(([ox, oz]) => Math.hypot(ox - x, oz - z) < 5) || out.some(([ox, oz]) => Math.hypot(ox - x, oz - z) < 8)) continue;
      cand.push([x, z]);
    }
    if (cand.length) out.push(cand[Math.floor(rnd() * cand.length)]);
  }
  coverCache.set(L.id, out);
  return out;
}

export const PORTAL_R = 1.6;
const portalCache = new Map<string, [number, number][]>();
/** 传送门一对（A ↔ B）：开阔、走得到、彼此相隔 ≥ 26 米、离其他东西 ≥ 8 米。走进一个就出现在另一个——抄近路，也能甩掉追兵。位置固定 */
export function portalSpotsOf(L: LevelDef): [number, number][] {
  const hit = portalCache.get(L.id);
  if (hit) return hit;
  const { N, grid, seen } = reachableCells(L);
  const taken: [number, number][] = [L.spawn, L.bossSpot, L.npcSpot, ...L.enemySpots, ...L.chestSpots, ...herbsOf(L), ...hiddenSpotsOf(L), ...coverSpotsOf(L), ...poisOf(L).map((p): [number, number] => [p.x, p.z])];
  // 候选：走得到、四周不太挤、离其他东西有点距离；挤的场景（夜市主街两侧都是玩法安全区）放宽到 3.5 米
  const collect = (gap: number) => {
    const out: [number, number][] = [];
    for (let cz = 5; cz < N - 5; cz++) for (let cx = 5; cx < N - 5; cx++) {
      if (!seen[cz * N + cx]) continue;
      const x = cx + 0.5 - L.half, z = cz + 0.5 - L.half;
      if (inSafeZone(L, x, z) || taken.some(([ox, oz]) => Math.hypot(ox - x, oz - z) < gap)) continue;
      let blocked = 0;
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) blocked += grid[(cz + dz) * N + cx + dx];
      if (blocked <= 4) out.push([x, z]);
    }
    return out;
  };
  let cand = collect(6);
  const span = (c: [number, number][]) => { let lo = Infinity, hi = -Infinity; for (const [, z] of c) { lo = Math.min(lo, z); hi = Math.max(hi, z); } return hi - lo; };
  if (span(cand) < 20) cand = collect(3.5);
  let seed = 3; for (const ch of L.id) seed = (seed * 37 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  let out: [number, number][] = [];
  for (let g = 0; g < 400 && cand.length > 1 && !out.length; g++) {
    const a = cand[Math.floor(rnd() * cand.length)], b = cand[Math.floor(rnd() * cand.length)];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) >= Math.min(26, L.half)) out = [a, b];
  }
  if (!out.length && cand.length > 1) { // 兜底：取候选里相距最远的一对
    let best = 0;
    const step = Math.max(1, Math.floor(cand.length / 400));
    for (let i = 0; i < cand.length; i += step) for (let j = i + 1; j < cand.length; j++) { const d = Math.hypot(cand[i][0] - cand[j][0], cand[i][1] - cand[j][1]); if (d > best) { best = d; out = [cand[i], cand[j]]; } }
  }
  portalCache.set(L.id, out);
  return out;
}

/** 场景机关（地形区）：云岛 = 风口（顺风加速）/ 码头 = 潮汐滩 / 沙漠 = 流沙（队伍和追兵都变慢）/ 宫阙 = 琉璃滑地（松手还会滑一段）；其余场景没有 */
export type ZoneKind = 'wind' | 'tide' | 'slide' | 'sand';
export interface Zone { x: number; z: number; r: number; kind: ZoneKind; dx: number; dz: number }
const zoneCache = new Map<string, Zone[]>();
const ZONE_BY_THEME: Partial<Record<string, ZoneKind>> = { cloud: 'wind', harbor: 'tide', palace: 'slide', desert: 'sand', snow: 'slide', beach: 'tide' };
export function zonesOf(L: LevelDef): Zone[] {
  const hit = zoneCache.get(L.id);
  if (hit) return hit;
  const kind = ZONE_BY_THEME[L.theme ?? 'street'];
  const out: Zone[] = [];
  if (kind) {
    const { N, grid, seen } = reachableCells(L);
    const taken: [number, number][] = [L.spawn, L.bossSpot, L.npcSpot, ...L.enemySpots, ...L.chestSpots, ...herbsOf(L), ...hiddenSpotsOf(L), ...coverSpotsOf(L), ...portalSpotsOf(L), ...poisOf(L).map((p): [number, number] => [p.x, p.z])];
    let seed = 5; for (const ch of L.id) seed = (seed * 41 + ch.charCodeAt(0)) >>> 0;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    const cand: [number, number][] = [];
    for (let cz = 5; cz < N - 5; cz++) for (let cx = 5; cx < N - 5; cx++) {
      if (!seen[cz * N + cx]) continue;
      const x = cx + 0.5 - L.half, z = cz + 0.5 - L.half;
      if (inSafeZone(L, x, z) || taken.some(([ox, oz]) => Math.hypot(ox - x, oz - z) < 6)) continue;
      let blocked = 0;
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) blocked += grid[(cz + dz) * N + cx + dx];
      if (blocked <= 3) cand.push([x, z]);
    }
    for (let g = 0; g < 300 && out.length < 4 && cand.length; g++) {
      const [x, z] = cand[Math.floor(rnd() * cand.length)];
      if (out.some((o) => Math.hypot(o.x - x, o.z - z) < 12)) continue;
      const a = rnd() * Math.PI * 2;
      out.push({ x, z, r: 3.2, kind, dx: Math.sin(a), dz: Math.cos(a) });
    }
  }
  zoneCache.set(L.id, out);
  return out;
}
