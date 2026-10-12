// 道袍 / 文士袍 / 兽皮：上身挂 torso，腰下全部通过 userData.skirt 挂 hip。
import * as THREE from 'three';
import { solid, toon } from '../toon';
import type { PartCtx } from './types';

type Profile = [number, number][];
const DEPTH = 0.82;

function radiusAt(profile: Profile, y: number): number {
  for (let i = 1; i < profile.length; i++) {
    const [r0, y0] = profile[i - 1], [r1, y1] = profile[i];
    if (y <= y1) return THREE.MathUtils.lerp(r0, r1, THREE.MathUtils.clamp((y - y0) / (y1 - y0), 0, 1));
  }
  return profile[profile.length - 1][0];
}

function shell(c: PartCtx, profile: Profile, color: string, start = 0, arc = Math.PI * 2): THREE.Mesh {
  const b = c.look.build ?? 1;
  const geo = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r * b, y)), arc === Math.PI * 2 ? 24 : 12, start, arc);
  geo.scale(1, 1, DEPTH);
  return solid(geo, toon(color, { double: true }), 0.018);
}

function front(c: PartCtx, profile: Profile, x: number, y: number, offset = 0.04): THREE.Vector3 {
  const b = c.look.build ?? 1, r = radiusAt(profile, y);
  return new THREE.Vector3(x * b, y, Math.sqrt(Math.max(0, r * r - x * x)) * b * DEPTH + offset);
}

/** 每个三角每边分六格后投影，饰片的内部也贴在壳面外，不只投影角点。 */
function patch(c: PartCtx, profile: Profile, points: [number, number][], color: string, offset = 0.04): THREE.Mesh {
  const source = new THREE.ShapeGeometry(new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y))));
  const flat = source.toNonIndexed(), xy = flat.getAttribute('position'), vertices: number[] = [], n = 6;
  for (let t = 0; t < xy.count; t += 3) {
    const a = new THREE.Vector2(xy.getX(t), xy.getY(t)), b = new THREE.Vector2(xy.getX(t + 1), xy.getY(t + 1)), d = new THREE.Vector2(xy.getX(t + 2), xy.getY(t + 2));
    const at = (i: number, j: number): THREE.Vector2 => a.clone().addScaledVector(b.clone().sub(a), i / n).addScaledVector(d.clone().sub(a), j / n);
    const add = (p: THREE.Vector2): void => { const v = front(c, profile, p.x, p.y, offset); vertices.push(v.x, v.y, v.z); };
    for (let i = 0; i < n; i++) for (let j = 0; j < n - i; j++) {
      [at(i, j), at(i + 1, j), at(i, j + 1)].forEach(add);
      if (j < n - i - 1) [at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)].forEach(add);
    }
  }
  source.dispose(); flat.dispose();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geo.computeVertexNormals();
  return solid(geo, toon(color, { double: true }), 0.006);
}

function cord(points: THREE.Vector3[], color: string, radius = 0.02, closed = false): THREE.Mesh {
  return solid(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, closed), closed ? 24 : 16, radius, 6, closed), toon(color), 0.005);
}

function hem(c: PartCtx, r: number, y: number, color: string, start = 0, arc = Math.PI * 2): THREE.Mesh {
  const b = c.look.build ?? 1, closed = arc === Math.PI * 2;
  const points = Array.from({ length: closed ? 24 : 13 }, (_, i) => {
    const phi = start + arc * i / (closed ? 24 : 12);
    return new THREE.Vector3(Math.sin(phi) * r * b, y, Math.cos(phi) * r * b * DEPTH);
  });
  return cord(points, color, 0.027, closed);
}

function cap(c: PartCtx, r: number, y: number, color: string): THREE.Mesh {
  const m = solid(new THREE.CircleGeometry(r * (c.look.build ?? 1), 24), toon(color, { double: true }), 0);
  m.rotation.x = Math.PI / 2; m.scale.y = DEPTH; m.position.y = y;
  return m;
}

function bead(c: PartCtx, profile: Profile, x: number, y: number, color: string, size = 0.045, offset = 0.07): THREE.Mesh {
  const m = solid(new THREE.SphereGeometry(size, 10, 8), toon(color), 0.006);
  m.scale.z = 0.5; m.position.copy(front(c, profile, x, y, offset));
  return m;
}

/** 收短裙面与全部裙饰，保持腰口 y=.57 与根单位变换；不会改变上身或插槽。 */
function raiseHem(skirt: THREE.Group, scaleY: number): void {
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

export function taoistRobe(c: PartCtx): THREE.Group {
  const g = new THREE.Group(), skirt = new THREE.Group(), b = c.look.build ?? 1;
  const cloth = c.pal.cloth ?? c.light;
  const upper: Profile = [[0.51, 0.25], [0.54, 0.47], [0.535, 0.76], [0.46, 1.0], [0.30, 1.17], [0.24, 1.22]];
  const lower: Profile = [[0.69, -0.38], [0.67, -0.17], [0.59, 0.17], [0.54, 0.43], [0.51, 0.57]];
  g.add(shell(c, upper, cloth));
  skirt.add(shell(c, lower, cloth), cap(c, 0.67, -0.34, c.pal.sub), hem(c, 0.69, -0.37, c.pal.main));
  // 宽交襟和长垂带。浅袍面、阵营色衣领取自左慈 / 诸葛的实际参考。
  g.add(patch(c, upper, [[-0.29, 1.18], [-0.13, 1.16], [0.29, 0.55], [0.11, 0.53], [-0.15, 0.95]], c.pal.main));
  g.add(patch(c, upper, [[0.28, 1.18], [0.14, 1.17], [-0.19, 0.55], [-0.34, 0.55], [-0.04, 0.96]], c.pal.main, 0.055));
  for (const side of [-1, 1]) {
    const pts = [[side * 0.21, 1.17], [side * 0.13, 1.0], [side * 0.01, 0.81], [-side * 0.22, 0.56]] as [number, number][];
    g.add(cord(pts.map(([x, y]) => front(c, upper, x, y, 0.073)), c.pal.sub, 0.015));
  }
  skirt.add(patch(c, lower, [[-0.10, 0.47], [0.13, 0.47], [0.35, -0.30], [0.19, -0.36], [-0.05, -0.28]], c.pal.main));
  for (const side of [-1, 1]) skirt.add(patch(c, lower, [[side * 0.28, 0.18], [side * 0.31, 0.16], [side * 0.48, -0.28], [side * 0.44, -0.31]], c.pal.main, 0.026));
  g.add(shell(c, [[0.565, 0.42], [0.565, 0.55]], c.pal.main));
  g.add(bead(c, upper, 0, 0.49, c.pal.trim, 0.07));
  // 阴阳道纹只用五个小网格，留清楚的圆形标记，不加细碎符文。
  const centre = front(c, upper, 0, 0.80, 0.083);
  const medal = solid(new THREE.CircleGeometry(0.12, 20), toon(c.pal.trim), 0.005);
  medal.position.copy(centre); g.add(medal);
  const dark = solid(new THREE.CircleGeometry(0.10, 20), toon(c.pal.sub), 0);
  dark.position.copy(centre).add(new THREE.Vector3(0, 0, 0.007)); g.add(dark);
  const swirl = new THREE.Shape();
  swirl.moveTo(0, -0.10);
  swirl.absarc(0, 0, 0.10, -Math.PI / 2, Math.PI / 2, true);
  swirl.absarc(0, 0.05, 0.05, Math.PI / 2, -Math.PI / 2, true);
  swirl.absarc(0, -0.05, 0.05, Math.PI / 2, -Math.PI / 2, false);
  const light = solid(new THREE.ShapeGeometry(swirl, 8), toon(cloth), 0);
  light.position.copy(centre).add(new THREE.Vector3(0, 0, 0.010)); g.add(light);
  for (const side of [-1, 1]) {
    const dot = solid(new THREE.SphereGeometry(0.022, 8, 6), toon(side === 1 ? cloth : c.pal.sub), 0);
    dot.scale.z = 0.3; dot.position.copy(centre).add(new THREE.Vector3(0, -side * 0.05, 0.018)); g.add(dot);
  }
  // 腰侧符袋保持在袖子前方，避免摆臂时硬饰伸入手臂活动区。
  const pouch = solid(new THREE.SphereGeometry(0.14, 12, 8), toon(c.pal.sub), 0.012);
  pouch.scale.set(0.86, 1.2, 0.50); pouch.position.set(0.43 * b, 0.36, 0.38 * b); g.add(pouch);
  const lid = solid(new THREE.SphereGeometry(0.11, 12, 8), toon(c.pal.main), 0.008);
  lid.scale.set(1, 0.38, 0.37); lid.position.set(0.43 * b, 0.48, 0.405 * b); g.add(lid);
  g.add(cord([new THREE.Vector3(0.41 * b, 0.49, 0.43 * b), new THREE.Vector3(0.43 * b, 0.40, 0.465 * b), new THREE.Vector3(0.45 * b, 0.33, 0.46 * b)], c.pal.trim, 0.012));
  raiseHem(skirt, 0.811);
  g.userData.skirt = skirt;
  return g;
}

export function scholarRobe(c: PartCtx): THREE.Group {
  const g = new THREE.Group(), skirt = new THREE.Group(), cloth = c.pal.cloth ?? c.light;
  const upper: Profile = [[0.50, 0.25], [0.54, 0.47], [0.53, 0.76], [0.45, 1.0], [0.28, 1.17], [0.23, 1.21]];
  const inner: Profile = [[0.56, -0.26], [0.57, -0.08], [0.54, 0.42], [0.50, 0.57]];
  const outer: Profile = [[0.61, -0.27], [0.605, -0.08], [0.58, 0.18], [0.56, 0.44], [0.535, 0.57]];
  g.add(shell(c, upper, cloth));
  skirt.add(shell(c, inner, c.pal.sub), cap(c, 0.55, -0.22, c.pal.sub));
  // 前后两裾各自包边，侧面留衬色开口：文士袍较直、较短，没有道袍宽垂带。
  for (const start of [-1.18, Math.PI - 1.18]) skirt.add(shell(c, outer, cloth, start, 2.36), hem(c, 0.61, -0.26, c.pal.main, start, 2.36));
  for (const side of [-1, 1]) {
    g.add(patch(c, upper, [[side * 0.28, 1.17], [side * 0.08, 1.14], [side * 0.10, 0.98], [side * 0.22, 1.04]], c.pal.main));
    skirt.add(patch(c, outer, [[side * 0.24, 0.22], [side * 0.265, 0.20], [side * 0.36, -0.23], [side * 0.32, -0.24]], c.pal.main, 0.025));
  }
  g.add(patch(c, upper, [[0.09, 1.11], [0.16, 1.10], [0.26, 0.56], [0.19, 0.54]], c.pal.main, 0.05));
  g.add(cord([[0.14, 1.08], [0.18, 0.87], [0.23, 0.60]].map(([x, y]) => front(c, upper, x, y, 0.068)), c.pal.sub, 0.013));
  for (const y of [0.86, 0.73, 0.60]) g.add(bead(c, upper, 0.20, y, c.pal.sub, 0.026, 0.067));
  g.add(shell(c, [[0.565, 0.43], [0.565, 0.53]], c.pal.main));
  const knot = solid(new THREE.CapsuleGeometry(0.035, 0.07, 4, 8), toon(c.pal.sub), 0.005);
  knot.rotation.z = Math.PI / 2; knot.position.copy(front(c, upper, 0.17, 0.48, 0.07)); g.add(knot);
  raiseHem(skirt, 0.917);
  g.userData.skirt = skirt;
  return g;
}

function leatherTab(c: PartCtx, angle: number, bottom: number): THREE.Mesh {
  const b = c.look.build ?? 1, profile: Profile = [[0.595, bottom + 0.08], [0.61, bottom + 0.16], [0.59, 0.16], [0.555, 0.43]];
  const geo = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r * b, y)), 8, angle - 0.34, 0.68);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), phi = Math.atan2(x, z);
    const weight = THREE.MathUtils.clamp((0.43 - y) / (0.35 - bottom), 0, 1);
    pos.setXYZ(i, x, y - 0.075 * Math.cos((phi - angle) / 0.34 * Math.PI / 2) * weight, z * DEPTH);
  }
  geo.computeVertexNormals();
  return solid(geo, toon(c.pal.sub, { double: true }), 0.018);
}

export function tribalHide(c: PartCtx): THREE.Group {
  const g = new THREE.Group(), skirt = new THREE.Group(), b = c.look.build ?? 1;
  const upper: Profile = [[0.50, 0.24], [0.54, 0.46], [0.53, 0.74], [0.44, 0.98], [0.30, 1.10], [0.23, 1.17]];
  const lower: Profile = [[0.555, -0.04], [0.555, 0.13], [0.525, 0.43], [0.50, 0.57]];
  // 覆盖底座的毛色胸面，露毛的感觉来自实际 fur / light，不修改引擎的 belly 开关。
  g.add(shell(c, upper, c.fur));
  g.add(patch(c, upper, [[-0.17, 0.95], [0.15, 0.95], [0.23, 0.73], [0.14, 0.51], [-0.13, 0.50], [-0.22, 0.71]], c.light, 0.035));
  g.add(patch(c, upper, [[-0.29, 1.10], [-0.16, 1.11], [0.42, 0.55], [0.32, 0.49], [-0.10, 0.87]], c.pal.sub, 0.065));
  g.add(patch(c, upper, [[0.29, 1.10], [0.20, 1.10], [-0.36, 0.55], [-0.43, 0.60], [0.08, 0.94]], c.pal.main, 0.081));
  for (const [x, y] of [[-0.12, 0.94], [0.23, 0.64]]) g.add(bead(c, upper, x, y, c.pal.trim, 0.030, 0.096));
  g.add(cord([front(c, upper, -0.23, 1.045, 0.065), front(c, upper, 0, 1.005, 0.065), front(c, upper, 0.23, 1.045, 0.065)], c.pal.sub, 0.022));
  for (const x of [-0.09, 0, 0.09]) {
    const tooth = solid(new THREE.ConeGeometry(0.027, 0.085, 6), toon(c.pal.trim), 0.006);
    tooth.rotation.z = Math.PI; tooth.position.copy(front(c, upper, x, 0.965, 0.077)); g.add(tooth);
  }
  g.add(shell(c, [[0.575, 0.41], [0.575, 0.54]], c.pal.sub));
  for (const side of [-1, 1]) {
    const bone = solid(new THREE.CapsuleGeometry(0.034, 0.12, 4, 8), toon(c.pal.trim), 0.008);
    bone.rotation.z = side * 0.85; bone.position.copy(front(c, upper, 0, 0.48, 0.094)); g.add(bone);
  }
  // 三片短皮裙的中片更长；侧面和腿部不被一整件长袍盖住。
  skirt.add(shell(c, lower, c.pal.sub), cap(c, 0.54, -0.01, c.pal.sub));
  for (const angle of [-0.70, 0, 0.70]) {
    const bottom = angle === 0 ? -0.24 : -0.13;
    skirt.add(leatherTab(c, angle, bottom));
    const pts = Array.from({ length: 9 }, (_, i) => {
      const phi = angle - 0.34 + 0.68 * i / 8;
      return new THREE.Vector3(Math.sin(phi) * 0.602 * b, bottom + 0.08 - 0.075 * Math.cos((phi - angle) / 0.34 * Math.PI / 2), Math.cos(phi) * 0.602 * b * DEPTH);
    });
    skirt.add(cord(pts, c.pal.main, 0.018));
    const tooth = solid(new THREE.ConeGeometry(0.040, 0.095, 6), toon(c.pal.trim), 0.006);
    tooth.rotation.z = Math.PI; tooth.position.set(Math.sin(angle) * 0.616 * b, bottom + 0.14, Math.cos(angle) * 0.616 * b * DEPTH + 0.015); skirt.add(tooth);
  }
  raiseHem(skirt, 0.957);
  g.userData.skirt = skirt;
  return g;
}
