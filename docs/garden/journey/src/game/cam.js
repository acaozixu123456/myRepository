// 镜头：身后的旅行镜头（看得到夕阳和远山；步行、骑马、飞行机位不同）、俯视镜头（双指捏合切换）、观景点和营地的自动远景。
import * as THREE from 'three';

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const _v = new THREE.Vector3(), _w = new THREE.Vector3();

export class CamRig {
  constructor(camera, groundAt) {
    this.cam = camera; this.groundAt = groundAt;
    this.zoom = 0; this.zoomTarget = 0;   // 0 = 身后，1 = 俯视
    this.yawOff = 0; this.yawHold = 0;    // 过桥时侧头看风车之类
    this.pitchOff = 0; this.pitchHold = 0;
    this.pos = new THREE.Vector3(); this.look = new THREE.Vector3();
    this.fwd = new THREE.Vector3(0, 0, -1);
    this.shot = null; this.shotW = 0;      // 自动远景
    this.inited = false;
    // 不同走法的机位：离身后多远、多高、看前面多远、看的高度
    this.par = { back: 6.6, up: 2.35, ahead: 11, lookH: 1.75 };
  }
  // 远景镜头：{ dur, pos(t)->Vector3, look(t)->Vector3 }
  play(shot) { this.shot = { ...shot, t: 0 }; }
  get busy() { return !!this.shot; }
  // focus：跟着的点（马或人脚下 / 飞的时候是身体），yaw：朝向，o: { mode, speed, vy, alt }
  update(dt, focus, yaw, o = {}) {
    const cam = this.cam, mode = o.mode || 'ride';
    const P = MODES[mode] || MODES.ride;
    const kp0 = this.inited ? 1 - Math.exp(-dt * 2.2) : 1;
    for (const k in P) this.par[k] += (P[k] - this.par[k]) * kp0;
    // 朝向慢慢跟上
    _v.set(Math.sin(yaw), 0, Math.cos(yaw));
    if (!this.inited) this.fwd.copy(_v);
    this.fwd.lerp(_v, 1 - Math.exp(-dt * (mode === 'fly' ? 1.6 : mode === 'foot' ? 2.6 : 1.8))).normalize();
    this.zoom = damp(this.zoom, this.zoomTarget, 3.0, dt);
    if (this.yawHold > 0) this.yawHold -= dt; else this.yawOff = damp(this.yawOff, 0, 0.9, dt);
    if (this.pitchHold > 0) this.pitchHold -= dt; else this.pitchOff = damp(this.pitchOff, 0, 0.6, dt);
    const z = sstep(0, 1, this.zoom), par = this.par;
    const f = _w.copy(this.fwd).applyAxisAngle(THREE.Object3D.DEFAULT_UP, this.yawOff);
    const back = THREE.MathUtils.lerp(par.back + (o.speed || 0) * (mode === 'fly' ? 0.09 : 0.05), 10, z);
    const up = THREE.MathUtils.lerp(par.up - (mode === 'fly' ? (o.vy || 0) * 0.25 : 0), 21, z);
    const side = mode === 'fly' ? 0 : 0.6 * (1 - z);
    let tx = focus.x - f.x * back + f.z * side, tz = focus.z - f.z * back - f.x * side;
    let ty = focus.y + up;
    // 身后有树（松树枝很低）：镜头拉近一点、抬高一点，不钻进树冠里
    if (this.blocker && z < 0.5 && (mode !== 'fly' || (o.alt || 0) < 12)) {
      const t = this.blocker(focus.x, focus.z, tx, tz);
      this.blockT = damp(this.blockT ?? 1, t, t < (this.blockT ?? 1) ? 8 : 1.5, dt);
      const k = Math.max(this.blockT, 1.9 / Math.max(2, back));
      tx = focus.x + (tx - focus.x) * k; tz = focus.z + (tz - focus.z) * k; ty += (1 - k) * 1.4;
    }
    const gy = this.groundAt(tx, tz); ty = Math.max(ty, gy + 1.2);
    const lookAhead = THREE.MathUtils.lerp(par.ahead, 2.5, z);
    const lx = focus.x + f.x * lookAhead, lz = focus.z + f.z * lookAhead;
    const ly = focus.y + THREE.MathUtils.lerp(par.lookH, 0.4, z) + this.pitchOff + (mode === 'fly' ? (o.vy || 0) * 0.5 : 0);
    if (!this.inited) { this.pos.set(tx, ty, tz); this.look.set(lx, ly, lz); this.inited = true; }
    const kp = mode === 'fly' ? 3.2 : 4.5, kl = 6;
    this.pos.set(damp(this.pos.x, tx, kp, dt), damp(this.pos.y, ty, kp * 0.8, dt), damp(this.pos.z, tz, kp, dt));
    // 地面以下不行（镜头跟得慢时也不穿地）
    this.pos.y = Math.max(this.pos.y, this.groundAt(this.pos.x, this.pos.z) + 0.6);
    this.look.set(damp(this.look.x, lx, kl, dt), damp(this.look.y, ly, kl, dt), damp(this.look.z, lz, kl, dt));
    let Pp = this.pos, L = this.look;
    // 远景镜头混进来
    if (this.shot) {
      const sh = this.shot; sh.t += dt;
      const w = sstep(0, sh.blend || 2.2, sh.t) * (1 - sstep(sh.dur - (sh.blend || 2.2), sh.dur, sh.t));
      this.shotW = w;
      const sp = sh.pos(sh.t, focus), sl = sh.look(sh.t, focus);
      Pp = _v.copy(this.pos).lerp(sp, w); L = new THREE.Vector3().copy(this.look).lerp(sl, w);
      if (sh.t >= sh.dur) { if (sh.onEnd) sh.onEnd(); if (!sh.hold) this.shot = null; else sh.t = sh.dur - (sh.blend || 2.2); }
    } else this.shotW = 0;
    cam.position.copy(Pp);
    cam.lookAt(L);
    cam.updateMatrixWorld();
  }
}
const MODES = {
  foot: { back: 4.4, up: 1.75, ahead: 7, lookH: 1.45 },
  ride: { back: 6.6, up: 2.35, ahead: 11, lookH: 1.75 },
  fly: { back: 6.2, up: 1.7, ahead: 16, lookH: 0.7 },
};

// 观景台：镜头从马身后升起，从右边绕到马的前上方，回头看走过的溪谷（被夕阳照着），停一会儿再绕回来
export function viewpointShot(yaw0) {
  const T1 = 6, T2 = 12, T3 = 17.5;
  const u = t => t < T1 ? sstep(0, T1, t) : t < T2 ? 1 : 1 - sstep(T2, T3, t);
  const drift = t => Math.min(Math.max(t - T1, 0), T2 - T1) - Math.max(0, t - T2) * (T2 - T1) / (T3 - T2);
  const dirOf = a => new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
  return {
    dur: T3, blend: 0.5,
    pos: (t, hp) => {
      const k = u(t), b = yaw0 + Math.PI + k * THREE.MathUtils.degToRad(172) + drift(t) * 0.012;
      const r = THREE.MathUtils.lerp(6.6, 9.5, k), h = THREE.MathUtils.lerp(2.35, 7.5, Math.min(1, k * 1.4));
      return new THREE.Vector3().copy(hp).addScaledVector(dirOf(b), r).add(new THREE.Vector3(0, h, 0));
    },
    look: (t, hp) => {
      const k = u(t), b = yaw0 + k * THREE.MathUtils.degToRad(172) + drift(t) * 0.012;
      return new THREE.Vector3().copy(hp).addScaledVector(dirOf(b), THREE.MathUtils.lerp(11, 70, k)).add(new THREE.Vector3(0, THREE.MathUtils.lerp(1.75, -5, k), 0));
    },
  };
}
// 营地：在篝火边慢慢来回转，马、火、坐着的骑手和帐篷都在画面里
export function campShot(fireAt, camera) {
  return {
    dur: 1e9, blend: 3, hold: true,
    pos: t => {
      const a = THREE.MathUtils.degToRad(270 + 42 * Math.sin(0.03 * t - 1.2)), R = camera.aspect < 1 ? 8.2 : 6.6;
      return new THREE.Vector3(fireAt.x - Math.sin(a) * R, fireAt.y + 2.3 + Math.sin(t * 0.2) * 0.2, fireAt.z + Math.cos(a) * R);
    },
    look: () => new THREE.Vector3(fireAt.x, fireAt.y + 0.8, fireAt.z),
  };
}
// 开始画面：站在马的右前方，马在画面上半部（下半部是开始卡片），镜头慢慢漂
export function introShot(getYaw) {
  const f = new THREE.Vector3(), r = new THREE.Vector3();
  const basis = () => { const a = getYaw(); f.set(Math.sin(a), 0, Math.cos(a)); r.set(-f.z, 0, f.x); };
  return {
    dur: 1e9, blend: 0.01, hold: true,
    pos: (t, hp) => { basis(); return new THREE.Vector3().copy(hp).addScaledVector(f, 3.4 + Math.sin(t * 0.13) * 0.25).addScaledVector(r, 2.3 + Math.sin(t * 0.09) * 0.3).add(new THREE.Vector3(0, 1.45, 0)); },
    look: (t, hp) => { basis(); return new THREE.Vector3().copy(hp).addScaledVector(f, -0.2).add(new THREE.Vector3(0, 0.25, 0)); },
  };
}
// 结束一个 hold 的镜头：用 blend 秒混回旅行镜头
export function releaseShot(rig, blend = 2.5) {
  const sh = rig.shot; if (!sh) return;
  sh.hold = false; sh.blend = blend; sh.t = Math.max(sh.t, blend); sh.dur = sh.t + blend;
}
