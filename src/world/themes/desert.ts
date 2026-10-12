// 日落绿洲（附加场景，烈日下的沙漠）：金黄的沙海、一汪绿洲、卡丁车赛道、金字塔、风蚀石拱。
// 亮得晃眼，热浪里飘着细沙——和夜色霓虹的街区完全是两个世界。
import * as THREE from 'three';
import { mulberry } from '../../fx/util';
import { atmosOf } from '../atmos';
import { glowMat, std } from '../kit';
import { mk, waterGlint } from '../tex';
import type { LevelDef } from '../levels';
import type { Street } from '../street';
import { ARCH, CACTI, CAMP, DUNES, KART_GATE, KART_TRACK, OASIS, PALMS, PYRAMID } from './desert.data';
import { finishTheme, groundPlane, motes, nm, pathTex, plinth, ribbon, shadowBlob } from './common';

const box = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; };
const cyl = (r0: number, r1: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 8) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat); m.position.set(x, y, z); m.castShadow = true; return m; };

const sandTex = () => mk(256, 256, (c) => {
  const rnd = mulberry(21);
  c.fillStyle = '#ecc88a'; c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 46; i++) { c.fillStyle = `rgba(${215 + rnd() * 30 | 0},${170 + rnd() * 40 | 0},${100 + rnd() * 40 | 0},${0.1 + rnd() * 0.2})`; c.beginPath(); c.ellipse(rnd() * 256, rnd() * 256, 18 + rnd() * 50, 6 + rnd() * 16, rnd() * 0.5, 0, 7); c.fill(); }
  // 风纹：一道道平行的细浪
  for (let y = 0; y < 256; y += 5 + rnd() * 6) { c.strokeStyle = rnd() < 0.5 ? 'rgba(255,240,200,0.28)' : 'rgba(160,110,60,0.2)'; c.lineWidth = 1 + rnd(); c.beginPath(); for (let x = 0; x <= 256; x += 16) c.lineTo(x, y + Math.sin(x * 0.045 + y) * 2.2); c.stroke(); }
  for (let i = 0; i < 2200; i++) { c.fillStyle = rnd() < 0.5 ? 'rgba(255,248,220,0.3)' : 'rgba(150,100,50,0.22)'; c.fillRect(rnd() * 256, rnd() * 256, 1, 1); }
}, 'desert-sand');

/** 仙人掌：主干 + 一到两条上翘的分枝，顶上开一朵小花 */
function cactus(sc: number, seed: number): THREE.Group {
  const g = new THREE.Group(), m = std('#4f9a4a', 0.85), m2 = std('#3f8640', 0.9), rnd = mulberry(seed);
  g.add(cyl(0.34, 0.42, 3.2, m, 0, 1.6, 0, 9));
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.34, 9, 6, 0, Math.PI * 2, 0, Math.PI / 2), m); top.position.y = 3.2; g.add(top);
  for (let i = 0; i < 1 + (seed % 2); i++) {
    const s = i ? -1 : 1, y = 1.2 + i * 0.6 + rnd() * 0.3;
    g.add(cyl(0.2, 0.2, 0.9, m2, s * 0.75, y, 0, 7)).rotation.z = Math.PI / 2;
    g.add(cyl(0.22, 0.22, 1.3 + rnd() * 0.4, m2, s * 1.15, y + 0.7, 0, 7));
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), m2); cap.position.set(s * 1.15, y + 1.35 + rnd() * 0.3, 0); g.add(cap);
  }
  for (let i = 0; i < 14; i++) { const a = rnd() * 6.28, y = 0.4 + rnd() * 2.6; const sp = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.2, 3), std('#f4ecc8', 0.6)); sp.position.set(Math.cos(a) * 0.4, y, Math.sin(a) * 0.4); sp.rotation.set(Math.sin(a) * 1.4, 0, -Math.cos(a) * 1.4); g.add(sp); }
  const flower = new THREE.Mesh(new THREE.SphereGeometry(0.17, 7, 5), glowMat(seed % 2 ? '#ff7ab0' : '#ffe27a')); flower.position.set(0, 3.55, 0); g.add(flower);
  g.scale.setScalar(sc);
  return g;
}

/** 棕榈：略弯的树干分节 + 放射下垂的叶片 + 一簇椰子 */
function palm(sc: number, seed: number): THREE.Group {
  const g = new THREE.Group(), rnd = mulberry(seed), bark = std('#9a6c42', 0.9), leaf = std('#3f9a3e', 0.8), leaf2 = std('#58b048', 0.8);
  const lean = (rnd() - 0.5) * 0.5, ang = rnd() * 6.28, H = 6.4;
  let x = 0, z = 0;
  for (let i = 0; i < 9; i++) {
    const h = H / 9, t = i / 9;
    x += Math.cos(ang) * lean * 0.14; z += Math.sin(ang) * lean * 0.14;
    const seg = cyl(0.3 - t * 0.1, 0.34 - t * 0.1, h + 0.05, i % 2 ? bark : std('#a8794a', 0.9), x, h * i + h / 2, z, 8); g.add(seg);
  }
  const top = new THREE.Group(); top.position.set(x, H, z); g.add(top);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rnd() * 0.2, f = new THREE.Group();
    const L = 3.2 + rnd() * 0.9;
    for (let k = 0; k < 4; k++) { const seg = box(0.8 - k * 0.15, 0.06, 0.95, k % 2 ? leaf : leaf2, 0, 0, 0); seg.position.set(0, -k * k * 0.07 + k * 0.1, 0.4 + k * (L / 4)); seg.rotation.x = k * 0.17; seg.scale.z = L / 3.6; f.add(seg); }
    f.rotation.y = a; top.add(f);
  }
  for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), std('#6a4a2a', 0.7)); c.position.set(Math.cos(i * 2.1) * 0.3, -0.35, Math.sin(i * 2.1) * 0.3); top.add(c); }
  g.scale.setScalar(sc);
  return g;
}

/** 沙丘：压扁的大球，外圈当沙墙 */
function dune(w: number, h: number, seed: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), std(seed % 2 ? '#e8bf7e' : '#f0cc90', 0.97));
  m.scale.set(w, h, w * (0.7 + (seed % 3) * 0.12)); m.rotation.y = seed * 1.3; m.receiveShadow = true;
  return m;
}

export function buildDesert(L: LevelDef): Street {
  const g = new THREE.Group(); const half = L.half; const A = atmosOf(L.mood);
  plinth(g, half, '#a8793e', undefined, A.fog);
  groundPlane(g, half, sandTex(), 9, { color: 0xfff2dc });
  const rnd = mulberry(321);

  // ---- 沙丘（外圈 + 角上）----
  DUNES.forEach(([x, z, w, h], i) => { const d = dune(w, h, i + 1); d.position.set(x, 0.2, z); g.add(d); });
  for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2 + rnd() * 0.15, r = 44 + rnd() * 14; const d = dune(6 + rnd() * 8, 2.4 + rnd() * 3.4, i + 20); d.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); nm(d); g.add(d); }

  // ---- 金字塔（北）----
  const [px, pz, ph] = [PYRAMID.x, PYRAMID.z, PYRAMID.half];
  const brick = std('#e0b878', 0.9);
  const pyr = new THREE.Mesh(new THREE.ConeGeometry(ph * 1.41, 15, 4), brick); pyr.rotation.y = Math.PI / 4; pyr.position.set(px, 7.7, pz); pyr.castShadow = true; g.add(pyr);
  for (let i = 1; i < 6; i++) { const w = (ph * 2) * (1 - i / 6.5); g.add(box(w + 0.3, 0.14, w + 0.3, std('#c89a5c', 0.9), px, 0.3 + i * 2.3, pz)); } // 层层石阶的刻线
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.6, 4), glowMat('#ffe27a')); tip.rotation.y = Math.PI / 4; tip.position.set(px, 15.3, pz); g.add(tip);
  g.add(box(2.6, 3.2, 0.8, std('#4a3320', 0.9), px, 1.9, pz + ph - 1.2)); // 入口
  for (const s of [-1, 1]) { g.add(box(1.0, 4.4, 1.0, std('#d8aa68', 0.9), px + s * 2.4, 2.5, pz + ph - 0.6)); const cat = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.0, 4), std('#c89a5c', 0.9)); cat.position.set(px + s * 2.4, 5.2, pz + ph - 0.6); g.add(cat); }
  shadowBlob(g, px + 6, pz + 8, 12, 6, 0.3, 0.4);

  // ---- 风蚀石拱 ----
  const rock = std('#c4885a', 0.95), rock2 = std('#a86e46', 0.95);
  for (const sx of [-3, 3]) { g.add(box(1.8, 5.2, 1.8, rock, ARCH[0] + sx, 2.7, ARCH[1])); g.add(box(2.2, 0.8, 2.2, rock2, ARCH[0] + sx, 0.7, ARCH[1])); }
  const arc = new THREE.Mesh(new THREE.TorusGeometry(3, 0.95, 8, 18, Math.PI), rock); arc.position.set(ARCH[0], 5.1, ARCH[1]); g.add(arc);
  shadowBlob(g, ARCH[0] + 2, ARCH[1] + 2, 7, 3.4, 0.28, 0.4);

  // ---- 仙人掌 / 棕榈 ----
  CACTI.forEach(([x, z, sc], i) => { const c = cactus(sc, i + 3); c.position.set(x, 0.3, z); c.rotation.y = i; g.add(c); });
  PALMS.forEach(([x, z, sc], i) => { const p = palm(sc, i + 11); p.position.set(x, 0.3, z); p.rotation.y = i * 1.7; g.add(p); shadowBlob(g, x - 1.6, z + 1.2, 3.2, 2.6, 0.26, 0.4); });

  // ---- 绿洲 ----
  const [ox0, oz0, ox1, oz1] = OASIS, ow = ox1 - ox0, od = oz1 - oz0, ocx = (ox0 + ox1) / 2, ocz = (oz0 + oz1) / 2;
  const bank = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.2, 40), std('#7fb04a', 0.9)); bank.scale.set(ow / 2 + 1.6, 1, od / 2 + 1.6); bank.position.set(ocx, 0.34, ocz); bank.receiveShadow = true; g.add(nm(bank));
  const water = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.1, 40), new THREE.MeshStandardMaterial({ color: 0x35c0d0, roughness: 0.1, metalness: 0.25, emissive: 0x187a88, emissiveIntensity: 0.55, transparent: true, opacity: 0.94 }));
  water.scale.set(ow / 2, 1, od / 2); water.position.set(ocx, 0.46, ocz); g.add(nm(water));
  const glint = waterGlint(); glint.repeat.set(ow / 9, od / 9);
  const gl = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ map: glint, color: 0xffffff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  gl.rotation.x = -Math.PI / 2; gl.scale.set(ow / 2, od / 2, 1); gl.position.set(ocx, 0.53, ocz); g.add(nm(gl));
  for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2; if (i % 4 === 0) { for (let k = 0; k < 3; k++) { const r = new THREE.Mesh(new THREE.ConeGeometry(0.06, 1.4, 3), std('#5aa84a', 0.8)); r.position.set(ocx + Math.cos(a) * (ow / 2 + 0.7) + k * 0.15, 1.0, ocz + Math.sin(a) * (od / 2 + 0.7)); g.add(r); } } else { const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35 + rnd() * 0.3, 0), std('#b49a78', 0.95)); rk.position.set(ocx + Math.cos(a) * (ow / 2 + 0.9), 0.5, ocz + Math.sin(a) * (od / 2 + 0.9)); rk.scale.y = 0.6; g.add(rk); } }
  // 栈桥 + 渔夫小凳（钓鱼点）
  g.add(box(3.6, 0.16, 1.6, std('#b88a5a', 0.85), OASIS[2] + 0.4, 0.62, 2));
  for (const dz of [-0.7, 0.7]) g.add(cyl(0.08, 0.08, 1.0, std('#8a6244', 0.9), OASIS[2] - 1.1, 0.3, 2 + dz, 5));

  // ---- 卡丁车赛道 ----
  const { cx, cz, rx, rz } = KART_TRACK;
  const ring: [number, number][] = [];
  for (let i = 0; i <= 28; i++) { const a = Math.PI / 2 + (i / 28) * Math.PI * 2; ring.push([cx + Math.cos(a) * rx, cz + Math.sin(a) * rz]); }
  ribbon(g, ring, 4.6, pathTex('desert-track', '#8a6a4a', ['#a88862', '#6a4e36', '#c0a078'], 0.12), 0.36);
  ribbon(g, ring, 0.26, pathTex('desert-track-line', '#fff6dc', ['#fffbe8'], 0.0), 0.38);
  // 轮胎墙（红白相间）+ 路肩
  for (let i = 0; i < 44; i++) {
    const a = (i / 44) * Math.PI * 2;
    for (const k of [-1, 1]) { const rr = 1 + k * 0.28; const tx = cx + Math.cos(a) * rx * rr, tz = cz + Math.sin(a) * rz * rr; if (Math.hypot(tx - KART_GATE[0], tz - KART_GATE[1]) < 3.2) continue; const tire = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.16, 6, 10), std(i % 2 ? '#d83a30' : '#f4f0e8', 0.7)); tire.rotation.x = Math.PI / 2; tire.position.set(tx, 0.55, tz); g.add(tire); if (i % 3 === 0) { const t2 = tire.clone(); t2.position.y = 0.9; g.add(t2); } }
  }
  // 发车门：两根立柱 + 横梁（黑白格）+ 彩旗
  const gx = KART_GATE[0], gz = KART_GATE[1];
  const check = mk(128, 32, (c) => { for (let y = 0; y < 2; y++) for (let x = 0; x < 16; x++) { c.fillStyle = (x + y) % 2 ? '#111' : '#fff'; c.fillRect(x * 8, y * 16, 8, 16); } }, 'desert-check');
  for (const s of [-1, 1]) g.add(cyl(0.14, 0.14, 4.2, std('#e8e0d0', 0.5, 0.3), gx + s * 3.3, 2.2, gz, 8));
  const beam = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.9, 0.2), new THREE.MeshStandardMaterial({ map: check, roughness: 0.6 })); beam.position.set(gx, 4.2, gz); g.add(beam);
  for (let i = 0; i < 9; i++) { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.36), new THREE.MeshBasicMaterial({ color: ['#ff5a4a', '#ffd24a', '#4ac8ff', '#7fe08a'][i % 4], side: THREE.DoubleSide, toneMapped: false })); f.position.set(gx - 3.2 + i * 0.8, 3.6, gz + (i % 2) * 0.05); g.add(f); }
  // 赛道内侧的大遮阳伞 + 加油桶
  const um = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.0, 8), std('#ff7a4a', 0.8)); um.position.set(cx, 3.2, cz); g.add(um); g.add(cyl(0.07, 0.07, 3, std('#8a7a6a', 0.6), cx, 1.7, cz, 5));
  for (let i = 0; i < 3; i++) g.add(cyl(0.42, 0.42, 0.9, std(['#d83a30', '#f4f0e8', '#d83a30'][i], 0.6, 0.2), cx + 2.6 + i * 0.1, 0.8, cz + i * 0.9 - 1, 10));

  // ---- 营地：帐篷 + 篝火 + 旗 ----
  const [kx, kz] = CAMP;
  const tent = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.6, 4), std('#e8c070', 0.9)); tent.rotation.y = Math.PI / 4; tent.position.set(kx, 1.6, kz); tent.castShadow = true; g.add(tent);
  const stripe = new THREE.Mesh(new THREE.ConeGeometry(2.22, 0.8, 4), std('#c8352c', 0.85)); stripe.rotation.y = Math.PI / 4; stripe.position.set(kx, 2.5, kz); g.add(stripe);
  g.add(box(1.2, 1.7, 0.1, std('#4a3320', 0.9), kx, 1.0, kz + 1.55));
  const fx = kx + 4.4, fz = kz + 0.4;
  const flameM = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.1, 7), glowMat('#ff9a3a')); flameM.position.set(fx, 0.95, fz); flameM.userData.noBake = true; g.add(flameM);
  const flame2 = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.8, 7), glowMat('#fff0a8')); flame2.position.set(fx, 0.9, fz); flame2.userData.noBake = true; g.add(flame2);
  for (let i = 0; i < 5; i++) { const a = i * 1.26; const lg = cyl(0.1, 0.1, 1.2, std('#6a4a30', 0.9), fx + Math.cos(a) * 0.3, 0.5, fz + Math.sin(a) * 0.3, 6); lg.rotation.set(Math.sin(a) * 0.9, 0, Math.cos(a) * 0.9); g.add(lg); }
  const fire = new THREE.PointLight(0xff9a40, 8, 8, 1.8); fire.position.set(fx, 1.8, fz); g.add(fire);

  // ---- 零碎：骆驼骨 / 石堆 / 干草球 / 小石头 ----
  for (let i = 0; i < 18; i++) {
    const x = (rnd() - 0.5) * 60, z = (rnd() - 0.5) * 60;
    if (x > OASIS[0] - 3 && x < OASIS[2] + 3 && z > OASIS[1] - 3 && z < OASIS[3] + 3) continue;
    const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4 + rnd() * 0.5, 0), std(['#c49a68', '#b08a5c', '#d4aa78'][i % 3], 0.95)); rk.position.set(x, 0.5, z); rk.scale.y = 0.6; rk.rotation.set(rnd(), rnd(), 0); rk.castShadow = true; g.add(rk);
  }
  for (let i = 0; i < 9; i++) { const x = (rnd() - 0.5) * 56, z = (rnd() - 0.5) * 56; const tw = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), std('#a8844a', 0.9)); tw.position.set(x, 0.8, z); tw.scale.set(1, 0.9, 1); g.add(tw); }
  for (const [x, z] of [[-10, 15], [16, -3], [-18, -3]]) { const k = new THREE.Group(); k.position.set(x, 0.4, z); for (let i = 0; i < 4; i++) { const sk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 4), std('#f4ecd0', 0.7)); sk.position.set(i * 0.3, 0.3, (i % 2) * 0.3); sk.rotation.z = 1.3 + i * 0.3; k.add(sk); } g.add(k); }

  for (const [x, y, z, c, i, r] of L.lights) { const l = new THREE.PointLight(c, i * 0.25, r, 1.6); l.position.set(x, y, z); g.add(l); }

  const dust = motes(g, { n: 100, half, color: '#fff0c0', size: 0.34, seed: 7, h: [0.6, 5], speed: 1.4 });
  const glintDust = motes(g, { n: 36, half: 18, color: '#ffffff', size: 0.5, seed: 17, h: [1, 9], speed: 0.6 });
  const S = finishTheme(L, g, {
    update: (t) => {
      dust(t); glintDust(t * 0.8);
      glint.offset.x = t * 0.02; glint.offset.y = t * 0.04;
      const f = 1 + Math.sin(t * 17) * 0.1 + Math.sin(t * 29) * 0.06; flameM.scale.set(f, 1 + Math.sin(t * 13) * 0.12, f); flame2.scale.set(f, 1 + Math.sin(t * 19) * 0.15, f);
      fire.intensity = 8 + Math.sin(t * 23) * 1.5;
      tip.position.y = 15.3 + Math.sin(t * 1.4) * 0.12;
    },
  });
  return S;
}
