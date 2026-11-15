// 规则：角色数值、升级、战斗结算、掉落、任务。纯数据，不碰画面，可在 Node 里跑。
import { SKILLS, CLASSES, MONSTERS, ZONES, ITEMS, BEATS, GEAR_BASE, GEAR_PREFIX, QUESTS } from './data.js';

const rnd = Math.random;
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = arr => arr[Math.floor(rnd() * arr.length)];
export const xpNeed = lv => Math.round(18 * Math.pow(lv, 1.55));

// ---------- 存档 ----------
export function newGame(cls) {
  const c = CLASSES[cls];
  const s = {
    v: 1, cls, lv: 1, xp: 0, attr: { ...c.base }, points: 0, gold: 20,
    hp: 0, mp: 0, gear: { weapon: null, armor: null, charm: null }, bag: [], items: { pill: 3, dew: 1, seed: 0 },
    pets: [], active: -1, zone: 'home', unlocked: 1, quest: 0, qn: 0, qAccepted: false, bosses: {}, seen: {}, kills: 0, autoBattle: false,
  };
  const st = heroStats(s); s.hp = st.hp; s.mp = st.mp;
  return s;
}

// ---------- 数值 ----------
export function heroStats(s) {
  const a = s.attr, g = { atk: 0, mag: 0, def: 0, hp: 0, spd: 0 };
  for (const k in s.gear) if (s.gear[k]) for (const m in s.gear[k].st) g[m] += s.gear[k].st[m];
  return {
    hp: Math.round(40 + a.vit * 11 + s.lv * 6 + g.hp), mp: Math.round(16 + a.int * 5 + s.lv * 2),
    atk: Math.round(a.str * 2.2 + s.lv + g.atk), mag: Math.round(a.int * 2.2 + s.lv + g.mag),
    def: Math.round(a.vit * 1.1 + s.lv * 0.6 + g.def), spd: Math.round(a.agi * 1.6 + s.lv * 0.4 + g.spd),
  };
}
export function monsterStats(id, lv) {
  const m = MONSTERS[id], b = { hp: 28 + lv * 15 + lv * lv * 0.4, atk: 7 + lv * 3.6 + lv * lv * 0.05, def: 3 + lv * 1.7, spd: 6 + lv * 1.3 };
  return { hp: Math.round(b.hp * m.hp), mp: 10 + lv * 2, atk: Math.round(b.atk * m.atk), mag: Math.round(b.atk * m.atk), def: Math.round(b.def * m.def), spd: Math.round(b.spd * m.spd) };
}
export const petStats = p => { const st = monsterStats(p.id, p.lv); if (MONSTERS[p.id].boss) return st; st.hp = Math.round(st.hp * 0.95); st.atk = st.mag = Math.round(st.atk * 0.8); return st; };
export function heroSkills(s) { return CLASSES[s.cls].skills.filter(([lv]) => s.lv >= lv).map(([, id]) => id); }

function gainXp(who, xp, isHero, s, log) {
  who.xp += xp;
  while (who.xp >= xpNeed(who.lv) && who.lv < 40) {
    who.xp -= xpNeed(who.lv); who.lv++;
    if (isHero) {
      const g = CLASSES[s.cls].grow; for (const k in g) s.attr[k] = +(s.attr[k] + g[k]).toFixed(1);
      s.points += 3;
      const learned = CLASSES[s.cls].skills.find(([lv]) => lv === s.lv);
      log.push({ t: 'levelup', who: 'hero', lv: s.lv, skill: learned ? SKILLS[learned[1]].name : null });
    } else log.push({ t: 'levelup', who: 'pet', name: MONSTERS[who.id].name, lv: who.lv });
  }
}
export function spendPoint(s, k) { if (s.points > 0) { s.points--; s.attr[k] = +(s.attr[k] + 1).toFixed(1); } }
export function fullHeal(s) { const st = heroStats(s); s.hp = st.hp; s.mp = st.mp; for (const p of s.pets) p.hp = petStats(p).hp; }

// ---------- 装备 ----------
export function makeGear(tier) { // tier 1..4
  const slot = pick(['weapon', 'armor', 'charm']), [name, icon] = GEAR_BASE[slot][tier - 1];
  const r = rnd(), pi = r < 0.5 ? 0 : r < 0.8 ? 1 : r < 0.95 ? 2 : 3, [prefix, mult] = GEAR_PREFIX[pi];
  const base = (4 + tier * 5) * mult, st = {};
  if (slot === 'weapon') { st.atk = Math.round(base); st.mag = Math.round(base); }
  if (slot === 'armor') { st.def = Math.round(base * 0.7); st.hp = Math.round(base * 3); }
  if (slot === 'charm') { st.spd = Math.round(base * 0.5); st.hp = Math.round(base * 1.5); if (pi >= 2) st.def = Math.round(base * 0.25); }
  return { slot, name: prefix + name, icon, tier, rare: pi, st, price: Math.round((10 + tier * 18) * mult) };
}
// 强化：每级让装备数值提高 12%，越往后越贵
export const enhanceCost = g => Math.round(g.price * 1.2 * Math.pow(1.6, g.plus || 0));
export function enhance(s, slot) {
  const g = s.gear[slot]; if (!g || (g.plus || 0) >= 10) return false;
  const cost = enhanceCost(g); if (s.gold < cost) return false;
  s.gold -= cost; g.base = g.base || { ...g.st }; g.plus = (g.plus || 0) + 1;
  for (const k in g.base) g.st[k] = Math.round(g.base[k] * (1 + 0.12 * g.plus));
  return true;
}
export const gearScore = g => g ? Object.values(g.st).reduce((a, b) => a + b, 0) : 0;
export function equip(s, i) { const g = s.bag[i]; s.bag.splice(i, 1); if (s.gear[g.slot]) s.bag.push(s.gear[g.slot]); s.gear[g.slot] = g; const st = heroStats(s); s.hp = Math.min(s.hp, st.hp); }
export function sell(s, i) { s.gold += Math.round(s.bag[i].price / 2); s.bag.splice(i, 1); }
export function buy(s, id) { if (s.gold < ITEMS[id].price) return false; s.gold -= ITEMS[id].price; s.items[id] = (s.items[id] || 0) + 1; return true; }

// ---------- 遇敌 ----------
export function zoneOf(s) { return ZONES.find(z => z.id === s.zone); }
export function makeEncounter(zone, leaderId, isBoss) {
  const [lo, hi] = zone.lv;
  if (isBoss) return [{ id: zone.boss, lv: hi + 1 }, { id: pick(zone.wild), lv: hi }];
  const n = rnd() < 0.45 ? 1 : rnd() < 0.75 ? 2 : 3, out = [{ id: leaderId, lv: ri(lo, hi) }];
  while (out.length < n) out.push({ id: pick(zone.wild), lv: ri(lo, Math.max(lo, hi - 1)) });
  return out;
}

// ---------- 战斗 ----------
// 单位：{key, side:'a'|'b', name, st, hp, mp, el, skills, fx:{defDown,defUp,burn}, ref}
export function startBattle(s, enemies, isBoss) {
  const hs = heroStats(s), units = [];
  units.push({ key: 'hero', side: 'a', name: CLASSES[s.cls].name, st: hs, hp: Math.max(1, s.hp), mp: s.mp, el: s.cls === 'fox' ? 'fire' : s.cls === 'rabbit' ? 'water' : 'none', skills: heroSkills(s), fx: {} });
  const p = s.pets[s.active];
  if (p && p.hp > 0) units.push({ key: 'pet', side: 'a', name: MONSTERS[p.id].name, st: petStats(p), hp: p.hp, mp: 99, el: MONSTERS[p.id].el, skills: MONSTERS[p.id].skill ? [MONSTERS[p.id].skill] : [], fx: {}, mid: p.id });
  enemies.forEach((e, i) => { const st = monsterStats(e.id, e.lv); units.push({ key: 'e' + i, side: 'b', name: MONSTERS[e.id].name, st, hp: st.hp, mp: st.mp, el: MONSTERS[e.id].el, skills: MONSTERS[e.id].skill ? [MONSTERS[e.id].skill] : [], fx: {}, mid: e.id, lv: e.lv, boss: !!MONSTERS[e.id].boss }); });
  return { units, round: 0, over: null, isBoss, captured: null };
}
const alive = (b, side) => b.units.filter(u => u.side === side && u.hp > 0);
const defOf = u => u.st.def * (u.fx.defDown ? 0.6 : 1) * (u.fx.defUp ? 1.5 : 1);

function damage(att, tgt, sk) {
  const magic = sk.kind === 'magic', power = sk.power || 1;
  let d = (magic ? att.st.mag : att.st.atk) * power * (0.9 + rnd() * 0.2) - defOf(tgt) * (magic ? 0.45 : 0.7);
  d = Math.max(d, (magic ? att.st.mag : att.st.atk) * power * 0.18);
  let eff = 0; const el = sk.el || (magic ? att.el : 'none');
  if (el !== 'none' && tgt.el !== 'none') { if (BEATS[el] === tgt.el) { d *= 1.5; eff = 1; } else if (BEATS[tgt.el] === el) { d *= 0.67; eff = -1; } }
  const crit = !magic && rnd() < 0.08 + att.st.spd / 600; if (crit) d *= 1.6;
  return { dmg: Math.max(1, Math.round(d)), crit, eff };
}

function act(b, u, action, ev) {
  const foes = alive(b, u.side === 'a' ? 'b' : 'a'), friends = alive(b, u.side);
  if (!foes.length) return;
  let sk = action.type === 'skill' ? SKILLS[action.skill] : { name: '攻击', kind: 'phys', target: 'one', power: 1, mp: 0 };
  if (action.type === 'skill') { if (u.mp < sk.mp) sk = { name: '攻击', kind: 'phys', target: 'one', power: 1, mp: 0 }; else u.mp -= sk.mp; }
  ev.push({ t: 'act', who: u.key, name: sk.name, kind: sk.kind, el: sk.el, plain: sk.name === '攻击' });
  const applyFx = t => { if (sk.effect && t.hp > 0) { t.fx[sk.effect.type] = sk.effect.turns; ev.push({ t: 'fx', who: t.key, fx: sk.effect.type }); } };
  if (sk.kind === 'phys' || sk.kind === 'magic') {
    let targets = sk.target === 'all' ? foes : [foes.find(f => f.key === action.target) || pick(foes)];
    for (const t of targets) for (let h = 0; h < (sk.hits || 1) && t.hp > 0; h++) {
      if (sk.kind === 'phys' && rnd() < Math.min(0.25, Math.max(0, (t.st.spd - u.st.spd) / 200))) { ev.push({ t: 'miss', who: t.key }); continue; }
      const r = damage(u, t, sk); t.hp = Math.max(0, t.hp - r.dmg);
      ev.push({ t: 'hit', who: t.key, by: u.key, ...r, hp: t.hp });
      if (t.hp <= 0) ev.push({ t: 'ko', who: t.key }); else if (h === (sk.hits || 1) - 1) applyFx(t);
    }
  } else if (sk.kind === 'heal') {
    const targets = sk.target === 'party' ? friends : sk.target === 'self' ? [u] : [friends.reduce((a, c) => (c.hp / c.st.hp < a.hp / a.st.hp ? c : a))];
    for (const t of targets) { const n = Math.round(u.st.mag * sk.power * (0.9 + rnd() * 0.2) + t.st.hp * 0.08); t.hp = Math.min(t.st.hp, t.hp + n); ev.push({ t: 'heal', who: t.key, n, hp: t.hp }); }
  } else if (sk.kind === 'buff') for (const t of friends) applyFx(t);
  else if (sk.kind === 'debuff') for (const t of foes) applyFx(t);
}

function aiAction(b, u) {
  const foes = alive(b, u.side === 'a' ? 'b' : 'a');
  const sk = u.skills[0] && SKILLS[u.skills[0]];
  let useSkill = sk && u.mp >= sk.mp && rnd() < (u.boss ? 0.45 : 0.35);
  if (useSkill && sk.kind === 'heal' && (u.hp > u.st.hp * 0.5 || (u.healed = (u.healed || 0) + 1) > 2)) useSkill = false;
  if (useSkill && sk.kind === 'debuff' && foes.every(f => f.fx.defDown)) useSkill = false;
  const target = (u.side === 'a' ? foes.reduce((a, c) => (c.hp < a.hp ? c : a)) : pick(foes)).key;
  return useSkill ? { type: 'skill', skill: u.skills[0], target } : { type: 'attack', target };
}
// 自动战斗时英雄的选择
export function autoHeroAction(b, s) {
  const h = b.units[0], foes = alive(b, 'b'), sks = h.skills.map(id => [id, SKILLS[id]]).filter(([, k]) => h.mp >= k.mp);
  const heal = sks.find(([, k]) => k.kind === 'heal'); if (heal && alive(b, 'a').some(u => u.hp < u.st.hp * 0.45)) return { type: 'skill', skill: heal[0] };
  if (h.hp < h.st.hp * 0.35 && s.items.pill > 0) return { type: 'item', item: 'pill' };
  const target = foes.reduce((a, c) => (c.hp < a.hp ? c : a)).key;
  const aoe = sks.find(([, k]) => k.target === 'all' && k.power); if (aoe && foes.length >= 2) return { type: 'skill', skill: aoe[0], target };
  const dmg = sks.filter(([, k]) => k.power && k.target === 'one' && k.kind !== 'heal').pop(); if (dmg && (h.mp > h.st.mp * 0.3 || foes.some(f => f.boss))) return { type: 'skill', skill: dmg[0], target };
  return { type: 'attack', target };
}

// 跑一回合。heroAction: {type:'attack'|'skill'|'item'|'capture'|'flee', ...}。返回事件列表，画面按顺序播放。
export function runRound(b, s, heroAction) {
  const ev = []; b.round++;
  const order = b.units.filter(u => u.hp > 0).map(u => [u, u.st.spd * (0.85 + rnd() * 0.3)]).sort((x, y) => y[1] - x[1]).map(x => x[0]);
  for (const u of order) {
    if (b.over || u.hp <= 0) continue;
    if (u.fx.burn) { const d = Math.max(1, Math.round(u.st.hp * 0.06)); u.hp = Math.max(0, u.hp - d); ev.push({ t: 'hit', who: u.key, dmg: d, burn: true, hp: u.hp }); if (u.hp <= 0) { ev.push({ t: 'ko', who: u.key }); check(b, ev); continue; } }
    if (u.key === 'hero') {
      const a = heroAction;
      if (a.type === 'flee') { const ok = !b.isBoss && rnd() < 0.75; ev.push({ t: 'flee', ok }); if (ok) { b.over = 'flee'; break; } }
      else if (a.type === 'item') {
        const it = ITEMS[a.item]; s.items[a.item]--;
        ev.push({ t: 'act', who: 'hero', name: it.name, kind: 'item' });
        if (it.use === 'hp') { const t = alive(b, 'a').reduce((x, c) => (c.hp / c.st.hp < x.hp / x.st.hp ? c : x)); const n = Math.round(t.st.hp * it.amount); t.hp = Math.min(t.st.hp, t.hp + n); ev.push({ t: 'heal', who: t.key, n, hp: t.hp }); }
        if (it.use === 'mp') { const n = Math.round(u.st.mp * it.amount); u.mp = Math.min(u.st.mp, u.mp + n); ev.push({ t: 'mp', who: 'hero', n }); }
      } else if (a.type === 'capture') {
        s.items.seed--; const t = b.units.find(x => x.key === a.target && x.hp > 0) || alive(b, 'b')[0];
        ev.push({ t: 'act', who: 'hero', name: '灵种', kind: 'capture', target: t.key });
        const chance = t.boss ? 0 : Math.min(0.95, 0.08 + (1 - t.hp / t.st.hp) * 0.85);
        const ok = rnd() < chance; ev.push({ t: 'capture', who: t.key, ok, boss: t.boss });
        if (ok) { t.hp = 0; t.caught = true; b.captured = { id: t.mid, lv: t.lv }; }
      } else act(b, u, a, ev);
    } else act(b, u, aiAction(b, u), ev);
    check(b, ev);
  }
  for (const u of b.units) for (const k in u.fx) if (--u.fx[k] <= 0) delete u.fx[k];
  return ev;
}
function check(b, ev) {
  if (b.over) return;
  if (!alive(b, 'b').length) b.over = 'win'; else if (b.units[0].hp <= 0) b.over = 'lose';
  if (b.over) ev.push({ t: 'end', result: b.over });
}

// 战斗结束后把结果写回存档，返回要展示的战报
export function finishBattle(b, s) {
  const log = [], hero = b.units[0], petU = b.units.find(u => u.key === 'pet'), pet = s.pets[s.active];
  s.hp = Math.max(1, hero.hp); s.mp = hero.mp; if (petU && pet) pet.hp = petU.hp;
  if (b.over === 'lose') { // 输了：回家，丢一点金币
    const lost = Math.round(s.gold * 0.1); s.gold -= lost; s.zone = 'home'; fullHeal(s);
    log.push({ t: 'lose', lost }); return log;
  }
  if (b.over === 'flee') return log;
  const zone = zoneOf(s), tier = Math.max(1, ZONES.indexOf(zone));
  let xp = 0, gold = 0; const foes = b.units.filter(u => u.side === 'b');
  for (const f of foes) {
    xp += Math.round((6 + f.lv * 4) * (f.boss ? 5 : 1)); gold += Math.round((3 + f.lv * 1.6) * (f.boss ? 6 : 1) * (0.8 + rnd() * 0.4));
    s.seen[f.mid] = 1; if (!f.caught) { s.kills++; questProgress(s, 'kill', f); }
    if (f.boss && !f.caught) { s.bosses[f.mid] = 1; questProgress(s, 'boss', f); const zi = ZONES.indexOf(zone); if (s.unlocked <= zi && zi < ZONES.length - 1) { s.unlocked = zi + 1; log.push({ t: 'unlock', zone: ZONES[zi + 1].name }); } }
  }
  s.gold += gold; log.push({ t: 'reward', xp, gold });
  gainXp(s, xp, true, s, log); if (pet && pet.hp > 0) gainXp(pet, Math.round(xp * 0.9), false, s, log);
  questProgress(s, 'level');
  if (rnd() < (b.isBoss ? 1 : 0.16)) { const g = makeGear(tier); s.bag.push(g); log.push({ t: 'gear', g }); }
  if (rnd() < 0.22) { const id = pick(['pill', 'pill', 'dew', 'seed']); s.items[id] = (s.items[id] || 0) + 1; log.push({ t: 'item', id }); }
  if (b.captured) {
    if (s.pets.length < 6) { const p = { id: b.captured.id, lv: b.captured.lv, xp: 0, hp: 0 }; p.hp = petStats(p).hp; s.pets.push(p); if (s.active < 0) s.active = s.pets.length - 1; log.push({ t: 'caught', id: p.id }); questProgress(s, 'capture'); }
    else log.push({ t: 'petfull' });
  }
  const st = heroStats(s); s.hp = Math.min(s.hp, st.hp);
  return log;
}

// ---------- 任务 ----------
export const currentQuest = s => QUESTS[s.quest] || null;
function questProgress(s, type, foe) {
  const q = currentQuest(s); if (!q || !s.qAccepted) return;
  if (q.type === 'kill' && type === 'kill' && (!q.el || MONSTERS[foe.mid].el === q.el)) s.qn++;
  if (q.type === 'capture' && type === 'capture') s.qn++;
  if (q.type === 'boss' && type === 'boss' && foe.mid === q.boss) s.qn = 1;
}
export function questDone(s) {
  const q = currentQuest(s); if (!q || !s.qAccepted) return false;
  if (q.type === 'level') return s.lv >= q.n;
  if (q.type === 'boss') return s.qn >= 1 || !!s.bosses[q.boss];
  return s.qn >= q.n;
}
export function acceptQuest(s) { s.qAccepted = true; s.qn = 0; const q = currentQuest(s); if (q.type === 'capture') s.qn = Math.min(q.n, s.pets.length); }
export function claimQuest(s) {
  const q = currentQuest(s), r = q.reward, got = [];
  s.gold += r.gold; got.push(`${r.gold} 金币`);
  for (const k in r.items || {}) { s.items[k] = (s.items[k] || 0) + r.items[k]; got.push(`${ITEMS[k].name} ×${r.items[k]}`); }
  if (r.gear) { let g = makeGear(r.gear); for (let i = 0; i < 4 && g.rare < 1; i++) g = makeGear(r.gear); s.bag.push(g); got.push(g.name); }
  s.quest++; s.qAccepted = false; s.qn = 0;
  return got;
}
