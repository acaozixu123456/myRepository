// 萤光菇林：东南山坡上一小块平地，长着比人高得多的大蘑菇。白天是粉蓝粉紫的伞盖，天一黑，伞盖底下的褶子和伞面上的斑点自己亮起来，
// 地上映着一圈一圈的光，空气里飘着发亮的孢子。
// 小一点的蘑菇伞盖是软的：跳上去会被弹起来（game/journey.js airMove）。一朵比一朵高，可以一路弹到最大的三朵伞盖上面，上面能站人（capTop）。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SHROOM } from './route.js';
import { U, FOG_FN, patch } from './atmo.js';
import { rng } from './noise.js';

export const SHROOM_U = { uGlow: { value: 0.06 } };
const PALS = [
  { cap: '#3fa9a2', spot: '#effff8', gill: '#bff5e6', glow: [0.2, 1.0, 0.8] },
  { cap: '#8472d8', spot: '#f3ecff', gill: '#d9cdfa', glow: [0.6, 0.42, 1.0] },
  { cap: '#d870a8', spot: '#ffeef6', gill: '#fbd0e4', glow: [1.0, 0.4, 0.72] },
  { cap: '#4f8fd8', spot: '#ecf5ff', gill: '#cfe3fa', glow: [0.3, 0.66, 1.0] },
];
const STEM = new THREE.Color('#efe6d2'), STEM2 = new THREE.Color('#cbbd9f');

// 一朵蘑菇：h 伞顶多高、R 伞盖半径、sr 伞柄半径、dome 伞盖鼓多高；原点在伞柄底
function shroomGeo({ h, R, sr, dome, pal, seed = 1, segs = 18, bend = 0 }) {
  const P = PALS[pal], rnd = rng(seed * 977 + 13), c = new THREE.Color(), cap = new THREE.Color(P.cap), spot = new THREE.Color(P.spot), gill = new THREE.Color(P.gill);
  const yRim = h - dome;
  // 伞柄：底下粗一点，往上收
  const SN = 6, pos = [], col = [], glow = [], idx = [];
  const sx = t => bend * t * t;
  for (let i = 0; i <= SN; i++) {
    const t = i / SN, r = sr * (1.35 - 0.5 * t + 0.25 * Math.pow(1 - t, 4)), y = t * (yRim + dome * 0.15);
    for (let j = 0; j < segs; j++) {
      const a = j / segs * 6.283;
      pos.push(Math.cos(a) * r + sx(t), y, Math.sin(a) * r);
      c.copy(STEM2).lerp(STEM, Math.min(1, t * 2.5)); col.push(c.r, c.g, c.b);
      const g = 0.1 + 0.22 * t * t; glow.push(P.glow[0] * g, P.glow[1] * g, P.glow[2] * g);
    }
  }
  for (let i = 0; i < SN; i++) for (let j = 0; j < segs; j++) { const a = i * segs + j, b = i * segs + (j + 1) % segs, d = a + segs, e = b + segs; idx.push(a, d, b, b, d, e); }
  // 伞盖：先是底下的褶子（从伞柄往外到伞沿），再翻上来到伞顶
  const prof = [];
  const GN = 4, DN = 7;
  for (let i = 0; i <= GN; i++) { const t = i / GN, r = sr * 0.9 + (R * 0.985 - sr * 0.9) * t; prof.push([r, yRim + dome * 0.22 * (1 - t) * (1 - t) - 0.02 * R, 0]); }
  for (let i = 0; i <= DN; i++) { const u = i / DN, a = (1 - u) * Math.PI / 2; prof.push([R * Math.pow(Math.sin(a), 0.8), yRim + dome * Math.pow(Math.cos(a), 0.75), 1]); }
  // 伞面上的斑点：几个随机的圆
  const spots = []; for (let i = 0, n = 5 + Math.floor(R * 2.2); i < n; i++) spots.push([rnd() * 6.283, 0.15 + rnd() * 0.72, 0.07 + rnd() * 0.1]);
  const base = pos.length / 3, CS = segs * 2;
  for (let i = 0; i < prof.length; i++) for (let j = 0; j <= CS; j++) {
    const a = j / CS * 6.283, [r, y, top] = prof[i], wob = top ? 1 + 0.035 * Math.sin(a * 5 + seed) * (r / R) : 1;
    const x = Math.cos(a) * r * wob + sx(1), z = Math.sin(a) * r * wob;
    pos.push(x, y, z);
    if (top) {
      let sk = 0; const q = r / R;
      for (const [sa, sq, ss] of spots) { const dx = Math.cos(a) * q - Math.cos(sa) * sq, dz = Math.sin(a) * q - Math.sin(sa) * sq; sk = Math.max(sk, 1 - Math.hypot(dx, dz) / ss); }
      sk = Math.max(0, Math.min(1, sk * 2.2));
      c.copy(cap).multiplyScalar(0.86 + 0.2 * (1 - q)).lerp(spot, sk); col.push(c.r, c.g, c.b);
      const g = 0.1 + 0.85 * sk; glow.push(P.glow[0] * g, P.glow[1] * g, P.glow[2] * g);
    } else {
      const stripe = j % 2 ? 1 : 0.72;
      c.copy(gill).multiplyScalar(stripe); col.push(c.r, c.g, c.b);
      const g = 0.8 * stripe; glow.push(P.glow[0] * g, P.glow[1] * g, P.glow[2] * g);
    }
  }
  const W = CS + 1;
  for (let i = 0; i < prof.length - 1; i++) for (let j = 0; j < CS; j++) { const a = base + i * W + j, b = a + 1, d = a + W, e = d + 1; idx.push(a, b, d, b, e, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('aGlow', new THREE.Float32BufferAttribute(glow, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

const DISC_VS = /* glsl */`
attribute vec3 color; attribute float aA; varying vec3 vC; varying float vA; varying vec3 vWP;
void main() { vC = color; vA = aA; vec4 w = modelMatrix * vec4( position, 1.0 ); vWP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const DISC_FS = /* glsl */`
uniform float uGlow; uniform float uTime;
${FOG_FN}
varying vec3 vC; varying float vA; varying vec3 vWP;
void main() {
  float a = vA * vA * ( 0.85 + 0.15 * sin( uTime * 0.9 + vWP.x * 0.7 + vWP.z * 0.5 ) );
  gl_FragColor = vec4( vC * a * uGlow * 0.42 * ( 1.0 - jFogAmount( vWP ) ), 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const SPORE_VS = /* glsl */`
attribute vec4 aI; attribute vec3 color; uniform float uTime; uniform float uPx; uniform float uGlow;
varying vec3 vC; varying float vA;
void main() {
  float t = fract( aI.x + uTime * aI.y / aI.z );
  vec3 p = position + vec3( sin( uTime * 0.4 + aI.x * 40.0 ) * 0.7, t * aI.z, cos( uTime * 0.33 + aI.x * 23.0 ) * 0.7 );
  vec4 mv = modelViewMatrix * vec4( p, 1.0 );
  gl_Position = projectionMatrix * mv;
  float d = max( -mv.z, 0.1 );
  vA = smoothstep( 0.0, 0.15, t ) * ( 1.0 - smoothstep( 0.7, 1.0, t ) ) * ( 0.12 + 0.88 * uGlow ) * ( 0.6 + 0.4 * sin( uTime * 2.0 + aI.x * 90.0 ) ) * ( 1.0 - smoothstep( 90.0, 140.0, d ) );
  vC = color;
  gl_PointSize = clamp( uPx * aI.w / d, 1.5, 26.0 );
}`;
const SPORE_FS = /* glsl */`
varying vec3 vC; varying float vA;
void main() {
  float r = length( gl_PointCoord - 0.5 ) * 2.0;
  float a = ( 1.0 - smoothstep( 0.0, 1.0, r ) ); a = a * a * vA;
  if ( a < 0.01 ) discard;
  gl_FragColor = vec4( vC * a * 1.6, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// 能站上去的大伞盖、会把人弹起来的小伞盖（建好以后填进去）
const PLATS = [], BOUNCY = [];
// 大伞盖顶上的高度：人在它那么高（或更高）才算；不在伞盖上是 null
export function capTop(x, z, y) {
  let best = null;
  for (const m of PLATS) {
    const dx = x - m.x, dz = z - m.z, d2 = dx * dx + dz * dz;
    if (d2 > m.R * m.R) continue;
    const t = m.top - m.dome * 0.8 * Math.pow(d2 / (m.R * m.R), 1.3);
    if (y > t - 1.5 && (best === null || t > best)) best = t;
  }
  return best;
}

export function buildShrooms(land) {
  const g = new THREE.Group(); g.name = 'shrooms';
  const R = rng(4242), X = SHROOM.x, Z = SHROOM.z, gy = (x, z) => land.heightExact(x, z);
  PLATS.length = 0; BOUNCY.length = 0;
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  mat.onBeforeCompile = sh => {
    sh.uniforms.uShroomGlow = SHROOM_U.uGlow;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aGlow; varying vec3 vGlow;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vGlow; uniform float uShroomGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vGlow * uShroomGlow;');
  };
  patch(mat, { rim: 0.2, gobo: false, fog: true, shadowFade: true });
  const statics = [], blocks = [], discs = { pos: [], col: [], a: [], idx: [] };
  // 地上的一圈光：贴着地面的一个圆片，中间亮、边上没有，顺着坡歪一点
  const disc = (x, z, r, pal, k = 1) => {
    const e = 0.6, nx = (gy(x - e, z) - gy(x + e, z)) / (2 * e), nz = (gy(x, z - e) - gy(x, z + e)) / (2 * e), b = discs.pos.length / 3, S = 12, G = PALS[pal].glow;
    discs.pos.push(x, gy(x, z) + 0.07, z); discs.col.push(G[0] * k, G[1] * k, G[2] * k); discs.a.push(1);
    for (let i = 0; i < S; i++) { const a = i / S * 6.283, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; discs.pos.push(px, gy(x, z) + 0.07 - nx * (px - x) - nz * (pz - z), pz); discs.col.push(G[0] * k, G[1] * k, G[2] * k); discs.a.push(0); discs.idx.push(b, b + 1 + (i + 1) % S, b + 1 + i); }
  };
  // 三朵最大的：伞盖扁一点，上面能站人
  const giants = [[-5, -3, 6.2, 4.2, 0], [3.5, -1.5, 9.0, 4.8, 1], [6, 6.5, 12.5, 5.5, 3]];
  giants.forEach(([dx, dz, h, r, pal], i) => {
    const x = X + dx, z = Z + dz, y = gy(x, z) - 0.15, dome = 1.0 + 0.1 * i, sr = 0.55 + 0.1 * i;
    const geo = shroomGeo({ h, R: r, sr, dome, pal, seed: 31 + i, segs: 22 }); geo.translate(x, y, z); statics.push(geo);
    PLATS.push({ x, z, R: r - 0.15, top: y + h, dome }); blocks.push([x, z, sr * 1.2, h - 1.5]);
    disc(x, z, r * 1.9, pal, 1.2);
  });
  // 会弹的：[相对位置 dx, dz, 伞顶离脚下多高, 伞盖半径, 弹起来的速度, 颜色, 长在第几朵大伞盖上（-1 是地上）]
  const bouncy = [
    [-12, 2, 0.62, 1.25, 10.5, 2, -1], [-9.6, 0.3, 2.4, 1.55, 13.2, 3, -1],
    [-2.8, -2.3, 0.62, 1.0, 11.6, 1, 0], [4.7, 1.2, 0.62, 1.05, 12.6, 2, 1], [6.5, 7, 0.7, 1.2, 17, 0, 2],
    [-13.5, -6.5, 0.7, 1.1, 10.5, 0, -1], [-2, 9.5, 0.9, 1.4, 12, 1, -1], [1.5, 12, 1.9, 1.3, 13, 2, -1], [11, -8, 0.6, 1.2, 11, 3, -1], [13.5, -5.5, 1.6, 1.5, 13.5, 0, -1], [-7, 11, 0.55, 1.0, 10, 3, -1],
  ];
  bouncy.forEach(([dx, dz, h, r, v, pal, on], i) => {
    const x = X + dx, z = Z + dz, y0 = on < 0 ? gy(x, z) - 0.08 : capTop(x, z, 1e4) - 0.05;
    const geo = shroomGeo({ h, R: r, sr: Math.max(0.16, r * 0.2), dome: Math.min(h * 0.55, r * 0.55), pal, seed: 77 + i, segs: 14, bend: 0 });
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y0, z); m.castShadow = true; m.receiveShadow = true; m.name = 'bouncy';
    g.add(m);
    BOUNCY.push({ x, z, R: r, top: y0 + h - 0.08, v, mesh: m, k: 0, t: 9 });
    if (on < 0) { blocks.push([x, z, r * 0.55, h - 0.12]); disc(x, z, r * 2.3, pal, 0.9); }
  });
  // 中等的和一丛丛小的：只是长在那儿
  for (let i = 0; i < 16; i++) {
    const a = R() * 6.283, d = 14 + R() * (SHROOM.r - 12), x = X + Math.cos(a) * d, z = Z + Math.sin(a) * d, pal = Math.floor(R() * 4), h = 2.2 + R() * 4.5, r = h * (0.32 + R() * 0.16);
    const geo = shroomGeo({ h, R: r, sr: 0.16 + h * 0.045, dome: r * (0.45 + R() * 0.3), pal, seed: 200 + i, segs: 14, bend: (R() - 0.5) * 0.8 }); geo.translate(x, gy(x, z) - 0.15, z); statics.push(geo);
    blocks.push([x, z, 0.3 + h * 0.05, h - 1]); disc(x, z, r * 2.2, pal, 1);
  }
  for (let i = 0; i < 90; i++) {
    const a = R() * 6.283, d = 3 + Math.sqrt(R()) * (SHROOM.r + 6), cx = X + Math.cos(a) * d, cz = Z + Math.sin(a) * d, pal = Math.floor(R() * 4), n = 2 + Math.floor(R() * 4);
    if (PLATS.some(m => Math.hypot(cx - m.x, cz - m.z) < 1.2) || BOUNCY.some(m => Math.hypot(cx - m.x, cz - m.z) < m.R + 0.3)) continue;
    for (let k = 0; k < n; k++) {
      const x = cx + (R() - 0.5) * 0.9, z = cz + (R() - 0.5) * 0.9, h = 0.14 + R() * 0.42, r = h * (0.45 + R() * 0.3);
      const geo = shroomGeo({ h, R: r, sr: 0.03 + h * 0.07, dome: r * 0.7, pal, seed: 500 + i * 7 + k, segs: 5, bend: (R() - 0.5) * 0.15 }); geo.translate(x, gy(x, z) - 0.03, z); statics.push(geo);
    }
    disc(cx, cz, 1.1 + R() * 0.6, pal, 0.55);
  }
  const mesh = new THREE.Mesh(mergeGeometries(statics), mat); mesh.castShadow = true; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false; mesh.name = 'shroomStatic';
  g.add(mesh);
  // 地上的光
  {
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.Float32BufferAttribute(discs.pos, 3)); dg.setAttribute('color', new THREE.Float32BufferAttribute(discs.col, 3)); dg.setAttribute('aA', new THREE.Float32BufferAttribute(discs.a, 1)); dg.setIndex(discs.idx);
    const dm = new THREE.Mesh(dg, new THREE.ShaderMaterial({ uniforms: { ...U, uGlow: SHROOM_U.uGlow }, vertexShader: DISC_VS, fragmentShader: DISC_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    dm.renderOrder = 1; dm.matrixAutoUpdate = false; dm.name = 'shroomGlow'; g.add(dm);
  }
  // 飘着的孢子
  {
    const N = 260, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), inf = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) {
      const a = R() * 6.283, d = Math.sqrt(R()) * (SHROOM.r + 4), x = X + Math.cos(a) * d, z = Z + Math.sin(a) * d, G = PALS[Math.floor(R() * 4)].glow;
      pos.set([x, gy(x, z) + 0.2, z], i * 3); col.set(G, i * 3); inf.set([R(), 0.25 + R() * 0.4, 5 + R() * 11, 0.05 + R() * 0.09], i * 4);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('color', new THREE.BufferAttribute(col, 3)); sg.setAttribute('aI', new THREE.BufferAttribute(inf, 4));
    sg.computeBoundingSphere(); sg.boundingSphere.radius += 18;
    const sm = new THREE.ShaderMaterial({ uniforms: { uTime: U.uTime, uGlow: SHROOM_U.uGlow, uPx: { value: 1200 } }, vertexShader: SPORE_VS, fragmentShader: SPORE_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const pts = new THREE.Points(sg, sm); pts.renderOrder = 6; pts.matrixAutoUpdate = false; pts.name = 'spores';
    pts.onBeforeRender = (r, sc, cam) => { sm.uniforms.uPx.value = r.domElement.height / (2 * Math.tan(cam.fov * Math.PI / 360)); };
    g.add(pts);
  }
  g.userData.blocks = blocks;
  g.userData.plats = PLATS; g.userData.bouncy = BOUNCY;
  g.userData.top = { x: PLATS[2].x, y: PLATS[2].top, z: PLATS[2].z };
  // 往下掉的时候是不是落在一朵会弹的伞盖上（y0 这一步之前的高度，y1 之后的）：是就返回它
  g.userData.hit = (x, z, y0, y1) => {
    for (const m of BOUNCY) { if (y0 < m.top - 0.3 || y1 > m.top + 0.02) continue; const dx = x - m.x, dz = z - m.z; if (dx * dx + dz * dz < m.R * m.R) return m; }
    return null;
  };
  g.userData.boing = m => { m.k = 1; m.t = 0; };
  // 被踩的伞盖：压扁再弹回来，晃几下
  g.userData.update = dt => {
    for (const m of BOUNCY) {
      if (m.t > 3) continue;
      m.t += dt;
      const s = m.k * Math.exp(-m.t * 4.5) * Math.cos(m.t * 17);
      m.mesh.scale.set(1 + 0.16 * s, 1 - 0.3 * s, 1 + 0.16 * s);
    }
  };
  return g;
}
