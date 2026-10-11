// 服饰 v3：贴合新体型的服装（坐标即最终画布坐标）。
// 思路：用“躯干半宽函数 hw(y)”生成贴身外形，再叠加衣领 / 腰带 / 甲片 / 下摆 / 肩甲；每件都有渐变、折痕与金属高光。
import { E, L, P, blob, mirror, tuft, volume } from './cat';
import type { Ctx } from './cat';
import { ink, mix, shade, tint } from './color';
import { furTicks, limbPath, paintFill, smooth } from './paint';
import type { Pt } from './paint';
import type { BodyGear } from './types';

export interface GearOut {
  svg: string; // 躯干部件内，盖在躯干之上
  overC?: string; // 躯干部件内，盖在颈饰之上（项链、披肩）
  overL?: string; // 左臂部件内（肩甲）
  overR?: string; // 右臂部件内
  skirt?: string; // 躯干部件内，盖在腿上（下摆 / 战裙）
  sleeve?: string; // 袖子颜色
  sleeveWide?: boolean; // 宽袖
  cuff?: string; // 袖口 / 护腕颜色
  legCloth?: string;
  boots?: string;
  noChestFur?: boolean;
}

// ---------- 躯干半宽 ----------
const R: [number, number][] = [[22, 270], [50, 280], [78, 296], [92, 318], [86, 348], [74, 380], [64, 414], [62, 446], [68, 472], [48, 490], [0, 496]];
export function hw(y: number): number {
  if (y <= R[0][1]) return R[0][0];
  for (let i = 0; i < R.length - 1; i++) {
    const [a, ya] = R[i];
    const [b, yb] = R[i + 1];
    if (y <= yb) return a + ((b - a) * (y - ya)) / (yb - ya);
  }
  return R[R.length - 1][0];
}

/** 贴身外形：从 y0 到 y1，向外扩 grow */
function torsoShape(W: number, grow: number, y0: number, y1: number, taper = 0): string {
  const pts: Pt[] = [];
  const ys: number[] = [];
  for (let y = y0; y < y1; y += 14) ys.push(y);
  ys.push(y1);
  const right: Pt[] = ys.map((y) => [200 + (hw(y) + grow - taper * ((y - y0) / (y1 - y0))) * W, y]);
  const left: Pt[] = ys.slice().reverse().map((y) => [200 - (hw(y) + grow - taper * ((y - y0) / (y1 - y0))) * W, y]);
  pts.push(...right, ...left);
  return smooth(pts, true, 0.4);
}

/** 横向条带（腰带 / 束带）：上下边带弧度 */
function strap(W: number, y0: number, y1: number, grow = 6, sag = 8): string {
  const l0 = 200 - (hw(y0) + grow) * W, r0 = 200 + (hw(y0) + grow) * W;
  const l1 = 200 - (hw(y1) + grow) * W, r1 = 200 + (hw(y1) + grow) * W;
  return `M ${l0} ${y0} Q 200 ${y0 + sag} ${r0} ${y0} L ${r1} ${y1} Q 200 ${y1 + sag} ${l1} ${y1} Z`;
}

const fold = (d: string, color: string, op = 0.22) => L(d, ink(color, 0.5), 2.4, op);
const rivets = (pts: [number, number][], col: string, r = 3) => pts.map(([x, y]) => E(x, y, r, r, col, { sw: 1.6, mode: 'metal' })).join('');

/** 肩甲：以肩头为中心的有机甲片 */
function pauldron(ctx: Ctx, side: -1 | 1, col: string, trim: string, kind: 'dome' | 'spike' | 'leather' | 'fur'): string {
  const W = ctx.W;
  const cx = 200 + side * 76 * W;
  const cy = 312;
  const k = side;
  const plate = (r: number, rot: number, c: string) =>
    P(smooth([[cx - k * r * 0.2, cy - r * 0.78], [cx + k * r * 0.62, cy - r * 0.55], [cx + k * r * 0.92, cy + r * 0.05], [cx + k * r * 0.62, cy + r * 0.62], [cx - k * r * 0.1, cy + r * 0.78], [cx - k * r * 0.6, cy + r * 0.2], [cx - k * r * 0.55, cy - r * 0.45]], true).replace(/^/, ''), c, { mode: kind === 'leather' ? 'cloth' : 'metal', sw: 4 }) + (rot ? '' : '');
  if (kind === 'fur') {
    const f = '#8a6338';
    return (
      tuft(cx - k * 4, cy - 14, -Math.PI / 2 + k * 0.5, 34, 12, f, ink(f, 0.5)) + tuft(cx + k * 10, cy - 8, -0.3 * k, 36, 12, f, ink(f, 0.5)) +
      tuft(cx + k * 14, cy + 6, 0.4 * k, 34, 12, f, ink(f, 0.5)) + tuft(cx + k * 6, cy + 18, 1.1 * k, 30, 11, f, ink(f, 0.5)) +
      E(cx, cy, 34, 24, f, { sw: 3.5 })
    );
  }
  const r = 40;
  let s = plate(r, 0, shade(col, 0.1)) + plate(r * 0.84, 0, col) + plate(r * 0.62, 0, tint(col, 0.06));
  s += L(`M ${cx - k * r * 0.5} ${cy - r * 0.2} Q ${cx + k * r * 0.1} ${cy - r * 0.62} ${cx + k * r * 0.76} ${cy - r * 0.1}`, tint(col, 0.5), 3, 0.7);
  s += `<path d="M ${cx - k * r * 0.62} ${cy + r * 0.42} Q ${cx + k * r * 0.1} ${cy + r * 0.78} ${cx + k * r * 0.84} ${cy + r * 0.34}" fill="none" stroke="${paintFill(trim, 'metal')}" stroke-width="5" stroke-linecap="round"/>`;
  s += rivets([[cx + k * r * 0.4, cy - r * 0.15], [cx + k * r * 0.1, cy + r * 0.1]], tint(trim, 0.2), 2.6);
  if (kind === 'spike') s += P(`M ${cx + k * r * 0.1} ${cy - r * 0.7} L ${cx + k * r * 0.4} ${cy - r * 1.5} L ${cx + k * r * 0.62} ${cy - r * 0.55} Z`, trim, { mode: 'metal', sw: 3.4 });
  return s;
}

export function renderBodyGear(ctx: Ctx): GearOut {
  const kind: BodyGear = ctx.look.outfit.body ?? 'none';
  const { main, sub, trim } = ctx.pal;
  const cloth = ctx.pal.cloth ?? '#f3efe4';
  const W = ctx.W;
  const x = (dx: number) => 200 + dx * W;
  const uid = ctx.uid;
  const key = (s: string) => `${s}`;

  switch (kind) {
    // ====================== 板甲 ======================
    case 'armorWei':
    case 'armorHeavy': {
      const heavy = kind === 'armorHeavy';
      const plate = heavy ? main : sub;
      const under = heavy ? sub : main;
      // 内衬
      let svg = volume(ctx, key('under'), torsoShape(W, 5, 272, 452), shade(under, 0.05), { sw: 3.2, mode: 'cloth' });
      // 胸甲
      const chest = smooth([[x(-70), 300], [x(-86), 322], [x(-74), 360], [x(-60), 408], [x(-54), 430], [x(0), 442], [x(54), 430], [x(60), 408], [x(74), 360], [x(86), 322], [x(70), 300], [x(0), 316]], true, 0.42);
      const chestInner =
        `<path d="M ${x(0)} 316 L ${x(0)} 440" stroke="${ink(plate, 0.4)}" stroke-width="3" opacity="0.5"/>` +
        (heavy ? '' : ((): string => { let d = ''; for (let y = 326; y < 430; y += 15) for (let xx = -70 + (((y - 326) / 15) % 2) * 9; xx < 80; xx += 18) d += `M ${x(xx)} ${y} q ${9 * W} ${11} ${18 * W} 0 `; return L(d, tint(plate, 0.28), 2, 0.55); })()) +
        `<path d="M ${x(-60)} 336 Q ${x(-30)} 322 ${x(-6)} 340" fill="none" stroke="#fff" stroke-width="5" opacity="0.28" stroke-linecap="round"/>`;
      svg += volume(ctx, key('chest'), chest, plate, { sw: 3.8, mode: 'metal', inner: chestInner, outline: ink(plate, 0.5) });
      // 胸徽
      svg += E(x(0), 366, 19, 19, trim, { sw: 3.4, mode: 'metal' }) + E(x(0), 366, 9, 9, main, { sw: 2.4 }) + E(x(-3), 362, 3, 2.4, '#fff', { noStroke: true, flat: true, op: 0.7 });
      // 束腰甲带
      svg += P(strap(W, 424, 452, 6, 8), trim, { mode: 'metal', sw: 3.6 }) + E(x(0), 438, 17, 14, tint(trim, 0.1), { sw: 3.4, mode: 'metal' }) + rivets([[x(-40), 440], [x(40), 440], [x(-64), 436], [x(64), 436]], tint(trim, 0.25));
      // 护颈
      const gorget = smooth([[x(-46), 276], [x(-60), 290], [x(0), 306], [x(60), 290], [x(46), 276], [x(0), 284]], true);
      const overC = P(gorget, trim, { mode: 'metal', sw: 3.4 }) + L(`M ${x(-52)} 288 Q ${x(0)} 304 ${x(52)} 288`, '#fff', 3, 0.5);
      // 战裙
      const panel = (cx: number, w: number, top: number, bot: number, c: string) =>
        P(smooth([[cx - w, top], [cx + w, top], [cx + w - 3, bot - 8], [cx, bot], [cx - w + 3, bot - 8]], true, 0.3), c, { mode: 'metal', sw: 3.4 }) + L(`M ${cx} ${top + 4} L ${cx} ${bot - 6}`, ink(c, 0.5), 2, 0.35) + L(`M ${cx - w + 4} ${bot - 12} L ${cx + w - 4} ${bot - 12}`, trim, 3, 0.9);
      const tc = heavy ? sub : main;
      const skirt =
        panel(x(-52), 24 * W, 446, 520, shade(tc, 0.05)) + panel(x(52), 24 * W, 446, 520, shade(tc, 0.05)) +
        panel(x(-26), 25 * W, 450, 532, tc) + panel(x(26), 25 * W, 450, 532, tc) + panel(x(0), 24 * W, 452, 542, tint(tc, 0.06));
      const kindP = heavy ? 'spike' : 'dome';
      return {
        svg, overC, skirt,
        overL: pauldron(ctx, -1, plate, trim, kindP), overR: pauldron(ctx, 1, plate, trim, kindP),
        sleeve: undefined, cuff: tint(plate, 0.02),
        legCloth: shade(sub, 0.1), boots: shade(sub, 0.06), noChestFur: true,
      };
    }

    // ====================== 皮甲 ======================
    case 'armorLight': {
      const leather = mix('#8a5a30', sub, 0.28);
      let svg = volume(ctx, key('lc'), torsoShape(W, 6, 276, 446), leather, { sw: 3.4, mode: 'cloth' });
      svg += L(`M ${x(-76)} 304 L ${x(58)} 440 M ${x(76)} 304 L ${x(-58)} 440`, shade(leather, 0.2), 14, 0.95) + L(`M ${x(-76)} 304 L ${x(58)} 440 M ${x(76)} 304 L ${x(-58)} 440`, trim, 7, 0.95);
      svg += rivets([[x(-36), 340], [x(36), 340], [x(0), 372], [x(-36), 404], [x(36), 404]], tint(trim, 0.2));
      svg += P(strap(W, 424, 448, 6, 7), shade(leather, 0.14), { mode: 'cloth', sw: 3.4 }) + E(x(0), 436, 13, 11, trim, { sw: 3, mode: 'metal' });
      const flap = (cx: number, w: number, bot: number) => P(smooth([[cx - w, 446], [cx + w, 446], [cx + w - 2, bot], [cx - w + 2, bot]], true, 0.3), main, { mode: 'cloth', sw: 3.2 }) + L(`M ${cx} 452 L ${cx} ${bot - 6}`, ink(main, 0.5), 2, 0.3);
      const skirt = flap(x(-40), 28 * W, 520) + flap(x(40), 28 * W, 520) + flap(x(0), 26 * W, 534);
      return { svg, skirt, overL: pauldron(ctx, -1, main, trim, 'leather'), overR: pauldron(ctx, 1, main, trim, 'leather'), legCloth: shade(leather, 0.12), boots: shade(leather, 0.22), cuff: shade(leather, 0.1), noChestFur: true };
    }

    // ====================== 袍服 ======================
    case 'robeScholar':
    case 'robeSilk':
    case 'robeTaoist': {
      const silk = kind === 'robeSilk';
      const taoist = kind === 'robeTaoist';
      const col = silk ? main : cloth;
      const edge = silk ? trim : main;
      let svg = volume(ctx, key('robe'), torsoShape(W, 8, 272, 470), col, { sw: 3.4, mode: 'cloth' });
      // 内衬领口
      const inner = taoist ? '#ffffff' : silk ? tint(main, 0.5) : tint(main, 0.7);
      svg += P(`M ${x(-24)} 276 Q ${x(0)} 316 ${x(24)} 276 L ${x(14)} 276 Q ${x(0)} 296 ${x(-14)} 276 Z`, inner, { sw: 2.4, mode: 'cloth' });
      // 交领右衽
      svg += P(`M ${x(-30)} 272 L ${x(-12)} 272 L ${x(26)} 430 L ${x(10)} 436 Z`, edge, { mode: 'cloth', sw: 3 });
      svg += P(`M ${x(30)} 272 L ${x(12)} 272 L ${x(-24)} 430 L ${x(-8)} 436 Z`, shade(edge, 0.08), { mode: 'cloth', sw: 3 });
      if (silk) {
        for (const [px, py] of [[-46, 330], [46, 330], [-52, 392], [52, 392], [0, 378]] as [number, number][]) svg += E(x(px), py, 11, 11, 'none', { noStroke: false, stroke: trim, sw: 3.6, flat: true, op: 0.9 }) + E(x(px), py, 3.4, 3.4, trim, { noStroke: true, flat: true });
      }
      if (taoist) {
        svg += E(x(0), 362, 15, 15, '#ffffff', { sw: 2.6, stroke: ink(main, 0.4), flat: true });
        svg += `<path d="M ${x(0)} 347 A 15 15 0 0 1 ${x(0)} 377 A 7.5 7.5 0 0 1 ${x(0)} 362 A 7.5 7.5 0 0 0 ${x(0)} 347 Z" fill="${main}"/><circle cx="${x(0)}" cy="355" r="2.4" fill="#fff"/><circle cx="${x(0)}" cy="369" r="2.4" fill="${main}"/>`;
      }
      // 腰带 + 结 + 垂带
      const sashC = silk ? sub : main;
      svg += P(strap(W, 408, 434, 8, 9), sashC, { mode: 'cloth', sw: 3.4 }) + E(x(0), 424, 12, 11, trim, { sw: 3, mode: 'metal' });
      svg += P(`M ${x(8)} 432 Q ${x(18)} 470 ${x(10)} 500 L ${x(26)} 496 Q ${x(30)} 462 ${x(20)} 430 Z`, shade(sashC, 0.05), { mode: 'cloth', sw: 3 });
      svg += fold(`M ${x(-60)} 340 Q ${x(-52)} 380 ${x(-58)} 410 M ${x(60)} 336 Q ${x(54)} 380 ${x(60)} 408`, col, 0.28);
      // 下摆
      const hem = 574;
      const rd = smooth([[x(-70), 440], [x(70), 440], [x(84), 500], [x(96), hem], [x(0), hem + 12], [x(-96), hem], [x(-84), 500]], true, 0.4);
      const skirtBody = volume(ctx, key('skirt'), rd, col, { sw: 3.4, mode: 'cloth', inner: `<path d="M ${x(0)} 450 L ${x(-10)} ${hem + 10} L ${x(10)} ${hem + 10} Z" fill="${shade(col, 0.2)}" opacity="0.5"/>` + fold(`M ${x(-44)} 460 Q ${x(-56)} 520 ${x(-62)} 570 M ${x(44)} 460 Q ${x(56)} 520 ${x(62)} 570 M ${x(-22)} 470 Q ${x(-26)} 520 ${x(-28)} 572 M ${x(22)} 470 Q ${x(26)} 520 ${x(28)} 572`, col, 0.3) });
      const band = `<path d="M ${x(-96)} ${hem - 14} Q ${x(0)} ${hem + 2} ${x(96)} ${hem - 14} L ${x(96)} ${hem} Q ${x(0)} ${hem + 14} ${x(-96)} ${hem} Z" fill="${paintFill(edge, 'cloth')}" stroke="${ink(edge, 0.5)}" stroke-width="2.4" stroke-linejoin="round"/>`;
      const cloud = taoist ? `<path d="M ${x(-86)} ${hem - 22} q ${12 * W} -14 ${24 * W} 0 q ${12 * W} -14 ${24 * W} 0 q ${12 * W} -14 ${24 * W} 0 q ${12 * W} -14 ${24 * W} 0 q ${12 * W} -14 ${24 * W} 0 q ${12 * W} -14 ${24 * W} 0 q ${12 * W} -14 ${24 * W} 0" fill="none" stroke="${tint(main, 0.3)}" stroke-width="3" opacity="0.8"/>` : '';
      const skirt = skirtBody + band + cloud + (silk ? L(`M ${x(-90)} ${hem - 8} Q ${x(0)} ${hem + 8} ${x(90)} ${hem - 8}`, tint(trim, 0.3), 2, 0.8) : '');
      return { svg, skirt, sleeve: col, sleeveWide: true, cuff: edge, legCloth: shade(silk ? sub : main, 0.1), boots: shade(silk ? sub : main, 0.14), noChestFur: true };
    }

    // ====================== 裙装 ======================
    case 'dress': {
      let svg = volume(ctx, key('bodice'), torsoShape(W, 4, 274, 432, 6), sub, { sw: 3.4, mode: 'cloth' });
      svg += `<path d="M ${x(-70)} 300 Q ${x(0)} 336 ${x(70)} 300" fill="none" stroke="${tint(sub, 0.2)}" stroke-width="3" opacity="0.6"/>`;
      // 花边领
      let lace = '';
      for (let i = -4; i <= 4; i++) lace += E(x(i * 12), 292 + Math.abs(i) * 1.6, 8, 7, '#fff6f0', { sw: 2, flat: true });
      svg += lace;
      svg += P(strap(W, 414, 436, 2, 6), trim, { mode: 'metal', sw: 3.2 });
      svg += P(`M ${x(0)} 424 C ${x(-40)} 396 ${x(-46)} 446 ${x(-6)} 440 Z`, tint(main, 0.1), { mode: 'cloth', sw: 3 }) + P(`M ${x(0)} 424 C ${x(40)} 396 ${x(46)} 446 ${x(6)} 440 Z`, tint(main, 0.1), { mode: 'cloth', sw: 3 }) + E(x(0), 430, 8, 8, trim, { sw: 2.6, mode: 'metal' });
      const hem = 548;
      const pts: Pt[] = [];
      pts.push([x(-62), 436], [x(62), 436], [x(96), 500], [x(110), hem]);
      for (let i = 0; i <= 8; i++) pts.push([x(110 - i * 27.5), hem + (i % 2 ? 14 : 4)]);
      pts.push([x(-96), 500]);
      const dres = volume(ctx, key('dress'), smooth(pts, true, 0.28), main, { sw: 3.4, mode: 'cloth', inner: fold(`M ${x(-40)} 450 Q ${x(-60)} 510 ${x(-74)} 546 M ${x(0)} 452 L ${x(0)} 556 M ${x(40)} 450 Q ${x(60)} 510 ${x(74)} 546`, main, 0.3) });
      return { svg, skirt: dres, sleeve: undefined, legCloth: undefined, boots: shade(main, 0.2), overL: '', overR: '', cuff: '#fff6f0', noChestFur: true };
    }

    // ====================== 兽皮（蛮） ======================
    case 'tribal': {
      const fur = '#8a6338';
      const hide = mix(sub, '#8a5a30', 0.45);
      // 斜挎皮带 + 骨珠
      let svg = L(`M ${x(-84)} 306 L ${x(56)} 440`, '#5a3a20', 17, 0.95) + L(`M ${x(-84)} 306 L ${x(56)} 440`, main, 10, 1);
      for (let i = 0; i < 5; i++) svg += E(x(-70 + i * 28), 316 + i * 26, 5, 5, '#f4ead0', { sw: 2, mode: 'cel' });
      svg += P(strap(W, 424, 448, 5, 7), fur, { mode: 'cloth', sw: 3.4 }) + E(x(0), 436, 12, 10, trim, { sw: 3, mode: 'cel' });
      // 兽牙项链
      const tooth = (px: number, py: number) => P(`M ${px - 5} ${py} L ${px + 5} ${py} L ${px} ${py + 15} Z`, '#f7efd8', { sw: 2.2, mode: 'cel' });
      let neck = L(`M ${x(-44)} 288 Q ${x(0)} 330 ${x(44)} 288`, '#6a4a2a', 3.4);
      for (const dx of [-34, -22, -10, 0, 10, 22, 34]) neck += tooth(x(dx), 292 + 38 * (1 - (dx / 38) ** 2) * 0.55 + 4);
      // 兽皮裙
      const panel = (cx: number, w: number, bot: number) => P(smooth([[cx - w, 446], [cx + w, 446], [cx + w - 4, bot], [cx, bot + 12], [cx - w + 4, bot]], true, 0.3), hide, { mode: 'cloth', sw: 3.2 }) + P(`M ${cx - w * 0.6} ${bot - 22} L ${cx + w * 0.6} ${bot - 22} L ${cx} ${bot - 4} Z`, trim, { mode: 'cel', sw: 2.4 });
      const skirt = panel(x(-44), 28 * W, 512) + panel(x(44), 28 * W, 512) + panel(x(0), 28 * W, 528);
      return { svg: svg + neck, overC: '', skirt, overL: pauldron(ctx, -1, fur, trim, 'fur'), overR: pauldron(ctx, 1, fur, trim, 'fur'), legCloth: undefined, boots: undefined, cuff: '#6a4a2a' };
    }

    // ====================== 藤甲（蛮） ======================
    case 'rattan': {
      const tan = '#c79a58';
      const id = `v${uid}rattan`;
      let weave = '';
      for (let i = -3; i < 16; i++) weave += `M ${40 + i * 20} 270 l 110 200 M ${40 + i * 20 + 110} 270 l -110 200 `;
      const body = torsoShape(W, 9, 274, 466);
      const svg = volume(ctx, key('rattan'), body, tan, { sw: 3.6, mode: 'cloth', inner: L(weave, shade(tan, 0.26), 3.2, 0.7) });
      void id;
      const belt = P(strap(W, 416, 442, 9, 8), '#8a6a3a', { mode: 'cloth', sw: 3.4 }) + E(x(0), 430, 12, 10, trim, { sw: 3, mode: 'cel' });
      const panel = (cx: number, w: number, bot: number) => volume(ctx, key(`rp${Math.round(cx)}`), smooth([[cx - w, 444], [cx + w, 444], [cx + w - 3, bot], [cx - w + 3, bot]], true, 0.3), tan, { mode: 'cloth', inner: L(`M ${cx - w} 450 l ${2 * w} 60 M ${cx + w} 450 l ${-2 * w} 60`, shade(tan, 0.26), 2.6, 0.6) });
      return { svg: svg + belt, skirt: panel(x(-40), 28 * W, 520) + panel(x(40), 28 * W, 520) + panel(x(0), 26 * W, 534), overL: pauldron(ctx, -1, tan, trim, 'leather'), overR: pauldron(ctx, 1, tan, trim, 'leather'), cuff: '#8a6a3a', noChestFur: true };
    }

    // ====================== 短褂 ======================
    case 'vest': {
      const half = (sd: -1 | 1) => {
        const d = smooth([[x(sd * 14), 280], [x(sd * 60), 288], [x(sd * 94), 310], [x(sd * 86), 360], [x(sd * 70), 412], [x(sd * 66), 444], [x(sd * 18), 440], [x(sd * 22), 380], [x(sd * 12), 320]], true, 0.4);
        return volume(ctx, key(`vest${sd}`), d, main, { sw: 3.4, mode: 'cloth' }) + L(`M ${x(sd * 14)} 284 Q ${x(sd * 24)} 360 ${x(sd * 20)} 438`, trim, 5, 0.95);
      };
      const svg = half(-1) + half(1) + P(strap(W, 416, 440, 7, 7), sub, { mode: 'cloth', sw: 3.4 }) + E(x(0), 428, 12, 10, trim, { sw: 3, mode: 'metal' });
      const flap = (cx: number, w: number, bot: number) => P(smooth([[cx - w, 442], [cx + w, 442], [cx + w - 2, bot], [cx - w + 2, bot]], true, 0.3), sub, { mode: 'cloth', sw: 3.2 });
      return { svg, skirt: flap(x(-36), 26 * W, 506) + flap(x(36), 26 * W, 506), legCloth: shade(sub, 0.05), boots: shade(sub, 0.15), cuff: trim };
    }
    default:
      return { svg: '' };
  }
}

export { limbPath, furTicks, mirror, blob };
