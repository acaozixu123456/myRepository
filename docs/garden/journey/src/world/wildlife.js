// 路上的动物：小鹿、大角鹿、狐狸、雪狐（Quaternius Ultimate Animated Animals，CC0）。
// 每种动物有几处常去的地方（HABITATS），按钟点和天气出现：走到一百多米内才放出来，走远了收回去，同时最多几只，手机上不费事。
// 它们自己吃草、抬头看、溜达；怕快的东西 —— 跑步、骑马小跑、低空飞过来就一溜烟跑开，散步慢慢走近就只是抬头看着你。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { toCreasedNormals, mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { patch } from './atmo.js';

const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const rnd = (a, b) => a + Math.random() * (b - a);

// walkRef / runRef：动作原速对应的移动速度（米/秒），用来让脚步对上
// far：跑步、骑快了在这个距离里就会惊；near：再慢也不能比这更近；calm：低于这个速度走过来不怕
export const SPECIES = {
  deer: { file: 'deer.glb', name: '小鹿', scale: 0.35, walk: 0.9, run: 8, walkRef: 1.25, runRef: 7.5, far: 28, near: 6, calm: 1.95, r: 0.5 },
  stag: { file: 'stag.glb', name: '大角鹿', scale: 0.4, walk: 1.0, run: 8, walkRef: 1.45, runRef: 8.5, far: 32, near: 8, calm: 1.95, r: 0.6 },
  fox: { file: 'fox.glb', name: '狐狸', scale: 0.2, walk: 0.8, run: 6.5, walkRef: 0.75, runRef: 4.5, far: 24, near: 5, calm: 1.4, r: 0.3 },
  snowfox: { file: 'fox.glb', name: '雪狐', scale: 0.2, walk: 0.8, run: 6.5, walkRef: 0.75, runRef: 4.5, far: 24, near: 5, calm: 1.4, r: 0.3, white: true },
};

// 常去的地方：n = [最少, 最多] 几只；when(钟点, 天气)
export function makeHabitats(places) {
  const P = id => places.find(p => p.id === id);
  const au = P('autumn'), bm = P('bamboo'), ps = P('pass');
  const dayish = h => h > 5.2 && h < 19.8;
  return [
    { id: 'deerEast', sp: 'deer', x: 92, z: -30, r: 24, n: [2, 3], when: (h, w) => ((h > 5.2 && h < 10.5) || (h > 15.4 && h < 20.3)) && w !== 'rain' },
    { id: 'deerMill', sp: 'deer', x: 36, z: -146, r: 16, n: [1, 2], when: (h, w) => h > 6.5 && h < 18.6 && w !== 'rain' },
    { id: 'deerWest', sp: 'deer', x: -150, z: -168, r: 20, n: [1, 2], when: dayish },
    { id: 'stagAutumn', sp: 'stag', x: au.x + 14, z: au.z + 16, r: 16, n: [1, 1], when: (h, w) => (h > 5 && h < 10.5) || w === 'fog' },
    { id: 'foxBamboo', sp: 'fox', x: bm.x + 10, z: bm.z - 16, r: 18, n: [1, 1], when: h => h > 17.2 || h < 5.6 },
    { id: 'foxWest', sp: 'fox', x: -132, z: -150, r: 18, n: [1, 1], when: h => h > 18.6 || h < 5 },
    { id: 'snowPass', sp: 'snowfox', x: ps.x + 12, z: ps.z - 8, r: 18, n: [1, 1], when: (h, w) => w === 'snow' || (h > 5 && h < 7.6) },
    { id: 'snowLake', sp: 'snowfox', x: -410, z: -545, r: 18, n: [1, 1], when: (h, w) => w === 'snow' },
  ];
}

// 一种动物的模型：材质换成和坐骑一样的（边缘光、树影、雾），法线按折角重算。
// 原模型一只动物有四到七种颜色、各是一块网格，每块都要单独画一遍（再加一遍影子）；这里按颜色写进顶点色，合成一块网格、一个材质，一只动物只画一次。
// 雪狐和狐狸共用模型，另存一份白色的顶点色。
const tone = (c, name) => {
  // 原色太艳：毛色压一点饱和度、暗一点，和这边的画面放在一起不扎眼
  if (/^Main|^Material/.test(name)) { const l = c.r * 0.3 + c.g * 0.55 + c.b * 0.15; c.lerp(new THREE.Color(l, l, l), 0.28).multiplyScalar(0.86); }
  return c;
};
const WHITE = new THREE.Color(0.93, 0.94, 0.97);
let animalMat = null;
function sharedMat() {
  if (animalMat) return animalMat;
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, emissive: new THREE.Color(1, 1, 1) });
  // 微微自发光，跟着各处的颜色走
  m.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance *= diffuseColor.rgb * 0.1;'); };
  patch(m, { rim: 0.6, gobo: true, fog: true });
  return (animalMat = m);
}
async function loadSpecies(res, sp) {
  const S = SPECIES[sp];
  const g = await new GLTFLoader().loadAsync(res + S.file);
  const groups = new Map();      // 同一副骨骼的几块网格合在一起
  g.scene.traverse(o => {
    if (!o.isSkinnedMesh) return;
    const k = o.skeleton; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(o);
  });
  for (const list of groups.values()) {
    const geos = [], white = [];
    for (const o of list) {
      let geo = toCreasedNormals(o.geometry, Math.PI / 3);
      for (const n of Object.keys(geo.attributes)) if (!/^(position|normal|skinIndex|skinWeight)$/.test(n)) geo.deleteAttribute(n);
      const c = tone(o.material.color.clone(), o.material.name), n = geo.attributes.position.count;
      const w = c.clone().lerp(WHITE, /Eye|Black/i.test(o.material.name) ? 0 : 0.85);
      const col = new Float32Array(n * 3), colW = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { col.set([c.r, c.g, c.b], i * 3); colW.set([w.r, w.g, w.b], i * 3); }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geos.push(geo);
      const gw = geo.clone(); gw.setAttribute('color', new THREE.BufferAttribute(colW, 3)); white.push(gw);
    }
    const first = list[0];
    const merged = mergeGeometries(geos);
    if (!merged) { console.warn('[j] animal merge failed', sp); continue; }
    const mesh = new THREE.SkinnedMesh(merged, sharedMat());
    mesh.name = 'body'; mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
    mesh.position.copy(first.position); mesh.quaternion.copy(first.quaternion); mesh.scale.copy(first.scale);
    mesh.bind(first.skeleton, first.bindMatrix);
    (g.white ||= new Map()).set(merged, mergeGeometries(white));
    first.parent.add(mesh);
    for (const o of list) o.parent.remove(o);
  }
  return g;
}

const _v = new THREE.Vector3();

export class Wildlife {
  // h: { res, groundAt(x,z), water(x,z) 水深, colliders, places }
  constructor(h) {
    this.h = h;
    this.group = new THREE.Group(); this.group.name = 'wildlife';
    this.habitats = makeHabitats(h.places);
    this.models = {}; this.loading = {};
    this.pool = {}; this.live = [];
    this.checkT = 0;
    this.onSeen = null;       // (species, animal) 第一次看清楚
    this.onFlee = null;       // 第一次把动物吓跑
  }
  load(sp) {
    const S = SPECIES[sp];
    if (this.models[S.file] || this.loading[S.file]) return;
    this.loading[S.file] = loadSpecies(this.h.res, sp).then(g => { this.models[S.file] = g; }).catch(e => console.warn('[j] wildlife', sp, e));
  }
  // 预先下载（出发后空闲时）
  preload() { for (const sp of ['deer', 'fox', 'stag']) this.load(sp); }
  make(sp) {
    const S = SPECIES[sp], g = this.models[S.file];
    if (!g) { this.load(sp); return null; }
    const free = this.pool[sp]?.pop();
    if (free) return free;
    const model = SkeletonUtils.clone(g.scene);
    // 雪狐：换成白色的那份顶点色
    if (S.white) model.traverse(o => { if (o.isSkinnedMesh && g.white?.has(o.geometry)) o.geometry = g.white.get(o.geometry); });
    model.scale.setScalar(S.scale);
    const root = new THREE.Group(); root.add(model); root.name = 'animal-' + sp;
    const mixer = new THREE.AnimationMixer(model), act = {};
    for (const c of g.animations) { const a = mixer.clipAction(c); act[c.name] = a; }
    return { sp, S, root, mixer, act, cur: null, p: new THREE.Vector3(), yaw: 0, speed: 0, state: 'idle', t: 0, goal: null, lod: 0, seen: false };
  }
  play(A, name, fade = 0.4) {
    if (A.cur === name || !A.act[name]) return;
    const next = A.act[name], prev = A.cur && A.act[A.cur];
    next.reset(); next.setEffectiveTimeScale(1); next.setEffectiveWeight(1); next.play();
    // 同一个动作每只的起点错开，不会整齐划一
    next.time = Math.random() * next.getClip().duration;
    if (prev) prev.crossFadeTo(next, fade, false); else next.fadeIn(0.01);
    A.cur = name;
  }
  // 在这片地方里找一块能站的地（不在水里、不太陡、不卡在树干里）
  spot(H, out) {
    const { groundAt, water, colliders } = this.h;
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * H.r;
      const x = H.x + Math.cos(a) * r, z = H.z + Math.sin(a) * r;
      if (water(x, z) > 0.05) continue;
      const sl = Math.abs(groundAt(x + 1.5, z) - groundAt(x - 1.5, z)) + Math.abs(groundAt(x, z + 1.5) - groundAt(x, z - 1.5));
      if (sl > 2.2) continue;
      if (colliders.count(x, z, 1.4)) continue;
      return out.set(x, groundAt(x, z), z);
    }
    return null;
  }
  spawn(H) {
    const n = H.n[0] + Math.floor(Math.random() * (H.n[1] - H.n[0] + 1)), list = [];
    for (let i = 0; i < n; i++) {
      const A = this.make(H.sp); if (!A) break;
      if (!this.spot(H, A.p)) { (this.pool[H.sp] ||= []).push(A); continue; }
      A.H = H; A.yaw = Math.random() * 6.283; A.speed = 0; A.state = 'graze'; A.t = rnd(2, 8); A.goal = null; A.fleeT = 0; A.seen = false;
      A.cur = null; A.mixer.stopAllAction(); this.play(A, Math.random() < 0.6 ? 'Eating' : 'Idle', 0.01);
      this.group.add(A.root); this.live.push(A); list.push(A);
    }
    H.group = list;
  }
  despawn(H) {
    for (const A of H.group || []) {
      this.group.remove(A.root);
      this.live.splice(this.live.indexOf(A), 1);
      (this.pool[A.sp] ||= []).push(A);
    }
    H.group = null;
  }
  // c: { p 旅人位置, speed, fly, alt, tod, wx, camPos, camFwd }
  update(dt, c) {
    this.checkT -= dt;
    if (this.checkT <= 0) {
      this.checkT = 0.5;
      for (const H of this.habitats) {
        const d = Math.hypot(H.x - c.p.x, H.z - c.p.z), want = H.when(c.tod, c.wx);
        if (!H.group) {
          // 进到一百七十米内就放出来；走开一次以后才会换一批（不会一直刷新）
          if (want && d < 170 && !H.cool) this.spawn(H);
          if (d > 230) H.cool = false;
        } else {
          const far = H.group.every(A => A.p.distanceTo(c.p) > 70);
          if (d > 230 || (!want && far)) { this.despawn(H); if (d <= 230) H.cool = true; }
        }
      }
    }
    for (const A of this.live) this.tick(A, dt, c);
  }
  tick(A, dt, c) {
    const S = A.S, { groundAt, water, colliders } = this.h;
    const dx = A.p.x - c.p.x, dz = A.p.z - c.p.z, dp = Math.hypot(dx, dz);
    // 怕不怕：跑过来、骑快了、飞得低，或者实在太近了
    const fast = c.fly ? c.alt < 22 && dp < S.far * 1.2 : c.speed > S.calm && dp < S.far;
    if (A.state !== 'flee' && (fast || dp < S.near * (c.fly ? 2 : 1))) {
      A.state = 'flee'; A.t = rnd(4.5, 6.5); A.fleeYaw = Math.atan2(dx, dz) + rnd(-0.5, 0.5);
      // 同一群的一起跑
      for (const B of A.H.group || []) if (B !== A && B.state !== 'flee') { B.state = 'flee'; B.t = rnd(4.5, 6.5); B.fleeYaw = A.fleeYaw + rnd(-0.35, 0.35); }
      this.onFlee?.(A);
    }
    A.t -= dt;
    let vT = 0, yawT = A.yaw;
    if (A.state === 'flee') {
      vT = S.run; yawT = A.fleeYaw;
      if (A.t <= 0 && dp > S.far + 6) { A.state = 'walk'; A.t = rnd(3, 6); A.goal = null; }
      else if (A.t <= -6) { A.state = 'walk'; A.t = rnd(3, 6); A.goal = null; }
    } else if (dp < S.far * 1.4 && (c.speed > 0.05 || (A.state === 'look' && A.t > 0))) {
      // 有人走过来：停下来，转过来看着；人站住不动一会儿，它就接着低头吃草
      if (A.state !== 'look') { A.state = 'look'; A.t = rnd(2.5, 4.5); }
      yawT = Math.atan2(-dx, -dz);
    } else if (A.state === 'look' && A.t <= 0) { A.state = 'graze'; A.t = rnd(4, 9); }
    else if (A.state === 'graze' && A.t <= 0) {
      A.state = Math.random() < 0.55 ? 'walk' : 'idle'; A.t = rnd(3, 7); A.goal = null;
    } else if (A.state === 'idle' && A.t <= 0) { A.state = Math.random() < 0.6 ? 'graze' : 'walk'; A.t = rnd(4, 9); A.goal = null; }
    if (A.state === 'walk') {
      if (!A.goal) A.goal = this.spot(A.H, new THREE.Vector3()) || A.p.clone();
      const gx = A.goal.x - A.p.x, gz = A.goal.z - A.p.z, gd = Math.hypot(gx, gz);
      yawT = Math.atan2(gx, gz); vT = gd > 1 ? S.walk : 0;
      if (gd < 1 || A.t < -8) { A.state = 'graze'; A.t = rnd(5, 10); A.goal = null; }
    }
    // 转身、加减速
    const turnR = A.state === 'flee' ? 3.5 : 1.6;
    const dy = clamp(wrap(yawT - A.yaw), -turnR * dt, turnR * dt); A.yaw += dy;
    A.speed = damp(A.speed, vT * (Math.abs(wrap(yawT - A.yaw)) > 1.4 ? 0.3 : 1), A.state === 'flee' ? 3 : 2.2, dt);
    if (A.speed > 0.02) {
      let nx = A.p.x + Math.sin(A.yaw) * A.speed * dt, nz = A.p.z + Math.cos(A.yaw) * A.speed * dt;
      // 不下水：碰到水就掉头
      if (water(nx, nz) > 0.15) { A.yaw += Math.PI * 0.6; A.fleeYaw = A.yaw; nx = A.p.x; nz = A.p.z; }
      const r = colliders.resolve(nx, nz, S.r, 0); nx = r[0]; nz = r[1];
      A.p.set(nx, groundAt(nx, nz), nz);
    }
    // 动作
    if (A.state === 'flee') this.play(A, 'Gallop', 0.25);
    else if (A.speed > 0.25) this.play(A, 'Walk', 0.4);
    else if (A.state === 'look') this.play(A, 'Look', 0.5);
    else if (A.state === 'idle') this.play(A, 'Idle', 0.5);
    else if (A.state === 'graze') this.play(A, 'Eating', 0.6);
    if (A.cur === 'Walk') A.act.Walk.setEffectiveTimeScale(clamp(A.speed / S.walkRef, 0.4, 1.8));
    if (A.cur === 'Gallop') A.act.Gallop.setEffectiveTimeScale(clamp(A.speed / S.runRef, 0.6, 1.6));
    // 远了就不画、动作也隔几帧才算一次
    const cd = A.p.distanceTo(c.camPos);
    A.root.visible = cd < 150;
    if (A.root.visible) {
      A.lodT = (A.lodT || 0) + dt;
      const every = cd < 45 ? 0 : cd < 90 ? 1 / 20 : 1 / 10;
      if (A.lodT >= every) { A.mixer.update(A.lodT); A.lodT = 0; }
      A.root.position.copy(A.p); A.root.rotation.set(0, A.yaw, 0);
    }
    // 第一次看清楚：离镜头不远、在画面中间一块
    if (!A.seen && cd < (A.sp.endsWith('fox') ? 34 : 42)) {
      _v.copy(A.p).sub(c.camPos); _v.y += 0.5; _v.normalize();
      if (_v.dot(c.camFwd) > 0.82 && this.clearLine(c.camPos, A.p)) { A.seen = true; this.onSeen?.(A.sp, A); }
    }
  }
  // 镜头到动物之间没被山坡挡住
  clearLine(a, p) {
    for (let i = 1; i < 8; i++) {
      const t = i / 8, x = a.x + (p.x - a.x) * t, z = a.z + (p.z - a.z) * t, y = a.y + (p.y + 0.6 - a.y) * t;
      if (this.h.groundAt(x, z) > y + 0.2) return false;
    }
    return true;
  }
  // 拍照时：画面里看得清的动物（种类）
  inView(camera, maxD = 45) {
    const out = new Set(), m = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse), fr = new THREE.Frustum().setFromProjectionMatrix(m);
    for (const A of this.live) {
      if (!A.root.visible) continue;
      _v.copy(A.p); _v.y += 0.6;
      if (_v.distanceTo(camera.position) < maxD && fr.containsPoint(_v) && this.clearLine(camera.position, A.p)) out.add(A.sp);
    }
    return out;
  }
}
