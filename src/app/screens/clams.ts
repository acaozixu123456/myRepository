// 赶海挖蛤蜊界面（椰风海湾东侧滩涂）：6×6 的湿沙地，点一格挖下去；空沙会冒出气泡（= 周围蛤蜊数），靠气泡推理。规则在 game/clams.ts。
import { dailyEgg } from '../../game/pets';
import { dayIndex } from '../../game/premium';
import { ALL_BONUS, CLAMS, CRABS, CRAB_COST, DIGS, SIZE, TIERS, bubbles, clamsGain, dig, newBeach, recordClams, runsLeft, scoreOf, tierOf, useRun } from '../../game/clams';
import type { Beach } from '../../game/clams';
import { gainIcons, starsHtml } from '../../ui/gain';
import { icon } from '../../ui/icons';
import { applyGain } from '../../game/stage';
import { boostGain } from '../../game/featured';
import { sfx } from '../sfx';
import type { AppCtx } from '../ctx';

export const CLAMS_CSS = `
.cl-hud{display:flex;justify-content:space-between;align-items:center;font-weight:800;font-size:14px}
.cl-hud b{color:#ffe27a;font-size:18px}
.cl-tide{height:8px;border-radius:4px;background:rgba(0,0,0,.3);overflow:hidden;margin-top:4px}
.cl-tide i{display:block;height:100%;background:linear-gradient(90deg,#7ff0ff,#2ab0d8);width:100%;transition:width .2s}
.cl-board{display:grid;grid-template-columns:repeat(${SIZE},1fr);gap:4px;margin:8px auto;padding:8px;border-radius:14px;background:linear-gradient(#b89a70,#9a7a52);box-shadow:inset 0 0 14px rgba(0,0,0,.3);max-width:340px}
.cl-board button{aspect-ratio:1;border:0;border-radius:8px;background:radial-gradient(circle at 35% 30%,#e8cfa0,#c8a878);font-size:22px;font-weight:900;color:#2a6a8a;display:flex;align-items:center;justify-content:center;padding:0;touch-action:manipulation;box-shadow:0 2px 0 rgba(0,0,0,.2)}
.cl-board button.dug{background:#8a6a48;box-shadow:inset 0 2px 5px rgba(0,0,0,.45)}
.cl-board button.clam{background:radial-gradient(circle,#fff4e0,#e8c8a0)}
.cl-board button.crab{background:radial-gradient(circle,#ffb0a0,#d86a5a)}
.cl-board button .bub{font-size:14px;color:#bff4ff;text-shadow:0 1px 2px rgba(0,0,0,.6)}
.cl-board button.pop{animation:cl-pop .25s}
@keyframes cl-pop{50%{transform:scale(1.18)}}
.cl-note{min-height:20px;font-weight:800;font-size:13px;color:#ffe9a0}
`;

type Phase = 'idle' | 'play' | 'result';

/** 打开赶海挖蛤蜊；玩家点「离开」后结束。 */
export function openClams(ctx: AppCtx, host: Element): Promise<void> {
  return new Promise((done) => {
    const ov = document.createElement('div');
    ov.className = 'fish-ov';
    ov.innerHTML = `<div class="fish-card" style="width:min(400px,94%)"><h3>🦪 赶海挖蛤蜊</h3><div class="cl-hud"></div><div class="cl-tide"><i></i></div><div class="cl-board"></div><div class="cl-note"></div><div class="fish-info"></div><div class="fish-btns"><button class="btn green" data-cl="main">▶</button><button class="btn ghost" data-cl="close">${icon('close', 18)} 离开</button></div></div>`;
    host.appendChild(ov);
    const q = <T extends Element>(sel: string) => ov.querySelector(sel) as T;
    const hud = q<HTMLElement>('.cl-hud'), board = q<HTMLElement>('.cl-board'), tide = q<HTMLElement>('.cl-tide i'), note = q<HTMLElement>('.cl-note'), info = q<HTMLElement>('.fish-info'), main = q<HTMLButtonElement>('[data-cl="main"]');
    let phase: Phase = 'idle', b: Beach = newBeach(Math.random);

    const refresh = () => { info.innerHTML = `🎮 今日剩余 ${runsLeft(ctx.s)} 局`; };
    const refreshHud = () => { hud.innerHTML = `<span>🦪 <b>${b.found}</b> / ${CLAMS}</span><span>⭐ <b>${scoreOf(b)}</b></span><span>🪣 剩 <b>${b.digs}</b> 铲</span>`; tide.style.width = `${(b.digs / DIGS) * 100}%`; };
    const cellHtml = (i: number) => {
      const reveal = b.dug[i] || (phase === 'result' && b.cells[i] !== 'sand');
      if (!reveal) return '';
      if (b.cells[i] === 'clam') return b.dug[i] ? '🦪' : '<span style="opacity:.45">🦪</span>';
      if (b.cells[i] === 'crab') return b.dug[i] ? '🦀' : '<span style="opacity:.45">🦀</span>';
      const n = bubbles(b, i);
      return n ? `<span class="bub">${'🫧'.repeat(Math.min(n, 3))}${n > 3 ? n : ''}</span>` : '';
    };
    const render = () => {
      board.innerHTML = b.cells.map((c, i) => `<button data-i="${i}" class="${b.dug[i] ? `dug${c !== 'sand' ? ` ${c}` : ''}` : ''}" ${phase !== 'play' || b.dug[i] ? 'disabled' : ''} aria-label="第 ${Math.floor(i / SIZE) + 1} 行第 ${(i % SIZE) + 1} 格">${cellHtml(i)}</button>`).join('');
      refreshHud();
    };
    const idle = () => {
      phase = 'idle'; b = newBeach(Math.random); refresh(); render();
      const ok = runsLeft(ctx.s) > 0;
      main.style.display = ''; main.disabled = !ok; main.innerHTML = ok ? '▶ 下滩' : '😴 今天玩够啦';
      note.innerHTML = ok ? `沙里埋着 ${CLAMS} 只蛤蜊和 ${CRABS} 只螃蟹，共 ${DIGS} 铲。挖到空沙会冒气泡：🫧 的个数 = 周围 8 格的蛤蜊数。挖到螃蟹会被夹，多扣 ${CRAB_COST} 铲。全部挖到再加 ${ALL_BONUS} 分和剩下的铲数。${starsHtml(1, 3, 14)} ${TIERS.join(' / ')}` : '';
    };
    const start = () => {
      if (!useRun(ctx.s)) { idle(); return; }
      ctx.save(); b = newBeach(Math.random); phase = 'play';
      main.style.display = 'none'; note.textContent = '👆 先随便挖一格，看看冒几个泡'; refresh(); render();
    };
    const finish = () => {
      phase = 'result';
      const score = scoreOf(b), tier = tierOf(score), gain = clamsGain(ctx.s, tier);
      if (tier > 0) { applyGain(ctx.s, boostGain(ctx.s, gain, () => ctx.toast('🌟 今日推荐小游戏：这局奖励翻倍！'))); sfx.win(); } else sfx.no();
      recordClams(ctx.s, b.found); if (tier === 3 && dailyEgg(ctx.s, dayIndex())) ctx.toast('🥚 三星奖励：获得一颗宠物蛋！'); ctx.save();
      main.style.display = ''; main.disabled = runsLeft(ctx.s) <= 0; main.innerHTML = main.disabled ? '😴 今天玩够啦' : '🔁 再赶一次海';
      note.innerHTML = `${b.found >= CLAMS ? '🎉 一只不落！' : '🌊 涨潮了'} ${starsHtml(tier)} ⭐ ${score} &nbsp; 🦪 ${b.found} 只${b.pinched ? ` · 被夹 ${b.pinched} 次` : ''} &nbsp; ${tier > 0 ? gainIcons(gain, 18) : ''}`;
      refresh(); render();
    };
    board.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest('[data-i]') as HTMLElement | null;
      if (!el || phase !== 'play') return;
      const i = Number(el.dataset.i), res = dig(b, i);
      if (res === 'already' || res === 'over') return;
      if (res === 'clam') { sfx.coin(); note.textContent = '🦪 挖到一只蛤蜊！'; }
      else if (res === 'crab') { sfx.no(); note.textContent = `🦀 被螃蟹夹了一下，多扣 ${CRAB_COST} 铲`; }
      else { sfx.tap(); const n = bubbles(b, i); note.textContent = n ? `🫧 冒了 ${n} 个泡：周围 8 格里有 ${n} 只` : '这一圈都没有，换个地方'; }
      render();
      board.querySelector(`[data-i="${i}"]`)?.classList.add('pop');
      if (b.over) finish();
    });
    const press = () => { if (main.disabled) return; if (phase === 'idle' || phase === 'result') start(); };
    const onKey = (e: KeyboardEvent) => {
      if ((e.code === 'Space' || e.key === 'Enter') && phase !== 'play') { e.preventDefault(); press(); }
      else if (e.key === 'Escape') close();
    };
    const close = () => { window.removeEventListener('keydown', onKey); ov.remove(); ctx.save(); done(); };
    ov.addEventListener('click', (e) => { const btn = (e.target as HTMLElement).closest('[data-cl]') as HTMLElement | null; if (!btn) return; if (btn.dataset.cl === 'close') close(); else press(); });
    window.addEventListener('keydown', onKey);
    idle();
  });
}
