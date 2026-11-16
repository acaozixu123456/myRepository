// 小溪：沿溪的带状网格。浅处透出河床，水纹顺流而下，逆光时满溪碎金。
import * as THREE from 'three';
import { STREAM } from './route.js';
import { DOM, waterY, bankW, FALLS } from './land.js';
import { U, FOG_FN } from './atmo.js';
import { SKY } from './sky.js';

const VS = /* glsl */`
attribute float aDepth; attribute float aSlope; attribute float aU; attribute float aFoam;
varying vec2 vUv; varying vec3 vWP; varying float vDepth; varying float vSlope; varying float vU; varying float vFoam;
void main() {
  vUv = uv; vDepth = aDepth; vSlope = aSlope; vU = aU; vFoam = aFoam;
  vec4 w = modelMatrix * vec4( position, 1.0 ); vWP = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const FS = /* glsl */`
uniform float uTime; uniform vec3 uSunColor; uniform vec3 uZenith; uniform vec3 uMid;
uniform vec3 uShallow; uniform vec3 uDeep; uniform vec3 uFoam;
${FOG_FN}
varying vec2 vUv; varying vec3 vWP; varying float vDepth; varying float vSlope; varying float vU; varying float vFoam;
float h21( vec2 p ) { p = fract( p * vec2( 123.34, 456.21 ) ); p += dot( p, p + 45.32 ); return fract( p.x * p.y ); }
float vn( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( h21( i ), h21( i + vec2( 1, 0 ) ), f.x ), mix( h21( i + vec2( 0, 1 ) ), h21( i + 1.0 ), f.x ), f.y ); }
void main() {
  float t = uTime;
  float depth = clamp( vDepth / 0.75, 0.0, 1.0 );
  vec3 col = mix( uShallow, uDeep, smoothstep( 0.0, 0.9, depth ) );
  // 山涧：坡越陡水越急，跌水的地方全是白沫
  float rapid = smoothstep( 0.05, 0.22, vSlope ), fall = smoothstep( 0.3, 0.7, vSlope );
  // 水流：两层噪声顺着溪往下游走
  vec2 fp = vec2( vUv.x * 0.42 - t * ( 0.9 + 1.6 * rapid ), vUv.y * 1.6 );
  float n1 = vn( fp * vec2( 1.0, 2.0 ) );
  float n2 = vn( fp * vec2( 2.6, 4.0 ) + vec2( 13.0 - t * 0.5, 4.0 ) );
  float n3 = vn( vec2( vUv.x * 2.4 - t * ( 1.6 + 3.0 * rapid ), vUv.y * 9.0 ) );
  vec3 N = normalize( vec3( ( n1 - 0.5 ) * 0.5 + ( n3 - 0.5 ) * 0.25, 1.0, ( n2 - 0.5 ) * 0.5 ) );
  vec3 V = normalize( cameraPosition - vWP );
  // 天空倒影（菲涅耳）
  vec3 R = reflect( -V, N );
  vec3 hz = jFogColor( normalize( vec3( R.x, max( R.y, 0.0 ), R.z ) ) );
  vec3 sky = mix( hz, uMid, smoothstep( 0.05, 0.4, R.y ) );
  // 贴着水面看过去，倒映的是对岸的草木和石头，不是白蒙蒙的天
  sky = mix( vec3( 0.26, 0.33, 0.22 ) * dot( hz, vec3( 0.3, 0.5, 0.2 ) ), sky, smoothstep( 0.03, 0.28, R.y ) );
  // 浅水里河床上晃动的光网（焦散）：两层噪声取“等高线”叠起来，越深越淡
  vec2 cp = vWP.xz * 1.7;
  float c1 = vn( cp + vec2( t * 0.6, t * 0.35 ) + n2 * 0.8 ), c2 = vn( cp * 1.37 + vec2( -t * 0.45, t * 0.5 ) + 7.0 );
  float cau = pow( 1.0 - abs( c1 - c2 ) * 2.4, 6.0 );
  col += uSunColor * vec3( 0.9, 1.0, 0.95 ) * cau * 0.22 * ( 1.0 - smoothstep( 0.15, 0.85, depth ) ) * ( 1.0 - rapid );
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
  // 急流：白浪一条条的，中间露出青绿的水，不是一整片灰白
  float white = clamp( rapid * ( 0.06 + 0.88 * smoothstep( 0.46, 0.78, n1 * 0.5 + n3 * 0.5 ) ), 0.0, 1.0 );
  col = mix( col, uFoam, white );
  // 跌水：一道道往下冲的水线，白里透着青；两边薄、透
  float fs1 = vn( vec2( vUv.y * 4.2, vUv.x * 0.9 - t * 7.0 ) ), fs2 = vn( vec2( vUv.y * 9.0 + 3.0, vUv.x * 2.2 - t * 11.0 ) );
  float sheet = fs1 * 0.6 + fs2 * 0.4;
  vec3 fc = mix( vec3( 0.62, 0.78, 0.8 ), uFoam * 1.06, smoothstep( 0.28, 0.62, sheet ) );
  col = mix( col, fc, fall );
  float edgeA = 1.0 - smoothstep( 0.62, 1.0, abs( vU ) ) * 0.75;
  // 跌水下面的水潭：翻着白沫，一圈圈散开
  float pool = vFoam * smoothstep( 0.3, 0.72, vn( vec2( vUv.x * 1.6 - t * 1.4, vUv.y * 2.4 ) + vec2( n2 * 1.5, 0.0 ) ) + 0.25 * vFoam );
  col = mix( col, uFoam, clamp( pool, 0.0, 1.0 ) * 0.9 );
  float a = mix( 0.35, 0.94, smoothstep( 0.0, 0.5, depth ) );
  a = max( a, max( foam * 0.8, max( white * 0.95, pool * 0.9 ) ) );
  a = mix( a, ( 0.7 + 0.28 * smoothstep( 0.3, 0.7, sheet ) ) * edgeA, fall );
  a *= smoothstep( -0.02, 0.04, vDepth );
  col = jFog( col, vWP );
  gl_FragColor = vec4( col, a );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function buildStream(land) {
  const pos = [], uv = [], dep = [], slope = [], idx = [], us = [], fo = [];
  const p = {};
  const M = 40, x0 = DOM.x0 - M, x1 = DOM.x0 + DOM.w + M, z0 = DOM.z0 - M, z1 = DOM.z0 + DOM.d + M;
  const cols = [-1, -0.62, -0.3, 0, 0.3, 0.62, 1];
  let rows = 0;
  for (let s = 0; s <= STREAM.length; s += 1.2) {
    STREAM.at(s, p);
    if (p.x < x0 || p.x > x1 || p.z < z0 || p.z > z1) { if (rows) break; else continue; }
    const W = waterY(s), half = bankW(s) + 1.0, nx = -p.tz, nz = p.tx;
    const sl = (waterY(s - 1.2) - waterY(s + 1.2)) / 2.4;
    // 跌水脚下几米翻白沫
    let pf = 0; for (const [fs, fh] of FALLS) pf = Math.max(pf, Math.exp(-(((s - fs - 2.6) / 2.2) ** 2)) * Math.min(1, fh / 3));
    for (const u of cols) {
      const x = p.x + nx * u * half, z = p.z + nz * u * half;
      pos.push(x, W, z); uv.push(s, u * half);
      dep.push(W - land.ground(x, z)); slope.push(sl); us.push(u); fo.push(pf * (1 - 0.5 * Math.abs(u)));
    }
    if (rows) { const a = (rows - 1) * cols.length, b = rows * cols.length; for (let i = 0; i < cols.length - 1; i++) idx.push(a + i, b + i, a + i + 1, a + i + 1, b + i, b + i + 1); }
    rows++;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('aDepth', new THREE.Float32BufferAttribute(dep, 1));
  geo.setAttribute('aSlope', new THREE.Float32BufferAttribute(slope, 1));
  geo.setAttribute('aU', new THREE.Float32BufferAttribute(us, 1));
  geo.setAttribute('aFoam', new THREE.Float32BufferAttribute(fo, 1));
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

// 跌水脚下的水雾：一团团软软的白，慢慢往上飘、散开
const MIST_VS = /* glsl */`
attribute float aSeed; uniform float uTime; uniform float uScale;
varying float vA;
void main() {
  float ph = fract( uTime * ( 0.12 + 0.05 * fract( aSeed * 7.3 ) ) + aSeed );
  vec3 p = position + vec3( sin( aSeed * 40.0 + uTime * 0.3 ) * 0.5, ph * 1.8, cos( aSeed * 23.0 + uTime * 0.25 ) * 0.5 );
  vec4 mv = modelViewMatrix * vec4( p, 1.0 );
  gl_Position = projectionMatrix * mv;
  gl_PointSize = ( 1.1 + 2.2 * ph ) * uScale / max( 1.0, -mv.z );
  vA = sin( ph * 3.14159 ) * 0.17 * smoothstep( 1.5, 4.0, -mv.z ) * ( 1.0 - smoothstep( 60.0, 110.0, -mv.z ) );
}`;
const MIST_FS = /* glsl */`
uniform vec3 uColor; varying float vA;
void main() {
  vec2 d = gl_PointCoord - 0.5; float r = dot( d, d ) * 4.0;
  float a = vA * ( 1.0 - smoothstep( 0.2, 1.0, r ) );
  if ( a < 0.004 ) discard;
  gl_FragColor = vec4( uColor, a );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
export function buildMist(land) {
  const pos = [], seed = [];
  let k = 0;
  for (const [fs, fh] of FALLS) {
    const p = STREAM.at(fs + 1.8, {}), y = waterY(fs + 1.8);
    const n = Math.round(6 + fh * 2.5);
    for (let i = 0; i < n; i++) {
      const u = ((i * 0.618) % 1) * 2 - 1, w = bankW(fs) * 0.8;
      pos.push(p.x - p.tz * u * w, y + 0.1, p.z + p.tx * u * w); seed.push((k++ * 0.37) % 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
  geo.computeBoundingSphere(); geo.boundingSphere.radius += 6;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uScale: { value: 400 }, uColor: { value: new THREE.Color(0.92, 0.95, 0.97) } },
    vertexShader: MIST_VS, fragmentShader: MIST_FS, transparent: true, depthWrite: false,
  });
  const pts = new THREE.Points(geo, mat); pts.name = 'mist'; pts.renderOrder = 3; pts.matrixAutoUpdate = false;
  // 每像素多大：跟着画布高度和视角变
  pts.onBeforeRender = (r, sc, cam) => { mat.uniforms.uScale.value = r.domElement.height / (2 * Math.tan(cam.fov * Math.PI / 360)); };
  return pts;
}
