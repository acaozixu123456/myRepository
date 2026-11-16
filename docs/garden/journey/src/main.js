// 旅途 · 第一段「暖光谷地」：入口。加载世界、道具、几匹坐骑、旅人和翅膀，接上界面、声音、画质和每帧循环。
import * as THREE from 'three';
import { U, installGrade } from './world/atmo.js';
import { ROAD, SPOTS, TRAIL } from './world/route.js';
import { buildWorld, RES } from './world/world.js';
import { buildBridge, buildWindmill, buildFences, buildCamp } from './world/props.js';
import { makeHorseB, makeHorseA, loadAnimal, makeReins, MOUNT_INFO } from './actors/actors.js';
import { makeTraveler } from './actors/traveler.js';
import { makeWings } from './actors/wings.js';
import { CamRig } from './game/cam.js';
import { Sound } from './game/audio.js';
import { Journey, Colliders, GAITS, START_TOD } from './game/journey.js';
import { Quality, TIERS } from './game/quality.js';
import { initUI } from './game/ui.js';
import { DayLight, periodOf } from './world/daytime.js';
import { SKY } from './world/sky.js';
import { makeFireflies } from './world/fireflies.js';
import { makeFalling } from './world/particles.js';
import { loadSave, writeSave, clearSave } from './game/save.js';

const P = new URLSearchParams(location.search);
// 无头截图模式：?shot=1&place=地点|x=&z=&ry=朝向&mode=foot|ride|fly&mount=a|b|w|d&trav=m|f&v=速度&alt=高度&sim=秒&cam=travel|top|intro|side|front|close
const SHOT = P.has('shot');
if (SHOT) document.body.classList.add('shot');
const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));
const MOUNT_ORDER = ['b', 'a', 'w', 'd'];

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

let W = null, J = null, cam = null, sound = null, quality = null, windmill = null, wings = null, fireflies = null, falling = null, playing = false;
const travelers = {};          // m / f：选到哪个才加载哪个
// 存档：截图模式不读不写
const saved = SHOT || P.has('fresh') ? null : loadSave();
let travKey = P.get('trav') === 'f' || (!P.has('trav') && saved?.trav === 'f') ? 'f' : 'm';
const focus = new THREE.Vector3();

// ---------- 画质 ----------
function applyTier(tier) {
  const T = TIERS[tier];
  renderer.setPixelRatio(Math.min(devicePixelRatio, T.pr)); setSize();
  SKY.uDpr.value = renderer.getPixelRatio();
  sun.shadow.mapSize.set(T.shadow, T.shadow);
  if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  const c = sun.shadow.camera; c.left = c.bottom = -T.shadowR; c.right = c.top = T.shadowR; c.updateProjectionMatrix();
  U.uShadowRadius.value = T.shadowR;
  if (W) { W.setQuality(tier); W.update(camera, focus, 0, true); }
}
const showPerf = () => ui.perf(`${Math.round(quality.fps) || '--'} fps · ${quality.label}`);

// 阴影跟着人走；把中心对齐到阴影贴图的像素格子，走动时阴影边不闪
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
  pickMount: k => {
    if (!J || !J.mounts[k]) return;
    if (!playing) { J.startWith(k); return; }
    J.pickMount(k);
  },
  pickTraveler: k => { if (!playing) useTraveler(k); },
  go: () => start(),
  hold: on => {
    if (!J) return;
    J.holding = on;
    if (on && playing && !hintTimer) hintTimer = setTimeout(() => ui.hint(''), 1800);
  },
  look: (dx, dy) => J?.look(dx, dy),
  zoom: () => cam?.zoomTarget ?? 0,
  setZoom: (z, done) => { if (!cam) return; cam.zoomTarget = z; if (done) ui.tool('bCam', z > 0.5); },
  gait: i => { if (!J) return; J.gait = i; ui.gait(i); },
  mode: m => { if (J && playing) J.setMode(m); },
  action: t => { if (t === '坐下烤火') J?.sitAtCamp(); },
  toggleAuto: () => { if (!J) return; J.auto = !J.auto; ui.tool('bAuto', J.auto); if (J.auto) ui.hint(''); },
  toggleCam: () => { if (!cam) return; cam.zoomTarget = cam.zoomTarget > 0.5 ? 0 : 1; ui.tool('bCam', cam.zoomTarget > 0.5); },
  toggleSound: () => { if (!sound) return; sound.setMuted(!sound.muted); ui.tool('bSound', !sound.muted); },
  cycleQuality: () => { if (!quality) return; quality.cycle(); showPerf(); },
  places: () => J ? J.places.map(p => ({ name: p.name, sub: p.sub, where: p.where, seen: J.visited.includes(p.id) })) : [],
  again: restart => {
    ui.summaryOff();
    if (!restart) {
      if (!J.isNight) { J.standUp(); ui.hint('按住屏幕前进'); save(); return; }
      // 夜里：睡一觉，第二天清晨接着走
      ui.fade(true);
      setTimeout(() => { J.wakeUp(); ui.fade(false); ui.banner(`第 ${J.dayN} 天`, '天亮了，接着上路'); ui.hint('按住屏幕前进'); save(); }, 1100);
      return;
    }
    ui.fade(true);
    clearSave();
    setTimeout(() => { J.restart(); quality.samples.length = 0; ui.fade(false); ui.hint(J.auto ? '' : '按住屏幕前进'); save(); }, 800);
  },
  skipTime: () => { if (J && playing) J.skipTime(); },
  // 开始卡片上的“从头开始”：不用存档
  fresh: () => {
    if (!J || playing) return;
    clearSave(); J.fresh(); ui.resume(null); ui.setPick(J.mountKey);
  },
});
ui.tool('bSound', true);

// 走法、步态名字和坐骑在界面上同步（切换要过渡一会儿，所以每帧看一下）
let shownMode = '', shownMount = '', shownGait = -1;
function syncUI() {
  const m = J.uiMode, k = J.mountKey;
  if (m !== shownMode || k !== shownMount) {
    shownMode = m; shownMount = k;
    ui.mode(m);
    ui.gaitNames(m === 'ride' ? J.mount.gaitNames : GAITS[m].map(g => g.name));
    ui.mountChanged(k);
    shownGait = -1;
  }
  if (J.gait !== shownGait) { shownGait = J.gait; ui.gait(J.gait); }
  ui.time(periodOf(J.ff ? J.ff.to : J.tod).name, !!J.ff || (J.sitting && J.sitTo !== null));
}

// ---------- 存档 ----------
let saveT = 0;
function save() {
  if (!J || SHOT || !playing || J.phase === 'intro') return;
  writeSave({ ...J.snapshot(), trav: travKey });
}
function resumeText(s) {
  const n = (s.visited || []).length;
  return `第 ${Math.max(1, s.day | 0)} 天 · ${periodOf(+s.tod || START_TOD).name}${n ? ` · 到过 ${n} 个地方` : ''}`;
}

function start() {
  if (playing || !J) return;
  playing = true;
  sound.start(J.musicMood());       // 必须在点击里：iPhone 只允许这时候开声音
  ui.playing(true); J.begin();
  quality.recording = true;
  ui.hint('按住屏幕前进');
  wake();
}

function showSummary() {
  const t = J.travelT, m = Math.floor(t / 60), s = Math.round(t % 60), st = quality.stats();
  const d = J.dist, parts = [];
  if (d.foot > 20) parts.push(`走了 ${Math.round(d.foot)} 米`);
  if (d.ride > 20) parts.push(`骑马 ${Math.round(d.ride)} 米`);
  if (d.fly > 20) parts.push(`飞了 ${Math.round(d.fly)} 米`);
  const seen = J.visited.map(id => J.places.find(p => p.id === id)?.name).filter(Boolean);
  ui.summary('今晚在山口扎营',
    `这一路 ${m} 分 ${s} 秒${parts.length ? '，' + parts.join('，') : ''}。<br>` +
    (seen.length ? `到过：${seen.join('、')}。<br>` : '') +
    (seen.length < J.places.length ? `还有 ${J.places.length - seen.length} 个地方没去，明天接着走吧。` : '谷地里的地方都去过了。') +
    (st ? `<br><span class="perf">平均 ${st.avg} fps，最卡的时候 ${st.low} fps（画质：${quality.label}）</span>` : ''));
}

// ---------- 屏幕常亮、切后台 ----------
let lock = null;
async function wake() { try { lock = await navigator.wakeLock?.request('screen'); } catch { lock = null; } }
document.addEventListener('visibilitychange', () => {
  if (!sound?.ctx) return;
  if (document.visibilityState === 'visible') {
    sound.ctx.resume?.(); sound.resumeMusic();
    if (playing) wake();
  } else { sound.pauseMusic(); sound.ctx.suspend?.(); }
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); });
addEventListener('pagehide', () => save());
// iPhone 有时需要再点一下才恢复声音
document.addEventListener('touchend', () => { if (sound?.ctx && sound.ctx.state !== 'running' && document.visibilityState === 'visible') sound.ctx.resume(); }, { passive: true });

// ---------- 每帧 ----------
const _chest = new THREE.Vector3();
function step(dt) {
  U.uTime.value += dt;
  J.keys(dt, ui.keysTurn(), ui.keysClimb());
  J.update(dt);
  // 挡在镜头和人之间的枝叶变透（远景镜头时关掉）
  J.T.bones.spine_03.getWorldPosition(_chest);
  U.uSee.value.set(_chest.x, _chest.y, _chest.z, 1 - (cam.shotW || 0));
  // 植被和阴影围着人；俯视时往前挪一点
  const k = 7 * (1 - cam.zoom);
  focus.set(J.p.x + Math.sin(J.yaw) * k, J.mode === 'fly' ? J.p.y : J.p.y, J.p.z + Math.cos(J.yaw) * k);
  placeSun(focus);
  W.update(camera, focus, dt);
  windmill.userData.update(dt);
  // 萤火虫：夜里才有
  const px = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360));
  fireflies.userData.update(J.p, Math.min(1, Math.max(0, (J.night - 0.3) / 0.5)) * (1 - W.land.snow(J.p.x, J.p.z)), px);
  // 红叶谷的落叶、雪线上的雪花
  falling.userData.update(J.p, px, dt);
  syncUI();
  saveT += dt;
  if (saveT > 15) { saveT = 0; save(); }
}
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const rdt = clock.getDelta(), dt = Math.min(rdt, 1 / 20);
  step(dt);
  renderer.render(scene, camera);
  if (quality.frame(rdt)) showPerf();
}

// ---------- 旅人 ----------
// 翅膀挂在上背（spine_03），按身体的方向摆正
function attachWings(T) {
  const sp = T.bones.spine_03;
  T.root.position.set(0, 0, 0); T.root.quaternion.identity(); T.root.updateMatrixWorld(true);
  const qb = sp.getWorldQuaternion(new THREE.Quaternion()), pb = sp.getWorldPosition(new THREE.Vector3()), sb = sp.getWorldScale(new THREE.Vector3());
  sp.add(wings.group);
  wings.group.quaternion.copy(qb).invert();
  wings.group.position.copy(sp.worldToLocal(pb.clone().add(new THREE.Vector3(0, 0.04, -0.13))));
  wings.base = 1 / sb.x;
  wings.group.scale.setScalar(wings.base * 0.35);
}
async function loadTraveler(k) {
  if (!travelers[k]) travelers[k] = makeTraveler(RES + `traveler-${k}.glb`);
  return travelers[k];
}
async function useTraveler(k) {
  if (k === travKey && J?.T === await travelers[k]) return;
  travKey = k;
  ui.busy('正在换人…');
  try {
    const T = await loadTraveler(k);
    if (travKey !== k) return;
    if (J && J.T !== T) { scene.remove(J.T.root); scene.add(T.root); attachWings(T); J.setTraveler(T); }
  } catch (e) { console.warn('[j] traveler', e); }
  ui.ready();
}

// ---------- 加载 ----------
async function load() {
  const say = t => ui.loading(t);
  const q0 = P.get('q') || 'high';
  // 先开始下载人和坐骑
  const travP = loadTraveler(travKey);
  const horseP = loadAnimal(RES + 'horseA.glb').catch(e => { console.warn('[j] horse', e); return null; });
  const donkeyP = loadAnimal(RES + 'donkey.glb').catch(e => { console.warn('[j] donkey', e); return null; });
  W = await buildWorld(renderer, scene, q0, say, { yieldFn: nextFrame });
  const daylight = new DayLight({ sun, hemi, renderer, water: W.stream });
  fireflies = makeFireflies(W.land); scene.add(fireflies);
  falling = makeFalling(W.land); scene.add(falling);
  say('正在搭桥、种栅栏…');
  await nextFrame();
  const bridge = buildBridge(W.land); scene.add(bridge.mesh);
  windmill = buildWindmill(W.land); scene.add(windmill);
  const fences = buildFences(W.land); scene.add(fences);
  const campP = buildCamp(W.land, RES);
  say('正在牵马…');
  await nextFrame();
  const [camp, horseG, donkeyG, T] = await Promise.all([campP, horseP, donkeyP, travP]);
  const mounts = { b: makeHorseB(), a: null, w: null, d: null };
  if (horseG) { mounts.a = makeHorseA(horseG, 'a'); mounts.w = makeHorseA(horseG, 'w'); }
  if (donkeyG) mounts.d = makeHorseA(donkeyG, 'd');
  scene.add(camp, T.root);
  for (const M of Object.values(mounts)) if (M) scene.add(M.root);
  ui.setMounts(MOUNT_ORDER.filter(k => mounts[k]).map(k => ({ key: k, name: MOUNT_INFO[k].name, desc: MOUNT_INFO[k].desc })));
  wings = makeWings(); attachWings(T);
  const reins = makeReins(); scene.add(reins);
  // 挡路的东西：树干、风车、营地、栅栏
  const colliders = new Colliders();
  for (const t of W.placed.trees) if (!t.far) { const pine = t.t.startsWith('Pine'); colliders.addCircle(t.x, t.z, (pine ? 0.32 : 0.4) * t.s, 7 * t.s, (pine ? 1.7 : 0.75) * t.s); }
  colliders.addCircle(62, -118, 2.5, 11);
  for (const [x, z, r] of camp.userData.blocks) colliders.addCircle(x, z, r, 2);
  for (const [ax, az, bx, bz] of fences.userData.segs) colliders.addSeg(ax, az, bx, bz, 0.08, 1.2);
  for (const [x, z, r] of fences.userData.posts) colliders.addCircle(x, z, r, 2);
  cam = new CamRig(camera, (x, z) => W.land.height(x, z));
  cam.blocker = (ax, az, bx, bz) => colliders.firstHit(ax, az, bx, bz);
  sound = new Sound(RES);
  quality = new Quality(applyTier, q0);
  if (SHOT || P.has('q')) quality.mode = q0;
  applyTier(quality.tier);
  J = new Journey({ land: W.land, bridge, camp, mounts, traveler: T, wings, reins, cam, sound, ui, camera, sun, hemi, colliders, daylight });
  if (P.has('debug')) { window.__J = J; window.__scene = scene; window.__TRAIL = TRAIL; }   // 调试：测试脚本读状态
  J.onCamp = showSummary;
  J.onVisit = () => save();
  if (saved) { try { J.restore(saved); ui.resume(resumeText(saved)); } catch (e) { console.warn('[j] restore', e); clearSave(); } }
  const k0 = P.get('mount'); if (k0 && mounts[k0]) J.startWith(k0);
  ui.setPick(J.mountKey);
  for (const b of document.querySelectorAll('#whoPick button')) b.classList.toggle('on', b.dataset.t === travKey);
  // 先跑几步让人、马、镜头和植被就位，再提前编译着色器（免得一开始卡一下）
  for (let i = 0; i < 6; i++) step(1 / 30);
  W.update(camera, focus, 0, true);
  say('正在准备画面…');
  wings.group.visible = true;    // 翅膀的着色器也提前编译
  try { await renderer.compileAsync(scene, camera); } catch { renderer.compile(scene, camera); }
  wings.group.visible = false;
}

// 截图模式：直接摆到指定位置，模拟几秒，渲染三帧
function shotSetup() {
  document.body.classList.add('playing');
  if (P.get('hud') === '0') document.getElementById('hud').style.display = 'none';
  const view = P.get('cam') || 'travel';
  if (view !== 'intro') { playing = true; J.begin(); cam.shot = null; }
  // 位置：某个地点、坐标，或者路上的路程 s
  const pl = P.get('place') && J.places.find(p => p.id === P.get('place'));
  let x = J.p.x, z = J.p.z, yaw = J.yaw;
  if (pl && pl.x !== undefined) { x = pl.x; z = pl.z; }
  if (P.has('s')) { const p = ROAD.at(+P.get('s'), {}); x = p.x; z = p.z; yaw = Math.atan2(p.tx, p.tz); }
  if (P.has('x')) x = +P.get('x'); if (P.has('z')) z = +P.get('z');
  if (P.has('ry')) yaw = +P.get('ry') * Math.PI / 180;
  const mode = P.get('mode') || 'ride';
  J.teleport(x, z, yaw, mode, +(P.get('alt') || 30));
  const v = +(P.get('v') || 0);
  if (v) {
    J.holding = true;
    const list = mode === 'ride' ? J.mount.gaits : GAITS[mode].map(g => g.v);
    J.gait = list.findIndex(g => g >= v - 0.01); if (J.gait < 0) J.gait = 2;
  }
  // 时间：tod=钟点（0~24）；dusk=0~1 是以前的黄昏参数（下午四点半到六点半）
  if (P.has('dusk')) { J.tod = START_TOD + +P.get('dusk') * 1.9; J.applyDay(0); }
  if (P.has('tod')) { J.tod = +P.get('tod'); J.applyDay(0); }
  if (P.get('act') === 'takeoff') J.setMode('fly');
  if (P.get('act') === 'land') J.setMode('foot');
  if (P.get('act') === 'dismount') J.setMode('foot');
  if (P.get('act') === 'call') { J.setMode('foot'); }
  if (P.get('act') === 'sit') J.doSit();
  if (view === 'top') cam.zoom = cam.zoomTarget = 1;
  if (P.get('auto')) J.auto = true;
  if (P.has('yaw')) { cam.yawOff = +P.get('yaw'); cam.yawHold = 1e9; }
  if (P.has('pitch')) { cam.pitchOff = +P.get('pitch'); cam.pitchHold = 1e9; }
  const sim = +(P.get('sim') || 2.5);
  const act2 = P.get('act2'), at2 = +(P.get('at2') || 1);
  let did2 = false;
  // strip=0.5,1,2：在这几个时刻各拍一张，拼成一张图（看动作过程）
  const strip = P.get('strip') ? P.get('strip').split(',').map(Number) : null;
  let sc = null, sctx = null, si = 0;
  if (strip) {
    sc = document.createElement('canvas'); sc.width = innerWidth; sc.height = innerHeight;
    Object.assign(sc.style, { position: 'fixed', left: 0, top: 0, width: '100%', height: '100%', zIndex: 99 });
    document.body.appendChild(sc); sctx = sc.getContext('2d');
  }
  const cols = strip ? Math.ceil(Math.sqrt(strip.length)) : 1, rows = strip ? Math.ceil(strip.length / cols) : 1;
  const end = strip ? Math.max(...strip) + 1e-3 : sim;
  for (let t = 0; t < end; t += 1 / 30) {
    if (act2 && !did2 && t >= at2) { did2 = true; if (act2 === 'release') J.holding = false; else if (act2.startsWith('mount:')) J.pickMount(act2.slice(6)); else J.setMode(act2); }
    step(1 / 30);
    if (strip && si < strip.length && t + 1 / 30 >= strip[si]) {
      W.update(camera, focus, 0, true); renderer.render(scene, camera);
      const w = innerWidth / cols, h = innerHeight / rows, x = (si % cols) * w, y = Math.floor(si / cols) * h;
      sctx.drawImage(renderer.domElement, x, y, w, h);
      sctx.fillStyle = '#fff'; sctx.font = '14px sans-serif'; sctx.fillText(`${strip[si]}s ${J.mode}${J.trans ? '/' + J.trans.kind : ''} y=${(J.alt || 0).toFixed(1)}`, x + 6, y + 18);
      si++;
    }
  }
  W.update(camera, focus, 0, true);
  if (P.has('bench')) {   // 测 CPU：每帧逻辑、植被刷新各要多久
    let t0 = performance.now(); for (let i = 0; i < 60; i++) step(1 / 60); const stepMs = (performance.now() - t0) / 60;
    t0 = performance.now(); for (let i = 0; i < 10; i++) W.update(camera, focus, 0, true); const layerMs = (performance.now() - t0) / 10;
    t0 = performance.now(); for (let i = 0; i < 60; i++) J.update(1 / 60); const jMs = (performance.now() - t0) / 60;
    window.__bench = { stepMs: +stepMs.toFixed(2), layerMs: +layerMs.toFixed(2), journeyMs: +jMs.toFixed(2) };
  }
  // 特写机位：从旁边、前面看人（和坐骑）
  if (view === 'side' || view === 'front' || view === 'close' || view === 'back') {
    const hp = J.T.root.position.clone(); if (J.mode === 'fly') hp.copy(J.p);
    const a = J.yaw, f = new THREE.Vector3(Math.sin(a), 0, Math.cos(a)), r = new THREE.Vector3(-f.z, 0, f.x);
    const d = +(P.get('d') || (view === 'close' ? 2.6 : 3.8)), up = J.mode === 'ride' ? 1.25 : 1.0;
    if (view === 'front') camera.position.copy(hp).addScaledVector(f, d).addScaledVector(r, 1.2).add(new THREE.Vector3(0, up + 0.2, 0));
    else if (view === 'back') camera.position.copy(hp).addScaledVector(f, -d).addScaledVector(r, 0.8).add(new THREE.Vector3(0, up + 0.5, 0));
    else camera.position.copy(hp).addScaledVector(r, view === 'close' ? -d : d).addScaledVector(f, 0.2).add(new THREE.Vector3(0, up, 0));
    camera.lookAt(hp.x, hp.y + (J.mode === 'fly' ? 0 : up - 0.3), hp.z); camera.updateMatrixWorld();
  }
  if (view === 'sit') {
    const c = J.camp.userData.seat, f = J.camp.userData.fireAt;
    const d = new THREE.Vector3().subVectors(f, c).setY(0).normalize(), r = new THREE.Vector3(-d.z, 0, d.x);
    camera.position.copy(c).addScaledVector(d, 1.6).addScaledVector(r, 1.4).add(new THREE.Vector3(0, 1.0, 0));
    camera.lookAt(c.x, c.y + 0.45, c.z); camera.updateMatrixWorld();
  }
  let n = 0;
  const one = () => {
    renderer.render(scene, camera);
    if (++n < 3) requestAnimationFrame(one);
    else {
      const V = o => { const v = new THREE.Vector3(); o.getWorldPosition(v); return v.toArray().map(x => +x.toFixed(2)); };
      window.__info = { ms: W.ms, flora: { trees: W.stats.trees, small: Object.values(W.stats.small).reduce((a, b) => a + b, 0), tufts: W.placed.tufts.reduce((a, t) => a + t.length / 8, 0) }, bench: window.__bench, calls: renderer.info.render.calls, tris: renderer.info.render.triangles, mode: J.mode, trans: J.trans?.kind || null,
        p: J.p.toArray().map(x => +x.toFixed(2)), yaw: +J.yaw.toFixed(2), speed: +J.speed.toFixed(2), alt: +(J.alt || 0).toFixed(1), mount: J.mountKey,
        mountAt: J.mount ? V(J.mount.root) : null, pelvis: J.T.pelvis(new THREE.Vector3()).toArray().map(x => +x.toFixed(2)), visited: J.visited, cam: camera.position.toArray().map(x => +x.toFixed(1)) };
      window.__ready = true;
    }
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
