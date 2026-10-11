// 衣服：挂在 torso（髋部原点）。肩在 (±0.52, 1.0, 0)，脖子根 (0, 1.3, 0)。
// 底版：一件车削出来的长袍（袍 / 裙 / 铠 / 兽皮 都用同一个造型，颜色与配件不同）。
import * as THREE from 'three';
import { solid, toon } from '../toon';
import type { PartBuilder, PartCtx } from './types';

/** 车削袍身：y 从下摆(≈-0.36)到领口(≈1.32)。下摆（腰以下）挂在 hip 上，不会跟着上身前倾翻起来：放进 userData.skirt，由 cat3d 挪到 hip。 */
function robe(c: PartCtx, o: { hem: number; waist: number; chest: number; col?: string; trimCol?: string; collar?: boolean }): THREE.Group {
  const g = new THREE.Group();
  const skirt = new THREE.Group();
  const col = o.col ?? c.pal.main;
  const b = c.look.build ?? 1;
  const P = ([[o.hem, -0.36], [o.hem * 0.92, 0.05], [o.waist, 0.42], [o.chest, 0.85], [0.42, 1.18], [0.24, 1.32]] as [number, number][]).map(([r, y]) => new THREE.Vector2(r * b, y));
  const mat = toon(col, { double: true });
  skirt.add(solid(new THREE.LatheGeometry(P.slice(0, 3), 28), mat, 0.024));
  g.add(solid(new THREE.LatheGeometry(P.slice(2), 28), mat, 0.024));
  // 下摆封底：腿分开 / 低头时不会看到袍子里面
  const cap = new THREE.Mesh(new THREE.CircleGeometry(o.hem * b * 0.98, 24), toon('#2a2230', { double: true }));
  cap.rotation.x = Math.PI / 2; cap.position.y = -0.3;
  skirt.add(cap);
  const hemRing = solid(new THREE.TorusGeometry(o.hem * b * 0.99, 0.035, 6, 28), toon(o.trimCol ?? c.pal.trim), 0.01);
  hemRing.rotation.x = Math.PI / 2; hemRing.position.y = -0.34;
  skirt.add(hemRing);
  const belt = solid(new THREE.TorusGeometry(o.waist * b * 1.02, 0.06, 6, 24), toon(c.pal.sub), 0.012);
  belt.rotation.x = Math.PI / 2; belt.position.y = 0.5;
  g.add(belt);
  const buckle = solid(new THREE.CylinderGeometry(0.075, 0.075, 0.04, 12), toon(c.pal.trim), 0.01);
  buckle.rotation.x = Math.PI / 2; buckle.position.set(0, 0.5, o.waist * b * 1.05);
  g.add(buckle);
  if (o.collar !== false) {
    const col2 = solid(new THREE.TorusGeometry(0.3, 0.05, 6, 20), toon(c.pal.trim), 0.01);
    col2.rotation.x = Math.PI / 2; col2.position.y = 1.28;
    g.add(col2);
  }
  g.userData.skirt = skirt;
  return g;
}
function pads(_c: PartCtx, col: string): THREE.Group {
  const g = new THREE.Group();
  for (const s of [1, -1]) { const p = solid(new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(col), 0.015); p.position.set(s * 0.55, 1.06, 0); p.rotation.z = -s * 0.35; g.add(p); }
  return g;
}

export const BODY: Record<string, PartBuilder> = {
  robeScholar: (c) => robe(c, { hem: 0.62, waist: 0.4, chest: 0.5 }),
  robeTaoist: (c) => robe(c, { hem: 0.68, waist: 0.42, chest: 0.5 }),
  robeSilk: (c) => robe(c, { hem: 0.72, waist: 0.4, chest: 0.5 }),
  dress: (c) => robe(c, { hem: 0.78, waist: 0.38, chest: 0.48 }),
  vest: (c) => { const g = robe(c, { hem: 0.5, waist: 0.42, chest: 0.5 }); return g; },
  armorWei: (c) => { const g = robe(c, { hem: 0.58, waist: 0.44, chest: 0.54, col: c.pal.main }); g.add(pads(c, c.pal.trim)); return g; },
  armorHeavy: (c) => { const g = robe(c, { hem: 0.6, waist: 0.48, chest: 0.58, col: '#5c6678' }); g.add(pads(c, c.pal.main)); return g; },
  armorLight: (c) => { const g = robe(c, { hem: 0.55, waist: 0.42, chest: 0.5 }); g.add(pads(c, c.pal.sub)); return g; },
  tribal: (c) => { const g = robe(c, { hem: 0.5, waist: 0.4, chest: 0.4, col: '#b88a54', trimCol: '#efe6d2', collar: false }); return g; },
  rattan: (c) => { const g = robe(c, { hem: 0.56, waist: 0.44, chest: 0.52, col: '#b08a54' }); g.add(pads(c, '#8a6a3a')); return g; },
};
