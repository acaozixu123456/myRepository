// 回合制战斗：纯规则，返回事件列表，画面按顺序播放。
import { SKILLS, CLASSES, MONSTERS, ZONES, ITEMS, BEATS } from '../data/index.js';
import { rnd, ri, pick } from './rng.js';
import { heroStats, monsterStats, petStats, heroSkills, activePet, gainXp, fullHeal } from './stats.js';
import { makeGear } from './gear.js';
import { questProgress } from './quests.js';
import { addPet, PARTY_MAX } from './save.js';

export const zoneOf = s => ZONES.find(z => z.id === s.world.zone);
export function makeEncounter(zone, leaderId, isBoss) {
  const [lo, hi] = zone.lv;
  if (isBoss) return [{ id: zone.boss, lv: hi + 1 }, { id: pick(zone.wild), lv: hi }];
  const n = rnd() < 0.45 ? 1 : rnd() < 0.75 ? 2 : 3, out = [{ id: leaderId, lv: ri(lo, hi) }];
  while (out.length < n) out.push({ id: pick(zone.wild), lv: ri(lo, Math.max(lo, hi - 1)) });
  return out;
}

// 单位：{key, side:'a'|'b', name, st, hp, mp, el, skills, fx:{defDown,defUp,burn}}
export function startBattle(s, enemies, isBoss) {
  const hs = heroStats(s), units = [], h = s.hero;
  units.push({ key: 'hero', side: 'a', name: CLASSES[h.cls].name, st: hs, hp: Math.max(1, h.hp), mp: h.mp, el: CLASSES[h.cls].el || 'none', skills: heroSkills(s), fx: {} });
  const p = activePet(s);
  if (p && p.hp > 0) units.push({ key: 'pet', side: 'a', name: MONSTERS[p.id].name, st: petStats(p), hp: p.hp, mp: 99, el: MONSTERS[p.id].el, skills: MONSTERS[p.id].skill ? [MONSTERS[p.id].skill] : [], fx: {}, mid: p.id, uid: p.uid });
  enemies.forEach((e, i) => { const st = monsterStats(e.id, e.lv); units.push({ key: 'e' + i, side: 'b', name: MONSTERS[e.id].name, st, hp: st.hp, mp: st.mp, el: MONSTERS[e.id].el, skills: MONSTERS[e.id].skill ? [MONSTERS[e.id].skill] : [], fx: {}, mid: e.id, lv: e.lv, boss: !!MONSTERS[e.id].boss }); });
  for (const u of units) if (u.side === 'b' && !s.world.dex[u.mid]) s.world.dex[u.mid] = 'seen';
  return { units, round: 0, over: null, isBoss, captured: null };
}
export const alive = (b, side) => b.units.filter(u => u.side === side && u.hp > 0);
const defOf = u => u.st.def * (u.fx.defDown ? 0.6 : 1) * (u.fx.defUp ? 1.5 : 1);
const PLAIN = { name: '攻击', kind: 'phys', target: 'one', power: 1, mp: 0 };

export function damage(att, tgt, sk) {
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
  let sk = action.type === 'skill' ? SKILLS[action.skill] : PLAIN;
  if (action.type === 'skill') { if (u.mp < sk.mp) sk = PLAIN; else u.mp -= sk.mp; }
  ev.push({ t: 'act', who: u.key, name: sk.name, kind: sk.kind, el: sk.el, plain: sk === PLAIN });
  const applyFx = t => { if (sk.effect && t.hp > 0) { t.fx[sk.effect.type] = sk.effect.turns; ev.push({ t: 'fx', who: t.key, fx: sk.effect.type }); } };
  if (sk.kind === 'phys' || sk.kind === 'magic') {
    const targets = sk.target === 'all' ? foes : [foes.find(f => f.key === action.target) || pick(foes)];
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
  if (h.hp < h.st.hp * 0.35 && s.bag.items.pill > 0) return { type: 'item', item: 'pill' };
  const target = foes.reduce((a, c) => (c.hp < a.hp ? c : a)).key;
  const aoe = sks.find(([, k]) => k.target === 'all' && k.power); if (aoe && foes.length >= 2) return { type: 'skill', skill: aoe[0], target };
  const dmg = sks.filter(([, k]) => k.power && k.target === 'one' && k.kind !== 'heal').pop(); if (dmg && (h.mp > h.st.mp * 0.3 || foes.some(f => f.boss))) return { type: 'skill', skill: dmg[0], target };
  return { type: 'attack', target };
}

// 跑一回合。heroAction: {type:'attack'|'skill'|'item'|'capture'|'flee', ...}
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
        const it = ITEMS[a.item]; s.bag.items[a.item]--;
        ev.push({ t: 'act', who: 'hero', name: it.name, kind: 'item' });
        if (it.use === 'hp') { const t = alive(b, 'a').reduce((x, c) => (c.hp / c.st.hp < x.hp / x.st.hp ? c : x)); const n = Math.round(t.st.hp * it.amount); t.hp = Math.min(t.st.hp, t.hp + n); ev.push({ t: 'heal', who: t.key, n, hp: t.hp }); }
        if (it.use === 'mp') { const n = Math.round(u.st.mp * it.amount); u.mp = Math.min(u.st.mp, u.mp + n); ev.push({ t: 'mp', who: 'hero', n }); }
      } else if (a.type === 'capture') {
        s.bag.items.seed--; const t = b.units.find(x => x.key === a.target && x.hp > 0) || alive(b, 'b')[0];
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
  const log = [], h = s.hero, heroU = b.units[0], petU = b.units.find(u => u.key === 'pet'), pet = activePet(s);
  h.hp = Math.max(1, heroU.hp); h.mp = heroU.mp; if (petU && pet) pet.hp = petU.hp;
  if (b.over === 'lose') { // 输了：回家，丢一点金币
    const lost = Math.round(s.wallet.gold * 0.1); s.wallet.gold -= lost; s.world.zone = 'home'; fullHeal(s);
    log.push({ t: 'lose', lost }); return log;
  }
  if (b.over === 'flee') return log;
  const zone = zoneOf(s), zi = ZONES.indexOf(zone), tier = Math.max(1, zi);
  let xp = 0, gold = 0; const foes = b.units.filter(u => u.side === 'b');
  for (const f of foes) {
    xp += Math.round((6 + f.lv * 4) * (f.boss ? 5 : 1)); gold += Math.round((3 + f.lv * 1.6) * (f.boss ? 6 : 1) * (0.8 + rnd() * 0.4));
    if (!f.caught) { s.stats.kills++; questProgress(s, 'kill', f); }
    if (f.boss && !f.caught) {
      s.world.bosses[f.mid] = 1; questProgress(s, 'boss', f);
      if (s.world.unlocked <= zi && zi < ZONES.length - 1) { s.world.unlocked = zi + 1; log.push({ t: 'unlock', zone: ZONES[zi + 1].name }); }
    }
  }
  s.wallet.gold += gold; log.push({ t: 'reward', xp, gold });
  gainXp(s, h, xp, log); if (pet && pet.hp > 0) gainXp(s, pet, Math.round(xp * 0.9), log);
  if (rnd() < (b.isBoss ? 1 : 0.16)) { const g = makeGear(tier); s.bag.gear.push(g); log.push({ t: 'gear', g }); }
  if (rnd() < 0.22) { const id = pick(['pill', 'pill', 'dew', 'seed']); s.bag.items[id] = (s.bag.items[id] || 0) + 1; log.push({ t: 'item', id }); }
  if (b.captured) {
    if (s.pets.length < PARTY_MAX) { const p = addPet(s, b.captured.id, b.captured.lv); log.push({ t: 'caught', id: p.id }); questProgress(s, 'capture'); }
    else log.push({ t: 'petfull' });
  }
  const st = heroStats(s); h.hp = Math.min(h.hp, st.hp);
  return log;
}
