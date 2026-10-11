// 关卡 1：纸箱街·霓虹巷口 —— 一块微缩景观：十字路口、四个街区、电车、招财猫、电线杆。
import * as THREE from 'three';
import { asphalt, glowTex, paving } from './tex';
import { bush, building, cardboardStack, cone, glowMat, lamp, manekiNeko, planterBox, pole, std, trashCan, tram, tree, vending, wire } from './kit';
import type { BuildingSpec } from './kit';
import { bakeStatic } from './bake';

export interface AABB { x0: number; x1: number; z0: number; z1: number }
export interface BuildingRef { low: THREE.Object3D; high: THREE.Object3D; x0: number; x1: number; z0: number; z1: number; top: number; t: number }
export interface Street { group: THREE.Group; colliders: AABB[]; spawn: THREE.Vector3; half: number; buildings: BuildingRef[] }

const HALF = 32;

interface Placed { spec: BuildingSpec; x: number; z: number; face: 1 | -1 }

const POLE_XZ: [number, number][] = [[-20, -5.2], [-6, -5.2], [6, 5.2], [20, 5.2], [-5.2, 18], [5.2, -18]];
const PROP_XZ: [number, number][] = [[-5.0, -7.4], [-3.6, -7.4], [8, 7.4], [-6.6, -7.2], [17, -6.6], [-18, 6.8], [5.8, 8.2], [9.5, -7.0], [-22, 7.0], [-8, -6.6], [10, 6.8], [21, -6.4], [-21, 6.8], [-17, -6.9], [20, 6.9], [4.6, -6.8], [-4.8, 6.9]];

/** 碰撞盒（纯数据，不需要 DOM；寻路与「实体摆放合法性」测试都用它） */
export function streetColliders(): AABB[] {
  const out: AABB[] = [];
  for (const p of BUILDINGS) out.push({ x0: p.x - p.spec.w / 2 - 0.3, x1: p.x + p.spec.w / 2 + 0.3, z0: p.z - p.spec.d / 2 - 0.3, z1: p.z + p.spec.d / 2 + 0.3 });
  out.push({ x0: -14, x1: -4.2, z0: 0.8, z1: 4.4 }); // 电车
  for (const [x, z] of POLE_XZ) out.push({ x0: x - 0.4, x1: x + 0.4, z0: z - 0.4, z1: z + 0.4 });
  for (const [x, z] of PROP_XZ) out.push({ x0: x - 0.7, x1: x + 0.7, z0: z - 0.7, z1: z + 0.7 });
  return out;
}

export const BUILDINGS: Placed[] = [
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



export function buildStreet(): Street {
  const g = new THREE.Group();
  const colliders = streetColliders();

  // ---- 地基：微缩景观的底座 ----
  const base = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2 + 4, 3, HALF * 2 + 4), std('#14101e', 0.6, 0.3));
  base.position.y = -1.6; base.receiveShadow = true; g.add(base);
  const rim = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2 + 4.4, 0.25, HALF * 2 + 4.4), glowMat('#ff2ea8'));
  rim.position.y = -0.18; g.add(rim);

  // ---- 路面 ----
  const at = asphalt(); at.wrapS = at.wrapT = THREE.RepeatWrapping; at.repeat.set(8, 1);
  const roadMat = new THREE.MeshStandardMaterial({ map: at, roughness: 0.32, metalness: 0.25 });
  const roadH = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, 9), roadMat); roadH.rotation.x = -Math.PI / 2; roadH.position.y = 0.02; roadH.receiveShadow = true; g.add(roadH);
  const atv = at.clone(); atv.repeat.set(1, 8); atv.needsUpdate = true;
  const roadV = new THREE.Mesh(new THREE.PlaneGeometry(9, HALF * 2), new THREE.MeshStandardMaterial({ map: atv, roughness: 0.32, metalness: 0.25 })); roadV.rotation.x = -Math.PI / 2; roadV.position.y = 0.03; roadV.receiveShadow = true; g.add(roadV);
  // 斑马线
  for (const [cx, cz, rot] of [[0, 6.2, 0], [0, -6.2, 0], [6.2, 0, 1], [-6.2, 0, 1]] as number[][]) {
    for (let i = -3; i <= 3; i++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 2.4), new THREE.MeshBasicMaterial({ color: 0xe8e4f0, transparent: true, opacity: 0.8 })); s.rotation.x = -Math.PI / 2; s.rotation.z = rot ? Math.PI / 2 : 0; s.position.set(cx + (rot ? 0 : i * 1.2), 0.05, cz + (rot ? i * 1.2 : 0)); g.add(s); }
  }
  // ---- 人行道（四个街区各一块）----
  const pv = paving('#5e5870'); pv.wrapS = pv.wrapT = THREE.RepeatWrapping; pv.repeat.set(8, 8);
  const pave = new THREE.MeshStandardMaterial({ map: pv, roughness: 0.6, metalness: 0.1 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const w = HALF - 4.5, cx = sx * (4.5 + w / 2), cz = sz * (4.5 + w / 2);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 0.32, w), pave); slab.position.set(cx, 0.16, cz); slab.receiveShadow = true; g.add(slab);
    const curb = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.06, w + 0.2), std('#8a8498', 0.7)); curb.position.set(cx, 0.34, cz); g.add(curb);
  }

  // ---- 楼 ----
  const refs: BuildingRef[] = [];
  for (const p of BUILDINGS) {
    const b = building(p.spec);
    b.position.set(p.x, 0.32, p.z);
    if (p.face < 0) b.rotation.y = Math.PI;
    g.add(b);
    const ud = b.userData as { low: THREE.Object3D; high: THREE.Object3D; top: number };
    refs.push({ low: ud.low, high: ud.high, x0: p.x - p.spec.w / 2, x1: p.x + p.spec.w / 2, z0: p.z - p.spec.d / 2, z1: p.z + p.spec.d / 2, top: 0.32 + ud.top, t: 1 });
  }
  // 屋顶上的招财猫（东北角那栋）
  const mk = manekiNeko(1.25); mk.position.set(2, 3 * 3.4 + 0.4 - 3.4, 0.5); mk.rotation.y = -0.35; refs[2].high.add(mk);

  // ---- 电车（停在南侧路沿，朝东）----
  const tr = tram(); tr.position.set(-9, 0.35, 2.6); tr.rotation.y = Math.PI / 2; g.add(tr);
  // 轨道
  for (const dz of [1.2, 4.0]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2, 0.06, 0.12), std('#8a8a98', 0.4, 0.8)); rail.position.set(0, 0.06, dz); g.add(rail); }

  // ---- 电线杆 + 电线 ----
  const poles: THREE.Vector3[] = [];
  for (const [x, z] of POLE_XZ) { const p = pole(11.5); p.position.set(x, 0.32, z); p.rotation.y = z === 5.2 || z === -5.2 ? 0 : Math.PI / 2; g.add(p); poles.push(new THREE.Vector3(x, 11.5, z)); }
  for (let i = 0; i + 1 < poles.length; i++) for (const dy of [0, -1.1]) for (const dz of [-1.0, 0, 1.0]) g.add(wire(poles[i].clone().add(new THREE.Vector3(0, dy - 0.2, dz * 0.3)), poles[i + 1].clone().add(new THREE.Vector3(0, dy - 0.2, dz * 0.3)), 0.9 + Math.abs(dz) * 0.2));

  // ---- 街边小东西 ----
  const props: [THREE.Object3D, number, number, number?][] = [
    [vending('#ff4aa8'), -5.0, -7.4, 0], [vending('#7ff0ff'), -3.6, -7.4, 0], [vending('#ffe27a'), 8, 7.4, Math.PI],
    [cardboardStack(1), -6.6, -7.2], [cardboardStack(2), 17, -6.6], [cardboardStack(3), -18, 6.8], [cardboardStack(4), 5.8, 8.2],
    [trashCan(), 9.5, -7.0], [trashCan('#4a3a5a'), -22, 7.0],
    [tree(3.4, 3), -8, -6.6], [tree(3.0, 4), 10, 6.8], [tree(3.6, 5), 21, -6.4], [tree(3.2, 6), -21, 6.8],
    [planterBox(2.4), -17, -6.9], [planterBox(2.0), 20, 6.9], [bush(0.8, 7), 4.6, -6.8], [bush(0.7, 8), -4.8, 6.9],
  ];
  for (const [o, x, z, ry] of props) { o.position.set(x, 0.32, z); if (ry !== undefined) o.rotation.y = ry; g.add(o); }
  for (const [x, z, c] of [[-2.5, -7, '#ffd8a0'], [3, 7, '#ff9ad0'], [-12, 6.8, '#7ff0ff'], [12, -6.9, '#ffd8a0'], [-6.8, 12, '#ffd8a0'], [6.8, -12, '#7ff0ff']] as [number, number, string][]) { const l = lamp(c); l.position.set(x, 0.32, z); g.add(l); }
  for (const [x, z] of [[1.5, 4.8], [-1.5, 4.8], [14, 4.8], [-14, -4.8], [4.8, 14], [-4.8, -14]] as number[][]) { const c = cone(); c.position.set(x, 0.05, z); g.add(c); }
  // 十字路口中央的霓虹地面光斑
  for (const [x, z, c, s] of [[0, 0, '#ff2ea8', 22], [-12, -6, '#7ff0ff', 14], [12, 6, '#9a7aff', 16], [-22, 6, '#ff7ad9', 12]] as [number, number, string, number][]) {
    const h = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ map: glowTex(), color: c, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    h.rotation.x = -Math.PI / 2; h.position.set(x, 0.08, z); g.add(h);
  }
  // 点光（少量，控制开销）：中央品红 + 左青 + 右紫
  for (const [x, y, z, c, i, r] of [[0, 5, 0, 0xff2ea8, 90, 26], [-14, 6, -4, 0x7ff0ff, 70, 22], [14, 6, 4, 0x9a7aff, 70, 22]] as number[][]) { const l = new THREE.PointLight(c, i, r, 1.6); l.position.set(x, y, z); g.add(l); }
  for (const r of refs) { bakeStatic(r.low); bakeStatic(r.high); }
  // 招财猫的 y 要跟着屋顶高度走（它不属于任何一栋的高层，所以保持独立）
  return { group: g, colliders, spawn: new THREE.Vector3(0, 0.32, 8), half: HALF, buildings: refs };
}
