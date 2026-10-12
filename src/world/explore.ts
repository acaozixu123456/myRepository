// 探索控制器：操控一队猫猫在 3D 街区里走动，遇到敌人 / 宝箱 / NPC 触发事件。
// 玩法层（遭遇战、奖励、剧情）通过 hooks 注入，这里只管世界里的事：移动、寻路、跟随、巡逻、触碰。
import * as THREE from 'three';
import { buildCat3D } from '../art3d/cat3d';
import { detail } from '../art3d/toon';
import type { Cat3D } from '../art3d/cat3d';
import { applyPose } from '../art3d/pose';
import { lookOf, unitInfo } from '../data/units';
import type { WorldView } from './engine';
import type { AABB, Street } from './street';
import { CELL, COVER_R, SAFE_R, blockedGrid, coverSpotsOf, inSafeZone } from './levels';
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
    this.covers = coverSpotsOf(street.level);
    for (const [x, z] of this.covers) { const m = coverMesh(street.level.theme); m.position.set(x, 0.32, z); m.rotation.y = (x * 7 + z * 3) % 6.28; this.root.add(m); }
    this.setTeam(teamIds);
    wv.onTap = (p) => this.tap(p);
  }

  // ---------- 探路技：冲撞 / 潜行 / 灵视（谁能放由队伍里的职业决定） ----------
  private covers: [number, number][] = [];
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
  private pulse(color: number, r: number, life: number) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(this.leader.pos.x, 0.5, this.leader.pos.z);
    this.root.add(m); this.pulses.push({ m, t: 0, c: life }); (m.userData as { r: number }).r = r;
  }
  private tickSkills(dt: number) {
    for (const k of Object.keys(this.cd) as ExploreSkill[]) this.cd[k] = Math.max(0, this.cd[k] - dt);
    this.grace = Math.max(0, this.grace - dt);
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
  setPet(id: string | null | undefined) {
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
      const ramen = s.data === 'ramen', boxcat = s.data === 'boxcat', mush = s.data === 'mushroom', chime = s.data === 'windchime', lant = s.data === 'lanterns';
      const col = ramen ? '#ff5a4a' : boxcat ? '#ffcf5a' : mush ? '#b06aff' : chime ? '#9ab8ff' : lant ? '#ffd24a' : '#ffb04a';
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
      const zone = new THREE.Mesh(new THREE.RingGeometry(SAFE_R - 0.12, SAFE_R, 64), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.22, depthWrite: false, toneMapped: false })); zone.rotation.x = -Math.PI / 2; zone.position.y = 0.05; group.add(zone);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: ramen ? 0xff5a4a : boxcat ? 0xffcf5a : mush ? 0xb06aff : chime ? 0x9ab8ff : lant ? 0xffd24a : 0xffb04a, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); halo.scale.set(5, 5, 1); halo.position.y = 1; group.add(halo);
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
    const tag = labelSprite(s.label, s.kind === 'boss' ? '#ff9ad0' : s.kind === 'npc' ? '#9ae8ff' : s.kind === 'chest' ? '#ffe27a' : s.kind === 'herb' ? '#9affc8' : s.kind === 'poi' ? (s.data === 'ramen' ? '#ff9a8a' : s.data === 'boxcat' ? '#ffe08a' : s.data === 'mushroom' ? '#d8b0ff' : s.data === 'windchime' ? '#c0d4ff' : s.data === 'lanterns' ? '#ffe9a0' : '#ffcf8a') : '#ffffff');
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
    const sp = SPEED * (this.sneakT > 0 ? 0.62 : 1), l = this.leader, sx = dx * sp * dt, sz = dz * sp * dt;
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
      const step = SPEED * (this.sneakT > 0 ? 0.62 : 1) * dt;
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
        if (dLeader < 4 || (this.revealT > 0 && dLeader < 26)) { e.found = true; e.group.visible = true; this.hooks.note?.('✨ 发现了隐藏宝箱！'); }
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
        const nx = gp.x + d.x * CHASE_SPEED * dt, nz = gp.z + d.z * CHASE_SPEED * dt;
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
