// 赛博朋克雨夜背景（战斗用，960×600）：分层的巨型都市、全息广告、霓虹招牌、空中走廊、湿地面倒影、雨丝。
import { mulberry } from './util';

type C = CanvasRenderingContext2D;
export interface NeonPalette { sky: [string, string, string, string]; glowA: string; glowB: string; tower: [string, string]; neon: string[]; windows: string[]; signs: [string, string][]; ground: [string, string, string] }
export const NEON_PALETTES: Record<string, NeonPalette> = {
  neon: { sky: ['#07041a', '#1c0c42', '#5a1a62', '#a8307a'], glowA: 'rgba(255,60,170,.55)', glowB: 'rgba(60,220,255,.4)', tower: ['#2c1a5a', '#1c1042'], neon: ['#ff2ea8', '#7ff0ff', '#9a7aff', '#ffe27a', '#ff5a5a', '#4fe08a'], windows: ['#ffe27a', '#7ff0ff', '#ff7ad9', '#9aa8ff'], signs: [['酒', '#ff2ea8'], ['当铺', '#7ff0ff'], ['喵', '#ffe27a'], ['拉面', '#ff7ad9'], ['网咖', '#9a7aff']], ground: ['#1a0f36', '#0f0a22', '#07040f'] },
  neon2: { sky: ['#12040a', '#3a0e18', '#8a2a20', '#e8782a'], glowA: 'rgba(255,140,40,.55)', glowB: 'rgba(255,60,60,.4)', tower: ['#3a1618', '#26100f'], neon: ['#ff7a2e', '#ff3a3a', '#ffd24a', '#ff2ea8', '#ffb03a'], windows: ['#ffd27a', '#ff9a4a', '#ffe9b0'], signs: [['夜市', '#ff3a3a'], ['烧烤', '#ff7a2e'], ['章鱼烧', '#ffd24a'], ['糖水', '#ff7ad9'], ['鱼', '#ffb03a']], ground: ['#2a1210', '#180a0a', '#0a0405'] },
  neon3: { sky: ['#12030a', '#4a0c1c', '#a82a2a', '#ff7a3a'], glowA: 'rgba(255,90,40,.6)', glowB: 'rgba(255,200,80,.4)', tower: ['#3a1018', '#220a10'], neon: ['#ff5a3a', '#ffb040', '#ff2e5a', '#ffe27a'], windows: ['#ffb040', '#ff7a3a', '#ffe27a'], signs: [['港', '#ff5a3a'], ['船', '#ffb040'], ['火', '#ff2e5a'], ['码头', '#ffe27a'], ['赤壁', '#ff7a3a']], ground: ['#2a0e14', '#160810', '#08040a'] },
  neon4: { sky: ['#020a0c', '#0a2a24', '#1a6a48', '#6ae0a0'], glowA: 'rgba(80,255,170,.5)', glowB: 'rgba(120,240,255,.4)', tower: ['#0e3a30', '#08261f'], neon: ['#4fe08a', '#7ff0ff', '#b0ff6a', '#ffe27a'], windows: ['#b0ff6a', '#7ff0ff', '#ffe27a'], signs: [['林', '#4fe08a'], ['菇', '#b0ff6a'], ['茶', '#7ff0ff'], ['泉', '#ffe27a'], ['藤', '#4fe08a']], ground: ['#0c2a22', '#071a15', '#030c0a'] },
  neon5: { sky: ['#040818', '#14246a', '#4a6ac0', '#c0d8ff'], glowA: 'rgba(150,190,255,.55)', glowB: 'rgba(200,160,255,.4)', tower: ['#1c2a6a', '#101a48'], neon: ['#9ab8ff', '#7ff0ff', '#e0e8ff', '#c08aff'], windows: ['#e0e8ff', '#7ff0ff', '#c08aff'], signs: [['云', '#9ab8ff'], ['雾', '#e0e8ff'], ['岛', '#7ff0ff'], ['星', '#c08aff'], ['风', '#9ab8ff']], ground: ['#18224a', '#0e1530', '#060a1a'] },
  neon6: { sky: ['#0a0418', '#2a1060', '#8a3aa8', '#ffb86a'], glowA: 'rgba(255,200,90,.55)', glowB: 'rgba(255,100,220,.45)', tower: ['#3a1a5a', '#241040'], neon: ['#ffd24a', '#ff7ad9', '#c08aff', '#ff5a5a'], windows: ['#ffd24a', '#ff7ad9', '#ffe9b0'], signs: [['宫', '#ffd24a'], ['殿', '#ff7ad9'], ['九命', '#c08aff'], ['御', '#ff5a5a'], ['金', '#ffd24a']], ground: ['#24123a', '#150a26', '#08040f'] },
};
let NEON = NEON_PALETTES.neon.neon;

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

export function makeNeonBackground(w = 960, h = 600, dpr = 2, seed = 7, pal: NeonPalette = NEON_PALETTES.neon): HTMLCanvasElement {
  NEON = pal.neon;
  const c = document.createElement('canvas');
  c.width = w * dpr; c.height = h * dpr;
  const g = c.getContext('2d')!;
  g.scale(dpr, dpr);
  const rnd = mulberry(seed);
  const horizon = 392;
  // 天空
  const sky = g.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, pal.sky[0]); sky.addColorStop(0.5, pal.sky[1]); sky.addColorStop(0.85, pal.sky[2]); sky.addColorStop(1, pal.sky[3]);
  g.fillStyle = sky; g.fillRect(0, 0, w, horizon + 4);
  g.fillStyle = '#fff'; for (let i = 0; i < 60; i++) { g.globalAlpha = 0.15 + rnd() * 0.5; g.fillRect(rnd() * w, rnd() * 160, 1.4, 1.4); } g.globalAlpha = 1;
  glow(g, w * 0.5, horizon - 20, 520, pal.glowA, 0.7);
  glow(g, w * 0.12, horizon - 60, 300, pal.glowB, 0.7);
  // 远景塔楼（三层，越近越暗越高）
  towers(g, rnd, w, horizon, 120, 330, pal.tower[0], 0.3, pal.windows, 30, 70);
  glow(g, w * 0.5, horizon - 80, 420, 'rgba(140,60,200,.5)', 0.5);
  towers(g, rnd, w, horizon + 6, 170, 380, pal.tower[1], 0.38, pal.windows, 44, 96);
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
  const sp: [number, number, number, boolean][] = [[70, 300, 38, true], [250, 330, 30, false], [430, 310, 44, true], [690, 335, 32, false], [880, 300, 34, true]];
  const signs: [number, number, string, string, number, boolean][] = sp.map(([x, y, sz, v], i) => [x, y, pal.signs[i][0], pal.signs[i][1], sz, v]);
  for (const [x, y, t, col, sz, v] of signs) { glow(g, x, y + (v ? 30 : 0), 90, col, 0.7); sign(g, x, y, t, col, sz, v); }
  // 雾带
  for (const [y, a] of [[300, 0.22], [350, 0.26], [388, 0.3]] as [number, number][]) { const f = g.createLinearGradient(0, y - 40, 0, y + 40); f.addColorStop(0, 'rgba(140,60,190,0)'); f.addColorStop(0.5, `rgba(150,70,200,${a})`); f.addColorStop(1, 'rgba(140,60,190,0)'); g.fillStyle = f; g.fillRect(0, y - 40, w, 80); }
  // 地面：湿沥青
  const gnd = g.createLinearGradient(0, horizon, 0, h);
  gnd.addColorStop(0, pal.ground[0]); gnd.addColorStop(0.4, pal.ground[1]); gnd.addColorStop(1, pal.ground[2]);
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
