// 霓虹夜市（黄昏）：夕阳把天边烧成橘粉色，一条南北向的主街两侧排满了条纹篷摊位，摊位后是两层的木楼，
// 头顶横跨着一串串红灯笼；中间是招财猫凉亭广场，北头是挂着大红鼓和长龙灯的戏台。蒸汽、纸伞、桌凳、旗幡，暖得像刚收工的庙会。
import * as THREE from 'three';
import { mulberry } from '../../fx/util';
import { atmosOf } from '../atmos';
import { lanternString, manekiNeko, stall, std } from '../kit';
import { buildSteam } from '../steam';
import { aiTex, glowTex, mk } from '../tex';
import type { LevelDef } from '../levels';
import type { Street } from '../street';
import { banner, eaveRoof, hall, lantern, paifang, pagoda, redPillar } from './arch';
import { MARKET_PLAZA, MARKET_SHOP, MARKET_SHOP_X, MARKET_SHOP_Z, MARKET_STAGE, MARKET_STALL_X, MARKET_STALL_Z, MARKET_WALL_X } from './market.data';
import { finishTheme, groundPlane, nm, plinth, shadowBlob } from './common';

const box = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; };
const cyl = (r0: number, r1: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 10) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat); m.position.set(x, y, z); m.castShadow = true; return m; };

const brickTex = () => mk(256, 256, (c) => {
  const rnd = mulberry(21);
  c.fillStyle = '#c8956a'; c.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 32) for (let x = (y / 32) % 2 ? 0 : 32; x < 256 + 64; x += 64) { c.fillStyle = `rgb(${196 + rnd() * 24 | 0},${140 + rnd() * 24 | 0},${100 + rnd() * 20 | 0})`; c.fillRect(x - 30, y + 1, 60, 30); }
  c.strokeStyle = 'rgba(90,50,30,.45)'; c.lineWidth = 2; for (let y = 0; y <= 256; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(256, y); c.stroke(); }
  for (let i = 0; i < 400; i++) { c.fillStyle = `rgba(80,40,20,${rnd() * 0.18})`; c.fillRect(rnd() * 256, rnd() * 256, 2, 2); }
}, 'market-brick');
const plazaTex = () => mk(256, 256, (c) => {
  c.fillStyle = '#e8d4b0'; c.fillRect(0, 0, 256, 256);
  c.strokeStyle = '#b8603a'; c.lineWidth = 6; for (const r of [120, 96, 66, 34]) { c.beginPath(); c.arc(128, 128, r, 0, 7); c.stroke(); }
  c.fillStyle = '#d8403a'; for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283; c.beginPath(); c.arc(128 + Math.cos(a) * 80, 128 + Math.sin(a) * 80, 10, 0, 7); c.fill(); }
  c.fillStyle = '#b8603a'; c.beginPath(); c.arc(128, 128, 22, 0, 7); c.fill();
}, 'market-plaza');

export function buildMarket(L: LevelDef): Street {
  const g = new THREE.Group(); const half = L.half; const A = atmosOf(L.mood); const rnd = mulberry(202);
  plinth(g, half, '#6a3a2a', undefined, A.fog);
  const ai = aiTex('ground_market_terracotta_01'); // Codex A09-NM 暖色陶砖；加载不到时退回程序化砖地
  groundPlane(g, half, ai ?? brickTex(), ai ? 7 : 10, { rough: 0.85 });
  // 主街中线的红色地毯 / 广场圆盘
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(4.2, half * 2), new THREE.MeshStandardMaterial({ color: 0xc8483a, roughness: 0.9 })); lane.rotation.x = -Math.PI / 2; lane.position.set(0, 0.33, 0); lane.receiveShadow = true; g.add(nm(lane));
  const laneEdge = new THREE.Mesh(new THREE.PlaneGeometry(4.8, half * 2), new THREE.MeshStandardMaterial({ color: 0xe8b04a, roughness: 0.8 })); laneEdge.rotation.x = -Math.PI / 2; laneEdge.position.set(0, 0.32, 0); g.add(nm(laneEdge));
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(MARKET_PLAZA.r, 40), new THREE.MeshStandardMaterial({ map: plazaTex(), roughness: 0.8 })); plaza.rotation.x = -Math.PI / 2; plaza.position.set(MARKET_PLAZA.x, 0.36, MARKET_PLAZA.z); plaza.receiveShadow = true; g.add(nm(plaza));

  // ---- 摊位 ----
  let k = 0;
  for (const side of [-1, 1]) for (const z of MARKET_STALL_Z) {
    const st = stall(k++); st.position.set(side * MARKET_STALL_X, 0.32, z); st.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2; st.scale.setScalar(1.12); g.add(st);
    // 摊前的桌凳 + 纸伞
    const tb = cyl(0.55, 0.55, 0.08, std('#a8703a', 0.8), side * (MARKET_STALL_X - 3.1), 0.95, z + 0.4, 8); g.add(tb); g.add(cyl(0.08, 0.08, 0.6, std('#6a4a30', 0.8), side * (MARKET_STALL_X - 3.1), 0.6, z + 0.4, 5));
    for (const dz of [-0.9, 1.0]) g.add(cyl(0.22, 0.22, 0.4, std('#c85a3a', 0.8), side * (MARKET_STALL_X - 3.1), 0.55, z + dz, 7));
    if (k % 2) { const um = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.7, 10), std(['#ff7a8a', '#ffcf5a', '#7ac8e8', '#a8e07a'][k % 4], 0.8)); um.position.set(side * (MARKET_STALL_X - 3.1), 2.6, z + 0.4); g.add(um); g.add(cyl(0.04, 0.04, 2.2, std('#6a4a30', 0.8), side * (MARKET_STALL_X - 3.1), 1.5, z + 0.4, 4)); }
  }
  // ---- 两层木楼 ----
  const tiles = ['#2f7a7a', '#3a6a9a', '#7a4a8a', '#2f8a5a'];
  let si = 0;
  for (const side of [-1, 1]) for (const z of MARKET_SHOP_Z) {
    const h = hall(MARKET_SHOP.w, MARKET_SHOP.d, 1, { wall: ['#f0e0c0', '#f4d8c0', '#e8e4c8'][si % 3], tile: tiles[si % 4], sign: { text: ['茶', '酒', '糖', '鱼', '面', '药', '布', '玉'][si % 8], color: ['#ff9a4a', '#ffd070', '#ff7ad9', '#7ff0ff'][si % 4] }, lanterns: '#ff5a3a', floorH: 4.8 });
    h.position.set(side * MARKET_SHOP_X, 0.32, z); h.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2; g.add(h);
    shadowBlob(g, side * (MARKET_SHOP_X - 5.5), z, 3.2, 6.2, 0.22);
    si++;
  }
  // ---- 招财猫凉亭广场 ----
  const wood = std('#8a3a2a', 0.7);
  g.add(box(5.2, 0.5, 5.2, std('#e8dcc4', 0.8), 0, 0.57, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const p = redPillar(4.6, 0.26); p.position.set(sx * 2.2, 0.82, sz * 2.2); g.add(p); }
  const roof = eaveRoof(6.4, 6.4, 2.6, '#c8352c'); roof.position.y = 5.7; g.add(roof);
  g.add(box(5.0, 0.3, 5.0, wood, 0, 5.5, 0));
  const mk2 = manekiNeko(1.7); mk2.position.set(0, 0.82, 0); g.add(mk2);
  for (let i = 0; i < 4; i++) { const l = lantern(['#ff5a3a', '#ffb03a'][i % 2], 0.9); l.position.set(Math.cos(i * 1.571 + 0.785) * 2.9, 4.9, Math.sin(i * 1.571 + 0.785) * 2.9); g.add(l); }
  // ---- 头顶灯笼串 + 彩旗 ----
  for (let z = -26; z <= 26; z += 6.5) { if (Math.abs(z) < 5) continue; g.add(lanternString(new THREE.Vector3(-MARKET_STALL_X - 0.6, 7.6, z), new THREE.Vector3(MARKET_STALL_X + 0.6, 7.6, z), ['#ff4a3a', '#ffb03a', '#ff7a8a'][Math.abs(Math.round(z)) % 3], 9)); }
  for (const side of [-1, 1]) for (let z = -27; z <= 27; z += 9) { const p = cyl(0.1, 0.1, 7.6, std('#6a3a2a', 0.8), side * (MARKET_STALL_X + 0.6), 3.9, z, 5); g.add(p); }
  const flags: THREE.Mesh[] = [];
  for (const side of [-1, 1]) for (let i = 0; i < 6; i++) { const f = banner(['#d9483b', '#e8a23a', '#d94a8a'][i % 3], ['喵', '鱼', '福', '夜', '市', '香'][i], 5.4); f.position.set(side * (MARKET_STALL_X + 3.2), 0.32, -24 + i * 9.6); g.add(f); const cl = f.getObjectByName('cloth'); if (cl) flags.push(cl as THREE.Mesh); }
  // ---- 南牌楼 / 北戏台 ----
  const gate = paifang('夜市', '#ffd070', 10, 7.8); gate.position.set(0, 0.32, 29); g.add(gate);
  const stage = new THREE.Group();
  stage.add(box(MARKET_STAGE.w, 1.3, MARKET_STAGE.d, std('#7a3a2a', 0.8), 0, 0.65, 0));
  stage.add(box(MARKET_STAGE.w + 0.6, 0.2, MARKET_STAGE.d + 0.6, std('#e8b04a', 0.4, 0.5), 0, 1.35, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const p = redPillar(6.4, 0.34); p.position.set(sx * MARKET_STAGE.w * 0.42, 1.3, sz * (MARKET_STAGE.d / 2 - 0.6)); stage.add(p); }
  const sroof = eaveRoof(MARKET_STAGE.w + 1.4, MARKET_STAGE.d + 2, 4.2, '#c8352c'); sroof.position.y = 8.1; stage.add(sroof);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(MARKET_STAGE.w * 0.8, 5), new THREE.MeshStandardMaterial({ map: mk(256, 64, (c) => { const gr = c.createLinearGradient(0, 0, 256, 0); gr.addColorStop(0, '#b8302a'); gr.addColorStop(0.5, '#e8603a'); gr.addColorStop(1, '#b8302a'); c.fillStyle = gr; c.fillRect(0, 0, 256, 64); c.fillStyle = '#ffe9a0'; c.font = '900 44px "ZCOOL KuaiLe","Noto Sans SC",sans-serif'; c.textAlign = 'center'; c.fillText('喵 洲 夜 市 大 庙 会', 128, 46); }, 'market-back'), roughness: 0.9 }));
  back.position.set(0, 4.2, -MARKET_STAGE.d / 2 + 0.2); stage.add(back);
  for (const sx of [-1, 1]) { const drum = cyl(1.0, 1.0, 1.4, std('#b83228', 0.6), sx * 4.6, 2.4, 0.4, 14); drum.rotation.z = 0; stage.add(drum); stage.add(cyl(1.04, 1.04, 0.14, std('#e8b04a', 0.4, 0.5), sx * 4.6, 3.12, 0.4, 14)); stage.add(cyl(1.04, 1.04, 0.14, std('#e8b04a', 0.4, 0.5), sx * 4.6, 1.7, 0.4, 14)); }
  for (let i = 0; i < 12; i++) { const l = lantern(['#ff5a3a', '#ffcf3a', '#ff7a8a'][i % 3], 0.75); l.position.set(-8 + i * 1.45, 5.1 + Math.sin(i * 0.9) * 0.4, MARKET_STAGE.d / 2 + 0.7); stage.add(l); }
  stage.position.set(0, 0.32, MARKET_STAGE.z); g.add(stage);

  // ---- 外圈：围墙里露出一片片屋顶 + 宝塔，看起来是座大城 ----
  for (let i = 0; i < 26; i++) {
    const side = i % 2 ? 1 : -1, z = -36 + (i >> 1) * 5.8 + rnd() * 2;
    const h = hall(7 + rnd() * 4, 6 + rnd() * 3, 1 + (i % 3 === 0 ? 1 : 0), { wall: '#e8d4b0', tile: tiles[i % 4], floorH: 4.4 });
    h.position.set(side * (MARKET_WALL_X + 7 + rnd() * 5), 0.2, z); h.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2; nm(h); g.add(h);
  }
  for (const [x, z, n] of [[-44, -26, 7], [46, -8, 5], [-42, 20, 5]] as [number, number, number][]) { const p = pagoda(n, 5.6, '#2f7a7a'); p.position.set(x, 0, z); p.scale.setScalar(1.3); nm(p); g.add(p); }
  for (const sx of [-1, 1]) { g.add(box(2.2, 4.4, 66, std('#e8d4b0', 0.9), sx * (MARKET_WALL_X + 1.0), 2.2, 0)); g.add(box(2.8, 0.6, 66, std('#3a8a8a', 0.55, 0.15), sx * (MARKET_WALL_X + 1.0), 4.7, 0)); }

  // ---- 灯光 / 蒸汽 ----
  for (const [x, z, c, s] of L.glows) { const h = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ map: glowTex(), color: c, transparent: true, opacity: 0.33, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); h.rotation.x = -Math.PI / 2; h.position.set(x, 0.46, z); g.add(nm(h)); }
  for (const [x, y, z, c, i, r] of L.lights) { const l = new THREE.PointLight(c, i * 0.28, r, 1.6); l.position.set(x, y, z); g.add(l); }
  const steam = buildSteam(L.vents, 0xfff0e0);
  return finishTheme(L, g, {
    extra: [steam.group],
    update: (t, dt) => { steam.update(dt); flags.forEach((f, i) => { f.rotation.y = Math.sin(t * 2 + i) * 0.25; f.position.x = 0.85 + Math.sin(t * 2 + i) * 0.05; }); },
  });
}
