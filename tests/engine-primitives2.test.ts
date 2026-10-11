import { describe, expect, it } from 'vitest';
import { simulate } from '../src/engine/battle';
import { HERO_BY_ID } from '../src/data/heroes';
import { KITS } from '../src/data/kits';
import { dmg, enemy, self, status, text } from '../src/data/kits/helpers';
import type { BEvent, Kit, UnitSetup } from '../src/engine/types';

let seq = 0;
/** 用某只猫当载体，临时装上一套自定义技能（测试专用） */
function hero(base: string, kit: Partial<Kit>): string {
  const id = `${base}__t${++seq}`;
  HERO_BY_ID[id] = { ...HERO_BY_ID[base], id } as never;
  (KITS as Record<string, unknown>)[id] = { ...(KITS[base] as Kit), ...kit, heroId: id };
  return id;
}
const team = (ids: string[], lv = 40): UnitSetup[] => ids.map((heroId, i) => ({ heroId, level: lv, pos: i, star: 3, skillLv: 3 }));
const FOE = ['wei_xuhuchi', 'wei_xiahoudun', 'wei_guojia', 'wu_huanggai', 'xian_guanlu'];
const basic = (effects: Kit['basic']['effects'], target = enemy('front', 1)): Kit['basic'] => ({ id: 't_basic', name: '测试', fx: 'melee.slash', target, effects, desc: 'x' });
const texts = (ev: BEvent[]) => ev.filter((e) => e.t === 'text').map((e) => (e.t === 'text' ? e.text : ''));

describe('新增引擎原语', () => {
  it('detonate 引爆灼烧：移除层数并造成伤害', () => {
    const a = hero('wu_zhoumiaoyu', { basic: basic([status('burn', 3, { snapAtk: 0.2, stacks: 3 }), { t: 'detonate', id: 'burn', per: 0.5 }]) });
    const r = simulate({ seed: 1, A: team([a, 'wei_guojia', 'wu_huanggai']), B: team(FOE), maxRounds: 1 });
    const removed = r.events.filter((e) => e.t === 'status' && e.id === 'burn' && e.op === 'remove');
    expect(removed.length).toBeGreaterThan(0);
  });
  it('hurt 反弹：按受到的伤害量回击', () => {
    const a = hero('man_wutugu', { passive: { id: 'p', name: '反震', desc: 'x', passive: [{ on: 'onHurt', target: { side: 'enemy', pick: 'attacker' }, effects: [{ t: 'damage', scale: { hurt: 1 }, noCrit: true, elem: 'true' }] }] } });
    const r = simulate({ seed: 2, A: team([a, 'wei_guojia']), B: team(FOE), maxRounds: 2 });
    const me = r.units.find((u) => u.heroId === a)!;
    const taken = r.events.filter((e) => e.t === 'damage' && e.dst === me.uid && !e.killed).map((e) => (e.t === 'damage' ? e.amount : 0));
    const reflected = r.events.filter((e) => e.t === 'damage' && e.src === me.uid && e.elem === 'true').map((e) => (e.t === 'damage' ? e.amount : 0));
    expect(taken.length).toBeGreaterThan(0);
    expect(reflected.length).toBeGreaterThan(0);
    expect(Math.max(...reflected)).toBeGreaterThan(0);
  });
  it('allyCount / teamCounter 条件可读', () => {
    const solo = hero('wei_xiahoudun', { basic: basic([{ t: 'when', cond: { c: 'allyCount', atMost: 1 }, then: [text('孤勇')], else: [text('同袍')] }]) });
    expect(texts(simulate({ seed: 1, A: team([solo]), B: team(FOE), maxRounds: 1 }).events)).toContain('孤勇');
    expect(texts(simulate({ seed: 1, A: team([solo, 'wei_guojia']), B: team(FOE), maxRounds: 1 }).events)).toContain('同袍');
    const tc = hero('wei_xiahoudun', { basic: basic([{ t: 'when', cond: { c: 'teamCounter', key: 'totem', atLeast: 1 }, then: [text('图腾在')], else: [text('无图腾')] }]) });
    expect(texts(simulate({ seed: 1, A: team([tc]), B: team(FOE), maxRounds: 1 }).events)).toContain('无图腾');
  });
  it('ward 是真正的减伤，poison 是持续伤害', () => {
    const warded = hero('man_wutugu', { passive: { id: 'p', name: '佑', desc: 'x', passive: [{ on: 'battleStart', effects: [status('ward', 99, { power: 0.5, to: self })] }] } });
    const taken = (id: string) => { const r = simulate({ seed: 3, A: team([id]), B: team(FOE), maxRounds: 2 }); const me = r.units.find((u) => u.heroId === id)!; return r.events.reduce((a, e) => a + (e.t === 'damage' && e.dst === me.uid ? e.amount : 0), 0); };
    expect(taken(warded)).toBeLessThan(taken('man_wutugu'));
    const p = hero('man_zhurong', { basic: basic([status('poison', 3, { snapAtk: 0.3, stacks: 2 })]) });
    const r = simulate({ seed: 1, A: team([p, 'wei_guojia']), B: team(FOE), maxRounds: 3 });
    expect(r.events.some((e) => e.t === 'dot' && e.id === 'poison')).toBe(true);
  });
  it('stealth 让单体技能选不中，全体仍会命中', () => {
    const ghost = hero('wei_xuhuchi', { passive: { id: 'p', name: '隐', desc: 'x', passive: [{ on: 'battleStart', effects: [status('stealth', 99, { to: self })] }] } });
    const single = hero('qun_lvbuding', { basic: basic([dmg(1)], enemy('random', 1)) });
    const r = simulate({ seed: 4, A: team([single]), B: team([ghost, 'wei_guojia', 'wu_huanggai']), maxRounds: 3 });
    const g = r.units.find((u) => u.heroId === ghost)!;
    expect(r.events.some((e) => e.t === 'damage' && e.dst === g.uid && e.src === r.units.find((u) => u.heroId === single)!.uid)).toBe(false);
  });
  it('九命能挡住持续伤害致死', () => {
    const tank = hero('man_wutugu', { passive: { id: 'p', name: '命', desc: 'x', passive: [{ on: 'battleStart', effects: [status('nine', 99, { to: self })] }] } });
    const poisoner = hero('man_zhurong', { basic: basic([status('burn', 5, { snapAtk: 2, stacks: 5 })], enemy('all')) });
    const r = simulate({ seed: 5, A: team([poisoner]), B: team([tank]), maxRounds: 4 });
    expect(texts(r.events)).toContain('九命！');
  });
});
