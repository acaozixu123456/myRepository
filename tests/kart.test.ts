import { describe, expect, it } from 'vitest';
import { LAPS, TIER_BY_PLACE, RUNS_PER_DAY, kartGain, makeTrack, newRace, placeNow, recordRace, runsLeft, step, tierOf, useRun } from '../src/game/kart';
import type { Item, Race } from '../src/game/kart';
import { mulberry } from '../src/fx/util';
import { newPlayer } from '../src/game/state';
import { winReward } from '../src/game/stage';
import { farmStage } from '../src/game/explore';

const LANES = [-0.62, 0, 0.62];
/** 机器人车手：往前看 0.09 圈，躲开流沙 / 油渍，优先吃加速带和氮气瓶；氮气攒着最后一圈再喷 */
function drive(seed: number, skill: 'idle' | 'good'): Race {
  const rnd = mulberry(seed), r = newRace(rnd);
  let guard = 0;
  while (!r.over && guard++ < 60 * 200) {
    let steer = 0, nitro = false;
    if (skill === 'good') {
      const s = r.me.s % 1;
      const ahead = r.items.filter((it: Item) => { const d = (it.s - s + 1) % 1; return d > 0.005 && d < 0.09; });
      const score = (lane: number) => ahead.reduce((a, it) => a + (Math.abs(it.lane - lane) < 0.45 ? (it.kind === 'boost' || it.kind === 'fuel' ? 2 : -3) : 0), 0) - Math.abs(lane - r.me.lane) * 0.4;
      const best = LANES.reduce((b, l) => (score(l) > score(b) ? l : b), LANES[1]);
      steer = Math.max(-1, Math.min(1, (best - r.me.lane) * 4));
      nitro = r.me.s > LAPS - 0.55 && r.me.nitro <= 0 && r.charges > 0;
    }
    step(r, steer, nitro, 1 / 60, rnd);
  }
  return r;
}

describe('沙漠卡丁车', () => {
  it('赛道道具：每圈 10 个，位置在 (0.08,1) 内、车道合法、种子固定', () => {
    const a = makeTrack(mulberry(5)), b = makeTrack(mulberry(5));
    expect(a).toEqual(b); expect(a).toHaveLength(10);
    for (const it of a) { expect(it.s).toBeGreaterThan(0.08); expect(it.s).toBeLessThan(1); expect(LANES).toContain(it.lane); }
  });
  it('每局都能在 2 分钟内跑完，名次 1~4', () => {
    for (let i = 0; i < 20; i++) for (const sk of ['idle', 'good'] as const) { const r = drive(100 + i, sk); expect(r.over).toBe(true); expect(r.place).toBeGreaterThanOrEqual(1); expect(r.place).toBeLessThanOrEqual(4); expect(r.t).toBeLessThan(120); expect(r.t).toBeGreaterThan(25); }
  });
  it('平衡：会躲会冲的玩家大多拿第一；一直直行不管的玩家基本拿不到第一', () => {
    let goodWins = 0, goodTop2 = 0, idleWins = 0, n = 200;
    for (let i = 0; i < n; i++) { const g = drive(1000 + i, 'good'); if (g.place === 1) goodWins++; if (g.place <= 2) goodTop2++; if (drive(5000 + i, 'idle').place === 1) idleWins++; }
    expect(goodWins / n).toBeGreaterThan(0.55);
    expect(goodTop2 / n).toBeGreaterThan(0.9);
    expect(idleWins / n).toBeLessThan(0.25);
  });
  it('名次 → 档位 → 奖励单调递增；第 4 名没奖励', () => {
    expect(TIER_BY_PLACE.map((_, i) => tierOf(i))).toEqual(TIER_BY_PLACE);
    expect([1, 2, 3, 4].map(tierOf)).toEqual([3, 2, 1, 0]);
    const s = newPlayer(Date.now()), g = [0, 1, 2, 3].map((t) => kartGain(s, t));
    expect(g[0].fish).toBe(0);
    for (let i = 1; i < 4; i++) expect(g[i].fish).toBeGreaterThan(g[i - 1].fish);
    expect(g[3].fish).toBe(Math.round(winReward(farmStage(s).stage).fish * 7));
  });
  it('每天最多 5 场，足迹计数；跑到中途的名次按路程算', () => {
    const s = newPlayer(Date.now());
    for (let i = 0; i < RUNS_PER_DAY; i++) expect(useRun(s)).toBe(true);
    expect(useRun(s)).toBe(false); expect(runsLeft(s)).toBe(0);
    recordRace(s); recordRace(s); expect(s.exploreTotals?.kart).toBe(2);
    const r = newRace(mulberry(1)); expect(placeNow(r)).toBe(1); r.ai[0].s = 0.3; expect(placeNow(r)).toBe(2);
  });
});
