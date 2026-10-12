// 喵雪岭（附加场景，晴天雪后）：白茫茫的雪原、挂雪的雪松、西北的大雪坡（雪橇道）、冒热气的温泉、
// 烟囱冒烟的小木屋、结冰的湖、北面雪中神社，天上慢慢飘着雪花。干净、安静、亮。
import * as THREE from 'three';
import { mulberry } from '../../fx/util';
import { atmosOf } from '../atmos';
import { glowMat, std } from '../kit';
import { aiTex, glowTex, mk } from '../tex';
import type { LevelDef } from '../levels';
import type { Street } from '../street';
import { CABIN, HILL, LAKE, PINES, SHRINE, SLED_POI, SNOWMEN, SPRING } from './snow.data';
import { finishTheme, groundPlane, motes, nm, pathTex, plinth, ribbon, shadowBlob } from './common';

const box = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; };
const cyl = (r0: number, r1: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 8) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat); m.position.set(x, y, z); m.castShadow = true; return m; };

const snowFallback = () => mk(256, 256, (c) => {
  const rnd = mulberry(31);
  c.fillStyle = '#f2f6fc'; c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 50; i++) { c.fillStyle = `rgba(${200 + rnd() * 30 | 0},${215 + rnd() * 30 | 0},255,${0.15 + rnd() * 0.2})`; c.beginPath(); c.ellipse(rnd() * 256, rnd() * 256, 16 + rnd() * 40, 8 + rnd() * 18, rnd() * 3, 0, 7); c.fill(); }
  for (let i = 0; i < 1500; i++) { c.fillStyle = 'rgba(255,255,255,0.6)'; c.fillRect(rnd() * 256, rnd() * 256, 1, 1); }
}, 'snow-ground');

/** 雪松：三层圆锥叠起来，每层上面压一顶雪帽 */
function pine(sc: number, seed: number): THREE.Group {
  const g = new THREE.Group(), rnd = mulberry(seed);
  const leaf = std(seed % 3 ? '#2f7a5a' : '#3a8a62', 0.9), snow = std('#ffffff', 0.85);
  g.add(cyl(0.22, 0.3, 1.4, std('#6a4a32', 0.9), 0, 0.7, 0, 6));
  for (let i = 0; i < 3; i++) {
    const r = 1.9 - i * 0.5, h = 2.0 - i * 0.3, y = 1.6 + i * 1.25;
    const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), leaf); c.position.y = y; c.rotation.y = rnd() * 3; c.castShadow = true; g.add(c);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.72, h * 0.45, 8), snow); cap.position.y = y + h * 0.3; cap.rotation.y = c.rotation.y; g.add(cap);
  }
  g.scale.setScalar(sc);
  return g;
}

/** 雪猫雪人：两个雪球 + 猫耳 + 围巾 + 小木棍手 */
function snowCat(seed: number): THREE.Group {
  const g = new THREE.Group(), snow = std('#ffffff', 0.8);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.75, 14, 10), snow); body.position.y = 0.7; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), snow); head.position.y = 1.7; g.add(head);
  for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.32, 4), snow); ear.position.set(s * 0.28, 2.15, 0); ear.rotation.z = -s * 0.3; g.add(ear); }
  for (const s of [-1, 1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), std('#2a2a2a', 0.5)); eye.position.set(s * 0.17, 1.78, 0.45); g.add(eye); }
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 4), std('#ff8ab0', 0.6)); nose.rotation.x = Math.PI / 2; nose.position.set(0, 1.66, 0.5); g.add(nose);
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.1, 6, 14), std(['#d83a30', '#3a8ad8', '#e8b030'][seed % 3], 0.8)); scarf.rotation.x = Math.PI / 2; scarf.position.y = 1.3; g.add(scarf);
  for (const s of [-1, 1]) { const arm = cyl(0.04, 0.04, 0.9, std('#6a4a32', 0.9), s * 0.95, 1.0, 0, 4); arm.rotation.z = s * 1.0; g.add(arm); }
  return g;
}

export function buildSnow(L: LevelDef): Street {
  const g = new THREE.Group(); const half = L.half; const A = atmosOf(L.mood); const rnd = mulberry(612);
  plinth(g, half, '#c8d8ec', undefined, A.fog);
  const cc0 = aiTex('cc0_snow_014'); // ambientCG Snow014（CC0），加载不到时退回程序化雪地
  groundPlane(g, half, cc0 ?? snowFallback(), cc0 ? 6 : 8, { color: 0xffffff, rough: 0.9 });

  // ---- 外圈雪堆：挡住地图边 ----
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2 + rnd() * 0.1, r = 40 + rnd() * 10;
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), std(i % 2 ? '#f4f8ff' : '#e8f0fa', 0.9));
    m.scale.set(7 + rnd() * 6, 3 + rnd() * 4, 6 + rnd() * 5); m.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); nm(m); g.add(m);
  }
  // 远山：几座白顶的大山
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.3, r = 95 + rnd() * 30, h = 30 + rnd() * 30;
    const m = new THREE.Mesh(new THREE.ConeGeometry(h * 0.9, h, 7), std('#b4c4dc', 0.95)); m.position.set(Math.cos(a) * r, h / 2 - 3, Math.sin(a) * r); nm(m); g.add(m);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(h * 0.42, h * 0.47, 7), std('#ffffff', 0.85)); cap.position.set(Math.cos(a) * r, h - 3 - h * 0.235, Math.sin(a) * r); nm(cap); g.add(cap);
  }

  // ---- 大雪坡 + 雪橇道 ----
  const [hx, hz, hr] = HILL;
  const hill = new THREE.Mesh(new THREE.ConeGeometry(hr * 1.4, 13, 12), std('#f6f9ff', 0.9)); hill.position.set(hx, 6.3, hz); hill.castShadow = true; hill.receiveShadow = true; g.add(hill);
  for (let i = 0; i < 5; i++) { const p = pine(0.8, 70 + i); const a = -0.2 + i * 0.9; p.position.set(hx + Math.cos(a) * hr * 1.05, 2.5, hz + Math.sin(a) * hr * 1.05); g.add(p); }
  // 雪橇道：从坡上斜下来的一条压实的蓝色雪道，终点在出发点
  const lane: [number, number][] = [[hx + 2, hz + 3], [hx + 5, hz + 7], [SLED_POI[0] - 1, SLED_POI[1] - 2], [SLED_POI[0], SLED_POI[1]]];
  ribbon(g, lane, 2.6, pathTex('snow-lane', '#cfe4fa', ['#e4f0ff', '#b8d4f0', '#ffffff'], 0.2), 0.36);
  for (let i = 0; i < 6; i++) { const t = i / 5, [ax, az] = lane[0], [bx, bz] = lane[2]; for (const s of [-1, 1]) { const flag = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.9, 4), glowMat(i % 2 ? '#ff5a4a' : '#4ac8ff')); flag.position.set(ax + (bx - ax) * t + s * 1.6, 0.8, az + (bz - az) * t); g.add(flag); } }

  // ---- 冰湖：浅蓝的冰面 + 冰洞 + 冰钓小凳 ----
  const [lx, lz, lrx, lrz] = LAKE;
  const ice = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshStandardMaterial({ color: 0xbfe4f8, roughness: 0.15, metalness: 0.2, emissive: 0x3a7aa8, emissiveIntensity: 0.15 }));
  ice.rotation.x = -Math.PI / 2; ice.scale.set(lrx, lrz, 1); ice.position.set(lx, 0.35, lz); g.add(nm(ice));
  const crackM = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
  for (let i = 0; i < 6; i++) { const a = rnd() * 6.28, pts = [new THREE.Vector3(lx, 0.37, lz)]; let x = lx, z = lz; for (let k = 0; k < 4; k++) { x += Math.cos(a + (rnd() - 0.5)) * lrx * 0.22; z += Math.sin(a + (rnd() - 0.5)) * lrz * 0.22; pts.push(new THREE.Vector3(x, 0.37, z)); } g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), crackM)); }
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), new THREE.MeshStandardMaterial({ color: 0x1a4a6a, roughness: 0.1 })); hole.rotation.x = -Math.PI / 2; hole.position.set(lx + 2, 0.38, lz - 1); g.add(hole);
  g.add(box(0.5, 0.35, 0.5, std('#8a5a3a', 0.9), lx + 3, 0.55, lz - 1));

  // ---- 温泉：一圈石头 + 冒热气的水面 + 木牌 ----
  const [px, pz, pr] = SPRING;
  const hot = new THREE.Mesh(new THREE.CircleGeometry(pr, 32), new THREE.MeshStandardMaterial({ color: 0x6ad0d8, roughness: 0.1, emissive: 0x2a8a90, emissiveIntensity: 0.4 }));
  hot.rotation.x = -Math.PI / 2; hot.position.set(px, 0.42, pz); g.add(nm(hot));
  for (let i = 0; i < 22; i++) { const a = (i / 22) * Math.PI * 2; const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55 + rnd() * 0.3, 0), std(i % 2 ? '#7a8090' : '#9098a8', 0.95)); rk.position.set(px + Math.cos(a) * (pr + 0.3), 0.5, pz + Math.sin(a) * (pr + 0.3)); rk.scale.y = 0.7; g.add(rk); const cap = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), std('#ffffff', 0.85)); cap.position.copy(rk.position); cap.position.y += 0.25; cap.scale.y = 0.5; g.add(cap); }
  const steam: THREE.Sprite[] = [];
  for (let i = 0; i < 8; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false })); s.position.set(px + (rnd() - 0.5) * pr, 1 + rnd() * 2, pz + (rnd() - 0.5) * pr); s.scale.setScalar(2 + rnd() * 1.5); s.userData = { ph: rnd() * 6, x: s.position.x, z: s.position.z }; steam.push(s); g.add(s); }
  g.add(cyl(0.08, 0.08, 1.6, std('#6a4a32', 0.9), px - pr - 1.2, 0.8, pz + 1, 5));
  g.add(box(1.2, 0.6, 0.08, std('#c89a6a', 0.8), px - pr - 1.2, 1.6, pz + 1));

  // ---- 小木屋（烟囱冒烟、窗户透暖光）----
  const [cx, cz] = CABIN;
  const wood = std('#8a5a3a', 0.9), wood2 = std('#6a4228', 0.9);
  for (let i = 0; i < 6; i++) { const log = cyl(0.25, 0.25, 4.8, i % 2 ? wood : wood2, cx, 0.5 + i * 0.45, cz, 8); log.rotation.z = Math.PI / 2; g.add(log); const log2 = cyl(0.25, 0.25, 4.0, i % 2 ? wood2 : wood, cx, 0.5 + i * 0.45, cz, 8); log2.rotation.x = Math.PI / 2; g.add(log2); }
  g.add(box(4.4, 2.6, 3.6, wood, cx, 1.6, cz));
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.7, 2.2, 4), std('#a03a2a', 0.8)); roof.rotation.y = Math.PI / 4; roof.position.set(cx, 4.0, cz); roof.scale.z = 0.85; roof.castShadow = true; g.add(roof);
  const rs = new THREE.Mesh(new THREE.ConeGeometry(3.75, 1.0, 4), std('#ffffff', 0.85)); rs.rotation.y = Math.PI / 4; rs.position.set(cx, 4.6, cz); rs.scale.z = 0.85; g.add(rs);
  g.add(box(0.7, 1.6, 0.7, std('#7a7a84', 0.9), cx + 1.2, 4.6, cz - 0.5));
  for (const s of [-1, 1]) { const win = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.7), glowMat('#ffc070')); win.position.set(cx + s * 1.2, 1.9, cz + 1.82); g.add(win); }
  g.add(box(0.9, 1.5, 0.08, std('#4a2a18', 0.9), cx, 1.05, cz + 1.84));
  const smoke: THREE.Sprite[] = [];
  for (let i = 0; i < 5; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xd8dce4, transparent: true, opacity: 0.45, depthWrite: false, toneMapped: false })); s.userData = { ph: i / 5 }; smoke.push(s); g.add(s); }
  // 柴堆
  for (let i = 0; i < 6; i++) { const lg = cyl(0.16, 0.16, 1.1, wood2, cx - 3.2, 0.5 + Math.floor(i / 3) * 0.32, cz + (i % 3) * 0.34 - 0.3, 6); lg.rotation.x = Math.PI / 2; g.add(lg); }
  const lamp = new THREE.PointLight(0xffb060, 6, 9, 1.8); lamp.position.set(cx, 2.4, cz + 2.6); g.add(lamp);

  // ---- 雪中神社（北）：石台 + 红鸟居 + 小殿 ----
  const [sx, sz] = SHRINE;
  g.add(box(10, 0.6, 5.5, std('#b8c0cc', 0.9), sx, 0.6, sz));
  const red = std('#d83a30', 0.7);
  for (const s of [-1, 1]) g.add(cyl(0.3, 0.3, 4.6, red, sx + s * 2.6, 2.6, sz + 3.6, 8));
  g.add(box(7.2, 0.4, 0.5, red, sx, 4.9, sz + 3.6)); g.add(box(6.2, 0.3, 0.4, red, sx, 4.2, sz + 3.6));
  g.add(box(7.4, 0.2, 0.7, std('#ffffff', 0.85), sx, 5.15, sz + 3.6));
  g.add(box(5, 2.6, 3, std('#e8dcc8', 0.85), sx, 2.2, sz - 0.6));
  const sr = new THREE.Mesh(new THREE.ConeGeometry(4.2, 1.8, 4), std('#5a4a5a', 0.8)); sr.rotation.y = Math.PI / 4; sr.scale.z = 0.7; sr.position.set(sx, 4.4, sz - 0.6); g.add(sr);
  const sr2 = new THREE.Mesh(new THREE.ConeGeometry(4.25, 0.7, 4), std('#ffffff', 0.85)); sr2.rotation.y = Math.PI / 4; sr2.scale.z = 0.7; sr2.position.set(sx, 4.95, sz - 0.6); g.add(sr2);
  for (const s of [-1, 1]) { const ln = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), glowMat('#ffd27a')); ln.position.set(sx + s * 1.8, 2.6, sz + 1.1); g.add(ln); }

  // ---- 雪松 / 雪猫雪人 / 零碎 ----
  PINES.forEach(([x, z, sc], i) => { const p = pine(sc, i + 5); p.position.set(x, 0.3, z); p.rotation.y = i; g.add(p); shadowBlob(g, x + 1, z + 1, 2 * sc, 1.6 * sc, 0.18, 0.37); });
  SNOWMEN.forEach(([x, z], i) => { const s = snowCat(i); s.position.set(x, 0.3, z); s.rotation.y = 0.4 - i * 0.6; g.add(s); });
  for (let i = 0; i < 26; i++) {
    const x = (rnd() - 0.5) * 58, z = (rnd() - 0.5) * 58;
    if (Math.hypot(x - lx, z - lz) < lrx + 1 || Math.hypot(x - px, z - pz) < pr + 2) continue;
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.5 + rnd() * 0.6, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), std('#ffffff', 0.85)); m.position.set(x, 0.3, z); m.scale.y = 0.45; g.add(m);
  }
  for (let i = 0; i < 10; i++) { const x = (rnd() - 0.5) * 56, z = (rnd() - 0.5) * 56; const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.35 + rnd() * 0.3, 0), std('#bfe8ff', 0.15, 0.2, '#7ac8ff', 0.6)); c.position.set(x, 0.6, z); c.scale.y = 1.8; c.rotation.y = rnd() * 3; g.add(c); }
  // 小路：从出生点往北分叉到各处
  ribbon(g, [[0, 28], [0, 18], [2, 8], [0, -2], [-2, -12], [0, -20]], 3.2, pathTex('snow-path', '#e0e8f2', ['#ffffff', '#cdd8e6', '#d8c8b0'], 0.25), 0.34);

  for (const [x, y, z, c, i, r] of L.lights) { const l = new THREE.PointLight(c, i * 0.25, r, 1.6); l.position.set(x, y, z); g.add(l); }

  const flakes = motes(g, { n: 220, half, color: '#ffffff', size: 0.28, seed: 9, h: [0.4, 14], speed: 0.9 });
  const S = finishTheme(L, g, {
    update: (t) => {
      flakes(t);
      for (const s of steam) { const u = s.userData as { ph: number; x: number; z: number }, k = ((t * 0.25 + u.ph) % 1); s.position.set(u.x + Math.sin(t + u.ph) * 0.3, 0.8 + k * 3.2, u.z); (s.material as THREE.SpriteMaterial).opacity = 0.4 * (1 - k); }
      smoke.forEach((s) => { const k = (t * 0.18 + (s.userData as { ph: number }).ph) % 1; s.position.set(cx + 1.2 + k * 1.2, 5.6 + k * 4, cz - 0.5 - k * 0.6); s.scale.setScalar(0.8 + k * 2.4); (s.material as THREE.SpriteMaterial).opacity = 0.5 * (1 - k); });
    },
  });
  return S;
}
