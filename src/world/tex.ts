// 程序化贴图：窗户立面、霓虹招牌、路面。全部用 Canvas 画，不引入图片文件。
import * as THREE from 'three';
import { mulberry } from '../fx/util';
import { WORLD_TEX } from './assets';

const cache = new Map<string, THREE.CanvasTexture>();

/** AI 素材（assets/world → src/world/assets）：先预加载，facade() 等同步函数才能直接 drawImage */
const imgs = new Map<string, HTMLImageElement>();
export function preloadWorldTextures(): Promise<void> {
  return Promise.all(Object.entries(WORLD_TEX).map(([k, url]) => new Promise<void>((res) => {
    if (imgs.has(k)) return res();
    const i = new Image();
    i.onload = () => { imgs.set(k, i); res(); };
    i.onerror = () => res(); // 素材加载失败就退回程序化画法
    i.src = url;
  }))).then(() => undefined);
}
export const worldImg = (k: string): HTMLImageElement | undefined => imgs.get(k);
/** AI 招牌 / 广告贴图（预加载成功才有，否则返回 null 让调用方退回程序化招牌） */
const aiTexCache = new Map<string, THREE.Texture>();
export function aiTex(name: string): THREE.Texture | null {
  const img = worldImg(name);
  if (!img) return null;
  let t = aiTexCache.get(name);
  if (!t) { t = new THREE.Texture(img); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true; aiTexCache.set(name, t); }
  return t;
}
/** 招牌文字 → 对应的 AI 招牌（只匹配文字与图案相符的几类） */
export function aiSignFor(text: string, vertical: boolean): string | null {
  if (vertical) return text.includes('网咖') ? 'sign_netcafe_vertical_04' : text.includes('酒') ? 'sign_bar_vertical_05' : null;
  return text.includes('拉面') ? 'sign_ramen_horizontal_01' : text.includes('当铺') ? 'sign_pawn_horizontal_02' : text.includes('药') ? 'sign_pharmacy_horizontal_03' : null;
}
const WALL_IMG: Record<string, string> = { dark: 'wall_metal_riveted_01', teal: 'wall_tile_seafoam_01', brick: 'wall_metal_painted_02', cream: 'wall_tile_ivory_02', pink: 'wall_metal_ribbed_03' };
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
const WALL: Record<FacadeStyle, [string, string]> = { cream: ['#bfae92', '#8f7e66'], teal: ['#41706c', '#2c4f4c'], brick: ['#8c4a33', '#5c2e20'], dark: ['#2c3048', '#1a1c30'], pink: ['#b98890', '#8f5a66'] };
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
    const aiWall = worldImg(style === 'dark' && variant % 3 === 2 ? 'wall_tile_slate_03' : WALL_IMG[style]);
    if (aiWall) {
      // 用 AI 金属板当底（可无缝平铺），再按风格色相叠一层，窗户 / 污渍仍然程序化画在上面
      g.save(); if (variant % 2) { g.translate(W, 0); g.scale(-1, 1); } g.drawImage(aiWall, 0, 0, W, H); g.restore();
      g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.7; g.fillStyle = a; g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    }
    // 瓷砖 / 灰泥纹理
    g.strokeStyle = 'rgba(0,0,0,.08)'; g.lineWidth = 1;
    if (!aiWall && (style === 'cream' || style === 'pink')) for (let y = 0; y < H; y += 16) for (let x = 0; x < W; x += 16) g.strokeRect(x + 0.5, y + 0.5, 16, 16);
    if (!aiWall && style === 'brick') for (let y = 0; y < H; y += 12) for (let x = (y / 12) % 2 ? 0 : 12; x < W; x += 24) { g.fillStyle = rnd() < 0.3 ? b : a; g.fillRect(x + 1, y + 1, 22, 10); }
    // 污渍：整体越往下越脏 + 竖向雨水流痕 + 斑驳
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(0,0,0,.05)'); gr.addColorStop(1, 'rgba(20,12,8,.42)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 26; i++) { const x = rnd() * W, y = rnd() * H * 0.6, l = 40 + rnd() * 130; const sg = g.createLinearGradient(0, y, 0, y + l); sg.addColorStop(0, 'rgba(10,8,14,0)'); sg.addColorStop(0.3, `rgba(10,8,14,${0.15 + rnd() * 0.25})`); sg.addColorStop(1, 'rgba(10,8,14,0)'); g.fillStyle = sg; g.fillRect(x, y, 2 + rnd() * 4, l); }
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},${rnd() * 0.08})`; g.fillRect(rnd() * W, rnd() * H, 3 + rnd() * 9, 3 + rnd() * 9); }
    // 管线 + 贴纸 / 海报
    g.strokeStyle = 'rgba(14,12,22,.8)'; g.lineWidth = 3; for (let i = 0; i < 3; i++) { const y = 14 + rnd() * 220; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y + (rnd() - 0.5) * 8); g.stroke(); }
    for (let i = 0; i < 4; i++) { const x = rnd() * (W - 40), y = 8 + rnd() * 200; g.fillStyle = ['#d9483b', '#e8c15a', '#7ff0ff', '#ff7ad9', '#f4efe6'][Math.floor(rnd() * 5)]; g.globalAlpha = 0.55; g.fillRect(x, y, 14 + rnd() * 20, 18 + rnd() * 24); g.globalAlpha = 1; }
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
    g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 3;
    for (let y = 0; y < 256; y += 32) for (let x = (y / 32) % 2 ? 0 : 16; x < 256; x += 32) { g.strokeRect(x, y, 32, 32); g.fillStyle = rnd() < 0.5 ? `rgba(0,0,0,${rnd() * 0.22})` : `rgba(255,255,255,${rnd() * 0.05})`; g.fillRect(x + 2, y + 2, 28, 28); }
    for (let i = 0; i < 140; i++) { g.fillStyle = `rgba(0,0,0,${0.05 + rnd() * 0.12})`; g.beginPath(); g.ellipse(rnd() * 256, rnd() * 256, 3 + rnd() * 12, 2 + rnd() * 7, rnd() * 3, 0, 7); g.fill(); }
  }, 'paving' + color);
}
/** 发光点（地面光斑、灯晕）用的径向渐变 */
export function glowTex(): THREE.CanvasTexture {
  return mk(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }, 'glow');
}
export function stripes(a: string, b: string, n = 8): THREE.CanvasTexture {
  return mk(128, 64, (g) => { const w = 128 / n; for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? a : b; g.fillRect(i * w, 0, w, 64); } }, `stripes${a}${b}${n}`);
}

/** 水面反光条纹（可平铺，横向亮线），做动画时滚动 offset */
export function waterGlint(): THREE.CanvasTexture {
  const t = mk(256, 256, (g) => {
    const rnd = mulberry(31);
    g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 70; i++) { const y = rnd() * 256, x = rnd() * 256, w = 20 + rnd() * 90; const gr = g.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, `rgba(255,255,255,${0.25 + rnd() * 0.5})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x, y, w, 1.5 + rnd() * 2); if (x + w > 256) g.fillRect(x - 256, y, w, 2); }
  }, 'waterglint');
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
