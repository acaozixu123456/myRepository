// 宠物页：出战宠物展示 + 孵蛋 + 12 只宠物图鉴（升级 / 升星 / 出战）。
import { PETS, PET_BY_ID, PET_RARITY_NAME } from '../../data/pets';
import type { PetRarity } from '../../data/pets';
import { HATCH_RATE, PET_EGG_BELLS, PET_PITY, PET_STAR_MAX, buyEgg, hatch, petBonus, petLevelUp, petLvCap, petLvCost, petPower, petStarCost, petStarUp, petsOf, setActive } from '../../game/pets';
import { artUrl } from '../../ui/art';
import { esc, fmt } from '../../ui/components';
import { icon } from '../../ui/icons';
import { infoBtn } from '../../ui/info';
import type { AppCtx } from '../ctx';
import { sfx } from '../sfx';
import { topbar } from './lineup';

export const petState: { sel: string | null } = { sel: null };
const RC: Record<PetRarity, string> = { R: '#9bc4ff', SR: '#c08aff', SSR: '#ffd24a' };
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(PET_STAR_MAX - n);

const HELP = `宠物是跟着你的小猫伙伴：\n· 出战的宠物会给全队加生命 / 攻击 / 防御（百分比）。\n· 战斗里从第 2 回合起，每 3 回合出手一次（第 2、5、8…回合），一场战斗最多一只宠物出战。\n· 宠物蛋可以从每日探索、小游戏三星通关、商店（${PET_EGG_BELLS} 金铃铛）获得。\n· 孵出重复的宠物会变成该宠物的碎片，碎片用来升星；升星提高等级上限、全队加成和技能威力。\n· 孵蛋概率：普通 ${HATCH_RATE.R * 100}% / 稀有 ${HATCH_RATE.SR * 100}% / 传说 ${HATCH_RATE.SSR * 100}%，连续 ${PET_PITY} 颗没出传说，第 ${PET_PITY} 颗必出。`;

export function petsHtml(ctx: AppCtx): string {
  const s = ctx.s;
  const p = petsOf(s);
  const sel = petState.sel && PET_BY_ID[petState.sel] ? petState.sel : p.active ?? PETS[0].id;
  petState.sel = sel;
  const def = PET_BY_ID[sel];
  const own = p.owned[sel];
  const grid = PETS.map((d) => {
    const o = p.owned[d.id];
    return `<button class="pt-card ${d.id === sel ? 'on' : ''} ${o ? '' : 'lock'}" data-act="pet-sel" data-id="${d.id}" style="--rc:${RC[d.rarity]}">
      <img src="${artUrl(d.id, 'head')}" alt="${esc(d.name)}" draggable="false"><b>${o ? esc(d.name) : '？？？'}</b>
      <i>${o ? `Lv${o.lv} ${stars(o.star)}` : PET_RARITY_NAME[d.rarity]}</i>${p.active === d.id ? '<em>出战</em>' : ''}</button>`;
  }).join('');
  let detail: string;
  if (own) {
    const capped = own.lv >= petLvCap(own.star);
    const lvCost = petLvCost(own.lv);
    const stCost = petStarCost(own.star);
    detail = `<div class="pt-info">
      <div class="pt-top"><h3>${esc(def.name)}</h3><span class="pt-rar" style="background:${RC[def.rarity]}">${PET_RARITY_NAME[def.rarity]}</span><span class="pt-st">${stars(own.star)}</span></div>
      <p class="pt-tag">${esc(def.tagline)}</p>
      <div class="pt-skill"><b>${icon('spark', 18)} ${esc(def.skill.name)}</b><small>第 2、5、8… 回合出手</small><p>${esc(def.skill.desc)}</p><small>当前威力 ×${petPower(own).toFixed(2)}</small></div>
      <div class="pt-bonus">全队属性 <b>+${pct(petBonus(own))}</b> <small>（升级 / 升星会增加）</small></div>
      <div class="pt-btns">
        <button class="btn sm green ${capped || s.res.fish < lvCost ? 'dim' : ''}" data-act="pet-lv" data-id="${sel}">升级 Lv${own.lv}${capped ? '（到顶）' : ` <span class="cost">${icon('fish', 16)}${fmt(lvCost)}</span>`}</button>
        <button class="btn sm blue ${own.star >= PET_STAR_MAX || own.shards < stCost ? 'dim' : ''}" data-act="pet-star" data-id="${sel}">${own.star >= PET_STAR_MAX ? '已满星' : `升星 <span class="cost">碎片 ${own.shards}/${stCost}</span>`}</button>
        <button class="btn sm ${p.active === sel ? 'ghost' : ''}" data-act="pet-set" data-id="${sel}">${p.active === sel ? '取消出战' : '出战'}</button>
      </div></div>`;
  } else {
    detail = `<div class="pt-info"><div class="pt-top"><h3>？？？</h3><span class="pt-rar" style="background:${RC[def.rarity]}">${PET_RARITY_NAME[def.rarity]}</span></div><p class="pt-tag">还没有遇见这只小猫。去孵宠物蛋，说不定就是它。</p><div class="pt-skill"><b>${icon('spark', 18)} ${esc(def.skill.name)}</b><p>${esc(def.skill.desc)}</p></div></div>`;
  }
  return `
  ${topbar(ctx, `宠物${infoBtn(HELP, '宠物说明')}`, `<span class="chip">🥚<b class="num">${p.eggs}</b></span>`)}
  <div class="scroll" style="padding:0 0 18px">
    <div class="pt-stage" style="--rc:${RC[def.rarity]}">
      <div class="rays"></div><img src="${artUrl(sel, 'full')}" alt="${esc(def.name)}" draggable="false" class="${own ? '' : 'sil'}">
    </div>
    ${detail}
    <div class="pt-hatch">
      <button class="btn lg ${p.eggs > 0 ? '' : 'dim'}" data-act="pet-hatch">🥚 孵蛋 <span class="cost">×${p.eggs}</span></button>
      <button class="btn blue ${s.res.bells >= PET_EGG_BELLS ? '' : 'dim'}" data-act="pet-buy">买蛋 <span class="cost">${icon('bells', 16)}${PET_EGG_BELLS}</span></button>
      <small>传说保底：${p.pity}/${PET_PITY}　已孵 ${p.hatched}　图鉴 ${Object.keys(p.owned).length}/${PETS.length}</small>
    </div>
    <div class="pt-grid">${grid}</div>
  </div>`;
}

function hatchDialog(ctx: AppCtx, r: { id: string; rarity: PetRarity; isNew: boolean; shards: number }) {
  const d = PET_BY_ID[r.id];
  ctx.root.querySelectorAll('.mask.center').forEach((m) => m.remove());
  ctx.root.insertAdjacentHTML('beforeend', `<div class="mask center" data-act="closedialog"><div class="dialog result win pt-hatchdlg" style="--rc:${RC[r.rarity]}">
    <div class="banner-r">${r.isNew ? '🎉 新伙伴！' : '重复啦'}</div>
    <img src="${artUrl(r.id, 'full')}" alt="${esc(d.name)}" style="height:210px" draggable="false">
    <h3 class="title" style="margin:2px 0">${esc(d.name)} <span class="pt-rar" style="background:${RC[r.rarity]}">${PET_RARITY_NAME[r.rarity]}</span></h3>
    <p class="muted" style="font-weight:800;font-size:12.5px;margin:0 0 8px">${r.isNew ? esc(d.tagline) : `已经有它了，转成 ${r.shards} 枚碎片（升星用）`}</p>
    <div class="row" style="justify-content:center;gap:10px"><button class="btn" data-act="closedialog">${icon('check', 22)}</button>${petsOf(ctx.s).eggs > 0 ? '<button class="btn green" data-act="pet-hatch">再孵一颗</button>' : ''}</div></div></div>`);
}

export function handlePets(ctx: AppCtx, act: string, el: HTMLElement): boolean {
  if (!act.startsWith('pet-')) return false;
  const s = ctx.s;
  const id = el.dataset.id ?? petState.sel ?? '';
  const done = (r: { ok: boolean; reason?: string }, ok = '') => { if (!r.ok) { sfx.no(); ctx.toast(r.reason ?? '不行'); } else { sfx.ok(); if (ok) ctx.toast(ok); ctx.save(); } ctx.refresh(); };
  switch (act) {
    case 'pet-sel': petState.sel = id; ctx.refresh(); break;
    case 'pet-lv': done(petLevelUp(s, id)); break;
    case 'pet-star': done(petStarUp(s, id), '升星成功！全队加成更高了'); break;
    case 'pet-set': { const was = petsOf(s).active === id; done(setActive(s, was ? null : id), was ? '宠物回家休息了' : `${PET_BY_ID[id].name} 出战！`); break; }
    case 'pet-buy': done(buyEgg(s), '买到一颗宠物蛋'); break;
    case 'pet-hatch': {
      const r = hatch(s);
      if ('ok' in r) { sfx.no(); ctx.toast(r.reason); break; }
      petState.sel = r.id;
      ctx.save(); ctx.refresh(); hatchDialog(ctx, r);
      break;
    }
    default: return false;
  }
  return true;
}
