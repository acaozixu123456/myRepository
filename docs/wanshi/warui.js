/* 万世洞天 · 征战诸天的界面
 * 诸天页（关卡、战场、挂机收益、魂魄境界、阵容）、战斗演出、布阵、前世卡册和卡的详情。
 * 规则都在 war.js；这里只管画面。ui.js 启动时调用 init，把它要用的工具交过来。
 */
(function () {
  'use strict';
  const WS = window.WS;
  const $ = id => document.getElementById(id);
  const setText = (e, s) => { s = String(s); if (e.textContent !== s) e.textContent = s; };
  const setHTML = (e, s) => { if (e._html !== s) { e._html = s; e.innerHTML = s; } };
  const setClass = (e, c) => { if (e.className !== c) e.className = c; };
  const CLS = { guard: '守', mage: '术', wu: '将', wen: '谋' };
  const SLOT_NAME = ['前排一', '前排二', '后排一', '后排二', '后排三'];

  let A = null;   // ui.js 交过来的工具
  let B = null;   // 正在演的一场仗
  let fieldKey = '', teamKey = '', bookKey = '';

  const S = () => A.state();

  // ---------- 卡片 ----------
  function cardTile(c, opt) {
    opt = opt || {};
    const st = S();
    const F = WS.FORMS[c.form];
    const lv = WS.cardLv(st, c), cap = WS.cardCap(c);
    const attr = opt.slot != null ? `data-slot="${opt.slot}"` : opt.still ? '' : `data-card="${c.id}"`;
    const tag = opt.inTeam ? '<span class="pc-badge">阵</span>' : '';
    const el = opt.still ? 'div' : 'button';
    return `<${el} ${el === 'button' ? 'type="button" ' : ''}class="pcard t${c.tier}" ${attr}>` +
      `<span class="pc-tier">${WS.TIERS[c.tier].name}</span><span class="pc-cls">${CLS[c.cls]}</span>` +
      `<span class="pc-glyph">${F.glyph}</span>` +
      `<span class="pc-name">${WS.cardTitle(c)}</span>` +
      `<span class="pc-meta">战力 ${WS.fmt(WS.cardPower(st, c))}</span>` +
      `<span class="pc-meta">Lv ${lv}${lv >= cap ? ' 满' : ''}</span>${tag}</${el}>`;
  }

  // ---------- 诸天页 ----------
  function render(force) {
    const st = S();
    const open = WS.warUnlocked(st);
    $('warLocked').hidden = open;
    $('warView').hidden = !open;
    if (!open) return;
    renderHead(st);
    if (!B) renderField(st, force);
    renderBox(st);
    renderSoul(st);
    renderTeam(st, force);
  }

  function renderHead(st) {
    const info = WS.stageInfo(st.war.stage + 1);
    setText($('warHeaven'), info.name);
    setText($('warStage'), `第 ${info.label} 关${info.boss ? ' · 首领' : ''}`);
    setHTML($('warPips'), Array.from({ length: 10 }, (_, i) => `<i class="${i < info.sub - 1 ? 'done' : i === info.sub - 1 ? 'cur' : ''}${i === 9 ? ' boss' : ''}"></i>`).join(''));
    const fate = st.war.fate;
    $('warFate').hidden = !fate;
    setText($('warFate'), `天命符 ×${fate}`);
    const btn = $('warFight');
    setText(btn, B ? '交战中…' : info.boss ? `挑战首领 ${info.label}` : `挑战 ${info.label}`);
    btn.disabled = !!B;
    $('warAuto').checked = !!st.war.autoNext;
  }

  function previewUnits(st) {
    const allies = WS.teamUnits(st);
    const foes = WS.stageFoes(st.war.stage + 1);
    const units = allies.concat(foes).map((u, i) => Object.assign({ i, front: u.slot < WS.WAR.front }, u));
    return { units, allies, foes };
  }

  function renderField(st, force) {
    const key = [st.war.stage, st.war.team.join(','), st.war.lv, st.cards.length, WS.totalFeat(st)].join('|');
    if (!force && key === fieldKey) return;
    fieldKey = key;
    const p = previewUnits(st);
    buildField(p.units, true);
    setText($('foePower'), `敌 ${WS.fmt(WS.teamPower(p.foes))}`);
    setText($('allyPower'), `我 ${WS.fmt(WS.teamPower(p.allies))}`);
    setText($('warRound'), '');
  }

  function unitTile(u) {
    const d = document.createElement('div');
    d.className = `unit s${u.side}${u.side === 0 ? ' t' + u.tier : ''}${u.boss ? ' boss' : ''}`;
    d.dataset.i = u.i;
    if (u.side === 0) d.dataset.slot = u.slot;
    const en = Math.min(100, u.en0 || 0);
    d.innerHTML = `<div class="u-glyph">${u.glyph}</div><div class="u-name">${u.name}</div>` +
      `<div class="u-bars"><div class="u-hp"><i></i></div><div class="u-en${en >= 100 ? ' full' : ''}"><i style="width:${en}%"></i></div></div>` +
      (u.boss ? '<span class="u-boss">首领</span>' : '');
    return d;
  }

  // 把双方摆上战场：敌人后排在最上，我方后排在最下
  function buildField(units, preview) {
    const rows = { foeBack: [], foeFront: [], allyFront: [], allyBack: [] };
    for (const u of units) {
      const k = (u.side ? 'foe' : 'ally') + (u.front ? 'Front' : 'Back');
      rows[k].push(u);
    }
    for (const k of Object.keys(rows)) {
      const box = $(k);
      box.innerHTML = '';
      rows[k].sort((a, b) => a.slot - b.slot).forEach(u => box.appendChild(unitTile(u)));
    }
    $('warFx').innerHTML = '';
    if (preview) {
      // 我方空着的位置：点一下去布阵
      const team = S().war.team;
      [[0, 1, 'allyFront'], [2, 3, 4, 'allyBack']].forEach(group => {
        const box = $(group[group.length - 1]);
        group.slice(0, -1).forEach(slot => {
          if (team[slot] != null) return;
          const d = document.createElement('div');
          d.className = 'unit empty';
          d.dataset.slot = slot;
          d.innerHTML = '<div class="u-glyph">＋</div><div class="u-name">空位</div>';
          const after = [...box.children].find(x => +x.dataset.slot > slot);
          box.insertBefore(d, after || null);
        });
      });
    }
  }

  const tile = i => $('warField').querySelector(`.unit[data-i="${i}"]`);

  function center(i) {
    const el = tile(i), f = $('warField');
    if (!el) return null;
    const r = el.getBoundingClientRect(), fr = f.getBoundingClientRect();
    return { x: r.left - fr.left + r.width / 2, y: r.top - fr.top + r.height * 0.32 };
  }

  function fxText(i, text, kind, delay) {
    const c = center(i);
    if (!c) return;
    const s = document.createElement('span');
    s.className = 'w-num ' + (kind || 'dmg');
    s.textContent = text;
    s.style.left = c.x + (Math.random() * 16 - 8) + 'px';
    s.style.top = c.y + 'px';
    if (delay) s.style.animationDelay = delay + 's';
    s.addEventListener('animationend', () => s.remove());
    $('warFx').appendChild(s);
  }

  function banner(i, name) {
    const c = center(i);
    if (!c) return;
    const s = document.createElement('div');
    s.className = 'w-banner';
    s.textContent = name;
    s.style.left = Math.max(60, Math.min($('warField').clientWidth - 60, c.x)) + 'px';
    s.style.top = c.y + (B.res.units[i].side ? 40 : -34) + 'px';
    s.addEventListener('animationend', () => s.remove());
    $('warFx').appendChild(s);
  }

  function shake(i) {
    const el = tile(i);
    if (!el) return;
    el.classList.remove('hit');
    void el.offsetWidth;
    el.classList.add('hit');
  }

  function paintUnit(i) {
    const el = tile(i);
    if (!el) return;
    const u = B.res.units[i];
    const hp = Math.max(0, B.hp[i]);
    el.querySelector('.u-hp i').style.width = (100 * hp / u.maxHp).toFixed(1) + '%';
    const en = Math.min(100, B.en[i]);
    const eb = el.querySelector('.u-en');
    eb.firstChild.style.width = en + '%';
    eb.classList.toggle('full', en >= 100);
    if (hp <= 0) el.classList.add('dead');
  }

  // ---------- 打一仗 ----------
  function fight() {
    const st = S();
    if (B) return;
    if (!WS.teamCards(st).some(Boolean)) { A.toast('阵里还没有前世卡，先去布阵'); return; }
    const s = st.war.stage + 1;
    const res = WS.fightStage(st, s);
    A.save();
    B = { s, res, k: 0, timer: 0, hp: res.units.map(u => u.maxHp), en: res.units.map(u => u.en0 || 0) };
    fieldKey = '';
    buildField(res.units, false);
    setText($('foePower'), `敌 ${WS.fmt(WS.teamPower(res.units.filter(u => u.side === 1)))}`);
    setText($('allyPower'), `我 ${WS.fmt(WS.teamPower(res.units.filter(u => u.side === 0)))}`);
    $('warCtrl').hidden = false;
    setText($('warSpeed'), st.war.fast ? '×2' : '×1');
    renderHead(st);
    A.syncMood(true);
    A.snd('drum');
    A.buzz(15);
    B.timer = setTimeout(step, 450);
  }

  const stepMs = () => (S().war.fast ? 300 : 600);

  function step() {
    if (!B || B.done) return;
    const ev = B.res.log[B.k++];
    if (!ev) { finish(); return; }
    const d = stepMs();
    if (ev.t === 'round') {
      setText($('warRound'), `第 ${ev.n} 回合`);
      B.timer = setTimeout(step, d * 0.25);
      return;
    }
    if (ev.t === 'skip') {
      fxText(ev.a, '被魅惑', 'tag');
      B.timer = setTimeout(step, d * 0.6);
      return;
    }
    const el = tile(ev.a);
    if (el) el.classList.add(ev.skill ? 'casting' : 'acting');
    let wait = d * 0.35;
    if (ev.skill) {
      banner(ev.a, ev.skill);
      A.snd('cast');
      wait = d * 0.8;
    }
    B.timer = setTimeout(() => {
      if (!B || B.done) return;
      applyAct(ev, true);
      if (el) el.classList.remove('acting', 'casting');
      B.timer = setTimeout(step, d * 0.65);
    }, wait);
  }

  function applyAct(ev, fx) {
    let crit = false, dead = false;
    for (const x of ev.hits) {
      B.hp[x.u] = x.hp;
      if (!x.dead) B.en[x.u] = Math.min(100, B.en[x.u] + WS.WAR.energy.hit);
      if (x.crit) crit = true;
      if (x.dead) dead = true;
      if (fx) {
        shake(x.u);
        fxText(x.u, (x.crit ? '暴击 -' : '-') + WS.fmt(x.dmg), x.crit ? 'crit' : 'dmg');
        if (x.charm) fxText(x.u, '魅惑', 'tag', 0.35);
      }
      paintUnit(x.u);
    }
    for (const x of ev.heals || []) {
      B.hp[x.u] = x.hp;
      if (fx && x.amt > 0) fxText(x.u, '+' + WS.fmt(x.amt), 'heal', ev.hits.length ? 0.25 : 0);
      paintUnit(x.u);
    }
    if (fx && ev.buff) fxText(ev.a, '全队攻击↑', 'tag', 0.3);
    B.en[ev.a] = ev.en;
    paintUnit(ev.a);
    if (fx) {
      if (dead) A.snd('die');
      else if (crit) A.snd('crit');
      else if (ev.hits.length) A.snd('hit');
      else if (ev.heals) A.snd('heal');
    }
  }

  function skip() {
    if (!B || B.done) return;
    clearTimeout(B.timer);
    while (B.k < B.res.log.length) {
      const ev = B.res.log[B.k++];
      if (ev.t === 'act') applyAct(ev, false);
      else if (ev.t === 'round') setText($('warRound'), `第 ${ev.n} 回合`);
    }
    $('warField').querySelectorAll('.acting,.casting').forEach(e => e.classList.remove('acting', 'casting'));
    finish();
  }

  function stamp(win) {
    const s = document.createElement('div');
    s.className = 'w-stamp ' + (win ? 'win' : 'lose');
    s.textContent = win ? '大捷' : '败退';
    $('warFx').appendChild(s);
  }

  function finish() {
    if (!B || B.done) return;
    const st = S();
    const { s, res } = B;
    clearTimeout(B.timer);
    B.done = true;
    const reward = res.win ? WS.winStage(st, s) : null;
    A.save();
    stamp(res.win);
    A.snd(res.win ? 'win' : 'lose');
    A.buzz(res.win ? [20, 40, 30] : 40);
    $('warCtrl').hidden = true;
    const auto = res.win && st.war.autoNext;
    setTimeout(() => {
      B = null;
      fieldKey = '';
      A.syncMood(true);
      if (auto && reward) {
        A.toast(`打通 ${WS.stageInfo(s).label}，修为 +${WS.fmt(reward.xw)}${reward.fate ? '，得天命符' : ''}`, 'gold');
        A.render(true);
        setTimeout(() => { if (!B && A.tab() === 'war' && !A.sheetOpen()) fight(); }, 600);
      } else {
        A.queueOverlay(sheet => sheetResult(sheet, s, res, reward), true);
        A.render(true);
      }
    }, 1000);
  }

  function sheetResult(sheet, s, res, reward) {
    const st = S();
    const info = WS.stageInfo(s);
    const r = WS.idleRate(st);
    if (res.win) {
      sheet.innerHTML = `
        <div class="w-result win"><div class="w-seal">大捷</div><div class="w-res-title">${info.name} · 第 ${info.sub} 关</div><div class="muted">${res.rounds} 个回合，我方 ${res.left} 人还站着</div></div>
        ${info.boss ? `<p class="center w-big">打通了${info.heaven}！</p>` : ''}
        <ul class="kv">
          <li><span>修为</span><b>+${WS.fmt(reward.xw)}</b></li>
          <li><span>洞天灵气</span><b>+${WS.fmt(reward.lq)}</b></li>
          ${reward.fate ? '<li><span>天命符</span><b>+1<span class="sub">下次转轮回盘用上它，至少投个上品</span></b></li>' : ''}
          <li><span>挂机</span><b>每分钟修为 +${WS.fmt(r.xw * 60)}<span class="sub">关打得越高，挂机攒得越快</span></b></li>
        </ul>
        <div class="btn-row"><button class="secondary" type="button" id="wrOk">好</button><button class="secondary" type="button" id="wrNext">下一关</button></div>`;
    } else {
      sheet.innerHTML = `
        <div class="w-result lose"><div class="w-seal">败退</div><div class="w-res-title">${info.name} · 第 ${info.sub} 关</div><div class="muted">${res.rounds >= WS.WAR.rounds ? `${WS.WAR.rounds} 个回合没分出胜负` : '全军覆没'}</div></div>
        <p class="center">差一点。可以收取挂机修为、提升魂魄境界，换上更强的前世卡，或者再试一次，每次的战况都不一样。</p>
        <div class="btn-row"><button class="secondary" type="button" id="wrOk">好</button><button class="secondary" type="button" id="wrNext">再战</button></div>`;
    }
    $('wrOk').onclick = A.closeSheet;
    $('wrNext').onclick = () => {
      A.closeSheet();
      if (A.tab() !== 'war') A.setTab('war');
      setTimeout(fight, 150);
    };
  }

  // ---------- 挂机 ----------
  function renderBox(st) {
    const box = st.war.box, sp = A.spd();
    const capH = WS.offlineCapHours(st), cap = capH * 3600;
    const r = WS.idleRate(st);
    setText($('wbRate'), `每分钟 修为 +${WS.fmt(r.xw * 60 * sp)}${r.lq > 0 ? ` · 灵气 +${WS.fmt(r.lq * 60 * sp)}` : ''}`);
    setText($('wbText'), box.sec >= cap ? `攒满 ${capH} 小时了，收取之后才会接着攒` : `挂机 ${WS.fmtTime(box.sec / sp)}（最多攒 ${capH} 小时）`);
    setText($('wbAmt'), WS.fmt(box.xw));
    const lqEl = $('wbLq');
    lqEl.hidden = box.lq < 1;
    if (box.lq >= 1) setText(lqEl, `另有灵气 ${WS.fmt(box.lq)}`);
    $('wbBar').style.width = Math.min(100, 100 * box.sec / cap).toFixed(1) + '%';
    const can = box.xw >= 1;
    setClass($('wbCollect'), 'buy-btn jade' + (can ? '' : ' cant'));
  }

  function collect() {
    const st = S();
    if (st.war.box.xw < 1) { A.toast('还没攒下修为，过一会儿再来'); return; }
    const got = WS.collectIdle(st);
    A.snd('collect');
    A.buzz(15);
    A.toast(`收取修为 +${WS.fmt(got.xw)}${got.lq >= 1 ? `，灵气 +${WS.fmt(got.lq)}` : ''}`, 'jade');
    A.save();
    render(true);
  }

  // ---------- 魂魄境界 ----------
  function affordable(st) {
    const W = WS.WAR;
    let x = st.war.xw, lv = st.war.lv, n = 0;
    while (n < 999 && lv < WS.maxCap()) {
      const c = Math.round(W.cost.base * Math.pow(W.cost.growth, lv - 1));
      if (x < c) break;
      x -= c;
      lv++;
      n++;
    }
    return n;
  }

  function renderSoul(st) {
    const war = st.war;
    setText($('soulRealm'), WS.realmName(war.lv));
    setText($('soulLv'), `魂魄 Lv ${war.lv}`);
    const done = war.lv >= WS.maxCap();
    const n = affordable(st);
    setText($('soulBtnN'), n > 1 ? `修炼 ×${n}` : '修炼');
    setText($('soulCost'), done ? '圆满' : WS.fmt(WS.lvCost(st)));
    setClass($('soulUp'), 'buy-btn' + (n > 0 ? '' : ' cant'));
    setText($('soulXw'), WS.fmt(war.xw));
  }

  function soulUp() {
    const st = S();
    if (st.war.lv >= WS.maxCap()) { A.toast('魂魄已经圆满'); return; }
    const k = WS.levelUp(st, 999);
    if (!k) {
      const box = st.war.box.xw >= 1 ? '，先收取挂机修为' : '';
      A.toast(`修为还差 ${WS.fmt(WS.lvCost(st) - st.war.xw)}${box}`);
      return;
    }
    A.snd('lvup');
    A.buzz(20);
    A.toast(`魂魄修到${WS.realmName(st.war.lv)}（Lv ${st.war.lv}），上阵的卡都变强了`, 'jade');
    A.save();
    render(true);
  }

  // ---------- 阵容 ----------
  function renderTeam(st, force) {
    const key = [st.war.team.join(','), st.war.lv, st.cards.length, WS.totalFeat(st)].join('|');
    if (!force && key === teamKey) return;
    teamKey = key;
    const cards = WS.teamCards(st);
    const slot = i => (cards[i] ? cardTile(cards[i], { slot: i }) : `<button type="button" class="pcard empty" data-slot="${i}"><span class="pc-glyph">＋</span><span class="pc-meta">${SLOT_NAME[i]}</span></button>`);
    $('teamFront').innerHTML = [0, 1].map(slot).join('');
    $('teamBack').innerHTML = [2, 3, 4].map(slot).join('');
    const syn = WS.synergy(cards);
    const chips = syn.list.map(x => `<span class="chip">${x.name} ×${x.n}：生命、攻击 +${Math.round(x.pct * 100)}%</span>`);
    if (syn.all) chips.push(`<span class="chip">三道同行：全队攻击 +${Math.round(WS.WAR.allThree * 100)}%</span>`);
    setHTML($('teamSyn'), chips.length ? chips.join('') : '<span class="muted">同一种生灵一起上阵有羁绊；蚂蚁、狐狸、凡人都在阵中，全队攻击再加成</span>');
  }

  function changed() {
    A.save();
    A.snd('toggle');
    teamKey = fieldKey = bookKey = '';
    A.render(true);
  }

  // 把一张卡放到某个位置；它原来在阵里的话，和那个位置上的卡对调
  function place(st, id, slot) {
    const team = st.war.team;
    const from = team.indexOf(id);
    const prev = team[slot];
    team[slot] = id;
    if (from >= 0 && from !== slot) team[from] = prev;
    changed();
  }

  function openPicker(slot) {
    if (B) { A.toast('打完这一仗再换人'); return; }
    if (!S().cards.length) return;
    A.queueOverlay(sheet => sheetPicker(sheet, slot), true);
  }

  function sheetPicker(sheet, slot) {
    const st = S();
    const cur = WS.findCard(st, st.war.team[slot]);
    const list = st.cards.slice().sort((a, b) => WS.cardPower(st, b) - WS.cardPower(st, a));
    const rows = list.map(c => {
      const where = st.war.team.indexOf(c.id);
      const F = WS.FORMS[c.form];
      return `<button type="button" class="row pick-row${where === slot ? ' on' : ''}" data-pick="${c.id}">` +
        `<span class="row-glyph pick-glyph t${c.tier}">${F.glyph}</span>` +
        `<span class="row-main"><span class="row-title">${WS.cardTitle(c)}<span class="count">${WS.TIERS[c.tier].name} · ${CLS[c.cls]}</span></span>` +
        `<span class="row-desc">${A.lifeTitle(c.no)} · 战力 ${WS.fmt(WS.cardPower(st, c))} · Lv ${WS.cardLv(st, c)}/${WS.cardCap(c)}</span></span>` +
        `<span class="pick-tag">${where >= 0 ? SLOT_NAME[where] : ''}</span></button>`;
    }).join('');
    sheet.innerHTML = `
      <h3>${SLOT_NAME[slot]}</h3>
      <p class="muted center">${slot < WS.WAR.front ? '前排先挨打，适合「守」的蚂蚁和「将」的凡人' : '后排安全些，适合「术」的狐狸和「谋」的凡人'}</p>
      <div class="list pick-list">${rows}</div>
      ${cur ? '<button class="secondary" type="button" id="pkEmpty">让这个位置空着</button>' : ''}
      <button class="secondary" type="button" id="pkClose">关闭</button>`;
    sheet.querySelectorAll('[data-pick]').forEach(b => {
      b.onclick = () => { place(st, +b.dataset.pick, slot); A.closeSheet(); };
    });
    if (cur) $('pkEmpty').onclick = () => { st.war.team[slot] = null; changed(); A.closeSheet(); };
    $('pkClose').onclick = A.closeSheet;
  }

  function autoTeam() {
    if (B) { A.toast('打完这一仗再换人'); return; }
    const st = S();
    WS.autoTeam(st);
    changed();
    A.toast('挑了最强的五张上阵', 'jade');
  }

  // ---------- 前世卡册 ----------
  function renderBook(force) {
    const st = S();
    const key = [st.cards.length, st.war.team.join(','), st.war.lv, WS.totalFeat(st)].join('|');
    if (!force && key === bookKey) return;
    bookKey = key;
    setText($('bookNote'), st.cards.length ? `${st.cards.length} 张` : '');
    const list = st.cards.slice().sort((a, b) => WS.cardPower(st, b) - WS.cardPower(st, a));
    $('book').innerHTML = list.length
      ? list.map(c => cardTile(c, { inTeam: st.war.team.indexOf(c.id) >= 0 })).join('')
      : '<div class="history-empty">走完一世，那一世就会化作第一张前世卡。</div>';
  }

  function sheetCard(sheet, id) {
    const st = S();
    const c = WS.findCard(st, id);
    if (!c) { A.closeSheet(); return; }
    const F = WS.FORMS[c.form], T = WS.TIERS[c.tier], C = WS.WAR.classes[c.cls];
    const v = WS.cardStats(st, c), sk = WS.cardSkill(c);
    const lv = WS.cardLv(st, c), cap = WS.cardCap(c);
    const where = st.war.team.indexOf(c.id);
    const slots = SLOT_NAME.map((n, i) => {
      const o = WS.findCard(st, st.war.team[i]);
      return `<button type="button" class="cd-slot${i === where ? ' on' : ''}" data-to="${i}"><b>${n}</b><span>${o ? WS.cardTitle(o) : '空'}</span></button>`;
    }).join('');
    sheet.innerHTML = `
      <div class="cd-head t${c.tier}">
        <div class="cd-glyph">${F.glyph}</div>
        <div class="cd-title"><span class="tier-tag">${T.name}</span>${WS.cardTitle(c)}</div>
        <div class="muted">${A.lifeTitle(c.no)}的${F.name} · ${C.name}（${C.role}）</div>
      </div>
      <div class="cd-stats">
        <div><b>${WS.fmt(v.hp)}</b><span>生命</span></div>
        <div><b>${WS.fmt(v.atk)}</b><span>攻击</span></div>
        <div><b>${WS.fmt(v.def)}</b><span>防御</span></div>
        <div><b>${Math.round(v.spd)}</b><span>速度</span></div>
      </div>
      <div class="cd-skill"><b>${sk.name}</b><span>${sk.desc}</span></div>
      <ul class="kv">
        <li><span>那一世</span><b>${c.best ? `走到「${c.best}」` : '一个目标也没达成'}<span class="sub">功德 ${WS.fmtMerit(c.merit)}</span></b></li>
        <li><span>出战等级</span><b>Lv ${lv} / ${cap}<span class="sub">${lv >= cap ? '到这张卡的上限了，品级越高、那一世走得越远，上限越高' : '跟着魂魄境界走'}</span></b></li>
      </ul>
      <div class="muted">放到阵中</div>
      <div class="cd-slot-grid">${slots}</div>
      ${where >= 0 ? '<button class="secondary" type="button" id="cdOff">下阵</button>' : ''}
      <button class="secondary" type="button" id="cdClose">关闭</button>`;
    sheet.querySelectorAll('[data-to]').forEach(b => {
      b.onclick = () => {
        if (B) { A.toast('打完这一仗再换人'); return; }
        place(st, c.id, +b.dataset.to);
        A.swapSheet(s => sheetCard(s, id), true);
      };
    });
    if (where >= 0) {
      $('cdOff').onclick = () => {
        if (B) { A.toast('打完这一仗再换人'); return; }
        st.war.team[where] = null;
        changed();
        A.swapSheet(s => sheetCard(s, id), true);
      };
    }
    $('cdClose').onclick = A.closeSheet;
  }

  // ---------- 对外 ----------
  function init(api) {
    A = api;
    $('warFight').addEventListener('click', fight);
    $('warSkip').addEventListener('click', skip);
    $('warSpeed').addEventListener('click', () => {
      const st = S();
      st.war.fast = !st.war.fast;
      setText($('warSpeed'), st.war.fast ? '×2' : '×1');
      A.save();
    });
    $('warAuto').addEventListener('change', e => { S().war.autoNext = !!e.target.checked; A.save(); });
    $('wbCollect').addEventListener('click', collect);
    $('soulUp').addEventListener('click', soulUp);
    $('teamAuto').addEventListener('click', autoTeam);
    $('team').addEventListener('click', e => {
      const b = e.target.closest('[data-slot]');
      if (b) openPicker(+b.dataset.slot);
    });
    $('warField').addEventListener('click', e => {
      if (B) return;
      const u = e.target.closest('.unit[data-slot]');
      if (u) openPicker(+u.dataset.slot);
    });
    $('book').addEventListener('click', e => {
      const b = e.target.closest('[data-card]');
      if (b) A.queueOverlay(sheet => sheetCard(sheet, +b.dataset.card), true);
    });
  }

  WS.WarUI = {
    init,
    render,
    renderBook,
    cardTile,
    battling: () => !!B,
    reset() {
      if (B) clearTimeout(B.timer);
      B = null;
      fieldKey = teamKey = bookKey = '';
      if ($('warCtrl')) $('warCtrl').hidden = true;
    },
    // 诸天页签上的小红点：有新卡，或者挂机攒了十分钟以上
    attention(st) {
      if (!WS.warUnlocked(st)) return false;
      return st.cards.length > (st.war.seenCards || 0) || st.war.box.sec >= 600 * A.spd();
    },
    seen(st) { st.war.seenCards = st.cards.length; },
    openCard(id) { A.queueOverlay(sheet => sheetCard(sheet, id), true); },
  };
})();
