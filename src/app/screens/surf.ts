// 冲浪界面（椰风海湾西侧浪区）：侧视的海浪，猫猫踩板随浪起伏；收缩的光圈套住猫猫的那一刻就是浪尖，点一下耍花样。规则在 game/surf.ts。
import { dailyEgg } from '../../game/pets';
import { dayIndex } from '../../game/premium';
import { DURATION, TIERS, WINDOW, WOBBLES, advance, comboMul, makeSet, newRide, recordTricks, runsLeft, surfGain, tap, tierOf, useRun } from '../../game/surf';
import type { Lip, Ride } from '../../game/surf';
import { gainIcons, starsHtml } from '../../ui/gain';
import { icon } from '../../ui/icons';
import { applyGain } from '../../game/stage';
import { boostGain } from '../../game/featured';
import { sfx } from '../sfx';
import type { AppCtx } from '../ctx';

export const SURF_CSS = `
.sf-cv{display:block;margin:6px auto;max-width:100%;max-height:48vh;border-radius:14px;border:3px solid #7ff0ff;box-shadow:0 0 18px rgba(127,240,255,.35);background:#7ac8f4;touch-action:none;cursor:pointer}
.sf-hud{display:flex;justify-content:space-between;align-items:center;font-weight:800;font-size:14px}
.sf-hud b{color:#ffe27a;font-size:18px}
.sf-time{height:6px;border-radius:3px;background:rgba(0,0,0,.3);overflow:hidden;margin-top:4px}
.sf-time i{display:block;height:100%;background:#7ff0ff;width:100%}
.sf-note{min-height:20px;font-weight:800;font-size:13px;color:#ffe9a0}
`;

const W = 520, H = 380, SX = 190, SEA = 250;
type Phase = 'idle' | 'play' | 'result';

/** 当前时刻猫猫在浪上的高度（0 = 浪谷，1 = 浪尖）：在浪头时刻正好到顶 */
function rideHeight(r: Ride, t: number): { h: number; big: boolean } {
  const lips = r.set;
  let i = lips.findIndex((l) => l.t > t);
  if (i < 0) i = lips.length;
  const prev = i > 0 ? lips[i - 1].t : 0, next = i < lips.length ? lips[i].t : prev + 1.4;
  const p = Math.min(1, Math.max(0, (t - prev) / Math.max(0.3, next - prev)));
  return { h: (1 + Math.cos(p * Math.PI * 2)) / 2, big: (lips[i]?.kind ?? 'wave') === 'big' };
}

/** 打开冲浪；玩家点「离开」后结束。 */
export function openSurf(ctx: AppCtx, host: Element): Promise<void> {
  return new Promise((done) => {
    const ov = document.createElement('div');
    ov.className = 'fish-ov';
    ov.innerHTML = `<div class="fish-card" style="width:min(440px,94%)"><h3>🏄 冲浪</h3><div class="sf-hud"></div><canvas class="sf-cv" width="${W}" height="${H}"></canvas><div class="sf-time"><i></i></div><div class="sf-note"></div><div class="fish-info"></div><div class="fish-btns"><button class="btn green" data-sf="main">▶</button><button class="btn ghost" data-sf="close">${icon('close', 18)} 离开</button></div></div>`;
    host.appendChild(ov);
    const q = <T extends Element>(sel: string) => ov.querySelector(sel) as T;
    const cv = q<HTMLCanvasElement>('.sf-cv'), c = cv.getContext('2d')!, hud = q<HTMLElement>('.sf-hud'), note = q<HTMLElement>('.sf-note'), info = q<HTMLElement>('.fish-info'), main = q<HTMLButtonElement>('[data-sf="main"]'), timeBar = q<HTMLElement>('.sf-time i');
    let phase: Phase = 'idle', raf = 0, t0 = performance.now(), r: Ride = newRide([]), flip = -1, wob = -1;
    const pops: { t: number; col: string; text: string }[] = [];
    const now = () => (phase === 'play' ? (performance.now() - t0) / 1000 : 0);

    const refresh = () => { info.innerHTML = `🎮 今日剩余 ${runsLeft(ctx.s)} 局`; };
    const refreshHud = () => { hud.innerHTML = `<span>🔥 连击 <b>${r.combo}</b>${comboMul(r.combo) > 1 ? ` ×${comboMul(r.combo)}` : ''}</span><span>⭐ <b>${r.score}</b></span><span>${'🏄'.repeat(Math.max(0, WOBBLES - r.wobbles))}${'💦'.repeat(Math.min(WOBBLES, r.wobbles))}</span>`; };
    const draw = () => {
      const t = now();
      const sky = c.createLinearGradient(0, 0, 0, SEA); sky.addColorStop(0, '#3a9ae8'); sky.addColorStop(1, '#bfe8ff'); c.fillStyle = sky; c.fillRect(0, 0, W, SEA);
      c.fillStyle = '#fff4c0'; c.beginPath(); c.arc(W - 70, 60, 26, 0, 7); c.fill();
      c.fillStyle = 'rgba(255,255,255,.8)'; for (let i = 0; i < 4; i++) { const x = ((i * 170 - t * 14) % (W + 160) + W + 160) % (W + 160) - 80; c.beginPath(); c.ellipse(x, 50 + (i % 2) * 40, 50, 14, 0, 0, 7); c.ellipse(x + 26, 42 + (i % 2) * 40, 30, 12, 0, 0, 7); c.fill(); }
      c.fillStyle = '#4aa86a'; c.beginPath(); c.ellipse(W - 110, SEA - 40, 70, 18, 0, Math.PI, 0); c.fill(); // 远处小岛
      const { h, big } = phase === 'play' ? rideHeight(r, t) : { h: 0.5, big: false };
      const amp = big ? 90 : 64, crestY = SEA - 10 - h * amp;
      // 后面一层浅浪
      c.fillStyle = '#5ab8e0'; c.beginPath(); c.moveTo(0, H); for (let x = 0; x <= W; x += 10) c.lineTo(x, SEA + 6 + Math.sin(x * 0.02 + t * 1.8) * 8); c.lineTo(W, H); c.fill();
      // 主浪：猫猫所在的 x 处是浪形的位置，往右是浪面，往左是卷起来的浪壁
      const sea = c.createLinearGradient(0, SEA - 100, 0, H); sea.addColorStop(0, '#2ab0d8'); sea.addColorStop(1, '#0a6a98'); c.fillStyle = sea;
      c.beginPath(); c.moveTo(0, H);
      for (let x = 0; x <= W; x += 6) { const d = (x - SX) / 140; const bump = Math.exp(-d * d) * (SEA - 10 - crestY); c.lineTo(x, SEA + 12 - bump + Math.sin(x * 0.05 + t * 3) * 3); }
      c.lineTo(W, H); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 4; c.beginPath();
      for (let x = SX - 120; x <= SX + 150; x += 6) { const d = (x - SX) / 140; const bump = Math.exp(-d * d) * (SEA - 10 - crestY); c.lineTo(x, SEA + 12 - bump + Math.sin(x * 0.05 + t * 3) * 3); } c.stroke();
      c.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 10; i++) { const x = SX - 110 + ((i * 37 + t * 60) % 120); c.beginPath(); c.arc(x, SEA + 14 - Math.exp(-(((x - SX) / 140) ** 2)) * (SEA - 10 - crestY) + 4, 3 + (i % 3), 0, 7); c.fill(); }
      // 下一个浪头的收缩光圈：浪头时刻正好缩到猫猫身上
      const lip: Lip | undefined = phase === 'play' ? r.set[r.next] : undefined;
      if (lip) { const lead = lip.t - t; if (lead < 1.2 && lead > -WINDOW[lip.kind]) { const k = Math.max(0, lead) / 1.2, rad = 26 + k * 90; c.strokeStyle = lip.kind === 'big' ? `rgba(255,210,74,${1 - k * 0.6})` : `rgba(255,255,255,${1 - k * 0.6})`; c.lineWidth = lip.kind === 'big' ? 5 : 3; c.beginPath(); c.arc(SX, crestY - 26, rad, 0, 7); c.stroke(); } }
      // 冲浪的猫
      const ft = flip >= 0 ? Math.min(1, (t - flip) / 0.45) : 1, wt = wob >= 0 ? Math.min(1, (t - wob) / 0.4) : 1;
      c.save(); c.translate(SX, crestY - 4);
      c.rotate(-0.15 + (ft < 1 ? ft * Math.PI * 2 : 0) + (wt < 1 ? Math.sin(wt * 30) * 0.25 : 0));
      c.translate(0, ft < 1 ? -Math.sin(ft * Math.PI) * 40 : 0);
      c.fillStyle = '#ff6a5a'; c.beginPath(); c.ellipse(0, 0, 40, 7, 0, 0, 7); c.fill(); c.fillStyle = '#ffffff'; c.fillRect(-36, -1, 72, 2);
      c.fillStyle = '#e8a050'; c.beginPath(); c.ellipse(0, -22, 11, 16, 0, 0, 7); c.fill();
      c.beginPath(); c.arc(2, -44, 12, 0, 7); c.fill();
      for (const s of [-1, 1]) { c.beginPath(); c.moveTo(2 + s * 5, -53); c.lineTo(2 + s * 12, -63); c.lineTo(2 + s * 12, -49); c.fill(); }
      c.strokeStyle = '#e8a050'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(-8, -28); c.lineTo(-22, -36); c.moveTo(8, -28); c.lineTo(22, -38); c.stroke(); c.lineCap = 'butt';
      c.fillStyle = '#3a8ad8'; c.fillRect(-10, -16, 20, 8);
      c.fillStyle = '#3a2a1a'; for (const s of [-1, 1]) { c.beginPath(); c.arc(2 + s * 4.5, -45, 1.8, 0, 7); c.fill(); }
      c.restore();
      for (let i = pops.length - 1; i >= 0; i--) {
        const p = pops[i], a = t - p.t; if (a > 0.8) { pops.splice(i, 1); continue; }
        c.globalAlpha = 1 - a / 0.8; c.fillStyle = p.col; c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 3; c.font = '900 24px sans-serif'; c.textAlign = 'center';
        c.strokeText(p.text, SX + 70, crestY - 70 - a * 40); c.fillText(p.text, SX + 70, crestY - 70 - a * 40); c.globalAlpha = 1;
      }
      if (phase !== 'play') { c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(0, 0, W, H); }
    };
    const loop = () => {
      if (phase === 'play') {
        const t = now();
        if (advance(r, t).length) note.textContent = '🌊 浪头过去了，连击断了';
        timeBar.style.width = `${Math.max(0, (DURATION - t) / DURATION) * 100}%`;
        refreshHud();
        if (r.over) finish();
      }
      draw();
      raf = requestAnimationFrame(loop);
    };
    const idle = () => {
      phase = 'idle'; r = newRide([]); timeBar.style.width = '100%'; refresh(); refreshHud();
      const ok = runsLeft(ctx.s) > 0;
      main.style.display = ''; main.disabled = !ok; main.innerHTML = ok ? '▶ 下水' : '😴 今天玩够啦';
      note.innerHTML = ok ? `光圈缩到猫猫身上（浪尖）时点一下耍花样，越准分越高；连着成功有倍率。金色是大浪，分高但更难。乱点会晃，晃 ${WOBBLES} 次落水。${starsHtml(1, 3, 14)} ${TIERS.join(' / ')}` : '';
    };
    const start = () => {
      if (!useRun(ctx.s)) { idle(); return; }
      ctx.save(); r = newRide(makeSet(Math.random)); phase = 'play'; t0 = performance.now(); pops.length = 0; flip = -1; wob = -1;
      main.style.display = 'none'; note.textContent = '👆 点画面（或空格）在浪尖起跳'; refresh(); refreshHud();
    };
    const finish = () => {
      if (phase !== 'play') return;
      phase = 'result';
      const tier = tierOf(r.score), gain = surfGain(ctx.s, tier);
      if (tier > 0) { applyGain(ctx.s, boostGain(ctx.s, gain, () => ctx.toast('🌟 今日推荐小游戏：这局奖励翻倍！'))); sfx.win(); } else sfx.no();
      recordTricks(ctx.s, r.perfect + r.good); if (tier === 3 && dailyEgg(ctx.s, dayIndex())) ctx.toast('🥚 三星奖励：获得一颗宠物蛋！'); ctx.save();
      main.style.display = ''; main.disabled = runsLeft(ctx.s) <= 0; main.innerHTML = main.disabled ? '😴 今天玩够啦' : '🔁 再冲一次';
      note.innerHTML = `${r.wobbles >= WOBBLES ? '💦 落水了！' : '🏁 上岸！'} ${starsHtml(tier)} ⭐ ${r.score} &nbsp; ✨ 完美 ${r.perfect} · 不错 ${r.good} · 最高连击 ${r.best} &nbsp; ${tier > 0 ? gainIcons(gain, 18) : ''}`;
      refresh(); refreshHud();
    };
    const hit = () => {
      if (phase !== 'play') return;
      const t = now(), res = tap(r, t);
      if (res.kind === 'perfect' || res.kind === 'good') {
        flip = t; (res.kind === 'perfect' ? sfx.coin : sfx.tap)();
        pops.push({ t, col: res.kind === 'perfect' ? '#ffd24a' : '#ffffff', text: `${res.kind === 'perfect' ? '完美' : '不错'} +${res.gain}` });
        note.textContent = res.lip.kind === 'big' ? '🌊 大浪！' : '';
      } else if (res.kind === 'wobble') { wob = t; sfx.no(); note.textContent = '😵 没到浪尖，晃了一下'; }
      refreshHud();
      if (r.over) finish();
    };
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); hit(); });
    const press = () => { if (main.disabled) return; if (phase === 'idle' || phase === 'result') start(); };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); if (phase === 'play') hit(); else press(); }
      else if (e.key === 'Escape') close();
    };
    const close = () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); ov.remove(); ctx.save(); done(); };
    ov.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest('[data-sf]') as HTMLElement | null; if (!b) return; if (b.dataset.sf === 'close') close(); else press(); });
    window.addEventListener('keydown', onKey);
    idle();
    raf = requestAnimationFrame(loop);
  });
}
