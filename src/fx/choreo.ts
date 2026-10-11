// 招式编排上下文：给每个技能特效函数使用的“工具箱”。
// 写一个新招式 = 写一个 async (c: Choreo) => void，用 c 里的方法拼出动作与特效，并在“命中时刻”调用 c.hit(k)。
import type { BEvent } from '../engine/types';
import type { Actor } from './actor';
import { POSES } from './actor';
import type { Player } from './player';
import type { Scene } from './scene';
import type { VFX } from './vfx';
import { hexA } from './util';

export type ActEvent = Extract<BEvent, { t: 'act' }>;

export class Choreo {
  vfx: VFX;
  scene: Scene;
  applied = new Set<BEvent>();
  constructor(public player: Player, public caster: Actor, public targets: Actor[], public batch: BEvent[], public act: ActEvent) {
    this.scene = player.scene;
    this.vfx = player.scene.vfx;
  }

  get foes(): Actor[] { return this.player.team(this.caster.side === 'A' ? 'B' : 'A'); }
  get allies(): Actor[] { return this.player.team(this.caster.side); }
  get color(): string { return this.player.factionColor(this.caster); }
  get dir(): number { return this.caster.facing; }

  /** 一队的中心点（地面） */
  center(actors: Actor[]): [number, number] {
    if (!actors.length) return [480, 480];
    return [actors.reduce((a, b) => a + b.bx, 0) / actors.length, actors.reduce((a, b) => a + b.by, 0) / actors.length];
  }
  sleep(s: number) { return this.scene.sleep(s); }
  pose(name: keyof typeof POSES | string, dur = 0.15, e: string = 'out') { return this.caster.poseTo(POSES[name], dur, e); }

  // ----- 事件应用 -----
  /** 应用第 k 次命中（伤害事件的 hit 序号）；不传则应用全部伤害事件 */
  hit(k?: number) {
    const list = this.batch.filter((e) => e.t === 'damage' && !this.applied.has(e) && (k === undefined || e.hit === k));
    for (const e of list) this.apply(e);
    return list.length;
  }
  /** 应用满足条件的事件 */
  where(pred: (e: BEvent) => boolean) {
    for (const e of this.batch) if (!this.applied.has(e) && pred(e)) this.apply(e);
  }
  /** 应用剩余全部事件（治疗 / 护盾 / 状态 / 元气 …），按发生顺序 */
  rest() {
    for (const e of this.batch) if (!this.applied.has(e)) this.apply(e);
  }
  apply(e: BEvent) {
    if (this.applied.has(e)) return;
    this.applied.add(e);
    this.player.applyEvent(e);
  }
  hits(): number {
    const d = this.batch.filter((e) => e.t === 'damage') as Extract<BEvent, { t: 'damage' }>[];
    return d.length ? Math.max(...d.map((e) => e.hit)) + 1 : 0;
  }
  /** 本次行动中某一次命中的目标 */
  hitTargets(k: number): Actor[] {
    const ids = new Set(this.batch.filter((e): e is Extract<BEvent, { t: 'damage' }> => e.t === 'damage' && e.hit === k).map((e) => e.dst));
    return [...ids].map((id) => this.player.actor(id)).filter(Boolean) as Actor[];
  }

  // ----- 位移 -----
  /** 冲到目标面前（近战） */
  async dashTo(target: Actor, gap = 70, dur = 0.22) {
    const c = this.caster;
    c.moving = true;
    c.poseTo(POSES.dash, 0.08);
    const dx = (target.bx - c.bx) * c.facing - gap;
    const dy = target.by - c.by;
    await c.moveTo(dx, dy, dur, 'inOut');
    c.moving = false;
  }
  async dashBack(dur = 0.28) {
    const c = this.caster;
    c.moving = true;
    c.poseTo(POSES.idle, 0.15);
    await c.moveTo(0, 0, dur, 'inOut');
    c.moving = false;
    await c.poseTo(POSES.idle, 0.12);
  }
  async jump(height = 120, dur = 0.4) {
    await this.scene.tween(this.caster.root, { air: height }, dur / 2, 'out');
    await this.scene.tween(this.caster.root, { air: 0 }, dur / 2, 'in');
  }

  // ----- 常用特效 -----
  hitSpark(t: Actor, color = '#fff', n = 10) {
    const [x, y] = t.anchor('chest');
    this.vfx.burst({ x, y, n, speed: [120, 380], life: [0.15, 0.4], size: [2, 4], color: [color, '#fff'], shape: 'spark', drag: 0.9, angle: this.dir > 0 ? 0 : Math.PI, spread: Math.PI * 1.3 });
    this.vfx.ring(x, y, { r0: 6, r1: 46, life: 0.25, color, width: 4 });
  }
  tint(color: string, a: number, dur = 0.3) {
    this.scene.tint.color = color;
    return this.scene.tween(this.scene.tint, { a }, dur, 'out');
  }
  dim(a: number, dur = 0.2) {
    return this.scene.tween(this.scene, { dim: a }, dur, 'out');
  }
  glow(actor: Actor, color: string, dur = 0.8) {
    actor.glowColor = color;
    actor.glow = 1;
    void dur;
  }
  /** 全体上升的光点（增益 / 治疗） */
  uplift(actors: Actor[], color: string | string[], shape: 'glow' | 'star' | 'petal' | 'leaf' | 'note' = 'star', n = 14) {
    for (const a of actors) {
      const [x, y] = a.anchor('foot');
      this.vfx.burst({ x, y: y - 20, n, speed: [10, 60], angle: -Math.PI / 2, spread: 1.2, life: [0.7, 1.3], size: [4, 8], color, shape, drag: 0.985, gravity: -60, radius: 36 });
    }
  }
  halo(color: string) { return hexA(color, 0.8); }
}
