// 御膳房配菜界面（九重宫阙东侧）：照着菜单从六样食材里点齐上菜，点错扣时间。规则在 game/kitchen.ts。
import { dailyEgg } from '../../game/pets';
import { dayIndex } from '../../game/premium';
import { DURATION, FAST_PER, FOODS, FOOD_EMOJI, FOOD_NAME, PENALTY, TIERS, elapsed, isOver, kitchenGain, newKitchen, recordServed, runsLeft, tap, tierOf, useRun } from '../../game/kitchen';
import type { Food, Kitchen } from '../../game/kitchen';
import { gainIcons, starsHtml } from '../../ui/gain';
import { icon } from '../../ui/icons';
import { applyGain } from '../../game/stage';
import { sfx } from '../sfx';
import type { AppCtx } from '../ctx';

export const KITCHEN_CSS = `
.kc-hud{display:flex;justify-content:space-between;align-items:center;font-weight:800;font-size:14px}
.kc-hud b{color:#ffe27a;font-size:18px}
.kc-time{height:6px;border-radius:3px;background:rgba(0,0,0,.3);overflow:hidden;margin-top:4px}
.kc-time i{display:block;height:100%;background:#ffb04a;width:100%}
.kc-stage{position:relative;margin:8px 0;padding:12px 10px 10px;border-radius:14px;background:linear-gradient(#7a2a20,#5a1a14);border:3px solid #e8b84a;box-shadow:inset 0 0 18px rgba(0,0,0,.35)}
.kc-chef{position:absolute;left:10px;top:-14px;font-size:30px;filter:drop-shadow(0 2px 2px rgba(0,0,0,.4))}
.kc-order{margin:0 auto;width:max-content;max-width:100%;padding:8px 14px 8px 18px;border-radius:6px;background:#fff4dc;color:#5a2a10;font-weight:900;box-shadow:0 3px 0 #c8a060;display:flex;gap:8px;align-items:center;transition:transform .15s}
.kc-order.pop{transform:scale(1.08)}
.kc-order .t{font-size:13px;writing-mode:vertical-rl;letter-spacing:2px;color:#a03020;border-right:2px solid #e0b080;padding-right:6px}
.kc-need{font-size:34px;line-height:1;opacity:.9;position:relative}
.kc-need.got{opacity:.35}
.kc-need.got::after{content:'✔';position:absolute;right:-4px;bottom:-4px;font-size:18px;color:#2a9a4a}
.kc-plate{margin:10px auto 0;width:150px;height:30px;border-radius:50%;background:radial-gradient(#ffffff,#d8d0c0);box-shadow:0 4px 0 #a8a090;display:flex;justify-content:center;align-items:center;gap:2px;font-size:22px}
.kc-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.kc-grid button{font-size:30px;padding:8px 0 4px;border-radius:12px;border:2px solid #e8b84a;background:#fff8e8;color:#5a2a10;font-weight:800;touch-action:manipulation}
.kc-grid button small{display:block;font-size:12px}
.kc-grid button:disabled{opacity:.5}
.kc-grid button.bad{animation:kc-shake .3s}
@keyframes kc-shake{25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
.kc-note{min-height:20px;font-weight:800;font-size:13px;color:#ffe9a0}
`;

type Phase = 'idle' | 'play' | 'result';

/** 打开御膳房配菜；玩家点「离开」后结束。 */
export function openKitchen(ctx: AppCtx, host: Element): Promise<void> {
  return new Promise((done) => {
    const ov = document.createElement('div');
    ov.className = 'fish-ov';
    const btns = FOODS.map((f) => `<button data-f="${f}">${FOOD_EMOJI[f]}<small>${FOOD_NAME[f]}</small></button>`).join('');
    ov.innerHTML = `<div class="fish-card" style="width:min(400px,94%)"><h3>🥢 御膳房配菜</h3><div class="kc-hud"></div><div class="kc-time"><i></i></div><div class="kc-stage"><div class="kc-chef">🐱</div><div class="kc-order"></div><div class="kc-plate"></div></div><div class="kc-grid">${btns}</div><div class="kc-note"></div><div class="fish-info"></div><div class="fish-btns"><button class="btn green" data-kc="main">▶</button><button class="btn ghost" data-kc="close">${icon('close', 18)} 离开</button></div></div>`;
    host.appendChild(ov);
    const q = <T extends Element>(sel: string) => ov.querySelector(sel) as T;
    const hud = q<HTMLElement>('.kc-hud'), order = q<HTMLElement>('.kc-order'), plate = q<HTMLElement>('.kc-plate'), grid = q<HTMLElement>('.kc-grid'), note = q<HTMLElement>('.kc-note'), info = q<HTMLElement>('.fish-info'), main = q<HTMLButtonElement>('[data-kc="main"]'), timeBar = q<HTMLElement>('.kc-time i');
    let phase: Phase = 'idle', raf = 0, t0 = 0, k: Kitchen = newKitchen(Math.random);
    const now = () => (performance.now() - t0) / 1000;

    const refresh = () => { info.innerHTML = `🎮 今日剩余 ${runsLeft(ctx.s)} 局`; };
    const refreshHud = () => { const left = phase === 'play' ? Math.max(0, DURATION - elapsed(k, now())) : DURATION; hud.innerHTML = `<span>🍱 <b>${k.served}</b> 道</span><span>⭐ <b>${k.score}</b></span><span>⏱ ${Math.ceil(left)}</span>`; timeBar.style.width = `${(left / DURATION) * 100}%`; };
    const drawOrder = () => {
      if (phase !== 'play') { order.innerHTML = '<span class="t">菜单</span><span style="font-size:15px">御膳房今日开灶</span>'; plate.innerHTML = ''; return; }
      order.innerHTML = `<span class="t">第${k.served + 1}道</span>` + k.order.need.map((f) => `<span class="kc-need${k.order.got.includes(f) ? ' got' : ''}">${FOOD_EMOJI[f]}</span>`).join('');
      plate.innerHTML = k.order.got.map((f) => FOOD_EMOJI[f]).join('');
    };
    const setGrid = (on: boolean) => grid.querySelectorAll('button').forEach((b) => { (b as HTMLButtonElement).disabled = !on; });
    const idle = () => {
      phase = 'idle'; k = newKitchen(Math.random); refresh(); refreshHud(); drawOrder(); setGrid(false);
      const ok = runsLeft(ctx.s) > 0;
      main.style.display = ''; main.disabled = !ok; main.innerHTML = ok ? '▶ 开灶' : '😴 今天玩够啦';
      note.innerHTML = ok ? `照着菜单点齐食材上菜；点错扣 ${PENALTY} 秒。配得快（每样 ${FAST_PER} 秒内）有赏 +2。${starsHtml(1, 3, 14)} ${TIERS.join(' / ')}` : '';
    };
    const start = () => {
      if (!useRun(ctx.s)) { idle(); return; }
      ctx.save(); k = newKitchen(Math.random); phase = 'play'; t0 = performance.now();
      main.style.display = 'none'; note.textContent = ''; setGrid(true); refresh(); refreshHud(); drawOrder();
      cancelAnimationFrame(raf); raf = requestAnimationFrame(tick);
    };
    const tick = () => {
      if (phase !== 'play') return;
      refreshHud();
      if (isOver(k, now())) { finish(); return; }
      raf = requestAnimationFrame(tick);
    };
    const finish = () => {
      cancelAnimationFrame(raf); raf = 0; phase = 'result'; setGrid(false); refreshHud(); drawOrder();
      const tier = tierOf(k.score), gain = kitchenGain(ctx.s, tier);
      if (tier > 0) { applyGain(ctx.s, gain); sfx.win(); } else sfx.no();
      recordServed(ctx.s, k.served); if (tier === 3 && dailyEgg(ctx.s, dayIndex())) ctx.toast('🥚 三星奖励：获得一颗宠物蛋！'); ctx.save();
      main.style.display = ''; main.disabled = runsLeft(ctx.s) <= 0; main.innerHTML = main.disabled ? '😴 今天玩够啦' : '🔁 再开一灶';
      note.innerHTML = `${starsHtml(tier)} ⭐ ${k.score} &nbsp; 🍱 上了 ${k.served} 道（${k.fast} 道有赏） &nbsp; ${tier > 0 ? gainIcons(gain, 18) : ''}`;
      refresh();
    };
    const pick = (f: Food, b?: HTMLElement) => {
      if (phase !== 'play') return;
      const r = tap(k, f, now());
      if (r === 'over') { finish(); return; }
      if (r === 'wrong') { sfx.no(); note.textContent = `😾 菜单上没有这样（或已经放过了），扣 ${PENALTY} 秒`; if (b) { b.classList.remove('bad'); void b.offsetWidth; b.classList.add('bad'); } }
      else if (r === 'ok') sfx.tap();
      else { (r === 'fast' ? sfx.coin : sfx.ok)(); note.textContent = r === 'fast' ? '✨ 上得快，皇上有赏 +2' : '🍱 上菜！'; order.classList.add('pop'); setTimeout(() => order.classList.remove('pop'), 150); }
      drawOrder(); refreshHud();
      if (isOver(k, now())) finish();
    };
    grid.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest('[data-f]') as HTMLElement | null; if (b) pick(b.dataset.f as Food, b); });
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (phase === 'play' && n >= 1 && n <= FOODS.length) { pick(FOODS[n - 1], grid.children[n - 1] as HTMLElement); e.preventDefault(); }
      else if ((e.code === 'Space' || e.key === 'Enter') && phase !== 'play') { e.preventDefault(); press(); }
      else if (e.key === 'Escape') close();
    };
    const press = () => { if (main.disabled) return; if (phase === 'idle' || phase === 'result') start(); };
    const close = () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); ov.remove(); ctx.save(); done(); };
    ov.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest('[data-kc]') as HTMLElement | null; if (!b) return; if (b.dataset.kc === 'close') close(); else press(); });
    window.addEventListener('keydown', onKey);
    idle();
  });
}
