// 钓鱼小游戏的规则（纯逻辑，可测试）：抛竿 → 等鱼咬钩 → 在咬钩的短窗口里提竿。
// 奖励和主线进度挂钩：以当前最高关的挂机奖励为基数，推得越远，钓到的越值钱。
import { farmStage } from './explore';
import { ensureExplore, totals } from './explore';
import { winReward } from './stage';
import type { Gain } from './stage';
import type { PlayerState } from './state';

export const FISH_DAILY_CAP = 30; // 每天最多抛竿次数
export const BITE_WINDOW = 0.9; // 咬钩后多少秒内提竿有效
export const PERFECT_MS = 350; // 这个反应时间以内算「完美」

export type Rarity = 'junk' | 'common' | 'fine' | 'rare' | 'legend';
export interface FishDef { id: string; name: string; rarity: Rarity; weight: number; fish: number; catnip: number; bells: number }
/** 倍数以「当前最高关挂机奖励的小鱼干」为基数 */
export const FISH: FishDef[] = [
  { id: 'boot', name: '旧靴子', rarity: 'junk', weight: 14, fish: 0.3, catnip: 0, bells: 0 },
  { id: 'crucian', name: '银鳞小鲫', rarity: 'common', weight: 30, fish: 1, catnip: 0, bells: 0 },
  { id: 'perch', name: '花斑鲈鱼', rarity: 'common', weight: 24, fish: 1.2, catnip: 1, bells: 0 },
  { id: 'koi', name: '招财锦鲤', rarity: 'fine', weight: 14, fish: 4.5, catnip: 0, bells: 0 },
  { id: 'puffer', name: '夜光河豚', rarity: 'rare', weight: 10, fish: 5, catnip: 4, bells: 0 },
  { id: 'clam', name: '金铃贝', rarity: 'rare', weight: 6, fish: 2, catnip: 0, bells: 15 },
  { id: 'eel', name: '九命鳗', rarity: 'legend', weight: 2, fish: 10, catnip: 10, bells: 60 },
];
export const RARITY_NAME: Record<Rarity, string> = { junk: '杂物', common: '普通', fine: '优质', rare: '稀有', legend: '传说' };

export type Grade = 'early' | 'miss' | 'good' | 'perfect';

/** 抛竿后多久咬钩（秒） */
export const biteDelay = (rnd: () => number) => 1.2 + rnd() * 2.8;

/** 判定：还没咬钩就提竿 = early；咬钩后 reactionMs 毫秒才提竿（null = 一直没提）。 */
export function judge(reactionMs: number | null, early = false): Grade {
  if (early) return 'early';
  if (reactionMs === null || reactionMs > BITE_WINDOW * 1000) return 'miss';
  return reactionMs <= PERFECT_MS ? 'perfect' : 'good';
}

/** 按权重抽鱼；完美提竿时去掉杂物，优质以上权重 ×1.8 */
export function rollFish(rnd: () => number, grade: Grade): FishDef {
  const pool = FISH.filter((f) => grade !== 'perfect' || f.rarity !== 'junk');
  const w = (f: FishDef) => f.weight * (grade === 'perfect' && f.rarity !== 'common' ? 1.8 : 1);
  const total = pool.reduce((a, f) => a + w(f), 0);
  let r = rnd() * total;
  for (const f of pool) { r -= w(f); if (r <= 0) return f; }
  return pool[pool.length - 1];
}

export function fishGain(s: PlayerState, f: FishDef): Gain {
  const base = winReward(farmStage(s).stage);
  return { fish: Math.max(1, Math.round(base.fish * f.fish)), exp: 0, catnip: f.catnip, bells: f.bells };
}

export const castsLeft = (s: PlayerState, now = Date.now()) => Math.max(0, FISH_DAILY_CAP - (ensureExplore(s, now).casts ?? 0));
export function useCast(s: PlayerState, now = Date.now()): boolean {
  const e = ensureExplore(s, now);
  if ((e.casts ?? 0) >= FISH_DAILY_CAP) return false;
  e.casts = (e.casts ?? 0) + 1;
  return true;
}
/** 钓上来之后记账：累计数 + 图鉴（杂物不进图鉴） */
export function recordCatch(s: PlayerState, f: FishDef) {
  const t = totals(s);
  t.fish = (t.fish ?? 0) + 1;
  t.dex ??= [];
  if (f.rarity !== 'junk' && !t.dex.includes(f.id)) t.dex.push(f.id);
}
export const dexCount = (s: PlayerState) => (totals(s).dex ?? []).length;
export const DEX_TOTAL = FISH.filter((f) => f.rarity !== 'junk').length;
