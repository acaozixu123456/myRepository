// 界面：顶栏、委托条、底栏和各个面板（Preact + htm）。规则在 core/，画面在 world/。
import { h, render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import htm from 'htm';
import * as C from '../core/index.js';
import { SKILLS, CLASSES, MONSTERS, ZONES, ITEMS, ELEMENTS, NPCS, QUESTS } from '../data/index.js';
import { ICON_PATHS } from './icons.js';
import { gearPages, routeHint } from './gearui.js';
import { petPages } from './petui.js';
import { store, subscribe, refresh, save, setState, wipe } from './store.js';

export const html = htm.bind(h);
const ZONE_ICON = ['home', 'sprout', 'drop', 'herb', 'star', 'cloud', 'sparkle', 'gem', 'cloud'];

// ---------- 界面状态 ----------
export const ui = { mode: 'loading', sheet: null, stack: [], lock: false, toast: null, report: null, pickCls: 'cat', busy: true };
export let hooks = {};
export function openSheet(name, { lock = false, push = false } = {}) {
  if (push && ui.sheet) ui.stack.push(ui.sheet); else ui.stack = [];
  ui.sheet = name; ui.lock = lock; refresh();
}
export function closeSheet() { ui.sheet = null; ui.stack = []; ui.lock = false; refresh(); }
export const back = () => { ui.sheet = ui.stack.pop() || null; refresh(); };
let toastTimer = 0;
export function toast(text, sub = '', ms = 2600) { ui.toast = { text, sub, k: Date.now() }; refresh(); clearTimeout(toastTimer); toastTimer = setTimeout(() => { ui.toast = null; refresh(); }, ms); }
export function showReport(title, lines, done) { ui.report = { title, lines, done }; openSheet('report', { lock: true }); }

// ---------- 小部件 ----------
export const Icon = ({ n, s = 22 }) => html`<svg class="ic" width=${s} height=${s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=${ICON_PATHS[n] || ICON_PATHS.star} /></svg>`;
export const Coin = ({ s = 16 }) => html`<svg class="coin" width=${s} height=${s} viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="#f5c64f" stroke="#c99124" stroke-width="2" /><circle cx="12" cy="12" r="5" fill="none" stroke="#e0a832" stroke-width="2" /></svg>`;
// 伙伴头像：进化后的偏一点色，异色的换色并加星光
export const Portrait = ({ id, s = 44, dim, p }) => html`<span class=${'pt' + (dim ? ' dim' : '') + (p?.shiny ? ' shiny' : '') + (p?.evo ? ' evo' + p.evo : '')} style=${`width:${s}px;height:${s}px`}><img src=${`portraits/${id}.png`} alt="" loading="lazy" draggable="false" /></span>`;
export const El = ({ el }) => html`<span class=${'el el-' + el}>${ELEMENTS[el]}</span>`;
export const Bar = ({ v, max, kind, text }) => html`<div class=${'gauge ' + kind}><i style=${`width:${Math.max(0, Math.min(100, v / max * 100))}%`}></i>${text !== false && html`<span>${v}/${max}</span>`}</div>`;
export const Btn = ({ onClick, ghost, disabled, children, cls = '' }) => html`<button type="button" class=${`mini ${ghost ? 'ghost' : ''} ${cls}`} disabled=${disabled} onClick=${onClick}>${children}</button>`;
export const Tabs = ({ tab, set, list }) => html`<div class="tabs">${list.map(([k, label]) => html`<button type="button" class=${tab === k ? 'on' : ''} onClick=${() => set(k)}>${label}</button>`)}</div>`;

// ---------- 顶栏和底栏 ----------
function Hud() {
  const s = store.s, h = s.hero, st = C.heroStats(s), z = C.zoneOf(s);
  return html`<header class="hud">
    <button type="button" class="panel me" onClick=${() => openSheet('hero')}>
      <${Portrait} id=${h.cls} s=${46} />
      <div class="meinfo"><b>${CLASSES[h.cls].name}<small>Lv.${h.lv}</small></b>
        <${Bar} v=${h.hp} max=${st.hp} kind="hp" /><${Bar} v=${h.mp} max=${st.mp} kind="mp" />
        <div class="xp"><i style=${`width:${h.xp / C.xpNeed(h.lv) * 100}%`}></i></div></div>
    </button>
    <div class="hudR">
      <div class="panel where"><small>${z.name}</small><b><${Coin} s=${17} />${s.wallet.gold}</b></div>
      <button type="button" class="panel round" aria-label="地图" onClick=${() => openSheet('map')}><${Icon} n="map" /></button>
    </div>
  </header>`;
}
function questLine(s) {
  const q = C.currentQuest(s);
  if (!q) return ['灯灵', '所有委托都完成了，想去哪就去哪。'];
  if (!s.quests.main.accepted) return ['新委托', `灯灵有事找你：${q.title}`];
  if (C.questDone(s)) return ['可以领奖', `「${q.title}」完成了，点这里领奖励`];
  return ['委托', `${q.title}　${C.questProgressText(s)}`];
}
function QuestChip() {
  const [tag, text] = questLine(store.s), hot = tag !== '委托' && tag !== '灯灵';
  return html`<button type="button" class=${'panel quest' + (hot ? ' hot' : '')} onClick=${() => openSheet('quests')}><${Icon} n="lantern" s=${20} /><div><small>${tag}</small><span>${text}</span></div></button>`;
}
const NAV = [['bag', 'bag', '背包'], ['hero', 'hero', '角色'], ['pets', 'paw', '伙伴'], ['quests', 'scroll', '任务'], ['more', 'more', '更多']];
function Nav() {
  const s = store.s, badge = { hero: routeHint(s) ? '!' : (s.hero.pts + s.hero.sp) || '', bag: s.bag.gear.length || '', quests: !s.quests.main.accepted && C.currentQuest(s) || C.questDone(s) ? '!' : '' };
  return html`<nav class="nav panel">${NAV.map(([k, ic, label]) => html`<button type="button" class=${ui.sheet === k ? 'on' : ''} onClick=${() => (ui.sheet === k ? closeSheet() : openSheet(k))}><${Icon} n=${ic} s=${24} /><span>${label}</span>${badge[k] ? html`<em>${badge[k]}</em>` : null}</button>`)}</nav>`;
}

// ---------- 面板 ----------
export const Head = ({ title, right }) => html`<div class="head">${ui.stack.length ? html`<button type="button" class="hb" aria-label="返回" onClick=${back}><${Icon} n="back" /></button>` : null}<h2>${title}</h2><div class="hr">${right}</div>${!ui.lock ? html`<button type="button" class="hb" aria-label="关闭" onClick=${closeSheet}><${Icon} n="close" /></button>` : null}</div>`;
export const Gold = () => html`<span class="gold"><${Coin} />${store.s.wallet.gold}</span>`;

const pages = {
  ...gearPages,
  ...petPages,
  quests() {
    const s = store.s, q = C.currentQuest(s), m = s.quests.main;
    let card;
    if (!q) card = html`<div class="talk"><b>灯灵</b>「往后这几座岛，你想去哪就去哪。」<small>所有委托都完成了。首领可以反复挑战，伙伴和装备可以继续练。</small></div>`;
    else if (!m.accepted) card = html`<div class="talk"><b>${q.title}</b>${q.text}<small>奖励：${C.rewardText(q.reward)}</small></div><button type="button" class="primary" onClick=${() => { C.acceptQuest(s); save(); closeSheet(); toast(C.questDone(s) ? '已经做到了' : '委托接下了', C.questDone(s) ? '再点一次委托领奖励。' : '点右上角的地图出发。'); }}>接下委托</button>`;
    else if (C.questDone(s)) card = html`<div class="talk"><b>${q.title}</b>${q.done}<small>奖励：${C.rewardText(q.reward)}</small></div><button type="button" class="primary" onClick=${claim}>领取奖励</button>`;
    else card = html`<div class="talk"><b>${q.title}</b>${q.text}<div class="prog"><span>进度</span><b>${C.questProgressText(s)}</b></div><small>奖励：${C.rewardText(q.reward)}</small></div>`;
    const done = C.mainDoneCount(s), ch = q ? q.ch : 5, sides = C.activeSides(s);
    const doneCh = [1, 2, 3, 4, 5].map(c => QUESTS.filter(x => x.ch === c && s.quests.done.includes(x.id))).filter(l => l.length);
    return html`<${Head} title="任务" right=${`主线 ${done}/${QUESTS.length}`} /><div class="scroll"><h3>第 ${ch} 章 · ${C.CHAPTERS[ch - 1]}</h3>${card}
      <h3>支线</h3>${sides.length ? sides.map(({ q: x, ready, prog }) => html`<div class=${'row slim' + (ready ? ' on' : '')}><span class=${'gi z' + ZONES.findIndex(z => z.id === NPCS[x.npc].zone)}><${Icon} n="chat" s=${20} /></span><div class="mid"><b>${x.title}</b><small>${NPCS[x.npc].name}　${ready ? '做到了，回去找它' : prog}</small></div></div>`) : html`<p class="hint">岛上的居民头顶亮着黄光，说明有事找你帮忙。</p>`}
      ${doneCh.length ? html`<h3>已完成</h3>${doneCh.map(l => html`<details class="chap"><summary>第 ${l[0].ch} 章 · ${C.CHAPTERS[l[0].ch - 1]}<small>${l.length}/${QUESTS.filter(x => x.ch === l[0].ch).length}</small></summary>${l.map(x => html`<div class="row slim dim"><span class="gi"><${Icon} n="star" s=${20} /></span><div class="mid"><b>${x.title}</b></div></div>`)}</details>`)}` : null}</div>`;
  },
  more() {
    const go = (k, push = true) => () => openSheet(k, { push });
    const tiles = [['map', 'map', '地图', '去别的岛'], ['craft', 'hammer', '工坊', `打造 Lv.${store.s.craft.lv}`], ['shop', 'shop', '商店', '药、强化石'], ['dex', 'book', '图鉴', `${Object.keys(store.s.world.dex).length}/${Object.keys(MONSTERS).length}`], ['settings', 'settings', '设置', '存档码']];
    return html`<${Head} title="更多" /><div class="tiles">${tiles.map(([k, ic, t, sub]) => html`<button type="button" class="tile" onClick=${go(k)}><${Icon} n=${ic} s=${28} /><b>${t}</b><small>${sub}</small></button>`)}<a class="tile" href="garden.html"><${Icon} n="sprout" s=${28} /><b>旧花园</b><small>以前种的</small></a></div>`;
  },
  map() {
    const s = store.s;
    return html`<${Head} title="地图" /><p class="hint">打败一张地图的首领，下一张地图就会开放。回到小岛会恢复全部体力。</p><div class="scroll">${ZONES.map((z, i) => {
      const locked = i > s.world.unlocked, here = z.id === s.world.zone;
      return html`<button type="button" class=${`row ${here ? 'on' : ''} ${locked ? 'dim' : ''}`} disabled=${locked || here} onClick=${() => { closeSheet(); hooks.goZone(i); }}><span class=${'gi z' + i}><${Icon} n=${ZONE_ICON[i]} s=${24} /></span><div class="mid"><b>${z.name}${z.lv ? html`<small>　Lv.${z.lv[0]}-${z.lv[1]}</small>` : ''}</b><small>${locked ? '还没开放，先打败上一张地图的首领。' : z.desc}${z.boss && s.world.bosses[z.boss] ? ' 首领已打败。' : ''}</small></div>${here ? html`<span class="tag">在这里</span>` : locked ? html`<${Icon} n="lock" s=${18} />` : html`<span class="tag go">前往</span>`}</button>`;
    })}</div>`;
  },
  dex() {
    const s = store.s, ids = Object.keys(MONSTERS), dex = s.world.dex;
    return html`<${Head} title="图鉴" right=${`见过 ${Object.keys(dex).length} · 抓到 ${Object.values(dex).filter(v => v === 'caught').length}`} /><div class="scroll"><div class="dex">${ids.map(id => { const m = MONSTERS[id], st = dex[id];
      return html`<div class=${'dexc' + (st ? '' : ' unknown') + (m.boss ? ' boss' : '')}><${Portrait} id=${id} s=${56} dim=${!st} /><b>${st ? m.name : '？？？'}</b>${st ? html`<${El} el=${m.el} />` : html`<small>没见过</small>`}${st === 'caught' ? html`<i class="caught"><${Icon} n="heart" s=${12} /></i>` : null}</div>`; })}</div></div>`;
  },
  settings() {
    const [code, setCode] = useState(''), [imp, setImp] = useState(''), [sure, setSure] = useState(false);
    return html`<${Head} title="设置" /><div class="scroll">
      <h3>存档码</h3><p class="hint">存档存在这台手机的浏览器里。把存档码复制到备忘录，换手机或数据被清掉时可以导回来。</p>
      <button type="button" class="primary ghost" onClick=${() => { const c = C.exportCode(store.s); setCode(c); navigator.clipboard?.writeText(c).then(() => toast('存档码已复制'), () => {}); }}><${Icon} n="copy" s=${18} /> 生成并复制存档码</button>
      ${code && html`<textarea readonly rows="3" onFocus=${e => e.target.select()}>${code}</textarea>`}
      <h3>导入存档</h3><textarea rows="3" placeholder="把存档码粘贴到这里" value=${imp} onInput=${e => setImp(e.target.value)}></textarea>
      <button type="button" class="primary ghost" disabled=${!imp.trim()} onClick=${() => { const s = C.importCode(imp); if (!s) return toast('存档码不对', '要以 FDQY2: 开头。'); setState(s); location.reload(); }}><${Icon} n="inbox" s=${18} /> 导入，覆盖当前存档</button>
      <h3>重新开始</h3><button type="button" class="reset" onClick=${() => (sure ? wipe() : setSure(true))}>${sure ? '再点一次，确认删除存档' : '删除存档，重新开始'}</button>
    </div>`;
  },
  talk() {
    const s = store.s, t = ui.talk, n = NPCS[t.id];
    // 主线正好要找这个人：它说的就是委托的回话，说到就算完成
    if (!t.lines) { const mq = C.mainTalkNpc(s) === t.id ? C.currentQuest(s) : null; t.lines = mq ? [mq.done] : C.npcLines(s, t.id); if (mq) { C.questProgress(s, 'talk', { npc: t.id }); save(); t.main = true; } }
    const last = t.i >= t.lines.length - 1, f = last ? C.sideFor(s, t.id) : null;
    const bye = () => { closeSheet(); if (t.main) toast('主线委托完成了', '回小岛点石灯，找灯灵领奖励。'); };
    const head = html`<div class="talkhead"><span class=${'gi z' + ZONES.findIndex(z => z.id === n.zone)}><${Icon} n="chat" s=${22} /></span><h2 class="rh">${n.name}</h2></div><div class="talk big">${t.lines[t.i]}</div>`;
    if (!last) return html`${head}<button type="button" class="primary" onClick=${() => { t.i++; refresh(); }}>继续</button>`;
    if (!f) return html`${head}<button type="button" class="primary" onClick=${bye}>再见</button>`;
    const q = f.q, card = html`<div class="talk side"><b><span class="tag">支线</span>${q.title}</b>${q.text}${f.state === 'new' ? null : html`<div class="prog"><span>进度</span><b>${f.prog}</b></div>`}<small>奖励：${C.rewardText(q.reward)}</small></div>`;
    if (f.state === 'new') return html`${head}${card}<div class="duo"><button type="button" class="primary ghost" onClick=${bye}>以后再说</button><button type="button" class="primary" onClick=${() => { C.acceptSide(s, q.id); save(); bye(); toast('接下了支线', q.title); }}>接下</button></div>`;
    if (f.state === 'ready') return html`${head}${card}<button type="button" class="primary" onClick=${() => { const got = C.claimSide(s, q.id); save(); closeSheet(); showReport('支线完成：' + q.title, [{ text: q.done, big: 1 }, ...got.map(text => ({ text }))], null); }}>${q.type === 'collect' ? '交给它' : '完成了'}</button>`;
    return html`${head}${card}<button type="button" class="primary" onClick=${bye}>再见</button>`;
  },
  report() {
    const r = ui.report;
    return html`<h2 class="rh">${r.title}</h2><div class="report">${r.lines.map(l => html`<p class=${(l.big ? 'big' : '') + (l.q >= 3 ? ' q' + l.q : '')}>${l.pet ? html`<${Portrait} id=${l.pet} s=${34} />` : null}${l.text}</p>`)}</div><button type="button" class="primary" onClick=${() => { const f = r.done; ui.report = null; closeSheet(); f && f(); }}>继续</button>`;
  },
  pick() {
    const k = ui.pickCls, c = CLASSES[k];
    return html`<h2 class="rh">选一位旅人</h2><p class="hint">四种职业打法不同，20 级还能转职。之后不能换职业，但可以删档重来。</p>
      <div class="picks">${Object.keys(CLASSES).map(id => html`<button type="button" class=${'pick' + (id === k ? ' on' : '')} onClick=${() => hooks.previewClass(id)}><${Portrait} id=${id} s=${60} /><b>${CLASSES[id].name}</b><${El} el=${CLASSES[id].el} /></button>`)}</div>
      <div class="talk">${c.blurb}<small>技能：${c.skills.map(([, id]) => SKILLS[id].name).join('、')}</small></div>
      <button type="button" class="primary" onClick=${() => hooks.startGame(k)}>就选${c.name}</button>`;
  },
};
const TALL = new Set(['bag', 'hero', 'pets', 'quests', 'map', 'shop', 'dex', 'settings', 'gear', 'craft', 'pet', 'fuse']);

export function useItem(id) {
  const s = store.s, it = ITEMS[id], st = C.heroStats(s), h = s.hero;
  if (it.use === 'hp') {
    const p = C.activePet(s), pst = p && C.petStats(p);
    if (p && p.hp / pst.hp < h.hp / st.hp) { p.hp = Math.min(pst.hp, p.hp + Math.round(pst.hp * it.amount)); toast(`${MONSTERS[p.id].name}恢复了生命。`); }
    else { if (h.hp >= st.hp) return toast('生命是满的。'); h.hp = Math.min(st.hp, h.hp + Math.round(st.hp * it.amount)); }
  } else { if (h.mp >= st.mp) return toast('灵气是满的。'); h.mp = Math.min(st.mp, h.mp + Math.round(st.mp * it.amount)); }
  s.bag.items[id]--; save();
}
function claim() {
  const s = store.s, got = C.claimQuest(s); save();
  showReport('委托完成', got.map(g => ({ text: `得到 ${g}` })), () => { if (C.currentQuest(s)) openSheet('quests'); });
}

function Sheet() {
  const Page = pages[ui.sheet];
  return html`<div class="scrim" onClick=${() => !ui.lock && closeSheet()}></div><section class=${'sheet ' + (TALL.has(ui.sheet) ? 'tall' : 'short')} key=${ui.sheet}><${Page} /></section>`;
}
function Toast() { const t = ui.toast; return html`<div class="toast" key=${t.k}>${t.text}${t.sub ? html`<small>${t.sub}</small>` : null}</div>`; }

function App() {
  const [, setN] = useState(0);
  useEffect(() => subscribe(() => setN(n => n + 1)), []);
  const s = store.s, world = ui.mode === 'world' && s;
  return html`${world && html`<${Hud} />`}${world && !ui.sheet && html`<${QuestChip} />`}${world && html`<${Nav} />`}${ui.sheet && html`<${Sheet} />`}${ui.toast && html`<${Toast} />`}`;
}

export function mountUI(el, h) { hooks = h; render(html`<${App} />`, el); }
export const setMode = m => { ui.mode = m; document.body.dataset.mode = m; refresh(); };
