// 云端雾岛（正午）：一座漂在云海上的圆形浮岛——粉绿色的草地、白石小径、三道牌坊、莲池、转着的风车；
// 岛沿垂着瀑布，岛底是嶙峋的岩石和发光晶簇；四周漂着小浮岛、大朵的云，远处挂着一道彩虹。晴朗明亮，一点赛博味都没有。
import * as THREE from 'three';
import { mulberry } from '../../fx/util';
import { glowMat, std } from '../kit';
import { aiTex, glowTex, mk, waterGlint } from '../tex';
import type { LevelDef } from '../levels';
import type { Street } from '../street';
import { atmosOf } from '../atmos';
import { pagoda } from './arch';
import { CRYSTALS, GATES, ISLE_R, POND, WINDMILL } from './cloud.data';
import { finishTheme, lightShaft, motes, nm, pathTex, ribbon, shadowBlob } from './common';

const box = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; };
const cyl = (r0: number, r1: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 10) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat); m.position.set(x, y, z); m.castShadow = true; return m; };

const grassTex = () => mk(256, 256, (c) => {
  const rnd = mulberry(5);
  c.fillStyle = '#9ad87a'; c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 60; i++) { c.fillStyle = `rgba(${150 + rnd() * 60 | 0},${215 + rnd() * 40 | 0},${110 + rnd() * 40 | 0},${0.18 + rnd() * 0.2})`; c.beginPath(); c.ellipse(rnd() * 256, rnd() * 256, 14 + rnd() * 34, 10 + rnd() * 24, rnd() * 3, 0, 7); c.fill(); }
  for (let i = 0; i < 1600; i++) { c.fillStyle = rnd() < 0.5 ? 'rgba(220,255,170,.4)' : 'rgba(70,150,80,.25)'; c.fillRect(rnd() * 256, rnd() * 256, 1, 2 + rnd() * 4); }
  for (let i = 0; i < 36; i++) { c.fillStyle = ['#ffffff', '#ffd0e8', '#fff2a0', '#d0e8ff'][i % 4]; c.beginPath(); c.arc(rnd() * 256, rnd() * 256, 1.6 + rnd() * 1.4, 0, 7); c.fill(); }
}, 'cloud-grass');
const cloudSeaTex = () => mk(256, 256, (c) => {
  const rnd = mulberry(9);
  c.fillStyle = '#d6e8ff'; c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) { const x = rnd() * 256, y = rnd() * 256, r = 10 + rnd() * 34; const gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; for (const dx of [-256, 0, 256]) for (const dy of [-256, 0, 256]) { c.beginPath(); c.arc(x + dx, y + dy, r, 0, 7); c.fill(); } }
}, 'cloud-sea');
const rockTex = () => mk(128, 128, (c) => {
  const rnd = mulberry(3);
  c.fillStyle = '#9a8c82'; c.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 80; i++) { c.fillStyle = `rgba(${rnd() < 0.5 ? '255,240,220' : '60,50,50'},${0.1 + rnd() * 0.2})`; c.fillRect(0, rnd() * 128, 128, 1 + rnd() * 5); }
}, 'cloud-rock');
const fallTex = () => { const t = mk(64, 256, (c) => { const gr = c.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.2, 'rgba(220,240,255,.85)'); gr.addColorStop(0.8, 'rgba(220,240,255,.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 64, 256); const rnd = mulberry(2); for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(8 + rnd() * 48, rnd() * 256, 2, 14 + rnd() * 30); } }, 'cloud-fall'); t.wrapT = THREE.RepeatWrapping; return t; };

function puff(scale: number, rnd: () => number): THREE.Group {
  const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xdde8ff, emissiveIntensity: 0.55 });
  for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(3 + rnd() * 3, 10, 8), m); s.position.set((i - 2.5) * 3 * (0.8 + rnd() * 0.4), rnd() * 2, (rnd() - 0.5) * 4); s.scale.y = 0.7; g.add(s); }
  g.scale.setScalar(scale); return g;
}
function islet(rnd: () => number, s: number): THREE.Group {
  const g = new THREE.Group();
  const top = cyl(5 * s, 5.5 * s, 1.2, std('#9ad87a', 0.9), 0, 0, 0, 14); g.add(top);
  const rock = new THREE.Mesh(new THREE.ConeGeometry(5.5 * s, 9 * s, 7), new THREE.MeshStandardMaterial({ map: rockTex(), roughness: 0.95, flatShading: true })); rock.rotation.x = Math.PI; rock.position.y = -5 * s; g.add(rock);
  if (rnd() < 0.6) { g.add(cyl(0.3 * s, 0.4 * s, 2.5 * s, std('#7a5a40', 0.9), 0, 1.8 * s, 0, 6)); const c = new THREE.Mesh(new THREE.IcosahedronGeometry(2.1 * s, 0), std(rnd() < 0.5 ? '#ffb4cc' : '#7ad88a', 0.85)); c.position.y = 4 * s; g.add(c); }
  else { const p = pagoda(3, 2.6, '#3a8a9a'); p.scale.setScalar(0.6 * s); p.position.y = 0.6; g.add(p); }
  return g;
}

export function buildCloud(L: LevelDef): Street {
  const g = new THREE.Group(); const A = atmosOf(L.mood); const rnd = mulberry(505);
  // ---- 岛面 / 岛底 ----
  const cc0 = aiTex('cc0_grass_005'); // ambientCG Grass005（CC0）
  const gt: THREE.Texture = cc0 ?? grassTex(); gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(cc0 ? 4 : 5, cc0 ? 4 : 5);
  const top = new THREE.Mesh(new THREE.CircleGeometry(ISLE_R + 1.2, 64), new THREE.MeshStandardMaterial({ map: gt, roughness: 0.95 })); top.rotation.x = -Math.PI / 2; top.position.y = 0.3; top.receiveShadow = true; g.add(nm(top));
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(ISLE_R + 1.2, ISLE_R + 1.6, 1.6, 64, 1, true), std('#e8e0d4', 0.85)); rim.position.y = -0.5; g.add(nm(rim));
  const prof: THREE.Vector2[] = []; for (let i = 0; i <= 12; i++) { const t = i / 12; prof.push(new THREE.Vector2((ISLE_R + 1.6) * Math.pow(1 - t, 0.8) * (0.86 + rnd() * 0.28), -1.3 - t * 38)); }
  const under = new THREE.Mesh(new THREE.LatheGeometry(prof, 18), new THREE.MeshStandardMaterial({ map: rockTex(), roughness: 0.95, flatShading: true, side: THREE.DoubleSide })); under.userData.noBake = true; g.add(nm(under));
  for (let i = 0; i < 14; i++) { const a = rnd() * 6.28, r = (8 + rnd() * 18), d = -6 - rnd() * 22; const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(2 + rnd() * 3, 0), new THREE.MeshStandardMaterial({ map: rockTex(), roughness: 0.95, flatShading: true })); rk.position.set(Math.cos(a) * r * (1 + d / 60), d, Math.sin(a) * r * (1 + d / 60)); nm(rk); g.add(rk); }
  for (let i = 0; i < 9; i++) { const a = rnd() * 6.28, r = 6 + rnd() * 12, d = -10 - rnd() * 18; const cr = new THREE.Mesh(new THREE.ConeGeometry(0.7 + rnd() * 0.7, 3.5 + rnd() * 3, 5), std('#9ad8ff', 0.2, 0.2, '#6ac0ff', 0.9)); cr.rotation.x = Math.PI; cr.position.set(Math.cos(a) * r, d, Math.sin(a) * r); nm(cr); g.add(cr); }
  // 瀑布：从岛沿垂进云海
  const ft = fallTex(); ft.repeat.set(1, 2);
  for (const a of [2.2, 4.0, 5.4]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 34), new THREE.MeshBasicMaterial({ map: ft, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })); m.position.set(Math.cos(a) * (ISLE_R + 1.6), -17, Math.sin(a) * (ISLE_R + 1.6)); m.rotation.y = -a + Math.PI / 2; m.userData.noBake = true; nm(m); g.add(m); }
  // ---- 岛沿栏杆 ----
  const stone = std('#f2ece0', 0.8);
  for (let i = 0; i < 44; i++) { const a = (i / 44) * Math.PI * 2; const px = Math.cos(a) * (ISLE_R - 0.2), pz = Math.sin(a) * (ISLE_R - 0.2); g.add(cyl(0.18, 0.2, 1.3, stone, px, 0.95, pz, 6)); const b = new THREE.Mesh(new THREE.SphereGeometry(0.24, 6, 5), glowMat(['#ffd0e8', '#d0e8ff', '#fff2a0'][i % 3])); b.position.set(px, 1.75, pz); g.add(b); }
  // ---- 白石小径 ----
  const route: [number, number][] = [[0, 27], [2, 17], [-2, 6], [2, -4], [-1, -12], [0, -19]];
  ribbon(g, route, 4.2, pathTex('cloud-path', '#f4f0e8', ['#ffffff', '#d8d0c4', '#e8e0d0', '#cfc8bc']), 0.34);
  ribbon(g, route, 5.0, pathTex('cloud-path-rim', '#d8e8c0', ['#ffffff', '#b8d8a0'], 0.45), 0.33);
  // 野花
  for (let i = 0; i < 220; i++) { const a = rnd() * 6.28, r = Math.sqrt(rnd()) * (ISLE_R - 1.5); const f = new THREE.Mesh(new THREE.SphereGeometry(0.1 + rnd() * 0.08, 5, 4), glowMat(['#ffffff', '#ffb4d0', '#fff2a0', '#b8d8ff', '#e8b8ff'][i % 5])); f.position.set(Math.cos(a) * r, 0.46, Math.sin(a) * r); g.add(f); const s = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.5, 4), std('#5ab058', 0.8)); s.position.set(Math.cos(a) * r, 0.55, Math.sin(a) * r); g.add(s); }
  // 小树
  for (let i = 0; i < 16; i++) { const a = rnd() * 6.28, r = 14 + rnd() * 12; const x = Math.cos(a) * r, z = Math.sin(a) * r; if (Math.hypot(x - WINDMILL[0], z - WINDMILL[1]) < 6 || Math.abs(x) < 5) continue; g.add(cyl(0.22, 0.32, 2.2, std('#8a6a4a', 0.9), x, 1.4, z, 6)); const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5 + rnd() * 0.6, 0), std(i % 3 ? '#7ad88a' : '#ffb4cc', 0.85)); c.position.set(x, 3.2, z); c.castShadow = true; g.add(c); shadowBlob(g, x - 1.2, z - 0.8, 2.2, 1.8, 0.22); }
  // ---- 牌坊（三道）----
  for (const z of GATES) {
    for (const sx of [-1, 1]) { g.add(cyl(0.45, 0.5, 6, std('#ff8a7a', 0.6), sx * 4.6, 3.3, z, 10)); g.add(cyl(0.6, 0.6, 0.4, stone, sx * 4.6, 0.5, z, 10)); }
    g.add(box(11.4, 0.5, 0.6, std('#ff8a7a', 0.6), 0, 6.1, z)); g.add(box(12.6, 0.4, 0.9, std('#fff4e0', 0.7), 0, 6.6, z)); g.add(box(9.6, 0.3, 0.4, std('#ffd0c8', 0.7), 0, 5.1, z));
    const sc = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 6, 14), glowMat('#fff2a0')); sc.position.set(0, 5.6, z + 0.35); g.add(sc);
    for (const sx of [-5, 5]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), glowMat('#ffe9a0')); l.position.set(sx, 5.0, z); g.add(l); }
  }
  // ---- 风车 ----
  const [wx, wz] = WINDMILL; const wmat = std('#fff4e8', 0.8);
  g.add(cyl(1.4, 2.2, 7, wmat, wx, 3.8, wz, 10)); const wroof = new THREE.Mesh(new THREE.ConeGeometry(2.3, 2.4, 10), std('#7ac8e8', 0.7)); wroof.position.set(wx, 8.4, wz); wroof.castShadow = true; g.add(wroof);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.2), glowMat('#ffe9a0')); win.position.set(wx, 3.2, wz + 1.85); g.add(win);
  const blades = new THREE.Group(); blades.position.set(wx, 7.2, wz + 1.7);
  for (let i = 0; i < 4; i++) { const b = new THREE.Group(); b.rotation.z = (i / 4) * Math.PI * 2; b.add(box(0.2, 5.6, 0.1, std('#8a6a4a', 0.85), 0, 2.8, 0)); b.add(box(1.5, 3.4, 0.06, std(i % 2 ? '#ffffff' : '#ffb4cc', 0.8), 0.8, 3.4, 0.05)); blades.add(b); }
  blades.userData.noBake = true; g.add(blades);
  // ---- 莲池 ----
  const [px, pz, pr] = POND;
  g.add(cyl(pr + 0.5, pr + 0.7, 0.6, stone, px, 0.5, pz, 24));
  const water = new THREE.Mesh(new THREE.CircleGeometry(pr, 28), new THREE.MeshStandardMaterial({ color: 0x6adcf0, roughness: 0.1, metalness: 0.2, emissive: 0x2a9ab0, emissiveIntensity: 0.5 })); water.rotation.x = -Math.PI / 2; water.position.set(px, 0.84, pz); g.add(nm(water));
  const wg = waterGlint(); wg.repeat.set(2, 2); const wgm = new THREE.Mesh(new THREE.CircleGeometry(pr, 28), new THREE.MeshBasicMaterial({ map: wg, color: 0xffffff, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); wgm.rotation.x = -Math.PI / 2; wgm.position.set(px, 0.88, pz); g.add(nm(wgm));
  for (let i = 0; i < 9; i++) { const a = rnd() * 6.28, r = rnd() * (pr - 0.8); const pad = new THREE.Mesh(new THREE.CircleGeometry(0.5 + rnd() * 0.3, 10), std('#4ab058', 0.8)); pad.rotation.x = -Math.PI / 2; pad.position.set(px + Math.cos(a) * r, 0.9, pz + Math.sin(a) * r); g.add(pad); if (i % 3 === 0) { const lot = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.55, 8), std('#ffb4d0', 0.7)); lot.position.set(px + Math.cos(a) * r, 1.15, pz + Math.sin(a) * r); g.add(lot); } }
  // ---- 西边小塔 + 风铃 ----
  const tw = pagoda(3, 1.7, '#3a8a9a'); tw.position.set(-8, 0.3, -0.5); tw.scale.setScalar(0.9); g.add(tw);
  // ---- 晶簇 ----
  for (const [x, z, r] of CRYSTALS) for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.34 * r * (1 - i * 0.12), (2.6 - i * 0.35) * r, 5), std(i % 2 ? '#ffc8f0' : '#a8d8ff', 0.2, 0.2, i % 2 ? '#ff9ad8' : '#6ac0ff', 0.7)); c.position.set(x + Math.cos(i * 1.3) * 0.5 * r, (1.2 - i * 0.15) * r + 0.3, z + Math.sin(i * 1.3) * 0.5 * r); c.rotation.z = Math.sin(i * 2.1) * 0.3; g.add(c); }
  // ---- 北边祭坛：水晶之心 ----
  const [bx, bz] = L.bossSpot;
  g.add(cyl(6.4, 6.8, 0.5, stone, bx, 0.5, bz, 32));
  const altarRing = new THREE.Mesh(new THREE.RingGeometry(5.0, 5.5, 48), new THREE.MeshBasicMaterial({ color: 0xffe0f4, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })); altarRing.rotation.x = -Math.PI / 2; altarRing.position.set(bx, 0.8, bz); g.add(nm(altarRing));
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.add(cyl(0.35, 0.45, 4.2, std('#fff4f8', 0.7), bx + Math.cos(a) * 7.6, 2.4, bz + Math.sin(a) * 7.6, 8)); const o = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), glowMat(['#ffd0e8', '#d0e8ff', '#fff2a0'][i % 3])); o.position.set(bx + Math.cos(a) * 7.6, 4.9, bz + Math.sin(a) * 7.6); g.add(o); }
  const heart = new THREE.Mesh(new THREE.OctahedronGeometry(1.6, 0), glowMat('#ffd8f0')); heart.scale.y = 1.5; heart.position.set(bx, 6.5, bz - 3); heart.userData.noBake = true; g.add(heart);
  const hh = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#ffd0f0', transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); hh.scale.set(14, 14, 1); hh.position.set(bx, 6.5, bz - 3); g.add(hh);
  for (const [x, z] of [[-6, 14], [8, 4], [-12, -8], [10, -12], [0, 24]]) lightShaft(g, x, z, A.sunPos, 28, 3.6, '#fff8dc', 0.13);

  // ---- 云海 + 大云 + 小浮岛 + 彩虹 ----
  const cs = cloudSeaTex(); cs.wrapS = cs.wrapT = THREE.RepeatWrapping; cs.repeat.set(10, 10);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.MeshBasicMaterial({ map: cs, fog: true, toneMapped: false })); sea.rotation.x = -Math.PI / 2; sea.position.y = -16; g.add(nm(sea));
  const puffs: { m: THREE.Group; r: number; a: number; sp: number; y: number }[] = [];
  for (let i = 0; i < 34; i++) { const m = puff(0.8 + rnd() * 1.7, rnd); const a = rnd() * 6.28, r = 40 + rnd() * 90; const y = -9 + rnd() * 10; m.position.set(Math.cos(a) * r, y, Math.sin(a) * r); nm(m); m.userData.noBake = true; g.add(m); puffs.push({ m, r, a, sp: (rnd() - 0.5) * 0.004, y }); }
  const isles: { m: THREE.Group; y: number; ph: number }[] = [];
  for (let i = 0; i < 9; i++) { const m = islet(rnd, 0.7 + rnd() * 0.9); const a = (i / 9) * 6.28 + rnd() * 0.3, r = 50 + rnd() * 50, y = -3 + rnd() * 14; m.position.set(Math.cos(a) * r, y, Math.sin(a) * r); nm(m); m.userData.noBake = true; g.add(m); isles.push({ m, y, ph: rnd() * 6 }); }
  ['#ff6a6a', '#ffa84a', '#ffe85a', '#6adc7a', '#5ab8ff', '#7a7aff', '#c07aff'].forEach((c, i) => { const arc = new THREE.Mesh(new THREE.TorusGeometry(88 - i * 1.7, 0.9, 6, 64, Math.PI), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.4, depthWrite: false, toneMapped: false, fog: false })); arc.position.set(-30, -14, -150); nm(arc); arc.userData.noBake = true; g.add(arc); });
  // 白鸟
  const birds: { m: THREE.Mesh; r: number; sp: number; ph: number; y: number }[] = [];
  for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.55), new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide, toneMapped: false })); m.userData.noBake = true; m.userData.noMirror = true; g.add(m); birds.push({ m, r: 12 + rnd() * 26, sp: 0.2 + rnd() * 0.25, ph: rnd() * 6, y: 8 + rnd() * 10 }); }
  for (const [x, z, c, s] of L.glows) { const h = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ map: glowTex(), color: c, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); h.rotation.x = -Math.PI / 2; h.position.set(x, 0.5, z); g.add(nm(h)); }
  for (const [x, y, z, c, i, r] of L.lights) { const l = new THREE.PointLight(c, i * 0.3, r, 1.6); l.position.set(x, y, z); g.add(l); }
  const spark = motes(g, { n: 70, half: 26, color: '#ffffff', size: 0.5, seed: 12, h: [1, 14], speed: 0.6 });
  void ISLE_R;
  return finishTheme(L, g, {
    update: (t) => {
      spark(t); blades.rotation.z = -t * 0.9; heart.position.y = 6.5 + Math.sin(t * 1.4) * 0.5; heart.rotation.y = t * 0.8;
      wg.offset.x = t * 0.03; wg.offset.y = t * 0.02; cs.offset.x = t * 0.004; cs.offset.y = t * 0.002; ft.offset.y = -t * 0.6;
      for (const p of puffs) { p.a += p.sp; p.m.position.set(Math.cos(p.a) * p.r, p.y, Math.sin(p.a) * p.r); }
      for (const s of isles) s.m.position.y = s.y + Math.sin(t * 0.5 + s.ph) * 0.6;
      for (const b of birds) { const a = t * b.sp + b.ph; b.m.position.set(Math.cos(a) * b.r, b.y + Math.sin(a * 2) * 0.8, Math.sin(a) * b.r); b.m.rotation.set(-Math.PI / 2 + Math.sin(t * 9 + b.ph) * 0.5, 0, a + Math.PI / 2); }
    },
  });
}
