import { CHAPTERS } from '../../content/campaign';
import { FACTIONS } from '../../data/factions';
import { HERO_BY_ID } from '../../data/heroes';
import { artUrl } from '../../ui/art';
import { chip, fmt } from '../../ui/components';
import { icon } from '../../ui/icons';
import { EXP_PER_LEVEL, claimIdle, getStage, idleCapHours, idleRate, tickIdle } from '../../game/stage';
import { teamPower } from '../../game/state';
import type { AppCtx } from '../ctx';

export function homeHtml(): string {
  return `
  <div class="screen home on" data-screen="home">
    <div class="hud" id="hud"></div>
    <div class="stagebar" id="stagebar"></div>
    <div class="arena"><canvas id="cv"></canvas><div class="stagebadge" id="badge"></div><div class="tools"><button data-act="speed" id="speedBtn">2×</button></div><div class="rule" id="rule"></div></div>
    <div class="teamstrip" id="team" data-act="nav" data-to="lineup"></div>
    <div class="idle panel" id="idle"></div>
    <div class="actions">
      <button class="btn green" data-act="challenge" id="chBtn">挑战下一关</button>
      <button class="btn blue" data-act="autolevel">一键升级</button>
      <button class="btn pink" data-act="gift" id="giftBtn">每日福利</button>
    </div>
    <div class="tip" id="tip"></div>
  </div>`;
}

const $ = (ctx: AppCtx, sel: string) => ctx.root.querySelector(sel) as HTMLElement;

export function updateHud(ctx: AppCtx) {
  const s = ctx.s;
  const need = EXP_PER_LEVEL(s.level);
  $(ctx, '#hud').innerHTML = `
    <div class="avatar">${icon('team', 32)}</div>
    <div class="who"><b>${s.name} · Lv.${s.level}</b><div class="xp"><i style="width:${Math.min(100, (s.exp / need) * 100)}%"></i></div></div>
    ${chip('fish', s.res.fish)}${chip('bells', s.res.bells, `<button class="plus" data-act="nav" data-to="gacha">${icon('plus', 20)}</button>`)}`;
}

export function updateHome(ctx: AppCtx) {
  const s = ctx.s;
  updateHud(ctx);
  const st = getStage(s.stage.chapter, s.stage.index)!;
  const ch = CHAPTERS[s.stage.chapter - 1];
  const power = teamPower(s);
  const low = power < st.recommendedPower * 0.9;
  const kind = st.kind === 'boss' ? '首领' : st.kind === 'elite' ? '精英' : '';
  $(ctx, '#stagebar').innerHTML = `
    <span class="tag f" style="--c:${FACTIONS[ch.focusFactions[0]].color}">${FACTIONS[ch.focusFactions[0]].glyph}</span>
    <div class="nm">第 ${s.stage.chapter} 章 · ${ch.name}<small>${st.id} ${st.name}${kind ? ' · ' + kind : ''}</small></div>
    <div class="pw ${low ? 'low' : ''}">战力<br><b class="num">${fmt(power)}</b> / ${fmt(st.recommendedPower)}</div>`;
  $(ctx, '#badge').textContent = `${st.id} 连战 ${s.stage.wins}`;
  $(ctx, '#rule').textContent = st.rule ?? '';
  $(ctx, '#speedBtn').textContent = `${s.settings.speed}×`;
  $(ctx, '#tip').textContent = low ? '战力不足推荐值，去阵容里给猫猫升级升星吧' : '战力足够，可以挑战下一关啦';
  ($(ctx, '#chBtn') as HTMLButtonElement).textContent = '挑战下一关';
  $(ctx, '#team').innerHTML = s.lineup.map((id) => {
    const h = id ? HERO_BY_ID[id] : null;
    const st = id ? s.heroes[id] : null;
    return h && st
      ? `<div class="m ${h.rarity.toLowerCase()}"><img src="${artUrl(h.id, 'head')}" alt="${h.name}" draggable="false"><em>Lv.${st.lv}</em></div>`
      : `<div class="m empty">${icon('plus', 18)}</div>`;
  }).join('') + `<span class="go">阵容 ›</span>`;
  updateIdle(ctx);
  const now = Date.now();
  const left = Math.max(0, 300000 - (now - s.gift.last));
  const g = $(ctx, '#giftBtn') as HTMLButtonElement;
  g.disabled = left > 0;
  g.innerHTML = left > 0 ? `每日福利<small>${Math.ceil(left / 1000)} 秒后可领</small>` : `每日福利<small>+铃铛 +招福符</small>`;
}

export function updateIdle(ctx: AppCtx) {
  const s = ctx.s;
  tickIdle(s);
  const r = idleRate(s);
  const cap = idleCapHours(s) * 60;
  const pct = Math.min(100, (s.idle.fish / Math.max(1, r.fish * cap)) * 100);
  $(ctx, '#idle').innerHTML = `
    <div class="figs">
      <div class="big"><span>${icon('fish', 26)}<b class="num">${fmt(s.idle.fish)}</b></span><span>${icon('catnip', 26)}<b class="num">${s.idle.catnip.toFixed(1)}</b></span></div>
      <div class="bar" style="margin-top:6px"><i style="width:${pct}%"></i></div>
      <div class="sub">挂机收益 ${fmt(r.fish)}小鱼干/分钟 · 上限 ${idleCapHours(s)} 小时</div>
    </div>
    <button class="btn lg" data-act="claim">领取</button>`;
}

export function claim(ctx: AppCtx) {
  const got = claimIdle(ctx.s);
  if (got.fish < 1) return ctx.toast('还没攒下收益，再等等');
  ctx.save();
  floaty(ctx, `+${fmt(got.fish)}`, 'fish');
  ctx.toast(`领取了 ${fmt(got.fish)} 小鱼干、${got.catnip.toFixed(1)} 猫薄荷`);
  updateHome(ctx);
}

export function floaty(ctx: AppCtx, text: string, ic: string, x = 50, y = 38) {
  const el = document.createElement('div');
  el.className = 'floaty';
  el.style.left = `${x}%`;
  el.style.top = `${y}%`;
  el.innerHTML = `${icon(ic, 22)}${text}`;
  ctx.root.appendChild(el);
  setTimeout(() => el.remove(), 1300);
}

export function heroNames(ids: (string | null)[]) {
  return ids.filter(Boolean).map((i) => HERO_BY_ID[i!].name).join('、');
}
