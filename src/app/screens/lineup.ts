import { CHAPTERS } from '../../content/campaign';
import { FACTIONS, FACTION_ORDER } from '../../data/factions';
import type { FactionId } from '../../data/factions';
import { HERO_BY_ID } from '../../data/heroes';
import { BONDS, COUNTER_RING } from '../../data/systems';
import { MOB_BY_ID } from '../../data/units';
import { getStage } from '../../game/stage';
import { RARITY_ORDER, heroPower, teamPower } from '../../game/state';
import { artImg } from '../../ui/art';
import { chip, fmt, heroCard, stars } from '../../ui/components';
import { icon } from '../../ui/icons';
import type { AppCtx } from '../ctx';

export const lineupState = { faction: 'all' as FactionId | 'all', pickSlot: null as number | null };

export function topbar(ctx: AppCtx, title: string, right = ''): string {
  return `<div class="hud"><div class="title" style="color:#fff6dc;text-shadow:0 2px 0 rgba(0,0,0,.3)">${title}</div><div class="grow"></div>${right}${chip('fish', ctx.s.res.fish)}${chip('bells', ctx.s.res.bells)}</div>`;
}

function enemyMainFaction(ctx: AppCtx): FactionId | null {
  const st = getStage(ctx.s.stage.chapter, ctx.s.stage.index);
  if (!st) return null;
  const cnt: Partial<Record<FactionId, number>> = {};
  for (const w of st.waves) for (const e of w.enemies) {
    const f = HERO_BY_ID[e.unit]?.faction ?? MOB_BY_ID[e.unit]?.faction;
    if (f) cnt[f] = (cnt[f] ?? 0) + 1;
  }
  const top = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
  return (top?.[0] as FactionId) ?? null;
}

function slotHtml(ctx: AppCtx, i: number) {
  const id = ctx.s.lineup[i];
  const pick = lineupState.pickSlot === i;
  if (!id) return `<button class="slot empty" data-act="slot" data-i="${i}" style="${pick ? 'box-shadow:0 0 0 4px #fff,0 0 18px 4px #ffe08a' : ''}">${icon('plus', 34)}</button>`;
  const h = HERO_BY_ID[id];
  const st = ctx.s.heroes[id];
  return `<button class="slot" data-act="slot" data-i="${i}" style="--c:${FACTIONS[h.faction].color};--rc:var(--r-${h.rarity.toLowerCase()})">
    <div class="mini"><div class="portrait">${artImg(id, 'card')}</div><div class="t"><b>${h.name}</b>Lv.${st.lv}<br>${stars(st.star, 5, 9)}</div></div></button>`;
}

export function lineupHtml(ctx: AppCtx): string {
  const s = ctx.s;
  const owned = Object.values(s.heroes);
  const filter = lineupState.faction;
  const list = owned
    .filter((h) => filter === 'all' || HERO_BY_ID[h.id].faction === filter)
    .sort((a, b) => Number(s.lineup.includes(b.id)) - Number(s.lineup.includes(a.id)) || RARITY_ORDER[HERO_BY_ID[a.id].rarity] - RARITY_ORDER[HERO_BY_ID[b.id].rarity] || heroPower(b) - heroPower(a));

  // 阵营与羁绊
  const cnt: Partial<Record<FactionId, number>> = {};
  for (const id of s.lineup) if (id) cnt[HERO_BY_ID[id].faction] = (cnt[HERO_BY_ID[id].faction] ?? 0) + 1;
  const facChips = FACTION_ORDER.filter((f) => cnt[f]).map((f) => {
    const n = cnt[f]!;
    const eff = n >= 5 ? '+15%' : n >= 3 ? '+8%' : n >= 2 ? FACTIONS[f].mechanic : '';
    return `<span class="s ${n >= 2 ? 'on' : 'off'}" style="--c:${FACTIONS[f].color}"><span class="g">${FACTIONS[f].glyph}</span>×${n}${eff ? ' ' + eff : ''}</span>`;
  }).join('');
  const bondChips = BONDS.map((b) => {
    const have = b.heroes.filter((h) => s.lineup.includes(h)).length;
    return { b, have };
  }).filter((x) => x.have > 0).sort((a, b) => b.have / b.b.heroes.length - a.have / a.b.heroes.length).slice(0, 4).map(({ b, have }) => {
    const on = have === b.heroes.length;
    return `<span class="s ${on ? 'on' : 'off'}" title="${b.desc}">${icon('spark', 16)}${b.name} ${have}/${b.heroes.length}</span>`;
  }).join('');
  const ef = enemyMainFaction(ctx);
  const counter = ef ? COUNTER_RING[(COUNTER_RING.indexOf(ef) + 5) % 6] : null;
  const ch = CHAPTERS[s.stage.chapter - 1];

  return `
  ${topbar(ctx, '阵容')}
  <div class="scroll">
    <div class="row" style="margin-bottom:8px"><span class="pwr">${icon('sword', 20)}${fmt(teamPower(s))}<small>总战力</small></span><div class="grow"></div><button class="btn sm blue" data-act="autolineup">一键上阵</button></div>
    <div class="field"><div class="grid">
      <div class="col"><div class="lab">后排</div>${slotHtml(ctx, 3)}${slotHtml(ctx, 4)}</div>
      <div class="col"><div class="lab">前排</div>${slotHtml(ctx, 0)}${slotHtml(ctx, 1)}${slotHtml(ctx, 2)}</div>
    </div></div>
    <div class="panel" style="margin-top:12px"><h3>阵营与羁绊</h3><div class="syn">${facChips || '<span class="muted">先让猫猫上阵</span>'}${bondChips}</div>
      ${ef && counter ? `<div class="muted" style="font-size:12px;margin-top:8px;font-weight:700">本关（${ch.name}）敌方以 <span class="tag f" style="--c:${FACTIONS[ef].color}">${FACTIONS[ef].glyph}</span> 为主，<span class="tag f" style="--c:${FACTIONS[counter].color}">${FACTIONS[counter].glyph}</span> 阵营克制它（伤害 +7%）</div>` : ''}</div>
    <div class="row" style="margin:14px 2px 6px"><div class="title" style="font-size:18px">${lineupState.pickSlot !== null ? '选一只猫上阵' : '我的猫猫'} <span class="muted num" style="font-size:13px">${owned.length}/24</span></div></div>
    <div class="seg"><button class="pill" aria-pressed="${filter === 'all'}" data-act="lf" data-f="all">全部</button>${FACTION_ORDER.map((f) => `<button class="pill glyph" style="--c:${FACTIONS[f].color}" aria-pressed="${filter === f}" data-act="lf" data-f="${f}">${FACTIONS[f].glyph}</button>`).join('')}</div>
    <div class="roster">${list.length ? list.map((h) => heroCard(h.id, { state: h, act: 'hero', badge: s.lineup.includes(h.id) ? '上阵' : undefined })).join('') : '<div class="empty" style="grid-column:1/-1">这个阵营还没有猫猫，去招募看看吧</div>'}</div>
  </div>`;
}
