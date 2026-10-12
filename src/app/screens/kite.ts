// 云海放纸鸢界面（云端雾岛风车旁）：按住收线让猫猫纸鸢上升，松手往下飘；接小鱼干、金铃铛，躲乌云。规则在 game/kite.ts。
import { dailyEgg } from '../../game/pets';
import { dayIndex } from '../../game/premium';
import { DURATION, KITE_X, NAME, SCORE, TIERS, isOver, kiteGain, makeSchedule, newGame, recordKite, runsLeft, step, tierOf, useRun, xOf } from '../../game/kite';
import type { Game, Item } from '../../game/kite';
import { gainIcons, starsHtml } from '../../ui/gain';
import { icon } from '../../ui/icons';
import { applyGain } from '../../game/stage';
import { sfx } from '../sfx';
import type { AppCtx } from '../ctx';

export const KITE_CSS = `
.kt-cv{display:block;margin:6px auto;max-width:100%;max-height:46vh;border-radius:14px;border:3px solid #9ab8ff;box-shadow:0 0 18px rgba(154,184,255,.35);background:#a8d0f8;touch-action:none;cursor:pointer}
.kt-hud{display:flex;justify-content:space-between;align-items:center;font-weight:800;font-size:14px}
.kt-hud b{color:#ffe27a;font-size:18px}
.kt-time{height:6px;border-radius:3px;background:rgba(0,0,0,.3);overflow:hidden;margin-top:4px}
.kt-time i{display:block;height:100%;background:#9ab8ff;width:100%}
.kt-hold{width:100%;font-size:18px;padding:12px 0;margin-top:6px;touch-action:none;user-select:none;-webkit-user-select:none}
.kt-hold.on{filter:brightness(1.3);transform:translateY(2px)}
.kt-note{min-height:20px;font-weight:800;font-size:13px;color:#ffe9a0}
`;

const W = 600, H = 380, TOP = 34, BOT = 318;
type Phase = 'idle' | 'play' | 'result';
const px = (x: number) => x * W;
const py = (y: number) => BOT - y * (BOT - TOP);

function drawItem(c: CanvasRenderingContext2D, it: Item, x: number, y: number, t: number) {
  c.save(); c.translate(x, y);
  if (it.kind === 'fish') { // 小鱼干
    c.rotate(Math.sin(t * 4 + it.id) * 0.2);
    c.fillStyle = '#e8a050'; c.beginPath(); c.ellipse(0, 0, 18, 9, 0, 0, 7); c.fill();
    c.beginPath(); c.moveTo(14, 0); c.lineTo(26, -9); c.lineTo(26, 9); c.fill();
    c.strokeStyle = '#b8783a'; c.lineWidth = 1.5; for (const dx of [-6, 0, 6]) { c.beginPath(); c.moveTo(dx, -6); c.lineTo(dx + 3, 6); c.stroke(); }
    c.fillStyle = '#3a2a1a'; c.beginPath(); c.arc(-11, -2, 2, 0, 7); c.fill();
  } else if (it.kind === 'bell') { // 金铃铛
    const s = 1 + Math.sin(t * 8) * 0.06; c.scale(s, s);
    const halo = c.createRadialGradient(0, 0, 4, 0, 0, 30); halo.addColorStop(0, 'rgba(255,230,120,.7)'); halo.addColorStop(1, 'rgba(255,230,120,0)'); c.fillStyle = halo; c.beginPath(); c.arc(0, 0, 30, 0, 7); c.fill();
    c.fillStyle = '#ffd24a'; c.beginPath(); c.arc(0, 0, 15, 0, 7); c.fill();
    c.fillStyle = '#e8a020'; c.fillRect(-15, -3, 30, 5);
    c.fillStyle = '#7a4a10'; c.beginPath(); c.arc(0, 7, 3, 0, 7); c.fill(); c.fillRect(-1, 7, 2, 6);
    c.fillStyle = '#d9483b'; c.beginPath(); c.arc(0, -16, 4, 0, 7); c.fill();
  } else { // 乌云 + 小闪电
    c.fillStyle = '#5a6070';
    for (const [dx, dy, r] of [[-16, 4, 14], [0, -6, 18], [16, 3, 14], [4, 8, 14]] as const) { c.beginPath(); c.arc(dx, dy, r, 0, 7); c.fill(); }
    c.fillStyle = '#ffffff'; for (const s of [-1, 1]) { c.beginPath(); c.arc(s * 7, -2, 2.4, 0, 7); c.fill(); } // 不高兴的眼睛
    c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.beginPath(); c.arc(0, 8, 5, Math.PI + 0.4, -0.4); c.stroke();
    if (Math.sin(t * 9 + it.id) > 0.3) { c.fillStyle = '#ffe27a'; c.beginPath(); c.moveTo(-2, 18); c.lineTo(6, 18); c.lineTo(0, 28); c.lineTo(5, 28); c.lineTo(-5, 42); c.lineTo(-1, 30); c.lineTo(-6, 30); c.fill(); }
  }
  c.restore();
}
function drawKite(c: CanvasRenderingContext2D, x: number, y: number, tilt: number, wet: number, t: number) {
  // 线：从左下角岛边拉上来
  c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(18, BOT + 30); c.quadraticCurveTo(x - 40, (y + BOT) / 2 + 40, x - 6, y + 20); c.stroke();
  c.save(); c.translate(x, y); c.rotate(tilt);
  // 尾巴
  c.strokeStyle = '#ff6a8a'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(0, 26);
  for (let i = 1; i <= 5; i++) c.lineTo(-i * 9, 26 + Math.sin(t * 8 + i) * 6); c.stroke();
  for (let i = 1; i <= 4; i++) { c.fillStyle = i % 2 ? '#ffd24a' : '#ff9ad0'; c.beginPath(); c.arc(-i * 11, 26 + Math.sin(t * 8 + i * 1.2) * 6, 3.5, 0, 7); c.fill(); }
  // 菱形猫脸纸鸢
  c.fillStyle = wet > 0 ? '#9aa4b8' : '#fff4e0'; c.strokeStyle = '#d9483b'; c.lineWidth = 3;
  c.beginPath(); c.moveTo(0, -30); c.lineTo(26, 0); c.lineTo(0, 28); c.lineTo(-26, 0); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = wet > 0 ? '#9aa4b8' : '#fff4e0'; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 6, -24); c.lineTo(s * 16, -38); c.lineTo(s * 18, -14); c.closePath(); c.fill(); c.stroke(); }
  c.fillStyle = '#3a2a1a'; for (const s of [-1, 1]) { c.beginPath(); c.arc(s * 8, -4, 3, 0, 7); c.fill(); }
  c.fillStyle = '#ff9ab0'; c.beginPath(); c.moveTo(-3, 4); c.lineTo(3, 4); c.lineTo(0, 7); c.fill();
  c.strokeStyle = '#3a2a1a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, 7); c.lineTo(-4, 11); c.moveTo(0, 7); c.lineTo(4, 11); c.stroke();
  if (wet > 0) { c.fillStyle = '#7ab8ff'; for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(-12 + i * 12, 34 + ((t * 60 + i * 9) % 14), 2, 3.5, 0, 0, 7); c.fill(); } }
  c.restore();
}

/** 打开云海放纸鸢；玩家点「离开」后结束。 */
export function openKite(ctx: AppCtx, host: Element): Promise<void> {
  return new Promise((done) => {
    const ov = document.createElement('div');
    ov.className = 'fish-ov';
    ov.innerHTML = `<div class="fish-card" style="width:min(430px,94%)"><h3>🪁 云海放纸鸢</h3><div class="kt-hud"></div><canvas class="kt-cv" width="${W}" height="${H}"></canvas><div class="kt-time"><i></i></div><button class="btn kt-hold">🧶 按住收线</button><div class="kt-note"></div><div class="fish-info"></div><div class="fish-btns"><button class="btn green" data-kt="main">▶</button><button class="btn ghost" data-kt="close">${icon('close', 18)} 离开</button></div></div>`;
    host.appendChild(ov);
    const q = <T extends Element>(sel: string) => ov.querySelector(sel) as T;
    const cv = q<HTMLCanvasElement>('.kt-cv'), c = cv.getContext('2d')!, hud = q<HTMLElement>('.kt-hud'), note = q<HTMLElement>('.kt-note'), info = q<HTMLElement>('.fish-info'), main = q<HTMLButtonElement>('[data-kt="main"]'), timeBar = q<HTMLElement>('.kt-time i'), holdBtn = q<HTMLButtonElement>('.kt-hold');
    let phase: Phase = 'idle', raf = 0, last = 0, g: Game = newGame([]), btnHold = false, cvHold = false, keyHold = false;
    const pops: { x: number; y: number; t: number; col: string; text: string }[] = [];
    const holding = () => btnHold || cvHold || keyHold;

    const refresh = () => { info.innerHTML = `🎮 今日剩余 ${runsLeft(ctx.s)} 局`; };
    const refreshHud = () => { hud.innerHTML = `<span>🐟 <b>${g.got}</b> 样</span><span>⭐ <b>${g.score}</b></span><span>⏱ ${Math.max(0, Math.ceil(DURATION - g.t))}</span>`; };
    const draw = () => {
      const sky = c.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#7ab0f0'); sky.addColorStop(1, '#d8ecff'); c.fillStyle = sky; c.fillRect(0, 0, W, H);
      c.fillStyle = 'rgba(255,255,255,.55)'; // 远处慢慢飘的白云
      for (let i = 0; i < 5; i++) { const x = ((i * 170 - g.t * 22) % (W + 200) + W + 200) % (W + 200) - 100, y = 60 + (i % 3) * 70; c.beginPath(); c.ellipse(x, y, 60, 16, 0, 0, 7); c.ellipse(x + 30, y - 10, 34, 14, 0, 0, 7); c.fill(); }
      // 云海：下沿一层层起伏的云
      for (let k = 0; k < 3; k++) {
        c.fillStyle = ['#e8f2ff', '#f4f8ff', '#ffffff'][k];
        c.beginPath(); c.moveTo(0, H);
        for (let x = 0; x <= W; x += 20) c.lineTo(x, BOT + 18 + k * 14 + Math.sin(x * 0.03 + g.t * (1 + k * 0.6) + k) * 8);
        c.lineTo(W, H); c.fill();
      }
      for (const it of g.plan) {
        if (g.done.has(it.id)) continue;
        const x = xOf(it, g.t); if (x == null) continue;
        drawItem(c, it, px(x), py(it.y), g.t);
      }
      drawKite(c, px(KITE_X), py(g.y), -g.vy * 0.25, g.wet, g.t);
      for (let i = pops.length - 1; i >= 0; i--) {
        const p = pops[i], a = g.t - p.t; if (a > 0.8) { pops.splice(i, 1); continue; }
        c.globalAlpha = 1 - a / 0.8; c.fillStyle = p.col; c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 3; c.font = '900 24px sans-serif'; c.textAlign = 'center';
        c.strokeText(p.text, p.x + 30, p.y - 20 - a * 40); c.fillText(p.text, p.x + 30, p.y - 20 - a * 40); c.globalAlpha = 1;
      }
      if (phase !== 'play') { c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(0, 0, W, H); }
    };
    const idle = () => {
      phase = 'idle'; g = newGame([]); timeBar.style.width = '100%'; refresh(); refreshHud(); draw();
      const ok = runsLeft(ctx.s) > 0;
      main.style.display = ''; main.disabled = !ok; main.innerHTML = ok ? '▶ 放飞' : '😴 今天玩够啦';
      note.innerHTML = ok ? `按住收线纸鸢上升，松手往下飘：${NAME.fish} +${SCORE.fish}、${NAME.bell} +${SCORE.bell}，${NAME.storm}要躲（${SCORE.storm}，纸鸢淋湿会变沉）。${starsHtml(1, 3, 14)} ${TIERS.join(' / ')}` : '';
    };
    const start = () => {
      if (!useRun(ctx.s)) { idle(); return; }
      ctx.save(); g = newGame(makeSchedule(Math.random)); phase = 'play'; last = performance.now(); pops.length = 0;
      main.style.display = 'none'; note.textContent = ''; refresh(); refreshHud();
      cancelAnimationFrame(raf); raf = requestAnimationFrame(tick);
    };
    const tick = (now: number) => {
      if (phase !== 'play') return;
      let real = Math.min(0.25, (now - last) / 1000); last = now;
      while (real > 1e-6) {
        const dt = Math.min(0.05, real); real -= dt;
        for (const r of step(g, holding(), dt)) {
          if (!r.hit) continue;
          const storm = r.it.kind === 'storm';
          pops.push({ x: px(KITE_X), y: py(r.it.y), t: g.t, col: storm ? '#7a8aa8' : r.it.kind === 'bell' ? '#ffd24a' : '#ffffff', text: storm ? `${SCORE.storm} 🌧️` : `+${SCORE[r.it.kind]}` });
          if (storm) { sfx.no(); note.textContent = '🌧️ 撞上乌云，纸鸢淋湿变沉了'; } else (r.it.kind === 'bell' ? sfx.coin : sfx.tap)();
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
      const tier = tierOf(g.score), gain = kiteGain(ctx.s, tier);
      if (tier > 0) { applyGain(ctx.s, gain); sfx.win(); } else sfx.no();
      recordKite(ctx.s, g.got); if (tier === 3 && dailyEgg(ctx.s, dayIndex())) ctx.toast('🥚 三星奖励：获得一颗宠物蛋！'); ctx.save();
      main.style.display = ''; main.disabled = runsLeft(ctx.s) <= 0; main.innerHTML = main.disabled ? '😴 今天玩够啦' : '🔁 再放一次';
      note.innerHTML = `${starsHtml(tier)} ⭐ ${g.score} &nbsp; 🐟 收到 ${g.got} 样 &nbsp; ${tier > 0 ? gainIcons(gain, 18) : ''}`;
      refresh();
    };
    const setBtn = (on: boolean) => { btnHold = on; holdBtn.classList.toggle('on', on); };
    holdBtn.addEventListener('pointerdown', (e) => { holdBtn.setPointerCapture?.(e.pointerId); setBtn(true); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) holdBtn.addEventListener(ev, () => setBtn(false));
    cv.addEventListener('pointerdown', (e) => { cvHold = true; cv.setPointerCapture(e.pointerId); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) cv.addEventListener(ev, () => { cvHold = false; });
    const isHoldKey = (e: KeyboardEvent) => e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW';
    const onKey = (e: KeyboardEvent) => {
      if (phase === 'play' && isHoldKey(e)) { keyHold = true; e.preventDefault(); }
      else if ((e.code === 'Space' || e.key === 'Enter') && phase !== 'play') { e.preventDefault(); press(); }
      else if (e.key === 'Escape') close();
    };
    const onKeyUp = (e: KeyboardEvent) => { if (isHoldKey(e)) keyHold = false; };
    const press = () => { if (main.disabled) return; if (phase === 'idle' || phase === 'result') start(); };
    const close = () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp); ov.remove(); ctx.save(); done(); };
    ov.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest('[data-kt]') as HTMLElement | null; if (!b) return; if (b.dataset.kt === 'close') close(); else press(); });
    window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKeyUp);
    idle();
  });
}
