// 衣服：挂在 torso（髋部原点）。肩在 (±0.52, 1.0, 0)，脖子根 (0, 1.3, 0)。
// 底版：一件车削出来的长袍（袍 / 裙 / 铠 / 兽皮 都用同一个造型，颜色与配件不同）。
import * as THREE from 'three';
import { solid, sphere, toon } from '../toon';
import type { PartBuilder, PartCtx } from './types';

/** 车削袍身：y 从下摆(≈-0.36)到领口(≈1.32)。下摆（腰以下）挂在 hip 上，不会跟着上身前倾翻起来：放进 userData.skirt，由 cat3d 挪到 hip。 */
function robe(c: PartCtx, o: { hem: number; waist: number; chest: number; col?: string; trimCol?: string; collar?: boolean; front?: boolean; sash?: boolean }): THREE.Group {
  const g = new THREE.Group();
  const skirt = new THREE.Group();
  const col = o.col ?? c.pal.main;
  const b = c.look.build ?? 1;
  const P = ([[o.hem, -0.36], [o.hem * 0.92, 0.05], [o.waist * 0.92, 0.42], [o.chest, 0.85], [0.42, 1.18], [0.24, 1.32]] as [number, number][]).map(([r, y]) => new THREE.Vector2(r * b, y));
  const mat = toon(col, { double: true });
  skirt.add(solid(new THREE.LatheGeometry(P.slice(0, 3), 28), mat, 0.024));
  g.add(solid(new THREE.LatheGeometry(P.slice(2), 28), mat, 0.024));
  // 下摆封底：腿分开 / 低头时不会看到袍子里面
  const cap = new THREE.Mesh(new THREE.CircleGeometry(o.hem * b * 0.98, 24), toon('#2a2230', { double: true }));
  cap.rotation.x = Math.PI / 2; cap.position.y = -0.3;
  skirt.add(cap);
  const hemRing = solid(new THREE.TorusGeometry(o.hem * b * 0.99, 0.035, 6, 28), toon(o.trimCol ?? c.pal.trim), 0.01);
  hemRing.rotation.x = Math.PI / 2; hemRing.position.y = -0.34;
  skirt.add(hemRing);
  if (o.collar !== false) {
    const col2 = solid(new THREE.TorusGeometry(0.3, 0.05, 6, 20), toon(c.pal.trim), 0.01);
    col2.rotation.x = Math.PI / 2; col2.position.y = 1.28;
    g.add(col2);
  }
  if (o.front !== false) { skirt.add(placket(P, c, true)); g.add(placket(P, c, false)); }
  if (o.sash !== false) g.add(sash(c, o.waist * b));
  g.userData.skirt = skirt;
  g.userData.profile = P;
  return g;
}


/** 袍身半径随高度的插值（贴身的前襟 / 甲片要沿着袍面走） */
function radiusAt(P: THREE.Vector2[], y: number): number {
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[i], b = P[i + 1];
    if (y >= Math.min(a.y, b.y) && y <= Math.max(a.y, b.y)) { const t = (y - a.y) / (b.y - a.y || 1); return a.x + (b.x - a.x) * t; }
  }
  return P[P.length - 1].x;
}
/** 贴在袍面前方的一条弧形布片：y0..y1，半角 half（弧度），离袍面 off。flare：下摆随高度略外扩 */
function panel(P: THREE.Vector2[], y0: number, y1: number, half: number, off: number, col: string, outline = 0.01): THREE.Mesh {
  const nu = 8, nv = 10;
  const pos: number[] = [], idx: number[] = [];
  for (let j = 0; j <= nv; j++) {
    const y = y0 + (y1 - y0) * (j / nv), R = radiusAt(P, y) + off;
    for (let i = 0; i <= nu; i++) { const a = (i / nu - 0.5) * 2 * half; pos.push(Math.sin(a) * R, y, Math.cos(a) * R); }
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i; idx.push(a, a + 1, a + nu + 1, a + 1, a + nu + 2, a + nu + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return solid(g, toon(col, { double: true }), outline);
}
/** 前襟：正中一条窄的亮边门襟 + 两颗扣子（比整块前襟干净，缩小后也读得出） */
function placket(P: THREE.Vector2[], c: PartCtx, lower: boolean): THREE.Group {
  const g = new THREE.Group();
  const [y0, y1] = lower ? [-0.33, 0.4] : [0.44, 1.2];
  g.add(panel(P, y0, y1, 0.07, 0.014, c.pal.trim, 0));
  if (!lower) for (const y of [0.62, 0.84, 1.04]) { const b = solid(sphere(0.04), toon(c.pal.main), 0); b.position.set(0, y, radiusAt(P, y) + 0.03); g.add(b); }
  return g;
}
/** 腰封：粗腰带 + 侧后方的结与两条飘带 */
function sash(c: PartCtx, r: number, y = 0.46): THREE.Group {
  const g = new THREE.Group();
  const band = solid(new THREE.CylinderGeometry(r * 1.03, r * 1.06, 0.2, 28, 1, true), toon(c.pal.sub, { double: true }), 0.014);
  band.position.y = y; g.add(band);
  for (const dy of [0.1, -0.1]) { const e = solid(new THREE.TorusGeometry(r * 1.045, 0.022, 5, 28), toon(c.pal.trim), 0); e.rotation.x = Math.PI / 2; e.position.y = y + dy; g.add(e); }
  const knot = solid(sphere(0.1, 1.2, 1, 0.9, 12), toon(c.pal.sub), 0.012); knot.position.set(r * 0.55, y, -r * 0.98); g.add(knot);
  for (const s of [1, -1]) { const t = solid(new THREE.BoxGeometry(0.1, 0.5, 0.025), toon(c.pal.sub), 0.01); t.position.set(r * 0.55 + s * 0.09, y - 0.28, -r * 1.0); t.rotation.z = s * 0.22; g.add(t); const tt = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.03), toon(c.pal.trim)); tt.position.set(r * 0.55 + s * 0.09 + s * 0.055, y - 0.51, -r * 1.0); tt.rotation.z = s * 0.22; g.add(tt); }
  return g;
}
/** 披肩（文士 / 道袍 / 华服）：脖子根一圈柔软的肩领，盖住肩线 */
function mantle(c: PartCtx, col: string): THREE.Group {
  const g = new THREE.Group();
  const m = solid(new THREE.SphereGeometry(0.62, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2.1), toon(col, { double: true }), 0.016);
  m.scale.set(0.78, 0.5, 0.74); m.position.y = 1.02; g.add(m);
  const rim = solid(new THREE.TorusGeometry(0.62, 0.03, 6, 28), toon(c.pal.trim), 0.006);
  rim.rotation.x = Math.PI / 2; rim.scale.set(0.78, 0.74, 1); rim.position.y = 1.02 + 0.0; g.add(rim);
  return g;
}
/** 层叠肩甲：三片鳞状弧片 + 铆钉，big 时再加一圈尖刺 */
function pauldrons(c: PartCtx, col: string, big = false): THREE.Group {
  const g = new THREE.Group();
  for (const s of [1, -1]) {
    const grp = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const r = (0.27 - i * 0.04) * (big ? 1.2 : 1);
      const shell = solid(new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(i === 1 ? c.pal.trim : col, { double: true }), 0.014);
      shell.scale.set(1.0, 0.8, 1.1); shell.position.y = -i * 0.1; shell.rotation.z = 0; grp.add(shell);
    }
    const stud = solid(sphere(0.045), toon(c.pal.trim), 0.006); stud.position.set(0, 0.2 * (big ? 1.2 : 1), 0); grp.add(stud);
    if (big) for (let k = 0; k < 3; k++) { const sp = solid(new THREE.ConeGeometry(0.045, 0.16, 5), toon(c.pal.trim), 0.006); const a = (k - 1) * 0.55; sp.position.set(Math.sin(a) * 0.26, 0.2 - Math.abs(k - 1) * 0.05, Math.cos(a) * 0.12); sp.rotation.z = -a * 0.8; grp.add(sp); }
    grp.position.set(s * 0.56, 1.1, 0); grp.rotation.z = -s * 0.42;
    g.add(grp);
  }
  return g;
}
/** 胸甲：略鼓的前胸护板 + 中脊 + 铆钉；hex：金属色 */
function chestPlate(c: PartCtx, col: string, emblem = true): THREE.Group {
  const g = new THREE.Group();
  const plate = solid(sphere(0.43, 1.0, 1.02, 0.52, 20), toon(col), 0.016);
  plate.position.set(0, 0.84, 0.17); g.add(plate);
  const ridge = solid(new THREE.BoxGeometry(0.05, 0.62, 0.05), toon(c.pal.trim), 0.006); ridge.position.set(0, 0.84, 0.43); g.add(ridge);
  for (const dy of [0.62, 0.84, 1.04]) for (const s of [1, -1]) { const st = solid(sphere(0.035), toon(c.pal.trim), 0); st.position.set(s * 0.22, dy, 0.38); g.add(st); }
  if (emblem) { const e = solid(new THREE.CylinderGeometry(0.1, 0.1, 0.035, 14), toon(c.pal.trim), 0.006); e.rotation.x = Math.PI / 2; e.position.set(0, 0.86, 0.455); g.add(e); const e2 = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.04, 12), toon(c.pal.main)); e2.rotation.x = Math.PI / 2; e2.position.set(0, 0.86, 0.46); g.add(e2); }
  return g;
}
/** 腰甲：绕髋一圈圆角甲片（挂在 skirt 里，不随上身前倾） */
function tassets(c: PartCtx, col: string, r: number, n = 7): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.PI / n;
    const t = solid(sphere(0.2, 0.62, 1, 0.22, 10), toon(i % 2 ? col : c.pal.trim), 0.012);
    t.position.set(Math.sin(a) * r, 0.2, Math.cos(a) * r);
    t.rotation.y = a; t.rotation.x = -0.16;
    g.add(t);
  }
  return g;
}

export const BODY: Record<string, PartBuilder> = {
  robeScholar: (c) => { const g = robe(c, { hem: 0.62, waist: 0.4, chest: 0.5 }); g.add(mantle(c, c.pal.cloth ?? c.pal.sub)); return g; },
  robeTaoist: (c) => { const g = robe(c, { hem: 0.68, waist: 0.42, chest: 0.5 }); g.add(mantle(c, c.pal.cloth ?? c.pal.sub)); return g; },
  robeSilk: (c) => { const g = robe(c, { hem: 0.72, waist: 0.4, chest: 0.5 }); g.add(mantle(c, c.pal.sub)); return g; },
  dress: (c) => { const g = robe(c, { hem: 0.78, waist: 0.38, chest: 0.48 }); g.add(mantle(c, c.pal.sub)); return g; },
  vest: (c) => robe(c, { hem: 0.5, waist: 0.42, chest: 0.5 }),
  armorWei: (c) => { const g = robe(c, { hem: 0.58, waist: 0.44, chest: 0.54, col: c.pal.main }); g.add(chestPlate(c, c.pal.sub), pauldrons(c, c.pal.main)); (g.userData.skirt as THREE.Group).add(tassets(c, c.pal.sub, 0.55)); return g; },
  armorHeavy: (c) => { const g = robe(c, { hem: 0.6, waist: 0.48, chest: 0.58, col: c.pal.main }); g.add(chestPlate(c, '#667286'), pauldrons(c, '#667286', true)); (g.userData.skirt as THREE.Group).add(tassets(c, '#667286', 0.6)); return g; },
  armorLight: (c) => { const g = robe(c, { hem: 0.55, waist: 0.42, chest: 0.5 }); g.add(chestPlate(c, c.pal.sub, false), pauldrons(c, c.pal.sub)); (g.userData.skirt as THREE.Group).add(tassets(c, c.pal.sub, 0.5, 6)); return g; },
  tribal: (c) => { const g = robe(c, { hem: 0.5, waist: 0.4, chest: 0.4, col: '#b88a54', trimCol: '#efe6d2', collar: false, front: false }); g.add(mantle(c, '#efe6d2')); return g; },
  rattan: (c) => { const g = robe(c, { hem: 0.56, waist: 0.44, chest: 0.52, col: '#b08a54' }); g.add(chestPlate(c, '#8a6a3a', false), pauldrons(c, '#8a6a3a')); return g; },
};
