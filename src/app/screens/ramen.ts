// 拉面屋台小游戏界面：接单 → 按顺序加料（限时）→ 在绿区里起锅。规则在 game/ramen.ts。
import { BOIL_ZONE, CUSTOMERS, TOPPINGS, TOPPING_TIME, judgeBoil, judgeToppings, makeOrder, markerPos, ordersLeft, ramenGain, recordBowl, stars, useOrder } from '../../game/ramen';
import type { Topping } from '../../game/ramen';
import { gainIcons, starsHtml } from '../../ui/gain';
import { icon } from '../../ui/icons';
import { applyGain } from '../../game/stage';
import { sfx } from '../sfx';
import type { AppCtx } from '../ctx';

export const RAMEN_CSS = `
.ramen-ticket{margin:8px 0 6px;padding:8px 10px;border-radius:12px;background:rgba(255,90,74,.12);border:1.5px dashed rgba(255,150,130,.55);font-size:13px;font-weight:700;line-height:1.6}
.ramen-ticket small{display:block;color:#c9b8e8;font-weight:700}
.ramen-chips{display:flex;gap:6px;justify-content:center;margin:6px 0}
.ramen-chips i{font-style:normal;padding:4px 9px;border-radius:999px;border:1.5px solid rgba(255,255,255,.35);font-size:13px;font-weight:800}
.ramen-chips i.done{background:#3aa86a;border-color:#8affb0;color:#fff}
.ramen-chips i.next{border-color:#ffe27a;color:#ffe27a;box-shadow:0 0 8px rgba(255,226,122,.5)}
.ramen-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:8px 0}
.ramen-grid button{padding:10px 0;border-radius:12px;border:2px solid rgba(255,255,255,.3);background:rgba(255,255,255,.08);color:#fff;font-weight:800;font-size:14px}
.ramen-grid button.bad{animation:ramenShake .25s;border-color:#ff5a6a;background:rgba(255,90,106,.25)}
@keyframes ramenShake{25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
.ramen-time{height:6px;border-radius:3px;background:rgba(0,0,0,.3);overflow:hidden;margin-top:6px}
.ramen-time i{display:block;height:100%;background:#ffb04a;width:100%}
.ramen-bar{position:relative;height:30px;margin:14px 4px 8px;border-radius:15px;background:rgba(255,255,255,.1);border:1.5px solid rgba(255,255,255,.3)}
.ramen-bar .zone{position:absolute;top:0;bottom:0;border-radius:15px;background:rgba(58,168,106,.55);border:1.5px solid #8affb0}
.ramen-bar .mk{position:absolute;top:-4px;width:6px;height:38px;margin-left:-3px;border-radius:3px;background:#ffe27a;box-shadow:0 0 8px #ffe27a}
.ramen-stars{font-size:26px;letter-spacing:6px;color:#ffd24a;text-shadow:0 0 10px rgba(255,200,60,.6)}
`;

const TOP_EMOJI: Record<string, string> = { 叉烧: '🥩', 溏心蛋: '🥚', 海苔: '🟩', 葱花: '🥬', 鱼板: '🍥', 猫薄荷叶: '🍃' };
const em = (t: string) => TOP_EMOJI[t] ?? t;
type Phase = 'idle' | 'top' | 'boil' | 'result';

/** 打开拉面屋台；玩家点「收摊」后结束。 */
export function openRamen(ctx: AppCtx, host: Element): Promise<void> {
  return new Promise((done) => {
    const ov = document.createElement('div');
    ov.className = 'fish-ov';
    ov.innerHTML = `<div class="fish-card"><h3>🍜</h3><div class="ramen-body"></div><div class="fish-info"></div><div class="fish-btns"><button class="btn green" data-rm="main">🍜</button><button class="btn ghost" data-rm="close">${icon('close', 22)}</button></div></div>`;
    host.appendChild(ov);
    const body = ov.querySelector('.ramen-body') as HTMLElement, info = ov.querySelector('.fish-info') as HTMLElement, main = ov.querySelector('[data-rm="main"]') as HTMLButtonElement;
    let phase: Phase = 'idle', raf = 0, order: Topping[] = [], taps: Topping[] = [], customer = CUSTOMERS[0], t0 = 0;
    const refreshInfo = () => { info.innerHTML = `🍜 ${ordersLeft(ctx.s)}`; };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };
    const progress = () => { let i = 0; for (const t of taps) { if (i < order.length && t === order[i]) i++; } return i; };

    const idle = () => {
      stop(); phase = 'idle'; refreshInfo();
      main.style.display = ''; main.disabled = ordersLeft(ctx.s) <= 0; main.innerHTML = main.disabled ? '😴' : '🍜';
      body.innerHTML = `<div class="ramen-ticket"><span class="mg-big">${main.disabled ? '😴' : '🍜 ➜ 🥩🥚🟩 ➜ 🎯'}</span></div>`;
    };
    const chipsHtml = () => { const p = progress(); return order.map((t, i) => `<i class="${i < p ? 'done' : i === p ? 'next' : ''}">${em(t)}</i>`).join('➜'); };
    const startOrder = () => {
      if (!useOrder(ctx.s)) { idle(); return; }
      ctx.save();
      order = makeOrder(Math.random); taps = []; customer = CUSTOMERS[Math.floor(Math.random() * CUSTOMERS.length)];
      phase = 'top'; t0 = performance.now(); main.style.display = 'none'; refreshInfo();
      body.innerHTML = `<div class="ramen-ticket"><span class="mg-big">😼</span><small>${customer.name}</small></div><div class="ramen-chips"></div><div class="ramen-grid">${TOPPINGS.map((t) => `<button data-top="${t}">${em(t)}</button>`).join('')}</div><div class="ramen-time"><i></i></div>`;
      (body.querySelector('.ramen-chips') as HTMLElement).innerHTML = chipsHtml();
      const bar = body.querySelector('.ramen-time i') as HTMLElement;
      const tick = (now: number) => {
        if (phase !== 'top') return;
        const left = TOPPING_TIME - (now - t0) / 1000;
        bar.style.width = `${Math.max(0, left / TOPPING_TIME) * 100}%`;
        if (left <= 0) { finish(false, null); return; }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const tapTopping = (t: Topping, btn: HTMLElement) => {
      if (phase !== 'top') return;
      const before = progress();
      taps.push(t);
      if (progress() === before) { btn.classList.remove('bad'); void btn.offsetWidth; btn.classList.add('bad'); sfx.no(); } else sfx.tap();
      (body.querySelector('.ramen-chips') as HTMLElement).innerHTML = chipsHtml();
      if (judgeToppings(order, taps).complete) startBoil();
    };
    const startBoil = () => {
      stop(); phase = 'boil'; t0 = performance.now();
      const lo = (BOIL_ZONE.center - BOIL_ZONE.half) * 100, w = BOIL_ZONE.half * 2 * 100;
      body.innerHTML = `<div class="ramen-ticket"><span class="mg-big">🔥</span></div><div class="ramen-bar"><div class="zone" style="left:${lo}%;width:${w}%"></div><div class="mk"></div></div>`;
      main.style.display = ''; main.disabled = false; main.innerHTML = '🥢';
      const mk = body.querySelector('.mk') as HTMLElement;
      const tick = (now: number) => { if (phase !== 'boil') return; mk.style.left = `${markerPos((now - t0) / 1000) * 100}%`; raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
    };
    const pull = () => {
      if (phase !== 'boil') return;
      const pos = markerPos((performance.now() - t0) / 1000);
      finish(true, judgeBoil(pos));
    };
    const finish = (served: boolean, boil: ReturnType<typeof judgeBoil> | null) => {
      stop();
      const top = judgeToppings(order, taps);
      const st = served ? stars(top, boil) : 0;
      const g = ramenGain(ctx.s, st);
      if (st > 0) { applyGain(ctx.s, g); sfx.coin(); if (st === 3) sfx.up(); } else sfx.no();
      recordBowl(ctx.s, st); ctx.save();
      phase = 'result'; main.style.display = ''; main.disabled = false; main.innerHTML = ordersLeft(ctx.s) > 0 ? '🔁' : '😴'; if (ordersLeft(ctx.s) <= 0) main.disabled = true;
      const face = !served ? '😾' : boil === 'miss' ? '😿' : st === 3 ? '😻' : '😺';
      body.innerHTML = `<span class="mg-big">${face}</span>${starsHtml(st)}<div style="margin-top:6px">${st > 0 ? gainIcons(g, 20) : ''}</div>`;
      refreshInfo();
    };
    const press = () => { if (main.disabled) return; if (phase === 'idle' || phase === 'result') startOrder(); else if (phase === 'boil') pull(); };
    const close = () => { stop(); window.removeEventListener('keydown', onKey); ov.remove(); ctx.save(); done(); };
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); press(); } else if (e.key === 'Escape') close(); };
    ov.addEventListener('click', (e) => {
      const el = e.target as HTMLElement;
      const top = el.closest('[data-top]') as HTMLElement | null;
      if (top) { tapTopping(top.dataset.top as Topping, top); return; }
      const b = el.closest('[data-rm]') as HTMLElement | null;
      if (!b) return;
      if (b.dataset.rm === 'close') close(); else press();
    });
    window.addEventListener('keydown', onKey);
    idle();
  });
}
