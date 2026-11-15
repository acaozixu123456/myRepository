// 战斗界面：名牌、指令、飘字和播放战斗事件。这部分动画密集，直接操作 DOM。
import * as C from '../core/index.js';
import { SKILLS, ITEMS, MONSTERS, ELEMENTS } from '../data/index.js';
import { store, save, refresh } from './store.js';
import { ui, setMode, showReport, toast } from './app.js';
import { iconSvg } from './icons.js';

const $ = id => document.getElementById(id), sleep = ms => new Promise(r => setTimeout(r, ms));
const EL_HEX = { none: 0xffffff, grass: 0x8fe36a, water: 0x6cc8ff, fire: 0xff8a4a };
const pct = (a, b) => Math.max(0, Math.min(100, a / b * 100)) + '%';
let view, battle = null, tgt = null, wildRef = null, cmdLocked = true, cmdPage = 'main';
const plates = {};
export const getBattle = () => battle;

async function flash(fn) { $('flash').classList.add('on'); await sleep(230); await fn(); $('flash').classList.remove('on'); }
export { flash };

function buildPlates() {
  const box = $('plates'); box.innerHTML = ''; for (const k in plates) delete plates[k];
  for (const u of battle.units) {
    const d = document.createElement('div'); d.className = 'plate' + (u.boss ? ' boss' : ''); d.dataset.k = u.key;
    d.innerHTML = `<div class="pn">${u.side === 'b' ? `<span class="el el-${u.el}">${ELEMENTS[u.el]}</span>` : ''}${u.name}${u.lv ? `<small>Lv.${u.lv}</small>` : ''}</div><div class="gauge hp"><i style="width:${pct(u.hp, u.st.hp)}"></i></div>${u.key === 'hero' ? `<div class="gauge mp"><i style="width:${pct(u.mp, u.st.mp)}"></i></div>` : ''}`;
    box.appendChild(d); plates[u.key] = { el: d, hp: u.hp };
  }
  markTarget();
}
function markTarget() {
  const foes = battle.units.filter(u => u.side === 'b' && plates[u.key].hp > 0);
  if (!foes.some(f => f.key === tgt)) tgt = foes[0]?.key || null;
  for (const k in plates) plates[k].el.classList.toggle('tgt', k === tgt && !cmdLocked);
}
function setHp(key, hp) { const u = battle.units.find(x => x.key === key), p = plates[key]; p.hp = hp; p.el.querySelector('.hp i').style.width = pct(hp, u.st.hp); }
function setMp() { const u = battle.units[0]; plates.hero.el.querySelector('.mp i').style.width = pct(u.mp, u.st.mp); }
function floatText(key, text, cls = '') {
  const p = view.screenPos(key, false); if (!p) return;
  const d = document.createElement('div'); d.className = 'float ' + cls; d.textContent = text;
  d.style.left = p.x + (Math.random() * 30 - 15) + 'px'; d.style.top = p.y + 'px'; document.body.appendChild(d); setTimeout(() => d.remove(), 950);
}
let bannerTimer = 0;
function banner(text, ms = 900) { const b = $('banner'); b.textContent = text; b.hidden = false; clearTimeout(bannerTimer); bannerTimer = setTimeout(() => { b.hidden = true; }, ms); }

function renderCmd() {
  const s = store.s, el = $('cmd'), hero = battle.units[0]; el.classList.toggle('locked', cmdLocked);
  const backBtn = '<button class="opt back" data-c="back" type="button">' + iconSvg('back', 18) + '<b>返回</b></button>';
  if (cmdPage === 'skill') {
    el.innerHTML = '<div class="list">' + hero.skills.map(id => { const k = SKILLS[id]; return `<button class="opt" data-c="skill" data-i="${id}" ${hero.mp < k.mp ? 'disabled' : ''} type="button">${k.el ? `<span class="el el-${k.el}">${ELEMENTS[k.el]}</span>` : iconSvg('sparkle', 18)}<b>${k.name}</b><span>${k.desc}</span><em>灵气 ${k.mp}</em></button>`; }).join('') + backBtn + '</div>';
  } else if (cmdPage === 'item') {
    el.innerHTML = '<div class="list">' + ['pill', 'dew'].map(id => { const it = ITEMS[id], n = s.bag.items[id] || 0; return `<button class="opt" data-c="item" data-i="${id}" ${n ? '' : 'disabled'} type="button"><span class="gi sm item-${id}">${iconSvg(it.icon, 18)}</span><b>${it.name}</b><span>${it.desc}</span><em>×${n}</em></button>`; }).join('') + backBtn + '</div>';
  } else {
    const many = battle.units.filter(u => u.side === 'b' && plates[u.key]?.hp > 0).length > 1, seeds = s.bag.items.seed || 0;
    el.innerHTML = `${many && !cmdLocked ? '<div class="tip">点敌人头上的名字可以换目标</div>' : ''}<div class="row">
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
function setAuto(on) { store.s.settings.auto = on; save(); const b = $('bAuto'); b.textContent = on ? '自动 开' : '自动 关'; b.classList.toggle('on', on); }

export function initBattle(v) {
  view = v;
  $('plates').addEventListener('click', e => { const p = e.target.closest('.plate'); if (!p || cmdLocked) return; const u = battle.units.find(x => x.key === p.dataset.k); if (u.side === 'b' && plates[u.key].hp > 0) { tgt = u.key; markTarget(); } });
  $('cmd').addEventListener('click', e => {
    const b = e.target.closest('[data-c]'); if (!b || b.disabled || cmdLocked) return; const c = b.dataset.c, i = b.dataset.i;
    if (c === 'skills') { cmdPage = 'skill'; renderCmd(); } else if (c === 'items') { cmdPage = 'item'; renderCmd(); } else if (c === 'back') { cmdPage = 'main'; renderCmd(); }
    else if (c === 'attack') playRound({ type: 'attack', target: tgt });
    else if (c === 'skill') playRound({ type: 'skill', skill: i, target: tgt });
    else if (c === 'item') playRound({ type: 'item', item: i });
    else if (c === 'capture') playRound({ type: 'capture', target: tgt });
    else if (c === 'flee') playRound({ type: 'flee' });
  });
  $('bAuto').addEventListener('click', () => { const s = store.s; setAuto(!s.settings.auto); if (s.settings.auto && battle && !cmdLocked) playRound(C.autoHeroAction(battle, s)); });
}
export const look = () => { const s = store.s, p = C.activePet(s); return { cls: s.hero.cls, pet: p ? p.id : null }; };

export async function startEncounter(id, isBoss, wildObj) {
  const s = store.s; if (ui.busy || !s || ui.sheet) return; ui.busy = true; wildRef = wildObj;
  const zone = C.zoneOf(s); battle = C.startBattle(s, C.makeEncounter(zone, id, isBoss), isBoss); tgt = null; cmdLocked = true; cmdPage = 'main';
  await flash(async () => {
    await view.enterBattle(battle, look()); setMode('battle'); $('battle').hidden = false;
    $('bZone').textContent = isBoss ? `${zone.name} · 首领` : zone.name; $('bRound').textContent = '第 1 回合'; setAuto(!!s.settings.auto); buildPlates(); renderCmd();
  });
  save();
  banner(isBoss ? `${battle.units.find(u => u.boss).name}挡住了去路` : `野生的${battle.units.find(u => u.side === 'b').name}出现了`, 1300);
  await sleep(700); nextTurn();
}
function nextTurn() {
  $('bRound').textContent = `第 ${battle.round + 1} 回合`; cmdPage = 'main';
  if (store.s.settings.auto) { cmdLocked = true; renderCmd(); setTimeout(() => { if (battle && !battle.over) playRound(C.autoHeroAction(battle, store.s), true); }, 250); }
  else { cmdLocked = false; renderCmd(); }
}
async function playRound(action, fromAuto) {
  if (cmdLocked && !fromAuto) return; cmdLocked = true; cmdPage = 'main'; renderCmd();
  const ev = C.runRound(battle, store.s, action);
  for (let i = 0; i < ev.length; i++) {
    const e = ev[i];
    if (e.t === 'act') {
      if (!e.plain) banner(e.name);
      if (e.who === 'hero') setMp();
      const next = ev.slice(i + 1).find(x => x.t === 'hit' || x.t === 'miss' || x.t === 'act');
      if (e.kind === 'phys') await view.anim.lunge(e.who, next && next.t !== 'act' ? next.who : null);
      else if (e.kind === 'capture') await sleep(100);
      else if (e.kind === 'item') await view.anim.flash(e.who);
      else await view.anim.cast(e.who, e.kind === 'heal' ? 0x9dffb0 : EL_HEX[e.el || battle.units.find(u => u.key === e.who).el] || 0xffffff);
    } else if (e.t === 'hit') {
      setHp(e.who, e.hp);
      floatText(e.who, (e.burn ? '灼烧 ' : '') + '-' + e.dmg, e.crit ? 'crit' : e.eff > 0 ? 'weak' : '');
      if (e.eff > 0) setTimeout(() => floatText(e.who, '克制', 'txt weak'), 120); else if (e.eff < 0) setTimeout(() => floatText(e.who, '抵抗', 'txt'), 120);
      view.anim.hit(e.who, e.burn ? 0xff8a4a : 0xffffff, e.crit); await sleep(260);
    } else if (e.t === 'miss') { floatText(e.who, '闪开了', 'txt'); await sleep(260); }
    else if (e.t === 'ko') { plates[e.who].el.classList.add('dead'); await view.anim.ko(e.who); }
    else if (e.t === 'heal') { setHp(e.who, e.hp); floatText(e.who, '+' + e.n, 'heal'); await view.anim.heal(e.who); }
    else if (e.t === 'mp') { setMp(); floatText(e.who, '灵气 +' + e.n, 'mpc txt'); await sleep(350); }
    else if (e.t === 'fx') { floatText(e.who, { defDown: '防御下降', defUp: '防御提高', burn: '着火了' }[e.fx], 'txt'); await sleep(200); }
    else if (e.t === 'flee') { banner(e.ok ? '跑掉了' : battle.isBoss ? '首领面前跑不掉' : '没跑掉'); await sleep(600); }
    else if (e.t === 'capture') {
      if (e.boss) { banner('首领不会跟你走'); await sleep(700); }
      else { await view.anim.capture('hero', e.who, e.ok); banner(e.ok ? '成功了' : '它挣脱了'); if (e.ok) { plates[e.who].hp = 0; plates[e.who].el.classList.add('dead'); } await sleep(500); }
    }
    markTarget();
  }
  if (battle.over) return endBattle();
  nextTurn();
}
async function endBattle() {
  await sleep(450);
  const s = store.s, over = battle.over, zoneBefore = s.world.zone, log = C.finishBattle(battle, s); save();
  const lines = log.map(l => {
    if (l.t === 'lose') return { text: `你倒下了，灯灵把你接回了小岛。${l.lost ? `路上丢了 ${l.lost} 金币。` : ''}` };
    if (l.t === 'reward') return { text: `经验 +${l.xp}　金币 +${l.gold}` };
    if (l.t === 'levelup') return l.who === 'hero' ? { big: 1, text: `升到 ${l.lv} 级，得到 3 点属性点${l.skill ? `，学会了「${l.skill}」` : ''}` } : { text: `${l.name}升到 ${l.lv} 级` };
    if (l.t === 'unlock') return { big: 1, text: `新地图开放：${l.zone}` };
    if (l.t === 'gear') return { text: `捡到 ${l.g.name}（${Object.entries(l.g.st).map(([k, v]) => ({ atk: '攻击', mag: '法术', def: '防御', hp: '生命', spd: '速度' }[k]) + '+' + v).join(' ')}）` };
    if (l.t === 'item') return { text: `捡到 ${ITEMS[l.id].name}` };
    if (l.t === 'caught') return { big: 1, pet: l.id, text: `${MONSTERS[l.id].name}成了你的伙伴` };
    if (l.t === 'petfull') return { text: `伙伴已经有 ${C.PARTY_MAX} 只，它跑掉了。` };
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
    if (over === 'win' && s.hero.pts > 0) toast(`有 ${s.hero.pts} 点属性点没用`, '点左上角的头像加点。');
  };
  if (!lines.length) return leave();
  showReport(over === 'lose' ? '战斗失败' : '战斗胜利', lines, leave);
}

// 每帧让名牌跟着角色
export function followPlates() {
  if (!battle) return;
  for (const k in plates) { const p = view.screenPos(k, true); if (p) { plates[k].el.style.left = Math.max(56, Math.min(innerWidth - 56, p.x)) + 'px'; plates[k].el.style.top = p.y + 'px'; } }
}
export { refresh };
