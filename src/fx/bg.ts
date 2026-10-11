// 程序化背景：绘本剪纸风的分层风景。战斗背景 960×600；主城背景是竖版全景（makeHomeScenery）。
import { clamp, mulberry } from './util';

export type BgTheme = 'meadow' | 'street' | 'market' | 'redcliff' | 'forest' | 'mist' | 'palace';
export const BG_THEMES: BgTheme[] = ['meadow', 'street', 'market', 'redcliff', 'forest', 'mist', 'palace'];
/** 章节 → 场景 */
export const CHAPTER_THEME: Record<number, BgTheme> = { 1: 'street', 2: 'market', 3: 'redcliff', 4: 'forest', 5: 'mist', 6: 'palace' };

interface ThemeDef {
  sky: [string, string, string];
  sun: { x: number; y: number; r: number; c: string } | null;
  moon?: boolean;
  stars?: boolean;
  far: string; mid: string; near: string; ground: [string, string]; accent: string; cloud: string;
  haze: string; // 远景雾气色
}
const THEMES: Record<BgTheme, ThemeDef> = {
  meadow: { sky: ['#7cc6ee', '#bfe6f6', '#fff1cf'], sun: { x: 760, y: 120, r: 54, c: '#fff4b8' }, far: '#a9cdbf', mid: '#82b894', near: '#5f9e6a', ground: ['#8ec46a', '#6aa457'], accent: '#e6f5b8', cloud: '#ffffff', haze: '#fff6dc' },
  street: { sky: ['#5a4a8e', '#e08a6a', '#ffd9a0'], sun: { x: 250, y: 300, r: 66, c: '#ffe2a8' }, far: '#8a6a98', mid: '#6a5282', near: '#4a3a66', ground: ['#a98a62', '#7a6244'], accent: '#ffd48a', cloud: '#ffc2a0', haze: '#ffcfa0' },
  market: { sky: ['#78c2ec', '#bfe4f2', '#fff0cf'], sun: { x: 700, y: 110, r: 50, c: '#fff6c0' }, far: '#9cc6c0', mid: '#78b4a8', near: '#4f968c', ground: ['#c9b27a', '#a08a56'], accent: '#ffe9a8', cloud: '#ffffff', haze: '#f4f8e8' },
  redcliff: { sky: ['#32184a', '#c4463f', '#f6a060'], sun: { x: 480, y: 250, r: 70, c: '#ffd6a0' }, far: '#6a2f50', mid: '#4a2540', near: '#2c1830', ground: ['#5a2a38', '#2e1a2c'], accent: '#ffb070', cloud: '#e8785a', haze: '#ff9a6a' },
  forest: { sky: ['#7fd0a8', '#c8eab0', '#f6f2c0'], sun: { x: 690, y: 90, r: 44, c: '#fffbd0' }, far: '#6fae8c', mid: '#4f9470', near: '#2f6c50', ground: ['#9ab868', '#6f9248'], accent: '#e8f4a8', cloud: '#f4fff0', haze: '#dff6c8' },
  mist: { sky: ['#1c2a5e', '#6a7ec0', '#d6e8f6'], sun: null, moon: true, stars: true, far: '#8aa4d4', mid: '#6a88c0', near: '#4c6aa8', ground: ['#b6d4e8', '#8cb4d0'], accent: '#ffffff', cloud: '#f4f8ff', haze: '#cfe0ff' },
  palace: { sky: ['#2a1a5a', '#9a5aa8', '#ffc8b0'], sun: { x: 480, y: 250, r: 60, c: '#ffe0c0' }, stars: true, far: '#7a5a9e', mid: '#5c4282', near: '#3c2c64', ground: ['#d6b8c8', '#a88aa8'], accent: '#ffe6a0', cloud: '#ffd0e0', haze: '#ffb8c8' },
};

type Ctx2 = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

// ---------- 小工具 ----------
function glow(ctx: Ctx2, x: number, y: number, r: number, c: string, a = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, c); g.addColorStop(1, c.replace(/[\d.]+\)$/, '0)'));
  ctx.save(); ctx.globalAlpha = a; ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
}
function cloud(ctx: Ctx2, x: number, y: number, s: number, col: string, a = 0.85) {
  ctx.save(); ctx.fillStyle = col; ctx.globalAlpha = a;
  ctx.beginPath();
  for (const [dx, dy, r] of [[0, 0, 24], [26, -12, 30], [60, -4, 26], [88, 4, 20], [30, 10, 26], [62, 12, 22]] as [number, number, number][]) ctx.arc(x + dx * s, y + dy * s, r * s, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = a * 0.5; ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(x + 24 * s, y - 18 * s, 16 * s, 0, TAU); ctx.arc(x + 58 * s, y - 10 * s, 12 * s, 0, TAU); ctx.fill();
  ctx.restore();
}
function ridge(ctx: Ctx2, rnd: () => number, w: number, h: number, base: number, amp: number, col: string, step = 60, peaky = 0.5, haze?: string) {
  const g = ctx.createLinearGradient(0, base - amp, 0, base + 40);
  g.addColorStop(0, col); g.addColorStop(1, haze ?? col);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(-20, h); let x = -20; ctx.lineTo(x, base);
  while (x < w + 40) { x += step * (0.6 + rnd() * 0.8); ctx.quadraticCurveTo(x - step * 0.4, base - amp * (rnd() ** (1 - peaky)), x, base - amp * 0.3 * rnd()); }
  ctx.lineTo(w + 40, h); ctx.closePath(); ctx.fill();
}
function roundTree(ctx: Ctx2, x: number, y: number, s: number, leaf: string, trunk = '#6a4a30') {
  ctx.fillStyle = trunk; ctx.fillRect(x - 4 * s, y - 24 * s, 8 * s, 28 * s);
  for (const [dx, dy, r, k] of [[0, -50, 32, 0], [-22, -34, 24, -0.08], [22, -34, 24, 0.08], [0, -30, 26, 0.04]] as [number, number, number, number][]) {
    ctx.fillStyle = k < 0 ? shadeHex(leaf, 0.12) : k > 0.05 ? tintHex(leaf, 0.1) : leaf;
    ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.arc(x - 10 * s, y - 60 * s, 12 * s, 0, TAU); ctx.fill();
}
function pine(ctx: Ctx2, x: number, y: number, s: number, col: string) {
  ctx.fillStyle = '#6a4a30'; ctx.fillRect(x - 4 * s, y - 4 * s, 8 * s, 18 * s);
  for (let i = 0; i < 4; i++) { const yy = y - i * 22 * s; ctx.fillStyle = i % 2 ? shadeHex(col, 0.08) : col; ctx.beginPath(); ctx.moveTo(x - (34 - i * 6) * s, yy); ctx.lineTo(x, yy - 34 * s); ctx.lineTo(x + (34 - i * 6) * s, yy); ctx.closePath(); ctx.fill(); }
}
function house(ctx: Ctx2, x: number, y: number, s: number, wall: string, roof: string, lit = true, box = false) {
  const w = 70 * s, h = 46 * s;
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(x, y + 2, w * 0.62, 7 * s, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = wall; ctx.fillRect(x - w / 2, y - h, w, h);
  ctx.fillStyle = shadeHex(wall, 0.1); ctx.fillRect(x + w * 0.18, y - h, w * 0.32, h);
  if (box) { // 纸箱：胶带与折痕
    ctx.fillStyle = '#f3e2b4'; ctx.fillRect(x - 6 * s, y - h, 12 * s, h);
    ctx.strokeStyle = 'rgba(90,60,30,.4)'; ctx.lineWidth = 1.5 * s; ctx.strokeRect(x - w / 2, y - h, w, h);
  }
  ctx.fillStyle = roof;
  ctx.beginPath(); ctx.moveTo(x - w / 2 - 8 * s, y - h); ctx.quadraticCurveTo(x, y - h - 40 * s, x + w / 2 + 8 * s, y - h); ctx.lineTo(x + w / 2 + 2 * s, y - h + 8 * s); ctx.lineTo(x - w / 2 - 2 * s, y - h + 8 * s); ctx.closePath(); ctx.fill();
  const wx = x - w * 0.32, wy = y - h * 0.68;
  ctx.fillStyle = lit ? '#ffe39a' : '#5a6a80'; ctx.beginPath(); ctx.roundRect(wx, wy, 16 * s, 18 * s, 4 * s); ctx.fill();
  if (lit) glow(ctx, wx + 8 * s, wy + 9 * s, 34 * s, 'rgba(255,214,120,.7)', 0.7);
  ctx.fillStyle = shadeHex(roof, 0.25); ctx.beginPath(); ctx.roundRect(x + w * 0.04, y - h * 0.5, 14 * s, h * 0.5, [7 * s, 7 * s, 0, 0]); ctx.fill();
}
function lantern(ctx: Ctx2, x: number, y: number, s: number, col = '#ff6a4a') {
  ctx.strokeStyle = 'rgba(60,30,20,.7)'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(x, y - 24 * s); ctx.lineTo(x, y - 12 * s); ctx.stroke();
  ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y, 11 * s, 14 * s, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.ellipse(x - 3 * s, y - 4 * s, 3 * s, 6 * s, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#f0c75a'; ctx.fillRect(x - 5 * s, y - 15 * s, 10 * s, 3 * s); ctx.fillRect(x - 5 * s, y + 12 * s, 10 * s, 3 * s);
  glow(ctx, x, y, 40 * s, 'rgba(255,170,90,.8)', 0.6);
}
function stall(ctx: Ctx2, x: number, y: number, s: number, c1: string, c2: string) {
  ctx.fillStyle = '#7a5a38'; ctx.fillRect(x - 36 * s, y - 40 * s, 4 * s, 40 * s); ctx.fillRect(x + 32 * s, y - 40 * s, 4 * s, 40 * s);
  ctx.fillStyle = '#c99a62'; ctx.fillRect(x - 38 * s, y - 14 * s, 76 * s, 14 * s);
  for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? c1 : c2; ctx.beginPath(); ctx.moveTo(x - 42 * s + i * 14 * s, y - 56 * s); ctx.lineTo(x - 28 * s + i * 14 * s, y - 56 * s); ctx.lineTo(x - 30 * s + i * 14 * s, y - 40 * s); ctx.arc(x - 35 * s + i * 14 * s, y - 40 * s, 5 * s, 0, Math.PI); ctx.lineTo(x - 42 * s + i * 14 * s, y - 40 * s); ctx.closePath(); ctx.fill(); }
  // 小鱼干
  ctx.fillStyle = '#e8d6a0'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(x - 24 * s + i * 16 * s, y - 20 * s, 7 * s, 3 * s, 0.2, 0, TAU); ctx.fill(); }
}
function shadeHex(hex: string, k: number) { return mixHex(hex, '#000000', k); }
function tintHex(hex: string, k: number) { return mixHex(hex, '#ffffff', k); }
function mixHex(a: string, b: string, k: number) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const m = (s: number) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
  return `#${((m(16) << 16) | (m(8) << 8) | m(0)).toString(16).padStart(6, '0')}`;
}

function sky(ctx: Ctx2, T: ThemeDef, w: number, h: number, rnd: () => number, horizon: number) {
  const g = ctx.createLinearGradient(0, 0, 0, horizon);
  g.addColorStop(0, T.sky[0]); g.addColorStop(0.55, T.sky[1]); g.addColorStop(1, T.sky[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  if (T.stars) {
    for (let i = 0; i < 90; i++) { const x = rnd() * w, y = rnd() * horizon * 0.7; ctx.globalAlpha = 0.35 + rnd() * 0.6; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 0.8 + rnd() * 1.4, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  if (T.moon) {
    const mx = w * 0.78, my = horizon * 0.28;
    glow(ctx, mx, my, 150, 'rgba(220,235,255,.8)', 0.8);
    ctx.fillStyle = '#fbfdff'; ctx.beginPath(); ctx.arc(mx, my, 40, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(160,180,220,.35)'; for (const [dx, dy, r] of [[-12, -6, 8], [10, 8, 6], [4, -16, 5]] as [number, number, number][]) { ctx.beginPath(); ctx.arc(mx + dx, my + dy, r, 0, TAU); ctx.fill(); }
  }
  if (T.sun) {
    glow(ctx, T.sun.x, T.sun.y, T.sun.r * 4.2, hexA(T.sun.c, 0.75), 0.9);
    ctx.fillStyle = T.sun.c; ctx.beginPath(); ctx.arc(T.sun.x, T.sun.y, T.sun.r, 0, TAU); ctx.fill();
    // 光芒
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.1; ctx.fillStyle = T.sun.c;
    for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU + 0.2; ctx.beginPath(); ctx.moveTo(T.sun.x, T.sun.y); ctx.lineTo(T.sun.x + Math.cos(a - 0.05) * 900, T.sun.y + Math.sin(a - 0.05) * 900); ctx.lineTo(T.sun.x + Math.cos(a + 0.05) * 900, T.sun.y + Math.sin(a + 0.05) * 900); ctx.fill(); }
    ctx.restore();
  }
}
const hexA = (hex: string, a: number) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };

function grain(ctx: Ctx2, rnd: () => number, w: number, h: number, n: number) {
  ctx.save(); ctx.globalAlpha = 0.06;
  for (let i = 0; i < n; i++) { ctx.fillStyle = rnd() > 0.5 ? '#000' : '#fff'; ctx.fillRect(rnd() * w, rnd() * h, 1.2, 1.2); }
  ctx.restore();
}
function vignette(ctx: Ctx2, w: number, h: number, a = 0.28) {
  const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.95);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(20,10,30,${a})`);
  ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
}
function flowers(ctx: Ctx2, rnd: () => number, w: number, y0: number, y1: number, cols: string[], n = 60) {
  for (let i = 0; i < n; i++) {
    const x = rnd() * w, y = y0 + rnd() * (y1 - y0), k = (y - y0) / (y1 - y0), r = 2 + k * 3.2;
    ctx.fillStyle = cols[(rnd() * cols.length) | 0]; ctx.globalAlpha = 0.85;
    for (let p = 0; p < 5; p++) { ctx.beginPath(); ctx.arc(x + Math.cos((p / 5) * TAU) * r, y + Math.sin((p / 5) * TAU) * r * 0.7, r * 0.8, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#ffe9a0'; ctx.beginPath(); ctx.arc(x, y, r * 0.6, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function fireflies(ctx: Ctx2, rnd: () => number, w: number, y0: number, y1: number, n: number, col = 'rgba(255,240,150,.95)') {
  for (let i = 0; i < n; i++) glow(ctx, rnd() * w, y0 + rnd() * (y1 - y0), 6 + rnd() * 10, col, 0.9);
}
function birds(ctx: Ctx2, rnd: () => number, w: number, y0: number, y1: number, n: number, col: string) {
  ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) { const x = rnd() * w, y = y0 + rnd() * (y1 - y0), s = 6 + rnd() * 6; ctx.beginPath(); ctx.moveTo(x - s, y); ctx.quadraticCurveTo(x - s * 0.5, y - s * 0.6, x, y); ctx.quadraticCurveTo(x + s * 0.5, y - s * 0.6, x + s, y); ctx.stroke(); }
}

// ---------- 战斗背景 ----------
export function makeBackground(theme: BgTheme, w = 960, h = 600, dpr = 2, seed = 7): HTMLCanvasElement {
  const T = THEMES[theme];
  const c = document.createElement('canvas');
  c.width = w * dpr; c.height = h * dpr;
  const ctx = c.getContext('2d')!;
  ctx.scale(dpr, dpr);
  const rnd = mulberry(seed);
  sky(ctx, T, w, h, rnd, h * 0.62);
  // 云
  const cn = theme === 'mist' ? 4 : 7;
  for (let i = 0; i < cn; i++) cloud(ctx, rnd() * w, 40 + rnd() * 170, 0.7 + rnd() * 1.0, T.cloud, theme === 'mist' ? 0.5 : 0.85);
  if (theme === 'meadow' || theme === 'market' || theme === 'forest') birds(ctx, rnd, w, 70, 200, 5, 'rgba(60,70,90,.55)');
  // 远山 + 雾
  ridge(ctx, rnd, w, h, 330, 140, T.far, 90, 0.7, T.haze);
  glow(ctx, w * 0.5, 350, 520, hexA(T.haze, 0.5), 0.35);
  ridge(ctx, rnd, w, h, 360, 100, T.mid, 70, 0.6, T.haze);

  if (theme === 'redcliff') {
    const water = ctx.createLinearGradient(0, 340, 0, 430);
    water.addColorStop(0, '#d86a4a'); water.addColorStop(1, '#5a2a44');
    ctx.fillStyle = water; ctx.fillRect(0, 345, w, 90);
    ctx.strokeStyle = 'rgba(255,214,160,.4)'; ctx.lineWidth = 2;
    for (let i = 0; i < 40; i++) { const x = rnd() * w, y = 352 + rnd() * 70; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 20 + rnd() * 40, y); ctx.stroke(); }
    const ship = (x: number, y: number, s: number) => {
      ctx.fillStyle = '#2c1830';
      ctx.beginPath(); ctx.moveTo(x - 40 * s, y); ctx.lineTo(x + 40 * s, y); ctx.lineTo(x + 28 * s, y + 14 * s); ctx.lineTo(x - 30 * s, y + 14 * s); ctx.closePath(); ctx.fill();
      ctx.fillRect(x - 2 * s, y - 50 * s, 4 * s, 50 * s);
      ctx.beginPath(); ctx.moveTo(x + 2 * s, y - 48 * s); ctx.lineTo(x + 32 * s, y - 14 * s); ctx.lineTo(x + 2 * s, y - 12 * s); ctx.closePath(); ctx.fill();
      glow(ctx, x, y - 14 * s, 60 * s, 'rgba(255,170,70,.9)', 0.9);
      // 倒影
      ctx.save(); ctx.globalAlpha = 0.28; ctx.fillStyle = '#ffb070'; ctx.fillRect(x - 6 * s, y + 18 * s, 12 * s, 40 * s); ctx.restore();
    };
    ship(150, 372, 0.9); ship(330, 392, 1.1); ship(640, 380, 1); ship(820, 400, 1.2);
    // 火星
    for (let i = 0; i < 60; i++) glow(ctx, rnd() * w, 180 + rnd() * 240, 3 + rnd() * 5, 'rgba(255,200,110,.95)', 0.9);
  } else if (theme === 'mist') {
    for (const [x, y, s] of [[150, 250, 1], [700, 190, 1.35], [880, 300, 0.8], [440, 150, 0.6]] as [number, number, number][]) {
      ctx.fillStyle = T.near; ctx.beginPath(); ctx.moveTo(x - 76 * s, y); ctx.quadraticCurveTo(x, y + 96 * s, x + 76 * s, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#9ee0b0'; ctx.beginPath(); ctx.ellipse(x, y, 76 * s, 15 * s, 0, 0, TAU); ctx.fill();
      // 瀑布
      ctx.fillStyle = 'rgba(255,255,255,.65)'; ctx.fillRect(x + 22 * s, y + 8 * s, 8 * s, 70 * s);
      // 小塔
      ctx.fillStyle = '#e8c15a'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x - (16 - i * 3) * s, y - i * 16 * s - 2); ctx.lineTo(x, y - i * 16 * s - 18 * s); ctx.lineTo(x + (16 - i * 3) * s, y - i * 16 * s - 2); ctx.closePath(); ctx.fill(); }
      glow(ctx, x, y - 20 * s, 50 * s, 'rgba(255,240,170,.7)', 0.6);
    }
    fireflies(ctx, rnd, w, 120, 360, 26, 'rgba(210,235,255,.95)');
  } else if (theme === 'forest') {
    // 巨叶、藤蔓、图腾柱
    for (let i = 0; i < 7; i++) { const x = rnd() * w; pine(ctx, x, 372 + rnd() * 10, 1.1 + rnd() * 0.6, T.near); }
    const bigLeaf = (x: number, y: number, s: number, a: number) => { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = '#3f8a58'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(30 * s, -30 * s, 80 * s, -20 * s, 110 * s, 10 * s); ctx.bezierCurveTo(70 * s, 30 * s, 20 * s, 20 * s, 0, 0); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(100 * s, 8 * s); ctx.stroke(); ctx.restore(); };
    bigLeaf(0, 120, 1.6, 0.3); bigLeaf(w, 90, 1.6, Math.PI - 0.3); bigLeaf(40, 40, 1.2, 0.6); bigLeaf(w - 30, 30, 1.2, Math.PI - 0.6);
    ctx.strokeStyle = '#2f6c50'; ctx.lineWidth = 3; for (let i = 0; i < 9; i++) { const x = rnd() * w; ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x + 20, 90, x - 20, 150, x + 6, 200 + rnd() * 80); ctx.stroke(); }
    // 图腾柱
    for (const x of [120, 840]) { ctx.fillStyle = '#8a5a30'; ctx.fillRect(x - 14, 300, 28, 92); ctx.fillStyle = '#e0902c'; ctx.fillRect(x - 14, 316, 28, 10); ctx.fillStyle = '#f4ead0'; ctx.beginPath(); ctx.arc(x, 312, 10, 0, TAU); ctx.fill(); ctx.fillStyle = '#2a1a10'; ctx.fillRect(x - 5, 308, 3, 4); ctx.fillRect(x + 2, 308, 3, 4); glow(ctx, x, 330, 50, 'rgba(255,200,90,.7)', 0.5); }
    fireflies(ctx, rnd, w, 200, 420, 30);
  } else if (theme === 'street') {
    // 纸箱街：暮色屋顶与灯笼
    for (let i = 0; i < 6; i++) house(ctx, 60 + i * 160 + rnd() * 30, 372 + rnd() * 6, 0.9 + rnd() * 0.5, i % 2 ? '#c99a62' : '#b8884e', i % 3 ? '#8a4a4a' : '#4a6a8a', true, true);
    ctx.strokeStyle = 'rgba(40,20,30,.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 210); ctx.quadraticCurveTo(w / 2, 280, w, 200); ctx.stroke();
    for (let i = 0; i < 9; i++) { const t = (i + 0.5) / 9; lantern(ctx, t * w, 232 + Math.sin(t * Math.PI) * 44, 0.9, i % 2 ? '#ff6a4a' : '#ffb04a'); }
    birds(ctx, rnd, w, 80, 190, 4, 'rgba(60,40,70,.6)');
  } else if (theme === 'market') {
    // 官渡鱼市：摊位、旗幡、木桥与河
    const river = ctx.createLinearGradient(0, 340, 0, 400);
    river.addColorStop(0, '#9fd8e8'); river.addColorStop(1, '#5fa8c0');
    ctx.fillStyle = river; ctx.fillRect(0, 346, w, 56);
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2; for (let i = 0; i < 24; i++) { const x = rnd() * w, y = 352 + rnd() * 44; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 14 + rnd() * 26, y); ctx.stroke(); }
    ctx.fillStyle = '#9a6a3c'; ctx.beginPath(); ctx.moveTo(300, 352); ctx.quadraticCurveTo(480, 310, 660, 352); ctx.lineTo(660, 362); ctx.quadraticCurveTo(480, 322, 300, 362); ctx.closePath(); ctx.fill();
    for (const x of [340, 420, 540, 620]) ctx.fillRect(x, 340, 5, 36);
    stall(ctx, 110, 380, 1.0, '#e0705a', '#fff3d6'); stall(ctx, 220, 384, 0.9, '#5a9ad0', '#fff3d6'); stall(ctx, 760, 382, 1.0, '#e0b040', '#fff3d6'); stall(ctx, 870, 386, 0.9, '#7ac070', '#fff3d6');
    for (const [x, y] of [[40, 260], [920, 250]] as [number, number][]) { ctx.fillStyle = '#7a5a38'; ctx.fillRect(x - 3, y, 6, 130); ctx.fillStyle = '#e0505a'; ctx.beginPath(); ctx.moveTo(x + 3, y + 4); ctx.lineTo(x + 56, y + 14); ctx.lineTo(x + 3, y + 54); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#fff3d6'; ctx.font = '700 20px sans-serif'; ctx.fillText('鱼', x + 14, y + 36); }
    birds(ctx, rnd, w, 70, 200, 6, 'rgba(60,80,100,.55)');
  } else if (theme === 'palace') {
    // 九命殿：远处殿宇、立柱、月光灯海
    const hall = (x: number, y: number, s: number) => { ctx.fillStyle = '#4a3470'; ctx.fillRect(x - 90 * s, y - 70 * s, 180 * s, 70 * s); ctx.fillStyle = '#d8b84a'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x - (110 - i * 18) * s, y - 70 * s - i * 34 * s); ctx.quadraticCurveTo(x, y - (110 + i * 34) * s, x + (110 - i * 18) * s, y - 70 * s - i * 34 * s); ctx.lineTo(x + (96 - i * 18) * s, y - 62 * s - i * 34 * s); ctx.quadraticCurveTo(x, y - (96 + i * 34) * s, x - (96 - i * 18) * s, y - 62 * s - i * 34 * s); ctx.closePath(); ctx.fill(); } for (let i = -2; i <= 2; i++) { ctx.fillStyle = '#e8c15a'; ctx.fillRect(x + i * 32 * s - 5 * s, y - 66 * s, 10 * s, 66 * s); } glow(ctx, x, y - 30 * s, 110 * s, 'rgba(255,220,150,.7)', 0.7); };
    hall(480, 380, 1.5); hall(170, 384, 0.9); hall(790, 384, 0.9);
    for (let i = 0; i < 18; i++) lantern(ctx, 30 + i * 53, 150 + ((i * 37) % 70), 0.7 + (i % 3) * 0.12, i % 2 ? '#ff7a8a' : '#ffd24a');
    for (let i = 0; i < 30; i++) glow(ctx, rnd() * w, 100 + rnd() * 300, 5 + rnd() * 6, 'rgba(255,230,170,.95)', 0.8);
  } else {
    // meadow：圆树、花、小屋、风车
    for (let i = 0; i < 8; i++) roundTree(ctx, rnd() * w, 376 + rnd() * 8, 0.8 + rnd() * 0.5, i % 2 ? '#6cae6a' : '#5a9a5e');
    house(ctx, 140, 380, 1.2, '#f2dcb0', '#c25a4a'); house(ctx, 800, 382, 1.1, '#f6e8c8', '#4a7aa8');
  }
  ridge(ctx, rnd, w, h, 392, 36, T.near, 50, 0.4);

  // 地面
  const gnd = ctx.createLinearGradient(0, 380, 0, h);
  gnd.addColorStop(0, T.ground[0]); gnd.addColorStop(1, T.ground[1]);
  ctx.fillStyle = gnd;
  ctx.beginPath(); ctx.moveTo(0, 392);
  for (let x = 0; x <= w; x += 40) ctx.lineTo(x, 388 + Math.sin(x * 0.02) * 4 + rnd() * 4);
  ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
  // 地面细节：草笔触 / 石板
  ctx.lineCap = 'round';
  const stone = theme === 'street' || theme === 'market' || theme === 'palace';
  for (let i = 0; i < 260; i++) {
    const x = rnd() * w, y = 400 + rnd() * 200, k = (y - 400) / 200;
    if (stone && i % 3 === 0) { ctx.fillStyle = `rgba(255,255,255,${0.06 + k * 0.06})`; ctx.beginPath(); ctx.roundRect(x, y, 26 + k * 30, 10 + k * 10, 4); ctx.fill(); continue; }
    ctx.strokeStyle = rnd() > 0.5 ? T.accent : T.near;
    ctx.globalAlpha = 0.16 + k * 0.25; ctx.lineWidth = 1.5 + k * 2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rnd() - 0.5) * 8, y - 6 - k * 10); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (theme === 'meadow' || theme === 'forest') flowers(ctx, rnd, w, 410, 590, theme === 'forest' ? ['#ffd24a', '#ff9ac0', '#ffffff'] : ['#ff9ac0', '#ffd24a', '#ffffff', '#9ad0ff']);
  if (theme === 'mist' || theme === 'palace') { for (let i = 0; i < 8; i++) cloud(ctx, rnd() * w, 440 + rnd() * 140, 1.4 + rnd(), 'rgba(255,255,255,1)', 0.18); }
  // 前景光斑
  glow(ctx, w * 0.5, 470, 420, hexA(T.haze, 0.35), 0.28);
  // 战场圆形地毯（站位提示）
  ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.beginPath(); ctx.ellipse(w / 2, 500, 420, 90, 0, 0, TAU); ctx.fill();
  grain(ctx, rnd, w, h, 5200);
  vignette(ctx, w, h, theme === 'redcliff' || theme === 'palace' || theme === 'mist' ? 0.36 : 0.26);
  return c;
}

// ---------- 主城竖版全景（给 .app 当背景）----------
let homeUrl = '';
export function makeHomeScenery(): string {
  if (homeUrl) return homeUrl;
  const w = 540, h = 1170;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  const rnd = mulberry(20260711);
  const T: ThemeDef = { sky: ['#6fc2ee', '#bfe6f6', '#fff0d0'], sun: { x: 420, y: 150, r: 52, c: '#fff4b8' }, far: '#a9cdbf', mid: '#86bc96', near: '#64a26c', ground: ['#9ccd74', '#6fae5c'], accent: '#e6f5b8', cloud: '#ffffff', haze: '#fff6dc' };
  sky(ctx, T, w, h, rnd, h * 0.5);
  for (let i = 0; i < 9; i++) cloud(ctx, rnd() * w, 50 + rnd() * 380, 0.8 + rnd() * 1.1, '#ffffff', 0.8);
  birds(ctx, rnd, w, 90, 330, 6, 'rgba(60,80,100,.5)');
  // 远处漂浮仙岛 + 城堡
  const isle = (x: number, y: number, s: number) => { ctx.fillStyle = '#7fae90'; ctx.beginPath(); ctx.moveTo(x - 60 * s, y); ctx.quadraticCurveTo(x, y + 70 * s, x + 60 * s, y); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#9ed8a4'; ctx.beginPath(); ctx.ellipse(x, y, 60 * s, 12 * s, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#f4d8a0'; ctx.fillRect(x - 12 * s, y - 34 * s, 24 * s, 34 * s); ctx.fillStyle = '#d65a5a'; ctx.beginPath(); ctx.moveTo(x - 18 * s, y - 34 * s); ctx.lineTo(x, y - 62 * s); ctx.lineTo(x + 18 * s, y - 34 * s); ctx.closePath(); ctx.fill(); };
  isle(120, 300, 1); isle(430, 380, 0.7);
  ridge(ctx, rnd, w, h, 520, 150, '#a6cdbe', 80, 0.7, '#fff6dc');
  glow(ctx, w / 2, 520, 420, 'rgba(255,246,220,.7)', 0.5);
  ridge(ctx, rnd, w, h, 580, 110, '#86bc96', 60, 0.6, '#fff6dc');
  // 猫之村：纸箱屋与灯笼
  const rows: [number, number, number][] = [[80, 640, 0.9], [200, 650, 1.1], [330, 640, 0.95], [450, 652, 1.15], [140, 700, 1.2], [300, 706, 1.3], [430, 712, 1.0]];
  for (const [x, y, s] of rows) house(ctx, x, y, s, rnd() > 0.5 ? '#c99a62' : '#d6aa72', rnd() > 0.5 ? '#c25a4a' : '#4a7aa8', true, rnd() > 0.4);
  for (let i = 0; i < 6; i++) lantern(ctx, 40 + i * 92, 690 + Math.sin(i) * 14, 0.8, i % 2 ? '#ff6a4a' : '#ffb04a');
  for (let i = 0; i < 10; i++) roundTree(ctx, rnd() * w, 720 + rnd() * 20, 0.9 + rnd() * 0.6, i % 2 ? '#6cae6a' : '#5a9a5e');
  ridge(ctx, rnd, w, h, 760, 40, '#64a26c', 50, 0.4);
  // 草地
  const gnd = ctx.createLinearGradient(0, 740, 0, h);
  gnd.addColorStop(0, T.ground[0]); gnd.addColorStop(1, T.ground[1]);
  ctx.fillStyle = gnd; ctx.beginPath(); ctx.moveTo(0, 760);
  for (let x = 0; x <= w; x += 36) ctx.lineTo(x, 754 + Math.sin(x * 0.03) * 6);
  ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
  // 蜿蜒小路
  ctx.fillStyle = 'rgba(244,224,176,.85)'; ctx.beginPath(); ctx.moveTo(250, 760); ctx.bezierCurveTo(200, 860, 360, 940, 280, h); ctx.lineTo(420, h); ctx.bezierCurveTo(480, 930, 330, 850, 300, 760); ctx.closePath(); ctx.fill();
  ctx.lineCap = 'round';
  for (let i = 0; i < 420; i++) { const x = rnd() * w, y = 770 + rnd() * 400, k = (y - 770) / 400; ctx.strokeStyle = rnd() > 0.5 ? T.accent : T.near; ctx.globalAlpha = 0.14 + k * 0.22; ctx.lineWidth = 1.5 + k * 2.2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rnd() - 0.5) * 8, y - 6 - k * 10); ctx.stroke(); }
  ctx.globalAlpha = 1;
  flowers(ctx, rnd, w, 790, 1160, ['#ff9ac0', '#ffd24a', '#ffffff', '#9ad0ff'], 90);
  glow(ctx, w * 0.5, 900, 480, 'rgba(255,246,220,.5)', 0.25);
  grain(ctx, rnd, w, h, 9000);
  vignette(ctx, w, h, 0.18);
  homeUrl = c.toDataURL('image/jpeg', 0.82);
  void clamp;
  return homeUrl;
}
