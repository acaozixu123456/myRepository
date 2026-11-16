// 俯视检查图：高度着色 + 山体阴影，路和溪叠上去
import { buildLand, DOM, waterY, farH } from '../src/world/land.js';
import { ROAD, STREAM, SPOTS, SEA, LIGHTHOUSE } from '../src/world/route.js';
import { writeFileSync } from 'node:fs';
const L = buildLand();
console.log('land ms', L.ms.toFixed(0), 'bridge', L.bridge, 'spots', JSON.stringify(SPOTS));
console.log('road length', ROAD.length.toFixed(1), 'prof samples', [0, 50, 100, 118, 150, 200, 250, 280].map(s => s + ':' + L.roadY(s).toFixed(2)).join(' '));
let mn = 1e9, mx = -1e9; for (const h of L.H) { mn = Math.min(mn, h); mx = Math.max(mx, h); } console.log('H range', mn.toFixed(1), mx.toFixed(1));
const far = process.argv[2] === 'far';
const W = 720, Hh = far ? 720 : 864;
const ext = far ? { x0: -2600, z0: -2700, w: 5200, d: 5200 } : { x0: DOM.x0, z0: DOM.z0, w: DOM.w, d: DOM.d };
const img = Buffer.alloc(W * Hh * 3);
const hAt = (x, z) => L.height(x, z);
for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
  const x = ext.x0 + (i + 0.5) / W * ext.w, z = ext.z0 + (j + 0.5) / Hh * ext.d;
  const h = hAt(x, z), e = ext.w / W;
  const hx = hAt(x + e, z) - hAt(x - e, z), hz = hAt(x, z + e) - hAt(x, z - e);
  const n = [-hx, 2 * e, -hz]; const l = Math.hypot(...n); const sd = [-0.55, 0.3, -0.78];
  let sh = Math.max(0, (n[0] * sd[0] + n[1] * sd[1] + n[2] * sd[2]) / l) * 0.8 + 0.25;
  let c = h < 2 ? [110, 160, 70] : h < 12 ? [140, 170, 80] : h < 40 ? [120, 140, 90] : h < 300 ? [140, 130, 120] : [240, 240, 250];
  const rd = L.roadDist(x, z), sdist = L.streamDist(x, z);
  if (!far && rd < 1.5) c = [200, 170, 120];
  if (!far && L.inside(x, z)) { const q = STREAM.nearest(x, z, 8); if (q.dist < 8 && h < waterY(q.s)) c = [60, 120, 200]; }
  if (L.inside(x, z) && L.sand(x, z) > 0.4) c = [225, 205, 150];
  if (L.inside(x, z) && L.bamboo(x, z) > 0.4) c = [120, 190, 60];
  if (!far && L.inside(x, z) && L.trD && L.sample(L.trD, x, z) < 1.2) c = [230, 140, 80];
  if (h < SEA.y) { const dd = Math.min(1, (SEA.y - h) / 10); c = [70 - 40 * dd, 150 - 60 * dd, 200 - 40 * dd]; }
  if (Math.hypot(x - LIGHTHOUSE.x, z - LIGHTHOUSE.z) < (far ? 20 : 3)) c = [255, 255, 255];
  // 等高线
  const band = Math.abs((h / (far ? 25 : 2)) % 1) < (far ? 0.03 : 0.04) ? 0.75 : 1;
  for (let k = 0; k < 3; k++) img[(j * W + i) * 3 + k] = Math.min(255, c[k] * sh * band);
}
for (const [k, s] of Object.entries(SPOTS)) { for (const sv of [].concat(s)) { const p = ROAD.at(sv); const i = Math.round((p.x - ext.x0) / ext.w * W), j = Math.round((p.z - ext.z0) / ext.d * Hh); for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) { const o = ((j + b) * W + (i + a)) * 3; if (o >= 0 && o < img.length) { img[o] = 255; img[o + 1] = 40; img[o + 2] = 40; } } } }
const out = process.argv[3] || '/tmp/land.ppm';
writeFileSync(out, Buffer.concat([Buffer.from(`P6 ${W} ${Hh} 255\n`), img]));
