// 天空：地平线颜色和雾完全一致（远山自然融进天里），太阳和光晕，手绘感的积云在太阳一侧镶金边
import * as THREE from 'three';
import { U, FOG_FN } from './atmo.js';

export const SKY = {
  uZenith: { value: new THREE.Color('#6c98d4') },
  uMid: { value: new THREE.Color('#a8bde0') },
  uCloudLit: { value: new THREE.Color('#fff1dc') },
  uCloudShade: { value: new THREE.Color('#b5a8c4') },
  uSunGlow: { value: new THREE.Color('#ffc98a') },
  uCloudCover: { value: 0.5 },
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
uniform vec3 uZenith; uniform vec3 uMid; uniform vec3 uCloudLit; uniform vec3 uCloudShade; uniform vec3 uSunGlow; uniform float uCloudCover;
${FOG_FN}
varying vec3 vDir;
float h21( vec2 p ) { p = fract( p * vec2( 123.34, 456.21 ) ); p += dot( p, p + 45.32 ); return fract( p.x * p.y ); }
float vn( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( h21( i ), h21( i + vec2( 1, 0 ) ), f.x ), mix( h21( i + vec2( 0, 1 ) ), h21( i + 1.0 ), f.x ), f.y ); }
float fbm4( vec2 p ) { float s = 0.0, a = 0.5; for ( int i = 0; i < 4; i++ ) { s += a * vn( p ); p = p * 2.03 + 7.1; a *= 0.5; } return s / 0.9375; }
void main() {
  vec3 dir = normalize( vDir );
  float el = dir.y;
  float sd = max( dot( dir, uSunDir ), 0.0 );
  // 渐变：地平线 = 雾色，往上过渡到天顶
  vec3 hor = jFogColor( dir );
  vec3 col = mix( hor, uMid, smoothstep( 0.0, 0.18, el ) );
  col = mix( col, uZenith, smoothstep( 0.12, 0.75, el ) );
  // 太阳周围的暖光
  col += uSunGlow * ( pow( sd, 6.0 ) * 0.35 + pow( sd, 40.0 ) * 0.6 );
  // 云
  if ( el > -0.02 ) {
    vec2 p = dir.xz / ( el + 0.16 ) * 1.25;
    vec2 drift = vec2( uTime * 0.006, uTime * 0.0025 );
    vec2 q = p + drift;
    float warp = fbm4( q * 0.5 + 3.0 );
    float n = fbm4( q + warp * 0.9 );
    float band = 1.0 - smoothstep( 0.05, 0.5, el );
    float cov = smoothstep( 0.62 - uCloudCover * 0.3, 0.8 - uCloudCover * 0.25, n + band * 0.12 - 0.06 );
    cov *= smoothstep( -0.01, 0.07, el );
    // 朝太阳一侧亮：沿太阳方向偏移再取一次，算出“厚度差”
    vec2 sOff = normalize( uSunDir.xz + 1e-4 ) * 0.22;
    float n2 = fbm4( q + sOff + warp * 0.9 );
    float lit = clamp( 0.55 + ( n - n2 ) * 3.5, 0.0, 1.0 );
    vec3 cc = mix( uCloudShade, uCloudLit, lit );
    cc = mix( cc, hor, 0.35 * ( 1.0 - smoothstep( 0.0, 0.2, el ) ) );
    // 太阳附近的云边发亮（银边）
    float rim = pow( sd, 10.0 ) * ( 1.0 - smoothstep( 0.4, 1.0, cov ) ) * cov;
    cc += uSunColor * rim * 2.2 + uSunGlow * pow( sd, 4.0 ) * 0.25;
    col = mix( col, cc, cov * 0.92 );
  }
  // 太阳本体
  float disc = smoothstep( 0.99935, 0.99965, sd );
  col += vec3( 1.0, 0.92, 0.78 ) * disc * 9.0 + uSunColor * pow( sd, 900.0 ) * 3.0;
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
