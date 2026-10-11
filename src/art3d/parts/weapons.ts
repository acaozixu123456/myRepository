// 武器：握在 handR（掌心原点，杆沿 +y，刀面朝 +z）。双持类武器在 userData.offhand 里再给一把，挂到 handL。
import * as THREE from 'three';
import { solid, sphere, toon } from '../toon';
import type { PartBuilder, PartCtx } from './types';

const STEEL = '#d8e2ee';
const WOOD = '#8a5a34';
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (r0: number, r1: number, h: number, seg = 10) => new THREE.CylinderGeometry(r1, r0, h, seg);
function at<T extends THREE.Object3D>(o: T, x: number, y: number, z = 0): T { o.position.set(x, y, z); return o; }

function swordObj(c: PartCtx, len = 1.05): THREE.Group {
  const g = new THREE.Group();
  g.add(at(solid(cyl(0.045, 0.045, 0.34), toon('#4a3028'), 0.015), 0, 0));
  g.add(at(solid(box(0.34, 0.07, 0.09), toon(c.pal.trim), 0.015), 0, 0.2));
  g.add(at(solid(box(0.15, len, 0.07), toon(STEEL), 0.015), 0, 0.23 + len / 2));
  const tip = solid(new THREE.ConeGeometry(0.0925, 0.2, 4), toon(STEEL), 0.015);
  tip.rotation.y = Math.PI / 4; tip.scale.set(1, 1, 0.38);
  g.add(at(tip, 0, 0.23 + len + 0.08));
  g.add(at(solid(sphere(0.06), toon(c.pal.trim), 0.012), 0, -0.2));
  return g;
}

/** 双刃剑与单刃短刀都用圆钝曲线收尖，薄片正面仍朝 +z。 */
function bladeShape(length: number, width: number, curved = false): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-width * 0.43, 0);
  if (curved) {
    s.quadraticCurveTo(-width * 0.66, length * 0.54, -width * 0.24, length * 0.90);
    s.quadraticCurveTo(-width * 0.10, length * 1.04, width * 0.05, length);
    s.quadraticCurveTo(width * 0.73, length * 0.73, width * 0.47, length * 0.10);
    s.quadraticCurveTo(width * 0.46, 0, width * 0.35, 0);
  } else {
    s.lineTo(-width * 0.40, length * 0.76);
    s.quadraticCurveTo(-width * 0.34, length * 0.90, -width * 0.025, length);
    s.quadraticCurveTo(0, length * 1.012, width * 0.025, length);
    s.quadraticCurveTo(width * 0.34, length * 0.90, width * 0.40, length * 0.76);
    s.lineTo(width * 0.43, 0);
  }
  s.closePath();
  return s;
}

function swordGuard(paired: boolean): THREE.Shape {
  const s = new THREE.Shape();
  const w = paired ? 0.22 : 0.20;
  s.moveTo(-w, -0.015);
  s.quadraticCurveTo(-w - 0.025, 0.05, -w * 0.75, paired ? 0.092 : 0.07);
  s.quadraticCurveTo(-w * 0.52, 0.06, -0.065, 0.035);
  s.lineTo(0.065, 0.035);
  s.quadraticCurveTo(w * 0.52, 0.06, w * 0.75, paired ? 0.092 : 0.07);
  s.quadraticCurveTo(w + 0.025, 0.05, w, -0.015);
  s.quadraticCurveTo(0, -0.055, -w, -0.015);
  return s;
}

function outwardNeck(c: PartCtx, side: number, x: number, y: number): THREE.Mesh {
  const curve = new THREE.CubicBezierCurve3(
    new THREE.Vector3(0, 0.024, 0), new THREE.Vector3(0, 0.082, 0),
    new THREE.Vector3(-side * x * 0.74, y - 0.055, 0), new THREE.Vector3(-side * x, y, 0),
  );
  const neck = solid(new THREE.TubeGeometry(curve, 10, 0.024, 8, false), toon(c.pal.trim), 0.008);
  neck.name = 'outward-neck';
  return neck;
}

function refinedBladeObj(c: PartCtx, kind: 'sword' | 'dualSwords' | 'dualBlades', side = 1): THREE.Group {
  const g = new THREE.Group();
  g.name = kind;
  const short = kind === 'dualBlades', paired = kind === 'dualSwords';
  const length = short ? 0.61 : paired ? (side > 0 ? 1.02 : 0.90) : 1.17;
  const width = short ? 0.25 : paired ? 0.19 : 0.17;
  // 握段穿掌心，缠带和圆首尾端露在肉垫两侧；不平移整个根物体。
  g.add(at(solid(cyl(0.038, 0.041, 0.19, 10), toon(c.pal.sub), 0.010), 0, -0.05));
  for (const y of [-0.105, 0.025]) g.add(at(solid(cyl(0.044, 0.044, 0.018, 10), toon(c.pal.main), 0.007), 0, y));
  g.add(at(solid(sphere(0.071, 1, 0.75, 0.68, 12), toon(c.pal.trim), 0.011), 0, -0.20));
  g.add(at(solid(sphere(0.024, 1, 1, 0.45, 10), toon(c.pal.main), 0.005), 0, -0.20, 0.045));

  const top = new THREE.Group();
  top.name = 'blade-mount';
  const reach = short ? 0.275 : 0.25;
  top.position.set(-side * reach, 0.080, 0);
  g.add(outwardNeck(c, side, reach, 0.080));
  // 肩外侧拔剑；副手镜像外倾，避免两剑在刘喵备脸前交叉。
  top.rotation.set(0, side * 0.20, side * (short ? 0.43 : 0.55));
  g.add(top);
  const guard = short ? leafShape(0.085, 0.34) : swordGuard(paired);
  const guardGeo = petal(guard, 0.065);
  // 内侧护手收短，保留肩外的圆钝护翼，不为护手再折弯剑身。
  guardGeo.scale(0.58, 1, 1); guardGeo.translate(-side * 0.045, 0, 0);
  top.add(solid(guardGeo, toon(c.pal.trim), 0.011));
  top.add(at(solid(cyl(0.068, 0.057, 0.060, 10), toon(c.pal.trim), 0.008), 0, 0.075));
  top.add(at(solid(petal(bladeShape(length, width, short), 0.058), toon(STEEL), 0.013), 0, 0.104));
  const glint = new THREE.Shape();
  glint.moveTo(-width * 0.18, 0.05);
  glint.quadraticCurveTo(-width * (short ? 0.40 : 0.18), length * 0.55, -width * 0.025, length * 0.93);
  glint.quadraticCurveTo(width * 0.07, length * 0.73, width * 0.03, length * 0.12);
  glint.closePath();
  top.add(at(new THREE.Mesh(petal(glint, 0.008), toon('#f5faff')), 0, 0.104, 0.036));
  if (!short) {
    const edge = new THREE.Shape();
    edge.moveTo(width * 0.16, 0.03); edge.lineTo(width * 0.30, 0.03);
    edge.lineTo(width * 0.30, length * 0.70);
    edge.quadraticCurveTo(width * 0.20, length * 0.81, width * 0.07, length * 0.87);
    edge.lineTo(width * 0.16, 0.03);
    top.add(at(new THREE.Mesh(petal(edge, 0.008), toon('#a9bdd6')), 0, 0.104, 0.035));
    top.add(at(solid(sphere(0.029, 1, 0.80, 0.45, 10), toon(c.pal.trim), 0.006), 0, 0.19, 0.043));
  }
  return g;
}

function throwingKnifeObj(c: PartCtx, side: number, spread = 0): THREE.Group {
  const g = new THREE.Group();
  g.name = 'throwing-knife';
  g.add(at(solid(cyl(0.033, 0.036, 0.146, 8), toon(c.pal.main), 0.0075), 0, -0.047));
  for (const y of [-0.095, 0.014]) g.add(at(solid(cyl(0.038, 0.038, 0.015, 8), toon(c.pal.sub), 0.006), 0, y));
  const ring = solid(new THREE.TorusGeometry(0.035, 0.012, 6, 12), toon(c.pal.trim), 0.007);
  g.add(at(ring, 0, -0.168));
  const blade = new THREE.Group();
  blade.name = 'knife-blade-mount';
  blade.position.set(-side * 0.30, 0.070, 0);
  blade.rotation.set(0, side * 0.18, side * 0.38 + spread);
  blade.add(solid(sphere(0.082, 1, 0.27, 0.60, 12), toon(c.pal.trim), 0.008));
  blade.add(at(solid(petal(bladeShape(0.65, 0.18), 0.048), toon(STEEL), 0.011), 0, 0.02));
  const glint = new THREE.Shape();
  glint.moveTo(-0.022, 0.075); glint.lineTo(-0.017, 0.40);
  glint.quadraticCurveTo(-0.014, 0.54, 0, 0.62);
  glint.lineTo(0.015, 0.085); glint.closePath();
  blade.add(at(new THREE.Mesh(petal(glint, 0.006), toon('#f5faff')), 0, 0.02, 0.031));
  g.add(outwardNeck(c, side, 0.30, 0.070));
  g.add(blade);
  return g;
}

function knivesObj(c: PartCtx): THREE.Object3D {
  const main = throwingKnifeObj(c, 1);
  main.name = 'knives';
  const off = new THREE.Group();
  off.name = 'knife-reserve';
  // 两柄飞刀的握段都穿过副手掌球，不把刀片悬浮在头旁。
  for (const side of [-1, 1]) {
    const knife = throwingKnifeObj(c, -1, side * 0.23);
    knife.position.set(side * 0.032, 0, side * 0.010);
    off.add(knife);
  }
  main.userData.offhand = off;
  return main;
}
function pole(c: PartCtx, len: number, head: THREE.Object3D, col = WOOD): THREE.Group {
  const g = new THREE.Group();
  g.add(at(solid(cyl(0.04, 0.04, len), toon(col), 0.015), 0, len * 0.3));
  head.position.y = len * 0.8;
  g.add(head);
  void c;
  return g;
}
const bladeHead = (c: PartCtx, w: number, h: number, curved = false): THREE.Group => {
  const g = new THREE.Group();
  const b = solid(box(w, h, 0.04), toon(STEEL), 0.015);
  b.position.set(curved ? w * 0.45 : 0, h * 0.4, 0);
  g.add(b);
  g.add(at(solid(sphere(0.08), toon(c.pal.trim), 0.012), 0, 0));
  return g;
};
// 弩仍使用原来的底版；精修长弓不顺带改变其他进度项。
function simpleBowObj(c: PartCtx): THREE.Group {
  const g = new THREE.Group();
  const arc = solid(new THREE.TorusGeometry(0.62, 0.035, 6, 24, Math.PI * 0.9), toon('#7a4a2a'), 0.015);
  arc.rotation.z = Math.PI / 2 - Math.PI * 0.45;
  g.add(at(arc, -0.5, 0.3));
  const string = new THREE.Mesh(cyl(0.006, 0.006, 1.7, 4), toon('#f3ead8'));
  g.add(at(string, -0.5 + 0.0, 0.3));
  g.add(at(solid(cyl(0.05, 0.05, 0.2), toon(c.pal.trim), 0.012), 0, 0.3));
  g.position.set(0.5, 0, 0);
  return g;
}

/** 叶 / 羽片的圆润梭形截面，根部在掌上方，尖端沿 +y。 */
function leafShape(length: number, width: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(-width * 0.56, length * 0.17, -width * 0.5, length * 0.5);
  s.quadraticCurveTo(-width * 0.4, length * 0.83, 0, length);
  s.quadraticCurveTo(width * 0.4, length * 0.83, width * 0.5, length * 0.5);
  s.quadraticCurveTo(width * 0.56, length * 0.17, 0, 0);
  return s;
}

function petal(shape: THREE.Shape, depth = 0.032): THREE.ExtrudeGeometry {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth, steps: 1, curveSegments: 5,
    bevelEnabled: true, bevelSegments: 1, bevelSize: 0.008, bevelThickness: 0.006,
  });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

function leafTipShape(length: number, width: number): THREE.Shape {
  const tip = new THREE.Shape();
  tip.moveTo(-width * 0.34925, length * 0.7646);
  tip.quadraticCurveTo(-width * 0.22, length * 0.9065, 0, length);
  tip.quadraticCurveTo(width * 0.22, length * 0.9065, width * 0.34925, length * 0.7646);
  tip.quadraticCurveTo(0, length * 0.715, -width * 0.34925, length * 0.7646);
  return tip;
}

function herbsObj(c: PartCtx): THREE.Group {
  const g = new THREE.Group();
  g.name = 'herbs';
  // 叶色保留药草的自然绿；束带及扣饰跟随使用者的阵营色。
  for (const x of [-0.023, 0, 0.023]) {
    const stem = new THREE.CurvePath<THREE.Vector3>();
    stem.add(new THREE.LineCurve3(new THREE.Vector3(x, -0.06, 0), new THREE.Vector3(x, 0.04, 0)));
    stem.add(new THREE.QuadraticBezierCurve3(new THREE.Vector3(x, 0.04, 0), new THREE.Vector3(x - 0.12, 0.14, 0), new THREE.Vector3(x - 0.32, 0.18, 0)));
    g.add(solid(new THREE.TubeGeometry(stem, 10, 0.013, 8, false), toon('#4c8747'), 0.008));
  }
  const leaves = [
    { angle: 1.15, length: 0.48, width: 0.22, z: 0.025 },
    { angle: 0.05, length: 0.50, width: 0.21, z: 0.02 },
    { angle: 0.85, length: 0.61, width: 0.20, z: -0.025 },
    { angle: 0.20, length: 0.69, width: 0.23, z: -0.03 },
    { angle: 0.55, length: 0.70, width: 0.24, z: 0.04 },
    { angle: 0.30, length: 0.76, width: 0.23, z: 0.06 },
  ];
  leaves.forEach(({ angle, length, width, z }, i) => {
    const leaf = new THREE.Group();
    leaf.name = 'herb-leaf';
    leaf.position.set(-0.32, 0.18, z * 0.4);
    leaf.rotation.set(0.12, angle * 0.12, angle + 0.20);
    leaf.add(solid(petal(leafShape(length, width)), toon(i % 2 ? '#78b854' : '#4d9650'), 0.01));
    leaf.add(new THREE.Mesh(petal(leafTipShape(length, width), 0.046), toon(i % 2 ? '#a5ce70' : '#327746')));
    // 一道浅叶脉既表现厚度，也让小尺寸下不再像几根锥体。
    leaf.add(at(new THREE.Mesh(cyl(0.006, 0.003, length * 0.78, 6), toon('#bed78a')), 0, length * 0.40, 0.024));
    g.add(leaf);
  });
  g.add(at(solid(cyl(0.047, 0.047, 0.065, 10), toon(c.pal.main), 0.009), 0, -0.025));
  g.add(at(new THREE.Mesh(cyl(0.049, 0.049, 0.014, 10), toon(c.pal.trim)), 0, 0.015));
  return g;
}

function bowObj(c: PartCtx): THREE.Group {
  const g = new THREE.Group();
  g.name = 'bow';
  // 掌心即握把中心；弦朝身体外侧，与两个弦槽精确共线。
  for (const side of [-1, 1]) {
    const limb = new THREE.CubicBezierCurve3(
      new THREE.Vector3(0, side * 0.018, 0),
      new THREE.Vector3(-0.60, side * 0.26, 0.03),
      new THREE.Vector3(-0.70, side * 0.65, 0.06),
      new THREE.Vector3(-0.39, side * 0.82, 0.06),
    );
    g.add(solid(new THREE.TubeGeometry(limb, 20, 0.032, 8, false), toon(WOOD), 0.008));
    const edge = new THREE.CatmullRomCurve3(Array.from({ length: 13 }, (_, i) => {
      const p = limb.getPoint(i / 12); p.z += 0.028; return p;
    }));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(edge, 16, 0.009, 6, false), toon('#c69356')));
    const tip = new THREE.CatmullRomCurve3(Array.from({ length: 6 }, (_, i) => limb.getPoint(0.88 + i * 0.024)));
    g.add(solid(new THREE.TubeGeometry(tip, 8, 0.054, 8, false), toon(c.pal.trim), 0.009));
  }
  g.add(solid(cyl(0.024, 0.024, 0.05, 12), toon(c.pal.main), 0.01));
  for (const y of [-0.026, 0.026]) g.add(at(solid(cyl(0.029, 0.029, 0.007, 12), toon(c.pal.trim), 0.008), 0, y));
  const string = at(new THREE.Mesh(cyl(0.009, 0.009, 1.64, 6), toon('#f3ead8')), -0.39, 0, 0.06);
  string.name = 'bowstring';
  g.add(string);
  return g;
}

function fanObj(c: PartCtx): THREE.Group {
  const g = new THREE.Group();
  g.name = 'fan';
  // 握段仍沿 +y 穿过掌心；短弯颈把扇面送到肩臂外侧。
  const handle = new THREE.CurvePath<THREE.Vector3>();
  handle.add(new THREE.LineCurve3(new THREE.Vector3(0, -0.08, 0), new THREE.Vector3(0, 0.01, 0)));
  handle.add(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0.01, 0), new THREE.Vector3(-0.10, 0.12, 0), new THREE.Vector3(-0.38, 0.24, 0)));
  g.add(solid(new THREE.TubeGeometry(handle, 16, 0.025, 8, false), toon(c.pal.sub), 0.008));
  const face = new THREE.Group();
  face.name = 'fan-face';
  face.position.set(-0.38, 0.24, 0);
  // z 轴只改扇面内的轮廓；叠加少量 x 倾角才使 strike 时露出羽片正面。
  // 以扇骨汇合点为轴，保留掌心握段与弯颈原位。
  face.rotation.set(0.28, 0, Math.PI / 12);
  g.add(face);
  const angles = [-1.07, -0.72, -0.36, 0, 0.36, 0.72, 1.07];
  angles.forEach((angle) => {
    const length = 0.66 - Math.abs(angle) * 0.12, width = 0.20;
    const feather = new THREE.Group();
    feather.name = 'fan-feather';
    feather.position.set(0, 0, -Math.abs(angle) * 0.018);
    feather.rotation.set(0.22, angle * 0.14, angle + 0.60);
    feather.add(solid(petal(leafShape(length, width)), toon('#f6efe0'), 0.01));
    // 取梭形上段的同一条贝塞尔曲线，羽尖色块紧贴羽片，不伸出轮廓。
    feather.add(new THREE.Mesh(petal(leafTipShape(length, width), 0.046), toon(c.pal.main)));
    feather.add(at(new THREE.Mesh(cyl(0.006, 0.004, length * 0.70, 6), toon(c.pal.trim)), 0, length * 0.36, 0.024));
    face.add(feather);
  });
  face.add(at(solid(sphere(0.09, 1, 0.72, 0.45, 12), toon(c.pal.trim), 0.012), 0, 0, 0.02));
  g.add(at(solid(cyl(0.045, 0.045, 0.025, 10), toon(c.pal.trim), 0.008), 0, -0.08));
  return g;
}

const mk = (f: (c: PartCtx) => THREE.Object3D): PartBuilder => f;
const withOff = (main: THREE.Object3D, off: THREE.Object3D): THREE.Object3D => { main.userData.offhand = off; return main; };

export const WEAPON: Record<string, PartBuilder> = {
  sword: mk((c) => refinedBladeObj(c, 'sword')),
  dualSwords: mk((c) => withOff(refinedBladeObj(c, 'dualSwords'), refinedBladeObj(c, 'dualSwords', -1))),
  dualBlades: mk((c) => withOff(refinedBladeObj(c, 'dualBlades'), refinedBladeObj(c, 'dualBlades', -1))),
  dagger: mk((c) => swordObj(c, 0.45)),
  glaive: mk((c) => pole(c, 2.1, bladeHead(c, 0.34, 0.8, true))),
  spear: mk((c) => pole(c, 2.2, (() => { const t = solid(new THREE.ConeGeometry(0.1, 0.5, 4), toon(STEEL), 0.015); t.position.y = 0.2; const g = new THREE.Group(); g.add(t); return g; })())),
  halberd: mk((c) => pole(c, 2.2, (() => { const g = new THREE.Group(); g.add(at(solid(new THREE.ConeGeometry(0.08, 0.5, 4), toon(STEEL), 0.015), 0, 0.2)); for (const s of [1, -1]) g.add(at(solid(box(0.28, 0.1, 0.035), toon(STEEL), 0.015), s * 0.15, 0.0)); return g; })())),
  axe: mk((c) => pole(c, 1.9, (() => { const g = new THREE.Group(); g.add(at(solid(box(0.4, 0.5, 0.05), toon(STEEL), 0.015), 0.2, 0, 0)); return g; })())),
  mace: mk((c) => pole(c, 1.2, at(solid(sphere(0.2), toon('#8a7a68'), 0.02), 0, 0.05))),
  staff: mk((c) => pole(c, 2.0, at(solid(sphere(0.14), toon(c.pal.trim), 0.02), 0, 0.1), '#7a5a3a')),
  whip: mk((c) => pole(c, 1.0, at(solid(new THREE.TorusGeometry(0.3, 0.03, 6, 16), toon('#4a3a30'), 0.012), 0.3, 0.1))),
  hooks: mk((c) => withOff(pole(c, 0.9, bladeHead(c, 0.2, 0.5, true)), pole(c, 0.9, bladeHead(c, 0.2, 0.5, true)))),
  knives: mk(knivesObj),
  bow: mk((c) => bowObj(c)),
  crossbow: mk((c) => { const g = simpleBowObj(c); g.scale.setScalar(0.7); return g; }),
  slingshot: mk((c) => { const g = new THREE.Group(); g.add(at(solid(cyl(0.04, 0.04, 0.4), toon(WOOD), 0.012), 0, 0.1)); for (const s of [1, -1]) { const a = solid(cyl(0.035, 0.035, 0.3), toon(WOOD), 0.012); a.position.set(s * 0.09, 0.4, 0); a.rotation.z = -s * 0.4; g.add(a); } void c; return g; }),
  fan: mk(fanObj),
  whisk: mk((c) => { const g = new THREE.Group(); g.add(at(solid(cyl(0.03, 0.03, 0.5), toon(WOOD), 0.012), 0, 0.05)); g.add(at(solid(sphere(0.12, 1, 2.6, 1), toon('#f4f0ea'), 0.012), 0, 0.5)); void c; return g; }),
  qin: mk((c) => { const g = new THREE.Group(); g.add(at(solid(box(0.28, 1.0, 0.1), toon('#5a3a28'), 0.015), 0, 0.2)); g.add(at(new THREE.Mesh(box(0.2, 0.9, 0.02), toon(c.pal.trim)), 0, 0.2, 0.06)); g.rotation.z = -0.3; return g; }),
  scroll: mk((c) => { const g = new THREE.Group(); const s = solid(cyl(0.1, 0.1, 0.55, 14), toon('#f1e6c8'), 0.015); s.rotation.z = Math.PI / 2; g.add(at(s, 0, 0.1)); for (const x of [-0.3, 0.3]) g.add(at(solid(cyl(0.06, 0.06, 0.1), toon(c.pal.trim), 0.012), x, 0.1)); return g; }),
  talisman: mk((c) => { const g = new THREE.Group(); const p = solid(box(0.26, 0.5, 0.02), toon('#f6e08a'), 0.012); p.position.set(0, 0.25, 0.1); g.add(p); const m = new THREE.Mesh(box(0.14, 0.3, 0.005), toon(c.pal.main)); m.position.set(0, 0.25, 0.115); g.add(m); return g; }),
  brush: mk((c) => { const g = new THREE.Group(); g.add(at(solid(cyl(0.035, 0.035, 1.3), toon('#6a4a30'), 0.012), 0, 0.3)); const t = solid(new THREE.ConeGeometry(0.1, 0.4, 8), toon('#2a1c20'), 0.012); t.position.y = 1.15; g.add(t); void c; return g; }),
  drum: mk((c) => { const g = new THREE.Group(); const d = solid(cyl(0.3, 0.3, 0.38, 16), toon(c.pal.main), 0.02); d.position.y = 0.25; g.add(d); for (const y of [0.06, 0.44]) g.add(at(solid(cyl(0.31, 0.31, 0.04, 16), toon(c.pal.trim), 0.012), 0, y)); return g; }),
  coins: mk((c) => { const g = new THREE.Group(); for (let i = 0; i < 3; i++) { const t = solid(new THREE.TorusGeometry(0.15, 0.04, 6, 14), toon('#e8c15a'), 0.012); t.position.set(0, 0.2 + i * 0.12, 0.05); t.rotation.x = Math.PI / 2; g.add(t); } void c; return g; }),
  coinsPlain: mk((c) => WEAPON.coins(c)),
  herbs: mk(herbsObj),
  shield: mk((c) => { const s = solid(cyl(0.4, 0.4, 0.07, 18), toon('#a87a4a'), 0.02); s.rotation.x = Math.PI / 2; s.position.set(0, 0.2, 0.3); const g = new THREE.Group(); g.add(s); g.add(at(solid(cyl(0.12, 0.12, 0.09, 12), toon(c.pal.trim), 0.012), 0, 0.2, 0.32)).rotation.x = Math.PI / 2; return g; }),
  boxShield: mk((c) => { const g = new THREE.Group(); g.add(at(solid(box(0.7, 0.8, 0.08), toon('#c9a26a'), 0.02), 0, 0.2, 0.3)); void c; return g; }),
};
