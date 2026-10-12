// 曹喵德 / 周喵瑜专属低冠。全部尺寸是 headTop 局部坐标，继承引擎的 1.14 头部倍率。
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { solid, toon } from '../toon';
import type { PartCtx } from './types';

const tint = (a: string, b: string, t: number): string => `#${new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()}`;
function extrude(shape: THREE.Shape, depth: number): THREE.ExtrudeGeometry {
  const geo = new THREE.ExtrudeGeometry(shape, { depth, steps: 1, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.006, bevelSegments: 2, curveSegments: 8 });
  geo.translate(0, 0, -depth / 2);
  return geo;
}
function ballGeo(r: number, x: number, y: number, z: number, zScale = 0.8): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(r, 12, 8); geo.scale(1, 1, zScale); geo.translate(x, y, z); return geo;
}
function join(geos: THREE.BufferGeometry[], color: string, outline = 0.006): THREE.Mesh {
  const geo = mergeGeometries(geos, false)!;
  for (const g of geos) g.dispose();
  return solid(geo, toon(color), outline);
}
function curve(points: [number, number, number][], radius: number): THREE.BufferGeometry {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), 16, radius, 6, false);
}
function forehead(color: string, y: number): THREE.Mesh {
  return solid(curve(Array.from({ length: 9 }, (_, i) => {
    const a = -0.65 + i * 0.1625;
    return [Math.sin(a) * 0.50 * 1.16, y, Math.cos(a) * 0.50 * 1.04];
  }), 0.024), toon(color), 0.006);
}
/** 把拟合倍率烘到几何中，root 始终是零位移 / 零旋转 / 单位缩放。 */
function fit(c: PartCtx, g: THREE.Group): THREE.Group {
  const h = c.look.head ?? 1;
  for (const child of g.children) {
    const m = child as THREE.Mesh;
    if (!m.isMesh) continue;
    m.updateMatrix(); m.geometry.applyMatrix4(m.matrix); m.geometry.scale(h, h, h);
    m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1); m.updateMatrix();
  }
  return g;
}

export function caomaoCrown(c: PartCtx): THREE.Group {
  const g = new THREE.Group(); g.name = 'ur.caomiaode.emperorCrown';
  const lacquer = tint(c.pal.sub, '#181323', 0.65);
  const cap = solid(new THREE.CylinderGeometry(0.16, 0.32, 0.29, 20), toon(lacquer), 0.012);
  cap.position.y = 0.025; cap.scale.set(0.95, 1, 0.93); g.add(cap);
  g.add(forehead(c.pal.main, -0.20));
  // 七列珠帘，前宽后窄的板在耳尖位置收腰，不靠抬高冠让耳朵露出。
  const board = new THREE.Shape();
  board.moveTo(-0.21, -0.25); board.quadraticCurveTo(-0.25, -0.25, -0.25, -0.20);
  board.lineTo(-0.285, 0.10);
  board.lineTo(-0.53, 0.49); board.quadraticCurveTo(-0.55, 0.55, -0.49, 0.55);
  board.lineTo(0.49, 0.55); board.quadraticCurveTo(0.55, 0.55, 0.53, 0.49);
  board.lineTo(0.285, 0.10); board.lineTo(0.25, -0.20); board.quadraticCurveTo(0.25, -0.25, 0.21, -0.25); board.closePath();
  const border = solid(extrude(board, 0.041), toon(c.pal.trim), 0.008);
  border.rotation.x = Math.PI / 2; border.position.y = 0.210; g.add(border);
  const top = solid(extrude(board, 0.022), toon(lacquer), 0.007);
  top.rotation.x = Math.PI / 2; top.scale.set(0.94, 0.95, 1); top.position.set(0, 0.242, 0.006); g.add(top);
  const underside = solid(extrude(board, 0.012), toon(lacquer), 0.005);
  underside.rotation.x = Math.PI / 2; underside.scale.set(0.94, 0.95, 1); underside.position.set(0, 0.177, 0.006); g.add(underside);
  g.add(solid(ballGeo(0.056, 0, -0.18, 0.55), toon(c.pal.trim), 0.006));
  g.add(solid(ballGeo(0.030, 0, -0.18, 0.597, 0.55), toon(c.pal.main), 0.004));
  const strings: THREE.BufferGeometry[] = [], gold: THREE.BufferGeometry[] = [], blue: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    const x = (i - 3) * 0.14, bottom = -0.195 + Math.abs(i - 3) * 0.009;
    strings.push(curve([[x, 0.185, 0.55], [x, 0.025, 0.578], [x, bottom, 0.595]], 0.006));
    gold.push(ballGeo(0.031, x, bottom + 0.185, 0.595), ballGeo(0.032, x, bottom, 0.595));
    blue.push(ballGeo(0.032, x, bottom + 0.094, 0.595));
  }
  g.add(join(strings, c.pal.trim, 0), join(gold, c.pal.trim, 0.004), join(blue, c.pal.main, 0.004));
  g.add(join([-1, 1].map((s) => ballGeo(0.025, s * 0.47, 0.216, 0.49)), c.pal.trim, 0.004));
  const knot = ballGeo(0.045, 0, -0.06, -0.31);
  const ties = [-1, 1].map((s) => curve([[0, -0.055, -0.32], [s * 0.07, -0.08, -0.35], [s * 0.11, -0.135, -0.34]], 0.018));
  g.add(join([knot, ...ties], c.pal.sub, 0.005));
  return fit(c, g);
}

export function zhouyuCrown(c: PartCtx): THREE.Group {
  const g = new THREE.Group(); g.name = 'ur.zhoumiaoyu.wuCrown';
  const profile = [[0, -0.13], [0.17, -0.13], [0.20, -0.08], [0.18, 0.045], [0.13, 0.15], [0.045, 0.205], [0, 0.205]].map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(profile, 20), pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); pos.setX(i, pos.getX(i) + 0.13 * Math.max(0, y)); pos.setZ(i, pos.getZ(i) * 0.83 - 0.02); }
  geo.computeVertexNormals(); g.add(solid(geo, toon(c.pal.main), 0.013));
  const base = solid(new THREE.CylinderGeometry(0.19, 0.225, 0.07, 20), toon(c.pal.sub), 0.010);
  base.position.set(0, -0.105, -0.015); base.scale.z = 0.84; g.add(base);
  g.add(forehead(c.pal.trim, -0.18));
  const plaque = new THREE.Shape();
  plaque.moveTo(-0.115, -0.045); plaque.lineTo(0.115, -0.045); plaque.quadraticCurveTo(0.127, -0.035, 0.112, 0.047);
  plaque.lineTo(0.035, 0.030); plaque.quadraticCurveTo(0, 0.012, -0.035, 0.030); plaque.lineTo(-0.112, 0.047); plaque.closePath();
  const badge = solid(extrude(plaque, 0.034), toon(c.pal.trim), 0.007);
  badge.position.set(0, -0.18, 0.54); g.add(badge);
  g.add(solid(ballGeo(0.034, 0, -0.18, 0.575, 0.60), toon(c.pal.main), 0.006));
  for (const side of [-1, 1]) g.add(solid(ballGeo(0.037, side * Math.sin(0.65) * 0.58, -0.18, Math.cos(0.65) * 0.52), toon(c.pal.trim), 0.006));
  const fold = new THREE.Shape(); fold.moveTo(-0.09, -0.11); fold.quadraticCurveTo(0.025, 0.12, 0.09, 0.075); fold.lineTo(0.04, -0.13); fold.closePath();
  const rear = solid(extrude(fold, 0.025), toon(c.pal.sub), 0.006); rear.position.z = -0.18; g.add(rear);
  const pin = solid(new THREE.CylinderGeometry(0.018, 0.018, 0.46, 12), toon(c.pal.trim), 0.004);
  pin.rotation.z = Math.PI / 2; pin.position.set(0, 0.065, -0.035); g.add(pin);
  g.add(solid(ballGeo(0.035, 0.255, 0.065, -0.035), toon(c.pal.trim), 0.004));
  return fit(c, g);
}
