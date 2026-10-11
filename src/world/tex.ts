// 程序化贴图：窗户立面、霓虹招牌、路面。全部用 Canvas 画，不引入图片文件。
import * as THREE from 'three';
import { mulberry } from '../fx/util';

const cache = new Map<string, THREE.CanvasTexture>();
const mk = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, key?: string, srgb = true): THREE.CanvasTexture => {
  if (key && cache.has(key)) return cache.get(key)!;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (key) cache.set(key, t);
  return t;
};

export type FacadeStyle = 'cream' | 'teal' | 'brick' | 'dark' | 'pink';
const WALL: Record<FacadeStyle, [string, string]> = { cream: ['#ead9bd', '#c9b08c'], teal: ['#5a8f8a', '#3e6a68'], brick: ['#b0603f', '#7e3f2a'], dark: ['#3a3f58', '#232640'], pink: ['#e8b0b8', '#c0808c'] };
const LIT = ['#ffd27a', '#7ff0ff', '#ff7ad9', '#ffe9b0', '#9aa8ff'];

/** 一层楼的立面（一张贴图 = 一层 ×2 个开间）。返回 [颜色贴图, 自发光贴图（亮着灯的窗）] */
export function facade(style: FacadeStyle, variant: number): [THREE.CanvasTexture, THREE.CanvasTexture] {
  const key = `fac|${style}|${variant}`;
  const emKey = key + '|em';
  if (cache.has(key)) return [cache.get(key)!, cache.get(emKey)!];
  const rnd = mulberry(1000 + variant * 77 + style.length);
  const W = 256, H = 256;
  const base = mk(W, H, (g) => {
    const [a, b] = WALL[style];
    g.fillStyle = a; g.fillRect(0, 0, W, H);
    // 瓷砖 / 灰泥纹理
    g.strokeStyle = 'rgba(0,0,0,.08)'; g.lineWidth = 1;
    if (style === 'cream' || style === 'pink') for (let y = 0; y < H; y += 16) for (let x = 0; x < W; x += 16) g.strokeRect(x + 0.5, y + 0.5, 16, 16);
    if (style === 'brick') for (let y = 0; y < H; y += 12) for (let x = (y / 12) % 2 ? 0 : 12; x < W; x += 24) { g.fillStyle = rnd() < 0.3 ? b : a; g.fillRect(x + 1, y + 1, 22, 10); }
    // 污渍
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(30,20,10,.22)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // 两个开间
    for (let i = 0; i < 2; i++) {
      const x = 22 + i * 120, y = 40, w = 92, h = 150;
      g.fillStyle = '#2a2230'; g.fillRect(x - 5, y - 5, w + 10, h + 10);          // 窗框
      g.fillStyle = '#121626'; g.fillRect(x, y, w, h);                             // 玻璃
      const gl = g.createLinearGradient(x, y, x + w, y + h); gl.addColorStop(0, 'rgba(120,170,255,.28)'); gl.addColorStop(0.5, 'rgba(120,170,255,0)'); gl.addColorStop(1, 'rgba(255,120,220,.18)'); g.fillStyle = gl; g.fillRect(x, y, w, h);
      g.fillStyle = '#2a2230'; g.fillRect(x + w / 2 - 2, y, 4, h); g.fillRect(x, y + h / 2 - 2, w, 4); // 窗棂
      g.fillStyle = b; g.fillRect(x - 10, y + h + 5, w + 20, 8);                  // 窗台
    }
  }, key);
  const em = mk(W, H, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 2; i++) {
      if (rnd() < 0.62) {
        const x = 22 + i * 120, y = 40, w = 92, h = 150;
        const col = LIT[Math.floor(rnd() * LIT.length)];
        g.fillStyle = col; g.globalAlpha = 0.85; g.fillRect(x + 3, y + 3, w - 6, h - 6); g.globalAlpha = 1;
        g.fillStyle = '#000'; g.fillRect(x + w / 2 - 2, y, 4, h); g.fillRect(x, y + h / 2 - 2, w, 4);
        // 窗帘 / 剪影
        if (rnd() < 0.5) { g.fillStyle = 'rgba(0,0,0,.55)'; g.beginPath(); g.ellipse(x + 30, y + h - 30, 14, 28, 0, 0, 7); g.fill(); }
      }
    }
  }, emKey);
  for (const t of [base, em]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return [base, em];
}

/** 霓虹招牌：发光描边 + 文字。vertical = 竖排。 */
export function neonSign(text: string, color: string, o: { vertical?: boolean; bg?: string; w?: number; h?: number } = {}): THREE.CanvasTexture {
  const vertical = !!o.vertical;
  const key = `neon|${text}|${color}|${vertical}|${o.bg ?? ''}`;
  const W = o.w ?? (vertical ? 128 : 512), H = o.h ?? (vertical ? 512 : 160);
  return mk(W, H, (g) => {
    g.fillStyle = o.bg ?? '#10101c'; g.fillRect(0, 0, W, H);
    g.strokeStyle = color; g.lineWidth = 6; g.shadowColor = color; g.shadowBlur = 18;
    g.strokeRect(10, 10, W - 20, H - 20);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `900 ${vertical ? 78 : Math.min(104, (W - 60) / Math.max(1, text.length))}px "Noto Sans SC","PingFang SC","Microsoft YaHei","WenQuanYi Zen Hei",sans-serif`;
    g.shadowBlur = 26; g.shadowColor = color;
    if (vertical) { const chars = [...text]; const step = (H - 40) / chars.length; chars.forEach((ch, i) => { g.fillStyle = '#fff'; g.fillText(ch, W / 2, 20 + step * (i + 0.5)); g.fillStyle = color; g.globalAlpha = 0.5; g.fillText(ch, W / 2, 20 + step * (i + 0.5)); g.globalAlpha = 1; }); }
    else { g.fillText(text, W / 2, H / 2 + 4); g.fillStyle = color; g.globalAlpha = 0.45; g.fillText(text, W / 2, H / 2 + 4); g.globalAlpha = 1; }
  }, key);
}

/** 路面：湿漉漉的沥青 + 虚线 + 斑马线 + 反光水洼 */
export function asphalt(): THREE.CanvasTexture {
  return mk(512, 512, (g) => {
    const rnd = mulberry(5);
    g.fillStyle = '#1c1c28'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${60 + rnd() * 40 | 0},${60 + rnd() * 40 | 0},${70 + rnd() * 40 | 0},${0.1 + rnd() * 0.18})`; g.fillRect(rnd() * 512, rnd() * 512, 2, 2); }
    // 积水
    for (let i = 0; i < 7; i++) { const x = rnd() * 512, y = rnd() * 512; const gr = g.createRadialGradient(x, y, 4, x, y, 40 + rnd() * 40); gr.addColorStop(0, 'rgba(120,140,220,.35)'); gr.addColorStop(1, 'rgba(120,140,220,0)'); g.fillStyle = gr; g.fillRect(x - 90, y - 90, 180, 180); }
    // 中线
    g.fillStyle = 'rgba(255,230,160,.8)'; for (let y = 8; y < 512; y += 64) g.fillRect(250, y, 12, 36);
  }, 'asphalt');
}
export function paving(color = '#6b6478'): THREE.CanvasTexture {
  return mk(256, 256, (g) => {
    const rnd = mulberry(9);
    g.fillStyle = color; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 2;
    for (let y = 0; y < 256; y += 32) for (let x = (y / 32) % 2 ? 0 : 16; x < 256; x += 32) { g.strokeRect(x, y, 32, 32); g.fillStyle = `rgba(255,255,255,${rnd() * 0.06})`; g.fillRect(x + 2, y + 2, 28, 28); }
  }, 'paving' + color);
}
/** 发光点（地面光斑、灯晕）用的径向渐变 */
export function glowTex(): THREE.CanvasTexture {
  return mk(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }, 'glow');
}
export function stripes(a: string, b: string, n = 8): THREE.CanvasTexture {
  return mk(128, 64, (g) => { const w = 128 / n; for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? a : b; g.fillRect(i * w, 0, w, 64); } }, `stripes${a}${b}${n}`);
}
