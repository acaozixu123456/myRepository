// 毛色花纹贴图：按 CatLook.coat.pattern 生成一张小画布贴图（头 / 手 / 腿 / 尾共用）。
// solid / shaded 不需要贴图（返回 null），其余花纹见各分支。花纹细化是 Codex 的任务（docs/CODEX_3D_BRIEF.md）。
import * as THREE from 'three';
import type { CatLook } from '../art/types';

const cache = new Map<string, THREE.CanvasTexture | null>();

/** part：head = 颅骨球（脸在 u≈0.25）；body = 手臂 / 腿 / 尾 */
export function coatTexture(look: CatLook, part: 'head' | 'body' = 'body'): THREE.CanvasTexture | null {
  const c = look.coat;
  const key = `${part}|${c.pattern}|${c.base}|${c.light}|${c.accent ?? ''}|${c.stripe ?? ''}`;
  if (cache.has(key)) return cache.get(key)!;
  let out: THREE.CanvasTexture | null = null;
  if (typeof document !== 'undefined' && c.pattern !== 'solid' && c.pattern !== 'shaded') {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const g = cv.getContext('2d')!;
    g.fillStyle = c.base;
    g.fillRect(0, 0, 256, 256);
    const stripe = c.stripe ?? '#00000040';
    if (c.pattern === 'tabby' && part === 'head') {
      // SphereGeometry 的 +z 在 x=64；眼睛约在 y=128，额纹要留在眼睛上方。
      g.fillStyle = c.light;
      g.beginPath(); g.ellipse(64, 176, 31, 37, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = stripe;
      // 连成 M 的两侧长纹、中央短纹：尖端圆润，避免像字母印章。
      g.beginPath();
      g.moveTo(44, 106);
      g.bezierCurveTo(40, 93, 39, 74, 43, 57);
      g.bezierCurveTo(47, 61, 49, 78, 52, 86);
      g.quadraticCurveTo(58, 77, 64, 75);
      g.quadraticCurveTo(70, 77, 76, 86);
      g.bezierCurveTo(79, 78, 81, 61, 85, 57);
      g.bezierCurveTo(89, 74, 88, 93, 84, 106);
      g.quadraticCurveTo(81, 110, 78, 102);
      g.lineTo(73, 91);
      g.quadraticCurveTo(67, 86, 67, 104);
      g.quadraticCurveTo(64, 112, 61, 104);
      g.quadraticCurveTo(61, 86, 55, 91);
      g.lineTo(50, 102);
      g.quadraticCurveTo(47, 110, 44, 106);
      g.fill();
      // 两颊各两道弯曲、向口鼻渐细的纹，绕侧面也能读到。
      for (const side of [-1, 1]) {
        g.save(); g.translate(64, 0); g.scale(side, 1);
        for (let i = 0; i < 2; i++) {
          const y = 137 + i * 17;
          g.beginPath(); g.moveTo(52, y - 5);
          g.bezierCurveTo(44, y - 7, 35, y - 3, 26 + i * 3, y + 1);
          g.quadraticCurveTo(31, y + 4, 39, y + 4);
          g.quadraticCurveTo(47, y + 4, 52, y + 1); g.fill();
        }
        g.restore();
      }
    } else if (c.pattern === 'tabby') {
      // 尾段沿 z 拉长：按球面法线 z 留一圈纹，不能用沿 y 的平行条带。
      // 两个 z 端帽保留底色；闭合轮廓直接映射到 UV，接缝也连续。
      g.fillStyle = stripe; g.fillRect(0, 0, 256, 256);
      g.fillStyle = c.base;
      for (const z of [-0.2, 0.2]) {
        const r = Math.sqrt(1 - z * z);
        g.beginPath();
        for (let i = 0; i <= 64; i++) {
          const a = (i / 64) * Math.PI * 2;
          const phi = Math.atan2(z, -r * Math.cos(a));
          const x = ((phi < 0 ? phi + Math.PI * 2 : phi) / (Math.PI * 2)) * 256;
          const y = (Math.acos(r * Math.sin(a)) / Math.PI) * 256;
          if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.closePath(); g.fill();
      }
    } else if (c.pattern === 'tuxedo' && part === 'head') {
      // 白色鼻梁从额头渐宽，包住口鼻与下颌；深色眼罩保留在两侧。
      g.fillStyle = c.light;
      g.beginPath(); g.moveTo(64, 79);
      g.bezierCurveTo(59, 85, 56, 105, 51, 119);
      g.bezierCurveTo(47, 136, 31, 144, 25, 159);
      g.bezierCurveTo(14, 179, 23, 204, 37, 213);
      g.lineTo(91, 213);
      g.bezierCurveTo(105, 204, 114, 179, 103, 159);
      g.bezierCurveTo(97, 144, 81, 136, 77, 119);
      g.bezierCurveTo(72, 105, 69, 85, 64, 79); g.fill();
      g.fillRect(0, 213, 256, 43);
    } else if (c.pattern === 'tuxedo') {
      // 下半部白袜绕全周，正面的小白围兜与浅色绒领同色。
      g.fillStyle = c.light;
      g.beginPath(); g.moveTo(0, 194);
      g.bezierCurveTo(22, 186, 39, 200, 64, 191);
      g.bezierCurveTo(88, 183, 109, 196, 128, 194);
      g.bezierCurveTo(151, 187, 173, 199, 192, 191);
      g.bezierCurveTo(216, 184, 235, 199, 256, 194);
      g.lineTo(256, 256); g.lineTo(0, 256); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(64, 119);
      g.bezierCurveTo(59, 131, 56, 141, 48, 151);
      g.bezierCurveTo(38, 163, 35, 177, 39, 200);
      g.lineTo(89, 200);
      g.bezierCurveTo(93, 177, 90, 163, 80, 151);
      g.bezierCurveTo(72, 141, 69, 131, 64, 119); g.fill();
    } else if (c.pattern === 'calico') {
      // 三花以浅毛为底，橘 / 深色为不对称的大块；不随机撒圆点。
      const dark = c.accent ?? c.stripe ?? c.base;
      g.fillStyle = c.light; g.fillRect(0, 0, 256, 256);
      if (part === 'head') {
        g.fillStyle = c.base;
        g.beginPath(); g.moveTo(5, 27);
        g.bezierCurveTo(12, 10, 32, 22, 47, 41);
        g.bezierCurveTo(54, 54, 44, 68, 49, 86);
        g.bezierCurveTo(53, 107, 43, 126, 30, 135);
        g.bezierCurveTo(15, 145, 2, 128, 5, 134); g.closePath(); g.fill();
        g.fillStyle = dark;
        g.beginPath(); g.moveTo(87, 61);
        g.bezierCurveTo(101, 56, 119, 68, 130, 85);
        g.bezierCurveTo(143, 103, 130, 116, 134, 134);
        g.bezierCurveTo(134, 149, 116, 165, 103, 158);
        g.bezierCurveTo(94, 154, 88, 140, 85, 126);
        g.bezierCurveTo(79, 109, 88, 96, 81, 84);
        g.bezierCurveTo(77, 73, 80, 64, 87, 61); g.fill();
        // 侧后方也保留块面，正面鼻梁 / 下颌始终有白色留白。
        g.fillStyle = c.base;
        g.beginPath(); g.moveTo(157, 121);
        g.bezierCurveTo(166, 99, 194, 111, 203, 126);
        g.bezierCurveTo(219, 139, 220, 166, 199, 179);
        g.bezierCurveTo(178, 194, 158, 185, 154, 165);
        g.bezierCurveTo(146, 149, 157, 138, 157, 121); g.fill();
        g.fillStyle = dark;
        g.beginPath(); g.moveTo(220, 31);
        g.bezierCurveTo(235, 19, 247, 36, 247, 48);
        g.bezierCurveTo(253, 74, 248, 96, 244, 115);
        g.bezierCurveTo(239, 120, 233, 102, 224, 87);
        g.bezierCurveTo(216, 72, 210, 45, 220, 31); g.fill();
      } else {
        g.fillStyle = c.base;
        g.beginPath(); g.moveTo(30, 54);
        g.bezierCurveTo(43, 37, 72, 44, 82, 65);
        g.bezierCurveTo(94, 83, 79, 104, 82, 124);
        g.bezierCurveTo(80, 145, 48, 154, 34, 138);
        g.bezierCurveTo(19, 122, 33, 103, 23, 85);
        g.bezierCurveTo(17, 72, 22, 60, 30, 54); g.fill();
        g.fillStyle = dark;
        g.beginPath(); g.moveTo(126, 110);
        g.bezierCurveTo(143, 91, 174, 105, 182, 123);
        g.bezierCurveTo(194, 147, 174, 159, 177, 181);
        g.bezierCurveTo(168, 202, 137, 201, 125, 187);
        g.bezierCurveTo(108, 170, 122, 156, 114, 139);
        g.bezierCurveTo(110, 126, 117, 116, 126, 110); g.fill();
        g.fillStyle = c.base;
        g.beginPath(); g.moveTo(221, 36);
        g.bezierCurveTo(237, 28, 250, 46, 247, 59);
        g.bezierCurveTo(254, 83, 249, 111, 242, 129);
        g.bezierCurveTo(239, 132, 233, 112, 225, 100);
        g.bezierCurveTo(214, 86, 207, 48, 221, 36); g.fill();
      }
    } else if (c.pattern === 'point') {
      const dark = c.accent ?? c.stripe ?? c.base;
      if (part === 'head') {
        // 正脸是 +z / u=.25。连续面罩从鼻梁向两颊渐深，不落在侧脸 x=128。
        g.save(); g.translate(64, 140); g.scale(53, 66);
        const mask = g.createRadialGradient(0, 0, 0.20, 0, 0, 1);
        mask.addColorStop(0, dark); mask.addColorStop(0.66, dark);
        mask.addColorStop(0.88, c.base); mask.addColorStop(1, c.base);
        g.fillStyle = mask; g.beginPath(); g.arc(0, 0, 1, 0, Math.PI * 2); g.fill(); g.restore();
      } else {
        // 小腿与每一节尾球复用此图；不能靠此纹理改变耳 / 爪或尾球编号。
        g.fillStyle = dark; g.fillRect(0, 0, 256, 256);
      }
    } else if (c.pattern === 'spots') {
      const dark = c.accent ?? c.stripe ?? c.light;
      g.strokeStyle = dark; g.lineWidth = 4; g.lineCap = g.lineJoin = 'round';
      const rings: [number, number, number][] = part === 'head'
        ? [[24, 59, 10], [62, 63, 10], [101, 55, 9], [8, 99, 10], [29, 106, 9], [101, 102, 10], [127, 117, 10], [15, 151, 10], [110, 154, 10], [33, 185, 9], [80, 192, 10], [151, 57, 11], [192, 76, 11], [232, 50, 10], [172, 121, 11], [218, 125, 11], [150, 176, 10], [192, 198, 11], [238, 184, 11]]
        : Array.from({ length: 30 }, (_, i) => [15 + (i % 6) * 46 + Math.floor(i / 6) % 2 * 17, 32 + Math.floor(i / 6) * 46, 10 + i % 3] as [number, number, number]);
      for (let i = 0; i < rings.length; i++) {
        const [x, y, r] = rings[i];
        for (const wrap of [-256, 0, 256]) {
          g.save(); g.translate(x + wrap, y); g.rotate(i * 0.71); g.scale(1, 0.80 + i % 3 * 0.08);
          // 开口、略不规则的玫瑰环；中间仍是底毛色，不是实心圆斑。
          g.beginPath();
          for (let j = 0; j <= 20; j++) {
            const a = 0.22 + j / 20 * 5.05, rr = r * (1 + 0.15 * Math.sin(a * 3 + i));
            const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
            if (j === 0) g.moveTo(px, py); else g.lineTo(px, py);
          }
          g.stroke();
          g.fillStyle = dark; g.beginPath(); g.ellipse(r * 0.72, -r * 0.43, 2.5, 3.8, -0.4, 0, Math.PI * 2); g.fill();
          g.restore();
        }
      }
    } else if (c.pattern === 'cow') {
      // 正式用户 accent 都可能等于 base；必须浅毛铺底，再画大块非对称深斑。
      g.fillStyle = c.light; g.fillRect(0, 0, 256, 256);
      g.fillStyle = c.accent ?? c.stripe ?? c.base;
      const patches: [number, number, number, number][] = part === 'head'
        ? [[15, 111, 37, 61], [101, 77, 35, 54], [172, 100, 53, 68], [223, 200, 40, 42], [117, 192, 18, 24]]
        : [[18, 76, 55, 66], [171, 116, 62, 51], [78, 212, 51, 48], [239, 218, 42, 39]];
      for (const [x, y, rx, ry] of patches) for (const wrap of [-256, 0, 256]) {
        const cx = x + wrap;
        g.beginPath(); g.moveTo(cx - rx * 0.88, y - ry * 0.15);
        g.bezierCurveTo(cx - rx * 1.05, y - ry * 0.88, cx - rx * 0.12, y - ry * 1.03, cx + rx * 0.37, y - ry * 0.78);
        g.bezierCurveTo(cx + rx * 0.99, y - ry * 0.76, cx + rx * 1.08, y - ry * 0.05, cx + rx * 0.77, y + ry * 0.32);
        g.bezierCurveTo(cx + rx * 0.98, y + ry * 0.95, cx + rx * 0.14, y + ry * 1.09, cx - rx * 0.31, y + ry * 0.71);
        g.bezierCurveTo(cx - rx * 0.99, y + ry * 0.73, cx - rx * 1.03, y + ry * 0.22, cx - rx * 0.88, y - ry * 0.15);
        g.closePath(); g.fill();
      }
    } else if (c.pattern === 'tortie') {
      const orange = c.accent ?? c.stripe ?? c.light;
      // 深底配橙金大斑，中间保留深毛通路；不引入三花的白色底。
      const patches: [number, number, number, number, string][] = part === 'head'
        ? [[27, 73, 34, 55, orange], [107, 129, 24, 53, c.light], [168, 61, 34, 40, c.light], [224, 153, 30, 57, orange]]
        : [[20, 63, 38, 47, orange], [106, 129, 30, 52, c.light], [195, 92, 45, 40, orange], [237, 215, 34, 42, c.light], [65, 220, 31, 35, orange]];
      for (const [x, y, rx, ry, col] of patches) for (const wrap of [-256, 0, 256]) {
        const cx = x + wrap; g.fillStyle = col;
        g.beginPath(); g.moveTo(cx - rx * 0.72, y - ry * 0.48);
        g.bezierCurveTo(cx - rx * 0.56, y - ry * 1.04, cx + rx * 0.26, y - ry * 1.11, cx + rx * 0.83, y - ry * 0.66);
        g.bezierCurveTo(cx + rx * 0.32, y - ry * 0.20, cx + rx * 1.03, y + ry * 0.03, cx + rx * 0.57, y + ry * 0.36);
        g.bezierCurveTo(cx + rx * 0.78, y + ry * 0.88, cx - rx * 0.08, y + ry * 1.02, cx - rx * 0.54, y + ry * 0.77);
        g.bezierCurveTo(cx - rx * 0.98, y + ry * 0.34, cx - rx * 0.48, y + ry * 0.05, cx - rx * 0.72, y - ry * 0.48);
        g.closePath(); g.fill();
      }
    } else if (c.pattern === 'butterfly') {
      g.fillStyle = c.accent ?? c.stripe ?? c.light;
      if (part === 'head') {
        // 正脸额头左右四瓣毛色，中央留底色缝；没有触角或昆虫躯干。
        for (const side of [-1, 1]) {
          const x = (dx: number) => 64 + side * dx;
          g.beginPath(); g.moveTo(x(3), 80);
          g.bezierCurveTo(x(8), 57, x(24), 39, x(37), 48);
          g.bezierCurveTo(x(52), 63, x(37), 87, x(18), 91);
          g.bezierCurveTo(x(10), 92, x(6), 86, x(3), 80); g.closePath(); g.fill();
          g.beginPath(); g.moveTo(x(4), 88);
          g.bezierCurveTo(x(19), 83, x(31), 88, x(29), 101);
          g.bezierCurveTo(x(28), 113, x(13), 122, x(10), 111);
          g.bezierCurveTo(x(7), 104, x(6), 96, x(4), 88); g.closePath(); g.fill();
        }
      } else {
        // 尾球沿 z 轴串接，每球只能复用这张双色鞍斑，不能定位某一节。
        for (const centre of [64, 192]) for (const side of [-1, 1]) {
          g.beginPath(); g.ellipse(centre + side * 29, 119, 27, 59, side * 0.25, 0, Math.PI * 2); g.fill();
        }
      }
    }
    out = new THREE.CanvasTexture(cv);
    out.colorSpace = THREE.SRGBColorSpace;
  }
  cache.set(key, out);
  return out;
}
