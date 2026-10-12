// 配饰：挂在 head（头部局部坐标，脸朝 +z，眼睛在 y≈+0.16）。
import * as THREE from 'three';
import { solid, toon } from '../toon';
import type { PartBuilder } from './types';
import { beardLong, eyepatch, redFace } from './extras-veterans';
import { earBaseHoop, hangingCollarBell, softGoatBeard } from './extras-regalia';

const hidden = (): THREE.Object3D => new THREE.Group();
export const EXTRA: Record<string, PartBuilder> = {
  eyepatch,
  scar: () => { const g = new THREE.Group(); const s = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.3, 0.01), toon('#c0392b')); s.position.set(0.25, 0.1, 0.62); s.rotation.z = 0.5; g.add(s); return g; },
  beardLong,
  beardGoat: softGoatBeard,
  bell: hangingCollarBell,
  scarf: (c) => { const g = new THREE.Group(); const r = solid(new THREE.TorusGeometry(0.4, 0.08, 6, 20), toon(c.pal.sub), 0.012); r.rotation.x = Math.PI / 2; r.position.y = -0.4; g.add(r); return g; },
  redFace,
  warPaint: () => { const g = new THREE.Group(); for (const s of [1, -1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.025, 0.01), toon('#d9483b')); m.position.set(s * 0.4, -0.02, 0.5); m.rotation.y = s * 0.8; g.add(m); } return g; },
  monocle: () => { const g = new THREE.Group(); const r = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.015, 6, 16), toon('#e8c15a')); r.position.set(0.27, 0.16, 0.63); g.add(r); return g; },
  earring: earBaseHoop,
  glowEyes: hidden,
  tassel: (c) => { const g = new THREE.Group(); const t = solid(new THREE.ConeGeometry(0.06, 0.3, 6), toon(c.pal.sub), 0.01); t.position.set(0.45, -0.1, -0.3); t.rotation.x = Math.PI; g.add(t); return g; },
};
