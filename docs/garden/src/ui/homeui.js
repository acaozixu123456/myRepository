// 家园页：今日（签到、灯火值、悬赏、心情种子）、田地、打工、厨房、心情册。
import { useState, useEffect } from 'preact/hooks';
import * as C from '../core/index.js';
import { HOME, CROPS, DISHES, JOBS, ITEMS } from '../data/index.js';
import { store, save, refresh } from './store.js';
import { html, Icon, Coin, Portrait, Btn, Head, Gold, Tabs, ui, openSheet, toast, showReport } from './app.js';

const dur = ms => { if (ms <= 0) return '熟了'; const m = Math.ceil(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)} 小时 ${m % 60 ? (m % 60) + ' 分' : ''}` : `${m} 分钟`; };
const CropDot = ({ id, s = 22 }) => html`<span class="crop" style=${`--c:${CROPS[id]?.color || '#ccc'};width:${s}px;height:${s}px`}></span>`;
const needText = d => Object.entries(d.need).map(([k, v]) => `${ITEMS[k].name}×${v}`).join(' ');
const buffText = b => Object.entries(b).map(([k, v]) => `${{ hpP: '生命', atkP: '攻击', magP: '法术', def: '防御', spd: '速度', dodge: '闪避', crit: '暴击', healUp: '治疗', gold: '金币', xp: '经验' }[k] || k} +${v}${k.endsWith('P') || ['dodge', 'crit', 'healUp', 'gold', 'xp'].includes(k) ? '%' : ''}`).join('　');

function Today() {
  const s = store.s, d = C.todayOf(s), pts = C.lampPoints(s), D = HOME.daily, [text, setText] = useState('');
  const steps = [[d.greet, '和灯灵打招呼', D.greet], [d.harvest, '收田里的作物或打工产出', D.harvest], [d.bounties.filter(b => b.done).length === 3, `做悬赏 ${d.bounties.filter(b => b.done).length}/3`, D.bounty * 3], [d.pat.length >= D.patNeed, `摸摸 ${Math.min(d.pat.length, D.patNeed)}/${D.patNeed} 只伙伴`, D.pat]];
  return html`
    <div class="lamp"><div class="lamptop"><${Icon} n="lantern" s=${26} /><div class="mid"><b>今天的灯火值 ${pts}/${D.full}</b><small>全做完换一个灯火宝箱。不做也不扣任何东西。</small></div></div>
      <div class="xp big"><i style=${`width:${pts}%`}></i></div>
      ${steps.map(([ok, t, n]) => html`<div class=${'chk' + (ok ? ' ok' : '')}><i>${ok ? '✓' : ''}</i><span>${t}</span><small>+${n}</small></div>`)}
      <div class="duo">
        <button type="button" class="primary ghost" disabled=${d.greet} onClick=${() => { const r = C.greet(s); save(); showReport(`第 ${r.days} 天`, [{ text: '灯灵晃了晃火苗：「今天也来啦。」', big: 1 }, ...r.got.map(text => ({ text }))], null); }}>${d.greet ? `已打招呼 · 第 ${C.home(s).days} 天` : '打招呼'}</button>
        <button type="button" class="primary" disabled=${d.chest || pts < D.full} onClick=${() => { const out = C.lampChest(s); save(); showReport('灯火宝箱', out.map(text => ({ text })), null); }}>${d.chest ? '宝箱已领' : '开灯火宝箱'}</button>
      </div></div>
    <h3>今日悬赏<small>　每天 3 条，可以免费换一次</small></h3>
    ${d.bounties.map((b, i) => { const ready = C.bountyReady(s, b);
      return html`<div class=${'row slim' + (b.done ? ' dim' : ready ? ' on' : '')}><span class="gi"><${Icon} n=${C.bountyDeliver(b) ? 'inbox' : b.type === 'capture' ? 'paw' : 'sword'} s=${20} /></span><div class="mid"><b>${C.bountyText(b)}</b><small>${b.done ? '完成了' : `进度 ${C.bountyProgress(s, b)}`}　奖励 ${b.gold} 金币${b.sand ? '、星砂' : ''}</small></div>
        ${b.done ? null : ready ? html`<${Btn} onClick=${() => { const got = C.claimBounty(s, i); save(); toast('悬赏完成', got.join('、')); }}>${C.bountyDeliver(b) ? '交付' : '领取'}</${Btn}>` : html`<${Btn} ghost disabled=${d.reroll >= 1} onClick=${() => { C.rerollBounty(s, i); save(); }}>换一条</${Btn}>`}</div>`; })}
    <h3>心情种子</h3>
    ${d.mood ? html`<div class="moodcard" style=${`--h:${C.home(s).mood[0].hue}`}><span class="flower"></span><div><b>今天种下了</b><small>「${C.home(s).mood[0].text}」　今天打怪经验 +5%</small></div></div>`
      : html`<p class="hint">写下今天的一句话，它会长成一朵花，颜色由这句话决定。今天打怪经验 +5%。</p><textarea rows="2" maxlength="60" placeholder="今天……" value=${text} onInput=${e => setText(e.target.value)}></textarea>
        <button type="button" class="primary ghost" disabled=${!text.trim()} onClick=${() => { const m = C.plantMood(s, text); if (m) { save(); setText(''); toast('心情花开了', '去心情册里能翻到它。'); } }}><${Icon} n="sprout" s=${18} /> 种下</button>`}`;
}

function Farm() {
  const s = store.s, h = C.home(s), now = Date.now(), [pickAt, setPick] = useState(-1), ripe = h.plots.filter(p => C.plotState(p, now) === 'ripe').length;
  if (pickAt >= 0) return html`<p class="hint">选一种作物种在第 ${pickAt + 1} 块地。种子钱直接扣金币。</p>${Object.values(CROPS).map(c => html`<div class="row slim"><${CropDot} id=${c.id} s=${30} /><div class="mid"><b>${c.name}<small>　${c.hours} 小时</small></b><small>种子 ${c.seed} 金币　卖 ${c.sell}</small></div><${Btn} disabled=${s.wallet.gold < c.seed} onClick=${() => { C.plant(s, pickAt, c.id); save(); setPick(-1); }}>种</${Btn}></div>`)}<button type="button" class="primary ghost" onClick=${() => setPick(-1)}>返回田地</button>`;
  return html`<div class="plots">${h.plots.map((p, i) => { const st = C.plotState(p, now);
      return html`<button type="button" class=${'plot ' + st} onClick=${() => { if (st === 'empty') setPick(i); else if (st === 'ripe') { const r = C.harvest(s, i); save(); toast(`收了 ${ITEMS[r[0]].name} ×${r[1]}`); } else if (C.water(s, i)) { save(); toast('浇了水', '剩下的时间少了四分之一，收成也多一点。'); } else toast(`${CROPS[p.crop].name}还要 ${dur(p.ready - now)}`); }}>
        ${st === 'empty' ? html`<${Icon} n="plus" s=${22} /><small>空地</small>` : html`<${CropDot} id=${p.crop} s=${st === 'ripe' ? 34 : 22} /><small>${CROPS[p.crop].name}</small><em>${st === 'ripe' ? '可以收' : (p.water ? '' : '点一下浇水 · ') + dur(p.ready - now)}</em>`}</button>`; })}</div>
    <div class="duo"><button type="button" class="primary" disabled=${!ripe} onClick=${() => { const got = C.harvestAll(s); save(); toast('收完了', Object.entries(got).map(([k, n]) => `${ITEMS[k].name}×${n}`).join('、')); }}>全部收获${ripe ? ` ${ripe}` : ''}</button>
      <button type="button" class="primary ghost" disabled=${h.plots.length >= HOME.plotsMax || s.wallet.gold < C.plotCost(s)} onClick=${() => { if (C.buyPlot(s)) { save(); toast('多了一块地'); } }}>${h.plots.length >= HOME.plotsMax ? '地已经最多了' : html`开一块地 <${Coin} s=${14} />${C.plotCost(s)}`}</button></div>
    <p class="hint">作物按真实时间长，关掉游戏也在长。种下后点一下浇水，熟得更快。</p>`;
}

function Work() {
  const s = store.s, now = Date.now(), ws = C.workers(s), [sel, setSel] = useState(null);
  const free = s.pets.filter(p => !s.party.includes(p.uid) && !C.home(s).jobs[p.uid]);
  if (sel) return html`<p class="hint">派${sel.name}去做什么？性格喜欢的工作产出多一半。</p>${Object.entries(JOBS).map(([k, j]) => html`<div class="row slim"><span class="gi"><${Icon} n=${j.icon} s=${20} /></span><div class="mid"><b>${j.name}${C.likesJob(sel.p, k) ? html`<small class="like">　喜欢</small>` : ''}</b><small>${j.desc}</small></div><${Btn} onClick=${() => { C.assign(s, sel.p.uid, k); save(); setSel(null); }}>派去</${Btn}></div>`)}<button type="button" class="primary ghost" onClick=${() => setSel(null)}>返回</button>`;
  return html`<p class="hint">不在出战位的伙伴可以打工，最多 ${HOME.workers} 只。离线也算，每只最多攒 ${HOME.workCapH} 小时。</p>
    ${ws.length ? ws.map(w => html`<div class="row slim"><${Portrait} id=${w.p.id} s=${40} p=${w.p} /><div class="mid"><b>${C.petName(w.p)}<small>　${JOBS[w.job].name}${C.likesJob(w.p, w.job) ? ' · 喜欢' : ''}</small></b><small>攒了 ${C.workHours(w, now)} 小时${C.workHours(w, now) >= HOME.workCapH ? '（满了）' : ''}</small></div><${Btn} ghost onClick=${() => { C.unassign(s, w.p.uid); save(); }}>叫回来</${Btn}></div>`) : html`<p class="hint">还没有伙伴在打工。</p>`}
    <button type="button" class="primary" disabled=${!ws.some(w => C.workHours(w, now) > 0)} onClick=${() => { const out = C.collectWork(s); save(); showReport('打工的收获', Object.entries(out).map(([k, n]) => ({ text: k === 'gold' ? `${n} 金币` : k === 'gem' ? `灵石 ×${n}` : `${ITEMS[k].name} ×${n}` })), null); }}>收打工产出</button>
    ${ws.length < HOME.workers && free.length ? html`<h3>可以派的伙伴</h3>${free.map(p => html`<div class="row slim"><${Portrait} id=${p.id} s=${40} p=${p} /><div class="mid"><b>${C.petName(p)}<small>　Lv.${p.lv}</small></b><small>擅长${JOBS[Object.keys(JOBS).find(k => C.likesJob(p, k))]?.name || '—'}</small></div><${Btn} onClick=${() => setSel({ p, name: C.petName(p) })}>派去打工</${Btn}></div>`)}` : null}`;
}

function Kitchen() {
  const s = store.s, b = C.activeBuff(s), have = Object.keys(DISHES).filter(id => s.bag.items[id] > 0);
  return html`${b ? html`<div class="moodcard buff"><span class="gi"><${Icon} n="heart" s=${20} /></span><div><b>吃了${DISHES[b.id].name}</b><small>${buffText(DISHES[b.id].buff)}　还剩 ${dur(b.until - Date.now())}</small></div></div>` : html`<p class="hint">出门前吃一份料理，30 分钟内有加成。料理也是伙伴最喜欢的礼物，在伙伴页可以送。</p>`}
    ${have.length ? html`<h3>做好的</h3>${have.map(id => html`<div class="row slim"><span class="gi item-dish"><${Icon} n="heart" s=${20} /></span><div class="mid"><b>${DISHES[id].name}<small>　×${s.bag.items[id]}</small></b><small>${buffText(DISHES[id].buff)}</small></div><${Btn} onClick=${() => { C.eat(s, id); save(); toast(`吃了${DISHES[id].name}`, buffText(DISHES[id].buff)); }}>吃</${Btn}><${Btn} ghost onClick=${() => { ui.giftDish = id; openSheet('gift', { push: true }); }}>送</${Btn}></div>`)}` : null}
    <h3>菜谱</h3>${Object.values(DISHES).map(d => { const ok = C.canCook(s, d.id);
      return html`<div class=${'row slim' + (ok ? '' : ' dim')}><span class="gi item-dish"><${Icon} n="heart" s=${20} /></span><div class="mid"><b>${d.name}</b><small>${needText(d)}　·　${buffText(d.buff)}</small></div><${Btn} disabled=${!ok} onClick=${() => { C.cook(s, d.id); save(); toast(`做好了${d.name}`); }}>做</${Btn}></div>`; })}`;
}

function Mood() {
  const list = C.home(store.s).mood;
  return list.length ? html`<div class="moods">${list.map(m => html`<div class="moodcard" style=${`--h:${m.hue}`}><span class="flower"></span><div><b>${m.date}</b><small>「${m.text}」</small></div></div>`)}</div>` : html`<p class="hint">还没有种过心情种子。在「今日」里写下一句话就能种。</p>`;
}

const TABS = [['today', '今日'], ['farm', '田地'], ['work', '打工'], ['kitchen', '厨房'], ['mood', '心情册']];
export const homePages = {
  home() {
    const [tab, setTab] = useState(ui.homeTab || 'today'), set = t => { ui.homeTab = t; setTab(t); };
    useEffect(() => { const t = setInterval(refresh, 30000); return () => clearInterval(t); }, []);
    const Body = { today: Today, farm: Farm, work: Work, kitchen: Kitchen, mood: Mood }[tab];
    return html`<${Head} title="家园" right=${html`<${Gold} />`} /><${Tabs} tab=${tab} set=${set} list=${TABS} /><div class="scroll" key=${tab}><${Body} /></div>`;
  },
  gift() {
    const s = store.s, id = ui.giftDish, d = DISHES[id];
    return html`<${Head} title=${`送${d.name}`} /><div class="scroll"><p class="hint">每只伙伴最爱吃的不一样，送最爱吃的亲密度翻倍。还有 ${s.bag.items[id] || 0} 份。</p>
      ${s.pets.map(p => html`<div class="row slim"><${Portrait} id=${p.id} s=${40} p=${p} /><div class="mid"><b>${C.petName(p)}<small>　亲密度 ${C.loveLv(p)}</small></b></div><${Btn} disabled=${!(s.bag.items[id] > 0)} onClick=${() => { const r = C.gift(s, p.uid, id); if (r) { save(); toast(r.fav ? `${C.petName(p)}最爱吃这个！` : `${C.petName(p)}吃得很开心`, r.up ? `亲密度升到 ${r.lv} 级` : ''); } else toast('亲密度已经满了'); }}>送</${Btn}></div>`)}</div>`;
  },
};
// 首页提示：今天还有没领的灯火宝箱、熟了的作物
export const homeBadge = s => { const d = C.todayOf(s), now = Date.now(); return (!d.greet || (!d.chest && C.lampPoints(s) >= HOME.daily.full) || C.home(s).plots.some(p => C.plotState(p, now) === 'ripe')) ? '!' : ''; };
