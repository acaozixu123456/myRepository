// 有符号距离场（SDF）建模小工具：用几种圆润的基本形状平滑拼接，再用 Surface Nets 提取网格。
// 只依赖纯数学，浏览器和 Node 都能跑。

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

// 多项式平滑最小值（k 越大越圆润）
export function smin(a, b, k) {
  if (k <= 0) return Math.min(a, b);
  const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1);
  return b + (a - b) * h - k * h * (1 - h);
}
export function smax(a, b, k) { return -smin(-a, -b, k); }

// ---- 基本形状。每个形状都有 dist(x,y,z) 和包围盒 ----

// 两端半径不同的胶囊（圆锥台 + 两头球），IQ 的 sdRoundCone 任意方向版
export function roundCone(a, b, ra, rb) {
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const l2 = bax * bax + bay * bay + baz * baz;
  const rr = ra - rb, a2 = l2 - rr * rr, il2 = 1 / l2;
  return {
    a, b, ra, rb,
    box: [Math.min(a[0] - ra, b[0] - rb), Math.min(a[1] - ra, b[1] - rb), Math.min(a[2] - ra, b[2] - rb),
      Math.max(a[0] + ra, b[0] + rb), Math.max(a[1] + ra, b[1] + rb), Math.max(a[2] + ra, b[2] + rb)],
    // 沿轴线的参数 t（0 在 a 端，1 在 b 端），蒙皮插值用
    t(x, y, z) { return clamp(((x - a[0]) * bax + (y - a[1]) * bay + (z - a[2]) * baz) * il2, 0, 1); },
    dist(x, y, z) {
      const pax = x - a[0], pay = y - a[1], paz = z - a[2];
      const yy = pax * bax + pay * bay + paz * baz;
      const zz = yy - l2;
      const cx = pax * l2 - bax * yy, cy = pay * l2 - bay * yy, cz = paz * l2 - baz * yy;
      const x2 = cx * cx + cy * cy + cz * cz;
      const y2 = yy * yy * l2, z2 = zz * zz * l2;
      const k = Math.sign(rr) * rr * rr * x2;
      if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - rb;
      if (Math.sign(yy) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - ra;
      return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - ra;
    },
  };
}

// 椭球（可选旋转：rot 是 3x3 行主序矩阵，把世界坐标转到椭球局部坐标）
export function ellipsoid(c, r, rot = null) {
  const m = Math.max(r[0], r[1], r[2]);
  return {
    c, r, rot,
    box: [c[0] - m, c[1] - m, c[2] - m, c[0] + m, c[1] + m, c[2] + m],
    t() { return 0.5; },
    dist(x, y, z) {
      let px = x - c[0], py = y - c[1], pz = z - c[2];
      if (rot) { const qx = rot[0] * px + rot[1] * py + rot[2] * pz, qy = rot[3] * px + rot[4] * py + rot[5] * pz, qz = rot[6] * px + rot[7] * py + rot[8] * pz; px = qx; py = qy; pz = qz; }
      const ax = px / r[0], ay = py / r[1], az = pz / r[2];
      const k0 = Math.sqrt(ax * ax + ay * ay + az * az);
      const bx = ax / r[0], by = ay / r[1], bz = az / r[2];
      const k1 = Math.sqrt(bx * bx + by * by + bz * bz);
      if (k1 < 1e-9) return -Math.min(r[0], r[1], r[2]);
      return k0 * (k0 - 1) / k1;
    },
  };
}

// 绕 X、Y、Z 轴旋转（弧度）组成的世界→局部矩阵
export function rotXYZ(rx = 0, ry = 0, rz = 0) {
  const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
  // R = Rz*Ry*Rx（局部→世界），我们要它的转置（世界→局部）
  const m = [
    cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx,
    sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx,
    -sy, cy * sx, cy * cx,
  ];
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}

// 场：一组带平滑系数的形状做并集，再减去一组“雕刻”形状
export class Field {
  constructor(prims, carves = [], margin = 0.08) {
    this.prims = prims; this.carves = carves; this.margin = margin;
    // 粗网格加速：每个粗格子记下可能影响它的形状
    let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (const p of prims) for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], p.shape.box[i]); mx[i] = Math.max(mx[i], p.shape.box[i + 3]); }
    const pad = margin + 0.2; mn = mn.map(v => v - pad); mx = mx.map(v => v + pad);
    this.min = mn; this.max = mx;
    const cs = this.cs = 0.08;
    const n = this.n = [0, 1, 2].map(i => Math.ceil((mx[i] - mn[i]) / cs) + 1);
    this.cells = new Array(n[0] * n[1] * n[2]);
    const reach = p => (p.k || 0) + margin;
    const fill = (list, key) => {
      list.forEach((p, pi) => {
        const r = reach(p), b = p.shape.box;
        const i0 = Math.max(0, Math.floor((b[0] - r - mn[0]) / cs)), i1 = Math.min(n[0] - 1, Math.floor((b[3] + r - mn[0]) / cs));
        const j0 = Math.max(0, Math.floor((b[1] - r - mn[1]) / cs)), j1 = Math.min(n[1] - 1, Math.floor((b[4] + r - mn[1]) / cs));
        const k0 = Math.max(0, Math.floor((b[2] - r - mn[2]) / cs)), k1 = Math.min(n[2] - 1, Math.floor((b[5] + r - mn[2]) / cs));
        for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const ci = i + n[0] * (j + n[1] * k);
          const c = this.cells[ci] || (this.cells[ci] = { p: [], c: [] });
          c[key].push(pi);
        }
      });
    };
    fill(prims, 'p'); fill(carves, 'c');
  }
  cellAt(x, y, z) {
    const cs = this.cs, n = this.n;
    const i = Math.floor((x - this.min[0]) / cs), j = Math.floor((y - this.min[1]) / cs), k = Math.floor((z - this.min[2]) / cs);
    if (i < 0 || j < 0 || k < 0 || i >= n[0] || j >= n[1] || k >= n[2]) return null;
    return this.cells[i + n[0] * (j + n[1] * k)];
  }
  // 返回距离；可选把每个参与形状的距离写进 out（形状下标 → 距离）
  eval(x, y, z, out = null) {
    const c = this.cellAt(x, y, z);
    if (!c || !c.p.length) return this.margin;
    let d = 1e9;
    for (const pi of c.p) {
      const p = this.prims[pi];
      const di = p.shape.dist(x, y, z);
      if (out) out.push(pi, di);
      d = d > 1e8 ? di : smin(d, di, p.k || 0);
    }
    for (const ci of c.c) {
      const cv = this.carves[ci];
      d = smax(d, -cv.shape.dist(x, y, z), cv.k || 0);
    }
    return d;
  }
  normal(x, y, z, e = 0.004) {
    const nx = this.eval(x + e, y, z) - this.eval(x - e, y, z);
    const ny = this.eval(x, y + e, z) - this.eval(x, y - e, z);
    const nz = this.eval(x, y, z + e) - this.eval(x, y, z - e);
    const l = Math.hypot(nx, ny, nz) || 1;
    return [nx / l, ny / l, nz / l];
  }
  // 用距离场估算环境光遮蔽（缝隙、腋下、腿根更暗）
  ao(x, y, z, n) {
    let occ = 0, w = 1;
    for (const h of [0.025, 0.06, 0.11, 0.19]) {
      const d = this.eval(x + n[0] * h, y + n[1] * h, z + n[2] * h);
      occ += w * Math.max(0, h - d) / h;
      w *= 0.7;
    }
    return clamp(1 - occ * 0.55, 0, 1);
  }
}

// Surface Nets：每个跨越表面的小格子放一个顶点，每条跨越表面的格边连一个四边形
export function surfaceNets(field, cell, bmin = field.min, bmax = field.max) {
  const nx = Math.ceil((bmax[0] - bmin[0]) / cell) + 1;
  const ny = Math.ceil((bmax[1] - bmin[1]) / cell) + 1;
  const nz = Math.ceil((bmax[2] - bmin[2]) / cell) + 1;
  const vals = new Float32Array(nx * ny * nz);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    vals[i + nx * (j + ny * k)] = field.eval(bmin[0] + i * cell, bmin[1] + j * cell, bmin[2] + k * cell);
  }
  const cx = nx - 1, cy = ny - 1, cz = nz - 1;
  const cubeVert = new Int32Array(cx * cy * cz).fill(-1);
  const pos = [];
  const corner = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [];
  for (let a = 0; a < 8; a++) for (let b = a + 1; b < 8; b++) { const d = a ^ b; if (d === 1 || d === 2 || d === 4) edges.push([a, b]); }
  const v = new Float32Array(8);
  for (let k = 0; k < cz; k++) for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) {
      const o = corner[c];
      v[c] = vals[(i + o[0]) + nx * ((j + o[1]) + ny * (k + o[2]))];
      if (v[c] < 0) mask |= 1 << c;
    }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, cnt = 0;
    for (const [a, b] of edges) {
      if ((v[a] < 0) === (v[b] < 0)) continue;
      const t = v[a] / (v[a] - v[b]);
      const oa = corner[a], ob = corner[b];
      sx += oa[0] + (ob[0] - oa[0]) * t; sy += oa[1] + (ob[1] - oa[1]) * t; sz += oa[2] + (ob[2] - oa[2]) * t; cnt++;
    }
    cubeVert[i + cx * (j + cy * k)] = pos.length / 3;
    pos.push(bmin[0] + (i + sx / cnt) * cell, bmin[1] + (j + sy / cnt) * cell, bmin[2] + (k + sz / cnt) * cell);
  }
  const idx = [];
  const cv = (i, j, k) => (i < 0 || j < 0 || k < 0 || i >= cx || j >= cy || k >= cz) ? -1 : cubeVert[i + cx * (j + cy * k)];
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d);
  };
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const v0 = vals[i + nx * (j + ny * k)];
    const in0 = v0 < 0;
    // x 方向的格边
    if (i < nx - 1 && j > 0 && k > 0) {
      const v1 = vals[(i + 1) + nx * (j + ny * k)];
      if (in0 !== (v1 < 0)) quad(cv(i, j - 1, k - 1), cv(i, j, k - 1), cv(i, j, k), cv(i, j - 1, k), !in0);
    }
    if (j < ny - 1 && i > 0 && k > 0) {
      const v1 = vals[i + nx * ((j + 1) + ny * k)];
      if (in0 !== (v1 < 0)) quad(cv(i - 1, j, k - 1), cv(i - 1, j, k), cv(i, j, k), cv(i, j, k - 1), !in0);
    }
    if (k < nz - 1 && i > 0 && j > 0) {
      const v1 = vals[i + nx * (j + ny * (k + 1))];
      if (in0 !== (v1 < 0)) quad(cv(i - 1, j - 1, k), cv(i, j - 1, k), cv(i, j, k), cv(i - 1, j, k), !in0);
    }
  }
  return { positions: new Float32Array(pos), indices: idx.length > 65535 * 3 ? new Uint32Array(idx) : new Uint32Array(idx) };
}

// 把顶点沿梯度推到等值面上（Surface Nets 顶点只是近似位置）
export function relax(field, positions, iters = 2) {
  for (let it = 0; it < iters; it++) {
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i], y = positions[i + 1], z = positions[i + 2];
      const d = field.eval(x, y, z);
      if (Math.abs(d) < 1e-5) continue;
      const n = field.normal(x, y, z, 0.003);
      positions[i] -= n[0] * d; positions[i + 1] -= n[1] * d; positions[i + 2] -= n[2] * d;
    }
  }
}
