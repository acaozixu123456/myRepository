// 天空：地平线颜色和雾完全一致（远山自然融进天里），太阳和光晕，手绘感的积云在太阳一侧镶金边；
// 夜里有星星、银河和月亮（uSunDir 是主光方向，夜里换成月亮；太阳本身的位置是 uSunPos）
import * as THREE from 'three';
import { U, FOG_FN } from './atmo.js';

// 银河所在的大圆：从东北的地平线斜着跨过天空
const MW_N = new THREE.Vector3().crossVectors(new THREE.Vector3(0.92, 0.04, -0.38).normalize(), new THREE.Vector3(-0.55, 0.62, -0.56).normalize()).normalize();
const MW_A = new THREE.Vector3(0, 1, 0).addScaledVector(MW_N, -MW_N.y).normalize();   // 银河最高的一点
const MW_B = new THREE.Vector3().crossVectors(MW_N, MW_A);

export const SKY = {
  uZenith: { value: new THREE.Color('#6c98d4') },
  uMid: { value: new THREE.Color('#a8bde0') },
  uCloudLit: { value: new THREE.Color('#fff1dc') },
  uCloudShade: { value: new THREE.Color('#b5a8c4') },
  uSunGlow: { value: new THREE.Color('#ffc98a') },
  uCloudCover: { value: 0.5 },
  uSunPos: { value: U.uSunDir.value.clone() },
  uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
  uStars: { value: 0 }, uSunVis: { value: 1 }, uMoonI: { value: 0 }, uDpr: { value: 1 },
  uMwN: { value: MW_N }, uMwA: { value: MW_A }, uMwB: { value: MW_B },
};

const VS = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  gl_Position = p.xyww;
}`;
const FS = /* glsl */`
uniform float uTime; uniform vec3 uSunColor;
uniform vec3 uZenith; uniform vec3 uMid; uniform vec3 uCloudLit; uniform vec3 uCloudShade; uniform vec3 uSunGlow; uniform float uCloudCover; uniform float uFine;
uniform vec3 uSunPos; uniform vec3 uMoonDir; uniform float uStars; uniform float uMoonI; uniform float uDpr;
uniform vec3 uMwN; uniform vec3 uMwA; uniform vec3 uMwB;
${FOG_FN}
varying vec3 vDir;
float h21( vec2 p ) { p = fract( p * vec2( 123.34, 456.21 ) ); p += dot( p, p + 45.32 ); return fract( p.x * p.y ); }
float vn( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( h21( i ), h21( i + vec2( 1, 0 ) ), f.x ), mix( h21( i + vec2( 0, 1 ) ), h21( i + 1.0 ), f.x ), f.y ); }
float fbm4( vec2 p ) { float s = 0.0, a = 0.5; for ( int i = 0; i < 4; i++ ) { s += a * vn( p ); p = p * 2.03 + 7.1; a *= 0.5; } return s / 0.9375; }
float h31( vec3 p ) { p = fract( p * 0.1031 ); p += dot( p, p.zyx + 31.32 ); return fract( ( p.x + p.y ) * p.z ); }
// 一层星星：方向按格子切开，每格最多一颗；pw 是一个像素对应的方向变化（用来抗锯齿）
vec3 starLayer( vec3 d, float sc, float th, float t, float pw ) {
  vec3 p = d * sc, i = floor( p ), f = fract( p ) - 0.5;
  float h = h31( i );
  if ( h < th ) return vec3( 0.0 );
  vec3 o = vec3( h31( i + 17.1 ), h31( i + 31.7 ), h31( i + 47.3 ) ) - 0.5;
  float w = pw * sc * uDpr;     // 星星按屏幕上的点（不是物理像素）算大小，高清屏上不会变小
  float r = length( f - o * 0.55 );
  float b = ( h - th ) / ( 1.0 - th );
  float s = smoothstep( 0.8 * w, 0.0, r ) * ( 0.08 + b * b * b * 1.5 );
  s *= 0.72 + 0.28 * sin( t * ( 1.5 + 3.0 * o.x ) + h * 60.0 );
  return s * mix( vec3( 0.78, 0.86, 1.0 ), vec3( 1.0, 0.88, 0.72 ), fract( h * 13.0 ) );
}
void main() {
  vec3 dir = normalize( vDir );
  float pw = length( fwidth( dir ) );
  float el = dir.y;
  float sd = max( dot( dir, uSunPos ), 0.0 );
  float kd = max( dot( dir, uSunDir ), 0.0 );
  // 渐变：地平线 = 雾色，往上过渡到天顶
  vec3 hor = jFogColor( dir );
  vec3 col = mix( hor, uMid, smoothstep( 0.0, 0.18, el ) );
  col = mix( col, uZenith, smoothstep( 0.12, 0.75, el ) );
  // 太阳周围的暖光
  col += uSunGlow * ( pow( sd, 6.0 ) * 0.35 + pow( sd, 40.0 ) * 0.6 );
  // 夜空：星星、银河、月亮（在云的后面）
  float md = dot( dir, uMoonDir );
  if ( uStars > 0.01 && el > -0.05 ) {
    float fade = uStars * smoothstep( 0.0, 0.28, el );
    // 银河：一条斜跨天空的淡带，中间有暗的尘埃带
    float v = dot( dir, uMwN );
    float u = atan( dot( dir, uMwB ), dot( dir, uMwA ) );
    vec2 q = vec2( u * 2.6, v * 7.0 );
    float band = exp( -v * v / 0.045 ) * ( 0.55 + 0.45 * exp( -( u - 0.9 ) * ( u - 0.9 ) / 0.9 ) );
    if ( band > 0.02 ) {     // 银河以外的地方不用算噪声
      float m = fbm4( q * 1.6 + 2.0 );
      float dl = exp( -v * v / 0.006 );
      float dust = dl > 0.02 ? smoothstep( 0.52, 0.75, fbm4( q * 2.4 + 9.0 ) ) * dl : 0.0;
      float mw = band * ( 0.25 + m * m * 1.7 ) * ( 1.0 - 0.45 * dust );
      col += vec3( 0.45, 0.5, 0.66 ) * mw * 0.2 * fade;
    }
    vec3 st = starLayer( dir, 150.0, 0.972, uTime, pw ) + starLayer( dir, 330.0, 0.994 - band * 0.03, uTime * 1.3, pw ) * 0.7;
    col += st * fade * ( 1.0 - smoothstep( 0.996, 0.9998, md ) * 0.85 );
  }
  if ( uMoonI > 0.001 ) {
    float mm = max( md, 0.0 );
    col += vec3( 0.62, 0.72, 0.95 ) * uMoonI * ( pow( mm, 2200.0 ) * 0.5 + pow( mm, 160.0 ) * 0.12 + pow( mm, 12.0 ) * 0.045 );
    float disc = smoothstep( 0.99974, 0.99981, md );
    if ( disc > 0.0 ) {
      vec3 t = dir - uMoonDir * md;
      float sp = vn( t.xz * 520.0 + 3.0 ) * 0.6 + vn( t.xy * 1300.0 ) * 0.4;
      vec3 mc = vec3( 1.0, 0.97, 0.9 ) * ( 0.78 + 0.22 * smoothstep( 0.25, 0.7, sp ) ) * 1.9;
      col = mix( col, mc, disc * min( 1.0, uMoonI * 1.4 ) );
    }
  }
  // 云：高处一层被风拉长的卷云，下面是一团团积云
  if ( el > -0.02 ) {
    vec2 drift = vec2( uTime * 0.006, uTime * 0.0025 );
    // 卷云：很薄，一丝丝的（画质「低」时不画，省两次噪声）
    if ( uFine > 0.5 ) {
      vec2 pc = dir.xz / ( el + 0.06 ) * 0.42 + drift * 1.7;
      float cw = fbm4( pc * 0.8 + 21.0 );
      float ci = fbm4( vec2( pc.x * 0.55 + pc.y * 0.3, pc.y * 2.6 - pc.x * 0.4 ) + cw * 1.3 );
      float cir = smoothstep( 0.56, 0.8, ci ) * smoothstep( 0.03, 0.3, el ) * ( 0.28 + 0.2 * uCloudCover );
      col = mix( col, mix( uCloudLit, hor, 0.25 ) + uSunGlow * pow( sd, 5.0 ) * 0.3, cir );
    }
    vec2 p = dir.xz / ( el + 0.16 ) * 1.25;
    vec2 q = p + drift;
    float warp = fbm4( q * 0.5 + 3.0 );
    float n = fbm4( q + warp * 0.9 );
    // 边上被侵蚀出一个个小卷，边缘清楚一些
    float nd = 0.5, ew = 0.17;
    if ( uFine > 0.5 ) { nd = fbm4( q * 3.3 + warp * 1.6 + 11.0 ); ew = 0.075; }
    float band = 1.0 - smoothstep( 0.05, 0.5, el );
    float base = n + band * 0.12 - 0.06, th0 = 0.62 - uCloudCover * 0.3;
    float cov = smoothstep( th0, th0 + ew, base + ( nd - 0.5 ) * 0.17 );
    cov *= smoothstep( -0.01, 0.07, el );
    // 朝太阳一侧亮：沿太阳方向偏移再取一次，算出“厚度差”；云厚的地方底下暗一点
    vec2 sOff = normalize( uSunDir.xz + 1e-4 ) * 0.22;
    float n2 = fbm4( q + sOff + warp * 0.9 );
    float lit = clamp( 0.55 + ( n - n2 ) * 3.5 + ( nd - 0.5 ) * 0.5, 0.0, 1.0 );
    float thick = smoothstep( th0 + 0.05, th0 + 0.3, base );
    vec3 cc = mix( uCloudShade, uCloudLit, lit ) * ( 1.0 - 0.14 * thick );
    cc = mix( cc, hor, 0.35 * ( 1.0 - smoothstep( 0.0, 0.2, el ) ) );
    // 太阳附近的云边发亮（银边）
    float rim = pow( kd, 10.0 ) * ( 1.0 - smoothstep( 0.4, 1.0, cov ) ) * cov;
    cc += uSunColor * rim * 2.2 + uSunGlow * pow( sd, 4.0 ) * 0.25;
    col = mix( col, cc, cov * 0.94 );
  }
  // 太阳本体
  float disc = smoothstep( 0.99935, 0.99965, sd );
  col += vec3( 1.0, 0.92, 0.78 ) * disc * 9.0 + uSunColor * pow( sd, 900.0 ) * 3.0 * step( 0.0, dot( uSunDir, uSunPos ) - 0.9 );
  gl_FragColor = vec4( col, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function makeSky() {
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...U, ...SKY },
    vertexShader: VS, fragmentShader: FS,
    side: THREE.BackSide, depthWrite: false, depthTest: true, fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(100, 48, 24), mat);
  mesh.name = 'sky'; mesh.frustumCulled = false; mesh.renderOrder = 100;
  mesh.onBeforeRender = (r, s, cam) => { mesh.position.copy(cam.position); mesh.updateMatrixWorld(); };
  return mesh;
}
