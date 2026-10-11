// 动态立绘：给详情页 / 抽卡展示的静态立绘盖一层「木偶」画布（呼吸 / 摆头 / 甩尾 / 衣摆），点一下还会挥手回应。
// 用法：模板里用 liveImg(id, 'full') 代替 artImg；initLive() 在启动时调一次，之后 DOM 里出现 [data-live] 就自动激活。
// 没有立绘 / 没有 WebGL / 系统要求减少动态效果时，保持静态图。
import { artUrl } from './art';
import { ILLUST } from '../art/illust-index';
import { lookOf } from '../data/units';
import { MeshGL } from '../fx/mesh';
import { buildIllustRig } from '../fx/rig';
import type { Rig } from '../fx/rig';
import { puppetPose } from '../fx/puppet';

export const liveSettings = { on: true };

export function liveImg(id: string, view: 'full' | 'card' = 'full', alt = ''): string {
  const live = view === 'full' && ILLUST[id] ? ` data-live="${id}"` : '';
  return `<img src="${artUrl(id, view)}" alt="${alt}" draggable="false"${live}>`;
}

interface Item { img: HTMLImageElement; cv: HTMLCanvasElement; rig: Rig; t0: number; phase: number; react: number; reactT: number; n: number }
const items = new Set<Item>();
const rigs = new Map<string, Promise<Rig | null>>();
let raf = 0;

function liveRig(id: string): Promise<Rig | null> {
  let p = rigs.get(id);
  if (!p) {
    const il = ILLUST[id];
    p = il ? buildIllustRig(lookOf(id), il.full, 0.9, id).then((r) => (r.puppet ? r : null)).catch(() => null) : Promise.resolve(null);
    rigs.set(id, p);
  }
  return p;
}

function place(it: Item) {
  const { img, cv } = it;
  const pp = it.rig.puppet!;
  const bw = img.offsetWidth, bh = img.offsetHeight;
  let dw = bw, dh = bh, ox = 0, oy = 0;
  const cs = getComputedStyle(img);
  if (cs.objectFit === 'contain') {
    // 图片在盒子里按 contain 摆放：画布要对准真正显示出来的那块
    const k = Math.min(bw / pp.w, bh / pp.h);
    dw = pp.w * k; dh = pp.h * k;
    const [px, py] = cs.objectPosition.split(' ').map((v) => (parseFloat(v) || 50) / 100);
    ox = (bw - dw) * px; oy = (bh - dh) * (py ?? 0.5);
  }
  cv.style.left = `${img.offsetLeft + ox - 0.3 * dw}px`;
  cv.style.top = `${img.offsetTop + oy - 0.2 * dh}px`;
  cv.style.width = `${1.6 * dw}px`;
  cv.style.height = `${1.4 * dh}px`;
}

async function activate(img: HTMLImageElement) {
  if (img.dataset.on || !liveSettings.on || !MeshGL.ok) return;
  if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  img.dataset.on = '1';
  const rig = await liveRig(img.dataset.live!);
  if (!rig || !rig.puppet || !img.isConnected) return;
  const pp = rig.puppet;
  const gl = MeshGL.get()!;
  const cv = document.createElement('canvas');
  const ps = rig.scale * 0.75;
  cv.width = Math.ceil(1.6 * pp.w * ps);
  cv.height = Math.ceil(1.4 * pp.h * ps);
  cv.className = 'live-cv';
  cv.style.cssText = 'position:absolute;pointer-events:auto;cursor:pointer;touch-action:manipulation';
  img.insertAdjacentElement('afterend', cv);
  img.style.visibility = 'hidden';
  const it: Item = { img, cv, rig, t0: performance.now(), phase: Math.random() * 6, react: 0, reactT: 0, n: 0 };
  place(it);
  cv.addEventListener('pointerdown', () => { it.react = 1; it.reactT = performance.now(); });
  items.add(it);
  void gl;
  if (!raf) raf = requestAnimationFrame(tick);
}

function draw(it: Item, now: number) {
  const pp = it.rig.puppet!;
  const gl = MeshGL.get()!;
  const t = (now - it.t0) / 1000;
  const pose = puppetPose({}, t, it.phase, { alive: true, moving: false });
  // 点一下：挥手 + 歪头 + 蹦一下，约 1 秒内衰减
  if (it.react > 0) {
    const k = Math.max(0, 1 - (now - it.reactT) / 1100);
    it.react = k;
    const e = k * k;
    pose.main += -48 * e * (0.7 + 0.3 * Math.sin(t * 22));
    pose.head += 9 * e;
    pose.tail += 14 * e * Math.sin(t * 18);
    pose.dy -= 10 * e * Math.abs(Math.sin((1 - k) * 9));
    pose.squash += 0.25 * e * Math.sin((1 - k) * 14);
  }
  const pos = pp.mesh.deform(pose);
  const ps = it.rig.scale * 0.75;
  const rw = 1.6 * pp.w, rh = 1.4 * pp.h;
  const pw = it.cv.width, ph = it.cv.height;
  const [sx, sy, sw, sh] = gl.render(pp.mesh, pp.tex, pos, [-0.3 * pp.w, -0.2 * pp.h, rw, rh], pw, ph);
  const ctx = it.cv.getContext('2d')!;
  ctx.clearRect(0, 0, pw, ph);
  ctx.drawImage(gl.canvas, sx, sy, sw, sh, 0, 0, pw, ph);
  void ps;
}

function tick(now: number) {
  raf = 0;
  for (const it of items) {
    if (!it.img.isConnected) { it.cv.remove(); items.delete(it); continue; }
    if (it.n++ % 20 === 0) place(it);
    // 不在视口 / 被隐藏的不画
    if (it.cv.offsetParent === null) continue;
    draw(it, now);
  }
  if (items.size) raf = requestAnimationFrame(tick);
}

let started = false;
export function initLive(root: HTMLElement = document.body) {
  if (started || typeof MutationObserver === 'undefined') return;
  started = true;
  const scan = () => root.querySelectorAll<HTMLImageElement>('img[data-live]:not([data-on])').forEach((i) => void activate(i));
  new MutationObserver(scan).observe(root, { childList: true, subtree: true });
  scan();
}
