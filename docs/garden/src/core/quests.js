// 灯灵的委托，按顺序一个个接。
import { QUESTS, MONSTERS, ITEMS } from '../data/index.js';
import { makeGear } from './gear.js';

export const currentQuest = s => QUESTS[s.quests.main.i] || null;
export function questProgress(s, type, foe) {
  const q = currentQuest(s), m = s.quests.main; if (!q || !m.accepted) return;
  if (q.type === 'kill' && type === 'kill' && (!q.el || MONSTERS[foe.mid].el === q.el)) m.n++;
  if (q.type === 'capture' && type === 'capture') m.n++;
  if (q.type === 'boss' && type === 'boss' && foe.mid === q.boss) m.n = 1;
}
export function questDone(s) {
  const q = currentQuest(s), m = s.quests.main; if (!q || !m.accepted) return false;
  if (q.type === 'level') return s.hero.lv >= q.n;
  if (q.type === 'boss') return m.n >= 1 || !!s.world.bosses[q.boss];
  return m.n >= q.n;
}
export function questProgressText(s) {
  const q = currentQuest(s), m = s.quests.main; if (!q) return '';
  return q.type === 'level' ? `等级 ${s.hero.lv}/${q.n}` : q.type === 'boss' ? `打败${MONSTERS[q.boss].name}` : `${Math.min(m.n, q.n)}/${q.n}`;
}
export function acceptQuest(s) {
  const m = s.quests.main; m.accepted = true; m.n = 0;
  const q = currentQuest(s); if (q.type === 'capture') m.n = Math.min(q.n, s.pets.length);
}
export function claimQuest(s) {
  const q = currentQuest(s), r = q.reward, got = [];
  s.wallet.gold += r.gold; got.push(`${r.gold} 金币`);
  for (const k in r.items || {}) { s.bag.items[k] = (s.bag.items[k] || 0) + r.items[k]; got.push(`${ITEMS[k].name} ×${r.items[k]}`); }
  if (r.gear) { const g = makeGear(r.gear, { minQ: 1 }); s.bag.gear.push(g); got.push(g.name); }
  s.quests.done.push(q.id); s.quests.main = { i: s.quests.main.i + 1, accepted: false, n: 0 };
  return got;
}
export const rewardText = r => [`${r.gold} 金币`, ...Object.keys(r.items || {}).map(k => `${ITEMS[k].name}×${r.items[k]}`), r.gear ? '一件装备' : ''].filter(Boolean).join('、');
export const questById = id => QUESTS.find(q => q.id === id);
