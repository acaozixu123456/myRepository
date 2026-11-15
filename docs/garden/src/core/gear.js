// 装备、商店。
import { GEAR_BASE, GEAR_PREFIX, ITEMS } from '../data/index.js';
import { rnd, pick } from './rng.js';
import { heroStats } from './stats.js';

export function makeGear(tier) { // tier 1..4
  const slot = pick(['weapon', 'armor', 'charm']), name = GEAR_BASE[slot][tier - 1];
  const r = rnd(), pi = r < 0.5 ? 0 : r < 0.8 ? 1 : r < 0.95 ? 2 : 3, { name: prefix, mult } = GEAR_PREFIX[pi];
  const base = (4 + tier * 5) * mult, st = {};
  if (slot === 'weapon') { st.atk = Math.round(base); st.mag = Math.round(base); }
  if (slot === 'armor') { st.def = Math.round(base * 0.7); st.hp = Math.round(base * 3); }
  if (slot === 'charm') { st.spd = Math.round(base * 0.5); st.hp = Math.round(base * 1.5); if (pi >= 2) st.def = Math.round(base * 0.25); }
  return { slot, name: prefix + name, tier, rare: pi, st, price: Math.round((10 + tier * 18) * mult), plus: 0 };
}
export const MAX_PLUS = 10;
// 强化：每级让装备数值提高 12%，越往后越贵
export const enhanceCost = g => Math.round(g.price * 1.2 * Math.pow(1.6, g.plus || 0));
export function enhance(s, slot) {
  const g = s.hero.gear[slot]; if (!g || (g.plus || 0) >= MAX_PLUS) return false;
  const cost = enhanceCost(g); if (s.wallet.gold < cost) return false;
  s.wallet.gold -= cost; g.base = g.base || { ...g.st }; g.plus = (g.plus || 0) + 1;
  for (const k in g.base) g.st[k] = Math.round(g.base[k] * (1 + 0.12 * g.plus));
  return true;
}
export const gearScore = g => g ? Object.values(g.st).reduce((a, b) => a + b, 0) : 0;
export function equip(s, i) {
  const g = s.bag.gear[i]; s.bag.gear.splice(i, 1);
  if (s.hero.gear[g.slot]) s.bag.gear.push(s.hero.gear[g.slot]);
  s.hero.gear[g.slot] = g; const st = heroStats(s); s.hero.hp = Math.min(s.hero.hp, st.hp);
}
export function sell(s, i) { s.wallet.gold += Math.round(s.bag.gear[i].price / 2); s.bag.gear.splice(i, 1); }
export function buy(s, id) { if (s.wallet.gold < ITEMS[id].price) return false; s.wallet.gold -= ITEMS[id].price; s.bag.items[id] = (s.bag.items[id] || 0) + 1; return true; }
