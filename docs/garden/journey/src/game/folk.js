// 偶遇的人：五个在路上碰得到的人，各有各的时辰和地方（夜里提灯散步的、上午在红叶谷画画的、下午在沙滩钓鱼的、
// 白天沿着溪边小路走的背包客、傍晚去点灯的守灯人）。和旅人是同一种画风（用代码捏的，actors/sculpt.js），每人一身自己的打扮；
// 走到跟前点「打个招呼」，他们会说两句话，顺便告诉你哪儿藏着好东西（地图上会标出来）。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { ROAD, SPOTS, STREAM, TRAIL, CREEK_END, LIGHTHOUSE, SEA } from '../world/route.js';
import { patch } from '../world/atmo.js';
import { makePack } from '../actors/traveler.js';

const _hp = new THREE.Vector3();
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

// 每个人：在哪（x, z, yaw）、什么时候在（when）、什么姿势、说什么、告诉你什么（tips：见闻的 id）
export function makeFolk(places) {
  const P = id => places.find(p => p.id === id), p = {}, q = {};
  // 林荫小道那段山路的右手边
  ROAD.at(SPOTS.grove[0] + 16, p);
  const lantern = { x: p.x - p.tz * 2.1, z: p.z + p.tx * 2.1, yaw: Math.atan2(p.tz, -p.tx) + 0.6 };
  // 红叶谷：溪边小路靠山坡那一侧，面朝溪水
  STREAM.at(CREEK_END + 70, q); const t = TRAIL.nearest(q.x, q.z, 40); TRAIL.at(t.s, p);
  const pa = { x: p.x - p.tz * 2.4, z: p.z + p.tx * 2.4 }, pb = { x: p.x + p.tz * 2.4, z: p.z - p.tx * 2.4 };
  const painter = Math.hypot(pa.x - q.x, pa.z - q.z) > Math.hypot(pb.x - q.x, pb.z - q.z) ? pa : pb;
  painter.yaw = Math.atan2(q.x - painter.x, q.z - painter.z);
  // 沙滩靠水的地方，面朝大海
  const cv = P('cove');
  const fisher = { x: cv.x + SEA.nx * 9 + SEA.nz * 10, z: cv.z + SEA.nz * 9 - SEA.nx * 10, yaw: Math.atan2(SEA.nx, SEA.nz) };
  // 灯塔门口，面朝海
  const keeper = { x: LIGHTHOUSE.x + 5.2, z: LIGHTHOUSE.z + 3.4, yaw: Math.atan2(SEA.nx, SEA.nz) + 0.5 };
  // 背包客：浅滩往红叶谷那一段溪边小路，来回走
  const s0 = TRAIL.nearest(P('shoal').x, P('shoal').z, 60).s + 30, s1 = TRAIL.nearest(P('autumn').x, P('autumn').z, 60).s - 25;
  return [
    { id: 'lantern', who: 'm', tint: [0.85, 0.9, 1.05], hood: '#3d5a8c', pose: 'lantern', ...lantern, when: h => h > 19.6 || h < 4.6,
      lines: ['这么晚还在走呀。我每天夜里提着灯走一段，看看萤火虫。', '往东边的山坡上看，有根杆子挂着布条，那上面能看到整个谷地。夜里松林边上还常有狐狸，别跑，慢慢走。'],
      tips: ['vEast', 'fox'] },
    { id: 'painter', who: 'f', tint: [1.05, 1.0, 0.92], hood: '#e8c050', pose: 'sit', prop: 'easel', ...painter, when: (h, w) => h > 6.3 && h < 12.5 && w !== 'rain' && w !== 'snow',
      lines: ['别动别动……好了，你刚好站进画里了。', '早上起雾的时候，这片林子里有只大角鹿，角像两棵小树。西边那道山梁上也有一根挂布条的杆子，从那儿能同时看到溪和海。'],
      tips: ['stag', 'vWest'] },
    { id: 'fisher', who: 'm', tint: [1.0, 1.05, 0.9], hood: '#5f7a45', pose: 'sit', prop: 'rod', ...fisher, when: (h, w) => h > 14.4 && h < 19.9 && w !== 'rain',
      lines: ['钓鱼嘛，钓不钓得到不要紧。', '南边那个坡顶上能看到整个海湾，还有那几根礁石。日落的时候海鸥都往这边飞。'],
      tips: ['vCove', 'gull'] },
    { id: 'hiker', who: 'm', tint: [1.1, 1.0, 0.88], hood: '#d07a2c', pose: 'walk', prop: 'pack', path: { s0, s1 }, x: 0, z: 0, yaw: 0, when: (h, w) => h > 8 && h < 16.5 && w !== 'rain',
      lines: ['我从冰湖那边下来的，上面冷得很。', '冰湖东边的雪梁上有一堆石头，站上去整条溪都在脚下。下雪天那附近有白狐狸，跑起来像一团雪。'],
      tips: ['vSnow', 'snowfox'] },
    { id: 'keeper', who: 'f', tint: [0.9, 0.95, 1.1], hood: '#2f3d5c', pose: 'fold', ...keeper, when: (h, w) => h > 17.4 || h < 1 || w === 'fog',
      lines: ['天要黑了，该去点灯了。', '晴天的夜里在这儿坐着，一晚上能数到好几颗流星。白天雨刚停的时候，背对着太阳看，海上常挂着彩虹。'],
      tips: ['meteor', 'rainbow'] },
  ];
}

// 每个人的打扮：帽子、外套、围巾、头发各不一样（没写的和旅人一样，见 actors/sculptGeo.js 的 LOOKS）。
// hatStyle：straw 宽檐帽（默认）、cone 斗笠、beret 画家帽、beanie 毛线帽、none 不戴；tail：围巾背后那一截要不要
export const FOLK_LOOKS = {
  lantern: { hat: '#3b3a55', hatUnder: '#24233a', band: '#d9c9a0', plume: false, coat: '#3d5a8c', seam: '#2a3f66', scarf: '#d9c9a0', scarfStripe: '#8f3324', pants: '#77736a', tail: false },
  painter: { hatStyle: 'beret', hat: '#e2b33c', band: '#b98a22', coat: '#e6dcc3', seam: '#b3a586', coatTrim: '#c8683a', scarf: '#3f8f86', scarfStripe: '#f1e3c0', pants: '#7d6a5a', tail: false },
  fisher: { hatStyle: 'cone', hat: '#cfae68', hatUnder: '#8f7440', coat: '#5f7a45', seam: '#44592f', scarf: '#e3d6b4', scarfStripe: '#5f7a45', hair: '#cfcabd', hairHi: '#f0ece2', beard: true, skin: '#e0b089', blush: '#d98c74', pants: '#6f6a58', tail: false },
  hiker: { hatStyle: 'none', coat: '#d07a2c', seam: '#9c541a', scarf: '#3f6f8f', scarfStripe: '#f1e3c0', hair: '#6b4526', hairHi: '#a8743f', pants: '#5d5a4a' },
  keeper: { hatStyle: 'beanie', hat: '#a8402c', hatUnder: '#6e2a1d', band: '#e9dcc0', coat: '#2f3d5c', seam: '#1f2a42', coatTrim: '#d9c9a0', scarf: '#e9dcc0', scarfStripe: '#a8402c', hair: '#2e211b', hairHi: '#5a4030', pants: '#8b8474', tail: false },
};

const CLIP = { sit: 'Sitting_Idle_Loop', lantern: 'Idle_Lantern_Loop', fold: 'Idle_FoldArms_Loop', walk: 'Walk_Loop', idle: 'Idle_Loop', wave: 'Interact' };

// 小道具
function buildProp(kind, M) {
  const g = new THREE.Group();
  if (kind === 'easel') {
    const wood = M.wood;
    for (const [x, z, r] of [[-0.28, 0, 0.12], [0.28, 0, -0.12], [0, -0.32, 0]]) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.035, 1.55, 0.035), wood); l.position.set(x * 0.9, 0.75, z * 0.9 - 0.02); l.rotation.set(z ? 0.22 : -0.1, 0, r); g.add(l);
    }
    // 画布：上面是一片红叶林
    const c = document.createElement('canvas'); c.width = 64; c.height = 80; const x = c.getContext('2d');
    x.fillStyle = '#f2ead8'; x.fillRect(0, 0, 64, 80);
    x.fillStyle = '#b9c9d6'; x.fillRect(4, 4, 56, 30);
    for (let i = 0; i < 40; i++) { x.fillStyle = ['#c84a24', '#e08a32', '#a63a22', '#e6b04a'][i % 4]; x.beginPath(); x.arc(4 + Math.random() * 56, 26 + Math.random() * 30, 3 + Math.random() * 5, 0, 6.3); x.fill(); }
    x.fillStyle = '#6d8bb0'; x.fillRect(4, 62, 56, 6);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const cm = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }); patch(cm, { gobo: true, fog: true });
    const cv = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.02), cm); cv.position.set(0, 1.15, 0.03); cv.rotation.x = -0.12; g.add(cv);
  } else if (kind === 'rod') {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.02, 3.2, 5), M.wood);
    rod.geometry.translate(0, 1.6, 0); rod.rotation.x = 1.05; rod.position.set(0.25, 0.15, 0.25); g.add(rod);
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 3.4, 3), M.line);
    line.position.set(0.25, 0.85, 3.2); line.rotation.x = 0.35; g.add(line);
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.14, 0.3, 10), M.bucket); bucket.position.set(-0.6, 0.15, 0.1); g.add(bucket);
  } else if (kind === 'stool') {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 1, 10), M.wood); s.position.y = 0.5; g.add(s);
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export class Folk {
  // h: { res, groundAt(x,z), places, colliders, sculpt: false = 用原来的素材模型 }
  constructor(h) {
    this.h = h;
    this.group = new THREE.Group(); this.group.name = 'folk';
    this.list = makeFolk(h.places);
    this.gltf = {}; this.loading = {}; this.jobs = new Set();
    this.checkT = 0;
    const wood = new THREE.MeshStandardMaterial({ color: '#7a5636', roughness: 0.9 }); patch(wood, { gobo: true, fog: true });
    const line = new THREE.MeshBasicMaterial({ color: '#dddddd', transparent: true, opacity: 0.5 });
    const bucket = new THREE.MeshStandardMaterial({ color: '#5d6f7d', roughness: 0.7 }); patch(bucket, { gobo: true, fog: true });
    const pack = new THREE.MeshStandardMaterial({ color: '#8a5a38', roughness: 0.9 }); patch(pack, { gobo: true, fog: true, rim: 0.3 });
    const glow = new THREE.MeshStandardMaterial({ color: '#ffe7b0', emissive: new THREE.Color('#ffb04a'), emissiveIntensity: 3 }); patch(glow, { gobo: false, fog: true });
    const paper = new THREE.MeshStandardMaterial({ color: '#ffe0a0', emissive: new THREE.Color('#ff9c3a'), emissiveIntensity: 1.4, side: THREE.DoubleSide, transparent: true, opacity: 0.92 }); patch(paper, { gobo: false, fog: true });
    // 光晕：一张软软的圆点贴图，叠加混合
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,200,120,0.9)'); gr.addColorStop(0.3, 'rgba(255,160,70,0.35)'); gr.addColorStop(1, 'rgba(255,140,60,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    const halo = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
    this.M = { wood, line, bucket, pack, glow, paper, halo };
    // 走过的小路点（背包客用）
    this.trailP = {};
  }
  load(who) {
    if (this.gltf[who] || this.loading[who]) return;
    this.loading[who] = new GLTFLoader().loadAsync(this.h.res + `traveler-${who}.glb`).then(g => { this.gltf[who] = g; }).catch(e => console.warn('[j] folk', e));
  }
  // 人走近了才做。捏的造型要算零点几秒，放在后台线程里算，算好了人才出现；后台线程用不了就还用原来的素材模型
  make(F) {
    if (F.keep) { F.o = F.keep; F.keep = null; this.group.add(F.o.root); return true; }      // 走远收起来的，回来直接用
    const g = this.gltf[F.who]; if (!g) { this.load(F.who); return false; }
    if (F.making) return false;
    const model = SkeletonUtils.clone(g.scene);
    if (this.h.sculpt === false) { this.finish(F, g, model, null); return true; }
    F.making = true;
    const job = import('../actors/sculpt.js').then(m => m.sculptTravelerAsync(model, { who: F.who, look: FOLK_LOOKS[F.id] }))
      .catch(e => { console.warn('[j] folk sculpt', e); return null; })
      .then(sculpt => { F.making = false; this.jobs.delete(job); this.finish(F, g, model, sculpt); });
    this.jobs.add(job);
    return false;
  }
  finish(F, g, model, sculpt) {
    if (!sculpt) model.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      if (F.noHood && /Hood/.test(o.name)) { o.visible = false; return; }
      const m = o.material, eyes = /Eye/.test(m.name), cloth = m.name === 'MI_Ranger';
      const col = new THREE.Color(m.color); if (cloth) col.multiply(new THREE.Color(...F.tint));
      // 自发光一点点（和旅人一样按贴图颜色，逆光时不会只剩黑影）：这里直接乘上算好的颜色，换过色的兜帽也跟着变
      const n = new THREE.MeshStandardMaterial({ map: m.map, color: col, roughness: eyes ? 0.3 : 0.86, metalness: 0, emissive: new THREE.Color(0.16, 0.16, 0.16) });
      const hood = { value: new THREE.Color(F.hood) };
      n.onBeforeCompile = sh => {
        sh.uniforms.uHood = hood;
        let fs = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uHood;');
        // 衣服：把原来红色的兜帽、围巾换成每个人自己的颜色（贴图里偏红的地方）
        if (cloth) fs = fs.replace('#include <map_fragment>', `#include <map_fragment>
          {
            vec3 c = diffuseColor.rgb;
            float k = ( c.r - max( c.g, c.b ) ) / max( c.r, 1e-3 );
            float red = smoothstep( 0.76, 0.86, k ) * smoothstep( 0.1, 0.22, c.r );
            diffuseColor.rgb = mix( c, uHood * ( 0.25 + 1.4 * c.r ), red );
          }`);
        sh.fragmentShader = fs.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance *= diffuseColor.rgb;');
      };
      patch(n, { rim: eyes ? 0 : 0.45, gobo: true, fog: true });
      o.material = n;
    });
    const bones = {}; model.traverse(o => { if (o.isBone) bones[o.name] = o; });
    const root = new THREE.Group(); root.add(model); root.name = 'folk-' + F.id;
    const mixer = new THREE.AnimationMixer(model), act = {};
    for (const c of g.animations) act[c.name] = mixer.clipAction(c);
    act.Interact.setLoop(THREE.LoopOnce, 1); act.Interact.clampWhenFinished = false;
    // 坐着的人：坐在一个小木墩上（高度按坐姿里盆骨的位置算）
    if (F.pose === 'sit') {
      const a = act.Sitting_Idle_Loop; a.play(); mixer.update(0.3); model.updateMatrixWorld(true);
      const pv = bones.pelvis.getWorldPosition(new THREE.Vector3()); a.stop();
      const stool = buildProp('stool', this.M); stool.scale.set(1, Math.max(0.2, pv.y - 0.14), 1); stool.position.set(pv.x, 0, pv.z - 0.04); root.add(stool);
    }
    if (F.prop === 'easel') { const e = buildProp('easel', this.M); e.position.set(0.1, 0, 1.15); e.rotation.y = Math.PI; root.add(e); }
    if (F.prop === 'rod') root.add(buildProp('rod', this.M));
    if (F.prop === 'pack' && sculpt) {
      // 背包客：和旅人一样的行囊，围巾背后那一截搭在铺盖卷上（按站姿量后背）
      const a = act.Idle_Loop; a.play(); mixer.update(0);
      const pk = makePack(model, bones);
      if (pk) { const k = pk.userData.at; sculpt.userData.drape(r => [r, [k.x + 0.04, k.y + 0.255, k.z - 0.005], [k.x + 0.052, k.y + 0.18, k.z - 0.064], [k.x + 0.058, k.y + 0.04, k.z - 0.088], [k.x + 0.052, k.y - 0.09, k.z - 0.096]]); }
      a.stop();
    } else if (F.prop === 'pack' && bones.spine_03) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.5, 0.22), this.M.pack); b.castShadow = true;
      const s = bones.spine_03.getWorldScale(new THREE.Vector3()).x || 1;
      const rollP = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.42, 8), this.M.bucket); rollP.rotation.z = Math.PI / 2; rollP.position.set(0, 0.3, 0);
      b.add(rollP); b.scale.setScalar(1 / s); b.position.set(0, 0.02 / s, -0.2 / s); bones.spine_03.add(b);
    }
    let lamp = null;
    if (F.pose === 'lantern') {
      // 灯笼挂在手底下（每帧跟着手走），外面一圈淡淡的光晕，远远就看得见
      lamp = new THREE.Group();
      const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.2, 6, 1, true), this.M.paper); cage.position.y = -0.24;
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.06, 6), this.M.wood); cap.position.y = -0.11;
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), this.M.glow); light.position.y = -0.24;
      const str = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.1, 3), this.M.wood); str.position.y = -0.05;
      const halo = new THREE.Sprite(this.M.halo); halo.scale.setScalar(1.6); halo.position.y = -0.24;
      lamp.add(cage, cap, light, str, halo); root.add(lamp);
    }
    F.o = { root, mixer, act, bones, lamp, sculpt, hand: bones.hand_r || bones.hand_l, cur: null, yaw: F.yaw, speed: 0, s: F.path ? F.path.s0 + Math.random() * (F.path.s1 - F.path.s0) : 0, dir: 1, talkT: 0, waveT: 0 };
    this.play(F, F.pose === 'walk' ? 'walk' : F.pose, 0.01);
    this.group.add(root);
    return true;
  }
  play(F, k, fade = 0.4) {
    const o = F.o, name = CLIP[k] || k; if (o.cur === name || !o.act[name]) return;
    const next = o.act[name], prev = o.cur && o.act[o.cur];
    next.reset(); next.setEffectiveWeight(1); next.setEffectiveTimeScale(1); next.play();
    if (prev) prev.crossFadeTo(next, fade, false);
    o.cur = name;
  }
  // 现在在哪（背包客沿着小路走）
  where(F) {
    if (!F.path) return F;
    TRAIL.at(F.o ? F.o.s : F.path.s0, this.trailP);
    return { x: this.trailP.x - this.trailP.tz * 0.9, z: this.trailP.z + this.trailP.tx * 0.9 };
  }
  // c: { p, tod, wx, camPos }
  update(dt, c) {
    this.checkT -= dt;
    if (this.checkT <= 0) {
      this.checkT = 0.7;
      for (const F of this.list) {
        const w = this.where(F), d = Math.hypot(w.x - c.p.x, w.z - c.p.z), want = F.when(c.tod, c.wx);
        if (!F.o && want && d < 170) this.make(F);
        else if (F.o && (d > 220 || (!want && d > 60))) { this.group.remove(F.o.root); F.keep = F.o; F.o = null; }
      }
    }
    for (const F of this.list) if (F.o) this.tick(F, dt, c);
  }
  tick(F, dt, c) {
    const o = F.o, { groundAt } = this.h;
    let x = F.x, z = F.z;
    o.talkT = Math.max(0, o.talkT - dt);
    if (F.path) {
      const w = this.where(F); x = w.x; z = w.z;
      const near = Math.hypot(x - c.p.x, z - c.p.z) < 5 || o.talkT > 0;
      o.speed = damp(o.speed, near ? 0 : 1.05, 3, dt);
      o.s += o.dir * o.speed * dt;
      if (o.s > F.path.s1) { o.s = F.path.s1; o.dir = -1; } if (o.s < F.path.s0) { o.s = F.path.s0; o.dir = 1; }
      const tp = this.trailP, want = near ? Math.atan2(c.p.x - x, c.p.z - z) : Math.atan2(tp.tx * o.dir, tp.tz * o.dir);
      o.yaw += wrap(want - o.yaw) * Math.min(1, dt * 4);
      if (o.waveT <= 0) this.play(F, o.speed > 0.2 ? 'walk' : 'idle');
      if (o.cur === 'Walk_Loop') o.act.Walk_Loop.setEffectiveTimeScale(o.speed / 1.05);
    } else if (F.pose !== 'sit') {
      // 站着的人在说话时转过来看你
      const want = o.talkT > 0 ? Math.atan2(c.p.x - x, c.p.z - z) : F.yaw;
      o.yaw += wrap(want - o.yaw) * Math.min(1, dt * 3);
    }
    if (o.waveT > 0) { o.waveT -= dt; if (o.waveT <= 0) this.play(F, F.pose === 'walk' ? 'idle' : F.pose); }
    const cd = Math.hypot(x - c.camPos.x, z - c.camPos.z);
    o.root.visible = cd < 150;
    if (!o.root.visible) return;
    o.root.position.set(x, groundAt(x, z), z); o.root.rotation.y = o.yaw;
    o.lodT = (o.lodT || 0) + dt;
    if (o.lodT >= (cd < 40 ? 0 : 1 / 15)) { o.mixer.update(o.lodT); if (o.sculpt && F.path) { o.root.updateMatrixWorld(true); o.sculpt.userData.sway(o.lodT, 0.7); } o.lodT = 0; }
    if (o.lamp && o.hand) { o.root.updateMatrixWorld(true); o.hand.getWorldPosition(_hp); o.lamp.position.copy(o.root.worldToLocal(_hp)); }
  }
  // 离旅人最近、能打招呼的那个人（4.5 米内）
  nearest(p) {
    let best = null, bd = 4.5;
    for (const F of this.list) {
      if (!F.o) continue;
      const w = F.path ? this.where(F) : F, d = Math.hypot(w.x - p.x, w.z - p.z);
      if (d < bd) { bd = d; best = F; }
    }
    return best;
  }
  // 打招呼：站着的挥挥手；返回这回说的话（第一次说第一句，之后说第二句，再之后两句轮着）
  greet(F, n) {
    const o = F.o; if (!o) return '';
    o.talkT = 9;
    if (F.pose !== 'sit') { this.play(F, 'wave', 0.25); o.waveT = Math.max(1.2, o.act.Interact.getClip().duration - 0.2); }
    return F.lines[Math.min(n, F.lines.length - 1) % F.lines.length];
  }
  // 拍照：画面里的人
  inView(camera, out) {
    const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const v = new THREE.Vector3();
    for (const F of this.list) {
      if (!F.o || !F.o.root.visible) continue;
      v.copy(F.o.root.position); v.y += 1;
      if (v.distanceTo(camera.position) < 30 && fr.containsPoint(v)) out.add(F.id);
    }
    return out;
  }
}
