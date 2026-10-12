// 宠物技特效：小猫从队伍后面蹦出来，亮出脚下的爪印符阵，然后按类型放技能。
// 治疗 / 护盾 / 增益 / 蓄能落在友方身上；扑击 / 雷击 / 火球 / 减益落在敌方身上。
// 宠物自己不在 actors 里（不会被选为目标），由 Player.doPet 临时召出和收回。
import type { BEvent } from '../engine/types';
import type { Actor } from './actor';
import { POSES } from './actor';
import type { Choreo } from './choreo';
import { hexA } from './util';

type SkillFx = (c: Choreo) => Promise<void>;
const forTarget = (t: Actor) => (e: BEvent) => (e.t === 'damage' || e.t === 'heal' || e.t === 'shield' || e.t === 'status' || e.t === 'energy') && ((e as { dst?: number }).dst === t.uid || (e as { uid?: number }).uid === t.uid);

/** 小猫登场：爪印符阵 + 一蹦 */
async function intro(c: Choreo, color: string) {
  const k = c.caster;
  c.vfx.glyph(k.x, k.by, { r: 54, color, life: 1.3, points: 5 });
  c.vfx.ring(k.x, k.by, { r0: 6, r1: 70, life: 0.45, color, width: 5, squash: 0.35 });
  c.glow(k, color);
  k.poseTo(POSES.castUp, 0.14, 'out');
  await c.jump(46, 0.34);
}

function allyFx(color: string, accent: string, shape: 'petal' | 'star' | 'glow' | 'note', kind: 'heal' | 'shield' | 'buff' | 'energy'): SkillFx {
  return async (c) => {
    await intro(c, color);
    const tg = c.targets.length ? c.targets : c.allies;
    const [hx, hy] = c.caster.anchor('top');
    await Promise.all(tg.map(async (t, i) => {
      await c.sleep(i * 0.07);
      const [x, y] = t.anchor('chest');
      c.vfx.beam(hx, hy, x, y, { color, width: 8, life: 0.28 });
      c.vfx.burst({ x, y, n: 16, speed: [30, 140], angle: -Math.PI / 2, spread: 1.6, life: [0.6, 1.2], size: [4, 9], color: [color, accent, '#fff'], shape, gravity: -50, drag: 0.97 });
      if (kind === 'shield') {
        c.vfx.custom(0.9, (ctx, p) => {
          const g = Math.min(1, p * 4) * (p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1);
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = hexA(color, 0.9 * g); ctx.fillStyle = hexA(color, 0.18 * g); ctx.lineWidth = 4;
          ctx.beginPath(); ctx.ellipse(x, y + 10, 52 * g, 70 * g, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
        }, 'front');
      } else if (kind === 'buff' || kind === 'energy') {
        c.vfx.pillar(x, t.by, { h: 260, w: 54, color, life: 0.6 });
      } else {
        c.vfx.ring(x, t.by, { r0: 8, r1: 80, life: 0.55, color, width: 6, squash: 0.35 });
      }
      c.where(forTarget(t));
    }));
    await c.sleep(0.5);
  };
}

function foeFx(color: string, accent: string, how: 'strike' | 'bolt' | 'fire' | 'debuff'): SkillFx {
  return async (c) => {
    await intro(c, color);
    const tg = c.targets.length ? c.targets : c.foes.slice(0, 1);
    const first = tg[0];
    if (how === 'strike') {
      await c.dashTo(first, 54, 0.16);
      await c.pose('windup', 0.08);
      await c.pose('strike', 0.05, 'in');
      for (const t of tg) {
        const [x, y] = t.anchor('chest');
        for (let i = 0; i < 3; i++) c.vfx.slash(x + (i - 1) * 10, y + (i - 1) * 8, { r: 80, a0: -2.4 + i * 0.1, a1: 0.5, width: 18, color: i === 1 ? '#ffffff' : color, flip: c.dir < 0 });
        c.vfx.burst({ x, y, n: 12, speed: [80, 260], life: [0.2, 0.5], size: [3, 6], color: [color, accent, '#fff'], shape: 'spark', drag: 0.9 });
        c.where(forTarget(t));
        c.hitSpark(t, color, 12);
      }
      c.scene.shake(5, 0.14);
      await c.sleep(0.2);
      await c.dashBack();
      return;
    }
    const [hx, hy] = c.caster.anchor('hand');
    await c.pose('strike', 0.08);
    await Promise.all(tg.map(async (t, i) => {
      await c.sleep(i * 0.08);
      const [x, y] = t.anchor('chest');
      if (how === 'bolt') {
        c.vfx.bolt(x + 30, y - 520, x, y, { color: accent, width: 6, segs: 10, jitter: 36 });
        c.vfx.ring(x, t.by, { r0: 8, r1: 100, life: 0.4, color, width: 6, squash: 0.35 });
        c.scene.flash(color, 0.12);
      } else if (how === 'fire') {
        await c.vfx.projectile(hx, hy, x, y, { speed: 900, arc: 60, draw: (ctx, px, py) => { const g = ctx.createRadialGradient(px, py, 0, px, py, 26); g.addColorStop(0, '#fff6d0'); g.addColorStop(0.4, color); g.addColorStop(1, hexA(color, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, 26, 0, 6.3); ctx.fill(); }, trail: { color, shape: 'ember', n: 2 } });
        c.vfx.ring(x, y, { r0: 8, r1: 110, life: 0.4, color, width: 8 });
        c.vfx.burst({ x, y, n: 22, speed: [80, 320], life: [0.3, 0.8], size: [4, 9], color: [color, accent, '#fff'], shape: 'ember', gravity: 160, drag: 0.93 });
      } else {
        c.vfx.beam(hx, hy, x, y, { color, width: 10, life: 0.3 });
        c.vfx.burst({ x, y, n: 18, speed: [20, 120], angle: -Math.PI / 2, spread: 1.8, life: [0.8, 1.4], size: [4, 8], color: [color, accent], shape: 'glow', gravity: -30 });
        c.vfx.glyph(x, t.by, { r: 56, color, life: 1.1, points: 4 });
      }
      c.where(forTarget(t));
      c.hitSpark(t, color, 10);
    }));
    c.scene.shake(4, 0.14);
    await c.sleep(0.45);
  };
}

export const SKILL_FX_PETS: Record<string, SkillFx> = {
  'pet.heal': allyFx('#7affb0', '#fff0a8', 'petal', 'heal'),
  'pet.shield': allyFx('#9ad8ff', '#ffffff', 'star', 'shield'),
  'pet.buff': allyFx('#ffd24a', '#fff7d0', 'star', 'buff'),
  'pet.energy': allyFx('#ff9ad0', '#ffe0f0', 'note', 'energy'),
  'pet.strike': foeFx('#ffb04a', '#fff0c0', 'strike'),
  'pet.bolt': foeFx('#8ab8ff', '#e8f4ff', 'bolt'),
  'pet.fire': foeFx('#ff7a3a', '#ffd88a', 'fire'),
  'pet.debuff': foeFx('#b07aff', '#e8d0ff', 'debuff'),
};
