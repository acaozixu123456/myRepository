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
  const [sx, sy, sw, sh] = R.render(cat, W, H, 0.35);
  // 上半身：横向取中间 70%，纵向取上 62%
  const cx = sx + sw * 0.15, cw = sw * 0.7, ch = sh * 0.62;
  const c = document.createElement('canvas');
  c.width = px; c.height = Math.round((px * ch) / cw);
  c.getContext('2d')!.drawImage(R.canvas, cx, sy, cw, ch, 0, 0, c.width, c.height);
  return c;
}
