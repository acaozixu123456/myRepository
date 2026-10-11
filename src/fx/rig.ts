// 骨骼绑定：把 catParts() 的每个部件栅格化成位图，供 Canvas 做关节动画。
import { PART_ORDER, STYLE, VIEW_FULL, catParts, stanceFor } from '../art/cat';
import type { Part, PartId } from '../art/cat';
import type { CatLook } from '../art/types';
import { anchorsOf } from '../art/illust-rig';
import { MeshGL } from './mesh';
import { PuppetMesh } from './puppet';

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
  /** 立绘木偶（有 WebGL 时）：整张立绘按网格形变，手臂 / 头 / 尾巴 / 衣摆单独动 */
  puppet?: { mesh: PuppetMesh; tex: HTMLCanvasElement; x0: number; y0: number; w: number; h: number; kHand: number };
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
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${Math.ceil(w * scale)}" height="${Math.ceil(h * scale)}"><defs>${defs}</defs>${STYLE.flat ? part.svg : `<g filter="url(#paper${uid})">${part.svg}</g>`}</svg>`;
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

/** 立绘小人：整张 AI 立绘当作「躯干」一块骨骼，脚底为支点；动作靠整体旋转 / 位移 / 呼吸缩放表现（没有手臂摆动）。 */
export async function buildIllustRig(look: CatLook, url: string, scale = 0.8, heroId = ''): Promise<Rig> {
  const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('illust load failed')); i.src = url; });
  const H = 560, foot: [number, number] = [200, 604];
  const w = Math.round((img.width / img.height) * H), h = H;
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * scale); c.height = Math.ceil(h * scale);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  const parts: RigPart[] = PART_ORDER.map((id) => {
    if (id !== 'torso') { const e = document.createElement('canvas'); e.width = e.height = 1; return { id, img: e, x: 0, y: 0, w: 0, h: 0, pivot: [200, 300] as [number, number] }; }
    return { id, img: c, x: foot[0] - w / 2, y: foot[1] - h, w, h, pivot: [foot[0], foot[1]] as [number, number] };
  });
  const rig: Rig = { parts, look, stance: {}, foot, height: H, scale };
  if (MeshGL.ok) {
    const an = anchorsOf(heroId);
    const mesh = new PuppetMesh(w, h, an);
    // 离手最近的网格顶点：特效锚点跟着挥动的手走
    let kHand = 0, best = 1e9;
    for (let k = 0; k < mesh.rest.length / 2; k++) {
      const d = Math.hypot(mesh.rest[k * 2] - mesh.A.handMain[0], mesh.rest[k * 2 + 1] - mesh.A.handMain[1]);
      if (d < best) { best = d; kHand = k; }
    }
    rig.puppet = { mesh, tex: c, x0: foot[0] - w / 2, y0: foot[1] - h, w, h, kHand };
  }
  return rig;
}

/** 立绘版半身像（出招插入图）：直接用卡牌裁切图 */
export async function illustPortrait(url: string, px = 520): Promise<HTMLCanvasElement> {
  const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('illust load failed')); i.src = url; });
  const c = document.createElement('canvas');
  c.width = px; c.height = Math.round((px * img.height) / img.width);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c;
}
