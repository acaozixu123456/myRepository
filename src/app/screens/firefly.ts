// 萤火虫记忆界面（光之森遗迹旁）：遗迹周围 6 盏萤火虫灯按顺序亮，照着顺序点回去。规则在 game/firefly.ts。
import { dailyEgg } from '../../game/pets';
import { dayIndex } from '../../game/premium';
import { LIVES, ROUNDS, SPOTS, TIERS, fireflyGain, flashTime, newMemo, recordRounds, roundSeq, runsLeft, tap, tierOf, useRun } from '../../game/firefly';
import type { Memo } from '../../game/firefly';
import { gainIcons, starsHtml } from '../../ui/gain';
import { icon } from '../../ui/icons';
import { applyGain } from '../../game/stage';
import { sfx } from '../sfx';
import type { AppCtx } from '../ctx';

export const FIREFLY_CSS = `
.ff-cv{display:block;margin:6px auto;max-width:100%;max-height:50vh;border-radius:14px;border:3px solid #7ad89a;box-shadow:0 0 18px rgba(122,216,154,.35);background:#0e2418;touch-action:none;cursor:pointer}
.ff-hud{display:flex;justify-content:space-between;align-items:center;font-weight:800;font-size:14px}
.ff-hud b{color:#ffe27a;font-size:18px}
.ff-note{min-height:20px;font-weight:800;font-size:13px;color:#ffe9a0}
`;

const W = 480, H = 400, CX = W / 2, CY = H / 2 + 6, RING = 140, R = 38;
// 每盏灯一种颜色，色弱也能靠位置记
const COLS = ['#ffe27a', '#9af07a', '#7ae0ff', '#ff9ad0', '#ffb04a', '#c8a0ff'];
const spotXY = (k: number) => { const a = -Math.PI / 2 + (k / SPOTS) * Math.PI * 2; return [CX + Math.cos(a) * RING, CY + Math.sin(a) * RING] as const; };
type Phase = 'idle' | 'show' | 'input' | 'wait' | 'result';
const GAP = 0.16;

/** 打开萤火虫记忆；玩家点「离开」后结束。 */
export function openFirefly(ctx: AppCtx, host: Element): Promise<void> {
  return new Promise((done) => {
    const ov = document.createElement('div');
    ov.className = 'fish-ov';
    ov.innerHTML = `<div class="fish-card" style="width:min(420px,94%)"><h3>✨ 萤火虫记忆</h3><div class="ff-hud"></div><canvas class="ff-cv" width="${W}" height="${H}"></canvas><div class="ff-note"></div><div class="fish-info"></div><div class="fish-btns"><button class="btn green" data-ff="main">▶</button><button class="btn ghost" data-ff="close">${icon('close', 18)} 离开</button></div></div>`;
    host.appendChild(ov);
    const q = <T extends Element>(sel: string) => ov.querySelector(sel) as T;
    const cv = q<HTMLCanvasElement>('.ff-cv'), c = cv.getContext('2d')!, hud = q<HTMLElement>('.ff-hud'), note = q<HTMLElement>('.ff-note'), info = q<HTMLElement>('.fish-info'), main = q<HTMLButtonElement>('[data-ff="main"]');
    let phase: Phase = 'idle', raf = 0, m: Memo = newMemo(Math.random), clock = 0, last = performance.now(), showT = 0, waitT = 0;
    let after: () => void = () => {};
    const glow = new Array(SPOTS).fill(0); // 每盏灯的亮度（0~1），点亮后慢慢暗下去
    const motes = Array.from({ length: 28 }, (_, i) => ({ x: (i * 97) % W, y: (i * 53) % H, p: i * 0.7 }));

    const refresh = () => { info.innerHTML = `🎮 今日剩余 ${runsLeft(ctx.s)} 局`; };
    const refreshHud = () => { hud.innerHTML = `<span>🌙 第 <b>${Math.min(ROUNDS, m.round + 1)}</b> / ${ROUNDS} 轮</span><span>⭐ <b>${m.score}</b></span><span>${'💚'.repeat(Math.max(0, m.lives))}${'🤍'.repeat(Math.max(0, LIVES - m.lives))}</span>`; };
    const draw = () => {
      const bg = c.createRadialGradient(CX, CY, 20, CX, CY, W * 0.7); bg.addColorStop(0, '#1e4a30'); bg.addColorStop(1, '#08160e'); c.fillStyle = bg; c.fillRect(0, 0, W, H);
      // 远处的树影
      c.fillStyle = 'rgba(0,0,0,.35)';
      for (let i = 0; i < 7; i++) { const x = i * 80 - 10; c.beginPath(); c.moveTo(x, H); c.lineTo(x + 40, 40 + (i % 3) * 30); c.lineTo(x + 80, H); c.fill(); }
      // 漂浮的小光点
      for (const d of motes) { const a = 0.25 + 0.25 * Math.sin(clock * 2 + d.p); c.fillStyle = `rgba(200,255,170,${a})`; c.beginPath(); c.arc((d.x + Math.sin(clock * 0.5 + d.p) * 12) % W, (d.y + clock * 6) % H, 1.6, 0, 7); c.fill(); }
      // 中间的遗迹石台，石头上趴着一只小猫
      c.fillStyle = '#5a6a5a'; c.beginPath(); c.ellipse(CX, CY + 26, 62, 20, 0, 0, 7); c.fill();
      c.fillStyle = '#7a8a78'; c.fillRect(CX - 46, CY - 8, 92, 34); c.beginPath(); c.ellipse(CX, CY - 8, 46, 14, 0, 0, 7); c.fill();
      c.strokeStyle = '#4a5a48'; c.lineWidth = 2; c.beginPath(); c.moveTo(CX - 20, CY + 4); c.lineTo(CX - 8, CY + 18); c.stroke();
      c.fillStyle = '#e8a050'; c.beginPath(); c.ellipse(CX, CY - 18, 22, 11, 0, 0, 7); c.fill(); c.beginPath(); c.arc(CX - 18, CY - 24, 11, 0, 7); c.fill();
      for (const s of [-1, 1]) { c.beginPath(); c.moveTo(CX - 18 + s * 4, CY - 32); c.lineTo(CX - 18 + s * 10, CY - 40); c.lineTo(CX - 18 + s * 11, CY - 28); c.fill(); }
      c.strokeStyle = '#3a2a1a'; c.lineWidth = 1.6; for (const s of [-1, 1]) { c.beginPath(); c.arc(CX - 18 + s * 4.5, CY - 24, 2.4, 0.2, Math.PI - 0.2); c.stroke(); } // 眯着眼
      c.strokeStyle = '#e8a050'; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(CX + 20, CY - 16); c.quadraticCurveTo(CX + 36, CY - 6, CX + 30, CY + 8); c.stroke(); c.lineCap = 'butt';
      // 6 盏萤火虫灯
      for (let k = 0; k < SPOTS; k++) {
        const [x, y] = spotXY(k), g = glow[k], col = COLS[k];
        c.fillStyle = 'rgba(20,40,28,.85)'; c.beginPath(); c.arc(x, y, R, 0, 7); c.fill();
        c.strokeStyle = col; c.globalAlpha = 0.35 + g * 0.65; c.lineWidth = 3; c.stroke();
        if (g > 0.02) {
          const halo = c.createRadialGradient(x, y, 4, x, y, R * 1.9); halo.addColorStop(0, col); halo.addColorStop(1, 'rgba(0,0,0,0)');
          c.globalAlpha = g * 0.8; c.fillStyle = halo; c.beginPath(); c.arc(x, y, R * 1.9, 0, 7); c.fill();
        }
        // 萤火虫：身体 + 发光的尾巴 + 两片翅膀
        const bob = Math.sin(clock * 3 + k) * 3;
        c.globalAlpha = 0.45 + g * 0.55;
        c.fillStyle = col; c.beginPath(); c.arc(x, y + 6 + bob, 9 + g * 4, 0, 7); c.fill();
        c.fillStyle = '#2a2a1a'; c.beginPath(); c.ellipse(x, y - 6 + bob, 6, 8, 0, 0, 7); c.fill();
        c.fillStyle = 'rgba(220,240,255,.6)'; for (const s of [-1, 1]) { c.beginPath(); c.ellipse(x + s * 9, y - 8 + bob + Math.sin(clock * 40) * (g > 0.3 ? 1.5 : 0), 8, 4, s * 0.5, 0, 7); c.fill(); }
        c.globalAlpha = 1;
      }
      if (phase === 'idle' || phase === 'result') { c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(0, 0, W, H); }
    };
    const loop = (now: number) => {
      const dt = Math.min(0.25, (now - last) / 1000); last = now; clock += dt;
      for (let k = 0; k < SPOTS; k++) glow[k] = Math.max(0, glow[k] - dt * 2.2);
      if (phase === 'show') {
        showT += dt;
        const seq = roundSeq(m), ft = flashTime(m.round), per = ft + GAP, i = Math.floor(showT / per);
        if (i < seq.length && showT - i * per < ft) { if (glow[seq[i]] < 0.95) sfx.tap(); glow[seq[i]] = 1; }
        if (showT >= seq.length * per + 0.1) { phase = 'input'; note.textContent = `👆 照着顺序点回去（${seq.length} 盏）`; }
      } else if (phase === 'wait') {
        waitT -= dt; if (waitT <= 0) after();
      }
      draw();
      raf = requestAnimationFrame(loop);
    };
    const play = (delay: number) => { phase = 'wait'; waitT = delay; after = () => { phase = 'show'; showT = 0; note.textContent = '👀 记住萤火虫亮起的顺序…'; }; };
    const idle = () => {
      phase = 'idle'; m = newMemo(Math.random); refresh(); refreshHud();
      const ok = runsLeft(ctx.s) > 0;
      main.style.display = ''; main.disabled = !ok; main.innerHTML = ok ? '▶ 开始' : '😴 今天玩够啦';
      note.innerHTML = ok ? `萤火虫会按顺序亮起，记住后照着点回去；每轮多一盏。点错 ${LIVES - 1} 次可以重看。${starsHtml(1, 3, 14)} ${TIERS.join(' / ')}` : '';
    };
    const start = () => {
      if (!useRun(ctx.s)) { idle(); return; }
      ctx.save(); m = newMemo(Math.random); main.style.display = 'none'; refresh(); refreshHud(); play(0.6);
    };
    const finish = (cleared: boolean) => {
      phase = 'result';
      const tier = tierOf(m.score), gain = fireflyGain(ctx.s, tier);
      if (tier > 0) { applyGain(ctx.s, gain); sfx.win(); } else sfx.no();
      recordRounds(ctx.s, m.round); if (tier === 3 && dailyEgg(ctx.s, dayIndex())) ctx.toast('🥚 三星奖励：获得一颗宠物蛋！'); ctx.save();
      main.style.display = ''; main.disabled = runsLeft(ctx.s) <= 0; main.innerHTML = main.disabled ? '😴 今天玩够啦' : '🔁 再来一局';
      note.innerHTML = `${cleared ? '🎉 全部记住了！' : ''}${starsHtml(tier)} ⭐ ${m.score} &nbsp; 🌙 完成 ${m.round} 轮 &nbsp; ${tier > 0 ? gainIcons(gain, 18) : ''}`;
      refresh(); refreshHud();
    };
    cv.addEventListener('pointerdown', (e) => {
      if (phase !== 'input') return;
      const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * (W / r.width), y = (e.clientY - r.top) * (H / r.height);
      let hit = -1;
      for (let k = 0; k < SPOTS; k++) { const [sx, sy] = spotXY(k); if (Math.hypot(x - sx, y - sy) <= R * 1.25) hit = k; }
      if (hit < 0) return;
      glow[hit] = 1;
      const res = tap(m, hit);
      refreshHud();
      if (res === 'ok') sfx.tap();
      else if (res === 'round') { sfx.coin(); note.textContent = '✨ 对啦！下一轮多一盏'; play(0.9); }
      else if (res === 'retry') { sfx.no(); note.textContent = '😿 点错了，再看一遍'; play(1.0); }
      else if (res === 'clear') finish(true);
      else finish(false);
    });
    const press = () => { if (main.disabled) return; if (phase === 'idle' || phase === 'result') start(); };
    const onKey = (e: KeyboardEvent) => {
      if ((e.code === 'Space' || e.key === 'Enter') && (phase === 'idle' || phase === 'result')) { e.preventDefault(); press(); }
      else if (e.key === 'Escape') close();
    };
    const close = () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); ov.remove(); ctx.save(); done(); };
    ov.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest('[data-ff]') as HTMLElement | null; if (!b) return; if (b.dataset.ff === 'close') close(); else press(); });
    window.addEventListener('keydown', onKey);
    idle();
    raf = requestAnimationFrame(loop);
  });
}
