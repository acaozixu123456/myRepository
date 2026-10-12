// 打水漂界面（樱汤乡锦鲤池南岸）：侧视的池塘，猫猫站在左岸；先点一下定角度（摆动的指针），再点一下定力度（来回走的力度条），
// 石片在水面上一下一下地漂，漂满就飞到对岸。规则在 game/stoneskip.ts。
import { dailyEgg } from '../../game/pets';
import { dayIndex } from '../../game/premium';
import { ANGLE_MAX, IDEAL, MAX_SKIPS, SINK_ANGLE, THROWS, TIERS, angleAt, powerAt, recordSkips, runsLeft, skipGain, throwStone, tierOf, totalScore, useRun } from '../../game/stoneskip';
import type { Throw } from '../../game/stoneskip';
import { gainIcons, starsHtml } from '../../ui/gain';
import { icon } from '../../ui/icons';
import { applyGain } from '../../game/stage';
import { sfx } from '../sfx';
import type { AppCtx } from '../ctx';

export const STONESKIP_CSS = `
.sk-cv{display:block;margin:6px auto;max-width:100%;max-height:48vh;border-radius:14px;border:3px solid #ffb8d0;box-shadow:0 0 18px rgba(255,184,208,.35);background:#9ad0e8;touch-action:none;cursor:pointer}
.sk-hud{display:flex;justify-content:space-between;align-items:center;font-weight:800;font-size:14px}
.sk-hud b{color:#ffe27a;font-size:18px}
.sk-note{min-height:20px;font-weight:800;font-size:13px;color:#ffe9a0}
`;

const W = 520, H = 340, WATER = 220, BANK_L = 120, BANK_R = W - 56, CAT_X = 70;
type Phase = 'idle' | 'aim' | 'power' | 'fly' | 'result';
const HOP = 0.22;

/** 第 k 下落水点的 x（k 从 1 起）：每一跳比上一跳短一点；n 下漂满正好到对岸 */
function touchX(k: number): number {
  let s = 0, tot = 0;
  for (let i = 0; i < MAX_SKIPS; i++) { const len = 1 - i * 0.055; tot += len; if (i < k) s += len; }
  return BANK_L + 14 + (BANK_R - BANK_L - 14) * (s / tot);
}

/** 打开打水漂；玩家点「离开」后结束。 */
export function openStoneSkip(ctx: AppCtx, host: Element): Promise<void> {
  return new Promise((done) => {
    const ov = document.createElement('div');
    ov.className = 'fish-ov';
    ov.innerHTML = `<div class="fish-card" style="width:min(440px,94%)"><h3>🪨 打水漂</h3><div class="sk-hud"></div><canvas class="sk-cv" width="${W}" height="${H}"></canvas><div class="sk-note"></div><div class="fish-info"></div><div class="fish-btns"><button class="btn green" data-sk="main">▶</button><button class="btn ghost" data-sk="close">${icon('close', 18)} 离开</button></div></div>`;
    host.appendChild(ov);
    const q = <T extends Element>(sel: string) => ov.querySelector(sel) as T;
    const cv = q<HTMLCanvasElement>('.sk-cv'), c = cv.getContext('2d')!, hud = q<HTMLElement>('.sk-hud'), note = q<HTMLElement>('.sk-note'), info = q<HTMLElement>('.fish-info'), main = q<HTMLButtonElement>('[data-sk="main"]');
    let phase: Phase = 'idle', raf = 0, t0 = performance.now(), angle = IDEAL, power = 0, cur: Throw | null = null;
    const throws: Throw[] = [];
    const now = () => (performance.now() - t0) / 1000;
    const petals = Array.from({ length: 14 }, (_, i) => ({ x: (i * 97) % W, y: (i * 53) % WATER, s: 0.6 + ((i * 7) % 5) / 6 }));

    const refresh = () => { info.innerHTML = `🎮 今日剩余 ${runsLeft(ctx.s)} 局`; };
    const refreshHud = () => { hud.innerHTML = `<span>🪨 第 <b>${Math.min(THROWS, throws.length + (phase === 'aim' || phase === 'power' || phase === 'fly' ? 1 : 0))}</b> / ${THROWS} 块</span><span>⭐ <b>${totalScore(throws)}</b></span><span>${throws.map((t) => (t.across ? '🏆' : t.sank ? '💧' : t.skips)).join(' ')}</span>`; };

    const draw = () => {
      const T = performance.now() / 1000;
      // 天空 + 远山 + 樱花树
      const sky = c.createLinearGradient(0, 0, 0, WATER); sky.addColorStop(0, '#ffc8d8'); sky.addColorStop(1, '#ffe8d0'); c.fillStyle = sky; c.fillRect(0, 0, W, WATER);
      c.fillStyle = '#c8a8c8'; c.beginPath(); c.moveTo(0, WATER - 40); for (let x = 0; x <= W; x += 40) c.lineTo(x, WATER - 50 - Math.sin(x * 0.013) * 30 - Math.sin(x * 0.04) * 8); c.lineTo(W, WATER); c.lineTo(0, WATER); c.fill();
      for (const [x, s] of [[200, 1], [330, 0.8], [430, 1.1]] as const) { c.fillStyle = '#7a5a4a'; c.fillRect(x - 3 * s, WATER - 50 * s, 6 * s, 50 * s); c.fillStyle = '#ffb8d0'; for (const [dx, dy, r] of [[0, -60, 26], [-18, -48, 18], [18, -50, 20]]) { c.beginPath(); c.arc(x + dx * s, WATER + dy * s, r * s, 0, 7); c.fill(); } }
      // 水面
      const wg = c.createLinearGradient(0, WATER, 0, H); wg.addColorStop(0, '#6ac0d8'); wg.addColorStop(1, '#2a7a9a'); c.fillStyle = wg; c.fillRect(0, WATER, W, H - WATER);
      c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2; for (let i = 0; i < 6; i++) { const y = WATER + 16 + i * 18, x = ((i * 90 + T * 20) % (W + 80)) - 40; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 40, y); c.stroke(); }
      // 两岸
      c.fillStyle = '#8a9a5a'; c.beginPath(); c.moveTo(0, WATER - 6); c.lineTo(BANK_L, WATER - 6); c.quadraticCurveTo(BANK_L + 14, WATER + 10, BANK_L - 4, H); c.lineTo(0, H); c.fill();
      c.beginPath(); c.moveTo(W, WATER - 6); c.lineTo(BANK_R, WATER - 6); c.quadraticCurveTo(BANK_R - 14, WATER + 10, BANK_R + 4, H); c.lineTo(W, H); c.fill();
      c.fillStyle = '#9a9488'; for (const [x, y, r] of [[BANK_L - 10, WATER - 4, 9], [BANK_R + 12, WATER - 4, 8], [BANK_L - 30, WATER + 4, 6]] as const) { c.beginPath(); c.ellipse(x, y, r * 1.4, r, 0, 0, 7); c.fill(); }
      // 锦鲤
      for (let i = 0; i < 3; i++) { const x = BANK_L + 60 + ((i * 120 + T * 18 * (i % 2 ? 1 : -1)) % 300 + 300) % 300, y = WATER + 50 + i * 22; c.fillStyle = ['#ff8a4a', '#ffffff', '#ffd24a'][i]; c.globalAlpha = 0.6; c.beginPath(); c.ellipse(x, y, 14, 5, 0, 0, 7); c.fill(); c.globalAlpha = 1; }
      // 花瓣
      c.fillStyle = 'rgba(255,190,215,.9)'; for (const p of petals) { const x = (p.x + T * 18 * p.s) % W, y = (p.y + T * 12 * p.s) % WATER; c.beginPath(); c.ellipse(x, y, 3 * p.s, 2 * p.s, T + p.x, 0, 7); c.fill(); }
      // 猫猫
      c.save(); c.translate(CAT_X, WATER - 6);
      c.fillStyle = '#f0f0f0'; c.beginPath(); c.ellipse(0, -24, 13, 18, 0, 0, 7); c.fill(); c.beginPath(); c.arc(0, -50, 13, 0, 7); c.fill();
      for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 5, -60); c.lineTo(s * 13, -70); c.lineTo(s * 13, -55); c.fill(); }
      c.fillStyle = '#3a2a1a'; for (const s of [-1, 1]) { c.beginPath(); c.arc(s * 4.5 + 3, -51, 1.8, 0, 7); c.fill(); }
      c.fillStyle = '#ff8ab0'; c.fillRect(-12, -36, 24, 6); // 围巾
      c.restore();
      // 角度指针
      if (phase === 'aim' || phase === 'power') {
        const a = (phase === 'aim' ? angleAt(now()) : angle) * Math.PI / 180, ox = CAT_X + 14, oy = WATER - 26;
        c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2; c.beginPath(); c.arc(ox, oy, 70, -ANGLE_MAX * Math.PI / 180, 0); c.stroke();
        c.strokeStyle = 'rgba(127,240,140,.8)'; c.lineWidth = 8; c.beginPath(); c.arc(ox, oy, 70, -(IDEAL + 6) * Math.PI / 180, -(IDEAL - 6) * Math.PI / 180); c.stroke();
        c.strokeStyle = 'rgba(255,90,90,.7)'; c.beginPath(); c.arc(ox, oy, 70, -ANGLE_MAX * Math.PI / 180, -SINK_ANGLE * Math.PI / 180); c.stroke();
        c.strokeStyle = '#ffffff'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(ox, oy); c.lineTo(ox + Math.cos(a) * 80, oy - Math.sin(a) * 80); c.stroke(); c.lineCap = 'butt';
      }
      // 力度条
      if (phase === 'power') {
        const p = powerAt(now()), x = 14, y0 = 30, h = 150;
        c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(x, y0, 16, h);
        const pg = c.createLinearGradient(0, y0 + h, 0, y0); pg.addColorStop(0, '#7fe08a'); pg.addColorStop(0.7, '#ffd24a'); pg.addColorStop(1, '#ff6a5a'); c.fillStyle = pg; c.fillRect(x, y0 + h * (1 - p), 16, h * p);
        c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.strokeRect(x, y0, 16, h);
      }
      // 飞出去的石片
      if (phase === 'fly' && cur) {
        const a = now();
        if (cur.sank) {
          const k = Math.min(1, a / 0.5), x = CAT_X + 20 + k * 60, y = WATER - 30 - Math.sin(k * Math.PI) * 50 + k * 30;
          if (k < 1) { c.fillStyle = '#6a6a72'; c.beginPath(); c.ellipse(x, y, 7, 3, 0, 0, 7); c.fill(); }
          else ripple(c, CAT_X + 80, a - 0.5, 1.6);
        } else {
          const n = cur.skips, k = Math.min(n, Math.floor(a / HOP)), f = (a / HOP) % 1;
          for (let i = 1; i <= Math.min(k, n); i++) ripple(c, touchX(i), a - i * HOP, 1);
          if (k < n) {
            const xa = k === 0 ? CAT_X + 20 : touchX(k), xb = touchX(k + 1), ya = k === 0 ? WATER - 30 : WATER, hgt = k === 0 ? 40 : 30 * (1 - k / (MAX_SKIPS + 2));
            const x = xa + (xb - xa) * f, y = ya + (WATER - ya) * f - Math.sin(f * Math.PI) * hgt;
            c.fillStyle = '#6a6a72'; c.beginPath(); c.ellipse(x, y, 7, 3, (a * 20) % 6, 0, 7); c.fill();
          } else if (cur.across) { c.fillStyle = '#6a6a72'; c.beginPath(); c.ellipse(BANK_R + 20, WATER - 10, 7, 3, 0, 0, 7); c.fill(); c.font = '900 22px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#ffd24a'; c.fillText('飞到对岸！', BANK_R - 40, WATER - 60); }
          else ripple(c, touchX(n) + 10, a - n * HOP, 1.3);
        }
      }
      if (phase === 'idle' || phase === 'result') { c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(0, 0, W, H); }
    };
    function ripple(cx: CanvasRenderingContext2D, x: number, age: number, big: number) {
      if (age < 0 || age > 1.2) return;
      cx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - age / 1.2)})`; cx.lineWidth = 2;
      for (const d of [0, 0.25]) { const r = (age + d) * 22 * big; if (r <= 0) continue; cx.beginPath(); cx.ellipse(x, WATER + 2, r, r * 0.3, 0, 0, 7); cx.stroke(); }
    }
    const loop = () => {
      if (phase === 'fly' && cur) {
        const a = now(), end = cur.sank ? 1.4 : cur.skips * HOP + 1.0;
        if (a >= end) next();
      }
      draw();
      raf = requestAnimationFrame(loop);
    };
    const idle = () => {
      phase = 'idle'; throws.length = 0; refresh(); refreshHud();
      const ok = runsLeft(ctx.s) > 0;
      main.style.display = ''; main.disabled = !ok; main.innerHTML = ok ? '▶ 捡石片' : '😴 今天玩够啦';
      note.innerHTML = ok ? `一局 ${THROWS} 块石片。先点一下定角度（绿色那段最好，红色太陡会沉），再点一下定力度（越满越远）。漂满 ${MAX_SKIPS} 下就飞到对岸，额外加分。${starsHtml(1, 3, 14)} ${TIERS.join(' / ')}` : '';
    };
    const aim = () => { phase = 'aim'; t0 = performance.now(); cur = null; note.textContent = '👆 指针到绿色那段时点一下'; refreshHud(); };
    const start = () => {
      if (!useRun(ctx.s)) { idle(); return; }
      ctx.save(); throws.length = 0; main.style.display = 'none'; refresh(); aim();
    };
    const next = () => { if (throws.length >= THROWS) finish(); else aim(); };
    const finish = () => {
      phase = 'result';
      const score = totalScore(throws), tier = tierOf(score), gain = skipGain(ctx.s, tier);
      if (tier > 0) { applyGain(ctx.s, gain); sfx.win(); } else sfx.no();
      recordSkips(ctx.s, throws.reduce((a, t) => a + t.skips, 0)); if (tier === 3 && dailyEgg(ctx.s, dayIndex())) ctx.toast('🥚 三星奖励：获得一颗宠物蛋！'); ctx.save();
      main.style.display = ''; main.disabled = runsLeft(ctx.s) <= 0; main.innerHTML = main.disabled ? '😴 今天玩够啦' : '🔁 再来一局';
      const best = Math.max(...throws.map((t) => t.skips));
      note.innerHTML = `${starsHtml(tier)} ⭐ ${score} &nbsp; 最远一块漂了 ${best} 下${throws.some((t) => t.across) ? ' · 🏆 飞过池塘' : ''} &nbsp; ${tier > 0 ? gainIcons(gain, 18) : ''}`;
      refresh(); refreshHud();
    };
    const hit = () => {
      if (phase === 'aim') { angle = angleAt(now()); phase = 'power'; t0 = performance.now(); sfx.tap(); note.textContent = `角度 ${Math.round(angle)}°${angle > SINK_ANGLE ? '（太陡了…）' : Math.abs(angle - IDEAL) <= 6 ? '（好角度！）' : ''}　👆 力度条满的时候再点一下`; }
      else if (phase === 'power') {
        power = powerAt(now()); cur = throwStone(angle, power); throws.push(cur); phase = 'fly'; t0 = performance.now();
        if (cur.sank) { sfx.no(); note.textContent = '💧 扑通——沉下去了'; }
        else { (cur.across ? sfx.coin : sfx.tap)(); note.textContent = cur.across ? `🏆 漂了 ${cur.skips} 下，飞到对岸！` : `🪨 漂了 ${cur.skips} 下`; }
        refreshHud();
      }
    };
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); hit(); });
    const press = () => { if (main.disabled) return; if (phase === 'idle' || phase === 'result') start(); };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); if (phase === 'aim' || phase === 'power') hit(); else if (phase !== 'fly') press(); }
      else if (e.key === 'Escape') close();
    };
    const close = () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); ov.remove(); ctx.save(); done(); };
    ov.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest('[data-sk]') as HTMLElement | null; if (!b) return; if (b.dataset.sk === 'close') close(); else press(); });
    window.addEventListener('keydown', onKey);
    idle();
    raf = requestAnimationFrame(loop);
  });
}
