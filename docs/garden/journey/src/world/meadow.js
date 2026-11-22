// 细草：画质「极高」时，地上除了原来一丛丛的草，再铺一层又细又密的草叶，风吹过来一浪一浪地倒过去。
// 做法：草叶不是一根根摆在地图上的，而是一块跟着镜头走的「草毯」——十几万根草叶排在一个方块里，
// 镜头走到哪，方块循环铺到哪（每根草在世界里的位置不变，只是远处的那一排挪到前面来）。
// 每根草长在哪、多高，都在显卡上算：查一张地面高度图，再查一张「这里长不长草」的图（路上、水里、沙滩、雪地、岩壁不长）。
// 分两层：身边一层细而密，远处一层宽一点、稀一点，离镜头越远越稀。
import * as THREE from 'three';
import { DOM } from './land.js';
import { tuftMaterial } from './terrain.js';

// 风往哪边吹（和天上的云、地上的云影一个方向）
export const WIND = new THREE.Vector2(-0.924, -0.382);

// 一片草叶：一条往上收尖的窄带。position.x = 左右（-1、1，尖上是 0），position.y = 高度比例
function bladeGeo(segs) {
  const pos = [], idx = [];
  for (let k = 0; k < segs; k++) { const t = k / segs; pos.push(-1, t, 0, 1, t, 0); }
  pos.push(0, 1, 0);
  for (let k = 0; k < segs - 1; k++) { const i = k * 2; idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); }
  const i = (segs - 1) * 2; idx.push(i, i + 1, i + 2);
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((v, j) => (j % 3 === 1 ? 1 : 0)), 3));
  g.setIndex(idx);
  return g;
}

function layer(tuni, shared, o) {
  const n = Math.round(o.size * o.size * o.density);
  const aG = new Float32Array(n * 4), aR = new Float32Array(n * 4);
  let s = o.seed; const R = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  // 打散的格点（比纯随机匀，不会东一堆西一块空着）
  const side = Math.ceil(Math.sqrt(n)), cell = o.size / side;
  for (let i = 0; i < n; i++) {
    const gx = i % side, gz = Math.floor(i / side);
    aG[i * 4] = (gx + R()) * cell; aG[i * 4 + 1] = (gz + R()) * cell; aG[i * 4 + 2] = R(); aG[i * 4 + 3] = R();
    aR[i * 4] = R(); aR[i * 4 + 1] = R(); aR[i * 4 + 2] = R(); aR[i * 4 + 3] = R();
  }
  const geo = bladeGeo(o.segs);
  geo.setAttribute('aG', new THREE.InstancedBufferAttribute(aG, 4));
  geo.setAttribute('aR', new THREE.InstancedBufferAttribute(aR, 4));
  geo.instanceCount = n;
  const uniforms = {
    ...shared,
    uGField: { value: new THREE.Vector4(0, 0, o.size, o.size * 0.5 * 1.42) },
    uGBlade: { value: new THREE.Vector4(o.h, o.w, o.inner || 0, o.widen) },
  };
  const mesh = new THREE.Mesh(geo, tuftMaterial(tuni, null, { uniforms, pars: FIELD_PARS, vs: FIELD_VS }));
  mesh.frustumCulled = false; mesh.receiveShadow = true; mesh.castShadow = false; mesh.name = 'meadow';
  mesh.userData.u = uniforms; mesh.userData.size = o.size;
  return mesh;
}

// land：地形；mask：每个格点长不长草（0~255）
export function buildMeadow(land, tuni, mask) {
  const NX = land.NX, NZ = land.NZ;
  const hT = new THREE.DataTexture(land.H instanceof Float32Array ? land.H : new Float32Array(land.H), NX, NZ, THREE.RedFormat, THREE.FloatType);
  hT.magFilter = hT.minFilter = THREE.NearestFilter; hT.generateMipmaps = false; hT.needsUpdate = true;
  const mT = new THREE.DataTexture(mask, NX, NZ, THREE.RedFormat, THREE.UnsignedByteType);
  mT.magFilter = mT.minFilter = THREE.LinearFilter; mT.generateMipmaps = false; mT.unpackAlignment = 1; mT.needsUpdate = true;
  const shared = { uGH: { value: hT }, uGMask: { value: mT }, uGGrid: { value: new THREE.Vector3(NX, NZ, DOM.cell) }, uGWind: { value: WIND } };
  const group = new THREE.Group(); group.name = 'meadow'; group.visible = false;
  // 身边：64 米见方，每平米 26 根；远处：190 米见方，每平米 3 根，身边十几米内不画（那里有细的）
  const near = layer(tuni, shared, { size: 64, density: 26, segs: 3, h: 0.31, w: 0.017, widen: 1.6, seed: 4711 });
  const far = layer(tuni, shared, { size: 190, density: 3, segs: 2, h: 0.37, w: 0.036, widen: 1.3, inner: 19, seed: 9133 });
  group.add(near, far);
  const fwd = new THREE.Vector3();
  // 草毯的中心放在镜头前面一点（身后的草看不见，不用铺那么多）
  group.userData.update = camera => {
    if (!group.visible) return;
    camera.getWorldDirection(fwd); const l = Math.hypot(fwd.x, fwd.z) || 1;
    for (const m of group.children) {
      const k = m.userData.size * 0.5 * 0.42;
      m.userData.u.uGField.value.x = camera.position.x + fwd.x / l * k; m.userData.u.uGField.value.y = camera.position.z + fwd.z / l * k;
    }
  };
  group.userData.blades = near.geometry.instanceCount + far.geometry.instanceCount;
  // 这一圈里不长草（风车、帐篷、长椅这些东西的脚下）
  group.userData.clear = (x, z, r) => {
    const R = r + DOM.cell * 0.6, i0 = Math.max(0, Math.floor((x - R - DOM.x0) / DOM.cell)), i1 = Math.min(NX - 1, Math.ceil((x + R - DOM.x0) / DOM.cell));
    const j0 = Math.max(0, Math.floor((z - R - DOM.z0) / DOM.cell)), j1 = Math.min(NZ - 1, Math.ceil((z + R - DOM.z0) / DOM.cell));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (Math.hypot(DOM.x0 + i * DOM.cell - x, DOM.z0 + j * DOM.cell - z) < R) mask[j * NX + i] = 0;
    mT.needsUpdate = true;
  };
  return group;
}

// 草叶的顶点着色器（接在 terrain.js 的草丛材质上，颜色、打光和草丛一样）
const FIELD_PARS = /* glsl */`
attribute vec4 aG; attribute vec4 aR;
uniform sampler2D uGH; uniform sampler2D uGMask; uniform sampler2D uCloudTex; uniform sampler2D uTread; uniform vec4 uTreadP;
uniform vec4 uDom; uniform vec4 uGField; uniform vec4 uGBlade; uniform vec3 uGGrid; uniform vec2 uGWind;
vec3 jgP;`;
const FIELD_VS = /* glsl */`
vec3 objectNormal = vec3( 0.0, 1.0, 0.0 );
{
  // 这根草现在在世界里的位置（方块循环铺开）
  float S = uGField.z;
  vec2 b = aG.xy + floor( ( uGField.xy - aG.xy ) / S + 0.5 ) * S;
  vec2 dc = b - cameraPosition.xz; float d = length( dc );
  // 越远越稀：每根草有自己的“最远能看到多远”，快到头时矮下去；方块边上也矮下去（转镜头时不会一排排冒出来）
  float vis = clamp( ( uGField.w * mix( 0.32, 1.0, aG.z ) - d ) / 5.0, 0.0, 1.0 );
  vec2 e = abs( b - uGField.xy ); vis *= clamp( ( S * 0.5 - max( e.x, e.y ) ) / 3.0, 0.0, 1.0 );
  if ( uGBlade.z > 0.0 ) vis *= clamp( ( d - uGBlade.z * mix( 0.6, 1.3, aR.y ) ) / 4.0, 0.0, 1.0 );
  vec2 g = ( b - uDom.xy ) / uGGrid.z;
  float y = 0.0, grow = 0.0;
  if ( vis > 0.0 && g.x > 0.5 && g.y > 0.5 && g.x < uGGrid.x - 1.5 && g.y < uGGrid.y - 1.5 ) {
    float mk = texture2D( uGMask, ( g + 0.5 ) / uGGrid.xy ).r;
    grow = clamp( ( mk - aG.w * 0.88 ) / 0.12, 0.0, 1.0 ) * vis;
    if ( grow > 0.0 ) {
      // 地面高度：和地面网格的三角形一样取（对角线是 (0,1)-(1,0)）
      ivec2 gi = ivec2( g ); vec2 f = g - vec2( gi );
      float ha = texelFetch( uGH, gi, 0 ).r, hb = texelFetch( uGH, gi + ivec2( 1, 0 ), 0 ).r, hc = texelFetch( uGH, gi + ivec2( 0, 1 ), 0 ).r, hd = texelFetch( uGH, gi + ivec2( 1, 1 ), 0 ).r;
      y = f.x + f.y < 1.0 ? ha + ( hb - ha ) * f.x + ( hc - ha ) * f.y : hd + ( hc - hd ) * ( 1.0 - f.x ) + ( hb - hd ) * ( 1.0 - f.y );
    }
  }
  float t = position.y;
  // 一片高一片矮
  float cl = texture2D( uCloudTex, b * 0.027 + 0.37 ).r;
  float h = uGBlade.x * mix( 0.55, 1.2, aR.x ) * ( 0.5 + 1.25 * cl ) * grow;
  // 风：平时轻轻晃；一阵一阵的风顺着风向扫过去，扫到的地方草整片倒下去
  vec2 wp = b - uGWind * ( uTime * 6.0 );
  float gu = smoothstep( 0.43, 0.63, texture2D( uCloudTex, wp * 0.0085 ).r ) * ( 0.55 + 0.9 * texture2D( uCloudTex, wp * 0.031 + 0.5 ).r );
  float ang = aR.y * 6.2832; vec2 dir = vec2( cos( ang ), sin( ang ) );
  float sway = sin( uTime * 2.1 + b.x * 0.9 + b.y * 0.7 + ang ) * 0.6 + sin( uTime * 3.7 + b.x * 1.7 - b.y * 1.3 ) * 0.4;
  vec2 bend = dir * mix( 0.1, 0.4, aR.z ) + uGWind * ( 0.09 * sway + 0.8 * gu ) * uWind;
  // 被踩倒
  float trod = 0.0;
  vec2 tc = b - uTreadP.xy; float td = dot( tc, tc );
  if ( uTreadP.w > 0.0 && td < 121.0 ) {
    vec4 jT = texture2D( uTread, b * uTreadP.z );
    trod = jT.b * ( 1.0 - smoothstep( 81.0, 121.0, td ) );
    bend = mix( bend, ( jT.rg * 2.0 - 1.0 ) * 1.05, trod );
  }
  float bl = min( length( bend ), 1.15 ); bend = bend / max( length( bend ), 1e-4 ) * bl;
  // 叶面大致朝着镜头（不然侧对着的草叶只剩一条线）
  vec2 s0 = vec2( -dir.y, dir.x ), cr = normalize( vec2( -dc.y, dc.x ) + 1e-4 );
  vec2 sd = normalize( mix( s0, cr * ( dot( cr, s0 ) < 0.0 ? -1.0 : 1.0 ), 0.65 ) );
  float w = uGBlade.y * ( 1.0 - 0.9 * t * t ) * ( 1.0 + uGBlade.w * smoothstep( 8.0, 60.0, d ) ) * step( 0.001, grow );
  float yy = h * ( t - 0.34 * t * t * bl * bl ) * ( 1.0 - 0.72 * trod );
  vec2 off = bend * h * t * t + sd * position.x * w;
  jgP = vec3( b.x + off.x, y - 0.03 + yy, b.y + off.y );
  objectNormal = normalize( vec3( bend.x * 0.5 * t, 1.0, bend.y * 0.5 * t ) );
  vColor = vec3( t, aR.w, gu * ( 1.0 - trod ) );
}`;
