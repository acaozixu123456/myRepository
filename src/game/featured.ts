// 每日推荐小游戏：每天从已解锁场景里的「按星级结算」的小游戏中挑一个（按日期固定，不随刷新变），
// 当天第一次在它身上拿到星，这一局的奖励翻倍。界面打开小游戏前 setPlaying(game)，结算时 boostGain 套在奖励外面。
import { ensureExplore, sceneGames, unlockedScenes } from './explore';
import type { Gain } from './stage';
import type { PlayerState } from './state';

/** 按 1~3 星结算、能参加推荐的小游戏（钓鱼 / 拉面 / 纸箱寻猫是按次结算的，不算） */
export const FEATURE_POOL = ['mushroom', 'windchime', 'lanterns', 'kart', 'claw', 'whack', 'ring', 'arrows', 'firefly', 'kite', 'kitchen', 'sled', 'snowcat', 'surf', 'clams', 'skip', 'sushi'];
export const FEATURE_MUL = 2;

const dayOf = (s: PlayerState, now: number) => ensureExplore(s, now).day;
/** 已解锁场景里能玩的推荐候选（去重，顺序固定） */
export function featurePool(s: PlayerState): string[] {
  const out: string[] = [];
  for (const c of unlockedScenes(s)) for (const g of sceneGames(c)) if (FEATURE_POOL.includes(g) && !out.includes(g)) out.push(g);
  return out;
}
/** 今天的推荐小游戏：按日期哈希挑，同一天固定 */
export function featuredGame(s: PlayerState, now = Date.now()): string | null {
  const pool = featurePool(s);
  if (!pool.length) return null;
  const d = dayOf(s, now);
  const h = Math.abs(Math.imul(d ^ 0x5bd1e995, 2654435761) ^ (d >>> 3)) >>> 0;
  return pool[h % pool.length];
}
/** 今天的推荐奖励是否已经拿过 */
export const featureUsed = (s: PlayerState, now = Date.now()) => !!ensureExplore(s, now).featureUsed;

let playing: string | null = null;
/** 界面层：打开 / 关掉小游戏时告诉这里当前在玩哪个 */
export function setPlaying(game: string | null) { playing = game; }
export const nowPlaying = () => playing;

/** 结算奖励：正在玩的是今天的推荐、这局拿到了奖励、今天还没翻倍过 → 原地翻倍（界面上显示的奖励跟着变）并记下。onBoost 用来提示玩家 */
export function boostGain(s: PlayerState, g: Gain, onBoost?: () => void, now = Date.now()): Gain {
  if (!playing || playing !== featuredGame(s, now) || featureUsed(s, now)) return g;
  if (!(g.fish > 0 || g.catnip > 0 || g.bells > 0)) return g;
  ensureExplore(s, now).featureUsed = true;
  g.fish *= FEATURE_MUL; g.exp *= FEATURE_MUL; g.catnip *= FEATURE_MUL; g.bells *= FEATURE_MUL;
  onBoost?.();
  return g;
}
