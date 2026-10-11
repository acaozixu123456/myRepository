import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../src/data/factions';
import { HEROES } from '../src/data/heroes';
import { SKILLS } from '../src/data/skills';

describe('hero data integrity', () => {
  it('every hero has a valid faction and 4 skills', () => {
    for (const h of HEROES) {
      expect(FACTIONS[h.faction], h.id).toBeTruthy();
      expect(SKILLS[h.id]?.length, h.id).toBe(4);
    }
  });
  it('hero ids are unique', () => {
    expect(new Set(HEROES.map((h) => h.id)).size).toBe(HEROES.length);
  });
});
