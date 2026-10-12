// 光之森（第 4 章，清晨）：阳光从参天古树之间斜斜漏下来。小径在草地上蜿蜒，一条清澈的小溪把林子隔成两半，只有一座木桥能过；
// 营地、蘑菇圈、藤蔓石门、树屋、开满樱花的母树空地；空中飘着花粉和蝴蝶。——明亮、清新，不是夜景。
import * as THREE from 'three';
import { mulberry } from '../../fx/util';
import { atmosOf } from '../atmos';
import { glowMat, mushroom, std } from '../kit';
import { aiTex, glowTex, mk, waterGlint } from '../tex';
import type { LevelDef } from '../levels';
import type { Street } from '../street';
import { BRIDGE_X, CAMP, FOREST_PATH, MOTHER_TREE, RUINS, STREAM, TREEHOUSE } from './forest.data';
import { finishTheme, groundPlane, lightShaft, motes, nm, pathTex, plinth, ribbon, shadowBlob } from './common';

const box = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; };
const cyl = (r0: number, r1: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 8) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat); m.position.set(x, y, z); m.castShadow = true; return m; };

/** 参天古树：粗壮的暖褐色树干长出镜头（树冠在 55 米以上，不遮挡队伍），干上有青苔、垂藤和彩色的树菇，脚下是盘根 */
function forestTree(seed: number, accent: string): THREE.Group {
  const g = new THREE.Group(); const rnd = mulberry(seed);
  const bark = std('#8a6647', 0.9), bark2 = std('#6a4a32', 0.95), moss = std('#5aa44a', 0.9);
  g.add(cyl(0.5, 0.9, 62, bark, 0, 31, 0, 10));
  for (let i = 0; i < 5; i++) { const a = i * 1.26 + rnd(); const r = cyl(0.12, 0.38, 3.8, bark2, Math.cos(a) * 1.0, 1.0, Math.sin(a) * 1.0, 5); r.rotation.set(Math.sin(a) * 0.75, 0, -Math.cos(a) * 0.75); g.add(r); }
  for (const y of [2.2, 6.5, 11]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.78 - y * 0.012, 0.1, 4, 12), bark2); ring.rotation.x = Math.PI / 2; ring.position.y = y; g.add(ring); }
  // 青苔块（贴在树干背阴面）
  for (let i = 0; i < 5; i++) { const a = rnd() * 6.28, y = 0.8 + rnd() * 9; const m = new THREE.Mesh(new THREE.SphereGeometry(0.42 + rnd() * 0.25, 6, 4), moss); m.scale.set(1.3, 0.7, 1.0); m.position.set(Math.cos(a) * 0.72, y, Math.sin(a) * 0.72); m.rotation.y = -a; g.add(m); }
  // 垂藤 + 小花
  for (let i = 0; i < 6; i++) {
    const a = rnd() * 6.28, r = 1.1 + rnd() * 1.4, y = 6 + rnd() * 9, len = 2.5 + rnd() * 3.5;
    g.add(cyl(0.03, 0.03, len, std('#3f8a3a', 0.8), Math.cos(a) * r, y - len / 2, Math.sin(a) * r, 4));
    const o = new THREE.Mesh(new THREE.SphereGeometry(0.15 + rnd() * 0.08, 6, 5), glowMat(['#ffd0e8', accent, '#fff4a8'][i % 3])); o.position.set(Math.cos(a) * r, y - len, Math.sin(a) * r); g.add(o);
  }
  // 彩色树菇
  for (let i = 0; i < 3; i++) { const a = rnd() * 6.28, y = 2.4 + i * 2.5 + rnd(); const m = new THREE.Mesh(new THREE.SphereGeometry(0.55 - i * 0.08, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), std(['#ff8aa8', '#ffc04a', '#8ad8ff'][(i + seed) % 3], 0.7)); m.scale.set(1.2, 0.5, 1.2); m.position.set(Math.cos(a) * 0.8, y, Math.sin(a) * 0.8); m.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); g.add(m); }
  const canopy = std('#4aa84a', 0.85, 0.02);
  for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.IcosahedronGeometry(3.4 + rnd() * 2.4, 0), canopy); c.position.set((rnd() - 0.5) * 5, 62 + rnd() * 5, (rnd() - 0.5) * 5); g.add(c); }
  return g;
}

const grassTex = () => mk(256, 256, (c) => {
  const rnd = mulberry(11);
  c.fillStyle = '#58a24a'; c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 70; i++) { c.fillStyle = `rgba(${70 + rnd() * 50 | 0},${150 + rnd() * 70 | 0},${60 + rnd() * 40 | 0},${0.12 + rnd() * 0.2})`; c.beginPath(); c.ellipse(rnd() * 256, rnd() * 256, 10 + rnd() * 34, 8 + rnd() * 24, rnd() * 3, 0, 7); c.fill(); }
  for (let i = 0; i < 1800; i++) { c.fillStyle = rnd() < 0.5 ? 'rgba(200,255,140,0.28)' : 'rgba(20,70,30,0.22)'; c.fillRect(rnd() * 256, rnd() * 256, 1, 2 + rnd() * 4); }
  for (let i = 0; i < 26; i++) { c.fillStyle = ['#fff2a8', '#ffd0e8', '#ffffff'][i % 3]; c.beginPath(); c.arc(rnd() * 256, rnd() * 256, 1.4 + rnd() * 1.2, 0, 7); c.fill(); }
}, 'forest-grass');

export function buildForest(L: LevelDef): Street {
  const g = new THREE.Group(); const half = L.half; const A = atmosOf(L.mood);
  plinth(g, half, '#5a4430', undefined, A.fog);
  const cc0 = aiTex('cc0_grass_005'); // ambientCG Grass005（CC0）
  groundPlane(g, half, cc0 ? (cc0.wrapS = cc0.wrapT = THREE.RepeatWrapping, cc0) : grassTex(), cc0 ? 9 : 12, cc0 ? { color: 0xe4f6c8 } : {});
  ribbon(g, FOREST_PATH, 3.9, pathTex('forest-dirt', '#caa672', ['#e0c08a', '#a88458', '#f0d8a8', '#8a6a44']));
  ribbon(g, FOREST_PATH, 4.6, pathTex('forest-dirt-rim', '#7aa850', ['#9acc68', '#5a8a3a'], 0.45), 0.33);
  const rnd = mulberry(909);

  // ---- 林子：树干 + 树冠投在地上的柔影 + 漏下来的光束 ----
  for (const [x, z, sc, seed, col] of L.trees ?? []) {
    const t = forestTree(seed, col); t.scale.setScalar(sc); t.position.set(x, 0.32, z); g.add(t);
    shadowBlob(g, x - 3.2 * sc, z - 2.2 * sc, 5.6 * sc, 4.6 * sc, 0.34);
  }
  for (let i = 0; i < 38; i++) { // 外圈林墙
    const a = (i / 38) * Math.PI * 2 + rnd() * 0.1, r = 38 + rnd() * 16;
    const t = forestTree(i + 300, ['#ffd0e8', '#fff4a8', '#8ad8ff'][i % 3]); t.scale.setScalar(1.0 + rnd() * 0.7); t.position.set(Math.cos(a) * r, 0.2, Math.sin(a) * r); nm(t); g.add(t);
  }
  for (const [x, z] of [[-8, 16], [10, 7], [-6, -4], [9, -14], [-14, -16], [18, 22], [-20, 10]]) lightShaft(g, x, z, A.sunPos, 26, 3.4, '#fff2c0', 0.17);
  for (const [x, z, c, s] of L.glows) { const h = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ map: glowTex(), color: c === '#4fe08a' ? '#fff2b8' : c, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); h.rotation.x = -Math.PI / 2; h.position.set(x, 0.45, z); g.add(nm(h)); }

  for (const [x, z, sc, col] of L.mushrooms ?? []) { const m = mushroom(col, sc); m.position.set(x, 0.32, z); m.rotation.y = x * 7; g.add(m); }
  // 地上的野花 / 草簇
  for (let i = 0; i < 160; i++) {
    const x = (rnd() - 0.5) * 60, z = (rnd() - 0.5) * 60;
    if (z > STREAM.z0 - 1 && z < STREAM.z1 + 1) continue;
    const c = ['#ffffff', '#ff9ac8', '#ffe27a', '#b8a0ff', '#ff8a6a'][i % 5];
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.1 + rnd() * 0.07, 5, 4), glowMat(c)); f.position.set(x, 0.46, z); g.add(f);
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.55, 4), std('#3f8a3a', 0.8)); s.position.set(x, 0.58, z); g.add(s);
  }
  for (let i = 0; i < 70; i++) { // 草丛
    const x = (rnd() - 0.5) * 60, z = (rnd() - 0.5) * 60;
    if (z > STREAM.z0 - 1 && z < STREAM.z1 + 1) continue;
    for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.9 + rnd() * 0.5, 3), std(['#4a9a3a', '#5ab048', '#3a8a34'][k % 3], 0.85)); b.position.set(x + (rnd() - 0.5) * 0.7, 0.75, z + (rnd() - 0.5) * 0.7); b.rotation.set((rnd() - 0.5) * 0.4, 0, (rnd() - 0.5) * 0.4); g.add(b); }
  }
  for (let i = 0; i < 16; i++) { // 树桩 / 石头
    const x = (rnd() - 0.5) * 56, z = (rnd() - 0.5) * 56;
    if (z > STREAM.z0 - 1.5 && z < STREAM.z1 + 1.5) continue;
    if (Math.abs(x) < 3 && z > 14) continue;
    if (i % 3 === 0) { g.add(cyl(0.7, 0.85, 0.7, std('#8a6a48', 0.9), x, 0.65, z, 8)); g.add(cyl(0.62, 0.62, 0.05, std('#e0c090', 0.9), x, 1.02, z, 8)); }
    else { const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5 + rnd() * 0.5, 0), std('#9a9a96', 0.95)); rk.position.set(x, 0.5, z); rk.scale.y = 0.6; rk.rotation.set(rnd(), rnd(), 0); rk.castShadow = true; g.add(rk); const mm = new THREE.Mesh(new THREE.SphereGeometry(0.4, 6, 4), std('#5aa44a', 0.9)); mm.scale.set(1, 0.4, 1); mm.position.set(x, 0.85, z); g.add(mm); }
  }

  // ---- 小溪 + 木桥 ----
  const sw = half * 2 + 4, sd = STREAM.z1 - STREAM.z0, sz = (STREAM.z0 + STREAM.z1) / 2;
  const water = new THREE.Mesh(new THREE.PlaneGeometry(sw, sd), new THREE.MeshStandardMaterial({ color: 0x3ab8c8, roughness: 0.12, metalness: 0.25, emissive: 0x1a6a78, emissiveIntensity: 0.6, transparent: true, opacity: 0.92 }));
  water.rotation.x = -Math.PI / 2; water.position.set(0, 0.36, sz); g.add(nm(water));
  const glint = waterGlint(); glint.repeat.set(sw / 10, sd / 10);
  const gl = new THREE.Mesh(new THREE.PlaneGeometry(sw, sd), new THREE.MeshBasicMaterial({ map: glint, color: 0xffffff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  gl.rotation.x = -Math.PI / 2; gl.position.set(0, 0.4, sz); g.add(nm(gl));
  for (const zz of [STREAM.z0 - 0.3, STREAM.z1 + 0.3]) for (let x = -31; x < 31; x += 2.1) { if (x > BRIDGE_X[0] - 0.4 && x < BRIDGE_X[1] + 0.4) continue; const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45 + ((x * 13) % 5) * 0.08, 0), std('#a8a8a4', 0.95)); rk.position.set(x, 0.4, zz); rk.scale.y = 0.7; g.add(rk); if (((x * 7) | 0) % 3 === 0) { for (let k = 0; k < 3; k++) { const r = new THREE.Mesh(new THREE.ConeGeometry(0.05, 1.5, 3), std('#6ab048', 0.8)); r.position.set(x + k * 0.2, 1.0, zz + (zz < sz ? -0.5 : 0.5)); g.add(r); } } }
  const bx = (BRIDGE_X[0] + BRIDGE_X[1]) / 2, bz0 = STREAM.z0 - 0.8, bz1 = STREAM.z1 + 0.8, wood = std('#b88a5a', 0.85), dark = std('#8a6244', 0.9);
  for (let z = bz0; z <= bz1; z += 0.5) g.add(box(3.4, 0.14, 0.42, wood, bx, 0.74 + (z > sz ? (bz1 - z) : (z - bz0)) * 0.012, z));
  for (const sx of [-1.7, 1.7]) { g.add(box(0.14, 0.14, bz1 - bz0, dark, bx + sx, 1.5, sz)); for (let z = bz0 + 0.3; z <= bz1; z += 1.5) g.add(box(0.14, 1.2, 0.14, dark, bx + sx, 1.0, z)); }
  for (const [px, pz] of [[bx - 1.7, bz0], [bx + 1.7, bz0], [bx - 1.7, bz1], [bx + 1.7, bz1]]) { g.add(cyl(0.1, 0.1, 2.2, dark, px, 1.4, pz, 6)); const l = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), glowMat('#ffe9a0')); l.position.set(px, 2.6, pz); g.add(l); }

  // ---- 营地 ----
  const [cx, cz] = CAMP;
  for (let i = 0; i < 5; i++) { const a = i * 1.26; const lg = cyl(0.12, 0.12, 1.5, std('#6a4a30', 0.9), cx + Math.cos(a) * 0.3, 0.55, cz + Math.sin(a) * 0.3, 6); lg.rotation.set(Math.sin(a) * 0.9, 0, Math.cos(a) * 0.9); g.add(lg); }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.16, 5, 14), std('#9a9aa4', 0.95)); ring.rotation.x = Math.PI / 2; ring.position.set(cx, 0.42, cz); g.add(ring);
  const flameM = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.3, 7), glowMat('#ff9a3a')); flameM.position.set(cx, 1.1, cz); flameM.userData.noBake = true; g.add(flameM);
  const flame2 = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.9, 7), glowMat('#fff0a8')); flame2.position.set(cx, 1.0, cz); flame2.userData.noBake = true; g.add(flame2);
  const fire = new THREE.PointLight(0xff9a40, 16, 10, 1.7); fire.position.set(cx, 2, cz); g.add(fire);
  const tent = new THREE.Mesh(new THREE.ConeGeometry(2.4, 2.8, 4), std('#ff9a5a', 0.9)); tent.rotation.y = Math.PI / 4; tent.position.set(cx + 2.9, 1.7, cz); tent.castShadow = true; g.add(tent);
  const stripe = new THREE.Mesh(new THREE.ConeGeometry(2.42, 0.9, 4), std('#fff4e0', 0.9)); stripe.rotation.y = Math.PI / 4; stripe.position.set(cx + 2.9, 2.6, cz); g.add(stripe);
  const flap = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.0), std('#5a3a2a', 0.9)); flap.position.set(cx + 1.62, 1.1, cz); flap.rotation.y = -Math.PI / 2; g.add(flap);
  for (const a of [0.6, 2.4, 4.0]) g.add(cyl(0.42, 0.5, 0.5, std('#b88a5a', 0.9), cx + Math.cos(a) * 2.1, 0.55, cz + Math.sin(a) * 2.1 - 0.4, 7));
  const flag = box(0.05, 3.2, 0.05, std('#8a6244', 0.9), cx + 2.9, 4.1, cz); g.add(flag); const pen = box(0.9, 0.55, 0.04, std('#ff5a7a', 0.8), cx + 3.4, 5.3, cz); g.add(pen);

  // ---- 树屋 ----
  const [tx, tz, tr] = TREEHOUSE, hut = std('#c8a070', 0.85);
  g.add(cyl(tr * 0.85, tr * 1.1, 14, std('#8a6647', 0.9), tx, 7.3, tz, 10));
  g.add(cyl(4.4, 4.4, 0.4, wood, tx, 8, tz, 12));
  g.add(box(3.6, 2.6, 3.6, hut, tx, 9.5, tz + 0.2));
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.3, 2.2, 4), std('#5ab058', 0.8)); roof.rotation.y = Math.PI / 4; roof.position.set(tx, 12, tz + 0.2); g.add(roof);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.6), glowMat('#ffe2a0')); door.position.set(tx, 9.1, tz + 2.02); g.add(door);
  for (let i = 0; i < 9; i++) g.add(box(1.0, 0.1, 0.14, wood, tx + tr * 0.9, 1 + i * 0.85, tz + tr * 0.5));
  for (const a of [0.5, 2.2, 3.9, 5.5]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), glowMat(['#ffd0e8', '#fff4a8', '#b8ffd0', '#ffe27a'][Math.floor(a) % 4])); l.position.set(tx + Math.cos(a) * 4.2, 7.2, tz + Math.sin(a) * 4.2); g.add(l); }

  // ---- 古石门（藤蔓缠绕）----
  const [rx, rz] = RUINS, stone = std('#b4b2a8', 0.9), mossM = std('#5aa44a', 0.9);
  for (const s of [-1, 1]) {
    g.add(box(1.0, 6.4, 1.0, stone, rx + s * 4.1, 3.5, rz)); g.add(box(1.14, 0.9, 1.14, mossM, rx + s * 4.1, 6.5, rz)); g.add(box(1.4, 0.5, 1.4, stone, rx + s * 4.1, 0.55, rz));
    const rune = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.8), glowMat('#8ae8ff')); rune.position.set(rx + s * 4.1, 3.6, rz + 0.52); g.add(rune);
  }
  g.add(box(5.2, 0.9, 1.0, stone, rx - 2.6, 7.2, rz)); g.add(box(3.4, 0.8, 1.0, mossM, rx + 2.4, 7.3, rz));
  for (const x of [-5, -2, 1.2, 3.6]) { g.add(cyl(0.04, 0.04, 2 + Math.abs(x) * 0.3, std('#3f8a3a', 0.8), rx + x, 6.2, rz + 0.3, 4)); const b = new THREE.Mesh(new THREE.SphereGeometry(0.13, 5, 4), glowMat(['#ffd0e8', '#fff4a8'][Math.abs(x) % 2 < 1 ? 0 : 1])); b.position.set(rx + x, 5.1 - Math.abs(x) * 0.15, rz + 0.3); g.add(b); }
  for (let i = 0; i < 5; i++) g.add(box(1.0, 0.7, 1.0, stone, rx + (i - 2) * 1.5 + 0.4, 0.45, rz + 2.2 + (i % 2) * 0.9)).rotation.y = i;
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 0), glowMat('#8ae8ff')); core.position.set(rx, 3, rz); core.userData.noBake = true; g.add(core);

  // ---- 母树：满树樱花的巨树（boss 空地的尽头）----
  const [mx, mz] = MOTHER_TREE;
  g.add(cyl(3.2, 4.6, 30, std('#7a5a40', 0.9), mx, 15, mz, 12));
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; const rt = cyl(0.2, 1.1, 7, std('#7a5a40', 0.9), mx + Math.cos(a) * 4.6, 1.8, mz + Math.sin(a) * 4.6, 6); rt.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); g.add(rt); }
  const blossom = std('#ffb4cc', 0.8, 0.02), blossom2 = std('#ffe0ec', 0.8, 0.02);
  for (let i = 0; i < 12; i++) { const c = new THREE.Mesh(new THREE.IcosahedronGeometry(5.5 + rnd() * 4, 0), i % 2 ? blossom : blossom2); c.position.set(mx + (rnd() - 0.5) * 24, 24 + rnd() * 10, mz + (rnd() - 0.5) * 16); g.add(c); }
  shadowBlob(g, mx - 2, mz + 7, 16, 11, 0.3);
  const bossRing = new THREE.Mesh(new THREE.RingGeometry(5.6, 6.0, 48), new THREE.MeshBasicMaterial({ color: 0xffe6a0, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
  bossRing.rotation.x = -Math.PI / 2; bossRing.position.set(L.bossSpot[0], 0.4, L.bossSpot[1]); g.add(nm(bossRing));

  for (const [x, y, z, c, i, r] of L.lights) { const l = new THREE.PointLight(c === 0x4fe08a ? 0xfff0c0 : c, i * 0.35, r, 1.6); l.position.set(x, y, z); g.add(l); }

  const pollen = motes(g, { n: 90, half, color: '#fff6c8', size: 0.42, seed: 3, h: [0.8, 7], speed: 0.7 });
  const petals = motes(g, { n: 36, half: 14, color: '#ffb4cc', size: 0.6, seed: 9, h: [1, 16], speed: 0.5 });
  // 蝴蝶：几只小片，绕着花丛飞
  const fl: { m: THREE.Mesh; cx: number; cz: number; r: number; sp: number; ph: number }[] = [];
  for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.4), new THREE.MeshBasicMaterial({ color: ['#ffb84a', '#8ad8ff', '#ff9ac8', '#ffffff'][i % 4], side: THREE.DoubleSide, toneMapped: false })); m.userData.noBake = true; m.userData.noMirror = true; g.add(m); fl.push({ m, cx: (rnd() - 0.5) * 40, cz: (rnd() - 0.5) * 40, r: 2 + rnd() * 3, sp: 0.5 + rnd() * 0.6, ph: rnd() * 6 }); }
  const S = finishTheme(L, g, {
    update: (t) => {
      pollen(t); petals(t * 0.7);
      glint.offset.x = t * 0.02; glint.offset.y = t * 0.05;
      const f = 1 + Math.sin(t * 17) * 0.1 + Math.sin(t * 29) * 0.06; flameM.scale.set(f, 1 + Math.sin(t * 13) * 0.12, f); flame2.scale.set(f, 1 + Math.sin(t * 19) * 0.15, f);
      fire.intensity = 14 + Math.sin(t * 23) * 2.5;
      core.position.y = 3 + Math.sin(t * 1.6) * 0.3; core.rotation.y = t;
      for (const b of fl) { const a = t * b.sp + b.ph; b.m.position.set(b.cx + Math.cos(a) * b.r, 1.6 + Math.sin(a * 2) * 0.5, b.cz + Math.sin(a) * b.r); b.m.rotation.set(-Math.PI / 2 + Math.sin(t * 14 + b.ph) * 0.9, 0, a); }
    },
  });
  return S;
}
