// 海：西南边一整片海，一直到天边。一块跟着镜头走的大圆盘（只在海岸那一边画），
// 深浅按海底高度（近处烤成一张小贴图，远处按海岸的公式算）：浅处透出沙子是青绿的，深处是蓝的；
// 海面一起一伏（一层层浪推上沙滩又退回去），岸边和礁石边一圈白沫，往岸上推的浪线，逆光时一片碎金。
import * as THREE from 'three';
import { SEA } from './route.js';
import { U, FOG_FN } from './atmo.js';
import { SKY } from './sky.js';

// 近处烤海底深度的范围（近景范围的西南角）
const BOX = { x0: -528, z0: -270, w: 240, d: 366 };

const VS = /* glsl */`
uniform float uTide; uniform float uSeaY;
varying vec3 vWP;
void main() {
  vec4 w = modelMatrix * vec4( position, 1.0 );
  w.y = uSeaY + uTide;
  vWP = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const FS = /* glsl */`
uniform float uTime; uniform vec3 uSunColor; uniform vec3 uZenith; uniform vec3 uMid;
uniform sampler2D uSeaD; uniform vec4 uSeaBox; uniform vec4 uCoast; uniform float uCoastR; uniform float uSeaY; uniform float uTide;
uniform float uDay; uniform float uRain; uniform float uOvercast;
${FOG_FN}
varying vec3 vWP;
float h21( vec2 p ) { p = fract( p * vec2( 123.34, 456.21 ) ); p += dot( p, p + 45.32 ); return fract( p.x * p.y ); }
float vn( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( h21( i ), h21( i + vec2( 1, 0 ) ), f.x ), mix( h21( i + vec2( 0, 1 ) ), h21( i + 1.0 ), f.x ), f.y ); }
void main() {
  vec2 xz = vWP.xz, d0 = xz - uCoast.xy;
  float t = dot( d0, vec2( -uCoast.w, uCoast.z ) );
  float c = dot( d0, uCoast.zw ) - t * t / ( 2.0 * uCoastR );
  if ( c < -90.0 ) discard;                      // 离海岸很远的低地（东边的溪谷）不是海
  // 海底多深：近处查贴图，远处按公式
  float depth;
  vec2 bu = ( xz - uSeaBox.xy ) / uSeaBox.zw;
  if ( bu.x > 0.0 && bu.x < 1.0 && bu.y > 0.0 && bu.y < 1.0 ) depth = texture2D( uSeaD, bu ).r * 16.0 - 0.6;
  else { if ( c < -25.0 ) discard; depth = max( 0.02, min( 16.0, -0.3 + 0.05 * c + 0.0006 * c * c ) ); }
  depth += uTide;
  if ( depth < -0.05 ) discard;
  float tm = uTime;
  vec3 V = normalize( cameraPosition - vWP );
  float dist = length( cameraPosition - vWP );
  // 浪：几层噪声往岸上（-c 方向）走；远处平一点（不闪）
  vec2 n2 = normalize( uCoast.zw );
  vec2 q = vec2( dot( xz, n2 ), dot( xz, vec2( -n2.y, n2.x ) ) );
  float fade = 1.0 - smoothstep( 60.0, 600.0, dist );
  float a1 = vn( q * vec2( 0.09, 0.05 ) + vec2( tm * 0.22, 0.0 ) ), a2 = vn( q * vec2( 0.31, 0.22 ) + vec2( tm * 0.5, tm * 0.11 ) );
  float a3 = vn( xz * 1.3 + vec2( tm * 0.7, -tm * 0.4 ) );
  vec3 N = normalize( vec3( ( ( a1 - 0.5 ) * 0.35 + ( a2 - 0.5 ) * 0.22 + ( a3 - 0.5 ) * 0.08 * fade ) * fade + 0.0001, 1.0, ( ( a2 - 0.5 ) * 0.3 + ( a3 - 0.5 ) * 0.1 * fade ) * fade ) );
  // 颜色：浅处青绿透沙，往外蓝，再往外深蓝
  vec3 shallow = vec3( 0.33, 0.62, 0.56 ), mid = vec3( 0.08, 0.36, 0.44 ), deep = vec3( 0.035, 0.17, 0.29 );
  vec3 col = mix( shallow, mid, smoothstep( 0.2, 2.8, depth ) );
  col = mix( col, deep, smoothstep( 3.0, 12.0, depth ) );
  col *= mix( 1.0, 0.72, uOvercast );
  // 天空倒影
  vec3 R = reflect( -V, N );
  vec3 hz = jFogColor( normalize( vec3( R.x, max( R.y, 0.0 ), R.z ) ) );
  vec3 sky = mix( hz, uMid, smoothstep( 0.05, 0.45, R.y ) );
  sky = mix( sky, uZenith, smoothstep( 0.4, 0.9, R.y ) * 0.5 );
  float fres = 0.04 + 0.96 * pow( 1.0 - max( dot( V, N ), 0.0 ), 5.0 );
  col = mix( col * uDay, sky, clamp( fres, 0.0, 1.0 ) * 0.85 );
  // 太阳的碎金
  float sp = pow( max( dot( reflect( -uSunDir, N ), V ), 0.0 ), 120.0 );
  float glint = step( 0.88, vn( xz * 2.2 + vec2( tm * 1.7, -tm * 1.1 ) ) );
  col += uSunColor * ( sp * 2.5 + sp * glint * 8.0 * fade ) * ( 1.0 - uOvercast * 0.8 );
  // 往岸上推的浪线（浅处），岸边一道白沫（跟着海面一起一伏）
  float wob = vn( q * vec2( 0.02, 0.12 ) + 3.0 ) * 2.2 + vn( q * vec2( 0.05, 0.3 ) - tm * 0.05 ) * 0.8;
  float ph = depth * 3.2 + wob - tm * 0.9;
  float crest = smoothstep( 0.78, 0.98, sin( ph ) * 0.5 + 0.5 ) * ( 1.0 - smoothstep( 0.4, 2.2, depth ) ) * smoothstep( 0.0, 0.12, depth );
  float brk = smoothstep( 0.35, 0.7, vn( q * vec2( 0.15, 0.7 ) + vec2( tm * 0.3, 0.0 ) ) );
  float edge = 1.0 - smoothstep( 0.02, 0.22 + 0.12 * a2, depth );
  float lace = smoothstep( 0.45, 0.75, vn( xz * 0.9 + vec2( tm * 0.2, 0.0 ) ) + a3 * 0.3 ) * ( 1.0 - smoothstep( 0.2, 0.7, depth ) );
  // 外海偶尔的小白浪（下雨、阴天多一点）
  float cap = smoothstep( 0.86 - 0.08 * uRain, 0.95, a2 * 0.6 + a1 * 0.5 ) * smoothstep( 3.0, 8.0, depth ) * fade * 0.5;
  float foam = clamp( max( max( edge, crest * brk ), max( lace * 0.6, cap ) ), 0.0, 1.0 );
  vec3 fc = vec3( 0.95, 0.96, 0.93 ) * ( 0.55 + 0.45 * uDay ) * mix( 1.0, 0.8, uOvercast );
  col = mix( col, fc, foam * 0.9 );
  // 雨点打在海面上：一个个小圈
  if ( uRain > 0.01 && dist < 40.0 ) {
    vec2 g = xz * 2.0; vec2 gi = floor( g ), gf = fract( g ) - 0.5;
    float hs = h21( gi ), ph2 = fract( tm * 0.9 + hs );
    float ring = smoothstep( 0.06, 0.0, abs( length( gf ) - ph2 * 0.45 ) ) * ( 1.0 - ph2 ) * step( 0.55, hs );
    col += vec3( 0.25 ) * ring * uRain * ( 1.0 - smoothstep( 15.0, 40.0, dist ) ) * uDay;
  }
  float a = mix( 0.22, 0.97, smoothstep( 0.0, 2.6, depth ) );
  a = max( a, foam * 0.92 );
  a *= smoothstep( -0.05, 0.03, depth );
  col = jFog( col, vWP );
  gl_FragColor = vec4( col, a );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export const SEA_U = {
  uTide: { value: 0 }, uSeaY: { value: SEA.y }, uDay: { value: 1 },
  uRain: { value: 0 }, uOvercast: { value: 0 },
};

export function buildSea(land) {
  // 海底深度贴图：1 米一格，0~16 米（往下偏 0.6 米，岸上也存一点“负深度”，浪退下去时沙滩湿的那段）
  const W = BOX.w, D = BOX.d, data = new Uint8Array(W * D * 4);
  for (let j = 0; j < D; j++) for (let i = 0; i < W; i++) {
    const x = BOX.x0 + i + 0.5, z = BOX.z0 + j + 0.5;
    const dep = SEA.y - land.ground(x, z);
    const v = Math.max(0, Math.min(255, Math.round((dep + 0.6) / 16 * 255)));
    const k = (j * W + i) * 4; data[k] = v; data[k + 1] = v; data[k + 2] = v; data[k + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, W, D, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  // 圆盘：里密外疏，半径 6.5 公里
  const rings = 30, segs = 72, pos = [0, 0, 0], idx = [];
  for (let r = 1; r <= rings; r++) {
    const rr = 6500 * Math.pow(r / rings, 2.2);
    for (let i = 0; i < segs; i++) { const a = (i / segs) * Math.PI * 2; pos.push(Math.cos(a) * rr, 0, Math.sin(a) * rr); }
  }
  for (let i = 0; i < segs; i++) idx.push(0, 1 + i, 1 + (i + 1) % segs);
  for (let r = 1; r < rings; r++) {
    const a0 = 1 + (r - 1) * segs, b0 = 1 + r * segs;
    for (let i = 0; i < segs; i++) { const i1 = (i + 1) % segs; idx.push(a0 + i, b0 + i, a0 + i1, a0 + i1, b0 + i, b0 + i1); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  // 三角形朝上
  { const P = geo.attributes.position, a = new THREE.Vector3().fromBufferAttribute(P, idx[0]), b = new THREE.Vector3().fromBufferAttribute(P, idx[1]), c = new THREE.Vector3().fromBufferAttribute(P, idx[2]);
    if (b.sub(a).cross(c.sub(a)).y < 0) { for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } geo.setIndex(idx); } }
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      ...U, ...SEA_U, uZenith: SKY.uZenith, uMid: SKY.uMid,
      uSeaD: { value: tex }, uSeaBox: { value: new THREE.Vector4(BOX.x0, BOX.z0, BOX.w, BOX.d) },
      uCoast: { value: new THREE.Vector4(SEA.x, SEA.z, SEA.nx, SEA.nz) }, uCoastR: { value: SEA.R },
    },
    vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'sea'; mesh.renderOrder = 2; mesh.frustumCulled = false;
  // 跟着镜头走（对齐 50 米，免得浪纹跟着人滑）；离海太远（比如在冰湖那边）就不画
  mesh.onBeforeRender = (r, s, cam) => { mesh.position.set(Math.round(cam.position.x / 50) * 50, 0, Math.round(cam.position.z / 50) * 50); mesh.updateMatrixWorld(); };
  mesh.userData.update = (t) => {
    // 一层层的浪：涨上来、退下去（大约 9 秒一次，夹一点小起伏）
    SEA_U.uTide.value = 0.13 * Math.sin(t * 0.7) + 0.05 * Math.sin(t * 1.9 + 1.3);
  };
  return mesh;
}
