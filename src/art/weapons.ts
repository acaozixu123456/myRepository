// 武器：握在猫爪里的道具。H 为右手位置。武器画在手臂之上、爪套之下。
import { E, L, P, mirror } from './cat';
import type { Ctx, Pose } from './cat';
import { ink, shade, tint } from './color';
import type { WeaponOut } from './gear';

const STEEL = '#dde6ee';
const WOOD = '#9a6a3c';

function pole(hx: number, y0: number, y1: number, col = WOOD, w = 12): string {
  return L(`M ${hx} ${y0} L ${hx} ${y1}`, ink(col), w + 6) + L(`M ${hx} ${y0} L ${hx} ${y1}`, col, w) + L(`M ${hx - w * 0.22} ${y0} L ${hx - w * 0.22} ${y1}`, '#fff', 2.5, 0.25);
}

function tassel(x: number, y: number, col: string, len = 40): string {
  return (
    E(x, y, 7, 7, col, { sw: 2.5 }) +
    P(`M ${x - 7} ${y + 4} L ${x + 7} ${y + 4} L ${x + 10} ${y + len} L ${x - 10} ${y + len} Z`, col, { sw: 2.8 }) +
    L(`M ${x - 3} ${y + 8} L ${x - 4} ${y + len - 4} M ${x + 3} ${y + 8} L ${x + 4} ${y + len - 4}`, ink(col), 1.8, 0.5)
  );
}

function sword(hx: number, hy: number, ctx: Ctx, len = 150): string {
  const { trim, main } = ctx.pal;
  return (
    P(`M ${hx - 9} ${hy - 10} L ${hx - 9} ${hy - len} L ${hx} ${hy - len - 24} L ${hx + 9} ${hy - len} L ${hx + 9} ${hy - 10} Z`, STEEL, { sw: 4 }) +
    L(`M ${hx} ${hy - 14} L ${hx} ${hy - len + 6}`, '#a9b8c8', 3) +
    L(`M ${hx - 5} ${hy - 20} L ${hx - 5} ${hy - len + 10}`, '#fff', 2.4, 0.7) +
    P(`M ${hx - 24} ${hy - 6} Q ${hx} ${hy - 20} ${hx + 24} ${hy - 6} L ${hx + 21} ${hy + 3} Q ${hx} ${hy - 8} ${hx - 21} ${hy + 3} Z`, trim, { sw: 3.6 }) +
    P(`M ${hx - 6} ${hy} L ${hx + 6} ${hy} L ${hx + 6} ${hy + 30} L ${hx - 6} ${hy + 30} Z`, shade(main, 0.15), { sw: 3.4 }) +
    E(hx, hy + 33, 8, 8, trim, { sw: 3 }) +
    tassel(hx, hy + 38, main, 26)
  );
}

function dagger(hx: number, hy: number, ctx: Ctx): string {
  const { trim, main } = ctx.pal;
  return (
    P(`M ${hx - 8} ${hy - 8} C ${hx - 16} ${hy - 50} ${hx - 6} ${hy - 84} ${hx + 6} ${hy - 98} C ${hx + 14} ${hy - 70} ${hx + 12} ${hy - 36} ${hx + 8} ${hy - 8} Z`, STEEL, { sw: 4 }) +
    L(`M ${hx - 2} ${hy - 14} C ${hx - 4} ${hy - 50} ${hx} ${hy - 76} ${hx + 4} ${hy - 90}`, '#fff', 2.4, 0.7) +
    P(`M ${hx - 15} ${hy - 6} L ${hx + 15} ${hy - 6} L ${hx + 13} ${hy + 2} L ${hx - 13} ${hy + 2} Z`, trim, { sw: 3 }) +
    P(`M ${hx - 5} ${hy + 2} L ${hx + 5} ${hy + 2} L ${hx + 5} ${hy + 22} L ${hx - 5} ${hy + 22} Z`, main, { sw: 3 }) +
    E(hx, hy + 25, 6, 6, trim, { sw: 2.6 })
  );
}

export function renderWeaponImpl(ctx: Ctx, pose: Pose): WeaponOut {
  const kind = ctx.look.outfit.weapon ?? 'none';
  const { main, trim } = ctx.pal;
  const [hx, hy] = pose.R;
  const [lx, ly] = pose.L;
  switch (kind) {
    case 'sword':
      return { svg: `<g transform="rotate(-10 ${hx} ${hy})">${sword(hx, hy, ctx)}</g>` };
    case 'dualSwords': {
      const left = `<g transform="rotate(-16 ${lx} ${ly})">${sword(lx, ly, ctx, 120)}</g>`;
      const right = `<g transform="rotate(16 ${hx} ${hy})">${sword(hx, hy, ctx, 120)}</g>`;
      return { svg: right, svgL: left };
    }
    case 'glaive': {
      const px = hx + 4;
      const blade = `M ${px - 4} 200 C ${px - 10} 150 ${px - 6} 96 ${px - 8} 38 C ${px + 40} 26 ${px + 92} 70 ${px + 80} 134 C ${px + 72} 172 ${px + 40} 192 ${px + 6} 200 Z`;
      let ribs = '';
      for (let i = 0; i < 5; i++) {
        const yy = 70 + i * 24;
        ribs += `M ${px + 4} ${yy + 10} Q ${px + 30 + i * 3} ${yy - 2} ${px + 54 - i * 5} ${yy - 14} `;
      }
      let teeth = '';
      for (let i = 0; i < 4; i++) teeth += P(`M ${px - 6} ${70 + i * 28} L ${px - 22} ${82 + i * 28} L ${px - 6} ${90 + i * 28} Z`, '#aab9c6', { sw: 3 });
      return {
        svg:
          pole(px, 40, 556) +
          P(`M ${px - 8} 462 L ${px - 18} 486 L ${px} 476 L ${px + 18} 486 L ${px + 8} 462 Z`, trim, { sw: 3.5 }) +
          teeth +
          P(blade, '#e4edf3', { sw: 4.5 }) +
          `<path d="M ${px - 6} 190 C ${px - 8} 140 ${px - 4} 96 ${px - 6} 44 L ${px + 10} 44 C ${px + 8} 96 ${px + 10} 140 ${px + 12} 190 Z" fill="#aab9c6" opacity="0.9"/>` +
          L(ribs, '#9db0bf', 3.4, 0.95) +
          L(`M ${px + 34} 50 C ${px + 70} 66 ${px + 78} 100 ${px + 72} 128`, '#fff', 3.4, 0.85) +
          P(`M ${px - 12} 198 L ${px + 12} 198 L ${px + 15} 218 L ${px - 15} 218 Z`, trim, { sw: 3.5 }) +
          tassel(px, 220, '#3a9a62', 46),
      };
    }
    case 'spear': {
      const px = hx + 2;
      return {
        svg:
          pole(px, 60, 556, '#6a4a30', 10) +
          P(`M ${px} 26 C ${px + 18} 52 ${px + 8} 70 ${px + 16} 100 C ${px + 24} 128 ${px + 8} 150 ${px + 10} 178 L ${px - 10} 178 C ${px - 8} 150 ${px - 24} 128 ${px - 16} 100 C ${px - 8} 70 ${px - 18} 52 ${px} 26 Z`, STEEL, { sw: 4.5 }) +
          L(`M ${px} 36 C ${px + 8} 62 ${px - 4} 84 ${px + 2} 110 C ${px + 6} 134 ${px} 150 ${px} 172`, '#a9b8c8', 3) +
          P(`M ${px - 12} 178 L ${px + 12} 178 L ${px + 12} 192 L ${px - 12} 192 Z`, trim, { sw: 3.4 }) +
          tassel(px, 196, main, 50),
      };
    }
    case 'halberd': {
      const px = hx + 2;
      const crescent = (sd: 1 | -1) => P(`M ${px + sd * 6} 130 C ${px + sd * 56} 128 ${px + sd * 66} 84 ${px + sd * 52} 60 C ${px + sd * 48} 90 ${px + sd * 32} 104 ${px + sd * 6} 106 Z`, STEEL, { sw: 4 });
      return {
        svg:
          pole(px, 60, 556, '#5a3a28', 11) +
          crescent(1) + crescent(-1) +
          P(`M ${px} 20 L ${px + 12} 100 L ${px + 8} 150 L ${px - 8} 150 L ${px - 12} 100 Z`, STEEL, { sw: 4.5 }) +
          L(`M ${px} 32 L ${px} 140`, '#a9b8c8', 3) +
          P(`M ${px - 14} 150 L ${px + 14} 150 L ${px + 14} 164 L ${px - 14} 164 Z`, trim, { sw: 3.4 }) +
          // 红色飘带
          P(`M ${px + 8} 168 C ${px + 44} 160 ${px + 62} 190 ${px + 94} 176 C ${px + 80} 204 ${px + 50} 208 ${px + 10} 190 Z`, main, { sw: 3.4 }),
      };
    }
    case 'fan': {
      const R: [number, number] = [hx - 4, hy - 40];
      const cx = R[0] + 6;
      const cy = R[1] - 18;
      const angs = [-66, -44, -22, 0, 22, 44, 66];
      const feathers = angs
        .map((a) => {
          const len = 94 - Math.abs(a) * 0.25;
          return `<g transform="translate(${cx} ${cy}) rotate(${a})">` +
            P(`M 0 0 C 17 ${-len * 0.3} 16 ${-len * 0.8} 0 ${-len} C -16 ${-len * 0.8} -17 ${-len * 0.3} 0 0 Z`, '#fbfaf4', { sw: 3 }) +
            `<path d="M 0 ${-len * 0.62} C 12 ${-len * 0.7} 12 ${-len * 0.88} 0 ${-len} C -12 ${-len * 0.88} -12 ${-len * 0.7} 0 ${-len * 0.62} Z" fill="${ctx.pal.main}" opacity="0.85"/>` +
            L(`M 0 -4 L 0 ${-len * 0.9}`, '#c9c2b0', 2, 0.8) +
            `</g>`;
        })
        .join('');
      return {
        pose: { R },
        svg:
          `<g transform="rotate(14 ${R[0]} ${R[1]})">` +
          P(`M ${R[0] - 5} ${R[1] + 6} L ${R[0] + 7} ${cy + 4} L ${R[0] + 2} ${cy + 2} L ${R[0] - 9} ${R[1] + 6} Z`, '#8a5a30', { sw: 3 }) +
          feathers +
          E(cx, cy, 11, 11, trim, { sw: 3.2 }) +
          `</g>`,
      };
    }
    case 'qin': {
      const pr: [number, number] = [248, 366];
      const pl: [number, number] = [152, 366];
      const dots = [120, 142, 164, 186, 208, 230, 252, 274].map((x) => `<circle cx="${x}" cy="372" r="2.6" fill="#f7efd8"/>`).join('');
      const strings = [374, 378, 382, 386, 390, 394].map((y) => L(`M 104 ${y} L 294 ${y + (y - 384) * 0.1}`, '#f1d98a', 1.8, 0.95)).join('');
      const note = (x: number, y: number, c: string) => E(x, y, 8, 6, c, { sw: 2.6, rot: -20 }) + L(`M ${x + 7} ${y - 2} L ${x + 7} ${y - 26} Q ${x + 16} ${y - 22} ${x + 16} ${y - 14}`, ink(c), 3);
      return {
        pose: { R: pr, L: pl },
        svg:
          P('M 92 384 C 90 370 110 364 140 366 L 268 366 C 292 366 310 372 310 386 C 310 400 292 404 268 404 L 140 404 C 110 404 94 398 92 384 Z', '#6b3f2a', { sw: 4.5 }) +
          P('M 108 372 L 292 372 C 300 374 302 394 292 398 L 108 398 C 100 394 100 376 108 372 Z', '#8a5438', { noStroke: true, op: 0.9 }) +
          dots + strings +
          P('M 294 372 L 312 376 L 312 392 L 294 396 Z', trim, { sw: 3 }) +
          note(318, 330, trim) + note(344, 296, main),
      };
    }
    case 'bow': {
      const bx = hx + 40;
      const R: [number, number] = [bx, 368];
      const arc = `M ${bx - 46} 226 C ${bx + 62} 282 ${bx + 62} 454 ${bx - 46} 500`;
      return {
        pose: { R },
        svg:
          L(`M ${bx - 46} 226 L ${bx - 46} 500`, '#efe3c0', 2.6) +
          `<path d="${arc}" fill="none" stroke="${ink('#a8683a')}" stroke-width="18" stroke-linecap="round"/>` +
          `<path d="${arc}" fill="none" stroke="#b9824a" stroke-width="11" stroke-linecap="round"/>` +
          `<path d="M ${bx + 6} 270 C ${bx + 34} 310 ${bx + 36} 400 ${bx + 12} 450" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.35"/>` +
          E(bx - 46, 226, 7, 7, trim, { sw: 2.8 }) + E(bx - 46, 500, 7, 7, trim, { sw: 2.8 }) +
          P(`M ${bx + 8} 340 L ${bx + 28} 340 L ${bx + 28} 396 L ${bx + 8} 396 Z`, main, { sw: 3.4 }) +
          // 铃铛
          L(`M ${bx - 46} 236 L ${bx - 46} 252`, '#8a6a1c', 2.6) + E(bx - 46, 260, 8, 8, '#f0c75a', { sw: 3 }) +
          // 箭
          `<g transform="rotate(-8 ${bx - 20} 360)">` + L(`M ${bx - 30} 480 L ${bx - 30} 270`, '#c9a063', 4.5) + P(`M ${bx - 38} 270 L ${bx - 30} 246 L ${bx - 22} 270 Z`, STEEL, { sw: 3 }) + P(`M ${bx - 38} 490 L ${bx - 30} 470 L ${bx - 22} 490 L ${bx - 30} 482 Z`, main, { sw: 2.6 }) + `</g>`,
      };
    }
    case 'staff': {
      const px = hx + 2;
      return {
        svg:
          pole(px, 80, 556, '#8a5a30', 12) +
          `<circle cx="${px}" cy="62" r="26" fill="none" stroke="${ink(trim)}" stroke-width="13"/><circle cx="${px}" cy="62" r="26" fill="none" stroke="${trim}" stroke-width="8"/>` +
          E(px, 62, 11, 11, main, { sw: 3 }) + L(`M ${px - 4} 58 L ${px} 54`, '#fff', 2.6, 0.7) +
          P(`M ${px - 5} 28 L ${px + 5} 28 L ${px} 14 Z`, trim, { sw: 2.6 }) +
          E(px - 30, 112, 7, 7, trim, { sw: 2.4 }) + E(px + 30, 112, 7, 7, trim, { sw: 2.4 }) +
          tassel(px, 116, main, 36),
      };
    }
    case 'mace': {
      const px = hx + 2;
      const club = `M ${px - 14} 190 C ${px - 30} 150 ${px - 40} 96 ${px - 28} 54 C ${px - 14} 30 ${px + 14} 30 ${px + 28} 54 C ${px + 40} 96 ${px + 30} 150 ${px + 14} 190 Z`;
      const spk = (x: number, y: number, a: number) => `<path d="M -7 0 L 0 -22 L 7 0 Z" fill="#f4ead0" stroke="#6a5a3a" stroke-width="3" stroke-linejoin="round" transform="translate(${x} ${y}) rotate(${a})"/>`;
      return {
        svg:
          `<g transform="rotate(-8 ${hx} ${hy})">` +
          pole(px, 180, 548, '#7a5230', 15) +
          P(club, '#8a5a34', { sw: 4.5 }) +
          L(`M ${px - 14} 70 Q ${px - 22} 110 ${px - 12} 160`, '#fff', 4, 0.22) +
          P(`M ${px - 33} 84 Q ${px} 94 ${px + 33} 84 L ${px + 34} 98 Q ${px} 108 ${px - 34} 98 Z`, ctx.pal.trim, { sw: 3 }) +
          P(`M ${px - 26} 142 Q ${px} 152 ${px + 26} 142 L ${px + 24} 156 Q ${px} 166 ${px - 24} 156 Z`, ctx.pal.trim, { sw: 3 }) +
          spk(px - 30, 70, -70) + spk(px + 30, 70, 70) + spk(px - 36, 122, -80) + spk(px + 36, 122, 80) + spk(px - 24, 176, -110) + spk(px + 24, 176, 110) + spk(px, 36, 0) +
          P(`M ${px - 10} 330 L ${px + 10} 330 L ${px + 10} 352 L ${px - 10} 352 Z`, main, { sw: 3 }) +
          `</g>`,
      };
    }
    case 'whip': {
      const px = hx + 2;
      let joints = '';
      for (let y = 140; y < 400; y += 36) joints += P(`M ${px - 11} ${y} L ${px + 11} ${y} L ${px + 11} ${y + 8} L ${px - 11} ${y + 8} Z`, '#8a909e', { sw: 2.6 });
      return {
        svg:
          `<g transform="rotate(-6 ${hx} ${hy})">` +
          P(`M ${px - 7} 100 L ${px + 7} 100 L ${px + 8} 440 L ${px - 8} 440 Z`, '#aeb4c0', { sw: 4.5 }) +
          L(`M ${px - 3} 110 L ${px - 3} 430`, '#fff', 2.6, 0.55) +
          P(`M ${px - 7} 100 L ${px} 76 L ${px + 7} 100 Z`, '#cfd5de', { sw: 3.4 }) +
          joints +
          tassel(px, 440, main, 28) +
          `</g>`,
      };
    }
    case 'knives': {
      const left = `<g transform="rotate(-24 ${lx} ${ly})">${dagger(lx, ly, ctx)}</g>`;
      const right = `<g transform="rotate(24 ${hx} ${hy})">${dagger(hx, hy, ctx)}</g>`;
      // 空中飞刀
      const fly = (x: number, y: number, a: number) => `<g transform="translate(${x} ${y}) rotate(${a}) scale(0.62)">${dagger(0, 0, ctx)}</g>`;
      return { svg: right + fly(352, 300, 48) + fly(366, 360, 70), svgL: left + fly(54, 292, -48) };
    }
    case 'scroll': {
      const R: [number, number] = [hx - 28, hy - 70];
      const sx = hx - 66;
      return {
        pose: { R },
        svg:
          P(`M ${sx} 296 L ${sx + 96} 296 L ${sx + 96} 396 L ${sx} 396 Z`, '#f6ecc8', { sw: 4 }) +
          L(`M ${sx + 14} 318 L ${sx + 82} 318 M ${sx + 14} 334 L ${sx + 74} 334 M ${sx + 14} 350 L ${sx + 82} 350 M ${sx + 14} 366 L ${sx + 62} 366`, '#a8885a', 3, 0.7) +
          E(sx + 70, 372, 8, 8, main, { sw: 2.4, op: 0.85 }) +
          P(`M ${sx - 8} 286 L ${sx + 104} 286 L ${sx + 104} 304 L ${sx - 8} 304 Z`, main, { sw: 3.6 }) +
          P(`M ${sx - 8} 388 L ${sx + 104} 388 L ${sx + 104} 404 L ${sx - 8} 404 Z`, main, { sw: 3.6 }) +
          E(sx - 8, 295, 6, 9, trim, { sw: 2.4 }) + E(sx + 104, 295, 6, 9, trim, { sw: 2.4 }),
      };
    }
    case 'talisman': {
      const R: [number, number] = [hx + 2, hy - 56];
      const fu = (x: number, y: number, a: number) =>
        `<g transform="translate(${x} ${y}) rotate(${a})">` +
        `<ellipse cx="0" cy="0" rx="26" ry="38" fill="#ffe68a" opacity="0.28"/>` +
        P('M -15 -34 L 15 -34 L 15 34 L -15 34 Z', '#f5d65a', { sw: 3.4 }) +
        L('M -8 -22 L 8 -22 M 0 -22 L 0 -8 M -8 -4 Q 0 6 8 -4 M -6 12 L 6 12 M 0 12 L 0 26', '#c0392b', 3.2, 0.95) +
        `</g>`;
      return {
        pose: { R },
        svg: fu(hx + 28, 236, 18) + fu(hx - 34, 262, -14) + fu(hx + 62, 316, 34),
      };
    }
    case 'brush': {
      const px = hx + 2;
      return {
        svg:
          `<g transform="rotate(-8 ${hx} ${hy})">` +
          pole(px, 118, 548, '#c9a063', 11) +
          L(`M ${px} 118 L ${px} 470`, '#8a6a3a', 2, 0.35) +
          P(`M ${px - 12} 120 C ${px - 18} 80 ${px - 8} 50 ${px} 20 C ${px + 8} 50 ${px + 18} 80 ${px + 12} 120 Z`, '#2a2230', { sw: 4 }) +
          L(`M ${px - 4} 112 C ${px - 8} 80 ${px - 2} 56 ${px} 42`, '#fff', 2.6, 0.3) +
          P(`M ${px - 14} 120 L ${px + 14} 120 L ${px + 12} 134 L ${px - 12} 134 Z`, trim, { sw: 3 }) +
          `<path d="M ${px + 20} 62 C ${px + 26} 74 ${px + 26} 82 ${px + 20} 84 C ${px + 14} 82 ${px + 14} 74 ${px + 20} 62 Z" fill="#2a2230"/>` +
          tassel(px, 470, main, 20) +
          `</g>`,
      };
    }
    case 'drum': {
      const dx = lx + 10;
      const dy = ly - 14;
      const rope = Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return `M ${dx + Math.cos(a) * 40} ${dy + Math.sin(a) * 40} L ${dx + Math.cos(a + 0.6) * 40} ${dy + Math.sin(a + 0.6) * 40}`;
      }).join(' ');
      return {
        pose: { L: [dx - 40, dy + 4] },
        svgL:
          E(dx, dy, 48, 48, '#8a5a30', { sw: 5 }) +
          E(dx, dy, 38, 38, '#f1dcb0', { sw: 3.5 }) +
          L(`M ${dx - 24} ${dy - 12} Q ${dx} ${dy - 24} ${dx + 24} ${dy - 12}`, '#fff', 3, 0.5) +
          // 鼓面兽爪印
          E(dx, dy + 6, 11, 9, main, { noStroke: true, op: 0.9 }) + [-14, -5, 5, 14].map((o) => E(dx + o, dy - 10 - Math.abs(o) * 0.2, 4, 5, main, { noStroke: true, op: 0.9 })).join('') +
          L(rope, trim, 3, 0.9) +
          // 羽毛挂饰
          L(`M ${dx + 30} ${dy - 36} Q ${dx + 50} ${dy - 56} ${dx + 44} ${dy - 80}`, '#3aa7a0', 5),
        svg:
          // 鼓槌
          `<g transform="rotate(26 ${hx} ${hy})">` + P(`M ${hx - 4} ${hy - 80} L ${hx + 4} ${hy - 80} L ${hx + 4} ${hy + 10} L ${hx - 4} ${hy + 10} Z`, '#c9a063', { sw: 3 }) + E(hx, hy - 86, 11, 11, main, { sw: 3 }) + `</g>`,
      };
    }
    case 'coinsPlain':
    case 'coins': {
      const plain = kind === 'coinsPlain';
      const R: [number, number] = [hx - 6, hy - 52];
      const coin = (x: number, y: number, r = 20) =>
        `<g transform="translate(${x} ${y})">` + E(0, 0, r, r, trim, { sw: 3.4 }) + E(0, 0, r * 0.7, r * 0.7, 'none', { sw: 1.8, stroke: ink(trim) }) +
        `<rect x="${-r * 0.26}" y="${-r * 0.26}" width="${r * 0.52}" height="${r * 0.52}" fill="${ctx.fur === '#000' ? '#000' : '#6a4a22'}" stroke="${ink(trim)}" stroke-width="1.6"/>` +
        L(`M ${-r * 0.5} ${-r * 0.5} Q 0 ${-r * 0.95} ${r * 0.5} ${-r * 0.5}`, '#fff', 2.4, 0.6) + `</g>`;
      const spark = (x: number, y: number) => P(`M ${x} ${y - 10} L ${x + 3} ${y - 3} L ${x + 10} ${y} L ${x + 3} ${y + 3} L ${x} ${y + 10} L ${x - 3} ${y + 3} L ${x - 10} ${y} L ${x - 3} ${y - 3} Z`, '#fff6c0', { sw: 1.6, stroke: '#e8c15a' });
      return {
        pose: { R },
        svg:
          L(`M ${R[0]} ${R[1]} Q ${R[0] - 10} ${R[1] - 30} ${R[0] - 4} ${R[1] - 60}`, main, 3.4) +
          coin(R[0] - 4, R[1] - 76, 24) + coin(R[0] - 56, R[1] - 36, 18) + coin(R[0] + 48, R[1] - 46, 19) +
          (plain ? '' : spark(R[0] - 34, R[1] - 90) + spark(R[0] + 40, R[1] - 90) + spark(R[0] - 68, R[1] - 74)),
      };
    }
    case 'herbs': {
      const R: [number, number] = [hx - 4, hy - 30];
      const leaf = (a: number, len: number, col: string) =>
        `<g transform="translate(${R[0]} ${R[1] - 10}) rotate(${a})">` + P(`M 0 0 C 14 ${-len * 0.4} 10 ${-len * 0.8} 0 ${-len} C -10 ${-len * 0.8} -14 ${-len * 0.4} 0 0 Z`, col, { sw: 3 }) + L(`M 0 -4 L 0 ${-len * 0.85}`, ink(col), 2, 0.55) + `</g>`;
      return {
        pose: { R },
        svg:
          leaf(-52, 70, '#7dbf62') + leaf(52, 70, '#7dbf62') + leaf(-26, 92, '#5aa84e') + leaf(26, 92, '#5aa84e') + leaf(0, 108, '#8ccc6a') +
          L(`M ${R[0]} ${R[1] - 6} L ${R[0]} ${R[1] + 10}`, '#6a8a3a', 5) +
          // 药囊葫芦
          L(`M ${lx + 6} ${ly - 16} Q ${lx - 10} ${ly + 6} ${lx + 6} ${ly + 22}`, '#8a4a2a', 3) +
          P(`M ${lx + 6} ${ly + 8} C ${lx - 14} ${ly + 6} ${lx - 14} ${ly + 28} ${lx - 2} ${ly + 34} C ${lx - 20} ${ly + 44} ${lx - 14} ${ly + 70} ${lx + 6} ${ly + 70} C ${lx + 26} ${ly + 70} ${lx + 32} ${ly + 44} ${lx + 14} ${ly + 34} C ${lx + 26} ${ly + 28} ${lx + 26} ${ly + 6} ${lx + 6} ${ly + 8} Z`, tint(main, 0.1), { sw: 3.4 }) +
          E(lx + 6, ly + 6, 5, 4, '#8a4a2a', { sw: 2 }),
      };
    }
    case 'dualBlades': {
      const blade = (x: number, y: number, a: number) => `<g transform="rotate(${a} ${x} ${y}) translate(${x} ${y}) scale(1.45) translate(${-x} ${-y})">${dagger(x, y, ctx)}</g>`;
      return { svg: blade(hx, hy, 18), svgL: blade(lx, ly, -18) };
    }
    case 'hooks': {
      const hook = (x: number, y: number, a: number, flip: number) =>
        `<g transform="rotate(${a} ${x} ${y})">` +
        P(`M ${x - 7} ${y - 8} L ${x - 7} ${y - 118} C ${x - 7} ${y - 150} ${x + flip * 30} ${y - 160} ${x + flip * 40} ${y - 136} C ${x + flip * 30} ${y - 140} ${x + 5} ${y - 134} ${x + 7} ${y - 112} L ${x + 7} ${y - 8} Z`, STEEL, { sw: 3.8 }) +
        L(`M ${x} ${y - 14} L ${x} ${y - 112}`, '#fff', 2.2, 0.6) +
        P(`M ${x - 18} ${y - 6} Q ${x} ${y - 18} ${x + 18} ${y - 6} L ${x + 15} ${y + 3} Q ${x} ${y - 7} ${x - 15} ${y + 3} Z`, trim, { sw: 3 }) +
        P(`M ${x - 5} ${y} L ${x + 5} ${y} L ${x + 5} ${y + 24} L ${x - 5} ${y + 24} Z`, main, { sw: 3 }) + `</g>`;
      return { svg: hook(hx, hy, 14, 1), svgL: hook(lx, ly, -14, -1) };
    }
    case 'axe': {
      const R: [number, number] = [hx + 4, hy - 20];
      const ax = hx + 4;
      return {
        pose: { R },
        svg: `<g transform="rotate(8 ${ax} ${hy})">` +
          L(`M ${ax} ${hy + 60} L ${ax} ${hy - 170}`, '#8a5a2a', 9) +
          P(`M ${ax - 4} ${hy - 176} C ${ax + 40} ${hy - 220} ${ax + 84} ${hy - 190} ${ax + 76} ${hy - 126} C ${ax + 50} ${hy - 138} ${ax + 22} ${hy - 138} ${ax - 4} ${hy - 124} Z`, STEEL, { sw: 4 }) +
          L(`M ${ax + 10} ${hy - 150} C ${ax + 34} ${hy - 172} ${ax + 58} ${hy - 168} ${ax + 64} ${hy - 146}`, '#fff', 2.6, 0.7) +
          E(ax, hy - 178, 8, 8, trim, { sw: 3 }) + tassel(ax, hy - 118, main, 30) + `</g>`,
      };
    }
    case 'whisk': {
      const R: [number, number] = [hx - 4, hy - 30];
      const bx = R[0], by = R[1] - 16;
      let strands = '';
      for (let i = -5; i <= 5; i++) strands += `<path d="M ${bx} ${by} C ${bx + i * 9} ${by - 40} ${bx + i * 16} ${by - 70} ${bx + i * 12} ${by - 108}" fill="none" stroke="${i % 2 ? '#ffffff' : '#e8eef6'}" stroke-width="5" stroke-linecap="round" opacity="0.95"/>`;
      return {
        pose: { R },
        svg: L(`M ${bx} ${by + 40} L ${bx} ${by}`, '#8a5a2a', 8) + E(bx, by + 44, 7, 7, trim, { sw: 2.6 }) + strands + E(bx, by, 8, 6, trim, { sw: 2.6 }),
      };
    }
    case 'dagger':
      return { svg: `<g transform="rotate(14 ${hx} ${hy})">${dagger(hx, hy, ctx)}</g>` };
    case 'shield': {
      const cx = lx - 10, cy = ly - 6;
      return {
        svgL:
          E(cx, cy, 46, 46, '#b9824a', { sw: 5 }) + E(cx, cy, 36, 36, 'none', { sw: 3, stroke: ink('#b9824a') }) +
          E(cx, cy, 30, 30, tint(main, 0.1), { sw: 2.4 }) + E(cx, cy, 9, 9, trim, { sw: 2.6 }) +
          L(`M ${cx - 30} ${cy} L ${cx + 30} ${cy} M ${cx} ${cy - 30} L ${cx} ${cy + 30}`, '#fff', 2, 0.28) +
          E(cx - 36, cy - 4, 3.2, 3.2, trim, { sw: 1.6 }) + E(cx + 36, cy - 4, 3.2, 3.2, trim, { sw: 1.6 }),
        svg: '',
      };
    }
    case 'boxShield': {
      const x = lx - 54, y = ly - 54;
      return {
        svgL:
          P(`M ${x} ${y} L ${x + 84} ${y + 4} L ${x + 80} ${y + 92} L ${x + 4} ${y + 88} Z`, '#d9b57c', { sw: 4.4 }) +
          P(`M ${x + 30} ${y + 2} L ${x + 52} ${y + 3} L ${x + 50} ${y + 90} L ${x + 28} ${y + 89} Z`, '#f3e2b4', { sw: 0, op: 0.8 }) +
          L(`M ${x + 6} ${y + 46} L ${x + 82} ${y + 48}`, '#b98a4a', 2.4, 0.6) +
          `<g fill="${ink(main)}" opacity="0.85" transform="translate(${x + 56} ${y + 66}) scale(0.62)"><ellipse cx="0" cy="5" rx="9" ry="7"/><ellipse cx="-10" cy="-6" rx="3.6" ry="4.6"/><ellipse cx="-4" cy="-12" rx="3.6" ry="4.6"/><ellipse cx="4" cy="-12" rx="3.6" ry="4.6"/><ellipse cx="10" cy="-6" rx="3.6" ry="4.6"/></g>`,
        svg: '',
      };
    }
    case 'crossbow': {
      const R: [number, number] = [hx - 10, 376];
      const x = hx - 46;
      return {
        pose: { R },
        svg:
          P(`M ${x} 366 L ${x + 112} 368 L ${x + 112} 382 L ${x} 384 Z`, '#8a5a2a', { sw: 3.6 }) +
          `<path d="M ${x + 98} 318 Q ${x + 142} 376 ${x + 98} 434" fill="none" stroke="${ink('#a8683a')}" stroke-width="14" stroke-linecap="round"/><path d="M ${x + 98} 318 Q ${x + 142} 376 ${x + 98} 434" fill="none" stroke="#b9824a" stroke-width="8" stroke-linecap="round"/>` +
          L(`M ${x + 98} 318 L ${x + 70} 376 L ${x + 98} 434`, '#efe3c0', 2.4) +
          P(`M ${x + 20} 364 L ${x + 112} 372 L ${x + 20} 380 Z`, '#c9a063', { sw: 2.4 }) + P(`M ${x + 108} 364 L ${x + 126} 372 L ${x + 108} 380 Z`, STEEL, { sw: 2.4 }) +
          P(`M ${x + 30} 384 L ${x + 42} 384 L ${x + 38} 402 L ${x + 28} 402 Z`, main, { sw: 3 }),
      };
    }
    case 'slingshot': {
      const R: [number, number] = [hx, hy - 20];
      return {
        pose: { R },
        svg:
          L(`M ${R[0]} ${R[1] + 26} L ${R[0]} ${R[1] - 40}`, '#8a5a2a', 9) + L(`M ${R[0]} ${R[1] - 40} L ${R[0] - 24} ${R[1] - 90}`, '#8a5a2a', 8) + L(`M ${R[0]} ${R[1] - 40} L ${R[0] + 24} ${R[1] - 90}`, '#8a5a2a', 8) +
          L(`M ${R[0] - 24} ${R[1] - 90} Q ${R[0]} ${R[1] - 62} ${R[0] + 24} ${R[1] - 90}`, main, 3.4) + E(R[0], R[1] - 66, 7, 6, '#9aa2ab', { sw: 2.4 }),
      };
    }
    default:
      return { svg: '' };
  }
}

export { mirror };
