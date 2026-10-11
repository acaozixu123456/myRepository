// 探索：3D 赛博朋克街区。操控一队猫猫走动，碰到野怪 / 首领就开战（用现有战斗引擎），开宝箱、找向导。
// 世界渲染在 src/world，规则在 src/game/explore.ts，这里把两者和界面连起来。
import { Explorer } from '../../world/explore';
import type { Spawn } from '../../world/explore';
import { WorldView, defaultQuality } from '../../world/engine';
import { buildStreet } from '../../world/street';
import type { Street } from '../../world/street';
import type { LevelDef } from '../../world/levels';
import { bossStage, ensureExplore, explorerLevel, farmStage, gainText, killReward, openChest, spawnPlan } from '../../game/explore';
import { applyGain, firstClearReward, recommendedPowerOf, winReward } from '../../game/stage';
import { rollover, track } from '../../game/quests';
import { teamPower } from '../../game/state';
import { artUrl } from '../../ui/art';
import { fmt } from '../../ui/components';
import { HERO_BY_ID } from '../../data/heroes';
import { arenaFight } from '../arenaFight';
import type { AppCtx } from '../ctx';
import { sfx } from '../sfx';
import { topbar } from './lineup';
import { playStoryOnce } from '../story';

export const EXPLORE_CSS = `
.screen.xplore{background:#0d0818}
.xplore canvas#wcv{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}
.xplore .hud{position:absolute;left:0;right:0;top:0;z-index:3;pointer-events:none;background:linear-gradient(rgba(10,6,24,.85),rgba(10,6,24,0))}
.xplore .hud *{pointer-events:auto}
.xobj{position:absolute;left:10px;right:10px;top:58px;z-index:3;display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:14px;background:rgba(16,10,32,.72);border:2px solid rgba(255,110,210,.55);box-shadow:0 0 18px rgba(255,80,200,.25);color:#fff;backdrop-filter:blur(4px)}
.xobj b{display:block;font-family:var(--f-d);font-size:15px;letter-spacing:.04em;color:#ffe9a0}
.xobj small{display:block;font-size:11.5px;font-weight:700;color:#cfc6e8;margin-top:1px}
.xobj .btn{flex:none}
.xteam{position:absolute;left:10px;bottom:10px;z-index:3;display:flex;gap:6px}
.xteam button{width:50px;height:58px;border-radius:12px;background:rgba(16,10,32,.72);border:2px solid rgba(127,240,255,.55);padding:0;overflow:hidden;position:relative}
.xteam button.lead{border-color:#ffd24a;box-shadow:0 0 12px rgba(255,210,74,.6)}
.xteam img{width:100%;height:100%;object-fit:cover;object-position:50% 20%;display:block}
.xmini{position:absolute;right:10px;top:122px;z-index:3;width:92px;height:92px;border-radius:12px;border:2px solid rgba(127,240,255,.6);background:rgba(10,6,24,.7);box-shadow:0 0 12px rgba(127,240,255,.25)}
.xtools{position:absolute;right:10px;bottom:10px;z-index:3;display:flex;flex-direction:column;gap:8px}
.xtools .btn{min-width:64px}
.xload{position:absolute;inset:0;z-index:6;display:grid;place-items:center;background:#0d0818;color:#ffe9a0;font-family:var(--f-d);font-size:18px;text-align:center;line-height:1.8}
.xload small{display:block;font-size:12px;color:#9a8ec0;font-family:inherit}
.arena-ov{position:absolute;inset:0;z-index:30;background:radial-gradient(#1a1030,#05030c);display:flex;align-items:center;justify-content:center}
.arena-ov canvas{width:100%;aspect-ratio:960/600;display:block}
.arena-ov .skip{position:absolute;right:12px;top:calc(12px + env(safe-area-inset-top,0px));padding:7px 14px;border-radius:999px;background:rgba(0,0,0,.55);color:#fff;font-weight:800;border:2px solid rgba(255,255,255,.4)}
`;

export function exploreHtml(): string {
  return `<canvas id="wcv"></canvas><div class="xload" id="xload">霓虹街区加载中…<small>第一次进入要生成场景，请稍等</small></div><div id="xui"></div>`;
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
    const d = rt?.dead.get(p.id);
    if (d && now < d) return false;
    return true;
  });
}
function syncSpawns(ctx: AppCtx) {
  if (!rt) return;
  rt.ex.clearSpawns();
  for (const p of planFor(ctx)) rt.ex.addSpawn({ id: p.id, kind: p.kind, x: p.x, z: p.z, units: p.units, label: p.label, patrol: p.patrol, data: p.stageKey });
}

function teamIds(ctx: AppCtx): string[] {
  const ids = ctx.s.lineup.filter((x): x is string => !!x && !!ctx.s.heroes[x]);
  return ids.length ? ids.slice(0, 5) : Object.keys(ctx.s.heroes).slice(0, 5);
}

function hud(ctx: AppCtx): string {
  const b = bossStage(ctx.s), rec = recommendedPowerOf(b.chapter, b.index), mine = teamPower(ctx.s);
  const ids = teamIds(ctx);
  return `${topbar(ctx, '探索')}
  <div class="xobj"><div class="grow"><b>${b.fresh ? '目标 · ' : '重打 · '}${b.stage.id} ${b.stage.name}</b><small>首领在街区北端 · 战力 ${fmt(mine)} / 推荐 ${fmt(rec)}</small></div><button class="btn sm green" data-act="x-boss">前往</button></div>
  <div class="xteam">${ids.map((id, i) => `<button class="${i === 0 ? 'lead' : ''}" data-act="x-hero" data-id="${id}" title="${HERO_BY_ID[id]?.name ?? ''}"><img src="${artUrl(id, 'head')}" alt="" draggable="false"></button>`).join('')}</div>
  <canvas class="xmini" id="xmini" width="184" height="184"></canvas>
  <div class="xtools"><button class="btn sm blue" data-act="nav" data-to="lineup">阵容</button><button class="btn sm ghost" data-act="x-reset">回出生点</button></div>`;
}

let miniT = 0;
function drawMini(ctx: AppCtx) {
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
  for (const e of sn.ents) dot(e.x, e.z, e.kind === 'boss' ? '#ff4a6a' : e.kind === 'enemy' ? '#ff9a4a' : e.kind === 'chest' ? '#ffe27a' : '#7ff0ff', e.kind === 'boss' ? 6 : 4);
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
  const wv = rt.wv;
  const ex = new Explorer(wv, st, teamIds(ctx), {
    encounter: (s) => onEncounter(ctx, s),
    chest: (s) => onChest(ctx, s),
    talk: (s) => onTalk(ctx, s),
  });
  wv.onUpdate = (dt) => { ex.update(dt); st.update(wv.time, dt); };
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
      const wv = new WorldView(canvas, defaultQuality());
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
  rt.wv.resize();
  if (rt.st.level.id !== explorerLevel(ctx.s).id) loadLevel(ctx, explorerLevel(ctx.s)); else syncSpawns(ctx);
  rt.ex.setTeam(teamIds(ctx));
  rt.wv.snapCamera();
  rt.wv.start();
  rt.running = true;
  clearInterval(miniT);
  miniT = window.setInterval(() => drawMini(ctx), 250);
  setTimeout(() => { load.style.display = 'none'; }, 250);
}
export function leaveExplore() { clearInterval(miniT); if (rt?.running) { rt.wv.stop(); rt.running = false; } }
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
  rt.wv.stop();
  const s = ctx.s;
  try {
    const isBoss = sp.kind === 'boss';
    const t = isBoss ? bossStage(s) : { ...farmStage(s), fresh: false };
    const stage = t.stage;
    if (isBoss && t.fresh) await playStoryOnce(ctx, stage.storyId);
    const res = await arenaFight(ctx.root, s, stage, t.chapter, s.settings.speed || 2);
    rollover(s, Date.now());
    if (res.win) {
      track(s, 'clear_stage');
      if (isBoss) {
        const g = winReward(stage);
        applyGain(s, g);
        let fg = null as ReturnType<typeof firstClearReward> | null;
        if (t.fresh) { advance(ctx, t.chapter, t.index); fg = firstClearReward(stage); applyGain(s, fg); track(s, 'reach_stage', (t.chapter - 1) * 24 + t.index); await playStoryOnce(ctx, stage.storyPostId); }
        ctx.result({ win: true, banner: t.fresh ? '通关！' : '胜利', title: `${stage.id} ${stage.name}`, gain: { fish: g.fish + (fg?.fish ?? 0), exp: g.exp + (fg?.exp ?? 0), bells: fg?.bells ?? 0, catnip: fg?.catnip ?? 0 } });
        rt.dead.set(sp.id, 0);
        if (t.fresh) { ctx.loop.restart(); if (rt.st.level.id !== explorerLevel(s).id) { loadLevel(ctx, explorerLevel(s)); ctx.toast(`进入新区域：${rt.st.level.name}`); } else syncSpawns(ctx); }
      } else {
        const g = killReward(s, stage);
        if (g) { applyGain(s, g); ctx.toast(`击败了${sp.label}！${gainText(g)}`); }
        else ctx.toast('今天的探索奖励拿满啦，明天 5 点再来');
        rt.dead.set(sp.id, Date.now() + 90_000);
      }
      sfx.ok();
    } else {
      ctx.result({ win: false, title: `${stage.id} ${stage.name}`, hint: `我方战力 ${fmt(teamPower(s))}，推荐 ${fmt(recommendedPowerOf(t.chapter, t.index))}。去阵容升级猫猫再来吧。` });
    }
    ctx.save();
    refreshExploreHud(ctx);
    return res.win;
  } finally {
    busyFight = false;
    rt.wv.start();
  }
}

function onChest(ctx: AppCtx, sp: Spawn) {
  const g = openChest(ctx.s, sp.id);
  if (!g) return;
  applyGain(ctx.s, g);
  ctx.save();
  sfx.ok();
  ctx.toast(`宝箱：${gainText(g)}`);
  refreshExploreHud(ctx);
}
const TALKS = [
  '军师！北边那只首领一直在挡路，打赢它就能去下一个街区啦。',
  '路边的野猫巡逻得很勤快，打赢能拿小鱼干和经验——每天有上限哦。',
  '宝箱每天都会重新补货，四个角落都去看看。',
  '雨天的纸箱街最适合打盹……不过今天先打架。',
];
let talkI = 0;
function onTalk(ctx: AppCtx, _sp: Spawn) { ctx.toast(`嫦喵：${TALKS[talkI++ % TALKS.length]}`); }

export function handleExplore(ctx: AppCtx, act: string, el: HTMLElement): boolean {
  switch (act) {
    case 'x-boss': if (rt) { rt.ex.moveTo(rt.st.level.bossSpot[0], rt.st.level.bossSpot[1] + 5); ctx.toast('出发！'); } return true;
    case 'x-reset': if (rt) { rt.ex.setTeam(teamIds(ctx)); rt.wv.snapCamera(); } return true;
    case 'x-hero': ctx.openHero(el.dataset.id!); return true;
    default: return false;
  }
}
