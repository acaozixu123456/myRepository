// 玄甲 / 轻甲 / 短褂 / 藤甲。肩胸归 torso，腰以下归 hip；根变换保持单位。
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { solid, toon } from '../toon';
import type { PartCtx } from './types';

type Profile = [number, number][];
type Point = [number, number];
const DEPTH = 0.82;
const UPPER: Profile = [[0.50, 0.24], [0.535, 0.47], [0.535, 0.74], [0.445, 0.96], [0.265, 1.10]];
const LOWER: Profile = [[0.565, -0.18], [0.575, 0.06], [0.535, 0.43], [0.50, 0.57]];

function radiusAt(profile: Profile, y: number): number {
  for (let i = 1; i < profile.length; i++) {
    const [r0, y0] = profile[i - 1], [r1, y1] = profile[i];
    if (y <= y1) return THREE.MathUtils.lerp(r0, r1, THREE.MathUtils.clamp((y - y0) / (y1 - y0), 0, 1));
  }
  return profile[profile.length - 1][0];
}

function front(c: PartCtx, profile: Profile, x: number, y: number, offset = 0.04): THREE.Vector3 {
  const b = c.look.build ?? 1, r = radiusAt(profile, y);
  return new THREE.Vector3(x * b, y, Math.sqrt(Math.max(0, r * r - x * x)) * b * DEPTH + offset);
}

function shell(c: PartCtx, profile: Profile, color: string, start = 0, arc = Math.PI * 2): THREE.Mesh {
  const geo = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r * (c.look.build ?? 1), y)), arc === Math.PI * 2 ? 24 : 8, start, arc);
  geo.scale(1, 1, DEPTH);
  return solid(geo, toon(color, { double: true }), 0.016);
}

/** 先细分，再投影整片的每个顶点；内部三角不会沉进圆肚子。 */
function patchGeometry(c: PartCtx, profile: Profile, points: Point[], offset = 0.04): THREE.BufferGeometry {
  const source = new THREE.ShapeGeometry(new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y))));
  const flat = source.index ? source.toNonIndexed() : source;
  const xy = flat.getAttribute('position'), vertices: number[] = [], n = 6;
  for (let t = 0; t < xy.count; t += 3) {
    const a = new THREE.Vector2(xy.getX(t), xy.getY(t)), b = new THREE.Vector2(xy.getX(t + 1), xy.getY(t + 1)), d = new THREE.Vector2(xy.getX(t + 2), xy.getY(t + 2));
    const at = (i: number, j: number): THREE.Vector2 => a.clone().addScaledVector(b.clone().sub(a), i / n).addScaledVector(d.clone().sub(a), j / n);
    const add = (p: THREE.Vector2): void => { const v = front(c, profile, p.x, p.y, offset); vertices.push(v.x, v.y, v.z); };
    for (let i = 0; i < n; i++) for (let j = 0; j < n - i; j++) {
      [at(i, j), at(i + 1, j), at(i, j + 1)].forEach(add);
      if (j < n - i - 1) [at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)].forEach(add);
    }
  }
  if (flat !== source) flat.dispose(); source.dispose();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geo.computeVertexNormals();
  return geo;
}

function patch(c: PartCtx, profile: Profile, points: Point[], color: string, offset = 0.04): THREE.Mesh {
  return solid(patchGeometry(c, profile, points, offset), toon(color, { double: true }), 0.006);
}

function merged(geos: THREE.BufferGeometry[], color: string, outline = 0.005): THREE.Mesh {
  const geo = mergeGeometries(geos, false)!;
  for (const src of geos) src.dispose();
  return solid(geo, toon(color, { double: true }), outline);
}

function tube(points: THREE.Vector3[], radius = 0.022, closed = false): THREE.TubeGeometry {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, closed), closed ? 24 : 16, radius, 6, closed);
}

function rim(c: PartCtx, r: number, y: number, color: string): THREE.Mesh {
  const b = c.look.build ?? 1;
  const points = Array.from({ length: 24 }, (_, i) => new THREE.Vector3(Math.sin(i * Math.PI / 12) * r * b, y, Math.cos(i * Math.PI / 12) * r * b * DEPTH));
  return solid(tube(points, 0.022, true), toon(color), 0.005);
}

function bead(c: PartCtx, x: number, y: number, color: string, radius = 0.05): THREE.Mesh {
  const m = solid(new THREE.SphereGeometry(radius, 12, 8), toon(color), 0.006);
  m.scale.set(1.1, 0.85, 0.48); m.position.copy(front(c, UPPER, x, y, 0.075));
  return m;
}

function foundation(c: PartCtx, name: string, main = c.pal.main, lower: Profile = LOWER): { g: THREE.Group; skirt: THREE.Group } {
  const g = new THREE.Group(), skirt = new THREE.Group();
  g.name = name; skirt.name = name + '-skirt';
  g.add(shell(c, UPPER, main));
  skirt.add(shell(c, lower, c.pal.sub));
  const cap = solid(new THREE.CircleGeometry(lower[0][0] * (c.look.build ?? 1) * 0.98, 24), toon(c.pal.sub, { double: true }), 0);
  cap.rotation.x = Math.PI / 2; cap.scale.y = DEPTH; cap.position.y = lower[0][1] + 0.03;
  skirt.add(cap, rim(c, lower[0][0], lower[0][1] + 0.015, c.pal.trim));
  g.add(shell(c, [[0.557, 0.42], [0.557, 0.55]], c.pal.sub), bead(c, 0, 0.485, c.pal.trim, 0.072));
  g.userData.skirt = skirt;
  return { g, skirt };
}

/** 肩片比重甲窄且低，软弧边留出头颈与手臂抬起的空间。 */
function shoulders(c: PartCtx, g: THREE.Group, colors: string[], size = 0.205): void {
  const b = c.look.build ?? 1, edges: THREE.BufferGeometry[] = [], studs: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < colors.length; i++) {
      const m = solid(new THREE.SphereGeometry((size - i * 0.028) * b, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(colors[i], { double: true }), 0.012);
      m.scale.set(1, 0.43, 0.94); m.position.set(side * (0.49 + i * 0.03) * b, 1.005 - i * 0.065, -0.025); m.rotation.z = -side * 0.23;
      g.add(m);
    }
    const pts = [new THREE.Vector3(side * 0.30 * b, 1.025, 0.02), new THREE.Vector3(side * 0.49 * b, 1.005, size * b * 0.91), new THREE.Vector3(side * 0.675 * b, 0.965, 0.02)];
    edges.push(tube(pts, 0.019));
    const stud = new THREE.SphereGeometry(0.041, 10, 6); stud.scale(1, 0.72, 0.5); stud.translate(side * 0.50 * b, 1.018, size * b * 0.89); studs.push(stud);
  }
  g.add(merged(edges, c.pal.trim), merged(studs, c.pal.trim, 0));
}

function skirtPlates(c: PartCtx, skirt: THREE.Group, color: string, bottom = -0.19): void {
  const b = c.look.build ?? 1, edges: THREE.BufferGeometry[] = [];
  for (const centre of [-0.63, 0, 0.63]) {
    const arc = 0.50;
    skirt.add(shell(c, [[0.602, bottom], [0.615, bottom + 0.07], [0.58, 0.15], [0.553, 0.42]], color, centre - arc / 2, arc));
    const pts = Array.from({ length: 6 }, (_, j) => {
      const a = centre - arc / 2 + arc * j / 5;
      return new THREE.Vector3(Math.sin(a) * 0.608 * b, bottom + 0.023, Math.cos(a) * 0.608 * b * DEPTH);
    });
    edges.push(tube(pts, 0.02));
  }
  skirt.add(merged(edges, c.pal.trim));
}

/** 腰口 .57 不动，在构建期收短上身，给大头杂兵低头与呼吸留出真实壳面间隙。 */
function leaveNeckRoom(g: THREE.Group): void {
  for (const [i, child] of g.children.entries()) {
    const m = child as THREE.Mesh;
    if (!m.isMesh) continue;
    m.updateMatrix(); m.geometry.applyMatrix4(m.matrix);
    const p = m.geometry.getAttribute('position');
    for (let j = 0; j < p.count; j++) if (p.getY(j) > 0.57) p.setY(j, 0.57 + (p.getY(j) - 0.57) * 0.90);
    m.geometry.computeVertexNormals();
    m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1);
    m.name = g.name + '-upper-' + i;
  }
}

export function weiFieldArmor(c: PartCtx): THREE.Group {
  const { g, skirt } = foundation(c, 'field-wei-armor');
  // 整齐小札片比一整块球形胸甲更像制式玄甲，阵营蓝仍是最大的色块。
  g.add(patch(c, UPPER, [[-0.32, 1.01], [0.32, 1.01], [0.42, 0.83], [0.36, 0.59], [-0.36, 0.59], [-0.42, 0.83]], c.pal.sub));
  const rows: THREE.BufferGeometry[] = [];
  for (let row = 0; row < 3; row++) for (let col = -2; col <= 2; col++) {
    const x = col * 0.128, y = 0.68 + row * 0.10, w = 0.056;
    rows.push(patchGeometry(c, UPPER, [[x - w, y + 0.045], [x + w, y + 0.045], [x + w, y - 0.025], [x, y - 0.043], [x - w, y - 0.025]], 0.062));
  }
  g.add(merged(rows, c.pal.main, 0.004));
  shoulders(c, g, [c.pal.main, c.pal.trim, c.pal.sub]);
  const crest = solid(new THREE.CylinderGeometry(0.105, 0.105, 0.035, 16), toon(c.pal.trim), 0.006);
  crest.rotation.x = Math.PI / 2; crest.position.copy(front(c, UPPER, 0, 0.91, 0.088)); g.add(crest);
  g.add(bead(c, 0, 0.91, c.pal.sub, 0.06));
  skirtPlates(c, skirt, c.pal.main);
  leaveNeckRoom(g);
  return g;
}

export function lightFieldArmor(c: PartCtx): THREE.Group {
  const { g, skirt } = foundation(c, 'field-light-armor');
  g.add(patch(c, UPPER, [[-0.30, 1.01], [0.30, 1.01], [0.36, 0.86], [0.29, 0.59], [-0.29, 0.59], [-0.36, 0.86]], c.pal.sub));
  // 参考许虎痴 / 孙小霸 / 孙香香的 X 绑带，肩与腰只留两层短甲片。
  for (const side of [-1, 1]) {
    const pts: Point[] = [[side * 0.28, 1.025], [side * 0.32, 0.995], [-side * 0.23, 0.60], [-side * 0.28, 0.625]];
    g.add(patch(c, UPPER, pts, c.pal.trim, side === -1 ? 0.062 : 0.074));
  }
  shoulders(c, g, [c.pal.main, c.pal.sub], 0.185);
  g.add(bead(c, 0, 0.815, c.pal.trim, 0.053));
  skirtPlates(c, skirt, c.pal.main, -0.155);
  // 短 V 领不是一圈高领，缩小时保留衣领边而不碰口鼻。
  for (const side of [-1, 1]) g.add(patch(c, UPPER, [[side * 0.245, 1.075], [side * 0.18, 1.065], [0, 0.985], [side * 0.065, 0.99]], c.pal.cloth ?? c.pal.trim, 0.055));
  leaveNeckRoom(g);
  return g;
}

export function openFieldVest(c: PartCtx): THREE.Group {
  const lower: Profile = [[0.54, -0.075], [0.555, 0.13], [0.535, 0.43], [0.50, 0.57]];
  const { g, skirt } = foundation(c, 'field-open-vest', c.pal.main, lower);
  // 深色衬衣露在中间，左右短褂与翻领形成清楚的开襟，不再用长袍门襟。
  g.add(patch(c, UPPER, [[-0.23, 1.075], [0.23, 1.075], [0.18, 0.82], [0.095, 0.55], [-0.095, 0.55], [-0.18, 0.82]], c.pal.sub));
  const edges: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    g.add(patch(c, UPPER, [[side * 0.25, 1.075], [side * 0.37, 1.005], [side * 0.22, 0.86], [side * 0.10, 0.57], [side * 0.055, 0.57], [side * 0.16, 0.88]], c.pal.main, 0.057));
    g.add(patch(c, UPPER, [[side * 0.24, 1.075], [side * 0.35, 1.015], [side * 0.205, 0.885], [side * 0.13, 0.965]], c.pal.cloth ?? c.pal.trim, 0.080));
    edges.push(tube([[side * 0.23, 1.075], [side * 0.18, 0.88], [side * 0.095, 0.57]].map(([x, y]) => front(c, UPPER, x, y, 0.086)), 0.018));
    // 侧边短开衩加强马甲的布料轮廓，后视也能读出短于袍服的下摆。
    skirt.add(patch(c, lower, [[side * 0.20, 0.37], [side * 0.235, 0.37], [side * 0.37, -0.035], [side * 0.31, -0.035]], c.pal.main));
  }
  g.add(merged(edges, c.pal.trim));
  const toggles: THREE.BufferGeometry[] = [];
  for (const y of [0.66, 0.80]) {
    const p = front(c, UPPER, 0, y, 0.083);
    const toggle = new THREE.CapsuleGeometry(0.017, 0.10, 4, 8); toggle.rotateZ(Math.PI / 2); toggle.translate(p.x, p.y, p.z); toggles.push(toggle);
  }
  g.add(merged(toggles, c.pal.trim, 0.004));
  leaveNeckRoom(g);
  return g;
}

/** 两组斜藤条在交点交替前后起伏；真实曲面条带合并成两个材质网格。 */
function basket(c: PartCtx, profile: Profile, xLimit: number, y0: number, y1: number, colors: [string, string]): THREE.Mesh[] {
  const out: THREE.Mesh[] = [], spacing = 0.125, width = 0.025;
  for (const side of [-1, 1]) {
    const vertices: number[] = [];
    const vertex = (x: number, y: number): THREE.Vector3 => {
      const cross = 2 * (y - (y0 + y1) / 2) / spacing;
      const offset = 0.055 + side * 0.007 * Math.cos(cross * Math.PI);
      return front(c, profile, x, y, offset);
    };
    for (let k = -8; k <= 8; k++) {
      const intercept = (y0 + y1) / 2 + k * spacing;
      for (let j = 0; j < 24; j++) {
        const x0 = -xLimit + 2 * xLimit * j / 24, x1 = -xLimit + 2 * xLimit * (j + 1) / 24;
        const ya = intercept + side * x0, yb = intercept + side * x1;
        if (Math.min(ya, yb) - width > y1 || Math.max(ya, yb) + width < y0) continue;
        const a = vertex(x0, THREE.MathUtils.clamp(ya - width / 2, y0, y1));
        const b = vertex(x1, THREE.MathUtils.clamp(yb - width / 2, y0, y1));
        const d = vertex(x0, THREE.MathUtils.clamp(ya + width / 2, y0, y1));
        const e = vertex(x1, THREE.MathUtils.clamp(yb + width / 2, y0, y1));
        for (const p of [a, b, d, b, e, d]) vertices.push(p.x, p.y, p.z);
      }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geo.computeVertexNormals();
    out.push(solid(geo, toon(colors[side === -1 ? 0 : 1], { double: true }), 0));
  }
  return out;
}

export function wovenFieldArmor(c: PartCtx): THREE.Group {
  const straw = '#' + new THREE.Color(c.pal.main).lerp(new THREE.Color(c.pal.cloth ?? c.pal.trim), 0.56).getHexString();
  const { g, skirt } = foundation(c, 'field-woven-armor', straw);
  // 藤甲保留暖藤色与阵营腰封；较宽的交错藤条在 190px 下仍能读出菱形篮编。
  g.add(patch(c, UPPER, [[-0.33, 1.00], [0.33, 1.00], [0.39, 0.81], [0.32, 0.59], [-0.32, 0.59], [-0.39, 0.81]], c.pal.sub));
  g.add(...basket(c, UPPER, 0.32, 0.62, 0.99, [straw, c.pal.trim]));
  const border: Point[] = [[-0.32, 0.99], [0, 1.025], [0.32, 0.99], [0.35, 0.81], [0.30, 0.60], [0, 0.585], [-0.30, 0.60], [-0.35, 0.81]];
  g.add(solid(tube(border.map(([x, y]) => front(c, UPPER, x, y, 0.080)), 0.025, true), toon(straw), 0.005));
  shoulders(c, g, [straw, c.pal.sub], 0.195);
  skirtPlates(c, skirt, straw, -0.17);
  skirt.add(...basket(c, LOWER, 0.28, -0.125, 0.32, [straw, c.pal.trim]));
  leaveNeckRoom(g);
  return g;
}
