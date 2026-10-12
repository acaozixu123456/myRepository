// 奖励的图形化显示：图标 + 数字，不写字。小鱼干 / 经验 / 猫薄荷 / 金铃铛。
import { icon } from './icons';

export interface GainLike { fish?: number; exp?: number; catnip?: number; bells?: number }
const fmt = (n: number) => (n >= 10000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : String(Math.round(n * 10) / 10));

/** 一行奖励：每项 = 图标 + 数字；0 的不显示。size 是图标大小。 */
export function gainIcons(g: GainLike, size = 18): string {
  const parts: [string, number | undefined][] = [['fish', g.fish], ['spark', g.exp], ['catnip', g.catnip], ['bells', g.bells]];
  const html = parts.filter(([, n]) => n).map(([k, n]) => `<span class="gi">${icon(k, size)}<b>${fmt(n!)}</b></span>`).join('');
  return html ? `<span class="gains">${html}</span>` : '';
}
export const GAIN_CSS = `.gains{display:inline-flex;flex-wrap:wrap;gap:4px 12px;justify-content:center;align-items:center}.gi{display:inline-flex;align-items:center;gap:3px;font-weight:900}`;

/** 星星：满 n 颗、共 total 颗（用已有的 star / starOff 图标） */
export function starsHtml(n: number, total = 3, size = 26): string {
  return `<span class="gains stars-row" style="gap:4px">${Array.from({ length: total }, (_, i) => icon(i < n ? 'star' : 'starOff', size)).join('')}</span>`;
}
