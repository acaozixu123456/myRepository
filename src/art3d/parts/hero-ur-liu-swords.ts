// 刘喵备的双股剑：保留通用通过版的掌心握段和镜像外展刀座，新增短绿穗。
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { solid, toon } from '../toon';
import type { PartCtx } from './types';

function extrude(shape: THREE.Shape, depth: number, bevel = 0.008): THREE.BufferGeometry {
  const geo = new THREE.ExtrudeGeometry(shape, { depth, steps: 1, bevelEnabled: true, bevelSize: bevel, bevelThickness: Math.min(bevel, 0.006), bevelSegments: 2, curveSegments: 8 });
  geo.translate(0, 0, -depth / 2); return geo;
}
function placed(m: THREE.Mesh, x: number, y: number, z = 0): THREE.Mesh { m.position.set(x, y, z); return m; }
function combined(geos: THREE.BufferGeometry[], color: string, outline: number): THREE.Mesh {
  const geo = mergeGeometries(geos, false)!; geos.forEach((g) => g.dispose()); return solid(geo, toon(color), outline);
}
function oneSword(c: PartCtx, side: 1 | -1): THREE.Group {
  const g = new THREE.Group(); g.name = side === 1 ? 'ur.liumiaobei.dualSwords.main' : 'ur.liumiaobei.dualSwords.offhand';
  const length = side === 1 ? 1.02 : 0.90, width = 0.19;
  g.add(placed(solid(new THREE.CylinderGeometry(0.041, 0.038, 0.19, 10), toon(c.pal.sub), 0.010), 0, -0.05));
  const wraps = [-0.105, 0.025].map((y) => { const geo = new THREE.CylinderGeometry(0.044, 0.044, 0.018, 10); geo.translate(0, y, 0); return geo; });
  g.add(combined(wraps, c.pal.main, 0.007));
  const pommel = new THREE.SphereGeometry(0.071, 12, 8); pommel.scale(1, 0.75, 0.68);
  g.add(placed(solid(pommel, toon(c.pal.trim), 0.011), 0, -0.20));
  const neck = new THREE.CubicBezierCurve3(new THREE.Vector3(0, 0.024, 0), new THREE.Vector3(0, 0.082, 0), new THREE.Vector3(-side * 0.25 * 0.74, 0.025, 0), new THREE.Vector3(-side * 0.25, 0.08, 0));
  g.add(solid(new THREE.TubeGeometry(neck, 10, 0.024, 8, false), toon(c.pal.trim), 0.008));
  const top = new THREE.Group(); top.name = 'blade-mount'; top.position.set(-side * 0.25, 0.080, 0); top.rotation.set(0, side * 0.20, side * 0.55); g.add(top);
  const guard = new THREE.Shape(); guard.moveTo(-0.22, -0.015);
  guard.quadraticCurveTo(-0.25, 0.065, -0.17, 0.118); guard.quadraticCurveTo(-0.11, 0.12, -0.065, 0.035);
  guard.lineTo(0.065, 0.035); guard.quadraticCurveTo(0.11, 0.12, 0.17, 0.118); guard.quadraticCurveTo(0.25, 0.065, 0.22, -0.015);
  guard.quadraticCurveTo(0, -0.055, -0.22, -0.015); guard.closePath();
  for (const s of [-1, 1]) { const hole = new THREE.Path(); hole.absarc(s * 0.17, 0.079, 0.014, 0, Math.PI * 2, true); guard.holes.push(hole); }
  const guardGeo = extrude(guard, 0.065); guardGeo.scale(0.58, 1, 1); guardGeo.translate(-side * 0.045, 0, 0);
  top.add(solid(guardGeo, toon(c.pal.trim), 0.011));
  top.add(placed(solid(new THREE.CylinderGeometry(0.057, 0.068, 0.060, 10), toon(c.pal.trim), 0.008), 0, 0.075));
  const blade = new THREE.Shape(); blade.moveTo(-width * 0.43, 0); blade.lineTo(-width * 0.40, length * 0.76);
  blade.quadraticCurveTo(-width * 0.34, length * 0.90, -width * 0.025, length); blade.quadraticCurveTo(0, length * 1.012, width * 0.025, length);
  blade.quadraticCurveTo(width * 0.34, length * 0.90, width * 0.40, length * 0.76); blade.lineTo(width * 0.43, 0); blade.closePath();
  top.add(placed(solid(extrude(blade, 0.058), toon('#d8e2ee'), 0.013), 0, 0.104));
  const glint = new THREE.Shape(); glint.moveTo(-width * 0.18, 0.05);
  glint.quadraticCurveTo(-width * 0.18, length * 0.55, -width * 0.025, length * 0.93); glint.quadraticCurveTo(width * 0.07, length * 0.73, width * 0.03, length * 0.12); glint.closePath();
  top.add(placed(solid(extrude(glint, 0.008), toon('#f5faff'), 0), 0, 0.104, 0.036));
  // 短绳连接圆首；布穗和小折纹用更小圆角，含描边的下端保持 y>=-.34。
  const tx = side * 0.028;
  const cord = new THREE.CatmullRomCurve3([new THREE.Vector3(0, -0.225, 0.025), new THREE.Vector3(side * 0.018, -0.25, 0.023), new THREE.Vector3(tx, -0.269, 0.02)]);
  g.add(solid(new THREE.TubeGeometry(cord, 10, 0.008, 6, false), toon(c.pal.sub), 0.003));
  const knot = new THREE.SphereGeometry(0.022, 10, 8); knot.scale(1, 0.8, 0.7);
  g.add(placed(solid(knot, toon(c.pal.main), 0.005), tx, -0.271, 0.02));
  const tassel = new THREE.Shape(); tassel.moveTo(-0.023, -0.285); tassel.quadraticCurveTo(-0.032, -0.307, -0.038, -0.327);
  tassel.quadraticCurveTo(0, -0.332, 0.038, -0.327); tassel.quadraticCurveTo(0.032, -0.307, 0.023, -0.285); tassel.closePath();
  g.add(placed(solid(extrude(tassel, 0.022, 0.003), toon(c.pal.main), 0.005), tx, 0, 0.02));
  const folds = [-1, 1].map((s) => {
    const shape = new THREE.Shape(); shape.moveTo(s * 0.010, -0.289); shape.lineTo(s * 0.021, -0.325); shape.lineTo(s * 0.017, -0.325); shape.lineTo(s * 0.007, -0.289); shape.closePath();
    const geo = extrude(shape, 0.004, 0.001); geo.translate(tx, 0, 0.038); return geo;
  });
  g.add(combined(folds, c.pal.sub, 0));
  return g;
}

export function liubeiDualSwords(c: PartCtx): THREE.Group {
  const main = oneSword(c, 1), offhand = oneSword(c, -1);
  main.userData.offhand = offhand;
  return main;
}
