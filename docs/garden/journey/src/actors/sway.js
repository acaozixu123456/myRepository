// 慢半拍：一个被弹簧拴在“锚点”上的小球。锚点（马的脖子、尾巴根、人的后背）一动，小球晚一点才跟上，
// 急停、转弯、颠簸时它会甩出去再晃回来；跑起来有风，它就一直被吹在后面。
// off 是小球相对锚点落后了多少（世界坐标，米）。鬃毛、尾巴、行囊都按它来摆，一匹马只算几个小球，不占什么时间。
import * as THREE from 'three';

const _va = new THREE.Vector3(), _a = new THREE.Vector3(), _f = new THREE.Vector3();

export class Lag {
  // freq：自己晃一下的快慢（每秒几下）；zeta：晃几下停（越大停得越快）；drag：每 1 米/秒的速度被风吹着落后多少米；max：最多落后多少米
  constructor({ freq = 1.5, zeta = 0.35, drag = 0.04, max = 0.5 } = {}) {
    const w = 2 * Math.PI * freq;
    this.k = w * w; this.c = 2 * zeta * w; this.cAir = drag * this.k; this.max = max;
    this.p = new THREE.Vector3(); this.v = new THREE.Vector3(); this.a0 = new THREE.Vector3(); this.off = new THREE.Vector3();
    this.on = false;
  }
  reset(anchor) { this.p.copy(anchor); this.a0.copy(anchor); this.v.set(0, 0, 0); this.off.set(0, 0, 0); this.on = true; }
  update(dt, anchor) {
    if (!this.on || anchor.distanceToSquared(this.a0) > 9 || !(dt > 0)) { this.reset(anchor); return this.off; }
    // 一帧里分成几小步算（每步不超过 1/120 秒），帧数低的时候也不会算飞
    const n = Math.max(1, Math.ceil(dt * 120)), h = dt / n;
    _va.subVectors(anchor, this.a0).divideScalar(dt);
    for (let i = 1; i <= n; i++) {
      _a.lerpVectors(this.a0, anchor, i / n);
      _f.subVectors(_a, this.p).multiplyScalar(this.k);
      _f.x -= (this.v.x - _va.x) * this.c + this.v.x * this.cAir;
      _f.y -= (this.v.y - _va.y) * this.c + this.v.y * this.cAir;
      _f.z -= (this.v.z - _va.z) * this.c + this.v.z * this.cAir;
      this.v.addScaledVector(_f, h); this.p.addScaledVector(this.v, h);
    }
    this.a0.copy(anchor);
    this.off.subVectors(this.p, anchor);
    const l = this.off.length();
    if (l > this.max) { this.off.multiplyScalar(this.max / l); this.p.addVectors(anchor, this.off); }
    return this.off;
  }
}
