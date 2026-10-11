import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { catSvg } from '../src/art/cat';
import { GACHA_POOL_READINESS } from '../src/content/economy';
import { FACTION_ORDER } from '../src/data/factions';
import { HEROES as ALL_HEROES, HERO_BY_ID, PREMIUM_HEROES, STANDARD_HEROES as HEROES } from '../src/data/heroes';
import { KITS } from '../src/data/kits';
import { KITS_B2 } from '../src/data/kits/batch2';
import { SKILLS } from '../src/data/skills';

// Issue #29 固定表及 Claude 的统一答复，独立于产品数据保留验收名单。
const ROSTER = [
  ['wei_zhangliao', '张喵辽', '张辽', 'wei', 'SSR', '先锋'],
  ['wei_xuhuang', '徐晃晃', '徐晃', 'wei', 'SR', '守护'],
  ['shu_huangzhong', '黄忠忠', '黄忠', 'shu', 'SR', '神射'],
  ['shu_machao', '马超超', '马超', 'shu', 'SR', '先锋'],
  ['shu_zhaomiaoyun', '赵喵云', '赵云', 'shu', 'SSR', '刺客'],
  ['shu_jiangwei', '姜喵维', '姜维', 'shu', 'SR', '谋士'],
  ['wu_ganning', '甘宁宁', '甘宁', 'wu', 'SR', '刺客'],
  ['wu_luxun', '陆喵逊', '陆逊', 'wu', 'SSR', '谋士'],
  ['qun_zhangjiao', '张角角', '张角', 'qun', 'SSR', '谋士'],
  ['qun_huaxiong', '华雄雄', '华雄', 'qun', 'SR', '先锋'],
  ['man_shamoke', '沙摩柯', '沙摩柯', 'man', 'SSR', '神射'],
  ['man_mengyou', '孟优优', '孟优', 'man', 'SR', '谋士'],
  ['xian_yuji', '于吉吉', '于吉', 'xian', 'SSR', '谋士'],
  ['xian_nanhua', '南华喵', '南华老仙', 'xian', 'SR', '医者'],
] as const;
const ids = ROSTER.map(([id]) => id);
const newHeroes = () => ids.map((id) => HERO_BY_ID[id]);
const artSource = (file: string): string => readFileSync(new URL(`../src/art/${file}`, import.meta.url), 'utf8');
const artTypes = artSource('types.ts');
const cat = artSource('cat.ts');
const gear = artSource('gear.ts');
const garments = artSource('garments.ts');
const weapons = artSource('weapons.ts');
const declared = (type: string): Set<string> => {
  const body = artTypes.match(new RegExp(`export type ${type} =([\\s\\S]*?);`))?.[1];
  if (!body) throw new Error(`missing art type: ${type}`);
  return new Set([...body.matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1]));
};
const implemented = (text: string): Set<string> => new Set(['none', ...[...text.matchAll(/case '([A-Za-z]+)'/g)].map((m) => m[1])]);

describe('second batch hero acceptance', () => {
  it('contains exactly 38 distinct cats and gives all six factions an SR candidate', () => {
    expect(HEROES).toHaveLength(38);
    expect(new Set(HEROES.map((h) => h.id)).size).toBe(38);
    expect(new Set(HEROES.map((h) => h.name)).size).toBe(38);
    for (const faction of FACTION_ORDER) {
      const cats = HEROES.filter((h) => h.faction === faction);
      expect(cats, faction).toHaveLength(faction === 'shu' ? 8 : 6);
      expect(cats.filter((h) => h.rarity === 'SR').length, faction).toBeGreaterThanOrEqual(1);
    }
    expect(HEROES.filter((h) => h.faction === 'shu' && h.rarity === 'SR')).toHaveLength(3);
    expect(Object.values(GACHA_POOL_READINESS).every((entry) => entry.ready)).toBe(true);
  });

  it('keeps the three mainline SP cats separate from the 38 standard cats', () => {
    expect(ALL_HEROES).toHaveLength(41);
    expect(PREMIUM_HEROES.map((h) => h.id).sort()).toEqual(['shu_pangmiaotong', 'wei_simamiyi', 'xian_changmiao']);
    expect(PREMIUM_HEROES.every((h) => h.rarity === 'SP')).toBe(true);
    expect(HEROES.every((h) => h.rarity !== 'SP')).toBe(true);
    expect(new Set(ALL_HEROES.map((h) => h.id)).size).toBe(41);
    expect(new Set([...HEROES, ...PREMIUM_HEROES].map((h) => h.id))).toEqual(new Set(ALL_HEROES.map((h) => h.id)));
  });

  it.each(ROSTER)('%s preserves the approved identity and complete Chinese profile', (id, name, origin, faction, rarity, role) => {
    const hero = HERO_BY_ID[id];
    expect(hero).toMatchObject({ id, name, origin, faction, rarity, role });
    for (const field of ['title', 'breed', 'age', 'lore', 'quote', 'likes'] as const) {
      expect(hero[field].trim(), `${id}.${field}`).not.toBe('');
      expect(hero[field], `${id}.${field}`).toMatch(/[\u4e00-\u9fff]/);
      expect(hero[field], `${id}.${field}`).not.toMatch(/[A-Za-z]/);
    }
    expect([...hero.lore].length).toBeGreaterThanOrEqual(60);
    expect([...hero.lore].length).toBeLessThanOrEqual(110);
    expect([...hero.quote].length).toBeLessThanOrEqual(50);
    expect(HEROES.filter((h) => h.lore === hero.lore)).toHaveLength(1);
    expect(HEROES.filter((h) => h.quote === hero.quote)).toHaveLength(1);
  });

  it('uses only declared art styles that have actual drawing branches', () => {
    const fields = [['head', 'HeadGear', gear], ['body', 'BodyGear', garments], ['back', 'BackGear', gear], ['weapon', 'WeaponKind', weapons]] as const;
    const extras = new Set([...cat.matchAll(/includes\('([A-Za-z]+)'\)/g)].map((m) => m[1]));
    for (const h of newHeroes()) {
      for (const [field, type, drawing] of fields) {
        const style = h.look.outfit[field] ?? 'none';
        expect(declared(type).has(style), `${h.id}.${field}: ${style}`).toBe(true);
        expect(implemented(drawing).has(style), `${h.id}.${field}: undrawn ${style}`).toBe(true);
      }
      for (const [value, type] of [[h.look.coat.pattern, 'Pattern'], [h.look.eye.style, 'EyeStyle'], [h.look.ear, 'EarStyle'], [h.look.tail, 'TailStyle']] as const) {
        expect(declared(type).has(value), `${h.id}: ${value}`).toBe(true);
      }
      // 纯色只使用基础毛色，其余花纹必须有实际绘制分支。
      if (h.look.coat.pattern !== 'solid') expect(implemented(cat).has(h.look.coat.pattern), h.id).toBe(true);
      for (const extra of h.look.outfit.extra ?? []) {
        expect(declared('Extra').has(extra), `${h.id}: ${extra}`).toBe(true);
        expect(extras.has(extra), `${h.id}: undrawn ${extra}`).toBe(true);
      }
      const colors = [h.look.coat.base, h.look.coat.light, h.look.coat.accent, h.look.coat.stripe, h.look.eye.color, ...Object.values(h.look.outfit.pal)].filter((c) => c !== undefined);
      for (const color of colors) expect(color, h.id).toMatch(/^#[\da-f]{6}$/i);
      expect(h.look.build, h.id).toBeGreaterThanOrEqual(0.85);
      expect(h.look.build, h.id).toBeLessThanOrEqual(1.35);
      expect(h.look.head, h.id).toBeGreaterThanOrEqual(0.9);
      expect(h.look.head, h.id).toBeLessThanOrEqual(1.1);
      const svg = catSvg(h.look, { uid: h.id, width: 360 });
      expect(svg).toContain('<svg');
      expect(svg).not.toMatch(/NaN|Infinity|undefined/);
    }
  });

  it('distinguishes the new cats from their existing faction companions and keeps rarity ornaments restrained', () => {
    for (const h of newHeroes()) {
      for (const other of HEROES.filter((cat) => cat.id !== h.id && cat.faction === h.faction)) {
        expect(h.look, `${h.id} vs ${other.id}`).not.toEqual(other.look);
        const identity = (look: typeof h.look) => [look.coat, look.eye, look.ear, look.tail, look.build, look.fluffy];
        expect(identity(h.look), `${h.id} coat / shape vs ${other.id}`).not.toEqual(identity(other.look));
      }
      expect(h.look.outfit.extra ?? [], h.id).not.toContain('glowEyes');
      expect(['emperorCrown', 'pheasant'].includes(h.look.outfit.head ?? 'none'), h.id).toBe(false);
      if (h.rarity === 'SR') {
        expect(h.look.outfit.back, h.id).toBe(h.id === 'shu_machao' ? 'cape' : 'none');
        expect(['#e6c25a', '#f1d98a'].includes(h.look.outfit.pal.trim), h.id).toBe(false);
      } else {
        const channels = h.look.outfit.pal.trim.slice(1).match(/../g)!.map((c) => Number.parseInt(c, 16));
        expect(Math.max(...channels) - Math.min(...channels), `${h.id}: silver trim`).toBeLessThanOrEqual(40);
      }
    }
  });

  it('uses the specifically approved new art and names props by their actual form', () => {
    for (const [id, weapon] of [
      ['wei_zhangliao', 'dualBlades'], ['wei_xuhuang', 'axe'], ['wu_ganning', 'hooks'],
      ['man_shamoke', 'mace'], ['xian_yuji', 'whisk'], ['shu_zhaomiaoyun', 'spear'],
    ] as const) expect(HERO_BY_ID[id].look.outfit.weapon, id).toBe(weapon);
    expect(HERO_BY_ID.man_mengyou.look.coat.pattern).toBe('tortie');
    expect(HERO_BY_ID.xian_nanhua.look.coat.pattern).toBe('butterfly');
    expect(HERO_BY_ID.wu_ganning.look.outfit.extra).toEqual(['bell', 'tassel']);
    expect(HERO_BY_ID.wu_ganning.lore + HERO_BY_ID.wu_ganning.likes).toContain('颈铃');
    expect(HERO_BY_ID.wu_ganning.lore + HERO_BY_ID.wu_ganning.likes).not.toContain('腰铃');
    expect(HERO_BY_ID.man_shamoke.lore + HERO_BY_ID.man_shamoke.quote).not.toContain('弹弓');
    expect(HERO_BY_ID.shu_zhaomiaoyun.lore).toContain('长枪');
    expect(HERO_BY_ID.shu_zhaomiaoyun.lore).not.toContain('龙胆枪');
  });

  it('registers all 14 handcrafted kits and displays their upgrades and both awakening routes without drift', () => {
    expect(Object.keys(KITS_B2).sort()).toEqual([...ids].sort());
    for (const id of ids) {
      const kit = KITS_B2[id];
      const display = SKILLS[id];
      expect(KITS[id], id).toBe(kit);
      expect(kit.heroId).toBe(id);
      expect(kit.ultimate.levelMods?.map((m) => m.lv), id).toEqual([3, 6, 9]);
      expect(display.map((skill) => skill.kind), id).toEqual(['basic', 'ultimate', 'passive', 'awaken']);
      for (const [index, skill] of [kit.basic, kit.ultimate, kit.passive].entries()) {
        expect(display[index].name, id).toBe(skill.name);
        expect(display[index].desc, id).toContain(skill.desc);
      }
      for (const mod of kit.ultimate.levelMods ?? []) expect(display[1].desc, id).toContain(mod.desc);
      for (const branch of [kit.awaken.A, kit.awaken.B]) {
        expect(branch.patches.length, id).toBeGreaterThan(0);
        expect(display[3].desc, id).toContain(branch.desc);
      }
      expect(kit.awaken.A.patches, id).not.toEqual(kit.awaken.B.patches);
    }
  });

  it('documents all registered profiles and links 14 actual avatar/full JPEG previews under 500KB', () => {
    const document = readFileSync(new URL('../docs/HEROES_BATCH2.md', import.meta.url), 'utf8');
    expect([...document.matchAll(/^## .* ·/gm)]).toHaveLength(14);
    for (const h of newHeroes()) {
      expect(document, h.id).toContain(h.lore);
      expect(document, h.id).toContain(h.quote);
      expect(document, h.id).toContain(`screenshots/heroes-29-${h.id}.jpg`);
      const picture = new URL(`../docs/screenshots/heroes-29-${h.id}.jpg`, import.meta.url);
      expect(statSync(picture).size, h.id).toBeLessThan(500_000);
      expect([...readFileSync(picture).subarray(0, 3)], h.id).toEqual([0xff, 0xd8, 0xff]);
    }
  });
});
