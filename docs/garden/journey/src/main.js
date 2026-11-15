// 旅途 · 第一段「暖光谷地」：入口。加载世界、道具、两匹马和骑手，接上界面、声音、画质和每帧循环。
import * as THREE from 'three';
import { U, installGrade } from './world/atmo.js';
import { SPOTS } from './world/route.js';
import { buildWorld, RES } from './world/world.js';
import { buildBridge, buildWindmill, buildFences, buildCamp } from './world/props.js';
import { makeHorseA, makeHorseB, makeRider, makeReins } from './actors/actors.js';
import { CamRig, introShot } from './game/cam.js';
import { Sound } from './game/audio.js';
import { Ride } from './game/ride.js';
import { Quality, TIERS } from './game/quality.js';
import { initUI } from './game/ui.js';

const P = new URLSearchParams(location.search);
const SHOT = P.has('shot');   // 无头截图模式：?shot=1&s=路程&cam=travel|top|intro|side&horse=a|b&phase=view|camp&v=速度&sim=秒
if (SHOT) document.body.classList.add('shot');
const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

installGrade();
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: SHOT });
renderer.toneMapping = THREE.CustomToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.3, 7000);
scene.add(camera);
const hemi = new THREE.HemisphereLight('#bfd0f2', '#94844f', 1.3);
const sun = new THREE.DirectionalLight('#ffd9a8', 3.1);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 160 });
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04;
scene.add(hemi, sun, sun.target);

function setSize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // 竖屏时把垂直视角放大一点，保证横向至少 38 度
  const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(52) / 2) * camera.aspect);
  const minH = THREE.MathUtils.degToRad(38);
  camera.fov = hfov < minH ? THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(minH / 2) / camera.aspect)) : 52;
  camera.fov = Math.min(camera.fov, 72);
  camera.updateProjectionMatrix();
}
addEventListener('resize', setSize);
setSize();

let W = null, ride = null, cam = null, sound = null, quality = null, windmill = null, playing = false;
const focus = new THREE.Vector3();

// ---------- 画质 ----------
function applyTier(tier) {
  const T = TIERS[tier];
  renderer.setPixelRatio(Math.min(devicePixelRatio, T.pr)); setSize();
  sun.shadow.mapSize.set(T.shadow, T.shadow);
  if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  const c = sun.shadow.camera; c.left = c.bottom = -T.shadowR; c.right = c.top = T.shadowR; c.updateProjectionMatrix();
  U.uShadowRadius.value = T.shadowR;
  if (W) { W.setQuality(tier); W.update(camera, focus, 0, true); }
}
const showPerf = () => ui.perf(`${Math.round(quality.fps) || '--'} fps · ${quality.label}`);

// 阴影跟着马走；把中心对齐到阴影贴图的像素格子，走动时阴影边不闪
const _sx = new THREE.Vector3(), _sy = new THREE.Vector3(), _sz = new THREE.Vector3(), _sc = new THREE.Vector3();
function placeSun(center) {
  const T = TIERS[quality.tier], texel = 2 * T.shadowR / T.shadow;
  _sz.copy(U.uSunDir.value).normalize();
  _sx.crossVectors(THREE.Object3D.DEFAULT_UP, _sz).normalize(); _sy.crossVectors(_sz, _sx);
  const px = center.dot(_sx), py = center.dot(_sy);
  _sc.copy(center).addScaledVector(_sx, Math.round(px / texel) * texel - px).addScaledVector(_sy, Math.round(py / texel) * texel - py);
  sun.target.position.copy(_sc); sun.position.copy(_sc).addScaledVector(_sz, 80);
  U.uShadowCenter.value.copy(center);
}

// ---------- 界面回调 ----------
let hintTimer = 0;
const ui = initUI({
  pickHorse: k => ride?.swap(k),
  go: () => start(),
  hold: on => {
    if (!ride) return;
    ride.holding = on;
    if (on && playing && !hintTimer) hintTimer = setTimeout(() => ui.hint(''), 1800);
  },
  look: (dx, dy) => { if (!cam) return; cam.yawOff = clamp(cam.yawOff + dx * 2.4, -1.5, 1.5); cam.pitchOff = clamp(cam.pitchOff + dy * 3.2, -1.2, 3); cam.yawHold = 2.5; },
  zoom: () => cam?.zoomTarget ?? 0,
  setZoom: (z, done) => { if (!cam) return; cam.zoomTarget = z; if (done) ui.tool('bCam', z > 0.5); },
  gait: i => { if (!ride) return; ride.gait = i; ui.gait(i); },
  toggleAuto: () => { if (!ride) return; ride.auto = !ride.auto; ui.tool('bAuto', ride.auto); if (ride.auto) ui.hint(''); },
  toggleCam: () => { if (!cam) return; cam.zoomTarget = cam.zoomTarget > 0.5 ? 0 : 1; ui.tool('bCam', cam.zoomTarget > 0.5); },
  swapHorse: () => {
    if (!ride?.swap()) return;
    ui.setPick(ride.horse.kind);
    ui.banner(ride.horse.name, ride.horse.kind === 'a' ? '免费素材马' : '自己捏的圆润小马', 2.6);
  },
  toggleSound: () => { if (!sound) return; sound.setMuted(!sound.muted); ui.tool('bSound', !sound.muted); },
  cycleQuality: () => { if (!quality) return; quality.cycle(); showPerf(); },
  again: swap => {
    ui.summaryOff(); ui.fade(true);
    setTimeout(() => {
      if (swap) { ride.swap(); ui.setPick(ride.horse.kind); }
      ride.restart(); quality.samples.length = 0;
      ui.fade(false); ui.hint(ride.auto ? '' : '按住屏幕前进');
    }, 800);
  },
});
ui.tool('bSound', true);

function start() {
  if (playing || !ride) return;
  playing = true;
  sound.start();                    // 必须在点击里：iPhone 只允许这时候开声音
  ui.playing(true); ride.begin();
  quality.recording = true;
  ui.hint('按住屏幕前进');
  wake();
}

function showSummary() {
  const t = ride.rideT, m = Math.floor(t / 60), s = Math.round(t % 60);
  const dist = Math.round(ride.stopS - SPOTS.start), st = quality.stats();
  ui.summary('今晚在山口扎营',
    `${ride.horse.name}陪你走了 ${dist} 米，用了 ${m} 分 ${s} 秒。<br>过了溪上的木桥，看了山坡上的风车，<br>穿过林荫小道，在望远台回头看了看来路。` +
    (st ? `<br><span class="perf">这一路平均 ${st.avg} fps，最卡的时候 ${st.low} fps（画质：${quality.label}）</span>` : ''));
}

// ---------- 屏幕常亮、切后台 ----------
let lock = null;
async function wake() { try { lock = await navigator.wakeLock?.request('screen'); } catch { lock = null; } }
document.addEventListener('visibilitychange', () => {
  if (!sound?.ctx) return;
  if (document.visibilityState === 'visible') {
    sound.ctx.resume?.(); if (!sound.muted) sound.music?.play().catch(() => {});
    if (playing) wake();
  } else { sound.music?.pause(); sound.ctx.suspend?.(); }
});
// iPhone 有时需要再点一下才恢复声音
document.addEventListener('touchend', () => { if (sound?.ctx && sound.ctx.state !== 'running' && document.visibilityState === 'visible') sound.ctx.resume(); }, { passive: true });

// ---------- 每帧 ----------
function step(dt) {
  U.uTime.value += dt;
  const kl = ui.keysLook();
  if (kl) { cam.yawOff = clamp(cam.yawOff - kl * dt * 1.3, -1.5, 1.5); cam.yawHold = 1; }
  ride.update(dt);
  const hp = ride.horse.root.position, k = 7 * (1 - cam.zoom);
  focus.set(hp.x + Math.sin(ride.yaw) * k, hp.y, hp.z + Math.cos(ride.yaw) * k);
  placeSun(focus);
  W.update(camera, focus, dt);
  windmill.userData.update(dt);
}
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const rdt = clock.getDelta(), dt = Math.min(rdt, 1 / 20);
  step(dt);
  renderer.render(scene, camera);
  if (quality.frame(rdt)) showPerf();
}

// ---------- 加载 ----------
async function load() {
  const say = t => ui.loading(t);
  const q0 = P.get('q') || 'high';
  W = await buildWorld(renderer, scene, q0, say, { yieldFn: nextFrame });
  say('正在搭桥、种栅栏…');
  await nextFrame();
  const bridge = buildBridge(W.land); scene.add(bridge.mesh);
  windmill = buildWindmill(W.land); scene.add(windmill);
  scene.add(buildFences(W.land));
  const campP = buildCamp(W.land, RES);
  const aP = makeHorseA(RES + 'horseA.glb').catch(e => { console.warn('[j] horseA', e); return null; });
  const rP = makeRider(RES + 'rider.glb');
  say('正在牵马…');
  await nextFrame();
  const horseB = makeHorseB();
  const [camp, horseA, rider] = await Promise.all([campP, aP, rP]);
  scene.add(camp, horseB.root, rider.root);
  if (horseA) scene.add(horseA.root); else document.querySelector('#horsePick [data-h="a"]').disabled = true;
  const reins = makeReins(); scene.add(reins);
  cam = new CamRig(camera, (x, z) => W.land.height(x, z));
  sound = new Sound(RES);
  quality = new Quality(applyTier, q0);
  if (SHOT || P.has('q')) quality.mode = q0;
  applyTier(quality.tier);
  ride = new Ride({ land: W.land, bridge, camp, horses: { a: horseA, b: horseB }, rider, reins, cam, sound, ui, camera, sun, hemi });
  ride.onCamp = showSummary;
  // 先跑几步让马、镜头和植被就位，再提前编译着色器（免得一开始卡一下）
  for (let i = 0; i < 6; i++) step(1 / 30);
  W.update(camera, focus, 0, true);
  say('正在准备画面…');
  try { await renderer.compileAsync(scene, camera); } catch { renderer.compile(scene, camera); }
}

// 截图模式：直接摆到指定位置，模拟几秒，渲染三帧
function shotSetup() {
  document.body.classList.add('playing');
  if (P.get('hud') === '0') document.getElementById('hud').style.display = 'none';
  const mode = P.get('cam') || 'travel';
  if (P.get('horse') === 'a') ride.swap('a');
  if (mode !== 'intro') { ride.begin(); cam.shot = null; }
  ride.s = +(P.get('s') || SPOTS.start); ride.yaw = null; cam.inited = false;
  const v = +(P.get('v') || 0);
  if (v) { ride.holding = true; ride.gait = v > 2.5 ? 2 : v > 1.4 ? 1 : 0; }
  if (mode === 'top') cam.zoom = cam.zoomTarget = 1;
  if (P.get('phase') === 'view') { ride.s = SPOTS.view - 3; ride.holding = true; }
  if (P.get('phase') === 'camp') { ride.s = ride.stopS - 0.4; ride.holding = true; ride.viewDone = true; }
  if (P.get('auto')) ride.auto = true;
  if (P.has('yaw')) { cam.yawOff = +P.get('yaw'); cam.yawHold = 1e9; }
  if (P.has('dusk')) { ride.applyDusk(+P.get('dusk')); }
  const sim = +(P.get('sim') || 2.5);
  for (let t = 0; t < sim; t += 1 / 30) step(1 / 30);
  W.update(camera, focus, 0, true);
  if (P.has('bench')) {   // 测 CPU：每帧逻辑、植被刷新各要多久
    let t0 = performance.now(); for (let i = 0; i < 60; i++) step(1 / 60); const stepMs = (performance.now() - t0) / 60;
    t0 = performance.now(); for (let i = 0; i < 10; i++) W.update(camera, focus, 0, true); const layerMs = (performance.now() - t0) / 10;
    t0 = performance.now(); for (let i = 0; i < 60; i++) ride.update(1 / 60); const rideMs = (performance.now() - t0) / 60;
    const per = {};
    for (const L of W.layers) for (const m of L.meshes) { const g = m.geometry, t = (g.index ? g.index.count : g.attributes.position.count) / 3; per[L.name.replace(/:.*/, '')] = (per[L.name.replace(/:.*/, '')] || 0) + Math.round(m.count * t / 1000); }
    window.__bench = { stepMs: +stepMs.toFixed(2), layerMs: +layerMs.toFixed(2), rideMs: +rideMs.toFixed(2), ktris: per };
  }
  if (mode === 'side' || mode === 'front' || mode === 'close') {
    const hp = ride.horse.root.position, a = ride.yaw, f = new THREE.Vector3(Math.sin(a), 0, Math.cos(a)), r = new THREE.Vector3(-f.z, 0, f.x);
    const d = mode === 'close' ? 2.6 : 3.6;
    if (mode === 'front') camera.position.copy(hp).addScaledVector(f, d).addScaledVector(r, 1.2).add(new THREE.Vector3(0, 1.3, 0));
    else camera.position.copy(hp).addScaledVector(r, mode === 'close' ? -d : d).addScaledVector(f, 0.2).add(new THREE.Vector3(0, 1.25, 0));
    camera.lookAt(hp.x, hp.y + 0.95, hp.z); camera.updateMatrixWorld();
  }
  if (mode === 'sit') {
    const c = ride.camp.userData.seat, f = ride.camp.userData.fireAt;
    const d = new THREE.Vector3().subVectors(f, c).setY(0).normalize(), r = new THREE.Vector3(-d.z, 0, d.x);
    camera.position.copy(c).addScaledVector(d, 1.6).addScaledVector(r, 1.4).add(new THREE.Vector3(0, 1.0, 0));
    camera.lookAt(c.x, c.y + 0.45, c.z); camera.updateMatrixWorld();
  }
  // 调试：从一个点往六个方向看（grid=view 在观景台，grid=camp 绕篝火）
  const grid = P.get('grid');
  if (grid) {
    const c = grid === 'camp' ? ride.camp.userData.fireAt.clone() : ride.horse.root.position.clone();
    const R0 = +(P.get('r') || (grid === 'camp' ? 7 : 0)), hgt = +(P.get('h') || 2.5);
    const sz = new THREE.Vector2(); renderer.getSize(sz);
    const cols = 3, rows = 2, w = sz.x / cols, h = sz.y / rows;
    camera.aspect = w / h; camera.fov = +(P.get('fov') || 60); camera.updateProjectionMatrix();
    renderer.setScissorTest(true);
    for (let i = 0; i < 6; i++) {
      const a = (i * 60 + +(P.get('a0') || 0)) * Math.PI / 180, d = new THREE.Vector3(Math.sin(a), 0, -Math.cos(a));
      if (grid === 'camp') { camera.position.copy(c).addScaledVector(d, -R0).add(new THREE.Vector3(0, hgt, 0)); camera.lookAt(c.x, c.y + 0.9, c.z); }
      else { camera.position.copy(c).add(new THREE.Vector3(0, hgt, 0)); camera.lookAt(camera.position.clone().add(d.clone().multiplyScalar(10)).add(new THREE.Vector3(0, -0.8, 0))); }
      camera.updateMatrixWorld();
      U.uShadowCenter.value.copy(camera.position); W.update(camera, camera.position, 0, true);
      const x = (i % cols) * w, y = sz.y - (Math.floor(i / cols) + 1) * h;
      renderer.setViewport(x, y, w, h); renderer.setScissor(x, y, w, h); renderer.render(scene, camera);
    }
    window.__ready = true; return;
  }
  let n = 0;
  const one = () => {
    renderer.render(scene, camera);
    if (++n < 3) requestAnimationFrame(one);
    else { const V = o => { const v = new THREE.Vector3(); o.getWorldPosition(v); return v.toArray().map(x => +x.toFixed(2)); };
      window.__info = { bench: window.__bench, calls: renderer.info.render.calls, tris: renderer.info.render.triangles, s: +ride.s.toFixed(1), phase: ride.phase,
        horse: V(ride.horse.root), seat: V(ride.horse.seat), bits: ride.horse.bit.map(V), hands: [V(ride.rider.bones['hand.l']), V(ride.rider.bones['hand.r'])], rider: V(ride.rider.root) }; window.__ready = true; }
  };
  one();
}

load().then(() => {
  document.body.classList.add('ready');
  if (SHOT) return shotSetup();
  ui.ready(); showPerf();
  clock.getDelta();
  frame();
}).catch(e => { console.error(e); ui.failed('出错了：' + (e && e.message || e)); });
