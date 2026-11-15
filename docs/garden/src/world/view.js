// 画面：可以走动的浮岛地图，和回合制战斗的小舞台。
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { LIGHT, UI_THEME } from './light.js';
import { MONSTERS, CLASSES } from '../data/index.js';
import { toonify, toonFromParams, setRim, outline } from './toon.js';

const noise2 = (x, z) => Math.sin(x * 0.9 + 1.3) * Math.cos(z * 0.7 - 0.4) * 0.5 + Math.sin(x * 2.1 + z * 1.7) * 0.25 + Math.cos(x * 3.7 - z * 2.9) * 0.12;
function seeded(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

export async function createView(canvas, skyEl, starsEl) {
  // look：{ cls, pet }，画面只需要知道主角是什么职业、跟着哪只伙伴
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0, 0); const saver = /[?&]fast/.test(location.search) || (() => { try { return localStorage.getItem('fudao.saver') === '1'; } catch { return false; } })();
  renderer.shadowMap.enabled = !saver; if (saver) renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 3); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 110 }); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03; sun.shadow.radius = 4;
  scene.add(sun, sun.target);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
  const CAM_OFF = new THREE.Vector3(30, 36, 30), focus = new THREE.Vector3();
  let viewW = 14, worldW = 14;
  let shiftY = 0; // 让主角往上挪，给底部面板让位（选人时用）
  function resize() {
    const W = innerWidth, H = innerHeight, aspect = W / H;
    const w = Math.max(viewW, viewW * 1.5 * aspect), h = w / aspect;
    cam.left = -w / 2; cam.right = w / 2; cam.top = h / 2 - shiftY * h; cam.bottom = -h / 2 - shiftY * h; cam.updateProjectionMatrix(); outline.aspect.value = aspect;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(W, H, false);
    const d = Math.min(devicePixelRatio, 2); starsEl.width = W * d; starsEl.height = H * d;
    const x = starsEl.getContext('2d'); x.scale(d, d); const r = seeded(3);
    for (let i = 0; i < 200; i++) { const yy = r() * H * 0.75; x.globalAlpha = 0.25 + r() * 0.7; x.fillStyle = '#fff'; x.beginPath(); x.arc(r() * W, yy, r() < 0.08 ? 1.6 : 0.8, 0, 7); x.fill(); }
  }
  function setLight(key) {
    const a = LIGHT[key], c = h => '#' + new THREE.Color(h).getHexString();
    skyEl.style.background = `linear-gradient(${c(a.skyTop)}, ${c(a.skyBot)} 75%)`;
    sun.color.setHex(a.sun); sun.intensity = a.sunI * (key === 'night' ? 2.4 : 1); sunDir.fromArray(a.sunPos);
    hemi.color.setHex(a.hemiS); hemi.groundColor.setHex(a.hemiG); hemi.intensity = a.hemiI * (key === 'night' ? 2.6 : key === 'dusk' ? 1.3 : 1);
    starsEl.style.opacity = key === 'night' ? 1 : 0; night = a.night;
    leafI = a.leaf * 2 + 0.12; for (const m of leafMats) m.emissiveIntensity = leafI;
    setRim(a.rim[0], a.rim[1]);
    const th = UI_THEME[key]; for (const k in th) document.documentElement.style.setProperty('--' + k, th[k]);
    document.documentElement.dataset.light = key;
  }
  const sunDir = new THREE.Vector3(-14, 22, 10); let night = 0, leafI = 0.4;

  // ---------- 素材 ----------
  const loader = new GLTFLoader(), cache = {}, clips = {}, leafMats = new Set();
  const leafGreen = new THREE.TextureLoader().load('assets/nature/Leaves_NormalTree_C.png'); leafGreen.flipY = false; leafGreen.colorSpace = THREE.SRGBColorSpace;
  async function model(name) {
    if (!cache[name]) cache[name] = loader.loadAsync(name.startsWith('x:') ? `assets/extra/${name.slice(2)}.glb` : name.startsWith('animal') ? `assets/pets/${name}.glb` : `assets/nature/${name}.gltf`).then(g => {
      clips[name] = g.animations; const small = /Grass|Clover|Plant_7|Pebble/.test(name);
      g.scene.traverse(m => {
        if (!m.isMesh) return; m.castShadow = !small; m.receiveShadow = true; const mat = m.material;
        if (mat.map && mat.alphaTest !== undefined) mat.alphaTest = 0.5;
        if (/^Bush/.test(name) && /Leaves/.test(mat.name)) mat.map = leafGreen;
        if (/Leaves|Leaf|Grass/.test(mat.name) && mat.map) { mat.emissive = new THREE.Color(0xffffff); mat.emissiveMap = mat.map; mat.emissiveIntensity = leafI; leafMats.add(mat); m.receiveShadow = false; }
      });
      // 角色、怪物、石头、灯笼加描边；草叶树叶不加
      return toonify(g.scene, /^animal|^x:|Rock|Mushroom|Bush/.test(name));
    });
    return (await cache[name]).clone(true);
  }
  const glowTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const starTex = new THREE.TextureLoader().load('assets/extra/star_06.png'); starTex.colorSpace = THREE.SRGBColorSpace;
  const glow = (color, size, opacity = 1, tex = glowTex) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.setScalar(size); return s; };

  // 一个会动的角色：模型 + 待机动画 + 影子
  async function makeActor(modelName, scale) {
    const o = await model(modelName), holder = new THREE.Group(); o.scale.setScalar(scale); holder.add(o);
    const list = clips[modelName] || [], idle = list.find(c => c.name === 'idle') || list.find(c => c.name !== 'static'), walk = list.find(c => c.name === 'walk');
    if (idle) {
      const mx = holder.userData.mixer = new THREE.AnimationMixer(o), a = mx.clipAction(idle); a.time = Math.random() * idle.duration; a.play();
      holder.userData.acts = { idle: a, walk: walk ? mx.clipAction(walk) : null, cur: 'idle' };
    }
    holder.userData.body = o; holder.userData.scale = scale; holder.userData.ph = Math.random() * 6;
    return holder;
  }
  // 走路和待机动作之间淡入淡出
  function setGait(actor, moving) {
    const A = actor && actor.userData.acts; if (!A || !A.walk) return; const want = moving ? 'walk' : 'idle'; if (A.cur === want) return;
    const from = A[A.cur], to = A[want]; to.reset().play(); from.crossFadeTo(to, 0.18, false); A.cur = want;
  }
  // 进化后的伙伴变大一点并换配色；异色的整体偏色，再挂一圈闪光
  async function monsterActor(id, k = 1, look = null) {
    if (look && typeof look === 'object' && look.id) id = look.id;
    const evo = look?.evo || 0, o = look?.model ? await makeActor(look.model, look.scale || 1) : await makeActor(MONSTERS[id].model, 0.62 * (MONSTERS[id].scale || 1) * k * (1 + 0.12 * evo));
    const base = look?.tint || MONSTERS[id]?.tint, tint = look?.shiny ? new THREE.Color(0xb9a6ff) : base ? new THREE.Color(base) : null;
    if (tint) o.userData.body.traverse(m => { if (!m.isMesh || m.userData.isOutline) return; const mats = (Array.isArray(m.material) ? m.material : [m.material]).map(x => { const c = x.clone(); c.color = c.color.clone().lerp(tint, look?.shiny ? 0.55 : 0.35); if (look?.shiny) { c.emissive = new THREE.Color(0x3a2a66); } return c; }); m.material = Array.isArray(m.material) ? mats : mats[0]; });
    if (look?.shiny) { const sp = glow(0xd8c8ff, 1.6, 0.7, starTex); sp.position.y = 1.2; o.add(sp); o.userData.sparkle = sp; }
    return o;
  }

  // ---------- 浮岛 ----------
  function buildIsland(R, pal, opts = {}) {
    const g = new THREE.Group(), rs = seeded(opts.seed || 7);
    const ph = [rs() * 6, rs() * 6, rs() * 6];
    const edge = a => R * (1 + 0.06 * Math.sin(a * 3 + ph[0]) + 0.04 * Math.sin(a * 7 + ph[1]) + 0.02 * Math.sin(a * 13 + ph[2]));
    const pond = opts.pond ? { x: R * 0.3, z: R * 0.25, r: R * 0.24 } : null;
    const gy = (x, z) => { let y = noise2(x * 0.3 + ph[0], z * 0.3) * 0.3; if (pond) { const d = Math.hypot(x - pond.x, z - pond.z); if (d < pond.r * 1.15) y -= 0.5 * Math.pow(1 - d / (pond.r * 1.15), 1.2); } return y; };
    const A = new THREE.Color(pal[0]), B = new THREE.Color(pal[1]), C = new THREE.Color(pal[2]), rim = new THREE.Color(0x9c7a52);
    { const seg = 96, rings = 36, pos = [], col = [], idx = [];
      for (let r = 0; r <= rings; r++) for (let s = 0; s <= seg; s++) {
        const a = s / seg * Math.PI * 2, f = r / rings, er = edge(a) * f, x = Math.cos(a) * er, z = Math.sin(a) * er;
        pos.push(x, gy(x, z) - Math.pow(f, 6) * 0.9, z);
        const c = A.clone().lerp(B, 0.5 + 0.5 * noise2(x * 0.6 + 5, z * 0.6 - 3)).lerp(C, Math.max(0, noise2(x * 0.25 - 2, z * 0.25 + 4)) * 0.6);
        if (f > 0.96) c.lerp(rim, (f - 0.96) / 0.04 * 0.7); col.push(c.r, c.g, c.b);
      }
      for (let r = 0; r < rings; r++) for (let s = 0; s < seg; s++) { const a = r * (seg + 1) + s, b = a + seg + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx); geo.computeVertexNormals();
      const top = new THREE.Mesh(geo, toonFromParams({ vertexColors: true })); top.receiveShadow = true; g.add(top); g.userData.top = top; }
    { const seg = 72, rows = 18, depth = R * 1.05, pos = [], col = [], idx = [];
      const c1 = new THREE.Color(0x8a6646), c2 = new THREE.Color(0xb98d5f), c3 = new THREE.Color(0x6e5a4e), c4 = new THREE.Color(0x4e4250);
      for (let r = 0; r <= rows; r++) for (let s = 0; s <= seg; s++) {
        const a = s / seg * Math.PI * 2, f = r / rows; let rr = edge(a) * (Math.pow(1 - f, 0.9) * (1 - 0.25 * f) + 0.02) * (1 + 0.07 * Math.sin(a * 9 + f * 6) + 0.05 * Math.sin(a * 17 - f * 11)); if (r === 0) rr = edge(a);
        pos.push(Math.cos(a) * rr, -0.9 - f * depth, Math.sin(a) * rr);
        const cc = f < 0.12 ? c1.clone().lerp(c2, 0.4) : f < 0.35 ? c2.clone().lerp(c1, 0.5 + 0.5 * Math.sin(a * 6 + f * 20)) : c3.clone().lerp(c4, (f - 0.35) / 0.65); col.push(cc.r, cc.g, cc.b);
      }
      for (let r = 0; r < rows; r++) for (let s = 0; s < seg; s++) { const a = r * (seg + 1) + s, b = a + seg + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx); geo.computeVertexNormals();
      g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }))); }
    if (pond) {
      const w = new THREE.Mesh(new THREE.CircleGeometry(pond.r, 40), new THREE.MeshPhysicalMaterial({ color: opts.night ? 0x3a5a9a : 0x6fc6d8, roughness: 0.08, transparent: true, opacity: 0.85, clearcoat: 1 }));
      w.rotation.x = -Math.PI / 2; w.position.set(pond.x, -0.14, pond.z); w.receiveShadow = true; g.add(w);
    }
    const inside = (x, z, m = 1) => Math.hypot(x, z) < edge(Math.atan2(z, x)) - m;
    const walk = (x, z) => inside(x, z, 0.9) && !(pond && Math.hypot(x - pond.x, z - pond.z) < pond.r + 0.5);
    Object.assign(g.userData, { R, gy, inside, walk, pond, rs, solids: [] });
    return g;
  }
  async function decorate(g, zone, density = 1) {
    const { R, gy, walk, rs, solids } = g.userData, jobs = [];
    const put = (name, x, z, s, solid) => jobs.push(model(name).then(o => { o.position.set(x, gy(x, z) - 0.03, z); o.scale.setScalar(s); o.rotation.y = rs() * 6.28; g.add(o); }), solid && solids.push([x, z, solid]));
    const spot = (minR = 0, tries = 30) => { for (let i = 0; i < tries; i++) { const a = rs() * 6.28, d = minR + Math.sqrt(rs()) * (R * 0.95 - minR), x = Math.cos(a) * d, z = Math.sin(a) * d; if (walk(x, z) && Math.hypot(x, z) > 3 && solids.every(([sx, sz, sr]) => Math.hypot(x - sx, z - sz) > sr + 1.2)) return [x, z]; } return null; };
    const treeScale = n => /Twisted/.test(n) ? 0.3 : /Dead/.test(n) ? 0.5 : /Pine/.test(n) ? 0.8 : 1.05;
    for (let i = 0; i < Math.round(R * 0.9 * density); i++) { const p = spot(R * 0.25); if (p) { const n = zone.trees[i % zone.trees.length]; put(n, p[0], p[1], treeScale(n) * (0.85 + rs() * 0.3), 0.9); } }
    for (let i = 0; i < Math.round(R * 0.35 * density); i++) { const p = spot(4); if (p) put('Rock_Medium_' + (1 + i % 3), p[0], p[1], 0.3 + rs() * 0.3, 1.1); }
    for (let i = 0; i < Math.round(R * 0.5 * density); i++) { const p = spot(3); if (p) put(i % 2 ? 'Bush_Common_Flowers' : 'Bush_Common', p[0], p[1], 0.6 + rs() * 0.3, 0.8); }
    for (let i = 0; i < Math.round(R * 4.5 * density); i++) { const p = spot(0); if (p) { const n = zone.flowers[i % zone.flowers.length]; put(n, p[0], p[1], (/Fern/.test(n) ? 0.16 : /Mushroom_L/.test(n) ? 0.5 : 0.6) * (0.8 + rs() * 0.4), 0); } }
    if (g.userData.pond) { const pd = g.userData.pond; for (let i = 0; i < 22; i++) { const a = i / 22 * 6.28, x = pd.x + Math.cos(a) * (pd.r + 0.15), z = pd.z + Math.sin(a) * (pd.r + 0.15); put(['Pebble_Round_1', 'Pebble_Round_3', 'Pebble_Square_2', 'Pebble_Round_5'][i % 4], x, z, 1.6 + rs() * 1.2, 0); } }
    await Promise.all(jobs);
  }

  // ---------- 地图模式 ----------
  let grace = 0, world = null, hero = null, petFollower = null, wild = [], inter = [], bossActor = null, lantern = null, cb = {}, zoneRef = null, mode = 'world';
  const marker = glow(0xffffff, 1.2, 0, starTex); scene.add(marker);
  const target = { x: 0, z: 0, on: false };
  async function loadZone(zone, look) {
    if (world) scene.remove(world);
    zoneRef = zone; wild = []; bossActor = null; lantern = null; mode = 'world';
    const R = zone.home ? 11 : 15;
    world = buildIsland(R, zone.pal, { seed: 11 + zone.id.length * 7 + zone.id.charCodeAt(0), pond: zone.pond || zone.home, night: zone.light === 'night' });
    scene.add(world); setLight(zone.light);
    const jobs = [decorate(world, zone, zone.home ? 0.7 : 1)];
    hero = await makeActor(CLASSES[look.cls].model, CLASSES[look.cls].scale); world.add(hero); hero.position.set(0, world.userData.gy(0, 0), 0); target.on = false;
    petFollower = null;
    if (look.pet) { petFollower = await monsterActor(look.pet, 0.8, look.pet); world.add(petFollower); petFollower.position.set(-1.2, 0, 0.8); }
    if (zone.home) jobs.push(model('x:stoneLantern').then(o => { o.position.set(2.2, world.userData.gy(2.2, -2.2) - 0.05, -2.2); o.scale.setScalar(3); world.add(o); lantern = o; world.userData.solids.push([2.2, -2.2, 0.9]); const h = glow(0xffc070, 3, 0.5); h.position.set(2.2, 2.3, -2.2); world.add(h); }));
    else {
      for (let i = 0; i < 7; i++) jobs.push(spawnWild());
      const a = 3.9, bx = Math.cos(a) * R * 0.68, bz = Math.sin(a) * R * 0.68;
      jobs.push(monsterActor(zone.boss).then(o => { o.position.set(bx, world.userData.gy(bx, bz), bz); o.rotation.y = Math.atan2(-bx, -bz); world.add(o); bossActor = o; const ring = glow(0xffd070, 6, 0.55); ring.position.set(bx, 0.6, bz); world.add(ring); o.userData.ring = ring; }));
    }
    inter = []; farm = null; jobs.push(placeExtras(zone, cb.extras ? cb.extras(zone) : {}));
    await Promise.all(jobs);
    focus.copy(hero.position); grace = 1;
  }
  // 岛上能互动的东西：NPC（走近就说话）、采集点（发光的草）、宝箱
  function freeSpot(minR = 4) {
    const u = world.userData;
    for (let i = 0; i < 60; i++) { const a = Math.random() * 6.28, d = minR + Math.random() * (u.R * 0.85 - minR), x = Math.cos(a) * d, z = Math.sin(a) * d; if (u.walk(x, z) && u.solids.every(([sx, sz, sr]) => Math.hypot(x - sx, z - sz) > sr + 1)) return [x, z]; }
    return [minR, 0];
  }
  async function placeExtras(zone, ex) {
    const u = world.userData, jobs = [];
    for (const n of ex.npcs || []) jobs.push(monsterActor(null, 1, { id: null, model: n.model, scale: n.scale, tint: n.tint }).then(o => {
      let [x, z] = n.pos; if (!u.walk(x, z)) [x, z] = freeSpot(3);
      o.position.set(x, u.gy(x, z), z); o.rotation.y = Math.atan2(-x, -z); world.add(o); u.solids.push([x, z, 0.8]);
      const mark = glow(0xffe08a, 0.9, 0.9, starTex); mark.position.set(0, 2.4, 0); o.add(mark); o.userData.mark = mark;
      inter.push({ o, kind: 'npc', id: n.id, r: 1.9 });
    }));
    for (let i = 0; i < Math.min(3, ex.gather || 0); i++) jobs.push(model('Plant_1').then(o => {
      const [x, z] = freeSpot(); o.position.set(x, u.gy(x, z), z); o.scale.setScalar(0.9); const g = glow(0x9dffb0, 1.6, 0.8, starTex); g.position.y = 0.7; o.add(g); o.userData.mark = g; world.add(o);
      inter.push({ o, kind: 'gather', r: 1.3 });
    }));
    if (ex.farm) placeFarm();
    // 搬来住的守护兽：在小岛上慢慢转悠
    for (const id of ex.guardians || []) jobs.push(monsterActor(id, 0.55).then(o => { const [x, z] = freeSpot(3); o.position.set(x, u.gy(x, z), z); o.rotation.y = Math.random() * 6.28; world.add(o); u.solids.push([x, z, 1]); inter.push({ o, kind: 'guardian', id, r: 2 }); }));
    if (ex.chest) {
      const g = new THREE.Group(), wood = new THREE.MeshToonMaterial({ color: 0xa8683a }), gold = new THREE.MeshToonMaterial({ color: 0xf2c14e });
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.6), wood); box.position.y = 0.28; box.castShadow = true;
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 12, 1, false, 0, Math.PI), wood); lid.rotation.z = Math.PI / 2; lid.position.y = 0.55;
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.62, 0.64), gold); band.position.y = 0.32;
      g.add(box, lid, band); const sp = glow(0xffe08a, 1.8, 0.7, starTex); sp.position.y = 1; g.add(sp); g.userData.mark = sp;
      const [x, z] = freeSpot(5); g.position.set(x, u.gy(x, z), z); g.rotation.y = Math.random() * 6; world.add(g); u.solids.push([x, z, 0.6]);
      inter.push({ o: g, kind: 'chest', r: 1.6 });
    }
    await Promise.all(jobs);
  }
  // 家园的田地：一块块土，种了东西就长出彩色的小作物，熟了的会发光。点田边打开家园页
  let farm = null, farmSig = '';
  const dirt = new THREE.MeshToonMaterial({ color: 0x9a6a43 }), leafM = new THREE.MeshToonMaterial({ color: 0x6cbf5a });
  function placeFarm() {
    // 找一块 4×3 格都能走、不压着树和石头的空地，离主角近一点
    const u = world.userData, cells = [];
    for (let i = 0; i < 12; i++) cells.push([(i % 4 - 1.5) * 1.05, (Math.floor(i / 4) - 1) * 1.05]);
    const ok = (x, z) => cells.every(([dx, dz]) => u.walk(x + dx, z + dz) && u.solids.every(([sx, sz, sr]) => Math.hypot(x + dx - sx, z + dz - sz) > sr + 0.7));
    let spot = null, best = 1e9;
    for (let x = -7; x <= 7; x += 0.5) for (let z = -6; z <= 7; z += 0.5) { const d = Math.hypot(x + 3, z - 3.5); if (d < best && Math.hypot(x, z) > 2.5 && ok(x, z)) { best = d; spot = [x, z]; } }
    if (!spot) return;
    const [cx, cz] = spot;
    farm = new THREE.Group(); farm.position.set(cx, u.gy(cx, cz), cz); world.add(farm); farmSig = '';
    inter.push({ o: farm, kind: 'farm', r: 2.4 }); drawFarm();
  }
  function drawFarm() {
    if (!farm || !cb.farm) return; const plots = cb.farm(), sig = JSON.stringify(plots); if (sig === farmSig) return; farmSig = sig;
    farm.clear();
    plots.forEach((p, i) => {
      const x = (i % 4 - 1.5) * 1.05, z = (Math.floor(i / 4) - 1) * 1.05, g = new THREE.Group(); g.position.set(x, 0, z);
      const soil = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.16, 0.9), dirt); soil.position.y = 0.06; soil.receiveShadow = true; g.add(soil);
      if (p) {
        const k = p.ripe ? 1 : 0.35 + 0.5 * p.k, fruit = new THREE.Mesh(new THREE.SphereGeometry(0.2 * k + 0.05, 12, 10), new THREE.MeshToonMaterial({ color: new THREE.Color(p.color) }));
        fruit.position.y = 0.2 + 0.15 * k; fruit.castShadow = true; g.add(fruit);
        for (const a of [0.6, 2.7, 4.8]) { const lf = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3 * k + 0.1, 5), leafM); lf.position.set(Math.cos(a) * 0.1, 0.32 + 0.3 * k, Math.sin(a) * 0.1); lf.rotation.set(Math.sin(a) * 0.5, 0, Math.cos(a) * 0.5); g.add(lf); }
        if (p.ripe) { const sp = glow(0xffe08a, 1, 0.7, starTex); sp.position.y = 0.8; g.add(sp); }
      }
      farm.add(g);
    });
  }
  // NPC 头上的标记：主线要找它（橙）、有新支线（黄）、可以交付（绿），没事就不显示
  let markClock = 0;
  const MARK_COLOR = { main: 0xffa04a, new: 0xffe08a, ready: 0x8dffa8 };
  function refreshMarks() {
    for (const it of inter) if (it.kind === 'npc') { const k = cb.npcMark ? cb.npcMark(it.id) : 'new', m = it.o.userData.mark; m.visible = !!k; if (k) m.material.color.setHex(MARK_COLOR[k]); }
  }
  function removeInter(it) { inter = inter.filter(x => x !== it); world.remove(it.o); const i = world.userData.solids.findIndex(([x, z]) => x === it.o.position.x && z === it.o.position.z); if (i >= 0) world.userData.solids.splice(i, 1); }
  async function setPet(petId) {
    if (petFollower) world.remove(petFollower); petFollower = null; if (!petId) return;
    const o = await monsterActor(petId, 0.8, petId); o.position.copy(hero.position); o.position.x -= 1.2; world.add(o); petFollower = o;
  }
  async function spawnWild() {
    const z = zoneRef, id = z.wild[Math.floor(Math.random() * z.wild.length)], u = world.userData;
    let x = 0, zz = 0; for (let i = 0; i < 40; i++) { const a = Math.random() * 6.28, d = 4 + Math.random() * (u.R - 5); x = Math.cos(a) * d; zz = Math.sin(a) * d; if (u.walk(x, zz) && Math.hypot(x - hero.position.x, zz - hero.position.z) > 6) break; }
    const o = await monsterActor(id); if (zoneRef !== z) return;
    o.position.set(x, u.gy(x, zz), zz); o.userData.id = id; o.userData.tx = x; o.userData.tz = zz; o.userData.wait = Math.random() * 4; world.add(o); wild.push(o);
  }
  function removeWild(o) { wild = wild.filter(w => w !== o); world.remove(o); setTimeout(() => { if (world && mode !== 'gone' && !zoneRef.home && wild.length < 7) spawnWild(); }, 9000); }
  function walkTo(x, z) { target.x = x; target.z = z; target.on = true; marker.position.set(x, world.userData.gy(x, z) + 0.3, z); marker.material.opacity = 0.9; }
  const blocked = (x, z) => !world.userData.walk(x, z) || world.userData.solids.some(([sx, sz, sr]) => Math.hypot(x - sx, z - sz) < sr);

  function worldFrame(dt, t) {
    const u = world.userData, hp = hero.position; let moving = false;
    if (target.on) {
      const dx = target.x - hp.x, dz = target.z - hp.z, d = Math.hypot(dx, dz);
      if (d < 0.15) target.on = false; else {
        const step = Math.min(d, 5.2 * dt), nx = hp.x + dx / d * step, nz = hp.z + dz / d * step;
        if (!blocked(nx, nz)) { hp.x = nx; hp.z = nz; moving = true; } else if (!blocked(nx, hp.z)) { hp.x = nx; moving = true; } else if (!blocked(hp.x, nz)) { hp.z = nz; moving = true; } else target.on = false;
        hero.rotation.y = Math.atan2(dx, dz);
      }
    }
    setGait(hero, moving); hp.y = u.gy(hp.x, hp.z) + (moving && !hero.userData.acts?.walk ? Math.abs(Math.sin(t * 11)) * 0.22 : 0);
    marker.material.opacity = target.on ? 0.5 + 0.4 * Math.sin(t * 6) : Math.max(0, marker.material.opacity - dt * 3); marker.material.rotation = t;
    if (petFollower) {
      const pp = petFollower.position, dx = hp.x - pp.x, dz = hp.z - pp.z, d = Math.hypot(dx, dz);
      setGait(petFollower, d > 1.7); if (d > 1.7) { const s = Math.min(d - 1.6, 6 * dt); pp.x += dx / d * s; pp.z += dz / d * s; petFollower.rotation.y = Math.atan2(dx, dz); pp.y = u.gy(pp.x, pp.z) + Math.abs(Math.sin(t * 10 + 1)) * 0.18; } else pp.y = u.gy(pp.x, pp.z);
    }
    grace = Math.max(0, grace - dt);
    for (const w of wild) {
      const d = w.userData, wp = w.position, dx = d.tx - wp.x, dz = d.tz - wp.z, dist = Math.hypot(dx, dz);
      setGait(w, dist > 0.1); if (dist > 0.1) { const s = Math.min(dist, 1.3 * dt), nx = wp.x + dx / dist * s, nz = wp.z + dz / dist * s; if (!blocked(nx, nz)) { wp.x = nx; wp.z = nz; } else { d.tx = wp.x; d.tz = wp.z; } w.rotation.y = Math.atan2(dx, dz); wp.y = u.gy(wp.x, wp.z) + Math.abs(Math.sin(t * 8 + d.ph)) * 0.15; }
      else { wp.y = u.gy(wp.x, wp.z); d.wait -= dt; if (d.wait <= 0) { const a = Math.random() * 6.28, r = 1.5 + Math.random() * 4; d.tx = wp.x + Math.cos(a) * r; d.tz = wp.z + Math.sin(a) * r; if (blocked(d.tx, d.tz)) { d.tx = wp.x; d.tz = wp.z; } d.wait = 2 + Math.random() * 6; } }
      if (!grace && Math.hypot(wp.x - hp.x, wp.z - hp.z) < 1.5) { target.on = false; cb.encounter && cb.encounter(w.userData.id, false, w); return; }
    }
    if (bossActor) { bossActor.userData.ring.material.opacity = 0.4 + 0.2 * Math.sin(t * 2); if (!grace && Math.hypot(bossActor.position.x - hp.x, bossActor.position.z - hp.z) < 2.6) { target.on = false; const dx = hp.x - bossActor.position.x, dz = hp.z - bossActor.position.z, d = Math.hypot(dx, dz) || 1; hp.x = bossActor.position.x + dx / d * 4; hp.z = bossActor.position.z + dz / d * 4; cb.encounter && cb.encounter(zoneRef.boss, true, null); return; } }
    if ((markClock -= dt) <= 0) { markClock = 0.8; refreshMarks(); drawFarm(); }
    for (const it of inter) {
      const d = Math.hypot(it.o.position.x - hp.x, it.o.position.z - hp.z);
      if (it.o.userData.mark) it.o.userData.mark.material.opacity = 0.55 + 0.35 * Math.sin(t * 3);
      if (d < it.r && !target.on && !it.told) { it.told = true; cb.interact && cb.interact(it); }
      else if (d > it.r + 1.5) it.told = false;
    }
    if (lantern && Math.hypot(2.2 - hp.x, -2.2 - hp.z) < 2.1 && target.on === false && !lantern.userData.told) { lantern.userData.told = true; cb.lantern && cb.lantern(); }
    if (lantern && Math.hypot(2.2 - hp.x, -2.2 - hp.z) > 3.5) lantern.userData.told = false;
    focus.lerp(hp, Math.min(1, dt * 5)); focus.y = 0.8;
  }

  // ---------- 战斗模式 ----------
  const arena = new THREE.Group(); arena.visible = false; scene.add(arena);
  const AX = new THREE.Vector3(1, 0, -1).normalize(), DZ = new THREE.Vector3(1, 0, 1).normalize();
  let actors = {}, tweens = [], fxSprites = [];
  async function enterBattle(battle, look) {
    mode = 'battle'; world.visible = false; arena.clear(); arena.visible = true; actors = {}; tweens = [];
    const isl = buildIsland(8.5, zoneRef.pal, { seed: 5 }); arena.add(isl);
    const rs = seeded(9), jobs = [];
    for (let i = 0; i < 7; i++) { const a = 3.2 + i * 0.42, r = 7.2 + rs() * 0.8, n = zoneRef.trees[i % zoneRef.trees.length]; jobs.push(model(n).then(o => { o.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); o.scale.setScalar((/Twisted/.test(n) ? 0.3 : /Dead/.test(n) ? 0.5 : /Pine/.test(n) ? 0.8 : 1) * 0.9); isl.add(o); })); }
    for (let i = 0; i < 26; i++) { const a = rs() * 6.28, r = 1 + rs() * 6.5, n = zoneRef.flowers[i % zoneRef.flowers.length]; jobs.push(model(n).then(o => { o.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); o.scale.setScalar((/Fern/.test(n) ? 0.16 : 0.55)); o.rotation.y = rs() * 6; isl.add(o); })); }
    const sideCount = { a: battle.units.filter(u => u.side === 'a').length, b: battle.units.filter(u => u.side === 'b').length }, sideIdx = { a: 0, b: 0 };
    for (const u of battle.units) jobs.push(placeActor(u, slotPos(u.side, sideIdx[u.side]++, sideCount[u.side]), look));
    await Promise.all(jobs);
    viewW = baseW = 12; resize(); focus.copy(FOCUS0);
  }
  const FOCUS0 = new THREE.Vector3(0, 1.4, 0); let baseW = 12, shakeT = 0, shakeP = 0;
  // 站位：我方在左下，敌方在右上，前排在前
  function slotPos(side, i, n) { const sgn = side === 'a' ? -1 : 1, row = n > 2 ? (i % 2 === 1 ? 0 : 1) : 0, sp = n > 3 ? 2.1 : 2.9; return AX.clone().multiplyScalar(sgn * (2.3 + row * 0.9)).add(DZ.clone().multiplyScalar((i - (n - 1) / 2) * sp)); }
  async function placeActor(u, pos, look) {
    const sgn = u.side === 'a' ? -1 : 1;
    const o = await (u.key === 'hero' ? makeActor(CLASSES[look.cls].model, CLASSES[look.cls].scale) : monsterActor(u.mid, u.side === 'a' ? 1 : u.boss ? 1.25 : 1.1, { id: u.mid, evo: u.evo, shiny: u.shiny, tint: u.tint }));
    o.position.copy(pos); o.rotation.y = Math.atan2(-sgn * AX.x, -sgn * AX.z); o.userData.home = pos.clone(); o.userData.height = u.key === 'hero' ? 2.2 : 1.5 * (MONSTERS[u.mid].scale || 1) * (u.boss ? 1.15 : 1) * (1 + 0.12 * (u.evo || 0));
    arena.add(o); actors[u.key] = o; return o;
  }
  // 首领叫来的帮手：站到后排空位，从地里冒出来
  async function addActor(u) {
    const n = Object.keys(actors).filter(k => k.startsWith('e')).length, pos = AX.clone().multiplyScalar(4.4 + (n % 2) * 0.6).add(DZ.clone().multiplyScalar(((n % 3) - 1) * 2.4));
    const o = await placeActor(u, pos, {}); o.scale.multiplyScalar(0.01); const full = o.scale.x * 100;
    await tween(0.35, k => o.scale.setScalar(full * Math.max(0.01, k)));
  }
  // 换伙伴：旧的缩回去，新的站在同一个位置
  async function swapActor(u) {
    const old = actors[u.key], pos = old ? old.userData.home.clone() : slotPos('a', 2, 3);
    if (old) { await tween(0.2, k => old.scale.setScalar(Math.max(0.001, 1 - k))); arena.remove(old); }
    const o = await placeActor(u, pos, {}); const full = o.scale.x; await tween(0.25, k => o.scale.setScalar(full * Math.max(0.01, k)));
  }
  function exitBattle() { mode = 'world'; shakeT = 0; viewW = worldW; resize(); arena.visible = false; arena.clear(); actors = {}; world.visible = true; focus.copy(hero.position); grace = 2.5; }
  const tween = (dur, fn, done) => new Promise(res => tweens.push({ t: 0, dur, fn, done: () => { done && done(); res(); } }));
  const anim = {
    async lunge(key, toKey) { const o = actors[key], t = actors[toKey]; if (!o) return; const from = o.userData.home, to = t ? from.clone().lerp(t.userData.home, 0.62) : from.clone().add(AX.clone().multiplyScalar(key.startsWith('e') ? -1.2 : 1.2));
      await tween(0.16, k => { o.position.lerpVectors(from, to, k); o.position.y = Math.sin(k * Math.PI) * 0.5; }); tween(0.22, k => { o.position.lerpVectors(to, from, k); }); },
    async cast(key, color) { const o = actors[key]; if (!o) return; const s = glow(color, 0.5, 0.9); s.position.copy(o.userData.home); s.position.y += o.userData.height * 0.6; arena.add(s);
      await tween(0.3, k => { s.scale.setScalar(0.5 + k * 3.5); s.material.opacity = 0.9 * (1 - k); o.position.y = Math.sin(k * Math.PI) * 0.35; }, () => arena.remove(s)); },
    hit(key, color = 0xffffff, big = false) { const o = actors[key]; if (!o) return; const h = o.userData.home, s = glow(color, 1, 1, starTex); s.position.copy(h); s.position.y += o.userData.height * 0.5; arena.add(s);
      return tween(0.28, k => { const sh = Math.sin(k * 30) * 0.18 * (1 - k); o.position.set(h.x + sh, h.y, h.z + sh); s.scale.setScalar((big ? 2.2 : 1.4) + k * 2.5); s.material.opacity = 1 - k; s.material.rotation = k * 2; }, () => { arena.remove(s); o.position.copy(h); }); },
    heal(key) { const o = actors[key]; if (!o) return; const s = glow(0x9dffb0, 1, 0.9); s.position.copy(o.userData.home); arena.add(s);
      return tween(0.45, k => { s.position.y = o.userData.home.y + k * o.userData.height * 1.2; s.scale.setScalar(2.4 - k); s.material.opacity = 0.9 * (1 - k * 0.8); }, () => arena.remove(s)); },
    ko(key) { const o = actors[key]; if (!o) return; return tween(0.4, k => { o.scale.setScalar(Math.max(0.001, 1 - k)); o.rotation.y += 0.4; }, () => { o.visible = false; }); },
    async capture(fromKey, key, ok) { const o = actors[key], f = actors[fromKey]; if (!o || !f) return; const s = glow(0xfff0a0, 0.9, 1, starTex), a = f.userData.home.clone(), b = o.userData.home.clone(); a.y += 1.5; b.y += 0.8; arena.add(s);
      await tween(0.45, k => { s.position.lerpVectors(a, b, k); s.position.y += Math.sin(k * Math.PI) * 2.5; s.material.rotation = k * 8; });
      await tween(0.35, k => { o.scale.setScalar(Math.max(0.05, 1 - k * 0.95)); s.scale.setScalar(0.9 + k * 2); });
      for (let i = 0; i < 3; i++) await tween(0.22, k => { s.material.opacity = 0.6 + 0.4 * Math.sin(k * Math.PI); s.position.x = b.x + Math.sin(k * Math.PI * 2) * 0.12; });
      if (ok) { await tween(0.3, k => { s.scale.setScalar(2.9 + k * 3); s.material.opacity = 1 - k; }); o.visible = false; } else await tween(0.25, k => { o.scale.setScalar(0.05 + k * 0.95); s.material.opacity = 1 - k; });
      arena.remove(s); },
    flash(key) { const o = actors[key]; if (!o) return; return tween(0.3, k => { o.position.y = o.userData.home.y + Math.sin(k * Math.PI) * 0.6; }); },
    shake(p = 0.35, t = 0.25) { shakeP = p; shakeT = t; },
    // 镜头推近某个角色再拉回来
    async focus(key, w = 8.2, dur = 0.35) { const o = actors[key]; if (!o) return; const from = focus.clone(), to = FOCUS0.clone().lerp(o.userData.home, 0.45); to.y = 1.4;
      await tween(dur, k => { const e = 1 - (1 - k) * (1 - k); focus.lerpVectors(from, to, e); viewW = baseW + (w - baseW) * e; resize(); }); },
    async unfocus(dur = 0.3) { const from = focus.clone(), w0 = viewW; await tween(dur, k => { focus.lerpVectors(from, FOCUS0, k); viewW = w0 + (baseW - w0) * k; resize(); }); },
    // 法术飞弹：从施法者飞到目标
    async bolt(fromKey, toKey, color, big = false) { const a = actors[fromKey], b = actors[toKey]; if (!a || !b) return; const p0 = a.userData.home.clone(), p1 = b.userData.home.clone(); p0.y += a.userData.height * 0.6; p1.y += b.userData.height * 0.5;
      const s = glow(color, big ? 1.6 : 1.1, 1), core = glow(0xffffff, big ? 0.7 : 0.45, 0.9); arena.add(s, core); const trail = [];
      await tween(0.32, k => { const p = new THREE.Vector3().lerpVectors(p0, p1, k); p.y += Math.sin(k * Math.PI) * 1.2; s.position.copy(p); core.position.copy(p);
        if (trail.length < 9 && Math.random() < 0.8) { const t = glow(color, 0.6, 0.6); t.position.copy(p); arena.add(t); trail.push(t); }
        trail.forEach(t => { t.material.opacity *= 0.86; t.scale.multiplyScalar(0.94); }); });
      arena.remove(s, core); trail.forEach(t => arena.remove(t)); },
    // 全体技：敌方脚下扩散的一圈
    async wave(side, color) { const c = AX.clone().multiplyScalar(side === 'b' ? 3.2 : -3.2); const ring = glow(color, 1, 0.9); ring.position.copy(c); ring.position.y = 0.6; arena.add(ring);
      const parts = []; for (let i = 0; i < 10; i++) { const g = glow(color, 0.5, 0.8, starTex); g.position.set(c.x + (Math.random() - 0.5) * 5, 0.4, c.z + (Math.random() - 0.5) * 5); arena.add(g); parts.push(g); }
      await tween(0.45, k => { ring.scale.setScalar(1 + k * 9); ring.material.opacity = 0.9 * (1 - k); parts.forEach((g, i) => { g.position.y = 0.4 + k * (1.5 + i % 3); g.material.opacity = 0.8 * (1 - k); g.material.rotation = k * 4; }); });
      arena.remove(ring); parts.forEach(g => arena.remove(g)); },
    // 增益：脚下往上冒光点
    async buff(key, color) { const o = actors[key]; if (!o) return; const parts = []; for (let i = 0; i < 6; i++) { const g = glow(color, 0.45, 0.9, starTex); const a = i / 6 * 6.28; g.position.set(o.userData.home.x + Math.cos(a) * 0.7, 0.2, o.userData.home.z + Math.sin(a) * 0.7); arena.add(g); parts.push(g); }
      await tween(0.45, k => parts.forEach((g, i) => { g.position.y = 0.2 + k * o.userData.height * (1 + (i % 2) * 0.3); g.material.opacity = 0.9 * (1 - k * 0.9); })); parts.forEach(g => arena.remove(g)); },
    // 首领倒地
    async down(key) { const o = actors[key]; if (!o) return; const h = o.userData.home; await tween(0.35, k => { o.rotation.z = Math.sin(k * Math.PI / 2) * 0.5; o.position.y = h.y - k * 0.2; }); },
    up(key) { const o = actors[key]; if (!o) return; o.rotation.z = 0; o.position.copy(o.userData.home); },
    // 倒下的伙伴被复活：重新长出来
    revive(key) { const o = actors[key]; if (!o) return; o.visible = true; o.rotation.set(0, o.rotation.y, 0); o.position.copy(o.userData.home); return tween(0.4, k => { o.scale.setScalar(Math.max(0.001, k)); }); },
  };
  const v3 = new THREE.Vector3();
  function screenPos(key, top = true) { const o = actors[key]; if (!o) return null; v3.copy(o.userData.home); if (top) v3.y += o.userData.height + 0.35; else v3.y += o.userData.height * 0.5; v3.project(cam); return { x: (v3.x + 1) / 2 * innerWidth, y: (1 - v3.y) / 2 * innerHeight }; }

  // ---------- 每一帧 ----------
  function frame(dt, t) {
    if (!world) return;
    if (mode === 'world') worldFrame(dt, t);
    scene.traverse(o => { if (o.userData.mixer && o.visible) o.userData.mixer.update(dt); });
    for (const tw of tweens) { tw.t += dt; const k = Math.min(1, tw.t / tw.dur); tw.fn(k); if (k >= 1) tw.done(); }
    tweens = tweens.filter(tw => tw.t < tw.dur);
    cam.position.copy(focus).add(CAM_OFF); cam.lookAt(focus);
    if (shakeT > 0) { shakeT -= dt; const a = shakeP * Math.max(0, shakeT) * 4; cam.position.x += (Math.random() - 0.5) * a; cam.position.y += (Math.random() - 0.5) * a; }
    sun.position.copy(focus).add(sunDir); sun.target.position.copy(focus);
    renderer.render(scene, cam);
  }
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function tap(px, py) {
    if (mode !== 'world' || !world) return;
    ndc.set(px / innerWidth * 2 - 1, -(py / innerHeight) * 2 + 1); ray.setFromCamera(ndc, cam);
    const hit = ray.intersectObject(world.userData.top, false)[0];
    if (hit) walkTo(hit.point.x, hit.point.z);
  }
  function setZoom(w, shift = 0) { viewW = worldW = w; shiftY = shift; resize(); }
  resize(); addEventListener('resize', resize);
  return { get farmAt() { return farm && [farm.position.x, farm.position.z]; }, loadZone, removeInter, frame, tap, enterBattle, exitBattle, addActor, swapActor, anim, screenPos, removeWild, setPet, setZoom, on: (k, f) => { cb[k] = f; }, get mode() { return mode; }, heroModelFor: makeActor };
}
