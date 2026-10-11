// 特效库：粒子 / 刀光 / 光环 / 弹道 / 闪电 / 魔法阵 / 伤害数字。所有招式特效都由这些原语拼出来。
import type { Scene } from './scene';
import { clamp, ease, hexA, lerp, mulberry, rad } from './util';

export type Shape = 'glow' | 'spark' | 'petal' | 'ember' | 'leaf' | 'star' | 'note' | 'coin' | 'shard' | 'dot';

interface Particle {
  x: number; y: number; vx: number; vy: number; t: number; life: number; size: number; color: string; shape: Shape;
  rot: number; vr: number; gravity: number; drag: number; additive: boolean; grow: number; layer: 'back' | 'front';
}
export interface BurstOpts {
  x: number; y: number; n?: number; speed?: [number, number]; angle?: number; spread?: number; life?: [number, number];
  size?: [number, number]; color?: string | string[]; shape?: Shape; gravity?: number; drag?: number; additive?: boolean; grow?: number; layer?: 'back' | 'front';
  radius?: number; // 出生位置散布
}
export interface Fx {
  t: number; life: number; layer: 'back' | 'front' | 'screen';
  update?: (dt: number) => void; draw: (ctx: CanvasRenderingContext2D, p: number) => void;
}

const rnd = mulberry(20260101);
const rr = (a: number, b: number) => a + (b - a) * rnd();

export class VFX {
  fxs: Fx[] = [];
  parts: Particle[] = [];
  constructor(public scene: Scene) {}

  add(fx: Fx) { this.fxs.push(fx); return fx; }
  /** 自定义特效：draw(ctx, p) 中 p 为 0~1 的进度 */
  custom(life: number, draw: (ctx: CanvasRenderingContext2D, p: number, t: number) => void, layer: Fx['layer'] = 'front') {
    return this.add({ t: 0, life, layer, draw: (ctx, p) => draw(ctx, p, p * life) });
  }
  clear() { this.fxs = []; this.parts = []; }

  update(dt: number) {
    for (const f of this.fxs) { f.t += dt; f.update?.(dt); }
    this.fxs = this.fxs.filter((f) => f.t < f.life);
    for (const p of this.parts) {
      p.t += dt;
      p.vx *= Math.pow(p.drag, dt * 60);
      p.vy = p.vy * Math.pow(p.drag, dt * 60) + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    this.parts = this.parts.filter((p) => p.t < p.life);
  }

  burst(o: BurstOpts) {
    const n = o.n ?? 12;
    const cols = Array.isArray(o.color) ? o.color : [o.color ?? '#fff'];
    for (let i = 0; i < n; i++) {
      const a = (o.angle ?? 0) + (rnd() - 0.5) * (o.spread ?? Math.PI * 2);
      const sp = rr(...(o.speed ?? [60, 220]));
      const rad0 = o.radius ? rnd() * o.radius : 0;
      this.parts.push({
        x: o.x + Math.cos(a) * rad0, y: o.y + Math.sin(a) * rad0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: rr(...(o.life ?? [0.4, 0.9])),
        size: rr(...(o.size ?? [3, 8])), color: cols[Math.floor(rnd() * cols.length)], shape: o.shape ?? 'glow', rot: rnd() * 6.28, vr: (rnd() - 0.5) * 8,
        gravity: o.gravity ?? 0, drag: o.drag ?? 0.96, additive: o.additive ?? true, grow: o.grow ?? 0, layer: o.layer ?? 'front',
      });
    }
  }

  // ---------- 原语 ----------
  ring(x: number, y: number, o: { r0?: number; r1?: number; life?: number; color?: string; width?: number; squash?: number; additive?: boolean; layer?: Fx['layer'] } = {}) {
    const { r0 = 10, r1 = 120, life = 0.5, color = '#fff', width = 6, squash = 1, additive = true } = o;
    return this.add({
      t: 0, life, layer: o.layer ?? 'front',
      draw: (ctx, p) => {
        const e = ease.out(p);
        ctx.save();
        ctx.globalCompositeOperation = additive ? 'lighter' : 'source-over';
        ctx.globalAlpha = (1 - p) * 0.95;
        ctx.strokeStyle = color;
        ctx.lineWidth = width * (1 - p * 0.7);
        ctx.beginPath();
        ctx.ellipse(x, y, lerp(r0, r1, e), lerp(r0, r1, e) * squash, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      },
    });
  }

  /** 月牙刀光：从 a0 扫到 a1 */
  slash(x: number, y: number, o: { r?: number; a0?: number; a1?: number; width?: number; life?: number; color?: string; core?: string; flip?: boolean } = {}) {
    const { r = 120, a0 = -2.3, a1 = 0.6, width = 26, life = 0.28, color = '#9fe8ff', core = '#fff' } = o;
    return this.add({
      t: 0, life, layer: 'front',
      draw: (ctx, p) => {
        const head = lerp(a0, a1, ease.out(clamp(p * 1.6)));
        const tail = lerp(a0, a1, ease.out(clamp(p * 1.6 - 0.45)));
        const fade = 1 - ease.in(p);
        ctx.save();
        ctx.translate(x, y);
        if (o.flip) ctx.scale(-1, 1);
        ctx.globalCompositeOperation = 'lighter';
        for (const [col, wMul, al] of [[color, 1.6, 0.5], [color, 1, 0.9], [core, 0.45, 1]] as [string, number, number][]) {
          ctx.fillStyle = col;
          ctx.globalAlpha = fade * al;
          ctx.beginPath();
          const steps = 18;
          for (let i = 0; i <= steps; i++) {
            const a = lerp(tail, head, i / steps);
            const tp = i / steps;
            ctx.lineTo(Math.cos(a) * (r + (width * wMul * tp) / 2), Math.sin(a) * (r + (width * wMul * tp) / 2));
          }
          for (let i = steps; i >= 0; i--) {
            const a = lerp(tail, head, i / steps);
            const tp = i / steps;
            ctx.lineTo(Math.cos(a) * (r - (width * wMul * tp) / 2), Math.sin(a) * (r - (width * wMul * tp) / 2));
          }
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      },
    });
  }

  /** 直线冲击线（刺击 / 剑气） */
  streak(x1: number, y1: number, x2: number, y2: number, o: { width?: number; life?: number; color?: string; core?: string } = {}) {
    const { width = 22, life = 0.22, color = '#ffd36a', core = '#fff' } = o;
    return this.add({
      t: 0, life, layer: 'front',
      draw: (ctx, p) => {
        const e = ease.out(clamp(p * 2));
        const tx = lerp(x1, x2, e);
        const ty = lerp(y1, y2, e);
        const tailE = ease.out(clamp(p * 2 - 0.6));
        const sx = lerp(x1, x2, tailE);
        const sy = lerp(y1, y2, tailE);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.globalAlpha = 1 - p * p;
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.strokeStyle = core;
        ctx.lineWidth = width * 0.4;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.restore();
      },
    });
  }

  beam(x1: number, y1: number, x2: number, y2: number, o: { width?: number; life?: number; color?: string; core?: string } = {}) {
    const { width = 40, life = 0.45, color = '#7fe8ff', core = '#fff' } = o;
    return this.add({
      t: 0, life, layer: 'front',
      draw: (ctx, p) => {
        const w = width * Math.sin(Math.PI * clamp(p)) ;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        for (const [c, m, a] of [[color, 1.8, 0.35], [color, 1, 0.8], [core, 0.4, 1]] as [string, number, number][]) {
          ctx.strokeStyle = c; ctx.globalAlpha = a; ctx.lineWidth = w * m;
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        }
        ctx.restore();
      },
    });
  }

  bolt(x1: number, y1: number, x2: number, y2: number, o: { life?: number; color?: string; width?: number; segs?: number; jitter?: number } = {}) {
    const { life = 0.25, color = '#c9a8ff', width = 4, segs = 9, jitter = 28 } = o;
    const pts: [number, number][] = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const j = i === 0 || i === segs ? 0 : jitter;
      pts.push([lerp(x1, x2, t) + (rnd() - 0.5) * j * 2, lerp(y1, y2, t) + (rnd() - 0.5) * j * 2]);
    }
    return this.add({
      t: 0, life, layer: 'front',
      draw: (ctx, p) => {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (1 - p) * (0.6 + 0.4 * Math.sin(p * 40));
        ctx.lineJoin = 'round';
        for (const [c, w] of [[color, width * 3], ['#fff', width]] as [string, number][]) {
          ctx.strokeStyle = c; ctx.lineWidth = w;
          ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke();
        }
        ctx.restore();
      },
    });
  }

  /** 地面魔法阵（透视压扁）。 */
  glyph(x: number, y: number, o: { r?: number; life?: number; color?: string; spin?: number; points?: number; squash?: number } = {}) {
    const { r = 110, life = 1.2, color = '#7fe8ff', spin = 2, points = 6, squash = 0.36 } = o;
    return this.add({
      t: 0, life, layer: 'back',
      draw: (ctx, p) => {
        const grow = ease.outCubic(clamp(p * 3));
        const fade = p > 0.75 ? 1 - (p - 0.75) / 0.25 : 1;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(1, squash);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = fade * 0.9;
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        const R = r * grow;
        ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, R * 0.82, 0, Math.PI * 2); ctx.stroke();
        ctx.rotate(p * life * spin);
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i <= points; i++) {
          const a = ((i * 2) % points) / points * Math.PI * 2 + (points % 2 ? 0 : 0);
          const px = Math.cos(a - Math.PI / 2) * R * 0.82;
          const py = Math.sin(a - Math.PI / 2) * R * 0.82;
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.stroke();
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          ctx.beginPath(); ctx.moveTo(Math.cos(a) * R * 0.9, Math.sin(a) * R * 0.9); ctx.lineTo(Math.cos(a) * R * 0.98, Math.sin(a) * R * 0.98); ctx.stroke();
        }
        ctx.restore();
        // 内部发光
        const g = ctx.createRadialGradient(x, y, 0, x, y, R);
        g.addColorStop(0, hexA(color, 0.35 * fade));
        g.addColorStop(1, hexA(color, 0));
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.translate(0, y * (1 - 1 / squash) * 0);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(x, y, R, R * squash, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      },
    });
  }

  /** 光柱 */
  pillar(x: number, yBottom: number, o: { h?: number; w?: number; life?: number; color?: string } = {}) {
    const { h = 420, w = 70, life = 0.7, color = '#ffe08a' } = o;
    return this.add({
      t: 0, life, layer: 'front',
      draw: (ctx, p) => {
        const grow = ease.outCubic(clamp(p * 4));
        const fade = p > 0.5 ? 1 - (p - 0.5) / 0.5 : 1;
        const ww = w * (0.6 + grow * 0.4) * (1 - ease.in(clamp((p - 0.5) * 2)) * 0.6);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const strips = 22;
        const top = yBottom - h * grow;
        for (let i = 0; i < strips; i++) {
          const u = (i + 0.5) / strips; // 0..1 横向
          const edge = Math.pow(Math.sin(Math.PI * u), 0.7); // 中心亮、边缘淡
          const g = ctx.createLinearGradient(0, top, 0, yBottom);
          g.addColorStop(0, hexA(color, 0));
          g.addColorStop(0.7, hexA(color, 0.55 * fade * edge));
          g.addColorStop(1, hexA('#ffffff', 0.9 * fade * edge));
          ctx.fillStyle = g;
          ctx.fillRect(x - ww / 2 + (i / strips) * ww, top, ww / strips + 0.6, yBottom - top);
        }
        ctx.restore();
      },
    });
  }

  /** 伤害 / 治疗数字 */
  num(x: number, y: number, text: string, o: { color?: string; size?: number; crit?: boolean; life?: number; stroke?: string } = {}) {
    const { color = '#fff', size = 26, crit = false, life = 1.0, stroke = '#c0392b' } = o;
    const drift = (rnd() - 0.5) * 30;
    return this.add({
      t: 0, life, layer: 'screen' === 'screen' ? 'front' : 'front',
      draw: (ctx, p) => {
        const pop = p < 0.15 ? ease.outBack(p / 0.15) : 1;
        const yy = y - ease.out(p) * (crit ? 70 : 50);
        ctx.save();
        ctx.globalAlpha = p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;
        ctx.translate(x + drift * p, yy);
        ctx.scale(pop * (crit ? 1.35 : 1), pop * (crit ? 1.35 : 1));
        ctx.font = `900 ${size}px "ZCOOL KuaiLe","Noto Sans SC","WenQuanYi Zen Hei",sans-serif`;
        ctx.textAlign = 'center';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 5;
        ctx.strokeStyle = stroke;
        ctx.strokeText(text, 0, 0);
        ctx.fillStyle = color;
        ctx.fillText(text, 0, 0);
        ctx.restore();
      },
    });
  }

  /** 弹道：返回命中时 resolve */
  projectile(x1: number, y1: number, x2: number, y2: number, o: { speed?: number; arc?: number; draw: (ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, t: number) => void; trail?: { color: string; shape?: Shape; size?: [number, number]; n?: number } }): Promise<void> {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const life = Math.max(0.12, dist / (o.speed ?? 900));
    return new Promise((res) => {
      let prev: [number, number] = [x1, y1];
      this.add({
        t: 0, life: life + 0.001, layer: 'front',
        update: () => undefined,
        draw: (ctx, p) => {
          const e = p;
          const x = lerp(x1, x2, e);
          const y = lerp(y1, y2, e) - Math.sin(Math.PI * e) * (o.arc ?? 0);
          const ang = Math.atan2(y - prev[1], x - prev[0]) || Math.atan2(y2 - y1, x2 - x1);
          if (o.trail) this.burst({ x, y, n: o.trail.n ?? 2, speed: [10, 50], life: [0.15, 0.35], size: o.trail.size ?? [3, 6], color: o.trail.color, shape: o.trail.shape ?? 'glow', drag: 0.9 });
          prev = [x, y];
          o.draw(ctx, x, y, ang, p);
          if (p >= 0.999) res();
        },
      });
      setTimeout(() => undefined, 0);
      this.scene.sleep(life).then(() => res());
    });
  }

  // ---------- 绘制 ----------
  drawBack(ctx: CanvasRenderingContext2D) {
    for (const f of this.fxs) if (f.layer === 'back') f.draw(ctx, clamp(f.t / f.life));
    this.drawParts(ctx, 'back');
  }
  drawFront(ctx: CanvasRenderingContext2D) {
    for (const f of this.fxs) if (f.layer === 'front') f.draw(ctx, clamp(f.t / f.life));
    this.drawParts(ctx, 'front');
  }
  drawScreen(ctx: CanvasRenderingContext2D) {
    for (const f of this.fxs) if (f.layer === 'screen') f.draw(ctx, clamp(f.t / f.life));
  }

  private drawParts(ctx: CanvasRenderingContext2D, layer: 'back' | 'front') {
    ctx.save();
    for (const p of this.parts) {
      if (p.layer !== layer) continue;
      const k = p.t / p.life;
      const a = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
      const s = p.size * (1 + p.grow * k);
      ctx.globalCompositeOperation = p.additive ? 'lighter' : 'source-over';
      ctx.globalAlpha = clamp(a);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      switch (p.shape) {
        case 'glow': {
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 2);
          g.addColorStop(0, p.color); g.addColorStop(1, hexA('#000000', 0));
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, s * 2, 0, 6.3); ctx.fill();
          break;
        }
        case 'dot': ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(0, 0, s, 0, 6.3); ctx.fill(); break;
        case 'ember': {
          ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(0, 0, s * 0.6, 0, 6.3); ctx.fill();
          ctx.fillStyle = '#fff8d0'; ctx.beginPath(); ctx.arc(0, 0, s * 0.28, 0, 6.3); ctx.fill();
          break;
        }
        case 'spark': {
          const sp = Math.hypot(p.vx, p.vy);
          ctx.rotate(-p.rot + Math.atan2(p.vy, p.vx));
          ctx.strokeStyle = p.color; ctx.lineWidth = Math.max(1.5, s * 0.5); ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-Math.min(40, sp * 0.08 + s), 0); ctx.stroke();
          break;
        }
        case 'petal': {
          ctx.fillStyle = p.color; ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.55, 0, 0, 6.3); ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-s, 0); ctx.lineTo(s, 0); ctx.stroke();
          break;
        }
        case 'leaf': {
          ctx.fillStyle = p.color; ctx.beginPath(); ctx.moveTo(-s, 0); ctx.quadraticCurveTo(0, -s * 0.8, s, 0); ctx.quadraticCurveTo(0, s * 0.8, -s, 0); ctx.fill();
          break;
        }
        case 'star': {
          ctx.fillStyle = p.color; ctx.beginPath();
          for (let i = 0; i < 8; i++) { const r = i % 2 ? s * 0.28 : s * 1.1; const a = (i / 8) * 6.283; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
          ctx.closePath(); ctx.fill();
          break;
        }
        case 'note': {
          ctx.fillStyle = p.color; ctx.strokeStyle = p.color; ctx.lineWidth = s * 0.25;
          ctx.beginPath(); ctx.ellipse(0, 0, s * 0.55, s * 0.4, -0.4, 0, 6.3); ctx.fill();
          ctx.beginPath(); ctx.moveTo(s * 0.45, -s * 0.1); ctx.lineTo(s * 0.45, -s * 1.5); ctx.quadraticCurveTo(s * 1.1, -s * 1.2, s * 0.9, -s * 0.7); ctx.stroke();
          break;
        }
        case 'coin': {
          ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(0, 0, s, 0, 6.3); ctx.fill();
          ctx.fillStyle = 'rgba(80,50,10,.8)'; ctx.fillRect(-s * 0.28, -s * 0.28, s * 0.56, s * 0.56);
          break;
        }
        case 'shard': {
          ctx.fillStyle = p.color; ctx.beginPath(); ctx.moveTo(-s, 0); ctx.lineTo(0, -s * 0.5); ctx.lineTo(s * 1.2, 0); ctx.lineTo(0, s * 0.35); ctx.closePath(); ctx.fill();
          break;
        }
      }
      ctx.restore();
    }
    ctx.restore();
  }
}
export { rad };
