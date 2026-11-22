// 镜之原：盐原上那层薄水。水面是一整块平的，所以可以用最老实的办法做镜子——
// 把镜头翻到水面下面，从那里再画一遍整个世界，贴回水面上（「高」「极高」「中」画质；「低」只映天色）。
// 天、云、太阳、星星银河、远山、人和马都在里面，低头看也是完整的。
// 水下是发白的盐壳，裂成一块一块的多边形；蹚水的圈会把倒影荡开。
import * as THREE from 'three';
import { MIRROR } from './route.js';
import { mirrorE } from './land.js';
import { U, FOG_FN, CLOUD_FN } from './atmo.js';
import { SKY } from './sky.js';
import { RIPPLE_GLSL } from './ripples.js';

export const MIRROR_U = {
  tMir: { value: null }, uTM: { value: new THREE.Matrix4() }, uMirOn: { value: 0 },
  // 水面有多皱：没风的时候几乎是平的；起风、下雨就碎成一片波光
  uRough: { value: 0.02 }, uRain: { value: 0 }, uIsle: { value: new THREE.Vector3(MIRROR.isle.x, MIRROR.isle.z, MIRROR.isle.r * 1.05) },
};

const VS = /* glsl */`
attribute float aE; uniform mat4 uTM;
varying vec3 vWP; varying float vE; varying vec4 vM;
void main() {
  vec4 w = modelMatrix * vec4( position, 1.0 ); vWP = w.xyz; vE = aE; vM = uTM * w;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const FS = /* glsl */`
uniform float uTime; uniform vec3 uSunColor; uniform vec3 uZenith; uniform vec3 uMid; uniform vec3 uAmb;
uniform sampler2D tMir; uniform float uMirOn; uniform float uRough; uniform float uRain; uniform float uStars; uniform vec3 uIsle;
${FOG_FN}
${CLOUD_FN}
${RIPPLE_GLSL}
varying vec3 vWP; varying float vE; varying vec4 vM;
float h21( vec2 p ) { p = fract( p * vec2( 123.34, 456.21 ) ); p += dot( p, p + 45.32 ); return fract( p.x * p.y ); }
vec2 h22( vec2 p ) { return vec2( h21( p ), h21( p + 17.3 ) ); }
float vn( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( h21( i ), h21( i + vec2( 1, 0 ) ), f.x ), mix( h21( i + vec2( 0, 1 ) ), h21( i + 1.0 ), f.x ), f.y ); }
// 盐壳的裂纹：沃罗诺伊格子的边，鼓起来一道白棱
float ridge( vec2 p, float w ) {
  vec2 i = floor( p ), f = fract( p ); float d1 = 8.0, d2 = 8.0;
  for ( int y = -1; y <= 1; y++ ) for ( int x = -1; x <= 1; x++ ) {
    vec2 g = vec2( float( x ), float( y ) ), r = g + h22( i + g ) * 0.8 + 0.1 - f; float d = dot( r, r );
    if ( d < d1 ) { d2 = d1; d1 = d; } else if ( d < d2 ) d2 = d;
  }
  return 1.0 - smoothstep( 0.0, w, sqrt( d2 ) - sqrt( d1 ) );
}
void main() {
  float t = uTime;
  vec2 p = vWP.xz;
  vec3 Vv = cameraPosition - vWP; float dist = length( Vv ); vec3 V = Vv / dist;
  // 盐底
  float n1 = vn( p * 0.06 + 3.0 ), n2 = vn( p * 0.6 );
  float near = 1.0 - smoothstep( 25.0, 70.0, dist );
  float rg = near > 0.0 ? ridge( p * 0.42 + n1 * 0.8, 0.07 + dist * 0.004 ) * near : 0.0;
  vec3 salt = vec3( 0.8, 0.82, 0.84 ) * ( 0.86 + 0.1 * n1 + 0.06 * n2 );
  salt = mix( salt, vec3( 0.97, 0.96, 0.94 ), rg * 0.7 );
  float cl = jCloud( vWP );
  vec3 light = uAmb * 0.62 + uSunColor * max( uSunDir.y, 0.0 ) * 1.5 * cl;
  vec3 bed = salt * light;
  // 水面的皱：两层慢慢挪的细波，下雨时再加一层碎的
  vec2 w = vec2( vn( p * 0.55 + vec2( t * 0.22, t * 0.1 ) ) - 0.5, vn( p * 0.55 + vec2( 7.3 - t * 0.15, 3.1 + t * 0.2 ) ) - 0.5 );
  w += 0.5 * vec2( vn( p * 2.3 - vec2( t * 0.5, 0.0 ) ) - 0.5, vn( p * 2.3 + vec2( 11.0, t * 0.45 ) ) - 0.5 );
  vec2 dn = w * uRough;
  if ( uRain > 0.01 ) {
    // 雨点：一格一个小圈，一闪一闪
    vec2 rp = p * 2.2, ri = floor( rp ), rf = fract( rp ) - 0.5;
    float ph = fract( h21( ri ) + t * ( 0.7 + 0.5 * h21( ri + 3.0 ) ) ), rr = length( rf - ( h22( ri ) - 0.5 ) * 0.5 );
    float ringR = exp( -pow( ( rr - ph * 0.42 ) / 0.035, 2.0 ) ) * ( 1.0 - ph ) * uRain * ( 1.0 - smoothstep( 20.0, 55.0, dist ) );
    dn += normalize( rf + 1e-4 ) * ringR * 0.25;
  }
  vec3 rip = jRipples( p, t );
  dn += rip.xy * 0.035;
  float ring = clamp( rip.z, 0.0, 1.0 );
  // 倒影
  vec3 N = normalize( vec3( dn.x, 1.0, dn.y ) );
  vec3 R = reflect( -V, N );
  vec3 rf;
  if ( uMirOn > 0.5 ) {
    vec4 q = vM; q.xy += dn * 9.0;
    rf = min( texture2DProj( tMir, q ).rgb, vec3( 14.0 ) );
  } else {
    vec3 hz = jFogColor( normalize( vec3( R.x, max( R.y, 0.0 ), R.z ) ) );
    rf = mix( hz, mix( uMid, uZenith, smoothstep( 0.2, 0.8, R.y ) ), smoothstep( 0.02, 0.3, R.y ) );
    rf += uSunColor * pow( max( dot( R, uSunDir ), 0.0 ), 400.0 ) * 4.0;
  }
  float fres = pow( 1.0 - max( V.y, 0.0 ), 4.0 );
  // 薄水很静：就算直直地低头看，也有一大半是倒影
  float k = mix( 0.6, 0.97, fres );
  // 夜里盐底几乎没有光，剩下的全是星空
  k = mix( k, max( k, 0.9 ), uStars );
  // 岸边水越来越薄，露出湿的盐
  float shore = smoothstep( 0.4, -1.8, vE + ( n2 - 0.5 ) * 0.8 ) * smoothstep( 0.0, 2.2, length( p - uIsle.xy ) - uIsle.z + ( n2 - 0.5 ) * 0.8 );
  k *= mix( 0.25, 1.0, shore );
  vec3 col = mix( bed * mix( 0.72, 1.0, 1.0 - shore ), rf, k );
  col += light * ring * 0.2;
  col = jFog( col, vWP );
  gl_FragColor = vec4( col, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const _n = new THREE.Vector3(0, 1, 0), _pp = new THREE.Vector3(), _cp = new THREE.Vector3(), _v = new THREE.Vector3(), _look = new THREE.Vector3(), _tg = new THREE.Vector3();
const _rm = new THREE.Matrix4(), _pl = new THREE.Plane(), _cl = new THREE.Vector4(), _q = new THREE.Vector4(), _sz = new THREE.Vector2();
const _fr = new THREE.Frustum(), _pm = new THREE.Matrix4();

export function buildMirror() {
  const C = 2.5, X0 = MIRROR.x - MIRROR.a * 1.3, Z0 = MIRROR.z - MIRROR.b * 1.3, NX = Math.ceil(MIRROR.a * 2.6 / C), NZ = Math.ceil(MIRROR.b * 2.6 / C);
  const E = new Float32Array((NX + 1) * (NZ + 1)), id = new Int32Array((NX + 1) * (NZ + 1)).fill(-1);
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) E[j * (NX + 1) + i] = mirrorE(X0 + i * C, Z0 + j * C);
  const pos = [], ae = [], idx = [];
  const vert = (i, j) => { const k = j * (NX + 1) + i; if (id[k] < 0) { id[k] = pos.length / 3; pos.push(X0 + i * C, MIRROR.y, Z0 + j * C); ae.push(E[k]); } return id[k]; };
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const k = j * (NX + 1) + i;
    if (Math.min(E[k], E[k + 1], E[k + NX + 1], E[k + NX + 2]) > 3) continue;
    const a = vert(i, j), b = vert(i + 1, j), c = vert(i, j + 1), d = vert(i + 1, j + 1);
    idx.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aE', new THREE.Float32BufferAttribute(ae, 1));
  geo.setIndex(idx); geo.computeBoundingSphere();
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...U, uZenith: SKY.uZenith, uMid: SKY.uMid, uStars: SKY.uStars, ...MIRROR_U },
    vertexShader: VS, fragmentShader: FS,
    // 离得很远时水面和盐底只差十来厘米，往镜头这边让一点，不和地面打架
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -8,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'mirror'; mesh.matrixAutoUpdate = false; mesh.renderOrder = 1;

  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: true, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter });
  const vcam = new THREE.PerspectiveCamera(); vcam.layers.enableAll();
  MIRROR_U.tMir.value = rt.texture;
  const center = new THREE.Vector3(MIRROR.x, MIRROR.y, MIRROR.z), sphere = new THREE.Sphere(center, Math.max(MIRROR.a, MIRROR.b) * 1.3);
  let ok = true;
  // 每帧在正式画之前调：看得见镜之原才画倒影。real = 这档画质要不要真的倒影
  mesh.userData.update = (renderer, scene, camera, real, scale = 0.6) => {
    MIRROR_U.uMirOn.value = 0;
    if (!real || !ok || !mesh.visible) return false;
    _cp.setFromMatrixPosition(camera.matrixWorld);
    if (_cp.y <= MIRROR.y + 0.02 || _cp.distanceTo(center) > 900) return false;
    _fr.setFromProjectionMatrix(_pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    if (!_fr.intersectsSphere(sphere)) return false;
    renderer.getDrawingBufferSize(_sz);
    const w = Math.max(2, Math.round(_sz.x * scale)), h = Math.max(2, Math.round(_sz.y * scale));
    if (rt.width !== w || rt.height !== h) rt.setSize(w, h);
    // 镜头关于水面翻过去（和 three 的 Reflector 一个算法）
    _pp.set(0, MIRROR.y, 0);
    _v.subVectors(_pp, _cp).reflect(_n).negate().add(_pp);
    _rm.extractRotation(camera.matrixWorld);
    _look.set(0, 0, -1).applyMatrix4(_rm).add(_cp);
    _tg.subVectors(_pp, _look).reflect(_n).negate().add(_pp);
    vcam.position.copy(_v); vcam.up.set(0, 1, 0).applyMatrix4(_rm).reflect(_n); vcam.lookAt(_tg);
    vcam.near = camera.near; vcam.far = camera.far; vcam.updateMatrixWorld(); vcam.projectionMatrix.copy(camera.projectionMatrix); vcam.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
    MIRROR_U.uTM.value.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(vcam.projectionMatrix).multiply(vcam.matrixWorldInverse);
    // 水面以下的东西不画：把近裁剪面斜过来贴在水面上
    _pl.setFromNormalAndCoplanarPoint(_n, _pp).applyMatrix4(vcam.matrixWorldInverse);
    _cl.set(_pl.normal.x, _pl.normal.y, _pl.normal.z, _pl.constant);
    const pe = vcam.projectionMatrix.elements;
    _q.set((Math.sign(_cl.x) + pe[8]) / pe[0], (Math.sign(_cl.y) + pe[9]) / pe[5], -1, (1 + pe[10]) / pe[14]);
    _cl.multiplyScalar(2 / _cl.dot(_q));
    pe[2] = _cl.x; pe[6] = _cl.y; pe[10] = _cl.z + 1 - 0.003; pe[14] = _cl.w;
    const crt = renderer.getRenderTarget(), sa = renderer.shadowMap.autoUpdate;
    mesh.visible = false; renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(rt); renderer.state.buffers.depth.setMask(true);
    if (renderer.autoClear === false) renderer.clear();
    renderer.render(scene, vcam);
    if (ok && !mesh.userData.checked) { mesh.userData.checked = true; const gl = renderer.getContext(); if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) ok = false; }
    mesh.visible = true; renderer.shadowMap.autoUpdate = sa; renderer.setRenderTarget(crt);
    MIRROR_U.uMirOn.value = ok ? 1 : 0;
    return ok;
  };
  return mesh;
}

// ---------- 盐原上的东西：一排标路的旧木桩（从南岸一直插到小盐洲），盐洲上一棵枯树、一条长凳、一块站牌 ----------
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { patch } from './atmo.js';
import { part, cyl, ico } from './forage.js';
import { rng } from './noise.js';

export function buildMirrorProps(land) {
  const g = new THREE.Group(); g.name = 'mirrorProps';
  const R = rng(4242), parts = [], blocks = [];
  const I = MIRROR.isle, wood = ['#6e5a48', '#7b6652', '#5f4d3e'];
  // 木桩：从南岸到盐洲，隔几米一根，高高低低、歪歪斜斜，有几根顶上系着褪色的布条
  const ax = -22, az = -399, n = 8;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1) * 0.86, side = i % 2 ? 1.5 : -1.5;
    const x = ax + (I.x - ax) * t + side + (R() - 0.5) * 0.8, z = az + (I.z - az) * t + (R() - 0.5) * 1.2, y = land.heightExact(x, z);
    const h = 1.0 + R() * 0.7, lx = (R() - 0.5) * 0.22, lz = (R() - 0.5) * 0.22;
    parts.push(part(cyl(0.055, 0.075, h, 6), wood[i % 3], { p: [x + lz * h * 0.5, y + h / 2 - 0.05, z - lx * h * 0.5], r: [lx, R() * 3, lz] }));
    if (i % 3 === 1) parts.push(part(new THREE.BoxGeometry(0.02, 0.34, 0.11), ['#c96a4a', '#d8a850', '#5f8fa8'][i % 3 === 1 ? (i >> 1) % 3 : 0], { p: [x + lz * h + 0.03, y + h - 0.24, z - lx * h + 0.07], r: [0.15, R() * 3, 0.1] }));
    blocks.push([x, z, 0.14]);
  }
  // 盐洲：枯树
  const y0 = land.heightExact(I.x, I.z);
  const tx = I.x - 1.6, tz = I.z - 1.2, ty = land.heightExact(tx, tz);
  const limb = (px, py, pz, len, r0, r1, rx, rz, c = '#a8a09a') => parts.push(part(cyl(r1, r0, len, 6), c, { p: [tx + px, ty + py, tz + pz], r: [rx, 0, rz] }));
  limb(0, 1.1, 0, 2.3, 0.2, 0.12, 0.05, -0.06);
  limb(0.5, 2.5, 0.05, 1.5, 0.1, 0.05, 0.1, -0.75);
  limb(-0.45, 2.7, -0.1, 1.6, 0.1, 0.045, -0.1, 0.6);
  limb(0.1, 3.0, 0.45, 1.3, 0.08, 0.035, 0.7, 0.1);
  limb(1.05, 3.25, 0.1, 0.9, 0.05, 0.025, 0.1, -0.2);
  limb(-0.95, 3.6, -0.15, 0.9, 0.045, 0.02, -0.1, 0.15);
  limb(0.15, 3.7, 0.95, 0.8, 0.04, 0.02, 0.25, 0.1);
  limb(0, 0.12, 0, 0.3, 0.34, 0.2, 0, 0, '#9a928c');
  blocks.push([tx, tz, 0.3]);
  // 长凳：面朝北偏西（太阳落下去的方向）
  const bx = I.x + 1.3, bz = I.z + 0.5, by = land.heightExact(bx, bz), ry = 0.28;
  const B = (w, h, d, px, py, pz, c) => { const cs = Math.cos(ry), sn = Math.sin(ry); parts.push(part(new THREE.BoxGeometry(w, h, d), c, { p: [bx + px * cs + pz * sn, by + py, bz - px * sn + pz * cs], r: [0, ry, 0] })); };
  B(1.5, 0.06, 0.4, 0, 0.44, 0, '#8a705a'); B(1.5, 0.3, 0.05, 0, 0.74, 0.2, '#806650'); B(0.07, 0.44, 0.36, -0.62, 0.22, 0, '#5f4d3e'); B(0.07, 0.44, 0.36, 0.62, 0.22, 0, '#5f4d3e'); B(0.05, 0.5, 0.05, -0.62, 0.66, 0.2, '#5f4d3e'); B(0.05, 0.5, 0.05, 0.62, 0.66, 0.2, '#5f4d3e');
  blocks.push([bx, bz, 0.7]);
  // 站牌：一根杆子挑着一块小木牌
  const sx = I.x + 2.6, sz = I.z - 1.8, sy = land.heightExact(sx, sz);
  parts.push(part(cyl(0.04, 0.05, 2.0, 6), '#5f4d3e', { p: [sx, sy + 1.0, sz] }), part(new THREE.BoxGeometry(0.7, 0.3, 0.04), '#d9c9a4', { p: [sx, sy + 1.75, sz + 0.05], r: [0, 0.3, 0.03] }), part(new THREE.BoxGeometry(0.5, 0.03, 0.045), '#7a5a40', { p: [sx, sy + 1.78, sz + 0.055], r: [0, 0.3, 0.03] }));
  blocks.push([sx, sz, 0.15]);
  // 盐洲边上几块盐疙瘩
  for (let i = 0; i < 7; i++) { const a = R() * 6.283, d = I.r * (0.55 + R() * 0.5), x = I.x + Math.cos(a) * d, z = I.z + Math.sin(a) * d, r = 0.14 + R() * 0.2; parts.push(part(ico(r, 0), i % 2 ? '#f3f1ec' : '#e9e2de', { p: [x, land.heightExact(x, z) + r * 0.3, z], r: [R() * 3, R() * 3, 0], s: [1.2, 0.7, 1] })); }
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  patch(mat, { rim: 0.1, gobo: false, fog: true, shadowFade: true });
  const m = new THREE.Mesh(mergeGeometries(parts), mat); m.castShadow = true; m.receiveShadow = true; m.matrixAutoUpdate = false;
  g.add(m);
  g.userData = { blocks, bench: { x: bx, z: bz }, y0 };
  return g;
}
