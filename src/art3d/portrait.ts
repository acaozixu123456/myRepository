// 3D 小猫的半身像（出招插入图 / 抽卡展示 / 头像）：渲染一次，裁出上半身。
import type { CatLook } from '../art/types';
import { buildCat3D } from './cat3d';
import { applyPose } from './pose';
import { FRAME, Renderer3D } from './renderer';

export function portrait3D(look: CatLook, px = 520, heroId?: string): HTMLCanvasElement {
  const R = Renderer3D.get()!;
  const cat = buildCat3D(look, heroId);
  cat.phase = 0;
  applyPose(cat, {}, { alive: false, moving: false, t: 0 });
  const W = 1000, H = Math.round((W * (FRAME.y1 - FRAME.y0)) / (FRAME.x1 - FRAME.x0));
  const [sx, sy, sw, sh] = R.render(cat, W, H, 0.35, 'neutral');
  // 上半身：横向取中间 70%，纵向取上 62%
  const cx = sx + sw * 0.15, cw = sw * 0.7, ch = sh * 0.62;
  const c = document.createElement('canvas');
  c.width = px; c.height = Math.round((px * ch) / cw);
  c.getContext('2d')!.drawImage(R.canvas, cx, sy, cw, ch, 0, 0, c.width, c.height);
  return c;
}

/** 全身图相对取景框的裁切（live.ts 对齐用同一份） */
export const FULL_BOX = { x: 0.2, y: 0.03, w: 0.6, h: 0.95 };
const urlCache = new Map<string, string>();
/** UI 用的 3D 立绘图（卡牌 / 头像 / 全身）：渲染一次转成 webp 数据地址并缓存 */
export function cat3dUrl(heroId: string, look: CatLook, view: 'card' | 'head' | 'full'): string {
  const key = `${heroId}|${view}`;
  let u = urlCache.get(key);
  if (u) return u;
  const R = Renderer3D.get()!;
  const cat = buildCat3D(look, heroId);
  cat.phase = 0;
  applyPose(cat, {}, { alive: false, moving: false, t: 0 });
  const W = 720, H = Math.round((W * (FRAME.y1 - FRAME.y0)) / (FRAME.x1 - FRAME.x0));
  const [sx, sy, sw, sh] = R.render(cat, W, H, 0.3, 'neutral');
  // 取景（相对整张取景框的比例）：full = 整只；card = 头 + 胸；head = 头
  const box = view === 'full' ? FULL_BOX : view === 'card' ? { x: 0.16, y: 0.02, w: 0.68, h: 0.56 } : { x: 0.22, y: 0.02, w: 0.56, h: 0.36 };
  const c = document.createElement('canvas');
  const outH = view === 'full' ? 720 : view === 'card' ? 420 : 260;
  c.height = outH;
  c.width = Math.round((outH * box.w * sw) / (box.h * sh));
  c.getContext('2d')!.drawImage(R.canvas, sx + box.x * sw, sy + box.y * sh, box.w * sw, box.h * sh, 0, 0, c.width, c.height);
  u = c.toDataURL('image/webp', 0.88);
  if (!u.startsWith('data:image/webp')) u = c.toDataURL('image/png');
  urlCache.set(key, u);
  return u;
}
