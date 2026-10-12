// 缓存 256² 程序化毛色：head 贴颅骨，body 贴小腿和部分尾球。
// 耳、爪、绒毛和非环尾的末段由 cat3d 的纯色材质决定，不在本图覆盖范围内。
import * as THREE from 'three';
import type { CatLook } from '../art/types';

type Coat = CatLook['coat'];
const SIZE = 256;
const cache = new Map<string, THREE.CanvasTexture | null>();

/** 球面 u=0/1 在同一条经线上；跨边的斑块也要在另一边继续。 */
function wrap(g: CanvasRenderingContext2D, paint: () => void): void {
  for (const x of [-SIZE, 0, SIZE]) {
    g.save(); g.translate(x, 0); paint(); g.restore();
  }
}

function tabby(g: CanvasRenderingContext2D, c: Coat, head: boolean): void {
  const stripe = c.stripe ?? '#00000040';
  if (!head) {
    // 尾球长轴是 z，不是球面 UV 的 v。以 z=sin(2πu)sin(πv)
    // 的等值线围出一圈，避免把水平纬线误当成尾环。共用此图的小腿侧面也有弧纹。
    const cap = (cut: number) => {
      const a = Math.asin(cut), start = Math.PI + a, end = 2 * Math.PI - a;
      for (const lower of [false, true]) for (let i = 0; i <= 96; i++) {
        const f = (lower ? 96 - i : i) / 96;
        const phi = start + (end - start) * f;
        const y = Math.asin(Math.min(1, cut / -Math.sin(phi))) * SIZE / Math.PI;
        const x = phi * SIZE / (2 * Math.PI), v = lower ? SIZE - y : y;
        if (!lower && i === 0) g.moveTo(x, v); else g.lineTo(x, v);
      }
      g.closePath();
    };
    g.fillStyle = stripe; g.beginPath(); cap(0.18); cap(0.6); g.fill('evenodd');
    return;
  }

  // 浅色下颌接上独立的口鼻球；极点保持单色，避免扇状 UV 色块。
  g.fillStyle = c.light; g.fillRect(0, 226, SIZE, 30);
  wrap(g, () => {
    g.beginPath(); g.moveTo(-28, 256); g.lineTo(-28, 212);
    g.bezierCurveTo(-20, 192, 9, 188, 20, 176);
    g.bezierCurveTo(33, 159, 43, 156, 64, 156);
    g.bezierCurveTo(85, 156, 99, 159, 108, 176);
    g.bezierCurveTo(119, 189, 145, 192, 156, 212);
    g.lineTo(156, 256); g.closePath(); g.fill();
  });
  // 正脸 u≈.25（x=64）：连贯的 M 纹，末端停在眼睛上方。
  g.strokeStyle = stripe; g.lineWidth = 8; g.lineCap = g.lineJoin = 'round';
  g.beginPath(); g.moveTo(42, 105);
  g.bezierCurveTo(41, 88, 46, 69, 48, 63);
  g.bezierCurveTo(53, 72, 58, 80, 64, 90);
  g.bezierCurveTo(70, 80, 75, 72, 80, 63);
  g.bezierCurveTo(83, 73, 87, 89, 86, 105); g.stroke();
  g.lineWidth = 6; g.beginPath(); g.moveTo(64, 36);
  g.bezierCurveTo(62, 48, 66, 57, 64, 68); g.stroke();
  g.fillStyle = stripe;
  wrap(g, () => {
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      const y = 134 + i * 19, reach = 54 + i * 4;
      g.beginPath(); g.moveTo(64 + s * (27 + i * 3), y + 7);
      g.bezierCurveTo(64 + s * 37, y + 3, 64 + s * reach, y - 8, 64 + s * (reach + 8), y - 9);
      g.bezierCurveTo(64 + s * reach, y + 1, 64 + s * 37, y + 12, 64 + s * (27 + i * 3), y + 7);
      g.fill();
    }
  });
  // 后脑保留三道短纹，背向时仍能辨认虎斑。
  g.lineWidth = 9;
  for (const x of [166, 192, 218]) {
    g.beginPath(); g.moveTo(x, x === 192 ? 44 : 69);
    g.bezierCurveTo(x - 4, 91, x + 4, 107, x, 126); g.stroke();
  }
}

function tuxedo(g: CanvasRenderingContext2D, c: Coat, head: boolean): void {
  g.fillStyle = c.light;
  // 白鼻梁 / 下颌在 head 的 x64；小腿前面却在 body 的 u0/1 接边。
  // 白胸绒领、白爪和尾尖是引擎已有纯色，本图只延续裸露毛面的白区。
  g.fillRect(0, head ? 220 : 246, SIZE, head ? 36 : 10);
  wrap(g, () => {
    g.beginPath();
    if (head) {
      g.moveTo(64, 86);
      g.bezierCurveTo(68, 101, 74, 113, 83, 126);
      g.bezierCurveTo(96, 145, 115, 153, 126, 184);
      g.bezierCurveTo(143, 220, 150, 241, 159, 256);
      g.lineTo(-31, 256);
      g.bezierCurveTo(-24, 225, -15, 196, 8, 170);
      g.bezierCurveTo(24, 150, 33, 140, 43, 124);
      g.bezierCurveTo(53, 109, 59, 101, 64, 86);
    } else {
      g.moveTo(0, 152);
      g.bezierCurveTo(8, 164, 12, 176, 23, 192);
      g.bezierCurveTo(32, 211, 35, 234, 42, 256);
      g.lineTo(-42, 256);
      g.bezierCurveTo(-35, 234, -32, 211, -23, 192);
      g.bezierCurveTo(-12, 176, -8, 164, 0, 152);
    }
    g.closePath(); g.fill();
  });
}

function calico(g: CanvasRenderingContext2D, c: Coat, head: boolean): void {
  g.fillStyle = c.light; g.fillRect(0, 0, SIZE, SIZE);
  if (head) {
    // 白底、左橘额、右深色眼罩；用 coat 的三种颜色，避免五个同色圆点。
    // 顶端的橘色帽连上纯色耳根，底端保持浅色下颌。
    g.fillStyle = c.base; g.fillRect(0, 0, SIZE, 22);
    wrap(g, () => {
      g.beginPath(); g.moveTo(-64, 18); g.lineTo(64, 18);
      g.bezierCurveTo(60, 50, 47, 65, 48, 91);
      g.bezierCurveTo(49, 126, 39, 144, 13, 150);
      g.bezierCurveTo(-12, 162, -26, 174, -40, 187);
      g.bezierCurveTo(-71, 164, -83, 108, -64, 18); g.closePath(); g.fill();
    });
    g.fillStyle = c.accent ?? c.base;
    g.beginPath(); g.moveTo(84, 42);
    g.bezierCurveTo(105, 38, 121, 51, 132, 72);
    g.bezierCurveTo(144, 94, 153, 106, 149, 131);
    g.bezierCurveTo(143, 148, 125, 143, 118, 163);
    g.bezierCurveTo(112, 177, 99, 178, 91, 159);
    g.bezierCurveTo(83, 147, 77, 138, 81, 117);
    g.bezierCurveTo(87, 94, 76, 72, 84, 42); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(180, 142);
    g.bezierCurveTo(204, 134, 226, 150, 231, 173);
    g.bezierCurveTo(238, 198, 220, 220, 202, 213);
    g.bezierCurveTo(175, 203, 158, 171, 180, 142); g.closePath(); g.fill();
  } else {
    g.fillStyle = c.base;
    wrap(g, () => {
      g.beginPath(); g.moveTo(-36, 48);
      g.bezierCurveTo(-1, 35, 37, 43, 52, 81);
      g.bezierCurveTo(71, 121, 65, 151, 32, 168);
      g.bezierCurveTo(16, 178, 10, 201, -13, 205);
      g.bezierCurveTo(-41, 207, -60, 153, -53, 123);
      g.bezierCurveTo(-49, 97, -49, 65, -36, 48); g.closePath(); g.fill();
    });
    g.fillStyle = c.accent ?? c.base;
    g.beginPath(); g.moveTo(151, 76);
    g.bezierCurveTo(184, 63, 207, 84, 219, 108);
    g.bezierCurveTo(232, 134, 218, 151, 207, 173);
    g.bezierCurveTo(197, 195, 161, 198, 152, 176);
    g.bezierCurveTo(143, 158, 153, 142, 137, 122);
    g.bezierCurveTo(126, 106, 132, 85, 151, 76); g.closePath(); g.fill();
  }
}

/** head：颅骨球（脸 u≈.25）；body：小腿 capsule / 贴图尾球。 */
export function coatTexture(look: CatLook, part: 'head' | 'body' = 'body'): THREE.CanvasTexture | null {
  const c = look.coat;
  const key = `${part}|${c.pattern}|${c.base}|${c.light}|${c.accent ?? ''}|${c.stripe ?? ''}`;
  if (cache.has(key)) return cache.get(key)!;
  let out: THREE.CanvasTexture | null = null;
  if (typeof document !== 'undefined' && c.pattern !== 'solid' && c.pattern !== 'shaded') {
    const cv = document.createElement('canvas');
    cv.width = cv.height = SIZE;
    const g = cv.getContext('2d')!;
    g.fillStyle = c.base; g.fillRect(0, 0, SIZE, SIZE);
    if (c.pattern === 'tabby') tabby(g, c, part === 'head');
    else if (c.pattern === 'tuxedo') tuxedo(g, c, part === 'head');
    else if (c.pattern === 'calico') calico(g, c, part === 'head');
    else if (c.pattern === 'tortie' || c.pattern === 'cow' || c.pattern === 'spots' || c.pattern === 'butterfly') {
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
