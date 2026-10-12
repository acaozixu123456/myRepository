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
    } else if (c.pattern === 'tortie' || c.pattern === 'cow' || c.pattern === 'spots' || c.pattern === 'butterfly') {
      const col = c.accent ?? c.light;
      g.fillStyle = col;
      const blobs: [number, number, number][] = [[70, 90, 40], [190, 70, 34], [120, 190, 46], [220, 200, 30], [40, 200, 28]];
      for (const [x, y, r] of blobs) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
    } else if (c.pattern === 'point') {
      g.fillStyle = c.light; g.fillRect(0, 0, 256, 256);
      g.fillStyle = c.accent ?? c.base; g.beginPath(); g.ellipse(128, 150, 60, 50, 0, 0, 7); g.fill();
    }
    out = new THREE.CanvasTexture(cv);
    out.colorSpace = THREE.SRGBColorSpace;
  }
  cache.set(key, out);
  return out;
}
