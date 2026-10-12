// 采蘑菇小游戏界面：3×3 蘑菇地，蘑菇冒出来又缩回去。规则在 game/mushroom.ts。
import { dailyEgg } from '../../game/pets';
import { dayIndex } from '../../game/premium';
import { CELLS, DURATION, SCORE, makeSchedule, mushroomGain, recordPicked, runsLeft, tierOf, useRun, TIERS } from '../../game/mushroom';
import type { Kind, Spawn } from '../../game/mushroom';
import { gainIcons, starsHtml } from '../../ui/gain';
import { icon } from '../../ui/icons';
import { applyGain } from '../../game/stage';
import { boostGain } from '../../game/featured';
import { sfx } from '../sfx';
import type { AppCtx } from '../ctx';

export const MUSHROOM_CSS = `
.mu-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0}
.mu-cell{position:relative;height:66px;border-radius:14px;background:radial-gradient(#2a4a32,#173022);border:2px solid #3a6a48;overflow:hidden}
.mu-cell i{position:absolute;left:50%;bottom:-40px;width:46px;height:40px;margin-left:-23px;border-radius:50% 50% 8px 8px;transition:bottom .12s;font-style:normal;font-weight:900;font-size:12px;line-height:34px;text-align:center;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.6)}
.mu-cell i::after{content:"";position:absolute;left:50%;top:30px;width:14px;height:20px;margin-left:-7px;border-radius:4px;background:#f0e6d0}
.mu-cell.up i{bottom:12px}
.mu-cell.normal i{background:#d9483b;box-shadow:inset 0 -6px 0 rgba(0,0,0,.18)}
.mu-cell.gold i{background:#ffd24a;color:#5a3a00;text-shadow:none;box-shadow:0 0 14px #ffd24a}
.mu-cell.poison i{background:#8a3ad9;box-shadow:inset 0 -6px 0 rgba(0,0,0,.25)}
.mu-cell.hit{animation:muHit .25s}
@keyframes muHit{50%{transform:scale(.92);background:#3a6a48}}
.mu-hud{display:flex;justify-content:space-between;font-weight:800;font-size:15px}
.mu-hud b{color:#ffe27a;font-size:20px}
.mu-time{height:6px;border-radius:3px;background:rgba(0,0,0,.3);overflow:hidden;margin-top:6px}
.mu-time i{display:block;height:100%;background:#4fe08a;width:100%}
.mu-legend{font-size:12px;font-weight:700;color:#c9b8e8;margin-top:4px}
`;

type Phase = 'idle' | 'play' | 'result';

/** 打开采蘑菇；玩家点「收摊」后结束。 */
export function openMushroom(ctx: AppCtx, host: Element): Promise<void> {
  return new Promise((done) => {
    const ov = document.createElement('div');
    ov.className = 'fish-ov';
    ov.innerHTML = `<div class="fish-card"><h3>🍄 采蘑菇</h3><div class="fish-status"></div><div class="mu-grid"></div><div class="mu-time"><i></i></div><div class="mu-legend"><span style="color:#ff6a5a">🍄</span> +1 &nbsp; <span style="color:#ffd24a">🍄</span> +3 &nbsp; <span style="color:#c08aff">🍄</span> −3</div><div class="fish-info"></div><div class="fish-btns"><button class="btn green" data-mu="main">▶</button><button class="btn ghost" data-mu="close">${icon('close', 18)} 离开</button></div></div>`;
    host.appendChild(ov);
    const q = <T extends Element>(sel: string) => ov.querySelector(sel) as T;
    const status = q<HTMLElement>('.fish-status'), grid = q<HTMLElement>('.mu-grid'), timeBar = q<HTMLElement>('.mu-time i'), info = q<HTMLElement>('.fish-info'), main = q<HTMLButtonElement>('[data-mu="main"]');
    grid.innerHTML = Array.from({ length: CELLS }, (_, i) => `<div class="mu-cell" data-cell="${i}"><i></i></div>`).join('');
    const cells = [...grid.children] as HTMLElement[];
    let phase: Phase = 'idle', raf = 0, t0 = 0, score = 0, picked = 0, plan: Spawn[] = [], next = 0;
    const active = new Map<number, { kind: Kind; until: number }>();

    const refresh = () => { info.innerHTML = `🎮 今日剩余 ${runsLeft(ctx.s)} 局`; };
    const clearCells = () => { active.clear(); for (const c of cells) { c.className = 'mu-cell'; delete c.dataset.kind; c.firstElementChild!.textContent = ''; } };
    const hud = (left: number) => { status.innerHTML = `<div class="mu-hud"><span>⭐ <b>${score}</b></span><span>⏱ ${Math.max(0, Math.ceil(left))}</span></div>`; };
    const idle = () => {
      phase = 'idle'; clearCells(); refresh(); timeBar.style.width = '100%';
      const left = runsLeft(ctx.s) > 0;
      main.disabled = !left; main.innerHTML = left ? '▶ 开始' : '😴 今天玩够啦';
      status.innerHTML = left ? `<span class="mg-big">🍄 👆</span><span class="mg-sub">限时点蘑菇：红 +1、金 +3，紫色毒蘑菇别点（−3）</span><span class="mg-sub">${starsHtml(1, 3, 14)} ${TIERS.join(' / ')}</span>` : '<span class="mg-big">😴</span>';
    };
    const start = () => {
      if (!useRun(ctx.s)) { idle(); return; }
      ctx.save(); clearCells();
      plan = makeSchedule(Math.random); next = 0; score = 0; picked = 0; phase = 'play'; t0 = performance.now();
      main.style.display = 'none'; refresh(); hud(DURATION);
      const tick = (now: number) => {
        if (phase !== 'play') return;
        const t = (now - t0) / 1000;
        while (next < plan.length && plan[next].t <= t) {
          const sp = plan[next++], c = cells[sp.cell];
          c.className = `mu-cell ${sp.kind} up`; c.dataset.kind = sp.kind; c.firstElementChild!.textContent = sp.kind === 'gold' ? '★' : '';
          active.set(sp.cell, { kind: sp.kind, until: t + sp.life });
        }
        for (const [i, a] of active) if (a.until <= t) { active.delete(i); cells[i].className = 'mu-cell'; delete cells[i].dataset.kind; }
        timeBar.style.width = `${Math.max(0, (DURATION - t) / DURATION) * 100}%`;
        hud(DURATION - t);
        if (t >= DURATION) { finish(); return; }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const hitCell = (i: number) => {
      if (phase !== 'play') return;
      const a = active.get(i);
      if (!a) return;
      active.delete(i);
      score += SCORE[a.kind];
      if (a.kind !== 'poison') picked++;
      const c = cells[i]; c.className = 'mu-cell hit'; delete c.dataset.kind;
      if (a.kind === 'poison') sfx.no(); else if (a.kind === 'gold') sfx.up(); else sfx.tap();
    };
    const finish = () => {
      cancelAnimationFrame(raf); raf = 0; clearCells();
      const tier = tierOf(score), g = mushroomGain(ctx.s, tier);
      if (tier > 0) { applyGain(ctx.s, boostGain(ctx.s, g, () => ctx.toast('🌟 今日推荐小游戏：这局奖励翻倍！'))); sfx.coin(); } else sfx.no();
      recordPicked(ctx.s, picked); if (tier === 3 && dailyEgg(ctx.s, dayIndex())) ctx.toast('🥚 三星奖励：获得一颗宠物蛋！'); ctx.save();
      phase = 'result'; main.style.display = ''; main.disabled = runsLeft(ctx.s) <= 0; main.innerHTML = main.disabled ? '😴 今天玩够啦' : '🔁 再来一局';
      status.innerHTML = `${starsHtml(tier)}<div class="mg-sub">⭐ ${score} &nbsp; 🍄 ${picked}</div><div style="margin-top:4px">${tier > 0 ? gainIcons(g, 20) : ''}</div>`;
      refresh();
    };
    const press = () => { if (main.disabled) return; if (phase === 'idle' || phase === 'result') start(); };
    const close = () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); ov.remove(); ctx.save(); done(); };
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); press(); } else if (e.key === 'Escape') close(); };
    ov.addEventListener('pointerdown', (e) => { const c = (e.target as HTMLElement).closest('[data-cell]') as HTMLElement | null; if (c) hitCell(+c.dataset.cell!); });
    ov.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('[data-mu]') as HTMLElement | null;
      if (!b) return;
      if (b.dataset.mu === 'close') close(); else press();
    });
    window.addEventListener('keydown', onKey);
    idle();
  });
}
