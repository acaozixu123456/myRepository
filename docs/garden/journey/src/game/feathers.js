// 风羽：散在各处的小考验，做到了给一根发光的羽毛；每攒三根，气力多一格。
// 五种：
//   high  高处的羽毛 —— 礁石顶、灯塔尖、风车顶、上升的风的顶上、冰湖中央，飘着一根，碰到就拿到（爬、游、滑翔，怎么上去都行）
//   ring  风环 —— 观景点外面天上一串光环，张着翅膀在限定时间里一个个穿过去
//   chase 风铃 —— 路边挂着风铃的木桩，摇一下，一团光飞到前面远处，赶在它散掉之前追上
//   lamp  石灯 —— 一片林子里藏着三盏小石灯，都点亮
//   folk  心愿 —— 偶遇的人想要点什么（材料或者做好的菜），带给他
// 这里管位置、模型、每帧的判断；拿到了记在 Journey 里（J.feathers、J.lamps，随存档）。
import * as THREE from 'three';
import { ISLE_TOP, isleTop } from '../world/isles.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { U, patch } from '../world/atmo.js';
import { rng } from '../world/noise.js';
import { ROAD, SPOTS, TRAIL, CAPEWAY, VISTAS, STACKS, LIGHTHOUSE, LAKE } from '../world/route.js';
import { part, cyl, cone, ball } from '../world/forage.js';
import { itemOf, dishOf } from './cook.js';

const DEG = Math.PI / 180;
export const FEATHER_KINDS = [
  { id: 'high', name: '高处的羽毛', sub: '飘在不好去的地方，想办法过去' },
  { id: 'ring', name: '风环', sub: '张着翅膀，赶在光环散掉之前一个个穿过去' },
  { id: 'chase', name: '风铃', sub: '摇一下路边的风铃，追上飞走的那团光' },
  { id: 'lamp', name: '石灯', sub: '林子里藏着三盏，都点亮' },
  { id: 'folk', name: '心愿', sub: '路上遇到的人想要点什么' },
];
// 偶遇的人想要什么：items 材料 { id: 几个 } 或者 dish 一份做好的菜
export const WISHES = {
  lantern: { id: 'qLantern', dish: 'honeyTea', ask: '夜里凉，要是有一壶甜甜的热茶就好了。听说蜜花煮一煮就是。', thanks: '蜜花茶！还是热的。这根羽毛是我夜里捡的，会发光，送你。' },
  painter: { id: 'qPainter', items: { berry: 3 }, ask: '我的红颜料用完了。你要是摘得到野莓，给我三颗，我自己捣。', thanks: '就是这个颜色！这根羽毛我本来想画下来的，你拿去吧，比放在我这儿有用。' },
  fisher: { id: 'qFisher', dish: 'soup', ask: '海边风大，坐久了想喝口热汤。蘑菇和溪葱煮的那种，你会做吗？', thanks: '嗬，这汤鲜。鱼没钓着，倒钓上来过这么根羽毛，归你了。' },
  hiker: { id: 'qHiker', items: { chestnut: 2 }, ask: '听说红叶谷的栗子好，我路过两回都没顾上捡。你有的话分我两颗？', thanks: '谢啦，路上有嚼头了。这根羽毛是我在雪线上捡的，拿着它好像走路都轻一点。' },
  keeper: { id: 'qKeeper', items: { pine: 2 }, ask: '塔上住着一窝海鸟，就爱吃松子。西岭松林里捡得到，你顺路带两把来？', thanks: '它们有口福了。这根羽毛是那窝鸟落在塔顶的，夜里会亮，给你。' },
};

const GLOW_VS = /* glsl */`
attribute float aA; attribute float aS;
uniform float uPx; uniform float uTime;
varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4( position, 1.0 );
  gl_Position = projectionMatrix * mv;
  float d = max( -mv.z, 0.1 );
  // 走近了光晕淡下去，看得清里面的东西
  vA = aA * mix( 0.14, 1.0, smoothstep( 4.0, 22.0, d ) ) * smoothstep( 1.0, 3.5, d ) * ( 1.0 - smoothstep( 260.0, 340.0, d ) ) * ( 0.8 + 0.2 * sin( uTime * 2.3 + position.x ) );
  gl_PointSize = clamp( uPx * aS / d, 5.0, 120.0 );
  if ( vA < 0.01 ) gl_Position = vec4( 0.0, 0.0, 2.0, 1.0 );
}`;
const GLOW_FS = /* glsl */`
varying float vA;
void main() {
  float r = length( gl_PointCoord - 0.5 ) * 2.0;
  float a = ( pow( max( 0.0, 1.0 - r ), 2.2 ) + 0.5 * pow( max( 0.0, 1.0 - r * 3.0 ), 2.0 ) ) * vA;
  if ( a < 0.01 ) discard;
  gl_FragColor = vec4( 1.0, 0.93, 0.66, min( a, 0.85 ) );
  #include <colorspace_fragment>
}`;

// 一根羽毛：细长的一片，中间一道羽轴
function featherGeo() {
  const g = new THREE.PlaneGeometry(0.26, 0.9, 2, 6), P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const y = P.getY(i) / 0.9 + 0.5, w = Math.sin(Math.min(1, y * 1.15) * Math.PI) ** 0.7 * (1 - 0.35 * y);
    P.setX(i, P.getX(i) * w + 0.08 * Math.sin(y * 2.2)); P.setZ(i, 0.05 * Math.sin(y * 3.0) + Math.abs(P.getX(i)) * 0.25);
  }
  g.computeVertexNormals();
  return g;
}

export class Feathers {
  // o: { land, places, thermals（上升的风的清单）, sites（营地，石灯别摆在上面）}
  constructor(o) {
    const land = this.land = o.land, places = o.places;
    this.group = new THREE.Group(); this.group.name = 'feathers';
    this.list = []; this.t = 0; this.run = null; this.chase = null; this.sayT = 0;
    const P = id => places.find(p => p.id === id), p = {};
    const gold = new THREE.MeshBasicMaterial({ color: '#fff0b8', side: THREE.DoubleSide });
    const fg = featherGeo();
    this.glows = [];
    const glow = (x, y, z, s, a = 1) => { const G = { x, y, z, s, a }; this.glows.push(G); return G; };

    // ---- 高处的羽毛 ----
    const high = (id, name, clue, x, y, z) => {
      const m = new THREE.Mesh(fg, gold); m.position.set(x, y, z); m.rotation.z = 0.35; this.group.add(m);
      this.list.push({ id, kind: 'high', name, clue, x, y, z, mesh: m, glow: glow(x, y, z, 2.6) });
    };
    const top = (x, z) => land.heightExact(x, z);
    { const T = o.thermals.find(t => t.id === 'meadow'); high('hSky', '花田上空', '东坡花田那股上升的风，张着翅膀让它托到顶', T.x, T.y + T.h - 9, T.z); }
    { const m = P('mill'); high('hMill', '风车顶上', '风车的尖顶上面。旁边坡上有一股风，升上去再滑过来', m.x, top(m.x, m.z) + 12.5, m.z); }
    high('hStack', '最高的礁石', '西湾海里最高的那根礁石顶上', STACKS[0][0], top(STACKS[0][0], STACKS[0][1]) + 1.5, STACKS[0][1]);
    high('hStack2', '靠岸的礁石', '西湾靠岸近一点的那根礁石顶上，游过去爬上去也行', STACKS[1][0], top(STACKS[1][0], STACKS[1][1]) + 1.5, STACKS[1][1]);
    high('hLight', '灯塔尖', '海角灯塔的塔尖上面', LIGHTHOUSE.x, top(LIGHTHOUSE.x, LIGHTHOUSE.z) + 19.5, LIGHTHOUSE.z);
    { const E = ISLE_TOP, x = E.x - 3, z = E.z - 2; high('hIsle', '最高的浮岛', '镜之原上空最高的那座岛上。乘着风，一座一座上去', x, isleTop(x, z) + 1.5, z); }
    high('hLake', '冰湖中央', '冰湖正中间的冰面上。路远，上面冷，带点热的再去', LAKE.x, top(LAKE.x, LAKE.z) + 1.6, LAKE.z);

    // ---- 风环 ----
    const ringGeo = new THREE.TorusGeometry(4.2, 0.2, 6, 40);
    const course = (id, vid, name, turn) => {
      const V = VISTAS.find(v => v.id === vid); let a = V.f * DEG, x = V.x + Math.sin(a) * 36, z = V.z + Math.cos(a) * 36, y = top(V.x, V.z) + 15;
      const rings = [];
      for (let i = 0; i < 5; i++) {
        const yy = Math.max(y, land.surfaceY(x, z) + 8);
        const mat = new THREE.MeshBasicMaterial({ color: '#ffe08a', transparent: true, opacity: 0.5, depthWrite: false });
        const m = new THREE.Mesh(ringGeo, mat); m.position.set(x, yy, z); m.rotation.y = a; this.group.add(m);
        rings.push({ x, y: yy, z, mesh: m, mat, glow: glow(x, yy, z, 5, 0.3) });
        a += turn * DEG; x += Math.sin(a) * 38; z += Math.cos(a) * 38; y = yy - 6;
      }
      this.list.push({ id, kind: 'ring', name, clue: `${V.name}外面的天上有一串光环：从石堆旁那股风里升起来，张着翅膀一个个穿过去`, rings, limit: 42, x: rings[0].x, z: rings[0].z });
    };
    course('rEast', 'vEast', '东岭的风环', 7); course('rCove', 'vCove', '望海坡的风环', -6); course('rSnow', 'vSnow', '雪脊的风环', 6);

    // ---- 风铃 ----
    const wood = new THREE.MeshLambertMaterial({ vertexColors: true }); patch(wood, { rim: 0.15, gobo: true, fog: true });
    const postGeo = mergeGeometries([part(cyl(0.05, 0.07, 1.9, 6), '#6b4a30', { p: [0, 0.95, 0] }), part(cyl(0.03, 0.03, 0.7, 5), '#6b4a30', { p: [0.3, 1.82, 0], r: [0, 0, Math.PI / 2] }), part(cyl(0.006, 0.006, 0.28, 4), '#d8c9a0', { p: [0.55, 1.68, 0] })]);
    const bellGeo = mergeGeometries([part(cone(0.1, 0.17, 8), '#e2b23c', { p: [0, -0.08, 0] }), part(ball(0.03), '#b8862a', { p: [0, -0.2, 0] }), part(new THREE.PlaneGeometry(0.07, 0.3), '#c8462e', { p: [0, -0.38, 0] })]);
    const wispGeo = new THREE.IcosahedronGeometry(0.28, 1);
    const chase = (id, name, where, path, s0, len, limit) => {
      s0 = Math.max(2, Math.min(path.length - len - 2, s0));
      path.at(s0, p); const ax = p.x - p.tz * 2.3, az = p.z + p.tx * 2.3;
      path.at(s0 + len, p); const bx = p.x, bz = p.z;
      const post = new THREE.Mesh(postGeo, wood); post.position.set(ax, top(ax, az) - 0.05, az); post.rotation.y = Math.atan2(bx - ax, bz - az) - Math.PI / 2; post.castShadow = true; this.group.add(post);
      const bell = new THREE.Mesh(bellGeo, wood); bell.position.set(0.55, 1.55, 0); post.add(bell);
      const wisp = new THREE.Mesh(wispGeo, new THREE.MeshBasicMaterial({ color: '#fff3c0' })); wisp.visible = false; this.group.add(wisp);
      this.list.push({ id, kind: 'chase', name, clue: `${where}有根挂着风铃的木桩。摇一下，追上飞走的那团光`, x: ax, z: az, y: top(ax, az), bx, bz, by: top(bx, bz) + 1.4, post, bell, wisp, limit, glow: glow(ax, top(ax, az) + 1.6, az, 1.3, 0.55), wglow: glow(bx, top(bx, bz) + 1.4, bz, 4.5, 0) });
    };
    chase('cValley', '谷地的风铃', '出发的地方往前一点，山路边上', ROAD, SPOTS.start + 16, 100, 30);
    chase('cCape', '海角的风铃', '沙滩往海角去的小路口', CAPEWAY, 6, 104, 36);
    chase('cAutumn', '红叶谷的风铃', '红叶谷的溪边小路旁', TRAIL, TRAIL.nearest(P('autumn').x, P('autumn').z, 80).s - 40, 100, 34);

    // ---- 石灯 ----
    const stone = new THREE.MeshLambertMaterial({ vertexColors: true }); patch(stone, { rim: 0.1, gobo: true, fog: true });
    const lampGeo = mergeGeometries([part(new THREE.BoxGeometry(0.46, 0.14, 0.46), '#8d8a80', { p: [0, 0.07, 0] }), part(cyl(0.1, 0.13, 0.5, 6), '#99958a', { p: [0, 0.39, 0] }), part(new THREE.BoxGeometry(0.4, 0.07, 0.4), '#8d8a80', { p: [0, 0.67, 0] }),
      part(cone(0.36, 0.26, 4), '#7d7a72', { p: [0, 1.1, 0], r: [0, Math.PI / 4, 0] }), part(ball(0.05), '#7d7a72', { p: [0, 1.26, 0] })]);
    const boxGeo = new THREE.BoxGeometry(0.3, 0.26, 0.3);
    const lamps = (id, pid, name, where, seed) => {
      const C = P(pid), R = rng(seed), set = [];
      for (let t = 0; t < 600 && set.length < 3; t++) {
        const a = R() * 6.283, d = 12 + R() * 30, x = C.x + Math.cos(a) * d, z = C.z + Math.sin(a) * d;
        if (land.normal(x, z)[1] < 0.9 || land.seaDepth(x, z) > 0 || land.streamDist(x, z) < 5 || land.roadDist(x, z) < 3) continue;
        if (set.some(s => Math.hypot(x - s.x, z - s.z) < 17) || o.sites.some(S => Math.hypot(x - S.fireAt.x, z - S.fireAt.z) < 9)) continue;
        const y = top(x, z), g = new THREE.Mesh(lampGeo, stone); g.position.set(x, y - 0.04, z); g.rotation.y = R() * 6; g.castShadow = true; this.group.add(g);
        const box = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: '#3a3632' })); box.position.set(0, 0.84, 0); g.add(box);
        set.push({ lid: `${id}${set.length}`, x, y, z, box, glow: glow(x, y + 0.84, z, 2.2, 0) });
      }
      this.list.push({ id, kind: 'lamp', name, clue: `${where}藏着三盏小石灯，都点亮`, lamps: set, x: C.x, z: C.z });
    };
    lamps('lBamboo', 'bamboo', '竹林的石灯', '竹林山坳里', 9101); lamps('lPine', 'west', '松林的石灯', '西岭松林里', 9202);

    // ---- 心愿（人在 folk.js，这里只记名字和线索）----
    const WHO = { lantern: '提灯的人', painter: '画画的人', fisher: '钓鱼的老伯', hiker: '背包客', keeper: '守灯人' };
    for (const [fid, W] of Object.entries(WISHES)) this.list.push({ id: W.id, kind: 'folk', name: `${WHO[fid]}的心愿`, clue: '路上遇到的人里，有一位想要点什么。跟他多聊一句', wish: W, fid });

    // 光晕：一次画完
    const n = this.glows.length, pos = new Float32Array(n * 3), aA = new Float32Array(n), aS = new Float32Array(n);
    this.glows.forEach((G, i) => { G.i = i; pos.set([G.x, G.y, G.z], i * 3); aA[i] = G.a; aS[i] = G.s; });
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); gg.setAttribute('aA', new THREE.BufferAttribute(aA, 1)); gg.setAttribute('aS', new THREE.BufferAttribute(aS, 1));
    this.glowMat = new THREE.ShaderMaterial({ uniforms: { uTime: U.uTime, uPx: { value: 1200 } }, vertexShader: GLOW_VS, fragmentShader: GLOW_FS, transparent: true, depthWrite: false });
    const pts = new THREE.Points(gg, this.glowMat); pts.frustumCulled = false; pts.renderOrder = 7; this.group.add(pts);
    this.glowGeo = gg;
  }
  of(id) { return this.list.find(f => f.id === id); }
  setGlow(G, a, x, y, z) {
    const A = this.glowGeo.attributes;
    if (A.aA.array[G.i] !== a) { A.aA.array[G.i] = a; A.aA.needsUpdate = true; }
    if (x !== undefined) { A.position.setXYZ(G.i, x, y, z); A.position.needsUpdate = true; }
  }
  // 按存档摆一遍（拿过的羽毛收起来，点过的灯亮着）
  refresh(J) {
    this.run = null; this.chase = null;
    for (const F of this.list) {
      const got = J.feathers.has(F.id);
      if (F.kind === 'high') { F.mesh.visible = !got; this.setGlow(F.glow, got ? 0 : 1); }
      if (F.kind === 'ring') for (const R of F.rings) { R.mesh.visible = !got; this.setGlow(R.glow, got ? 0 : 0.3); }
      if (F.kind === 'chase') { F.wisp.visible = false; this.setGlow(F.wglow, 0); this.setGlow(F.glow, got ? 0 : 0.55); }
      if (F.kind === 'lamp') for (const L of F.lamps) this.light(L, J.lamps.has(L.lid));
    }
  }
  light(L, on) { L.box.material.color.set(on ? '#ffd27a' : '#3a3632'); this.setGlow(L.glow, on ? 0.8 : 0); }

  // 走到风铃桩、石灯跟前，互动按钮上写什么
  actionText(J) {
    const a = this.nearThing(J);
    return a ? (a.F.kind === 'chase' ? '摇风铃' : '点亮石灯') : '';
  }
  nearThing(J) {
    if (J.mode !== 'foot') return null;
    for (const F of this.list) {
      if (F.kind === 'chase' && !J.feathers.has(F.id) && !this.chase && Math.hypot(J.p.x - F.x, J.p.z - F.z) < 2.6) return { F };
      if (F.kind === 'lamp') for (const L of F.lamps) if (!J.lamps.has(L.lid) && Math.hypot(J.p.x - L.x, J.p.z - L.z) < 2.3) return { F, L };
    }
    return null;
  }
  act(J) {
    const a = this.nearThing(J); if (!a) return false;
    const F = a.F;
    J.T.play('Interact', 0.9, 0.15);
    if (F.kind === 'chase') {
      this.chase = { F, t: F.limit }; F.wisp.visible = true; F.wisp.position.set(F.bx, F.by, F.bz); this.setGlow(F.wglow, 1);
      F.swing = 1.4; J.sound.chime?.(0.6);
      J.say(`一团光飞到前面去了\n${F.limit} 秒里追上它`, 3); this.sayT = 3;
    } else {
      J.lamps.add(a.L.lid); this.light(a.L, true); J.sound.chime?.(0.4);
      const n = F.lamps.filter(L => J.lamps.has(L.lid)).length;
      if (n >= F.lamps.length) J.award(F.id); else J.say(`石灯亮了（${n}/${F.lamps.length}），这附近还有`, 3.5);
    }
    return true;
  }

  // 每帧。px：屏幕上一米多少像素（光晕的大小）
  update(dt, J, px) {
    this.t += dt; this.glowMat.uniforms.uPx.value = px;
    const p = J.p, play = J.phase === 'play', t = this.t;
    for (const F of this.list) {
      const got = J.feathers.has(F.id);
      if (F.kind === 'high' && !got) {
        F.mesh.rotation.y = t * 1.3 + F.x; F.mesh.position.y = F.y + 0.25 * Math.sin(t * 1.6 + F.z);
        if (play && Math.hypot(p.x - F.x, p.z - F.z) < 2.6 && Math.abs(p.y + 0.9 - F.y) < 3.2) { F.mesh.visible = false; this.setGlow(F.glow, 0); J.award(F.id); }
      }
      if (F.kind === 'chase' && F.swing > 0) { F.swing -= dt; F.bell.rotation.z = Math.sin(t * 14) * 0.5 * Math.max(0, F.swing); }
      if (F.kind === 'ring' && !got) {
        const act = this.run && this.run.F === F ? this.run : null;
        F.rings.forEach((R, i) => {
          const next = act ? i === act.i : i === 0, gone = act && i < act.i;
          R.mesh.visible = !gone; R.mat.opacity = next ? 0.75 + 0.2 * Math.sin(t * 5) : 0.3;
          R.mesh.scale.setScalar(next ? 1 + 0.04 * Math.sin(t * 5) : 1);
          this.setGlow(R.glow, gone ? 0 : next ? 0.6 : 0.25);
        });
        if (play && J.mode === 'fly') {
          const i = act ? act.i : 0, R = F.rings[i];
          if ((!this.run || act) && Math.hypot(p.x - R.x, p.y + 0.8 - R.y, p.z - R.z) < 4.6) {
            J.sound.chime?.(0.35 + 0.08 * i);
            if (!act) { this.run = { F, i: 1, t: F.limit }; J.say(`穿过去了！后面还有 ${F.rings.length - 1} 个，${F.limit} 秒`, 3); this.sayT = 3; }
            else if (++act.i >= F.rings.length) { this.run = null; for (const Q of F.rings) { Q.mesh.visible = false; this.setGlow(Q.glow, 0); } J.award(F.id); }
          }
        }
      }
    }
    // 限时的两种：倒数，到点没做完就重来
    const count = (A, text, fail) => {
      A.t -= dt; this.sayT -= dt;
      if (A.t <= 0) { fail(); return false; }
      if (this.sayT <= 0 && play) { J.say(`${text}  ${Math.ceil(A.t)}`, 1.3); this.sayT = 1; }
      return true;
    };
    if (this.run) {
      const A = this.run;
      if (J.mode !== 'fly' && !J.trans) { this.run = null; J.say('落地了，光环又亮回来了\n回到第一个再来', 4); }
      else if (!count(A, `光环 ${A.i}/${A.F.rings.length}`, () => { this.run = null; J.say('光环散了又聚回来了\n回到第一个再来', 4); })) { /* 重来 */ }
    }
    if (this.chase) {
      const A = this.chase, F = A.F;
      F.wisp.position.y = F.by + 0.25 * Math.sin(t * 3); F.wisp.rotation.y = t * 2;
      const end = () => { this.chase = null; F.wisp.visible = false; this.setGlow(F.wglow, 0); };
      if (Math.hypot(p.x - F.bx, p.z - F.bz) < 2.8 && Math.abs(p.y - F.by) < 5) { end(); this.setGlow(F.glow, 0); J.award(F.id); }
      else count(A, '追上那团光', () => { end(); J.say('光散了。回去再摇一次风铃', 4); });
    }
  }
}

// 这个人想要的东西，行囊里有没有
export function canGive(J, W) {
  if (W.dish) return J.dishes.some(d => d.id === W.dish);
  return Object.entries(W.items).every(([k, n]) => (J.bag[k] || 0) >= n);
}
export function give(J, W) {
  if (W.dish) { const i = J.dishes.findIndex(d => d.id === W.dish); if (i >= 0) J.dishes.splice(i, 1); return; }
  for (const [k, n] of Object.entries(W.items)) { J.bag[k] -= n; if (J.bag[k] <= 0) delete J.bag[k]; }
}
export const wishText = W => W.dish ? `一份${dishOf(W.dish).name}` : Object.entries(W.items).map(([k, n]) => `${n} 个${itemOf(k).name}`).join('、');
