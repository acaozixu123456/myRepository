// 赤壁港（晚霞）：落日正对着北面的海，天边烧成橙红；三座木栈桥伸进海里，桥边泊着挂满灯笼的帆船，远处是被夕阳染红的赤壁崖。
// 南面是码头仓库、酒肆、灯塔和一堆堆货。
import * as THREE from 'three';
import { mulberry } from '../../fx/util';
import { atmosOf } from '../atmos';
import { glowMat, std } from '../kit';
import { buildSteam } from '../steam';
import { aiTex, glowTex, mk, waterGlint } from '../tex';
import type { LevelDef } from '../levels';
import type { Street } from '../street';
import { eaveRoof, hall, lantern } from './arch';
import { CRATES, LIGHTHOUSE, PIERS, SEA_Z, TAVERN, TEAHOUSE, WAREHOUSES } from './harbor.data';
import { finishTheme, nm, shadowBlob } from './common';

const box = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; };
const cyl = (r0: number, r1: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 10) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat); m.position.set(x, y, z); m.castShadow = true; return m; };

const plankTex = (key: string, base: string, vertical = true) => mk(256, 256, (c) => {
  const rnd = mulberry(key.length * 17);
  c.fillStyle = base; c.fillRect(0, 0, 256, 256);
  const n = 8;
  for (let i = 0; i < n; i++) {
    c.fillStyle = `rgba(${rnd() < 0.5 ? '255,220,170' : '60,30,10'},${0.06 + rnd() * 0.12})`;
    if (vertical) c.fillRect(i * (256 / n), 0, 256 / n, 256); else c.fillRect(0, i * (256 / n), 256, 256 / n);
    c.strokeStyle = 'rgba(40,20,8,.55)'; c.lineWidth = 2; c.beginPath(); if (vertical) { c.moveTo(i * (256 / n), 0); c.lineTo(i * (256 / n), 256); } else { c.moveTo(0, i * (256 / n)); c.lineTo(256, i * (256 / n)); } c.stroke();
    for (let k = 0; k < 14; k++) { c.fillStyle = 'rgba(60,30,10,.18)'; if (vertical) c.fillRect(i * (256 / n) + rnd() * 28, rnd() * 256, 1, 8 + rnd() * 30); else c.fillRect(rnd() * 256, i * (256 / n) + rnd() * 28, 8 + rnd() * 30, 1); }
  }
}, key);
const stoneTex = () => mk(256, 256, (c) => {
  const rnd = mulberry(33);
  c.fillStyle = '#7a6a58'; c.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 42) for (let x = (y / 42) % 2 ? 0 : 32; x < 288; x += 64) { c.fillStyle = `rgb(${138 + rnd() * 26 | 0},${124 + rnd() * 22 | 0},${106 + rnd() * 20 | 0})`; c.beginPath(); c.roundRect(x - 30, y + 2, 60, 38, 8); c.fill(); }
  for (let i = 0; i < 500; i++) { c.fillStyle = `rgba(60,40,20,${rnd() * 0.15})`; c.fillRect(rnd() * 256, rnd() * 256, 2, 2); }
}, 'harbor-stone');
const sailTex = (color: string) => mk(64, 128, (c) => {
  c.fillStyle = color; c.fillRect(0, 0, 64, 128);
  c.fillStyle = 'rgba(255,230,170,.18)'; c.fillRect(0, 0, 64, 128);
  c.strokeStyle = 'rgba(70,20,10,.6)'; c.lineWidth = 2; for (let y = 8; y < 128; y += 18) { c.beginPath(); c.moveTo(0, y); c.lineTo(64, y); c.stroke(); }
  c.strokeStyle = 'rgba(70,20,10,.4)'; c.beginPath(); c.moveTo(32, 0); c.lineTo(32, 128); c.stroke();
}, `sail${color}`);
const strataTex = () => mk(128, 256, (c) => {
  const rnd = mulberry(8);
  const gr = c.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#d8643c'); gr.addColorStop(0.5, '#b8452e'); gr.addColorStop(1, '#8a3024'); c.fillStyle = gr; c.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(${rnd() < 0.5 ? '255,200,140' : '60,20,14'},${0.1 + rnd() * 0.22})`; c.fillRect(0, rnd() * 256, 128, 2 + rnd() * 6); }
  for (let i = 0; i < 30; i++) { c.fillStyle = 'rgba(40,14,10,.25)'; c.fillRect(rnd() * 128, 0, 1 + rnd() * 3, 256); }
}, 'strata');

/** 帆船：船身（侧面轮廓挤出）+ 舱 + 桅杆 + 竹篾帆 + 灯笼；原点在水线中心，船头朝 +x */
function junk(scale = 1, sail = '#d8452c', masts = 2): THREE.Group {
  const g = new THREE.Group();
  const sh = new THREE.Shape(); sh.moveTo(-6, 1.7); sh.lineTo(-5.4, 0); sh.lineTo(5, 0); sh.lineTo(7.2, 2.2); sh.lineTo(6.6, 2.2); sh.lineTo(4.8, 1.2); sh.lineTo(-6, 1.7);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 3.0, bevelEnabled: false }); geo.translate(0, -0.4, -1.5);
  const hull = new THREE.Mesh(geo, std('#7a4a2a', 0.8)); hull.castShadow = true; g.add(hull);
  g.add(box(12, 0.2, 3.2, std('#e8b04a', 0.5, 0.3), 0, 1.4, 0));
  g.add(box(3.4, 1.6, 2.2, std('#a86a3a', 0.8), -3.6, 2.3, 0)); g.add(box(3.9, 0.2, 2.7, std('#c8352c', 0.6), -3.6, 3.2, 0));
  const mastX = masts === 3 ? [-3.4, 0.4, 3.6] : masts === 1 ? [0] : [-2.2, 2.4];
  mastX.forEach((mx, i) => {
    const h = 9 - i * 0.6;
    g.add(cyl(0.12, 0.16, h, std('#5a3a22', 0.85), mx, 1.2 + h / 2, 0, 6));
    const s = new THREE.Mesh(new THREE.PlaneGeometry(3.4, h * 0.8, 4, 1), new THREE.MeshStandardMaterial({ map: sailTex(sail), side: THREE.DoubleSide, roughness: 0.85, emissive: 0x401408, emissiveIntensity: 0.4 }));
    s.position.set(mx + 0.2, 1.6 + h * 0.5, 0.05); s.rotation.y = Math.PI / 2 - 0.15; s.name = 'sail'; g.add(s);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), new THREE.MeshBasicMaterial({ color: '#ffd24a', side: THREE.DoubleSide, toneMapped: false })); fl.position.set(mx + 0.7, 1.2 + h, 0); g.add(fl);
  });
  for (let i = 0; i < 5; i++) { const l = lantern(['#ff5a3a', '#ffb03a'][i % 2], 0.55); l.position.set(-5 + i * 2.6, 2.1, 1.7); g.add(l); const l2 = l.clone(); l2.position.z = -1.7; g.add(l2); }
  g.scale.setScalar(scale);
  return g;
}
function lighthouse(): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) g.add(cyl(1.6 - i * 0.14, 1.74 - i * 0.14, 2.2, std(i % 2 ? '#c8352c' : '#f4ece0', 0.7), 0, 1.1 + i * 2.2, 0, 14));
  g.add(cyl(2.0, 2.0, 0.3, std('#3a3a48', 0.5, 0.5), 0, 13.4, 0, 14));
  g.add(cyl(0.9, 0.9, 1.6, glowMat('#ffe9a0'), 0, 14.4, 0, 12));
  g.add(cyl(0.05, 1.3, 1.2, std('#c8352c', 0.6), 0, 15.8, 0, 12));
  return g;
}
function warehouse(w: number, d: number, tile: string, sign: string, color: string): THREE.Group {
  const g = new THREE.Group(); const h = 6.5;
  g.add(box(w, h, d, new THREE.MeshStandardMaterial({ map: plankTex('wh' + tile, '#9a6a44', false), roughness: 0.9 }), 0, h / 2, 0));
  const sh = new THREE.Shape(); sh.moveTo(-d / 2 - 0.6, 0); sh.lineTo(0, 3.2); sh.lineTo(d / 2 + 0.6, 0); sh.lineTo(-d / 2 - 0.6, 0);
  const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: w + 1.2, bevelEnabled: false }), std(tile, 0.6, 0.1)); roof.rotation.y = Math.PI / 2; roof.position.set(-(w + 1.2) / 2, h, 0); roof.castShadow = true; g.add(roof);
  g.add(box(w + 1.3, 0.3, 0.5, std('#e8b04a', 0.45, 0.4), 0, h + 3.2, 0)); // 脊
  g.add(box(4.6, 4.2, 0.2, std('#5a3a22', 0.85), 0, 2.1, d / 2 + 0.05));
  for (const x of [-1.2, 1.2]) g.add(box(0.1, 4.0, 0.12, std('#2a1a10', 0.8), x * 0.0 + x * 0.0, 2.1, d / 2 + 0.16));
  g.add(box(0.12, 4.2, 0.12, std('#2a1a10', 0.8), 0, 2.1, d / 2 + 0.16));
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.4), glowMat('#ffffff', mk(256, 72, (c) => { c.fillStyle = '#3a1a10'; c.fillRect(0, 0, 256, 72); c.strokeStyle = color; c.lineWidth = 5; c.strokeRect(4, 4, 248, 64); c.fillStyle = color; c.font = '900 48px "ZCOOL KuaiLe","Noto Sans SC",sans-serif'; c.textAlign = 'center'; c.fillText(sign, 128, 54); }, `whsign${sign}`)));
  sg.position.set(0, 5.5, d / 2 + 0.3); g.add(sg);
  for (const x of [-w * 0.36, w * 0.36]) { const l = lantern('#ff8a3a', 0.8); l.position.set(x, 4.6, d / 2 + 0.6); g.add(l); }
  return g;
}

export function buildHarbor(L: LevelDef): Street {
  const g = new THREE.Group(); const half = L.half; const A = atmosOf(L.mood); const rnd = mulberry(303);
  // ---- 海：铺到天边 ----
  const seaMat = new THREE.MeshStandardMaterial({ color: 0x2f8aa0, roughness: 0.14, metalness: 0.3, emissive: 0xc8502a, emissiveIntensity: 0.32 });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), seaMat); sea.rotation.x = -Math.PI / 2; sea.position.y = 0.1; g.add(nm(sea));
  const glint = waterGlint(); glint.repeat.set(30, 24);
  const gl = new THREE.Mesh(new THREE.PlaneGeometry(260, 200), new THREE.MeshBasicMaterial({ map: glint, color: 0xffa860, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); gl.rotation.x = -Math.PI / 2; gl.position.set(0, 0.2, -70); g.add(nm(gl));
  const glint2 = waterGlint(); glint2.repeat.set(14, 9);
  const gl2 = new THREE.Mesh(new THREE.PlaneGeometry(64, 26), new THREE.MeshBasicMaterial({ map: glint2, color: 0xffd8a0, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); gl2.rotation.x = -Math.PI / 2; gl2.position.set(0, 0.24, SEA_Z - 13); g.add(nm(gl2));
  // ---- 陆地：石板 + 沿岸一条木栈板 ----
  const landD = half - SEA_Z + 2.4, landZ = (SEA_Z + half + 2.4) / 2;
  const st = stoneTex(); st.wrapS = st.wrapT = THREE.RepeatWrapping; st.repeat.set(10, 7);
  const land = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 + 3, landD), new THREE.MeshStandardMaterial({ map: st, roughness: 0.9 })); land.rotation.x = -Math.PI / 2; land.position.set(0, 0.3, landZ); land.receiveShadow = true; g.add(nm(land));
  const wood = aiTex('ground_harbor_oldwood_01'); // Codex A09-HB 旧木栈板
  const bt: THREE.Texture = wood ?? plankTex('quay', '#a87850', false); bt.wrapS = bt.wrapT = THREE.RepeatWrapping; bt.repeat.set(wood ? 8 : 16, wood ? 1 : 1.2);
  const quay = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 + 3, 5), new THREE.MeshStandardMaterial({ map: bt, roughness: 0.9 })); quay.rotation.x = -Math.PI / 2; quay.position.set(0, 0.34, SEA_Z + 2.5); quay.receiveShadow = true; g.add(nm(quay));
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(5, landD - 6), new THREE.MeshStandardMaterial({ color: 0xc8a070, roughness: 0.95 })); lane.rotation.x = -Math.PI / 2; lane.position.set(0, 0.35, landZ + 2.5); g.add(nm(lane));
  // 三面堤岸 + 海堤
  const wallM = std('#8a7a68', 0.9);
  for (const [w, d, x, z] of [[1, landD, -half - 1.4, landZ], [1, landD, half + 1.4, landZ], [half * 2 + 4, 1, 0, half + 1.4]] as number[][]) g.add(nm(box(w, 3, d, wallM, x, -1.0, z)));
  g.add(nm(box(half * 2 + 3, 1.2, 0.9, wallM, 0, -0.1, SEA_Z + 0.2)));
  for (let x = -30; x <= 30; x += 6) { g.add(cyl(0.22, 0.28, 0.9, std('#2a2a30', 0.6, 0.5), x, 0.78, SEA_Z + 1.0, 8)); }
  // ---- 栈桥 ----
  const dt = plankTex('deck', '#b08258', true); dt.wrapS = dt.wrapT = THREE.RepeatWrapping;
  const lamps: THREE.Object3D[] = [];
  PIERS.forEach((p, pi) => {
    const len = SEA_Z - p.end, cz = (SEA_Z + p.end) / 2;
    const tex = dt.clone(); tex.repeat.set(p.w / 2.2, len / 2.2); tex.needsUpdate = true;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(p.w, 0.34, len), [std('#5a3a22', 0.9), std('#5a3a22', 0.9), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }), std('#4a2e1a', 0.9), std('#5a3a22', 0.9), std('#5a3a22', 0.9)]);
    deck.position.set(p.x, 0.62, cz); deck.castShadow = true; deck.receiveShadow = true; g.add(nm(deck));
    for (let z = SEA_Z - 1; z > p.end; z -= 3.2) for (const sx of [-1, 1]) g.add(cyl(0.2, 0.22, 3.2, std('#4a2e1a', 0.9), p.x + sx * (p.w / 2 - 0.2), -0.7, z, 6));
    for (let z = SEA_Z - 1.5; z > p.end + 0.6; z -= 3.6) for (const sx of [-1, 1]) {
      g.add(cyl(0.1, 0.1, 1.5, std('#5a3a22', 0.9), p.x + sx * (p.w / 2 - 0.15), 1.5, z, 5));
      if (Math.abs(z - (p.end + 0.6)) > 3) { const l = lantern(['#ff5a3a', '#ffb03a'][(pi + (z | 0)) & 1], 0.7); l.position.set(p.x + sx * (p.w / 2 - 0.15), 2.9, z); g.add(l); lamps.push(l); }
    }
    for (const sx of [-1, 1]) g.add(box(0.07, 0.07, len - 0.5, std('#c8a070', 0.8), p.x + sx * (p.w / 2 - 0.15), 2.0, cz));
    // 桥头灯笼门
    const gate = new THREE.Group(); for (const sx of [-1, 1]) gate.add(cyl(0.18, 0.2, 5, std('#b83228', 0.6), sx * (p.w / 2 + 0.2), 2.5, 0, 8)); gate.add(box(p.w + 1.2, 0.4, 0.5, std('#b83228', 0.6), 0, 5.1, 0)); gate.add(box(p.w + 1.6, 0.14, 0.7, std('#e8b04a', 0.4, 0.5), 0, 5.4, 0)); gate.position.set(p.x, 0.5, SEA_Z - 0.4); g.add(gate);
    // 桥上小货：木桶 / 绳卷
    for (let k = 0; k < 3; k++) { const z = SEA_Z - 4 - k * 5 - pi; if (z < p.end + 3) continue; const x = p.x + (k % 2 ? 1 : -1) * (p.w / 2 - 0.8); g.add(cyl(0.45, 0.45, 0.9, std('#8a5a32', 0.85), x, 1.25, z, 8)); g.add(cyl(0.47, 0.47, 0.08, std('#2a2a30', 0.6, 0.5), x, 1.5, z, 8)); }
  });
  // ---- 泊船：栈桥之间 ----
  const boats: { m: THREE.Group; y: number; ph: number; sails: THREE.Mesh[] }[] = [];
  const addBoat = (m: THREE.Group, x: number, z: number, ry: number) => { m.position.set(x, 0.1, z); m.rotation.y = ry; nm(m); g.add(m); boats.push({ m, y: 0.1, ph: rnd() * 6, sails: m.children.filter((c) => c.name === 'sail') as THREE.Mesh[] }); };
  addBoat(junk(0.95, '#d8452c', 2), -9.6, -16, Math.PI / 2 + 0.05);
  addBoat(junk(0.8, '#e8a23a', 1), -27, -14, Math.PI / 2 - 0.1);
  addBoat(junk(1.5, '#c0302a', 3), 9.6, -19, Math.PI / 2 - 0.04);
  addBoat(junk(0.9, '#f0d8a0', 2), 26.5, -16, Math.PI / 2 + 0.12);
  addBoat(junk(1.2, '#d8452c', 3), -14, -42, Math.PI / 2 + 0.2);
  addBoat(junk(1.1, '#e8a23a', 2), 16, -48, Math.PI / 2 - 0.15);
  addBoat(junk(0.7, '#d8452c', 1), 34, -30, Math.PI / 2 + 0.3);
  // ---- 赤壁崖：夕阳里红彤彤的远崖 ----
  const sm = new THREE.MeshStandardMaterial({ map: strataTex(), roughness: 0.95, emissive: 0x5a1a10, emissiveIntensity: 0.55 });
  for (let i = 0; i < 12; i++) {
    const x = -90 + i * 16 + (rnd() - 0.5) * 8, z = -92 - rnd() * 40, h = 24 + rnd() * 38, w = 12 + rnd() * 14;
    const c = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.34, w * 0.62, h, 6, 1), sm); c.position.set(x, h / 2 - 1, z); c.rotation.y = rnd() * 3; c.scale.set(1, 1, 0.7 + rnd() * 0.4); nm(c); g.add(c);
    const cap = new THREE.Mesh(new THREE.DodecahedronGeometry(w * 0.34, 0), std('#6a9a4a', 0.9)); cap.position.set(x, h - 1, z); cap.scale.y = 0.45; nm(cap); g.add(cap);
  }
  // ---- 灯塔 / 仓库 / 酒肆 / 茶楼 ----
  const lh = lighthouse(); lh.position.set(LIGHTHOUSE[0], 0.3, LIGHTHOUSE[1]); g.add(lh);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(2.6, 30, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  beam.userData.noBake = true; beam.userData.noMirror = true; beam.geometry.translate(0, -15, 0); beam.rotation.z = Math.PI / 2; const beamPivot = new THREE.Group(); beamPivot.position.set(LIGHTHOUSE[0], 14.7, LIGHTHOUSE[1]); beamPivot.add(beam); g.add(beamPivot);
  WAREHOUSES.forEach((w, i) => { const wh = warehouse(w.w, w.d, i ? '#7a4a8a' : '#2f7a7a', i ? '海货栈' : '军粮仓', i ? '#ffd070' : '#ffb04a'); wh.position.set(w.x, 0.3, w.z); wh.rotation.y = Math.PI; g.add(wh); shadowBlob(g, w.x - 6, w.z - 4, 12, 8, 0.2); });
  const tv = hall(TAVERN.w, TAVERN.d, 1, { wall: '#f0d8b8', tile: '#c8352c', sign: { text: '赤壁酒肆', color: '#ffd070' }, lanterns: '#ff5a3a', floorH: 4.6 }); tv.position.set(TAVERN.x, 0.3, TAVERN.z); tv.rotation.y = Math.PI / 2 * 0 + Math.PI / 2 * 0; g.add(tv);
  const th = hall(TEAHOUSE.w, TEAHOUSE.d, 1, { wall: '#e8e4c8', tile: '#2f6a9a', sign: { text: '听涛茶楼', color: '#7ff0ff' }, lanterns: '#ffb03a', floorH: 4.6 }); th.position.set(TEAHOUSE.x, 0.3, TEAHOUSE.z); g.add(th);
  // ---- 货堆 / 木桶 / 渔网架 / 鱼干架 ----
  for (const [cx, cz] of CRATES) {
    for (let i = 0; i < 6; i++) { const c = box(1.1 + rnd() * 0.5, 1.0, 1.1 + rnd() * 0.4, std(['#a87850', '#8a6038', '#c89868'][i % 3], 0.85), cx + (i % 3 - 1) * 1.2, 0.8 + (i > 3 ? 1.0 : 0), cz + ((i / 3) | 0 ? 0.6 : -0.5)); c.rotation.y = rnd() * 0.3; g.add(c); }
    g.add(cyl(0.55, 0.55, 1.1, std('#8a5a32', 0.85), cx + 1.6, 0.85, cz + 1.4, 8)); g.add(cyl(0.58, 0.58, 0.08, std('#2a2a30', 0.6, 0.5), cx + 1.6, 1.4, cz + 1.4, 8));
  }
  for (const [x, z] of [[-6, 22], [6, 22], [-5, 8], [5, 8]]) { // 鱼干架
    for (const sx of [-1, 1]) g.add(cyl(0.08, 0.08, 3, std('#6a4a2a', 0.9), x + sx * 1.6, 1.8, z, 5));
    g.add(box(3.4, 0.08, 0.08, std('#6a4a2a', 0.9), x, 3.2, z));
    for (let i = 0; i < 8; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 4), std('#d8e0e8', 0.5, 0.3)); f.scale.set(0.5, 1.6, 0.4); f.position.set(x - 1.4 + i * 0.4, 2.7, z); g.add(f); }
  }
  for (const x of [-15, 15]) { // 码头木吊
    g.add(cyl(0.3, 0.4, 7, std('#6a4a2a', 0.9), x, 3.8, SEA_Z + 1.5, 7)); const boom = box(0.25, 0.25, 6.5, std('#6a4a2a', 0.9), x, 7.2, SEA_Z - 1.2); boom.rotation.x = 0.12; g.add(boom);
    g.add(cyl(0.02, 0.02, 3.6, std('#c8b890', 0.9), x, 5.4, SEA_Z - 4.3, 4)); g.add(box(0.5, 0.35, 0.5, std('#3a3a40', 0.5, 0.5), x, 3.5, SEA_Z - 4.3));
  }
  // 沿路的灯笼柱
  for (const sx of [-1, 1]) for (let z = 4; z <= 28; z += 6) { g.add(cyl(0.1, 0.12, 4.2, std('#5a3a22', 0.9), sx * 4.2, 2.4, z, 5)); const l = lantern('#ff7a3a', 0.8); l.position.set(sx * 4.2, 4.7, z); g.add(l); }
  // 海鸥
  const gulls: { m: THREE.Mesh; r: number; sp: number; ph: number; cx: number; cz: number; y: number }[] = [];
  for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.5), new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide, toneMapped: false })); m.userData.noBake = true; m.userData.noMirror = true; g.add(m); gulls.push({ m, r: 5 + rnd() * 9, sp: 0.3 + rnd() * 0.3, ph: rnd() * 6, cx: -16 + rnd() * 32, cz: -16 - rnd() * 14, y: 9 + rnd() * 6 }); }
  for (const [x, z, c, s] of L.glows) { const h = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ map: glowTex(), color: c, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); h.rotation.x = -Math.PI / 2; h.position.set(x, 0.5, z); g.add(nm(h)); }
  for (const [x, y, z, c, i, r] of L.lights) { const l = new THREE.PointLight(c, i * 0.3, r, 1.6); l.position.set(x, y, z); g.add(l); }
  const steam = buildSteam(L.vents, 0xfff0e0);
  void A; void eaveRoof;
  return finishTheme(L, g, {
    extra: [steam.group],
    update: (t, dt) => {
      steam.update(dt);
      glint.offset.x = t * 0.012; glint.offset.y = t * 0.03; glint2.offset.x = -t * 0.02; glint2.offset.y = t * 0.04;
      for (const b of boats) { b.m.position.y = b.y + Math.sin(t * 1.1 + b.ph) * 0.09; b.m.rotation.z = Math.sin(t * 0.9 + b.ph) * 0.025; for (const s of b.sails) s.rotation.y = Math.PI / 2 - 0.15 + Math.sin(t * 0.8 + b.ph) * 0.05; }
      beamPivot.rotation.y = t * 0.8;
      for (const gu of gulls) { const a = t * gu.sp + gu.ph; gu.m.position.set(gu.cx + Math.cos(a) * gu.r, gu.y + Math.sin(a * 2) * 0.6, gu.cz + Math.sin(a) * gu.r * 0.6); gu.m.rotation.set(-Math.PI / 2 + Math.sin(t * 8 + gu.ph) * 0.5, 0, a + Math.PI / 2); }
      for (const l of lamps) l.scale.setScalar(1 + Math.sin(t * 3 + l.position.z) * 0.03);
    },
  });
}
