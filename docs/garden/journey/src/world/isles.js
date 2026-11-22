// 云上浮岛：镜之原上空飘着的一串小岛，一个比一个高。上面是草，底下是倒挂的石头。
// 每座岛上有一股上升的风，张着翅膀让它托上去，再滑到下一座。最大的那座有个小水潭，水从岛边落下去，落进镜面里。
// 岛的形状全是算出来的：isleTop(x, z) 给岛面的高度（不在岛上是 null），游戏里站得上去靠它（game/journey.js）。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MIRROR } from './route.js';
import { MIRROR_DEPTH } from './land.js';
import { U, FOG_FN, patch } from './atmo.js';
import { MIST_VS, MIST_FS } from './water.js';
import { part, ico } from './forage.js';
import { vnoise, sstep, lerp, rng } from './noise.js';

// up：岛面比镜面高多少米；r：半径；m：中间鼓起来多少；dep：底下的石头垂多深
export const ISLES = [
  { id: 'a', x: -48, z: -416, up: 36, r: 13, m: 1.5, dep: 15, ph: 0.4 },
  { id: 'b', x: -80, z: -442, up: 49, r: 10.5, m: 1.1, dep: 12, ph: 2.1 },
  { id: 'c', x: -56, z: -478, up: 64, r: 17, m: 2.2, dep: 21, ph: 4.4 },
  { id: 'd', x: -16, z: -466, up: 80, r: 9.5, m: 1.0, dep: 11, ph: 1.3 },
  { id: 'e', x: -20, z: -430, up: 97, r: 12.5, m: 1.7, dep: 16, ph: 5.2 },
  // 岛之间飘着的小石头（也能落脚）
  { id: 's1', x: -65, z: -427, up: 43, r: 3.2, m: 0.3, dep: 4.5, ph: 0.9 },
  { id: 's2', x: -73, z: -462, up: 57, r: 3.8, m: 0.3, dep: 5.5, ph: 3.3 },
  { id: 's3', x: -34, z: -479, up: 72, r: 3.4, m: 0.3, dep: 5, ph: 2.7 },
  { id: 's4', x: -11, z: -447, up: 89, r: 3.0, m: 0.3, dep: 4.2, ph: 4.9 },
];
for (const I of ISLES) I.y = MIRROR.y + I.up + MIRROR_DEPTH * 0;
export const ISLE_TOP = ISLES[4];
// 大岛上的小水潭，和水落下去的岛边
export const POND = { x: ISLES[2].x + 6.5, z: ISLES[2].z + 5.5, r: 3.3 };
// 上升的风：岸边一股把人托到第一座岛，之后每座岛上一股托到下一座（world/thermals.js 用）
export const ISLE_THERMALS = (() => {
  const out = [{ id: 'isle0', x: -37, z: -399, r: 9, y: MIRROR.y, h: ISLES[0].up + 15 }];
  for (let i = 0; i < 4; i++) {
    const A = ISLES[i], B = ISLES[i + 1], dx = B.x - A.x, dz = B.z - A.z, l = Math.hypot(dx, dz), k = A.r * 0.5;
    out.push({ id: 'isle' + (i + 1), x: A.x + dx / l * k, z: A.z + dz / l * k, r: 9, y: A.y, h: B.y - A.y + 17 });
  }
  return out;
})();

// 岛边不是正圆：按方向进进出出
const rim = (I, a) => I.r * (1 + 0.13 * Math.sin(3 * a + I.ph) + 0.07 * Math.sin(5 * a + I.ph * 2.3) + 0.04 * Math.sin(9 * a + I.ph * 4.1));
const topAt = (I, x, z, t) => {
  const k = 1 - t * t;
  let y = I.y + I.m * k * k + (I.r > 6 ? 0.5 * (vnoise(x * 0.22 + I.ph * 9, z * 0.22) - 0.5) * k : 0) - 0.35 * t * t * t * t;
  // 大岛上的水潭：一个浅浅的坑
  if (I === ISLES[2]) { const d = Math.hypot(x - POND.x, z - POND.z); if (d < POND.r + 1.6) y = lerp(I.y + 0.35, y, sstep(POND.r - 0.4, POND.r + 1.6, d)) - 0.5 * sstep(POND.r, POND.r - 1.6, d); }
  return y;
};
const botAt = (I, x, z, t) => I.y - 0.9 - I.dep * Math.pow(1 - t, 0.62) * (0.72 + 0.56 * vnoise(x * 0.3 + 11, z * 0.3 + I.ph * 5)) - 0.3 * I.dep * sstep(0.55, 0, t) * vnoise(x * 0.9, z * 0.9);
const _h = { I: null, t: 0 };
function find(x, z, pad = 0) {
  for (const I of ISLES) {
    const dx = x - I.x, dz = z - I.z, d2 = dx * dx + dz * dz, R0 = I.r * 1.25 + pad;
    if (d2 > R0 * R0) continue;
    const d = Math.sqrt(d2), R = rim(I, Math.atan2(dz, dx));
    if (d > R + pad) continue;
    _h.I = I; _h.t = Math.min(1, d / R);
    return _h;
  }
  return null;
}
// 岛面的高度；不在岛上是 null
export function isleTop(x, z) { const h = find(x, z); return h ? topAt(h.I, x, z, h.t) : null; }
// 这一点是不是在岛的石头里（飞的时候撞上去要挡住）；返回岛面和岛底，不在任何岛的范围里是 null
export function isleSpan(x, z, pad = 0.6) { const h = find(x, z, pad); return h ? [botAt(h.I, x, z, h.t), topAt(h.I, x, z, h.t), h.I] : null; }
export const isleAt = (x, z) => { const h = find(x, z); return h ? h.I : null; };
// 水潭有多深
export function isleWater(x, z) { const d = Math.hypot(x - POND.x, z - POND.z); return d < POND.r ? Math.max(0, ISLES[2].y + 0.28 - isleTop(x, z)) : 0; }

// 岛上的树和花草（world.js 把它们并进树和草的清单里，这样远处也有替身、近处有影子）
export function isleFlora(names) {
  const R = rng(7741), trees = [], small = {};
  const push = (name, x, z, s, tint = 1) => {
    if (!names.includes(name)) return;
    const y = isleTop(x, z); if (y === null || isleWater(x, z) > 0) return;
    const v = tint * (0.94 + R() * 0.12);
    (small[name] ||= []).push(x, y - 0.03, z, R() * 6.283, s, v, v, v * 0.97);
  };
  const tree = (I, a, d, t, s, tint) => { const x = I.x + Math.cos(a) * d, z = I.z + Math.sin(a) * d, y = isleTop(x, z); if (y !== null) trees.push({ t, x, z, s, ry: R() * 6.283, y: y - 0.1, tint, isle: true }); };
  const [A, B, C, D, E] = ISLES;
  const PINK = [2.2, 1.25, 1.5], GOLD = [2.6, 1.9, 0.6];
  tree(A, 2.2, 6.5, 'CommonTree_3', 0.95); tree(A, 4.6, 5, 'CommonTree_1', 0.7, PINK);
  tree(B, 0.6, 4.5, 'Pine_2', 0.85); tree(B, 3.5, 5.5, 'CommonTree_5', 0.75);
  tree(C, 3.6, 8, 'CommonTree_1', 1.25, PINK); tree(C, 4.5, 11, 'CommonTree_3', 0.9); tree(C, 2.5, 11.5, 'Pine_2', 1.0); tree(C, 5.6, 9.5, 'CommonTree_5', 0.85); tree(C, 3.0, 4, 'CommonTree_3', 0.7, PINK);
  tree(D, 2.0, 3.5, 'CommonTree_5', 0.8, GOLD);
  tree(E, 3.9, 3.5, 'CommonTree_1', 1.5, GOLD); tree(E, 1.2, 7.5, 'Pine_2', 0.7);
  for (const I of ISLES) {
    const n = Math.round(I.r * I.r * 2.2);
    for (let i = 0; i < n; i++) {
      const a = R() * 6.283, d = Math.sqrt(R()) * I.r * 0.92, x = I.x + Math.cos(a) * d, z = I.z + Math.sin(a) * d, k = R();
      if (k < 0.34) push('Grass_Common_Short', x, z, 0.28 + R() * 0.2);
      else if (k < 0.46) push('Grass_Wispy_Tall', x, z, 0.26 + R() * 0.16);
      else if (k < 0.6) push(R() < 0.5 ? 'Flower_3_Group' : 'Flower_3_Group@r', x, z, 0.3 + R() * 0.16);
      else if (k < 0.74) push(['Flower_4_Group', 'Flower_4_Group@y', 'Flower_4_Group@p'][Math.floor(R() * 3)], x, z, 0.3 + R() * 0.18);
      else if (k < 0.82) push('Clover_2', x, z, 0.3 + R() * 0.15);
      else if (k < 0.88) push('Fern_1', x, z, 0.1 + R() * 0.07);
      else if (k < 0.91 && I.r > 6) push(R() < 0.5 ? 'Bush_Common' : 'Bush_Common_Flowers', x, z, 0.5 + R() * 0.4);
      else if (k < 0.96) push('Pebble_Round_2', x, z, 0.4 + R() * 0.7);
      else if (I.r > 6) push('Rock_Medium_2', x, z, 0.14 + R() * 0.2);
    }
  }
  return { trees, small };
}

const hex = c => new THREE.Color(c);
const GRASS = [hex('#5d8440'), hex('#6f9447'), hex('#517a3c')], SOIL = hex('#7a5a3c'), ROCK = [hex('#8b8377'), hex('#746b62'), hex('#a0988a'), hex('#5f5852')];

function isleGeo(I) {
  const RN = Math.max(6, Math.round(I.r * 1.1)), SN = Math.max(20, Math.round(I.r * 4.2));
  const top = { pos: [], col: [], idx: [] }, c = new THREE.Color();
  // 岛面：一圈一圈的顶点，颜色是深浅不一的草绿，边上露出土
  top.pos.push(I.x, topAt(I, I.x, I.z, 0), I.z); c.copy(GRASS[0]); top.col.push(c.r, c.g, c.b);
  for (let i = 1; i <= RN; i++) for (let j = 0; j < SN; j++) {
    const a = j / SN * 6.283, t = i / RN, R = rim(I, a), x = I.x + Math.cos(a) * R * t, z = I.z + Math.sin(a) * R * t;
    top.pos.push(x, topAt(I, x, z, t), z);
    const n = vnoise(x * 0.5 + 7, z * 0.5), n2 = vnoise(x * 1.7, z * 1.7 + 9);
    c.copy(GRASS[0]).lerp(GRASS[1], sstep(0.35, 0.75, n)).lerp(GRASS[2], sstep(0.55, 0.9, n2) * 0.7);
    c.lerp(SOIL, sstep(0.9, 1, t + (n2 - 0.5) * 0.08));
    if (I === ISLES[2]) { const d = Math.hypot(x - POND.x, z - POND.z); c.lerp(hex('#b9ad8f'), sstep(POND.r + 1.2, POND.r - 0.2, d) * 0.85); }
    top.col.push(c.r, c.g, c.b);
  }
  for (let j = 0; j < SN; j++) top.idx.push(0, 1 + (j + 1) % SN, 1 + j);
  for (let i = 1; i < RN; i++) for (let j = 0; j < SN; j++) {
    const a = 1 + (i - 1) * SN + j, b = 1 + (i - 1) * SN + (j + 1) % SN, d = a + SN, e = b + SN;
    top.idx.push(a, b, d, b, e, d);
  }
  const tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.Float32BufferAttribute(top.pos, 3)); tg.setAttribute('color', new THREE.Float32BufferAttribute(top.col, 3)); tg.setIndex(top.idx);
  tg.computeVertexNormals();
  // 岛底：倒挂的石头，一块一块的平面（不共用顶点，棱角分明），上面一圈是土
  const BN = Math.max(5, Math.round(I.r * 0.7)), P = [];
  const bp = (i, j) => {
    const a = (j % SN) / SN * 6.283 + (i % 2) * 3.1416 / SN, t = 1 - i / BN, R = rim(I, a);
    const jit = i > 0 && i < BN ? (vnoise(i * 3.1 + I.ph, j * 2.3) - 0.5) * 0.9 : 0;
    const x = I.x + Math.cos(a) * (R * t + jit), z = I.z + Math.sin(a) * (R * t + jit);
    return [x, i === 0 ? topAt(I, x, z, 1) : botAt(I, x, z, Math.max(0, t)), z];
  };
  const pos = [], col = [];
  const tri = (p, q, r) => {
    pos.push(...p, ...r, ...q);
    const y = (p[1] + q[1] + r[1]) / 3, d = I.y - y, n = vnoise(p[0] * 0.8 + q[2], y * 0.9);
    c.copy(ROCK[Math.floor(n * 3.99)]).lerp(ROCK[3], sstep(I.dep * 0.5, I.dep * 1.2, d) * 0.6);
    c.lerp(SOIL, sstep(2.4, 0.7, d + n * 0.8));
    // 一层一层的岩纹
    c.multiplyScalar(0.9 + 0.16 * Math.sin(y * 1.9 + n * 3));
    for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b);
  };
  for (let i = 0; i < BN; i++) for (let j = 0; j < SN; j++) {
    const a = bp(i, j), b = bp(i, j + 1), d = bp(i + 1, j), e = bp(i + 1, j + 1);
    if (i === BN - 1) tri(a, d, b);
    else if (i % 2) { tri(a, d, b); tri(b, d, e); } else { tri(a, e, b); tri(a, d, e); }
  }
  const bg = new THREE.BufferGeometry();
  bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  bg.computeVertexNormals();
  return [tg.toNonIndexed(), bg];
}

// 落下去的水：一条细长的带子，越往下越散、越淡
const FALL_VS = /* glsl */`
attribute vec2 aQ; varying vec2 vQ; varying vec3 vWP;
void main() { vQ = aQ; vec4 w = modelMatrix * vec4( position, 1.0 ); vWP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const FALL_FS = /* glsl */`
uniform float uTime; uniform vec3 uSunColor; uniform vec3 uAmb; uniform float uH;
${FOG_FN}
varying vec2 vQ; varying vec3 vWP;
float h21( vec2 p ) { p = fract( p * vec2( 123.34, 456.21 ) ); p += dot( p, p + 45.32 ); return fract( p.x * p.y ); }
float vn( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( h21( i ), h21( i + vec2( 1, 0 ) ), f.x ), mix( h21( i + vec2( 0, 1 ) ), h21( i + 1.0 ), f.x ), f.y ); }
void main() {
  float d = vQ.y * uH;                                   // 落下去多少米
  float sp = sqrt( d + 0.3 ) * 2.4;                      // 越落越快
  float s1 = vn( vec2( vQ.x * 7.0, sp - uTime * 2.6 ) ), s2 = vn( vec2( vQ.x * 17.0 + 3.0, sp * 2.3 - uTime * 4.7 ) );
  float edge = 1.0 - abs( vQ.x * 2.0 - 1.0 );
  float thin = mix( 1.0, 0.3, smoothstep( 0.0, 1.0, vQ.y ) );
  float a = smoothstep( 0.0, 0.5, edge ) * ( 0.25 + 0.75 * smoothstep( 0.42 - 0.2 * thin, 0.75, s1 * 0.6 + s2 * 0.4 + 0.25 * thin ) );
  a *= smoothstep( 0.0, 0.02, vQ.y ) * ( 1.0 - smoothstep( 0.86, 1.0, vQ.y ) ) * mix( 0.95, 0.5, vQ.y );
  if ( a < 0.02 ) discard;
  vec3 col = vec3( 0.9, 0.95, 0.98 ) * ( uAmb * 0.9 + uSunColor * 0.75 + 0.05 );
  col = jFog( col, vWP );
  gl_FragColor = vec4( col, a );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const POND_FS = /* glsl */`
uniform float uTime; uniform vec3 uSunColor; uniform vec3 uAmb;
${FOG_FN}
varying vec2 vQ; varying vec3 vWP;
void main() {
  vec3 V = normalize( cameraPosition - vWP );
  float w = sin( vWP.x * 5.0 + uTime * 1.3 ) * sin( vWP.z * 4.3 - uTime * 1.1 );
  float fres = pow( 1.0 - max( V.y, 0.0 ), 3.0 );
  vec3 light = uAmb * 0.8 + uSunColor * 0.7;
  vec3 col = mix( vec3( 0.2, 0.5, 0.56 ), vec3( 0.72, 0.86, 0.95 ), fres * 0.8 + w * 0.05 ) * light;
  col = jFog( col, vWP );
  gl_FragColor = vec4( col, smoothstep( 1.0, 0.82, vQ.x ) * ( 0.55 + 0.4 * fres ) );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function buildIsles() {
  const g = new THREE.Group(); g.name = 'isles';
  const tops = [], bots = [];
  for (const I of ISLES) { const [t, b] = isleGeo(I); tops.push(t); bots.push(b); }
  const R = rng(5150), bits = [];
  // 岛边垂下来的几块碎石、岛面上的石头
  for (const I of ISLES) if (I.r > 6) for (let i = 0; i < 7; i++) {
    const a = R() * 6.283, d = I.r * (0.5 + R() * 0.75), s = 0.5 + R() * 1.1, x = I.x + Math.cos(a) * d, z = I.z + Math.sin(a) * d;
    bits.push(part(ico(s, 0), ['#8b8377', '#746b62', '#a0988a'][i % 3], { p: [x, I.y - I.dep * (0.75 + R() * 0.7) - 2, z], r: [R() * 3, R() * 3, R() * 3], s: [1, 1.5 + R(), 1] }));
  }
  // 最高那座岛上的一张长凳和一根挂布条的杆子（坐不了，只是摆着）
  {
    const E = ISLE_TOP, bx = E.x + 3.5, bz = E.z + 4.5, by = isleTop(bx, bz), wood = '#8a6844';
    const box = (w, h, d, x, y, z, c = wood) => bits.push(part(new THREE.BoxGeometry(w, h, d).toNonIndexed(), c, { p: [bx + x, by + y, bz + z] }));
    box(1.6, 0.07, 0.42, 0, 0.46, 0); box(1.6, 0.36, 0.06, 0, 0.74, -0.2); box(0.08, 0.46, 0.4, -0.7, 0.23, 0); box(0.08, 0.46, 0.4, 0.7, 0.23, 0);
    box(0.09, 3.4, 0.09, 2.6, 1.7, -1.2, '#6f553a'); box(0.5, 0.16, 0.02, 2.86, 3.2, -1.2, '#d9583c'); box(0.42, 0.14, 0.02, 2.82, 2.95, -1.2, '#f1ead9'); box(0.36, 0.13, 0.02, 2.8, 2.72, -1.2, '#e6b045');
  }
  for (const b of bits) { for (const k of Object.keys(b.attributes)) if (!['position', 'normal', 'color'].includes(k)) b.deleteAttribute(k); }
  const strip = geo => { for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'color'].includes(k)) geo.deleteAttribute(k); return geo; };
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  patch(mat, { rim: 0.12, gobo: false, fog: true, shadowFade: true });
  const mesh = new THREE.Mesh(mergeGeometries([...tops, ...bots, ...bits.map(b => strip(b.index ? b.toNonIndexed() : b))]), mat);
  mesh.receiveShadow = true; mesh.castShadow = false; mesh.matrixAutoUpdate = false; mesh.name = 'isleRock';
  g.add(mesh);
  // 水潭
  const C = ISLES[2], wy = C.y + 0.28;
  {
    const pos = [POND.x, wy, POND.z], aq = [0, 0], idx = [], S = 24;
    for (let i = 0; i < S; i++) { const a = i / S * 6.283; pos.push(POND.x + Math.cos(a) * (POND.r + 0.5), wy, POND.z + Math.sin(a) * (POND.r + 0.5)); aq.push(1, 0); idx.push(0, 1 + (i + 1) % S, 1 + i); }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); pg.setAttribute('aQ', new THREE.Float32BufferAttribute(aq, 2)); pg.setIndex(idx);
    const pm = new THREE.Mesh(pg, new THREE.ShaderMaterial({ uniforms: { ...U }, vertexShader: FALL_VS, fragmentShader: POND_FS, transparent: true, depthWrite: false }));
    pm.renderOrder = 2; pm.matrixAutoUpdate = false; g.add(pm);
  }
  // 落水：从水潭靠岛边的那一侧流出去，落到镜面上
  const dx = POND.x - C.x, dz = POND.z - C.z, dl = Math.hypot(dx, dz), ux = dx / dl, uz = dz / dl;
  const ea = Math.atan2(uz, ux), eR = rim(C, ea), lipX = C.x + ux * (eR + 0.25), lipZ = C.z + uz * (eR + 0.25), lipY = C.y - 0.25, H = lipY - MIRROR.y;
  {
    const pos = [], aq = [], idx = [], N = 26, tx = -uz, tz = ux;
    for (let i = 0; i <= N; i++) {
      const t = i / N, y = lipY - H * t, out = 1.6 * Math.sqrt(t) + 0.6 * t, w = 0.55 + 1.5 * t;
      for (const s of [-1, 1]) { pos.push(lipX + ux * out + tx * w * s, y, lipZ + uz * out + tz * w * s); aq.push(s * 0.5 + 0.5, t); }
      if (i < N) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); fg.setAttribute('aQ', new THREE.Float32BufferAttribute(aq, 2)); fg.setIndex(idx);
    const fm = new THREE.Mesh(fg, new THREE.ShaderMaterial({ uniforms: { ...U, uH: { value: H } }, vertexShader: FALL_VS, fragmentShader: FALL_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    fm.renderOrder = 4; fm.matrixAutoUpdate = false; fm.name = 'isleFall'; g.add(fm);
    // 水潭到岛边的那一小段水
    const cg = new THREE.BufferGeometry(), cp = [], cq = [], ci = [], M = 6;
    for (let i = 0; i <= M; i++) { const t = i / M, d = lerp(POND.r - 0.3, eR + 0.3 - dl, t), x = POND.x + ux * d, z = POND.z + uz * d; for (const s of [-1, 1]) { cp.push(x + tx * 0.5 * s, lerp(wy, lipY + 0.02, t * t), z + tz * 0.5 * s); cq.push(0.4, 0); } if (i < M) { const b = i * 2; ci.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); } }
    cg.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3)); cg.setAttribute('aQ', new THREE.Float32BufferAttribute(cq, 2)); cg.setIndex(ci);
    const cm = new THREE.Mesh(cg, new THREE.ShaderMaterial({ uniforms: { ...U }, vertexShader: FALL_VS, fragmentShader: POND_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    cm.renderOrder = 2; cm.matrixAutoUpdate = false; g.add(cm);
  }
  // 落到镜面上溅起来的水雾
  const footX = lipX + ux * 2.2, footZ = lipZ + uz * 2.2;
  {
    const mp = [], seed = [];
    for (let i = 0; i < 12; i++) { const a = R() * 6.283, d = Math.sqrt(R()) * 2.6; mp.push(footX + Math.cos(a) * d, MIRROR.y + 0.2 + R() * 1.2, footZ + Math.sin(a) * d); seed.push(R()); }
    for (let i = 0; i < 10; i++) { const t = 0.35 + R() * 0.6; mp.push(lipX + ux * (1.6 * Math.sqrt(t) + 0.6 * t) + (R() - 0.5) * 2, lipY - H * t, lipZ + uz * (1.6 * Math.sqrt(t) + 0.6 * t) + (R() - 0.5) * 2); seed.push(R()); }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(mp, 3)); sg.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
    sg.computeBoundingSphere(); sg.boundingSphere.radius += 8;
    const mm = new THREE.ShaderMaterial({ uniforms: { uTime: U.uTime, uScale: { value: 400 }, uColor: { value: new THREE.Color(0.8, 0.82, 0.84) } }, vertexShader: MIST_VS, fragmentShader: MIST_FS, transparent: true, depthWrite: false });
    const pts = new THREE.Points(sg, mm); pts.renderOrder = 5; pts.matrixAutoUpdate = false;
    pts.onBeforeRender = (r, sc, cam) => { mm.uniforms.uScale.value = 0.9 * r.domElement.height / (2 * Math.tan(cam.fov * Math.PI / 360)); };
    g.add(pts);
    g.userData.mistColor = mm.uniforms.uColor.value;
  }
  g.userData.fallFoot = { x: footX, z: footZ };
  g.userData.fallTop = { x: lipX, y: lipY, z: lipZ };
  return g;
}
