// 战技 5 种特效（按职业）+ 合击技 8 种特效（按羁绊）。
// 战技比普攻华丽一档、比绝技短：残影冲锋十字斩 / 护盾穹顶重击 / 天降箭雨 / 符阵落雷 / 圣光花雨。
// 合击技：羁绊成员同时蓄力 → 光束汇聚成一颗大光球 → 砸向对面，全屏闪光 + 主题粒子。
import type { BEvent } from '../engine/types';
import type { Actor } from './actor';
import { POSES } from './actor';
import type { Choreo } from './choreo';
import type { Shape } from './vfx';
import { ease, hexA, lerp } from './util';

type SkillFx = (c: Choreo) => Promise<void>;
type Dmg = Extract<BEvent, { t: 'damage' }>;
const isDmg = (e: BEvent): e is Dmg => e.t === 'damage';
const forTarget = (t: Actor) => (e: BEvent) => (e.t === 'damage' || e.t === 'heal') && e.dst === t.uid;
const light = (c: string) => c;

/** 大光球：在 (x,y) 处从 0 长到 r，带旋转的光芒 */
function orb(c: Choreo, x: number, y: number, r: number, color: string, life: number) {
  c.vfx.custom(life, (ctx, p, t) => {
    const k = ease.outCubic(Math.min(1, p * 1.4)) * (p > 0.85 ? 1 - (p - 0.85) / 0.15 : 1);
    const R = r * k;
    if (R < 1) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, R * 1.6);
    g.addColorStop(0, '#fff6e0'); g.addColorStop(0.22, color); g.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R * 1.35, 0, 6.3); ctx.fill();
    ctx.translate(x, y); ctx.rotate(t * 3);
    ctx.fillStyle = hexA(color, 0.55);
    for (let i = 0; i < 8; i++) { ctx.rotate(Math.PI / 4); ctx.beginPath(); ctx.moveTo(R * 0.4, -4); ctx.lineTo(R * 1.9, 0); ctx.lineTo(R * 0.4, 4); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  });
}

// ====================== 战技 ======================
/** 先锋 / 刺客：残影冲锋 → 十字斩 → 冲击环 */
const tacRush: SkillFx = async (c) => {
  const t = c.targets[0];
  const flip = c.dir < 0;
  await c.dashTo(t, 54, 0.17);
  await c.pose('windup', 0.09);
  c.glow(c.caster, c.color);
  await c.pose('strike', 0.05, 'in');
  const [x, y] = t.anchor('chest');
  c.vfx.slash(x - c.dir * 8, y + 14, { r: 104, a0: -2.5, a1: 0.7, width: 30, color: c.color, flip });
  await c.sleep(0.07);
  c.vfx.slash(x - c.dir * 8, y - 6, { r: 104, a0: 0.7, a1: -2.5, width: 30, color: '#ffffff', flip });
  c.hit(0);
  c.hitSpark(t, c.color, 16);
  c.vfx.ring(x, t.by, { r0: 10, r1: 150, life: 0.45, color: c.color, width: 8, squash: 0.35 });
  c.vfx.burst({ x, y: t.by, n: 14, speed: [80, 260], angle: -Math.PI / 2, spread: 1.8, life: [0.3, 0.7], size: [3, 7], color: [c.color, '#fff'], shape: 'shard', gravity: 420, additive: false });
  c.scene.shake(6, 0.16);
  c.scene.flash(c.color, 0.18);
  await c.sleep(0.16);
  c.hit();
  await c.dashBack();
};

/** 守护：护盾穹顶升起 → 重击地面震波 */
const tacGuard: SkillFx = async (c) => {
  const k = c.caster, t = c.targets[0];
  await c.pose('guard', 0.14);
  c.glow(k, c.color);
  const [kx, ky] = k.anchor('chest');
  c.vfx.ring(k.x, k.by, { r0: 20, r1: 110, life: 0.6, color: c.color, width: 7, squash: 0.35 });
  c.vfx.custom(0.9, (ctx, p) => {
    const g = ease.outCubic(Math.min(1, p * 2.2)) * (p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = hexA(c.color, 0.9 * g); ctx.lineWidth = 5; ctx.fillStyle = hexA(c.color, 0.16 * g);
    ctx.beginPath(); ctx.ellipse(kx, ky + 20, 78 * g, 96 * g, 0, Math.PI, 0); ctx.fill(); ctx.stroke();
    for (let i = 1; i < 4; i++) { ctx.globalAlpha = 0.5 * g; ctx.beginPath(); ctx.ellipse(kx, ky + 20, 78 * g * (i / 4), 96 * g, 0, Math.PI, 0); ctx.stroke(); }
    ctx.restore();
  }, 'front');
  await c.sleep(0.35);
  await c.dashTo(t, 62, 0.18);
  await c.pose('windup', 0.1);
  await c.pose('strike', 0.05, 'in');
  const [x] = t.anchor('chest');
  c.vfx.ring(x, t.by, { r0: 8, r1: 190, life: 0.55, color: '#ffe08a', width: 10, squash: 0.3 });
  c.vfx.ring(x, t.by, { r0: 8, r1: 120, life: 0.4, color: '#ffffff', width: 5, squash: 0.3 });
  c.vfx.burst({ x, y: t.by, n: 18, speed: [80, 300], angle: -Math.PI / 2, spread: 2.2, life: [0.4, 0.9], size: [4, 8], color: ['#c9a063', '#8a6a3a', '#fff'], shape: 'shard', gravity: 520, additive: false });
  c.hit(0);
  c.scene.shake(9, 0.22);
  await c.sleep(0.2);
  c.hit();
  await c.dashBack();
};

/** 神射：天降箭雨（每个目标一支从斜上方落下的光箭，带拖尾） */
const tacVolley: SkillFx = async (c) => {
  await c.pose('windupLow', 0.1);
  c.glow(c.caster, c.color);
  const [fx, fy] = c.caster.anchor('hand');
  c.vfx.burst({ x: fx, y: fy, n: 12, speed: [30, 120], life: [0.4, 0.8], size: [3, 6], color: [c.color, '#fff'], shape: 'star', gravity: -40 });
  await c.pose('castUp', 0.13);
  const tg = c.targets.length ? c.targets : c.foes;
  await Promise.all(tg.map(async (t, i) => {
    await c.sleep(0.08 + i * 0.12);
    const [tx, ty] = t.anchor('chest');
    const sx = tx - c.dir * 220, sy = ty - 420;
    await c.vfx.projectile(sx, sy, tx, ty, {
      speed: 1500,
      draw: (ctx, x, y) => {
        const a = Math.atan2(ty - sy, tx - sx);
        ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createLinearGradient(-90, 0, 14, 0); g.addColorStop(0, hexA(c.color, 0)); g.addColorStop(1, '#ffffff');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-90, -2); ctx.lineTo(10, -4); ctx.lineTo(24, 0); ctx.lineTo(10, 4); ctx.lineTo(-90, 2); ctx.closePath(); ctx.fill();
        ctx.restore();
      },
      trail: { color: c.color, shape: 'glow', size: [3, 6], n: 2 },
    });
    c.where(forTarget(t));
    c.hitSpark(t, c.color, 12);
    c.vfx.ring(tx, t.by, { r0: 6, r1: 70, life: 0.3, color: c.color, width: 5, squash: 0.35 });
    c.scene.shake(3, 0.08);
  }));
  c.scene.flash(c.color, 0.12);
  await c.sleep(0.2);
};

/** 谋士：脚下符阵 → 敌阵上空落雷柱 */
const tacSpell: SkillFx = async (c) => {
  const k = c.caster;
  await c.pose('cast', 0.16);
  c.glow(k, c.color);
  c.vfx.glyph(k.x, k.by, { r: 80, color: c.color, life: 1.1, points: 5 });
  await c.sleep(0.3);
  await c.pose('castFwd', 0.1);
  const tg = c.targets.length ? c.targets : c.foes;
  for (const t of tg) c.vfx.glyph(t.x, t.by, { r: 70, color: c.color, life: 0.9, points: 6, spin: -3 });
  await c.sleep(0.25);
  await Promise.all(tg.map(async (t, i) => {
    await c.sleep(i * 0.09);
    const [tx, ty] = t.anchor('chest');
    c.vfx.bolt(tx + (i % 2 ? 24 : -24), ty - 520, tx, ty, { color: c.color, width: 6, segs: 10, jitter: 38 });
    c.vfx.pillar(tx, t.by, { h: 420, w: 64, color: c.color, life: 0.5 });
    c.where(forTarget(t));
    c.hitSpark(t, c.color, 12);
    c.scene.shake(3, 0.1);
  }));
  c.scene.flash(c.color, 0.2);
  await c.sleep(0.22);
};

/** 医者：圣光花雨：每个受治疗者脚下升起光柱，花瓣与星点向上飘 */
const tacBless: SkillFx = async (c) => {
  await c.pose('cast', 0.15);
  c.glow(c.caster, '#9dffb0');
  const tg = c.targets.length ? c.targets : c.allies;
  await c.sleep(0.12);
  await Promise.all(tg.map(async (t, i) => {
    await c.sleep(i * 0.1);
    c.vfx.pillar(t.x, t.by, { h: 300, w: 70, color: '#b8ffc4', life: 0.8 });
    c.vfx.ring(t.x, t.by, { r0: 10, r1: 90, life: 0.6, color: '#b8ffc4', width: 6, squash: 0.35 });
    const [x, y] = t.anchor('foot');
    c.vfx.burst({ x, y: y - 10, n: 16, speed: [20, 90], angle: -Math.PI / 2, spread: 1.4, life: [0.8, 1.5], size: [5, 9], color: ['#ffd1e8', '#fff', '#b8ffc4'], shape: 'petal', gravity: -50, radius: 40 });
    c.where(forTarget(t));
  }));
  c.uplift(tg, ['#fff6a0', '#b8ffc4'], 'star', 10);
  c.scene.flash('#b8ffc4', 0.14);
  await c.sleep(0.3);
};

// ====================== 合击技 ======================
interface Theme { color: string; accent: string; shape: Shape; shape2: Shape; boom: 'slash' | 'pillars' | 'bolts' | 'bloom' }
const THEMES: Record<string, Theme> = {
  'combo.oath': { color: '#ff7aa8', accent: '#ffe08a', shape: 'petal', shape2: 'star', boom: 'slash' },
  'combo.fire': { color: '#ff7a3a', accent: '#ffd06a', shape: 'ember', shape2: 'spark', boom: 'pillars' },
  'combo.imperial': { color: '#4f8aff', accent: '#ffe08a', shape: 'coin', shape2: 'spark', boom: 'bolts' },
  'combo.charm': { color: '#d86aff', accent: '#ffb8e8', shape: 'petal', shape2: 'star', boom: 'bloom' },
  'combo.beasts': { color: '#5fb85a', accent: '#d8ff9a', shape: 'leaf', shape2: 'shard', boom: 'slash' },
  'combo.stars': { color: '#7a8aff', accent: '#e8e0ff', shape: 'star', shape2: 'glow', boom: 'bolts' },
  'combo.bloom': { color: '#6adf9a', accent: '#ffd1e8', shape: 'petal', shape2: 'star', boom: 'bloom' },
  'combo.tiger': { color: '#ff9a3a', accent: '#fff0b0', shape: 'ember', shape2: 'shard', boom: 'slash' },
};

function comboFx(th: Theme): SkillFx {
  return async (c) => {
    const members = (c.act as unknown as { members?: Actor[] }).members ?? [c.caster];
    const heal = !c.batch.some(isDmg);
    const foes = heal ? c.allies : c.foes;
    const [cx0, cy0] = c.center(foes);
    const topY = cy0 - 250;
    // 1) 成员同时蓄力：脚下符阵 + 光柱
    for (const m of members) {
      m.poseTo(POSES.castUp, 0.2, 'out');
      c.glow(m, th.color);
      c.vfx.glyph(m.x, m.by, { r: 86, color: th.color, life: 1.6, points: 6 });
      c.vfx.pillar(m.x, m.by, { h: 330, w: 70, color: th.color, life: 0.9 });
      const [hx, hy] = m.anchor('hand');
      c.vfx.burst({ x: hx, y: hy, n: 10, speed: [20, 100], life: [0.5, 1], size: [3, 6], color: [th.color, th.accent, '#fff'], shape: th.shape2, gravity: -40 });
    }
    c.scene.shake(3, 0.4);
    await c.sleep(0.55);
    // 2) 光束汇聚到敌阵上空的光球
    for (const m of members) { const [hx, hy] = m.anchor('top'); c.vfx.beam(hx, hy, cx0, topY, { color: th.color, width: 14, life: 0.5 }); }
    orb(c, cx0, topY, 56, th.color, 0.95);
    c.vfx.ring(cx0, topY, { r0: 20, r1: 180, life: 0.6, color: th.accent, width: 6 });
    await c.sleep(0.55);
    // 3) 砸下
    c.scene.flash(th.color, 0.3);
    c.scene.shake(12, 0.35);
    const tg = c.targets.length ? c.targets : foes;
    await Promise.all(tg.map(async (t, i) => {
      await c.sleep(i * 0.06);
      const [tx, ty] = t.anchor('chest');
      c.vfx.beam(cx0, topY, tx, ty, { color: th.color, width: 18, life: 0.28 });
      if (th.boom === 'slash') { c.vfx.slash(tx, ty + 6, { r: 110, a0: -2.6, a1: 0.8, width: 34, color: th.color }); c.vfx.slash(tx, ty - 8, { r: 110, a0: 0.8, a1: -2.6, width: 28, color: '#ffffff', flip: true }); }
      if (th.boom === 'pillars') { c.vfx.pillar(tx, t.by, { h: 460, w: 90, color: th.color, life: 0.7 }); c.vfx.pillar(tx - 26, t.by, { h: 320, w: 44, color: th.accent, life: 0.6 }); }
      if (th.boom === 'bolts') { c.vfx.bolt(tx + 20, ty - 560, tx, ty, { color: th.accent, width: 7, segs: 11, jitter: 40 }); c.vfx.ring(tx, t.by, { r0: 8, r1: 120, life: 0.4, color: th.color, width: 7, squash: 0.35 }); }
      if (th.boom === 'bloom') { c.vfx.ring(tx, ty, { r0: 8, r1: 140, life: 0.5, color: th.color, width: 8 }); c.vfx.burst({ x: tx, y: ty, n: 22, speed: [60, 240], life: [0.6, 1.2], size: [6, 11], color: [th.color, th.accent, '#fff'], shape: 'petal', gravity: 60 }); }
      c.vfx.burst({ x: tx, y: ty, n: 20, speed: [120, 420], life: [0.3, 0.8], size: [3, 8], color: [th.color, th.accent, '#fff'], shape: th.shape, gravity: 120, drag: 0.93 });
      c.where(forTarget(t));
      c.hitSpark(t, th.color, 16);
    }));
    c.vfx.ring(cx0, cy0 + 30, { r0: 20, r1: 420, life: 0.7, color: th.color, width: 12, squash: 0.3 });
    c.scene.flash(th.color, 0.35);
    await c.sleep(0.5);
    void light; void lerp;
  };
}

export const SKILL_FX_TACTICS: Record<string, SkillFx> = {
  'tac.rush': tacRush,
  'tac.guard': tacGuard,
  'tac.volley': tacVolley,
  'tac.spell': tacSpell,
  'tac.bless': tacBless,
  ...Object.fromEntries(Object.entries(THEMES).map(([id, th]) => [id, comboFx(th)])),
};
export const COMBO_COLORS: Record<string, string> = Object.fromEntries(Object.entries(THEMES).map(([id, th]) => [id, th.color]));
