// 充值中心：月光珠档位 / 月卡 / 至尊自选礼包 / VIP。原型阶段为「模拟支付」：确认后直接到账，界面上明确标注。
import { PREMIUM_HEROES } from '../../data/heroes';
import {
  MONTH_CARD, MOON_PER_YUAN, SP_PACK, TOPUPS, VIP_STEPS, buyCard, buySpPack, canClaimCard, canClaimVip, cardDaysLeft, claimCard, claimVip,
  ensurePay, topUp, vipLevel, vipPerks, vipProgress,
} from '../../game/premium';
import { MOON_OFFERS, buyMoon, leftOf, moonDiscount, priceOf, weeklyLimit } from '../../game/moonshop';
import { artUrl } from '../../ui/art';
import { gachaState } from './gacha';
import { esc } from '../../ui/components';
import { icon } from '../../ui/icons';
import type { AppCtx } from '../ctx';
import { sfx } from '../sfx';
import { floaty } from './home';

const full = (n: number) => Math.floor(n).toLocaleString('en-US');
const moonChip = (n: number) => `<span class="chip">${icon('moon', 20)}<b class="num">${full(n)}</b></span>`;
export const payState = { pick: PREMIUM_HEROES[0]?.id ?? '' };

export function payHtml(ctx: AppCtx): string {
  const s = ctx.s;
  const p = ensurePay(s);
  const vp = vipProgress(s);
  const perks = vipPerks(vp.level);
  const nextPerks = vp.next ? vipPerks(vp.next) : null;
  const pct = vp.next ? Math.min(100, ((vp.have - VIP_STEPS[vp.level]) / (VIP_STEPS[vp.next] - VIP_STEPS[vp.level])) * 100) : 100;
  const days = cardDaysLeft(s);
  const cardReady = canClaimCard(s);
  const vipReady = canClaimVip(s);
  const packBought = p.grants.includes(SP_PACK.id);
  return `<div class="hud"><button class="btn sm ghost shop-back" data-act="nav" data-to="home">返回</button><div class="title" style="color:#fff6dc;text-shadow:0 2px 0 rgba(0,0,0,.3)">充值中心</div><div class="grow"></div>${moonChip(s.res.moon)}</div>
  <div class="scroll pay-scroll">
    <section class="panel pay-vip">
      <div class="vip-head"><span class="vip-badge">${icon('crown', 30)}<b>VIP ${vp.level}</b></span>
        <div class="grow"><div class="bar"><i style="width:${pct}%"></i></div>
        <small>${vp.next ? `再充值 ¥${full(VIP_STEPS[vp.next] - vp.have)} 升到 VIP ${vp.next}` : '已达 VIP 最高等级'} · 累计 ¥${full(vp.have)}</small></div></div>
      <ul class="vip-perks">
        <li>${icon('fish', 16)}挂机收益 <b>+${Math.round(perks.idleRate * 100)}%</b>${nextPerks ? `<em>→ ${Math.round(nextPerks.idleRate * 100)}%</em>` : ''}</li>
        <li>${icon('spark', 16)}挂机上限 <b>+${perks.idleCapHours} 小时</b>${nextPerks ? `<em>→ ${nextPerks.idleCapHours}</em>` : ''}</li>
        <li>${icon('moon', 16)}每日福利 <b>${perks.dailyMoon} 月光珠 + ${perks.dailyBells} 金铃铛</b></li>
        <li>${icon('recruit', 16)}至尊招募 <b>${perks.spDiscount ? `${Math.round(perks.spDiscount * 100)}% 折扣` : 'VIP 8 起享 5% 折扣'}</b></li>
      </ul>
      <div class="row" style="gap:8px;margin-top:8px"><button class="btn sm ${vipReady ? 'green' : 'ghost'}" data-act="pay-vip" ${vipReady ? '' : 'disabled'}>${vp.level === 0 ? '充值后解锁每日福利' : vipReady ? '领取 VIP 每日福利' : '今日已领取'}</button>
      <button class="btn sm blue" data-act="pay-sp">去至尊招募</button></div>
    </section>

    <section class="panel pay-card">
      <div class="row"><div class="grow"><h3>${icon('calendar', 22)} 喵喵月卡 <small>¥${MONTH_CARD.yuan}</small></h3>
        <p>立得 <b>${MONTH_CARD.instant}</b> 月光珠，之后 ${MONTH_CARD.days} 天每天领 <b>${MONTH_CARD.daily}</b> 月光珠 + ${MONTH_CARD.bells} 金铃铛。<br>${days ? `剩余 <b>${days}</b> 天` : '未开通'}</p></div>
        <div class="col"><button class="btn sm pink" data-act="pay-buy" data-kind="card">${days ? '续费' : '开通'} ¥${MONTH_CARD.yuan}</button>
        <button class="btn sm ${cardReady ? 'green' : 'ghost'}" data-act="pay-card" ${cardReady ? '' : 'disabled'}>${cardReady ? '领今日' : days ? '已领取' : '—'}</button></div></div>
    </section>

    <section class="panel pay-pack">
      <h3>${icon('gift', 22)} 至尊自选礼包 <small>¥${SP_PACK.yuan} · 限购 1 次</small></h3>
      <p>任选一只至尊猫猫，另送 <b>${full(SP_PACK.bells)}</b> 金铃铛、<b>${SP_PACK.tickets}</b> 张招福符。</p>
      <div class="pack-pick">${PREMIUM_HEROES.map((h) => `<button class="pick ${payState.pick === h.id ? 'on' : ''}" data-act="pay-pick" data-id="${h.id}"><img src="${artUrl(h.id, 'head')}" alt="${esc(h.name)}"><b>${esc(h.name)}</b><small>${h.role}</small></button>`).join('')}</div>
      <button class="btn sm ${packBought ? 'ghost' : 'pink'}" data-act="pay-buy" data-kind="pack" ${packBought ? 'disabled' : ''}>${packBought ? '已购买' : `购买 ¥${SP_PACK.yuan}`}</button>
    </section>

    <section class="panel">
      <h3>${icon('moon', 22)} 月光珠 <small>¥1 = ${MOON_PER_YUAN} 月光珠</small></h3>
      <div class="tiers">${TOPUPS.map((t) => { const first = !p.first.includes(t.id); return `<button class="tier" data-act="pay-buy" data-kind="tier" data-id="${t.id}">
        ${t.tag ? `<span class="tg">${t.tag}</span>` : ''}${first ? `<span class="dbl">首充双倍</span>` : ''}
        ${icon('moon', 40)}<b class="num">${full(t.moon)}</b><small>${t.bonus ? `+${full(t.bonus)} 赠送` : '基础档'}${first ? ` · 首次再送 ${full(t.moon)}` : ''}</small><em>¥${t.yuan}</em></button>`; }).join('')}</div>
    </section>

    <section class="panel">
      <h3>${icon('gift', 22)} 月光珠商铺 <small>${moonDiscount(vp.level) ? `VIP${vp.level} 享 ${Math.round(moonDiscount(vp.level) * 100)}% 折扣` : 'VIP5 起折扣，VIP3 起限购 +1'}</small></h3>
      <p>用月光珠兑换养成大件，每周刷新限购。VIP 越高越便宜、能买得越多。</p>
      ${MOON_OFFERS.map((o) => { const left = leftOf(s, o); const price = priceOf(o, vp.level); return `<div class="ms-row"><div class="grow"><b>${o.label}</b><small>本周剩 ${left} / ${weeklyLimit(o, vp.level)}${price !== o.price ? ` · 原价 ${o.price}` : ''}</small></div><button class="btn sm ${left > 0 && (s.res.moon ?? 0) >= price ? 'pink' : 'ghost'}" data-act="pay-moonbuy" data-id="${o.id}" ${left > 0 ? '' : 'disabled'}>${icon('moon', 14)} ${price}</button></div>`; }).join('')}
    </section>

    <section class="panel pay-note">
      <b>演示版说明</b>：当前版本没有接入真实支付渠道，「充值」为模拟下单，确认后月光珠直接到账、不会产生任何实际扣费。正式上线时将替换为应用商店 / 支付平台的内购回调。
      ${p.orders.length ? `<details><summary>最近订单（${p.orders.length}）</summary>${p.orders.slice(0, 8).map((o) => `<div class="ord"><span>${new Date(o.t).toLocaleString()}</span><span>${esc(o.id)}</span><b>¥${full(o.yuan)}${o.moon ? ` → ${full(o.moon)}珠` : ''}</b></div>`).join('')}</details>` : ''}
    </section>
  </div>`;
}

function confirm(ctx: AppCtx, title: string, desc: string, act: string, data: Record<string, string>) {
  ctx.root.querySelectorAll('.mask.center').forEach((m) => m.remove());
  ctx.root.insertAdjacentHTML('beforeend', `<div class="mask center" data-act="closedialog"><div class="dialog" style="text-align:center">
    <h3 class="title" style="margin:0 0 6px">${title}</h3><p style="font-size:13.5px;line-height:1.7;font-weight:700;margin:0 0 4px">${desc}</p>
    <p class="muted" style="font-size:11.5px;margin:0 0 12px">模拟支付：确认后直接到账，不会产生真实扣费。</p>
    <div class="row" style="justify-content:center;gap:10px"><button class="btn ghost" data-act="closedialog">取消</button><button class="btn pink" data-act="${act}" ${Object.entries(data).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ')}>确认支付</button></div></div></div>`);
}

export function handlePay(ctx: AppCtx, act: string, el: HTMLElement): boolean {
  const s = ctx.s;
  switch (act) {
    case 'pay-pick': payState.pick = el.dataset.id!; ctx.refresh(); return true;
    case 'pay-sp': gachaState.pool = 'sp'; ctx.go('gacha'); return true;
    case 'pay-buy': {
      const kind = el.dataset.kind;
      if (kind === 'tier') { const t = TOPUPS.find((x) => x.id === el.dataset.id)!; confirm(ctx, `充值 ¥${t.yuan}`, `获得 ${full(t.moon + t.bonus)} 月光珠${!ensurePay(s).first.includes(t.id) ? `，首次再送 ${full(t.moon)}` : ''}`, 'pay-ok', { kind: 'tier', id: t.id }); }
      else if (kind === 'card') confirm(ctx, `开通月卡 ¥${MONTH_CARD.yuan}`, `立得 ${MONTH_CARD.instant} 月光珠，${MONTH_CARD.days} 天内每日 ${MONTH_CARD.daily} 月光珠 + ${MONTH_CARD.bells} 金铃铛`, 'pay-ok', { kind: 'card' });
      else confirm(ctx, `至尊自选礼包 ¥${SP_PACK.yuan}`, `获得 ${esc(PREMIUM_HEROES.find((h) => h.id === payState.pick)?.name ?? '')} + ${full(SP_PACK.bells)} 金铃铛 + ${SP_PACK.tickets} 招福符`, 'pay-ok', { kind: 'pack', id: payState.pick });
      return true;
    }
    case 'pay-ok': {
      ctx.root.querySelectorAll('.mask.center').forEach((m) => m.remove());
      const kind = el.dataset.kind;
      let msg = '';
      if (kind === 'tier') { const r = topUp(s, el.dataset.id!); if (r.ok) msg = `到账 ${full(r.moon)} 月光珠${r.first ? '（含首充双倍）' : ''}`; else msg = r.reason; }
      else if (kind === 'card') { const r = buyCard(s); msg = r.ok ? `月卡已开通，到账 ${r.moon} 月光珠` : r.reason; }
      else { const r = buySpPack(s, el.dataset.id!); msg = r.ok && r.result ? `获得至尊猫猫「${r.result.hero.name}」！` : !r.ok ? r.reason : ''; }
      sfx.coin(); ctx.save(); ctx.refresh(); ctx.toast(msg); floaty(ctx, '+', 'moon', 50, 20);
      return true;
    }
    case 'pay-moonbuy': { const r = buyMoon(s, el.dataset.id!); if (r.ok) { sfx.coin(); ctx.save(); ctx.toast(`兑换了 ${r.label}，花费 ${r.paid} 月光珠`); } else ctx.toast(r.reason); ctx.refresh(); return true; }
    case 'pay-card': { const g = claimCard(s); if (g) { ctx.toast(`领取 ${g.moon} 月光珠、${g.bells} 金铃铛`); sfx.coin(); } ctx.save(); ctx.refresh(); return true; }
    case 'pay-vip': { const g = claimVip(s); if (g) { ctx.toast(`VIP ${vipLevel(s)} 福利：${g.moon} 月光珠、${g.bells} 金铃铛`); sfx.coin(); } ctx.save(); ctx.refresh(); return true; }
  }
  return false;
}

export const PAY_CSS = `
.pay-scroll{display:flex;flex-direction:column;gap:12px;padding:6px 10px 20px}
.pay-scroll .panel h3{display:flex;align-items:center;gap:6px}
.pay-scroll .panel h3 small{font-family:var(--f-b);font-size:12px;color:var(--ink-2);font-weight:700;margin-left:4px}
.pay-scroll p{margin:0 0 6px;font-size:12.5px;line-height:1.65;font-weight:700;color:var(--ink-2)}
.pay-vip{background:linear-gradient(#fff6d8,#ffe7a8)}
.vip-head{display:flex;gap:10px;align-items:center}
.vip-badge{display:flex;align-items:center;gap:4px;padding:3px 12px 3px 6px;border-radius:999px;background:linear-gradient(#5b3d8a,#3a2560);color:#ffe27a;font-family:var(--f-d);font-size:18px;box-shadow:0 2px 0 rgba(0,0,0,.3)}
.vip-head small{display:block;margin-top:3px;font-size:11.5px;font-weight:700;color:var(--ink-2)}
.vip-perks{list-style:none;margin:8px 0 0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:5px 10px;font-size:12px;font-weight:700}
.vip-perks li{display:flex;align-items:center;gap:4px;flex-wrap:wrap}.vip-perks em{color:var(--green-d);font-style:normal}
.pay-card .col{display:flex;flex-direction:column;gap:6px}
.pack-pick{display:flex;gap:8px;margin:6px 0 8px}
.pack-pick .pick{flex:1;display:flex;flex-direction:column;align-items:center;padding:6px 2px 6px;border-radius:14px;background:var(--paper-2);box-shadow:inset 0 0 0 2px var(--paper-line)}
.pack-pick .pick img{width:62px;height:62px;object-fit:contain}.pack-pick .pick b{font-family:var(--f-d);font-weight:400;font-size:13px}.pack-pick .pick small{font-size:11px;color:var(--ink-2);font-weight:700}
.pack-pick .pick.on{background:linear-gradient(#fff3c4,#ffd0ee);box-shadow:inset 0 0 0 3px #ff6ad0,0 0 12px rgba(255,106,208,.6)}
.tiers{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
.tier{position:relative;display:flex;flex-direction:column;align-items:center;gap:1px;padding:14px 4px 8px;border-radius:16px;background:linear-gradient(#eaf6ff,#c8e4fa);box-shadow:0 3px 0 #8fb6d8,inset 0 0 0 2px #fff}
.tier:active{transform:translateY(2px)}
.tier b{font-family:var(--f-d);font-weight:400;font-size:19px;color:#2f4f78}.tier small{font-size:10px;line-height:1.3;font-weight:700;color:var(--ink-2);text-align:center;min-height:26px}
.tier em{font-style:normal;font-family:var(--f-d);font-size:15px;color:#fff;background:var(--pink);padding:1px 14px 2px;border-radius:999px;box-shadow:0 2px 0 var(--pink-d)}
.tier .tg{position:absolute;right:-3px;top:-4px;background:var(--red);color:#fff;font-size:10px;font-weight:800;padding:0 7px;border-radius:999px}
.tier .dbl{position:absolute;left:4px;top:3px;background:linear-gradient(90deg,#ffe27a,#ff9ad8);color:#5a1038;font-size:9.5px;font-weight:800;padding:0 6px;border-radius:999px}
.ms-row{display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px dashed var(--paper-line)}.ms-row:last-child{border:0}.ms-row b{font-family:var(--f-d);font-weight:400;font-size:14px;display:block}.ms-row small{display:block;font-size:11px;font-weight:700;color:var(--ink-2)}
.pay-note{font-size:11.5px;line-height:1.7;color:var(--ink-2);font-weight:700}
.pay-note details{margin-top:6px}.pay-note .ord{display:flex;justify-content:space-between;gap:6px;font-size:11px;padding:2px 0;border-bottom:1px dashed var(--paper-line)}
`;
