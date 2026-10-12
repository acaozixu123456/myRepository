// 探索控制器：操控一队猫猫在 3D 街区里走动，遇到敌人 / 宝箱 / NPC 触发事件。
// 玩法层（遭遇战、奖励、剧情）通过 hooks 注入，这里只管世界里的事：移动、寻路、跟随、巡逻、触碰。
import * as THREE from 'three';
import { buildCat3D } from '../art3d/cat3d';
import { detail } from '../art3d/toon';
import type { Cat3D } from '../art3d/cat3d';
import { applyPose } from '../art3d/pose';
import { PET_BY_ID } from '../data/pets';
import { lookOf, unitInfo } from '../data/units';
import type { WorldView } from './engine';
import type { AABB, Street } from './street';
import { CELL, COVER_R, PORTAL_R, SAFE_R, blockedGrid, coverSpotsOf, inSafeZone, portalSpotsOf, zonesOf } from './levels';
import type { Zone } from './levels';
import { glowTex } from './tex';
import { glowMat, std } from './kit';

export interface Spawn {
  id: string;
  kind: 'enemy' | 'boss' | 'chest' | 'herb' | 'npc' | 'poi';
  x: number; z: number;
  /** enemy / boss：这一队长什么样（单位 id，最多 3 个） */
  units?: string[];
  label: string;
  /** 巡逻半径 */
  patrol?: number;
  data?: unknown;
  /** 隐藏宝箱：走近或用「灵视」才会显形 */
  hidden?: boolean;
}
/** 开战方式：player = 我方偷袭（背后 / 潜行 / 撞晕），enemy = 被抓住（敌方先手），none = 正面开战 */
export type Ambush = 'player' | 'enemy' | 'none';
export interface ExploreHooks {
  /** 触碰敌人：玩法层打一场战斗，返回是否获胜 */
  encounter(s: Spawn, mode: Ambush): Promise<boolean>;
  chest(s: Spawn): void;
  talk(s: Spawn): void;
  /** 走进玩法入口：返回的 Promise 结束前世界暂停（小游戏在 app 层） */
  poi?(s: Spawn): Promise<void>;
  /** 野怪刚发现队伍（音效用，可选） */
  alert?(s: Spawn): void;
  /** 队伍走到某只野怪 / 首领身边（可以主动开战）或离开（null）；界面据此显示「战斗」按钮 */
  near?(s: Spawn | null): void;
  /** 探索事件的提示（被发现 / 偷袭机会 / 宝箱显形…）；界面弹一句话 */
  note?(text: string): void;
}

/** 探路技：由队伍里的职业决定谁能放。冲撞 = 先锋 / 守护，潜行 = 刺客 / 神射，灵视 = 谋士 / 医者 */
export type ExploreSkill = 'dash' | 'sneak' | 'reveal';
export const SKILL_ROLES: Record<ExploreSkill, string[]> = { dash: ['先锋', '守护'], sneak: ['刺客', '神射'], reveal: ['谋士', '医者'] };
export const SKILL_CD: Record<ExploreSkill, number> = { dash: 9, sneak: 14, reveal: 16 };
const SIGHT = 9, SIGHT_SNEAK = 3.2, HALF_FOV = 0.95, CHASE_SPEED = 3.7, CATCH_R = 1.7;

interface Actor { cat: Cat3D; pos: THREE.Vector3; yaw: number; moving: number; shadow: THREE.Mesh; outlines: THREE.Object3D[] }
const ENGAGE_R = 5.2, ENGAGE_BOSS = 7;
interface Ent { spawn: Spawn; group: THREE.Group; cats: Actor[]; home: THREE.Vector3; target: THREE.Vector3; wait: number; alive: boolean; cooldown: number; alert: boolean; tag: THREE.Sprite; mark?: THREE.Sprite; t: number;
  /** 视野：朝向 / 状态（巡逻 · 追击 · 被撞晕）/ 视锥片 / 追丢计时 / 晕眩剩余 / 隐藏宝箱是否已发现 */
  face: number; state: 'idle' | 'alert' | 'chase' | 'stun'; cone?: THREE.Mesh; lost: number; stun: number; found: boolean; alertT: number }


const WORLD_CAT_DETAIL = 0.6;
const OUTLINE_DIST = 26; // 超过这个距离的实体猫不画描边外壳（小得看不出来）
const CULL_DIST = 46; // 超过这个距离（世界单位）的实体不渲染
const SPEED = 8.2;

function labelSprite(text: string, color: string, sub = ''): THREE.Sprite {
  const c = document.createElement('canvas'); c.width = 320; c.height = 96;
  const g = c.getContext('2d')!;
  g.font = '800 34px "Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round'; g.lineWidth = 9; g.strokeStyle = 'rgba(16,10,32,.9)'; g.strokeText(text, 160, sub ? 34 : 48); g.fillStyle = color; g.fillText(text, 160, sub ? 34 : 48);
  if (sub) { g.font = '700 26px "Noto Sans SC",sans-serif'; g.lineWidth = 7; g.strokeText(sub, 160, 72); g.fillStyle = '#ffe9a0'; g.fillText(sub, 160, 72); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, toneMapped: false }));
  s.scale.set(4.2, 1.26, 1); s.renderOrder = 10;
  return s;
}
function markSprite(ch: string, color: string): THREE.Sprite {
  const c = document.createElement('canvas'); c.width = c.height = 96;
  const g = c.getContext('2d')!;
  g.font = '900 78px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 12; g.lineJoin = 'round'; g.strokeStyle = '#2a1030'; g.strokeText(ch, 48, 52); g.fillStyle = color; g.fillText(ch, 48, 52);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, toneMapped: false }));
  s.scale.set(1.5, 1.5, 1); s.renderOrder = 11;
  return s;
}

/** 掩体外观：每个场景换一种皮（纸箱堆 / 货箱 / 木桶 / 草丛 / 云团 / 屏风），都是低模，躲在里面能看出来是「躲」 */
function coverMesh(theme: string | undefined): THREE.Group {
  const g = new THREE.Group();
  const add = (m: THREE.Mesh, x: number, y: number, z: number, ry = 0) => { m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = true; g.add(m); return m; };
  const rnd = (i: number) => { const v = Math.sin(i * 91.7) * 43758.5; return v - Math.floor(v); };
  if (theme === 'forest') {
    for (let i = 0; i < 7; i++) { const r = 0.9 + rnd(i) * 0.6; add(new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), std(i % 3 ? '#3fa05a' : '#56bd6a', 0.9)), Math.cos(i * 0.9) * 1.7, r * 0.8, Math.sin(i * 0.9) * 1.7); }
    for (let i = 0; i < 5; i++) add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5), glowMat(i % 2 ? '#ffd0e8' : '#fff4a0')), Math.cos(i * 1.7) * 1.9, 1.5 + (i % 2) * 0.3, Math.sin(i * 1.7) * 1.9);
  } else if (theme === 'cloud') {
    for (let i = 0; i < 7; i++) { const r = 0.9 + rnd(i + 3) * 0.7; const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, transparent: true, opacity: 0.92, emissive: '#cfe0ff', emissiveIntensity: 0.25 })); add(m, Math.cos(i * 0.95) * 1.6, r * 0.75, Math.sin(i * 0.95) * 1.6); }
  } else if (theme === 'palace') {
    for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3.0, 0.14), std(i % 2 ? '#c8352c' : '#a32420', 0.6)); add(m, (i - 1.5) * 1.35, 1.6, (i % 2) * 0.55, (i % 2 ? 0.45 : -0.45)); const f = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.14, 0.2), std('#e8c15a', 0.4, 0.6)); add(f, (i - 1.5) * 1.35, 3.1, (i % 2) * 0.55, (i % 2 ? 0.45 : -0.45)); }
  } else if (theme === 'desert') {
    for (let i = 0; i < 3; i++) { const h = 1.6 + rnd(i) * 1.0; add(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, h, 8), std('#4f9a4a', 0.85)), Math.cos(i * 2.1) * 1.3, h / 2, Math.sin(i * 2.1) * 1.3); }
    for (let i = 0; i < 4; i++) { const r = 0.7 + rnd(i + 5) * 0.5; const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), std(i % 2 ? '#c4885a' : '#a86e46', 0.95)); m.scale.y = 0.75; add(m, Math.cos(i * 1.6 + 0.5) * 1.9, r * 0.6, Math.sin(i * 1.6 + 0.5) * 1.9, i); }
  } else if (theme === 'snow') {
    for (let i = 0; i < 6; i++) { const r = 0.8 + rnd(i + 7) * 0.6; const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), std(i % 2 ? '#ffffff' : '#eef4ff', 0.85)); m.scale.y = 0.8; add(m, Math.cos(i * 1.05) * 1.6, r * 0.6, Math.sin(i * 1.05) * 1.6); }
  } else if (theme === 'beach') {
    for (let i = 0; i < 4; i++) { const r = 0.7 + rnd(i + 11) * 0.5; const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), std(i % 2 ? '#a89a88' : '#8a8070', 0.95)); m.scale.y = 0.7; add(m, Math.cos(i * 1.6) * 1.7, r * 0.55, Math.sin(i * 1.6) * 1.7, i); }
    const um = new THREE.Mesh(new THREE.ConeGeometry(1.6, 0.6, 10), std('#ff6a5a', 0.8)); add(um, 0, 2.2, 0); add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 5), std('#e8e0d0', 0.6)), 0, 1.1, 0);
  } else if (theme === 'onsen') {
    for (let i = 0; i < 5; i++) { const r = 0.7 + rnd(i + 13) * 0.5; const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), std(i % 2 ? '#8a8478' : '#9a9488', 0.95)); m.scale.y = 0.7; add(m, Math.cos(i * 1.25) * 1.7, r * 0.55, Math.sin(i * 1.25) * 1.7, i); }
    for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 1), std(['#ffb8d0', '#ffc8dc', '#ffa8c4'][i], 0.85)); b.scale.y = 0.7; add(b, Math.cos(i * 2.1) * 1.0, 1.4 + i * 0.3, Math.sin(i * 2.1) * 1.0); }
  } else if (theme === 'harbor') {
    for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.7, 1.4, 12), std('#7a4a2a', 0.8)); add(b, Math.cos(i * 1.3) * 1.6, 0.7, Math.sin(i * 1.3) * 1.6); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.67, 0.05, 6, 16), std('#3a3a44', 0.4, 0.6)); ring.rotation.x = Math.PI / 2; add(ring, Math.cos(i * 1.3) * 1.6, 0.9, Math.sin(i * 1.3) * 1.6); }
  } else if (theme === 'market') {
    for (let i = 0; i < 5; i++) { const w = 1.2 + rnd(i) * 0.7; add(new THREE.Mesh(new THREE.BoxGeometry(w, w * 0.9, w), std(i % 2 ? '#c08a52' : '#a8723e', 0.8)), Math.cos(i * 1.3) * 1.6, w * 0.45, Math.sin(i * 1.3) * 1.6, i * 0.5); }
    add(new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), std('#e8d2a0', 0.9)), 0.4, 0.5, 0.2);
  } else {
    // 街区：纸箱堆（纸箱街嘛）
    for (let i = 0; i < 5; i++) { const w = 1.2 + rnd(i + 9) * 0.8; add(new THREE.Mesh(new THREE.BoxGeometry(w, w * 0.8, w), std(i % 2 ? '#c9955a' : '#b5834a', 0.85)), Math.cos(i * 1.3) * 1.5, w * 0.4, Math.sin(i * 1.3) * 1.5, i * 0.6); }
    add(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.7, 1.0), std('#d6a468', 0.85)), 0.2, 1.1, 0.1, 0.4);
  }
  const ring = new THREE.Mesh(new THREE.RingGeometry(COVER_R - 0.12, COVER_R, 40), new THREE.MeshBasicMaterial({ color: 0xbaffd0, transparent: true, opacity: 0.28, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08; g.add(ring);
  return g;
}

const PORTAL_COLOR: Record<string, number> = { street: 0xff5ad8, market: 0xffb04a, harbor: 0x4ac8ff, forest: 0xb06aff, cloud: 0x9ad0ff, palace: 0xffd24a, desert: 0x7ff0ff, snow: 0x9ad8ff, beach: 0x4ae0d0, onsen: 0xff9ac0 };
/** 传送门外观：脚下转动的光环 + 一道光柱 + 光晕，一对同色 */
function portalMesh(theme: string | undefined): THREE.Group {
  const col = PORTAL_COLOR[theme ?? 'street'] ?? 0xff5ad8;
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.RingGeometry(PORTAL_R - 0.25, PORTAL_R, 40), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.1; g.add(ring);
  const ring2 = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.75, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
  ring2.rotation.x = -Math.PI / 2; ring2.position.y = 0.12; g.add(ring2);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(PORTAL_R * 0.8, PORTAL_R * 0.95, 5.5, 20, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.22, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  beam.position.y = 2.75; g.add(beam);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: col, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  halo.scale.set(6, 6, 1); halo.position.y = 0.6; g.add(halo);
  g.userData.spin = [ring, ring2, beam];
  return g;
}

/** 场景机关的外观：风口（青色圆盘 + 流动箭头）/ 潮汐滩（蓝色水洼 + 涟漪）/ 琉璃滑地（亮面圆盘 + 星点） */
function zoneMesh(z: Zone): THREE.Group {
  const g = new THREE.Group();
  const col = z.kind === 'wind' ? 0x9ae8ff : z.kind === 'tide' ? 0x1e8ae8 : z.kind === 'sand' ? 0xd49a52 : 0xa8e0ff;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(z.r, 36), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: z.kind === 'tide' ? 0.55 : z.kind === 'sand' ? 0.5 : z.kind === 'slide' ? 0.4 : 0.3, depthWrite: false, toneMapped: false }));
  disc.rotation.x = -Math.PI / 2; disc.position.y = 0.06; g.add(disc);
  const rim = new THREE.Mesh(new THREE.RingGeometry(z.r - 0.14, z.r, 36), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
  rim.rotation.x = -Math.PI / 2; rim.position.y = 0.08; g.add(rim);
  const marks: THREE.Object3D[] = [];
  if (z.kind === 'wind') {
    // 三枚朝风向的箭头，沿风向循环流动
    for (let i = 0; i < 3; i++) {
      const sh = new THREE.Shape(); sh.moveTo(0, 0.7); sh.lineTo(0.6, -0.1); sh.lineTo(0.22, -0.1); sh.lineTo(0.22, -0.7); sh.lineTo(-0.22, -0.7); sh.lineTo(-0.22, -0.1); sh.lineTo(-0.6, -0.1); sh.closePath();
      const a = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
      a.rotation.x = -Math.PI / 2; a.rotation.z = -Math.atan2(z.dx, z.dz) + Math.PI; a.rotation.order = 'YXZ'; a.userData.i = i; g.add(a); marks.push(a);
    }
  } else if (z.kind === 'tide' || z.kind === 'sand') {
    for (let i = 0; i < 2; i++) { const r = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })); r.rotation.x = -Math.PI / 2; r.position.y = 0.09; r.userData.i = i; g.add(r); marks.push(r); }
  } else {
    for (let i = 0; i < 6; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xfff6c8, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); sp.scale.setScalar(0.9); sp.userData.i = i; sp.position.set(Math.cos(i * 1.05) * z.r * 0.6, 0.3, Math.sin(i * 1.05) * z.r * 0.6); g.add(sp); marks.push(sp); }
  }
  g.userData.marks = marks; g.userData.zone = z;
  return g;
}

/** 各玩法入口的主色（脚下光环 / 光晕）与头顶标签色 */
const POI_COL: Record<string, string> = { ramen: '#ff5a4a', boxcat: '#ffcf5a', mushroom: '#b06aff', windchime: '#9ab8ff', lanterns: '#ffd24a', kart: '#ff7a3a', claw: '#ff6ac0', whack: '#9a7aff', ring: '#ffb04a', arrows: '#8ad0e8', firefly: '#b0ff6a', kite: '#ff9ab0', kitchen: '#ff8a4a', sled: '#9ad8ff', snowcat: '#ffd0e8', surf: '#4ae0d0', clams: '#ffb08a', skip: '#ffb8d0', sushi: '#ff9a6a' };
const POI_TAG: Record<string, string> = { ramen: '#ff9a8a', boxcat: '#ffe08a', mushroom: '#d8b0ff', windchime: '#c0d4ff', lanterns: '#ffe9a0', kart: '#ffb080', claw: '#ffa0dc', whack: '#c8b4ff', ring: '#ffd8a0', arrows: '#c0e8f4', firefly: '#d8ffb0', kite: '#ffc8d8', kitchen: '#ffc8a0', sled: '#d0ecff', snowcat: '#ffe8f2', surf: '#b8f4ec', clams: '#ffd8c0', skip: '#ffe0ec', sushi: '#ffd0b8' };

export class Explorer {
  readonly root = new THREE.Group();
  private team: Actor[] = [];
  private trail: THREE.Vector3[] = [];
  private path: THREE.Vector3[] = [];
  private ents: Ent[] = [];
  private grid: Uint8Array;
  private N: number;
  private ring: THREE.Mesh;
  private marker: THREE.Mesh;
  private markerT = 0;
  paused = false;
  private busy = false;
  /** 跟着队伍的柔光：一圈暖白的光，让猫猫在霓虹夜景里亮起来、颜色看得清 */
  private keyLight = new THREE.PointLight(0xfff1e0, 2.3, 13, 1.7);
  private nearEnt: Ent | null = null;
  private frameNear: Ent | null = null;
  private frameNearD = 1e9;
  t = 0;
  /** 点击地面时，若点到了某个实体附近，就走过去 */
  constructor(private wv: WorldView, private street: Street, teamIds: string[], private hooks: ExploreHooks) {
    this.N = street.half * 2 / CELL;
    this.grid = new Uint8Array(this.N * this.N);
    this.buildGrid(street.colliders);
    wv.scene.add(this.root);
    this.keyLight.intensity = wv.atmos.keyLight;
    this.root.add(this.keyLight);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.5, 32), new THREE.MeshBasicMaterial({ color: 0x7ff0ff, transparent: true, opacity: 0.9, toneMapped: false, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = 0.4; this.root.add(this.ring);
    this.marker = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.7, 24), new THREE.MeshBasicMaterial({ color: 0xff7ad9, transparent: true, opacity: 0, toneMapped: false, depthWrite: false }));
    this.marker.rotation.x = -Math.PI / 2; this.marker.position.y = 0.42; this.root.add(this.marker);
    this.zones = zonesOf(street.level);
    for (const z of this.zones) { const m = zoneMesh(z); m.position.set(z.x, 0.32, z.z); this.root.add(m); this.zoneMeshes.push(m); }
    this.portals = portalSpotsOf(street.level);
    for (const [x, z] of this.portals) { const m = portalMesh(street.level.theme); m.position.set(x, 0.32, z); this.root.add(m); this.portalMeshes.push(m); }
    this.covers = coverSpotsOf(street.level);
    for (const [x, z] of this.covers) { const m = coverMesh(street.level.theme); m.position.set(x, 0.32, z); m.rotation.y = (x * 7 + z * 3) % 6.28; this.root.add(m); }
    this.setTeam(teamIds);
    wv.onTap = (p) => this.tap(p);
  }

  // ---------- 探路技：冲撞 / 潜行 / 灵视（谁能放由队伍里的职业决定） ----------
  private covers: [number, number][] = [];
  private zones: Zone[] = [];
  private zoneMeshes: THREE.Group[] = [];
  private zoneNow: Zone | null = null;
  private vel = new THREE.Vector3();
  private pushed = false;
  private zoneAt(x: number, z: number): Zone | null { for (const q of this.zones) if (Math.hypot(q.x - x, q.z - z) < q.r) return q; return null; }
  /** 队伍当前的移动速度（潜行变慢，潮汐滩变慢，风口加速） */
  private get spd(): number { const k = this.zoneNow?.kind; return SPEED * (this.sneakT > 0 ? 0.62 : 1) * (k === 'tide' || k === 'sand' ? 0.55 : k === 'wind' ? 1.5 : 1); }
  private portals: [number, number][] = [];
  private portalMeshes: THREE.Group[] = [];
  private portalCd = 0;
  private inCover = false;
  /** 潜行中或躲在掩体里：敌人的视野缩到潜行水平，从这里出手算偷袭 */
  get hiding(): boolean { return this.sneakT > 0 || this.inCover; }
  private sneakT = 0;
  /** 刚进场景 / 被击退回出生点后的几秒宽限：敌人不会立刻发现你 */
  private grace = 4;
  private dashT = 0;
  private dashDir = new THREE.Vector3();
  private revealT = 0;
  private cd: Record<ExploreSkill, number> = { dash: 0, sneak: 0, reveal: 0 };
  private teamIds: string[] = [];
  private pulses: { m: THREE.Mesh; t: number; c: number }[] = [];
  /** 这个技能由谁放（队伍里第一个职业对得上的英雄）；没有就是 null（按钮置灰） */
  skillOwner(k: ExploreSkill): { id: string; name: string } | null {
    for (const id of this.teamIds) { try { const u = unitInfo(id); if (SKILL_ROLES[k].includes(u.role)) return { id, name: u.name }; } catch { /* 未知单位 */ } }
    return null;
  }
  /** 技能状态：冷却剩余 / 总冷却 / 生效剩余，界面画按钮用 */
  skillState(k: ExploreSkill) { return { owner: this.skillOwner(k), cd: this.cd[k], max: SKILL_CD[k], on: k === 'sneak' ? this.sneakT : k === 'reveal' ? this.revealT : this.dashT }; }
  useSkill(k: ExploreSkill): boolean {
    if (this.paused || this.busy || this.cd[k] > 0 || !this.skillOwner(k)) return false;
    const L = this.leader;
    this.cd[k] = SKILL_CD[k];
    if (k === 'sneak') { this.sneakT = 8; this.hooks.note?.('🤫 潜行 8 秒：敌人更难发现你，贴近可偷袭'); this.pulse(0x7ff0ff, 4, 0.5); }
    else if (k === 'reveal') { this.revealT = 6; this.hooks.note?.('👁️ 灵视：隐藏宝箱显形，敌人的视野一览无余'); this.pulse(0xffe27a, 26, 0.9); }
    else { this.path = []; this.dashT = 0.26; this.dashDir.set(Math.sin(L.yaw), 0, Math.cos(L.yaw)); this.pulse(0xffa04a, 3, 0.35); }
    return true;
  }
  private teleport([x, z]: [number, number]) {
    this.pulse(0xffffff, 5, 0.4);
    for (const a of this.team) a.pos.set(x, 0.32, z);
    this.pet?.pos.set(x, 0.32, z);
    this.trail = this.trail.map(() => new THREE.Vector3(x, 0.32, z));
    this.path = []; this.dashT = 0; this.portalCd = 2.5;
    this.wv.focus.set(x, 0.3, z);
    for (const e of this.ents) if ((e.state === 'chase' || e.state === 'alert') && e.group.position.distanceTo(this.leader.pos) > 3) { e.state = 'idle'; e.target.copy(e.home); }
    this.hooks.note?.('🌀 传送！追兵跟丢了');
    this.pulse(0xffffff, 5, 0.5);
  }
  private pulse(color: number, r: number, life: number) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(this.leader.pos.x, 0.5, this.leader.pos.z);
    this.root.add(m); this.pulses.push({ m, t: 0, c: life }); (m.userData as { r: number }).r = r;
  }
  private tickSkills(dt: number) {
    for (const k of Object.keys(this.cd) as ExploreSkill[]) this.cd[k] = Math.max(0, this.cd[k] - dt);
    // 场景机关：风口顺风推一把 / 滑地松手还滑一段 / 潮汐滩变慢（见 spd）
    { const L0 = this.leader, prev = this.zoneNow; this.zoneNow = this.zoneAt(L0.pos.x, L0.pos.z);
      if (this.zoneNow && this.zoneNow !== prev) this.hooks.note?.(this.zoneNow.kind === 'wind' ? '🌬️ 风口：顺风加速' : this.zoneNow.kind === 'tide' ? '🌊 潮汐滩：走得慢，追兵也一样' : this.zoneNow.kind === 'sand' ? '🏜️ 流沙：走得慢，追兵也一样' : '✨ 琉璃滑地：松手还会滑一段');
      const mv = (ax: number, az: number) => { const t = new THREE.Vector3(L0.pos.x + ax, 0.32, L0.pos.z + az); const [cx, cz] = this.cell(t); if (!this.grid[cz * this.N + cx]) { L0.pos.copy(t); L0.moving = 1; return true; } return false; };
      if (this.zoneNow?.kind === 'wind' && !this.busy) mv(this.zoneNow.dx * 4.5 * dt, this.zoneNow.dz * 4.5 * dt);
      if (this.zoneNow?.kind === 'slide' && !this.pushed && this.vel.lengthSq() > 0.6 && !this.busy) { if (!mv(this.vel.x * dt, this.vel.z * dt)) this.vel.set(0, 0, 0); this.vel.multiplyScalar(Math.pow(0.05, dt)); }
      else if (!this.zoneNow || this.pushed) { if (!this.pushed) this.vel.multiplyScalar(0.5); }
      this.pushed = false;
      for (const m of this.zoneMeshes) { const z = m.userData.zone as Zone; for (const k of m.userData.marks as THREE.Object3D[]) { const i = k.userData.i as number;
        if (z.kind === 'wind') { const ph = ((this.t * 0.9 + i / 3) % 1); k.position.set(z.dx * (ph - 0.5) * z.r * 1.3, 0.1, z.dz * (ph - 0.5) * z.r * 1.3); ((k as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = Math.sin(ph * Math.PI) * 0.85; }
        else if (z.kind === 'tide' || z.kind === 'sand') { const ph = ((this.t * 0.6 + i * 0.5) % 1); k.scale.setScalar(0.4 + ph * z.r * 0.9); ((k as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - ph); }
        else { (k as THREE.Sprite).material.opacity = 0.5 + Math.sin(this.t * 3 + i * 1.7) * 0.4; } } } }
    this.grace = Math.max(0, this.grace - dt);
    // 传送门：走进一个，出现在另一个；追你的敌人跟丢
    this.portalCd = Math.max(0, this.portalCd - dt);
    for (const m of this.portalMeshes) { const [r1, r2, bm] = m.userData.spin as THREE.Mesh[]; r1.rotation.z += dt * 0.8; r2.rotation.z -= dt * 1.6; bm.rotation.y += dt * 0.6; }
    if (this.portals.length === 2 && this.portalCd <= 0 && !this.busy) {
      const lp = this.leader.pos;
      const i = this.portals.findIndex(([x, z]) => Math.hypot(x - lp.x, z - lp.z) < PORTAL_R - 0.3);
      if (i >= 0) this.teleport(this.portals[1 - i]);
    }
    { const lp = this.leader.pos; const now = this.covers.some(([x, z]) => Math.hypot(x - lp.x, z - lp.z) < COVER_R); if (now && !this.inCover) this.hooks.note?.('🫣 躲进掩体：敌人很难发现你，贴近可偷袭'); this.inCover = now; }
    this.sneakT = Math.max(0, this.sneakT - dt); this.revealT = Math.max(0, this.revealT - dt);
    // 冲撞：沿朝向冲 7 个单位，撞到的敌人晕 4 秒（我方可以偷袭）
    if (this.dashT > 0) {
      const L = this.leader, step = 27 * dt; this.dashT -= dt;
      const nx = L.pos.x + this.dashDir.x * step, nz = L.pos.z + this.dashDir.z * step;
      const [cx, cz] = this.cell(new THREE.Vector3(nx, 0, nz));
      if (!this.grid[cz * this.N + cx]) { L.pos.x = nx; L.pos.z = nz; L.moving = 1; if (L.pos.distanceTo(this.trail[0]) > 0.35) { this.trail.unshift(L.pos.clone()); if (this.trail.length > 80) this.trail.pop(); } } else this.dashT = 0;
      for (const e of this.ents) if (e.alive && (e.spawn.kind === 'enemy' || e.spawn.kind === 'boss') && e.stun <= 0 && e.group.position.distanceTo(L.pos) < 2.8) {
        e.stun = e.spawn.kind === 'boss' ? 2.5 : 4; e.state = 'stun'; this.hooks.note?.('💫 撞晕了！趁现在偷袭');
        for (const a of e.cats) a.pos.y = 0.32;
      }
    }
    for (const p of this.pulses) { p.t += dt; const k = p.t / p.c, r = (p.m.userData as { r: number }).r; p.m.scale.setScalar(1 + k * r); (p.m.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k); p.m.position.set(this.leader.pos.x, 0.5, this.leader.pos.z); }
    this.pulses = this.pulses.filter((p) => { if (p.t >= p.c) { this.root.remove(p.m); p.m.geometry.dispose(); return false; } return true; });
  }

  // ---------- 宠物（跟在队尾，比猫小一圈，走路时一蹦一蹦） ----------
  private pet: Actor | null = null;
  /** 宠物的鼻子：隐藏宝箱的发现距离（没带宠物 4 米；普通 / 稀有 / 传说宠物 8 / 10 / 13 米） */
  private sniffR = 4;
  setPet(id: string | null | undefined) {
    this.sniffR = !id ? 4 : ({ R: 8, SR: 10, SSR: 13 } as Record<string, number>)[PET_BY_ID[id]?.rarity ?? 'R'] ?? 8;
    if (this.pet) { this.root.remove(this.pet.cat.root); this.root.remove(this.pet.shadow); this.pet = null; }
    if (!id) return;
    this.pet = this.mkActor(id, 0.62);
    const sp = this.street.spawn;
    this.pet.pos.set(sp.x, sp.y, sp.z + this.team.length * 1.5 + 1);
  }

  // ---------- 队伍 ----------
  setTeam(ids: string[]) {
    for (const a of this.team) { this.root.remove(a.cat.root); this.root.remove(a.shadow); }
    this.teamIds = ids.slice(); this.grace = 4;
    this.team = ids.map((id) => this.mkActor(id, 1.0, true));
    const sp = this.street.spawn;
    this.team.forEach((a, i) => a.pos.set(sp.x + (i % 2 ? 1 : -1) * 0.5, sp.y, sp.z + i * 1.5));
    this.trail = [];
    for (let i = 0; i < 60; i++) this.trail.push(new THREE.Vector3(sp.x, sp.y, sp.z + i * 0.35));
    this.path = [];
    this.wv.focus.copy(this.leader.pos);
  }
  /** 小地图用：队长位置 + 所有活着的实体 */
  snapshot() { return { leader: { x: this.leader.pos.x, z: this.leader.pos.z, yaw: this.leader.yaw }, ents: this.ents.filter((e) => e.alive).map((e) => ({ kind: e.spawn.kind, x: e.group.position.x, z: e.group.position.z })) }; }
  get leader(): Actor { return this.team[0]; }
  /** 没在走路也没在战斗：自动探索用它判断什么时候该找下一个目标 */
  get idle(): boolean { return !this.paused && !this.busy && this.path.length === 0; }
  get moving(): boolean { return this.leader.moving > 0.5; }
  private updateKeyLight() {
    const lp = this.leaderPos, cam = this.wv.camera.position;
    const d = new THREE.Vector3(cam.x - lp.x, 0, cam.z - lp.z);
    if (d.lengthSq() > 1e-4) d.normalize();
    this.keyLight.position.set(lp.x + d.x * 3.2, lp.y + 4.2, lp.z + d.z * 3.2);
  }
  get leaderPos(): THREE.Vector3 { return this.team[0].pos; }

  private mkActor(id: string, scale: number, castShadow = false): Actor {
    const prev = detail.k;
    detail.k = WORLD_CAT_DETAIL; // 世界里的猫只有一百来像素高，降低细分
    let cat: Cat3D;
    try { cat = buildCat3D(lookOf(id), id); } finally { detail.k = prev; }
    cat.root.scale.setScalar(scale);
    if (castShadow) cat.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; } });
    const sh = new THREE.Mesh(new THREE.CircleGeometry(1.2 * scale, 20), new THREE.MeshBasicMaterial({ map: glowTex(), color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.36;
    this.root.add(cat.root, sh);
    // 烘焙后的猫默认不做视锥裁剪；世界里开启（包围球放大一圈，动作幅度大也不会被误裁），描边外壳单独收集，远处可关
    const outlines: THREE.Object3D[] = [];
    cat.root.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (!m.isSkinnedMesh) return;
      // three 的视锥裁剪读的是 SkinnedMesh 自己的 boundingSphere（不是 geometry 的），所以要放大这一个
      m.computeBoundingSphere();
      if (m.boundingSphere) m.boundingSphere.radius *= 1.6;
      m.frustumCulled = true;
      if ((m.material as THREE.ShaderMaterial).isShaderMaterial) outlines.push(m);
    });
    return { cat, pos: new THREE.Vector3(), yaw: 0, moving: 0, shadow: sh, outlines };
  }

  // ---------- 实体 ----------
  addSpawn(s: Spawn) {
    const group = new THREE.Group();
    const cats: Actor[] = [];
    const ids = s.units ?? [];
    if (s.kind === 'chest') {
      const b = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 1.0), std('#c98a3a', 0.5, 0.4)); b.position.y = 0.5; group.add(b);
      const lid = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.4, 1.06), std('#e8b04a', 0.4, 0.5)); lid.position.y = 1.1; group.add(lid);
      const lock = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.1), glowMat('#fff2a0')); lock.position.set(0, 0.85, 0.52); group.add(lock);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffd24a, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); halo.scale.set(5, 5, 1); halo.position.y = 1; group.add(halo);
    } else if (s.kind === 'poi') {
      // 钓鱼点：木桩 + 一圈发光的橙色标记 + 立着的小鱼旗
      const ramen = s.data === 'ramen', boxcat = s.data === 'boxcat', mush = s.data === 'mushroom', chime = s.data === 'windchime', lant = s.data === 'lanterns', kart = s.data === 'kart', claw = s.data === 'claw', whack = s.data === 'whack', ringT = s.data === 'ring', arrowsT = s.data === 'arrows', ffT = s.data === 'firefly', kiteT = s.data === 'kite', kitchenT = s.data === 'kitchen', sledT = s.data === 'sled', snowcatT = s.data === 'snowcat', surfT = s.data === 'surf', clamsT = s.data === 'clams', skipT = s.data === 'skip', sushiT = s.data === 'sushi';
      const col = POI_COL[String(s.data ?? '')] ?? '#ffb04a';
      const wood = std('#6a4a2a', 0.8, 0.1);
      for (const dx of [-0.7, 0.7]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.3, 6), wood); post.position.set(dx, 0.65, 0); group.add(post); }
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.7, 28), glowMat(col)); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; group.add(ring);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.7), new THREE.MeshStandardMaterial({ color: ramen ? '#d9483b' : '#ff7a3a', roughness: 0.8, side: THREE.DoubleSide })); flag.position.set(0, 1.55, 0); group.add(flag);
      if (lant) { // 宫灯：三盏红灯笼挂在一根金杆上
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.2, 8), std('#c9a040', 0.5, 0.6)); pole.position.y = 1.1; group.add(pole);
        [[-0.5, 1.7], [0.5, 1.7], [0, 1.2]].forEach(([dx, y]) => {
          const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), glowMat('#ff5a3a')); lamp.scale.y = 1.15; lamp.position.set(dx, y, 0); group.add(lamp);
          const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.08, 8), std('#e8c15a', 0.5, 0.5)); cap.position.set(dx, y + 0.42, 0); group.add(cap);
        });
        flag.visible = false;
      }
      if (chime) { // 风铃架：一根横杆下挂着四串发光的小铃
        const bar = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.08), std('#8a7a6a', 0.7)); bar.position.y = 1.7; group.add(bar);
        [-0.6, -0.2, 0.2, 0.6].forEach((dx, i) => {
          const str = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.4 + (i % 2) * 0.2, 4), std('#ccc', 0.6)); str.position.set(dx, 1.5 - (i % 2) * 0.1, 0); group.add(str);
          const bell = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.22, 10, 1, true), glowMat(['#9ab8ff', '#ffb0e0', '#a0ffd8', '#ffe27a'][i])); bell.position.set(dx, 1.2 - (i % 2) * 0.2, 0); bell.rotation.x = Math.PI; group.add(bell);
        });
        flag.visible = false;
      }
      if (mush) { // 三朵大蘑菇
        for (const [dx, dz, sc, c] of [[-0.55, 0, 1, '#d9483b'], [0.5, 0.2, 0.8, '#ffd24a'], [0, -0.5, 0.9, '#b06aff']] as [number, number, number, string][]) {
          const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * sc, 0.16 * sc, 0.7 * sc, 8), std('#f0e6d0', 0.8)); stem.position.set(dx, 0.35 * sc, dz); group.add(stem);
          const cap = new THREE.Mesh(new THREE.SphereGeometry(0.42 * sc, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), std(c, 0.7)); cap.position.set(dx, 0.7 * sc, dz); group.add(cap);
        }
        flag.position.set(0, 2.1, 0);
      }
      if (boxcat) { // 一只纸箱，里面探出两只猫耳朵
        const carton = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.9, 1.1), std('#b8793e', 0.85)); carton.position.y = 0.65; group.add(carton);
        const tape = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 1.12), std('#e8d8a8', 0.8)); tape.position.y = 1.11; group.add(tape);
        for (const dx of [-0.28, 0.28]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.4, 4), std('#ff9a4a', 0.8)); ear.position.set(dx, 1.3, 0); ear.rotation.z = -dx * 0.5; group.add(ear); }
        flag.position.set(0, 2.1, 0);
      }
      if (ramen) { // 一碗面：白碗 + 面 + 一块叉烧
        const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.32, 0.4, 14), std('#f4efe6', 0.6)); bowl.position.y = 1.25; group.add(bowl);
        const noodles = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.06, 14), std('#ffd9a0', 0.8)); noodles.position.y = 1.47; group.add(noodles);
        const chashu = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 10), std('#b0603a', 0.8)); chashu.position.set(0.15, 1.52, 0.05); group.add(chashu);
        flag.position.set(0, 2.1, 0);
      }
      if (kart) { // 一辆红色小卡丁车：车身 + 四个轮子 + 方向盘 + 小旗
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.35, 0.95), std('#e8402a', 0.5, 0.3)); body.position.y = 0.55; group.add(body);
        const nose = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.25, 0.7), std('#f4f0e8', 0.5, 0.3)); nose.position.set(0.85, 0.5, 0); group.add(nose);
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.6), std('#2a2a34', 0.7)); seat.position.set(-0.3, 0.95, 0); group.add(seat);
        for (const [dx, dz] of [[0.55, 0.55], [0.55, -0.55], [-0.55, 0.55], [-0.55, -0.55]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.22, 12), std('#1a1a20', 0.8)); w.rotation.x = Math.PI / 2; w.position.set(dx, 0.3, dz * 0.95); group.add(w); }
        const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 6, 12), std('#d0d0d8', 0.4, 0.5)); wheel.rotation.x = 1.0; wheel.position.set(0.25, 1.05, 0); group.add(wheel);
        flag.position.set(0, 2.1, 0);
      }
      if (claw) { // 夹娃娃机：粉色机身 + 玻璃罩 + 里面一堆毛球玩偶 + 一只爪子
        const bodyM = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, 1.3), std('#ff6ac0', 0.55, 0.2)); bodyM.position.y = 0.45; group.add(bodyM);
        const glass = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.5, 1.2), new THREE.MeshStandardMaterial({ color: '#bfeaff', transparent: true, opacity: 0.32, roughness: 0.1 })); glass.position.y = 1.65; group.add(glass);
        const top = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.25, 1.4), std('#ff6ac0', 0.55, 0.2)); top.position.y = 2.5; group.add(top);
        [['#ffd24a', -0.4, 0.2], ['#7ff0ff', 0.3, -0.2], ['#ffffff', 0.45, 0.3], ['#b06aff', -0.1, -0.35], ['#ff9a4a', -0.45, -0.1]].forEach(([c, dx, dz], i) => { const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), std(c as string, 0.9)); b.position.set(dx as number, 1.05 + (i % 2) * 0.12, dz as number); group.add(b); });
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 4), std('#ccc', 0.5, 0.6)); rod.position.set(0.1, 2.05, 0); group.add(rod);
        const clawM = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.3, 4), std('#d0d0d8', 0.4, 0.6)); clawM.rotation.x = Math.PI; clawM.position.set(0.1, 1.55, 0); group.add(clawM);
        flag.visible = false;
      }
      if (whack) { // 街机：紫色机身 + 发光屏幕 + 三个洞
        const cab = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.1, 1.0), std('#4a3a8a', 0.55, 0.3)); cab.position.y = 1.05; group.add(cab);
        const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.7), glowMat('#9affc8')); scr.position.set(0, 1.55, 0.51); group.add(scr);
        for (const dx of [-0.35, 0, 0.35]) { const hole = new THREE.Mesh(new THREE.CircleGeometry(0.13, 10), new THREE.MeshBasicMaterial({ color: '#10101a' })); hole.position.set(dx, 0.95, 0.51); group.add(hole); }
        const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 6), std('#ff4a6a', 0.5)); stick.position.set(-0.35, 0.65, 0.58); group.add(stick);
        flag.visible = false;
      }
      if (ringT) { // 套圈摊：一块木台 + 三排小木桩，桩上摆着奖品，台前斜放着几个粉色圈
        const deck = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.2, 1.6), std('#a0703a', 0.8)); deck.position.y = 0.1; group.add(deck);
        const pegM = std('#e8c890', 0.8);
        [-0.55, 0, 0.55].forEach((dz, r) => [-0.75, -0.25, 0.25, 0.75].forEach((dx, i) => {
          const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.35, 5), pegM); peg.position.set(dx + (r % 2) * 0.12, 0.37, dz); group.add(peg);
          const prize = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), std(['#ff7ab8', '#ffd24a', '#e8a04a', '#fff4e0'][(i + r) % 4], 0.7)); prize.position.set(dx + (r % 2) * 0.12, 0.6, dz); group.add(prize);
        }));
        for (let i = 0; i < 3; i++) { const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 6, 16), glowMat('#ff5aa0')); hoop.position.set(-0.5 + i * 0.5, 0.35, 1.0); hoop.rotation.x = 1.2; group.add(hoop); }
        flag.position.set(0, 2.1, 0);
      }
      if (arrowsT) { // 草船：小木船上立着三个稻草人，身上插着几支箭
        const hull = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.4, 1.0), std('#6a4a2a', 0.8)); hull.position.y = 0.3; group.add(hull);
        for (const dx of [-1.25, 1.25]) { const tip = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.6, 4), std('#6a4a2a', 0.8)); tip.rotation.z = dx > 0 ? -Math.PI / 2 : Math.PI / 2; tip.position.set(dx, 0.3, 0); group.add(tip); }
        const straw = std('#d8b860', 0.95);
        [-0.7, 0, 0.7].forEach((dx, i) => {
          const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.9, 7), straw); body.position.set(dx, 0.95, 0); group.add(body);
          for (const s2 of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 4), straw); ear.position.set(dx + s2 * 0.12, 1.5, 0); group.add(ear); }
          for (let k = 0; k < 2; k++) { const arrow = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.6, 4), std('#3a2a1a', 0.7)); arrow.position.set(dx + (k - 0.5) * 0.15, 1.0 + k * 0.15, 0.3); arrow.rotation.x = 1.1 + i * 0.1; group.add(arrow); }
        });
        flag.position.set(0, 2.2, 0);
      }
      if (ffT) { // 萤火虫：一块长满青苔的矮石台，周围六只会发光的萤火虫绕一圈
        const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.5, 8), std('#6a7a68', 0.95)); stone.position.y = 0.25; group.add(stone);
        const moss = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.92, 0.08, 8), std('#3a8a4a', 0.95)); moss.position.y = 0.52; group.add(moss);
        ['#ffe27a', '#9af07a', '#7ae0ff', '#ff9ad0', '#ffb04a', '#c8a0ff'].forEach((c2, i) => {
          const a = (i / 6) * Math.PI * 2, fly = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), glowMat(c2)); fly.position.set(Math.cos(a) * 1.5, 0.9 + (i % 2) * 0.35, Math.sin(a) * 1.5); group.add(fly);
          const g2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(c2), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); g2.scale.set(0.8, 0.8, 1); g2.position.copy(fly.position); group.add(g2);
        });
        flag.position.set(0, 2.0, 0);
      }
      if (kiteT) { // 纸鸢：木桩上系着线，一只菱形猫脸纸鸢斜飘在半空，尾巴一串彩球
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.0, 6), std('#8a6a3a', 0.8)); post.position.y = 0.5; group.add(post);
        const reel = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 6, 12), std('#d9483b', 0.6)); reel.position.y = 0.85; group.add(reel);
        const kite = new THREE.Group(); kite.position.set(1.2, 2.6, 0); kite.rotation.z = -0.35; group.add(kite);
        const face = new THREE.Mesh(new THREE.CircleGeometry(0.55, 4), new THREE.MeshStandardMaterial({ color: '#fff4e0', roughness: 0.8, side: THREE.DoubleSide })); kite.add(face);
        for (const s2 of [-1, 1]) { const ear = new THREE.Mesh(new THREE.CircleGeometry(0.16, 3), new THREE.MeshStandardMaterial({ color: '#fff4e0', roughness: 0.8, side: THREE.DoubleSide })); ear.position.set(s2 * 0.2, 0.5, 0); ear.rotation.z = Math.PI / 2; kite.add(ear); }
        for (const s2 of [-1, 1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), std('#3a2a1a', 0.5)); eye.position.set(s2 * 0.16, 0.05, 0.03); kite.add(eye); }
        for (let i = 1; i <= 4; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), glowMat(i % 2 ? '#ffd24a' : '#ff9ad0')); b.position.set(-0.1 * i, -0.55 - i * 0.2, 0); kite.add(b); }
        const pts = [new THREE.Vector3(0, 0.85, 0), new THREE.Vector3(0.7, 1.9, 0), new THREE.Vector3(1.2, 2.6, 0)];
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(new THREE.CatmullRomCurve3(pts).getPoints(12)), new THREE.LineBasicMaterial({ color: '#ffffff' })));
        flag.position.set(0, 3.4, 0);
      }
      if (kitchenT) { // 御膳房灶台：砖砌灶 + 一口铁锅 + 一摞蒸笼，锅上冒热气，旁边一张摆着菜的小案
        const stove = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 1.0), std('#a04030', 0.9)); stove.position.y = 0.4; group.add(stove);
        const top = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 1.1), std('#d8c8a8', 0.8)); top.position.y = 0.84; group.add(top);
        const fire = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.05), glowMat('#ff8a2a')); fire.position.set(-0.35, 0.35, 0.51); group.add(fire);
        const wok = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#3a3a40', roughness: 0.5, metalness: 0.6, side: THREE.DoubleSide })); wok.position.set(-0.35, 1.1, 0); group.add(wok);
        for (let i = 0; i < 3; i++) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.18, 12), std(i === 2 ? '#c8a060' : '#d8b878', 0.9)); st.position.set(0.4, 0.97 + i * 0.19, 0); group.add(st); }
        for (let i = 0; i < 3; i++) { const steam = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffffff, transparent: true, opacity: 0.45 - i * 0.1, depthWrite: false, toneMapped: false })); steam.scale.set(0.6 + i * 0.25, 0.6 + i * 0.25, 1); steam.position.set(-0.35 + i * 0.05, 1.4 + i * 0.35, 0); group.add(steam); }
        const table = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.6), std('#8a4a2a', 0.8)); table.position.set(1.4, 0.6, 0.3); group.add(table);
        ['#ff9a5a', '#ffffff', '#7ad86a'].forEach((c2, i) => { const dish = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), std(c2, 0.7)); dish.position.set(1.15 + i * 0.25, 0.7, 0.3); group.add(dish); });
        flag.position.set(0, 2.4, 0);
      }
      if (sledT) { // 雪橇：两条弯起来的木滑板 + 红坐垫，旁边插两面小旗
        const wood = std('#8a5a3a', 0.85);
        for (const s2 of [-1, 1]) { const run = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 2.2), wood); run.position.set(s2 * 0.5, 0.1, 0); group.add(run); const tip = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.05, 6, 10, Math.PI), wood); tip.rotation.y = Math.PI / 2; tip.position.set(s2 * 0.5, 0.35, -1.1); group.add(tip); }
        const seat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.14, 1.7), std('#d83a30', 0.7)); seat.position.y = 0.38; group.add(seat);
        for (const s2 of [-1, 1]) { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 5), std('#e8e0d0', 0.6)); pole.position.set(s2 * 1.6, 0.8, -0.6); group.add(pole); const fl = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 3), glowMat(s2 < 0 ? '#ff5a4a' : '#4ac8ff')); fl.rotation.z = -Math.PI / 2; fl.position.set(s2 * 1.6 + 0.25, 1.4, -0.6); group.add(fl); }
        flag.position.set(0, 2.0, 0);
      }
      if (snowcatT) { // 叠雪猫：三个越来越小的雪球叠起来，顶上一颗带耳朵的猫头
        const snowM = std('#ffffff', 0.8);
        let y = 0; [0.6, 0.48, 0.38, 0.32].forEach((r, i) => { y += i ? r * 1.6 : r; const b = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 9), snowM); b.position.set(i % 2 ? 0.05 : -0.03, y, 0); group.add(b); });
        for (const s2 of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 4), snowM); ear.position.set(s2 * 0.17, y + 0.33, 0); group.add(ear); }
        for (const s2 of [-1, 1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 4), std('#2a2a2a', 0.5)); eye.position.set(s2 * 0.11, y + 0.05, 0.29); group.add(eye); }
        const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.07, 6, 14), std('#d83a30', 0.8)); scarf.rotation.x = Math.PI / 2; scarf.position.y = 1.15; group.add(scarf);
        flag.position.set(0, y + 1.0, 0);
      }
      if (surfT) { // 冲浪：两块插在沙里的冲浪板 + 一面小旗
        ['#ff6a5a', '#4ac8ff'].forEach((c2, i) => { const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 2.0, 4, 10), std(c2, 0.5)); b.scale.z = 0.2; b.position.set(-0.45 + i * 0.9, 1.25, 0); b.rotation.z = (i ? -1 : 1) * 0.12; group.add(b); const st = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.8, 0.02), std('#ffffff', 0.5)); st.position.set(-0.45 + i * 0.9, 1.25, 0.08); st.rotation.z = b.rotation.z; group.add(st); });
        flag.position.set(0, 2.9, 0);
      }
      if (clamsT) { // 赶海：一只小水桶 + 一把小铲子 + 几只贝壳
        const pail = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.32, 0.6, 12, 1, true), new THREE.MeshStandardMaterial({ color: '#4ac8ff', roughness: 0.6, side: THREE.DoubleSide })); pail.position.y = 0.3; group.add(pail);
        const handle = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.025, 4, 16, Math.PI), std('#ffffff', 0.5)); handle.position.y = 0.6; group.add(handle);
        const shovel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 5), std('#ffd24a', 0.5)); shovel.position.set(0.7, 0.45, 0.1); shovel.rotation.z = -0.5; group.add(shovel);
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.04), std('#ff6a5a', 0.5)); blade.position.set(0.92, 0.08, 0.1); blade.rotation.z = -0.5; group.add(blade);
        for (let i = 0; i < 5; i++) { const sh = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), std(['#ffd0e0', '#fff4e0', '#ffb08a'][i % 3], 0.6)); sh.scale.set(1, 0.5, 1.2); sh.position.set(-0.8 + i * 0.35, 0.05, 0.6 + (i % 2) * 0.2); group.add(sh); }
        flag.position.set(0, 1.8, 0);
      }
      if (skipT) { // 打水漂：一摞扁石片 + 一只小木桶
        for (let i = 0; i < 5; i++) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.3 - i * 0.02, 0.34 - i * 0.02, 0.1, 9), std(['#8a8a92', '#a09a90', '#7a7a84'][i % 3], 0.7)); st.position.set(-0.4 + (i % 2) * 0.06, 0.06 + i * 0.1, 0.3); group.add(st); }
        const pail = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.3, 0.5, 10), std('#c89a5a', 0.8)); pail.position.set(0.6, 0.25, 0.2); group.add(pail);
        flag.position.set(0, 1.8, 0);
      }
      if (sushiT) { // 回转寿司：一小段传送带 + 几个寿司盘
        const belt = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.7), std('#9a9aa4', 0.5, 0.3)); belt.position.set(0, 0.6, 0.2); group.add(belt);
        for (let i = 0; i < 3; i++) { const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.06, 12), std(['#ffffff', '#ffd0d8', '#c8e0ff'][i], 0.4)); pl.position.set(-0.7 + i * 0.7, 0.88, 0.2); group.add(pl); const sushi = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.16), std(['#ff8a5a', '#d8304a', '#ffd84a'][i], 0.5)); sushi.position.set(-0.7 + i * 0.7, 0.98, 0.2); group.add(sushi); }
        flag.position.set(0, 2.0, 0);
      }
      const zone = new THREE.Mesh(new THREE.RingGeometry(SAFE_R - 0.12, SAFE_R, 64), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.22, depthWrite: false, toneMapped: false })); zone.rotation.x = -Math.PI / 2; zone.position.y = 0.05; group.add(zone);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(col), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); halo.scale.set(5, 5, 1); halo.position.y = 1; group.add(halo);
    } else if (s.kind === 'herb') {
      const m = std('#3fdc8a', 0.6, 0.1);
      for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2, c = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.1 + (i % 3) * 0.35, 5), m); c.position.set(Math.cos(a) * 0.55, 0.55, Math.sin(a) * 0.55); c.rotation.z = Math.cos(a) * 0.25; c.rotation.x = -Math.sin(a) * 0.25; group.add(c); }
      const core = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.6, 5), glowMat('#b6ffd0')); core.position.y = 0.8; group.add(core);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0x6affb0, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); halo.scale.set(4.2, 4.2, 1); halo.position.y = 0.9; group.add(halo);
    } else {
      ids.slice(0, 3).forEach((id, i) => {
        const a = this.mkActor(id, s.kind === 'boss' ? 1.35 : 1.0);
        a.pos.set((i - (ids.length - 1) / 2) * 1.9, 0.32, i % 2 ? 0.7 : 0);
        cats.push(a);
      });
    }
    const tag = labelSprite(s.label, s.kind === 'boss' ? '#ff9ad0' : s.kind === 'npc' ? '#9ae8ff' : s.kind === 'chest' ? '#ffe27a' : s.kind === 'herb' ? '#9affc8' : s.kind === 'poi' ? (POI_TAG[String(s.data ?? '')] ?? '#ffcf8a') : '#ffffff');
    tag.position.y = s.kind === 'chest' || s.kind === 'herb' || s.kind === 'poi' ? 3.0 : s.kind === 'boss' ? 6.0 : 4.8;
    group.add(tag);
    const mark = s.kind === 'boss' ? markSprite('!', '#ff4a6a') : s.kind === 'npc' ? markSprite('…', '#7ff0ff') : s.kind === 'enemy' ? markSprite('!', '#ff3a4a') : undefined;
    if (mark && s.kind === 'enemy') mark.visible = false;
    if (mark) { mark.position.y = s.kind === 'boss' ? 7.6 : 6.3; group.add(mark); }
    group.position.set(s.x, 0.32, s.z);
    this.root.add(group);
    const ent: Ent = { spawn: s, group, cats, home: new THREE.Vector3(s.x, 0.32, s.z), target: new THREE.Vector3(s.x, 0.32, s.z), wait: Math.random() * 2, alive: true, cooldown: 0, alert: false, tag, mark, t: Math.random() * 6,
      face: Math.random() * Math.PI * 2, state: 'idle', lost: 0, stun: 0, found: !s.hidden, alertT: 0 };
    if (s.kind === 'enemy' || s.kind === 'boss') {
      // 视野锥：脚下一片扇形，黄 = 没发现你，红 = 追你，灰 = 被撞晕。队伍走进扇形里就会被发现
      const R = SIGHT, seg = 18, pos: number[] = [0, 0, 0];
      for (let i = 0; i <= seg; i++) { const a = -HALF_FOV + (i / seg) * HALF_FOV * 2; pos.push(Math.sin(a) * R, 0, Math.cos(a) * R); }
      const idx: number[] = []; for (let i = 1; i <= seg; i++) idx.push(0, i + 1, i);
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
      const cone = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.2, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
      cone.position.y = 0.1; cone.renderOrder = 3;
      const edge = new THREE.LineLoop(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)), new THREE.LineBasicMaterial({ color: 0xfff0a0, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }));
      cone.add(edge); (cone.userData as { edge: THREE.LineLoop }).edge = edge;
      group.add(cone); ent.cone = cone;
    }
    if (s.hidden) group.visible = false;
    this.ents.push(ent);
    return ent;
  }
  clearSpawns() { for (const e of this.ents) { this.root.remove(e.group); for (const a of e.cats) { this.root.remove(a.shadow); this.root.remove(a.cat.root); } } this.ents = []; }
  /** 安全区：玩法入口周围，野猫进不来；队伍在里面时不会被开战 */
  private inSafe(x: number, z: number): boolean { return inSafeZone(this.street.level, x, z); }
  removeSpawn(id: string) { const e = this.ents.find((x) => x.spawn.id === id); if (e) { e.alive = false; e.group.visible = false; } }

  // ---------- 寻路 ----------
  private buildGrid(cols: AABB[]) { this.grid.set(blockedGrid(cols, this.street.half)); }
  private cell(v: THREE.Vector3): [number, number] { const h = this.street.half; return [Math.min(this.N - 1, Math.max(0, Math.floor((v.x + h) / CELL))), Math.min(this.N - 1, Math.max(0, Math.floor((v.z + h) / CELL)))]; }
  private world(cx: number, cz: number): THREE.Vector3 { const h = this.street.half; return new THREE.Vector3((cx + 0.5) * CELL - h, 0.32, (cz + 0.5) * CELL - h); }
  /** A*（8 邻域）；终点被挡就找最近的可走格 */
  findPath(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] {
    const N = this.N, g = this.grid;
    const [sx, sz] = this.cell(from); let [tx, tz] = this.cell(to);
    if (g[tz * N + tx]) {
      let best = 1e9, bx = tx, bz = tz;
      for (let r = 1; r < 8 && best === 1e9; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) { const x = tx + dx, z = tz + dz; if (x < 0 || z < 0 || x >= N || z >= N || g[z * N + x]) continue; const d = dx * dx + dz * dz; if (d < best) { best = d; bx = x; bz = z; } }
      tx = bx; tz = bz;
    }
    const open: number[] = [sz * N + sx]; const came = new Map<number, number>(); const cost = new Map<number, number>([[sz * N + sx, 0]]);
    const h = (i: number) => Math.hypot((i % N) - tx, Math.floor(i / N) - tz);
    const f = new Map<number, number>([[sz * N + sx, h(sz * N + sx)]]);
    let found = false;
    while (open.length) {
      let bi = 0; for (let i = 1; i < open.length; i++) if ((f.get(open[i]) ?? 1e9) < (f.get(open[bi]) ?? 1e9)) bi = i;
      const cur = open.splice(bi, 1)[0];
      if (cur === tz * N + tx) { found = true; break; }
      const cx = cur % N, cz = Math.floor(cur / N);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const x = cx + dx, z = cz + dz; if (x < 0 || z < 0 || x >= N || z >= N) continue;
        const ni = z * N + x; if (g[ni]) continue;
        if (dx && dz && (g[cz * N + x] || g[z * N + cx])) continue; // 不斜穿墙角
        const nc = (cost.get(cur) ?? 0) + (dx && dz ? 1.414 : 1);
        if (nc < (cost.get(ni) ?? 1e9)) { came.set(ni, cur); cost.set(ni, nc); f.set(ni, nc + h(ni)); if (!open.includes(ni)) open.push(ni); }
      }
    }
    if (!found) return [];
    const out: THREE.Vector3[] = []; let c = tz * N + tx;
    while (c !== sz * N + sx) { out.push(this.world(c % N, Math.floor(c / N))); c = came.get(c)!; }
    out.reverse();
    // 拉直：能直线走到的点就跳过中间点
    const sm: THREE.Vector3[] = []; let last = from.clone();
    for (let i = 0; i < out.length; i++) { if (i === out.length - 1 || !this.clear(last, out[i + 1])) { sm.push(out[i]); last = out[i]; } }
    return sm;
  }
  private clear(a: THREE.Vector3, b: THREE.Vector3): boolean {
    const d = a.distanceTo(b), n = Math.ceil(d / 0.5);
    for (let i = 1; i < n; i++) { const p = a.clone().lerp(b, i / n); const [cx, cz] = this.cell(p); if (this.grid[cz * this.N + cx]) return false; }
    return true;
  }

  // ---------- 操作 ----------
  private tap(p: THREE.Vector3) {
    if (this.paused || this.busy) return;
    // 点到实体附近 → 走过去
    let to = p.clone();
    for (const e of this.ents) if (e.alive && e.group.position.distanceTo(p) < 3.2) { to = e.group.position.clone(); break; }
    this.path = this.findPath(this.leader.pos, to);
    this.marker.position.set(to.x, 0.42, to.z); this.markerT = 1;
  }
  moveTo(x: number, z: number) { this.path = this.findPath(this.leader.pos, new THREE.Vector3(x, 0.32, z)); }
  /** 摇杆 / 键盘：朝某个方向走（世界坐标 xz，已归一化） */
  push(dx: number, dz: number, dt: number) {
    if (this.paused || this.busy) return;
    this.path = [];
    const sp = this.spd, l = this.leader, sx = dx * sp * dt, sz = dz * sp * dt;
    this.pushed = true; this.vel.set(dx * sp, 0, dz * sp);
    // 先试斜走，被挡就沿墙滑（只走 x 或只走 z）
    for (const [ax, az] of [[sx, sz], [sx, 0], [0, sz]]) {
      if (!ax && !az) continue;
      const t = new THREE.Vector3(l.pos.x + ax, 0.32, l.pos.z + az);
      const [cx, cz] = this.cell(t);
      if (!this.grid[cz * this.N + cx]) { l.yaw = Math.atan2(dx, dz); l.pos.copy(t); l.moving = 1; break; }
    }
  }

  // ---------- 每帧 ----------
  update(dt: number) {
    this.t += dt;
    if (this.paused) { this.updateKeyLight(); this.syncAll(dt, true); return; }
    const L = this.leader;
    this.tickSkills(dt);
    let moving = false;
    if (this.path.length) {
      const tgt = this.path[0];
      const d = new THREE.Vector3().subVectors(tgt, L.pos); d.y = 0;
      const dist = d.length();
      const step = this.spd * dt;
      if (dist <= step) { L.pos.copy(tgt); this.path.shift(); } else { d.multiplyScalar(1 / dist); L.pos.addScaledVector(d, step); L.yaw = Math.atan2(d.x, d.z); }
      moving = true;
    }
    if (moving || L.moving) {
      // 轨迹采样：每走 0.35 个单位记一个点
      const last = this.trail[0];
      if (last.distanceTo(L.pos) > 0.35) { this.trail.unshift(L.pos.clone()); if (this.trail.length > 80) this.trail.pop(); }
    }
    L.moving = moving ? 1 : Math.max(0, L.moving - dt * 6);
    // 跟随者：沿轨迹排队
    for (let i = 1; i < this.team.length; i++) {
      const a = this.team[i];
      const want = this.trail[Math.min(this.trail.length - 1, i * 5)];
      const d = new THREE.Vector3().subVectors(want, a.pos); d.y = 0;
      const dist = d.length();
      if (dist > 0.12) { a.pos.addScaledVector(d, Math.min(1, dt * 9)); a.yaw = Math.atan2(d.x, d.z); a.moving = Math.min(1, dist * 2.5); } else a.moving = Math.max(0, a.moving - dt * 6);
    }
    if (this.pet) {
      const a = this.pet;
      const want = this.trail[Math.min(this.trail.length - 1, this.team.length * 5 + 2)];
      const d = new THREE.Vector3().subVectors(want, a.pos); d.y = 0;
      const dist = d.length();
      if (dist > 0.1) { a.pos.addScaledVector(d, Math.min(1, dt * 7)); a.yaw = Math.atan2(d.x, d.z); a.moving = Math.min(1, dist * 2.5); } else a.moving = Math.max(0, a.moving - dt * 6);
    }
    // 敌人 / 实体
    this.frameNear = null; this.frameNearD = 1e9;
    for (const e of this.ents) { if (e.alive) this.updateEnt(e, dt); }
    const fn = this.frameNear as Ent | null;
    if (fn !== this.nearEnt) { this.nearEnt = fn; this.hooks.near?.(fn ? fn.spawn : null); if (fn) this.hooks.alert?.(fn.spawn); }
    // 相机跟随
    this.wv.focus.lerp(L.pos, Math.min(1, dt * 5));
    this.occlude(dt);
    // 目标圈淡出
    this.markerT = Math.max(0, this.markerT - dt * 1.6);
    (this.marker.material as THREE.MeshBasicMaterial).opacity = this.markerT;
    this.marker.scale.setScalar(1 + (1 - this.markerT) * 0.8);
    this.updateKeyLight();
    this.syncAll(dt, false);
  }

  /** 挡住队伍的楼：高层折叠（压扁到楼板高度），不挡了再弹起来 */
  private occlude(dt: number) {
    const C = this.wv.camera.position, P = new THREE.Vector3(this.leader.pos.x, 1.5, this.leader.pos.z);
    const d = new THREE.Vector3().subVectors(C, P);
    for (const b of this.street.buildings) {
      const y0 = 0.32 + 7.2, pad = 1.2;
      // 线段 P→C 与盒子 [x0..x1]×[y0..top]×[z0..z1] 的 slab 相交
      let t0 = 0, t1 = 1, hit = true;
      const ax: [number, number, number, number][] = [[P.x, d.x, b.x0 - pad, b.x1 + pad], [P.y, d.y, y0, b.top], [P.z, d.z, b.z0 - pad, b.z1 + pad]];
      for (const [p, dd, lo, hi] of ax) {
        if (Math.abs(dd) < 1e-6) { if (p < lo || p > hi) { hit = false; break; } continue; }
        let a = (lo - p) / dd, c = (hi - p) / dd; if (a > c) [a, c] = [c, a];
        t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) { hit = false; break; }
      }
      const goal = hit ? 0 : 1;
      b.t += (goal - b.t) * Math.min(1, dt * 9);
      if (Math.abs(goal - b.t) < 0.004) b.t = goal;
      b.high.visible = b.t > 0.02;
      b.high.scale.y = Math.max(0.001, b.t);
      if (b.mirrorHigh) { b.mirrorHigh.visible = b.high.visible; b.mirrorHigh.scale.y = b.high.scale.y; }
    }
  }

  private updateEnt(e: Ent, dt: number) {
    const s = e.spawn; e.t += dt; e.cooldown = Math.max(0, e.cooldown - dt);
    const lp = this.leaderPos;
    const gp = e.group.position;
    // 远处的实体不画（镜头看不到它们；每只 3D 猫约 3 万三角面，省下来的主要是这个）
    const dLeader = gp.distanceTo(lp);
    const far = dLeader > CULL_DIST;
    if (e.alive && e.group.visible === far) e.group.visible = !far;
    if (!far) { const lod = dLeader > OUTLINE_DIST; for (const a of e.cats) for (const o of a.outlines) if (o.visible === lod) o.visible = !lod; }
    if (s.kind === 'poi') {
      e.tag.position.y = 3.2 + Math.sin(e.t * 3) * 0.12;
      if (gp.distanceTo(lp) < 2.6 && e.cooldown <= 0 && !this.busy && this.hooks.poi) void this.startPoi(e);
      return;
    }
    if (s.kind === 'chest' || s.kind === 'herb') {
      e.tag.position.y = 3.0 + Math.sin(e.t * 3) * 0.12;
      if (s.hidden && !e.found) {
        // 隐藏宝箱：走到 4 米内，或者「灵视」生效时在 26 米内，就显形（之后一直在）
        if (dLeader < this.sniffR || (this.revealT > 0 && dLeader < 26)) { const byPet = this.pet && dLeader >= 4 && !(this.revealT > 0); e.found = true; e.group.visible = true; this.hooks.note?.(byPet ? '🐾 宠物嗅到了宝箱的味道！' : '✨ 发现了隐藏宝箱！'); if (byPet) this.pulse(0xffe27a, 3, 0.6); }
        else { e.group.visible = false; return; }
      }
      if (gp.distanceTo(lp) < 2.4 && e.cooldown <= 0) { e.alive = false; e.group.visible = false; this.hooks.chest(s); }
      return;
    }
    if (s.kind === 'npc') {
      if (e.mark) e.mark.position.y = 6.3 + Math.sin(e.t * 3) * 0.2;
      // 面向队长
      for (const a of e.cats) a.yaw = Math.atan2(lp.x - gp.x, lp.z - gp.z);
      if (gp.distanceTo(lp) < 3.2 && e.cooldown <= 0) { e.cooldown = 6; this.hooks.talk(s); }
      return;
    }
    // ---- 敌人：有视野。没发现你时原地巡逻、左右张望；你走进视野锥（黄色扇形）就会被发现并追你；
    //      绕到背后 / 潜行 / 先用「冲撞」撞晕它，再开战就是我方偷袭；被追上则是敌方先手。
    const dist = dLeader;
    const near = dist < (s.kind === 'boss' ? ENGAGE_BOSS : ENGAGE_R) && e.cooldown <= 0 && !this.busy;
    if (near && dist < this.frameNearD) { this.frameNear = e; this.frameNearD = dist; }
    e.alert = near;
    const toL = Math.atan2(lp.x - gp.x, lp.z - gp.z);
    const angTo = Math.abs(Math.atan2(Math.sin(toL - e.face), Math.cos(toL - e.face)));
    if (e.stun > 0) { e.stun -= dt; if (e.stun <= 0) { e.state = 'idle'; e.lost = 0; } }
    const sneaking = this.hiding;
    if (e.state === 'idle' && !this.busy && e.cooldown <= 0 && this.grace <= 0) {
      const range = sneaking ? SIGHT_SNEAK : SIGHT;
      const seen = dist < range && angTo < HALF_FOV && this.clear(gp, lp);
      const bumped = dist < 2.0 && !sneaking; // 贴脸也会发现
      if (seen || bumped) {
        // 先「发现」0.7 秒（头顶 ❗、原地盯着你），再开始追：给玩家反应时间，来得及跑 / 绕 / 冲撞
        e.state = s.kind === 'boss' ? 'chase' : 'alert'; e.lost = 0; e.alertT = 0.7;
        this.hooks.alert?.(s);
        if (s.kind !== 'boss') this.hooks.note?.('❗ 被发现了！跑开，或者正面开战');
      }
    }
    let moved = false;
    if (e.state === 'stun' || e.stun > 0) {
      // 晕乎乎：原地转圈
      e.face += dt * 4; for (const a of e.cats) { a.yaw = e.face; a.moving = 0; }
    } else if (e.state === 'alert') {
      e.face = Math.atan2(lp.x - gp.x, lp.z - gp.z); for (const a of e.cats) { a.yaw = e.face; a.moving = 0; }
      if ((e.alertT -= dt) <= 0) { e.state = 'chase'; e.lost = 0; }
    } else if (e.state === 'chase' && s.kind !== 'boss') {
      // 追击：直线逼近队伍，不进安全区；离太远 / 看不见 4 秒就放弃回家
      const d = new THREE.Vector3().subVectors(lp, gp); d.y = 0; const dd = d.length();
      if (dd > 17 || this.inSafe(gp.x, gp.z)) e.state = 'idle';
      else if (this.clear(gp, lp)) e.lost = 0; else if ((e.lost += dt) > 4) { e.state = 'idle'; e.target.copy(e.home); }
      if (e.state === 'chase' && dd > CATCH_R) {
        d.multiplyScalar(1 / dd);
        const cs = CHASE_SPEED * (['tide', 'sand'].includes(this.zoneAt(gp.x, gp.z)?.kind ?? '') ? 0.55 : 1);
        const nx = gp.x + d.x * cs * dt, nz = gp.z + d.z * cs * dt;
        const [cx, cz] = this.cell(new THREE.Vector3(nx, 0, nz));
        if (!this.grid[cz * this.N + cx] && !this.inSafe(nx, nz)) { gp.x = nx; gp.z = nz; moved = true; e.face = Math.atan2(d.x, d.z); }
      }
      if (e.state === 'chase' && dd <= CATCH_R && !this.busy && !this.inSafe(lp.x, lp.z)) { e.state = 'idle'; void this.startEncounter(e, 'enemy'); return; }
      if (e.state === 'chase') e.face = Math.atan2(lp.x - gp.x, lp.z - gp.z);
      for (const a of e.cats) { a.yaw = e.face; a.moving = moved ? 1 : 0; }
    } else {
      // 巡逻 + 张望
      if ((e.wait -= dt) <= 0 && (s.patrol ?? 0) > 0 && !near) { const r = s.patrol!; e.target.set(e.home.x + (Math.random() - 0.5) * 2 * r, 0.32, e.home.z + (Math.random() - 0.5) * 2 * r); e.wait = 2 + Math.random() * 3; }
      const d = new THREE.Vector3().subVectors(e.target, gp); d.y = 0;
      const dd = d.length();
      if (dd > 0.4 && (s.patrol ?? 0) > 0) {
        d.multiplyScalar(1 / dd);
        const nx = gp.x + d.x * 1.6 * dt, nz = gp.z + d.z * 1.6 * dt;
        const [cx, cz] = this.cell(new THREE.Vector3(nx, 0, nz));
        if (!this.grid[cz * this.N + cx] && !this.inSafe(nx, nz)) { gp.x = nx; gp.z = nz; moved = true; e.face = Math.atan2(d.x, d.z); }
        else e.target.copy(gp);
      } else e.face += Math.sin(e.t * 0.9) * dt * 0.9; // 站着时左右张望
      for (const a of e.cats) { a.yaw = e.face; a.moving = moved ? 1 : 0; }
    }
    if (e.cone) {
      const c = e.cone, m = c.material as THREE.MeshBasicMaterial;
      c.visible = dLeader < 30 && e.stun <= 0;
      c.rotation.y = e.face;
      c.scale.setScalar((e.state === 'chase' || e.state === 'alert' ? 1.1 : sneaking ? SIGHT_SNEAK / SIGHT : 1));
      m.color.setHex(e.state === 'chase' || e.state === 'alert' ? 0xff3a4a : 0xffd24a);
      m.opacity = (e.state === 'chase' ? 0.34 : 0.24) + Math.sin(e.t * 5) * 0.04;
      ((c.userData as { edge: THREE.LineLoop }).edge.material as THREE.LineBasicMaterial).color.setHex(e.state === 'chase' ? 0xff8a8a : 0xfff0a0);
    }
    if (e.mark) {
      const up = e.stun > 0 || e.state === 'chase' || e.state === 'alert';
      if (s.kind === 'enemy') e.mark.visible = e.state === 'alert' || e.state === 'chase';
      e.mark.position.y = (s.kind === 'boss' ? 7.6 : 6.3) + Math.sin(e.t * (up ? 8 : 4)) * (up ? 0.4 : 0.25);
    }
  }

  /** 玩家主动开战：对身边最近的野怪 / 首领。返回是否开打。没被发现（背后 / 潜行）或被撞晕 = 我方偷袭 */
  engage(): boolean {
    const e = this.nearEnt;
    if (!e || !e.alive || this.busy) return false;
    const lp = this.leaderPos, gp = e.group.position;
    const toL = Math.atan2(lp.x - gp.x, lp.z - gp.z);
    const behind = Math.abs(Math.atan2(Math.sin(toL - e.face), Math.cos(toL - e.face))) > 1.35;
    const unaware = e.state === 'idle' && (behind || this.hiding);
    void this.startEncounter(e, e.stun > 0 || unaware ? 'player' : 'none');
    return true;
  }
  /** 最近一只能偷袭的敌人（界面据此把「战斗」按钮换成「偷袭」） */
  get ambushReady(): boolean {
    const e = this.nearEnt;
    if (!e || !e.alive) return false;
    const lp = this.leaderPos, gp = e.group.position;
    const toL = Math.atan2(lp.x - gp.x, lp.z - gp.z);
    const behind = Math.abs(Math.atan2(Math.sin(toL - e.face), Math.cos(toL - e.face))) > 1.35;
    return e.stun > 0 || (e.state === 'idle' && (behind || this.hiding));
  }

  /** 走进玩法入口：世界暂停，等小游戏结束；之后冷却一会儿，免得一出来又被触发 */
  private async startPoi(e: Ent) {
    this.busy = true; this.paused = true; this.path = [];
    try { await this.hooks.poi!(e.spawn); } finally { this.busy = false; this.paused = false; e.cooldown = 5; }
  }

  private async startEncounter(e: Ent, mode: Ambush) {
    this.busy = true; this.paused = true; this.path = [];
    if (this.nearEnt) { this.nearEnt = null; this.hooks.near?.(null); }
    this.sneakT = 0;
    const win = await this.hooks.encounter(e.spawn, mode);
    this.busy = false; this.paused = false;
    if (win) { e.alive = false; e.group.visible = false; }
    else {
      // 输了：敌人原地冷却，我方被击退回出生点附近
      e.cooldown = 8; e.alert = false; e.state = 'idle'; this.grace = 4;
      const sp = this.street.spawn;
      for (const a of this.team) a.pos.set(sp.x, sp.y, sp.z);
      this.pet?.pos.set(sp.x, sp.y, sp.z);
      this.trail = this.trail.map(() => new THREE.Vector3(sp.x, sp.y, sp.z));
      this.wv.focus.set(sp.x, 0, sp.z);
    }
  }

  private syncAll(dt: number, still: boolean) {
    const sync = (a: Actor, parent?: THREE.Object3D) => {
      a.cat.root.position.copy(a.pos);
      if (parent) a.cat.root.position.add(parent.position);
      // 平滑转向
      const cur = a.cat.root.rotation.y; let diff = a.yaw - cur; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      a.cat.root.rotation.y = cur + diff * Math.min(1, dt * 10);
      applyPose(a.cat, {}, { alive: true, moving: !still && a.moving > 0.2, t: this.t });
      a.shadow.position.set(a.cat.root.position.x, 0.36, a.cat.root.position.z);
    };
    for (const a of this.team) sync(a);
    if (this.pet) { sync(this.pet); if (this.pet.moving > 0.2) this.pet.cat.root.position.y += Math.abs(Math.sin(this.t * 11)) * 0.22; }
    for (const e of this.ents) if (e.alive) for (const a of e.cats) {
      // 敌人的猫放在世界坐标：组位置 + 偏移（猫本身加到 root，不是 group 的子节点）
      a.cat.root.position.set(e.group.position.x + a.pos.x, 0.32, e.group.position.z + a.pos.z);
      const cur = a.cat.root.rotation.y; let diff = a.yaw - cur; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      a.cat.root.rotation.y = cur + diff * Math.min(1, dt * 10);
      applyPose(a.cat, {}, { alive: true, moving: !still && a.moving > 0.2, t: this.t + a.pos.x });
      a.shadow.position.set(a.cat.root.position.x, 0.36, a.cat.root.position.z);
    }
    // 敌人隐藏时，猫也要隐藏
    // 敌人隐藏 / 离得太远时，猫也隐藏（省绘制）
    const fp = this.wv.focus;
    for (const e of this.ents) { const near = e.alive && Math.hypot(e.group.position.x - fp.x, e.group.position.z - fp.z) < 46; for (const a of e.cats) { a.cat.root.visible = near; a.shadow.visible = near; } }
    // 队长脚下的光圈
    const L = this.leader;
    this.ring.position.set(L.pos.x, 0.42, L.pos.z);
    this.ring.scale.setScalar((1 + Math.sin(this.t * 4) * 0.06) * (this.sneakT > 0 ? 0.65 : 1));
    (this.ring.material as THREE.MeshBasicMaterial).opacity = this.sneakT > 0 ? 0.35 : 0.9;
  }

  dispose() { this.wv.onTap = () => undefined; this.root.removeFromParent(); }
}
