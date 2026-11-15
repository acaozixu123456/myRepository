// 岛上的东西：采集点、每天一个宝箱、NPC 对话。
import { ZONES, NPCS, ITEMS, PETS } from '../data/index.js';
import { rnd, ri, pick } from './rng.js';
import { addItem, makeGear, addGem } from './gear.js';

export const GATHER_PER_DAY = 6;
export const today = (now = Date.now()) => { const d = new Date(now); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
// 每天换一次的记录：日期变了就清零
function daily(s, now) { const w = s.world, t = today(now); if (w.daily?.date !== t) w.daily = { date: t, gather: {}, chest: [] }; return w.daily; }
export const gatherLeft = (s, zoneId, now) => Math.max(0, GATHER_PER_DAY - (daily(s, now).gather[zoneId] || 0));
export const chestReady = (s, zoneId, now) => !!ZONES.find(z => z.id === zoneId)?.lv && !daily(s, now).chest.includes(zoneId);

export function gather(s, zoneId, now) {
  const z = ZONES.find(x => x.id === zoneId); if (!z?.mats || !gatherLeft(s, zoneId, now)) return null;
  const d = daily(s, now); d.gather[zoneId] = (d.gather[zoneId] || 0) + 1;
  const id = pick(z.mats), n = ri(1, 2), got = [[id, n]]; addItem(s, id, n);
  if (rnd() < 0.08) { addItem(s, 'starSand', 1); got.push(['starSand', 1]); }
  return got;
}
// 宝箱：金币、本岛材料、强化石，有机会出灵石、技能书、装备
export function openChest(s, zoneId, now) {
  const z = ZONES.find(x => x.id === zoneId), zi = ZONES.indexOf(z); if (!chestReady(s, zoneId, now)) return null;
  daily(s, now).chest.push(zoneId);
  const out = [], gold = Math.round(20 + z.lv[1] * 6); s.wallet.gold += gold; out.push({ text: `${gold} 金币` });
  for (const m of z.mats) { const n = ri(1, 3); addItem(s, m, n); out.push({ text: `${ITEMS[m].name} ×${n}` }); }
  addItem(s, 'stone', 1); out.push({ text: `${ITEMS.stone.name} ×1` });
  if (rnd() < 0.3) { const el = pick(['grass', 'water', 'fire', 'star', 'mist']); addGem(s, el, 1); out.push({ text: '一颗灵石' }); }
  if (rnd() < 0.15) { const b = 'book_' + pick(PETS.books); addItem(s, b, 1); out.push({ text: ITEMS[b].name }); }
  if (rnd() < 0.2) { const g = makeGear(Math.max(1, zi), { minQ: 1 }); s.bag.gear.push(g); out.push({ text: g.name, q: g.q }); }
  return out;
}
export const npcsIn = zoneId => Object.entries(NPCS).filter(([, n]) => n.zone === zoneId).map(([id, n]) => ({ id, ...n }));
// 首领打败以后，NPC 换一套话（后日谈）
export function npcLines(s, id) {
  const n = NPCS[id], z = ZONES.find(x => x.id === n.zone);
  return n.after && z?.boss && s.world.bosses[z.boss] ? n.after : n.lines;
}
