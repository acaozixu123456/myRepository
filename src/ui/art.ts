// 立绘位图缓存：SVG -> data URI，供卡牌、头像、抽卡展示使用。
import { catSvg } from '../art/cat';
import { lookOf } from '../data/units';
import { ILLUST } from '../art/illust-index';
import { use3D } from '../art3d/mode';
import { cat3dUrl } from '../art3d/portrait';

export const VIEW = {
  card: '30 40 340 350', // 头 + 胸像（卡牌）
  full: '10 30 420 640', // 全身（长兵器外伸，左右多留一点）
  head: '52 52 296 290', // 头像
};

const cache = new Map<string, string>();
let n = 0;
export function artUrl(id: string, view: keyof typeof VIEW | string = 'card', flip = false): string {
  // 3D 模式：全员用 3D 小猫渲染出的立绘图
  if (use3D() && !flip && (view === 'full' || view === 'card' || view === 'head')) return cat3dUrl(id, lookOf(id), view);
  // 有 AI 立绘的猫优先用立绘（full / card / head 三种视图，见 tools/sync-illust.py）；其余退回程序化造型
  const il = ILLUST[id];
  if (il && (view === 'full' || view === 'card' || view === 'head')) return il[view];
  const vb = (VIEW as Record<string, string>)[view] ?? view;
  const key = `${id}|${vb}|${flip}`;
  let u = cache.get(key);
  if (!u) {
    const [, , vw, vh] = vb.split(' ').map(Number);
    const px = vw > 300 ? 360 : 300;
    const svg = catSvg({ ...lookOf(id), flip }, { width: px, height: Math.round((px * vh) / vw), viewBox: vb, uid: `a${++n}` });
    u = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    cache.set(key, u);
  }
  return u;
}
export const artImg = (id: string, view: keyof typeof VIEW | string = 'card', alt = '') => `<img src="${artUrl(id, view)}" alt="${alt}" draggable="false">`;
