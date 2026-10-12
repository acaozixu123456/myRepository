import { describe, expect, it } from 'vitest';
import { COMBOS, COMBO_BY_BOND, COMBO_EVERY } from '../src/data/combos';
import { HEROES } from '../src/data/heroes';
import { tacticFor, TACTIC_CD } from '../src/data/kits/tactics';
import { BONDS } from '../src/data/systems';
import { simulate } from '../src/engine/battle';
import type { UnitSetup } from '../src/engine/types';

const team = (ids: string[], level = 40, hpMul = 1): UnitSetup[] => ids.map((heroId, pos) => ({ heroId, level, pos, star: 1, skillLv: 1, hpMul }));
const FOES = ['man_wutugu', 'man_shamoke', 'man_mengmiaohuo', 'man_mulu', 'man_zhurong'];

describe('战技', () => {
  it('每个英雄都有战技：名字 / 特效 / 目标 / 效果齐全，且按职业分到五种特效', () => {
    const fx = new Set<string>();
    for (const h of HEROES) {
      const t = tacticFor(h.id);
      expect(t.name.length).toBeGreaterThanOrEqual(3);
      expect(t.effects.length).toBeGreaterThan(0);
      expect(t.target).toBeTruthy();
      expect(t.desc).toContain('战技');
      expect(t.fx.startsWith('tac.')).toBe(true);
      fx.add(t.fx);
    }
    expect([...fx].sort()).toEqual(['tac.blessing', 'tac.guard', 'tac.rush', 'tac.spell', 'tac.volley'].map((x) => (x === 'tac.blessing' ? 'tac.bless' : x)).sort());
  });
  it('开启后每 3 次行动放一次（第 2 次行动起）；默认关闭时从不出现', () => {
    const A = team(['wei_zhangliao', 'shu_huangzhong', 'wu_ganning', 'xian_guanlu', 'man_shamoke'], 90);
    const B = team(FOES, 40, 400);
    const on = simulate({ seed: 7, A, B, tactics: true, maxRounds: 10 });
    const off = simulate({ seed: 7, A, B, maxRounds: 10 });
    expect(off.events.some((e) => e.t === 'act' && e.kind === 'tactic')).toBe(false);
    const u = on.units.find((x) => x.side === 'A' && x.heroId === 'wei_zhangliao')!;
    const kinds = on.events.filter((e) => e.t === 'act' && e.uid === u.uid).map((e) => (e as { kind: string }).kind).filter((k) => k !== 'ultimate');
    expect(kinds.length).toBeGreaterThanOrEqual(4);
    kinds.forEach((k, i) => expect(k === 'tactic').toBe(i % TACTIC_CD === 1));
  });
  it('杂兵没有战技；同种子结果可复现', () => {
    const mobs = team(['mob_wei_guard', 'mob_wei_archer'], 20);
    const r = simulate({ seed: 3, A: mobs, B: team(['mob_shu_guard'], 20), tactics: true });
    expect(r.events.some((e) => e.t === 'act' && e.kind === 'tactic')).toBe(false);
    const a = simulate({ seed: 11, A: team(['shu_liumiaobei']), B: team(FOES, 30), tactics: true, combos: true });
    const b = simulate({ seed: 11, A: team(['shu_liumiaobei']), B: team(FOES, 30), tactics: true, combos: true });
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
  });
});

describe('合击技', () => {
  it('每个羁绊都有合击技定义', () => {
    expect(COMBOS.length).toBe(BONDS.length);
    for (const b of BONDS) expect(COMBO_BY_BOND[b.name], b.name).toBeTruthy();
    for (const c of COMBOS) { expect(c.fx.startsWith('combo.')).toBe(true); expect(c.effects.length).toBeGreaterThan(0); }
  });
  it('羁绊凑齐才触发，第 3 / 6 回合开头各一次；关闭 combos / noBonds 时没有', () => {
    const A = team(['shu_liumiaobei', 'shu_guanyunmiao', 'shu_zhangmiaofei', 'shu_zhugemiaoliang', 'wei_guojia'], 40);
    const B = team(FOES, 40, 6);
    const r = simulate({ seed: 5, A, B, combos: true, maxRounds: 8 });
    const cs = r.events.filter((e) => e.t === 'combo') as Extract<(typeof r.events)[number], { t: 'combo' }>[];
    expect(cs.length).toBeGreaterThanOrEqual(2);
    const mine = cs.filter((c) => c.side === 'A'); expect(mine.length).toBeGreaterThanOrEqual(2); expect(mine.every((c) => c.bond === '桃园结义' && c.members.length === 3)).toBe(true); expect(cs.some((c) => c.side === 'B' && c.bond === '七擒七纵')).toBe(true);
    const rounds: number[] = []; let round = 0;
    for (const e of r.events) { if (e.t === 'round') round = e.n; if (e.t === 'combo' && e.side === 'A') rounds.push(round); }
    expect(rounds.slice(0, 2)).toEqual([COMBO_EVERY, COMBO_EVERY * 2]);
    expect(simulate({ seed: 5, A, B, maxRounds: 8 }).events.some((e) => e.t === 'combo')).toBe(false);
    expect(simulate({ seed: 5, A, B, combos: true, noBonds: true, maxRounds: 8 }).events.some((e) => e.t === 'combo')).toBe(false);
    const broken = team(['shu_liumiaobei', 'shu_guanyunmiao', 'wei_guojia', 'shu_zhugemiaoliang', 'wu_ganning'], 40);
    expect(simulate({ seed: 5, A: broken, B, combos: true, maxRounds: 8 }).events.some((e) => e.t === 'combo' && e.side === 'A')).toBe(false);
  });
  it('合击技真的造成伤害 / 治疗事件', () => {
    const A = team(['shu_liumiaobei', 'shu_guanyunmiao', 'shu_zhangmiaofei', 'shu_zhugemiaoliang', 'wei_guojia'], 40);
    const r = simulate({ seed: 9, A, B: team(FOES, 40, 6), combos: true, maxRounds: 4 });
    const i = r.events.findIndex((e) => e.t === 'combo');
    expect(i).toBeGreaterThan(0);
    const after = r.events.slice(i + 1, i + 40);
    expect(after.some((e) => e.t === 'damage')).toBe(true);
    expect(after.some((e) => e.t === 'heal')).toBe(true);
  });
});
