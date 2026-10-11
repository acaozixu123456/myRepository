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

export const HEADGEAR: Record<string, PartBuilder> = {
  helmetWei: (c) => helmet(c, c.pal.main, (g) => { g.add(cone(0.07, 0.3, c.pal.trim, 0.0)); }),
  helmetGeneral: (c) => helmet(c, c.pal.main, (g) => { g.add(plume('#d9483b', 0.5)); g.add(cone(0.06, 0.2, c.pal.trim, 0.0)); }),
  rattanHelm: (c) => helmet(c, '#b08a54', (g) => { g.add(plume('#7a9a4a', 0.35)); }),
  tigerHood: (c) => helmet(c, '#e8a23a', (g) => { for (const s of [1, -1]) { const e = cone(0.12, 0.2, '#e8a23a', 0.12); e.position.x = s * 0.4; g.add(e); } }),
  scholarCap: (c) => { const g = new THREE.Group(); g.add(dome(c, c.pal.main, 0.95)); for (const s of [1, -1]) { const w = solid(new THREE.BoxGeometry(0.4, 0.05, 0.08), toon(c.pal.main), 0.012); w.position.set(s * 0.55, -0.2, -0.3); g.add(w); } return g; },
  taoistCrown: (c) => { const g = new THREE.Group(); g.add(dome(c, c.pal.main, 0.8)); const p = solid(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8), toon(c.pal.trim), 0.012); p.rotation.z = Math.PI / 2; p.position.y = 0.08; g.add(p); g.add(cone(0.1, 0.22, c.pal.trim, 0.06)); return g; },
  pheasant: (c) => helmet(c, c.pal.main, (g) => { for (const s of [1, -1]) { const f = plume('#7a4aa0', 1.1); f.position.set(s * 0.18, 0.55, -0.05); f.rotation.z = -s * 0.3; g.add(f); } }),
  yellowBand: () => { const g = new THREE.Group(); g.add(ring(0.62, 0.07, '#f2c230', -0.38)); const k = solid(sphere(0.09), toon('#f2c230'), 0.012); k.position.set(0.5, -0.38, -0.3); g.add(k); return g; },
  boneCrown: (c) => { const g = new THREE.Group(); g.add(ring(0.62, 0.06, '#efe6d2', -0.4)); for (let i = 0; i < 5; i++) { const a = -0.8 + i * 0.4; const t = cone(0.06, 0.28, '#efe6d2', -0.2); t.position.x = Math.sin(a) * 0.6; t.position.z = Math.cos(a) * 0.45 - 0.1; g.add(t); } void c; return g; },
  featherHeaddress: (c) => { const g = new THREE.Group(); g.add(ring(0.62, 0.05, c.pal.trim, -0.4)); const cols = [c.pal.main, '#e8c15a', '#4fb88a', '#d9483b', c.pal.sub]; for (let i = 0; i < 7; i++) { const f = plume(cols[i % cols.length], 0.55); const a = (i - 3) * 0.28; f.position.set(Math.sin(a) * 0.5, -0.15, -0.1); f.rotation.z = -a; g.add(f); } return g; },
  flowerPin: (c) => { const g = new THREE.Group(); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const p = solid(sphere(0.1, 1, 1, 0.5), toon('#ff8fb8'), 0.012); p.position.set(0.42 + Math.cos(a) * 0.12, -0.2 + Math.sin(a) * 0.12, 0.22); g.add(p); } const m = solid(sphere(0.07), toon('#ffd24a'), 0.01); m.position.set(0.42, -0.2, 0.26); g.add(m); void c; return g; },
  emperorCrown: (c) => { const g = new THREE.Group(); const b = solid(new THREE.BoxGeometry(1.0, 0.07, 0.7), toon('#2b2638'), 0.015); b.position.y = 0.0; g.add(b); const t = solid(new THREE.CylinderGeometry(0.55, 0.62, 0.22, 20), toon('#2b2638'), 0.015); t.position.y = -0.14; t.scale.set(1.16, 1, 1); g.add(t); for (let i = 0; i < 9; i++) { const x = -0.45 + i * 0.1125; const s = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.36, 3), toon('#e8c15a')); s.position.set(x, -0.2, 0.34); g.add(s); const bead = solid(sphere(0.035), toon(i % 3 === 0 ? '#d9483b' : '#e8c15a'), 0.008); bead.position.set(x, -0.38, 0.34); g.add(bead); } void c; return g; },
  sailorBandana: (c) => { const g = new THREE.Group(); g.add(dome(c, '#d9483b', 0.98)); const k = solid(new THREE.ConeGeometry(0.12, 0.3, 4), toon('#d9483b'), 0.012); k.position.set(0.5, -0.3, -0.35); k.rotation.z = -1.2; g.add(k); return g; },
  fortuneHat: (c) => { const g = new THREE.Group(); g.add(dome(c, '#2b2638', 0.9)); const b = solid(new THREE.CylinderGeometry(0.75, 0.75, 0.05, 20), toon('#2b2638'), 0.015); b.position.y = -0.36; b.scale.set(1.15, 1, 1); g.add(b); void c; return g; },
  lotusCrown: (c) => { const g = new THREE.Group(); for (let i = 0; i < 6; i++) { const a = (i - 2.5) * 0.3; const p = solid(new THREE.ConeGeometry(0.1, 0.32, 5), toon('#ffe27a'), 0.012); p.position.set(Math.sin(a) * 0.3, 0.1, Math.cos(a) * 0.1); p.rotation.z = -a * 0.9; g.add(p); } g.add(ring(0.62, 0.04, c.pal.main, -0.36)); return g; },
  ratCap: (c) => { const g = new THREE.Group(); g.add(dome(c, c.pal.main, 0.95)); for (const s of [1, -1]) { const e = solid(sphere(0.2, 1, 1, 0.4), toon(c.pal.main), 0.012); e.position.set(s * 0.45, 0.1, -0.05); g.add(e); } return g; },
  hood: (c) => { const g = new THREE.Group(); g.add(dome(c, '#3a3446', 1.04)); void c; return g; },
  leafHat: (c) => { const g = new THREE.Group(); const l = solid(new THREE.ConeGeometry(0.8, 0.35, 12), toon('#6aae58'), 0.015); l.position.y = -0.12; g.add(l); void c; return g; },
};
