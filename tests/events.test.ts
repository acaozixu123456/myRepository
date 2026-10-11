import { describe, expect, it } from 'vitest';
import {
  CARNIVAL_TIERS, CUM_TIERS, GROWTH_TIERS, PACKS, PASS_MAX, PASS_XP, PRIZES, QUIZ, QUIZ_PER_DAY, SPIN_PITY, SPRINT,
  addPoints, answerQuiz, buyGrowth, buyPack, buyPass, canClaimFirstPay, claimCarnival, claimCum, claimFirstPay, claimGrowth, claimPass, claimSprint, claimSprintChest,
  ensureEvents, freeSpins, onTrack, packAvailable, passFree, passLevel, passLux, passPrem, quizToday, rewardText, spin, spinsLeft, sprintDay, DAY_PTS_CAP,
} from '../src/game/events';
import { itemCount } from '../src/game/inventory';
import { topUp, vipLevel } from '../src/game/premium';
import { track } from '../src/game/quests';
import { newPlayer } from '../src/game/state';

const at = (day: number, hour = 12) => new Date(2026, 9, 5 + day, hour).getTime(); // 2026-10-05 周一

describe('活动数据', () => {
  it('题库每题 3 个选项、答案下标合法、题面不重复；每天 3 题互不相同', () => {
    for (const q of QUIZ) { expect(q.o).toHaveLength(3); expect(q.a).toBeGreaterThanOrEqual(0); expect(q.a).toBeLessThan(3); }
    expect(new Set(QUIZ.map((q) => q.q)).size).toBe(QUIZ.length);
    for (let d = 0; d < 40; d++) { const qs = quizToday(at(d)); expect(qs).toHaveLength(QUIZ_PER_DAY); expect(new Set(qs.map((q) => q.q)).size).toBe(QUIZ_PER_DAY); }
  });
  it('各档位门槛单调递增，奖励不为空', () => {
    for (const list of [CARNIVAL_TIERS.map((t) => t.pts), CUM_TIERS.map((t) => t.yuan), GROWTH_TIERS.map((t) => t.ord)]) for (let i = 1; i < list.length; i++) expect(list[i]).toBeGreaterThan(list[i - 1]);
    for (let i = 1; i < CUM_TIERS.length; i++) expect(CUM_TIERS[i].r.tickets!).toBeGreaterThan(CUM_TIERS[i - 1].r.tickets!);
    for (const g of SPRINT) expect(rewardText(g.r)).not.toBe('');
    expect(PRIZES.reduce((a, p) => a + p.w, 0)).toBe(100);
  });
  it('通行证：免费 / 通行证 / 豪华三条轨道，豪华轨只在每 5 级', () => {
    for (let l = 1; l <= PASS_MAX; l++) { expect(rewardText(passFree(l))).not.toBe(''); expect(rewardText(passPrem(l))).not.toBe(''); expect(!!passLux(l)).toBe(l % 5 === 0); }
  });
});

describe('免费活动', () => {
  it('活动点按事件累加，每天有上限，次日与周一重置', () => {
    const s = newPlayer(0);
    for (let i = 0; i < 100; i++) addPoints(s, 'tower_clear', 1, at(0));
    expect(ensureEvents(s, at(0)).dayPts).toBe(DAY_PTS_CAP);
    expect(ensureEvents(s, at(0)).pts).toBe(DAY_PTS_CAP);
    addPoints(s, 'tower_clear', 1, at(1));
    expect(ensureEvents(s, at(1)).pts).toBe(DAY_PTS_CAP + 6);
    expect(ensureEvents(s, at(7)).pts).toBe(0);
    expect(addPoints(s, 'unknown_goal', 5, at(7))).toBe(0);
  });
  it('quests.track 会给活动点', () => {
    const s = newPlayer(0);
    const before = ensureEvents(s).pts;
    track(s, 'clear_stage');
    expect(ensureEvents(s).pts).toBe(before + 1);
    onTrack(s, 'nonsense', 3);
  });
  it('嘉年华：够点才能领，只能领一次', () => {
    const s = newPlayer(0);
    expect(claimCarnival(s, 0, at(0)).ok).toBe(false);
    ensureEvents(s, at(0)).pts = 350;
    expect(claimCarnival(s, 0, at(0)).ok).toBe(true);
    expect(claimCarnival(s, 0, at(0)).ok).toBe(false);
    expect(claimCarnival(s, 1, at(0)).ok).toBe(true);
    expect(claimCarnival(s, 2, at(0)).ok).toBe(false);
  });
  it('七日喵程：按天解锁，目标达成才能领，全部领完开终极大箱', () => {
    const s = newPlayer(0);
    ensureEvents(s, at(0));
    expect(sprintDay(s, at(0))).toBe(1);
    expect(claimSprint(s, 0, at(0)).ok).toBe(false); // 1-6 未通关
    s.best = { chapter: 1, index: 6 };
    expect(claimSprint(s, 0, at(0)).ok).toBe(true);
    expect(claimSprint(s, 0, at(0)).ok).toBe(false);
    s.heroes.extra1 = { id: 'extra1', lv: 1, star: 1, shards: 0, skillLv: 1 };
    expect(claimSprint(s, 1, at(0)).ok).toBe(true); // 6 只猫
    expect(claimSprint(s, 4, at(0)).ok).toBe(false); // 第 3 天未解锁
    expect(claimSprintChest(s, at(9)).ok).toBe(false);
    // 满足全部条件并过了七天
    s.best = { chapter: 1, index: 24 };
    s.tower = { floor: 10 };
    for (const h of Object.values(s.heroes)) h.lv = 25;
    for (let i = 0; i < 5; i++) s.heroes[`more${i}`] = { id: `more${i}`, lv: 25, star: 1, shards: 0, skillLv: 1 };
    s.social = { mine: [], readT: 0, friends: [], visit: {}, arena: { day: 0, used: 0, extra: 0, rating: 1000, wins: 3, losses: 1, best: 1000, log: [] } };
    s.guild = { id: 'g_box', contrib: 0, weekly: { key: 0, v: 0 }, day: 0, helps: 0, donates: 0, chest: false, leftDay: -1 };
    s.wboss = { day: 0, used: 0, week: 0, bars: 0.3, best: 0.3, claimed: [] };
    s.pay = { total: 0, first: [], vipDay: -1, pity: { sp: 0, upLost: false }, grants: [], orders: [], pulls: 0 };
    s.heroes.wei_guojia.lv = 80; s.heroes.wei_xiahoudun.star = 5;
    for (let i = 0; i < SPRINT.length; i++) if (!ensureEvents(s, at(9)).sprint.includes(i)) { const r = claimSprint(s, i, at(9)); if (!r.ok && !/战力/.test(SPRINT[i].text)) throw new Error(`${i}: ${r.reason}`); if (!r.ok) ensureEvents(s, at(9)).sprint.push(i); }
    expect(claimSprintChest(s, at(9)).ok).toBe(true);
    expect(claimSprintChest(s, at(9)).ok).toBe(false);
  });
  it('猫抓机：每天免费次数随 VIP/月卡增加，额外次数扣铃铛，保底必出招福符', () => {
    expect(freeSpins(0, false)).toBe(1); expect(freeSpins(3, false)).toBe(2); expect(freeSpins(8, true)).toBe(4);
    const s = newPlayer(0);
    expect(spinsLeft(s, 0, false, at(0)).free).toBe(1);
    expect(spin(s, 0, false, () => 0, at(0)).ok).toBe(true);
    expect(spinsLeft(s, 0, false, at(0)).free).toBe(0);
    const bells = s.res.bells;
    const r = spin(s, 0, false, () => 0, at(0));
    expect(r.ok && r.paid).toBe(true); expect(s.res.bells).toBeLessThan(bells + 400);
    expect(spinsLeft(s, 0, false, at(1)).free).toBe(1);
    // 保底
    const t = newPlayer(0); t.res.bells = 99999;
    const prizes: string[] = [];
    for (let day = 0; day < 6; day++) for (let k = 0; k < 6; k++) { const x = spin(t, 3, true, () => 0, at(day)); if (x.ok) prizes.push(x.prize.id); }
    expect(prizes.slice(0, SPIN_PITY).includes('ticket')).toBe(true);
    // 每天额外次数有上限
    const u = newPlayer(0); u.res.bells = 99999; let n = 0;
    for (let k = 0; k < 20; k++) if (spin(u, 0, false, () => 0.5, at(0)).ok) n++;
    expect(n).toBe(1 + 5);
  });
  it('每日问答：每天 3 题，答对给奖励，全对有额外奖，答完不能再答', () => {
    const s = newPlayer(0), qs = quizToday(at(0));
    const fish = s.res.fish;
    const a = answerQuiz(s, qs[0].a, at(0));
    expect(a.ok && a.right).toBe(true); expect(s.res.fish - fish).toBe(1500);
    const w = answerQuiz(s, (qs[1].a + 1) % 3, at(0));
    expect(w.ok && !w.right).toBe(true);
    const last = answerQuiz(s, qs[2].a, at(0));
    expect(last.ok && !last.perfect).toBe(true);
    expect(answerQuiz(s, 0, at(0)).ok).toBe(false);
    const p = newPlayer(0);
    const tickets = p.res.tickets;
    for (const q of quizToday(at(1))) answerQuiz(p, q.a, at(1));
    expect(p.res.tickets - tickets).toBe(1);
    expect(answerQuiz(p, 0, at(2)).ok).toBe(true);
  });
});

describe('氪金活动', () => {
  it('首充豪礼：没充值不能领，充值后领一次', () => {
    const s = newPlayer(0);
    expect(canClaimFirstPay(s, at(0))).toBe(false);
    expect(claimFirstPay(s, at(0)).ok).toBe(false);
    topUp(s, 'moon6', at(0));
    expect(canClaimFirstPay(s, at(0))).toBe(true);
    const moon = s.res.moon;
    expect(claimFirstPay(s, at(0)).ok).toBe(true);
    expect(s.res.moon - moon).toBe(200); expect(itemCount(s, 'fishbone_large')).toBe(1);
    expect(claimFirstPay(s, at(0)).ok).toBe(false);
  });
  it('周累充：充值计入本周，按档位逐档领，周一清零', () => {
    const s = newPlayer(0);
    topUp(s, 'moon6', at(0)); topUp(s, 'moon30', at(1));
    expect(ensureEvents(s, at(1)).weekYuan).toBe(36);
    expect(claimCum(s, 0, at(1)).ok).toBe(true);
    expect(claimCum(s, 1, at(1)).ok).toBe(true);
    expect(claimCum(s, 2, at(1)).ok).toBe(false);
    expect(claimCum(s, 0, at(1)).ok).toBe(false);
    expect(ensureEvents(s, at(7)).weekYuan).toBe(0);
    expect(vipLevel(s)).toBeGreaterThanOrEqual(2); // 活动内购买也计入累计充值
  });
  it('成长基金：购买后随主线推进逐档领回月光珠', () => {
    const s = newPlayer(0);
    expect(claimGrowth(s, 0, at(0)).ok).toBe(false);
    expect(buyGrowth(s, at(0)).ok).toBe(true);
    expect(buyGrowth(s, at(0)).ok).toBe(false);
    expect(s.pay!.total).toBe(98);
    expect(claimGrowth(s, 0, at(0)).ok).toBe(false);
    s.best = { chapter: 1, index: 12 };
    const moon = s.res.moon;
    expect(claimGrowth(s, 0, at(0)).ok).toBe(true); expect(claimGrowth(s, 1, at(0)).ok).toBe(true);
    expect(claimGrowth(s, 1, at(0)).ok).toBe(false);
    expect(s.res.moon - moon).toBe(200);
    const total = GROWTH_TIERS.reduce((a, t) => a + (t.r.moon ?? 0), 0);
    expect(total / 10).toBeGreaterThan(98); // 领完的当量超过买价
  });
  it('通行证：经验换等级，免费轨可领，付费轨需购买，豪华版补差价并立得等级', () => {
    const s = newPlayer(0);
    ensureEvents(s, at(0)).xp = PASS_XP * 5;
    expect(passLevel(s, at(0))).toBe(5);
    expect(claimPass(s, 'free', 3, at(0)).ok).toBe(true);
    expect(claimPass(s, 'free', 3, at(0)).ok).toBe(false);
    expect(claimPass(s, 'free', 6, at(0)).ok).toBe(false);
    expect(claimPass(s, 'prem', 3, at(0)).ok).toBe(false);
    expect(buyPass(s, 1, at(0)).ok).toBe(true);
    expect(s.pay!.total).toBe(68);
    expect(claimPass(s, 'prem', 3, at(0)).ok).toBe(true);
    expect(claimPass(s, 'lux', 5, at(0)).ok).toBe(false);
    expect(buyPass(s, 1, at(0)).ok).toBe(false);
    expect(buyPass(s, 2, at(0)).ok).toBe(true);
    expect(s.pay!.total).toBe(128); // 68 + 补差价 60
    expect(passLevel(s, at(0))).toBe(15);
    expect(claimPass(s, 'lux', 5, at(0)).ok).toBe(true);
    expect(claimPass(s, 'lux', 4, at(0)).ok).toBe(false);
    expect(ensureEvents(s, at(28)).passTier).toBe(0); // 赛季重置
  });
  it('限时礼包：按日/周/月限购，到期可再买，充值计入 VIP 累计', () => {
    const s = newPlayer(0);
    const day = PACKS.find((p) => p.period === 'day')!, week = PACKS.find((p) => p.period === 'week')!;
    expect(packAvailable(s, day, at(0))).toBe(true);
    const tickets = s.res.tickets;
    expect(buyPack(s, day.id, at(0)).ok).toBe(true);
    expect(s.res.tickets - tickets).toBe(day.r.tickets);
    expect(buyPack(s, day.id, at(0)).ok).toBe(false);
    expect(buyPack(s, day.id, at(1)).ok).toBe(true);
    expect(buyPack(s, week.id, at(1)).ok).toBe(true);
    expect(buyPack(s, week.id, at(5)).ok).toBe(false);
    expect(buyPack(s, week.id, at(8)).ok).toBe(true);
    expect(buyPack(s, 'nope', at(8)).ok).toBe(false);
    expect(s.pay!.total).toBe(6 + 6 + 30 + 30);
    for (let i = 1; i < PACKS.length; i++) expect((PACKS[i].r.tickets ?? 0) / PACKS[i].yuan).toBeGreaterThanOrEqual((PACKS[i - 1].r.tickets ?? 0) / PACKS[i - 1].yuan );
  });
});

import { FESTIVALS, PULL_TIERS, RANK_REWARDS, buyFestivalPack, canWish, claimFestival, claimPull, claimRank, festivalGift, festivalNow, rankNow, rankRewardOf, setWishHero, wish, wishShards } from '../src/game/events';
import { NPCS } from '../src/game/npc';

const atDate = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();

describe('许愿池', () => {
  it('只能为已拥有的猫猫许愿，每天一次，连续满 7 天有额外大奖，断签从头', () => {
    const s = newPlayer(0);
    expect(wish(s, 0, false, at(0)).ok).toBe(false);
    expect(setWishHero(s, 'nobody', at(0)).ok).toBe(false);
    expect(setWishHero(s, 'wei_guojia', at(0)).ok).toBe(true);
    const before = s.heroes.wei_guojia.shards;
    const r = wish(s, 0, false, at(0));
    expect(r.ok && r.shards).toBe(3); expect(s.heroes.wei_guojia.shards - before).toBe(3);
    expect(canWish(s, at(0))).toBe(false);
    expect(wish(s, 0, false, at(0)).ok).toBe(false);
    let last = r;
    for (let d = 1; d < 7; d++) last = wish(s, 0, false, at(d)) as typeof r;
    expect(last.ok && last.streak).toBe(7); expect(last.ok && last.bonus).toBe(true); expect(last.ok && last.shards).toBe(23);
    const gap = wish(s, 0, false, at(9));
    expect(gap.ok && gap.streak).toBe(1);
    expect(wishShards(8, true)).toBe(6);
  });
});

describe('招募盛典', () => {
  it('track(recruit) 累计本周招募次数，到档可领，周一清零', () => {
    const s = newPlayer(0);
    expect(claimPull(s, 0, at(0)).ok).toBe(false);
    ensureEvents(s, at(0));
    track(s, 'recruit', 10);
    expect(ensureEvents(s).pulls).toBeGreaterThanOrEqual(10);
    const e = ensureEvents(s, at(0)); e.pulls = 20;
    expect(claimPull(s, 0, at(0)).ok).toBe(true); expect(claimPull(s, 1, at(0)).ok).toBe(true);
    expect(claimPull(s, 0, at(0)).ok).toBe(false); expect(claimPull(s, 2, at(0)).ok).toBe(false);
    expect(ensureEvents(s, at(7)).pulls).toBe(0);
    for (let i = 1; i < PULL_TIERS.length; i++) expect(PULL_TIERS[i].n).toBeGreaterThan(PULL_TIERS[i - 1].n);
  });
});

describe('节日活动', () => {
  it('按公历日期判断进行中的节日，能跨年，没有节日时给出下一个', () => {
    expect(festivalNow(atDate(2026, 10, 3)).active?.f.key).toBe('guoqing');
    expect(festivalNow(atDate(2026, 10, 11)).active).toBeNull();
    expect(festivalNow(atDate(2026, 10, 11)).next.f.key).toBe('halloween');
    expect(festivalNow(atDate(2026, 10, 11)).daysToNext).toBe(17);
    expect(festivalNow(atDate(2027, 1, 2)).active?.f.key).toBe('newyear');
    expect(festivalNow(atDate(2026, 12, 31)).active?.f.key).toBe('newyear');
    expect(new Set(FESTIVALS.map((f) => f.key)).size).toBe(FESTIVALS.length);
  });
  it('节日签到按天领取，未到的天不能领，礼盒每届限购 1 次', () => {
    const s = newPlayer(0);
    expect(claimFestival(s, 0, atDate(2026, 10, 11)).ok).toBe(false);
    expect(claimFestival(s, 0, atDate(2026, 10, 28)).ok).toBe(true);
    expect(claimFestival(s, 0, atDate(2026, 10, 28)).ok).toBe(false);
    expect(claimFestival(s, 2, atDate(2026, 10, 28)).ok).toBe(false);
    expect(claimFestival(s, 2, atDate(2026, 10, 30)).ok).toBe(true); // 补领此前日子也行
    expect(claimFestival(s, 1, atDate(2026, 10, 30)).ok).toBe(true);
    expect(claimFestival(s, 99, atDate(2026, 10, 30)).ok).toBe(false);
    expect(buyFestivalPack(s, atDate(2026, 10, 11)).ok).toBe(false);
    expect(buyFestivalPack(s, atDate(2026, 10, 29)).ok).toBe(true);
    expect(buyFestivalPack(s, atDate(2026, 10, 30)).ok).toBe(false);
    expect(s.pay!.total).toBe(30);
    expect(buyFestivalPack(s, atDate(2026, 12, 23)).ok).toBe(true); // 下一届可再买
    expect(rewardText(festivalGift(6, 7))).toContain('招福符');
  });
});

describe('周冲榜', () => {
  it('奖励按名次递减，上周名次结算后可领一次', () => {
    for (let i = 1; i < RANK_REWARDS.length; i++) expect(RANK_REWARDS[i].upTo).toBeGreaterThan(RANK_REWARDS[i - 1].upTo);
    expect(rankRewardOf(1).r.moon!).toBeGreaterThan(rankRewardOf(2).r.moon!);
    expect(rankRewardOf(20).label).toBe('参与奖');
    const s = newPlayer(0);
    const e = ensureEvents(s, at(0));
    e.rank.power = 5000;
    const now = rankNow(s, at(0));
    expect(now.board).toHaveLength(NPCS.length + 1);
    expect(now.rank).toBeGreaterThanOrEqual(1);
    expect(claimRank(s, at(0)).ok).toBe(false);
    ensureEvents(s, at(7)); // 跨周结算
    const l = ensureEvents(s, at(7)).rank.last!;
    expect(l.rank).toBeGreaterThanOrEqual(1); expect(l.claimed).toBe(false);
    const r = claimRank(s, at(7));
    expect(r.ok).toBe(true); expect(claimRank(s, at(7)).ok).toBe(false);
    expect(ensureEvents(s, at(7)).rank.power).toBe(0);
  });
});

import { POOLS, pull, syncUpPool } from '../src/game/gacha';
import { UP_DAYS, UP_TIERS, claimUp, upDaysLeft, upHeroOf, upPeriod } from '../src/game/events';
import { HEROES } from '../src/data/heroes';

describe('限时 UP 招募', () => {
  it('每 14 天轮换一只 UR，第 0 期是周喵瑜，轮完一圈回到原点，期内不变', () => {
    const urs = HEROES.filter((h) => h.rarity === 'UR').map((h) => h.id);
    expect(upHeroOf(0)).toBe('wu_zhoumiaoyu');
    expect(new Set(Array.from({ length: urs.length }, (_, p) => upHeroOf(p))).size).toBe(urs.length);
    expect(upHeroOf(urs.length)).toBe(upHeroOf(0));
    const t = new Date(2026, 9, 1, 12).getTime();
    expect(upPeriod(t)).toBe(0); expect(upPeriod(t + (UP_DAYS - 1) * 86400000 - 3600000 * 13)).toBe(0); expect(upPeriod(t + UP_DAYS * 86400000)).toBe(1);
    expect(upDaysLeft(t)).toBeGreaterThan(0); expect(upDaysLeft(t)).toBeLessThanOrEqual(UP_DAYS);
  });
  it('syncUpPool 把限定池换成本期 UP 猫猫（名称、说明同步）', () => {
    const saved = { ...POOLS[0] };
    const t = new Date(2026, 9, 20, 12).getTime(); // 第 1 期
    const p = syncUpPool(t);
    expect(p.upHero).toBe(upHeroOf(1)); expect(p.name).toContain('限定'); expect(p.desc).toContain(HEROES.find((h) => h.id === upHeroOf(1))!.name);
    Object.assign(POOLS[0], saved);
  });
  it('抽 UP 池才累计，常驻池不算；到档可领，100 抽送 UP 猫猫（已拥有转碎片），换期清零', () => {
    const s = newPlayer(0); s.res.tickets = 999;
    pull(s, POOLS[1], 10, () => 0.5);
    expect(ensureEvents(s, at(0)).up.pulls).toBe(0);
    pull(s, POOLS[0], 10, () => 0.5);
    expect(ensureEvents(s).up.pulls).toBe(10);
    expect(claimUp(s, 0).ok).toBe(false);
    ensureEvents(s).up.pulls = 100;
    const tickets = s.res.tickets;
    expect(claimUp(s, 0).ok).toBe(true); expect(s.res.tickets - tickets).toBe(3);
    expect(claimUp(s, 0).ok).toBe(false);
    expect(claimUp(s, 1).ok).toBe(true);
    const id = upHeroOf(ensureEvents(s).up.period);
    delete s.heroes[id];
    expect(claimUp(s, 2).ok).toBe(true); expect(s.heroes[id]).toBeTruthy();
    const e = ensureEvents(s); e.up.claimed = []; e.up.pulls = 100;
    expect(claimUp(s, 2).ok).toBe(true); expect(s.heroes[id].shards).toBe(60);
    expect(UP_TIERS.map((t) => t.n)).toEqual([30, 60, 100]);
    expect(ensureEvents(s, Date.now() + 15 * 86400000).up.pulls).toBe(0);
  });
});

import { OPEN_DAYS, OPEN_REWARDS, OPEN_THEMES, claimOpen, openActive, openBoard, openDay, openRankOf } from '../src/game/events';

describe('开服冲榜', () => {
  it('只在新号前 7 天开放，每天一个主题，榜单含玩家与全部模拟玩家', () => {
    const s = newPlayer(0);
    ensureEvents(s, at(0));
    expect(openDay(s, at(0))).toBe(1); expect(openActive(s, at(0))).toBe(true);
    expect(openActive(s, at(OPEN_DAYS - 1))).toBe(true); expect(openActive(s, at(OPEN_DAYS))).toBe(false);
    expect(OPEN_THEMES).toHaveLength(OPEN_DAYS);
    const b = openBoard(s, 'power', at(2));
    expect(b).toHaveLength(NPCS.length + 1); expect(b.filter((r) => r.me)).toHaveLength(1);
    for (let i = 1; i < OPEN_REWARDS.length; i++) expect(OPEN_REWARDS[i].upTo).toBeGreaterThan(OPEN_REWARDS[i - 1].upTo);
  });
  it('名次不够进前 15 不能领；够了每天领一次；结束后不能领', () => {
    const s = newPlayer(0);
    ensureEvents(s, at(0));
    const low = claimOpen(s, at(0));
    expect(low.ok).toBe(false);
    s.best = { chapter: 6, index: 24 }; // 关卡榜第一天：推到最远关
    for (const h of Object.values(s.heroes)) h.lv = 100;
    const o = openRankOf(s, at(0));
    expect(o.rank).toBe(1);
    const r = claimOpen(s, at(0));
    expect(r.ok && r.rank).toBe(1);
    expect(claimOpen(s, at(0)).ok).toBe(false);
    expect(claimOpen(s, at(1)).ok).toBe(true); // 第二天（战力榜）：战力也要够
    expect(claimOpen(s, at(OPEN_DAYS)).ok).toBe(false);
  });
});

import { claimAllMail, claimMail, mailbox, unclaimedMail } from '../src/game/events';

describe('邮件', () => {
  it('欢迎信一直在；每周一多一封来信；节日期间有节日来信；充值后有感谢信；附件只能领一次', () => {
    const s = newPlayer(0);
    ensureEvents(s, at(0));
    expect(mailbox(s, at(0)).map((m) => m.id)).toContain('welcome');
    expect(mailbox(s, at(7)).map((m) => m.id)).toEqual(['wk:' + ensureEvents(s, at(7)).week, 'welcome']);
    expect(mailbox(s, at(7)).map((m) => m.id)).toContain(`wk:${ensureEvents(s, at(7)).week}`);
    expect(mailbox(s, at(14)).filter((m) => m.id.startsWith('wk:'))).toHaveLength(2);
    const tickets = s.res.tickets;
    expect(claimMail(s, 'welcome', at(7)).ok).toBe(true); expect(s.res.tickets - tickets).toBe(2);
    expect(claimMail(s, 'welcome', at(7)).ok).toBe(false);
    expect(claimMail(s, 'nope', at(0)).ok).toBe(false);
    topUp(s, 'moon6', at(0));
    expect(unclaimedMail(s, at(7)).map((m) => m.id)).toContain('thanks');
    const all = claimAllMail(s, at(14));
    expect(all.ok && all.n).toBeGreaterThanOrEqual(3);
    expect(claimAllMail(s, at(14)).ok).toBe(false);
    const f = new Date(2026, 9, 29, 12).getTime(); // 万圣节期间
    expect(mailbox(s, f).some((m) => m.id.startsWith('fest:halloween'))).toBe(true);
  });
});

import { tickerLines } from '../src/app/screens/home';
describe('首页小公告', () => {
  it('四条：世界首领、公会首领、UP 招募、节日；节日期间显示进行中', () => {
    const l = tickerLines(new Date(2026, 9, 11, 12).getTime());
    expect(l).toHaveLength(4);
    expect(l[0]).toContain('世界首领'); expect(l[1]).toContain('公会首领'); expect(l[2]).toContain('限时 UP');
    expect(l[3]).toContain('下个节日'); expect(l[3]).toContain('南瓜纸箱夜');
    expect(tickerLines(new Date(2026, 9, 30, 12).getTime())[3]).toContain('节日进行中');
  });
});
