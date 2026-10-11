import { EQUIPS, EQUIP_SETS } from '../../content/equipment';
import { ITEMS } from '../../content/items';
import type { EquipDef, EquipSlot, ItemDef, Quality, StatBlock, StatKey } from '../../content/types';
import { FACTIONS } from '../../data/factions';
import { HERO_BY_ID } from '../../data/heroes';
import { enhanceCost, enhanceEquipment, equipEquipment, equipmentStats, equippedSetCounts, itemCount, unequipEquipment, useYarn, YARN_MINUTES } from '../../game/inventory';
import type { EquipmentInstance } from '../../game/inventory';
import type { OpResult } from '../../game/state';
import { RARITY_ORDER } from '../../game/state';
import { artImg } from '../../ui/art';
import { esc, fmt } from '../../ui/components';
import { icon } from '../../ui/icons';
import type { AppCtx } from '../ctx';
import { sfx } from '../sfx';
import { closeSheet } from './detail';
import { topbar } from './lineup';

type BagTab = 'equipment' | 'items' | 'shards';
export const bagState: { tab: BagTab } = { tab: 'equipment' };
const sheetState = { uid: null as string | null, picking: false };
const EQUIP_BY_ID = Object.fromEntries(EQUIPS.map((d) => [d.id, d]));
const SET_BY_ID = Object.fromEntries(EQUIP_SETS.map((d) => [d.id, d]));
const QUALITY_COLOR: Record<Quality, string> = { common: 'var(--paper-line)', fine: 'var(--green)', rare: 'var(--r-sr)', epic: 'var(--r-ssr)', legend: 'var(--r-ur)' };
const QUALITY_NAME: Record<Quality, string> = { common: '普通', fine: '精良', rare: '稀有', epic: '史诗', legend: '传说' };
const SLOT_NAME: Record<EquipSlot, string> = { weapon: '武器', armor: '铠甲', head: '头饰', charm: '铃铛' };
const SLOT_ICON: Record<EquipSlot, string> = { weapon: 'sword', armor: 'armor', head: 'helmet', charm: 'bell' };
const STAT_NAMES: Record<StatKey, string> = { hp: '生命', atk: '攻击', def: '防御', spd: '速度', crit: '暴击', critDmg: '暴击伤害', hit: '命中', dodge: '闪避', healBonus: '治疗加成', dmgReduce: '减伤' };
const ABSOLUTE_STATS = new Set<StatKey>(['hp', 'atk', 'def', 'spd']);

const statValue = (key: StatKey, value: number) => `${Number((value * (ABSOLUTE_STATS.has(key) ? 1 : 100)).toFixed(2)).toLocaleString('en-US')}${ABSOLUTE_STATS.has(key) ? '' : '%'}`;
const quantity = (n: number) => Number.isInteger(n) ? fmt(n) : n.toLocaleString('en-US', { maximumFractionDigits: 6 });
const inventoryEquipment = (ctx: AppCtx) => ctx.s.inventory.equipment.filter((e) => EQUIP_BY_ID[e.equipId]);
const ownedHeroes = (ctx: AppCtx) => Object.values(ctx.s.heroes).filter((h) => HERO_BY_ID[h.id]).sort((a, b) => Number(ctx.s.lineup.includes(b.id)) - Number(ctx.s.lineup.includes(a.id)) || RARITY_ORDER[HERO_BY_ID[a.id].rarity] - RARITY_ORDER[HERO_BY_ID[b.id].rarity]);

function emptyHtml(image: string, title: string, text: string): string {
  return `<div class="panel bag-empty"><div class="bag-empty-art">${icon(image, 64)}</div><h3>${title}</h3><p>${text}</p></div>`;
}

function equipmentHtml(ctx: AppCtx): string {
  const list = inventoryEquipment(ctx);
  if (!list.length) return emptyHtml('bag', '箱子让猫占了', '装备还没放进来，倒有一只猫睡得很整齐。');
  return `<div class="bag-equip-grid">${list.map((instance) => {
    const def = EQUIP_BY_ID[instance.equipId];
    const wearer = instance.heroId && HERO_BY_ID[instance.heroId];
    return `<button class="hcard bag-equip-card" style="--rc:${QUALITY_COLOR[def.quality]}" data-act="bag-open" data-uid="${esc(instance.uid)}" aria-label="${esc(def.name)}，${QUALITY_NAME[def.quality]}，等级${instance.level}">
      <div class="bag-equip-art"><span class="bag-quality">${QUALITY_NAME[def.quality]}</span>${icon(SLOT_ICON[def.slot], 46)}<span class="bag-equip-level">Lv.${instance.level}</span></div>
      <div class="bag-equip-info"><b>${esc(def.name)}</b><small>${SLOT_NAME[def.slot]}${def.setId ? ' · 套装' : ''}</small><span class="bag-wearer${wearer ? ' bag-wearing' : ''}">${wearer ? `${esc(wearer.name)} · 穿戴中` : '收在背包'}</span></div>
    </button>`;
  }).join('')}</div>`;
}

function itemIcon(item: ItemDef): string {
  if (item.id === 'fish' || item.id.startsWith('fish_pouch')) return 'fish';
  if (item.id === 'bells') return 'bell';
  if (item.id.startsWith('catnip')) return 'catnip';
  if (item.id in YARN_MINUTES || item.id === 'bell_thread') return 'yarn';
  if (item.kind === 'ticket') return 'ticket';
  if (item.kind === 'chest') return 'gift';
  if (item.kind === 'shard' || item.id === 'paw_seal' || item.id.startsWith('claw_scroll')) return 'paw';
  if (item.id.startsWith('fishbone')) return 'sword';
  if (item.id.startsWith('awaken')) return 'spark';
  return 'campaign';
}

function itemsHtml(ctx: AppCtx): string {
  if (!ITEMS.some((d) => itemCount(ctx.s, d.id) > 0)) return emptyHtml('gift', '军需匣也打了个盹', '鱼干和线团都用完了，空箱子先借猫猫睡一会儿。');
  // 留下空毛线球的位置，让使用按钮明确显示需要库存；其他零数量道具不占行。
  const list = ITEMS.filter((d) => itemCount(ctx.s, d.id) > 0 || d.id in YARN_MINUTES);
  return `<div class="bag-item-list">${list.map((d) => {
    const count = itemCount(ctx.s, d.id);
    const minutes = YARN_MINUTES[d.id as keyof typeof YARN_MINUTES];
    return `<div class="panel bag-item-row"><div class="hcard bag-item-icon" style="--rc:${QUALITY_COLOR[d.quality]}">${icon(itemIcon(d), 32)}</div>
      <div class="bag-item-copy"><div class="bag-item-heading"><b>${esc(d.name)}</b><span class="bag-item-count num">×${quantity(count)}</span></div><p>${esc(d.desc)}</p>
      ${minutes ? `<div class="bag-yarn-use"><span>${minutes} 分钟挂机收益</span><button class="btn sm pink" data-act="bag-use" data-id="${d.id}" ${count < 1 ? 'disabled' : ''}>${count < 1 ? '暂无毛线球' : '使用一颗'}</button></div>` : ''}</div>
    </div>`;
  }).join('')}</div>`;
}

function shardsHtml(ctx: AppCtx): string {
  const heroes = ownedHeroes(ctx);
  if (!heroes.length) return emptyHtml('team', '还没有来信', '先请一位猫猫进门，碎片就有了归处。');
  const allZero = heroes.every((h) => h.shards === 0);
  return `${allZero ? '<div class="panel bag-zero-shards"><h3>来信还在路上</h3><p>猫猫先到了，碎片还在路上。星星的事，容邮差舔完这只爪。</p></div>' : ''}
    <div class="bag-shard-list">${heroes.map((h) => {
      const d = HERO_BY_ID[h.id];
      return `<button class="hcard bag-shard-card" data-r="${d.rarity}" style="--c:${FACTIONS[d.faction].color}" data-act="bag-hero" data-id="${h.id}" aria-label="${d.name}，${h.shards}枚碎片，查看详情">
        <div class="bag-hero-portrait">${artImg(h.id, 'head', d.name)}</div><div class="bag-shard-name"><b>${d.name}</b><small>${FACTIONS[d.faction].full} · ${d.role}</small></div><span class="bag-shard-number"><b class="num">${fmt(h.shards)}</b><small>枚碎片</small></span>
      </button>`;
    }).join('')}</div>`;
}

export function bagHtml(ctx: AppCtx): string {
  const equipment = inventoryEquipment(ctx);
  const tabs: { id: BagTab; name: string; image: string }[] = [{ id: 'equipment', name: '装备', image: 'sword' }, { id: 'items', name: '道具', image: 'bag' }, { id: 'shards', name: '碎片', image: 'paw' }];
  const copy = {
    equipment: { title: '装备箱', count: `${equipment.length} 件 · 已穿戴 ${equipment.filter((e) => e.heroId).length} 件`, text: '护耳的、垫爪的，都收在这里。' },
    items: { title: '军需小匣', count: `${ITEMS.filter((d) => itemCount(ctx.s, d.id) > 0).length} 种`, text: '小鱼干记进账，毛线球留给赶路的日子。' },
    shards: { title: '猫猫的来信', count: `${fmt(ownedHeroes(ctx).reduce((sum, h) => sum + h.shards, 0))} 枚`, text: '来信攒得厚，老朋友的星星也会多一颗。' },
  }[bagState.tab];
  return `${topbar(ctx, '背包')}<div class="scroll bag-scroll"><div class="seg bag-tabs" aria-label="背包页签">${tabs.map((tab) => `<button class="pill" aria-pressed="${bagState.tab === tab.id}" data-act="bag-tab" data-tab="${tab.id}">${icon(tab.image, 20)}${tab.name}</button>`).join('')}</div>
    <div class="panel bag-summary"><div class="row"><h3 class="grow">${copy.title}</h3><span class="tag num">${copy.count}</span></div><p>${copy.text}</p></div>
    ${bagState.tab === 'equipment' ? equipmentHtml(ctx) : bagState.tab === 'items' ? itemsHtml(ctx) : shardsHtml(ctx)}</div>`;
}

function attributesHtml(instance: EquipmentInstance, def: EquipDef): string {
  const current = equipmentStats(instance);
  const next: StatBlock | null = instance.level < def.levelCap ? equipmentStats({ ...instance, level: instance.level + 1 }) : null;
  return `<div class="panel bag-attributes"><div class="row"><h3 class="grow">装备属性</h3>${next ? '<span class="tag">箭头后为强化一级</span>' : '<span class="tag">已到上限</span>'}</div>
    ${Object.keys(STAT_NAMES).filter((key) => current[key as StatKey] !== undefined).map((key) => {
      const k = key as StatKey;
      return `<div class="bag-stat"><span>${STAT_NAMES[k]}</span><b class="num">+${statValue(k, current[k]!)}</b>${next ? `<span class="bag-stat-next num">→ +${statValue(k, next[k] ?? current[k]!)}</span>` : ''}</div>`;
    }).join('')}</div>`;
}

function setHtml(ctx: AppCtx, instance: EquipmentInstance, def: EquipDef): string {
  const set = def.setId && SET_BY_ID[def.setId];
  if (!set) return '<div class="panel bag-set"><h3>通用装备</h3><p class="bag-note">这件装备不挑同伴，可以与其他装备搭配。</p></div>';
  const count = instance.heroId ? equippedSetCounts(ctx.s, instance.heroId)[set.id] ?? 0 : 0;
  return `<div class="panel bag-set"><div class="row"><h3 class="grow">${esc(set.name)}</h3><span class="tag num">${count}/4 件</span></div><p class="bag-note">${instance.heroId ? `${esc(HERO_BY_ID[instance.heroId]?.name ?? '猫猫')}已穿戴 ${count} 件` : '尚未穿戴，套装件数按同一只猫计算。'}</p>
    <div class="bag-set-step${count >= 2 ? ' bag-set-on' : ''}"><b>两件套 · ${count >= 2 ? '已凑齐' : '未凑齐'}</b><p>${esc(set.bonus2.desc)}</p></div>
    <div class="bag-set-step${count >= 4 ? ' bag-set-on' : ''}"><b>四件套 · ${count >= 4 ? '已凑齐' : '未凑齐'}</b><p>${esc(set.bonus4.desc)}</p>${set.bonus4.note ? `<p>${esc(set.bonus4.note)}</p>` : ''}</div>
    <p class="bag-note">凑齐四件时，同时保留两件套效果。</p></div>`;
}

function pickerHtml(ctx: AppCtx, instance: EquipmentInstance, def: EquipDef): string {
  const heroes = ownedHeroes(ctx);
  return `<div class="panel bag-picker-note"><h3>穿戴给哪只猫？</h3><p>同一部位只穿戴一件。换下的装备会收回背包。</p></div><div class="bag-hero-grid">${heroes.map((h) => {
    const d = HERO_BY_ID[h.id];
    const current = inventoryEquipment(ctx).find((e) => e.heroId === h.id && EQUIP_BY_ID[e.equipId].slot === def.slot);
    const wearing = instance.heroId === h.id;
    return `<button class="hcard bag-hero-choice" data-r="${d.rarity}" style="--c:${FACTIONS[d.faction].color}" data-act="bag-equip" data-uid="${esc(instance.uid)}" data-id="${h.id}" ${wearing ? 'disabled' : ''} aria-label="${wearing ? '已穿戴' : '穿戴给'}${d.name}">
      <div class="bag-hero-portrait">${artImg(h.id, 'head', d.name)}</div><div class="bag-hero-choice-copy"><b>${d.name}</b><small>${d.role} · Lv.${h.lv}</small><span>${wearing ? '已穿戴这件' : current ? `替换 ${esc(EQUIP_BY_ID[current.equipId].name)}` : `${SLOT_NAME[def.slot]}空着`}</span></div>
    </button>`;
  }).join('')}</div>${heroes.length ? '' : emptyHtml('team', '先留一个位置', '还没有猫猫能试穿，装备在箱子里等一会儿。')}<div class="bag-picker-foot"><button class="btn ghost" data-act="bag-pick-back">返回装备详情</button></div>`;
}

function sheetHtml(ctx: AppCtx, instance: EquipmentInstance): string {
  const def = EQUIP_BY_ID[instance.equipId];
  const cost = enhanceCost(instance);
  const full = instance.level >= def.levelCap;
  const enough = ctx.s.res.fish >= cost;
  const wearer = instance.heroId && HERO_BY_ID[instance.heroId];
  return `<div class="sheet bag-sheet" data-act="bag-panel" data-uid="${esc(instance.uid)}" role="dialog" aria-modal="true" aria-label="${esc(def.name)}装备详情">
    <button class="close bag-close" data-act="bag-close" aria-label="关闭装备详情">${icon('close', 22)}</button>
    <div class="bag-detail-head"><div class="hcard bag-detail-icon" style="--rc:${QUALITY_COLOR[def.quality]}">${icon(SLOT_ICON[def.slot], 52)}</div><div class="bag-detail-title"><span class="tag r" style="--rc:${QUALITY_COLOR[def.quality]}">${QUALITY_NAME[def.quality]}</span><h2>${esc(def.name)}</h2><div>${SLOT_NAME[def.slot]} · Lv.${instance.level} / ${def.levelCap}</div></div></div>
    <div class="bag-owner">${icon(wearer ? 'team' : 'bag', 18)}${wearer ? `${esc(wearer.name)}正在穿戴` : '收在背包中'}</div>
    ${sheetState.picking ? pickerHtml(ctx, instance, def) : `${attributesHtml(instance, def)}${setHtml(ctx, instance, def)}<div class="panel bag-flavor"><h3>行囊小记</h3><p>${esc(def.flavor)}</p></div>
      <div class="bag-actions"><button class="btn green" data-act="bag-pick" ${ownedHeroes(ctx).length ? '' : 'disabled'}>${icon('team', 20)}穿戴给…</button><button class="btn ghost" data-act="bag-unequip" data-uid="${esc(instance.uid)}" ${instance.heroId ? '' : 'disabled'}>${icon('bag', 20)}卸下</button>
      <button class="btn bag-enhance" data-act="bag-enhance" data-uid="${esc(instance.uid)}" ${full || !enough ? 'disabled' : ''}>${full ? '已强化至上限' : `${enough ? '强化' : '小鱼干不足'}<span class="cost">${icon('fish', 18)}${fmt(cost)} · Lv.${instance.level} → ${instance.level + 1}</span>`}</button></div>`}
  </div>`;
}

function closeBagSheet(ctx: AppCtx): void {
  ctx.root.querySelectorAll('.mask[data-act=bag-mask]').forEach((e) => e.remove());
  sheetState.uid = null;
  sheetState.picking = false;
}

function openBagSheet(ctx: AppCtx, uid: string): void {
  const instance = inventoryEquipment(ctx).find((e) => e.uid === uid);
  if (!instance) { ctx.toast('这件装备已经不在行囊里了'); return; }
  closeSheet(ctx);
  closeBagSheet(ctx);
  sheetState.uid = uid;
  ctx.root.insertAdjacentHTML('beforeend', `<div class="mask bag-mask" data-act="bag-mask">${sheetHtml(ctx, instance)}</div>`);
}

function redrawBagSheet(ctx: AppCtx, scroll?: number): void {
  const sheet = ctx.root.querySelector('.bag-sheet') as HTMLElement | null;
  if (!sheet || !sheetState.uid) return;
  const instance = inventoryEquipment(ctx).find((e) => e.uid === sheetState.uid);
  if (!instance) { closeBagSheet(ctx); return; }
  const position = scroll ?? sheet.scrollTop;
  sheet.outerHTML = sheetHtml(ctx, instance);
  const replacement = ctx.root.querySelector('.bag-sheet') as HTMLElement;
  replacement.style.animation = 'none';
  replacement.scrollTop = position;
}

function refreshBag(ctx: AppCtx): void {
  const previous = (ctx.root.querySelector('[data-screen=bag] .bag-scroll') as HTMLElement | null)?.scrollTop ?? 0;
  ctx.refresh();
  const scroll = ctx.root.querySelector('[data-screen=bag] .bag-scroll') as HTMLElement | null;
  if (scroll) scroll.scrollTop = previous;
}

function finishOperation(ctx: AppCtx, result: OpResult, message: string, scroll?: number): void {
  if (!result.ok) { ctx.toast(result.reason); sfx.no(); return; }
  ctx.save();
  refreshBag(ctx);
  redrawBagSheet(ctx, scroll);
  ctx.toast(message);
}

/** 背包操作只处理 bag- 前缀，不与英雄详情抽屉的动作混用。 */
export function handleBag(ctx: AppCtx, el: HTMLElement): boolean {
  const act = el.dataset.act;
  if (!act?.startsWith('bag-')) return false;
  if (el instanceof HTMLButtonElement && el.disabled) return true;
  switch (act) {
    case 'bag-tab': {
      const tab = el.dataset.tab;
      if (tab === 'equipment' || tab === 'items' || tab === 'shards') { closeBagSheet(ctx); bagState.tab = tab; ctx.refresh(); }
      return true;
    }
    case 'bag-browse': closeSheet(ctx); closeBagSheet(ctx); bagState.tab = 'equipment'; ctx.go('bag'); return true;
    case 'bag-open': openBagSheet(ctx, el.dataset.uid ?? ''); return true;
    case 'bag-close': case 'bag-mask': closeBagSheet(ctx); return true;
    case 'bag-panel': return true;
    case 'bag-pick': sheetState.picking = true; redrawBagSheet(ctx, 0); return true;
    case 'bag-pick-back': sheetState.picking = false; redrawBagSheet(ctx, 0); return true;
    case 'bag-equip': {
      const id = el.dataset.id ?? '';
      const result = equipEquipment(ctx.s, el.dataset.uid ?? '', id);
      if (result.ok) { sheetState.picking = false; sfx.ok(); }
      finishOperation(ctx, result, `已穿戴给${HERO_BY_ID[id]?.name ?? '猫猫'}`, 0);
      return true;
    }
    case 'bag-unequip': {
      const result = unequipEquipment(ctx.s, el.dataset.uid ?? '');
      if (result.ok) sfx.ok();
      finishOperation(ctx, result, '装备收回背包了');
      return true;
    }
    case 'bag-enhance': {
      const uid = el.dataset.uid ?? '';
      const result = enhanceEquipment(ctx.s, uid);
      if (result.ok) sfx.up();
      const level = inventoryEquipment(ctx).find((e) => e.uid === uid)?.level;
      finishOperation(ctx, result, `强化完成 · Lv.${level ?? ''}`);
      return true;
    }
    case 'bag-use': {
      const result = useYarn(ctx.s, el.dataset.id ?? '');
      if (!result.ok) { ctx.toast(result.reason); sfx.no(); return true; }
      ctx.save();
      refreshBag(ctx);
      redrawBagSheet(ctx);
      sfx.coin();
      ctx.toast(`加速 ${result.minutes} 分钟：鱼干 +${fmt(result.fish)}，经验 +${fmt(result.exp)}`);
      return true;
    }
    case 'bag-hero': {
      const id = el.dataset.id ?? '';
      if (!ctx.s.heroes[id] || !HERO_BY_ID[id]) { ctx.toast('先请这只猫猫进门吧'); return true; }
      closeBagSheet(ctx);
      ctx.openHero(id);
      return true;
    }
    default: return false;
  }
}
