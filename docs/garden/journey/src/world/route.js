// 路线：一条山路 + 一条小溪。路线上的位置用“路程 s（米）”表示。
import * as THREE from 'three';

// 一条折线化的样条，支持按路程取点和就近查询
export class Path {
  constructor(pts, step = 1) {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal', 0.5);
    const L = curve.getLength();
    const n = Math.ceil(L / step);
    this.x = new Float32Array(n + 1); this.z = new Float32Array(n + 1);
    this.tx = new Float32Array(n + 1); this.tz = new Float32Array(n + 1); this.s = new Float32Array(n + 1);
    const p = new THREE.Vector3();
    let acc = 0, px = 0, pz = 0;
    for (let i = 0; i <= n; i++) {
      curve.getPointAt(i / n, p);
      if (i) acc += Math.hypot(p.x - px, p.z - pz);
      this.x[i] = p.x; this.z[i] = p.z; this.s[i] = acc; px = p.x; pz = p.z;
    }
    for (let i = 0; i <= n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n, i + 1);
      const dx = this.x[b] - this.x[a], dz = this.z[b] - this.z[a], l = Math.hypot(dx, dz) || 1;
      this.tx[i] = dx / l; this.tz[i] = dz / l;
    }
    this.n = n; this.length = acc;
    // 空间网格加速最近点查询
    this.cell = 8; this.grid = new Map();
    for (let i = 0; i < n; i++) {
      const x0 = Math.min(this.x[i], this.x[i + 1]), x1 = Math.max(this.x[i], this.x[i + 1]);
      const z0 = Math.min(this.z[i], this.z[i + 1]), z1 = Math.max(this.z[i], this.z[i + 1]);
      for (let gx = Math.floor(x0 / this.cell); gx <= Math.floor(x1 / this.cell); gx++)
        for (let gz = Math.floor(z0 / this.cell); gz <= Math.floor(z1 / this.cell); gz++) {
          const k = gx * 73856093 ^ gz * 19349663;
          let a = this.grid.get(k); if (!a) this.grid.set(k, a = []); a.push(i);
        }
    }
  }
  // 按路程取位置和切线
  at(s, out = {}) {
    s = Math.min(Math.max(s, 0), this.length);
    let lo = 0, hi = this.n;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (this.s[m] <= s) lo = m; else hi = m; }
    const t = (s - this.s[lo]) / Math.max(1e-6, this.s[hi] - this.s[lo]);
    out.x = this.x[lo] + (this.x[hi] - this.x[lo]) * t; out.z = this.z[lo] + (this.z[hi] - this.z[lo]) * t;
    let tx = this.tx[lo] + (this.tx[hi] - this.tx[lo]) * t, tz = this.tz[lo] + (this.tz[hi] - this.tz[lo]) * t;
    const l = Math.hypot(tx, tz) || 1; out.tx = tx / l; out.tz = tz / l;
    return out;
  }
  // 最近点：返回 {d: 带符号横向距离（右正）, s: 路程, dist: 距离}；超出搜索半径返回 dist=Infinity
  nearest(x, z, maxR = 40, out = {}) {
    let best = Infinity, bi = -1, bt = 0;
    const r = Math.ceil(maxR / this.cell);
    const cx = Math.floor(x / this.cell), cz = Math.floor(z / this.cell);
    for (let ring = 0; ring <= r; ring++) {
      for (let gx = cx - ring; gx <= cx + ring; gx++) for (let gz = cz - ring; gz <= cz + ring; gz++) {
        if (Math.max(Math.abs(gx - cx), Math.abs(gz - cz)) !== ring) continue;
        const a = this.grid.get(gx * 73856093 ^ gz * 19349663); if (!a) continue;
        for (const i of a) {
          const ax = this.x[i], az = this.z[i], bx = this.x[i + 1], bz = this.z[i + 1];
          const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1e-9;
          let t = ((x - ax) * dx + (z - az) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
          const qx = ax + dx * t - x, qz = az + dz * t - z, d2 = qx * qx + qz * qz;
          if (d2 < best) { best = d2; bi = i; bt = t; }
        }
      }
      if (bi >= 0 && Math.sqrt(best) < (ring) * this.cell) break;
    }
    if (bi < 0 || best > maxR * maxR) { out.dist = Infinity; out.d = Infinity; out.s = 0; return out; }
    const s = this.s[bi] + (this.s[bi + 1] - this.s[bi]) * bt;
    const px = this.x[bi] + (this.x[bi + 1] - this.x[bi]) * bt, pz = this.z[bi] + (this.z[bi + 1] - this.z[bi]) * bt;
    const tx = this.tx[bi], tz = this.tz[bi];
    out.dist = Math.sqrt(best); out.s = s; out.d = (x - px) * -tz + (z - pz) * tx;
    return out;
  }
}

// ---- 第一段：暖光谷地 ----
// 骑行方向大致朝北（-Z），太阳在西北偏西、离地平线不高
export const ROAD = new Path([[0, 30], [0, 8], [2, -18], [-2, -42], [-6, -64], [-3, -88], [4, -110], [6, -132], [0, -154], [-8, -173], [-11, -193], [-5, -212], [3, -228], [9, -242], [12, -256]], 1);
export const STREAM = new Path([[-330, -360], [-250, -300], [-180, -240], [-135, -180], [-95, -130], [-50, -102], [-3, -88], [38, -80], [80, -60], [125, -46], [190, -16], [280, 20]], 1.5);

// 路上的地点（用路程 s 表示），加载后算出来
export const SPOTS = {};
{
  const near = (x, z) => ROAD.nearest(x, z, 60).s;
  SPOTS.start = near(0, 8);
  // 找出路和溪的交点
  let best = 1e9, bs = 0;
  for (let s = 0; s < ROAD.length; s += 0.5) { const p = ROAD.at(s); const q = STREAM.nearest(p.x, p.z, 30); if (q.dist < best) { best = q.dist; bs = s; } }
  SPOTS.bridge = bs;
  SPOTS.grove = [near(4, -118), near(-2, -160)];
  SPOTS.view = near(-11, -193);
  SPOTS.camp = near(8, -238);
  SPOTS.end = Math.min(ROAD.length - 6, SPOTS.camp + 4);
}
