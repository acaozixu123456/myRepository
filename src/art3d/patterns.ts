// 毛色花纹贴图：按 CatLook.coat.pattern 生成一张小画布贴图（头 / 手 / 腿 / 尾共用）。
// solid / shaded 不需要贴图（返回 null），其余花纹见各分支。花纹细化是 Codex 的任务（docs/CODEX_3D_BRIEF.md）。
import * as THREE from 'three';
import type { CatLook } from '../art/types';

const cache = new Map<string, THREE.CanvasTexture | null>();

export function coatTexture(look: CatLook): THREE.CanvasTexture | null {
  const c = look.coat;
  const key = `${c.pattern}|${c.base}|${c.light}|${c.accent ?? ''}|${c.stripe ?? ''}`;
  if (cache.has(key)) return cache.get(key)!;
  let out: THREE.CanvasTexture | null = null;
  if (typeof document !== 'undefined' && c.pattern !== 'solid' && c.pattern !== 'shaded') {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const g = cv.getContext('2d')!;
    g.fillStyle = c.base;
    g.fillRect(0, 0, 256, 256);
    const stripe = c.stripe ?? '#00000040';
    if (c.pattern === 'tabby') {
      g.strokeStyle = stripe; g.lineWidth = 9; g.lineCap = 'round';
      // 球面 UV：上部是头顶 / 额头。画几道竖纹 + 额头 M 纹
      for (let i = 0; i < 8; i++) { const x = 20 + i * 30; g.beginPath(); g.moveTo(x, 40); g.lineTo(x + 6, 100); g.stroke(); }
      for (let i = 0; i < 6; i++) { const y = 130 + i * 18; g.beginPath(); g.moveTo(0, y); g.lineTo(256, y + 6); g.stroke(); }
    } else if (c.pattern === 'tuxedo') {
      g.fillStyle = c.light; g.beginPath(); g.ellipse(128, 170, 70, 90, 0, 0, 7); g.fill();
    } else if (c.pattern === 'calico' || c.pattern === 'tortie' || c.pattern === 'cow' || c.pattern === 'spots' || c.pattern === 'butterfly') {
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
