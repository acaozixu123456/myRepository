// 路上的东西：溪上木桥、山坡风车、木栅栏、路牌、观景台长椅、山口营地（帐篷、篝火）。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ROAD, SPOTS } from './route.js';
import { U, patch } from './atmo.js';
import { rng } from './noise.js';

// 把一堆盒子/圆柱合成一个网格（顶点色），一次绘制
class Kit {
  constructor() { this.geos = []; }
  add(geo, m, color, jitter = 0.06, r = Math.random) {
    geo = geo.index ? geo.toNonIndexed() : geo;
    geo.applyMatrix4(m);
    const c = new THREE.Color(color), n = geo.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i += 3) { const k = 1 + (r() - 0.5) * jitter; for (let j = 0; j < 3; j++) { col[(i + j) * 3] = c.r * k; col[(i + j) * 3 + 1] = c.g * k; col[(i + j) * 3 + 2] = c.b * k; } }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'color'].includes(k)) geo.deleteAttribute(k);
    this.geos.push(geo);
    return this;
  }
  box(w, h, d, m, color, jitter, r) { return this.add(new THREE.BoxGeometry(w, h, d), m, color, jitter, r); }
  cyl(r0, r1, h, seg, m, color, jitter, r) { return this.add(new THREE.CylinderGeometry(r0, r1, h, seg), m, color, jitter, r); }
  mesh(opts = {}) {
    const g = mergeGeometries(this.geos); g.computeBoundingSphere();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, ...opts.mat });
    patch(mat, { gobo: true, fog: true, ...opts.patch });
    const m = new THREE.Mesh(g, mat); m.castShadow = opts.cast !== false; m.receiveShadow = true;
    return m;
  }
}
const M4 = (x, y, z, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(1, 1, 1));
const WOOD = ['#8a5c38', '#7a5032', '#946640', '#6f4a2e'];

// ---------- 木桥：沿路架在溪上，桥面微微拱起 ----------
export function buildBridge(land) {
  const R = rng(77), k = new Kit();
  const br = land.bridge, s0 = br.s - br.half - 0.6, s1 = br.s + br.half + 0.6, rise = 0.22;
  const p = {};
  const deck = s => { const t = (s - s0) / (s1 - s0); return br.deckY + Math.sin(Math.PI * Math.min(1, Math.max(0, t))) * rise; };
  const width = 2.5;
  // 桥板
  for (let s = s0; s < s1; s += 0.36) {
    ROAD.at(s + 0.18, p); const y = deck(s + 0.18), yaw = Math.atan2(p.tx, p.tz);
    const slope = (deck(s + 0.4) - deck(s - 0.04)) / 0.44;
    k.box(width + (R() - 0.5) * 0.18, 0.09, 0.33, M4(p.x + (R() - 0.5) * 0.05, y - 0.045, p.z, -Math.atan(slope), yaw + (R() - 0.5) * 0.05), WOOD[(R() * 4) | 0], 0.1, R);
  }
  // 两侧纵梁、扶手、立柱
  for (const side of [-1, 1]) {
    for (let s = s0; s < s1 - 0.01; s += 1.0) {
      const sa = s, sb = Math.min(s1, s + 1.0);
      const a = ROAD.at(sa, {}), b = ROAD.at(sb, {});
      const na = [-a.tz, a.tx], ya = deck(sa), yb = deck(sb);
      const off = side * (width / 2 + 0.06);
      const ax = a.x + na[0] * off, az = a.z + na[1] * off, bx = b.x + na[0] * off, bz = b.z + na[1] * off;
      const len = Math.hypot(bx - ax, bz - az, yb - ya), yaw = Math.atan2(bx - ax, bz - az), pitch = -Math.atan2(yb - ya, Math.hypot(bx - ax, bz - az));
      k.box(0.16, 0.24, len + 0.02, M4((ax + bx) / 2, (ya + yb) / 2 - 0.14, (az + bz) / 2, pitch, yaw), '#5e3e26', 0.08, R);
      k.box(0.1, 0.1, len + 0.02, M4((ax + bx) / 2, (ya + yb) / 2 + 0.82, (az + bz) / 2, pitch, yaw), '#7a5234', 0.08, R);
      k.box(0.07, 0.07, len + 0.02, M4((ax + bx) / 2, (ya + yb) / 2 + 0.45, (az + bz) / 2, pitch, yaw), '#6e4a2e', 0.08, R);
    }
    for (let i = 0; i <= 5; i++) {
      const s = s0 + (s1 - s0) * i / 5; ROAD.at(s, p); const y = deck(s);
      const off = side * (width / 2 + 0.06);
      k.cyl(0.075, 0.09, 1.0, 7, M4(p.x - p.tz * off, y + 0.36, p.z + p.tx * off), '#5a3a22', 0.08, R);
      if (i === 0 || i === 5) k.cyl(0.11, 0.11, 0.09, 8, M4(p.x - p.tz * off, y + 0.9, p.z + p.tx * off), '#4d331f', 0.05, R);
      // 桥墩
      if (i > 0 && i < 5) {
        const gy = land.height(p.x - p.tz * off, p.z + p.tx * off);
        const hgt = y - 0.2 - gy + 0.5;
        if (hgt > 0.3) k.cyl(0.11, 0.13, hgt, 7, M4(p.x - p.tz * off * 0.92, gy - 0.5 + hgt / 2, p.z + p.tx * off * 0.92), '#4f3520', 0.08, R);
      }
    }
  }
  // 桥头的石头
  for (const s of [s0 - 0.3, s1 + 0.3]) for (const side of [-1, 1]) {
    ROAD.at(s, p); const off = side * (width / 2 + 0.25);
    const x = p.x - p.tz * off, z = p.z + p.tx * off, y = land.height(x, z);
    k.add(new THREE.DodecahedronGeometry(0.42, 0), M4(x, y + 0.1, z, R(), R(), R()).scale(new THREE.Vector3(1.1, 0.7, 1)), '#9a9286', 0.15, R);
  }
  const mesh = k.mesh();
  mesh.name = 'bridge';
  // 桥上的高度（马蹄要踩在桥面上）
  const heightAt = (x, z) => {
    const q = ROAD.nearest(x, z, 4);
    if (q.dist > width / 2 + 0.2 || q.s < s0 || q.s > s1) return null;
    return deck(q.s);
  };
  return { mesh, heightAt, s0, s1 };
}

// ---------- 风车：石头塔身、木头顶、四片帆慢慢转 ----------
export function buildWindmill(land) {
  const R = rng(5), k = new Kit();
  const x0 = 62, z0 = -118, y0 = land.height(x0, z0) - 0.3;
  const H = 7.2;
  // 塔身：一圈圈石头
  const rows = 14, around = 16;
  for (let j = 0; j < rows; j++) {
    const t = j / rows, r = 2.3 - 0.75 * t, y = y0 + t * H + H / rows / 2;
    for (let i = 0; i < around; i++) {
      const a = (i + (j % 2) * 0.5) / around * Math.PI * 2;
      const w = 2 * Math.PI * r / around * 1.04;
      const c = ['#d9cbb4', '#cbbba2', '#e4d7c1', '#bfae96'][(R() * 4) | 0];
      k.box(w, H / rows * 1.02, 0.36, M4(x0 + Math.sin(a) * r, y, z0 + Math.cos(a) * r, -0.1, a), c, 0.1, R);
    }
  }
  k.cyl(1.6, 2.35, H, 16, M4(x0, y0 + H / 2, z0), '#bfae96', 0.05, R);
  // 门和窗
  k.box(0.9, 1.6, 0.2, M4(x0 - 0.72, y0 + 0.85, z0 + 2.12, -0.1, -0.33), '#5a3a24', 0.05, R);
  k.box(0.5, 0.6, 0.2, M4(x0 - 0.5, y0 + 4.3, z0 + 1.82, -0.1, -0.3), '#3e2c22', 0.05, R);
  // 顶：木头圆锥
  k.cyl(0.0, 2.0, 2.1, 12, M4(x0, y0 + H + 1.0, z0), '#8a5a3a', 0.05, R);
  k.cyl(1.95, 1.95, 0.25, 12, M4(x0, y0 + H - 0.05, z0), '#6a4630', 0.05, R);
  const tower = k.mesh(); tower.name = 'windmill';
  // 帆：一个转动的组
  const sk = new Kit();
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    const m = new THREE.Matrix4().makeRotationZ(a);
    sk.add(new THREE.BoxGeometry(0.16, 5.6, 0.12).translate(0, 2.8, 0), m, '#6e4a30', 0.05, R);
    for (let j = 0; j < 7; j++) sk.add(new THREE.BoxGeometry(1.15, 0.05, 0.05).translate(0.5, 1.1 + j * 0.7, 0.02), m, '#7a5434', 0.05, R);
    sk.add(new THREE.BoxGeometry(1.0, 4.4, 0.02).translate(0.55, 3.3, 0.06), m, '#efe3cc', 0.04, R);
  }
  sk.cyl(0.32, 0.32, 0.5, 10, new THREE.Matrix4().makeRotationX(Math.PI / 2), '#5a3a26', 0.05, R);
  const sails = sk.mesh({ mat: { side: THREE.DoubleSide } }); sails.name = 'sails';
  const hub = new THREE.Group();
  // 帆面朝向路（西南），稍微仰一点
  const toRoad = Math.atan2(4 - x0, -118 - z0 + 30);
  hub.position.set(x0 + Math.sin(toRoad) * 2.2, y0 + H + 0.3, z0 + Math.cos(toRoad) * 2.2);
  hub.rotation.set(0, toRoad, 0, 'YXZ'); hub.rotateX(-0.12);
  hub.add(sails);
  const g = new THREE.Group(); g.add(tower, hub); g.name = 'windmill';
  g.userData.update = dt => { sails.rotation.z -= dt * 0.35 * U.uWind.value; };
  return g;
}

// ---------- 木栅栏：路边几段，弯弯曲曲的两根横木 ----------
export function buildFences(land) {
  const R = rng(31), k = new Kit();
  const runs = [[26, 96, 1, 3.4], [128, 140, -1, 3.2], [200, 226, 1, 3.6], [246, 268, -1, 3.5]];
  const p = {};
  for (const [a, b, side, off] of runs) {
    let prev = null;
    for (let s = a; s <= b; s += 2.6) {
      ROAD.at(s, p); const o = side * (off + (R() - 0.5) * 0.25);
      const x = p.x - p.tz * o, z = p.z + p.tx * o, y = land.height(x, z);
      k.cyl(0.06, 0.075, 1.15, 6, M4(x, y + 0.45, z, (R() - 0.5) * 0.08, R() * 3, (R() - 0.5) * 0.08), '#6e5038', 0.12, R);
      if (prev && R() > 0.06) {
        for (const h of [0.42, 0.82]) {
          const dx = x - prev[0], dz = z - prev[2], dy = (y - prev[1]), len = Math.hypot(dx, dz);
          k.box(0.06, 0.07, Math.hypot(len, dy) + 0.2, M4((x + prev[0]) / 2, (y + prev[1]) / 2 + h + (R() - 0.5) * 0.05, (z + prev[2]) / 2, -Math.atan2(dy, len), Math.atan2(dx, dz)), '#86664a', 0.12, R);
        }
      }
      prev = [x, y, z];
    }
  }
  // 路牌
  ROAD.at(SPOTS.start + 12, p);
  { const x = p.x + p.tz * 2.2, z = p.z - p.tx * 2.2, y = land.height(x, z), yaw = Math.atan2(p.tx, p.tz);
    k.cyl(0.07, 0.08, 1.9, 6, M4(x, y + 0.85, z), '#5e4430', 0.08, R);
    k.box(0.9, 0.22, 0.05, M4(x + Math.cos(yaw) * 0.25, y + 1.55, z - Math.sin(yaw) * 0.25, 0, yaw + Math.PI / 2 - 0.15), '#a8865c', 0.06, R);
    k.box(0.75, 0.2, 0.05, M4(x - Math.cos(yaw) * 0.2, y + 1.25, z + Math.sin(yaw) * 0.2, 0, yaw + Math.PI / 2 + 0.25), '#9a7a52', 0.06, R); }
  const m = k.mesh(); m.name = 'fences';
  return m;
}

// ---------- 帐篷：A 字形帆布 ----------
function buildTent(R) {
  const k = new Kit();
  const L = 2.6, W = 2.2, H = 1.65, N = 6;
  const quad = (pts) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.computeVertexNormals(); return g; };
  // 两面斜布，分几段让布面中间微微下垂
  for (const side of [-1, 1]) {
    const pts = [];
    for (let i = 0; i < N; i++) {
      const z0 = -L / 2 + L * i / N, z1 = -L / 2 + L * (i + 1) / N;
      const sag = t => 0.06 * Math.sin(Math.PI * (t + 0.5));
      const t0 = (i / N) - 0.5, t1 = ((i + 1) / N) - 0.5;
      const bx = side * W / 2, mx0 = side * (W / 4 - sag(t0)), mx1 = side * (W / 4 - sag(t1));
      const P = [[bx, 0, z0], [bx, 0, z1], [mx1, H / 2 - sag(t1), z1], [mx0, H / 2 - sag(t0), z0], [0, H, z1], [0, H, z0]];
      const tri = (a, b, c) => side > 0 ? pts.push(...P[a], ...P[b], ...P[c]) : pts.push(...P[a], ...P[c], ...P[b]);
      tri(0, 2, 1); tri(0, 3, 2); tri(3, 4, 2); tri(3, 5, 4);
    }
    k.add(quad(pts), new THREE.Matrix4(), side > 0 ? '#ead9b4' : '#dfcca6', 0.05, R);
  }
  k.add(quad([-W / 2, 0, -L / 2, 0, H, -L / 2, W / 2, 0, -L / 2]), new THREE.Matrix4(), '#d9c49c', 0.04, R);
  k.add(quad([-W / 2, 0, L / 2, -0.1, 0, L / 2 + 0.3, 0, H, L / 2]), new THREE.Matrix4(), '#d4bc92', 0.04, R);
  k.cyl(0.03, 0.03, H + 0.2, 5, M4(0, (H + 0.2) / 2, L / 2 + 0.02), '#5a3e28', 0.05, R);
  k.cyl(0.03, 0.03, H + 0.2, 5, M4(0, (H + 0.2) / 2, -L / 2 - 0.02), '#5a3e28', 0.05, R);
  k.cyl(0.025, 0.025, L + 0.3, 5, M4(0, H + 0.02, 0, Math.PI / 2), '#5a3e28', 0.05, R);
  return k.mesh({ mat: { side: THREE.DoubleSide } });
}

// ---------- 火焰：几片叠加的发光面片 + 火星 ----------
function buildFire(sparkTex) {
  const g = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime },
    vertexShader: /* glsl */`
      varying vec2 vUv; varying float vK;
      attribute float aK;
      uniform float uTime;
      void main() {
        vUv = uv; vK = aK;
        vec3 p = position;
        p.x += sin( uTime * 7.0 + aK * 9.0 + p.y * 4.0 ) * 0.05 * p.y;
        vec4 mv = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
        mv.xy += p.xy * vec2( 1.0, 1.0 + 0.15 * sin( uTime * 11.0 + aK * 5.0 ) );
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying vec2 vUv; varying float vK; uniform float uTime;
      void main() {
        vec2 q = vUv * 2.0 - 1.0;
        float w = 1.0 - smoothstep( 0.0, 1.0, abs( q.x ) / ( 1.0 - vUv.y * 0.85 + 0.05 ) );
        float h = 1.0 - smoothstep( 0.2, 1.0, vUv.y + 0.08 * sin( uTime * 13.0 + vK * 7.0 ) );
        float a = w * h * smoothstep( 0.0, 0.12, vUv.y );
        vec3 c = mix( vec3( 1.0, 0.36, 0.05 ), vec3( 1.0, 0.86, 0.45 ), w * ( 1.0 - vUv.y ) );
        gl_FragColor = vec4( c * 2.2 * a, a );
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  for (let i = 0; i < 4; i++) {
    const geo = new THREE.PlaneGeometry(0.55 - i * 0.07, 0.85 - i * 0.08).translate((i - 1.5) * 0.06, (0.85 - i * 0.08) / 2, 0);
    geo.setAttribute('aK', new THREE.Float32BufferAttribute(new Array(4).fill(i * 0.37), 1));
    const m = new THREE.Mesh(geo, mat); m.renderOrder = 5; m.frustumCulled = false; g.add(m);
  }
  // 火星
  const N = 40, pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) seed[i] = Math.random();
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const pm = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uMap: { value: sparkTex } },
    vertexShader: /* glsl */`
      attribute float aSeed; uniform float uTime; varying float vA;
      void main() {
        float t = fract( uTime * ( 0.25 + aSeed * 0.2 ) + aSeed );
        vec3 p = vec3( sin( aSeed * 40.0 + t * 3.0 ) * 0.25 * t, t * 2.6, cos( aSeed * 23.0 + t * 2.0 ) * 0.25 * t );
        vA = ( 1.0 - t ) * smoothstep( 0.0, 0.1, t );
        vec4 mv = modelViewMatrix * vec4( p, 1.0 );
        gl_PointSize = ( 2.0 + aSeed * 3.0 ) * 60.0 / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uMap; varying float vA;
      void main() { float a = texture2D( uMap, gl_PointCoord ).r * vA; gl_FragColor = vec4( vec3( 1.0, 0.62, 0.25 ) * a * 2.0, a ); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(pg, pm); pts.frustumCulled = false; pts.renderOrder = 6; g.add(pts);
  const light = new THREE.PointLight('#ff9a4a', 0, 14, 1.6); light.position.y = 0.6; g.add(light);
  g.userData.light = light;
  g.userData.update = (t, on) => { light.intensity = on * (5.5 + Math.sin(t * 9) * 0.8 + Math.sin(t * 23) * 0.5 + Math.sin(t * 3.1) * 0.6); };
  return g;
}

// ---------- 营地和观景台 ----------
export async function buildCamp(land, base) {
  const L = new GLTFLoader();
  const load = f => L.loadAsync(base + 'props/' + f).then(g => g.scene);
  const [stones, logs, stump, bench, lantern, sparkTex] = await Promise.all([
    load('campfire_stones.glb'), load('log_stack.glb'), load('stump_round.glb'), load('bench.glb'), load('lantern-hanging.glb'),
    new THREE.TextureLoader().loadAsync(base + 'props/spark_01.png'),
  ]);
  const prep = (o, s = 1) => {
    o.scale.setScalar(s);
    o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; const old = m.material; m.material = new THREE.MeshLambertMaterial({ color: old.color, map: old.map, vertexColors: !!m.geometry.attributes.color }); patch(m.material, { gobo: true, fog: true }); } });
    return o;
  };
  const R = rng(3);
  const g = new THREE.Group(); g.name = 'camp';
  const c = ROAD.at(SPOTS.camp, {});
  const yaw = Math.atan2(c.tx, c.tz);
  // 营地在路左边一点的空地上
  const fx = c.x - c.tz * -3.2 + c.tx * 1.5, fz = c.z + c.tx * -3.2 + c.tz * 1.5;
  const at = (dx, dz) => { const x = fx + Math.cos(yaw) * dx + Math.sin(yaw) * dz, z = fz - Math.sin(yaw) * dx + Math.cos(yaw) * dz; return [x, land.height(x, z), z]; };
  const place = (o, dx, dz, ry = 0, dy = 0) => { const [x, y, z] = at(dx, dz); o.position.set(x, y + dy, z); o.rotation.y = yaw + ry; g.add(o); return o; };
  const fire = place(prep(stones, 1.1), 0, 0);
  const logsO = place(prep(logs, 0.9), 0, 0.02, 0.4, 0.02); logsO.scale.setScalar(0.55);
  const flames = buildFire(sparkTex); place(flames, 0, 0, 0, 0.12);
  // 坐标：dx 往路的左边（离路更远），dz 沿路往前
  const seatO = place(prep(stump.clone(), 1.3), 1.7, 0.5, 0.3);
  place(prep(stump, 1.1), -1.1, 1.5, 1.2);
  const tent = buildTent(R); place(tent, 3.3, -2.4, -0.5);
  // 挂灯的杆子
  const pole = new Kit().cyl(0.04, 0.05, 2.2, 6, M4(0, 1.1, 0), '#5a3e28').box(0.5, 0.04, 0.04, M4(0.22, 2.1, 0), '#5a3e28').mesh();
  place(pole, 1.2, -2.2, 0.2);
  const lan = prep(lantern, 1.0); place(lan, 1.2 + 0.22 * Math.cos(0.2), -2.2 - 0.22 * Math.sin(0.2), 0.2, 1.75);
  const lanLight = new THREE.PointLight('#ffc47a', 0, 6, 1.8); lanLight.position.set(0, 0.0, 0); lan.add(lanLight);
  // 观景台：长椅朝着溪谷和夕阳
  const v = ROAD.at(SPOTS.view, {});
  const bx = v.x - 4.2, bz = v.z - 0.6;
  const b = prep(bench, 1.15); b.position.set(bx, land.height(bx, bz), bz); b.rotation.y = Math.atan2(-0.27, -0.96) + Math.PI; g.add(b);
  // 小石堆
  const cairn = new Kit();
  for (let i = 0; i < 5; i++) cairn.add(new THREE.DodecahedronGeometry(0.28 - i * 0.04, 0), M4(0, 0.15 + i * 0.2, 0, R(), R(), R()).scale(new THREE.Vector3(1.2, 0.7, 1)), ['#a59c8e', '#8f877b', '#b5ad9f'][i % 3], 0.1, R);
  const cm = cairn.mesh(); cm.position.set(v.x - 2.4, land.height(v.x - 2.4, v.z + 1.6), v.z + 1.6); g.add(cm);
  g.userData.fire = flames; g.userData.fireAt = new THREE.Vector3(...at(0, 0));
  g.userData.seat = new THREE.Vector3(...at(1.7, 0.5));
  g.updateMatrixWorld(true);
  g.userData.seatTop = new THREE.Box3().setFromObject(seatO).max.y;
  flames.visible = false;
  g.userData.lanLight = lanLight;
  g.userData.yaw = yaw;
  return g;
}
