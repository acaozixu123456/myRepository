// 地面：近景分块网格（路、溪岸、草地、坡上岩石在着色器里按距离场混色）+ 远景粗网格（顶点色：草、林、岩、雪）
import * as THREE from 'three';
import { DOM, CENTER, farH, bankW } from './land.js';
import { snowLine as regionSnowLine } from './regions.js';
import { patch, U } from './atmo.js';
import { SEA_U } from './sea.js';
import { fbm, vnoise, sstep, clamp, rng } from './noise.js';

// ---------- 画布纹理 ----------
// 可平铺的盒式模糊（JS 里做，不用 canvas 的 filter：Safari 旧版不支持，软件渲染下也极慢）
export function blurWrap(src, S, r, iters = 2) {
  let a = Float32Array.from(src), b = new Float32Array(S * S);
  const n = 2 * r + 1;
  for (let it = 0; it < iters; it++) {
    for (let y = 0; y < S; y++) {           // 横向
      const row = y * S; let acc = 0;
      for (let k = -r; k <= r; k++) acc += a[row + ((k % S) + S) % S];
      for (let x = 0; x < S; x++) { b[row + x] = acc / n; acc += a[row + (x + r + 1) % S] - a[row + ((x - r) % S + S) % S]; }
    }
    for (let x = 0; x < S; x++) {           // 纵向
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += b[(((k % S) + S) % S) * S + x];
      for (let y = 0; y < S; y++) { a[y * S + x] = acc / n; acc += b[((y + r + 1) % S) * S + x] - b[(((y - r) % S + S) % S) * S + x]; }
    }
  }
  return a;
}
// 在一张灰度画布上画东西，取出一个通道（0~255 浮点）
function grayLayer(S, bg, draw) {
  const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, S, S); draw(g);
  const d = g.getImageData(0, 0, S, S).data, out = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) out[i] = d[i * 4];
  return out;
}
// 同一灰度的笔画/斑块合成一条路径一次画完，快很多
function batched(g, items, styleOf, drawOne, fill) {
  const groups = new Map();
  for (const it of items) { const k = styleOf(it); let a = groups.get(k); if (!a) groups.set(k, a = []); a.push(it); }
  for (const [k, a] of groups) {
    if (fill) g.fillStyle = k; else g.strokeStyle = k;
    g.beginPath(); for (const it of a) drawOne(it); fill ? g.fill() : g.stroke();
  }
}
function wrapPts(S, x, y, r) {
  const out = [[x, y]];
  const xs = x < r ? [S] : x > S - r ? [-S] : [], ys = y < r ? [S] : y > S - r ? [-S] : [];
  for (const dx of xs) out.push([x + dx, y]);
  for (const dy of ys) out.push([x, y + dy]);
  for (const dx of xs) for (const dy of ys) out.push([x + dx, y + dy]);
  return out;
}
function wrapDraw(S, x, y, r, fn) { for (const [px, py] of wrapPts(S, x, y, r)) fn(px, py); }
// 细节纹理：R=笔触明暗，G=大块斑，B=中块斑（都是 0~1 的数据，颜色在着色器里配）
export function makeDetailTex(S = 512) {
  const r = rng(5);
  const q = v => Math.round(v / 16) * 16;
  const strokes = Array.from({ length: 7000 }, () => ({ x: r() * S, y: r() * S, len: 5 + r() * 10, a: -Math.PI / 2 + (r() - 0.5) * 0.9, v: q(70 + r() * 130), w: r() < 0.5 ? 2 : 3.5 }));
  const R = blurWrap(grayLayer(S, '#808080', g => {
    g.lineCap = 'round';
    for (const w of [2, 3.5]) {
      g.lineWidth = w;
      batched(g, strokes.filter(s => s.w === w), s => `rgba(${s.v},${s.v},${s.v},0.6)`, s => {
        for (const [px, py] of wrapPts(S, s.x, s.y, 16)) { g.moveTo(px, py); g.lineTo(px + Math.cos(s.a) * s.len, py + Math.sin(s.a) * s.len); }
      }, false);
    }
  }), S, 1, 1);
  const blobs = (n, r0, r1, alpha) => Array.from({ length: n }, () => ({ x: r() * S, y: r() * S, rad: r0 + r() * (r1 - r0), v: q(30 + r() * 195), rot: r() * 3, e: 0.5 + r() * 0.4 }));
  const ell = g => b => { for (const [px, py] of wrapPts(S, b.x, b.y, b.rad)) { g.moveTo(px + b.rad, py); g.ellipse(px, py, b.rad, b.rad * b.e, b.rot, 0, 6.283); } };
  const G = blurWrap(grayLayer(S, '#808080', g => { const L = blobs(520, 10, 56); for (let pass = 0; pass < 3; pass++) batched(g, L.filter((_, i) => i % 3 === pass), b => `rgba(${b.v},${b.v},${b.v},0.35)`, ell(g), true); }), S, 6, 2);
  const B = blurWrap(grayLayer(S, '#808080', g => { const L = blobs(1600, 3, 16); for (let pass = 0; pass < 3; pass++) batched(g, L.filter((_, i) => i % 3 === pass), b => `rgba(${b.v},${b.v},${b.v},0.4)`, ell(g), true); }), S, 2, 1);
  const data = new Uint8Array(S * S * 4);
  for (let i = 0; i < S * S; i++) { data[i * 4] = R[i]; data[i * 4 + 1] = G[i]; data[i * 4 + 2] = B[i]; data[i * 4 + 3] = 255; }
  const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}

// 土路纹理（手绘感）：大块的笔触明暗，嵌在土里的扁石头（背光一侧有厚度和影子，顶上一抹亮），零星小石子
export function makeDirtTex(S = 512) {
  const r = rng(9);
  const blot = blurWrap(grayLayer(S, '#808080', g => {
    const L = Array.from({ length: 200 }, () => ({ x: r() * S, y: r() * S, rad: 18 + r() * 60, rot: r() * 3, v: r() < 0.5 ? 205 : 55 }));
    batched(g, L, b => `rgba(${b.v},${b.v},${b.v},0.28)`, b => { for (const [px, py] of wrapPts(S, b.x, b.y, b.rad)) { g.moveTo(px + b.rad, py); g.ellipse(px, py, b.rad, b.rad * 0.55, b.rot, 0, 6.283); } }, true);
  }), S, 5, 2);
  const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  const img = g.createImageData(S, S);
  const base = [186, 148, 100];
  for (let i = 0; i < S * S; i++) { const k = (blot[i] - 128) / 128; img.data[i * 4] = base[0] * (1 + 0.2 * k); img.data[i * 4 + 1] = base[1] * (1 + 0.25 * k); img.data[i * 4 + 2] = base[2] * (1 + 0.34 * k); img.data[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  // 顺着一个方向的宽笔触
  g.lineCap = 'round';
  for (let i = 0; i < 520; i++) {
    const x = r() * S, y = r() * S, a = 0.35 + (r() - 0.5) * 1.3, len = 18 + r() * 46, lt = r() < 0.5;
    g.strokeStyle = lt ? 'rgba(236,206,160,0.12)' : 'rgba(112,78,50,0.12)'; g.lineWidth = 3 + r() * 7;
    for (const [px, py] of wrapPts(S, x, y, 70)) { g.beginPath(); g.moveTo(px, py); g.quadraticCurveTo(px + Math.cos(a) * len * 0.5 + (r() - 0.5) * 8, py + Math.sin(a) * len * 0.5 + (r() - 0.5) * 8, px + Math.cos(a) * len, py + Math.sin(a) * len); g.stroke(); }
  }
  // 嵌在土里的扁石头
  const stones = []; let tries = 0;
  while (stones.length < 34 && tries++ < 4000) {
    const st = { x: r() * S, y: r() * S, w: 6 + r() * r() * 17, rot: r() * 3, tone: 150 + r() * 60, n: 6 + Math.floor(r() * 3), seed: r() };
    if (stones.some(o => { let dx = Math.abs(o.x - st.x), dy = Math.abs(o.y - st.y); dx = Math.min(dx, S - dx); dy = Math.min(dy, S - dy); return Math.hypot(dx, dy) < (o.w + st.w) * 1.25; })) continue;
    stones.push(st);
  }
  const shape = (st, px, py, sc, ox = 0, oy = 0) => {
    let q = st.seed * 1e4; const rr = () => { q = (q * 16807 + 11) % 2147483647; return q / 2147483647; };
    g.beginPath();
    const pts = []; for (let k = 0; k < st.n; k++) { const a = st.rot + k / st.n * 6.283, rad = st.w * sc * (0.72 + rr() * 0.4); pts.push([px + ox + Math.cos(a) * rad, py + oy + Math.sin(a) * rad * 0.74]); }
    for (let k = 0; k < st.n; k++) { const a = pts[k], b = pts[(k + 1) % st.n], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; if (!k) g.moveTo(m[0], m[1]); const c2 = pts[(k + 2) % st.n], m2 = [(b[0] + c2[0]) / 2, (b[1] + c2[1]) / 2]; g.quadraticCurveTo(b[0], b[1], m2[0], m2[1]); }
    g.closePath();
  };
  for (const st of stones) for (const [px, py] of wrapPts(S, st.x, st.y, 40)) {
    // 明暗不带方向（镜头会转，画死的高光阴影有一半时候是反的）：一圈贴地的暗边，顶面，中间鼓起来的地方亮一点；朝哪边亮交给凹凸光影
    const t = st.tone;
    g.fillStyle = 'rgba(70,46,30,0.38)'; shape(st, px, py, 1.14); g.fill();
    g.fillStyle = `rgb(${t - 30},${t - 44},${t - 60})`; shape(st, px, py, 1); g.fill();
    g.fillStyle = `rgb(${t},${t - 12},${t - 32})`; shape(st, px, py, 0.84); g.fill();
    g.fillStyle = 'rgba(255,244,220,0.3)'; shape(st, px, py, 0.5); g.fill();
  }
  // 一点点小石子和草屑
  const grit = Array.from({ length: 260 }, () => ({ x: r() * S, y: r() * S, s: 1.6 + r() * 2.4, dark: r() < 0.45 }));
  batched(g, grit, p => p.dark ? 'rgba(92,64,42,0.5)' : 'rgba(236,216,180,0.6)', p => { g.moveTo(p.x + p.s, p.y); g.ellipse(p.x, p.y, p.s, p.s * 0.7, 0, 0, 6.283); }, true);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
// ---------- 分区数据纹理：R 路距离，G 岸距离，B 花草地，A 林下 ----------
export function makeSplat(land) {
  const NX = land.NX, NZ = land.NZ, data = new Uint8Array(NX * NZ * 4);
  for (let gz = 0; gz < NZ; gz++) for (let gx = 0; gx < NX; gx++) {
    const k = gz * NX + gx, x = DOM.x0 + gx * DOM.cell, z = DOM.z0 + gz * DOM.cell;
    data[k * 4] = clamp(Math.min(Math.abs(land.roadD[k]), land.trD[k] + 0.55) / 10, 0, 1) * 255;
    const e = land.strD[k] - bankW(land.strS[k]);
    data[k * 4 + 1] = clamp((e + 4) / 24, 0, 1) * 255;
    data[k * 4 + 2] = sstep(0.5, 0.68, fbm(x * 0.02 + 40, z * 0.02, 3)) * 255;
    data[k * 4 + 3] = 0;
  }
  const t = new THREE.DataTexture(data, NX, NZ, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
}

// 区域纹理：R 红叶，G 积雪，B 凹凸（高度减去周围五六米的平均：洼地、沟里小于 0.5，坡脊上大于 0.5），A 沙滩
export function makeBiome(land) {
  const NX = land.NX, NZ = land.NZ, data = new Uint8Array(NX * NZ * 4), H = land.H;
  const a = Float32Array.from(H), b = new Float32Array(NX * NZ), R = 3;
  for (let it = 0; it < 2; it++) {
    for (let j = 0; j < NZ; j++) { const row = j * NX; for (let i = 0; i < NX; i++) { let s = 0, n = 0; for (let d = -R; d <= R; d++) { const ii = i + d; if (ii >= 0 && ii < NX) { s += a[row + ii]; n++; } } b[row + i] = s / n; } }
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { let s = 0, n = 0; for (let d = -R; d <= R; d++) { const jj = j + d; if (jj >= 0 && jj < NZ) { s += b[jj * NX + i]; n++; } } a[j * NX + i] = s / n; }
  }
  for (let k = 0; k < NX * NZ; k++) {
    data[k * 4] = land.AU[k]; data[k * 4 + 1] = land.SN[k];
    data[k * 4 + 2] = 128 + clamp((H[k] - a[k]) / 1.1, -1, 1) * 127; data[k * 4 + 3] = land.SA[k];
  }
  const t = new THREE.DataTexture(data, NX, NZ, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
}

export const PALETTE = {
  grass0: '#86a03f', grass1: '#a4b04a', grass2: '#cdbb63', grass3: '#56803a', forest: '#5a5a32',
  rock: '#8f8574', bank: '#6e5c45', pebble: '#a49a86', bed: '#5d6a52',
  // 秋天的草地：金黄、赭石、带绿的枯草；落叶：橙红、深红
  aut0: '#b59a52', aut1: '#a67d48', aut2: '#8e9244', leaf0: '#b8541e', leaf1: '#8a3a1c',
  snow: '#e2e8f0', straw: '#c9bd8e',
  sand: '#e3cf9f',
};

export const TERRAIN_GLSL = /* glsl */`
uniform sampler2D uSplat; uniform sampler2D uDetail; uniform sampler2D uDirt; uniform vec4 uDom;
uniform vec3 uGrass0; uniform vec3 uGrass1; uniform vec3 uGrass2; uniform vec3 uGrass3; uniform vec3 uForestC;
uniform vec3 uRock; uniform vec3 uBank; uniform vec3 uPebble; uniform vec3 uBed; uniform float uFine;
uniform vec3 uSand; uniform float uSeaY; uniform float uTide; uniform float uWet; uniform float uSnowCover;
uniform sampler2D uBiome; uniform vec3 uAut0; uniform vec3 uAut1; uniform vec3 uAut2; uniform vec3 uLeaf0; uniform vec3 uLeaf1; uniform vec3 uSnow; uniform vec3 uStraw;
// 草地的颜色（地面和草丛共用，草丛看起来就像是从地里长出来的）；bi：区域（r 红叶，g 积雪）
vec3 jGrass( vec2 xz, vec4 sp, vec3 dA, vec4 bi ) {
  vec3 dB = texture2D( uDetail, xz * 0.031 + vec2( 0.37, 0.71 ) ).rgb;
  vec3 dC = texture2D( uDetail, xz * 0.0072 + vec2( 0.11, 0.53 ) ).rgb;
  vec3 g = mix( uGrass0, uGrass1, smoothstep( 0.3, 0.7, dC.g ) );
  g = mix( g, uGrass2, smoothstep( 0.52, 0.8, dB.g ) * 0.6 * ( 0.4 + 0.6 * sp.b ) );
  g = mix( g, uGrass3, smoothstep( 0.5, 0.85, dC.b ) * 0.55 );
  // 草皮：不要细碎的明暗，按大块笔触深浅，再带几片晒黄的
  g *= 0.93 + 0.14 * dA.r; g *= 0.86 + 0.3 * smoothstep( 0.35, 0.65, dB.b ); g = mix( g, g * vec3( 1.12, 1.1, 0.8 ), smoothstep( 0.55, 0.75, dC.r ) * 0.5 );
  g = mix( g, uForestC * ( 0.85 + 0.3 * dA.g ), sp.a * 0.8 );
  if ( bi.r > 0.01 ) {
    // 秋天：草黄了，林下铺满落叶
    vec3 a = mix( uAut0, uAut1, smoothstep( 0.35, 0.7, dC.g ) );
    a = mix( a, uAut2, smoothstep( 0.5, 0.85, dC.b ) * 0.6 );
    a *= 0.8 + 0.4 * dA.r;
    vec3 lit = mix( uLeaf0, uLeaf1, smoothstep( 0.35, 0.75, dA.g ) ) * ( 0.8 + 0.4 * dA.b );
    a = mix( a, lit, clamp( sp.a * 1.2 + smoothstep( 0.6, 0.8, dB.g ) * 0.35, 0.0, 1.0 ) );
    g = mix( g, a, smoothstep( 0.0, 0.7, bi.r ) * 0.88 );
  }
  // 雪线附近的草干枯发白
  return mix( g, uStraw * ( 0.85 + 0.3 * dA.r ), smoothstep( 0.05, 0.6, bi.g ) * 0.7 );
}
vec4 jSplat( vec2 xz ) { return texture2D( uSplat, ( xz - uDom.xy ) / uDom.zw ); }
// 凹凸光影：按屏幕导数把一张“高度”扰到法线上（P、N 都在视图空间；k 是高度 1 对应多少米）
float jBH = 0.0; float jBK = 0.0; float jSnowK = 0.0;
vec3 jBumpN( vec3 N, vec3 P, float h, float k ) {
  vec3 dpx = dFdx( P ), dpy = dFdy( P );
  vec3 r1 = cross( dpy, N ), r2 = cross( N, dpx );
  float det = dot( dpx, r1 );
  vec3 grad = sign( det ) * ( dFdx( h ) * k * r1 + dFdy( h ) * k * r2 );
  return normalize( abs( det ) * N - grad );
}
vec4 jBiome( vec2 xz ) { return texture2D( uBiome, ( xz - uDom.xy ) / uDom.zw ); }
`;
const TERRAIN_VS = /* glsl */`varying vec3 vWN;`;
const TERRAIN_COLOR = /* glsl */`
{
  vec4 sp = jSplat( vWP.xz );
  float dRoad = sp.r * 10.0, shore = sp.g * 24.0 - 4.0;
  vec3 dA = texture2D( uDetail, vWP.xz * 0.13 ).rgb;
  vec3 dB = texture2D( uDetail, vWP.xz * 0.031 + vec2( 0.37, 0.71 ) ).rgb;
  vec4 bi = jBiome( vWP.xz );
  vec3 g = jGrass( vWP.xz, sp, dA, bi );
  // 近处一丝丝的细草纹（远了淡掉，免得闪）；洼地里草深一点绿一点，坡脊上晒得发黄发亮
  float vd = length( vViewPosition ), nearK = 1.0 - smoothstep( 12.0, 42.0, vd );
  // 只有近处才取细草纹（导数在分支外算好，分支里用 textureGrad）
  vec3 dF = vec3( 0.5 );
  vec2 uA = vWP.xy, uB = vWP.zy, aX = vec2( 0.0 ), aY = aX, bX = aX, bY = aX;
  if ( uFine > 0.5 ) {
    vec2 uvF = vec2( vWP.x * 0.41 + vWP.z * 0.09, vWP.z * 0.41 - vWP.x * 0.09 ) + vec2( 0.53, 0.19 );
    vec2 fX = dFdx( uvF ), fY = dFdy( uvF );
    if ( nearK > 0.0 ) dF = textureGrad( uDetail, uvF, fX, fY ).rgb;
    aX = dFdx( uA ); aY = dFdy( uA ); bX = dFdx( uB ); bY = dFdy( uB );
  }
  float cav = ( bi.b - 0.5 ) * 2.0;
  g *= 1.0 + 0.15 * cav;
  g = mix( g, g * vec3( 1.1, 1.03, 0.78 ), smoothstep( 0.15, 0.8, cav ) * 0.45 * ( 1.0 - bi.g ) );
  g *= mix( 1.0, 0.8 + 0.4 * dF.r, nearK * 0.75 );
  jBH = dA.r * 0.32 + dF.r * 0.22 * nearK + dB.b * 0.5 + dA.g * 0.22;
  jBK = 0.034;
  // 坡上露出岩石
  float slope = 1.0 - normalize( vWN ).y;
  float rk = smoothstep( 0.3, 0.46, slope + ( dB.r - 0.5 ) * 0.22 );
  if ( rk > 0.004 && uFine < 0.5 ) {
    g = mix( g, mix( uRock, vec3( 0.36, 0.38, 0.42 ), bi.g * 0.75 ) * ( 0.75 + 0.5 * dA.g ), rk );
    jBH = mix( jBH, dB.r * 0.9 + dA.g * 0.5 + dA.b * 0.3, rk ); jBK = mix( jBK, 0.16, rk );
  } else if ( rk > 0.004 ) {
    // 岩壁：贴着壁面取纹理（从上往下投会拉成一道道竖条，像抹的水泥），一层层的岩层、裂缝
    // 朝南北的壁按 xy 取，朝东西的按 zy 取，中间混合（跟着法线转投影方向，世界坐标一大就满屏乱跳）
    vec3 wn = normalize( vWN );
    float bx = smoothstep( 0.35, 0.65, abs( wn.x ) / ( abs( wn.x ) + abs( wn.z ) + 1e-4 ) );
    const vec2 s1 = vec2( 0.07, 0.2 ), o2 = vec2( 0.3, 0.8 );
    vec3 dW, dW2;
    // 大多数地方只朝一个方向，取两次就够；转角处才两边都取再混
    if ( bx < 0.03 ) {
      dW = textureGrad( uDetail, uA * s1, aX * s1, aY * s1 ).rgb; dW2 = textureGrad( uDetail, uA * 0.33 + o2, aX * 0.33, aY * 0.33 ).rgb;
    } else if ( bx > 0.97 ) {
      dW = textureGrad( uDetail, uB * s1, bX * s1, bY * s1 ).rgb; dW2 = textureGrad( uDetail, uB * 0.33 + o2, bX * 0.33, bY * 0.33 ).rgb;
    } else {
      dW = mix( textureGrad( uDetail, uA * s1, aX * s1, aY * s1 ).rgb, textureGrad( uDetail, uB * s1, bX * s1, bY * s1 ).rgb, bx );
      dW2 = mix( textureGrad( uDetail, uA * 0.33 + o2, aX * 0.33, aY * 0.33 ).rgb, textureGrad( uDetail, uB * 0.33 + o2, bX * 0.33, bY * 0.33 ).rgb, bx );
    }
    float strat = sin( vWP.y * 2.2 + dW.r * 5.0 ) * 0.5 + 0.5;
    // 裂缝线越远越宽一点（不闪），远了淡掉
    float crack = ( 1.0 - smoothstep( 0.0, 0.05 + vd * 0.0016, abs( dW2.r - 0.5 ) ) ) * ( 1.0 - smoothstep( 14.0, 40.0, vd ) );
    // 雪山上的岩石冷一些、暗一些
    vec3 rc = mix( uRock, vec3( 0.36, 0.38, 0.42 ), bi.g * 0.75 );
    rc *= ( 0.6 + 0.45 * dW.g + 0.16 * strat ) * ( 0.86 + 0.28 * dW2.b ) * ( 1.0 - 0.42 * crack );
    g = mix( g, rc, rk );
    // 起伏只用低频的（高频的屏幕导数是 2×2 一块，会出棋盘格）
    jBH = mix( jBH, dW.g * 1.1 + dW2.b * 0.25 + strat * 0.3, rk ); jBK = mix( jBK, 0.15, rk );
  }
  // 溪岸：卵石滩、湿土，水下是河床
  float bankN = ( dA.b - 0.5 ) * 0.8;
  g = mix( g, uBank * ( 0.85 + 0.3 * dA.r ), 1.0 - smoothstep( 0.4 + bankN, 1.8 + bankN, shore ) );
  g = mix( g, uPebble * ( 0.7 + 0.6 * dA.b ), ( 1.0 - smoothstep( -0.2, 0.9 + bankN, shore ) ) * smoothstep( -1.0, 0.0, shore ) * 0.8 );
  g = mix( g, uBed * ( 0.8 + 0.4 * dA.g ), 1.0 - smoothstep( -1.2, -0.2, shore ) );
  // 沙滩：暖色的沙，靠水的一溜是湿的（深一点），浪退下去的地方刚湿；风吹出来的沙纹
  if ( bi.a > 0.01 ) {
    float sk = smoothstep( 0.05, 0.6, bi.a ) * ( 1.0 - rk * 0.85 );
    vec3 sc = uSand * ( 0.86 + 0.14 * dA.r + 0.1 * ( dB.g - 0.5 ) ) * ( 0.94 + 0.08 * dA.b );
    float rip = sin( dot( vWP.xz, vec2( -0.94, 0.342 ) ) * 3.6 + dA.b * 5.0 + dB.r * 3.0 ) * 0.5 + 0.5;
    float wet = 1.0 - smoothstep( uSeaY + 0.2, uSeaY + 0.6 + 0.15 * dA.g, vWP.y );
    float fresh = 1.0 - smoothstep( uSeaY + uTide, uSeaY + uTide + 0.35, vWP.y );
    // 第二层细一点、方向偏一点的沙纹，两层交错才像风吹的
    float rip2 = sin( dot( vWP.xz, vec2( -0.8, 0.6 ) ) * 7.3 + dB.g * 7.0 + rip * 1.5 ) * 0.5 + 0.5;
    float fade = 1.0 - smoothstep( 12.0, 45.0, length( vViewPosition ) );
    sc *= 1.0 - ( 0.12 * rip + 0.07 * rip2 * fade ) * ( 1.0 - wet );
    // 涨潮线：一道弯弯曲曲的深色海草、碎贝壳
    float tl = uSeaY + 0.95 + 0.25 * ( dA.g - 0.5 ) + 0.12 * sin( dot( vWP.xz, vec2( 0.342, 0.94 ) ) * 0.35 );
    float wrack = ( 1.0 - smoothstep( 0.0, 0.07, abs( vWP.y - tl ) ) ) * smoothstep( 0.35, 0.6, dB.b );
    sc = mix( sc, vec3( 0.36, 0.33, 0.24 ), wrack * 0.55 * ( 1.0 - wet ) );
    sc = mix( sc, sc * vec3( 0.62, 0.6, 0.58 ), max( wet * 0.85, fresh ) );
    // 湿沙上映一点天光
    sc += vec3( 0.05, 0.06, 0.07 ) * wet * ( 1.0 - fresh * 0.5 );
    g = mix( g, sc, sk );
    jBH = mix( jBH, rip * 0.45 + rip2 * 0.18 * fade + dA.r * 0.15, sk ); jBK = mix( jBK, 0.05, sk );
  }
  // 土路：边缘被草啃得参差，中间被踩得浅一点
  float en = ( dA.b - 0.5 ) * 0.6 + ( dB.g - 0.5 ) * 0.7;
  float road = 1.0 - smoothstep( 1.0 + en, 1.45 + en, dRoad );
  vec3 dirt = texture2D( uDirt, vWP.xz * 0.21 ).rgb * mix( 0.9, 1.08, dB.r );
  dirt *= 1.0 + 0.1 * ( 1.0 - smoothstep( 0.0, 0.9, dRoad ) );
  float edge = smoothstep( 0.9, 1.5, dRoad ) * ( 1.0 - smoothstep( 1.5, 2.6, dRoad ) );
  g *= 1.0 - 0.16 * edge;
  g = mix( g, dirt, road );
  // 路面：小石子凸起来
  jBH = mix( jBH, dot( dirt, vec3( 0.5, 0.4, 0.1 ) ) * 1.8 + dB.r * 0.3, road ); jBK = mix( jBK, 0.016, road );
  // 积雪：陡的岩壁上挂不住，树下少，小路上被踩得发灰
  if ( bi.g > 0.01 ) {
    float ny = normalize( vWN ).y;
    float sn0 = smoothstep( 0.3, 0.62, bi.g + ( dB.g - 0.5 ) * 0.45 + ( dA.b - 0.5 ) * 0.2 );
    // 雪厚的地方陡坡上也挂得住；山脊上的雪被风吹走，陡壁上一层层岩台露出来
    float th = mix( 0.76, 0.6, smoothstep( 0.5, 1.0, bi.g ) );
    float strata = sin( vWP.y * 0.55 + dB.r * 6.0 + dA.g * 1.5 ) * 0.5 + 0.5;
    float ledge = smoothstep( 0.52, 0.74, ( 1.0 - dB.g ) * 0.7 + dA.b * 0.3 + ( strata - 0.5 ) * 0.3 ) * ( 1.0 - smoothstep( 0.8, 0.95, ny ) );
    th += smoothstep( 0.2, 0.8, cav ) * 0.12 * smoothstep( 0.35, 0.65, dB.b ) + ledge * 0.22;
    float sn = sn0 * smoothstep( th - 0.1, th + 0.08, ny + ( dB.r - 0.5 ) * 0.22 + ( dA.g - 0.5 ) * 0.1 );
    // 雪里露出来的岩石：冷灰，比草坡上的石头暗
    float bare = ( sn0 - sn ) * ( 1.0 - road ) * ( 1.0 - rk * 0.6 );
    g = mix( g, vec3( 0.31, 0.33, 0.37 ) * ( 0.72 + 0.5 * dA.g ) * ( 0.85 + 0.3 * dB.r ), bare );
    jBH = mix( jBH, dB.r * 0.9 + dA.g * 0.5 + dA.b * 0.3, bare ); jBK = mix( jBK, 0.16, bare );
    sn *= 1.0 - 0.45 * sp.a;
    // 雪面：风吹出来的一道道雪垄，背阴处带点蓝
    vec3 dS = texture2D( uDetail, vWP.xz * 0.05 + vec2( 0.2, 0.6 ) ).rgb;
    vec3 dS2 = uFine > 0.5 ? texture2D( uDetail, vWP.xz * 0.011 + vec2( 0.7, 0.15 ) ).rgb : vec3( 0.5 );
    vec3 sc = uSnow * ( 0.84 + 0.08 * dA.r + 0.08 * dS.g ) * ( 0.95 + 0.08 * dS2.g );
    sc = mix( sc, sc * vec3( 0.84, 0.91, 1.0 ), smoothstep( 0.42, 0.72, dS.b ) * 0.55 );
    g = mix( g, sc * mix( 1.0, 0.86, road ), sn );
    // 雪面：风吹的雪垄和大的雪堆（法线起伏），近处有闪闪的雪粒
    jBH = mix( jBH, ( dS.g * 0.7 + dA.r * 0.15 ) * ( 1.0 - smoothstep( 30.0, 80.0, vd ) ) + dS2.g * 2.2, sn ); jBK = mix( jBK, 0.14, sn );
    jSnowK = sn;
  }
  // 天气：下雨地面湿了颜色发深，路上平的地方积起小水洼；下雪平地上慢慢盖一层薄雪（陡坡、树下少）
  if ( uWet > 0.01 ) {
    float ny = normalize( vWN ).y;
    g *= 1.0 - 0.26 * uWet * ( 1.0 - jSnowK );
    float pud = road * smoothstep( 0.56, 0.7, dB.b + ( dA.r - 0.5 ) * 0.25 ) * smoothstep( 0.93, 0.99, ny ) * uWet;
    g = mix( g, g * 0.5 + vec3( 0.025, 0.03, 0.035 ), pud );
    jBK *= 1.0 - 0.85 * pud;
  }
  if ( uSnowCover > 0.01 && vWP.y > uSeaY + 0.4 ) {
    float ny = normalize( vWN ).y;
    float th = 0.62 - uSnowCover * 0.65;
    float dust = smoothstep( th, th + 0.18, dB.g * 0.6 + dA.b * 0.4 ) * smoothstep( 0.74, 0.9, ny + ( dA.r - 0.5 ) * 0.1 ) * ( 1.0 - 0.6 * sp.a ) * min( 1.0, uSnowCover * 2.0 );
    dust *= 1.0 - 0.45 * road;
    g = mix( g, uSnow * ( 0.86 + 0.1 * dA.r ) * mix( 1.0, 0.85, road ), dust );
    jBH = mix( jBH, dA.r * 0.2 + dB.g * 0.4, dust ); jBK = mix( jBK, 0.05, dust );
    jSnowK = max( jSnowK, dust );
  }
  diffuseColor.rgb *= g;
  // 远处不要细碎的起伏（会闪）；雪面的大雪堆远处也看得见
  jBK *= 1.0 - smoothstep( 30.0, 80.0, vd ) * 0.85 * ( 1.0 - jSnowK );
}
`;
// 雪粒的闪光：几厘米一格，个别格子在朝着太阳的角度上亮一下
const SNOW_GLINT = /* glsl */`
if ( uFine > 0.5 && jSnowK > 0.05 && length( vViewPosition ) < 22.0 ) {
  vec2 gc = floor( vWP.xz * 26.0 );
  float hs = fract( sin( dot( gc, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
  vec3 V = normalize( cameraPosition - vWP ), Hh = normalize( V + uSunDir );
  vec3 wn = normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
  float gl = step( 0.993, hs ) * pow( max( dot( wn, Hh ), 0.0 ), 4.0 ) * ( 1.0 - smoothstep( 6.0, 22.0, length( vViewPosition ) ) );
  reflectedLight.directDiffuse += uSunColor * gl * jSnowK * 3.0;
}`;

export function terrainUniforms(splat, detail, dirt, biome) {
  const uni = {
    uSplat: { value: splat }, uDetail: { value: detail }, uDirt: { value: dirt }, uBiome: { value: biome },
    uDom: { value: new THREE.Vector4(DOM.x0, DOM.z0, DOM.w, DOM.d) },
  };
  for (const [k, v] of Object.entries({ uGrass0: 'grass0', uGrass1: 'grass1', uGrass2: 'grass2', uGrass3: 'grass3', uForestC: 'forest', uRock: 'rock', uBank: 'bank', uPebble: 'pebble', uBed: 'bed',
    uAut0: 'aut0', uAut1: 'aut1', uAut2: 'aut2', uLeaf0: 'leaf0', uLeaf1: 'leaf1', uSnow: 'snow', uStraw: 'straw' }))
    uni[k] = { value: new THREE.Color(PALETTE[v]) };
  uni.uSand = { value: new THREE.Color(PALETTE.sand) };
  uni.uSeaY = SEA_U.uSeaY; uni.uTide = SEA_U.uTide; uni.uWet = U.uWet; uni.uSnowCover = U.uSnowCover;
  return uni;
}

// 近景地面的材质（所有分块共用）
export function terrainMaterial(uni) {
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff });
  m.userData.uni = uni;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + TERRAIN_VS)
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvWN = objectNormal;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + TERRAIN_VS + TERRAIN_GLSL)
      .replace('#include <map_fragment>', TERRAIN_COLOR)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nif ( uFine > 0.5 ) normal = jBumpN( normal, -vViewPosition, jBH, jBK );')
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n' + SNOW_GLINT);
  };
  patch(m, { gobo: true, fog: true, shadowFade: true });
  m.customProgramCacheKey = () => 'terrain';
  return m;
}

// 草丛：颜色直接取脚下地面的草色，根部暗、尖上亮
export function tuftMaterial(uni, fadeU) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, uni);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + TERRAIN_GLSL)
      // 草叶两面都按朝上的法线打光（不然背面朝着镜头的叶子是黑的）
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize( vNormal );')
      .replace('#include <color_fragment>', `
        {
          vec4 sp = jSplat( vWP.xz );
          vec3 dA = texture2D( uDetail, vWP.xz * 0.13 ).rgb;
          vec3 g = jGrass( vWP.xz, sp, dA, jBiome( vWP.xz ) );
          // 顶点色：r = 高度比例（0 根 1 尖），g = 亮度扰动
          float t = vColor.r;
          // 根上和地皮一个颜色，往叶尖亮起来、偏一点暖黄
          diffuseColor.rgb = g * mix( 0.9, 1.3, t * t ) * ( 0.95 + 0.1 * vColor.g ); diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * vec3( 1.18, 1.12, 0.7 ), smoothstep( 0.55, 1.0, t ) * 0.6 );
          diffuseColor.rgb *= 1.0 - 0.3 * step( 0.6, 1.0 - smoothstep( 1.0, 1.4, sp.r * 10.0 ) );
          // 天气：雨里草色深一点；下雪时草根埋在雪里，叶尖上也挂一点
          diffuseColor.rgb *= 1.0 - 0.14 * uWet;
          diffuseColor.rgb = mix( diffuseColor.rgb, uSnow * 0.92, uSnowCover * ( 0.85 * ( 1.0 - smoothstep( 0.15, 0.6, t ) ) + 0.25 ) );
        }`);
  };
  patch(m, { wind: 'grass', tread: 1, gobo: true, sss: 0.55, fadeOut: true, uniforms: { uFadeR: fadeU } });
  m.customProgramCacheKey = () => 'tuft';
  return m;
}
// 一丛草的几何：几片弯弯的细叶，三段
export function makeTuftGeo(seed, blades = 8, h0 = 0.42) {
  let a = seed; const R = () => ((a = (a * 16807) % 2147483647) / 2147483647);
  const pos = [], col = [], nor = [], idx = [];
  for (let b = 0; b < blades; b++) {
    const ang = R() * Math.PI * 2, rr = R() * 0.3, h = h0 * (0.55 + R() * 0.6) * 0.82, w = 0.055 + R() * 0.035;
    const lean = 0.25 + R() * 0.45, ox = Math.cos(ang) * rr, oz = Math.sin(ang) * rr, face = ang + Math.PI / 2 + (R() - 0.5);
    const fx = Math.cos(face), fz = Math.sin(face), dx = Math.cos(ang), dz = Math.sin(ang);
    const bright = R();
    const base = pos.length / 3;
    const segs = 3;
    for (let k = 0; k <= segs; k++) {
      const t = k / segs, y = h * t, bend = lean * h * t * t, ww = w * (1 - t * t * 0.95);
      const cx = ox + dx * bend, cz = oz + dz * bend;
      pos.push(cx - fx * ww, y, cz - fz * ww, cx + fx * ww, y, cz + fz * ww);
      col.push(t, bright, 0, t, bright, 0);
      const nx = dx * 0.35, nz = dz * 0.35; nor.push(nx, 1, nz, nx, 1, nz);
      if (k < segs) { const i = base + k * 2; idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor.map((v, i) => v), 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.normalizeNormals?.();
  { const N = g.attributes.normal; for (let i = 0; i < N.count; i++) { const x = N.getX(i), y = N.getY(i), z = N.getZ(i), l = Math.hypot(x, y, z); N.setXYZ(i, x / l, y / l, z / l); } }
  g.computeBoundingSphere();
  return g;
}

// ---------- 近景分块网格 ----------
export function buildNear(land, mat) {
  const group = new THREE.Group(); group.name = 'terrainNear';
  const NX = land.NX, H = land.H, C = 48;
  // 全局法线（中心差分，分块之间无缝）
  const N = new Float32Array(NX * land.NZ * 3);
  for (let gz = 0; gz < land.NZ; gz++) for (let gx = 0; gx < NX; gx++) {
    const k = gz * NX + gx;
    const hl = H[gz * NX + Math.max(0, gx - 1)], hr = H[gz * NX + Math.min(NX - 1, gx + 1)];
    const hd = H[Math.max(0, gz - 1) * NX + gx], hu = H[Math.min(land.NZ - 1, gz + 1) * NX + gx];
    const nx = (hl - hr), nz = (hd - hu), ny = 2 * DOM.cell, l = Math.hypot(nx, ny, nz);
    N[k * 3] = nx / l; N[k * 3 + 1] = ny / l; N[k * 3 + 2] = nz / l;
  }
  // 每块三套三角形：近处 1 格、远一点 2 格、更远 4 格一个三角形；每块四周挂一圈往下的裙边，
  // 粗细不同的两块拼在一起时，接缝的小缝被裙边挡住。
  // 所有块的顶点放在同一个网格里，按每块现在用哪一套拼出一份索引，整片近景地面只画一次（手机上少几十次绘制）
  const LOD = [1, 2, 4], chunks = [];
  let totalV = 0;
  for (let cz = 0; cz < DOM.nz; cz += C) for (let cx = 0; cx < DOM.nx; cx += C) {
    const w = Math.min(C, DOM.nx - cx), d = Math.min(C, DOM.nz - cz);
    // 一圈边上的格点（顺着走一圈）
    const ring = [];
    for (let i = 0; i <= w; i++) ring.push([i, 0]);
    for (let j = 1; j <= d; j++) ring.push([w, j]);
    for (let i = w - 1; i >= 0; i--) ring.push([i, d]);
    for (let j = d - 1; j >= 0; j--) ring.push([0, j]);
    const nv = (w + 1) * (d + 1);
    chunks.push({ cx, cz, w, d, ring, nv, base: totalV, level: 2,
      x: DOM.x0 + (cx + w / 2) * DOM.cell, z: DOM.z0 + (cz + d / 2) * DOM.cell });
    totalV += nv + ring.length;
  }
  const pos = new Float32Array(totalV * 3), nor = new Float32Array(totalV * 3);
  for (const ch of chunks) {
    const { cx, cz, w, d, ring, nv } = ch;
    let v = ch.base * 3;
    for (let j = 0; j <= d; j++) for (let i = 0; i <= w; i++) {
      const gx = cx + i, gz = cz + j, k = gz * NX + gx;
      pos[v] = DOM.x0 + gx * DOM.cell; pos[v + 1] = H[k]; pos[v + 2] = DOM.z0 + gz * DOM.cell;
      nor[v] = N[k * 3]; nor[v + 1] = N[k * 3 + 1]; nor[v + 2] = N[k * 3 + 2]; v += 3;
    }
    for (const [i, j] of ring) {
      const k = (cz + j) * NX + cx + i;
      pos[v] = DOM.x0 + (cx + i) * DOM.cell; pos[v + 1] = H[k] - 1.6; pos[v + 2] = DOM.z0 + (cz + j) * DOM.cell;
      nor[v] = N[k * 3]; nor[v + 1] = N[k * 3 + 1]; nor[v + 2] = N[k * 3 + 2]; v += 3;
    }
    ch.lod = LOD.map(st => {
      const idx = [];
      for (let j = 0; j < d; j += st) for (let i = 0; i < w; i += st) {
        const a = j * (w + 1) + i, b = a + st, c = a + st * (w + 1), e = c + st;
        idx.push(a, c, b, b, c, e);
      }
      // 裙边：只连这一档用到的边上格点（两面都画）
      const on = ring.map(([i, j]) => (i % st === 0 && j % st === 0));
      let prev = -1;
      for (let r = 0; r <= ring.length; r++) {
        const rr = r % ring.length; if (!on[rr]) continue;
        if (prev >= 0) {
          const [ia, ja] = ring[prev], [ib, jb] = ring[rr];
          const ta = ja * (w + 1) + ia, tb = jb * (w + 1) + ib, ba = nv + prev, bb = nv + rr;
          idx.push(ta, ba, tb, tb, ba, bb, ta, tb, ba, tb, bb, ba);
        }
        prev = rr;
      }
      return Uint16Array.from(idx);
    });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  let cap = 0, arr = null, iAttr = null;
  const rebuild = () => {
    let n = 0; for (const ch of chunks) n += ch.lod[ch.level].length;
    if (n > cap) {
      cap = Math.ceil(n * 1.3); arr = new Uint32Array(cap);
      iAttr = new THREE.BufferAttribute(arr, 1); iAttr.setUsage(THREE.DynamicDrawUsage); geo.setIndex(iAttr);
    }
    let o = 0;
    for (const ch of chunks) { const src = ch.lod[ch.level], b = ch.base; for (let i = 0; i < src.length; i++) arr[o++] = b + src[i]; }
    iAttr.clearUpdateRanges(); iAttr.addUpdateRange(0, o); iAttr.needsUpdate = true;
    geo.setDrawRange(0, o);
  };
  rebuild();
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, mat); mesh.receiveShadow = true; mesh.matrixAutoUpdate = false;
  group.add(mesh);
  group.userData.mesh = mesh;
  // 按离镜头的远近换粗细（留一点余量，免得在边界上来回跳）；有一块变了就重拼索引，
  // 飞得快时一秒里会变很多次，最多 0.2 秒拼一次
  let pending = false, lastT = -1e9;
  // force：瞬移、截图时马上拼好（不然那一帧脚下还是粗网格，溪边会翘起一块）
  group.userData.update = (camera, force) => {
    const px = camera.position.x, pz = camera.position.z;
    for (const ch of chunks) {
      const dd = Math.max(0, Math.hypot(ch.x - px, ch.z - pz) - 50), cur = ch.level;
      let lv = dd < 120 ? 0 : dd < 280 ? 1 : 2;
      if (lv > cur && dd < [120, 280][cur] + 12) lv = cur;
      if (lv !== cur) { ch.level = lv; pending = true; }
    }
    const now = performance.now();
    if (pending && (force || now - lastT > 200)) { rebuild(); pending = false; lastT = now; }
  };
  // 四周裙边，遮住和远景网格之间的细缝
  {
    const pos = [], nor = [], idx = [];
    const edge = [];
    for (let i = 0; i <= DOM.nx; i++) edge.push([i, 0]);
    for (let j = 1; j <= DOM.nz; j++) edge.push([DOM.nx, j]);
    for (let i = DOM.nx - 1; i >= 0; i--) edge.push([i, DOM.nz]);
    for (let j = DOM.nz - 1; j >= 0; j--) edge.push([0, j]);
    for (const [gx, gz] of edge) {
      const k = gz * NX + gx, x = DOM.x0 + gx * DOM.cell, z = DOM.z0 + gz * DOM.cell;
      pos.push(x, H[k], z, x, H[k] - 5, z); nor.push(0, 1, 0, 0, 1, 0);
    }
    for (let i = 0; i < edge.length - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3, a, a + 2, a + 1, a + 2, a + 3, a + 1); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setIndex(idx);
    const skirt = new THREE.Mesh(geo, mat); skirt.matrixAutoUpdate = false;
    group.add(skirt);
  }
  return group;
}

// ---------- 远景网格 ----------
// 远山的材质：顶点色是草、林、岩石的底色；aFar = (树林, 岩石, 积雪)。像素里加上一团团树冠、岩层、
// 边缘清楚的积雪（沟里存雪、山脊露石头），再用大尺度的噪声扰一下法线，山坡上有起伏的光影
const FAR_FS = /* glsl */`
if ( uFine < 0.5 ) {
  // 画质「低」：只按顶点上的积雪量铺雪，不取细节纹理
  diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.9, 0.93, 0.97 ), smoothstep( 0.4, 0.6, vFar.z ) );
} else {
  vec2 xz = vWP.xz;
  vec3 n1 = texture2D( uDetail, xz * 0.0028 + vec2( 0.31, 0.12 ) ).rgb;
  vec3 n2 = texture2D( uDetail, xz * 0.0011 + vec2( 0.62, 0.81 ) ).rgb;
  vec3 n3 = texture2D( uDetail, xz * 0.011 + vec2( 0.23, 0.44 ) ).rgb;
  vec3 c = diffuseColor.rgb * ( 0.9 + 0.2 * n2.g );
  float fo = smoothstep( 0.2, 0.6, vFar.x + ( n1.g - 0.5 ) * 0.5 );
  c = mix( c, c * ( 0.62 + 0.6 * n1.b ), fo * 0.85 );
  float strata = 0.5 + 0.5 * sin( vWP.y * 0.3 + n3.g * 5.0 + n1.r * 3.0 );
  c = mix( c, c * ( 0.74 + 0.4 * strata ), vFar.y * 0.85 );
  // 岩壁上一道道竖着的水痕、石棱；贴着海面的一截被浪打湿，颜色深
  float streak = texture2D( uDetail, vec2( ( vWP.x - vWP.z ) * 0.035, vWP.y * 0.005 ) + vec2( 0.41, 0.73 ) ).g;
  c = mix( c, c * ( 0.78 + 0.45 * streak ), vFar.y * 0.7 );
  c *= mix( 0.72, 1.0, smoothstep( -0.8, 2.5, vWP.y ) );
  float sn = smoothstep( 0.42, 0.58, vFar.z + ( n3.r - 0.5 ) * 0.5 + ( n1.g - 0.5 ) * 0.45 );
  c = mix( c, vec3( 0.9, 0.93, 0.97 ) * ( 0.93 + 0.1 * n3.g ), sn );
  diffuseColor.rgb = c;
  jBH = n1.g * 0.7 + n3.g * 0.35 + n2.b * 0.6;
  jBK = 10.0 * ( 1.0 - 0.5 * sn );
}
// 下雪天远山也白了一层（岩壁上少）
diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.88, 0.9, 0.94 ), uSnowCover * 0.6 * ( 1.0 - vFar.y * 0.7 ) * step( 0.0, vWP.y + 0.8 ) );`;
function farMaterial(tuni) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  m.onBeforeCompile = sh => {
    sh.uniforms.uDetail = tuni.uDetail; sh.uniforms.uSnowCover = U.uSnowCover;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aFar; varying vec3 vFar;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFar = aFar;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      uniform sampler2D uDetail; uniform float uFine; uniform float uSnowCover; varying vec3 vFar;
      float jBH = 0.0; float jBK = 0.0;
      vec3 jBumpN( vec3 N, vec3 P, float h, float k ) {
        vec3 dpx = dFdx( P ), dpy = dFdy( P );
        vec3 r1 = cross( dpy, N ), r2 = cross( N, dpx );
        float det = dot( dpx, r1 );
        vec3 grad = sign( det ) * ( dFdx( h ) * k * r1 + dFdy( h ) * k * r2 );
        return normalize( abs( det ) * N - grad );
      }`)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + FAR_FS)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nif ( uFine > 0.5 ) normal = jBumpN( normal, -vViewPosition, jBH, jBK );');
  };
  patch(m, { gobo: false, fog: true, shadowFade: false });
  m.customProgramCacheKey = () => 'terrainFar';
  return m;
}
const FAR_COL = {
  grass: new THREE.Color('#7d9440'), dry: new THREE.Color('#a4a252'), forest: new THREE.Color('#41592c'), forest2: new THREE.Color('#34502e'),
  rock: new THREE.Color('#8a7e70'), rockDark: new THREE.Color('#6b6474'), snow: new THREE.Color('#f4f1ec'),
};
export function buildFar(tuni, land) {
  // 坐标：近景范围内 8 米一格（和近景边界对齐），往外按比例变稀
  // fineL/fineR：这一边有海崖，头 fine 米里格子变稀得慢一些（崖壁的轮廓才看得出来）
  const axis = (a0, a1, lo, hi, fineL = 0, fineR = 0) => {
    const out = [];
    for (let v = a0; v <= a1 + 1e-6; v += 8) out.push(v);
    let s = 8, v = a0; const left = []; while (v > lo) { s *= a0 - v < fineL ? 1.035 : 1.16; v -= s; left.push(Math.max(v, lo)); }
    s = 8; v = a1; const right = []; while (v < hi) { s *= v - a1 < fineR ? 1.035 : 1.16; v += s; right.push(Math.min(v, hi)); }
    return [...left.reverse(), ...out, ...right];
  };
  const R = 3400;
  const xs = axis(DOM.x0, DOM.x0 + DOM.w, CENTER.x - R, CENTER.x + R, 260, 0);
  const zs = axis(DOM.z0, DOM.z0 + DOM.d, CENTER.z - R, CENTER.z + R, 260, 260);
  const nx = xs.length, nz = zs.length;
  const pos = new Float32Array(nx * nz * 3), nor = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3), mix3 = new Float32Array(nx * nz * 3);
  const hs = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) hs[j * nx + i] = farH(xs[i], zs[j]);
  const c = new THREE.Color();
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, x = xs[i], z = zs[j];
    let h = hs[k];
    const inside = x > DOM.x0 + 0.1 && x < DOM.x0 + DOM.w - 0.1 && z > DOM.z0 + 0.1 && z < DOM.z0 + DOM.d - 0.1;
    // 法线：用相邻格子
    const il = Math.max(0, i - 1), ir = Math.min(nx - 1, i + 1), jd = Math.max(0, j - 1), ju = Math.min(nz - 1, j + 1);
    const dx = (hs[j * nx + ir] - hs[j * nx + il]) / (xs[ir] - xs[il]), dz = (hs[ju * nx + i] - hs[jd * nx + i]) / (zs[ju] - zs[jd]);
    const l = Math.hypot(dx, 1, dz); const ny = 1 / l;
    nor[k * 3] = -dx / l; nor[k * 3 + 1] = ny; nor[k * 3 + 2] = -dz / l;
    // 颜色：低处草地/树林斑块，陡处岩石，高处雪
    const n1 = fbm(x * 0.006 + 3, z * 0.006, 3), n2 = vnoise(x * 0.03, z * 0.03);
    // 西北冰湖那边雪线低。远山网格粗，雪线在这里放成很宽的一条带子，真正的雪边由像素里的噪声去咬（不然缓坡上雪边是一格格的锯齿）
    const SL = regionSnowLine(x, z), sk = SL > 9e3 ? 0 : sstep(SL - 18, SL + 26, h);
    c.copy(FAR_COL.grass).lerp(FAR_COL.dry, sstep(0.55, 0.75, n2) * 0.5);
    const fo = sstep(0.42, 0.56, n1) * sstep(1200, 300, h) * (1 - sk);
    c.lerp(n2 > 0.5 ? FAR_COL.forest : FAR_COL.forest2, fo);
    const rk = sstep(0.55, 0.75, 1 - ny) * 0.9;
    c.lerp(FAR_COL.rock, rk);
    c.lerp(FAR_COL.rockDark, sstep(120, 320, h) * 0.6);
    const snowLine = 250 + 60 * (n1 - 0.5) + 80 * (1 - ny);
    // 积雪在着色器里逐像素算（边缘才清楚）；很陡的岩壁上挂不住雪，露出一道道岩石
    const snow = Math.max(sstep(snowLine - 10, snowLine + 50, h) * (ny > 0.55 ? 1 : 0.7), sk * sstep(0.3, 0.62, ny + 0.14 * (n2 - 0.5)));
    col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
    mix3[k * 3] = fo; mix3[k * 3 + 1] = Math.max(rk, sstep(120, 320, h) * 0.6); mix3[k * 3 + 2] = snow;
    if (inside) {
      h -= 6;
      // 近景里挖下去的溪槽、湖盆比粗网格低得多：这一格四周最低的近景地面再往下压，免得粗网格从溪边冒出来挡住水面
      if (land) {
        const r = 8 / DOM.cell + 1, fx = (x - DOM.x0) / DOM.cell, fz = (z - DOM.z0) / DOM.cell;
        const gx0 = Math.max(0, Math.floor(fx - r)), gx1 = Math.min(land.NX - 1, Math.ceil(fx + r));
        const gz0 = Math.max(0, Math.floor(fz - r)), gz1 = Math.min(land.NZ - 1, Math.ceil(fz + r));
        let m = Infinity;
        for (let gz = gz0; gz <= gz1; gz++) for (let gx = gx0; gx <= gx1; gx++) m = Math.min(m, land.H[gz * land.NX + gx]);
        h = Math.min(h, m - 2);
      }
    }
    pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
  }
  const idx = new Uint32Array((nx - 1) * (nz - 1) * 6); let p = 0;
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, cc = a + nx, d = cc + 1;
    idx[p++] = a; idx[p++] = cc; idx[p++] = b; idx[p++] = b; idx[p++] = cc; idx[p++] = d;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aFar', new THREE.BufferAttribute(mix3, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  const mat = farMaterial(tuni);
  const mesh = new THREE.Mesh(geo, mat); mesh.name = 'terrainFar'; mesh.matrixAutoUpdate = false; mesh.renderOrder = 1;
  mesh.userData.stats = { verts: nx * nz };
  // 和网格一致的高度查询（远处的替身树要贴着这张粗网格）
  const find = (arr, v) => { let lo = 0, hi = arr.length - 1; if (v <= arr[0]) return 0; if (v >= arr[hi]) return hi - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (arr[m] <= v) lo = m; else hi = m; } return lo; };
  mesh.userData.heightAt = (x, z) => {
    const i = find(xs, x), j = find(zs, z);
    const tx = clamp((x - xs[i]) / (xs[i + 1] - xs[i]), 0, 1), tz = clamp((z - zs[j]) / (zs[j + 1] - zs[j]), 0, 1);
    const a = hs[j * nx + i], b = hs[j * nx + i + 1], c2 = hs[(j + 1) * nx + i], d = hs[(j + 1) * nx + i + 1];
    return tx + tz < 1 ? a + (b - a) * tx + (c2 - a) * tz : d + (c2 - d) * (1 - tx) + (b - d) * (1 - tz);
  };
  return mesh;
}
