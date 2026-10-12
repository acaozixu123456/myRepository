// 夜市套圈界面（喵洲夜市东侧摊位）：先点一下定方向，再点一下定力度，圈飞出去落到桩上就套中。规则在 game/ringtoss.ts。
import { dailyEgg } from '../../game/pets';
import { dayIndex } from '../../game/premium';
import { PRIZE_NAME, PRIZE_SCORE, RINGS, RING_R, TIERS, aimAt, isOver, newToss, powerAt, recordWon, ringGain, runsLeft, tierOf, toss, useRun } from '../../game/ringtoss';
import type { Peg, PrizeKind, ThrowResult, Toss } from '../../game/ringtoss';
import { gainIcons, starsHtml } from '../../ui/gain';
import { icon } from '../../ui/icons';
import { applyGain } from '../../game/stage';
import { sfx } from '../sfx';
import type { AppCtx } from '../ctx';

export const RINGTOSS_CSS = `
.rt-cv{display:block;margin:6px auto;max-width:100%;max-height:46vh;border-radius:14px;border:3px solid #ffb04a;box-shadow:0 0 18px rgba(255,176,74,.4);background:#3a1e14;touch-action:none;cursor:pointer}
.rt-hud{display:flex;justify-content:space-between;align-items:center;font-weight:800;font-size:14px}
.rt-hud b{color:#ffe27a;font-size:18px}
.rt-note{min-height:20px;font-weight:800;font-size:13px;color:#ffe9a0}
`;

const W = 600, H = 380, TOP = 70, BOT = 330, CX = W / 2, LAUNCH = { x: CX, y: H - 14 };
type Phase = 'idle' | 'aim' | 'power' | 'fly' | 'result';
/** 场地坐标 → 画布：越远越窄（一点点透视） */
const halfW = (y: number) => 250 - y * 90;
const sx = (x: number, y: number) => CX + x * halfW(y);
const sy = (y: number) => BOT - y * (BOT - TOP);
const scaleAt = (y: number) => 1 - y * 0.35;

function drawPrize(c: CanvasRenderingContext2D, kind: PrizeKind, k: number) {
  if (kind === 'fish') { c.fillStyle = '#e8a04a'; c.beginPath(); c.ellipse(0, -8 * k, 11 * k, 5 * k, 0, 0, 7); c.fill(); c.beginPath(); c.moveTo(9 * k, -8 * k); c.lineTo(16 * k, -13 * k); c.lineTo(16 * k, -3 * k); c.fill(); c.fillStyle = '#3a2010'; c.beginPath(); c.arc(-6 * k, -9 * k, 1.5 * k, 0, 7); c.fill(); }
  else if (kind === 'yarn') { c.fillStyle = '#ff7ab8'; c.beginPath(); c.arc(0, -10 * k, 10 * k, 0, 7); c.fill(); c.strokeStyle = '#c84a88'; c.lineWidth = 1.5 * k; for (const a of [-0.6, 0, 0.6]) { c.beginPath(); c.ellipse(0, -10 * k, 10 * k, 4 * k, a, 0, 7); c.stroke(); } }
  else if (kind === 'bell') { c.fillStyle = '#ffd24a'; c.beginPath(); c.arc(0, -10 * k, 10 * k, Math.PI, 0); c.lineTo(11 * k, -3 * k); c.lineTo(-11 * k, -3 * k); c.fill(); c.fillStyle = '#a07010'; c.beginPath(); c.arc(0, -2 * k, 2.5 * k, 0, 7); c.fill(); }
  else {
    c.shadowColor = '#ffe27a'; c.shadowBlur = 14;
    c.fillStyle = '#fff4e0'; c.beginPath(); c.arc(0, -14 * k, 11 * k, 0, 7); c.fill(); c.beginPath(); c.ellipse(0, -2 * k, 12 * k, 8 * k, 0, 0, 7); c.fill();
    c.shadowBlur = 0;
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 9 * k, -20 * k); c.lineTo(s * 8 * k, -29 * k); c.lineTo(s * 2 * k, -23 * k); c.fill(); }
    c.fillStyle = '#d9483b'; c.beginPath(); c.arc(0, -6 * k, 3 * k, 0, 7); c.fill();
    c.fillStyle = '#3a2010'; for (const s of [-1, 1]) { c.beginPath(); c.arc(s * 4 * k, -15 * k, 1.5 * k, 0, 7); c.fill(); }
    c.strokeStyle = '#ffd24a'; c.lineWidth = 3 * k; c.beginPath(); c.moveTo(9 * k, -4 * k); c.lineTo(15 * k, -22 * k); c.stroke(); // 招手
  }
}
function drawPeg(c: CanvasRenderingContext2D, p: Peg) {
  const x = sx(p.x, p.y), y = sy(p.y), k = scaleAt(p.y);
  c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(x, y + 2, 16 * k, 5 * k, 0, 0, 7); c.fill();
  c.fillStyle = '#c89a5a'; c.fillRect(x - 3 * k, y - 16 * k, 6 * k, 18 * k);
  c.save(); c.translate(x, y - 16 * k); drawPrize(c, p.kind, k * 1.35); c.restore();
}
function drawRing(c: CanvasRenderingContext2D, x: number, y: number, k: number, col = '#ff5aa0') {
  c.strokeStyle = col; c.lineWidth = 5 * k; c.beginPath(); c.ellipse(x, y, RING_R * halfW(0.5) * k * 1.1, RING_R * halfW(0.5) * k * 0.45, 0, 0, 7); c.stroke();
}

/** 打开套圈；玩家点「离开」后结束。 */
export function openRingToss(ctx: AppCtx, host: Element): Promise<void> {
  return new Promise((done) => {
    const ov = document.createElement('div');
    ov.className = 'fish-ov';
    ov.innerHTML = `<div class="fish-card" style="width:min(430px,94%)"><h3>⭕ 夜市套圈</h3><div class="rt-hud"></div><canvas class="rt-cv" width="${W}" height="${H}"></canvas><div class="rt-note"></div><div class="fish-info"></div><div class="fish-btns"><button class="btn green" data-rt="main">▶</button><button class="btn ghost" data-rt="close">${icon('close', 18)} 离开</button></div></div>`;
    host.appendChild(ov);
    const q = <T extends Element>(sel: string) => ov.querySelector(sel) as T;
    const cv = q<HTMLCanvasElement>('.rt-cv'), c = cv.getContext('2d')!, hud = q<HTMLElement>('.rt-hud'), note = q<HTMLElement>('.rt-note'), info = q<HTMLElement>('.fish-info'), main = q<HTMLButtonElement>('[data-rt="main"]');
    let phase: Phase = 'idle', raf = 0, last = 0, t: Toss = newToss(Math.random), clock = 0, aim = 0, power = 0, fly = 0, res: ThrowResult | null = null;
    const landed: { x: number; y: number; hit: boolean }[] = [];

    const refresh = () => { info.innerHTML = `🎮 今日剩余 ${runsLeft(ctx.s)} 局`; };
    const refreshHud = () => { hud.innerHTML = `<span>⭕ <b>${RINGS - t.thrown}</b>/${RINGS}</span><span>⭐ <b>${t.score}</b></span><span style="font-size:12px">🐟${PRIZE_SCORE.fish} 🧶${PRIZE_SCORE.yarn} 🔔${PRIZE_SCORE.bell} 🐱${PRIZE_SCORE.lucky}</span>`; };
    const draw = () => {
      // 摊位：暖色木地板 + 远处的红布幕 + 一串灯笼
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#5a2418'); g.addColorStop(0.2, '#8a4a2a'); g.addColorStop(1, '#b07040'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      c.fillStyle = '#c8282a'; c.fillRect(0, 0, W, TOP - 22);
      for (let i = 0; i < 9; i++) { c.fillStyle = '#ffb04a'; c.globalAlpha = 0.9; c.beginPath(); c.ellipse(40 + i * 65, TOP - 30, 9, 11, 0, 0, 7); c.fill(); c.globalAlpha = 1; }
      c.strokeStyle = 'rgba(60,30,10,.35)'; c.lineWidth = 1; for (let i = 1; i < 8; i++) { const y = sy(i / 8); c.beginPath(); c.moveTo(sx(-1.05, i / 8), y); c.lineTo(sx(1.05, i / 8), y); c.stroke(); }
      c.strokeStyle = '#ffe27a'; c.lineWidth = 2; c.beginPath(); c.moveTo(sx(-1.05, 0), sy(0)); c.lineTo(sx(-1.05, 1), sy(1)); c.lineTo(sx(1.05, 1), sy(1)); c.lineTo(sx(1.05, 0), sy(0)); c.stroke();
      // 远的先画
      for (const p of [...t.pegs].sort((a, b) => b.y - a.y)) drawPeg(c, p);
      for (const l of landed) if (!l.hit) drawRing(c, sx(l.x, l.y), sy(l.y), scaleAt(l.y), 'rgba(255,90,160,.45)');
      // 瞄准：方向线 + 力度标记
      if (phase === 'aim' || phase === 'power') {
        const y1 = phase === 'power' ? power : 1;
        c.strokeStyle = 'rgba(255,255,255,.55)'; c.setLineDash([8, 8]); c.lineWidth = 2; c.beginPath(); c.moveTo(LAUNCH.x, LAUNCH.y); c.lineTo(sx(aim, y1), sy(y1)); c.stroke(); c.setLineDash([]);
        if (phase === 'power') drawRing(c, sx(aim, power), sy(power), scaleAt(power), '#ffe27a');
        // 力度条
        c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(W - 26, TOP, 14, BOT - TOP);
        if (phase === 'power') { const h = (power - 0.12) / 0.88 * (BOT - TOP); c.fillStyle = '#ffb04a'; c.fillRect(W - 26, BOT - h, 14, h); }
      }
      if (phase === 'fly' && res) {
        const k = Math.min(1, fly), x = LAUNCH.x + (sx(res.x, res.y) - LAUNCH.x) * k, y0 = LAUNCH.y + (sy(res.y) - LAUNCH.y) * k - Math.sin(k * Math.PI) * 90;
        drawRing(c, x, y0, 1 - k * 0.35 * res.y);
      }
      // 玩家手里的圈
      if (phase === 'aim' || phase === 'power') drawRing(c, LAUNCH.x, LAUNCH.y - 4, 1.1);
    };
    const idle = () => {
      phase = 'idle'; t = newToss(Math.random); landed.length = 0; refresh(); refreshHud(); draw();
      const ok = runsLeft(ctx.s) > 0;
      main.disabled = !ok; main.innerHTML = ok ? '▶ 买 5 个圈' : '😴 今天玩够啦';
      note.innerHTML = ok ? `先点一下定方向，再点一下定力度。越远的奖品分越高，招财猫 ${PRIZE_SCORE.lucky} 分。${starsHtml(1, 3, 14)} ${TIERS.join(' / ')}` : '';
    };
    const start = () => {
      if (!useRun(ctx.s)) { idle(); return; }
      ctx.save(); t = newToss(Math.random); landed.length = 0; phase = 'aim'; clock = Math.random() * 2; last = performance.now();
      main.innerHTML = '🎯 定方向'; note.textContent = ''; refresh(); refreshHud();
      cancelAnimationFrame(raf); raf = requestAnimationFrame(tick);
    };
    const press = () => {
      if (main.disabled) return;
      if (phase === 'aim') { phase = 'power'; clock = 0; main.innerHTML = '💪 定力度'; sfx.tap(); }
      else if (phase === 'power') { res = toss(t, aim, power); fly = 0; phase = 'fly'; main.disabled = true; sfx.tap(); }
      else if (phase === 'idle' || phase === 'result') start();
    };
    const tick = (now: number) => {
      const dt = Math.min(0.25, (now - last) / 1000); last = now; clock += dt;
      if (phase === 'aim') aim = aimAt(clock, t.thrown);
      else if (phase === 'power') power = powerAt(clock, t.thrown);
      else if (phase === 'fly' && res) {
        fly += dt * 1.7;
        if (fly >= 1) {
          landed.push({ x: res.x, y: res.y, hit: !!res.peg });
          if (res.peg) { note.textContent = `🎉 套中${PRIZE_NAME[res.peg.kind]}！+${PRIZE_SCORE[res.peg.kind]}`; sfx.coin(); } else { note.textContent = '😿 差一点，没套上'; sfx.no(); }
          res = null; refreshHud();
          if (isOver(t)) { draw(); finish(); return; }
          phase = 'aim'; clock = Math.random() * 2; main.disabled = false; main.innerHTML = '🎯 定方向';
        }
      }
      draw();
      raf = requestAnimationFrame(tick);
    };
    const finish = () => {
      cancelAnimationFrame(raf); raf = 0;
      const tier = tierOf(t.score), g = ringGain(ctx.s, tier);
      if (tier > 0) { applyGain(ctx.s, g); sfx.win(); } else sfx.no();
      recordWon(ctx.s, t.won.length); if (tier === 3 && dailyEgg(ctx.s, dayIndex())) ctx.toast('🥚 三星奖励：获得一颗宠物蛋！'); ctx.save();
      phase = 'result'; main.disabled = runsLeft(ctx.s) <= 0; main.innerHTML = main.disabled ? '😴 今天玩够啦' : '🔁 再来一局';
      note.innerHTML = `${starsHtml(tier)} ⭐ ${t.score} &nbsp; ${tier > 0 ? gainIcons(g, 18) : '一个都没套上，下次稳一点'}`;
      refresh();
    };
    const close = () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); ov.remove(); ctx.save(); done(); };
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); press(); } else if (e.key === 'Escape') close(); };
    cv.addEventListener('pointerdown', () => { if (phase === 'aim' || phase === 'power') press(); });
    ov.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest('[data-rt]') as HTMLElement | null; if (!b) return; if (b.dataset.rt === 'close') close(); else press(); });
    window.addEventListener('keydown', onKey);
    idle();
  });
}
