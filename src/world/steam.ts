// 蒸汽 / 烟雾：几处排气口不断冒出缓缓上升、逐渐变大变淡的白气。用一个 Points（1 次绘制）。
import * as THREE from 'three';
import { glowTex } from './tex';

export interface Steam { group: THREE.Group; update(dt: number): void }
export function buildSteam(vents: [number, number, number][], tint = 0xb8a8d8): Steam {
  const g = new THREE.Group();
  const per = 7, n = vents.length * per;
  const pos = new Float32Array(n * 3), alpha = new Float32Array(n), size = new Float32Array(n);
  const st = Array.from({ length: n }, (_, i) => ({ v: vents[Math.floor(i / per)], age: Math.random() * 3, life: 2.6 + Math.random(), ox: (Math.random() - 0.5) * 0.4, oz: (Math.random() - 0.5) * 0.4 }));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTex: { value: glowTex() }, uColor: { value: new THREE.Color(tint) }, uScale: { value: 260 } },
    vertexShader: 'attribute float aAlpha;attribute float aSize;varying float vA;uniform float uScale;void main(){vA=aAlpha;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=aSize*uScale/-mv.z;gl_Position=projectionMatrix*mv;}',
    fragmentShader: 'uniform sampler2D uTex;uniform vec3 uColor;varying float vA;void main(){vec4 t=texture2D(uTex,gl_PointCoord);gl_FragColor=vec4(uColor,t.a*vA);}',
    transparent: true, depthWrite: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  g.add(pts);
  return {
    group: g,
    update(dt) {
      for (let i = 0; i < n; i++) {
        const p = st[i];
        p.age += dt; if (p.age > p.life) p.age -= p.life;
        const k = p.age / p.life;
        pos[i * 3] = p.v[0] + p.ox + k * 0.8; pos[i * 3 + 1] = p.v[1] + k * 5.5; pos[i * 3 + 2] = p.v[2] + p.oz;
        size[i] = 1.2 + k * 3.4;
        alpha[i] = Math.sin(Math.min(1, k) * Math.PI) * 0.32;
      }
      (geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (geo.getAttribute('aAlpha') as THREE.BufferAttribute).needsUpdate = true;
      (geo.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true;
    },
  };
}
