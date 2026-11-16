// 地图：手绘风格的地形图。山影、等高线、水彩底色、溪水、冰湖、山路、溪边小路和一棵棵树先画在一张大画布上
// （开始旅行后趁空闲分几十帧画好，第一次打开就不用等）；没去过的地方蒙一层纸色，走到哪里亮到哪里。
// 风景点、自己、坐骑、标记点、风车桥营地这些小图标每次重画，放大缩小都清楚。
// 点风景点：去过的可以“去这里”（一暗一亮直接过去），没去过的可以“标记”，屏幕上方会指方向，远处立一道光。
import { DOM, bankW, lakeQ, ICE_Q, FALLS } from '../world/land.js';
import { SEA, coastCT } from '../world/route.js';
import { ROAD, STREAM, LAKE, SPOTS } from '../world/route.js';
import { fbm } from '../world/noise.js';

const sst = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const PAPER = [240, 230, 206];
const INK = '#4a3424';

// ---------- 去过的地方：4 米一格的蒙版 ----------
export class Explored {
  constructor() {
    this.C = 4; this.N = Math.ceil(DOM.w / this.C); this.M = Math.ceil(DOM.d / this.C);
    this.a = new Uint8Array(this.N * this.M); this.ver = 0;
  }
  clear() { this.a.fill(0); this.ver++; }
  reveal(x, z, r) {
    const C = this.C, N = this.N, M = this.M, cx = (x - DOM.x0) / C, cz = (z - DOM.z0) / C, rr = r / C;
    const i0 = Math.max(0, Math.floor(cx - rr)), i1 = Math.min(N - 1, Math.ceil(cx + rr));
    const j0 = Math.max(0, Math.floor(cz - rr)), j1 = Math.min(M - 1, Math.ceil(cz + rr));
    let ch = false;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const dx = i + 0.5 - cx, dz = j + 0.5 - cz, k = j * N + i;
      if (!this.a[k] && dx * dx + dz * dz <= rr * rr) { this.a[k] = 1; ch = true; }
    }
    if (ch) this.ver++;
    return ch;
  }
  // 存档：一格一位，再转 base64（约 5KB）
  encode() {
    const a = this.a, b = new Uint8Array(Math.ceil(a.length / 8));
    for (let i = 0; i < a.length; i++) if (a[i]) b[i >> 3] |= 1 << (i & 7);
    let s = ''; for (let i = 0; i < b.length; i += 4096) s += String.fromCharCode.apply(null, b.subarray(i, i + 4096));
    return btoa(s);
  }
  decode(str) {
    try {
      const s = atob(str), a = this.a;
      if (s.length !== Math.ceil(a.length / 8)) return false;
      for (let i = 0; i < a.length; i++) a[i] = (s.charCodeAt(i >> 3) >> (i & 7)) & 1;
      this.ver++; return true;
    } catch { return false; }
  }
}

// ---------- 底图 ----------
// 树冠在地图上的颜色：普通绿树、松树、落雪的松树、红叶（按 tint 的绿色倍数分红、橙、黄）
function treeColor(t) {
  if (t.t === 'Pine_2@s') return [118, 146, 140];
  if (t.t === 'Pine_2') return [72, 112, 82];
  if (t.t === 'Bamboo') return [138, 172, 80];
  if (t.tint) { const g = t.tint[1]; return g < 0.3 ? [196, 82, 58] : g < 0.6 ? [212, 108, 60] : g < 1 ? [222, 142, 66] : g < 1.9 ? [224, 182, 82] : [190, 186, 88]; }
  return [104, 146, 84];
}
export class MapBake {
  constructor(land, trees, S = 1536) {
    this.land = land; this.trees = trees; this.S = S; this.row = 0; this.done = false;
    this.cv = document.createElement('canvas'); this.cv.width = this.cv.height = S;
    this.ctx = this.cv.getContext('2d');
    this.img = this.ctx.createImageData(S, S);
    // 格点上的坡度（中心差分），逐像素双线性取
    const NX = land.NX, NZ = land.NZ, H = land.H, c2 = 2 * DOM.cell;
    this.GX = new Float32Array(NX * NZ); this.GZ = new Float32Array(NX * NZ);
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
      const k = j * NX + i;
      this.GX[k] = (H[j * NX + Math.min(NX - 1, i + 1)] - H[j * NX + Math.max(0, i - 1)]) / c2;
      this.GZ[k] = (H[Math.min(NZ - 1, j + 1) * NX + i] - H[Math.max(0, j - 1) * NX + i]) / c2;
    }
    // 水彩的深浅斑（低分辨率噪声）
    const Q = this.Q = 96; this.WC = new Float32Array(Q * Q);
    for (let j = 0; j < Q; j++) for (let i = 0; i < Q; i++) this.WC[j * Q + i] = fbm(i * 0.11 + 7.3, j * 0.11 - 2.1, 3);
  }
  // 画几行；画完返回 true
  step(rows = 24, all = false) {
    if (this.done) return true;
    // 最后两步各占一帧：先把像素贴上画布，再画树（免得一帧里卡太久）
    if (this.row >= this.S) {
      if (this.img) { this.ctx.putImageData(this.img, 0, 0); this.img = null; if (!all) return false; }
      this.drawTrees();
      this.GX = this.GZ = null;
      this.done = true;
      return true;
    }
    const { land, S, img } = this, D = img.data, NX = land.NX, NZ = land.NZ, cell = DOM.cell, mpp = DOM.w / S;
    const H = land.H, GX = this.GX, GZ = this.GZ, AU = land.AU, SN = land.SN, SA = land.SA, RD = land.roadD, TD = land.trD, TS = land.trS, SD = land.strD, SS = land.strS;
    const WC = this.WC, Q = this.Q;
    const Lx = -0.47, Ly = 0.75, Lz = -0.47, E = 1.7;
    const r1 = Math.min(S, this.row + rows);
    for (let py = this.row; py < r1; py++) {
      const z = DOM.z0 + (py + 0.5) * mpp;
      const fz = (py + 0.5) * mpp / cell; let iz = fz | 0; if (iz > NZ - 2) iz = NZ - 2; const tz = fz - iz;
      const wq = (py / S) * (Q - 1), jq = wq | 0, uq = wq - jq;
      for (let px = 0; px < S; px++) {
        const x = DOM.x0 + (px + 0.5) * mpp;
        const fx = (px + 0.5) * mpp / cell; let ix = fx | 0; if (ix > NX - 2) ix = NX - 2; const tx = fx - ix;
        const k = iz * NX + ix, k1 = k + 1, k2 = k + NX, k3 = k2 + 1;
        const w0 = (1 - tx) * (1 - tz), w1 = tx * (1 - tz), w2 = (1 - tx) * tz, w3 = tx * tz;
        const h = H[k] * w0 + H[k1] * w1 + H[k2] * w2 + H[k3] * w3;
        const gx = GX[k] * w0 + GX[k1] * w1 + GX[k2] * w2 + GX[k3] * w3;
        const gz = GZ[k] * w0 + GZ[k1] * w1 + GZ[k2] * w2 + GZ[k3] * w3;
        const au = (AU[k] * w0 + AU[k1] * w1 + AU[k2] * w2 + AU[k3] * w3) / 255;
        const sn = (SN[k] * w0 + SN[k1] * w1 + SN[k2] * w2 + SN[k3] * w3) / 255;
        const grad = Math.sqrt(gx * gx + gz * gz);
        // 底色：谷地嫩绿，高处发黄发干，陡坡露岩，红叶谷橙红，雪线以上白
        const up = sst(10, 46, h);
        let r = 176 + 30 * up, g = 199 - 4 * up, b = 128 + 18 * up;
        const rk = sst(0.5, 0.95, grad);
        r += (186 - r) * rk; g += (174 - g) * rk; b += (156 - b) * rk;
        if (au > 0.01) { const a = sst(0, 0.75, au) * 0.85; r += (230 - r) * a; g += (172 - g) * a; b += (106 - b) * a; }
        if (sn > 0.01) { const a = sst(0.2, 0.6, sn); r += (244 - r) * a; g += (247 - g) * a; b += (250 - b) * a; }
        // 沙滩：暖黄
        const sa = SA ? (SA[k] * w0 + SA[k1] * w1 + SA[k2] * w2 + SA[k3] * w3) / 255 : 0;
        if (sa > 0.01) { const a = sst(0.1, 0.6, sa) * (1 - rk * 0.8); r += (240 - r) * a; g += (222 - g) * a; b += (172 - b) * a; }
        // 山影（西北来光，竖直方向夸大一些）+ 背阴处偏一点蓝
        const nx = -gx * E, nz = -gz * E, nl = Math.sqrt(nx * nx + 1 + nz * nz);
        const rel = (nx * Lx + Ly + nz * Lz) / nl / Ly;
        let sh = 0.88 + 0.34 * (rel - 1); sh = sh < 0.6 ? 0.6 : sh > 1.1 ? 1.1 : sh;
        if (sn > 0.2) sh = 1 - (1 - sh) * 0.7;      // 雪地亮，背阴处也不太暗
        r *= sh; g *= sh; b *= sh + (1 - sh) * 0.18;
        // 水彩斑 + 纸纹
        const wi = (px / S) * (Q - 1), iq = wi | 0, ui = wi - iq, q0 = jq * Q + iq;
        const wc = (WC[q0] * (1 - ui) + WC[q0 + 1] * ui) * (1 - uq) + (WC[q0 + Q] * (1 - ui) + WC[q0 + Q + 1] * ui) * uq;
        let hsh = Math.imul(px * 73856093 ^ py * 19349663, 0x45d9f3b); hsh ^= hsh >>> 15;
        const pg = 0.94 + 0.12 * wc + ((hsh & 255) / 255 - 0.5) * 0.045;
        r *= pg; g *= pg; b *= pg;
        // 等高线：5 米一条，25 米一条粗的
        if (grad > 0.025) {
          const c = h / 5, fr = c - Math.floor(c), dd = Math.min(fr, 1 - fr) * 5 / grad / mpp;
          if (dd < 1.2) {
            const idx = Math.round(c) % 5 === 0, a = (1 - dd / 1.2) * (idx ? 0.36 : 0.17) * (1 - 0.6 * sst(0.4, 0.8, sn));
            r += (112 - r) * a; g += (84 - g) * a; b += (58 - b) * a;
          }
        }
        // 海：浅的地方青绿，越深越蓝，岸边一道白浪
        if (h < SEA.y + 0.15 && x < -300 && coastCT(x, z)[0] > -60) {
          const dep = SEA.y - h, d = sst(0, 12, dep), sea = sst(0.15, -0.25, h - SEA.y);
          const sr = (150 - 64 * d) * pg, sg = (206 - 58 * d) * pg, sb = (204 - 20 * d) * pg;
          const foam = sst(0.9, 0, dep) * 0.55;
          r += (sr + (246 - sr) * foam - r) * sea; g += (sg + (248 - sg) * foam - g) * sea; b += (sb + (240 - sb) * foam - b) * sea;
        }
        // 冰湖
        if (Math.abs(x - LAKE.x) < 90 && Math.abs(z - LAKE.z) < 90 && h < LAKE.y + 0.05) {
          const q = lakeQ(x, z);
          if (q < ICE_Q) {
            const st = 0.5 + 0.5 * Math.sin((x * 0.8 + z * 0.35) * 0.35 + wc * 9);
            r = 214 + 22 * st; g = 234 + 14 * st; b = 242 + 10 * st;
            const e = sst(ICE_Q - 0.08, ICE_Q, q); r += (128 - r) * e * 0.7; g += (170 - g) * e * 0.7; b += (196 - b) * e * 0.7;
          }
        }
        // 溪水：中间深一点，岸边一道深色描边
        const sd = SD[k] * w0 + SD[k1] * w1 + SD[k2] * w2 + SD[k3] * w3;
        if (sd < 8) {
          const ss = SS[k] * w0 + SS[k1] * w1 + SS[k2] * w2 + SS[k3] * w3, bw = bankW(ss) + 0.35;
          if (sd < bw) { const c = 1 - sd / bw; r = 132 - 26 * c; g = 186 - 20 * c; b = 206 - 8 * c; }
          else if (sd < bw + 0.9) { const a = 0.75 * (1 - (sd - bw) / 0.9); r += (86 - r) * a; g += (124 - g) * a; b += (148 - b) * a; }
        }
        // 山路（浅色路面 + 褐色描边，过溪的地方就是桥）和溪边小路（虚线）
        const rd = Math.abs(RD[k] * w0 + RD[k1] * w1 + RD[k2] * w2 + RD[k3] * w3);
        if (rd < 2.4) {
          if (rd < 1.5) { r = 240; g = 226; b = 192; }
          else { const a = 0.85 * (1 - (rd - 1.5) / 0.9); r += (150 - r) * a; g += (110 - g) * a; b += (76 - b) * a; }
        } else {
          const td = TD[k] * w0 + TD[k1] * w1 + TD[k2] * w2 + TD[k3] * w3;
          if (td < 1.1) {
            const ts = TS[k] * w0 + TS[k1] * w1 + TS[k2] * w2 + TS[k3] * w3, dash = (ts % 4.5) < 2.8;
            if (dash) { const a = 0.85 * sst(1.1, 0.55, td); r += (138 - r) * a; g += (100 - g) * a; b += (68 - b) * a; }
          }
        }
        const o = (py * S + px) * 4;
        D[o] = r; D[o + 1] = g; D[o + 2] = b; D[o + 3] = 255;
      }
    }
    this.row = r1;
    return false;
  }
  // 一棵棵树：影子、树冠、亮面，同色的合成一条路径画
  drawTrees() {
    const g = this.ctx, ppm = this.S / DOM.w, groups = new Map();
    for (const t of this.trees) {
      if (t.x < DOM.x0 || t.x > DOM.x0 + DOM.w || t.z < DOM.z0 || t.z > DOM.z0 + DOM.d) continue;
      const pine = t.t.startsWith('Pine'), r = (pine ? 1.5 : 2.1) * (t.s || 1) * ppm;
      const c = treeColor(t), key = c.join(',');
      let a = groups.get(key); if (!a) groups.set(key, a = { c, list: [] });
      a.list.push([(t.x - DOM.x0) * ppm, (t.z - DOM.z0) * ppm, Math.max(1.4, r), pine]);
    }
    const all = [...groups.values()];
    g.fillStyle = 'rgba(60, 70, 40, 0.28)'; g.beginPath();
    for (const { list } of all) for (const [x, y, r] of list) { g.moveTo(x + r * 1.35, y + r * 0.4); g.arc(x + r * 0.35, y + r * 0.4, r, 0, 6.283); }
    g.fill();
    for (const { c, list } of all) {
      g.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; g.beginPath();
      for (const [x, y, r] of list) { g.moveTo(x + r, y); g.arc(x, y, r, 0, 6.283); }
      g.fill();
      g.fillStyle = `rgba(${Math.min(255, c[0] + 60)},${Math.min(255, c[1] + 55)},${Math.min(255, c[2] + 40)},0.55)`; g.beginPath();
      for (const [x, y, r, pine] of list) { const rr = r * (pine ? 0.4 : 0.5); g.moveTo(x - r * 0.28 + rr, y - r * 0.3); g.arc(x - r * 0.28, y - r * 0.3, rr, 0, 6.283); }
      g.fill();
    }
  }
}

// ---------- 地图界面 ----------
// h: { land, trees, places(), player(), mountAt(), explored, getWay(), setWay(w), travel(P), canTravel(), onOpen(), onClose() }
export class MapView {
  constructor(h) {
    this.h = h; this.isOpen = false; this.dirty = true;
    this.bake = null;       // 底图第一次要用时才建（约 10MB）
    const $ = id => document.getElementById(id);
    this.el = $('mapSheet'); this.cv = $('mapCv'); this.ctx = this.cv.getContext('2d');
    this.card = $('mapCard'); this.sub = $('mapSub');
    this.view = { cx: 0, cz: 0, z: 1 };
    this.fogCv = document.createElement('canvas'); this.fogCv.width = h.explored.N; this.fogCv.height = h.explored.M;
    this.fogVer = -1; this.sel = null;
    // 地图上的小图标
    const br = ROAD.at(SPOTS.bridge, {});
    this.pois = [
      { k: 'mill', x: 62, z: -118 }, { k: 'bridge', x: br.x, z: br.z, a: Math.atan2(br.tz, br.tx) },
      ...FALLS.map(([s]) => { const p = STREAM.at(s, {}); return { k: 'falls', x: p.x, z: p.z, a: Math.atan2(p.tz, p.tx) }; }),
    ];
    $('mapClose').addEventListener('click', () => this.close());
    $('mapMe').addEventListener('click', () => { const p = this.h.player(); this.view.cx = p.x; this.view.cz = p.z; this.clampView(); this.dirty = true; });
    this.card.addEventListener('click', e => { const b = e.target.closest('button'); if (b) this.act(b.dataset.a); });
    this.gestures();
    addEventListener('resize', () => { if (this.isOpen) { this.resize(); this.dirty = true; } });
  }
  get B() { return this.bake || (this.bake = new MapBake(this.h.land, this.h.trees)); }
  // 空闲时画几行底图
  idle() { if (!this.bake || !this.bake.done) this.B.step(20); }
  open(focusId) {
    if (!this.B.done) while (!this.bake.step(256, true));
    this.isOpen = true; this.el.hidden = false; this.resize();
    const P = focusId && this.h.places().find(p => p.id === focusId && p.x !== undefined);
    const me = this.h.player();
    this.view.z = Math.min(this.zMax, Math.max(this.zFit, this.W / 400));
    this.view.cx = P ? P.x : me.x; this.view.cz = P ? P.z : me.z;
    this.clampView();
    this.select(P ? { kind: 'place', P } : null);
    const list = this.h.places().filter(p => p.kind !== 'mark'), seen = list.filter(p => p.seen).length;
    this.sub.textContent = `到过 ${seen}/${this.h.total?.() ?? list.length} 处`;
    this.dirty = true; this.h.onOpen?.();
  }
  close() { if (!this.isOpen) return; this.isOpen = false; this.el.hidden = true; this.select(null); this.h.onClose?.(); }
  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2), W = this.el.clientWidth || innerWidth, H = this.el.clientHeight || innerHeight;
    this.W = W; this.H = H; this.dpr = dpr;
    this.cv.width = Math.round(W * dpr); this.cv.height = Math.round(H * dpr);
    this.zFit = Math.min(W / DOM.w, (H - 120) / DOM.d) * 0.98; this.zMax = 3;
  }
  clampView() {
    const v = this.view; v.z = Math.min(this.zMax, Math.max(this.zFit, v.z));
    const hw = this.W / 2 / v.z, hh = (this.H - 60) / 2 / v.z, m = 30 / v.z;
    const fit = (c, a0, len, half) => len <= 2 * half ? a0 + len / 2 : Math.min(a0 + len - half + m, Math.max(a0 + half - m, c));
    v.cx = fit(v.cx, DOM.x0, DOM.w, hw); v.cz = fit(v.cz, DOM.z0, DOM.d, hh);
  }
  toScreen(x, z) { const v = this.view; return [this.W / 2 + (x - v.cx) * v.z, this.H / 2 + 20 + (z - v.cz) * v.z]; }
  toWorld(sx, sy) { const v = this.view; return [v.cx + (sx - this.W / 2) / v.z, v.cz + (sy - this.H / 2 - 20) / v.z]; }
  tick() { if (this.isOpen && this.dirty) { this.dirty = false; this.draw(); } }

  // ---------- 手势：拖动、双指缩放、滚轮、点按 ----------
  gestures() {
    const pts = new Map(); let pinch = null, moved = 0, downT = 0;
    const cv = this.cv;
    const mid = () => { const [a, b] = [...pts.values()]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) }; };
    cv.addEventListener('pointerdown', e => {
      try { cv.setPointerCapture(e.pointerId); } catch {}
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) { moved = 0; downT = performance.now(); }
      if (pts.size === 2) { const m = mid(); pinch = { ...m, z0: this.view.z, w: this.toWorld(m.x, m.y) }; moved = 99; }
      e.preventDefault();
    });
    cv.addEventListener('pointermove', e => {
      const p = pts.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (pts.size === 1 && !pinch) { moved += Math.abs(dx) + Math.abs(dy); this.view.cx -= dx / this.view.z; this.view.cz -= dy / this.view.z; }
      else if (pts.size >= 2 && pinch) {
        const m = mid(); this.view.z = pinch.z0 * m.d / Math.max(10, pinch.d);
        this.view.z = Math.min(this.zMax, Math.max(this.zFit, this.view.z));
        // 两指中间那一点跟着手指走
        this.view.cx = pinch.w[0] - (m.x - this.W / 2) / this.view.z; this.view.cz = pinch.w[1] - (m.y - this.H / 2 - 20) / this.view.z;
      }
      this.clampView(); this.dirty = true;
    });
    const up = e => {
      const p = pts.get(e.pointerId); if (!p) return;
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (pts.size === 0 && moved < 8 && performance.now() - downT < 600) this.tap(p.x, p.y);
      if (pts.size === 0) moved = 0;
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', e => { pts.delete(e.pointerId); pinch = null; });
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      const w = this.toWorld(e.clientX, e.clientY);
      this.view.z = Math.min(this.zMax, Math.max(this.zFit, this.view.z * Math.exp(-e.deltaY * 0.0015)));
      this.view.cx = w[0] - (e.clientX - this.W / 2) / this.view.z; this.view.cz = w[1] - (e.clientY - this.H / 2 - 20) / this.view.z;
      this.clampView(); this.dirty = true;
    }, { passive: false });
  }
  tap(sx, sy) {
    let best = null, bd = 24;
    for (const P of this.h.places()) {
      if (P.x === undefined) continue;
      const [x, y] = this.toScreen(P.x, P.z), d = Math.hypot(x - sx, y - sy);
      if (d < bd) { bd = d; best = P; }
    }
    if (best) return this.select({ kind: 'place', P: best });
    const way = this.h.getWay();
    if (way) { const [x, y] = this.toScreen(way.x, way.z); if (Math.hypot(x - sx, y - sy) < 22) return this.select({ kind: 'way' }); }
    const [wx, wz] = this.toWorld(sx, sy);
    if (wx < DOM.x0 || wx > DOM.x0 + DOM.w || wz < DOM.z0 || wz > DOM.z0 + DOM.d) return this.select(null);
    if (this.sel) return this.select(null);       // 先点一下空白处关掉卡片
    this.select({ kind: 'pin', x: wx, z: wz });
  }
  select(s) {
    this.sel = s; this.dirty = true;
    if (!s) { this.card.hidden = true; return; }
    const me = this.h.player(), way = this.h.getWay();
    let name, text, btns = [];
    const dist = (x, z) => { const d = Math.hypot(x - me.x, z - me.z); return d < 15 ? '就在这儿' : `离你 ${d < 1000 ? Math.round(d / 10) * 10 : (d / 1000).toFixed(1) + ' 千'} 米`; };
    if (s.kind === 'place') {
      const P = s.P, marked = way && way.id === P.id;
      name = P.name; text = (P.kind === 'mark' ? P.sub : P.seen ? P.sub : '还没去过 · ' + P.where) + ' · ' + dist(P.x, P.z);
      if (P.seen && P.kind !== 'mark') btns.push(this.h.canTravel() ? ['go', '去这里'] : ['', '坐着呢，先站起来']);
      btns.push(marked ? ['unmark', '取消标记'] : ['mark', '标记']);
    } else if (s.kind === 'way') {
      name = way.name; text = '标记的地方 · ' + dist(way.x, way.z); btns.push(['unmark', '取消标记']);
    } else {
      name = '这里'; text = dist(s.x, s.z); btns.push(['mark', '标记这里']);
    }
    this.card.querySelector('b').textContent = name;
    this.card.querySelector('small').textContent = text;
    this.card.querySelector('.row').innerHTML = btns.map(([a, t]) => `<button type="button" data-a="${a}"${a ? '' : ' disabled'}>${t}</button>`).join('');
    this.card.hidden = false;
  }
  act(a) {
    const s = this.sel; if (!s || !a) return;
    if (a === 'go' && s.kind === 'place') { const P = s.P; this.close(); this.h.travel(P); return; }
    if (a === 'mark') {
      if (s.kind === 'place') this.h.setWay({ id: s.P.id, name: s.P.name, x: s.P.x, z: s.P.z, r: Math.max(8, Math.min(s.P.r * 0.6, 20)) });
      else this.h.setWay({ id: null, name: '标记的地方', x: s.x, z: s.z, r: 8 });
      this.close(); return;
    }
    if (a === 'unmark') { this.h.setWay(null); this.select(null); }
  }

  // ---------- 画 ----------
  fog() {
    const E = this.h.explored; if (this.fogVer === E.ver) return;
    this.fogVer = E.ver;
    const N = E.N, M = E.M, f = new Float32Array(N * M);
    for (let i = 0; i < f.length; i++) f[i] = E.a[i];
    // 模糊两遍，边缘柔一点
    const t = new Float32Array(N * M);
    for (let it = 0; it < 2; it++) {
      for (let j = 0; j < M; j++) for (let i = 0; i < N; i++) { let s = 0, n = 0; for (let d = -1; d <= 1; d++) { const ii = i + d; if (ii >= 0 && ii < N) { s += f[j * N + ii]; n++; } } t[j * N + i] = s / n; }
      for (let j = 0; j < M; j++) for (let i = 0; i < N; i++) { let s = 0, n = 0; for (let d = -1; d <= 1; d++) { const jj = j + d; if (jj >= 0 && jj < M) { s += t[jj * N + i]; n++; } } f[j * N + i] = s / n; }
    }
    const g = this.fogCv.getContext('2d'), img = g.createImageData(N, M), D = img.data;
    for (let i = 0; i < N * M; i++) { D[i * 4] = PAPER[0]; D[i * 4 + 1] = PAPER[1]; D[i * 4 + 2] = PAPER[2]; D[i * 4 + 3] = (1 - Math.min(1, f[i] * 1.6)) * 255; }
    g.putImageData(img, 0, 0);
  }
  draw() {
    const g = this.ctx, W = this.W, H = this.H, v = this.view;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.fillStyle = '#d9c7a4'; g.fillRect(0, 0, W, H);
    const [L, T] = this.toScreen(DOM.x0, DOM.z0), MW = DOM.w * v.z, MH = DOM.d * v.z;
    // 纸的边和影子
    g.fillStyle = 'rgba(90, 60, 30, 0.18)'; g.fillRect(L + 3, T + 4, MW, MH);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(this.bake.cv, L, T, MW, MH);
    // 没去过的地方：先褪成灰（像铅笔底稿），再蒙一层薄薄的纸色
    this.fog();
    g.globalCompositeOperation = 'saturation'; g.globalAlpha = 0.88; g.drawImage(this.fogCv, L, T, MW, MH);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 0.5; g.drawImage(this.fogCv, L, T, MW, MH);
    g.globalAlpha = 1;
    g.strokeStyle = 'rgba(90, 60, 30, 0.55)'; g.lineWidth = 1.5; g.strokeRect(L + 0.5, T + 0.5, MW - 1, MH - 1);
    g.strokeStyle = 'rgba(90, 60, 30, 0.25)'; g.lineWidth = 1; g.strokeRect(L + 5.5, T + 5.5, MW - 11, MH - 11);
    const k = Math.min(1.4, Math.max(0.75, v.z / 1.1));
    // 小图标：风车、桥、叠水、营地、长椅
    for (const p of this.pois) this.icon(p, k);
    // 标记点和到那儿的虚线
    const me = this.h.player(), way = this.h.getWay();
    if (way) {
      const [ax, ay] = this.toScreen(me.x, me.z), [bx, by] = this.toScreen(way.x, way.z);
      g.save(); g.setLineDash([5, 6]); g.strokeStyle = 'rgba(176, 96, 40, 0.75)'; g.lineWidth = 2; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke(); g.restore();
    }
    // 风景点
    g.textAlign = 'center'; g.textBaseline = 'top';
    for (const P of this.h.places()) {
      if (P.x === undefined) continue;
      const [x, y] = this.toScreen(P.x, P.z);
      if (x < -60 || x > W + 60 || y < -40 || y > H + 40) continue;
      const on = this.sel?.kind === 'place' && this.sel.P.id === P.id, r = (on ? 7.5 : 5.5) * Math.min(1.2, k);
      if (P.kind === 'camp') this.campIcon(x, y, r * 1.25, P.seen, P.lit);
      else if (P.kind === 'mark' || P.kind === 'vista') this.glyph(x, y, r * 1.2, P.g, P.seen, P.kind === 'vista');
      else {
        g.beginPath(); g.arc(x, y, r + 2, 0, 6.283); g.fillStyle = 'rgba(255, 250, 238, 0.95)'; g.fill();
        g.beginPath(); g.arc(x, y, r, 0, 6.283);
        if (P.seen) { g.fillStyle = '#c4773a'; g.fill(); }
        else { g.lineWidth = 1.6; g.strokeStyle = INK; g.stroke(); g.beginPath(); g.arc(x, y, 1.6, 0, 6.283); g.fillStyle = INK; g.fill(); }
      }
      g.font = `${on ? 600 : 500} ${Math.round(12.5 * Math.min(1.15, k))}px "Songti SC", "STSong", "Noto Serif SC", serif`;
      g.lineJoin = 'round'; g.lineWidth = 3.5; g.strokeStyle = 'rgba(250, 243, 226, 0.92)';
      g.strokeText(P.name, x, y + r + 4);
      g.fillStyle = P.seen ? INK : 'rgba(74, 52, 36, 0.62)'; g.fillText(P.name, x, y + r + 4);
    }
    if (way) this.diamond(...this.toScreen(way.x, way.z), this.sel?.kind === 'way' ? 9 : 7);
    if (this.sel?.kind === 'pin') this.diamond(...this.toScreen(this.sel.x, this.sel.z), 7, true);
    // 坐骑（不在身边的时候）
    const mt = this.h.mountAt();
    if (mt) {
      const [x, y] = this.toScreen(mt.x, mt.z);
      g.beginPath(); g.arc(x, y, 5, 0, 6.283); g.fillStyle = '#8a5a32'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = '#fff6e6'; g.stroke();
      g.font = '500 11px -apple-system, "PingFang SC", sans-serif'; g.lineWidth = 3; g.strokeStyle = 'rgba(250, 243, 226, 0.9)';
      g.strokeText(mt.name, x, y + 8); g.fillStyle = '#6b4424'; g.fillText(mt.name, x, y + 8);
    }
    // 自己：一个箭头，指着走的方向
    {
      const [x, y] = this.toScreen(me.x, me.z), fx = Math.sin(me.yaw), fz = Math.cos(me.yaw), s = 9;
      g.beginPath(); g.arc(x, y, 16, 0, 6.283); g.fillStyle = 'rgba(210, 72, 47, 0.16)'; g.fill();
      g.save(); g.translate(x, y); g.rotate(Math.atan2(fz, fx) + Math.PI / 2);
      g.beginPath(); g.moveTo(0, -s * 1.25); g.lineTo(s * 0.85, s * 0.9); g.lineTo(0, s * 0.45); g.lineTo(-s * 0.85, s * 0.9); g.closePath();
      g.lineJoin = 'round'; g.lineWidth = 3; g.strokeStyle = '#fff8ee'; g.stroke(); g.fillStyle = '#d2482f'; g.fill();
      g.restore();
    }
    // 指北针和比例尺
    this.compass(W - 34, 92);
    const meters = v.z > 1.6 ? 50 : v.z > 0.7 ? 100 : 200, len = meters * v.z, bx = 16, by = H - 28;
    g.fillStyle = 'rgba(250, 243, 226, 0.85)'; g.fillRect(bx - 6, by - 16, len + 12, 26);
    g.strokeStyle = INK; g.lineWidth = 1.5; g.beginPath(); g.moveTo(bx, by - 4); g.lineTo(bx, by); g.lineTo(bx + len, by); g.lineTo(bx + len, by - 4); g.stroke();
    g.font = '500 11px -apple-system, "PingFang SC", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = INK;
    g.fillText(`${meters} 米`, bx + len / 2, by - 5);
  }
  // 见闻的记号：一个小圆牌子写一个字（鹿、狐、灯……）；观景点是一面小旗；还没见过的是虚线圈
  glyph(x, y, s, ch, seen, flag) {
    const g = this.ctx;
    g.beginPath(); g.arc(x, y, s + 2.5, 0, 6.283); g.fillStyle = seen ? '#fff6e4' : 'rgba(255, 250, 238, 0.85)'; g.fill();
    g.beginPath(); g.arc(x, y, s, 0, 6.283); g.lineWidth = 1.5; g.strokeStyle = seen ? '#a5602c' : INK;
    if (!seen) g.setLineDash([2.5, 2.5]); g.stroke(); g.setLineDash([]);
    if (flag) {
      g.beginPath(); g.moveTo(x - s * 0.35, y + s * 0.6); g.lineTo(x - s * 0.35, y - s * 0.65); g.lineWidth = 1.4; g.strokeStyle = INK; g.stroke();
      g.beginPath(); g.moveTo(x - s * 0.35, y - s * 0.65); g.quadraticCurveTo(x + s * 0.2, y - s * 0.75, x + s * 0.7, y - s * 0.25); g.quadraticCurveTo(x + s * 0.15, y - s * 0.2, x - s * 0.35, y - s * 0.1);
      g.fillStyle = seen ? '#c8462e' : 'rgba(74, 52, 36, 0.4)'; g.fill();
    } else {
      g.font = `600 ${Math.round(s * 1.15)}px "Songti SC", "STSong", "Noto Serif SC", serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = seen ? '#8a4c22' : 'rgba(74, 52, 36, 0.55)'; g.fillText(seen ? ch : '？', x, y + 0.5);
      g.textBaseline = 'top';
    }
  }
  // 营地：一个小帐篷；点过篝火的帐篷前有一团火
  campIcon(x, y, s, seen, lit) {
    const g = this.ctx;
    g.beginPath(); g.arc(x, y, s + 3, 0, 6.283); g.fillStyle = 'rgba(255, 250, 238, 0.95)'; g.fill();
    g.beginPath(); g.moveTo(x - s * 0.95, y + s * 0.62); g.lineTo(x, y - s * 0.85); g.lineTo(x + s * 0.95, y + s * 0.62); g.closePath();
    g.lineJoin = 'round'; g.lineWidth = 1.5; g.strokeStyle = INK;
    if (seen) { g.fillStyle = '#8f6a45'; g.fill(); } g.stroke();
    g.beginPath(); g.moveTo(x, y - s * 0.85); g.lineTo(x, y + s * 0.62); g.strokeStyle = seen ? '#f3e3c4' : INK; g.lineWidth = 1; g.stroke();
    if (lit) {
      const fx = x + s * 0.95, fy = y + s * 0.55;
      g.beginPath(); g.moveTo(fx, fy - s * 0.95); g.quadraticCurveTo(fx + s * 0.55, fy - s * 0.2, fx, fy + s * 0.1); g.quadraticCurveTo(fx - s * 0.55, fy - s * 0.2, fx, fy - s * 0.95);
      g.fillStyle = '#f08a2c'; g.fill(); g.lineWidth = 1; g.strokeStyle = '#fff8ee'; g.stroke();
    }
  }
  diamond(x, y, s, ghost) {
    const g = this.ctx;
    g.beginPath(); g.moveTo(x, y - s * 1.3); g.lineTo(x + s, y); g.lineTo(x, y + s * 1.3); g.lineTo(x - s, y); g.closePath();
    g.lineWidth = 2.5; g.strokeStyle = '#fff8ee'; g.stroke();
    g.fillStyle = ghost ? 'rgba(224, 168, 58, 0.6)' : '#e0a83a'; g.fill();
    g.lineWidth = 1; g.strokeStyle = 'rgba(74, 52, 36, 0.8)'; g.stroke();
  }
  compass(x, y) {
    const g = this.ctx;
    g.beginPath(); g.arc(x, y, 17, 0, 6.283); g.fillStyle = 'rgba(250, 243, 226, 0.85)'; g.fill(); g.lineWidth = 1; g.strokeStyle = 'rgba(74, 52, 36, 0.5)'; g.stroke();
    g.beginPath(); g.moveTo(x, y - 13); g.lineTo(x + 5, y); g.lineTo(x - 5, y); g.closePath(); g.fillStyle = '#c4573a'; g.fill();
    g.beginPath(); g.moveTo(x, y + 13); g.lineTo(x + 5, y); g.lineTo(x - 5, y); g.closePath(); g.fillStyle = 'rgba(74, 52, 36, 0.55)'; g.fill();
    g.font = '600 10px -apple-system, "PingFang SC", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = INK;
    g.fillText('北', x, y - 25);
  }
  icon(p, k) {
    const g = this.ctx, [x, y] = this.toScreen(p.x, p.z);
    if (x < -30 || x > this.W + 30 || y < -30 || y > this.H + 30) return;
    g.save(); g.translate(x, y); g.scale(k, k);
    g.lineCap = 'round'; g.lineJoin = 'round';
    if (p.k === 'mill') {
      g.fillStyle = '#efe2c4'; g.strokeStyle = '#5a3d26'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(-4, 6); g.lineTo(-2.6, -4); g.lineTo(2.6, -4); g.lineTo(4, 6); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(-9, -13); g.lineTo(9, 5); g.moveTo(9, -13); g.lineTo(-9, 5); g.stroke();
    } else if (p.k === 'bridge') {
      g.rotate(p.a); g.strokeStyle = '#6b4424'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(-6, -3.6); g.lineTo(6, -3.6); g.moveTo(-6, 3.6); g.lineTo(6, 3.6); g.stroke();
    } else if (p.k === 'falls') {
      g.rotate(p.a); g.strokeStyle = 'rgba(255, 255, 255, 0.95)'; g.lineWidth = 1.6;
      g.beginPath(); for (let i = -1; i <= 1; i++) { g.moveTo(i * 2.6 - 1.2, -4); g.lineTo(i * 2.6 + 1.2, 0); g.lineTo(i * 2.6 - 1.2, 4); } g.stroke();
    }
    g.restore();
  }
}
