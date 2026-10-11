// 配饰：挂在 head（头部局部坐标，脸朝 +z，眼睛在 y≈+0.16）。
import * as THREE from 'three';
import { solid, sphere, toon } from '../toon';
import type { PartBuilder } from './types';

const hidden = (): THREE.Object3D => new THREE.Group();
export const EXTRA: Record<string, PartBuilder> = {
  eyepatch: () => { const g = new THREE.Group(); const p = solid(sphere(0.17, 1, 1, 0.3), toon('#2a2230'), 0.01); p.position.set(-0.27, 0.16, 0.56); g.add(p); const b = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.012, 4, 24), toon('#2a2230')); b.position.y = 0.16; b.rotation.x = Math.PI / 2; g.add(b); return g; },
  scar: () => { const g = new THREE.Group(); const s = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.3, 0.01), toon('#c0392b')); s.position.set(0.25, 0.1, 0.62); s.rotation.z = 0.5; g.add(s); return g; },
  beardLong: () => { const g = new THREE.Group(); const b = solid(sphere(0.2, 1, 2.2, 0.5), toon('#f4efe6'), 0.012); b.position.set(0, -0.62, 0.45); g.add(b); return g; },
  beardGoat: () => { const g = new THREE.Group(); const b = solid(new THREE.ConeGeometry(0.08, 0.3, 6), toon('#f4efe6'), 0.01); b.position.set(0, -0.42, 0.55); b.rotation.x = Math.PI; g.add(b); return g; },
  bell: () => { const g = new THREE.Group(); const r = solid(new THREE.TorusGeometry(0.4, 0.04, 6, 20), toon('#d9483b'), 0.01); r.rotation.x = Math.PI / 2; r.position.y = -0.38; g.add(r); const b = solid(sphere(0.07), toon('#ffd24a'), 0.01); b.position.set(0, -0.46, 0.4); g.add(b); return g; },
  scarf: (c) => { const g = new THREE.Group(); const r = solid(new THREE.TorusGeometry(0.4, 0.08, 6, 20), toon(c.pal.sub), 0.012); r.rotation.x = Math.PI / 2; r.position.y = -0.4; g.add(r); return g; },
  redFace: hidden,
  warPaint: () => { const g = new THREE.Group(); for (const s of [1, -1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.025, 0.01), toon('#d9483b')); m.position.set(s * 0.4, -0.02, 0.5); m.rotation.y = s * 0.8; g.add(m); } return g; },
  monocle: () => { const g = new THREE.Group(); const r = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.015, 6, 16), toon('#e8c15a')); r.position.set(0.27, 0.16, 0.63); g.add(r); return g; },
  earring: () => { const g = new THREE.Group(); const r = solid(sphere(0.05), toon('#e8c15a'), 0.008); r.position.set(0.5, 0.2, 0.0); g.add(r); return g; },
  glowEyes: hidden,
  tassel: (c) => { const g = new THREE.Group(); const t = solid(new THREE.ConeGeometry(0.06, 0.3, 6), toon(c.pal.sub), 0.01); t.position.set(0.45, -0.1, -0.3); t.rotation.x = Math.PI; g.add(t); return g; },
};
