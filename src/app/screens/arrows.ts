// 草船借箭界面（赤壁港西栈桥尽头）：大雾江面，左右划小船接箭、躲火箭。规则在 game/arrows.ts。
import { dailyEgg } from '../../game/pets';
import { dayIndex } from '../../game/premium';
import { BOAT_HALF, CATCH_Y, DURATION, NAME, SCORE, TIERS, arrowsGain, heightOf, isOver, makeSchedule, newGame, recordArrows, runsLeft, step, tierOf, useRun } from '../../game/arrows';
import type { Game, Shot } from '../../game/arrows';
import { gainIcons, starsHtml } from '../../ui/gain';
import { icon } from '../../ui/icons';
import { applyGain } from '../../game/stage';
import { sfx } from '../sfx';
import type { AppCtx } from '../ctx';

export const ARROWS_CSS = `
.ar-cv{display:block;margin:6px auto;max-width:100%;max-height:46vh;border-radius:14px;border:3px solid #8ab8c8;box-shadow:0 0 18px rgba(138,184,200,.35);background:#5a7a8a;touch-action:none}
.ar-hud{display:flex;justify-content:space-between;align-items:center;font-weight:800;font-size:14px}
.ar-hud b{color:#ffe27a;font-size:18px}
.ar-time{height:6px;border-radius:3px;background:rgba(0,0,0,.3);overflow:hidden;margin-top:4px}
.ar-time i{display:block;height:100%;background:#8ab8c8;width:100%}
.ar-ctl{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:6px}
.ar-ctl .btn{font-size:22px;padding:10px 0;touch-action:none;user-select:none;-webkit-user-select:none}
.ar-ctl .btn.on{filter:brightness(1.3);transform:translateY(2px)}
.ar-note{min-height:20px;font-weight:800;font-size:13px;color:#ffe9a0}
`;

const W = 600, H = 400, TOP = 30, WATER = 340;
type Phase = 'idle' | 'play' | 'result';
const px = (x: number) => W / 2 + x * (W / 2 - 10);
const py = (h: number) => WATER - 30 - h * (WATER - 30 - TOP);

function drawArrow(c: CanvasRenderingContext2D, s: Shot, x: number, y: number, t: number) {
  c.save(); c.translate(x, y); c.rotate(0.12); c.scale(1.4, 1.4);
  const n = s.kind === 'bundle' ? 3 : 1;
  for (let i = 0; i < n; i++) {
    const dx = (i - (n - 1) / 2) * 6;
    c.strokeStyle = s.kind === 'fire' ? '#5a3a2a' : '#8a6a3a'; c.lineWidth = 3; c.beginPath(); c.moveTo(dx, -34); c.lineTo(dx, 8); c.stroke();
    c.fillStyle = '#c8c8d0'; c.beginPath(); c.moveTo(dx - 5, 6); c.lineTo(dx + 5, 6); c.lineTo(dx, 18); c.fill();
    c.fillStyle = s.kind === 'bundle' ? '#ffd24a' : '#f0f0f0'; c.beginPath(); c.moveTo(dx, -34); c.lineTo(dx - 6, -42); c.lineTo(dx, -28); c.lineTo(dx + 6, -42); c.fill();
  }
  if (s.kind === 'bundle') { c.strokeStyle = '#d9483b'; c.lineWidth = 3; c.beginPath(); c.moveTo(-10, -10); c.lineTo(10, -10); c.stroke(); }
  if (s.kind === 'fire') { // 箭头上一团火
    const f = 1 + Math.sin(t * 30) * 0.15;
    c.fillStyle = '#ff7a2a'; c.beginPath(); c.ellipse(0, 10, 9 * f, 14 * f, 0, 0, 7); c.fill();
    c.fillStyle = '#ffe27a'; c.beginPath(); c.ellipse(0, 13, 4 * f, 7 * f, 0, 0, 7); c.fill();
  }
  c.restore();
}
function drawBoat(c: CanvasRenderingContext2D, x: number, burn: number, t: number) {
  const w = BOAT_HALF * (W / 2 - 10), y = WATER - 8;
  c.save(); c.translate(x, y + Math.sin(t * 3) * 2);
  // 船身
  c.fillStyle = '#6a4a2a'; c.beginPath(); c.moveTo(-w - 14, -10); c.lineTo(w + 14, -10); c.lineTo(w, 10); c.lineTo(-w, 10); c.closePath(); c.fill();
  c.fillStyle = '#8a6a3a'; c.fillRect(-w - 10, -14, (w + 10) * 2, 5);
  // 稻草猫：三个草垛，带猫耳
  for (const dx of [-w * 0.6, 0, w * 0.6]) {
    c.fillStyle = '#d8b860'; c.beginPath(); c.ellipse(dx, -34, 15, 22, 0, 0, 7); c.fill();
    c.strokeStyle = '#b8984a'; c.lineWidth = 1.5; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(dx + i * 5, -54); c.lineTo(dx + i * 6, -14); c.stroke(); }
    c.fillStyle = '#d8b860'; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(dx + s * 11, -50); c.lineTo(dx + s * 10, -64); c.lineTo(dx + s * 3, -55); c.fill(); }
    c.fillStyle = '#3a2a1a'; for (const s of [-1, 1]) { c.beginPath(); c.arc(dx + s * 5, -40, 2, 0, 7); c.fill(); }
  }
  if (burn > 0) { c.globalAlpha = Math.min(1, burn); c.fillStyle = '#ff7a2a'; for (const dx of [-w * 0.3, w * 0.4]) { c.beginPath(); c.ellipse(dx, -60 - Math.sin(t * 25 + dx) * 4, 10, 16, 0, 0, 7); c.fill(); } c.globalAlpha = 1; }
  c.restore();
}

/** 打开草船借箭；玩家点「离开」后结束。 */
export function openArrows(ctx: AppCtx, host: Element): Promise<void> {
  return new Promise((done) => {
    const ov = document.createElement('div');
    ov.className = 'fish-ov';
    ov.innerHTML = `<div class="fish-card" style="width:min(430px,94%)"><h3>🏹 草船借箭</h3><div class="ar-hud"></div><canvas class="ar-cv" width="${W}" height="${H}"></canvas><div class="ar-time"><i></i></div><div class="ar-ctl"><button class="btn" data-k="L">◀</button><button class="btn" data-k="R">▶</button></div><div class="ar-note"></div><div class="fish-info"></div><div class="fish-btns"><button class="btn green" data-ar="main">▶</button><button class="btn ghost" data-ar="close">${icon('close', 18)} 离开</button></div></div>`;
    host.appendChild(ov);
    const q = <T extends Element>(sel: string) => ov.querySelector(sel) as T;
    const cv = q<HTMLCanvasElement>('.ar-cv'), c = cv.getContext('2d')!, hud = q<HTMLElement>('.ar-hud'), note = q<HTMLElement>('.ar-note'), info = q<HTMLElement>('.fish-info'), main = q<HTMLButtonElement>('[data-ar="main"]'), timeBar = q<HTMLElement>('.ar-time i'), ctl = q<HTMLElement>('.ar-ctl');
    let phase: Phase = 'idle', raf = 0, last = 0, g: Game = newGame([]), left = false, right = false, dragX: number | null = null;
    const splashes: { x: number; t: number; col: string; text: string }[] = [];

    const refresh = () => { info.innerHTML = `🎮 今日剩余 ${runsLeft(ctx.s)} 局`; };
    const refreshHud = () => { hud.innerHTML = `<span>🏹 <b>${g.got}</b> 支</span><span>⭐ <b>${g.score}</b></span><span>⏱ ${Math.max(0, Math.ceil(DURATION - g.t))}</span>`; };
    const draw = () => {
      // 江面：上面是灰白的大雾，下面是青灰的江水
      const sky = c.createLinearGradient(0, 0, 0, WATER); sky.addColorStop(0, '#c8d4d8'); sky.addColorStop(1, '#8aa4ae'); c.fillStyle = sky; c.fillRect(0, 0, W, WATER);
      c.fillStyle = 'rgba(90,110,120,.5)'; c.beginPath(); c.moveTo(0, 70); for (let x = 0; x <= W; x += 40) c.lineTo(x, 60 + Math.sin(x * 0.03) * 10); c.lineTo(W, 0); c.lineTo(0, 0); c.fill(); // 对岸的山影
      for (let i = 0; i < 5; i++) { c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.ellipse(((i * 160 + g.t * 18) % (W + 200)) - 100, 110 + i * 40, 140, 20, 0, 0, 7); c.fill(); } // 雾带
      const sea = c.createLinearGradient(0, WATER, 0, H); sea.addColorStop(0, '#4a6a7a'); sea.addColorStop(1, '#2a4a5a'); c.fillStyle = sea; c.fillRect(0, WATER, W, H - WATER);
      c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 2; for (let i = 0; i < 8; i++) { const x = ((i * 90 + g.t * 30) % (W + 60)) - 30; c.beginPath(); c.moveTo(x, WATER + 20 + (i % 3) * 14); c.lineTo(x + 30, WATER + 20 + (i % 3) * 14); c.stroke(); }
      for (const s of g.plan) {
        if (g.done.has(s.id)) continue;
        const h = heightOf(s, g.t); if (h == null || h < CATCH_Y - 0.02) continue;
        drawArrow(c, s, px(s.x), py(h), g.t);
      }
      drawBoat(c, px(g.boat), g.burn, g.t);
      for (let i = splashes.length - 1; i >= 0; i--) {
        const sp = splashes[i], a = g.t - sp.t; if (a > 0.8) { splashes.splice(i, 1); continue; }
        c.globalAlpha = 1 - a / 0.8; c.fillStyle = sp.col; c.font = '900 24px sans-serif'; c.textAlign = 'center'; c.fillText(sp.text, px(sp.x), WATER - 90 - a * 40); c.globalAlpha = 1;
      }
      if (phase !== 'play') { c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(0, 0, W, H); }
    };
    const idle = () => {
      phase = 'idle'; g = newGame([]); timeBar.style.width = '100%'; refresh(); refreshHud(); draw();
      const ok = runsLeft(ctx.s) > 0;
      main.style.display = ''; main.disabled = !ok; main.innerHTML = ok ? '▶ 起锚' : '😴 今天玩够啦';
      note.innerHTML = ok ? `左右划船接箭：${NAME.arrow} +${SCORE.arrow}、${NAME.bundle} +${SCORE.bundle}，${NAME.fire}要躲（${SCORE.fire}，船还会着火变慢）。${starsHtml(1, 3, 14)} ${TIERS.join(' / ')}` : '';
    };
    const start = () => {
      if (!useRun(ctx.s)) { idle(); return; }
      ctx.save(); g = newGame(makeSchedule(Math.random)); phase = 'play'; last = performance.now(); splashes.length = 0;
      main.style.display = 'none'; note.textContent = ''; refresh(); refreshHud();
      cancelAnimationFrame(raf); raf = requestAnimationFrame(tick);
    };
    const tick = (now: number) => {
      if (phase !== 'play') return;
      let real = Math.min(0.25, (now - last) / 1000); last = now;
      while (real > 1e-6) {
        const dt = Math.min(0.05, real); real -= dt;
        let steer = (right ? 1 : 0) - (left ? 1 : 0);
        if (dragX != null && steer === 0) { const d = dragX - g.boat; steer = Math.abs(d) < 0.02 ? 0 : Math.max(-1, Math.min(1, d * 8)); }
        for (const r of step(g, steer, dt)) {
          if (!r.caught) continue;
          const fire = r.s.kind === 'fire';
          splashes.push({ x: r.s.x, t: g.t, col: fire ? '#ff5a3a' : r.s.kind === 'bundle' ? '#ffd24a' : '#ffffff', text: fire ? `${SCORE.fire} 🔥` : `+${SCORE[r.s.kind]}` });
          if (fire) { sfx.no(); note.textContent = '🔥 中了火箭，船着火了，划得慢一会儿'; } else (r.s.kind === 'bundle' ? sfx.coin : sfx.tap)();
        }
        if (isOver(g)) break;
      }
      timeBar.style.width = `${Math.max(0, (DURATION - g.t) / DURATION) * 100}%`;
      refreshHud(); draw();
      if (isOver(g)) { finish(); return; }
      raf = requestAnimationFrame(tick);
    };
    const finish = () => {
      cancelAnimationFrame(raf); raf = 0; phase = 'result'; draw();
      const tier = tierOf(g.score), gain = arrowsGain(ctx.s, tier);
      if (tier > 0) { applyGain(ctx.s, gain); sfx.win(); } else sfx.no();
      recordArrows(ctx.s, g.got); if (tier === 3 && dailyEgg(ctx.s, dayIndex())) ctx.toast('🥚 三星奖励：获得一颗宠物蛋！'); ctx.save();
      main.style.display = ''; main.disabled = runsLeft(ctx.s) <= 0; main.innerHTML = main.disabled ? '😴 今天玩够啦' : '🔁 再借一船';
      note.innerHTML = `${starsHtml(tier)} ⭐ ${g.score} &nbsp; 🏹 借到 ${g.got} 支 &nbsp; ${tier > 0 ? gainIcons(gain, 18) : ''}`;
      refresh();
    };
    const setDir = (d: 'L' | 'R', on: boolean) => { if (d === 'L') left = on; else right = on; ctl.querySelector(`[data-k="${d}"]`)?.classList.toggle('on', on); };
    ctl.addEventListener('pointerdown', (e) => { const b = (e.target as HTMLElement).closest('[data-k]') as HTMLElement | null; if (!b) return; b.setPointerCapture?.(e.pointerId); setDir(b.dataset.k as 'L' | 'R', true); });
    const rel = (e: PointerEvent) => { const b = (e.target as HTMLElement).closest('[data-k]') as HTMLElement | null; if (b) setDir(b.dataset.k as 'L' | 'R', false); };
    ctl.addEventListener('pointerup', rel); ctl.addEventListener('pointercancel', rel); ctl.addEventListener('lostpointercapture', rel);
    // 在江面上按住拖动：船跟着手指走
    const toX = (e: PointerEvent) => { const r = cv.getBoundingClientRect(); return Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2 * (W / 2) / (W / 2 - 10))); };
    cv.addEventListener('pointerdown', (e) => { dragX = toX(e); cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', (e) => { if (dragX != null) dragX = toX(e); });
    const up = () => { dragX = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') { setDir('L', true); e.preventDefault(); }
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') { setDir('R', true); e.preventDefault(); }
      else if ((e.code === 'Space' || e.key === 'Enter') && phase !== 'play') { e.preventDefault(); press(); }
      else if (e.key === 'Escape') close();
    };
    const onKeyUp = (e: KeyboardEvent) => { if (e.code === 'ArrowLeft' || e.code === 'KeyA') setDir('L', false); else if (e.code === 'ArrowRight' || e.code === 'KeyD') setDir('R', false); };
    const press = () => { if (main.disabled) return; if (phase === 'idle' || phase === 'result') start(); };
    const close = () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp); ov.remove(); ctx.save(); done(); };
    ov.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest('[data-ar]') as HTMLElement | null; if (!b) return; if (b.dataset.ar === 'close') close(); else press(); });
    window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKeyUp);
    idle();
  });
}
