// 叠雪猫界面（喵雪岭东边雪地）：顶上的雪球左右摆，点一下落下去叠上；叠满了给它装上猫头。规则在 game/snowcat.ts。
import { dailyEgg } from '../../game/pets';
import { dayIndex } from '../../game/premium';
import { LAYERS, MISSES, TIERS, TOPPLE, drop, lean, level, newTower, radiusOf, recordLayers, runsLeft, snowcatGain, swingX, tierOf, useRun } from '../../game/snowcat';
import type { Tower } from '../../game/snowcat';
import { gainIcons, starsHtml } from '../../ui/gain';
import { icon } from '../../ui/icons';
import { applyGain } from '../../game/stage';
import { boostGain } from '../../game/featured';
import { sfx } from '../sfx';
import type { AppCtx } from '../ctx';

export const SNOWCAT_CSS = `
.sc-cv{display:block;margin:6px auto;max-width:100%;max-height:52vh;border-radius:14px;border:3px solid #ffd0e8;box-shadow:0 0 18px rgba(255,208,232,.35);background:#dceeff;touch-action:none;cursor:pointer}
.sc-hud{display:flex;justify-content:space-between;align-items:center;font-weight:800;font-size:14px}
.sc-hud b{color:#ffe27a;font-size:18px}
.sc-note{min-height:20px;font-weight:800;font-size:13px;color:#ffe9a0}
`;

const W = 400, H = 540, S = W / 2.4, GROUND = H - 40;
type Phase = 'idle' | 'play' | 'result';
const px = (x: number) => W / 2 + x * S;

/** 每层雪球中心离地面的高度（像素） */
function heights(n: number): number[] {
  const out: number[] = []; let y = 0;
  for (let i = 0; i < n; i++) { const r = radiusOf(i) * S; y += i === 0 ? r : r * 1.7 + (radiusOf(i - 1) * S - r) * 0.2; out.push(y); }
  return out;
}
function ball(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#cfdcee');
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  c.strokeStyle = 'rgba(140,160,200,.35)'; c.lineWidth = 2; c.stroke();
}
function catHead(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  for (const s of [-1, 1]) { c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(x + s * r * 0.35, y - r * 0.7); c.lineTo(x + s * r * 0.85, y - r * 1.4); c.lineTo(x + s * r * 0.95, y - r * 0.45); c.fill(); c.fillStyle = '#ffb0c8'; c.beginPath(); c.moveTo(x + s * r * 0.5, y - r * 0.75); c.lineTo(x + s * r * 0.8, y - r * 1.15); c.lineTo(x + s * r * 0.85, y - r * 0.6); c.fill(); }
  ball(c, x, y, r);
  c.fillStyle = '#2a2a2a'; for (const s of [-1, 1]) { c.beginPath(); c.arc(x + s * r * 0.35, y - r * 0.1, r * 0.11, 0, 7); c.fill(); }
  c.fillStyle = '#ff8ab0'; c.beginPath(); c.moveTo(x - r * 0.1, y + r * 0.12); c.lineTo(x + r * 0.1, y + r * 0.12); c.lineTo(x, y + r * 0.25); c.fill();
  c.strokeStyle = '#8a8a9a'; c.lineWidth = 1.5; for (const s of [-1, 1]) for (const k of [-0.08, 0.08]) { c.beginPath(); c.moveTo(x + s * r * 0.3, y + r * 0.2 + k * r); c.lineTo(x + s * r * 0.95, y + r * 0.12 + k * r * 2); c.stroke(); }
}

/** 打开叠雪猫；玩家点「离开」后结束。 */
export function openSnowCat(ctx: AppCtx, host: Element): Promise<void> {
  return new Promise((done) => {
    const ov = document.createElement('div');
    ov.className = 'fish-ov';
    ov.innerHTML = `<div class="fish-card" style="width:min(400px,94%)"><h3>⛄ 叠雪猫</h3><div class="sc-hud"></div><canvas class="sc-cv" width="${W}" height="${H}"></canvas><div class="sc-note"></div><div class="fish-info"></div><div class="fish-btns"><button class="btn green" data-sc="main">▶</button><button class="btn ghost" data-sc="close">${icon('close', 18)} 离开</button></div></div>`;
    host.appendChild(ov);
    const q = <T extends Element>(sel: string) => ov.querySelector(sel) as T;
    const cv = q<HTMLCanvasElement>('.sc-cv'), c = cv.getContext('2d')!, hud = q<HTMLElement>('.sc-hud'), note = q<HTMLElement>('.sc-note'), info = q<HTMLElement>('.fish-info'), main = q<HTMLButtonElement>('[data-sc="main"]');
    let phase: Phase = 'idle', raf = 0, tw: Tower = newTower(), t0 = performance.now(), cam = 0, clock = 0, last = performance.now(), tiltA = 0;
    let fall: { x: number; y: number; vy: number; vx: number; r: number } | null = null; // 滚下去的雪球
    let landing: { from: number; to: number; x: number; r: number; k: number } | null = null; // 落下的动画

    const refresh = () => { info.innerHTML = `🎮 今日剩余 ${runsLeft(ctx.s)} 局`; };
    const refreshHud = () => { hud.innerHTML = `<span>⛄ <b>${tw.xs.length - 1}</b> / ${LAYERS} 层</span><span>⭐ <b>${tw.score}</b></span><span>${'🤍'.repeat(Math.max(0, MISSES - tw.misses))}${'💔'.repeat(Math.min(MISSES, tw.misses))}</span>`; };
    const swingT = () => (performance.now() - t0) / 1000;
    const draw = () => {
      const hs = heights(tw.xs.length + 1);
      const topY = hs[tw.xs.length] ?? 0;
      cam += (Math.max(0, topY - (H - 240)) - cam) * 0.12;
      const sky = c.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#7ab4f0'); sky.addColorStop(1, '#e4f2ff'); c.fillStyle = sky; c.fillRect(0, 0, W, H);
      c.fillStyle = 'rgba(255,255,255,.8)'; for (let i = 0; i < 40; i++) { const x = (i * 97 + clock * 12 * (1 + (i % 3))) % W, y = (i * 53 + clock * 30 * (1 + (i % 2))) % H; c.beginPath(); c.arc(x, y, 1.5 + (i % 3), 0, 7); c.fill(); }
      c.save(); c.translate(0, cam);
      // 地面 + 远处小松树
      c.fillStyle = '#ffffff'; c.fillRect(0, GROUND, W, H);
      for (const x of [40, 90, 330, 370]) { c.fillStyle = '#3a8a62'; c.beginPath(); c.moveTo(x, GROUND - 70); c.lineTo(x + 22, GROUND); c.lineTo(x - 22, GROUND); c.fill(); c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(x, GROUND - 70); c.lineTo(x + 8, GROUND - 48); c.lineTo(x - 8, GROUND - 48); c.fill(); }
      // 塔：整体按重心倾斜（快塌时会晃）
      const L0 = lean(tw), wob = Math.abs(L0) > TOPPLE * 0.7 && phase === 'play' ? Math.sin(clock * 12) * 0.015 : 0;
      c.save(); c.translate(px(tw.xs[0]), GROUND); c.rotate(tiltA + wob); c.translate(-px(tw.xs[0]), -GROUND);
      tw.xs.forEach((x, i) => {
        const r = radiusOf(i) * S;
        if (landing && i === tw.xs.length - 1) { const y = landing.from + (landing.to - landing.from) * Math.min(1, landing.k); ball(c, px(x), GROUND - y, r); return; }
        ball(c, px(x), GROUND - hs[i], r);
        if (i === 1) { c.fillStyle = '#d83a30'; c.beginPath(); c.ellipse(px(x), GROUND - hs[i] + r * 0.82, r * 0.72, r * 0.16, 0, 0, 7); c.fill(); c.fillRect(px(x) + r * 0.3, GROUND - hs[i] + r * 0.82, r * 0.2, r * 0.6); } // 第一层和底座之间系条红围巾
      });
      if (phase === 'result' && tw.xs.length > LAYERS) { const i = tw.xs.length - 1; catHead(c, px(tw.xs[i]), GROUND - hs[i], radiusOf(i) * S * 1.05); }
      c.restore();
      // 正在摆的雪球
      if (phase === 'play' && !landing) {
        const i = level(tw), r = radiusOf(i) * S, y = GROUND - hs[i] - 110, x = px(swingX(tw, swingT()));
        c.strokeStyle = 'rgba(255,255,255,.6)'; c.setLineDash([4, 6]); c.beginPath(); c.moveTo(x, y + r); c.lineTo(x, GROUND - hs[i - 1] - radiusOf(i - 1) * S); c.stroke(); c.setLineDash([]);
        ball(c, x, y, r);
      }
      if (fall) ball(c, fall.x, fall.y, fall.r);
      c.restore();
      if (phase !== 'play') { c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(0, 0, W, H); }
    };
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now; clock += dt;
      if (landing) { landing.k += dt * 6; if (landing.k >= 1) landing = null; }
      if (fall) { fall.vy += 1400 * dt; fall.x += fall.vx * dt; fall.y += fall.vy * dt; if (fall.y > GROUND + 200) fall = null; }
      if (tw.toppled) tiltA += (Math.sign(lean(tw)) * 0.9 - tiltA) * dt * 2.5;
      draw();
      raf = requestAnimationFrame(loop);
    };
    const idle = () => {
      phase = 'idle'; tw = newTower(); tiltA = 0; fall = null; landing = null; refresh(); refreshHud();
      const ok = runsLeft(ctx.s) > 0;
      main.style.display = ''; main.disabled = !ok; main.innerHTML = ok ? '▶ 开始堆' : '😴 今天玩够啦';
      note.innerHTML = ok ? `点一下让雪球落下叠上去：正中算完美（+4），偏太多会滚下去（共 ${MISSES} 次机会），叠歪了整座会塌。叠满 ${LAYERS} 层装上猫头！${starsHtml(1, 3, 14)} ${TIERS.join(' / ')}` : '';
    };
    const start = () => {
      if (!useRun(ctx.s)) { idle(); return; }
      ctx.save(); tw = newTower(); tw.phase = Math.random() * 6.28; tiltA = 0; fall = null; landing = null; phase = 'play'; t0 = performance.now();
      main.style.display = 'none'; note.textContent = '👆 点画面让雪球落下'; refresh(); refreshHud();
    };
    const finish = () => {
      phase = 'result';
      const tier = tierOf(tw.score), gain = snowcatGain(ctx.s, tier);
      if (tier > 0) { applyGain(ctx.s, boostGain(ctx.s, gain, () => ctx.toast('🌟 今日推荐小游戏：这局奖励翻倍！'))); sfx.win(); } else sfx.no();
      recordLayers(ctx.s, tw.xs.length - 1); if (tier === 3 && dailyEgg(ctx.s, dayIndex())) ctx.toast('🥚 三星奖励：获得一颗宠物蛋！'); ctx.save();
      main.style.display = ''; main.disabled = runsLeft(ctx.s) <= 0; main.innerHTML = main.disabled ? '😴 今天玩够啦' : '🔁 再堆一个';
      const why = tw.xs.length > LAYERS ? '🐱 雪猫完成！' : tw.toppled ? '💥 叠歪塌了…' : '☃️ 雪球用完了';
      note.innerHTML = `${why} ${starsHtml(tier)} ⭐ ${tw.score} &nbsp; ⛄ ${tw.xs.length - 1} 层（完美 ${tw.perfect}） &nbsp; ${tier > 0 ? gainIcons(gain, 18) : ''}`;
      refresh(); refreshHud();
    };
    const tap = () => {
      if (phase !== 'play' || landing) return;
      const i = level(tw), hs = heights(i + 1), x = swingX(tw, swingT()), r = radiusOf(i) * S;
      const res = drop(tw, swingT(), Math.random() * 6.28);
      t0 = performance.now();
      if (res === 'miss') {
        sfx.no(); note.textContent = '😿 偏太多，滚下去了';
        const top = tw.xs[i - 1]; fall = { x: px(x), y: GROUND - hs[i] - 110, vy: 0, vx: (x > top ? 1 : -1) * 220, r };
      } else {
        landing = { from: hs[i] + 110, to: hs[i], x, r, k: 0 };
        if (res === 'perfect') { sfx.coin(); note.textContent = '✨ 完美！'; }
        else if (res === 'topple') { sfx.no(); note.textContent = '💥 歪得太厉害，塌了！'; }
        else if (res === 'done') { sfx.up(); note.textContent = '🐱 叠满啦，装上猫头！'; }
        else { sfx.tap(); note.textContent = Math.abs(lean(tw)) > TOPPLE * 0.7 ? '⚠️ 有点歪了，下一个往另一边放' : ''; }
      }
      refreshHud();
      if (tw.over) setTimeout(finish, 450);
    };
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); tap(); });
    const press = () => { if (main.disabled) return; if (phase === 'idle' || phase === 'result') start(); };
    const onKey = (e: KeyboardEvent) => {
      if ((e.code === 'Space' || e.key === 'Enter')) { e.preventDefault(); if (phase === 'play') tap(); else press(); }
      else if (e.key === 'Escape') close();
    };
    const close = () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); ov.remove(); ctx.save(); done(); };
    ov.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest('[data-sc]') as HTMLElement | null; if (!b) return; if (b.dataset.sc === 'close') close(); else press(); });
    window.addEventListener('keydown', onKey);
    idle();
    raf = requestAnimationFrame(loop);
  });
}
