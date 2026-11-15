// 马和骑手。两匹马对外接口一样：root（放到路上）、seat（骑手坐的位置，跟着马背动）、update(dt, state)、onStep。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { buildHorseB, makeSkeleton, X } from '../horse/horseB.js';
import { HorseRigB } from '../horse/rigB.js';
import { patch } from '../world/atmo.js';

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// ---------- B 马：自己捏的圆润小马 ----------
export function makeHorseB() {
  const geo = buildHorseB();
  const sk = makeSkeleton();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.74, metalness: 0 });
  patch(mat, { rim: 0.7, gobo: true, fog: true });
  const mesh = new THREE.SkinnedMesh(geo, mat);
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  mesh.add(sk.bones.body); mesh.bind(new THREE.Skeleton(sk.list));
  const root = new THREE.Group(); root.add(mesh); root.name = 'horseB';
  const rig = new HorseRigB(mesh, sk.bones, sk.rest);
  // 马鞍上的座位：挂在 body 骨骼上
  const seat = new THREE.Object3D();
  const body = sk.rest.body, saddle = X([0, 1.31, 0.02]);
  seat.position.set(saddle[0] - body[0], saddle[1] - body[1] + 0.02, saddle[2] - body[2]);
  sk.bones.body.add(seat);
  // 缰绳挂点：嘴边两侧
  const bit = [];
  for (const s of [1, -1]) {
    const o = new THREE.Object3D(); const hp = X([0.074 * s, 1.40, 1.205], true), hb = sk.rest.head;
    o.position.set(hp[0] - hb[0], hp[1] - hb[1], hp[2] - hb[2]); sk.bones.head.add(o); bit.push(o);
  }
  const H = {
    kind: 'b', name: '麦芽', root, mesh, seat, bit, rig,
    get onStep() { return rig.onStep; }, set onStep(f) { rig.onStep = f; },
    update(dt, st) { rig.mode = st.graze ? 'graze' : 'ride'; rig.update(dt, st); },
    tris: geo.userData.tris, buildMs: geo.userData.buildMs,
  };
  return H;
}

// ---------- A 马：Quaternius 免费素材马（自带走、跑、站、吃草动画） ----------
export async function makeHorseA(url) {
  const gltf = await new GLTFLoader().loadAsync(url);
  const model = gltf.scene;
  const S = 0.43;
  model.scale.setScalar(S);
  model.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const nm = mats.map(m => {
        const n = new THREE.MeshStandardMaterial({ color: m.color, roughness: 0.8, name: m.name, flatShading: false });
        // 这匹马原本颜色很暗，提亮一点做成栗色
        if (/^Main/.test(m.name)) n.color.multiplyScalar(2.2);
        if (m.name === 'Muzzle' || m.name === 'Hair') n.color.multiplyScalar(1.6);
        patch(n, { rim: 0.6, gobo: true, fog: true });
        return n;
      });
      o.material = Array.isArray(o.material) ? nm : nm[0];
    }
  });
  const root = new THREE.Group(); root.add(model); root.name = 'horseA';
  const mixer = new THREE.AnimationMixer(model);
  const clip = n => gltf.animations.find(a => a.name === n);
  const act = {};
  for (const n of ['Idle', 'Walk', 'Gallop', 'Eating']) { const a = mixer.clipAction(clip(n)); a.play(); a.setEffectiveWeight(n === 'Idle' ? 1 : 0); act[n] = a; }
  // 座位：挂在 Torso 骨骼上，位置用网格的背线算
  let torso = null, head = null; model.traverse(o => { if (o.isBone && o.name === 'Torso') torso = o; if (o.isBone && o.name === 'Head') head = o; });
  model.updateMatrixWorld(true);
  const seat = new THREE.Object3D();
  root.updateMatrixWorld(true);
  const seatWorld = new THREE.Vector3(0, 0, 0);
  // 找背上最高点（马身中段）
  {
    const box = new THREE.Box3(); let top = -1e9;
    model.traverse(o => {
      if (!o.isSkinnedMesh) return;
      const p = o.geometry.attributes.position, v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); if (Math.abs(v.x) < 0.25 && v.z > -0.6 && v.z < 0.5) top = Math.max(top, v.y); }
    });
    seatWorld.set(0, top * S + 0.03, 0.0 * S);
  }
  torso.attach(seat); seat.position.copy(torso.worldToLocal(seatWorld.clone()));
  // 缰绳挂点：找网格最靠前的点（鼻尖），往后、往下一点就是嘴角
  let nose = null;
  model.traverse(o => {
    if (!o.isSkinnedMesh) return;
    const p = o.geometry.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); if (!nose || v.z > nose.z) nose = v.clone(); }
  });
  const bit = [];
  for (const s of [1, -1]) {
    const o = new THREE.Object3D(); root.add(o);
    o.position.set(0.055 * s, nose.y * S - 0.07, nose.z * S - 0.13);
    head.attach(o); bit.push(o);
  }
  // 用动画相位估算落蹄：走路一个循环 4 次，跑 4 次
  let lastQ = 0;
  const H = {
    kind: 'a', name: '栗子', root, mesh: model, seat, bit, onStep: null,
    update(dt, st) {
      const v = st.speed;
      const wWalk = sstep(0.05, 0.6, v) * (1 - sstep(2.2, 2.9, v)), wGal = sstep(2.2, 2.9, v);
      const wEat = st.graze && v < 0.05 ? 1 : 0;
      H.wEat = lerp(H.wEat || 0, wEat, 1 - Math.exp(-dt * 1.5));
      const wIdle = Math.max(0, 1 - wWalk - wGal) * (1 - H.wEat);
      act.Idle.setEffectiveWeight(wIdle); act.Walk.setEffectiveWeight(wWalk); act.Gallop.setEffectiveWeight(wGal); act.Eating.setEffectiveWeight(Math.max(0, 1 - wWalk - wGal) * H.wEat);
      // 让蹄子速度和移动速度对得上：走 1.0 米/秒、跑 3.6 米/秒是原速
      act.Walk.timeScale = Math.max(0.4, v / 1.0);
      act.Gallop.timeScale = Math.max(0.6, v / 3.6);
      mixer.update(dt);
      // 落蹄事件
      const a = wGal > 0.5 ? act.Gallop : act.Walk;
      if (v > 0.1 && H.onStep) {
        const q = Math.floor((a.time / a.getClip().duration) * 4);
        if (q !== lastQ) { lastQ = q; root.updateMatrixWorld(); H.onStep(['LF', 'RH', 'RF', 'LH'][q & 3], root.position.clone(), wGal); }
      }
    },
    tris: 0,
  };
  return H;
}

// ---------- 骑手：KayKit 游侠，用代码摆成骑马的坐姿 ----------
// Idle_A 第一帧的骨骼姿势（从 KayKit 动画里取出来的，免得为一个姿势加载一整个动画包）
const IDLE = { hips: [-0.0, 0.0432, 0.0, 0.9991], 'lowerleg.r': [0.274, -0.0, 0.0, 0.9617], 'hand.r': [-0.2124, 0.3841, -0.1403, 0.8875], 'upperarm.l': [-0.5336, -0.1168, -0.7717, 0.3256], 'lowerarm.l': [0.0, -0.0, -0.3586, 0.9335], 'wrist.l': [0.0, -0.0, 0.0267, 0.9996], spine: [0, 0, 0, 1], 'hand.l': [-0.2221, -0.3458, 0.1846, 0.8927], 'lowerarm.r': [0.0, 0.0, 0.3764, 0.9265], 'upperleg.l': [0.9924, 0.0581, 0.0704, 0.083], 'foot.l': [-0.5302, -0.1144, 0.0418, 0.8391], chest: [0.005, 0.0, 0.0004, 1.0], 'wrist.r': [0.0, 0.0, -0.0267, 0.9996], 'upperleg.r': [0.9973, -0.0295, 0.0315, 0.059], 'lowerleg.l': [0.2629, 0.0, -0.0, 0.9648], head: [-0.0035, -0.0313, -0.0002, 0.9995], 'upperarm.r': [-0.5606, 0.0468, 0.7369, 0.3747], 'foot.r': [-0.559, 0.1145, -0.0086, 0.8212] };
export async function makeRider(url) {
  const gltf = await new GLTFLoader().loadAsync(url);
  const model = gltf.scene;
  model.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      const m = o.material; const n = new THREE.MeshLambertMaterial({ map: m.map, color: m.color });
      patch(n, { rim: 0.5, gobo: true, fog: true }); o.material = n;
    }
  });
  const bones = {}; model.traverse(o => { if (o.isBone) bones[o.name] = o; });
  // GLTFLoader 会去掉名字里的点（hand.l → handl），两种写法都认
  for (const n of Object.keys(IDLE)) { const k = n.replace(/\./g, ''); if (!bones[n] && bones[k]) bones[n] = bones[k]; }
  const S = 0.5; model.scale.setScalar(S);
  const root = new THREE.Group(); root.add(model); root.name = 'rider';
  const base = {}; for (const [n, q] of Object.entries(IDLE)) if (bones[n]) base[n] = new THREE.Quaternion(...q);
  const e = new THREE.Euler(), q = new THREE.Quaternion();
  const add = (n, rx, ry, rz) => { const b = bones[n]; if (!b) return; e.set(rx, ry, rz); q.setFromEuler(e); b.quaternion.copy(base[n] || b.quaternion).multiply(q); };
  const R = {
    root, bones, S,
    hipsY: 0.392 * S,
    // pose: 'ride' 骑马，'sit' 坐在树桩上
    pose(kind, t, bob = 0, lean = 0) {
      const ride = kind === 'ride';
      add('hips', 0.08 + lean * 0.4 + bob * 0.6, 0, 0);
      add('spine', 0.05 - bob * 0.4 + Math.sin(t * 1.7) * 0.01, 0, 0);
      add('chest', 0.02, 0, 0);
      add('head', -0.1 + Math.sin(t * 0.5) * 0.04, Math.sin(t * 0.31) * 0.15, 0);
      const spread = ride ? 0.38 : 0.12;
      add('upperleg.l', -1.38, 0, -spread); add('upperleg.r', -1.38, 0, spread);
      add('lowerleg.l', ride ? 1.25 : 1.45, 0, 0); add('lowerleg.r', ride ? 1.25 : 1.45, 0, 0);
      add('foot.l', -0.25, 0, 0); add('foot.r', -0.25, 0, 0);
      // 手往前握着缰绳 / 坐着时放在膝盖上
      add('upperarm.l', 0.55, 0, ride ? 0.72 : 0.6); add('upperarm.r', 0.55, 0, ride ? -0.72 : -0.6);
      add('lowerarm.l', 0, 0, ride ? -0.55 : -0.4); add('lowerarm.r', 0, 0, ride ? 0.55 : 0.4);
    },
    hand(i, out) { const b = bones[i ? 'hand.r' : 'hand.l']; return b ? b.getWorldPosition(out) : out.set(0, 0, 0); },
  };
  R.pose('ride', 0);
  return R;
}

// ---------- 缰绳：两根从手到嘴边的软绳 ----------
export function makeReins() {
  const segs = 10;
  const mat = new THREE.MeshLambertMaterial({ color: '#3e2616' });
  patch(mat, { gobo: false, fog: true });
  const lines = [0, 1].map(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array((segs + 1) * 2 * 3); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const idx = []; for (let i = 0; i < segs; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    geo.setIndex(idx); geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.material.side = THREE.DoubleSide;
    return m;
  });
  const g = new THREE.Group(); g.add(...lines); g.name = 'reins';
  const a = new THREE.Vector3(), b = new THREE.Vector3(), p = new THREE.Vector3(), side = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  g.userData.update = (hands, bits, camera) => {
    for (let k = 0; k < 2; k++) {
      a.copy(hands[k]); b.copy(bits[k]);
      const pos = lines[k].geometry.attributes.position;
      const d = a.distanceTo(b);
      for (let i = 0; i <= segs; i++) {
        const t = i / segs; p.lerpVectors(a, b, t); p.y -= Math.sin(Math.PI * t) * d * 0.12;
        side.copy(camera.position).sub(p).cross(b.clone().sub(a)).normalize().multiplyScalar(0.012);
        pos.setXYZ(i * 2, p.x + side.x, p.y + side.y, p.z + side.z); pos.setXYZ(i * 2 + 1, p.x - side.x, p.y - side.y, p.z - side.z);
      }
      pos.needsUpdate = true;
    }
  };
  return g;
}
