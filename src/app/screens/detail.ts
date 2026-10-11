import { FACTIONS } from '../../data/factions';
import { HERO_BY_ID } from '../../data/heroes';
import { KITS } from '../../data/kits';
import { SKILLS } from '../../data/skills';
import { ROLES } from '../../data/systems';
import { EQUIPS, EQUIP_SLOTS } from '../../content/equipment';
import type { Quality } from '../../content/types';
import { MAX_STAR, starShards, heroLevelCap, heroPower, heroStats, isInLineup, levelUp, levelUpCost, setAwaken, skillUp, skillUpCost, starUp, equip, unequip } from '../../game/state';
import { artImg } from '../../ui/art';
import { esc, fmt, stars } from '../../ui/components';
import { ROLE_ICON, icon } from '../../ui/icons';
import type { AppCtx } from '../ctx';
import { sfx } from '../sfx';

function equipmentHtml(ctx: AppCtx, id: string): string {
  const colors: Record<Quality, string> = { common: 'var(--paper-line)', fine: 'var(--green)', rare: 'var(--r-sr)', epic: 'var(--r-ssr)', legend: 'var(--r-ur)' };
  const names = { weapon: '武器', armor: '铠甲', head: '头饰', charm: '铃铛' };
  const icons = { weapon: 'sword', armor: 'armor', head: 'helmet', charm: 'bell' };
  return `<div class="row" style="margin-top:14px"><h3 class="grow" style="margin:0;font-family:var(--f-d);font-weight:400;font-size:17px">装备</h3><button class="btn sm ghost bag-browse" data-act="bag-browse">打开背包</button></div>
    <div class="slots4">${EQUIP_SLOTS.map((slot) => {
      const instance = ctx.s.inventory.equipment.find((e) => e.heroId === id && EQUIPS.find((d) => d.id === e.equipId)?.slot === slot);
      const def = instance && EQUIPS.find((d) => d.id === instance.equipId);
      return def && instance
        ? `<button class="hcard bag-hero-slot" style="--rc:${colors[def.quality]}" data-act="bag-open" data-uid="${esc(instance.uid)}" aria-label="${esc(def.name)}">${icon(icons[slot], 28)}<b>${esc(def.name)}</b><small>Lv.${instance.level}</small></button>`
        : `<button class="hcard bag-hero-slot" style="--rc:var(--paper-line)" data-act="bag-browse" aria-label="选择${names[slot]}">${icon(icons[slot], 28)}<b>${names[slot]}</b><small>未穿戴</small></button>`;
    }).join('')}</div>`;
}

function skillsHtml(ctx: AppCtx, id: string): string {
  const h = ctx.s.heroes[id];
  const kit = KITS[id];
  if (!kit) {
    return (SKILLS[id] ?? []).map((k) => `<div class="skillrow"><span class="k ${k.kind}">${{ basic: '普攻', ultimate: '绝技', passive: '被动', awaken: '觉醒' }[k.kind]}</span><b>${esc(k.name)}</b><p>${esc(k.desc)}</p></div>`).join('');
  }
  const mods = (kit.ultimate.levelMods ?? []).map((m) => `<div class="mod ${h.skillLv >= m.lv ? 'on' : ''}"><span>Lv${m.lv}</span><span>${esc(m.desc)}</span></div>`).join('');
  return `
    <div class="skillrow"><span class="k">普攻</span><b>${esc(kit.basic.name)}</b><p>${esc(kit.basic.desc)}</p></div>
    <div class="skillrow"><span class="k ultimate">绝技 Lv.${h.skillLv}</span><b>${esc(kit.ultimate.name)}</b><p>${esc(kit.ultimate.desc)}</p><div class="mods" style="grid-column:2">${mods}</div></div>
    <div class="skillrow"><span class="k passive">被动</span><b>${esc(kit.passive.name)}</b><p>${esc(kit.passive.desc)}</p></div>`;
}

function awakenHtml(ctx: AppCtx, id: string): string {
  const h = ctx.s.heroes[id];
  const kit = KITS[id];
  if (!kit) return '';
  const locked = h.star < MAX_STAR;
  const btn = (b: 'A' | 'B') => `<button data-act="awaken" data-b="${b}" aria-pressed="${h.awaken === b}" ${locked ? 'disabled' : ''}><b>${b === 'A' ? '路线 A' : '路线 B'} · ${esc(kit.awaken[b].name)}</b>${esc(kit.awaken[b].desc)}</button>`;
  return `<h3 style="margin:14px 0 2px;font-family:var(--f-d);font-weight:400;font-size:17px">觉醒${locked ? ` <span class="tag">★5 解锁</span>` : ''}</h3><div class="awk">${btn('A')}${btn('B')}</div>`;
}

export function heroSheetHtml(ctx: AppCtx, id: string): string {
  const d = HERO_BY_ID[id];
  const h = ctx.s.heroes[id];
  const f = FACTIONS[d.faction];
  const st = heroStats(h);
  const cap = heroLevelCap(h.star);
  const lc = levelUpCost(h.lv);
  const sc = skillUpCost(h.skillLv);
  const need = h.star < MAX_STAR ? starShards(h.star, d.rarity) : 0;
  const inTeam = isInLineup(ctx.s, id);
  const bar = (label: string, v: number, max: number) => `<div class="stat"><span>${label}</span><div class="bar"><i style="width:${Math.min(100, (v / max) * 100)}%"></i></div><em class="num">${fmt(v)}</em></div>`;
  const R = ROLES[d.role];
  return `
  <div class="mask" data-act="sheetmask"><div class="sheet detail" style="--c:${f.color};--rc:var(--r-${d.rarity.toLowerCase()})" data-id="${id}">
    <button class="close" data-act="closesheet">${icon('close', 20)}</button>
    <div class="hero">
      <div class="portrait">${artImg(id, 'full')}</div>
      <div>
        <div class="sub">${d.title} · 原型 ${d.origin}</div>
        <h2>${d.name}</h2>
        <div class="row" style="gap:5px;margin:6px 0;flex-wrap:wrap"><span class="tag f" style="--c:${f.color}">${f.glyph} ${f.full}</span><span class="tag r" style="--rc:var(--r-${d.rarity.toLowerCase()})">${d.rarity}</span><span class="tag">${icon(ROLE_ICON[d.role], 14)}${d.role}</span></div>
        <div class="row" style="gap:6px">${stars(h.star, 5, 17)}</div>
        <div class="sub" style="margin-top:4px">Lv.${h.lv} / ${cap} · 战力 <b class="num">${fmt(heroPower(h))}</b></div>
        ${bar('生命', st.hp, 9000)}${bar('攻击', st.atk, 1500)}${bar('防御', st.def, 700)}${bar('速度', st.spd, 140)}
      </div>
    </div>
    <div class="panel" style="margin-top:10px"><div class="muted" style="font-size:12.5px;line-height:1.6">${esc(d.lore)}</div><div style="margin-top:6px;font-family:var(--f-d);font-size:15px;border-left:4px solid ${f.color};padding-left:8px">“${esc(d.quote)}”</div><div class="muted" style="font-size:11.5px;margin-top:6px">${R.row} · ${esc(R.desc)}</div></div>
    <h3 style="margin:14px 0 0;font-family:var(--f-d);font-weight:400;font-size:17px">技能</h3>
    ${skillsHtml(ctx, id)}
    ${awakenHtml(ctx, id)}
    ${equipmentHtml(ctx, id)}
    <div class="panel" style="margin-top:12px"><h3>养成</h3>
      <div class="row" style="margin:6px 0"><div class="grow"><b>升级</b> <span class="muted" style="font-size:12px">Lv.${h.lv} → ${h.lv + 1}</span></div><button class="btn sm" data-act="levelup" ${h.lv >= cap ? 'disabled' : ''}>${h.lv >= cap ? '已到上限' : `<span class="cost">${icon('fish', 16)}${fmt(lc.fish)} ${icon('spark', 16)}${fmt(lc.exp)}</span>`}</button></div>
      <div class="row" style="margin:8px 0"><div class="grow"><b>升星</b> <span class="muted" style="font-size:12px">碎片 ${h.shards}${h.star < MAX_STAR ? ' / ' + need : ''}</span></div><button class="btn sm green" data-act="starup" ${h.star >= MAX_STAR || h.shards < need ? 'disabled' : ''}>${h.star >= MAX_STAR ? '已满星' : '升星'}</button></div>
      <div class="row" style="margin:8px 0 0"><div class="grow"><b>绝技</b> <span class="muted" style="font-size:12px">Lv.${h.skillLv} / 10</span></div><button class="btn sm blue" data-act="skillup" ${h.skillLv >= 10 ? 'disabled' : ''}>${h.skillLv >= 10 ? '已满级' : `<span class="cost">${icon('fish', 16)}${fmt(sc.fish)} ${icon('catnip', 16)}${sc.catnip}</span>`}</button></div>
    </div>
    <div class="footbar"><button class="btn ${inTeam ? 'ghost' : 'green'} lg" data-act="toggleteam">${inTeam ? '下阵' : '上阵'}</button><button class="btn lg" data-act="levelup" ${h.lv >= cap ? 'disabled' : ''}>升级</button></div>
  </div></div>`;
}

export function openHeroSheet(ctx: AppCtx, id: string) {
  closeSheet(ctx);
  ctx.root.insertAdjacentHTML('beforeend', heroSheetHtml(ctx, id));
}
export function closeSheet(ctx: AppCtx) {
  ctx.root.querySelectorAll('.mask[data-act=sheetmask]').forEach((e) => e.remove());
}
export function currentSheetId(ctx: AppCtx): string | null {
  return (ctx.root.querySelector('.sheet.detail') as HTMLElement | null)?.dataset.id ?? null;
}

/** 处理详情页内的操作；返回是否已处理 */
export function handleDetail(ctx: AppCtx, act: string, el: HTMLElement): boolean {
  const id = currentSheetId(ctx);
  if (!id) return false;
  let r: { ok: boolean; reason?: string } | null = null;
  switch (act) {
    case 'levelup': r = levelUp(ctx.s, id); break;
    case 'skillup': r = skillUp(ctx.s, id); break;
    case 'starup': r = starUp(ctx.s, id); if (r.ok) ctx.toast('升星成功！等级上限提高'); break;
    case 'awaken': r = setAwaken(ctx.s, id, el.dataset.b as 'A' | 'B'); if (r.ok) ctx.toast('已切换觉醒路线'); break;
    case 'toggleteam': r = isInLineup(ctx.s, id) ? unequip(ctx.s, id) : equip(ctx.s, id); break;
    case 'closesheet': closeSheet(ctx); return true;
    default: return false;
  }
  if (r && !r.ok) { ctx.toast((r as { reason: string }).reason); sfx.no(); }
  else if (r && (act === 'levelup' || act === 'skillup' || act === 'starup')) sfx.up();
  ctx.save();
  const scroll = (ctx.root.querySelector('.sheet.detail') as HTMLElement).scrollTop;
  openHeroSheet(ctx, id);
  (ctx.root.querySelector('.sheet.detail') as HTMLElement).scrollTop = scroll;
  ctx.refresh();
  if (act === 'toggleteam') ctx.loop.restart();
  return true;
}
