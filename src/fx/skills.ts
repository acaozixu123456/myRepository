// 技能特效注册表：技能 DSL 里的 fx id → 一段编排（动作 + 特效 + 命中时刻）。
// 约定：所有函数都是 async (c: Choreo)；命中时刻调用 c.hit(k) / c.where(...)；结尾剩余事件由播放器自动 c.rest()。
import type { BEvent } from '../engine/types';
import type { Actor } from './actor';
import type { Choreo } from './choreo';
import { clamp, ease, hexA, lerp, mulberry, rad } from './util';
import { SKILL_FX2 } from './skills2';
import { SKILL_FX3 } from './skills3';

export type SkillFx = (c: Choreo) => Promise<void>;
type Dmg = Extract<BEvent, { t: 'damage' }>;
type Hl = Extract<BEvent, { t: 'heal' }>;

const isDmg = (e: BEvent): e is Dmg => e.t === 'damage';
const isHeal = (e: BEvent): e is Hl => e.t === 'heal';
const forTarget = (t: Actor) => (e: BEvent) => (e.t === 'damage' || e.t === 'heal') && e.dst === t.uid;
const FONT = '"ZCOOL KuaiLe","Noto Sans SC","WenQuanYi Zen Hei",sans-serif';

// ====================== 绘制小工具 ======================
function drawFlame(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, w: number, t: number, seed: number) {
  const flick = 1 + Math.sin(t * 18 + seed * 7) * 0.08 + Math.sin(t * 31 + seed) * 0.05;
  const hh = h * flick;
  const layers: [string, number, number][] = [['rgba(200,40,30,0.9)', 1, 1], ['rgba(255,130,40,0.95)', 0.78, 0.74], ['rgba(255,226,120,1)', 0.5, 0.45]];
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const [col, wm, hm] of layers) {
    ctx.fillStyle = col;
    ctx.beginPath();
    const sway = Math.sin(t * 9 + seed * 3) * w * 0.18;
    ctx.moveTo(x - w * wm, y);
    ctx.bezierCurveTo(x - w * wm * 1.1, y - hh * hm * 0.45, x - w * 0.2 + sway, y - hh * hm * 0.7, x + sway * 1.6, y - hh * hm);
    ctx.bezierCurveTo(x + w * 0.2 + sway, y - hh * hm * 0.7, x + w * wm * 1.1, y - hh * hm * 0.45, x + w * wm, y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawSeal(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, a = 1) {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(x, y);
  ctx.scale(s, s);
  // 方印
  const g = ctx.createLinearGradient(-70, -60, 70, 60);
  g.addColorStop(0, '#b6f3d6'); g.addColorStop(0.55, '#56c19b'); g.addColorStop(1, '#2d8a6c');
  ctx.fillStyle = g;
  ctx.strokeStyle = '#1d5a48';
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.roundRect(-72, -50, 144, 100, 12); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#f1cf63'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.roundRect(-72, 36, 144, 14, 6); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(-72, -50, 144, 14, 6); ctx.stroke();
  // 印钮（盘龙简化为圆润的猫头钮）
  ctx.fillStyle = '#7fe0b8'; ctx.strokeStyle = '#1d5a48'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.ellipse(0, -76, 38, 30, 0, 0, 6.3); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-34, -92); ctx.lineTo(-30, -112); ctx.lineTo(-14, -98); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(34, -92); ctx.lineTo(30, -112); ctx.lineTo(14, -98); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#1d5a48';
  ctx.beginPath(); ctx.ellipse(-12, -78, 4, 6, 0, 0, 6.3); ctx.ellipse(12, -78, 4, 6, 0, 0, 6.3); ctx.fill();
  // 印文
  ctx.font = `900 56px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff4c0';
  ctx.fillText('令', 0, 20);
  ctx.restore();
}

function drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, len = 54, col = '#f6ecc8') {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(ang);
  ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(0, 0); ctx.stroke();
  ctx.fillStyle = '#dfe8f0'; ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(14, 0); ctx.lineTo(0, 5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(-len - 8, -6); ctx.lineTo(-len + 8, -4); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(-len - 8, 6); ctx.lineTo(-len + 8, 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f0c75a'; ctx.beginPath(); ctx.arc(-len + 14, 0, 4, 0, 6.3); ctx.fill();
  ctx.restore();
}

function drawKnife(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, s = 1) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s);
  ctx.fillStyle = '#e6eef5'; ctx.strokeStyle = '#7a8a9a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-6, -5); ctx.quadraticCurveTo(14, -12, 30, 0); ctx.quadraticCurveTo(14, 4, -6, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#d9483b'; ctx.fillRect(-18, -4, 12, 8);
  ctx.fillStyle = '#f0c75a'; ctx.fillRect(-8, -7, 3, 14);
  ctx.restore();
}

function drawTotem(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, a: number, glow: number) {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = '#8a7358'; ctx.strokeStyle = '#4a3a28'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.roundRect(x - 20, y - h, 40, h, 8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#a89070'; ctx.fillRect(x - 20, y - h + 8, 40, 8);
  // 脸
  ctx.fillStyle = '#3a2a18';
  ctx.beginPath(); ctx.moveTo(x - 12, y - h * 0.72); ctx.lineTo(x - 3, y - h * 0.66); ctx.lineTo(x - 12, y - h * 0.62); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + 12, y - h * 0.72); ctx.lineTo(x + 3, y - h * 0.66); ctx.lineTo(x + 12, y - h * 0.62); ctx.closePath(); ctx.fill();
  ctx.fillStyle = `rgba(255,200,80,${0.5 + glow * 0.5})`;
  ctx.beginPath(); ctx.arc(x - 8, y - h * 0.66, 3, 0, 6.3); ctx.arc(x + 8, y - h * 0.66, 3, 0, 6.3); ctx.fill();
  ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x - 10, y - h * 0.45); ctx.lineTo(x + 10, y - h * 0.45); ctx.stroke();
  ctx.restore();
}

function crescentWave(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, thick: number, color: string, a: number, flip = 1) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(flip, 1);
  ctx.globalCompositeOperation = 'lighter';
  for (const [c, m, al] of [[color, 1.5, 0.5], [color, 1, 0.95], ['#ffffff', 0.4, 1]] as [string, number, number][]) {
    ctx.globalAlpha = a * al; ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(0, 0, r, -1.15, 1.15);
    ctx.arc(-thick * m * 0.9, 0, r * 0.93, 1.15, -1.15, true);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// ====================== 基础：近战 ======================
function meleeBasic(style: 'slash' | 'glaive' | 'mace' | 'pierce' | 'halberd'): SkillFx {
  return async (c) => {
    const t = c.targets[0];
    const flip = c.dir < 0;
    const colors: Record<string, string> = { slash: '#bfeaff', glaive: '#9dffc4', mace: '#ffd08a', pierce: '#ffe9a0', halberd: '#e0b0ff' };
    await c.dashTo(t, style === 'mace' ? 66 : 58, 0.2);
    await c.pose(style === 'pierce' ? 'windupLow' : 'windup', 0.11);
    await c.pose(style === 'pierce' ? 'thrust' : 'strike', 0.07, 'in');
    const [x, y] = t.anchor('chest');
    if (style === 'pierce') c.vfx.streak(x - c.dir * 90, y + 6, x + c.dir * 20, y - 4, { color: colors[style] });
    else c.vfx.slash(x - c.dir * 10, y + 10, { r: style === 'mace' ? 72 : 96, a0: -2.4, a1: 0.7, width: style === 'mace' ? 34 : 24, color: colors[style], flip });
    if (style === 'mace') c.scene.vfx.burst({ x, y: t.by, n: 10, speed: [60, 200], angle: -Math.PI / 2, spread: 1.6, life: [0.3, 0.6], size: [3, 6], color: ['#c9a063', '#8a6a3a'], shape: 'shard', gravity: 400, additive: false });
    c.hit(0);
    c.hitSpark(t, colors[style]);
    c.scene.shake(3, 0.1);
    await c.sleep(0.1);
    if (c.hits() > 1) {
      await c.pose('windup', 0.08);
      await c.pose('strike', 0.06, 'in');
      c.vfx.slash(x - c.dir * 10, y, { r: 80, a0: 0.6, a1: -2.2, width: 22, color: colors[style], flip });
      c.hit();
      c.hitSpark(t, colors[style]);
      await c.sleep(0.1);
    }
    await c.dashBack();
  };
}

// ====================== 基础：远程 ======================
function projectileFx(kind: string, color: string) {
  return (ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, p: number) => {
    switch (kind) {
      case 'seal': {
        ctx.save(); ctx.translate(x, y); ctx.rotate(p * 9);
        ctx.fillStyle = '#56c19b'; ctx.strokeStyle = '#f1cf63'; ctx.lineWidth = 3; ctx.fillRect(-11, -11, 22, 22); ctx.strokeRect(-11, -11, 22, 22);
        ctx.restore(); break;
      }
      case 'arrow': drawArrow(ctx, x, y, ang); break;
      case 'knife': drawKnife(ctx, x, y, p * 18, 1.1); break;
      case 'fan': crescentWave(ctx, x, y, 26, 8, '#e6fff0', 1, Math.cos(ang) >= 0 ? 1 : -1); break;
      case 'note': {
        ctx.save(); ctx.translate(x, y); ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath(); ctx.ellipse(0, 0, 9, 6, -0.4, 0, 6.3); ctx.fill(); ctx.beginPath(); ctx.moveTo(8, -2); ctx.lineTo(8, -26); ctx.quadraticCurveTo(18, -22, 14, -14); ctx.stroke();
        ctx.restore(); break;
      }
      default: {
        const g = ctx.createRadialGradient(x, y, 0, x, y, 20);
        g.addColorStop(0, '#fff'); g.addColorStop(0.4, color); g.addColorStop(1, hexA(color, 0));
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 20, 0, 6.3); ctx.fill(); ctx.restore();
      }
    }
  };
}

function rangedBasic(kind: string, castPose = 'castFwd'): SkillFx {
  return async (c) => {
    const color = kind === 'qin' ? '#ffb070' : kind === 'seal' ? '#ffe08a' : kind === 'teal' ? '#7fe8ff' : kind === 'knife' ? '#e6eef5' : c.color;
    await c.pose(castPose, 0.14);
    c.glow(c.caster, color);
    await c.sleep(0.08);
    const [fx, fy] = c.caster.anchor('hand');
    if (kind === 'qin') c.vfx.burst({ x: fx, y: fy, n: 6, speed: [30, 90], angle: -Math.PI / 2, spread: 1.4, life: [0.5, 0.9], size: [7, 10], color: ['#ffd8a0', '#ffb070'], shape: 'note', gravity: -50 });
    const dstEvents = c.batch.filter((e): e is Dmg | Hl => isDmg(e) || isHeal(e));
    const dsts = [...new Set(dstEvents.map((e) => e.dst))].map((id) => c.player.actor(id)!).filter(Boolean);
    await Promise.all(
      dsts.map(async (t, i) => {
        await c.sleep(i * 0.07);
        const [tx, ty] = t.anchor('chest');
        const heal = dstEvents.some((e) => e.dst === t.uid && isHeal(e)) && !dstEvents.some((e) => e.dst === t.uid && isDmg(e));
        await c.vfx.projectile(fx, fy, tx, ty, { speed: kind === 'arrow' || kind === 'knife' ? 1300 : 900, arc: kind === 'qin' ? 20 : 0, draw: projectileFx(kind, heal ? '#9dffb0' : color), trail: { color: heal ? '#9dffb0' : color, shape: kind === 'qin' ? 'note' : 'glow', size: kind === 'qin' ? [6, 9] : [3, 6], n: kind === 'qin' ? 1 : 2 } });
        c.where(forTarget(t));
        c.hitSpark(t, heal ? '#9dffb0' : color, heal ? 6 : 10);
      }),
    );
    await c.sleep(0.12);
  };
}

const healTouch: SkillFx = async (c) => {
  await rangedBasic('bolt', 'castFwd')(c);
};

// ====================== 绝技通用兜底 ======================
const ultGeneric: SkillFx = async (c) => {
  const k = c.caster;
  const col = c.color;
  await c.pose('castUp', 0.25);
  c.glow(k, col);
  c.vfx.glyph(k.x, k.by, { r: 90, color: col, life: 1.2 });
  c.vfx.pillar(k.x, k.by, { h: 300, w: 80, color: col });
  await c.sleep(0.5);
  const tg = c.targets;
  const enemy = tg[0] && tg[0].side !== k.side;
  for (const t of tg) {
    const [x, y] = t.anchor('chest');
    if (enemy) { c.vfx.beam(k.anchor('hand')[0], k.anchor('hand')[1], x, y, { color: col, life: 0.4 }); c.vfx.ring(x, y, { r1: 90, color: col }); }
    else c.vfx.pillar(x, t.by, { h: 260, color: col });
  }
  c.scene.shake(8, 0.3);
  c.scene.flash('#fff', 0.5);
  await c.sleep(0.15);
  c.hit();
  await c.sleep(0.5);
};

// ====================== 魏 · 曹喵德「挟天子以令诸猫」 ======================
const ultImperialSeal: SkillFx = async (c) => {
  const k = c.caster;
  const [ex, ey] = c.center(c.foes);
  c.scene.focus(lerp(k.x, ex, 0.55), 330, 1.12, 0.55);
  c.pose('castUp', 0.3);
  c.glow(k, '#ffd24a');
  c.vfx.glyph(k.x, k.by, { r: 96, color: '#ffd24a', life: 1.8, points: 8 });
  c.vfx.burst({ x: k.x, y: k.by - 40, n: 30, speed: [20, 120], angle: -Math.PI / 2, spread: 1.6, life: [0.6, 1.2], size: [3, 7], color: ['#ffe08a', '#fff'], shape: 'star', gravity: -60, radius: 50 });
  await c.sleep(0.65);
  const groundY = ey + 8;
  // 玉玺坠落
  c.vfx.custom(1.4, (ctx, p) => {
    const fall = clamp(p / 0.42);
    const sy = lerp(-230, groundY - 40, ease.in(fall));
    // 地面阴影
    ctx.save();
    ctx.globalAlpha = 0.18 + fall * 0.3;
    ctx.fillStyle = '#1a1030';
    ctx.beginPath(); ctx.ellipse(ex, groundY, 40 + fall * 140, 12 + fall * 36, 0, 0, 6.3); ctx.fill();
    ctx.restore();
    const after = p > 0.42 ? clamp((p - 0.42) / 0.58) : 0;
    drawSeal(ctx, ex, sy, 1.55 + (1 - fall) * 0.4, 1 - ease.in(clamp((after - 0.5) * 2)));
  });
  await c.sleep(0.6);
  // 冲击
  c.scene.shake(18, 0.5);
  c.scene.flash('#fff2b0', 0.95);
  c.vfx.ring(ex, groundY, { r0: 20, r1: 320, life: 0.7, color: '#ffe08a', width: 14, squash: 0.35 });
  c.vfx.ring(ex, groundY, { r0: 10, r1: 220, life: 0.55, color: '#ffffff', width: 8, squash: 0.35 });
  c.vfx.burst({ x: ex, y: groundY, n: 40, speed: [100, 420], angle: -Math.PI / 2, spread: 2.6, life: [0.4, 0.9], size: [3, 7], color: ['#ffe08a', '#ffffff', '#9fe8c8'], shape: 'shard', gravity: 520 });
  c.vfx.pillar(ex, groundY, { h: 460, w: 200, color: '#ffe08a', life: 0.6 });
  c.hit();
  await c.sleep(0.55);
  // 友方护盾泡
  c.rest();
  for (const a of c.allies) {
    const [x, y] = a.anchor('chest');
    c.vfx.custom(0.9, (ctx, p) => {
      const r = 58 + Math.sin(p * 8) * 2;
      ctx.save(); ctx.globalAlpha = (1 - p) * 0.9;
      const g = ctx.createRadialGradient(x, y, r * 0.3, x, y, r);
      g.addColorStop(0, 'rgba(190,230,255,0)'); g.addColorStop(1, 'rgba(190,230,255,0.55)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.3); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
    });
  }
  c.uplift(c.allies, ['#bfe6ff', '#ffe08a'], 'star', 8);
  await c.sleep(0.55);
};

// ====================== 蜀 · 刘喵备「桃园结义」 ======================
const ultPeachOath: SkillFx = async (c) => {
  const k = c.caster;
  const mine = c.allies.slice().sort((a, b) => a.bx - b.bx);
  const [cx, cy] = c.center(mine);
  c.scene.focus(cx, 340, 1.1, 0.5);
  c.pose('castUp', 0.3);
  c.glow(k, '#ffd9e8');
  await c.sleep(0.35);
  // 三道光柱：三兄弟
  const trio = [mine[0], mine[Math.floor(mine.length / 2)], mine[mine.length - 1]].filter(Boolean);
  trio.forEach((a, i) => c.vfx.pillar(a.x, a.by, { h: 420, w: 90, color: ['#9dffb0', '#ffe08a', '#ffb8d0'][i], life: 1.3 }));
  c.vfx.glyph(cx, cy + 20, { r: 200, color: '#ffb8d0', life: 1.8, points: 5 });
  // 桃花风暴
  const rnd = mulberry(5);
  const petals = Array.from({ length: 90 }, (_, i) => ({ a: rnd() * 6.28, r: 30 + rnd() * 200, h: rnd() * 260, sp: 1 + rnd() * 2, s: 5 + rnd() * 6, c: ['#ffb8d0', '#ff8fb0', '#ffe0ec'][i % 3], ph: rnd() * 6 }));
  c.vfx.custom(1.9, (ctx, p, t) => {
    const fade = p < 0.8 ? 1 : 1 - (p - 0.8) / 0.2;
    for (const q of petals) {
      const ang = q.a + t * q.sp;
      const x = cx + Math.cos(ang) * q.r;
      const y = cy + 40 - ((q.h + t * 90) % 300) + Math.sin(ang) * q.r * 0.25;
      ctx.save(); ctx.globalAlpha = fade * 0.95; ctx.translate(x, y); ctx.rotate(ang * 2 + q.ph);
      ctx.fillStyle = q.c; ctx.beginPath(); ctx.ellipse(0, 0, q.s, q.s * 0.55, 0, 0, 6.3); ctx.fill();
      ctx.restore();
    }
  });
  await c.sleep(0.9);
  c.scene.flash('#fff0f6', 0.55);
  c.rest();
  c.uplift(mine, ['#9dffb0', '#fff'], 'star', 16);
  // 增益箭头
  for (const a of mine) {
    const [x, y] = a.anchor('top');
    c.vfx.custom(1.1, (ctx, p) => {
      ctx.save(); ctx.globalAlpha = 1 - p; ctx.fillStyle = '#ffd46a'; ctx.strokeStyle = '#a06a10'; ctx.lineWidth = 2;
      const yy = y - 10 - p * 36;
      ctx.beginPath(); ctx.moveTo(x, yy - 14); ctx.lineTo(x + 11, yy); ctx.lineTo(x + 4, yy); ctx.lineTo(x + 4, yy + 12); ctx.lineTo(x - 4, yy + 12); ctx.lineTo(x - 4, yy); ctx.lineTo(x - 11, yy); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    });
  }
  await c.sleep(1.0);
};

// ====================== 吴 · 周喵瑜「赤壁火海」 ======================
const ultRedCliff: SkillFx = async (c) => {
  const k = c.caster;
  const [ex, ey] = c.center(c.foes);
  c.scene.focus(lerp(k.x, ex, 0.5), 340, 1.1, 0.5);
  c.pose('cast', 0.25);
  c.glow(k, '#ff7a3a');
  c.vfx.glyph(k.x, k.by, { r: 90, color: '#ff7a3a', life: 1.6, points: 7 });
  c.tint('#ff3a20', 0.22, 0.6);
  // 琴音
  for (let i = 0; i < 5; i++) {
    const [hx, hy] = k.anchor('chest');
    c.vfx.burst({ x: hx + c.dir * 20, y: hy, n: 3, speed: [40, 120], angle: -Math.PI / 3, spread: 1.4, life: [0.7, 1.2], size: [8, 12], color: ['#ffd8a0', '#ff9a50'], shape: 'note', gravity: -30 });
    c.vfx.ring(hx, hy, { r0: 12, r1: 70 + i * 16, life: 0.55, color: '#ffb070', width: 3 });
    await c.sleep(0.11);
  }
  await c.sleep(0.15);
  // 火浪席卷
  const x0 = ex - c.dir * 230;
  const span = 460;
  const cols = 22;
  const rnd = mulberry(77);
  const seeds = Array.from({ length: cols }, () => ({ h: 150 + rnd() * 120, w: 30 + rnd() * 16, s: rnd() * 9 }));
  const dur = 1.6;
  c.vfx.custom(dur, (ctx, _p, t) => {
    for (let i = 0; i < cols; i++) {
      const start = (i / cols) * 0.55 * dur;
      const lt = t - start;
      if (lt < 0) continue;
      const grow = ease.outBack(clamp(lt / 0.35));
      const fade = clamp((dur - t) / 0.5);
      const x = x0 + c.dir * (i / (cols - 1)) * span;
      const row = i % 2 ? 14 : -10;
      drawFlame(ctx, x, ey + row + 12, seeds[i].h * grow * fade, seeds[i].w, lt, seeds[i].s);
    }
  });
  for (let i = 0; i < 6; i++) {
    c.vfx.burst({ x: ex, y: ey, n: 12, speed: [30, 160], angle: -Math.PI / 2, spread: 2.2, life: [0.8, 1.6], size: [3, 6], color: ['#ff8a3a', '#ffd06a'], shape: 'ember', gravity: -90, radius: 190, drag: 0.98 });
    if (i === 2) { c.scene.shake(12, 0.7); c.scene.flash('#ffb070', 0.6); c.hit(); }
    await c.sleep(0.22);
  }
  await c.sleep(0.5);
  c.rest();
};

// ====================== 群 · 吕布丁「天下无双」 ======================
const ultTianxia: SkillFx = async (c) => {
  const k = c.caster;
  const tg = c.targets.slice().sort((a, b) => a.by - b.by);
  const [ex] = c.center(c.foes);
  c.scene.focus(lerp(k.x, ex, 0.5), 340, 1.08, 0.4);
  c.pose('windup', 0.25);
  c.glow(k, '#c06aff');
  c.vfx.glyph(k.x, k.by, { r: 80, color: '#c06aff', life: 1.0, points: 6 });
  c.vfx.bolt(k.x, k.by - 260, k.x, k.by - 20, { color: '#c06aff', life: 0.3 });
  await c.sleep(0.4);
  // 连续突进：每次留残影
  const ghosts: { snap: ReturnType<Actor['snapshot']>; t: number }[] = [];
  c.vfx.custom(2.6, (ctx) => {
    for (const g of ghosts) { const age = (c.scene.time - g.t) / 0.35; if (age < 1) k.drawGhost(ctx, g.snap, 0.5 * (1 - age), '#c06aff'); }
  });
  const sampler = { on: true };
  const sample = async () => { while (sampler.on) { ghosts.push({ snap: k.snapshot(), t: c.scene.time }); await c.sleep(0.03); } };
  void sample();
  for (const t of tg) {
    await c.dashTo(t, 34, 0.13);
    await c.pose('strike', 0.05, 'in');
    const [x, y] = t.anchor('chest');
    c.vfx.slash(x, y, { r: 92, a0: -2.6, a1: 0.9, width: 30, color: '#ff6ac0', flip: c.dir < 0 });
    c.vfx.bolt(x - 70, y - 90, x + 50, y + 40, { color: '#ff6ac0', life: 0.2 });
    c.where(forTarget(t));
    c.hitSpark(t, '#ff8ad0', 14);
    c.scene.shake(7, 0.14);
    await c.pose('windup', 0.05);
  }
  sampler.on = false;
  // 终结一击：画戟横扫
  await c.pose('windupLow', 0.14);
  await c.sleep(0.08);
  c.scene.flash('#ffd0f0', 0.7);
  c.scene.shake(14, 0.35);
  const [kx, ky] = [k.x, k.y - 90];
  c.vfx.custom(0.5, (ctx, p) => crescentWave(ctx, kx + c.dir * lerp(40, 380, ease.out(p)), ky + 20, 180 + p * 60, 46 * (1 - p * 0.4), '#ff6ac0', 1 - ease.in(p), c.dir));
  await c.pose('strike', 0.08, 'in');
  c.vfx.ring(k.x, k.by, { r1: 200, color: '#ff8ad0', squash: 0.35, life: 0.5 });
  await c.sleep(0.4);
  await c.dashBack(0.3);
};

// ====================== 蛮 · 孟喵获「七擒七纵」 ======================
const ultSevenCapture: SkillFx = async (c) => {
  const k = c.caster;
  const t = c.targets[0];
  c.scene.focus(lerp(k.x, t.x, 0.5), 350, 1.12, 0.4);
  c.pose('windup', 0.2);
  c.glow(k, '#ffb040');
  await c.sleep(0.2);
  // 起跳
  k.moving = true;
  const dx = (t.bx - k.bx) * k.facing - 62;
  c.scene.tween(k.root, { ox: dx, oy: t.by - k.by }, 0.5, 'inOut');
  await c.scene.tween(k.root, { air: 190 }, 0.25, 'out');
  c.vfx.glyph(t.x, t.by, { r: 110, color: '#ffb040', life: 0.9, points: 7 });
  await c.scene.tween(k.root, { air: 0 }, 0.16, 'in');
  k.moving = false;
  // 砸地
  c.pose('strike', 0.05, 'in');
  const gx = t.x;
  const gy = t.by;
  c.scene.shake(20, 0.55);
  c.scene.flash('#ffe6b0', 0.8);
  c.vfx.ring(gx, gy, { r0: 10, r1: 280, life: 0.6, color: '#d9a05a', width: 12, squash: 0.35 });
  c.vfx.ring(gx, gy, { r0: 10, r1: 180, life: 0.45, color: '#fff', width: 6, squash: 0.35 });
  c.vfx.burst({ x: gx, y: gy, n: 36, speed: [120, 460], angle: -Math.PI / 2, spread: 2.4, life: [0.5, 1.1], size: [4, 9], color: ['#a8885a', '#6a4a2a', '#d9b27a'], shape: 'shard', gravity: 640, additive: false });
  // 地裂
  const rnd = mulberry(31);
  const cracks = Array.from({ length: 9 }, (_, i) => ({ a: (i / 9) * 6.28 + rnd() * 0.3, len: 90 + rnd() * 120, j: rnd() * 40 }));
  c.vfx.custom(1.5, (ctx, p) => {
    const grow = ease.out(clamp(p * 5));
    ctx.save(); ctx.translate(gx, gy); ctx.scale(1, 0.4);
    ctx.strokeStyle = `rgba(40,24,10,${1 - ease.in(clamp((p - 0.7) / 0.3))})`; ctx.lineWidth = 5; ctx.lineJoin = 'round';
    for (const cr of cracks) {
      ctx.beginPath(); ctx.moveTo(0, 0);
      const n = 5;
      for (let i = 1; i <= n; i++) { const r = (cr.len * grow * i) / n; ctx.lineTo(Math.cos(cr.a + (i % 2 ? 0.12 : -0.12)) * r, Math.sin(cr.a + (i % 2 ? 0.12 : -0.12)) * r); }
      ctx.stroke();
    }
    ctx.restore();
  }, 'back');
  // 七根图腾柱破土而出
  c.vfx.custom(1.5, (ctx, p) => {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * 6.283 - Math.PI / 2;
      const x = gx + Math.cos(a) * 118;
      const y = gy + Math.sin(a) * 118 * 0.36 + 10;
      const delay = i * 0.04;
      const rise = ease.outBack(clamp((p - delay) / 0.2));
      const sink = ease.in(clamp((p - 0.7) / 0.3));
      const h = 112 * rise * (1 - sink);
      if (h > 2) drawTotem(ctx, x, y, h, 1 - sink * 0.6, 0.5 + 0.5 * Math.sin(p * 30 + i));
    }
  });
  c.hit();
  await c.sleep(0.8);
  c.rest();
  await c.dashBack(0.35);
};

// ====================== 仙 · 左慈喵「千幻万象」 ======================
const ultMirror: SkillFx = async (c) => {
  const k = c.caster;
  const [ex, ey] = c.center(c.foes);
  c.scene.focus(lerp(k.x, ex, 0.5), 340, 1.08, 0.5);
  c.pose('cast', 0.25);
  c.glow(k, '#7fe8ff');
  c.vfx.glyph(k.x, k.by, { r: 100, color: '#7fe8ff', life: 2, points: 5 });
  c.tint('#7fe8ff', 0.16, 0.5);
  await c.sleep(0.4);
  // 分身环绕
  const N = 6;
  const base = k.snapshot();
  const state = { spread: 0, go: 0 };
  c.vfx.custom(1.9, (ctx, _p, t) => {
    for (let i = 0; i < N; i++) {
      const ang = (i / N) * 6.283 + t * 3.2;
      const r = state.spread * 74 * (1 - state.go * 0.0);
      const ox = Math.cos(ang) * r * 1.3;
      const oy = Math.sin(ang) * r * 0.45;
      const dx = state.go * (ex - k.x) * (0.6 + 0.1 * i);
      const dy = state.go * (ey - k.y) * 0.5;
      k.drawGhost(ctx, { ...base, x: base.x + ox + dx, y: base.y + oy + dy + Math.sin(t * 6 + i) * 3 }, 0.6 * (1 - state.go * 0.7), '#7fe8ff');
    }
  });
  await c.scene.tween(state, { spread: 1 }, 0.5, 'outBack');
  c.vfx.burst({ x: k.x, y: k.y - 100, n: 26, speed: [60, 260], life: [0.5, 1.0], size: [4, 8], color: ['#bff6ff', '#ffffff', '#7fe8ff'], shape: 'shard', gravity: 90 });
  await c.sleep(0.25);
  // 分身冲向敌阵
  for (const t of c.foes.slice(0, 5)) {
    const [x, y] = t.anchor('chest');
    c.vfx.beam(k.x, k.y - 100, x, y, { color: '#7fe8ff', width: 22, life: 0.35 });
  }
  await c.scene.tween(state, { go: 1 }, 0.35, 'in');
  c.scene.flash('#e6ffff', 0.95);
  c.scene.shake(12, 0.4);
  for (const t of c.foes) {
    const [x, y] = t.anchor('chest');
    c.vfx.ring(x, y, { r1: 100, color: '#7fe8ff', width: 8 });
    c.vfx.burst({ x, y, n: 18, speed: [80, 320], life: [0.4, 0.9], size: [3, 7], color: ['#bff6ff', '#fff'], shape: 'shard', gravity: 200 });
  }
  c.hit();
  await c.sleep(0.5);
  c.rest();
  for (const a of c.allies) {
    const [x, y] = a.anchor('chest');
    c.vfx.custom(1.0, (ctx, p) => {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (1 - p) * 0.8;
      ctx.strokeStyle = '#7fe8ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y, 40 + p * 20, 70 + p * 20, 0, 0, 6.3); ctx.stroke(); ctx.restore();
    });
  }
  await c.sleep(0.6);
};

// ====================== SSR 绝技 ======================
const ultGlaiveWave: SkillFx = async (c) => {
  const k = c.caster;
  const t = c.targets[0];
  c.scene.focus(lerp(k.x, t.x, 0.5), 345, 1.1, 0.4);
  c.pose('windup', 0.25);
  c.glow(k, '#7dffa8');
  c.vfx.glyph(k.x, k.by, { r: 80, color: '#7dffa8', life: 1.0 });
  await c.sleep(0.35);
  await c.pose('strike', 0.07, 'in');
  c.scene.shake(8, 0.3);
  const y = k.y - 100;
  c.vfx.custom(0.8, (ctx, p) => {
    const x = k.x + c.dir * lerp(60, 600, ease.in(p));
    crescentWave(ctx, x, y + 40, 200, 70, '#7dffa8', 1 - ease.in(clamp((p - 0.7) / 0.3)), c.dir);
  });
  await c.sleep(0.4);
  c.scene.flash('#d8ffe8', 0.8);
  for (const tt of c.foes.filter((f) => Math.abs(f.bx - t.bx) < 160)) {
    const [x, yy] = tt.anchor('chest');
    c.vfx.slash(x, yy, { r: 120, a0: -2.5, a1: 0.8, width: 36, color: '#7dffa8', flip: c.dir < 0 });
  }
  c.hit();
  c.vfx.pillar(t.x, t.by, { h: 420, w: 100, color: '#7dffa8', life: 0.6 });
  await c.sleep(0.5);
  c.rest();
};

const ultRoar: SkillFx = async (c) => {
  const k = c.caster;
  const [ex] = c.center(c.foes);
  c.scene.focus(k.x + c.dir * 90, 340, 1.18, 0.35);
  c.pose('castFwd', 0.15);
  await c.pose('windup', 0.2);
  c.glow(k, '#ff8a4a');
  const [hx, hy] = k.anchor('head');
  await c.sleep(0.2);
  c.pose('cast', 0.08);
  c.scene.shake(20, 0.9);
  c.scene.flash('#fff0d0', 0.7);
  for (let i = 0; i < 5; i++) {
    c.vfx.custom(0.9, (ctx, p) => {
      const r = 20 + p * 520;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (1 - p) * 0.8;
      ctx.strokeStyle = '#ffd08a'; ctx.lineWidth = 10 * (1 - p) + 2;
      ctx.beginPath(); ctx.arc(hx, hy, r, c.dir > 0 ? -0.9 : Math.PI - 0.9, c.dir > 0 ? 0.9 : Math.PI + 0.9); ctx.stroke(); ctx.restore();
    });
    await c.sleep(0.1);
  }
  c.vfx.custom(1.0, (ctx, p) => {
    ctx.save(); ctx.translate(ex, 150); ctx.scale(1 + p * 0.2, 1 + p * 0.2); ctx.globalAlpha = 1 - ease.in(p);
    ctx.font = `900 120px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 14; ctx.strokeStyle = '#7a2a10'; ctx.strokeText('吼！', 0, 0);
    ctx.fillStyle = '#ffe08a'; ctx.fillText('吼！', 0, 0); ctx.restore();
  }, 'front');
  await c.sleep(0.2);
  c.hit();
  for (const t of c.foes) c.scene.tween(t.root, { ox: t.root.ox + t.facing * -30 * -1 }, 0.1, 'out').then(() => c.scene.tween(t.root, { ox: 0 }, 0.3, 'out'));
  await c.sleep(0.7);
};

const ultEightArray: SkillFx = async (c) => {
  const k = c.caster;
  const [ex, ey] = c.center(c.foes);
  const [mx, my] = [(k.x + ex) / 2, (k.by + ey) / 2];
  c.scene.focus(mx, 330, 1.05, 0.5);
  c.pose('castFwd', 0.2);
  c.glow(k, '#ffe08a');
  await c.sleep(0.3);
  const R = 250;
  c.vfx.custom(2.0, (ctx, p, t) => {
    const grow = ease.outCubic(clamp(p * 3));
    const fade = p > 0.8 ? 1 - (p - 0.8) / 0.2 : 1;
    ctx.save(); ctx.translate(mx, my + 20); ctx.scale(1, 0.38); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = fade;
    ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(0, 0, R * grow, 0, 6.3); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, R * grow * 0.7, 0, 6.3); ctx.stroke();
    ctx.rotate(t * 0.6);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * 6.283;
      ctx.save(); ctx.rotate(a); ctx.translate(R * grow * 0.85, 0);
      ctx.lineWidth = 4;
      // 八卦爻线
      for (let l = 0; l < 3; l++) { ctx.beginPath(); if ((i >> l) & 1) { ctx.moveTo(-22, l * 12 - 12); ctx.lineTo(22, l * 12 - 12); } else { ctx.moveTo(-22, l * 12 - 12); ctx.lineTo(-5, l * 12 - 12); ctx.moveTo(5, l * 12 - 12); ctx.lineTo(22, l * 12 - 12); } ctx.stroke(); }
      ctx.restore();
    }
    ctx.restore();
  }, 'back');
  // 八道光束汇聚
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * 6.283;
    const sx = mx + Math.cos(a) * R * 0.85;
    const sy = my + 20 + Math.sin(a) * R * 0.85 * 0.38;
    c.vfx.beam(sx, sy, mx, my - 40, { color: '#ffe08a', width: 22, life: 0.6 });
    await c.sleep(0.07);
  }
  c.vfx.pillar(mx, my + 20, { h: 460, w: 140, color: '#ffe08a', life: 0.7 });
  c.scene.flash('#fff6d0', 0.8);
  c.scene.shake(10, 0.4);
  c.hit();
  await c.sleep(0.6);
  c.rest();
  c.uplift(c.allies, '#ffe08a', 'star', 8);
  await c.sleep(0.5);
};

const ultArrowVolley: SkillFx = async (c) => {
  const k = c.caster;
  c.scene.focus(lerp(k.x, c.center(c.foes)[0], 0.4), 340, 1.08, 0.4);
  c.pose('castFwd', 0.2);
  c.glow(k, '#ffd24a');
  await c.sleep(0.3);
  const n = c.hits();
  const [hx, hy] = k.anchor('hand');
  const jobs: Promise<void>[] = [];
  for (let i = 0; i < n; i++) {
    const tg = c.hitTargets(i)[0];
    if (!tg) continue;
    const [tx, ty] = tg.anchor('chest');
    await c.sleep(0.11);
    c.vfx.ring(hx, hy, { r1: 24, color: '#ffd24a', life: 0.25, width: 3 });
    jobs.push((async () => {
      await c.vfx.projectile(hx, hy, tx, ty, { speed: 520, arc: 220, draw: (ctx, x, y, ang) => drawArrow(ctx, x, y, ang), trail: { color: '#ffe08a', size: [2, 4], n: 1 } });
      c.hit(i);
      c.hitSpark(tg, '#ffe08a', 8);
      c.scene.shake(3, 0.1);
    })());
  }
  await Promise.all(jobs);
  await c.sleep(0.3);
};

const ultHerbMist: SkillFx = async (c) => {
  const k = c.caster;
  const mine = c.allies;
  const [cx, cy] = c.center(mine);
  c.scene.focus(cx, 340, 1.1, 0.45);
  c.pose('cast', 0.25);
  c.glow(k, '#9dffb0');
  await c.sleep(0.3);
  const rnd = mulberry(8);
  const puffs = Array.from({ length: 22 }, () => ({ x: (rnd() - 0.5) * 360, y: (rnd() - 0.5) * 70, r: 50 + rnd() * 50, sp: 0.5 + rnd() }));
  c.vfx.custom(2.0, (ctx, p, t) => {
    const a = (p < 0.2 ? p / 0.2 : p > 0.75 ? (1 - p) / 0.25 : 1) * 0.5;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const q of puffs) {
      const g = ctx.createRadialGradient(cx + q.x + Math.sin(t * q.sp) * 14, cy - 20 + q.y, 0, cx + q.x, cy - 20 + q.y, q.r);
      g.addColorStop(0, `rgba(150,255,170,${a})`); g.addColorStop(1, 'rgba(150,255,170,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx + q.x + Math.sin(t * q.sp) * 14, cy - 20 + q.y, q.r, 0, 6.3); ctx.fill();
    }
    ctx.restore();
  });
  for (let i = 0; i < 5; i++) {
    c.uplift(mine, ['#9dffb0', '#e8ffe0'], 'leaf', 4);
    await c.sleep(0.15);
  }
  c.scene.flash('#e8ffe0', 0.4);
  c.rest();
  // 十字
  for (const a of mine) {
    const [x, y] = a.anchor('top');
    c.vfx.custom(1.0, (ctx, p) => {
      ctx.save(); ctx.globalAlpha = 1 - p; ctx.fillStyle = '#9dffb0'; ctx.strokeStyle = '#1f7a3a'; ctx.lineWidth = 2;
      const yy = y - p * 30;
      ctx.beginPath(); ctx.roundRect(x - 4, yy - 12, 8, 24, 2); ctx.roundRect(x - 12, yy - 4, 24, 8, 2); ctx.fill(); ctx.stroke(); ctx.restore();
    });
  }
  await c.sleep(0.9);
};

const ultKnifeStorm: SkillFx = async (c) => {
  const k = c.caster;
  const tg = c.targets;
  c.scene.focus(lerp(k.x, c.center(c.foes)[0], 0.45), 345, 1.1, 0.4);
  c.pose('windup', 0.2);
  c.glow(k, '#ff7a3a');
  const [hx, hy] = k.anchor('chest');
  const state = { spin: 0 };
  c.vfx.custom(1.2, (ctx, p, t) => {
    const n = 6;
    const fade = p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.283 + t * 9;
      ctx.save(); ctx.globalAlpha = fade * (1 - state.spin);
      drawKnife(ctx, hx + Math.cos(a) * 54, hy + Math.sin(a) * 30, a + Math.PI / 2, 1.1);
      ctx.restore();
    }
  });
  c.vfx.burst({ x: hx, y: hy, n: 24, speed: [30, 150], life: [0.5, 1], size: [3, 6], color: ['#ff8a3a', '#ffd06a'], shape: 'ember', gravity: -60, radius: 40 });
  await c.sleep(0.6);
  c.pose('strike', 0.06, 'in');
  state.spin = 1;
  const n = c.hits();
  const jobs: Promise<void>[] = [];
  for (let i = 0; i < Math.max(n, 3); i++) {
    const t = tg[i % tg.length];
    if (!t) continue;
    const [tx, ty] = t.anchor('chest');
    jobs.push((async () => {
      await c.sleep(i * 0.07);
      await c.vfx.projectile(hx, hy, tx, ty, { speed: 1100, arc: (i - 1) * 40, draw: (ctx, x, y, _a, p) => drawKnife(ctx, x, y, p * 25, 1.3), trail: { color: '#ff8a3a', shape: 'ember', size: [3, 6], n: 2 } });
      c.hit(i);
      c.hitSpark(t, '#ff9a4a', 10);
      c.vfx.burst({ x: tx, y: ty, n: 10, speed: [40, 180], angle: -Math.PI / 2, spread: 2, life: [0.4, 0.8], size: [3, 6], color: ['#ff8a3a', '#ffd06a'], shape: 'ember', gravity: -40 });
      c.scene.shake(4, 0.1);
    })());
  }
  await Promise.all(jobs);
  c.scene.flash('#ffb070', 0.4);
  await c.sleep(0.5);
};

// ====================== 注册表 ======================
export const SKILL_FX: Record<string, SkillFx> = {
  'melee.slash': meleeBasic('slash'),
  'melee.glaive': meleeBasic('glaive'),
  'melee.mace': meleeBasic('mace'),
  'melee.pierce': meleeBasic('pierce'),
  'melee.halberd': meleeBasic('halberd'),
  'ranged.bolt': rangedBasic('bolt'),
  'ranged.seal': rangedBasic('seal'),
  'ranged.qin': rangedBasic('qin', 'cast'),
  'ranged.teal': rangedBasic('teal'),
  'ranged.fan': rangedBasic('fan'),
  'ranged.arrow': rangedBasic('arrow'),
  'ranged.knife': rangedBasic('knife'),
  'heal.touch': healTouch,
  'ult.generic': ultGeneric,
  'ult.imperialSeal': ultImperialSeal,
  'ult.peachOath': ultPeachOath,
  'ult.redCliff': ultRedCliff,
  'ult.tianxia': ultTianxia,
  'ult.sevenCapture': ultSevenCapture,
  'ult.mirror': ultMirror,
  'ult.glaiveWave': ultGlaiveWave,
  'ult.roar': ultRoar,
  'ult.eightArray': ultEightArray,
  'ult.arrowVolley': ultArrowVolley,
  'ult.herbMist': ultHerbMist,
  'ult.knifeStorm': ultKnifeStorm,
  ...SKILL_FX2,
  ...SKILL_FX3,
};

export function defaultFx(e: Extract<BEvent, { t: 'act' }>): SkillFx {
  if (e.kind === 'ultimate') return ultGeneric;
  return e.melee ? meleeBasic('slash') : rangedBasic('bolt');
}
export { rad };
