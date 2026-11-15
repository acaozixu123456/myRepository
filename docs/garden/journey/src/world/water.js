// 小溪：沿溪的带状网格。浅处透出河床，水纹顺流而下，逆光时满溪碎金。
import * as THREE from 'three';
import { STREAM } from './route.js';
import { DOM, waterY, bankW } from './land.js';
import { U, FOG_FN } from './atmo.js';
import { SKY } from './sky.js';

const VS = /* glsl */`
attribute float aDepth;
varying vec2 vUv; varying vec3 vWP; varying float vDepth;
void main() {
  vUv = uv; vDepth = aDepth;
  vec4 w = modelMatrix * vec4( position, 1.0 ); vWP = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const FS = /* glsl */`
uniform float uTime; uniform vec3 uSunColor; uniform vec3 uZenith; uniform vec3 uMid;
uniform vec3 uShallow; uniform vec3 uDeep; uniform vec3 uFoam;
${FOG_FN}
varying vec2 vUv; varying vec3 vWP; varying float vDepth;
float h21( vec2 p ) { p = fract( p * vec2( 123.34, 456.21 ) ); p += dot( p, p + 45.32 ); return fract( p.x * p.y ); }
float vn( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( h21( i ), h21( i + vec2( 1, 0 ) ), f.x ), mix( h21( i + vec2( 0, 1 ) ), h21( i + 1.0 ), f.x ), f.y ); }
void main() {
  float t = uTime;
  float depth = clamp( vDepth / 0.75, 0.0, 1.0 );
  vec3 col = mix( uShallow, uDeep, smoothstep( 0.0, 0.9, depth ) );
  // 水流：两层噪声顺着溪往下游走
  vec2 fp = vec2( vUv.x * 0.42 - t * 0.9, vUv.y * 1.6 );
  float n1 = vn( fp * vec2( 1.0, 2.0 ) );
  float n2 = vn( fp * vec2( 2.6, 4.0 ) + vec2( 13.0 - t * 0.5, 4.0 ) );
  float n3 = vn( vec2( vUv.x * 2.4 - t * 1.6, vUv.y * 9.0 ) );
  vec3 N = normalize( vec3( ( n1 - 0.5 ) * 0.5 + ( n3 - 0.5 ) * 0.25, 1.0, ( n2 - 0.5 ) * 0.5 ) );
  vec3 V = normalize( cameraPosition - vWP );
  // 天空倒影（菲涅耳）
  vec3 R = reflect( -V, N );
  vec3 sky = mix( jFogColor( normalize( vec3( R.x, max( R.y, 0.0 ), R.z ) ) ), uMid, smoothstep( 0.05, 0.4, R.y ) );
  float fres = 0.05 + 0.95 * pow( 1.0 - max( dot( V, N ), 0.0 ), 4.0 );
  col = mix( col, sky, clamp( fres, 0.0, 1.0 ) * 0.75 );
  // 水纹亮线
  float streak = smoothstep( 0.66, 0.74, n1 * 0.55 + n3 * 0.45 ) * ( 1.0 - smoothstep( 0.74, 0.86, n1 * 0.55 + n3 * 0.45 ) );
  col = mix( col, uFoam, streak * 0.35 * smoothstep( 0.1, 0.5, depth ) );
  // 碎金：逆光时的太阳高光
  float sp = pow( max( dot( reflect( -uSunDir, N ), V ), 0.0 ), 90.0 );
  float glint = step( 0.9, vn( vWP.xz * 5.0 + vec2( t * 2.0, -t * 1.3 ) ) );
  col += uSunColor * ( sp * 2.2 + sp * glint * 6.0 );
  // 岸边白沫
  float foam = ( 1.0 - smoothstep( 0.02, 0.16, vDepth ) ) * smoothstep( 0.35, 0.75, n2 + n3 * 0.4 );
  col = mix( col, uFoam, foam * 0.75 );
  float a = mix( 0.35, 0.94, smoothstep( 0.0, 0.5, depth ) );
  a = max( a, foam * 0.8 );
  a *= smoothstep( -0.02, 0.04, vDepth );
  col = jFog( col, vWP );
  gl_FragColor = vec4( col, a );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function buildStream(land) {
  const pos = [], uv = [], dep = [], idx = [];
  const p = {};
  const M = 40, x0 = DOM.x0 - M, x1 = DOM.x0 + DOM.w + M, z0 = DOM.z0 - M, z1 = DOM.z0 + DOM.d + M;
  const cols = [-1, -0.62, -0.3, 0, 0.3, 0.62, 1];
  let rows = 0;
  for (let s = 0; s <= STREAM.length; s += 1.2) {
    STREAM.at(s, p);
    if (p.x < x0 || p.x > x1 || p.z < z0 || p.z > z1) { if (rows) break; else continue; }
    const W = waterY(s), half = bankW(s) + 1.0, nx = -p.tz, nz = p.tx;
    for (const u of cols) {
      const x = p.x + nx * u * half, z = p.z + nz * u * half;
      pos.push(x, W, z); uv.push(s, u * half);
      dep.push(W - land.height(x, z));
    }
    if (rows) { const a = (rows - 1) * cols.length, b = rows * cols.length; for (let i = 0; i < cols.length - 1; i++) idx.push(a + i, b + i, a + i + 1, a + i + 1, b + i, b + i + 1); }
    rows++;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('aDepth', new THREE.Float32BufferAttribute(dep, 1));
  geo.setIndex(idx); geo.computeBoundingSphere();
  // 三角形朝上
  {
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), P = geo.attributes.position;
    a.fromBufferAttribute(P, idx[0]); b.fromBufferAttribute(P, idx[1]); c.fromBufferAttribute(P, idx[2]);
    const n = b.clone().sub(a).cross(c.clone().sub(a));
    if (n.y < 0) { for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } geo.setIndex(idx); }
  }
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...U, uZenith: SKY.uZenith, uMid: SKY.uMid, uShallow: { value: new THREE.Color('#7fae9c') }, uDeep: { value: new THREE.Color('#2e6670') }, uFoam: { value: new THREE.Color('#f4f1e6') } },
    vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.name = 'stream'; mesh.renderOrder = 2; mesh.matrixAutoUpdate = false;
  return mesh;
}
