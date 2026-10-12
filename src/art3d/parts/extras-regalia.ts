// 三件贴身配饰归 head；根保持单位，接触面与可见装饰分别命名，便于实际表面审核。
import * as THREE from 'three';
import { solid, toon } from '../toon';
import type { PartCtx } from './types';

function named(mesh: THREE.Mesh, name: string): THREE.Mesh { mesh.name = name; return mesh; }

function cord(points: THREE.Vector3[], radius: number, color: string, closed = false, name = ''): THREE.Mesh {
  const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, closed), closed ? 24 : 16, radius, 6, closed);
  return named(solid(geo, toon(color), 0.004), name);
}

function ball(r: number, color: string, name: string, x: number, y: number, z: number, scale: [number, number, number] = [1, 1, 1], outline = 0.004): THREE.Mesh {
  const m = named(solid(new THREE.SphereGeometry(r, 12, 8), toon(color), outline), name);
  m.scale.set(...scale); m.position.set(x, y, z); return m;
}

export function softGoatBeard(c: PartCtx): THREE.Group {
  const g = new THREE.Group(); g.name = 'regalia-goat-beard';
  // 只让柔软根垫接触口鼻垫下缘；其余束须落在当前 smile / mouthO 下方。
  g.add(ball(0.082, c.light, 'goat-muzzle-contact', 0, -0.309, 0.532, [1.02, 0.28, 0.35], 0.004));
  const P: [number, number][] = [[0, -0.565], [0.009, -0.560], [0.020, -0.545], [0.032, -0.510], [0.043, -0.450], [0.039, -0.382], [0.025, -0.335], [0, -0.315]];
  for (const side of [-1, 0, 1]) {
    const shorten = side === 0 ? 1 : 0.80;
    const geo = new THREE.LatheGeometry(P.map(([r, y]) => new THREE.Vector2(r * (side === 0 ? 1 : 0.72), -0.315 + (y + 0.315) * shorten)), 14);
    const p = geo.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const t = THREE.MathUtils.clamp((-0.315 - p.getY(i)) / (0.25 * shorten), 0, 1);
      p.setXYZ(i, p.getX(i) + side * 0.048 * (1 - 0.40 * t), p.getY(i), p.getZ(i) * 0.55 + 0.537 + 0.045 * t + Math.abs(side) * 0.006);
    }
    geo.computeVertexNormals();
    g.add(named(solid(geo, toon(c.light), 0.006), 'goat-soft-strand-' + side));
  }
  const tie = Array.from({ length: 24 }, (_, i) => {
    const a = i * Math.PI / 12;
    return new THREE.Vector3(Math.sin(a) * 0.061, -0.410, 0.557 + Math.cos(a) * 0.029);
  });
  g.add(cord(tie, 0.008, c.pal.trim, true, 'goat-small-binding'));
  return g;
}

/** 24个周向间隔；底部前方留真实窄槽，透出内衬而不是在实心球上画线。 */
function jingleShell(): THREE.BufferGeometry {
  const angles = [...Array.from({ length: 23 }, (_, i) => -Math.PI + i * Math.PI / 11), -0.11, 0.11].sort((a, b) => a - b);
  const profile: [number, number][] = [[0.060, -0.615], [0.095, -0.570], [0.110, -0.535], [0.098, -0.490], [0.073, -0.457], [0.018, -0.438], [0, -0.430]];
  const vertices: number[] = [], index: number[] = [];
  for (const [r, y] of profile) for (const a of angles) vertices.push(Math.sin(a) * r, y, 0.403 + Math.cos(a) * r);
  for (let j = 0; j < profile.length - 1; j++) for (let i = 0; i < angles.length - 1; i++) {
    if (profile[j + 1][1] <= -0.565 && Math.abs(angles[i]) <= 0.111 && Math.abs(angles[i + 1]) <= 0.111) continue;
    const a = j * angles.length + i, above = a + angles.length;
    index.push(a, a + 1, above, a + 1, above + 1, above);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geo.setIndex(index); geo.computeVertexNormals();
  return geo;
}

export function hangingCollarBell(c: PartCtx): THREE.Group {
  const g = new THREE.Group(); g.name = 'regalia-collar-bell';
  // 上沿少量贴入下颌颈侧皮肤，是真挂接区；铃壳、铃舌、挂环全部单独审核。
  const collar = Array.from({ length: 24 }, (_, i) => {
    const a = i * Math.PI / 12;
    return new THREE.Vector3(Math.sin(a) * 0.445, -0.383, Math.cos(a) * 0.380);
  });
  g.add(cord(collar, 0.027, c.pal.sub, true, 'bell-collar-contact'));
  const hanger = named(solid(new THREE.TorusGeometry(0.037, 0.010, 6, 18), toon(c.pal.trim), 0.004), 'bell-hanger');
  hanger.position.set(0, -0.419, 0.398); g.add(hanger);
  g.add(named(solid(jingleShell(), toon('#ffd24a', { double: true }), 0.005), 'bell-slotted-shell'));
  g.add(ball(0.075, '#8a6828', 'bell-recessed-lining', 0, -0.545, 0.403, [1, 0.90, 1], 0));
  const stem = named(solid(new THREE.CylinderGeometry(0.009, 0.009, 0.055, 8), toon('#ffd24a'), 0), 'bell-clapper-stem');
  stem.position.set(0, -0.6105, 0.403); g.add(stem);
  g.add(ball(0.025, '#ffd24a', 'bell-rounded-clapper', 0, -0.638, 0.403, [1, 0.8, 1], 0.003));
  const lip = named(solid(new THREE.TorusGeometry(0.060, 0.006, 5, 24, Math.PI * 2 - 0.22), toon('#ffd24a'), 0), 'bell-open-bottom-lip');
  lip.rotation.x = Math.PI / 2; lip.rotation.z = Math.PI / 2 + 0.11; lip.position.set(0, -0.615, 0.403); g.add(lip);
  const gleam = ball(0.024, '#fff1a8', 'bell-soft-highlight', -0.046, -0.493, 0.486, [0.75, 1.2, 0.3], 0);
  g.add(gleam);
  return g;
}

export function earBaseHoop(c: PartCtx): THREE.Group {
  const g = new THREE.Group(); g.name = 'regalia-ear-base-hoop';
  // 固定在头部耳根外侧皮肤，避开会抖动的耳尖；只有这枚小耳钉允许接触皮肤。
  g.add(ball(0.031, c.pal.trim, 'earring-stud-contact', 0.665, 0.395, 0.100, [0.68, 0.8, 0.75], 0.003));
  g.add(cord([new THREE.Vector3(0.680, 0.395, 0.10), new THREE.Vector3(0.720, 0.378, 0.10), new THREE.Vector3(0.757, 0.357, 0.10)], 0.009, c.pal.trim, false, 'earring-soft-link'));
  const hoop = named(solid(new THREE.TorusGeometry(0.079, 0.011, 6, 24), toon(c.pal.trim), 0.003), 'earring-fine-hoop');
  hoop.position.set(0.810, 0.300, 0.100); g.add(hoop);
  const hook = named(solid(new THREE.TorusGeometry(0.022, 0.006, 5, 12), toon(c.pal.trim), 0.002), 'earring-drop-hook');
  hook.position.set(0.810, 0.207, 0.100); g.add(hook);
  const drop = new THREE.LatheGeometry([new THREE.Vector2(0, 0.192), new THREE.Vector2(0.016, 0.182), new THREE.Vector2(0.030, 0.163), new THREE.Vector2(0.035, 0.142), new THREE.Vector2(0.024, 0.124), new THREE.Vector2(0, 0.116)], 12);
  drop.scale(1, 1, 0.65); drop.translate(0.810, 0, 0.100);
  g.add(named(solid(drop, toon(c.pal.sub), 0.004), 'earring-rounded-drop'));
  g.add(ball(0.012, c.light, 'earring-drop-gleam', 0.802, 0.153, 0.122, [0.6, 1, 0.45], 0));
  return g;
}
