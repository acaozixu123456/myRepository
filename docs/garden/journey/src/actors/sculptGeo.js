// 用代码“捏”出来的人（旅人和路上偶遇的人）：只管算形状，不碰画面，所以可以放到后台线程里算（sculpt.worker.js）。
// 身体、衣服是一堆圆润的基本形状拼起来再提取成网格，帽子、眼睛、围巾尾巴、扣子另外拼上去；一张贴图都不用，颜色全在顶点上。
// 做法上的两个要点：
// 1. 形状按 T 字站姿写（左右对称，好写数字），提取网格前先把手臂放下来（A 字站姿），
//    这样肩膀、腋下在平时最常见的姿势里是“捏”出来的，不是被骨骼硬拉出来的。
// 2. 每件衣服是单独一层（皮肤、裤子、靴子、外套、腰带、围巾、头发），层和层之间是硬边，层里面是圆润过渡。
import * as THREE from 'three';
import { Field, ellipsoid, roundCone, surfaceNets, relax } from '../horse/sdf.js';
import { Builder, tube, vnoise } from '../horse/horseB.js';

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const col = h => new THREE.Color(h);
const ARM_DOWN = 62 * Math.PI / 180;      // 手臂从水平放下来多少

// 两套造型：m 短发、蓝外套红围巾；f 齐耳短发扎一小撮、紫外套黄围巾。衣服的样子一样，颜色和发型不同
const BASE = {
  skin: '#f1c7a2', blush: '#ea9682', hair: '#4b2f1f', hairHi: '#80573a',
  hat: '#dbb66b', hatUnder: '#9c7a3f', band: '#8f3324', feather: '#f3ead2',
  scarf: '#bd3a29', scarfStripe: '#f1e3c0',
  coat: '#3d6788', coatTrim: '#ecdcae', seam: '#2b4a66',
  belt: '#573420', brass: '#dcb65a',
  pants: '#b3a17c', boot: '#6f4529', cuff: '#8d5e39', sole: '#33251d',
  eye: '#24150f', mouth: '#8f3a33',
};
export const LOOKS = {
  m: { ...BASE, hairStyle: 'short', hair: '#3f2a1d', hairHi: '#6f4c33' },
  f: { ...BASE, hairStyle: 'bob', hair: '#5a3220', hairHi: '#96603a', coat: '#6f4d8c', seam: '#49305f', scarf: '#d9a02e', scarfStripe: '#fbf0cf', band: '#6f4d8c', feather: '#f6efdc' },
};

// ---------------- 形状的小包装 ----------------
// 沿各轴压扁（s 里大于 1 的方向变薄），c 是不动的中心
function squash(shape, s, c) {
  const b = shape.box, m = Math.max(s[0], s[1], s[2]);
  const f = (v, i) => c[i] + (v - c[i]) / s[i];
  return {
    box: [f(b[0], 0), f(b[1], 1), f(b[2], 2), f(b[3], 0), f(b[4], 1), f(b[5], 2)],
    t: (x, y, z) => shape.t(c[0] + (x - c[0]) * s[0], c[1] + (y - c[1]) * s[1], c[2] + (z - c[2]) * s[2]),
    dist: (x, y, z) => shape.dist(c[0] + (x - c[0]) * s[0], c[1] + (y - c[1]) * s[1], c[2] + (z - c[2]) * s[2]) / m,
  };
}
// 整个形状跟着一个刚体变换走（手臂放下来用）
function posed(shape, M) {
  const e = M.clone().invert().elements, b = shape.box, v = new THREE.Vector3();
  const box = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
  for (let i = 0; i < 8; i++) {
    v.set(b[i & 1 ? 3 : 0], b[i & 2 ? 4 : 1], b[i & 4 ? 5 : 2]).applyMatrix4(M);
    box[0] = Math.min(box[0], v.x); box[1] = Math.min(box[1], v.y); box[2] = Math.min(box[2], v.z);
    box[3] = Math.max(box[3], v.x); box[4] = Math.max(box[4], v.y); box[5] = Math.max(box[5], v.z);
  }
  return {
    box,
    t: (x, y, z) => shape.t(e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]),
    dist: (x, y, z) => shape.dist(e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]),
  };
}
const BIG = [-9, -9, -9, 9, 9, 9];
const below = y0 => ({ box: BIG, t: () => 0, dist: (x, y) => y - y0 });     // 当“雕刻”用：削掉 y0 以下
const above = y0 => ({ box: BIG, t: () => 0, dist: (x, y) => y0 - y });     // 削掉 y0 以上

// 几层叠在一起：层内圆润过渡，层与层之间取最近的那层（硬边）
class Layers {
  constructor(groups, margin = 0.05) {
    this.groups = groups;
    this.fields = groups.map(g => new Field(g.prims, g.carves || [], margin));
    this.prims = []; this.base = [];
    groups.forEach((g, gi) => { this.base.push(this.prims.length); for (const p of g.prims) { p.group = gi; this.prims.push(p); } });
    this.win = 0; this._t = [];
  }
  // out：把参与的形状和距离写进去（形状序号 → 距离）。被削掉的部分按整层的距离算，不然削掉的那截还会抢蒙皮权重
  eval(x, y, z, out = null) {
    let d = 1e9, win = 0;
    for (let g = 0; g < this.fields.length; g++) {
      let di;
      if (out) {
        const t = this._t; t.length = 0;
        di = this.fields[g].eval(x, y, z, t);
        const b = this.base[g];
        for (let k = 0; k < t.length; k += 2) out.push(b + t[k], Math.max(t[k + 1], di));
      } else di = this.fields[g].eval(x, y, z);
      if (di < d) { d = di; win = g; }
    }
    this.win = win;
    return d;
  }
  normal(x, y, z, e = 0.004) {
    const nx = this.eval(x + e, y, z) - this.eval(x - e, y, z);
    const ny = this.eval(x, y + e, z) - this.eval(x, y - e, z);
    const nz = this.eval(x, y, z + e) - this.eval(x, y, z - e);
    const l = Math.hypot(nx, ny, nz) || 1;
    return [nx / l, ny / l, nz / l];
  }
  // 缝隙、腋下、帽檐下、衣摆下更暗
  ao(x, y, z, n) {
    let occ = 0, w = 1;
    for (const h of [0.02, 0.045, 0.08, 0.14]) {
      const d = this.eval(x + n[0] * h, y + n[1] * h, z + n[2] * h);
      occ += w * Math.max(0, h - d) / h;
      w *= 0.7;
    }
    return Math.min(1, Math.max(0, 1 - occ * 0.55));
  }
  // 从里面一点沿方向找到表面
  ray(o, dir, maxT = 0.4) {
    if (this.eval(o[0], o[1], o[2]) > 0) return null;
    let a = 0, b = maxT;
    for (let i = 0; i < 26; i++) { const m = (a + b) / 2; if (this.eval(o[0] + dir[0] * m, o[1] + dir[1] * m, o[2] + dir[2] * m) < 0) a = m; else b = m; }
    const t = (a + b) / 2;
    return [o[0] + dir[0] * t, o[1] + dir[1] * t, o[2] + dir[2] * t];
  }
  // 把一个点推到离表面 off 远的外面
  hug(p, off) {
    let q = p;
    for (let i = 0; i < 4; i++) {
      const d = this.eval(q[0], q[1], q[2]);
      if (d >= off - 1e-4) break;
      const n = this.normal(q[0], q[1], q[2]);
      q = [q[0] + n[0] * (off - d), q[1] + n[1] * (off - d), q[2] + n[2] * (off - d)];
    }
    return q;
  }
}

// ---------------- 身体和衣服的形状（T 字站姿，面朝 +Z，左手在 +X，脚底 y = 0，身高约 1.85 米含头顶） ----------------
const E = (c, r, bone, o = {}) => ({ shape: ellipsoid(c, r, o.rot || null), bone, k: o.k ?? 0.04, region: o.region || '' });
const C = (a, b, ra, rb, bone, o = {}) => ({ shape: roundCone(a, b, ra, rb), bone, k: o.k ?? 0.04, region: o.region || '' });
const L = s => (s > 0 ? 'l' : 'r');

function layers(arm, P) {
  const style = P.hairStyle;
  const A = (p, s) => ({ ...p, shape: arm(p.shape, s) });
  // 左右成对的形状记下是哪一侧：算蒙皮权重时不让左腿的形状拉到右腿的点
  const both = f => [1, -1].map(s => ({ ...f(s), side: s }));
  // 衣摆：上半截跟盆骨，越往下越跟各自那条大腿（迈步、坐下、骑马时衣摆搭在腿上）
  const skirtW = (x, y) => { const u = 0.92 * sstep(1.0, 0.86, y), l = sstep(-0.05, 0.05, x); return { pelvis: 1 - u, thigh_l: u * l, thigh_r: u * (1 - l) }; };
  const skirt = grow => squash(roundCone([0, 1.05, -0.03], [0, 0.74, -0.034], 0.155 + grow, 0.196 + grow), [1, 1, 1.45], [0, 0, -0.032]);
  const boot = s => [
    C([0.091 * s, 0.4, -0.047], [0.091 * s, 0.13, -0.082], 0.076, 0.06, 'calf_' + L(s), { k: 0 }),      // 靴筒
    E([0.091 * s, 0.41, -0.047], [0.084, 0.028, 0.086], 'calf_' + L(s), { k: 0.008, region: 'cuff' }),   // 翻出来的靴口
    E([0.091 * s, 0.075, -0.08], [0.058, 0.072, 0.066], 'foot_' + L(s), { k: 0.03 }),                   // 脚跟
    C([0.091 * s, 0.052, -0.06], [0.091 * s, 0.046, 0.07], 0.053, 0.048, 'foot_' + L(s), { k: 0.03 }),
    E([0.091 * s, 0.043, 0.105], [0.055, 0.043, 0.072], 'ball_' + L(s), { k: 0.03 }),                   // 圆头靴尖
  ].map(p => ({ ...p, side: s }));
  return [
    { name: 'skin', prims: [
      E([0, 1.715, 0.004], [0.121, 0.133, 0.127], 'Head'),                                   // 头（比真人大两成，显得亲切）
      E([0, 1.655, 0.03], [0.1, 0.085, 0.1], 'Head', { k: 0.05 }),                           // 脸蛋和下巴
      E([0, 1.69, 0.128], [0.015, 0.016, 0.02], 'Head', { k: 0.022 }),                       // 鼻尖
      C([0, 1.47, -0.035], [0, 1.62, -0.012], 0.05, 0.048, 'neck_01', { k: 0.02 }),
      ...(style === 'short' ? both(s => E([0.12 * s, 1.678, 0.002], [0.017, 0.03, 0.022], 'Head', { k: 0.012 })) : []),   // 短发露出耳朵
      ...both(s => A(E([0.744 * s, 1.452, -0.063], [0.058, 0.024, 0.048], 'hand_' + L(s), { k: 0 }), s)),        // 手掌
      ...both(s => A(E([0.828 * s, 1.449, -0.066], [0.054, 0.02, 0.044], 'middle_01_' + L(s), { k: 0.015 }), s)),  // 四指并成一片
      ...both(s => A(C([0.711 * s, 1.434, -0.036], [0.776 * s, 1.386, 0.002], 0.019, 0.015, 'thumb_02_' + L(s), { k: 0.012 }), s)),
    ] },
    { name: 'legs', prims: [
      // 大腿从衣摆里面开始（胯和大腿根藏在外套里，不用捏，也就不会从衣摆里顶出来）
      ...both(s => C([0.091 * s, 0.88, -0.036], [0.091 * s, 0.56, -0.034], 0.084, 0.076, 'thigh_' + L(s), { k: 0 })),
      ...both(s => C([0.091 * s, 0.545, -0.036], [0.091 * s, 0.37, -0.046], 0.076, 0.056, 'calf_' + L(s), { k: 0.03 })),
    ] },
    { name: 'bootL', paint: 'boots', carves: [{ shape: below(0), k: 0.006 }], prims: boot(1) },
    { name: 'bootR', paint: 'boots', carves: [{ shape: below(0), k: 0.006 }], prims: boot(-1) },
    { name: 'coat', carves: [{ shape: below(0.778), k: 0.004 }], prims: [
      E([0, 1.335, -0.012], [0.17, 0.15, 0.115], 'spine_03'),                                // 胸
      E([0, 1.165, -0.008], [0.148, 0.14, 0.105], 'spine_02', { k: 0.07 }),                  // 腰
      E([0, 1.06, -0.012], [0.152, 0.08, 0.108], 'spine_01', { k: 0.05 }),
      C([-0.14, 1.445, -0.055], [0.14, 1.445, -0.055], 0.06, 0.06, 'spine_03', { k: 0.06 }),   // 肩
      { shape: skirt(0), bone: skirtW, k: 0.04, region: '' },                                // 往下散开的衣摆
      ...both(s => E([0.19 * s, 1.452, -0.062], [0.064, 0.062, 0.066], 'upperarm_' + L(s), { k: 0.04 })),               // 肩头
      ...both(s => A(C([0.2 * s, 1.455, -0.065], [0.443 * s, 1.455, -0.073], 0.055, 0.05, 'upperarm_' + L(s), { k: 0.03 }), s)),
      ...both(s => A(C([0.443 * s, 1.455, -0.073], [0.622 * s, 1.455, -0.067], 0.05, 0.055, 'lowerarm_' + L(s), { k: 0.03 }), s)),
    ] },
    // 衣摆、袖口各一圈浅色边（单独一层，边界才干净）
    { name: 'hem', paint: 'trim', carves: [{ shape: below(0.772), k: 0.003 }, { shape: above(0.822), k: 0.003 }], prims: [{ shape: skirt(0.007), bone: skirtW, k: 0, region: '' }] },
    { name: 'cuffs', paint: 'trim', prims: both(s => A(E([0.648 * s, 1.455, -0.067], [0.02, 0.062, 0.062], 'lowerarm_' + L(s), { k: 0 }), s)) },
    { name: 'belt', carves: [{ shape: below(1.02), k: 0.004 }, { shape: above(1.074), k: 0.004 }], prims: [
      E([0, 1.047, -0.022], [0.175, 0.2, 0.13], 'spine_01'),
    ] },
    { name: 'scarf', prims: [
      E([0, 1.502, -0.016], [0.114, 0.05, 0.1], 'spine_03'),                                 // 围在脖子上的一圈
      E([0, 1.535, -0.012], [0.085, 0.035, 0.08], 'neck_01', { k: 0.03 }),
      E([0.05, 1.468, 0.078], [0.044, 0.04, 0.034], 'spine_03', { k: 0.02 }),                // 前面的结
      E([0, 1.515, -0.09], [0.07, 0.045, 0.04], 'spine_03', { k: 0.03 }),                    // 后颈堆起来的一团
    ] },
    { name: 'hair', prims: (style === 'short' ? [
      E([0, 1.716, -0.02], [0.131, 0.131, 0.125], 'Head'),                                   // 后脑勺、头顶
      ...both(s => E([0.106 * s, 1.722, -0.012], [0.032, 0.05, 0.07], 'Head', { k: 0.025 })),   // 两侧只到耳朵上沿
      E([0, 1.65, -0.088], [0.088, 0.062, 0.045], 'Head', { k: 0.035 }),                     // 后颈
      E([-0.03, 1.792, 0.092], [0.085, 0.03, 0.04], 'Head', { k: 0.03 }),                    // 刘海往另一边偏
    ] : [
      E([0, 1.71, -0.022], [0.132, 0.131, 0.124], 'Head'),                                   // 后脑勺、头顶
      ...both(s => E([0.1 * s, 1.672, -0.004], [0.041, 0.078, 0.074], 'Head', { k: 0.03 })), // 两侧垂到耳下，盖住耳朵
      ...(P.hatStyle === 'beanie' ? [] : [E([0.025, 1.79, 0.094], [0.09, 0.03, 0.04], 'Head', { k: 0.03 })]),   // 刘海（戴毛线帽时塞在帽子里）
      C([0, 1.63, -0.125], [0, 1.555, -0.15], 0.042, 0.022, 'Head', { k: 0.035 }),           // 脑后扎起来的一小撮
    ]).concat(P.hatStyle === 'none' ? [E([0, 1.795, 0.015], [0.115, 0.07, 0.095], 'Head', { k: 0.03 })] : [])      // 不戴帽子：头顶补满
      .concat(P.beard ? [E([0, 1.604, 0.076], [0.064, 0.042, 0.055], 'Head', { k: 0.02 })] : []) },   // 下巴上一撮胡子
  ];
}

// ---------------- 另外拼上去的小零件 ----------------
// 椭球（眼睛、扣子、带扣）
function blob(B, c, r, color, w, { seg = 10, glow = 0, q = null } = {}) {
  const base = B.count, v = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    const th = i / seg * Math.PI;
    for (let j = 0; j <= seg * 2; j++) {
      const ph = j / (seg * 2) * Math.PI * 2;
      const ux = Math.sin(th) * Math.cos(ph), uy = Math.cos(th), uz = Math.sin(th) * Math.sin(ph);
      v.set(ux * r[0], uy * r[1], uz * r[2]); n.set(ux / r[0], uy / r[1], uz / r[2]).normalize();
      if (q) { v.applyQuaternion(q); n.applyQuaternion(q); }
      B.vert([c[0] + v.x, c[1] + v.y, c[2] + v.z], [n.x, n.y, n.z], color, w, glow);
    }
  }
  const row = seg * 2 + 1;
  for (let i = 0; i < seg; i++) for (let j = 0; j < seg * 2; j++) {
    const a = base + i * row + j, b = a + 1, c2 = a + row, d = c2 + 1;
    B.idx.push(a, b, c2, b, d, c2);
  }
}

// 宽檐帽：一条剖面线转一圈。帽檐前后往下耷拉一点、两侧微微翘起，整顶帽子往后仰一点（露出脸）
// 别的样式（路上偶遇的人戴的）：cone 斗笠、beret 软塌塌的画家帽、beanie 毛线帽（翻边是帽带的颜色）
const HATS = {
  straw: [
    [0.085, -0.006, 'under'], [0.17, -0.006, 'under'], [0.238, -0.004, 'under'], [0.247, 0.002, 'edge'], [0.238, 0.008, 'brim'],
    [0.17, 0.012, 'brim'], [0.129, 0.016, 'brim'], [0.12, 0.026, 'band'], [0.117, 0.058, 'band'], [0.1165, 0.061, 'crown'],
    [0.112, 0.095, 'crown'], [0.1, 0.122, 'crown'], [0.075, 0.14, 'crown'], [0.04, 0.149, 'crown'], [0, 0.152, 'crown'],
  ],
  cone: [
    [0.06, 0.03, 'under'], [0.16, -0.012, 'under'], [0.27, -0.058, 'under'], [0.284, -0.06, 'edge'], [0.276, -0.05, 'crown'],
    [0.2, -0.008, 'crown'], [0.12, 0.04, 'crown'], [0.055, 0.082, 'crown'], [0.02, 0.104, 'crown'], [0, 0.11, 'crown'],
  ],
  beret: [
    [0.09, -0.012, 'under'], [0.121, -0.016, 'band'], [0.126, 0.004, 'band'], [0.15, 0.016, 'crown'], [0.168, 0.04, 'crown'],
    [0.16, 0.064, 'crown'], [0.12, 0.084, 'crown'], [0.06, 0.094, 'crown'], [0, 0.096, 'crown'],
  ],
  beanie: [
    [0.11, -0.034, 'under'], [0.133, -0.036, 'band'], [0.137, -0.012, 'band'], [0.133, 0.012, 'band'], [0.127, 0.016, 'crown'],
    [0.122, 0.045, 'crown'], [0.106, 0.078, 'crown'], [0.076, 0.102, 'crown'], [0.038, 0.114, 'crown'], [0, 0.117, 'crown'],
  ],
};
function hat(B, P, M, w) {
  const straw = col(P.hat), under = col(P.hatUnder), band = col(P.band);
  const style = HATS[P.hatStyle] ? P.hatStyle : 'straw', prof = HATS[style], wavy = style === 'straw' ? 1 : 0;
  const nt = 44, base = B.count, grid = [];
  for (let i = 0; i < prof.length; i++) {
    const row = [];
    for (let j = 0; j <= nt; j++) {
      const th = j / nt * Math.PI * 2, [r0, y0] = prof[i];
      const f = wavy * sstep(0.129, 0.2, r0), c2 = Math.cos(2 * th);
      const r = r0 * (1 + 0.04 * f * c2);
      const y = y0 + f * (r0 - 0.129) * (-0.1 + 0.22 * c2) + f * 0.006 * Math.sin(3 * th + 1);
      row.push(new THREE.Vector3(r * Math.cos(th), y, r * Math.sin(th)).applyMatrix4(M));
    }
    grid.push(row);
  }
  const up = new THREE.Vector3(0, 1, 0).transformDirection(M), a = new THREE.Vector3(), b = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < prof.length; i++) for (let j = 0; j <= nt; j++) {
    a.subVectors(grid[Math.min(prof.length - 1, i + 1)][j], grid[Math.max(0, i - 1)][j]);
    b.subVectors(grid[i][(j + 1) % nt], grid[i][(j - 1 + nt) % nt]);
    n.crossVectors(a, b); if (n.lengthSq() < 1e-12) n.copy(up); n.normalize();
    const kind = prof[i][2], p = grid[i][j];
    const c = (kind === 'under' ? under : kind === 'band' ? band : straw).clone();
    // 草编的感觉：一圈圈深浅不同，帽顶和帽檐相接的地方暗一点
    const nv = vnoise(p.x * 30, p.y * 30, p.z * 30);
    if (kind !== 'band') c.multiplyScalar(0.9 + 0.14 * nv);
    if (style === 'cone') c.multiplyScalar(0.86 + 0.14 * Math.sin(prof[i][0] * 150) + (kind === 'under' ? -0.2 : 0));          // 斗笠：一圈圈的竹篾
    if (style === 'beanie') c.multiplyScalar(0.9 + 0.1 * Math.sin(j / nt * Math.PI * 2 * 22));                              // 毛线帽：一道道竖纹
    if (kind === 'brim') c.multiplyScalar(0.72 + 0.28 * sstep(0.125, 0.19, prof[i][0]));
    if (kind === 'under') c.multiplyScalar(0.6 + 0.4 * sstep(0.1, 0.24, prof[i][0]));
    B.vert([p.x, p.y, p.z], [n.x, n.y, n.z], c, w);
  }
  for (let i = 0; i < prof.length - 1; i++) for (let j = 0; j < nt; j++) {
    const p = base + i * (nt + 1) + j, q = p + nt + 1;
    B.idx.push(p, q, p + 1, p + 1, q, q + 1);
  }
}

// 背后那截围巾怎么画（主线程重新搭的时候也要用）
export function tailOptions(P, tail) {
  const scarf = col(P.scarf), stripe = col(P.scarfStripe);
  return {
    seg: tail.seg, samples: tail.n, flat: [1, 0, 0], width: u => 0.036 * (0.7 + 0.3 * sstep(0, 0.3, u)) * (1 - Math.pow(u, 14)) + 0.002, thick: () => 0.008,
    color: (u, ca) => { const st = sstep(0.78, 0.8, u) * sstep(0.85, 0.83, u) + sstep(0.89, 0.91, u) * sstep(0.96, 0.94, u); return scarf.clone().lerp(stripe, st).multiplyScalar(0.66 + 0.12 * ca); },
    weight: () => ({ spine_03: 1 }),
  };
}
export const lookOf = opts => ({ ...(LOOKS[opts.who] || LOOKS.m), ...(opts.look || {}) });

// ---------------- 主函数：捏好，返回一堆数（点、朝向、颜色、跟哪几根骨头） ----------------
// arms：{ l, r } 两条手臂从 T 字放到 A 字整体转了多少（4×4 矩阵的 16 个数）；BI：骨头名字 → 序号
export function sculptData(arms, BI, opts = {}) {
  const t0 = performance.now();
  const P = lookOf(opts);
  const D = { l: new THREE.Matrix4().fromArray(arms.l), r: new THREE.Matrix4().fromArray(arms.r) };
  const G = layers((shape, s) => posed(shape, D[L(s)]), P);
  const F = new Layers(G);
  const cell = opts.cell || 0.0125;
  const { positions, indices } = surfaceNets(F, cell, [-0.58, -0.012, -0.26], [0.58, 1.87, 0.2]);
  relax(F, positions, 3);

  const B = new Builder(BI);
  const c = {}; for (const k in P) if (P[k][0] === '#') c[k] = col(P[k]);
  const NG = G.length, nV = positions.length / 3, dg = new Float32Array(NG);
  const paintOf = G.map(g => g.paint || g.name);
  const dists = (x, y, z) => { let a = 0; for (let g = 0; g < NG; g++) { dg[g] = F.fields[g].eval(x, y, z); if (dg[g] < dg[a]) a = g; } return a; };
  // 两层相接的地方（围巾压着外套、手从袖口出来……）：把靠近接缝的点挪到接缝上，边界才是一条干净的线
  for (let i = 0; i < positions.length; i += 3) {
    let x = positions[i], y = positions[i + 1], z = positions[i + 2];
    const a = dists(x, y, z); let b = -1;
    for (let g = 0; g < NG; g++) if (g !== a && (b < 0 || dg[g] < dg[b])) b = g;
    if (dg[b] > 0.65 * cell) continue;
    const fa = F.fields[a], fb = F.fields[b];
    let da = 0, db = 0;
    for (let it = 0; it < 4; it++) {
      da = fa.eval(x, y, z); let n = fa.normal(x, y, z, 0.003); x -= n[0] * da; y -= n[1] * da; z -= n[2] * da;
      db = fb.eval(x, y, z); n = fb.normal(x, y, z, 0.003); x -= n[0] * db; y -= n[1] * db; z -= n[2] * db;
    }
    da = fa.eval(x, y, z);
    if (Math.abs(da) < 0.0015 && Math.hypot(x - positions[i], y - positions[i + 1], z - positions[i + 2]) < cell) { positions[i] = x; positions[i + 1] = y; positions[i + 2] = z; }
  }
  // 每个点：蒙皮权重（看离哪些形状近）、缝隙里的暗、手绘感的深浅
  const tmp = [], sigmaW = 0.028, sigmaC = 0.008;
  const W = new Array(nV), shade = new Float32Array(nV);
  for (let v = 0; v < nV; v++) {
    const x = positions[v * 3], y = positions[v * 3 + 1], z = positions[v * 3 + 2];
    tmp.length = 0;
    F.eval(x, y, z, tmp);
    let dmin = 1e9; for (let k = 1; k < tmp.length; k += 2) dmin = Math.min(dmin, tmp[k]);
    const weights = {};
    for (let k = 0; k < tmp.length; k += 2) {
      const pr = F.prims[tmp[k]];
      let w = Math.exp(-(tmp[k + 1] - dmin) / sigmaW);
      if (pr.side) w *= sstep(-0.003, 0.003, x * pr.side);
      if (w < 0.002) continue;
      const bn = pr.bone;
      if (typeof bn === 'function') { const o = bn(x, y, z); for (const n in o) weights[n] = (weights[n] || 0) + w * o[n]; }
      else weights[bn] = (weights[bn] || 0) + w;
    }
    W[v] = weights;
    const n = F.normal(x, y, z), ao = F.ao(x, y, z, n);
    const nv = vnoise(x * 9, y * 9, z * 9) * 0.6 + vnoise(x * 21 + 3, y * 21, z * 21) * 0.4;
    shade[v] = (0.93 + 0.12 * nv) * (0.86 + 0.14 * sstep(0, 1.5, y)) * (0.5 + 0.5 * ao);
  }
  const cheeks = [[0.068, 1.668, 0.1], [-0.068, 1.668, 0.1]];
  const paint = (g, x, y, z) => {
    const k = new THREE.Color(), what = paintOf[g];
    if (what === 'skin') {
      k.copy(c.skin);
      for (const q of cheeks) k.lerp(c.blush, 0.55 * sstep(0.045, 0.012, Math.hypot(x - q[0], y - q[1], z - q[2])));
    } else if (what === 'legs') k.copy(c.pants);
    else if (what === 'boots') {
      // 靴口浅一点、靴底深一点
      tmp.length = 0; const f = F.fields[g]; f.eval(x, y, z, tmp);
      let dmin = 1e9, trim = 0, plain = 0; for (let i = 1; i < tmp.length; i += 2) dmin = Math.min(dmin, tmp[i]);
      for (let i = 0; i < tmp.length; i += 2) { const wc = Math.exp(-(tmp[i + 1] - dmin) / sigmaC); if (f.prims[tmp[i]].region) trim += wc; else plain += wc; }
      k.copy(c.boot).lerp(c.cuff, trim / ((trim + plain) || 1)).lerp(c.sole, sstep(0.034, 0.02, y));
    } else if (what === 'coat') k.copy(c.coat);
    else if (what === 'trim') k.copy(c.coatTrim);
    else if (what === 'belt') k.copy(c.belt);
    else if (what === 'scarf') k.copy(c.scarf).multiplyScalar(0.9 + 0.12 * Math.sin(Math.atan2(x, z + 0.016) * 7 + y * 55));   // 褶子
    else { const st = vnoise(x * 46, y * 5, z * 46); k.copy(c.hair).lerp(c.hairHi, 0.55 * st * sstep(1.6, 1.8, y)); }         // 头发：一绺一绺的深浅
    return k;
  };
  // 每个三角形归一层；同一个点在不同层各有一份（颜色、朝向按各自那层算），所以层与层之间是硬边
  const copy = new Map();
  const vertOf = (v, g) => {
    const key = v * NG + g; let i = copy.get(key);
    if (i === undefined) {
      const x = positions[v * 3], y = positions[v * 3 + 1], z = positions[v * 3 + 2];
      const n = F.fields[g].normal(x, y, z), k = paint(g, x, y, z).multiplyScalar(shade[v]);
      if ((paintOf[g] === 'coat' || paintOf[g] === 'trim') && y < 0.8 && n[1] < -0.6) k.copy(c.seam).multiplyScalar(0.45);   // 衣摆朝下的那一面：外套里子，暗
      i = B.vert([x, y, z], n, k, W[v]);
      copy.set(key, i);
    }
    return i;
  };
  for (let t = 0; t < indices.length; t += 3) {
    const i0 = indices[t] * 3, i1 = indices[t + 1] * 3, i2 = indices[t + 2] * 3;
    const g = dists((positions[i0] + positions[i1] + positions[i2]) / 3, (positions[i0 + 1] + positions[i1 + 1] + positions[i2 + 1]) / 3, (positions[i0 + 2] + positions[i1 + 2] + positions[i2 + 2]) / 3);
    B.idx.push(vertOf(indices[t], g), vertOf(indices[t + 1], g), vertOf(indices[t + 2], g));
  }
  const bodyVerts = B.count;

  const HEAD = { Head: 1 };
  // ---- 眼睛：大一点的深色眼珠加两个高光 ----
  for (const s of [1, -1]) {
    const sp = F.ray([0.047 * s, 1.703, 0], [0, 0, 1]) || [0.047 * s, 1.703, 0.12];
    const dir = new THREE.Vector3(0.22 * s, 0, 1).normalize(), R = [0.019, 0.025, 0.019];
    const ec = [sp[0] - dir.x * 0.0095, sp[1], sp[2] - dir.z * 0.0095];
    blob(B, ec, R, c.eye, HEAD, { seg: 10 });
    blob(B, [ec[0] + 0.006, ec[1] + 0.01, ec[2] + 0.0165], [0.0058, 0.0058, 0.004], col('#ffffff'), HEAD, { seg: 5, glow: 1 });
    blob(B, [ec[0] - 0.006, ec[1] - 0.009, ec[2] + 0.0172], [0.003, 0.003, 0.002], col('#ffffff'), HEAD, { seg: 4, glow: 0.7 });
  }
  const onFace = (x, y, off) => { const p = F.ray([x, y, 0], [0, 0, 1]) || [x, y, 0.12]; return [p[0], p[1], p[2] + off]; };
  // ---- 眉毛、嘴 ----
  for (const s of [1, -1]) {
    const pts = [0.024, 0.04, 0.058, 0.074].map((x, i) => onFace(x * s, 1.744 + [0, 0.005, 0.005, 0][i], 0.002));
    tube(B, pts, { seg: 5, samples: 8, flat: [0, 1, 0], width: u => 0.0068 * Math.sin(Math.PI * (0.12 + 0.82 * u)) + 0.0008, thick: () => 0.003, color: () => c.hair.clone().multiplyScalar(0.7), weight: () => HEAD });
  }
  {
    const pts = [-0.024, -0.012, 0, 0.012, 0.024].map(x => onFace(x, 1.633 + 0.009 * (x / 0.024) ** 2, 0.0015));
    tube(B, pts, { seg: 5, samples: 10, flat: [0, 1, 0], width: u => 0.0056 * Math.sin(Math.PI * (0.1 + 0.85 * u)) + 0.0006, thick: () => 0.0025, color: () => c.mouth.clone(), weight: () => HEAD });
  }
  // ---- 宽檐帽，帽带上插一根羽毛 ----
  const HM = new THREE.Matrix4().makeTranslation(0, 1.79, -0.008).multiply(new THREE.Matrix4().makeRotationX(-0.12));
  const HS = P.hatStyle || 'straw';
  if (HS === 'beret') HM.multiply(new THREE.Matrix4().makeRotationZ(-0.2)).multiply(new THREE.Matrix4().makeTranslation(0.012, -0.016, 0));   // 画家帽往一边歪、压低一点
  if (HS !== 'none') hat(B, P, HM, HEAD);
  if (HS === 'beret') blob(B, new THREE.Vector3(0, 0.1, 0).applyMatrix4(HM).toArray(), [0.014, 0.012, 0.014], col(P.hat).multiplyScalar(0.8), HEAD, { seg: 5 });
  if (HS === 'beanie') blob(B, new THREE.Vector3(0, 0.135, 0).applyMatrix4(HM).toArray(), [0.036, 0.034, 0.036], col(P.band), HEAD, { seg: 7 });   // 毛线球
  if (P.beard) for (const s of [1, -1]) {
    // 两撇往下耷拉的胡子
    const pts = [0.004, 0.02, 0.037, 0.052].map((x, i) => onFace(x * s, 1.652 - [0, 0.002, 0.008, 0.02][i], 0.003));
    tube(B, pts, { seg: 5, samples: 8, flat: [0, 1, 0], width: u => 0.0095 * Math.sin(Math.PI * (0.2 + 0.72 * u)) + 0.001, thick: () => 0.005, color: () => c.hair.clone().multiplyScalar(0.94), weight: () => HEAD });
  }
  if (HS === 'straw' && P.plume !== false) {
    const pts = [[0.116, 0.04, -0.03], [0.137, 0.105, -0.06], [0.146, 0.175, -0.108], [0.136, 0.232, -0.17]].map(p => new THREE.Vector3(...p).applyMatrix4(HM).toArray());
    const tip = col(P.band);
    tube(B, pts, { seg: 6, samples: 14, flat: [1, 0, 0.45], width: u => 0.03 * Math.pow(Math.sin(Math.PI * (0.05 + 0.9 * u)), 0.8) + 0.0015, thick: () => 0.004, color: (u, ca) => c.feather.clone().lerp(tip, sstep(0.72, 0.95, u)).multiplyScalar(0.9 + 0.1 * ca), weight: () => HEAD });
  }
  // ---- 围巾垂在胸前的一截，末端两道浅色条纹 ----
  {
    const SP = { spine_03: 1 };
    const pts = [[0.05, 1.475, 0.08], [0.058, 1.42, 0.1], [0.066, 1.34, 0.1], [0.07, 1.26, 0.095], [0.066, 1.2, 0.09]].map((p, i) => (i ? F.hug(p, 0.013) : p));
    tube(B, pts, {
      seg: 8, samples: 18, flat: [1, 0, 0], width: u => 0.034 * (0.75 + 0.25 * sstep(0, 0.3, u)) * (1 - Math.pow(u, 14)) + 0.002, thick: () => 0.009,
      color: (u, ca) => { const st = sstep(0.74, 0.76, u) * sstep(0.82, 0.8, u) + sstep(0.87, 0.89, u) * sstep(0.95, 0.93, u); return c.scarf.clone().lerp(c.scarfStripe, st).multiplyScalar(0.62 + 0.1 * ca); },
      weight: u => (u > 0.6 ? { spine_03: 0.6, spine_02: 0.4 } : SP),
    });
  }
  // ---- 围巾甩在背后的一截：搭过铺盖卷、垂在行囊后面，跑起来往后飘（着色器里绕着根摆，长度不变） ----
  const tail = { from: B.count, to: 0, seg: 8, n: 24, root: [0.03, 1.522, -0.1] };
  if (P.tail !== false) tube(B, [tail.root, [0.04, 1.55, -0.15], [0.05, 1.47, -0.19], [0.055, 1.36, -0.175], [0.05, 1.25, -0.165]], tailOptions(P, tail));
  tail.to = B.count;
  // ---- 带扣、三颗扣子 ----
  {
    const p = F.ray([0, 1.047, 0], [0, 0, 1]) || [0, 1.047, 0.11];
    blob(B, [0, 1.047, p[2] + 0.002], [0.024, 0.021, 0.008], c.brass, { spine_01: 1 }, { seg: 6 });
    for (const [y, w] of [[1.385, { spine_03: 1 }], [1.285, { spine_03: 0.6, spine_02: 0.4 }], [1.185, { spine_02: 1 }]]) {
      const q = F.ray([0, y, 0], [0, 0, 1]) || [0, y, 0.1];
      blob(B, [-0.022, y, q[2] - 0.004], [0.011, 0.011, 0.007], c.brass, w, { seg: 5 });
    }
  }

  const idx = B.count > 65535 ? new Uint32Array(B.idx) : new Uint16Array(B.idx);
  return {
    pos: new Float32Array(B.pos), nor: new Float32Array(B.nor), col: new Float32Array(B.col), glow: new Float32Array(B.glow),
    si: new Uint16Array(B.si), sw: new Float32Array(B.sw), idx, tail, bodyVerts, tris: B.idx.length / 3, buildMs: performance.now() - t0,
  };
}
