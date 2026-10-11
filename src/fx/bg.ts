// 程序化战场背景：绘本剪纸风的分层风景。
import { mulberry } from './util';

export type BgTheme = 'meadow' | 'redcliff' | 'mist' | 'forest';

interface ThemeDef {
  sky: [string, string, string];
  sun: { x: number; y: number; r: number; c: string } | null;
  far: string; mid: string; near: string; ground: [string, string]; accent: string; cloud: string;
}
const THEMES: Record<BgTheme, ThemeDef> = {
  meadow: { sky: ['#8fd0f0', '#cdeaf6', '#fff3d6'], sun: { x: 760, y: 120, r: 54, c: '#fff4b8' }, far: '#a9cdbf', mid: '#82b894', near: '#5f9e6a', ground: ['#8ec46a', '#6aa457'], accent: '#e6f5b8', cloud: '#ffffff' },
  redcliff: { sky: ['#3a2150', '#c4463f', '#f6a060'], sun: { x: 480, y: 250, r: 70, c: '#ffd6a0' }, far: '#6a2f50', mid: '#4a2540', near: '#2c1830', ground: ['#5a2a38', '#2e1a2c'], accent: '#ffb070', cloud: '#e8785a' },
  mist: { sky: ['#bfe9e6', '#e6f6ee', '#fffbe8'], sun: { x: 200, y: 110, r: 46, c: '#ffffff' }, far: '#a8d8d2', mid: '#7fc2bf', near: '#54a6a8', ground: ['#cfeadd', '#a8d6c6'], accent: '#ffffff', cloud: '#ffffff' },
  forest: { sky: ['#9ed7b8', '#d4ecc0', '#f6f2c8'], sun: { x: 700, y: 100, r: 44, c: '#fffbd0' }, far: '#7fb596', mid: '#5c9c78', near: '#3f7a5c', ground: ['#a4c070', '#7a9c52'], accent: '#e8f4a8', cloud: '#f4fff0' },
};

export function makeBackground(theme: BgTheme, w = 960, h = 600, dpr = 2, seed = 7): HTMLCanvasElement {
  const T = THEMES[theme];
  const c = document.createElement('canvas');
  c.width = w * dpr;
  c.height = h * dpr;
  const ctx = c.getContext('2d')!;
  ctx.scale(dpr, dpr);
  const rnd = mulberry(seed);
  // 天空
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.62);
  sky.addColorStop(0, T.sky[0]); sky.addColorStop(0.55, T.sky[1]); sky.addColorStop(1, T.sky[2]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  // 太阳
  if (T.sun) {
    const g = ctx.createRadialGradient(T.sun.x, T.sun.y, 0, T.sun.x, T.sun.y, T.sun.r * 3.2);
    g.addColorStop(0, T.sun.c); g.addColorStop(0.3, T.sun.c + 'aa'); g.addColorStop(1, T.sun.c + '00');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = T.sun.c;
    ctx.beginPath(); ctx.arc(T.sun.x, T.sun.y, T.sun.r, 0, 6.3); ctx.fill();
  }
  // 云
  const cloud = (x: number, y: number, s: number) => {
    ctx.fillStyle = T.cloud;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    for (const [dx, dy, r] of [[0, 0, 26], [30, -10, 32], [64, 0, 26], [32, 8, 28]] as [number, number, number][]) ctx.arc(x + dx * s, y + dy * s, r * s, 0, 6.3);
    ctx.fill();
    ctx.globalAlpha = 1;
  };
  for (let i = 0; i < 6; i++) cloud(rnd() * w, 40 + rnd() * 150, 0.8 + rnd() * 0.9);
  // 山 / 崖
  const ridge = (base: number, amp: number, col: string, step = 60, peaky = 0.5) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(-20, h);
    let x = -20;
    ctx.lineTo(x, base);
    while (x < w + 40) {
      x += step * (0.6 + rnd() * 0.8);
      ctx.lineTo(x, base - amp * (rnd() ** (1 - peaky)) );
    }
    ctx.lineTo(w + 40, h);
    ctx.closePath();
    ctx.fill();
  };
  ridge(330, 130, T.far, 90, 0.7);
  ridge(360, 95, T.mid, 70, 0.6);
  // 主题装饰
  if (theme === 'redcliff') {
    // 江面与战船剪影
    const water = ctx.createLinearGradient(0, 340, 0, 430);
    water.addColorStop(0, '#d86a4a'); water.addColorStop(1, '#5a2a44');
    ctx.fillStyle = water; ctx.fillRect(0, 345, w, 90);
    ctx.strokeStyle = 'rgba(255,214,160,.35)'; ctx.lineWidth = 2;
    for (let i = 0; i < 30; i++) { const x = rnd() * w, y = 352 + rnd() * 70; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 20 + rnd() * 40, y); ctx.stroke(); }
    const ship = (x: number, y: number, s: number) => {
      ctx.fillStyle = '#2c1830';
      ctx.beginPath(); ctx.moveTo(x - 40 * s, y); ctx.lineTo(x + 40 * s, y); ctx.lineTo(x + 28 * s, y + 14 * s); ctx.lineTo(x - 30 * s, y + 14 * s); ctx.closePath(); ctx.fill();
      ctx.fillRect(x - 2 * s, y - 50 * s, 4 * s, 50 * s);
      ctx.beginPath(); ctx.moveTo(x + 2 * s, y - 48 * s); ctx.lineTo(x + 32 * s, y - 14 * s); ctx.lineTo(x + 2 * s, y - 12 * s); ctx.closePath(); ctx.fill();
      // 火光
      const g = ctx.createRadialGradient(x, y - 10 * s, 0, x, y - 10 * s, 36 * s);
      g.addColorStop(0, 'rgba(255,190,90,.85)'); g.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 40 * s, y - 50 * s, 80 * s, 80 * s);
    };
    ship(150, 372, 0.9); ship(330, 392, 1.1); ship(640, 380, 1); ship(820, 400, 1.2);
  } else if (theme === 'mist') {
    // 漂浮仙岛
    for (const [x, y, s] of [[160, 230, 1], [700, 190, 1.3], [880, 290, 0.8]] as [number, number, number][]) {
      ctx.fillStyle = T.near; ctx.beginPath(); ctx.moveTo(x - 70 * s, y); ctx.quadraticCurveTo(x, y + 80 * s, x + 70 * s, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8fd6a0'; ctx.beginPath(); ctx.ellipse(x, y, 70 * s, 14 * s, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#e8c15a'; ctx.beginPath(); ctx.moveTo(x - 12 * s, y - 4); ctx.lineTo(x, y - 46 * s); ctx.lineTo(x + 12 * s, y - 4); ctx.closePath(); ctx.fill();
    }
  } else {
    // 松树
    const pine = (x: number, y: number, s: number, col: string) => {
      ctx.fillStyle = col;
      for (let i = 0; i < 4; i++) { const yy = y - i * 22 * s; ctx.beginPath(); ctx.moveTo(x - (34 - i * 6) * s, yy); ctx.lineTo(x, yy - 34 * s); ctx.lineTo(x + (34 - i * 6) * s, yy); ctx.closePath(); ctx.fill(); }
      ctx.fillStyle = '#6a4a30'; ctx.fillRect(x - 4 * s, y, 8 * s, 14 * s);
    };
    for (let i = 0; i < 9; i++) pine(rnd() * w, 372 + rnd() * 10, 0.9 + rnd() * 0.5, T.near);
  }
  ridge(392, 36, T.near, 50, 0.4);
  // 地面
  const gnd = ctx.createLinearGradient(0, 380, 0, h);
  gnd.addColorStop(0, T.ground[0]); gnd.addColorStop(1, T.ground[1]);
  ctx.fillStyle = gnd;
  ctx.beginPath();
  ctx.moveTo(0, 392);
  for (let x = 0; x <= w; x += 40) ctx.lineTo(x, 388 + Math.sin(x * 0.02) * 4 + rnd() * 4);
  ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
  // 草笔触
  ctx.lineCap = 'round';
  for (let i = 0; i < 260; i++) {
    const x = rnd() * w;
    const y = 400 + rnd() * 200;
    const k = (y - 400) / 200;
    ctx.strokeStyle = rnd() > 0.5 ? T.accent : T.near;
    ctx.globalAlpha = 0.16 + k * 0.25;
    ctx.lineWidth = 1.5 + k * 2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rnd() - 0.5) * 8, y - 6 - k * 10); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // 战场圆形地毯（站位提示）
  ctx.fillStyle = 'rgba(255,255,255,.07)';
  ctx.beginPath(); ctx.ellipse(w / 2, 500, 420, 90, 0, 0, 6.3); ctx.fill();
  // 纸张颗粒
  ctx.globalAlpha = 0.07;
  for (let i = 0; i < 5200; i++) { ctx.fillStyle = rnd() > 0.5 ? '#000' : '#fff'; ctx.fillRect(rnd() * w, rnd() * h, 1.2, 1.2); }
  ctx.globalAlpha = 1;
  // 暗角
  const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.95);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(20,10,30,.28)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
  return c;
}
