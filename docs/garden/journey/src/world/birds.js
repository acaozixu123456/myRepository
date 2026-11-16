// 鸟：花田、谷地、浅滩的草地上有一小群山雀在啄草籽，走近了（或者跑过来）呼啦一下全飞走；西湾海边有海鸥在浪头上绕圈。
// 都是自己捏的小三角形，一种鸟一个实例化网格，翅膀在着色器里扇（aFlap：频率、相位、幅度、张开多少）。
import * as THREE from 'three';
import { patch } from './atmo.js';

const rnd = (a, b) => a + Math.random() * (b - a);

// 一只鸟：身体是个拉长的菱形，两边各一片三角形的翅膀；aWing=1 的点是翅膀上的
function birdGeo(sz, body, wing, belly, span) {
  const P = [], C = [], Wg = [];
  const v = (x, y, z, c, w) => { P.push(x * sz, y * sz, z * sz); C.push(c.r, c.g, c.b); Wg.push(w); };
  const tri = (a, b, c, col, w) => { v(...a, col, w[0]); v(...b, col, w[1]); v(...c, col, w[2]); };
  const B = new THREE.Color(body), Wc = new THREE.Color(wing), Bl = new THREE.Color(belly);
  // 身体：前 (0,0,0.6) 后 (0,0,-0.7) 上 (0,0.18,0) 下 (0,-0.16,0) 左右 (±0.17,0,0)
  const f = [0, 0.02, 0.62], bk = [0, 0.03, -0.75], u = [0, 0.18, 0.05], d = [0, -0.17, 0.05], l = [-0.17, 0, 0.05], r = [0.17, 0, 0.05];
  const n = [0, 0, 0];
  tri(f, u, r, B, n); tri(f, l, u, B, n); tri(bk, r, u, B, n); tri(bk, u, l, B, n);
  tri(f, r, d, Bl, n); tri(f, d, l, Bl, n); tri(bk, d, r, Bl, n); tri(bk, l, d, Bl, n);
  // 尾巴
  tri([0, 0.03, -0.6], [-0.12, 0.02, -1.05], [0.12, 0.02, -1.05], Wc, n);
  // 翅膀（两面都画）
  for (const s of [-1, 1]) {
    const a = [s * 0.12, 0.06, 0.28], b = [s * 0.12, 0.06, -0.25], t = [s * span, 0.06, -0.32];
    tri(a, b, t, Wc, [0.15, 0.15, 1]); tri(a, t, b, Wc, [0.15, 1, 0.15]);
    const m = [s * span * 0.55, 0.06, 0.12];
    tri(a, t, m, Wc, [0.15, 1, 0.6]); tri(a, m, t, Wc, [0.15, 0.6, 1]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.setAttribute('aWing', new THREE.Float32BufferAttribute(Wg, 1));
  g.computeVertexNormals();
  return g;
}

function birdMesh(geo, n) {
  const flap = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
  flap.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aFlap', flap);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  mat.emissive.set(0.12, 0.11, 0.1);
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
      attribute vec4 aFlap; attribute float aWing;`).replace('#include <begin_vertex>', `#include <begin_vertex>
      {
        float f = sin( uTime * aFlap.x + aFlap.y ) * aFlap.z;
        float ax = abs( transformed.x );
        transformed.y += ax * f * aWing * 1.4;
        transformed.x *= mix( 1.0, aFlap.w, aWing );
        transformed.z -= ax * ( 1.0 - aFlap.w ) * aWing * 0.4;
      }`);
  };
  patch(mat, { rim: 0.3, gobo: false, fog: true });
  const m = new THREE.InstancedMesh(geo, mat, n);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.count = 0; m.frustumCulled = false; m.castShadow = false;
  return m;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _s = new THREE.Vector3(), _p = new THREE.Vector3();

export class Birds {
  // h: { groundAt(x,z), water(x,z), places }
  constructor(h) {
    this.h = h;
    this.group = new THREE.Group(); this.group.name = 'birds';
    this.tits = birdMesh(birdGeo(0.15, '#7d8a6a', '#4e5848', '#e2cf7a', 1.05), 36);
    this.gulls = birdMesh(birdGeo(0.62, '#f2f2ee', '#c9ccd2', '#fbfbf8', 1.6), 10);
    this.group.add(this.tits, this.gulls);
    const P = id => h.places.find(p => p.id === id);
    const sh = P('shoal');
    // 一小群山雀落脚的地方
    this.flocks = [
      { x: 10, z: -16, r: 7, n: 9 },
      { x: 68, z: -34, r: 9, n: 11 },
      { x: sh.x + 12, z: sh.z + 9, r: 6, n: 8 },
      { x: -70, z: 0, r: 7, n: 8 },
    ].map(f => ({ ...f, birds: null, gone: false }));
    // 海鸥绕圈的地方
    this.coasts = [{ x: -432, z: -45, r: 34, n: 5 }, { x: -446, z: -128, r: 26, n: 3 }].map(f => ({ ...f, birds: null }));
    this.checkT = 0; this.t = 0;
    this.onSeen = null;
  }
  update(dt, c) {
    this.t += dt;
    const { groundAt } = this.h;
    const h = c.tod, day = h > 6 && h < 18.6, calm = c.wx !== 'rain' && c.wx !== 'snow';
    this.checkT -= dt;
    if (this.checkT <= 0) {
      this.checkT = 0.6;
      for (const F of this.flocks) {
        const d = Math.hypot(F.x - c.p.x, F.z - c.p.z);
        if (!F.birds && !F.gone && day && calm && d < 120 && d > 30) {
          F.birds = [];
          for (let i = 0; i < F.n; i++) {
            const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * F.r, x = F.x + Math.cos(a) * r, z = F.z + Math.sin(a) * r;
            if (this.h.water(x, z) > 0.02) continue;
            F.birds.push({ p: new THREE.Vector3(x, groundAt(x, z), z), v: new THREE.Vector3(), yaw: Math.random() * 6.283, hop: rnd(0, 2), fly: false, delay: 0, ph: Math.random() * 6.283 });
          }
        }
        if (F.birds && (d > 160 || (!F.birds.some(b => b.fly) && !(day && calm)))) F.birds = null;
        if (d > 200) F.gone = false;
      }
      const gday = h > 5.6 && h < 19.6 && c.wx !== 'fog';
      for (const G of this.coasts) {
        const d = Math.hypot(G.x - c.p.x, G.z - c.p.z);
        if (!G.birds && gday && d < 260) {
          G.birds = [];
          for (let i = 0; i < G.n; i++) G.birds.push({ a: Math.random() * 6.283, r: G.r * rnd(0.6, 1.1), y: rnd(9, 17), w: rnd(0.12, 0.2) * (Math.random() < 0.5 ? 1 : -1), ph: Math.random() * 6.283, glide: 0 });
        }
        if (G.birds && (d > 300 || !gday)) G.birds = null;
      }
    }
    // ---- 山雀 ----
    let n = 0;
    const T = this.tits, fl = T.geometry.attributes.aFlap.array;
    for (const F of this.flocks) {
      if (!F.birds) continue;
      const d = Math.hypot(F.x - c.p.x, F.z - c.p.z);
      // 惊飞：走得太近、跑过来、飞过来
      const scare = d < F.r + 9 || (c.speed > 2.2 && d < F.r + 22) || (c.fly && d < F.r + 30 && c.alt < 30);
      if (scare && !F.birds[0]?.fly) {
        const ax = F.x - c.p.x, az = F.z - c.p.z, l = Math.hypot(ax, az) || 1;
        for (const b of F.birds) {
          b.fly = true; b.delay = rnd(0, 0.45); b.t = 0;
          const yaw = Math.atan2(ax / l, az / l) + rnd(-0.8, 0.8);
          b.v.set(Math.sin(yaw) * rnd(4.5, 7), rnd(2.2, 3.4), Math.cos(yaw) * rnd(4.5, 7)); b.yaw = yaw;
        }
        F.gone = true; c.onScare?.('birds');
      }
      if (!F.seen && d < 30) {
        _p.set(F.x - c.camPos.x, groundAt(F.x, F.z) + 0.3 - c.camPos.y, F.z - c.camPos.z).normalize();
        if (_p.dot(c.camFwd) > 0.8) { F.seen = true; this.onSeen?.('birds'); }
      }
      let alive = 0;
      for (const b of F.birds) {
        if (b.fly) {
          if (b.delay > 0) { b.delay -= dt; }
          else {
            b.t += dt; b.v.y = Math.max(b.v.y - dt * 0.4, 0.8);
            b.p.addScaledVector(b.v, dt);
          }
          if (b.t > 9) continue;
        } else {
          // 啄几下，跳一小步
          b.hop -= dt;
          if (b.hop < 0) { b.hop = rnd(0.6, 2.4); b.yaw += rnd(-1.4, 1.4); const s = rnd(0.08, 0.25); b.p.x += Math.sin(b.yaw) * s; b.p.z += Math.cos(b.yaw) * s; b.p.y = groundAt(b.p.x, b.p.z); b.jump = 0.18; }
        }
        alive++;
        const flying = b.fly && b.delay <= 0, peck = !b.fly && Math.sin(this.t * 7 + b.ph) > 0.6;
        let y = b.p.y + 0.04;
        if (b.jump > 0) { b.jump -= dt; y += Math.sin((0.18 - b.jump) / 0.18 * Math.PI) * 0.07; }
        _e.set(flying ? -0.25 : peck ? 0.5 : -0.1, b.yaw, 0); _q.setFromEuler(_e);
        _m.compose(_p.set(b.p.x, y, b.p.z), _q, _s.set(1, 1, 1)); T.setMatrixAt(n, _m);
        fl[n * 4] = flying ? 26 : 0; fl[n * 4 + 1] = b.ph; fl[n * 4 + 2] = flying ? 0.55 : 0; fl[n * 4 + 3] = flying ? 1 : 0.18;
        n++;
        if (n >= 36) break;
      }
      if (!alive && F.birds[0]?.fly) F.birds = null;
    }
    T.count = n; T.instanceMatrix.needsUpdate = true; T.geometry.attributes.aFlap.needsUpdate = true;
    // ---- 海鸥：绕着圈飞，扇几下滑一会儿 ----
    let m = 0;
    const Gm = this.gulls, gf = Gm.geometry.attributes.aFlap.array;
    for (const G of this.coasts) {
      if (!G.birds) continue;
      if (!G.seen && Math.hypot(G.x - c.p.x, G.z - c.p.z) < 75) {
        _p.set(G.x - c.camPos.x, 12 - c.camPos.y, G.z - c.camPos.z).normalize();
        if (_p.dot(c.camFwd) > 0.6) { G.seen = true; this.onSeen?.('gull'); }
      }
      for (const b of G.birds) {
        b.a += b.w * dt;
        b.glide -= dt; if (b.glide < -2.2) b.glide = rnd(1.5, 4);
        const x = G.x + Math.cos(b.a) * b.r, z = G.z + Math.sin(b.a) * b.r, y = b.y + Math.sin(this.t * 0.5 + b.ph) * 1.2;
        const yaw = Math.atan2(-Math.sin(b.a) * Math.sign(b.w), Math.cos(b.a) * Math.sign(b.w));
        _e.set(0, yaw, -Math.sign(b.w) * 0.3); _q.setFromEuler(_e);
        _m.compose(_p.set(x, y, z), _q, _s.set(1, 1, 1)); Gm.setMatrixAt(m, _m);
        gf[m * 4] = 9; gf[m * 4 + 1] = b.ph; gf[m * 4 + 2] = b.glide > 0 ? 0.04 : 0.42; gf[m * 4 + 3] = 1;
        m++;
      }
    }
    Gm.count = m; Gm.instanceMatrix.needsUpdate = true; Gm.geometry.attributes.aFlap.needsUpdate = true;
  }
  // 拍照：画面里有没有鸟
  inView(camera, out) {
    const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    for (const F of this.flocks) if (F.birds) for (const b of F.birds) if (b.p.distanceTo(camera.position) < 30 && fr.containsPoint(b.p)) { out.add('birds'); break; }
    for (const G of this.coasts) if (G.birds) for (const b of G.birds) {
      _p.set(G.x + Math.cos(b.a) * b.r, b.y, G.z + Math.sin(b.a) * b.r);
      if (_p.distanceTo(camera.position) < 70 && fr.containsPoint(_p)) { out.add('gull'); break; }
    }
    return out;
  }
}
