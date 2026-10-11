// 猫猫基础绘制：身体 / 头 / 五官 / 花色 / 尾巴。
// 画布 400×500，猫猫脚底在 y≈460，居中 x=200。Q版2头身，圆润、软萌。
import { ink, mix, shade, tint } from './color';
import type { CatLook, Coat, EarStyle, EyeStyle, Palette } from './types';
import { renderBackGear, renderBodyGear, renderHeadGear, renderWeapon } from './gear';

export interface Ctx {
  uid: string;
  look: CatLook;
  W: number; // 体宽
  coat: Coat;
  pal: Palette;
  fur: string; // 实际打底毛色
  belly: string; // 肚皮/口鼻浅色
  paw: string; // 爪套色
  pink: string;
  line: string; // 毛色描边
  eyeInk: string;
}

// ---------- 基础绘制助手 ----------
export interface PathOpts {
  stroke?: string;
  sw?: number;
  op?: number;
  extra?: string;
  noStroke?: boolean;
}

export function P(d: string, fill: string, o: PathOpts = {}): string {
  const stroke = o.noStroke ? 'none' : (o.stroke ?? ink(fill));
  return `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${o.sw ?? 4.5}" stroke-linejoin="round" stroke-linecap="round"${o.op !== undefined ? ` opacity="${o.op}"` : ''} ${o.extra ?? ''}/>`;
}

export function L(d: string, color: string, sw = 4, op = 1, extra = ''): string {
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"${op !== 1 ? ` opacity="${op}"` : ''} ${extra}/>`;
}

export function E(cx: number, cy: number, rx: number, ry: number, fill: string, o: PathOpts & { rot?: number } = {}): string {
  const stroke = o.noStroke ? 'none' : (o.stroke ?? ink(fill));
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${o.sw ?? 4.5}"${o.rot ? ` transform="rotate(${o.rot} ${cx} ${cy})"` : ''}${o.op !== undefined ? ` opacity="${o.op}"` : ''} ${o.extra ?? ''}/>`;
}

/** 带手绘抖动感的“团”形斑块 */
export function blob(cx: number, cy: number, rx: number, ry: number, rot = 0, seed = 1): string {
  const n = 9;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + 0.16 * Math.sin(a * 3 + seed * 1.7) + 0.09 * Math.cos(a * 2 + seed);
    pts.push([Math.cos(a) * rx * k, Math.sin(a) * ry * k]);
  }
  const cr = Math.cos((rot * Math.PI) / 180);
  const sr = Math.sin((rot * Math.PI) / 180);
  const tp = pts.map(([x, y]) => [cx + x * cr - y * sr, cy + x * sr + y * cr] as [number, number]);
  let d = '';
  for (let i = 0; i < n; i++) {
    const p0 = tp[(i - 1 + n) % n];
    const p1 = tp[i];
    const p2 = tp[(i + 1) % n];
    const p3 = tp[(i + 2) % n];
    if (i === 0) d += `M ${p1[0].toFixed(1)} ${p1[1].toFixed(1)} `;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)} `;
  }
  return d + 'Z';
}

export const mirror = (inner: string) => `<g transform="translate(400 0) scale(-1 1)">${inner}</g>`;

// ---------- 形状 ----------
export const HEAD_D =
  'M 96 214 C 94 150 138 110 200 110 C 262 110 306 150 304 214 C 303 264 258 294 200 294 C 142 294 97 264 96 214 Z';

export function bodyD(W: number): string {
  const n = 46 * W;
  const sh = 72 * W;
  const wa = 56 * W;
  const hp = 64 * W;
  return `M ${200 - n} 286 C ${200 - sh * 0.96} 296 ${200 - sh} 314 ${200 - sh} 338 C ${200 - sh} 374 ${200 - wa} 398 ${200 - wa} 424 C ${200 - wa} 440 ${200 - hp} 448 ${200 - hp + 4} 458 L ${200 + hp - 4} 458 C ${200 + hp} 448 ${200 + wa} 440 ${200 + wa} 424 C ${200 + wa} 398 ${200 + sh} 374 ${200 + sh} 338 C ${200 + sh} 314 ${200 + sh * 0.96} 296 ${200 + n} 286 Z`;
}

interface EarShape { outer: string; inner: string }
function earShape(style: EarStyle): EarShape {
  switch (style) {
    case 'fold':
      return {
        outer: 'M 104 160 C 98 128 126 106 160 118 C 156 138 144 154 122 164 Z',
        inner: 'M 112 150 C 112 134 128 124 146 128 C 142 140 134 148 122 154 Z',
      };
    case 'round':
      return {
        outer: 'M 106 166 C 92 124 112 84 142 90 C 168 95 180 114 184 132 Z',
        inner: 'M 118 150 C 110 124 122 104 140 106 C 156 110 164 122 166 134 Z',
      };
    case 'big':
      return {
        outer: 'M 108 170 C 94 124 96 84 106 48 C 142 62 172 92 186 128 Z',
        inner: 'M 120 150 C 112 120 114 92 120 72 C 142 86 158 108 166 130 Z',
      };
    case 'tuft':
      return {
        outer: 'M 108 168 C 100 130 102 94 112 64 C 142 76 170 98 184 124 Z',
        inner: 'M 120 150 C 116 124 118 102 124 86 C 142 96 156 112 164 128 Z',
      };
    default:
      return {
        outer: 'M 108 168 C 100 130 102 94 112 68 C 142 78 170 98 184 124 Z',
        inner: 'M 120 150 C 116 124 118 102 124 90 C 142 98 156 112 164 128 Z',
      };
  }
}

// ---------- 眼睛 ----------
function eyeSvg(style: EyeStyle, color: string, side: 'L' | 'R', ctx: Ctx): string {
  const dark = '#2b1d22';
  const irisDark = shade(color, 0.22);
  const irisLight = tint(color, 0.16);
  const open = (rx: number, ry: number, slit = false) => {
    const pupil = slit
      ? `<ellipse cx="0" cy="1" rx="4.2" ry="${ry - 3}" fill="${dark}"/>`
      : `<ellipse cx="0" cy="1" rx="${rx * 0.56}" ry="${ry * 0.6}" fill="${dark}"/>`;
    return `
      <ellipse cx="0" cy="0" rx="${rx}" ry="${ry}" fill="${irisDark}" stroke="${dark}" stroke-width="3.2"/>
      <clipPath id="ec${ctx.uid}${side}${style}"><ellipse cx="0" cy="0" rx="${rx - 1}" ry="${ry - 1}"/></clipPath>
      <g clip-path="url(#ec${ctx.uid}${side}${style})"><ellipse cx="0" cy="${ry * 0.55}" rx="${rx * 0.95}" ry="${ry * 0.62}" fill="${irisLight}"/></g>
      ${pupil}
      <circle cx="${-rx * 0.32}" cy="${-ry * 0.36}" r="${rx * 0.36}" fill="#fff"/>
      <circle cx="${rx * 0.34}" cy="${ry * 0.42}" r="${rx * 0.17}" fill="#fff" opacity="0.9"/>`;
  };
  const flipR = (inner: string) => (side === 'R' ? `<g transform="scale(-1 1)">${inner}</g>` : inner);
  const almond = (d: string, tag: string, slitRot: number, slitRy: number) =>
    flipR(`
      <path d="${d}" fill="${irisDark}" stroke="${dark}" stroke-width="3.2"/>
      <clipPath id="ec${ctx.uid}${side}${tag}"><path d="${d}"/></clipPath>
      <g clip-path="url(#ec${ctx.uid}${side}${tag})"><ellipse cx="0" cy="8" rx="24" ry="9" fill="${irisLight}"/></g>
      <ellipse cx="0" cy="0" rx="4.4" ry="${slitRy}" fill="${dark}" transform="rotate(${slitRot})"/>
      <circle cx="-8" cy="-3" r="4.6" fill="#fff"/><circle cx="7" cy="5" r="2" fill="#fff" opacity="0.85"/>`);
  switch (style) {
    case 'happy':
      return L('M -17 5 Q 0 -16 17 5', dark, 5.5);
    case 'sleepy':
      return `${open(16, 19)}<path d="M -19 -2 Q 0 -10 19 -2 L 19 -22 L -19 -22 Z" fill="${ctx.fur}" stroke="none"/>${L('M -18 -2 Q 0 -9 18 -2', dark, 4.5)}`;
    case 'cool':
      return (
        flipR(`${open(16, 19)}<path d="M -20 -1 Q 0 -8 20 -4 L 20 -26 L -20 -26 Z" fill="${ctx.fur}" stroke="none"/>${L('M -19 -1 Q 0 -8 19 -4', dark, 5)}`) +
        flipR(L('M -24 -17 L 22 -22', dark, 4.6))
      );
    case 'calm':
      return `${open(15, 18)}<path d="M -18 -4 Q 0 -13 18 -4 L 18 -24 L -18 -24 Z" fill="${ctx.fur}" stroke="none"/>${L('M -17 -4 Q 0 -12 17 -4', dark, 4.2)}${L('M -20 -22 Q 0 -29 20 -22', dark, 3.4, 0.8)}`;
    case 'sharp':
      return almond('M -21 3 Q -4 -20 22 -6 Q 4 17 -21 3 Z', 's', 8, 11) + flipR(L('M -25 -14 Q -2 -26 24 -14', dark, 4, 0.9));
    case 'keen':
      return almond('M -23 4 Q -4 -22 24 -8 Q 6 16 -23 4 Z', 'k', 10, 12) + flipR(L('M -27 -12 Q -2 -28 26 -17', dark, 5));
    case 'fierce':
      return almond('M -21 5 Q -2 -17 22 -9 Q 6 16 -21 5 Z', 'f', 10, 10) + flipR(L('M -27 -10 L 24 -25', dark, 7.5));
    case 'wide':
      return open(19, 25);
    case 'wink':
      return side === 'L' ? L('M -17 5 Q 0 -16 17 5', dark, 5.5) : open(17, 22);
    default:
      return open(17, 22);
  }
}

// ---------- 花色 ----------
function patternHead(ctx: Ctx): string {
  const { coat, uid } = ctx;
  switch (coat.pattern) {
    case 'tabby': {
      const s = coat.stripe ?? shade(coat.base, 0.22);
      return (
        L('M 200 112 L 200 148', s, 9, 0.85) +
        L('M 177 117 Q 180 138 188 152', s, 8, 0.85) +
        L('M 223 117 Q 220 138 212 152', s, 8, 0.85) +
        L('M 97 220 Q 115 218 130 228', s, 8, 0.8) +
        L('M 100 244 Q 115 240 128 248', s, 7, 0.8) +
        L('M 303 220 Q 285 218 270 228', s, 8, 0.8) +
        L('M 300 244 Q 285 240 272 248', s, 7, 0.8)
      );
    }
    case 'tuxedo':
      return `<path d="M 200 164 C 180 188 138 214 138 258 C 158 296 242 296 262 258 C 262 214 220 188 200 164 Z" fill="${coat.light}"/>`;
    case 'calico': {
      const o = coat.base;
      const d = coat.accent ?? '#33262b';
      return (
        `<path d="${blob(138, 150, 62, 46, -25, 2)}" fill="${o}"/>` +
        `<path d="${blob(280, 160, 44, 58, 15, 5)}" fill="${d}"/>` +
        `<path d="${blob(262, 262, 26, 22, 0, 4)}" fill="${o}"/>`
      );
    }
    case 'cow': {
      const d = coat.accent ?? '#2e2428';
      return `<path d="${blob(142, 168, 56, 52, -10, 3)}" fill="${d}"/><path d="${blob(278, 140, 42, 40, 20, 8)}" fill="${d}"/>`;
    }
    case 'point': {
      const d = coat.accent ?? '#5a4136';
      return (
        `<g filter="url(#soft${uid})">` +
        `<path d="${blob(200, 256, 66, 50, 0, 2)}" fill="${d}" opacity="0.9"/>` +
        `<path d="${blob(200, 206, 36, 44, 0, 4)}" fill="${d}" opacity="0.75"/>` +
        `</g>`
      );
    }
    case 'spots': {
      const a = coat.accent ?? shade(coat.base, 0.3);
      const r = (x: number, y: number, s: number) =>
        `<circle cx="${x}" cy="${y}" r="${s}" fill="${mix(coat.base, a, 0.3)}" stroke="${a}" stroke-width="${s * 0.45}"/>`;
      return r(150, 150, 9) + r(250, 148, 9) + r(118, 205, 7) + r(284, 205, 7) + r(200, 130, 6) + r(172, 134, 5) + r(228, 134, 5);
    }
    case 'shaded': {
      const a = coat.accent ?? shade(coat.base, 0.2);
      return `<g filter="url(#soft${uid})"><ellipse cx="200" cy="128" rx="112" ry="46" fill="${a}" opacity="0.75"/></g>`;
    }
    default:
      return '';
  }
}

function patternBody(ctx: Ctx): string {
  const { coat, W, uid } = ctx;
  const x = (dx: number) => 200 + dx * W;
  switch (coat.pattern) {
    case 'tabby': {
      const s = coat.stripe ?? shade(coat.base, 0.22);
      const band = (y: number) =>
        L(`M ${x(-72)} ${y} Q ${x(-56)} ${y + 8} ${x(-38)} ${y - 2}`, s, 8, 0.8) +
        L(`M ${x(72)} ${y} Q ${x(56)} ${y + 8} ${x(38)} ${y - 2}`, s, 8, 0.8);
      return band(338) + band(368) + band(398) + band(426);
    }
    case 'tuxedo':
      return `<path d="${blob(200, 392, 46 * W, 68, 0, 3)}" fill="${coat.light}"/>`;
    case 'calico': {
      const o = coat.base;
      const d = coat.accent ?? '#33262b';
      return (
        `<path d="${blob(x(-48), 360, 36 * W, 40, 20, 2)}" fill="${o}"/>` +
        `<path d="${blob(x(52), 400, 30 * W, 36, -20, 6)}" fill="${d}"/>` +
        `<path d="${blob(x(-30), 432, 22 * W, 18, 0, 4)}" fill="${d}"/>`
      );
    }
    case 'cow': {
      const d = coat.accent ?? '#2e2428';
      return `<path d="${blob(x(-44), 370, 36 * W, 42, 10, 3)}" fill="${d}"/><path d="${blob(x(54), 410, 30 * W, 36, -10, 7)}" fill="${d}"/>`;
    }
    case 'point': {
      const d = coat.accent ?? '#5a4136';
      return `<g filter="url(#soft${uid})"><path d="${blob(200, 330, 80 * W, 40, 0, 1)}" fill="${d}" opacity="0.18"/></g>`;
    }
    case 'spots': {
      const a = coat.accent ?? shade(coat.base, 0.3);
      const r = (dx: number, y: number, s: number) =>
        `<circle cx="${x(dx)}" cy="${y}" r="${s}" fill="${mix(coat.base, a, 0.3)}" stroke="${a}" stroke-width="${s * 0.45}"/>`;
      return r(-48, 345, 11) + r(46, 352, 10) + r(-56, 395, 12) + r(54, 402, 11) + r(-38, 432, 9) + r(40, 436, 9) + r(0, 330, 8);
    }
    case 'shaded': {
      const a = coat.accent ?? shade(coat.base, 0.2);
      return `<g filter="url(#soft${uid})"><ellipse cx="200" cy="300" rx="${90 * W}" ry="40" fill="${a}" opacity="0.7"/></g>`;
    }
    default:
      return '';
  }
}

// ---------- 尾巴 ----------
function tailPath(style: CatLook['tail']): { d: string; w: number } {
  switch (style) {
    case 'bushy':
      return { d: 'M 248 440 C 330 452 372 396 352 322 C 348 304 336 292 326 288', w: 46 };
    case 'curl':
      return { d: 'M 250 440 C 340 456 358 392 322 368 C 298 352 306 330 328 340', w: 30 };
    case 'stub':
      return { d: 'M 252 440 C 290 446 304 430 300 414', w: 34 };
    case 'ring':
      return { d: 'M 250 440 C 338 456 372 396 346 330 C 336 304 320 296 312 300', w: 34 };
    default:
      return { d: 'M 250 440 C 336 452 372 392 348 322 C 342 304 330 294 322 292', w: 30 };
  }
}

function renderTail(ctx: Ctx): string {
  const { coat, fur } = ctx;
  const { d, w } = tailPath(ctx.look.tail);
  const line = ctx.line;
  let tipColor = fur;
  if (coat.pattern === 'point') tipColor = coat.accent ?? '#5a4136';
  else if (coat.pattern === 'shaded') tipColor = coat.accent ?? shade(fur, 0.2);
  else if (coat.pattern === 'tuxedo') tipColor = coat.light;
  else if (coat.pattern === 'tabby') tipColor = shade(fur, 0.22);
  let s = `<path d="${d}" fill="none" stroke="${line}" stroke-width="${w + 9}" stroke-linecap="round"/>`;
  s += `<path d="${d}" fill="none" stroke="${fur}" stroke-width="${w}" stroke-linecap="round"/>`;
  // 阴影侧
  s += `<path d="${d}" fill="none" stroke="${shade(fur, 0.14)}" stroke-width="${w * 0.4}" stroke-linecap="round" opacity="0.45" transform="translate(${w * 0.22} ${w * 0.1})"/>`;
  if (coat.pattern === 'tabby' || ctx.look.tail === 'ring') {
    const sc = coat.stripe ?? shade(coat.base, 0.22);
    s += `<path d="${d}" pathLength="100" fill="none" stroke="${sc}" stroke-width="${w}" stroke-dasharray="5 8" stroke-dashoffset="-6" opacity="0.8"/>`;
  }
  if (coat.pattern === 'spots') {
    const sc = coat.accent ?? shade(coat.base, 0.3);
    s += `<path d="${d}" pathLength="100" fill="none" stroke="${sc}" stroke-width="${w * 0.3}" stroke-dasharray="0 10" stroke-linecap="round" opacity="0.9"/>`;
  }
  if (tipColor !== fur) {
    s += `<path d="${d}" pathLength="100" fill="none" stroke="${tipColor}" stroke-width="${w}" stroke-dasharray="0 82 18" stroke-linecap="round"/>`;
  }
  return s;
}

// ---------- 手臂 / 爪 ----------
export interface Pose { R: [number, number]; L: [number, number] }

export function arm(ctx: Ctx, side: 'L' | 'R', hand: [number, number], sleeve?: string, cuff?: string): string {
  const sx = side === 'R' ? 200 + 58 * ctx.W : 200 - 58 * ctx.W;
  const sy = 322;
  const [hx, hy] = hand;
  const cx = side === 'R' ? Math.max(sx, hx) + 10 : Math.min(sx, hx) - 10;
  const cy = (sy + hy) / 2 - 2;
  const d = `M ${sx} ${sy} Q ${cx} ${cy} ${hx} ${hy}`;
  const col = sleeve ?? ctx.fur;
  const o = sleeve ? ink(sleeve) : ctx.line;
  let cuffSvg = '';
  if (cuff) {
    const q = (t: number): [number, number] => [(1 - t) ** 2 * sx + 2 * (1 - t) * t * cx + t * t * hx, (1 - t) ** 2 * sy + 2 * (1 - t) * t * cy + t * t * hy];
    const a = q(0.74);
    const b = q(0.9);
    const seg = `M ${a[0].toFixed(1)} ${a[1].toFixed(1)} L ${b[0].toFixed(1)} ${b[1].toFixed(1)}`;
    cuffSvg = `<path d="${seg}" stroke="${ink(cuff)}" stroke-width="41" stroke-linecap="round" fill="none"/><path d="${seg}" stroke="${cuff}" stroke-width="33" stroke-linecap="round" fill="none"/>`;
  }
  return (
    `<path d="${d}" fill="none" stroke="${o}" stroke-width="35" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="${col}" stroke-width="27" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="${shade(col, 0.14)}" stroke-width="12" stroke-linecap="round" opacity="0.35" transform="translate(${side === 'R' ? 6 : -6} 3)"/>` +
    cuffSvg
  );
}

export function mitt(ctx: Ctx, hand: [number, number]): string {
  const [x, y] = hand;
  return (
    E(x, y, 17, 16, ctx.paw, { stroke: ctx.line, sw: 4 }) +
    L(`M ${x - 5} ${y + 5} L ${x - 5} ${y + 12}`, ctx.line, 2.5, 0.6) +
    L(`M ${x + 5} ${y + 5} L ${x + 5} ${y + 12}`, ctx.line, 2.5, 0.6)
  );
}

// ---------- 脸部附加 ----------
function renderFaceExtras(ctx: Ctx): string {
  const ex = ctx.look.outfit.extra ?? [];
  let s = '';
  if (ex.includes('warPaint')) {
    const c = ctx.look.outfit.pal.sub;
    s += L('M 128 246 L 162 258', c, 6, 0.9) + L('M 128 262 L 158 270', c, 6, 0.9) + L('M 272 246 L 238 258', c, 6, 0.9) + L('M 272 262 L 242 270', c, 6, 0.9);
  }
  if (ex.includes('scar')) {
    s += L('M 126 176 L 176 248', '#8c3b3b', 5, 0.9) + L('M 140 216 L 158 208', '#8c3b3b', 4, 0.9) + L('M 148 232 L 166 224', '#8c3b3b', 4, 0.9);
  }
  if (ex.includes('eyepatch')) {
    s +=
      L('M 104 176 L 296 196', '#2a1d22', 6) +
      `<path d="M 130 200 C 130 186 150 180 170 186 C 184 192 186 214 176 230 C 164 244 138 240 132 226 Z" fill="#2f2328" stroke="#150d10" stroke-width="3.5"/>` +
      L('M 140 196 C 148 190 160 190 168 194', '#5a4650', 3, 0.8);
  }
  if (ex.includes('monocle')) {
    s += `<circle cx="244" cy="214" r="27" fill="#bfe8ff" fill-opacity="0.22" stroke="#c9a24b" stroke-width="4"/>` + L('M 258 238 Q 268 270 262 296', '#c9a24b', 2.5);
  }
  if (ex.includes('earring')) {
    s += E(106, 190, 6, 6, '#e8c15a', { sw: 2.5 }) + E(106, 205, 5, 7, '#e8c15a', { sw: 2.5 });
  }
  return s;
}

function renderBeard(ctx: Ctx): string {
  const ex = ctx.look.outfit.extra ?? [];
  const c = shade(ctx.fur, 0.18);
  const light = ctx.coat.pattern === 'tuxedo' ? '#fff' : ctx.belly;
  if (ex.includes('beardLong')) {
    // 美髯：一缕长须垂到胸前
    const d = 'M 150 274 C 148 304 168 336 200 394 C 232 336 252 304 250 274 C 232 286 168 286 150 274 Z';
    return (
      `<path d="${d}" fill="${c}" stroke="${ink(c)}" stroke-width="4.5" stroke-linejoin="round"/>` +
      L('M 174 294 Q 184 336 200 380', tint(c, 0.18), 3, 0.5) +
      L('M 226 294 Q 216 336 200 380', tint(c, 0.18), 3, 0.5) +
      L('M 200 296 L 200 386', tint(c, 0.18), 3, 0.5)
    );
  }
  if (ex.includes('beardGoat')) {
    return `<path d="M 184 284 C 184 312 192 326 200 336 C 208 326 216 312 216 284 Z" fill="${light}" stroke="${ink(light)}" stroke-width="4" stroke-linejoin="round"/>`;
  }
  return '';
}

function renderNeck(ctx: Ctx): string {
  const ex = ctx.look.outfit.extra ?? [];
  let s = '';
  if (ex.includes('scarf')) {
    const c = ctx.look.outfit.pal.main;
    s += P('M 128 292 C 160 320 240 320 272 292 L 266 310 C 236 336 164 336 134 310 Z', c) + P('M 230 318 L 262 372 L 238 380 L 214 326 Z', shade(c, 0.1));
  }
  if (ex.includes('bell')) {
    s += L('M 134 296 C 164 322 236 322 266 296', '#c0445a', 9) + E(200, 326, 11, 11, '#f0c75a', { sw: 3.5 }) + L('M 193 328 L 207 328', '#8a6a1c', 2.5);
  }
  if (ex.includes('tassel')) {
    const c = ctx.look.outfit.pal.trim;
    s += L('M 200 316 L 200 350', c, 6) + P('M 192 346 L 208 346 L 212 380 L 188 380 Z', ctx.look.outfit.pal.main, { sw: 3 });
  }
  return s;
}


// ---------- 主渲染：拆成可绑骨骼的部件 ----------
export interface RenderOpts { uid?: string; width?: number; height?: number; viewBox?: string }
export const VIEW_FULL = '-60 -50 520 700';
export const DY = 48; // 武器/手的整体下移量（旧坐标 -> 新体型）
export const TORSO_T = 'translate(0 270) scale(1 1.235) translate(0 -286)';
export const BACK_T = 'translate(0 270) scale(1 1.55) translate(0 -286)';
export const HEAD_BASE = 0.86;
const headT = (hs: number) => `translate(200 221) scale(${hs}) translate(-200 -210)`;

export type PartId = 'back' | 'tail' | 'legL' | 'legR' | 'torso' | 'armL' | 'head' | 'armR';
export interface Part { id: PartId; svg: string; pivot: [number, number] }
export const PART_ORDER: PartId[] = ['back', 'tail', 'legL', 'legR', 'torso', 'armL', 'head', 'armR'];

let uidCounter = 0;

export function buildCtx(look: CatLook, uid: string): Ctx {
  const coat = look.coat;
  const lightFur = coat.pattern === 'calico' || coat.pattern === 'cow' || coat.pattern === 'point';
  const fur = lightFur ? coat.light : coat.base;
  const belly = lightFur ? tint(coat.light, 0.06) : coat.light;
  let paw = belly;
  if (coat.pattern === 'point') paw = coat.accent ?? '#5a4136';
  else if (coat.pattern === 'solid' || coat.pattern === 'tabby' || coat.pattern === 'spots' || coat.pattern === 'shaded') paw = mix(fur, belly, 0.55);
  return {
    uid,
    look,
    W: look.build ?? 1,
    coat,
    pal: look.outfit.pal,
    fur,
    belly,
    paw,
    pink: coat.pink ?? '#ec8e9e',
    line: lightFur ? ink(mix(fur, coat.accent ?? coat.base, 0.55), 0.38) : ink(fur, 0.42),
    eyeInk: '#2b1d22',
  };
}

function legSvg(ctx: Ctx, side: 'L' | 'R', pants: string | undefined, boots: string | undefined): string {
  const W = ctx.W;
  const dir = side === 'L' ? -1 : 1;
  const hx = 200 + dir * 30 * W;
  const kx = 200 + dir * 36 * W;
  const ax = 200 + dir * 42 * W;
  const d = `M ${hx} 462 Q ${kx + dir * 4} 520 ${ax} 574`;
  const col = pants ?? ctx.fur;
  const o = pants ? ink(pants) : ctx.line;
  const bootCol = boots;
  let s = `<path d="${d}" fill="none" stroke="${o}" stroke-width="45" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${col}" stroke-width="37" stroke-linecap="round"/>`;
  s += `<path d="${d}" fill="none" stroke="${shade(col, 0.14)}" stroke-width="14" stroke-linecap="round" opacity="0.3" transform="translate(${dir * 7} 2)"/>`;
  if (pants) s += `<path d="M ${kx - 20} 520 Q ${kx} 530 ${kx + 20} 520" fill="none" stroke="${ctx.pal.trim}" stroke-width="5" opacity="0.8" stroke-linecap="round"/>`;
  if (bootCol) {
    s += P(`M ${ax - 23} 548 L ${ax + 23} 548 L ${ax + 25} 584 C ${ax + 25} 590 ${ax + 26} 596 ${ax + 30} 598 L ${ax - 30} 598 C ${ax - 26} 596 ${ax - 24} 590 ${ax - 24} 584 Z`, bootCol, { sw: 4 });
    s += E(ax + dir * 12, 596, 32, 11, shade(bootCol, 0.1), { sw: 4 });
    s += P(`M ${ax - 25} 552 L ${ax + 25} 552 L ${ax + 25} 562 L ${ax - 25} 562 Z`, ctx.pal.trim, { sw: 3, op: 0.9 });
  } else {
    s += E(ax + dir * 12, 592, 32, 15, ctx.paw, { stroke: ctx.line, sw: 4.5 });
    s += L(`M ${ax + dir * 12 - 8} 590 L ${ax + dir * 12 - 8} 600 M ${ax + dir * 12 + 8} 590 L ${ax + dir * 12 + 8} 600`, ctx.line, 2.5, 0.5);
  }
  return s;
}

export function catParts(look: CatLook, uid: string): { parts: Part[]; shadow: string; defs: string } {
  const ctx = buildCtx(look, uid);
  const { W, fur, line, coat } = ctx;
  const bodyPath = bodyD(W);
  const hs = (look.head ?? 1) * HEAD_BASE;
  const ear = earShape(look.ear);
  const poseBase: Pose = { R: [200 + 96 * W, 392], L: [200 - 96 * W, 392] };
  const weapon = renderWeapon(ctx, poseBase);
  const poseOld: Pose = { R: weapon.pose?.R ?? poseBase.R, L: weapon.pose?.L ?? poseBase.L };
  const pose: Pose = { R: [poseOld.R[0], poseOld.R[1] + DY], L: [poseOld.L[0], poseOld.L[1] + DY] };
  const bodyGear = renderBodyGear(ctx);
  const noBoots = look.outfit.body === 'tribal' || look.outfit.body === 'none' || look.outfit.body === 'rattan';
  const bootCol = noBoots ? undefined : (bodyGear.boots ?? shade(ctx.pal.sub, 0.05));

  // 耳朵
  const earColor = coat.pattern === 'point' ? (coat.accent ?? '#5a4136') : coat.pattern === 'calico' ? coat.base : fur;
  const earOne = () =>
    P(ear.outer, earColor, { noStroke: true }) +
    L(ear.outer.replace(' Z', ''), line, 4.5) +
    P(ear.inner, ctx.pink, { noStroke: true, op: 0.85 }) +
    (look.ear === 'tuft' ? L('M 112 66 L 108 44', line, 4) + L('M 118 70 L 120 46', line, 4) + L('M 106 74 L 98 54', line, 4) : '') +
    (coat.pattern === 'shaded' ? `<path d="${ear.outer}" fill="${coat.accent ?? shade(fur, 0.2)}" opacity="0.5" stroke="none"/>` : '');
  const cheekFluff = look.fluffy
    ? `<path d="M 104 232 L 80 244 L 102 250 L 86 268 L 112 264 L 106 284 L 128 270 Z" fill="${fur}" stroke="${line}" stroke-width="4.5" stroke-linejoin="round"/>` +
      mirror(`<path d="M 104 232 L 80 244 L 102 250 L 86 268 L 112 264 L 106 284 L 128 270 Z" fill="${fur}" stroke="${line}" stroke-width="4.5" stroke-linejoin="round"/>`)
    : '';
  const eyeC = look.eye.color;
  const eyes =
    `<g transform="translate(155 218) scale(1.02)">${eyeSvg(look.eye.style, eyeC, 'L', ctx)}</g>` +
    `<g transform="translate(245 218) scale(1.02)">${eyeSvg(look.eye.style === 'wink' ? 'wide' : look.eye.style, eyeC, 'R', ctx)}</g>`;
  const muzzleCol = coat.pattern === 'tuxedo' ? coat.light : coat.pattern === 'point' ? mix(coat.accent ?? '#5a4136', fur, 0.25) : ctx.belly;
  const muzzle = `<ellipse cx="200" cy="258" rx="35" ry="24" fill="${muzzleCol}" opacity="${coat.pattern === 'point' ? 0.55 : 0.92}"/>`;
  const nose = P('M 191 240 Q 200 235 209 240 Q 205 249 200 252 Q 195 249 191 240 Z', ctx.pink, { stroke: ink(ctx.pink, 0.45), sw: 3 });
  const mouth = L('M 200 252 L 200 258 M 200 258 Q 191 266 182 259 M 200 258 Q 209 266 218 259', ctx.eyeInk, 3.4);
  const whiskers =
    L('M 152 254 L 106 244 M 152 261 L 102 263 M 154 268 L 110 282', ink(fur, 0.3), 2.4, 0.55) +
    L('M 248 254 L 294 244 M 248 261 L 298 263 M 246 268 L 290 282', ink(fur, 0.3), 2.4, 0.55);
  const blush = look.blush ? E(130, 254, 17, 9, '#ff8a9b', { noStroke: true, op: 0.4 }) + E(270, 254, 17, 9, '#ff8a9b', { noStroke: true, op: 0.4 }) : '';
  // 颧骨阴影：让脸更有骨相、更“帅”
  const cheekShade = `<path d="M 104 236 Q 128 262 150 268" fill="none" stroke="${shade(fur, 0.22)}" stroke-width="7" stroke-linecap="round" opacity="0.28"/><path d="M 296 236 Q 272 262 250 268" fill="none" stroke="${shade(fur, 0.22)}" stroke-width="7" stroke-linecap="round" opacity="0.28"/>`;
  const rim = (d: string, col: string) => `<path d="${d}" fill="none" stroke="${tint(col, 0.28)}" stroke-width="9" opacity="0.42" transform="translate(7 7)"/>`;

  const hg = renderHeadGear(ctx);
  const earsBoth = earOne() + mirror(earOne());
  const headSvg =
    `<g transform="${headT(hs)}">` +
    cheekFluff +
    (hg.behind ?? '') +
    (hg.hideEars ? '' : earsBoth) +
    `<clipPath id="hc${uid}"><path d="${HEAD_D}"/></clipPath>` +
    P(HEAD_D, fur, { stroke: line, sw: 5.5 }) +
    `<g clip-path="url(#hc${uid})">` +
    patternHead(ctx) +
    ((look.outfit.extra ?? []).includes('redFace') ? `<g filter="url(#soft${uid})"><path d="${blob(200, 232, 82, 60, 0, 3)}" fill="#cf3f36" opacity="0.88"/></g>` : '') +
    `<ellipse cx="214" cy="326" rx="150" ry="98" fill="${shade(fur, 0.22)}" opacity="0.3"/>` +
    rim(HEAD_D, fur) +
    `<g filter="url(#soft${uid})"><ellipse cx="156" cy="146" rx="44" ry="17" fill="#fff" opacity="0.24" transform="rotate(-18 156 146)"/></g>` +
    `</g>` +
    cheekShade + muzzle + blush + eyes + nose + mouth + whiskers +
    renderFaceExtras(ctx) +
    renderBeard(ctx) +
    hg.svg +
    (hg.earsOver && !hg.hideEars ? earsBoth : '') +
    (hg.over ?? '') +
    `</g>`;

  const belt = coat.pattern === 'solid' || coat.pattern === 'tabby' || coat.pattern === 'spots' || coat.pattern === 'shaded';
  const bodySvg =
    `<g transform="${TORSO_T}">` +
    `<clipPath id="bc${uid}"><path d="${bodyPath}"/></clipPath>` +
    P(bodyPath, fur, { stroke: line, sw: 5 }) +
    `<g clip-path="url(#bc${uid})">` +
    patternBody(ctx) +
    (belt ? `<ellipse cx="200" cy="404" rx="${36 * W}" ry="50" fill="${ctx.belly}" opacity="0.9"/>` : '') +
    `<ellipse cx="${232 + 20 * W}" cy="430" rx="${70 * W}" ry="90" fill="${shade(fur, 0.22)}" opacity="0.24"/>` +
    rim(bodyPath, fur) +
    `<g filter="url(#soft${uid})"><ellipse cx="${160 - 10 * W}" cy="334" rx="22" ry="12" fill="#fff" opacity="0.22" transform="rotate(-24 ${160 - 10 * W} 334)"/></g>` +
    `</g>` +
    bodyGear.svg +
    renderNeck(ctx) +
    (bodyGear.overC ?? '') +
    `</g>` +
    (bodyGear.skirt ?? '');

  const legs = (side: 'L' | 'R') => legSvg(ctx, side, bodyGear.legCloth, bootCol);
  const handL = pose.L;
  const handR = pose.R;
  const wrapW = (svg: string) => (svg ? `<g transform="translate(0 ${DY})">${svg}</g>` : '');
  const armLsvg =
    arm(ctx, 'L', handL, bodyGear.sleeve, bodyGear.cuff) +
    (bodyGear.overL ? `<g transform="${TORSO_T}">${bodyGear.overL}</g>` : '') +
    wrapW(weapon.svgL ?? '') +
    (weapon.noMitt ? '' : mitt(ctx, handL));
  const armRsvg =
    arm(ctx, 'R', handR, bodyGear.sleeve, bodyGear.cuff) +
    (bodyGear.overR ? `<g transform="${TORSO_T}">${bodyGear.overR}</g>` : '') +
    wrapW(weapon.svg) +
    (weapon.noMitt ? '' : mitt(ctx, handR)) +
    (weapon.front ? wrapW(weapon.front) : '');

  const tailT = 'translate(250 480) scale(1.12) translate(-250 -440)';
  const sh = 200 - 58 * W;
  const parts: Part[] = [
    { id: 'back', svg: `<g transform="${BACK_T}">${renderBackGear(ctx)}</g>`, pivot: [200, 300] },
    { id: 'tail', svg: `<g transform="${tailT}">${renderTail(ctx)}</g>`, pivot: [250, 480] },
    { id: 'legL', svg: legs('L'), pivot: [200 - 30 * W, 466] },
    { id: 'legR', svg: legs('R'), pivot: [200 + 30 * W, 466] },
    { id: 'torso', svg: bodySvg, pivot: [200, 470] },
    { id: 'armL', svg: armLsvg, pivot: [sh, 322] },
    { id: 'head', svg: headSvg, pivot: [200, 288] },
    { id: 'armR', svg: armRsvg, pivot: [200 + 58 * W, 322] },
  ];
  return { parts, shadow: `<ellipse cx="200" cy="604" rx="${130 * W}" ry="15" fill="#3a2830" opacity="0.2"/>`, defs: defsFor(uid) };
}

/** 站姿：每个部件相对静止姿势的 [旋转°, 平移x, 平移y]。持长兵器时手臂外摆，让轮廓更有型。 */
export type PartXf = [number, number, number];
export type Stance = Partial<Record<PartId, PartXf>>;

export function stanceFor(look: CatLook): Stance {
  const w = look.outfit.weapon ?? 'none';
  const base: Stance = { head: [2.5, 0, 0], torso: [-1, 0, 0], tail: [-3, 0, 0] };
  const polearm: Stance = { armR: [-13, 0, 0], armL: [7, 0, 0] };
  const table: Partial<Record<string, Stance>> = {
    glaive: polearm, spear: polearm, halberd: polearm, staff: { armR: [-9, 0, 0], armL: [6, 0, 0] }, mace: { armR: [-16, 0, 0], armL: [7, 0, 0] }, whip: polearm, brush: { armR: [-10, 0, 0], armL: [6, 0, 0] },
    sword: { armR: [-30, 0, 0], armL: [8, 0, 0] }, dualSwords: { armR: [-26, 0, 0], armL: [26, 0, 0] }, knives: { armR: [-22, 0, 0], armL: [22, 0, 0] },
    bow: { armR: [-6, 0, 0], armL: [8, 0, 0] }, fan: { armR: [-5, 0, 0], armL: [8, 0, 0] }, none: { armR: [-6, 0, 0], armL: [6, 0, 0] },
    drum: { armL: [6, 0, 0], armR: [-8, 0, 0] }, scroll: { armL: [6, 0, 0] }, talisman: { armL: [8, 0, 0] }, coins: { armL: [8, 0, 0] }, herbs: { armR: [-4, 0, 0] },
  };
  return { ...base, ...(table[w] ?? {}) };
}

export function xfWrap(p: Part, t?: PartXf): string {
  if (!t) return p.svg;
  return `<g transform="translate(${t[1]} ${t[2]}) rotate(${t[0]} ${p.pivot[0]} ${p.pivot[1]})">${p.svg}</g>`;
}

export function catInner(look: CatLook, uid: string): string {
  const { parts, shadow } = catParts(look, uid);
  const st = look.stance === false ? {} : stanceFor(look);
  return shadow + parts.map((p) => xfWrap(p, st[p.id])).join('');
}

export function defsFor(uid: string): string {
  return `
  <filter id="soft${uid}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="7"/></filter>
  <filter id="paper${uid}" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="2" seed="4" result="warp"/>
    <feDisplacementMap in="SourceGraphic" in2="warp" scale="3.4" xChannelSelector="R" yChannelSelector="G" result="wob"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="1" seed="11" result="grain"/>
    <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0.2  0 0 0 0 0.12  0 0 0 0 0.12  2.4 0 0 0 -1.68" result="speck"/>
    <feComposite in="speck" in2="wob" operator="in" result="speckIn"/>
    <feMerge><feMergeNode in="wob"/><feMergeNode in="speckIn"/></feMerge>
  </filter>`;
}

export function catSvg(look: CatLook, o: RenderOpts = {}): string {
  const uid = o.uid ?? `c${++uidCounter}`;
  const w = o.width ?? 400;
  const vb = o.viewBox ?? VIEW_FULL;
  const [, , vw, vh] = vb.split(' ').map(Number);
  const h = o.height ?? Math.round((w * vh) / vw);
  const flip = look.flip ? ' transform="translate(400 0) scale(-1 1)"' : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${w}" height="${h}"><defs>${defsFor(uid)}</defs><g filter="url(#paper${uid})"><g${flip}>${catInner(look, uid)}</g></g></svg>`;
}
