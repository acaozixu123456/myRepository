// 战场上的一只猫：骨骼位图 + 关节姿势 + 血条 / 状态 / 特效锚点。
import { PART_ORDER } from '../art/cat';
import type { PartId } from '../art/cat';
import { FACTIONS } from '../data/factions';
import type { FactionId } from '../data/factions';
import { STATUSES } from '../data/statuses';
import type { Rig } from './rig';
import type { Scene } from './scene';
import { clamp, hexA, rad } from './util';
import type { Ease } from './util';

export type Xf = [number, number, number, number, number]; // rot(°), tx, ty, sx, sy
export type PoseDelta = Partial<Record<PartId | 'root', Partial<Xf> | number[]>>;

const ZERO: Xf = [0, 0, 0, 1, 1];
const ROOT_KEYS = ['rot', 'ox', 'oy', 'sx', 'sy'] as const;

/** 动作姿势：相对站姿的偏移。角色面向右；R 臂 = 持武器手（负角度：向前上方挥起）。 */
export const POSES: Record<string, PoseDelta> = {
  idle: {},
  ready: { armR: [-18], armL: [10], torso: [-2, 0, 0], head: [-2], legL: [-6], legR: [8] },
  windup: { armR: [-175, -6, 0], armL: [-20], torso: [8, -6, 0], head: [6], legL: [10], legR: [-14], root: [-4] },
  windupLow: { armR: [30, -8, 4], armL: [20], torso: [10, -8, 0], head: [8], root: [-3] },
  strike: { armR: [-62, 10, 0], armL: [-40], torso: [-10, 12, 0], head: [-4, 6, 0], legL: [-18], legR: [18], root: [4] },
  thrust: { armR: [-82, 14, 0], armL: [-60], torso: [-12, 14, 0], head: [-6, 8, 0], legL: [-22], legR: [20], root: [5] },
  cast: { armR: [-120], armL: [-120], torso: [-3, 0, -4], head: [-8] },
  castUp: { armR: [-170], armL: [-170], torso: [-6, 0, -8], head: [-14, 0, -2], legL: [-4], legR: [4] },
  castFwd: { armR: [-95], armL: [-95], torso: [-6, 4, 0], head: [-4], root: [2] },
  guard: { armR: [-100], armL: [-110], torso: [6, -4, 2], head: [6], root: [-2] },
  hurt: { torso: [-14, -10, 2], head: [-16, -6, 0], armR: [28], armL: [-22], root: [-8], legL: [8], legR: [-8] },
  dash: { armR: [-40], armL: [30], torso: [-10, 6, 0], head: [-6], root: [6] },
  victory: { armR: [-160], armL: [20], torso: [-2, 0, -6], head: [-6, 0, -2] },
  slump: { torso: [10, 0, 4], head: [14, 0, 4], armR: [20], armL: [-10] },
};

const STATUS_BADGE: Record<string, { ch: string; color: string }> = {
  fluff: { ch: '炸', color: '#f08a2b' }, curl: { ch: '团', color: '#6b9bd8' }, purr: { ch: '噜', color: '#e86a8a' }, coat: { ch: '盾', color: '#9fb4c8' },
  step: { ch: '步', color: '#4fb88a' }, nine: { ch: '命', color: '#e8c15a' }, illusion: { ch: '幻', color: '#9a7ae0' }, taunt: { ch: '挑', color: '#d9483b' },
  scratch: { ch: '痕', color: '#c0392b' }, burn: { ch: '灼', color: '#e8542b' }, wet: { ch: '湿', color: '#3a9ad9' }, dizzy: { ch: '晕', color: '#c9a23a' },
  yarn: { ch: '缠', color: '#d96aa0' }, fright: { ch: '惊', color: '#7a6ab0' }, nip: { ch: '醉', color: '#5aa850' }, charm: { ch: '符', color: '#d9a62b' }, mark: { ch: '标', color: '#c06a2a' },
};
export const statusKind = (id: string) => STATUSES.find((s) => s.id === id)?.kind ?? 'debuff';

export interface ActorSnap { p: Record<string, number>; rot: number; sx: number; sy: number; x: number; y: number; t: number }
export interface ActorInfo { uid: number; side: 'A' | 'B'; name: string; faction: FactionId; heroId: string; maxHp: number; hp: number }

export class Actor {
  uid: number;
  side: 'A' | 'B';
  name: string;
  faction: FactionId;
  heroId: string;
  rig: Rig;
  scene: Scene;
  /** 站位基准 */
  bx = 0;
  by = 0;
  facing = 1;
  baseScale = 0.34;
  // 实时状态
  p: Record<string, number> = {};
  root = { rot: 0, ox: 0, oy: 0, sx: 1, sy: 1, air: 0 };
  hp: number;
  hpShown: number;
  maxHp: number;
  shield = 0;
  energy = 0;
  statuses = new Map<string, number>();
  alive = true;
  flash = 0;
  alpha = 1;
  glow = 0;
  glowColor = '#fff';
  moving = false;
  hudAlpha = 1;
  private phase = Math.random() * 6.28;
  private t = 0;

  constructor(scene: Scene, rig: Rig, info: ActorInfo, bx: number, by: number, scale: number) {
    this.scene = scene;
    this.rig = rig;
    this.uid = info.uid;
    this.side = info.side;
    this.name = info.name;
    this.faction = info.faction;
    this.heroId = info.heroId;
    this.maxHp = info.maxHp;
    this.hp = info.hp;
    this.hpShown = info.hp;
    this.bx = bx;
    this.by = by;
    this.baseScale = scale;
    this.facing = info.side === 'A' ? 1 : -1;
    this.setPoseNow(POSES.idle);
  }

  get x() { return this.bx + this.root.ox * this.facing; }
  get y() { return this.by + this.root.oy - this.root.air; }
  get scale() { return this.baseScale; }
  /** 世界坐标锚点：part 'head' / 'torso' / 'hand' / 'foot' */
  anchor(kind: 'head' | 'chest' | 'foot' | 'hand' | 'top'): [number, number] {
    const s = this.scale * this.facing;
    const f = this.rig.foot;
    const pt = (rx: number, ry: number): [number, number] => [this.x + (rx - f[0]) * s, this.y + (ry - f[1]) * this.scale];
    switch (kind) {
      case 'head': return pt(200, 235);
      case 'top': return pt(200, 70);
      case 'chest': return pt(200, 395);
      case 'hand': return pt(310, 440);
      default: return pt(200, 604);
    }
  }

  private key(part: string, i: number) { return `${part}.${i}`; }
  private flatten(delta: PoseDelta): Record<string, number> {
    const out: Record<string, number> = {};
    for (const id of PART_ORDER) {
      const st = this.rig.stance[id] ?? [0, 0, 0];
      const d = (delta[id] ?? []) as number[];
      for (let i = 0; i < 5; i++) {
        const base = i < 3 ? (st[i] ?? 0) : 1;
        out[this.key(id, i)] = d[i] !== undefined ? (i < 3 ? base + d[i] : d[i]) : base;
      }
    }
    const r = (delta.root ?? []) as number[];
    out['root.0'] = r[0] ?? 0;
    out['root.1'] = r[1] ?? 0;
    out['root.2'] = r[2] ?? 0;
    return out;
  }
  setPoseNow(delta: PoseDelta) {
    Object.assign(this.p, this.flatten(delta));
    this.root.rot = this.p['root.0'];
  }
  poseTo(delta: PoseDelta, dur: number, e: Ease | string = 'out') {
    return this.scene.tween(this.p, this.flatten(delta), dur, e);
  }
  moveTo(ox: number, oy: number, dur: number, e: Ease | string = 'inOut') {
    return this.scene.tween(this.root, { ox, oy }, dur, e);
  }

  update(dt: number, _time: number) {
    this.t += dt;
    this.root.rot = this.p['root.0'] ?? 0;
    // 血条缓动
    const diff = this.hp - this.hpShown;
    this.hpShown += diff * Math.min(1, dt * 7);
    if (Math.abs(diff) < 0.5) this.hpShown = this.hp;
    this.flash = Math.max(0, this.flash - dt * 5);
    if (this.glow > 0 && !this.glowFixed) this.glow = Math.max(0, this.glow - dt * 1.4);
  }
  glowFixed = false;

  private idleXf(id: PartId): number[] {
    const t = this.t * 2 + this.phase;
    const mv = this.moving;
    const b = Math.sin(t);
    switch (id) {
      case 'torso': return [0, 0, 0, 1, 1 + 0.012 * b];
      case 'head': return [b * 0.8, 0, b * 1.2, 1, 1];
      case 'armL': return [Math.sin(t + 0.6) * 1.6, 0, 0, 1, 1];
      case 'armR': return [Math.sin(t + 0.3) * 1.4, 0, 0, 1, 1];
      case 'tail': return [Math.sin(t * 0.8 + 1.2) * 7, 0, 0, 1, 1];
      case 'back': return [Math.sin(t * 0.9 + 2) * 1.8, 0, 0, 1, 1];
      case 'legL': return [mv ? Math.sin(this.t * 16) * 28 : 0, 0, 0, 1, 1];
      case 'legR': return [mv ? -Math.sin(this.t * 16) * 28 : 0, 0, 0, 1, 1];
      default: return ZERO;
    }
  }

  drawShadow(ctx: CanvasRenderingContext2D) {
    if (this.alpha <= 0.02) return;
    const s = this.scale;
    const lift = clamp(this.root.air / 120);
    ctx.save();
    ctx.globalAlpha = (0.28 - lift * 0.15) * this.alpha;
    ctx.fillStyle = '#2b2238';
    ctx.beginPath();
    ctx.ellipse(this.bx + this.root.ox * this.facing, this.by + this.root.oy, 62 * s * 1.5 * (1 - lift * 0.3), 13 * s * 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (this.energy >= 100 && this.alive) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const pulse = 0.5 + 0.5 * Math.sin(this.t * 6);
      ctx.strokeStyle = hexA(FACTIONS[this.faction].color, 0.35 + 0.35 * pulse);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(this.x, this.by + this.root.oy, 70 * s * 1.5 + pulse * 4, 15 * s * 1.5 + pulse, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  snapshot(): ActorSnap {
    return { p: { ...this.p }, rot: this.root.rot, sx: this.root.sx, sy: this.root.sy, x: this.x, y: this.y, t: this.t };
  }

  private drawBody(ctx: CanvasRenderingContext2D, snap?: ActorSnap) {
    const f = this.rig.foot;
    const P = snap ? snap.p : this.p;
    const x = snap ? snap.x : this.x;
    const y = snap ? snap.y : this.y;
    const rot = snap ? snap.rot : this.root.rot;
    const rsx = snap ? snap.sx : this.root.sx;
    const rsy = snap ? snap.sy : this.root.sy;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rad(rot) * this.facing);
    ctx.scale(this.scale * this.facing * rsx, this.scale * rsy);
    ctx.translate(-f[0], -f[1]);
    const sc = this.rig.scale;
    for (const part of this.rig.parts) {
      if (part.w === 0) continue;
      const id = part.id;
      const idle = this.alive && !snap ? this.idleXf(id) : ZERO;
      const r = (P[this.key(id, 0)] ?? 0) + idle[0];
      const tx = (P[this.key(id, 1)] ?? 0) + (idle[1] ?? 0);
      const ty = (P[this.key(id, 2)] ?? 0) + (idle[2] ?? 0);
      const sx = (P[this.key(id, 3)] ?? 1) * (idle[3] ?? 1);
      const sy = (P[this.key(id, 4)] ?? 1) * (idle[4] ?? 1);
      ctx.save();
      ctx.translate(tx + part.pivot[0], ty + part.pivot[1]);
      ctx.rotate(rad(r));
      ctx.scale(sx, sy);
      ctx.translate(-part.pivot[0], -part.pivot[1]);
      ctx.drawImage(part.img, part.x, part.y, part.img.width / sc, part.img.height / sc);
      ctx.restore();
    }
    ctx.restore();
  }

  /** 残影：用快照在当前位置之外画一份半透明、可染色的拷贝 */
  drawGhost(ctx: CanvasRenderingContext2D, snap: ActorSnap, alpha: number, tint?: string) {
    if (!tint) {
      ctx.save();
      ctx.globalAlpha = alpha;
      this.drawBody(ctx, snap);
      ctx.restore();
      return;
    }
    const w = this.scene.w * this.scene.dpr;
    const h = this.scene.h * this.scene.dpr;
    if (!Actor.off2) Actor.off2 = document.createElement('canvas');
    const off = Actor.off2;
    if (off.width !== w) { off.width = w; off.height = h; }
    const oc = off.getContext('2d')!;
    oc.setTransform(1, 0, 0, 1, 0, 0);
    oc.clearRect(0, 0, off.width, off.height);
    oc.setTransform(this.scene.dpr, 0, 0, this.scene.dpr, 0, 0);
    oc.translate(this.scene.w / 2, this.scene.h / 2);
    oc.scale(this.scene.cam.zoom, this.scene.cam.zoom);
    oc.translate(-this.scene.cam.x, -this.scene.cam.y);
    this.drawBody(oc, snap);
    oc.setTransform(1, 0, 0, 1, 0, 0);
    oc.globalCompositeOperation = 'source-atop';
    oc.fillStyle = tint;
    oc.globalAlpha = 0.7;
    oc.fillRect(0, 0, off.width, off.height);
    const tr = ctx.getTransform();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = alpha;
    ctx.drawImage(off, 0, 0);
    ctx.setTransform(tr);
    ctx.restore();
  }
  private static off2: HTMLCanvasElement | null = null;

  private static off: HTMLCanvasElement | null = null;
  draw(ctx: CanvasRenderingContext2D) {
    if (this.alpha <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    if (this.glow > 0.02) {
      ctx.shadowColor = this.glowColor;
      ctx.shadowBlur = 28 * this.glow;
    }
    if (this.flash > 0.02) {
      const w = this.scene.w * this.scene.dpr;
      const h = this.scene.h * this.scene.dpr;
      if (!Actor.off) Actor.off = document.createElement('canvas');
      const off = Actor.off;
      if (off.width !== w) { off.width = w; off.height = h; }
      const oc = off.getContext('2d')!;
      oc.setTransform(1, 0, 0, 1, 0, 0);
      oc.clearRect(0, 0, off.width, off.height);
      oc.setTransform(this.scene.dpr, 0, 0, this.scene.dpr, 0, 0);
      // 与主画布相同的相机变换
      oc.translate(this.scene.w / 2, this.scene.h / 2);
      oc.scale(this.scene.cam.zoom, this.scene.cam.zoom);
      oc.translate(-this.scene.cam.x, -this.scene.cam.y);
      this.drawBody(oc);
      oc.setTransform(1, 0, 0, 1, 0, 0);
      oc.globalCompositeOperation = 'source-atop';
      oc.fillStyle = `rgba(255,255,255,${clamp(this.flash)})`;
      oc.fillRect(0, 0, off.width, off.height);
      oc.globalCompositeOperation = 'source-over';
      const tr = ctx.getTransform();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.shadowBlur = 0;
      ctx.drawImage(off, 0, 0);
      ctx.setTransform(tr);
      // 重新叠一次不闪白的本体（白色覆盖在上，乘透明度）
      ctx.globalAlpha = this.alpha * (1 - clamp(this.flash));
      this.drawBody(ctx);
    } else {
      this.drawBody(ctx);
    }
    ctx.restore();
  }

  drawHud(ctx: CanvasRenderingContext2D) {
    if (!this.alive || this.hudAlpha <= 0.02) return;
    const [x, y] = this.anchor('top');
    const w = 62;
    const h = 7;
    const top = y - 14;
    ctx.save();
    ctx.globalAlpha = this.hudAlpha * this.alpha;
    // 名字
    ctx.font = '700 12px "Noto Sans SC","PingFang SC","Microsoft YaHei","WenQuanYi Zen Hei",sans-serif';
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = 'rgba(30,22,40,.85)';
    ctx.fillStyle = '#fff';
    ctx.strokeText(this.name, x, top - 10);
    ctx.fillText(this.name, x, top - 10);
    // 血条
    ctx.fillStyle = 'rgba(30,22,40,.82)';
    this.rrect(ctx, x - w / 2 - 2, top - 2, w + 4, h + 4, 5);
    ctx.fill();
    const pct = clamp(this.hpShown / this.maxHp);
    const real = clamp(this.hp / this.maxHp);
    ctx.fillStyle = '#fff3';
    this.rrect(ctx, x - w / 2, top, w * pct, h, 3);
    ctx.fill();
    ctx.fillStyle = this.side === 'A' ? '#4fcf8a' : '#ee6a55';
    this.rrect(ctx, x - w / 2, top, Math.max(0, w * real), h, 3);
    ctx.fill();
    if (this.shield > 0) {
      ctx.fillStyle = '#bfe6ff';
      this.rrect(ctx, x - w / 2, top, w * clamp(this.shield / this.maxHp), 3, 2);
      ctx.fill();
    }
    // 元气
    ctx.fillStyle = 'rgba(30,22,40,.7)';
    this.rrect(ctx, x - w / 2, top + h + 3, w, 4, 2);
    ctx.fill();
    ctx.fillStyle = this.energy >= 100 ? '#ffd24a' : '#f0a63a';
    this.rrect(ctx, x - w / 2, top + h + 3, w * clamp(this.energy / 100), 4, 2);
    ctx.fill();
    // 状态徽章
    let i = 0;
    for (const [id, n] of this.statuses) {
      const b = STATUS_BADGE[id];
      if (!b) continue;
      const bx = x - w / 2 + 7 + i * 15;
      const by = top + h + 16;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(bx, by, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = '700 9px "Noto Sans SC","WenQuanYi Zen Hei",sans-serif';
      ctx.fillText(b.ch, bx, by + 3.2);
      if (n > 1) {
        ctx.font = '700 8px sans-serif';
        ctx.fillStyle = '#ffe9a0';
        ctx.fillText(String(n), bx + 5, by + 9);
      }
      i++;
      if (i >= 6) break;
    }
    ctx.restore();
  }

  private rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---------- 常用复合动作 ----------
  async hurtReact(strength = 1) {
    this.flash = 1;
    const dir = -1; // 面朝反方向后仰
    this.root.ox += dir * 6 * strength;
    this.poseTo(POSES.hurt, 0.06, 'out');
    await this.scene.sleep(0.12);
    this.scene.tween(this.root, { ox: this.root.ox - dir * 6 * strength }, 0.2, 'out');
    await this.poseTo(POSES.idle, 0.22, 'out');
  }
  async die() {
    this.alive = false;
    this.poseTo(POSES.slump, 0.2, 'out');
    await this.scene.tween(this.root, { rot: 0 }, 0.01);
    const t = { r: 0 };
    this.scene.tween(this.p, { 'root.0': -78 }, 0.45, 'inCubic');
    this.scene.tween(this.root, { oy: 14 }, 0.45, 'out');
    await this.scene.tween(this, { alpha: 0.55 }, 0.6, 'out');
    void t;
  }
  async revive() {
    this.alive = true;
    this.scene.tween(this.p, { 'root.0': 0 }, 0.3, 'out');
    this.scene.tween(this.root, { oy: 0 }, 0.3, 'out');
    await this.scene.tween(this, { alpha: 1 }, 0.3, 'out');
    await this.poseTo(POSES.idle, 0.2);
  }
}
export { ROOT_KEYS };
