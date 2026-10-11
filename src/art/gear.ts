// 装束：头饰 / 身体服饰 / 背饰。坐标均与 cat.ts 同一画布（400×500）。
import { E, L, P, blob, mirror } from './cat';
import type { Ctx, Pose } from './cat';
import { ink, shade, tint } from './color';
import type { BackGear, HeadGear } from './types';
import { renderWeaponImpl } from './weapons';

export interface HeadOut {
  behind?: string; // 画在头后面（羽毛、发髻、飘带）
  svg: string; // 画在头上
  earsOver?: boolean; // 画完头饰后把猫耳重新画在上面（耳朵从头盔洞里伸出）
  over?: string; // 耳朵之上
  hideEars?: boolean; // 头饰自带耳朵（虎头帽）
}
export interface WeaponOut {
  svg: string; // 右手部件（旧坐标，整体下移 DY）
  svgL?: string; // 左手部件
  pose?: Partial<Pose>;
  noMitt?: boolean;
  hands?: string;
  front?: string;
}

const NONE: HeadOut = { svg: '' };

// ---------- 小工具 ----------
/** 鳞甲纹：规则排布的小弧线 */
export function scales(x0: number, x1: number, y0: number, y1: number, col: string, step = 14): string {
  let s = '';
  let row = 0;
  for (let y = y0; y < y1; y += step * 0.72, row++) {
    for (let x = x0 + (row % 2 ? step / 2 : 0); x < x1; x += step) {
      s += `M ${x.toFixed(1)} ${y.toFixed(1)} q ${step / 2} ${step * 0.62} ${step} 0 `;
    }
  }
  return L(s, col, 2.2, 0.75);
}

function rivets(pts: [number, number][], col: string, r = 3): string {
  return pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${col}" stroke="${ink(col)}" stroke-width="1.5"/>`).join('');
}


function feather(cx: number, cy: number, ang: number, len: number, wid: number, col: string, tip?: string): string {
  const d = `M 0 0 C ${wid} ${-len * 0.25} ${wid * 0.9} ${-len * 0.75} 0 ${-len} C ${-wid * 0.9} ${-len * 0.75} ${-wid} ${-len * 0.25} 0 0 Z`;
  return (
    `<g transform="translate(${cx} ${cy}) rotate(${ang})">` +
    P(d, col, { sw: 3.2 }) +
    (tip ? `<path d="M 0 ${-len * 0.62} C ${wid * 0.7} ${-len * 0.7} ${wid * 0.7} ${-len * 0.9} 0 ${-len} C ${-wid * 0.7} ${-len * 0.9} ${-wid * 0.7} ${-len * 0.7} 0 ${-len * 0.62} Z" fill="${tip}" opacity="0.9"/>` : '') +
    L(`M 0 -4 L 0 ${-len * 0.92}`, ink(col), 2.4, 0.65) +
    `</g>`
  );
}

// ---------- 头饰 ----------
export function renderHeadGear(ctx: Ctx): HeadOut {
  const kind: HeadGear = ctx.look.outfit.head ?? 'none';
  const { main, sub, trim } = ctx.pal;
  const cloth = ctx.pal.cloth ?? '#f3efe4';
  const uid = ctx.uid;
  switch (kind) {
    case 'helmetWei': {
      const dome = 'M 114 184 C 106 118 150 86 200 86 C 250 86 294 118 286 184 Q 200 164 114 184 Z';
      return {
        behind: P('M 200 90 C 186 36 236 6 276 20 C 252 40 238 64 222 96 Z', main) + L('M 206 80 C 226 52 246 36 264 28', tint(main, 0.2), 3, 0.7),
        svg:
          P(dome, sub) +
          `<g clip-path="url(#hc${uid})"></g>` +
          `<path d="M 130 120 C 150 98 176 92 196 92" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity="0.2"/>` +
          P('M 112 180 Q 200 160 288 180 L 286 198 Q 200 178 114 198 Z', trim) +
          P('M 192 88 L 208 88 L 207 168 L 193 168 Z', trim, { sw: 3.5 }) +
          E(200, 84, 10, 10, trim) +
          rivets([[136, 178], [164, 172], [236, 172], [264, 178]], tint(trim, 0.2), 3.2),
        earsOver: true,
      };
    }
    case 'helmetGeneral': {
      const dome = 'M 114 184 C 106 118 150 84 200 84 C 250 84 294 118 286 184 Q 200 164 114 184 Z';
      const wing = P('M 124 150 C 90 140 70 108 78 64 C 100 84 124 100 142 120 Z', trim, { sw: 3.5 });
      return {
        behind: wing + mirror(wing),
        svg:
          P(dome, trim) +
          `<path d="M 134 116 C 152 98 176 92 196 92" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity="0.3"/>` +
          P('M 112 180 Q 200 160 288 180 L 286 198 Q 200 178 114 198 Z', main) +
          L('M 200 90 L 200 170', ink(trim), 3, 0.5) +
          // 红缨
          P('M 190 90 C 172 66 182 40 200 34 C 218 40 228 66 210 90 Z', main) +
          L('M 190 76 C 194 60 198 50 200 44 M 210 76 C 206 60 202 50 200 44 M 200 84 L 200 46', ink(main), 2.6, 0.6) +
          E(200, 32, 9, 9, tint(main, 0.1), { sw: 3 }),
        earsOver: true,
      };
    }
    case 'ratCap': {
      const capC = cloth;
      const ear = (x: number) => E(x, 112, 24, 24, tint(capC, 0.05), { sw: 3.6 }) + E(x, 114, 13, 13, ctx.fur === '#000' ? '#e8a0a8' : '#f0b0b8', { sw: 0, op: 0.9 });
      return {
        svg:
          ear(146) + ear(254) +
          P('M 124 176 C 118 124 156 104 200 104 C 244 104 282 124 276 176 Q 200 158 124 176 Z', capC) +
          L('M 160 118 C 156 132 156 146 160 160 M 240 118 C 244 132 244 146 240 160', ink(capC), 2.6, 0.4) +
          P('M 122 170 Q 200 154 278 170 L 278 184 Q 200 168 122 184 Z', main) +
          E(200, 166, 6, 6, trim, { sw: 2.6 }),
        hideEars: true,
      };
    }
    case 'hood': {
      const c = shade(main, 0.25);
      return {
        behind: P('M 262 178 C 296 200 300 250 286 292 C 276 262 262 226 252 196 Z', c) + P('M 138 178 C 104 200 100 250 114 292 C 124 262 138 226 148 196 Z', c),
        svg:
          P('M 114 186 C 104 118 146 88 200 88 C 254 88 296 118 286 186 Q 262 158 200 154 Q 138 158 114 186 Z', c) +
          `<path d="M 130 124 C 150 102 176 96 196 96" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity="0.16"/>` +
          P('M 118 182 Q 200 158 282 182 L 282 192 Q 200 168 118 192 Z', shade(c, 0.15)) +
          E(200, 172, 5, 5, trim, { sw: 2.4 }),
        earsOver: true,
      };
    }
    case 'leafHat': {
      const g = '#6fb25a';
      return {
        svg:
          P('M 150 132 C 152 98 248 98 250 132 Z', tint(g, 0.08)) +
          P('M 66 138 C 100 112 300 112 334 138 C 300 160 100 160 66 138 Z', g) +
          L('M 90 138 L 200 126 L 310 138 M 120 146 L 200 130 M 280 146 L 200 130', ink(g), 2.4, 0.5) +
          L('M 150 150 Q 200 162 250 150', main, 3.4, 0.9),
        earsOver: true,
      };
    }
    case 'scholarCap': {
      const capC = cloth;
      return {
        behind:
          P('M 268 164 C 300 190 292 238 312 276 L 290 270 C 278 240 266 204 256 172 Z', capC) +
          P('M 132 164 C 100 190 108 238 88 276 L 110 270 C 122 240 134 204 144 172 Z', capC),
        svg:
          P('M 124 168 C 122 122 158 100 200 100 C 242 100 278 122 276 168 Q 200 152 124 168 Z', capC) +
          L('M 160 112 C 156 126 156 140 160 154 M 200 104 L 200 150 M 240 112 C 244 126 244 140 240 154', ink(capC), 2.6, 0.45) +
          P('M 122 164 Q 200 148 278 164 L 278 178 Q 200 162 122 178 Z', main) +
          E(200, 160, 8, 8, trim, { sw: 3 }),
        earsOver: true,
      };
    }
    case 'taoistCrown':
      return {
        behind: P(blob(200, 90, 30, 24, 0, 3), sub),
        svg:
          P('M 172 132 L 178 106 L 200 118 L 222 106 L 228 132 Q 200 124 172 132 Z', trim) +
          L('M 150 104 L 250 104', trim, 6) +
          E(150, 104, 5, 5, tint(trim, 0.15), { sw: 2 }) +
          E(250, 104, 5, 5, tint(trim, 0.15), { sw: 2 }) +
          E(200, 120, 5, 5, main, { sw: 2 }),
      };
    case 'pheasant': {
      const f = (sx: number) =>
        `<g transform="translate(${sx} 118) rotate(-18) scale(0.74)">` +
        `<path d="M 0 0 C 22 -60 18 -130 -34 -176 C -34 -118 -20 -50 -8 6 Z" fill="#6a8f55" stroke="#2f4a2e" stroke-width="5" stroke-linejoin="round"/>` +
        `<path d="M -2 -4 C 10 -60 6 -120 -30 -166" fill="none" stroke="#2f4a2e" stroke-width="3.2" opacity="0.7"/>` +
        `<ellipse cx="-6" cy="-98" rx="11" ry="16" fill="#e7c85a" stroke="#2f4a2e" stroke-width="3.4" transform="rotate(14 -6 -98)"/>` +
        `<ellipse cx="-6" cy="-98" rx="5" ry="8" fill="#3f78c0" transform="rotate(14 -6 -98)"/>` +
        `<ellipse cx="-18" cy="-146" rx="8" ry="12" fill="#e7c85a" stroke="#2f4a2e" stroke-width="3" transform="rotate(24 -18 -146)"/>` +
        `</g>`;
      return {
        behind: f(176) + mirror(f(176)),
        svg:
          P('M 166 136 L 172 104 L 200 118 L 228 104 L 234 136 Q 200 126 166 136 Z', trim) +
          E(200, 120, 7, 7, main, { sw: 2.5 }) +
          L('M 150 156 Q 200 140 250 156', trim, 5, 0.9),
        earsOver: true,
      };
    }
    case 'yellowBand':
      return {
        svg:
          P('M 98 172 Q 200 148 302 172 L 300 192 Q 200 170 100 192 Z', '#efc53c') +
          L('M 120 182 Q 200 162 280 182', '#c69a1e', 2.5, 0.7) +
          P('M 296 180 L 336 164 L 326 184 L 346 196 L 300 194 Z', '#efc53c') +
          P('M 296 184 L 330 206 L 314 200 L 322 220 L 296 196 Z', '#d9ab2a'),
      };
    case 'boneCrown': {
      const fur = '#7a5430';
      return {
        behind: feather(150, 140, -34, 96, 17, '#3aa7a0', '#1c6b6b') + feather(250, 140, 34, 96, 17, '#d9483b', '#8a2420') + feather(200, 130, 0, 104, 18, '#e8c15a', '#b68a2a'),
        svg:
          P('M 104 172 Q 200 150 296 172 L 294 194 Q 200 172 106 194 Z', fur) +
          L('M 112 180 l 6 8 l 8 -8 l 8 8 l 8 -8 l 8 8 l 8 -8 M 232 178 l 8 8 l 8 -8 l 8 8 l 8 -8', ink(fur), 2.6, 0.7) +
          P('M 168 164 C 156 140 156 116 170 92 C 176 116 184 136 190 160 Z', '#f7efd8', { sw: 3.4 }) +
          P('M 232 164 C 244 140 244 116 230 92 C 224 116 216 136 210 160 Z', '#f7efd8', { sw: 3.4 }) +
          P('M 192 176 L 200 198 L 208 176 Z', '#f7efd8', { sw: 3 }),
        earsOver: true,
      };
    }
    case 'featherHeaddress': {
      const cols = [ctx.pal.main, ctx.pal.trim, '#3aa7a0', '#d9483b', '#3aa7a0', ctx.pal.trim, ctx.pal.main];
      const angs = [-72, -48, -24, 0, 24, 48, 72];
      const lens = [84, 100, 112, 118, 112, 100, 84];
      return {
        behind: angs.map((a, i) => feather(200, 170, a, lens[i] + 22, 18, cols[i], i % 2 ? '#fff6dc' : ink(cols[i]))).join(''),
        svg:
          P('M 112 168 Q 200 148 288 168 L 286 188 Q 200 168 114 188 Z', sub) +
          rivets([[134, 178], [160, 172], [200, 168], [240, 172], [266, 178]], trim, 4),
        earsOver: true,
      };
    }
    case 'flowerPin': {
      const petal = (cx: number, cy: number, r: number) =>
        [0, 72, 144, 216, 288].map((a) => `<ellipse cx="${cx}" cy="${cy - r}" rx="${r * 0.7}" ry="${r}" fill="#f7a9c0" stroke="#c95c82" stroke-width="2.6" transform="rotate(${a} ${cx} ${cy})"/>`).join('') +
        E(cx, cy, r * 0.5, r * 0.5, '#f6d86a', { sw: 2.2 });
      return {
        svg: L('M 126 184 Q 200 154 274 184', trim, 4) + E(200, 166, 8, 9, '#d9483b', { sw: 2.6 }) + L('M 200 174 L 200 190', trim, 3),
        earsOver: true,
        over:
          petal(126, 150, 20) +
          L('M 112 166 L 104 214 M 122 168 L 118 222 M 134 166 L 134 210', trim, 2.4) +
          [[104, 216], [118, 224], [134, 212]].map(([x, y]) => E(x, y, 4, 5, '#7fd6d0', { sw: 1.6 })).join('') +
          P('M 262 132 C 244 112 246 144 262 140 C 278 144 280 112 262 132 Z', '#f7a9c0', { sw: 3 }),
      };
    }
    case 'emperorCrown': {
      const strings = [136, 158, 180, 200, 220, 242, 264]
        .map((x) => L(`M ${x} 134 L ${x} 172`, '#e8c15a', 2.2) + [146, 158, 170].map((y, i) => E(x, y, 4, 4.4, i % 2 ? '#d9483b' : '#fff7e6', { sw: 1.6 })).join(''))
        .join('');
      return {
        behind: '',
        svg:
          P('M 132 134 Q 200 122 268 134 L 266 150 Q 200 138 134 150 Z', sub) +
          P('M 118 118 L 282 118 L 296 134 L 104 134 Z', '#2a2230') +
          L('M 104 134 L 296 134', trim, 4) +
          L('M 130 124 L 270 124', '#fff', 3, 0.15) +
          strings,
      };
    }
    case 'rattanHelm': {
      const dome = 'M 114 184 C 106 122 150 92 200 92 C 250 92 294 122 286 184 Q 200 166 114 184 Z';
      const tan = '#c9a063';
      let weave = '';
      for (let i = -3; i < 12; i++) weave += `M ${96 + i * 22} 80 l 70 130 M ${96 + i * 22 + 70} 80 l -70 130 `;
      return {
        svg:
          `<clipPath id="rh${uid}"><path d="${dome}"/></clipPath>` +
          P(dome, tan) +
          `<g clip-path="url(#rh${uid})">${L(weave, shade(tan, 0.2), 2.4, 0.7)}</g>` +
          P('M 112 180 Q 200 162 288 180 L 286 198 Q 200 180 114 198 Z', '#8a6a3a') +
          E(200, 96, 8, 8, '#8a6a3a', { sw: 2.5 }),
        earsOver: true,
      };
    }
    case 'sailorBandana': {
      const dome = 'M 108 186 C 108 120 150 96 200 96 C 250 96 292 120 292 186 Q 200 164 108 186 Z';
      const dots = [[150, 130], [190, 112], [236, 118], [262, 148], [140, 158], [206, 140], [240, 170]]
        .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="#fff" opacity="0.9"/>`)
        .join('');
      return {
        svg:
          P(dome, main) +
          `<clipPath id="sb${uid}"><path d="${dome}"/></clipPath><g clip-path="url(#sb${uid})">${dots}</g>` +
          P('M 108 182 Q 200 160 292 182 L 292 196 Q 200 176 108 196 Z', sub) +
          P('M 290 184 L 330 176 L 322 196 L 342 208 L 294 200 Z', main) +
          P('M 292 190 L 324 222 L 308 216 L 312 236 L 288 200 Z', shade(main, 0.1)),
        earsOver: true,
      };
    }
    case 'fortuneHat':
      return {
        svg:
          P('M 132 130 L 154 92 L 246 92 L 268 130 Q 200 120 132 130 Z', sub) +
          P('M 130 128 Q 200 118 270 128 L 270 144 Q 200 134 130 144 Z', main) +
          E(200, 112, 14, 14, trim, { sw: 3 }) +
          `<rect x="195" y="107" width="10" height="10" fill="${shade(sub, 0.1)}" stroke="${ink(trim)}" stroke-width="1.5"/>`,
        earsOver: true,
      };
    case 'lotusCrown': {
      const petal = (a: number, len: number) =>
        `<g transform="translate(200 128) rotate(${a})"><path d="M 0 0 C 14 -${len * 0.3} 12 -${len * 0.8} 0 -${len} C -12 -${len * 0.8} -14 -${len * 0.3} 0 0 Z" fill="${trim}" stroke="${ink(trim)}" stroke-width="3.2" stroke-linejoin="round"/><path d="M 0 -6 L 0 -${len * 0.7}" stroke="${tint(trim, 0.2)}" stroke-width="3" stroke-linecap="round" opacity="0.8"/></g>`;
      return {
        svg:
          petal(-62, 44) + petal(62, 44) + petal(-32, 58) + petal(32, 58) + petal(0, 68) +
          P('M 164 140 Q 200 124 236 140 L 232 152 Q 200 140 168 152 Z', sub) +
          E(200, 134, 8, 8, '#fff', { sw: 2.5, stroke: ink(trim) }),
      };
    }
    case 'tigerHood': {
      const orange = '#e8963a';
      const hood = 'M 100 194 C 94 112 150 90 200 90 C 250 90 306 112 300 194 Q 200 170 100 194 Z';
      const eAr = P('M 108 128 C 96 96 120 70 150 86 C 156 100 150 116 140 130 Z', orange) + E(128, 100, 11, 13, '#fbe3bd', { noStroke: true, rot: -20 });
      return {
        hideEars: true,
        behind: eAr + mirror(eAr),
        svg:
          P(hood, orange) +
          L('M 120 140 L 144 150 M 116 160 L 140 168 M 280 140 L 256 150 M 284 160 L 260 168', '#2a1c14', 6, 0.9) +
          L('M 176 100 L 224 100 M 200 100 L 200 150 M 182 118 L 218 118 M 186 136 L 214 136', '#2a1c14', 6, 0.9) +
          P('M 100 190 Q 200 168 300 190 L 298 200 Q 200 180 102 200 Z', '#f6e7c6'),
      };
    }
    default:
      return NONE;
  }
}


// ---------- 背饰（画在身体后面） ----------
export function renderBackGear(ctx: Ctx): string {
  const kind: BackGear = ctx.look.outfit.back ?? 'none';
  const { main, trim } = ctx.pal;
  const W = ctx.W;
  const x = (dx: number) => 200 + dx * W;
  switch (kind) {
    case 'cape':
      return (
        P(`M ${x(-52)} 296 C ${x(-96)} 340 ${x(-104)} 420 ${x(-108)} 454 Q ${x(-50)} 470 200 458 Q ${x(50)} 470 ${x(108)} 454 C ${x(104)} 420 ${x(96)} 340 ${x(52)} 296 Z`, main) +
        `<path d="M ${x(-70)} 330 C ${x(-90)} 380 ${x(-94)} 420 ${x(-98)} 450" fill="none" stroke="${shade(main, 0.14)}" stroke-width="10" opacity="0.4" stroke-linecap="round"/>`
      );
    case 'capeLong':
      return (
        P(`M ${x(-54)} 296 C ${x(-100)} 340 ${x(-120)} 420 ${x(-132)} 468 C ${x(-90)} 462 ${x(-60)} 476 200 462 C ${x(60)} 476 ${x(100)} 454 ${x(126)} 470 C ${x(118)} 420 ${x(100)} 340 ${x(54)} 296 Z`, main) +
        P(`M ${x(-54)} 296 C ${x(-80)} 350 ${x(-96)} 420 ${x(-104)} 462 C ${x(-50)} 470 ${x(50)} 470 ${x(100)} 458 C ${x(86)} 420 ${x(78)} 350 ${x(54)} 296 Z`, shade(main, 0.12), { noStroke: true, op: 0.55 }) +
        L(`M ${x(-132)} 466 C ${x(-90)} 458 ${x(-60)} 472 200 458 C ${x(60)} 472 ${x(100)} 452 ${x(126)} 466`, trim, 4, 0.9)
      );
    case 'banner': {
      const glyph = ctx.look.outfit.glyph ?? '';
      return (
        L('M 332 40 L 332 468', '#7a4f2a', 11) + L('M 332 40 L 332 468', '#a87440', 6) +
        E(332, 34, 8, 8, trim, { sw: 3 }) +
        P('M 332 54 L 332 168 L 394 154 L 380 128 L 394 100 L 332 54 Z', main) +
        L('M 340 66 L 340 158', '#fff', 3, 0.22) +
        (glyph ? `<text x="358" y="136" text-anchor="middle" font-size="40" font-weight="900" fill="${trim}" stroke="${ink(main)}" stroke-width="1.2" style="font-family:'Noto Serif SC','Songti SC','STKaiti','WenQuanYi Zen Hei',serif">${glyph}</text>` : '')
      );
    }
    case 'scrollBack':
      return (
        `<g transform="rotate(-24 200 330)">` +
        P('M 150 250 L 156 396 L 172 396 L 166 250 Z', '#e9d8a8', { sw: 3.5 }) +
        P('M 176 246 L 182 396 L 198 396 L 192 246 Z', '#f4e8c4', { sw: 3.5 }) +
        P('M 142 250 L 142 262 L 174 262 L 174 250 Z', main, { sw: 3 }) +
        `</g>`
      );
    case 'gourd':
      return (
        L(`M ${x(-40)} 300 C ${x(-90)} 320 ${x(-96)} 360 ${x(-92)} 384`, '#8a4a2a', 4) +
        P(`M ${x(-92)} 380 C ${x(-122)} 376 ${x(-126)} 408 ${x(-110)} 420 C ${x(-132)} 432 ${x(-128)} 466 ${x(-98)} 466 C ${x(-68)} 466 ${x(-66)} 432 ${x(-86)} 420 C ${x(-72)} 408 ${x(-70)} 378 ${x(-92)} 380 Z`, '#d9703a') +
        E(x(-92), 378, 6, 5, '#7a4f2a', { sw: 2.6 }) +
        L(`M ${x(-112)} 410 Q ${x(-106)} 400 ${x(-98)} 400`, '#fff', 3, 0.35)
      );
    case 'furCloak': {
      const fur = '#8a6338';
      return P(`M ${x(-60)} 296 C ${x(-100)} 330 ${x(-110)} 400 ${x(-108)} 440 l ${14 * W} 14 l ${8 * W} -10 l ${14 * W} 18 l ${10 * W} -12 l ${14 * W} 16 l ${12 * W} -10 l ${12 * W} 14 l ${12 * W} -10 l ${12 * W} 12 l ${10 * W} -14 l ${14 * W} 12 l ${8 * W} -14 l ${14 * W} 8 C ${x(112)} 400 ${x(100)} 330 ${x(60)} 296 Z`, fur);
    }
    case 'ribbons': {
      const rib = (sd: number) =>
        P(`M ${x(sd * 54)} 312 C ${x(sd * 110)} 270 ${x(sd * 150)} 330 ${x(sd * 126)} 392 C ${x(sd * 118)} 414 ${x(sd * 138)} 432 ${x(sd * 128)} 456 C ${x(sd * 104)} 430 ${x(sd * 102)} 404 ${x(sd * 108)} 386 C ${x(sd * 124)} 340 ${x(sd * 92)} 314 ${x(sd * 54)} 330 Z`, main, { sw: 4 });
      return rib(-1) + rib(1);
    }
    default:
      return '';
  }
}

export function renderWeapon(ctx: Ctx, pose: Pose): WeaponOut {
  return renderWeaponImpl(ctx, pose);
}
