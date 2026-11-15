// 角色、背包、装备详情、工坊、商店、伙伴页。规则都在 core/，这里只管摆出来和点按钮。
import { useState } from 'preact/hooks';
import * as C from '../core/index.js';
import { SKILLS, CLASSES, MONSTERS, ZONES, ITEMS, ELEMENTS, ATTR_NAME, ATTR_DESC, GEAR, GEAR_SLOTS, GEAR_SLOT_ICON, GEAR_SETS, GEAR_AFFIX, GEAR_SPECIAL, ADVANCE_LV, REROUTE_COST } from '../data/index.js';
import { store, save } from './store.js';
import { html, Icon, Coin, Portrait, El, Bar, Btn, Head, Gold, Tabs, ui, openSheet, back, toast, hooks, useItem } from './app.js';

const QUALITY = GEAR.quality;
export const ST_NAME = { atk: '攻击', mag: '法术', def: '防御', hp: '生命', spd: '速度', mp: '灵气' };
const statName = k => ST_NAME[k] || GEAR_AFFIX[k]?.name || k;
const isPct = k => GEAR_AFFIX[k]?.unit === '%' || GEAR.gems[k]?.unit === '%';
const fmtV = v => (Math.round(v * 10) / 10).toString();
export const statText = (k, v) => `${statName(k)} ${v >= 0 ? '+' : ''}${fmtV(v)}${isPct(k) || ['crit', 'dodge'].includes(k) && !ST_NAME[k] ? '%' : ''}`;
export const gearName = g => `${g.name}${g.plus ? ' +' + g.plus : ''}`;
export const GearIcon = ({ g, slot, s = 24 }) => html`<span class=${'gi q' + (g ? g.q : 'x')}><${Icon} n=${GEAR_SLOT_ICON[g ? g.slot : slot]} s=${s} />${g?.plus ? html`<em>+${g.plus}</em>` : null}</span>`;
const ItemIcon = ({ id }) => html`<span class=${'gi item-' + id}><${Icon} n=${ITEMS[id].icon} s=${24} /></span>`;
const Star = () => html`<span class="sand"><${Icon} n="star" s=${14} />${store.s.bag.items.starSand || 0}</span>`;
// 换了装备以后，血和灵气不能超过新的上限
function afterGear() { const s = store.s, st = C.heroStats(s); s.hero.hp = Math.min(s.hero.hp, st.hp); s.hero.mp = Math.min(s.hero.mp, st.mp); save(); hooks.setPet?.(); }

// ---------- 装备详情 ----------
function selGear() {
  const s = store.s, sel = ui.gearSel || {};
  if (sel.from === 'bag') return s.bag.gear[sel.i];
  if (sel.from === 'hero') return s.hero.gear[sel.slot];
  if (sel.from === 'pet') return s.pets.find(p => p.uid === sel.uid)?.charm;
  return null;
}
export function openGear(sel) { ui.gearSel = sel; openSheet('gear', { push: true }); }
function GearLines({ g }) {
  const main = Object.entries(g.main).map(([k, v]) => [k, Math.round(v * (1 + 0.08 * (g.plus || 0)))]);
  return html`<div class="glines">${main.map(([k, v]) => html`<div class="gl main">${statText(k, v)}</div>`)}
    ${g.affix.map(a => html`<div class="gl af">${statText(a.k, a.v)}</div>`)}
    ${g.sockets.map(gem => html`<div class=${'gl gem' + (gem ? ' el-' + gem.el : ' empty')}><${Icon} n="gem" s=${13} />${gem ? `${GEAR.gems[gem.el].name} Lv.${gem.lv}　${statText(GEAR.gems[gem.el].stat, GEAR.gems[gem.el].per * gem.lv * (GEAR.gems[gem.el].unit ? 1 : Math.max(1, g.tier)))}` : '空孔'}</div>`)}
    ${g.special ? html`<div class="gl sp">【${GEAR_SPECIAL[g.special].name}】${GEAR_SPECIAL[g.special].desc}</div>` : null}
    ${g.set ? html`<div class="gl set"><b>${GEAR_SETS[g.set].name}</b>　两件：${GEAR_SETS[g.set].two.desc}　四件：${GEAR_SETS[g.set].four.desc}</div>` : null}</div>`;
}
function Compare({ g, cur }) {
  const a = C.gearStats(g), b = C.gearStats(cur), keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  const rows = keys.map(k => [k, (a[k] || 0) - (b[k] || 0)]).filter(([, d]) => Math.abs(d) >= 0.05);
  const d = C.gearScore(g) - C.gearScore(cur);
  return html`<div class="cmp"><small>${cur ? `和身上的「${gearName(cur)}」比` : '这个部位还空着'}　评分 <b class=${d > 0 ? 'up' : d < 0 ? 'down' : ''}>${d > 0 ? '+' : ''}${d}</b></small>
    <div>${rows.map(([k, v]) => html`<span class=${v > 0 ? 'up' : 'down'}>${statText(k, v)}</span>`)}</div></div>`;
}
function GemPick({ g, idx, done }) {
  const s = store.s, have = Object.entries(s.bag.gems || {}).filter(([, n]) => n > 0).map(([k, n]) => { const [el, lv] = k.split(':'); return { el, lv: +lv, n }; }).sort((a, b) => b.lv - a.lv);
  if (!have.length) return html`<p class="hint">没有灵石。打怪有机会掉落。</p>`;
  return html`<div class="chipsel">${have.map(x => html`<button type="button" class=${'gemb el-' + x.el} onClick=${() => { if (C.socket(s, g, idx, x.el, x.lv)) { afterGear(); done(); } }}>${GEAR.gems[x.el].name} Lv.${x.lv}<small>×${x.n}</small></button>`)}</div>`;
}
function PetPick({ i }) {
  const s = store.s;
  if (!s.pets.length) return html`<p class="hint">还没有伙伴。</p>`;
  return html`<div class="chipsel">${s.pets.map(p => html`<button type="button" class="petb" onClick=${() => { if (C.equipPet(s, p.uid, i)) { save(); toast(`${MONSTERS[p.id].name}戴上了`); back(); } }}><${Portrait} id=${p.id} s=${30} />${MONSTERS[p.id].name}${p.charm ? html`<small>换下 ${p.charm.name}</small>` : null}</button>`)}</div>`;
}
function gearPage() {
  const s = store.s, g = selGear(), sel = ui.gearSel || {};
  const [open, setOpen] = useState(null), [locks, setLocks] = useState([]), [sure, setSure] = useState(false);
  if (!g) return html`<${Head} title="装备" /><p class="hint">这件装备已经不在了。</p>`;
  const Q = QUALITY[g.q], ec = C.enhanceCost(g), maxed = (g.plus || 0) >= C.MAX_PLUS, rate = C.enhanceRate(g);
  const canEnh = !maxed && s.wallet.gold >= ec.gold && (s.bag.items.stone || 0) >= ec.stone;
  const rc = C.rerollCost(locks.length), canRe = g.affix.length && locks.length < g.affix.length && (s.bag.items.starSand || 0) >= rc;
  const dg = C.dismantleGain(g), charm = g.slot === 'neck' || g.slot === 'ring';
  const toggle = i => setLocks(locks.includes(i) ? locks.filter(x => x !== i) : [...locks, i]);
  return html`<${Head} title="装备" right=${html`<${Gold} />`} />
    <div class="scroll">
      <div class=${'gcard q' + g.q}><${GearIcon} g=${g} s=${30} /><div class="mid"><b style=${`color:${Q.color}`}>${gearName(g)}</b><small>${GEAR_SLOTS[g.slot]} · ${Q.name} · ${g.tier} 阶 · 评分 ${C.gearScore(g)}</small></div></div>
      <${GearLines} g=${g} />
      ${sel.from === 'bag' ? html`<${Compare} g=${g} cur=${s.hero.gear[g.slot]} />` : null}
      <div class="gacts">
        ${sel.from === 'bag' ? html`<${Btn} onClick=${() => { const slot = g.slot; if (C.equip(s, sel.i)) { ui.gearSel = { from: 'hero', slot }; afterGear(); toast('换上了'); } }}>装备</${Btn}>
          ${charm ? html`<${Btn} ghost onClick=${() => setOpen(open === 'pet' ? null : 'pet')}>给伙伴</${Btn}>` : null}
          <${Btn} ghost cls=${sure === 'dis' ? 'warn' : ''} onClick=${() => { if (sure !== 'dis') return setSure('dis'); const r = C.dismantle(s, sel.i); save(); toast('分解了', `灵尘 +${r.dust}${r.stone ? `　强化石 +${r.stone}` : ''}`); back(); }}>${sure === 'dis' ? '确定分解' : `分解`}</${Btn}>
          <${Btn} ghost cls=${sure === 'sell' ? 'warn' : ''} onClick=${() => { if (sure !== 'sell') return setSure('sell'); const n = C.sell(s, sel.i); save(); toast(`卖了 ${n} 金币`); back(); }}>${sure === 'sell' ? '确定卖掉' : html`卖 <${Coin} s=${12} />${Math.round(g.price / 2)}`}</${Btn}>` : null}
        ${sel.from === 'hero' ? html`<${Btn} ghost onClick=${() => { C.unequip(s, sel.slot); afterGear(); back(); }}>卸下</${Btn}>` : null}
        ${sel.from === 'pet' ? html`<${Btn} ghost onClick=${() => { C.unequipPet(s, sel.uid); save(); back(); }}>取下</${Btn}>` : null}
      </div>
      ${sel.from === 'bag' ? html`<p class="hint">分解得到灵尘 ${dg.dust}${dg.stone ? `、强化石 ${dg.stone}` : ''}，镶的灵石会退回。</p>` : null}
      ${open === 'pet' ? html`<h3>给谁戴</h3><${PetPick} i=${sel.i} />` : null}

      <h3>强化 ${g.plus || 0}/${C.MAX_PLUS}</h3>
      <div class="row slim"><div class="mid"><b>${maxed ? '已经强化满了' : `成功率 ${rate}%`}${g.luck ? html`<small>　幸运 +${g.luck}</small>` : null}</b><small>每级主属性 +8%。+10 以后可能失败，失败只扣材料，并累积幸运。</small></div>
        ${maxed ? null : html`<${Btn} disabled=${!canEnh} onClick=${() => { const r = C.enhance(s, g); if (!r) return; afterGear(); toast(r.ok ? `强化成功 +${g.plus}` : '强化失败', r.ok ? '' : `幸运 +10，下次更容易`); }}><${Coin} s=${12} />${ec.gold} · 石${ec.stone}<small>/${s.bag.items.stone || 0}</small></${Btn}>`}</div>

      ${g.sockets.length ? html`<h3>镶嵌</h3>${g.sockets.map((gem, i) => html`<div class="row slim"><span class=${'gi sm' + (gem ? ' el-' + gem.el : '')}><${Icon} n="gem" s=${18} /></span><div class="mid"><b>${gem ? `${GEAR.gems[gem.el].name} Lv.${gem.lv}` : `第 ${i + 1} 孔 · 空着`}</b></div>
          ${gem ? html`<${Btn} ghost onClick=${() => { C.unsocket(s, g, i); afterGear(); }}>取下</${Btn}>` : html`<${Btn} onClick=${() => setOpen(open === 'gem' + i ? null : 'gem' + i)}>镶嵌</${Btn}>`}</div>
          ${open === 'gem' + i ? html`<${GemPick} g=${g} idx=${i} done=${() => setOpen(null)} />` : null}`)}` : html`<p class="hint">稀有以上的装备才有镶嵌孔。</p>`}

      ${g.affix.length ? html`<h3>洗练</h3><p class="hint">点词条可以锁住，锁住的不变。每锁一条多花 2 星砂。</p>
        <div class="chipsel">${g.affix.map((a, i) => html`<button type="button" class=${'lockb' + (locks.includes(i) ? ' on' : '')} onClick=${() => toggle(i)}><${Icon} n=${locks.includes(i) ? 'lock' : 'refresh'} s=${13} />${statText(a.k, a.v)}</button>`)}</div>
        <button type="button" class="primary ghost" disabled=${!canRe} onClick=${() => { if (C.reroll(s, g, locks)) { afterGear(); toast('词条换新了'); } }}><${Icon} n="refresh" s=${16} /> 洗练　星砂 ${rc}（有 ${s.bag.items.starSand || 0}）</button>` : null}
    </div>`;
}

// ---------- 背包 ----------
function bagPage() {
  const s = store.s, [tab, setTab] = useState('gear'), [sure, setSure] = useState(false);
  let body;
  if (tab === 'gear') {
    const list = s.bag.gear.map((g, i) => ({ g, i })), junk = s.bag.gear.filter(g => g.q <= 1 && !g.set && !g.plus).length;
    body = html`${list.length ? html`<div class="ggrid">${list.map(({ g, i }) => { const d = C.gearScore(g) - C.gearScore(s.hero.gear[g.slot]);
        return html`<button type="button" class=${'gtile q' + g.q} onClick=${() => openGear({ from: 'bag', i })}><${GearIcon} g=${g} s=${26} /><small>${GEAR_SLOTS[g.slot]}</small>${d > 0 ? html`<i class="better"><${Icon} n="up" s=${12} /></i>` : null}${g.set ? html`<i class="setdot"></i>` : null}</button>`; })}</div>`
      : html`<p class="hint">还没有多余的装备。打怪有机会掉落，首领一定会掉。</p>`}
      ${junk ? html`<button type="button" class=${'primary ghost' + (sure ? ' warn' : '')} onClick=${() => { if (!sure) return setSure(true); const r = C.dismantleJunk(s, 1); setSure(false); save(); toast(`分解了 ${r.n} 件`, `灵尘 +${r.dust}${r.stone ? `　强化石 +${r.stone}` : ''}`); }}><${Icon} n="hammer" s=${16} /> ${sure ? `确定分解 ${junk} 件普通和精良` : '一键分解普通和精良'}</button>` : null}`;
  } else if (tab === 'items') {
    body = Object.keys(ITEMS).filter(id => ITEMS[id].cat === 'use').map(id => { const it = ITEMS[id], n = s.bag.items[id] || 0;
      return html`<div class="row"><${ItemIcon} id=${id} /><div class="mid"><b>${it.name}<small> ×${n}</small></b><small>${it.desc}</small></div>${it.use !== 'capture' ? html`<${Btn} disabled=${!n} onClick=${() => useItem(id)}>使用</${Btn}>` : null}</div>`; });
  } else if (tab === 'mats') {
    const ids = Object.keys(ITEMS).filter(id => (ITEMS[id].cat === 'mat' || ITEMS[id].cat === 'bp') && (s.bag.items[id] || 0) > 0);
    body = ids.length ? html`<div class="mgrid">${ids.map(id => html`<div class="mtile"><${ItemIcon} id=${id} /><b>${ITEMS[id].name}</b><small>×${s.bag.items[id]}</small></div>`)}</div><p class="hint">材料用来强化、洗练和在工坊打造。</p>` : html`<p class="hint">还没有材料。打怪会掉羽毛、河石这类东西，分解装备得到灵尘。</p>`;
  } else {
    const gems = Object.entries(s.bag.gems || {}).filter(([, n]) => n > 0).map(([k, n]) => { const [el, lv] = k.split(':'); return { el, lv: +lv, n }; }).sort((a, b) => a.el.localeCompare(b.el) || a.lv - b.lv);
    body = gems.length ? html`<p class="hint">三颗同样的灵石合成一颗高一级的，最高 ${C.GEM_MAX} 级。</p>${gems.map(x => html`<div class="row slim"><span class=${'gi sm el-' + x.el}><${Icon} n="gem" s=${18} /></span><div class="mid"><b>${GEAR.gems[x.el].name} Lv.${x.lv}<small>　×${x.n}</small></b><small>镶上：${statText(GEAR.gems[x.el].stat, GEAR.gems[x.el].per * x.lv)}${GEAR.gems[x.el].unit ? '' : ' × 装备阶数'}</small></div><${Btn} disabled=${x.n < 3 || x.lv >= C.GEM_MAX} onClick=${() => { if (C.fuseGem(s, x.el, x.lv)) { save(); toast(`合成了 ${GEAR.gems[x.el].name} Lv.${x.lv + 1}`); } }}>合成</${Btn}></div>`)}` : html`<p class="hint">还没有灵石。打怪有机会掉落，可以镶在稀有以上的装备上。</p>`;
  }
  return html`<${Head} title="背包" right=${html`<${Gold} />`} />
    <${Tabs} tab=${tab} set=${setTab} list=${[['gear', `装备 ${s.bag.gear.length || ''}`], ['items', '道具'], ['mats', '材料'], ['gems', '灵石']]} />
    <div class="scroll" key=${tab}>${body}</div>`;
}

// ---------- 角色 ----------
function SkillRow({ id, unlockLv, locked }) {
  const s = store.s, h = s.hero, has = !locked && h.lv >= unlockLv && (h.skills[id] || SKILLS[id].kind === 'passive'), base = SKILLS[id];
  if (base.kind === 'passive') return html`<div class=${'row slim' + (has ? '' : ' dim')}><span class="gi sm pas"><${Icon} n="sparkle" s=${18} /></span><div class="mid"><b>${base.name}<small>　被动 · ${has ? '已生效' : `${unlockLv} 级`}</small></b><small>${base.desc}</small></div></div>`;
  const n = C.skillLv(s, id), k = C.skillAt(id, n), max = n >= C.SKILL_MAX, nextUp = n < 5 ? ['5', base.upText?.['5']] : n < 10 ? ['10', base.upText?.['10']] : null;
  return html`<div class=${'row slim' + (has ? '' : ' dim')}><span class="gi sm">${k.el ? html`<${El} el=${k.el} />` : html`<${Icon} n="sparkle" s=${18} />`}</span><div class="mid"><b>${k.name}<small>　${has ? `Lv.${n}` : `${unlockLv} 级学会`} · 灵气 ${k.mp}${k.once ? ' · 每场一次' : ''}</small></b><small>${base.desc}${has && nextUp?.[1] ? `　${nextUp[0]} 级：${nextUp[1]}` : ''}</small></div>
    ${has ? html`<${Btn} disabled=${max || h.sp <= 0} onClick=${() => { if (C.raiseSkill(s, id)) save(); }}>${max ? '满级' : '升级'}</${Btn}>` : null}</div>`;
}
function RouteCard({ id, r }) {
  const s = store.s, h = s.hero, cur = h.route === id, can = h.lv >= ADVANCE_LV, [sure, setSure] = useState(false);
  const cost = h.route ? REROUTE_COST : 0;
  return html`<div class=${'route' + (cur ? ' on' : '')}><div class="rhead"><b>${r.name}</b><small>${r.desc}</small>
      ${cur ? html`<span class="tag">当前路线</span>` : html`<${Btn} disabled=${!can || s.wallet.gold < cost} cls=${sure ? 'warn' : ''} onClick=${() => { if (h.route && !sure) return setSure(true); if (C.chooseRoute(s, id)) { save(); toast(`转职为${r.name}`, '新技能已经学会，记得加点。'); } setSure(false); }}>${!can ? `${ADVANCE_LV} 级可选` : h.route ? (sure ? '确定改换' : html`改换 <${Coin} s=${12} />${cost}`) : '选这条'}</${Btn}>`}</div>
    ${r.skills.map(([lv, sid]) => html`<${SkillRow} id=${sid} unlockLv=${lv} locked=${!cur} />`)}</div>`;
}
function heroPage() {
  const s = store.s, h = s.hero, st = C.heroStats(s), c = CLASSES[h.cls], [tab, setTab] = useState(ui.heroTab || 'attr'), [sure, setSure] = useState('');
  const pick = t => { ui.heroTab = t; setTab(t); setSure(''); };
  const confirm = (k, fn) => () => { if (sure !== k) return setSure(k); fn(); setSure(''); save(); };
  let body;
  if (tab === 'attr') {
    const extra = [['crit', '暴击', '%'], ['critDmg', '暴伤', '%'], ['dodge', '闪避', '%'], ['hit', '命中', '%'], ['healUp', '治疗', '%'], ['ailRes', '异常抵抗', '%']].filter(([k]) => st[k]);
    body = html`<div class="herohead"><${Portrait} id=${h.cls} s=${64} /><div><b>${c.name}${C.routeOf(s) ? ` · ${C.routeOf(s).name}` : ''}　Lv.${h.lv}</b><small>${c.blurb}</small><div class="xp big"><i style=${`width:${h.xp / C.xpNeed(h.lv) * 100}%`}></i></div><small>经验 ${h.xp}/${C.xpNeed(h.lv)} · 已打败 ${s.stats.kills} 只野怪</small></div></div>
      <div class="stats">${['hp', 'mp', 'atk', 'mag', 'def', 'spd'].map(k => html`<div class="stat">${ST_NAME[k]}<b>${st[k]}</b></div>`)}</div>
      ${extra.length ? html`<div class="stats sm">${extra.map(([k, n]) => html`<div class="stat">${n}<b>${fmtV(st[k])}%</b></div>`)}</div>` : null}
      <h3>属性点 · 剩 ${h.pts} 点</h3>
      ${Object.keys(ATTR_NAME).map(k => html`<div class="row slim"><div class="mid"><b>${ATTR_NAME[k]}　${Math.floor(h.attr[k])}</b><small>${ATTR_DESC[k]}</small></div><${Btn} disabled=${h.pts <= 0} onClick=${() => { C.spendPoint(s, k); save(); }}>+1</${Btn}></div>`)}
      <div class="gacts"><${Btn} disabled=${h.pts <= 0} onClick=${() => { C.autoAttr(s); save(); toast('按推荐加好了'); }}>推荐加点</${Btn}><${Btn} ghost cls=${sure === 'attr' ? 'warn' : ''} onClick=${confirm('attr', () => { C.resetAttr(s); afterGear(); toast('属性点退回来了'); })}>${sure === 'attr' ? '确定重置' : '免费重置属性点'}</${Btn}></div>`;
  } else if (tab === 'skill') {
    const routes = Object.entries(c.routes || {});
    body = html`<p class="hint">剩 ${h.sp} 点技能点。每升一级给 1 点；技能每升一级威力 +8%，5 级和 10 级各有一次变化。</p>
      <h3>基础技能</h3>${c.skills.map(([lv, id]) => html`<${SkillRow} id=${id} unlockLv=${lv} />`)}
      <h3>天赋</h3>${(c.passives || []).map(([lv, id]) => html`<${SkillRow} id=${id} unlockLv=${lv} />`)}
      <h3>转职 · ${ADVANCE_LV} 级</h3><p class="hint">${h.lv < ADVANCE_LV ? `到 ${ADVANCE_LV} 级可以在两条路线里选一条，先看看。` : h.route ? `改换路线要 ${REROUTE_COST} 金币，那条路线上加的技能点会退回。` : '选一条路线，马上学会它的第一个技能。'}</p>
      <div class="routes">${routes.map(([id, r]) => html`<${RouteCard} id=${id} r=${r} />`)}</div>
      <button type="button" class=${'primary ghost' + (sure === 'sk' ? ' warn' : '')} onClick=${confirm('sk', () => { C.resetSkills(s); toast('技能点退回来了'); })}><${Icon} n="refresh" s=${16} /> ${sure === 'sk' ? '确定重置技能点' : '免费重置技能点'}</button>`;
  } else {
    const sets = Object.entries(C.setCounts(h.gear)), total = Object.values(h.gear).reduce((a, g) => a + C.gearScore(g), 0);
    body = html`<p class="hint">点格子看详情，可以强化、镶嵌、洗练。装备评分合计 ${total}。</p>
      <div class="doll">${Object.keys(GEAR_SLOTS).map(k => { const g = h.gear[k];
        return html`<button type="button" class=${'dslot' + (g ? ' q' + g.q : ' empty')} onClick=${() => (g ? openGear({ from: 'hero', slot: k }) : openSheet('bag', { push: true }))}><${GearIcon} g=${g} slot=${k} s=${26} /><div><small>${GEAR_SLOTS[k]}</small><b>${g ? gearName(g) : '空着'}</b></div></button>`; })}</div>
      ${sets.length ? html`<h3>套装</h3>${sets.map(([id, n]) => { const d = GEAR_SETS[id]; return html`<div class="row slim"><div class="mid"><b>${d.name}<small>　${n} 件</small></b><small class=${n >= 2 ? 'up' : ''}>两件：${d.two.desc}</small><small class=${n >= 4 ? 'up' : ''}>四件：${d.four.desc}</small></div></div>`; })}` : null}`;
  }
  return html`<${Head} title="角色" right=${html`<${Gold} />`} />
    <${Tabs} tab=${tab} set=${pick} list=${[['attr', `属性${h.pts ? ' ' + h.pts : ''}`], ['skill', `技能${h.sp ? ' ' + h.sp : ''}`], ['gear', '装备']]} />
    <div class="scroll" key=${tab}>${body}</div>`;
}

// ---------- 工坊 ----------
function craftPage() {
  const s = store.s, cr = s.craft, [focus, setFocus] = useState({});
  const zones = ZONES.filter(z => z.set);
  return html`<${Head} title="工坊" right=${html`<${Gold} />`} />
    <p class="hint">用首领掉的图纸和地图材料打造套装，必出精良以上。工坊等级 ${cr.lv}${cr.lv < C.CRAFT_MAX ? `（${cr.xp}/${cr.lv * 2}）` : '（满级）'}，越高越容易出稀有、珍品、传说。</p>
    <div class="scroll">${zones.map(z => {
      const set = GEAR_SETS[z.set], c = C.craftCost(z.set), bp = (s.bag.items['bp_' + z.set] || 0) > 0, ok = C.canCraft(s, z.set), f = focus[z.set] || '', fOk = !f || (s.bag.items.focus || 0) > 0;
      return html`<div class=${'craft' + (bp ? '' : ' dim')}><div class="rhead"><b>${set.name}</b><small>两件：${set.two.desc}　四件：${set.four.desc}</small></div>
        ${bp ? html`<div class="need"><span class=${s.wallet.gold >= c.gold ? '' : 'lack'}><${Coin} s=${12} />${c.gold}</span>${Object.entries(c.items).map(([id, n]) => html`<span class=${(s.bag.items[id] || 0) >= n ? '' : 'lack'}>${ITEMS[id].name} ${s.bag.items[id] || 0}/${n}</span>`)}</div>
          <div class="fsel"><label>定向符<small>（有 ${s.bag.items.focus || 0}）</small></label><select value=${f} onChange=${e => setFocus({ ...focus, [z.set]: e.target.value })}><option value="">不用，词条随机</option>${Object.keys(GEAR_AFFIX).map(k => html`<option value=${k}>必出「${GEAR_AFFIX[k].name}」</option>`)}</select></div>
          <button type="button" class="primary" disabled=${!ok || !fOk} onClick=${() => { const g = C.craft(s, z.set, f || null); if (!g) return; save(); toast(`打造出${QUALITY[g.q].name}的${g.name}`); openGear({ from: 'bag', i: s.bag.gear.length - 1 }); }}><${Icon} n="hammer" s=${16} /> 打造</button>`
        : html`<p class="hint">打败「${z.name}」的首领会掉这张图纸。</p>`}</div>`;
    })}</div>`;
}

// ---------- 商店 ----------
function shopPage() {
  const s = store.s, ids = Object.keys(ITEMS).filter(id => ITEMS[id].price || ITEMS[id].starPrice);
  return html`<${Head} title="商店" right=${html`<${Gold} /><${Star} />`} /><p class="hint">路过的行脚商，什么时候都能找到他。定向符要用星砂换，星砂在首领和强敌身上掉。</p><div class="scroll">${ids.map(id => { const it = ITEMS[id], star = !!it.starPrice, can = star ? (s.bag.items.starSand || 0) >= it.starPrice : s.wallet.gold >= it.price;
    return html`<div class="row"><${ItemIcon} id=${id} /><div class="mid"><b>${it.name}<small>　有 ${s.bag.items[id] || 0} 个</small></b><small>${it.desc}</small></div><${Btn} disabled=${!can} onClick=${() => { if (C.buy(s, id)) save(); }}>${star ? html`<${Icon} n="star" s=${12} />${it.starPrice}` : html`<${Coin} s=${12} />${it.price}`}</${Btn}></div>`; })}</div>`;
}

// ---------- 伙伴 ----------
function FreeBtn({ p }) {
  const [sure, setSure] = useState(false);
  return html`<${Btn} ghost cls=${sure ? 'warn' : ''} onClick=${() => { if (!sure) return setSure(true); const name = MONSTERS[p.id].name; C.removePet(store.s, p.uid); save(); hooks.setPet(); toast(`${name}回到了野外。`); }}>${sure ? '确定放生' : '放生'}</${Btn}>`;
}
function setActive(uid, on) { const s = store.s; if (on) { const i = s.party.indexOf(null); if (i >= 0) s.party[i] = uid; } else s.party = s.party.map(u => (u === uid ? null : u)); save(); hooks.setPet(); }
function petsPage() {
  const s = store.s;
  if (!s.pets.length) return html`<${Head} title="伙伴" right=${`0/${C.PARTY_MAX}`} /><div class="talk">你还没有伙伴。<small>战斗里把野怪打到虚弱，再用「捕捉」丢出灵种，它就可能跟你走。血越少越容易成功，首领抓不了。</small></div>`;
  return html`<${Head} title="伙伴" right=${`${s.pets.length}/${C.PARTY_MAX}`} />
    <p class="hint">最多两只一起出战，拿九成经验；其余的在家待命，拿一半经验。每只伙伴能戴一件项链或戒指。</p>
    <div class="scroll">${s.pets.map(p => { const m = MONSTERS[p.id], st = C.petStats(p), on = s.party.includes(p.uid), full = !s.party.includes(null);
      return html`<div class=${'row' + (on ? ' on' : '')}><${Portrait} id=${p.id} s=${52} /><div class="mid"><b>${m.name}<small>　Lv.${p.lv}</small> <${El} el=${m.el} /></b><${Bar} v=${p.hp} max=${st.hp} kind="hp" /><small>攻击 ${st.atk} · 防御 ${st.def} · 速度 ${st.spd} · 技能 ${m.skills.map(id => SKILLS[id].name).join('、')}</small>
          <button type="button" class=${'charm' + (p.charm ? ' q' + p.charm.q : '')} onClick=${() => (p.charm ? openGear({ from: 'pet', uid: p.uid }) : toast('在背包里点一件项链或戒指', '选「给伙伴」。'))}><${GearIcon} g=${p.charm} slot="neck" s=${16} />${p.charm ? gearName(p.charm) : '饰品空着'}</button></div>
        <div class="acts">${on ? html`<${Btn} ghost onClick=${() => setActive(p.uid, false)}>休息</${Btn}>` : html`<${Btn} disabled=${full} onClick=${() => setActive(p.uid, true)}>${full ? '满了' : '出战'}</${Btn}>`}<${FreeBtn} p=${p} /></div></div>`; })}</div>`;
}

export const gearPages = { gear: gearPage, bag: bagPage, hero: heroPage, craft: craftPage, shop: shopPage, pets: petsPage };
export const routeHint = s => s.hero.lv >= ADVANCE_LV && !s.hero.route;
export { ELEMENTS };
