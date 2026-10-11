// 头饰：挂在 headTop（头顶中心，颅骨半径 ≈0.62，向上为 +y）。
import * as THREE from 'three';
import { solid, sphere, toon } from '../toon';
import type { PartBuilder, PartCtx } from './types';

const R = 0.64; // 头盔内径
/** 半球盔体：盖在头顶，下沿略低于头顶（y<0 向下包住额头） */
function dome(_c: PartCtx, col: string, k = 1): THREE.Mesh {
  const g = new THREE.SphereGeometry(R * k, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.52);
  g.scale(1.16, 0.95, 1.04);
  const m = solid(g, toon(col), 0.022);
  m.position.y = -0.38;
  return m;
}
const ring = (r: number, t: number, col: string, y = 0): THREE.Mesh => { const m = solid(new THREE.TorusGeometry(r, t, 6, 24), toon(col), 0.012); m.rotation.x = Math.PI / 2; m.position.y = y; m.scale.set(1.16, 1.04, 1); return m; };
const plume = (col: string, len = 0.6): THREE.Mesh => { const m = solid(new THREE.ConeGeometry(0.08, len, 6), toon(col), 0.012); m.position.y = len / 2 + 0.12; return m; };
const cone = (r: number, h: number, col: string, y: number, o = 0.012): THREE.Mesh => { const m = solid(new THREE.ConeGeometry(r, h, 8), toon(col), o); m.position.y = y; return m; };

function helmet(c: PartCtx, col: string, orn: (g: THREE.Group) => void): THREE.Group {
  const g = new THREE.Group();
  g.add(dome(c, col));
  g.add(ring(R * 0.96, 0.04, c.pal.trim, -0.36));
  orn(g);
  return g;
}

// 头顶插槽随头大小移动；佩戴半径也随之缩放，额前饰物留在眼睛上方。
function fitted(c: PartCtx, name: string): THREE.Group {
  const g = new THREE.Group();
  g.name = `headgear.${name}`;
  g.scale.setScalar(c.look.head ?? 1);
  return g;
}
const tint = (a: string, b: string, t: number): string => `#${new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()}`;
function extrusion(s: THREE.Shape, depth: number, col: string, outline = 0.012): THREE.Mesh {
  const geo = new THREE.ExtrudeGeometry(s, { depth, steps: 1, bevelEnabled: true, bevelSize: 0.009, bevelThickness: 0.007, bevelSegments: 2, curveSegments: 8 });
  geo.translate(0, 0, -depth / 2);
  return solid(geo, toon(col), outline);
}
function panel(w: number, h: number, d: number, col: string): THREE.Mesh {
  const x = -w / 2, y = -h / 2, r = Math.min(0.035, h / 3, w / 3);
  const s = new THREE.Shape();
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return extrusion(s, d, col);
}
function cord(points: number[][], r: number, col: string, outline = 0.005): THREE.Mesh {
  return solid(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z))), 12, r, 6, false), toon(col), outline);
}
function bead(r: number, col: string, x: number, y: number, z: number): THREE.Mesh {
  const m = solid(sphere(r, 1, 1, 0.75, 12), toon(col), 0.007);
  m.position.set(x, y, z);
  return m;
}
function petal(w: number, h: number, col: string, depth = 0.032): THREE.Mesh {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(-w * 0.6, h * 0.18, -w * 0.6, h * 0.51, -w * 0.24, h * 0.82);
  s.quadraticCurveTo(-w * 0.07, h * 0.99, 0, h);
  s.quadraticCurveTo(w * 0.07, h * 0.99, w * 0.24, h * 0.82);
  s.bezierCurveTo(w * 0.6, h * 0.51, w * 0.6, h * 0.18, 0, 0);
  return extrusion(s, depth, col, 0.009);
}
function foreheadBand(col: string, y: number, radius = 0.55, arc = 1.15): THREE.Mesh {
  const pts = Array.from({ length: 9 }, (_, i) => {
    const a = -arc + i * arc / 4;
    return [Math.sin(a) * radius * 1.16, y, Math.cos(a) * radius * 1.04];
  });
  return cord(pts, 0.027, col, 0.008);
}

function scholarCap(c: PartCtx): THREE.Group {
  const g = fitted(c, 'scholarCap'), cloth = c.pal.cloth ?? tint(c.pal.main, '#fff8ed', 0.72);
  const profile = [[0, -0.3], [0.53, -0.3], [0.55, -0.24], [0.50, -0.14], [0.41, 0.01], [0.26, 0.12], [0, 0.16]].map(([r, y]) => new THREE.Vector2(r, y));
  const cap = solid(new THREE.LatheGeometry(profile, 24), toon(cloth), 0.018);
  cap.scale.set(1.16, 1, 1.04); g.add(cap);
  g.add(ring(0.55, 0.035, c.pal.main, -0.29));
  const crease = tint(c.pal.sub, cloth, 0.80);
  for (const x of [-0.22, 0, 0.22]) g.add(cord([[x, -0.20, 0.52], [x * 0.75, -0.03, 0.44], [x * 0.5, 0.10, 0.29], [0, 0.155, 0.07]], 0.008, crease, 0));
  for (const side of [-1, 1]) {
    const wing = panel(0.36, 0.09, 0.045, c.pal.main);
    wing.position.set(side * 0.69, -0.18, -0.24); wing.rotation.set(0, -side * 0.35, side * 0.08); g.add(wing);
    g.add(cord([[side * 0.1, -0.18, -0.54], [side * 0.19, -0.24, -0.62], [side * 0.30, -0.38, -0.62]], 0.023, c.pal.sub));
  }
  g.add(bead(0.075, c.pal.trim, 0, -0.27, 0.60), bead(0.044, tint(c.pal.trim, '#ffffff', 0.35), 0, -0.27, 0.65));
  g.add(bead(0.065, c.pal.main, 0, -0.18, -0.55));
  return g;
}

function flowerPin(c: PartCtx): THREE.Group {
  const g = fitted(c, 'flowerPin'), pink = tint(c.pal.main, c.pink, 0.82);
  g.add(foreheadBand(c.pal.trim, -0.26));
  g.add(bead(0.035, c.pal.main, 0, -0.26, 0.59));
  g.add(cord([[0.27, -0.20, 0.45], [0.47, -0.14, 0.36], [0.61, 0.05, 0.28]], 0.014, c.pal.trim));
  for (const side of [-1, 1]) {
    const leaf = petal(0.10, 0.23, c.pal.sub, 0.023);
    leaf.position.set(0.53, -0.08, 0.31); leaf.rotation.z = side * 1.1; g.add(leaf);
  }
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    const p = solid(sphere(1, 0.085, 0.14, 0.032, 14), toon(pink), 0.009);
    p.rotation.z = a; p.position.set(0.54 - Math.sin(a) * 0.115, -0.03 + Math.cos(a) * 0.115, 0.36); g.add(p);
  }
  g.add(bead(0.075, c.pal.trim, 0.54, -0.03, 0.405), bead(0.038, tint(c.pal.trim, '#ffffff', 0.40), 0.54, -0.025, 0.455));
  for (let i = 0; i < 2; i++) {
    const x = 0.61 + i * 0.075, y = -0.28 - i * 0.035;
    g.add(cord([[x - 0.03, -0.07, 0.39], [x, -0.17, 0.40], [x, y, 0.40]], 0.008, c.pal.trim, 0));
    g.add(bead(0.035, c.pal.trim, x, y + 0.065, 0.40), bead(0.047, c.pal.sub, x, y, 0.40));
  }
  return g;
}

function lotusCrown(c: PartCtx): THREE.Group {
  const g = fitted(c, 'lotusCrown'), paleGold = tint(c.pal.trim, '#fffaf0', 0.40);
  g.add(foreheadBand(c.pal.main, -0.20, 0.50, 0.57));
  const rear = [-1, 0, 1].map(i => ({ a: i * 0.42, h: 0.36, z: -0.035, y: 0.015 }));
  const front = [-2, -1, 0, 1, 2].map(i => ({ a: i * 0.28, h: 0.48 - Math.abs(i) * 0.055, z: 0.24, y: -0.04 }));
  for (const { a, h, z, y } of [...rear, ...front]) {
    const p = new THREE.Group(); p.position.set(Math.sin(a) * 0.22, y, z); p.rotation.set(-0.12, a * 0.22, -a);
    p.add(petal(0.20, h, c.pal.trim));
    const inset = petal(0.125, h * 0.76, paleGold, 0.020); inset.position.set(0, 0.045, 0.033); p.add(inset); g.add(p);
  }
  g.add(bead(0.080, c.pal.trim, 0, -0.12, 0.44), bead(0.046, paleGold, 0, -0.12, 0.49));
  return g;
}

function taoistCrown(c: PartCtx): THREE.Group {
  const g = fitted(c, 'taoistCrown');
  const bun = solid(sphere(1, 0.235, 0.22, 0.22, 20), toon(c.pal.main), 0.014);
  bun.position.set(0, 0.02, -0.025); g.add(bun);
  const base = solid(new THREE.CylinderGeometry(0.21, 0.25, 0.085, 20), toon(c.pal.sub), 0.012);
  base.position.set(0, -0.14, 0); base.scale.z = 0.87; g.add(base);
  const frame = new THREE.Shape();
  frame.moveTo(-0.17, -0.10); frame.lineTo(-0.17, 0.10); frame.quadraticCurveTo(-0.17, 0.29, 0, 0.31);
  frame.quadraticCurveTo(0.17, 0.29, 0.17, 0.10); frame.lineTo(0.17, -0.10); frame.closePath();
  const hole = new THREE.Path(); hole.moveTo(-0.11, -0.045); hole.lineTo(0.11, -0.045); hole.lineTo(0.11, 0.10);
  hole.quadraticCurveTo(0.11, 0.22, 0, 0.245); hole.quadraticCurveTo(-0.11, 0.22, -0.11, 0.10); hole.closePath(); frame.holes.push(hole);
  const arch = extrusion(frame, 0.038, c.pal.trim); arch.position.z = 0.205; g.add(arch);
  const front = panel(0.24, 0.11, 0.036, c.pal.trim); front.position.set(0, -0.075, 0.25); g.add(front);
  g.add(bead(0.041, c.pal.main, 0, -0.065, 0.29));
  g.add(cord([[-0.35, 0.02, 0.35], [-0.20, 0.02, 0.23], [0, 0.02, 0.10], [0.20, 0.02, 0.23], [0.35, 0.02, 0.35]], 0.014, c.pal.trim, 0.004));
  for (const side of [-1, 1]) {
    g.add(bead(0.047, c.pal.trim, side * 0.35, 0.02, 0.35));
    g.add(cord([[side * 0.15, -0.06, -0.21], [side * 0.16, 0.08, -0.22], [side * 0.09, 0.20, -0.11]], 0.009, c.pal.sub, 0));
  }
  return g;
}

function emperorCrown(c: PartCtx): THREE.Group {
  const g = fitted(c, 'emperorCrown'), lacquer = tint(c.pal.sub, '#181323', 0.55);
  const cap = solid(new THREE.CylinderGeometry(0.175, 0.37, 0.42, 20), toon(lacquer), 0.014);
  cap.position.y = 0.07; cap.scale.set(0.95, 1, 0.93); g.add(cap);
  g.add(foreheadBand(c.pal.main, -0.20, 0.50, 0.62));
  // 前缘宽、后缘收窄：耳尖从板的两侧露出，短珠帘位于额头表面之前。
  const s = new THREE.Shape();
  s.moveTo(-0.27, -0.25); s.quadraticCurveTo(-0.31, -0.25, -0.32, -0.20);
  s.lineTo(-0.54, 0.49); s.quadraticCurveTo(-0.56, 0.55, -0.50, 0.55);
  s.lineTo(0.50, 0.55); s.quadraticCurveTo(0.56, 0.55, 0.54, 0.49);
  s.lineTo(0.32, -0.20); s.quadraticCurveTo(0.31, -0.25, 0.27, -0.25); s.closePath();
  const border = extrusion(s, 0.047, c.pal.trim, 0.010); border.rotation.x = Math.PI / 2; border.position.y = 0.33; g.add(border);
  const top = extrusion(s, 0.026, lacquer, 0.009); top.rotation.x = Math.PI / 2; top.scale.set(0.94, 0.95, 1); top.position.set(0, 0.365, 0.006); g.add(top);
  const underside = extrusion(s, 0.013, lacquer, 0.005); underside.rotation.x = Math.PI / 2; underside.scale.set(0.94, 0.95, 1); underside.position.set(0, 0.292, 0.006); g.add(underside);
  g.add(bead(0.064, c.pal.trim, 0, -0.18, 0.55), bead(0.035, c.pal.main, 0, -0.18, 0.595));
  for (let i = 0; i < 5; i++) {
    const x = (i - 2) * 0.19, bottom = -0.22 + Math.abs(i - 2) * 0.025;
    g.add(cord([[x, 0.30, 0.55], [x, 0.05, 0.575], [x, bottom, 0.60]], 0.008, c.pal.trim, 0));
    g.add(bead(0.039, c.pal.main, x, bottom + 0.105, 0.60), bead(0.042, c.pal.trim, x, bottom, 0.60));
  }
  for (const side of [-1, 1]) g.add(bead(0.045, c.pal.trim, side * 0.46, 0.33, 0.49));
  return g;
}

function boneCrown(c: PartCtx): THREE.Group {
  const g = fitted(c, 'boneCrown'), bone = tint(c.pal.trim, '#fff9e9', 0.25);
  g.add(ring(0.55, 0.048, c.pal.sub, -0.28), ring(0.55, 0.016, c.pal.main, -0.225));
  for (let i = 0; i < 5; i++) {
    const a = (i - 2) * 0.33, height = 0.40 - Math.abs(i - 2) * 0.045;
    const points = [[0, 0], [0.068, 0], [0.082, 0.06], [0.073, 0.17], [0.042, 0.31], [0.021, 0.38], [0, 0.40]].map(([r, y]) => new THREE.Vector2(r, y));
    const geo = new THREE.LatheGeometry(points, 12), pos = geo.getAttribute('position');
    for (let j = 0; j < pos.count; j++) {
      const y = pos.getY(j); pos.setX(j, pos.getX(j) + a * 0.16 * (y / 0.4) ** 2); pos.setY(j, y * height / 0.4);
    }
    geo.computeVertexNormals();
    const tooth = solid(geo, toon(bone), 0.012); tooth.position.set(Math.sin(a) * 0.59, -0.25, Math.cos(a) * 0.50);
    tooth.rotation.set(-0.20, a, -a * 0.25); g.add(tooth);
    const tie = ring(0.078, 0.014, c.pal.main); tie.scale.set(1, 1, 1); tie.position.copy(tooth.position); tie.position.y += 0.045; tie.rotation.copy(tooth.rotation); tie.rotateX(Math.PI / 2); g.add(tie);
  }
  const badge = panel(0.15, 0.09, 0.030, c.pal.main); badge.position.set(0, -0.27, 0.59); g.add(badge);
  g.add(bead(0.028, c.pal.trim, 0, -0.26, 0.62));
  for (const side of [-1, 1]) {
    g.add(cord([[side * 0.53, -0.24, 0.29], [side * 0.60, -0.31, 0.22], [side * 0.63, -0.39, 0.15]], 0.015, c.pal.sub));
    g.add(bead(0.048, bone, side * 0.63, -0.39, 0.15), bead(0.032, c.pal.main, side * 0.61, -0.31, 0.23));
  }
  return g;
}

export const HEADGEAR: Record<string, PartBuilder> = {
  helmetWei: (c) => helmet(c, c.pal.main, (g) => { g.add(cone(0.07, 0.3, c.pal.trim, 0.0)); }),
  helmetGeneral: (c) => helmet(c, c.pal.main, (g) => { g.add(plume('#d9483b', 0.5)); g.add(cone(0.06, 0.2, c.pal.trim, 0.0)); }),
  rattanHelm: (c) => helmet(c, '#b08a54', (g) => { g.add(plume('#7a9a4a', 0.35)); }),
  tigerHood: (c) => helmet(c, '#e8a23a', (g) => { for (const s of [1, -1]) { const e = cone(0.12, 0.2, '#e8a23a', 0.12); e.position.x = s * 0.4; g.add(e); } }),
  scholarCap,
  taoistCrown,
  pheasant: (c) => helmet(c, c.pal.main, (g) => { for (const s of [1, -1]) { const f = plume('#7a4aa0', 1.1); f.position.set(s * 0.18, 0.55, -0.05); f.rotation.z = -s * 0.3; g.add(f); } }),
  yellowBand: () => { const g = new THREE.Group(); g.add(ring(0.62, 0.07, '#f2c230', -0.38)); const k = solid(sphere(0.09), toon('#f2c230'), 0.012); k.position.set(0.5, -0.38, -0.3); g.add(k); return g; },
  boneCrown,
  featherHeaddress: (c) => { const g = new THREE.Group(); g.add(ring(0.62, 0.05, c.pal.trim, -0.4)); const cols = [c.pal.main, '#e8c15a', '#4fb88a', '#d9483b', c.pal.sub]; for (let i = 0; i < 7; i++) { const f = plume(cols[i % cols.length], 0.55); const a = (i - 3) * 0.28; f.position.set(Math.sin(a) * 0.5, -0.15, -0.1); f.rotation.z = -a; g.add(f); } return g; },
  flowerPin,
  emperorCrown,
  sailorBandana: (c) => { const g = new THREE.Group(); g.add(dome(c, '#d9483b', 0.98)); const k = solid(new THREE.ConeGeometry(0.12, 0.3, 4), toon('#d9483b'), 0.012); k.position.set(0.5, -0.3, -0.35); k.rotation.z = -1.2; g.add(k); return g; },
  fortuneHat: (c) => { const g = new THREE.Group(); g.add(dome(c, '#2b2638', 0.9)); const b = solid(new THREE.CylinderGeometry(0.75, 0.75, 0.05, 20), toon('#2b2638'), 0.015); b.position.y = -0.36; b.scale.set(1.15, 1, 1); g.add(b); void c; return g; },
  lotusCrown,
  ratCap: (c) => { const g = new THREE.Group(); g.add(dome(c, c.pal.main, 0.95)); for (const s of [1, -1]) { const e = solid(sphere(0.2, 1, 1, 0.4), toon(c.pal.main), 0.012); e.position.set(s * 0.45, 0.1, -0.05); g.add(e); } return g; },
  hood: (c) => { const g = new THREE.Group(); g.add(dome(c, '#3a3446', 1.04)); void c; return g; },
  leafHat: (c) => { const g = new THREE.Group(); const l = solid(new THREE.ConeGeometry(0.8, 0.35, 12), toon('#6aae58'), 0.015); l.position.y = -0.12; g.add(l); void c; return g; },
};
