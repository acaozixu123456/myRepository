// 区域：红叶谷（溪的上游两岸，秋天的颜色）和雪线（西北冰湖周围的高处有雪）。
// 都是 0~1 的权重，近景地面按格子算一次存起来，远景、植被、粒子都用同一套。
import { LAKE, CREEK_END } from './route.js';
import { fbm, vnoise, sstep } from './noise.js';

// 红叶：沿着溪的路程 s 和离溪的距离 d 决定（谷底到两边山坡），太高了就让给雪
export function autumnK(x, z, h, s, d) {
  if (!(d < 100)) return 0;
  const band = sstep(CREEK_END - 140, CREEK_END - 20, s) * sstep(CREEK_END + 305, CREEK_END + 205, s);
  if (band <= 0) return 0;
  const n = fbm(x * 0.018 + 13, z * 0.018 - 7, 3);
  return Math.min(1, band * sstep(98, 62, d) * sstep(60, 42, h) * (0.7 + 0.6 * n));
}

// 雪：离冰湖越近，雪线越低；雪线有起伏
export function snowLine(x, z) {
  const dl = Math.hypot(x - LAKE.x, z - LAKE.z);
  if (dl > 620) return 1e4;
  return 34 + 0.16 * dl + 12 * (fbm(x * 0.012 + 3.7, z * 0.012 - 1.3, 3) - 0.5) + 30 * sstep(420, 620, dl);
}
export function snowK(x, z, h) {
  const L = snowLine(x, z);
  if (L > 9e3) return 0;
  return sstep(L - 4, L + 6, h + 3 * (vnoise(x * 0.07, z * 0.07) - 0.5));
}

// 秋叶的几种颜色：直接乘在绿叶子的贴图上（贴图是纯绿色，线性值大约 0.095, 0.195, 0）
// 红、橙红、橙、金黄、还带点绿的黄
export const AUTUMN_TINTS = [[5.0, 0.2, 1], [5.6, 0.42, 1], [6.0, 0.8, 1], [6.4, 1.75, 1], [4.2, 2.0, 1]];
export function autumnTint(R) {
  const u = R();
  return AUTUMN_TINTS[u < 0.17 ? 0 : u < 0.38 ? 1 : u < 0.63 ? 2 : u < 0.89 ? 3 : 4];
}
