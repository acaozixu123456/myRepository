// 立绘位图缓存：SVG -> data URI，供卡牌、头像、抽卡展示使用。
import { catSvg } from '../art/cat';
import { lookOf } from '../data/units';

export const VIEW = {
  card: '30 40 340 350', // 头 + 胸像（卡牌）
  full: '10 30 420 640', // 全身（长兵器外伸，左右多留一点）
  head: '52 52 296 290', // 头像
};

const cache = new Map<string, string>();
let n = 0;
export function artUrl(id: string, view: keyof typeof VIEW | string = 'card', flip = false): string {
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
