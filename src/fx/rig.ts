// 骨骼绑定：把 catParts() 的每个部件栅格化成位图，供 Canvas 做关节动画。
import { PART_ORDER, VIEW_FULL, catParts, stanceFor } from '../art/cat';
import type { Part, PartId } from '../art/cat';
import type { CatLook } from '../art/types';

export interface RigPart {
  id: PartId;
  img: HTMLCanvasElement;
  x: number; // 部件位图左上角（骨骼坐标）
  y: number;
  w: number;
  h: number;
  pivot: [number, number];
}
export interface Rig {
  parts: RigPart[];
  look: CatLook;
  stance: Partial<Record<PartId, [number, number, number]>>;
  /** 骨骼坐标：脚底中心 */
  foot: [number, number];
  height: number; // 角色大约像素高（骨骼坐标）
  scale: number; // 位图像素 / 骨骼单位
}

let rigUid = 0;

function loadImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('svg load failed'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

function measure(parts: Part[], defs: string): Record<string, [number, number, number, number]> {
  const NS = 'http://www.w3.org/2000/svg';
  const holder = document.createElement('div');
  holder.style.cssText = 'position:absolute;left:-99999px;top:0;width:10px;height:10px;overflow:hidden';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', VIEW_FULL);
  svg.setAttribute('width', '520');
  svg.setAttribute('height', '700');
  svg.innerHTML = `<defs>${defs}</defs>` + parts.map((p) => `<g id="m_${p.id}">${p.svg}</g>`).join('');
  holder.appendChild(svg);
  document.body.appendChild(holder);
  const out: Record<string, [number, number, number, number]> = {};
  for (const p of parts) {
    const g = svg.querySelector(`#m_${p.id}`) as unknown as SVGGraphicsElement;
    const b = g.getBBox();
    out[p.id] = [b.x, b.y, b.width, b.height];
  }
  holder.remove();
  return out;
}

export async function buildRig(look: CatLook, scale = 0.8): Promise<Rig> {
  const uid = `r${++rigUid}`;
  const { parts, defs } = catParts(look, uid);
  const boxes = measure(parts, defs);
  const M = 26;
  const rigParts: RigPart[] = [];
  for (const p of PART_ORDER) {
    const part = parts.find((q) => q.id === p)!;
    const [bx, by, bw, bh] = boxes[p];
    const x = Math.floor(bx - M);
    const y = Math.floor(by - M);
    const w = Math.ceil(bw + M * 2);
    const h = Math.ceil(bh + M * 2);
    if (bw <= 0 || bh <= 0) {
      const c = document.createElement('canvas');
      c.width = c.height = 1;
      rigParts.push({ id: p, img: c, x: 0, y: 0, w: 0, h: 0, pivot: part.pivot });
      continue;
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${Math.ceil(w * scale)}" height="${Math.ceil(h * scale)}"><defs>${defs}</defs><g filter="url(#paper${uid})">${part.svg}</g></svg>`;
    const img = await loadImage(svg);
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * scale);
    c.height = Math.ceil(h * scale);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    rigParts.push({ id: p, img: c, x, y, w, h, pivot: part.pivot });
  }
  return { parts: rigParts, look, stance: stanceFor(look), foot: [200, 604], height: 560, scale };
}

/** 半身像（用于出招插入图 / 头像） */
export async function buildPortrait(look: CatLook, viewBox = '10 40 380 420', px = 520): Promise<HTMLCanvasElement> {
  const { catSvg } = await import('../art/cat');
  const [, , vw, vh] = viewBox.split(' ').map(Number);
  const svg = catSvg(look, { width: px, height: Math.round((px * vh) / vw), viewBox, uid: `p${++rigUid}` });
  const img = await loadImage(svg);
  const c = document.createElement('canvas');
  c.width = px;
  c.height = Math.round((px * vh) / vw);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c;
}
