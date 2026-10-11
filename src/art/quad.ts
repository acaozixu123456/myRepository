// 实验：四足“真猫”披甲造型。头沿用现有头部（含头饰），身体换成真正的猫身——没有“手臂 + 圆手”，武器背在背上。
import { buildCtx, catParts, defsFor, DY, volume, VIEW_FULL, L as LINE, E as ELL } from './cat';
import type { Pose } from './cat';
import { renderWeapon } from './gear';
import { ink, shade, tint } from './color';
import type { CatLook } from './types';
import { furTicks, limbPath, paintDefs, paintFill, smooth } from './paint';

let q = 0;
export function quadSvg(look: CatLook, o: { width?: number; viewBox?: string; uid?: string } = {}): string {
  const uid = o.uid ?? `q${++q}`;
  const w = o.width ?? 400;
  const vb = o.viewBox ?? '-30 90 560 540';
  const [, , vw, vh] = vb.split(' ').map(Number);
  const ctx = buildCtx(look, uid);
  const { parts } = catParts(look, uid); // 登记渐变并取得头部
  const headPart = parts.find((p) => p.id === 'head')!;
  const fur = ctx.fur, line = ctx.line, pal = ctx.pal;
  const cx = 250, cy = 462;
  // 四条腿（后腿在前面一层，前腿在最上）
  const leg = (x: number, key: string, back = false) => {
    const c: [number, number][] = [[x, cy + 20], [x + (back ? 8 : -2), cy + 84], [x + (back ? 14 : 2), 598]];
    const d = limbPath(c, [back ? 62 : 50, back ? 46 : 40, 38]);
    const paw = smooth([[x + (back ? 14 : 2) - 28, 590], [x + (back ? 14 : 2) - 20, 576], [x + (back ? 14 : 2) + 20, 576], [x + (back ? 14 : 2) + 30, 592], [x + (back ? 14 : 2) + 14, 606], [x + (back ? 14 : 2) - 22, 606]], true);
    return volume(ctx, key, d, fur, { inner: furTicks(x - 30, cy, x + 40, 600, 30, shade(fur, 0.22), Math.PI / 2, 9, 9, 0.3) }) + volume(ctx, key + 'p', paw, ctx.paw, { shadow: 0.4 }) +
      [-9, 0, 9].map((dx) => LINE(`M ${x + (back ? 14 : 2) + dx} 596 L ${x + (back ? 14 : 2) + dx} 606`, line, 1.8, 0.6)).join('');
  };
  const tailC: [number, number][] = [[cx + 108, cy - 4], [cx + 150, cy - 40], [cx + 160, cy - 100], [cx + 134, cy - 150]];
  const tail = volume(ctx, 'qtail', limbPath(tailC, [36, 34, 32, 26]), fur, { inner: furTicks(cx + 100, cy - 160, cx + 180, cy, 40, shade(fur, 0.2), -1.2, 5, 10, 0.3) });
  const bodyD = smooth([[cx - 126, cy - 8], [cx - 100, cy - 58], [cx - 30, cy - 76], [cx + 60, cy - 72], [cx + 124, cy - 40], [cx + 134, cy + 14], [cx + 100, cy + 56], [cx + 20, cy + 70], [cx - 70, cy + 62], [cx - 118, cy + 36]], true);
  const belly = `<ellipse cx="${cx - 10}" cy="${cy + 50}" rx="110" ry="30" fill="${ctx.belly}" opacity="0.85"/>`;
  const body = volume(ctx, 'qbody', bodyD, fur, { inner: belly + furTicks(cx - 130, cy - 80, cx + 140, cy + 70, 70, shade(fur, 0.22), 0.1, 3, 11, 0.28) });
  // 披甲：胸甲 + 腰带 + 披风
  const vestD = smooth([[cx - 70, cy - 66], [cx - 20, cy - 74], [cx + 30, cy - 70], [cx + 44, cy - 10], [cx + 36, cy + 52], [cx - 20, cy + 62], [cx - 64, cy + 40], [cx - 82, cy - 10]], true);
  const vest = volume(ctx, 'qvest', vestD, pal.main, { mode: 'cloth', sw: 3.4 }) +
    `<path d="M ${cx - 30} ${cy - 70} L ${cx - 34} ${cy + 62} M ${cx + 10} ${cy - 72} L ${cx + 6} ${cy + 62}" stroke="${pal.trim}" stroke-width="5" fill="none" opacity="0.9"/>` +
    ELL(cx - 12, cy - 8, 14, 14, pal.trim, { mode: 'metal', sw: 3 });
  const capeD = smooth([[cx - 96, cy - 50], [cx - 30, cy - 90], [cx + 80, cy - 80], [cx + 170, cy - 30], [cx + 210, cy + 50], [cx + 130, cy + 30], [cx + 40, cy + 20], [cx - 50, cy - 10]], true);
  const cape = volume(ctx, 'qcape', capeD, pal.sub, { mode: 'cloth', sw: 3.4 }) + `<path d="${smooth([[cx - 96, cy - 50], [cx - 30, cy - 90], [cx + 80, cy - 80], [cx + 170, cy - 30], [cx + 210, cy + 50]])}" fill="none" stroke="${pal.trim}" stroke-width="5" opacity="0.9"/>`;
  // 背上的武器
  const base: Pose = { R: [282, 446 - DY], L: [118, 446 - DY] };
  const wp = renderWeapon(ctx, base);
  const hand = wp.pose?.R ?? base.R;
  const weapon = wp.svg ? `<g transform="translate(${cx + 20} ${cy - 96}) rotate(-62) scale(0.78) translate(${-hand[0]} ${-hand[1] - DY})">${wp.svg}</g>` : '';
  // 头：沿用现有头部，缩放后放在身体前端，微微低头
  const head = `<g transform="translate(${cx - 190} ${cy - 136}) rotate(-4 200 260) scale(0.98) translate(-48 ${-(230 + 22) + 70})">${headPart.svg}</g>`;
  const shadow = `<ellipse cx="${cx + 10}" cy="604" rx="170" ry="16" fill="#3a2830" opacity="0.2"/>`;
  const inner = shadow + tail + leg(cx + 92, 'qlb', true) + leg(cx + 36, 'qlb2', true) + body + cape + vest + weapon + leg(cx - 74, 'qlf2') + leg(cx - 112, 'qlf') + head;
  const filt = `<filter id="sil${uid}" x="-10%" y="-10%" width="120%" height="120%"><feMorphology in="SourceAlpha" operator="dilate" radius="5" result="d"/><feFlood flood-color="#3a2218"/><feComposite in2="d" operator="in" result="o"/><feMerge><feMergeNode in="o"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${w}" height="${Math.round((w * vh) / vw)}"><defs>${defsFor(uid)}${paintDefs()}${filt}</defs><g filter="url(#sil${uid})"><g filter="url(#paper${uid})">${inner}</g></g></svg>`;
}
void VIEW_FULL; void ink; void tint; void paintFill;
