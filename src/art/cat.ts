// 猫猫基础绘制 v3：有机锥形肢体、渐变光影、毛发笔触、手绘质感。
// 画布 520×700（viewBox -60 -50），猫猫居中 x=200，脚底 y≈604，约 3.3 头身。
import { ink, mix, shade, tint } from './color';
import type { CatLook, Coat, EarStyle, EyeStyle, Palette } from './types';
import { renderBackGear, renderHeadGear, renderWeapon } from './gear';
import { renderBodyGear } from './garments';
import { furTicks, limbEdges, limbPath, paintDefs, paintFill, resetPaintDefs, sampleSpline, setFlatPaint, smooth } from './paint';
import type { Pt } from './paint';

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
  flat?: boolean; // 不用渐变
  mode?: 'soft' | 'cel' | 'metal' | 'cloth';
}

const isPaintable = (c: string) => /^#[0-9a-fA-F]{6}$/.test(c);
export function P(d: string, fill: string, o: PathOpts = {}): string {
  const stroke = o.noStroke ? 'none' : (o.stroke ?? ink(fill, STYLE.flat ? 0.62 : 0.46));
  const f = isPaintable(fill) && !o.flat ? paintFill(fill, o.mode ?? 'soft') : fill;
  return `<path d="${d}" fill="${f}" stroke="${stroke}" stroke-width="${((o.sw ?? 4.5) * 0.72 * (STYLE.flat ? 1.7 : 1)).toFixed(2)}" stroke-linejoin="round" stroke-linecap="round"${o.op !== undefined ? ` opacity="${o.op}"` : ''} ${o.extra ?? ''}/>`;
}

export function L(d: string, color: string, sw = 4, op = 1, extra = ''): string {
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"${op !== 1 ? ` opacity="${op}"` : ''} ${extra}/>`;
}

export function E(cx: number, cy: number, rx: number, ry: number, fill: string, o: PathOpts & { rot?: number } = {}): string {
  const stroke = o.noStroke ? 'none' : (o.stroke ?? ink(fill, 0.46));
  const f = isPaintable(fill) && !o.flat ? paintFill(fill, o.mode ?? 'soft') : fill;
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${f}" stroke="${stroke}" stroke-width="${((o.sw ?? 4.5) * 0.72).toFixed(2)}"${o.rot ? ` transform="rotate(${o.rot} ${cx} ${cy})"` : ''}${o.op !== undefined ? ` opacity="${o.op}"` : ''} ${o.extra ?? ''}/>`;
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


// ---------- 几何：头 / 身体 / 肢体（均为手工控制点 + Catmull-Rom 平滑） ----------
const mirrorPts = (r: Pt[]): Pt[] => [...r, ...r.slice(1, -1).reverse().map(([x, y]) => [400 - x, y] as Pt)];
const HEAD_R: Pt[] = [[200, 104], [240, 108], [278, 128], [299, 164], [304, 204], [295, 240], [273, 270], [240, 292], [200, 301]];
export const HEAD_D = smooth(mirrorPts(HEAD_R), true);

export function torsoD(W: number): string {
  const R: [number, number][] = [[22, 270], [50, 280], [78, 296], [92, 318], [86, 348], [74, 380], [64, 414], [62, 446], [68, 472], [48, 490], [0, 496]];
  const right: Pt[] = R.map(([dx, y]) => [200 + dx * W, y]);
  const left: Pt[] = R.slice(1, -1).reverse().map(([dx, y]) => [200 - dx * W, y] as Pt);
  return smooth([...right, ...left], true);
}
export const bodyD = torsoD;

const ARM_PTS = (W: number, side: 'L' | 'R'): Pt[] => {
  const d = side === 'R' ? 1 : -1;
  return [[200 + d * 70 * W, 312], [200 + d * 92 * W, 372], [200 + d * 82 * W, 436]];
};
const HAND = (W: number, side: 'L' | 'R'): Pt => [200 + (side === 'R' ? 1 : -1) * 82 * W, 446];
const LEG_PTS = (W: number, side: 'L' | 'R'): Pt[] => {
  const d = side === 'R' ? 1 : -1;
  return [[200 + d * 32 * W, 478], [200 + d * 38 * W, 536], [200 + d * 42 * W, 588]];
};

// 形体渲染：基础渐变 + 赛璐璐暗部（新月） + 边缘光 + 内部装饰 + 细轮廓
interface VolOpts { sw?: number; shadow?: number; lit?: Pt; rim?: number; inner?: string; mode?: 'soft' | 'cel' | 'metal' | 'cloth'; outline?: string }
export function volume(ctx: Ctx, key: string, d: string, base: string, o: VolOpts = {}): string {
  const id = `v${ctx.uid}${key}`;
  const [lx, ly] = o.lit ?? [-9, -10];
  const line = o.outline ?? ctx.line;
  if (STYLE.flat) {
    // 贴纸风：平涂两阶色 + 内部花纹 + 粗描边（描边偏深，更像描线稿）
    return (
      `<clipPath id="${id}"><path d="${d}"/></clipPath>` +
      `<path d="${d}" fill="${paintFill(base, o.mode ?? 'soft')}" stroke="none"/>` +
      `<g clip-path="url(#${id})">${o.inner ?? ''}</g>` +
      `<path d="${d}" fill="none" stroke="${shade(line, 0.35)}" stroke-width="${(o.sw ?? 3.2) * STYLE.outline}" stroke-linejoin="round"/>`
    );
  }
  return (
    `<clipPath id="${id}"><path d="${d}"/></clipPath>` +
    `<path d="${d}" fill="${paintFill(base, o.mode ?? 'soft')}" stroke="none"/>` +
    `<g clip-path="url(#${id})">` +
    `<path d="${d}" fill="${shade(base, 0.26)}" opacity="${o.shadow ?? 0.55}"/>` +
    `<path d="${d}" fill="${paintFill(base, o.mode ?? 'soft')}" transform="translate(${lx} ${ly})" filter="url(#soft2${ctx.uid})"/>` +
    `<path d="${d}" fill="none" stroke="${tint(base, 0.3)}" stroke-width="8" transform="translate(${-lx * 0.6} ${-ly * 0.6})" opacity="${o.rim ?? 0.28}"/>` +
    (o.inner ?? '') +
    `</g>` +
    `<path d="${d}" fill="none" stroke="${line}" stroke-width="${(o.sw ?? 3.2) * STYLE.outline}" stroke-linejoin="round"/>`
  );
}

// ---------- 花色 ----------
function patternHead(ctx: Ctx): string {
  const { coat, uid } = ctx;
  switch (coat.pattern) {
    case 'tabby': {
      const s = coat.stripe ?? shade(coat.base, 0.22);
      return (
        L('M 200 106 L 200 142', s, 9, 0.8) + L('M 176 110 Q 180 132 188 148', s, 8, 0.8) + L('M 224 110 Q 220 132 212 148', s, 8, 0.8) +
        L('M 100 202 Q 120 200 138 212', s, 7, 0.75) + L('M 104 226 Q 122 224 138 232', s, 6, 0.75) + L('M 300 202 Q 280 200 262 212', s, 7, 0.75) + L('M 296 226 Q 278 224 262 232', s, 6, 0.75)
      );
    }
    case 'tuxedo':
      return `<path d="M 200 156 C 182 182 140 210 140 252 C 150 292 250 292 260 252 C 260 210 218 182 200 156 Z" fill="${coat.light}"/>`;
    case 'calico': {
      const d = coat.accent ?? '#33262b';
      return `<path d="${blob(136, 146, 64, 46, -25, 2)}" fill="${coat.base}"/><path d="${blob(282, 158, 44, 58, 15, 5)}" fill="${d}"/><path d="${blob(264, 262, 26, 22, 0, 4)}" fill="${coat.base}"/>`;
    }
    case 'tortie': {
      const d = coat.accent ?? '#3a2a2c';
      return `<path d="${blob(142, 150, 60, 44, -20, 11)}" fill="${d}" opacity="0.92"/><path d="${blob(290, 196, 40, 54, 15, 12)}" fill="${d}" opacity="0.92"/><path d="${blob(176, 112, 24, 18, 0, 13)}" fill="${d}" opacity="0.85"/>`;
    }
    case 'butterfly': {
      const d = coat.accent ?? '#4a6fb0';
      const wing = (sx: number) => `<g transform="translate(200 128) scale(${sx} 1)"><path d="M 4 4 C 16 -26 48 -30 52 -6 C 54 10 30 20 4 8 Z" fill="${d}" opacity="0.9"/><path d="M 4 10 C 14 20 34 34 28 48 C 18 56 6 36 4 10 Z" fill="${d}" opacity="0.8"/></g>`;
      return wing(1) + wing(-1);
    }
    case 'cow': {
      const d = coat.accent ?? '#2e2428';
      return `<path d="${blob(144, 166, 56, 52, -10, 3)}" fill="${d}"/><path d="${blob(280, 138, 42, 40, 20, 8)}" fill="${d}"/>`;
    }
    case 'point': {
      const d = coat.accent ?? '#5a4136';
      return `<g filter="url(#soft${uid})"><path d="${blob(200, 252, 68, 52, 0, 2)}" fill="${d}" opacity="0.9"/><path d="${blob(200, 200, 34, 46, 0, 4)}" fill="${d}" opacity="0.75"/></g>`;
    }
    case 'spots': {
      const a = coat.accent ?? shade(coat.base, 0.3);
      const r = (x: number, y: number, s: number) => `<circle cx="${x}" cy="${y}" r="${s}" fill="${mix(coat.base, a, 0.3)}" stroke="${a}" stroke-width="${s * 0.45}"/>`;
      return r(150, 144, 9) + r(250, 142, 9) + r(116, 200, 7) + r(286, 200, 7) + r(200, 124, 6) + r(172, 128, 5) + r(228, 128, 5);
    }
    case 'shaded': {
      const a = coat.accent ?? shade(coat.base, 0.2);
      return `<g filter="url(#soft${uid})"><ellipse cx="200" cy="124" rx="112" ry="46" fill="${a}" opacity="0.75"/></g>`;
    }
    default:
      return '';
  }
}

function patternTorso(ctx: Ctx): string {
  const { coat, W, uid } = ctx;
  const x = (dx: number) => 200 + dx * W;
  switch (coat.pattern) {
    case 'tabby': {
      const s = coat.stripe ?? shade(coat.base, 0.22);
      let d = '';
      for (const y of [316, 346, 376, 406, 436, 466]) d += `M ${x(-96)} ${y} Q ${x(-72)} ${y + 10} ${x(-44)} ${y - 2} M ${x(96)} ${y} Q ${x(72)} ${y + 10} ${x(44)} ${y - 2} `;
      return L(d, s, 8, 0.7);
    }
    case 'tuxedo':
      return `<path d="${blob(200, 400, 52 * W, 96, 0, 3)}" fill="${coat.light}"/>`;
    case 'calico': {
      const d = coat.accent ?? '#33262b';
      return `<path d="${blob(x(-54), 350, 36 * W, 44, 20, 2)}" fill="${coat.base}"/><path d="${blob(x(56), 420, 30 * W, 40, -20, 6)}" fill="${d}"/><path d="${blob(x(-34), 466, 22 * W, 20, 0, 4)}" fill="${d}"/>`;
    }
    case 'tortie': {
      const d = coat.accent ?? '#3a2a2c';
      return `<path d="${blob(x(-52), 346, 40 * W, 48, 20, 21)}" fill="${d}" opacity="0.92"/><path d="${blob(x(56), 410, 34 * W, 44, -20, 22)}" fill="${d}" opacity="0.92"/><path d="${blob(x(-30), 468, 24 * W, 20, 0, 23)}" fill="${d}" opacity="0.9"/>`;
    }
    case 'butterfly': {
      const d = coat.accent ?? '#4a6fb0';
      const wing = (sx: number) => `<g transform="translate(200 372) scale(${sx * W} 1)"><path d="M 6 -6 C 24 -50 74 -56 80 -18 C 82 8 40 20 6 4 Z" fill="${d}" opacity="0.85"/><path d="M 6 8 C 22 22 56 40 46 70 C 28 84 8 52 6 8 Z" fill="${d}" opacity="0.75"/></g>`;
      return wing(1) + wing(-1);
    }
    case 'cow': {
      const d = coat.accent ?? '#2e2428';
      return `<path d="${blob(x(-50), 372, 38 * W, 46, 10, 3)}" fill="${d}"/><path d="${blob(x(58), 430, 30 * W, 40, -10, 7)}" fill="${d}"/>`;
    }
    case 'spots': {
      const a = coat.accent ?? shade(coat.base, 0.3);
      const r = (dx: number, y: number, s: number) => `<circle cx="${x(dx)}" cy="${y}" r="${s}" fill="${mix(coat.base, a, 0.3)}" stroke="${a}" stroke-width="${s * 0.45}"/>`;
      return r(-54, 332, 11) + r(52, 340, 10) + r(-62, 392, 12) + r(60, 402, 11) + r(-44, 446, 9) + r(46, 452, 9) + r(0, 318, 8);
    }
    case 'shaded': {
      const a = coat.accent ?? shade(coat.base, 0.2);
      return `<g filter="url(#soft${uid})"><ellipse cx="200" cy="296" rx="${100 * W}" ry="44" fill="${a}" opacity="0.7"/></g>`;
    }
    default:
      return '';
  }
}

/** 四肢 / 尾巴上的花色：沿中心线取样 */
function limbPattern(ctx: Ctx, center: Pt[], w: number, kind: 'arm' | 'leg' | 'tail'): string {
  const { coat } = ctx;
  const d = smooth(center);
  const dash = (da: string, col: string, sw: number, op = 1, extra = '') => `<path d="${d}" pathLength="100" fill="none" stroke="${col}" stroke-width="${sw}" stroke-dasharray="${da}" opacity="${op}" ${extra}/>`;
  switch (coat.pattern) {
    case 'tabby': return dash('5 9', coat.stripe ?? shade(coat.base, 0.22), w + 10, 0.75, 'stroke-dashoffset="-4"');
    case 'spots': return dash('0 11', coat.accent ?? shade(coat.base, 0.3), w * 0.28, 0.9, 'stroke-linecap="round"');
    case 'point': return `<g filter="url(#soft2${ctx.uid})">${dash('0 62 38', coat.accent ?? '#5a4136', w + 14, 0.95)}</g>`;
    case 'tuxedo': return kind === 'tail' ? dash('0 82 18', coat.light, w + 10) : `<g filter="url(#soft2${ctx.uid})">${dash('0 70 30', coat.light, w + 14, 0.95)}</g>`;
    case 'shaded': return `<g filter="url(#soft2${ctx.uid})">${dash('0 70 30', coat.accent ?? shade(coat.base, 0.2), w + 14, 0.8)}</g>`;
    case 'calico': return `<path d="${blob(center[1][0], center[1][1], w * 0.5, w * 0.7, 20, kind.length)}" fill="${coat.base}"/>`;
    case 'tortie': return `<path d="${blob(center[1][0], center[1][1], w * 0.55, w * 0.75, 15, kind.length + 5)}" fill="${coat.accent ?? '#3a2a2c'}" opacity="0.92"/>`;
    case 'butterfly': return '';
    case 'cow': return `<path d="${blob(center[1][0], center[1][1], w * 0.55, w * 0.7, -10, kind.length + 3)}" fill="${coat.accent ?? '#2e2428'}"/>`;
    default: return '';
  }
}

// ---------- 尾巴 ----------
function tailGeom(style: CatLook['tail'], W: number): { c: Pt[]; w: number[] } {
  const o = 200 + 34 * W;
  switch (style) {
    case 'bushy': return { c: [[o, 480], [o + 62, 520], [o + 120, 480], [o + 128, 410], [o + 100, 352]], w: [34, 40, 50, 54, 46] };
    case 'curl': return { c: [[o, 480], [o + 70, 530], [o + 124, 480], [o + 104, 424], [o + 66, 436], [o + 62, 462]], w: [30, 30, 28, 26, 24, 22] };
    case 'stub': return { c: [[o, 482], [o + 40, 496], [o + 56, 474]], w: [36, 36, 32] };
    case 'ring': return { c: [[o, 480], [o + 64, 522], [o + 122, 478], [o + 128, 408], [o + 98, 356]], w: [30, 30, 30, 30, 28] };
    default: return { c: [[o, 480], [o + 64, 522], [o + 122, 480], [o + 130, 410], [o + 104, 356]], w: [30, 28, 26, 26, 24] };
  }
}

export function tuft(x: number, y: number, ang: number, len: number, w: number, fill: string, line: string): string {
  const c = Math.cos(ang), s = Math.sin(ang);
  const p = (a: number, b: number) => `${(x + c * a - s * b).toFixed(1)} ${(y + s * a + c * b).toFixed(1)}`;
  return `<path d="M ${p(0, -w)} Q ${p(len * 0.5, -w * 0.7)} ${p(len, 0)} Q ${p(len * 0.5, w * 0.7)} ${p(0, w)} Z" fill="${fill}" stroke="${line}" stroke-width="2.2" stroke-linejoin="round"/>`;
}

function renderTail(ctx: Ctx): string {
  const { coat, fur, W } = ctx;
  const { c, w } = tailGeom(ctx.look.tail, W);
  const d = limbPath(c, w);
  const s = sampleSpline(c, 6);
  const end = s[s.length - 1];
  const prev = s[s.length - 4];
  const ang = Math.atan2(end[1] - prev[1], end[0] - prev[0]);
  const avgW = w.reduce((a, b) => a + b, 0) / w.length;
  const tufts = ctx.look.tail === 'bushy' || ctx.look.fluffy
    ? tuft(end[0], end[1], ang + 0.35, 24, 9, fur, ctx.line) + tuft(end[0], end[1], ang - 0.35, 24, 9, fur, ctx.line) + tuft(end[0], end[1], ang, 30, 10, fur, ctx.line)
    : '';
  let ring = '';
  if (ctx.look.tail === 'ring') ring = `<path d="${smooth(c)}" pathLength="100" fill="none" stroke="${coat.stripe ?? coat.accent ?? shade(fur, 0.3)}" stroke-width="${avgW + 14}" stroke-dasharray="7 9" opacity="0.8"/>`;
  return (
    volume(ctx, 'tail', d, fur, { inner: furTicks(0, 340, 480, 560, 70, shade(fur, 0.2), ang, 11) + limbPattern(ctx, c, avgW, 'tail') + ring }) +
    tufts
  );
}

// ---------- 爪子（手） ----------
/** 猫爪：开掌（拇指 + 三个指节凸起 + 趾缝 + 小肉垫）或握拳（四个指节横排 + 拇指压在上面）。局部坐标：原点在腕口，y 向下指向指尖。 */
function pawShape(ctx: Ctx, side: 'L' | 'R', grip: boolean): string {
  const t = side === 'R' ? -1 : 1; // 拇指在内侧
  const fill = ctx.paw;
  const line = ctx.line;
  const st = (sw = 3.4) => `stroke="${line}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"`;
  const g = (d: string, extra = '') => `<path d="${d}" fill="${paintFill(fill)}" ${st()} ${extra}/>`;
  const shade2 = shade(fill, 0.2);
  if (grip) {
    const palm = smooth([[-22, -6], [-24, 8], [-17, 20], [0, 24], [17, 20], [24, 8], [22, -6], [0, -12]], true);
    const knuckles = [-14, -4.7, 4.7, 14].map((x, i) => `<ellipse cx="${x}" cy="${20 + (i === 0 || i === 3 ? -1.5 : 0.5)}" rx="6.3" ry="7" fill="${paintFill(fill)}" ${st(2.8)}/>`).join('');
    const thumb = `<ellipse cx="${t * 15}" cy="-1" rx="8.5" ry="11" transform="rotate(${t * -18} ${t * 15} -1)" fill="${paintFill(shade(fill, 0.04))}" ${st(3)}/>`;
    return (
      volume(ctx, `fist${side}`, palm, fill, { sw: 3.4, shadow: 0.35 }) + knuckles + thumb +
      L(`M -9 15 L -9 26 M 0 16 L 0 27 M 9 15 L 9 26`, line, 1.7, 0.55) +
      `<ellipse cx="${-t * 4}" cy="-1" rx="9" ry="5" fill="${shade2}" opacity="0.22"/>`
    );
  }
  const thumb = `<ellipse cx="${t * 16}" cy="4" rx="7.5" ry="11" transform="rotate(${t * -28} ${t * 16} 4)" fill="${paintFill(shade(fill, 0.05))}" ${st(3)}/>`;
  const palm = smooth([[-17, -8], [-19, 10], [-12, 26], [0, 31], [12, 26], [19, 10], [17, -8], [0, -14]], true);
  const toes = [[-10.5, 26], [0, 31], [10.5, 26]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="8.2" ry="8" fill="${paintFill(fill)}" ${st(2.8)}/>`).join('');
  const bean = `<path d="M -5 14 Q 0 9 5 14 Q 7 20 0 22 Q -7 20 -5 14 Z" fill="${ctx.pink}" opacity="0.7"/><ellipse cx="-9" cy="22" rx="2.4" ry="2.9" fill="${ctx.pink}" opacity="0.7"/><ellipse cx="0" cy="26" rx="2.4" ry="2.9" fill="${ctx.pink}" opacity="0.7"/><ellipse cx="9" cy="22" rx="2.4" ry="2.9" fill="${ctx.pink}" opacity="0.7"/>`;
  return thumb + g(palm) + toes + L(`M -5.2 22 L -5.2 33 M 5.2 22 L 5.2 33`, line, 1.7, 0.6) + (grip ? '' : bean);
}

// ---------- 手臂 ----------
export interface Pose { R: [number, number]; L: [number, number] }
export function arm(ctx: Ctx, side: 'L' | 'R', hand: [number, number], sleeve?: string, cuff?: string, wide = false): string {
  const W = ctx.W;
  const pts = ARM_PTS(W, side);
  // 手的位置由 pose 决定：把手端点拖到 hand，肘部按比例过渡
  const sh = pts[0];
  const base = HAND(W, side);
  const dxh = hand[0] - base[0];
  const dyh = hand[1] - base[1];
  const out = side === 'R' ? 1 : -1;
  // 肘部略向外鼓，肩点略向内收进躯干里
  const c: Pt[] = [[sh[0] - out * 6, sh[1] - 4], [pts[1][0] + dxh * 0.45 + out * 4, pts[1][1] + dyh * 0.45], [hand[0], hand[1]]];
  const col = sleeve ?? ctx.fur;
  const line = sleeve ? ink(sleeve, 0.46) : ctx.line;
  const widths = (wide ? [56, 54, 60] : sleeve ? [52, 46, 40] : [50, 42, 34]).map((v) => v * STYLE.limb);
  const body = limbPath(c, widths);
  const flow = Math.atan2(c[2][1] - c[0][1], c[2][0] - c[0][0]);
  const inner = (sleeve ? '' : furTicks(80, 300, 330, 460, 40, shade(col, 0.22), flow, side === 'L' ? 4 : 5, 9, 0.32) + limbPattern(ctx, c, 28, 'arm')) +
    (sleeve ? `<path d="${smooth(c)}" fill="none" stroke="${shade(col, 0.16)}" stroke-width="3" opacity="0.4" transform="translate(${side === 'R' ? 8 : -8} 4)"/>` : '');
  // 肩头：圆润的三角肌，与躯干无缝衔接（只描外侧轮廓，起点不封口）
  const cap = `<ellipse cx="${c[0][0] + out * 4}" cy="${c[0][1] + 8}" rx="${widths[0] * 0.5}" ry="${widths[0] * 0.46}" fill="${paintFill(col, sleeve ? 'cloth' : 'soft')}" stroke="none"/>`;
  let s = volume(ctx, `arm${side}`, body, col, { outline: line, inner, mode: sleeve ? 'cloth' : 'soft', sw: 0 }) + cap +
    `<path d="${limbEdges(c, widths, { skipStart: true })}" fill="none" stroke="${line}" stroke-width="${3.6 * STYLE.outline / 1.3}" stroke-linecap="round" stroke-linejoin="round"/>`;
  // 腕口毛边 / 袖口
  const wrist = c[2];
  const prev = sampleSpline(c, 6).slice(-4)[0];
  const a = Math.atan2(wrist[1] - prev[1], wrist[0] - prev[0]);
  if (cuff) {
    const q = sampleSpline(c, 6);
    const p1 = q[Math.floor(q.length * 0.8)];
    const hl = wide ? 30 : 21;
    const seg = `M ${p1[0] - Math.sin(a) * hl} ${p1[1] + Math.cos(a) * hl} L ${p1[0] + Math.sin(a) * hl} ${p1[1] - Math.cos(a) * hl}`;
    s += `<path d="${seg}" stroke="${ink(cuff, 0.5)}" stroke-width="16" stroke-linecap="round"/><path d="${seg}" stroke="${paintFill(cuff, 'metal')}" stroke-width="11" stroke-linecap="round"/>`;
  } else if (!sleeve) {
    s += tuft(wrist[0], wrist[1] - 6, a + 1.9, 14, 5, ctx.fur, ctx.line) + tuft(wrist[0], wrist[1] - 6, a - 1.9, 14, 5, ctx.fur, ctx.line);
  }
  return s;
}
export function mitt(ctx: Ctx, hand: [number, number], side: 'L' | 'R' = 'R', grip = false): string {
  const sh = ARM_PTS(ctx.W, side)[0];
  const rot = (Math.atan2(hand[1] - sh[1], hand[0] - sh[0]) - Math.PI / 2) * (180 / Math.PI);
  return `<g transform="translate(${hand[0]} ${hand[1] + 6}) rotate(${rot.toFixed(1)}) scale(1.28)">${pawShape(ctx, side, grip)}</g>`;
}

// ---------- 腿与靴 ----------
function legSvg(ctx: Ctx, side: 'L' | 'R', pants: string | undefined, boots: string | undefined): string {
  const W = ctx.W;
  const dir = side === 'R' ? 1 : -1;
  const c = LEG_PTS(W, side);
  const col = pants ?? ctx.fur;
  const body = limbPath(c, [54, 42, 33].map((v) => v * STYLE.limb));
  const flow = Math.PI / 2;
  const inner = pants ? `<path d="${smooth(c)}" fill="none" stroke="${shade(col, 0.16)}" stroke-width="3" opacity="0.4" transform="translate(${dir * 9} 3)"/>` : furTicks(120, 470, 300, 596, 40, shade(col, 0.22), flow, side === 'L' ? 7 : 8, 9, 0.3) + limbPattern(ctx, c, 36, 'leg');
  let s = volume(ctx, `leg${side}`, body, col, { outline: pants ? ink(pants, 0.46) : ctx.line, inner, mode: pants ? 'cloth' : 'soft' });
  const ax = c[2][0];
  if (boots) {
    const shaft = smooth([[ax - 22, 548], [ax + 22, 548], [ax + 24, 588], [ax - 24, 588]], true);
    const foot = smooth([[ax - 28 + dir * 4, 584], [ax - 12 + dir * 6, 574], [ax + 18 + dir * 10, 578], [ax + 32 + dir * 16, 592], [ax + 30 + dir * 14, 604], [ax - 24 + dir * 2, 606], [ax - 30, 598]], true);
    s += volume(ctx, `boot${side}`, foot, boots, { mode: 'cel' });
    s += volume(ctx, `shaft${side}`, shaft, boots, { mode: 'cel' });
    s += `<path d="M ${ax - 23} 552 L ${ax + 23} 552 L ${ax + 23} 562 L ${ax - 23} 562 Z" fill="${paintFill(ctx.pal.trim, 'metal')}" stroke="${ink(ctx.pal.trim, 0.46)}" stroke-width="2"/>`;
  } else {
    const foot = smooth([[ax - 24, 586], [ax - 14, 574], [ax + 14, 574], [ax + 26, 586], [ax + 26 + dir * 8, 600], [ax - 26 + dir * 8, 602]], true);
    s += volume(ctx, `foot${side}`, foot, ctx.paw, { shadow: 0.4 });
    s += [-12, 0, 12].map((dx) => E(ax + dx + dir * 6, 600, 7, 6, ctx.paw, { stroke: ctx.line, sw: 3 })).join('');
    s += L(`M ${ax - 6 + dir * 6} 596 L ${ax - 6 + dir * 6} 606 M ${ax + 6 + dir * 6} 596 L ${ax + 6 + dir * 6} 606`, ctx.line, 1.8, 0.5);
  }
  return s;
}

// ---------- 颈饰 ----------
function renderNeck(ctx: Ctx): string {
  const ex = ctx.look.outfit.extra ?? [];
  let s = '';
  if (ex.includes('scarf')) {
    const c = ctx.look.outfit.pal.main;
    s += P('M 126 286 C 160 316 240 316 274 286 L 268 308 C 238 332 162 332 132 308 Z', c, { mode: 'cloth' }) + P('M 232 316 L 266 372 L 240 382 L 214 324 Z', shade(c, 0.1), { mode: 'cloth' });
  }
  if (ex.includes('bell')) {
    s += L('M 140 290 C 168 316 232 316 260 290', '#c0445a', 9) + E(200, 318, 11, 11, '#f0c75a', { sw: 3.5, mode: 'metal' }) + L('M 193 320 L 207 320', '#8a6a1c', 2.5);
  }
  if (ex.includes('tassel')) {
    const c = ctx.look.outfit.pal.trim;
    s += L('M 200 312 L 200 346', c, 6) + P('M 192 342 L 208 342 L 212 376 L 188 376 Z', ctx.look.outfit.pal.main, { sw: 3, mode: 'cloth' });
  }
  return s;
}

// ---------- 主渲染：拆成可绑骨骼的部件 ----------
export interface RenderOpts { uid?: string; width?: number; height?: number; viewBox?: string }
export const VIEW_FULL = '-60 -50 520 700';
export const DY = 48; // 武器整体下移量（武器按旧坐标绘制）
export const BACK_T = 'translate(0 270) scale(1 1.55) translate(0 -286)';
/**
 * 造型预设：比例、五官位置、肢体粗细、线条与上色方式。默认 A（2.2 头身 Q 版）。
 * B 超 Q 团子（约 1.9 头身）／ C 帅气少年（约 2.7 头身，收腰长腿，身体微扭）／ D 贴纸扁平（A 的比例，粗描边 + 平涂色阶）。
 */
export interface CatStyle {
  id: string;
  name: string;
  bodySx: number; bodySy: number; // 躯干与四肢整体缩放（绕脚底）
  headS: number; headDy: number; // 头的缩放与下移（让下巴落在肩线上）
  eyeS: number; eyeSy: number; eyeY: number; eyeX: number; // 眼睛缩放 / 纵向压扁（<1 更锐利）/ 纵向位置 / 横向间距的一半
  limb: number; // 肢体粗细倍率
  outline: number; // 描边倍率
  weapon: number; // 武器相对原尺寸的目标倍率
  weaponOff: number; // 长兵器握点外伸倍率
  lean: number; // 站姿的扭身角度（°）：躯干/头反向微扭，腿一前一后
  flat: boolean; // 平涂色阶 + 无纸纹/毛发笔触
}
export const STYLES: Record<string, CatStyle> = {
  A: { id: 'A', name: 'Q 版（当前）', bodySx: 0.86, bodySy: 0.86, headS: 1.12, headDy: 22, eyeS: 1.24, eyeSy: 1, eyeY: 225, eyeX: 49, limb: 1, outline: 1.3, weapon: 1.16, weaponOff: 1, lean: 0, flat: false },
  B: { id: 'B', name: '超 Q 团子', bodySx: 0.76, bodySy: 0.72, headS: 1.3, headDy: 44, eyeS: 1.46, eyeSy: 1.06, eyeY: 234, eyeX: 51, limb: 1.28, outline: 1.35, weapon: 1.02, weaponOff: 1.5, lean: 0, flat: false },
  C: { id: 'C', name: '帅气少年', bodySx: 0.88, bodySy: 1.12, headS: 0.86, headDy: -41, eyeS: 1.08, eyeSy: 0.8, eyeY: 216, eyeX: 50, limb: 0.8, outline: 1.25, weapon: 1.2, weaponOff: 0.75, lean: 1, flat: false },
  D: { id: 'D', name: '贴纸扁平', bodySx: 0.86, bodySy: 0.86, headS: 1.12, headDy: 22, eyeS: 1.24, eyeSy: 1, eyeY: 225, eyeX: 49, limb: 1, outline: 2.0, weapon: 1.16, weaponOff: 1, lean: 0, flat: true },
};
export let STYLE: CatStyle = STYLES.A;
export function setCatStyle(id: string) {
  STYLE = STYLES[id] ?? STYLES.A;
  setFlatPaint(STYLE.flat);
}
const bodyT = () => `translate(200 604) scale(${STYLE.bodySx} ${STYLE.bodySy}) translate(-200 -604)`;
const bodyPt = (p: [number, number]): [number, number] => [200 + (p[0] - 200) * STYLE.bodySx, 604 + (p[1] - 604) * STYLE.bodySy];
const headT = (hs: number) => `translate(200 ${221 + STYLE.headDy}) scale(${hs}) translate(-200 -210)`;

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
    uid, look, W: look.build ?? 1, coat, pal: look.outfit.pal, fur, belly, paw,
    pink: coat.pink ?? '#ec8e9e',
    line: lightFur ? ink(mix(fur, coat.accent ?? coat.base, 0.55), 0.42) : ink(fur, 0.5),
    eyeInk: '#2b1d22',
  };
}

const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
};

export function catParts(look: CatLook, uid: string): { parts: Part[]; shadow: string; defs: string } {
  resetPaintDefs();
  const ctx = buildCtx(look, uid);
  const { W, fur, line, coat } = ctx;
  const hs = (look.head ?? 1) * STYLE.headS;
  const ear = earShape(look.ear);
  const poseBase: Pose = { R: [200 + 82 * W, 446 - DY], L: [200 - 82 * W, 446 - DY] };
  const weapon = renderWeapon(ctx, poseBase);
  const poseOld: Pose = { R: weapon.pose?.R ?? poseBase.R, L: weapon.pose?.L ?? poseBase.L };
  // 长兵器握点向外挪一些：手臂斜伸出去，兵器立在身侧，不再横在脸前（Q 版大脑袋更需要留出轮廓）
  const OFF: Partial<Record<string, number>> = { glaive: 36, spear: 36, halberd: 36, staff: 30, mace: 32, whip: 28, brush: 24, axe: 30, sword: 22, bow: 16 };
  const offR = (OFF[look.outfit.weapon ?? 'none'] ?? 0) * STYLE.weaponOff;
  const pose: Pose = { R: [poseOld.R[0] + offR, poseOld.R[1] + DY], L: [poseOld.L[0], poseOld.L[1] + DY] };
  const bodyGear = renderBodyGear(ctx);
  const noBoots = look.outfit.body === 'tribal' || look.outfit.body === 'none' || look.outfit.body === 'rattan';
  const bootCol = noBoots ? undefined : (bodyGear.boots ?? shade(ctx.pal.sub, 0.05));

  // ---- 头 ----
  const earColor = coat.pattern === 'point' ? (coat.accent ?? '#5a4136') : coat.pattern === 'calico' ? coat.base : fur;
  const earOne = () =>
    `<path d="${ear.outer}" fill="${paintFill(earColor)}" stroke="none"/>` +
    L(ear.outer.replace(' Z', ''), line, 3.4) +
    `<path d="${ear.inner}" fill="${paintFill(shade(ctx.pink, 0.04))}" stroke="none" opacity="0.95"/>` +
    L('M 124 150 Q 126 126 132 108 M 136 150 Q 140 130 148 116 M 148 150 Q 154 136 160 126', tint(earColor, 0.35), 2, 0.7) +
    (look.ear === 'tuft' ? L('M 112 66 L 108 44', line, 3.4) + L('M 118 70 L 120 46', line, 3.4) + L('M 106 74 L 98 54', line, 3.4) : '') +
    (coat.pattern === 'shaded' ? `<path d="${ear.outer}" fill="${coat.accent ?? shade(fur, 0.2)}" opacity="0.5" stroke="none"/>` : '');
  const ruff = (big: boolean) => {
    const k = big ? 1.3 : 1;
    const f = (v: number) => (292 + (v - 292) * k).toFixed(1);
    const R = `M 290 190 Q ${f(318)} 190 ${f(324)} 206 Q ${f(304)} 210 ${f(316)} 226 Q ${f(298)} 230 ${f(310)} 248 Q ${f(290)} 248 ${f(298)} 266 L 266 262 Z`;
    const one = `<path d="${R}" fill="${paintFill(fur)}" stroke="${line}" stroke-width="2.6" stroke-linejoin="round"/>`;
    return one + mirror(one);
  };
  const eyeC = look.eye.color;
  const eyes =
    `<g transform="translate(${200 - STYLE.eyeX} ${STYLE.eyeY}) scale(${STYLE.eyeS} ${STYLE.eyeS * STYLE.eyeSy})">${eyeSvg(look.eye.style, eyeC, 'L', ctx)}</g>` +
    `<g transform="translate(${200 + STYLE.eyeX} ${STYLE.eyeY}) scale(${STYLE.eyeS} ${STYLE.eyeS * STYLE.eyeSy})">${eyeSvg(look.eye.style === 'wink' ? 'wide' : look.eye.style, eyeC, 'R', ctx)}</g>`;
  const muzzleCol = coat.pattern === 'tuxedo' ? coat.light : coat.pattern === 'point' ? mix(coat.accent ?? '#5a4136', fur, 0.25) : ctx.belly;
  const muzzle = `<g filter="url(#soft2${uid})" opacity="${coat.pattern === 'point' ? 0.6 : 0.95}"><ellipse cx="180" cy="254" rx="28" ry="20" fill="${muzzleCol}"/><ellipse cx="220" cy="254" rx="28" ry="20" fill="${muzzleCol}"/><ellipse cx="200" cy="276" rx="21" ry="13" fill="${muzzleCol}"/></g>`;
  const nose = `<path d="M 191 241 Q 200 235 209 241 Q 205 252 200 255 Q 195 252 191 241 Z" fill="${paintFill(ctx.pink, 'cel')}" stroke="${ink(ctx.pink, 0.5)}" stroke-width="2.4" stroke-linejoin="round"/><ellipse cx="197" cy="241" rx="3" ry="1.6" fill="#fff" opacity="0.6"/>`;
  const fang = look.eye.style === 'fierce' || look.eye.style === 'keen' ? `<path d="M 187 264 L 191 273 L 195 264 Z M 205 264 L 209 273 L 213 264 Z" fill="#fff" stroke="${ctx.eyeInk}" stroke-width="1.4" opacity="0.95"/>` : '';
  const mouth = L('M 200 255 L 200 262 M 200 262 Q 190 270 180 263 M 200 262 Q 210 270 220 263', ctx.eyeInk, 3) + fang;
  const wcol = lum(fur) < 0.5 ? '#f4efe4' : '#5a4646';
  const whiskers =
    L('M 154 258 Q 128 246 96 248 M 152 266 Q 122 262 92 270 M 156 274 Q 130 280 104 292', wcol, 1.8, 0.85) +
    L('M 246 258 Q 272 246 304 248 M 248 266 Q 278 262 308 270 M 244 274 Q 270 280 296 292', wcol, 1.8, 0.85);
  const blush = look.blush ? E(130, 256, 17, 9, '#ff8a9b', { noStroke: true, op: 0.38, flat: true }) + E(270, 256, 17, 9, '#ff8a9b', { noStroke: true, op: 0.38, flat: true }) : '';
  const cheekShade = `<path d="M 104 238 Q 128 266 152 272" fill="none" stroke="${shade(fur, 0.24)}" stroke-width="7" stroke-linecap="round" opacity="0.26"/><path d="M 296 238 Q 272 266 248 272" fill="none" stroke="${shade(fur, 0.24)}" stroke-width="7" stroke-linecap="round" opacity="0.26"/>`;
  const hg = renderHeadGear(ctx);
  const earsBoth = earOne() + mirror(earOne());
  const redFace = (look.outfit.extra ?? []).includes('redFace') ? `<g filter="url(#soft${uid})"><path d="${blob(200, 232, 84, 62, 0, 3)}" fill="#cf3f36" opacity="0.88"/></g>` : '';
  const headInner =
    patternHead(ctx) + redFace +
    furTicks(96, 110, 306, 300, 70, shade(fur, 0.22), Math.PI / 2, 21, 12, 0.3) +
    furTicks(96, 110, 306, 300, 40, tint(fur, 0.25), Math.PI / 2, 22, 10, 0.3) +
    `<ellipse cx="206" cy="308" rx="150" ry="90" fill="${shade(fur, 0.24)}" opacity="0.18"/>`;
  const headSvg =
    `<g transform="${headT(hs)}">` +
    ruff(!!look.fluffy) +
    (hg.behind ?? '') +
    (hg.hideEars ? '' : earsBoth) +
    volume(ctx, 'head', HEAD_D, fur, { inner: headInner, sw: 3.6, lit: [-12, -12] }) +
    cheekShade + muzzle + blush + eyes + nose + mouth + whiskers +
    renderFaceExtras(ctx) +
    renderBeard(ctx) +
    hg.svg +
    (hg.earsOver && !hg.hideEars ? earsBoth : '') +
    (hg.over ?? '') +
    `</g>`;

  // ---- 躯干 ----
  const belt = ['solid', 'tabby', 'spots', 'shaded'].includes(coat.pattern);
  const bellyShape = `<path d="${blob(200, 408, 44 * W, 74, 0, 6)}" fill="${ctx.belly}" opacity="0.92" filter="url(#soft2${uid})"/>`;
  const torsoInner = (belt ? bellyShape : '') + patternTorso(ctx) +
    furTicks(100, 280, 300, 490, 90, shade(fur, 0.22), Math.PI / 2, 31, 12, 0.28) +
    `<ellipse cx="200" cy="288" rx="${54 * W}" ry="20" fill="#000" opacity="0.22" filter="url(#soft${uid})"/>`;
  const chestFur = bodyGear.noChestFur ? '' : tuft(176, 288, 2.2, 22, 8, ctx.belly, line) + tuft(224, 288, 0.94, 22, 8, ctx.belly, line) + tuft(200, 296, Math.PI / 2, 24, 8, ctx.belly, line);
  const bodySvg =
    volume(ctx, 'torso', torsoD(W), fur, { inner: torsoInner, sw: 3.6 }) +
    chestFur +
    bodyGear.svg +
    renderNeck(ctx) +
    (bodyGear.overC ?? '') +
    (bodyGear.skirt ?? '');

  const legs = (side: 'L' | 'R') => legSvg(ctx, side, bodyGear.legCloth, bootCol);
  // 武器随身体缩小后会显得太小：以握点为中心放大回来（并随 Q 版手变大）
  const WK = STYLE.weapon / ((STYLE.bodySx + STYLE.bodySy) / 2);
  const wrapWAt = (hand: [number, number], dx = 0) => (svg: string) => (svg ? `<g transform="translate(${dx} ${DY}) translate(${hand[0]} ${hand[1]}) scale(${WK}) translate(${-hand[0]} ${-hand[1]})">${svg}</g>` : '');
  const wrapWL = wrapWAt(poseOld.L);
  const wrapW = wrapWAt(poseOld.R, offR);
  const armLsvg = arm(ctx, 'L', pose.L, bodyGear.sleeve, bodyGear.cuff, bodyGear.sleeveWide) + (bodyGear.overL ?? '') + wrapWL(weapon.svgL ?? '') + (weapon.noMitt ? '' : mitt(ctx, pose.L, 'L', !!weapon.svgL));
  const armRsvg = arm(ctx, 'R', pose.R, bodyGear.sleeve, bodyGear.cuff, bodyGear.sleeveWide) + (bodyGear.overR ?? '') + wrapW(weapon.svg) + (weapon.noMitt ? '' : mitt(ctx, pose.R, 'R', !!weapon.svg)) + (weapon.front ? wrapW(weapon.front) : '');

  const shL = ARM_PTS(W, 'L')[0];
  const shR = ARM_PTS(W, 'R')[0];
  const B = (svg: string) => `<g transform="${bodyT()}">${svg}</g>`;
  const parts: Part[] = [
    { id: 'back', svg: B(`<g transform="${BACK_T}">${renderBackGear(ctx)}</g>`), pivot: bodyPt([200, 300]) },
    { id: 'tail', svg: B(renderTail(ctx)), pivot: bodyPt([200 + 34 * W, 480]) },
    { id: 'legL', svg: B(legs('L')), pivot: bodyPt([200 - 32 * W, 478]) },
    { id: 'legR', svg: B(legs('R')), pivot: bodyPt([200 + 32 * W, 478]) },
    { id: 'torso', svg: B(bodySvg), pivot: bodyPt([200, 470]) },
    { id: 'armL', svg: B(armLsvg), pivot: bodyPt(shL) },
    { id: 'head', svg: headSvg, pivot: bodyPt([200, 288]) },
    { id: 'armR', svg: B(armRsvg), pivot: bodyPt(shR) },
  ];
  return { parts, shadow: `<ellipse cx="200" cy="604" rx="${136 * W}" ry="15" fill="#3a2830" opacity="0.2"/>`, defs: defsFor(uid) + paintDefs() };
}

/** 站姿：每个部件相对静止姿势的 [旋转°, 平移x, 平移y]。持长兵器时手臂外摆，让轮廓更有型。 */
export type PartXf = [number, number, number];
export type Stance = Partial<Record<PartId, PartXf>>;

export function stanceFor(look: CatLook): Stance {
  const w = look.outfit.weapon ?? 'none';
  const base: Stance = STYLE.lean ? { head: [-7, 0, 0], torso: [-5, 0, 0], tail: [-3, 0, 0], legL: [-4, 0, 0], legR: [5, 0, 0] } : { head: [2.5, 0, 0], torso: [-1, 0, 0], tail: [-3, 0, 0] };
  const polearm: Stance = { armR: [4, 0, 0], armL: [9, 0, 0] };
  const table: Partial<Record<string, Stance>> = {
    glaive: polearm, spear: polearm, halberd: polearm, staff: { armR: [3, 0, 0], armL: [7, 0, 0] }, mace: { armR: [3, 0, 0], armL: [9, 0, 0] }, whip: polearm, brush: { armR: [2, 0, 0], armL: [7, 0, 0] },
    sword: { armR: [14, 0, 0], armL: [8, 0, 0] }, dualSwords: { armR: [-26, 0, 0], armL: [26, 0, 0] }, knives: { armR: [-22, 0, 0], armL: [22, 0, 0] },
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
  <filter id="soft2${uid}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.4"/></filter>
  <filter id="paper${uid}" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="2" seed="4" result="warp"/>
    <feDisplacementMap in="SourceGraphic" in2="warp" scale="2.6" xChannelSelector="R" yChannelSelector="G" result="wob"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="1" seed="11" result="grain"/>
    <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0.2  0 0 0 0 0.12  0 0 0 0 0.12  2.4 0 0 0 -1.7" result="speck"/>
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
  // 先生成内容（会登记渐变），再输出 defs
  const inner = catInner(look, uid);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${w}" height="${h}"><defs>${defsFor(uid)}${paintDefs()}</defs>${STYLE.flat ? `<g${flip}>${inner}</g>` : `<g filter="url(#paper${uid})"><g${flip}>${inner}</g></g>`}</svg>`;
}
