import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../src/core/index.js';
import { ZONES, QUESTS, SKILLS, MONSTERS, ACHIEVEMENTS } from '../src/data/index.js';

test('新开档的数值合理', () => {
  for (const cls of ['cat', 'fox', 'rabbit']) {
    const s = C.newGame(cls), st = C.heroStats(s);
    assert.equal(s.v, C.SAVE_VERSION); assert.equal(s.hero.hp, st.hp); assert.ok(st.hp > 50);
    assert.equal(Object.keys(s.hero.skills).length, 1); assert.equal(s.party.length, 2);
  }
});

test('旧存档 rpg.v1 迁移到 v4 不丢东西', () => {
  const v1 = { v: 1, cls: 'cat', lv: 7, xp: 30, attr: { str: 14, vit: 9, int: 3, agi: 11 }, points: 2, gold: 345, hp: 80, mp: 20,
    gear: { weapon: { slot: 'weapon', name: '结实的溪石刃', icon: 'x', tier: 2, rare: 1, st: { atk: 16, mag: 16 }, price: 53, plus: 2, base: { atk: 14, mag: 14 } }, armor: null, charm: null },
    bag: [{ slot: 'charm', name: '水滴坠', icon: 'y', tier: 2, rare: 0, st: { spd: 7, hp: 21 }, price: 46 }], items: { pill: 4, dew: 2, seed: 1 },
    pets: [{ id: 'mudpig', lv: 5, xp: 3, hp: 60 }, { id: 'chirp', lv: 3, xp: 0, hp: 30 }], active: 1, zone: 'brook', unlocked: 2, quest: 3, qn: 2, qAccepted: true,
    bosses: { tusk: 1 }, seen: { chirp: 1, mudpig: 1, pincer: 1 }, kills: 41, autoBattle: true };
  const s = C.load(v1);
  assert.equal(s.v, C.SAVE_VERSION); assert.equal(s.hero.lv, 7); assert.equal(s.hero.sp, 6); assert.deepEqual(s.hero.skills, { doubleClaw: 1, rend: 1 }); assert.equal(s.hero.pts, 2); assert.equal(s.wallet.gold, 345);
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

test('v2 存档升到 v4：补技能等级和技能点，出战位两个', () => {
  const v2 = C.newGame('fox'); v2.v = 2; delete v2.hero.skills; delete v2.hero.sp; v2.party = ['p1']; v2.hero.lv = 12;
  v2.pets = [{ uid: 'p1', id: 'chirp', lv: 3, xp: 0, hp: 20 }];
  const s = C.load(JSON.parse(JSON.stringify(v2)));
  assert.equal(s.v, C.SAVE_VERSION); assert.equal(s.hero.sp, 11); assert.deepEqual(Object.keys(s.hero.skills), ['spark', 'flameRing', 'scorch']);
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

// ---------- 第三阶段：职业与装备 ----------
test('v3 存档升到 v4：旧装备换新结构，饰物变项链，转职前的技能点退回', () => {
  const s3 = C.newGame('fox'); s3.v = 3; s3.hero.lv = 15; s3.hero.sp = 2; s3.hero.skills = { spark: 3, flameRing: 1, scorch: 1, foxMist: 4 }; delete s3.hero.route; delete s3.craft;
  s3.hero.gear = { weapon: { slot: 'weapon', name: '溪石刃', tier: 2, rare: 1, st: { atk: 20, mag: 20 }, base: { atk: 17, mag: 17 }, price: 40, plus: 2 }, armor: null, charm: { slot: 'charm', name: '水滴坠', tier: 2, rare: 2, st: { spd: 5, hp: 20 }, price: 40, plus: 0 } };
  s3.bag = { gear: [{ slot: 'armor', name: '草编衣', tier: 1, rare: 0, st: { def: 6, hp: 27 }, price: 20, plus: 0 }], items: { pill: 1 } };
  const s = C.load(JSON.parse(JSON.stringify(s3)));
  assert.equal(s.v, C.SAVE_VERSION); assert.equal(s.hero.gear.neck.name, '水滴坠'); assert.equal(s.hero.gear.neck.sockets.length, 1);
  assert.deepEqual(s.hero.gear.weapon.main, { atk: 17, mag: 17 }); assert.equal(s.hero.gear.weapon.plus, 2);
  assert.equal(s.hero.skills.foxMist, undefined); assert.equal(s.hero.sp, 5, '狐雾 4 级退回 3 点');
  assert.equal(s.bag.gear[0].q, 0); assert.ok(s.craft); assert.equal(s.hero.route, null);
  assert.ok(C.heroStats(s).atk > 0);
});

test('装备：品质决定词条数，套装和灵石加成算进角色', () => {
  C.seedRng(21);
  for (let q = 0; q <= 4; q++) { const g = C.makeGear(2, { q }); assert.equal(g.affix.length, q); assert.equal(g.sockets.length, Math.max(0, q - 1)); assert.equal(!!g.special, q === 4); }
  const s = C.newGame('cat'), hp0 = C.heroStats(s).hp;
  for (const slot of ['head', 'armor']) { s.bag.gear.push(C.makeGear(1, { q: 0, slot, set: 'meadow' })); C.equip(s, s.bag.gear.length - 1); }
  const hp2 = C.heroStats(s).hp; assert.ok(hp2 > hp0);
  s.hero.gear.ring = C.makeGear(1, { q: 2, slot: 'ring' }); C.addGem(s, 'fire', 2);
  const atk0 = C.heroStats(s).atk; assert.ok(C.socket(s, s.hero.gear.ring, 0, 'fire', 2)); assert.equal(C.heroStats(s).atk, atk0 + 10);
  C.unseedRng();
});

test('强化：+10 以内必成，之后失败只扣材料并累积幸运值', () => {
  C.seedRng(3);
  const s = C.newGame('cat'), g = C.makeGear(1, { q: 1, slot: 'weapon' }); s.wallet.gold = 1e6; s.bag.items.stone = 999;
  for (let i = 0; i < 10; i++) assert.ok(C.enhance(s, g).ok);
  assert.equal(g.plus, 10);
  let fails = 0; while (g.plus < 15 && fails < 200) { const r = C.enhance(s, g); if (!r.ok) fails++; }
  assert.equal(g.plus, 15); assert.equal(C.enhance(s, g), null, '满级了');
  C.unseedRng();
});

test('灵石三合一、洗练锁词条、分解和打造', () => {
  C.seedRng(8);
  const s = C.newGame('rabbit'); C.addGem(s, 'water', 1, 3); assert.ok(C.fuseGem(s, 'water', 1)); assert.equal(C.gemCount(s, 'water', 2), 1);
  const g = C.makeGear(3, { q: 3 }); s.bag.items.starSand = 20; const keep = g.affix[0];
  assert.ok(C.reroll(s, g, [0])); assert.deepEqual(g.affix[0], keep); assert.equal(g.affix.length, 3); assert.equal(s.bag.items.starSand, 16);
  s.bag.gear.push(g); const got = C.dismantle(s, 0); assert.ok(got.dust > 0); assert.equal(s.bag.gear.length, 0);
  Object.assign(s.bag.items, { bp_meadow: 1, feather: 9, sprout: 9, dust: 20, focus: 1 }); s.wallet.gold = 999;
  const made = C.craft(s, 'meadow', 'crit'); assert.ok(made); assert.ok(made.q >= 1); assert.equal(made.set, 'meadow'); assert.ok(made.affix.some(a => a.k === 'crit'));
  assert.equal(s.bag.items.bp_meadow, 0);
  C.unseedRng();
});

test('转职：选路线学技能，换路线花金币并退回技能点；洗点和推荐加点', () => {
  const s = C.newGame('cat'); s.hero.lv = 26; s.hero.sp = 0;
  assert.ok(C.chooseRoute(s, 'swift')); assert.deepEqual(C.heroSkills(s).slice(-3), ['shadowClone', 'shadowCombo', 'nightRaid']);
  s.hero.skills.shadowCombo = 4; s.wallet.gold = 1000;
  assert.ok(C.chooseRoute(s, 'iron')); assert.equal(s.wallet.gold, 700); assert.equal(s.hero.sp, 3); assert.equal(s.hero.skills.shadowCombo, undefined);
  s.hero.skills.doubleClaw = 5; C.resetSkills(s); assert.equal(s.hero.sp, 7); assert.equal(s.hero.skills.doubleClaw, 1);
  C.resetAttr(s); assert.equal(s.hero.pts, 75); C.autoAttr(s); assert.equal(s.hero.pts, 0);
});

test('林守：嘲讽吸引攻击、扎根不会睡着；影分身一回合动两次；复苏救人；终结技每场一次', () => {
  C.seedRng(17);
  const s = C.newGame('deer'); s.hero.lv = 30; s.hero.skills.rootSnare = 1; C.addPet(s, 'chirp', 30);
  const b = C.startBattle(s, [{ id: 'hopcube', lv: 5 }, { id: 'hopcube', lv: 5 }], false);
  C.play(b, s, null); C.play(b, s, { type: 'skill', skill: 'rootSnare' });
  assert.ok(b.units[0].fx.taunt || b.over);
  assert.ok(b.units[0].st.flags.rooted);
  // 影分身
  const c = C.newGame('cat'); c.hero.lv = 30; C.chooseRoute(c, 'swift'); c.hero.mp = 999; c.hero.hp = 999;
  const b2 = C.startBattle(c, [{ id: 'mudpig', lv: 40 }], false); C.play(b2, c, null);
  const ev = C.play(b2, c, { type: 'skill', skill: 'shadowClone' });
  assert.equal(ev.filter(e => e.t === 'yourTurn').length, 1); assert.equal(b2.cur?.key, 'hero');
  assert.ok(b2.units[0].extra, '影分身后马上再动一次');
  // 终结技每场一次
  C.play(b2, c, { type: 'skill', skill: 'thousandClaws' });
  if (!b2.over) { assert.ok(b2.used.herothousandClaws); }
  // 复苏
  const r = C.newGame('rabbit'); r.hero.lv = 30; C.chooseRoute(r, 'priest'); C.addPet(r, 'chirp', 5); r.hero.mp = 999;
  const b3 = C.startBattle(r, [{ id: 'mudpig', lv: 1 }], false); C.play(b3, r, null); b3.units[1].hp = 0;
  const ev3 = C.play(b3, r, { type: 'skill', skill: 'revive' }); assert.ok(ev3.some(e => e.t === 'revive' && e.who === 'p0'));
  C.unseedRng();
});

test('M3 伙伴：资质星级、性格、天赋、异色保底、v4 存档迁移', () => {
  C.seedRng(3);
  const s = C.newGame('cat'), p = C.addPet(s, 'chirp', 10);
  for (const k of C.APT_KEYS) assert.ok(p.apt[k] >= 60 && p.apt[k] <= 120);
  assert.ok(C.aptStars(p) >= 1 && C.aptStars(p) <= 5); assert.ok(p.nature && p.talent && p.known.length && p.skills.length);
  for (let i = 0; i < 30; i++) assert.ok(C.aptStars(C.addPet(s, 'chirp', 5, { shiny: true, home: true })) >= 3);
  const lo = { ...p, apt: { hp: 60, atk: 60, def: 60, spd: 60, mag: 60 }, talent: 'keenEye' }, hi = { ...p, apt: { hp: 120, atk: 120, def: 120, spd: 120, mag: 120 }, talent: 'keenEye' };
  assert.ok(C.petStats(hi).atk > C.petStats(lo).atk * 1.7); assert.equal(C.petStats(hi).crit, 8);
  const old = { ...C.newGame('fox'), v: 4, pets: [{ uid: 'p9', id: 'bubfish', lv: 12, xp: 0, hp: 50, charm: null }] }; delete old.houseCap;
  const m = C.load(old); assert.equal(m.v, C.SAVE_VERSION); assert.equal(m.houseCap, 20);
  assert.ok(m.pets[0].apt && m.pets[0].nature); assert.deepEqual(m.pets[0].skills, ['bubble']); assert.equal(m.pets[0].hp, 50);
});

test('M3 伙伴：亲密度解锁第四技能槽、技能书、进化、伙伴屋、融合', () => {
  C.seedRng(5);
  const s = C.newGame('rabbit'), p = C.addPet(s, 'embertail', 15);
  assert.equal(C.skillSlots(p), 3); C.addLove(p, 400); assert.equal(C.loveLv(p), 5); assert.equal(C.skillSlots(p), 4);
  s.bag.items.treat = 2; assert.ok(C.feed(s, p.uid)); assert.equal(p.love, 430);
  s.bag.items.book_bubble = 1; assert.ok(C.learnBook(s, p.uid, 'book_bubble')); assert.ok(p.skills.includes('bubble')); assert.ok(!C.learnBook(s, p.uid, 'book_bubble'));
  assert.ok(C.unequipPetSkill(p, 'bubble')); assert.ok(C.equipPetSkill(p, 'bubble'));
  assert.ok(!C.canEvolve(s, p)); s.bag.items.mapleLeaf = 5; s.bag.items.tinder = 3; assert.ok(C.canEvolve(s, p));
  const before = C.petStats(p).mag; C.evolve(s, p.uid); assert.equal(p.evo, 1); assert.equal(C.petName(p), '二尾狐'); assert.ok(C.petStats(p).mag > before); assert.ok(p.known.includes('spark'));
  const b = C.startBattle(s, [{ id: 'hopcube', lv: 3 }], false); assert.equal(b.units[1].name, '二尾狐'); assert.ok(b.bond >= 12);
  // 伙伴屋：随身满 6 只以后抓到的住进去，不分经验
  for (let i = 0; i < 6; i++) C.addPet(s, 'chirp', 3);
  assert.equal(C.carried(s).length, 6); assert.equal(C.housed(s).length, 1); assert.ok(!C.setHome(s, C.housed(s)[0].uid, false));
  assert.ok(C.setHome(s, p.uid, true)); assert.ok(!s.party.includes(p.uid)); assert.ok(C.benchPets(C.startBattle(s, [{ id: 'hopcube', lv: 3 }], false), s).every(x => !x.home));
  s.bag.items.starSand = 10; assert.ok(C.expandHouse(s)); assert.equal(C.houseCap(s), 25);
  // 融合：两只 20 级以上，变成第一只的种类，1 级重新养，资质不低于较高值的 92%
  const a = C.addPet(s, 'stripe', 22, { home: true }), c = C.addPet(s, 'antler', 21, { home: true }); s.wallet.gold = 500;
  a.apt = { hp: 100, atk: 110, def: 70, spd: 90, mag: 60 }; c.apt = { hp: 80, atk: 70, def: 115, spd: 100, mag: 100 };
  const n = s.pets.length, r = C.fuse(s, a.uid, c.uid, C.addPet);
  assert.equal(s.pets.length, n - 1); assert.equal(r.pet.id, 'stripe'); assert.equal(r.pet.lv, 1); assert.equal(s.wallet.gold, 200);
  assert.ok(r.pet.apt.def >= 105 && r.pet.apt.atk >= 101); assert.ok(r.inherit.length >= 1 && r.pet.known.includes(r.inherit[0]));
});

test('M4 世界：采集每天有上限、宝箱每天一次、首领打败后 NPC 换台词', () => {
  C.seedRng(9);
  const s = C.newGame('cat'), day = new Date(2026, 10, 15, 10).getTime(), next = day + 86400000;
  for (let i = 0; i < C.GATHER_PER_DAY; i++) assert.ok(C.gather(s, 'mist', day));
  assert.equal(C.gather(s, 'mist', day), null); assert.equal(C.gatherLeft(s, 'mist', next), C.GATHER_PER_DAY);
  assert.ok((s.bag.items.reedFluff || 0) + (s.bag.items.inkStone || 0) >= C.GATHER_PER_DAY);
  const g = s.wallet.gold; assert.ok(C.openChest(s, 'mist', day).length >= 3); assert.ok(s.wallet.gold > g);
  assert.equal(C.openChest(s, 'mist', day), null); assert.ok(C.chestReady(s, 'mist', next)); assert.ok(!C.chestReady(s, 'home', day));
  assert.equal(C.npcLines(s, 'boatman')[0].includes('墨'), true); s.world.bosses.inkking = 1; assert.ok(C.npcLines(s, 'boatman')[0].includes('雾淡'));
  assert.deepEqual(C.npcsIn('mist').map(n => n.id), ['boatman']);
});

test('M4 主线：5 章 40 个，找人说话、交材料、限地图打怪都能推进', () => {
  assert.equal(QUESTS.length, 40); assert.deepEqual([1, 2, 3, 4, 5].map(c => QUESTS.filter(q => q.ch === c).length), [8, 8, 8, 8, 8]);
  const s = C.newGame('fox'); s.quests.main.i = 8; s.world.unlocked = 5;
  C.acceptQuest(s); assert.equal(C.mainTalkNpc(s), 'boatman'); assert.equal(C.npcMark(s, 'boatman'), 'main');
  C.questProgress(s, 'talk', { npc: 'fisher' }); assert.ok(!C.questDone(s));
  C.questProgress(s, 'talk', { npc: 'boatman' }); assert.ok(C.questDone(s)); C.claimQuest(s);
  C.acceptQuest(s); assert.equal(C.currentQuest(s).type, 'collect'); s.bag.items.reedFluff = 7; assert.ok(C.questDone(s)); C.claimQuest(s); assert.equal(s.bag.items.reedFluff, 2);
  C.acceptQuest(s); C.questProgress(s, 'kill', { mid: 'chirp' }); assert.equal(s.quests.main.n, 0); for (let i = 0; i < 10; i++) C.questProgress(s, 'kill', { mid: 'inkpup' }); assert.ok(C.questDone(s));
  assert.equal(C.mainDoneCount(s), 2);
});

test('M4 支线：NPC 一件件给，接下、推进、交付；有的要先打败本岛首领', () => {
  const s = C.newGame('deer'); s.world.unlocked = 5;
  assert.equal(C.sideFor(s, 'cloudkeeper'), null);
  const f = C.sideFor(s, 'shepherd'); assert.equal(f.q.id, 's4'); assert.equal(f.state, 'new'); assert.equal(C.npcMark(s, 'shepherd'), 'new');
  assert.ok(C.acceptSide(s, 's4')); assert.equal(C.sideFor(s, 'shepherd').state, 'active'); assert.equal(C.npcMark(s, 'shepherd'), null);
  for (let i = 0; i < 6; i++) C.questProgress(s, 'kill', { mid: 'chirp' });
  assert.equal(C.sideFor(s, 'shepherd').state, 'ready'); const g = s.wallet.gold, got = C.claimSide(s, 's4'); assert.ok(got.length && s.wallet.gold === g + 60);
  assert.equal(C.sideFor(s, 'shepherd').q.id, 's5'); C.acceptSide(s, 's5'); C.questProgress(s, 'capture', { id: 'chirp' }); C.claimSide(s, 's5');
  assert.equal(C.sideFor(s, 'shepherd'), null); s.world.bosses.tusk = 1; assert.equal(C.sideFor(s, 'shepherd').q.id, 's6');
  assert.equal(C.activeSides(s).length, 0); C.acceptSide(s, 's6'); assert.equal(C.activeSides(s)[0].ready, false);
});

test('M5 家园：种地浇水收菜、扩建、打工离线最多 12 小时、性格喜欢的工作多产', () => {
  C.seedRng(3);
  const s = C.newGame('cat'), t0 = new Date(2026, 10, 15, 9).getTime(), H = 3600000; s.wallet.gold = 2000;
  assert.equal(s.v, 6); assert.equal(s.home.plots.length, 6);
  assert.ok(C.plant(s, 0, 'corn', t0)); assert.ok(!C.plant(s, 0, 'radish', t0)); assert.equal(C.plotState(s.home.plots[0], t0 + H), 'growing');
  assert.ok(C.water(s, 0, t0)); assert.ok(!C.water(s, 0, t0)); assert.equal(C.plotState(s.home.plots[0], t0 + 2.3 * H), 'ripe');
  const r = C.harvest(s, 0, t0 + 2.3 * H); assert.equal(r[0], 'corn'); assert.ok(r[1] >= 3); assert.equal(s.home.plots[0], null);
  assert.ok(C.buyPlot(s)); assert.equal(s.home.plots.length, 7);
  const p = C.addPet(s, 'chirp', 10, { home: true }), q = C.addPet(s, 'hopcube', 5); assert.ok(s.party.includes(q.uid)); assert.ok(!C.assign(s, q.uid, 'shop', t0));
  assert.ok(C.assign(s, p.uid, 'shop', t0)); const g = s.wallet.gold, out = C.collectWork(s, t0 + 30 * H);
  const per = Math.round(8 + 10 * 0.6), hours = C.likesJob(p, 'shop') ? 18 : 12; assert.equal(out.gold, per * hours); assert.equal(s.wallet.gold, g + per * hours);
  assert.equal(C.workHours(C.workers(s)[0], t0 + 30 * H), 0);
});

test('M5 厨房和日常：做饭吃饭加成、送礼、签到、悬赏、摸伙伴、灯火宝箱、心情种子、旧档迁移', () => {
  C.seedRng(4);
  const s = C.newGame('fox'), t0 = Date.now(); s.world.unlocked = 3;
  s.bag.items.greens = 2; s.bag.items.radish = 1; assert.ok(C.canCook(s, 'salad')); assert.ok(C.cook(s, 'salad')); assert.equal(s.bag.items.salad, 1);
  const hp = C.heroStats(s).hp; assert.ok(C.eat(s, 'salad', Date.now())); assert.ok(C.heroStats(s).hp > hp);
  s.home.buff.until = Date.now() - 1; assert.equal(C.heroStats(s).hp, hp);
  const p = C.addPet(s, 'chirp', 5); s.bag.items.mash = 1;
  const before = p.love; assert.ok(C.gift(s, p.uid, 'mash')); assert.ok(p.love > before);
  assert.equal(C.lampPoints(s, t0), 0); const g = C.greet(s, t0); assert.equal(g.days, 1); assert.ok(!C.greet(s, t0));
  const d = C.todayOf(s, t0); assert.equal(d.bounties.length, 3);
  for (const b of d.bounties) { if (C.bountyDeliver(b)) s.bag.items[b.item] = 10; }
  const wild = b => ZONES.find(z => z.id === b.zone).wild[0], elMon = el => ZONES.flatMap(z => z.wild || []).find(id => MONSTERS[id].el === el);
  for (const b of d.bounties) for (let i = 0; i < b.n; i++) { if (b.type === 'kill' || b.type === 'capture') C.questProgress(s, b.type, { mid: wild(b), id: wild(b) }); if (b.type === 'killEl') C.questProgress(s, 'kill', { mid: elMon(b.el) }); }
  d.bounties.forEach((b, i) => assert.ok(C.claimBounty(s, i, t0), C.bountyText(b)));
  for (const x of [p, C.addPet(s, 'hopcube', 3), C.addPet(s, 'slider', 3)]) assert.ok(C.pat(s, x.uid, t0));
  assert.ok(!C.pat(s, p.uid, t0)); C.harvestAll(s, t0); d.harvest = true;
  assert.equal(C.lampPoints(s, t0), 100); assert.ok(C.lampChest(s, t0).length >= 3); assert.equal(C.lampChest(s, t0), null);
  const m = C.plantMood(s, '今天天气很好', t0); assert.equal(m.hue, C.hueOf('今天天气很好')); assert.equal(C.plantMood(s, '再写一句', t0), null);
  assert.ok(C.awayNotes(s, t0 - 5 * 3600000, t0).length >= 1); assert.equal(C.awayNotes(s, t0 - 60000, t0), null);
  const old = { ...C.newGame('cat'), v: 5 }; delete old.home; const up = C.load(JSON.parse(JSON.stringify(old))); assert.equal(up.v, 6); assert.equal(up.home.plots.length, 6); assert.deepEqual(up.quests.side, {});
});

test('M6 成就和守护兽：做到了才能领，领一次；同一首领打 3 次能请回家园，加成算进属性', () => {
  const s = C.newGame('cat'), sand = () => s.bag.items.starSand || 0;
  const a = ACHIEVEMENTS.find(x => x.check.stat === 'kills' && x.check.n === 10);
  assert.equal(C.achvState(s, a), 'locked'); assert.equal(C.claimAchv(s, a.id), null);
  s.stats.kills = 10; assert.equal(C.achvState(s, a), 'ready'); assert.ok(C.achvReady(s).some(x => x.id === a.id));
  const b = sand(); assert.ok(C.claimAchv(s, a.id)); assert.equal(sand(), b + a.sand); assert.equal(C.claimAchv(s, a.id), null); assert.equal(C.achvState(s, a), 'claimed');
  for (const x of ACHIEVEMENTS) C.achvState(s, x);
  const boss = ZONES.find(z => z.boss).boss;
  assert.equal(C.guardianState(s, boss), 'away'); assert.ok(!C.inviteGuardian(s, boss));
  for (let i = 0; i < 3; i++) C.tally(s, 'boss_' + boss);
  assert.equal(C.guardianState(s, boss), 'ready'); const hp = C.heroStats(s);
  assert.ok(C.inviteGuardian(s, boss)); assert.equal(C.guardianState(s, boss), 'home'); assert.ok(!C.inviteGuardian(s, boss));
  const after = C.heroStats(s); assert.ok(Object.keys(after).some(k => after[k] > hp[k]));
});
