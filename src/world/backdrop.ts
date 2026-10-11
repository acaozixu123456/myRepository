// 外圈的巨型都市：高耸暗色塔楼 + 亮着灯的窗 + 全息广告牌 + 空中走廊 + 飞行器。
// 塔楼共用一份窗户贴图（用 UV 缩放控制开间数），合批成一两次绘制。
import * as THREE from 'three';
import { mulberry } from '../fx/util';
import { bakeStatic } from './bake';
import { aiTex, facade, neonSign, worldTexNames } from './tex';
import { glowMat, std } from './kit';

export interface Backdrop { group: THREE.Group; update(t: number): void }

const HOLO: [string, string, string[]][] = [
  ['#ff2ea8', '#ffffff', ['更好', '更快', '更近']],
  ['#7ff0ff', '#ffffff', ['做更', '好的', '猫']],
  ['#9a7aff', '#ffe27a', ['九命', '当铺']],
  ['#ff5a5a', '#ffffff', ['清洁', '的城', '市']],
];

export function buildBackdrop(): Backdrop {
  const g = new THREE.Group();
  const rnd = mulberry(77);
  const [fb, fe] = facade('dark', 1);
  fb.wrapS = fb.wrapT = fe.wrapS = fe.wrapT = THREE.RepeatWrapping;
  const mat = new THREE.MeshStandardMaterial({ map: fb, emissiveMap: fe, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 1.5, roughness: 0.8, fog: true });
  // ---- 塔楼 ----
  const towers = new THREE.Group();
  const N = 54;
  const spots: { x: number; z: number; w: number; d: number; h: number }[] = [];
  for (let i = 0; i < N; i++) {
    const ang = (i / N) * Math.PI * 2 + rnd() * 0.08;
    const r = 56 + rnd() * 70;
    const w = 7 + rnd() * 12, d = 7 + rnd() * 12, h = 30 + rnd() * 110 * (0.4 + (r - 56) / 70);
    const x = Math.cos(ang) * r, z = Math.sin(ang) * r;
    spots.push({ x, z, w, d, h });
    const geo = new THREE.BoxGeometry(w, h, d);
    const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * (w / 6), uv.getY(k) * (h / 3.4));
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, h / 2 - 2, z); m.rotation.y = rnd() * 0.3;
    towers.add(m);
    // 顶部：天线 + 红色航空灯
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 8, 5), std('#2a2a3a', 0.5, 0.5)); ant.position.set(x, h + 2, z); towers.add(ant);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.5, 6, 5), glowMat('#ff3a3a')); beacon.position.set(x, h + 6.5, z); towers.add(beacon);
  }
  g.add(towers);
  // 远景天际线（Codex 的 A07 素材，文件名以 skyline 开头；没有就跳过）：贴在最外圈的柱面内侧，越远越暗
  const sky = worldTexNames('skyline')[0];
  const skyTex = sky ? aiTex(sky) : null;
  if (skyTex) {
    skyTex.wrapS = THREE.RepeatWrapping; skyTex.repeat.set(1, 1); skyTex.needsUpdate = true;
    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(150, 150, 90, 48, 1, true),
      new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, transparent: true, toneMapped: false, fog: false, depthWrite: false, opacity: 0.92 }));
    wall.position.y = 40;
    wall.renderOrder = -1;
    g.add(wall);
  }
  // ---- 空中走廊（连接相邻塔楼）----
  const skyways = new THREE.Group();
  for (let i = 0; i < N; i += 3) {
    const a = spots[i], b = spots[(i + 1) % N];
    const y = Math.min(a.h, b.h) * (0.35 + rnd() * 0.3);
    const len = Math.hypot(a.x - b.x, a.z - b.z);
    const tube = new THREE.Mesh(new THREE.BoxGeometry(len, 3, 4), std('#1a1830', 0.6, 0.4));
    tube.position.set((a.x + b.x) / 2, y, (a.z + b.z) / 2); tube.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(len * 0.98, 0.3, 4.2), glowMat(['#7ff0ff', '#ff2ea8', '#ffe27a'][i % 3]));
    strip.position.copy(tube.position); strip.position.y += 0.4; strip.rotation.copy(tube.rotation);
    skyways.add(tube, strip);
  }
  g.add(skyways);
  bakeStatic(g);
  // ---- 全息广告牌（会闪烁）----
  const holos: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; ph: number }[] = [];
  for (let i = 0; i < 9; i++) {
    const [col, , lines] = HOLO[i % HOLO.length];
    const ang = (i / 9) * Math.PI * 2 + 0.3, r = 52 + (i % 3) * 6;
    const ad = i % 3 === 0 ? aiTex('ad_ninelives_hologram_06') : null; // 每三块里有一块用 AI 全息猫广告
    const tex = ad ?? neonSign(lines.join(''), col, { vertical: true, w: 128, h: 512, bg: '#0a0618' });
    const m = new THREE.MeshBasicMaterial({ map: tex, color: 0xffffff, toneMapped: false, transparent: true, opacity: 0.95, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(ad ? 14 : 8, ad ? 28 : 30), m);
    mesh.position.set(Math.cos(ang) * r, 22 + (i % 4) * 5, Math.sin(ang) * r); mesh.lookAt(0, 22, 0);
    g.add(mesh); holos.push({ mesh, mat: m, ph: rnd() * 6 });
  }
  // ---- 飞行器：发光小方块沿椭圆轨道飞（InstancedMesh，1 次绘制）----
  const NC = 16;
  const carMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(2.6, 0.7, 1.1), new THREE.MeshBasicMaterial({ toneMapped: false }), NC);
  carMesh.frustumCulled = false;
  const cars = Array.from({ length: NC }, (_, i) => { carMesh.setColorAt(i, new THREE.Color(i % 2 ? '#ff7ad9' : '#7ff0ff')); return { r: 44 + rnd() * 40, y: 16 + rnd() * 50, sp: (0.04 + rnd() * 0.06) * (rnd() < 0.5 ? 1 : -1), ph: rnd() * 6.28 }; });
  g.add(carMesh);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1), AX = new THREE.Vector3(0, 1, 0);
  const update = (t: number) => {
    for (const h of holos) h.mat.opacity = 0.78 + 0.2 * Math.sin(t * 2.2 + h.ph) + (Math.sin(t * 17 + h.ph * 3) > 0.96 ? -0.4 : 0);
    cars.forEach((c, i) => { const a = c.ph + t * c.sp; V.set(Math.cos(a) * c.r, c.y + Math.sin(t + c.ph) * 0.8, Math.sin(a) * c.r); Q.setFromAxisAngle(AX, -a + (c.sp > 0 ? 0 : Math.PI) - Math.PI / 2); M.compose(V, Q, S); carMesh.setMatrixAt(i, M); });
    carMesh.instanceMatrix.needsUpdate = true;
  };
  return { group: g, update };
}
