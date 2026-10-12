// 中式建筑小件（夜市 / 港口 / 宫阙共用）：飞檐屋顶、殿堂、楼阁、牌楼、灯笼、旗、台阶、栏杆、宝塔。
// 约定同 kit.ts：原点在底部中心，+z 为正面；材质走 kit.std / glowMat 缓存，静态件交给 bakeStatic 合批。
import * as THREE from 'three';
import { glowMat, std } from '../kit';
import { mk, neonSign } from '../tex';

const box = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; };
const cyl = (r0: number, r1: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 10) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat); m.position.set(x, y, z); m.castShadow = true; return m; };

/** 飞檐屋顶（庑殿式）：底部 w×d，高 h；两层瓦面 + 四角翘起的檐角 + 正脊 */
const tileMats = new Map<string, THREE.MeshStandardMaterial>();
/** 瓦面：一排排半圆瓦片的贴图（按瓦色缓存） */
function tileMat(color: string): THREE.MeshStandardMaterial {
  let m = tileMats.get(color);
  if (!m) {
    const t = mk(64, 64, (c) => {
      c.fillStyle = color; c.fillRect(0, 0, 64, 64);
      for (let y = 0; y < 64; y += 8) for (let x = (y / 8) % 2 ? 0 : 8; x < 72; x += 16) { c.strokeStyle = 'rgba(0,0,0,.28)'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 8, 0, Math.PI); c.stroke(); c.fillStyle = 'rgba(255,255,255,.10)'; c.beginPath(); c.arc(x, y, 6, 0.2, Math.PI - 0.2); c.fill(); }
    }, `tile${color}`);
    const tt = t.clone(); tt.wrapS = tt.wrapT = THREE.RepeatWrapping; tt.repeat.set(5, 4); tt.needsUpdate = true;
    m = new THREE.MeshStandardMaterial({ map: tt, roughness: 0.55, metalness: 0.12 });
    tileMats.set(color, m);
  }
  return m;
}
export function eaveRoof(w: number, d: number, h: number, tile = '#3a8a8a', trim = '#e8b04a'): THREE.Group {
  const g = new THREE.Group(); const tm = tileMat(tile), ti = std(trim, 0.4, 0.5);
  // 四棱台（4 段圆柱转 45°就是方台；半边长 = 半径 × 0.7071，再按 w / d 拉伸）
  const frus = (rTop: number, hh: number, halfW: number, halfD: number, y: number) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, 1, hh, 4, 1), tm);
    m.rotation.y = Math.PI / 4; m.scale.set(halfW / 0.7071, 1, halfD / 0.7071); m.position.y = y; m.castShadow = true; g.add(m);
  };
  frus(0.42, h * 0.55, w / 2 * 1.14, d / 2 * 1.14, h * 0.275);              // 下层大坡（檐口外挑）
  frus(0.12, h * 0.5, w / 2 * 0.52, d / 2 * 0.62, h * 0.55 + h * 0.25 - 0.1); // 上层小坡
  g.add(box(w * 0.34, 0.3, 0.42, ti, 0, h * 1.02, 0)); // 正脊
  for (const sx of [-1, 1]) { const tip = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7, 5), ti); tip.position.set(sx * w * 0.19, h * 1.08, 0); tip.rotation.z = -sx * 0.35; g.add(tip); }
  // 檐角：四角向上翘的金尖
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.26, 1.1, 5), ti); c.position.set(sx * (w / 2 * 1.14 + 0.1), 0.45, sz * (d / 2 * 1.14 + 0.1)); c.rotation.set(sz * 0.55, 0, -sx * 0.55); g.add(c); }
  g.add(box(w * 1.16 + 0.2, 0.2, d * 1.16 + 0.2, ti, 0, 0.06, 0)); // 檐口金边
  return g;
}

/** 朱红柱 + 金柱头 */
export const redPillar = (h: number, r = 0.34, col = '#b83228'): THREE.Group => {
  const g = new THREE.Group();
  g.add(cyl(r * 1.5, r * 1.5, 0.35, std('#d8c8a8', 0.8), 0, 0.17)); g.add(cyl(r, r, h, std(col, 0.55, 0.1), 0, h / 2 + 0.3)); g.add(cyl(r * 1.3, r * 1.3, 0.3, std('#e8b04a', 0.4, 0.5), 0, h + 0.4));
  return g;
};

/** 纸灯笼（亮着）：红 / 橙 / 金；带上下盖与流苏 */
export function lantern(color = '#ff5a3a', s = 1): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.42 * s, 10, 8), glowMat(color)); body.scale.y = 1.2; g.add(body);
  g.add(cyl(0.2 * s, 0.2 * s, 0.1 * s, std('#3a2a20', 0.8), 0, 0.52 * s)); g.add(cyl(0.2 * s, 0.2 * s, 0.1 * s, std('#3a2a20', 0.8), 0, -0.52 * s));
  g.add(cyl(0.025 * s, 0.025 * s, 0.5 * s, std('#e8b04a', 0.5), 0, -0.82 * s, 0, 4));
  return g;
}
/** 牌楼：两柱一匾（朝 +z），span 为两柱间距 */
export function paifang(text: string, color: string, span = 10, h = 7.5, tile = '#2f7a7a'): THREE.Group {
  const g = new THREE.Group();
  for (const s of [-1, 1]) { const p = redPillar(h, 0.45); p.position.x = s * span / 2; g.add(p); const st = box(1.6, 1.0, 1.6, std('#cfc4b0', 0.85), s * span / 2, 0.5, 0); g.add(st); }
  g.add(box(span + 1.6, 0.7, 0.9, std('#b83228', 0.6), 0, h + 0.2, 0)); g.add(box(span + 1.8, 0.2, 1.1, std('#e8b04a', 0.4, 0.5), 0, h + 0.62, 0));
  const roof = eaveRoof(span + 1.6, 2.2, 1.8, tile); roof.position.y = h + 0.7; g.add(roof);
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.5), glowMat('#ffffff', neonSign(text, color, { w: 256, h: 96 }))); plaque.position.set(0, h + 0.2, 0.5); g.add(plaque);
  const p2 = plaque.clone(); p2.rotation.y = Math.PI; p2.position.z = -0.5; g.add(p2);
  return g;
}
/** 台阶：n 级，每级高 rise 深 run，宽 w；朝 +z 上行（高端在 -z） */
export function stairs(w: number, n: number, rise = 0.32, run = 0.7, col = '#e8e0d0'): THREE.Group {
  const g = new THREE.Group(); const m = std(col, 0.8);
  for (let i = 0; i < n; i++) g.add(box(w, rise * (i + 1), run * (n - i), m, 0, rise * (i + 1) / 2, -run * (n - i) / 2 + run * n / 2 - run * n / 2));
  return g;
}
/** 汉白玉栏杆：沿 x 方向 len 长 */
export function balustrade(len: number, col = '#f0ece0'): THREE.Group {
  const g = new THREE.Group(); const m = std(col, 0.7);
  g.add(box(len, 0.14, 0.28, m, 0, 1.0, 0)); g.add(box(len, 0.12, 0.34, m, 0, 0.15, 0));
  for (let x = -len / 2 + 0.3; x <= len / 2; x += 1.1) { g.add(box(0.2, 0.9, 0.2, m, x, 0.55, 0)); const k = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 5), m); k.position.set(x, 1.15, 0); g.add(k); }
  return g;
}
/** 旗幡（飘动由外部 update 做）：竿 + 旗面 */
export function banner(color = '#d9483b', text = '猫', h = 6): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.07, 0.09, h, std('#6a4a30', 0.8), 0, h / 2, 0, 6));
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.6, 6, 1), new THREE.MeshStandardMaterial({ map: mk(64, 128, (c) => { c.fillStyle = color; c.fillRect(0, 0, 64, 128); c.strokeStyle = '#ffe9a0'; c.lineWidth = 4; c.strokeRect(3, 3, 58, 122); c.fillStyle = '#ffe9a0'; c.font = '900 44px "ZCOOL KuaiLe","Noto Sans SC",sans-serif'; c.textAlign = 'center'; c.fillText(text, 32, 80); }, `banner${color}${text}`), side: THREE.DoubleSide, roughness: 0.8 }));
  cloth.position.set(0.85, h - 1.5, 0); cloth.name = 'cloth'; g.add(cloth);
  return g;
}
/** 宝塔：n 层，逐层收小，每层一圈飞檐 */
export function pagoda(n = 5, base = 5, tile = '#2f7a7a'): THREE.Group {
  const g = new THREE.Group(); let y = 0;
  g.add(box(base + 1.6, 0.8, base + 1.6, std('#d8d0c0', 0.85), 0, 0.4, 0)); y = 0.8;
  for (let i = 0; i < n; i++) {
    const w = base * (1 - i * 0.13), h = 2.6;
    g.add(box(w, h, w, std('#c8352c', 0.6), 0, y + h / 2, 0));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(cyl(0.2, 0.2, h, std('#8a2018', 0.6), sx * w / 2, y + h / 2, sz * w / 2, 6));
    const r = eaveRoof(w + 1.2, w + 1.2, 1.5, tile); r.position.y = y + h; g.add(r);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.34, h * 0.5), glowMat('#ffd890')); win.position.set(0, y + h / 2, w / 2 + 0.02); g.add(win);
    y += h + 1.0;
  }
  const sp = new THREE.Mesh(new THREE.ConeGeometry(0.3, 2.8, 6), std('#e8b04a', 0.4, 0.5)); sp.position.y = y + 1.4; g.add(sp);
  return g;
}
/** 带柱廊的殿堂（正面朝 +z）：台基 + 柱 + 墙 + 飞檐顶；floors 层，上层有挑出的回廊 */
export function hall(w: number, d: number, floors = 1, o: { wall?: string; tile?: string; pillar?: string; sign?: { text: string; color: string }; floorH?: number; lanterns?: string } = {}): THREE.Group {
  const g = new THREE.Group(); const fh = o.floorH ?? 4.2;
  g.add(box(w + 1.2, 0.6, d + 1.2, std('#d8d0c0', 0.85), 0, 0.3, 0));
  let y = 0.6;
  for (let f = 0; f < floors; f++) {
    g.add(box(w * 0.92, fh, d * 0.9, std(o.wall ?? '#f0e4cc', 0.85), 0, y + fh / 2, 0));
    const n = Math.max(3, Math.round(w / 3.2));
    for (let i = 0; i <= n; i++) { const p = redPillar(fh - 0.5, 0.28, o.pillar ?? '#b83228'); p.position.set(-w / 2 + (w / n) * i, y - 0.3 + 0.0, d / 2 + 0.2); g.add(p); }
    for (let i = 0; i < n; i++) { const win = new THREE.Mesh(new THREE.PlaneGeometry(w / n * 0.5, fh * 0.45), glowMat('#ffcf80')); win.position.set(-w / 2 + w / n * (i + 0.5), y + fh * 0.55, d * 0.45 + 0.02); g.add(win); }
    if (f < floors - 1) { g.add(box(w + 1.6, 0.25, d + 1.6, std('#8a5a38', 0.8), 0, y + fh + 0.12, 0)); const r = eaveRoof(w + 0.6, d + 0.4, 1.2, o.tile ?? '#3a8a8a'); r.scale.set(1, 0.6, 1); r.position.y = y + fh + 0.2; g.add(r); }
    y += fh + 0.4;
  }
  const roof = eaveRoof(w + 0.8, d + 0.6, 2.8 + Math.min(w, d) * 0.12, o.tile ?? '#3a8a8a'); roof.position.y = y - 0.2; g.add(roof);
  if (o.sign) { const sg = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w * 0.6, 4.2), 1.3), glowMat('#ffffff', neonSign(o.sign.text, o.sign.color, { w: 256, h: 80 }))); sg.position.set(0, 0.6 + fh * 0.86, d / 2 + 0.6); g.add(sg); }
  if (o.lanterns) for (let i = 0; i < 3; i++) { const l = lantern(o.lanterns, 0.7); l.position.set(-w * 0.32 + i * w * 0.32, 0.6 + fh - 0.5, d / 2 + 0.9); g.add(l); }
  g.userData.height = y + 3;
  return g;
}
