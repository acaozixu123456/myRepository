// 颜色工具：所有美术配色都由少量基础色派生，保证整体色调统一。

export interface HSL { h: number; s: number; l: number }

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function hexToHsl(hex: string): HSL {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h, s, l };
}

export function hslToHex({ h, s, l }: HSL): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

/** 变暗：同时让色相略向冷色偏移、饱和度略升，避免“灰脏”，是厚涂风格的关键 */
export function shade(hex: string, amt = 0.2): string {
  const c = hexToHsl(hex);
  const towardsCool = c.h > 200 && c.h < 280 ? 0 : 6;
  return hslToHex({ h: c.h + (c.h > 40 && c.h < 200 ? -towardsCool : towardsCool) * (amt * 2), s: c.s + amt * 0.25, l: c.l - amt });
}

/** 提亮：略向暖色偏移 */
export function tint(hex: string, amt = 0.15): string {
  const c = hexToHsl(hex);
  return hslToHex({ h: c.h + 4 * amt * 4, s: c.s - amt * 0.15, l: c.l + amt });
}

/** 描边色：同色相的深色，而不是纯黑，这是“不AI、不塑料”的重点 */
export function ink(hex: string, depth = 0.34): string {
  const c = hexToHsl(hex);
  return hslToHex({ h: c.h, s: Math.min(1, c.s * 0.9 + 0.08), l: Math.max(0.1, c.l * (1 - depth) - 0.06) });
}
