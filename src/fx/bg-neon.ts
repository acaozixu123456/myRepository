// 赛博朋克雨夜背景（战斗用，960×600）：分层的巨型都市、全息广告、霓虹招牌、空中走廊、湿地面倒影、雨丝。
import { mulberry } from './util';

type C = CanvasRenderingContext2D;
const NEON = ['#ff2ea8', '#7ff0ff', '#9a7aff', '#ffe27a', '#ff5a5a', '#4fe08a'];

function glow(g: C, x: number, y: number, r: number, c: string, a = 1) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.save(); g.globalAlpha = a; g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); g.restore();
}
function towers(g: C, rnd: () => number, w: number, base: number, hMin: number, hMax: number, col: string, win: number, lit: string[], wMin = 36, wMax = 90) {
  let x = -20;
  while (x < w + 20) {
    const tw = wMin + rnd() * (wMax - wMin), th = hMin + rnd() * (hMax - hMin);
    const grad = g.createLinearGradient(0, base - th, 0, base);
    grad.addColorStop(0, col); grad.addColorStop(1, '#0a0618');
    g.fillStyle = grad; g.fillRect(x, base - th, tw, th);
    // 顶部结构
    if (rnd() < 0.5) { g.fillRect(x + tw * 0.3, base - th - 14 - rnd() * 24, tw * 0.4, 20); g.fillRect(x + tw * 0.48, base - th - 50 - rnd() * 30, 2, 40); g.fillStyle = '#ff3a3a'; g.fillRect(x + tw * 0.48 - 1, base - th - 54, 4, 4); }
    // 亮着的窗
    for (let wy = base - th + 8; wy < base - 6; wy += 9) for (let wx = x + 5; wx < x + tw - 6; wx += 8) if (rnd() < win) { g.fillStyle = lit[Math.floor(rnd() * lit.length)]; g.globalAlpha = 0.25 + rnd() * 0.6; g.fillRect(wx, wy, 4, 5); }
    g.globalAlpha = 1;
    // 侧边霓虹描边
    if (rnd() < 0.3) { g.fillStyle = NEON[Math.floor(rnd() * NEON.length)]; g.globalAlpha = 0.8; g.fillRect(x + tw - 2, base - th, 2, th); g.globalAlpha = 1; }
    x += tw + rnd() * 6;
  }
}
function sign(g: C, x: number, y: number, text: string, col: string, size = 34, vertical = false) {
  g.save();
  g.font = `900 ${size}px "Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = col; g.shadowBlur = 22; g.fillStyle = '#fff';
  if (vertical) [...text].forEach((ch, i) => g.fillText(ch, x, y + i * size * 1.05));
  else g.fillText(text, x, y);
  g.globalAlpha = 0.6; g.fillStyle = col; if (vertical) [...text].forEach((ch, i) => g.fillText(ch, x, y + i * size * 1.05)); else g.fillText(text, x, y);
  g.restore();
}

export function makeNeonBackground(w = 960, h = 600, dpr = 2, seed = 7): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w * dpr; c.height = h * dpr;
  const g = c.getContext('2d')!;
  g.scale(dpr, dpr);
  const rnd = mulberry(seed);
  const horizon = 392;
  // 天空
  const sky = g.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#07041a'); sky.addColorStop(0.5, '#1c0c42'); sky.addColorStop(0.85, '#5a1a62'); sky.addColorStop(1, '#a8307a');
  g.fillStyle = sky; g.fillRect(0, 0, w, horizon + 4);
  g.fillStyle = '#fff'; for (let i = 0; i < 60; i++) { g.globalAlpha = 0.15 + rnd() * 0.5; g.fillRect(rnd() * w, rnd() * 160, 1.4, 1.4); } g.globalAlpha = 1;
  glow(g, w * 0.5, horizon - 20, 520, 'rgba(255,60,170,.55)', 0.7);
  glow(g, w * 0.12, horizon - 60, 300, 'rgba(60,220,255,.4)', 0.7);
  // 远景塔楼（三层，越近越暗越高）
  towers(g, rnd, w, horizon, 120, 330, '#2c1a5a', 0.3, ['#ffe27a', '#7ff0ff', '#ff7ad9'], 30, 70);
  glow(g, w * 0.5, horizon - 80, 420, 'rgba(140,60,200,.5)', 0.5);
  towers(g, rnd, w, horizon + 6, 170, 380, '#1c1042', 0.38, ['#ffe27a', '#7ff0ff', '#ff7ad9', '#9aa8ff'], 44, 96);
  // 全息广告牌（巨大竖幅）
  for (const [x, col] of [[120, '#ff2ea8'], [560, '#7ff0ff'], [820, '#9a7aff']] as [number, string][]) {
    const bh = 210 + rnd() * 60, by = horizon - bh - 30;
    const gr = g.createLinearGradient(0, by, 0, by + bh); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(10,6,30,.9)');
    g.save(); g.globalAlpha = 0.85; g.fillStyle = gr; g.fillRect(x - 38, by, 76, bh); g.restore();
    glow(g, x, by + bh * 0.4, 150, col, 0.55);
    sign(g, x, by + 44, '更好', '#fff', 30); sign(g, x, by + 82, '更快', '#fff', 30); sign(g, x, by + 120, '更近', '#fff', 30);
  }
  // 空中走廊
  const sy = horizon - 120;
  g.fillStyle = '#120a2c'; g.fillRect(0, sy, w, 16);
  g.fillStyle = '#7ff0ff'; g.globalAlpha = 0.9; g.fillRect(0, sy + 3, w, 2); g.globalAlpha = 1;
  g.fillStyle = '#ff2ea8'; for (let x = 20; x < w; x += 70) g.fillRect(x, sy + 9, 30, 2);
  for (let i = 0; i < 7; i++) { const x = rnd() * w; glow(g, x, sy - 8, 20, rnd() < 0.5 ? '#fff6c0' : '#ff6a6a', 0.9); g.fillStyle = '#05030c'; g.fillRect(x - 10, sy - 8, 20, 6); }
  // 近景楼群（霓虹招牌）
  towers(g, rnd, w, horizon + 14, 90, 210, '#0e0828', 0.2, ['#ffd27a', '#7ff0ff'], 70, 140);
  const signs: [number, number, string, string, number, boolean][] = [[70, 300, '酒', '#ff2ea8', 38, true], [250, 330, '当铺', '#7ff0ff', 30, false], [430, 310, '喵', '#ffe27a', 44, true], [690, 335, '拉面', '#ff7ad9', 32, false], [880, 300, '网咖', '#9a7aff', 34, true]];
  for (const [x, y, t, col, sz, v] of signs) { glow(g, x, y + (v ? 30 : 0), 90, col, 0.7); sign(g, x, y, t, col, sz, v); }
  // 雾带
  for (const [y, a] of [[300, 0.22], [350, 0.26], [388, 0.3]] as [number, number][]) { const f = g.createLinearGradient(0, y - 40, 0, y + 40); f.addColorStop(0, 'rgba(140,60,190,0)'); f.addColorStop(0.5, `rgba(150,70,200,${a})`); f.addColorStop(1, 'rgba(140,60,190,0)'); g.fillStyle = f; g.fillRect(0, y - 40, w, 80); }
  // 地面：湿沥青
  const gnd = g.createLinearGradient(0, horizon, 0, h);
  gnd.addColorStop(0, '#1a0f36'); gnd.addColorStop(0.4, '#0f0a22'); gnd.addColorStop(1, '#07040f');
  g.fillStyle = gnd; g.fillRect(0, horizon, w, h - horizon);
  // 倒影：把水平线以上的亮色竖着拉成条纹
  g.save();
  g.beginPath(); g.rect(0, horizon, w, h - horizon); g.clip();
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 90; i++) {
    const x = rnd() * w, col = NEON[Math.floor(rnd() * NEON.length)], len = 40 + rnd() * 140, ww = 3 + rnd() * 10;
    const gr = g.createLinearGradient(0, horizon, 0, horizon + len); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.16 + rnd() * 0.26; g.fillStyle = gr; g.fillRect(x, horizon, ww, len);
  }
  g.restore();
  // 水洼高光
  for (let i = 0; i < 9; i++) { const x = rnd() * w, y = horizon + 30 + rnd() * 170, rx = 50 + rnd() * 110; const gr = g.createRadialGradient(x, y, 2, x, y, rx); const col = NEON[Math.floor(rnd() * NEON.length)]; gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.22; g.translate(0, y); g.scale(1, 0.18); g.translate(0, -y); g.fillStyle = gr; g.fillRect(x - rx, y - rx, rx * 2, rx * 2); g.restore(); }
  // 透视路标（虚线）
  g.fillStyle = 'rgba(255,230,170,.35)';
  for (let k = 0; k < 7; k++) { const t = k / 7, y = horizon + 10 + t * t * 200, ww = 6 + t * 36, hh = 2 + t * 8; g.fillRect(w / 2 - ww / 2, y, ww, hh); }
  // 雨
  g.strokeStyle = 'rgba(170,200,255,.28)'; g.lineWidth = 1;
  for (let i = 0; i < 220; i++) { const x = rnd() * w, y = rnd() * h, l = 8 + rnd() * 14; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 2.5, y + l); g.stroke(); }
  // 颗粒 + 暗角
  g.globalAlpha = 0.05; for (let i = 0; i < 5200; i++) { g.fillStyle = rnd() < 0.5 ? '#fff' : '#000'; g.fillRect(rnd() * w, rnd() * h, 1.2, 1.2); } g.globalAlpha = 1;
  const v = g.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.95); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.5)'); g.fillStyle = v; g.fillRect(0, 0, w, h);
  return c;
}
