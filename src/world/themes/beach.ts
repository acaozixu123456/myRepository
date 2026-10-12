// 椰风海湾（附加场景，上午的海边）：金色沙滩一路铺到海边，浪花一层层拍上岸；西边浪区立着冲浪板，
// 正中一条木栈桥伸进海里，东边退潮的湿沙滩涂上散着贝壳，东北角红白灯塔，西南椰子小吧台，椰树、遮阳伞、沙堡。
import * as THREE from 'three';
import { mulberry } from '../../fx/util';
import { atmosOf } from '../atmos';
import { glowMat, std } from '../kit';
import { aiTex, mk, waterGlint } from '../tex';
import type { LevelDef } from '../levels';
import type { Street } from '../street';
import { BAR, CASTLE, FLAT, LIGHTHOUSE, PALMS, PIER, SEA, SHORE_Z, SURF_POI, UMBRELLAS } from './beach.data';
import { palm } from './desert';
import { finishTheme, groundPlane, motes, nm, plinth, shadowBlob } from './common';

const box = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; };
const cyl = (r0: number, r1: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 8) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat); m.position.set(x, y, z); m.castShadow = true; return m; };

const sandFallback = () => mk(256, 256, (c) => {
  const rnd = mulberry(41);
  c.fillStyle = '#f2dcae'; c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2400; i++) { c.fillStyle = rnd() < 0.5 ? 'rgba(255,248,226,0.4)' : 'rgba(180,140,90,0.25)'; c.fillRect(rnd() * 256, rnd() * 256, 1, 1); }
}, 'beach-sand');
/** 浪花：一条白色的泡沫带，透明度随 x 变化，做成贴图沿岸边滚动 */
const foamTex = () => mk(512, 64, (c) => {
  const rnd = mulberry(77);
  c.clearRect(0, 0, 512, 64);
  for (let i = 0; i < 260; i++) { const x = rnd() * 512, y = 20 + rnd() * 30, r = 3 + rnd() * 10; c.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.5})`; c.beginPath(); c.ellipse(x, y, r * 2, r * 0.6, 0, 0, 7); c.fill(); }
}, 'beach-foam');

export function buildBeach(L: LevelDef): Street {
  const g = new THREE.Group(); const half = L.half; const A = atmosOf(L.mood); const rnd = mulberry(733);
  plinth(g, half, '#d8b880', undefined, A.fog);
  const cc0 = aiTex('cc0_beach_093c'); // ambientCG Ground093C 海滩沙（CC0）
  groundPlane(g, half, cc0 ?? sandFallback(), cc0 ? 7 : 9, { color: cc0 ? 0xfff4e0 : 0xffffff, rough: 0.95 });

  // ---- 大海：一直铺到天边，近岸浅、远处深；表面有闪光 + 起伏的浪花带 ----
  const [sx0, , sx1, sz1] = SEA;
  const seaMat = new THREE.MeshStandardMaterial({ color: 0x2aa8d0, roughness: 0.12, metalness: 0.15, emissive: 0x0a4a68, emissiveIntensity: 0.35, transparent: true, opacity: 0.96 });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(320, 160), seaMat); sea.rotation.x = -Math.PI / 2; sea.position.set(0, 0.42, sz1 - 80); g.add(nm(sea));
  const shallow = new THREE.Mesh(new THREE.PlaneGeometry(sx1 - sx0 + 40, 6), new THREE.MeshStandardMaterial({ color: 0x7ae0e0, roughness: 0.1, transparent: true, opacity: 0.85 })); shallow.rotation.x = -Math.PI / 2; shallow.position.set(0, 0.44, SHORE_Z - 2.6); g.add(nm(shallow));
  const glint = waterGlint(); glint.repeat.set(24, 10);
  const gl = new THREE.Mesh(new THREE.PlaneGeometry(320, 140), new THREE.MeshBasicMaterial({ map: glint, color: 0xffffff, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  gl.rotation.x = -Math.PI / 2; gl.position.set(0, 0.47, sz1 - 72); g.add(nm(gl));
  const foams: { m: THREE.Mesh; tex: THREE.Texture; ph: number; z: number }[] = [];
  for (let i = 0; i < 3; i++) {
    const tex = foamTex().clone(); tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(5, 1); tex.needsUpdate = true;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(sx1 - sx0 + 40, 2.2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(0, 0.5, SHORE_Z - 1 - i * 2.5); g.add(nm(m)); foams.push({ m, tex, ph: i * 2.1, z: SHORE_Z - 1 - i * 2.5 });
  }
  // 远处的小岛和帆船
  for (let i = 0; i < 4; i++) { const x = -60 + i * 40 + rnd() * 10, z = -80 - rnd() * 30; const isl = new THREE.Mesh(new THREE.SphereGeometry(6 + rnd() * 6, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), std('#5aa86a', 0.9)); isl.scale.y = 0.45; isl.position.set(x, 0, z); nm(isl); g.add(isl); const p = palm(1.4, 90 + i); p.position.set(x, 1.5, z); g.add(p); }
  const sails: THREE.Group[] = [];
  for (let i = 0; i < 3; i++) { const b = new THREE.Group(); b.add(box(3, 0.6, 1.2, std('#ffffff', 0.6))); const sail = new THREE.Mesh(new THREE.ConeGeometry(1.4, 4, 3), std(['#ff6a5a', '#ffd24a', '#4ac8ff'][i], 0.7)); sail.position.y = 2.4; sail.scale.z = 0.15; b.add(sail); b.position.set(-40 + i * 35, 0.6, -50 - i * 12); b.userData = { x: b.position.x, ph: i * 2 }; nm(b); sails.push(b); g.add(b); }

  // ---- 退潮滩涂：深色湿沙 + 贝壳 + 小水洼 ----
  const [fx, fz, frx, frz] = FLAT;
  const wet = aiTex('cc0_wetsand_054');
  const flatMat = new THREE.MeshStandardMaterial({ map: wet ?? undefined, color: wet ? 0xd8c8a8 : 0xb89a70, roughness: 0.35, metalness: 0.05 });
  if (wet) { wet.wrapS = wet.wrapT = THREE.RepeatWrapping; wet.repeat.set(3, 2); }
  const flat = new THREE.Mesh(new THREE.CircleGeometry(1, 40), flatMat); flat.rotation.x = -Math.PI / 2; flat.scale.set(frx, frz, 1); flat.position.set(fx, 0.36, fz); g.add(nm(flat));
  for (let i = 0; i < 4; i++) { const p = new THREE.Mesh(new THREE.CircleGeometry(0.6 + rnd() * 0.6, 16), new THREE.MeshStandardMaterial({ color: 0x8ad8e8, roughness: 0.05, metalness: 0.3 })); p.rotation.x = -Math.PI / 2; p.scale.y = 0.6; p.position.set(fx + (rnd() - 0.5) * frx * 1.4, 0.37, fz + (rnd() - 0.5) * frz * 1.2); g.add(p); }
  for (let i = 0; i < 18; i++) { const sh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), std(['#ffd0e0', '#fff4e0', '#ffb08a', '#e8d8ff'][i % 4], 0.6)); sh.scale.set(1, 0.5, 1.2); sh.position.set(fx + (rnd() - 0.5) * frx * 1.6, 0.38, fz + (rnd() - 0.5) * frz * 1.6); g.add(sh); }

  // ---- 栈桥 ----
  const plank = std('#a87a4a', 0.85), post = std('#7a5432', 0.9);
  for (let z = PIER.z0 + 0.4; z > PIER.z1; z -= 0.7) g.add(box(PIER.w, 0.12, 0.6, plank, PIER.x, 0.95, z));
  for (let z = PIER.z0; z >= PIER.z1; z -= 2.2) for (const s of [-1, 1]) g.add(cyl(0.14, 0.14, 1.6, post, PIER.x + s * (PIER.w / 2 - 0.1), 0.5, z, 6));
  for (const s of [-1, 1]) { const rail = box(0.08, 0.08, PIER.z0 - PIER.z1, post, PIER.x + s * (PIER.w / 2 - 0.1), 1.6, (PIER.z0 + PIER.z1) / 2); g.add(rail); }
  g.add(box(1.0, 1.0, 1.0, std('#5a8ac8', 0.6), PIER.x + 0.6, 1.5, PIER.z1 + 1)); // 鱼桶

  // ---- 浪区：一排插在沙里的冲浪板 + 救生员高脚椅 ----
  const [ux, uz] = SURF_POI;
  ['#ff6a5a', '#ffd24a', '#4ac8ff', '#7fe08a'].forEach((c, i) => { const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 2.2, 4, 10), std(c, 0.5)); b.scale.z = 0.2; b.position.set(ux - 5 + i * 0.9, 1.4, uz + 4.5); b.rotation.z = (i - 1.5) * 0.08; b.castShadow = true; g.add(b); });
  const chair = new THREE.Group(); chair.position.set(ux + 6, 0.3, uz + 3);
  for (const [dx, dz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) chair.add(cyl(0.07, 0.07, 2.6, std('#ffffff', 0.6), dx, 1.3, dz, 5));
  chair.add(box(1.5, 0.12, 1.5, std('#ff4a3a', 0.6), 0, 2.6, 0)); chair.add(box(1.5, 1.0, 0.1, std('#ff4a3a', 0.6), 0, 3.1, 0.7));
  g.add(chair);

  // ---- 灯塔（红白条纹，顶上的灯会转）----
  const [lx, lz] = LIGHTHOUSE;
  g.add(cyl(2.0, 2.2, 0.8, std('#9a9488', 0.9), lx, 0.7, lz, 12));
  for (let i = 0; i < 6; i++) g.add(cyl(1.5 - i * 0.12, 1.62 - i * 0.12, 2, std(i % 2 ? '#ffffff' : '#e8382c', 0.6), lx, 2.1 + i * 2, lz, 14));
  g.add(cyl(1.1, 1.1, 0.2, std('#3a3a44', 0.5), lx, 13.1, lz, 12));
  const lampHead = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.2, 10), glowMat('#fff2b0')); lampHead.position.set(lx, 13.8, lz); g.add(lampHead);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.0, 12), std('#e8382c', 0.6)); cap.position.set(lx, 14.9, lz); g.add(cap);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(1.4, 16, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff6c0, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  beam.rotation.z = Math.PI / 2; beam.position.set(8, 0, 0); const beamPivot = new THREE.Group(); beamPivot.position.set(lx, 13.8, lz); beamPivot.add(beam); beamPivot.userData.noBake = true; g.add(beamPivot);

  // ---- 椰子小吧台（草顶）----
  const [bx, bz] = BAR;
  g.add(box(5.4, 1.2, 1.2, std('#b8844a', 0.85), bx, 0.9, bz + 1.2));
  g.add(box(5.6, 0.14, 1.5, std('#e8c890', 0.8), bx, 1.55, bz + 1.2));
  for (const [dx, dz] of [[-2.6, -1.6], [2.6, -1.6], [-2.6, 1.8], [2.6, 1.8]]) g.add(cyl(0.12, 0.14, 3.2, std('#8a6a3a', 0.9), bx + dx, 1.9, bz + dz, 6));
  const thatch = new THREE.Mesh(new THREE.ConeGeometry(4.6, 1.8, 6), std('#d8b060', 0.95)); thatch.position.set(bx, 4.1, bz); thatch.scale.z = 0.8; thatch.castShadow = true; g.add(thatch);
  for (let i = 0; i < 4; i++) { const coco = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), std('#6a4a2a', 0.8)); coco.position.set(bx - 1.6 + i * 1.0, 1.85, bz + 1.2); g.add(coco); const straw = cyl(0.03, 0.03, 0.5, glowMat(['#ff6a8a', '#7fe08a'][i % 2]), bx - 1.5 + i * 1.0, 2.2, bz + 1.2, 4); straw.rotation.z = 0.4; g.add(straw); }
  for (let i = 0; i < 6; i++) { const ln = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5), glowMat(['#ff6a5a', '#ffd24a', '#4ac8ff'][i % 3])); ln.position.set(bx - 2.5 + i, 3.1 - Math.sin((i / 5) * Math.PI) * 0.3, bz + 1.8); g.add(ln); }

  // ---- 椰树 / 遮阳伞 / 沙堡 / 零碎 ----
  PALMS.forEach(([x, z, sc], i) => { const p = palm(sc, i + 31); p.position.set(x, 0.3, z); p.rotation.y = i * 1.3; g.add(p); shadowBlob(g, x - 1.6, z + 1.2, 3.2, 2.6, 0.24, 0.37); });
  UMBRELLAS.forEach(([x, z, c], i) => {
    g.add(cyl(0.05, 0.05, 2.6, std('#f4f0e8', 0.6), x, 1.5, z, 5));
    const top = new THREE.Mesh(new THREE.ConeGeometry(1.7, 0.7, 10), std(c, 0.75)); top.position.set(x, 2.9, z); top.castShadow = true; g.add(top);
    const towel = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.0), std(i % 2 ? '#ffffff' : c, 0.9)); towel.rotation.x = -Math.PI / 2; towel.rotation.z = 0.3 + i; towel.position.set(x + 1.2, 0.37, z + 0.6); g.add(towel);
    shadowBlob(g, x + 0.6, z + 0.6, 2.0, 1.6, 0.22, 0.37);
  });
  const [cx, cz] = CASTLE;
  const sandM = std('#e8c890', 0.95);
  g.add(box(2.0, 0.8, 2.0, sandM, cx, 0.7, cz));
  for (const [dx, dz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) { g.add(cyl(0.35, 0.4, 1.4, sandM, cx + dx, 1.0, cz + dz, 8)); const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.5, 8), sandM); c2.position.set(cx + dx, 1.95, cz + dz); g.add(c2); }
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), new THREE.MeshBasicMaterial({ color: '#ff5a4a', side: THREE.DoubleSide, toneMapped: false })); fl.position.set(cx + 0.25, 2.6, cz); g.add(fl); g.add(cyl(0.02, 0.02, 0.9, std('#8a6a3a', 0.8), cx, 2.3, cz, 4));
  for (let i = 0; i < 20; i++) {
    const x = (rnd() - 0.5) * 58, z = SHORE_Z + 2 + rnd() * 40;
    if (Math.abs(z) > 29) continue;
    if (rnd() < 0.5) { const sh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), std(['#ffd0e0', '#fff4e0', '#ffb08a'][i % 3], 0.6)); sh.scale.set(1, 0.5, 1.2); sh.position.set(x, 0.36, z); g.add(sh); }
    else { const st = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.08, 5), std('#ff8a5a', 0.7)); st.position.set(x, 0.38, z); st.rotation.y = rnd() * 3; g.add(st); }
  }
  // 两块礁石压住地图两侧的海岸
  for (const [x, z, s] of [[-30, -13, 2.4], [31, -13, 2.0], [-27, -16, 1.6]] as const) { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), std('#7a7468', 0.95)); r.position.set(x, s * 0.4, z); r.scale.y = 0.7; r.castShadow = true; g.add(r); }

  for (const [x, y, z, c, i, r] of L.lights) { const l = new THREE.PointLight(c, i * 0.25, r, 1.6); l.position.set(x, y, z); g.add(l); }

  const sparkle = motes(g, { n: 40, half: 24, color: '#ffffff', size: 0.4, seed: 23, h: [0.6, 6], speed: 0.6 });
  const S = finishTheme(L, g, {
    update: (t) => {
      sparkle(t);
      glint.offset.x = t * 0.01; glint.offset.y = t * 0.03;
      for (const f of foams) { const k = (Math.sin(t * 0.8 + f.ph) + 1) / 2; f.m.position.z = f.z + k * 1.6; (f.m.material as THREE.MeshBasicMaterial).opacity = 0.35 + (1 - k) * 0.5; f.tex.offset.x = t * 0.02 + f.ph; }
      beamPivot.rotation.y = t * 0.8;
      for (const s of sails) { const u = s.userData as { x: number; ph: number }; s.position.x = u.x + Math.sin(t * 0.05 + u.ph) * 10; s.rotation.z = Math.sin(t * 0.9 + u.ph) * 0.06; }
    },
  });
  return S;
}
