// 界面和流程：选职业、走地图、回合制战斗、各种面板。规则在 core.js，画面在 view.js。
import { createView } from './view.js';
import * as C from './core.js';
import { SKILLS, CLASSES, MONSTERS, ZONES, ITEMS, EL_ICON, ELEMENTS, ATTR_NAME, ATTR_DESC, GEAR_SLOTS } from './data.js';

const $ = id => document.getElementById(id);
const KEY = 'rpg.v1', sleep = ms => new Promise(r => setTimeout(r, ms));
const EL_COLOR = { none: 0xffffff, grass: 0x8fe36a, water: 0x6cc8ff, fire: 0xff8a4a };
const ST_NAME = { atk: '攻击', mag: '法术', def: '防御', hp: '生命', spd: '速度', mp: '灵气' };
if (new URLSearchParams(location.search).has('reset')) localStorage.removeItem(KEY);
let s = null; try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) { s = null; }
if (s && (!CLASSES[s.cls] || !ZONES.some(z => z.id === s.zone))) s = null;
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* 存不了就算了 */ } };

const view = await createView($('c'), $('sky'), $('stars'));
let busy = true, battle = null, tgt = null, sheet = null, sheetLock = false, pickCls = 'cat';

// ---------- 小工具 ----------
let toastTimer = 0;
function toast(msg, ms = 2400) { const t = $('toast'); t.innerHTML = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms); }
const gearText = g => Object.entries(g.st).map(([k, v]) => `${ST_NAME[k]}+${v}`).join(' ');
const gearName = g => `${g.name}${g.plus ? ' +' + g.plus : ''}`;
const pct = (a, b) => Math.max(0, Math.min(100, a / b * 100)) + '%';
async function flash(fn) { $('flash').classList.add('on'); await sleep(230); await fn(); $('flash').classList.remove('on'); }

// ---------- 顶栏 ----------
function questLine() {
  const q = C.currentQuest(s);
  if (!q) return '所有委托都完成了，想去哪就去哪。';
  if (!s.qAccepted) return `灯灵有新的委托：${q.title}。点这里看看。`;
  if (C.questDone(s)) return `「${q.title}」完成了，点这里领奖励。`;
  const prog = q.type === 'level' ? `等级 ${s.lv}/${q.n}` : q.type === 'boss' ? `打败${MONSTERS[q.boss].name}` : `${Math.min(s.qn, q.n)}/${q.n}`;
  return `${q.title}　${prog}`;
}
function hud() {
  const st = C.heroStats(s);
  $('hName').textContent = `${CLASSES[s.cls].name}　Lv.${s.lv}`;
  $('hHp').style.width = pct(s.hp, st.hp); $('hHpT').textContent = `${s.hp}/${st.hp}`;
  $('hMp').style.width = pct(s.mp, st.mp); $('hMpT').textContent = `${s.mp}/${st.mp}`;
  $('hXp').style.width = pct(s.xp, C.xpNeed(s.lv));
  $('zoneName').textContent = C.zoneOf(s).name; $('gold').textContent = s.gold;
  $('ptCount').textContent = s.points > 0 ? s.points : ''; $('bagCount').textContent = s.bag.length || '';
  $('questText').textContent = questLine();
}

// ---------- 面板 ----------
function openSheet(name, lock = false) { sheet = name; sheetLock = lock; $('scrim').hidden = false; $('sheet').hidden = false; renderSheet(); }
function closeSheet() { sheet = null; sheetLock = false; $('scrim').hidden = true; $('sheet').hidden = true; hud(); }
const head = (title, right = `🪙 ${s.gold}`) => `<div class="head"><h2>${title}</h2><span>${right}</span></div>`;
let reportHtml = '', reportDone = null;

const sheets = {
  map() {
    return head('地图', '') + '<p class="hint">打败一张地图的首领，下一张地图就会开放。回到小岛会恢复全部体力。</p><div class="scroll">' + ZONES.map((z, i) => {
      const locked = i > s.unlocked, here = z.id === s.zone;
      return `<button class="rowi ${here ? 'on' : ''} ${locked ? 'locked' : ''}" data-a="go" data-i="${i}" ${locked || here ? 'disabled' : ''} type="button"><i>${['🏡', '🌿', '💧', '🍁', '❄️'][i]}</i><div class="mid"><b>${z.name}${z.lv ? `　Lv.${z.lv[0]}-${z.lv[1]}` : ''}</b><small>${locked ? '还没开放，先打败上一张地图的首领。' : z.desc}${z.boss && s.bosses[z.boss] ? ' 首领已打败。' : ''}</small></div>${here ? '<span class="mini ghost">在这里</span>' : locked ? '🔒' : '<span class="mini">前往</span>'}</button>`;
    }).join('') + '<a class="reset" href="garden.html">去看看以前种的花园</a></div>';
  },
  pets() {
    if (!s.pets.length) return head('伙伴', '0/6') + '<div class="talk">你还没有伙伴。<small>战斗里把野怪打到虚弱，再用「捕捉」丢出灵种，它就可能跟你走。血越少越容易成功，首领抓不了。</small></div>';
    return head('伙伴', `${s.pets.length}/6`) + '<p class="hint">出战的伙伴会跟着你一起战斗、一起升级。</p><div class="scroll">' + s.pets.map((p, i) => {
      const m = MONSTERS[p.id], st = C.petStats(p), on = i === s.active;
      return `<div class="rowi ${on ? 'on' : ''}"><i>${EL_ICON[m.el]}</i><div class="mid"><b>${m.name}　Lv.${p.lv}</b><small>生命 ${p.hp}/${st.hp}　攻击 ${st.atk}　防御 ${st.def}　速度 ${st.spd}</small><small>${m.skill ? '技能：' + SKILLS[m.skill].name + '。' : ''}${m.desc || ''}</small></div><div class="acts">${on ? '<button class="mini ghost" data-a="rest" type="button">休息</button>' : `<button class="mini" data-a="active" data-i="${i}" type="button">出战</button>`}<button class="mini ghost" data-a="free" data-i="${i}" type="button">放生</button></div></div>`;
    }).join('') + '</div>';
  },
  bag() {
    const items = Object.keys(ITEMS).map(id => { const it = ITEMS[id], n = s.items[id] || 0; return `<div class="rowi"><i>${it.icon}</i><div class="mid"><b>${it.name} ×${n}</b><small>${it.desc}</small></div>${it.use !== 'capture' ? `<button class="mini" data-a="use" data-i="${id}" ${n ? '' : 'disabled'} type="button">使用</button>` : ''}</div>`; }).join('');
    const gear = s.bag.map((g, i) => {
      const cur = s.gear[g.slot], d = C.gearScore(g) - C.gearScore(cur);
      return `<div class="rowi rare${g.rare}"><i>${g.icon}</i><div class="mid"><b>${gearName(g)}</b><small>${GEAR_SLOTS[g.slot]}　${gearText(g)}　<span class="${d > 0 ? 'up' : 'down'}">${d > 0 ? '比身上的好' : d < 0 ? '不如身上的' : '和身上的差不多'}</span></small></div><div class="acts"><button class="mini" data-a="equip" data-i="${i}" type="button">装备</button><button class="mini ghost" data-a="sell" data-i="${i}" type="button">卖 ${Math.round(g.price / 2)}</button></div></div>`;
    }).join('');
    return head('背包') + `<div class="scroll"><h3>道具</h3>${items}<h3>装备</h3>${gear || '<p class="hint">还没有多余的装备。打怪有机会掉落，首领一定会掉。</p>'}</div>`;
  },
  hero() {
    const st = C.heroStats(s), c = CLASSES[s.cls];
    const stats = ['hp', 'mp', 'atk', 'mag', 'def', 'spd'].map(k => `<div class="stat">${ST_NAME[k]}<b>${st[k]}</b></div>`).join('');
    const attrs = Object.keys(ATTR_NAME).map(k => `<div class="rowi"><div class="mid"><b>${ATTR_NAME[k]}　${Math.floor(s.attr[k])}</b><small>${ATTR_DESC[k]}</small></div><button class="mini" data-a="point" data-i="${k}" ${s.points > 0 ? '' : 'disabled'} type="button">+1</button></div>`).join('');
    const gear = Object.keys(GEAR_SLOTS).map(k => { const g = s.gear[k]; if (!g) return `<div class="rowi locked"><i>▫️</i><div class="mid"><b>${GEAR_SLOTS[k]}</b><small>空着</small></div></div>`; const cost = C.enhanceCost(g), max = (g.plus || 0) >= 10; return `<div class="rowi rare${g.rare}"><i>${g.icon}</i><div class="mid"><b>${gearName(g)}</b><small>${GEAR_SLOTS[k]}　${gearText(g)}</small></div><button class="mini" data-a="enh" data-i="${k}" ${max || s.gold < cost ? 'disabled' : ''} type="button">${max ? '已满级' : '强化 🪙' + cost}</button></div>`; }).join('');
    const skills = c.skills.map(([lv, id]) => { const k = SKILLS[id], has = s.lv >= lv; return `<div class="rowi ${has ? '' : 'locked'}"><div class="mid"><b>${k.name}　<small style="display:inline">灵气 ${k.mp}</small></b><small>${has ? k.desc : `${lv} 级学会。${k.desc}`}</small></div></div>`; }).join('');
    return head(`${c.icon} ${c.name}　Lv.${s.lv}`) + `<p class="hint">经验 ${s.xp}/${C.xpNeed(s.lv)}　已打败 ${s.kills} 只野怪</p><div class="scroll"><div class="stats">${stats}</div><h3>属性点　剩 ${s.points} 点</h3>${attrs}<h3>装备</h3>${gear}<h3>技能</h3>${skills}<button class="reset" data-a="wipe" type="button">删除存档，重新开始</button></div>`;
  },
  shop() {
    return head('商店') + '<p class="hint">路过的行脚商，什么时候都能找到他。</p><div class="scroll">' + Object.keys(ITEMS).map(id => { const it = ITEMS[id]; return `<div class="rowi"><i>${it.icon}</i><div class="mid"><b>${it.name}　<small style="display:inline">有 ${s.items[id] || 0} 个</small></b><small>${it.desc}</small></div><button class="mini" data-a="buy" data-i="${id}" ${s.gold < it.price ? 'disabled' : ''} type="button">🪙 ${it.price}</button></div>`; }).join('') + '</div>';
  },
  quest() {
    const q = C.currentQuest(s);
    if (!q) return head('灯灵', '') + '<div class="talk">「往后这几座岛，你想去哪就去哪。」<small>所有委托都完成了。首领可以反复挑战，伙伴和装备可以继续练。</small></div>';
    if (!s.qAccepted) return head('灯灵的委托', '') + `<div class="talk"><b>${q.title}</b><br>${q.text}<small>奖励：${rewardText(q.reward)}</small></div><button class="primary" data-a="accept" type="button">接下委托</button>`;
    if (C.questDone(s)) return head('灯灵的委托', '') + `<div class="talk"><b>${q.title}</b><br>${q.done}<small>奖励：${rewardText(q.reward)}</small></div><button class="primary" data-a="claim" type="button">领取奖励</button>`;
    return head('灯灵的委托', '') + `<div class="talk"><b>${q.title}</b><br>${q.text}<small>进度：${questLine().split('　')[1]}　奖励：${rewardText(q.reward)}</small></div>`;
  },
  report() { return reportHtml + '<button class="primary" data-a="reportOk" type="button">继续</button>'; },
  pick() {
    const c = CLASSES[pickCls];
    return '<h2>选一个伙伴开始</h2><p class="hint">三种职业打法不同，之后不能换，但可以删档重来。</p><div class="picks">' + Object.keys(CLASSES).map(k => `<button class="pick ${k === pickCls ? 'on' : ''}" data-a="pickCls" data-i="${k}" type="button"><i>${CLASSES[k].icon}</i>${CLASSES[k].name}</button>`).join('') + `</div><div class="talk">${c.blurb}<small>技能：${c.skills.map(([, id]) => SKILLS[id].name).join('、')}</small></div><button class="primary" data-a="pickGo" type="button">就选${c.name}</button>`;
  },
};
const rewardText = r => [`${r.gold} 金币`, ...Object.keys(r.items || {}).map(k => `${ITEMS[k].name}×${r.items[k]}`), r.gear ? '一件装备' : ''].filter(Boolean).join('、');
function renderSheet() {
  const el = $('sheet'), keep = el.querySelector('.scroll')?.scrollTop || 0;
  el.className = 'sheet ' + (['quest', 'report', 'pick'].includes(sheet) ? 'short' : 'tall'); el.innerHTML = sheets[sheet]();
  const sc = el.querySelector('.scroll'); if (sc) sc.scrollTop = keep;
}

const actions = {
  async go(i) {
    const z = ZONES[+i]; closeSheet(); busy = true;
    await flash(async () => { s.zone = z.id; if (z.home) C.fullHeal(s); save(); await view.loadZone(z, s); hud(); });
    busy = false; toast(z.home ? '回到小岛，体力都恢复了。' : `${z.name}<small>${z.desc} 发光的地方是首领。</small>`);
  },
  active(i) { s.active = +i; save(); view.setPet(s); renderSheet(); },
  rest() { s.active = -1; save(); view.setPet(s); renderSheet(); },
  free(i) { i = +i; const name = MONSTERS[s.pets[i].id].name; s.pets.splice(i, 1); if (s.active === i) s.active = -1; else if (s.active > i) s.active--; save(); view.setPet(s); renderSheet(); toast(`${name}回到了野外。`); },
  use(id) {
    const it = ITEMS[id], st = C.heroStats(s);
    if (it.use === 'hp') {
      const p = s.pets[s.active], pst = p && C.petStats(p);
      if (p && p.hp / pst.hp < s.hp / st.hp) { p.hp = Math.min(pst.hp, p.hp + Math.round(pst.hp * it.amount)); toast(`${MONSTERS[p.id].name}恢复了生命。`); }
      else { if (s.hp >= st.hp) return toast('生命是满的。'); s.hp = Math.min(st.hp, s.hp + Math.round(st.hp * it.amount)); }
    } else { if (s.mp >= st.mp) return toast('灵气是满的。'); s.mp = Math.min(st.mp, s.mp + Math.round(st.mp * it.amount)); }
    s.items[id]--; save(); renderSheet();
  },
  equip(i) { C.equip(s, +i); save(); renderSheet(); },
  sell(i) { C.sell(s, +i); save(); renderSheet(); },
  point(k) { C.spendPoint(s, k); save(); renderSheet(); },
  enh(k) { if (C.enhance(s, k)) { save(); renderSheet(); } },
  buy(id) { if (C.buy(s, id)) { save(); renderSheet(); } },
  accept() { C.acceptQuest(s); save(); closeSheet(); toast(C.questDone(s) ? '已经做到了，再点一次委托领奖励。' : '委托接下了。点「地图」出发。'); },
  claim() { const got = C.claimQuest(s); save(); reportHtml = `<h2>委托完成</h2><div class="report">${got.map(g => `<p>得到 ${g}</p>`).join('')}</div>`; reportDone = () => { if (C.currentQuest(s)) openSheet('quest'); }; openSheet('report', true); },
  reportOk() { const f = reportDone; reportDone = null; closeSheet(); f && f(); },
  wipe() { if (sheet !== 'hero') return; const b = $('sheet').querySelector('[data-a=wipe]'); if (b.dataset.sure) { localStorage.removeItem(KEY); location.reload(); } else { b.dataset.sure = 1; b.textContent = '再点一次确认删除'; } },
  async pickCls(k) { if (k === pickCls || busy) return; pickCls = k; renderSheet(); busy = true; await view.loadZone(ZONES[0], { cls: k, pets: [], active: -1 }); busy = false; },
  async pickGo() {
    s = C.newGame(pickCls); save(); document.body.classList.remove('picking'); closeSheet(); view.setZoom(14);
    busy = false; toast('点地面就能走。<small>先去石灯旁边，和灯灵说说话。</small>', 4200);
  },
};
$('sheet').addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b && !b.disabled) actions[b.dataset.a](b.dataset.i); });
$('scrim').addEventListener('click', () => { if (!sheetLock) closeSheet(); });
$('nav').addEventListener('click', e => { const b = e.target.closest('[data-sheet]'); if (b && !busy) openSheet(b.dataset.sheet); });
$('questChip').addEventListener('click', () => { if (!busy) openSheet('quest'); });
$('bMe').addEventListener('click', () => { if (!busy) openSheet('hero'); });

// ---------- 战斗 ----------
const plates = {};
function buildPlates() {
  const box = $('plates'); box.innerHTML = ''; for (const k in plates) delete plates[k];
  for (const u of battle.units) {
    const d = document.createElement('div'); d.className = 'plate'; d.dataset.k = u.key;
    d.innerHTML = `${u.side === 'b' ? EL_ICON[u.el] + ' ' : ''}${u.name}${u.lv ? ` <small>Lv.${u.lv}</small>` : ''}<div class="gauge hp"><i style="width:${pct(u.hp, u.st.hp)}"></i></div>${u.key === 'hero' ? `<div class="gauge mp"><i style="width:${pct(u.mp, u.st.mp)}"></i></div>` : ''}`;
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
$('plates').addEventListener('click', e => { const p = e.target.closest('.plate'); if (!p || cmdLocked) return; const u = battle.units.find(x => x.key === p.dataset.k); if (u.side === 'b' && plates[u.key].hp > 0) { tgt = u.key; markTarget(); } });

let cmdLocked = true, cmdPage = 'main';
function renderCmd() {
  const el = $('cmd'), hero = battle.units[0]; el.classList.toggle('locked', cmdLocked);
  if (cmdPage === 'skill') {
    el.innerHTML = '<div class="list">' + hero.skills.map(id => { const k = SKILLS[id]; return `<button class="chip opt" data-c="skill" data-i="${id}" ${hero.mp < k.mp ? 'disabled' : ''} type="button"><b>${k.name}</b><span>${k.desc}</span><em>灵气 ${k.mp}</em></button>`; }).join('') + '<button class="chip opt" data-c="back" type="button"><b>返回</b><span></span></button></div>';
  } else if (cmdPage === 'item') {
    el.innerHTML = '<div class="list">' + ['pill', 'dew'].map(id => { const it = ITEMS[id], n = s.items[id] || 0; return `<button class="chip opt" data-c="item" data-i="${id}" ${n ? '' : 'disabled'} type="button"><b>${it.icon} ${it.name}</b><span>${it.desc}</span><em>×${n}</em></button>`; }).join('') + '<button class="chip opt" data-c="back" type="button"><b>返回</b><span></span></button></div>';
  } else {
    const many = battle.units.filter(u => u.side === 'b' && plates[u.key]?.hp > 0).length > 1;
    el.innerHTML = `${many && !cmdLocked ? '<div class="tip">点敌人头上的名字可以换目标</div>' : ''}<div class="row"><button class="btn main" data-c="attack" type="button"><i>⚔️</i>攻击</button><button class="chip btn" data-c="skills" type="button"><i>✨</i>技能</button><button class="chip btn" data-c="items" type="button"><i>🌿</i>道具</button><button class="chip btn" data-c="capture" ${s.items.seed > 0 ? '' : 'disabled'} type="button"><i>🌰</i>捕捉<em>${s.items.seed || ''}</em></button><button class="chip btn" data-c="flee" ${battle.isBoss ? 'disabled' : ''} type="button"><i>💨</i>逃跑</button></div>`;
  }
  markTarget();
}
$('cmd').addEventListener('click', e => {
  const b = e.target.closest('[data-c]'); if (!b || b.disabled || cmdLocked) return; const c = b.dataset.c, i = b.dataset.i;
  if (c === 'skills') { cmdPage = 'skill'; renderCmd(); } else if (c === 'items') { cmdPage = 'item'; renderCmd(); } else if (c === 'back') { cmdPage = 'main'; renderCmd(); }
  else if (c === 'attack') playRound({ type: 'attack', target: tgt });
  else if (c === 'skill') playRound({ type: 'skill', skill: i, target: tgt });
  else if (c === 'item') playRound({ type: 'item', item: i });
  else if (c === 'capture') playRound({ type: 'capture', target: tgt });
  else if (c === 'flee') playRound({ type: 'flee' });
});
function setAuto(on) { s.autoBattle = on; save(); const b = $('bAuto'); b.textContent = on ? '自动 开' : '自动 关'; b.classList.toggle('on', on); }
$('bAuto').addEventListener('click', () => { setAuto(!s.autoBattle); if (s.autoBattle && battle && !cmdLocked) playRound(C.autoHeroAction(battle, s)); });

let wildRef = null;
async function startEncounter(id, isBoss, wildObj) {
  if (busy || !s) return; busy = true; wildRef = wildObj;
  const zone = C.zoneOf(s); battle = C.startBattle(s, C.makeEncounter(zone, id, isBoss), isBoss); tgt = null; cmdLocked = true; cmdPage = 'main';
  await flash(async () => {
    await view.enterBattle(battle, s); document.body.classList.add('in-battle'); $('battle').hidden = false;
    $('bZone').textContent = isBoss ? `${zone.name} · 首领` : zone.name; $('bRound').textContent = '第 1 回合'; setAuto(!!s.autoBattle); buildPlates(); renderCmd();
  });
  for (const u of battle.units) if (u.mid) s.seen[u.mid] = 1;
  banner(isBoss ? `${battle.units.find(u => u.boss).name}挡住了去路` : `野生的${battle.units.find(u => u.side === 'b').name}出现了`, 1300);
  await sleep(700); nextTurn();
}
function nextTurn() {
  $('bRound').textContent = `第 ${battle.round + 1} 回合`; cmdPage = 'main';
  if (s.autoBattle) { cmdLocked = true; renderCmd(); setTimeout(() => { if (battle && !battle.over) playRound(C.autoHeroAction(battle, s), true); }, 250); }
  else { cmdLocked = false; renderCmd(); }
}
async function playRound(action, fromAuto) {
  if (cmdLocked && !fromAuto) return; cmdLocked = true; cmdPage = 'main'; renderCmd();
  const ev = C.runRound(battle, s, action);
  for (let i = 0; i < ev.length; i++) {
    const e = ev[i];
    if (e.t === 'act') {
      if (!e.plain) banner(e.name);
      if (e.who === 'hero') setMp();
      const next = ev.slice(i + 1).find(x => x.t === 'hit' || x.t === 'miss' || x.t === 'act');
      if (e.kind === 'phys') await view.anim.lunge(e.who, next && next.t !== 'act' ? next.who : null);
      else if (e.kind === 'capture') await sleep(100);
      else if (e.kind === 'item') await view.anim.flash(e.who);
      else await view.anim.cast(e.who, e.kind === 'heal' ? 0x9dffb0 : EL_COLOR[e.el || battle.units.find(u => u.key === e.who).el] || 0xffffff);
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
  const over = battle.over, zoneBefore = s.zone, log = C.finishBattle(battle, s); save();
  const lines = log.map(l => {
    if (l.t === 'lose') return `<p>你倒下了，灯灵把你接回了小岛。${l.lost ? `路上丢了 ${l.lost} 金币。` : ''}</p>`;
    if (l.t === 'reward') return `<p>经验 +${l.xp}　金币 +${l.gold}</p>`;
    if (l.t === 'levelup') return l.who === 'hero' ? `<p class="big">升到 ${l.lv} 级，得到 3 点属性点${l.skill ? `，学会了「${l.skill}」` : ''}</p>` : `<p>${l.name}升到 ${l.lv} 级</p>`;
    if (l.t === 'unlock') return `<p class="big">新地图开放：${l.zone}</p>`;
    if (l.t === 'gear') return `<p>捡到 ${l.g.icon} ${l.g.name}（${gearText(l.g)}）</p>`;
    if (l.t === 'item') return `<p>捡到 ${ITEMS[l.id].icon} ${ITEMS[l.id].name}</p>`;
    if (l.t === 'caught') return `<p class="big">${MONSTERS[l.id].name}成了你的伙伴</p>`;
    if (l.t === 'petfull') return '<p>伙伴已经有 6 只，它跑掉了。</p>';
    return '';
  }).join('');
  const leave = async () => {
    await flash(async () => {
      $('battle').hidden = true; document.body.classList.remove('in-battle'); view.exitBattle();
      if (over === 'lose' && zoneBefore !== 'home') await view.loadZone(C.zoneOf(s), s);
      else { if (wildRef) view.removeWild(wildRef); await view.setPet(s); }
      hud();
    });
    battle = null; wildRef = null; busy = false;
    if (over === 'win' && s.points > 0) toast(`有 ${s.points} 点属性点没用，点左上角或「角色」加点。`);
  };
  if (!lines) return leave();
  reportHtml = `<h2>${over === 'lose' ? '战斗失败' : '战斗胜利'}</h2><div class="report">${lines}</div>`; reportDone = leave; openSheet('report', true);
}

// ---------- 地图上的点按 ----------
{ let down = null; const c = $('c');
  c.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
  c.addEventListener('pointerup', e => { if (down && !busy && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 12) view.tap(e.clientX, e.clientY); down = null; }); }
view.on('encounter', startEncounter);
view.on('lantern', () => { if (!busy && !sheet) openSheet('quest'); });

// 战斗时让名牌跟着角色
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; view.frame(dt, now / 1000);
  if (battle) for (const k in plates) { const p = view.screenPos(k, true); if (p) { plates[k].el.style.left = Math.max(50, Math.min(innerWidth - 50, p.x)) + 'px'; plates[k].el.style.top = p.y + 'px'; } }
  requestAnimationFrame(loop);
}

// ---------- 开始 ----------
if (s) { await view.loadZone(C.zoneOf(s), s); hud(); busy = false; }
else { document.body.classList.add('picking'); view.setZoom(11); await view.loadZone(ZONES[0], { cls: pickCls, pets: [], active: -1 }); openSheet('pick', true); busy = false; }
requestAnimationFrame(loop);
$('loading').classList.add('done'); window.__ready = true;
window.__game = { get s() { return s; }, get battle() { return battle; }, view, save, hud, encounter: startEncounter };
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
