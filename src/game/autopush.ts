// 自动闯关：挂机刷当前最前线的关卡时，战力够了就自动去挑战下一关；失败后要等战力涨一点再试，避免原地反复送。
import { nextStage, recommendedPowerOf } from './stage';
import { teamPower } from './state';
import type { PlayerState } from './state';

export const AUTO_MIN_WINS = 1; // 在最前线至少刷赢几场再推
export const AUTO_RETRY_GAIN = 1.03; // 失败后战力要比失败时高 3% 才再试
export const autoPushOn = (s: PlayerState) => s.settings.autoPush !== false;

export function shouldAutoPush(s: PlayerState, power = teamPower(s)): boolean {
  if (!autoPushOn(s)) return false;
  const best = s.best ?? { chapter: s.stage.chapter, index: s.stage.index };
  if (s.stage.chapter !== best.chapter || s.stage.index !== best.index) return false; // 在回刷旧关就不推
  if (s.stage.wins < AUTO_MIN_WINS) return false;
  const next = nextStage(best.chapter, best.index);
  if (!next) return false;
  if (power < recommendedPowerOf(next.chapter, next.index)) return false;
  const fail = s.settings.autoFail;
  if (fail && power < fail * AUTO_RETRY_GAIN) return false;
  return true;
}
export function recordAutoResult(s: PlayerState, win: boolean, power = teamPower(s)): void {
  if (win) delete s.settings.autoFail; else s.settings.autoFail = power;
}
