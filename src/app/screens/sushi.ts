// 回转寿司界面（樱汤乡汤屋旁的寿司小铺）：传送带从右往左转，柜台上坐着三位猫客，头顶是想吃的寿司和耐心条。
// 盘子转到想吃它的客人面前时点它，就端过去。寿司都是在 canvas 上画的（不靠系统 emoji，各设备一样）。规则在 game/sushi.ts。
import { dailyEgg } from '../../game/pets';
import { dayIndex } from '../../game/premium';
import { DISH_NAME, DURATION, REACH, SEAT_X, TIERS, newBelt, recordSushi, runsLeft, step, sushiGain, tapPlate, tierOf, useRun } from '../../game/sushi';
import type { Belt, Dish } from '../../game/sushi';
import { gainIcons, starsHtml } from '../../ui/gain';
import { icon } from '../../ui/icons';
import { applyGain } from '../../game/stage';
import { sfx } from '../sfx';
import type { AppCtx } from '../ctx';

export const SUSHI_CSS = `
.su-cv{display:block;margin:6px auto;max-width:100%;max-height:50vh;border-radius:14px;border:3px solid #ff9a6a;box-shadow:0 0 18px rgba(255,154,106,.35);background:#f4e4c8;touch-action:none;cursor:pointer}
.su-hud{display:flex;justify-content:space-between;align-items:center;font-weight:800;font-size:14px}
.su-hud b{color:#ffe27a;font-size:18px}
.su-time{height:6px;border-radius:3px;background:rgba(0,0,0,.3);overflow:hidden;margin-top:4px}
.su-time i{display:block;height:100%;background:#ff9a6a;width:100%}
.su-note{min-height:20px;font-weight:800;font-size:13px;color:#ffe9a0}
`;

const W = 520, H = 360, BELT_Y = 262, PAD = 30;
const px = (x: number) => PAD + x * (W - PAD * 2);
const FUR = ['#e8a050', '#f0f0f0', '#7a7a84', '#3a3a40', '#d8b890', '#f4d0a0'];
type Phase = 'idle' | 'play' | 'result';

/** 在 (x, y) 画一份寿司，s = 缩放 */
export function drawDish(c: CanvasRenderingContext2D, d: Dish, x: number, y: number, s = 1) {
  c.save(); c.translate(x, y); c.scale(s, s);
  const rice = () => { c.fillStyle = '#fffaf0'; c.beginPath(); c.ellipse(0, 3, 15, 7, 0, 0, 7); c.fill(); c.fillStyle = 'rgba(0,0,0,.08)'; for (let i = -10; i <= 10; i += 5) { c.beginPath(); c.arc(i, 5, 1.2, 0, 7); c.fill(); } };
  if (d === 'onigiri') {
    c.fillStyle = '#fffaf0'; c.beginPath(); c.moveTo(0, -14); c.quadraticCurveTo(16, 8, 12, 10); c.lineTo(-12, 10); c.quadraticCurveTo(-16, 8, 0, -14); c.fill();
    c.fillStyle = '#1a3a2a'; c.fillRect(-7, 0, 14, 10);
  } else if (d === 'naruto') {
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(0, 0, 12, 0, 7); c.fill(); c.strokeStyle = '#e8c8c8'; c.lineWidth = 1; c.stroke();
    c.strokeStyle = '#ff6a9a'; c.lineWidth = 2.4; c.beginPath(); for (let a = 0; a < 12; a += 0.2) { const r = a * 0.8; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.stroke();
  } else {
    rice();
    if (d === 'salmon') { c.fillStyle = '#ff8a5a'; c.beginPath(); c.ellipse(0, -2, 16, 7, -0.05, 0, 7); c.fill(); c.strokeStyle = '#ffd0b0'; c.lineWidth = 1.6; for (const i of [-8, -2, 4, 10]) { c.beginPath(); c.moveTo(i - 3, -7); c.lineTo(i + 2, 3); c.stroke(); } }
    else if (d === 'tuna') { c.fillStyle = '#d8304a'; c.beginPath(); c.ellipse(0, -2, 16, 7, -0.05, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.ellipse(-4, -5, 7, 2, -0.1, 0, 7); c.fill(); }
    else if (d === 'tamago') { c.fillStyle = '#ffd84a'; c.fillRect(-15, -9, 30, 11); c.fillStyle = '#e8b830'; c.fillRect(-15, -3, 30, 1.5); c.fillStyle = '#1a3a2a'; c.fillRect(-3, -10, 6, 17); }
    else if (d === 'shrimp') { // 弯成一道弧的大虾，白色条纹，红色尾巴扇
      c.strokeStyle = '#ffb090'; c.lineWidth = 9; c.lineCap = 'round'; c.beginPath(); c.arc(0, 6, 13, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
      c.strokeStyle = '#ffffff'; c.lineWidth = 1.6; for (const a of [1.3, 1.5, 1.7]) { c.beginPath(); c.moveTo(Math.cos(a * Math.PI) * 9, 6 + Math.sin(a * Math.PI) * 9); c.lineTo(Math.cos(a * Math.PI) * 17, 6 + Math.sin(a * Math.PI) * 17); c.stroke(); } c.lineCap = 'butt';
      c.fillStyle = '#e8302a'; c.beginPath(); c.moveTo(11, -2); c.lineTo(20, -12); c.lineTo(22, 0); c.lineTo(14, 2); c.fill(); }
  }
  c.restore();
}

/** 打开回转寿司；玩家点「离开」后结束。 */
export function openSushi(ctx: AppCtx, host: Element): Promise<void> {
  return new Promise((done) => {
    const ov = document.createElement('div');
    ov.className = 'fish-ov';
    ov.innerHTML = `<div class="fish-card" style="width:min(440px,94%)"><h3>🍣 回转寿司</h3><div class="su-hud"></div><canvas class="su-cv" width="${W}" height="${H}"></canvas><div class="su-time"><i></i></div><div class="su-note"></div><div class="fish-info"></div><div class="fish-btns"><button class="btn green" data-su="main">▶</button><button class="btn ghost" data-su="close">${icon('close', 18)} 离开</button></div></div>`;
    host.appendChild(ov);
    const q = <T extends Element>(sel: string) => ov.querySelector(sel) as T;
    const cv = q<HTMLCanvasElement>('.su-cv'), c = cv.getContext('2d')!, hud = q<HTMLElement>('.su-hud'), note = q<HTMLElement>('.su-note'), info = q<HTMLElement>('.fish-info'), main = q<HTMLButtonElement>('[data-su="main"]'), timeBar = q<HTMLElement>('.su-time i');
    let phase: Phase = 'idle', raf = 0, last = performance.now(), b: Belt = newBelt(Math.random);
    const fx: { t: number; x: number; y: number; text: string; col: string }[] = [];
    const happy = [0, 0, 0], grump = [0, 0, 0], fur = [0, 1, 2];

    const refresh = () => { info.innerHTML = `🎮 今日剩余 ${runsLeft(ctx.s)} 局`; };
    const refreshHud = () => { hud.innerHTML = `<span>🍣 上菜 <b>${b.served}</b></span><span>⭐ <b>${b.score}</b></span><span>😾 ${b.angry} · ❌ ${b.wrong}</span>`; };

    const draw = () => {
      const T = performance.now() / 1000;
      // 墙：木格窗 + 暖帘
      c.fillStyle = '#f4e4c8'; c.fillRect(0, 0, W, H);
      c.strokeStyle = '#c8a878'; c.lineWidth = 3; for (let x = 0; x < W; x += 52) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 96); c.stroke(); } c.beginPath(); c.moveTo(0, 48); c.lineTo(W, 48); c.stroke();
      for (let i = 0; i < 5; i++) { c.fillStyle = i % 2 ? '#2a4a8a' : '#24407a'; c.fillRect(i * (W / 5), 0, W / 5 - 4, 26); } c.fillStyle = '#ffffff'; c.font = '900 16px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('寿 司 · 喵 鮨', W / 2, 13);
      c.fillStyle = '#b8844a'; c.fillRect(0, 96, W, 8);
      // 客人
      for (let k = 0; k < SEAT_X.length; k++) {
        const g = b.guests[k], x = px(SEAT_X[k]), y = 186;
        // 够得着的范围
        if (!g.dish && grump[k] <= 0 && happy[k] <= 0) continue;
        const bob = Math.sin(T * 3 + k) * 2, col = FUR[fur[k] % FUR.length];
        c.fillStyle = col; c.beginPath(); c.ellipse(x, y + 18, 26, 22, 0, 0, 7); c.fill(); c.beginPath(); c.arc(x, y - 16 + bob, 22, 0, 7); c.fill();
        for (const s of [-1, 1]) { c.beginPath(); c.moveTo(x + s * 8, y - 32 + bob); c.lineTo(x + s * 22, y - 46 + bob); c.lineTo(x + s * 21, y - 22 + bob); c.fill(); }
        c.fillStyle = '#3a2a1a';
        if (happy[k] > 0) { c.strokeStyle = '#3a2a1a'; c.lineWidth = 2; for (const s of [-1, 1]) { c.beginPath(); c.arc(x + s * 8, y - 16 + bob, 4, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); } }
        else if (grump[k] > 0) { c.strokeStyle = '#3a2a1a'; c.lineWidth = 2; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(x + s * 4, y - 20 + bob); c.lineTo(x + s * 12, y - 16 + bob); c.stroke(); } }
        else for (const s of [-1, 1]) { c.beginPath(); c.arc(x + s * 8, y - 16 + bob, 2.6, 0, 7); c.fill(); }
        c.fillStyle = '#ff9ab0'; c.beginPath(); c.arc(x, y - 9 + bob, 2, 0, 7); c.fill();
        if (g.dish) {
          // 想吃的寿司气泡 + 耐心条
          const bx = x, by = 128, k2 = Math.max(0, g.left / g.max);
          c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(bx, by, 30, 20, 0, 0, 7); c.fill(); c.beginPath(); c.moveTo(bx - 6, by + 16); c.lineTo(bx + 4, by + 30); c.lineTo(bx + 8, by + 14); c.fill();
          drawDish(c, g.dish, bx, by + 1, 1);
          c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(bx - 28, by - 30, 56, 6);
          c.fillStyle = k2 > 0.6 ? '#7fe08a' : k2 > 0.3 ? '#ffd24a' : '#ff6a5a'; c.fillRect(bx - 28, by - 30, 56 * k2, 6);
        } else if (grump[k] > 0) { c.font = '900 20px sans-serif'; c.fillStyle = '#ff5a4a'; c.fillText('哼！', x, 128); }
      }
      // 柜台 + 传送带
      c.fillStyle = '#8a5a32'; c.fillRect(0, BELT_Y - 34, W, 8);
      c.fillStyle = '#9a9aa4'; c.fillRect(0, BELT_Y - 26, W, 52);
      c.fillStyle = '#7a7a84'; const off = (T * 60) % 26; for (let x = -off; x < W; x += 26) c.fillRect(x, BELT_Y - 26, 2, 52);
      c.fillStyle = '#6a3e22'; c.fillRect(0, BELT_Y + 26, W, H - BELT_Y - 26);
      // 每位客人够得着的那一段传送带（有客人在等的时候亮）
      for (let k = 0; k < SEAT_X.length; k++) if (b.guests[k].dish) { c.fillStyle = 'rgba(255,230,140,.32)'; c.fillRect(px(SEAT_X[k] - REACH), BELT_Y - 26, px(REACH) - PAD, 52); c.strokeStyle = 'rgba(255,220,100,.7)'; c.lineWidth = 2; c.strokeRect(px(SEAT_X[k] - REACH), BELT_Y - 26, px(REACH) - PAD, 52); }
      // 盘子
      for (const p of b.plates) {
        const x = px(p.x);
        c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(x + 2, BELT_Y + 4, 26, 11, 0, 0, 7); c.fill();
        c.fillStyle = ['#ffffff', '#ffd0d8', '#c8e0ff'][p.id % 3]; c.beginPath(); c.ellipse(x, BELT_Y, 26, 11, 0, 0, 7); c.fill();
        c.strokeStyle = ['#e8c050', '#ff6a8a', '#4a8ad8'][p.id % 3]; c.lineWidth = 2; c.stroke();
        drawDish(c, p.dish, x, BELT_Y - 4, 1.05);
      }
      for (let i = fx.length - 1; i >= 0; i--) {
        const f = fx[i], a = T - f.t; if (a > 0.8) { fx.splice(i, 1); continue; }
        c.globalAlpha = 1 - a / 0.8; c.font = '900 20px sans-serif'; c.fillStyle = f.col; c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 3; c.strokeText(f.text, f.x, f.y - a * 30); c.fillText(f.text, f.x, f.y - a * 30); c.globalAlpha = 1;
      }
      if (phase !== 'play') { c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(0, 0, W, H); }
    };
    const loop = () => {
      const t = performance.now(), dt = Math.min(0.25, (t - last) / 1000); last = t;
      if (phase === 'play') {
        let left = dt;
        while (left > 0) {
          const h = Math.min(0.05, left); left -= h;
          const before = b.guests.map((g) => g.dish);
          if (step(b, h, Math.random)) { sfx.no(); note.textContent = '😾 有客人等不及走了'; }
          b.guests.forEach((g, k) => { if (before[k] && !g.dish && happy[k] <= 0) grump[k] = 0.7; if (!before[k] && g.dish) fur[k] = Math.floor(Math.random() * 6); });
        }
        for (let k = 0; k < 3; k++) { happy[k] -= dt; grump[k] -= dt; }
        timeBar.style.width = `${Math.max(0, (DURATION - b.t) / DURATION) * 100}%`;
        refreshHud();
        if (b.over) finish();
      }
      draw();
      raf = requestAnimationFrame(loop);
    };
    const idle = () => {
      phase = 'idle'; b = newBelt(Math.random); timeBar.style.width = '100%'; refresh(); refreshHud();
      const ok = runsLeft(ctx.s) > 0;
      main.style.display = ''; main.disabled = !ok; main.innerHTML = ok ? '▶ 开店' : '😴 今天玩够啦';
      note.innerHTML = ok ? `盘子转到想吃它的客人面前（亮着的那一段）时点它，就端过去；端得快多 1 分。点错扣分，客人等太久会走。${starsHtml(1, 3, 14)} ${TIERS.join(' / ')}` : '';
    };
    const start = () => {
      if (!useRun(ctx.s)) { idle(); return; }
      ctx.save(); b = newBelt(Math.random); phase = 'play'; last = performance.now(); fx.length = 0;
      main.style.display = 'none'; note.textContent = '👆 盘子转到客人面前时点它'; refresh(); refreshHud();
    };
    const finish = () => {
      if (phase !== 'play') return;
      phase = 'result';
      const tier = tierOf(b.score), gain = sushiGain(ctx.s, tier);
      if (tier > 0) { applyGain(ctx.s, gain); sfx.win(); } else sfx.no();
      recordSushi(ctx.s, b.served); if (tier === 3 && dailyEgg(ctx.s, dayIndex())) ctx.toast('🥚 三星奖励：获得一颗宠物蛋！'); ctx.save();
      main.style.display = ''; main.disabled = runsLeft(ctx.s) <= 0; main.innerHTML = main.disabled ? '😴 今天玩够啦' : '🔁 再开一轮';
      note.innerHTML = `🏮 打烊啦 ${starsHtml(tier)} ⭐ ${b.score} &nbsp; 🍣 上菜 ${b.served}（快 ${b.fast}）${b.angry ? ` · 气走 ${b.angry} 位` : ''} &nbsp; ${tier > 0 ? gainIcons(gain, 18) : ''}`;
      refresh(); refreshHud();
    };
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (phase !== 'play') return;
      const r = cv.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * H;
      if (Math.abs(y - BELT_Y) > 40) return;
      const p = [...b.plates].sort((a, c2) => Math.abs(px(a.x) - x) - Math.abs(px(c2.x) - x))[0];
      if (!p || Math.abs(px(p.x) - x) > 34) return;
      const dish = p.dish, at = px(p.x), res = tapPlate(b, p.id, Math.random), T = performance.now() / 1000;
      if (res.kind === 'serve') { happy[res.seat] = 0.8; (res.fast ? sfx.coin : sfx.tap)(); fx.push({ t: T, x: px(SEAT_X[res.seat]), y: 160, text: res.fast ? '真快！+3' : '+2', col: res.fast ? '#ffd24a' : '#ffffff' }); note.textContent = `🍣 ${DISH_NAME[dish]}，端上去了`; }
      else if (res.kind === 'wrong') { sfx.no(); fx.push({ t: T, x: at, y: BELT_Y - 40, text: '拿错了 −2', col: '#ff6a5a' }); note.textContent = `❌ 面前的客人不要${DISH_NAME[dish]}`; }
      refreshHud();
    });
    const press = () => { if (main.disabled) return; if (phase === 'idle' || phase === 'result') start(); };
    const onKey = (e: KeyboardEvent) => {
      if ((e.code === 'Space' || e.key === 'Enter') && phase !== 'play') { e.preventDefault(); press(); }
      else if (e.key === 'Escape') close();
    };
    const close = () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); ov.remove(); ctx.save(); done(); };
    ov.addEventListener('click', (e) => { const btn = (e.target as HTMLElement).closest('[data-su]') as HTMLElement | null; if (!btn) return; if (btn.dataset.su === 'close') close(); else press(); });
    window.addEventListener('keydown', onKey);
    idle();
    raf = requestAnimationFrame(loop);
  });
}
