// 成就（冒险、伙伴、收集、家园、奇怪五类）和守护兽搬家。
// 成就条件都从存档现算，不需要额外记录；做到了就能领星砂。
import { ACHIEVEMENTS, ZONES, HOME, GEAR_SETS } from '../data/index.js';
import { loveLv, aptStars } from './pets.js';
import { setCounts, addItem } from './gear.js';
import { home } from './home.js';
import { QUESTS } from '../data/index.js';

const allGear = s => [...Object.values(s.hero.gear || {}), ...(s.bag.gear || []), ...s.pets.map(p => p.charm)].filter(Boolean);
const bossIds = () => ZONES.filter(z => z.boss).map(z => z.boss);
export function achieved(s, a) {
  const c = a.check, st = s.stats || {};
  if (c.stat) return (st[c.stat] || 0) >= c.n;
  if (c.lv) return s.hero.lv >= c.lv;
  if (c.main) return s.quests.done.filter(id => QUESTS.some(q => q.id === id)).length >= c.main;
  if (c.side) return s.quests.done.filter(id => id.startsWith('s')).length >= c.side;
  if (c.bossAll) return bossIds().every(id => s.world.bosses[id]);
  if (c.route) return !!s.hero.route;
  if (c.gold) return s.wallet.gold >= c.gold;
  if (c.broke) return s.wallet.gold === 0 && s.hero.lv >= 5;
  if (c.pets) return s.pets.length >= c.pets;
  if (c.shiny) return s.pets.filter(p => p.shiny).length >= c.shiny;
  if (c.evoMax) return s.pets.some(p => p.evo >= 2);
  if (c.love) return s.pets.some(p => loveLv(p) >= c.love);
  if (c.stars5) return s.pets.some(p => aptStars(p) >= 5);
  if (c.house) return (s.houseCap || 0) >= c.house;
  if (c.caught) return Object.values(s.world.dex).filter(v => v === 'caught').length >= c.caught;
  if (c.quality) return allGear(s).some(g => g.q >= c.quality);
  if (c.plus) return allGear(s).some(g => (g.plus || 0) >= c.plus);
  if (c.set4) return Object.entries(setCounts(s.hero.gear)).some(([k, n]) => GEAR_SETS[k] && n >= 4);
  if (c.days) return (home(s).days || 0) >= c.days;
  if (c.mood) return home(s).mood.length >= c.mood;
  if (c.plots) return home(s).plots.length >= c.plots;
  return false;
}
const got = s => (s.achv ||= {});
export const achvState = (s, a) => got(s)[a.id] ? 'claimed' : achieved(s, a) ? 'ready' : 'locked';
export const achvReady = s => ACHIEVEMENTS.filter(a => !got(s)[a.id] && achieved(s, a));
export const achvCount = s => Object.keys(got(s)).length;
export function claimAchv(s, id) {
  const a = ACHIEVEMENTS.find(x => x.id === id); if (!a || got(s)[id] || !achieved(s, a)) return null;
  got(s)[id] = 1; addItem(s, 'starSand', a.sand); return a;
}

// ---------- 守护兽 ----------
// 同一个首领打败 3 次，它就愿意搬到北坡小岛来住，每只给一点长期加成
export const bossWins = (s, id) => Math.max((s.stats || {})['boss_' + id] || 0, s.world.bossKills?.[id] || 0, s.world.bosses[id] ? 1 : 0);
export const guardianState = (s, id) => home(s).guardians?.includes(id) ? 'home' : bossWins(s, id) >= HOME.guardianWins ? 'ready' : 'away';
export function inviteGuardian(s, id) {
  const h = home(s); if (!HOME.guardians[id] || guardianState(s, id) !== 'ready') return false;
  (h.guardians ||= []).push(id); return true;
}
