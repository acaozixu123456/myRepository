// 衣服：挂在 torso（髋部原点）。肩在 (±0.52, 1.0, 0)，脖子根 (0, 1.3, 0)。
// 底版：一件车削出来的长袍（袍 / 裙 / 铠 / 兽皮 都用同一个造型，颜色与配件不同）。
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { solid, sphere, toon } from '../toon';
import type { PartBuilder, PartCtx } from './types';
import { scholarRobe, taoistRobe, tribalHide } from './body-robes';

/** 车削袍身：y 从下摆(≈-0.36)到领口(≈1.32)。下摆（腰以下）挂在 hip 上，不会跟着上身前倾翻起来：放进 userData.skirt，由 cat3d 挪到 hip。 */
function robe(c: PartCtx, o: { hem: number; waist: number; chest: number; col?: string; trimCol?: string; collar?: boolean; front?: boolean; sash?: boolean }): THREE.Group {
  const g = new THREE.Group();
  const skirt = new THREE.Group();
  const col = o.col ?? c.pal.main;
  const b = c.look.build ?? 1;
  const P = ([[o.hem, -0.22], [o.hem * 0.92, 0.08], [o.waist * 0.92, 0.42], [o.chest, 0.85], [0.42, 1.18], [0.24, 1.32]] as [number, number][]).map(([r, y]) => new THREE.Vector2(r * b, y));
  const mat = toon(col, { double: true });
  skirt.add(solid(new THREE.LatheGeometry(P.slice(0, 3), 28), mat, 0.024));
  g.add(solid(new THREE.LatheGeometry(P.slice(2), 28), mat, 0.024));
  // 下摆封底：腿分开 / 低头时不会看到袍子里面
  const cap = new THREE.Mesh(new THREE.CircleGeometry(o.hem * b * 0.98, 24), toon('#2a2230', { double: true }));
  cap.rotation.x = Math.PI / 2; cap.position.y = -0.17;
  skirt.add(cap);
  const hemRing = solid(new THREE.TorusGeometry(o.hem * b * 0.99, 0.035, 6, 28), toon(o.trimCol ?? c.pal.trim), 0.01);
  hemRing.rotation.x = Math.PI / 2; hemRing.position.y = -0.2;
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
  const [y0, y1] = lower ? [-0.2, 0.4] : [0.44, 1.2];
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

type RegaliaProfile = [number, number][];

/** 这批服装单独使用 24 段的椭圆车削面；腰口有重叠，躯干俯身时不露出接缝。 */
function regaliaShell(c: PartCtx, profile: RegaliaProfile, col: string, depth = 0.82, scallop = 0, start = 0, arc = Math.PI * 2): THREE.Mesh {
  const b = c.look.build ?? 1;
  const geo = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r * b, y)), arc === Math.PI * 2 ? 24 : 6, start, arc);
  const pos = geo.getAttribute('position');
  const low = profile[0][1], high = profile[profile.length - 1][1];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i);
    const phi = Math.atan2(x, z);
    const weight = Math.max(0, Math.min(1, (high - y) / (high - low)));
    const fold = 1 + scallop * 0.35 * Math.cos(phi * 6) * weight;
    pos.setXYZ(i, x * fold, y - scallop * (1 - Math.cos(phi * 6)) * weight, z * depth * fold);
  }
  geo.computeVertexNormals();
  return solid(geo, toon(col, { double: true }), 0.018);
}

function regaliaRadius(profile: RegaliaProfile, y: number): number {
  for (let i = 1; i < profile.length; i++) {
    const [r0, y0] = profile[i - 1], [r1, y1] = profile[i];
    if (y <= y1) return THREE.MathUtils.lerp(r0, r1, THREE.MathUtils.clamp((y - y0) / (y1 - y0), 0, 1));
  }
  return profile[profile.length - 1][0];
}

/** 前襟贴在椭圆面上，避免平面装饰浮在肚子前。points 的 x/y 是未乘体宽的坐标。 */
function regaliaPatch(c: PartCtx, points: [number, number][], profile: RegaliaProfile, col: string, offset = 0.025, depth = 0.82): THREE.Mesh {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const flat = new THREE.ShapeGeometry(shape).toNonIndexed();
  const xy = flat.getAttribute('position');
  const triangles: THREE.Vector2[] = [], divisions = 6;
  // 只投影多边形角点会让大三角沉入圆肚子；每边六格，再贴面。
  for (let t = 0; t < xy.count; t += 3) {
    const a = new THREE.Vector2(xy.getX(t), xy.getY(t)), b = new THREE.Vector2(xy.getX(t + 1), xy.getY(t + 1)), d = new THREE.Vector2(xy.getX(t + 2), xy.getY(t + 2));
    const at = (i: number, j: number): THREE.Vector2 => a.clone().addScaledVector(b.clone().sub(a), i / divisions).addScaledVector(d.clone().sub(a), j / divisions);
    for (let i = 0; i < divisions; i++) for (let j = 0; j < divisions - i; j++) {
      triangles.push(at(i, j), at(i + 1, j), at(i, j + 1));
      if (j < divisions - i - 1) triangles.push(at(i + 1, j), at(i + 1, j + 1), at(i, j + 1));
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(triangles.flatMap((p) => [p.x, p.y, 0]), 3));
  flat.dispose();
  const pos = geo.getAttribute('position'), b = c.look.build ?? 1;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), r = regaliaRadius(profile, y);
    pos.setXYZ(i, x * b, y, Math.sqrt(Math.max(0, r * r - x * x)) * b * depth + offset);
  }
  geo.computeVertexNormals();
  return solid(geo, toon(col, { double: true }), 0.008);
}

function regaliaCord(points: THREE.Vector3[], radius: number, col: string, closed = false): THREE.Mesh {
  return solid(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, closed), 24, radius, 6, closed), toon(col), 0.006);
}

function regaliaRing(c: PartCtx, r: number, y: number, col: string, depth = 0.82, scallop = 0): THREE.Mesh {
  const b = c.look.build ?? 1;
  const pts = Array.from({ length: 24 }, (_, i) => {
    const phi = i * Math.PI / 12, fold = 1 + scallop * 0.35 * Math.cos(phi * 6);
    return new THREE.Vector3(Math.sin(phi) * r * b * fold, y - scallop * (1 - Math.cos(phi * 6)), Math.cos(phi) * r * b * depth * fold);
  });
  return regaliaCord(pts, 0.024, col, true);
}

function regaliaCap(c: PartCtx, r: number, y: number, col: string, depth = 0.82): THREE.Mesh {
  const cap = solid(new THREE.CircleGeometry(r * (c.look.build ?? 1), 24), toon(col, { double: true }), 0);
  cap.rotation.x = Math.PI / 2; cap.scale.y = depth; cap.position.y = y;
  return cap;
}

/** 在构建时把裙面和所有裙饰一起收短；腰口 y=.57 不动，插槽与裙根保持单位变换。 */
function raiseRegaliaHem(skirt: THREE.Group, scaleY: number): void {
  const lift = new THREE.Matrix4().makeScale(1, scaleY, 1);
  lift.setPosition(0, 0.57 * (1 - scaleY), 0);
  for (const child of skirt.children) {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) continue;
    mesh.updateMatrix();
    mesh.geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(lift, mesh.matrix));
    mesh.position.set(0, 0, 0); mesh.rotation.set(0, 0, 0); mesh.scale.set(1, 1, 1); mesh.updateMatrix();
  }
}

function silkRegalia(c: PartCtx): THREE.Group {
  const g = new THREE.Group(), skirt = new THREE.Group(), b = c.look.build ?? 1;
  const upper: RegaliaProfile = [[0.51, 0.25], [0.54, 0.46], [0.54, 0.74], [0.45, 0.98], [0.30, 1.17], [0.24, 1.23]];
  const lower: RegaliaProfile = [[0.72, -0.34], [0.71, -0.16], [0.62, 0.16], [0.54, 0.43], [0.51, 0.57]];
  g.add(regaliaShell(c, upper, c.pal.main));
  skirt.add(regaliaShell(c, lower, c.pal.main), regaliaCap(c, 0.71, -0.31, c.pal.sub), regaliaRing(c, 0.72, -0.33, c.pal.trim));
  // 宽交领与金边：与曹喵德、司马喵懿、庞喵统参考图的华服一致。
  const left: [number, number][] = [[-0.28, 1.18], [-0.13, 1.16], [0.25, 0.55], [0.08, 0.54], [-0.15, 0.90]];
  const right: [number, number][] = [[0.27, 1.18], [0.14, 1.16], [-0.19, 0.55], [-0.34, 0.55], [-0.06, 0.98]];
  g.add(regaliaPatch(c, left, upper, c.pal.sub), regaliaPatch(c, right, upper, c.pal.sub, 0.04));
  for (const [side, end] of [[-1, 0.17], [1, -0.26]] as const) {
    const xy: [number, number][] = [[side * 0.21, 1.17], [side * 0.14, 1.01], [side * 0.04, 0.82], [end, 0.57]];
    const pts = xy.map(([x, y]) => new THREE.Vector3(x * b, y, Math.sqrt(regaliaRadius(upper, y) ** 2 - x ** 2) * b * 0.82 + 0.065));
    g.add(regaliaCord(pts, 0.027, c.pal.trim));
  }
  const bib = regaliaPatch(c, [[-0.12, 1.16], [0.12, 1.16], [0.04, 0.91], [-0.02, 0.85]], upper, c.pal.cloth ?? c.pal.trim, 0.03);
  g.add(bib);
  // 正面的深色压褶裙片与两条宽布褶，近看有层次，190px 下保持主色块完整。
  skirt.add(regaliaPatch(c, [[-0.19, 0.46], [0.21, 0.46], [0.43, -0.28], [0.18, -0.34], [-0.43, -0.28]], lower, c.pal.sub, 0.03));
  for (const side of [-1, 1]) {
    skirt.add(regaliaPatch(c, [[side * 0.31, 0.25], [side * 0.34, 0.24], [side * 0.53, -0.25], [side * 0.48, -0.28]], lower, c.pal.sub, 0.028));
    const ring = solid(new THREE.TorusGeometry(0.075, 0.016, 4, 12), toon(c.pal.trim), 0.004);
    ring.position.set(side * 0.30 * b, 0.73, Math.sqrt(0.54 ** 2 - 0.30 ** 2) * b * 0.82 + 0.025);
    ring.rotation.y = side * 0.45;
    g.add(ring);
  }
  g.add(regaliaShell(c, [[0.555, 0.42], [0.555, 0.55]], c.pal.sub));
  const buckle = solid(new THREE.SphereGeometry(0.085, 12, 8), toon(c.pal.trim), 0.01);
  buckle.scale.set(1.25, 0.8, 0.4); buckle.position.set(0, 0.49, 0.49 * b); g.add(buckle);
  raiseRegaliaHem(skirt, 0.846);
  g.userData.skirt = skirt;
  return g;
}

function petalDress(c: PartCtx): THREE.Group {
  const g = new THREE.Group(), skirt = new THREE.Group(), b = c.look.build ?? 1;
  const upper: RegaliaProfile = [[0.50, 0.25], [0.525, 0.48], [0.51, 0.76], [0.43, 1.02], [0.29, 1.18], [0.24, 1.22]];
  const lower: RegaliaProfile = [[0.82, -0.25], [0.78, -0.06], [0.65, 0.22], [0.53, 0.44], [0.50, 0.57]];
  g.add(regaliaShell(c, upper, c.pal.main));
  skirt.add(regaliaShell(c, lower, c.pal.main, 0.82, 0.035), regaliaCap(c, 0.78, -0.20, c.pal.sub), regaliaRing(c, 0.82, -0.25, c.pal.trim, 0.82, 0.035));
  // 短层裙与六瓣波边，区别于华服的直下摆；浅衬色来自英雄自己的 cloth。
  skirt.add(regaliaShell(c, [[0.79, 0.01], [0.72, 0.15], [0.56, 0.43]], c.pal.sub, 0.82, 0.03));
  skirt.add(regaliaRing(c, 0.79, 0.01, c.pal.trim, 0.82, 0.03));
  const collar = regaliaRing(c, 0.285, 1.18, c.pal.sub);
  g.add(collar);
  g.add(regaliaPatch(c, [[-0.21, 1.12], [-0.07, 1.05], [0, 0.95], [0.07, 1.05], [0.21, 1.12], [0, 1.15]], upper, c.pal.cloth ?? c.pal.trim, 0.03));
  g.add(regaliaShell(c, [[0.548, 0.42], [0.548, 0.55]], c.pal.trim));
  for (const side of [-1, 1]) {
    const loop = solid(new THREE.SphereGeometry(0.12, 12, 8), toon(c.pal.sub), 0.012);
    loop.scale.set(1.35, 0.67, 0.35); loop.position.set(side * 0.12 * b, 0.49, 0.48 * b); loop.rotation.z = -side * 0.28;
    g.add(loop);
    skirt.add(regaliaPatch(c, [[side * 0.03, 0.43], [side * 0.12, 0.43], [side * 0.28, 0.02], [side * 0.16, 0.08]], lower, c.pal.cloth ?? c.pal.trim, 0.045));
    for (const phi of [side * 0.43, side * 0.96]) {
      const pts = [0.18, 0.03, -0.12, -0.25].map((y) => {
        const r = regaliaRadius(lower, y) * b, w = (0.57 - y) / 0.82;
        return new THREE.Vector3(Math.sin(phi) * r * (1 + 0.035 * 0.35 * Math.cos(phi * 6) * w), y - 0.035 * (1 - Math.cos(phi * 6)) * w, Math.cos(phi) * r * 0.82 * (1 + 0.035 * 0.35 * Math.cos(phi * 6) * w) + 0.018);
      });
      skirt.add(regaliaCord(pts, 0.012, c.pal.sub));
    }
  }
  const knot = solid(new THREE.SphereGeometry(0.065, 10, 8), toon(c.pal.trim), 0.006);
  knot.scale.z = 0.45; knot.position.set(0, 0.49, 0.505 * b); g.add(knot);
  raiseRegaliaHem(skirt, 0.85);
  g.userData.skirt = skirt;
  return g;
}

function heavyRegalia(c: PartCtx): THREE.Group {
  const g = new THREE.Group(), skirt = new THREE.Group(), b = c.look.build ?? 1;
  const upper: RegaliaProfile = [[0.50, 0.24], [0.555, 0.48], [0.57, 0.76], [0.48, 1.01], [0.29, 1.18]];
  g.add(regaliaShell(c, upper, c.pal.main));
  skirt.add(regaliaShell(c, [[0.61, -0.16], [0.60, 0.10], [0.54, 0.44], [0.50, 0.57]], c.pal.sub));
  skirt.add(regaliaCap(c, 0.59, -0.12, c.pal.sub));
  // 五片弧面裙甲：分开的片尖形成重甲剪影，布衬保持腰下遮挡。
  const hemGeometries: THREE.BufferGeometry[] = [];
  for (let i = -2; i <= 2; i++) {
    const centre = i * 0.55, arc = 0.46, bottom = i === 0 ? -0.27 : -0.21;
    skirt.add(regaliaShell(c, [[0.66, bottom], [0.655, bottom + 0.07], [0.625, 0.15], [0.568, 0.44]], i % 2 === 0 ? c.pal.main : c.pal.sub, 0.82, 0, centre - arc / 2, arc));
    const pts = Array.from({ length: 5 }, (_, j) => {
      const phi = centre - arc / 2 + arc * j / 4;
      return new THREE.Vector3(Math.sin(phi) * 0.667 * b, bottom + 0.035, Math.cos(phi) * 0.667 * b * 0.82);
    });
    hemGeometries.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.024, 6, false));
  }
  // 五条同色裙甲边合成一网格，腾出的四个网格用于肩甲层次。
  const hemGeometry = mergeGeometries(hemGeometries, false)!;
  skirt.add(solid(hemGeometry, toon(c.pal.trim), 0.006));
  for (const geo of hemGeometries) geo.dispose();
  // 小块冷金属胸板留出大面积阵营色；圆润的三层肩甲形成重装剪影。
  for (const side of [-1, 1]) {
    g.add(regaliaPatch(c, [[side * 0.045, 1.05], [side * 0.27, 1.08], [side * 0.39, 0.95], [side * 0.36, 0.76], [side * 0.20, 0.85], [side * 0.04, 0.90]], upper, side === -1 ? '#9eb0c4' : '#c5d3e0', 0.045));
    for (let layer = 0; layer < 3; layer++) {
      const shoulder = solid(new THREE.SphereGeometry((0.215 - layer * 0.030) * b, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(layer === 0 ? '#d8e3ee' : layer === 1 ? '#8296ac' : c.pal.main, { double: true }), 0.015);
      shoulder.scale.set(1, 0.55, 0.95);
      shoulder.position.set(side * (0.46 + layer * 0.025) * b, 1.035 - layer * 0.065, -0.035);
      shoulder.rotation.z = -side * 0.25;
      g.add(shoulder);
    }
    const edge = regaliaCord([new THREE.Vector3(side * 0.275 * b, 1.08, 0.045), new THREE.Vector3(side * 0.46 * b, 1.035, 0.172 * b), new THREE.Vector3(side * 0.645 * b, 0.99, 0.045)], 0.022, c.pal.trim);
    g.add(edge);
  }
  g.add(regaliaRing(c, 0.295, 1.16, c.pal.trim));
  const mirror = solid(new THREE.CylinderGeometry(0.13, 0.13, 0.045, 16), toon(c.pal.trim), 0.012);
  mirror.rotation.x = Math.PI / 2; mirror.position.set(0, 0.82, 0.51 * b); g.add(mirror);
  const gem = solid(new THREE.SphereGeometry(0.075, 12, 8), toon(c.pal.main), 0.006);
  gem.scale.z = 0.45; gem.position.set(0, 0.82, 0.55 * b); g.add(gem);
  g.add(regaliaShell(c, [[0.575, 0.42], [0.575, 0.55]], c.pal.trim));
  const buckle = solid(new THREE.SphereGeometry(0.08, 12, 8), toon(c.pal.sub), 0.008);
  buckle.scale.set(1.25, 0.85, 0.4); buckle.position.set(0, 0.49, 0.51 * b); g.add(buckle);
  raiseRegaliaHem(skirt, 0.917);
  g.userData.skirt = skirt;
  return g;
}

export const BODY: Record<string, PartBuilder> = {
  robeScholar: scholarRobe,
  robeTaoist: taoistRobe,
  robeSilk: silkRegalia,
  dress: petalDress,
  vest: (c) => robe(c, { hem: 0.5, waist: 0.42, chest: 0.5 }),
  armorWei: (c) => { const g = robe(c, { hem: 0.58, waist: 0.44, chest: 0.54, col: c.pal.main }); g.add(chestPlate(c, c.pal.sub), pauldrons(c, c.pal.main)); (g.userData.skirt as THREE.Group).add(tassets(c, c.pal.sub, 0.55)); return g; },
  armorHeavy: heavyRegalia,
  armorLight: (c) => { const g = robe(c, { hem: 0.55, waist: 0.42, chest: 0.5 }); g.add(chestPlate(c, c.pal.sub, false), pauldrons(c, c.pal.sub)); (g.userData.skirt as THREE.Group).add(tassets(c, c.pal.sub, 0.5, 6)); return g; },
  tribal: tribalHide,
  rattan: (c) => { const g = robe(c, { hem: 0.56, waist: 0.44, chest: 0.52, col: '#b08a54' }); g.add(chestPlate(c, '#8a6a3a', false), pauldrons(c, '#8a6a3a')); return g; },
};
