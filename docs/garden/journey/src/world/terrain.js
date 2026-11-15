// 地面：近景分块网格（路、溪岸、草地、坡上岩石在着色器里按距离场混色）+ 远景粗网格（顶点色：草、林、岩、雪）
import * as THREE from 'three';
import { DOM, CENTER, farH, bankW } from './land.js';
import { patch } from './atmo.js';
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
// 土路纹理：暖色土、小石子、细裂纹
export function makeDirtTex(S = 512) {
  const r = rng(9);
  // 先在 JS 里算出大块明暗，再在画布上画颗粒和石子
  const blot = blurWrap(grayLayer(S, '#808080', g => {
    const L = Array.from({ length: 260 }, () => ({ x: r() * S, y: r() * S, rad: 12 + r() * 50, rot: r() * 3, v: r() < 0.5 ? 200 : 60 }));
    batched(g, L, b => `rgba(${b.v},${b.v},${b.v},0.25)`, b => { for (const [px, py] of wrapPts(S, b.x, b.y, b.rad)) { g.moveTo(px + b.rad, py); g.ellipse(px, py, b.rad, b.rad * 0.6, b.rot, 0, 6.283); } }, true);
  }), S, 6, 2);
  const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  const img = g.createImageData(S, S);
  const base = [179, 144, 101];
  for (let i = 0; i < S * S; i++) { const k = (blot[i] - 128) / 128; img.data[i * 4] = base[0] * (1 + 0.22 * k); img.data[i * 4 + 1] = base[1] * (1 + 0.24 * k); img.data[i * 4 + 2] = base[2] * (1 + 0.28 * k); img.data[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  // 细碎颗粒
  const grit = Array.from({ length: 9000 }, () => ({ x: r() * S, y: r() * S, s: 1 + r() * 1.5, dark: r() < 0.5 }));
  batched(g, grit, p => p.dark ? 'rgba(90,66,44,0.35)' : 'rgba(232,208,168,0.35)', p => g.rect(p.x, p.y, p.s, p.s), true);
  // 小石子（亮顶暗底）
  const pebbles = Array.from({ length: 420 }, () => { const w = 2 + r() * 5.5; return { x: r() * S, y: r() * S, w, h: w * (0.55 + r() * 0.35), rot: r() * 3, tone: Math.round((150 + r() * 70) / 20) * 20 }; });
  const peb = (dx, dy, sc) => p => { for (const [px, py] of wrapPts(S, p.x, p.y, 12)) { g.moveTo(px + dx + p.w * sc, py + dy); g.ellipse(px + dx, py + dy, p.w * sc, p.h * sc, p.rot, 0, 6.283); } };
  batched(g, pebbles, () => 'rgba(70,50,34,0.45)', peb(1.2, 1.4, 1), true);
  batched(g, pebbles, p => `rgb(${p.tone},${p.tone - 12},${p.tone - 30})`, peb(0, 0, 1), true);
  batched(g, pebbles, () => 'rgba(255,246,226,0.3)', p => { for (const [px, py] of wrapPts(S, p.x, p.y, 12)) { const x = px - p.w * 0.3, y = py - p.h * 0.35; g.moveTo(x + p.w * 0.45, y); g.ellipse(x, y, p.w * 0.45, p.h * 0.35, p.rot, 0, 6.283); } }, true);
  // 浅浅的裂纹
  g.strokeStyle = 'rgba(96,70,46,0.35)'; g.lineWidth = 1; g.beginPath();
  for (let i = 0; i < 40; i++) { let x = r() * S, y = r() * S; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 22; y += (r() - 0.5) * 22; g.lineTo(x, y); } }
  g.stroke();
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// ---------- 分区数据纹理：R 路距离，G 岸距离，B 花草地，A 林下 ----------
export function makeSplat(land) {
  const NX = land.NX, NZ = land.NZ, data = new Uint8Array(NX * NZ * 4);
  for (let gz = 0; gz < NZ; gz++) for (let gx = 0; gx < NX; gx++) {
    const k = gz * NX + gx, x = DOM.x0 + gx * DOM.cell, z = DOM.z0 + gz * DOM.cell;
    data[k * 4] = clamp(Math.abs(land.roadD[k]) / 10, 0, 1) * 255;
    const e = land.strD[k] - bankW(land.strS[k]);
    data[k * 4 + 1] = clamp((e + 4) / 24, 0, 1) * 255;
    data[k * 4 + 2] = sstep(0.5, 0.68, fbm(x * 0.02 + 40, z * 0.02, 3)) * 255;
    data[k * 4 + 3] = 0;
  }
  const t = new THREE.DataTexture(data, NX, NZ, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
}

export const PALETTE = {
  grass0: '#86a03f', grass1: '#a4b04a', grass2: '#cdbb63', grass3: '#56803a', forest: '#5a5a32',
  rock: '#8f8574', bank: '#6e5c45', pebble: '#a49a86', bed: '#5d6a52',
};

export const TERRAIN_GLSL = /* glsl */`
uniform sampler2D uSplat; uniform sampler2D uDetail; uniform sampler2D uDirt; uniform vec4 uDom;
uniform vec3 uGrass0; uniform vec3 uGrass1; uniform vec3 uGrass2; uniform vec3 uGrass3; uniform vec3 uForestC;
uniform vec3 uRock; uniform vec3 uBank; uniform vec3 uPebble; uniform vec3 uBed;
// 草地的颜色（地面和草丛共用，草丛看起来就像是从地里长出来的）
vec3 jGrass( vec2 xz, vec4 sp, vec3 dA ) {
  vec3 dB = texture2D( uDetail, xz * 0.031 + vec2( 0.37, 0.71 ) ).rgb;
  vec3 dC = texture2D( uDetail, xz * 0.0072 + vec2( 0.11, 0.53 ) ).rgb;
  vec3 g = mix( uGrass0, uGrass1, smoothstep( 0.3, 0.7, dC.g ) );
  g = mix( g, uGrass2, smoothstep( 0.52, 0.8, dB.g ) * 0.6 * ( 0.4 + 0.6 * sp.b ) );
  g = mix( g, uGrass3, smoothstep( 0.5, 0.85, dC.b ) * 0.55 );
  g *= 0.8 + 0.4 * dA.r;
  return mix( g, uForestC * ( 0.85 + 0.3 * dA.g ), sp.a * 0.8 );
}
vec4 jSplat( vec2 xz ) { return texture2D( uSplat, ( xz - uDom.xy ) / uDom.zw ); }
`;
const TERRAIN_VS = /* glsl */`varying vec3 vWN;`;
const TERRAIN_COLOR = /* glsl */`
{
  vec4 sp = jSplat( vWP.xz );
  float dRoad = sp.r * 10.0, shore = sp.g * 24.0 - 4.0;
  vec3 dA = texture2D( uDetail, vWP.xz * 0.13 ).rgb;
  vec3 dB = texture2D( uDetail, vWP.xz * 0.031 + vec2( 0.37, 0.71 ) ).rgb;
  vec3 g = jGrass( vWP.xz, sp, dA );
  // 坡上露出岩石
  float slope = 1.0 - normalize( vWN ).y;
  float rk = smoothstep( 0.3, 0.46, slope + ( dB.r - 0.5 ) * 0.22 );
  g = mix( g, uRock * ( 0.75 + 0.5 * dA.g ), rk );
  // 溪岸：卵石滩、湿土，水下是河床
  float bankN = ( dA.b - 0.5 ) * 0.8;
  g = mix( g, uBank * ( 0.85 + 0.3 * dA.r ), 1.0 - smoothstep( 0.4 + bankN, 1.8 + bankN, shore ) );
  g = mix( g, uPebble * ( 0.7 + 0.6 * dA.b ), ( 1.0 - smoothstep( -0.2, 0.9 + bankN, shore ) ) * smoothstep( -1.0, 0.0, shore ) * 0.8 );
  g = mix( g, uBed * ( 0.8 + 0.4 * dA.g ), 1.0 - smoothstep( -1.2, -0.2, shore ) );
  // 土路：边缘被草啃得参差，中间被踩得浅一点
  float en = ( dA.b - 0.5 ) * 0.6 + ( dB.g - 0.5 ) * 0.7;
  float road = 1.0 - smoothstep( 1.0 + en, 1.45 + en, dRoad );
  vec3 dirt = texture2D( uDirt, vWP.xz * 0.3 ).rgb * mix( 0.9, 1.08, dB.r );
  dirt *= 1.0 + 0.1 * ( 1.0 - smoothstep( 0.0, 0.9, dRoad ) );
  float edge = smoothstep( 0.9, 1.5, dRoad ) * ( 1.0 - smoothstep( 1.5, 2.6, dRoad ) );
  g *= 1.0 - 0.16 * edge;
  diffuseColor.rgb *= mix( g, dirt, road );
}
`;

export function terrainUniforms(splat, detail, dirt) {
  const uni = {
    uSplat: { value: splat }, uDetail: { value: detail }, uDirt: { value: dirt },
    uDom: { value: new THREE.Vector4(DOM.x0, DOM.z0, DOM.w, DOM.d) },
  };
  for (const [k, v] of Object.entries({ uGrass0: 'grass0', uGrass1: 'grass1', uGrass2: 'grass2', uGrass3: 'grass3', uForestC: 'forest', uRock: 'rock', uBank: 'bank', uPebble: 'pebble', uBed: 'bed' }))
    uni[k] = { value: new THREE.Color(PALETTE[v]) };
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
      .replace('#include <map_fragment>', TERRAIN_COLOR);
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
      .replace('#include <color_fragment>', `
        {
          vec4 sp = jSplat( vWP.xz );
          vec3 dA = texture2D( uDetail, vWP.xz * 0.13 ).rgb;
          vec3 g = jGrass( vWP.xz, sp, dA );
          // 顶点色：r = 高度比例（0 根 1 尖），g = 亮度扰动
          float t = vColor.r;
          diffuseColor.rgb = g * mix( 0.5, 1.1, t ) * ( 0.9 + 0.2 * vColor.g );
          diffuseColor.rgb *= 1.0 - 0.3 * step( 0.6, 1.0 - smoothstep( 1.0, 1.4, sp.r * 10.0 ) );
        }`);
  };
  patch(m, { wind: 'grass', gobo: true, sss: 0.55, fadeOut: true, uniforms: { uFadeR: fadeU } });
  m.customProgramCacheKey = () => 'tuft';
  return m;
}
// 一丛草的几何：几片弯弯的细叶，三段
export function makeTuftGeo(seed, blades = 8, h0 = 0.42) {
  let a = seed; const R = () => ((a = (a * 16807) % 2147483647) / 2147483647);
  const pos = [], col = [], nor = [], idx = [];
  for (let b = 0; b < blades; b++) {
    const ang = R() * Math.PI * 2, rr = R() * 0.16, h = h0 * (0.55 + R() * 0.6), w = 0.03 + R() * 0.02;
    const lean = 0.25 + R() * 0.45, ox = Math.cos(ang) * rr, oz = Math.sin(ang) * rr, face = ang + Math.PI / 2 + (R() - 0.5);
    const fx = Math.cos(face), fz = Math.sin(face), dx = Math.cos(ang), dz = Math.sin(ang);
    const bright = R();
    const base = pos.length / 3;
    const segs = 3;
    for (let k = 0; k <= segs; k++) {
      const t = k / segs, y = h * t, bend = lean * h * t * t, ww = w * (1 - t * 0.92);
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
  for (let cz = 0; cz < DOM.nz; cz += C) for (let cx = 0; cx < DOM.nx; cx += C) {
    const w = Math.min(C, DOM.nx - cx), d = Math.min(C, DOM.nz - cz);
    const pos = new Float32Array((w + 1) * (d + 1) * 3), nor = new Float32Array(pos.length);
    let v = 0;
    for (let j = 0; j <= d; j++) for (let i = 0; i <= w; i++) {
      const gx = cx + i, gz = cz + j, k = gz * NX + gx;
      pos[v] = DOM.x0 + gx * DOM.cell; pos[v + 1] = H[k]; pos[v + 2] = DOM.z0 + gz * DOM.cell;
      nor[v] = N[k * 3]; nor[v + 1] = N[k * 3 + 1]; nor[v + 2] = N[k * 3 + 2]; v += 3;
    }
    const idx = [];
    for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) {
      const a = j * (w + 1) + i, b = a + 1, c = a + w + 1, e = c + 1;
      idx.push(a, c, b, b, c, e);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setIndex(idx); geo.computeBoundingSphere(); geo.computeBoundingBox();
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; m.matrixAutoUpdate = false;
    group.add(m);
  }
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
const FAR_COL = {
  grass: new THREE.Color('#7d9440'), dry: new THREE.Color('#a4a252'), forest: new THREE.Color('#41592c'), forest2: new THREE.Color('#34502e'),
  rock: new THREE.Color('#8a7e70'), rockDark: new THREE.Color('#6b6474'), snow: new THREE.Color('#f4f1ec'),
};
export function buildFar() {
  // 坐标：近景范围内 8 米一格（和近景边界对齐），往外按比例变稀
  const axis = (a0, a1, lo, hi) => {
    const out = [];
    for (let v = a0; v <= a1 + 1e-6; v += 8) out.push(v);
    let s = 8, v = a0; const left = []; while (v > lo) { s *= 1.16; v -= s; left.push(Math.max(v, lo)); }
    s = 8; v = a1; const right = []; while (v < hi) { s *= 1.16; v += s; right.push(Math.min(v, hi)); }
    return [...left.reverse(), ...out, ...right];
  };
  const R = 3400;
  const xs = axis(DOM.x0, DOM.x0 + DOM.w, CENTER.x - R, CENTER.x + R);
  const zs = axis(DOM.z0, DOM.z0 + DOM.d, CENTER.z - R, CENTER.z + R);
  const nx = xs.length, nz = zs.length;
  const pos = new Float32Array(nx * nz * 3), nor = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3);
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
    c.copy(FAR_COL.grass).lerp(FAR_COL.dry, sstep(0.55, 0.75, n2) * 0.5);
    c.lerp(n2 > 0.5 ? FAR_COL.forest : FAR_COL.forest2, sstep(0.42, 0.56, n1) * sstep(1200, 300, h));
    c.lerp(FAR_COL.rock, sstep(0.55, 0.75, 1 - ny) * 0.9);
    c.lerp(FAR_COL.rockDark, sstep(120, 320, h) * 0.6);
    const snowLine = 250 + 60 * (n1 - 0.5) + 80 * (1 - ny);
    c.lerp(FAR_COL.snow, sstep(snowLine, snowLine + 50, h) * (ny > 0.55 ? 1 : 0.7));
    col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
    if (inside) h -= 6;
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
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  patch(mat, { gobo: false, fog: true, shadowFade: false });
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
