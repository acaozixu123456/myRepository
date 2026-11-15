// 萤火虫：夜里贴着草地和溪边飘的小光点，一闪一闪。只在镜头周围一块地方（走远了就从另一边补上来），
// 位置在 CPU 上只在补位时算一次高度，飘动和闪烁都在着色器里。
import * as THREE from 'three';
import { U } from './atmo.js';

const N = 300, R = 25;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function makeFireflies(land) {
  const pos = new Float32Array(N * 3), info = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() * 2 - 1) * R; pos[i * 3 + 1] = -1e4; pos[i * 3 + 2] = (Math.random() * 2 - 1) * R;
    info.set([Math.random() * 100, 0.6 + Math.random() * 0.8, Math.random(), 1], i * 4);
  }
  const geo = new THREE.BufferGeometry();
  const P = new THREE.BufferAttribute(pos, 3), I = new THREE.BufferAttribute(info, 4);
  geo.setAttribute('position', P); geo.setAttribute('aInfo', I);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uAmt: { value: 0 }, uPx: { value: 1200 } },
    vertexShader: /* glsl */`
      attribute vec4 aInfo; uniform float uTime; uniform float uPx; uniform float uAmt;
      varying float vA;
      void main() {
        float ph = aInfo.x, sp = aInfo.y, t = uTime;
        vec3 p = position + vec3(
          sin( t * 0.37 * sp + ph ) * 1.2 + sin( t * 0.93 * sp + ph * 2.1 ) * 0.35,
          sin( t * 0.52 * sp + ph * 1.7 ) * 0.4,
          cos( t * 0.31 * sp + ph * 0.7 ) * 1.2 + cos( t * 0.81 * sp + ph * 1.3 ) * 0.35 );
        vec4 mv = modelViewMatrix * vec4( p, 1.0 );
        gl_Position = projectionMatrix * mv;
        float d = max( -mv.z, 0.1 );
        float blink = 0.3 + 0.7 * pow( max( sin( t * ( 0.7 + aInfo.z * 0.9 ) + ph * 3.0 ), 0.0 ), 2.0 );
        vA = blink * aInfo.w * uAmt * ( 1.0 - smoothstep( 18.0, 26.0, d ) );
        gl_PointSize = clamp( uPx * 0.36 / d, 3.0, 44.0 );
        if ( vA < 0.01 ) gl_Position = vec4( 0.0, 0.0, 2.0, 1.0 );   // 不亮的挪到画面外
      }`,
    fragmentShader: /* glsl */`
      varying float vA;
      void main() {
        float r = length( gl_PointCoord - 0.5 ) * 2.0;
        float h = 1.0 - smoothstep( 0.0, 1.0, r );
        float a = ( h * h * 0.4 + smoothstep( 0.24, 0.0, r ) * 1.1 ) * vA;
        gl_FragColor = vec4( vec3( 0.86, 1.0, 0.42 ) * a * 1.5, 1.0 );   // 叠加：颜色直接加上去
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.name = 'fireflies'; pts.frustumCulled = false; pts.renderOrder = 6; pts.visible = false;
  let placed = false;
  // focus：围着谁；amt：0~1（夜里多亮）；px：一米在一米远处有多少像素
  pts.userData.update = (focus, amt, px) => {
    mat.uniforms.uAmt.value = amt; mat.uniforms.uPx.value = px;
    pts.visible = amt > 0.01;
    if (!pts.visible) return;
    let moved = false;
    for (let i = 0; i < N; i++) {
      let x = pos[i * 3], z = pos[i * 3 + 2], m = !placed;
      if (x - focus.x > R) { x -= 2 * R; m = true; } else if (x - focus.x < -R) { x += 2 * R; m = true; }
      if (z - focus.z > R) { z -= 2 * R; m = true; } else if (z - focus.z < -R) { z += 2 * R; m = true; }
      if (!placed) { x = focus.x + (Math.random() * 2 - 1) * R; z = focus.z + (Math.random() * 2 - 1) * R; }
      if (!m) continue;
      moved = true;
      pos[i * 3] = x; pos[i * 3 + 2] = z;
      pos[i * 3 + 1] = land.height(x, z) + 0.35 + Math.random() * Math.random() * 2.2;
      // 溪边多一些，高处和路上少一些
      const sd = land.streamDist(x, z), rd = land.roadDist(x, z);
      info[i * 4 + 3] = (0.45 + 0.55 * (1 - sstep(4, 34, sd))) * (0.5 + 0.5 * sstep(1.5, 4, rd));
    }
    placed = true;
    if (moved) { P.needsUpdate = true; I.needsUpdate = true; }
  };
  return pts;
}
