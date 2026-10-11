// 探索控制器：操控一队猫猫在 3D 街区里走动，遇到敌人 / 宝箱 / NPC 触发事件。
// 玩法层（遭遇战、奖励、剧情）通过 hooks 注入，这里只管世界里的事：移动、寻路、跟随、巡逻、触碰。
import * as THREE from 'three';
import { buildCat3D } from '../art3d/cat3d';
import type { Cat3D } from '../art3d/cat3d';
import { applyPose } from '../art3d/pose';
import { lookOf } from '../data/units';
import type { WorldView } from './engine';
import type { AABB, Street } from './street';
import { glowTex } from './tex';
import { glowMat, std } from './kit';

export interface Spawn {
  id: string;
  kind: 'enemy' | 'boss' | 'chest' | 'npc';
  x: number; z: number;
  /** enemy / boss：这一队长什么样（单位 id，最多 3 个） */
  units?: string[];
  label: string;
  /** 巡逻半径 */
  patrol?: number;
  data?: unknown;
}
export interface ExploreHooks {
  /** 触碰敌人：玩法层打一场战斗，返回是否获胜 */
  encounter(s: Spawn): Promise<boolean>;
  chest(s: Spawn): void;
  talk(s: Spawn): void;
}

interface Actor { cat: Cat3D; pos: THREE.Vector3; yaw: number; moving: number; shadow: THREE.Mesh }
interface Ent { spawn: Spawn; group: THREE.Group; cats: Actor[]; home: THREE.Vector3; target: THREE.Vector3; wait: number; alive: boolean; cooldown: number; alert: boolean; tag: THREE.Sprite; mark?: THREE.Sprite; t: number }

const CELL = 1;
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
  t = 0;
  /** 点击地面时，若点到了某个实体附近，就走过去 */
  constructor(private wv: WorldView, private street: Street, teamIds: string[], private hooks: ExploreHooks) {
    this.N = street.half * 2 / CELL;
    this.grid = new Uint8Array(this.N * this.N);
    this.buildGrid(street.colliders);
    wv.scene.add(this.root);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.5, 32), new THREE.MeshBasicMaterial({ color: 0x7ff0ff, transparent: true, opacity: 0.9, toneMapped: false, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = 0.4; this.root.add(this.ring);
    this.marker = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.7, 24), new THREE.MeshBasicMaterial({ color: 0xff7ad9, transparent: true, opacity: 0, toneMapped: false, depthWrite: false }));
    this.marker.rotation.x = -Math.PI / 2; this.marker.position.y = 0.42; this.root.add(this.marker);
    this.setTeam(teamIds);
    wv.onTap = (p) => this.tap(p);
  }

  // ---------- 队伍 ----------
  setTeam(ids: string[]) {
    for (const a of this.team) { this.root.remove(a.cat.root); this.root.remove(a.shadow); }
    this.team = ids.map((id) => this.mkActor(id, 1.0));
    const sp = this.street.spawn;
    this.team.forEach((a, i) => a.pos.set(sp.x + (i % 2 ? 1 : -1) * 0.5, sp.y, sp.z + i * 1.5));
    this.trail = [];
    for (let i = 0; i < 60; i++) this.trail.push(new THREE.Vector3(sp.x, sp.y, sp.z + i * 0.35));
    this.path = [];
    this.wv.focus.copy(this.leader.pos);
  }
  get leader(): Actor { return this.team[0]; }
  get leaderPos(): THREE.Vector3 { return this.team[0].pos; }

  private mkActor(id: string, scale: number): Actor {
    const cat = buildCat3D(lookOf(id), id);
    cat.root.scale.setScalar(scale);
    cat.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; } });
    const sh = new THREE.Mesh(new THREE.CircleGeometry(1.2 * scale, 20), new THREE.MeshBasicMaterial({ map: glowTex(), color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.36;
    this.root.add(cat.root, sh);
    return { cat, pos: new THREE.Vector3(), yaw: 0, moving: 0, shadow: sh };
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
    } else {
      ids.slice(0, 3).forEach((id, i) => {
        const a = this.mkActor(id, s.kind === 'boss' ? 1.35 : 1.0);
        a.pos.set((i - (ids.length - 1) / 2) * 1.9, 0.32, i % 2 ? 0.7 : 0);
        cats.push(a);
      });
    }
    const tag = labelSprite(s.label, s.kind === 'boss' ? '#ff9ad0' : s.kind === 'npc' ? '#9ae8ff' : s.kind === 'chest' ? '#ffe27a' : '#ffffff');
    tag.position.y = s.kind === 'chest' ? 3.0 : s.kind === 'boss' ? 6.0 : 4.8;
    group.add(tag);
    const mark = s.kind === 'boss' ? markSprite('!', '#ff4a6a') : s.kind === 'npc' ? markSprite('…', '#7ff0ff') : undefined;
    if (mark) { mark.position.y = s.kind === 'boss' ? 7.6 : 6.3; group.add(mark); }
    group.position.set(s.x, 0.32, s.z);
    this.root.add(group);
    const ent: Ent = { spawn: s, group, cats, home: new THREE.Vector3(s.x, 0.32, s.z), target: new THREE.Vector3(s.x, 0.32, s.z), wait: Math.random() * 2, alive: true, cooldown: 0, alert: false, tag, mark, t: Math.random() * 6 };
    this.ents.push(ent);
    return ent;
  }
  clearSpawns() { for (const e of this.ents) { this.root.remove(e.group); for (const a of e.cats) { this.root.remove(a.shadow); } } this.ents = []; }
  removeSpawn(id: string) { const e = this.ents.find((x) => x.spawn.id === id); if (e) { e.alive = false; e.group.visible = false; } }

  // ---------- 寻路 ----------
  private buildGrid(cols: AABB[]) {
    const N = this.N, h = this.street.half;
    this.grid.fill(0);
    const pad = 0.9;
    for (const c of cols) {
      const x0 = Math.max(0, Math.floor((c.x0 - pad + h) / CELL)), x1 = Math.min(N - 1, Math.floor((c.x1 + pad + h) / CELL));
      const z0 = Math.max(0, Math.floor((c.z0 - pad + h) / CELL)), z1 = Math.min(N - 1, Math.floor((c.z1 + pad + h) / CELL));
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) this.grid[z * N + x] = 1;
    }
    for (let i = 0; i < N; i++) for (const k of [0, 1, N - 2, N - 1]) { this.grid[i * N + k] = 1; this.grid[k * N + i] = 1; }
  }
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
    const l = this.leader, nx = l.pos.x + dx * SPEED * dt, nz = l.pos.z + dz * SPEED * dt;
    const try1 = new THREE.Vector3(nx, 0.32, nz);
    const [cx, cz] = this.cell(try1);
    if (!this.grid[cz * this.N + cx]) { l.yaw = Math.atan2(dx, dz); l.pos.copy(try1); l.moving = 1; }
  }

  // ---------- 每帧 ----------
  update(dt: number) {
    this.t += dt;
    if (this.paused) { this.syncAll(dt, true); return; }
    const L = this.leader;
    let moving = false;
    if (this.path.length) {
      const tgt = this.path[0];
      const d = new THREE.Vector3().subVectors(tgt, L.pos); d.y = 0;
      const dist = d.length();
      const step = SPEED * dt;
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
    // 敌人 / 实体
    for (const e of this.ents) { if (e.alive) this.updateEnt(e, dt); }
    // 相机跟随
    this.wv.focus.lerp(L.pos, Math.min(1, dt * 5));
    this.occlude(dt);
    // 目标圈淡出
    this.markerT = Math.max(0, this.markerT - dt * 1.6);
    (this.marker.material as THREE.MeshBasicMaterial).opacity = this.markerT;
    this.marker.scale.setScalar(1 + (1 - this.markerT) * 0.8);
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
    if (s.kind === 'chest') {
      e.tag.position.y = 3.0 + Math.sin(e.t * 3) * 0.12;
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
    // 敌人：巡逻 / 追击
    const dist = gp.distanceTo(lp);
    const sight = s.kind === 'boss' ? 0 : 9;
    e.alert = sight > 0 && dist < sight && e.cooldown <= 0;
    let speed = 0;
    if (e.alert) { e.target.copy(lp); speed = 4.4; }
    else if ((e.wait -= dt) <= 0 && (s.patrol ?? 0) > 0) { const r = s.patrol!; e.target.set(e.home.x + (Math.random() - 0.5) * 2 * r, 0.32, e.home.z + (Math.random() - 0.5) * 2 * r); e.wait = 2 + Math.random() * 3; }
    const d = new THREE.Vector3().subVectors(e.target, gp); d.y = 0;
    const dd = d.length();
    let moved = false;
    if (dd > 0.4 && (e.alert || (s.patrol ?? 0) > 0)) {
      d.multiplyScalar(1 / dd);
      const sp = e.alert ? speed : 1.6;
      const nx = gp.x + d.x * sp * dt, nz = gp.z + d.z * sp * dt;
      const [cx, cz] = this.cell(new THREE.Vector3(nx, 0, nz));
      if (!this.grid[cz * this.N + cx]) { gp.x = nx; gp.z = nz; moved = true; for (const a of e.cats) a.yaw = Math.atan2(d.x, d.z); }
      else e.target.copy(gp);
    }
    for (const a of e.cats) a.moving = moved ? 1 : 0;
    if (!e.alert && !moved && s.kind === 'enemy') for (const a of e.cats) a.yaw = Math.atan2(lp.x - gp.x, lp.z - gp.z) * 0.0 + a.yaw;
    if (e.mark) e.mark.position.y = (s.kind === 'boss' ? 7.6 : 6.3) + Math.sin(e.t * 4) * 0.25;
    // 触碰 → 战斗
    if (dist < (s.kind === 'boss' ? 4.2 : 2.9) && e.cooldown <= 0 && !this.busy) void this.startEncounter(e);
  }

  private async startEncounter(e: Ent) {
    this.busy = true; this.paused = true; this.path = [];
    const win = await this.hooks.encounter(e.spawn);
    this.busy = false; this.paused = false;
    if (win) { e.alive = false; e.group.visible = false; }
    else {
      // 输了：敌人原地冷却，我方被击退回出生点附近
      e.cooldown = 8; e.alert = false;
      const sp = this.street.spawn;
      for (const a of this.team) a.pos.set(sp.x, sp.y, sp.z);
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
    for (const e of this.ents) if (e.alive) for (const a of e.cats) {
      // 敌人的猫放在世界坐标：组位置 + 偏移（猫本身加到 root，不是 group 的子节点）
      a.cat.root.position.set(e.group.position.x + a.pos.x, 0.32, e.group.position.z + a.pos.z);
      const cur = a.cat.root.rotation.y; let diff = a.yaw - cur; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      a.cat.root.rotation.y = cur + diff * Math.min(1, dt * 10);
      applyPose(a.cat, {}, { alive: true, moving: !still && a.moving > 0.2, t: this.t + a.pos.x });
      a.shadow.position.set(a.cat.root.position.x, 0.36, a.cat.root.position.z);
    }
    // 敌人隐藏时，猫也要隐藏
    for (const e of this.ents) for (const a of e.cats) { a.cat.root.visible = e.alive; a.shadow.visible = e.alive; }
    // 队长脚下的光圈
    const L = this.leader;
    this.ring.position.set(L.pos.x, 0.42, L.pos.z);
    this.ring.scale.setScalar(1 + Math.sin(this.t * 4) * 0.06);
  }

  dispose() { this.wv.onTap = () => undefined; this.root.removeFromParent(); }
}
