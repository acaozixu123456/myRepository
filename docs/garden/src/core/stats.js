// 角色、怪物、伙伴的数值和升级。
import { SKILLS, CLASSES, MONSTERS } from '../data/index.js';

export const MAX_LV = 40;
export const xpNeed = lv => Math.round(18 * Math.pow(lv, 1.55));

export function heroStats(s) {
  const h = s.hero, a = h.attr, g = { atk: 0, mag: 0, def: 0, hp: 0, spd: 0 };
  for (const k in h.gear) if (h.gear[k]) for (const m in h.gear[k].st) g[m] += h.gear[k].st[m];
  return {
    hp: Math.round(40 + a.vit * 11 + h.lv * 6 + g.hp), mp: Math.round(16 + a.int * 5 + h.lv * 2),
    atk: Math.round(a.str * 2.2 + h.lv + g.atk), mag: Math.round(a.int * 2.2 + h.lv + g.mag),
    def: Math.round(a.vit * 1.1 + h.lv * 0.6 + g.def), spd: Math.round(a.agi * 1.6 + h.lv * 0.4 + g.spd),
  };
}
export function monsterStats(id, lv) {
  const m = MONSTERS[id], b = { hp: 28 + lv * 15 + lv * lv * 0.4, atk: 7 + lv * 3.6 + lv * lv * 0.05, def: 3 + lv * 1.7, spd: 6 + lv * 1.3 };
  return { hp: Math.round(b.hp * m.hp * 1.15), mp: 10 + lv * 2, atk: Math.round(b.atk * m.atk), mag: Math.round(b.atk * m.atk), def: Math.round(b.def * m.def), spd: Math.round(b.spd * m.spd) };
}
export function petStats(p) {
  const st = monsterStats(p.id, p.lv); if (MONSTERS[p.id].boss) return st;
  st.hp = Math.round(st.hp * 0.95); st.atk = st.mag = Math.round(st.atk * 0.8); return st;
}
export const heroSkills = s => CLASSES[s.hero.cls].skills.filter(([lv]) => s.hero.lv >= lv).map(([, id]) => id);
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
      const learned = CLASSES[s.hero.cls].skills.find(([lv]) => lv === s.hero.lv);
      if (learned) s.hero.skills[learned[1]] = 1;
      log.push({ t: 'levelup', who: 'hero', lv: s.hero.lv, skill: learned ? SKILLS[learned[1]].name : null });
    } else log.push({ t: 'levelup', who: 'pet', name: MONSTERS[who.id].name, lv: who.lv });
  }
}
export function spendPoint(s, k) { if (s.hero.pts > 0) { s.hero.pts--; s.hero.attr[k] = +(s.hero.attr[k] + 1).toFixed(1); } }
export function fullHeal(s) { const st = heroStats(s); s.hero.hp = st.hp; s.hero.mp = st.mp; for (const p of s.pets) p.hp = petStats(p).hp; }
