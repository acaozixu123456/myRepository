/* 万世洞天 · 核心规则
 * 这里只有规则和数值计算，不碰界面，所以可以单独拿来测试和模拟。
 */
(function (root) {
  'use strict';
  const WS = root.WS = root.WS || {};

  const featLv = (s, id) => (s.feats && s.feats[id]) || 0;
  WS.featLv = featLv;
  WS.feature = id => WS.FEATURES.find(f => f.id === id);

  // ---------- 新存档 / 新的一世 ----------
  WS.newState = function () {
    const feats = {};
    WS.FEATURES.forEach(f => { feats[f.id] = 0; });
    const codex = {};
    WS.FORM_ORDER.forEach(f => { codex[f] = { lives: 0, bestTier: -1, best: null, bestRank: -1 }; });
    return {
      v: 1,
      created: Date.now(),
      lastSeen: Date.now(),
      speed: 1,
      sound: { music: true, sfx: true },
      lingqi: 0,
      lingqiTotal: 0,
      feats,
      unlocked: ['ant'],
      guarantee: null,
      lifeNo: 0,
      pity: 0,
      lastMerit: 0,
      meritTotal: 0,
      codex,
      history: [],
      cards: [],
      war: WS.newWar ? WS.newWar() : null,
      life: null,
      pending: { type: 'wheel', result: null },
      introDone: false,
    };
  };

  WS.lifespanFor = function (state, form, tier) {
    const F = WS.FORMS[form];
    return F.lifespan * WS.TIERS[tier].life * (1 + 0.08 * featLv(state, 'spring'));
  };

  WS.newLife = function (state, form, tier) {
    return {
      form, tier,
      age: 0,
      lifespan: WS.lifespanFor(state, form, tier),
      t: 0,
      merit: 0,
      main: 0,
      totalMain: 0,
      wenTotal: 0,
      people: 1,
      tails: 1,
      realm: 0,        // 修士的境界
      breakBonus: 0,   // 修士突破失败攒下的成功率
      stage: 1,        // 龙：第几变
      leapWait: 0,     // 龙：攒够龙气以后过了多久（自动跃门要先等玩家自己跳）
      peach: form === 'xian' ? [30, 15, 0] : null, // 仙：每棵桃树长了多久
      owned: {},
      ups: {},
      ms: [],
      skillActive: 0,
      skillCd: 0,
      autoAcc: 0,
      prodBonus: 0,
      event: null,
      lastEvent: null,
      nextEvent: 45,
      ended: false,
    };
  };

  // ---------- 产业 ----------
  WS.allGens = F => F.gens.concat(F.specials || []);
  WS.findGen = (F, id) => WS.allGens(F).find(g => g.id === id);

  WS.genCost = function (F, g, owned, n) {
    const r = g.growth || F.growth;
    const c0 = g.cost * Math.pow(r, owned);
    if (!n || n === 1) return c0;
    return c0 * (Math.pow(r, n) - 1) / (r - 1);
  };

  WS.maxAfford = function (F, g, owned, money) {
    const r = g.growth || F.growth;
    const c0 = g.cost * Math.pow(r, owned);
    if (money < c0) return 0;
    return Math.max(1, Math.floor(Math.log(1 + money * (r - 1) / c0) / Math.log(r)));
  };

  WS.antPop = function (L) {
    let p = 1;
    for (const g of WS.FORMS.ant.gens) p += (L.owned[g.id] || 0) * g.pop;
    return p;
  };

  // ---------- 狐狸的昼夜 ----------
  WS.moonInfo = function (L) {
    const cyc = WS.FOX_DAY;
    const inCyc = L.t % cyc;
    const idx = Math.floor(L.t / cyc);
    const night = inCyc >= cyc / 2;
    const full = night && (idx % WS.FULL_MOON_EVERY === WS.FULL_MOON_EVERY - 1);
    const left = night ? cyc - inCyc : cyc / 2 - inCyc;
    // 下一个满月夜还有几个夜晚
    const toFull = (WS.FULL_MOON_EVERY - 1 - (idx % WS.FULL_MOON_EVERY) + WS.FULL_MOON_EVERY) % WS.FULL_MOON_EVERY;
    return { night, full, left, idx, toFull };
  };

  WS.nightMult = function (L) {
    const mi = WS.moonInfo(L);
    if (!mi.night) return 1;
    let m = L.ups.night ? 3 : 2;
    if (mi.full) m *= 2;
    return m;
  };

  WS.tailCost = function (L) {
    const T = WS.FORMS.fox.tail;
    let c = T.base * Math.pow(T.growth, L.tails - 1);
    if (L.ups.nine) c *= 0.5;
    return c;
  };

  WS.condenseTail = function (state, L) {
    if (L.form !== 'fox' || L.tails >= 9) return false;
    const c = WS.tailCost(L);
    if (L.main < c) return false;
    L.main -= c;
    L.tails += 1;
    return true;
  };

  // ---------- 凡人的人丁和文气 ----------
  WS.perPeople = L => (L.ups.clan ? 0.06 : 0.03);

  WS.wenMult = function (L) {
    let m = 1;
    for (const ms of WS.FORMS.human.milestones) {
      if (ms.prodMult && L.ms.indexOf(ms.id) >= 0) m *= ms.prodMult;
    }
    return m;
  };

  WS.wenRate = function (state, L) {
    if (L.form !== 'human') return 0;
    const n = L.owned.school || 0;
    if (!n) return 0;
    let r = n * WS.FORMS.human.specials[1].wen * (1 + 0.15 * L.tier);
    if (L.ups.books) r *= 3;
    return r;
  };

  // ---------- 修士的突破 ----------
  WS.breakCost = function (L) {
    const B = WS.FORMS.xiu.breakthrough;
    return B.base * Math.pow(B.growth, L.realm || 0);
  };
  WS.breakMax = () => WS.FORMS.xiu.breakthrough.odds.length;
  WS.breakOdds = function (state, L) {
    const F = WS.FORMS.xiu, B = F.breakthrough;
    const r = L.realm || 0;
    if (r >= B.odds.length) return 0;
    let p = B.odds[r] + B.perTier * L.tier + (L.breakBonus || 0);
    for (const u of F.ups) if (L.ups[u.id] && u.eff.odds) p += u.eff.odds;
    return Math.min(Math.max(B.max, B.odds[r]), p);
  };
  // 成功：境界 +1，产出 ×1.35，寿元 +15 年。失败：丢一半真元（道心坚定后不丢），下次成功率 +10%
  WS.breakthrough = function (state, L, rand) {
    if (!L || L.ended || L.form !== 'xiu' || (L.realm || 0) >= WS.breakMax()) return null;
    const F = WS.FORMS.xiu, B = F.breakthrough;
    const cost = WS.breakCost(L);
    if (L.main < cost * (1 - 1e-9)) return null;
    const p = WS.breakOdds(state, L);
    if ((rand || Math.random)() < p) {
      L.main = Math.max(0, L.main - cost);
      L.realm = (L.realm || 0) + 1;
      L.breakBonus = 0;
      L.lifespan += B.years;
      return { ok: true, realm: L.realm, name: F.realms[L.realm], years: B.years, p };
    }
    const lost = L.ups.heart ? 0 : cost * B.failLoss;
    L.main = Math.max(0, L.main - lost);
    L.breakBonus = (L.breakBonus || 0) + B.failBonus;
    return { ok: false, lost, p, next: WS.breakOdds(state, L) };
  };

  // ---------- 龙的跃门 ----------
  WS.leapCost = function (L) {
    const P = WS.FORMS.dragon.leap;
    let c = P.base * Math.pow(P.growth, (L.stage || 1) - 1);
    if (L.ups.blood) c *= 0.5;
    return c;
  };
  WS.leapMax = () => WS.FORMS.dragon.stages.length;
  // 浪头一来一回的时间：越往后越快
  WS.leapPeriod = L => WS.FORMS.dragon.leap.period * Math.pow(0.92, (L.stage || 1) - 1);
  WS.leapZone = function (L) {
    const P = WS.FORMS.dragon.leap;
    return { half: (L.ups.secret ? P.wide : P.zone) / 2, perfect: P.perfect / 2 };
  };
  // x 是浪头的位置（0 到 1），正中间最好
  WS.leapJudge = function (L, x) {
    const z = WS.leapZone(L), d = Math.abs(x - 0.5);
    return d <= z.perfect ? 'perfect' : d <= z.half ? 'ok' : 'miss';
  };
  WS.leap = function (state, L, quality) {
    if (!L || L.ended || L.form !== 'dragon' || (L.stage || 1) >= WS.leapMax()) return null;
    const F = WS.FORMS.dragon, P = F.leap;
    const cost = WS.leapCost(L);
    if (L.main < cost * (1 - 1e-9)) return null;
    L.leapWait = 0;
    if (quality === 'miss') {
      const lost = cost * P.failLoss;
      L.main = Math.max(0, L.main - lost);
      return { ok: false, lost };
    }
    L.main = Math.max(0, L.main - cost);
    L.stage = (L.stage || 1) + 1;
    const perfect = quality === 'perfect';
    if (perfect) L.prodBonus = (L.prodBonus || 0) + P.perfectBonus;
    return { ok: true, stage: L.stage, name: F.stages[L.stage - 1], perfect };
  };

  // ---------- 仙的蟠桃园 ----------
  WS.peachGrow = L => (L.ups.graft ? WS.FORMS.xian.peach.fast : WS.FORMS.xian.peach.grow);
  WS.peachRipe = (L, i) => !!(L.peach && L.peach[i] >= WS.peachGrow(L));
  WS.peachYears = L => WS.FORMS.xian.peach.years * (L.ups.longevity ? 2 : 1);
  WS.peachGain = (state, L) => 10 + WS.prodRate(state, L, { noSkill: true }) * WS.FORMS.xian.peach.gain;
  WS.pickPeach = function (state, L, i) {
    if (!L || L.ended || L.form !== 'xian' || !WS.peachRipe(L, i)) return null;
    const g = WS.peachGain(state, L);
    L.main += g;
    L.totalMain += g;
    const years = WS.peachYears(L);
    L.lifespan += years;
    L.peach[i] = 0;
    L.peaches = (L.peaches || 0) + 1;
    return { gain: g, years };
  };

  // ---------- 产出 ----------
  WS.prodMult = function (state, L, opt) {
    opt = opt || {};
    const F = WS.FORMS[L.form];
    let m = WS.TIERS[L.tier].mult;
    for (const u of F.ups) if (L.ups[u.id] && u.eff.prod) m *= u.eff.prod;
    m *= 1 + 0.3 * featLv(state, F.legacy);
    m *= 1 + 0.15 * featLv(state, 'pine');
    if (L.form === 'fox') {
      m *= Math.pow(WS.FORMS.fox.tail.mult, L.tails - 1);
      if (!opt.noNight) m *= WS.nightMult(L);
    }
    if (L.form === 'human') {
      m *= 1 + WS.perPeople(L) * L.people;
      m *= WS.wenMult(L);
    }
    if (L.form === 'xiu') m *= Math.pow(F.breakthrough.mult, L.realm || 0);
    if (L.form === 'dragon') m *= Math.pow(F.leap.mult, (L.stage || 1) - 1);
    m *= 1 + (L.prodBonus || 0);
    if (!opt.noSkill && L.skillActive > 0 && F.skill.mult) m *= F.skill.mult;
    return m;
  };

  WS.baseProd = function (L) {
    const F = WS.FORMS[L.form];
    let b = 0;
    for (const g of F.gens) b += (L.owned[g.id] || 0) * g.prod;
    b += L.form === 'ant' ? 0.6 : 0.5; // 你自己也在干活
    return b;
  };

  WS.prodRate = function (state, L, opt) {
    const b = WS.baseProd(L);
    return b > 0 ? b * WS.prodMult(state, L, opt) : 0;
  };

  WS.tapGain = function (state, L) {
    const F = WS.FORMS[L.form];
    let g = 1 + 0.1 * WS.prodRate(state, L, { noSkill: true });
    for (const u of F.ups) if (L.ups[u.id] && u.eff.tap) g *= u.eff.tap;
    if (L.form === 'fox' && WS.moonInfo(L).night) g *= 2;
    return g;
  };

  WS.tap = function (state, L) {
    if (!L || L.ended) return 0;
    const g = WS.tapGain(state, L);
    L.main += g;
    L.totalMain += g;
    return g;
  };

  // ---------- 购买 ----------
  WS.buyGen = function (state, L, id, mode) {
    const F = WS.FORMS[L.form];
    const g = WS.findGen(F, id);
    if (!g || L.ended) return 0;
    const owned = L.owned[id] || 0;
    let n;
    if (mode === 'max') {
      n = WS.maxAfford(F, g, owned, L.main);
      while (n > 1 && WS.genCost(F, g, owned, n) > L.main) n--; // 浮点误差时少买一个
    }
    else if (mode === 10) n = WS.maxAfford(F, g, owned, L.main) >= 10 ? 10 : 0;
    else n = L.main >= WS.genCost(F, g, owned, 1) ? 1 : 0;
    if (n <= 0) return 0;
    const cost = WS.genCost(F, g, owned, n);
    if (cost > L.main * (1 + 1e-9)) return 0;
    L.main = Math.max(0, L.main - cost);
    L.owned[id] = owned + n;
    if (g.people) L.people += g.people * n;
    return n;
  };

  WS.buyUp = function (state, L, id) {
    const F = WS.FORMS[L.form];
    const u = F.ups.find(x => x.id === id);
    if (!u || L.ups[id] || L.ended || L.main < u.cost) return false;
    L.main -= u.cost;
    L.ups[id] = true;
    return true;
  };

  WS.hasAuto = function (L) {
    const F = WS.FORMS[L.form];
    return F.ups.some(u => u.eff.auto && L.ups[u.id]);
  };

  // 玩家点了买不起的东西，就记成“攒钱目标”：自动经营先不花钱，攒够了替他买下
  WS.targetCost = function (state, L) {
    const t = L.saveFor;
    if (!t) return 0;
    const F = WS.FORMS[L.form];
    if (t.kind === 'up') { const u = F.ups.find(x => x.id === t.id); return u && !L.ups[t.id] ? u.cost : 0; }
    if (t.kind === 'tail') return L.form === 'fox' && L.tails < 9 ? WS.tailCost(L) : 0;
    if (t.kind === 'break') return L.form === 'xiu' && L.realm < WS.breakMax() ? WS.breakCost(L) : 0;
    if (t.kind === 'leap') return L.form === 'dragon' && L.stage < WS.leapMax() ? WS.leapCost(L) : 0;
    const g = WS.findGen(F, t.id);
    return g ? WS.genCost(F, g, L.owned[g.id] || 0, t.n || 1) : 0;
  };

  WS.targetName = function (L) {
    const t = L.saveFor;
    if (!t) return '';
    const F = WS.FORMS[L.form];
    if (t.kind === 'up') { const u = F.ups.find(x => x.id === t.id); return u ? u.name : ''; }
    if (t.kind === 'tail') return '下一尾';
    if (t.kind === 'break') return '突破' + F.realms[L.realm + 1];
    if (t.kind === 'leap') return '跃门';
    const g = WS.findGen(F, t.id);
    return g ? g.name + ((t.n || 1) > 1 ? ' ×' + t.n : '') : '';
  };

  WS.buyTarget = function (state, L, out, rand) {
    const t = L.saveFor;
    if (!t) return false;
    if (t.kind === 'up') return WS.buyUp(state, L, t.id);
    if (t.kind === 'tail') return WS.condenseTail(state, L);
    if (t.kind === 'break') return autoBreak(state, L, out, rand);
    if (t.kind === 'leap') return autoLeap(state, L, out);
    return WS.buyGen(state, L, t.id, (t.n || 1) === 10 ? 10 : 1) > 0;
  };

  // 自动经营：先凝尾、学秘法，再从最便宜的产业买起。
  // 下一尾或下一门秘法一分钟内就能攒够时，先攒着不买产业，免得钱总被产业花光。
  // 自动突破、自动跃门：结果放进 out，界面拿去提示
  function autoBreak(state, L, out, rand) {
    const r = WS.breakthrough(state, L, rand);
    if (!r) return false;
    if (out) out.push(Object.assign({ type: 'break', auto: true }, r));
    return true;
  }
  function autoLeap(state, L, out) {
    const r = WS.leap(state, L, 'ok');
    if (!r) return false;
    if (out) out.push(Object.assign({ type: 'leap', auto: true }, r));
    return true;
  }
  WS.LEAP_GRACE = 20; // 龙气攒够以后，先等玩家自己跳这么多秒，再让鱼群带着跳

  WS.autoBuy = function (state, L, maxIter, out, rand) {
    const F = WS.FORMS[L.form];
    if (L.saveFor) {
      const c = WS.targetCost(state, L);
      if (!c) {
        L.saveFor = null;
      } else {
        if (L.main < c) return 0; // 攒钱中，什么都不买
        const t = L.saveFor, name = WS.targetName(L);
        const before = L.realm;
        if (!WS.buyTarget(state, L, out, rand)) return 0;
        // 突破失败了就接着攒，下回再冲
        if (t.kind === 'break' && L.realm === before) return 1;
        L.saveFor = null;
        if (out && t.kind !== 'break' && t.kind !== 'leap') out.push({ type: 'bought', name });
        return 1;
      }
    }
    const rate = WS.prodRate(state, L, { noSkill: true });
    let n = 0, saveFor = 0;
    if (L.form === 'fox' && L.tails < 9) {
      while (L.tails < 9 && WS.condenseTail(state, L)) n++;
      if (L.tails < 9 && WS.tailCost(L) <= rate * 60) saveFor = WS.tailCost(L);
    }
    if (L.form === 'xiu' && L.realm < WS.breakMax()) {
      for (let k = 0; k < 4 && L.realm < WS.breakMax() && L.main >= WS.breakCost(L); k++) { autoBreak(state, L, out, rand); n++; }
      if (L.realm < WS.breakMax() && WS.breakCost(L) <= rate * 60) saveFor = WS.breakCost(L);
    }
    if (L.form === 'dragon' && L.stage < WS.leapMax()) {
      if (L.main >= WS.leapCost(L) && (L.leapWait || 0) >= WS.LEAP_GRACE) { autoLeap(state, L, out); n++; }
      if (L.stage < WS.leapMax() && WS.leapCost(L) <= rate * 60) saveFor = WS.leapCost(L);
    }
    if (!saveFor) {
      const ups = F.ups.filter(u => !L.ups[u.id]).sort((a, b) => a.cost - b.cost);
      for (const u of ups) {
        if (L.main >= u.cost) { WS.buyUp(state, L, u.id); n++; continue; }
        if (u.cost <= rate * 60) saveFor = u.cost;
        break;
      }
    }
    if (saveFor) return n;
    const gens = WS.allGens(F);
    for (let i = 0; i < (maxIter || 80); i++) {
      let best = null, bestCost = Infinity;
      for (const g of gens) {
        const c = WS.genCost(F, g, L.owned[g.id] || 0, 1);
        if (c < bestCost) { bestCost = c; best = g; }
      }
      if (!best || bestCost > L.main) break;
      WS.buyGen(state, L, best.id, 1);
      n++;
    }
    return n;
  };

  // ---------- 技能 ----------
  WS.pavilionCut = lv => Math.min(0.6, 0.08 * lv);
  WS.skillCdFor = (state, F) => F.skill.cd * (1 - WS.pavilionCut(featLv(state, 'pavilion')));

  WS.useSkill = function (state, L) {
    if (!L || L.ended || L.skillCd > 0) return false;
    const F = WS.FORMS[L.form];
    if (F.skill.instant) {
      const g = WS.prodRate(state, L, { noSkill: true }) * F.skill.instant;
      L.main += g;
      L.totalMain += g;
    } else {
      L.skillActive = F.skill.dur;
    }
    L.skillCd = WS.skillCdFor(state, F);
    return true;
  };

  // ---------- 此世目标 ----------
  WS.meritMult = state => 1 + 0.1 * featLv(state, 'peak');

  WS.statValue = function (L, stat) {
    if (stat === 'pop') return WS.antPop(L);
    if (stat === 'tails') return L.tails;
    if (stat === 'people') return L.people;
    if (stat === 'wen') return L.wenTotal;
    if (stat === 'realm') return L.realm || 0;
    if (stat === 'stage') return L.stage || 1;
    if (stat === 'dao') return L.totalMain;
    return 0;
  };

  WS.checkMilestones = function (state, L, out) {
    const F = WS.FORMS[L.form];
    for (const ms of F.milestones) {
      if (L.ms.indexOf(ms.id) >= 0) continue;
      if (WS.statValue(L, ms.stat) < ms.at) continue;
      L.ms.push(ms.id);
      L.lastMsT = L.t;
      const gain = ms.merit * WS.meritMult(state);
      L.merit += gain;
      if (out) out.push({ type: 'milestone', name: ms.name, merit: gain });
      if (ms.unlock && state.unlocked.indexOf(ms.unlock) < 0) {
        state.unlocked.push(ms.unlock);
        state.guarantee = ms.unlock;
        if (out) out.push({ type: 'unlock', form: ms.unlock });
      }
    }
  };

  WS.bestAchievement = function (L) {
    const F = WS.FORMS[L.form];
    let best = null, rank = -1;
    F.milestones.forEach((ms, i) => { if (L.ms.indexOf(ms.id) >= 0 && i > rank) { rank = i; best = ms.name; } });
    return { name: best, rank };
  };

  // ---------- 一世里遇到的事：凡人的村中事、修士的山中事…… ----------
  WS.formEvents = L => (L && WS.FORMS[L.form] && WS.FORMS[L.form].events) || [];
  WS.currentEvent = L => (L && L.event ? WS.formEvents(L).find(x => x.id === L.event) || null : null);
  WS.spawnEvent = function (L, rand) {
    const pool = WS.formEvents(L).filter(e => e.id !== L.lastEvent);
    if (!pool.length) return null;
    const e = pool[Math.floor((rand || Math.random)() * pool.length)];
    L.event = e.id;
    L.lastEvent = e.id;
    return e;
  };

  WS.resolveEvent = function (state, L, which) {
    if (!L || !L.event) return null;
    const e = WS.currentEvent(L);
    if (!e) { L.event = null; return null; }
    const choice = e[which];
    const eff = choice.eff;
    const mp = eff.mainPct != null ? eff.mainPct : eff.grainPct;
    if (mp) {
      const before = L.main;
      L.main = Math.max(0, L.main * (1 + mp));
      if (L.main > before) L.totalMain += L.main - before;
    }
    if (eff.years) L.lifespan = Math.max(L.age + 1, L.lifespan + eff.years);
    if (eff.odds) L.breakBonus = (L.breakBonus || 0) + eff.odds;
    if (eff.merit) L.merit += eff.merit * WS.meritMult(state);
    if (eff.people) L.people += eff.people;
    if (eff.peoplePct) L.people = Math.max(1, Math.round(L.people * (1 + eff.peoplePct)));
    if (eff.prodBonus) L.prodBonus = (L.prodBonus || 0) + eff.prodBonus;
    if (eff.lingqi) {
      const g = eff.lingqi * (1 + 0.1 * WS.totalFeat(state));
      state.lingqi += g;
      state.lingqiTotal += g;
    }
    if (eff.wenSec) L.wenTotal += Math.max(eff.wenMin || 0, WS.wenRate(state, L) * eff.wenSec);
    L.event = null;
    L.nextEvent = 70 + Math.random() * 60;
    return choice;
  };

  // ---------- 洞天 ----------
  WS.totalFeat = function (state) {
    let n = 0;
    for (const f of WS.FEATURES) n += featLv(state, f.id);
    return n;
  };

  WS.lingqiRate = function (state) {
    let r = 0.2;
    for (const f of WS.FEATURES) if (f.lingqi) r += f.lingqi * featLv(state, f.id);
    return r * (1 + 0.25 * featLv(state, 'crane'));
  };

  WS.featureCost = (f, lv) => f.cost * Math.pow(f.growth, lv);

  WS.buyFeature = function (state, id) {
    const f = WS.feature(id);
    if (!f || f.from) return false;
    const c = WS.featureCost(f, featLv(state, id));
    if (state.lingqi < c) return false;
    state.lingqi -= c;
    state.feats[id] = featLv(state, id) + 1;
    return true;
  };

  WS.offlineCapHours = state => 8 + 2 * featLv(state, 'cloud');

  WS.featureEffect = function (id, lv) {
    switch (id) {
      case 'soil': return `蚂蚁产食 +${30 * lv}%`;
      case 'foxwood': return `狐狸月华 +${30 * lv}%`;
      case 'village': return `凡人产粮 +${30 * lv}%`;
      case 'danfang': return `修士真元 +${30 * lv}%`;
      case 'longtan': return `龙气 +${30 * lv}%`;
      case 'qionglou': return `仙气 +${30 * lv}%`;
      case 'spring': return `每一世寿元 +${8 * lv}%`;
      case 'cloud': return `离线最多攒 ${8 + 2 * lv} 小时`;
      case 'peak': return `功德 +${10 * lv}%`;
      case 'pavilion': return `技能冷却 -${Math.round(100 * WS.pavilionCut(lv))}%`;
      case 'pine': return `所有前世产出 +${15 * lv}%`;
      case 'terrace': return `轮回运气 +${15 * lv}%`;
      case 'crane': return `灵气 +${25 * lv}%`;
    }
    return '';
  };

  // ---------- 一世走完 ----------
  WS.endLife = function (state, reason) {
    const L = state.life;
    if (!L || L.ended) return null;
    const F = WS.FORMS[L.form];
    L.ended = true;
    const add = Math.max(1, L.ms.length) + (L.tier >= 3 ? 1 : 0);
    state.feats[F.legacy] = featLv(state, F.legacy) + add;
    const lq = Math.round(40 + L.merit * 25);
    state.lingqi += lq;
    state.lingqiTotal += lq;
    state.meritTotal += L.merit;
    state.lastMerit = L.merit;
    const best = WS.bestAchievement(L);
    const cx = state.codex[L.form];
    cx.lives += 1;
    cx.bestTier = Math.max(cx.bestTier, L.tier);
    if (best.rank > cx.bestRank) { cx.bestRank = best.rank; cx.best = best.name; }
    const summary = {
      no: state.lifeNo, form: L.form, tier: L.tier,
      years: L.age, lifespan: L.lifespan, merit: L.merit,
      best: best.name, legacy: { id: F.legacy, add, lv: state.feats[F.legacy] },
      lingqi: lq, reason, total: L.totalMain,
    };
    // 这一世化作一张前世卡，陪你征战诸天
    if (WS.addCard && state.cards && state.war) summary.card = WS.addCard(state, L, summary).id;
    state.history.unshift(Object.assign({ at: Date.now() }, summary));
    state.history = state.history.slice(0, 30);
    state.pending = { type: 'summary', summary };
    return summary;
  };

  WS.canEndEarly = L => !!L && !L.ended && L.age >= L.lifespan / 5;

  // 新生灵是后来加的：以前某一世已经达成过解锁条件的，补上解锁
  WS.unlockByCodex = function (state) {
    const got = [];
    const add = f => { if (WS.FORMS[f] && state.unlocked.indexOf(f) < 0) { state.unlocked.push(f); got.push(f); } };
    for (const id of WS.FORM_ORDER) {
      const cx = state.codex && state.codex[id];
      if (!cx || !(cx.bestRank >= 0)) continue;
      WS.FORMS[id].milestones.forEach((ms, i) => { if (ms.unlock && i <= cx.bestRank) add(ms.unlock); });
    }
    const L = state.life;
    if (L && !L.ended && WS.FORMS[L.form]) {
      WS.FORMS[L.form].milestones.forEach(ms => { if (ms.unlock && L.ms.indexOf(ms.id) >= 0) add(ms.unlock); });
    }
    if (got.length && !state.guarantee) state.guarantee = got[0];
    return got;
  };

  // ---------- 轮回盘 ----------
  WS.luckFactor = state => 1 + (state.lastMerit || 0) / 40 * (1 + 0.15 * featLv(state, 'terrace'));

  // fate：用一张天命符，这一转至少上品
  WS.tierOdds = function (state, opt) {
    const k = WS.luckFactor(state);
    let w = WS.TIERS.map((t, i) => t.weight * Math.pow(k, 0.6 * i));
    if (opt && opt.fate) w = w.map((x, i) => (i >= 2 ? x : 0));
    if (state.pity >= WS.PITY - 1) w = w.map((x, i) => (i >= 3 ? x : 0));
    const s = w.reduce((a, b) => a + b, 0);
    return w.map(x => x / s);
  };

  WS.formWeights = function (state) {
    const luck = (state.lastMerit || 0) * (1 + 0.15 * featLv(state, 'terrace'));
    const base = {
      ant: 55, fox: 30 * (1 + luck / 60), human: 15 * (1 + luck / 40),
      xiu: 10 * (1 + luck / 30), dragon: 7 * (1 + luck / 25), xian: 5 * (1 + luck / 20),
    };
    return state.unlocked.map(f => [f, base[f]]);
  };

  WS.formOdds = function (state) {
    if (state.guarantee) return [[state.guarantee, 1]];
    const fw = WS.formWeights(state);
    const s = fw.reduce((a, b) => a + b[1], 0);
    return fw.map(([f, w]) => [f, w / s]);
  };

  WS.canUseFate = state => !!(state.war && state.war.fate > 0);
  WS.spin = function (state, rand, opt) {
    rand = rand || Math.random;
    const fate = !!(opt && opt.fate && WS.canUseFate(state));
    if (fate) state.war.fate -= 1;
    const odds = WS.tierOdds(state, { fate });
    let r = rand(), acc = 0, tier = odds.length - 1;
    for (let i = 0; i < odds.length; i++) { acc += odds[i]; if (r < acc) { tier = i; break; } }
    const fo = WS.formOdds(state);
    let x = rand(), form = fo[fo.length - 1][0];
    acc = 0;
    for (const [f, p] of fo) { acc += p; if (x < acc) { form = f; break; } }
    const isNew = state.codex[form].lives === 0;
    state.guarantee = null;
    state.pity = tier >= 3 ? 0 : state.pity + 1;
    const result = { tier, form, odds, isNew, fate };
    state.pending = { type: 'wheel', result };
    return result;
  };

  WS.startLife = function (state, result) {
    state.lifeNo += 1;
    state.life = WS.newLife(state, result.form, result.tier);
    state.pending = null;
    return state.life;
  };

  // ---------- 时间推进 ----------
  WS.step = function (state, dt, opt) {
    opt = opt || {};
    const out = [];
    if (!(dt > 0)) return out;
    const lq = WS.lingqiRate(state) * dt;
    state.lingqi += lq;
    state.lingqiTotal += lq;
    if (WS.warIdle && state.war) WS.warIdle(state, dt);
    const L = state.life;
    if (!L || L.ended || state.pending) return out;
    const F = WS.FORMS[L.form];

    const rate = WS.prodRate(state, L);
    L.main += rate * dt;
    L.totalMain += rate * dt;
    if (L.form === 'human') L.wenTotal += WS.wenRate(state, L) * dt;

    L.t += dt;
    if (L.skillActive > 0) L.skillActive = Math.max(0, L.skillActive - dt);
    if (L.skillCd > 0) L.skillCd = Math.max(0, L.skillCd - dt);

    if (L.form === 'dragon') L.leapWait = L.stage < WS.leapMax() && L.main >= WS.leapCost(L) ? (L.leapWait || 0) + dt : 0;
    if (L.form === 'xian' && L.peach) {
      const grow = WS.peachGrow(L);
      for (let i = 0; i < L.peach.length; i++) {
        L.peach[i] = Math.min(grow, L.peach[i] + dt);
        // 仙童侍奉：熟了就替你摘
        if (L.ups.boy && L.peach[i] >= grow) {
          const r = WS.pickPeach(state, L, i);
          if (r) out.push(Object.assign({ type: 'peach', auto: true, i }, r));
        }
      }
    }

    if (WS.hasAuto(L) && !L.autoOff) {
      L.autoAcc += dt;
      if (L.autoAcc >= 1) { L.autoAcc = 0; WS.autoBuy(state, L, 80, out, opt.rand); }
    }

    if (opt.online && !L.event && WS.formEvents(L).length) {
      L.nextEvent -= dt;
      if (L.nextEvent <= 0 && WS.spawnEvent(L)) out.push({ type: 'event' });
    }

    WS.checkMilestones(state, L, out);

    L.age += dt / F.yearSec;
    if (L.age >= L.lifespan) {
      L.age = L.lifespan;
      const summary = WS.endLife(state, 'natural');
      out.push({ type: 'end', summary });
    }
    return out;
  };

  // 离线补算：按现实经过的秒数，最多补到洞天的离线上限
  WS.catchUp = function (state, realSec) {
    const capSec = WS.offlineCapHours(state) * 3600;
    const capped = realSec > capSec;
    let remain = Math.min(realSec, capSec) * (state.speed || 1);
    const info = { realSec, capped, lingqi: 0, main: 0, milestones: [], unlocks: [], ended: null, form: state.life && state.life.form };
    const lq0 = state.lingqi;
    const xw0 = state.war ? state.war.box.xw : 0;
    const L = state.life;
    if (L && !L.ended && !state.pending) {
      const main0 = L.main + 0;
      const spent0 = L.totalMain;
      const stepSz = Math.max(1, Math.min(30, remain / 400));
      while (remain > 0 && !L.ended) {
        const d = Math.min(stepSz, remain);
        for (const e of WS.step(state, d, { online: false })) {
          if (e.type === 'milestone') info.milestones.push(e);
          if (e.type === 'unlock') info.unlocks.push(e.form);
          if (e.type === 'end') info.ended = e.summary;
        }
        remain -= d;
      }
      info.main = L.totalMain - spent0;
      info.mainLeft = L.main - main0;
    }
    if (remain > 0) {
      const g = WS.lingqiRate(state) * remain;
      state.lingqi += g;
      state.lingqiTotal += g;
      if (WS.warIdle && state.war) WS.warIdle(state, remain);
    }
    info.lingqi = state.lingqi - lq0;
    info.xw = state.war ? state.war.box.xw - xw0 : 0;
    return info;
  };

  // ---------- 数字和时间的写法 ----------
  const UNITS = [[1e44, '载'], [1e40, '正'], [1e36, '涧'], [1e32, '沟'], [1e28, '穰'], [1e24, '秭'], [1e20, '垓'], [1e16, '京'], [1e12, '兆'], [1e8, '亿'], [1e4, '万']];
  WS.fmt = function (n) {
    if (n === undefined || n === null || isNaN(n)) return '0';
    if (!isFinite(n)) return '∞';
    if (n < 0) return '-' + WS.fmt(-n);
    if (n >= 1e48) return n.toExponential(2).replace('e+', 'e');
    for (const [u, s] of UNITS) {
      if (n >= u) {
        const v = n / u;
        const t = v < 10 ? (Math.floor(v * 100) / 100).toFixed(2) : v < 100 ? (Math.floor(v * 10) / 10).toFixed(1) : String(Math.floor(v));
        return t + s;
      }
    }
    if (n < 10 && n % 1 !== 0) return (Math.floor(n * 10) / 10).toFixed(1);
    return String(Math.floor(n));
  };

  WS.fmtMerit = m => (Math.abs(m - Math.round(m)) < 0.05 ? String(Math.round(m)) : m.toFixed(1));

  WS.fmtTime = function (sec) {
    sec = Math.max(0, Math.floor(sec));
    const d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    if (d) return `${d} 天 ${h} 小时`;
    if (h) return `${h} 小时 ${m} 分`;
    if (m) return `${m} 分 ${s} 秒`;
    return `${s} 秒`;
  };

  WS.fmtClock = function (sec) {
    sec = Math.max(0, Math.ceil(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    return m ? `${m}:${String(s).padStart(2, '0')}` : `${s} 秒`;
  };
})(typeof window !== 'undefined' ? window : globalThis);
