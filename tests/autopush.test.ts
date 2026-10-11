import { describe, expect, it } from 'vitest';
import { AUTO_MIN_WINS, AUTO_RETRY_GAIN, autoPushOn, recordAutoResult, shouldAutoPush } from '../src/game/autopush';
import { nextStage, recommendedPowerOf } from '../src/game/stage';
import { newPlayer, teamPower } from '../src/game/state';

const rec = (c: number, i: number) => { const n = nextStage(c, i)!; return recommendedPowerOf(n.chapter, n.index); };

describe('自动闯关', () => {
  it('默认开启；关掉就不推', () => {
    const s = newPlayer(0); s.stage.wins = 5;
    expect(autoPushOn(s)).toBe(true);
    expect(shouldAutoPush(s, 1e9)).toBe(true);
    s.settings.autoPush = false;
    expect(autoPushOn(s)).toBe(false); expect(shouldAutoPush(s, 1e9)).toBe(false);
  });
  it('战力不够下一关的推荐战力不推；够了才推', () => {
    const s = newPlayer(0); s.stage.wins = AUTO_MIN_WINS;
    const need = rec(1, 1);
    expect(shouldAutoPush(s, need - 1)).toBe(false);
    expect(shouldAutoPush(s, need)).toBe(true);
    expect(teamPower(s)).toBeGreaterThan(0);
  });
  it('还没在最前线刷赢够场数、或在回刷旧关时不推', () => {
    const s = newPlayer(0);
    s.stage.wins = AUTO_MIN_WINS - 1;
    expect(shouldAutoPush(s, 1e9)).toBe(false);
    s.stage.wins = 9; s.best = { chapter: 1, index: 5 }; s.stage = { chapter: 1, index: 3, wins: 9 };
    expect(shouldAutoPush(s, 1e9)).toBe(false);
  });
  it('已经是最后一关就不推', () => {
    const s = newPlayer(0); s.best = { chapter: 6, index: 24 }; s.stage = { chapter: 6, index: 24, wins: 9 };
    expect(shouldAutoPush(s, 1e9)).toBe(false);
  });
  it('失败后要等战力涨 3% 才再试，成功后清除冷却', () => {
    const s = newPlayer(0); s.stage.wins = 3;
    const p = rec(1, 1) + 100;
    recordAutoResult(s, false, p);
    expect(shouldAutoPush(s, p)).toBe(false);
    expect(shouldAutoPush(s, Math.ceil(p * AUTO_RETRY_GAIN) - 1)).toBe(false);
    expect(shouldAutoPush(s, Math.ceil(p * AUTO_RETRY_GAIN))).toBe(true);
    recordAutoResult(s, true, p);
    expect(s.settings.autoFail).toBeUndefined();
    expect(shouldAutoPush(s, p)).toBe(true);
  });
});
