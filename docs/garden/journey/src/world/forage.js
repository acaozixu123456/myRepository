// 路上能摘的东西：野莓丛、蘑菇、蜜花、溪葱、野苹果树、松塔、栗子、竹笋、海贝、冰莓，各长在各的地方（位置是按地形挑的，每次打开都一样）。
// 每一种一个实例化网格（灌木、小树这种摘完还留着的，果子另外一个网格，摘了就藏起来）；能摘的上面有一点一闪一闪的小亮光，远一点也找得到。
// 还有一口做饭的锅（三根木棍架在火上），在营地做饭的时候摆出来。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { U, patch } from './atmo.js';
import { rng } from './noise.js';
import { DOM, lakeQ, ICE_Q } from './land.js';
import { SEA, CAMP_SITES, VISTAS } from './route.js';
import { ITEMS } from '../game/cook.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();

// 一块带颜色的零件：几何体摆到位、写上顶点色（折角的硬边，和石头木头一个味道）
export function part(geo, color, { p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1] } = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.deleteAttribute('uv');
  _m.compose(_p.set(...p), _q.setFromEuler(_e.set(...r)), _s.set(...(Array.isArray(s) ? s : [s, s, s])));
  g.applyMatrix4(_m); g.computeVertexNormals();
  const n = g.attributes.position.count, col = new Float32Array(n * 3); _c.set(color);
  for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
export const ico = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);
export const ball = r => new THREE.SphereGeometry(r, 7, 5);
export const cone = (r, h, n = 6) => new THREE.ConeGeometry(r, h, n);
export const cyl = (a, b, h, n = 6) => new THREE.CylinderGeometry(a, b, h, n);
const cap = r => new THREE.SphereGeometry(r, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);

// 每一种长什么样：{ base（摘完还留着的部分，可以没有）, fruit（摘走的部分）, glint（小亮光多高） }
function models() {
  const M = {};
  // 野莓：一丛矮灌木，上面挂着紫红的莓子
  {
    const base = [part(ico(0.4, 1), '#3c6a2e', { p: [0, 0.27, 0], s: [1.1, 0.7, 1] }), part(ico(0.26, 1), '#487a32', { p: [0.3, 0.2, 0.12], s: [1, 0.75, 1] }), part(ico(0.24, 1), '#355f2b', { p: [-0.28, 0.19, -0.1], s: [1, 0.75, 1] })];
    const fruit = [];
    for (let i = 0; i < 9; i++) { const a = i * 2.4, r = 0.2 + 0.2 * ((i * 7) % 5) / 5, y = 0.5 - r * 0.42 + 0.05 * Math.sin(i * 3); fruit.push(part(ball(0.065), i % 3 ? '#c02a58' : '#8a2468', { p: [Math.cos(a) * r * 1.1, y, Math.sin(a) * r] })); }
    M.berry = { base, fruit, glint: 0.75 };
  }
  // 蘑菇：三朵，一大两小
  {
    const one = (x, z, h, r, col) => [part(cyl(0.035, 0.05, h, 6), '#efe6d2', { p: [x, h / 2, z] }), part(cap(r), col, { p: [x, h - 0.01, z], s: [1, 0.72, 1] }), part(cyl(r * 0.92, r * 0.92, 0.012, 8), '#e8dcc0', { p: [x, h - 0.012, z] })];
    M.mushroom = { fruit: [...one(0, 0, 0.2, 0.13, '#c8692e'), ...one(0.15, 0.08, 0.13, 0.085, '#d27a38'), ...one(-0.1, 0.13, 0.1, 0.07, '#b85c2a')], glint: 0.45 };
  }
  // 蜜花：一根高高的花茎，上面一串金黄的钟形花
  {
    const base = [part(cyl(0.018, 0.026, 0.95, 5), '#5f8f3e', { p: [0, 0.475, 0] })];
    for (let i = 0; i < 4; i++) { const a = i * 1.7; base.push(part(cone(0.07, 0.34, 4), '#6a9c44', { p: [Math.cos(a) * 0.13, 0.13, Math.sin(a) * 0.13], r: [Math.sin(a) * 1.0, 0, -Math.cos(a) * 1.0], s: [1, 1, 0.35] })); }
    const fruit = [];
    for (let i = 0; i < 6; i++) { const a = i * 2.1, y = 0.56 + i * 0.075; fruit.push(part(cone(0.075, 0.13, 6), i % 2 ? '#f4b83a' : '#ffd060', { p: [Math.cos(a) * 0.07, y, Math.sin(a) * 0.07], r: [Math.sin(a) * 0.9 + Math.PI, 0, -Math.cos(a) * 0.9] })); }
    fruit.push(part(ball(0.05), '#ffe08a', { p: [0, 1.0, 0] }));
    M.honey = { base, fruit, glint: 1.2 };
  }
  // 溪葱：一小丛细长的叶子，根上一点白
  {
    const fruit = [];
    for (let i = 0; i < 7; i++) { const a = i * 0.9 + 0.3, t = 0.18 + 0.1 * (i % 3); fruit.push(part(cone(0.022, 0.5, 4), i % 2 ? '#7ab84e' : '#5fa244', { p: [Math.cos(a) * 0.05 + Math.cos(a) * t * 0.25, 0.25, Math.sin(a) * 0.05 + Math.sin(a) * t * 0.25], r: [Math.sin(a) * t * 1.6, 0, -Math.cos(a) * t * 1.6] })); }
    fruit.push(part(ball(0.05), '#f2f0e0', { p: [0, 0.03, 0], s: [1.3, 0.8, 1.3] }));
    M.herb = { fruit, glint: 0.65 };
  }
  // 野苹果：一棵矮矮的小树（树冠是几团叶子），挂着红苹果
  {
    const base = [part(cyl(0.05, 0.08, 0.8, 6), '#5e412b', { p: [0, 0.4, 0] }), part(cyl(0.03, 0.045, 0.5, 5), '#5e412b', { p: [0.17, 0.82, 0.05], r: [0, 0, -0.7] }), part(cyl(0.03, 0.045, 0.45, 5), '#5e412b', { p: [-0.15, 0.85, -0.05], r: [0.2, 0, 0.7] })];
    const lobes = [[0, 1.42, 0, 0.5], [0.48, 1.2, 0.12, 0.4], [-0.46, 1.24, -0.1, 0.4], [0.1, 1.22, 0.48, 0.36], [-0.05, 1.25, -0.48, 0.38], [0.3, 1.5, -0.25, 0.32], [-0.28, 1.52, 0.24, 0.32]];
    lobes.forEach(([x, y, z, r], i) => base.push(part(ico(r, 1), ['#33602a', '#3d6e2e', '#2c5526'][i % 3], { p: [x, y, z], s: [1, 0.82, 1], r: [i, i * 2, 0] })));
    const fruit = [];
    for (let i = 0; i < 7; i++) { const a = i * 0.9 + 0.4, r = 0.5 + 0.2 * (i % 2); fruit.push(part(ball(0.085), i % 2 ? '#d8402a' : '#e86a3a', { p: [Math.cos(a) * r, 0.98 + 0.1 * (i % 3), Math.sin(a) * r] })); }
    M.apple = { base, fruit, glint: 2.05 };
  }
  // 松子：掉在地上的几个松塔
  {
    const one = (x, z, ry, rz) => part(ico(0.085, 1), '#7a5232', { p: [x, 0.07, z], r: [0, ry, rz], s: [0.85, 1.55, 0.85] });
    M.pine = { fruit: [one(0, 0, 0, 1.3), one(0.2, 0.1, 1, 1.5), one(-0.08, 0.2, 2.2, 0.4), part(cone(0.05, 0.1, 5), '#9a6a3c', { p: [0.1, 0.05, -0.15], r: [1.4, 0, 0] })], glint: 0.45 };
  }
  // 栗子：带刺的壳，裂开一个露出油亮的栗子
  {
    const burr = (x, z, s) => part(ico(0.1, 0), '#a08a3e', { p: [x, 0.09 * s, z], s, r: [x * 9, z * 7, 0] });
    M.chestnut = { fruit: [burr(0, 0, 1), burr(0.22, 0.06, 0.85), burr(-0.1, 0.2, 0.9), part(ball(0.055), '#5a2c18', { p: [0.08, 0.05, -0.16], s: [1, 0.85, 1] }), part(ball(0.05), '#6b351c', { p: [-0.16, 0.045, -0.06], s: [1, 0.85, 1] })], glint: 0.45 };
  }
  // 竹笋：刚冒头的两根
  {
    const one = (x, z, h, r) => [part(cone(r, h, 7), '#7a5a3a', { p: [x, h / 2, z] }), part(cone(r * 0.55, h * 0.5, 7), '#c9b06a', { p: [x, h * 0.78, z] })];
    M.shoot = { fruit: [...one(0, 0, 0.42, 0.12), ...one(0.2, 0.1, 0.26, 0.085)], glint: 0.7 };
  }
  // 海贝：一枚扇贝、一只小海螺
  {
    M.shell = { fruit: [part(new THREE.SphereGeometry(0.17, 9, 4, 0, Math.PI), '#f3dccb', { p: [0, 0.03, 0], r: [-Math.PI / 2 + 0.25, 0, 0], s: [1, 1, 0.3] }), part(cone(0.07, 0.17, 7), '#e9b594', { p: [0.24, 0.06, 0.1], r: [0, 0.4, 1.35] }), part(ball(0.045), '#f6ece0', { p: [-0.18, 0.03, 0.15], s: [1, 0.6, 1] })], glint: 0.45 };
  }
  // 冰莓：贴着雪地的一小丛，叶子上顶着雪，果子是冰蓝色的
  {
    const base = [part(ico(0.3, 1), '#4f6f66', { p: [0, 0.16, 0], s: [1.15, 0.6, 1] }), part(ico(0.2, 1), '#5a7c70', { p: [0.24, 0.12, 0.08], s: [1, 0.7, 1] }), part(ico(0.2, 1), '#f2f6fa', { p: [-0.02, 0.29, 0], s: [1.1, 0.3, 0.95] }), part(ico(0.12, 1), '#f2f6fa', { p: [0.25, 0.22, 0.08], s: [1.1, 0.3, 1] })];
    const fruit = [];
    for (let i = 0; i < 8; i++) { const a = i * 0.82, r = 0.3 + 0.05 * (i % 2); fruit.push(part(ball(0.06), i % 2 ? '#3f9fe6' : '#6fc4ff', { p: [Math.cos(a) * r * 1.12, 0.17 + 0.05 * (i % 3), Math.sin(a) * r] })); }
    M.frost = { base, fruit, glint: 0.65 };
  }
  return M;
}

// 每一种长在哪：zones 是 [地方 id 或 [x, z], 半径, 挪多少]，ok(x, z, h, land) 再挑一遍
function rules(land) {
  const grass = (x, z) => land.snow(x, z) < 0.25 && land.sand(x, z) < 0.2 && land.bamboo(x, z) < 0.5;
  return {
    berry: { n: 11, zones: [['valley', 46], ['grove', 40], ['bridge', 36], ['view', 28], ['shoal', 30]], ok: (x, z) => grass(x, z) && land.roadDist(x, z) < 26 },
    mushroom: { n: 9, zones: [['west', 48], ['grove', 32], ['autumn', 40]], ok: (x, z) => land.snow(x, z) < 0.25 && land.sand(x, z) < 0.2 },
    honey: { n: 7, zones: [['east', 30]], ok: grass },
    herb: { n: 9, zones: [['shoal', 55], ['bridge', 50], ['autumn', 60], ['campMeadow', 45]], ok: (x, z) => { const d = land.streamDist(x, z); return d > 3.6 && d < 8.5 && land.snow(x, z) < 0.3; } },
    apple: { n: 6, zones: [['mill', 34], [[36, -146], 22]], ok: grass },
    pine: { n: 7, zones: [['west', 55]], ok: (x, z) => land.snow(x, z) < 0.3 },
    chestnut: { n: 8, zones: [['autumn', 80]], ok: (x, z) => land.autumn(x, z) > 0.45 },
    shoot: { n: 7, zones: [['bamboo', 62]], ok: (x, z) => land.bamboo(x, z) > 0.4 },
    shell: { n: 8, zones: [['cove', 75]], ok: (x, z, h) => land.sand(x, z) > 0.6 && h > SEA.y + 0.35 && h < SEA.y + 3.2 },
    frost: { n: 8, zones: [['pass', 45], ['lake', 85], ['campLake', 40]], ok: (x, z) => land.snow(x, z) > 0.6 && lakeQ(x, z) > ICE_Q + 0.25 },
  };
}

export function makeSpots(land, places) {
  const R = rules(land), spots = [];
  const keep = [...CAMP_SITES.map(c => [c.x, c.z, 7]), ...VISTAS.map(v => [v.x, v.z, 4]), ...places.filter(p => p.id === 'camp').map(p => [p.x, p.z, 10])];
  ITEMS.forEach((I, ki) => {
    const rule = R[I.id], rnd = rng(7001 + ki * 131);
    let got = 0;
    for (let t = 0; t < 900 && got < rule.n; t++) {
      const Zn = rule.zones[(got + t) % rule.zones.length], P = Array.isArray(Zn[0]) ? { x: Zn[0][0], z: Zn[0][1] } : places.find(p => p.id === Zn[0]);
      if (!P) continue;
      const a = rnd() * 6.283, d = Math.sqrt(rnd()) * Zn[1], x = P.x + Math.cos(a) * d, z = P.z + Math.sin(a) * d;
      if (x < DOM.x0 + 14 || z < DOM.z0 + 14 || x > DOM.x0 + DOM.w - 14 || z > DOM.z0 + DOM.d - 14) continue;
      const h = land.heightExact(x, z);
      if (land.normal(x, z)[1] < 0.9 || land.seaDepth(x, z) > 0 || land.roadDist(x, z) < 1.7) continue;
      if (I.id !== 'herb' && land.streamDist(x, z) < 4.2) continue;
      if (!rule.ok(x, z, h, land)) continue;
      if (keep.some(k => Math.hypot(x - k[0], z - k[1]) < k[2]) || spots.some(s => Math.hypot(x - s.x, z - s.z) < 6.5)) continue;
      spots.push({ i: spots.length, kind: I.id, x, y: h, z, yaw: rnd() * 6.283, s: 0.9 + rnd() * 0.25 });
      got++;
    }
  });
  return spots;
}

const GLINT_VS = /* glsl */`
attribute float aOn; attribute float aPh;
uniform float uTime; uniform float uPx;
varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4( position, 1.0 );
  gl_Position = projectionMatrix * mv;
  float d = max( -mv.z, 0.1 );
  float tw = 0.55 + 0.45 * sin( uTime * 2.6 + aPh * 6.283 ) * sin( uTime * 1.1 + aPh * 17.0 );
  vA = aOn * smoothstep( 1.6, 4.0, d ) * ( 1.0 - smoothstep( 34.0, 46.0, d ) ) * tw;
  gl_PointSize = clamp( uPx * 0.5 * ( 0.7 + 0.3 * tw ) / d, 3.0, 26.0 );
  if ( vA < 0.02 ) gl_Position = vec4( 0.0, 0.0, 2.0, 1.0 );
}`;
const GLINT_FS = /* glsl */`
varying float vA;
void main() {
  // 四角的小星星
  vec2 q = abs( gl_PointCoord - 0.5 ) * 2.0;
  float star = max( 0.0, 1.0 - ( q.x + q.y ) - 6.0 * q.x * q.y ) + 0.35 * max( 0.0, 1.0 - length( q ) * 2.6 );
  float a = clamp( star * 1.6, 0.0, 1.0 ) * vA;
  if ( a < 0.02 ) discard;
  gl_FragColor = vec4( vec3( 1.0, 0.97, 0.82 ), a );
  #include <colorspace_fragment>
}`;

export function makeForage(land, places) {
  const g = new THREE.Group(); g.name = 'forage';
  const spots = makeSpots(land, places), M = models();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  patch(mat, { rim: 0.12, gobo: true, fog: true });
  const meshes = {};
  for (const I of ITEMS) {
    const L = spots.filter(s => s.kind === I.id), mdl = M[I.id];
    const mk = parts => { const im = new THREE.InstancedMesh(mergeGeometries(parts), mat, L.length); im.frustumCulled = false; im.receiveShadow = true; im.castShadow = false; g.add(im); return im; };
    const base = mdl.base ? mk(mdl.base) : null, fruit = mk(mdl.fruit);
    L.forEach((s, k) => {
      s.k = k; s.top = mdl.glint * s.s;
      _m.compose(_p.set(s.x, s.y - 0.02, s.z), _q.setFromEuler(_e.set(0, s.yaw, 0)), _s.setScalar(s.s));
      if (base) base.setMatrixAt(k, _m);
      fruit.setMatrixAt(k, _m);
    });
    meshes[I.id] = { base, fruit };
  }
  // 小亮光：一次画完
  const n = spots.length, pos = new Float32Array(n * 3), on = new Float32Array(n).fill(1), ph = new Float32Array(n);
  spots.forEach((s, i) => { pos.set([s.x, s.y + s.top, s.z], i * 3); ph[i] = (i * 0.618) % 1; });
  const gg = new THREE.BufferGeometry();
  gg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); gg.setAttribute('aOn', new THREE.BufferAttribute(on, 1)); gg.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
  const gm = new THREE.ShaderMaterial({ uniforms: { uTime: U.uTime, uPx: { value: 1200 } }, vertexShader: GLINT_VS, fragmentShader: GLINT_FS, transparent: true, depthWrite: false });
  const glint = new THREE.Points(gg, gm); glint.frustumCulled = false; glint.renderOrder = 6; g.add(glint);

  const show = (s, there) => {
    if (s.there === there) return; s.there = there;
    const im = meshes[s.kind].fruit;
    _m.compose(_p.set(s.x, s.y - 0.02, s.z), _q.setFromEuler(_e.set(0, s.yaw, 0)), _s.setScalar(there ? s.s : 0.0001));
    im.setMatrixAt(s.k, _m); im.instanceMatrix.needsUpdate = true;
    on[s.i] = there ? 1 : 0; gg.attributes.aOn.needsUpdate = true;
  };
  for (const s of spots) s.there = true;
  g.userData = {
    spots,
    update(px) { gm.uniforms.uPx.value = px; },
    // 离 p 最近的、还没摘的一处（r 米以内）
    near(p, r = 2.1) {
      let best = null, bd = r;
      for (const s of spots) { if (!s.there) continue; const d = Math.hypot(p.x - s.x, p.z - s.z); if (d < bd && Math.abs(p.y - s.y) < 2.5) { bd = d; best = s; } }
      return best;
    },
    take(s) { show(s, false); },
    // 按存档摆一遍：gone(i) 说这一处今天摘过没有
    refresh(gone) { for (const s of spots) show(s, !gone(s.i)); },
  };
  return g;
}

// 做饭的锅：三根木棍架在火上，吊着一口小铁锅
export function makePot() {
  const g = new THREE.Group(); g.name = 'pot'; g.visible = false;
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  patch(mat, { rim: 0.15, gobo: false, fog: true });
  const parts = [];
  for (let i = 0; i < 3; i++) { const a = i * 2.094 + 0.5, L = 1.55, tilt = 0.42; parts.push(part(cyl(0.022, 0.03, L, 5), '#6b4a30', { p: [Math.cos(a) * 0.3, 0.68, Math.sin(a) * 0.3], r: [-Math.sin(a) * tilt, 0, Math.cos(a) * tilt] })); }
  parts.push(part(cyl(0.006, 0.006, 0.5, 4), '#3a3632', { p: [0, 1.05, 0] }));
  const bowl = new THREE.SphereGeometry(0.2, 10, 5, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  parts.push(part(bowl, '#34302e', { p: [0, 0.82, 0], s: [1, 0.85, 1] }), part(new THREE.TorusGeometry(0.2, 0.018, 5, 12), '#45403c', { p: [0, 0.82, 0], r: [Math.PI / 2, 0, 0] }), part(cyl(0.185, 0.185, 0.01, 10), '#d8c9a0', { p: [0, 0.8, 0] }));
  const m = new THREE.Mesh(mergeGeometries(parts), mat); m.castShadow = true; g.add(m);
  return g;
}
