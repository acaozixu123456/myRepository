// 委托：灯灵的主线（5 章 40 个，按顺序接）和岛上居民的支线（每人几件，一件件来）。
// 类型：kill 打怪（可限元素 el 或地图 zone）、capture 抓伙伴、boss 首领、level 等级、talk 找人说话、collect 交材料。
import { QUESTS, SIDE_QUESTS, MONSTERS, ITEMS, ZONES, NPCS } from '../data/index.js';
import { makeGear } from './gear.js';
import { bountyEvent } from './home.js';

export const CHAPTERS = ['北坡的灯', '雾里的墨', '落下的星', '琉璃灯罩', '云海之底'];
const zoneOfMon = mid => ZONES.find(z => z.wild?.includes(mid) || z.boss === mid)?.id;
const side = s => (s.quests.side ||= {});

// 一次事件对一个委托的推进
function bump(q, r, type, ev = {}) {
  if (q.type !== type) return;
  if (type === 'kill' && (!q.el || MONSTERS[ev.mid]?.el === q.el) && (!q.zone || zoneOfMon(ev.mid) === q.zone)) r.n++;
  if (type === 'capture' && (!q.zone || zoneOfMon(ev.id) === q.zone)) r.n++;
  if (type === 'boss' && ev.mid === q.boss) r.n = 1;
  if (type === 'talk' && ev.npc === q.npc) r.n = 1;
}
function met(s, q, r) {
  if (q.type === 'level') return s.hero.lv >= q.n;
  if (q.type === 'collect') return (s.bag.items[q.item] || 0) >= q.n;
  if (q.type === 'talk') return r.n >= 1;
  return r.n >= (q.n || 1);
}
function progressText(s, q, r) {
  if (q.type === 'level') return `等级 ${s.hero.lv}/${q.n}`;
  if (q.type === 'boss') return r.n ? '已打败' : `打败${MONSTERS[q.boss].name}`;
  if (q.type === 'talk') return r.n ? '说过话了' : `找${NPCS[q.npc].name}`;
  if (q.type === 'collect') return `${ITEMS[q.item].name} ${Math.min(s.bag.items[q.item] || 0, q.n)}/${q.n}`;
  return `${Math.min(r.n, q.n)}/${q.n}`;
}
// 接下时就算上已经做到的：抓伙伴算已有的同岛伙伴（主线第一只算全部），首领算以前打过的
function startN(s, q) {
  if (q.type === 'capture') return Math.min(q.n, s.pets.filter(p => !q.zone || zoneOfMon(p.id) === q.zone).length);
  if (q.type === 'boss' && s.world.bosses[q.boss] && !q.after) return 1;
  return 0;
}
function pay(s, q) {
  const r = q.reward, got = [];
  if (q.type === 'collect') s.bag.items[q.item] -= q.n;
  s.wallet.gold += r.gold; got.push(`${r.gold} 金币`);
  for (const k in r.items || {}) { s.bag.items[k] = (s.bag.items[k] || 0) + r.items[k]; got.push(`${ITEMS[k].name} ×${r.items[k]}`); }
  if (r.gear) { const g = makeGear(r.gear, { minQ: 1 }); s.bag.gear.push(g); got.push(g.name); }
  s.quests.done.push(q.id);
  return got;
}

// ---------- 主线 ----------
export const currentQuest = s => QUESTS[s.quests.main.i] || null;
export function questProgress(s, type, ev) {
  const q = currentQuest(s), m = s.quests.main; if (q && m.accepted) bump(q, m, type, ev);
  bountyEvent(s, type, ev);
  const a = side(s); for (const id in a) { const sq = sideById(id); if (sq) bump(sq, a[id], type, ev); }
}
export function questDone(s) { const q = currentQuest(s), m = s.quests.main; return !!(q && m.accepted && met(s, q, m)); }
export const questProgressText = s => { const q = currentQuest(s); return q ? progressText(s, q, s.quests.main) : ''; };
export function acceptQuest(s) {
  const q = currentQuest(s), m = s.quests.main; m.accepted = true; m.n = startN(s, q);
  if (q.type === 'capture' && q.ch === 1) m.n = Math.min(q.n, s.pets.length);
}
export function claimQuest(s) {
  const q = currentQuest(s), got = pay(s, q);
  s.quests.main = { i: s.quests.main.i + 1, accepted: false, n: 0 };
  return got;
}
export const rewardText = r => [`${r.gold} 金币`, ...Object.keys(r.items || {}).map(k => `${ITEMS[k].name}×${r.items[k]}`), r.gear ? '一件装备' : ''].filter(Boolean).join('、');
export const questById = id => QUESTS.find(q => q.id === id) || sideById(id);
export const mainDoneCount = s => s.quests.done.filter(id => QUESTS.some(q => q.id === id)).length;
// 主线委托要找的 NPC（对话页用：说完就算）
export const mainTalkNpc = s => { const q = currentQuest(s); return q?.type === 'talk' && s.quests.main.accepted && !s.quests.main.n ? q.npc : null; };

// ---------- 支线 ----------
export const sideById = id => SIDE_QUESTS.find(q => q.id === id);
const zoneOpen = (s, npc) => { const zi = ZONES.findIndex(z => z.id === NPCS[npc].zone); return zi <= s.world.unlocked; };
const bossOf = npc => ZONES.find(z => z.id === NPCS[npc].zone)?.boss;
// 这个 NPC 现在能给的支线：进行中的那件，或者下一件还没做的（after 要先打败本岛首领）
export function sideFor(s, npc) {
  if (!zoneOpen(s, npc)) return null;
  const a = side(s);
  for (const q of SIDE_QUESTS) {
    if (q.npc !== npc || s.quests.done.includes(q.id)) continue;
    if (a[q.id]) return { q, state: met(s, q, a[q.id]) ? 'ready' : 'active', prog: progressText(s, q, a[q.id]) };
    if (q.after && !s.world.bosses[bossOf(npc)]) return null;
    return { q, state: 'new' };
  }
  return null;
}
export function acceptSide(s, id) { const q = sideById(id), a = side(s); if (!q || a[id] || s.quests.done.includes(id)) return false; a[id] = { n: startN(s, q) }; return true; }
export function claimSide(s, id) {
  const q = sideById(id), a = side(s); if (!q || !a[id] || !met(s, q, a[id])) return null;
  delete a[id]; return pay(s, q);
}
export const activeSides = s => Object.keys(side(s)).map(id => { const q = sideById(id); return q && { q, ready: met(s, q, side(s)[id]), prog: progressText(s, q, side(s)[id]) }; }).filter(Boolean);
// 地图上给 NPC 标记：有新支线、可交付、主线要找它
export function npcMark(s, npc) {
  if (mainTalkNpc(s) === npc) return 'main';
  const f = sideFor(s, npc); return f ? (f.state === 'ready' ? 'ready' : f.state === 'new' ? 'new' : null) : null;
}
