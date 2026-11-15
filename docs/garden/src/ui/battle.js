// 战斗界面：行动顺序条、名牌（血条、状态、破绽条）、指令、飘字，按顺序播放战斗事件。
// 这部分动画密集，直接操作 DOM。
import * as C from '../core/index.js';
import { ITEMS, MONSTERS, ELEMENTS, EL_COLOR, STATUS, GEAR, ADVANCE_LV } from '../data/index.js';
import { store, save, refresh } from './store.js';
import { ui, setMode, showReport, toast } from './app.js';
import { iconSvg } from './icons.js';

const $ = id => document.getElementById(id);
let speed = 1;
const sleep = ms => new Promise(r => setTimeout(r, ms / speed));
const hex = el => parseInt((EL_COLOR[el] || '#ffffff').slice(1), 16);
const pct = (a, b) => Math.max(0, Math.min(100, a / b * 100)) + '%';
let view, battle = null, tgt = null, wildRef = null, cmdLocked = true, cmdPage = 'main', bond = 0;
const plates = {};
export const getBattle = () => battle;
const unitOf = key => battle.units.find(u => u.key === key);
const portraitOf = u => `portraits/${u.key === 'hero' ? store.s.hero.cls : u.mid}.png`;

async function flash(fn) { $('flash').classList.add('on'); await sleep(230); await fn(); $('flash').classList.remove('on'); }
export { flash };

// ---------- 名牌 ----------
// 名牌上的状态按事件一步步更新，不直接读战斗的最终结果（否则会剧透）
function buildPlate(u) {
  const d = document.createElement('div'); d.className = 'plate' + (u.boss ? ' boss' : '') + (u.side === 'a' ? ' ally' : ''); d.dataset.k = u.key;
  d.innerHTML = (u.side === 'a' ? `<img class="pp${u.shiny ? ' shiny' : ''}" src="${portraitOf(u)}" alt="">` : '') + `<div class="pn">${u.side === 'b' || u.key !== 'hero' ? `<span class="el el-${u.el}">${ELEMENTS[u.el]}</span>` : ''}${u.name}${u.lv ? `<small>Lv.${u.lv}</small>` : ''}</div>`
    + `<div class="gauge hp"><i></i><b class="sh"></b></div>${u.key === 'hero' ? '<div class="gauge mp"><i></i></div>' : ''}${u.boss ? '<div class="gauge brk"><i></i></div>' : ''}<div class="chips"></div>`;
  // 我方的状态放在底部一排卡片里，不挡住模型；敌方的名牌跟着头顶走
  const box = $(u.side === 'a' ? 'party' : 'plates'), old = box.querySelector(`[data-k="${u.key}"]`);
  if (old) old.replaceWith(d); else box.appendChild(d);
  plates[u.key] = { el: d, hp: u.hp, max: u.st.hp, fx: {}, shield: 0, brk: u.brk || 0, ally: u.side === 'a' };
  drawPlate(u.key); if (u.key === 'hero') setMp();
}
function buildPlates() { $('plates').innerHTML = ''; $('party').innerHTML = ''; for (const k in plates) delete plates[k]; for (const u of battle.units) buildPlate(u); markTarget(); }
function drawPlate(key) {
  const p = plates[key]; if (!p) return;
  p.el.querySelector('.hp i').style.width = pct(p.hp, p.max);
  p.el.querySelector('.sh').style.width = p.shield ? pct(Math.min(p.shield, p.max), p.max) : '0';
  const brk = p.el.querySelector('.brk i'); if (brk) brk.style.width = p.brk + '%';
  p.el.querySelector('.chips').innerHTML = Object.keys(p.fx).filter(k => k !== 'shield').map(k => `<span class="chip fx-${STATUS[k].kind}">${STATUS[k].name}${k === 'burn' && p.fx[k] > 1 ? p.fx[k] : ''}</span>`).join('');
  p.el.classList.toggle('hidden', !!p.fx.stealth); p.el.classList.toggle('down', !!p.fx.broken);
}
function markTarget() {
  const foes = battle.units.filter(u => u.side === 'b' && plates[u.key]?.hp > 0);
  const vis = foes.filter(f => !plates[f.key].fx.stealth), pool = vis.length ? vis : foes;
  if (!pool.some(f => f.key === tgt)) tgt = (pool.find(f => f.boss) || pool[0])?.key || null;
  for (const k in plates) plates[k].el.classList.toggle('tgt', k === tgt && !cmdLocked);
}
function setHp(key, hp) { const p = plates[key]; if (!p) return; p.hp = hp; drawPlate(key); }
function setMp() { const u = battle.units[0]; plates.hero?.el.querySelector('.mp i') && (plates.hero.el.querySelector('.mp i').style.width = pct(u.mp, u.st.mp)); }
function floatText(key, text, cls = '') {
  const p = view.screenPos(key, false); if (!p) return;
  const d = document.createElement('div'); d.className = 'float ' + cls; d.textContent = text;
  d.style.left = p.x + (Math.random() * 30 - 15) + 'px'; d.style.top = p.y + 'px'; document.body.appendChild(d); setTimeout(() => d.remove(), 950);
}
let bannerTimer = 0;
function banner(text, ms = 900, cls = '') { const b = $('banner'); b.textContent = text; b.className = cls; b.hidden = false; clearTimeout(bannerTimer); bannerTimer = setTimeout(() => { b.hidden = true; }, ms / speed); }

// ---------- 行动顺序条 ----------
function drawOrder(order, now) {
  const list = [now, ...order].filter(Boolean).slice(0, 8);
  $('order').innerHTML = list.map((k, i) => { const u = unitOf(k); if (!u) return ''; return `<span class="o ${u.side === 'a' ? 'a' : 'b'}${i === 0 ? ' now' : ''}${u.boss ? ' boss' : ''}"><img class="${u.shiny ? 'shiny' : ''}" src="${portraitOf(u)}" alt="">${i === 0 ? '<em>行动</em>' : ''}</span>`; }).join('');
}

// ---------- 指令 ----------
function renderCmd() {
  const s = store.s, el = $('cmd'), hero = battle.units[0]; el.classList.toggle('locked', cmdLocked);
  const backBtn = '<button class="opt back" data-c="back" type="button">' + iconSvg('back', 18) + '<b>返回</b></button>';
  if (cmdPage === 'skill') {
    el.innerHTML = '<div class="list">' + hero.skills.filter(k => k.kind !== 'passive').map(k => { const cost = C.mpCost(hero, k), used = k.once && battle.used['hero' + k.id]; return `<button class="opt" data-c="skill" data-i="${k.id}" ${hero.mp < cost || used ? 'disabled' : ''} type="button">${k.el ? `<span class="el el-${k.el}">${ELEMENTS[k.el]}</span>` : iconSvg('sparkle', 18)}<b>${k.name}<small> Lv.${k.lv}</small></b><span>${k.desc || ''}</span><em>${used ? '已用过' : '灵气 ' + cost}</em></button>`; }).join('') + backBtn + '</div>';
  } else if (cmdPage === 'item') {
    const bench = C.benchPets(battle, s), slot = swapSlot();
    el.innerHTML = '<div class="list">' + ['pill', 'dew'].map(id => { const it = ITEMS[id], n = s.bag.items[id] || 0; return `<button class="opt" data-c="item" data-i="${id}" ${n ? '' : 'disabled'} type="button"><span class="gi sm item-${id}">${iconSvg(it.icon, 18)}</span><b>${it.name}</b><span>${it.desc}</span><em>×${n}</em></button>`; }).join('')
      + bench.slice(0, 3).map(p => `<button class="opt" data-c="swap" data-i="${p.uid}" type="button"><img class="pp" src="portraits/${p.id}.png" alt=""><b>换上${MONSTERS[p.id].name}</b><span>${slot ? `换下${unitOf(slot).name}，` : ''}用掉这次行动</span><em>Lv.${p.lv}</em></button>`).join('')
      + backBtn + '</div>';
  } else {
    const many = battle.units.filter(u => u.side === 'b' && plates[u.key]?.hp > 0).length > 1, seeds = s.bag.items.seed || 0;
    const combo = C.comboFor(battle, s), ready = bond >= C.BOND_MAX && combo;
    el.innerHTML = `${many && !cmdLocked && !ready ? '<div class="tip">点敌人头上的名字可以换目标</div>' : ''}
      ${ready ? `<button class="combo" data-c="combo" type="button">${iconSvg('star', 20)}<b>连携技 · ${combo.name}</b><span>${combo.desc}</span></button>`
        : `<div class="bond"><span>默契</span><div class="gauge"><i style="width:${bond}%"></i></div><b>${bond}</b></div>`}
      <div class="row">
      <button class="cb main" data-c="attack" type="button">${iconSvg('sword', 30)}<span>攻击</span></button>
      <div class="grid4">
        <button class="cb" data-c="skills" type="button">${iconSvg('sparkle')}<span>技能</span></button>
        <button class="cb" data-c="items" type="button">${iconSvg('herb')}<span>道具</span></button>
        <button class="cb" data-c="capture" ${seeds > 0 ? '' : 'disabled'} type="button">${iconSvg('seed')}<span>捕捉</span>${seeds ? `<em>${seeds}</em>` : ''}</button>
        <button class="cb" data-c="flee" ${battle.isBoss ? 'disabled' : ''} type="button">${iconSvg('wind')}<span>逃跑</span></button>
      </div></div>`;
  }
  markTarget();
}
// 换伙伴换下谁：倒下的、或血量比例最低的；没满两只就直接加
function swapSlot() {
  const pets = battle.units.filter(u => u.side === 'a' && u.key !== 'hero');
  if (pets.filter(u => u.hp > 0).length < 2) { const dead = pets.find(u => u.hp <= 0); return dead ? dead.key : null; }
  return pets.reduce((a, c) => (c.hp / c.st.hp < a.hp / a.st.hp ? c : a)).key;
}
function setAuto(on) { store.s.settings.auto = on; save(); const b = $('bAuto'); b.textContent = on ? '自动 开' : '自动 关'; b.classList.toggle('on', on); }
function setSpeed(n) { speed = n; store.s.settings.speed = n; save(); const b = $('bSpeed'); b.textContent = n + ' 倍'; b.classList.toggle('on', n > 1); }

export function initBattle(v) {
  view = v;
  $('plates').addEventListener('click', e => { const p = e.target.closest('.plate'); if (!p || cmdLocked) return; const u = unitOf(p.dataset.k); if (u.side === 'b' && plates[u.key].hp > 0 && !plates[u.key].fx.stealth) { tgt = u.key; markTarget(); } });
  $('cmd').addEventListener('click', e => {
    const b = e.target.closest('[data-c]'); if (!b || b.disabled || cmdLocked) return; const c = b.dataset.c, i = b.dataset.i;
    if (c === 'skills') { cmdPage = 'skill'; renderCmd(); } else if (c === 'items') { cmdPage = 'item'; renderCmd(); } else if (c === 'back') { cmdPage = 'main'; renderCmd(); }
    else if (c === 'attack') go({ type: 'attack', target: tgt });
    else if (c === 'skill') go({ type: 'skill', skill: i, target: tgt });
    else if (c === 'item') go({ type: 'item', item: i });
    else if (c === 'swap') go({ type: 'swap', uid: i, slot: swapSlot() });
    else if (c === 'combo') go({ type: 'combo', target: tgt });
    else if (c === 'capture') go({ type: 'capture', target: tgt });
    else if (c === 'flee') go({ type: 'flee' });
  });
  $('bAuto').addEventListener('click', () => { const s = store.s; setAuto(!s.settings.auto); if (s.settings.auto && battle && !cmdLocked) go(C.autoHeroAction(battle, s)); });
  $('bSpeed').addEventListener('click', () => setSpeed(speed > 1 ? 1 : 2));
}
export const look = () => { const s = store.s, p = C.activePet(s); return { cls: s.hero.cls, pet: p ? { id: p.id, evo: p.evo || 0, shiny: !!p.shiny, tint: C.petTint(p) } : null }; };

export async function startEncounter(id, isBoss, wildObj) {
  const s = store.s; if (ui.busy || !s || ui.sheet) return; ui.busy = true; wildRef = wildObj;
  const zone = C.zoneOf(s); battle = C.startBattle(s, C.makeEncounter(zone, id, isBoss), isBoss); tgt = null; cmdLocked = true; cmdPage = 'main'; bond = 0;
  await flash(async () => {
    await view.enterBattle(battle, look()); setMode('battle'); $('battle').hidden = false;
    $('bZone').textContent = isBoss ? `${zone.name} · 首领` : zone.name; $('bRound').textContent = '第 1 回合';
    setAuto(!!s.settings.auto); setSpeed(s.settings.speed || 1); buildPlates(); drawOrder(C.forecast(battle, 8)); renderCmd();
  });
  save();
  const boss = battle.units.find(u => u.boss);
  banner(isBoss ? `${boss.name}挡住了去路` : `野生的${battle.units.find(u => u.side === 'b').name}出现了`, 1300);
  if (boss) { await view.anim.focus(boss.key, 7.5, 0.5); await sleep(500); await view.anim.unfocus(); } else await sleep(700);
  go(null, true);
}
function yourTurn() {
  $('bRound').textContent = `第 ${battle.turn} 回合`; cmdPage = 'main';
  if (store.s.settings.auto) { cmdLocked = true; renderCmd(); setTimeout(() => { if (battle && !battle.over) go(C.autoHeroAction(battle, store.s), true); }, 250 / speed); }
  else { cmdLocked = false; renderCmd(); }
}

const FX_TEXT = { freeze: '冻住了', sleep: '睡着了', broken: '倒地中' };
async function go(action, fromAuto) {
  if (cmdLocked && !fromAuto) return; cmdLocked = true; cmdPage = 'main'; renderCmd();
  const ev = C.play(battle, store.s, action);
  for (let i = 0; i < ev.length; i++) {
    const e = ev[i], u = e.who && unitOf(e.who);
    if (e.t === 'turn') { drawOrder(e.order, e.who); bond = e.bond; for (const k in plates) plates[k].el.classList.toggle('acting', k === e.who); }
    else if (e.t === 'yourTurn') bond = e.bond;
    else if (e.t === 'act') {
      const color = e.kind === 'heal' ? 0x9dffb0 : e.kind === 'buff' ? 0xffe38a : e.kind === 'debuff' ? 0xc59cff : hex(e.el || u.el);
      if (e.combo) { banner(`连携技 · ${e.name}`, 1400, 'combo'); await view.anim.focus(e.who, 8, 0.3); view.anim.cast(e.combo, color); await view.anim.cast(e.who, color); view.anim.shake(0.5, 0.3); }
      else if (e.counter) floatText(e.who, '反击', 'txt weak');
      else if (!e.plain) banner(e.name, 900, e.who.startsWith('e') ? 'foe' : '');
      if (e.confused) floatText(e.who, '晕头转向', 'txt');
      if (e.who === 'hero') setMp();
      const next = ev.slice(i + 1).find(x => x.t === 'hit' || x.t === 'miss' || x.t === 'act' || x.t === 'turn');
      const toKey = e.target || (next && (next.t === 'hit' || next.t === 'miss') ? next.who : null);
      if (e.combo) { if (e.all) await view.anim.wave(u.side === 'a' ? 'b' : 'a', color); else if (toKey) await view.anim.bolt(e.who, toKey, color, true); }
      else if (e.kind === 'phys') { if (e.all) { view.anim.wave(u.side === 'a' ? 'b' : 'a', color); await view.anim.lunge(e.who, null); } else await view.anim.lunge(e.who, toKey); }
      else if (e.kind === 'magic') { await view.anim.cast(e.who, color); if (e.all) await view.anim.wave(u.side === 'a' ? 'b' : 'a', color); else if (toKey) await view.anim.bolt(e.who, toKey, color); }
      else if (e.kind === 'capture') await sleep(100);
      else if (e.kind === 'item') await view.anim.flash(e.who);
      else if (e.kind === 'buff') await view.anim.buff(e.who, color);
      else await view.anim.cast(e.who, color);
      if (e.combo) view.anim.unfocus();
    } else if (e.t === 'hit') {
      setHp(e.who, e.hp);
      const dotTxt = e.dot === 'burn' ? '灼烧 ' : e.dot === 'poison' ? '中毒 ' : '';
      if (e.absorbed) floatText(e.who, `护盾 -${e.absorbed}`, 'txt mpc');
      if (e.dmg || !e.absorbed) floatText(e.who, dotTxt + '-' + e.dmg, e.crit ? 'crit' : e.eff > 0 ? 'weak' : e.dot ? 'dot' : '');
      if (e.eff > 0) setTimeout(() => floatText(e.who, '克制', 'txt weak'), 120 / speed); else if (e.eff < 0) setTimeout(() => floatText(e.who, '抵抗', 'txt'), 120 / speed);
      if (e.crit) view.anim.shake(0.35, 0.22);
      view.anim.hit(e.who, e.dot === 'burn' ? 0xff8a4a : e.dot === 'poison' ? 0xb07cff : e.el && e.el !== 'none' ? hex(e.el) : 0xffffff, e.crit); await sleep(e.dot ? 300 : 240);
    } else if (e.t === 'miss') { floatText(e.who, '闪开了', 'txt'); await sleep(240); }
    else if (e.t === 'revive') { const p = plates[e.who]; p.el.classList.remove('dead'); setHp(e.who, e.hp); floatText(e.who, '站起来了', 'txt heal'); await view.anim.revive(e.who); await view.anim.heal(e.who); }
    else if (e.t === 'endure') { floatText(e.who, '撑住了', 'txt weak'); await sleep(300); }
    else if (e.t === 'cover') { floatText(e.who, '挡在前面', 'txt'); await view.anim.flash(e.who); }
    else if (e.t === 'ko') { const p = plates[e.who]; p.fx = {}; p.shield = 0; p.el.classList.add('dead'); await view.anim.ko(e.who); }
    else if (e.t === 'heal') { setHp(e.who, e.hp); floatText(e.who, '+' + e.n, 'heal'); await view.anim.heal(e.who); }
    else if (e.t === 'mp') { setMp(); floatText(e.who, '灵气 +' + e.n, 'mpc txt'); await sleep(350); }
    else if (e.t === 'fx') { const p = plates[e.who]; p.fx[e.fx] = e.stacks || 1; drawPlate(e.who); floatText(e.who, STATUS[e.fx].name, 'txt fx-' + STATUS[e.fx].kind); await sleep(200); }
    else if (e.t === 'fxEnd') { const p = plates[e.who]; if (p) { delete p.fx[e.fx]; if (e.fx === 'shield') p.shield = 0; if (e.fx === 'broken') view.anim.up(e.who); drawPlate(e.who); } }
    else if (e.t === 'resist') { floatText(e.who, '没中招', 'txt'); await sleep(160); }
    else if (e.t === 'shield') { const p = plates[e.who]; p.shield = e.n; p.fx.shield = 1; drawPlate(e.who); floatText(e.who, '护盾', 'txt mpc'); await view.anim.buff(e.who, 0x9fd8ff); }
    else if (e.t === 'skip') { floatText(e.who, FX_TEXT[e.why] || '动不了', 'txt'); await sleep(420); }
    else if (e.t === 'brk') { plates[e.who].brk = e.v; drawPlate(e.who); }
    else if (e.t === 'break') { plates[e.who].brk = 0; plates[e.who].fx.broken = 1; drawPlate(e.who); banner(`破绽！${u.name}倒地了`, 1300, 'combo'); view.anim.shake(0.6, 0.35); await view.anim.down(e.who); await sleep(500); }
    else if (e.t === 'phase') { banner(e.text, 1800, 'foe'); await view.anim.focus(e.who, 7.5, 0.4); view.anim.shake(0.4, 0.4); await sleep(1100); await view.anim.unfocus(); }
    else if (e.t === 'el') { const pe = plates[e.who].el.querySelector('.el'); if (pe) { pe.className = 'el el-' + e.el; pe.textContent = ELEMENTS[e.el]; } floatText(e.who, `变成${ELEMENTS[e.el]}属性`, 'txt weak'); await sleep(400); }
    else if (e.t === 'summon') { await view.addActor(u); buildPlate(u); floatText(e.who, '来帮忙了', 'txt'); await sleep(250); }
    else if (e.t === 'swap') { await view.swapActor(u); buildPlate(u); floatText(e.who, '上场', 'txt'); await sleep(200); }
    else if (e.t === 'flee') { banner(e.ok ? '跑掉了' : battle.isBoss ? '首领面前跑不掉' : '没跑掉'); await sleep(600); }
    else if (e.t === 'capture') {
      if (e.boss) { banner('首领不会跟你走'); await sleep(700); }
      else { await view.anim.capture('hero', e.who, e.ok); banner(e.ok ? '成功了' : '它挣脱了'); if (e.ok) { plates[e.who].hp = 0; plates[e.who].el.classList.add('dead'); } await sleep(500); }
    }
    markTarget();
  }
  for (const k in plates) plates[k].el.classList.remove('acting');
  if (battle.over) return endBattle();
  yourTurn();
}
async function endBattle() {
  await sleep(450);
  const s = store.s, over = battle.over, zoneBefore = s.world.zone, log = C.finishBattle(battle, s); save();
  const lines = log.map(l => {
    if (l.t === 'lose') return { text: `你们都倒下了，灯灵把你接回了小岛。${l.lost ? `路上丢了 ${l.lost} 金币。` : ''}` };
    if (l.t === 'reward') return { text: `经验 +${l.xp}　金币 +${l.gold}` };
    if (l.t === 'levelup') return l.who === 'hero' ? { big: 1, text: `升到 ${l.lv} 级，得到 3 点属性点和 1 点技能点${l.skill ? `，学会了「${l.skill}」` : ''}` } : { text: `${l.name}升到 ${l.lv} 级` };
    if (l.t === 'epi') return { big: 1, text: l.text };
    if (l.t === 'unlock') return { big: 1, text: `新地图开放：${l.zone}` };
    if (l.t === 'gear') return { text: `捡到 ${GEAR.quality[l.g.q].name}装备 ${l.g.name}`, q: l.g.q };
    if (l.t === 'item') return { text: `捡到 ${ITEMS[l.id].name}${l.n > 1 ? ' ×' + l.n : ''}` };
    if (l.t === 'gem') return { text: `捡到 ${GEAR.gems[l.el].name}` };
    if (l.t === 'advance') return { big: 1, text: `到了 ${ADVANCE_LV} 级，可以转职了：去角色页的「技能」选一条路线` };
    if (l.t === 'caught') return { big: 1, pet: l.id, text: `${l.shiny ? '异色的' : ''}${MONSTERS[l.id].name}成了你的伙伴（资质 ${'★'.repeat(l.stars || 1)}）${l.home ? '，随身已满，先住进伙伴屋' : ''}` };
    if (l.t === 'love') return { text: `和${l.name}更亲近了：亲密度 ${l.lv} 级${l.lv === 5 ? '，解锁第四个技能槽' : ''}` };
    if (l.t === 'petfull') return { text: '随身和伙伴屋都满了，它跑掉了。可以用星砂扩建伙伴屋。' };
    return null;
  }).filter(Boolean);
  const leave = async () => {
    await flash(async () => {
      $('battle').hidden = true; view.exitBattle();
      if (over === 'lose' && zoneBefore !== 'home') await view.loadZone(C.zoneOf(s), look());
      else { if (wildRef) view.removeWild(wildRef); await view.setPet(look().pet); }
      setMode('world');
    });
    battle = null; wildRef = null; ui.busy = false;
    const h = s.hero;
    if (over === 'win' && (h.pts > 0 || h.sp > 0)) toast(h.sp > 0 ? `有 ${h.sp} 点技能点没用` : `有 ${h.pts} 点属性点没用`, '点左上角的头像去加点。');
  };
  if (!lines.length) return leave();
  showReport(over === 'lose' ? '战斗失败' : '战斗胜利', lines, leave);
}

// 每帧让名牌跟着角色
export function followPlates() {
  if (!battle) return;
  for (const k in plates) { if (plates[k].ally) continue; const p = view.screenPos(k, true); if (p) { plates[k].el.style.left = Math.max(56, Math.min(innerWidth - 56, p.x)) + 'px'; plates[k].el.style.top = p.y + 'px'; } }
}
export { refresh };
