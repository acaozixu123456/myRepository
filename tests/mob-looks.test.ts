import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { catSvg } from '../src/art/cat';
import { MOBS } from '../src/content/mobs';
import { FACTION_ORDER } from '../src/data/factions';
import { HEROES } from '../src/data/heroes';
import { lookOf, MOB_LOOKS } from '../src/data/units';

const source = (file: string): string => readFileSync(new URL(`../src/art/${file}`, import.meta.url), 'utf8');
const artTypes = source('types.ts');
const cat = source('cat.ts');
const gear = source('gear.ts');
const garments = source('garments.ts');
const weapons = source('weapons.ts');

// 同时对照契约与真实绘制分支，避免拼对了类型名却落进空白的 default。
function declared(type: string): Set<string> {
  const body = artTypes.match(new RegExp(`export type ${type} =([\\s\\S]*?);`))?.[1];
  if (!body) throw new Error(`missing art type ${type}`);
  return new Set([...body.matchAll(/'([A-Za-z]+)'/g)].map((match) => match[1]));
}
const implemented = (text: string): Set<string> => new Set(['none', ...[...text.matchAll(/case '([A-Za-z]+)'/g)].map((match) => match[1])]);
const supportedExtras = new Set([...cat.matchAll(/includes\('([A-Za-z]+)'\)/g)].map((match) => match[1]));

describe('handwritten mob looks', () => {
  it('covers precisely the 36 registered mobs and all six faction lineups', () => {
    expect(MOBS).toHaveLength(36);
    expect(Object.keys(MOB_LOOKS).sort()).toEqual(MOBS.map((mob) => mob.id).sort());
    for (const faction of FACTION_ORDER) {
      const factionMobs = MOBS.filter((mob) => mob.faction === faction);
      expect(factionMobs, faction).toHaveLength(6);
      expect(new Set(factionMobs.map((mob) => mob.role)).size, faction).toBe(6);
      for (const mob of factionMobs) expect(lookOf(mob.id), mob.id).toBe(MOB_LOOKS[mob.id]);
    }
  });

  it('every look and coat is independent, and no complete look is duplicated', () => {
    const looks = Object.values(MOB_LOOKS);
    expect(new Set(looks).size).toBe(36);
    expect(new Set(looks.map((look) => look.coat)).size).toBe(36);
    expect(new Set(looks.map((look) => look.outfit)).size).toBe(36);
    expect(new Set(looks.map((look) => JSON.stringify(look))).size).toBe(36);
  });

  it('uses only declared styles that have an existing drawing implementation', () => {
    const fields = [
      ['head', 'HeadGear', gear], ['body', 'BodyGear', garments],
      ['back', 'BackGear', gear], ['weapon', 'WeaponKind', weapons],
    ] as const;
    for (const [id, look] of Object.entries(MOB_LOOKS)) {
      for (const [field, type, drawing] of fields) {
        const style = look.outfit[field] ?? 'none';
        expect(declared(type).has(style), `${id}.${field}: ${style}`).toBe(true);
        expect(implemented(drawing).has(style), `${id}.${field}: undrawn ${style}`).toBe(true);
      }
      for (const extra of look.outfit.extra ?? []) {
        expect(declared('Extra').has(extra), `${id}: ${extra}`).toBe(true);
        expect(supportedExtras.has(extra), `${id}: undrawn ${extra}`).toBe(true);
      }
      expect(declared('Pattern').has(look.coat.pattern), id).toBe(true);
      expect(declared('EyeStyle').has(look.eye.style), id).toBe(true);
      expect(declared('EarStyle').has(look.ear), id).toBe(true);
      expect(declared('TailStyle').has(look.tail), id).toBe(true);
    }
  });

  it('keeps uniforms and body scales plain, without capes or elite ornaments', () => {
    const allowedBacks = new Set(['none', 'gourd', 'scrollBack']);
    const heroHeads = new Set(['emperorCrown', 'pheasant', 'tigerHood', 'boneCrown']);
    const eliteExtras = new Set(['glowEyes', 'earring', 'monocle', 'beardLong', 'scar']);
    for (const [id, look] of Object.entries(MOB_LOOKS)) {
      expect(allowedBacks.has(look.outfit.back ?? 'none'), id).toBe(true);
      expect(heroHeads.has(look.outfit.head ?? 'none'), id).toBe(false);
      expect((look.outfit.extra ?? []).some((extra) => eliteExtras.has(extra)), id).toBe(false);
      expect(['#e6c25a', '#f1d98a'].includes(look.outfit.pal.trim.toLowerCase()), id).toBe(false);
      expect(['coins', 'talisman', 'knives'].includes(look.outfit.weapon ?? 'none'), id).toBe(false);
      expect(look.build, id).toBeGreaterThanOrEqual(0.88);
      expect(look.build, id).toBeLessThanOrEqual(1.12);
      expect(look.head, id).toBeGreaterThanOrEqual(0.96);
      expect(look.head, id).toBeLessThanOrEqual(1.07);
    }
  });

  it('keeps recognisable lookHint traits rather than randomising coats or species', () => {
    expect(MOB_LOOKS.mob_wei_guard.coat.base).toBe('#8295ae');
    expect(MOB_LOOKS.mob_shu_archer.coat.pattern).toBe('calico');
    expect(MOB_LOOKS.mob_wu_guard.ear).toBe('round');
    expect(MOB_LOOKS.mob_wu_strategist.coat.pattern).toBe('point');
    expect(MOB_LOOKS.mob_wu_vanguard.tail).toBe('stub');
    expect(MOB_LOOKS.mob_qun_vanguard.coat.pattern).toBe('cow');
    expect(MOB_LOOKS.mob_man_guard.outfit.body).toBe('rattan');
    expect(MOB_LOOKS.mob_man_assassin.ear).toBe('tuft');
    expect(MOB_LOOKS.mob_xian_healer.ear).toBe('fold');
    expect(MOB_LOOKS.mob_xian_assassin.fluffy).toBe(true);
  });

  it('uses the approved plain mob equipment without reintroducing magical ornaments', () => {
    for (const faction of FACTION_ORDER) {
      expect(MOB_LOOKS[`mob_${faction}_guard`].outfit.weapon, faction).toBe(faction === 'wei' ? 'boxShield' : 'shield');
      expect(MOB_LOOKS[`mob_${faction}_assassin`].outfit.weapon, faction).toBe('dagger');
    }
    expect(MOB_LOOKS.mob_wei_archer.outfit.weapon).toBe('crossbow');
    expect(MOB_LOOKS.mob_man_archer.outfit.weapon).toBe('slingshot');
    expect(MOB_LOOKS.mob_wu_guard.outfit.head).toBe('ratCap');
    for (const id of ['mob_wei_assassin', 'mob_wu_assassin', 'mob_qun_assassin']) {
      expect(MOB_LOOKS[id].outfit.head, id).toBe('hood');
    }
    for (const id of ['mob_shu_archer', 'mob_wu_healer', 'mob_man_archer', 'mob_man_healer', 'mob_man_assassin']) {
      expect(MOB_LOOKS[id].outfit.head, id).toBe('leafHat');
    }
    expect(MOB_LOOKS.mob_xian_strategist.outfit.weapon).toBe('scroll');
    expect(MOB_LOOKS.mob_xian_archer.outfit.weapon).toBe('coinsPlain');
    const coins = catSvg(MOB_LOOKS.mob_xian_archer, { uid: 'plain-coins' });
    expect(coins).toContain('<rect');
    expect(coins).not.toContain('#fff6c0'); // coins 固定闪星的填充色。
    for (const id of ['mob_wu_assassin', 'mob_xian_assassin']) expect(MOB_LOOKS[id].outfit.back, id).toBe('none');
    for (const look of Object.values(MOB_LOOKS)) expect(look.outfit.extra ?? []).not.toContain('glowEyes');
  });

  it('has valid colors and finite art dimensions, and all looks render through the original pipeline', () => {
    for (const [id, look] of Object.entries(MOB_LOOKS)) {
      const colors = [look.coat.base, look.coat.light, look.coat.accent, look.coat.stripe, look.coat.pink,
        look.eye.color, ...Object.values(look.outfit.pal)].filter((color) => color !== undefined);
      for (const color of colors) expect(color, id).toMatch(/^#[\da-f]{6}$/i);
      if (look.coat.pattern === 'tabby') expect(look.coat.stripe, id).toBeTruthy();
      if (['calico', 'cow', 'point', 'shaded', 'spots'].includes(look.coat.pattern)) expect(look.coat.accent, id).toBeTruthy();
      const svg = catSvg(look, { uid: id, width: 260 });
      expect(svg, id).toContain('<svg');
      expect(svg, id).toContain(`paper${id}`);
      expect(svg, id).not.toMatch(/NaN|Infinity|undefined/);
    }
  });

  it('preserves hero looks and rejects unregistered units', () => {
    for (const hero of HEROES) expect(lookOf(hero.id), hero.id).toBe(hero.look);
    expect(() => lookOf('mob_unknown_guard')).toThrow('unknown unit');
  });
});
