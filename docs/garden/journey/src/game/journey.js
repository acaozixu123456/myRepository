// 自由旅行：步行、骑马、飞行三种走法，在谷地里随意走。按住屏幕往前，左右拖动转向（飞的时候上下拖动爬升、下降）。
// 在山路上不拖动时会自动顺着路走；谷地里有十处地方（第一次到会出地名横幅，记进旅行手记）；
// 第一次到望远台有一段远景；在山口营地可以坐下烤火，看这一路的手记。太阳随时间慢慢落下。
import * as THREE from 'three';
import { ROAD, STREAM, SPOTS } from '../world/route.js';
import { DOM, CENTER, waterY, SHOAL } from '../world/land.js';
import { U } from '../world/atmo.js';
import { SKY } from '../world/sky.js';
import { viewpointShot, campShot, introShot, releaseShot } from './cam.js';

export const GAITS = {
  foot: [{ name: '散步', v: 1.15 }, { name: '快走', v: 1.8 }, { name: '跑', v: 4.4 }],
  ride: [{ name: '慢步', v: 1.6 }, { name: '小跑', v: 3.3 }, { name: '奔跑', v: 5.6 }],
  fly: [{ name: '滑翔', v: 8 }, { name: '飞', v: 12.5 }, { name: '疾飞', v: 18 }],
};
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const DEG = Math.PI / 180;
const DUSK_TIME = 600;   // 走 10 分钟太阳落到山口

// 黄昏：太阳高度和颜色（0 = 下午晚些，1 = 落到山口，1.25 = 营地天黑一点）
const C = (a, b) => [new THREE.Color(a), new THREE.Color(b)];
const DUSK = {
  sun: C('#ffd9a8', '#ffa66a'), fogSun: C('#ffcf98', '#ffae7c'), fogFar: C('#b4c0dc', '#b2aed0'),
  zenith: C('#6c98d4', '#5b7ec2'), mid: C('#a8bde0', '#b4b2d8'), glow: C('#ffc98a', '#ffa46e'),
  cloudLit: C('#fff1dc', '#ffd2ae'), cloudShade: C('#b5a8c4', '#a898bc'), hemiSky: C('#bfd0f2', '#b6b8e2'), hemiGround: C('#94844f', '#8a6e4c'),
};
// 骑手盆骨相对马鞍挂点的微调（每种坐骑不一样）
const SEAT = { b: [0, 0.07, -0.04], a: [0, 0.09, -0.02], w: [0, 0.09, -0.02], d: [0, 0.07, 0.0] };

export function makePlaces() {
  const at = s => ROAD.at(s, {});
  const st = at(SPOTS.start), br = at(SPOTS.bridge), gr = at(SPOTS.grove[0] + 6), vw = at(SPOTS.view), cp = at(SPOTS.camp);
  return [
    { id: 'valley', name: '暖光谷地', sub: '沿着小溪，往山口去', where: '出发的地方', x: st.x, z: st.z - 6, r: 20 },
    { id: 'east', name: '东坡花田', sub: '一坡的花，在夕阳里晃', where: '出发后往右手边（东边）的山坡走', x: 75, z: -25, r: 26 },
    { id: 'bridge', name: '溪上木桥', sub: '水声近了', where: '顺着山路往前，过溪的地方', x: br.x, z: br.z, r: 9 },
    { id: 'mill', name: '风车坡', sub: '风车慢慢转，坡下就是小溪', where: '木桥右前方的山坡上', x: 62, z: -118, r: 16 },
    { id: 'shoal', name: '浅滩', sub: '溪水漫过圆石，可以蹚水过去', where: '从木桥往左，沿着小溪往上游走', x: SHOAL.x, z: SHOAL.z, r: 14 },
    { id: 'west', name: '西岭松林', sub: '松针的味道，风从山口吹来', where: '浅滩对岸，西边山坡上', x: -150, z: -165, r: 26 },
    { id: 'grove', name: '林荫小道', sub: '树影一道一道落在路上', where: '过了木桥，山路两边的树林', x: gr.x, z: gr.z, r: 14 },
    { id: 'view', name: '望远台', sub: '回头看看，走过的溪谷都在脚下', where: '山路快到头，有一张长椅', x: vw.x - 3, z: vw.z, r: 9 },
    { id: 'camp', name: '山口营地', sub: '今晚在这里歇脚', where: '山路尽头，可以坐下烤火', x: cp.x, z: cp.z, r: 14 },
    { id: 'sky', name: '云端', sub: '整个谷地都在脚下', where: '点“飞”，一直往上飞', alt: 50 },
  ];
}

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _o = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _h = [new THREE.Vector3(), new THREE.Vector3()], _bit = [new THREE.Vector3(), new THREE.Vector3()], _cr = new THREE.Vector3(), _e = new THREE.Euler();
const _p = {};

export class Journey {
  // o: { land, bridge, camp, mounts: {b, a, w, d}, traveler, wings, reins, cam, sound, ui, camera, sun, hemi, colliders }
  constructor(o) {
    Object.assign(this, o);
    this.T = o.traveler;
    this.places = makePlaces();
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
    this.p = new THREE.Vector3(); this.vy = 0;
    this.t = 0;
    this.reset();
    this.dusk = 0; this.applyDusk(0);
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
    this.p.set(x, this.groundAt(x, z), z); this.yaw = this.yawT = yaw;
    this.speed = 0; this.vy = 0;
    this.mode = mode;
    for (const M of Object.values(this.mounts)) if (M && M !== this.mount) { M.root.visible = false; M.st.shown = false; }
    const M = this.mount;
    if (mode === 'ride') { M.st.p.copy(this.p); M.st.yaw = yaw; M.st.shown = true; M.root.visible = true; this.T.set('ride', 50); }
    else if (mode === 'foot') { this.T.set('loco', 50); M.root.visible = false; M.st.shown = false; }
    else {
      this.T.set('fly', 50); M.root.visible = false; M.st.shown = false;
      this.p.y = this.land.height(x, z) + alt; this.speed = this.gaitV('fly'); this.flyPitch = 70 * DEG;
      this.wings.show(true); this.wings.open = 1;
    }
    this.cam.inited = false;
  }

  reset() {
    ROAD.at(SPOTS.start, _p);
    this.p.set(_p.x, 0, _p.z); this.p.y = this.groundAt(this.p.x, this.p.z);
    this.yaw = this.yawT = Math.atan2(_p.tx, _p.tz);
    this.speed = 0; this.vy = 0; this.turn = 0; this.slope = 0; this.climb = 0; this.bank = 0; this.flyPitch = 0; this.liftT = 0; this.alt = 0;
    this.waitMount = false; this.landTo = null; this.pendingMode = null;
    this.mode = 'ride'; this.trans = null; this.phase = 'intro';
    this.steerT = 0; this.idleT = 0; this.travelT = 0;
    this.dist = { foot: 0, ride: 0, fly: 0 };
    this.visited = []; this.inPlace = new Set(); this.placeT = 0; this.labelT = 0;
    this.viewDone = false; this.glanceDone = false; this.glance = null;
    this.sitting = false; this.lit = 0; this.campT = 0; this.summaryShown = false;
    this.snortT = 18 + Math.random() * 20; this.mixT = 0; this.hintT = 0; this.edgeT = 0;
    this.camp.userData.fire.visible = false;
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
    if (this.mode === 'fly') { this.yawT -= dx * 2.3; this.climb = clamp(this.climb - dy * 5, -1, 1); }
    else { this.yawT -= dx * 2.6; this.cam.pitchOff = clamp(this.cam.pitchOff + dy * 3.2, -1.2, 3); this.cam.pitchHold = 2; }
    this.steerT = 1.4;
  }
  keys(dt, turnKey, climbKey) {
    if (turnKey) { this.yawT -= turnKey * dt * (this.mode === 'fly' ? 1.2 : 1.9); this.steerT = 1.0; }
    if (climbKey && this.mode === 'fly') this.climb = clamp(this.climb + climbKey * dt * 3, -1, 1);
  }

  // 切换走法：foot / ride / fly
  setMode(m) {
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
    this.yawT = this.yaw + wrap(this.yawT - this.yaw);
    if (this.trans) this.transTick(dt);
    if (!this.trans && this.pendingMode) { const m = this.pendingMode; this.pendingMode = null; if (m !== this.uiMode) this.setMode(m); }
    const tk = this.trans?.kind;
    if (!tk || tk === 'descend' || tk === 'swap' || (tk === 'takeoff' && this.mode === 'fly')) {
      if (this.mode === 'fly') this.flyMove(dt); else if (!this.sitting) this.groundMove(dt);
    }
    this.mountsTick(dt);
    this.placeTraveler(dt);
    this.camTick(dt);
    if (playing) this.story(dt);
    if (this.sitting) this.campTick(dt);
    this.campfire(dt);
    // 黄昏：随旅行时间慢慢落下；在营地坐下时再暗一点
    const duskT = this.sitting ? 1.25 : Math.max(this.dusk, Math.min(1, this.travelT / DUSK_TIME));
    if (Math.abs(duskT - this.dusk) > 1e-4) { this.dusk = damp(this.dusk, duskT, this.sitting ? 0.25 : 0.8, dt); this.applyDusk(this.dusk); }
    this.mix(dt);
    this.snortT -= dt;
    if (this.snortT < 0) { this.snortT = 22 + Math.random() * 35; if (this.mode === 'ride' && this.phase !== 'intro' && this.speed < 2) this.sound.snort(); }
  }

  // ---------- 地面上走（步行或骑马） ----------
  groundMove(dt) {
    const riding = this.mode === 'ride';
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
      if (grade > maxG) { nx = this.p.x; nz = this.p.z; this.speed *= 0.6; this.hintOnce('太陡了，换个方向'); }
      else if (grade > 0.3) this.speed *= 1 - (grade - 0.3) * dt * 1.5;
      // 太深的水不进去（步行）
      if (!riding && this.waterDepth(nx, nz) > 0.62) { nx = this.p.x; nz = this.p.z; this.speed *= 0.5; this.hintOnce('水太深了，走桥或者浅滩'); }
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
  // 在路上、没有手动转向时，慢慢顺着路走
  followRoad(dt) {
    if (this.steerT > 0 || this.speed < 0.25) return;
    const q = ROAD.nearest(this.p.x, this.p.z, 8);
    if (!(q.dist < 4.5)) return;
    ROAD.at(q.s, _p);
    let ry = Math.atan2(_p.tx, _p.tz), dir = 1;
    if (Math.abs(wrap(ry - this.yaw)) > Math.PI / 2) { ry = wrap(ry + Math.PI); dir = -1; }
    if (Math.abs(wrap(ry - this.yaw)) > 1.0) return;
    // 往前看几米的路，弯道上提前转
    ROAD.at(q.s + dir * 4, _p);
    const ahead = Math.atan2(_p.x - this.p.x, _p.z - this.p.z);
    const lat = Math.abs(q.d) > 0.5 ? q.d - Math.sign(q.d) * 0.5 : 0;
    const want = wrap(lerp(ry, ry + wrap(ahead - ry), 0.6) + clamp(lat * 0.1 * dir, -0.3, 0.3));
    const k = sstep(4.5, 2, q.dist);
    this.yawT = this.yaw + wrap(want - this.yaw) * Math.min(1, dt * 3 * k + 0.02);
  }
  waterDepth(x, z) {
    const sd = this.land.streamDist(x, z);
    if (sd > 5) return 0;
    if (this.bridge.heightAt(x, z) !== null) return 0;
    const s = this.land.sample(this.land.strS, x, z);
    return Math.max(0, waterY(s) - this.land.heightExact(x, z));
  }

  // ---------- 飞 ----------
  flyMove(dt) {
    const descending = this.trans?.kind === 'descend';
    // 刚起飞的两秒多自己往上飞一段，不用按着
    const lifting = this.liftT > 0 && !descending; if (this.liftT > 0) this.liftT -= dt;
    const flap = (this.holding || this.auto || lifting) && this.phase === 'play' && !descending;
    this.flapping = flap;
    const target = flap ? this.gaitV('fly') : descending ? 6 : Math.max(6, this.speed * 0.995);
    this.speed = damp(this.speed, target, flap ? 0.9 : 0.35, dt);
    if (this.steerT <= 0) this.climb = damp(this.climb, 0, 0.8, dt);
    const maxTurn = 1.15;
    const dy = clamp(wrap(this.yawT - this.yaw), -maxTurn * dt, maxTurn * dt);
    this.yaw += dy;
    this.turn = damp(this.turn, dy / Math.max(dt, 1e-3), 3, dt);
    const g = this.land.height(this.p.x, this.p.z), alt = this.p.y - g;
    let vyT = lifting ? 5 : flap ? 0.6 + this.climb * 7 : -1.4 + this.climb * 4.5;
    if (descending) vyT = -Math.min(6, 1.5 + alt * 0.6);
    this.vy = damp(this.vy, vyT, 1.6, dt);
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    let nx = this.p.x + fx * this.speed * dt, nz = this.p.z + fz * this.speed * dt, ny = this.p.y + this.vy * dt;
    // 飞得低时躲开树干和风车
    if (alt < 10) { const r = this.colliders.resolve(nx, nz, 0.6, alt); nx = r[0]; nz = r[1]; }
    // 范围：离谷地中心 620 米以内
    const dx = nx - CENTER.x, dz = nz - CENTER.z, rr = Math.hypot(dx, dz);
    if (rr > 600) { this.yawT = this.yaw + wrap(Math.atan2(-dx, -dz) - this.yaw) * 0.04; this.steerT = 0.5; this.hintOnce('再往外云太厚了，往回飞'); }
    const ng = this.land.height(nx, nz);
    const floor = ng + 1.05, ceil = Math.min(ng + 160, 260);
    if (ny < floor) { ny = floor; this.vy = Math.max(0, this.vy); if (descending || (!flap && this.speed < 7.5)) this.touchdown(); }
    if (ny > ceil) { ny = ceil; this.vy = Math.min(0, this.vy); }
    this.dist.fly += Math.hypot(nx - this.p.x, nz - this.p.z);
    this.p.set(nx, ny, nz);
    // 姿态：越快身体越平，爬升时抬头，转弯时侧倾
    const pitchT = lerp(58, 76, sstep(6, 16, this.speed)) * DEG - this.vy * 2.2 * DEG;
    this.flyPitch = damp(this.flyPitch || pitchT, pitchT, 3, dt);
    this.bank = damp(this.bank, clamp(-this.turn * 0.55, -0.6, 0.6), 3, dt);
    this.alt = this.p.y - this.land.height(this.p.x, this.p.z);
  }
  touchdown() {
    if (this.trans?.kind === 'land') return;
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
        this.mode = 'fly'; this.T.set('fly', 3); this.liftT = 2.4;
        this.vy = 6.5; this.speed = Math.max(this.speed, 4); this.p.y = Math.max(this.p.y, this.groundAt(this.p.x, this.p.z) + (tr.from === 'ride' ? 1.6 : 0.4));
        this.flyPitch = 20 * DEG;
      }
      if (u >= 1) this.trans = null;
    } else if (tr.kind === 'land') {
      if (this.mode === 'fly') { this.mode = 'foot'; this.T.set('loco', 5); this.p.y = this.groundAt(this.p.x, this.p.z); this.speed = Math.min(this.speed, 2); this.vy = 0; }
      this.speed = damp(this.speed, 0, 3, dt);
      if (u >= 1) { this.trans = null; if (this.landTo === 'ride') this.callMount(); this.landTo = null; }
    } else if (tr.kind === 'descend') {
      // 由 flyMove 降到地面后 touchdown() 接手
    } else if (tr.kind === 'dismount') {
      this.speed = damp(this.speed, 0, 6, dt);
      if (u >= 1) { this.mode = 'foot'; this.p.copy(tr.to); this.speed = 0; this.trans = null; }
    } else if (tr.kind === 'mount') {
      if (u >= 1) { this.mode = 'ride'; const S = this.mount.st; this.p.copy(S.p); this.yaw = this.yawT = S.yaw; this.speed = 0; this.trans = null; }
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
          if (!S.goal && !this.trans && this.speed < 0.5 && S.speed < 0.35) this.startMount();
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
      const c = this.camp.userData;
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
    } else {
      T.root.rotation.set(0, this.yaw, 0);
      const k = tr && tr.kind === 'takeoff' ? 0 : 1;
      T.update(dt, { speed: this.speed * k, turn: this.turn, slope: this.slope, lookAt: this.lookTarget() });
      T.root.position.copy(this.p);
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
    this.wings.update(dt, { flap: flying && this.flapping ? clamp(this.speed / 12, 0.6, 1.4) : 0, glide: flying && !this.flapping, climb: this.vy, speed: this.speed });
    // 扇一下翅膀一声；走路一步一声
    const wc = Math.floor(this.wings.phase / (2 * Math.PI));
    if (wc !== this.wingC) { if (flying && this.flapping && this.phase !== 'intro') this.sound.whoosh(clamp(this.speed / 14, 0.5, 1.2)); this.wingC = wc; }
    const fc = Math.floor(T.phase * 2);
    if (fc !== this.footC) {
      this.footC = fc;
      if (this.mode === 'foot' && !tr && this.speed > 0.3 && !this.sitting && this.phase !== 'intro') {
        const x = this.p.x, z = this.p.z, wood = this.bridge.heightAt(x, z) !== null;
        this.sound.foot(wood ? 'wood' : this.waterDepth(x, z) > 0.05 ? 'water' : 'dirt', sstep(2.5, 4.5, this.speed));
      }
    }
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
    this.cam.update(dt, focus, this.yaw, { mode: this.trans?.kind === 'takeoff' && this.mode !== 'fly' ? 'foot' : this.mode, speed: this.speed, vy: this.vy, alt: this.alt || 0 });
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
          if (!this.visited.includes(P.id)) { this.visited.push(P.id); this.ui.banner(P.name, P.sub); this.labelT = 5; this.ui.place(''); this.ui.progress(this.visited.length / this.places.length); this.ui.journal?.(this.visited.length, this.places.length); }
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
    const f = this.camp.userData.fireAt;
    const nearFire = !this.sitting && this.mode !== 'fly' && !this.trans && Math.hypot(this.p.x - f.x, this.p.z - f.z) < 7;
    this.ui.action?.(nearFire ? '坐下烤火' : '');
    // 提示
    if (this.hintT > 0) { this.hintT -= dt; if (this.hintT <= 0) this.ui.hint(''); }
  }
  hintOnce(t) { if (this.hintT > 0) return; this.ui.hint(t); this.hintT = 3; }

  // 坐下烤火：一暗一亮之间换到树桩上
  sitAtCamp() {
    if (this.sitting || this.trans) return;
    const c = this.camp.userData;
    this.ui.fade(true);
    this.sitPending = 0.9;
  }
  campTick(dt) {
    this.campT += dt;
    if (this.campT > 7 && !this.summaryShown) { this.summaryShown = true; this.onCamp?.(); }
  }
  campfire(dt) {
    if (this.sitPending !== undefined && this.sitPending !== null) {
      this.sitPending -= dt;
      if (this.sitPending <= 0) { this.sitPending = null; this.doSit(); }
    }
    const fire = this.camp.userData.fire;
    this.lit = damp(this.lit, this.sitting || this.fireKept ? 1 : 0, 1.2, dt);
    fire.visible = this.lit > 0.02; fire.scale.setScalar(0.35 + 0.65 * this.lit);
    fire.userData.update(this.t, this.lit);
    this.camp.userData.lanLight.intensity = 1.8 * this.lit;
  }
  doSit() {
    const c = this.camp.userData, seat = c.seat, fire = c.fireAt;
    // 坐骑停到帐篷旁边吃草
    const M = this.mount;
    if (this.mode === 'ride') {
      const yaw = c.yaw; const px = seat.x + Math.cos(yaw) * -3.6 + Math.sin(yaw) * 2.2, pz = seat.z - Math.sin(yaw) * -3.6 + Math.cos(yaw) * 2.2;
      M.st.p.set(px, this.groundAt(px, pz), pz); M.st.yaw = yaw + 2.2; M.st.speed = 0; M.st.shown = true; M.root.visible = true;
    }
    this.mode = 'foot'; this.speed = 0; this.trans = null;
    this.sitting = true; this.campT = 0; this.fireKept = true;
    this.sitYaw = Math.atan2(fire.x - seat.x, fire.z - seat.z);
    this.p.set(seat.x, this.groundAt(seat.x, seat.z), seat.z); this.yaw = this.yawT = this.sitYaw;
    this.T.set('sit', 50);
    this.T.A.Sitting_Enter.time = this.T.A.Sitting_Enter.getClip().duration; this.T.sitStage = 'idle';
    const shot = campShot(fire.clone().lerp(M.root.position, 0.35).setY(fire.y), this.camera); shot.blend = 0.01;
    this.cam.play(shot);
    this.sound.musicLevel(0.3);
    this.ui.fade(false);
  }
  // 结尾卡片之后：站起来继续走
  standUp() {
    if (!this.sitting) return;
    this.sitting = false; this.summaryShown = false;
    this.T.set('loco', 3);
    const f = this.camp.userData.fireAt;
    this.yaw = this.yawT = Math.atan2(this.p.x - f.x, this.p.z - f.z);
    releaseShot(this.cam, 2.5);
    this.sound.musicLevel(0.42);
  }
  // 从头再来
  restart() {
    this.sitting = false; this.fireKept = false; this.T.set('ride', 50);
    this.reset();
    this.cam.shot = null; this.cam.inited = false; this.cam.zoom = this.cam.zoomTarget;
    this.phase = 'play'; this.dusk = 0; this.applyDusk(0);
    this.ui.place(''); this.ui.progress(0); this.ui.journal?.(0, this.places.length);
    this.sound.musicLevel(0.42);
  }

  // ---------- 声音 ----------
  hoof(M, leg, pos, g) {
    if (this.phase === 'intro' || !M.root.visible) return;
    const near = M === this.mount && this.mode === 'ride' ? 1 : Math.max(0, 1 - pos.distanceTo(this.camera.position) / 30);
    if (near < 0.05) return;
    const wood = this.bridge.heightAt(pos.x, pos.z) !== null;
    const wet = this.waterDepth(pos.x, pos.z) > 0.08;
    this.sound.step(wood ? 'wood' : wet ? 'water' : 'dirt', g, (leg[1] === 'F' ? 1 : 0.75) * near);
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
    const birds = (0.3 + 0.7 * sstep(2, 10, trees)) * (1 - 0.7 * Math.min(1, this.dusk)) * (this.mode === 'fly' ? 1 - sstep(10, 40, this.alt) : 1);
    const wind = this.mode === 'fly' ? 0.45 + 0.55 * sstep(6, 18, this.speed) : 0.22 + 0.45 * sstep(1.5, 30, hp.y) + (this.phase === 'view' ? 0.25 : 0);
    const fire = this.lit * (1 - sstep(3, 26, cp.distanceTo(this.camp.userData.fireAt)));
    this.sound.update({ river, birds, wind, fire, riverPan: pan });
  }

  applyDusk(d) {
    const k = clamp(d / 1.25, 0, 1);
    const el = (14 - 6.8 * d) * DEG, az = -16 * DEG;
    U.uSunDir.value.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
    const set = (c, [a, b]) => c.copy(a).lerp(b, k);
    set(U.uSunColor.value, DUSK.sun); set(U.uFogSun.value, DUSK.fogSun); set(U.uFogFar.value, DUSK.fogFar);
    set(SKY.uZenith.value, DUSK.zenith); set(SKY.uMid.value, DUSK.mid); set(SKY.uSunGlow.value, DUSK.glow);
    set(SKY.uCloudLit.value, DUSK.cloudLit); set(SKY.uCloudShade.value, DUSK.cloudShade);
    set(this.hemi.color, DUSK.hemiSky); set(this.hemi.groundColor, DUSK.hemiGround);
    this.sun.color.copy(U.uSunColor.value);
    this.sun.intensity = lerp(3.1, 2.45, k);
    this.hemi.intensity = lerp(1.3, 0.95, k);
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
