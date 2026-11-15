// 翅膀：代码生成的一对羽毛翅膀，挂在旅人背上。每边三节（上臂、前臂、手），羽毛是带弧度的细长面片，顶点色从白到暖金。
// 起飞时展开，拍打时整片翅膀像波浪一样一节一节跟着动，滑翔时张开微微起伏，落地时收起来消失。
// 坐标：翅膀组的 +X 是左边，+Y 是身体朝上（飞的时候朝前），-Z 是背后。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { patch } from '../world/atmo.js';

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const DEG = Math.PI / 180;

// 一根羽毛：沿 +X，根在原点，宽度在 Y 方向（前缘窄、后缘宽），尾端圆；往 -Z 微微弯
function feather(len, wid, curl, c0, c1, lead = 0.32) {
  const T = [0, 0.1, 0.28, 0.5, 0.72, 0.86, 0.95, 1];
  const prof = t => t < 0.28 ? 0.3 + 0.7 * sstep(0, 0.28, t) : t < 0.72 ? 1 : Math.sqrt(Math.max(0, 1 - ((t - 0.72) / 0.28) ** 2)) * 0.92 + 0.04;
  const pos = [], col = [], idx = [];
  const a = new THREE.Color(c0), b = new THREE.Color(c1), c = new THREE.Color();
  T.forEach((t, i) => {
    const x = t * len, w = wid * prof(t), z = -curl * t * t * len;
    c.copy(a).lerp(b, Math.pow(t, 1.3));
    // 三个点：前缘、羽轴、后缘（后缘略往背后翘）
    pos.push(x, w * lead, z + 0.004, x, 0, z, x, -w * (1 - lead), z - 0.01 * t);
    for (let k = 0; k < 3; k++) { const s = k === 1 ? 0.9 : 1; col.push(c.r * s, c.g * s, c.b * s); }
    if (i) { const p = (i - 1) * 3, q = i * 3; idx.push(p, q, p + 1, p + 1, q, q + 1, p + 1, q + 1, p + 2, p + 2, q + 1, q + 2); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// 一节翅膀上的一排羽毛：沿骨头 0..L 放 n 根，角度从 a0 到 a1（0 = 顺着骨头往外，90° = 指向背后下方）
function row(side, L, n, a0, a1, len0, len1, wid, layer, c0, c1, t0 = 0, t1 = 1) {
  const geos = [];
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0 : i / (n - 1);
    const g = feather(len0 + (len1 - len0) * u, wid, 0.06, c0, c1);
    const ang = (a0 + (a1 - a0) * u) * DEG;
    const m = new THREE.Matrix4().makeRotationZ(-ang);
    m.setPosition(L * (t0 + (t1 - t0) * u), 0, layer + i * 0.0015);
    g.applyMatrix4(m);
    if (side < 0) g.applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1));
    geos.push(g);
  }
  return geos;
}

function buildWing(side, mat) {
  const SEG = [0.3, 0.42, 0.34];      // 上臂、前臂、手
  const cream = '#fffaf2', warm = '#f2dfc0', gold = '#e9c48c', shade = '#e6ded2';
  const parts = [[], [], []];
  // 手：初级飞羽，从顺着骨头到指向后下方展开，最长
  parts[2].push(...row(side, SEG[2], 9, 8, 72, 0.92, 0.62, 0.11, 0.0, cream, gold, 1.0, 0.0));
  parts[2].push(...row(side, SEG[2], 6, 30, 70, 0.34, 0.26, 0.08, 0.02, '#fffdf8', warm, 0.95, 0.1));
  // 前臂：次级飞羽，指向后下方
  parts[1].push(...row(side, SEG[1], 10, 78, 92, 0.62, 0.56, 0.12, -0.004, cream, warm, 1.0, 0.0));
  parts[1].push(...row(side, SEG[1], 8, 75, 88, 0.3, 0.26, 0.09, 0.018, '#fffdf8', shade, 0.95, 0.05));
  parts[1].push(...row(side, SEG[1], 7, 70, 85, 0.15, 0.14, 0.07, 0.03, '#ffffff', cream, 0.9, 0.05));
  // 上臂：三级飞羽和覆羽，靠近身体
  parts[0].push(...row(side, SEG[0], 6, 92, 104, 0.5, 0.42, 0.12, -0.006, cream, shade, 1.0, 0.1));
  parts[0].push(...row(side, SEG[0], 6, 85, 100, 0.22, 0.2, 0.09, 0.02, '#ffffff', cream, 0.95, 0.05));
  // 前缘一条圆圆的“肉”：用细长的椭球
  const bone = L => { const g = new THREE.CapsuleGeometry(0.03, L - 0.04, 3, 6); g.rotateZ(Math.PI / 2); g.translate(L / 2, 0.01, 0.01); const n = g.attributes.position.count, col = new Float32Array(n * 3).fill(0.98); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k); g.setIndex(g.index); return g.toNonIndexed(); };
  const segs = []; let parent = null;
  SEG.forEach((L, i) => {
    const o = new THREE.Group();
    const geos = parts[i].map(g => g.toNonIndexed());
    const b = bone(L); if (side < 0) b.applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1));
    geos.push(b);
    const g = mergeGeometries(geos); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat); m.castShadow = true; m.frustumCulled = false; o.add(m);
    if (parent) o.position.set(side * SEG[i - 1], 0, 0);
    (parent || null)?.add(o);
    segs.push(o); parent = o;
  });
  segs[0].position.set(side * 0.085, 0.0, 0);
  return segs;
}

export function makeWings() {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0, side: THREE.DoubleSide });
  patch(mat, { rim: 0.9, gobo: true, fog: true, sss: 0.4 });
  const group = new THREE.Group(); group.name = 'wings';
  const L = buildWing(1, mat), R = buildWing(-1, mat);
  group.add(L[0], R[0]);
  group.visible = false;
  const W = {
    group, open: 0, want: 0, phase: 0, amp: 0, glideW: 0, base: 1,
    show(on) { W.want = on ? 1 : 0; if (on) group.visible = true; },
    // st: { flap (0 = 不拍，越大拍得越快), glide, climb }
    update(dt, st = {}) {
      W.open = damp(W.open, W.want, W.want ? 5 : 4, dt);
      if (W.open < 0.01 && !W.want) { group.visible = false; return; }
      const flapping = st.flap > 0;
      W.amp = damp(W.amp, flapping ? 36 * DEG : 4 * DEG, 3, dt);
      W.glideW = damp(W.glideW, st.glide ? 1 : 0, 2, dt);
      W.phase += dt * (flapping ? 1.25 * st.flap : 0.35) * Math.PI * 2;
      const o = sstep(0, 1, W.open), s = 0.35 + 0.65 * o;
      group.scale.setScalar(s * W.base);
      const ph = W.phase, a = W.amp * o;
      for (const [side, segs] of [[1, L], [-1, R]]) {
        // 收起：整只往下贴着背；张开：往两边伸平，滑翔时微微后掠、上反
        const fold = 1 - o;
        const sweep = (8 + 6 * W.glideW) * DEG;
        segs[0].rotation.set(0, side * (a * Math.sin(ph) - 6 * DEG * W.glideW) + side * (st.climb || 0) * 0.02, -side * (fold * 80 * DEG + sweep * 0.5));
        segs[1].rotation.set(0, side * -a * 0.35 * Math.sin(ph - 0.7), side * fold * 150 * DEG - side * sweep * 0.3);
        segs[2].rotation.set(0, side * -a * 0.55 * Math.sin(ph - 1.4), -side * fold * 140 * DEG - side * sweep * 0.6);
      }
    },
  };
  return W;
}
