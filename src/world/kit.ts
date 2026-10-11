// 场景部件库（程序化）：楼房、招牌、电线杆、电车、自动贩卖机、纸箱堆……
// 每个函数返回一个 THREE.Group，原点在底部中心，+z 是「正面」（朝街）。新增部件在这里加一个函数即可，关卡里按名字摆放。
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry } from '../fx/util';
import { facade, glowTex, neonSign, stripes } from './tex';
import type { FacadeStyle } from './tex';

const stdCache = new Map<string, THREE.MeshStandardMaterial>();
/** 缓存的标准材质（别在循环里 new） */
export const std = (color: string | number, rough = 0.7, metal = 0.05, emissive?: string | number, ei = 1): THREE.MeshStandardMaterial => {
  const key = `${color}|${rough}|${metal}|${emissive ?? ''}|${ei}`;
  let m = stdCache.get(key);
  if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }); if (emissive !== undefined) { m.emissive = new THREE.Color(emissive); m.emissiveIntensity = ei; } stdCache.set(key, m); }
  return m;
};
/** 发光材质（不受光照、不做色调映射，泛光会让它发亮） */
const glowCache = new Map<string, THREE.MeshBasicMaterial>();
export const glowMat = (color: string | number, tex?: THREE.Texture, double = false): THREE.MeshBasicMaterial => {
  const key = `${color}|${tex?.uuid ?? ''}|${double}`;
  let m = glowCache.get(key);
  if (!m) { m = new THREE.MeshBasicMaterial({ color, map: tex ?? null, toneMapped: false, side: double ? THREE.DoubleSide : THREE.FrontSide }); glowCache.set(key, m); }
  return m;
};

const box = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; return m; };
const cyl = (r: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 12): THREE.Mesh => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat); m.position.set(x, y, z); m.castShadow = true; return m; };
const tiled = (t: THREE.Texture, rx: number, ry: number): THREE.Texture => { const c = t.clone(); c.repeat.set(rx, ry); c.wrapS = c.wrapT = THREE.RepeatWrapping; c.needsUpdate = true; return c; };

const facadeMats = new Map<string, THREE.MeshStandardMaterial>();
function facadeMat(style: FacadeStyle, variant: number): THREE.MeshStandardMaterial {
  const key = `${style}|${variant}`;
  let m = facadeMats.get(key);
  if (!m) {
    const [fb, fe] = facade(style, variant);
    m = new THREE.MeshStandardMaterial({ map: fb, emissiveMap: fe, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 1.1, roughness: 0.75 });
    facadeMats.set(key, m);
  }
  return m;
}
export interface BuildingSpec {
  w: number; d: number; floors: number; style: FacadeStyle; seed: number;
  roof?: 'tile' | 'garden' | 'flat' | 'tank';
  shop?: { name: string; color: string; awning?: [string, string] };
  signs?: { text: string; color: string; vertical?: boolean }[];
  neon?: string; // 主色霓虹点光
}
const FLOOR_H = 3.4, SHOP_H = 3.8;

export function bush(r = 0.7, seed = 1): THREE.Group {
  const g = new THREE.Group(); const rnd = mulberry(seed);
  const cols = ['#4fa04a', '#68b858', '#3f8a46', '#7cc866'];
  for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(r * (0.45 + rnd() * 0.35), 0), std(cols[i % 4], 0.9)); s.position.set((rnd() - 0.5) * r, r * 0.4 + rnd() * r * 0.5, (rnd() - 0.5) * r); s.castShadow = true; g.add(s); }
  return g;
}
export function tree(h = 3.2, seed = 1): THREE.Group {
  const g = new THREE.Group(); const rnd = mulberry(seed);
  g.add(cyl(0.12, h * 0.55, std('#5a3a2a', 0.9), 0, h * 0.27));
  for (let i = 0; i < 7; i++) { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55 + rnd() * 0.35, 0), std(i % 2 ? '#e8f0d8' : '#9fd488', 0.85)); s.position.set((rnd() - 0.5) * 1.1, h * 0.6 + rnd() * 0.9, (rnd() - 0.5) * 1.1); s.castShadow = true; g.add(s); }
  g.add(box(0.7, 0.5, 0.7, std('#3a3040', 0.8), 0, 0.25, 0));
  return g;
}
export function ac(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.1, 0.9, 0.5, std('#e8e4dc', 0.6), 0, 0, 0));
  const fan = cyl(0.3, 0.05, std('#3a3a48', 0.5), 0, 0, 0.27); fan.rotation.x = Math.PI / 2; g.add(fan);
  return g;
}
export function cone(): THREE.Group { const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 10), std('#ff7a2a', 0.6)); c.position.y = 0.35; g.add(c, cyl(0.1, 0.02, std('#fff', 0.5), 0, 0.4, 0, 10)); g.add(box(0.7, 0.05, 0.7, std('#222', 0.8), 0, 0.02, 0)); return g; }
export function cardboardStack(seed = 1): THREE.Group {
  const g = new THREE.Group(); const rnd = mulberry(seed); const cols = ['#c9a26a', '#b88e56', '#d6b27a'];
  const n = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const w = 0.9 + rnd() * 0.6, h = 0.7 + rnd() * 0.5, d = 0.9 + rnd() * 0.5;
    const y = i < 2 ? h / 2 : 0.7 + h / 2;
    const b = box(w, h, d, std(cols[i % 3], 0.95), (i % 2 ? 0.5 : -0.4) + (rnd() - 0.5) * 0.3, i === 2 ? 0.7 + h / 2 : h / 2, i < 2 ? (i ? 0.55 : 0) : 0.2);
    b.rotation.y = (rnd() - 0.5) * 0.5; void y; g.add(b);
    const tape = box(w * 0.18, 0.02, d * 1.02, std('#e8dcc0', 0.9), 0, h / 2 + 0.01, 0); b.add(tape);
  }
  return g;
}
export function trashCan(color = '#3a4a5a'): THREE.Group { const g = new THREE.Group(); g.add(cyl(0.35, 0.9, std(color, 0.6, 0.3), 0, 0.45)); g.add(cyl(0.38, 0.08, std('#222', 0.6), 0, 0.94)); return g; }
export function vending(color = '#ff4aa8'): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.1, 2.1, 0.8, std('#2a2a3a', 0.5, 0.4), 0, 1.05, 0));
  const front = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 1.5), glowMat(color)); front.position.set(0, 1.25, 0.41); g.add(front);
  for (let i = 0; i < 12; i++) { const c = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.3), glowMat(['#fff', '#7ff0ff', '#ffe27a', '#ff9ad0'][i % 4])); c.position.set(-0.3 + (i % 4) * 0.2, 1.7 - Math.floor(i / 4) * 0.45, 0.42); g.add(c); }
  return g;
}
export function lamp(color = '#ffd8a0', h = 5.2): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.08, h, std('#3a3a48', 0.5, 0.5), 0, h / 2));
  const arm = box(1.0, 0.08, 0.08, std('#3a3a48', 0.5, 0.5), 0.45, h, 0); g.add(arm);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), glowMat(color)); bulb.position.set(0.9, h - 0.15, 0); g.add(bulb);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); halo.scale.set(3, 3, 1); halo.position.copy(bulb.position); g.add(halo);
  return g;
}
export function pole(h = 11): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.18, h, std('#a05a3a', 0.85), 0, h / 2, 0, 8));
  for (const y of [h - 0.5, h - 1.6]) { g.add(box(3.2, 0.14, 0.14, std('#7a4a30', 0.9), 0, y, 0)); for (const x of [-1.3, -0.45, 0.45, 1.3]) g.add(cyl(0.07, 0.25, std('#e8e0d0', 0.4), x, y + 0.18, 0, 6)); }
  g.add(box(0.7, 0.9, 0.5, std('#555a66', 0.6, 0.4), 0.45, h - 3.5, 0.3));
  return g;
}
/** 垂挂的电线（悬链线近似） */
export function wire(a: THREE.Vector3, b: THREE.Vector3, sag = 0.9): THREE.Mesh {
  const mid = a.clone().add(b).multiplyScalar(0.5); mid.y -= sag;
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 14, 0.045, 5, false), std('#16161e', 0.6));
  return m;
}
export function planterBox(w = 2): THREE.Group { const g = new THREE.Group(); g.add(box(w, 0.5, 0.6, std('#e8e4dc', 0.7), 0, 0.25, 0)); const b = bush(0.55, Math.round(w * 7)); b.scale.x = w / 1.2; b.position.y = 0.4; g.add(b); return g; }

export function manekiNeko(s = 1): THREE.Group {
  const g = new THREE.Group(); const white = std('#fff6ee', 0.5), pink = std('#ff9aa8', 0.5);
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.5 * s, 24, 18), white); body.scale.set(1, 1.05, 0.92); body.position.y = 1.5 * s; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(1.2 * s, 24, 18), white); head.scale.set(1.12, 0.95, 0.95); head.position.y = 3.1 * s; g.add(head);
  for (const x of [-1, 1]) { const e = new THREE.Mesh(new THREE.ConeGeometry(0.42 * s, 0.8 * s, 4), white); e.position.set(x * 0.82 * s, 4.05 * s, 0); e.rotation.z = -x * 0.3; e.rotation.y = Math.PI / 4; g.add(e); const i = new THREE.Mesh(new THREE.ConeGeometry(0.26 * s, 0.5 * s, 4), pink); i.position.set(x * 0.82 * s, 3.98 * s, 0.1 * s); i.rotation.z = -x * 0.3; i.rotation.y = Math.PI / 4; g.add(i); }
  const collar = new THREE.Mesh(new THREE.TorusGeometry(1.1 * s, 0.14 * s, 8, 24), pink); collar.rotation.x = Math.PI / 2; collar.position.y = 2.3 * s; collar.scale.y = 0.9; g.add(collar);
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.28 * s, 12, 10), glowMat('#ffd24a')); bell.position.set(0, 2.15 * s, 1.1 * s); g.add(bell);
  for (const x of [-1, 1]) { const eye = new THREE.Mesh(new THREE.TorusGeometry(0.22 * s, 0.045 * s, 6, 12, Math.PI), std('#3a2430', 0.6)); eye.position.set(x * 0.5 * s, 3.2 * s, 1.08 * s); g.add(eye); }
  const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.75 * s, 0.75 * s, 0.14 * s, 20), glowMat('#ffbe3a')); coin.rotation.x = Math.PI / 2; coin.position.set(1.15 * s, 1.5 * s, 1.0 * s); g.add(coin);
  const paw = new THREE.Mesh(new THREE.SphereGeometry(0.45 * s, 12, 10), white); paw.position.set(1.5 * s, 2.6 * s, 0.9 * s); g.add(paw);
  return g;
}

export function tram(): THREE.Group {
  const g = new THREE.Group(); const body = std('#d8c88a', 0.6, 0.2), green = std('#3a6a52', 0.6, 0.2);
  g.add(box(3.2, 1.9, 9, green, 0, 1.6, 0));
  g.add(box(3.22, 1.2, 9.02, body, 0, 2.2, 0));
  g.add(box(3.0, 0.2, 8.6, std('#2a2a38', 0.6), 0, 3.35, 0));
  g.add(box(1.4, 0.35, 2.6, std('#1a1a28', 0.6), 0, 3.6, 0));
  for (let i = 0; i < 6; i++) { for (const x of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.9), glowMat('#ffe9b0')); w.position.set(x * 1.62, 2.3, -3.6 + i * 1.45); w.rotation.y = x > 0 ? Math.PI / 2 : -Math.PI / 2; g.add(w); } }
  const lamp1 = new THREE.Mesh(new THREE.CircleGeometry(0.25, 12), glowMat('#fff6c0')); lamp1.position.set(0.8, 1.2, 4.52); g.add(lamp1);
  const lamp2 = lamp1.clone(); lamp2.position.x = -0.8; g.add(lamp2);
  const dest = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.5), glowMat('#fff', neonSign('1332 纸箱街', '#ffe27a', { w: 256, h: 72 }))); dest.position.set(0, 2.9, 4.52); g.add(dest);
  for (const z of [-3, 3]) g.add(box(3.0, 0.5, 1.8, std('#222', 0.8), 0, 0.5, z));
  return g;
}

export function building(s: BuildingSpec): THREE.Group {
  const g = new THREE.Group(); const rnd = mulberry(s.seed);
  const upper = (s.floors - 1) * FLOOR_H;
  const bays = Math.max(1, Math.round(s.w / 3.2));
  const dBays = Math.max(1, Math.round(s.d / 3.2));
  // 同风格的楼共用一份立面材质（贴图在 UV 上按开间 / 层数缩放），合批后每种风格只需一次绘制
  const wallMat = facadeMat(s.style, s.seed % 3);
  const wall = (fl: number, y0: number, hgt: number) => {
    const faces: [number, number, number, number, number][] = [ // [宽, 旋转y, x, z, 开间数]
      [s.w, 0, 0, s.d / 2, bays], [s.w, Math.PI, 0, -s.d / 2, bays], [s.d, Math.PI / 2, s.w / 2, 0, dBays], [s.d, -Math.PI / 2, -s.w / 2, 0, dBays],
    ];
    const geos: THREE.BufferGeometry[] = [];
    for (const [fw, ry, x, z, nb] of faces) {
      const pg = new THREE.PlaneGeometry(fw, hgt);
      const uv = pg.getAttribute('uv') as THREE.BufferAttribute;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * (nb / 2), uv.getY(k) * fl);
      pg.rotateY(ry); pg.translate(x, y0 + hgt / 2, z);
      geos.push(pg);
    }
    const m = new THREE.Mesh(mergeGeometries(geos, false)!, wallMat);
    m.castShadow = m.receiveShadow = true; g.add(m);
  };
  wall(1, SHOP_H, FLOOR_H);                                  // 二楼（始终显示）
  if (s.floors > 2) wall(s.floors - 2, SHOP_H + FLOOR_H, upper - FLOOR_H); // 三楼以上（遮挡视线时折叠）
  // 一层店面
  const shopMat = std('#2a2634', 0.7, 0.1);
  g.add(box(s.w, SHOP_H, s.d, shopMat, 0, SHOP_H / 2, 0));
  const sc = s.shop?.color ?? '#7ff0ff';
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(s.w * 0.78, SHOP_H * 0.55), glowMat(new THREE.Color(sc).lerp(new THREE.Color('#ffe9c0'), 0.55).getHex())); glass.position.set(0, SHOP_H * 0.42, s.d / 2 + 0.03); (glass.material as THREE.MeshBasicMaterial).opacity = 1; g.add(glass);
  // 窗格
  for (let i = 1; i < 4; i++) g.add(box(0.1, SHOP_H * 0.55, 0.06, std('#1a1824', 0.6), -s.w * 0.39 + i * (s.w * 0.78) / 4, SHOP_H * 0.42, s.d / 2 + 0.06));
  // 遮阳篷（斜面 + 条纹）
  const aw = s.shop?.awning ?? ['#e8f4ee', '#4a9a82'];
  const awning = new THREE.Mesh(new THREE.BoxGeometry(s.w * 0.9, 0.12, 1.5), new THREE.MeshStandardMaterial({ map: tiled(stripes(aw[0], aw[1], 10), 1, 1), roughness: 0.8 }));
  awning.position.set(0, SHOP_H - 0.7, s.d / 2 + 0.7); awning.rotation.x = 0.28; awning.castShadow = true; g.add(awning);
  // 店招
  if (s.shop) {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(s.w * 0.7, 5), 1.15), glowMat('#ffffff', neonSign(s.shop.name, s.shop.color)));
    sign.position.set(0, SHOP_H + 0.65, s.d / 2 + 0.08); g.add(sign);
  }
  // 楼层檐线
  for (let f = 1; f <= s.floors; f++) g.add(box(s.w + 0.4, 0.22, s.d + 0.4, std('#cdbfa6', 0.8), 0, SHOP_H + (f - 1) * FLOOR_H, 0));
  // 阳台
  if (s.floors >= 3 && rnd() < 0.8) {
    const fy = SHOP_H + FLOOR_H * 1 + 0.5;
    g.add(box(s.w * 0.55, 0.12, 1.1, std('#8a5a3a', 0.8), 0, fy - 0.45, s.d / 2 + 0.55));
    for (let i = 0; i <= 12; i++) g.add(box(0.05, 0.9, 0.05, std('#8a5a3a', 0.8), -s.w * 0.275 + i * (s.w * 0.55) / 12, fy, s.d / 2 + 1.05));
    g.add(box(s.w * 0.55, 0.08, 0.08, std('#8a5a3a', 0.8), 0, fy + 0.45, s.d / 2 + 1.05));
  }
  // 空调外机
  const nAc = 2 + Math.floor(rnd() * 3);
  for (let i = 0; i < nAc; i++) { const a = ac(); const side = rnd() < 0.5 ? 1 : -1; a.position.set(side * (s.w / 2 + 0.28), SHOP_H + 1.2 + Math.floor(rnd() * Math.max(1, s.floors - 1)) * FLOOR_H, (rnd() - 0.5) * s.d * 0.6); a.rotation.y = side * Math.PI / 2; g.add(a); }
  // 水管
  g.add(cyl(0.1, SHOP_H + FLOOR_H, std('#6a6a78', 0.5, 0.5), s.w / 2 - 0.4, (SHOP_H + FLOOR_H) / 2, s.d / 2 + 0.12));
  if (s.floors > 2) g.add(cyl(0.1, upper - FLOOR_H, std('#6a6a78', 0.5, 0.5), s.w / 2 - 0.4, SHOP_H + FLOOR_H + (upper - FLOOR_H) / 2, s.d / 2 + 0.12));
  // 竖招牌（侧挂）
  (s.signs ?? []).forEach((sg, i) => {
    const sw = sg.vertical ? 1.1 : 3.2, sh = sg.vertical ? 4.4 : 1.1;
    const m = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, 0.3), [std('#222', 0.5), std('#222', 0.5), std('#222', 0.5), std('#222', 0.5), glowMat('#ffffff', neonSign(sg.text, sg.color, { vertical: sg.vertical })), glowMat('#ffffff', neonSign(sg.text, sg.color, { vertical: sg.vertical }))]);
    m.position.set(-s.w / 2 + 0.7 + i * 1.6, SHOP_H + 2.6 + i * 0.8, s.d / 2 + 0.7); g.add(m);
  });
  // 屋顶
  const top = SHOP_H + upper;
  const roof = s.roof ?? 'flat';
  g.add(box(s.w + 0.5, 0.35, s.d + 0.5, std('#3a3646', 0.7), 0, top + 0.17, 0));
  if (roof === 'tile') {
    const sh = new THREE.Shape(); sh.moveTo(-s.d / 2 - 0.4, 0); sh.lineTo(0, 2.0); sh.lineTo(s.d / 2 + 0.4, 0); sh.lineTo(-s.d / 2 - 0.4, 0);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: s.w + 0.6, bevelEnabled: false });
    const m = new THREE.Mesh(geo, std('#a8503f', 0.65)); m.rotation.y = Math.PI / 2; m.position.set(-(s.w + 0.6) / 2, top + 0.35, 0); m.castShadow = true; g.add(m);
    for (let i = 0; i < 6; i++) g.add(box(s.w + 0.7, 0.04, 0.05, std('#7a3a30', 0.7), 0, top + 0.5 + i * 0.28, (i % 2 ? 1 : -1) * (s.d / 2 - i * 0.14)));
  } else if (roof === 'garden') {
    for (const [w, d, x, z] of [[s.w, 0.15, 0, s.d / 2], [s.w, 0.15, 0, -s.d / 2], [0.15, s.d, s.w / 2, 0], [0.15, s.d, -s.w / 2, 0]] as number[][]) g.add(box(w, 1.1, d, std('#d8c8a8', 0.8), x, top + 0.9, z));
    for (const x of [-s.w * 0.22, s.w * 0.22]) { const p = planterBox(s.w * 0.36); p.position.set(x, top + 0.35, s.d * 0.12); g.add(p); }
    g.add(box(0.7, 0.1, 0.7, std('#8a5a3a', 0.8), 0, top + 1.0, -s.d * 0.18));
    for (const dx of [-0.3, 0.3]) for (const dz of [-0.3, 0.3]) g.add(box(0.06, 0.8, 0.06, std('#8a5a3a', 0.8), dx, top + 0.6, -s.d * 0.18 + dz));
  } else if (roof === 'tank') {
    g.add(cyl(0.9, 1.6, std('#8a98a8', 0.5, 0.5), -s.w * 0.2, top + 1.2, 0)); g.add(cyl(0.9, 1.6, std('#8a98a8', 0.5, 0.5), s.w * 0.2, top + 1.2, 0));
    for (let i = 0; i < 3; i++) { const a = ac(); a.position.set(-s.w * 0.3 + i * 1.3, top + 0.8, s.d * 0.25); g.add(a); }
  } else {
    for (let i = 0; i < 3; i++) { const a = ac(); a.position.set(-s.w * 0.3 + i * 1.3, top + 0.8, -s.d * 0.2); g.add(a); }
  }
  // 天线
  g.add(cyl(0.04, 2.4, std('#3a3a48', 0.5, 0.5), s.w * 0.3, top + 1.6, -s.d * 0.3, 5)); g.add(box(1.0, 0.04, 0.04, std('#3a3a48', 0.5, 0.5), s.w * 0.3, top + 2.4, -s.d * 0.3));
  // 霓虹点光（不实时投光，用地面光晕）
  if (s.neon) {
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(s.w * 1.6, 5), new THREE.MeshBasicMaterial({ map: glowTex(), color: s.neon, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    halo.rotation.x = -Math.PI / 2; halo.position.set(0, 0.06, s.d / 2 + 2.6); g.add(halo);
  }
  // 拆成「低层」和「高层」：高层在被挡住视线时折叠（像立体书一样压下去），低层始终显示
  const hy = SHOP_H + FLOOR_H;
  const out = new THREE.Group(), low = new THREE.Group(), high = new THREE.Group();
  high.position.y = hy;
  for (const c of [...g.children]) {
    g.remove(c);
    // 一层的檐线在 y=SHOP_H；二层檐线 y=hy 起归高层
    if (c.position.y >= hy - 0.01 && !(c as unknown as THREE.Sprite).isSprite) { c.position.y -= hy; high.add(c); } else low.add(c);
  }
  out.add(low, high);
  out.userData = { low, high, top: SHOP_H + upper + 3, hy };
  return out;
}

const STALLS: [string, string, string, string][] = [ // [篷色A, 篷色B, 招牌色, 招牌字]
  ['#fff0d8', '#ff7a3a', '#ff9a4a', '烧'], ['#fff0f8', '#ff5aa8', '#ff7ad9', '糖'], ['#e8fff8', '#2aa8c8', '#7ff0ff', '鱼'],
  ['#fff8d8', '#d9483b', '#ffe27a', '面'], ['#f0fff4', '#3aa86a', '#4fe08a', '茶'], ['#f0e8ff', '#7a5aff', '#9a7aff', '酒'],
];
/** 夜市小摊：条纹篷 + 灯笼 + 发光小招牌 + 台面上的食物（朝 +z） */
export function stall(variant = 0): THREE.Group {
  const [a, b, sc, ch] = STALLS[variant % STALLS.length];
  const g = new THREE.Group();
  g.add(box(2.4, 0.9, 1.3, std('#3a2a30', 0.8), 0, 0.45, 0));
  g.add(box(2.5, 0.12, 1.4, std('#8a5a3a', 0.8), 0, 0.95, 0));
  for (const dx of [-1.15, 1.15]) for (const dz of [-0.6, 0.6]) g.add(cyl(0.05, 2.6, std('#5a4a3a', 0.8), dx, 1.5, dz, 6));
  const awn = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.1, 1.9), new THREE.MeshStandardMaterial({ map: tiled(stripes(a, b, 8), 1, 1), roughness: 0.8 }));
  awn.position.set(0, 2.85, 0.15); awn.rotation.x = 0.18; g.add(awn);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), glowMat('#ffffff', neonSign(ch, sc, { w: 128, h: 128 })));
  sign.position.set(0, 2.2, 0.72); g.add(sign);
  for (const dx of [-1.0, 1.0]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), glowMat(sc)); l.position.set(dx, 2.55, 0.8); g.add(l); }
  const foodCols = ['#e8a23a', '#d9483b', '#f4efe6', '#8a5a3a'];
  for (let i = 0; i < 6; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 5), std(foodCols[i % 4], 0.8)); f.position.set(-0.8 + i * 0.32, 1.12, 0.1); g.add(f); }
  const steam = new THREE.Mesh(new THREE.CylinderGeometry(0.0, 0.0, 0.01), std('#fff', 1)); g.add(steam);
  return g;
}
/** 横跨街道的霓虹拱门：两根立柱 + 横梁 + 发光大字（拱门平面沿 x，朝 +z；放置时旋转） */
export function arch(text: string, color: string, span = 10): THREE.Group {
  const g = new THREE.Group();
  for (const s of [-1, 1]) g.add(box(0.7, 7, 0.7, std('#2a2a3a', 0.5, 0.5), s * span / 2, 3.5, 0));
  g.add(box(span + 1.4, 0.7, 0.8, std('#2a2a3a', 0.5, 0.5), 0, 7.2, 0));
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.6), glowMat('#ffffff', neonSign(text, color, { w: 256, h: 96 }))); sg.position.set(0, 8.4, 0.45); g.add(sg);
  const sg2 = sg.clone(); sg2.rotation.y = Math.PI; sg2.position.z = -0.45; g.add(sg2);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(span, 0.12, 0.12), glowMat(color)); strip.position.set(0, 6.8, 0.42); g.add(strip);
  return g;
}
/** 一串灯笼（沿悬链线挂在两点之间） */
export function lanternString(a: THREE.Vector3, b: THREE.Vector3, color: string, n = 7): THREE.Group {
  const g = new THREE.Group(); g.add(wire(a, b, 1.1));
  const mid = a.clone().add(b).multiplyScalar(0.5); mid.y -= 1.1;
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
  for (let i = 1; i < n; i++) { const p = curve.getPoint(i / n); const l = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 6), glowMat(color)); l.scale.y = 1.25; l.position.set(p.x, p.y - 0.4, p.z); g.add(l); }
  return g;
}
