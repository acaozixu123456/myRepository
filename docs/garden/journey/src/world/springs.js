// 冰湖边的温泉：雪坡下面一小块石滩，几个冒着白汽的池子，水是乳蓝色的；池边一圈圆石头，石头上不积雪。
// 泡进去身上就暖和了、气力回满（game/journey.js bodyTick）。夜里晴天，头顶常有极光（world/sky.js、skyfx.js）。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SPRINGS } from './route.js';
import { U, FOG_FN, patch } from './atmo.js';
import { SKY } from './sky.js';
import { RIPPLE_GLSL } from './ripples.js';
import { MIST_VS, MIST_FS } from './water.js';
import { part, ico } from './forage.js';
import { rng } from './noise.js';

const VS = /* glsl */`
attribute float aQ; varying vec3 vWP; varying float vQ;
void main() { vec4 w = modelMatrix * vec4( position, 1.0 ); vWP = w.xyz; vQ = aQ; gl_Position = projectionMatrix * viewMatrix * w; }`;
const FS = /* glsl */`
uniform float uTime; uniform vec3 uSunColor; uniform vec3 uZenith; uniform vec3 uMid; uniform vec3 uAmb; uniform float uAurora;
${FOG_FN}
${RIPPLE_GLSL}
varying vec3 vWP; varying float vQ;
float h21( vec2 p ) { p = fract( p * vec2( 123.34, 456.21 ) ); p += dot( p, p + 45.32 ); return fract( p.x * p.y ); }
float vn( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( h21( i ), h21( i + vec2( 1, 0 ) ), f.x ), mix( h21( i + vec2( 0, 1 ) ), h21( i + 1.0 ), f.x ), f.y ); }
void main() {
  float t = uTime; vec2 p = vWP.xz;
  vec3 V = normalize( cameraPosition - vWP );
  float n1 = vn( p * 1.6 + vec2( t * 0.12, -t * 0.08 ) ), n2 = vn( p * 3.7 - vec2( t * 0.2, t * 0.15 ) );
  vec3 rp = jRipples( p, t );
  vec3 N = normalize( vec3( ( n1 - 0.5 ) * 0.16 + rp.x * 0.5, 1.0, ( n2 - 0.5 ) * 0.16 + rp.y * 0.5 ) );
  // 乳蓝色的水：中间深一点、蓝一点，边上浅、发白发绿；水自己像是会发一点光（夜里也看得出是蓝的）
  vec3 light = uAmb * 0.42 + uSunColor * max( uSunDir.y, 0.0 ) * 1.0;
  vec3 milk = mix( vec3( 0.62, 0.86, 0.84 ), vec3( 0.3, 0.66, 0.8 ), smoothstep( 0.9, 0.2, vQ ) ) * ( 0.92 + 0.16 * n1 );
  vec3 col = milk * light + vec3( 0.008, 0.03, 0.04 );
  // 一股股翻上来的热水
  col += vec3( 0.2, 0.26, 0.26 ) * light * smoothstep( 0.62, 0.9, vn( p * 2.2 + vec2( 0.0, t * 0.5 ) ) * n2 * 1.8 );
  vec3 R = reflect( -V, N );
  vec3 sky = mix( jFogColor( normalize( vec3( R.x, max( R.y, 0.0 ), R.z ) ) ), mix( uMid, uZenith, 0.5 ), smoothstep( 0.02, 0.4, R.y ) );
  sky += vec3( 0.1, 0.55, 0.32 ) * uAurora * 0.35;
  float fres = 0.04 + 0.96 * pow( 1.0 - max( dot( V, N ), 0.0 ), 4.0 );
  col = mix( col, sky, fres * 0.6 );
  col += uSunColor * pow( max( dot( reflect( -uSunDir, N ), V ), 0.0 ), 120.0 ) * 1.6;
  col = mix( col, vec3( 0.95 ) * light, clamp( rp.z, 0.0, 1.0 ) * 0.5 );
  // 池边一圈白白的水垢
  float a = smoothstep( 1.02, 0.9, vQ + ( n2 - 0.5 ) * 0.1 );
  col = mix( vec3( 0.9, 0.9, 0.84 ) * light, col, smoothstep( 1.0, 0.86, vQ + ( n1 - 0.5 ) * 0.12 ) );
  col = jFog( col, vWP );
  gl_FragColor = vec4( col, a * 0.94 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function buildSprings(land) {
  const g = new THREE.Group(); g.name = 'springs';
  const R = rng(9191), pos = [], aq = [], idx = [], stones = [], steam = [], seed = [], blocks = [];
  for (const [px, pz, r] of SPRINGS.pools) {
    // 水面：一个圆盘，比池子大一点（多出来的被岸上的地面盖住）
    const b = pos.length / 3, segs = 28, rr = r + 0.45;
    pos.push(px, SPRINGS.y - 0.03, pz); aq.push(0);
    for (let k = 0; k < 2; k++) for (let i = 0; i < segs; i++) { const a = i / segs * 6.283, q = k ? 1 : 0.55; pos.push(px + Math.cos(a) * rr * q, SPRINGS.y - 0.03, pz + Math.sin(a) * rr * q); aq.push(q); }
    for (let i = 0; i < segs; i++) { const j = (i + 1) % segs; idx.push(b, b + 1 + j, b + 1 + i, b + 1 + i, b + 1 + j, b + 1 + segs + i, b + 1 + j, b + 1 + segs + j, b + 1 + segs + i); }
    // 池边的圆石头
    const n = Math.round(r * 5.2);
    for (let i = 0; i < n; i++) {
      if (R() < 0.22) continue;        // 留几个缺口好下水
      const a = i / n * 6.283 + R() * 0.2, d = r + 0.35 + R() * 0.35, x = px + Math.cos(a) * d, z = pz + Math.sin(a) * d, s = 0.2 + R() * 0.26;
      stones.push(part(ico(s, 1), ['#8c8a84', '#a09a8e', '#77756f', '#b0a890'][i % 4], { p: [x, land.heightExact(x, z) + s * 0.25, z], r: [R() * 3, R() * 3, R() * 3], s: [1.15, 0.72, 1] }));
      if (s > 0.36) blocks.push([x, z, s * 0.8]);
    }
    // 白汽
    const m = Math.round(r * r * 1.1) + 2;
    for (let i = 0; i < m; i++) { const a = R() * 6.283, d = Math.sqrt(R()) * r * 0.85; steam.push(px + Math.cos(a) * d, SPRINGS.y + 0.1, pz + Math.sin(a) * d); seed.push(R()); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('aQ', new THREE.Float32BufferAttribute(aq, 1)); geo.setIndex(idx); geo.computeBoundingSphere();
  const uni = { ...U, uZenith: SKY.uZenith, uMid: SKY.uMid, uAurora: SKY.uAurora };
  const water = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: uni, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  water.renderOrder = 2; water.matrixAutoUpdate = false; g.add(water);
  const smat = new THREE.MeshLambertMaterial({ vertexColors: true });
  patch(smat, { rim: 0.08, gobo: false, fog: true, shadowFade: true });
  const st = new THREE.Mesh(mergeGeometries(stones), smat); st.castShadow = true; st.receiveShadow = true; st.matrixAutoUpdate = false; g.add(st);
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(steam, 3)); sg.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
  sg.computeBoundingSphere(); sg.boundingSphere.radius += 6;
  const mm = new THREE.ShaderMaterial({ uniforms: { uTime: U.uTime, uScale: { value: 400 }, uColor: { value: new THREE.Color(0.95, 0.97, 0.98) } }, vertexShader: MIST_VS, fragmentShader: MIST_FS, transparent: true, depthWrite: false });
  const pts = new THREE.Points(sg, mm); pts.renderOrder = 3; pts.matrixAutoUpdate = false;
  pts.onBeforeRender = (r, sc, cam) => { mm.uniforms.uScale.value = 1.15 * r.domElement.height / (2 * Math.tan(cam.fov * Math.PI / 360)); };
  g.add(pts);
  g.userData = { blocks, steamColor: mm.uniforms.uColor.value };
  return g;
}
