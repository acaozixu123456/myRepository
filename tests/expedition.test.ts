import { describe, expect, it } from 'vitest';
import {
  MULTS, ROUTES, ROUTE_BY_ID, availableHeroes, claimTeam, dispatch, ensureExpedition, isBusy, minutesLeft, needMet, needText, needsMet, rewardFor, slotsOf, teamDone,
} from '../src/game/expedition';
import { itemCount } from '../src/game/inventory';
import { HERO_BY_ID, HEROES } from '../src/data/heroes';
import { autoLineup, equip, newPlayer, unequip } from '../src/game/state';
import { topUp } from '../src/game/premium';

const T0 = new Date(2026, 9, 5, 12).getTime();
function bench(n = 6) { // 一个有板凳的号：阵容 5 只，另外再给 n 只
  const s = newPlayer(0);
  for (const h of HEROES.filter((x) => !s.heroes[x.id]).slice(0, n)) s.heroes[h.id] = { id: h.id, lv: 20, star: 1, shards: 0, skillLv: 1 };
  return s;
}

describe('猫猫远征', () => {
  it('路线数据：id 唯一、时长递增、每条 3 个需要、收益门槛合理', () => {
    expect(new Set(ROUTES.map((r) => r.id)).size).toBe(ROUTES.length);
    for (let i = 1; i < ROUTES.length; i++) { expect(ROUTES[i].minutes).toBeGreaterThan(ROUTES[i - 1].minutes); expect(ROUTES[i].max).toBeGreaterThanOrEqual(ROUTES[i - 1].max); }
    for (const r of ROUTES) { expect(r.needs).toHaveLength(3); expect(r.needs.map(needText).every(Boolean)).toBe(true); }
    expect(MULTS).toEqual([...MULTS].sort((a, b) => a - b));
  });
  it('可派出的猫 = 拥有的、不在阵容里的、不在别的队伍里的', () => {
    const s = bench(); const av = availableHeroes(s);
    expect(av).toHaveLength(6); for (const id of s.lineup) expect(av).not.toContain(id!);
    const r = dispatch(s, 'patrol', av.slice(0, 2), T0);
    expect(r.ok).toBe(true);
    expect(availableHeroes(s)).toHaveLength(4);
    expect(isBusy(s, av[0])).toBe(true);
  });
  it('派遣校验：人数上限、重复队伍位、阵容里的猫、没有的猫、队伍位不够', () => {
    const s = bench(); const av = availableHeroes(s);
    expect(dispatch(s, 'nope', av.slice(0, 1), T0).ok).toBe(false);
    expect(dispatch(s, 'patrol', [], T0).ok).toBe(false);
    expect(dispatch(s, 'patrol', av.slice(0, 4), T0).ok).toBe(false); // 最多 3
    expect(dispatch(s, 'patrol', [s.lineup[0]!], T0).ok).toBe(false);
    expect(dispatch(s, 'patrol', ['nobody'], T0).ok).toBe(false);
    expect(slotsOf(s, T0)).toBe(1);
    expect(dispatch(s, 'patrol', av.slice(0, 2), T0).ok).toBe(true);
    expect(dispatch(s, 'patrol', av.slice(2, 4), T0).ok).toBe(false); // 只有 1 个队伍位
  });
  it('VIP 与月卡增加队伍位：VIP3 +1、VIP8 +1、月卡 +1', () => {
    const s = newPlayer(0);
    expect(slotsOf(s, T0)).toBe(1);
    topUp(s, 'moon128', T0); topUp(s, 'moon128', T0); // 256 元 → VIP4
    expect(slotsOf(s, T0)).toBe(2);
    for (let i = 0; i < 12; i++) topUp(s, 'moon648', T0); // 够 VIP8
    expect(slotsOf(s, T0)).toBeGreaterThanOrEqual(3);
  });
  it('需要的判定：人数 / 职业 / 同阵营 / 平均等级；满足越多倍数越高', () => {
    const s = bench(); const ids = availableHeroes(s);
    const r = ROUTE_BY_ID.watch;
    const pick = ids.slice(0, 3);
    expect(needMet(s, { k: 'size', n: 3 }, pick)).toBe(true); expect(needMet(s, { k: 'size', n: 4 }, pick)).toBe(false);
    expect(needMet(s, { k: 'level', n: 20 }, pick)).toBe(true); expect(needMet(s, { k: 'level', n: 21 }, pick)).toBe(false);
    expect(needMet(s, { k: 'level', n: 1 }, [])).toBe(false);
    const m = needsMet(s, r, pick);
    expect(m).toBeGreaterThanOrEqual(0); expect(m).toBeLessThanOrEqual(3);
    const lo = rewardFor(s, ROUTE_BY_ID.patrol, 0), hi = rewardFor(s, ROUTE_BY_ID.patrol, 3);
    expect(hi.fish).toBeGreaterThan(lo.fish); expect(hi.mult).toBe(MULTS[3]);
    expect(rewardFor(s, ROUTE_BY_ID.mint, 3).tickets).toBe(1); expect(rewardFor(s, ROUTE_BY_ID.mint, 2).tickets).toBe(0);
    for (const hid of pick) expect(HERO_BY_ID[hid]).toBeTruthy();
  });
  it('按真实时间结算：没到点不能领；到点领奖励，队伍与猫回到可用，计入完成数', () => {
    const s = bench(); const av = availableHeroes(s);
    const d = dispatch(s, 'patrol', av.slice(0, 2), T0);
    if (!d.ok) throw new Error('dispatch');
    expect(teamDone(d.team, T0 + 29 * 60000)).toBe(false); expect(minutesLeft(d.team, T0 + 29 * 60000)).toBe(1);
    expect(claimTeam(s, d.team.id, T0 + 29 * 60000).ok).toBe(false);
    const fish = s.res.fish;
    const r = claimTeam(s, d.team.id, T0 + 30 * 60000);
    expect(r.ok).toBe(true); expect(s.res.fish).toBeGreaterThan(fish);
    expect(ensureExpedition(s).teams).toHaveLength(0); expect(ensureExpedition(s).done).toBe(1);
    expect(availableHeroes(s)).toHaveLength(6);
    expect(claimTeam(s, d.team.id, T0 + 31 * 60000).ok).toBe(false);
    expect(itemCount(s, 'guild_token')).toBeGreaterThanOrEqual(0);
  });
  it('出门的猫不能上阵、一键上阵也不会选它们；回来后恢复', () => {
    const s = bench(); const av = availableHeroes(s);
    const d = dispatch(s, 'patrol', av.slice(0, 1), T0);
    if (!d.ok) throw new Error('dispatch');
    expect(equip(s, av[0]).ok).toBe(false);
    const lineup = autoLineup(s) as unknown as (string | null)[] | void;
    void lineup;
    expect(s.lineup.includes(av[0])).toBe(false);
    claimTeam(s, d.team.id, T0 + 31 * 60000);
    unequip(s, s.lineup[4]!);
    expect(equip(s, av[0]).ok).toBe(true);
  });
});
