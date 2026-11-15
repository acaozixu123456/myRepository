// 画面：可以走动的浮岛地图，和回合制战斗的小舞台。
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { LIGHT, UI_THEME } from '../js/scene.js';
import { MONSTERS, CLASSES } from './data.js';

const noise2 = (x, z) => Math.sin(x * 0.9 + 1.3) * Math.cos(z * 0.7 - 0.4) * 0.5 + Math.sin(x * 2.1 + z * 1.7) * 0.25 + Math.cos(x * 3.7 - z * 2.9) * 0.12;
const EL_COLOR = { none: 0xffffff, grass: 0x8fe36a, water: 0x6cc8ff, fire: 0xff8a4a };
function seeded(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

export async function createView(canvas, skyEl, starsEl) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0, 0); renderer.shadowMap.enabled = !/[?&]fast/.test(location.search); renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 3); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 110 }); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03; sun.shadow.radius = 4;
  scene.add(sun, sun.target);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
  const CAM_OFF = new THREE.Vector3(30, 36, 30), focus = new THREE.Vector3();
  let viewW = 14, worldW = 14;
  function resize() {
    const W = innerWidth, H = innerHeight, aspect = W / H;
    const w = Math.max(viewW, viewW * 1.5 * aspect), h = w / aspect;
    cam.left = -w / 2; cam.right = w / 2; cam.top = h / 2; cam.bottom = -h / 2; cam.updateProjectionMatrix();
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
    const th = UI_THEME[key === 'dawn' ? 'day' : key]; for (const k in th) document.documentElement.style.setProperty('--' + k, th[k]);
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
      return g.scene;
    });
    return (await cache[name]).clone(true);
  }
  const glowTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const starTex = new THREE.TextureLoader().load('assets/extra/star_06.png'); starTex.colorSpace = THREE.SRGBColorSpace;
  const glow = (color, size, opacity = 1, tex = glowTex) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.setScalar(size); return s; };

  // 一个会动的角色：模型 + 待机动画 + 影子
  async function makeActor(modelName, scale) {
    const o = await model(modelName), holder = new THREE.Group(); o.scale.setScalar(scale); holder.add(o);
    const clip = (clips[modelName] || [])[0];
    if (clip) { holder.userData.mixer = new THREE.AnimationMixer(o); const a = holder.userData.mixer.clipAction(clip); a.time = Math.random() * clip.duration; a.play(); }
    holder.userData.body = o; holder.userData.scale = scale; holder.userData.ph = Math.random() * 6;
    return holder;
  }
  const monsterActor = (id, k = 1) => makeActor(MONSTERS[id].model, 0.62 * (MONSTERS[id].scale || 1) * k);

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
      const top = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })); top.receiveShadow = true; g.add(top); g.userData.top = top; }
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
  let grace = 0, world = null, hero = null, petFollower = null, wild = [], bossActor = null, lantern = null, cb = {}, zoneRef = null, mode = 'world';
  const marker = glow(0xffffff, 1.2, 0, starTex); scene.add(marker);
  const target = { x: 0, z: 0, on: false };
  async function loadZone(zone, state) {
    if (world) scene.remove(world);
    zoneRef = zone; wild = []; bossActor = null; lantern = null; mode = 'world';
    const R = zone.home ? 11 : 15;
    world = buildIsland(R, zone.pal, { seed: 11 + zone.id.length * 7 + zone.id.charCodeAt(0), pond: zone.pond || zone.home, night: zone.light === 'night' });
    scene.add(world); setLight(zone.light);
    const jobs = [decorate(world, zone, zone.home ? 0.7 : 1)];
    hero = await makeActor(CLASSES[state.cls].model, CLASSES[state.cls].scale); world.add(hero); hero.position.set(0, world.userData.gy(0, 0), 0); target.on = false;
    petFollower = null; const p = state.pets[state.active];
    if (p) { petFollower = await monsterActor(p.id, 0.8); world.add(petFollower); petFollower.position.set(-1.2, 0, 0.8); }
    if (zone.home) jobs.push(model('x:stoneLantern').then(o => { o.position.set(2.2, world.userData.gy(2.2, -2.2) - 0.05, -2.2); o.scale.setScalar(3); world.add(o); lantern = o; world.userData.solids.push([2.2, -2.2, 0.9]); const h = glow(0xffc070, 3, 0.5); h.position.set(2.2, 2.3, -2.2); world.add(h); }));
    else {
      for (let i = 0; i < 7; i++) jobs.push(spawnWild());
      const a = 3.9, bx = Math.cos(a) * R * 0.68, bz = Math.sin(a) * R * 0.68;
      jobs.push(monsterActor(zone.boss).then(o => { o.position.set(bx, world.userData.gy(bx, bz), bz); o.rotation.y = Math.atan2(-bx, -bz); world.add(o); bossActor = o; const ring = glow(0xffd070, 6, 0.55); ring.position.set(bx, 0.6, bz); world.add(ring); o.userData.ring = ring; }));
    }
    await Promise.all(jobs);
    focus.copy(hero.position); grace = 1;
  }
  async function setPet(state) {
    if (petFollower) world.remove(petFollower); petFollower = null; const p = state.pets[state.active]; if (!p) return;
    const o = await monsterActor(p.id, 0.8); o.position.copy(hero.position); o.position.x -= 1.2; world.add(o); petFollower = o;
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
    hp.y = u.gy(hp.x, hp.z) + (moving ? Math.abs(Math.sin(t * 11)) * 0.22 : 0);
    marker.material.opacity = target.on ? 0.5 + 0.4 * Math.sin(t * 6) : Math.max(0, marker.material.opacity - dt * 3); marker.material.rotation = t;
    if (petFollower) {
      const pp = petFollower.position, dx = hp.x - pp.x, dz = hp.z - pp.z, d = Math.hypot(dx, dz);
      if (d > 1.7) { const s = Math.min(d - 1.6, 6 * dt); pp.x += dx / d * s; pp.z += dz / d * s; petFollower.rotation.y = Math.atan2(dx, dz); pp.y = u.gy(pp.x, pp.z) + Math.abs(Math.sin(t * 10 + 1)) * 0.18; } else pp.y = u.gy(pp.x, pp.z);
    }
    grace = Math.max(0, grace - dt);
    for (const w of wild) {
      const d = w.userData, wp = w.position, dx = d.tx - wp.x, dz = d.tz - wp.z, dist = Math.hypot(dx, dz);
      if (dist > 0.1) { const s = Math.min(dist, 1.3 * dt), nx = wp.x + dx / dist * s, nz = wp.z + dz / dist * s; if (!blocked(nx, nz)) { wp.x = nx; wp.z = nz; } else { d.tx = wp.x; d.tz = wp.z; } w.rotation.y = Math.atan2(dx, dz); wp.y = u.gy(wp.x, wp.z) + Math.abs(Math.sin(t * 8 + d.ph)) * 0.15; }
      else { wp.y = u.gy(wp.x, wp.z); d.wait -= dt; if (d.wait <= 0) { const a = Math.random() * 6.28, r = 1.5 + Math.random() * 4; d.tx = wp.x + Math.cos(a) * r; d.tz = wp.z + Math.sin(a) * r; if (blocked(d.tx, d.tz)) { d.tx = wp.x; d.tz = wp.z; } d.wait = 2 + Math.random() * 6; } }
      if (!grace && Math.hypot(wp.x - hp.x, wp.z - hp.z) < 1.5) { target.on = false; cb.encounter && cb.encounter(w.userData.id, false, w); return; }
    }
    if (bossActor) { bossActor.userData.ring.material.opacity = 0.4 + 0.2 * Math.sin(t * 2); if (!grace && Math.hypot(bossActor.position.x - hp.x, bossActor.position.z - hp.z) < 2.6) { target.on = false; const dx = hp.x - bossActor.position.x, dz = hp.z - bossActor.position.z, d = Math.hypot(dx, dz) || 1; hp.x = bossActor.position.x + dx / d * 4; hp.z = bossActor.position.z + dz / d * 4; cb.encounter && cb.encounter(zoneRef.boss, true, null); return; } }
    if (lantern && Math.hypot(2.2 - hp.x, -2.2 - hp.z) < 2.1 && target.on === false && !lantern.userData.told) { lantern.userData.told = true; cb.lantern && cb.lantern(); }
    if (lantern && Math.hypot(2.2 - hp.x, -2.2 - hp.z) > 3.5) lantern.userData.told = false;
    focus.lerp(hp, Math.min(1, dt * 5)); focus.y = 0.8;
  }

  // ---------- 战斗模式 ----------
  const arena = new THREE.Group(); arena.visible = false; scene.add(arena);
  const AX = new THREE.Vector3(1, 0, -1).normalize(), DZ = new THREE.Vector3(1, 0, 1).normalize();
  let actors = {}, tweens = [], fxSprites = [];
  async function enterBattle(battle, state) {
    mode = 'battle'; world.visible = false; arena.clear(); arena.visible = true; actors = {}; tweens = [];
    const isl = buildIsland(8.5, zoneRef.pal, { seed: 5 }); arena.add(isl);
    const rs = seeded(9), jobs = [];
    for (let i = 0; i < 7; i++) { const a = 3.2 + i * 0.42, r = 6.3 + rs() * 1, n = zoneRef.trees[i % zoneRef.trees.length]; jobs.push(model(n).then(o => { o.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); o.scale.setScalar((/Twisted/.test(n) ? 0.3 : /Dead/.test(n) ? 0.5 : /Pine/.test(n) ? 0.8 : 1) * 0.9); isl.add(o); })); }
    for (let i = 0; i < 26; i++) { const a = rs() * 6.28, r = 1 + rs() * 6.5, n = zoneRef.flowers[i % zoneRef.flowers.length]; jobs.push(model(n).then(o => { o.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); o.scale.setScalar((/Fern/.test(n) ? 0.16 : 0.55)); o.rotation.y = rs() * 6; isl.add(o); })); }
    const sideCount = { a: battle.units.filter(u => u.side === 'a').length, b: battle.units.filter(u => u.side === 'b').length }, sideIdx = { a: 0, b: 0 };
    for (const u of battle.units) {
      const i = sideIdx[u.side]++, n = sideCount[u.side], sgn = u.side === 'a' ? -1 : 1;
      const pos = AX.clone().multiplyScalar(sgn * (2.5 + (n - 1 - i) * 0.9)).add(DZ.clone().multiplyScalar((i - (n - 1) / 2) * 2.3));
      jobs.push((u.key === 'hero' ? makeActor(CLASSES[state.cls].model, CLASSES[state.cls].scale) : monsterActor(u.mid, u.key === 'pet' ? 1 : 1.1)).then(o => {
        o.position.copy(pos); o.rotation.y = Math.atan2(-sgn * AX.x, -sgn * AX.z); o.userData.home = pos.clone(); o.userData.height = u.key === 'hero' ? 2.2 : 1.5 * (MONSTERS[u.mid].scale || 1);
        arena.add(o); actors[u.key] = o;
      }));
    }
    await Promise.all(jobs);
    viewW = 10.5; resize(); focus.set(0, 1.4, 0);
  }
  function exitBattle() { mode = 'world'; viewW = worldW; resize(); arena.visible = false; arena.clear(); actors = {}; world.visible = true; focus.copy(hero.position); grace = 2.5; }
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
  function setZoom(w) { viewW = worldW = w; resize(); }
  resize(); addEventListener('resize', resize);
  return { loadZone, frame, tap, enterBattle, exitBattle, anim, screenPos, removeWild, setPet, setZoom, on: (k, f) => { cb[k] = f; }, get mode() { return mode; }, heroModelFor: makeActor };
}
