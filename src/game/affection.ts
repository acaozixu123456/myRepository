// 好感度：给猫猫撸毛、喂点心，好感越高，属性加成越多（每级 +1%，最高 +5%）。
// 免费路线：每只猫每天撸 3 次、喂 3 次小鱼干点心；付费路线：用月光珠买猫条，好感涨得更快。纯逻辑，时间可注入。
import type { HeroState, PlayerState } from './state';

export const AFF_NAMES = ['初识', '亲近', '信赖', '依偎', '形影不离', '一辈子的猫'];
/** 到达第 i 级所需的累计好感 */
export const AFF_THRESHOLDS = [0, 30, 100, 220, 400, 650];
export const AFF_MAX_LEVEL = AFF_THRESHOLDS.length - 1;
export const PET_PER_DAY = 3, PET_GAIN = 6;
export const FISH_SNACK = { cost: 2000, gain: 20, perDay: 3 };
export const MOON_SNACK = { cost: 40, gain: 60, perDay: 3 };

export interface AffState { xp: number; day: number; pets: number; fish: number; moon: number }
const dayOf = (now: number) => Math.floor((now - new Date(now).getTimezoneOffset() * 60000) / 86400000);

export function ensureAff(h: HeroState, now = Date.now()): AffState {
  h.aff ??= { xp: 0, day: -1, pets: 0, fish: 0, moon: 0 };
  const a = h.aff, d = dayOf(now);
  if (a.day !== d) { a.day = d; a.pets = 0; a.fish = 0; a.moon = 0; }
  return a;
}
export const affLevelOf = (xp: number) => { let l = 0; for (let i = 1; i < AFF_THRESHOLDS.length; i++) if (xp >= AFF_THRESHOLDS[i]) l = i; return l; };
export const affLevel = (h: HeroState) => affLevelOf(h.aff?.xp ?? 0);
export const affMul = (h: HeroState) => 1 + 0.01 * affLevel(h);
export const affProgress = (h: HeroState) => {
  const xp = h.aff?.xp ?? 0, l = affLevelOf(xp);
  return l >= AFF_MAX_LEVEL ? { xp, level: l, from: AFF_THRESHOLDS[l], to: null as number | null } : { xp, level: l, from: AFF_THRESHOLDS[l], to: AFF_THRESHOLDS[l + 1] as number | null };
};
export const petsLeft = (h: HeroState, now = Date.now()) => PET_PER_DAY - ensureAff(h, now).pets;

type R = { ok: true; gain: number; level: number; leveled: boolean } | { ok: false; reason: string };
function add(h: HeroState, gain: number): R {
  const a = h.aff!, before = affLevelOf(a.xp);
  a.xp += gain;
  const level = affLevelOf(a.xp);
  return { ok: true, gain, level, leveled: level > before };
}
export function petHero(s: PlayerState, id: string, now = Date.now()): R {
  const h = s.heroes[id];
  if (!h) return { ok: false, reason: '先拥有这只猫猫' };
  const a = ensureAff(h, now);
  if (a.pets >= PET_PER_DAY) return { ok: false, reason: '今天撸够啦，明天再来' };
  a.pets++;
  return add(h, PET_GAIN);
}
export function feedSnack(s: PlayerState, id: string, kind: 'fish' | 'moon', now = Date.now()): R {
  const h = s.heroes[id];
  if (!h) return { ok: false, reason: '先拥有这只猫猫' };
  const a = ensureAff(h, now), sn = kind === 'fish' ? FISH_SNACK : MOON_SNACK;
  if (a[kind] >= sn.perDay) return { ok: false, reason: '今天吃太多啦，明天再喂' };
  if (kind === 'fish' ? s.res.fish < sn.cost : (s.res.moon ?? 0) < sn.cost) return { ok: false, reason: kind === 'fish' ? '小鱼干不够' : '月光珠不够' };
  if (kind === 'fish') s.res.fish -= sn.cost; else s.res.moon -= sn.cost;
  a[kind]++;
  return add(h, sn.gain);
}
/** 好感语录：随等级解锁 */
export function affLines(name: string, quote: string, lore: string, level: number): { lv: number; text: string }[] {
  const all = [
    { lv: 1, text: `“${quote}”` },
    { lv: 2, text: `${name}悄悄把尾巴搭在了你的手边。` },
    { lv: 3, text: lore.split(/[。！]/)[0] + '。' },
    { lv: 4, text: `${name}今天主动蹭了蹭你，还发出了一声很轻的呼噜。` },
    { lv: 5, text: `${name}说：“不管去哪，都想和你一起回家。”` },
  ];
  return all.filter((x) => x.lv <= level);
}
