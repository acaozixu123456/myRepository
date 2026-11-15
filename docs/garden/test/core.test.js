import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../src/core/index.js';
import { ZONES, QUESTS } from '../src/data/index.js';

test('新开档的数值合理', () => {
  for (const cls of ['cat', 'fox', 'rabbit']) {
    const s = C.newGame(cls), st = C.heroStats(s);
    assert.equal(s.v, 2); assert.equal(s.hero.hp, st.hp); assert.ok(st.hp > 50);
  }
});

test('旧存档 rpg.v1 迁移到 v2 不丢东西', () => {
  const v1 = { v: 1, cls: 'cat', lv: 7, xp: 30, attr: { str: 14, vit: 9, int: 3, agi: 11 }, points: 2, gold: 345, hp: 80, mp: 20,
    gear: { weapon: { slot: 'weapon', name: '结实的溪石刃', icon: 'x', tier: 2, rare: 1, st: { atk: 16, mag: 16 }, price: 53, plus: 2, base: { atk: 14, mag: 14 } }, armor: null, charm: null },
    bag: [{ slot: 'charm', name: '水滴坠', icon: 'y', tier: 2, rare: 0, st: { spd: 7, hp: 21 }, price: 46 }], items: { pill: 4, dew: 2, seed: 1 },
    pets: [{ id: 'mudpig', lv: 5, xp: 3, hp: 60 }, { id: 'chirp', lv: 3, xp: 0, hp: 30 }], active: 1, zone: 'brook', unlocked: 2, quest: 3, qn: 2, qAccepted: true,
    bosses: { tusk: 1 }, seen: { chirp: 1, mudpig: 1, pincer: 1 }, kills: 41, autoBattle: true };
  const s = C.load(v1);
  assert.equal(s.v, 2); assert.equal(s.hero.lv, 7); assert.equal(s.hero.pts, 2); assert.equal(s.wallet.gold, 345);
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
    for (let r = 0; r < 60 && !b.over; r++) C.runRound(b, s, C.autoHeroAction(b, s));
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
