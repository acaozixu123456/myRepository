// 伙伴列表、伙伴详情（资质五边形、性格天赋、亲密度、技能槽、进化）、融合。
import { useState } from 'preact/hooks';
import * as C from '../core/index.js';
import { SKILLS, MONSTERS, ITEMS, PETS } from '../data/index.js';
import { store, save } from './store.js';
import { html, Icon, Coin, Portrait, El, Bar, Btn, Head, Tabs, ui, openSheet, back, toast, hooks } from './app.js';
import { GearIcon, gearName, openGear } from './gearui.js';

const Stars = ({ n }) => html`<span class="stars">${'★'.repeat(n)}<i>${'★'.repeat(5 - n)}</i></span>`;
const Hearts = ({ p }) => html`<span class="love"><${Icon} n="heart" s=${12} />${C.loveLv(p)}</span>`;
const natureText = p => { const n = PETS.natures[p.nature]; return n ? `${n.name}（${C.APT_NAME[n.up]}↑ ${C.APT_NAME[n.down]}↓）` : '—'; };
const openPet = uid => { ui.petSel = uid; openSheet('pet', { push: true }); };
const refreshLook = () => hooks.setPet?.();

// 五项资质的五边形
function Radar({ apt, size = 150 }) {
  const c = size / 2, r = c - 22, pt = (i, v) => { const a = -Math.PI / 2 + i * 2 * Math.PI / 5, k = r * v; return [c + Math.cos(a) * k, c + Math.sin(a) * k]; };
  const ring = v => C.APT_KEYS.map((_, i) => pt(i, v).join(',')).join(' ');
  const shape = C.APT_KEYS.map((k, i) => pt(i, (apt[k] - 40) / 80).join(',')).join(' ');
  return html`<svg class="radar" width=${size} height=${size} viewBox=${`0 0 ${size} ${size}`}>
    ${[0.25, 0.5, 0.75, 1].map(v => html`<polygon points=${ring(v)} class="rg" />`)}
    <polygon points=${shape} class="rv" />
    ${C.APT_KEYS.map((k, i) => { const [x, y] = pt(i, 1.22); return html`<text x=${x} y=${y + 4} text-anchor="middle">${C.APT_NAME[k]}</text>`; })}
  </svg>`;
}

function setActive(uid, on) { const s = store.s; if (on) { const i = s.party.indexOf(null); if (i >= 0) s.party[i] = uid; } else s.party = s.party.map(u => (u === uid ? null : u)); save(); refreshLook(); }
function PetRow({ p }) {
  const s = store.s, m = MONSTERS[p.id], st = C.petStats(p), on = s.party.includes(p.uid), full = !s.party.includes(null);
  return html`<div class=${'row prow' + (on ? ' on' : '')} onClick=${() => openPet(p.uid)}><${Portrait} id=${p.id} s=${52} p=${p} /><div class="mid"><b>${C.petName(p)}<small>　Lv.${p.lv}</small> <${El} el=${m.el} />${p.shiny ? html`<span class="tag shinytag">异色</span>` : null}</b>
      <small><${Stars} n=${C.aptStars(p)} />　<${Hearts} p=${p} />　${PETS.natures[p.nature]?.name || ''}</small><${Bar} v=${p.hp} max=${st.hp} kind="hp" /></div>
    ${p.home ? null : html`<div class="acts" onClick=${e => e.stopPropagation()}>${on ? html`<${Btn} ghost onClick=${() => setActive(p.uid, false)}>休息</${Btn}>` : html`<${Btn} disabled=${full} onClick=${() => setActive(p.uid, true)}>${full ? '满了' : '出战'}</${Btn}>`}</div>`}</div>`;
}
function petsPage() {
  const s = store.s, [tab, setTab] = useState(ui.petsTab || 'carry'), pick = t => { ui.petsTab = t; setTab(t); };
  const car = C.carried(s), home = C.housed(s), cap = C.houseCap(s);
  if (!s.pets.length) return html`<${Head} title="伙伴" right=${`0/${C.CARRY_MAX}`} /><div class="talk">你还没有伙伴。<small>战斗里把野怪打到虚弱，再用「捕捉」丢出灵种，它就可能跟你走。血越少越容易成功，首领抓不了。每只伙伴的资质、性格、天赋都不一样，偶尔还会遇到异色。</small></div>`;
  return html`<${Head} title="伙伴" />
    <${Tabs} tab=${tab} set=${pick} list=${[['carry', `随身 ${car.length}/${C.CARRY_MAX}`], ['home', `伙伴屋 ${home.length}/${cap}`]]} />
    <div class="scroll" key=${tab}>${tab === 'carry' ? html`<p class="hint">最多两只一起出战，拿九成经验和亲密度；其余随身的拿一半经验。点一只看详情。</p>${car.map(p => html`<${PetRow} p=${p} key=${p.uid} />`)}`
      : html`<p class="hint">伙伴屋里的伙伴不跟着冒险，也不拿经验。随身满 6 只后新抓到的会住进来。</p>${home.length ? home.map(p => html`<${PetRow} p=${p} key=${p.uid} />`) : html`<p class="hint">伙伴屋还空着。</p>`}
        <button type="button" class="primary ghost" disabled=${cap >= PETS.houseMax || (s.bag.items.starSand || 0) < PETS.houseCost} onClick=${() => { if (C.expandHouse(s)) { save(); toast(`伙伴屋扩到 ${C.houseCap(s)} 格`); } }}><${Icon} n="home" s=${16} /> 扩建 ${PETS.houseStep} 格　星砂 ${PETS.houseCost}（有 ${s.bag.items.starSand || 0}）</button>`}</div>`;
}

// ---------- 伙伴详情 ----------
function FreeBtn({ p }) {
  const [sure, setSure] = useState(false);
  return html`<${Btn} ghost cls=${sure ? 'warn' : ''} onClick=${() => { if (!sure) return setSure(true); const name = C.petName(p); if (p.charm) { store.s.bag.gear.push(p.charm); p.charm = null; } C.removePet(store.s, p.uid); save(); refreshLook(); toast(`${name}回到了野外。`); back(); }}>${sure ? '确定放生' : '放生'}</${Btn}>`;
}
function SkillTab({ p }) {
  const s = store.s, slots = C.skillSlots(p), spare = p.known.filter(id => !p.skills.includes(id));
  const books = Object.keys(ITEMS).filter(id => ITEMS[id].cat === 'book' && s.bag.items[id] > 0);
  const lv = Math.min(10, 1 + Math.floor(p.lv / 5));
  const row = (id, on) => { const k = C.skillAt(id, lv); return html`<div class="row slim"><span class="gi sm">${k.el && k.el !== 'none' ? html`<${El} el=${k.el} />` : html`<${Icon} n="sparkle" s=${18} />`}</span><div class="mid"><b>${k.name}<small>　Lv.${lv}</small></b><small>${SKILLS[id].desc || ''}</small></div>
    ${on ? html`<${Btn} ghost disabled=${p.skills.length <= 1} onClick=${() => { if (C.unequipPetSkill(p, id)) save(); }}>卸下</${Btn}>` : html`<${Btn} disabled=${p.skills.length >= slots} onClick=${() => { if (C.equipPetSkill(p, id)) save(); }}>装上</${Btn}>`}</div>`; };
  return html`<p class="hint">技能槽 ${p.skills.length}/${slots}${slots < 4 ? `，亲密度到 ${PETS.slot4Love} 级开第四个槽` : ''}。技能等级跟着伙伴等级走（每 5 级升一级）。学会的技能可以随时换上换下。</p>
    <h3>正在用</h3>${p.skills.map(id => row(id, true))}
    ${spare.length ? html`<h3>学会但没装上</h3>${spare.map(id => row(id, false))}` : null}
    <h3>技能书</h3>${books.length ? books.map(id => { const it = ITEMS[id], has = p.known.includes(it.skill);
      return html`<div class="row slim"><span class="gi sm item-book"><${Icon} n="book" s=${18} /></span><div class="mid"><b>${it.name}<small>　×${s.bag.items[id]}</small></b><small>${SKILLS[it.skill].desc || ''}</small></div><${Btn} disabled=${has} onClick=${() => { if (C.learnBook(s, p.uid, id)) { save(); toast(`${C.petName(p)}学会了「${SKILLS[it.skill].name}」`); } }}>${has ? '已会' : '学习'}</${Btn}></div>`; })
      : html`<p class="hint">背包里没有技能书。商店有卖。</p>`}`;
}
function EvoTab({ p }) {
  const s = store.s, list = PETS.evo[p.id] || [], next = C.nextEvo(p);
  const names = [MONSTERS[p.id].name, ...list.map(e => e.name)];
  return html`<div class="evochain">${names.map((n, i) => html`<div class=${'evo' + (i === (p.evo || 0) ? ' on' : i < (p.evo || 0) ? ' done' : '')}><${Portrait} id=${p.id} s=${46} p=${{ evo: i, shiny: p.shiny }} /><b>${n}</b><small>${i ? `${list[i - 1].lv} 级` : '初始'}</small></div>${i < names.length - 1 ? html`<${Icon} n="back" s=${14} />` : null}`)}</div>
    ${next ? html`<h3>进化成 ${next.name}</h3><div class="need"><span class=${p.lv >= next.lv ? '' : 'lack'}>等级 ${p.lv}/${next.lv}</span>${Object.entries(next.need).map(([id, n]) => html`<span class=${(s.bag.items[id] || 0) >= n ? '' : 'lack'}>${ITEMS[id].name} ${s.bag.items[id] || 0}/${n}</span>`)}</div>
      <p class="hint">进化后身体变大、换配色，各项数值提高，并学会「${SKILLS[next.skill].name}」。材料在栖息的岛上打怪掉。</p>
      <button type="button" class="primary" disabled=${!C.canEvolve(s, p)} onClick=${() => { const e = C.evolve(s, p.uid); if (e) { save(); refreshLook(); toast(`进化成了${e.name}！`, `学会了「${SKILLS[e.skill].name}」`, 3500); } }}><${Icon} n="sparkle" s=${16} /> 进化</button>`
      : html`<p class="hint">已经是最终形态了。</p>`}`;
}
function petPage() {
  const s = store.s, p = s.pets.find(x => x.uid === ui.petSel), [tab, setTab] = useState('apt');
  if (!p) return html`<${Head} title="伙伴" /><p class="hint">这只伙伴已经不在了。</p>`;
  const m = MONSTERS[p.id], st = C.petStats(p), t = PETS.talents[p.talent], on = s.party.includes(p.uid), full = !s.party.includes(null), lv = C.loveLv(p);
  let body;
  if (tab === 'apt') body = html`<div class="aptbox"><${Radar} apt=${p.apt} /><div class="aptnum">${C.APT_KEYS.map(k => html`<div><span>${C.APT_NAME[k]}</span><b class=${p.apt[k] >= 108 ? 'hi' : p.apt[k] < 72 ? 'lo' : ''}>${p.apt[k]}</b></div>`)}<small>资质 60 到 120，平均 ${Math.round(C.aptAvg(p))}</small></div></div>
      <div class="stats">${[['hp', '生命'], ['atk', '攻击'], ['mag', '法术'], ['def', '防御'], ['spd', '速度']].map(([k, n]) => html`<div class="stat">${n}<b>${st[k]}</b></div>`)}<div class="stat">经验<b>${Math.floor(p.xp / C.xpNeed(p.lv) * 100)}%</b></div></div>
      <h3>饰品</h3><button type="button" class=${'charm wide' + (p.charm ? ' q' + p.charm.q : '')} onClick=${() => (p.charm ? openGear({ from: 'pet', uid: p.uid }) : toast('在背包里点一件项链或戒指', '选「给伙伴」。'))}><${GearIcon} g=${p.charm} slot="neck" s=${16} />${p.charm ? gearName(p.charm) : '空着，可以戴一件项链或戒指'}</button>`;
  else if (tab === 'skill') body = html`<${SkillTab} p=${p} />`;
  else body = html`<${EvoTab} p=${p} />`;
  return html`<${Head} title=${C.petName(p)} />
    <div class="scroll">
      <div class="pethead"><${Portrait} id=${p.id} s=${72} p=${p} /><div class="mid"><b>${C.petName(p)}<small>　Lv.${p.lv}</small> <${El} el=${m.el} />${p.shiny ? html`<span class="tag shinytag">异色</span>` : null}</b>
        <small><${Stars} n=${C.aptStars(p)} />　性格：${natureText(p)}</small><small>天赋：<b>${t?.name}</b>　${t?.desc}</small>
        <div class="loveline"><${Icon} n="heart" s=${14} /><span>亲密度 ${lv}</span><div class="xp"><i style=${`width:${C.loveProgress(p) * 100}%`}></i></div><${Btn} disabled=${!(s.bag.items.treat > 0) || lv >= PETS.loveMax} onClick=${() => { const r = C.feed(s, p.uid); if (r) { save(); toast(r.up ? `亲密度升到 ${r.lv} 级` : `${C.petName(p)}很开心`, r.up && r.lv === PETS.slot4Love ? '第四个技能槽开了' : `还剩 ${s.bag.items.treat} 个灵果`); } }}>喂灵果 ${s.bag.items.treat || 0}</${Btn}></div></div></div>
      <div class="gacts">${p.home ? null : on ? html`<${Btn} ghost onClick=${() => setActive(p.uid, false)}>休息</${Btn}>` : html`<${Btn} disabled=${full} onClick=${() => setActive(p.uid, true)}>${full ? '出战满了' : '出战'}</${Btn}>`}
        <${Btn} ghost disabled=${!p.home && C.housed(s).length >= C.houseCap(s) || p.home && C.carried(s).length >= C.CARRY_MAX} onClick=${() => { if (C.setHome(s, p.uid, !p.home)) { save(); refreshLook(); toast(p.home ? '住进伙伴屋了' : '跟着你走了'); } }}>${p.home ? '带在身上' : '放进伙伴屋'}</${Btn}>
        <${Btn} ghost disabled=${p.lv < PETS.fuseLv} onClick=${() => { ui.fuseA = p.uid; ui.fuseB = null; openSheet('fuse', { push: true }); }}>${p.lv < PETS.fuseLv ? `${PETS.fuseLv} 级可融合` : '融合'}</${Btn}><${FreeBtn} p=${p} /></div>
      <${Tabs} tab=${tab} set=${setTab} list=${[['apt', '资质'], ['skill', `技能 ${p.skills.length}/${C.skillSlots(p)}`], ['evo', C.canEvolve(s, p) ? '进化 !' : '进化']]} />
      <div key=${tab}>${body}</div>
    </div>`;
}

// ---------- 融合 ----------
function fusePage() {
  const s = store.s, a = s.pets.find(x => x.uid === ui.fuseA), [bId, setB] = useState(ui.fuseB), [sure, setSure] = useState(false);
  if (!a) return html`<${Head} title="融合" /><p class="hint">这只伙伴已经不在了。</p>`;
  const b = s.pets.find(x => x.uid === bId), pool = s.pets.filter(x => x.uid !== a.uid && x.lv >= PETS.fuseLv), pv = b && C.fusePreview(a, b);
  return html`<${Head} title="融合" right=${html`<span class="gold"><${Coin} />${s.wallet.gold}</span>`} />
    <p class="hint">两只 ${PETS.fuseLv} 级以上的伙伴融合成一只新的「${MONSTERS[a.id].name}」，从 1 级重新养。每项资质取两只里较高的那个，再上下浮动 8%；另一只会传下 1 到 2 个技能。两只都会消失，花 ${PETS.fuseCost} 金币。</p>
    <div class="scroll">
      <h3>选另一只</h3>${pool.length ? html`<div class="chipsel">${pool.map(x => html`<button type="button" class=${'petb' + (x.uid === bId ? ' on' : '')} onClick=${() => { ui.fuseB = x.uid; setB(x.uid); setSure(false); }}><${Portrait} id=${x.id} s=${30} p=${x} />${C.petName(x)}<small>Lv.${x.lv} · ${C.aptStars(x)}★</small></button>`)}</div>` : html`<p class="hint">没有别的 ${PETS.fuseLv} 级以上的伙伴。</p>`}
      ${pv ? html`<h3>新伙伴的资质范围</h3><div class="fuserange">${C.APT_KEYS.map(k => html`<div><span>${C.APT_NAME[k]}</span><b>${pv.lo[k]} 到 ${pv.hi[k]}</b><small>${a.apt[k]} / ${b.apt[k]}</small></div>`)}</div>
        <p class="hint">可能传下的技能：${pv.inherit.length ? pv.inherit.map(id => SKILLS[id].name).join('、') : '没有（另一只会的它都会）'}。${a.charm || b.charm ? '戴着的饰品会退回背包。' : ''}</p>
        <button type="button" class=${'primary' + (sure ? ' warn' : '')} disabled=${!C.canFuse(s, a, b)} onClick=${() => { if (!sure) return setSure(true); const r = C.fuse(s, a.uid, b.uid, C.addPet); if (!r) return; save(); refreshLook(); ui.petSel = r.pet.uid; ui.stack = ['pets']; ui.sheet = 'pet'; toast(`融合出新的${C.petName(r.pet)}（${C.aptStars(r.pet)}★）`, r.inherit.length ? `传下了：${r.inherit.map(id => SKILLS[id].name).join('、')}` : '', 3500); }}>${sure ? '确定融合，两只都会消失' : html`<${Icon} n="sparkle" s=${16} /> 融合　<${Coin} s=${14} />${PETS.fuseCost}`}</button>` : null}
    </div>`;
}

export const petPages = { pets: petsPage, pet: petPage, fuse: fusePage };
