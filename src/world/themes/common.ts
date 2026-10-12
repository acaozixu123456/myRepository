// 主题场景的共用件：地基裙边、倒影、收尾（合批 + 外圈），以及几样各主题都要的小零件。
import * as THREE from 'three';
import { bakeStatic } from '../bake';
import { glowMat, std } from '../kit';
import type { BuildingRef, Street } from '../street';
import type { LevelDef } from '../levels';
import { levelColliders } from '../levels';
import { glowTex, mk } from '../tex';
import { mulberry } from '../../fx/util';

export const nm = <T extends THREE.Object3D>(o: T): T => { o.userData.noMirror = true; return o; };

/** 微缩景观底座：四面裙边（颜色随主题）+ 很深的暗底 */
export function plinth(g: THREE.Group, half: number, color: string, edge?: string, deepColor = 0x050308) {
  const skirt = std(color, 0.7, 0.2);
  for (const [w, d, x, z] of [[half * 2 + 4.6, 0.8, 0, half + 2.2], [half * 2 + 4.6, 0.8, 0, -half - 2.2], [0.8, half * 2 + 4.6, half + 2.2, 0], [0.8, half * 2 + 4.6, -half - 2.2, 0]] as number[][]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 3.4, d), skirt); m.position.set(x, -1.4, z); g.add(nm(m)); }
  const deep = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial({ color: deepColor })); deep.rotation.x = -Math.PI / 2; deep.position.y = -45; g.add(nm(deep));
  if (edge) for (const [w, d, x, z] of [[half * 2 + 5.4, 0.35, 0, half + 2.5], [half * 2 + 5.4, 0.35, 0, -half - 2.5], [0.35, half * 2 + 5.4, half + 2.5, 0], [0.35, half * 2 + 5.4, -half - 2.5, 0]] as number[][]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, d), glowMat(edge)); m.position.set(x, 0.1, z); g.add(nm(m)); }
}

/** 一块铺满地图的地面（可平铺贴图） */
export function groundPlane(g: THREE.Group, half: number, tex: THREE.Texture, rep: number, o: { rough?: number; metal?: number; color?: number; y?: number } = {}) {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(rep, rep);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 + 3, half * 2 + 3), new THREE.MeshStandardMaterial({ map: tex, color: o.color ?? 0xffffff, roughness: o.rough ?? 0.95, metalness: o.metal ?? 0.02 }));
  m.rotation.x = -Math.PI / 2; m.position.y = o.y ?? 0.3; m.receiveShadow = true; g.add(nm(m));
  return m;
}

/** 沿折线铺一条带状路面（宽 w，两侧羽化的 alpha 贴图，纵向按长度重复） */
export function ribbon(g: THREE.Group, pts: [number, number][], w: number, tex: THREE.Texture, y = 0.34): THREE.Mesh {
  const L = pts.map((p, i) => i === 0 ? 0 : Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1])).reduce<number[]>((a, v) => (a.push((a[a.length - 1] ?? 0) + v), a), []);
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'catmullrom', 0.5);
  const N = pts.length * 14, pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const total = L[L.length - 1];
  for (let i = 0; i <= N; i++) {
    const t = i / N, p = curve.getPoint(t), tg = curve.getTangent(t), nx = -tg.z, nz = tg.x;
    pos.push(p.x + nx * w / 2, y, p.z + nz * w / 2, p.x - nx * w / 2, y, p.z - nz * w / 2);
    uv.push(0, t * total / 3, 1, t * total / 3);
    if (i < N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  tex.wrapT = THREE.RepeatWrapping;
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.receiveShadow = true; g.add(nm(m));
  return m;
}
/** 两侧羽化的带状贴图（泥路 / 石板路共用）：base 底色 + 颗粒 */
export function pathTex(key: string, base: string, speck: string[], edge = 0.28): THREE.CanvasTexture {
  return mk(128, 256, (c) => {
    const rnd = mulberry(key.length * 31 + 7);
    c.fillStyle = base; c.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 900; i++) { c.fillStyle = speck[Math.floor(rnd() * speck.length)]; c.globalAlpha = 0.25 + rnd() * 0.4; c.fillRect(rnd() * 128, rnd() * 256, 1 + rnd() * 3, 1 + rnd() * 3); }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'destination-in';
    const gr = c.createLinearGradient(0, 0, 128, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(edge, 'rgba(0,0,0,1)'); gr.addColorStop(1 - edge, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gr; c.fillRect(0, 0, 128, 256);
  }, key);
}

/** 萤火虫 / 光点：一个 Points，随时间缓慢飘动、明灭 */
export function motes(g: THREE.Group, o: { n: number; half: number; color: string; size?: number; h?: [number, number]; seed?: number; speed?: number }) {
  const rnd = mulberry(o.seed ?? 5), n = o.n;
  const base = new Float32Array(n * 3), pos = new Float32Array(n * 3), ph = new Float32Array(n);
  for (let i = 0; i < n; i++) { base[i * 3] = (rnd() - 0.5) * o.half * 1.8; base[i * 3 + 1] = (o.h?.[0] ?? 0.8) + rnd() * ((o.h?.[1] ?? 6) - (o.h?.[0] ?? 0.8)); base[i * 3 + 2] = (rnd() - 0.5) * o.half * 1.8; ph[i] = rnd() * 6.28; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: glowTex(), color: o.color, size: o.size ?? 0.7, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, sizeAttenuation: true }));
  pts.frustumCulled = false; pts.userData.noBake = true; pts.userData.noMirror = true;
  g.add(pts);
  const sp = o.speed ?? 1;
  return (t: number) => { for (let i = 0; i < n; i++) { pos[i * 3] = base[i * 3] + Math.sin(t * 0.4 * sp + ph[i]) * 1.4; pos[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 0.7 * sp + ph[i] * 2) * 0.6; pos[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 0.35 * sp + ph[i]) * 1.4; } geo.getAttribute('position').needsUpdate = true; pts.material.opacity = 0.75 + Math.sin(t * 2) * 0.1; };
}

export interface ThemeParts { group: THREE.Group; update: (t: number, dt: number) => void; refs?: BuildingRef[] }
/** 收尾：合批 → （可选）倒影 → 返回 Street */
export function finishTheme(L: LevelDef, g: THREE.Group, o: { update?: (t: number, dt: number) => void; mirror?: boolean; extra?: THREE.Object3D[]; refs?: BuildingRef[] } = {}): Street {
  g.traverse((x) => { if (x.userData.noMirror) x.userData.noBake = true; });
  bakeStatic(g);
  if (o.mirror) {
    const mirror = g.clone(true); const kill: THREE.Object3D[] = [];
    mirror.traverse((x) => { if (x.userData.noMirror || (x as THREE.Light).isLight) kill.push(x); if ((x as THREE.Mesh).isMesh) { x.castShadow = false; x.receiveShadow = false; } });
    for (const x of kill) x.removeFromParent();
    mirror.scale.y = -1; mirror.position.y = 0.06; g.add(mirror);
  }
  for (const x of o.extra ?? []) g.add(x);
  return { level: L, group: g, colliders: levelColliders(L), spawn: new THREE.Vector3(L.spawn[0], 0.32, L.spawn[1]), half: L.half, buildings: o.refs ?? [], update: o.update ?? (() => undefined) };
}

/** 一块软边的地面投影（树冠 / 屋檐 / 云影）：黑色径向渐变，不受光 */
let blobTexCache: THREE.CanvasTexture | null = null;
export const blobTex = () => blobTexCache ??= mk(128, 128, (c) => { const gr = c.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(0.55, 'rgba(0,0,0,.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(0, 0, 128, 128); }, 'blob');
export function shadowBlob(g: THREE.Group, x: number, z: number, rx: number, rz: number, o = 0.35, y = 0.37) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(rx * 2, rz * 2), new THREE.MeshBasicMaterial({ map: blobTex(), transparent: true, opacity: o, depthWrite: false, toneMapped: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); g.add(nm(m));
}
/** 斜射的阳光束（加色）：从 (x,z) 地面向太阳方向斜着升起，用于林间 / 殿前的「丁达尔」光柱 */
let shaftTexCache: THREE.CanvasTexture | null = null;
export const shaftTex = () => shaftTexCache ??= mk(64, 256, (c) => { const gr = c.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 64, 256); c.globalCompositeOperation = 'destination-in'; const g2 = c.createLinearGradient(0, 0, 0, 256); g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(0.25, 'rgba(0,0,0,1)'); g2.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g2; c.fillRect(0, 0, 64, 256); }, 'shaft');
export function lightShaft(g: THREE.Group, x: number, z: number, sun: [number, number, number], len = 22, w = 3.2, color = '#fff2c0', o = 0.2) {
  const dx = sun[0], dz = sun[2], dl = Math.hypot(dx, sun[1], dz);
  const ux = dx / dl, uy = sun[1] / dl, uz = dz / dl;
  for (const rot of [0, Math.PI / 2]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, len), new THREE.MeshBasicMaterial({ map: shaftTex(), color, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
    m.position.set(x + ux * len / 2, 0.4 + uy * len / 2, z + uz * len / 2);
    m.lookAt(x + ux * len, 0.4 + uy * len, z + uz * len); m.rotateZ(rot); m.rotateX(Math.PI / 2 * 0);
    m.userData.noBake = true; m.userData.noMirror = true; g.add(m);
  }
}
