// 配饰：挂在 head（头部局部坐标，脸朝 +z，眼睛在 y≈+0.16）。
import * as THREE from 'three';
import { solid, toon } from '../toon';
import type { PartBuilder } from './types';
import { beardLong, eyepatch, redFace } from './extras-veterans';
import { cheekWarPaint, luminousEyeCorners, sideKnotTassel } from './extra-sp-marks';
import { earBaseHoop, hangingCollarBell, softGoatBeard } from './extras-regalia';

export const EXTRA: Record<string, PartBuilder> = {
  eyepatch,
  scar: () => { const g = new THREE.Group(); const s = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.3, 0.01), toon('#c0392b')); s.position.set(0.25, 0.1, 0.62); s.rotation.z = 0.5; g.add(s); return g; },
  beardLong,
  beardGoat: softGoatBeard,
  bell: hangingCollarBell,
  scarf: (c) => { const g = new THREE.Group(); const r = solid(new THREE.TorusGeometry(0.4, 0.08, 6, 20), toon(c.pal.sub), 0.012); r.rotation.x = Math.PI / 2; r.position.y = -0.4; g.add(r); return g; },
  redFace,
  warPaint: cheekWarPaint,
  monocle: () => { const g = new THREE.Group(); const r = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.015, 6, 16), toon('#e8c15a')); r.position.set(0.27, 0.16, 0.63); g.add(r); return g; },
  earring: earBaseHoop,
  glowEyes: luminousEyeCorners,
  tassel: sideKnotTassel,
};
