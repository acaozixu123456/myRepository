// 魏族 SSR 独有战器；掌心根保持单位变换，主副手均沿 +y 持握。
import * as THREE from 'three';
import { capsule, solid, sphere, toon } from '../toon';
import type { PartCtx } from './types';

const STEEL = '#d8e2ee';
const STEEL_LIGHT = '#f3f8fc';
const STEEL_SHADE = '#a5bbd0';
const WOOD = '#80542f';
const BONE = '#f0e0b7';
const cyl = (bottom: number, top: number, height: number, segments = 12) => new THREE.CylinderGeometry(top, bottom, height, segments);
function at<T extends THREE.Object3D>(o: T, x: number, y: number, z = 0): T {
  o.position.set(x, y, z);
  return o;
}
function plate(shape: THREE.Shape, depth = 0.052): THREE.ExtrudeGeometry {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, steps: 1, curveSegments: 6,
    bevelEnabled: true, bevelSegments: 1, bevelSize: 0.005, bevelThickness: 0.004,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}
function leaf(length: number, width: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(-width * 0.56, length * 0.12, -width * 0.44, length * 0.50);
  s.quadraticCurveTo(-width * 0.29, length * 0.82, -0.007, length * 0.99);
  s.quadraticCurveTo(0, length * 1.012, 0.007, length * 0.99);
  s.quadraticCurveTo(width * 0.29, length * 0.82, width * 0.44, length * 0.50);
  s.quadraticCurveTo(width * 0.56, length * 0.12, 0, 0);
  return s;
}

/** 柳叶冷钢、金枪座和短蓝穗；14 个逻辑网格。 */
export function xiahouSpear(c: PartCtx): THREE.Group {
  const root = new THREE.Group();
  root.name = 'ssr-xiahou-spear';
  // 下杆仍贯穿掌心，保留原长矛的最低点；上杆自然接向肩外。
  root.add(at(solid(cyl(0.04, 0.04, 1.10, 10), toon(WOOD), 0.010), 0, 0.11));
  root.add(at(solid(cyl(0.036, 0.036, 0.22, 10), toon(c.pal.sub), 0.005), 0, -0.025));
  for (const y of [-0.145, 0.095]) root.add(at(solid(cyl(0.038, 0.038, 0.026, 10), toon(c.pal.trim), 0.007), 0, y));
  root.add(at(solid(sphere(0.038, 1, 0.55, 1, 12), toon(c.pal.trim), 0.006), 0, -0.40));

  const head = new THREE.Group();
  head.name = 'spear-head';
  head.rotation.set(0, 0.10, 0.45);
  const pivot = new THREE.Vector3(0, 0.55, 0);
  head.position.copy(pivot.clone().sub(pivot.clone().applyQuaternion(head.quaternion)));
  root.add(head);
  head.add(at(solid(plate(leaf(0.59, 0.20)), toon(STEEL), 0.010), 0, 1.43));
  const ridge = new THREE.Shape();
  ridge.moveTo(-0.015, 0.08); ridge.lineTo(-0.014, 0.39);
  ridge.quadraticCurveTo(-0.010, 0.49, 0, 0.567);
  ridge.lineTo(0.018, 0.12); ridge.closePath();
  head.add(at(new THREE.Mesh(plate(ridge, 0.009), toon(STEEL_LIGHT)), 0, 1.43, 0.033));
  const edge = new THREE.Shape();
  edge.moveTo(0.035, 0.07); edge.quadraticCurveTo(0.089, 0.24, 0.064, 0.35);
  edge.lineTo(0.034, 0.47); edge.lineTo(0.040, 0.17); edge.closePath();
  head.add(at(new THREE.Mesh(plate(edge, 0.007), toon(STEEL_SHADE)), 0, 1.43, 0.033));
  head.add(at(solid(cyl(0.062, 0.045, 0.16), toon(c.pal.trim), 0.008), 0, 1.43));
  head.add(at(solid(cyl(0.071, 0.071, 0.028), toon(c.pal.trim), 0.007), 0, 1.36));
  for (const side of [-1, 1]) {
    const tassel = new THREE.Shape();
    tassel.moveTo(side * 0.015, 1.35);
    tassel.quadraticCurveTo(side * 0.13, 1.30, side * 0.16, 1.15);
    tassel.quadraticCurveTo(side * 0.10, 1.17, side * 0.064, 1.22);
    tassel.lineTo(side * 0.015, 1.32); tassel.closePath();
    head.add(at(solid(plate(tassel, 0.030), toon(c.pal.main), 0.008), 0, 0, -0.024));
  }
  head.add(at(solid(sphere(0.055, 1.3, 0.75, 0.75, 12), toon(c.pal.main), 0.008), 0, 1.34));
  const end = new THREE.Vector3(0, 1.37, 0).applyQuaternion(head.quaternion).add(head.position);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.63, 0), new THREE.Vector3(end.x * 0.45, 0.90, end.z * 0.45), end,
  ]);
  const neck = solid(new THREE.TubeGeometry(curve, 14, 0.038, 8, false), toon(WOOD), 0.009);
  neck.name = 'spear-wood-neck';
  root.add(neck);
  return root;
}

/** 长卵木棒与宽金箍，短钝骨齿；和孟喵获的短卵骨箍区分。 */
export function xuhuBoneMace(c: PartCtx): THREE.Group {
  const root = new THREE.Group();
  root.name = 'ssr-xuhu-bone-mace';
  // 掌心和下杆收在原底版直杆范围内，举棒时不增加后颅占据。
  root.add(at(solid(cyl(0.04, 0.04, 0.74, 10), toon(WOOD), 0.010), 0, 0.13));
  root.add(at(solid(cyl(0.036, 0.036, 0.23, 10), toon(c.pal.main), 0.005), 0, -0.02));
  for (const y of [-0.145, 0.105]) root.add(at(solid(cyl(0.038, 0.038, 0.022, 10), toon(c.pal.trim), 0.007), 0, y));
  root.add(at(solid(sphere(0.038, 1, 0.55, 1, 12), toon(c.pal.trim), 0.006), 0, -0.20));
  const head = new THREE.Group();
  head.name = 'mace-wood-head';
  head.position.set(-0.36, 0.45, 0);
  head.rotation.z = 0.10;
  root.add(head);
  head.add(at(solid(sphere(0.23, 1, 1.55, 0.94, 16), toon(WOOD), 0.012), 0, 0.36));
  for (const [y, bottom, top] of [[0.20, 0.208, 0.224], [0.55, 0.207, 0.186]]) {
    const band = solid(cyl(bottom, top, 0.055), toon(c.pal.trim), 0.008);
    band.name = 'mace-gold-band';
    head.add(at(band, 0, y));
  }
  for (let layer = 0; layer < 2; layer++) {
    const y = layer ? 0.57 : 0.16;
    for (let i = 0; i < 3; i++) {
      const angle = i * Math.PI * 2 / 3 + layer * Math.PI / 3;
      const radius = layer ? 0.205 : 0.225;
      const direction = new THREE.Vector3(Math.cos(angle), 0.18, Math.sin(angle)).normalize();
      const tooth = solid(capsule(0.036, 0.105, 10), toon(BONE), 0.008);
      tooth.name = 'mace-bone-tooth';
      tooth.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
      head.add(at(tooth, Math.cos(angle) * radius, y, Math.sin(angle) * radius * 0.94));
    }
  }
  const topTooth = solid(capsule(0.038, 0.13, 10), toon(BONE), 0.008);
  topTooth.name = 'mace-bone-tooth';
  head.add(at(topTooth, 0, 0.75));
  const end = new THREE.Vector3(0, 0.10, 0).applyQuaternion(head.quaternion).add(head.position);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.50, 0), new THREE.Vector3(-0.17, 0.63, 0), end,
  ]);
  const neck = solid(new THREE.TubeGeometry(curve, 12, 0.041, 8, false), toon(WOOD), 0.006);
  neck.name = 'mace-wood-neck';
  root.add(neck);
  return root;
}

function shortBlade(length: number, width: number, side: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(side * -width * 0.43, 0);
  s.quadraticCurveTo(side * -width * 0.66, length * 0.54, side * -width * 0.24, length * 0.90);
  s.quadraticCurveTo(side * -width * 0.10, length * 1.04, side * width * 0.05, length);
  s.quadraticCurveTo(side * width * 0.73, length * 0.73, side * width * 0.47, length * 0.10);
  s.quadraticCurveTo(side * width * 0.46, 0, side * width * 0.35, 0); s.closePath();
  return s;
}
function zhangliaoBlade(c: PartCtx, side: number): THREE.Group {
  const root = new THREE.Group();
  root.name = side > 0 ? 'ssr-zhangliao-blade-main' : 'ssr-zhangliao-blade-off';
  // 采用已通过双短刀的握段与外展刀座尺寸，主副手分别构建，不用负节点缩放。
  root.add(at(solid(cyl(0.038, 0.041, 0.19, 10), toon(c.pal.main), 0.010), 0, -0.05));
  for (const y of [-0.105, 0.025]) root.add(at(solid(cyl(0.044, 0.044, 0.018, 10), toon(c.pal.sub), 0.007), 0, y));
  root.add(at(solid(sphere(0.070, 1, 0.65, 0.65, 12), toon(c.pal.trim), 0.010), 0, -0.20));
  const top = new THREE.Group();
  top.name = 'blade-mount';
  top.position.set(-side * 0.275, 0.080, 0);
  top.rotation.set(0, side * 0.20, side * 0.43);
  root.add(top);
  const curve = new THREE.CubicBezierCurve3(
    new THREE.Vector3(0, 0.024, 0), new THREE.Vector3(0, 0.082, 0),
    new THREE.Vector3(-side * 0.275 * 0.74, 0.025, 0), new THREE.Vector3(-side * 0.275, 0.080, 0),
  );
  const neck = solid(new THREE.TubeGeometry(curve, 10, 0.024, 8, false), toon(c.pal.trim), 0.008);
  neck.name = 'blade-metal-neck';
  root.add(neck);
  // 短曲叶护口保持通过版的包络，银色刀缘与蓝柄承担专属配色。
  const guard = plate(leaf(0.085, 0.34), 0.065);
  guard.scale(0.58, 1, 1); guard.translate(-side * 0.045, 0, 0);
  top.add(solid(guard, toon(c.pal.trim), 0.009));
  top.add(at(solid(cyl(0.056, 0.044, 0.055, 10), toon(c.pal.trim), 0.008), 0, 0.073));
  const length = side > 0 ? 0.59 : 0.60;
  top.add(at(solid(plate(shortBlade(length, 0.24, side), 0.058), toon(STEEL), 0.011), 0, 0.104));
  const ridge = new THREE.Shape();
  ridge.moveTo(side * -0.038, 0.04);
  ridge.quadraticCurveTo(side * -0.07, length * 0.47, side * -0.007, length * 0.91);
  ridge.quadraticCurveTo(side * 0.029, length * 0.57, side * 0.012, 0.08);
  ridge.closePath();
  top.add(at(new THREE.Mesh(plate(ridge, 0.007), toon(STEEL_LIGHT)), 0, 0.104, 0.034));
  const edge = new THREE.Shape();
  edge.moveTo(side * 0.055, 0.04);
  edge.quadraticCurveTo(side * 0.125, length * 0.32, side * 0.084, length * 0.61);
  edge.lineTo(side * 0.041, length * 0.80);
  edge.quadraticCurveTo(side * 0.091, length * 0.32, side * 0.037, 0.09);
  edge.closePath();
  top.add(at(new THREE.Mesh(plate(edge, 0.007), toon(STEEL_SHADE)), 0, 0.104, 0.034));
  return root;
}

/** 银护口与宽短微弯刀面；主副手各10，总20个逻辑网格。 */
export function zhangliaoDualBlades(c: PartCtx): THREE.Group {
  const root = zhangliaoBlade(c, 1);
  root.userData.offhand = zhangliaoBlade(c, -1);
  return root;
}
