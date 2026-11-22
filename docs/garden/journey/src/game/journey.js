// 自由旅行：步行、骑马、飞行三种走法，在谷地里随意走。默认左下角方向盘走（往哪推往哪走，推远走快），拖屏幕转镜头；
// 也可以换回老操作：按住屏幕往前，左右拖动转向（飞的时候上下拖动爬升、下降）。
// 在山路上不拖动时会自动顺着路走；谷地里有十处地方，往西北还有红叶谷、叠水、雪原山口和冰湖，往西是竹林山坳、西湾沙滩和海角灯塔（第一次到会出地名横幅，记进旅行手记）；
// 第一次到望远台有一段远景；在山口营地可以坐下烤火，看这一路的手记。
// 时间一直在走（一天大约半小时）：清晨、白天、黄昏、夜里，坐下烤火时快进到夜里，睡一觉到第二天清晨。
// 天气过一阵会变（晴、多云、小雨、起雾、下雪，world/weather.js），也可以在右上角定住。
// 探索：步行时陡坡和崖壁可以爬、深水可以游、可以跳；从高处跳出去张开翅膀就是滑翔，扇一下翅膀往上蹿一截，
// 滑进上升的风里会被托起来（world/thermals.js）。跑、爬、游、扇翅膀都要用气力（game/stamina.js）。
import * as THREE from 'three';
import { ROAD, STREAM, SPOTS, TRAIL, LAKE, CREEK_END, CAMP_SITES, SEAWAY, CAPEWAY, LIGHTHOUSE, SEA, coastCT, VISTAS, MIRROR, SPRINGS } from '../world/route.js';
import { DOM, CENTER, waterY, SHOAL, FALLS, lakeQ, springDepth, mirrorE } from '../world/land.js';
import { PERIODS, periodOf } from '../world/daytime.js';
import { viewpointShot, campShot, introShot, releaseShot } from './cam.js';
import { Explored } from './map.js';
import { findOf } from './finds.js';
import { ITEMS, BUFFS, BUFF_K, itemOf, dishOf, cookDish, dishEffect, effectText } from './cook.js';
import { Stamina, PIP } from './stamina.js';

export const GAITS = {
  foot: [{ name: '散步', v: 1.15 }, { name: '快走', v: 1.8 }, { name: '跑', v: 4.4 }],
  ride: [{ name: '慢步', v: 1.6 }, { name: '小跑', v: 3.3 }, { name: '奔跑', v: 5.6 }],
  // 飞：张着翅膀往前滑，三档是滑得多快（越快掉得越快）；往上要靠扇翅膀或者上升的风
  fly: [{ name: '慢滑', v: 7, sink: 1.05 }, { name: '滑翔', v: 10, sink: 1.5 }, { name: '俯冲', v: 14.5, sink: 3.2 }],
};
// 步行时的几种动作要多少气力（每秒，或者每一下）
const COST = { run: 3.2, climbUp: 6.5, climbSide: 4.2, climbDown: 2.2, swim: 3.6, swimFast: 6.5, float: 1.0, flap: 10, takeoff: 14 };
const CLIMB_IN = 0.95, CLIMB_STEEP = 1.3, CLIMB_OUT = 0.78;   // 往上走的坡度超过 0.95、或者脚下的坡比 1.3 还陡就算爬；缓到 0.78 以下算爬完
const SWIM_IN = 0.95, SWIM_OUT = 0.78, SWIM_Y = 1.0;          // 水没过胸口就游；游的时候“脚下”在水面以下一米
const GRAV = 16;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const DEG = Math.PI / 180;
// 时间：新的旅程从下午四点半出发；平常一个钟头 75 秒
export const START_TOD = 16.6;
const HOUR = 75;
const isNightH = h => h >= 20 || h < 5;
// 骑手盆骨相对马鞍挂点的微调（每种坐骑不一样）
const SEAT = { b: [0, 0.07, -0.04], a: [0, 0.09, -0.02], w: [0, 0.09, -0.02], d: [0, 0.07, 0.0] };

export function makePlaces() {
  const at = s => ROAD.at(s, {});
  const st = at(SPOTS.start), br = at(SPOTS.bridge), gr = at(SPOTS.grove[0] + 6), vw = at(SPOTS.view), cp = at(SPOTS.camp);
  // 溪边小路上离溪水某一段最近的点
  const tr = s => { const p = STREAM.at(s, {}), q = TRAIL.nearest(p.x, p.z, 40); return TRAIL.at(q.s, {}); };
  const au = tr(CREEK_END + 90), fa = tr(112), ps = tr(45);
  const bm = SEAWAY.at(205, {}), cv = SEAWAY.at(SEAWAY.length - 2, {});
  return [
    { id: 'valley', name: '暖光谷地', sub: '沿着小溪，往山口去', where: '出发的地方', x: st.x, z: st.z - 6, r: 20 },
    { id: 'east', name: '东坡花田', sub: '一坡的花，在风里晃', where: '出发后往右手边（东边）的山坡走', x: 75, z: -25, r: 26 },
    { id: 'bridge', name: '溪上木桥', sub: '水声近了', where: '顺着山路往前，过溪的地方', x: br.x, z: br.z, r: 9 },
    { id: 'mill', name: '风车坡', sub: '风车慢慢转，坡下就是小溪', where: '木桥右前方的山坡上', x: 62, z: -118, r: 16 },
    { id: 'shoal', name: '浅滩', sub: '溪水漫过圆石，可以蹚水过去', where: '从木桥往左，沿着小溪往上游走', x: SHOAL.x, z: SHOAL.z, r: 14 },
    { id: 'west', name: '西岭松林', sub: '松针的味道，风从山口吹来', where: '浅滩对岸，西边山坡上', x: -150, z: -165, r: 26 },
    { id: 'grove', name: '林荫小道', sub: '树影一道一道落在路上', where: '过了木桥，山路两边的树林', x: gr.x, z: gr.z, r: 14 },
    { id: 'view', name: '望远台', sub: '回头看看，走过的溪谷都在脚下', where: '山路快到头，有一张长椅', x: vw.x - 3, z: vw.z, r: 9 },
    { id: 'camp', kind: 'camp', name: '山口营地', sub: '今晚在这里歇脚', where: '山路尽头，可以坐下烤火', x: cp.x, z: cp.z, r: 14 },
    { id: 'autumn', name: '红叶谷', sub: '满山的红叶，落叶在风里打旋', where: '浅滩对岸有条溪边小路，顺着小溪往上游走', x: au.x, z: au.z, r: 30 },
    { id: 'falls', name: '叠水', sub: '山涧一级一级跳下来，水声哗哗的', where: '红叶谷走到头，小路顺着山涧往上爬', x: fa.x, z: fa.z, r: 24 },
    { id: 'pass', name: '雪原山口', sub: '风一下子凉了，脚下踩着雪', where: '顺着山涧一直往上，走到有雪的地方', x: ps.x, z: ps.z, r: 20 },
    { id: 'lake', name: '冰湖', sub: '湖面冻得结结实实，可以走上去', where: '过了雪原山口，小溪就是从这个湖里流出来的', x: LAKE.x, z: LAKE.z, r: 46 },
    { id: 'bamboo', name: '竹林山坳', sub: '竹子比人高好多，风一过沙沙响', where: '出发的地方往西，顺着海边小路走', x: bm.x, z: bm.z, r: 34 },
    { id: 'cove', name: '西湾沙滩', sub: '浪一层一层推上沙滩', where: '竹林里的小路走到头，就是海', x: cv.x - 17, z: cv.z - 5, r: 30 },
    { id: 'cape', name: '海角灯塔', sub: '天一暗，灯就亮了', where: '沙滩往南，顺着崖上的小路爬上海角', x: LIGHTHOUSE.x + 4, z: LIGHTHOUSE.z + 6, r: 18 },
    { id: 'mirror', name: '镜之原', sub: '天在脚下，云从蹄子边上飘过去', where: '山口营地往北有条小路，一直爬到头', x: MIRROR.x + 8, z: MIRROR.z + 38, r: 24 },
    { id: 'springs', name: '冰湖温泉', sub: '冒着白汽的池子，泡进去就不冷了', where: '冰湖营地往西几步，湖岸边上', x: SPRINGS.x, z: SPRINGS.z, r: 9 },
    { id: 'sky', name: '云端', sub: '整个谷地都在脚下', where: '找一股上升的风，张着翅膀让它托上去', alt: 50 },
    // 野外营地：第一次到会出横幅，坐下就点起篝火（以后夜里那堆火都亮着），地图上可以一键过去
    ...CAMP_SITES.map(c => ({ id: c.id, kind: 'camp', name: c.name, sub: c.sub, where: c.where, x: c.x, z: c.z, r: 11 })),
    // 藏起来的观景点：地图上一开始没有，走上去（或者有人告诉过你、在别的观景点望见过）才标出来
    ...VISTAS.map(v => ({ id: v.id, kind: 'vista', hidden: true, name: v.name, sub: v.sub, where: v.hint, x: v.x, z: v.z, r: 7, f: v.f })),
  ];
}

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _o = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _h = [new THREE.Vector3(), new THREE.Vector3()], _bit = [new THREE.Vector3(), new THREE.Vector3()], _cr = new THREE.Vector3(), _e = new THREE.Euler();
const _p = {}, _qr = {};
const MILL = { x: 62, z: -118 };   // 风车（props.js buildWindmill）

export class Journey {
  // o: { land, bridge, camp, mounts: {b, a, w, d}, traveler, wings, reins, cam, sound, ui, camera, sun, hemi, colliders, daylight }
  constructor(o) {
    Object.assign(this, o);
    this.T = o.traveler;
    this.places = makePlaces();
    // 营地：sites[0] 是山口营地；site 是现在坐着的（或者最近的）那一处
    this.sites = this.camp.userData.sites; this.site = this.sites[0];
    for (const S of this.sites) S.lit = 0;
    this.lightSite = null;
    this.groundAt = (x, z) => { const b = this.bridge.heightAt(x, z); return b === null ? this.land.heightExact(x, z) : b; };
    for (const [k, M] of Object.entries(this.mounts)) {
      if (!M) continue;
      M.key = k; M.st = { p: new THREE.Vector3(), yaw: 0, speed: 0, turn: 0, slope: 0, idleT: 0, goal: null, shown: false };
      M.onStep = (leg, pos, g) => this.hoof(M, leg, pos, g);
      M.root.visible = false;
    }
    this.mountKey = 'b';
    this.gaits = { foot: 1, ride: 1, fly: 1 };
    this.auto = false; this.holding = false;
    // 方向盘：stick = { x, y } 推的方向（右、上为正，长度 0~1），null 是没碰；ctl = 'stick' 方向盘 / 'hold' 按住屏幕走
    this.stick = null; this.ctl = 'stick'; this.stickGait = -1;
    this.p = new THREE.Vector3(); this.vy = 0;
    this.t = 0;
    // 地图：走过的地方（4 米一格）和标记点
    this.explored = new Explored(); this.waypoint = null; this.exT = 0;
    this.stamina = new Stamina(); this.shore = { x: 0, z: 0 }; this.told = new Set();
    // 行囊：bag 材料 { id: 个数 }，dishes 做好带着的菜 [{ id, s 分量 }]，recipes 做出来过的菜谱，buffs 吃了以后一阵子的好处 { k: 还剩几秒 }
    // picked：今天摘过的地方 Map(第几处 → 哪一天)，第二天又长出来；items 摘到过的种类
    this.bag = {}; this.dishes = []; this.recipes = new Set(); this.buffs = {}; this.picked = new Map(); this.items = new Set();
    // 风羽（game/feathers.js）：拿到的羽毛、点亮的石灯、听过的心愿；每三根羽毛气力多一格
    this.feathers = new Set(); this.lamps = new Set(); this.wishes = new Set();
    this.reset();
    this.tod = START_TOD; this.dayN = 1; this.ff = null; this.sitTo = null; this.night = 0; this.owlT = 20;
    // 声音：三道叠水的位置、阵风、冰鸣、换曲用的区域（带一点滞后，免得在边界上来回切）
    this.fallsAt = FALLS.map(([s, h]) => { const q = STREAM.at(s, {}); return { x: q.x, z: q.z, k: h / 4 }; });
    this.gust = 1; this.gustTo = 1; this.gustT = 0; this.iceT = 6; this.millT = 3; this.region = 'valley'; this.highUp = false; this.nightMusic = false;
    this.knockT = 4; this.thunderT = 30; this.rainMusic = false;
    // 天气（main.js 建好传进来）：换天气记一笔日记
    if (this.weather) this.weather.onChange = k => this.note('weather', k === 'rain' && this.weather.local.snow > 0.45 ? 'snow' : k);
    this.applyDay(0);
    this.cam.play(introShot(() => this.yaw));
  }
  get mount() { return this.mounts[this.mountKey]; }
  // 界面上亮哪个走法：过渡中显示要去的那个
  get uiMode() {
    const k = this.trans?.kind;
    if (k === 'takeoff') return 'fly';
    if (k === 'descend' || k === 'land') return this.landTo || 'foot';
    if (k === 'dismount') return 'foot';
    if (k === 'mount' || this.waitMount) return 'ride';
    return this.mode;
  }
  get gait() { return this.gaits[this.uiMode]; }
  set gait(i) { this.gaits[this.uiMode] = i; }
  // 这一步该走多快
  gaitV(mode = this.mode) {
    const i = this.gaits[mode];
    return mode === 'ride' ? (this.mount.gaits?.[i] ?? GAITS.ride[i].v) : GAITS[mode][i].v;
  }
  // 出发前换坐骑
  startWith(k) {
    if (!this.mounts[k] || k === this.mountKey) return;
    const old = this.mount; old.root.visible = false; old.st.shown = false;
    this.mountKey = k; const M = this.mount;
    M.st.p.copy(this.p); M.st.yaw = this.yaw; M.st.shown = true; M.root.visible = true;
    this.ui.mountChanged?.(k);
  }
  // 出发前换旅人
  setTraveler(T) {
    const g = this.T.target;
    this.T = T; T.set(g, 50);
  }
  // 截图、调试用：直接摆到某处
  teleport(x, z, yaw, mode = 'ride', alt = 30) {
    this.trans = null; this.waitMount = false; this.sitting = false;
    this.clearFoot();
    this.p.set(x, this.groundAt(x, z), z); this.yaw = this.yawT = this.faceYaw = yaw;
    this.speed = 0; this.vy = 0;
    this.mode = mode;
    for (const M of Object.values(this.mounts)) if (M && M !== this.mount) { M.root.visible = false; M.st.shown = false; }
    const M = this.mount;
    if (mode === 'ride') { M.st.p.copy(this.p); M.st.yaw = yaw; M.st.shown = true; M.root.visible = true; this.T.set('ride', 50); this.wings.show(false); }
    else if (mode === 'foot') { this.T.set('loco', 50); M.root.visible = false; M.st.shown = false; this.wings.show(false); }
    else {
      this.T.set('fly', 50); M.root.visible = false; M.st.shown = false;
      this.p.y = this.land.surfaceY(x, z) + alt; this.speed = this.gaitV('fly'); this.flyPitch = 70 * DEG;
      this.wings.show(true); this.wings.open = 1;
    }
    this.cam.inited = false;
  }

  // 地图上点“去这里”：落在离那个地方最近的路上（或者地方边上），面朝那里；飞着的就飞到那儿上空
  arrival(P) {
    let best = null;
    for (const path of [ROAD, TRAIL, SEAWAY, CAPEWAY]) {
      const q = path.nearest(P.x, P.z, P.r + 25, {});
      if (q.dist < (best ? best.dist : Infinity)) best = { dist: q.dist, p: path.at(q.s, {}) };
    }
    let x, z, yaw;
    if (best && best.dist > P.r + 4) {
      // 路离那儿太远（比如沙滩上的营地）：从路那边走过去，停在它边上
      const dx = best.p.x - P.x, dz = best.p.z - P.z, l = Math.hypot(dx, dz) || 1, k = Math.min(8, P.r * 0.6);
      x = P.x + dx / l * k; z = P.z + dz / l * k; yaw = Math.atan2(P.x - x, P.z - z);
    } else if (best) {
      x = best.p.x; z = best.p.z;
      yaw = best.dist > 2.5 ? Math.atan2(P.x - x, P.z - z) : Math.atan2(best.p.tx, best.p.tz);
    } else {
      // 不在路边：站在这个地方靠谷地那一侧，面朝它
      const dx = CENTER.x - P.x, dz = CENTER.z - P.z, l = Math.hypot(dx, dz) || 1, k = Math.min(12, P.r * 0.5);
      x = P.x + dx / l * k; z = P.z + dz / l * k; yaw = Math.atan2(P.x - x, P.z - z);
    }
    // 别落在水里、树里
    if (this.waterDepth(x, z) > 0.08) {
      let bx = x, bz = z, bd = Infinity;
      for (let r = 1.5; r <= 18 && bd === Infinity; r += 1.5) for (let a = 0; a < 6.283; a += 0.4) {
        const tx = x + Math.cos(a) * r, tz = z + Math.sin(a) * r;
        if (this.waterDepth(tx, tz) <= 0.02) { bx = tx; bz = tz; bd = r; break; }
      }
      x = bx; z = bz;
    }
    [x, z] = this.colliders.resolve(x, z, 0.8, 0);
    return { x, z, yaw };
  }
  canTravel() { return !this.sitting && this.phase !== 'intro'; }
  travelTo(P) {
    if (!this.canTravel()) return false;
    const a = this.arrival(P), fly = this.mode === 'fly';
    this.teleport(a.x, a.z, a.yaw, fly ? 'fly' : this.mode === 'ride' ? 'ride' : 'foot', 22);
    if (fly) { this.alt = 22; this.climb = 0; }
    this.phase = 'play'; this.holding = false; this.glance = null;
    this.inPlace.clear(); this.placeT = 0; this.ui.place('');
    this.explored.reveal(a.x, a.z, 46);
    if (this.waypoint && this.waypoint.id === P.id) this.waypoint = null;
    return true;
  }

  reset() {
    ROAD.at(SPOTS.start, _p);
    this.p.set(_p.x, 0, _p.z); this.p.y = this.groundAt(this.p.x, this.p.z);
    this.yaw = this.yawT = Math.atan2(_p.tx, _p.tz);
    this.speed = 0; this.vy = 0; this.turn = 0; this.slope = 0; this.climb = 0; this.bank = 0; this.flyPitch = 0; this.liftT = 0; this.alt = 0;
    this.waitMount = false; this.landTo = null; this.pendingMode = null;
    this.mode = 'ride'; this.trans = null; this.phase = 'intro';
    this.clearFoot(); this.faceYaw = this.yaw; this.liftT = 0; this.flapT = 0; this.flapHeld = false; this.inThermal = false;
    this.stamina.bonus = 0; this.stamina.extra = 0; this.stamina.fill();
    this.shore.x = this.p.x; this.shore.z = this.p.z; this.told.clear();
    this.bag = {}; this.dishes = []; this.recipes.clear(); this.buffs = {}; this.picked.clear(); this.items.clear(); this.cold = false; this.nearSpot = null; this.forageDay = -1;
    if (this.pot) this.pot.visible = false;
    this.feathers.clear(); this.lamps.clear(); this.wishes.clear(); this.quests?.refresh(this);
    this.steerT = 0; this.idleT = 0; this.travelT = 0;
    this.dist = { foot: 0, ride: 0, fly: 0 };
    this.visited = []; this.inPlace = new Set(); this.placeT = 0; this.labelT = 0;
    this.explored.clear(); this.waypoint = null; this.exT = 0;
    this.viewDone = false; this.glanceDone = false; this.glance = null;
    this.sitting = false; this.campT = 0; this.site = this.sites[0];
    this.camps = new Set(['camp']);   // 点过篝火的营地（山口营地本来就有人生火）
    this.log = [];                    // 手记里的日记：[{ d 第几天, h 钟点, k 事情, id 地方, p 照片 }]
    this.found = {};                  // 见闻：{ id: { d, h, n 打过几次招呼, photo 照片 id } }
    this.tips = new Set();            // 听人说起过、或者在观景点望见过的（地图上标出来）
    this.snortT = 18 + Math.random() * 20; this.mixT = 0; this.hintT = 0; this.edgeT = 0;
    for (const S of this.sites) { S.lit = 0; S.fire.visible = false; }
    for (const M of Object.values(this.mounts)) if (M) { M.root.visible = false; M.st.shown = false; M.st.goal = null; }
    const M = this.mount;
    M.st.p.copy(this.p); M.st.yaw = this.yaw; M.st.shown = true; M.root.visible = true;
    this.T.set('ride', 50);
  }
  begin() { this.phase = 'play'; releaseShot(this.cam, 2.8); }

  // ---------- 输入 ----------
  look(dx, dy) {
    if (this.phase === 'view' && this.cam.shot) { releaseShot(this.cam, 1.6); this.phase = 'play'; }
    if (this.sitting) return;
    if (this.ctl === 'stick') {
      // 方向盘操作：拖屏幕只转镜头（推着方向盘时人跟着镜头转）；飞的时候上下拖还是爬升、下降
      this.cam.yawC -= dx * 2.6; this.cam.dragT = 1.6;
      if (this.mode === 'fly') { this.climb = clamp(this.climb - dy * 5, -1, 1); this.steerT = 1.4; }
      else { this.cam.pitchOff = clamp(this.cam.pitchOff + dy * 3.2, -1.2, 3); this.cam.pitchHold = 2.5; if (this.stick) this.steerT = 0.8; }
      return;
    }
    if (this.mode === 'fly') { this.yawT -= dx * 2.3; this.climb = clamp(this.climb - dy * 5, -1, 1); }
    else { this.yawT -= dx * 2.6; this.cam.pitchOff = clamp(this.cam.pitchOff + dy * 3.2, -1.2, 3); this.cam.pitchHold = 2; }
    this.steerT = 1.4;
  }
  setCtl(c) { this.ctl = c === 'hold' ? 'hold' : 'stick'; this.cam.free = this.ctl === 'stick'; this.setStick(null); }
  // key：键盘上的方向键也当方向盘用（选了“按住屏幕”的老操作也一样）
  setStick(v, key = false) {
    this.stick = v; this.keyStick = !!(v && key);
    if (!v) { this.holding = false; this.stickGait = -1; return; }
    if (this.phase === 'view' && this.cam.shot) { releaseShot(this.cam, 1.2); this.phase = 'play'; }
  }
  // 方向盘：往哪推就往哪走（相对镜头），推得越远走得越快（三档步态）
  stickDrive() {
    const st = this.stick;
    if (!st || this.sitting) return false;
    const m = Math.hypot(st.x, st.y);
    if (m < 0.18) { this.holding = false; return true; }
    // 档位带一点回差，推在边界上不会来回跳
    const g = this.stickGait, up = [0.55, 0.9], dn = [0.47, 0.82];
    let gi = g < 0 ? (m >= up[1] ? 2 : m >= up[0] ? 1 : 0) : g;
    if (gi < 2 && m >= up[gi]) gi = m >= up[1] ? 2 : 1;
    if (gi > 0 && m < dn[gi - 1]) gi = m < dn[0] ? 0 : 1;
    this.stickGait = gi; this.gaits[this.uiMode] = gi;
    this.holding = true;
    const rel = Math.atan2(st.x, st.y);
    // 正往前推时交给“顺着路走”，偏了才自己掌方向
    if (this.mode === 'fly') this.yawT = this.cam.viewYaw - rel;   // 飞的时候 steerT 管爬升回平，不碰它
    else if (Math.abs(rel) > 0.14 || this.steerT > 0) {
      this.yawT = this.cam.viewYaw - rel;
      this.steerT = Math.max(this.steerT, 0.4);
    } else if (Math.abs(wrap(this.cam.viewYaw - this.yaw)) > 0.35) this.yawT = this.cam.viewYaw;
    return true;
  }
  keys(dt, turnKey, climbKey) {
    if (turnKey) { this.yawT -= turnKey * dt * (this.mode === 'fly' ? 1.2 : 1.9); this.steerT = 1.0; }
    if (climbKey && this.mode === 'fly') { this.climb = clamp(this.climb + climbKey * dt * 3, -1, 1); this.steerT = Math.max(this.steerT, 0.3); }
  }

  // 切换走法：foot / ride / fly
  setMode(m) {
    // 步行时的特殊情况：腾空、扒在岩壁上点「飞」就是张开翅膀；在水里、出溜的时候换不了
    if (this.mode === 'foot' && !this.trans && this.phase === 'play' && m !== 'foot') {
      if (m === 'fly' && (this.air || this.climbing)) return this.glideStart();
      if (this.swimming) { this.say(m === 'fly' ? '在水里飞不起来，先上岸' : '先上岸再叫坐骑'); return; }
      if (this.air || this.climbing || this.sliding) { this.say('先站稳再叫坐骑'); return; }
    }
    // 正在上下马、起飞降落时点的：等这一下做完再换
    if (this.trans && !this.sitting && this.phase === 'play' && this.trans.kind !== 'swap') { this.pendingMode = m; return; }
    if (this.trans || this.sitting || this.phase !== 'play' || m === this.mode) {
      if (m === 'ride' && this.mode === 'ride' && !this.trans) this.ui.mountPicker?.(true);
      return;
    }
    if (m === 'fly') return this.takeoff();
    if (this.mode === 'fly') { this.landing(m); return; }
    if (m === 'foot') return this.dismount();
    if (m === 'ride') return this.callMount();
  }
  pickMount(k) {
    if (!this.mounts[k]) return;
    if (k === this.mountKey) { if (this.mode !== 'ride') this.setMode('ride'); return; }
    const old = this.mount;
    if (this.mode === 'ride' && !this.trans) {
      // 骑着的时候换：一眨眼换成另一匹
      this.ui.fade(true);
      this.trans = { kind: 'swap', t: 0, dur: 0.9, k };
      return;
    }
    old.root.visible = false; old.st.shown = false; old.st.goal = null;
    this.mountKey = k;
    if (this.mode === 'foot' && this.phase === 'play') this.callMount();
  }
  takeoff() {
    if (!this.stamina.use(COST.takeoff * this.costK('wind'))) { this.say('没力气起飞了，歇一会儿'); return; }
    const fromRide = this.mode === 'ride';
    if (fromRide) this.park(this.mount);
    this.trans = { kind: 'takeoff', t: 0, dur: 0.75, from: fromRide ? 'ride' : 'foot', p0: this.pelvisNow() };
    this.T.play('Jump_Start', 1, 0.08);
    this.wings.show(true);
    this.sound.whoosh(1);
  }
  landing(next) { this.landTo = next || 'foot'; if (this.trans?.kind !== 'land') this.trans = { kind: 'descend', t: 0 }; }
  dismount() {
    const M = this.mount;
    const r = _v.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));   // 左手边
    const to = this.p.clone().addScaledVector(r, 1.15); to.y = this.groundAt(to.x, to.z);
    this.trans = { kind: 'dismount', t: 0, dur: 0.75, p0: this.pelvisNow(), to };
    this.park(M);
    this.T.set('loco', 5);
  }
  // 叫坐骑：在附近就小跑过来，太远就从身后不远处跑过来
  callMount() {
    if (this.air || this.climbing || this.swimming || this.sliding) { this.say(this.swimming ? '先上岸再叫坐骑' : '先站稳再叫坐骑'); return; }
    const M = this.mount, S = M.st;
    const right = _v.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
    const goal = this.p.clone().addScaledVector(right, 1.25);
    if (!S.shown || S.p.distanceTo(this.p) > 45) {
      const back = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      S.p.copy(this.p).addScaledVector(back, 16).addScaledVector(right, 5);
      S.p.y = this.groundAt(S.p.x, S.p.z); S.yaw = this.yaw; S.shown = true; M.root.visible = true;
    }
    S.goal = goal; S.goalYaw = this.yaw;
    this.waitMount = true;
    this.ui.hint(M.name + '来了');
    this.sound.whistle();
  }
  park(M) { const S = M.st; S.p.copy(this.mode === 'ride' ? this.p : S.p); S.yaw = this.mode === 'ride' ? this.yaw : S.yaw; S.speed = 0; S.goal = null; S.shown = true; M.root.visible = true; }
  pelvisNow() { return this.T.pelvis(new THREE.Vector3()); }

  // ---------- 每帧 ----------
  update(dt) {
    this.t += dt;
    const playing = this.phase === 'play' || this.phase === 'view';
    if (playing && !this.sitting) this.travelT += dt;
    this.steerT = Math.max(0, this.steerT - dt);
    // yawT 不要离当前朝向太远
    if ((this.ctl === 'stick' || this.keyStick) && this.phase !== 'intro') this.stickDrive();
    this.yawT = this.yaw + wrap(this.yawT - this.yaw);
    if (this.trans) this.transTick(dt);
    if (!this.trans && this.pendingMode) { const m = this.pendingMode; this.pendingMode = null; if (m !== this.uiMode) this.setMode(m); }
    const tk = this.trans?.kind;
    if (!tk || tk === 'descend' || tk === 'swap' || (tk === 'takeoff' && this.mode === 'fly')) {
      if (this.mode === 'fly') this.flyMove(dt); else if (!this.sitting) this.groundMove(dt);
    }
    this.bodyTick(dt);
    // 气力：站在地上（或者骑着马、坐着）没在用就慢慢回；爬着、游着、在天上不回
    this.stamina.tick(dt, this.sitting || this.mode === 'ride' || (this.mode === 'foot' && !this.air && !this.climbing && !this.swimming && !this.sliding));
    this.mountsTick(dt);
    this.placeTraveler(dt);
    this.feelTick(dt);
    this.camTick(dt);
    if (playing) this.story(dt);
    if (this.sitting) this.campTick(dt);
    this.clockTick(dt, playing);
    this.applyDay(dt);
    this.campfire(dt);
    this.mix(dt);
    this.snortT -= dt;
    if (this.snortT < 0) { this.snortT = 22 + Math.random() * 35; if (this.mode === 'ride' && this.phase !== 'intro' && this.speed < 2) this.sound.snort(); }
  }

  // ---------- 地面上走（步行或骑马） ----------
  groundMove(dt) {
    const riding = this.mode === 'ride';
    if (!riding) return this.footMove(dt);
    const can = this.phase === 'play' && !this.trans;
    let target = (this.holding || this.auto) && can ? this.gaitV() : 0;
    // 水里慢一点；太陡走不上去
    const depth = this.waterDepth(this.p.x, this.p.z);
    if (depth > 0.12) target *= riding ? 0.7 : clamp(1 - depth * 1.2, 0.35, 1);
    this.speed = damp(this.speed, target, target > this.speed ? (riding ? 1.2 : 2.5) : (riding ? 1.9 : 4), dt);
    if (target < 0.01 && this.speed < 0.03) this.speed = 0;
    this.idleT = this.speed > 0.05 ? 0 : this.idleT + dt;
    this.followRoad(dt);
    // 转向：步行转得快，马慢一些；站着也能原地转
    const maxTurn = riding ? lerp(1.5, 1.1, sstep(2, 5, this.speed)) : 3.4;
    const dy = clamp(wrap(this.yawT - this.yaw), -maxTurn * dt, maxTurn * dt);
    this.yaw += dy;
    this.turn = damp(this.turn, dy / Math.max(dt, 1e-3), 5, dt);
    // 往前挪
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw), d = this.speed * dt;
    let nx = this.p.x + fx * d, nz = this.p.z + fz * d;
    if (d > 1e-5) {
      const g0 = this.groundAt(this.p.x, this.p.z), g1 = this.groundAt(nx, nz), grade = (g1 - g0) / d;
      const maxG = riding ? 0.72 : 0.95;
      if (grade > maxG) { nx = this.p.x; nz = this.p.z; this.speed *= 0.6; this.hintOnce('太陡了，马上不去。下马可以爬上去'); }
      else if (grade > 0.3) this.speed *= 1 - (grade - 0.3) * dt * 1.5;
      // 太深的水不进去（步行）
      if (!riding && this.waterDepth(nx, nz) > 0.62) { nx = this.p.x; nz = this.p.z; this.speed *= 0.5; this.hintOnce(this.land.seaDepth(nx, nz) > 0.3 ? '再往前就是深海了' : '水太深了，走桥或者浅滩'); }
      if (riding && this.land.seaDepth(nx, nz) > 1.1) { nx = this.p.x; nz = this.p.z; this.speed *= 0.5; this.hintOnce('水深了，马不肯往前。下马可以游过去'); }
    }
    // 树、风车、帐篷这些挡路的东西
    const R = riding ? 0.75 : 0.32;
    const res = this.colliders.resolve(nx, nz, R, 0);
    nx = res[0]; nz = res[1];
    // 边界：近景范围外就是深山
    const m = 10, x0 = DOM.x0 + m, x1 = DOM.x0 + DOM.w - m, z0 = DOM.z0 + m, z1 = DOM.z0 + DOM.d - m;
    if (nx < x0 || nx > x1 || nz < z0 || nz > z1) { nx = clamp(nx, x0, x1); nz = clamp(nz, z0, z1); this.hintOnce('再往外是深山，回去吧'); }
    const moved = Math.hypot(nx - this.p.x, nz - this.p.z);
    this.dist[this.mode] += moved;
    this.p.set(nx, this.groundAt(nx, nz), nz);
    const hf = this.groundAt(nx + fx * 0.6, nz + fz * 0.6), hb = this.groundAt(nx - fx * 0.6, nz - fz * 0.6);
    this.slope = damp(this.slope, -Math.atan((hf - hb) / 1.2), 6, dt);
  }
  // ---------- 步行：走、跑、跳、爬、游 ----------
  clearFoot() { this.air = false; this.climbing = false; this.sliding = false; this.swimming = false; this.climbK = 0; this.climbPh = 0; this.climbDir = 0; this.steep = 0; this.slideV = 0; this.slideT = 0; this.swimY = 0; this.shoreT = 0; this.ripT = 0; this.vy = 0; }
  // 马上说一句（盖掉正在显示的提示）；tell：同一件事只说一次（记在存档里）
  say(t, dur = 2.8) { this.ui.hint(t); this.hintT = dur; }
  tell(k, t, dur = 5) { if (this.told.has(k)) return; this.told.add(k); this.say(t, dur); }
  // 不许走出近景范围
  bound(nx, nz) {
    const m = 10, x0 = DOM.x0 + m, x1 = DOM.x0 + DOM.w - m, z0 = DOM.z0 + m, z1 = DOM.z0 + DOM.d - m;
    if (nx < x0 || nx > x1 || nz < z0 || nz > z1) { nx = clamp(nx, x0, x1); nz = clamp(nz, z0, z1); this.hintOnce(this.land.seaDepth(nx, nz) > 0.5 ? '再往外浪太大了，回去吧' : '再往外是深山，回去吧'); }
    return [nx, nz];
  }
  footMove(dt) {
    const S = this.stamina, x = this.p.x, z = this.p.z;
    const can = this.phase === 'play' && !this.trans;
    const go = (this.holding || this.auto) && can;
    if (this.air) return this.airMove(dt, go);
    const depth = this.waterDepth(x, z);
    if (!this.swimming && depth > SWIM_IN) this.swimStart();
    else if (this.swimming && depth < SWIM_OUT) { this.swimming = false; this.T.set('loco', 4); this.p.y = this.groundAt(x, z); }
    if (this.swimming) return this.swimMove(dt, go);
    // 脚下的坡：(gx, gz) 指向坡上
    const e = 0.5, gx = (this.groundAt(x + e, z) - this.groundAt(x - e, z)) / (2 * e), gz = (this.groundAt(x, z + e) - this.groundAt(x, z - e)) / (2 * e);
    const steep = this.steep = Math.hypot(gx, gz);
    if (this.sliding) return this.slideMove(dt, gx, gz, steep);
    if (this.climbing) return this.climbMove(dt, go, gx, gz, steep);
    // 记下最近站稳过的地方（游不动了送回这里）
    if (depth < 0.05 && steep < 0.6 && (this.shoreT -= dt) <= 0) { this.shoreT = 0.5; this.shore.x = x; this.shore.z = z; }
    // 站在很陡的坡上（从上面蹭过来的、落在上面的）：跑着朝下就冲出去腾空，不然扒住；没力气了就出溜下去
    if (steep > CLIMB_STEEP && can) {
      if (this.speed > 2.6 && gx * Math.sin(this.yaw) + gz * Math.cos(this.yaw) < -0.9) { this.leap(1.0); return this.airMove(dt, go); }
      if (S.can()) { this.grab(); return this.climbMove(dt, go, gx, gz, steep); }
      this.sliding = true; this.slideV = 1; this.slideT = 0;
      return this.slideMove(dt, gx, gz, steep);
    }
    // 走和跑：跑要用气力，气力见底了只能快走
    let gi = this.gaits.foot;
    if (gi === 2 && S.spent) gi = 1;
    let target = go ? GAITS.foot[gi].v : 0;
    if (depth > 0.12) target *= clamp(1.06 - depth * 0.5, 0.55, 1);
    if (go && gi === 2 && this.speed > 2.6) S.drain(COST.run * this.costK('light'), dt);
    this.speed = damp(this.speed, target, target > this.speed ? 2.5 : 4, dt);
    if (target < 0.01 && this.speed < 0.03) this.speed = 0;
    this.idleT = this.speed > 0.05 ? 0 : this.idleT + dt;
    this.followRoad(dt);
    const dy = clamp(wrap(this.yawT - this.yaw), -3.4 * dt, 3.4 * dt);
    this.yaw += dy; this.faceYaw = this.yaw;
    this.turn = damp(this.turn, dy / Math.max(dt, 1e-3), 5, dt);
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw), d = this.speed * dt;
    let nx = x + fx * d, nz = z + fz * d;
    if (d > 1e-5) {
      const grade = (this.groundAt(nx, nz) - this.groundAt(x, z)) / d;
      if (grade > CLIMB_IN) {
        // 前面是陡坡：有力气就扒上去，没力气先歇着
        nx = x; nz = z;
        if (S.can()) { this.grab(); this.tell('climb', '陡坡和崖壁可以爬上去，要用气力\n气力用完了会滑下来'); }
        else { this.speed *= 0.6; this.hintOnce('没力气爬了，歇一会儿'); }
      } else if (grade > 0.3) this.speed *= 1 - (grade - 0.3) * dt * 1.5;
    }
    const res = this.colliders.resolve(nx, nz, 0.32, 0);
    [nx, nz] = this.bound(res[0], res[1]);
    this.dist.foot += Math.hypot(nx - x, nz - z);
    this.p.set(nx, this.groundAt(nx, nz), nz);
    const hf = this.groundAt(nx + fx * 0.6, nz + fz * 0.6), hb = this.groundAt(nx - fx * 0.6, nz - fz * 0.6);
    this.slope = damp(this.slope, -Math.atan((hf - hb) / 1.2), 6, dt);
  }
  grab() { this.climbing = true; this.sliding = false; this.speed = 0; }
  // 离开地面：vy 往上的速度（跳是 6.3，跑出坎边是 1）
  leap(vy) { this.air = true; this.climbing = false; this.sliding = false; this.vy = vy; }
  // 爬：脸朝坡上，往哪推就往哪挪（往上最费气力，横着其次，往下最省）；停着不动不耗气力
  climbMove(dt, go, gx, gz, steep) {
    const S = this.stamina, x = this.p.x, z = this.p.z;
    if (steep > 0.3) this.faceYaw += wrap(Math.atan2(gx, gz) - this.faceYaw) * (1 - Math.exp(-9 * dt));
    this.yaw += clamp(wrap(this.yawT - this.yaw), -7 * dt, 7 * dt); this.turn = 0;
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const dir = (this.groundAt(x + fx * 0.4, z + fz * 0.4) - this.groundAt(x, z)) / 0.4;
    // 爬到缓的地方（上了顶、下到底）就站起来走
    if (steep < CLIMB_OUT && dir < CLIMB_IN * 0.85) { this.climbing = false; return; }
    const fast = this.gaits.foot === 2, wet = (this.weather?.k.r || 0) > 0.4;
    if (go) {
      const rate = (dir > 0.35 ? COST.climbUp : dir < -0.35 ? COST.climbDown : COST.climbSide) * (fast ? 1.45 : 1) * (wet ? 1.5 : 1);
      if (!S.drain(rate * this.costK('grip'), dt)) { this.climbing = false; this.sliding = true; this.slideV = 0.5; this.slideT = 0; this.say('没力气了，滑下去歇一歇'); return; }
      if (wet) this.tell('wet', '下雨石头滑，爬起来更费气力');
    }
    this.speed = damp(this.speed, go ? (fast ? 1.75 : 1.25) * (wet ? 0.8 : 1) : 0, 7, dt);
    const d = this.speed * dt / Math.sqrt(1 + dir * dir);
    let nx = x + fx * d, nz = z + fz * d;
    const res = this.colliders.resolve(nx, nz, 0.32, 0);
    [nx, nz] = this.bound(res[0], res[1]);
    this.dist.foot += Math.hypot(nx - x, nz - z);
    this.p.set(nx, this.groundAt(nx, nz), nz);
    this.climbDir = dir; this.idleT = 0; this.slope = damp(this.slope, 0, 6, dt);
    const ph0 = this.climbPh; this.climbPh += this.speed * dt * 0.62;
    if (Math.floor(ph0 * 2) !== Math.floor(this.climbPh * 2)) this.sound.foot(this.surface(nx, nz, 0.05) === 'snow' ? 'snow' : 'dirt', 0, 0.5);
  }
  // 没力气了：顺着坡出溜下去，到缓的地方停住
  slideMove(dt, gx, gz, steep) {
    const x = this.p.x, z = this.p.z, l = steep || 1;
    this.slideT += dt;
    if (steep < 0.62 || this.slideT > 7 || this.waterDepth(x, z) > 0.5) {
      this.sliding = false; this.speed = 0; this.slideV = 0;
      if (this.slideT > 7) { this.stamina.spent = false; this.stamina.v = Math.max(this.stamina.v, 30); }    // 卡在沟里了：给一口气爬出来
      this.thud(x, z, 0.5);
      return;
    }
    this.slideV = damp(this.slideV, 6.5, 1.6, dt);
    if (steep > 0.3) this.faceYaw += wrap(Math.atan2(gx, gz) - this.faceYaw) * (1 - Math.exp(-9 * dt));
    const d = this.slideV * dt / Math.sqrt(1 + steep * steep);
    let nx = x - gx / l * d, nz = z - gz / l * d;
    const res = this.colliders.resolve(nx, nz, 0.32, 0);
    [nx, nz] = this.bound(res[0], res[1]);
    this.p.set(nx, this.groundAt(nx, nz), nz); this.speed = 0;
    const F = this.fx;
    if (F?.on && (this.ripT -= dt) <= 0) { this.ripT = 0.14; F.puffs.puff(this.land.snow(nx, nz) > 0.45 ? 'snow' : 'dust', nx, this.p.y + 0.1, nz, 0.7, -gx / l, -gz / l); }
  }
  // 腾空：跳起来、从坎上跑出去。掉得久了翅膀自己张开
  airMove(dt, go) {
    const x = this.p.x, z = this.p.z;
    this.vy -= GRAV * dt;
    this.yaw += clamp(wrap(this.yawT - this.yaw), -1.8 * dt, 1.8 * dt); this.faceYaw = this.yaw;
    this.turn = damp(this.turn, 0, 5, dt);
    if (!go) this.speed *= Math.exp(-0.6 * dt);
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    let nx = x + fx * this.speed * dt, nz = z + fz * this.speed * dt;
    const ny = this.p.y + this.vy * dt;
    const res = this.colliders.resolve(nx, nz, 0.32, ny - this.groundAt(x, z));
    [nx, nz] = this.bound(res[0], res[1]);
    let g = this.groundAt(nx, nz);
    // 前面的坎比脚高一截：过不去，贴着它往下掉
    if (g > ny + 0.5) { nx = x; nz = z; g = this.groundAt(x, z); this.speed *= 0.4; }
    this.dist.foot += Math.hypot(nx - x, nz - z);
    const wd = this.waterDepth(nx, nz), floor = wd > SWIM_IN ? g + wd - SWIM_Y : g;
    if (ny <= floor) {
      const v = -this.vy;
      this.air = false; this.vy = 0; this.p.set(nx, floor, nz);
      if (wd > 0.3) this.thud(nx, nz, clamp(v / 9, 0.3, 1));
      else {
        this.T.play('Jump_Land', clamp(v / 9, 0.3, 1), 0.08);
        this.sound.foot(this.surface(nx, nz, 0.05), 1, clamp(v / 8, 0.5, 1.2));
        if (v > 7.5) this.thud(nx, nz, clamp((v - 7) / 8, 0.25, 1));
      }
      this.speed *= v > 9 ? 0.35 : 0.85;
      return;
    }
    this.p.set(nx, ny, nz);
    if (this.vy < -10.5 && ny - Math.max(g, g + wd) > 5 && this.phase === 'play' && !this.trans) {
      this.glideStart();
      this.tell('autoglide', '翅膀自己张开了\n腾空的时候按一下「展翅」（空格）也可以', 5);
    }
  }
  // 游：水没过胸口就漂起来游，一直要用气力；游不动了会被送回岸边
  swimStart() {
    this.swimming = true; this.climbing = false; this.sliding = false; this.air = false;
    this.T.set('swim', 5);
    this.thud(this.p.x, this.p.z, 0.4);
    this.tell('swim', '水深的地方可以游过去，要用气力\n游不动了会被送回岸边');
  }
  swimMove(dt, go) {
    const S = this.stamina, x = this.p.x, z = this.p.z, gi = this.gaits.foot;
    if (!this.trans && !S.drain((go ? (gi === 2 ? COST.swimFast : COST.swim) : COST.float) * this.costK('fin'), dt)) return this.washAshore();
    this.speed = damp(this.speed, go ? [1.0, 1.5, 2.3][gi] : 0, 2.2, dt);
    const dy = clamp(wrap(this.yawT - this.yaw), -2.4 * dt, 2.4 * dt);
    this.yaw += dy; this.faceYaw = this.yaw;
    this.turn = damp(this.turn, dy / Math.max(dt, 1e-3), 4, dt);
    let nx = x + Math.sin(this.yaw) * this.speed * dt, nz = z + Math.cos(this.yaw) * this.speed * dt;
    const res = this.colliders.resolve(nx, nz, 0.32, 0);
    [nx, nz] = this.bound(res[0], res[1]);
    this.dist.foot += Math.hypot(nx - x, nz - z);
    const g = this.groundAt(nx, nz);
    this.swimY = g + this.waterDepth(nx, nz);
    this.p.set(nx, Math.max(g, this.swimY - SWIM_Y), nz);
    this.slope = damp(this.slope, 0, 6, dt); this.idleT = 0;
    const F = this.fx;
    if (F?.on && (this.ripT -= dt) <= 0) { this.ripT = this.speed > 0.4 ? 0.5 : 1.5; F.ripples.add(nx + Math.sin(this.yaw) * 0.4, nz + Math.cos(this.yaw) * 0.4, 0.45 + 0.2 * this.speed); }
  }
  washAshore() {
    if (this.trans) return;
    this.trans = { kind: 'wash', t: 0, dur: 1.9 }; this.speed = 0;
    this.ui.fade(true);
  }
  // 空格 / 屏幕上的圆按钮：地上是跳；腾空是张开翅膀；扒在岩壁上是蹬开；天上是扇一下翅膀（按住接着扇）
  act(on) {
    this.flapHeld = !!on;
    if (!on || this.phase !== 'play' || this.sitting) return;
    if (this.mode === 'fly') { this.flap(); return; }
    if (this.mode !== 'foot' || this.trans) return;
    if (this.air) return this.glideStart();
    if (this.swimming || this.sliding) return;
    if (this.climbing) { this.yaw = this.yawT = wrap(this.faceYaw + Math.PI); this.speed = 2.6; this.leap(3.4); return; }
    this.leap(6.6);
    this.T.play('Jump_Start', 0.6, 0.06);
    this.sound.foot(this.surface(this.p.x, this.p.z, 0.05), 1, 0.7);
  }
  // 这个按钮现在叫什么（不能用的时候是空的）
  get actName() {
    if (this.phase !== 'play' || this.sitting) return '';
    if (this.mode === 'fly') return this.trans?.kind === 'descend' || this.trans?.kind === 'land' ? '' : '扇翅';
    if (this.mode !== 'foot' || this.trans || this.swimming || this.sliding) return '';
    return this.air ? '展翅' : this.climbing ? '蹬开' : '跳';
  }
  // 扇一下翅膀：往上蹿一截，要用气力
  flap() {
    if (this.mode !== 'fly' || this.flapT > 0.1 || (this.trans && this.trans.kind !== 'takeoff')) return;
    if (!this.stamina.use(COST.flap * this.costK('wind'))) { this.hintOnce('气力用完了，先滑下去歇一歇'); return; }
    this.flapT = 0.5; this.vy = Math.min(9, Math.max(this.vy, 0) + 6.2); this.speed = Math.min(16, this.speed + 1.2);
    this.wingC = -1;
  }
  // 腾空、扒在岩壁上的时候张开翅膀：直接开始滑翔（不用起飞那一下，也不费气力）
  glideStart() {
    if (this.mode !== 'foot' || this.trans || this.swimming || this.sliding) return;
    if (this.climbing) { this.yaw = this.yawT = wrap(this.faceYaw + Math.PI); this.speed = 3; }
    const vy = this.vy;
    this.clearFoot();
    this.mode = 'fly'; this.T.set('fly', 5); this.wings.show(true);
    this.liftT = 0.45; this.vy = Math.max(vy, -3); this.speed = Math.max(this.speed, 5.5);
    this.flyPitch = 35 * DEG; this.climb = 0; this.bank = 0; this.flapT = 0;
    this.sound.whoosh(0.9);
    this.tell('glide', '张着翅膀往前滑，会慢慢往下掉\n扇翅膀能往上蹿一截（费气力）；找到上升的风，不费力就升上去', 6.5);
  }

  // 在路上、没有手动转向时，慢慢顺着路走
  followRoad(dt) {
    if (this.steerT > 0 || this.speed < 0.25) return;
    // 山路，或者溪边小路（窄一些）
    let P = ROAD, q = ROAD.nearest(this.p.x, this.p.z, 8, _qr);
    if (!(q.dist < 4.5)) {
      P = null;
      for (const W of [TRAIL, SEAWAY, CAPEWAY]) { const r = W.nearest(this.p.x, this.p.z, 6, _qr); if (r.dist < 3) { P = W; q = r; break; } }
      if (!P) return;
    }
    P.at(q.s, _p);
    let ry = Math.atan2(_p.tx, _p.tz), dir = 1;
    if (Math.abs(wrap(ry - this.yaw)) > Math.PI / 2) { ry = wrap(ry + Math.PI); dir = -1; }
    if (Math.abs(wrap(ry - this.yaw)) > 1.0) return;
    // 往前看几米的路，弯道上提前转
    P.at(q.s + dir * 4, _p);
    const ahead = Math.atan2(_p.x - this.p.x, _p.z - this.p.z);
    const lat = Math.abs(q.d) > 0.5 ? q.d - Math.sign(q.d) * 0.5 : 0;
    const want = wrap(lerp(ry, ry + wrap(ahead - ry), 0.6) + clamp(lat * 0.1 * dir, -0.3, 0.3));
    const k = sstep(4.5, 2, q.dist);
    this.yawT = this.yaw + wrap(want - this.yaw) * Math.min(1, dt * 3 * k + 0.02);
  }
  waterDepth(x, z) {
    const sea = this.land.seaDepth(x, z);
    if (sea > 0) return sea;
    const pool = this.land.poolDepth(x, z);
    if (pool > 0) return pool;
    const sd = this.land.streamDist(x, z);
    if (sd > 5) return 0;
    if (this.bridge.heightAt(x, z) !== null) return 0;
    const s = this.land.sample(this.land.strS, x, z);
    return Math.max(0, waterY(s) - this.land.heightExact(x, z));
  }
  // 脚下是什么：水、冰、雪还是土
  surface(x, z, wet) {
    if (this.waterDepth(x, z) > wet) return 'water';
    if (this.land.height(x, z) - this.land.ground(x, z) > 0.02) return 'ice';
    // 沙滩上的沙子踩起来和雪差不多，软软的
    return this.land.snow(x, z) > 0.45 || this.land.sand(x, z) > 0.5 ? 'snow' : 'dirt';
  }

  // ---------- 飞 ----------
  flyMove(dt) {
    const descending = this.trans?.kind === 'descend';
    // 刚起飞的那一小会儿自己往上飞一段
    const lifting = this.liftT > 0 && !descending; if (this.liftT > 0) this.liftT -= dt;
    // 扇翅膀是一下一下的（按住就接着扇）
    if (this.flapT > 0) this.flapT -= dt;
    if (this.flapHeld && this.flapT <= 0 && !descending && this.phase === 'play') this.flap();
    this.flapping = this.flapT > 0 || lifting;
    // 往前滑多快：推着方向盘（按住屏幕）是选的那一档，松开就慢慢滑
    const G = GAITS.fly[(this.holding || this.auto) && this.phase === 'play' ? this.gaits.fly : 0];
    this.speed = damp(this.speed, descending ? 6 : G.v, 0.9, dt);
    if (this.steerT <= 0) this.climb = damp(this.climb, 0, 0.8, dt);
    const maxTurn = 1.15;
    const dy = clamp(wrap(this.yawT - this.yaw), -maxTurn * dt, maxTurn * dt);
    this.yaw += dy;
    this.turn = damp(this.turn, dy / Math.max(dt, 1e-3), 3, dt);
    const g = this.land.surfaceY(this.p.x, this.p.z), alt = this.p.y - g;
    // 滑翔只会慢慢往下（往下压可以掉得更快）；上升的风把人托起来
    const up = this.thermals ? this.thermals.userData.lift(this.p.x, this.p.y, this.p.z) : 0;
    this.inThermal = up > 0.05;
    if (up > 0.3) this.tell('thermal', '这里有一股上升的风\n张着翅膀待在里面，不费力就被托上去', 5.5);
    let vyT = -G.sink + Math.min(this.climb, 0.12) * 4.5;
    if (up > 0) vyT = lerp(vyT, 6.5, up);
    // 「自动」的时候不用人管：自己扇着翅膀保持在二十来米高（不算气力）
    const cruise = this.auto && this.phase === 'play' && !descending && up <= 0;
    if (cruise) { vyT = clamp((22 - alt) * 0.5, -1.5, 3); if (vyT > 0.6) this.flapping = true; }
    if (lifting) vyT = Math.max(vyT, 5);
    if (descending) vyT = -Math.min(6, 1.5 + alt * 0.6);
    this.vy = damp(this.vy, vyT, this.flapT > 0 ? 0.4 : 1.6, dt);
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    let nx = this.p.x + fx * this.speed * dt, nz = this.p.z + fz * this.speed * dt, ny = this.p.y + this.vy * dt;
    // 飞得低时躲开树干和风车
    if (alt < 10) { const r = this.colliders.resolve(nx, nz, 0.6, alt); nx = r[0]; nz = r[1]; }
    // 范围：离谷地中心 780 米以内（冰湖在西北差不多 600 米远）
    const dx = nx - CENTER.x, dz = nz - CENTER.z, rr = Math.hypot(dx, dz);
    if (rr > 780) { this.yawT = this.yaw + wrap(Math.atan2(-dx, -dz) - this.yaw) * 0.04; this.steerT = 0.5; this.hintOnce('再往外云太厚了，往回飞'); }
    const ng = this.land.surfaceY(nx, nz);
    const floor = ng + 1.05, ceil = Math.min(ng + 160, 260);
    if (ny < floor) { ny = floor; this.vy = Math.max(0, this.vy); if (descending || !this.flapping) this.touchdown(); }
    if (ny > ceil) { ny = ceil; this.vy = Math.min(0, this.vy); }
    this.dist.fly += Math.hypot(nx - this.p.x, nz - this.p.z);
    this.p.set(nx, ny, nz);
    // 姿态：越快身体越平，爬升时抬头，转弯时侧倾
    const pitchT = lerp(58, 76, sstep(6, 16, this.speed)) * DEG - this.vy * 2.2 * DEG;
    this.flyPitch = damp(this.flyPitch || pitchT, pitchT, 3, dt);
    this.bank = damp(this.bank, clamp(-this.turn * 0.55, -0.6, 0.6), 3, dt);
    this.alt = this.p.y - this.land.surfaceY(this.p.x, this.p.z);
  }
  touchdown() {
    if (this.trans?.kind === 'land') return;
    // 落在深水里：直接游起来
    const wd = this.waterDepth(this.p.x, this.p.z);
    if (wd > SWIM_IN) {
      this.mode = 'foot'; this.trans = null; this.wings.show(false); this.vy = 0; this.speed = Math.min(this.speed, 2);
      this.p.y = this.groundAt(this.p.x, this.p.z) + wd - SWIM_Y; this.swimY = this.p.y + SWIM_Y;
      const next = this.landTo; this.landTo = null;
      this.swimStart();
      if (next === 'ride') this.say('先上岸再叫坐骑');
      return;
    }
    this.trans = { kind: 'land', t: 0, dur: 0.9 };
    this.T.play('Jump_Land', 1, 0.1);
    this.wings.show(false);
    this.sound.whoosh(0.6);
  }

  // ---------- 过渡：上马、下马、起飞、落地、换马 ----------
  transTick(dt) {
    const tr = this.trans; tr.t += dt;
    const u = Math.min(1, tr.t / (tr.dur || 1));
    if (tr.kind === 'takeoff') {
      // 先蹲一下再跳起来，翅膀张开
      if (tr.t > 0.3 && this.mode !== 'fly') {
        this.mode = 'fly'; this.T.set('fly', 3); this.liftT = 1.7;
        this.vy = 6.5; this.speed = Math.max(this.speed, 4); this.p.y = Math.max(this.p.y, this.groundAt(this.p.x, this.p.z) + (tr.from === 'ride' ? 1.6 : 0.4));
        this.flyPitch = 20 * DEG;
      }
      if (u >= 1) this.trans = null;
    } else if (tr.kind === 'land') {
      if (this.mode === 'fly') {
        this.mode = 'foot'; this.T.set('loco', 5); this.p.y = this.groundAt(this.p.x, this.p.z); this.speed = Math.min(this.speed, 2); this.vy = 0;
        this.thud(this.p.x, this.p.z, 1);
      }
      this.speed = damp(this.speed, 0, 3, dt);
      if (u >= 1) { this.trans = null; if (this.landTo === 'ride') this.callMount(); this.landTo = null; }
    } else if (tr.kind === 'descend') {
      // 由 flyMove 降到地面后 touchdown() 接手
    } else if (tr.kind === 'dismount') {
      this.speed = damp(this.speed, 0, 6, dt);
      if (u >= 1) { this.mode = 'foot'; this.p.copy(tr.to); this.speed = 0; this.trans = null; this.thud(this.p.x, this.p.z, 0.55); }
    } else if (tr.kind === 'mount') {
      if (u >= 1) { this.mode = 'ride'; const S = this.mount.st; this.p.copy(S.p); this.yaw = this.yawT = S.yaw; this.speed = 0; this.trans = null; }
    } else if (tr.kind === 'wash') {
      // 游不动了：一暗一亮之间回到最近站过的岸上，缓过一口气
      if (tr.t > 0.9 && !tr.done) {
        tr.done = true;
        const sh = this.shore;
        this.clearFoot(); this.T.set('loco', 50);
        this.p.set(sh.x, this.groundAt(sh.x, sh.z), sh.z); this.speed = 0; this.cam.inited = false;
        this.stamina.v = Math.max(this.stamina.v, this.stamina.max * 0.4); this.stamina.spent = false;
        this.ui.fade(false); this.say('游不动了，被水送回了岸边', 3.5);
      }
      if (u >= 1) this.trans = null;
    } else if (tr.kind === 'swap') {
      if (tr.t > 0.45 && !tr.done) {
        tr.done = true;
        const old = this.mount; old.root.visible = false; old.st.shown = false;
        this.mountKey = tr.k; const M = this.mount;
        M.st.p.copy(this.p); M.st.yaw = this.yaw; M.st.shown = true; M.root.visible = true;
        this.ui.fade(false); this.ui.banner(M.name, M.desc || '', 2.4); this.ui.mountChanged?.(tr.k);
      }
      if (u >= 1) this.trans = null;
    }
  }

  // ---------- 坐骑：骑着的跟着走；没骑的在原地吃草，或者被叫过来 ----------
  mountsTick(dt) {
    for (const M of Object.values(this.mounts)) {
      if (!M || !M.root.visible) continue;
      const S = M.st, ridden = M === this.mount && (this.mode === 'ride' && (!this.trans || this.trans.kind === 'swap'));
      if (ridden) {
        S.p.copy(this.p); S.yaw = this.yaw; S.speed = this.speed; S.turn = this.turn; S.slope = this.slope;
      } else {
        // 被叫过来：朝目标小跑，到了就停下转过来（人走开了目标跟着变）
        if (this.waitMount && M === this.mount && this.mode === 'foot') {
          const rx = -Math.cos(this.yaw), rz = Math.sin(this.yaw), gx = this.p.x + rx * 1.25, gz = this.p.z + rz * 1.25;
          if (!S.goal) { if (Math.hypot(gx - S.p.x, gz - S.p.z) > 1.3) S.goal = new THREE.Vector3(gx, 0, gz); }
          else if (Math.hypot(gx - S.goal.x, gz - S.goal.z) > 0.8 || this.speed > 0.2) S.goal.set(gx, 0, gz);
          S.goalYaw = this.yaw;
          // 人站住了、坐骑就在旁边：上马
          if (!S.goal && !this.trans && this.speed < 0.5 && S.speed < 0.35 && !this.air && !this.climbing && !this.swimming && !this.sliding) this.startMount();
        }
        if (S.goal) {
          // 朝目标走，越近越慢；到了一米以内就停下（上马时人会跳过去，不用停得很准）
          const dx = S.goal.x - S.p.x, dz = S.goal.z - S.p.z, d = Math.hypot(dx, dz);
          const near = d < 1.6, want = near ? S.goalYaw + wrap(Math.atan2(dx, dz) - S.goalYaw) * sstep(0.3, 1.6, d) : Math.atan2(dx, dz);
          const dyaw = clamp(wrap(want - S.yaw), -2 * dt, 2 * dt); S.yaw += dyaw; S.turn = damp(S.turn, dyaw / dt, 4, dt);
          const vT = d > 0.9 ? Math.min(3.2, 0.5 + d * 0.5) : 0;
          S.speed = damp(S.speed, vT * Math.max(0, Math.cos(wrap(Math.atan2(dx, dz) - S.yaw))), d > 0.9 ? 2 : 4, dt);
          let nx = S.p.x + Math.sin(S.yaw) * S.speed * dt, nz = S.p.z + Math.cos(S.yaw) * S.speed * dt;
          const r = this.colliders.resolve(nx, nz, 0.7, 0); nx = r[0]; nz = r[1];
          S.p.set(nx, this.groundAt(nx, nz), nz);
          if (d < 1.2 && S.speed < 0.35) S.goal = null;   // 到了（人在旁边的话，上面会接着上马）
        } else { S.speed = damp(S.speed, 0, 3, dt); S.turn = damp(S.turn, 0, 3, dt); }
        // 离得太远就先回去了
        if (!S.goal && S.p.distanceTo(this.p) > 140 && this.mode !== 'ride') { M.root.visible = false; S.shown = false; continue; }
        const fx = Math.sin(S.yaw), fz = Math.cos(S.yaw);
        const hf = this.groundAt(S.p.x + fx * 0.6, S.p.z + fz * 0.6), hb = this.groundAt(S.p.x - fx * 0.6, S.p.z - fz * 0.6);
        S.slope = damp(S.slope, -Math.atan((hf - hb) / 1.2), 6, dt);
      }
      S.idleT = S.speed > 0.05 ? 0 : S.idleT + dt;
      M.root.position.copy(S.p);
      if (M.tilt) M.root.rotation.set(S.slope, S.yaw, 0, 'YXZ'); else M.root.rotation.set(0, S.yaw, 0);
      M.root.updateMatrixWorld(true);
      const graze = !ridden && S.idleT > 4 || (this.sitting && !ridden);
      M.update(dt, { speed: S.speed, turn: S.turn, slope: S.slope, terrain: this.groundAt, graze });
    }
  }
  startMount() {
    const M = this.mount;
    this.waitMount = false;
    this.trans = { kind: 'mount', t: 0, dur: 0.8, p0: this.pelvisNow(), q0: this.T.root.quaternion.clone() };
    this.T.set('ride', 3.5);
    this.T.play('Jump_Start', 0.6, 0.08);
  }

  // ---------- 旅人摆到位置上 ----------
  placeTraveler(dt) {
    const T = this.T, M = this.mount, tr = this.trans;
    const seatPos = () => {
      M.root.updateMatrixWorld(true);
      M.seat.getWorldPosition(_v);
      if (M.seatTilt) M.seat.getWorldQuaternion(_q); else M.root.getWorldQuaternion(_q);
      const o = SEAT[M.key] || [0, 0.08, 0];
      _o.set(o[0], o[1], o[2]).applyQuaternion(_q);
      return _v.add(_o);
    };
    let riding = !!(this.mode === 'ride' && !tr || tr && (tr.kind === 'mount' || tr.kind === 'dismount' || tr.kind === 'swap'));
    if (tr && tr.kind === 'takeoff' && tr.from === 'ride' && tr.t < 0.3) riding = true;
    // 先定朝向，再算动作，最后把盆骨挪到该在的位置
    let pelvisTarget = null;
    if (this.sitting) {
      const c = this.site;
      T.root.rotation.set(0, this.sitYaw, 0);
      T.update(dt, { speed: 0, lookAt: _cr.copy(c.fireAt).setY(c.fireAt.y + 0.4), lookW: 0.6 });
      T.root.updateMatrixWorld(true);
      const pv = T.pelvis(_w);
      T.root.position.x += c.seat.x - pv.x; T.root.position.z += c.seat.z - pv.z; T.root.position.y += c.seatTop + 0.1 - pv.y;
    } else if (riding) {
      M.root.getWorldQuaternion(_q2);
      if (M.seatTilt) M.seat.getWorldQuaternion(_q2);
      const k = tr && tr.kind === 'mount' ? sstep(0, 1, tr.t / tr.dur) : tr && tr.kind === 'dismount' ? 1 - sstep(0, 1, tr.t / tr.dur) : 1;
      T.root.quaternion.copy(_q2);
      if (tr && tr.kind === 'mount') T.root.quaternion.copy(tr.q0).slerp(_q2, sstep(0, 0.7, tr.t / tr.dur));
      const g = sstep(2.2, 3.4, this.speed);
      T.update(dt, { speed: k < 1 ? 0 : this.speed, ride: { lean: (0.05 + g * 0.1) * k, spread: k }, lookAt: this.lookTarget() });
      pelvisTarget = seatPos().clone();
      if (k < 1) {
        // 跳上去 / 跳下来：沿一条弧线
        const from = tr.kind === 'mount' ? tr.p0 : tr.to.clone().setY(tr.to.y + 0.95);
        const u = tr.kind === 'mount' ? sstep(0, 1, tr.t / tr.dur) : sstep(0, 1, tr.t / tr.dur);
        const a = tr.kind === 'mount' ? from : pelvisTarget, b = tr.kind === 'mount' ? pelvisTarget : from;
        pelvisTarget = a.clone().lerp(b, u); pelvisTarget.y += Math.sin(Math.PI * u) * 0.45;
        if (tr.kind === 'dismount' && u > 0.98) T.set('loco', 6);
      }
    } else if (this.mode === 'fly' || (tr && tr.kind === 'takeoff' && this.mode === 'fly')) {
      _e.set(this.flyPitch, this.yaw, this.bank, 'YXZ'); T.root.quaternion.setFromEuler(_e);
      const flap = this.flapping ? 1 : 0;
      T.update(dt, { speed: 0, fly: { pitch: this.flyPitch, bank: this.bank, flap } });
      pelvisTarget = _w.copy(this.p).add(_o.set(0, 0.9, 0)).clone();
    } else if (this.swimming) {
      // 游泳：身子平着漂在水面，盆骨在水面下一点
      T.root.rotation.set(0, this.yaw, 0);
      T.update(dt, { speed: 0, swim: { v: this.speed } });
      pelvisTarget = _w.set(this.p.x, this.swimY - 0.31 + 0.03 * Math.sin(this.t * 2.1), this.p.z).clone();
    } else {
      // 爬（和没力气出溜的时候）：脸朝坡上，整个人顺着坡往前趴，离开岩面一点
      const ck = this.climbK = damp(this.climbK, this.climbing || this.sliding ? 1 : 0, this.climbing || this.sliding ? 9 : 6, dt);
      const k = tr && tr.kind === 'takeoff' ? 0 : 1;
      if (ck > 0.01) {
        const lean = ck * clamp(Math.PI / 2 - Math.atan(this.steep) - 0.12, 0.1, 0.75);
        _e.set(lean, this.yaw + wrap(this.faceYaw - this.yaw) * ck, 0, 'YXZ'); T.root.quaternion.setFromEuler(_e);
      } else T.root.rotation.set(0, this.yaw, 0);
      T.update(dt, { speed: this.speed * k * (1 - ck), turn: this.turn, slope: this.slope, lookAt: this.lookTarget(), air: this.air,
        climb: ck > 0.01 ? { k: ck, phase: this.climbPh, reach: this.sliding ? 0.25 : sstep(-0.6, 0.5, this.climbDir) * 0.75 + 0.25 } : null });
      T.root.position.copy(this.p);
      if (ck > 0.01) { const c = Math.cos(Math.atan(this.steep)); T.root.position.x -= Math.sin(this.faceYaw) * 0.22 * ck * (1 - c); T.root.position.z -= Math.cos(this.faceYaw) * 0.22 * ck * (1 - c); T.root.position.y += 0.1 * ck * c; }
      if (tr && tr.kind === 'takeoff' && tr.from === 'foot') T.root.position.y = this.groundAt(this.p.x, this.p.z);
    }
    if (pelvisTarget) {
      T.root.updateMatrixWorld(true);
      const pv = T.pelvis(_w);
      T.root.position.add(_o.copy(pelvisTarget).sub(pv));
      T.root.updateMatrixWorld(true);
    }
    // 翅膀
    const flying = this.mode === 'fly';
    this.wings.update(dt, { flap: flying && this.flapping ? 1.5 : 0, glide: flying && !this.flapping, climb: this.vy, speed: this.speed });
    // 扇一下翅膀一声；走路一步一声
    const wc = Math.floor(this.wings.phase / (2 * Math.PI));
    if (wc !== this.wingC) { if (flying && this.flapping && this.phase !== 'intro') this.sound.whoosh(clamp(this.speed / 14, 0.5, 1.2)); this.wingC = wc; }
    const fc = Math.floor(T.phase * 2);
    if (fc !== this.footC) {
      this.footC = fc;
      if (this.mode === 'foot' && !tr && this.speed > 0.3 && !this.sitting && this.phase !== 'intro' && !this.air && !this.swimming && !this.climbing && !this.sliding) {
        const x = this.p.x, z = this.p.z, wood = this.bridge.heightAt(x, z) !== null;
        this.sound.foot(wood ? 'wood' : this.surface(x, z, 0.05), sstep(2.5, 4.5, this.speed));
        if (!wood) { T.foot(fc & 1, _w); this.kick(_w.x, _w.z, this.yaw, this.speed, sstep(1.2, 5.5, this.speed), false); }
      }
    }
    T.after?.(dt);
    // 缰绳
    const reinsOn = riding && (!tr || tr.kind === 'swap');   // 注意要是 true/false：visible 是 null 时 three.js 照样画
    this.reins.visible = reinsOn;
    if (reinsOn) {
      T.hand(0, _h[0]); T.hand(1, _h[1]); M.bit[0].getWorldPosition(_bit[0]); M.bit[1].getWorldPosition(_bit[1]);
      this.reins.userData.update(_h, _bit, this.camera);
    }
  }
  // 骑手看哪：经过风车时看风车，营地看火，不然就看前面
  lookTarget() {
    if (this.glance) return _cr.set(this.glance.x, this.groundAt(this.glance.x, this.glance.z) + 6, this.glance.z);
    return null;
  }

  // ---------- 镜头 ----------
  camTick(dt) {
    const focus = _cr.copy(this.mode === 'ride' && !this.trans ? this.mount.root.position : this.p);
    this.cam.update(dt, focus, this.yaw, { mode: this.trans?.kind === 'takeoff' && this.mode !== 'fly' ? 'foot' : this.mode === 'foot' && this.climbing ? 'climb' : this.mode, speed: this.speed, vy: this.vy, alt: this.alt || 0, steer: !!this.stick });
  }

  // ---------- 地点、远景、营地 ----------
  story(dt) {
    this.placeT -= dt;
    if (this.placeT <= 0) {
      this.placeT = 0.3;
      const alt = this.mode === 'fly' ? this.alt : 0;
      for (const P of this.places) {
        const inside = P.alt ? alt > P.alt : Math.hypot(this.p.x - P.x, this.p.z - P.z) < P.r;
        const was = this.inPlace.has(P.id);
        if (inside && !was) {
          this.inPlace.add(P.id);
          if (!this.visited.includes(P.id)) { this.visited.push(P.id); this.note('visit', P.id); this.ui.banner(P.name, P.sub); this.labelT = 5; this.ui.place(''); this.ui.progress(this.visited.length / this.places.length); this.ui.journal?.(this.visited.length, this.places.length); if (P.kind === 'vista') this.atVista(P); this.onVisit?.(P); }
          else { this.ui.place(P.name); this.labelT = 0; }
          this.lastPlace = P;
          if (P.id === 'bridge' && !this.glanceDone && this.mode !== 'fly') { this.glanceDone = true; this.glance = { t: 0, dur: 7, x: 62, z: -118 }; }
        } else if (!inside && was) {
          const far = P.alt ? alt < P.alt - 8 : Math.hypot(this.p.x - P.x, this.p.z - P.z) > P.r * 1.3;
          if (far) { this.inPlace.delete(P.id); if (this.lastPlace === P) this.ui.place(''); }
        }
      }
    }
    if (this.labelT > 0) { this.labelT -= dt; if (this.labelT <= 0 && this.lastPlace && this.inPlace.has(this.lastPlace.id)) this.ui.place(this.lastPlace.name); }
    // 地图：走过的地方亮起来（飞得越高看得越远）；走到标记点附近就算到了
    this.exT -= dt;
    if (this.exT <= 0) {
      this.exT = 0.5;
      this.explored.reveal(this.p.x, this.p.z, 46 + (this.mode === 'fly' ? Math.min(120, (this.alt || 0) * 1.5) : 0));
      const w = this.waypoint;
      if (w && Math.hypot(this.p.x - w.x, this.p.z - w.z) < w.r + (this.mode === 'fly' ? 10 : 0)) {
        this.waypoint = null; this.ui.hint(`到了：${w.name}`); this.hintT = 3;
      }
    }
    // 过桥时侧头看一眼风车
    if (this.glance) {
      const g = this.glance, c = this.cam; g.t += dt;
      const dx = g.x - this.p.x, dz = g.z - this.p.z, l = Math.hypot(dx, dz) || 1;
      const th = clamp(Math.atan2(c.fwd.z * dx / l - c.fwd.x * dz / l, c.fwd.x * dx / l + c.fwd.z * dz / l), -1.35, 1.35);
      const w = sstep(0, 1.8, g.t) * (1 - sstep(g.dur - 2, g.dur, g.t));
      if (this.steerT <= 0) { c.yawOff = th * w; c.yawHold = 0.2; }
      if (g.t > g.dur) this.glance = null;
    }
    // 望远台：第一次走到长椅附近，镜头升起来回头看溪谷
    const vw = this.places.find(P => P.id === 'view');
    if (!this.viewDone && this.mode !== 'fly' && !this.trans && Math.hypot(this.p.x - vw.x, this.p.z - vw.z) < 4.2) {
      this.viewDone = true; this.phase = 'view';
      const shot = viewpointShot(this.yaw);
      shot.onEnd = () => { if (this.phase === 'view') this.phase = 'play'; };
      this.cam.play(shot);
    }
    // 营地：走近篝火时可以坐下
    let nearS = null;
    const busy = this.air || this.climbing || this.swimming || this.sliding;
    if (!this.sitting && this.mode !== 'fly' && !this.trans && !busy) for (const S of this.sites) if (Math.hypot(this.p.x - S.fireAt.x, this.p.z - S.fireAt.z) < 7) nearS = S;
    if (!this.sitting && nearS && nearS !== this.site) { this.site = nearS; this.fireKept = false; }
    this.nearFolk = !nearS && !this.sitting && this.mode !== 'fly' && !this.trans && !busy ? this.folk?.nearest(this.p) : null;
    // 路上能摘的东西：步行走到跟前
    this.nearSpot = !nearS && !this.nearFolk && !this.sitting && this.mode === 'foot' && !this.trans && !busy ? this.forage?.userData.near(this.p) || null : null;
    const it = this.nearSpot && itemOf(this.nearSpot.kind);
    if (this.mode === 'ride' && !this.trans && !this.told.has('rideForage') && this.forage?.userData.near(this.p, 3.2)) this.tell('rideForage', '一闪一闪的是能摘的东西\n下马（换成步行）走过去才摘得到', 5.5);
    const qa = !nearS && !this.nearFolk && !it && !this.sitting && !this.trans && !busy && this.quests ? this.quests.actionText(this) : '';
    this.ui.action?.(nearS ? (this.camps.has(nearS.id) ? '坐下烤火' : '点起篝火') : this.nearFolk ? '打个招呼' : it ? it.verb + it.name : qa);
    // 提示
    if (this.hintT > 0) { this.hintT -= dt; if (this.hintT <= 0) this.ui.hint(''); }
  }
  hintOnce(t) { if (this.hintT > 0) return; this.ui.hint(t); this.hintT = 3; }

  // ---------- 见闻 ----------
  // 第一次遇见：记下来、出一张小卡片（quiet 不出卡片）
  discover(id, quiet, at) {
    if (this.found[id]) return false;
    const F = findOf(id); if (!F) return false;
    this.found[id] = { d: this.dayN, h: Math.round(this.tod * 100) / 100, ...(at ? { x: Math.round(at.x), z: Math.round(at.z) } : {}) };
    this.tips.delete(id);
    if (F.kind !== 'vista') this.note('find', id);
    if (!quiet) { this.ui.found?.(F); this.sound.chime?.(0.6); }
    this.onFind?.(F);
    return true;
  }
  // 听说了：地图上标出来（已经见过的不算）；返回新听说了几样
  tip(ids) { let n = 0; for (const id of ids) if (!this.found[id] && !this.tips.has(id)) { this.tips.add(id); n++; } return n; }
  // 走上观景点：望见一大片（地图亮出来），附近藏着的东西标出来，镜头升起来转一圈
  atVista(P) {
    this.discover(P.id, true);
    this.sound.chime?.(0.8);
    this.explored.reveal(P.x, P.z, 260);
    const seen = this.nearFinds?.(P.x, P.z, 420) || [];
    const n = this.tip(seen);
    if (n) setTimeout(() => this.ui.hint(`从这儿望见了 ${n} 处有意思的地方，地图上标出来了`), 5200), this.hintT = 9.5;
    if (this.mode !== 'fly' && !this.trans) {
      this.phase = 'view';
      const shot = viewpointShot(P.f * DEG + Math.PI);
      shot.onEnd = () => { if (this.phase === 'view') this.phase = 'play'; };
      this.cam.play(shot);
    }
  }

  // 坐下烤火：一暗一亮之间换到树桩上（离得最近的那处营地）
  sitAtCamp() {
    if (this.sitting || this.trans || this.air || this.climbing || this.swimming || this.sliding) return;
    let best = null, bd = 9;
    for (const S of this.sites) { const d = Math.hypot(this.p.x - S.fireAt.x, this.p.z - S.fireAt.z); if (d < bd) { bd = d; best = S; } }
    if (!best) return;
    this.site = best;
    this.ui.fade(true);
    this.sitPending = 0.9;
  }
  campTick(dt) { this.campT += dt; }
  // 篝火：坐着的那堆、刚坐过的那堆、点过的营地夜里都亮着；离得太远的不画。火光只有一盏，挂在最近那堆亮着的火边上
  campfire(dt) {
    if (this.sitPending !== undefined && this.sitPending !== null) {
      this.sitPending -= dt;
      if (this.sitPending <= 0) { this.sitPending = null; this.doSit(); }
    }
    const cp = this.camera.position;
    let light = null, ld = 60;
    for (const S of this.sites) {
      const mine = S === this.site && (this.sitting || this.fireKept);
      const on = mine || (this.camps.has(S.id) && this.night > 0.45);
      S.lit = damp(S.lit, on ? 1 : 0, 1.2, dt);
      const d = Math.hypot(cp.x - S.fireAt.x, cp.z - S.fireAt.z);
      S.fire.visible = S.lit > 0.02 && d < 260;
      if (S.fire.visible) { S.fire.scale.setScalar(0.35 + 0.65 * S.lit); S.fire.userData.update(this.t, S.lit); }
      const pd = Math.hypot(this.p.x - S.fireAt.x, this.p.z - S.fireAt.z);
      if (S.lit > 0.02 && pd < ld) { ld = pd; light = S; }
    }
    const L = this.camp.userData.lanLight;
    if (light) { L.position.copy(light.lightAt); L.intensity = (light.id === 'camp' ? 1.8 : 2.4) * light.lit; } else L.intensity = 0;
    this.lightSite = light;
  }
  get lit() { return this.site.lit; }
  doSit() {
    const c = this.site, seat = c.seat, fire = c.fireAt;
    const M = this.mount;
    // 坐骑停到营地旁边吃草（走路来的、坐骑落在远处的，也让它跟过来）
    if (this.mode === 'ride' || !M.st.shown || M.st.p.distanceTo(this.p) > 12) {
      M.st.goal = null;
      let px, pz, my;
      if (c.id === 'camp') { const yaw = c.yaw; px = seat.x + Math.cos(yaw) * -3.6 + Math.sin(yaw) * 2.2; pz = seat.z - Math.sin(yaw) * -3.6 + Math.cos(yaw) * 2.2; my = yaw + 2.2; }
      else { const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw); px = fire.x - fx * 2.4 + fz * 4.4; pz = fire.z - fz * 2.4 - fx * 4.4; my = c.yaw + 1.9; [px, pz] = this.colliders.resolve(px, pz, 1.0, 0); }
      M.st.p.set(px, this.groundAt(px, pz), pz); M.st.yaw = my; M.st.speed = 0; M.st.shown = true; M.root.visible = true;
    }
    this.mode = 'foot'; this.speed = 0; this.trans = null;
    this.sitting = true; this.campT = 0; this.fireKept = true;
    this.ff = null; this.sitTo = null;
    if (!this.camps.has(c.id)) { this.camps.add(c.id); this.note('camp', c.id); this.onCampLit?.(c); }
    else this.note('rest', c.id);
    this.sitYaw = Math.atan2(fire.x - seat.x, fire.z - seat.z);
    this.p.set(seat.x, this.groundAt(seat.x, seat.z), seat.z); this.yaw = this.yawT = this.sitYaw;
    this.T.set('sit', 50);
    this.T.A.Sitting_Enter.time = this.T.A.Sitting_Enter.getClip().duration; this.T.sitStage = 'idle';
    const target = fire.clone().lerp(M.st.p, 0.35).setY(fire.y);   // 用坐骑的逻辑位置（刚挪过来时模型还没跟上）
    const shot = campShot(target, this.camera, this.clearAngle(target, this.camera.aspect < 1 ? 8.2 : 6.6, 24), 24); shot.blend = 0.01;
    this.cam.play(shot);
    this.ui.fade(false);
  }
  // 歇到某个时辰：火边快进过去（要过夜的由 main.js 先暗下来睡一觉）
  restUntil(at) {
    if (!this.sitting) return false;
    this.sitTo = at; this.ff = null;
    return true;
  }
  // 睡一觉到清晨（还坐在火边）
  sleep() {
    if (this.tod > 6 || this.tod < 5) this.dayN++;
    this.tod = 5.9; this.ff = null; this.sitTo = null;
    this.applyDay(0);
    this.note('sleep', this.site.id);
  }
  // 记一笔日记（同一件事同一个钟头里只记一次）
  note(k, id = null, p = null) {
    const last = this.log[this.log.length - 1];
    if (last && last.k === k && last.id === id && last.d === this.dayN && Math.abs(last.h - this.tod) < 1 && !p) return;
    this.log.push({ d: this.dayN, h: Math.round(this.tod * 100) / 100, k, id, ...(p ? { p } : {}) });
    if (this.log.length > 500) this.log.splice(0, this.log.length - 500);
  }
  // 拍照时在哪：正在某个地方里就是那儿，不然找最近的（离得太远就算“路上”）
  placeHere() {
    if (this.lastPlace && this.inPlace.has(this.lastPlace.id)) return this.lastPlace;
    if (this.mode === 'fly' && this.alt > 50) return this.places.find(P => P.id === 'sky');
    let best = null, bd = Infinity;
    for (const P of this.places) { if (P.x === undefined) continue; const d = Math.hypot(this.p.x - P.x, this.p.z - P.z) / (P.r + 20); if (d < bd) { bd = d; best = P; } }
    return bd < 1.6 ? best : null;
  }
  // 围着某个点找一个方向（度），从那里看过去中间没有树冠挡着（从 270 度往两边找）
  clearAngle(c, R, swing) {
    let best = 270, bestS = -1;
    const clear = (ax, az, bx, bz) => Math.min(this.colliders.firstHit(ax, az, bx, bz), this.colliders.firstHit(bx, bz, ax, az));
    for (let k = 0; k < 24; k++) {
      const a0 = 270 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 15;
      let s = 0;
      for (const da of [-swing, 0, swing]) {
        const a = (a0 + da) * DEG;
        s += clear(c.x - Math.sin(a) * R, c.z + Math.cos(a) * R, c.x, c.z);
      }
      if (s > bestS + 1e-3) { bestS = s; best = a0; }
      if (s > 3 - 1e-3) break;
    }
    return best;
  }
  // 结尾卡片之后：站起来继续走
  standUp() {
    if (!this.sitting) return;
    this.sitting = false; this.summaryShown = false;
    if (this.pot) this.pot.visible = false;
    // 烤过火，身上暖和一阵子
    if (this.campT > 4) { this.buffs.warm = Math.max(this.buffs.warm || 0, 240); this.stamina.fill(); }
    this.T.set('loco', 3);
    const f = this.site.fireAt;
    this.yaw = this.yawT = Math.atan2(this.p.x - f.x, this.p.z - f.z);
    releaseShot(this.cam, 2.5);
  }
  // 结尾卡片之后：夜里就睡一觉，到第二天清晨再上路
  wakeUp() {
    if (this.tod > 6 || this.tod < 5) this.dayN++;
    this.tod = 6.0; this.ff = null; this.sitTo = null; this.fireKept = false;
    this.standUp();
    this.applyDay(0);
  }
  // 开始卡片上选了“从头开始”：回到出发点，还没出发
  fresh() {
    this.sitting = false; this.fireKept = false;
    this.reset();
    this.tod = START_TOD; this.dayN = 1; this.ff = null; this.sitTo = null; this.applyDay(0);
    this.cam.inited = false; this.cam.play(introShot(() => this.yaw));
    this.ui.place(''); this.ui.progress(0); this.ui.journal?.(0, this.places.length);
  }
  // 从头再来
  restart() {
    this.sitting = false; this.fireKept = false; this.T.set('ride', 50);
    this.reset();
    this.cam.shot = null; this.cam.inited = false; this.cam.zoom = this.cam.zoomTarget;
    this.phase = 'play';
    this.tod = START_TOD; this.dayN = 1; this.ff = null; this.sitTo = null; this.applyDay(0);
    this.ui.place(''); this.ui.progress(0); this.ui.journal?.(0, this.places.length);
  }

  // ---------- 时间 ----------
  // 清晨和黄昏走得慢一点（多看一会儿），夜里快一点；坐下烤火时快进；时间按钮跳到下一个时辰
  clockTick(dt, playing) {
    let adv = 0;
    if (this.ff) {
      const rem = (this.ff.to - this.tod + 24) % 24;
      adv = Math.min(rem, this.ff.rate * dt);
      if (rem - adv < 1e-3) { adv = rem; this.ff = null; }
    } else if (this.sitting && this.sitTo !== null) {
      const rem = (this.sitTo - this.tod + 24) % 24;
      adv = Math.min(rem, Math.max(0.9, rem / 6) * dt);
      if (rem - adv < 1e-3) { adv = rem; this.sitTo = null; }
    } else if (playing && !this.sitting) {
      const h = this.tod;
      const k = (h > 5.2 && h < 7.6) || (h > 16.8 && h < 19.6) ? 0.55 : isNightH(h) && h > 20.4 || h < 4.6 ? 1.6 : 1;
      adv = dt * k / HOUR;
    }
    if (adv <= 0) return;
    this.weather?.tick(adv, this.tod);
    const t = this.tod + adv;
    if ((this.tod < 5 && t >= 5) || t >= 29) this.dayN++;     // 天亮算新的一天
    this.tod = t % 24;
  }
  // 跳到下一个时辰（快进过去）；返回那个时辰的名字
  skipTime() {
    if (this.sitting) return null;
    const from = this.ff ? this.ff.to : this.tod;
    const next = PERIODS.find(p => p.at > from + 0.05) || PERIODS[0];
    this.ff = { to: next.at, rate: 3.2 };
    return next.name;
  }
  get isNight() { return isNightH(this.tod); }
  applyDay(dt) {
    if (!this.daylight) return;
    this.daylight.apply(this.tod, this.p, dt);
    this.night = this.daylight.night;
    const W = this.weather;
    if (W) {
      // 雪原上下的是雪；海边容易起雾
      const x = this.p.x, z = this.p.z;
      W.local.snow = Math.max(this.land.snow(x, z), 1 - sstep(1.4, 2.6, lakeQ(x, z)));
      W.local.coast = sstep(-120, -40, coastCT(x, z)[0]);
      W.apply(this.daylight, dt, this.focus || this.p, this.px);
    }
  }


  // ---------- 摘东西、做饭、吃 ----------
  // 有某种好处的时候，对应的气力消耗打个折
  costK(k) { return this.buffs[k] > 0 ? BUFF_K[k] : 1; }
  // 每帧：好处一点点过去；雪地里（或者下着雪）身上不暖和，气力回得慢；新的一天摘过的又长出来
  bodyTick(dt) {
    if (this.phase === 'play' && !this.ff) for (const k in this.buffs) {
      if (!(this.buffs[k] > 0)) continue;
      this.buffs[k] -= dt;
      if (this.buffs[k] <= 0) { delete this.buffs[k]; if (!this.sitting) this.say(`「${BUFFS[k].name}」的劲儿过去了`); }
    }
    const snowy = this.land.snow(this.p.x, this.p.z) > 0.5 && this.p.y - this.land.height(this.p.x, this.p.z) < 30;
    const lit = this.lightSite && Math.hypot(this.p.x - this.lightSite.fireAt.x, this.p.z - this.lightSite.fireAt.z) < 7;
    // 泡温泉：站在池子里不骑马，身上就暖和了，气力很快回满；泡过以后暖和劲儿还能管好一阵
    const soak = this.phase === 'play' && this.mode === 'foot' && !this.air && springDepth(this.p.x, this.p.z, this.land.heightExact(this.p.x, this.p.z)) > 0.12;
    if (soak) {
      this.soakT = (this.soakT || 0) + dt;
      this.buffs.warm = Math.max(this.buffs.warm || 0, Math.min(480, 120 + this.soakT * 30));
      { const S = this.stamina; S.v = Math.min(S.max, S.v + dt * 30); if (S.v > S.max * 0.3) S.spent = false; }
      if (!this.soaking) { this.tell('soak', '泡在温泉里，身上一下子就暖和了\n气力回得很快；晴天的夜里，抬头往北看看', 6.5); this.note('soak', 'springs'); }
    } else this.soakT = 0;
    this.soaking = soak;
    // 镜之原的夜：晴天夜里站在水里，脚下就是星空
    this.starsea = this.phase === 'play' && this.night > 0.85 && this.weather && this.weather.k.o < 0.35 && this.weather.k.f < 0.3 && this.weather.k.r < 0.05 && this.mode !== 'fly' && mirrorE(this.p.x, this.p.z) < -6;
    if (this.starsea) this.discover('starsea', false, this.p);
    this.cold = snowy && !(this.buffs.warm > 0) && !lit && !this.stamina.free;
    this.stamina.rate = this.cold ? 0.35 : 1;
    if (this.cold && this.phase === 'play' && this.mode !== 'fly') this.tell('cold', '雪地里冷，气力回得慢\n吃点热的，或者到篝火边烤一烤，就暖和了', 6.5);
    if (this.forageDay !== this.dayN && this.forage) {
      this.forageDay = this.dayN;
      for (const [i, d] of this.picked) if (d !== this.dayN) this.picked.delete(i);
      this.forage.userData.refresh(i => this.picked.has(i));
    }
  }
  // 把跟前那一处摘下来
  pickNear() {
    const sp = this.nearSpot; if (!sp || !sp.there || this.mode !== 'foot' || this.trans) return false;
    const I = itemOf(sp.kind), n = 1 + (((sp.i * 7 + this.dayN * 3) % 4) === 0 ? 1 : 0);
    this.forage.userData.take(sp); this.picked.set(sp.i, this.dayN); this.nearSpot = null;
    this.bag[I.id] = Math.min(99, (this.bag[I.id] || 0) + n);
    const first = !this.items.has(I.id); this.items.add(I.id);
    this.speed = 0; this.holding = false;
    this.faceYaw = this.yaw = this.yawT = Math.atan2(sp.x - this.p.x, sp.z - this.p.z);
    this.T.play('Interact', 0.9, 0.15);
    this.sound.pluck?.();
    this.say(`${I.name} +${n}（行囊里有 ${this.bag[I.id]} 个）`, 2.6);
    if (first) this.onItem?.(I, n);
    this.tell('forage', `${I.verb}到了${I.name}，收在手记的「行囊」里\n到营地坐下烤火的时候可以拿来做饭`, 6.5);
    return true;
  }
  // 坐在火边做饭：ings 是材料 id（一到三个，可以重复）。返回 { dish: { id, s }, D 菜谱, isNew } 或 null
  cook(ings) {
    if (!this.sitting || !Array.isArray(ings) || !ings.length || ings.length > 3) return null;
    const need = {}; for (const id of ings) need[id] = (need[id] || 0) + 1;
    for (const id in need) if (!((this.bag[id] || 0) >= need[id])) return null;
    for (const id in need) { this.bag[id] -= need[id]; if (this.bag[id] <= 0) delete this.bag[id]; }
    const dish = cookDish(ings), D = dishOf(dish.id), isNew = !this.recipes.has(dish.id);
    this.recipes.add(dish.id);
    this.note('cook', this.site.id, dish.id);
    this.showPot();
    return { dish, D, isNew };
  }
  showPot() { if (!this.pot || !this.sitting) return; const f = this.site.fireAt; this.pot.position.set(f.x, f.y - 0.02, f.z); this.pot.rotation.y = this.site.yaw || 0; this.pot.visible = true; }
  // 做好的菜装进行囊（最多带 12 份）
  keepDish(dish) { if (this.dishes.length >= 12) return false; this.dishes.push(dish); return true; }
  // 吃一份：行囊里第 i 份，或者刚出锅的那份
  eat(d) {
    if (typeof d === 'number') { const i = d; d = this.dishes[i]; if (!d) return null; this.dishes.splice(i, 1); }
    const e = dishEffect(d), S = this.stamina, D = dishOf(d.id);
    S.v = Math.min(S.max, S.v + e.rest); if (S.v >= Math.min(30, S.max * 0.3)) S.spent = false;
    S.extra = Math.max(S.extra, e.extra);
    for (const [k, sec] of e.buff) this.buffs[k] = Math.max(this.buffs[k] || 0, sec);
    this.sound.chime?.(0.3);
    if (!this.sitting) this.say(`吃了${D.name}：${effectText(d)}`, 4);
    return { D, e };
  }
  // 拿到一根风羽：每三根气力多一格
  award(id) {
    if (this.feathers.has(id)) return false;
    this.feathers.add(id);
    const n = this.feathers.size, up = n % 3 === 0;
    this.stamina.bonus = Math.floor(n / 3) * PIP;
    if (up) this.stamina.fill();
    this.note('feather', id);
    this.sound.chime?.(0.75);
    this.ui.banner('风羽 +1', up ? '攒够三根，气力多了一格' : `再找 ${3 - n % 3} 根，气力多一格`, 5);
    this.onFeather?.(id);
    return true;
  }
  // ---------- 存档 ----------
  snapshot() {
    const mode = this.mode === 'fly' || this.uiMode === 'fly' ? 'foot' : this.uiMode === 'ride' ? 'ride' : 'foot';
    const r = v => Math.round(v * 100) / 100;
    return {
      mount: this.mountKey, mode, x: r(this.p.x), z: r(this.p.z), yaw: r(this.yaw), tod: r(this.tod), day: this.dayN,
      visited: [...this.visited], dist: { foot: Math.round(this.dist.foot), ride: Math.round(this.dist.ride), fly: Math.round(this.dist.fly) },
      travelT: Math.round(this.travelT), gaits: { ...this.gaits }, viewDone: this.viewDone, glanceDone: this.glanceDone,
      ex: this.explored.encode(), way: this.waypoint ? { ...this.waypoint } : null,
      camps: [...this.camps], log: this.log.slice(-500), wx: this.weather?.snapshot(),
      found: this.found, tips: [...this.tips],
      st: this.stamina.snapshot(), told: [...this.told],
      bag: { ...this.bag }, dishes: this.dishes.map(d => ({ id: d.id, s: Math.round(d.s * 100) / 100 })), recipes: [...this.recipes], items: [...this.items],
      buffs: Object.fromEntries(Object.entries(this.buffs).filter(([, v]) => v > 1).map(([k, v]) => [k, Math.round(v)])),
      picked: [...this.picked].filter(([, d]) => d === this.dayN),
      feathers: [...this.feathers], lamps: [...this.lamps], wishes: [...this.wishes],
    };
  }
  restore(s) {
    if (s.mount && this.mounts[s.mount]) this.startWith(s.mount);
    // 不在近景范围里（飞得太远）或者在水里，就回到最近去过的地方
    const m = 14, inside = (x, z) => x > DOM.x0 + m && x < DOM.x0 + DOM.w - m && z > DOM.z0 + m && z < DOM.z0 + DOM.d - m;
    let x = +s.x, z = +s.z, yaw = +s.yaw || 0;
    if (!Number.isFinite(x) || !Number.isFinite(z) || !inside(x, z) || this.waterDepth(x, z) > 0.25) {
      const P = (s.visited || []).map(id => this.places.find(p => p.id === id && p.x !== undefined)).filter(Boolean)
        .sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0];
      if (P) { x = P.x; z = P.z; } else { ROAD.at(SPOTS.start, _p); x = _p.x; z = _p.z; }
    }
    this.teleport(x, z, yaw, s.mode === 'ride' ? 'ride' : 'foot');
    this.phase = 'intro';
    this.tod = Number.isFinite(+s.tod) ? ((+s.tod % 24) + 24) % 24 : START_TOD;
    this.dayN = Math.max(1, s.day | 0);
    this.visited = (s.visited || []).filter(id => this.places.some(p => p.id === id));
    if (s.dist) for (const k of ['foot', 'ride', 'fly']) this.dist[k] = +s.dist[k] || 0;
    this.travelT = +s.travelT || 0;
    if (s.gaits) for (const k of ['foot', 'ride', 'fly']) if (s.gaits[k] >= 0 && s.gaits[k] <= 2) this.gaits[k] = s.gaits[k] | 0;
    this.viewDone = !!s.viewDone; this.glanceDone = !!s.glanceDone;
    this.camps = new Set(['camp', ...(Array.isArray(s.camps) ? s.camps : []).filter(id => this.sites.some(S => S.id === id))]);
    this.log = Array.isArray(s.log) ? s.log.filter(e => e && typeof e.k === 'string').slice(-500) : [];
    this.found = {};
    if (s.found && typeof s.found === 'object') for (const [id, f] of Object.entries(s.found)) if (findOf(id) && f) this.found[id] = { d: f.d | 0 || 1, h: +f.h || 0, ...(f.n ? { n: f.n | 0 } : {}), ...(typeof f.photo === 'string' ? { photo: f.photo } : {}), ...(Number.isFinite(f.x) && Number.isFinite(f.z) ? { x: f.x, z: f.z } : {}) };
    this.tips = new Set((Array.isArray(s.tips) ? s.tips : []).filter(id => findOf(id) && !this.found[id]));
    // 地图：老存档没有记走过哪里，就把去过的地方周围亮出来
    this.explored.clear();
    if (!(typeof s.ex === 'string' && this.explored.decode(s.ex)))
      for (const id of this.visited) { const P = this.places.find(p => p.id === id && p.x !== undefined); if (P) this.explored.reveal(P.x, P.z, P.r + 46); }
    this.explored.reveal(this.p.x, this.p.z, 46);
    const w = s.way;
    this.waypoint = w && Number.isFinite(+w.x) && Number.isFinite(+w.z) ? { id: w.id || null, name: String(w.name || '标记的地方').slice(0, 20), x: +w.x, z: +w.z, r: Math.min(30, Math.max(6, +w.r || 8)) } : null;
    this.ui.progress(this.visited.length / this.places.length); this.ui.journal?.(this.visited.length, this.places.length);
    if (this.weather && s.wx) this.weather.restore(s.wx);
    this.stamina.restore(s.st); this.told = new Set(Array.isArray(s.told) ? s.told.filter(k => typeof k === 'string').slice(0, 60) : []);
    this.shore.x = this.p.x; this.shore.z = this.p.z;
    // 行囊
    this.bag = {}; if (s.bag && typeof s.bag === 'object') for (const I of ITEMS) { const n = Math.min(99, s.bag[I.id] | 0); if (n > 0) this.bag[I.id] = n; }
    this.dishes = (Array.isArray(s.dishes) ? s.dishes : []).filter(d => d && dishOf(d.id)).slice(0, 24).map(d => ({ id: d.id, s: Math.min(2, Math.max(1, +d.s || 1)) }));
    this.recipes = new Set((Array.isArray(s.recipes) ? s.recipes : []).filter(id => dishOf(id)));
    this.items = new Set([...(Array.isArray(s.items) ? s.items : []), ...Object.keys(this.bag)].filter(id => itemOf(id)));
    this.buffs = {}; if (s.buffs && typeof s.buffs === 'object') for (const k of Object.keys(BUFFS)) { const v = +s.buffs[k]; if (v > 0) this.buffs[k] = Math.min(1800, v); }
    this.picked = new Map((Array.isArray(s.picked) ? s.picked : []).filter(e => Array.isArray(e) && e[1] === this.dayN).map(e => [e[0] | 0, e[1] | 0]));
    this.forageDay = -1;
    // 风羽
    const strs = a => (Array.isArray(a) ? a : []).filter(v => typeof v === 'string').slice(0, 60);
    this.feathers = new Set(strs(s.feathers).filter(id => !this.quests || this.quests.of(id))); this.lamps = new Set(strs(s.lamps)); this.wishes = new Set(strs(s.wishes));
    this.stamina.bonus = Math.floor(this.feathers.size / 3) * PIP; this.stamina.v = Math.min(this.stamina.v, this.stamina.max);
    this.quests?.refresh(this);
    this.applyDay(0);
    this.cam.play(introShot(() => this.yaw));
  }

  // ---------- 声音 ----------
  hoof(M, leg, pos, g) {
    if (this.phase === 'intro' || !M.root.visible) return;
    const near = M === this.mount && this.mode === 'ride' ? 1 : Math.max(0, 1 - pos.distanceTo(this.camera.position) / 30);
    if (near < 0.05) return;
    const wood = this.bridge.heightAt(pos.x, pos.z) !== null;
    this.sound.step(wood ? 'wood' : this.surface(pos.x, pos.z, 0.08), g, (leg[1] === 'F' ? 1 : 0.75) * near);
    if (wood || near < 0.3) return;
    // 蹄子落在哪：自己捏的马给的就是蹄子的位置；素材马给的是身子中间，按哪条腿往前后左右挪
    const S = M.st, fx = Math.sin(S.yaw), fz = Math.cos(S.yaw);
    let hx = pos.x, hz = pos.z;
    if (M.kind !== 'b') { const a = leg[1] === 'F' ? 0.58 : -0.52, b = leg[0] === 'L' ? 0.14 : -0.14; hx += fx * a + fz * b; hz += fz * a - fx * b; }
    this.kick(hx, hz, S.yaw, S.speed, sstep(1.2, 5.5, S.speed) * 0.6 + 0.4, true, leg === 'LF' || leg === 'RH');
  }
  // ---------- 脚下的反应：水花和水圈、尘土、雪沫、压倒的草（world/tread.js、ripples.js、puffs.js） ----------
  // 一只脚（蹄子）落在 (x, z)：往 yaw 那边走，速度 v，力度 k（0~1）；ring = 这一下要不要在水面荡一圈
  kick(x, z, yaw, v, k, hoof, ring = true) {
    const F = this.fx; if (!F || !F.on) return;
    const fx = Math.sin(yaw), fz = Math.cos(yaw), y = this.groundAt(x, z);
    const depth = this.waterDepth(x, z);
    if (depth > 0.03) {
      if (ring) F.ripples.add(x, z, (hoof ? 0.75 : 0.55) + 0.5 * k);
      if (v > 0.7) F.puffs.splash(x, y + depth, z, (hoof ? 0.55 : 0.3) + 0.6 * k, fx, fz);
      return;
    }
    if (this.land.height(x, z) - this.land.ground(x, z) > 0.02) return;      // 冰面上什么也溅不起来
    const L = this.land;
    if (L.snow(x, z) > 0.45 || this.weather?.cover > 0.35) { if (v > 1.0) F.puffs.puff('snow', x, y, z, k, fx, fz); }
    else if (L.sand(x, z) > 0.5) { if (v > 1.4) F.puffs.puff('sand', x, y, z, k, fx, fz); }
    else if (v > (hoof ? 2.3 : 3.0) && L.roadDist(x, z) < 1.7 && !(this.weather?.wet > 0.3)) F.puffs.puff('dust', x, y, z, k, fx, fz);   // 土路上跑起来才扬尘，下过雨就没有
  }
  // 重重落一下（从天上落地、跳下马）：四周溅一圈，草压倒一片
  thud(x, z, k) {
    const F = this.fx; if (!F || !F.on) return;
    const y = this.groundAt(x, z), depth = this.waterDepth(x, z);
    F.tread.stamp(x, z, 0.7 + 0.8 * k, 1, 0, 0);
    if (depth > 0.03) { F.ripples.add(x, z, 0.9 + 0.5 * k); F.puffs.ring('water', x, y + depth, z, 0.6 + 0.5 * k); }
    else if (this.land.snow(x, z) > 0.45) F.puffs.ring('snow', x, y, z, k);
    else if (this.land.sand(x, z) > 0.5) F.puffs.ring('sand', x, y, z, k);
    else if (this.land.roadDist(x, z) < 1.7) F.puffs.ring('dust', x, y, z, k);
  }
  // 每帧：人和看得见的坐骑把脚下的草压倒；站在水里不动，水面也时不时荡一圈
  feelTick(dt) {
    const F = this.fx; if (!F) return;
    const air = this.mode === 'fly';
    F.tread.update(dt, this.p.x, this.p.z); F.ripples.center(this.p.x, this.p.z);
    if (!F.on) return;
    const riding = this.mode === 'ride' && !this.trans;
    if (!air && !riding && !this.sitting && !this.air && !this.swimming) F.tread.stamp(this.p.x, this.p.z, 0.6, 0.95, Math.sin(this.yaw), Math.cos(this.yaw));
    for (const M of Object.values(this.mounts)) {
      if (!M || !M.root.visible) continue;
      const S = M.st, fx = Math.sin(S.yaw), fz = Math.cos(S.yaw), big = M.kind === 'd' || M.kind === 'b' ? 0.85 : 1;
      F.tread.stamp(S.p.x + fx * 0.55 * big, S.p.z + fz * 0.55 * big, 0.85 * big, 1, fx, fz);
      F.tread.stamp(S.p.x - fx * 0.5 * big, S.p.z - fz * 0.5 * big, 0.85 * big, 1, fx, fz);
    }
    this.wadeT = (this.wadeT || 0) - dt;
    if (this.wadeT < 0 && !air) {
      this.wadeT = 1.5 + Math.random() * 0.8;
      const who = riding ? this.mount.st : this;
      if ((who.speed || 0) < 0.3 && this.waterDepth(who.p.x, who.p.z) > 0.05) F.ripples.add(who.p.x + (Math.random() - 0.5) * 0.3, who.p.z + (Math.random() - 0.5) * 0.3, 0.4);
    }
  }
  // 现在该放哪种曲子：营地烤火 > 夜里 > 飞得很高 > 雪原冰湖 / 红叶谷 / 谷地（谷地黄昏换一首）
  musicMood() {
    const hp = this.p, au = this.land.autumn(hp.x, hp.z);
    const cold = Math.max(this.land.snow(hp.x, hp.z), 1 - sstep(1.4, 2.6, lakeQ(hp.x, hp.z)));
    const coast = coastCT(hp.x, hp.z)[0], bam = this.land.bamboo(hp.x, hp.z);
    let r = this.region;
    if (cold > 0.45) r = 'snow';
    else if (r === 'snow' && cold > 0.2) r = 'snow';
    else if (au > 0.4) r = 'autumn';
    else if (r === 'autumn' && au > 0.15) r = 'autumn';
    else if (coast > -75) r = 'coast';
    else if (r === 'coast' && coast > -100) r = 'coast';
    else if (bam > 0.4) r = 'bamboo';
    else if (r === 'bamboo' && bam > 0.12) r = 'bamboo';
    else r = 'valley';
    this.region = r;
    if (this.mode === 'fly' && this.alt > 40) this.highUp = true; else if (this.mode !== 'fly' || this.alt < 22) this.highUp = false;
    if (this.night > 0.6) this.nightMusic = true; else if (this.night < 0.35) this.nightMusic = false;
    if (this.sitting && this.site.lit > 0.3) return 'camp';
    if (this.nightMusic) return 'night';
    // 下雨天换一首安静的（雨停一会儿再换回去）
    const rk = this.weather?.k.r || 0;
    if (rk > 0.5) this.rainMusic = true; else if (rk < 0.15) this.rainMusic = false;
    if (this.rainMusic && !this.highUp) return 'rain';
    if (this.highUp) return 'sky';
    if (r === 'valley' && this.tod >= 17.2) return 'dusk';
    return r;
  }
  mix(dt) {
    this.mixT -= dt; if (this.mixT > 0 || !this.sound.ready) return;
    this.mixT = 0.2;
    const hp = this.p, cp = this.camera.position;
    const river = 1 - sstep(3, 48, Math.min(this.land.streamDist(hp.x, hp.z), this.land.streamDist(cp.x, cp.z)) + (this.mode === 'fly' ? this.alt * 0.6 : 0));
    let pan = 0;
    const q = STREAM.nearest(cp.x, cp.z, 120);
    if (q.dist < 1e9) {
      const sp = STREAM.at(q.s, _p);
      _w.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
      const dx = sp.x - cp.x, dz = sp.z - cp.z;
      pan = clamp((dx * _w.x + dz * _w.z) / Math.max(2, Math.hypot(dx, dz)), -0.8, 0.8);
    }
    const trees = this.colliders.count(hp.x, hp.z, 16);
    const low = this.mode === 'fly' ? 1 - sstep(10, 40, this.alt) : 1;
    // 一阵一阵的风：每两三秒换一个目标，慢慢靠过去
    this.gustT -= 0.2;
    if (this.gustT < 0) { this.gustT = 1.5 + Math.random() * 3.5; this.gustTo = 0.45 + Math.random() * 1.1; }
    this.gust += (this.gustTo - this.gust) * 0.12;
    // 雪地里鸟和虫子都少，风大；红叶谷里树叶沙沙响，跟着风一阵一阵的
    const snow = this.land.snow(hp.x, hp.z), au = this.land.autumn(hp.x, hp.z);
    const birds = (0.3 + 0.7 * sstep(2, 10, trees)) * (this.daylight?.st.birds ?? 1) * low * (1 - 0.8 * snow) * (1 - 0.3 * au);
    const crickets = sstep(0.15, 0.7, this.night) * (this.mode === 'fly' ? 1 - sstep(6, 30, this.alt) : 1) * (0.55 + 0.45 * sstep(0, 6, trees)) * (1 - snow);
    const windy = Math.max(snow, this.mode === 'fly' ? sstep(10, 50, this.alt) : sstep(30, 80, hp.y));
    const wind = ((this.mode === 'fly' ? 0.45 + 0.55 * sstep(6, 18, this.speed) : 0.22 + 0.45 * sstep(1.5, 30, hp.y) + (this.phase === 'view' ? 0.25 : 0)) + 0.35 * snow)
      * (1 + (this.gust - 1) * (0.25 + 0.6 * windy));
    const leaves = sstep(0.1, 0.6, au) * low * (0.35 + 0.65 * this.gust) * (0.4 + 0.6 * sstep(1, 6, trees));
    const fs = this.lightSite, fire = fs ? fs.lit * (1 - sstep(3, 26, cp.distanceTo(fs.fireAt))) : 0;
    // 叠水：最近的一道，越近越响、跌得越高越响，左右跟着方向
    let falls = 0, fallsPan = 0;
    for (const f of this.fallsAt) {
      const dx = f.x - cp.x, dz = f.z - cp.z, d = Math.min(Math.hypot(dx, dz), Math.hypot(f.x - hp.x, f.z - hp.z)) + (this.mode === 'fly' ? this.alt * 0.5 : 0);
      const v = f.k * (1 - sstep(4, 60, d));
      if (v > falls) {
        falls = v;
        _w.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
        fallsPan = clamp((dx * _w.x + dz * _w.z) / Math.max(2, Math.hypot(dx, dz)), -0.8, 0.8);
      }
    }
    // 海浪：离海岸越近越响，从海那边传过来；竹林里竹叶沙沙（跟着风）；下雨的沙沙声
    const cst = coastCT(cp.x, cp.z)[0], surf = 1 - sstep(8, 110, -cst + (this.mode === 'fly' ? this.alt * 0.6 : 0));
    _w.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const surfPan = clamp(SEA.nx * _w.x + SEA.nz * _w.z, -0.75, 0.75);
    const bam = this.land.bamboo(hp.x, hp.z), bamboo = sstep(0.1, 0.6, bam) * low * (0.35 + 0.65 * this.gust);
    const wk = this.weather?.k || { r: 0, s: 0 };
    const rain = wk.r * (this.sitting ? 0.7 : 1);
    this.sound.update({ river, birds: birds * (1 - 0.7 * wk.r), wind: wind * (1 + 0.4 * wk.r + 0.3 * wk.s), fire, crickets: crickets * (1 - 0.8 * wk.r), leaves, falls, bamboo, surf, rain, riverPan: pan, fallsPan, surfPan });
    // 竹林里：竹竿被风吹得互相碰一下，“笃”
    this.knockT -= 0.2;
    if (this.knockT < 0) { this.knockT = 2 + Math.random() * 5 / (0.5 + this.gust); if (bamboo > 0.2) this.sound.knock?.((0.3 + 0.5 * Math.random()) * bamboo, Math.random() * 1.4 - 0.7); }
    // 雨下得大的时候，远处偶尔闷雷
    this.thunderT -= 0.2;
    if (this.thunderT < 0) { this.thunderT = 35 + Math.random() * 70; if (wk.r > 0.8) this.sound.thunder?.(0.4 + 0.4 * Math.random(), Math.random() * 1.4 - 0.7); }
    // 冰湖上和湖边：隔一阵冰面“啾——”一声，偶尔深处闷闷地“咚”
    const lq = lakeQ(hp.x, hp.z);
    this.iceT -= 0.2;
    if (this.iceT < 0) {
      this.iceT = 5 + Math.random() * 14;
      const near = 1 - sstep(0.9, 2.4, lq);
      if (near > 0.05 && low > 0.3) {
        if (Math.random() < 0.18) this.sound.iceBoom?.((0.4 + 0.4 * Math.random()) * near, Math.random() * 1.2 - 0.6);
        else this.sound.iceSing?.((0.45 + 0.55 * Math.random()) * near, Math.random() * 1.4 - 0.7);
      }
    }
    // 风车坡：风车转着，木头偶尔吱呀一声
    this.millT -= 0.2;
    if (this.millT < 0) {
      this.millT = 4 + Math.random() * 6;
      const dx = MILL.x - cp.x, dz = MILL.z - cp.z, d = Math.hypot(dx, dz);
      if (d < 50) {
        _w.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
        this.sound.creak?.((0.5 + 0.5 * Math.random()) * (1 - sstep(8, 50, d)), clamp((dx * _w.x + dz * _w.z) / Math.max(2, d), -0.8, 0.8));
      }
    }
    // 音乐：坐下时轻一点，夜里也轻一点，叠水旁边让一让
    const mood = this.musicMood();
    const music = (mood === 'camp' ? 0.36 : 0.42 * (1 - 0.3 * this.night)) * (1 - 0.3 * falls);
    if (Math.abs(music - (this.musicNow ?? -1)) > 0.01) { this.musicNow = music; this.sound.musicLevel(music); }
    this.sound.wantMood?.(mood, 0.2);
    // 夜里树林边偶尔有猫头鹰
    this.owlT -= 0.2;
    if (this.owlT < 0) { this.owlT = 28 + Math.random() * 50; if (this.night > 0.6 && trees > 2 && low > 0.5) this.sound.owl?.(0.35 + Math.random() * 0.3, Math.random() * 1.4 - 0.7); }
  }
}

// ---------- 挡路的东西：圆（树干、风车、帐篷）和线段（栅栏） ----------
export class Colliders {
  constructor() { this.cell = 8; this.grid = new Map(); this.list = []; }
  key(gx, gz) { return gx * 73856093 ^ gz * 19349663; }
  // cr：树冠在镜头高度的半径（镜头不要钻进去）
  addCircle(x, z, r, h = 99, cr = 0) { const e = Math.max(r, cr); this.add({ x, z, r, h, cr, seg: false }, x - e, z - e, x + e, z + e); }
  // 从 (ax,az) 往 (bx,bz) 走，第一次碰到树冠在哪（0~1，没碰到是 1）
  firstHit(ax, az, bx, bz) {
    const L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / 0.35);
    for (let i = 3; i <= n; i++) {
      const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      const a = this.grid.get(this.key(Math.floor(x / this.cell), Math.floor(z / this.cell)));
      if (a) for (const c of a) if (c.cr && (c.x - x) ** 2 + (c.z - z) ** 2 < c.cr * c.cr) return t;
    }
    return 1;
  }
  addSeg(ax, az, bx, bz, r, h = 1.2) { this.add({ ax, az, bx, bz, r, h, seg: true }, Math.min(ax, bx) - r, Math.min(az, bz) - r, Math.max(ax, bx) + r, Math.max(az, bz) + r); }
  add(c, x0, z0, x1, z1) {
    this.list.push(c);
    for (let gx = Math.floor(x0 / this.cell); gx <= Math.floor(x1 / this.cell); gx++)
      for (let gz = Math.floor(z0 / this.cell); gz <= Math.floor(z1 / this.cell); gz++) {
        const k = this.key(gx, gz); let a = this.grid.get(k); if (!a) this.grid.set(k, a = []); a.push(c);
      }
  }
  // 把点 (x,z) 推到所有碰撞体外面（半径 R）；h 是高度（飞的时候超过就不挡）
  resolve(x, z, R, alt = 0) {
    const a = this.grid.get(this.key(Math.floor(x / this.cell), Math.floor(z / this.cell)));
    if (!a) return [x, z];
    for (let it = 0; it < 2; it++) {
      for (const c of a) {
        if (alt > c.h) continue;
        let px, pz;
        if (c.seg) {
          const dx = c.bx - c.ax, dz = c.bz - c.az, l2 = dx * dx + dz * dz || 1e-9;
          let t = ((x - c.ax) * dx + (z - c.az) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
          px = c.ax + dx * t; pz = c.az + dz * t;
        } else { px = c.x; pz = c.z; }
        const ex = x - px, ez = z - pz, d = Math.hypot(ex, ez), m = c.r + R;
        if (d < m && d > 1e-6) { x = px + ex / d * m; z = pz + ez / d * m; }
      }
    }
    return [x, z];
  }
  count(x, z, r) {
    let n = 0;
    for (let gx = Math.floor((x - r) / this.cell); gx <= Math.floor((x + r) / this.cell); gx++)
      for (let gz = Math.floor((z - r) / this.cell); gz <= Math.floor((z + r) / this.cell); gz++) {
        const a = this.grid.get(this.key(gx, gz)); if (!a) continue;
        for (const c of a) if (!c.seg && (c.x - x) ** 2 + (c.z - z) ** 2 < r * r) n++;
      }
    return n;
  }
}
