// 骑行：马沿着山路走（用路程 s 表示位置），按住前进、松开停下。
// 路上会经过几个地方（地名横幅）、观景台（自动远景）、最后到山口营地（下马、生火、结尾卡片）。
// 太阳随路程慢慢落下，到营地时是黄昏。
import * as THREE from 'three';
import { ROAD, STREAM, SPOTS } from '../world/route.js';
import { U } from '../world/atmo.js';
import { SKY } from '../world/sky.js';
import { viewpointShot, campShot, introShot, releaseShot } from './cam.js';

export const GAITS = [{ name: '慢步', v: 1.25 }, { name: '快走', v: 1.7 }, { name: '小跑', v: 3.2 }];
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const DEG = Math.PI / 180;

const PLACES = [
  { s: 0, name: '暖光谷地', sub: '沿着小溪，往山口去' },
  { s: SPOTS.bridge - 15, name: '溪上木桥', sub: '水声近了' },
  { s: SPOTS.bridge - 1.5, name: '风车坡', sub: '顺着小溪往右看，山坡上的风车慢慢转', glance: [62, -118] },
  { s: SPOTS.grove[0] + 6, name: '林荫小道', sub: '树影一道一道落在路上' },
  { s: SPOTS.view - 12, name: '望远台', sub: '回头看看，走过的溪谷都在脚下' },
  { s: SPOTS.camp - 13, name: '山口营地', sub: '今晚在这里歇脚' },
];
// 骑手坐在马鞍上的微调（每匹马不一样）
const SEAT = { b: { y: 0.0, z: -0.02 }, a: { y: 0.0, z: 0.0 } };

// 黄昏：太阳高度和颜色随进度变化（0 = 出发，1 = 到营地，1.25 = 营地天黑一点）
const C = (a, b) => [new THREE.Color(a), new THREE.Color(b)];
const DUSK = {
  sun: C('#ffd9a8', '#ffa66a'), fogSun: C('#ffcf98', '#ffae7c'), fogFar: C('#b4c0dc', '#b2aed0'),
  zenith: C('#6c98d4', '#5b7ec2'), mid: C('#a8bde0', '#b4b2d8'), glow: C('#ffc98a', '#ffa46e'),
  cloudLit: C('#fff1dc', '#ffd2ae'), cloudShade: C('#b5a8c4', '#a898bc'), hemiSky: C('#bfd0f2', '#b6b8e2'), hemiGround: C('#94844f', '#8a6e4c'),
};

const _p = {}, _a = {}, _b = {}, _c = {}, _v = new THREE.Vector3(), _o = new THREE.Vector3(), _q = new THREE.Quaternion();
const _h = [new THREE.Vector3(), new THREE.Vector3()], _bit = [new THREE.Vector3(), new THREE.Vector3()], _cr = new THREE.Vector3();

export class Ride {
  // o: { land, bridge, camp, horses: {a, b}, rider, reins, cam, sound, ui, camera, sun, hemi }
  constructor(o) {
    Object.assign(this, o);
    this.horse = o.horses.b;
    this.groundAt = (x, z) => { const b = this.bridge.heightAt(x, z); return b === null ? this.land.heightExact(x, z) : b; };
    for (const H of Object.values(o.horses)) if (H) H.onStep = (leg, pos, g) => this.step(H, leg, pos, g);
    this.gait = 1; this.auto = false; this.holding = false;
    this.reset();
    this.dusk = 0; this.applyDusk(0);
    this.cam.play(introShot(() => this.yaw ?? 0));
  }
  reset() {
    this.s = SPOTS.start; this.speed = 0; this.phase = 'intro';
    this.place = -1; this.labelT = 0; this.viewDone = false; this.t = this.t || 0; this.rideT = 0; this.idleT = 0;
    this.yaw = null; this.turn = 0; this.slope = 0; this.lit = 0; this.sitting = false; this.arriveT = 0;
    this.snortT = 18 + Math.random() * 20; this.mixT = 0; this.seen = new Set(); this.glance = null;
    this.camp.userData.fire.visible = false;
  }
  get stopS() { return SPOTS.camp + 1; }
  get progress() { return clamp((this.s - SPOTS.start) / (this.stopS - SPOTS.start), 0, 1); }
  // 路上的横向小摆动：桥上和营地前收窄
  latAt(s) {
    const br = this.land.bridge;
    const k = sstep(br.half + 1.5, br.half + 9, Math.abs(s - br.s)) * (1 - sstep(SPOTS.camp - 22, SPOTS.camp - 6, s));
    return (0.42 * Math.sin(0.043 * s + 0.5) + 0.22 * Math.sin(0.11 * s + 1.3)) * (0.12 + 0.88 * k);
  }
  posAt(s, out) { ROAD.at(s, _p); const l = this.latAt(s); out.x = _p.x - _p.tz * l; out.z = _p.z + _p.tx * l; return out; }

  begin() { // 点“出发”
    this.phase = 'ride'; releaseShot(this.cam, 2.8);
  }
  swap(kind) {
    const next = kind ? this.horses[kind] : (this.horse === this.horses.a ? this.horses.b : this.horses.a);
    if (!next || next === this.horse) return false;
    this.horse = next; return true;
  }

  update(dt) {
    this.t += dt;
    const H = this.horse, R = this.rider, riding = this.phase === 'ride' || this.phase === 'view';
    // ---- 速度：按住（或自动）就朝当前步态的速度加速，松开慢慢停 ----
    let target = (this.holding || this.auto) && riding ? GAITS[this.gait].v : 0;
    if (this.phase === 'view') target = 0;
    const rem = this.stopS - this.s;
    target = Math.min(target, Math.sqrt(2 * 0.35 * Math.max(0, rem)));
    this.speed = damp(this.speed, target, target > this.speed ? 1.1 : 1.9, dt);
    if (target < 0.01 && this.speed < 0.03) this.speed = 0;
    this.s = Math.min(this.s + this.speed * dt, this.stopS);
    if (riding) this.rideT += dt;
    this.idleT = this.speed > 0.05 ? 0 : this.idleT + dt;

    // ---- 位置、朝向、坡度 ----
    const pos = this.posAt(this.s, _a), f = this.posAt(this.s + 0.7, _b), b = this.posAt(this.s - 0.7, _c);
    const yawT = Math.atan2(f.x - b.x, f.z - b.z);
    if (this.yaw === null) this.yaw = yawT;
    const ny = this.yaw + wrap(yawT - this.yaw) * (1 - Math.exp(-dt * 8));
    this.turn = damp(this.turn, wrap(ny - this.yaw) / Math.max(dt, 1e-3), 4, dt);
    this.yaw = ny;
    const y = this.groundAt(pos.x, pos.z), fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const hf = this.groundAt(pos.x + fx * 0.6, pos.z + fz * 0.6), hb = this.groundAt(pos.x - fx * 0.6, pos.z - fz * 0.6);
    this.slope = damp(this.slope, -Math.atan((hf - hb) / 1.2), 6, dt);

    // ---- 马 ----
    for (const X of Object.values(this.horses)) if (X) X.root.visible = X === H;
    H.root.position.set(pos.x, y, pos.z);
    if (H.kind === 'a') H.root.rotation.set(this.slope, this.yaw, 0, 'YXZ'); else H.root.rotation.set(0, this.yaw, 0);
    H.root.updateMatrixWorld(true);
    const graze = this.phase === 'camp' || this.phase === 'arrive' ? this.arriveT > 2 : this.idleT > 5;
    H.update(dt, { speed: this.speed, turn: this.turn, slope: this.slope, terrain: this.groundAt, graze });

    // ---- 骑手：骑在马上，或者到了营地坐在树桩上烤火 ----
    if (!this.sitting) {
      H.root.updateMatrixWorld(true);
      H.seat.getWorldPosition(_v);
      if (H.kind === 'b') H.seat.getWorldQuaternion(_q); else H.root.getWorldQuaternion(_q);
      const o = SEAT[H.kind];
      _o.set(0, -R.hipsY + o.y, o.z).applyQuaternion(_q);
      R.root.position.copy(_v).add(_o); R.root.quaternion.copy(_q);
      const g = sstep(2.0, 2.8, this.speed);
      R.pose('ride', this.t, 0, 0.04 + g * 0.12);
      R.root.updateMatrixWorld(true);
      R.hand(0, _h[0]); R.hand(1, _h[1]); H.bit[0].getWorldPosition(_bit[0]); H.bit[1].getWorldPosition(_bit[1]);
      this.reins.visible = true;
      this.reins.userData.update(_h, _bit, this.camera);
    } else {
      R.pose('sit', this.t, 0, -0.05);
      this.reins.visible = false;
    }

    // ---- 镜头 ----
    this.cam.update(dt, H.root.position, this.s, this.speed);

    // ---- 路上的事 ----
    if (riding) this.story(dt);
    if (this.phase === 'arrive' || this.phase === 'camp') this.campTick(dt);
    // 篝火
    const fire = this.camp.userData.fire;
    this.lit = damp(this.lit, this.sitting ? 1 : 0, 1.2, dt);
    fire.visible = this.lit > 0.02; fire.scale.setScalar(0.35 + 0.65 * this.lit);
    fire.userData.update(this.t, this.lit);
    this.camp.userData.lanLight.intensity = 1.8 * this.lit;
    // 黄昏
    const duskT = this.sitting ? 1.25 : this.progress;
    if (Math.abs(duskT - this.dusk) > 1e-4) { this.dusk = damp(this.dusk, duskT, this.sitting ? 0.25 : 0.8, dt); this.applyDusk(this.dusk); }
    // 声音
    this.mix(dt);
    this.snortT -= dt;
    if (this.snortT < 0) { this.snortT = 22 + Math.random() * 35; if (this.phase !== 'intro' && this.speed < 2) this.sound.snort(); }
  }

  story(dt) {
    let pi = 0; for (let i = 0; i < PLACES.length; i++) if (this.s >= PLACES[i].s) pi = i;
    if (pi !== this.place) {
      this.place = pi; const P = PLACES[pi];
      this.ui.banner(P.name, P.sub); this.ui.place(''); this.labelT = 5;
      this.seen.add(P.name);
      if (P.glance) this.glance = { t: 0, dur: 7, x: P.glance[0], z: P.glance[1] };
    }
    // 回头/侧头看一眼：镜头转向某个景物，几秒后转回来
    if (this.glance) {
      const g = this.glance, c = this.cam; g.t += dt;
      const hp = this.horse.root.position, dx = g.x - hp.x, dz = g.z - hp.z, l = Math.hypot(dx, dz) || 1;
      const th = clamp(Math.atan2(c.fwd.z * dx / l - c.fwd.x * dz / l, c.fwd.x * dx / l + c.fwd.z * dz / l), -1.35, 1.35);
      const w = sstep(0, 1.8, g.t) * (1 - sstep(g.dur - 2, g.dur, g.t));
      c.yawOff = th * w; c.yawHold = 0.2;
      if (g.t > g.dur) this.glance = null;
    }
    if (this.labelT > 0) { this.labelT -= dt; if (this.labelT <= 0) this.ui.place(PLACES[this.place].name); }
    this.ui.progress(this.progress);
    // 观景台：慢下来，镜头升到侧后方看溪谷和落日
    if (!this.viewDone && this.s >= SPOTS.view - 1.5) {
      this.viewDone = true; this.phase = 'view';
      const shot = viewpointShot(this.yaw);
      shot.onEnd = () => { if (this.phase === 'view') this.phase = 'ride'; };
      this.cam.play(shot);
    }
    // 到营地
    if (this.s >= this.stopS - 0.03) { this.phase = 'arrive'; this.arriveT = 0; this.ui.fade(true); this.ui.bannerOff(); this.sound.snort(); }
  }

  campTick(dt) {
    this.arriveT += dt;
    if (!this.sitting && this.arriveT > 1.0) this.sitDown();
    if (this.arriveT > 1.3) this.ui.fade(false);
    if (this.phase === 'arrive' && this.arriveT > 8) { this.phase = 'camp'; this.onCamp?.(); }
  }
  sitDown() {
    const R = this.rider, c = this.camp.userData;
    this.sitting = true;
    const seat = c.seat, fire = c.fireAt;
    R.root.quaternion.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, Math.atan2(fire.x - seat.x, fire.z - seat.z));
    R.root.position.set(seat.x, c.seatTop - R.hipsY + 0.03, seat.z);
    R.pose('sit', this.t);
    const shot = campShot(fire.clone().lerp(this.horse.root.position, 0.35).setY(fire.y), this.camera); shot.blend = 0.01;
    this.cam.play(shot);
    this.sound.musicLevel(0.3);
  }
  // 重新开始（可以换马）
  restart() {
    this.reset();
    this.cam.shot = null; this.cam.inited = false; this.cam.zoom = this.cam.zoomTarget;
    this.phase = 'ride'; this.dusk = 0; this.applyDusk(0);
    this.ui.place(''); this.ui.progress(0);
    this.sound.musicLevel(0.42);
  }

  step(H, leg, pos, g) {
    if (H !== this.horse || this.phase === 'intro') return;
    const wood = this.bridge.heightAt(pos.x, pos.z) !== null;
    this.sound.step(wood ? 'wood' : 'dirt', g, leg[1] === 'F' ? 1 : 0.75);
  }

  mix(dt) {
    this.mixT -= dt; if (this.mixT > 0 || !this.sound.ready) return;
    this.mixT = 0.2;
    const hp = this.horse.root.position, cp = this.camera.position, s = this.s;
    const river = 1 - sstep(3, 48, this.land.streamDist(hp.x, hp.z));
    let pan = 0;
    const q = STREAM.nearest(cp.x, cp.z, 120);
    if (q.dist < 1e9) {
      const sp = STREAM.at(q.s, _p);
      _cr.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
      const dx = sp.x - cp.x, dz = sp.z - cp.z;
      pan = clamp((dx * _cr.x + dz * _cr.z) / Math.max(2, Math.hypot(dx, dz)), -0.8, 0.8);
    }
    const grove = sstep(SPOTS.grove[0] - 10, SPOTS.grove[0] + 4, s) * (1 - sstep(SPOTS.grove[1] - 4, SPOTS.grove[1] + 10, s));
    const birds = (0.35 + 0.65 * grove) * (1 - 0.7 * Math.min(1, this.dusk));
    const wind = 0.22 + 0.45 * sstep(1.5, 14, hp.y) + (this.phase === 'view' ? 0.25 : 0);
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
