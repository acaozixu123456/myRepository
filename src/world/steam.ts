// 蒸汽 / 烟雾：几处排气口不断冒出缓缓上升、逐渐变大变淡的白气。
import * as THREE from 'three';
import { glowTex } from './tex';

export interface Steam { group: THREE.Group; update(dt: number): void }
export function buildSteam(vents: [number, number, number][], tint = 0xb8a8d8): Steam {
  const g = new THREE.Group();
  const tex = glowTex();
  const ps: { s: THREE.Sprite; v: THREE.Vector3; age: number; life: number; o: THREE.Vector3 }[] = [];
  for (const v of vents) for (let i = 0; i < 9; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: tint, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
    g.add(s); ps.push({ s, v: new THREE.Vector3(...v), age: Math.random() * 3, life: 2.6 + Math.random(), o: new THREE.Vector3((Math.random() - 0.5) * 0.4, 0, (Math.random() - 0.5) * 0.4) });
  }
  return {
    group: g,
    update(dt) {
      for (const p of ps) {
        p.age += dt; if (p.age > p.life) p.age -= p.life;
        const k = p.age / p.life;
        p.s.position.set(p.v.x + p.o.x + k * 0.8, p.v.y + k * 5.5, p.v.z + p.o.z);
        p.s.scale.setScalar(1.2 + k * 3.4);
        (p.s.material as THREE.SpriteMaterial).opacity = Math.sin(Math.min(1, k) * Math.PI) * 0.32;
      }
    },
  };
}
