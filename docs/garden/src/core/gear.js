// 装备：生成、属性计算、强化、镶嵌、洗练、分解、打造、商店。
import { tally } from './tally.js';
import { GEAR, ITEMS, ZONES } from '../data/index.js';
import { rnd, ri, pick } from './rng.js';

const SLOTS = Object.keys(GEAR.slots), AFFIX = Object.keys(GEAR.affix);
export const MAX_PLUS = GEAR.maxPlus, QUALITY = GEAR.quality;
export const GEM_MAX = 5;
const tierOfSet = set => Math.max(1, ZONES.findIndex(z => z.id === set));

function rollQuality(bonus = 0) {
  // bonus 让高品质更容易出：每 1 点把普通的几率挪一部分给后面
  const rates = QUALITY.map(q => q.rate);
  for (let i = 0; i < bonus; i++) { const m = Math.min(rates[0], 6); rates[0] -= m; rates[1] += m * 0.45; rates[2] += m * 0.33; rates[3] += m * 0.17; rates[4] += m * 0.05; }
  let r = rnd() * rates.reduce((a, b) => a + b, 0);
  for (let i = 0; i < rates.length; i++) { if ((r -= rates[i]) < 0) return i; }
  return 0;
}
export function rollAffix(k, tier) {
  const a = GEAR.affix[k], v = a.min + rnd() * (a.max - a.min);
  return { k, v: a.scale ? Math.max(1, Math.round(v * tier)) : Math.round(v * (1 + tier * 0.08)) };
}
function newAffixes(n, tier, keep = [], focus = null) {
  const out = [...keep], used = new Set(keep.map(a => a.k));
  if (focus && !used.has(focus) && out.length < n) { out.push(rollAffix(focus, tier)); used.add(focus); }
  while (out.length < n) { const k = pick(AFFIX.filter(x => !used.has(x))); used.add(k); out.push(rollAffix(k, tier)); }
  return out;
}

// opts: { q 品质, slot 部位, set 套装, focus 锁定词条, bonus 品质加成, minQ 品质下限 }
export function makeGear(tier, opts = {}) {
  const slot = opts.slot || pick(SLOTS), q = Math.max(opts.minQ || 0, opts.q ?? rollQuality(opts.bonus || 0)), Q = QUALITY[q];
  const base = (3 + tier * 3.5) * Q.mult, main = {};
  for (const [k, f] of Object.entries(GEAR.main[slot])) main[k] = Math.max(1, Math.round(base * f));
  const g = {
    slot, tier, q, main, plus: 0, luck: 0,
    name: (opts.set ? GEAR.sets[opts.set].name.replace('套', '·') : '') + GEAR.names[slot][Math.min(7, tier - 1)],
    affix: newAffixes(Q.affix, tier, [], opts.focus),
    sockets: Array(Math.max(0, q - 1)).fill(null),
    price: Math.round((10 + tier * 18) * Q.mult * (1 + q * 0.3)),
  };
  if (opts.set) g.set = opts.set;
  if (q === 4) g.special = pick(Object.keys(GEAR.special));
  return g;
}

// 一件装备给的数值：主属性（强化每级 +8%）、词条、灵石
export function gearStats(g, out = {}) {
  if (!g) return out;
  const add = (k, v) => { out[k] = (out[k] || 0) + v; };
  for (const [k, v] of Object.entries(g.main || {})) add(k, Math.round(v * (1 + 0.08 * (g.plus || 0))));
  for (const a of g.affix || []) add(a.k, a.v);
  for (const gem of g.sockets || []) if (gem) { const d = GEAR.gems[gem.el]; add(d.stat, d.per * gem.lv * (d.unit ? 1 : Math.max(1, g.tier))); }
  return out;
}
export const gearScore = g => {
  if (!g) return 0; const st = gearStats(g);
  return Math.round((st.atk || 0) + (st.mag || 0) + (st.def || 0) * 1.4 + (st.hp || 0) * 0.25 + (st.spd || 0) * 2 + (g.affix?.length || 0) * 6 + (g.set ? 4 : 0) + (g.special ? 12 : 0));
};
// 身上穿了哪些套装、几件
export function setCounts(gearMap) {
  const n = {}; for (const g of Object.values(gearMap || {})) if (g?.set) n[g.set] = (n[g.set] || 0) + 1; return n;
}

// ---------- 背包操作 ----------
const bag = s => s.bag.gear;
export function equip(s, i) {
  const g = bag(s)[i]; if (!g) return false; bag(s).splice(i, 1);
  if (s.hero.gear[g.slot]) bag(s).push(s.hero.gear[g.slot]);
  s.hero.gear[g.slot] = g; return true;
}
export function unequip(s, slot) { const g = s.hero.gear[slot]; if (!g) return false; s.hero.gear[slot] = null; bag(s).push(g); return true; }
// 伙伴只有一个饰品槽，能放项链或戒指
export function equipPet(s, uid, i) {
  const p = s.pets.find(x => x.uid === uid), g = bag(s)[i]; if (!p || !g || (g.slot !== 'neck' && g.slot !== 'ring')) return false;
  bag(s).splice(i, 1); if (p.charm) bag(s).push(p.charm); p.charm = g; return true;
}
export function unequipPet(s, uid) { const p = s.pets.find(x => x.uid === uid); if (!p?.charm) return false; bag(s).push(p.charm); p.charm = null; return true; }
export function sell(s, i) { const g = bag(s)[i]; if (!g) return 0; returnGems(s, g); s.wallet.gold += Math.round(g.price / 2); bag(s).splice(i, 1); return Math.round(g.price / 2); }

// 分解：得到灵尘和强化石，镶的灵石退回
export const dismantleGain = g => ({ dust: (1 + g.q) * g.tier + g.plus, stone: g.q + Math.floor(g.plus / 2) });
export function dismantle(s, i) {
  const g = bag(s)[i]; if (!g) return null; const got = dismantleGain(g); returnGems(s, g);
  addItem(s, 'dust', got.dust); if (got.stone) addItem(s, 'stone', got.stone); bag(s).splice(i, 1); return got;
}
// 一键分解：没穿的普通和精良
export function dismantleJunk(s, maxQ = 1) {
  const total = { dust: 0, stone: 0, n: 0 };
  for (let i = bag(s).length - 1; i >= 0; i--) { const g = bag(s)[i]; if (g.q <= maxQ && !g.set && !g.plus) { const r = dismantle(s, i); total.dust += r.dust; total.stone += r.stone; total.n++; } }
  return total;
}

// ---------- 强化 ----------
export const enhanceCost = g => ({ gold: Math.round(20 * g.tier * ((g.plus || 0) + 1) * (1 + g.q * 0.2)), stone: 1 + Math.floor((g.plus || 0) / 3) });
export const enhanceRate = g => Math.min(100, GEAR.plusRate[g.plus || 0] + (g.luck || 0));
export function enhance(s, g) {
  if (!g || (g.plus || 0) >= MAX_PLUS) return null; const c = enhanceCost(g);
  if (s.wallet.gold < c.gold || (s.bag.items.stone || 0) < c.stone) return null;
  s.wallet.gold -= c.gold; s.bag.items.stone -= c.stone;
  const ok = rnd() * 100 < enhanceRate(g); tally(s, ok ? 'enhanceOk' : 'enhanceFail');
  if (ok) { g.plus = (g.plus || 0) + 1; g.luck = 0; } else g.luck = (g.luck || 0) + 10; // 失败只扣材料，累积幸运值保底
  return { ok };
}

// ---------- 灵石 ----------
const gemBag = s => (s.bag.gems ||= {});
export const gemCount = (s, el, lv) => gemBag(s)[`${el}:${lv}`] || 0;
function addGem(s, el, lv, n = 1) { const k = `${el}:${lv}`; gemBag(s)[k] = (gemBag(s)[k] || 0) + n; if (gemBag(s)[k] <= 0) delete gemBag(s)[k]; }
export { addGem };
export function socket(s, g, idx, el, lv) {
  if (!g?.sockets || idx >= g.sockets.length || g.sockets[idx] || gemCount(s, el, lv) < 1) return false;
  addGem(s, el, lv, -1); g.sockets[idx] = { el, lv }; return true;
}
export function unsocket(s, g, idx) { const gem = g?.sockets?.[idx]; if (!gem) return false; addGem(s, gem.el, gem.lv); g.sockets[idx] = null; return true; }
function returnGems(s, g) { (g.sockets || []).forEach((gem, i) => { if (gem) unsocket(s, g, i); }); }
export function fuseGem(s, el, lv) { if (lv >= GEM_MAX || gemCount(s, el, lv) < 3) return false; addGem(s, el, lv, -3); addGem(s, el, lv + 1); return true; }

// ---------- 洗练：花星砂重随没锁的词条 ----------
export const rerollCost = locks => 2 + locks * 2;
export function reroll(s, g, locks = []) {
  if (!g?.affix?.length || locks.length >= g.affix.length) return false; const cost = rerollCost(locks.length);
  if ((s.bag.items.starSand || 0) < cost) return false; s.bag.items.starSand -= cost;
  const keep = g.affix.filter((_, i) => locks.includes(i)), fresh = newAffixes(g.affix.length, g.tier, keep);
  g.affix = g.affix.map((a, i) => (locks.includes(i) ? a : fresh.splice(keep.length, 1)[0]));
  return true;
}

// ---------- 打造 ----------
export const CRAFT_MAX = 10;
export function craftCost(set) {
  const z = ZONES.find(x => x.id === set), tier = tierOfSet(set);
  const need = { ['bp_' + set]: 1, dust: 4 + tier * 2 }; for (const m of z?.mats || []) need[m] = 3 + tier;
  return { gold: 120 * tier, items: need };
}
export function canCraft(s, set) { const c = craftCost(set); return s.wallet.gold >= c.gold && Object.entries(c.items).every(([k, n]) => (s.bag.items[k] || 0) >= n); }
// 必出精良以上；打造等级越高，蓝紫橙越多。focus 用一张定向符锁定一条词条的种类
export function craft(s, set, focus = null) {
  if (!canCraft(s, set)) return null; if (focus && !(s.bag.items.focus > 0)) return null;
  const c = craftCost(set); s.wallet.gold -= c.gold; for (const [k, n] of Object.entries(c.items)) s.bag.items[k] -= n;
  if (focus) s.bag.items.focus--;
  tally(s, 'craft');
  const cr = s.craft; const g = makeGear(tierOfSet(set), { set, minQ: 1, bonus: 2 + cr.lv * 1.5, focus });
  bag(s).push(g);
  cr.xp++; if (cr.lv < CRAFT_MAX && cr.xp >= cr.lv * 2) { cr.xp = 0; cr.lv++; }
  return g;
}

// ---------- 道具 ----------
export function addItem(s, id, n = 1) { s.bag.items[id] = (s.bag.items[id] || 0) + n; }
export function buy(s, id) {
  const it = ITEMS[id];
  if (it.starPrice) { if ((s.bag.items.starSand || 0) < it.starPrice) return false; s.bag.items.starSand -= it.starPrice; addItem(s, id); return true; }
  if (s.wallet.gold < it.price) return false; s.wallet.gold -= it.price; addItem(s, id); return true;
}
