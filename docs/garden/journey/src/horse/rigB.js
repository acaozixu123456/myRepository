// B 马的程序动作：四条腿用两段反向动力学放蹄子，蹄子落地时固定在地面不打滑；
// 慢步是四拍（左后-左前-右后-右前），小跑是两拍对角，速度之间平滑过渡。
import * as THREE from 'three';

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const frac = x => x - Math.floor(x);
const DEG = Math.PI / 180;

const LEGS = [
  { id: 'LF', front: true, chain: ['shoulderL', 'elbowL', 'kneeL', 'ffetL', 'fhoofL'], walk: 0.25, trot: 0.0 },
  { id: 'RF', front: true, chain: ['shoulderR', 'elbowR', 'kneeR', 'ffetR', 'fhoofR'], walk: 0.75, trot: 0.5 },
  { id: 'LH', front: false, chain: ['hipL', 'stifleL', 'hockL', 'hfetL', 'hhoofL'], walk: 0.0, trot: 0.5 },
  { id: 'RH', front: false, chain: ['hipR', 'stifleR', 'hockR', 'hfetR', 'hhoofR'], walk: 0.5, trot: 0.0 },
];

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4();

export class HorseRigB {
  constructor(mesh, bones, rest) {
    this.mesh = mesh; this.b = bones; this.rest = rest;
    this.phase = 0; this.time = 0; this.gait = 0; this.speed = 0;
    this.restLocal = {}; this.restDir = {};
    for (const [name, bone] of Object.entries(bones)) {
      this.restLocal[name] = bone.position.clone();
      const child = bone.children.find(c => c.isBone);
      if (child) this.restDir[name] = child.position.clone().normalize();
    }
    const R = n => new THREE.Vector3(...rest[n]);
    this.legs = LEGS.map(L => {
      const j = L.chain.map(R);
      const l1 = j[0].distanceTo(j[1]), l2 = j[1].distanceTo(j[2]), l3 = j[2].distanceTo(j[3]);
      const pv = j[4].clone().sub(j[3]);
      const a = j[1].clone().sub(j[2]).normalize(), c = j[3].clone().sub(j[2]).normalize();
      const restInterior = Math.acos(THREE.MathUtils.clamp(a.dot(c), -1, 1));
      return { ...L, l1, l2, l3, pv, restInterior, neutral: j[4].clone(), lastStance: true, plant: null };
    });
    this.onStep = null;   // (legId, worldPos) 蹄子落地回调，用来放蹄声
    // 闲时的小动作
    this.idle = { look: 0, lookT: 0, lookTarget: 0, earL: 0, earR: 0, earT: 1, swish: 0, swishT: 3, rest: 0, nod: 0 };
    this.mode = 'ride';   // ride | graze
    this.grazeW = 0;
    this.restW = 0;
  }

  // 把骨骼 bone 转到指向模型空间的 target 点（只做摆动，不扭转）
  aim(name, target) {
    const bone = this.b[name], dir = this.restDir[name];
    bone.quaternion.identity();
    bone.updateMatrixWorld(true);
    // 父骨骼在模型空间的朝向
    bone.parent.getWorldQuaternion(_q);
    _q2.copy(this.meshQInv).multiply(_q);           // 模型空间
    const bp = this.modelPos(bone, _v2);
    const want = _v.copy(target).sub(bp).normalize().applyQuaternion(_q2.invert());
    bone.quaternion.setFromUnitVectors(dir, want);
    bone.updateMatrixWorld(true);
  }
  modelPos(bone, out) { return bone.getWorldPosition(out).applyMatrix4(this.meshInv); }

  // state: { speed, turn, terrain(x,z)->y, dt }
  update(dt, state) {
    const b = this.b, I = this.idle;
    this.time += dt;
    const v = Math.max(0, state.speed);
    this.speed = v;
    const g = this.gait = lerp(this.gait, sstep(2.0, 2.8, v), 1 - Math.exp(-dt * 6));
    // 小马腿短：步频随速度加快，步幅控制在 0.8 米左右
    const Twalk = lerp(1.05, 0.8, sstep(1.0, 1.9, v));
    const T = lerp(Twalk, 0.6, g);
    const duty = lerp(0.62, 0.43, g);
    const moving = sstep(0.05, 0.5, v);
    this.phase += dt / T * Math.max(moving, v > 0.02 ? 0.4 : 0);
    if (v < 0.02 && moving < 0.01) { /* 停住：相位冻结 */ }
    const ph = this.phase;
    this.grazeW = lerp(this.grazeW, this.mode === 'graze' && v < 0.05 ? 1 : 0, 1 - Math.exp(-dt * 1.2));
    const idleW = 1 - moving;
    // ---- 闲时状态机 ----
    if (idleW > 0.5) {
      I.lookT -= dt; if (I.lookT < 0) { I.lookT = 2.5 + Math.random() * 4; I.lookTarget = (Math.random() - 0.5) * 0.9 * (Math.random() < 0.3 ? 0 : 1); }
      I.rest += dt;
    } else { I.lookTarget = 0; I.rest = 0; }
    I.look = lerp(I.look, I.lookTarget, 1 - Math.exp(-dt * 1.5));
    I.earT -= dt; if (I.earT < 0) { I.earT = 1.5 + Math.random() * 4; const w = Math.random(); if (w < 0.4) I.earL = 1; else if (w < 0.8) I.earR = 1; else { I.earL = I.earR = 0.6; } }
    I.earL = Math.max(0, I.earL - dt * 0.9); I.earR = Math.max(0, I.earR - dt * 0.9);
    I.swishT -= dt; if (I.swishT < 0) { I.swishT = 4 + Math.random() * 7; I.swish = 1; }
    I.swish = Math.max(0, I.swish - dt * 0.8);
    this.restW = lerp(this.restW, idleW > 0.9 && I.rest > 5 && this.grazeW < 0.5 ? 1 : 0, 1 - Math.exp(-dt * 1.5));

    // ---- 身体 ----
    const breath = Math.sin(this.time * 2 * Math.PI / 3.4);
    const bobWalk = (0.012 + 0.006 * v) * Math.cos(4 * Math.PI * (ph + 0.12));
    const bobTrot = -0.032 * Math.cos(4 * Math.PI * ph);
    const bob = lerp(bobWalk, bobTrot, g) * moving;
    const pitch = (lerp(1.0, 0.7, g) * Math.sin(4 * Math.PI * ph + 0.6) * DEG) * moving;
    const roll = (lerp(1.6, 0.6, g) * Math.sin(2 * Math.PI * ph) * DEG) * moving - (state.turn || 0) * 0.03 * v;
    b.body.position.copy(this.restLocal.body); b.body.position.y += bob - 0.01 * this.grazeW;
    b.body.rotation.set(pitch + (state.slope || 0) * 0.6, 0, roll - this.restW * 1.5 * DEG);
    b.chest.scale.set(1 + 0.012 * breath * idleW, 1 + 0.008 * breath * idleW, 1);
    b.pelvis.rotation.set(0, 0, this.restW * 2.5 * DEG);
    // 脖子和头：慢步时随前蹄点头，小跑时稳定；转弯时朝弯里偏
    const nod = Math.cos(4 * Math.PI * (ph - 0.3)) * lerp(4.5, 1.2, g) * DEG * moving;
    const turnYaw = THREE.MathUtils.clamp((state.turn || 0) * 0.35, -0.35, 0.35);
    const look = I.look * idleW;
    const graze = this.grazeW;
    b.neck1.rotation.set(nod * 0.6 + graze * 38 * DEG - g * 4 * DEG, turnYaw * 0.4 + look * 0.35, 0);
    b.neck2.rotation.set(nod * 0.5 + graze * 30 * DEG + Math.sin(this.time * 0.7) * 1.2 * DEG * idleW, turnYaw * 0.35 + look * 0.35, 0);
    b.head.rotation.set(nod * 0.4 + graze * 22 * DEG - g * 6 * DEG + Math.sin(this.time * 1.3) * graze * 3 * DEG, turnYaw * 0.2 + look * 0.25, look * -0.15);
    // 耳朵：偶尔转一下
    const earBase = -0.05 - g * 0.12;
    b.earL.rotation.set(earBase - I.earL * 0.5, I.earL * 0.6, 0);
    b.earR.rotation.set(earBase - I.earR * 0.5, -I.earR * 0.6, 0);
    // 尾巴：走路时左右摆，偶尔甩一下
    const sw = Math.sin(I.swish * Math.PI * 3) * I.swish;
    const tails = ['tail1', 'tail2', 'tail3', 'tail4'];
    tails.forEach((n, i) => {
      const a = (4 + i * 2.2) * DEG * moving * lerp(1, 0.6, g);
      const yaw = a * Math.sin(2 * Math.PI * ph - i * 0.7) + sw * (8 + i * 6) * DEG + Math.sin(this.time * 0.9 - i * 0.5) * 2 * DEG * idleW;
      const lift = i === 0 ? -g * 14 * DEG - moving * 3 * DEG : i === 1 ? g * 6 * DEG : 0;
      b[n].rotation.set(lift + Math.sin(this.time * 1.1 - i) * 0.6 * DEG, yaw, 0);
    });

    // ---- 世界矩阵（腿的根要跟着身体） ----
    this.mesh.updateMatrixWorld(true);
    this.meshInv = _m.copy(this.mesh.matrixWorld).invert().clone();
    this.mesh.getWorldQuaternion(_q); this.meshQInv = _q.clone().invert();

    // ---- 四条腿 ----
    for (const L of this.legs) {
      const off = lerp(L.walk, L.trot === 0 && L.walk > 0.5 ? 1 : L.trot, g);
      const p = frac(ph - off);
      const stance = p < duty;
      const Ls = v * duty * T * moving;
      const liftA = (L.front ? lerp(0.1, 0.17, g) : lerp(0.085, 0.13, g)) * sstep(0.05, 0.9, v);
      const tgt = L.neutral.clone();
      let fold = 0, curl = 0;
      if (stance) {
        const u = p / duty;
        tgt.z += Ls / 2 - Ls * u;
        curl = 30 * DEG * sstep(0.72, 1, u) * moving;
        fold = (L.front ? 10 : 8) * DEG * sstep(0.8, 1, u) * moving;
      } else {
        const u = (p - duty) / (1 - duty);
        const e = u * u * (3 - 2 * u);
        tgt.z += -Ls / 2 + Ls * e;
        tgt.y += liftA * Math.pow(Math.sin(Math.PI * Math.min(1, u * (L.front ? 1.08 : 1.0))), 0.85);
        tgt.x *= 1 - 0.07 * Math.sin(Math.PI * u) * moving;
        const pk = L.front ? lerp(75, 105, g) : lerp(38, 58, g);
        fold = pk * DEG * Math.pow(Math.sin(Math.PI * Math.min(1, u / 0.88)), 1.2) * sstep(0.05, 0.8, v);
        if (!L.front) fold += 8 * DEG * (1 - u) * sstep(0.05, 0.8, v);
        curl = (30 * Math.pow(1 - u, 2) + lerp(60, 90, g) * Math.pow(Math.sin(Math.PI * u), 1.2) - 10 * sstep(0.7, 0.95, u) * (1 - sstep(0.95, 1, u))) * DEG * sstep(0.05, 0.8, v);
      }
      // 后腿休息：一条后腿蹄尖点地
      if (L.id === 'RH' && this.restW > 0.01) {
        tgt.z += 0.05 * this.restW; tgt.y += 0.03 * this.restW; curl += 50 * DEG * this.restW; fold += 22 * DEG * this.restW;
      }
      // 地形高度：把目标点放到脚下的地面上
      if (state.terrain) {
        _v.copy(tgt).applyMatrix4(this.mesh.matrixWorld);
        const gy = state.terrain(_v.x, _v.z);
        _v2.set(_v.x, gy, _v.z).applyMatrix4(this.meshInv);
        tgt.y += _v2.y;
      }
      // 落地事件
      if (stance && !L.lastStance && v > 0.1 && this.onStep) {
        _v.copy(tgt).applyMatrix4(this.mesh.matrixWorld);
        this.onStep(L.id, _v.clone(), g);
      }
      L.lastStance = stance;
      this.solveLeg(L, tgt, fold, curl);
    }
  }

  solveLeg(L, H, fold, curl) {
    const [n0, n1, n2, n3] = L.chain;
    // 蹄子绕球节卷起：pastern 向量绕 X 轴转 curl
    const pv = L.pv.clone().applyAxisAngle(new THREE.Vector3(1, 0, 0), curl);
    const F = H.clone().sub(pv);
    const J0 = this.modelPos(this.b[n0], new THREE.Vector3());
    const interior = L.restInterior - fold * (L.front ? 1 : 1);
    const Leff = Math.sqrt(L.l2 * L.l2 + L.l3 * L.l3 - 2 * L.l2 * L.l3 * Math.cos(interior));
    // 第一段：J0 → J1，第二段（等效长度）J1 → F；前腿肘往后，后腿膝往前
    const J1 = twoBone(J0, F, L.l1, Leff, new THREE.Vector3(0, 0, L.front ? -1 : 1));
    // 中间关节（腕/飞节）：前腿往前凸，后腿往后凸
    const J2 = twoBone(J1, F, L.l2, L.l3, new THREE.Vector3(0, 0, L.front ? 1 : -1));
    this.aim(n0, J1);
    this.aim(n1, J2);
    this.aim(n2, F);
    this.aim(n3, H);
  }
}

// 两段骨骼的反向动力学：从 A 出发，长度 a、b，末端到 C，中间关节偏向 pole 一侧
function twoBone(A, C, a, b, pole) {
  const d = C.clone().sub(A);
  let len = d.length();
  const dir = d.clone().normalize();
  len = Math.min(Math.max(len, Math.abs(a - b) + 1e-4), a + b - 1e-4);
  const cosA = (a * a + len * len - b * b) / (2 * a * len);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const side = pole.clone().addScaledVector(dir, -pole.dot(dir));
  if (side.lengthSq() < 1e-8) side.set(0, 1, 0);
  side.normalize();
  return A.clone().addScaledVector(dir, a * cosA).addScaledVector(side, a * sinA);
}
