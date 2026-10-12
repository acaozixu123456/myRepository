// 风铃节奏小游戏界面：音符沿 3 条轨道落下，落到判定线时点对应轨道。规则在 game/windchime.ts。
import { FALL, LANES, LANE_NAMES, NOTES, accuracy, chimeGain, makeChart, matchTap, recordHits, runsLeft, tierOf, useRun } from '../../game/windchime';
import type { Grade, Note } from '../../game/windchime';
import { gainIcons, starsHtml } from '../../ui/gain';
import { icon } from '../../ui/icons';
import { applyGain } from '../../game/stage';
import { sfx } from '../sfx';
import type { AppCtx } from '../ctx';

export const WINDCHIME_CSS = `
.wc-field{position:relative;display:grid;grid-template-columns:repeat(3,1fr);gap:4px;height:230px;margin:10px 0 6px;border-radius:14px;overflow:hidden;background:linear-gradient(#16224a,#0d1530)}
.wc-lane{position:relative;background:rgba(154,184,255,.07);border-left:1px solid rgba(154,184,255,.2)}
.wc-line{position:absolute;left:0;right:0;top:82%;height:3px;background:#ffe27a;box-shadow:0 0 10px #ffe27a;z-index:2}
.wc-note{position:absolute;left:50%;width:36px;height:36px;margin-left:-18px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,#9ab8ff 60%,#6a8ae0);box-shadow:0 0 12px rgba(154,184,255,.9);font-size:14px;line-height:36px;text-align:center;font-weight:900;color:#1a2a5a}
.wc-note.l1{background:radial-gradient(circle at 35% 30%,#fff,#ffb0e0 60%,#e070b0);box-shadow:0 0 12px rgba(255,176,224,.9)}
.wc-note.l2{background:radial-gradient(circle at 35% 30%,#fff,#a0ffd8 60%,#50c0a0);box-shadow:0 0 12px rgba(160,255,216,.9)}
.wc-fb{position:absolute;left:0;right:0;top:60%;text-align:center;font-weight:900;font-size:22px;pointer-events:none;opacity:0;z-index:3;text-shadow:0 2px 4px #000}
.wc-fb.show{animation:wcFb .5s ease-out both}
@keyframes wcFb{0%{opacity:1;transform:translateY(6px)}100%{opacity:0;transform:translateY(-18px)}}
.wc-fb.perfect{color:#ffe27a}.wc-fb.good{color:#8affb0}.wc-fb.miss{color:#ff8a9a}
.wc-keys{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.wc-keys button{padding:12px 0;border-radius:12px;border:2px solid rgba(154,184,255,.5);background:rgba(154,184,255,.12);color:#fff;font-weight:900;font-size:18px;touch-action:manipulation}
.wc-keys button small{display:block;font-size:10px;color:#9a8ec0;font-weight:700}
.wc-keys button.hit{background:rgba(255,226,122,.35)}
.wc-combo{height:20px;font-weight:900;color:#ffe27a;font-size:15px}
`;

type Phase = 'idle' | 'play' | 'result';
const KEYMAP: Record<string, number> = { a: 0, s: 1, d: 2, ArrowLeft: 0, ArrowDown: 1, ArrowRight: 2 };

/** 打开风铃节奏；玩家点「收摊」后结束。 */
export function openWindChime(ctx: AppCtx, host: Element): Promise<void> {
  return new Promise((done) => {
    const ov = document.createElement('div');
    ov.className = 'fish-ov';
    ov.innerHTML = `<div class="fish-card"><h3>🎐 风铃节拍</h3><div class="fish-status"></div><div class="wc-field">${Array.from({ length: LANES }, (_, i) => `<div class="wc-lane" data-lane="${i}"></div>`).join('')}<div class="wc-line"></div><div class="wc-fb"></div></div><div class="wc-combo"></div><div class="wc-keys">${LANE_NAMES.map((n, i) => `<button data-wc-key="${i}">${n}<small>${'ASD'[i]}</small></button>`).join('')}</div><div class="fish-info"></div><div class="fish-btns"><button class="btn green" data-wc="main">▶</button><button class="btn ghost" data-wc="close">${icon('close', 18)} 离开</button></div></div>`;
    host.appendChild(ov);
    const q = <T extends Element>(sel: string) => ov.querySelector(sel) as T;
    const status = q<HTMLElement>('.fish-status'), field = q<HTMLElement>('.wc-field'), fb = q<HTMLElement>('.wc-fb'), comboEl = q<HTMLElement>('.wc-combo'), info = q<HTMLElement>('.fish-info'), main = q<HTMLButtonElement>('[data-wc="main"]');
    const lanes = [...field.querySelectorAll('.wc-lane')] as HTMLElement[];
    let phase: Phase = 'idle', raf = 0, t0 = 0, chart: Note[] = [], done_ = new Set<number>(), els = new Map<number, HTMLElement>(), nextSpawn = 0;
    let perfect = 0, good = 0, miss = 0, combo = 0;
    const now = () => (performance.now() - t0) / 1000;

    const refresh = () => { info.innerHTML = `🎮 今日剩余 ${runsLeft(ctx.s)} 局`; };
    const clear = () => { for (const l of lanes) l.innerHTML = ''; els = new Map(); };
    const idle = () => {
      phase = 'idle'; clear(); refresh(); comboEl.textContent = '';
      const left = runsLeft(ctx.s) > 0;
      main.disabled = !left; main.innerHTML = left ? '▶ 开始' : '😴 今天玩够啦';
      status.innerHTML = left ? `<span class="mg-big">🎵 ➜ ➖ ➜ 👆</span><span class="mg-sub">风铃落到横线时，点对应的那一列（也可用键盘）</span>` : '<span class="mg-big">😴</span>';
    };
    const flash = (g: Grade) => { fb.className = `wc-fb ${g}`; void fb.offsetWidth; fb.className = `wc-fb ${g} show`; fb.textContent = g === 'perfect' ? '✨' : g === 'good' ? '👍' : '✖'; };
    const judge = (g: Grade) => {
      if (g === 'perfect') { perfect++; combo++; sfx.tap(); } else if (g === 'good') { good++; combo++; sfx.tap(); } else { miss++; combo = 0; sfx.no(); }
      comboEl.textContent = combo >= 3 ? `🔥 ${combo}` : '';
      flash(g);
    };
    const start = () => {
      if (!useRun(ctx.s)) { idle(); return; }
      ctx.save(); clear();
      chart = makeChart(Math.random); done_ = new Set(); nextSpawn = 0; perfect = good = miss = combo = 0;
      phase = 'play'; main.style.display = 'none'; refresh(); comboEl.textContent = ''; status.innerHTML = '<span class="mg-sub">⏳</span>';
      t0 = performance.now();
      (window as unknown as { __chime?: unknown }).__chime = { chart, now }; // 调试 / 自动化测试用
      const tick = () => {
        if (phase !== 'play') return;
        const t = now();
        while (nextSpawn < chart.length && chart[nextSpawn].t - FALL <= t) {
          const n = chart[nextSpawn], el = document.createElement('div');
          el.className = `wc-note l${n.lane}`; el.textContent = LANE_NAMES[n.lane];
          lanes[n.lane].appendChild(el); els.set(nextSpawn, el); nextSpawn++;
        }
        for (const [i, el] of els) {
          const frac = 1 - (chart[i].t - t) / FALL; // 0 = 刚出现，1 = 在线上
          el.style.top = `calc(${frac * 82}% - 18px)`;
          if (t > chart[i].t + 0.22 && !done_.has(i)) { done_.add(i); judge('miss'); el.remove(); els.delete(i); }
        }
        status.innerHTML = t < chart[0].t - FALL ? '<span class="mg-sub">⏳</span>' : `<span class="mg-sub">🎯 ${perfect + good} / ${NOTES}</span>`;
        if (t > chart[chart.length - 1].t + 0.6) { finish(); return; }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const tap = (lane: number) => {
      const key = ov.querySelector(`[data-wc-key="${lane}"]`) as HTMLElement; key.classList.add('hit'); setTimeout(() => key.classList.remove('hit'), 90);
      if (phase !== 'play') return;
      const m = matchTap(chart, done_, lane, now());
      if (!m) return; // 离任何音符都太远：空点不扣分
      done_.add(m.index); judge(m.grade);
      const el = els.get(m.index); if (el) { el.remove(); els.delete(m.index); }
    };
    const finish = () => {
      cancelAnimationFrame(raf); raf = 0; clear();
      const acc = accuracy(perfect, good), tier = tierOf(acc), g = chimeGain(ctx.s, tier);
      if (tier > 0) { applyGain(ctx.s, g); sfx.coin(); if (tier === 3) sfx.up(); } else sfx.no();
      recordHits(ctx.s, perfect + good); ctx.save();
      phase = 'result'; main.style.display = ''; main.disabled = runsLeft(ctx.s) <= 0; main.innerHTML = main.disabled ? '😴 今天玩够啦' : '🔁 再来一局';
      comboEl.textContent = '';
      status.innerHTML = `${starsHtml(tier)}<div class="mg-sub">🎯 ${Math.round(acc * 100)}% &nbsp; ✨${perfect} 👍${good} ✖${miss}</div><div style="margin-top:4px">${tier > 0 ? gainIcons(g, 20) : ''}</div>`;
      refresh();
    };
    const press = () => { if (main.disabled) return; if (phase === 'idle' || phase === 'result') start(); };
    const close = () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); ov.remove(); ctx.save(); done(); };
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const lane = KEYMAP[e.key] ?? KEYMAP[e.key.toLowerCase()];
      if (lane !== undefined && phase === 'play') { e.preventDefault(); tap(lane); return; }
      if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); press(); } else if (e.key === 'Escape') close();
    };
    ov.addEventListener('pointerdown', (e) => { const k = (e.target as HTMLElement).closest('[data-wc-key]') as HTMLElement | null; if (k) { e.preventDefault(); tap(+k.dataset.wcKey!); } });
    ov.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('[data-wc]') as HTMLElement | null;
      if (!b) return;
      if (b.dataset.wc === 'close') close(); else press();
    });
    window.addEventListener('keydown', onKey);
    idle();
  });
}
