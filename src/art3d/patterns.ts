// 毛色花纹贴图：按 CatLook.coat.pattern 生成一张小画布贴图（头 / 手 / 腿 / 尾共用）。
// solid / shaded 不需要贴图（返回 null），其余花纹见各分支。花纹细化是 Codex 的任务（docs/CODEX_3D_BRIEF.md）。
import * as THREE from 'three';
import type { CatLook } from '../art/types';

const dy = (dx: number) => (dx === 0 ? 78 : 64);
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
      g.strokeStyle = stripe; g.lineWidth = 7; g.lineCap = 'round';
      // 脸朝 u≈0.25（x≈64）；额头三道竖纹 + 两颊各两道横纹
      for (const dx of [-16, 0, 16]) { g.beginPath(); g.moveTo(64 + dx, 36); g.lineTo(64 + dx * 1.2, dy(dx)); g.stroke(); }
      for (const side of [-1, 1]) for (let i = 0; i < 2; i++) { const x0 = 64 + side * 50, y0 = 118 + i * 12; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + side * 22, y0 + 4); g.stroke(); }
    } else if (c.pattern === 'tabby') {
      g.strokeStyle = stripe; g.lineWidth = 10; g.lineCap = 'round';
      for (let i = 0; i < 7; i++) { const y = 20 + i * 34; g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
    } else if (c.pattern === 'tuxedo') {
      g.fillStyle = c.light; g.beginPath(); g.ellipse(128, 170, 70, 90, 0, 0, 7); g.fill();
    } else if (c.pattern === 'calico') {
      const col = c.accent ?? c.light;
      g.fillStyle = col;
      const blobs: [number, number, number][] = [[70, 90, 40], [190, 70, 34], [120, 190, 46], [220, 200, 30], [40, 200, 28]];
      for (const [x, y, r] of blobs) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
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
