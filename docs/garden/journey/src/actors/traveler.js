// 旅人：Quaternius 游侠外套 + 基础角色的脸（CC0），动作来自 Universal Animation Library（CC0）。
// 动作分几组按权重混合：走跑（站、走、慢跑、快跑按速度混）、骑马（开车的坐姿 + 代码把腿分开跨在马背上）、
// 坐（坐下、坐着、站起）、飞（站姿 + 代码把身体放平、手臂后摆）、游泳（素材里的游泳循环）、一次性动作（起跳、落地）。
// 另外两种是盖在走跑上面的：腾空（跳起来、掉下去，素材里的腾空循环）、攀爬（代码摆的：两手轮流往上够、两腿轮流蹬）。
// 所有朝向：模型面朝 +Z，左手在 +X。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { patch } from '../world/atmo.js';
import { roundBox } from './groom.js';
import { Lag } from './sway.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const DEG = Math.PI / 180;
// 走、慢跑、快跑一个循环（两步）的距离（米），用来让脚步和移动速度对上
const LOCO = [['Walk_Loop', 1.3], ['Jog_Fwd_Loop', 5.0], ['Sprint_Loop', 5.5]];
const GROUPS = ['loco', 'ride', 'sit', 'fly', 'swim'];

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _ax = new THREE.Vector3();
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);

// opts.sculpt：用代码捏的旅人（sculpt.js，现在的默认），骨骼和动作还是模型文件里那套；opts.who：m|f 两套造型
export async function makeTraveler(url, opts = {}) {
  const gltf = await new GLTFLoader().loadAsync(url);
  const model = gltf.scene;
  const sculpt = opts.sculpt ? (await import('./sculpt.js')).sculptTraveler(model, { who: opts.who }) : null;
  if (!sculpt) model.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
    const m = o.material, eyes = /Eye/.test(m.name);
    // 自发光一点点（按贴图颜色）：逆光时人不会只剩一个黑影
    const n = new THREE.MeshStandardMaterial({ map: m.map, color: m.color, roughness: eyes ? 0.3 : 0.86, metalness: 0, name: m.name, emissiveMap: m.map, emissive: new THREE.Color(m.color).multiplyScalar(0.16) });
    patch(n, { rim: eyes ? 0 : 0.45, gobo: true, fog: true });
    o.material = n;
  });
  const bones = {}; model.traverse(o => { if (o.isBone) bones[o.name] = o; });
  // 腿的绑定姿势（直直并着）：飞的时候往这个姿势靠，免得站姿里一前一后的腿放平后像在空中跑步
  const LEGS = ['thigh_l', 'thigh_r', 'calf_l', 'calf_r', 'foot_l', 'foot_r'];
  const rest = Object.fromEntries(LEGS.filter(n => bones[n]).map(n => [n, bones[n].quaternion.clone()]));
  const root = new THREE.Group(); root.add(model); root.name = 'traveler';
  const mixer = new THREE.AnimationMixer(model);
  const A = {};
  for (const c of gltf.animations) { const a = mixer.clipAction(c); a.play(); a.setEffectiveWeight(0); A[c.name] = a; }
  // 走跑三个循环：手动推进时间，保持同一相位
  for (const [n] of LOCO) A[n].timeScale = 0;
  // 一次性动作播完停在最后一帧
  for (const n of ['Jump_Start', 'Jump_Land', 'Sitting_Enter', 'Sitting_Exit', 'Interact']) if (A[n]) { A[n].setLoop(THREE.LoopOnce, 1); A[n].clampWhenFinished = true; }

  // 记下几个姿势里盆骨相对脚底的位置（坐下、骑马时用来对准座位）
  const pelvisIn = name => {
    for (const a of Object.values(A)) a.setEffectiveWeight(0);
    A[name].setEffectiveWeight(1); A[name].time = 0.3; mixer.update(0);
    model.updateMatrixWorld(true);
    const p = bones.pelvis.getWorldPosition(new THREE.Vector3());
    A[name].setEffectiveWeight(0);
    return p;
  };
  const sitPelvis = pelvisIn('Sitting_Idle_Loop');
  // 背包按站姿量后背的位置（绑定姿势是 T 字，胸口和动画里不一样）
  for (const a of Object.values(A)) a.setEffectiveWeight(0);
  A.Idle_Loop.setEffectiveWeight(1); A.Idle_Loop.time = 0; mixer.update(0);
  const pack = makePack(model, bones);
  // 捏的旅人：围巾背后那一截搭过铺盖卷、垂在行囊后面
  if (sculpt && pack) { const k = pack.userData.at; sculpt.userData.drape(r => [r, [k.x + 0.04, k.y + 0.255, k.z - 0.005], [k.x + 0.052, k.y + 0.18, k.z - 0.064], [k.x + 0.058, k.y + 0.04, k.z - 0.088], [k.x + 0.052, k.y - 0.09, k.z - 0.096]]); }
  A.Idle_Loop.setEffectiveWeight(0);

  const T = {
    root, model, bones, mixer, A, pack,
    height: 1.78,
    sitPelvis,
    w: { loco: 1, ride: 0, sit: 0, fly: 0, swim: 0 },        // 各组当前权重
    target: 'loco', fade: 4,
    phase: 0, speed: 0,
    one: null,                                       // { name, t, w, dur }
    sitStage: null,                                  // 'enter' | 'idle' | 'exit'
    look: { yaw: 0, pitch: 0, w: 0 },
    // 切换动作组：loco / ride / sit / fly
    set(name, fade = 4) {
      if (name === T.target) return;
      if (T.target === 'sit' && name !== 'sit') { T.sitStage = 'exit'; A.Sitting_Exit.reset().play(); }
      if (name === 'sit') { T.sitStage = 'enter'; A.Sitting_Enter.reset().play(); }
      T.target = name; T.fade = fade;
    },
    // 一次性动作，权重 w，淡入淡出 fade 秒
    play(name, w = 1, fade = 0.12) { if (!A[name]) return; A[name].reset().play(); T.one = { name, t: 0, w, fade, dur: A[name].getClip().duration }; },

    // st: { speed, turn, dt, ride: {bob, pitch, roll, lean}, fly: {pitch, bank, flap}, lookAt: Vector3|null, slope,
    //       air: 腾空, climb: { k 0~1, phase 一圈是左右手各够一次, reach 往上爬时手伸得更高 }, swim: { v 游多快 } }
    update(dt, st = {}) {
      // 上一帧用代码改过的骨头先还原：动画混合器只在数值变了才写回骨头，不还原的话改动会一帧帧叠加
      for (const b of touched) b.quaternion.copy(orig.get(b));
      touched.clear();
      const v = Math.max(0, st.speed || 0);
      T.speed = v;
      // ---- 组权重 ----
      for (const g of GROUPS) T.w[g] = damp(T.w[g], g === T.target ? 1 : 0, T.fade, dt);
      let sum = 0; for (const g of GROUPS) sum += T.w[g];
      for (const g of GROUPS) T.w[g] /= sum || 1;
      const W = T.w;
      // ---- 走跑 ----
      const wWalk = sstep(0.08, 0.7, v), wJog = sstep(2.2, 3.4, v), wSprint = sstep(5.6, 6.8, v);
      const lw = [wWalk * (1 - wJog), wJog * (1 - wSprint), wSprint];
      const lsum = lw[0] + lw[1] + lw[2];
      let L = 1.3; if (lsum > 0.01) L = (lw[0] * 1.3 + lw[1] * 5.0 + lw[2] * 5.5) / lsum;
      T.phase = (T.phase + dt * Math.max(v, 0) / L) % 1;
      // 腾空：跳起来、从高处掉下去时，走跑让给腾空的姿势
      const airK = T.airK = damp(T.airK || 0, st.air ? 1 : 0, st.air ? 14 : 9, dt), gnd = 1 - airK;
      LOCO.forEach(([n], i) => { const a = A[n]; a.time = T.phase * a.getClip().duration; a.setEffectiveWeight(W.loco * lw[i] * gnd); });
      A.Idle_Loop.setEffectiveWeight(W.loco * (1 - wWalk) * gnd + W.fly);
      if (A.Jump_Loop) A.Jump_Loop.setEffectiveWeight(W.loco * airK);
      // ---- 游泳：游得快划得快，停下来就慢慢踩水 ----
      if (A.Swim_Fwd_Loop) { A.Swim_Fwd_Loop.setEffectiveWeight(W.swim); A.Swim_Fwd_Loop.timeScale = 0.4 + 0.75 * sstep(0.1, 1.8, st.swim?.v || 0); }
      A.Idle_Loop.timeScale = 1;
      // ---- 骑马：开车的坐姿 ----
      A.Driving_Loop.setEffectiveWeight(W.ride);
      // ---- 坐 ----
      let ws = W.sit;
      if (T.sitStage === 'enter' && A.Sitting_Enter.time >= A.Sitting_Enter.getClip().duration - 0.05) T.sitStage = 'idle';
      const exitW = T.sitStage === 'exit' ? Math.max(0, 1 - W.loco - W.ride - W.fly) + 0.0001 : 0;
      if (T.sitStage === 'exit' && (A.Sitting_Exit.time >= A.Sitting_Exit.getClip().duration - 0.05 || W.sit < 0.02)) T.sitStage = null;
      A.Sitting_Enter.setEffectiveWeight(T.sitStage === 'enter' ? ws : 0);
      A.Sitting_Idle_Loop.setEffectiveWeight(T.sitStage === 'idle' ? ws : 0);
      A.Sitting_Exit.setEffectiveWeight(T.sitStage === 'exit' ? Math.max(ws, exitW * 0) : 0);
      // ---- 一次性动作盖在上面 ----
      if (T.one) {
        const o = T.one; o.t += dt;
        const k = Math.min(1, o.t / o.fade) * (1 - sstep(o.dur - o.fade, o.dur, o.t)) * o.w;
        // 其它动作按比例让出权重
        for (const a of Object.values(A)) if (a !== A[o.name]) a.setEffectiveWeight(a.getEffectiveWeight() * (1 - k));
        A[o.name].setEffectiveWeight(k);
        if (o.t >= o.dur) { A[o.name].setEffectiveWeight(0); T.one = null; }
      }
      mixer.update(dt);
      // ---- 代码调整的姿势 ----
      root.updateMatrixWorld(true);
      if (W.ride > 0.01) ridePose(W.ride, st.ride || {});
      if (W.fly > 0.01) flyPose(W.fly, st.fly || {}, dt);
      if (W.loco > 0.01 && v > 0.1) leanPose(W.loco * sstep(0.1, 1.5, v), st.turn || 0, st.slope || 0, v);
      if (W.loco > 0.01 && st.climb && st.climb.k > 0.01) climbPose(W.loco * st.climb.k, st.climb);
      headLook(dt, st.lookAt || null, st.lookW ?? 1);
      if (pack) pack.visible = W.fly < 0.3 && !T.winged;   // 飞的时候背上是翅膀
    },
    // 人摆到位之后再调：背上的行囊慢半拍地颠（走路一步一颠，跑起来、骑马小跑时颠得更欢）
    after(dt) {
      sculpt?.userData.sway(dt, T.swayGain);
      if (!pack || !pack.visible) return;
      const sp = bones.spine_03, R = pack.userData.rest;
      const o = packLag.update(dt, sp.getWorldPosition(_v));
      sp.getWorldQuaternion(_q); _q2.copy(_q).invert();
      const ws = sp.getWorldScale(_v2).x || 1, g = T.swayGain;
      root.getWorldQuaternion(rq);
      const back = -_v2.set(0, 0, 1).applyQuaternion(rq).dot(o);       // 落在身后多少
      _ax.copy(X).applyQuaternion(rq);
      pack.position.copy(R.p).add(_v.copy(o).applyQuaternion(_q2).multiplyScalar(0.5 * g / ws));
      // 绕肩带那一点翻：身体往下落、往前冲的时候，包的下半截离开后背一点
      _q3.setFromAxisAngle(_ax, Math.max(-0.03, Math.min(0.13, (o.y * 2.2 + back * 1.6) * g)));
      pack.quaternion.copy(_q2).multiply(_q3).multiply(_q).multiply(R.q);
    },
    swayGain: 1,
    pelvis(out) { return bones.pelvis.getWorldPosition(out); },
    hand(i, out) {
      // 手心中间（中指根部）
      const b = bones[i ? 'middle_01_r' : 'middle_01_l'] || bones[i ? 'hand_r' : 'hand_l'];
      return b.getWorldPosition(out);
    },
    foot(i, out) { return bones[i ? 'foot_r' : 'foot_l'].getWorldPosition(out); },
  };

  // 把一根骨头的局部朝向往 q 靠（k=1 就是 q）；和 turn 一样记下原值，下一帧还原
  function toward(name, q, k) {
    const b = bones[name]; if (!b || k <= 0) return;
    if (!touched.has(b)) { touched.add(b); let o = orig.get(b); if (!o) orig.set(b, o = new THREE.Quaternion()); o.copy(b.quaternion); }
    b.quaternion.slerp(q, Math.min(1, k));
  }
  // 绕世界坐标里的轴转一根骨头（axis 是角色自己的方向，先转到世界里）
  const rq = new THREE.Quaternion();
  const packLag = new Lag({ freq: 2.7, zeta: 0.3, drag: 0, max: 0.07 });
  const orig = new Map(), touched = new Set();
  function turn(name, axisLocal, angle) {
    const b = bones[name]; if (!b || !angle) return;
    if (!touched.has(b)) { touched.add(b); let q = orig.get(b); if (!q) orig.set(b, q = new THREE.Quaternion()); q.copy(b.quaternion); }
    root.getWorldQuaternion(rq);
    _ax.copy(axisLocal).applyQuaternion(rq).normalize();
    b.parent.updateWorldMatrix(true, false);
    b.parent.getWorldQuaternion(_q);                       // 父骨骼世界朝向
    _q2.setFromAxisAngle(_ax, angle);                       // 世界里的旋转
    // local' = parent^-1 * R * parent * local
    _q3.copy(_q).invert().multiply(_q2).multiply(_q).multiply(b.quaternion);
    b.quaternion.copy(_q3);
    b.updateMatrixWorld(true);
  }

  // 骑马：大腿往下、往外分开跨在马背两侧，小腿垂下，脚尖朝前；身体随马起伏
  function ridePose(w, r) {
    const spread = (r.spread ?? 1) * w;
    turn('thigh_l', X, 52 * DEG * w); turn('thigh_r', X, 52 * DEG * w);
    turn('thigh_l', Z, 17 * DEG * spread); turn('thigh_r', Z, -17 * DEG * spread);
    turn('calf_l', X, -38 * DEG * w); turn('calf_r', X, -38 * DEG * w);
    turn('foot_l', X, -12 * DEG * w); turn('foot_r', X, -12 * DEG * w);
    // 上身：微微前倾，随马的步伐前后晃
    turn('spine_01', X, ((r.lean || 0) + (r.pitch || 0)) * w);
    turn('spine_02', Z, (r.roll || 0) * w);
    turn('neck_01', X, -((r.lean || 0) * 0.6 + (r.pitch || 0) * 0.8) * w);
    // 手：再收低一点，握在马鬃前
    turn('upperarm_l', X, 10 * DEG * w); turn('upperarm_r', X, 10 * DEG * w);
  }
  // 飞：身体放平（整体由外面转），这里把头抬起来看前方，手臂往后、略张开，腿并拢伸直
  function flyPose(w, f, dt) {
    const flap = f.flap || 0;
    for (const n in rest) toward(n, rest[n], 0.9 * w);
    turn('spine_02', X, -10 * DEG * w); turn('spine_03', X, -8 * DEG * w);
    turn('neck_01', X, -(f.pitch || 70 * DEG) * 0.45 * w); turn('Head', X, -(f.pitch || 70 * DEG) * 0.35 * w);
    turn('upperarm_l', Z, (30 - 6 * flap) * DEG * w); turn('upperarm_r', Z, (-30 + 6 * flap) * DEG * w);
    turn('upperarm_l', X, 18 * DEG * w); turn('upperarm_r', X, 18 * DEG * w);
    turn('lowerarm_l', Z, 10 * DEG * w); turn('lowerarm_r', Z, -10 * DEG * w);
    turn('thigh_l', X, 6 * DEG * w); turn('thigh_r', X, 6 * DEG * w);
    turn('thigh_l', Z, 4 * DEG * w); turn('thigh_r', Z, -4 * DEG * w);
    turn('calf_l', X, 10 * DEG * w * (0.7 + 0.3 * Math.sin(T._ft = (T._ft || 0) + dt * 1.3))); turn('calf_r', X, 10 * DEG * w * (0.7 + 0.3 * Math.sin(T._ft + 0.9)));
    turn('foot_l', X, 35 * DEG * w); turn('foot_r', X, 35 * DEG * w);
    turn('spine_01', Z, (f.bank || 0) * 0.4 * w);
  }
  // 攀爬：脸朝岩壁（整个人由外面按坡度往前倾），两手轮流往上够，两腿轮流蹬；停着不动时手脚都扒着
  function climbPose(w, c) {
    const ph = (c.phase || 0) * Math.PI * 2, s = Math.sin(ph), reach = c.reach ?? 1;
    const up = x => Math.max(0, x);
    const aL = 128 + 30 * s * reach, aR = 128 - 30 * s * reach;
    turn('upperarm_l', X, -aL * DEG * w); turn('upperarm_r', X, -aR * DEG * w);
    turn('upperarm_l', Z, 20 * DEG * w); turn('upperarm_r', Z, -20 * DEG * w);
    turn('lowerarm_l', X, -(22 - 14 * s * reach) * DEG * w); turn('lowerarm_r', X, -(22 + 14 * s * reach) * DEG * w);
    turn('hand_l', X, 40 * DEG * w); turn('hand_r', X, 40 * DEG * w);
    // 腿和手反着来：右手往上够的时候左腿蹬上去
    const lL = up(-s), lR = up(s);
    turn('thigh_l', X, -(55 + 45 * lL * reach) * DEG * w); turn('thigh_r', X, -(55 + 45 * lR * reach) * DEG * w);
    turn('thigh_l', Z, 9 * DEG * w); turn('thigh_r', Z, -9 * DEG * w);
    turn('calf_l', X, (60 + 50 * lL * reach) * DEG * w); turn('calf_r', X, (60 + 50 * lR * reach) * DEG * w);
    turn('foot_l', X, -20 * DEG * w); turn('foot_r', X, -20 * DEG * w);
    turn('spine_02', X, -7 * DEG * w); turn('neck_01', X, -14 * DEG * w); turn('Head', X, -16 * DEG * w);
    turn('spine_01', Z, 4 * DEG * s * reach * w);
  }
  // 走跑时：转弯往里倾，上坡前倾
  function leanPose(w, turnRate, slope, v) {
    turn('spine_01', Z, Math.max(-0.12, Math.min(0.12, turnRate * v * 0.025)) * w);
    turn('spine_01', X, Math.max(-0.1, Math.min(0.14, -slope * 0.5)) * w);
  }
  // 转头看东西：脖子和头分担
  function headLook(dt, target, lw) {
    const L = T.look;
    let yaw = 0, pitch = 0, want = 0;
    if (target) {
      bones.Head.getWorldPosition(_v);
      _v2.copy(target).sub(_v);
      root.getWorldQuaternion(rq); _q.copy(rq).invert(); _v2.applyQuaternion(_q);   // 转到角色自己的坐标
      yaw = Math.atan2(_v2.x, _v2.z); pitch = Math.atan2(_v2.y, Math.hypot(_v2.x, _v2.z));
      want = Math.abs(yaw) < 2.2 ? lw : 0;
      yaw = Math.max(-1.25, Math.min(1.25, yaw)); pitch = Math.max(-0.5, Math.min(0.45, pitch));
    }
    L.w = damp(L.w, want, 2.5, dt);
    L.yaw = damp(L.yaw, yaw, 3, dt); L.pitch = damp(L.pitch, pitch, 3, dt);
    if (L.w < 0.01) return;
    turn('neck_01', Y, L.yaw * 0.45 * L.w); turn('Head', Y, L.yaw * 0.55 * L.w);
    turn('neck_01', X, -L.pitch * 0.4 * L.w); turn('Head', X, -L.pitch * 0.5 * L.w);
  }

  A.Idle_Loop.setEffectiveWeight(1);
  T.update(0);
  return T;
}

// 背上的小行囊：帆布包、包盖、上面横绑一卷铺盖。按绑定姿势量出后背的位置，挂在 spine_03 上跟着身体动
function makePack(model, bones) {
  const sp = bones.spine_03; if (!sp) return null;
  model.updateMatrixWorld(true);
  const c = sp.getWorldPosition(new THREE.Vector3());
  // 后背最靠后的点（模型面朝 +Z，后背是 -Z）
  let back = Infinity; const v = new THREE.Vector3();
  model.traverse(o => {
    if (!o.isSkinnedMesh) return;
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { o.getVertexPosition(i, v).applyMatrix4(o.matrixWorld); if (Math.abs(v.x - c.x) < 0.1 && Math.abs(v.y - c.y) < 0.12) back = Math.min(back, v.z); }
  });
  if (!isFinite(back)) return null;
  const geos = [];
  const add = (g, color, x, y, z, rz = 0) => {
    g = g.index ? g.toNonIndexed() : g; if (rz) g.rotateZ(rz); g.translate(x, y, z);
    const k = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([k.r, k.g, k.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); for (const key of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(key)) g.deleteAttribute(key); geos.push(g);
  };
  const y0 = c.y - 0.02, z0 = back - 0.06;
  add(roundBox(0.2, 0.24, 0.1), '#7a6a4c', c.x, y0, z0);
  add(roundBox(0.21, 0.085, 0.11), '#5a3b22', c.x, y0 + 0.1, z0 - 0.004);
  add(new THREE.BoxGeometry(0.025, 0.15, 0.115), '#3e2818', c.x + 0.055, y0 - 0.01, z0 - 0.006);
  add(new THREE.BoxGeometry(0.025, 0.15, 0.115), '#3e2818', c.x - 0.055, y0 - 0.01, z0 - 0.006);
  add(new THREE.CylinderGeometry(0.05, 0.05, 0.32, 12), '#4f6b3a', c.x, y0 + 0.19, z0 + 0.01, Math.PI / 2);
  const g = mergeGeometries(geos);
  // 原点放在肩带挂着的地方（包的上沿、贴后背那一面），颠的时候绕这一点翻
  const pv = new THREE.Vector3(c.x, y0 + 0.13, z0 + 0.07);
  g.translate(-pv.x, -pv.y, -pv.z);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, name: 'pack' });
  patch(mat, { rim: 0.45, gobo: true, fog: true });
  const mesh = new THREE.Mesh(g, mat); mesh.name = 'pack'; mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  mesh.position.copy(pv);
  model.add(mesh); sp.attach(mesh);
  mesh.userData.rest = { p: mesh.position.clone(), q: mesh.quaternion.clone() };
  mesh.userData.at = { x: c.x, y: y0, z: z0 };      // 包身中心（量的时候的姿势、世界坐标）
  return mesh;
}
