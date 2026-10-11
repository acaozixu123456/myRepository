import { describe, expect, it } from 'vitest';
import { POOLS, pull, pullOnce, urRate } from '../src/game/gacha';
import { autoLineup, equip, heroPower, levelUp, load, newPlayer, save, starUp, teamPower, unequip } from '../src/game/state';
import { claimIdle, getStage, idleRate, lineupSetups, tickIdle, waveSetups } from '../src/game/stage';
import { simulate } from '../src/engine/battle';
import { Rng } from '../src/engine/rng';

describe('gacha', () => {
  it('guarantees SSR within 10 pulls and UR within 80', () => {
    const s = newPlayer();
    s.res.tickets = 1000;
    const rng = new Rng(1);
    let sinceSsr = 0, sinceUr = 0, maxSsr = 0, maxUr = 0;
    for (let i = 0; i < 4000; i++) {
      const r = pullOnce(s, POOLS[1], () => rng.next());
      sinceSsr++; sinceUr++;
      if (r.rarity !== 'SR') { maxSsr = Math.max(maxSsr, sinceSsr); sinceSsr = 0; }
      if (r.rarity === 'UR') { maxUr = Math.max(maxUr, sinceUr); sinceUr = 0; }
    }
    expect(maxSsr).toBeLessThanOrEqual(10);
    expect(maxUr).toBeLessThanOrEqual(80);
  });
  it('overall rates are in a sane range', () => {
    const s = newPlayer();
    const rng = new Rng(7);
    const n = 20000;
    const c = { UR: 0, SSR: 0, SR: 0 };
    for (let i = 0; i < n; i++) c[pullOnce(s, POOLS[1], () => rng.next()).rarity]++;
    expect(c.UR / n).toBeGreaterThan(0.012);
    expect(c.UR / n).toBeLessThan(0.03);
    expect(c.SSR / n).toBeGreaterThan(0.1);
    expect(c.SSR / n).toBeLessThan(0.2);
  });
  it('ten pull guarantees an SSR and charges tickets first', () => {
    const s = newPlayer();
    s.res.tickets = 10;
    s.res.bells = 0;
    const r = pull(s, POOLS[1], 10, () => 0.99);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.results.some((x) => x.rarity !== 'SR')).toBe(true);
    expect(s.res.tickets).toBe(0);
  });
  it('UP guarantee after losing 50/50', () => {
    const s = newPlayer();
    s.pity.upLost = true;
    s.pity.ur = 79;
    const r = pullOnce(s, POOLS[0], () => 0.9);
    expect(r.hero.id).toBe('wu_zhoumiaoyu');
    expect(s.pity.upLost).toBe(false);
  });
  it('soft pity raises UR rate', () => {
    expect(urRate(POOLS[0], 0)).toBeCloseTo(0.015);
    expect(urRate(POOLS[0], 70)).toBeGreaterThan(0.3);
    expect(urRate(POOLS[0], 79)).toBe(1);
  });
  it('duplicates turn into shards and star up works', () => {
    const s = newPlayer();
    s.heroes['wu_zhoumiaoyu'] = { id: 'wu_zhoumiaoyu', lv: 1, star: 1, shards: 0, skillLv: 1 };
    s.heroes['wu_zhoumiaoyu'].shards = 10;
    expect(starUp(s, 'wu_zhoumiaoyu').ok).toBe(true);
    expect(s.heroes['wu_zhoumiaoyu'].star).toBe(2);
  });
});

describe('player state', () => {
  it('serializes and restores', () => {
    const s = newPlayer(1000);
    const mem = new Map<string, string>();
    const st = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    s.res.fish = 777;
    save(st, s);
    expect(load(st).res.fish).toBe(777);
    expect(load({ getItem: () => 'garbage', setItem: () => undefined }).res.fish).toBe(newPlayer().res.fish);
  });
  it('lineup operations', () => {
    const s = newPlayer();
    expect(unequip(s, 'wei_guojia').ok).toBe(true);
    expect(equip(s, 'wei_guojia').ok).toBe(true);
    expect(equip(s, 'wei_guojia').ok).toBe(false);
    autoLineup(s);
    expect(s.lineup.filter(Boolean).length).toBe(5);
    expect(teamPower(s)).toBeGreaterThan(0);
    expect(heroPower(s.heroes['wei_guojia'])).toBeGreaterThan(0);
  });
  it('level up spends resources', () => {
    const s = newPlayer();
    const lv = s.heroes['wei_guojia'].lv;
    expect(levelUp(s, 'wei_guojia').ok).toBe(true);
    expect(s.heroes['wei_guojia'].lv).toBe(lv + 1);
    s.res.fish = 0;
    expect(levelUp(s, 'wei_guojia').ok).toBe(false);
  });
});

describe('stage & idle', () => {
  it('starter team clears 1-1 and idle accrues', () => {
    const s = newPlayer(0);
    const st = getStage(1, 1)!;
    const r = simulate({ seed: 3, A: lineupSetups(s), B: waveSetups(st, 0) });
    expect(r.winner).toBe('A');
    tickIdle(s, 60 * 60 * 1000);
    expect(idleRate(s).fish).toBeGreaterThan(0);
    const got = claimIdle(s);
    expect(got.fish).toBeGreaterThan(0);
  });
});
