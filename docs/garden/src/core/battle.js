// 战斗 2.0：行动条回合制。纯规则，返回事件列表，画面按顺序播放。
// 每个单位的行动值按速度增长，满 1000 出手；轮到英雄时停下来等指令。
import { MONSTERS, ZONES, ITEMS, BEATS, STATUS, COMBO, COMBO_STYLE, CLASSES, PETS } from '../data/index.js';
import { makeGear, addItem, addGem } from './gear.js';
import { rnd, ri, pick } from './rng.js';
import { heroStats, monsterStats, petStats, heroSkills, skillAt, skillLv, activePets, gainXp, fullHeal } from './stats.js';
import { questProgress } from './quests.js';
import { addPet, ACTIVE_MAX } from './save.js';
import { petName, petTint, loveLv, addLove, roomFor, aptStars } from './pets.js';

export const BAR = 1000, BOND_MAX = 100, ENEMY_MAX = 5;
const PLAIN = { id: 'attack', name: '攻击', kind: 'phys', target: 'one', power: 1, mp: 0 };

export const zoneOf = s => ZONES.find(z => z.id === s.world.zone);
export function makeEncounter(zone, leaderId, isBoss) {
  const [lo, hi] = zone.lv;
  if (isBoss) return [{ id: zone.boss, lv: hi + 1 }, { id: pick(zone.wild), lv: hi }];
  const n = rnd() < 0.45 ? 1 : rnd() < 0.75 ? 2 : 3, out = [{ id: leaderId, lv: ri(lo, hi) }];
  while (out.length < n) out.push({ id: pick(zone.wild), lv: ri(lo, Math.max(lo, hi - 1)) });
  for (const e of out) if (rnd() < PETS.shinyRate) e.shiny = true; // 异色：很少见
  return out;
}

// ---------- 单位 ----------
const unit = o => ({ fx: {}, burn: 0, shield: 0, av: rnd() * 350, ...o });
const petSkillLv = lv => Math.min(10, 1 + Math.floor(lv / 5));
const mobSkillLv = lv => Math.min(10, 1 + Math.floor(lv / 6));
function petUnit(p, key) {
  const m = MONSTERS[p.id];
  return unit({ key, side: 'a', name: petName(p), st: petStats(p), hp: p.hp, mp: 99, el: m.el, skills: (p.skills || m.skills).map(id => skillAt(id, petSkillLv(p.lv))), mid: p.id, uid: p.uid, fam: m.fam, evo: p.evo || 0, shiny: !!p.shiny, tint: petTint(p), love: loveLv(p) });
}
function enemyUnit(id, lv, key, shiny) {
  const m = MONSTERS[id], st = monsterStats(id, lv);
  return unit({ key, side: 'b', shiny: !!shiny, name: (shiny ? '异色·' : '') + m.name, st, hp: st.hp, mp: st.mp, el: m.el, skills: m.skills.map(k => skillAt(k, mobSkillLv(lv))), mid: id, lv, boss: !!m.boss, brk: 0, ctrlRes: m.boss ? 0.8 : 1, phase: 0, fam: m.fam });
}

export function startBattle(s, enemies, isBoss) {
  const h = s.hero, units = [];
  units.push(unit({ key: 'hero', side: 'a', name: CLASSES[h.cls].name, st: heroStats(s), hp: Math.max(1, h.hp), mp: h.mp, el: CLASSES[h.cls].el || 'none', skills: heroSkills(s).map(id => skillAt(id, skillLv(s, id))) }));
  activePets(s).filter(p => p.hp > 0).slice(0, ACTIVE_MAX).forEach((p, i) => units.push(petUnit(p, 'p' + i)));
  enemies.forEach((e, i) => units.push(enemyUnit(e.id, e.lv, 'e' + i, e.shiny)));
  for (const u of units) if (u.side === 'b' && !s.world.dex[u.mid]) s.world.dex[u.mid] = 'seen';
  const hero = units[0], fl = hero.st.flags || {};
  for (const u of units) if (u.side === 'a' && u.st.flags?.firstStrike) u.av += BAR * 0.5;
  if (fl.setCloud) for (const u of units) if (u.side === 'a') { u.shield = Math.round(u.st.hp * 0.15); u.fx.shield = 99; }
  // 亲密度高的伙伴在场，开场就有一些默契
  const bond0 = Math.min(30, 3 * Math.max(0, ...units.filter(u => u.love).map(u => u.love - 1)));
  return { units, turn: 0, over: null, isBoss, captured: null, bond: bond0, cur: null, actor: null, used: {}, nextE: enemies.length, nextP: units.filter(u => u.side === 'a').length - 1 };
}
export const alive = (b, side) => b.units.filter(u => u.side === side && u.hp > 0);
const other = side => (side === 'a' ? 'b' : 'a');

// ---------- 数值 ----------
export function stat(u, k) {
  const f = u.fx, v = u.st[k];
  if (k === 'atk' || k === 'mag') return v * (f.atkUp ? 1.25 : 1);
  if (k === 'def') return v * (f.defUp ? 1.25 : 1) * (f.defDown ? 0.7 : 1) * (u.st.flags?.rings ? 1 + 0.5 * (1 - u.hp / u.st.hp) : 1);
  if (k === 'spd') return v * (f.spdUp ? 1.25 : 1) * (f.spdDown ? 0.75 : 1);
  return v;
}
export function elMul(el, tel) {
  if (!el || el === 'none' || !tel || tel === 'none') return [1, 0];
  if (BEATS[el] === tel) return [1.5, 1];
  if (BEATS[tel] === el) return [0.67, -1];
  return [1, 0];
}
const skillEls = (att, sk) => sk.els || [sk.el || (sk.kind === 'magic' ? att.el : 'none')];

// 伤害 = max(攻×P − 防×0.5, 攻×P×0.1) × 元素 × 同属性 × 暴击 × (1 − 抗性) × 浮动 × 倒地
export function damage(att, tgt, sk) {
  const magic = sk.kind === 'magic', P = sk.power || 1, pierce = 1 - (sk.pierce || 0);
  const A = stat(att, magic ? 'mag' : 'atk') + (sk.add || 0) + (sk.defScale ? stat(att, 'def') * sk.defScale : 0);
  let d = Math.max(A * P - stat(tgt, 'def') * 0.5 * pierce, A * P * 0.1);
  const els = skillEls(att, sk);
  let best = [-1, 0], bestEl = 'none';
  for (const el of els) { const m = elMul(el, tgt.el); if (m[0] > best[0]) { best = m; bestEl = el; } }
  d *= best[0];
  if (att.el !== 'none' && els.includes(att.el)) d *= 1.2;
  const crit = !!sk.forceCrit || !!att.nextCrit || rnd() < 0.05 + stat(att, 'spd') / 800 + (sk.critBonus || 0) + (att.st.crit || 0) / 100;
  if (crit) d *= 1.6 + (att.st.critDmg || 0) / 100;
  d *= 1 - Math.min(0.6, (tgt.st.res?.[bestEl] || 0) / 100) * pierce;
  d *= 0.92 + rnd() * 0.16;
  const fl = att.st.flags || {};
  if (fl.execute && tgt.hp < tgt.st.hp * 0.5) d *= 1.2;
  if (fl.setFull && att.hp >= att.st.hp) d *= 1.2;
  if (sk.combo && fl.setCombo) d *= 1.4;
  if (att.fx.charge && sk.power) d *= 2;
  if (tgt.fx.guardUp) d *= 0.5;
  if (tgt.fx.broken) d *= 1.5;
  return { dmg: Math.max(1, Math.round(d)), crit, eff: best[1], el: bestEl };
}

// ---------- 行动条 ----------
const speedOf = u => Math.max(1, stat(u, 'spd'));
function nextActor(b) {
  const live = b.units.filter(u => u.hp > 0);
  let dt = Infinity; for (const u of live) dt = Math.min(dt, (BAR - u.av) / speedOf(u));
  dt = Math.max(0, dt); for (const u of live) u.av += speedOf(u) * dt;
  const u = live.reduce((a, c) => (c.av > a.av + 1e-6 || (Math.abs(c.av - a.av) < 1e-6 && speedOf(c) > speedOf(a)) ? c : a));
  u.av = Math.max(0, u.av - BAR); return u;
}
// 接下来 n 次轮到谁（不改动战斗）
export function forecast(b, n = 8) {
  const live = b.units.filter(u => u.hp > 0).map(u => ({ key: u.key, av: u.av, sp: speedOf(u), skip: u.fx.freeze || u.fx.sleep || u.fx.broken || u.fx.bind ? 1 : 0 })), out = [];
  if (!live.length) return out;
  while (out.length < n) {
    let dt = Infinity; for (const u of live) dt = Math.min(dt, (BAR - u.av) / u.sp);
    dt = Math.max(0, dt); for (const u of live) u.av += u.sp * dt;
    const u = live.reduce((a, c) => (c.av > a.av + 1e-6 ? c : a)); u.av = Math.max(0, u.av - BAR);
    out.push(u.key);
  }
  return out;
}

// ---------- 状态 ----------
function applyFx(b, src, t, f, ev, sure = false) {
  const S = STATUS[f.type]; if (!S || t.hp <= 0) return false;
  let chance = sure ? 1 : f.chance ?? 1;
  if (S.kind !== 'buff' && !sure) chance *= (1 + (src.st.ailHit || 0) / 100) * (1 - Math.min(0.8, (t.st.ailRes || 0) / 100));
  if (S.ctrl && t.boss && !sure) chance *= t.ctrlRes;
  if ((f.type === 'sleep' || f.type === 'confuse') && t.st.flags?.rooted) chance = 0;
  if (rnd() >= chance) { if (S.kind !== 'buff' && f.chance != null) ev.push({ t: 'resist', who: t.key, fx: f.type }); return false; }
  if (S.ctrl && t.boss) t.ctrlRes *= 0.5;
  let turns = f.turns || S.turns; if (t === b.actor) turns++; // 给自己上的状态，本回合结束不算
  if (f.type === 'burn') t.burn = Math.min(src.st.flags?.embers ? 5 : 3, (t.fx.burn ? t.burn : 0) + (f.stacks || 1));
  t.fx[f.type] = Math.max(t.fx[f.type] || 0, turns);
  ev.push({ t: 'fx', who: t.key, fx: f.type, stacks: f.type === 'burn' ? t.burn : undefined });
  if (t.boss && S.kind !== 'buff') addBreak(b, t, S.ctrl ? 30 : 12, ev);
  return true;
}
function clearFx(t, k, ev) { if (!t.fx[k]) return; delete t.fx[k]; if (k === 'burn') t.burn = 0; if (k === 'shield') t.shield = 0; ev.push({ t: 'fxEnd', who: t.key, fx: k }); }
function cleanse(t, ev) { for (const k in t.fx) if (STATUS[k]?.kind === 'ailment') clearFx(t, k, ev); }
function giveShield(t, n, ev) { n = Math.round(n); if (n <= 0 || t.hp <= 0) return; t.shield = Math.max(t.shield, n); t.fx.shield = 99; ev.push({ t: 'shield', who: t.key, n: t.shield }); }

// 首领破绽条：克制、暴击、控制都会让它涨，满了倒地一回合
function addBreak(b, t, n, ev) {
  if (!t.boss || t.hp <= 0 || t.fx.broken) return;
  t.brk = Math.min(100, t.brk + n); ev.push({ t: 'brk', who: t.key, v: t.brk });
  if (t.brk >= 100) { t.brk = 0; t.fx.broken = 1; t.av = 0; clearFx(t, 'stealth', ev); ev.push({ t: 'break', who: t.key }); }
}
// 首领阶段：血量降到门槛时换招、叫帮手、换元素
function checkPhase(b, t, ev) {
  const ph = MONSTERS[t.mid].phases; if (!ph) return;
  while (t.hp > 0 && t.phase < ph.length && t.hp / t.st.hp <= ph[t.phase].at) {
    const p = ph[t.phase++]; ev.push({ t: 'phase', who: t.key, text: p.text, n: t.phase });
    if (p.el) { t.el = p.el; ev.push({ t: 'el', who: t.key, el: p.el }); }
    if (p.skills) t.skills = p.skills.map(id => skillAt(id, mobSkillLv(t.lv) + 2));
    for (const k of p.fx || []) applyFx(b, t, t, { type: k }, ev, true);
    if (p.shield) giveShield(t, t.st.hp * p.shield, ev);
    for (const id of p.summon || []) {
      if (alive(b, 'b').length >= ENEMY_MAX) break;
      const u = enemyUnit(id, Math.max(1, t.lv - 1), 'e' + b.nextE++); u.av = BAR * 0.4; b.units.push(u);
      ev.push({ t: 'summon', who: u.key });
    }
  }
}

function hurt(b, t, n, by, info, ev) {
  let absorbed = 0;
  if (t.shield > 0 && !info.dot) { absorbed = Math.min(t.shield, n); t.shield -= absorbed; n -= absorbed; if (t.shield <= 0) clearFx(t, 'shield', ev); }
  if (t.hp - n <= 0 && t.fx.lastStand) { n = t.hp - 1; clearFx(t, 'lastStand', ev); ev.push({ t: 'endure', who: t.key }); }
  else if (t.hp - n <= 0 && t.st.flags?.phoenix && !t.endured) { n = t.hp - 1; t.endured = true; ev.push({ t: 'endure', who: t.key }); }
  t.hp = Math.max(0, t.hp - n);
  ev.push({ t: 'hit', who: t.key, by, dmg: n, absorbed, crit: info.crit, eff: info.eff, el: info.el, dot: info.dot, hp: t.hp });
  if (!info.dot) {
    if (t.fx.sleep) clearFx(t, 'sleep', ev);
    if (t.fx.freeze && info.el === 'fire') clearFx(t, 'freeze', ev);
    if (t.side === 'a') b.bond = Math.min(BOND_MAX, b.bond + 5);
    if (t.boss) addBreak(b, t, 5 + (info.eff > 0 ? 17 : 0) + (info.crit ? 18 : 0), ev);
  }
  if (t.hp <= 0) { ev.push({ t: 'ko', who: t.key }); t.fx = {}; t.shield = 0; t.burn = 0; }
  else if (t.boss) checkPhase(b, t, ev);
}
function heal(b, src, t, n, ev) {
  if (t.hp <= 0) return; if (t.fx.poison) n *= 0.5; n *= 1 + (src.st.healUp || 0) / 100;
  const crit = src.st.flags?.healCrit && rnd() < 0.1 + (src.st.crit || 0) / 100; if (crit) n *= 1.5;
  n = Math.max(1, Math.round(n));
  t.hp = Math.min(t.st.hp, t.hp + n); ev.push({ t: 'heal', who: t.key, n, hp: t.hp, crit });
}

// ---------- 出手 ----------
function visible(foes) { const vis = foes.filter(f => !f.fx.stealth); return vis.length ? vis : foes; }
function chooseTarget(foes, key) {
  const pool = visible(foes), taunt = pool.filter(f => f.fx.taunt);
  if (taunt.length && foes[0]?.side === 'a') return pick(taunt); // 敌人被嘲讽
  return pool.find(f => f.key === key) || pick(pool);
}
function strike(b, u, t, sk, ev, last) {
  // 庇荫：替队友挨单体攻击
  if (sk.target === 'one' && t.side !== u.side) { const cov = alive(b, t.side).find(x => x.fx.cover && x !== t); if (cov) { t = cov; ev.push({ t: 'cover', who: cov.key }); } }
  let miss = 0;
  if (t.side !== u.side) {
    if (sk.kind === 'phys') miss = Math.min(0.25, Math.max(0, (stat(t, 'spd') - stat(u, 'spd')) / 200));
    miss += ((t.st.dodge || 0) * (sk.kind === 'phys' ? 1 : 0.5) - (u.st.hit || 0)) / 100;
  }
  if (u.fx.blind) miss += 0.4;
  if (rnd() < miss) { ev.push({ t: 'miss', who: t.key }); if (t.st.flags?.setShadow) t.nextCrit = true; return; }
  const r = damage(u, t, sk); u.nextCrit = false; hurt(b, t, r.dmg, u.key, r, ev);
  const fl = u.st.flags || {};
  if (fl.lifesteal && u.hp > 0) heal(b, u, u, r.dmg * 0.06, ev);
  if (r.crit && u.side === 'a' && fl.bondCrit) b.bond = Math.min(BOND_MAX, b.bond + 10);
  if (r.crit && fl.setRush && u.hp > 0) applyFx(b, u, u, { type: 'spdUp', turns: 1 }, ev, true);
  if (t.hp > 0 && last) for (const f of sk.fx || []) applyFx(b, u, t, f, ev);
  if (sk.kind === 'phys' && t.side !== u.side && u.hp > 0) {
    if (t.fx.thorns) hurt(b, u, Math.max(1, Math.round(r.dmg * 0.3)), t.key, { thorns: true }, ev);
    if (t.fx.counter && t.hp > 0 && u.hp > 0 && !sk.isCounter && !t.fx.freeze && !t.fx.sleep && !t.fx.bind) {
      ev.push({ t: 'act', who: t.key, name: '反击', kind: 'phys', plain: true, target: u.key, counter: true });
      strike(b, t, u, { ...PLAIN, isCounter: true }, ev, true);
    }
  }
}
function act(b, u, action, ev) {
  const foes = alive(b, other(u.side)), friends = alive(b, u.side);
  if (!foes.length) return;
  if (u.fx.confuse && rnd() < 0.4) { // 混乱：打自己人
    const t = pick(friends.filter(f => f !== u)) || u;
    ev.push({ t: 'act', who: u.key, name: '晕头转向', kind: 'phys', plain: true, confused: true });
    strike(b, u, t, PLAIN, ev, true); return;
  }
  let sk = action.type === 'combo' ? action.sk : action.type === 'skill' ? u.skills.find(k => k.id === action.skill) || PLAIN : PLAIN;
  if (sk.once && b.used[u.key + sk.id]) sk = PLAIN;
  const cost = mpCost(u, sk);
  if (cost) { if (u.mp < cost) sk = PLAIN; else u.mp -= cost; }
  if (sk.once) b.used[u.key + sk.id] = 1;
  if (sk.shieldScale) sk = { ...sk, add: alive(b, u.side).reduce((a, x) => a + x.shield, 0) * sk.shieldScale };
  if (u.side === 'a') b.bond = Math.min(BOND_MAX, b.bond + 8);
  const single = sk.target === 'one' ? chooseTarget(foes, action.target) : null;
  ev.push({ t: 'act', who: u.key, name: sk.name, skill: sk.id, kind: sk.kind, el: skillEls(u, sk)[0], plain: sk === PLAIN, target: single?.key, all: sk.target === 'all', combo: sk.combo ? sk.pet : undefined });
  if (sk.kind === 'revive') {
    const dead = b.units.filter(x => x.side === u.side && x.hp <= 0 && !x.caught);
    const t = dead.find(x => x.key === 'hero') || dead[0];
    if (t) { t.hp = Math.max(1, Math.round(t.st.hp * sk.power)); t.fx = {}; t.av = BAR * 0.3; ev.push({ t: 'revive', who: t.key, hp: t.hp }); }
    else ev.push({ t: 'miss', who: u.key });
  } else if (sk.kind === 'phys' || sk.kind === 'magic') {
    const targets = sk.target === 'all' ? foes : [single];
    const hits = sk.hits || 1;
    if (sk.detonate) for (const t of targets) if (t.fx.burn) { const st = t.burn; clearFx(t, 'burn', ev); const r = damage(u, t, { ...sk, power: sk.detonate * st, fx: [] }); hurt(b, t, r.dmg, u.key, { ...r, detonate: st }, ev); }
    for (const t of targets) for (let h = 0; h < hits && t.hp > 0; h++) strike(b, u, t, { ...sk, forceCrit: sk.lastCrit && h === hits - 1 }, ev, h === hits - 1);
    if (sk.splash && single) for (const t of alive(b, other(u.side))) if (t !== single) { const r = damage(u, t, sk); hurt(b, t, Math.round(r.dmg * sk.splash), u.key, r, ev); }
  } else if (sk.kind === 'heal') {
    if (sk.revive) for (const t of b.units) if (t.side === u.side && t.hp <= 0 && !t.caught) { t.hp = 1; t.fx = {}; ev.push({ t: 'revive', who: t.key, hp: 1 }); }
    const mates = alive(b, u.side);
    const targets = sk.target === 'party' ? mates : sk.target === 'self' ? [u] : [mates.reduce((a, c) => (c.hp / c.st.hp < a.hp / a.st.hp ? c : a))];
    for (const t of targets) { heal(b, u, t, stat(u, 'mag') * sk.power * (0.92 + rnd() * 0.16) + t.st.hp * 0.08, ev); if (sk.cleanse) cleanse(t, ev); for (const f of sk.fx || []) applyFx(b, u, t, f, ev); }
  } else if (sk.kind === 'buff') {
    const targets = sk.target === 'self' ? [u] : friends;
    for (const t of targets) { for (const f of sk.fx || []) applyFx(b, u, t, f, ev); if (sk.shield) giveShield(t, stat(u, 'mag') * sk.shield + t.st.hp * 0.05, ev); }
  } else if (sk.kind === 'debuff') {
    const targets = sk.target === 'all' ? foes : [single];
    for (const t of targets) for (const f of sk.fx || []) applyFx(b, u, t, f, ev);
  }
  for (const f of sk.selfFx || []) applyFx(b, u, u, f, ev, true);
  if (u.fx.charge && sk.power && sk.kind !== 'heal') clearFx(u, 'charge', ev); // 蓄焰用掉了
  // 连携技附带的我方效果
  const mates = alive(b, u.side);
  if (sk.party) for (const t of mates) for (const f of sk.party) applyFx(b, u, t, f, ev);
  if (sk.combo && sk.shield) for (const t of mates) giveShield(t, stat(u, 'mag') * 0.3 + t.st.hp * 0.12 * sk.shield, ev);
  if (sk.combo && sk.healAll) for (const t of mates) heal(b, u, t, t.st.hp * sk.healAll, ev);
}

export const mpCost = (u, sk) => Math.round((sk.mp || 0) * (u.st.flags?.mpSave ? 0.75 : 1) * (u.st.flags?.setMp ? 0.8 : 1));
// 怪物和伙伴怎么出手
function aiAction(b, u) {
  const foes = alive(b, other(u.side)), friends = alive(b, u.side), usable = u.skills.filter(k => u.mp >= (k.mp || 0));
  const pool = visible(foes), taunt = pool.filter(f => f.fx.taunt);
  const target = (u.side === 'a' ? pool.reduce((a, c) => (c.hp < a.hp ? c : a)) : taunt.length ? pick(taunt) : pick(pool)).key;
  const wounded = friends.some(f => f.hp < f.st.hp * 0.45);
  for (const k of usable) {
    if (k.kind === 'heal') { if ((k.target === 'self' ? u.hp < u.st.hp * 0.5 : wounded) && (u.healed = (u.healed || 0) + 1) <= 3) return { type: 'skill', skill: k.id }; continue; }
    if (k.kind === 'buff') { const ts = k.target === 'self' ? [u] : friends; if (ts.some(t => !t.fx[k.fx?.[0]?.type]) && rnd() < 0.3) return { type: 'skill', skill: k.id }; continue; }
    if (k.kind === 'debuff') { if (foes.some(t => !t.fx[k.fx?.[0]?.type]) && rnd() < 0.35) return { type: 'skill', skill: k.id }; continue; }
  }
  const atk = usable.filter(k => k.power);
  if (atk.length && rnd() < (u.boss ? 0.6 : 0.4)) { const k = foes.length > 1 && atk.find(x => x.target === 'all') || pick(atk); return { type: 'skill', skill: k.id, target }; }
  return { type: 'attack', target };
}

// 连携技：英雄 + 第一只出战伙伴，科别定效果、职业定伤害类型
export function comboFor(b, s) {
  const pet = alive(b, 'a').filter(u => u.key !== 'hero').sort((x, y) => (y.love || 0) - (x.love || 0))[0], hero = b.units[0]; if (!pet || hero.hp <= 0) return null;
  const t = COMBO[pet.fam] || COMBO.guard, st = COMBO_STYLE[s.hero.cls];
  const els = [pet.el, st.el].filter(e => e && e !== 'none');
  return { ...t, id: 'combo', combo: true, pet: pet.key, kind: st.kind, els: els.length ? els : ['none'], name: t.names?.[s.hero.cls] || `${st.word}·${t.name}`, add: stat(pet, 'atk') * 0.6, mp: 0, healAll: st.heal };
}
export const canCombo = (b, s) => b.bond >= BOND_MAX && !!comboFor(b, s);
// 可以换上场的伙伴
export const benchPets = (b, s) => s.pets.filter(p => !p.home && p.hp > 0 && !b.units.some(u => u.uid === p.uid));

// 自动战斗时英雄的选择
export function autoHeroAction(b, s) {
  const h = b.units[0], foes = alive(b, 'b'), sks = h.skills.filter(k => h.mp >= mpCost(h, k) && !(k.once && b.used['hero' + k.id]));
  const rev = sks.find(k => k.kind === 'revive'); if (rev && b.units.some(u => u.side === 'a' && u.hp <= 0 && !u.caught)) return { type: 'skill', skill: rev.id };
  const fin = sks.find(k => k.once && k.power); if (fin && foes.some(f => f.boss)) return { type: 'skill', skill: fin.id, target: (foes.find(f => f.boss) || foes[0]).key };
  const vis = foes.filter(f => !f.fx.stealth), pool = vis.length ? vis : foes;
  const target = (pool.find(f => f.boss) || pool.reduce((a, c) => (c.hp < a.hp ? c : a))).key;
  if (canCombo(b, s)) return { type: 'combo', target };
  const heal = sks.find(k => k.kind === 'heal'); if (heal && alive(b, 'a').some(u => u.hp < u.st.hp * 0.45)) return { type: 'skill', skill: heal.id };
  if (h.hp < h.st.hp * 0.35 && s.bag.items.pill > 0) return { type: 'item', item: 'pill' };
  const aoe = sks.find(k => k.target === 'all' && k.power); if (aoe && foes.length >= 2) return { type: 'skill', skill: aoe.id, target };
  const dmg = sks.filter(k => k.power && k.target === 'one' && k.kind !== 'heal').pop(); if (dmg && (h.mp > h.st.mp * 0.3 || foes.some(f => f.boss))) return { type: 'skill', skill: dmg.id, target };
  return { type: 'attack', target };
}

function heroTurn(b, s, a, ev) {
  const u = b.units[0];
  if (a.type === 'flee') { const ok = !b.isBoss && rnd() < 0.75; ev.push({ t: 'flee', ok }); if (ok) b.over = 'flee'; return; }
  if (a.type === 'item') {
    const it = ITEMS[a.item]; if (!(s.bag.items[a.item] > 0)) return act(b, u, { type: 'attack' }, ev);
    s.bag.items[a.item]--; ev.push({ t: 'act', who: 'hero', name: it.name, kind: 'item' });
    if (it.use === 'hp') { const t = alive(b, 'a').reduce((x, c) => (c.hp / c.st.hp < x.hp / x.st.hp ? c : x)); heal(b, u, t, t.st.hp * it.amount, ev); }
    if (it.use === 'mp') { const n = Math.round(u.st.mp * it.amount); u.mp = Math.min(u.st.mp, u.mp + n); ev.push({ t: 'mp', who: 'hero', n }); }
    return;
  }
  if (a.type === 'capture') {
    if (!(s.bag.items.seed > 0)) return act(b, u, { type: 'attack', target: a.target }, ev);
    s.bag.items.seed--; const t = b.units.find(x => x.key === a.target && x.hp > 0 && x.side === 'b') || alive(b, 'b')[0];
    ev.push({ t: 'act', who: 'hero', name: '灵种', kind: 'capture', target: t.key });
    const calm = t.fx.sleep || t.fx.freeze ? 1.5 : 1;
    const chance = t.boss ? 0 : Math.min(0.95, (0.08 + (1 - t.hp / t.st.hp) * 0.85) * calm * (1 + (u.st.capture || 0) / 100));
    const ok = rnd() < chance; ev.push({ t: 'capture', who: t.key, ok, boss: t.boss });
    if (ok) { t.hp = 0; t.caught = true; b.captured = { id: t.mid, lv: t.lv, shiny: !!t.shiny }; }
    return;
  }
  if (a.type === 'swap') { // 换伙伴：耗掉英雄这一次行动
    const p = s.pets.find(x => x.uid === a.uid && x.hp > 0); if (!p) return;
    const old = b.units.find(x => x.key === a.slot && x.side === 'a' && x.key !== 'hero');
    const key = old ? old.key : 'p' + b.nextP++, nu = petUnit(p, key);
    if (old) { const op = s.pets.find(x => x.uid === old.uid); if (op) op.hp = old.hp; b.units[b.units.indexOf(old)] = nu; }
    else b.units.push(nu);
    const slot = s.party.indexOf(old?.uid); if (slot >= 0) s.party[slot] = p.uid; else { const free = s.party.indexOf(null); if (free >= 0) s.party[free] = p.uid; }
    nu.av = BAR * 0.3; ev.push({ t: 'swap', who: key, mid: p.id }); return;
  }
  if (a.type === 'combo') { const sk = canCombo(b, s) && comboFor(b, s); if (sk) { b.bond = 0; return act(b, u, { type: 'combo', sk, target: a.target }, ev); } }
  act(b, u, a.type === 'combo' ? { type: 'attack', target: a.target } : a, ev);
}

// 回合开始：持续伤害和回血、被控就跳过
function beginTurn(b, u, ev) {
  u.extra = u.pendingExtra; u.pendingExtra = false;
  if (u.key === 'hero' && !u.extra) b.turn++;
  if (!u.extra) {
    if (u.fx.regen) heal(b, u, u, u.st.hp * (u.boss ? 0.02 : 0.06), ev);
    if (u.st.flags?.setRegen && u.hp < u.st.hp) heal(b, u, u, u.st.hp * 0.03, ev);
    const leader = b.units[0]; if (u.side === 'a' && leader.hp > 0 && leader.st.flags?.teamRegen && u.hp < u.st.hp) heal(b, leader, u, u.st.hp * 0.02, ev);
    if (u.st.flags?.mpRegen) u.mp = Math.min(u.st.mp, u.mp + Math.round(u.st.mp * 0.05));
  }
  if (u.extra) return true;
  const dot = u.boss ? 0.3 : 1; // 首领血厚，按比例掉血打折
  if (u.fx.burn) hurt(b, u, Math.max(1, Math.round(u.st.hp * 0.05 * u.burn * dot)), null, { dot: 'burn' }, ev);
  if (u.hp > 0 && u.fx.poison) hurt(b, u, Math.max(1, Math.round(u.st.hp * 0.04 * dot)), null, { dot: 'poison' }, ev);
  if (u.hp <= 0) return false;
  for (const k of ['broken', 'freeze', 'sleep', 'bind']) if (u.fx[k]) { ev.push({ t: 'skip', who: u.key, why: k }); return false; }
  return true;
}
function endTurn(b, u, ev) {
  if (u.hp <= 0) return;
  if (u.fx.haste && !u.extra) { u.pendingExtra = true; u.av = BAR; } // 影分身：马上再动一次
  if (u.extra) return;
  for (const k in u.fx) if (k !== 'shield' && --u.fx[k] <= 0) clearFx(u, k, ev);
}
function check(b, ev) {
  if (b.over) return;
  if (!alive(b, 'b').length) b.over = 'win'; else if (!alive(b, 'a').length) b.over = 'lose';
  if (b.over) ev.push({ t: 'end', result: b.over });
}

// 推进战斗：先执行英雄的指令（如果正等着），再一直跑到下一次轮到英雄或分出胜负
export function play(b, s, heroAction) {
  const ev = []; if (b.over) return ev;
  if (b.cur && heroAction) { b.actor = b.cur; heroTurn(b, s, heroAction, ev); endTurn(b, b.cur, ev); b.cur = null; check(b, ev); }
  for (let guard = 0; !b.over && guard < 300; guard++) {
    const u = nextActor(b); b.actor = u;
    ev.push({ t: 'turn', who: u.key, order: forecast(b, 8), bond: b.bond });
    if (!beginTurn(b, u, ev)) { endTurn(b, u, ev); check(b, ev); continue; }
    if (u.key === 'hero') { b.cur = u; ev.push({ t: 'yourTurn', bond: b.bond }); return ev; }
    act(b, u, aiAction(b, u), ev); endTurn(b, u, ev); check(b, ev);
  }
  if (!b.over) { b.over = 'flee'; ev.push({ t: 'end', result: 'flee' }); }
  return ev;
}

// 战斗结束后把结果写回存档，返回要展示的战报
export function finishBattle(b, s) {
  const log = [], h = s.hero, heroU = b.units[0];
  h.hp = Math.max(1, heroU.hp); h.mp = heroU.mp;
  for (const u of b.units) if (u.uid) { const p = s.pets.find(x => x.uid === u.uid); if (p) p.hp = u.hp; }
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
  const hs = heroStats(s); gold = Math.round(gold * (1 + (hs.gold || 0) / 100)); xp = Math.round(xp * (1 + (hs.xp || 0) / 100));
  s.wallet.gold += gold; log.push({ t: 'reward', xp, gold });
  gainXp(s, h, xp, log);
  for (const p of s.pets) { // 出战的拿九成经验和亲密度，随身待命的拿一半经验，伙伴屋里的不拿
    if (p.home) continue;
    const fought = b.units.some(u => u.uid === p.uid && u.hp > 0);
    if (fought || (p.hp > 0 && !b.units.some(u => u.uid === p.uid))) gainXp(s, p, Math.round(xp * (fought ? 0.9 : 0.5)), log);
    if (fought && addLove(p, b.isBoss ? 15 : 6)) log.push({ t: 'love', name: petName(p), lv: loveLv(p) });
  }
  // 掉落：装备（首领必掉、一半是本岛套装）、本岛材料、强化石、灵石、图纸、星砂
  const bonus = hs.flags?.lucky ? 3 : 0, drop = (id, n = 1) => { addItem(s, id, n); log.push({ t: 'item', id, n }); };
  if (rnd() < (b.isBoss ? 1 : 0.16)) { const g = makeGear(tier, { bonus, set: b.isBoss && zone.set && rnd() < 0.5 ? zone.set : undefined, minQ: b.isBoss ? 1 : 0 }); s.bag.gear.push(g); log.push({ t: 'gear', g }); }
  if (zone.mats) for (const f of foes) if (!f.boss && rnd() < 0.45) drop(pick(zone.mats));
  if (rnd() < (b.isBoss ? 1 : 0.12)) drop('stone', b.isBoss ? 3 : 1);
  if (rnd() < (b.isBoss ? 0.6 : 0.04)) { const el = pick(['grass', 'water', 'fire', 'star', 'mist']); addGem(s, el, 1); log.push({ t: 'gem', el }); }
  if (b.isBoss && zone.set) { const first = !s.world.bossKills?.[zone.boss]; drop('starSand', first ? 10 : 3); if (first || rnd() < 0.35) drop('bp_' + zone.set); s.world.bossKills = { ...s.world.bossKills, [zone.boss]: (s.world.bossKills?.[zone.boss] || 0) + 1 }; }
  if (rnd() < 0.22) drop(pick(['pill', 'pill', 'dew', 'seed']));
  if (b.captured) {
    const room = roomFor(s);
    if (room) { const p = addPet(s, b.captured.id, b.captured.lv, { shiny: b.captured.shiny, home: room === 'home' }); log.push({ t: 'caught', id: p.id, home: p.home, shiny: p.shiny, stars: aptStars(p) }); questProgress(s, 'capture'); }
    else log.push({ t: 'petfull' });
  }
  h.hp = Math.min(h.hp, heroStats(s).hp);
  return log;
}
