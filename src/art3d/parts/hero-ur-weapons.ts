// UR 独有武器；根保持掌心原点，杆沿 +y，刃面朝 +z。
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { capsule, solid, sphere, toon } from '../toon';
import type { PartCtx } from './types';

const STEEL = '#d8e2ee';
const STEEL_LIGHT = '#f4f9ff';
const STEEL_SHADOW = '#9caec4';

const mix = (a: string, b: string, k: number): string => '#' + new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString();
const cyl = (bottom: number, top: number, height: number, segments = 12): THREE.CylinderGeometry =>
  new THREE.CylinderGeometry(top, bottom, height, segments);

function at<T extends THREE.Object3D>(object: T, x: number, y: number, z = 0): T {
  object.position.set(x, y, z);
  return object;
}

function join(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = mergeGeometries(geometries.map((geometry) => geometry.index ? geometry.toNonIndexed() : geometry), false);
  if (!merged) throw new Error('UR weapon geometry attributes must match');
  return merged;
}

function plate(shape: THREE.Shape, depth = 0.052): THREE.ExtrudeGeometry {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth, steps: 1, curveSegments: 6,
    bevelEnabled: true, bevelSegments: 1, bevelSize: 0.004, bevelThickness: 0.004,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function spearShape(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(-0.071, 0);
  shape.lineTo(-0.060, 0.37);
  shape.quadraticCurveTo(-0.035, 0.47, -0.007, 0.552);
  shape.quadraticCurveTo(0, 0.570, 0.007, 0.552);
  shape.quadraticCurveTo(0.035, 0.47, 0.060, 0.37);
  shape.lineTo(0.071, 0);
  shape.closePath();
  return shape;
}

/** 两侧分别描路径，保持正变换；月牙上侧的凹口留为空气。 */
function crescentShape(side: number): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(side * 0.055, 1.365);
  shape.quadraticCurveTo(side * 0.290, 1.370, side * 0.385, 1.525);
  shape.quadraticCurveTo(side * 0.431, 1.680, side * 0.355, 1.800);
  shape.quadraticCurveTo(side * 0.345, 1.822, side * 0.333, 1.790);
  shape.quadraticCurveTo(side * 0.296, 1.590, side * 0.070, 1.575);
  shape.quadraticCurveTo(side * 0.046, 1.465, side * 0.055, 1.365);
  shape.closePath();
  return shape;
}

function crescentGlint(side: number): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(side * 0.122, 1.407);
  shape.quadraticCurveTo(side * 0.312, 1.453, side * 0.366, 1.605);
  shape.quadraticCurveTo(side * 0.356, 1.645, side * 0.345, 1.629);
  shape.quadraticCurveTo(side * 0.287, 1.485, side * 0.139, 1.459);
  shape.closePath();
  return shape;
}

/** 圆钝双月牙、短紫系带、连续外斜木颈；13 个逻辑网格。 */
export function lvbuHalberd(c: PartCtx): THREE.Group {
  const root = new THREE.Group();
  root.name = 'ur-lvbu-halberd';
  // 掌心与下杆保持原锥度；仅把肩以上的杆弯向外侧接刀头。
  root.add(at(solid(cyl(0.035, 0.035 - 0.005 * 0.975 / 1.78, 0.975), toon('#654430'), 0.010), 0, 0.1375));
  root.add(at(solid(cyl(0.046, 0.046, 0.20), toon(c.pal.sub), 0.008), 0, -0.035));
  root.add(at(solid(cyl(0.057, 0.057, 0.055), toon(c.pal.trim), 0.008), 0, 0.095));

  const head = new THREE.Group();
  head.name = 'halberd-head';
  head.rotation.set(0, 0.12, 0.80);
  const pivot = new THREE.Vector3(0, 0.50, 0);
  head.position.copy(pivot.clone().sub(pivot.clone().applyQuaternion(head.quaternion)));
  root.add(head);
  head.add(at(solid(plate(spearShape()), toon(STEEL), 0.012), 0, 1.34));
  for (const side of [-1, 1]) head.add(solid(plate(crescentShape(side)), toon(STEEL), 0.012));
  head.add(at(solid(sphere(0.115, 1.30, 0.43, 0.58, 12), toon(c.pal.trim), 0.009), 0, 1.398));

  const spearLight = new THREE.Shape();
  spearLight.moveTo(-0.020, 1.405);
  spearLight.lineTo(-0.022, 1.718);
  spearLight.quadraticCurveTo(-0.015, 1.818, 0, 1.873);
  spearLight.lineTo(0.009, 1.422);
  spearLight.closePath();
  const light = join([plate(spearLight, 0.006), ...[-1, 1].map((side) => plate(crescentGlint(side), 0.006))]);
  head.add(at(new THREE.Mesh(light, toon(STEEL_LIGHT)), 0, 0, 0.034));

  const shade = new THREE.Shape();
  shade.moveTo(0.036, 1.407);
  shade.lineTo(0.043, 1.696);
  shade.quadraticCurveTo(0.040, 1.754, 0.029, 1.782);
  shade.lineTo(0.026, 1.416);
  shade.closePath();
  head.add(at(new THREE.Mesh(plate(shade, 0.006), toon(STEEL_SHADOW)), 0, 0, 0.034));
  head.add(at(solid(cyl(0.057, 0.057, 0.055), toon(c.pal.trim), 0.008), 0, 1.325));

  const ribbon = new THREE.Shape();
  ribbon.moveTo(0.014, 1.284);
  ribbon.quadraticCurveTo(0.164, 1.322, 0.376, 1.239);
  ribbon.quadraticCurveTo(0.316, 1.166, 0.242, 1.174);
  ribbon.quadraticCurveTo(0.145, 1.192, 0.014, 1.220);
  ribbon.closePath();
  head.add(at(solid(plate(ribbon, 0.034), toon(c.pal.main), 0.009), 0, 0, -0.016));
  // 木颈两端埋入下杆和刀座；接头与曲管同材质合并，根仍在掌心。
  const end = new THREE.Vector3(0, 1.36, 0).applyQuaternion(head.quaternion).add(head.position);
  const neckCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.60, 0), new THREE.Vector3(end.x * 0.5, 0.73, end.z * 0.5), end,
  ]);
  const joint = sphere(0.046, 1, 1, 1, 12); joint.translate(0, 0.60, 0);
  const neck = solid(join([new THREE.TubeGeometry(neckCurve, 12, 0.034, 8, false), joint]), toon('#654430'), 0.009);
  neck.name = 'halberd-neck';
  root.add(neck);
  root.add(at(solid(sphere(0.051, 1, 0.60, 1, 12), toon(c.pal.trim), 0.008), 0, -0.335));
  return root;
}

/** 木质卵棒头、双骨箍和七颗短圆齿；17 个逻辑网格。 */
export function menghuoMace(c: PartCtx): THREE.Group {
  const root = new THREE.Group();
  root.name = 'ur-menghuo-mace';
  root.add(at(solid(cyl(0.038, 0.047, 0.90), toon(c.pal.sub), 0.010), 0, 0.175));
  root.add(at(solid(cyl(0.048, 0.048, 0.22), toon(mix(c.pal.main, c.pal.sub, 0.48)), 0.008), 0, -0.01));
  for (const y of [-0.125, 0.11]) {
    root.add(at(solid(cyl(0.054, 0.054, 0.021), toon(c.pal.trim), 0.007), 0, y));
  }
  // 掌心握段保留原位；棒头略缩短并朝杆外侧让开，低举 / 受击时不扫入头部。
  const head = new THREE.Group();
  head.name = 'mace-head';
  head.position.set(-0.30, 0.55 - 0.80 * 0.449, 0);
  head.scale.y = 0.80;
  root.add(head);
  head.add(at(solid(sphere(0.22, 1, 1.55, 0.92, 16), toon(c.pal.sub), 0.012), 0, 0.79));
  for (const [y, radius] of [[0.595, 0.184], [1.015, 0.164]]) {
    const band = solid(new THREE.TorusGeometry(radius, 0.025, 6, 16), toon(c.pal.trim), 0.007);
    band.rotation.x = Math.PI / 2;
    head.add(at(band, 0, y));
  }

  // 齿两层错开，胶囊的内端埋入木头；没有锥形尖刺。
  for (let layer = 0; layer < 2; layer++) {
    for (let i = 0; i < 3; i++) {
      // 上层前齿略绕向杆外侧，给 dash 时的头侧保留描边间隙。
      const angle = i * Math.PI * 2 / 3 + layer * Math.PI / 3 + (layer && i === 0 ? 0.70 : 0);
      const direction = new THREE.Vector3(Math.cos(angle), 0.18, Math.sin(angle)).normalize();
      const tooth = solid(capsule(0.044, layer ? 0.120 : 0.152, 10), toon(c.pal.trim), 0.008);
      tooth.name = 'mace-bone-tooth';
      tooth.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
      head.add(at(tooth, Math.cos(angle) * (layer ? 0.225 : 0.237), layer ? 0.967 : 0.673, Math.sin(angle) * (layer ? 0.202 : 0.214)));
    }
  }
  const crownTooth = solid(capsule(0.046, 0.15, 10), toon(c.pal.trim), 0.008);
  crownTooth.name = 'mace-bone-tooth';
  head.add(at(crownTooth, 0, 1.175));
  root.add(at(solid(sphere(0.051, 1, 0.5, 1, 12), toon(c.pal.trim), 0.008), 0, -0.265));
  const grainLight = new THREE.SphereGeometry(0.223, 8, 10, 1.23, 0.34, 0.37, 2.15);
  grainLight.scale(1, 1.55, 0.92);
  head.add(at(new THREE.Mesh(grainLight, toon(mix(c.pal.sub, '#edc88e', 0.24))), 0, 0.79));
  // 两端埋入杆与木卵；圆接头封住曲管开口，同色合并为一个逻辑网格。
  const neckCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.60, 0), new THREE.Vector3(-0.15, 0.62, 0), new THREE.Vector3(-0.30, 0.64, 0),
  ]);
  const neck = new THREE.TubeGeometry(neckCurve, 12, 0.036, 8, false);
  const joint = sphere(0.046, 1, 1, 1, 12); joint.translate(0, 0.60, 0);
  const bridge = solid(join([neck, joint]), toon(c.pal.sub), 0.009);
  bridge.name = 'mace-neck';
  root.add(bridge);
  return root;
}

function staffTip(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(-0.036, 0);
  shape.quadraticCurveTo(-0.024, 0.052, -0.006, 0.095);
  shape.quadraticCurveTo(0, 0.106, 0.006, 0.095);
  shape.quadraticCurveTo(0.024, 0.052, 0.036, 0);
  shape.closePath();
  return shape;
}

/** 镂空金环、实托青珠、短悬珠 / 青穗与连续木颈；17 个逻辑网格。 */
export function zuociStaff(c: PartCtx): THREE.Group {
  const root = new THREE.Group();
  root.name = 'ur-zuoci-staff';
  // 掌心及下杆保持原锥度，上段转向肩外的环座；孔内只有实体托座。
  root.add(at(solid(cyl(0.034, 0.034 - 0.004 * 0.945 / 1.47, 0.945), toon(mix(c.pal.sub, '#765032', 0.70)), 0.009), 0, 0.1525));
  root.add(at(solid(cyl(0.045, 0.045, 0.19), toon(c.pal.sub), 0.008), 0, -0.01));
  for (const y of [-0.113, 0.094]) {
    root.add(at(solid(cyl(0.051, 0.051, 0.024), toon(c.pal.trim), 0.007), 0, y));
  }

  const head = new THREE.Group();
  head.name = 'staff-ring-head';
  head.rotation.set(0, 0.12, 0.90);
  const pivot = new THREE.Vector3(0, 0.50, 0);
  head.position.copy(pivot.clone().sub(pivot.clone().applyQuaternion(head.quaternion)));
  root.add(head);
  head.add(at(solid(new THREE.TorusGeometry(0.22, 0.028, 6, 20), toon(c.pal.trim), 0.007), 0, 1.368));
  const support = new THREE.LatheGeometry([
    new THREE.Vector2(0, 1.118), new THREE.Vector2(0.034, 1.118),
    new THREE.Vector2(0.035, 1.220), new THREE.Vector2(0.067, 1.255),
    new THREE.Vector2(0.074, 1.281), new THREE.Vector2(0.056, 1.287),
    new THREE.Vector2(0, 1.275),
  ], 12);
  head.add(solid(support, toon(c.pal.trim), 0.006));
  head.add(at(solid(sphere(0.108, 1, 1, 1, 16), toon(mix(c.pal.main, '#b6f1e4', 0.14)), 0.009), 0, 1.38));
  head.add(at(new THREE.Mesh(sphere(0.025, 0.68, 1, 0.25, 10), toon('#e9fff6')), -0.038, 1.419, 0.098));
  head.add(at(solid(plate(staffTip(), 0.040), toon(c.pal.trim), 0.007), 0, 1.598));
  for (const side of [-1, 1]) {
    const string = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(side * 0.163, 1.219, 0),
      new THREE.Vector3(side * 0.225, 1.188, 0.008),
      new THREE.Vector3(side * 0.268, 1.136, 0.015),
    );
    head.add(new THREE.Mesh(new THREE.TubeGeometry(string, 8, 0.009, 6, false), toon(c.pal.trim)));
    head.add(at(solid(sphere(0.044, 1, 1, 1, 12), toon(c.pal.trim), 0.007), side * 0.268, 1.111, 0.015));
  }

  head.add(at(solid(sphere(0.048, 1, 0.78, 0.72, 12), toon(c.pal.main), 0.007), 0, 1.024, 0.049));
  const tassel = new THREE.Shape();
  tassel.moveTo(-0.040, 1.010);
  tassel.quadraticCurveTo(-0.060, 0.894, -0.063, 0.736);
  tassel.quadraticCurveTo(0, 0.717, 0.065, 0.733);
  tassel.quadraticCurveTo(0.050, 0.896, 0.041, 1.010);
  tassel.closePath();
  head.add(at(solid(plate(tassel, 0.042), toon(c.pal.main), 0.007), 0, 0, 0.058));
  const folds = [-1, 1].map((side) => new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(side * 0.014, 0.993, 0.087),
    new THREE.Vector3(side * 0.020, 0.864, 0.087),
    new THREE.Vector3(side * 0.025, 0.752, 0.087),
  ), 8, 0.006, 6, false));
  head.add(new THREE.Mesh(join(folds), toon(mix(c.pal.main, c.pal.sub, 0.55))));
  const end = new THREE.Vector3(0, 1.145, 0).applyQuaternion(head.quaternion).add(head.position);
  const neckCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.60, 0), new THREE.Vector3(end.x * 0.5, 0.73, end.z * 0.5), end,
  ]);
  const joint = sphere(0.046, 1, 1, 1, 12); joint.translate(0, 0.60, 0);
  const neck = solid(join([new THREE.TubeGeometry(neckCurve, 12, 0.030, 8, false), joint]), toon(mix(c.pal.sub, '#765032', 0.70)), 0.007);
  neck.name = 'staff-neck';
  root.add(neck);
  return root;
}
