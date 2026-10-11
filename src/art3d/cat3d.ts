// 程序化 3D 小猫：真关节（FK 层级），手臂 = 肩 → 上臂 → 肘 → 前臂 → 爪，天然连在一起。
// 一只猫由 CatLook 自动生成（毛色 / 五官 / 耳 / 尾 / 体型）；头饰 / 衣服 / 披挂 / 武器 / 配饰交给 parts/ 里的部件函数。
import * as THREE from 'three';
import type { CatLook, EyeStyle } from '../art/types';
import { HERO_PARTS } from './heroes';
import { buildPart } from './parts';
import type { PartCtx } from './parts/types';
import { capsule, solid, sphere, toon } from './toon';
import { coatTexture } from './patterns';

export interface Joints {
  root: THREE.Group; // 整猫（朝向 / 缩放）
  hip: THREE.Group; // 髋（整体上下）
  torso: THREE.Group; // 躯干（呼吸 / 前倾）
  neck: THREE.Group;
  head: THREE.Group;
  earL: THREE.Group;
  earR: THREE.Group;
  shoulderL: THREE.Group;
  shoulderR: THREE.Group;
  elbowL: THREE.Group;
  elbowR: THREE.Group;
  hipL: THREE.Group;
  hipR: THREE.Group;
  kneeL: THREE.Group;
  kneeR: THREE.Group;
  tail: THREE.Group[];
  eyes: THREE.Object3D[]; // 眨眼用
}
export interface Sockets {
  headTop: THREE.Object3D;
  face: THREE.Object3D;
  handR: THREE.Object3D;
  handL: THREE.Object3D;
  back: THREE.Object3D;
  torso: THREE.Object3D;
}
export interface Cat3D { look: CatLook; root: THREE.Group; j: Joints; sock: Sockets; build: number; phase: number }

const grp = (name: string, x = 0, y = 0, z = 0): THREE.Group => { const g = new THREE.Group(); g.name = name; g.position.set(x, y, z); return g; };

const EYE: Record<EyeStyle, { h: number; tilt: number; w?: number; lid?: number; arc?: boolean }> = {
  round: { h: 1.25, tilt: 0 },
  sharp: { h: 0.82, tilt: -0.28, w: 1.1 },
  sleepy: { h: 0.9, tilt: 0.05, lid: 0.5 },
  happy: { h: 1, tilt: 0, arc: true },
  fierce: { h: 0.85, tilt: -0.4 },
  calm: { h: 1, tilt: -0.08, lid: 0.25 },
  wink: { h: 1.2, tilt: 0 },
  wide: { h: 1.5, tilt: 0 },
  keen: { h: 0.95, tilt: -0.2 },
  cool: { h: 0.75, tilt: -0.12, lid: 0.3 },
};

function buildEye(look: CatLook, side: 1 | -1, fur: string, pink: string): THREE.Group {
  const st = EYE[look.eye.style];
  const g = grp('eye', side * 0.27, 0.06, 0.5);
  const arcWink = st.arc || (look.eye.style === 'wink' && side === -1);
  if (arcWink) {
    // 笑眼：一道弧线
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.028, 6, 14, Math.PI), toon('#3a2430'));
    arc.rotation.z = 0;
    arc.position.z = 0.04;
    g.add(arc);
    return g;
  }
  const w = (st.w ?? 1) * 0.15, h = 0.15 * st.h;
  const white = new THREE.Mesh(sphere(1, w, h, 0.07, 14), toon('#fffaf0'));
  white.position.z = 0.0;
  const iris = new THREE.Mesh(sphere(1, w * 0.82, h * 0.86, 0.07, 14), toon(look.eye.color));
  iris.position.z = 0.03;
  const pupil = new THREE.Mesh(sphere(1, w * 0.36, h * 0.7, 0.07, 10), toon('#241820'));
  pupil.position.z = 0.055;
  const hi = new THREE.Mesh(sphere(1, w * 0.26, w * 0.26, 0.05, 8), toon('#ffffff', { emissive: '#ffffff' }));
  hi.position.set(-w * 0.28 * side, h * 0.3, 0.08);
  g.add(white, iris, pupil, hi);
  if (st.lid) {
    // 半睁：用毛色的半圆眼睑盖住上半部分
    const lid = new THREE.Mesh(sphere(1, w * 1.12, h * 1.05, 0.09, 12), toon(fur));
    lid.position.set(0, h * (0.5 + st.lid * 0.6), 0.06);
    lid.scale.y = h * st.lid * 1.4;
    g.add(lid);
  }
  g.rotation.z = st.tilt * side;
  void pink;
  return g;
}

function buildEar(look: CatLook, side: 1 | -1, fur: string, pink: string): THREE.Group {
  const e = grp('ear', side * 0.38, 0.5, -0.02);
  const big = look.ear === 'big' ? 1.35 : 1;
  const outer = solid(new THREE.ConeGeometry(0.24 * big, 0.5 * big, 4), toon(fur), 0.02);
  outer.position.y = 0.22 * big;
  outer.rotation.y = Math.PI / 4;
  const inner = new THREE.Mesh(new THREE.ConeGeometry(0.15 * big, 0.34 * big, 4), toon(pink));
  inner.position.set(0, 0.17 * big, 0.065);
  inner.rotation.y = Math.PI / 4;
  e.add(outer, inner);
  e.rotation.z = -side * 0.32;
  if (look.ear === 'fold') { e.rotation.x = 0.55; }
  if (look.ear === 'round') { outer.scale.set(1.2, 0.7, 1.2); inner.scale.set(1.2, 0.7, 1.2); }
  if (look.ear === 'tuft') {
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.22, 4), toon('#2c2430'));
    tuft.position.y = 0.55;
    e.add(tuft);
  }
  return e;
}

export function buildCat3D(look: CatLook, heroId?: string): Cat3D {
  const o = look.outfit;
  const pal = o.pal;
  const fur = look.coat.base, light = look.coat.light, pink = look.coat.pink ?? '#f4a6b0';
  const build = look.build ?? 1;
  const headK = look.head ?? 1;
  const sleeve = pal.main;
  const ctx: PartCtx = { look, pal, fur, light, pink, glyph: o.glyph };
  const tex = coatTexture(look);
  const furMat = toon(fur, tex ? { map: tex, key: 'tex' + fur + look.coat.pattern } : {});
  const lightMat = toon(light);
  const sleeveMat = toon(sleeve);

  const root = grp('cat');
  const hip = grp('hip', 0, 0.5, 0);
  root.add(hip);
  const torso = grp('torso', 0, 0, 0);
  hip.add(torso);

  // ---- 腿 ----
  const mkLeg = (side: 1 | -1) => {
    const h = grp('hip' + side, side * 0.2 * build, 0, 0);
    const thigh = solid(capsule(0.13, 0.32), toon(pal.cloth ?? pal.main));
    thigh.position.y = -0.14;
    h.add(thigh);
    const knee = grp('knee', 0, -0.26, 0);
    const shin = solid(capsule(0.115, 0.3), furMat);
    shin.position.y = -0.1;
    knee.add(shin);
    const boot = solid(sphere(0.17, 1, 0.7, 1.45), toon(pal.trim === '#ffffff' ? '#5a3a2a' : '#4a3028'));
    boot.position.set(0, -0.25, 0.08);
    knee.add(boot);
    h.add(knee);
    hip.add(h);
    return { h, knee };
  };
  const legL = mkLeg(1), legR = mkLeg(-1);

  // ---- 躯干（底座：圆润的身体 + 腰带）----
  const body = solid(sphere(0.5 * build, 1, 1.18, 0.82), toon(pal.main));
  body.position.y = 0.42;
  torso.add(body);
  const belly = new THREE.Mesh(sphere(0.3 * build, 1, 1.1, 0.5), lightMat);
  belly.position.set(0, 0.36, 0.3);
  torso.add(belly);
  belly.visible = false; // 衣服遮住了，仅毛皮裸露的装束由 body 部件打开
  (torso as unknown as { userData: { belly: THREE.Object3D } }).userData.belly = belly;

  // ---- 脖子 + 头 ----
  const neck = grp('neck', 0, 1.2, 0);
  torso.add(neck);
  const head = grp('head', 0, 0.46, 0);
  neck.add(head);
  const skull = solid(sphere(0.62 * headK, 1.16, 1, 1.02, 28), furMat);
  skull.position.y = 0.14;
  head.add(skull);
  // 口鼻：浅色
  const muzzle = new THREE.Mesh(sphere(0.2, 1.3, 0.85, 0.8), lightMat);
  muzzle.position.set(0, -0.13, 0.5);
  head.add(muzzle);
  const nose = new THREE.Mesh(sphere(0.045, 1.4, 0.9, 0.8, 10), toon(pink));
  nose.position.set(0, -0.04, 0.63);
  head.add(nose);
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 5, 10, Math.PI), toon('#3a2430'));
  mouth.rotation.z = Math.PI;
  mouth.position.set(-0.05, -0.14, 0.64);
  const mouth2 = mouth.clone();
  mouth2.position.x = 0.05;
  head.add(mouth, mouth2);
  const eyes: THREE.Object3D[] = [];
  for (const s of [1, -1] as const) { const e = buildEye(look, s, fur, pink); e.position.y += 0.1; e.position.z = 0.52; head.add(e); eyes.push(e); }
  if (look.blush) for (const s of [1, -1]) { const b = new THREE.Mesh(sphere(0.09, 1.3, 0.7, 0.3, 10), toon('#ff9aa8')); b.position.set(s * 0.4, -0.06, 0.45); b.rotation.y = s * 0.7; head.add(b); }
  // 胡须
  const wMat = toon('#f4efe6');
  for (const s of [1, -1]) for (let i = 0; i < 3; i++) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.004, 0.42, 4), wMat);
    w.rotation.z = Math.PI / 2 + s * (i - 1) * 0.16;
    w.position.set(s * 0.46, -0.1 - (i - 1) * 0.04, 0.5);
    w.rotation.y = -s * 0.5;
    head.add(w);
  }
  const earL = buildEar(look, 1, fur, pink), earR = buildEar(look, -1, fur, pink);
  head.add(earL, earR);
  const headTop = grp('headTop', 0, 0.14 + 0.6 * headK, 0);
  const face = grp('face', 0, -0.04, 0.63);
  head.add(headTop, face);

  // ---- 手臂 ----
  const mkArm = (side: 1 | -1) => {
    const sh = grp('shoulder' + side, side * 0.5 * build, 1.02, 0);
    sh.rotation.z = -side * 0.12;
    const upper = solid(capsule(0.135, 0.42), sleeveMat);
    upper.position.y = -0.17;
    const elbow = grp('elbow', 0, -0.34, 0);
    const fore = solid(capsule(0.125, 0.38), sleeveMat);
    fore.position.y = -0.14;
    const cuff = solid(new THREE.CylinderGeometry(0.15, 0.17, 0.12, 14), toon(pal.trim), 0.02);
    cuff.position.y = -0.28;
    const paw = grp('paw', 0, -0.4, 0);
    const pawBall = solid(sphere(0.14, 1.05, 1, 1.05), toon(look.coat.pattern === 'tuxedo' ? light : fur), 0.022);
    const pad = new THREE.Mesh(sphere(0.05, 1.3, 0.9, 0.6, 8), toon(pink));
    pad.position.set(0, -0.02, 0.12);
    paw.add(pawBall, pad);
    for (const dx of [-0.07, 0, 0.07]) { const t = new THREE.Mesh(sphere(0.026, 1, 1, 0.6, 6), toon(pink)); t.position.set(dx, 0.07, 0.12); paw.add(t); }
    elbow.add(fore, cuff, paw);
    sh.add(upper, elbow);
    torso.add(sh);
    return { sh, elbow, paw };
  };
  const armL = mkArm(1), armR = mkArm(-1);

  // ---- 尾巴（链式关节）----
  const nSeg = look.tail === 'stub' ? 2 : look.tail === 'bushy' ? 6 : 7;
  const tail: THREE.Group[] = [];
  let parent: THREE.Object3D = torso;
  for (let i = 0; i < nSeg; i++) {
    const j = grp('tail' + i, i === 0 ? 0 : 0, i === 0 ? 0.15 : 0.0, i === 0 ? -0.4 : -0.2);
    const r = (look.tail === 'bushy' ? 0.15 : 0.1) * (1 - i * 0.06) * (look.tail === 'bushy' && i > 1 ? 1.25 : 1);
    const stripe = look.tail === 'ring' && i % 2 === 1;
    const seg = solid(sphere(r, 1, 1, 1.55, 12), stripe ? toon(look.coat.stripe ?? '#3a2a24') : furMat, 0.02);
    seg.position.z = -0.08;
    j.add(seg);
    j.rotation.x = i === 0 ? 0.9 : -0.18; // 尾巴先向后上方翘，再逐节上扬
    if (look.tail === 'curl') j.rotation.x = i === 0 ? 0.7 : -0.34;
    parent.add(j);
    parent = j;
    tail.push(j);
  }

  const handR = armR.paw, handL = armL.paw;
  const back = grp('back', 0, 0.95, -0.45);
  torso.add(back);
  const sock: Sockets = { headTop, face, handR, handL, back, torso };

  // ---- 装束 / 武器 / 配饰（部件函数）----
  const attach = (kind: string | undefined, group: string, to: THREE.Object3D) => {
    if (!kind || kind === 'none') return;
    // 英雄专属造型优先（如关云喵的青龙偃月刀）；没有就用通用部件库
    const own = heroId ? HERO_PARTS[heroId]?.[group as keyof (typeof HERO_PARTS)[string]] : undefined;
    const obj = own ? own(ctx) : buildPart(group as never, kind, ctx);
    if (obj) to.add(obj);
  };
  attach(o.body ?? 'robeScholar', 'body', torso);
  attach(o.head, 'headgear', headTop);
  attach(o.back, 'back', back);
  attach(o.weapon, 'weapon', handR);
  for (const x of o.extra ?? []) attach(x, 'extra', head);

  const j: Joints = {
    root, hip, torso, neck, head, earL, earR, shoulderL: armL.sh, shoulderR: armR.sh, elbowL: armL.elbow, elbowR: armR.elbow,
    hipL: legL.h, hipR: legR.h, kneeL: legL.knee, kneeR: legR.knee, tail, eyes,
  };
  return { look, root, j, sock, build, phase: Math.random() * 6.28 };
}
