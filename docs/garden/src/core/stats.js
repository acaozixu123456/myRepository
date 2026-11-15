// 角色、怪物、伙伴的数值和升级。
import { homeBonus } from './home.js';
import { SKILLS, CLASSES, MONSTERS, GEAR_SETS, ADVANCE_LV, REROUTE_COST } from '../data/index.js';
import { gearStats, setCounts } from './gear.js';
import { petMult, talentBonus } from './pets.js';

export const MAX_LV = 60;
export const xpNeed = lv => Math.round(18 * Math.pow(lv, 1.55));

// 战斗里用到的全部数值。装备、套装、灵石、被动都在这里合起来。
const EXTRA = ['crit', 'critDmg', 'hit', 'dodge', 'healUp', 'ailHit', 'ailRes', 'capture', 'gold', 'xp'];
const RES = { resGrass: 'grass', resWater: 'water', resFire: 'fire', resStar: 'star', resMist: 'mist' };
export function finishStats(base, bonus, flags = {}) {
  const b = k => bonus[k] || 0, st = {
    hp: Math.round((base.hp + b('hp')) * (1 + b('hpP') / 100)), mp: base.mp,
    atk: Math.round((base.atk + b('atk')) * (1 + b('atkP') / 100)), mag: Math.round((base.mag + b('mag')) * (1 + b('magP') / 100)),
    def: Math.round((base.def + b('def')) * (1 + b('defP') / 100)), spd: Math.round((base.spd + b('spd')) * (1 + b('spdP') / 100)),
    res: {}, flags,
  };
  for (const k of EXTRA) st[k] = b(k);
  for (const [k, el] of Object.entries(RES)) if (b(k)) st.res[el] = b(k);
  return st;
}
export function heroStats(s) {
  const h = s.hero, a = h.attr, bonus = {}, flags = {};
  for (const k in h.gear) gearStats(h.gear[k], bonus);
  const add = (k, v) => { bonus[k] = (bonus[k] || 0) + v; };
  for (const [set, n] of Object.entries(setCounts(h.gear))) {
    const d = GEAR_SETS[set]; if (!d) continue;
    for (const part of [n >= 2 && d.two, n >= 4 && d.four]) if (part) { for (const [k, v] of Object.entries(part.stat || {})) add(k, v); if (part.flag) flags[part.flag] = 1; }
  }
  for (const g of Object.values(h.gear)) if (g?.special) flags[g.special] = 1;
  for (const [k, v] of Object.entries(homeBonus(s))) add(k, v);
  for (const id of heroPassives(s)) { const p = SKILLS[id]; for (const [k, v] of Object.entries(p.stat || {})) add(k, v); if (p.flag) flags[p.flag] = 1; }
  return finishStats({
    hp: 40 + a.vit * 11 + h.lv * 6, mp: Math.round(16 + a.int * 5 + h.lv * 2),
    atk: a.str * 2.2 + h.lv, mag: a.int * 2.2 + h.lv, def: a.vit * 1.1 + h.lv * 0.6, spd: a.agi * 1.6 + h.lv * 0.4,
  }, bonus, flags);
}
export function monsterStats(id, lv) {
  const m = MONSTERS[id], b = { hp: 28 + lv * 15 + lv * lv * 0.4, atk: 7 + lv * 3.6 + lv * lv * 0.05, def: 3 + lv * 1.7, spd: 6 + lv * 1.3 };
  return { hp: Math.round(b.hp * m.hp * 1.3), mp: 10 + lv * 2, atk: Math.round(b.atk * m.atk * 1.08), mag: Math.round(b.atk * m.atk * 1.08), def: Math.round(b.def * m.def), spd: Math.round(b.spd * m.spd) };
}
export function petStats(p) {
  const st = monsterStats(p.id, p.lv); if (!MONSTERS[p.id].boss) { st.hp = Math.round(st.hp * 0.95); st.atk = st.mag = Math.round(st.atk * 0.8); }
  const k = petMult(p); for (const key of ['hp', 'atk', 'def', 'spd', 'mag']) st[key] = Math.round(st[key] * k[key]);
  const t = talentBonus(p), bonus = gearStats(p.charm, {}); for (const [key, v] of Object.entries(t.stat)) bonus[key] = (bonus[key] || 0) + v;
  return finishStats(st, bonus, t.flags);
}
// 能用的主动技能：基础 4 个 + 转职路线里够等级的
export const routeOf = s => (s.hero.route && CLASSES[s.hero.cls].routes?.[s.hero.route]) || null;
export const heroSkills = s => [...CLASSES[s.hero.cls].skills, ...(routeOf(s)?.skills || [])].filter(([lv]) => s.hero.lv >= lv).map(([, id]) => id);
export const heroPassives = s => (CLASSES[s.hero.cls].passives || []).filter(([lv]) => s.hero.lv >= lv).map(([, id]) => id);
// 转职：等级够了选一条路线；换路线要花金币，并退回那条路线上加过的技能点
export function chooseRoute(s, r) {
  const h = s.hero, c = CLASSES[h.cls]; if (!c.routes?.[r] || h.lv < ADVANCE_LV || h.route === r) return false;
  if (h.route) {
    if (s.wallet.gold < REROUTE_COST) return false; s.wallet.gold -= REROUTE_COST;
    for (const [, id] of c.routes[h.route].skills) if (h.skills[id]) { h.sp += h.skills[id] - 1; delete h.skills[id]; }
  }
  h.route = r; for (const [lv, id] of c.routes[r].skills) if (h.lv >= lv) h.skills[id] = h.skills[id] || 1;
  return true;
}
// 免费洗点
export function resetSkills(s) { const h = s.hero; for (const id in h.skills) { h.sp += h.skills[id] - 1; h.skills[id] = 1; } }
export function resetAttr(s) {
  const h = s.hero, c = CLASSES[h.cls];
  for (const k in c.base) h.attr[k] = +(c.base[k] + c.grow[k] * (h.lv - 1)).toFixed(1);
  h.pts = (h.lv - 1) * 3 + (h.bonusPts || 0);
}
// 推荐加点：按职业主属性分配剩下的点
export const RECOMMEND = { cat: { str: 2, agi: 1 }, fox: { int: 2, vit: 1 }, rabbit: { int: 2, vit: 1 }, deer: { str: 2, vit: 1 } };
export function autoAttr(s) {
  const h = s.hero, plan = Object.entries(RECOMMEND[h.cls]); let i = 0;
  while (h.pts > 0) { const [k, w] = plan[i % plan.length]; for (let j = 0; j < w && h.pts > 0; j++) { h.pts--; h.attr[k] = +(h.attr[k] + 1).toFixed(1); } i++; }
}
export const SKILL_MAX = 10;
export const skillLv = (s, id) => s.hero.skills[id] || 1;
// 技能按等级算出实际效果：每级威力 +8%，5 级和 10 级套上 up 里的质变
export function skillAt(id, lv = 1) {
  const base = SKILLS[id]; if (!base) return null;
  const k = { ...base, id, lv };
  if (lv >= 5 && base.up?.['5']) Object.assign(k, base.up['5']);
  if (lv >= 10 && base.up?.['10']) Object.assign(k, base.up['10']);
  if (k.power) k.power = +(k.power * (1 + 0.08 * (lv - 1))).toFixed(3);
  return k;
}
export function raiseSkill(s, id) {
  const h = s.hero; if (h.sp <= 0 || !heroSkills(s).includes(id) || skillLv(s, id) >= SKILL_MAX) return false;
  h.sp--; h.skills[id] = skillLv(s, id) + 1; return true;
}
export const petByUid = (s, uid) => s.pets.find(p => p.uid === uid) || null;
export const activePet = s => petByUid(s, s.party[0]) || petByUid(s, s.party[1]);
export const activePets = s => s.party.map(u => petByUid(s, u)).filter(Boolean);

// who 是英雄（s.hero）或某只伙伴
export function gainXp(s, who, xp, log) {
  const isHero = who === s.hero;
  who.xp += xp;
  while (who.xp >= xpNeed(who.lv) && who.lv < MAX_LV) {
    who.xp -= xpNeed(who.lv); who.lv++;
    if (isHero) {
      const g = CLASSES[s.hero.cls].grow; for (const k in g) s.hero.attr[k] = +(s.hero.attr[k] + g[k]).toFixed(1);
      s.hero.pts += 3; s.hero.sp++;
      const learned = [...CLASSES[s.hero.cls].skills, ...(routeOf(s)?.skills || [])].find(([lv]) => lv === s.hero.lv);
      if (learned) s.hero.skills[learned[1]] = 1;
      if (s.hero.lv === ADVANCE_LV && !s.hero.route) log.push({ t: 'advance' });
      log.push({ t: 'levelup', who: 'hero', lv: s.hero.lv, skill: learned ? SKILLS[learned[1]].name : null });
    } else log.push({ t: 'levelup', who: 'pet', name: MONSTERS[who.id].name, lv: who.lv });
  }
}
export function spendPoint(s, k) { if (s.hero.pts > 0) { s.hero.pts--; s.hero.attr[k] = +(s.hero.attr[k] + 1).toFixed(1); } }
export function fullHeal(s) { const st = heroStats(s); s.hero.hp = st.hp; s.hero.mp = st.mp; for (const p of s.pets) p.hp = petStats(p).hp; }
