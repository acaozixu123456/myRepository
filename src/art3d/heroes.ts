// 英雄专属 3D 部件：只有需要「独一份」造型的猫才在这里加（通用的放 parts/）。
// 键是英雄 id，值按部件组覆盖：同一个 PartBuilder 契约（见 parts/types.ts）。
// 例：关云喵的青龙偃月刀、曹喵德的冕旒、诸葛喵亮的羽扇与纶巾。
import * as THREE from 'three';
import type { PartGroup } from './parts';
import { WEAPON } from './parts/weapons';
import type { PartBuilder, PartCtx } from './parts/types';
import { solid, sphere, toon } from './toon';
import { caomaoCrown, zhouyuCrown } from './parts/hero-ur-regalia';
import { liubeiDualSwords } from './parts/hero-ur-liu-swords';
import { lvbuHalberd, menghuoMace, zuociStaff } from './parts/hero-ur-weapons';
import { xiahouSpear, xuhuBoneMace, zhangliaoDualBlades } from './parts/hero-wei-weapons';

/** 专属叶 / 羽饰沿 +y 生长；握段与全部部件根仍留在掌心原点。 */
function leafShape(length: number, width: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(-width * 0.56, length * 0.17, -width * 0.5, length * 0.5);
  s.quadraticCurveTo(-width * 0.4, length * 0.83, 0, length);
  s.quadraticCurveTo(width * 0.4, length * 0.83, width * 0.5, length * 0.5);
  s.quadraticCurveTo(width * 0.56, length * 0.17, 0, 0);
  return s;
}

function leafTip(length: number, width: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-width * 0.34925, length * 0.7646);
  s.quadraticCurveTo(-width * 0.22, length * 0.9065, 0, length);
  s.quadraticCurveTo(width * 0.22, length * 0.9065, width * 0.34925, length * 0.7646);
  s.quadraticCurveTo(0, length * 0.715, -width * 0.34925, length * 0.7646);
  return s;
}

function petal(shape: THREE.Shape, depth = 0.045): THREE.ExtrudeGeometry {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, steps: 1, curveSegments: 5,
    bevelEnabled: true, bevelSegments: 1, bevelSize: 0.008, bevelThickness: 0.006,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}

function at<T extends THREE.Object3D>(o: T, x: number, y: number, z = 0): T {
  o.position.set(x, y, z);
  return o;
}

/** 冢虎七羽：复用原握柄，七羽高低与宽窄重排，不给已满预算的扇加附件。 */
function simayiFan(c: PartCtx): THREE.Object3D {
  const g = WEAPON.fan(c);
  g.name = 'sp-simayi-seven-feather-fan';
  const face = g.getObjectByName('fan-face')!;
  face.rotation.set(0.37, 0, Math.PI / 12);
  const lengths = [0.39, 0.51, 0.64, 0.74, 0.64, 0.51, 0.39];
  const widths = [0.16, 0.18, 0.22, 0.24, 0.22, 0.18, 0.16];
  const angles = [-1.1, -0.78, -0.39, 0, 0.39, 0.78, 1.1];
  const oldAngles = [-1.07, -0.72, -0.36, 0, 0.36, 0.72, 1.07];
  const feathers = face.children.filter((o) => o.name === 'fan-feather');
  feathers.forEach((feather, i) => {
    // 子组带着羽尖和金骨一起变形，保留七个闭合圆尖与同一根部圆扣。
    feather.scale.set(widths[i] / 0.20, lengths[i] / (0.66 - Math.abs(oldAngles[i]) * 0.12), 1.25);
    feather.rotation.set(0.22, angles[i] * 0.14, angles[i] + 0.15);
    feather.position.z = -Math.abs(angles[i]) * 0.025;
  });
  return g; // 24 逻辑网格，含描边算 1；没有新增网格或材质。
}

/** 圆钝的金卷梢；留出内弯负空间，沿弓外侧展开，不伸长上下梢。 */
function scrollTip(side: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0.015, side * 0.065);
  s.bezierCurveTo(-0.035, side * 0.115, -0.15, side * 0.13, -0.205, side * 0.075);
  s.bezierCurveTo(-0.255, side * 0.018, -0.2, side * -0.06, -0.115, side * -0.045);
  s.quadraticCurveTo(-0.055, side * -0.035, -0.076, side * 0.012);
  s.quadraticCurveTo(-0.125, side * -0.013, -0.156, side * 0.023);
  s.quadraticCurveTo(-0.173, side * 0.055, -0.124, side * 0.073);
  s.quadraticCurveTo(-0.065, side * 0.096, -0.015, side * 0.039);
  s.closePath();
  return s;
}

/** 凤羽金梢弓：金卷钩与红金小羽来自批准造型的弓梢 / 凤翼，弦槽保持原位。 */
function pangtongBow(c: PartCtx): THREE.Object3D {
  const g = WEAPON.bow(c);
  g.name = 'sp-pangtong-phoenix-bow';
  for (const side of [-1, 1]) {
    // 下梢在 Shape 坐标里反向生长，保持正缩放与正确的烘焙三角绕序。
    const tip = at(solid(petal(scrollTip(side), 0.050), toon(c.pal.trim), 0.009), side < 0 ? -0.48 : -0.44, side * 0.73, 0.06);
    // 前举时 local -y 翻到眼前：小卷钩沿木弓外弧贴附，不向眼睛展开。
    if (side < 0) { tip.scale.setScalar(0.5); tip.rotation.z = 0.8; }
    tip.name = 'phoenix-scroll-tip';
    g.add(tip);
    const fin = at(new THREE.Group(), -0.55, side * 0.54, 0.065);
    fin.name = 'phoenix-feather';
    if (side < 0) fin.scale.setScalar(0.5);
    const gold = solid(petal(leafShape(side * 0.30, 0.16)), toon(c.pal.trim), 0.009);
    const red = at(new THREE.Mesh(petal(leafShape(side * 0.26, 0.105), 0.058), toon(c.pal.main)), 0, side * 0.018);
    gold.rotation.z = red.rotation.z = side < 0 ? 0.2 : 1.25;
    fin.add(gold, red);
    g.add(fin);
  }
  return g; // 通用弓 10 + 两端各 3 = 16 逻辑网格。
}

/** 月桂三枝：叶根分散在三根茎上，节点月珠实际接枝，不是悬浮特效。 */
function changmiaoLaurel(c: PartCtx): THREE.Object3D {
  const g = new THREE.Group();
  g.name = 'sp-changmiao-moon-laurel';
  const nodes = [
    new THREE.Vector3(-0.25, 0.12, -0.025),
    new THREE.Vector3(-0.43, 0.48, 0.015),
    new THREE.Vector3(-0.72, 0.52, 0.035),
  ];
  nodes.forEach((node, i) => {
    const x = (i - 1) * 0.022;
    const stem = new THREE.CurvePath<THREE.Vector3>();
    stem.add(new THREE.LineCurve3(new THREE.Vector3(x, -0.06, 0), new THREE.Vector3(x, 0.04, 0)));
    stem.add(new THREE.QuadraticBezierCurve3(new THREE.Vector3(x, 0.04, 0), new THREE.Vector3(-0.10, 0.15, node.z * 0.5), node));
    const m = solid(new THREE.TubeGeometry(stem, 10, 0.014, 8, false), toon('#4c8747'), 0.008);
    m.name = 'laurel-stem';
    g.add(m);
  });
  const leaves = [
    { branch: 0, angle: 1.35, length: 0.18, width: 0.14 },
    { branch: 0, angle: 2.20, length: 0.18, width: 0.14 },
    { branch: 1, angle: 0.10, length: 0.42, width: 0.20 },
    { branch: 1, angle: 0.65, length: 0.25, width: 0.16 },
    { branch: 2, angle: 1.35, length: 0.40, width: 0.20 },
    { branch: 2, angle: 1.95, length: 0.23, width: 0.16 },
  ];
  leaves.forEach(({ branch, angle, length, width }, i) => {
    const leaf = new THREE.Group();
    leaf.name = 'laurel-leaf';
    leaf.position.copy(nodes[branch]);
    leaf.rotation.set(i % 2 ? 0.45 : 0.28, i % 2 ? -0.24 : 0.16, angle);
    leaf.add(solid(petal(leafShape(length, width)), toon(i % 2 ? '#78b854' : '#4d9650'), 0.01));
    leaf.add(new THREE.Mesh(petal(leafTip(length, width), 0.057), toon(i % 2 ? '#a5ce70' : '#327746')));
    if (i % 2 === 0) {
      leaf.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.007, length * 0.68, 6), toon('#bed78a')), 0, length * 0.37, 0.031));
    }
    g.add(leaf);
  });
  for (const i of [1, 2]) {
    const pearl = solid(sphere(i === 1 ? 0.045 : 0.055, 1, 0.9, 0.8, 12), toon(c.pal.trim), 0.009);
    pearl.name = 'moon-pearl';
    pearl.position.copy(nodes[i]); pearl.position.z += 0.025;
    g.add(pearl);
  }
  g.add(at(solid(new THREE.CylinderGeometry(0.047, 0.047, 0.065, 10), toon(c.pal.main), 0.009), 0, -0.025));
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.049, 0.049, 0.014, 10), toon(c.pal.trim)), 0, 0.015));
  g.add(at(solid(sphere(0.047, 1, 0.8, 0.45, 12), toon(c.pal.trim), 0.009), 0, -0.028, 0.048));
  return g; // 三茎 + 六叶/叶尖 + 三主叶脉 + 束带/金圈/扣 + 两珠 = 23。
}

export const HERO_PARTS: Record<string, Partial<Record<PartGroup, PartBuilder>>> = {
  wei_simamiyi: { weapon: simayiFan },
  shu_pangmiaotong: { weapon: pangtongBow },
  xian_changmiao: { weapon: changmiaoLaurel },
  wei_caomiaode: { headgear: caomaoCrown },
  shu_liumiaobei: { weapon: liubeiDualSwords },
  wu_zhoumiaoyu: { headgear: zhouyuCrown },
  qun_lvbuding: { weapon: lvbuHalberd },
  man_mengmiaohuo: { weapon: menghuoMace },
  xian_zuoci: { weapon: zuociStaff },
  wei_xiahoudun: { weapon: xiahouSpear },
  wei_xuhuchi: { weapon: xuhuBoneMace },
  wei_zhangliao: { weapon: zhangliaoDualBlades },
};
