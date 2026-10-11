// 绘制工具箱：把“几何拼接”变成“有体积的手绘质感”。
// - 渐变填充（亮部→固有色→暗部）与可选的赛璐璐硬阴影
// - 由中心线 + 宽度生成的有机锥形肢体 / 尾巴
// - Catmull-Rom 平滑曲线
import { ink, shade, tint } from './color';

export type Pt = [number, number];

// ---------- 渐变注册表（每次构建一只猫前清空，输出时附到每个部件的 <defs>） ----------
const gradDefs = new Map<string, string>();
export function resetPaintDefs() {
  gradDefs.clear();
}
export function paintDefs(): string {
  return [...gradDefs.values()].join('');
}

export type Fill = string; // '#rrggbb'

/** 返回渐变 id（并登记定义）。cel=true 时用硬阴影分界。 */
export function gradId(color: string, mode: 'soft' | 'cel' | 'metal' | 'cloth' = 'soft'): string {
  const id = `g${mode[0]}${color.replace('#', '')}`;
  if (!gradDefs.has(id)) {
    let stops: [number, string][];
    if (mode === 'cel') stops = [[0, tint(color, 0.14)], [0.46, color], [0.54, shade(color, 0.12)], [1, shade(color, 0.2)]];
    else if (mode === 'metal') stops = [[0, tint(color, 0.3)], [0.22, tint(color, 0.08)], [0.5, color], [0.52, shade(color, 0.14)], [0.8, shade(color, 0.08)], [1, tint(color, 0.12)]];
    else if (mode === 'cloth') stops = [[0, tint(color, 0.1)], [0.55, color], [1, shade(color, 0.16)]];
    else stops = [[0, tint(color, 0.16)], [0.42, color], [0.78, shade(color, 0.1)], [1, shade(color, 0.2)]];
    const dir = mode === 'metal' ? 'x1="0" y1="0" x2="1" y2="1"' : 'x1="0.1" y1="0" x2="0.9" y2="1"';
    gradDefs.set(id, `<linearGradient id="${id}" ${dir}>${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`);
  }
  return id;
}
export const paintFill = (color: string, mode: 'soft' | 'cel' | 'metal' | 'cloth' = 'soft') => `url(#${gradId(color, mode)})`;

// ---------- 曲线 ----------
/** Catmull-Rom → cubic Bezier 路径 */
export function smooth(pts: Pt[], closed = false, t = 0.5): string {
  const n = pts.length;
  if (n < 2) return '';
  const p = (i: number): Pt => (closed ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = p(i - 1), p1 = p(i), p2 = p(i + 1), p3 = p(i + 2);
    const c1: Pt = [p1[0] + ((p2[0] - p0[0]) * t) / 3, p1[1] + ((p2[1] - p0[1]) * t) / 3];
    const c2: Pt = [p2[0] - ((p3[0] - p1[0]) * t) / 3, p2[1] - ((p3[1] - p1[1]) * t) / 3];
    d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d + (closed ? ' Z' : '');
}

/** 沿 Catmull-Rom 曲线均匀取样 */
export function sampleSpline(pts: Pt[], per = 8): Pt[] {
  const out: Pt[] = [];
  const n = pts.length;
  const p = (i: number): Pt => pts[Math.max(0, Math.min(n - 1, i))];
  for (let i = 0; i < n - 1; i++) {
    const p0 = p(i - 1), p1 = p(i), p2 = p(i + 1), p3 = p(i + 2);
    for (let k = 0; k < per; k++) {
      const u = k / per;
      const u2 = u * u, u3 = u2 * u;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(p(n - 1));
  return out;
}

/** 由中心线与逐点宽度生成锥形肢体轮廓（含圆头），返回闭合平滑路径 */
export function limbPath(center: Pt[], widths: number[], opts: { capStart?: boolean; capEnd?: boolean } = {}): string {
  const per = 6;
  const samples = sampleSpline(center, per);
  const wAt = (idx: number) => {
    const f = (idx / (samples.length - 1)) * (widths.length - 1);
    const i = Math.min(widths.length - 2, Math.floor(f));
    const u = f - i;
    const s = u * u * (3 - 2 * u);
    return widths[i] * (1 - s) + widths[i + 1] * s;
  };
  const L: Pt[] = [], R: Pt[] = [];
  for (let i = 0; i < samples.length; i++) {
    const a = samples[Math.max(0, i - 1)], b = samples[Math.min(samples.length - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const m = Math.hypot(tx, ty) || 1;
    tx /= m; ty /= m;
    const w = wAt(i) / 2;
    L.push([samples[i][0] - ty * w, samples[i][1] + tx * w]);
    R.push([samples[i][0] + ty * w, samples[i][1] - tx * w]);
  }
  const cap = (c: Pt, nlx: number, nly: number, dx: number, dy: number, w: number): Pt[] => {
    const out: Pt[] = [];
    for (let k = 1; k < 4; k++) {
      const a = (k / 4) * Math.PI;
      out.push([c[0] + w * (nlx * Math.cos(a) + dx * Math.sin(a)), c[1] + w * (nly * Math.cos(a) + dy * Math.sin(a))]);
    }
    return out;
  };
  const n = samples.length;
  const norm = (a: Pt, b: Pt): [number, number] => {
    const x = b[0] - a[0], y = b[1] - a[1];
    const m = Math.hypot(x, y) || 1;
    return [x / m, y / m];
  };
  const [ex, ey] = norm(samples[n - 2], samples[n - 1]);
  const [fx, fy] = norm(samples[0], samples[1]);
  const pts: Pt[] = [...L];
  if (opts.capEnd !== false) pts.push(...cap(samples[n - 1], -ey, ex, ex, ey, wAt(n - 1) / 2));
  pts.push(...R.slice().reverse());
  if (opts.capStart !== false) pts.push(...cap(samples[0], fy, -fx, -fx, -fy, wAt(0) / 2));
  return smooth(pts, true, 0.5);
}

/** 伪随机 */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 毛发笔触：在矩形范围内撒一批短弧线，沿 flow 方向（弧度）排布，裁剪到形状内使用 */
export function furTicks(x0: number, y0: number, x1: number, y1: number, n: number, color: string, flow: number, seed: number, len = 11, op = 0.35, sw = 1.6): string {
  const r = rng(seed);
  let d = '';
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * (x1 - x0);
    const y = y0 + r() * (y1 - y0);
    const a = flow + (r() - 0.5) * 0.9;
    const l = len * (0.6 + r() * 0.8);
    const cx = x + Math.cos(a) * l * 0.5 - Math.sin(a) * l * 0.22;
    const cy = y + Math.sin(a) * l * 0.5 + Math.cos(a) * l * 0.22;
    d += `M ${x.toFixed(1)} ${y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${(x + Math.cos(a) * l).toFixed(1)} ${(y + Math.sin(a) * l).toFixed(1)} `;
  }
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" opacity="${op}"/>`;
}

export { ink, shade, tint };
