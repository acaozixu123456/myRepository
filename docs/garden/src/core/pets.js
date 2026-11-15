// 伙伴：资质、性格、天赋、异色、亲密度、技能槽、进化、融合、伙伴屋。
import { tally } from './tally.js';
import { MONSTERS, PETS, SKILLS, ITEMS } from '../data/index.js';
import { rnd, ri, pick } from './rng.js';

export const APT_KEYS = ['hp', 'atk', 'def', 'spd', 'mag'];
export const APT_NAME = { hp: '生命', atk: '攻击', def: '防御', spd: '速度', mag: '灵力' };
export const CARRY_MAX = PETS.carry;

// ---------- 个体差异 ----------
export function rollApt(shiny = false) {
  const a = {}; for (const k of APT_KEYS) a[k] = shiny ? ri(84, 120) : ri(60, 120); return a;
}
export const aptAvg = p => APT_KEYS.reduce((t, k) => t + (p.apt?.[k] ?? 90), 0) / APT_KEYS.length;
export const aptStars = p => Math.max(1, Math.min(5, 1 + Math.floor((aptAvg(p) - 60) / 12)));
export const famOf = p => MONSTERS[p.id].fam;
export const rollTalent = id => pick(PETS.famTalents[MONSTERS[id].fam] || Object.keys(PETS.talents));
// 新伙伴的个体数据（捕捉、融合、旧档迁移都走这里）
export function newPetTraits(id, shiny = false) {
  const m = MONSTERS[id];
  return { apt: rollApt(shiny), nature: pick(Object.keys(PETS.natures)), talent: rollTalent(id), shiny: !!shiny, evo: 0, love: 0, home: false, known: [...m.skills], skills: [...m.skills] };
}
export const petName = p => (p.evo ? PETS.evo[p.id]?.[p.evo - 1]?.name : null) || MONSTERS[p.id].name;
export const petTint = p => (p.evo ? PETS.evo[p.id]?.[p.evo - 1]?.tint : null) || null;

// 资质、性格、进化、亲密度对数值的倍率
export function petMult(p) {
  const n = PETS.natures[p.nature], evo = [1, 1.12, 1.25][p.evo || 0], love = 1 + 0.015 * (loveLv(p) - 1), out = {};
  for (const k of APT_KEYS) out[k] = ((p.apt?.[k] ?? 90) / 90) * (n?.up === k ? 1.1 : n?.down === k ? 0.9 : 1) * evo * love;
  return out;
}
export function talentBonus(p) { const t = PETS.talents[p.talent]; return { stat: t?.stat || {}, flags: t?.flag ? { [t.flag]: 1 } : {} }; }

// ---------- 亲密度 ----------
export const loveLv = p => Math.min(PETS.loveMax, 1 + Math.floor((p.love || 0) / PETS.loveStep));
export const loveProgress = p => (loveLv(p) >= PETS.loveMax ? 1 : ((p.love || 0) % PETS.loveStep) / PETS.loveStep);
export function addLove(p, n) { const before = loveLv(p); p.love = Math.min(PETS.loveStep * (PETS.loveMax - 1), (p.love || 0) + n); return loveLv(p) > before; }
export function feed(s, uid) {
  const p = s.pets.find(x => x.uid === uid); if (!p || !(s.bag.items.treat > 0)) return null;
  if (loveLv(p) >= PETS.loveMax) return null;
  s.bag.items.treat--; const up = addLove(p, 30); return { up, lv: loveLv(p) };
}

// ---------- 技能槽 ----------
export const skillSlots = p => (loveLv(p) >= PETS.slot4Love ? 4 : 3);
export function equipPetSkill(p, id) {
  if (!p.known.includes(id) || p.skills.includes(id) || p.skills.length >= skillSlots(p)) return false;
  p.skills.push(id); return true;
}
export function unequipPetSkill(p, id) { if (p.skills.length <= 1 || !p.skills.includes(id)) return false; p.skills = p.skills.filter(x => x !== id); return true; }
export function learnBook(s, uid, itemId) {
  const p = s.pets.find(x => x.uid === uid), it = ITEMS[itemId]; if (!p || !it?.skill || !(s.bag.items[itemId] > 0) || p.known.includes(it.skill)) return false;
  s.bag.items[itemId]--; p.known.push(it.skill); if (p.skills.length < skillSlots(p)) p.skills.push(it.skill); return true;
}
// 亲密度掉级不会发生；但融合或迁移后技能数可能超过槽数，裁掉多出来的
export const fitSkills = p => { p.skills = p.skills.filter(id => SKILLS[id] && p.known.includes(id)).slice(0, skillSlots(p)); if (!p.skills.length) p.skills = [p.known[0]]; };

// ---------- 进化 ----------
export const nextEvo = p => PETS.evo[p.id]?.[p.evo || 0] || null;
export function canEvolve(s, p) {
  const e = nextEvo(p); if (!e || p.lv < e.lv) return false;
  return Object.entries(e.need).every(([k, n]) => (s.bag.items[k] || 0) >= n);
}
export function evolve(s, uid) {
  const p = s.pets.find(x => x.uid === uid); if (!p || !canEvolve(s, p)) return null;
  const e = nextEvo(p); for (const [k, n] of Object.entries(e.need)) s.bag.items[k] -= n;
  p.evo = (p.evo || 0) + 1; tally(s, 'evolve');
  if (e.skill && !p.known.includes(e.skill)) { p.known.push(e.skill); if (p.skills.length < skillSlots(p)) p.skills.push(e.skill); }
  return e;
}

// ---------- 伙伴屋 ----------
export const carried = s => s.pets.filter(p => !p.home);
export const housed = s => s.pets.filter(p => p.home);
export const houseCap = s => s.houseCap || PETS.houseBase;
export const roomFor = s => carried(s).length < CARRY_MAX ? 'carry' : housed(s).length < houseCap(s) ? 'home' : null;
export function setHome(s, uid, home) {
  const p = s.pets.find(x => x.uid === uid); if (!p || !!p.home === !!home) return false;
  if (!home && carried(s).length >= CARRY_MAX) return false;
  if (home && housed(s).length >= houseCap(s)) return false;
  p.home = !!home; if (home) s.party = s.party.map(u => (u === uid ? null : u));
  return true;
}
export function expandHouse(s) {
  if (houseCap(s) >= PETS.houseMax || (s.bag.items.starSand || 0) < PETS.houseCost) return false;
  s.bag.items.starSand -= PETS.houseCost; s.houseCap = houseCap(s) + PETS.houseStep; return true;
}

// ---------- 融合 ----------
export const canFuse = (s, a, b) => !!(a && b && a.uid !== b.uid && a.lv >= PETS.fuseLv && b.lv >= PETS.fuseLv && s.wallet.gold >= PETS.fuseCost);
// 结果是 a 的种类，从 1 级重新养；每项资质取两只里较高的再上下浮动，b 的技能随机传下 1 到 2 个
export function fusePreview(a, b) {
  const lo = {}, hi = {}; for (const k of APT_KEYS) { const m = Math.max(a.apt[k], b.apt[k]); lo[k] = Math.max(60, Math.round(m * 0.92)); hi[k] = Math.min(120, Math.round(m * 1.08)); }
  return { lo, hi, inherit: b.known.filter(id => !a.known.includes(id)) };
}
export function fuse(s, uidA, uidB, makePet) {
  const a = s.pets.find(x => x.uid === uidA), b = s.pets.find(x => x.uid === uidB); if (!canFuse(s, a, b)) return null;
  s.wallet.gold -= PETS.fuseCost; tally(s, 'fuse');
  const apt = {}; for (const k of APT_KEYS) apt[k] = Math.max(60, Math.min(120, Math.round(Math.max(a.apt[k], b.apt[k]) * (0.92 + rnd() * 0.16))));
  const pool = b.known.filter(id => !MONSTERS[a.id].skills.includes(id)), give = [];
  for (let i = 0, n = ri(1, 2); i < n && pool.length; i++) give.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  for (const p of [a, b]) if (p.charm) { s.bag.gear.push(p.charm); p.charm = null; }
  const wasHome = a.home && b.home;
  s.pets = s.pets.filter(p => p !== a && p !== b); s.party = s.party.map(u => (u === uidA || u === uidB ? null : u));
  const np = makePet(s, a.id, 1, { shiny: a.shiny || b.shiny ? rnd() < 0.5 : false, home: wasHome });
  np.apt = apt; np.nature = rnd() < 0.5 ? a.nature : b.nature; np.known = [...MONSTERS[a.id].skills, ...give]; np.skills = [...np.known]; fitSkills(np);
  return { pet: np, inherit: give };
}
