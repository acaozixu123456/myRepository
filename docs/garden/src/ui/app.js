// 界面：顶栏、委托条、底栏和各个面板（Preact + htm）。规则在 core/，画面在 world/。
import { h, render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import htm from 'htm';
import * as C from '../core/index.js';
import { SKILLS, CLASSES, MONSTERS, ZONES, ITEMS, ELEMENTS, ATTR_NAME, ATTR_DESC, GEAR_SLOTS, GEAR_SLOT_ICON } from '../data/index.js';
import { ICON_PATHS } from './icons.js';
import { store, subscribe, refresh, save, setState, wipe } from './store.js';

export const html = htm.bind(h);
const ST_NAME = { atk: '攻击', mag: '法术', def: '防御', hp: '生命', spd: '速度', mp: '灵气' };
const RARE = ['普通', '精良', '稀有', '珍品'];
const ZONE_ICON = ['home', 'sprout', 'drop', 'herb', 'star'];

// ---------- 界面状态 ----------
export const ui = { mode: 'loading', sheet: null, stack: [], lock: false, toast: null, report: null, pickCls: 'cat', busy: true };
let hooks = {};
export function openSheet(name, { lock = false, push = false } = {}) {
  if (push && ui.sheet) ui.stack.push(ui.sheet); else ui.stack = [];
  ui.sheet = name; ui.lock = lock; refresh();
}
export function closeSheet() { ui.sheet = null; ui.stack = []; ui.lock = false; refresh(); }
const back = () => { ui.sheet = ui.stack.pop() || null; refresh(); };
let toastTimer = 0;
export function toast(text, sub = '', ms = 2600) { ui.toast = { text, sub, k: Date.now() }; refresh(); clearTimeout(toastTimer); toastTimer = setTimeout(() => { ui.toast = null; refresh(); }, ms); }
export function showReport(title, lines, done) { ui.report = { title, lines, done }; openSheet('report', { lock: true }); }

// ---------- 小部件 ----------
export const Icon = ({ n, s = 22 }) => html`<svg class="ic" width=${s} height=${s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=${ICON_PATHS[n] || ICON_PATHS.star} /></svg>`;
export const Coin = ({ s = 16 }) => html`<svg class="coin" width=${s} height=${s} viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="#f5c64f" stroke="#c99124" stroke-width="2" /><circle cx="12" cy="12" r="5" fill="none" stroke="#e0a832" stroke-width="2" /></svg>`;
const Portrait = ({ id, s = 44, dim }) => html`<span class=${'pt' + (dim ? ' dim' : '')} style=${`width:${s}px;height:${s}px`}><img src=${`portraits/${id}.png`} alt="" loading="lazy" draggable="false" /></span>`;
const El = ({ el }) => html`<span class=${'el el-' + el}>${ELEMENTS[el]}</span>`;
const Bar = ({ v, max, kind, text }) => html`<div class=${'gauge ' + kind}><i style=${`width:${Math.max(0, Math.min(100, v / max * 100))}%`}></i>${text !== false && html`<span>${v}/${max}</span>`}</div>`;
const Btn = ({ onClick, ghost, disabled, children, cls = '' }) => html`<button type="button" class=${`mini ${ghost ? 'ghost' : ''} ${cls}`} disabled=${disabled} onClick=${onClick}>${children}</button>`;
const gearText = g => Object.entries(g.st).map(([k, v]) => `${ST_NAME[k]}+${v}`).join(' ');
const gearName = g => `${g.name}${g.plus ? ' +' + g.plus : ''}`;
const GearIcon = ({ g, slot }) => html`<span class=${'gi r' + (g ? g.rare : 'x')}><${Icon} n=${GEAR_SLOT_ICON[g ? g.slot : slot]} s=${24} /></span>`;
const ItemIcon = ({ id }) => html`<span class=${'gi item-' + id}><${Icon} n=${ITEMS[id].icon} s=${24} /></span>`;

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
  const s = store.s, badge = { hero: s.hero.pts || '', bag: s.bag.gear.length || '', quests: !s.quests.main.accepted && C.currentQuest(s) || C.questDone(s) ? '!' : '' };
  return html`<nav class="nav panel">${NAV.map(([k, ic, label]) => html`<button type="button" class=${ui.sheet === k ? 'on' : ''} onClick=${() => (ui.sheet === k ? closeSheet() : openSheet(k))}><${Icon} n=${ic} s=${24} /><span>${label}</span>${badge[k] ? html`<em>${badge[k]}</em>` : null}</button>`)}</nav>`;
}

// ---------- 面板 ----------
const Head = ({ title, right }) => html`<div class="head">${ui.stack.length ? html`<button type="button" class="hb" aria-label="返回" onClick=${back}><${Icon} n="back" /></button>` : null}<h2>${title}</h2><div class="hr">${right}</div>${!ui.lock ? html`<button type="button" class="hb" aria-label="关闭" onClick=${closeSheet}><${Icon} n="close" /></button>` : null}</div>`;
const Gold = () => html`<span class="gold"><${Coin} />${store.s.wallet.gold}</span>`;

const pages = {
  bag() {
    const s = store.s, [tab, setTab] = useState('gear');
    const gear = s.bag.gear.map((g, i) => {
      const cur = s.hero.gear[g.slot], d = C.gearScore(g) - C.gearScore(cur);
      return html`<div class=${'row r' + g.rare}><${GearIcon} g=${g} /><div class="mid"><b>${gearName(g)}</b><small>${GEAR_SLOTS[g.slot]} · ${RARE[g.rare]}　${gearText(g)}</small><small class=${d > 0 ? 'up' : d < 0 ? 'down' : ''}>${d > 0 ? '比身上的好' : d < 0 ? '不如身上的' : '和身上的差不多'}</small></div>
        <div class="acts"><${Btn} onClick=${() => { C.equip(s, i); save(); }}>装备</${Btn}><${Btn} ghost onClick=${() => { C.sell(s, i); save(); }}>卖 ${Math.round(g.price / 2)}</${Btn}></div></div>`;
    });
    const items = Object.keys(ITEMS).map(id => { const it = ITEMS[id], n = s.bag.items[id] || 0;
      return html`<div class="row"><${ItemIcon} id=${id} /><div class="mid"><b>${it.name}<small> ×${n}</small></b><small>${it.desc}</small></div>${it.use !== 'capture' ? html`<${Btn} disabled=${!n} onClick=${() => useItem(id)}>使用</${Btn}>` : null}</div>`; });
    return html`<${Head} title="背包" right=${html`<${Gold} />`} />
      <div class="tabs"><button type="button" class=${tab === 'gear' ? 'on' : ''} onClick=${() => setTab('gear')}>装备 ${s.bag.gear.length || ''}</button><button type="button" class=${tab === 'items' ? 'on' : ''} onClick=${() => setTab('items')}>道具</button></div>
      <div class="scroll">${tab === 'gear' ? (gear.length ? gear : html`<p class="hint">还没有多余的装备。打怪有机会掉落，首领一定会掉。</p>`) : items}</div>`;
  },
  hero() {
    const s = store.s, h = s.hero, st = C.heroStats(s), c = CLASSES[h.cls];
    return html`<${Head} title="角色" right=${html`<${Gold} />`} />
      <div class="scroll">
        <div class="herohead"><${Portrait} id=${h.cls} s=${64} /><div><b>${c.name}　Lv.${h.lv}</b><small>${c.blurb}</small><div class="xp big"><i style=${`width:${h.xp / C.xpNeed(h.lv) * 100}%`}></i></div><small>经验 ${h.xp}/${C.xpNeed(h.lv)} · 已打败 ${s.stats.kills} 只野怪</small></div></div>
        <div class="stats">${['hp', 'mp', 'atk', 'mag', 'def', 'spd'].map(k => html`<div class="stat">${ST_NAME[k]}<b>${st[k]}</b></div>`)}</div>
        <h3>属性点 · 剩 ${h.pts} 点</h3>
        ${Object.keys(ATTR_NAME).map(k => html`<div class="row slim"><div class="mid"><b>${ATTR_NAME[k]}　${Math.floor(h.attr[k])}</b><small>${ATTR_DESC[k]}</small></div><${Btn} disabled=${h.pts <= 0} onClick=${() => { C.spendPoint(s, k); save(); }}>+1</${Btn}></div>`)}
        <h3>装备</h3>
        ${Object.keys(GEAR_SLOTS).map(k => { const g = h.gear[k];
          if (!g) return html`<div class="row slim dim"><${GearIcon} slot=${k} /><div class="mid"><b>${GEAR_SLOTS[k]}</b><small>空着</small></div></div>`;
          const cost = C.enhanceCost(g), max = (g.plus || 0) >= C.MAX_PLUS;
          return html`<div class=${'row slim r' + g.rare}><${GearIcon} g=${g} /><div class="mid"><b>${gearName(g)}</b><small>${GEAR_SLOTS[k]}　${gearText(g)}</small></div><${Btn} disabled=${max || s.wallet.gold < cost} onClick=${() => { if (C.enhance(s, k)) save(); }}>${max ? '已满级' : html`强化 <${Coin} s=${12} />${cost}`}</${Btn}></div>`; })}
        <h3>技能</h3>
        ${c.skills.map(([lv, id]) => { const k = SKILLS[id], has = h.lv >= lv; return html`<div class=${'row slim' + (has ? '' : ' dim')}><span class="gi"><${Icon} n="sparkle" s=${22} /></span><div class="mid"><b>${k.name}<small>　灵气 ${k.mp}</small></b><small>${has ? k.desc : `${lv} 级学会。${k.desc}`}</small></div></div>`; })}
      </div>`;
  },
  pets() {
    const s = store.s;
    if (!s.pets.length) return html`<${Head} title="伙伴" right=${`0/${C.PARTY_MAX}`} /><div class="talk">你还没有伙伴。<small>战斗里把野怪打到虚弱，再用「捕捉」丢出灵种，它就可能跟你走。血越少越容易成功，首领抓不了。</small></div>`;
    return html`<${Head} title="伙伴" right=${`${s.pets.length}/${C.PARTY_MAX}`} />
      <p class="hint">出战的伙伴会跟着你一起战斗、一起升级。</p>
      <div class="scroll">${s.pets.map(p => { const m = MONSTERS[p.id], st = C.petStats(p), on = s.party[0] === p.uid;
        return html`<div class=${'row' + (on ? ' on' : '')}><${Portrait} id=${p.id} s=${52} /><div class="mid"><b>${m.name}<small>　Lv.${p.lv}</small> <${El} el=${m.el} /></b><${Bar} v=${p.hp} max=${st.hp} kind="hp" /><small>攻击 ${st.atk} · 防御 ${st.def} · 速度 ${st.spd}${m.skill ? ` · 技能 ${SKILLS[m.skill].name}` : ''}</small></div>
          <div class="acts">${on ? html`<${Btn} ghost onClick=${() => setActive(null)}>休息</${Btn}>` : html`<${Btn} onClick=${() => setActive(p.uid)}>出战</${Btn}>`}<${FreeBtn} p=${p} /></div></div>`; })}</div>`;
  },
  quests() {
    const s = store.s, q = C.currentQuest(s), m = s.quests.main;
    let card;
    if (!q) card = html`<div class="talk"><b>灯灵</b>「往后这几座岛，你想去哪就去哪。」<small>所有委托都完成了。首领可以反复挑战，伙伴和装备可以继续练。</small></div>`;
    else if (!m.accepted) card = html`<div class="talk"><b>${q.title}</b>${q.text}<small>奖励：${C.rewardText(q.reward)}</small></div><button type="button" class="primary" onClick=${() => { C.acceptQuest(s); save(); closeSheet(); toast(C.questDone(s) ? '已经做到了' : '委托接下了', C.questDone(s) ? '再点一次委托领奖励。' : '点右上角的地图出发。'); }}>接下委托</button>`;
    else if (C.questDone(s)) card = html`<div class="talk"><b>${q.title}</b>${q.done}<small>奖励：${C.rewardText(q.reward)}</small></div><button type="button" class="primary" onClick=${claim}>领取奖励</button>`;
    else card = html`<div class="talk"><b>${q.title}</b>${q.text}<div class="prog"><span>进度</span><b>${C.questProgressText(s)}</b></div><small>奖励：${C.rewardText(q.reward)}</small></div>`;
    const done = s.quests.done.length;
    return html`<${Head} title="任务" right=${`主线 ${done}/8`} /><div class="scroll"><h3>灯灵的委托</h3>${card}${done ? html`<h3>已完成</h3>${s.quests.done.map(id => html`<div class="row slim dim"><span class="gi"><${Icon} n="star" s=${20} /></span><div class="mid"><b>${(C.questById(id) || {}).title || id}</b></div></div>`)}` : null}</div>`;
  },
  more() {
    const go = (k, push = true) => () => openSheet(k, { push });
    const tiles = [['map', 'map', '地图', '去别的岛'], ['shop', 'shop', '商店', '药、灵种'], ['dex', 'book', '图鉴', `${Object.keys(store.s.world.dex).length}/${Object.keys(MONSTERS).length}`], ['settings', 'settings', '设置', '存档码']];
    return html`<${Head} title="更多" /><div class="tiles">${tiles.map(([k, ic, t, sub]) => html`<button type="button" class="tile" onClick=${go(k)}><${Icon} n=${ic} s=${28} /><b>${t}</b><small>${sub}</small></button>`)}<a class="tile" href="garden.html"><${Icon} n="sprout" s=${28} /><b>旧花园</b><small>以前种的</small></a></div>`;
  },
  map() {
    const s = store.s;
    return html`<${Head} title="地图" /><p class="hint">打败一张地图的首领，下一张地图就会开放。回到小岛会恢复全部体力。</p><div class="scroll">${ZONES.map((z, i) => {
      const locked = i > s.world.unlocked, here = z.id === s.world.zone;
      return html`<button type="button" class=${`row ${here ? 'on' : ''} ${locked ? 'dim' : ''}`} disabled=${locked || here} onClick=${() => { closeSheet(); hooks.goZone(i); }}><span class=${'gi z' + i}><${Icon} n=${ZONE_ICON[i]} s=${24} /></span><div class="mid"><b>${z.name}${z.lv ? html`<small>　Lv.${z.lv[0]}-${z.lv[1]}</small>` : ''}</b><small>${locked ? '还没开放，先打败上一张地图的首领。' : z.desc}${z.boss && s.world.bosses[z.boss] ? ' 首领已打败。' : ''}</small></div>${here ? html`<span class="tag">在这里</span>` : locked ? html`<${Icon} n="lock" s=${18} />` : html`<span class="tag go">前往</span>`}</button>`;
    })}</div>`;
  },
  shop() {
    const s = store.s;
    return html`<${Head} title="商店" right=${html`<${Gold} />`} /><p class="hint">路过的行脚商，什么时候都能找到他。以后会搬到岛上的店铺里。</p><div class="scroll">${Object.keys(ITEMS).map(id => { const it = ITEMS[id];
      return html`<div class="row"><${ItemIcon} id=${id} /><div class="mid"><b>${it.name}<small>　有 ${s.bag.items[id] || 0} 个</small></b><small>${it.desc}</small></div><${Btn} disabled=${s.wallet.gold < it.price} onClick=${() => { if (C.buy(s, id)) save(); }}><${Coin} s=${12} />${it.price}</${Btn}></div>`; })}</div>`;
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
  report() {
    const r = ui.report;
    return html`<h2 class="rh">${r.title}</h2><div class="report">${r.lines.map(l => html`<p class=${l.big ? 'big' : ''}>${l.pet ? html`<${Portrait} id=${l.pet} s=${34} />` : null}${l.text}</p>`)}</div><button type="button" class="primary" onClick=${() => { const f = r.done; ui.report = null; closeSheet(); f && f(); }}>继续</button>`;
  },
  pick() {
    const k = ui.pickCls, c = CLASSES[k];
    return html`<h2 class="rh">选一位旅人</h2><p class="hint">三种职业打法不同。之后不能换，但可以删档重来。</p>
      <div class="picks">${Object.keys(CLASSES).map(id => html`<button type="button" class=${'pick' + (id === k ? ' on' : '')} onClick=${() => hooks.previewClass(id)}><${Portrait} id=${id} s=${60} /><b>${CLASSES[id].name}</b><${El} el=${CLASSES[id].el} /></button>`)}</div>
      <div class="talk">${c.blurb}<small>技能：${c.skills.map(([, id]) => SKILLS[id].name).join('、')}</small></div>
      <button type="button" class="primary" onClick=${() => hooks.startGame(k)}>就选${c.name}</button>`;
  },
};
const TALL = new Set(['bag', 'hero', 'pets', 'quests', 'map', 'shop', 'dex', 'settings']);

function FreeBtn({ p }) {
  const [sure, setSure] = useState(false);
  return html`<${Btn} ghost cls=${sure ? 'warn' : ''} onClick=${() => { if (!sure) return setSure(true); const name = MONSTERS[p.id].name; C.removePet(store.s, p.uid); save(); hooks.setPet(); toast(`${name}回到了野外。`); }}>${sure ? '确定放生' : '放生'}</${Btn}>`;
}
function setActive(uid) { store.s.party[0] = uid; save(); hooks.setPet(); }
function useItem(id) {
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
