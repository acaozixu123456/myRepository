// Head-mounted marks. Geometry is built once; the existing rig supplies all motion.
import * as THREE from 'three';
import { detail, solid, sphere, toon } from '../toon';
import type { PartCtx } from './types';

const tint = (a: string, b: string, t: number): string => `#${new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()}`;
const tube = (points: THREE.Vector3[], r: number, col: string, outline = 0): THREE.Mesh =>
  solid(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 20, r, 6, false), toon(col), outline);

/** Bright curved corners surround the spherical eyes; they never replace the iris. */
export function luminousEyeCorners(c: PartCtx): THREE.Group {
  const g = new THREE.Group(); g.name = 'extra.glowEyes';
  const profiles: Record<string, [number, number, number]> = {
    sharp: [1.1, 0.82, -0.28], keen: [1, 0.95, -0.2], calm: [1, 1, -0.08],
  };
  const [width, height, tilt] = profiles[c.look.eye.style] ?? [1, 1.25, 0];
  const bright = tint(c.look.eye.color, '#ffffff', 0.30);
  const mat = toon(bright, { emissive: tint(c.look.eye.color, '#000000', 0.48) });
  const glint = toon(tint(c.look.eye.color, '#ffffff', 0.72), { emissive: tint(c.look.eye.color, '#ffffff', 0.28) });
  for (const side of [-1, 1]) {
    const rx = 0.165 * width + 0.042, ry = 0.165 * height + 0.038;
    const point = (a: number): THREE.Vector3 => {
      const x = side * rx * Math.cos(a), y = ry * Math.sin(a), angle = tilt * side;
      return new THREE.Vector3(side * (0.27 + 0.06) + x * Math.cos(angle) - y * Math.sin(angle), 0.16 + x * Math.sin(angle) + y * Math.cos(angle), 0.570 + 0.012 * Math.cos(a));
    };
    const arc = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 13 }, (_, i) => point(-1.10 + i * 1.44 / 12))), 20, 0.014, 6, false), mat);
    arc.name = `eye-corner.${side}`; g.add(arc);
    const highlight = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 5 }, (_, i) => point(-0.23 + i * 0.38 / 4))), 8, 0.006, 6, false), glint);
    highlight.position.z = 0.014; highlight.name = `eye-corner-highlight.${side}`; g.add(highlight);
    const end = new THREE.Mesh(sphere(0.018, 1, 1, 0.8, 12), glint);
    end.position.copy(point(-1.10)); end.name = `eye-corner-end.${side}`; g.add(end);
  }
  return g;
}

// Describe the existing skull faces: normally 28 / 21, or the host's reduced
// detail divisions in the world. This is not a new high-segment accessory mesh.
// Cutting at the actual face edges keeps the entire paint triangle on the skin.
type SkinFace = [THREE.Vector3, THREE.Vector3, THREE.Vector3];
const skinCache = new Map<number, SkinFace[]>();
function skinFaces(): SkinFace[] {
  const longitude = Math.max(8, Math.round(28 * detail.k));
  const cached = skinCache.get(longitude); if (cached) return cached;
  const latitude = Math.max(6, Math.round(longitude * 0.75));
  const at = (i: number, j: number): THREE.Vector3 => {
    const theta = j * Math.PI / latitude, phi = i * Math.PI * 2 / longitude;
    return new THREE.Vector3(-0.62 * 1.16 * Math.cos(phi) * Math.sin(theta), 0.14 + 0.62 * Math.cos(theta), 0.62 * 1.02 * Math.sin(phi) * Math.sin(theta));
  };
  const faces: SkinFace[] = [];
  for (let j = 0; j < latitude; j++) for (let i = 0; i < longitude; i++) {
    const a = at(i + 1, j), b = at(i, j), d = at(i + 1, j + 1), e = at(i, j + 1);
    if (j !== 0) faces.push([a, b, d]);
    if (j !== latitude - 1) faces.push([b, e, d]);
  }
  const front = faces.filter(([a, b, d]) => (b.x - a.x) * (d.y - a.y) - (b.y - a.y) * (d.x - a.x) > 1e-10);
  skinCache.set(longitude, front); return front;
}

function paintStrip(side: number, row: number): THREE.BufferGeometry {
  const radius = row ? 0.021 : 0.025, left = row ? 0.378 : 0.356, right = row ? 0.572 : 0.594;
  const cy = (x: number): number => (row ? -0.140 : -0.061) - (x - left) * 0.14;
  const polygon: THREE.Vector2[] = [];
  // Rounded ends; the second cheek is a positive-coordinate reflection in data,
  // not a negative object scale. A slight offset follows the hand-painted refs.
  for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 + i * Math.PI / 8; const x = right + Math.cos(a) * radius; polygon.push(new THREE.Vector2(side * x, cy(x) + Math.sin(a) * radius + (side < 0 && row ? 0.007 : 0))); }
  for (let i = 0; i <= 8; i++) { const a = Math.PI / 2 + i * Math.PI / 8; const x = left + Math.cos(a) * radius; polygon.push(new THREE.Vector2(side * x, cy(x) + Math.sin(a) * radius + (side < 0 && row ? 0.007 : 0))); }
  const vertices: number[] = [];
  for (const [a, b, d] of skinFaces()) {
    let clipped = polygon.map(p => p.clone());
    const winding = Math.sign((b.x - a.x) * (d.y - a.y) - (b.y - a.y) * (d.x - a.x));
    for (const [p, q] of [[a, b], [b, d], [d, a]]) {
      const distance = (v: THREE.Vector2): number => winding * ((q.x - p.x) * (v.y - p.y) - (q.y - p.y) * (v.x - p.x));
      const next: THREE.Vector2[] = [];
      for (let i = 0; i < clipped.length; i++) {
        const u = clipped[i], v = clipped[(i + 1) % clipped.length], du = distance(u), dv = distance(v);
        if (du >= -1e-10) next.push(u);
        if ((du >= 0) !== (dv >= 0)) next.push(u.clone().lerp(v, du / (du - dv)));
      }
      clipped = next; if (clipped.length < 3) break;
    }
    if (clipped.length < 3) continue;
    const normal = new THREE.Vector3().crossVectors(b.clone().sub(a), d.clone().sub(a));
    const z = (p: THREE.Vector2): number => a.z - (normal.x * (p.x - a.x) + normal.y * (p.y - a.y)) / normal.z + 0.001;
    for (let i = 1; i < clipped.length - 1; i++) {
      const ps = [clipped[0], clipped[i], clipped[i + 1]];
      if ((ps[1].x - ps[0].x) * (ps[2].y - ps[0].y) - (ps[1].y - ps[0].y) * (ps[2].x - ps[0].x) < 0) ps.reverse();
      for (const p of ps) vertices.push(p.x, p.y, z(p));
    }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geo.computeVertexNormals();
  return geo;
}

/** Four thin skin patches: green for Shu, leather brown for the southern cats. */
export function cheekWarPaint(c: PartCtx): THREE.Group {
  const g = new THREE.Group(); g.name = 'extra.warPaint';
  for (const side of [-1, 1]) for (const row of [0, 1]) {
    const m = new THREE.Mesh(paintStrip(side, row), toon(c.pal.sub));
    m.name = `skin-paint.${side}.${row}`; g.add(m);
  }
  return g;
}

function hangingCloth(x: number, y: number, col: string): THREE.Mesh {
  const s = new THREE.Shape();
  s.moveTo(-0.028, 0); s.quadraticCurveTo(-0.039, -0.10, -0.020, -0.222);
  s.quadraticCurveTo(0, -0.248, 0.019, -0.220); s.quadraticCurveTo(0.034, -0.08, 0.028, 0); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.028, steps: 1, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.004, bevelSegments: 2, curveSegments: 8 });
  geo.translate(x, y, 0.167);
  return solid(geo, toon(col), 0.006);
}

/** A sewn side attachment, a rounded knot, and two short broad cloth ends. */
export function sideKnotTassel(c: PartCtx): THREE.Group {
  const g = new THREE.Group(); g.name = 'extra.tassel';
  const seat = solid(sphere(0.028, 0.4, 1, 1.3, 12), toon(c.pal.trim), 0.004);
  seat.position.set(0.714, 0.16, 0.08); seat.name = 'attachment-seat'; g.add(seat);
  const cord = tube([new THREE.Vector3(0.741, 0.16, 0.08), new THREE.Vector3(0.797, 0.115, 0.13), new THREE.Vector3(0.843, 0.04, 0.167)], 0.014, c.pal.sub, 0.004);
  cord.name = 'attachment-cord'; g.add(cord);
  for (const side of [-1, 1]) {
    const loop = solid(new THREE.TorusGeometry(0.034, 0.017, 6, 16), toon(c.pal.main), 0.005);
    loop.scale.set(1.10, 0.78, 1); loop.position.set(0.843 + side * 0.035, 0.033, 0.171); loop.rotation.z = side * 0.23; loop.name = `knot-loop.${side}`; g.add(loop);
  }
  const centre = solid(sphere(0.032, 0.9, 0.8, 0.9, 12), toon(c.pal.trim), 0.005);
  centre.position.set(0.843, 0.027, 0.195); centre.name = 'knot-band'; g.add(centre);
  const left = hangingCloth(0.812, 0.013, c.pal.sub), right = hangingCloth(0.874, -0.002, c.pal.main);
  left.name = 'cloth-end.inner'; right.name = 'cloth-end.outer'; g.add(left, right);
  for (const [x, y] of [[0.812, 0.013], [0.874, -0.002]]) {
    const crease = tube([new THREE.Vector3(x, y - 0.025, 0.201), new THREE.Vector3(x - 0.004, y - 0.11, 0.207), new THREE.Vector3(x, y - 0.207, 0.201)], 0.005, c.pal.trim);
    crease.name = 'cloth-fold'; g.add(crease);
  }
  return g;
}
