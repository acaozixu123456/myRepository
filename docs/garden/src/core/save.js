// 存档 v3：结构、新开档、从旧版迁移、导出导入存档码。
// v2→v3（第二阶段）：两只伙伴出战、技能等级和技能点、战斗倍速。
// v3→v4（第三阶段）：6 个装备部位和新装备结构、转职路线、灵石、打造等级、伙伴饰品。
// v4→v5（第四阶段）：伙伴资质、性格、天赋、异色、亲密度、技能槽、进化、伙伴屋。
// v5→v6（第五阶段）：家园（田地、打工、料理加成、每日、心情册）。
import { CLASSES, ZONES, MONSTERS, GEAR_SLOTS } from '../data/index.js';
import { heroStats, petStats } from './stats.js';
import { newPetTraits, fitSkills, CARRY_MAX } from './pets.js';
import { PETS } from '../data/index.js';
import { newHome } from './home.js';

export const SAVE_VERSION = 6;
export const ACTIVE_MAX = 2; // 同时出战的伙伴
export const PARTY_MAX = CARRY_MAX; // 随身伙伴上限，多的住伙伴屋

export function newGame(cls, now = Date.now()) {
  const c = CLASSES[cls];
  const s = {
    v: SAVE_VERSION, created: new Date(now).toISOString(), lastSeen: new Date(now).toISOString(), nextUid: 1,
    hero: { cls, lv: 1, xp: 0, attr: { ...c.base }, pts: 0, sp: 0, skills: {}, route: null, hp: 0, mp: 0, gear: emptyGear() },
    pets: [], party: [null, null], houseCap: PETS.houseBase,
    bag: { gear: [], items: { pill: 3, dew: 1, seed: 0 }, gems: {} },
    craft: { lv: 1, xp: 0 },
    wallet: { gold: 20 },
    world: { zone: 'home', unlocked: 1, bosses: {}, dex: {} },
    quests: { main: { i: 0, accepted: false, n: 0 }, done: [], side: {} },
    stats: { kills: 0 },
    settings: { auto: false, speed: 1 },
    home: newHome(),
  };
  for (const [lv, id] of c.skills) if (lv <= 1) s.hero.skills[id] = 1;
  const st = heroStats(s); s.hero.hp = st.hp; s.hero.mp = st.mp;
  return s;
}

const emptyGear = () => Object.fromEntries(Object.keys(GEAR_SLOTS).map(k => [k, null]));
export function addPet(s, id, lv, opts = {}) {
  const home = opts.home ?? s.pets.filter(x => !x.home).length >= CARRY_MAX;
  const p = { uid: 'p' + s.nextUid++, id, lv, xp: 0, hp: 0, charm: null, ...newPetTraits(id, opts.shiny), home };
  p.hp = petStats(p).hp; s.pets.push(p);
  const free = s.party.indexOf(null); if (free >= 0 && !home) s.party[free] = p.uid;
  if (p.shiny) s.world.shiny = { ...s.world.shiny, [id]: 1 };
  s.world.dex[id] = 'caught';
  return p;
}
export function removePet(s, uid) {
  s.pets = s.pets.filter(p => p.uid !== uid);
  s.party = s.party.map(u => (u === uid ? null : u));
}

// v1（rpg.v1，PR #133 的结构）→ v2
export function migrateV1(o) {
  const s = newGame(o.cls);
  Object.assign(s.hero, { lv: o.lv, xp: o.xp, attr: o.attr, pts: o.points || 0, hp: o.hp, mp: o.mp });
  s.hero.gear = {}; for (const k of ['weapon', 'armor', 'charm']) s.hero.gear[k] = o.gear?.[k] ? fixGear(o.gear[k]) : null;
  s.bag.gear = (o.bag || []).map(fixGear);
  s.bag.items = { pill: 0, dew: 0, seed: 0, ...o.items };
  s.wallet.gold = o.gold || 0;
  (o.pets || []).forEach((p, i) => { const np = { uid: 'p' + s.nextUid++, id: p.id, lv: p.lv, xp: p.xp || 0, hp: p.hp }; s.pets.push(np); if (i === o.active) s.party[0] = np.uid; s.world.dex[p.id] = 'caught'; });
  for (const id in o.seen || {}) if (!s.world.dex[id]) s.world.dex[id] = 'seen';
  Object.assign(s.world, { zone: o.zone || 'home', unlocked: o.unlocked || 1, bosses: { ...o.bosses } });
  s.quests.main = { i: o.quest || 0, accepted: !!o.qAccepted, n: o.qn || 0 };
  s.quests.done = (o.quest ? Array.from({ length: o.quest }, (_, i) => 'q' + (i + 1)) : []);
  s.stats.kills = o.kills || 0; s.settings.auto = !!o.autoBattle;
  s.v = 2; delete s.hero.sp; delete s.hero.skills; delete s.hero.route; delete s.craft; delete s.bag.gems; s.party = [s.party[0]];
  return s;
}
function fixGear(g) { const { icon, ...rest } = g; return { plus: 0, ...rest }; }

// v2 → v3：补技能等级（已学会的都算 1 级）和技能点（每升一级 1 点），出战位扩成两个
export function migrateV2(o) {
  const s = { ...o, v: 3 }, h = s.hero = { ...o.hero };
  h.skills = {}; for (const [lv, id] of CLASSES[h.cls]?.skills || []) if (h.lv >= lv) h.skills[id] = 1;
  h.sp = Math.max(0, h.lv - 1);
  s.party = [o.party?.[0] || null, o.party?.[1] || null];
  s.settings = { speed: 1, ...o.settings };
  return s;
}

// v3 → v4：旧装备换成新结构（饰物变成项链），补上新部位、转职、灵石、打造；
// 不再属于基础技能的（影步、狐雾、满月挪进了转职路线）退回技能点
export function migrateV3(o) {
  const s = { ...o, v: 4 }, h = s.hero = { ...o.hero }, c = CLASSES[h.cls];
  const conv = g => { if (!g) return null; const q = Math.min(3, g.rare || 0); return { slot: g.slot === 'charm' ? 'neck' : g.slot, tier: g.tier || 1, q, main: { ...(g.base || g.st) }, plus: Math.min(15, g.plus || 0), luck: 0, name: g.name, affix: [], sockets: Array(Math.max(0, q - 1)).fill(null), price: g.price || 20 }; };
  const old = o.hero.gear || {}; h.gear = emptyGear(); h.gear.weapon = conv(old.weapon); h.gear.armor = conv(old.armor); h.gear.neck = conv(old.charm);
  s.bag = { ...o.bag, gear: (o.bag?.gear || []).map(conv), gems: {} };
  h.route = null;
  const baseIds = new Set(c.skills.map(([, id]) => id)); h.skills = { ...h.skills };
  for (const id in h.skills) if (!baseIds.has(id)) { h.sp += h.skills[id] - 1; delete h.skills[id]; }
  s.craft = { lv: 1, xp: 0 };
  s.pets = (o.pets || []).map(p => ({ charm: null, ...p }));
  return s;
}

// v4 → v5：每只伙伴补上随机资质、性格、天赋，技能槽从种族技能开始；伙伴屋 20 格
export function migrateV4(o) {
  const s = { ...o, v: 5, houseCap: o.houseCap || PETS.houseBase };
  s.pets = (o.pets || []).filter(p => MONSTERS[p.id]).map(p => { const np = { ...newPetTraits(p.id), ...p }; fitSkills(np); return np; });
  return s;
}

// v5 → v6：补上空的家园，支线记录
export function migrateV5(o) { return { ...o, v: 6, home: o.home || newHome(), quests: { side: {}, ...o.quests } }; }

// 读档：接受 v1 到 v6 的对象，返回可用的 v5，不认识就返回 null
export function load(o) {
  if (!o || typeof o !== 'object') return null;
  const up = o.v === SAVE_VERSION ? o : o.v === 5 ? o : o.v === 4 ? migrateV4(o) : o.v === 3 ? migrateV4(migrateV3(o)) : o.v === 2 ? migrateV4(migrateV3(migrateV2(o))) : (o.v === 1 || !o.v) && o.cls ? migrateV4(migrateV3(migrateV2(migrateV1(o)))) : null;
  let s = up && up.v === 5 ? migrateV5(up) : up;
  if (!s || !CLASSES[s.hero?.cls] || !ZONES.some(z => z.id === s.world?.zone)) return null;
  s.pets = s.pets.filter(p => MONSTERS[p.id]);
  s.party = s.party.map(u => (s.pets.some(p => p.uid === u) ? u : null));
  // 旧档换算后上限可能变小，血和灵气不能超过上限
  const st = heroStats(s); s.hero.hp = Math.min(s.hero.hp, st.hp); s.hero.mp = Math.min(s.hero.mp, st.mp);
  for (const p of s.pets) p.hp = Math.min(p.hp, petStats(p).hp);
  return s;
}

// 存档码：可以复制到备忘录，换机或清了数据后再导入
const PREFIX = 'FDQY2:';
export const exportCode = s => PREFIX + btoa(unescape(encodeURIComponent(JSON.stringify(s))));
export function importCode(code) {
  try { const t = code.trim(); if (!t.startsWith(PREFIX)) return null; return load(JSON.parse(decodeURIComponent(escape(atob(t.slice(PREFIX.length)))))); }
  catch { return null; }
}
