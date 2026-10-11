// 招募逻辑：概率、保底、UP 保证、重复转碎片。纯函数，随机数可注入。
import { HEROES } from '../data/heroes';
import type { HeroDef, Rarity } from '../data/heroes';
import type { PlayerState } from './state';
import { track } from './quests';

export interface PoolDef {
  id: string;
  name: string;
  desc: string;
  upHero?: string; // UP 的 UR
  rates: { ur: number; ssr: number }; // 基础概率（SR 为余）
  ssrPity: number; // 多少抽内必出 SSR 及以上
  urPity: number; // 多少抽内必出 UR
  urSoftFrom: number; // 软保底起点
}

export const POOLS: PoolDef[] = [
  { id: 'up_zhouyu', name: '赤壁限定', desc: '周喵瑜概率 UP！UR 出货时有 50% 为周喵瑜，歪一次后下次必为周喵瑜。', upHero: 'wu_zhoumiaoyu', rates: { ur: 0.015, ssr: 0.12 }, ssrPity: 10, urPity: 80, urSoftFrom: 60 },
  { id: 'normal', name: '常驻招募', desc: '全部猫猫都有机会出现。', rates: { ur: 0.015, ssr: 0.12 }, ssrPity: 10, urPity: 80, urSoftFrom: 60 },
];

export const COST = { single: { tickets: 1, bells: 160 }, ten: { tickets: 10, bells: 1500 } };
export const DUP_SHARDS: Record<Rarity, number> = { SR: 6, SSR: 12, UR: 25 };

export interface PullResult {
  hero: HeroDef;
  rarity: Rarity;
  isNew: boolean;
  shards: number; // 重复时获得的碎片
  isUp: boolean;
}

const byRarity = (r: Rarity) => HEROES.filter((h) => h.rarity === r);

/** 当前抽的 UR 概率（含软保底） */
export function urRate(p: PoolDef, urCount: number): number {
  if (urCount + 1 >= p.urPity) return 1;
  return Math.min(1, p.rates.ur + (urCount >= p.urSoftFrom ? (urCount - p.urSoftFrom + 1) * 0.04 : 0));
}

export function pullOnce(s: PlayerState, pool: PoolDef, rnd: () => number = Math.random, forceSsr = false): PullResult {
  const pr = urRate(pool, s.pity.ur);
  const r = rnd();
  let rarity: Rarity;
  if (r < pr) rarity = 'UR';
  else if (forceSsr || s.pity.ssr + 1 >= pool.ssrPity || r < pr + pool.rates.ssr) rarity = 'SSR';
  else rarity = 'SR';

  let hero: HeroDef;
  let isUp = false;
  if (rarity === 'UR') {
    const urs = byRarity('UR');
    if (pool.upHero && (s.pity.upLost || rnd() < 0.5)) {
      hero = urs.find((h) => h.id === pool.upHero)!;
      isUp = true;
      s.pity.upLost = false;
    } else {
      const others = pool.upHero ? urs.filter((h) => h.id !== pool.upHero) : urs;
      hero = others[Math.floor(rnd() * others.length)];
      if (pool.upHero) s.pity.upLost = true;
    }
    s.pity.ur = 0;
    s.pity.ssr = 0;
  } else if (rarity === 'SSR') {
    const list = byRarity('SSR');
    hero = list[Math.floor(rnd() * list.length)];
    s.pity.ssr = 0;
    s.pity.ur++;
  } else {
    const list = byRarity('SR');
    hero = list[Math.floor(rnd() * list.length)];
    s.pity.ssr++;
    s.pity.ur++;
  }

  const owned = s.heroes[hero.id];
  let shards = 0;
  if (owned) {
    shards = DUP_SHARDS[rarity];
    owned.shards += shards;
  } else {
    s.heroes[hero.id] = { id: hero.id, lv: 1, star: 1, shards: 0, skillLv: 1 };
    if (!s.seen.includes(hero.id)) s.seen.push(hero.id);
  }
  return { hero, rarity, isNew: !owned, shards, isUp };
}

export type PullPay = { ok: true; results: PullResult[] } | { ok: false; reason: string };

/** 招募 n 次（1 或 10）。优先用招福符，不够再用金铃铛。十连保底至少 1 个 SSR。 */
export function pull(s: PlayerState, pool: PoolDef, n: 1 | 10, rnd: () => number = Math.random): PullPay {
  const c = n === 1 ? COST.single : COST.ten;
  let paid: 'tickets' | 'bells';
  if (s.res.tickets >= c.tickets) paid = 'tickets';
  else if (s.res.bells >= c.bells) paid = 'bells';
  else return { ok: false, reason: '招福符与金铃铛都不够了' };
  s.res[paid] -= c[paid];
  const results: PullResult[] = [];
  for (let i = 0; i < n; i++) {
    const needSsr = n === 10 && i === 9 && !results.some((r) => r.rarity !== 'SR');
    results.push(pullOnce(s, pool, rnd, needSsr));
  }
  track(s, 'recruit', results.length);
  track(s, 'collect_hero', Object.keys(s.heroes).length);
  return { ok: true, results };
}
