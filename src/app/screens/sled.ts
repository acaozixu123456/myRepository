// 雪橇滑坡界面（喵雪岭西北大雪坡）：伪 3D 的三条雪道从远处迎面而来，左右换道躲树和石头、接小鱼干。规则在 game/sled.ts。
import { dailyEgg } from '../../game/pets';
import { dayIndex } from '../../game/premium';
import { DURATION, HEARTS, HEART_BONUS, LANES, TIERS, finalScore, isHazard, isOver, makeCourse, newGame, recordSled, runsLeft, sledGain, steer, step, tierOf, useRun } from '../../game/sled';
import type { Game, Item } from '../../game/sled';
import { gainIcons, starsHtml } from '../../ui/gain';
import { icon } from '../../ui/icons';
import { applyGain } from '../../game/stage';
import { sfx } from '../sfx';
import type { AppCtx } from '../ctx';

export const SLED_CSS = `
.sd-cv{display:block;margin:6px auto;max-width:100%;max-height:50vh;border-radius:14px;border:3px solid #9ad8ff;box-shadow:0 0 18px rgba(154,216,255,.35);background:#eaf4ff;touch-action:none}
.sd-hud{display:flex;justify-content:space-between;align-items:center;font-weight:800;font-size:14px}
.sd-hud b{color:#ffe27a;font-size:18px}
.sd-time{height:6px;border-radius:3px;background:rgba(0,0,0,.3);overflow:hidden;margin-top:4px}
.sd-time i{display:block;height:100%;background:#9ad8ff;width:100%}
.sd-ctl{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:6px}
.sd-ctl .btn{font-size:22px;padding:10px 0;touch-action:manipulation;user-select:none;-webkit-user-select:none}
.sd-note{min-height:20px;font-weight:800;font-size:13px;color:#ffe9a0}
`;

const W = 400, H = 520, HOR = 120, BOT = 470, VIEW = 46;
type Phase = 'idle' | 'play' | 'result';
/** 距离 z（0 = 雪橇所在）→ 透视缩放 */
const scl = (z: number) => 1 / (1 + z * 0.12);
const yAt = (z: number) => HOR + (BOT - HOR) * scl(z);
const laneX = (lane: number, z: number) => W / 2 + (lane - (LANES - 1) / 2) * 110 * scl(z);

function drawItem(c: CanvasRenderingContext2D, it: Item, x: number, y: number, k: number, t: number) {
  c.save(); c.translate(x, y); c.scale(k, k);
  if (it.kind === 'tree') {
    c.fillStyle = '#6a4a32'; c.fillRect(-6, -14, 12, 16);
    for (let i = 0; i < 3; i++) { c.fillStyle = i % 2 ? '#3a8a62' : '#2f7a5a'; c.beginPath(); c.moveTo(0, -100 + i * 26); c.lineTo(36 - i * 6, -30 + i * 12); c.lineTo(-36 + i * 6, -30 + i * 12); c.fill(); c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(0, -100 + i * 26); c.lineTo(14 - i * 2, -78 + i * 26); c.lineTo(-14 + i * 2, -78 + i * 26); c.fill(); }
  } else if (it.kind === 'rock') {
    c.fillStyle = '#7a8090'; c.beginPath(); c.moveTo(-34, 0); c.lineTo(-24, -30); c.lineTo(4, -40); c.lineTo(30, -22); c.lineTo(34, 0); c.fill();
    c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(-24, -30); c.lineTo(4, -40); c.lineTo(30, -22); c.lineTo(10, -30); c.fill();
  } else if (it.kind === 'gate') {
    for (const s of [-1, 1]) { c.fillStyle = '#d8d0c0'; c.fillRect(s * 46 - 3, -60, 6, 60); c.fillStyle = s < 0 ? '#ff5a4a' : '#4ac8ff'; c.beginPath(); c.moveTo(s * 46, -60); c.lineTo(s * 46 - s * 24, -50); c.lineTo(s * 46, -40); c.fill(); }
  } else if (it.kind === 'fish') {
    c.translate(0, -26 + Math.sin(t * 5) * 4);
    c.fillStyle = '#e8a050'; c.beginPath(); c.ellipse(0, 0, 18, 9, 0, 0, 7); c.fill(); c.beginPath(); c.moveTo(14, 0); c.lineTo(26, -9); c.lineTo(26, 9); c.fill();
    c.fillStyle = '#3a2a1a'; c.beginPath(); c.arc(-10, -2, 2, 0, 7); c.fill();
  } else {
    c.translate(0, -28 + Math.sin(t * 5) * 4);
    const g = c.createRadialGradient(0, 0, 4, 0, 0, 30); g.addColorStop(0, 'rgba(255,230,120,.8)'); g.addColorStop(1, 'rgba(255,230,120,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 30, 0, 7); c.fill();
    c.fillStyle = '#ffd24a'; c.beginPath(); c.arc(0, 0, 15, 0, 7); c.fill(); c.fillStyle = '#e8a020'; c.fillRect(-15, -3, 30, 5); c.fillStyle = '#d9483b'; c.beginPath(); c.arc(0, -16, 4, 0, 7); c.fill();
  }
  c.restore();
}
function drawSled(c: CanvasRenderingContext2D, x: number, stun: number, tilt: number, t: number) {
  const y = BOT + 4;
  c.save(); c.translate(x, y); c.rotate(tilt * 0.25 + (stun > 0 ? Math.sin(t * 40) * 0.08 : 0));
  c.fillStyle = 'rgba(80,110,160,.25)'; c.beginPath(); c.ellipse(0, 6, 46, 10, 0, 0, 7); c.fill();
  c.strokeStyle = '#8a5a3a'; c.lineWidth = 4; c.beginPath(); c.moveTo(-40, 2); c.lineTo(34, 2); c.quadraticCurveTo(48, 2, 44, -12); c.stroke();
  c.fillStyle = '#d83a30'; c.fillRect(-36, -14, 70, 12);
  // 猫：橘色身子 + 头 + 耳朵 + 红围巾
  c.fillStyle = '#e8a050'; c.beginPath(); c.ellipse(-4, -30, 20, 18, 0, 0, 7); c.fill();
  c.beginPath(); c.arc(-2, -56, 16, 0, 7); c.fill();
  for (const s of [-1, 1]) { c.beginPath(); c.moveTo(-2 + s * 6, -68); c.lineTo(-2 + s * 15, -80); c.lineTo(-2 + s * 15, -62); c.fill(); }
  c.fillStyle = '#3a8ad8'; c.fillRect(-18, -44, 34, 7); c.fillRect(8, -44, 7, 18);
  c.fillStyle = '#3a2a1a'; for (const s of [-1, 1]) { c.beginPath(); c.arc(-2 + s * 6, -57, 2.2, 0, 7); c.fill(); }
  c.restore();
}

/** 打开雪橇滑坡；玩家点「离开」后结束。 */
export function openSled(ctx: AppCtx, host: Element): Promise<void> {
  return new Promise((done) => {
    const ov = document.createElement('div');
    ov.className = 'fish-ov';
    ov.innerHTML = `<div class="fish-card" style="width:min(400px,94%)"><h3>🛷 雪橇滑坡</h3><div class="sd-hud"></div><canvas class="sd-cv" width="${W}" height="${H}"></canvas><div class="sd-time"><i></i></div><div class="sd-ctl"><button class="btn" data-k="L">◀</button><button class="btn" data-k="R">▶</button></div><div class="sd-note"></div><div class="fish-info"></div><div class="fish-btns"><button class="btn green" data-sd="main">▶</button><button class="btn ghost" data-sd="close">${icon('close', 18)} 离开</button></div></div>`;
    host.appendChild(ov);
    const q = <T extends Element>(sel: string) => ov.querySelector(sel) as T;
    const cv = q<HTMLCanvasElement>('.sd-cv'), c = cv.getContext('2d')!, hud = q<HTMLElement>('.sd-hud'), note = q<HTMLElement>('.sd-note'), info = q<HTMLElement>('.fish-info'), main = q<HTMLButtonElement>('[data-sd="main"]'), timeBar = q<HTMLElement>('.sd-time i'), ctl = q<HTMLElement>('.sd-ctl');
    let phase: Phase = 'idle', raf = 0, last = 0, g: Game = newGame([]), shownX = laneX(1, 0), tilt = 0;
    const pops: { x: number; t: number; col: string; text: string }[] = [];
    const taken = new Set<string>();

    const refresh = () => { info.innerHTML = `🎮 今日剩余 ${runsLeft(ctx.s)} 局`; };
    const refreshHud = () => { hud.innerHTML = `<span>${'❤️'.repeat(Math.max(0, g.hearts))}${'🤍'.repeat(Math.max(0, HEARTS - g.hearts))}</span><span>⭐ <b>${g.score}</b></span><span>📏 ${Math.round(g.pos)} 米</span>`; };
    const draw = () => {
      const sky = c.createLinearGradient(0, 0, 0, HOR); sky.addColorStop(0, '#5a9ae8'); sky.addColorStop(1, '#d8ecff'); c.fillStyle = sky; c.fillRect(0, 0, W, HOR);
      c.fillStyle = '#b4c4dc'; c.beginPath(); c.moveTo(0, HOR); for (let x = 0; x <= W; x += 50) c.lineTo(x, HOR - 30 - Math.abs(Math.sin(x * 0.02 + 1)) * 40); c.lineTo(W, HOR); c.fill();
      c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(0, HOR); for (let x = 0; x <= W; x += 50) c.lineTo(x, HOR - 18 - Math.abs(Math.sin(x * 0.02 + 1)) * 26); c.lineTo(W, HOR); c.fill();
      const snow = c.createLinearGradient(0, HOR, 0, H); snow.addColorStop(0, '#e4eefa'); snow.addColorStop(1, '#ffffff'); c.fillStyle = snow; c.fillRect(0, HOR, W, H - HOR);
      // 雪道边线 + 往后流的雪痕
      c.strokeStyle = 'rgba(120,160,210,.35)'; c.lineWidth = 2;
      for (let l = 0; l <= LANES; l++) { const ln = l - 0.5; c.beginPath(); c.moveTo(laneX(ln, VIEW), yAt(VIEW)); c.lineTo(laneX(ln, 0), yAt(0)); c.stroke(); }
      c.fillStyle = 'rgba(150,180,220,.4)';
      for (let i = 0; i < 14; i++) { const z = ((i * 3.3 - g.pos) % VIEW + VIEW) % VIEW, k = scl(z); c.fillRect(laneX(-1.2, z) - 10 * k, yAt(z), 20 * k, 2); c.fillRect(laneX(3.2, z) - 10 * k, yAt(z), 20 * k, 2); }
      // 远处的东西先画
      const vis = g.course.filter((r) => r.d - g.pos > -1 && r.d - g.pos < VIEW).reverse();
      for (const r of vis) {
        const z = Math.max(0, r.d - g.pos), k = scl(z) * 1.25;
        for (const it of r.items) { if (taken.has(`${r.id}:${it.lane}`)) continue; drawItem(c, it, laneX(it.lane, z), yAt(z), k, g.t); }
      }
      const tx = laneX(g.lane, 0); shownX += (tx - shownX) * 0.35; tilt = (tx - shownX) / 60;
      drawSled(c, shownX, g.stun, tilt, g.t);
      for (let i = pops.length - 1; i >= 0; i--) {
        const p = pops[i], a = g.t - p.t; if (a > 0.8) { pops.splice(i, 1); continue; }
        c.globalAlpha = 1 - a / 0.8; c.fillStyle = p.col; c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 3; c.font = '900 24px sans-serif'; c.textAlign = 'center';
        c.strokeText(p.text, p.x, BOT - 100 - a * 40); c.fillText(p.text, p.x, BOT - 100 - a * 40); c.globalAlpha = 1;
      }
      if (phase !== 'play') { c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(0, 0, W, H); }
    };
    const idle = () => {
      phase = 'idle'; g = newGame(makeCourse(Math.random)); taken.clear(); timeBar.style.width = '100%'; refresh(); refreshHud(); draw();
      const ok = runsLeft(ctx.s) > 0;
      main.style.display = ''; main.disabled = !ok; main.innerHTML = ok ? '▶ 出发' : '😴 今天玩够啦';
      note.innerHTML = ok ? `左右换道躲开雪松和石头（撞了 −1 ❤️）；🐟 +1、🔔 +3、穿过小旗门 +2；滑到底剩下的心每颗 +${HEART_BONUS}。${starsHtml(1, 3, 14)} ${TIERS.join(' / ')}` : '';
    };
    const start = () => {
      if (!useRun(ctx.s)) { idle(); return; }
      ctx.save(); g = newGame(makeCourse(Math.random)); taken.clear(); phase = 'play'; last = performance.now(); pops.length = 0; shownX = laneX(1, 0);
      main.style.display = 'none'; note.textContent = ''; refresh(); refreshHud();
      cancelAnimationFrame(raf); raf = requestAnimationFrame(tick);
    };
    const tick = (now: number) => {
      if (phase !== 'play') return;
      let real = Math.min(0.25, (now - last) / 1000); last = now;
      while (real > 1e-6 && !isOver(g)) {
        const dt = Math.min(0.05, real); real -= dt;
        for (const r of step(g, dt)) {
          if (!r.hit) continue;
          taken.add(`${r.row.id}:${r.hit.lane}`);
          if (isHazard(r.hit.kind)) { sfx.no(); pops.push({ x: laneX(g.lane, 0), t: g.t, col: '#ff6a5a', text: '💥 −1 ❤️' }); note.textContent = r.hit.kind === 'tree' ? '🌲 撞到雪松了，慢一下…' : '🪨 磕到石头了，慢一下…'; }
          else { (r.hit.kind === 'fish' ? sfx.tap : sfx.coin)(); pops.push({ x: laneX(g.lane, 0), t: g.t, col: r.hit.kind === 'bell' ? '#ffd24a' : r.hit.kind === 'gate' ? '#4ac8ff' : '#ffffff', text: `+${r.hit.kind === 'bell' ? 3 : r.hit.kind === 'gate' ? 2 : 1}` }); }
        }
      }
      timeBar.style.width = `${Math.max(0, (DURATION - g.t) / DURATION) * 100}%`;
      refreshHud(); draw();
      if (isOver(g)) { finish(); return; }
      raf = requestAnimationFrame(tick);
    };
    const finish = () => {
      cancelAnimationFrame(raf); raf = 0; phase = 'result'; draw();
      const score = finalScore(g), tier = tierOf(score), gain = sledGain(ctx.s, tier);
      if (tier > 0) { applyGain(ctx.s, gain); sfx.win(); } else sfx.no();
      recordSled(ctx.s, g.pos); if (tier === 3 && dailyEgg(ctx.s, dayIndex())) ctx.toast('🥚 三星奖励：获得一颗宠物蛋！'); ctx.save();
      main.style.display = ''; main.disabled = runsLeft(ctx.s) <= 0; main.innerHTML = main.disabled ? '😴 今天玩够啦' : '🔁 再滑一次';
      const bonus = g.t >= DURATION ? g.hearts * HEART_BONUS : 0;
      note.innerHTML = `${starsHtml(tier)} ⭐ ${score}${bonus ? `（含剩余的心 +${bonus}）` : '（心用完了）'} &nbsp; 📏 ${Math.round(g.pos)} 米 &nbsp; ${tier > 0 ? gainIcons(gain, 18) : ''}`;
      refresh();
    };
    const move = (d: number) => { if (phase === 'play') { steer(g, d); sfx.tap(); } };
    ctl.addEventListener('pointerdown', (e) => { const b = (e.target as HTMLElement).closest('[data-k]') as HTMLElement | null; if (b) { e.preventDefault(); move(b.dataset.k === 'L' ? -1 : 1); } });
    // 在雪道上：点左半边 / 右半边换道，或者左右滑
    let sx: number | null = null;
    cv.addEventListener('pointerdown', (e) => { sx = e.clientX; });
    cv.addEventListener('pointerup', (e) => {
      if (sx == null) return;
      const r = cv.getBoundingClientRect(), dx = e.clientX - sx; sx = null;
      if (Math.abs(dx) > 24) move(dx < 0 ? -1 : 1); else move(e.clientX - r.left < r.width / 2 ? -1 : 1);
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') { move(-1); e.preventDefault(); }
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') { move(1); e.preventDefault(); }
      else if ((e.code === 'Space' || e.key === 'Enter') && phase !== 'play') { e.preventDefault(); press(); }
      else if (e.key === 'Escape') close();
    };
    const press = () => { if (main.disabled) return; if (phase === 'idle' || phase === 'result') start(); };
    const close = () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); ov.remove(); ctx.save(); done(); };
    ov.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest('[data-sd]') as HTMLElement | null; if (!b) return; if (b.dataset.sd === 'close') close(); else press(); });
    window.addEventListener('keydown', onKey);
    idle();
  });
}
