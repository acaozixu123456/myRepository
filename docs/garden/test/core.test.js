import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../src/core/index.js';
import { ZONES, QUESTS, SKILLS } from '../src/data/index.js';

test('新开档的数值合理', () => {
  for (const cls of ['cat', 'fox', 'rabbit']) {
    const s = C.newGame(cls), st = C.heroStats(s);
    assert.equal(s.v, 3); assert.equal(s.hero.hp, st.hp); assert.ok(st.hp > 50);
    assert.equal(Object.keys(s.hero.skills).length, 1); assert.equal(s.party.length, 2);
  }
});

test('旧存档 rpg.v1 迁移到 v3 不丢东西', () => {
  const v1 = { v: 1, cls: 'cat', lv: 7, xp: 30, attr: { str: 14, vit: 9, int: 3, agi: 11 }, points: 2, gold: 345, hp: 80, mp: 20,
    gear: { weapon: { slot: 'weapon', name: '结实的溪石刃', icon: 'x', tier: 2, rare: 1, st: { atk: 16, mag: 16 }, price: 53, plus: 2, base: { atk: 14, mag: 14 } }, armor: null, charm: null },
    bag: [{ slot: 'charm', name: '水滴坠', icon: 'y', tier: 2, rare: 0, st: { spd: 7, hp: 21 }, price: 46 }], items: { pill: 4, dew: 2, seed: 1 },
    pets: [{ id: 'mudpig', lv: 5, xp: 3, hp: 60 }, { id: 'chirp', lv: 3, xp: 0, hp: 30 }], active: 1, zone: 'brook', unlocked: 2, quest: 3, qn: 2, qAccepted: true,
    bosses: { tusk: 1 }, seen: { chirp: 1, mudpig: 1, pincer: 1 }, kills: 41, autoBattle: true };
  const s = C.load(v1);
  assert.equal(s.v, 3); assert.equal(s.hero.lv, 7); assert.equal(s.hero.sp, 6); assert.deepEqual(s.hero.skills, { doubleClaw: 1, rend: 1 }); assert.equal(s.hero.pts, 2); assert.equal(s.wallet.gold, 345);
  assert.equal(s.hero.gear.weapon.plus, 2); assert.equal(s.hero.gear.weapon.icon, undefined);
  assert.equal(s.bag.gear.length, 1); assert.equal(s.pets.length, 2);
  assert.equal(C.activePet(s).id, 'chirp');
  assert.equal(s.world.dex.pincer, 'seen'); assert.equal(s.world.dex.mudpig, 'caught');
  assert.deepEqual(s.quests.main, { i: 3, accepted: true, n: 2 }); assert.equal(s.quests.done.length, 3);
  assert.equal(s.stats.kills, 41); assert.equal(s.settings.auto, true);
});

test('存档码可以导出再导入', () => {
  const s = C.newGame('rabbit'); s.wallet.gold = 777; C.addPet(s, 'chirp', 2);
  const back = C.importCode(C.exportCode(s));
  assert.deepEqual(back, s);
  assert.equal(C.importCode('乱写的'), null);
});

test('一场战斗能打完并结算', () => {
  C.seedRng(42);
  const s = C.newGame('cat'); s.world.zone = 'meadow'; s.quests.main.accepted = true;
  for (let n = 0; n < 30; n++) {
    const b = C.startBattle(s, C.makeEncounter(ZONES[1], 'chirp', false), false);
    C.play(b, s, null);
    for (let r = 0; r < 60 && !b.over; r++) C.play(b, s, C.autoHeroAction(b, s));
    assert.ok(b.over, '60 回合内应分出胜负');
    C.finishBattle(b, s); if (s.world.zone === 'home') { s.world.zone = 'meadow'; }
  }
  assert.ok(s.hero.lv > 1); assert.ok(s.stats.kills > 0);
  C.unseedRng();
});

test('委托能接、能完成、能领奖', () => {
  const s = C.newGame('fox'); C.acceptQuest(s); assert.equal(C.questDone(s), false);
  s.quests.main.n = QUESTS[0].n; assert.ok(C.questDone(s));
  const got = C.claimQuest(s); assert.ok(got.length > 0); assert.equal(s.quests.main.i, 1); assert.deepEqual(s.quests.done, ['q1']);
});

test('v2 存档升到 v3：补技能等级和技能点，出战位两个', () => {
  const v2 = C.newGame('fox'); v2.v = 2; delete v2.hero.skills; delete v2.hero.sp; v2.party = ['p1']; v2.hero.lv = 12;
  v2.pets = [{ uid: 'p1', id: 'chirp', lv: 3, xp: 0, hp: 20 }];
  const s = C.load(JSON.parse(JSON.stringify(v2)));
  assert.equal(s.v, 3); assert.equal(s.hero.sp, 11); assert.deepEqual(Object.keys(s.hero.skills), ['spark', 'flameRing', 'scorch']);
  assert.deepEqual(s.party, ['p1', null]); assert.equal(s.settings.speed, 1);
});

test('技能升级：每级 +8%，5 级质变', () => {
  const k1 = C.skillAt('doubleClaw', 1), k5 = C.skillAt('doubleClaw', 5), k10 = C.skillAt('doubleClaw', 10);
  assert.equal(k1.hits, 2); assert.equal(k5.hits, 3); assert.ok(k10.lastCrit);
  assert.ok(Math.abs(C.skillAt('spark', 3).power - SKILLS.spark.power * 1.16) < 0.01);
  const s = C.newGame('cat'); s.hero.sp = 2; assert.ok(C.raiseSkill(s, 'doubleClaw')); assert.equal(s.hero.skills.doubleClaw, 2);
  assert.equal(C.raiseSkill(s, 'rend'), false, '没学会的技能不能升');
});

test('行动条：快的单位出手更多', () => {
  C.seedRng(5);
  const s = C.newGame('cat'); s.hero.attr.agi = 60;
  const b = C.startBattle(s, [{ id: 'mudpig', lv: 1 }], false);
  const order = C.forecast(b, 12);
  assert.ok(order.filter(k => k === 'hero').length > order.filter(k => k === 'e0').length * 2);
  C.unseedRng();
});

test('元素：星雾互克，草水火三角', () => {
  assert.equal(C.elMul('star', 'mist')[0], 1.5); assert.equal(C.elMul('mist', 'star')[0], 1.5);
  assert.equal(C.elMul('fire', 'grass')[0], 1.5); assert.equal(C.elMul('grass', 'fire')[0], 0.67); assert.equal(C.elMul('none', 'fire')[0], 1);
});

test('首领：掉血换阶段、叫帮手，破绽满了倒地', () => {
  C.seedRng(9);
  const s = C.newGame('cat'); s.hero.lv = 6; s.world.zone = 'meadow';
  const b = C.startBattle(s, [{ id: 'tusk', lv: 6 }], true), boss = b.units.find(u => u.boss);
  C.play(b, s, null); boss.hp = Math.round(boss.st.hp * 0.62); boss.brk = 95;
  const ev = C.play(b, s, { type: 'attack', target: boss.key });
  const all = [...ev]; for (let i = 0; i < 6 && !b.over; i++) all.push(...C.play(b, s, { type: 'attack', target: boss.key }));
  assert.ok(all.some(e => e.t === 'break'), '应该打出破绽');
  assert.ok(all.some(e => e.t === 'phase'), '应该进入下一阶段');
  assert.ok(b.units.length > 2, '应该叫来帮手');
  C.unseedRng();
});

test('两只伙伴出战，默契满了能放连携技', () => {
  C.seedRng(11);
  const s = C.newGame('fox'); C.addPet(s, 'bubfish', 3); C.addPet(s, 'chirp', 3); C.addPet(s, 'mudpig', 3);
  assert.equal(C.activePets(s).length, 2);
  const b = C.startBattle(s, [{ id: 'mudpig', lv: 12 }], false);
  assert.equal(b.units.filter(u => u.side === 'a').length, 3);
  C.play(b, s, null); b.bond = C.BOND_MAX;
  assert.equal(C.comboFor(b, s).name, '蒸汽爆炸');
  const ev = C.play(b, s, { type: 'combo' });
  assert.ok(ev.some(e => e.t === 'act' && e.combo)); assert.ok(b.bond < C.BOND_MAX);
  // 换伙伴
  const bench = C.benchPets(b, s); assert.equal(bench.length, 1);
  if (!b.over && b.cur) { C.play(b, s, { type: 'swap', slot: 'p1', uid: bench[0].uid }); assert.ok(b.units.some(u => u.uid === bench[0].uid)); assert.ok(s.party.includes(bench[0].uid)); }
  C.unseedRng();
});

test('状态：冰冻跳过、灼烧叠层、睡眠挨打就醒', () => {
  C.seedRng(13);
  const s = C.newGame('rabbit'); const b = C.startBattle(s, [{ id: 'chirp', lv: 1 }], false), e = b.units[1];
  e.fx.freeze = 1; e.av = 999;
  const ev = C.play(b, s, null);
  assert.ok(ev.some(x => x.t === 'skip' && x.who === e.key && x.why === 'freeze'));
  C.unseedRng();
});
