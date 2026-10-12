// 樱汤乡（附加场景，春天的傍晚）：樱花开满整片坡地，花瓣一直在飘；北边锦鲤池上架着红拱桥，水里锦鲤慢慢游；
// 西侧石头围起来的露天温泉冒着热气，东侧一间挂着暖帘的寿司小铺，南边入口红鸟居，石灯笼沿石板路亮着。
import * as THREE from 'three';
import { mulberry } from '../../fx/util';
import { atmosOf } from '../atmos';
import { glowMat, lanternString, std, stoneLantern } from '../kit';
import { aiTex, mk, waterGlint } from '../tex';
import type { LevelDef } from '../levels';
import type { Street } from '../street';
import { BAMBOO, ONSEN, POND, SAKURA, SHOP, SKIP_POI, STONE_LANTERNS, TORII, TORII_SPAN } from './onsen.data';
import { hall } from './arch';
import { finishTheme, groundPlane, motes, nm, pathTex, plinth, ribbon, shadowBlob } from './common';

const box = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; };
const cyl = (r0: number, r1: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 8) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat); m.position.set(x, y, z); m.castShadow = true; return m; };

const grassFallback = () => mk(256, 256, (c) => {
  const rnd = mulberry(52);
  c.fillStyle = '#8ab86a'; c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) { c.fillStyle = rnd() < 0.15 ? 'rgba(255,190,215,0.7)' : rnd() < 0.5 ? 'rgba(170,210,120,0.5)' : 'rgba(90,140,70,0.4)'; c.fillRect(rnd() * 256, rnd() * 256, 2, 2); }
}, 'onsen-grass');
/** 一团热气：柔边白色圆，做成 Sprite 往上飘 */
const steamTex = () => mk(64, 64, (c) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); }, 'onsen-steam');

/** 樱花树：歪一点的树干 + 几根枝 + 一团团粉色花簇 */
export function sakuraTree(sc: number, seed: number): THREE.Group {
  const g = new THREE.Group(), rnd = mulberry(seed);
  const bark = std('#5a3a32', 0.9);
  const trunk = cyl(0.28, 0.45, 3.4, bark, 0, 1.7, 0, 7); trunk.rotation.z = (rnd() - 0.5) * 0.2; g.add(trunk);
  const pinks = ['#ffb8d0', '#ffc8dc', '#ffa8c4', '#fff0f4'].map((c) => std(c, 0.85));
  for (let i = 0; i < 4; i++) {
    const a = i * 1.57 + rnd(), br = cyl(0.08, 0.16, 2.4, bark, Math.cos(a) * 0.7, 3.8, Math.sin(a) * 0.7, 5); br.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); g.add(br);
  }
  for (let i = 0; i < 9; i++) {
    const a = rnd() * 6.28, r = rnd() * 2.0, m = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0 + rnd() * 0.7, 1), pinks[i % pinks.length]);
    m.position.set(Math.cos(a) * r, 4.4 + rnd() * 1.6, Math.sin(a) * r); m.scale.y = 0.75; m.castShadow = true; g.add(m);
  }
  g.scale.setScalar(sc);
  return g;
}

export function buildOnsen(L: LevelDef): Street {
  const g = new THREE.Group(); const half = L.half; const A = atmosOf(L.mood); const rnd = mulberry(904);
  plinth(g, half, '#7a9a5a', undefined, A.fog);
  const grass = aiTex('ground_forest_grass_light_03') ?? aiTex('cc0_grass_005');
  groundPlane(g, half, grass ?? grassFallback(), grass ? 7 : 9, { color: grass ? 0xf4ffe8 : 0xffffff, rough: 0.95 });
  // 地上落的一层樱花瓣（几块淡粉色的圆斑）
  for (let i = 0; i < 14; i++) { const [x, z] = SAKURA[i % SAKURA.length]; const m = new THREE.Mesh(new THREE.CircleGeometry(2.6 + rnd() * 1.2, 20), new THREE.MeshStandardMaterial({ color: '#ff9ec0', roughness: 0.95, transparent: true, opacity: 0.5, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(x + (rnd() - 0.5) * 2, 0.33, z + (rnd() - 0.5) * 2); g.add(nm(m)); }
  // 石板路：鸟居 → 池边，岔向寿司铺和温泉
  const stone = pathTex('onsen-path', '#c8c0b0', ['#a89e8e', '#e0d8c8', '#8a8478'], 0.18);
  ribbon(g, [[0, 31], [0, 19], [0, 8], [0, -2], [-3, -9], [-7, -12]], 3.2, stone);
  ribbon(g, [[0, -2], [4, -9], [7, -12]], 2.6, stone);
  ribbon(g, [[0, 8], [8, 6], [15, 4], [20, 4]], 2.6, stone);
  ribbon(g, [[0, 10], [-8, 9], [-15, 7]], 2.6, stone);

  // ---- 锦鲤池 ----
  const [px0, pz0, px1, pz1] = POND, pw = px1 - px0, pd = pz1 - pz0, pcx = (px0 + px1) / 2, pcz = (pz0 + pz1) / 2;
  const water = new THREE.Mesh(new THREE.PlaneGeometry(pw + 30, pd + 12), new THREE.MeshStandardMaterial({ color: 0x3aa8b8, roughness: 0.08, metalness: 0.2, emissive: 0x0a3a48, emissiveIntensity: 0.35, transparent: true, opacity: 0.95 }));
  water.rotation.x = -Math.PI / 2; water.position.set(pcx, 0.42, pcz - 6); g.add(nm(water));
  const glint = waterGlint(); glint.repeat.set(5, 3);
  const gl = new THREE.Mesh(new THREE.PlaneGeometry(pw + 30, pd + 12), new THREE.MeshBasicMaterial({ map: glint, color: 0xffd8c0, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  gl.rotation.x = -Math.PI / 2; gl.position.set(pcx, 0.46, pcz - 6); g.add(nm(gl));
  // 岸边的石头
  for (let x = px0 - 1; x <= px1 + 1; x += 1.6) { const r = 0.5 + rnd() * 0.4; const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), std(rnd() < 0.5 ? '#9a9488' : '#7a766c', 0.95)); m.position.set(x, 0.4, pz1 - 0.2 + (rnd() - 0.5) * 0.5); m.scale.y = 0.6; m.castShadow = true; g.add(m); }
  for (const sx of [px0, px1]) for (let z = pz1; z > pz0 + 4; z -= 1.8) { const r = 0.5 + rnd() * 0.4; const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), std('#8a8478', 0.95)); m.position.set(sx + (sx < 0 ? -0.2 : 0.2), 0.4, z); m.scale.y = 0.6; g.add(m); }
  // 睡莲
  for (let i = 0; i < 16; i++) { const lp = new THREE.Mesh(new THREE.CircleGeometry(0.5 + rnd() * 0.3, 12, 0.3, Math.PI * 1.85), std('#5aa84a', 0.8)); lp.rotation.x = -Math.PI / 2; lp.rotation.z = rnd() * 6; lp.position.set(px0 + 2 + rnd() * (pw - 4), 0.48, pz1 - 2 - rnd() * 9); g.add(nm(lp)); if (i % 3 === 0) { const fl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 0), std('#ffc0e0', 0.6)); fl.position.set(lp.position.x, 0.6, lp.position.z); g.add(nm(fl)); } }
  // 锦鲤（会游）
  const koi: { m: THREE.Group; tail: THREE.Mesh; r: number; cx: number; cz: number; sp: number; ph: number }[] = [];
  ['#ff7a3a', '#ffffff', '#ffd24a', '#ff5a3a', '#f4f0e8'].forEach((col, i) => {
    const k = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), std(col, 0.5)); body.scale.set(1, 0.4, 2.2); k.add(body);
    if (i % 2) { const spot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 4), std('#ff4a2a', 0.5)); spot.position.set(0, 0.08, 0.15); spot.scale.set(1, 0.4, 1.4); k.add(spot); }
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.4, 4), std(col, 0.5)); tail.rotation.x = -Math.PI / 2; tail.position.z = -0.8; tail.scale.y = 0.4; k.add(tail);
    k.position.y = 0.38; k.userData.noBake = true; nm(k); g.add(k);
    koi.push({ m: k, tail, r: 2.5 + i * 0.9, cx: pcx - 4 + i * 2, cz: pz1 - 6 - (i % 2) * 2, sp: 0.25 + i * 0.05, ph: i * 1.7 });
  });
  // 红拱桥（池子正中，装饰）
  const bridge = new THREE.Group(); bridge.position.set(pcx + 2, 0.4, pcz + 2);
  const red = std('#d8402c', 0.6), wood = std('#a87a4a', 0.85);
  for (let i = 0; i <= 12; i++) { const u = i / 12 - 0.5, y = Math.cos(u * Math.PI) * 1.6; bridge.add(box(0.85, 0.15, 3.0, wood, u * 11, y, 0)); if (i % 2 === 0) for (const s of [-1, 1]) bridge.add(cyl(0.07, 0.07, 1.0, red, u * 11, y + 0.5, s * 1.45, 5)); }
  for (const s of [-1, 1]) { const rail = new THREE.Mesh(new THREE.TorusGeometry(5.9, 0.08, 4, 24, Math.PI * 0.62), red); rail.position.set(0, -3.65, s * 1.45); rail.rotation.z = Math.PI * 0.19; bridge.add(rail); }
  bridge.rotation.y = Math.PI / 2; g.add(nm(bridge));
  // 打水漂的地方：一小堆扁石片
  for (let i = 0; i < 7; i++) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.08, 8), std('#8a8a92', 0.7)); st.position.set(SKIP_POI[0] - 2.4 + (i % 3) * 0.25, 0.36 + Math.floor(i / 3) * 0.08, SKIP_POI[1] + 1.6 + (i % 2) * 0.2); st.scale.z = 0.8; g.add(st); }

  // ---- 露天温泉 ----
  const [ox, oz, or] = ONSEN;
  for (let i = 0; i < 22; i++) { const a = (i / 22) * Math.PI * 2, r = 0.7 + rnd() * 0.5; const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), std(i % 3 ? '#8a8478' : '#6a665e', 0.95)); m.position.set(ox + Math.cos(a) * or * 0.95, 0.5, oz + Math.sin(a) * or * 0.95); m.scale.y = 0.7; m.castShadow = true; g.add(m); }
  const spring = new THREE.Mesh(new THREE.CircleGeometry(or * 0.88, 32), new THREE.MeshStandardMaterial({ color: 0x8ae0d8, roughness: 0.05, metalness: 0.1, emissive: 0x3a8a88, emissiveIntensity: 0.5 })); spring.rotation.x = -Math.PI / 2; spring.position.set(ox, 0.62, oz); g.add(nm(spring));
  // 竹筒引水 + 木桶 + 小木牌
  const pipe = cyl(0.12, 0.12, 3.2, std('#7aa84a', 0.6), ox + or + 0.5, 1.6, oz - 1, 6); pipe.rotation.z = Math.PI / 2.4; g.add(pipe);
  for (let i = 0; i < 3; i++) g.add(cyl(0.35, 0.3, 0.5, std('#c89a5a', 0.8), ox - or - 1.2 + i * 0.8, 0.55, oz + or + 0.6, 10));
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), glowMat('#ffffff', mk(128, 64, (c) => { c.fillStyle = '#f4e8d0'; c.fillRect(0, 0, 128, 64); c.fillStyle = '#c83a2a'; c.font = '900 40px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('♨ 汤', 64, 34); }, 'onsen-sign')));
  sign.position.set(ox + 3, 1.6, oz + or + 0.9); g.add(sign); g.add(cyl(0.06, 0.06, 1.2, std('#6a4a2a', 0.8), ox + 3, 0.7, oz + or + 0.85, 5));
  const steam: THREE.Sprite[] = [];
  const stMat = new THREE.SpriteMaterial({ map: steamTex(), color: 0xfff4ec, transparent: true, opacity: 0.5, depthWrite: false });
  for (let i = 0; i < 14; i++) { const s = new THREE.Sprite(stMat.clone()); s.userData = { x: ox + (rnd() - 0.5) * or * 1.4, z: oz + (rnd() - 0.5) * or * 1.4, ph: rnd(), noBake: true }; nm(s); steam.push(s); g.add(s); }

  // ---- 寿司小铺 ----
  const [hx, hz, hw, hd] = SHOP;
  const shop = hall(hw, hd, 1, { wall: '#f4e8d0', tile: '#3a4a6a', pillar: '#6a4a2a', sign: { text: '喵 鮨', color: '#ff6a5a' }, lanterns: '#ff5a3a' });
  shop.position.set(hx, 0.3, hz); g.add(shop);
  // 门口的暖帘
  for (let i = 0; i < 4; i++) { const n = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.4), std(i % 2 ? '#2a4a8a' : '#24407a', 0.9)); n.position.set(hx - 1.6 + i * 1.06, 3.4, hz + hd / 2 + 0.5); g.add(n); }
  g.add(box(2.2, 0.9, 0.8, std('#8a5a32', 0.8), hx + 3.4, 0.75, hz + hd / 2 + 1.6)); // 门外小桌
  for (const s of [-1, 1]) g.add(cyl(0.3, 0.3, 0.5, std('#c89a5a', 0.8), hx + 3.4 + s * 1.5, 0.55, hz + hd / 2 + 1.6, 10));

  // ---- 鸟居 ----
  const [tx, tz] = TORII, tred = std('#e0402c', 0.55), tblack = std('#2a2a2a', 0.6);
  for (const s of [-1, 1]) { g.add(cyl(0.32, 0.38, 6.2, tred, tx + s * TORII_SPAN / 2, 3.4, tz, 10)); g.add(cyl(0.45, 0.45, 0.5, tblack, tx + s * TORII_SPAN / 2, 0.55, tz, 10)); }
  g.add(box(TORII_SPAN + 1.2, 0.4, 0.5, tred, tx, 5.4, tz));
  const top = box(TORII_SPAN + 2.6, 0.5, 0.7, tblack, tx, 6.6, tz); g.add(top);
  g.add(box(TORII_SPAN + 2.2, 0.3, 0.6, tred, tx, 6.25, tz));
  g.add(box(0.5, 1.2, 0.4, tblack, tx, 5.9, tz));

  // ---- 石灯笼 / 樱花树 / 竹子 / 灯笼串 ----
  for (const [x, z] of STONE_LANTERNS) { const l = stoneLantern(); l.position.set(x, 0.32, z); g.add(l); }
  SAKURA.forEach(([x, z, sc], i) => { const t = sakuraTree(sc, i + 61); t.position.set(x, 0.3, z); t.rotation.y = i * 1.1; g.add(t); shadowBlob(g, x - 1.2, z + 1.0, 3.6 * sc, 3.0 * sc, 0.26, 0.36); });
  for (const [x, z] of BAMBOO) for (let i = 0; i < 7; i++) { const h = 5 + rnd() * 3, b = cyl(0.09, 0.11, h, std('#6aa84a', 0.6), x + (rnd() - 0.5) * 2, h / 2 + 0.3, z + (rnd() - 0.5) * 2, 6); g.add(b); for (let k = 0; k < 3; k++) { const lf = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.4, 3), std('#7ac85a', 0.7)); lf.position.set(b.position.x + (rnd() - 0.5) * 0.8, h - k * 0.8, b.position.z + (rnd() - 0.5) * 0.8); lf.rotation.z = (rnd() - 0.5) * 2; lf.scale.z = 0.2; g.add(lf); } }
  g.add(lanternString(new THREE.Vector3(-TORII_SPAN / 2, 5.0, TORII[1]), new THREE.Vector3(-3.5, 3.0, 12), '#ff8a5a', 5));
  g.add(lanternString(new THREE.Vector3(TORII_SPAN / 2, 5.0, TORII[1]), new THREE.Vector3(3.5, 3.0, 12), '#ff8a5a', 5));
  g.add(lanternString(new THREE.Vector3(hx - hw / 2, 4.2, hz + hd / 2 + 1), new THREE.Vector3(15, 3.0, 8), '#ffd24a', 5));

  for (const [x, y, z, c, i, r] of L.lights) { const l = new THREE.PointLight(c, i * 0.25, r, 1.6); l.position.set(x, y, z); g.add(l); }

  // 飘落的樱花瓣：粉色的光点，慢慢往下落
  const petals = motes(g, { n: 90, half: 30, color: '#ffb8d0', size: 0.35, seed: 41, h: [0.5, 9], speed: 0.7 });
  const S = finishTheme(L, g, {
    update: (t) => {
      petals(t);
      glint.offset.x = t * 0.01; glint.offset.y = t * 0.02;
      for (const k of koi) { const a = t * k.sp + k.ph; k.m.position.x = k.cx + Math.cos(a) * k.r; k.m.position.z = k.cz + Math.sin(a) * k.r * 0.5; k.m.rotation.y = -a + Math.PI; k.tail.rotation.y = Math.sin(t * 6 + k.ph) * 0.4; }
      for (const s of steam) { const u = s.userData as { x: number; z: number; ph: number }; const p = (t * 0.25 + u.ph) % 1; s.position.set(u.x + Math.sin(t + u.ph * 6) * 0.4, 0.8 + p * 4, u.z); const sc = 1.2 + p * 2.6; s.scale.set(sc, sc, 1); (s.material as THREE.SpriteMaterial).opacity = 0.45 * Math.sin(p * Math.PI); }
    },
  });
  return S;
}
