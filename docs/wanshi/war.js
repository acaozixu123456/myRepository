/* 万世洞天 · 征战诸天
 * 每一世走完，化作一张前世卡。五张卡上阵，自动和诸天的妖魔交手，一关一关往上打；
 * 不打的时候也在挂机，攒修为和灵气（给洞天）。修为用来提升魂魄的境界：魂魄是历经万世不变的那个你，
 * 境界多高，上阵的前世卡就按多少级出战（不超过每张卡自己的上限），所以新投出来的好卡能立刻换上去。
 * 每打通一重天，得一张天命符，下一次转轮回盘用上它，至少投个上品。
 * 这里只有规则和数值，没有界面；可以在 Node 里加载做模拟。
 */
(function (root) {
  'use strict';
  const WS = root.WS = root.WS || {};

  const CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  WS.cnNum = function (n) {
    if (n <= 10) return CN[n];
    if (n < 20) return '十' + CN[n - 10];
    const t = Math.floor(n / 10), o = n % 10;
    return CN[t] + '十' + (o ? CN[o] : '');
  };

  // ---------- 数值 ----------
  const W = WS.WAR = {
    slots: 5,
    front: 2,      // 前两个位置是前排，敌人的近身攻击先打前排
    // 四种打法：蚂蚁守前排，狐狸放法术，凡人按这一世走的路当将帅或谋士
    classes: {
      guard: { name: '守', role: '前排坦克', hp: 180, atk: 30, def: 20, spd: 85 },
      mage: { name: '术', role: '后排法术', hp: 110, atk: 48, def: 8, spd: 115 },
      wu: { name: '将', role: '前排猛攻', hp: 150, atk: 40, def: 14, spd: 100 },
      wen: { name: '谋', role: '后排治疗', hp: 125, atk: 34, def: 10, spd: 105 },
    },
    tierMult: [1, 1.3, 1.7, 2.3, 3.2],   // 品级越高，卡越强
    tierCap: [40, 50, 60, 80, 100],      // 每张卡能发挥到的等级上限；这一世达成的目标越多，上限再高一些
    rankStep: 0.12,                      // 每达成一个目标，属性 +12%
    featStep: 0.005,                     // 洞天里每一级东西，全体属性 +0.5%
    lvGrowth: 1.06,                      // 每升一级属性 ×1.06
    cost: { base: 250, growth: 1.12 },   // 魂魄每升一级要的修为
    startXw: 300,                        // 第一张卡出来时送的修为，先升一级试试
    idle: { xw: 1, growth: 1.05, lq: 0.03 }, // 挂机：每秒修为（每过一关 ×1.05）、每过一关每秒多少灵气
    foe: { base: 1.2, growth: 1.085, boss: { hp: 3, atk: 1.4, def: 1.2 } }, // 敌人每关强 8.5%
    clearSec: 30, // 首次打通一关，奖励相当于这么多秒的挂机修为
    rounds: 20,
    energy: { act: 35, hit: 10, full: 100 },
    heavens: 33,
    // 卡的称号，按这一世达成到第几个目标
    titles: {
      ant: ['工蚁', '蚁兵', '蚁卫', '蚁将', '蚁帅', '蚁王', '蚁皇', '蚁圣', '蚁祖'],
      fox: ['山狐', '二尾狐', '三尾狐', '四尾狐', '五尾狐', '六尾狐', '七尾狐', '八尾狐', '九尾天狐'],
      wu: ['村夫', '乡勇', '庄主', '家主', '镇守', '诸侯'],
      wen: ['书童', '童生', '秀才', '举人', '进士', '状元'],
    },
    // 同族一起上阵的加成（按人数）
    same: [0, 0, 0.08, 0.15, 0.22, 0.3],
    sameName: { ant: '蚁群同心', fox: '狐族同修', human: '同乡同心' },
    allThree: 0.1, // 蚂蚁、狐狸、凡人都在阵中：全体攻击 +10%
    // 诸天：九种地界轮着来，每一重天十关，第十关是首领
    realms: [
      { name: '山野', foes: [['豺狼', 'wu', '群狼撕咬'], ['野猪', 'guard', '横冲直撞'], ['山魈', 'mage', '怪啸']], boss: ['白额虎', 'wu', '虎啸山林'] },
      { name: '幽冥', foes: [['游魂', 'mage', '鬼火'], ['吊死鬼', 'wen', '阴气回流'], ['牛头', 'guard', '铁叉横扫']], boss: ['判官', 'mage', '勾魂笔'] },
      { name: '妖山', foes: [['蛇妖', 'mage', '毒雾'], ['树妖', 'guard', '盘根错节'], ['蝎子精', 'wu', '倒马毒桩']], boss: ['黑熊精', 'guard', '熊罴之力'] },
      { name: '四海', foes: [['虾兵', 'wu', '长枪突刺'], ['蟹将', 'guard', '铁钳'], ['夜叉', 'mage', '翻江']], boss: ['龙太子', 'mage', '龙吟'] },
      { name: '昆仑', foes: [['青鸾', 'wen', '青鸾衔药'], ['白鹿', 'wen', '鹿鸣'], ['陆吾', 'wu', '九尾横扫']], boss: ['开明兽', 'guard', '九首镇关'] },
      { name: '炎域', foes: [['火鸦', 'mage', '流火'], ['赤蛇', 'wu', '赤焰缠身'], ['火灵', 'mage', '焚身']], boss: ['祝融之影', 'mage', '燎原'] },
      { name: '雷泽', foes: [['雷兽', 'wu', '奔雷'], ['夔', 'guard', '夔鼓'], ['电母侍', 'mage', '掣电']], boss: ['雷公', 'mage', '五雷轰顶'] },
      { name: '天庭', foes: [['天兵', 'wu', '天罗阵'], ['力士', 'guard', '金刚不坏'], ['巡天神将', 'wu', '巡天']], boss: ['天门守将', 'wu', '镇守天门'] },
      { name: '混沌', foes: [['穷奇', 'wu', '噬人'], ['梼杌', 'guard', '顽石之躯'], ['饕餮', 'mage', '吞天']], boss: ['混沌', 'guard', '鸿蒙未判'] },
    ],
  };

  // 可复现的随机数：同一个种子打出同一场仗
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  WS.rng = rng;

  // ---------- 前世卡 ----------
  WS.makeCard = function (no, form, tier, best, merit) {
    const F = WS.FORMS[form];
    const rank = best ? F.milestones.findIndex(m => m.name === best) : -1;
    const ms = rank >= 0 ? F.milestones[rank] : null;
    const cls = form === 'ant' ? 'guard' : form === 'fox' ? 'mage' : (ms && ms.stat === 'wen' ? 'wen' : 'wu');
    return { id: no, no, form, tier, rank, cls, best: ms ? best : null, merit: merit || 0 };
  };

  WS.cardTitle = function (c) {
    if (c.form !== 'human') return W.titles[c.form][Math.min(c.rank + 1, W.titles[c.form].length - 1)];
    const stat = c.cls === 'wen' ? 'wen' : 'people';
    const track = WS.FORMS.human.milestones.filter(m => m.stat === stat);
    const k = c.best ? track.findIndex(m => m.name === c.best) + 1 : 0;
    return W.titles[c.cls][Math.max(0, k)];
  };

  // 技能：名字和强弱都看这一世走到了哪一步
  WS.skillFor = function (cls, rank, title) {
    const r = rank + 1;
    if (cls === 'guard') {
      const name = r < 3 ? '蚁潮' : r < 6 ? '蚁海' : '万蚁噬天';
      const mult = 0.5 + 0.05 * r, heal = 0.12;
      return { name, mult, heal, desc: `打全体敌人，每个 ${Math.round(mult * 100)}% 攻击；自己回 ${Math.round(heal * 100)}% 生命` };
    }
    if (cls === 'mage') {
      const tails = Math.max(1, rank + 2);
      const name = tails >= 9 ? '九尾天狐火' : tails >= 6 ? '幽冥狐火' : '狐火';
      const mult = 1 + 0.06 * tails, charm = Math.min(0.54, 0.06 * tails);
      return { name, mult, charm, desc: `打随机三个敌人，每个 ${Math.round(mult * 100)}% 攻击，${Math.round(charm * 100)}% 机会魅惑（下回合不能动）` };
    }
    if (cls === 'wu') {
      const name = title === '诸侯' ? '号令诸侯' : '振臂一呼';
      const mult = 1.7 + 0.05 * r, buff = 0.15 + 0.01 * r;
      return { name, mult, buff, desc: `重击前排 ${Math.round(mult * 100)}% 攻击，全队攻击 +${Math.round(buff * 100)}% 到下回合结束` };
    }
    const name = title === '状元' ? '文曲星照' : '妙笔回春';
    const mult = 0.6 + 0.05 * r;
    return { name, mult, desc: `给全队每人回 ${Math.round(mult * 100)}% 攻击的生命，并解除魅惑` };
  };
  WS.cardSkill = c => WS.skillFor(c.cls, c.rank, WS.cardTitle(c));

  WS.cardCap = c => W.tierCap[c.tier] + 2 * (c.rank + 1);
  WS.cardLv = (state, c) => Math.min(state.war.lv, WS.cardCap(c));
  WS.maxCap = () => W.tierCap[W.tierCap.length - 1] + 2 * 10;
  WS.lvCost = state => Math.round(W.cost.base * Math.pow(W.cost.growth, state.war.lv - 1));

  WS.cardStats = function (state, c) {
    const C = W.classes[c.cls];
    const k = W.tierMult[c.tier] * (1 + W.rankStep * (c.rank + 1)) * Math.pow(W.lvGrowth, WS.cardLv(state, c) - 1) * (1 + W.featStep * WS.totalFeat(state));
    return { hp: C.hp * k, atk: C.atk * k, def: C.def * k, spd: C.spd + 3 * c.tier };
  };
  const power = s => Math.round(s.hp * 0.5 + s.atk * 5 + s.def * 3 + s.spd);
  WS.unitPower = u => power({ hp: u.maxHp, atk: u.atk, def: u.def, spd: u.spd });
  WS.cardPower = (state, c) => power(WS.cardStats(state, c));

  WS.findCard = (state, id) => (id == null ? null : state.cards.find(c => c.id === id) || null);
  WS.teamCards = state => state.war.team.map(id => WS.findCard(state, id));

  // 打完一世：留下一张卡；阵里有空位就自动补上
  // 卡的 id 必须唯一（正常就是第几世；万一撞了就往后排）
  function pushCard(cards, c) {
    if (cards.some(x => x.id === c.id)) c.id = cards.reduce((m, x) => Math.max(m, x.id), 0) + 1;
    cards.push(c);
    return c;
  }

  WS.addCard = function (state, L, summary) {
    const c = pushCard(state.cards, WS.makeCard(summary.no, L.form, L.tier, summary.best, summary.merit));
    if (state.cards.length === 1) state.war.xw += W.startXw;
    const team = state.war.team;
    const front = c.cls === 'guard' || c.cls === 'wu';
    let slot = -1;
    for (let i = 0; i < W.slots; i++) {
      if (team[i] != null) continue;
      if (slot < 0) slot = i;
      if ((i < W.front) === front) { slot = i; break; }
    }
    if (slot >= 0) team[slot] = c.id;
    return c;
  };

  // 新卡比阵中最弱的那张强吗？强就返回那张卡所在的位置
  WS.swapSlotFor = function (state, c) {
    const team = state.war.team;
    if (team.indexOf(c.id) >= 0) return -1;
    const p = WS.cardPower(state, c);
    let slot = -1, low = p;
    team.forEach((id, i) => {
      const t = WS.findCard(state, id);
      if (!t) return;
      const q = WS.cardPower(state, t);
      if (q < low) { low = q; slot = i; }
    });
    return slot;
  };

  // 一键上阵：挑最强的五张，守和将站前排
  WS.autoTeam = function (state) {
    const pool = state.cards.slice().sort((a, b) => WS.cardPower(state, b) - WS.cardPower(state, a)).slice(0, W.slots);
    const isFront = c => c.cls === 'guard' || c.cls === 'wu';
    const fr = pool.filter(isFront).sort((a, b) => WS.cardStats(state, b).hp - WS.cardStats(state, a).hp);
    const bk = pool.filter(c => !isFront(c));
    const front = fr.slice(0, W.front);
    const rest = fr.slice(W.front).concat(bk);
    while (front.length < W.front && rest.length) front.push(rest.pop());
    const team = front.concat(rest);
    state.war.team = Array.from({ length: W.slots }, (_, i) => (team[i] ? team[i].id : null));
    // 只有一两张卡时，让它们都站前排
    return state.war.team;
  };

  WS.synergy = function (cards) {
    const cnt = { ant: 0, fox: 0, human: 0 };
    cards.forEach(c => { if (c) cnt[c.form]++; });
    const list = [];
    for (const f of WS.FORM_ORDER) {
      if (cnt[f] >= 2) list.push({ form: f, n: cnt[f], pct: W.same[Math.min(cnt[f], 5)], name: W.sameName[f] });
    }
    const all = cnt.ant > 0 && cnt.fox > 0 && cnt.human > 0;
    return { list, all, cnt };
  };

  // ---------- 关卡 ----------
  WS.stageInfo = function (s) {
    const h = Math.ceil(s / 10), sub = ((s - 1) % 10) + 1;
    const realm = W.realms[(h - 1) % W.realms.length];
    return { s, h, sub, realm, boss: sub === 10, heaven: WS.cnNum(h) + '重天', name: `${WS.cnNum(h)}重天 · ${realm.name}`, label: `${h}-${sub}` };
  };

  function foeUnit(def, m, boss, slot) {
    const C = W.classes[def[1]];
    const B = boss ? W.foe.boss : { hp: 1, atk: 1, def: 1 };
    return {
      side: 1, slot, name: def[0], glyph: def[0][0], cls: def[1], boss: !!boss,
      maxHp: C.hp * m * B.hp, atk: C.atk * m * B.atk, def: C.def * m * B.def, spd: C.spd,
      en0: boss ? 50 : 0,
      skill: Object.assign({}, WS.skillFor(def[1], boss ? 4 : 1, ''), { name: def[2] }),
    };
  }

  WS.stageFoes = function (s) {
    const info = WS.stageInfo(s);
    const R = rng(Math.imul(s, 2654435761));
    const n = s <= 2 ? s : s <= 5 ? 3 : s <= 9 ? 4 : 5;
    const m = W.foe.base * Math.pow(W.foe.growth, s - 1);
    const defs = [];
    if (info.boss) defs.push([info.realm.boss, true]);
    while (defs.length < n) defs.push([info.realm.foes[Math.floor(R() * info.realm.foes.length)], false]);
    // 守和将站前排，其余在后排
    const isFront = d => d[0][1] === 'guard' || d[0][1] === 'wu';
    const fr = defs.filter(isFront), bk = defs.filter(d => !isFront(d));
    const front = fr.slice(0, W.front);
    const rest = fr.slice(W.front).concat(bk);
    while (front.length < Math.min(W.front, defs.length) && rest.length) front.push(rest.shift());
    return front.concat(rest).map((d, i) => foeUnit(d[0], m, d[1], i));
  };
  WS.teamPower = units => units.reduce((a, u) => a + WS.unitPower(u), 0);

  // 我方的五张卡变成上场的单位，算上羁绊
  WS.teamUnits = function (state) {
    const cards = WS.teamCards(state);
    const syn = WS.synergy(cards);
    const units = [];
    cards.forEach((c, slot) => {
      if (!c) return;
      const st = WS.cardStats(state, c);
      const same = (syn.list.find(x => x.form === c.form) || { pct: 0 }).pct;
      const atkBonus = 1 + same + (syn.all ? W.allThree : 0);
      units.push({
        side: 0, slot, name: WS.cardTitle(c), glyph: WS.FORMS[c.form].glyph, cls: c.cls, tier: c.tier, card: c.id,
        maxHp: st.hp * (1 + same), atk: st.atk * atkBonus, def: st.def, spd: st.spd,
        en0: 15 * c.tier, skill: WS.cardSkill(c),
      });
    });
    return units;
  };

  // ---------- 战斗 ----------
  // 回合制自动战斗：速度快的先动；攒满怒气放技能。返回胜负和一份战报，界面照着战报演出来
  WS.battle = function (A, B, seed) {
    const R = rng(seed);
    const U = A.concat(B).map((u, i) => Object.assign({}, u, { i, hp: u.maxHp, en: u.en0 || 0, charm: false, buff: 0, buffTo: -1, alive: true, front: u.slot < W.front }));
    const alive = s => U.filter(u => u.side === s && u.alive);
    const log = [];
    let round = 0, win = null;
    const atkOf = u => u.atk * (u.buffTo >= round ? 1 + u.buff : 1);

    function hit(u, t, mult, out) {
      const a = atkOf(u);
      const crit = R() < (u.cls === 'mage' ? 0.15 : 0.1);
      const dmg = Math.max(1, Math.round(mult * a * a / (a + t.def) * (crit ? 1.6 : 1) * (0.92 + R() * 0.16)));
      t.hp = Math.max(0, t.hp - dmg);
      const e = { u: t.i, dmg, hp: t.hp };
      if (crit) e.crit = 1;
      if (t.hp <= 0) { t.alive = false; e.dead = 1; } else t.en = Math.min(W.energy.full, t.en + W.energy.hit);
      out.push(e);
      return e;
    }
    function frontTarget(u) {
      const foes = alive(1 - u.side);
      const fr = foes.filter(f => f.front);
      const pool = fr.length ? fr : foes;
      return pool[Math.floor(R() * pool.length)];
    }
    function anyTarget(u) {
      const foes = alive(1 - u.side);
      return foes[Math.floor(R() * foes.length)];
    }
    function act(u) {
      const ev = { t: 'act', a: u.i, hits: [] };
      if (u.en >= W.energy.full) {
        u.en = 0;
        const S = u.skill;
        ev.skill = S.name;
        if (u.cls === 'guard') {
          for (const t of alive(1 - u.side)) hit(u, t, S.mult, ev.hits);
          const h = Math.round(u.maxHp * S.heal);
          u.hp = Math.min(u.maxHp, u.hp + h);
          ev.heals = [{ u: u.i, amt: h, hp: u.hp }];
        } else if (u.cls === 'mage') {
          const pool = alive(1 - u.side);
          for (let k = pool.length - 1; k > 0; k--) { const j = Math.floor(R() * (k + 1)); [pool[k], pool[j]] = [pool[j], pool[k]]; }
          for (const t of pool.slice(0, 3)) {
            const e = hit(u, t, S.mult, ev.hits);
            if (!e.dead && R() < S.charm) { t.charm = true; e.charm = 1; }
          }
        } else if (u.cls === 'wu') {
          hit(u, frontTarget(u), S.mult, ev.hits);
          for (const f of alive(u.side)) { f.buff = S.buff; f.buffTo = round + 1; }
          ev.buff = S.buff;
        } else {
          ev.heals = [];
          const amt = Math.round(atkOf(u) * S.mult);
          for (const f of alive(u.side)) {
            f.hp = Math.min(f.maxHp, f.hp + amt);
            f.charm = false;
            ev.heals.push({ u: f.i, amt, hp: f.hp });
          }
        }
      } else {
        const t = u.cls === 'mage' || u.cls === 'wen' ? anyTarget(u) : frontTarget(u);
        hit(u, t, u.cls === 'wen' ? 0.9 : 1, ev.hits);
        u.en = Math.min(W.energy.full, u.en + W.energy.act);
      }
      ev.en = u.en;
      log.push(ev);
    }

    while (round < W.rounds && win === null) {
      round++;
      log.push({ t: 'round', n: round });
      const order = U.filter(u => u.alive).sort((a, b) => b.spd - a.spd || a.i - b.i);
      for (const u of order) {
        if (!u.alive) continue;
        if (u.charm) { u.charm = false; log.push({ t: 'skip', a: u.i }); continue; }
        act(u);
        if (!alive(1).length) { win = true; break; }
        if (!alive(0).length) { win = false; break; }
      }
    }
    return {
      win: win === true,
      rounds: round,
      log,
      units: U.map(u => ({ i: u.i, side: u.side, slot: u.slot, front: u.front, name: u.name, glyph: u.glyph, cls: u.cls, tier: u.tier, boss: u.boss, card: u.card, maxHp: u.maxHp, atk: u.atk, def: u.def, spd: u.spd, en0: u.en0 || 0, skill: u.skill.name })),
      left: U.filter(u => u.side === 0 && u.alive).length,
    };
  };

  WS.fightStage = function (state, s) {
    const war = state.war;
    war.tries = (war.tries || 0) + 1;
    return WS.battle(WS.teamUnits(state), WS.stageFoes(s), Math.imul(s, 7919) + war.tries * 104729);
  };

  WS.firstClear = function (s) {
    return {
      xw: Math.round(W.idle.xw * Math.pow(W.idle.growth, s) * W.clearSec),
      lq: Math.round(15 + 4 * s),
      fate: s % 10 === 0 ? 1 : 0,
    };
  };

  // 赢了：记下进度，发首通奖励
  WS.winStage = function (state, s) {
    const war = state.war;
    if (s !== war.stage + 1) return null;
    war.stage = s;
    war.tries = 0;
    const r = WS.firstClear(s);
    war.xw += r.xw;
    state.lingqi += r.lq;
    state.lingqiTotal += r.lq;
    war.fate += r.fate;
    return r;
  };

  // ---------- 挂机 ----------
  WS.warUnlocked = state => !!(state.cards && state.cards.length);
  WS.idleRate = function (state) {
    const S = state.war.stage;
    return { xw: W.idle.xw * Math.pow(W.idle.growth, S), lq: W.idle.lq * S };
  };
  WS.warIdle = function (state, dt) {
    if (!WS.warUnlocked(state) || !(dt > 0)) return;
    const box = state.war.box;
    const cap = WS.offlineCapHours(state) * 3600;
    if (box.sec >= cap) return;
    const d = Math.min(dt, cap - box.sec);
    const r = WS.idleRate(state);
    box.xw += r.xw * d;
    box.lq += r.lq * d;
    box.sec += d;
  };
  WS.boxFull = state => state.war.box.sec >= WS.offlineCapHours(state) * 3600;
  WS.collectIdle = function (state) {
    const box = state.war.box;
    const got = { xw: Math.floor(box.xw), lq: Math.floor(box.lq), sec: box.sec };
    state.war.xw += got.xw;
    state.lingqi += got.lq;
    state.lingqiTotal += got.lq;
    box.xw -= got.xw;
    box.lq -= got.lq;
    box.sec = 0;
    return got;
  };

  // ---------- 养成：提升魂魄境界 ----------
  WS.levelUp = function (state, n) {
    const war = state.war;
    let k = 0;
    while (k < n && war.lv < WS.maxCap()) {
      const cost = WS.lvCost(state);
      if (war.xw < cost) break;
      war.xw -= cost;
      war.lv++;
      k++;
    }
    return k;
  };
  WS.realmName = function (lv) {
    const names = ['炼气', '筑基', '结丹', '元婴', '化神', '炼虚', '合体', '大乘', '渡劫', '真仙', '金仙', '大罗'];
    const i = Math.min(names.length - 1, Math.floor((lv - 1) / 10));
    return names[i] + '·' + WS.cnNum(((lv - 1) % 10) + 1) + '层';
  };

  // ---------- 存档 ----------
  WS.newWar = () => ({ stage: 0, lv: 1, team: [null, null, null, null, null], xw: 0, box: { xw: 0, lq: 0, sec: 0 }, fate: 0, useFate: true, tries: 0, seen: false });

  // 老存档：把轮回记录里的前世变成卡
  WS.warMigrate = function (s) {
    if (!Array.isArray(s.cards)) {
      s.cards = [];
      (s.history || []).slice().reverse().forEach(h => {
        if (WS.FORMS[h.form]) pushCard(s.cards, WS.makeCard(h.no, h.form, h.tier, h.best, h.merit));
      });
    }
    const base = WS.newWar();
    if (!s.war || typeof s.war !== 'object') s.war = base;
    for (const k of Object.keys(base)) if (s.war[k] === undefined) s.war[k] = base[k];
    if (!Array.isArray(s.war.team) || s.war.team.length !== W.slots) s.war.team = base.team.slice();
    s.war.team = s.war.team.map(id => (s.cards.some(c => c.id === id) ? id : null));
    if (s.cards.length && s.war.team.every(id => id == null)) WS.autoTeam(s);
    return s;
  };
})(typeof window !== 'undefined' ? window : globalThis);
