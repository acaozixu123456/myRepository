// 云鲸：在浮岛之间慢慢游的一头大鲸，绕着镜之原上空转圈。背是灰蓝的，肚皮发白，带一道道褶子。
// 身子是算出来的（一节一节的圆圈连成），尾巴的上下摆动、两只鳍的划动在着色器里做。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MIRROR } from './route.js';
import { patch } from './atmo.js';
import { vnoise, sstep, lerp } from './noise.js';

const L = 30;                      // 身长（米）；头朝 +z
export const WHALE_PATH = { x: -46, z: -452, r: 84, up: 66, T: 210 };   // 绕的圈：圆心、半径、比镜面高多少、一圈多少秒

function whaleGeo() {
  const NS = 44, NR = 22, pos = [], col = [], fin = [], idx = [], c = new THREE.Color();
  const BACK = new THREE.Color('#7f9db8'), BACK2 = new THREE.Color('#64839f'), BELLY = new THREE.Color('#efe9dc'), SPOT = new THREE.Color('#dfeaf2');
  // t：0 头 → 1 尾巴根
  const rad = t => 4.1 * Math.pow(Math.sin(Math.PI * Math.pow(Math.min(t, 0.999) * 0.94 + 0.03, 0.6)), 0.78) * (1 - 0.82 * sstep(0.45, 1, t)) + 0.28;
  for (let i = 0; i <= NS; i++) {
    const t = i / NS, r = rad(t), z = L * (0.5 - t);
    for (let j = 0; j < NR; j++) {
      const a = j / NR * 6.283, ca = Math.cos(a), sa = Math.sin(a);     // sa > 0 是背
      // 头：上面平一点，下巴鼓；身子：背窄肚宽
      const w = r * (1 + 0.08 * (1 - t)), h = r * (sa > 0 ? 0.78 + 0.1 * sstep(0.2, 0.6, t) : 0.92 - 0.2 * sstep(0.5, 1, t));
      const cap = i === 0 ? 0.25 : 1;
      pos.push(ca * w * cap, sa * h * cap - 0.4 * sstep(0, 0.4, t) * (1 - t), z + (i === 0 ? -0.4 : 0));
      const belly = sstep(0.05, -0.35, sa) * sstep(0.9, 0.55, t);
      const n = vnoise(a * 3 + 5, t * 14), n2 = vnoise(a * 9, t * 40 + 3);
      c.copy(BACK).lerp(BACK2, sstep(0.3, 0.8, n)).lerp(SPOT, sstep(0.62, 0.8, n2) * 0.6 * sstep(-0.1, 0.4, sa));
      // 肚皮上的褶子：从下巴到肚子中间
      const groove = 0.82 + 0.18 * sstep(-0.3, 0.3, Math.sin(a * 13)) ;
      c.lerp(BELLY, belly); if (belly > 0.5 && t < 0.52) c.multiplyScalar(groove);
      col.push(c.r, c.g, c.b); fin.push(0);
    }
  }
  for (let i = 0; i < NS; i++) for (let j = 0; j < NR; j++) {
    const a = i * NR + j, b = i * NR + (j + 1) % NR, d = a + NR, e = b + NR;
    idx.push(a, d, b, b, d, e);
  }
  // 头尖上封口
  const cap0 = pos.length / 3; pos.push(0, -0.1, L * 0.5 + 0.5); col.push(BACK.r, BACK.g, BACK.b); fin.push(0);
  for (let j = 0; j < NR; j++) idx.push(cap0, j, (j + 1) % NR);
  const body = new THREE.BufferGeometry();
  body.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); body.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); body.setAttribute('aFin', new THREE.Float32BufferAttribute(fin, 1));
  body.setIndex(idx); body.computeVertexNormals();
  // 扁片：尾鳍两叶、两只长长的胸鳍、背上一个小鳍。pts 是轮廓（x 往外、z 往前），按厚度做成中间鼓的薄片
  const flat = (pts, thick, place, finK) => {
    const sh = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1])));
    const g = new THREE.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: true, bevelThickness: thick * 0.9, bevelSize: thick * 1.2, bevelSegments: 2, curveSegments: 8, steps: 1 });
    g.translate(0, 0, -thick / 2); g.rotateX(Math.PI / 2);              // 轮廓放平：(x, y) → (x, z)
    place(g);
    const n = g.attributes.position.count, cc = new Float32Array(n * 3), ff = new Float32Array(n), P = g.attributes.position;
    for (let i = 0; i < n; i++) { c.copy(BACK2).lerp(BELLY, P.getY(i) < 0 && finK ? 0.25 : 0); cc[i * 3] = c.r; cc[i * 3 + 1] = c.g; cc[i * 3 + 2] = c.b; ff[i] = finK ? Math.sign(P.getX(i)) * Math.max(0, Math.abs(P.getX(i)) - 3.2) : 0; }
    g.setAttribute('color', new THREE.BufferAttribute(cc, 3)); g.setAttribute('aFin', new THREE.BufferAttribute(ff, 1)); g.deleteAttribute('uv');
    return g.index ? g.toNonIndexed() : g;
  };
  const parts = [body.toNonIndexed()];
  // 眼睛：头两侧偏下各一只小黑眼，上面一点白
  for (const s of [-1, 1]) {
    const t = 0.17, r = rad(t), a = -0.16, x = Math.cos(a) * r * (1 + 0.08 * (1 - t)) * s, y = Math.sin(a) * r * 0.92 - 0.4 * sstep(0, 0.4, t) * (1 - t), z = L * (0.5 - t);
    for (const [rr, colr, dx, dy] of [[0.3, '#1c2430', 0, 0], [0.09, '#ffffff', 0.2, 0.12]]) {
      const e = new THREE.IcosahedronGeometry(rr, 1); e.translate(x - s * (0.12 - dx), y + dy, z + (dx ? 0.1 : 0));
      const n = e.attributes.position.count, cc = new Float32Array(n * 3); c.set(colr); for (let i = 0; i < n; i++) { cc[i * 3] = c.r; cc[i * 3 + 1] = c.g; cc[i * 3 + 2] = c.b; }
      e.setAttribute('color', new THREE.BufferAttribute(cc, 3)); e.setAttribute('aFin', new THREE.BufferAttribute(new Float32Array(n), 1)); e.deleteAttribute('uv');
      parts.push(e.index ? e.toNonIndexed() : e);
    }
  }
  const zt = -L * 0.5;
  for (const s of [-1, 1]) {
    // 尾鳍的一叶
    parts.push(flat([[0, 0.6], [1.4 * s, 0.2], [3.6 * s, -0.7], [5.2 * s, -2.2], [5.0 * s, -2.9], [3.2 * s, -2.2], [1.2 * s, -1.7], [0, -1.3]], 0.16, g => g.translate(0, 0, zt + 0.4), 0));
    // 胸鳍：贴着身子两侧偏下，往后往外伸
    parts.push(flat([[0, 0.9], [2.2 * s, 0.7], [5.4 * s, -0.6], [8.4 * s, -3.2], [8.6 * s, -4.3], [7.2 * s, -4.4], [4.0 * s, -2.6], [1.2 * s, -1.3], [0, -1.0]], 0.2, g => { g.rotateZ(-0.32 * s); g.translate(3.3 * s, -1.9, L * 0.2); }, 1));
  }
  parts.push(flat([[0, 1.3], [1.1, -0.2], [1.35, -1.1], [0.35, -0.9], [0, -1.7]], 0.14, g => { g.rotateZ(Math.PI / 2); g.translate(0, 1.5, -L * 0.2); }, 0));
  const geo = mergeGeometries(parts);
  geo.computeBoundingSphere(); geo.boundingSphere.radius += 4;
  return geo;
}

export function buildWhale(land) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  // 游：一道从头传到尾的波，尾巴摆得最大；胸鳍慢慢上下划
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aFin;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          float wk = clamp( ( ${(L * 0.5).toFixed(1)} - position.z ) / ${L.toFixed(1)}, 0.0, 1.0 );
          float ph = uTime * 0.75;
          transformed.y += sin( ph - wk * 3.0 ) * ( 0.25 + 2.6 * wk * wk );
          transformed.y += abs( aFin ) * ( sin( ph * 0.9 + 1.2 ) * 0.34 - 0.12 );
          transformed.z -= abs( aFin ) * 0.08 * cos( ph * 0.9 + 1.2 );
        }`);
  };
  patch(mat, { rim: 0.35, gobo: false, fog: true, shadowFade: false });
  const mesh = new THREE.Mesh(whaleGeo(), mat);
  mesh.name = 'whale'; mesh.castShadow = false; mesh.receiveShadow = false;
  const g = new THREE.Group(); g.name = 'whale'; g.add(mesh);
  const W = WHALE_PATH, pos = g.position;
  // 这一圈上每个方向至少要多高（别蹭到山坡）
  const N = 48, minY = new Float32Array(N);
  for (let i = 0; i < N; i++) { const a = i / N * 6.283; let h = 0; for (const d of [-12, 0, 12]) h = Math.max(h, land.height(W.x + Math.cos(a) * (W.r + d), W.z + Math.sin(a) * (W.r + d))); minY[i] = h + 26; }
  const yAt = a => { const f = ((a / 6.283) % 1 + 1) % 1 * N, i = Math.floor(f) % N, j = (i + 1) % N, k = f - Math.floor(f); return Math.max(MIRROR.y + W.up, lerp(minY[i], minY[j], k * k * (3 - 2 * k))); };
  let y = null;
  g.userData.t = 40;
  g.userData.update = (dt) => {
    const t = (g.userData.t += dt), a = t / W.T * 6.283, e = 0.5;
    const yt = yAt(a) + 7 * Math.sin(t * 0.11);
    y = y === null ? yt : y + (yt - y) * Math.min(1, dt * 0.25);
    const y1 = yAt(a + e / W.r * 4) + 7 * Math.sin((t + 4) * 0.11);
    pos.set(W.x + Math.cos(a) * W.r, y, W.z + Math.sin(a) * W.r);
    // 头朝前进的方向（逆着 a 增大的切线），顺着高低抬头低头，转弯往里侧一点
    g.rotation.set(0, 0, 0);
    g.rotation.order = 'YXZ';
    g.rotation.y = Math.atan2(-Math.sin(a), Math.cos(a));
    g.rotation.x = -Math.max(-0.2, Math.min(0.2, (y1 - yt) * 0.03)) + 0.03 * Math.sin(t * 0.75);
    g.rotation.z = 0.1;
  };
  g.userData.update(0);
  return g;
}
