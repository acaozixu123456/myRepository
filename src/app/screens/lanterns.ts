// 点灯小游戏界面：3×3 宫灯，点一盏翻转它和上下左右，全部点亮过关。规则在 game/lanterns.ts。
import { dailyEgg } from '../../game/pets';
import { dayIndex } from '../../game/premium';
import { CELLS, PUZZLES, lanternGain, lit, makePuzzle, recordSolved, runsLeft, solved, stars, tap, useRun } from '../../game/lanterns';
import type { Puzzle } from '../../game/lanterns';
import { gainIcons, starsHtml } from '../../ui/gain';
import { icon } from '../../ui/icons';
import { applyGain } from '../../game/stage';
import { boostGain } from '../../game/featured';
import { sfx } from '../sfx';
import type { AppCtx } from '../ctx';

export const LANTERN_CSS = `
.ln-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;width:210px;margin:10px auto}
.ln-cell{aspect-ratio:1;border-radius:16px;border:2px solid #5a3a1a;background:#1c1226;font-size:34px;line-height:1;display:grid;place-items:center;transition:background .15s,box-shadow .15s;touch-action:manipulation}
.ln-cell.on{background:radial-gradient(#ffd24a,#d9483b);box-shadow:0 0 16px rgba(255,190,70,.8);border-color:#ffe27a}
.ln-cell:not(.on) i{opacity:.28;filter:grayscale(1)}
.ln-cell i{font-style:normal}
.ln-dots{display:flex;gap:8px;justify-content:center;font-size:15px;margin-top:2px}
.ln-dots b{opacity:.3;font-weight:400}.ln-dots b.cur{opacity:1}.ln-dots b.ok{opacity:1;color:#8affb0}
.ln-moves{font-weight:800;font-size:15px;margin-top:4px}
.ln-moves .par{opacity:.6}
`;

type Phase = 'idle' | 'play' | 'result';

/** 打开点灯；玩家点关闭后结束。 */
export function openLanterns(ctx: AppCtx, host: Element): Promise<void> {
  return new Promise((done) => {
    const ov = document.createElement('div');
    ov.className = 'fish-ov';
    ov.innerHTML = `<div class="fish-card"><h3>🏮 点灯谜题</h3><div class="fish-status"></div><div class="ln-grid"></div><div class="ln-moves"></div><div class="fish-info"></div><div class="fish-btns"><button class="btn green" data-ln="main">▶</button><button class="btn blue" data-ln="reset" style="display:none">🔄 重来</button><button class="btn ghost" data-ln="close">${icon('close', 18)} 离开</button></div></div>`;
    host.appendChild(ov);
    const q = <T extends Element>(sel: string) => ov.querySelector(sel) as T;
    const status = q<HTMLElement>('.fish-status'), grid = q<HTMLElement>('.ln-grid'), movesEl = q<HTMLElement>('.ln-moves'), info = q<HTMLElement>('.fish-info'), main = q<HTMLButtonElement>('[data-ln="main"]'), reset = q<HTMLButtonElement>('[data-ln="reset"]');
    grid.innerHTML = Array.from({ length: CELLS }, (_, i) => `<button class="ln-cell" data-cell="${i}"><i>🏮</i></button>`).join('');
    const cells = [...grid.children] as HTMLElement[];
    let phase: Phase = 'idle', level = 1, puzzle: Puzzle, state = 0, moves = 0, extra = 0, solvedN = 0;

    const draw = () => cells.forEach((c, i) => c.classList.toggle('on', lit(state, i)));
    const dots = (cur: number) => `<div class="ln-dots">${Array.from({ length: PUZZLES }, (_, i) => `<b class="${i + 1 < cur ? 'ok' : i + 1 === cur ? 'cur' : ''}">${i + 1 < cur ? '✔' : '●'}</b>`).join('')}</div>`;
    const refresh = () => { info.innerHTML = `🎮 今日剩余 ${runsLeft(ctx.s)} 局`; movesEl.innerHTML = phase === 'play' ? `👆 ${moves} <span class="par">/ ⭐ ${puzzle.par}</span>` : ''; };
    const idle = () => {
      phase = 'idle'; state = 0; draw(); reset.style.display = 'none'; main.style.display = '';
      const left = runsLeft(ctx.s) > 0;
      main.disabled = !left; main.innerHTML = left ? '▶ 开始' : '😴 今天玩够啦';
      status.innerHTML = `<span class="mg-big">${left ? '🏮➜🏮🏮🏮' : '😴'}</span>${left ? '<span class="mg-sub">点一盏灯会翻转它和上下左右的灯，把所有灯点亮；步数越少星越多</span>' : ''}`;
      refresh();
    };
    const startPuzzle = () => {
      puzzle = makePuzzle(level, Math.random); state = puzzle.start; moves = 0; phase = 'play';
      status.innerHTML = dots(level); main.style.display = 'none'; reset.style.display = ''; draw(); refresh();
    };
    const start = () => { if (!useRun(ctx.s)) { idle(); return; } ctx.save(); level = 1; extra = 0; solvedN = 0; startPuzzle(); };
    const press = (i: number) => {
      if (phase !== 'play') return;
      state = tap(state, i); moves++; sfx.tap(); draw(); refresh();
      if (solved(state)) {
        solvedN++; extra += Math.max(0, moves - puzzle.par); sfx.coin();
        if (level >= PUZZLES) { setTimeout(finish, 450); phase = 'result'; return; }
        level++; phase = 'result';
        setTimeout(() => { if (alive) startPuzzle(); }, 600);
      }
    };
    let alive = true;
    const finish = () => {
      const st = stars(true, extra), g = lanternGain(ctx.s, st);
      applyGain(ctx.s, boostGain(ctx.s, g, () => ctx.toast('🌟 今日推荐小游戏：这局奖励翻倍！'))); recordSolved(ctx.s, solvedN); if (st === 3 && dailyEgg(ctx.s, dayIndex())) ctx.toast('🥚 三星奖励：获得一颗宠物蛋！'); ctx.save(); sfx.up();
      phase = 'result'; reset.style.display = 'none'; main.style.display = ''; main.disabled = runsLeft(ctx.s) <= 0; main.innerHTML = main.disabled ? '😴 今天玩够啦' : '🔁 再来一局';
      status.innerHTML = `${starsHtml(st)}<div class="mg-sub" style="margin-top:6px">${gainIcons(g, 20)}</div>`;
      state = 0b111111111; draw(); movesEl.innerHTML = extra === 0 ? '🏆' : `➕ ${extra}`; refresh();
    };
    const close = () => { alive = false; window.removeEventListener('keydown', onKey); ov.remove(); ctx.save(); done(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); else if ((e.code === 'Space' || e.key === 'Enter') && phase !== 'play') { e.preventDefault(); if (!main.disabled && main.style.display !== 'none') start(); } };
    ov.addEventListener('click', (e) => {
      const el = e.target as HTMLElement;
      const c = el.closest('[data-cell]') as HTMLElement | null;
      if (c) { press(+c.dataset.cell!); return; }
      const b = el.closest('[data-ln]') as HTMLElement | null;
      if (!b) return;
      if (b.dataset.ln === 'close') close();
      else if (b.dataset.ln === 'reset') { if (phase === 'play') { state = puzzle.start; moves = 0; draw(); refresh(); } }
      else if (!main.disabled) start();
    });
    window.addEventListener('keydown', onKey);
    idle();
  });
}
