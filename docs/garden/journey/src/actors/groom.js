// 给素材马“梳妆”：飘起来的鬃毛、额发、蓬松的尾巴、马笼头，再给身上画白袜子、白鼻梁和毛色深浅。
// 全部在模型自己的绑定坐标里现做，每个顶点抄离它最近的原模型顶点的蒙皮权重，所以跟着原来的骨头一起动；
// 鬃毛、尾巴、笼头合成一块 SkinnedMesh，一匹马只多一次绘制（加影子一次）。
import * as THREE from 'three';
import { patch, U } from '../world/atmo.js';
import { Lag } from './sway.js';

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// 每种坐骑的样子。颜色都是 sRGB；mane/tail 是毛的根部和发梢颜色
export const LOOKS = {
  a: { // 栗子：栗色身子、亚麻色的长鬃毛，三只白袜子和一道白鼻梁
    coat: '#86502f', top: 0.8, belly: 1.18, lowLeg: 0.62, socks: [1, 0, 1, 1], blaze: true,
    mane: ['#a47a46', '#e2c891'], tail: ['#8e6a3e', '#c9ad7c'], maneLen: 1.0, style: 'flow',
    hooves: '#4a3a30', muzzle: '#5a3a2c', bridle: '#3b2416', metal: '#c9b48a',
  },
  w: { // 云朵：奶白色，腿下半截淡淡的灰，屁股上一点灰斑；鬃毛像奶油
    coat: '#d9d1c4', top: 0.96, belly: 1.04, lowLeg: 0.8, socks: [0, 0, 0, 0], dapple: true,
    mane: ['#d6c7aa', '#fbf5e8'], tail: ['#cdbd9f', '#fbf4e6'], maneLen: 1.1, style: 'flow',
    hooves: '#6e6256', muzzle: '#8a7a70', bridle: '#5a2a26', metal: '#c9c2b4',
  },
  d: { // 小毛驴：灰身子、白肚皮白嘴，背上一道深色的“十字”，鬃毛短短地竖着，尾巴尖一撮毛
    coat: '#8f857b', top: 0.92, belly: 1.0, lowLeg: 0.85, socks: [0, 0, 0, 0], cross: true, lightPart: 0.35,
    mane: ['#3a332e', '#5b524a'], tail: ['#4a423b', '#2f2a26'], maneLen: 0.36, style: 'brush',
    hooves: '#4d4339', muzzle: '#d9d2c6', bridle: '#6b4a2a', metal: '#b0a690',
  },
};

const col = (s) => new THREE.Color(s);   // sRGB 字符串 → 线性
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// 读出原模型各部分（按材质名）的顶点：位置、蒙皮
// 毛驴的鬃毛尾巴材质叫 Main_Dark（和脸上的一块重名）：认“从脖子一直到尾巴”的那块当毛
function collect(model) {
  const parts = {};
  model.traverse(o => {
    if (!o.isSkinnedMesh || o.name === 'groom') return;
    const g = o.geometry; let nm = o.material.name;
    g.computeBoundingBox();
    const bb = g.boundingBox;
    if (nm !== 'Hair' && !parts.Hair && bb.min.z < -1.2 && bb.max.z > 1.5 && bb.max.x < 0.3) nm = 'Hair';
    else if (parts[nm]) nm = nm + '2';
    parts[nm] = { mesh: o, name: nm, pos: g.attributes.position, idx: g.attributes.skinIndex, w: g.attributes.skinWeight, nor: g.attributes.normal, bb };
  });
  return parts;
}

// 一条带子：中心线 pts，宽度 w(t)，宽度方向 side(t)，法线方向 out(t)
function ribbon(out, pts, wFn, sideFn, nFn, c0, c1, jitter) {
  const n = pts.length, base = out.pos.length / 3;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), p = pts[i], s = sideFn(t, i), w = wFn(t), nn = nFn(t, i);
    const c = c0.clone().lerp(c1, sstep(0.0, 1.0, t)).multiplyScalar(jitter);
    for (const k of [-1, 1]) {
      out.pos.push(p.x + s.x * w * k, p.y + s.y * w * k, p.z + s.z * w * k);
      out.nor.push(nn.x, nn.y, nn.z);
      out.col.push(c.r, c.g, c.b);
      out.anchor.push(out.curAnchor ? out.curAnchor(i, p) : p);
      // 甩动：绕哪一点摆（毛根）、这一点摆多少（根上不动，越往梢越多）、是鬃毛还是尾巴、每绺不一样的随机数、沿这绺走了多远
      const F = out.flex, R = F && F.kind ? F.root : p;
      out.root.push(R.x, R.y, R.z);
      out.flx.push(F && F.kind ? Math.pow(t, F.pow) * F.amp : 0, F ? F.kind : 0, F ? F.hs : 0, t);
    }
  }
  for (let i = 0; i < n - 1; i++) { const a = base + i * 2; out.idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
}
// 一圈管子（马笼头的皮带）
function tube(out, pts, r, c, closed = false) {
  const n = pts.length, seg = 5, base = out.pos.length / 3;
  const T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3(), up = V(0, 1, 0);
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    if (closed) T.subVectors(b, a); else T.subVectors(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]);
    T.normalize(); N.crossVectors(T, Math.abs(T.y) > 0.9 ? V(1, 0, 0) : up).normalize(); B.crossVectors(T, N);
    for (let k = 0; k < seg; k++) {
      const an = k / seg * Math.PI * 2, d = N.clone().multiplyScalar(Math.cos(an)).addScaledVector(B, Math.sin(an));
      const p = pts[i].clone().addScaledVector(d, r);
      out.pos.push(p.x, p.y, p.z); out.nor.push(d.x, d.y, d.z); out.col.push(c.r, c.g, c.b); out.anchor.push(pts[i]);
      out.root.push(p.x, p.y, p.z); out.flx.push(0, 0, 0, 0);
    }
  }
  const m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) for (let k = 0; k < seg; k++) {
    const a = base + i * seg + k, b = base + i * seg + (k + 1) % seg, c2 = base + ((i + 1) % n) * seg + k, d = base + ((i + 1) % n) * seg + (k + 1) % seg;
    out.idx.push(a, c2, b, b, c2, d);
  }
}
// 二次贝塞尔取点
const bez = (a, b, c, n) => { const out = []; for (let i = 0; i < n; i++) { const t = i / (n - 1), u = 1 - t; out.push(a.clone().multiplyScalar(u * u).addScaledVector(b, 2 * u * t).addScaledVector(c, t * t)); } return out; };

// 做鬃毛、尾巴、笼头的几何体（模型坐标）
function buildGroom(parts, L, ky, kz) {
  const out = { pos: [], nor: [], col: [], idx: [], anchor: [], curAnchor: null, root: [], flx: [], flex: null };
  const hair = parts.Hair, v = new THREE.Vector3();
  const mane = [], tailV = [];
  for (let i = 0; i < hair.pos.count; i++) { v.fromBufferAttribute(hair.pos, i); (v.z > 0.5 * kz ? mane : tailV).push(v.clone()); }
  // 脖子上的“鬃脊”：按 z 分段取最高点
  const ridge = [];
  { const zs = mane.map(p => p.z), z0 = Math.min(...zs), z1 = Math.max(...zs);
    for (let z = z0; z <= z1 + 1e-3; z += 0.1) { const s = mane.filter(p => Math.abs(p.z - z) < 0.12); if (s.length) ridge.push(V(0, Math.max(...s.map(p => p.y)), z)); } }
  const ridgeAt = (u) => { const f = u * (ridge.length - 1), i = Math.min(ridge.length - 2, Math.floor(f)); return ridge[i].clone().lerp(ridge[i + 1], f - i); };
  const m0 = col(L.mane[0]), m1 = col(L.mane[1]);
  const down = V(0, -1, 0);
  if (L.style === 'flow') {
    // 一绺一绺往右边（偶尔往左）垂下来：根部先往上拱，再顺着脖子往下、往后飘，发梢往外卷一点。
    // 每绺是两条十字交叉的带子，从哪个角度看都有厚度
    const N = 34;
    for (let k = 0; k < N; k++) {
      const u = 0.02 + 0.86 * (k / (N - 1)) + (hash(k) - 0.5) * 0.03;
      const r = ridgeAt(u), r2 = ridgeAt(Math.min(1, u + 0.05));
      const T = r2.clone().sub(r).normalize();            // 沿着鬃脊往头
      const s = hash(k * 3.1) < 0.2 ? -1 : 1;
      const len = L.maneLen * (0.62 + 0.3 * Math.sin(Math.PI * Math.min(1, u * 1.15)) + 0.38 * hash(k * 7.3)) * (u > 0.85 ? 0.7 : 1);
      const lay = hash(k * 4.7);                          // 里层还是外层
      const root = r.clone().add(V(s * 0.03 * lay, 0.03 + 0.03 * lay, 0));
      const out1 = 0.26 + 0.14 * lay;
      const c1 = root.clone().add(V(s * out1, 0.16, 0)).addScaledVector(T, -0.04);
      const c2 = root.clone().add(V(s * (out1 + 0.1), -len * 0.5, 0)).addScaledVector(T, -0.15);
      const tip = root.clone().add(V(s * (out1 + 0.04 + 0.12 * hash(k)), -len * 0.9, 0)).addScaledVector(T, -0.24 - 0.16 * hash(k * 2.2));
      const pts = []; for (let i = 0; i < 8; i++) { const t = i / 7, q = 1 - t; pts.push(root.clone().multiplyScalar(q * q * q).addScaledVector(c1, 3 * q * q * t).addScaledVector(c2, 3 * q * t * t).addScaledVector(tip, t * t * t)); }
      out.curAnchor = () => root;
      out.flex = { kind: 1, root, pow: 1.4, amp: 1, hs: hash(k * 11.3) };
      const wRoot = 0.13 + 0.05 * hash(k * 5.5), j = 0.88 + 0.22 * hash(k * 9.7);
      const nOut = t => V(s * (0.6 + 0.3 * t), 0.75 - 0.6 * t, 0).normalize();
      ribbon(out, pts, t => wRoot * (1 - 0.8 * t * t), () => T, nOut, m0, m1, j);
      ribbon(out, pts, t => wRoot * 0.55 * (1 - 0.8 * t * t), t => nOut(t), nOut, m0, m1, j * 0.92);
    }
    // 额发：从两耳之间往前垂到脑门上
    const poll = ridge[ridge.length - 1].clone();
    for (let k = 0; k < 4; k++) {
      const sx = (k - 1.5) * 0.06;
      const root = poll.clone().add(V(sx, 0.02, -0.02));
      const pts = bez(root, root.clone().add(V(sx * 0.5, 0.12, 0.2)), root.clone().add(V(sx * 1.5, -0.24 - 0.06 * hash(k), 0.32)), 5);
      out.curAnchor = () => root;
      out.flex = { kind: 1, root, pow: 1.6, amp: 0.6, hs: hash(k * 6.1 + 3) };
      ribbon(out, pts, t => 0.06 * (1 - 0.8 * t), () => V(1, 0, 0), () => V(0, 0.5, 1).normalize(), m0, m1, 0.95 + 0.1 * hash(k));
    }
    out.curAnchor = null; out.flex = null;
  } else {
    // 毛驴：短短的一排竖着的鬃毛
    const N = 22;
    for (let k = 0; k < N; k++) {
      const u = 0.02 + 0.96 * k / (N - 1), r = ridgeAt(u), r2 = ridgeAt(Math.min(1, u + 0.05)), T = r2.clone().sub(r).normalize();
      const root = r.clone().add(V(0, -0.04, 0));
      const tip = root.clone().add(V((hash(k) - 0.5) * 0.06, L.maneLen * (0.7 + 0.3 * Math.sin(Math.PI * u)), 0)).addScaledVector(T, -0.08);
      const pts = bez(root, root.clone().lerp(tip, 0.5).add(V(0, 0, -0.03)), tip, 4);
      out.curAnchor = () => root;
      out.flex = { kind: 1, root, pow: 1.2, amp: 0.5, hs: hash(k * 11.3) };
      ribbon(out, pts, t => 0.1 * (1 - 0.6 * t), () => T, () => V(1, 0.2, 0).normalize(), m0, m1, 0.9 + 0.2 * hash(k));
      ribbon(out, pts, t => 0.1 * (1 - 0.6 * t), () => V(1, 0, 0), () => T, m0, m1, 0.9 + 0.2 * hash(k + 50));
    }
    out.curAnchor = null; out.flex = null;
  }
  // 尾巴：原模型尾巴的中心线（从上往下）
  const cl = [];
  { const ys = tailV.map(p => p.y), y0 = Math.min(...ys), y1 = Math.max(...ys);
    for (let y = y1; y >= y0 - 1e-3; y -= 0.15) { const s = tailV.filter(p => Math.abs(p.y - y) < 0.12); if (s.length) cl.push(V(0, y, s.reduce((a, p) => a + p.z, 0) / s.length)); } }
  const t0 = col(L.tail[0]), t1 = col(L.tail[1]);
  const clAt = (u) => { const f = u * (cl.length - 1), i = Math.min(cl.length - 2, Math.floor(f)); return cl[i].clone().lerp(cl[i + 1], f - i); };
  const NT = L.style === 'flow' ? 22 : 8;
  for (let k = 0; k < NT; k++) {
    const a = k / NT * Math.PI * 2 + hash(k) * 0.6, rad = (L.style === 'flow' ? 0.13 : 0.08) * (0.6 + 0.4 * hash(k * 4.4));
    const startU = L.style === 'flow' ? 0.05 * hash(k * 1.3) : 0.62 + 0.1 * hash(k);
    const n = 8, pts = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), u = startU + (1 - startU) * t;
      const c = clAt(Math.min(1, u));
      const spread = rad * (0.3 + 1.2 * Math.sin(Math.PI * Math.min(1, t * 0.8 + 0.1)));
      const p = c.clone().add(V(Math.cos(a) * spread * 0.75, 0, Math.sin(a) * spread - 0.05 * t));
      if (t > 0.85) p.y -= (L.style === 'flow' ? 0.35 : 0.2) * (t - 0.85) / 0.15;   // 比原来的尾巴再长一截
      pts.push(p);
    }
    out.curAnchor = (i, p) => clAt(Math.min(1, startU + (1 - startU) * i / (n - 1)));
    // 尾巴整条绕尾根摆；毛驴只有尾巴尖那一撮毛在甩
    out.flex = { kind: 2, root: clAt(L.style === 'flow' ? 0 : Math.min(1, startU)), pow: L.style === 'flow' ? 1.5 : 1, amp: L.style === 'flow' ? 1 : 0.7, hs: hash(k * 8.7 + 1) };
    const tw = t => (L.style === 'flow' ? 0.12 : 0.08) * (1 - 0.7 * t * t) * (L.style === 'flow' ? 1 : 0.6 + 0.8 * t);
    const ta = V(-Math.sin(a), 0, Math.cos(a)), tn = V(Math.cos(a), 0.1, Math.sin(a)).normalize(), jj = 0.9 + 0.2 * hash(k * 2.9);
    ribbon(out, pts, tw, () => ta, () => tn, t0, t1, jj);
    ribbon(out, pts, t => tw(t) * 0.6, () => tn, () => tn, t0, t1, jj * 0.92);
    out.curAnchor = null; out.flex = null;
  }
  // 马笼头：鼻革一圈、两边颊革到耳后、额带
  {
    const head = [];
    for (const nm of ['Main', 'Main_Dark', 'Main_Light', 'Muzzle']) { const P = parts[nm]; if (!P) continue; for (let i = 0; i < P.pos.count; i++) { v.fromBufferAttribute(P.pos, i); if (v.z > 2.3 * kz && v.y > 3.2 * ky) head.push(v.clone()); } }
    if (head.length > 30) {
      const zMax = Math.max(...head.map(p => p.z));
      const ring = (zc, inflate) => {
        const s = head.filter(p => Math.abs(p.z - zc) < 0.06);
        if (s.length < 6) return null;
        const cx = 0, cy = (Math.max(...s.map(p => p.y)) + Math.min(...s.map(p => p.y))) / 2;
        const pts = [];
        for (let k = 0; k < 14; k++) {
          const a = k / 14 * Math.PI * 2, d = V(Math.cos(a), Math.sin(a), 0);
          // 这个方向上最远的点
          let m = 0; for (const p of s) { const q = (p.x - cx) * d.x + (p.y - cy) * d.y; const off = Math.abs((p.x - cx) * d.y - (p.y - cy) * d.x); if (off < 0.08) m = Math.max(m, q); }
          pts.push(V(cx + d.x * (m + inflate), cy + d.y * (m + inflate), zc));
        }
        return pts;
      };
      const br = col(L.bridle), mt = col(L.metal);
      const nose = ring(zMax - 0.32, 0.035);
      const poll = ridge[ridge.length - 1];
      if (nose) {
        tube(out, nose, 0.03, br, true);
        for (const s of [1, -1]) {
          // 颊革：从鼻革侧面到耳朵后面，中间往外鼓一点免得穿进脸
          const a = nose.reduce((m, p) => (s * p.x > s * m.x ? p : m), nose[0]);
          const b = V(s * 0.2, poll.y - 0.06, poll.z - 0.08);
          const mid = a.clone().lerp(b, 0.5); mid.x = s * (Math.abs(mid.x) + 0.12);
          tube(out, bez(a, mid, b, 6), 0.026, br);
          // 嘴角的小铁环
          const rg = []; for (let k = 0; k < 8; k++) { const an = k / 8 * Math.PI * 2; rg.push(V(a.x + s * 0.02, a.y - 0.05 + Math.sin(an) * 0.05, a.z + Math.cos(an) * 0.05)); }
          tube(out, rg, 0.012, mt, true);
        }
        // 头顶那一段和额带
        tube(out, bez(V(0.2, poll.y - 0.06, poll.z - 0.08), V(0, poll.y + 0.1, poll.z - 0.1), V(-0.2, poll.y - 0.06, poll.z - 0.08), 5), 0.026, br);
        const fz = poll.z + 0.12, fy = poll.y - 0.12;
        tube(out, bez(V(0.24, fy - 0.08, fz), V(0, fy + 0.1, fz + 0.12), V(-0.24, fy - 0.08, fz), 5), 0.022, br);
      }
    }
  }
  // 蒙皮：每个顶点抄“锚点”最近的原模型顶点的骨骼权重
  const src = [];
  for (const nm of Object.keys(parts)) { const P = parts[nm]; for (let i = 0; i < P.pos.count; i += 1) src.push([P.pos.getX(i), P.pos.getY(i), P.pos.getZ(i), P, i]); }
  const n = out.pos.length / 3, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  const cache = new Map();
  for (let i = 0; i < n; i++) {
    const a = out.anchor[i];
    let best = cache.get(a);
    if (best === undefined) {
      let bd = Infinity; best = null;
      for (const s of src) { const dx = s[0] - a.x, dy = s[1] - a.y, dz = s[2] - a.z, d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; best = s; } }
      cache.set(a, best);
    }
    const P = best[3], j = best[4];
    for (let k = 0; k < 4; k++) { si[i * 4 + k] = P.idx.getComponent(j, k); sw[i * 4 + k] = P.w.getComponent(j, k); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(out.nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(out.col, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  g.setAttribute('aRoot', new THREE.Float32BufferAttribute(out.root, 3));
  g.setAttribute('aFlex', new THREE.Float32BufferAttribute(out.flx, 4));
  g.setIndex(out.idx);
  g.computeBoundingSphere();
  return g;
}

// 身上的花色：按顶点位置写顶点色（材质颜色改成白色，颜色全在顶点里）
// ky、kz：这匹的身高、身长和马（素材原尺寸）的比例，所有位置阈值都按马量好再换算
function coatColors(geo, matName, L, ky, kz) {
  const P = geo.attributes.position, N = geo.attributes.normal, n = P.count, a = new Float32Array(n * 3);
  const base = col(L.coat), white = col('#f3eee6'), dark = base.clone().multiplyScalar(L.lowLeg), c = new THREE.Color();
  const muz = col(L.muzzle), hoof = col(L.hooves);
  for (let i = 0; i < n; i++) {
    const x = P.getX(i), y = P.getY(i) / ky, z = P.getZ(i) / kz, ny = N.getY(i), nz = N.getZ(i);
    if (matName === 'Hooves') c.copy(hoof);
    else if (matName === 'Muzzle') c.copy(muz);
    else {
      c.copy(base);
      if (matName === 'Main_Dark') c.multiplyScalar(0.72);
      if (matName === 'Main_Light') c.lerp(white, L.lightPart ?? 0.3);
      // 背上深一点、肚子底下浅一点
      c.multiplyScalar(1 + (L.top - 1) * sstep(2.9, 3.6, y) * (z < 2.0 ? 1 : 0));
      c.multiplyScalar(1 + (L.belly - 1) * sstep(-0.1, -0.6, ny) * sstep(1.4, 2.2, y));
      // 腿下半截
      const leg = sstep(1.5, 0.9, y);
      c.lerp(dark, leg * 0.8);
      // 白袜子：四条腿 [左前, 右前, 左后, 右后]
      const li = (z > 0 ? 0 : 2) + (x > 0 ? 0 : 1);
      const sockTop = 0.75 + 0.18 * Math.sin(x * 23 + z * 17) * 0.5 + (z > 0 ? 0.05 : 0.15);
      if (L.socks[li]) c.lerp(white, sstep(sockTop + 0.06, sockTop - 0.06, y));
      // 白鼻梁：脸正中一道
      if (L.blaze && z > 2.55) {
        const w = 0.06 + 0.05 * sstep(3.4, 4.3, y);
        c.lerp(white, sstep(w + 0.03, w - 0.01, Math.abs(x)) * sstep(0.0, 0.35, nz + ny * 0.3) * sstep(3.55, 3.75, y));
      }
      // 灰斑（云朵）：屁股和肩膀上一圈圈的淡灰
      if (L.dapple) {
        const d = Math.sin(x * 9.1 + y * 3.7) * Math.sin(y * 8.3 - z * 7.1) * Math.sin(z * 6.7 + x * 5.3);
        c.multiplyScalar(1 - 0.12 * sstep(0.15, 0.4, d) * sstep(1.6, 2.6, y) * sstep(3.8, 3.0, y));
      }
      // 毛驴背上的深色十字
      if (L.cross) {
        const dark2 = col('#4a403a');
        c.lerp(dark2, sstep(0.12, 0.05, Math.abs(x)) * sstep(3.0, 3.35, y) * (z > -1.7 && z < 1.3 ? 1 : 0) * 0.85);
        c.lerp(dark2, sstep(0.09, 0.03, Math.abs(z - 0.95)) * sstep(2.6, 3.2, y) * 0.75);
      }
    }
    a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b;
  }
  const g = geo.clone();
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

// 对外：给一匹（已克隆好的）马换花色、加鬃毛尾巴笼头。gltf.groomCache 按坐骑种类缓存几何体
export function groomHorse(gltf, model, key) {
  const L = LOOKS[key]; if (!L) return null;
  gltf.groomCache = gltf.groomCache || new Map();
  let C = gltf.groomCache.get(key);
  const parts = collect(model);
  if (!parts.Hair || !parts.Main) return null;
  const ky = parts.Main.bb.max.y / 4.81, kz = parts.Main.bb.max.z / 3.37;
  if (!C) {
    C = { groom: buildGroom(parts, L, ky, kz), coat: new Map() };
    gltf.groomCache.set(key, C);
  }
  // 身上换顶点色
  for (const [nm, P] of Object.entries(parts)) {
    if (/Eye/.test(nm)) continue;
    const o = P.mesh;
    // 原来的鬃毛尾巴：长毛的马用新做的代替（藏起来，少画一次）；毛驴留着当尾巴杆
    if (nm === 'Hair') { if (L.style === 'flow') o.visible = false; else o.material.color.copy(col(L.mane[0])); continue; }
    let g = C.coat.get(nm);
    if (!g) { g = coatColors(o.geometry, P.name.replace(/2$/, ''), L, ky, kz); C.coat.set(nm, g); }
    o.geometry = g;
    o.material.vertexColors = true; o.material.color.set(1, 1, 1);
    o.material.emissive.copy(col(L.coat)).multiplyScalar(key === 'w' ? 0.04 : 0.07);   // 逆光时不至于全黑
    o.material.needsUpdate = true;
  }
  // 毛和皮带
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, side: THREE.DoubleSide, name: 'groom' });
  // 甩动：鬃毛、尾巴各两个“慢半拍”的小球（一个轻快、一个沉一点），每绺毛按自己的随机数在两个之间取；
  // 在绑定姿势里把毛绕毛根摆过去（长度不变），再走原来的骨骼蒙皮
  const sw = { uSwM: { value: [new THREE.Vector3(), new THREE.Vector3()] }, uSwT: { value: [new THREE.Vector3(), new THREE.Vector3()] }, uFlut: { value: 0 } };
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
      attribute vec3 aRoot; attribute vec4 aFlex; uniform vec3 uSwM[ 2 ]; uniform vec3 uSwT[ 2 ]; uniform float uFlut;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      if ( aFlex.x > 0.0 ) {
        vec3 jS = aFlex.y < 1.5 ? mix( uSwM[ 0 ], uSwM[ 1 ], aFlex.z ) : mix( uSwT[ 0 ], uSwT[ 1 ], aFlex.z );
        vec3 jRel = transformed - aRoot; float jLen = length( jRel );
        // 顺着毛往梢上走的小波浪：有风、跑得快的时候才明显
        float jW = sin( uTime * ( 5.5 + 4.0 * aFlex.z ) - aFlex.w * 4.5 + aFlex.z * 50.0 );
        vec3 jD = ( jS + vec3( jW * 0.11, 0.0, jW * 0.05 ) * uFlut ) * aFlex.x;
        float jDL = length( jD ), jMx = 0.9 * jLen;
        if ( jDL > jMx ) jD *= jMx / jDL;
        if ( jLen > 1e-4 ) transformed = aRoot + normalize( jRel + jD ) * jLen;
      }`);
  };
  patch(mat, { rim: 0.5, gobo: true, fog: true, grassN: 0.0, sss: 0.1, uniforms: sw });
  const mesh = new THREE.SkinnedMesh(C.groom, mat);
  mesh.name = 'groom'; mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  const ref = parts.Main.mesh;
  ref.parent.add(mesh);
  mesh.position.copy(ref.position); mesh.quaternion.copy(ref.quaternion); mesh.scale.copy(ref.scale);
  mesh.bind(ref.skeleton, ref.bindMatrix);
  // 每帧（动画算完之后）：脖子、尾巴根现在在哪 → 小球落后多少 → 转回模型自己的坐标交给着色器
  const bone = n => ref.skeleton.bones.find(b => b.name === n);
  const neck = bone('Neck2') || bone('Neck1'), tail = bone('Tail2') || bone('Tail1');
  const lags = { m: [new Lag({ freq: 2.3, zeta: 0.26, drag: 0.03, max: 0.3 }), new Lag({ freq: 1.35, zeta: 0.4, drag: 0.046, max: 0.36 })],
    t: [new Lag({ freq: 1.9, zeta: 0.28, drag: 0.034, max: 0.34 }), new Lag({ freq: 1.15, zeta: 0.42, drag: 0.05, max: 0.4 })] };
  const stiff = L.style === 'flow' ? 1 : 0.6;
  mesh.userData.sway = (dt, speed = 0, gain = 1) => {
    if (!neck || !tail) return;
    _m3.setFromMatrix4(mesh.matrixWorld).invert();
    neck.getWorldPosition(_p); for (let i = 0; i < 2; i++) sw.uSwM.value[i].copy(lags.m[i].update(dt, _p)).applyMatrix3(_m3).multiplyScalar(gain * stiff);
    tail.getWorldPosition(_p); for (let i = 0; i < 2; i++) sw.uSwT.value[i].copy(lags.t[i].update(dt, _p)).applyMatrix3(_m3).multiplyScalar(gain * stiff);
    sw.uFlut.value = gain * Math.min(1.5, 0.3 * U.uWind.value + speed / 5);
  };
  return mesh;
}
const _m3 = new THREE.Matrix3(), _p = new THREE.Vector3();

// 圆角的盒子（鞍袋、背包）：盒子顶点往球面靠一半
export function roundBox(w, h, d) {
  const g = new THREE.BoxGeometry(1, 1, 1, 4, 4, 4), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const s = v.clone().normalize().multiplyScalar(0.62); v.lerp(s, 0.45); p.setXYZ(i, v.x * w * 1.25, v.y * h * 1.25, v.z * d * 1.25); }
  g.computeVertexNormals(); return g;
}
