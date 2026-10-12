// 九重宫阙（午后金光）：蓝天白云下，汉白玉铺地、朱墙金瓦。南面午门，中轴御道笔直通向北面台阶尽头的金殿；
// 一条金水河上三座石桥，两侧是长廊和钟鼓楼，铜香炉冒着青烟，银杏叶金灿灿地飘落。庄严、明亮、对称。
import * as THREE from 'three';
import { mulberry } from '../../fx/util';
import { atmosOf } from '../atmos';
import { glowMat, stoneCat, std } from '../kit';
import { glowTex, mk, waterGlint } from '../tex';
import type { LevelDef } from '../levels';
import type { Street } from '../street';
import { balustrade, banner, eaveRoof, hall, lantern, pagoda, redPillar } from './arch';
import { BRIDGES, BURNERS, GALLERY_X, GATE_Z, HALL, PAVILIONS, RIVER } from './palace.data';
import { finishTheme, groundPlane, lightShaft, motes, nm, plinth, shadowBlob } from './common';

const box = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; };
const cyl = (r0: number, r1: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 10) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat); m.position.set(x, y, z); m.castShadow = true; return m; };

const marbleTex = () => mk(256, 256, (c) => {
  const rnd = mulberry(15);
  c.fillStyle = '#f2ede2'; c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 24; i++) { c.strokeStyle = `rgba(150,140,125,${0.06 + rnd() * 0.1})`; c.lineWidth = 1 + rnd() * 2; c.beginPath(); c.moveTo(rnd() * 256, rnd() * 256); c.bezierCurveTo(rnd() * 256, rnd() * 256, rnd() * 256, rnd() * 256, rnd() * 256, rnd() * 256); c.stroke(); }
  c.strokeStyle = 'rgba(120,105,85,.6)'; c.lineWidth = 3; c.strokeRect(1, 1, 254, 254); c.beginPath(); c.moveTo(128, 0); c.lineTo(128, 256); c.moveTo(0, 128); c.lineTo(256, 128); c.stroke();
  c.fillStyle = 'rgba(190,150,70,.5)'; for (const [x, y] of [[64, 64], [192, 64], [64, 192], [192, 192]]) { c.beginPath(); c.arc(x, y, 6, 0, 7); c.fill(); }
}, 'palace-marble');
const roadTex = () => mk(128, 256, (c) => {
  c.fillStyle = '#e9d8a8'; c.fillRect(0, 0, 128, 256);
  c.strokeStyle = '#c8a050'; c.lineWidth = 4; c.strokeRect(6, 6, 116, 244);
  c.strokeStyle = 'rgba(200,150,60,.7)'; c.lineWidth = 3;
  for (let y = 20; y < 256; y += 64) { c.beginPath(); c.arc(64, y + 20, 22, 0, 7); c.stroke(); c.beginPath(); c.arc(64, y + 20, 12, 0, 7); c.stroke(); for (const s of [-1, 1]) { c.beginPath(); c.arc(64 + s * 38, y + 20, 8, 0, 7); c.stroke(); } }
}, 'palace-road');

/** 银杏树：细干 + 金黄的扇形树冠 */
function ginkgo(scale: number): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.3, 0.45, 5, std('#6a4a30', 0.9), 0, 2.5, 0, 7));
  const m = std('#f0c030', 0.8, 0.02, '#a87a10', 0.18);
  for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1.8 + (i % 2) * 0.6, 0), m); c.position.set(Math.cos(i * 1.26) * 1.4, 5.4 + (i % 3) * 0.7, Math.sin(i * 1.26) * 1.4); c.castShadow = true; g.add(c); }
  g.scale.setScalar(scale); return g;
}
function burner(): THREE.Group {
  const g = new THREE.Group(); const br = std('#b08a3a', 0.45, 0.6);
  g.add(box(2.4, 0.5, 2.4, std('#e8e0d0', 0.8), 0, 0.25, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(cyl(0.12, 0.18, 1.0, br, sx * 0.7, 1.0, sz * 0.7, 6));
  g.add(cyl(1.0, 0.8, 1.2, br, 0, 1.9, 0, 12)); g.add(cyl(1.1, 1.1, 0.14, br, 0, 2.55, 0, 12));
  g.add(cyl(0.5, 0.7, 0.6, br, 0, 2.9, 0, 10)); const kn = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 5), br); kn.position.y = 3.35; g.add(kn);
  return g;
}

export function buildPalace(L: LevelDef): Street {
  const g = new THREE.Group(); const half = L.half; const A = atmosOf(L.mood); const rnd = mulberry(606);
  plinth(g, half, '#d8d0c0', undefined, A.fog);
  groundPlane(g, half, (() => { const t = marbleTex(); return t; })(), 14, { rough: 0.5, metal: 0.05 });
  const rt = roadTex(); rt.wrapS = rt.wrapT = THREE.RepeatWrapping; rt.repeat.set(1, 10);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(7.5, GATE_Z + 24), new THREE.MeshStandardMaterial({ map: rt, roughness: 0.6 })); road.rotation.x = -Math.PI / 2; road.position.set(0, 0.34, (GATE_Z - 24) / 2 - 0.5); road.receiveShadow = true; g.add(nm(road));
  const redM = std('#b83228', 0.55, 0.1), goldM = std('#e8b04a', 0.4, 0.5), marble = std('#f2ede2', 0.55), wallM = std('#c43a30', 0.7);

  // ---- 金水河 + 三座石桥 ----
  const rw = half * 2 + 4, rz = (RIVER.z0 + RIVER.z1) / 2, rd = RIVER.z1 - RIVER.z0;
  const water = new THREE.Mesh(new THREE.PlaneGeometry(rw, rd), new THREE.MeshStandardMaterial({ color: 0x4ac8d8, roughness: 0.1, metalness: 0.2, emissive: 0x2a8a98, emissiveIntensity: 0.55 })); water.rotation.x = -Math.PI / 2; water.position.set(0, 0.2, rz); g.add(nm(water));
  g.add(nm(box(rw, 0.5, rd + 0.8, marble, 0, -0.1, rz))); // 河床下沉：用大理石基座衬出河岸
  const glint = waterGlint(); glint.repeat.set(rw / 10, rd / 10);
  const gl = new THREE.Mesh(new THREE.PlaneGeometry(rw, rd), new THREE.MeshBasicMaterial({ map: glint, color: 0xfff0c0, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); gl.rotation.x = -Math.PI / 2; gl.position.set(0, 0.24, rz); g.add(nm(gl));
  // 河面再抬到和地面接近，避免被 0.3 的地面盖住：水面放 0.36
  water.position.y = 0.36; gl.position.y = 0.4;
  const banks: [number, number][] = [];
  { const xs = BRIDGES.map((b) => [b.x - b.w / 2, b.x + b.w / 2]).sort((a, b) => a[0] - b[0]); let x = -half - 2; for (const [a, b] of xs) { banks.push([x, a]); x = b; } banks.push([x, half + 2]); }
  for (const [x0, x1] of banks) for (const z of [RIVER.z0 - 0.15, RIVER.z1 + 0.15]) { const bal = balustrade(x1 - x0, '#f6f2e8'); bal.position.set((x0 + x1) / 2, 0.34, z); g.add(bal); }
  for (const b of BRIDGES) {
    for (let i = 0; i < 7; i++) { const t = i / 6, h = 0.35 + Math.sin(t * Math.PI) * 0.7; g.add(box(b.w, 0.3, rd / 7 + 0.05, marble, b.x, h, RIVER.z0 + (i + 0.5) * rd / 7)); }
    for (const sx of [-1, 1]) { const bal = balustrade(rd, '#f6f2e8'); bal.rotation.y = Math.PI / 2; bal.position.set(b.x + sx * (b.w / 2 - 0.15), 1.05, rz); g.add(bal); }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { g.add(cyl(0.22, 0.26, 1.6, marble, b.x + sx * (b.w / 2 - 0.15), 1.1, rz + sz * (rd / 2 + 0.1), 8)); const k = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), goldM); k.position.set(b.x + sx * (b.w / 2 - 0.15), 2.05, rz + sz * (rd / 2 + 0.1)); g.add(k); }
  }

  // ---- 午门（南）：低矮的城墙 + 三个门洞（镜头在南边，太高会挡视线）----
  g.add(box(half * 2 + 6, 4.6, 4.6, wallM, 0, 2.3, GATE_Z + 2.6));
  g.add(box(half * 2 + 6.6, 0.6, 5.2, goldM, 0, 4.9, GATE_Z + 2.6));
  g.add(box(half * 2 + 7, 1.2, 5.8, marble, 0, 0.6, GATE_Z + 2.6));
  for (const gx of [-12, 0, 12]) g.add(box(gx === 0 ? 8.4 : 5, 4.2, 5.0, std('#8a2e24', 0.7), gx, 2.1, GATE_Z + 2.6));
  for (let i = 0; i < 9; i++) { const nail = new THREE.Mesh(new THREE.SphereGeometry(0.15, 5, 4), glowMat('#ffd070')); nail.position.set(-3.6 + i * 0.9, 3.4, GATE_Z - 0.2); g.add(nail); }
  for (const sx of [-1, 1]) for (const k of [-1, 1]) { const l = lantern('#ff3a2a', 0.9); l.position.set(sx * (4.7 + (k > 0 ? 0 : 1.2)), 4.0, GATE_Z - 0.6); g.add(l); }
  for (const sx of [-1, 1]) { const c = stoneCat(); c.scale.setScalar(1.5); c.position.set(sx * 6.4, 0.32, GATE_Z - 1.6); c.rotation.y = Math.PI + sx * 0.25; g.add(c); }

  // ---- 两侧长廊 ----
  for (const sx of [-1, 1]) {
    const gal = hall(44, 5.2, 1, { wall: '#f0e4cc', tile: '#e8b020', pillar: '#b83228', floorH: 4.4 }); gal.position.set(sx * GALLERY_X, 0.32, 4); gal.rotation.y = sx < 0 ? Math.PI / 2 : -Math.PI / 2; g.add(gal);
    for (let z = -16; z <= 24; z += 8) { const l = lantern('#ff3a2a', 1.0); l.position.set(sx * (GALLERY_X - 3.4), 4.6, z); g.add(l); }
    shadowBlob(g, sx * (GALLERY_X - 5.5), 4, 3.6, 24, 0.2);
  }
  // ---- 钟楼 / 鼓楼 ----
  PAVILIONS.forEach(([px, pz], i) => { const h = hall(6.6, 6.6, 2, { wall: '#c43a30', tile: i ? '#3a8a8a' : '#e8b020', pillar: '#a82a20', floorH: 3.6, lanterns: '#ff3a2a' }); h.position.set(px, 0.32, pz); h.rotation.y = i ? Math.PI / 2 : -Math.PI / 2; g.add(h); shadowBlob(g, px - 3, pz - 1, 5.4, 5, 0.22); });
  // ---- 铜香炉 ----
  const smokes: THREE.Object3D[] = [];
  for (const [bx, bz] of BURNERS) { const b = burner(); b.position.set(bx, 0.32, bz); g.add(b); smokes.push(b); }
  // ---- 金殿 + 汉白玉台阶 ----
  const tz = (HALL.z0 + HALL.z1) / 2;
  const t1 = box(36, 1.2, 14, marble, 0, 0.9, tz); g.add(t1);
  const t2 = box(31, 1.1, 11.4, std('#ebe4d4', 0.55), 0, 2.0, tz - 0.6); g.add(t2);
  const t3 = box(26, 1.0, 9, std('#e4dccb', 0.55), 0, 3.0, tz - 1.2); g.add(t3);
  const st = new THREE.Group();
  for (let i = 0; i < 9; i++) st.add(box(9, 0.34 * (i + 1), 0.7, marble, 0, 0.17 * (i + 1), -i * 0.7)); // 中央御路台阶
  st.position.set(0, 0.32, HALL.z1 + 0.4 - 0.7); st.rotation.y = 0; g.add(st);
  const ramp = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 6.4), new THREE.MeshStandardMaterial({ color: 0xe8d090, roughness: 0.5 })); ramp.rotation.x = -Math.PI / 2 + 0.38; ramp.position.set(0, 1.9, HALL.z1 - 3.4); g.add(ramp);
  for (const sx of [-1, 1]) { const bl = balustrade(13, '#f6f2e8'); bl.position.set(sx * 8.2, 1.5, tz + 5.9); g.add(bl); const bl2 = balustrade(11, '#f6f2e8'); bl2.rotation.y = Math.PI / 2; bl2.position.set(sx * 15.4, 1.5, tz); g.add(bl2); }
  const main = hall(24, 8, 1, { wall: '#c43a30', tile: '#f0c030', pillar: '#a82a20', sign: { text: '太和殿', color: '#ffe9a0' }, lanterns: '#ff3a2a', floorH: 6 });
  main.position.set(0, 3.9, tz - 1.2); main.rotation.y = Math.PI; g.add(main);
  const roof2 = eaveRoof(30, 12, 3.4, '#f0c030'); roof2.position.set(0, 3.9 + 6.9, tz - 1.2); g.add(roof2);
  for (const sx of [-1, 1]) { const c = stoneCat(); c.scale.setScalar(1.5); c.position.set(sx * 6.2, 0.32, HALL.z1 + 1.8); c.rotation.y = -sx * 0.3; g.add(c); const bn = banner('#c43a30', ['猫', '喵'][sx < 0 ? 0 : 1], 7); bn.position.set(sx * 13, 0.32, HALL.z1 + 2); g.add(bn); }
  // ---- 银杏 / 角楼 ----
  for (const [x, z] of [[-10, 24], [10, 24], [-17, -8], [17, -9], [-18, 14], [18, 15]]) { const t = ginkgo(1 + rnd() * 0.4); t.position.set(x, 0.32, z); g.add(t); shadowBlob(g, x - 2.6, z - 1.8, 4, 3.4, 0.28); }
  // ---- 外圈：群山 + 远塔（山色渐远渐淡）----
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2 + rnd() * 0.1, r = 85 + rnd() * 70, h = 14 + rnd() * 34, w = 16 + rnd() * 22;
    const k = Math.min(1, (r - 85) / 70);
    const col = new THREE.Color('#6a9a8a').lerp(new THREE.Color('#c8d8e8'), k * 0.8);
    const m = new THREE.Mesh(new THREE.ConeGeometry(w, h, 6), new THREE.MeshStandardMaterial({ color: col, roughness: 1, flatShading: true })); m.position.set(Math.cos(a) * r, h / 2 - 3, Math.sin(a) * r); m.rotation.y = rnd() * 3; nm(m); g.add(m);
  }
  for (const [x, z] of [[-60, -50], [64, -30], [-48, 52]] as [number, number][]) { const p = pagoda(7, 6, '#e8b020'); p.position.set(x, 0, z); p.scale.setScalar(1.4); nm(p); g.add(p); }
  for (const [x, z] of [[-9, 18], [9, 2], [-6, -10], [8, -16], [0, 26]]) lightShaft(g, x, z, A.sunPos, 26, 3.4, '#fff0c0', 0.12);
  for (const [x, z, c, s] of L.glows) { const h = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ map: glowTex(), color: c, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); h.rotation.x = -Math.PI / 2; h.position.set(x, 0.5, z); g.add(nm(h)); }
  for (const [x, y, z, c, i, r] of L.lights) { const l = new THREE.PointLight(c, i * 0.3, r, 1.6); l.position.set(x, y, z); g.add(l); }
  const leaves = motes(g, { n: 70, half: 22, color: '#ffd24a', size: 0.55, seed: 6, h: [0.8, 12], speed: 0.6 });
  const smoke = motes(g, { n: 24, half: 8, color: '#e8e8e8', size: 0.9, seed: 21, h: [3, 8], speed: 0.3 });
  void redPillar; void redM; void goldM;
  return finishTheme(L, g, { update: (t) => { leaves(t); smoke(t * 0.6); glint.offset.x = t * 0.02; glint.offset.y = t * 0.05; void smokes; } });
}
