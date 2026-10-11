// 把 LevelDef（levels.ts 里的纯数据）搭成 3D 场景：路、人行道、楼、道具、电线、拱门、灯笼、倒影、外圈都市、蒸汽。
import * as THREE from 'three';
import { asphalt, glowTex, paving } from './tex';
import { arch, building, glowMat, lamp, lanternString, manekiNeko, cone, pole, std, tram, wire } from './kit';
import { bakeStatic } from './bake';
import { buildBackdrop } from './backdrop';
import { buildSteam } from './steam';
import { LEVEL_1, levelColliders } from './levels';
import type { AABB, LevelDef } from './levels';
import { PROPS } from './props';

export type { AABB };
export interface BuildingRef { low: THREE.Object3D; high: THREE.Object3D; mirrorHigh?: THREE.Object3D; x0: number; x1: number; z0: number; z1: number; top: number; t: number }
export interface Street { level: LevelDef; group: THREE.Group; colliders: AABB[]; spawn: THREE.Vector3; half: number; buildings: BuildingRef[]; update(t: number, dt: number): void }
export const streetColliders = (L: LevelDef = LEVEL_1): AABB[] => levelColliders(L);

export function buildStreet(L: LevelDef = LEVEL_1): Street {
  const HALF = L.half;
  const g = new THREE.Group();
  const colliders = levelColliders(L);

  const nm = <T extends THREE.Object3D>(o: T): T => { o.userData.noMirror = true; return o; };
  // ---- 地基：微缩景观的底座（只做四面裙边 + 很深的暗色底；路面下面要留出空间给倒影）----
  const skirtMat = std('#14101e', 0.6, 0.3);
  for (const [w, d, x, z] of [[HALF * 2 + 4.6, 0.8, 0, HALF + 2.2], [HALF * 2 + 4.6, 0.8, 0, -HALF - 2.2], [0.8, HALF * 2 + 4.6, HALF + 2.2, 0], [0.8, HALF * 2 + 4.6, -HALF - 2.2, 0]] as number[][]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 3.4, d), skirtMat); m.position.set(x, -1.4, z); g.add(nm(m)); }
  const deep = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial({ color: 0x07040f })); deep.rotation.x = -Math.PI / 2; deep.position.y = -45; g.add(nm(deep));
  for (const [w, d, x, z] of [[HALF * 2 + 5.4, 0.35, 0, HALF + 2.5], [HALF * 2 + 5.4, 0.35, 0, -HALF - 2.5], [0.35, HALF * 2 + 5.4, HALF + 2.5, 0], [0.35, HALF * 2 + 5.4, -HALF - 2.5, 0]] as number[][]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, d), glowMat('#ff2ea8')); m.position.set(x, 0.1, z); g.add(nm(m)); }

  // ---- 路面 ----
  const at = asphalt(); at.wrapS = at.wrapT = THREE.RepeatWrapping; at.repeat.set(8, 1);
  const roadMat = new THREE.MeshStandardMaterial({ map: at, roughness: 0.32, metalness: 0.25, transparent: true, opacity: 0.84 });
  const roadH = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, 9), roadMat); roadH.rotation.x = -Math.PI / 2; roadH.position.y = 0.02; roadH.receiveShadow = true; g.add(nm(roadH));
  const atv = at.clone(); atv.repeat.set(1, 8); atv.needsUpdate = true;
  const roadV = new THREE.Mesh(new THREE.PlaneGeometry(9, HALF * 2), new THREE.MeshStandardMaterial({ map: atv, roughness: 0.32, metalness: 0.25, transparent: true, opacity: 0.84 })); roadV.rotation.x = -Math.PI / 2; roadV.position.y = 0.03; roadV.receiveShadow = true; g.add(nm(roadV));
  // 斑马线
  for (const [cx, cz, rot] of [[0, 6.2, 0], [0, -6.2, 0], [6.2, 0, 1], [-6.2, 0, 1]] as number[][]) {
    for (let i = -3; i <= 3; i++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 2.4), new THREE.MeshBasicMaterial({ color: 0xe8e4f0, transparent: true, opacity: 0.8 })); s.rotation.x = -Math.PI / 2; s.rotation.z = rot ? Math.PI / 2 : 0; s.position.set(cx + (rot ? 0 : i * 1.2), 0.05, cz + (rot ? i * 1.2 : 0)); g.add(nm(s)); }
  }
  // ---- 人行道（四个街区各一块）----
  const pv = paving('#34304a'); pv.wrapS = pv.wrapT = THREE.RepeatWrapping; pv.repeat.set(8, 8);
  const pave = new THREE.MeshStandardMaterial({ map: pv, color: 0x77728c, roughness: 0.88, metalness: 0.05, envMapIntensity: 0.3 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const w = HALF - 4.5, cx = sx * (4.5 + w / 2), cz = sz * (4.5 + w / 2);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 0.32, w), pave); slab.position.set(cx, 0.16, cz); slab.receiveShadow = true; g.add(nm(slab));
    const curb = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.06, w + 0.2), std('#8a8498', 0.7)); curb.position.set(cx, 0.34, cz); g.add(nm(curb));
  }

  // ---- 楼 ----
  const refs: BuildingRef[] = [];
  for (const p of L.buildings) {
    const b = building(p.spec);
    b.position.set(p.x, 0.32, p.z);
    if (p.face < 0) b.rotation.y = Math.PI;
    g.add(b);
    const ud = b.userData as { low: THREE.Object3D; high: THREE.Object3D; top: number };
    refs.push({ low: ud.low, high: ud.high, x0: p.x - p.spec.w / 2, x1: p.x + p.spec.w / 2, z0: p.z - p.spec.d / 2, z1: p.z + p.spec.d / 2, top: 0.32 + ud.top, t: 1 });
  }
  // 屋顶上的招财猫（东北角那栋）
  if (L.chapter === 1) { const mk = manekiNeko(1.25); mk.position.set(2, 3 * 3.4 + 0.4 - 3.4, 0.5); mk.rotation.y = -0.35; refs[2].high.add(mk); }

  // ---- 电车（停在南侧路沿，朝东）----
  if (L.tram) {
    const tr = tram(); tr.position.set(-9, 0.35, 2.6); tr.rotation.y = Math.PI / 2; g.add(tr);
    for (const dz of [1.2, 4.0]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2, 0.06, 0.12), std('#8a8a98', 0.4, 0.8)); rail.position.set(0, 0.06, dz); g.add(rail); }
  }
  for (const [x, z, ry, text, color] of L.arches) { const a = arch(text, color); a.position.set(x, 0.32, z); a.rotation.y = ry; g.add(a); }
  for (const [x0, z0, x1, z1, y, color] of L.lanterns) g.add(lanternString(new THREE.Vector3(x0, y, z0), new THREE.Vector3(x1, y, z1), color));

  // ---- 电线杆 + 电线 ----
  const poles: THREE.Vector3[] = [];
  for (const [x, z] of L.poles) { const p = pole(11.5); p.position.set(x, 0.32, z); p.rotation.y = z === 5.2 || z === -5.2 ? 0 : Math.PI / 2; g.add(p); poles.push(new THREE.Vector3(x, 11.5, z)); }
  for (let i = 0; i + 1 < poles.length; i++) for (const dy of [0, -1.1]) for (const dz of [-1.0, 0, 1.0]) g.add(wire(poles[i].clone().add(new THREE.Vector3(0, dy - 0.2, dz * 0.3)), poles[i + 1].clone().add(new THREE.Vector3(0, dy - 0.2, dz * 0.3)), 0.9 + Math.abs(dz) * 0.2));

  // ---- 街边小东西 ----
  for (const p of L.props) {
    const make = PROPS[p.kind];
    if (!make) continue;
    const o = make(p.seed, p.arg);
    o.position.set(p.x, 0.32, p.z); if (p.ry !== undefined) o.rotation.y = p.ry;
    g.add(o);
  }
  for (const [x, z, c] of L.lamps) { const l = lamp(c); l.position.set(x, 0.32, z); g.add(l); }
  for (const [x, z] of L.cones) { const c = cone(); c.position.set(x, 0.05, z); g.add(c); }
  // 十字路口中央的霓虹地面光斑
  for (const [x, z, c, s] of L.glows) {
    const h = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ map: glowTex(), color: c, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    h.rotation.x = -Math.PI / 2; h.position.set(x, 0.08, z); g.add(nm(h));
  }
  // 点光（少量，控制开销）：中央品红 + 左青 + 右紫
  for (const [x, y, z, c, i, r] of L.lights) { const l = new THREE.PointLight(c, i, r, 1.6); l.position.set(x, y, z); g.add(l); }
  for (const r of refs) { bakeStatic(r.low); bakeStatic(r.high); }
  // 其余静态景物（道具、杆、线、电车…）也合批；建筑 / 地面（倒影要排除）保持独立
  const keep = (o: THREE.Object3D) => o.traverse((m) => { m.userData.noBake = true; });
  for (const r of refs) { keep(r.low); keep(r.high); }
  g.traverse((o) => { if (o.userData.noMirror) o.userData.noBake = true; });
  bakeStatic(g);
  // ---- 湿地面倒影：把景物沿路面翻一份（不含地面本身 / 灯），透过半透明的路面看到 ----
  refs.forEach((r, i) => { r.high.userData.mirrorKey = i; });
  const mirror = g.clone(true);
  const kill: THREE.Object3D[] = [];
  mirror.traverse((o) => { if (o.userData.noMirror || (o as THREE.Light).isLight) kill.push(o); if ((o as THREE.Mesh).isMesh) { o.castShadow = false; o.receiveShadow = false; } if (o.userData.mirrorKey !== undefined) refs[o.userData.mirrorKey as number].mirrorHigh = o; });
  for (const o of kill) o.removeFromParent();
  mirror.scale.y = -1; mirror.position.y = 0.06;
  g.add(mirror);
  // ---- 外圈都市 + 蒸汽 ----
  const bd = buildBackdrop(); g.add(bd.group);
  const steam = buildSteam(L.vents);
  g.add(steam.group);
  return { level: L, group: g, colliders, spawn: new THREE.Vector3(L.spawn[0], 0.32, L.spawn[1]), half: HALF, buildings: refs, update: (t, dt) => { bd.update(t); steam.update(dt); } };
}
