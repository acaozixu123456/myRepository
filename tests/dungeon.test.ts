import { describe, expect, it } from 'vitest';
import { simulate } from '../src/engine/battle';
import { DAILY_TRIES, DUNGEONS, TIERS, dungeonLeft, dungeonReward, dungeonStage, dungeonStart, dungeonSweep, dungeonWin, tierLevel, tierUnlocked } from '../src/game/dungeon';
import { lineupSetups, waveSetups } from '../src/game/stage';
import { newPlayer } from '../src/game/state';

const t0 = new Date(2026, 9, 12, 12).getTime();
const D = 86400000;

describe('日常秘境', () => {
  it('奖励随档位单调递增；各秘境只产出自己的资源', () => {
    for (const d of DUNGEONS) {
      let last = 0;
      for (let t = 1; t <= TIERS; t++) {
        const g = dungeonReward(d.id, t); const v = d.id === 'fish' ? g.fish : d.id === 'exp' ? g.exp : g.catnip;
        expect(v).toBeGreaterThan(last); last = v;
        if (d.id !== 'fish') expect(g.fish).toBe(0); if (d.id !== 'exp') expect(g.exp).toBe(0); if (d.id !== 'catnip') expect(g.catnip).toBe(0);
      }
    }
    for (let t = 2; t <= TIERS; t++) expect(tierLevel(t)).toBeGreaterThan(tierLevel(t - 1));
  });
  it('档位按主线进度解锁，次数每天 3 次、次日重置', () => {
    const s = newPlayer(0);
    expect(tierUnlocked(s, 1)).toBe(true); expect(tierUnlocked(s, 2)).toBe(false);
    expect(dungeonStart(s, 'fish', 2, t0).ok).toBe(false);
    for (let i = 0; i < DAILY_TRIES; i++) expect(dungeonStart(s, 'fish', 1, t0).ok).toBe(true);
    expect(dungeonStart(s, 'fish', 1, t0).ok).toBe(false);
    expect(dungeonLeft(s, 'exp', t0)).toBe(DAILY_TRIES);
    expect(dungeonLeft(s, 'fish', t0 + D)).toBe(DAILY_TRIES);
    s.best = { chapter: 6, index: 24 }; expect(tierUnlocked(s, TIERS)).toBe(true);
  });
  it('通关结算入账；扫荡只能用于通关过的档位并消耗次数', () => {
    const s = newPlayer(0); const fish = s.res.fish;
    expect(dungeonSweep(s, 'fish', 1, t0).ok).toBe(false);
    dungeonWin(s, 'fish', 1);
    expect(s.res.fish).toBe(fish + dungeonReward('fish', 1).fish);
    const r = dungeonSweep(s, 'fish', 1, t0);
    expect(r.ok).toBe(true); expect(dungeonLeft(s, 'fish', t0)).toBe(DAILY_TRIES - 1);
    const c0 = s.res.catnip; dungeonWin(s, 'catnip', 1); expect(s.res.catnip).toBe(c0 + dungeonReward('catnip', 1).catnip);
  });
  it('关卡可由引擎直接模拟，强度随档位上升', () => {
    const s = newPlayer(0); s.best = { chapter: 6, index: 24 };
    for (const d of DUNGEONS) for (let t = 1; t <= TIERS; t++) {
      const st = dungeonStage(d.id, t);
      expect(st.waves[0].enemies).toHaveLength(5);
      const r = simulate({ seed: 1, A: lineupSetups(s), B: waveSetups(st, 0) });
      expect(['A', 'B']).toContain(r.winner);
    }
  });
});
