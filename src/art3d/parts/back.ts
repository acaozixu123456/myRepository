// 披挂：挂在 back（torso 内 (0, 0.95, -0.45)，向后为 -z）。
import * as THREE from 'three';
import { solid, toon } from '../toon';
import type { PartBuilder } from './types';
import { capeLong, ribbons, wings } from './back-sp-regalia';
import { cape, furCloak, gourd } from './back-fieldgear';

export const BACK: Record<string, PartBuilder> = {
  cape,
  capeLong,
  banner: (c) => { const g = new THREE.Group(); const p = solid(new THREE.CylinderGeometry(0.03, 0.03, 1.9, 6), toon('#6a4a30'), 0.012); p.position.set(0.3, 0.5, -0.1); g.add(p); const f = solid(new THREE.BoxGeometry(0.5, 0.7, 0.03), toon(c.pal.main), 0.015); f.position.set(0.58, 1.0, -0.1); g.add(f); return g; },
  wings,
  scrollBack: (c) => { const g = new THREE.Group(); const s = solid(new THREE.CylinderGeometry(0.1, 0.1, 0.9, 10), toon('#f1e6c8'), 0.015); s.rotation.z = 0.9; s.position.set(0, 0.2, -0.1); g.add(s); void c; return g; },
  gourd,
  furCloak,
  ribbons,
};
