// 旅途 · 第一段「暖光谷地」：入口。加载世界、道具、几匹坐骑、旅人和翅膀，接上界面、声音、画质和每帧循环。
import { Post } from './world/post.js';
import * as THREE from 'three';
import { U, installGrade } from './world/atmo.js';
import { ROAD, SPOTS, TRAIL } from './world/route.js';
import { buildWorld, RES } from './world/world.js';
import { buildBridge, buildWindmill, buildFences, buildCamp } from './world/props.js';
import { buildLighthouse } from './world/lighthouse.js';
import { Weather, WEATHERS, wxName } from './world/weather.js';
import { makeHorseB, makeHorseA, loadAnimal, makeReins, MOUNT_INFO } from './actors/actors.js';
import { makeTraveler } from './actors/traveler.js';
import { makeWings } from './actors/wings.js';
import { CamRig } from './game/cam.js';
import { Sound } from './game/audio.js';
import { Journey, Colliders, GAITS, START_TOD } from './game/journey.js';
import { Quality, TIERS, isDesktop } from './game/quality.js';
import { installShadows } from './world/shadows.js';
import { initUI } from './game/ui.js';
import { DayLight, periodOf } from './world/daytime.js';
import { SKY } from './world/sky.js';
import { makeFireflies } from './world/fireflies.js';
import { makeFalling } from './world/particles.js';
import { Tread } from './world/tread.js';
import { makeThermals } from './world/thermals.js';
import { makeForage, makePot } from './world/forage.js';
import { CookUI } from './game/cookui.js';
import { Feathers, WISHES, canGive, give, wishText } from './game/feathers.js';
import { BUFFS, mmss } from './game/cook.js';
import { Ripples } from './world/ripples.js';
import { makePuffs } from './world/puffs.js';
import { loadSave, writeSave, clearSave } from './game/save.js';
import { MapView } from './game/map.js';
import { makeBeacon } from './world/beacon.js';
import { Album } from './game/photos.js';
import { Journal } from './game/journal.js';
import { PhotoMode } from './game/photo.js';
import { Wildlife } from './world/wildlife.js';
import { Birds } from './world/birds.js';
import { buildVistas } from './world/vistas.js';
import { makeSkyFx } from './world/skyfx.js';
import { MIRROR_U, buildMirrorProps } from './world/mirror.js';
import { buildSprings } from './world/springs.js';
import { Folk } from './game/folk.js';
import { FINDS, findOf } from './game/finds.js';
import { VISTAS } from './world/route.js';

const P = new URLSearchParams(location.search);
// 无头截图模式：?shot=1&place=地点|x=&z=&ry=朝向&mode=foot|ride|fly&mount=a|b|w|d&trav=m|f&v=速度&alt=高度&sim=秒&cam=travel|top|intro|side|front|close
const SHOT = P.has('shot'), DEBUG = P.has('debug');
if (SHOT) document.body.classList.add('shot');
const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));
const MOUNT_ORDER = ['b', 'a', 'w', 'd'];

installGrade();
const farOK = installShadows();
// 柔光和暗角（后期）：只在画质「高」（手动选「中」也算）时开；手机不支持或帧数不够降档了就直接画，不多这一遍
let post = null, postOn = false;
const draw = () => {
  // 镜之原的倒影：看得见那片水的时候，先从水面下面把世界画一遍
  if (W?.mirror) W.mirror.userData.update(renderer, scene, camera, quality?.tier !== 'low' && P.get('mirror') !== '0', quality?.tier === 'ultra' ? 0.75 : 0.6);
  if (post && postOn) post.render(scene, camera); else renderer.render(scene, camera);
};
const canvas = document.getElementById('c');
// 上次没打开（手机内存不够页面被系统关掉、显卡掉线）：这次自动低一档画质开，一直不行就降到「低」。
// 打开前记一笔，玩稳了（开始走 15 秒，或停在开始画面 60 秒）或自己离开页面才擦掉；没擦掉就说明上次是半路死掉的。
const BOOT = 'journey.boot', SAFE = 'journey.q.safe';
let bootFails = 0, safeQ = null, safeMsg = '';
try { const b = JSON.parse(localStorage.getItem(BOOT) || 'null'); if (b && Date.now() - b.t < 30 * 60e3) bootFails = b.n | 0; safeQ = localStorage.getItem(SAFE); } catch {}
const markBoot = n => { try { localStorage.setItem(BOOT, JSON.stringify({ t: Date.now(), n })); } catch {} };
let lost = false;     // 显卡掉线、正要重开：这时离开页面不算“自己离开”
const clearBoot = () => { if (lost) return; try { localStorage.removeItem(BOOT); } catch {} };
if (!SHOT) {
  markBoot(bootFails + 1);
  addEventListener('pagehide', clearBoot);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearBoot(); else { markBoot(1); bootOkT = 0; } });
}
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: SHOT });
renderer.toneMapping = THREE.CustomToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
if (P.get('fx') !== '0') { post = new Post(renderer); if (!post.ok) post = null; }

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.3, 7000);
camera.layers.enable(1);      // 第 1 层：水和排在水后面画的东西（极高画质时分两遍画，见 world/post.js）
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

let lighthouse = null, weather = null;
let W = null, J = null, cam = null, sound = null, quality = null, windmill = null, wings = null, fireflies = null, falling = null, playing = false;
let mapView = null, beacon = null, journal = null, photo = null;
let springs = null, wildlife = null, birds = null, folk = null, vistas = null, skyfx = null, fx = null, thermals = null, forage = null, cookUI = null, quests = null;
const album = new Album();
// 每个地方的封面照片（没设就用第一张）；照片和封面都不跟着“从头再来”清掉
let covers = {};
try { covers = JSON.parse(localStorage.getItem('journey.covers') || '{}') || {}; } catch {}
const travelers = {};          // m / f：选到哪个才加载哪个
// 存档：截图模式不读不写
const saved = SHOT || P.has('fresh') ? null : loadSave();
let travKey = P.get('trav') === 'f' || (!P.has('trav') && saved?.trav === 'f') ? 'f' : 'm';
const focus = new THREE.Vector3();

// ---------- 画质 ----------
function applyTier(tier) {
  const T = TIERS[tier];
  // 清晰度：自动模式下帧数不够只减草木和阴影，画面不变糊；只有手动选「中」「低」才降
  renderer.setPixelRatio(Math.min(devicePixelRatio, quality?.mode === 'auto' ? TIERS.high.pr : T.pr)); setSize();
  SKY.uDpr.value = renderer.getPixelRatio();
  sun.shadow.mapSize.set(T.shadow, T.shadow);
  if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  const c = sun.shadow.camera; c.left = c.bottom = -T.shadowR; c.right = c.top = T.shadowR; c.updateProjectionMatrix();
  U.uShadowRadius.value = T.shadowR; U.uFine.value = tier === 'low' ? 0 : 1;
  U.uGust.value.z = (tier === 'ultra' || tier === 'high') && P.get('gust') !== '0' ? 1 : 0;
  postOn = tier === 'ultra' || tier === 'high' || (tier === 'mid' && quality?.mode !== 'auto');
  // 极高：远处的真影子、贴地的暗
  if (post) { post.setAO(!!T.ao && P.get('ao') !== '0'); post.aoDebug = P.get('ao') === 'show'; post.setWater(!!T.water && P.get('ssr') !== '0'); }
  if (W) { if (P.get('meadow') === '0') W.meadowOff = true; W.farShadow.set(!!T.far && farOK && P.get('far') !== '0', T.far?.R, T.far?.size); W.setQuality(tier); W.update(camera, focus, 0, true); }
  // 极高：林间光柱（要有远影那张图才做得出来）
  if (post && W) { post.setRays(!!T.rays && W.farShadow.on && P.get('rays') !== '0', W.farShadow.light); post.rayDebug = P.get('rays') === 'show'; if (P.has('rayk')) post.rayK = +P.get('rayk'); if (P.has('rayb')) post.rayBase = +P.get('rayb'); }
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
  W.farShadow.update(center, _sz);
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
  stick: (v, key) => {
    if (!J || !playing) return;
    if (v && key && (journal?.isOpen || mapView?.isOpen || photo?.active)) return;
    J.setStick(v, key);
    if (v && !hintTimer) hintTimer = setTimeout(() => ui.hint(''), 1800);
  },
  // 空格 / 圆按钮：跳、展翅、蹬开、扇翅膀
  act: on => { if (!J || !playing) return; if (on && (journal?.isOpen || mapView?.isOpen || photo?.active)) return; J.act(on); },
  flyKey: () => { if (J && playing) J.setMode(J.uiMode === 'fly' ? 'foot' : 'fly'); },
  say: t => { if (J && playing) J.say(t, 2); },
  // Esc：关掉开着的那一层（拍照、手记、地图）
  escape: () => { if (photo?.active) photo.exit(); else if (journal?.isOpen) journal.close(); else if (cookUI?.isOpen) cookUI.close(); else if (mapView?.isOpen) mapView.close(); },
  wheel: d => { if (cam && playing && !photo?.active) cam.distK = Math.min(2.6, Math.max(0.55, cam.distK * Math.exp(d * 0.0012))); },
  setFree: on => setFree(on, true),
  setCtl: c => setCtl(c, true),
  zoom: () => cam?.zoomTarget ?? 0,
  setZoom: (z, done) => { if (!cam) return; cam.zoomTarget = z; if (done) ui.tool('bCam', z > 0.5); },
  gait: i => { if (!J) return; J.gait = i; ui.gait(i); },
  mode: m => { if (J && playing) J.setMode(m); },
  action: t => { if (t === '坐下烤火' || t === '点起篝火') J?.sitAtCamp(); else if (t === '打个招呼') greet(); else if (J?.pickNear() || quests?.act(J)) save(); },
  toggleAuto: () => { if (!J) return; J.auto = !J.auto; ui.tool('bAuto', J.auto); if (J.auto) ui.hint(''); },
  toggleCam: () => { if (!cam) return; cam.zoomTarget = cam.zoomTarget > 0.5 ? 0 : 1; ui.tool('bCam', cam.zoomTarget > 0.5); },
  toggleSound: () => { if (!sound) return; sound.setMuted(!sound.muted); ui.tool('bSound', !sound.muted); },
  cycleQuality: () => { if (!quality) return; quality.cycle(); showPerf(); },
  // 手记、拍照、营地歇脚
  openJournal: () => { if (!J || !playing || !journal || photo?.active) return; if (journal.isOpen) { journal.close(); return; } if (mapView?.isOpen) mapView.close(); J.holding = false; journal.open(); },
  photo: () => { if (!photo) return; if (photo.active) { photo.exit(); return; } if (!J || !playing || J.phase === 'intro' || mapView?.isOpen) return; ui.photo(); },
  restUntil: at => {
    if (!J?.sitting || J.sitTo !== null || sleeping) return;
    if (at < 6 && (J.tod >= 19.5 || J.tod < 5)) {
      // 夜里选清晨：暗下来睡一觉
      sleeping = true; ui.fade(true);
      setTimeout(() => { J.sleep(); ui.fade(false); sleeping = false; ui.banner(`第 ${J.dayN} 天`, '天亮了，火还温着', 3.5); save(); }, 1100);
      return;
    }
    J.restUntil(at);
  },
  restAct: a => {
    if (!J?.sitting) return;
    if (a === 'photo') return ui.photo();
    if (a === 'cook') { if (J.sitTo === null && !sleeping) { cookUI.open(); document.body.classList.add('cooking'); } return; }
    if (a === 'journal') return journal.open();
    if (a === 'up') { ui.rest(null); J.standUp(); ui.hint(ui.goHint()); save(); }
  },
  skipTime: () => { if (J && playing) J.skipTime(); },
  // 天气：随天 → 晴 → 多云 → 小雨 → 起雾 → 下雪 → 随天
  cycleWeather: () => {
    if (!J || !playing || !weather) return;
    const ids = [null, ...WEATHERS.map(w => w.id)], i = ids.indexOf(weather.lock);
    const next = ids[(i + 1) % ids.length];
    weather.set(next);
    if (!next) weather.nextH = 1.5 + Math.random() * 2;
    ui.hint(next ? `天气定成了「${wxName(next)}」，再点换一种` : '天气又跟着天变了');
    clearTimeout(cycleHintT); cycleHintT = setTimeout(() => ui.hint(''), 2600);
    save();
  },
  // 地图：打开时游戏停下来（不画 3D），关上接着走
  openMap: id => { if (!J || !playing || !mapView) return; if (mapView.isOpen) { mapView.close(); return; } J.holding = false; mapView.open(id); },
  // 开始卡片上的“从头开始”：不用存档
  fresh: () => {
    if (!J || playing) return;
    clearSave(); J.fresh(); ui.resume(null); ui.setPick(J.mountKey);
  },
});
ui.tool('bSound', true);
let sleeping = false;
const buffList = [];
// 操作方式：默认方向盘，记在本机
function setCtl(c, user) {
  c = c === 'hold' ? 'hold' : 'stick';
  if (user) try { localStorage.setItem('journey.ctl', c); } catch {}
  J?.setCtl(c); ui.ctl(c);
  if (user && playing && J && !J.auto) { clearTimeout(hintTimer); hintTimer = 0; ui.hint(ui.goHint()); }
}
// 气力会不会用完（自在模式：什么都不耗气力），记在本机
function setFree(on, user) {
  if (user) try { localStorage.setItem('journey.free', on ? '1' : '0'); } catch {}
  if (J) { J.stamina.free = !!on; if (on) J.stamina.fill(); }
  ui.free(!!on);
}
let freePref = false;
try { freePref = localStorage.getItem('journey.free') === '1'; } catch {}
ui.free(freePref);
let ctlPref = 'stick';
try { ctlPref = localStorage.getItem('journey.ctl') || 'stick'; } catch {}
ui.ctl(ctlPref === 'hold' ? 'hold' : 'stick');

// 走法、步态名字和坐骑在界面上同步（切换要过渡一会儿，所以每帧看一下）
let shownMode = '', shownMount = '', shownGait = -1;
let cycleHintT = 0;
function syncUI() {
  const m = J.uiMode, k = J.mountKey;
  if (m !== shownMode || k !== shownMount) {
    shownMode = m; shownMount = k;
    ui.mode(m);
    ui.gaitNames(m === 'ride' ? J.mount.gaitNames : GAITS[m].map(g => g.name));
    ui.mountChanged(k);
    shownGait = -1;
  }
  if (J.gait !== shownGait) {
    shownGait = J.gait; ui.gait(J.gait);
    const names = m === 'ride' ? J.mount.gaitNames : GAITS[m].map(g => g.name);
    ui.stickGait(names?.[J.gait] || '');
  }
  ui.time(periodOf(J.ff ? J.ff.to : J.tod).name, !!J.ff || (J.sitting && J.sitTo !== null));
  ui.actA(J.actName);
  if (weather) ui.weather(wxName(weather.id), !!weather.lock);
  // 坐在火边：下面一张小卡片，选歇到什么时候、拍照、看手记、起身
  ui.rest(J.sitting && J.campT > 1.2 && !photo?.active && !journal?.isOpen ? restState() : null);
}
const REST_TO = [{ name: '清晨', at: 5.7 }, { name: '正午', at: 12 }, { name: '黄昏', at: 17.6 }, { name: '夜里', at: 20.8 }];
let campMsg = null;
function restState() {
  const S = J.site, P = J.places.find(p => p.id === S.id), cur = J.tod, busy = J.sitTo !== null || sleeping;
  const ahead = o => (o.at - cur + 24) % 24;
  const times = REST_TO.filter(o => ahead(o) > 0.6 && ahead(o) < 23.4).sort((a, b) => ahead(a) - ahead(b))
    .map(o => ({ name: o.name, at: o.at, sleep: o.at < 6 && (cur >= 19.5 || cur < 5) }));
  return { name: P ? P.name : '营地', sub: `第 ${J.dayN} 天 · ${periodOf(cur).name}${busy ? ' · 时间慢慢过去…' : ''}`, msg: campMsg && campMsg.id === S.id ? campMsg.t : '', times, busy };
}

// ---------- 见闻 ----------
// 某样见闻在地图上的位置：观景点、人待的地方、动物第一次遇见的地方（没遇见过就是它常去的第一处）
function markOf(id) {
  const F = findOf(id); if (!F || !J) return null;
  if (F.kind === 'vista') return VISTAS.find(v => v.id === id);
  if (F.kind === 'folk') { const P = folk?.list.find(f => f.id === id); return P ? (P.path ? folk.where({ ...P, o: null }) : P) : null; }
  if (F.kind !== 'animal') return null;
  const f = J.found[id]; if (f && Number.isFinite(f.x)) return f;
  if (id === 'birds') return birds?.flocks[0];
  if (id === 'gull') return birds?.coasts[0];
  return wildlife?.habitats.find(H => H.sp === id) || null;
}
// 某处附近藏着的见闻（在观景点上望见）
function nearFinds(x, z, R) {
  const out = [];
  for (const F of FINDS) {
    if (F.kind === 'sky' || J.found[F.id]) continue;
    const spots = F.kind === 'animal' ? (F.id === 'birds' ? birds.flocks : F.id === 'gull' ? birds.coasts : wildlife.habitats.filter(H => H.sp === F.id)) : [markOf(F.id)];
    if (spots.some(m => m && Math.hypot(m.x - x, m.z - z) < R && Math.hypot(m.x - x, m.z - z) > 12)) out.push(F.id);
  }
  return out;
}
// 走到人跟前打招呼：第一次两句话都说完（顺便告诉你哪里有好东西），以后随便说一句
function greet() {
  const F = J?.nearFolk; if (!F || !F.o) return;
  const f0 = J.found[F.id], n = f0?.n || 0;
  let line = folk.greet(F, n === 0 ? 0 : 1);
  if (n === 0) line = F.lines.join('');
  J.discover(F.id, true, F.path ? folk.where(F) : F);
  J.found[F.id].n = n + 1;
  let note = '';
  const k = J.tip(F.tips);
  if (k) note = F.tips.some(id => !J.found[id] && findOf(id)?.kind !== 'sky') ? '他说的地方，地图上标出来了' : '记进了手记的「见闻」';
  if (n === 0) note = '新的见闻 · 偶遇的人' + (note ? ' · ' + note : '');
  // 心愿：他想要的东西带来了就给他，换一根风羽；没带就再提一句
  const W = WISHES[F.id];
  if (W && !J.feathers.has(W.id)) {
    if (J.wishes.has(W.id) && canGive(J, W)) { give(J, W); line = W.thanks; note = `给了他${wishText(W)}`; setTimeout(() => J.award(W.id), 1600); }
    else { line = (n === 0 ? line : '') + W.ask; note = (note ? note + ' · ' : '') + (J.wishes.has(W.id) ? `他想要${wishText(W)}` : `他的心愿记进了手记的「行囊」页：${wishText(W)}`); J.wishes.add(W.id); }
  }
  ui.talk(findOf(F.id).name, line, note);
  sound.chime?.(0.35);
  save();
}
// 拍照：画面里有哪些动物、人，还有彩虹
function subjects(camera) {
  const out = new Set();
  wildlife?.inView(camera)?.forEach(id => out.add(id));
  birds?.inView(camera, out); folk?.inView(camera, out);
  if (skyfx && skyfx.userData.aurora > 0.5) { const f = new THREE.Vector3(); camera.getWorldDirection(f); if (f.z < -0.2 && f.y > -0.3) out.add('aurora'); }
  if (J.starsea) out.add('starsea');
  if (skyfx && skyfx.userData.rainbow > 0.35) { const f = new THREE.Vector3(); camera.getWorldDirection(f); if (f.dot(_anti.copy(J.daylight.sunPos).negate().normalize()) > 0.45) out.add('rainbow'); }
  return out;
}
const _anti = new THREE.Vector3();

// ---------- 存档 ----------
let saveT = 0;
function save() {
  if (!J || SHOT || !playing || J.phase === 'intro') return;
  writeSave({ ...J.snapshot(), trav: travKey });
}
// 地图上点“去这里”：一暗一亮，直接过去
function travel(place) {
  if (!J.canTravel()) return;
  ui.fade(true);
  setTimeout(() => {
    if (!J.travelTo(place)) { ui.fade(false); return; }
    for (let i = 0; i < 4; i++) step(1 / 30);
    W.update(camera, focus, 0, true);
    ui.fade(false); ui.banner(place.name, place.sub, 3.5); save();
  }, 850);
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
  ui.hint(ui.goHint());
  setTimeout(() => wildlife?.preload(), 4000);
  wake();
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
  W.sea.userData.update(U.uTime.value);
  // 镜之原：没风的时候水面几乎是平的；阴天、下雨、下雪就皱起来；温泉的白汽夜里暗下来
  MIRROR_U.uRough.value = 0.012 + 0.03 * weather.k.o + 0.07 * Math.max(weather.k.r, weather.k.s * 0.6); MIRROR_U.uRain.value = weather.k.r;
  springs.userData.steamColor.setScalar(0.1 + 0.87 * (1 - J.night));
  lighthouse.userData.update(dt, Math.min(1, Math.max(0, (0.1 - J.daylight.sunPos.y) / 0.16)), Math.max(weather.k.f, weather.k.r * 0.8, weather.k.o * 0.5));
  // 萤火虫：夜里才有
  const px = J.px = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360));
  fireflies.userData.update(J.p, Math.min(1, Math.max(0, (J.night - 0.3) / 0.5)) * (1 - W.land.snow(J.p.x, J.p.z)), px);
  // 红叶谷的落叶、雪线上的雪花
  falling.userData.update(J.p, px, dt);
  fx.puffs.update(px);
  thermals.userData.update(px);
  forage.userData.update(px);
  quests.update(dt, J, px);
  ui.stamina(J.stamina, dt);
  // 身上的好处：暖和、脚步轻…（还剩多久），冷的时候也说一声
  buffList.length = 0;
  if (J.cold) buffList.push({ t: '冷 · 气力回得慢', c: 'cold' });
  for (const k in J.buffs) if (J.buffs[k] > 0) buffList.push({ t: `${BUFFS[k].name} ${mmss(J.buffs[k])}` });
  ui.buffs(buffList);
  // 标记点：屏幕上方的箭头（相对镜头朝向）和远处的光柱
  const w = playing ? J.waypoint : null;
  if (w) {
    const dx = w.x - J.p.x, dz = w.z - J.p.z, f = cam.fwd;
    ui.way(w, Math.atan2(dx * -f.z + dz * f.x, dx * f.x + dz * f.z), Math.hypot(dx, dz));
  } else ui.way(null);
  beacon.userData.update(w, W.land, camera.position, dt);
  // 路上的动物、鸟、人、观景点的灯、彩虹和流星
  {
    const f = cam.fwd3 || (cam.fwd3 = new THREE.Vector3()); camera.getWorldDirection(f);
    const wx = weather.id, ctx = { p: J.p, speed: J.mode === 'fly' ? 0 : J.speed, fly: J.mode === 'fly', alt: J.alt || 0, tod: J.tod, wx, camPos: camera.position, camFwd: f, onScare: () => sound.flutter?.(0.6) };
    if (J.phase !== 'intro') { wildlife.update(dt, ctx); birds.update(dt, ctx); folk.update(dt, ctx); }
    // 路过的小动物、路上的人也会把草压倒
    if (fx.on) {
      for (const A of wildlife.live) if (A.root.visible) fx.tread.stamp(A.p.x, A.p.z, 0.34, 0.85);
      for (const F of folk.list) if (F.o && F.o.root.visible) fx.tread.stamp(F.o.root.position.x, F.o.root.position.z, 0.45, 0.85);
    }
    vistas.userData.update(Math.min(1, Math.max(0, (0.12 - J.daylight.sunPos.y) / 0.18)));
    if (playing && skyfx.userData.aurora > 0.5 && !J.found.aurora) J.tell('aurora', '北边的天上亮起来了，抬头看看', 6);
    skyfx.userData.update({ camera, sunPos: J.daylight.sunPos, night: J.night, wx: weather, dt, camFwd: f, often: J.sitting || ['cape', 'lake', 'campLake', 'campBeach', 'vSnow', 'vCove', 'mirror', 'campMirror', 'springs'].includes(J.lastPlace?.id),
      day: J.dayN, cold: W.land.snow(J.p.x, J.p.z) > 0.4 || J.soaking });
  }
  // 地图底图趁空闲一点点画好
  if (playing && J.t > 3) mapView.idle();
  syncUI();
  saveT += dt;
  if (saveT > 15) { saveT = 0; save(); }
}
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const rdt = clock.getDelta(), dt = Math.min(rdt, 1 / 20);
  if (DEBUG && window.__freeze) return;     // 测试截图用：停在当前画面
  if (mapView?.isOpen) { mapView.tick(); return; }
  // 拍照：游戏停着，只摆镜头（风、水、火还在动）
  if (photo?.active) { U.uTime.value += dt; photo.frame(); J.campfire(dt); W.update(camera, focus, dt); draw(); return; }
  step(dt);
  draw();
  if (quality.frame(rdt)) showPerf();
  bootTick(Math.min(rdt, 0.5));
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
  // 旅人默认是用代码捏的（actors/sculpt.js）；?sculpt=0 换回原来的素材模型
  if (!travelers[k]) travelers[k] = makeTraveler(RES + `traveler-${k}.glb`, { sculpt: P.get('sculpt') !== '0', who: k });
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
  // 电脑从「极高」开始，手机从「高」开始（帧数不够会自己往下降）；截图默认还是「高」，好和以前的图对比
  // 这台电脑上次带不动「极高」自己降下来了，就记着，下次直接从降到的那档开始（再点回「自动」会重新试）
  let autoQ = null; try { autoQ = localStorage.getItem('journey.q.auto'); } catch {}
  let q0 = P.get('q') || (!SHOT && isDesktop() ? (TIERS[autoQ] ? autoQ : 'ultra') : 'high');
  // 上次半路死掉了：在上次的档位上再低一档，并记住（点画质按钮回到「自动」会清掉）

  if (!SHOT && !P.has('q')) {
    const ORDER = ['ultra', 'high', 'mid', 'low'];
    if (bootFails > 0) {
      const base = TIERS[safeQ] ? safeQ : q0;
      safeQ = ORDER[Math.min(ORDER.indexOf(base) + 1, ORDER.length - 1)];
      try { localStorage.setItem(SAFE, safeQ); } catch {}
      safeMsg = `上次没能打开，这次先用「${TIERS[safeQ].label}」画质（点右上角画质可以换回「自动」）`;
    }
    if (TIERS[safeQ]) q0 = safeQ;
  }
  // 先开始下载人和坐骑
  const travP = loadTraveler(travKey);
  const horseP = loadAnimal(RES + 'horseA.glb').catch(e => { console.warn('[j] horse', e); return null; });
  const donkeyP = loadAnimal(RES + 'donkey.glb').catch(e => { console.warn('[j] donkey', e); return null; });
  W = await buildWorld(renderer, scene, q0, say, { yieldFn: nextFrame });
  const daylight = new DayLight({ sun, hemi, renderer, water: W.stream });
  fireflies = makeFireflies(W.land); scene.add(fireflies);
  falling = makeFalling(W.land); scene.add(falling);
  // 脚下的反应：压倒的草、水圈、溅起来的水花尘土（?feel=0 关掉，对比用）
  fx = { tread: new Tread(), ripples: new Ripples(), puffs: makePuffs(), on: P.get('feel') !== '0' };
  fx.tread.on = fx.ripples.on = fx.puffs.on = fx.on;
  scene.add(fx.puffs.object);
  say('正在搭桥、种栅栏…');
  await nextFrame();
  const bridge = buildBridge(W.land); scene.add(bridge.mesh);
  windmill = buildWindmill(W.land); scene.add(windmill);
  const fences = buildFences(W.land); scene.add(fences);
  lighthouse = buildLighthouse(W.land); scene.add(lighthouse);
  vistas = buildVistas(W.land); scene.add(vistas);
  const mirrorProps = buildMirrorProps(W.land); scene.add(mirrorProps);
  springs = buildSprings(W.land); scene.add(springs);
  skyfx = makeSkyFx(); scene.add(skyfx);
  thermals = makeThermals(W.land); scene.add(thermals);
  weather = new Weather(); scene.add(weather.group); if (P.get('clouds') === '0') weather.cloudShadow = false;
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
  for (const t of W.placed.trees) if (!t.far) { const pine = t.t.startsWith('Pine'), bam = t.t === 'Bamboo'; colliders.addCircle(t.x, t.z, (bam ? 0.62 : pine ? 0.32 : 0.4) * t.s, (bam ? 9 : 7) * t.s, (bam ? 1.1 : pine ? 1.7 : 0.75) * t.s); }
  colliders.addCircle(62, -118, 2.5, 11);
  for (const [x, z, r] of camp.userData.blocks) colliders.addCircle(x, z, r, 2);
  for (const [x, z, r] of lighthouse.userData.blocks) colliders.addCircle(x, z, r, 16);
  for (const [x, z, r] of vistas.userData.blocks) colliders.addCircle(x, z, r, 3);
  for (const [x, z, r] of [...mirrorProps.userData.blocks, ...springs.userData.blocks]) colliders.addCircle(x, z, r, 3);
  // 这些东西脚下不长细草
  W.meadow.userData.clear(62, -118, 3);
  for (const [x, z, r] of [...camp.userData.blocks, ...lighthouse.userData.blocks, ...vistas.userData.blocks]) if (r > 0.5) W.meadow.userData.clear(x, z, r);
  for (const [ax, az, bx, bz] of fences.userData.segs) colliders.addSeg(ax, az, bx, bz, 0.08, 1.2);
  for (const [x, z, r] of fences.userData.posts) colliders.addCircle(x, z, r, 2);
  cam = new CamRig(camera, (x, z) => W.land.height(x, z));
  cam.blocker = (ax, az, bx, bz) => colliders.firstHit(ax, az, bx, bz);
  sound = new Sound(RES);
  quality = new Quality(applyTier, q0);
  quality.onAutoDrop = t => { try { if (t) localStorage.setItem('journey.q.auto', t); else { localStorage.removeItem('journey.q.auto'); localStorage.removeItem(SAFE); } } catch {} };
  if (SHOT || P.has('q')) quality.mode = q0;
  // 降到「低」还是打不开过：清晰度也降（自动模式平时不降清晰度）
  else if (TIERS[safeQ] && safeQ === 'low' && bootFails > 0) quality.mode = 'low';
  applyTier(quality.tier);
  if (!fx.on) { T.swayGain = 0; for (const M of Object.values(mounts)) if (M) { M.swayGain = 0; if (M.rig) M.rig.swayGain = 0; } }
  J = new Journey({ land: W.land, bridge, camp, mounts, traveler: T, wings, reins, cam, sound, ui, camera, sun, hemi, colliders, daylight, weather, focus, fx, thermals });
  J.stamina.free = freePref || (SHOT && !P.has('stamina'));
  // 路上能摘的东西、做饭的锅
  forage = makeForage(W.land, J.places); scene.add(forage); J.forage = forage;
  J.pot = makePot(); scene.add(J.pot);
  J.onItem = I => ui.found({ kind: 'item', name: I.name, sub: I.where }, 5);
  // 风羽：高处的羽毛、风环、风铃、石灯
  quests = new Feathers({ land: W.land, places: J.places, thermals: thermals.userData.list, sites: J.sites }); scene.add(quests.group); J.quests = quests; quests.refresh(J);
  J.onFeather = () => save();
  cookUI = new CookUI({ J, sound, onChange: () => save(), onClose: () => document.body.classList.remove('cooking') });
  J.setCtl(SHOT && !P.has('ctl') ? 'hold' : ctlPref);
  // 路上的动物、鸟、偶遇的人
  const water = (x, z) => J.waterDepth(x, z);
  wildlife = new Wildlife({ res: RES, groundAt: J.groundAt, water, colliders, places: J.places }); scene.add(wildlife.group);
  birds = new Birds({ groundAt: J.groundAt, water, places: J.places }); scene.add(birds.group);
  folk = new Folk({ res: RES, groundAt: J.groundAt, places: J.places, colliders, sculpt: P.get('sculpt') !== '0' && P.get('folkold') !== '1' }); scene.add(folk.group);
  J.folk = folk; J.nearFinds = nearFinds; J.onFind = () => save();
  const seen = (id, A) => { if (playing && J.phase !== 'intro') J.discover(id, false, A?.p); };
  wildlife.onSeen = seen; birds.onSeen = id => seen(id, id === 'birds' ? birds.flocks.reduce((a, F) => F.seen && !a ? F : a, null) : null);
  skyfx.userData.onSeen = id => seen(id);
  let fleeTold = false;
  wildlife.onFlee = () => { if (!fleeTold && playing && J.speed > 1) { fleeTold = true; setTimeout(() => ui.hint('动物怕快的东西，下次换成「散步」慢慢走过去'), 1200); J.hintT = 5; } };
  // 截图：先把动物和人的模型下载好（wild=1）
  if (SHOT && P.has('wild')) { wildlife.preload(); wildlife.load('snowfox'); folk.load('m'); folk.load('f'); await Promise.all([...Object.values(wildlife.loading), ...Object.values(folk.loading)]); }
  if (P.has('debug')) { window.__step = (dt, n = 1) => { for (let i = 0; i < n; i++) step(dt); W.update(camera, focus, 0, true); draw(); }; window.__wild = wildlife; window.__birds = birds; window.__folk = folk; window.__sky = skyfx; window.__forage = forage; window.__cook = cookUI; window.__quests = quests; }   // 截图沿用老镜头，参数好复现
  if (P.has('debug')) { window.__J = J; window.__scene = scene; window.__TRAIL = TRAIL; window.__R = renderer; window.__cam = camera; window.__W = W; window.__post = post; window.__draw = draw; window.__sun = sun; }   // 调试：测试脚本读状态
  beacon = makeBeacon(); scene.add(beacon);
  mapView = new MapView({
    land: W.land, trees: W.placed.trees, explored: J.explored,
    places: () => [
      ...J.places.filter(p => !p.hidden || J.visited.includes(p.id) || J.tips.has(p.id)).map(p => ({ ...p, g: '望', seen: J.visited.includes(p.id), lit: J.camps.has(p.id) })),
      // 见过、或者听说过的动物和人
      ...FINDS.filter(F => (F.kind === 'animal' || F.kind === 'folk') && (J.found[F.id] || J.tips.has(F.id))).map(F => {
        const m = markOf(F.id); if (!m) return null;
        const f = J.found[F.id];
        return { id: F.id, kind: 'mark', g: F.g, name: F.name, sub: f ? F.sub : '听说：' + F.hint, x: m.x, z: m.z, r: 10, seen: !!f };
      }).filter(Boolean),
    ],
    total: () => J.places.length,
    player: () => ({ x: J.p.x, z: J.p.z, yaw: J.yaw }),
    // 坐骑：不骑着、也不在身边的时候在地图上标出来
    mountAt: () => { const M = J.mount; if (!M || !M.st.shown || J.mode === 'ride' || M.st.p.distanceTo(J.p) < 6) return null; return { x: M.st.p.x, z: M.st.p.z, name: M.name }; },
    getWay: () => J.waypoint, setWay: w => { J.waypoint = w; save(); },
    canTravel: () => J.canTravel(), travel: place => travel(place),
    onClose: () => { clock.getDelta(); ui.hint(''); },
  });
  if (P.has('debug')) window.__map = mapView;
  J.onCampLit = S => { campMsg = { id: S.id, t: S.id === 'camp' ? '' : '篝火点起来了。以后夜里路过，这堆火都亮着；地图上也能一键回到这儿。' }; save(); };
  // 手记
  journal = new Journal({
    J, album, covers: () => covers,
    setCover: (place, id) => { covers[place] = id; try { localStorage.setItem('journey.covers', JSON.stringify(covers)); } catch {} },
    openMap: id => { if (!mapView.isOpen) mapView.open(id); },
    markOf: id => markOf(id),
    onBag: () => save(), quests: () => quests,
    travel: P => travel(P), canTravel: () => J.canTravel(),
    restart: () => {
      ui.fade(true); clearSave();
      setTimeout(() => { J.restart(); quality.samples.length = 0; ui.fade(false); ui.rest(null); ui.hint(J.auto ? '' : ui.goHint()); save(); }, 800);
    },
    onClose: () => { clock.getDelta(); },
  });
  // 拍照
  photo = new PhotoMode({
    J, renderer, scene, camera, album, canvas, setSize, subjects, draw,
    openAlbum: () => journal.open('album'),
    onShot: (m, first, saved) => {
      // 拍到了动物、人、彩虹：没遇见过的算遇见，第一张当见闻里的图
      let got = null;
      for (const id of m.subj || []) {
        if (!J.found[id]) J.discover(id, true);
        const f = J.found[id];
        if (f && !f.photo) { f.photo = m.id; got = got || findOf(id); }
      }
      if (got && saved) { photo.toast(`拍到了${got.name}，收进了手记的「见闻」`, 3.2); save(); return; }
      photo.toast(!saved ? '拍好了。这个浏览器存不住照片，记得在手记里存到手机' : first ? `「${m.name}」的第一张照片，成了手记里的封面` : `收进相册了 · ${m.name}`, 3);
      save();
    },
    onExit: () => { clock.getDelta(); },
  });
  ui.photo = () => { journal.close(); ui.rest(null); photo.enter(); };
  if (P.has('debug')) { window.__photo = photo; window.__journal = journal; window.__album = album; }
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
async function shotSetup() {
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
  // folk=lantern|painter|fisher|hiker|keeper：站到这个人旁边（要配 wild=1、look=folk 和他在的钟点 tod）
  const fk = P.get('folk') && folk.list.find(f => f.id === P.get('folk'));
  if (fk) { const w = folk.where(fk); x = w.x + 3; z = w.z + 3; }
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
  // 天气：wx=clear|cloudy|rain|fog|snow，直接到位
  if (P.get('wx')) { weather.set(P.get('wx')); J.applyDay(0); weather.settle(); J.applyDay(0); }
  if (P.has('aurora')) { skyfx.userData.lights(true); for (let i = 0; i < 40; i++) skyfx.userData.update({ camera, sunPos: J.daylight.sunPos, night: J.night, wx: weather, dt: 1, camFwd: new THREE.Vector3(0, 0, 1) }); }
  if (P.get('act') === 'takeoff') J.setMode('fly');
  if (P.get('act') === 'land') J.setMode('foot');
  if (P.get('act') === 'dismount') J.setMode('foot');
  if (P.get('act') === 'call') { J.setMode('foot'); }
  if (P.get('site')) { const S = J.sites.find(s => s.id === P.get('site')); if (S) { J.site = S; J.teleport(S.fireAt.x - Math.sin(S.yaw) * 3, S.fireAt.z - Math.cos(S.yaw) * 3, S.yaw, mode); } }
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
      W.update(camera, focus, 0, true); draw();
      const w = innerWidth / cols, h = innerHeight / rows, x = (si % cols) * w, y = Math.floor(si / cols) * h;
      sctx.drawImage(renderer.domElement, x, y, w, h);
      sctx.fillStyle = '#fff'; sctx.font = '14px sans-serif'; sctx.fillText(`${strip[si]}s ${J.mode}${J.trans ? '/' + J.trans.kind : ''} y=${(J.alt || 0).toFixed(1)}`, x + 6, y + 18);
      si++;
    }
  }
  // 截图：路上的人要是还在后台捏，等捏好再拍
  if (folk.jobs.size) { await Promise.all([...folk.jobs]); if (fk?.o && fk.path) { fk.o.s = fk.path.s0 + 5; fk.o.dir = 1; } for (let i = 0; i < 24; i++) step(1 / 30); }
  // 截图：把一只动物摆到人前面 put 米（侧着身子）
  if (P.has('put') && wildlife.live.length) {
    const A = wildlife.live.find(A => !P.get('sp') || A.sp === P.get('sp')) || wildlife.live[0], d = +P.get('put'), a = J.yaw + (+(P.get('pa') || 0)) * Math.PI / 180;
    const x = J.p.x + Math.sin(a) * d, z = J.p.z + Math.cos(a) * d;
    A.p.set(x, J.groundAt(x, z), z); A.yaw = J.yaw + Math.PI / 2; A.state = P.get('st') || 'graze'; A.t = 10;
    for (let i = 0; i < 20; i++) step(1 / 30);
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
  // 看某只动物 / 某个人（look=wild|folk，d=距离）：镜头摆在它斜前方
  if (P.get('look')) {
    const k = P.get('look'), d = +(P.get('d') || 5);
    const A = k === 'folk' ? folk.list.find(F => F.o && (!fk || F === fk)) : wildlife.live.find(A => !P.get('sp') || A.sp === P.get('sp'));
    const o = A && (A.o ? A.o.root : A.root);
    if (o) {
      o.updateMatrixWorld(true);
      const yaw = o.rotation.y + (+(P.get('la') || 40)) * Math.PI / 180, c = o.position;
      camera.position.set(c.x + Math.sin(yaw) * d, c.y + 1.2 + d * 0.12, c.z + Math.cos(yaw) * d);
      camera.lookAt(c.x, c.y + 0.7, c.z); camera.updateMatrixWorld();
    }
  }
  if (view === 'sit') {
    const c = J.camp.userData.seat, f = J.camp.userData.fireAt;
    const d = new THREE.Vector3().subVectors(f, c).setY(0).normalize(), r = new THREE.Vector3(-d.z, 0, d.x);
    camera.position.copy(c).addScaledVector(d, 1.6).addScaledVector(r, 1.4).add(new THREE.Vector3(0, 1.0, 0));
    camera.lookAt(c.x, c.y + 0.45, c.z); camera.updateMatrixWorld();
  }
  let n = 0;
  const one = () => {
    draw();
    if (++n < 3) requestAnimationFrame(one);
    else {
      const V = o => { const v = new THREE.Vector3(); o.getWorldPosition(v); return v.toArray().map(x => +x.toFixed(2)); };
      window.__info = { ms: W.ms, flora: { trees: W.stats.trees, small: Object.values(W.stats.small).reduce((a, b) => a + b, 0), tufts: W.placed.tufts.reduce((a, t) => a + t.length / 8, 0) }, bench: window.__bench, calls: renderer.info.render.calls, tris: renderer.info.render.triangles, mode: J.mode, trans: J.trans?.kind || null,
        p: J.p.toArray().map(x => +x.toFixed(2)), yaw: +J.yaw.toFixed(2), speed: +J.speed.toFixed(2), alt: +(J.alt || 0).toFixed(1), mount: J.mountKey,
        mountAt: J.mount ? V(J.mount.root) : null, pelvis: J.T.pelvis(new THREE.Vector3()).toArray().map(x => +x.toFixed(2)), visited: J.visited, cam: camera.position.toArray().map(x => +x.toFixed(1)),
        wild: wildlife.live.map(A => [A.sp, A.state, A.cur, A.p.toArray().map(x => +x.toFixed(1)), A.root.visible]), folk: folk.list.filter(F => F.o).map(F => [F.id, F.o.root.position.toArray().map(x => +x.toFixed(1))]), found: Object.keys(J.found) };
      window.__ready = true;
    }
  };
  one();
}

// 显卡掉线（手机内存紧时 Safari 会这样）：画面会一直黑着，干脆记一笔、自动用低一档重开
canvas.addEventListener('webglcontextlost', e => {
  e.preventDefault(); if (SHOT || lost) return;
  lost = true; markBoot(Math.max(1, bootFails + 1));
  try { ui.hint('画面掉线了，正在用低一点的画质重新打开…'); } catch {}
  setTimeout(() => location.reload(), 1500);
});
// 玩稳了就擦掉“正在打开”那一笔
let bootOkT = 0;
const bootTick = dt => { if (bootOkT < 0) return; bootOkT += playing ? dt : dt / 4; if (bootOkT > 15) { bootOkT = -1; clearBoot(); } };

load().then(() => {
  document.body.classList.add('ready');
  if (SHOT) return shotSetup();
  ui.ready(); showPerf();
  if (safeMsg) ui.loading(safeMsg);
  clock.getDelta();
  frame();
}).catch(e => { console.error(e); ui.failed('出错了：' + (e && e.message || e)); });
