// 绝技插入图：压暗 → 斜切色带 → 立绘滑入 → 技能名毛笔字 → 退出。
import { FACTIONS } from '../data/factions';
import type { FactionId } from '../data/factions';
import type { Scene } from './scene';
import { clamp, ease, hexA, lerp, mulberry } from './util';

export interface CutInOpts { portrait: HTMLCanvasElement; faction: FactionId; skill: string; title: string; name: string; side: 'A' | 'B'; duration?: number }

/** 播放插入图，返回 Promise（动画结束时 resolve）。期间场景时间放慢。 */
export function playCutIn(scene: Scene, o: CutInOpts): Promise<void> {
  const dur = o.duration ?? 1.25;
  const color = FACTIONS[o.faction].color;
  const t0 = { v: 0 };
  const rnd = mulberry(99);
  const lines = Array.from({ length: 26 }, () => ({ y: rnd(), len: 0.2 + rnd() * 0.5, sp: 0.8 + rnd() * 1.6, w: 1 + rnd() * 3, off: rnd() }));
  const dirSign = o.side === 'A' ? 1 : -1;
  const draw = (ctx: CanvasRenderingContext2D) => {
    const p = clamp(t0.v / dur);
    const inP = ease.outCubic(clamp(p / 0.22));
    const outP = ease.in(clamp((p - 0.82) / 0.18));
    const vis = inP * (1 - outP);
    if (vis <= 0.001) return;
    const W = scene.w;
    const H = scene.h;
    const bandH = 250 * vis;
    ctx.save();
    // 压暗
    ctx.fillStyle = `rgba(8,4,16,${0.55 * vis})`;
    ctx.fillRect(0, 0, W, H);
    // 斜切色带
    ctx.translate(W / 2, H * 0.46);
    ctx.rotate(-0.1 * dirSign);
    const g = ctx.createLinearGradient(-W / 2, 0, W / 2, 0);
    g.addColorStop(0, hexA(color, 0)); g.addColorStop(0.15, hexA(color, 0.95)); g.addColorStop(0.85, hexA(color, 0.95)); g.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(-W, -bandH / 2, W * 2, bandH);
    ctx.fillStyle = `rgba(255,255,255,${0.9 * vis})`;
    ctx.fillRect(-W, -bandH / 2 - 5, W * 2, 5);
    ctx.fillRect(-W, bandH / 2, W * 2, 5);
    // 速度线
    ctx.save();
    ctx.beginPath(); ctx.rect(-W, -bandH / 2, W * 2, bandH); ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    for (const l of lines) {
      const x = ((((l.off + t0.v * l.sp * 0.9 * dirSign) % 1) + 1) % 1) * W * 1.4 - W * 0.7;
      ctx.fillStyle = `rgba(255,255,255,${0.35 * vis})`;
      ctx.fillRect(x, (l.y - 0.5) * bandH, l.len * W * 0.5, l.w);
    }
    ctx.restore();
    // 立绘
    const pw = 360;
    const ph = (o.portrait.height / o.portrait.width) * pw;
    const slide = (1 - inP) * 260 * -dirSign + outP * 220 * dirSign;
    const px = (o.side === 'A' ? -W * 0.5 + 40 : W * 0.5 - 40 - pw) + slide + (o.side === 'A' ? 0 : 0);
    ctx.save();
    ctx.beginPath(); ctx.rect(-W, -bandH / 2 - 70, W * 2, bandH + 70); ctx.clip();
    ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 24;
    ctx.globalAlpha = vis;
    ctx.drawImage(o.portrait, px, -ph * 0.62, pw, ph);
    ctx.restore();
    // 技能名
    const tx = o.side === 'A' ? -W * 0.5 + 420 : W * 0.5 - 420;
    const nameP = ease.outBack(clamp((p - 0.1) / 0.25));
    ctx.textAlign = o.side === 'A' ? 'left' : 'right';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = vis;
    ctx.font = '700 22px "Noto Sans SC","WenQuanYi Zen Hei",sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(`${o.title}  ${o.name}`, tx + (1 - nameP) * 80 * -dirSign, -bandH * 0.22);
    ctx.save();
    ctx.translate(tx + (1 - nameP) * 120 * -dirSign, bandH * 0.18);
    ctx.scale(lerp(1.25, 1, nameP), lerp(1.25, 1, nameP));
    const fs = o.skill.length > 6 ? 54 : 70;
    ctx.font = `900 ${fs}px "ZCOOL KuaiLe","Noto Sans SC","WenQuanYi Zen Hei",sans-serif`;
    ctx.lineWidth = 12;
    ctx.strokeStyle = 'rgba(20,10,30,.9)';
    ctx.strokeText(o.skill, 0, 0);
    ctx.lineWidth = 5;
    ctx.strokeStyle = hexA(color, 1);
    ctx.strokeText(o.skill, 0, 0);
    const tg = ctx.createLinearGradient(0, -fs, 0, 0);
    tg.addColorStop(0, '#fffbe0'); tg.addColorStop(1, '#ffd46a');
    ctx.fillStyle = tg;
    ctx.fillText(o.skill, 0, 0);
    ctx.restore();
    ctx.restore();
  };
  scene.overlays.push(draw);
  return new Promise((res) => {
    scene.tween(t0, { v: dur }, dur, 'linear').then(() => {
      scene.overlays.splice(scene.overlays.indexOf(draw), 1);
      res();
    });
  });
}
