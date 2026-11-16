// 坐骑和缰绳。几匹坐骑对外接口一样：root（放到地上）、seat（骑手坐的位置，跟着马背动）、bit（缰绳挂点）、update(dt, state)、onStep。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { toCreasedNormals, mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildHorseB, makeSkeleton, X } from '../horse/horseB.js';
import { HorseRigB } from '../horse/rigB.js';
import { patch } from '../world/atmo.js';
import { groomHorse, roundBox } from './groom.js';

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
    kind: 'b', name: MOUNT_INFO.b.name, desc: MOUNT_INFO.b.desc, gaits: MOUNT_INFO.b.gaits, gaitNames: MOUNT_INFO.b.names, seatTilt: true,
    root, mesh, seat, bit, rig,
    get onStep() { return rig.onStep; }, set onStep(f) { rig.onStep = f; },
    update(dt, st) { rig.mode = st.graze ? 'graze' : 'ride'; rig.update(dt, st); },
    tris: geo.userData.tris, buildMs: geo.userData.buildMs,
  };
  return H;
}

// ---------- 素材坐骑：Quaternius 免费素材的马和小毛驴（自带走、跑、站、吃草动画） ----------
// 同一个模型文件可以生成好几匹（克隆骨架、换颜色）：栗子（栗色马）、云朵（白马）、小毛驴。
export const MOUNT_INFO = {
  b: { name: '麦芽', desc: '圆滚滚的小马，自己捏的', gaits: [1.4, 2.6, 3.6], names: ['慢步', '小跑', '快跑'] },
  a: { name: '栗子', desc: '栗色的高头大马，跑得最快', gaits: [1.6, 3.3, 6.0], names: ['慢步', '小跑', '奔跑'] },
  w: { name: '云朵', desc: '白马，鬃毛像一团云', gaits: [1.6, 3.3, 6.0], names: ['慢步', '小跑', '奔跑'] },
  d: { name: '小毛驴', desc: '慢慢悠悠，走山路很稳', gaits: [1.3, 2.4, 4.0], names: ['慢步', '小跑', '颠颠跑'] },
};
// 马鞍和鞍垫的颜色
const TACK = { a: '#2f4a6e', w: '#7a2e2e', d: '#a8803e' };
// 马具：鞍垫（包着马背的一段圆筒）、皮马鞍（前后翘起）、两边的镫带和马镫。r 是马背的半径（米）
function makeTack(r, blanket) {
  const geos = [];
  const add = (g, color, m) => { g = g.index ? g.toNonIndexed() : g; if (m) g.applyMatrix4(m); const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k); geos.push(g); };
  const D = Math.PI / 180, cy = -0.03 - r;
  const arc = (rad, len, deg, color, z = 0) => { const g = new THREE.CylinderGeometry(rad, rad, len, 18, 1, true, -deg * D, 2 * deg * D); g.rotateX(-Math.PI / 2); g.translate(0, cy, z); add(g, color); };
  arc(r + 0.012, 0.66, 78, blanket, -0.02);                    // 鞍垫
  arc(r + 0.016, 0.7, 80, '#efe2c4', -0.02); geos.pop();       // （留着备用：镶边）
  arc(r + 0.03, 0.44, 50, '#5a3a22', 0);                       // 皮马鞍
  const M = (x, y, z, rx = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, 0)), new THREE.Vector3(1, 1, 1));
  add(new THREE.BoxGeometry(0.15, 0.075, 0.07), '#4e3220', M(0, 0.03, 0.2, -0.35));     // 前鞍桥
  add(new THREE.BoxGeometry(0.24, 0.09, 0.05), '#4e3220', M(0, 0.045, -0.21, 0.45));    // 后鞍桥
  for (const s of [1, -1]) {
    const a = 62 * D, x = s * (r + 0.035) * Math.sin(a), y = cy + (r + 0.035) * Math.cos(a);
    add(new THREE.BoxGeometry(0.03, 0.44, 0.012), '#3e2818', M(x, y - 0.22, 0.03));      // 镫带
    const st = new THREE.TorusGeometry(0.055, 0.011, 4, 10); st.rotateY(Math.PI / 2);
    add(st, '#8a8478', M(x, y - 0.47, 0.03));                                            // 马镫
    // 鞍后两边挂的皮鞍袋（圆鼓鼓的），袋盖颜色深一点，再一根扣带
    const b = 70 * D, bx = s * (r + 0.05) * Math.sin(b), by = cy + (r + 0.05) * Math.cos(b) - 0.1;
    add(roundBox(0.075, 0.17, 0.23), '#7a5532', M(bx, by, -0.34));
    add(roundBox(0.085, 0.07, 0.24), '#5a3b22', M(bx + s * 0.004, by + 0.065, -0.34));
    add(new THREE.BoxGeometry(0.02, 0.16, 0.03), '#3e2818', M(bx + s * 0.06, by - 0.01, -0.34));
  }
  // 鞍后横着绑一卷铺盖，两道皮带
  {
    const len = 2 * (r + 0.07), roll = new THREE.CylinderGeometry(0.075, 0.075, len, 12); roll.rotateZ(Math.PI / 2);
    add(roll, '#4f6b3a', M(0, 0.05, -0.32));
    for (const s of [1, -1]) { const band = new THREE.CylinderGeometry(0.079, 0.079, 0.03, 12); band.rotateZ(Math.PI / 2); add(band, '#3e2818', M(s * len * 0.28, 0.05, -0.32)); }
  }
  const g = mergeGeometries(geos); g.computeBoundingSphere();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide });
  patch(mat, { rim: 0.4, gobo: true, fog: true });
  const mesh = new THREE.Mesh(g, mat); mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.name = 'tack';
  return mesh;
}
// 每种颜色：材质名 → 颜色（字符串是 sRGB 颜色，数字是把原色乘几倍）
const COATS = {
  a: { Main: 1.9, Main_Dark: 1.9, Main_Light: 1.9, Muzzle: 1.6, Hair: 1.6 },
  w: { Main: '#d9d3c9', Main_Dark: '#bcb5aa', Main_Light: '#e9e4db', Hair: '#e3d8c3', Muzzle: '#8a7a70', Hooves: '#6e6256' },
  d: { Main: '#8f857b', Main_Dark: '#4a403a', Main_Light: '#ece7df', Hair: '#3f3833', Muzzle: '#5a4a3e', Hooves: '#4d4339' },
};
export async function loadAnimal(url) { const g = await new GLTFLoader().loadAsync(url); g.copies = 0; g.smooth = new Map(); return g; }
export function makeHorseA(gltf, key = 'a') {
  const model = gltf.copies++ ? SkeletonUtils.clone(gltf.scene) : gltf.scene;
  const info = MOUNT_INFO[key], coat = COATS[key] || {};
  const S = key === 'd' ? 0.41 : 0.43;
  model.scale.setScalar(S);
  model.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
    // 原模型是一块块平面，法线按 60 度折角重新算，看起来圆润一些（几匹共用一份）
    let g = gltf.smooth.get(o.geometry.uuid);
    if (!g) { g = toCreasedNormals(o.geometry, Math.PI / 3); gltf.smooth.set(o.geometry.uuid, g); }
    o.geometry = g;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const nm = mats.map(m => {
      const n = new THREE.MeshStandardMaterial({ color: m.color.clone(), roughness: 0.8, name: m.name });
      const c = coat[m.name];
      if (typeof c === 'number') n.color.multiplyScalar(c); else if (c) n.color.set(c);
      n.emissive.copy(n.color).multiplyScalar(key === 'w' ? 0.05 : 0.1);   // 逆光时不至于全黑
      patch(n, { rim: 0.6, gobo: true, fog: true });
      return n;
    });
    o.material = Array.isArray(o.material) ? nm : nm[0];
  });
  const root = new THREE.Group(); root.add(model); root.name = 'mount-' + key;
  const mixer = new THREE.AnimationMixer(model);
  const clip = n => gltf.animations.find(a => a.name === n);
  const act = {};
  for (const n of ['Idle', 'Walk', 'Gallop', 'Eating']) { const a = mixer.clipAction(clip(n)); a.play(); a.setEffectiveWeight(n === 'Idle' ? 1 : 0); act[n] = a; }
  // 座位：挂在 Torso 骨骼上，位置用网格的背线算
  let torso = null, head = null; model.traverse(o => { if (o.isBone && o.name === 'Torso') torso = o; if (o.isBone && o.name === 'Head') head = o; });
  root.updateMatrixWorld(true);
  const seat = new THREE.Object3D();
  const seatWorld = new THREE.Vector3(0, 0, 0);
  // 找背上最高点（马身中段）
  {
    let top = -1e9;
    model.traverse(o => {
      if (!o.isSkinnedMesh) return;
      const p = o.geometry.attributes.position, v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); if (Math.abs(v.x) < 0.25 && v.z > -0.6 && v.z < 0.5) top = Math.max(top, v.y); }
    });
    seatWorld.set(0, top * S + 0.03, 0.0 * S);
  }
  torso.attach(seat); seat.position.copy(torso.worldToLocal(seatWorld.clone()));
  // 马具：按马背的宽度做，挂在座位上（跟着马背起伏）
  {
    let hw = 0, top = (seatWorld.y - 0.03) / S;
    model.traverse(o => {
      if (!o.isSkinnedMesh) return;
      const p = o.geometry.attributes.position, v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); if (Math.abs(v.z) < 0.2 && v.y > top - 0.5) hw = Math.max(hw, Math.abs(v.x)); }
    });
    const tack = makeTack(Math.max(0.12, hw * S * 0.92), TACK[key] || TACK.a);
    seat.add(tack); tack.scale.setScalar(1 / seat.getWorldScale(new THREE.Vector3()).x);
  }
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
    o.position.set(0.055 * s * S / 0.43, nose.y * S - 0.07, nose.z * S - 0.13);
    head.attach(o); bit.push(o);
  }
  // 鬃毛、尾巴、马笼头和身上的花色（groom.js；放在量马背、鼻尖之后）
  groomHorse(gltf, model, key);
  // 动作原速：走 1.0 米/秒、跑 3.6 米/秒（按模型大小换算）
  const vWalk = 1.0 * S / 0.43, vGal = 3.6 * S / 0.43;
  // 用动画相位估算落蹄：走路一个循环 4 次，跑 4 次
  let lastQ = 0;
  const H = {
    kind: key, name: info.name, desc: info.desc, gaits: info.gaits, gaitNames: info.names,
    root, mesh: model, seat, bit, onStep: null, tilt: true, wEat: 0,
    update(dt, st) {
      const v = st.speed;
      const g0 = vGal * 0.62, g1 = vGal * 0.8;
      const wWalk = sstep(0.05, 0.6, v) * (1 - sstep(g0, g1, v)), wGal = sstep(g0, g1, v);
      const wEat = st.graze && v < 0.05 ? 1 : 0;
      H.wEat = lerp(H.wEat, wEat, 1 - Math.exp(-dt * 1.5));
      const wIdle = Math.max(0, 1 - wWalk - wGal) * (1 - H.wEat);
      act.Idle.setEffectiveWeight(wIdle); act.Walk.setEffectiveWeight(wWalk); act.Gallop.setEffectiveWeight(wGal); act.Eating.setEffectiveWeight(Math.max(0, 1 - wWalk - wGal) * H.wEat);
      // 让蹄子速度和移动速度对得上
      act.Walk.timeScale = Math.max(0.4, v / vWalk);
      act.Gallop.timeScale = Math.max(0.6, v / vGal);
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
