// 衣服：挂在 torso（髋部原点）。肩在 (±0.52, 1.0, 0)，脖子根 (0, 1.3, 0)。
// 六件袍服与四件战场衣服各有独立造型；腰下通过 userData.skirt 挂在 hip。
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { solid, toon } from '../toon';
import type { PartBuilder, PartCtx } from './types';
import { scholarRobe, taoistRobe, tribalHide } from './body-robes';
import { lightFieldArmor, openFieldVest, weiFieldArmor, wovenFieldArmor } from './body-field-armor';

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
  vest: openFieldVest,
  armorWei: weiFieldArmor,
  armorHeavy: heavyRegalia,
  armorLight: lightFieldArmor,
  tribal: tribalHide,
  rattan: wovenFieldArmor,
};
