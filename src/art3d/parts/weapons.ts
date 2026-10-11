// 武器：握在 handR（掌心原点，杆沿 +y，刀面朝 +z）。双持类武器在 userData.offhand 里再给一把，挂到 handL。
import * as THREE from 'three';
import { solid, sphere, toon } from '../toon';
import type { PartBuilder, PartCtx } from './types';

const STEEL = '#d8e2ee';
const WOOD = '#8a5a34';
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (r0: number, r1: number, h: number, seg = 10) => new THREE.CylinderGeometry(r1, r0, h, seg);
function at<T extends THREE.Object3D>(o: T, x: number, y: number, z = 0): T { o.position.set(x, y, z); return o; }

function swordObj(c: PartCtx, len = 1.05): THREE.Group {
  const g = new THREE.Group();
  g.add(at(solid(cyl(0.045, 0.045, 0.34), toon('#4a3028'), 0.015), 0, 0));
  g.add(at(solid(box(0.34, 0.07, 0.09), toon(c.pal.trim), 0.015), 0, 0.2));
  g.add(at(solid(box(0.15, len, 0.07), toon(STEEL), 0.015), 0, 0.23 + len / 2));
  const tip = solid(new THREE.ConeGeometry(0.0925, 0.2, 4), toon(STEEL), 0.015);
  tip.rotation.y = Math.PI / 4; tip.scale.set(1, 1, 0.38);
  g.add(at(tip, 0, 0.23 + len + 0.08));
  g.add(at(solid(sphere(0.06), toon(c.pal.trim), 0.012), 0, -0.2));
  return g;
}
function pole(c: PartCtx, len: number, head: THREE.Object3D, col = WOOD): THREE.Group {
  const g = new THREE.Group();
  g.add(at(solid(cyl(0.04, 0.04, len), toon(col), 0.015), 0, len * 0.3));
  head.position.y = len * 0.8;
  g.add(head);
  void c;
  return g;
}
const bladeHead = (c: PartCtx, w: number, h: number, curved = false): THREE.Group => {
  const g = new THREE.Group();
  const b = solid(box(w, h, 0.04), toon(STEEL), 0.015);
  b.position.set(curved ? w * 0.45 : 0, h * 0.4, 0);
  g.add(b);
  g.add(at(solid(sphere(0.08), toon(c.pal.trim), 0.012), 0, 0));
  return g;
};
function bowObj(c: PartCtx): THREE.Group {
  const g = new THREE.Group();
  const arc = solid(new THREE.TorusGeometry(0.62, 0.035, 6, 24, Math.PI * 0.9), toon('#7a4a2a'), 0.015);
  arc.rotation.z = Math.PI / 2 - Math.PI * 0.45;
  g.add(at(arc, -0.5, 0.3));
  const string = new THREE.Mesh(cyl(0.006, 0.006, 1.7, 4), toon('#f3ead8'));
  g.add(at(string, -0.5 + 0.0, 0.3));
  g.add(at(solid(cyl(0.05, 0.05, 0.2), toon(c.pal.trim), 0.012), 0, 0.3));
  g.position.set(0.5, 0, 0);
  return g;
}

const mk = (f: (c: PartCtx) => THREE.Object3D): PartBuilder => f;
const withOff = (main: THREE.Object3D, off: THREE.Object3D): THREE.Object3D => { main.userData.offhand = off; return main; };

export const WEAPON: Record<string, PartBuilder> = {
  sword: mk((c) => swordObj(c)),
  dualSwords: mk((c) => withOff(swordObj(c, 0.95), swordObj(c, 0.95))),
  dualBlades: mk((c) => withOff(swordObj(c, 0.6), swordObj(c, 0.6))),
  dagger: mk((c) => swordObj(c, 0.45)),
  glaive: mk((c) => pole(c, 2.1, bladeHead(c, 0.34, 0.8, true))),
  spear: mk((c) => pole(c, 2.2, (() => { const t = solid(new THREE.ConeGeometry(0.1, 0.5, 4), toon(STEEL), 0.015); t.position.y = 0.2; const g = new THREE.Group(); g.add(t); return g; })())),
  halberd: mk((c) => pole(c, 2.2, (() => { const g = new THREE.Group(); g.add(at(solid(new THREE.ConeGeometry(0.08, 0.5, 4), toon(STEEL), 0.015), 0, 0.2)); for (const s of [1, -1]) g.add(at(solid(box(0.28, 0.1, 0.035), toon(STEEL), 0.015), s * 0.15, 0.0)); return g; })())),
  axe: mk((c) => pole(c, 1.9, (() => { const g = new THREE.Group(); g.add(at(solid(box(0.4, 0.5, 0.05), toon(STEEL), 0.015), 0.2, 0, 0)); return g; })())),
  mace: mk((c) => pole(c, 1.2, at(solid(sphere(0.2), toon('#8a7a68'), 0.02), 0, 0.05))),
  staff: mk((c) => pole(c, 2.0, at(solid(sphere(0.14), toon(c.pal.trim), 0.02), 0, 0.1), '#7a5a3a')),
  whip: mk((c) => pole(c, 1.0, at(solid(new THREE.TorusGeometry(0.3, 0.03, 6, 16), toon('#4a3a30'), 0.012), 0.3, 0.1))),
  hooks: mk((c) => withOff(pole(c, 0.9, bladeHead(c, 0.2, 0.5, true)), pole(c, 0.9, bladeHead(c, 0.2, 0.5, true)))),
  knives: mk((c) => swordObj(c, 0.4)),
  bow: mk((c) => bowObj(c)),
  crossbow: mk((c) => { const g = bowObj(c); g.scale.setScalar(0.7); return g; }),
  slingshot: mk((c) => { const g = new THREE.Group(); g.add(at(solid(cyl(0.04, 0.04, 0.4), toon(WOOD), 0.012), 0, 0.1)); for (const s of [1, -1]) { const a = solid(cyl(0.035, 0.035, 0.3), toon(WOOD), 0.012); a.position.set(s * 0.09, 0.4, 0); a.rotation.z = -s * 0.4; g.add(a); } void c; return g; }),
  fan: mk((c) => { const g = new THREE.Group(); g.add(at(solid(cyl(0.03, 0.03, 0.4), toon(WOOD), 0.012), 0, 0)); const f = solid(new THREE.CircleGeometry(0.42, 18, 0, Math.PI), toon('#f6efe0'), 0.012); f.material = toon('#f6efe0'); (f.material as THREE.Material).side = THREE.DoubleSide; f.position.set(0, 0.2, 0); g.add(f); const trim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.02, 4, 18, Math.PI), toon(c.pal.main)); trim.position.set(0, 0.2, 0); g.add(trim); return g; }),
  whisk: mk((c) => { const g = new THREE.Group(); g.add(at(solid(cyl(0.03, 0.03, 0.5), toon(WOOD), 0.012), 0, 0.05)); g.add(at(solid(sphere(0.12, 1, 2.6, 1), toon('#f4f0ea'), 0.012), 0, 0.5)); void c; return g; }),
  qin: mk((c) => { const g = new THREE.Group(); g.add(at(solid(box(0.28, 1.0, 0.1), toon('#5a3a28'), 0.015), 0, 0.2)); g.add(at(new THREE.Mesh(box(0.2, 0.9, 0.02), toon(c.pal.trim)), 0, 0.2, 0.06)); g.rotation.z = -0.3; return g; }),
  scroll: mk((c) => { const g = new THREE.Group(); const s = solid(cyl(0.1, 0.1, 0.55, 14), toon('#f1e6c8'), 0.015); s.rotation.z = Math.PI / 2; g.add(at(s, 0, 0.1)); for (const x of [-0.3, 0.3]) g.add(at(solid(cyl(0.06, 0.06, 0.1), toon(c.pal.trim), 0.012), x, 0.1)); return g; }),
  talisman: mk((c) => { const g = new THREE.Group(); const p = solid(box(0.26, 0.5, 0.02), toon('#f6e08a'), 0.012); p.position.set(0, 0.25, 0.1); g.add(p); const m = new THREE.Mesh(box(0.14, 0.3, 0.005), toon(c.pal.main)); m.position.set(0, 0.25, 0.115); g.add(m); return g; }),
  brush: mk((c) => { const g = new THREE.Group(); g.add(at(solid(cyl(0.035, 0.035, 1.3), toon('#6a4a30'), 0.012), 0, 0.3)); const t = solid(new THREE.ConeGeometry(0.1, 0.4, 8), toon('#2a1c20'), 0.012); t.position.y = 1.15; g.add(t); void c; return g; }),
  drum: mk((c) => { const g = new THREE.Group(); const d = solid(cyl(0.3, 0.3, 0.38, 16), toon(c.pal.main), 0.02); d.position.y = 0.25; g.add(d); for (const y of [0.06, 0.44]) g.add(at(solid(cyl(0.31, 0.31, 0.04, 16), toon(c.pal.trim), 0.012), 0, y)); return g; }),
  coins: mk((c) => { const g = new THREE.Group(); for (let i = 0; i < 3; i++) { const t = solid(new THREE.TorusGeometry(0.15, 0.04, 6, 14), toon('#e8c15a'), 0.012); t.position.set(0, 0.2 + i * 0.12, 0.05); t.rotation.x = Math.PI / 2; g.add(t); } void c; return g; }),
  coinsPlain: mk((c) => WEAPON.coins(c)),
  herbs: mk((c) => { const g = new THREE.Group(); for (let i = 0; i < 4; i++) { const l = solid(new THREE.ConeGeometry(0.1, 0.5, 4), toon(i % 2 ? '#5aa850' : '#7cc464'), 0.012); l.position.set((i - 1.5) * 0.1, 0.35, 0.02); l.rotation.z = (i - 1.5) * 0.28; g.add(l); } g.add(at(solid(cyl(0.03, 0.03, 0.3), toon('#6a8a3a'), 0.01), 0, 0)); void c; return g; }),
  shield: mk((c) => { const s = solid(cyl(0.4, 0.4, 0.07, 18), toon('#a87a4a'), 0.02); s.rotation.x = Math.PI / 2; s.position.set(0, 0.2, 0.3); const g = new THREE.Group(); g.add(s); g.add(at(solid(cyl(0.12, 0.12, 0.09, 12), toon(c.pal.trim), 0.012), 0, 0.2, 0.32)).rotation.x = Math.PI / 2; return g; }),
  boxShield: mk((c) => { const g = new THREE.Group(); g.add(at(solid(box(0.7, 0.8, 0.08), toon('#c9a26a'), 0.02), 0, 0.2, 0.3)); void c; return g; }),
};
