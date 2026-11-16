// 地形高度场：一张 1.5 米格子的近景高度图（路和溪都“刻”进去），外面是粗格子的远景山。
// 纯数学，不依赖 three，Node 里也能跑（tools 里用它画俯视检查图）。
import { ROAD, STREAM, SPOTS, LAKE, CREEK_END, TRAIL, CAMP_SITES } from './route.js';
import { fbm, vnoise, sstep, lerp, clamp } from './noise.js';
import { autumnK, snowK } from './regions.js';

// 近景区域（四边对齐 8 米，远景网格在这里接缝）。西北角往外扩到了冰湖
export const DOM = { x0: -528, z0: -600, w: 696, d: 696, cell: 1.5 };
DOM.nx = Math.round(DOM.w / DOM.cell); DOM.nz = Math.round(DOM.d / DOM.cell);
export const CENTER = { x: -5, z: -110 };

const gauss = (x, z, cx, cz, r) => Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (r * r));
function ridged(x, z) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < 4; i++) { const v = 1 - Math.abs(vnoise(x * f + i * 7.7, z * f - i * 3.3) * 2 - 1); s += a * v * v; n += a; a *= 0.5; f *= 2.1; }
  return s / n;
}

// ---- 溪水：水面高度沿溪逐渐下降，溪宽缓慢变化 ----
const _q = {};
export const STREAM_CROSS = (() => { const p = ROAD.at(SPOTS.bridge); return STREAM.nearest(p.x, p.z, 30).s; })();
const WC = -0.9;
// 山涧：以前的源头往上越来越陡，一直爬到冰湖
const CREEK_K = 0.2;
const creekRise = c => c <= -30 ? 0 : c < 30 ? CREEK_K * (c + 30) * (c + 30) / 120 : CREEK_K * c;
// 山涧里有几处小跌水（一两米高的小瀑布）
export const FALLS = [[38, 2.4], [86, 3.0], [131, 4.0]];
const falls = s => { let r = 0; for (const [fs, fh] of FALLS) r += fh * sstep(fs + 1.4, fs - 1.4, s); return r; };
export function waterY(s) { const ds = s - STREAM_CROSS; return (ds < 0 ? WC - ds * 0.03 : WC - ds * 0.012) + creekRise(CREEK_END - s) + falls(s); }
// 冰面比山涧的起点高一点点
LAKE.y = waterY(0) + 0.3;
// 浅滩：桥上游一段溪水变宽变浅，可以蹚水过去（去西边松林）
export const SHOAL = { x: -96, z: -131 };
SHOAL.s = STREAM.nearest(SHOAL.x, SHOAL.z, 40).s;
const shoalK = s => Math.exp(-(((s - SHOAL.s) / 10) ** 2));
// 山涧窄一些、浅一些
const creekK = s => sstep(CREEK_END + 20, CREEK_END - 30, s);
export function bankW(s) { return (2.05 + 0.45 * Math.sin(s * 0.045) + 0.28 * Math.sin(s * 0.13 + 1.0) + 1.3 * shoalK(s)) * (1 - 0.42 * creekK(s)); }
const DEPTH = 0.72;
// 溪谷的宽度：红叶谷那段宽而缓，山涧窄一点
export const VALLEY_MAX = 96;
export const valleyR = s => 60 + 34 * sstep(CREEK_END + 270, CREEK_END + 190, s) - 22 * sstep(CREEK_END + 10, CREEK_END - 40, s);

// ---- 冰湖：椭圆形的湖盆，湖底比冰面低一点；湖边是一圈越来越陡的山（冰斗） ----
export function lakeQ(x, z) {
  const dx = x - LAKE.x, dz = z - LAKE.z;
  const u = (dx * LAKE.ax + dz * LAKE.az) / LAKE.a, v = (-dx * LAKE.az + dz * LAKE.ax) / LAKE.b;
  return Math.hypot(u, v);
}
// 湖岸弯弯曲曲（不是正椭圆）
const lakeQn = (x, z) => lakeQ(x, z) * (1 + 0.16 * (vnoise(x * 0.045 + 31, z * 0.045 - 17) - 0.5));
function lakeCarve(h, x, z) {
  const q = lakeQn(x, z);
  if (q > 4) return h;
  const r = Math.hypot(x - LAKE.x, z - LAKE.z), e = r * (1 - 1 / Math.max(q, 1e-3));   // 离湖岸大约多少米
  const ee = Math.max(e, 0);
  const bowl = LAKE.y - 0.45 + 0.6 * sstep(-0.5, 2.5, e) + 0.16 * ee + 0.0105 * ee * ee + 3 * (vnoise(x * 0.08, z * 0.08) - 0.5) * sstep(4, 20, ee);
  return Math.min(h, bowl);
}
export const ICE_Q = 1.15;
export const onIce = (x, z, h) => (h < LAKE.y && Math.abs(x - LAKE.x) < LAKE.a * ICE_Q + 1 && Math.abs(z - LAKE.z) < LAKE.a * ICE_Q + 1 && lakeQ(x, z) < ICE_Q) ? LAKE.y : h;

// 远山：一圈手摆的山峰。参数是 [方位角(从正北顺时针,度), 距离, 仰角(度), 宽度]。
// 夕阳在北偏西（方位 -16°、仰角从 14° 落到 7°），那个方向的山压低，留出一个山口让太阳落进去。
const PEAKS = [
  [-44, 1350, 9.5, 520], [-17, 1700, 2.6, 520], [8, 1300, 9.5, 480], [26, 1500, 12.5, 560], [46, 1200, 11.5, 470],
  [62, 1050, 9, 420], [-88, 1000, 8.5, 420], [-112, 950, 7, 420], [88, 900, 8, 400], [115, 950, 7, 420],
  [148, 880, 5.5, 420], [180, 900, 5, 420], [212, 880, 6, 420], [245, 900, 7.5, 420],
  [14, 2300, 9.5, 800], [34, 2200, 8.5, 760], [-70, 2100, 8, 760], [-40, 2400, 8, 700], [62, 2000, 7.5, 700],
].map(([az, r, el, R]) => ({ x: CENTER.x + Math.sin(az * Math.PI / 180) * r, z: CENTER.z - Math.cos(az * Math.PI / 180) * r, h: r * Math.tan(el * Math.PI / 180), R }));
function mountains(x, z, r) {
  let m = 0;
  for (const P of PEAKS) {
    const d = Math.hypot(x - P.x, z - P.z);
    if (d < P.R) { const t = 1 - d / P.R; m += P.h * Math.pow(t, 1.7); }
  }
  m *= 0.72 + 0.56 * ridged(x * 0.0032 + 11, z * 0.0032 - 4);
  // 太阳方向（方位 -16°）的前山压低，太阳从出发到营地一直挂在山口上方，到营地时正好贴着山
  const az = Math.atan2(x - CENTER.x, -(z - CENTER.z)) * 180 / Math.PI;
  m += sstep(300, 820, r) * (70 + 80 * fbm(x * 0.004 + 7, z * 0.004, 3)) * (1 - 0.82 * Math.exp(-(((az + 16) / 17) ** 2)));
  return m;
}
// 平滑起势的缓坡（起点处坡度为 0，避免折痕）
const rise = (u, H, L) => u <= 0 ? 0 : H * (1 - Math.exp(-(u * u) / (L * L)));

// 原始起伏（不含路和溪）
export function rawH(x, z) {
  let h = 2.4 * (fbm(x * 0.012 + 3.1, z * 0.012 - 1.7, 4) - 0.5) * 2;
  h += 0.8 * (fbm(x * 0.05, z * 0.05, 3) - 0.5);
  h += rise(x - 25, 46, 105);                                    // 东边缓坡
  h += 13 * gauss(x, z, 62, -118, 36);                           // 风车坡
  const dx = x - CENTER.x, dz = z - CENTER.z, r = Math.hypot(dx, dz);
  // 西边山和北边山在太阳方向远处压低一些（像一个山口），夕阳才不会被挡住
  const gap = 1 - 0.5 * sstep(200, 420, r) * Math.exp(-(((Math.atan2(dx, -dz) * 180 / Math.PI + 16) / 18) ** 2));
  h += rise(-x - 60, 46, 115) * gap;                             // 西边山
  h += 8.5 * gauss(x, z, -22, -198, 24);                         // 观景台的山嘴
  h += 7 * sstep(-140, -230, z);                                 // 往营地缓缓上坡
  h += 34 * sstep(-262, -520, z) * (0.8 + 0.4 * fbm(x * 0.01, 5.3, 3)) * gap; // 北边山
  h += rise(z - 45, 32, 130);                                    // 南边
  if (r > 280) h += mountains(x, z, r);
  return h;
}

// 溪谷：离溪一定距离内往“谷底”拉
function valley(h, dS, sS) {
  const R = valleyR(sS);
  if (dS >= R) return h;
  const W = waterY(sS);
  const floor = W + 0.55 + 0.0032 * dS * dS;
  return lerp(floor, h, sstep(7, R, dS));
}
// 河槽：水面以下是槽，岸边缓缓抬起
function channel(h, dS, sS) {
  const bw = bankW(sS);
  if (dS > bw + 7) return h;
  const W = waterY(sS);
  let c;
  if (dS < bw) { const t = dS / bw; c = W - DEPTH * (1 - 0.7 * shoalK(sS)) * (1 - 0.45 * creekK(sS)) * (1 - t * t) - 0.05; }
  else { const e = dS - bw; c = W - 0.05 + 0.62 * sstep(0, 1.7, e) + 0.14 * Math.max(0, e - 1.2) ** 2; }
  return Math.min(h, c);
}

// 远景用的整体高度（粗略处理溪谷，不含路）
export function farH(x, z) {
  let h = rawH(x, z);
  const q = STREAM.nearest(x, z, VALLEY_MAX, _q);
  if (q.dist < VALLEY_MAX) h = valley(h, q.dist, q.s);
  return lakeCarve(h, x, z);
}

// ---- 构建近景高度场 ----
export function buildLand() {
  const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
  const { x0, z0, cell, nx, nz } = DOM;
  const NX = nx + 1, NZ = nz + 1, N = NX * NZ;
  const roadD = new Float32Array(N).fill(99), roadS = new Float32Array(N);
  const strD = new Float32Array(N).fill(999), strS = new Float32Array(N);
  const trD = new Float32Array(N).fill(99), trS = new Float32Array(N);
  // 把折线“盖章”到格子上，比逐点查询快很多（step：隔几个点取一段，折线够顺时省很多）
  const stamp = (P, Rf, outD, outS, signed, step = 1) => {
    for (let i = 0; i < P.n; i += step) {
      const j = Math.min(P.n, i + step), R = typeof Rf === 'number' ? Rf : Rf(P.s[i]);
      const ax = P.x[i], az = P.z[i], bx = P.x[j], bz = P.z[j];
      const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1e-9;
      const gx0 = Math.max(0, Math.floor((Math.min(ax, bx) - R - x0) / cell)), gx1 = Math.min(nx, Math.ceil((Math.max(ax, bx) + R - x0) / cell));
      const gz0 = Math.max(0, Math.floor((Math.min(az, bz) - R - z0) / cell)), gz1 = Math.min(nz, Math.ceil((Math.max(az, bz) + R - z0) / cell));
      for (let gz = gz0; gz <= gz1; gz++) {
        const z = z0 + gz * cell;
        for (let gx = gx0; gx <= gx1; gx++) {
          const x = x0 + gx * cell;
          let t = ((x - ax) * dx + (z - az) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
          const qx = ax + dx * t - x, qz = az + dz * t - z, d = Math.sqrt(qx * qx + qz * qz);
          const k = gz * NX + gx;
          if (d < Math.abs(outD[k])) {
            outS[k] = P.s[i] + (P.s[j] - P.s[i]) * t;
            if (signed) { const tx = P.tx[i], tz = P.tz[i]; outD[k] = ((x - (ax + dx * t)) * -tz + (z - (az + dz * t)) * tx) >= 0 ? d : -d; }
            else outD[k] = d;
          }
        }
      }
    }
  };
  stamp(ROAD, 76, roadD, roadS, true);
  stamp(STREAM, s => valleyR(s) + 3, strD, strS, false, 3);
  stamp(TRAIL, 12, trD, trS, false, 2);

  // 路面纵断面：沿路取样、平滑，过桥处抬到桥面高度
  const RL = Math.ceil(ROAD.length) + 1, prof = new Float32Array(RL);
  const p = {};
  for (let i = 0; i < RL; i++) {
    ROAD.at(i, p); let h = rawH(p.x, p.z);
    const q = STREAM.nearest(p.x, p.z, VALLEY_MAX, _q); if (q.dist < VALLEY_MAX) h = valley(h, q.dist, q.s);
    prof[i] = h;
  }
  const tmp = new Float32Array(RL);
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < RL; i++) { let s = 0, n = 0; for (let k = -9; k <= 9; k++) { const j = Math.min(RL - 1, Math.max(0, i + k)); s += prof[j]; n++; } tmp[i] = s / n; }
    prof.set(tmp);
  }
  const deckY = waterY(STREAM_CROSS) + 1.25;
  const BR = { s: SPOTS.bridge, half: 5.2, deckY };
  for (let i = 0; i < RL; i++) { const e = Math.max(0, Math.abs(i - BR.s) - BR.half); prof[i] = e <= 0 ? deckY : clamp(prof[i], deckY - 0.08 * e, deckY + 0.075 * e); }
  // 全程坡度不超过约 8%
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i < RL; i++) prof[i] = clamp(prof[i], prof[i - 1] - 0.08, prof[i - 1] + 0.08);
    for (let i = RL - 2; i >= 0; i--) prof[i] = clamp(prof[i], prof[i + 1] - 0.08, prof[i + 1] + 0.08);
  }
  for (let pass = 0; pass < 2; pass++) { for (let i = 1; i < RL - 1; i++) tmp[i] = Math.abs(i - BR.s) < BR.half + 1 ? prof[i] : (prof[i - 1] + prof[i] * 2 + prof[i + 1]) / 4; tmp[0] = prof[0]; tmp[RL - 1] = prof[RL - 1]; prof.set(tmp); }
  const roadY = s => { s = clamp(s, 0, RL - 1.001); const i = Math.floor(s), f = s - i; return prof[i] + (prof[i + 1] - prof[i]) * f; };
  // 溪边小路的纵断面：顺着地形走，只是抹平一点
  const TL = Math.ceil(TRAIL.length) + 1, tprof = new Float32Array(TL), ttmp = new Float32Array(TL);
  for (let i = 0; i < TL; i++) { TRAIL.at(i, p); tprof[i] = farH(p.x, p.z); }
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < TL; i++) { let s = 0, n = 0; for (let k = -8; k <= 8; k++) { s += tprof[Math.min(TL - 1, Math.max(0, i + k))]; n++; } ttmp[i] = s / n; }
    tprof.set(ttmp);
  }
  const trailY = s => { s = clamp(s, 0, TL - 1.001); const i = Math.floor(s), f = s - i; return tprof[i] + (tprof[i + 1] - tprof[i]) * f; };

  // 需要压平的地点
  const flats = [];
  const atS = s => ROAD.at(s, {});
  { const c = atS(SPOTS.camp); flats.push({ x: c.x + 2, z: c.z - 3, r0: 9, r1: 16, y: roadY(SPOTS.camp) }); }
  { const v = atS(SPOTS.view); flats.push({ x: v.x - 3.5, z: v.z - 1, r0: 3.5, r1: 8, y: roadY(SPOTS.view) + 0.05 }); }
  flats.push({ x: 62, z: -118, r0: 4.5, r1: 9, y: null });
  // 野外营地：贴着小路的和小路一样高，其他的按溪谷里原来的地面
  for (const c of CAMP_SITES) {
    let y;
    if (c.ts !== undefined) y = trailY(c.ts) + 0.05;
    else { const q = STREAM.nearest(c.x, c.z, VALLEY_MAX, {}); y = rawH(c.x, c.z); if (q.dist < VALLEY_MAX) y = valley(y, q.dist, q.s); }
    flats.push({ x: c.x, z: c.z, r0: 5.5, r1: 13, y });
  }

  const H = new Float32Array(N);
  for (let gz = 0; gz < NZ; gz++) {
    const z = z0 + gz * cell;
    for (let gx = 0; gx < NX; gx++) {
      const x = x0 + gx * cell, k = gz * NX + gx;
      let h = rawH(x, z);
      const dS = strD[k], sS = strS[k];
      h = valley(h, dS, sS);
      const dR = Math.abs(roadD[k]);
      if (dR < 11) {
        const ry = roadY(roadS[k]) - 0.06 * Math.max(0, 1 - (dR / 2.2) ** 2);
        h = lerp(ry, h, sstep(2.4, 10.5, dR));
      }
      for (const f of flats) {
        const d = Math.hypot(x - f.x, z - f.z);
        if (d < f.r1) { if (f.y === null) f.y = rawH(f.x, f.z); h = lerp(f.y, h, sstep(f.r0, f.r1, d)); }
      }
      h = lakeCarve(h, x, z);
      h = channel(h, dS, sS);
      // 溪边小路最后刻（跌水旁边河岸陡，小路自己是顺的）
      const dT = trD[k];
      if (dT < 5) h = lerp(trailY(trS[k]) - 0.04 * Math.max(0, 1 - (dT / 1.1) ** 2), h, sstep(1.3, 4.6, dT));
      H[k] = h;
    }
  }
  // 区域权重（0~255）：红叶、积雪
  const AU = new Uint8Array(N), SN = new Uint8Array(N);
  for (let gz = 0; gz < NZ; gz++) {
    const z = z0 + gz * cell;
    for (let gx = 0; gx < NX; gx++) {
      const x = x0 + gx * cell, k = gz * NX + gx;
      AU[k] = autumnK(x, z, H[k], strS[k], strD[k]) * 255;
      SN[k] = snowK(x, z, H[k]) * 255;
    }
  }
  const land = new Land(H, roadD, roadS, strD, strS, prof, BR, (typeof performance !== 'undefined' ? performance : Date).now() - t0);
  land.trD = trD; land.trS = trS; land.AU = AU; land.SN = SN;
  return land;
}

export class Land {
  constructor(H, roadD, roadS, strD, strS, prof, bridge, ms) {
    Object.assign(this, { H, roadD, roadS, strD, strS, prof, bridge, ms });
    this.NX = DOM.nx + 1; this.NZ = DOM.nz + 1;
  }
  inside(x, z) { return x >= DOM.x0 && z >= DOM.z0 && x <= DOM.x0 + DOM.w && z <= DOM.z0 + DOM.d; }
  // 双线性取样（和 GPU 三角形插值差几厘米，够用）
  sample(arr, x, z) {
    const fx = clamp((x - DOM.x0) / DOM.cell, 0, DOM.nx - 0.0001), fz = clamp((z - DOM.z0) / DOM.cell, 0, DOM.nz - 0.0001);
    const ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz, k = iz * this.NX + ix;
    const a = arr[k], b = arr[k + 1], c = arr[k + this.NX], d = arr[k + this.NX + 1];
    return (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz;
  }
  // 冰湖上走在冰面上（湖底比冰面低一点）
  height(x, z) { return onIce(x, z, this.inside(x, z) ? this.sample(this.H, x, z) : farH(x, z)); }
  // 按格子的三角形取高度（与网格完全一致，马蹄用）
  heightExact(x, z) {
    if (!this.inside(x, z)) return onIce(x, z, farH(x, z));
    const fx = clamp((x - DOM.x0) / DOM.cell, 0, DOM.nx - 0.0001), fz = clamp((z - DOM.z0) / DOM.cell, 0, DOM.nz - 0.0001);
    const ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz, k = iz * this.NX + ix, H = this.H;
    const a = H[k], b = H[k + 1], c = H[k + this.NX], d = H[k + this.NX + 1];
    // 网格的对角线是 (ix,iz+1)-(ix+1,iz)
    return onIce(x, z, tx + tz < 1 ? a + (b - a) * tx + (c - a) * tz : d + (c - d) * (1 - tx) + (b - d) * (1 - tz));
  }
  // 地面本身（不算冰面）
  ground(x, z) { return this.inside(x, z) ? this.sample(this.H, x, z) : farH(x, z); }
  normal(x, z, out = [0, 1, 0]) {
    const e = 0.75, hx = this.height(x + e, z) - this.height(x - e, z), hz = this.height(x, z + e) - this.height(x, z - e);
    const l = Math.hypot(hx, 2 * e, hz); out[0] = -hx / l; out[1] = 2 * e / l; out[2] = -hz / l; return out;
  }
  roadY(s) { const RL = this.prof.length; s = clamp(s, 0, RL - 1.001); const i = Math.floor(s), f = s - i; return this.prof[i] + (this.prof[i + 1] - this.prof[i]) * f; }
  // 离路多远（溪边小路窄，算远半米）
  // 红叶、积雪（0~1）
  autumn(x, z) { return this.inside(x, z) ? this.sample(this.AU, x, z) / 255 : 0; }
  snow(x, z) { return this.inside(x, z) ? this.sample(this.SN, x, z) / 255 : snowK(x, z, farH(x, z)); }
  roadDist(x, z) { return this.inside(x, z) ? Math.min(Math.abs(this.sample(this.roadD, x, z)), this.sample(this.trD, x, z) + 0.55) : 99; }
  mainRoadDist(x, z) { return this.inside(x, z) ? Math.abs(this.sample(this.roadD, x, z)) : 99; }
  streamDist(x, z) { return this.inside(x, z) ? this.sample(this.strD, x, z) : 999; }
}
