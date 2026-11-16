// 找观景点候选：周围 70 米里高出最多、顶上比较平、离路不太近也不太远的地方
import { buildLand, DOM } from '../src/world/land.js';
const L = buildLand();
const st = 4, out = [];
for (let z = DOM.z0 + 30; z < DOM.z0 + DOM.d - 30; z += st) for (let x = DOM.x0 + 30; x < DOM.x0 + DOM.w - 30; x += st) {
  const h = L.height(x, z);
  if (h < 2) continue;
  let mx = -1e9, s = 0, n = 0;
  for (let a = 0; a < 16; a++) for (const r of [20, 40, 60]) { const hh = L.height(x + Math.cos(a / 16 * 6.283) * r, z + Math.sin(a / 16 * 6.283) * r); mx = Math.max(mx, hh); s += hh; n++; }
  if (mx > h + 4) continue;           // 不是顶
  const prom = h - s / n;
  const sl = Math.max(Math.abs(L.height(x + 3, z) - L.height(x - 3, z)), Math.abs(L.height(x, z + 3) - L.height(x, z - 3))) / 6;
  const rd = L.roadDist(x, z);
  if (sl > 0.45 || rd < 6) continue;
  out.push({ x, z, h: +h.toFixed(1), prom: +prom.toFixed(1), sl: +sl.toFixed(2), rd: +rd.toFixed(0), snow: +L.snow(x, z).toFixed(2) });
}
out.sort((a, b) => b.prom - a.prom);
const pick = [];
for (const o of out) { if (pick.every(p => Math.hypot(p.x - o.x, p.z - o.z) > 60)) pick.push(o); if (pick.length > 30) break; }
for (const p of pick) console.log(JSON.stringify(p));
