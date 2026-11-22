// 上升的风：几处固定的地方（观景点外面的坡上、风车坡、海角的崖边、花田、叠水上面……）有一股往上吹的风，
// 张着翅膀滑进去就被托起来，不用扇翅膀、不费气力。远远看得见一柱打着旋往上飘的小亮片。
// 一共一次绘制，位置全在着色器里算。
import * as THREE from 'three';
import { U } from './atmo.js';
import { VISTAS, LIGHTHOUSE, STREAM, LAKE } from './route.js';
import { FALLS } from './land.js';

const DEG = Math.PI / 180;
const PER = 90;

const VS = /* glsl */`
attribute vec4 aC;      // 这股风的中心 x、底 y、z、半径
attribute vec4 aI;      // 多高、随机数、往上多快、多大
uniform float uTime; uniform float uPx;
varying float vA; varying float vS;
void main() {
  float h = aI.x, sd = aI.y;
  float t = fract( sd * 13.7 + uTime * aI.z / h );
  float ang = sd * 60.0 + uTime * ( 0.5 + sd * 0.6 ) + t * ( 5.0 + 4.0 * sd );
  float rad = aC.w * ( 0.25 + 0.75 * fract( sd * 7.31 ) ) * ( 0.75 + 0.5 * t );
  vec3 p = vec3( aC.x + cos( ang ) * rad, aC.y + 0.4 + t * h, aC.z + sin( ang ) * rad );
  vec4 mv = modelViewMatrix * vec4( p, 1.0 );
  gl_Position = projectionMatrix * mv;
  float d = max( -mv.z, 0.1 );
  vA = smoothstep( 0.0, 0.12, t ) * ( 1.0 - smoothstep( 0.7, 1.0, t ) ) * smoothstep( 2.0, 9.0, d ) * ( 1.0 - smoothstep( 260.0, 380.0, d ) );
  vS = sd;
  gl_PointSize = clamp( uPx * aI.w / d, 3.0, 90.0 );
  if ( vA < 0.01 ) gl_Position = vec4( 0.0, 0.0, 2.0, 1.0 );
}`;
const FS = /* glsl */`
uniform vec3 uSunColor; uniform vec3 uAmb;
varying float vA; varying float vS;
void main() {
  // 一道竖着的、稍微歪一点的细亮线（风往上吹的样子），夹着几片被卷起来的草屑花瓣
  vec2 q = gl_PointCoord - 0.5;
  float ra = 1.5708 + ( fract( vS * 9.1 ) - 0.5 ) * 1.1;
  float c = cos( ra ), s = sin( ra );
  q = vec2( c * q.x - s * q.y, s * q.x + c * q.y );
  float wd = mix( 0.05, 0.15, step( 0.75, fract( vS * 5.3 ) ) );
  float a = ( 1.0 - smoothstep( 0.2, 0.48, abs( q.x ) ) ) * ( 1.0 - smoothstep( wd * 0.45, wd, abs( q.y ) ) ) * vA * 0.9;
  if ( a < 0.02 ) discard;
  vec3 col = mix( vec3( 1.0, 0.99, 0.94 ), vec3( 1.0, 0.86, 0.76 ), step( 0.6, fract( vS * 3.7 ) ) ) * ( uAmb * 1.1 + uSunColor * 0.75 + 0.12 );
  gl_FragColor = vec4( col, a );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function makeThermals(land, extra = []) {
  const list = [];
  // up：风能把人托到比附近最高的地面还高多少米（崖下的风要吹过崖顶才有用）
  const add = (id, x, z, r, up) => {
    const y = land.surfaceY(x, z); let top = y;
    for (let a = 0; a < 6.283; a += 0.7854) for (const d of [10, 22]) top = Math.max(top, land.surfaceY(x + Math.cos(a) * d, z + Math.sin(a) * d));
    list.push({ id, x, z, r, y, h: top - y + up });
  };
  // 每个观景点往外看的那一侧
  for (const v of VISTAS) { const a = v.f * DEG; add(v.id, v.x + Math.sin(a) * 16, v.z + Math.cos(a) * 16, 11, 46); }
  add('mill', 76, -112, 10, 38);                                         // 风车坡
  add('cape', LIGHTHOUSE.x - 15, LIGHTHOUSE.z + 6, 10, 44);              // 海角崖边
  add('meadow', 92, -40, 11, 48);                                        // 东坡花田
  add('view', -24, -196, 10, 40);                                        // 望远台外面
  { const [s] = FALLS[FALLS.length - 1], p = STREAM.at(s + 6, {}); add('falls', p.x, p.z, 10, 44); }   // 最高那道叠水上面
  { const p = STREAM.at(70, {}); add('pass', p.x + 14, p.z + 10, 10, 44); }                             // 雪原山口
  add('lake', LAKE.x + 18, LAKE.z + 30, 11, 50);                         // 冰湖上
  add('beach', -400, -20, 11, 48);                                       // 西湾沙滩

  // 浮岛上的风：底在岛面上，不是在地上
  for (const T of extra) list.push({ ...T });

  const n = list.length * PER;
  const aC = new Float32Array(n * 4), aI = new Float32Array(n * 4), pos = new Float32Array(n * 3);
  list.forEach((T, k) => {
    for (let i = 0; i < PER; i++) {
      const j = k * PER + i;
      aC.set([T.x, T.y, T.z, T.r], j * 4);
      aI.set([T.h, Math.random(), 2.2 + Math.random() * 1.6, 1.3 + Math.random() * 1.5], j * 4);
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aC', new THREE.BufferAttribute(aC, 4));
  geo.setAttribute('aI', new THREE.BufferAttribute(aI, 4));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uSunColor: U.uSunColor, uAmb: U.uAmb, uPx: { value: 1200 } },
    vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.name = 'thermals'; pts.frustumCulled = false; pts.renderOrder = 6;
  pts.userData.list = list;
  pts.userData.update = px => { mat.uniforms.uPx.value = px; };
  // 这里的风有多大（0~1）：在柱子里、还没到顶
  pts.userData.lift = (x, y, z) => {
    let best = 0;
    for (const T of list) {
      const dx = x - T.x, dz = z - T.z, d2 = dx * dx + dz * dz, R = T.r + 2;
      if (d2 > R * R || y > T.y + T.h) continue;
      const k = Math.min(1, 1.25 * (1 - d2 / (R * R))) * Math.min(1, (T.y + T.h - y) / 8);
      if (k > best) best = k;
    }
    return best;
  };
  return pts;
}
