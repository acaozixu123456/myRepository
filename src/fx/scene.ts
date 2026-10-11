// 战斗舞台：时钟 / 摄像机 / 绘制循环 / 补间。所有动画都跑在 scene.time 上，可加速、可慢放、可逐帧步进（测试用）。
import { Actor } from './actor';
import { VFX } from './vfx';
import { clamp, ease } from './util';
import type { Ease } from './util';

export interface Timer { t: number; res: () => void }
interface Tween { obj: Record<string, number>; from: Record<string, number>; to: Record<string, number>; t0: number; dur: number; ease: Ease; res: () => void }

export class Scene {
  readonly w = 960;
  readonly h = 600;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  time = 0;
  timeScale = 1;
  slow = 1; // 慢动作倍率（由特效控制）
  actors: Actor[] = [];
  vfx: VFX;
  bg: HTMLCanvasElement | null = null;
  /** 背景缓慢左右漂移（街景快照做背景时开，让静态图有一点镜头感） */
  bgDrift = false;
  cam = { x: 480, y: 300, zoom: 1, shakeMag: 0, shakeT: 0 };
  /** 默认镜头（战斗结束后回到这里），移动端主界面会放大一点 */
  baseCam = { x: 480, y: 300, zoom: 1 };
  dim = 0; // 全屏压暗
  dimColor = '#0a0614';
  flashA = 0;
  flashColor = '#fff';
  tint: { color: string; a: number } = { color: '#000', a: 0 };
  overlays: ((ctx: CanvasRenderingContext2D, scene: Scene) => void)[] = [];
  private timers: Timer[] = [];
  private tweens: Tween[] = [];
  private last = 0;
  private raf = 0;
  dpr = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.vfx = new VFX(this);
    this.resize();
  }

  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
  }

  /** 清空场上演员、特效与排队中的补间 / 定时器（切换到下一波战斗时使用） */
  clearAll() {
    this.actors = [];
    this.vfx.clear();
    this.timers = [];
    this.tweens = [];
    this.overlays = [];
    this.dim = 0;
    this.tint.a = 0;
    this.flashA = 0;
    this.slow = 1;
    this.cam.x = this.baseCam.x;
    this.cam.y = this.baseCam.y;
    this.cam.zoom = this.baseCam.zoom;
  }

  sleep(sec: number): Promise<void> {
    return new Promise((res) => this.timers.push({ t: this.time + sec, res }));
  }

  tween(obj: any, to: Record<string, number>, dur: number, e: Ease | string = "out"): Promise<void> {
    const from: Record<string, number> = {};
    for (const k of Object.keys(to)) from[k] = obj[k] as number;
    const easeFn = typeof e === 'string' ? ease[e] : e;
    return new Promise((res) => this.tweens.push({ obj, from, to: to as Record<string, number>, t0: this.time, dur: Math.max(0.0001, dur), ease: easeFn, res }));
  }

  shake(mag: number, dur = 0.3) {
    this.cam.shakeMag = Math.max(this.cam.shakeMag, mag);
    this.cam.shakeT = Math.max(this.cam.shakeT, dur);
  }
  flash(color = '#fff', a = 0.8) {
    this.flashColor = color;
    this.flashA = Math.max(this.flashA, a);
  }
  /** 摄像机推近到某点 */
  focus(x: number, y: number, zoom: number, dur = 0.4): Promise<void> {
    return Promise.all([this.tween(this.cam, { x, y, zoom }, dur, 'inOut')]).then(() => undefined);
  }
  resetCam(dur = 0.5) {
    return this.focus(this.baseCam.x, this.baseCam.y, this.baseCam.zoom, dur);
  }

  /** 推进 dt 秒（已乘 timeScale） */
  step(dt: number) {
    dt = Math.min(dt, 0.05);
    const d = dt * this.timeScale * this.slow;
    this.time += d;
    // 补间
    for (const tw of this.tweens.slice()) {
      const p = clamp((this.time - tw.t0) / tw.dur);
      const k = tw.ease(p);
      for (const key of Object.keys(tw.to)) tw.obj[key] = tw.from[key] + (tw.to[key] - tw.from[key]) * k;
      if (p >= 1) {
        this.tweens.splice(this.tweens.indexOf(tw), 1);
        tw.res();
      }
    }
    // 定时器
    this.timers.sort((a, b) => a.t - b.t);
    while (this.timers.length && this.timers[0].t <= this.time) this.timers.shift()!.res();
    for (const a of this.actors) a.update(d, this.time);
    this.vfx.update(d);
    if (this.cam.shakeT > 0) this.cam.shakeT -= dt;
    else this.cam.shakeMag *= 0.8;
    this.flashA = Math.max(0, this.flashA - dt * 3.2);
  }

  draw() {
    const { ctx, w, h } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    const sx = this.cam.shakeMag > 0.2 ? (Math.random() - 0.5) * this.cam.shakeMag * 2 : 0;
    const sy = this.cam.shakeMag > 0.2 ? (Math.random() - 0.5) * this.cam.shakeMag * 2 : 0;
    ctx.translate(w / 2 + sx, h / 2 + sy);
    ctx.scale(this.cam.zoom, this.cam.zoom);
    ctx.translate(-this.cam.x, -this.cam.y);
    if (this.bg) {
      if (this.bgDrift) { const k = 1.07, ox = Math.sin(this.time * 0.22) * w * 0.03, oy = Math.sin(this.time * 0.17 + 1) * h * 0.012; ctx.drawImage(this.bg, -(k - 1) * w / 2 + ox, -(k - 1) * h / 2 + oy, w * k, h * k); }
      else ctx.drawImage(this.bg, 0, 0, w, h);
    }
    this.vfx.drawBack(ctx);
    const sorted = this.actors.slice().sort((a, b) => a.y - b.y);
    for (const a of sorted) a.drawShadow(ctx);
    for (const a of sorted) a.draw(ctx);
    for (const a of sorted) a.drawHud(ctx);
    this.vfx.drawFront(ctx);
    ctx.restore();
    // 屏幕空间
    if (this.tint.a > 0.001) {
      ctx.fillStyle = this.tint.color;
      ctx.globalAlpha = this.tint.a;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
    if (this.dim > 0.001) {
      ctx.fillStyle = this.dimColor;
      ctx.globalAlpha = this.dim;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
    this.vfx.drawScreen(ctx);
    for (const o of this.overlays) o(ctx, this);
    if (this.flashA > 0.001) {
      ctx.fillStyle = this.flashColor;
      ctx.globalAlpha = Math.min(1, this.flashA);
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
  }

  start() {
    const loop = (t: number) => {
      const dt = this.last ? (t - this.last) / 1000 : 0;
      this.last = t;
      this.step(dt);
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop() {
    cancelAnimationFrame(this.raf);
  }
}
