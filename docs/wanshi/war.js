/* 万世洞天 · 征战诸天
 * 每一世走完，化作一张前世卡。五张卡上阵，和诸天的妖魔交手，一关一关往上打；
 * 不打的时候也在挂机，攒修为、灵气，偶尔捡到法宝。修为用来提升魂魄的境界：魂魄是历经万世不变的那个你，
 * 境界多高，上阵的前世卡就按多少级出战（不超过每张卡自己的上限），所以新投出来的好卡能立刻换上去。
 * 战斗一步一步算：怒气满了可以亲手放大招，也可以交给自动；首领怒气满了会先蓄力一回合，
 * 这时用狐火、剑修或龙吟打断它，就能躲过那一下。
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
  const pct = v => Math.round(v * 100) + '%';

  // ---------- 数值 ----------
  const W = WS.WAR = {
    slots: 5,
    front: 2,      // 前两个位置是前排，敌人的近身攻击先打前排
    // 七种打法：蚂蚁守前排，狐狸放法术，凡人按这一世走的路当将帅或谋士，修士是剑修，龙在前排横扫，仙在后排护着大家
    classes: {
      guard: { name: '守', role: '前排坦克', hp: 180, atk: 30, def: 20, spd: 85 },
      mage: { name: '术', role: '后排法术', hp: 110, atk: 48, def: 8, spd: 115 },
      wu: { name: '将', role: '前排猛攻', hp: 150, atk: 40, def: 14, spd: 100 },
      wen: { name: '谋', role: '后排治疗', hp: 125, atk: 34, def: 10, spd: 105 },
      sword: { name: '剑', role: '后排斩首', hp: 112, atk: 52, def: 9, spd: 120 },
      dragon: { name: '龙', role: '前排横扫', hp: 190, atk: 38, def: 17, spd: 92 },
      xian: { name: '仙', role: '后排护佑', hp: 120, atk: 36, def: 11, spd: 108 },
    },
    frontCls: { guard: true, wu: true, dragon: true },
    formCls: { ant: 'guard', fox: 'mage', xiu: 'sword', dragon: 'dragon', xian: 'xian' },
    formMult: { ant: 1, fox: 1, human: 1, xiu: 1.06, dragon: 1.1, xian: 1.1 }, // 越难投到的生灵，底子越厚一点
    tierMult: [1, 1.3, 1.7, 2.3, 3.2],   // 品级越高，卡越强
    tierCap: [40, 50, 60, 80, 100],      // 每张卡能发挥到的等级上限；这一世达成的目标越多，上限再高一些
    rankStep: 0.12,                      // 每达成一个目标，属性 +12%
    featStep: 0.005,                     // 洞天里每一级东西，全体属性 +0.5%
    lvGrowth: 1.06,                      // 每升一级属性 ×1.06
    cost: { base: 250, growth: 1.12 },   // 魂魄每升一级要的修为
    startXw: 300,                        // 第一张卡出来时送的修为，先升一级试试
    idle: { xw: 1, growth: 1.05, lq: 0.03 }, // 挂机：每秒修为（每过一关 ×1.05）、每过一关每秒多少灵气
    // 敌人每关强 8.5%；首领血厚，怒气满了先蓄力一回合，再放出 ult 倍的大招
    foe: { base: 1.2, growth: 1.085, boss: { hp: 3, atk: 1.3, def: 1.2 }, ult: 1.7 },
    clearSec: 30, // 首次打通一关，奖励相当于这么多秒的挂机修为
    rounds: 20,
    energy: { act: 35, hit: 10, full: 100 },
    weak: 0.3,    // 蓄力中的首领破绽大开，受到的伤害 +30%
    heavens: 33,
    // 卡的称号，按这一世达成到第几个目标
    titles: {
      ant: ['工蚁', '蚁兵', '蚁卫', '蚁将', '蚁帅', '蚁王', '蚁皇', '蚁圣', '蚁祖'],
      fox: ['山狐', '二尾狐', '三尾狐', '四尾狐', '五尾狐', '六尾狐', '七尾狐', '八尾狐', '九尾天狐'],
      wu: ['村夫', '乡勇', '庄主', '家主', '镇守', '诸侯'],
      wen: ['书童', '童生', '秀才', '举人', '进士', '状元'],
      xiu: ['炼气弟子', '筑基修士', '金丹真人', '元婴真君', '化神尊者', '炼虚大能', '合体老祖', '大乘仙尊', '飞升真仙'],
      dragon: ['锦鲤', '蛟', '虬龙', '真龙', '腾云龙', '布雨龙王', '应龙', '烛龙', '祖龙'],
      xian: ['散仙', '地仙', '天仙', '真仙', '玄仙', '金仙', '太乙金仙', '大罗金仙', '道祖'],
    },
    // 同族一起上阵的加成（按人数）
    same: [0, 0, 0.08, 0.15, 0.22, 0.3],
    sameName: { ant: '蚁群同心', fox: '狐族同修', human: '同乡同心', xiu: '同门同修', dragon: '龙族同游', xian: '仙班同列' },
    // 阵中有几种不同的生灵：全体攻击加成
    mixed: [0, 0, 0, 0.1, 0.15, 0.2],
    mixedName: ['', '', '', '三道同行', '四方同心', '五世同堂'],
    // 诸天：九种地界轮着来，每一重天十关，第十关是首领
    realms: [
      { name: '山野', foes: [['豺狼', 'wu', '群狼撕咬'], ['野猪', 'guard', '横冲直撞'], ['山魈', 'mage', '怪啸']], boss: ['白额虎', 'wu', '虎啸山林'] },
      { name: '幽冥', foes: [['游魂', 'mage', '鬼火'], ['吊死鬼', 'wen', '阴气回流'], ['牛头', 'guard', '铁叉横扫']], boss: ['判官', 'mage', '勾魂笔'] },
      { name: '妖山', foes: [['蛇妖', 'mage', '毒雾'], ['树妖', 'guard', '盘根错节'], ['蝎子精', 'sword', '倒马毒桩']], boss: ['黑熊精', 'guard', '熊罴之力'] },
      { name: '四海', foes: [['虾兵', 'wu', '长枪突刺'], ['蟹将', 'guard', '铁钳'], ['夜叉', 'mage', '翻江']], boss: ['龙太子', 'dragon', '覆海'] },
      { name: '昆仑', foes: [['青鸾', 'xian', '青鸾衔药'], ['白鹿', 'wen', '鹿鸣'], ['陆吾', 'wu', '九尾横扫']], boss: ['开明兽', 'guard', '九首镇关'] },
      { name: '炎域', foes: [['火鸦', 'mage', '流火'], ['赤蛇', 'sword', '赤焰缠身'], ['火灵', 'mage', '焚身']], boss: ['祝融之影', 'mage', '燎原'] },
      { name: '雷泽', foes: [['雷兽', 'wu', '奔雷'], ['夔', 'guard', '夔鼓'], ['电母侍', 'mage', '掣电']], boss: ['雷公', 'sword', '五雷轰顶'] },
      { name: '天庭', foes: [['天兵', 'wu', '天罗阵'], ['力士', 'guard', '金刚不坏'], ['巡天神将', 'sword', '巡天']], boss: ['天门守将', 'wu', '镇守天门'] },
      { name: '混沌', foes: [['穷奇', 'sword', '噬人'], ['梼杌', 'guard', '顽石之躯'], ['饕餮', 'dragon', '吞天']], boss: ['混沌', 'dragon', '鸿蒙未判'] },
    ],
    // 法宝：打赢了掉，挂机也会捡到。每张卡带一件
    relic: {
      kinds: [
        { id: 'sword', name: '青锋剑', glyph: '剑', stat: 'atk', label: '攻击', base: 0.06, pct: true, scale: true },
        { id: 'armor', name: '玄龟甲', glyph: '甲', stat: 'hp', label: '生命', base: 0.08, pct: true, scale: true },
        { id: 'seal', name: '番天印', glyph: '印', stat: 'ult', label: '大招伤害', base: 0.1, pct: true, scale: true },
        { id: 'pearl', name: '定风珠', glyph: '珠', stat: 'en', label: '开场怒气', base: 12, cap: 60 },
        { id: 'bell', name: '摄魂铃', glyph: '铃', stat: 'eg', label: '攒怒气', base: 0.08, pct: true, cap: 0.6 },
        { id: 'mirror', name: '照妖镜', glyph: '镜', stat: 'crit', label: '暴击', base: 0.04, pct: true, cap: 0.4 },
        { id: 'gourd', name: '紫金葫芦', glyph: '葫', stat: 'leech', label: '吸血', base: 0.05, pct: true, cap: 0.4 },
        { id: 'parasol', name: '混元伞', glyph: '伞', stat: 'guard', label: '减伤', base: 0.04, pct: true, cap: 0.4 },
      ],
      tier: [1, 1.5, 2.2, 3.2, 4.5],
      weight: [50, 30, 14, 5, 1],
      perHeaven: 0.08, // 攻击、生命、大招伤害这三样，越高的天掉的越强
      cap: 40,         // 法宝囊最多装这么多，满了自动炼化最差的
      drop: 0.4,       // 首次打通一关掉法宝的机会；首领必掉，至少良品
      idleSec: 1200,   // 挂机每二十分钟捡到一件
      idleMax: 6,
    },
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
  WS.isFrontCls = cls => !!W.frontCls[cls];

  // ---------- 前世卡 ----------
  WS.makeCard = function (no, form, tier, best, merit) {
    const F = WS.FORMS[form];
    const rank = best ? F.milestones.findIndex(m => m.name === best) : -1;
    const ms = rank >= 0 ? F.milestones[rank] : null;
    const cls = W.formCls[form] || (ms && ms.stat === 'wen' ? 'wen' : 'wu');
    return { id: no, no, form, tier, rank, cls, best: ms ? best : null, merit: merit || 0, relic: null };
  };

  WS.cardTitle = function (c) {
    if (c.form !== 'human') {
      const T = W.titles[c.form];
      return T[Math.max(0, Math.min(c.rank + 1, T.length - 1))];
    }
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
      return { name, mult, heal, desc: `打全体敌人，每个 ${pct(mult)} 攻击；自己回 ${pct(heal)} 生命` };
    }
    if (cls === 'mage') {
      const tails = Math.max(1, rank + 2);
      const name = tails >= 9 ? '九尾天狐火' : tails >= 6 ? '幽冥狐火' : '狐火';
      const mult = 1 + 0.06 * tails, charm = Math.min(0.54, 0.06 * tails);
      return { name, mult, charm, desc: `烧三个敌人（蓄力的首领先烧，烧中就打断），每个 ${pct(mult)} 攻击，${pct(charm)} 机会魅惑（下回合不能动，首领减半）` };
    }
    if (cls === 'wu') {
      const name = title === '诸侯' ? '号令诸侯' : '振臂一呼';
      const mult = 1.7 + 0.05 * r, buff = 0.15 + 0.01 * r;
      return { name, mult, buff, desc: `重击前排 ${pct(mult)} 攻击，全队攻击 +${pct(buff)} 到下回合结束` };
    }
    if (cls === 'wen') {
      const name = title === '状元' ? '文曲星照' : '妙笔回春';
      const mult = 0.6 + 0.05 * r;
      return { name, mult, desc: `给全队每人回 ${pct(mult)} 攻击的生命，并解除魅惑` };
    }
    if (cls === 'sword') {
      const name = r < 3 ? '御剑' : r < 6 ? '剑气纵横' : '一剑开天';
      const mult = 2.3 + 0.1 * r;
      return { name, mult, desc: `一剑斩向最虚弱的敌人（蓄力的首领优先，斩中就打断），${pct(mult)} 攻击、无视一半防御；对方生命不到三成时再 ×1.5` };
    }
    if (cls === 'dragon') {
      const name = r < 3 ? '龙吟' : r < 6 ? '翻江倒海' : '烛照九幽';
      const mult = 0.7 + 0.05 * r, drain = 30 + 3 * r;
      return { name, mult, drain, desc: `打全体敌人，每个 ${pct(mult)} 攻击，再吸走每人 ${drain} 点怒气（首领泄了气，蓄力就断了）` };
    }
    const name = r < 3 ? '仙光护体' : r < 6 ? '回天返日' : '大罗天护';
    const shield = 1 + 0.08 * r, revive = 0.3 + 0.03 * r;
    return { name, shield, revive, desc: `有队友倒下就把他救回来（${pct(revive)} 生命，每场一次）；没人倒下就给全队加 ${pct(shield)} 攻击的护盾` };
  };
  WS.cardSkill = c => WS.skillFor(c.cls, c.rank, WS.cardTitle(c));

  WS.cardCap = c => W.tierCap[c.tier] + 2 * (c.rank + 1);
  WS.cardLv = (state, c) => Math.min(state.war.lv, WS.cardCap(c));
  WS.maxCap = () => W.tierCap[W.tierCap.length - 1] + 2 * 10;
  WS.lvCost = state => Math.round(W.cost.base * Math.pow(W.cost.growth, state.war.lv - 1));

  function baseStats(state, c) {
    const C = W.classes[c.cls];
    const k = W.tierMult[c.tier] * (W.formMult[c.form] || 1) * (1 + W.rankStep * (c.rank + 1)) *
      Math.pow(W.lvGrowth, WS.cardLv(state, c) - 1) * (1 + W.featStep * WS.totalFeat(state));
    return { hp: C.hp * k, atk: C.atk * k, def: C.def * k, spd: C.spd + 3 * c.tier, en: 15 * c.tier, crit: 0, leech: 0, ult: 0, guard: 0, eg: 0 };
  }
  function applyRelic(s, r) {
    const K = RK[r.k], v = WS.relicValue(r);
    if (K.stat === 'atk') s.atk *= 1 + v;
    else if (K.stat === 'hp') s.hp *= 1 + v;
    else s[K.stat] += v;
    return s;
  }
  WS.cardStats = function (state, c) {
    const s = baseStats(state, c);
    const r = WS.relicOf(state, c);
    return r ? applyRelic(s, r) : s;
  };
  // 战力：生命、攻击、防御、速度之外，暴击、吸血、大招伤害、减伤、开场怒气、攒怒气也折算进去
  const power = s => Math.round(s.hp * 0.5 + s.atk * 5 + s.def * 3 + s.spd +
    s.atk * 5 * (0.6 * (s.crit || 0) + 0.5 * (s.leech || 0) + 0.3 * (s.ult || 0) + 0.004 * (s.en || 0) + 0.5 * (s.eg || 0)) + s.hp * 0.6 * (s.guard || 0));
  WS.unitPower = u => power({ hp: u.maxHp, atk: u.atk, def: u.def, spd: u.spd, crit: u.crit, leech: u.leech, ult: u.ult, guard: u.guard, en: u.en0, eg: u.eg });
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
    const front = WS.isFrontCls(c.cls);
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

  // 一键上阵：挑最强的五张，守、将、龙站前排
  WS.autoTeam = function (state) {
    const pool = state.cards.slice().sort((a, b) => WS.cardPower(state, b) - WS.cardPower(state, a)).slice(0, W.slots);
    const isFront = c => WS.isFrontCls(c.cls);
    const fr = pool.filter(isFront).sort((a, b) => WS.cardStats(state, b).hp - WS.cardStats(state, a).hp);
    const bk = pool.filter(c => !isFront(c));
    const front = fr.slice(0, W.front);
    const rest = fr.slice(W.front).concat(bk);
    while (front.length < W.front && rest.length) front.push(rest.pop());
    const team = front.concat(rest);
    state.war.team = Array.from({ length: W.slots }, (_, i) => (team[i] ? team[i].id : null));
    return state.war.team;
  };

  WS.synergy = function (cards) {
    const cnt = {};
    WS.FORM_ORDER.forEach(f => { cnt[f] = 0; });
    cards.forEach(c => { if (c) cnt[c.form] = (cnt[c.form] || 0) + 1; });
    const list = [];
    for (const f of WS.FORM_ORDER) {
      if (cnt[f] >= 2) list.push({ form: f, n: cnt[f], pct: W.same[Math.min(cnt[f], 5)], name: W.sameName[f] });
    }
    const kinds = WS.FORM_ORDER.filter(f => cnt[f] > 0).length;
    const mix = W.mixed[Math.min(kinds, 5)];
    return { list, mix, mixName: mix ? W.mixedName[Math.min(kinds, 5)] : '', kinds, cnt };
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
    // 守、将、龙站前排，其余在后排
    const isFront = d => WS.isFrontCls(d[0][1]);
    const fr = defs.filter(isFront), bk = defs.filter(d => !isFront(d));
    const front = fr.slice(0, W.front);
    const rest = fr.slice(W.front).concat(bk);
    while (front.length < Math.min(W.front, defs.length) && rest.length) front.push(rest.shift());
    return front.concat(rest).map((d, i) => foeUnit(d[0], m, d[1], i));
  };
  WS.teamPower = units => units.reduce((a, u) => a + WS.unitPower(u), 0);

  // 我方的五张卡变成上场的单位，算上羁绊和法宝
  WS.teamUnits = function (state) {
    const cards = WS.teamCards(state);
    const syn = WS.synergy(cards);
    const units = [];
    cards.forEach((c, slot) => {
      if (!c) return;
      const st = WS.cardStats(state, c);
      const same = (syn.list.find(x => x.form === c.form) || { pct: 0 }).pct;
      const atkBonus = 1 + same + syn.mix;
      units.push({
        side: 0, slot, name: WS.cardTitle(c), glyph: WS.FORMS[c.form].glyph, cls: c.cls, tier: c.tier, card: c.id, form: c.form,
        maxHp: st.hp * (1 + same), atk: st.atk * atkBonus, def: st.def, spd: st.spd,
        en0: Math.min(W.energy.full, st.en), crit: st.crit, leech: st.leech, ult: st.ult, guard: st.guard, eg: st.eg,
        skill: WS.cardSkill(c),
      });
    });
    return units;
  };

  // ---------- 战斗 ----------
  // 一步一步算：battleNext 走下一个动作；怒气满的我方单位可以随时 battleCast 插进来放大招
  function mkUnit(u, i) {
    return Object.assign({}, u, {
      i, hp: u.maxHp, en: u.en0 || 0, charm: false, buff: 0, buffTo: -1, alive: true, front: u.slot < W.front,
      charging: false, shield: 0, revive: u.cls === 'xian' ? 1 : 0,
      crit: u.crit || 0, leech: u.leech || 0, ult: u.ult || 0, guard: u.guard || 0, eg: u.eg || 0,
    });
  }

  WS.battleNew = function (A, B, seed, opt) {
    return { R: rng(seed), U: A.concat(B).map(mkUnit), round: 0, order: null, oi: 0, done: false, win: false, auto: !(opt && opt.manual) };
  };

  const alive = (bs, side) => bs.U.filter(u => u.side === side && u.alive);
  const atkOf = (bs, u) => u.atk * (u.buffTo >= bs.round ? 1 + u.buff : 1);

  function heal(u, amt, ev) {
    amt = Math.round(amt);
    if (!u.alive || amt <= 0) return;
    u.hp = Math.min(u.maxHp, u.hp + amt);
    (ev.heals || (ev.heals = [])).push({ u: u.i, amt, hp: u.hp });
  }

  function hit(bs, u, t, mult, ev, o) {
    o = o || {};
    const a = atkOf(bs, u);
    const crit = bs.R() < (u.cls === 'mage' || u.cls === 'sword' ? 0.15 : 0.1) + u.crit;
    const def = t.def * (o.pierce ? 1 - o.pierce : 1);
    let dmg = mult * a * a / (a + def) * (crit ? 1.6 : 1) * (0.92 + bs.R() * 0.16);
    if (o.skill) dmg *= 1 + u.ult;
    if (t.charging) dmg *= 1 + W.weak;
    if (o.execute && t.hp < t.maxHp * 0.35) dmg *= 1.5;
    dmg = Math.max(1, Math.round(dmg * (1 - t.guard)));
    const e = { u: t.i, dmg };
    let left = dmg;
    if (t.shield > 0) {
      const ab = Math.min(t.shield, left);
      t.shield -= ab;
      left -= ab;
      e.ab = ab;
      e.sh = t.shield;
    }
    t.hp = Math.max(0, t.hp - left);
    e.hp = t.hp;
    if (crit) e.crit = 1;
    if (t.hp <= 0) { t.alive = false; t.charging = false; t.shield = 0; e.dead = 1; }
    else t.en = Math.min(W.energy.full, t.en + W.energy.hit * (1 + t.eg));
    ev.hits.push(e);
    if (u.leech > 0) heal(u, dmg * u.leech, ev);
    return e;
  }

  // 打断蓄力：首领泄了气，怒气退回三成
  function breakCharge(t, e) {
    if (!t.charging) return;
    t.charging = false;
    t.en = 30;
    e.broke = 1;
  }

  function frontTarget(bs, u) {
    const foes = alive(bs, 1 - u.side);
    const fr = foes.filter(f => f.front);
    const pool = fr.length ? fr : foes;
    return pool[Math.floor(bs.R() * pool.length)];
  }
  function anyTarget(bs, u) {
    const foes = alive(bs, 1 - u.side);
    return foes[Math.floor(bs.R() * foes.length)];
  }
  function weakTarget(bs, u) {
    return alive(bs, 1 - u.side).reduce((m, f) => (f.hp / f.maxHp < m.hp / m.maxHp ? f : m));
  }

  function cast(bs, u, ev, big) {
    const S = u.skill;
    const k = big ? W.foe.ult : 1;
    ev.skill = S.name;
    if (big) ev.big = 1;
    const foes = () => alive(bs, 1 - u.side);
    if (u.cls === 'guard') {
      for (const t of foes()) hit(bs, u, t, S.mult * k, ev, { skill: 1 });
      heal(u, u.maxHp * S.heal * (big ? 1.6 : 1), ev);
    } else if (u.cls === 'mage') {
      const pool = foes();
      for (let n = pool.length - 1; n > 0; n--) { const j = Math.floor(bs.R() * (n + 1)); [pool[n], pool[j]] = [pool[j], pool[n]]; }
      const ci = pool.findIndex(f => f.charging);
      if (ci > 0) pool.unshift(pool.splice(ci, 1)[0]);
      for (const t of pool.slice(0, 3)) {
        const was = t.charging;
        const e = hit(bs, u, t, S.mult * k, ev, { skill: 1 });
        if (e.dead) continue;
        if (was) breakCharge(t, e);
        if (bs.R() < S.charm * (t.boss ? 0.5 : 1)) { t.charm = true; e.charm = 1; }
      }
    } else if (u.cls === 'wu') {
      hit(bs, u, frontTarget(bs, u), S.mult * k, ev, { skill: 1 });
      const b = S.buff * (big ? 1.6 : 1);
      for (const f of alive(bs, u.side)) { f.buff = b; f.buffTo = bs.round + 1; }
      ev.buff = b;
    } else if (u.cls === 'wen') {
      const amt = atkOf(bs, u) * S.mult * (big ? 1.6 : 1);
      for (const f of alive(bs, u.side)) { heal(f, amt, ev); f.charm = false; }
      ev.cleanse = 1;
    } else if (u.cls === 'sword') {
      const t = foes().find(f => f.charging) || weakTarget(bs, u);
      const was = t.charging;
      const e = hit(bs, u, t, S.mult * k, ev, { skill: 1, pierce: 0.5, execute: 1 });
      if (!e.dead && was) breakCharge(t, e);
    } else if (u.cls === 'dragon') {
      for (const t of foes()) {
        const e = hit(bs, u, t, S.mult * k, ev, { skill: 1 });
        if (e.dead) continue;
        t.en = Math.max(0, t.en - S.drain);
        e.drain = S.drain;
        if (t.charging && t.en < W.energy.full) breakCharge(t, e);
      }
    } else {
      const dead = bs.U.filter(f => f.side === u.side && !f.alive);
      if (dead.length && u.revive > 0) {
        u.revive--;
        const f = dead[0];
        Object.assign(f, { alive: true, hp: Math.round(f.maxHp * S.revive * (big ? 1.6 : 1)), en: 0, charm: false, shield: 0 });
        ev.revive = f.i;
        (ev.heals || (ev.heals = [])).push({ u: f.i, amt: f.hp, hp: f.hp, rev: 1 });
      } else {
        const amt = Math.round(atkOf(bs, u) * S.shield * (big ? 1.6 : 1));
        ev.shields = alive(bs, u.side).map(f => { f.shield += amt; return { u: f.i, amt, sh: f.shield }; });
      }
    }
  }

  function attack(bs, u, ev) {
    const c = u.cls;
    let t, mult = 1;
    if (c === 'sword') t = weakTarget(bs, u);
    else if (c === 'mage' || c === 'wen' || c === 'xian') { t = anyTarget(bs, u); if (c !== 'mage') mult = 0.9; }
    else t = frontTarget(bs, u);
    hit(bs, u, t, mult, ev);
    u.en = Math.min(W.energy.full, u.en + W.energy.act * (1 + u.eg));
  }

  function act(bs, u) {
    const ev = { t: 'act', a: u.i, hits: [] };
    const full = u.en >= W.energy.full;
    if (u.boss && full) {
      if (!u.charging) {
        // 首领先蓄力一回合，这一下什么也不打
        u.charging = true;
        ev.t = 'charge';
        ev.skill = u.skill.name;
        ev.en = u.en;
        return ev;
      }
      u.charging = false;
      u.en = 0;
      cast(bs, u, ev, true);
    } else if (full && (u.side === 1 || bs.auto)) {
      u.en = 0;
      cast(bs, u, ev, false);
    } else {
      attack(bs, u, ev);
    }
    ev.en = u.en;
    return ev;
  }

  function endCheck(bs, ev) {
    if (!alive(bs, 1).length) { bs.done = true; bs.win = true; }
    else if (!alive(bs, 0).length) { bs.done = true; bs.win = false; }
    if (bs.done) { ev.end = 1; ev.win = bs.win ? 1 : 0; }
    return ev;
  }

  // 走下一步：新回合开始、某个单位动手、被魅惑跳过；打完了返回 null
  WS.battleNext = function (bs) {
    if (bs.done) return null;
    for (;;) {
      if (!bs.order || bs.oi >= bs.order.length) {
        if (bs.round >= W.rounds) {
          bs.done = true;
          bs.win = false;
          return { t: 'timeout', end: 1, win: 0 };
        }
        bs.round++;
        bs.order = bs.U.filter(u => u.alive).sort((a, b) => b.spd - a.spd || a.i - b.i);
        bs.oi = 0;
        return { t: 'round', n: bs.round };
      }
      const u = bs.order[bs.oi++];
      if (!u.alive) continue;
      if (u.charm) { u.charm = false; return endCheck(bs, { t: 'skip', a: u.i }); }
      return endCheck(bs, act(bs, u));
    }
  };

  WS.canCast = (bs, i) => {
    const u = bs.U[i];
    return !!(u && !bs.done && u.side === 0 && u.alive && !u.charm && u.en >= W.energy.full);
  };
  // 亲手放大招：插在下一个动作之前
  WS.battleCast = function (bs, i) {
    if (!WS.canCast(bs, i)) return null;
    const u = bs.U[i];
    const ev = { t: 'act', a: u.i, hits: [], manual: 1 };
    u.en = 0;
    cast(bs, u, ev, false);
    ev.en = u.en;
    return endCheck(bs, ev);
  };

  WS.battleUnits = bs => bs.U.map(u => ({
    i: u.i, side: u.side, slot: u.slot, front: u.front, name: u.name, glyph: u.glyph, cls: u.cls, tier: u.tier, boss: u.boss,
    card: u.card, form: u.form, maxHp: u.maxHp, atk: u.atk, def: u.def, spd: u.spd, crit: u.crit, leech: u.leech, ult: u.ult, guard: u.guard, eg: u.eg,
    en0: u.en0 || 0, skill: u.skill.name,
  }));

  // 一口气打完（自动放大招），给模拟和“跳过”用
  WS.battleRun = function (bs) {
    const log = [];
    let ev;
    while ((ev = WS.battleNext(bs))) log.push(ev);
    return log;
  };
  WS.battle = function (A, B, seed, opt) {
    const bs = WS.battleNew(A, B, seed, opt);
    const log = WS.battleRun(bs);
    return { win: bs.win, rounds: bs.round, log, units: WS.battleUnits(bs), left: alive(bs, 0).length };
  };

  WS.stageSeed = function (state, s) {
    const war = state.war;
    war.tries = (war.tries || 0) + 1;
    return Math.imul(s, 7919) + war.tries * 104729;
  };
  // 界面用：开一场一步一步打的仗
  WS.stageBattle = (state, s, manual) => WS.battleNew(WS.teamUnits(state), WS.stageFoes(s), WS.stageSeed(state, s), { manual });
  WS.fightStage = (state, s) => WS.battle(WS.teamUnits(state), WS.stageFoes(s), WS.stageSeed(state, s));
  WS.battleLeft = bs => alive(bs, 0).length;

  WS.firstClear = function (s) {
    return {
      xw: Math.round(W.idle.xw * Math.pow(W.idle.growth, s) * W.clearSec),
      lq: Math.round(15 + 4 * s),
      fate: s % 10 === 0 ? 1 : 0,
    };
  };

  // 赢了：记下进度，发首通奖励，可能掉一件法宝
  WS.winStage = function (state, s, rand) {
    const war = state.war;
    if (s !== war.stage + 1) return null;
    rand = rand || Math.random;
    war.stage = s;
    war.tries = 0;
    const r = WS.firstClear(s);
    war.xw += r.xw;
    state.lingqi += r.lq;
    state.lingqiTotal += r.lq;
    war.fate += r.fate;
    const boss = s % 10 === 0;
    if (s === 1 || boss || rand() < W.relic.drop) r.relic = WS.addRelic(state, WS.rollRelic(Math.ceil(s / 10), boss ? 1 : 0, rand));
    return r;
  };

  // ---------- 法宝 ----------
  const RK = {};
  W.relic.kinds.forEach(k => { RK[k.id] = k; });
  WS.relicKind = id => RK[id];
  WS.relicValue = function (r) {
    const K = RK[r.k];
    const v = K.base * W.relic.tier[r.t] * (K.scale ? 1 + W.relic.perHeaven * (r.h - 1) : 1);
    return K.cap ? Math.min(K.cap, v) : v;
  };
  WS.relicText = function (r) {
    const K = RK[r.k], v = WS.relicValue(r);
    return `${K.label} +${K.pct ? Math.round(v * 100) + '%' : Math.round(v)}`;
  };
  const relicScore = r => W.relic.tier[r.t] * (1 + W.relic.perHeaven * (r.h - 1));
  WS.relicScore = relicScore;

  WS.rollRelic = function (h, minTier, rand) {
    rand = rand || Math.random;
    const kinds = W.relic.kinds;
    const k = kinds[Math.floor(rand() * kinds.length)].id;
    const luck = 1 + 0.12 * (Math.max(1, h) - 1);
    const w = W.relic.weight.map((x, i) => (i < (minTier || 0) ? 0 : x * Math.pow(luck, 0.8 * i)));
    const sum = w.reduce((a, b) => a + b, 0);
    let x = rand() * sum, t = w.length - 1;
    for (let i = 0; i < w.length; i++) { if (x < w[i]) { t = i; break; } x -= w[i]; }
    return { k, t, h: Math.max(1, h) };
  };

  WS.relicOwner = (state, id) => state.cards.find(c => c.relic === id) || null;
  WS.relicOf = (state, c) => (c.relic == null || !state.war.relics ? null : state.war.relics.find(r => r.id === c.relic) || null);
  WS.meltValue = r => Math.round(W.idle.xw * Math.pow(W.idle.growth, (r.h - 1) * 10) * 90 * (1 + r.t));

  WS.addRelic = function (state, r) {
    const war = state.war;
    war.relicId = (war.relicId || 0) + 1;
    r.id = war.relicId;
    war.relics.push(r);
    // 法宝囊满了：炼化最差的、没人带着的那件
    while (war.relics.length > W.relic.cap) {
      const free = war.relics.filter(x => x !== r && !WS.relicOwner(state, x.id));
      if (!free.length) break;
      free.sort((a, b) => relicScore(a) - relicScore(b));
      r.melted = (r.melted || 0) + WS.meltRelic(state, free[0].id);
    }
    return r;
  };

  WS.equipRelic = function (state, cardId, relicId) {
    const c = WS.findCard(state, cardId);
    if (!c || !state.war.relics.some(r => r.id === relicId)) return false;
    const o = WS.relicOwner(state, relicId);
    if (o) o.relic = null;
    c.relic = relicId;
    return true;
  };
  WS.unequipRelic = function (state, cardId) {
    const c = WS.findCard(state, cardId);
    if (c) c.relic = null;
  };
  WS.meltRelic = function (state, id) {
    const war = state.war;
    const i = war.relics.findIndex(r => r.id === id);
    if (i < 0) return 0;
    const o = WS.relicOwner(state, id);
    if (o) o.relic = null;
    const v = WS.meltValue(war.relics[i]);
    war.xw += v;
    war.relics.splice(i, 1);
    return v;
  };

  // 这件法宝给这张卡带上，战力能涨多少
  WS.relicPower = function (state, c, r) {
    const b = baseStats(state, c);
    return power(applyRelic(Object.assign({}, b), r)) - power(b);
  };

  // 一键穿戴：阵中的卡从强到弱，各挑一件最合适的（可以从阵外的卡身上拿）
  WS.autoEquip = function (state) {
    const team = WS.teamCards(state).filter(Boolean).sort((a, b) => power(baseStats(state, b)) - power(baseStats(state, a)));
    team.forEach(c => { c.relic = null; });
    const taken = {};
    let n = 0;
    for (const c of team) {
      let best = null, bp = 0;
      for (const r of state.war.relics) {
        if (taken[r.id]) continue;
        const p = WS.relicPower(state, c, r);
        if (p > bp) { bp = p; best = r; }
      }
      if (!best) continue;
      taken[best.id] = true;
      const o = WS.relicOwner(state, best.id);
      if (o) o.relic = null;
      c.relic = best.id;
      n++;
    }
    return n;
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
    if (state.war.stage > 0 && box.relics < W.relic.idleMax) {
      box.rt += d;
      while (box.rt >= W.relic.idleSec && box.relics < W.relic.idleMax) { box.rt -= W.relic.idleSec; box.relics++; }
    }
  };
  WS.boxFull = state => state.war.box.sec >= WS.offlineCapHours(state) * 3600;
  WS.collectIdle = function (state, rand) {
    const box = state.war.box;
    const got = { xw: Math.floor(box.xw), lq: Math.floor(box.lq), sec: box.sec, relics: [] };
    state.war.xw += got.xw;
    state.lingqi += got.lq;
    state.lingqiTotal += got.lq;
    box.xw -= got.xw;
    box.lq -= got.lq;
    box.sec = 0;
    const h = Math.max(1, Math.ceil(state.war.stage / 10));
    for (let i = 0; i < box.relics; i++) got.relics.push(WS.addRelic(state, WS.rollRelic(h, 0, rand)));
    box.relics = 0;
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
  // 魂魄的光，一盏比一盏亮
  WS.realmName = function (lv) {
    const names = ['萤光', '烛光', '灯辉', '炉火', '星辉', '月辉', '日曜', '霞光', '紫气', '金光', '神光', '鸿蒙'];
    const i = Math.min(names.length - 1, Math.floor((lv - 1) / 10));
    return names[i] + '·' + WS.cnNum(((lv - 1) % 10) + 1) + '重';
  };

  // ---------- 存档 ----------
  WS.newWar = () => ({
    stage: 0, lv: 1, team: [null, null, null, null, null], xw: 0,
    box: { xw: 0, lq: 0, sec: 0, rt: 0, relics: 0 },
    fate: 0, useFate: true, tries: 0, seen: false, relics: [], relicId: 0, autoCast: true, gift: 0,
  });

  // 老存档：把轮回记录里的前世变成卡，补上新加的字段
  WS.warMigrate = function (s) {
    if (!Array.isArray(s.cards)) {
      s.cards = [];
      (s.history || []).slice().reverse().forEach(h => {
        if (WS.FORMS[h.form]) pushCard(s.cards, WS.makeCard(h.no, h.form, h.tier, h.best, h.merit));
      });
    }
    const base = WS.newWar();
    // 法宝是后来加的：已经打过几关的老存档补发几件，按打到的那重天掷
    const gift = s.war && typeof s.war === 'object' && s.war.gift === undefined && s.war.stage > 0;
    if (!s.war || typeof s.war !== 'object') s.war = base;
    for (const k of Object.keys(base)) if (s.war[k] === undefined) s.war[k] = base[k];
    if (!s.war.box || typeof s.war.box !== 'object') s.war.box = base.box;
    for (const k of Object.keys(base.box)) if (typeof s.war.box[k] !== 'number') s.war.box[k] = 0;
    if (!Array.isArray(s.war.relics)) s.war.relics = [];
    s.cards.forEach(c => {
      if (c.relic === undefined || (c.relic != null && !s.war.relics.some(r => r.id === c.relic))) c.relic = null;
    });
    if (!Array.isArray(s.war.team) || s.war.team.length !== W.slots) s.war.team = base.team.slice();
    s.war.team = s.war.team.map(id => (s.cards.some(c => c.id === id) ? id : null));
    if (s.cards.length && s.war.team.every(id => id == null)) WS.autoTeam(s);
    if (gift) {
      const n = Math.min(6, 1 + Math.floor(s.war.stage / 5)), h = Math.max(1, Math.ceil(s.war.stage / 10));
      for (let i = 0; i < n; i++) WS.addRelic(s, WS.rollRelic(h, i === 0 ? 1 : 0));
      s.war.gift = n;
    }
    return s;
  };
})(typeof window !== 'undefined' ? window : globalThis);
