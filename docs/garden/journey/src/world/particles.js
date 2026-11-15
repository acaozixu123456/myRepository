// 飘落的东西：红叶谷里打着旋儿落下的叶子、雪线以上零零星星的雪花。
// 和萤火虫一样只在人周围一块地方（走远了从另一边补上来），下落和摇摆都在着色器里算。
import * as THREE from 'three';
import { U } from './atmo.js';

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const VS = /* glsl */`
attribute vec4 aInfo;            // x 相位，y 下落速度，z 颜色/大小，w 这一点的权重
uniform float uTime; uniform float uPx; uniform float uAmt; uniform float uH; uniform float uR; uniform float uSize; uniform float uSway;
varying float vA; varying float vZ; varying float vRot; varying float vFlip;
void main() {
  float t = uTime, ph = aInfo.x;
  float y = mod( ph * 37.0 - t * aInfo.y, uH );
  vec3 p = position + vec3(
    sin( t * 0.8 + ph * 5.0 ) * uSway + sin( t * 0.23 + ph ) * uSway * 1.6,
    y,
    cos( t * 0.67 + ph * 3.0 ) * uSway + cos( t * 0.19 + ph * 2.0 ) * uSway * 1.6 );
  vec4 mv = modelViewMatrix * vec4( p, 1.0 );
  gl_Position = projectionMatrix * mv;
  float d = max( -mv.z, 0.1 );
  vA = uAmt * aInfo.w * smoothstep( 0.0, 0.5, y ) * ( 1.0 - smoothstep( uH - 2.0, uH, y ) ) * ( 1.0 - smoothstep( uR * 0.6, uR, d ) );
  vZ = aInfo.z;
  vRot = t * ( 1.2 + aInfo.z * 2.5 ) + ph * 6.0;
  vFlip = sin( t * ( 1.7 + aInfo.z ) + ph * 4.0 );
  gl_PointSize = clamp( uPx * uSize * ( 0.7 + 0.6 * aInfo.z ) / d, 1.5, 48.0 );
  if ( vA < 0.01 ) gl_Position = vec4( 0.0, 0.0, 2.0, 1.0 );
}`;

// 落叶：一片尖头的叶子，转着翻着（宽度随翻转变窄）
const FS_LEAF = /* glsl */`
uniform vec3 uSunColor; uniform vec3 uAmb;
varying float vA; varying float vZ; varying float vRot; varying float vFlip;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float c = cos( vRot ), s = sin( vRot );
  q = vec2( c * q.x - s * q.y, s * q.x + c * q.y );
  float w = 0.06 + 0.2 * abs( vFlip );
  float l = 0.46;
  float shape = ( q.x * q.x ) / ( l * l ) + ( q.y * q.y ) / ( w * w * ( 1.0 - q.x / l * 0.5 ) * ( 1.0 - q.x / l * 0.5 ) );
  if ( shape > 1.0 || vA < 0.3 ) discard;
  vec3 col = vZ < 0.3 ? vec3( 0.62, 0.1, 0.05 ) : vZ < 0.6 ? vec3( 0.8, 0.3, 0.06 ) : vZ < 0.85 ? vec3( 0.86, 0.55, 0.1 ) : vec3( 0.75, 0.62, 0.16 );
  col *= 0.85 + 0.3 * step( 0.0, vFlip );          // 正反面明暗不一样
  col *= 1.0 - 0.25 * smoothstep( 0.04, 0.0, abs( q.y ) ) * step( abs( q.x ), l * 0.8 );   // 叶脉
  gl_FragColor = vec4( col * ( uAmb * 0.8 + uSunColor * 0.75 ), 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// 雪花：软软的小白点
const FS_SNOW = /* glsl */`
uniform vec3 uSunColor; uniform vec3 uAmb;
varying float vA; varying float vZ; varying float vRot; varying float vFlip;
void main() {
  float r = length( gl_PointCoord - 0.5 ) * 2.0;
  float a = ( 1.0 - smoothstep( 0.35, 1.0, r ) ) * vA * 0.85;
  if ( a < 0.01 ) discard;
  vec3 col = vec3( 0.96, 0.98, 1.0 ) * ( uAmb * 0.9 + uSunColor * 0.45 );
  gl_FragColor = vec4( col, a );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function makeLayer(land, o) {
  const { n, r } = o;
  const pos = new Float32Array(n * 3), info = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (Math.random() * 2 - 1) * r; pos[i * 3 + 1] = -1e4; pos[i * 3 + 2] = (Math.random() * 2 - 1) * r;
    info.set([Math.random() * 100, o.v0 + Math.random() * o.v1, Math.random(), 0], i * 4);
  }
  const geo = new THREE.BufferGeometry();
  const P = new THREE.BufferAttribute(pos, 3), I = new THREE.BufferAttribute(info, 4);
  geo.setAttribute('position', P); geo.setAttribute('aInfo', I);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uSunColor: U.uSunColor, uAmb: U.uAmb, uAmt: { value: 0 }, uPx: { value: 1200 }, uH: { value: o.h }, uR: { value: r }, uSize: { value: o.size }, uSway: { value: o.sway } },
    vertexShader: VS, fragmentShader: o.leaf ? FS_LEAF : FS_SNOW,
    transparent: !o.leaf, depthWrite: !!o.leaf,
  });
  const pts = new THREE.Points(geo, mat);
  pts.name = o.name; pts.frustumCulled = false; pts.renderOrder = o.leaf ? 0 : 6; pts.visible = false;
  let placed = false;
  // 每一点的权重：那个位置的红叶/积雪有多少（走到边上自然变稀）
  pts.userData.update = (focus, amt, px) => {
    mat.uniforms.uAmt.value = amt; mat.uniforms.uPx.value = px;
    pts.visible = amt > 0.01;
    if (!pts.visible) { placed = false; return; }
    let moved = false;
    for (let i = 0; i < n; i++) {
      let x = pos[i * 3], z = pos[i * 3 + 2], m = !placed;
      if (!placed) { x = focus.x + (Math.random() * 2 - 1) * r; z = focus.z + (Math.random() * 2 - 1) * r; }
      if (x - focus.x > r) { x -= 2 * r; m = true; } else if (x - focus.x < -r) { x += 2 * r; m = true; }
      if (z - focus.z > r) { z -= 2 * r; m = true; } else if (z - focus.z < -r) { z += 2 * r; m = true; }
      if (!m) continue;
      moved = true;
      pos[i * 3] = x; pos[i * 3 + 2] = z; pos[i * 3 + 1] = land.height(x, z);
      info[i * 4 + 3] = o.weight(x, z);
    }
    placed = true;
    if (moved) { P.needsUpdate = true; I.needsUpdate = true; }
  };
  return pts;
}

export function makeFalling(land) {
  const group = new THREE.Group(); group.name = 'falling';
  const leaves = makeLayer(land, { name: 'leaves', n: 150, r: 16, h: 9, v0: 0.5, v1: 0.5, size: 0.3, sway: 0.7, leaf: true, weight: (x, z) => sstep(0.15, 0.6, land.autumn(x, z)) });
  const snow = makeLayer(land, { name: 'snow', n: 320, r: 20, h: 14, v0: 0.55, v1: 0.5, size: 0.06, sway: 0.5, leaf: false, weight: (x, z) => sstep(0.1, 0.6, land.snow(x, z)) });
  group.add(leaves, snow);
  let aL = 0, aS = 0;
  // focus：围着谁；px：一米在一米远处有多少像素；dt 用来让多少慢慢变
  group.userData.update = (focus, px, dt) => {
    const k = 1 - Math.exp(-dt * 0.8);
    aL += (sstep(0.1, 0.5, land.autumn(focus.x, focus.z)) - aL) * k;
    aS += (sstep(0.05, 0.5, land.snow(focus.x, focus.z)) - aS) * k;
    leaves.userData.update(focus, aL, px);
    snow.userData.update(focus, aS, px);
  };
  return group;
}
