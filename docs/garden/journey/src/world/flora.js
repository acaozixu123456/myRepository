// 植被：树、灌木、草、花、石头。近处用真模型（按距离动态挑实例），远处的树用替身贴片。
import * as THREE from 'three';
import { DOM, CENTER, bankW, SHOAL, lakeQ, ICE_Q } from './land.js';
import { ROAD, STREAM, SPOTS, CREEK_END, CAMP_SITES, SEA, SEAWAY, LIGHTHOUSE, STACKS, VISTAS } from './route.js';
import { bambooTextures } from './bamboo.js';
import { patch, U, FOG_FN, CLOUD_FN } from './atmo.js';
import { rng, fbm, vnoise, sstep, clamp } from './noise.js';
import { autumnTint, snowLine } from './regions.js';

// ---------- 读取打包好的模型 ----------
export async function loadFlora(base) {
  const [meta, bin] = await Promise.all([fetch(base + 'flora.json').then(r => r.json()), fetch(base + 'flora.bin').then(r => r.arrayBuffer())]);
  const models = {};
  for (const [name, m] of Object.entries(meta)) {
    models[name] = { parts: m.parts.map(p => ({ mat: p.mat, geo: decode(bin, p) })), min: m.min, max: m.max };
  }
  return models;
}
function decode(bin, p) {
  const n = p.count;
  const qp = new Uint16Array(bin, p.pos, n * 3), qn = new Int8Array(bin, p.nor, n * 4), qu = new Uint16Array(bin, p.uv, n * 2);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) { pos[i * 3 + k] = p.pmin[k] + qp[i * 3 + k] / 65535 * p.pext[k]; nor[i * 3 + k] = qn[i * 4 + k] / 127; }
    uv[i * 2] = p.umin[0] + qu[i * 2] / 65535 * p.uext[0]; uv[i * 2 + 1] = p.umin[1] + qu[i * 2 + 1] / 65535 * p.uext[1];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(new Uint16Array(bin, p.idx, p.icount).slice(), 1));
  g.computeBoundingSphere();
  return g;
}
// 树冠法线改成“球面”法线：光影像一团团柔软的叶子，而不是一片片纸
function softenCanopy(geo, amount = 0.75) {
  geo.computeBoundingBox();
  const c = new THREE.Vector3(); geo.boundingBox.getCenter(c); c.y -= (geo.boundingBox.max.y - geo.boundingBox.min.y) * 0.08;
  const P = geo.attributes.position, N = geo.attributes.normal, v = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    v.fromBufferAttribute(P, i).sub(c).normalize(); n.fromBufferAttribute(N, i);
    n.lerp(v, amount).normalize(); N.setXYZ(i, n.x, n.y, n.z);
  }
  N.needsUpdate = true;
}

// 树皮贴图（现画，可以上下左右接上）：一道道竖着的深裂和亮棱，像用宽笔刷出来的
function barkTexture() {
  const W = 256, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  let a = 19; const r = () => ((a = (a * 16807) % 2147483647) / 2147483647);
  g.fillStyle = '#a8663f'; g.fillRect(0, 0, W, H);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const stroke = (col, wd, n, amp) => {
    for (let i = 0; i < n; i++) {
      const x = r() * W, y = r() * H, len = 70 + r() * 220, w = wd * (0.5 + r()), ph = r() * 6.3, f = 0.02 + r() * 0.03;
      g.strokeStyle = col(r()); g.lineWidth = w;
      for (const dx of [-W, 0, W]) for (const dy of [-H, 0, H]) {
        g.beginPath();
        for (let t = 0; t <= len; t += 10) { const px = x + dx + Math.sin(ph + t * f) * amp, py = y + dy + t; if (t === 0) g.moveTo(px, py); else g.lineTo(px, py); }
        g.stroke();
      }
    }
  };
  stroke(k => `rgba(226,150,98,${0.2 + k * 0.25})`, 12, 46, 5);     // 宽的亮面
  stroke(k => `rgba(92,48,30,${0.3 + k * 0.3})`, 4, 60, 6);         // 深裂
  stroke(k => `rgba(246,184,128,${0.18 + k * 0.22})`, 2.5, 50, 4);  // 细亮棱
  stroke(k => `rgba(60,30,20,${0.3 + k * 0.25})`, 1.5, 40, 5);      // 细缝
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// ---------- 材质 ----------
export async function floraMaterials(base, fadeU, tuni) {
  const L = new THREE.TextureLoader();
  const files = ['leaf.png', 'pine.png', 'flowers.png', 'atlas.png', 'grass.png', 'mush.jpg', 'rock.jpg', 'pebble.jpg'];
  const loaded = Object.fromEntries(await Promise.all(files.map(async f => [f, await L.loadAsync(base + f)])));
  const tex = (f, srgb = true) => { const t = loaded[f]; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 4; return t; };
  const M = {};
  const mk = (key, map, o, matOpts = {}) => {
    const m = new THREE.MeshLambertMaterial({ map, ...matOpts });
    patch(m, o);
    M[key] = m;
  };
  const near = { seeThrough: true, uniforms: { uFadeR: fadeU.trees } };
  mk('leaf', tex('leaf.png'), { wind: 'tree', gobo: false, sss: 0.55, fadeOut: true, ...near }, { alphaTest: 0.42, side: THREE.DoubleSide });
  mk('pine', tex('pine.png'), { wind: 'tree', gobo: false, sss: 0.35, fadeOut: true, ...near }, { alphaTest: 0.42, side: THREE.DoubleSide });
  mk('bark', barkTexture(), { wind: 'tree', gobo: false, fadeOut: true, ...near });
  // 灌木：和树共用叶子贴图，但不淡出（它们有自己的显示半径）
  M.bushLeaf = new THREE.MeshLambertMaterial({ map: M.leaf.map, alphaTest: 0.42, side: THREE.DoubleSide });
  patch(M.bushLeaf, { wind: 'grass', tread: 0.32, gobo: true, sss: 0.45, fadeOut: true, seeThrough: true, uniforms: { uFadeR: fadeU.bush } });
  M.bushFlower = new THREE.MeshLambertMaterial({ map: tex('flowers.png'), alphaTest: 0.5, side: THREE.DoubleSide });
  patch(M.bushFlower, { wind: 'grass', tread: 0.32, gobo: true, fadeOut: true, seeThrough: true, uniforms: { uFadeR: fadeU.bush } });
  const small = { uniforms: { uFadeR: fadeU.small } };
  mk('atlas', tex('atlas.png'), { wind: 'grass', tread: 0.9, gobo: true, sss: 0.4, fadeOut: true, grassN: 0.45, ...small }, { alphaTest: 0.5, side: THREE.DoubleSide });
  mk('flowers', M.bushFlower.map, { wind: 'grass', tread: 0.9, gobo: true, sss: 0.3, fadeOut: true, grassN: 0.35, ...small }, { alphaTest: 0.5, side: THREE.DoubleSide });
  mk('grass', tex('grass.png'), { wind: 'grass', tread: 1, gobo: true, sss: 0.5, fadeOut: true, grassN: 0.6, ...small }, { side: THREE.DoubleSide });
  mk('mush', tex('mush.jpg'), { gobo: true, fadeOut: true, ...small });
  const rockU = { uniforms: { uFadeR: fadeU.rock, uBiome: tuni.uBiome, uDom: tuni.uDom } };
  mk('rock', tex('rock.jpg'), { gobo: true, fadeOut: true, cover: true, ...rockU });
  mk('pebble', tex('pebble.jpg'), { gobo: true, fadeOut: true, ...small });
  // 雪松：朝上的松针上落着雪
  M.pineS = new THREE.MeshLambertMaterial({ map: M.pine.map, alphaTest: 0.42, side: THREE.DoubleSide });
  M.pineS.onBeforeCompile = sh => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      {
        vec3 wn = normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
        float sn = smoothstep( 0.0, 0.45, wn.y + 0.16 * sin( vWP.x * 3.1 + vWP.z * 2.3 + vWP.y * 5.0 ) + 0.1 * sin( vWP.y * 9.0 ) );
        diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.86, 0.9, 0.96 ), sn * 0.9 );
      }`);
  };
  patch(M.pineS, { wind: 'tree', gobo: false, sss: 0.2, fadeOut: true, ...near });
  M.pineS.emissive.setScalar(0.06); M.pineS.emissiveMap = M.pine.map;
  // 竹子：竹竿和竹叶（贴图现画）
  const bt = bambooTextures();
  mk('bcane', bt.cane, { wind: 'tree', gobo: false, fadeOut: true, ...near });
  mk('bleaf', bt.leaf, { wind: 'tree', gobo: false, sss: 0.6, fadeOut: true, ...near }, { alphaTest: 0.4, side: THREE.DoubleSide });
  // 这套石头贴图偏暗偏绿，提亮成暖灰
  M.bark.color.setRGB(1.2, 1.1, 1.02);
  // 松针背光时几乎是黑的：加一点自发光（按贴图本身的颜色）
  M.pine.emissive.setScalar(0.1); M.pine.emissiveMap = M.pine.map;
  return M;
}

// ---------- 动态实例层：所有实例按 24 米格子分桶，每隔一会儿挑出镜头附近、视野里的 ----------
const _f = new THREE.Frustum(), _m4 = new THREE.Matrix4(), _sph = new THREE.Sphere();
export class ScatterLayer {
  // parts: [{geo, mat}], items: Float32Array [x,y,z,ry,s,r,g,b] * n
  constructor(name, parts, items, opts = {}) {
    this.name = name; this.r = opts.radius || 50; this.rMin = opts.rMin || 0; this.cull = opts.cull !== false; this.shadow = !!opts.shadow;
    this.n = items.length / 8; this.items = items;
    this.cell = 24; this.buckets = new Map();
    for (let i = 0; i < this.n; i++) {
      const k = Math.floor(items[i * 8] / this.cell) + ',' + Math.floor(items[i * 8 + 2] / this.cell);
      let b = this.buckets.get(k); if (!b) this.buckets.set(k, b = { list: [], cx: (Math.floor(items[i * 8] / this.cell) + 0.5) * this.cell, cz: (Math.floor(items[i * 8 + 2] / this.cell) + 0.5) * this.cell, y: items[i * 8 + 1] });
      b.list.push(i);
    }
    this.maxR = opts.maxScale || 2;
    const cap = Math.min(this.n, opts.cap || 4000);
    this.meshes = parts.map(p => {
      const m = new THREE.InstancedMesh(p.geo, p.mat, cap);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      // 树皮不跟着叶子的颜色变（秋天的树叶子是红的，树干还是褐色）
      if (p.tint !== false) { m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); m.instanceColor.setUsage(THREE.DynamicDrawUsage); }
      m.count = 0; m.frustumCulled = false; m.castShadow = !!opts.shadow; m.receiveShadow = opts.receive !== false;
      m.name = name;
      // castR > 0：只有离人 castR 米以内的投影子。它们排在实例表最前面，画影子图时只画这一段
      let keep = 0;
      m.onBeforeShadow = () => { keep = m.count; if (this.castR > 0) m.count = Math.min(keep, this.nearCount); };
      m.onAfterShadow = () => { m.count = keep; };
      return m;
    });
    this.castR = 0; this.nearCount = 0;
    this.cap = cap; this.last = new THREE.Vector3(1e9, 0, 0); this.t = 0;
    this.group = new THREE.Group(); this.group.name = name; for (const m of this.meshes) this.group.add(m);
  }
  update(camera, focus, dt, force) {
    this.t -= dt;
    if (!force && this.t > 0 && focus.distanceToSquared(this.last) < 4) return;
    this.t = 0.25; this.last.copy(focus);
    if (this.cull) { _m4.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); _f.setFromProjectionMatrix(_m4); }
    const r = this.r, r2 = r * r, rm2 = this.rMin * this.rMin, cx = camera.position.x, cz = camera.position.z, it = this.items;
    if (!this.col) this.col = new Float32Array(this.cap * 3);
    const mat = this.meshes[0].instanceMatrix.array, col = this.col;
    let c = 0;
    const half = this.cell * 0.75;
    // 要投影子的层分两遍：先放离人近的（投影子的），再放其余的
    const cr2 = this.castR * this.castR, fx = focus.x, fz = focus.z, passes = this.castR > 0 ? 2 : 1;
    for (const m of this.meshes) m.castShadow = this.castR > 0 || this.shadow;
    for (let pass = 0; pass < passes; pass++) {
    if (pass === 1) this.nearCount = c;
    for (const b of this.buckets.values()) {
      const dx = b.cx - cx, dz = b.cz - cz;
      if (dx * dx + dz * dz > (r + half) * (r + half)) continue;
      const nearB = passes === 2 && (b.cx - fx) ** 2 + (b.cz - fz) ** 2 < (this.castR + half) ** 2;
      if (pass === 0 && passes === 2 && !nearB) continue;
      if (this.cull && !nearB) { _sph.center.set(b.cx, b.y + 4, b.cz); _sph.radius = half + 8; if (!_f.intersectsSphere(_sph)) continue; }
      for (const i of b.list) {
        const o = i * 8, x = it[o], z = it[o + 2], ex = x - cx, ez = z - cz, d2 = ex * ex + ez * ez;
        if (d2 > r2 || d2 < rm2 || c >= this.cap) continue;
        if (passes === 2 && ((x - fx) ** 2 + (z - fz) ** 2 < cr2) !== (pass === 0)) continue;
        const s = it[o + 4], cs = Math.cos(it[o + 3]) * s, sn = Math.sin(it[o + 3]) * s, m = c * 16;
        mat[m] = cs; mat[m + 1] = 0; mat[m + 2] = -sn; mat[m + 3] = 0;
        mat[m + 4] = 0; mat[m + 5] = s; mat[m + 6] = 0; mat[m + 7] = 0;
        mat[m + 8] = sn; mat[m + 9] = 0; mat[m + 10] = cs; mat[m + 11] = 0;
        mat[m + 12] = x; mat[m + 13] = it[o + 1]; mat[m + 14] = z; mat[m + 15] = 1;
        col[c * 3] = it[o + 5]; col[c * 3 + 1] = it[o + 6]; col[c * 3 + 2] = it[o + 7];
        c++;
      }
    }
    }
    for (let k = 0; k < this.meshes.length; k++) {
      const m = this.meshes[k];
      if (k > 0) m.instanceMatrix.array.set(mat.subarray(0, c * 16));
      m.count = c;
      m.instanceMatrix.clearUpdateRanges(); m.instanceMatrix.addUpdateRange(0, c * 16); m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) {
        m.instanceColor.array.set(col.subarray(0, c * 3));
        m.instanceColor.clearUpdateRanges(); m.instanceColor.addUpdateRange(0, c * 3); m.instanceColor.needsUpdate = true;
      }
    }
    this.visible = c;
  }
}

// ---------- 摆放 ----------
const TREE_TYPES = ['CommonTree_1', 'CommonTree_3', 'CommonTree_5', 'Pine_2'];
export function placeFlora(land, farHeight, quality) {
  const R = rng(20251115);
  const trees = [];            // {t, x, z, s, ry, far}
  const occ = new Map();       // 树之间留距离
  const okSpace = (x, z, d) => {
    const c = 6, gx = Math.floor(x / c), gz = Math.floor(z / c);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const a = occ.get((gx + i) + ',' + (gz + j)); if (!a) continue;
      for (const q of a) if ((q[0] - x) ** 2 + (q[1] - z) ** 2 < d * d) return false;
    }
    return true;
  };
  const mark = (x, z) => { const k = Math.floor(x / 6) + ',' + Math.floor(z / 6); let a = occ.get(k); if (!a) occ.set(k, a = []); a.push([x, z]); };
  const shore = (x, z) => { if (!land.inside(x, z)) return 99; const q = STREAM.nearest(x, z, 20); return q.dist === Infinity ? 99 : q.dist - bankW(q.s); };
  const camp = ROAD.at(SPOTS.camp), view = ROAD.at(SPOTS.view), bridge = ROAD.at(SPOTS.bridge);
  // 东坡花田：一大片空地开满花，只留一棵大树
  const MEADOW = { x: 75, z: -25, r: 30 };
  const meadowK = (x, z) => sstep(MEADOW.r, MEADOW.r * 0.6, Math.hypot(x - MEADOW.x, z - MEADOW.z));
  const clear = (x, z) => Math.hypot(x - camp.x - 2, z - camp.z + 3) > 17 && Math.hypot(x - view.x + 4, z - view.z) > 9 && Math.hypot(x - 62, z + 118) > 13 && Math.hypot(x - bridge.x, z - bridge.z) > 13
    && Math.hypot(x - MEADOW.x, z - MEADOW.z) > MEADOW.r - 4 && Math.hypot(x - SHOAL.x, z - SHOAL.z) > 10
    && CAMP_SITES.every(c => Math.hypot(x - c.x, z - c.z) > 10) && VISTAS.every(v => Math.hypot(x - v.x, z - v.z) > 9);
  // 西岭松林只种自己的树（别的步骤不往里塞），林子中间留一块空地
  const GROVE = { x: -150, z: -165 };
  const inGrove = (x, z) => Math.hypot((x - GROVE.x) / 1.2, z - GROVE.z) < 40;
  const onLake = (x, z) => lakeQ(x, z) < ICE_Q + 0.12;
  const addTree = (t, x, z, s, minD = 4.2, grove = false) => {
    if (!grove && inGrove(x, z)) return false;
    if (!land.inside(x, z) || land.roadDist(x, z) < 3.4 || shore(x, z) < 1.5 || !clear(x, z) || onLake(x, z) || !okSpace(x, z, minD)) return false;
    const y = land.heightExact(x, z);
    // 沙滩上、海边太低的地方不长树；竹林里只有竹子
    if (y < SEA.y + 1.2 || land.sand(x, z) > 0.3 || land.normal(x, z)[1] < 0.8) return false;
    if ((t === 'Bamboo') !== (land.bamboo(x, z) > 0.2) && !(t === 'Bamboo' && grove)) return false;
    if (Math.hypot(x - LIGHTHOUSE.x, z - LIGHTHOUSE.z) < 14) return false;
    // 树线：比雪线高十几米就不长树了；雪里只有松树（落着雪），红叶谷的阔叶树是红黄色的
    if (y > snowLine(x, z) + 14) return false;
    const sn = land.snow(x, z);
    let tint = null;
    if (t === 'Pine_2') { if (sn > 0.25) t = 'Pine_2@s'; }
    else if (sn > 0.3) return false;
    else if (t === 'Bamboo') { trees.push({ t, x, z, s, ry: 0, y: y - 0.06 }); mark(x, z); return true; }
    else if (R() < land.autumn(x, z) * 1.2) tint = autumnTint(R);
    trees.push({ t, x, z, s, ry: R() * 6.283, y: y - 0.06, tint }); mark(x, z); return true;
  };
  // 原来的谷地（新扩出来的山里林子稀一点、草也少一点）
  const oldDom = (x, z) => x > -192 && z > -336;
  const decid = () => TREE_TYPES[Math.floor(R() * 3)];
  // 1) 路边两片树林：树冠伸到路上，地上有斑驳的光影
  for (const gs of SPOTS.grove) {
    for (let i = 0; i < 70; i++) {
      const s = gs + (R() - 0.5) * 46, p = ROAD.at(s), side = R() < 0.5 ? -1 : 1, d = 3.6 + Math.pow(R(), 1.4) * 18;
      addTree(decid(), p.x - p.tz * side * d, p.z + p.tx * side * d, 0.85 + R() * 0.4);
    }
  }
  // 2) 观景台旁边一棵大树；花田上坡也有一棵
  addTree('CommonTree_1', view.x - 1.5, view.z + 5.5, 1.3, 2);
  { const x = MEADOW.x + 14, z = MEADOW.z - 12; trees.push({ t: 'CommonTree_1', x, z, s: 1.45, ry: 1.1, y: land.heightExact(x, z) - 0.06 }); mark(x, z); }
  // 2b) 西岭松林：溪西边山坡上的松树林。松树下面的枝子很宽（半径三米多），树要隔开八九米人和马才走得过去
  for (let i = 0; i < 260; i++) {
    const a = R() * 6.283, d = 7 + Math.sqrt(R()) * 31, x = GROVE.x + Math.cos(a) * d * 1.2, z = GROVE.z + Math.sin(a) * d;
    const pine = R() < 0.85;
    addTree(pine ? 'Pine_2' : 'CommonTree_3', x, z, pine ? 1.0 + R() * 0.5 : 0.95 + R() * 0.3, d < 14 ? 9.5 : 8.4, true);
  }
  // 3) 溪边的树
  for (let s = 0; s < STREAM.length; s += 7) {
    if (R() < 0.45) continue;
    const p = STREAM.at(s), side = R() < 0.5 ? -1 : 1, d = bankW(s) + 3 + R() * 7;
    addTree(decid(), p.x - p.tz * side * d, p.z + p.tx * side * d, 0.8 + R() * 0.45);
  }
  // 4) 山坡上的林子：噪声决定疏密，高处多松树；红叶谷满坡都是阔叶树
  const nForest = Math.round(26000 * DOM.w * DOM.d / (360 * 432));
  for (let i = 0; i < nForest; i++) {
    const x = DOM.x0 + R() * DOM.w, z = DOM.z0 + R() * DOM.d;
    const h = land.height(x, z), rd = land.mainRoadDist(x, z), au = land.autumn(x, z);
    if (rd < 22) continue;
    const m = sstep(0.46, 0.6, fbm(x * 0.011 + 5, z * 0.011 - 2, 3)) * (0.35 + 0.65 * sstep(3, 14, h)) + 0.25 * sstep(-250, -320, z) + 0.4 * au;
    if (R() > m * 0.9) continue;
    const pine = au > 0.25 ? R() < 0.16 : h > 17 || z < -262 ? R() < 0.75 : R() < 0.1;
    addTree(pine ? 'Pine_2' : decid(), x, z, pine ? 1.0 + R() * 0.6 : 0.85 + R() * 0.45, au > 0.25 ? 5.8 : 4.6);
  }
  // 5) 草地上零星几棵
  for (let i = 0; i < 1250; i++) {
    const x = DOM.x0 + R() * DOM.w, z = DOM.z0 + R() * DOM.d;
    if (land.roadDist(x, z) < 9 || fbm(x * 0.02, z * 0.02, 2) < 0.52) continue;
    addTree(decid(), x, z, 0.95 + R() * 0.45, 12);
  }
  // 5b) 竹林山坳：西边小路两边，一丛一丛的竹子（另用一个随机数，不打乱别处的树）
  {
    const RB = rng(8808);
    for (let i = 0; i < 4200; i++) {
      const x = -345 + RB() * 280, z = -85 + RB() * 140;
      const b = land.bamboo(x, z);
      if (RB() > b * 1.15) continue;
      const before = trees.length;
      addTree('Bamboo', x, z, 0.85 + RB() * 0.35, 3.3, true);
      if (trees.length > before) trees[trees.length - 1].ry = RB() * 6.283;
    }
  }
  const nearCount = trees.length;
  // 6) 近景范围外的远处林子（只用替身）
  for (let gx = -680; gx <= 680; gx += 9) for (let gz = -680; gz <= 680; gz += 9) {
    const x = CENTER.x + gx + (R() - 0.5) * 8, z = CENTER.z + gz + (R() - 0.5) * 8;
    if (land.inside(x, z)) continue;
    const r = Math.hypot(x - CENTER.x, z - CENTER.z); if (r > 680) continue;
    const h = farHeight(x, z);
    if (h < SEA.y + 2) continue;
    const n1 = fbm(x * 0.006 + 3, z * 0.006, 3);
    if (n1 < 0.45 || h > 260 || R() > sstep(0.45, 0.6, n1) * 0.9) continue;
    const sl = snowLine(x, z); if (h > sl + 14) continue;
    trees.push({ t: h > sl - 6 ? 'Pine_2@s' : h > 60 || R() < 0.3 ? 'Pine_2' : decid(), x, z, s: 1.0 + R() * 0.5, ry: 0, far: true, y: h });
  }
  // 7) 灌木、草、花、蕨、蘑菇、石头（只放在路两边 70 米内）
  const L = {};
  const push = (name, x, y, z, s, tint = 1, hueJ = 0.06) => {
    const a = L[name] || (L[name] = []);
    const v = 1 + (R() - 0.5) * hueJ * 2;
    a.push(x, y, z, R() * 6.283, s, tint * v, tint * (1 + (R() - 0.5) * hueJ), tint * v * (1 - (R() - 0.3) * hueJ));
  };
  // 带颜色的（秋天的蕨和灌木）
  const pushC = (name, x, y, z, s, c) => { const a = L[name] || (L[name] = []); const v = 0.9 + R() * 0.2; a.push(x, y, z, R() * 6.283, s, c[0] * v, c[1] * v, c[2] * v); };
  const FERN_AUT = [[3.0, 1.0, 0.45], [3.4, 0.72, 0.4], [2.4, 1.1, 0.45]], GRASS_AUT = [1.6, 1.15, 0.5];
  const treeNear = (x, z, r) => { const c = 6, gx = Math.floor(x / c), gz = Math.floor(z / c); let n = 0; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const a = occ.get((gx + i) + ',' + (gz + j)); if (a) for (const q of a) if ((q[0] - x) ** 2 + (q[1] - z) ** 2 < r * r) n++; } return n; };
  const dens = quality === 'low' ? 0.55 : quality === 'mid' ? 0.8 : 1;
  // 营地篝火周围和观景台长椅前是踩出来的空地（篝火位置和 props.js 里一致）
  const fireX = camp.x + 3.2 * camp.tz + 1.5 * camp.tx, fireZ = camp.z - 3.2 * camp.tx + 1.5 * camp.tz;
  const trodden = (x, z) => {
    const cd = Math.hypot(x - fireX, z - fireZ), bd = Math.hypot(x - view.x + 4.2, z - view.z + 0.6);
    if ((cd < 6.2 && R() > (cd - 3.4) / 2.8) || (bd < 2.6 && R() > (bd - 1.2) / 1.4)) return true;
    for (const c of CAMP_SITES) { const d = Math.hypot(x - c.x, z - c.z); if (d < 5.6 && R() > (d - 3) / 2.6) return true; }
    for (const v of VISTAS) { const d = Math.hypot(x - v.x, z - v.z); if (d < 3.4 && R() > (d - 1.6) / 1.8) return true; }
    return false;
  };
  const step = 1.3;
  for (let gz = DOM.z0 + 1; gz < DOM.z0 + DOM.d - 1; gz += step) for (let gx = DOM.x0 + 1; gx < DOM.x0 + DOM.w - 1; gx += step) {
    const x = gx + (R() - 0.5) * step, z = gz + (R() - 0.5) * step;
    const rd = land.roadDist(x, z); if (trodden(x, z)) continue;
    const far = rd > 70 && meadowK(x, z) < 0.01;  // 离路远的地方稀一点（但不是光秃秃的；花田不算）
    if (far && R() > (oldDom(x, z) ? 0.55 : 0.3)) continue;
    const sh = land.streamDist(x, z) < 30 ? shore(x, z) : 99;
    if (sh < 0.35 || onLake(x, z)) continue;
    const y = land.heightExact(x, z);
    const nrm = land.normal(x, z); const steep = 1 - nrm[1];
    // 雪地里只有几块石头
    const sn = land.snow(x, z);
    if (sn > 0.45) { if (R() < 0.012 && rd > 3.5) push(R() < 0.5 ? 'Rock_Medium_1' : 'Rock_Medium_2', x, y - 0.12, z, 0.2 + R() * 0.5, 1.05, 0.06); continue; }
    // 海里不长东西；沙滩上只有零星的石子、贝壳一样的小石头，靠里有几丛被海风吹黄的草
    if (y < SEA.y + 0.15) continue;
    const sa = land.sand(x, z);
    if (sa > 0.35) {
      const u2 = R();
      if (u2 < 0.012) push('Pebble_Round_2', x, y, z, 0.35 + R() * 0.6, 1.08, 0.1);
      else if (u2 < 0.016 && y > SEA.y + 0.6) push('Rock_Medium_2', x, y - 0.1, z, 0.12 + R() * 0.25, 1.05, 0.08);
      else if (u2 < 0.05 && y > SEA.y + 1.5 && sa < 0.85) pushC('Grass_Wispy_Tall', x, y, z, 0.28 + R() * 0.16, [1.5, 1.25, 0.62]);
      continue;
    }
    const tn = treeNear(x, z, 5);
    const bb = land.bamboo(x, z);
    if (bb > 0.3) {
      // 竹林底下：落了一层竹叶，蕨和矮草少少的
      const u2 = R();
      if (rd < 1.15) { if (u2 < 0.04 * dens) push('Pebble_Round_2', x, y, z, 0.5 + R() * 0.8, 1, 0.1); continue; }
      if (rd < 2.4 && u2 < 0.35 * dens) { push('Grass_Common_Short', x, y - 0.02, z, 0.28 + R() * 0.18, 0.9, 0.08); continue; }
      if (u2 < 0.07 * dens) { push('Fern_1', x, y, z, 0.1 + R() * 0.07, 1.0); continue; }
      if (u2 < 0.09 * dens) { push('Clover_2', x, y, z, 0.3 + R() * 0.15, 0.95); continue; }
      if (steep > 0.35 && u2 < 0.12) { push(R() < 0.5 ? 'Rock_Medium_1' : 'Rock_Medium_2', x, y - 0.15, z, 0.25 + R() * 0.45, 1, 0.08); continue; }
      continue;
    }
    const mk = meadowK(x, z), au = land.autumn(x, z);
    const flowerM = Math.max(sstep(0.5, 0.68, fbm(x * 0.02 + 40, z * 0.02, 3)), mk) * (1 - au) * (1 - sn);
    const u = R();
    if (au > 0.3 && R() < au) {
      // 红叶谷：枯黄的蕨、红灌木、蘑菇
      if (rd < 1.15) { if (u < 0.05 * dens) push('Pebble_Round_2', x, y, z, 0.5 + R() * 0.8, 1, 0.1); continue; }
      if (rd < 2.6 && u < 0.5 * dens) { pushC('Grass_Wispy_Tall', x, y - 0.02, z, 0.28 + R() * 0.2, GRASS_AUT); continue; }
      if (steep > 0.35 && u < 0.05) { push(R() < 0.5 ? 'Rock_Medium_1' : 'Rock_Medium_2', x, y - 0.15, z, 0.25 + R() * 0.45, 1, 0.08); continue; }
      if (u < (tn > 0 ? 0.16 : 0.07) * dens) { pushC('Fern_1', x, y, z, 0.11 + R() * 0.08, FERN_AUT[Math.floor(R() * 3)]); continue; }
      if (u < (tn > 0 ? 0.185 : 0.08) && rd > 4) { pushC('Bush_Common', x, y, z, 0.5 + R() * 0.5, autumnTint(R)); continue; }
      if (tn > 0 && u < 0.2) { push('Mushroom_Common', x, y, z, 0.35 + R() * 0.25, 1, 0.1); continue; }
      if (u < 0.24 * dens) { pushC('Grass_Wispy_Tall', x, y, z, 0.26 + R() * 0.14, GRASS_AUT); continue; }
      continue;
    }
    if (rd < 1.15) { if (u < 0.05 * dens) push('Pebble_Round_2', x, y, z, 0.5 + R() * 0.8, 1, 0.1); continue; }
    if (rd < 2.6 && u < 0.6 * dens) { push(R() < 0.7 ? 'Grass_Common_Short' : 'Grass_Wispy_Tall', x, y - 0.02, z, 0.3 + R() * 0.2, 1, 0.08); continue; }
    if (sh < 2.2 && u < 0.35 * dens) { push(R() < 0.5 ? 'Grass_Wispy_Tall' : 'Plant_1', x, y, z, 0.32 + R() * 0.2, 0.95); continue; }
    if (steep > 0.35 && u < 0.05) { push(R() < 0.5 ? 'Rock_Medium_1' : 'Rock_Medium_2', x, y - 0.15, z, 0.25 + R() * 0.45, 1, 0.08); continue; }
    if (tn > 0) {
      if (u < 0.12 * dens) push('Fern_1', x, y, z, 0.11 + R() * 0.07, 0.95);
      else if (u < 0.16 * dens) push('Clover_2', x, y, z, 0.35 + R() * 0.15);
      else if (u < 0.165) push('Mushroom_Common', x, y, z, 0.35 + R() * 0.25, 1, 0.1);
      else if (u < 0.19 && rd > 4) push(R() < 0.6 ? 'Bush_Common' : 'Bush_Common_Flowers', x, y, z, 0.55 + R() * 0.45, 0.95);
      continue;
    }
    if (u < 0.006 && rd > 4) { push(R() < 0.5 ? 'Bush_Common' : 'Bush_Common_Flowers', x, y, z, 0.5 + R() * 0.5); continue; }
    if (u < 0.006 + (0.07 + 0.5 * mk) * flowerM * dens) {
      // 花的颜色一小片一小片地变：紫、黄、杏色（大花）；粉、红（小花）
      const c = vnoise(x * 0.06 + 9, z * 0.06 - 3), big = R() < 0.55;
      const name = big ? (c < 0.4 ? 'Flower_4_Group' : c < 0.62 ? 'Flower_4_Group@y' : 'Flower_4_Group@p') : (c < 0.5 ? 'Flower_3_Group' : 'Flower_3_Group@r');
      push(name, x, y, z, 0.26 + R() * 0.14 + mk * 0.06, 1, 0.04); continue;
    }
    if (u < 0.05 + 0.03 * dens) { push('Grass_Common_Short', x, y - 0.02, z, 0.28 + R() * 0.2, 1, 0.08); continue; }
    if (u < 0.2 && R() < 0.35 * dens) { push(R() < 0.6 ? 'Clover_1' : 'Grass_Wispy_Tall', x, y, z, R() < 0.6 ? 0.32 : 0.26 + R() * 0.12); continue; }
    if (u < 0.205) { push('Rock_Medium_2', x, y - 0.1, z, 0.12 + R() * 0.2, 1, 0.1); continue; }
  }
  // 草丛：路两边 34 米内很密，再往外稀一些
  const tufts = [[], [], []];
  const ts = 0.78;
  for (let gz = DOM.z0 + 1; gz < DOM.z0 + DOM.d - 1; gz += ts) for (let gx = DOM.x0 + 1; gx < DOM.x0 + DOM.w - 1; gx += ts) {
    const x = gx + (R() - 0.5) * ts, z = gz + (R() - 0.5) * ts;
    const rd = land.roadDist(x, z); if (rd < 1.05 || trodden(x, z)) continue;
    const keep = (rd < 34 ? 0.85 : rd < 62 ? 0.35 : oldDom(x, z) ? 0.24 : 0.12) * dens * (rd < 1.6 ? 0.6 : 1) * (1 - 0.5 * meadowK(x, z));
    if (R() > keep) continue;
    if (land.streamDist(x, z) < 12 && shore(x, z) < 0.5) continue;
    if (R() < land.snow(x, z) * 2.2 - 0.3 || onLake(x, z)) continue;
    const y = land.heightExact(x, z) - 0.03;
    if (y < SEA.y + 0.4 || land.sand(x, z) > 0.3 || (land.bamboo(x, z) > 0.35 && rd > 2.2)) continue;
    const k = rd < 2.2 ? (R() < 0.5 ? 1 : 0) : R() < 0.55 ? 0 : R() < 0.6 ? 2 : 1;
    const sc = (0.8 + R() * 0.55) * (rd < 2.2 ? 1.15 : 1);
    tufts[k].push(x, y, z, R() * 6.283, sc, 1, 1, 1);
  }
  // 浅滩里的圆石：一路踩着过去
  for (let i = 0; i < 70; i++) {
    const s = SHOAL.s + (R() - 0.5) * 22, p = STREAM.at(s), w = bankW(s), d = (R() * 2 - 1) * w * 0.95;
    const x = p.x - p.tz * d, z = p.z + p.tx * d;
    const k = R(), peb = k > 0.75;
    push(peb ? 'Pebble_Round_2' : k < 0.4 ? 'Rock_Medium_1' : 'Rock_Medium_2', x, land.heightExact(x, z) - 0.04, z, peb ? 0.6 + R() * 0.8 : 0.12 + R() * 0.22, 1, 0.08);
  }
  // 溪里溪边的石头（山涧里多一些）
  for (let s = 0; s < STREAM.length; s += 2.2) {
    if (R() < (s < CREEK_END ? 0.2 : 0.55)) continue;
    const p = STREAM.at(s); if (!land.inside(p.x, p.z)) continue;
    const side = R() < 0.5 ? -1 : 1, d = bankW(s) * (0.4 + R() * 0.75);
    const x = p.x - p.tz * side * d, z = p.z + p.tx * side * d;
    push(R() < 0.5 ? 'Rock_Medium_1' : 'Rock_Medium_2', x, land.heightExact(x, z) - 0.05, z, 0.15 + R() * 0.3, 1, 0.08);
  }
  // 细草（world/meadow.js）长在哪：每个地面格点一个数（0 不长，255 长满）。规矩和上面的草丛一样：
  // 路上、踩出来的空地、水里和水边、沙滩、海里、雪地、冰湖、竹林深处不长；陡坡露岩石的地方也不长
  const NX = land.NX, NZ = land.NZ, grassMask = new Uint8Array(NX * NZ);
  const ramp = (a, b, v) => clamp((v - a) / (b - a), 0, 1);
  for (let iz = 0; iz < NZ; iz++) for (let ix = 0; ix < NX; ix++) {
    const x = DOM.x0 + ix * DOM.cell, z = DOM.z0 + iz * DOM.cell;
    const rd = land.roadDist(x, z);
    let k = ramp(1.0, 2.1, rd);
    if (k <= 0) continue;
    const y = land.H[iz * NX + ix];
    k *= ramp(SEA.y + 0.4, SEA.y + 1.0, y) * (1 - ramp(0.2, 0.36, land.sand(x, z))) * (1 - ramp(0.14, 0.4, land.snow(x, z)));
    if (k <= 0 || onLake(x, z)) continue;
    if (land.bamboo(x, z) > 0.35 && rd > 2.2) k *= 0.12;
    k *= 1 - ramp(0.24, 0.34, 1 - land.normal(x, z)[1]);
    if (k > 0 && land.streamDist(x, z) < 14) k *= ramp(0.45, 1.3, shore(x, z));
    k *= ramp(3.4, 6.2, Math.hypot(x - fireX, z - fireZ)) * ramp(1.2, 2.6, Math.hypot(x - view.x + 4.2, z - view.z + 0.6));
    for (const c of CAMP_SITES) k *= ramp(3, 5.6, Math.hypot(x - c.x, z - c.z));
    for (const v of VISTAS) k *= ramp(1.6, 3.4, Math.hypot(x - v.x, z - v.z));
    grassMask[iz * NX + ix] = Math.round(k * 255);
  }
  return { trees, nearCount, small: Object.fromEntries(Object.entries(L).map(([k, v]) => [k, new Float32Array(v)])), tufts: tufts.map(a => new Float32Array(a)), grassMask };
}

// 树冠遮挡图（给地面上的叶影用）+ 林下地面
export function canopyTexture(trees, land) {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
  const sx = S / DOM.w, sz = S / DOM.d;
  const grd = (x, y, r) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); return gr; };
  for (const t of trees) {
    if (t.far) continue;
    const x = (t.x - DOM.x0) * sx, y = (t.z - DOM.z0) * sz, r = 3.4 * t.s * sx * (t.t.startsWith('Pine') ? 0.8 : 1);
    g.fillStyle = grd(x, y, r); g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.flipY = false;
  // 林下：写进分区纹理的 A 通道
  return { tex: t, canvas: c };
}
export function forestFloor(splat, trees, land) {
  const NX = land.NX, NZ = land.NZ, d = splat.image.data;
  for (const t of trees) {
    if (t.far) continue;
    const r = 4.2 * t.s, gx0 = Math.max(0, Math.floor((t.x - r - DOM.x0) / DOM.cell)), gx1 = Math.min(NX - 1, Math.ceil((t.x + r - DOM.x0) / DOM.cell));
    const gz0 = Math.max(0, Math.floor((t.z - r - DOM.z0) / DOM.cell)), gz1 = Math.min(NZ - 1, Math.ceil((t.z + r - DOM.z0) / DOM.cell));
    for (let gz = gz0; gz <= gz1; gz++) for (let gx = gx0; gx <= gx1; gx++) {
      const x = DOM.x0 + gx * DOM.cell, z = DOM.z0 + gz * DOM.cell, q = Math.hypot(x - t.x, z - t.z) / r;
      if (q >= 1) continue;
      const k = (gz * NX + gx) * 4 + 3; d[k] = Math.min(255, d[k] + (1 - q * q) * 150);
    }
  }
  splat.needsUpdate = true;
}

// ---------- 远处的替身树：启动时把四种树从侧面画进一张图集 ----------
export function buildImpostors(renderer, models, mats, trees, fadeU) {
  const cellPx = 256, types = [...TREE_TYPES, 'Pine_2@s', 'Bamboo'], atlasW = cellPx * types.length;
  const rt = new THREE.WebGLRenderTarget(atlasW, cellPx, { samples: 0 });
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  const info = [];
  const prevClear = renderer.getClearColor(new THREE.Color()), prevAlpha = renderer.getClearAlpha(), prevTM = renderer.toneMapping;
  renderer.setClearColor(0x000000, 0);
  rt.viewport.set(0, 0, atlasW, cellPx); rt.scissorTest = false;
  renderer.setRenderTarget(rt); renderer.clear();
  renderer.toneMapping = THREE.NoToneMapping;
  types.forEach((t, i) => {
    const [base, vr] = t.split('@');
    const m = models[base];
    const w = Math.max(m.max[0] - m.min[0], m.max[2] - m.min[2]) * 1.02, h = (m.max[1] - m.min[1]) * 1.02;
    const half = Math.max(w, h) / 2, cy = (m.max[1] + m.min[1]) / 2;
    info.push({ w: half * 2, h: half * 2, cy, bottom: cy - half });
    scene.clear();
    for (const p of m.parts) {
      const src = mats[p.mat];
      const bm = new THREE.MeshBasicMaterial({ map: src.map, alphaTest: 0.42, side: THREE.DoubleSide, color: p.mat === 'bark' ? 0x9a8a7a : 0xd8d8d8 });
      // 雪松：朝上的松针白一些（和近处的真树一样）
      if (vr === 's' && p.mat === 'pine') bm.onBeforeCompile = sh => {
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSn; varying vec3 vSp;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvSn = normal; vSp = position;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vSn; varying vec3 vSp;').replace('#include <alphatest_fragment>', `#include <alphatest_fragment>
          diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.86, 0.9, 0.96 ), 0.9 * smoothstep( 0.0, 0.45, normalize( vSn ).y + 0.16 * sin( vSp.x * 3.1 + vSp.z * 2.3 + vSp.y * 5.0 ) + 0.1 * sin( vSp.y * 9.0 ) ) );`);
      };
      scene.add(new THREE.Mesh(p.geo, bm));
    }
    cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half; cam.position.set(0, cy, 50); cam.lookAt(0, cy, 0); cam.updateProjectionMatrix();
    rt.viewport.set(i * cellPx, 0, cellPx, cellPx); rt.scissor.set(i * cellPx, 0, cellPx, cellPx); rt.scissorTest = true;
    renderer.setRenderTarget(rt);
    renderer.render(scene, cam);
  });
  rt.scissorTest = false; rt.viewport.set(0, 0, atlasW, cellPx);
  renderer.setRenderTarget(null); renderer.setClearColor(prevClear, prevAlpha); renderer.toneMapping = prevTM;
  rt.texture.generateMipmaps = false;

  // 实例：每个一个面向镜头的竖片
  const n = trees.length;
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  const a0 = new Float32Array(n * 4), a1 = new Float32Array(n * 4), a2 = new Float32Array(n * 3).fill(1);
  trees.forEach((t, i) => {
    const ti = types.indexOf(t.t), I = info[ti];
    a0[i * 4] = t.x; a0[i * 4 + 1] = t.y + I.bottom * t.s; a0[i * 4 + 2] = t.z; a0[i * 4 + 3] = I.w * t.s;
    a1[i * 4] = ti; a1[i * 4 + 1] = I.h * t.s; a1[i * 4 + 2] = 0.9 + ((i * 7919) % 100) / 500; a1[i * 4 + 3] = t.far ? 1 : 0;
    if (t.tint) a2.set(t.tint, i * 3);
  });
  geo.setAttribute('aPos', new THREE.InstancedBufferAttribute(a0, 4));
  geo.setAttribute('aInfo', new THREE.InstancedBufferAttribute(a1, 4));
  geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(a2, 3));
  geo.instanceCount = n;
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...U, uAtlas: { value: rt.texture }, uCount: { value: types.length }, uFadeR: fadeU.trees },
    vertexShader: /* glsl */`
      attribute vec4 aPos; attribute vec4 aInfo; attribute vec3 aTint;
      uniform float uTime; uniform float uWind;
      varying vec2 vUv; varying vec3 vWP; varying float vTint; varying vec3 vRight; varying float vType; varying vec3 vTint3;
      void main() {
        vec3 base = aPos.xyz;
        vec3 toCam = cameraPosition - base; toCam.y = 0.0; toCam = normalize( toCam + vec3( 1e-4, 0.0, 0.0 ) );
        vec3 right = vec3( toCam.z, 0.0, -toCam.x );
        float sway = sin( uTime * 1.2 + base.x * 0.3 + base.z * 0.2 ) * 0.03 * position.y * uWind;
        vec3 wp = base + right * ( position.x * aPos.w + sway * aInfo.y ) + vec3( 0.0, position.y * aInfo.y, 0.0 );
        vWP = wp; vRight = right; vTint = aInfo.z; vType = aInfo.x; vTint3 = aTint;
        vUv = vec2( ( aInfo.x + uv.x ) / ${types.length.toFixed(1)}, uv.y );
        gl_Position = projectionMatrix * viewMatrix * vec4( wp, 1.0 );
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uAtlas; uniform float uFadeR; uniform vec3 uSunColor; uniform vec3 uAmb; uniform vec3 uAmbG;
      varying vec2 vUv; varying vec3 vWP; varying float vTint; varying vec3 vRight; varying float vType; varying vec3 vTint3;
      #include <common>
      ${FOG_FN}
      ${CLOUD_FN}
      float jDither() { return fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) ); }
      void main() {
        float fd = length( vWP.xz - cameraPosition.xz ) - uFadeR;
        if ( fd < ( jDither() - 0.5 ) * 6.0 ) discard;
        vec4 c = texture2D( uAtlas, vUv );
        if ( c.a < 0.45 ) discard;
        // 假装是一团球形树冠来打光
        vec2 q = vec2( fract( vUv.x * ${types.length.toFixed(1)} ) * 2.0 - 1.0, vUv.y * 2.0 - 1.15 );
        vec3 toCam = normalize( vec3( -vRight.z, 0.0, vRight.x ) );
        vec3 n = normalize( vRight * q.x + vec3( 0.0, 1.0, 0.0 ) * q.y + toCam * sqrt( max( 0.0, 1.0 - dot( q, q ) * 0.6 ) ) );
        float ndl = max( dot( n, uSunDir ), 0.0 );
        // 秋天的树：只给绿色的叶子上色（树干不变）
        vec3 alb = c.rgb * vTint * mix( vec3( 1.0 ), vTint3, smoothstep( 0.005, 0.04, c.g - c.r ) );
        float cl = jCloud( vWP );   // 头顶有云的地方太阳光暗下来
        vec3 col = alb * ( mix( uAmbG, uAmb, n.y * 0.5 + 0.5 ) * 0.95 + uSunColor * ndl * 1.6 * cl );
        vec3 vd = normalize( vWP - cameraPosition );
        col += uSunColor * alb * pow( max( dot( vd, uSunDir ), 0.0 ), 3.0 ) * 0.5 * cl;
        col = jFog( col, vWP );
        gl_FragColor = vec4( col, 1.0 );
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.DoubleSide,
  });
  return { geo, mat, info, rt };
}
