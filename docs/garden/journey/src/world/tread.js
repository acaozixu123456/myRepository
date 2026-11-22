// 踩过的草：人、马、路过的小动物走过的地方，草往两边倒下去，过一两秒晃着弹回来。
// 一张 64×64 的小图跟着人走（0.4 米一格，循环铺开，所以不用挪数据）：rg 是往哪边倒，b 是倒了多少。
// 草的着色器（atmo.js 的 treadVS）按世界坐标查这张图；每帧只是把 4096 个数减一减再传上去，几乎不花时间。
import * as THREE from 'three';
import { U } from './atmo.js';

const N = 64, CELL = 0.4;
export const TREAD_SPAN = N * CELL;
const mod = i => ((i % N) + N) % N;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class Tread {
  constructor() {
    this.a = new Float32Array(N * N); this.dx = new Float32Array(N * N); this.dz = new Float32Array(N * N);
    this.data = new Uint8Array(N * N * 4);
    for (let i = 0; i < N * N; i++) { this.data[i * 4] = this.data[i * 4 + 1] = 128; this.data[i * 4 + 3] = 255; }
    const t = this.tex = new THREE.DataTexture(this.data, N, N, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
    t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true;
    U.uTread.value = t; U.uTreadP.value.set(0, 0, 1 / TREAD_SPAN, 1);
    this.cx = 0; this.cz = 0; this.live = false;
    this.rate = 0.45;          // 每秒弹回来多少（两秒多一点站直）
  }
  set on(v) { U.uTreadP.value.w = v ? 1 : 0; }
  // 在 (x, z) 踩一脚：半径 r 米，力度 k（0~1）；(fx, fz) 是往哪边走（草除了往外倒，还顺着被带一点）
  stamp(x, z, r, k, fx = 0, fz = 0) {
    if (Math.abs(x - this.cx) > 9 || Math.abs(z - this.cz) > 9) return;
    const i0 = Math.floor((x - r) / CELL), i1 = Math.floor((x + r) / CELL), j0 = Math.floor((z - r) / CELL), j1 = Math.floor((z + r) / CELL);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const ex = (i + 0.5) * CELL - x, ez = (j + 0.5) * CELL - z, d = Math.hypot(ex, ez);
      if (d > r) continue;
      const f = k * (1 - sstep(0.35, 1, d / r)), c = mod(j) * N + mod(i);
      if (f < this.a[c] * 0.85) continue;         // 已经被压得更狠的那一格不动
      const ox = (d > 1e-3 ? ex / d : 0) + fx * 0.7, oz = (d > 1e-3 ? ez / d : 0) + fz * 0.7, l = Math.hypot(ox, oz) || 1;
      this.dx[c] = ox / l; this.dz[c] = oz / l;
      if (f > this.a[c]) this.a[c] = f;
    }
    this.live = true;
  }
  clear() { if (!this.live) return; this.a.fill(0); this.flush(); this.live = false; }
  flush() {
    const a = this.a, d = this.data;
    for (let c = 0; c < N * N; c++) { const o = c * 4; d[o] = 128 + this.dx[c] * 127; d[o + 1] = 128 + this.dz[c] * 127; d[o + 2] = a[c] * 255; }
    this.tex.needsUpdate = true;
  }
  // 每帧：围着 (cx, cz)；草慢慢站起来
  update(dt, cx, cz) {
    if (Math.abs(cx - this.cx) > 6 || Math.abs(cz - this.cz) > 6) this.clear();     // 一下子换了地方（传送）
    this.cx = cx; this.cz = cz; U.uTreadP.value.x = cx; U.uTreadP.value.y = cz;
    if (!this.live) return;
    const a = this.a, k = dt * this.rate;
    let any = false;
    for (let c = 0; c < N * N; c++) if (a[c] > 0) { a[c] = Math.max(0, a[c] - k); if (a[c] > 0) any = true; }
    this.flush();
    this.live = any;
  }
}
