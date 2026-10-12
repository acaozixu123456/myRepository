import { describe, expect, it } from 'vitest';
import { PETS, PET_BY_ID } from '../src/data/pets';
import { lookOf } from '../src/data/units';
import { simulate } from '../src/engine/battle';
import type { UnitSetup } from '../src/engine/types';
import { PET_PITY, addEggs, activePet, buyEgg, hatch, petBonus, petLevelUp, petLvCap, petMul, petPower, petStarCost, petStarUp, petsOf, setActive } from '../src/game/pets';
import { lineupSetups } from '../src/game/stage';
import { newPlayer, teamPower } from '../src/game/state';

const seq = (...v: number[]) => { let i = 0; return () => v[i++ % v.length]; };
const team = (ids: string[], level = 40, hpMul = 1): UnitSetup[] => ids.map((heroId, pos) => ({ heroId, level, pos, star: 1, skillLv: 1, hpMul }));
const A = ['wei_zhangliao', 'shu_huangzhong', 'wu_ganning', 'xian_guanlu', 'man_shamoke'];
const B = ['man_wutugu', 'man_shamoke', 'man_mengmiaohuo', 'man_mulu', 'man_zhurong'];

describe('宠物数据', () => {
  it('12 只宠物：id 唯一、有外观、技能特效以 pet. 开头，三档稀有度都有', () => {
    expect(PETS.length).toBe(12);
    expect(new Set(PETS.map((p) => p.id)).size).toBe(12);
    for (const p of PETS) {
      expect(p.id.startsWith('pet_')).toBe(true);
      expect(lookOf(p.id)).toBe(p.look);
      expect(p.skill.fx.startsWith('pet.')).toBe(true);
      expect(p.skill.effects.length).toBeGreaterThan(0);
      expect(p.skill.desc.length).toBeGreaterThan(8);
      expect(p.look.build).toBeLessThan(1);
    }
    expect(new Set(PETS.map((p) => p.rarity))).toEqual(new Set(['R', 'SR', 'SSR']));
  });
});

describe('宠物养成', () => {
  it('孵蛋：新宠物入库并自动出战，重复宠物转碎片，没蛋不能孵', () => {
    const s = newPlayer(0);
    addEggs(s, 2);
    const eggs0 = petsOf(s).eggs;
    const r1 = hatch(s, seq(0.5, 0)) as { id: string; isNew: boolean };
    expect(r1.isNew).toBe(true);
    expect(petsOf(s).active).toBe(r1.id);
    expect(petsOf(s).eggs).toBe(eggs0 - 1);
    const r2 = hatch(s, seq(0.5, 0)) as { id: string; isNew: boolean; shards: number };
    expect(r2.id).toBe(r1.id);
    expect(r2.isNew).toBe(false);
    expect(petsOf(s).owned[r1.id].shards).toBe(r2.shards);
    petsOf(s).eggs = 0;
    expect((hatch(s) as { ok: boolean }).ok).toBe(false);
  });
  it('保底：连续 19 颗没出 SSR，第 20 颗必出', () => {
    const s = newPlayer(0);
    addEggs(s, 40);
    for (let i = 0; i < PET_PITY - 1; i++) expect((hatch(s, () => 0.99) as { rarity: string }).rarity).toBe('R');
    expect((hatch(s, () => 0.99) as { rarity: string }).rarity).toBe('SSR');
    expect(petsOf(s).pity).toBe(0);
  });
  it('升级 / 升星：吃小鱼干和碎片，受星级等级上限约束，加成 < 10%', () => {
    const s = newPlayer(0);
    petsOf(s).owned.pet_tuanzi = { lv: 1, star: 1, shards: 0 };
    s.res.fish = 1e6;
    while (petLevelUp(s, 'pet_tuanzi').ok);
    expect(petsOf(s).owned.pet_tuanzi.lv).toBe(petLvCap(1));
    expect(petStarUp(s, 'pet_tuanzi').ok).toBe(false);
    petsOf(s).owned.pet_tuanzi.shards = 999;
    for (let i = 0; i < 4; i++) expect(petStarUp(s, 'pet_tuanzi').ok).toBe(true);
    expect(petStarUp(s, 'pet_tuanzi').ok).toBe(false);
    while (petLevelUp(s, 'pet_tuanzi').ok);
    const o = petsOf(s).owned.pet_tuanzi;
    expect(o.lv).toBe(30);
    expect(petBonus(o)).toBeLessThan(0.1);
    expect(petBonus(o)).toBeGreaterThan(petBonus({ lv: 1, star: 1, shards: 0 }));
    expect(petPower(o)).toBeGreaterThan(petPower({ lv: 1, star: 1, shards: 0 }));
    expect(petStarCost(1)).toBeLessThan(petStarCost(2));
  });
  it('买蛋要金铃铛；出战 / 取消出战；存档读取补齐', () => {
    const s = newPlayer(0);
    s.res.bells = 100;
    expect(buyEgg(s).ok).toBe(false);
    s.res.bells = 500;
    expect(buyEgg(s).ok).toBe(true);
    expect(s.res.bells).toBe(300);
    expect(setActive(s, 'pet_xueqiu').ok).toBe(false);
    petsOf(s).owned.pet_xueqiu = { lv: 1, star: 1, shards: 0 };
    expect(setActive(s, 'pet_xueqiu').ok).toBe(true);
    expect(activePet(s)?.id).toBe('pet_xueqiu');
    setActive(s, null);
    expect(petMul(s)).toBe(1);
  });
  it('出战宠物同时抬高显示战力和实战属性', () => {
    const s = newPlayer(0);
    const p0 = teamPower(s);
    const hp0 = lineupSetups(s)[0].statMul ?? 1;
    petsOf(s).owned.pet_xueqiu = { lv: 10, star: 3, shards: 0 };
    setActive(s, 'pet_xueqiu');
    expect(teamPower(s)).toBeGreaterThan(p0);
    expect(lineupSetups(s)[0].statMul ?? 1).toBeCloseTo(hp0 * petMul(s), 6);
  });
});

describe('宠物战斗技能', () => {
  it('第 2、5、8… 回合各出手一次，威力随等级变大；默认不开宠物就没有事件', () => {
    const off = simulate({ seed: 3, A: team(A, 90), B: team(B, 40, 400), maxRounds: 9 });
    expect(off.events.some((e) => e.t === 'pet')).toBe(false);
    const on = simulate({ seed: 3, A: team(A, 90, 9000), B: team(B, 40, 9000), maxRounds: 9, pet: { A: { id: 'pet_huzai', power: 1 } } });
    const rounds: number[] = [];
    let cur = 0;
    for (const e of on.events) { if (e.t === 'round') cur = e.n; if (e.t === 'pet') rounds.push(cur); }
    expect(rounds).toEqual([2, 5, 8]);
    const dmgOf = (power: number) => simulate({ seed: 3, A: team(A, 90), B: team(B, 40, 4000), maxRounds: 2, pet: { A: { id: 'pet_huzai', power } } });
    const sum = (r: ReturnType<typeof simulate>) => { let on = false, t = 0; for (const e of r.events) { if (e.t === 'pet') on = true; else if (e.t === 'act' || e.t === 'round') on = false; else if (on && e.t === 'damage') t += e.amount; } return t; };
    expect(sum(dmgOf(2))).toBeGreaterThan(sum(dmgOf(1)));
    expect(sum(dmgOf(1))).toBeGreaterThan(0);
  });
  it('每只宠物的技能都能在战斗里跑通，并产生效果事件', () => {
    for (const p of PETS) {
      const r = simulate({ seed: 5, A: team(A, 60), B: team(B, 60), maxRounds: 3, pet: { A: { id: p.id, power: 1 } } });
      const i = r.events.findIndex((e) => e.t === 'pet');
      expect(i, p.id).toBeGreaterThan(-1);
      const after = r.events.slice(i + 1, i + 40);
      expect(after.some((e) => e.t === 'damage' || e.t === 'heal' || e.t === 'shield' || e.t === 'status' || e.t === 'energy'), p.id).toBe(true);
    }
    expect(PET_BY_ID.pet_huzai.skill.name).toBeTruthy();
  });
});
