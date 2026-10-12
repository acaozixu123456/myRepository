// 披挂：挂在 back（torso 内 (0, 0.95, -0.45)，向后为 -z）。
import * as THREE from 'three';
import { solid, sphere, toon } from '../toon';
import type { PartBuilder, PartCtx } from './types';
import { capeLong, ribbons, wings } from './back-sp-regalia';

const capeMesh = (c: PartCtx, len: number, col: string): THREE.Group => {
  const g = new THREE.Group();
  // 一块有弧度、下摆外扩的披风：肩部窄、下摆宽，向后微微飘
  const geo = new THREE.PlaneGeometry(1.25, len, 10, 8);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const t = (0.5 - y / len); // 0 肩 → 1 下摆
    const wid = 0.62 + t * 0.55;
    pos.setX(i, x * wid);
    pos.setZ(i, -0.12 - t * 0.38 + Math.cos((x / 0.62) * 1.2) * 0.1 * (1 - t * 0.4) + Math.sin(t * 5 + x * 3) * 0.02 * t);
  }
  geo.computeVertexNormals();
  const m = solid(geo, toon(col, { double: true }), 0.02);
  m.position.set(0, -len / 2 + 0.15, 0);
  g.add(m);
  const hem = solid(new THREE.BoxGeometry(1.5, 0.07, 0.04), toon(c.pal.trim), 0.01);
  hem.position.set(0, -len + 0.16, -0.5);
  g.add(hem);
  return g;
};
export const BACK: Record<string, PartBuilder> = {
  cape: (c) => capeMesh(c, 1.2, c.pal.sub),
  capeLong,
  banner: (c) => { const g = new THREE.Group(); const p = solid(new THREE.CylinderGeometry(0.03, 0.03, 1.9, 6), toon('#6a4a30'), 0.012); p.position.set(0.3, 0.5, -0.1); g.add(p); const f = solid(new THREE.BoxGeometry(0.5, 0.7, 0.03), toon(c.pal.main), 0.015); f.position.set(0.58, 1.0, -0.1); g.add(f); return g; },
  wings,
  scrollBack: (c) => { const g = new THREE.Group(); const s = solid(new THREE.CylinderGeometry(0.1, 0.1, 0.9, 10), toon('#f1e6c8'), 0.015); s.rotation.z = 0.9; s.position.set(0, 0.2, -0.1); g.add(s); void c; return g; },
  gourd: (c) => { const g = new THREE.Group(); const a = solid(sphere(0.2), toon('#c98a3a'), 0.015); a.position.set(0.3, -0.2, -0.1); const b = solid(sphere(0.14), toon('#c98a3a'), 0.015); b.position.set(0.3, 0.05, -0.1); g.add(a, b); void c; return g; },
  furCloak: (c) => capeMesh(c, 1.0, '#a8845a'),
  ribbons,
};
