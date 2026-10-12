// 探索：3D 赛博朋克街区。操控一队猫猫走动，碰到野怪 / 首领就开战（用现有战斗引擎），开宝箱、找向导。
// 世界渲染在 src/world，规则在 src/game/explore.ts，这里把两者和界面连起来。
import { Explorer } from '../../world/explore';
import type { Spawn } from '../../world/explore';
import { WorldView, defaultQuality } from '../../world/engine';
import { buildStreet } from '../../world/street';
import { preloadWorldTextures } from '../../world/tex';
import type { Street } from '../../world/street';
import type { LevelDef } from '../../world/levels';
import { LEVELS } from '../../world/levels';
import { bossStage, claimDaily, claimTrail, dailyClaimed, dailyProgress, ensureExplore, explorerLevel, sceneChapter, sceneGame, setScene, unlockedScenes, farmStage, killReward, autoKey, openChest, pickAutoTarget, killsLeft, pickHerb, recordBossWin, spawnPlan, trailRows } from '../../game/explore';
import { applyGain, firstClearReward, recommendedPowerOf, winReward } from '../../game/stage';
import { rollover, track } from '../../game/quests';
import { teamPower } from '../../game/state';
import { artUrl } from '../../ui/art';
import { esc, fmt } from '../../ui/components';
import { HERO_BY_ID } from '../../data/heroes';
import { arenaFight } from '../arenaFight';
import type { AppCtx } from '../ctx';
import { sfx, rainAmbience, stepSfx, alertSfx } from '../sfx';
import { gainIcons, GAIN_CSS } from '../../ui/gain';
import { icon } from '../../ui/icons';
import { FISHING_CSS, openFishing } from './fishing';
import { RAMEN_CSS, openRamen } from './ramen';
import { BOXCAT_CSS, openBoxCat } from './boxcat';
import { MUSHROOM_CSS, openMushroom } from './mushroom';
import { WINDCHIME_CSS, openWindChime } from './windchime';
import { LANTERN_CSS, openLanterns } from './lanterns';
import { topbar } from './lineup';
import { playStoryOnce } from '../story';

export const EXPLORE_CSS = GAIN_CSS + FISHING_CSS + RAMEN_CSS + BOXCAT_CSS + MUSHROOM_CSS + WINDCHIME_CSS + LANTERN_CSS + `
.screen.xplore{background:#0d0818}
.xplore canvas#wcv{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}
.xplore .hud{position:absolute;left:0;right:0;top:0;z-index:3;pointer-events:none;background:linear-gradient(rgba(10,6,24,.85),rgba(10,6,24,0))}
.xplore .hud *{pointer-events:auto}
.xobj{position:absolute;left:10px;right:10px;top:58px;z-index:3;display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:14px;background:rgba(16,10,32,.72);border:2px solid rgba(255,110,210,.55);box-shadow:0 0 18px rgba(255,80,200,.25);color:#fff;backdrop-filter:blur(4px)}
.xpop{position:absolute;left:50%;top:46%;z-index:12;transform:translate(-50%,0);pointer-events:none;display:flex;flex-direction:column;align-items:center;gap:2px;font-weight:900;font-size:20px;color:#ffe9a0;text-shadow:0 0 10px rgba(255,200,80,.9),0 2px 0 #5a3a10;white-space:nowrap;animation:xpopUp 1.5s ease-out both}
.xpop-t{font-size:34px;line-height:1}.xpop .gains{font-size:18px;color:#fff;text-shadow:0 1px 3px #000}
@keyframes xpopUp{0%{opacity:0;transform:translate(-50%,16px) scale(.7)}18%{opacity:1;transform:translate(-50%,0) scale(1.12)}30%{transform:translate(-50%,-4px) scale(1)}100%{opacity:0;transform:translate(-50%,-70px) scale(1)}}
.tr-row{display:flex;align-items:center;gap:8px;margin:8px 0}
.tr-row.done{opacity:.55}
.tr-i{font-size:24px;width:30px;text-align:center}
.tr-m{flex:1;min-width:0;display:grid;gap:3px}
.tr-bar{position:relative;height:16px;border-radius:8px;background:rgba(0,0,0,.18);overflow:hidden}
.tr-bar i{position:absolute;left:0;top:0;bottom:0;background:#3aa8c8}
.tr-row.done .tr-bar i{background:#3aa86a}
.tr-bar b{position:relative;display:block;text-align:center;font-size:11px;line-height:16px;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.6)}
.tr-m .gains{justify-content:flex-start;font-size:12px}
.tr-ok{color:#3aa86a;width:40px;text-align:center}.tr-lock{width:40px;text-align:center;opacity:.5}
.xhelp{position:absolute;inset:0;z-index:25;display:grid;place-items:center;background:rgba(6,3,16,.35);pointer-events:none;animation:xhelpIn .3s ease-out both}
@keyframes xhelpIn{from{opacity:0}to{opacity:1}}
.xhelp>div{pointer-events:auto;width:min(320px,86%);padding:16px 18px;border-radius:16px;background:rgba(22,14,44,.96);border:2px solid rgba(127,240,255,.6);box-shadow:0 0 24px rgba(127,240,255,.3);color:#eae4ff;font-weight:700;font-size:13.5px;line-height:1.75}
.xh{display:grid;gap:12px;text-align:center;font-size:15px;font-weight:800;line-height:1.5}.xh small{font-size:12px;color:#9a8ec0}
.xhelp button{margin-top:10px;width:100%}
.xquest{position:absolute;left:10px;top:122px;z-index:3;width:104px;padding:6px 8px;border-radius:12px;background:rgba(16,10,32,.62);border:1.5px solid rgba(127,240,255,.45);color:#cfc6e8;font-size:12px;font-weight:800;pointer-events:none}
.xquest.ready{border-color:#ffe27a;box-shadow:0 0 12px rgba(255,226,122,.55);animation:xqPulse 1.2s ease-in-out infinite}
@keyframes xqPulse{50%{box-shadow:0 0 20px rgba(255,226,122,.9)}}
.xq-t{font-size:15px;margin-bottom:2px}
.xq-r{display:flex;align-items:center;gap:5px;margin-top:3px}
.xq-r span{font-size:14px;width:18px;text-align:center}
.xq-r i{flex:1;height:6px;border-radius:3px;background:rgba(255,255,255,.15);position:relative;overflow:hidden}
.xq-r i::after{content:"";position:absolute;inset:0;width:var(--p);background:#7ff0ff}
.xq-r.ok i::after{background:#8affb0}
.xq-r b{min-width:28px;text-align:right;font-size:11px}
.xpow{position:relative;height:16px;margin-top:3px;border-radius:8px;background:rgba(255,255,255,.14);overflow:hidden;font-size:11px;font-weight:900}
.xpow i{position:absolute;left:0;top:0;bottom:0;background:#e0485a}
.xpow.ok i{background:#3aa86a}
.xpow span{position:relative;display:flex;align-items:center;gap:3px;justify-content:center;height:100%;color:#fff;text-shadow:0 1px 2px #000}
.xdot{position:absolute;right:2px;top:2px;width:9px;height:9px;border-radius:50%;background:#ff3d7a;box-shadow:0 0 6px #ff3d7a}
.xtools .btn{position:relative;min-width:52px}
.xobj b{display:block;font-family:var(--f-d);font-size:15px;letter-spacing:.04em;color:#ffe9a0}
.xobj small{display:block;font-size:11.5px;font-weight:700;color:#cfc6e8;margin-top:1px}
.xobj .btn{flex:none}
.xteam{position:absolute;left:10px;bottom:10px;z-index:3;display:flex;gap:6px}
.xteam button{width:50px;height:58px;border-radius:12px;background:rgba(16,10,32,.72);border:2px solid rgba(127,240,255,.55);padding:0;overflow:hidden;position:relative}
.xteam button.lead{border-color:#ffd24a;box-shadow:0 0 12px rgba(255,210,74,.6)}
.xteam img{width:100%;height:100%;object-fit:cover;object-position:50% 20%;display:block}
.xmini{position:absolute;right:10px;top:122px;z-index:3;width:92px;height:92px;border-radius:12px;border:2px solid rgba(127,240,255,.6);background:rgba(10,6,24,.7);box-shadow:0 0 12px rgba(127,240,255,.25)}
.xfps{position:absolute;right:12px;top:216px;z-index:3;font-size:10px;font-weight:800;color:rgba(255,255,255,.55);text-shadow:0 1px 2px #000;pointer-events:none}
.xtools{position:absolute;right:10px;bottom:10px;z-index:3;display:flex;flex-direction:column;gap:8px}
.xtools .btn{min-width:64px}
.xscene{margin-left:6px;white-space:nowrap;font-size:13px}
.scn-dlg{width:min(360px,92%)}
.scn-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.scn{position:relative;display:flex;flex-direction:column;align-items:center;gap:2px;padding:10px 6px;border-radius:14px;border:2px solid rgba(0,0,0,.12);background:linear-gradient(var(--paper),var(--paper-2));font-family:inherit;cursor:pointer}
.scn .se{font-size:30px;line-height:1.1}.scn b{font-size:14px;color:var(--ink)}.scn small{font-size:11.5px;font-weight:800;color:#6a5a48}
.scn.on{border-color:#ff7ab8;box-shadow:0 0 0 3px rgba(255,122,184,.35)}.scn.lock{opacity:.5}
.scn .here{position:absolute;right:6px;top:4px;font-style:normal;font-size:10px;font-weight:900;background:#ff7ab8;color:#fff;border-radius:8px;padding:1px 6px}
.xfight{position:absolute;left:50%;margin-left:-70px;bottom:104px;z-index:4;width:140px;padding:12px 8px;border-radius:999px;border:3px solid #fff;background:linear-gradient(#ff7a8a,#e0344f);color:#fff;font:900 20px var(--f-d,inherit);box-shadow:0 0 22px rgba(255,70,100,.75),0 4px 0 rgba(0,0,0,.3);animation:xfightPulse 1s ease-in-out infinite;touch-action:manipulation}
.xfight.boss{background:linear-gradient(#ffd24a,#e08a10);box-shadow:0 0 26px rgba(255,200,60,.85),0 4px 0 rgba(0,0,0,.3)}
@keyframes xfightPulse{50%{transform:scale(1.07)}}
.xjoy{position:absolute;left:14px;bottom:14px;z-index:3;width:116px;height:116px;border-radius:50%;background:rgba(10,6,24,.45);border:2px solid rgba(127,240,255,.45);touch-action:none}
.xjoy i{position:absolute;left:50%;top:50%;width:48px;height:48px;margin:-24px 0 0 -24px;border-radius:50%;background:rgba(127,240,255,.55);box-shadow:0 0 14px rgba(127,240,255,.6);pointer-events:none}
.xload{position:absolute;inset:0;z-index:6;display:grid;place-items:center;background:#0d0818;color:#ffe9a0;font-family:var(--f-d);font-size:18px;text-align:center;line-height:1.8}
.xload small{display:block;font-size:12px;color:#9a8ec0;font-family:inherit}
.arena-ov{position:absolute;inset:0;z-index:30;background:radial-gradient(#1a1030,#05030c);display:flex;align-items:center;justify-content:center}
.arena-ov.wipe-in{animation:arenaIn .6s cubic-bezier(.3,.7,.2,1) both}
.arena-ov.wipe-out{animation:arenaOut .38s ease-in both}
@keyframes arenaIn{from{clip-path:circle(0% at 50% 55%)}to{clip-path:circle(75% at 50% 55%)}}
@keyframes arenaOut{from{clip-path:circle(75% at 50% 55%);opacity:1}to{clip-path:circle(0% at 50% 55%);opacity:.6}}
.arena-banner{position:absolute;left:0;right:0;top:42%;text-align:center;font-size:40px;font-weight:900;color:#fff;letter-spacing:6px;text-shadow:0 0 18px #ff3d7a,0 3px 0 #7a1a3a;animation:bannerPop .65s ease-out both;pointer-events:none}
@keyframes bannerPop{0%{transform:scale(2.2);opacity:0}35%{transform:scale(1);opacity:1}100%{transform:scale(1);opacity:1}}
.arena-ov canvas{width:100%;aspect-ratio:960/600;display:block}
.arena-ov .skip{position:absolute;right:12px;top:calc(12px + env(safe-area-inset-top,0px));padding:7px 14px;border-radius:999px;background:rgba(0,0,0,.55);color:#fff;font-weight:800;border:2px solid rgba(255,255,255,.4)}
.arena-ov .skip2{top:calc(58px + env(safe-area-inset-top,0px))}
`;

export function exploreHtml(): string {
  return `<canvas id="wcv"></canvas><div class="xload" id="xload">霓虹街区加载中…<small>第一次进入要生成场景，请稍等</small></div><div id="xui"></div><div class="xjoy" id="xjoy"><i></i></div><button class="xfight" id="xfight" data-act="x-fight" style="display:none"></button>`;
}

// ---------- 摇杆 / 键盘移动（相对镜头朝向）----------
let autoOn = false;
let autoT = 0;
const autoSkip = new Map<string, number>(); // 走不到的点 → 解封时间
let autoLast = { key: '', tries: 0 };
const keys = new Set<string>();
let joy = { x: 0, y: 0 }; // x 右、y 上，-1..1
let inputBound = false;
let nearSp: Spawn | null = null;
/** 队伍走到野怪 / 首领身边：显示大号「战斗」按钮（由玩家决定打不打）；走开就收起 */
function showFight(sp: Spawn | null) {
  nearSp = sp;
  const b = document.getElementById('xfight') as HTMLElement | null;
  if (!b) return;
  b.style.display = sp ? '' : 'none';
  if (sp) { b.classList.toggle('boss', sp.kind === 'boss'); b.innerHTML = sp.kind === 'boss' ? '👑 挑战首领' : '⚔️ 战斗'; }
}
function bindInput(scr: HTMLElement) {
  if (inputBound) return;
  inputBound = true;
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    keys.add(e.key.toLowerCase());
    if ((e.code === 'Space' || e.code === 'KeyF') && rt?.running && nearSp) { e.preventDefault(); rt.ex.engage(); }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());
  const pad = scr.querySelector('#xjoy') as HTMLElement, knob = pad.querySelector('i') as HTMLElement;
  const set = (e: PointerEvent) => {
    const r = pad.getBoundingClientRect();
    let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), y = -(e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
    joy = m < 0.15 ? { x: 0, y: 0 } : { x, y };
    knob.style.transform = `translate(${x * 34}px,${-y * 34}px)`;
  };
  pad.addEventListener('pointerdown', (e) => { pad.setPointerCapture(e.pointerId); set(e); });
  pad.addEventListener('pointermove', (e) => { if (pad.hasPointerCapture(e.pointerId)) set(e); });
  const end = () => { joy = { x: 0, y: 0 }; knob.style.transform = ''; };
  pad.addEventListener('pointerup', end); pad.addEventListener('pointercancel', end);
}
/** 当前输入方向（世界 xz，已按镜头朝向旋转）；没有输入返回 null */
function moveDir(yaw: number): [number, number] | null {
  let x = joy.x, y = joy.y;
  if (keys.has('a') || keys.has('arrowleft')) x -= 1;
  if (keys.has('d') || keys.has('arrowright')) x += 1;
  if (keys.has('w') || keys.has('arrowup')) y += 1;
  if (keys.has('s') || keys.has('arrowdown')) y -= 1;
  const m = Math.hypot(x, y);
  if (m < 0.1) return null;
  if (m > 1) { x /= m; y /= m; }
  // 镜头在 (sin yaw, cos yaw) 方向，朝向原点：前 = (-sin, -cos)，右 = (cos, -sin)
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  return [rx * x + fx * y, rz * x + fz * y];
}

export interface Rt { wv: WorldView; ex: Explorer; st: Street; dead: Map<string, number>; running: boolean }
let rt: Rt | null = null;
let failed = false;
let busyFight = false;

function planFor(ctx: AppCtx) {
  const e = ensureExplore(ctx.s);
  const now = Date.now();
  return spawnPlan(ctx.s).filter((p) => {
    if (p.kind === 'chest' && e.chests.includes(p.id)) return false;
    if (p.kind === 'herb' && (e.herbs ?? []).includes(p.id)) return false;
    const d = rt?.dead.get(p.id);
    if (d && now < d) return false;
    return true;
  });
}
function syncSpawns(ctx: AppCtx) {
  if (!rt) return;
  rt.ex.clearSpawns();
  for (const p of planFor(ctx)) rt.ex.addSpawn({ id: p.id, kind: p.kind, x: p.x, z: p.z, units: p.units, label: p.label, patrol: p.patrol, data: p.kind === 'poi' ? p.game : p.stageKey });
}

function teamIds(ctx: AppCtx): string[] {
  const ids = ctx.s.lineup.filter((x): x is string => !!x && !!ctx.s.heroes[x]);
  return ids.length ? ids.slice(0, 5) : Object.keys(ctx.s.heroes).slice(0, 5);
}

/** 头顶弹一下奖励（拿到什么一眼能看到），1.5 秒后自动消失 */
function popReward(ctx: AppCtx, title: string, g: { fish?: number; exp?: number; catnip?: number; bells?: number }) {
  const host = ctx.root.querySelector('[data-screen="explore"]');
  if (!host) return;
  host.querySelectorAll('.xpop').forEach((x) => x.remove()); // 连续拾取时只留最新一条，免得叠成一团
  const el = document.createElement('div');
  el.className = 'xpop';
  el.innerHTML = `<span class="xpop-t">${title}</span>${gainIcons(g, 22)}`;
  host.appendChild(el);
  setTimeout(() => el.remove(), 1600);
}
function questHtml(ctx: AppCtx): string {
  const goals = dailyProgress(ctx.s), claimed = dailyClaimed(ctx.s), ready = goals.every((g) => g.done);
  return `<div class="xquest ${ready && !claimed ? 'ready' : ''}"><div class="xq-t">${claimed ? '📜✔' : ready ? '📜❗' : '📜'}</div>${goals.map((g) => `<div class="xq-r ${g.done ? 'ok' : ''}"><span>${STAT_ICON[g.key]}</span><i style="--p:${Math.round((g.have / g.need) * 100)}%"></i><b>${g.have}/${g.need}</b></div>`).join('')}</div>`;
}
const STAT_ICON: Record<string, string> = { kills: '⚔️', chests: '📦', herbs: '🌿', bosses: '👑', fish: '🐟', ramen: '🍜', found: '🐱', mush: '🍄', chime: '🎐', boss: '👑' };
function hud(ctx: AppCtx): string {
  const b = bossStage(ctx.s), rec = recommendedPowerOf(b.chapter, b.index), mine = teamPower(ctx.s);
  const ids = teamIds(ctx), ratio = Math.min(1, mine / rec), enough = mine >= rec;
  return `${topbar(ctx, '探索')}
  <div class="xobj"><div class="grow"><b>${b.fresh ? '👑' : '🔁'} ${b.stage.id}</b><div class="xpow ${enough ? 'ok' : 'low'}"><i style="width:${Math.round(ratio * 100)}%"></i><span>${icon('sword', 14)} ${fmt(mine)} / ${fmt(rec)}</span></div></div>${sceneChapter(ctx.s) === b.chapter ? `<button class="btn sm green" data-act="x-boss" title="首领">${icon('arrowUp', 20)}</button>` : ''}<button class="btn sm pink xscene" data-act="x-scenes" title="切换场景">🗺️ ${esc(LEVELS[sceneChapter(ctx.s)]?.name.split(' · ')[0] ?? '场景')} ▾</button></div>
  <div class="xteam">${ids.map((id, i) => `<button class="${i === 0 ? 'lead' : ''}" data-act="x-hero" data-id="${id}" title="${HERO_BY_ID[id]?.name ?? ''}"><img src="${artUrl(id, 'head')}" alt="" draggable="false"></button>`).join('')}</div>
  ${questHtml(ctx)}
  <canvas class="xmini" id="xmini" width="184" height="184"></canvas><div class="xfps" id="xfps"></div>
  <div class="xtools"><button class="btn sm blue" data-act="nav" data-to="lineup" title="阵容">${icon('team', 22)}</button><button class="btn sm ${autoOn ? 'green' : 'ghost'}" data-act="x-auto" title="自动探索">${autoOn ? '⏸' : '⏩'}</button><button class="btn sm ghost" data-act="x-trail" title="足迹">${icon('trophy', 22)}${trailRows(ctx.s).some((r) => r.ready) ? '<span class="xdot"></span>' : ''}</button><button class="btn sm ghost" data-act="x-reset" title="回出生点">${icon('home', 22)}</button></div>`;
}

const GFX_LV = { auto: 0, high: 0, low: 3 } as const;
function applyGfx(ctx: AppCtx, wv: WorldView) {
  const g = ctx.s.settings.gfx ?? 'auto';
  wv.lockQuality = g !== 'auto';
  wv.forceLevel(GFX_LV[g]);
}
function showHelpOnce(ctx: AppCtx) {
  const s = ctx.s;
  s.tips ??= [];
  if (s.tips.includes('explore-help')) return;
  s.tips.push('explore-help'); ctx.save();
  const el = document.createElement('div');
  el.className = 'xhelp';
  el.innerHTML = `<div class="xh">
    <div>👆 点地面走过去</div><div>🕹️ 摇杆 / WASD 移动</div><div>☝️ 拖动转镜头 · 🤏 缩放</div><div>🐱 走到野猫身边 ➜ 点 <b>⚔️ 战斗</b>（想打才打）</div><div>👑 首领打赢 ➜ 进下一章</div><div>📜 宝箱 / NPC / 小游戏入口 ➜ 奖励</div>
    <button class="btn green">${icon('check', 24)}</button></div>`;
  el.onclick = (e) => { if ((e.target as HTMLElement).closest('button')) el.remove(); };
  // 不挡操作：开始移动（摇杆 / 键盘）、点一下场景，或 12 秒后自动收起
  rt?.wv.canvas.addEventListener('pointerdown', () => el.remove(), { once: true });
  const t0 = performance.now();
  const timer = window.setInterval(() => {
    if (!el.isConnected) { clearInterval(timer); return; }
    if (performance.now() - t0 > 12000 || (performance.now() - t0 > 1500 && moveDir(rt?.wv.yaw ?? 0))) { el.remove(); clearInterval(timer); }
  }, 300);
  ctx.root.querySelector('[data-screen="explore"]')?.appendChild(el) ?? ctx.root.appendChild(el);
}
let miniT = 0;
function drawMini(ctx: AppCtx) {
  if (rt) { const f = ctx.root.querySelector('#xfps'); if (f) f.textContent = `${Math.round(rt.wv.fps)}fps · 画质${['高', '高', '中', '低', '最低'][rt.wv.level]}`; }
  const cv = ctx.root.querySelector('#xmini') as HTMLCanvasElement | null;
  if (!cv || !rt) return;
  const g = cv.getContext('2d')!, W = cv.width, k = W / (rt.st.half * 2);
  const X = (x: number) => (x + rt!.st.half) * k, Z = (z: number) => (z + rt!.st.half) * k;
  g.clearRect(0, 0, W, W);
  g.fillStyle = '#1a1230'; g.fillRect(0, 0, W, W);
  g.fillStyle = '#3a2a5a'; g.fillRect(0, Z(-4.5), W, 9 * k); g.fillRect(X(-4.5), 0, 9 * k, W); // 路
  g.fillStyle = '#0b0818'; for (const c of rt.st.colliders) if (c.x1 - c.x0 > 3) g.fillRect(X(c.x0), Z(c.z0), (c.x1 - c.x0) * k, (c.z1 - c.z0) * k); // 楼
  const sn = rt.ex.snapshot();
  const dot = (x: number, z: number, col: string, r: number) => { g.fillStyle = col; g.beginPath(); g.arc(X(x), Z(z), r, 0, Math.PI * 2); g.fill(); };
  for (const e of sn.ents) dot(e.x, e.z, e.kind === 'boss' ? '#ff4a6a' : e.kind === 'enemy' ? '#ff9a4a' : e.kind === 'chest' ? '#ffe27a' : e.kind === 'herb' ? '#6affb0' : e.kind === 'poi' ? '#ffb04a' : '#7ff0ff', e.kind === 'boss' ? 6 : 4);
  dot(sn.leader.x, sn.leader.z, '#ffffff', 5);
  g.strokeStyle = '#7ff0ff'; g.lineWidth = 2; g.beginPath(); g.moveTo(X(sn.leader.x), Z(sn.leader.z)); g.lineTo(X(sn.leader.x) + Math.sin(sn.leader.yaw) * 12, Z(sn.leader.z) + Math.cos(sn.leader.yaw) * 12); g.stroke();
}
export function refreshExploreHud(ctx: AppCtx) {
  const el = ctx.root.querySelector('#xui') as HTMLElement | null;
  if (el) el.innerHTML = hud(ctx);
}

/** 搭一个关卡（首次进入 / 通关换章节时调用；旧场景拆掉） */
function loadLevel(ctx: AppCtx, L: LevelDef) {
  if (!rt) return;
  if (rt.ex) { rt.ex.dispose(); rt.wv.scene.remove(rt.st.group); }
  const st = buildStreet(L);
  rt.wv.scene.add(st.group);
  rt.wv.setMood(L.mood);
  rt.wv.setRain(L.weather !== 'none');
  const wv = rt.wv;
  const ex = new Explorer(wv, st, teamIds(ctx), {
    encounter: (s) => onEncounter(ctx, s),
    chest: (s) => onChest(ctx, s),
    talk: (s) => onTalk(ctx, s),
    alert: () => alertSfx(),
    near: (sp) => showFight(sp),
    poi: (sp) => onPoi(ctx, sp),
  });
  let stepT = 0;
  wv.onUpdate = (dt) => {
    const d = moveDir(wv.yaw);
    if (d && autoOn) { autoOn = false; refreshExploreHud(ctx); }
    if (d) ex.push(d[0], d[1], dt);
    else if (autoOn && ex.idle && (autoT -= dt) <= 0) {
      autoT = 0.6;
      if (nearSp && nearSp.kind === 'enemy' && ex.engage()) return;
      const lp = ex.leaderPos;
      const nowMs = Date.now();
      for (const [k, until] of autoSkip) if (until < nowMs) autoSkip.delete(k);
      const t = pickAutoTarget({ x: lp.x, z: lp.z }, ex.snapshot().ents, killsLeft(ctx.s), new Set(autoSkip.keys()));
      if (t) {
        // 连续几次空闲时目标还是同一个，说明路走不通（被挡 / 到不了）：封 2 分钟换下一个，免得原地空转
        const key = autoKey(t);
        autoLast = autoLast.key === key ? { key, tries: autoLast.tries + 1 } : { key, tries: 1 };
        if (autoLast.tries >= 4) { autoSkip.set(key, nowMs + 120_000); autoLast = { key: '', tries: 0 }; }
        else ex.moveTo(t.x, t.z);
      }
      else { autoOn = false; refreshExploreHud(ctx); }
    }
    ex.update(dt); st.update(wv.time, dt);
    if (ex.moving) { stepT -= dt; if (stepT <= 0) { stepSfx(); stepT = 0.26; } } else stepT = 0;
  };
  showFight(null);
  rt.ex = ex; rt.st = st; rt.dead.clear();
  syncSpawns(ctx);
}

export async function enterExplore(ctx: AppCtx) {
  const scr = ctx.root.querySelector('[data-screen=explore]') as HTMLElement;
  const load = scr.querySelector('#xload') as HTMLElement;
  refreshExploreHud(ctx);
  if (failed) { load.innerHTML = '这台设备不支持 3D 探索<small>请换一个支持 WebGL 的浏览器</small>'; return; }
  if (!rt) {
    load.style.display = 'grid';
    await new Promise((r) => setTimeout(r, 60)); // 让「加载中」先画出来
    try {
      const canvas = scr.querySelector('#wcv') as HTMLCanvasElement;
      bindInput(scr);
      await preloadWorldTextures();
      const wv = new WorldView(canvas, defaultQuality());
      applyGfx(ctx, wv);
      rt = { wv, ex: undefined as unknown as Explorer, st: undefined as unknown as Street, dead: new Map(), running: false };
      loadLevel(ctx, explorerLevel(ctx.s));
      (window as unknown as { __xp?: Rt }).__xp = rt; // 调试 / 自动化测试用
    } catch (e) {
      failed = true;
      load.innerHTML = '这台设备不支持 3D 探索<small>请换一个支持 WebGL 的浏览器</small>';
      console.error(e);
      return;
    }
  }
  applyGfx(ctx, rt.wv);
  rt.wv.resize();
  if (rt.st.level.id !== explorerLevel(ctx.s).id) loadLevel(ctx, explorerLevel(ctx.s)); else syncSpawns(ctx);
  rt.ex.setTeam(teamIds(ctx));
  rt.wv.snapCamera();
  rt.wv.start();
  rt.running = true;
  rainAmbience(true);
  showHelpOnce(ctx);
  clearInterval(miniT);
  miniT = window.setInterval(() => drawMini(ctx), 250);
  setTimeout(() => { load.style.display = 'none'; }, 250);
}
export function leaveExplore() { showFight(null); autoOn = false; autoSkip.clear(); autoLast = { key: '', tries: 0 }; rainAmbience(false); clearInterval(miniT); if (rt?.running) { rt.wv.stop(); rt.running = false; } }
export function resizeExplore() { rt?.wv.resize(); }

// ---------- 玩法 ----------
function advance(ctx: AppCtx, chapter: number, index: number) {
  const s = ctx.s;
  s.stage.chapter = chapter; s.stage.index = index; s.stage.wins = 0;
  s.best = { chapter, index };
}

async function onEncounter(ctx: AppCtx, sp: Spawn): Promise<boolean> {
  if (!rt || busyFight) return false;
  busyFight = true;
  const backdrop = rt.wv.backdrop();
  rt.wv.stop();
  rainAmbience(false);
  const s = ctx.s;
  try {
    const isBoss = sp.kind === 'boss';
    const t = isBoss ? bossStage(s) : { ...farmStage(s), fresh: false };
    const stage = t.stage;
    if (isBoss && t.fresh) await playStoryOnce(ctx, stage.storyId);
    const res = await arenaFight(ctx.root, s, stage, t.chapter, s.settings.speed || 2, isBoss ? '👑' : '⚔️', backdrop);
    rollover(s, Date.now());
    if (res.win) {
      track(s, 'clear_stage');
      if (isBoss) {
        const g = winReward(stage);
        applyGain(s, g);
        let fg = null as ReturnType<typeof firstClearReward> | null;
        recordBossWin(s);
        if (t.fresh) { advance(ctx, t.chapter, t.index); fg = firstClearReward(stage); applyGain(s, fg); track(s, 'reach_stage', (t.chapter - 1) * 24 + t.index); await playStoryOnce(ctx, stage.storyPostId); }
        ctx.result({ win: true, banner: t.fresh ? '🎉' : '⚔️✨', title: `${stage.id} ${stage.name}`, gain: { fish: g.fish + (fg?.fish ?? 0), exp: g.exp + (fg?.exp ?? 0), bells: fg?.bells ?? 0, catnip: fg?.catnip ?? 0 } });
        rt.dead.set(sp.id, 0);
        if (t.fresh) { ctx.loop.restart(); if (rt.st.level.id !== explorerLevel(s).id) { loadLevel(ctx, explorerLevel(s)); popReward(ctx, '🗺️✨', {}); } else syncSpawns(ctx); }
      } else {
        const g = killReward(s, stage);
        if (g) { applyGain(s, g); popReward(ctx, '⚔️✨', g); }
        else popReward(ctx, '⚔️🔒', {});
        rt.dead.set(sp.id, Date.now() + 90_000);
      }
      sfx.ok();
    } else {
      if (autoOn) autoOn = false;
      ctx.result({ win: false, title: `${stage.id} ${stage.name}`, power: { mine: teamPower(s), rec: recommendedPowerOf(t.chapter, t.index) } });
    }
    ctx.save();
    refreshExploreHud(ctx);
    return res.win;
  } finally {
    busyFight = false;
    rt.wv.start();
    rainAmbience(true);
  }
}

/** 玩法入口：按 spawn.game 分发到各个小游戏；自动探索中不打扰（路过不会弹出来） */
async function onPoi(ctx: AppCtx, sp: Spawn): Promise<void> {
  if (autoOn) return;
  const host = ctx.root.querySelector('[data-screen="explore"]');
  if (!host) return;
  const open = sp.data === 'fish' ? openFishing : sp.data === 'ramen' ? openRamen : sp.data === 'boxcat' ? openBoxCat : sp.data === 'mushroom' ? openMushroom : sp.data === 'windchime' ? openWindChime : sp.data === 'lanterns' ? openLanterns : null;
  if (open) {
    // 小游戏开着时世界本来就是暂停的：把 3D 渲染也停掉（画面定格在背后）。不停的话，慢设备上每帧渲染会拖慢计时器和点击，节奏类玩法会漏拍，也白白耗电。
    // HUD 也藏起来：它带 backdrop-filter 模糊，盖在定格的 WebGL 画面上每帧都要重新合成，低端机很吃力
    rainAmbience(false); rt?.wv.stop(); host.classList.add('mg');
    try { await open(ctx, host); } finally { host.classList.remove('mg'); rt?.wv.start(); rainAmbience(true); refreshExploreHud(ctx); }
  }
}
function onChest(ctx: AppCtx, sp: Spawn) {
  const g = sp.kind === 'herb' ? pickHerb(ctx.s, sp.id) : openChest(ctx.s, sp.id);
  if (!g) return;
  applyGain(ctx.s, g);
  ctx.save();
  sfx.ok();
  popReward(ctx, sp.kind === 'herb' ? '🌿' : '📦', g);
  refreshExploreHud(ctx);
}
function onTalk(ctx: AppCtx, _sp: Spawn) {
  const g = claimDaily(ctx.s);
  if (g) { applyGain(ctx.s, g); ctx.save(); sfx.up(); refreshExploreHud(ctx); popReward(ctx, '📜🎁', g); return; }
  // 没有奖励可领：头顶弹出还差的委托（图标 + 进度），都做完了就弹个笑脸
  const left = dailyProgress(ctx.s).filter((x) => !x.done);
  const host = ctx.root.querySelector('[data-screen="explore"]');
  if (!host) return;
  host.querySelectorAll('.xpop').forEach((x) => x.remove());
  const el = document.createElement('div');
  el.className = 'xpop';
  el.innerHTML = `<span class="xpop-t">${dailyClaimed(ctx.s) || !left.length ? '😺' : '📜'}</span>${left.length && !dailyClaimed(ctx.s) ? `<span class="gains">${left.map((x) => `<span class="gi">${STAT_ICON[x.key]}<b>${x.have}/${x.need}</b></span>`).join('')}</span>` : ''}`;
  host.appendChild(el);
  setTimeout(() => el.remove(), 1600);
}

/** 探索足迹：长期累计目标，够数后手动领奖 */
const SCENE_EMOJI = ['', '🌃', '🏮', '🌊', '🌲', '☁️', '🏯'];
const GAME_EMOJI: Record<string, string> = { boxcat: '📦', ramen: '🍜', fish: '🎣', mushroom: '🍄', windchime: '🎐', lanterns: '🏮' };
const GAME_NAME: Record<string, string> = { boxcat: '纸箱寻猫', ramen: '拉面屋台', fish: '钓鱼', mushroom: '采蘑菇', windchime: '风铃节拍', lanterns: '点灯谜题' };
/** 一键切换场景：6 个场景一屏看完，已解锁的点一下就过去；各场景有各自的小游戏 */
function openScenes(ctx: AppCtx) {
  ctx.root.querySelectorAll('.scene-mask').forEach((e) => e.remove());
  const cur = sceneChapter(ctx.s), open = new Set(unlockedScenes(ctx.s));
  const cards = Object.keys(LEVELS).map(Number).map((c) => {
    const g = sceneGame(c), un = open.has(c);
    return `<button class="scn ${c === cur ? 'on' : ''} ${un ? '' : 'lock'}" data-act="x-scene" data-c="${c}" ${un ? '' : 'disabled'}>
      <span class="se">${SCENE_EMOJI[c] ?? '🗺️'}</span><b>${esc(LEVELS[c].name)}</b>
      <small>${un ? (g ? `${GAME_EMOJI[g] ?? '🎮'} ${GAME_NAME[g] ?? g}` : '') : `🔒 通关第 ${c - 1} 章解锁`}</small>${c === cur ? '<i class="here">当前</i>' : ''}</button>`;
  }).join('');
  ctx.root.insertAdjacentHTML('beforeend', `<div class="mask center scene-mask" data-act="closedialog"><div class="dialog scn-dlg"><h3 class="title" style="margin:0 0 8px;text-align:center">🗺️ 切换场景</h3><div class="scn-grid">${cards}</div></div></div>`);
}

function openTrail(ctx: AppCtx) {
  ctx.root.querySelectorAll('.trail-mask').forEach((e) => e.remove());
  const rows = trailRows(ctx.s);
  const html = rows.map((r) => `<div class="tr-row ${r.claimed ? 'done' : ''}"><span class="tr-i">${STAT_ICON[r.stat]}</span><div class="tr-m"><div class="tr-bar"><i style="width:${Math.round((r.have / r.need) * 100)}%"></i><b>${r.have}/${r.need}</b></div>${gainIcons(r.reward, 16)}</div>${r.claimed ? `<span class="tr-ok">${icon('check', 24)}</span>` : r.ready ? `<button class="btn sm green" data-act="x-claim" data-id="${r.id}">${icon('gift', 22)}</button>` : `<span class="tr-lock">${icon('lock', 20)}</span>`}</div>`).join('');
  ctx.root.insertAdjacentHTML('beforeend', `<div class="mask center trail-mask" data-act="closedialog"><div class="dialog" style="max-height:78%;overflow:auto"><div style="text-align:center;margin-bottom:6px">${icon('trophy', 34)}</div>${html}<div style="text-align:center;margin-top:10px"><button class="btn" data-act="closedialog">${icon('check', 22)}</button></div></div></div>`);
}

export function handleExplore(ctx: AppCtx, act: string, el: HTMLElement): boolean {
  switch (act) {
    case 'x-fight': if (rt) rt.ex.engage(); return true;
    case 'x-boss': if (rt) { rt.ex.moveTo(rt.st.level.bossSpot[0], rt.st.level.bossSpot[1] + 5); } return true;
    case 'x-auto': autoOn = !autoOn; autoT = 0; autoSkip.clear(); autoLast = { key: '', tries: 0 }; refreshExploreHud(ctx); return true;
    case 'x-trail': openTrail(ctx); return true;
    case 'x-scenes': openScenes(ctx); return true;
    case 'x-scene': {
      const c = +(el.dataset.c ?? 0);
      ctx.root.querySelectorAll('.scene-mask').forEach((m) => m.remove());
      if (c !== sceneChapter(ctx.s) && setScene(ctx.s, c)) { ctx.save(); if (rt) { loadLevel(ctx, explorerLevel(ctx.s)); rt.wv.snapCamera(); } refreshExploreHud(ctx); sfx.ok(); }
      return true;
    }
    case 'x-claim': {
      const g = claimTrail(ctx.s, el.dataset.id!);
      if (g) { applyGain(ctx.s, g); ctx.save(); sfx.up(); popReward(ctx, '🏆🎁', g); refreshExploreHud(ctx); openTrail(ctx); }
      return true;
    }
    case 'x-reset': if (rt) { rt.ex.setTeam(teamIds(ctx)); rt.wv.snapCamera(); } return true;
    case 'x-hero': ctx.openHero(el.dataset.id!); return true;
    default: return false;
  }
}
