// 街边小道具（Claude 补的一批，原本在 Codex 的 B 类清单里）：护栏、井盖、晾衣绳、公交站牌。
// 约定见 index.ts：原点在底部中心，+z 是正面；材质一律走 kit 的缓存。
import * as THREE from 'three';
import { glowMat, std } from '../kit';
import type { PropFactory } from './index';

const box = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = true;
  return m;
};
const cyl = (r: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 10): THREE.Mesh => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat);
  m.position.set(x, y, z); m.castShadow = true;
  return m;
};

/** 路边护栏：len 米长，沿 x 方向，黄黑警示横杆 + 立柱 */
function guardrail(len = 3.2): THREE.Group {
  const g = new THREE.Group();
  const post = std('#3a3a48', 0.5, 0.5), warn = std('#e8c15a', 0.6, 0.2), dark = std('#1a1a22', 0.6, 0.2);
  const n = Math.max(2, Math.round(len / 1.1) + 1);
  for (let i = 0; i < n; i++) g.add(cyl(0.06, 1.0, post, -len / 2 + (i * len) / (n - 1), 0.5, 0));
  for (const y of [0.85, 0.5]) g.add(box(len, 0.1, 0.06, warn, 0, y, 0));
  for (let i = 0; i < Math.floor(len / 0.5); i++) g.add(box(0.14, 0.11, 0.07, dark, -len / 2 + 0.25 + i * 0.5, 0.85, 0));
  // 反光片
  const refl = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.1), glowMat('#ff4a3a')); refl.position.set(0, 0.5, 0.04); g.add(refl);
  return g;
}

/** 井盖：圆盘 + 十字纹 + 缝里透出的青色微光（排水口蒸汽的意思） */
function manhole(): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.62, 0.06, std('#2a2a34', 0.4, 0.7), 0, 0.03, 0, 18));
  for (let i = 0; i < 2; i++) { const bar = box(1.1, 0.02, 0.07, std('#4a4a58', 0.4, 0.6), 0, 0.07, 0); bar.rotation.y = (i * Math.PI) / 2 + 0.4; g.add(bar); }
  const rim = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.7, 24), glowMat('#4fd8ff'));
  rim.rotation.x = -Math.PI / 2; rim.position.y = 0.075; g.add(rim);
  return g;
}

/** 晾衣绳：两根杆子拉一根绳，挂几件小鱼图案的衣服（猫世界，晾的是毛毯和小背心） */
function clothesline(): THREE.Group {
  const g = new THREE.Group();
  const pole = std('#5a4a3a', 0.8, 0.1);
  g.add(cyl(0.07, 3.2, pole, -2.2, 1.6, 0), cyl(0.07, 3.2, pole, 2.2, 1.6, 0));
  g.add(box(4.4, 0.03, 0.03, std('#c8c0b0', 0.7), 0, 3.0, 0));
  const cols = ['#ff7ad9', '#7ff0ff', '#ffe27a', '#9a7aff', '#ff9a6a'];
  cols.forEach((c, i) => {
    const w = 0.55 + (i % 2) * 0.25, h = 0.7 + (i % 3) * 0.18;
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, side: THREE.DoubleSide }));
    cloth.position.set(-1.7 + i * 0.85, 3.0 - h / 2 - 0.03, 0.02); cloth.rotation.z = (i % 2 ? 1 : -1) * 0.03;
    g.add(cloth);
  });
  return g;
}

/** 公交站牌：细杆 + 发光站牌 + 小顶棚，写着「喵 · 夜班」 */
function busStop(): THREE.Group {
  const g = new THREE.Group();
  const metal = std('#3a3a48', 0.5, 0.5);
  g.add(cyl(0.07, 3.4, metal, 0, 1.7, 0));
  g.add(box(1.0, 0.9, 0.08, std('#12121c', 0.6), 0, 2.9, 0));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.74), glowMat('#7ff0ff')); face.position.set(0, 2.9, 0.05); g.add(face);
  const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.16), glowMat('#ff4aa8')); stripe.position.set(0, 3.2, 0.055); g.add(stripe);
  g.add(box(1.5, 0.08, 1.0, metal, 0.45, 2.1, 0.5)); // 顶棚
  g.add(box(1.3, 0.05, 0.4, std('#5a4a3a', 0.8), 0.45, 0.5, 0.5)); // 长椅
  return g;
}

export const STREET_PROPS: Record<string, PropFactory> = {
  guardrail: (_s, len = 3.2) => guardrail(len),
  manhole: () => manhole(),
  clothesline: () => clothesline(),
  busStop: () => busStop(),
};
