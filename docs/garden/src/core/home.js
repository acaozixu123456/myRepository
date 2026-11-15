// 家园与日常：田地、伙伴打工、厨房和料理加成、每日灯火值、悬赏、签到、摸伙伴、心情种子、"你不在的时候"。
// 所有和时间有关的函数都收 now（毫秒），测试里可以随便拨时间。
import { HOME, CROPS, DISHES, JOBS, ZONES, MONSTERS, ITEMS, PETS, ELEMENTS } from '../data/index.js';
import { rnd, ri, pick } from './rng.js';
import { addItem, addGem } from './gear.js';
import { today } from './world.js';
import { addLove, loveLv, petName } from './pets.js';
import { tally } from './tally.js';

const H = 3600000;
export const newHome = () => ({ plots: Array(HOME.plotsStart).fill(null), jobs: {}, mood: [], days: 0, day: null, buff: null, log: [] });
export const home = s => (s.home ||= newHome());

// ---------- 每天的记录 ----------
function day(s, now = Date.now()) {
  const h = home(s), t = today(now);
  if (h.day?.date !== t) h.day = { date: t, greet: false, harvest: false, pat: [], bounties: rollBounties(s), reroll: 0, chest: false, mood: false };
  return h.day;
}
export const todayOf = (s, now) => day(s, now);
export function lampPoints(s, now) {
  const d = day(s, now), D = HOME.daily;
  return Math.min(D.full, (d.greet ? D.greet : 0) + (d.harvest ? D.harvest : 0) + d.bounties.filter(b => b.done).length * D.bounty + (d.pat.length >= D.patNeed ? D.pat : 0));
}
// 签到按累计天数，不按连续：每天 50×天数（最多 500）金币，每 7 天多给星砂
export function greet(s, now) {
  const d = day(s, now), h = home(s); if (d.greet) return null;
  d.greet = true; h.days++;
  const gold = 50 * Math.min(10, h.days), got = [`${gold} 金币`]; s.wallet.gold += gold;
  if (h.days % 7 === 0) { addItem(s, 'starSand', 3); got.push('星砂 ×3'); }
  return { days: h.days, got };
}
export function lampChest(s, now) {
  const d = day(s, now); if (d.chest || lampPoints(s, now) < HOME.daily.full) return null;
  d.chest = true; tally(s, 'lampChest'); const top = topZone(s), out = [];
  const gold = 100 + top.lv[1] * 10; s.wallet.gold += gold; out.push(`${gold} 金币`);
  const sand = ri(2, 3); addItem(s, 'starSand', sand); out.push(`星砂 ×${sand}`);
  for (const m of top.mats) { const n = ri(1, 2); addItem(s, m, n); out.push(`${ITEMS[m].name} ×${n}`); }
  addItem(s, 'treat', 2); out.push('灵果 ×2');
  if (rnd() < 0.1) { addItem(s, 'seed', 3); out.push('灵种 ×3'); }
  return out;
}
// 摸摸伙伴：每只每天一次，亲密度 +5
export function pat(s, uid, now) {
  const d = day(s, now), p = s.pets.find(x => x.uid === uid); if (!p || d.pat.includes(uid)) return null;
  d.pat.push(uid); tally(s, 'pat'); const up = addLove(p, 5); return { up, lv: loveLv(p) };
}
export const patted = (s, uid, now) => day(s, now).pat.includes(uid);

// ---------- 田地 ----------
export const plotState = (p, now = Date.now()) => !p ? 'empty' : now >= p.ready ? 'ripe' : 'growing';
export function plant(s, i, cropId, now = Date.now()) {
  const h = home(s), c = CROPS[cropId]; if (!c || h.plots[i] !== null || s.wallet.gold < c.seed) return false;
  s.wallet.gold -= c.seed; h.plots[i] = { crop: cropId, at: now, ready: now + c.hours * H, water: false }; return true;
}
// 浇水：剩下的时间少四分之一，一次种植浇一次
export function water(s, i, now = Date.now()) {
  const p = home(s).plots[i]; if (!p || p.water || now >= p.ready) return false;
  p.water = true; p.ready = now + (p.ready - now) * (1 - HOME.waterCut); return true;
}
export function harvest(s, i, now = Date.now()) {
  const h = home(s), p = h.plots[i]; if (plotState(p, now) !== 'ripe') return null;
  const n = ri(2, 3) + (p.water ? 1 : 0); addItem(s, p.crop, n); h.plots[i] = null; tally(s, 'harvest'); day(s, now).harvest = true;
  return [p.crop, n];
}
export function harvestAll(s, now = Date.now()) { const got = {}; home(s).plots.forEach((p, i) => { const r = harvest(s, i, now); if (r) got[r[0]] = (got[r[0]] || 0) + r[1]; }); return got; }
export function buyPlot(s) {
  const h = home(s), cost = plotCost(s); if (h.plots.length >= HOME.plotsMax || s.wallet.gold < cost) return false;
  s.wallet.gold -= cost; h.plots.push(null); return true;
}
export const plotCost = s => HOME.plotCost * (home(s).plots.length - HOME.plotsStart + 1);

// ---------- 伙伴打工 ----------
// 不在出战位的伙伴可以派去打工，离线也算，最多攒 12 小时；性格喜欢的工作产出多一半
export const workers = s => Object.entries(home(s).jobs).map(([uid, w]) => ({ p: s.pets.find(x => x.uid === uid), ...w })).filter(w => w.p);
export const likesJob = (p, job) => PETS.natures[p.nature]?.job === job;
export function assign(s, uid, job, now = Date.now()) {
  const h = home(s), p = s.pets.find(x => x.uid === uid); if (!p || !JOBS[job] || s.party.includes(uid)) return false;
  if (!h.jobs[uid] && workers(s).length >= HOME.workers) return false;
  if (h.jobs[uid]) collectWork(s, now);
  h.jobs[uid] = { job, since: now }; return true;
}
export function unassign(s, uid, now = Date.now()) { const h = home(s); if (!h.jobs[uid]) return false; collectWork(s, now); delete h.jobs[uid]; return true; }
export const workHours = (w, now = Date.now()) => Math.min(HOME.workCapH, Math.floor((now - w.since) / H));
function workOnce(s, p, job, out) {
  const put = (id, n = 1) => { addItem(s, id, n); out[id] = (out[id] || 0) + n; };
  if (job === 'farm') put(pick(Object.values(CROPS).filter(c => c.hours <= 3)).id);
  else if (job === 'fish') { put(rnd() < 0.5 ? 'scale' : 'pebble'); if (rnd() < 0.2) { s.wallet.gold += 10; out.gold = (out.gold || 0) + 10; } }
  else if (job === 'mine') { put('dust'); if (rnd() < 0.15) put('stone'); if (rnd() < 0.03) { addGem(s, pick(Object.keys(ELEMENTS).filter(e => e !== 'none')), 1); out.gem = (out.gem || 0) + 1; } }
  else { const g = Math.round(8 + p.lv * 0.6); s.wallet.gold += g; out.gold = (out.gold || 0) + g; }
}
export function collectWork(s, now = Date.now()) {
  const h = home(s), out = {};
  for (const uid of Object.keys(h.jobs)) {
    const w = h.jobs[uid], p = s.pets.find(x => x.uid === uid); if (!p || s.party.includes(uid)) { delete h.jobs[uid]; continue; }
    const n = workHours(w, now); if (!n) continue;
    tally(s, 'workHours', n); const times = likesJob(p, w.job) ? Math.round(n * 1.5) : n; for (let i = 0; i < times; i++) workOnce(s, p, w.job, out);
    w.since = n >= HOME.workCapH ? now : w.since + n * H;
  }
  if (Object.keys(out).length) day(s, now).harvest = true;
  return out;
}

// ---------- 厨房 ----------
export const canCook = (s, id, n = 1) => Object.entries(DISHES[id].need).every(([k, v]) => (s.bag.items[k] || 0) >= v * n);
export function cook(s, id) { const d = DISHES[id]; if (!d || !canCook(s, id)) return false; for (const [k, v] of Object.entries(d.need)) s.bag.items[k] -= v; addItem(s, id, 1); tally(s, 'cook'); return true; }
// 吃一份：30 分钟加成，新的顶掉旧的
export function eat(s, id, now = Date.now()) {
  if (!DISHES[id] || !(s.bag.items[id] > 0)) return false;
  s.bag.items[id]--; home(s).buff = { id, until: now + HOME.buffMin * 60000 }; return true;
}
export const activeBuff = (s, now = Date.now()) => { const b = s.home?.buff; return b && b.until > now ? b : null; };
export const buffStat = (s, now) => { const b = activeBuff(s, now); return b ? DISHES[b.id].buff : null; };
// 送给伙伴：最爱吃的翻倍
export function gift(s, uid, id) {
  const p = s.pets.find(x => x.uid === uid), d = DISHES[id]; if (!p || !d || !(s.bag.items[id] > 0) || loveLv(p) >= PETS.loveMax) return null;
  s.bag.items[id]--; tally(s, 'gift'); const fav = PETS.natures[p.nature]?.food === id, up = addLove(p, d.love * (fav ? 2 : 1));
  return { up, fav, lv: loveLv(p) };
}

// ---------- 悬赏 ----------
const openZones = s => ZONES.filter((z, i) => z.lv && i <= s.world.unlocked);
const topZone = s => openZones(s).at(-1) || ZONES.find(z => z.lv);
function rollBounty(s) {
  const zs = openZones(s), z = pick(zs), t = pick(HOME.bounties), n = ri(t.n[0], t.n[1]), b = { type: t.type, n, got: 0, done: false };
  if (t.type === 'kill' || t.type === 'capture') b.zone = z.id;
  if (t.type === 'killEl') b.el = pick([...new Set(zs.flatMap(x => x.wild.map(id => MONSTERS[id].el)).filter(e => e !== 'none'))]) || 'grass';
  if (t.type === 'collect') b.item = pick(z.mats);
  if (t.type === 'crop') b.item = pick(Object.values(CROPS).filter(c => c.hours <= 4)).id;
  if (t.type === 'dish') b.item = pick(Object.values(DISHES).filter(d => Object.keys(d.need).every(k => CROPS[k]) && Object.keys(d.need).length <= 2)).id;
  b.gold = Math.round((40 + z.lv[1] * 8) * (t.type === 'dish' ? 1.5 : 1)); b.sand = rnd() < 0.3 ? 1 : 0;
  return b;
}
function rollBounties(s) { return [0, 1, 2].map(() => rollBounty(s)); }
export const bountyText = b => HOME.bounties.find(t => t.type === b.type).text.replace('{n}', b.n).replace('{zone}', ZONES.find(z => z.id === b.zone)?.name || '').replace('{el}', ELEMENTS[b.el] || '').replace('{item}', ITEMS[b.item]?.name || '');
export const bountyDeliver = b => ['collect', 'crop', 'dish'].includes(b.type);
export const bountyReady = (s, b) => !b.done && (bountyDeliver(b) ? (s.bag.items[b.item] || 0) >= b.n : b.got >= b.n);
export const bountyProgress = (s, b) => bountyDeliver(b) ? `${Math.min(s.bag.items[b.item] || 0, b.n)}/${b.n}` : `${Math.min(b.got, b.n)}/${b.n}`;
export function bountyEvent(s, type, ev = {}, now) {
  if (!s.home?.day) return; const d = day(s, now);
  for (const b of d.bounties) {
    if (b.done) continue;
    const zoneOk = id => !b.zone || ZONES.find(z => z.id === b.zone)?.wild?.includes(id);
    if (type === 'kill' && b.type === 'kill' && zoneOk(ev.mid)) b.got++;
    if (type === 'kill' && b.type === 'killEl' && MONSTERS[ev.mid]?.el === b.el) b.got++;
    if (type === 'capture' && b.type === 'capture' && zoneOk(ev.id)) b.got++;
  }
}
export function claimBounty(s, i, now) {
  const d = day(s, now), b = d.bounties[i]; if (!b || !bountyReady(s, b)) return null;
  if (bountyDeliver(b)) s.bag.items[b.item] -= b.n;
  b.done = true; tally(s, 'bounty'); s.wallet.gold += b.gold; const got = [`${b.gold} 金币`]; if (b.sand) { addItem(s, 'starSand', 1); got.push('星砂 ×1'); }
  return got;
}
// 不喜欢可以免费换一次
export function rerollBounty(s, i, now) { const d = day(s, now), b = d.bounties[i]; if (!b || b.done || d.reroll >= 1) return false; d.bounties[i] = rollBounty(s); d.reroll++; return true; }

// ---------- 心情种子 ----------
// 写一句今天的话，长成一朵心情花：颜色由文字决定，当天打怪经验 +5%
export function hueOf(text) { let h = 0; for (const ch of text) h = (h * 31 + ch.codePointAt(0)) % 360; return h; }
export function plantMood(s, text, now = Date.now()) {
  const d = day(s, now), t = String(text || '').trim().slice(0, 60); if (!t || d.mood) return null;
  d.mood = true; const m = { date: today(now), text: t, hue: hueOf(t) }; home(s).mood.unshift(m); return m;
}
export const moodToday = (s, now) => day(s, now).mood;

// 料理和心情花给角色的加成，交给 heroStats
export function homeBonus(s, now = Date.now()) {
  const out = {}; const b = buffStat(s, now); if (b) for (const [k, v] of Object.entries(b)) out[k] = (out[k] || 0) + v;
  if (s.home?.day?.date === today(now) && s.home.day.mood) out.xp = (out.xp || 0) + 5;
  for (const id of s.home?.guardians || []) for (const [k, v] of Object.entries(HOME.guardians[id]?.bonus || {})) out[k] = (out[k] || 0) + v;
  return out;
}

// ---------- 你不在的时候 ----------
// 离开一小时以上再回来，用存档里的事拼几句话：田里熟了什么、打工攒了多少、伙伴在干嘛
const NAP = ['在田边睡着了', '追着蝴蝶跑了好几圈', '趴在石灯旁边晒太阳', '偷偷尝了一口作物', '在小池塘边看自己的倒影', '把自己埋进了草堆里'];
export function awayNotes(s, since, now = Date.now()) {
  if (!since || now - since < H) return null;
  const h = home(s), notes = [], hrs = Math.floor((now - since) / H);
  notes.push(`你离开了 ${hrs >= 24 ? Math.floor(hrs / 24) + ' 天' : hrs + ' 小时'}。`);
  const ripe = h.plots.filter(p => plotState(p, now) === 'ripe').length; if (ripe) notes.push(`田里有 ${ripe} 块地熟了。`);
  const ws = workers(s).filter(w => workHours(w, now) > 0); for (const w of ws.slice(0, 3)) notes.push(`${petName(w.p)}${JOBS[w.job].name}了 ${workHours(w, now)} 小时。`);
  const idle = s.pets.filter(p => !s.party.includes(p.uid) && !h.jobs[p.uid]);
  if (idle.length) notes.push(`${petName(pick(idle))}${pick(NAP)}。`);
  if (idle.length >= 2) { const [a, b] = [pick(idle), pick(idle)]; if (a !== b) notes.push(`${petName(a)}和${petName(b)}好像成了好朋友。`); }
  return notes;
}
