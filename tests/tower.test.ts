import { describe, expect, it } from 'vitest';
import { HERO_BY_ID } from '../src/data/heroes';
import { MOB_BY_ID } from '../src/data/units';
import { newPlayer } from '../src/game/state';
import { TOWER_FLOORS, towerClear, towerFloor, towerKind, towerReward } from '../src/game/tower';

describe('tower', () => {
  it('every floor is a valid 5-unit stage with known units and unique positions', () => {
    for (let n = 1; n <= TOWER_FLOORS; n++) {
      const st = towerFloor(n);
      expect(st.id).toBe(`T-${n}`);
      const es = st.waves[0].enemies;
      expect(es).toHaveLength(5);
      expect(new Set(es.map((e) => e.pos)).size).toBe(5);
      for (const e of es) expect(HERO_BY_ID[e.unit] ?? MOB_BY_ID[e.unit], `${n}:${e.unit}`).toBeTruthy();
    }
  });
  it('levels never decrease and rewards grow', () => {
    let lv = 0, fish = 0;
    for (let n = 1; n <= TOWER_FLOORS; n++) {
      const l = towerFloor(n).waves[0].enemies[0].level;
      expect(l).toBeGreaterThanOrEqual(lv);
      lv = l;
      expect(towerReward(n).fish!).toBeGreaterThan(fish);
      fish = towerReward(n).fish!;
    }
  });
  it('boss floors every 10 contain a hero; only the next floor pays out once', () => {
    expect(towerKind(10)).toBe('boss');
    expect(towerFloor(10).waves[0].enemies.some((e) => HERO_BY_ID[e.unit])).toBe(true);
    const s = newPlayer();
    expect(towerClear(s, 2)).toBeNull();
    expect(towerClear(s, 1)).not.toBeNull();
    expect(towerClear(s, 1)).toBeNull();
    expect(s.tower?.floor).toBe(1);
  });
  it('rejects out of range floors', () => {
    expect(() => towerFloor(0)).toThrow();
    expect(() => towerFloor(TOWER_FLOORS + 1)).toThrow();
  });
});
