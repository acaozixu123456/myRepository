// 脚下溅起来的小东西：蹚水的水珠、土路上的尘土、雪地的雪沫、沙滩的沙子。
// 一共 192 个点循环用；每个点只在出生时写一次（位置、速度、出生时刻），之后怎么飞全在着色器里算，平时不占 CPU。
import * as THREE from 'three';
import { U } from './atmo.js';

const N = 192;
const VS = /* glsl */`
attribute vec3 aVel; attribute vec4 aInfo; attribute vec4 aCol;   // aInfo：出生时刻、活多久、多大（米）、种类（0 水珠，1 一团尘土/雪沫）
uniform float uTime; uniform float uPx;
varying vec4 vCol; varying float vKind; varying float vSeed;
void main() {
  float age = uTime - aInfo.x, u = age / max( aInfo.y, 1e-3 );
  vec3 p = position; float size = aInfo.z, a = aCol.a;
  if ( aInfo.w < 0.5 ) {
    // 水珠：抛起来再落下去，越来越小
    p += aVel * age + vec3( 0.0, -4.9 * age * age, 0.0 );
    size *= 1.0 - 0.45 * u; a *= 1.0 - u * u;
  } else {
    // 尘土：冲出去一小段就停住，慢慢散开、往上飘一点
    p += aVel * ( 1.0 - exp( -3.2 * age ) ) / 3.2 + vec3( 0.0, 0.1 * age, 0.0 );
    size *= 0.45 + 1.5 * sqrt( max( u, 0.0 ) ); a *= sqrt( max( 1.0 - u, 0.0 ) ) * smoothstep( 0.0, 0.08, u );
  }
  vec4 mv = modelViewMatrix * vec4( p, 1.0 );
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp( uPx * size / max( -mv.z, 0.1 ), 1.0, 110.0 );
  if ( age < 0.0 || u >= 1.0 || a < 0.01 ) { gl_Position = vec4( 0.0, 0.0, 2.0, 1.0 ); a = 0.0; }
  vCol = vec4( aCol.rgb, a ); vKind = aInfo.w; vSeed = fract( aInfo.x * 7.31 + aInfo.z * 91.7 );
}`;
const FS = /* glsl */`
uniform vec3 uSunColor; uniform vec3 uAmb;
varying vec4 vCol; varying float vKind; varying float vSeed;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length( d ) * 2.0;
  if ( vKind > 0.5 ) {
    // 尘土不是正圆：扁一点，边上鼓出几个包
    float an = atan( d.y, d.x );
    r = length( d * vec2( 1.0, 1.3 ) ) * 2.0 * ( 1.0 + 0.2 * sin( an * 3.0 + vSeed * 40.0 ) + 0.11 * sin( an * 5.0 - vSeed * 70.0 ) );
  }
  float a = vCol.a * ( vKind < 0.5 ? 1.0 - smoothstep( 0.5, 1.0, r ) : 1.0 - smoothstep( 0.1, 1.0, r ) );
  if ( a < 0.012 ) discard;
  vec3 col = vCol.rgb * ( uAmb * 0.9 + uSunColor * 0.62 );
  if ( vKind < 0.5 ) col += uSunColor * 0.3 * ( 1.0 - smoothstep( 0.0, 0.6, r ) );    // 水珠中间亮一点
  gl_FragColor = vec4( col, a );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// 各种地面溅起来的颜色（线性色）
const COLORS = {
  water: [0.86, 0.93, 0.97], dust: [0.8, 0.68, 0.52], snow: [0.93, 0.95, 0.99], sand: [0.88, 0.8, 0.62],
};

export function makePuffs() {
  const pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), info = new Float32Array(N * 4), col = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) info[i * 4] = -100;
  const geo = new THREE.BufferGeometry();
  const A = { position: new THREE.BufferAttribute(pos, 3), aVel: new THREE.BufferAttribute(vel, 3), aInfo: new THREE.BufferAttribute(info, 4), aCol: new THREE.BufferAttribute(col, 4) };
  for (const [k, a] of Object.entries(A)) { a.setUsage(THREE.DynamicDrawUsage); geo.setAttribute(k, a); }
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uSunColor: U.uSunColor, uAmb: U.uAmb, uPx: { value: 1200 } },
    vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.name = 'puffs'; pts.frustumCulled = false; pts.renderOrder = 5;
  let head = 0, dirty = false;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const put = (kind, x, y, z, vx, vy, vz, life, size, c, alpha) => {
    const i = head; head = (head + 1) % N;
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
    info[i * 4] = U.uTime.value; info[i * 4 + 1] = life; info[i * 4 + 2] = size; info[i * 4 + 3] = kind;
    col[i * 4] = c[0]; col[i * 4 + 1] = c[1]; col[i * 4 + 2] = c[2]; col[i * 4 + 3] = alpha;
    dirty = true;
  };
  const P = {
    object: pts, on: true,
    // 水花：k 是力度（0.3 轻轻一脚 ~ 1.2 马跑过去），(fx, fz) 是往哪边走（水珠往前带一点）
    splash(x, y, z, k = 1, fx = 0, fz = 0) {
      if (!P.on) return;
      const n = Math.round(5 + 7 * k);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.283, s = rnd(0.25, 1.0) * (0.5 + 0.9 * k);
        put(0, x + Math.cos(a) * 0.06, y + 0.03, z + Math.sin(a) * 0.06, Math.cos(a) * s + fx * 0.7 * k, rnd(1.4, 2.7) * (0.6 + 0.6 * k), Math.sin(a) * s + fz * 0.7 * k, rnd(0.42, 0.66), rnd(0.045, 0.085) * (0.8 + 0.3 * k), COLORS.water, 0.9);
      }
      // 落脚的地方一小团白沫
      put(1, x, y + 0.06, z, fx * 0.3, 0.25, fz * 0.3, 0.45, 0.2 + 0.14 * k, COLORS.water, 0.5);
    },
    // 一小团尘土 / 雪沫 / 沙子：往后、往两边散开
    puff(what, x, y, z, k = 1, fx = 0, fz = 0) {
      if (!P.on) return;
      const c = COLORS[what] || COLORS.dust, snow = what === 'snow';
      const n = k > 0.8 ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.283, s = rnd(0.2, 0.9), o = rnd(0.02, 0.22);
        put(1, x + Math.cos(a) * o, y + rnd(0.08, 0.2), z + Math.sin(a) * o, Math.cos(a) * s - fx * 0.5 * k, rnd(0.3, 0.9), Math.sin(a) * s - fz * 0.5 * k, rnd(0.45, 1.05) * (snow ? 0.75 : 1), rnd(0.13, 0.34) * (0.7 + 0.6 * k), c, (snow ? 0.6 : 0.46) * rnd(0.6, 1));
      }
    },
    // 落地、跳下马：四周一圈
    ring(what, x, y, z, k = 1) {
      if (!P.on) return;
      const c = COLORS[what] || COLORS.dust, n = 9;
      for (let i = 0; i < n; i++) {
        const a = i / n * 6.283 + Math.random() * 0.5, s = rnd(0.9, 1.6) * k;
        if (what === 'water') put(0, x + Math.cos(a) * 0.15, y + 0.02, z + Math.sin(a) * 0.15, Math.cos(a) * s, rnd(1.6, 2.6), Math.sin(a) * s, rnd(0.45, 0.65), rnd(0.035, 0.06), c, 0.85);
        else put(1, x + Math.cos(a) * 0.2, y + 0.14, z + Math.sin(a) * 0.2, Math.cos(a) * s * 1.6, rnd(0.25, 0.6), Math.sin(a) * s * 1.6, rnd(0.65, 1.05), rnd(0.24, 0.36), c, what === 'snow' ? 0.6 : 0.46);
      }
    },
    // 每帧：px = 一米在一米远处有多少像素
    update(px) {
      mat.uniforms.uPx.value = px;
      if (dirty) { dirty = false; for (const a of Object.values(A)) a.needsUpdate = true; }
    },
  };
  return P;
}
