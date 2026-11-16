// 竹子：一丛六七根，七到十一米高，越往上越细、梢头被叶子压得弯下来；上半截挂着一簇簇细长的竹叶。
// 几何和贴图都在这里现做（不用下载），做成和别的树一样的“模型”（parts: 竹竿 bcane + 竹叶 bleaf），
// 近处用实例层画，远处一样进替身图集。
import * as THREE from 'three';
import { rng } from './noise.js';

// 竹竿贴图：一节一节（贴图纵向一圈是一节），节上一道浅色的环和一道暗线，竿上有细细的竖纹，有的发黄
function caneTexture() {
  const W = 64, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#7fa04a'); grd.addColorStop(0.5, '#93b257'); grd.addColorStop(1, '#6e9440');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  const R = rng(41);
  for (let i = 0; i < 70; i++) {
    const x = R() * W, a = 0.05 + R() * 0.08;
    g.fillStyle = R() < 0.5 ? `rgba(40,70,20,${a})` : `rgba(220,230,160,${a})`;
    g.fillRect(x, 0, 1 + R() * 2, H);
  }
  // 节：上面一道亮环（带白粉），下面一道暗线
  g.fillStyle = 'rgba(232,236,196,0.75)'; g.fillRect(0, 4, W, 7);
  g.fillStyle = 'rgba(50,62,26,0.85)'; g.fillRect(0, 10, W, 3);
  g.fillStyle = 'rgba(70,90,36,0.35)'; g.fillRect(0, 13, W, 10);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
// 竹叶贴图：一根细枝上挂着七八片窄长的叶子，往下垂
function leafTexture() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const R = rng(77);
  const leaf = (x, y, ang, len, w, col) => {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.beginPath(); g.moveTo(0, 0);
    g.quadraticCurveTo(len * 0.35, -w, len, 0); g.quadraticCurveTo(len * 0.35, w * 0.9, 0, 0);
    g.fillStyle = col; g.fill();
    g.strokeStyle = 'rgba(40,70,20,0.45)'; g.lineWidth = 1; g.beginPath(); g.moveTo(2, 0); g.lineTo(len * 0.92, 0); g.stroke();
    g.restore();
  };
  // 四根小枝，从左边（挂在竹竿上那头）往右下垂
  for (let b = 0; b < 4; b++) {
    const y0 = 36 + b * 56 + R() * 16;
    g.strokeStyle = '#5b6e32'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, y0); g.quadraticCurveTo(S * 0.5, y0 - 10, S * 0.95, y0 + 26); g.stroke();
    for (let i = 0; i < 11; i++) {
      const t = 0.1 + i * 0.08, x = t * S * 0.95, y = y0 - 10 * Math.sin(t * Math.PI) + 26 * t * t;
      const side = i % 2 ? 1 : -1, ang = side * (0.5 + R() * 0.5) + 0.4;
      const v = R();
      const col = v < 0.25 ? '#6fa23e' : v < 0.6 ? '#82b54a' : v < 0.88 ? '#96c456' : '#b4cf66';
      leaf(x, y, ang, 58 + R() * 30, 9 + R() * 4, col);
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// 一丛竹子的几何
function clumpGeometry(seed) {
  const R = rng(seed);
  const cane = { pos: [], nor: [], uv: [], idx: [] }, leaf = { pos: [], nor: [], uv: [], idx: [] };
  const n = 8 + Math.floor(R() * 3), SIDES = 5, SEG = 8, NODE = 0.34;
  for (let k = 0; k < n; k++) {
    const a0 = R() * Math.PI * 2, r0 = 0.15 + Math.sqrt(R()) * 0.6;
    const bx = Math.cos(a0) * r0, bz = Math.sin(a0) * r0;
    const H = 7 + R() * 4, rad = 0.04 + R() * 0.025;
    const lean = 0.05 + R() * 0.1, bend = 0.8 + R() * 1.0;
    const dx = Math.cos(a0 + (R() - 0.5) * 0.8), dz = Math.sin(a0 + (R() - 0.5) * 0.8);
    // 竿子中心线：往外斜，梢头往下弯
    const at = y => { const u = y / H; const off = lean * y + bend * u * u * u; return [bx + dx * off, y * (1 - 0.05 * u * u), bz + dz * off]; };
    const base = cane.pos.length / 3;
    for (let j = 0; j <= SEG; j++) {
      const y = H * (j / SEG), [cx, cy, cz] = at(y), r = rad * (1 - 0.7 * (j / SEG));
      for (let i = 0; i <= SIDES; i++) {
        const a = (i / SIDES) * Math.PI * 2, nx = Math.cos(a), nz = Math.sin(a);
        cane.pos.push(cx + nx * r, cy, cz + nz * r); cane.nor.push(nx, 0.08, nz); cane.uv.push(i / SIDES, y / NODE);
      }
    }
    for (let j = 0; j < SEG; j++) for (let i = 0; i < SIDES; i++) {
      const a = base + j * (SIDES + 1) + i, b = a + SIDES + 1;
      cane.idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    // 叶子：上半截的几个高度，各挂一片（往外伸、往下垂）
    const nL = 10 + Math.floor(R() * 4);
    for (let m = 0; m < nL; m++) {
      const y = H * (0.38 + 0.6 * Math.pow(m / (nL - 1), 0.8)), [cx, cy, cz] = at(y);
      const ang = a0 + (R() - 0.5) * 3.2 + (m % 2 ? 1.6 : -1.2);
      const ux = Math.cos(ang), uz = Math.sin(ang);
      const L = 1.4 + R() * 0.7, Wd = 0.9 + R() * 0.35, droop = 0.3 + R() * 0.35;
      // 叶片平面：沿 u 往外，宽度方向竖着偏一点（看起来是一簇，不是一张纸）
      const vx = -uz, vz = ux, tilt = 0.55 + R() * 0.3;
      const p0 = [cx, cy + Wd * 0.25, cz], p1 = [cx + ux * L, cy - droop * L + Wd * 0.25, cz + uz * L];
      const w = [vx * Wd * (1 - tilt) * 0.5, -Wd * tilt * 0.5, vz * Wd * (1 - tilt) * 0.5];
      const bL = leaf.pos.length / 3;
      leaf.pos.push(p0[0] - w[0], p0[1] - w[1], p0[2] - w[2], p0[0] + w[0], p0[1] + w[1], p0[2] + w[2], p1[0] + w[0], p1[1] + w[1], p1[2] + w[2], p1[0] - w[0], p1[1] - w[1], p1[2] - w[2]);
      // 法线：朝上偏外（打光像一团叶子）
      for (let q = 0; q < 4; q++) leaf.nor.push(ux * 0.45, 0.85, uz * 0.45);
      const flip = R() < 0.5;
      leaf.uv.push(0, flip ? 1 : 0, 0, flip ? 0 : 1, 1, flip ? 0 : 1, 1, flip ? 1 : 0);
      leaf.idx.push(bL, bL + 1, bL + 2, bL, bL + 2, bL + 3);
    }
  }
  const mk = o => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(o.pos, 3));
    const N = new THREE.Float32BufferAttribute(o.nor, 3); g.setAttribute('normal', N);
    for (let i = 0; i < N.count; i++) { const x = N.getX(i), y = N.getY(i), z = N.getZ(i), l = Math.hypot(x, y, z) || 1; N.setXYZ(i, x / l, y / l, z / l); }
    g.setAttribute('uv', new THREE.Float32BufferAttribute(o.uv, 2));
    g.setIndex(o.idx); g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  };
  return { cane: mk(cane), leaf: mk(leaf) };
}

// 返回一个和打包好的树一样的模型 { parts, min, max }
export function makeBambooModel() {
  const { cane, leaf } = clumpGeometry(2024);
  const bb = new THREE.Box3().copy(cane.boundingBox).union(leaf.boundingBox);
  return { parts: [{ mat: 'bcane', geo: cane }, { mat: 'bleaf', geo: leaf }], min: bb.min.toArray(), max: bb.max.toArray() };
}
export function bambooTextures() { return { cane: caneTexture(), leaf: leafTexture() }; }
