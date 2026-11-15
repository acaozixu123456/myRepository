// 画面：浮岛、植物、动物和昼夜光照。只读状态，不改状态。
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { R, POND, LANTERN, DEAD_TREES, ROCKS, SPECIES, edgeR, inIsland, pondDist, maturity, vitality, HOUR } from './sim.js';

const MODELS = {
  grass: [['Grass_Common_Short', 0.8], ['Grass_Wispy_Short', 0.7], ['Clover_1', 0.7]],
  flower: [['Flower_3_Group', 0.6], ['Flower_4_Group', 0.5], ['Plant_7_Big', 0.75], ['Plant_1', 0.6]],
  bush: [['Bush_Common_Flowers', 0.85], ['Bush_Common', 0.8]],
  tree: [['CommonTree_1', 1.2], ['CommonTree_2', 1.0], ['CommonTree_3', 0.95], ['CommonTree_5', 1.05], ['TwistedTree_3', 0.3]],
  pine: [['Pine_1', 0.85], ['Pine_3', 0.8], ['Pine_4', 0.7]],
  mush: [['Mushroom_Common', 0.9], ['Mushroom_Laetiporus', 0.6]],
  mood: [['Flower_3_Single', 1.5], ['Flower_4_Single', 1.3], ['Flower_3_Single', 1.8], ['Flower_4_Single', 1.6]],
};
const ANIMAL_SCALE = { chick: 0.45, bunny: 0.7, deer: 0.8, fox: 0.7, cat: 0.7, fish: 0.35, bee: 0.28 };
const SLEEPS_AT_NIGHT = { chick: 1, bunny: 1, deer: 1, bee: 1 };

// 一天里的四种光
const LIGHT = {
  day:   { skyTop: 0x7fc3ef, skyBot: 0xfdf3dc, sun: 0xfff2d6, sunI: 3.2, sunPos: [-14, 22, 10], hemiS: 0xcfe8ff, hemiG: 0x8a7a5a, hemiI: 1.6, night: 0, cloud: 0xffffff, cloudO: 0.85, leaf: 0.2 },
  dusk:  { skyTop: 0x6a6fae, skyBot: 0xffbf8a, sun: 0xffa766, sunI: 2.6, sunPos: [18, 7, -4], hemiS: 0xb7a5d6, hemiG: 0x6b4a3a, hemiI: 1.0, night: 0.45, cloud: 0xffd2b8, cloudO: 0.8, leaf: 0.08 },
  dawn:  { skyTop: 0x86a8dc, skyBot: 0xffd9c2, sun: 0xffc9a0, sunI: 2.4, sunPos: [-18, 8, 8], hemiS: 0xc4d0ee, hemiG: 0x7a6455, hemiI: 1.15, night: 0.25, cloud: 0xffe4d6, cloudO: 0.8, leaf: 0.09 },
  night: { skyTop: 0x0b1636, skyBot: 0x2f3f78, sun: 0x9fb6ff, sunI: 0.95, sunPos: [-10, 20, -12], hemiS: 0x5c70b4, hemiG: 0x23233a, hemiI: 1.15, night: 1, cloud: 0x5a6aa0, cloudO: 0.45, leaf: 0.07 },
};
const UI_THEME = {
  day:   { ink: '#2f3b35', glass: 'rgba(255,255,255,.62)', line: 'rgba(255,255,255,.8)', accent: '#e98a6c', accentShadow: 'rgba(233,138,108,.45)' },
  dusk:  { ink: '#3a2d3a', glass: 'rgba(255,238,226,.6)', line: 'rgba(255,240,230,.85)', accent: '#d9715f', accentShadow: 'rgba(217,113,95,.5)' },
  night: { ink: '#eef1ff', glass: 'rgba(30,40,80,.5)', line: 'rgba(160,180,255,.3)', accent: '#f2b65e', accentShadow: 'rgba(242,182,94,.45)' },
};
// 返回 [从, 到, 比例, 时段名]
export function phaseAt(now) {
  const d = new Date(now), h = d.getHours() + d.getMinutes() / 60;
  if (h < 4.5) return ['night', 'night', 0, '深夜'];
  if (h < 6) return ['night', 'dawn', (h - 4.5) / 1.5, '拂晓'];
  if (h < 8) return ['dawn', 'day', (h - 6) / 2, '清晨'];
  if (h < 16.5) return ['day', 'day', 0, h < 11 ? '上午' : h < 13.5 ? '中午' : '下午'];
  if (h < 18) return ['day', 'dusk', (h - 16.5) / 1.5, '傍晚'];
  if (h < 19.5) return ['dusk', 'night', (h - 18) / 1.5, '黄昏'];
  return ['night', 'night', 0, h < 22.5 ? '夜晚' : '深夜'];
}

const noise2 = (x, z) => Math.sin(x * 0.9 + 1.3) * Math.cos(z * 0.7 - 0.4) * 0.5 + Math.sin(x * 2.1 + z * 1.7) * 0.25 + Math.cos(x * 3.7 - z * 2.9) * 0.12;
export function groundY(x, z) {
  let y = noise2(x * 0.35, z * 0.35) * 0.35;
  const pd = Math.hypot(x - POND.x, z - POND.z);
  if (pd < 3.6) y -= 0.5 * Math.pow(1 - pd / 3.6, 1.2);
  return y;
}
const ease = t => 1 - Math.pow(1 - t, 2);
let rs = 12345;
const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;

export async function createWorld(canvas, starsCanvas, skyEl) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const root = new THREE.Group(); scene.add(root); // 整座岛，可以拖着转

  const hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 3); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 1, far: 90 });
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03; sun.shadow.radius = 4;
  scene.add(sun);

  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
  cam.position.set(30, 36, 30); cam.lookAt(0, -0.5, 0);
  function resize() {
    const W = innerWidth, H = innerHeight, aspect = W / H;
    const viewW = Math.max(23, 40 * aspect), viewH = viewW / aspect;
    cam.left = -viewW / 2; cam.right = viewW / 2; cam.top = viewH / 2; cam.bottom = -viewH / 2;
    cam.setViewOffset(W, H, 0, H * 0.02, W, H);
    cam.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(W, H, false);
    drawStars();
  }
  function drawStars() {
    const W = innerWidth, H = innerHeight, d = Math.min(devicePixelRatio, 2);
    starsCanvas.width = W * d; starsCanvas.height = H * d;
    const x = starsCanvas.getContext('2d'); x.scale(d, d);
    let sd = 3; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 220; i++) { const yy = r() * H * 0.72; x.globalAlpha = 0.25 + r() * 0.75 * (1 - yy / (H * 0.8)); x.fillStyle = '#fff'; x.beginPath(); x.arc(r() * W, yy, r() < 0.08 ? 1.6 : 0.8, 0, 7); x.fill(); }
    x.globalAlpha = 1;
    const mx = W * 0.2, my = H * 0.25, mg = x.createRadialGradient(mx, my, 0, mx, my, 60);
    mg.addColorStop(0, 'rgba(255,250,225,1)'); mg.addColorStop(0.25, 'rgba(255,248,220,1)'); mg.addColorStop(0.3, 'rgba(220,230,255,.35)'); mg.addColorStop(1, 'rgba(200,215,255,0)');
    x.fillStyle = mg; x.fillRect(mx - 100, my - 100, 200, 200);
  }

  // ---------- 岛 ----------
  const soilA = new THREE.Color(0xb08d62), soilB = new THREE.Color(0x8f6f4b), soilCrack = new THREE.Color(0x6f553b), mud = new THREE.Color(0x6b5a48);
  const grassA = new THREE.Color(0x6aa83a), grassB = new THREE.Color(0x4f8f34), grassC = new THREE.Color(0x9cc24e), rim = new THREE.Color(0x9c7a52);
  const topGeo = new THREE.BufferGeometry();
  let vSoil, vGrass, vPos;
  {
    const seg = 96, rings = 34, pos = [], idx = []; vSoil = []; vGrass = [];
    for (let r = 0; r <= rings; r++) for (let s = 0; s <= seg; s++) {
      const a = s / seg * Math.PI * 2, f = r / rings, er = edgeR(a) * f, x = Math.cos(a) * er, z = Math.sin(a) * er;
      pos.push(x, groundY(x, z) - Math.pow(f, 6) * 0.9, z);
      const t = 0.5 + 0.5 * noise2(x * 0.6 + 5, z * 0.6 - 3);
      const g = grassA.clone().lerp(grassB, t).lerp(grassC, Math.max(0, noise2(x * 0.25 - 2, z * 0.25 + 4)) * 0.6);
      const so = soilA.clone().lerp(soilB, t);
      if (Math.abs(Math.sin(x * 1.9 + Math.sin(z * 1.3) * 2) * Math.sin(z * 2.3 + Math.cos(x * 1.1) * 2)) < 0.07) so.lerp(soilCrack, 0.7); // 干裂的纹路
      if (f > 0.96) { g.lerp(rim, (f - 0.96) / 0.04 * 0.7); so.lerp(rim, (f - 0.96) / 0.04 * 0.5); }
      vGrass.push(g); vSoil.push(so);
    }
    for (let r = 0; r < rings; r++) for (let s = 0; s < seg; s++) { const a = r * (seg + 1) + s, b = a + seg + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    vPos = pos;
    topGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    topGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(pos.length), 3));
    topGeo.setIndex(idx); topGeo.computeVertexNormals();
  }
  const top = new THREE.Mesh(topGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })); top.receiveShadow = true; root.add(top);
  let cliff;
  {
    const seg = 72, rows = 20, depth = 11, pos = [], col = [], idx = [];
    const c1 = new THREE.Color(0x8a6646), c2 = new THREE.Color(0xb98d5f), c3 = new THREE.Color(0x6e5a4e), c4 = new THREE.Color(0x4e4250);
    for (let r = 0; r <= rows; r++) for (let s = 0; s <= seg; s++) {
      const a = s / seg * Math.PI * 2, f = r / rows;
      let rr = edgeR(a) * (Math.pow(1 - f, 0.9) * (1 - 0.25 * f) + 0.02) * (1 + 0.07 * Math.sin(a * 9 + f * 6) + 0.05 * Math.sin(a * 17 - f * 11));
      if (r === 0) rr = edgeR(a);
      pos.push(Math.cos(a) * rr, -0.9 - f * depth - (f > 0.85 ? (f - 0.85) * 8 : 0) + Math.sin(a * 5) * 0.3 * f, Math.sin(a) * rr);
      const cc = f < 0.12 ? c1.clone().lerp(c2, 0.4) : f < 0.35 ? c2.clone().lerp(c1, 0.5 + 0.5 * Math.sin(a * 6 + f * 20)) : c3.clone().lerp(c4, (f - 0.35) / 0.65);
      if (Math.sin(f * 40 + Math.sin(a * 4) * 2) > 0.7) cc.multiplyScalar(0.88);
      col.push(cc.r, cc.g, cc.b);
    }
    for (let r = 0; r < rows; r++) for (let s = 0; s < seg; s++) { const a = r * (seg + 1) + s, b = a + seg + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    cliff = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true })); cliff.castShadow = true; root.add(cliff);
  }

  // 地面颜色：越有生机越绿，植物周围先绿
  function recolor(state, now) {
    const v = vitality(state, now), base = Math.max(0, Math.min(1, Math.pow(v, 0.7) * 1.25 - 0.05));
    const live = state.plants.map(p => [p.x, p.z, SPECIES[p.sp].r * 2.2 + 0.8, 0.35 + 0.65 * maturity(p, now)]);
    const col = topGeo.attributes.color.array, c = new THREE.Color();
    for (let i = 0; i < vSoil.length; i++) {
      const x = vPos[i * 3], z = vPos[i * 3 + 2];
      let g = base;
      for (const [px, pz, pr, pm] of live) {
        const d = Math.hypot(x - px, z - pz); if (d < pr) g = Math.max(g, pm * (1 - d / pr) * 1.4);
      }
      g = Math.min(1, g + noise2(x * 1.7, z * 1.7) * 0.12 * (g > 0.02 ? 1 : 0));
      c.copy(vSoil[i]);
      const pd = pondDist(x, z);
      if (pd < POND.r + 0.3) { c.lerp(mud, 0.8); g *= 0.3; }
      c.lerp(vGrass[i], Math.max(0, g));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    topGeo.attributes.color.needsUpdate = true;
    const ic = isletGeo.attributes.color.array, ig = Math.min(1, state.islets / 3 + base * 0.5);
    for (let i = 0; i < vSoil.length; i++) { c.copy(vSoil[i]).lerp(vGrass[i], ig); ic[i * 3] = c.r; ic[i * 3 + 1] = c.g; ic[i * 3 + 2] = c.b; }
    isletGeo.attributes.color.needsUpdate = true;
  }

  // 池水
  const wcv = document.createElement('canvas'); wcv.width = wcv.height = 256;
  const wtex = new THREE.CanvasTexture(wcv); wtex.colorSpace = THREE.SRGBColorSpace;
  function paintWater(color) {
    const x = wcv.getContext('2d'), c0 = color, g = x.createRadialGradient(128, 128, 10, 128, 128, 128);
    g.addColorStop(0, '#' + c0.clone().multiplyScalar(0.55).getHexString()); g.addColorStop(0.75, '#' + c0.getHexString()); g.addColorStop(1, '#' + c0.clone().lerp(new THREE.Color(0xffffff), 0.5).getHexString());
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    x.strokeStyle = 'rgba(255,255,255,.45)'; x.lineWidth = 2;
    for (let i = 0; i < 9; i++) { x.beginPath(); const yy = 60 + i * 16; x.moveTo(50 + (i * 37) % 60, yy); x.quadraticCurveTo(128, yy - 6, 200 - (i * 23) % 50, yy); x.stroke(); }
    wtex.needsUpdate = true;
  }
  const pond = new THREE.Mesh(new THREE.CircleGeometry(POND.r, 48), new THREE.MeshPhysicalMaterial({ map: wtex, roughness: 0.08, transparent: true, opacity: 0.88, clearcoat: 1, clearcoatRoughness: 0.05 }));
  pond.rotation.x = -Math.PI / 2; pond.position.set(POND.x, -0.12, POND.z); pond.scale.set(1, POND.sz, 1); pond.receiveShadow = true; pond.visible = false; root.add(pond);

  // ---------- 素材 ----------
  const loader = new GLTFLoader(), cache = {}, leafMats = new Set();
  const leafGreen = new THREE.TextureLoader().load('assets/nature/Leaves_NormalTree_C.png'); leafGreen.flipY = false; leafGreen.colorSpace = THREE.SRGBColorSpace;
  async function model(name) {
    if (!cache[name]) cache[name] = loader.loadAsync(name.startsWith('animal') ? `assets/pets/${name}.glb` : `assets/nature/${name}.gltf`).then(g => {
      const small = /Grass|Clover|Plant_7|Pebble/.test(name);
      g.scene.traverse(m => {
        if (!m.isMesh) return;
        m.castShadow = !small; m.receiveShadow = true;
        const mat = m.material;
        if (mat.map && mat.alphaTest !== undefined) mat.alphaTest = 0.5;
        if (/^Bush/.test(name) && /Leaves/.test(mat.name)) mat.map = leafGreen;
        if (/Leaves|Leaf|Grass/.test(mat.name) && mat.map) { mat.emissive = new THREE.Color(0xffffff); mat.emissiveMap = mat.map; leafMats.add(mat); }
      });
      return g.scene;
    });
    return (await cache[name]).clone(true);
  }
  function place(o, x, z, s, ry, y) { o.position.set(x, y ?? groundY(x, z), z); o.scale.setScalar(s); o.rotation.y = ry; root.add(o); return o; }

  // 开场就在的东西：石头、池边卵石、石灯、枯树
  const fixed = [];
  ROCKS.forEach((k, i) => fixed.push(model('Rock_Medium_' + (i + 1)).then(o => place(o, k.x, k.z, [0.55, 0.7, 0.45][i], i * 1.9))));
  for (let i = 0; i < 26; i++) {
    const a = i / 26 * Math.PI * 2 + rnd() * 0.1, x = POND.x + Math.cos(a) * 3.3, z = POND.z + Math.sin(a) * 3.3 * POND.sz, s = 1.6 + rnd() * 1.2, ry = rnd() * 6;
    fixed.push(model(['Pebble_Round_1', 'Pebble_Round_3', 'Pebble_Square_2', 'Pebble_Round_5'][i % 4]).then(o => place(o, x, z, s, ry, groundY(x, z) - 0.05)));
  }
  const deadTrees = [];
  DEAD_TREES.forEach((k, i) => fixed.push(model('DeadTree_1').then(o => { deadTrees[i] = place(o, k.x, k.z, i ? 0.4 : 0.55, i * 2.2); })));

  const glowTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const glow = (color, size, opacity = 1) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.setScalar(size); return s; };

  // 石灯：素材包里没有，用几何体搭的
  const lanternGlowMat = new THREE.MeshBasicMaterial({ color: 0x554433 });
  const lanternHalo = glow(0xffc070, 2.8, 0), lanternLight = new THREE.PointLight(0xffb45a, 0, 9, 1.6);
  {
    const stone = new THREE.MeshStandardMaterial({ color: 0xcfc7b6, roughness: 0.92, flatShading: true }), g = new THREE.Group();
    const add = (geo, y) => { const m = new THREE.Mesh(geo, stone); m.position.y = y; m.castShadow = m.receiveShadow = true; g.add(m); };
    add(new THREE.CylinderGeometry(0.55, 0.7, 0.25, 6), 0.12); add(new THREE.CylinderGeometry(0.2, 0.26, 1.0, 6), 0.75); add(new THREE.CylinderGeometry(0.62, 0.45, 0.2, 6), 1.33);
    add(new THREE.BoxGeometry(0.7, 0.6, 0.7), 1.73); add(new THREE.ConeGeometry(0.95, 0.55, 6), 2.32); add(new THREE.SphereGeometry(0.14, 10, 8), 2.66);
    for (const [dx, dz, ry] of [[0, 0.355, 0], [0.355, 0, Math.PI / 2], [0, -0.355, Math.PI], [-0.355, 0, -Math.PI / 2]]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.3), lanternGlowMat); w.position.set(dx, 1.75, dz); w.rotation.y = ry; g.add(w); }
    const y = groundY(LANTERN.x, LANTERN.z) - 0.05;
    g.position.set(LANTERN.x, y, LANTERN.z); g.rotation.y = 0.2; g.scale.setScalar(1.45); root.add(g);
    lanternHalo.position.set(LANTERN.x, y + 2.55, LANTERN.z); root.add(lanternHalo);
    lanternLight.position.set(LANTERN.x, y + 2.6, LANTERN.z); root.add(lanternLight);
  }

  // 远处的小浮岛，生机够了才长东西
  const islets = [], isletGeo = topGeo.clone();
  function islet(cx, cy, cz, sc, rot, items) {
    const g = new THREE.Group(); g.add(new THREE.Mesh(isletGeo, top.material), new THREE.Mesh(cliff.geometry, cliff.material));
    g.children[0].receiveShadow = true;
    g.position.set(cx, cy, cz); g.scale.setScalar(sc); g.rotation.y = rot; scene.add(g); // 不跟着主岛转
    islets.push({ cx, cy, cz, items, shown: false });
  }
  islet(-11, 6, -13.9, 0.36, 1.3, [['Pine_4', -0.6, -0.8, 0.6, 1], ['Pine_1', 1.6, 0.6, 0.5, 2], ['Bush_Common_Flowers', -1.8, 1.4, 0.6, 0], ['Flower_4_Group', 0.6, 2.4, 0.5, 1], ['Rock_Medium_2', 2.6, -1.2, 0.3, 0], ['Plant_7_Big', 1.8, 2.2, 0.7, 0]]);
  islet(9.55, -8, -1.05, 0.27, 3.6, [['TwistedTree_1', -0.3, -0.4, 0.2, 0.5], ['Mushroom_Laetiporus', 1.0, 0.7, 0.6, 1], ['Flower_3_Group', -1.3, 0.8, 0.5, 2], ['Clover_1', 1.4, -0.6, 0.6, 0]]);
  islet(-0.5, -8, 10.1, 0.27, 2.2, [['CommonTree_5', 0, -0.3, 0.5, 1], ['Rock_Medium_1', 1.2, 0.8, 0.25, 2], ['Flower_3_Group', -1.0, 1.0, 0.5, 0], ['Grass_Common_Short', 0.4, 1.4, 0.7, 0]]);

  // 云
  const clouds = [];
  {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d');
    for (let i = 0; i < 14; i++) { const cx = 60 + rnd() * 136, cy = 110 + rnd() * 50, r = 30 + rnd() * 40, g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    for (const [x0, y0, z0, s] of [[-16, -12, 6, 14], [16, -14, -8, 16], [2, -18, 14, 18], [-20, 6, -18, 12], [18, 4, -14, 12], [-6, -14, -20, 14]]) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false })); sp.position.set(x0, y0, z0); sp.scale.set(s, s * 0.55, 1); sp.userData.x0 = x0; sp.userData.ph = rnd() * 6; scene.add(sp); clouds.push(sp);
    }
  }
  // 萤火虫
  const flies = [];
  for (let i = 0; i < 28; i++) { const s = glow(0xfff3a0, 0.18 + rnd() * 0.2, 0); const a = rnd() * 6.28, d = Math.sqrt(rnd()) * R; s.userData = { x: Math.cos(a) * d, z: Math.sin(a) * d, y: 0.6 + rnd() * 4, ph: rnd() * 6, sp: 0.3 + rnd() * 0.5 }; root.add(s); flies.push(s); }
  // 雨点（浇水时）
  const RAIN = 90, rainGeo = new THREE.BufferGeometry(), rainPos = new Float32Array(RAIN * 3);
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0xcfeaff, size: 4, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false }));
  rain.frustumCulled = false; root.add(rain);
  let rainUntil = 0;
  for (let i = 0; i < RAIN; i++) { const a = rnd() * 6.28, d = Math.sqrt(rnd()) * R * 0.95; rainPos[i * 3] = Math.cos(a) * d; rainPos[i * 3 + 1] = rnd() * 9; rainPos[i * 3 + 2] = Math.sin(a) * d; }

  await Promise.all(fixed);

  // ---------- 植物与动物 ----------
  const plantObj = new Map(), hits = [];
  const hitGeo = new THREE.SphereGeometry(1, 8, 6), hitMat = new THREE.MeshBasicMaterial({ visible: false });
  function addHit(obj, r, y, data) { const h = new THREE.Mesh(hitGeo, hitMat); h.scale.setScalar(r); h.position.y = y; h.userData = data; obj.add(h); hits.push(h); return h; }
  let moodLight = null;
  async function makePlant(p, instant) {
    const [name, base] = MODELS[p.sp][p.k % MODELS[p.sp].length];
    const holder = new THREE.Group(); holder.userData = { p, base, cur: instant ? -1 : 0.001 };
    holder.position.set(p.x, groundY(p.x, p.z) - 0.03, p.z); holder.rotation.y = p.rot; holder.scale.setScalar(0.001); root.add(holder);
    plantObj.set(p.id, holder);
    const o = await model(name); o.scale.setScalar(base); holder.add(o);
    if (p.sp === 'mood') {
      const color = new THREE.Color().setHSL(p.hue / 360, 0.85, 0.62), mats = [];
      o.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); leafMats.delete(m.material); m.material.emissive = color.clone(); m.material.emissiveMap = m.material.map; m.material.emissiveIntensity = 0; mats.push([m.material, /Flower/.test(m.material.name) ? 1 : 0.25]); } });
      const top = (name.startsWith('Flower_3') ? 1.9 : 2.2) * base;
      const halo = glow(color, 2.4, 0); halo.position.y = top; holder.add(halo);
      const sparks = []; for (let i = 0; i < 7; i++) { const s = glow(color.clone().lerp(new THREE.Color(0xffffff), 0.5), 0.16, 0); s.userData = { a: rnd() * 6.28, r: 0.4 + rnd() * 0.9, y: top - 0.8 + rnd() * 1.6, ph: rnd() * 6 }; holder.add(s); sparks.push(s); }
      Object.assign(holder.userData, { mats, halo, sparks, color, top });
      addHit(holder, 1.0, top * 0.6, { plant: p });
    }
    return holder;
  }
  const animalObj = new Map();
  const walkable = (x, z) => inIsland(x, z, 1.6) && pondDist(x, z) > POND.r + 0.7 && Math.hypot(x - LANTERN.x, z - LANTERN.z) > 1.5;
  function randomSpot() { for (let i = 0; i < 40; i++) { const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * R, x = Math.cos(a) * d, z = Math.sin(a) * d; if (walkable(x, z)) return [x, z]; } return [-3, 4]; }
  async function makeAnimal(a) {
    const o = await model('animal-' + a.sp), s = ANIMAL_SCALE[a.sp];
    const [x, z] = a.sp === 'fish' ? [POND.x, POND.z] : randomSpot();
    const holder = new THREE.Group(); holder.add(o); o.scale.setScalar(s);
    holder.position.set(x, groundY(x, z), z); holder.userData = { a, tx: x, tz: z, wait: Math.random() * 3, ph: Math.random() * 6, hop: 0 };
    addHit(holder, a.sp === 'bee' || a.sp === 'fish' ? 0.7 : 0.9, s * 0.9, { animal: a, holder });
    root.add(holder); animalObj.set(a.sp, holder);
  }

  let state = null, lastRecolor = -1;
  // 让画面跟上状态
  async function sync(s, now, instant = false) {
    state = s;
    const jobs = [], alive = new Set(s.plants.map(p => p.id));
    for (const [id, o] of plantObj) if (!alive.has(id)) { o.userData.dying = true; }
    for (const p of s.plants) if (!plantObj.has(p.id)) jobs.push(makePlant(p, instant));
    for (const a of s.animals) if (!animalObj.has(a.sp)) { animalObj.set(a.sp, null); jobs.push(makeAnimal(a)); }
    for (let i = 0; i < 2; i++) if (deadTrees[i]) deadTrees[i].visible = i < s.dead;
    pond.visible = s.pond;
    islets.forEach((it, i) => {
      if (it.shown || s.islets <= i) return; it.shown = true;
      for (const [n, dx, dz, sc, ry] of it.items) jobs.push(model(n).then(o => scene.add(place(o, it.cx + dx, it.cz + dz, sc, ry, it.cy + 0.02))));
    });
    await Promise.all(jobs);
    recolor(s, now); lastRecolor = now;
    moodLight = null;
    for (const p of s.plants) if (p.sp === 'mood' && maturity(p, now) >= 1) moodLight = plantObj.get(p.id);
    if (instant) growth(now, 1);
  }
  function growth(now, k) {
    for (const [id, o] of plantObj) {
      const u = o.userData;
      const target = u.dying ? 0 : u.p.sc * (0.28 + 0.72 * ease(maturity(u.p, now)));
      u.cur = u.cur < 0 ? target : u.cur + (target - u.cur) * k;
      o.scale.setScalar(Math.max(0.001, u.cur));
      if (u.dying && u.cur < 0.02) { root.remove(o); plantObj.delete(id); }
    }
  }

  // ---------- 光 ----------
  const cA = new THREE.Color(), cB = new THREE.Color(), vA = new THREE.Vector3(), vB = new THREE.Vector3();
  const mix = (a, b, t) => cA.setHex(a).lerp(cB.setHex(b), t);
  const moodPL = new THREE.PointLight(0xffffff, 0, 6, 1.5); root.add(moodPL);
  let night = 0, lastTheme = '', lastWater = '';
  function setTime(now) {
    const [ka, kb, t, label] = phaseAt(now), a = LIGHT[ka], b = LIGHT[kb], L = (k) => a[k] + (b[k] - a[k]) * t;
    skyEl.style.background = `linear-gradient(#${mix(a.skyTop, b.skyTop, t).getHexString()}, #${mix(a.skyBot, b.skyBot, t).getHexString()} 75%)`;
    document.querySelector('meta[name=theme-color]').content = '#' + mix(a.skyTop, b.skyTop, t).getHexString();
    sun.color.copy(mix(a.sun, b.sun, t)); sun.intensity = L('sunI');
    sun.position.copy(vA.fromArray(a.sunPos).lerp(vB.fromArray(b.sunPos), t));
    hemi.color.copy(mix(a.hemiS, b.hemiS, t)); hemi.groundColor.copy(mix(a.hemiG, b.hemiG, t)); hemi.intensity = L('hemiI');
    night = L('night');
    starsCanvas.style.opacity = Math.max(0, (night - 0.5) * 2);
    for (const c of clouds) { c.material.color.copy(mix(a.cloud, b.cloud, t)); c.material.opacity = L('cloudO'); }
    for (const m of leafMats) m.emissiveIntensity = L('leaf');
    lanternGlowMat.color.setHex(0xffc56b).multiplyScalar(0.3 + night * 1.6);
    lanternHalo.material.opacity = night; lanternHalo.scale.setScalar(2.8 + night * 1.2); lanternLight.intensity = night * 6;
    const wkey = ka + kb + Math.round(t * 6);
    if (wkey !== lastWater) { lastWater = wkey; const W = { day: 0x6fc6d8, dusk: 0xb7a7d0, dawn: 0x9fc4dc, night: 0x2e4a80 }; paintWater(mix(W[ka], W[kb], t)); pond.material.emissive.copy(mix(W[ka], W[kb], t)); pond.material.emissiveIntensity = 0.05 + night * 0.1; }
    const theme = t < 0.5 ? ka : kb, th = UI_THEME[theme === 'dawn' ? 'day' : theme];
    if (theme !== lastTheme) { lastTheme = theme; for (const k in th) document.documentElement.style.setProperty('--' + k, th[k]); }
    return label;
  }

  // ---------- 每一帧 ----------
  let spin = -0.0, spinV = 0, clockNow = () => Date.now();
  function frame(dt, tsec) {
    const now = clockNow();
    root.rotation.y = spin; spin += spinV * dt; spinV *= Math.pow(0.05, dt);
    growth(now, Math.min(1, dt * 2.5));
    if (state && Math.abs(now - lastRecolor) > 20 * 60e3) { recolor(state, now); lastRecolor = now; }
    // 心情花
    for (const o of plantObj.values()) {
      const u = o.userData; if (!u.halo) continue;
      const m = maturity(u.p, now), on = m >= 1 ? 1 : m * 0.25, pulse = 0.85 + 0.15 * Math.sin(tsec * 1.7 + u.p.id);
      const k = on * (0.35 + night * 0.65) * pulse;
      for (const [mat, w] of u.mats) mat.emissiveIntensity = k * w * (0.6 + night * 1.6);
      u.halo.material.opacity = Math.min(1, k * 0.9); u.halo.scale.setScalar(2.4 + night * 1.2);
      for (const s of u.sparks) { const d = s.userData; s.position.set(Math.cos(d.a + tsec * 0.3) * d.r, d.y + Math.sin(tsec * 0.9 + d.ph) * 0.25, Math.sin(d.a + tsec * 0.3) * d.r); s.material.opacity = k * (0.5 + 0.5 * Math.sin(tsec * 2.3 + d.ph)); }
    }
    if (moodLight) { moodPL.position.copy(moodLight.position); moodPL.position.y += moodLight.userData.top; moodPL.color.copy(moodLight.userData.color); moodPL.intensity = 1.2 + night * 5; } else moodPL.intensity = 0;
    // 动物
    for (const h of animalObj.values()) {
      if (!h) continue; const u = h.userData, sp = u.a.sp;
      if (sp === 'fish') {
        h.visible = !!(state && state.pond); const a = tsec * 0.35 + u.ph;
        h.position.set(POND.x + Math.cos(a) * 1.5, -0.42 + Math.max(0, Math.sin(tsec * 0.23 + u.ph) - 0.93) * 6, POND.z + Math.sin(a) * 1.5 * POND.sz); h.rotation.y = -a; continue;
      }
      const asleep = SLEEPS_AT_NIGHT[sp] && night > 0.8;
      if (sp === 'bee') {
        h.visible = !asleep; u.wait -= dt;
        if (u.wait <= 0 && state) { const fl = state.plants.filter(p => p.sp === 'flower' || p.sp === 'mood'); if (fl.length) { const f = fl[Math.floor(Math.random() * fl.length)]; u.tx = f.x; u.tz = f.z; } u.wait = 3 + Math.random() * 5; }
        const bx = u.tx + Math.cos(tsec * 1.3 + u.ph) * 0.5, bz = u.tz + Math.sin(tsec * 1.7 + u.ph) * 0.5;
        const dx = bx - h.position.x, dz = bz - h.position.z; h.position.x += dx * Math.min(1, dt * 1.5); h.position.z += dz * Math.min(1, dt * 1.5);
        h.position.y = groundY(h.position.x, h.position.z) + 1.3 + Math.sin(tsec * 3 + u.ph) * 0.15; if (Math.hypot(dx, dz) > 0.05) h.rotation.y = Math.atan2(dx, dz); continue;
      }
      const dx = u.tx - h.position.x, dz = u.tz - h.position.z, d = Math.hypot(dx, dz);
      let hopY = 0;
      if (d > 0.08 && !asleep) {
        const step = Math.min(d, (sp === 'chick' ? 1.1 : 0.8) * dt), nx = h.position.x + dx / d * step, nz = h.position.z + dz / d * step;
        if (walkable(nx, nz)) { h.position.x = nx; h.position.z = nz; } else { u.tx = h.position.x; u.tz = h.position.z; }
        h.rotation.y = Math.atan2(dx, dz); hopY = Math.abs(Math.sin(tsec * 9 + u.ph)) * 0.14;
      } else if (!asleep) { u.wait -= dt; if (u.wait <= 0) { [u.tx, u.tz] = randomSpot(); if (Math.hypot(u.tx - h.position.x, u.tz - h.position.z) > 6) { u.tx = h.position.x + (u.tx - h.position.x) * 0.4; u.tz = h.position.z + (u.tz - h.position.z) * 0.4; if (!walkable(u.tx, u.tz)) { u.tx = h.position.x; u.tz = h.position.z; } } u.wait = 3 + Math.random() * 9; } }
      if (u.hop > 0) { u.hop -= dt; hopY += Math.abs(Math.sin(u.hop * 12)) * 0.5 * u.hop; }
      h.position.y = groundY(h.position.x, h.position.z) + hopY;
      h.children[0].scale.y = ANIMAL_SCALE[sp] * (asleep ? 0.8 : 1 + Math.sin(tsec * 2 + u.ph) * 0.02);
    }
    // 萤火虫、云、雨
    const fv = state ? Math.min(1, vitality(state, now) * 3) : 0;
    for (const s of flies) { const d = s.userData; s.position.set(d.x + Math.sin(tsec * d.sp + d.ph) * 1.2, d.y + Math.sin(tsec * d.sp * 1.3 + d.ph) * 0.5, d.z + Math.cos(tsec * d.sp * 0.8 + d.ph) * 1.2); s.material.opacity = Math.max(0, night - 0.3) * fv * (0.5 + 0.5 * Math.sin(tsec * 2 + d.ph * 3)); }
    for (const c of clouds) c.position.x = c.userData.x0 + Math.sin(tsec * 0.02 + c.userData.ph) * 3;
    const raining = performance.now() < rainUntil;
    rain.material.opacity += ((raining ? 0.85 : 0) - rain.material.opacity) * Math.min(1, dt * 4);
    if (rain.material.opacity > 0.01) { for (let i = 0; i < RAIN; i++) { rainPos[i * 3 + 1] -= dt * 11; if (rainPos[i * 3 + 1] < 0) rainPos[i * 3 + 1] = 8 + Math.random() * 2; } rainGeo.attributes.position.needsUpdate = true; }
    renderer.render(scene, cam);
  }

  // ---------- 触摸 ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(px, py) {
    ndc.set(px / innerWidth * 2 - 1, -(py / innerHeight) * 2 + 1); ray.setFromCamera(ndc, cam);
    const h = ray.intersectObjects(hits.filter(o => o.parent && o.parent.visible !== false), false)[0];
    const g = ray.intersectObject(top, false)[0];
    const ground = g ? root.worldToLocal(g.point.clone()) : null;
    return { hit: h ? h.object.userData : null, ground: ground ? { x: ground.x, z: ground.z } : null };
  }

  resize(); addEventListener('resize', resize);
  return {
    sync, setTime, frame, pick, resize,
    rain: () => { rainUntil = performance.now() + 2600; },
    drag: dx => { spin += dx * 0.006; spinV = 0; }, fling: v => { spinV = v * 0.006; },
    hop: holder => { holder.userData.hop = 0.6; },
    setClock: f => { clockNow = f; },
  };
}
