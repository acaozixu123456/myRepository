// 《猫国志》应用入口：外壳、导航、存档、三个核心界面（主城 / 阵容 / 招募）。
import { KIT_CSS } from '../ui/kitcss';
import { icon } from '../ui/icons';
import { SCREEN_CSS } from './screenscss';
import { STORY_CSS, playStoryOnce } from './story';
import { sfx, sfxState } from './sfx';
import { CAMPAIGN_CSS, campaignHtml, handleCampaign } from './screens/campaign';
import { BattleLoop } from './battleLoop';
import type { AppCtx, ScreenId } from './ctx';
import { claim, floaty, homeHtml, updateHome, updateIdle } from './screens/home';
import { lineupHtml, lineupState } from './screens/lineup';
import { gachaHtml, gachaState, doPull, ratesDialog } from './screens/gacha';
import { closeSheet, handleDetail, openHeroSheet } from './screens/detail';
import { applyGain, idleCapHours, tickIdle } from '../game/stage';
import { autoLineup, equip, levelUp, load, save, swapSlots, unequip } from '../game/state';
import { POOLS } from '../game/gacha';
import { fmt } from '../ui/components';

const style = document.createElement('style');
style.textContent = KIT_CSS + SCREEN_CSS + STORY_CSS + CAMPAIGN_CSS;
document.head.appendChild(style);

const storage = (() => { try { return window.localStorage; } catch { return null; } })();
const state = load(storage);
const awayMin = (Date.now() - state.idle.last) / 60000;
sfxState.on = state.settings.sound !== false;
const params = new URLSearchParams(location.search);
const at = params.get('at');
if (at) { const [c, i] = at.split('-').map(Number); state.stage = { chapter: c, index: i, wins: 0 }; state.best = { chapter: c, index: i }; }
if (params.get('pity')) { state.pity.ur = 79; state.pity.ssr = 9; }
if (params.get('rich')) { state.res.bells = 99999; state.res.tickets = 99; state.res.fish = 99999; state.res.catnip = 999; state.res.exp = 500000; }

const app = document.getElementById('app')!;
app.innerHTML = `<div class="app" id="root">
  ${homeHtml()}
  <div class="screen" data-screen="lineup"></div>
  <div class="screen gacha" data-screen="gacha"></div>
  <div class="screen" data-screen="campaign"></div>
  <div class="screen" data-screen="bag"><div class="hud"><div class="title" style="color:#fff6dc">背包</div></div><div class="scroll"><div class="panel empty">装备与道具背包正在建设中。</div></div></div>
  <nav class="nav" id="nav">
    <button data-act="nav" data-to="home" class="on">${icon('home', 30)}主城</button>
    <button data-act="nav" data-to="lineup">${icon('team', 30)}阵容</button>
    <button data-act="nav" data-to="gacha">${icon('recruit', 30)}招募</button>
    <button data-act="nav" data-to="campaign">${icon('campaign', 30)}征战</button>
    <button data-act="nav" data-to="bag">${icon('bag', 30)}背包</button>
  </nav></div>`;
const root = document.getElementById('root')!;

const ctx: AppCtx = {
  s: state,
  root,
  loop: undefined as unknown as BattleLoop,
  screen: 'home',
  save: () => save(storage, state),
  toast(msg) {
    root.querySelectorAll('.toast').forEach((e) => e.remove());
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    root.appendChild(t);
    setTimeout(() => t.remove(), 1950);
  },
  go(screen: ScreenId) {
    ctx.screen = screen;
    root.querySelectorAll('.screen').forEach((e) => e.classList.toggle('on', (e as HTMLElement).dataset.screen === screen));
    root.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.to === screen));
    if (screen === 'home') ctx.loop.resume();
    else ctx.loop.pause();
    ctx.refresh();
  },
  openHero: (id) => openHeroSheet(ctx, id),
  refresh() {
    const scr = ctx.screen;
    if (scr === 'home') updateHome(ctx);
    else if (scr === 'lineup') (root.querySelector('[data-screen=lineup]') as HTMLElement).innerHTML = lineupHtml(ctx);
    else if (scr === 'gacha') (root.querySelector('[data-screen=gacha]') as HTMLElement).innerHTML = gachaHtml(ctx);
    else if (scr === 'campaign') (root.querySelector('[data-screen=campaign]') as HTMLElement).innerHTML = campaignHtml(ctx);
  },
};

ctx.loop = new BattleLoop(document.getElementById('cv') as HTMLCanvasElement, {
  state: () => state,
  story: (id) => (params.get('nostory') ? Promise.resolve() : playStoryOnce(ctx, id)),
  onReward(g, kind) {
    if (kind === 'win') floaty(ctx, `+${fmt(g.fish)}`, 'fish', 50, 30);
    else if (g.bells || g.fish) {
      sfx.win();
      ctx.toast(`首通奖励：小鱼干 ${fmt(g.fish)}${g.bells ? ` · 金铃铛 ${g.bells}` : ''}`);
    }
  },
  onResult(win, stage, pushed) {
    if (pushed) ctx.toast(win ? `通关 ${stage.id}！` : `挑战 ${stage.id} 失败，战力不足，先去升级吧`);
  },
  onChange() {
    ctx.save();
    if (ctx.screen === 'home') updateHome(ctx);
  },
});
ctx.loop.setSpeed(state.settings.speed);

function openSettings() {
  root.querySelectorAll('.mask.center').forEach((m) => m.remove());
  const on = state.settings.sound !== false;
  root.insertAdjacentHTML('beforeend', `<div class="mask center" data-act="closedialog"><div class="dialog">
    <h3 class="title" style="margin:0 0 10px">设置</h3>
    <div class="row" style="margin:8px 0"><b class="grow">音效</b><button class="btn sm ${on ? 'green' : 'ghost'}" data-act="snd">${on ? '开' : '关'}</button></div>
    <div class="row" style="margin:8px 0"><b class="grow">战斗速度</b>${[1, 2, 3].map((v) => `<button class="btn sm ${state.settings.speed === v ? 'blue' : 'ghost'}" data-act="spd" data-v="${v}">${v}×</button>`).join('')}</div>
    <div class="row" style="margin:14px 0 4px"><b class="grow">清空存档<small class="muted" style="display:block;font-weight:700">从头开始，无法恢复</small></b><button class="btn sm ghost" data-act="reset1">清空</button></div>
    <div class="muted" style="font-size:11.5px;text-align:center;margin-top:10px;font-weight:700">猫国志 · 原型 v0.1</div>
    <div style="text-align:center;margin-top:10px"><button class="btn" data-act="closedialog">好的</button></div></div></div>`);
}

// ---------- 事件 ----------
root.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
  if (!el) return;
  const act = el.dataset.act!;
  if (act !== 'sheetmask' && act !== 'closedialog') sfx.tap();
  if (handleDetail(ctx, act, el)) return;
  if (handleCampaign(ctx, act, el)) return;
  switch (act) {
    case 'nav': ctx.go(el.dataset.to as ScreenId); break;
    case 'speed': { state.settings.speed = (state.settings.speed % 3) + 1; ctx.loop.setSpeed(state.settings.speed); ctx.save(); updateHome(ctx); break; }
    case 'claim': claim(ctx); break;
    case 'settings': openSettings(); break;
    case 'claim2': root.querySelectorAll('.mask.center').forEach((m) => m.remove()); claim(ctx); break;
    case 'snd': state.settings.sound = !(state.settings.sound !== false); sfxState.on = state.settings.sound; ctx.save(); openSettings(); sfx.ok(); break;
    case 'spd': state.settings.speed = Number(el.dataset.v); ctx.loop.setSpeed(state.settings.speed); ctx.save(); openSettings(); updateHome(ctx); break;
    case 'reset1': el.outerHTML = '<button class="btn pink" data-act="reset2">再点一次：清空存档</button>'; break;
    case 'reset2': try { storage?.removeItem('maoguozhi.save.v1'); } catch { /* 忽略 */ } location.reload(); break;
    case 'challenge': ctx.loop.challenge(); ctx.toast('向下一关出发！'); break;
    case 'gift': {
      const now = Date.now();
      if (now - state.gift.last < 300000) return;
      state.gift.last = now;
      state.res.bells += 1600;
      state.res.tickets += 5;
      ctx.save();
      ctx.toast('领到 1600 金铃铛、5 张招福符');
      updateHome(ctx);
      break;
    }
    case 'autolevel': {
      let n = 0;
      // 每次给等级最低的上阵猫升一级，资源不够或到上限就停
      const pool = state.lineup.filter((x): x is string => !!x);
      while (n < 60) {
        const order = pool.map((id) => state.heroes[id]).sort((x, y) => x.lv - y.lv);
        const target = order.find((h) => levelUp(state, h.id).ok);
        if (!target) break;
        n++;
      }
      ctx.toast(n ? `给阵容猫猫升了 ${n} 级` : '资源不够，升不动了');
      ctx.save();
      updateHome(ctx);
      break;
    }
    case 'hero': {
      if (lineupState.pickSlot !== null) {
        const r = equip(state, el.dataset.id!, lineupState.pickSlot);
        lineupState.pickSlot = null;
        if (!r.ok) ctx.toast(r.reason);
        ctx.save();
        ctx.loop.restart();
        ctx.refresh();
      } else openHeroSheet(ctx, el.dataset.id!);
      break;
    }
    case 'slot': {
      const i = +el.dataset.i!;
      const id = state.lineup[i];
      if (id) {
        if (lineupState.pickSlot !== null && lineupState.pickSlot !== i) { swapSlots(state, lineupState.pickSlot, i); lineupState.pickSlot = null; ctx.save(); ctx.loop.restart(); ctx.refresh(); }
        else openHeroSheet(ctx, id);
      } else {
        lineupState.pickSlot = lineupState.pickSlot === i ? null : i;
        ctx.refresh();
      }
      break;
    }
    case 'lf': lineupState.faction = el.dataset.f as never; ctx.refresh(); break;
    case 'autolineup': autoLineup(state); ctx.save(); ctx.loop.restart(); ctx.toast('已按战力排好阵容'); ctx.refresh(); break;
    case 'pool': gachaState.pool = el.dataset.id!; ctx.refresh(); break;
    case 'pull1': void doPull(ctx, 1); break;
    case 'pull10': void doPull(ctx, 10); break;
    case 'rates': ratesDialog(ctx); break;
    case 'closedialog': if ((e.target as HTMLElement) === el || el.tagName === 'BUTTON') root.querySelectorAll('.mask.center').forEach((m) => m.remove()); break;
    case 'sheetmask': if (e.target === el) closeSheet(ctx); break;
  }
  void unequip; void POOLS; void applyGain;
});

// 每秒刷新挂机收益
setInterval(() => { if (ctx.screen === 'home') { updateIdle(ctx); const g = root.querySelector('#giftBtn') as HTMLButtonElement; if (g && g.disabled) updateHome(ctx); } }, 1000);
setInterval(() => ctx.save(), 8000);
document.addEventListener('visibilitychange', () => { if (document.hidden) ctx.save(); });

updateHome(ctx);
// 离线归来：挂机收益已在存档里累积，弹窗告知并一键领取
{
  if (awayMin >= 5 && !params.get('nostory')) {
    tickIdle(state);
    const hrs = Math.min(awayMin, idleCapHours(state) * 60) / 60;
    root.insertAdjacentHTML('beforeend', `<div class="mask center" data-act="closedialog"><div class="dialog" style="text-align:center">
      <h3 class="title" style="margin:0 0 6px">欢迎回来！</h3>
      <p class="muted" style="margin:0 0 10px;font-weight:700">猫猫们替你守了 ${hrs.toFixed(1)} 小时</p>
      <div class="row" style="justify-content:center;gap:18px;font-family:var(--f-d);font-size:22px">${icon('fish', 30)}<b class="num">${fmt(state.idle.fish)}</b>${icon('spark', 30)}<b class="num">${fmt(state.idle.exp)}</b></div>
      <div style="margin-top:14px"><button class="btn lg" data-act="claim2">收下</button></div></div></div>`);
  }
}
ctx.loop.start();
if (!params.get('nostory')) void playStoryOnce(ctx, 'c1_open');
(window as unknown as Record<string, unknown>).__app = ctx;
