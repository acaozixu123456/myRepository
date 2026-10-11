import type { Quality } from '../../content/types';
import { ITEMS } from '../../content/items';
import { buy, listShop } from '../../game/shop';
import type { ShopEntry, ShopId } from '../../game/shop';
import { esc, fmt } from '../../ui/components';
import { icon } from '../../ui/icons';
import type { AppCtx } from '../ctx';
import { floaty } from './home';
import { topbar } from './lineup';

export const shopState: { tab: ShopId } = { tab: 'general' };
const SHOPS: { id: ShopId; name: string; title: string; note: string }[] = [
  { id: 'general', name: '通用', title: '行军小货栈', note: '鱼干数清，箱盖留着。掌柜知道谁会来睡。' },
  { id: 'arena', name: '竞技', title: '比爪兑换摊', note: '把比试留下的爪印，换成明天用得上的军需。' },
  { id: 'guild', name: '公会', title: '同袍共货架', note: '一起抬过的纸箱，装着分给同袍的好东西。' },
  { id: 'tower', name: '爬塔', title: '登楼行囊铺', note: '爬高以后也得下楼。掌柜替你看着行囊。' },
  { id: 'faction', name: '阵营', title: '六族来客市', note: '各族的旗都插稳了，空箱子也备好了。' },
];
const QUALITY_COLOR: Record<Quality, string> = {
  common: 'var(--paper-line)', fine: 'var(--green)', rare: 'var(--r-sr)', epic: 'var(--r-ssr)', legend: 'var(--r-ur)',
};
const ITEM_BY_ID = Object.fromEntries(ITEMS.map((item) => [item.id, item]));
let order: { offerId: string; count: number } | null = null;

function itemIcon(id: string): string {
  if (id.startsWith('catnip')) return 'catnip';
  if (id.startsWith('yarn') || id === 'bell_thread') return 'yarn';
  if (id.startsWith('recruit')) return 'ticket';
  if (id.startsWith('fishbone') || id.startsWith('fish')) return 'fish';
  if (id === 'bells') return 'bells';
  if (id.startsWith('claw_scroll')) return 'staff';
  if (id === 'paw_seal' || id.startsWith('hero_shard')) return 'paw';
  if (id.endsWith('_token')) return 'campaign';
  if (id.startsWith('awaken')) return 'spark';
  return 'gift';
}

function limitText(entry: ShopEntry): string {
  return entry.remaining === null ? '本周不限购' : `本周剩余 ${entry.remaining} / ${entry.offer.weeklyLimit} 份`;
}

function offerHtml(entry: ShopEntry): string {
  const soldOut = entry.remaining === 0;
  return `<article class="panel shop-card${!entry.available ? ' shop-unavailable' : soldOut ? ' shop-soldout' : ''}" data-offer-id="${esc(entry.offer.id)}">
    <div class="shop-product-head"><div class="hcard shop-product-icon" style="--rc:${QUALITY_COLOR[entry.item.quality]}">${icon(itemIcon(entry.item.id), 34)}</div><div class="shop-product-title"><h3>${esc(entry.item.name)}</h3><small>每份 ×${fmt(entry.offer.item.count)}</small></div></div>
    <p class="shop-product-desc">${esc(entry.item.desc.split('；')[0])}</p>
    <div class="shop-price">${icon(itemIcon(entry.currency.id), 20)}<b class="num">${fmt(entry.offer.price.count)}</b><small>${esc(entry.currency.name)} / 份</small></div>
    <div class="shop-limit">${limitText(entry)}</div>
    <button class="btn sm ${entry.maxCount > 0 ? 'green' : 'ghost'} shop-buy" data-act="shop-open" data-id="${esc(entry.offer.id)}" ${!entry.available || soldOut ? 'disabled' : ''}>${!entry.available ? '暂未开放' : soldOut ? '本周售罄' : '购买'}</button>
  </article>`;
}

export function shopHtml(ctx: AppCtx): string {
  const shop = SHOPS.find((entry) => entry.id === shopState.tab)!;
  const entries = listShop(ctx.s, shop.id);
  const wallets = [...new Map(entries.map((entry) => [entry.currency.id, entry])).values()];
  return `${topbar(ctx, '商店', '<button class="btn sm ghost shop-back" data-act="nav" data-to="home">返回</button>')}
    <div class="shop-tabs"><div class="seg" aria-label="商店页签">${SHOPS.map((entry) => `<button class="pill" data-act="shop-tab" data-tab="${entry.id}" aria-pressed="${entry.id === shop.id}">${entry.name}</button>`).join('')}</div></div>
    <div class="scroll shop-scroll"><section class="panel shop-summary"><h3>${shop.title}</h3><div class="shop-wallets">${wallets.map((entry) => `<span class="chip light">${icon(itemIcon(entry.currency.id), 20)}<span>${esc(entry.currency.name)}</span><b class="num">${fmt(entry.balance)}</b></span>`).join('')}</div>
    ${wallets.some((entry) => entry.balance === 0) ? `<div class="shop-wallet-note">暂未获得${wallets.filter((entry) => entry.balance === 0).map((entry) => esc(entry.currency.name)).join('、')}</div>` : ''}<p>${shop.note}</p><div class="shop-restock">每周一凌晨 5 点补货 · 限额按购买份数计</div></section>
    <div class="shop-grid">${entries.map(offerHtml).join('')}</div></div>`;
}

function closeOrder(ctx: AppCtx): void {
  ctx.root.querySelectorAll('.shop-mask').forEach((mask) => mask.remove());
  order = null;
}

function currentEntry(ctx: AppCtx): ShopEntry | undefined {
  return order ? listShop(ctx.s, shopState.tab).find((entry) => entry.offer.id === order!.offerId) : undefined;
}

function showOrder(ctx: AppCtx): void {
  const entry = currentEntry(ctx);
  if (!entry || !order) return closeOrder(ctx);
  ctx.root.querySelectorAll('.shop-mask').forEach((mask) => mask.remove());
  const count = order.count;
  const total = count * entry.offer.price.count;
  const canBuy = entry.available && count > 0 && count <= entry.maxCount;
  const reason = entry.reason ?? (count > entry.maxCount ? `当前最多可买 ${entry.maxCount} 份` : '');
  ctx.root.insertAdjacentHTML('beforeend', `<div class="mask center shop-mask" data-act="shop-mask"><div class="dialog shop-dialog" data-act="shop-dialog" role="dialog" aria-modal="true" aria-labelledby="shop-order-title">
    <h2 id="shop-order-title">收好这份军需</h2><div class="shop-order-product"><div class="hcard shop-order-icon" style="--rc:${QUALITY_COLOR[entry.item.quality]}">${icon(itemIcon(entry.item.id), 42)}</div><div><h3>${esc(entry.item.name)}</h3><p>每份 ${fmt(entry.offer.item.count)} 件 · ${limitText(entry)}</p></div></div>
    <p class="shop-order-desc">${esc(entry.item.desc)}</p><div class="shop-order-label">购买份数</div>
    <div class="seg shop-quantities">${[1, 10].map((quantity) => `<button class="pill" data-act="shop-qty" data-value="${quantity}" aria-pressed="${count === quantity}" ${quantity === 10 && entry.maxCount < 10 ? 'disabled' : ''}>${quantity} 份</button>`).join('')}<button class="pill" data-act="shop-qty" data-value="max" aria-pressed="${count === entry.maxCount && entry.maxCount !== 1 && entry.maxCount !== 10}" ${entry.maxCount < 1 ? 'disabled' : ''}>最大</button></div>
    <div class="panel shop-order-total"><div><span>整单获得</span><b>${esc(entry.item.name)} ×${fmt(entry.offer.item.count * count)}</b></div><div><span>合计 ${count} 份</span><b>${icon(itemIcon(entry.currency.id), 20)}${fmt(total)} ${esc(entry.currency.name)}</b></div><div class="shop-order-balance"><span>当前持有</span><b>${fmt(entry.balance)} ${esc(entry.currency.name)}</b></div></div>
    ${!canBuy && reason ? `<p class="shop-order-reason">${esc(reason)}</p>` : ''}<div class="shop-order-actions"><button class="btn ghost" data-act="shop-close">再看看</button><button class="btn green" data-act="shop-confirm" ${canBuy ? '' : 'disabled'}>确认购买</button></div>
  </div></div>`);
}

export function handleShop(ctx: AppCtx, el: HTMLElement): boolean {
  switch (el.dataset.act) {
    case 'shop-tab': {
      const tab = SHOPS.find((entry) => entry.id === el.dataset.tab);
      if (tab) { closeOrder(ctx); shopState.tab = tab.id; ctx.refresh(); }
      return true;
    }
    case 'shop-open': {
      const entry = listShop(ctx.s, shopState.tab).find((candidate) => candidate.offer.id === el.dataset.id);
      if (!entry) return true;
      if (!entry.available || entry.remaining === 0) { ctx.toast(entry.reason ?? '这份军需暂时不能购买'); return true; }
      order = { offerId: entry.offer.id, count: 1 };
      showOrder(ctx);
      return true;
    }
    case 'shop-qty': {
      const entry = currentEntry(ctx);
      if (!entry || !order) return true;
      const count = el.dataset.value === 'max' ? entry.maxCount : Number(el.dataset.value);
      if (Number.isSafeInteger(count) && count > 0 && (count === 1 || count <= entry.maxCount)) order.count = count;
      showOrder(ctx);
      return true;
    }
    case 'shop-confirm': {
      if (!order) return true;
      const result = buy(ctx.s, order.offerId, order.count);
      if (!result.ok) { showOrder(ctx); ctx.toast(result.reason); return true; }
      const scrollTop = ctx.root.querySelector('.shop-scroll')?.scrollTop ?? 0;
      closeOrder(ctx);
      ctx.save();
      ctx.refresh();
      const scroll = ctx.root.querySelector('.shop-scroll');
      if (scroll) scroll.scrollTop = scrollTop;
      const name = ITEM_BY_ID[result.item.id]?.name ?? result.item.id;
      ctx.toast(`购得${name} ×${fmt(result.item.count)}`);
      floaty(ctx, `${name} ×${fmt(result.item.count)}`, itemIcon(result.item.id), 17, 36);
      floaty(ctx, `−${fmt(result.cost.count)}`, itemIcon(result.cost.item), 43, 43);
      return true;
    }
    case 'shop-close': case 'shop-mask': closeOrder(ctx); return true;
    case 'shop-dialog': return true;
    default: return false;
  }
}
