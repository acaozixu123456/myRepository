import { afterEach, describe, expect, it, vi } from 'vitest';
import { QUESTS } from '../src/content/economy';
import { newPlayer } from '../src/game/state';
import { rollover, track } from '../src/game/quests';
import { BattleLoop } from '../src/app/battleLoop';

vi.mock('../src/fx/player', () => ({
  Player: class {
    scene = { baseCam: {}, resetCam: () => {} };
    sleep = async () => {};
  },
}));

afterEach(() => vi.useRealTimers());

describe('automatic battle quest periods', () => {
  it('keeps the first victory after Monday 5 AM even when the UI timer has not reset yet', async () => {
    const before = new Date(2026, 9, 12, 4, 59, 59).getTime();
    const after = new Date(2026, 9, 12, 5, 0, 0).getTime();
    const s = newPlayer(before);
    track(s, 'clear_stage', 5);
    const lifetime = QUESTS.find((q) => q.kind === 'achievement' && q.goal.type === 'clear_stage')!;
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(after);
    const loop = new BattleLoop({} as HTMLCanvasElement, {
      state: () => s,
      onReward: () => {},
      onResult: () => {},
      onChange: () => { internal.token++; },
    });
    // Only replace the fight/player; execute the real victory settlement once.
    const internal = loop as unknown as {
      token: number;
      fight: (...args: unknown[]) => Promise<boolean>;
      cycle: (token: number) => Promise<void>;
    };
    vi.spyOn(internal, 'fight').mockResolvedValue(true);
    await internal.cycle(internal.token);
    expect(s.quests.progress.daily_campaign).toBe(1);
    expect(s.quests.progress.weekly_campaign).toBe(1);
    expect(s.quests.progress[lifetime.id]).toBe(6);
    expect(rollover(s, after)).toBe(false);
    expect(s.quests.progress.daily_campaign).toBe(1);
    expect(s.quests.progress.weekly_campaign).toBe(1);
  });
});
