// 网咖「鼠标大作战」界面（赛博街区「赛博猫网咖」）：4 条桌面跑道，鼠标横着窜过去，点中就抓到。规则在 game/whack.ts。
import { dailyEgg } from '../../game/pets';
import { dayIndex } from '../../game/premium';
import { DURATION, LANES, SCORE, TIERS, comboMul, escapes, makeSchedule, newGame, posOf, recordCaught, runsLeft, tap, tierOf, useRun, whackGain } from '../../game/whack';
import type { Game, Runner } from '../../game/whack';
import { gainIcons, starsHtml } from '../../ui/gain';
import { icon } from '../../ui/icons';
import { applyGain } from '../../game/stage';
import { sfx } from '../sfx';
import type { AppCtx } from '../ctx';

export const WHACK_CSS = `
.wk-cv{display:block;margin:6px auto;max-width:100%;max-height:46vh;border-radius:14px;border:3px solid #9a7aff;box-shadow:0 0 18px rgba(154,122,255,.45);background:#0e0a22;touch-action:none;cursor:crosshair}
.wk-hud{display:flex;justify-content:space-between;align-items:center;font-weight:800;font-size:14px}
.wk-hud b{color:#ffe27a;font-size:18px}
.wk-time{height:6px;border-radius:3px;background:rgba(0,0,0,.3);overflow:hidden;margin-top:4px}
.wk-time i{display:block;height:100%;background:#9a7aff;width:100%}
.wk-note{min-height:20px;font-weight:800;font-size:13px;color:#ffe9a0}
`;

const W = 600, H = 400, LH = H / LANES;
type Phase = 'idle' | 'play' | 'result';
const BODY: Record<Runner['kind'], string> = { mouse: '#e8e8f4', gold: '#ffd24a', robot: '#5a5a6a' };

function drawRunner(c: CanvasRenderingContext2D, r: Runner, x: number, y: number, t: number) {
  c.save(); c.translate(x, y); c.scale(r.dir * 1.45, 1.45);
  if (r.kind === 'robot') {
    // 扫地机器人：圆盘 + 红灯
    c.fillStyle = BODY.robot; c.beginPath(); c.arc(0, 0, 24, 0, 7); c.fill();
    c.strokeStyle = '#8a8a9a'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 17, 0, 7); c.stroke();
    c.fillStyle = Math.floor(t * 4) % 2 ? '#ff4a4a' : '#8a1a1a'; c.beginPath(); c.arc(10, 0, 4, 0, 7); c.fill();
    c.strokeStyle = '#c8c8d8'; c.lineWidth = 2; for (const a of [-0.6, 0.6]) { c.beginPath(); c.moveTo(20 * Math.cos(a), 20 * Math.sin(a)); c.lineTo(30 * Math.cos(a + Math.sin(t * 20)), 30 * Math.sin(a + Math.sin(t * 20))); c.stroke(); }
  } else {
    // 鼠标 = 老鼠：椭圆身子、圆耳朵、长尾巴（数据线）
    if (r.kind === 'gold') { c.shadowColor = '#ffd24a'; c.shadowBlur = 18; }
    c.strokeStyle = r.kind === 'gold' ? '#d8a020' : '#9a9ab0'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-20, 2); c.bezierCurveTo(-34, 2 + Math.sin(t * 18) * 8, -40, -8, -50, -2); c.stroke();
    c.fillStyle = BODY[r.kind]; c.beginPath(); c.ellipse(0, 0, 22, 14, 0, 0, 7); c.fill();
    c.shadowBlur = 0;
    c.fillStyle = r.kind === 'gold' ? '#ffb020' : '#c8c8d8'; for (const dy of [-11, 11]) { c.beginPath(); c.arc(8, dy, 7, 0, 7); c.fill(); }
    c.fillStyle = '#ff8ab0'; c.beginPath(); c.arc(22, 0, 3, 0, 7); c.fill();
    c.fillStyle = '#1a1a2a'; c.beginPath(); c.arc(14, -4, 2.2, 0, 7); c.fill();
    // 鼠标滚轮
    c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 2; c.beginPath(); c.moveTo(-4, 0); c.lineTo(6, 0); c.stroke();
  }
  c.restore();
}

/** 打开鼠标大作战；玩家点「离开」后结束。 */
export function openWhack(ctx: AppCtx, host: Element): Promise<void> {
  return new Promise((done) => {
    const ov = document.createElement('div');
    ov.className = 'fish-ov';
    ov.innerHTML = `<div class="fish-card" style="width:min(430px,94%)"><h3>🖱️ 网咖 · 鼠标大作战</h3><div class="wk-hud"></div><canvas class="wk-cv" width="${W}" height="${H}"></canvas><div class="wk-time"><i></i></div><div class="wk-note"></div><div class="fish-info"></div><div class="fish-btns"><button class="btn green" data-wk="main">▶</button><button class="btn ghost" data-wk="close">${icon('close', 18)} 离开</button></div></div>`;
    host.appendChild(ov);
    const q = <T extends Element>(sel: string) => ov.querySelector(sel) as T;
    const cv = q<HTMLCanvasElement>('.wk-cv'), c = cv.getContext('2d')!, hud = q<HTMLElement>('.wk-hud'), note = q<HTMLElement>('.wk-note'), info = q<HTMLElement>('.fish-info'), main = q<HTMLButtonElement>('[data-wk="main"]'), timeBar = q<HTMLElement>('.wk-time i');
    let phase: Phase = 'idle', raf = 0, g: Game = newGame([]), t = 0, last = 0;
    const pops: { x: number; y: number; text: string; col: string; t: number }[] = [];

    const refresh = () => { info.innerHTML = `🎮 今日剩余 ${runsLeft(ctx.s)} 局`; };
    const refreshHud = () => { hud.innerHTML = `<span>⭐ <b>${g.score}</b></span><span>🔥 ${g.combo} 连 ×${comboMul(g.combo)}</span><span>⏱ ${Math.max(0, Math.ceil(DURATION - t))}</span>`; };
    const draw = () => {
      c.fillStyle = '#0e0a22'; c.fillRect(0, 0, W, H);
      for (let i = 0; i < LANES; i++) {
        // 每条跑道是一张网咖桌面：深色桌板 + 霓虹边
        c.fillStyle = i % 2 ? '#1a1438' : '#16112e'; c.fillRect(0, i * LH, W, LH);
        c.fillStyle = ['#7ff0ff', '#ff4aa8', '#9a7aff', '#4fe08a'][i]; c.globalAlpha = 0.5; c.fillRect(0, (i + 1) * LH - 3, W, 3); c.globalAlpha = 1;
        c.fillStyle = 'rgba(127,240,255,.07)'; for (let k = 0; k < 6; k++) c.fillRect(30 + k * 100, i * LH + 10, 60, 6);
      }
      for (const r of g.plan) {
        if (g.caught.has(r.id)) continue;
        const p = posOf(r, t); if (p == null) continue;
        drawRunner(c, r, p * W, r.lane * LH + LH / 2, t);
      }
      for (let i = pops.length - 1; i >= 0; i--) {
        const p = pops[i], a = t - p.t; if (a > 0.7) { pops.splice(i, 1); continue; }
        c.globalAlpha = 1 - a / 0.7; c.fillStyle = p.col; c.font = '900 24px sans-serif'; c.textAlign = 'center'; c.fillText(p.text, p.x, p.y - a * 40); c.globalAlpha = 1;
      }
      if (phase !== 'play') { c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(0, 0, W, H); }
    };
    const idle = () => {
      phase = 'idle'; g = newGame([]); t = 0; timeBar.style.width = '100%'; refresh(); refreshHud(); draw();
      const ok = runsLeft(ctx.s) > 0;
      main.style.display = ''; main.disabled = !ok; main.innerHTML = ok ? '▶ 开机' : '😴 今天玩够啦';
      note.innerHTML = ok ? `点窜过去的鼠标：白 +${SCORE.mouse}、金 +${SCORE.gold}，扫地机器人别点（${SCORE.robot}）。连抓有倍率。${starsHtml(1, 3, 14)} ${TIERS.join(' / ')}` : '';
    };
    const start = () => {
      if (!useRun(ctx.s)) { idle(); return; }
      ctx.save(); g = newGame(makeSchedule(Math.random)); t = 0; last = performance.now(); phase = 'play'; pops.length = 0;
      main.style.display = 'none'; note.textContent = ''; refresh(); refreshHud();
      cancelAnimationFrame(raf); raf = requestAnimationFrame(tick);
    };
    const tick = (now: number) => {
      if (phase !== 'play') return;
      const prev = t; t += Math.min(0.25, (now - last) / 1000); last = now;
      if (escapes(g, prev, t) > 0) note.textContent = '💨 跑掉一只，连击断了';
      timeBar.style.width = `${Math.max(0, (DURATION - t) / DURATION) * 100}%`;
      refreshHud(); draw();
      if (t >= DURATION) { finish(); return; }
      raf = requestAnimationFrame(tick);
    };
    const finish = () => {
      cancelAnimationFrame(raf); raf = 0; phase = 'result'; draw();
      const tier = tierOf(g.score), gain = whackGain(ctx.s, tier);
      if (tier > 0) { applyGain(ctx.s, gain); sfx.win(); } else sfx.no();
      recordCaught(ctx.s, g.got); if (tier === 3 && dailyEgg(ctx.s, dayIndex())) ctx.toast('🥚 三星奖励：获得一颗宠物蛋！'); ctx.save();
      main.style.display = ''; main.disabled = runsLeft(ctx.s) <= 0; main.innerHTML = main.disabled ? '😴 今天玩够啦' : '🔁 再来一局';
      note.innerHTML = `${starsHtml(tier)} ⭐ ${g.score} &nbsp; 🖱️ ${g.got} &nbsp; 最高 ${g.best} 连 &nbsp; ${tier > 0 ? gainIcons(gain, 18) : ''}`;
      refresh();
    };
    cv.addEventListener('pointerdown', (e) => {
      if (phase !== 'play') return;
      const b = cv.getBoundingClientRect(), x = (e.clientX - b.left) / b.width, lane = Math.min(LANES - 1, Math.max(0, Math.floor(((e.clientY - b.top) / b.height) * LANES)));
      const { r, delta } = tap(g, lane, x, t);
      if (!r) return;
      const robot = r.kind === 'robot';
      pops.push({ x: x * W, y: lane * LH + LH / 2, text: robot ? `${delta}` : `+${delta}`, col: robot ? '#ff4a4a' : r.kind === 'gold' ? '#ffd24a' : '#7ff0ff', t });
      if (robot) { sfx.no(); note.textContent = '🤖 点到扫地机器人了，连击断了'; } else { (r.kind === 'gold' ? sfx.coin : sfx.tap)(); note.textContent = ''; }
      refreshHud();
    });
    const press = () => { if (main.disabled) return; if (phase === 'idle' || phase === 'result') start(); };
    const close = () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); ov.remove(); ctx.save(); done(); };
    const onKey = (e: KeyboardEvent) => { if ((e.code === 'Space' || e.key === 'Enter') && phase !== 'play') { e.preventDefault(); press(); } else if (e.key === 'Escape') close(); };
    ov.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest('[data-wk]') as HTMLElement | null; if (!b) return; if (b.dataset.wk === 'close') close(); else press(); });
    window.addEventListener('keydown', onKey);
    idle();
  });
}
