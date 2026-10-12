// 沙漠卡丁车界面：俯视的椭圆赛道，左右打方向（触屏按住左 / 右半屏或按钮，键盘 ←→ / A D），空格 / 🔥 喷氮气。规则在 game/kart.ts。
import { dailyEgg } from '../../game/pets';
import { dayIndex } from '../../game/premium';
import { ITEM_NAME, LAPS, NITRO_CHARGES, kartGain, newRace, placeNow, recordRace, runsLeft, step, tierOf, useRun } from '../../game/kart';
import type { ItemKind, Race, Racer } from '../../game/kart';
import { gainIcons, starsHtml } from '../../ui/gain';
import { icon } from '../../ui/icons';
import { applyGain } from '../../game/stage';
import { boostGain } from '../../game/featured';
import { sfx } from '../sfx';
import type { AppCtx } from '../ctx';

export const KART_CSS = `
.kt-cv{display:block;margin:6px auto;max-width:100%;max-height:44vh;border-radius:14px;border:2px solid #6a4a2a;background:#e8c488;touch-action:none}
.kt-hud{display:flex;justify-content:space-between;align-items:center;font-weight:800;font-size:14px}
.kt-hud b{color:#ffe27a;font-size:18px}
.kt-ctl{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;margin-top:6px}
.kt-ctl .btn{font-size:22px;padding:10px 0;touch-action:none;user-select:none;-webkit-user-select:none}
.kt-ctl .nitro{padding:10px 16px}
.kt-ctl .btn.on{filter:brightness(1.3);transform:translateY(2px)}
.kt-note{height:20px;font-weight:800;font-size:13px;color:#ffe9a0}
`;

const BODY = ['#3a3a48', '#ff9a3a', '#e8c0a0', '#ff4a4a'];
const ITEM_COL: Record<ItemKind, string> = { boost: '#4ae0ff', sand: '#b8864a', oil: '#2a1a3a', fuel: '#7fe08a' };
const W = 600, H = 420, CX = W / 2, CY = H / 2, RX = 215, RZ = 140, TW = 74;

type Phase = 'idle' | 'count' | 'play' | 'result';

const pos = (s: number, lane: number) => {
  const a = Math.PI / 2 + s * Math.PI * 2, k = 1 + lane * (TW / 2 - 14) / RX, kz = 1 + lane * (TW / 2 - 14) / RZ;
  return { x: CX + Math.cos(a) * RX * k, y: CY + Math.sin(a) * RZ * kz, ang: Math.atan2(Math.cos(a) * RZ, -Math.sin(a) * RX) };
};

function drawTrack(c: CanvasRenderingContext2D) {
  c.fillStyle = '#ecc88a'; c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(190,140,80,.18)'; for (let i = 0; i < 90; i++) { c.beginPath(); c.ellipse((i * 97) % W, (i * 53) % H, 14 + (i % 5) * 8, 3 + (i % 3), 0, 0, 7); c.fill(); }
  // 绿洲 + 仙人掌装饰
  c.fillStyle = '#3ab8c8'; c.beginPath(); c.ellipse(CX, CY, RX - TW / 2 - 18, RZ - TW / 2 - 14, 0, 0, 7); c.fillStyle = '#d4a868'; c.fill();
  c.fillStyle = '#4f9a4a'; for (const [x, y] of [[CX - 40, CY - 14], [CX + 46, CY + 18], [CX + 8, CY + 4]]) { c.fillRect(x - 3, y - 12, 6, 18); c.fillRect(x - 9, y - 6, 6, 3); c.fillRect(x + 3, y - 9, 6, 3); }
  c.fillStyle = '#ff7a4a'; c.beginPath(); c.arc(CX - 80, CY + 20, 12, Math.PI, 0); c.fill();
  // 赛道：外沿轮胎 + 路面 + 中线
  c.lineWidth = TW + 16; c.strokeStyle = '#d8402a'; c.beginPath(); c.ellipse(CX, CY, RX, RZ, 0, 0, 7); c.stroke();
  c.setLineDash([14, 14]); c.strokeStyle = '#f4f0e8'; c.stroke(); c.setLineDash([]);
  c.lineWidth = TW; c.strokeStyle = '#8a6a4a'; c.beginPath(); c.ellipse(CX, CY, RX, RZ, 0, 0, 7); c.stroke();
  c.lineWidth = 2; c.strokeStyle = 'rgba(255,246,220,.55)'; c.setLineDash([10, 12]); c.beginPath(); c.ellipse(CX, CY, RX, RZ, 0, 0, 7); c.stroke(); c.setLineDash([]);
  // 发车线（黑白格）
  const p = pos(0, 0), n = 8;
  c.save(); c.translate(p.x, p.y); c.rotate(p.ang);
  for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) { c.fillStyle = (i + j) % 2 ? '#111' : '#fff'; c.fillRect(-4 + j * 4, -TW / 2 + (i * TW) / n, 4, TW / n); }
  c.restore();
}
const drawItem = (c: CanvasRenderingContext2D, kind: ItemKind, x: number, y: number, ang: number) => {
  c.save(); c.translate(x, y); c.rotate(ang);
  c.fillStyle = ITEM_COL[kind];
  if (kind === 'boost') { c.fillRect(-8, -13, 16, 26); c.fillStyle = '#fff'; for (const dx of [-3, 4]) { c.beginPath(); c.moveTo(dx - 3, 6); c.lineTo(dx + 1, -4); c.lineTo(dx + 5, 6); c.fill(); } }
  else if (kind === 'sand') { c.globalAlpha = 0.9; c.beginPath(); c.ellipse(0, 0, 12, 17, 0, 0, 7); c.fill(); c.fillStyle = '#e0b878'; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(Math.cos(i * 1.3) * 6, Math.sin(i * 1.3) * 9, 2, 0, 7); c.fill(); } }
  else if (kind === 'oil') { c.beginPath(); c.ellipse(0, 0, 11, 15, 0.4, 0, 7); c.fill(); c.fillStyle = 'rgba(255,120,220,.5)'; c.beginPath(); c.ellipse(-3, -4, 4, 6, 0.4, 0, 7); c.fill(); }
  else { c.beginPath(); c.roundRect(-6, -10, 12, 20, 4); c.fill(); c.fillStyle = '#fff'; c.fillRect(-2, -14, 4, 5); c.font = 'bold 11px sans-serif'; c.textAlign = 'center'; c.fillText('N', 0, 4); }
  c.restore();
};
function drawKart(c: CanvasRenderingContext2D, r: Racer, col: string, me: boolean) {
  const p = pos(r.s, r.lane);
  c.save(); c.translate(p.x, p.y); c.rotate(p.ang + (r.spin > 0 ? r.spin * 14 : 0));
  if (me) { c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 19, 0, 7); c.stroke(); }
  c.fillStyle = '#1a1a20'; for (const [dx, dy] of [[-8, -9], [-8, 9], [8, -9], [8, 9]]) c.fillRect(dx - 3, dy - 2, 6, 4);
  c.fillStyle = col; c.beginPath(); c.roundRect(-12, -7, 24, 14, 4); c.fill();
  c.fillStyle = '#f4f0e8'; c.fillRect(8, -5, 4, 10);
  c.fillStyle = col === '#ff4a4a' ? '#ffd0b0' : '#f4e4d0'; c.beginPath(); c.arc(-2, 0, 6, 0, 7); c.fill(); // 猫头
  c.fillStyle = col; c.beginPath(); c.moveTo(-6, -4); c.lineTo(-4, -9); c.lineTo(-1, -5); c.moveTo(-6, 4); c.lineTo(-4, 9); c.lineTo(-1, 5); c.fill();
  if (r.boost > 0 || r.nitro > 0) { c.fillStyle = r.nitro > 0 ? '#ff7a2a' : '#4ae0ff'; c.beginPath(); c.moveTo(-12, -4); c.lineTo(-24 - Math.random() * 6, 0); c.lineTo(-12, 4); c.fill(); }
  c.restore();
}

/** 打开卡丁车；玩家点「离开」后结束。 */
export function openKart(ctx: AppCtx, host: Element): Promise<void> {
  return new Promise((done) => {
    const ov = document.createElement('div');
    ov.className = 'fish-ov';
    ov.innerHTML = `<div class="fish-card" style="width:min(430px,94%)"><h3>🏎️ 沙漠卡丁车</h3><div class="kt-hud"></div><canvas class="kt-cv" width="${W}" height="${H}"></canvas><div class="kt-note"></div><div class="kt-ctl"><button class="btn" data-k="L">◀</button><button class="btn pink nitro" data-k="N">🔥 <span class="nc"></span></button><button class="btn" data-k="R">▶</button></div><div class="fish-info"></div><div class="fish-btns"><button class="btn green" data-kt="main">▶</button><button class="btn ghost" data-kt="close">${icon('close', 18)} 离开</button></div></div>`;
    host.appendChild(ov);
    const q = <T extends Element>(sel: string) => ov.querySelector(sel) as T;
    const cv = q<HTMLCanvasElement>('canvas'), c = cv.getContext('2d')!, hud = q<HTMLElement>('.kt-hud'), note = q<HTMLElement>('.kt-note'), info = q<HTMLElement>('.fish-info'), main = q<HTMLButtonElement>('[data-kt="main"]'), nc = q<HTMLElement>('.nc'), ctl = q<HTMLElement>('.kt-ctl');
    const bg = document.createElement('canvas'); bg.width = W; bg.height = H; drawTrack(bg.getContext('2d')!);
    let phase: Phase = 'idle', raf = 0, race: Race = newRace(Math.random), last = 0, count = 0, left = false, right = false, nitroHit = false, noteT = 0, lastHits = '';

    const say = (t: string) => { note.textContent = t; noteT = 1.4; };
    const draw = () => {
      c.drawImage(bg, 0, 0);
      for (let lap = 0; lap < 1; lap++) for (const it of race.items) { const p = pos(it.s, it.lane); drawItem(c, it.kind, p.x, p.y, p.ang); }
      race.ai.forEach((a, i) => drawKart(c, a, BODY[i], false));
      drawKart(c, race.me, BODY[3], true);
      if (phase === 'count') { c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0, 0, W, H); c.fillStyle = '#fff'; c.font = '900 90px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(count > 0.05 ? String(Math.ceil(count)) : 'GO!', CX, CY); }
    };
    const lapOf = () => Math.min(LAPS, Math.floor(race.me.s) + 1);
    const refreshHud = () => { hud.innerHTML = phase === 'idle' ? '' : `<span>🏁 <b>${lapOf()}</b>/${LAPS}</span><span>名次 <b>${placeNow(race)}</b>/4</span><span>⏱ ${race.t.toFixed(1)}s</span>`; nc.textContent = '×' + race.charges; };
    const refresh = () => { info.innerHTML = `🎮 今日剩余 ${runsLeft(ctx.s)} 场`; };
    const idle = () => {
      phase = 'idle'; race = newRace(Math.random); refresh(); refreshHud(); draw();
      const ok = runsLeft(ctx.s) > 0;
      main.style.display = ''; main.disabled = !ok; main.innerHTML = ok ? '▶ 发车' : '😴 今天玩够啦';
      note.textContent = ok ? `跑 ${LAPS} 圈：压蓝色加速带、捡绿瓶攒氮气，避开流沙和油渍。第 1 名 ★★★` : '';
    };
    const start = () => {
      if (!useRun(ctx.s)) { idle(); return; }
      ctx.save(); race = newRace(Math.random); phase = 'count'; count = 3; last = performance.now(); lastHits = ''; main.style.display = 'none'; refresh(); note.textContent = '';
      raf = requestAnimationFrame(tick);
    };
    const tick = (now: number) => {
      if (phase !== 'count' && phase !== 'play') return;
      // 掉帧时按真实时间分几小步推进（每步 ≤ 0.05 秒，最多补 0.25 秒），慢手机上比赛不会变成慢动作
      const real = Math.min(0.25, (now - last) / 1000), dt = real; last = now;
      if (phase === 'count') { count -= dt; if (count <= -0.5) { phase = 'play'; count = 0; } }
      else {
        const hits = JSON.stringify(race.hits);
        for (let rest = real; rest > 1e-6 && !race.over; rest -= 0.05) {
          step(race, (right ? 1 : 0) - (left ? 1 : 0), nitroHit, Math.min(0.05, rest));
          if (nitroHit) { sfx.up(); nitroHit = false; }
        }
        if (hits !== lastHits) { for (const k of Object.keys(race.hits) as ItemKind[]) if (lastHits && race.hits[k] !== JSON.parse(lastHits)[k]) { say(`${{ boost: '🚀', sand: '🏜️', oil: '🌀', fuel: '⛽' }[k]} ${ITEM_NAME[k]}！`); if (k === 'boost' || k === 'fuel') sfx.tap(); else sfx.no(); } lastHits = hits; }
        if (race.over) { draw(); finish(); return; }
      }
      if (noteT > 0 && (noteT -= dt) <= 0) note.textContent = '';
      refreshHud(); draw();
      raf = requestAnimationFrame(tick);
    };
    const finish = () => {
      cancelAnimationFrame(raf); raf = 0;
      const place = race.place, tier = tierOf(place), g = kartGain(ctx.s, tier);
      if (tier > 0) { applyGain(ctx.s, boostGain(ctx.s, g, () => ctx.toast('🌟 今日推荐小游戏：这局奖励翻倍！'))); sfx.coin(); } else sfx.no();
      recordRace(ctx.s); if (tier === 3 && dailyEgg(ctx.s, dayIndex())) ctx.toast('🥚 三星奖励：获得一颗宠物蛋！'); ctx.save();
      phase = 'result'; main.style.display = ''; main.disabled = runsLeft(ctx.s) <= 0; main.innerHTML = main.disabled ? '😴 今天玩够啦' : '🔁 再来一场';
      note.innerHTML = `${['', '🥇 第 1 名！', '🥈 第 2 名', '🥉 第 3 名', '第 4 名，差一点'][place]} &nbsp; ⏱ ${race.t.toFixed(1)}s<div style="margin-top:2px">${starsHtml(tier)} ${tier > 0 ? gainIcons(g, 18) : ''}</div>`;
      note.style.height = 'auto'; refresh();
    };
    const press = () => { if (main.disabled) return; if (phase === 'idle' || phase === 'result') { note.style.height = ''; start(); } };
    const close = () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp); ov.remove(); ctx.save(); done(); };
    const setDir = (d: 'L' | 'R', on: boolean) => { if (d === 'L') left = on; else right = on; ctl.querySelector(`[data-k="${d}"]`)?.classList.toggle('on', on); };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') { setDir('L', true); e.preventDefault(); }
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') { setDir('R', true); e.preventDefault(); }
      else if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); if (phase === 'play') nitroHit = true; else press(); }
      else if (e.key === 'Escape') close();
    };
    const onKeyUp = (e: KeyboardEvent) => { if (e.code === 'ArrowLeft' || e.code === 'KeyA') setDir('L', false); else if (e.code === 'ArrowRight' || e.code === 'KeyD') setDir('R', false); };
    ctl.addEventListener('pointerdown', (e) => { const b = (e.target as HTMLElement).closest('[data-k]') as HTMLElement | null; if (!b) return; (b as HTMLElement).setPointerCapture?.(e.pointerId); if (b.dataset.k === 'N') { if (phase === 'play') nitroHit = true; } else setDir(b.dataset.k as 'L' | 'R', true); });
    const rel = (e: PointerEvent) => { const b = (e.target as HTMLElement).closest('[data-k]') as HTMLElement | null; if (b && b.dataset.k !== 'N') setDir(b.dataset.k as 'L' | 'R', false); };
    ctl.addEventListener('pointerup', rel); ctl.addEventListener('pointercancel', rel); ctl.addEventListener('lostpointercapture', rel);
    // 画布左 / 右半屏也能按住转向（单手玩）
    cv.addEventListener('pointerdown', (e) => { const r = cv.getBoundingClientRect(); setDir((e.clientX - r.left) < r.width / 2 ? 'L' : 'R', true); cv.setPointerCapture(e.pointerId); });
    const cvUp = () => { setDir('L', false); setDir('R', false); };
    cv.addEventListener('pointerup', cvUp); cv.addEventListener('pointercancel', cvUp);
    ov.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest('[data-kt]') as HTMLElement | null; if (!b) return; if (b.dataset.kt === 'close') close(); else press(); });
    window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKeyUp);
    void NITRO_CHARGES;
    idle();
  });
}
