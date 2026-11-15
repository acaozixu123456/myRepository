// 存档 v2：结构、新开档、从 v1 迁移、导出导入存档码。
import { CLASSES, ZONES, MONSTERS } from '../data/index.js';
import { heroStats, petStats } from './stats.js';

export const SAVE_VERSION = 2;
export const PARTY_MAX = 6; // 随身伙伴上限

export function newGame(cls, now = Date.now()) {
  const c = CLASSES[cls];
  const s = {
    v: SAVE_VERSION, created: new Date(now).toISOString(), lastSeen: new Date(now).toISOString(), nextUid: 1,
    hero: { cls, lv: 1, xp: 0, attr: { ...c.base }, pts: 0, hp: 0, mp: 0, gear: { weapon: null, armor: null, charm: null } },
    pets: [], party: [null],
    bag: { gear: [], items: { pill: 3, dew: 1, seed: 0 } },
    wallet: { gold: 20 },
    world: { zone: 'home', unlocked: 1, bosses: {}, dex: {} },
    quests: { main: { i: 0, accepted: false, n: 0 }, done: [] },
    stats: { kills: 0 },
    settings: { auto: false },
  };
  const st = heroStats(s); s.hero.hp = st.hp; s.hero.mp = st.mp;
  return s;
}

export function addPet(s, id, lv) {
  const p = { uid: 'p' + s.nextUid++, id, lv, xp: 0, hp: 0 };
  p.hp = petStats(p).hp; s.pets.push(p);
  if (!s.party[0]) s.party[0] = p.uid;
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
  for (const k of ['weapon', 'armor', 'charm']) s.hero.gear[k] = o.gear?.[k] ? fixGear(o.gear[k]) : null;
  s.bag.gear = (o.bag || []).map(fixGear);
  s.bag.items = { pill: 0, dew: 0, seed: 0, ...o.items };
  s.wallet.gold = o.gold || 0;
  (o.pets || []).forEach((p, i) => { const np = { uid: 'p' + s.nextUid++, id: p.id, lv: p.lv, xp: p.xp || 0, hp: p.hp }; s.pets.push(np); if (i === o.active) s.party[0] = np.uid; s.world.dex[p.id] = 'caught'; });
  for (const id in o.seen || {}) if (!s.world.dex[id]) s.world.dex[id] = 'seen';
  Object.assign(s.world, { zone: o.zone || 'home', unlocked: o.unlocked || 1, bosses: { ...o.bosses } });
  s.quests.main = { i: o.quest || 0, accepted: !!o.qAccepted, n: o.qn || 0 };
  s.quests.done = (o.quest ? Array.from({ length: o.quest }, (_, i) => 'q' + (i + 1)) : []);
  s.stats.kills = o.kills || 0; s.settings.auto = !!o.autoBattle;
  return s;
}
function fixGear(g) { const { icon, ...rest } = g; return { plus: 0, ...rest }; }

// 读档：接受 v1 或 v2 对象，返回可用的 v2，不认识就返回 null
export function load(o) {
  if (!o || typeof o !== 'object') return null;
  let s = o.v === SAVE_VERSION ? o : (o.v === 1 || !o.v) && o.cls ? migrateV1(o) : null;
  if (!s || !CLASSES[s.hero?.cls] || !ZONES.some(z => z.id === s.world?.zone)) return null;
  s.pets = s.pets.filter(p => MONSTERS[p.id]);
  return s;
}

// 存档码：可以复制到备忘录，换机或清了数据后再导入
const PREFIX = 'FDQY2:';
export const exportCode = s => PREFIX + btoa(unescape(encodeURIComponent(JSON.stringify(s))));
export function importCode(code) {
  try { const t = code.trim(); if (!t.startsWith(PREFIX)) return null; return load(JSON.parse(decodeURIComponent(escape(atob(t.slice(PREFIX.length)))))); }
  catch { return null; }
}
