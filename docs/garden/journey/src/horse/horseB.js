// 风格化的马（B 马）：用距离场捏出圆润的身体，鬃毛和尾巴是成块的发束，带马鞍、笼头和缰绳。
// 网格在加载时程序生成（约 0.5 秒），骨骼和动作由 rig.js 驱动。
import * as THREE from 'three';
import { Field, ellipsoid, roundCone, rotXYZ, surfaceNets, relax } from './sdf.js';

// ---------------- 骨骼（静止姿势，马头朝 +Z，Y 向上，+X 是马的左侧） ----------------
export const BONES = [
  ['body', null, [0, 1.02, 0.0]],
  ['pelvis', 'body', [0, 1.12, -0.42]],
  ['tail1', 'pelvis', [0, 1.27, -0.77]],
  ['tail2', 'tail1', [0, 1.17, -0.93]],
  ['tail3', 'tail2', [0, 0.95, -1.03]],
  ['tail4', 'tail3', [0, 0.67, -1.07]],
  ['tailEnd', 'tail4', [0, 0.38, -1.05]],
  ['chest', 'body', [0, 1.06, 0.38]],
  ['neck1', 'chest', [0, 1.20, 0.58]],
  ['neck2', 'neck1', [0, 1.48, 0.78]],
  ['head', 'neck2', [0, 1.76, 0.94]],
  ['headEnd', 'head', [0, 1.40, 1.32]],
];
for (const [s, x] of [['L', 1], ['R', -1]]) {
  BONES.push(
    ['ear' + s, 'head', [0.066 * x, 1.86, 0.925]], ['earEnd' + s, 'ear' + s, [0.092 * x, 2.0, 0.905]],
    ['shoulder' + s, 'chest', [0.165 * x, 1.0, 0.56]], ['elbow' + s, 'shoulder' + s, [0.175 * x, 0.78, 0.43]],
    ['knee' + s, 'elbow' + s, [0.165 * x, 0.40, 0.462]], ['ffet' + s, 'knee' + s, [0.165 * x, 0.118, 0.47]],
    ['fhoof' + s, 'ffet' + s, [0.165 * x, 0.0, 0.51]],
    ['hip' + s, 'pelvis', [0.17 * x, 1.0, -0.50]], ['stifle' + s, 'hip' + s, [0.195 * x, 0.72, -0.31]],
    ['hock' + s, 'stifle' + s, [0.168 * x, 0.44, -0.62]], ['hfet' + s, 'hock' + s, [0.166 * x, 0.118, -0.585]],
    ['hhoof' + s, 'hfet' + s, [0.166 * x, 0.0, -0.545]],
  );
}
// 设计空间 → 最终造型：头放大一点、腿压短一点，更圆润可爱
const HEAD_GROUP = /^(head|headEnd|ear|earEnd)/;
const HEAD_PIVOT = [0, 1.76, 0.94], HEAD_S = 1.13, LEG_Y = 0.8, LEG_S = 0.86;
export function X(p, head = false) {
  let q = p;
  if (head) q = [HEAD_PIVOT[0] + (p[0] - HEAD_PIVOT[0]) * HEAD_S, HEAD_PIVOT[1] + (p[1] - HEAD_PIVOT[1]) * HEAD_S, HEAD_PIVOT[2] + (p[2] - HEAD_PIVOT[2]) * HEAD_S];
  const y = q[1] < LEG_Y ? q[1] * LEG_S : q[1] - LEG_Y * (1 - LEG_S);
  return [q[0], y, q[2]];
}
const isHead = b => typeof b === 'string' && HEAD_GROUP.test(b);
const BI = Object.fromEntries(BONES.map((b, i) => [b[0], i]));
const BP = Object.fromEntries(BONES.map(b => [b[0], X(b[2], isHead(b[0]))]));

// 毛色（海福林马：金栗色身体、亚麻色鬃尾）
export const COATS = {
  haflinger: { coat: '#c4773a', belly: '#d99a5c', muzzle: '#e9c7a4', blaze: '#f7efe2', hoof: '#3f322b', feather: '#efd7a6', mane: '#eecb88', maneRoot: '#c4914e', maneTip: '#fbe6b8', eye: '#22140e' },
};

// ---------------- 形状 ----------------
const E = (c, r, bone, o = {}) => { const h = isHead(bone), f = h ? HEAD_S : 1; return { shape: ellipsoid(X(c, h), r.map(v => v * f), o.rot || null), bone, k: (o.k ?? 0.08) * f, region: o.region || 'coat' }; };
const C = (a, b, ra, rb, bone, o = {}) => { const h = isHead(bone), f = h ? HEAD_S : 1; return { shape: roundCone(X(a, h), X(b, h), ra * f, rb * f), bone, k: (o.k ?? 0.08) * f, region: o.region || 'coat' }; };

function bodyPrims() {
  const P = [
    E([0, 1.0, -0.02], [0.29, 0.31, 0.56], 'body', { k: 0 }),
    E([0, 0.88, 0.0], [0.255, 0.17, 0.42], 'body', { k: 0.1, region: 'belly' }),
    E([0, 1.0, 0.36], [0.25, 0.30, 0.27], 'chest', { k: 0.12 }),
    E([0, 0.97, 0.55], [0.19, 0.22, 0.12], 'chest', { k: 0.1 }),
    C([0, 1.20, 0.40], [0, 1.22, 0.10], 0.13, 0.15, ['chest', 'body'], { k: 0.12 }),
    C([0, 1.21, 0.10], [0, 1.24, -0.40], 0.16, 0.17, ['body', 'pelvis'], { k: 0.12 }),
    E([0.11, 1.12, -0.48], [0.19, 0.27, 0.30], 'pelvis', { k: 0.1 }),
    E([-0.11, 1.12, -0.48], [0.19, 0.27, 0.30], 'pelvis', { k: 0.1 }),
    C([0, 1.25, -0.30], [0, 1.21, -0.70], 0.15, 0.12, 'pelvis', { k: 0.1 }),
    E([0, 1.04, -0.66], [0.21, 0.24, 0.14], 'pelvis', { k: 0.1 }),
    C([0, 1.25, -0.72], [0, 1.22, -0.84], 0.065, 0.05, ['pelvis', 'tail1'], { k: 0.05 }),
    // 脖子：底部粗、上缘拱起
    C([0, 1.08, 0.50], [0, 1.40, 0.74], 0.24, 0.17, ['chest', 'neck1'], { k: 0.12 }),
    C([0, 1.30, 0.66], [0, 1.62, 0.86], 0.18, 0.135, ['neck1', 'neck2'], { k: 0.1 }),
    C([0, 1.58, 0.82], [0, 1.77, 0.94], 0.14, 0.12, ['neck2', 'head'], { k: 0.08 }),
    C([0, 1.34, 0.52], [0, 1.74, 0.86], 0.09, 0.08, ['neck1', 'neck2'], { k: 0.08 }),
    // 头
    E([0, 1.745, 0.97], [0.112, 0.122, 0.14], 'head', { k: 0.06 }),
    E([0.055, 1.62, 0.985], [0.07, 0.108, 0.12], 'head', { k: 0.06, rot: rotXYZ(0.35, 0, 0) }),
    E([-0.055, 1.62, 0.985], [0.07, 0.108, 0.12], 'head', { k: 0.06, rot: rotXYZ(0.35, 0, 0) }),
    C([0, 1.70, 1.02], [0, 1.47, 1.25], 0.102, 0.085, 'head', { k: 0.06 }),
    E([0, 1.43, 1.27], [0.094, 0.094, 0.10], 'head', { k: 0.05, region: 'muzzle' }),
    E([0, 1.392, 1.30], [0.078, 0.05, 0.074], 'head', { k: 0.03, region: 'muzzle' }),
    E([0, 1.36, 1.225], [0.054, 0.04, 0.06], 'head', { k: 0.03, region: 'muzzle' }),
    E([0.072, 1.742, 1.035], [0.042, 0.028, 0.05], 'head', { k: 0.03 }),
    E([-0.072, 1.742, 1.035], [0.042, 0.028, 0.05], 'head', { k: 0.03 }),
    // 眼睑（让眼睛显得温和）
    C([0.088, 1.708, 1.03], [0.084, 1.708, 1.083], 0.016, 0.014, 'head', { k: 0.02 }),
    C([-0.088, 1.708, 1.03], [-0.084, 1.708, 1.083], 0.016, 0.014, 'head', { k: 0.02 }),
  ];
  for (const s of [1, -1]) {
    const L = s > 0 ? 'L' : 'R';
    P.push(
      E([0.07 * s, 1.905, 0.928], [0.034, 0.088, 0.025], 'ear' + L, { k: 0.03, rot: rotXYZ(-0.12, 0, 0.26 * s) }),
      // 前腿
      E([0.16 * s, 0.97, 0.47], [0.11, 0.22, 0.16], 'shoulder' + L, { k: 0.1 }),
      C([0.165 * s, 1.0, 0.56], [0.175 * s, 0.78, 0.44], 0.11, 0.098, 'shoulder' + L, { k: 0.1 }),
      C([0.176 * s, 0.80, 0.432], [0.165 * s, 0.42, 0.46], 0.096, 0.06, 'elbow' + L, { k: 0.05 }),
      E([0.165 * s, 0.40, 0.462], [0.06, 0.066, 0.058], 'knee' + L, { k: 0.035 }),
      C([0.165 * s, 0.40, 0.462], [0.165 * s, 0.13, 0.47], 0.049, 0.045, 'knee' + L, { k: 0.03 }),
      E([0.165 * s, 0.115, 0.468], [0.054, 0.056, 0.056], 'ffet' + L, { k: 0.03 }),
      C([0.165 * s, 0.11, 0.47], [0.165 * s, 0.06, 0.50], 0.046, 0.05, 'ffet' + L, { k: 0.02 }),
      C([0.165 * s, 0.075, 0.505], [0.165 * s, 0.022, 0.516], 0.056, 0.07, 'ffet' + L, { k: 0.012, region: 'hoof' }),
      E([0.165 * s, 0.095, 0.438], [0.05, 0.05, 0.036], 'ffet' + L, { k: 0.02, region: 'feather' }),
      E([(0.165 + 0.035) * s, 0.085, 0.455], [0.022, 0.045, 0.04], 'ffet' + L, { k: 0.015, region: 'feather' }),
      E([(0.165 - 0.035) * s, 0.085, 0.455], [0.022, 0.045, 0.04], 'ffet' + L, { k: 0.015, region: 'feather' }),
      // 后腿
      E([0.15 * s, 0.95, -0.48], [0.13, 0.24, 0.22], 'hip' + L, { k: 0.1 }),
      C([0.17 * s, 0.98, -0.50], [0.195 * s, 0.72, -0.32], 0.15, 0.10, 'hip' + L, { k: 0.08 }),
      C([0.195 * s, 0.72, -0.32], [0.168 * s, 0.445, -0.61], 0.10, 0.058, 'stifle' + L, { k: 0.05 }),
      E([0.168 * s, 0.44, -0.625], [0.056, 0.074, 0.07], 'hock' + L, { k: 0.04 }),
      C([0.168 * s, 0.44, -0.612], [0.166 * s, 0.13, -0.585], 0.05, 0.045, 'hock' + L, { k: 0.03 }),
      E([0.166 * s, 0.115, -0.583], [0.054, 0.056, 0.056], 'hfet' + L, { k: 0.03 }),
      C([0.166 * s, 0.11, -0.585], [0.166 * s, 0.06, -0.555], 0.046, 0.05, 'hfet' + L, { k: 0.02 }),
      C([0.166 * s, 0.075, -0.55], [0.166 * s, 0.022, -0.54], 0.056, 0.07, 'hfet' + L, { k: 0.012, region: 'hoof' }),
      E([0.166 * s, 0.095, -0.615], [0.05, 0.05, 0.036], 'hfet' + L, { k: 0.02, region: 'feather' }),
      E([(0.166 + 0.035) * s, 0.085, -0.598], [0.022, 0.045, 0.04], 'hfet' + L, { k: 0.015, region: 'feather' }),
      E([(0.166 - 0.035) * s, 0.085, -0.598], [0.022, 0.045, 0.04], 'hfet' + L, { k: 0.015, region: 'feather' }),
    );
  }
  return P;
}

function carvePrims() {
  const halfSpace = { box: [-9, -9, -9, 9, 9, 9], t: () => 0, dist: (x, y) => y }; // 地面以下切平（马蹄底）
  return [
    { shape: ellipsoid(X([0.046, 1.44, 1.352], true), [0.019, 0.029, 0.022], rotXYZ(0, 0, -0.3)), k: 0.02 },
    { shape: ellipsoid(X([-0.046, 1.44, 1.352], true), [0.019, 0.029, 0.022], rotXYZ(0, 0, 0.3)), k: 0.02 },
    { shape: halfSpace, k: 0.006 },
  ];
}

// ---------------- 小工具 ----------------
const col = h => new THREE.Color(h);
function hash3(x, y, z) { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const L = (a, b, t) => a + (b - a) * t;
  return L(L(L(hash3(ix, iy, iz), hash3(ix + 1, iy, iz), u), L(hash3(ix, iy + 1, iz), hash3(ix + 1, iy + 1, iz), u), v),
    L(L(hash3(ix, iy, iz + 1), hash3(ix + 1, iy, iz + 1), u), L(hash3(ix, iy + 1, iz + 1), hash3(ix + 1, iy + 1, iz + 1), u), v), w);
}
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function segDist(p, a, b) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  const t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / (ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2)));
  return Math.hypot(ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t);
}

// 网格累加器：所有部件合成一个几何体（一张贴图都不用，全靠顶点色）
class Builder {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.glow = []; this.si = []; this.sw = []; this.idx = []; }
  get count() { return this.pos.length / 3; }
  vert(p, n, c, weights, glow = 0) {
    this.pos.push(p[0], p[1], p[2]); this.nor.push(n[0], n[1], n[2]); this.col.push(c.r, c.g, c.b); this.glow.push(glow);
    const w = Object.entries(weights).sort((a, b) => b[1] - a[1]).slice(0, 4);
    let s = 0; for (const e of w) s += e[1];
    for (let i = 0; i < 4; i++) { this.si.push(w[i] ? BI[w[i][0]] : 0); this.sw.push(w[i] ? w[i][1] / s : 0); }
    return this.count - 1;
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aGlow', new THREE.Float32BufferAttribute(this.glow, 1));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}

// 把一个点沿梯度投到身体表面，再往外偏 off
function onSurface(field, p, off = 0) {
  let q = p.slice();
  for (let i = 0; i < 6; i++) {
    const d = field.eval(q[0], q[1], q[2]) - off;
    if (Math.abs(d) < 2e-4) break;
    const n = field.normal(q[0], q[1], q[2], 0.003);
    q = [q[0] - n[0] * d, q[1] - n[1] * d, q[2] - n[2] * d];
  }
  return q;
}
// 从内部一点沿方向找表面（二分）
function rayToSurface(field, o, dir, maxT = 0.8) {
  let a = 0, b = maxT;
  if (field.eval(o[0], o[1], o[2]) > 0) return null;
  for (let i = 0; i < 28; i++) {
    const m = (a + b) / 2;
    if (field.eval(o[0] + dir[0] * m, o[1] + dir[1] * m, o[2] + dir[2] * m) < 0) a = m; else b = m;
  }
  const t = (a + b) / 2;
  return [o[0] + dir[0] * t, o[1] + dir[1] * t, o[2] + dir[2] * t];
}

// 管子（鬃毛发束、尾巴发束都用它）：中心线 + 截面宽度/厚度函数
function tube(B, pts, opts) {
  const { seg = 8, width, thick, color, weight, upHint = [0, 1, 0], flat = [1, 0, 0] } = opts;
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)), false, 'centripetal');
  const N = opts.samples || 20;
  const frames = [];
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    const p = curve.getPointAt(s), t = curve.getTangentAt(s);
    // 截面的“宽”方向尽量贴着 flat 提示（贴着脖子侧面铺开）
    let w = new THREE.Vector3(...flat); w.addScaledVector(t, -w.dot(t));
    if (w.lengthSq() < 1e-6) w = new THREE.Vector3(...upHint).cross(t);
    w.normalize();
    const h = new THREE.Vector3().crossVectors(t, w).normalize();
    frames.push({ s, p, t, w, h });
  }
  const base = B.count;
  for (const f of frames) {
    const W = width(f.s), H = thick(f.s);
    for (let j = 0; j < seg; j++) {
      const a = j / seg * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const p = f.p.clone().addScaledVector(f.w, ca * W).addScaledVector(f.h, sa * H);
      const n = f.w.clone().multiplyScalar(ca * H).addScaledVector(f.h, sa * W).normalize();
      const c = color(f.s, ca, sa);
      B.vert([p.x, p.y, p.z], [n.x, n.y, n.z], c, weight(f.s, p));
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < seg; j++) {
    const a = base + i * seg + j, b = base + i * seg + (j + 1) % seg, c = a + seg, d = b + seg;
    B.idx.push(a, c, b, b, c, d);
  }
  // 尾端收成一个点
  const last = frames[N];
  const tip = B.vert([last.p.x, last.p.y, last.p.z], [last.t.x, last.t.y, last.t.z], color(1, 0, 0), weight(1, last.p));
  for (let j = 0; j < seg; j++) B.idx.push(base + N * seg + j, tip, base + N * seg + (j + 1) % seg);
}

// 沿表面的皮带（笼头、肚带）：折线 → 贴表面的扁带
function strap(B, field, pts, opts) {
  const { width = 0.022, thick = 0.006, off = 0.006, color, bone, step = 0.012, closed = false } = opts;
  // 重新均匀采样
  const P = [];
  const src = closed ? [...pts, pts[0]] : pts;
  for (let i = 0; i < src.length - 1; i++) {
    const a = src[i], b = src[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const n = Math.max(1, Math.ceil(L / step));
    for (let k = 0; k < n; k++) { const t = k / n; P.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]); }
  }
  if (!closed) P.push(src[src.length - 1]);
  const S = P.map(p => onSurface(field, p, off + thick));
  const base = B.count;
  const M = S.length;
  for (let i = 0; i < M; i++) {
    const p = S[i];
    const pn = field.normal(p[0], p[1], p[2]);
    const a = S[closed ? (i - 1 + M) % M : Math.max(0, i - 1)], b = S[closed ? (i + 1) % M : Math.min(M - 1, i + 1)];
    const t = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
    const n = new THREE.Vector3(...pn);
    const w = new THREE.Vector3().crossVectors(t, n).normalize();
    const corners = [[-1, 1], [1, 1], [1, -1], [-1, -1]];
    const norms = [n, n, n.clone().negate(), n.clone().negate()];
    for (let c = 0; c < 4; c++) {
      const q = new THREE.Vector3(...p).addScaledVector(w, corners[c][0] * width / 2).addScaledVector(n, corners[c][1] * thick / 2);
      const nn = c < 2 ? n.clone().addScaledVector(w, corners[c][0] * 0.6).normalize() : norms[c];
      B.vert([q.x, q.y, q.z], [nn.x, nn.y, nn.z], color, typeof bone === 'string' ? { [bone]: 1 } : bone(p));
    }
  }
  const segs = closed ? M : M - 1;
  for (let i = 0; i < segs; i++) {
    const a = base + i * 4, b = base + ((i + 1) % M) * 4;
    for (let c = 0; c < 4; c++) {
      const c2 = (c + 1) % 4;
      B.idx.push(a + c, b + c, a + c2, a + c2, b + c, b + c2);
    }
  }
}

function sphere(B, c, r, color, bone, glow = 0, seg = 10) {
  const base = B.count;
  for (let i = 0; i <= seg; i++) {
    const v = i / seg, th = v * Math.PI;
    for (let j = 0; j <= seg * 2; j++) {
      const u = j / (seg * 2), ph = u * Math.PI * 2;
      const n = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
      B.vert([c[0] + n[0] * r, c[1] + n[1] * r, c[2] + n[2] * r], n, color, { [bone]: 1 }, glow);
    }
  }
  const row = seg * 2 + 1;
  for (let i = 0; i < seg; i++) for (let j = 0; j < seg * 2; j++) {
    const a = base + i * row + j, b = a + 1, c2 = a + row, d = c2 + 1;
    B.idx.push(a, b, c2, b, d, c2);
  }
}

// 马鞍、鞍褥之类贴着背部的“壳”：沿身体轴线 (0, 1.0, z) 向外打射线找表面
function shell(B, field, opts) {
  const { z0, z1, th0, th1, nz = 18, nth = 24, off, thick, color, bone, lift = () => 0, keep = () => true, axisY = 1.0 } = opts;
  const grid = [];
  for (let i = 0; i <= nz; i++) {
    const z = z0 + (z1 - z0) * i / nz; const row = [];
    for (let j = 0; j <= nth; j++) {
      const th = th0 + (th1 - th0) * j / nth;
      const dir = [Math.sin(th), Math.cos(th), 0];
      const p = rayToSurface(field, [0, axisY, z], dir, 0.8);
      if (!p) { row.push(null); continue; }
      const n = field.normal(p[0], p[1], p[2]);
      const u = i / nz, v = j / nth;
      const L = off + lift(u, v);
      row.push({ p: [p[0] + n[0] * L, p[1] + n[1] * L, p[2] + n[2] * L], n, u, v, ok: keep(u, v) });
    }
    grid.push(row);
  }
  const top = [], bot = [];
  for (let i = 0; i <= nz; i++) { top.push([]); bot.push([]); for (let j = 0; j <= nth; j++) {
    const g = grid[i][j]; if (!g) { top[i].push(-1); bot[i].push(-1); continue; }
    const c = color(g.u, g.v);
    top[i].push(B.vert(g.p, g.n, c, typeof bone === 'string' ? { [bone]: 1 } : bone(g.p)));
    const q = [g.p[0] - g.n[0] * thick, g.p[1] - g.n[1] * thick, g.p[2] - g.n[2] * thick];
    bot[i].push(B.vert(q, [-g.n[0], -g.n[1], -g.n[2]], c.clone().multiplyScalar(0.7), typeof bone === 'string' ? { [bone]: 1 } : bone(g.p)));
  } }
  const ok = (i, j) => grid[i][j] && grid[i][j].ok;
  for (let i = 0; i < nz; i++) for (let j = 0; j < nth; j++) {
    if (!(ok(i, j) && ok(i + 1, j) && ok(i, j + 1) && ok(i + 1, j + 1))) continue;
    const a = top[i][j], b = top[i + 1][j], c = top[i][j + 1], d = top[i + 1][j + 1];
    B.idx.push(a, b, c, b, d, c);
    const a2 = bot[i][j], b2 = bot[i + 1][j], c2 = bot[i][j + 1], d2 = bot[i + 1][j + 1];
    B.idx.push(a2, c2, b2, b2, c2, d2);
  }
  // 边缘封口
  const edge = (i, j) => ok(i, j);
  for (let i = 0; i < nz; i++) for (let j = 0; j <= nth; j++) {
    if (!(edge(i, j) && edge(i + 1, j))) continue;
    const outside = j === 0 || j === nth || !ok(i, j - 1 < 0 ? 0 : j - 1) || !ok(i, Math.min(nth, j + 1));
    if (!outside) continue;
    B.idx.push(top[i][j], bot[i][j], top[i + 1][j], top[i + 1][j], bot[i][j], bot[i + 1][j]);
    B.idx.push(top[i][j], top[i + 1][j], bot[i][j], top[i + 1][j], bot[i + 1][j], bot[i][j]);
  }
  for (let j = 0; j < nth; j++) for (const i of [0, nz]) {
    if (!(edge(i, j) && edge(i, j + 1))) continue;
    B.idx.push(top[i][j], bot[i][j], top[i][j + 1], top[i][j + 1], bot[i][j], bot[i][j + 1]);
    B.idx.push(top[i][j], top[i][j + 1], bot[i][j], top[i][j + 1], bot[i][j + 1], bot[i][j]);
  }
}

// ---------------- 主体网格 ----------------
export function buildHorseB(opts = {}) {
  const t0 = performance.now();
  const coat = COATS[opts.coat || 'haflinger'];
  const prims = bodyPrims();
  const field = new Field(prims, carvePrims(), 0.06);
  const cell = opts.cell || 0.019;
  const { positions, indices } = surfaceNets(field, cell, [-0.42, -0.01, -1.0], [0.42, 2.02, 1.5]);
  relax(field, positions, 1);
  const B = new Builder();
  const cCoat = col(coat.coat), cBelly = col(coat.belly), cMuzzle = col(coat.muzzle), cBlaze = col(coat.blaze), cHoof = col(coat.hoof), cFeather = col(coat.feather);
  const tmp = [];
  const sigmaW = 0.03, sigmaC = 0.012;
  const H = p => X(p, true);
  const nos = [H([0.046, 1.44, 1.36]), H([-0.046, 1.44, 1.36])];
  const EYE = [H([0.093, 1.686, 1.05]), H([-0.093, 1.686, 1.05])];
  const yTop = H([0, 1.83, 1.0])[1], yBot = H([0, 1.45, 1.3])[1], yMouth = H([0, 1.372, 1.3])[1];
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    tmp.length = 0;
    field.eval(x, y, z, tmp);
    let dmin = 1e9; for (let k = 1; k < tmp.length; k += 2) dmin = Math.min(dmin, tmp[k]);
    const weights = {}; const regions = {};
    for (let k = 0; k < tmp.length; k += 2) {
      const pr = prims[tmp[k]], d = tmp[k + 1];
      const w = Math.exp(-(d - dmin) / sigmaW);
      if (w > 0.002) {
        if (Array.isArray(pr.bone)) {
          const t = sstep(0.15, 0.85, pr.shape.t(x, y, z));
          weights[pr.bone[0]] = (weights[pr.bone[0]] || 0) + w * (1 - t);
          weights[pr.bone[1]] = (weights[pr.bone[1]] || 0) + w * t;
        } else weights[pr.bone] = (weights[pr.bone] || 0) + w;
      }
      const wc = Math.exp(-(d - dmin) / sigmaC);
      regions[pr.region] = (regions[pr.region] || 0) + wc;
    }
    const n = field.normal(x, y, z);
    const ao = field.ao(x, y, z, n);
    let rs = 0; const c = new THREE.Color(0, 0, 0);
    for (const [r, w] of Object.entries(regions)) {
      const rc = r === 'belly' ? cBelly : r === 'muzzle' ? cMuzzle : r === 'hoof' ? cHoof : r === 'feather' ? cFeather : cCoat;
      c.r += rc.r * w; c.g += rc.g * w; c.b += rc.b * w; rs += w;
    }
    c.multiplyScalar(1 / rs);
    const headW = (weights.head || 0) / Object.values(weights).reduce((a, b) => a + b, 0);
    // 额头到鼻梁的白色流星纹（只在脸的正面）
    if (headW > 0.5 && z > 1.0) {
      const v = (y - yBot) / (yTop - yBot);
      const bw = (0.024 + 0.016 * Math.sin(Math.min(1, Math.max(0, v)) * Math.PI)) * HEAD_S;
      const front = sstep(0.05, 0.4, n[2] + n[1] * 0.4);
      const m = sstep(bw + 0.006, bw - 0.004, Math.abs(x)) * sstep(-0.05, 0.08, v) * sstep(1.05, 0.9, v) * front;
      c.lerp(cBlaze, m);
    }
    for (const q of nos) { const dn = Math.hypot(x - q[0], y - q[1], z - q[2]); c.multiplyScalar(1 - 0.5 * sstep(0.04, 0.014, dn)); }
    if (headW > 0.5 && z > H([0, 0, 1.18])[2] && Math.abs(y - yMouth) < 0.012 && Math.abs(x) > 0.025) c.multiplyScalar(0.75);
    for (const q of EYE) { const de = Math.hypot(x - q[0], y - q[1], z - q[2]); c.multiplyScalar(1 - 0.2 * sstep(0.07, 0.035, de)); }
    // 手绘感：大块明暗斑驳 + 下深上浅
    const nv = vnoise(x * 6, y * 6, z * 6) * 0.6 + vnoise(x * 14 + 3, y * 14, z * 14) * 0.4;
    const shade = (0.93 + 0.12 * nv) * (0.84 + 0.16 * sstep(0.15, 1.2, y));
    c.multiplyScalar(shade * (0.48 + 0.52 * ao));
    B.vert([x, y, z], n, c, weights);
  }
  for (let i = 0; i < indices.length; i++) B.idx.push(indices[i]);
  const bodyVerts = B.count;

  // ---- 眼睛：大一点的深色眼珠加两个高光，眼珠一半露在外面 ----
  for (const s of [1, -1]) {
    const e0 = EYE[s > 0 ? 0 : 1];
    const dir = norm3([s, 0.12, 0.42]);
    const sp = rayToSurface(field, [0, e0[1], e0[2]], dir, 0.4) || e0;
    const R = 0.04;
    const ec = sub3(sp, scale3(dir, R * 0.42));
    sphere(B, ec, R, col(coat.eye), 'head', 0, 12);
    const hl = add3(ec, scale3(norm3([s * 0.62, 0.45, 0.64]), R * 0.92));
    sphere(B, hl, 0.0105, col('#ffffff'), 'head', 1, 6);
    const hl2 = add3(ec, scale3(norm3([s * 0.8, -0.35, 0.5]), R * 0.95));
    sphere(B, hl2, 0.005, col('#ffffff'), 'head', 0.7, 4);
  }

  // ---- 鬃毛：沿颈顶的一排发束，倒向马的右侧（-X） ----
  const cMane = col(coat.mane), cRoot = col(coat.maneRoot), cTip = col(coat.maneTip);
  const crest = [];
  const CR = [H([0, 1.87, 0.895]), X([0, 1.70, 0.76]), X([0, 1.52, 0.60]), X([0, 1.36, 0.42])];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const q = t < 1 / 3 ? lerp3(CR[0], CR[1], t * 3) : t < 2 / 3 ? lerp3(CR[1], CR[2], t * 3 - 1) : lerp3(CR[2], CR[3], t * 3 - 2);
    const dir = norm3([0, 1, 0.25]);
    const top = rayToSurface(field, [0, q[1] - 0.14, q[2] - 0.02], dir, 0.5) || q;
    crest.push(top);
  }
  const neckWeight = (t) => {
    if (t < 0.18) return { head: 1 - t / 0.18 * 0.5, neck2: t / 0.18 * 0.5 };
    if (t < 0.55) { const u = (t - 0.18) / 0.37; return { neck2: 1 - u * 0.6, neck1: u * 0.6 }; }
    const u = Math.min(1, (t - 0.55) / 0.45); return { neck1: 1 - u * 0.7, chest: u * 0.7 };
  };
  const maneColor = (seed) => (s, ca) => {
    const base = cRoot.clone().lerp(cMane, sstep(0, 0.3, s)).lerp(cTip, sstep(0.6, 1, s));
    const stripe = 0.88 + 0.16 * Math.max(0, ca) + 0.06 * Math.sin(seed * 13.7);
    return base.multiplyScalar(stripe);
  };
  const hug = (p, off) => { const d = field.eval(p[0], p[1], p[2]); if (d < off) { const n = field.normal(p[0], p[1], p[2]); return add3(p, scale3(n, off - d)); } return p; };
  const rnd = mulberry(7);
  const nClumps = 19;
  for (let i = 0; i < nClumps; i++) {
    const t = Math.min(0.985, Math.max(0.015, 0.015 + 0.97 * i / (nClumps - 1) + (rnd() - 0.5) * 0.025));
    const k = Math.min(23, Math.floor(t * 24)), f = t * 24 - k;
    const root0 = lerp3(crest[k], crest[k + 1], f);
    const along = norm3(sub3(crest[Math.min(24, k + 1)], crest[Math.max(0, k)]));
    const side = [-1, 0, 0];
    const up = norm3(cross3(along, side));
    const root = add3(root0, scale3(side, (rnd() - 0.4) * 0.03));
    const len = (0.12 + 0.17 * Math.sin(Math.PI * Math.min(1, t * 1.1))) * (0.8 + 0.4 * rnd());
    const back = 0.02 + rnd() * 0.06;   // 有的发束往后飘一点
    const pts = [[0, -0.02, 0], [0.02, 0.05 + rnd() * 0.015, -0.004], [0.075, 0.062, -0.012 - back * 0.2], [0.125, 0.01, -0.02 - back * 0.4], [0.15, -len * 0.55, -0.03 - back * 0.7], [0.13 + 0.04 * rnd(), -len, -0.05 - back]];
    const P = pts.map(([sx, uy, al], j) => { const p = add3(root, add3(scale3(side, sx), add3(scale3(up, uy), scale3(along, al)))); return j ? hug(p, 0.03) : p; });
    const w0 = 0.058 + 0.025 * rnd();
    tube(B, P, {
      seg: 8, samples: 16, flat: along,
      width: s => w0 * (1 - Math.pow(s, 2.2)) * (0.85 + 0.35 * Math.sin(Math.PI * s * 0.9)) + 0.003,
      thick: s => (0.026 + 0.01 * rnd()) * (1 - Math.pow(s, 1.8)) + 0.002,
      color: maneColor(i), weight: () => neckWeight(t),
    });
    if (i % 2 === 1 && t > 0.06 && t < 0.95) {
      const lenL = 0.05 + 0.05 * rnd();
      const Q = [[0, -0.02, 0], [-0.022, 0.05, -0.005], [-0.06, 0.045, -0.015], [-0.08, -lenL, -0.03]].map(([sx, uy, al], j) => { const p = add3(root, add3(scale3(side, sx), add3(scale3(up, uy), scale3(along, al)))); return j ? hug(p, 0.024) : p; });
      tube(B, Q, { seg: 7, samples: 10, flat: along, width: s => 0.05 * (1 - Math.pow(s, 2)) + 0.003, thick: s => 0.022 * (1 - s) + 0.002, color: maneColor(i + 7), weight: () => neckWeight(t) });
    }
  }
  // 额发
  for (let i = 0; i < 3; i++) {
    const s = (i - 1) * 0.032;
    const P = [[s * 0.6, 1.872, 0.9], [s, 1.9, 0.955], [s * 1.3, 1.86, 1.005], [s * 1.5 + 0.008 * i, 1.79, 1.04]].map(p => hug(H(p), 0.02));
    tube(B, P, { seg: 7, samples: 10, flat: [1, 0, 0], width: u => 0.04 * (1 - Math.pow(u, 2)) + 0.003, thick: u => 0.016 * (1 - u) + 0.002, color: maneColor(i + 20), weight: () => ({ head: 1 }) });
  }

  // ---- 尾巴：从尾根散开的一大把发束 ----
  const tailPts = ['tail1', 'tail2', 'tail3', 'tail4', 'tailEnd'].map(n => BP[n]);
  const tailCurve = new THREE.CatmullRomCurve3(tailPts.map(p => new THREE.Vector3(...p)), false, 'centripetal');
  const tailBones = ['tail1', 'tail2', 'tail3', 'tail4'];
  const tailWeight = s => {
    const f = Math.min(3.999, s * 4.2); const k = Math.floor(f), u = f - k;
    const w = {}; w[tailBones[k]] = 1 - u; if (k < 3) w[tailBones[k + 1]] = u; else w[tailBones[k]] = 1;
    if (s < 0.06) w.pelvis = 0.6 * (1 - s / 0.06);
    return w;
  };
  const nTail = 19;
  const rt = mulberry(11);
  for (let i = 0; i < nTail; i++) {
    const a = i / nTail * Math.PI * 2 + rt() * 0.4;
    const spread = [Math.cos(a), Math.sin(a)];
    const lenF = 0.74 + 0.26 * rt();
    const ph = rt() * 6.28, wav = 0.012 + rt() * 0.018;
    const P = [];
    for (let k = 0; k <= 8; k++) {
      const s = k / 8 * lenF;
      const c = tailCurve.getPointAt(Math.min(1, s));
      const fan = 0.03 + 0.075 * Math.sin(Math.min(1, s * 1.5) * Math.PI * 0.5) - 0.03 * Math.max(0, s - 0.7);
      const wave = Math.sin(s * 9 + ph) * wav * s;
      const curl = s > 0.72 ? (s - 0.72) : 0;
      P.push([c.x + spread[0] * fan + wave + spread[0] * curl * 0.2, c.y + spread[1] * fan * 0.3 + curl * 0.12, c.z + spread[1] * fan * 0.55 - curl * 0.15]);
    }
    const w0 = 0.055 + 0.022 * rt();
    tube(B, P, {
      seg: 8, samples: 20, flat: [1, 0, 0],
      width: s => w0 * (0.75 + 0.5 * Math.sin(Math.PI * Math.min(1, s * 1.15))) * (1 - Math.pow(s, 2.6)) + 0.003,
      thick: s => 0.04 * (0.8 + 0.4 * Math.sin(Math.PI * s)) * (1 - Math.pow(s, 2.4)) + 0.002,
      color: maneColor(i + 40), weight: s => tailWeight(s * lenF),
    });
  }

  // ---- 鞍褥、马鞍、肚带 ----
  const red = col('#a03a2a'), trim = col('#e7b24a'), leather = col('#80492a'), leatherDark = col('#55301a');
  const axisY = X([0, 1.0, 0])[1];
  const rounded = (u, v, r = 0.18) => { const du = Math.max(0, Math.abs(u - 0.5) - (0.5 - r)), dv = Math.max(0, Math.abs(v - 0.5) - (0.5 - r)); return du * du + dv * dv <= r * r * 1.02; };
  shell(B, field, {
    axisY, z0: -0.17, z1: 0.31, th0: -1.2, th1: 1.2, nz: 18, nth: 30, off: 0.005, thick: 0.013,
    color: (u, v) => { const e = Math.min(u, 1 - u, v * 1.6, (1 - v) * 1.6); return e < 0.07 ? trim.clone() : red.clone().multiplyScalar(0.92 + 0.08 * Math.sin(u * 40) * Math.sin(v * 50)); },
    bone: p => (p[2] > 0.2 ? { body: 0.6, chest: 0.4 } : { body: 1 }), keep: (u, v) => rounded(u, v, 0.2),
  });
  shell(B, field, {
    axisY, z0: -0.11, z1: 0.24, th0: -0.95, th1: 0.95, nz: 16, nth: 24, off: 0.018, thick: 0.022,
    lift: (u, v) => { const c = Math.exp(-Math.pow((v - 0.5) * 3.0, 2)); return c * (0.05 * sstep(0.28, 0, u) + 0.035 * sstep(0.78, 1, u)) + 0.006 * Math.cos((v - 0.5) * 3); },
    color: (u, v) => { const e = Math.min(u, 1 - u, v, 1 - v); return (e < 0.05 ? leatherDark : leather).clone().multiplyScalar(0.92 + 0.12 * Math.cos((v - 0.5) * 6)); },
    bone: p => (p[2] > 0.2 ? { body: 0.6, chest: 0.4 } : { body: 1 }), keep: (u, v) => rounded(u, v, 0.3),
  });
  shell(B, field, {
    axisY, z0: 0.205, z1: 0.255, th0: -Math.PI, th1: Math.PI, nz: 2, nth: 48, off: 0.004, thick: 0.01,
    color: () => leatherDark.clone(), bone: () => ({ body: 1 }),
  });

  // ---- 笼头 ----
  const strapC = col('#4a2b19'), metal = col('#d8cfb4');
  const ring = (cz, cy, rx, ry, n = 22) => Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2; return H([Math.cos(a) * rx, cy + Math.sin(a) * ry + (Math.sin(a) * ry) * 0, cz + Math.sin(a) * ry * 0.45]); });
  strap(B, field, ring(1.17, 1.515, 0.13, 0.13), { width: 0.026, color: strapC, bone: 'head', closed: true });
  for (const s of [1, -1]) {
    strap(B, field, [[0.1 * s, 1.55, 1.13], [0.105 * s, 1.63, 1.04], [0.1 * s, 1.74, 0.96], [0.075 * s, 1.84, 0.895], [0.0, 1.875, 0.885]].map(H), { width: 0.022, color: strapC, bone: 'head' });
    sphere(B, H([0.074 * s, 1.40, 1.205]), 0.018, metal, 'head', 0.1, 6);
  }
  strap(B, field, [[0.085, 1.80, 0.965], [0.04, 1.825, 1.0], [0, 1.83, 1.01], [-0.04, 1.825, 1.0], [-0.085, 1.80, 0.965]].map(H), { width: 0.02, color: strapC, bone: 'head' });

  const geo = B.geometry();
  geo.userData = { buildMs: performance.now() - t0, bodyVerts, tris: B.idx.length / 3 };
  return geo;
}

const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale3 = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const norm3 = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// ---------------- 骨架 ----------------
export function makeSkeleton() {
  const bones = {}, list = [];
  for (const [name, parent] of BONES) {
    const p = BP[name];
    const b = new THREE.Bone(); b.name = name;
    const pp = parent ? BP[parent] : [0, 0, 0];
    b.position.set(p[0] - pp[0], p[1] - pp[1], p[2] - pp[2]);
    if (parent) bones[parent].add(b);
    bones[name] = b; list.push(b);
  }
  return { bones, list, rest: BP };
}
