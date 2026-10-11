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
