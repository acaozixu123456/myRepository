// 夹娃娃机界面（赛博街区「九命电器」门口）：爪子在顶上左右跑，点「抓」或画面 / 空格下爪。规则在 game/claw.ts。
import { dailyEgg } from '../../game/pets';
import { dayIndex } from '../../game/premium';
import { GRABS, TIERS, TOY_HALF, TOY_NAME, TOY_SCORE, clawGain, clawX, grab, isOver, newMachine, recordWon, runsLeft, tierOf, useRun } from '../../game/claw';
import type { GrabResult, Machine, Toy, ToyKind } from '../../game/claw';
import { gainIcons, starsHtml } from '../../ui/gain';
import { icon } from '../../ui/icons';
import { applyGain } from '../../game/stage';
import { boostGain } from '../../game/featured';
import { sfx } from '../sfx';
import type { AppCtx } from '../ctx';

export const CLAW_CSS = `
.cw-cv{display:block;margin:6px auto;max-width:100%;max-height:46vh;border-radius:16px;border:3px solid #ff6ac0;box-shadow:0 0 18px rgba(255,106,192,.45);background:#2a1638;touch-action:none;cursor:pointer}
.cw-hud{display:flex;justify-content:space-between;align-items:center;font-weight:800;font-size:14px}
.cw-hud b{color:#ffe27a;font-size:18px}
.cw-note{min-height:20px;font-weight:800;font-size:13px;color:#ffe9a0}
`;

const W = 600, H = 330, TOP = 46, FLOOR = 262, CHUTE = 0.04; // CHUTE：左下出货口（机器宽的比例）
const TOY_COL: Record<ToyKind, [string, string]> = { plush: ['#ffd0e4', '#ff8ac0'], big: ['#ffb060', '#e07a2a'], gold: ['#ffe27a', '#d8a020'] };
const PLUSH_TINTS = ['#ffd0e4', '#c8e8ff', '#d8ffd0', '#e8d8ff'];
type Phase = 'idle' | 'aim' | 'drop' | 'result';

const px = (x: number) => 30 + x * (W - 60);

function drawToy(c: CanvasRenderingContext2D, t: Toy, x: number, y: number) {
  const r = TOY_HALF[t.kind] * (W - 60) * 0.95;
  const [fill, edge] = t.kind === 'plush' ? [PLUSH_TINTS[t.id % PLUSH_TINTS.length], '#b07aa0'] : TOY_COL[t.kind];
  c.save(); c.translate(x, y);
  if (t.kind === 'gold') { c.shadowColor = '#ffe27a'; c.shadowBlur = 16; }
  c.fillStyle = fill; c.strokeStyle = edge; c.lineWidth = 2;
  // 身子 + 头 + 耳朵
  c.beginPath(); c.ellipse(0, r * 0.25, r * 0.95, r * 0.75, 0, 0, 7); c.fill(); c.stroke();
  c.beginPath(); c.arc(0, -r * 0.55, r * 0.68, 0, 7); c.fill(); c.stroke();
  for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * r * 0.62, -r * 0.8); c.lineTo(s * r * 0.5, -r * 1.35); c.lineTo(s * r * 0.15, -r * 1.05); c.closePath(); c.fill(); c.stroke(); }
  c.shadowBlur = 0;
  c.fillStyle = '#3a2030'; for (const s of [-1, 1]) { c.beginPath(); c.arc(s * r * 0.26, -r * 0.6, Math.max(1.6, r * 0.09), 0, 7); c.fill(); }
  c.strokeStyle = '#3a2030'; c.lineWidth = 1.5; c.beginPath(); c.arc(-r * 0.08, -r * 0.4, r * 0.09, 0, Math.PI); c.arc(r * 0.08, -r * 0.4, r * 0.09, 0, Math.PI); c.stroke();
  if (t.kind === 'gold') { c.fillStyle = '#c84a2a'; c.beginPath(); c.arc(0, r * 0.2, r * 0.22, 0, 7); c.fill(); c.fillStyle = '#ffe27a'; c.font = `900 ${Math.round(r * 0.3)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('福', 0, r * 0.21); }
  c.restore();
}

function drawClaw(c: CanvasRenderingContext2D, x: number, y: number, open: number) {
  c.strokeStyle = '#c8c8d8'; c.lineWidth = 3; c.beginPath(); c.moveTo(x, TOP - 8); c.lineTo(x, y); c.stroke();
  c.fillStyle = '#e8e8f4'; c.fillRect(x - 12, y - 4, 24, 10);
  c.strokeStyle = '#d8d8e8'; c.lineWidth = 4; c.lineCap = 'round';
  for (const s of [-1, 1]) { c.beginPath(); c.moveTo(x + s * 8, y + 6); c.lineTo(x + s * (10 + open * 14), y + 24); c.lineTo(x + s * (4 + open * 8), y + 36); c.stroke(); }
  c.lineCap = 'butt';
}

/** 打开夹娃娃机；玩家点「离开」后结束。 */
export function openClaw(ctx: AppCtx, host: Element): Promise<void> {
  return new Promise((done) => {
    const ov = document.createElement('div');
    ov.className = 'fish-ov';
    ov.innerHTML = `<div class="fish-card" style="width:min(430px,94%)"><h3>🧸 夹娃娃机</h3><div class="cw-hud"></div><canvas class="cw-cv" width="${W}" height="${H}"></canvas><div class="cw-note"></div><div class="fish-info"></div><div class="fish-btns"><button class="btn green" data-cw="main">▶</button><button class="btn ghost" data-cw="close">${icon('close', 18)} 离开</button></div></div>`;
    host.appendChild(ov);
    const q = <T extends Element>(sel: string) => ov.querySelector(sel) as T;
    const cv = q<HTMLCanvasElement>('.cw-cv'), c = cv.getContext('2d')!, hud = q<HTMLElement>('.cw-hud'), note = q<HTMLElement>('.cw-note'), info = q<HTMLElement>('.fish-info'), main = q<HTMLButtonElement>('[data-cw="main"]');
    let phase: Phase = 'idle', raf = 0, m: Machine = newMachine(Math.random), aimT = 0, last = 0;
    // 下爪动画：x 落点；k 0→1 下降、1→2 合爪、2→3 上升（抓牢的跟着上来，没抓牢的半路掉下）、3→4 移到出货口
    let drop: { x: number; k: number; res: GrabResult } | null = null;

    const refresh = () => { info.innerHTML = `🎮 今日剩余 ${runsLeft(ctx.s)} 局`; };
    const refreshHud = () => { hud.innerHTML = `<span>🪝 <b>${GRABS - m.grabs}</b>/${GRABS}</span><span>⭐ <b>${m.score}</b></span><span>${m.won.map((k) => (k === 'gold' ? '🐱' : k === 'big' ? '🧡' : '🧸')).join('') || '&nbsp;'}</span>`; };
    const clawPos = (): { x: number; y: number; open: number; carry: Toy | null; carryY: number } => {
      if (!drop) return { x: phase === 'aim' ? clawX(aimT, m.grabs) : 0.5, y: TOP, open: 1, carry: null, carryY: 0 };
      const { k, res } = drop, low = FLOOR - 52;
      const ok = res.ok && res.toy;
      if (k < 1) return { x: drop.x, y: TOP + (low - TOP) * k, open: 1, carry: null, carryY: 0 };
      if (k < 2) return { x: drop.x, y: low, open: 1 - (k - 1) * (ok ? 0.75 : 0.95), carry: null, carryY: 0 };
      if (k < 3) {
        const y = low - (low - TOP) * (k - 2);
        const slip = res.toy && !ok && k < 2.45; // 没抓牢：先带起来一点，再掉下去
        return { x: drop.x, y, open: ok ? 0.25 : 0.05, carry: ok || slip ? res.toy : null, carryY: y + 40 };
      }
      const x = drop.x + (CHUTE - drop.x) * Math.min(1, k - 3);
      return { x, y: TOP, open: ok ? 0.25 : 0.05, carry: ok ? res.toy : null, carryY: TOP + 40 };
    };
    const draw = () => {
      // 机身：霓虹边框 + 深紫玻璃 + 底座
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#3a1a52'); g.addColorStop(1, '#1a0e2a'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      c.fillStyle = 'rgba(255,255,255,.05)'; c.beginPath(); c.moveTo(60, 0); c.lineTo(150, 0); c.lineTo(70, FLOOR); c.lineTo(0, FLOOR); c.fill();
      c.fillStyle = '#ff6ac0'; c.fillRect(0, TOP - 14, W, 6);
      c.fillStyle = '#4a2a5a'; c.fillRect(0, FLOOR, W, H - FLOOR);
      c.fillStyle = '#ff6ac0'; c.fillRect(0, FLOOR, W, 4);
      // 出货口
      c.fillStyle = '#0a0612'; c.fillRect(px(CHUTE) - 30, FLOOR - 6, 60, 26); c.fillStyle = '#ffe27a'; c.font = 'bold 12px sans-serif'; c.textAlign = 'center'; c.fillText('出口', px(CHUTE), FLOOR + 38);
      const cp = clawPos();
      for (const t of m.toys) if (t !== cp.carry) drawToy(c, t, px(t.x), FLOOR - 26);
      // 瞄准线
      if (phase === 'aim') { c.strokeStyle = 'rgba(255,226,122,.35)'; c.setLineDash([6, 8]); c.lineWidth = 2; c.beginPath(); c.moveTo(px(cp.x), TOP); c.lineTo(px(cp.x), FLOOR); c.stroke(); c.setLineDash([]); }
      if (cp.carry) drawToy(c, cp.carry, px(cp.x), cp.carryY);
      drawClaw(c, px(cp.x), cp.y, cp.open);
      // 价目
      c.fillStyle = 'rgba(255,255,255,.75)'; c.font = 'bold 13px sans-serif'; c.textAlign = 'right'; c.fillText(`🧸 ${TOY_SCORE.plush}  🧡 ${TOY_SCORE.big}  🐱 ${TOY_SCORE.gold}`, W - 12, 20);
    };
    const idle = () => {
      phase = 'idle'; drop = null; m = newMachine(Math.random); refresh(); refreshHud(); draw();
      const ok = runsLeft(ctx.s) > 0;
      main.style.display = ''; main.disabled = !ok; main.innerHTML = ok ? '▶ 投币开始' : '😴 今天玩够啦';
      note.innerHTML = ok ? `爪子来回跑，看准了按「抓」。对得越正越抓得牢。${starsHtml(1, 3, 14)} ${TIERS.join(' / ')} 分` : '';
    };
    const start = () => {
      if (!useRun(ctx.s)) { idle(); return; }
      ctx.save(); m = newMachine(Math.random); drop = null; phase = 'aim'; aimT = Math.random() * 3; last = performance.now();
      main.innerHTML = '🪝 抓！'; main.disabled = false; note.textContent = ''; refresh(); refreshHud();
      cancelAnimationFrame(raf); raf = requestAnimationFrame(tick);
    };
    const doGrab = () => {
      if (phase !== 'aim') return;
      const x = clawX(aimT, m.grabs), res = grab(m, x);
      drop = { x, k: 0, res }; phase = 'drop'; main.disabled = true; sfx.tap();
    };
    const tick = (now: number) => {
      const dt = Math.min(0.25, (now - last) / 1000); last = now;
      if (phase === 'aim') aimT += dt;
      else if (phase === 'drop' && drop) {
        const before = drop.k;
        drop.k += dt * (drop.k < 1 ? 1.4 : drop.k < 2 ? 2.5 : drop.k < 3 ? 1.3 : 1.6);
        if (before < 2.45 && drop.k >= 2.45 && drop.res.toy && !drop.res.ok) { note.textContent = `💨 ${TOY_NAME[drop.res.toy.kind]}滑掉了…`; sfx.no(); }
        if (before < 1 && drop.k >= 1 && !drop.res.toy) { note.textContent = '🙀 抓空了'; sfx.no(); }
        const end = drop.res.ok ? 4 : 3;
        if (drop.k >= end) {
          if (drop.res.ok && drop.res.toy) { note.textContent = `🎉 抓到${TOY_NAME[drop.res.toy.kind]}！+${TOY_SCORE[drop.res.toy.kind]}`; sfx.coin(); }
          drop = null; refreshHud();
          if (isOver(m)) { draw(); finish(); return; }
          phase = 'aim'; main.disabled = false;
        }
      }
      draw();
      raf = requestAnimationFrame(tick);
    };
    const finish = () => {
      cancelAnimationFrame(raf); raf = 0;
      const tier = tierOf(m.score), g = clawGain(ctx.s, tier);
      if (tier > 0) { applyGain(ctx.s, boostGain(ctx.s, g, () => ctx.toast('🌟 今日推荐小游戏：这局奖励翻倍！'))); sfx.win(); } else sfx.no();
      recordWon(ctx.s, m.won.length); if (tier === 3 && dailyEgg(ctx.s, dayIndex())) ctx.toast('🥚 三星奖励：获得一颗宠物蛋！'); ctx.save();
      phase = 'result'; main.disabled = runsLeft(ctx.s) <= 0; main.innerHTML = main.disabled ? '😴 今天玩够啦' : '🔁 再来一局';
      note.innerHTML = `${starsHtml(tier)} ⭐ ${m.score} &nbsp; ${tier > 0 ? gainIcons(g, 18) : '一个都没抓到，下次瞄准点'}`;
      refresh();
    };
    const press = () => { if (main.disabled) return; if (phase === 'aim') doGrab(); else if (phase === 'idle' || phase === 'result') start(); };
    const close = () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); ov.remove(); ctx.save(); done(); };
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); press(); } else if (e.key === 'Escape') close(); };
    cv.addEventListener('pointerdown', () => { if (phase === 'aim') doGrab(); });
    ov.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest('[data-cw]') as HTMLElement | null; if (!b) return; if (b.dataset.cw === 'close') close(); else press(); });
    window.addEventListener('keydown', onKey);
    idle();
  });
}
