/* 万世洞天 · 征战诸天的界面
 * 诸天页（关卡、战场、挂机收益、魂魄境界、阵容、法宝囊）、一步一步的战斗演出、布阵、前世卡册和卡的详情。
 * 规则都在 war.js；这里只管画面。ui.js 启动时调用 init，把它要用的工具交过来。
 */
(function () {
  'use strict';
  const WS = window.WS;
  const $ = id => document.getElementById(id);
  const setText = (e, s) => { s = String(s); if (e.textContent !== s) e.textContent = s; };
  const setHTML = (e, s) => { if (e._html !== s) { e._html = s; e.innerHTML = s; } };
  const setClass = (e, c) => { if (e.className !== c) e.className = c; };
  const CLS = { guard: '守', mage: '术', wu: '将', wen: '谋', sword: '剑', dragon: '龙', xian: '仙' };
  const BREAKERS = { mage: true, sword: true, dragon: true };
  const SLOT_NAME = ['前排一', '前排二', '后排一', '后排二', '后排三'];

  let A = null;   // ui.js 交过来的工具
  let B = null;   // 正在打的一场仗
  let fieldKey = '', teamKey = '', bookKey = '';

  const S = () => A.state();
  const fast = () => !!S().war.fast;

  // ---------- 卡片 ----------
  function relicBadge(st, c) {
    const r = WS.relicOf(st, c);
    if (!r) return '';
    const K = WS.relicKind(r.k);
    return `<span class="pc-relic t${r.t}" aria-label="法宝 ${K.name}">${K.glyph}</span>`;
  }

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
      `<span class="pc-meta">Lv ${lv}${lv >= cap ? ' 满' : ''}</span>${relicBadge(st, c)}${tag}</${el}>`;
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
    renderCtrl(st);
  }

  function renderCtrl(st) {
    setText($('warSpeed'), st.war.fast ? '速度 ×2' : '速度 ×1');
    const on = st.war.autoCast !== false;
    setText($('warCast'), on ? '大招 自动' : '大招 手动');
    setClass($('warCast'), 'secondary' + (on ? '' : ' on'));
  }

  function previewUnits(st) {
    const allies = WS.teamUnits(st);
    const foes = WS.stageFoes(st.war.stage + 1);
    const units = allies.concat(foes).map((u, i) => Object.assign({ i, front: u.slot < WS.WAR.front }, u));
    return { units, allies, foes };
  }

  function setPowers(units) {
    setText($('foePower'), `敌 ${WS.fmt(WS.teamPower(units.filter(u => u.side === 1)))}`);
    setText($('allyPower'), `我 ${WS.fmt(WS.teamPower(units.filter(u => u.side === 0)))}`);
  }

  function renderField(st, force) {
    const key = [st.war.stage, st.war.team.join(','), st.war.lv, st.cards.length, WS.totalFeat(st), st.cards.map(c => c.relic).join(',')].join('|');
    if (!force && key === fieldKey) return;
    fieldKey = key;
    const p = previewUnits(st);
    buildField(p.units, true);
    setPowers(p.units);
    setText($('warRound'), '');
  }

  function unitTile(u) {
    const d = document.createElement('div');
    d.className = `unit s${u.side}${u.side === 0 ? ' t' + u.tier : ''}${u.boss ? ' boss' : ''}`;
    d.dataset.i = u.i;
    if (u.side === 0) d.dataset.slot = u.slot;
    const en = Math.min(100, u.en0 || 0);
    d.innerHTML = `<div class="u-glyph">${u.glyph}</div><div class="u-name">${u.name}</div>` +
      `<div class="u-bars"><div class="u-hp"><i></i><b></b></div><div class="u-en${en >= 100 ? ' full' : ''}"><i style="width:${en}%"></i></div></div>` +
      (u.boss ? '<span class="u-boss">首领</span>' : '') + '<span class="u-state"></span>';
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
    $('warField').classList.toggle('battling', !preview);
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

  // 敌方小怪放技能：头顶一块朱红的牌子
  function banner(i, name) {
    const c = center(i);
    if (!c) return;
    const s = document.createElement('div');
    s.className = 'w-banner';
    s.textContent = name;
    s.style.left = Math.max(60, Math.min($('warField').clientWidth - 60, c.x)) + 'px';
    s.style.top = c.y + (B.units[i].side ? 40 : -34) + 'px';
    s.addEventListener('animationend', () => s.remove());
    $('warFx').appendChild(s);
  }

  // 大招：一道墨痕横过战场，写着招式的名字
  function cutIn(u, ev) {
    const s = document.createElement('div');
    s.className = `w-cut s${u.side}${u.side === 0 ? ' t' + u.tier : ''}${ev.big ? ' big' : ''}${fast() ? ' quick' : ''}`;
    s.innerHTML = `<span class="wc-ink"></span><span class="wc-glyph">${u.glyph}</span><span class="wc-text"><b>${ev.skill}</b><small>${ev.manual ? '亲手放出 · ' : ''}${u.name}</small></span>`;
    s.addEventListener('animationend', e => { if (e.target === s) s.remove(); });
    $('warFx').appendChild(s);
  }

  function shake(i) {
    const el = tile(i);
    if (!el) return;
    el.classList.remove('hit');
    void el.offsetWidth;
    el.classList.add('hit');
  }
  function quake(big) {
    const f = $('warField');
    f.classList.remove('quake', 'quake2');
    void f.offsetWidth;
    f.classList.add(big ? 'quake2' : 'quake');
  }

  // 按战斗里的真实状态，把每个单位画一遍
  function paintAll() {
    if (!B) return;
    const tipOn = (S().war.tipUlt || 0) < 3;
    for (const u of B.bs.U) {
      const el = tile(u.i);
      if (!el) continue;
      el.querySelector('.u-hp i').style.width = (100 * Math.max(0, u.hp) / u.maxHp).toFixed(1) + '%';
      el.querySelector('.u-hp b').style.width = u.shield > 0 ? Math.min(100, 100 * u.shield / u.maxHp).toFixed(1) + '%' : '0';
      const en = Math.min(100, u.en);
      const eb = el.querySelector('.u-en');
      eb.firstChild.style.width = en + '%';
      eb.classList.toggle('full', en >= 100);
      const ready = u.side === 0 && WS.canCast(B.bs, u.i);
      el.classList.toggle('dead', !u.alive);
      el.classList.toggle('ready', ready);
      el.classList.toggle('charging', !!u.charging);
      el.classList.toggle('charmed', !!u.charm && u.alive);
      el.classList.toggle('shielded', u.shield > 0 && u.alive);
      el.classList.toggle('primed', B.q.indexOf(u.i) >= 0);
      const label = !u.alive ? '' : u.charging ? '蓄力' : u.charm ? '魅惑' : ready ? (tipOn ? '点我放大招' : '大招') : '';
      setText(el.querySelector('.u-state'), label);
    }
  }

  // ---------- 打一仗 ----------
  function later(ms, fn) {
    if (!B) return;
    clearTimeout(B.timer);
    B.timer = setTimeout(fn, ms * (fast() ? 0.5 : 1));
  }

  function fight() {
    const st = S();
    if (B) return;
    if (!WS.teamCards(st).some(Boolean)) { A.toast('阵里还没有前世卡，先去布阵'); return; }
    const s = st.war.stage + 1;
    const bs = WS.stageBattle(st, s, st.war.autoCast === false);
    A.save();
    B = { s, bs, units: WS.battleUnits(bs), timer: 0, busy: false, q: [], done: false, broke: 0, casts: 0 };
    fieldKey = '';
    buildField(B.units, false);
    paintAll();
    setPowers(B.units);
    setText($('warRound'), '');
    $('warCtrl').hidden = false;
    renderHead(st);
    A.syncMood(true);
    A.snd('drum');
    A.buzz(15);
    const boss = B.units.find(u => u.boss);
    if (boss) warn(`首领「${boss.name}」`, '怒气满了它会先蓄力一回合，再放大招', false);
    later(boss ? 900 : 450, step);
  }

  function step() {
    if (!B || B.done) return;
    let ev = null;
    while (B.q.length && !ev) ev = WS.battleCast(B.bs, B.q.shift());
    if (!ev) ev = WS.battleNext(B.bs);
    if (!ev) { finish(); return; }
    play(ev);
  }

  function next(ev, gap) {
    if (ev.end) { paintAll(); later(gap, finish); return; }
    later(B.q.length ? 120 : gap, step);
  }

  function play(ev) {
    if (ev.t === 'round') {
      setText($('warRound'), `第 ${ev.n} 回合`);
      later(150, step);
      return;
    }
    if (ev.t === 'timeout') { finish(); return; }
    if (ev.t === 'skip') {
      fxText(ev.a, '被魅惑', 'tag');
      paintAll();
      next(ev, 320);
      return;
    }
    if (ev.t === 'charge') {
      paintAll();
      chargeWarn(ev);
      A.snd('charge');
      A.buzz([15, 30, 15]);
      next(ev, 1000);
      return;
    }
    const u = B.units[ev.a];
    const el = tile(ev.a);
    B.busy = true;
    let wind = 200;
    if (ev.skill) {
      if (u.side === 0 || ev.big) { cutIn(u, ev); wind = ev.big ? 950 : 640; }
      else { banner(ev.a, ev.skill); wind = 420; }
      if (u.side === 0) B.casts++;
      A.snd(ev.big ? 'roar' : 'cast');
      if (el) el.classList.add('casting');
    } else if (el) el.classList.add('acting');
    later(wind, () => {
      if (!B || B.done) return;
      applyAct(ev);
      if (el) el.classList.remove('acting', 'casting', 'primed');
      B.busy = false;
      next(ev, ev.skill ? 480 : 380);
    });
  }

  function applyAct(ev) {
    let crit = false, dead = false, broke = false;
    for (const x of ev.hits) {
      shake(x.u);
      fxText(x.u, (x.crit ? '暴击 -' : '-') + WS.fmt(x.dmg), x.crit ? 'crit' : 'dmg');
      if (x.ab) fxText(x.u, '护盾挡下 ' + WS.fmt(x.ab), 'shield', 0.2);
      if (x.broke) { fxText(x.u, '打断！', 'break', 0.15); broke = true; }
      if (x.charm) fxText(x.u, '魅惑', 'tag', 0.35);
      if (x.drain) fxText(x.u, `怒气 -${x.drain}`, 'tag', 0.3);
      if (x.crit) crit = true;
      if (x.dead) dead = true;
    }
    for (const x of ev.heals || []) {
      if (x.rev) fxText(x.u, '起死回生', 'break');
      else if (x.amt > 0) fxText(x.u, '+' + WS.fmt(x.amt), 'heal', ev.hits.length ? 0.25 : 0);
    }
    for (const x of ev.shields || []) fxText(x.u, '护盾 +' + WS.fmt(x.amt), 'shield');
    if (ev.buff) fxText(ev.a, '全队攻击↑', 'tag', 0.3);
    if (ev.cleanse) fxText(ev.a, '解除魅惑', 'tag', 0.3);
    if (ev.skill && ev.hits.length > 1) quake(ev.big);
    else if (ev.big || crit) quake(false);
    paintAll();
    if (broke) {
      B.broke++;
      A.snd('break');
      A.buzz([20, 30, 40]);
      clearWarn();
    } else if (dead) A.snd('die');
    else if (crit) A.snd('crit');
    else if (ev.hits.length) A.snd('hit');
    else if (ev.revive != null || ev.heals) A.snd('heal');
    else if (ev.shields) A.snd('heal');
  }

  // 战场中间的一行警示
  function warn(title, sub, hot) {
    clearWarn();
    const s = document.createElement('div');
    s.className = 'w-warn' + (hot ? ' hot' : '');
    s.id = 'warWarn';
    s.innerHTML = `<b>${title}</b>${sub ? `<small>${sub}</small>` : ''}`;
    s.addEventListener('animationend', e => { if (e.animationName === 'wwarnOut') s.remove(); });
    $('warFx').appendChild(s);
  }
  function clearWarn() {
    const w = $('warWarn');
    if (w) w.remove();
  }

  function chargeWarn(ev) {
    const st = S();
    const u = B.units[ev.a];
    const ready = B.bs.U.filter(x => x.side === 0 && BREAKERS[x.cls] && WS.canCast(B.bs, x.i));
    const has = B.bs.U.some(x => x.side === 0 && x.alive && BREAKERS[x.cls]);
    let sub;
    if (ready.length) sub = `快点亮着的${ready.map(x => B.units[x.i].name).join('、')}，打断它！`;
    else if (has) sub = '狐火、剑修、龙吟攒满怒气就能打断它';
    else sub = (st.war.tipCharge || 0) < 4 ? '扛住这一下。带上狐狸、修士或龙，就能打断蓄力' : '扛住这一下';
    st.war.tipCharge = (st.war.tipCharge || 0) + 1;
    warn(`${u.name}蓄力「${ev.skill}」`, sub, true);
    ready.forEach(x => { const el = tile(x.i); if (el) el.classList.add('urge'); });
  }

  function tapUnit(i) {
    if (!B || B.done) return;
    const u = B.bs.U[i];
    if (!u || u.side !== 0) return;
    if (!WS.canCast(B.bs, i)) {
      if (u.alive && !u.charm) fxText(i, `怒气 ${Math.floor(u.en)}/100`, 'tag');
      return;
    }
    if (B.q.indexOf(i) >= 0) return;
    B.q.push(i);
    const st = S();
    st.war.tipUlt = (st.war.tipUlt || 0) + 1;
    A.buzz(12);
    A.snd('tap');
    paintAll();
    if (!B.busy) { clearTimeout(B.timer); step(); }
  }

  function skip() {
    if (!B || B.done) return;
    clearTimeout(B.timer);
    B.q.length = 0;
    B.bs.auto = true;
    WS.battleRun(B.bs);
    clearWarn();
    $('warField').querySelectorAll('.acting,.casting,.urge').forEach(e => e.classList.remove('acting', 'casting', 'urge'));
    setText($('warRound'), `第 ${B.bs.round} 回合`);
    paintAll();
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
    const { s, bs } = B;
    clearTimeout(B.timer);
    B.done = true;
    clearWarn();
    const win = bs.win;
    const reward = win ? WS.winStage(st, s) : null;
    const res = { win, rounds: bs.round, left: WS.battleLeft(bs), timeout: !win && WS.battleLeft(bs) > 0, broke: B.broke, casts: B.casts };
    A.save();
    stamp(win);
    A.snd(win ? 'win' : 'lose');
    A.buzz(win ? [20, 40, 30] : 40);
    $('warCtrl').hidden = true;
    const auto = win && st.war.autoNext;
    setTimeout(() => {
      B = null;
      fieldKey = '';
      $('warField').classList.remove('battling');
      A.syncMood(true);
      if (auto && reward) {
        const loot = reward.relic ? `，得法宝${WS.relicKind(reward.relic.k).name}` : '';
        A.toast(`打通 ${WS.stageInfo(s).label}，修为 +${WS.fmt(reward.xw)}${reward.fate ? '，得天命符' : ''}${loot}`, 'gold');
        A.render(true);
        setTimeout(() => { if (!B && A.tab() === 'war' && !A.sheetOpen()) fight(); }, 600);
      } else {
        A.queueOverlay(sheet => sheetResult(sheet, s, res, reward), true);
        A.render(true);
      }
    }, 1000);
  }

  // 这件法宝，阵中谁戴上最划算
  function bestWearer(st, r) {
    let best = null, gain = 0;
    for (const c of WS.teamCards(st)) {
      if (!c) continue;
      const cur = WS.relicOf(st, c);
      const g = WS.relicPower(st, c, r) - (cur && cur.id !== r.id ? WS.relicPower(st, c, cur) : cur ? Infinity : 0);
      if (g > gain) { gain = g; best = c; }
    }
    return best ? { c: best, gain: Math.round(gain) } : null;
  }

  function relicRow(st, r, extra) {
    const K = WS.relicKind(r.k);
    const o = WS.relicOwner(st, r.id);
    return `<div class="relic-row t${r.t}"><span class="rl-glyph">${K.glyph}</span>` +
      `<span class="rl-main"><span class="rl-name">${K.name}<span class="tier-tag t${r.t}">${WS.TIERS[r.t].name}</span></span>` +
      `<span class="rl-desc">${WS.relicText(r)} · ${WS.cnNum(r.h)}重天${o ? ` · ${WS.cardTitle(o)}戴着` : ''}</span></span>${extra || ''}</div>`;
  }

  function sheetResult(sheet, s, res, reward) {
    const st = S();
    const info = WS.stageInfo(s);
    const r = WS.idleRate(st);
    if (res.win) {
      const loot = reward.relic;
      let lootHTML = '';
      if (loot) {
        const w = bestWearer(st, loot);
        lootHTML = `<div class="loot"><div class="loot-title">掉了一件法宝</div>${relicRow(st, loot)}` +
          (w ? `<button class="secondary" type="button" id="wrWear">给${WS.cardTitle(w.c)}戴上（战力 +${WS.fmt(w.gain)}）</button>` : '<p class="muted center">先收进法宝囊，阵中的卡戴着的更好。</p>') + '</div>';
      }
      const tactic = res.broke ? `打断了 ${res.broke} 次蓄力` : res.casts ? `放了 ${res.casts} 次大招` : '';
      sheet.innerHTML = `
        <div class="w-result win"><div class="w-seal">大捷</div><div class="w-res-title">${info.name} · 第 ${info.sub} 关</div><div class="muted">${res.rounds} 个回合，我方 ${res.left} 人还站着${tactic ? '，' + tactic : ''}</div></div>
        ${info.boss ? `<p class="center w-big">打通了${info.heaven}！</p>` : ''}
        ${lootHTML}
        <ul class="kv">
          <li><span>修为</span><b>+${WS.fmt(reward.xw)}</b></li>
          <li><span>洞天灵气</span><b>+${WS.fmt(reward.lq)}</b></li>
          ${reward.fate ? '<li><span>天命符</span><b>+1<span class="sub">下次转轮回盘用上它，至少投个上品</span></b></li>' : ''}
          <li><span>挂机</span><b>每分钟修为 +${WS.fmt(r.xw * 60)}<span class="sub">关打得越高，挂机攒得越快</span></b></li>
        </ul>
        <div class="btn-row"><button class="secondary" type="button" id="wrOk">好</button><button class="secondary" type="button" id="wrNext">下一关</button></div>`;
      const wear = $('wrWear');
      if (wear) {
        wear.onclick = () => {
          const w = bestWearer(st, loot);
          if (!w) return;
          WS.equipRelic(st, w.c.id, loot.id);
          changed();
          A.snd('bought');
          wear.replaceWith(Object.assign(document.createElement('p'), { className: 'muted center', textContent: `${WS.cardTitle(w.c)}戴上了${WS.relicKind(loot.k).name}。` }));
        };
      }
    } else {
      const boss = info.boss;
      const tip = boss
        ? '首领蓄力的那一回合是机会：点亮着的狐狸、修士或龙，打断它，那一下大招就落空了。大招可以随时点，不用等它自己的回合。'
        : '怒气满了的卡会亮起来，点它就能立刻放大招，不占它自己的回合，比等它自己放多打不少。';
      sheet.innerHTML = `
        <div class="w-result lose"><div class="w-seal">败退</div><div class="w-res-title">${info.name} · 第 ${info.sub} 关</div><div class="muted">${res.timeout ? `${WS.WAR.rounds} 个回合没分出胜负` : '全军覆没'}</div></div>
        <p class="center">${tip}</p>
        <p class="muted center">也可以收取挂机修为、提升魂魄、给卡戴上法宝，或者换上更强的前世卡。</p>
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
    setText($('wbRate'), `每分钟 修为 +${WS.fmt(r.xw * 60 * sp)}${r.lq > 0 ? ` · 灵气 +${WS.fmt(r.lq * 60 * sp)}` : ''}${st.war.stage > 0 ? ' · 每 20 分钟捡一件法宝' : ''}`);
    setText($('wbText'), box.sec >= cap ? `攒满 ${capH} 小时了，收取之后才会接着攒` : `挂机 ${WS.fmtTime(box.sec / sp)}（最多攒 ${capH} 小时）`);
    setText($('wbAmt'), WS.fmt(box.xw));
    const lqEl = $('wbLq');
    const extra = [];
    if (box.lq >= 1) extra.push(`灵气 ${WS.fmt(box.lq)}`);
    if (box.relics > 0) extra.push(`法宝 ×${box.relics}`);
    lqEl.hidden = !extra.length;
    if (extra.length) setText(lqEl, extra.join(' · '));
    $('wbBar').style.width = Math.min(100, 100 * box.sec / cap).toFixed(1) + '%';
    const can = box.xw >= 1 || box.relics > 0;
    setClass($('wbCollect'), 'buy-btn jade' + (can ? '' : ' cant'));
  }

  function collect() {
    const st = S();
    if (st.war.box.xw < 1 && !st.war.box.relics) { A.toast('还没攒下修为，过一会儿再来'); return; }
    const got = WS.collectIdle(st);
    A.snd('collect');
    A.buzz(15);
    const parts = [`修为 +${WS.fmt(got.xw)}`];
    if (got.lq >= 1) parts.push(`灵气 +${WS.fmt(got.lq)}`);
    if (got.relics.length) parts.push(`捡到法宝 ${got.relics.map(r => WS.relicKind(r.k).name).join('、')}`);
    A.toast('收取 ' + parts.join('，'), 'jade');
    A.save();
    teamKey = bookKey = '';
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
    const key = [st.war.team.join(','), st.war.lv, st.cards.length, WS.totalFeat(st), st.cards.map(c => c.relic).join(','), st.war.relics.length].join('|');
    if (!force && key === teamKey) return;
    teamKey = key;
    const cards = WS.teamCards(st);
    const slot = i => (cards[i] ? cardTile(cards[i], { slot: i }) : `<button type="button" class="pcard empty" data-slot="${i}"><span class="pc-glyph">＋</span><span class="pc-meta">${SLOT_NAME[i]}</span></button>`);
    $('teamFront').innerHTML = [0, 1].map(slot).join('');
    $('teamBack').innerHTML = [2, 3, 4].map(slot).join('');
    const syn = WS.synergy(cards);
    const chips = syn.list.map(x => `<span class="chip">${x.name} ×${x.n}：生命、攻击 +${Math.round(x.pct * 100)}%</span>`);
    if (syn.mix) chips.push(`<span class="chip">${syn.mixName}：${syn.kinds} 种生灵，全队攻击 +${Math.round(syn.mix * 100)}%</span>`);
    setHTML($('teamSyn'), chips.length ? chips.join('') : '<span class="muted">同一种生灵一起上阵有羁绊；三种以上不同的生灵同在阵中，全队攻击再加成</span>');
    const n = st.war.relics.length;
    const free = st.war.relics.filter(r => !WS.relicOwner(st, r.id)).length;
    setText($('relicBagN'), n ? `${n} 件${free ? ` · ${free} 件没人戴` : ''}` : '还没有，打赢了会掉，挂机也会捡到');
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
      <p class="muted center">${slot < WS.WAR.front ? '前排先挨打，适合「守」的蚂蚁、「将」的凡人和「龙」' : '后排安全些，适合「术」的狐狸、「谋」的凡人、「剑」的修士和「仙」'}</p>
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

  function autoEquip() {
    if (B) { A.toast('打完这一仗再换'); return; }
    const st = S();
    if (!st.war.relics.length) { A.toast('还没有法宝。打赢了会掉，挂机也会捡到'); return; }
    const before = WS.teamPower(WS.teamUnits(st));
    const n = WS.autoEquip(st);
    const after = WS.teamPower(WS.teamUnits(st));
    changed();
    A.toast(n ? `阵中 ${n} 张卡戴上了法宝，战力 ${after >= before ? '+' : ''}${WS.fmt(after - before)}` : '阵里还没有卡', 'jade');
  }

  // ---------- 法宝囊 ----------
  function sheetBag(sheet) {
    const st = S();
    const list = st.war.relics.slice().sort((a, b) => b.t - a.t || b.h - a.h || a.k.localeCompare(b.k));
    const junk = list.filter(r => r.t <= 1 && !WS.relicOwner(st, r.id));
    const junkXw = junk.reduce((a, r) => a + WS.meltValue(r), 0);
    const rows = list.map(r => relicRow(st, r, `<span class="rl-btns"><button type="button" class="buy-btn jade" data-wear="${r.id}"><span class="n">给谁戴</span></button><button type="button" class="buy-btn cant" data-melt="${r.id}"><span class="n">炼化</span><span class="c">+${WS.fmt(WS.meltValue(r))}</span></button></span>`)).join('');
    sheet.innerHTML = `
      <h3>法宝囊</h3>
      <p class="muted center">${list.length} / ${WS.WAR.relic.cap} 件。每张卡带一件；炼化换成修为。囊满了会自动炼化最差的那件。</p>
      <div class="relic-list">${rows || '<div class="history-empty">还没有法宝。打赢了会掉，首领必掉；挂机每二十分钟也会捡到一件。</div>'}</div>
      ${junk.length ? `<button class="secondary" type="button" id="bagJunk">炼化没人戴的凡品、良品（${junk.length} 件，修为 +${WS.fmt(junkXw)}）</button>` : ''}
      <button class="secondary" type="button" id="bagAuto">一键穿戴</button>
      <button class="secondary" type="button" id="bagClose">关闭</button>`;
    sheet.querySelectorAll('[data-wear]').forEach(b => {
      b.onclick = () => A.swapSheet(s => sheetWear(s, +b.dataset.wear), true);
    });
    sheet.querySelectorAll('[data-melt]').forEach(b => {
      b.onclick = () => {
        const v = WS.meltRelic(st, +b.dataset.melt);
        A.toast(`炼化成修为 +${WS.fmt(v)}`, 'jade');
        A.snd('collect');
        changed();
        A.swapSheet(sheetBag, true);
      };
    });
    const jb = $('bagJunk');
    if (jb) {
      jb.onclick = () => {
        let v = 0;
        junk.forEach(r => { v += WS.meltRelic(st, r.id); });
        A.toast(`炼化了 ${junk.length} 件，修为 +${WS.fmt(v)}`, 'jade');
        A.snd('collect');
        changed();
        A.swapSheet(sheetBag, true);
      };
    }
    $('bagAuto').onclick = () => { autoEquip(); A.swapSheet(sheetBag, true); };
    $('bagClose').onclick = A.closeSheet;
  }

  // 这件法宝给谁戴：列出阵中的卡和战力变化
  function sheetWear(sheet, rid) {
    const st = S();
    const r = st.war.relics.find(x => x.id === rid);
    if (!r) { A.swapSheet(sheetBag, true); return; }
    const cards = st.cards.slice().sort((a, b) => (st.war.team.indexOf(b.id) >= 0) - (st.war.team.indexOf(a.id) >= 0) || WS.cardPower(st, b) - WS.cardPower(st, a));
    const rows = cards.map(c => {
      const cur = WS.relicOf(st, c);
      const g = Math.round(WS.relicPower(st, c, r) - (cur ? WS.relicPower(st, c, cur) : 0));
      const where = st.war.team.indexOf(c.id);
      return `<button type="button" class="row pick-row${cur && cur.id === r.id ? ' on' : ''}" data-to="${c.id}">` +
        `<span class="row-glyph pick-glyph t${c.tier}">${WS.FORMS[c.form].glyph}</span>` +
        `<span class="row-main"><span class="row-title">${WS.cardTitle(c)}<span class="count">${where >= 0 ? SLOT_NAME[where] : '没上阵'}</span></span>` +
        `<span class="row-desc">${cur ? (cur.id === r.id ? '正戴着它' : `现在戴着${WS.relicKind(cur.k).name}`) : '没戴法宝'}</span></span>` +
        `<span class="pick-tag ${g >= 0 ? 'up' : 'down'}">${cur && cur.id === r.id ? '' : `战力 ${g >= 0 ? '+' : ''}${WS.fmt(g)}`}</span></button>`;
    }).join('');
    sheet.innerHTML = `
      <h3>给谁戴</h3>
      ${relicRow(st, r)}
      <div class="list pick-list">${rows}</div>
      <button class="secondary" type="button" id="wearBack">返回法宝囊</button>`;
    sheet.querySelectorAll('[data-to]').forEach(b => {
      b.onclick = () => {
        WS.equipRelic(st, +b.dataset.to, r.id);
        A.snd('bought');
        changed();
        A.swapSheet(sheetBag, true);
      };
    });
    $('wearBack').onclick = () => A.swapSheet(sheetBag, true);
  }

  // 给某张卡挑法宝
  function sheetRelicFor(sheet, cid) {
    const st = S();
    const c = WS.findCard(st, cid);
    if (!c) { A.closeSheet(); return; }
    const cur = WS.relicOf(st, c);
    const base = cur ? WS.relicPower(st, c, cur) : 0;
    const list = st.war.relics.slice().sort((a, b) => WS.relicPower(st, c, b) - WS.relicPower(st, c, a));
    const rows = list.map(r => {
      const g = Math.round(WS.relicPower(st, c, r) - base);
      const on = cur && cur.id === r.id;
      return `<button type="button" class="relic-pick${on ? ' on' : ''}" data-r="${r.id}">${relicRow(st, r, `<span class="pick-tag ${g >= 0 ? 'up' : 'down'}">${on ? '戴着' : `战力 ${g >= 0 ? '+' : ''}${WS.fmt(g)}`}</span>`)}</button>`;
    }).join('');
    sheet.innerHTML = `
      <h3>${WS.cardTitle(c)}的法宝</h3>
      <div class="relic-list">${rows || '<div class="history-empty">法宝囊是空的。打赢了会掉，挂机也会捡到。</div>'}</div>
      <button class="secondary" type="button" id="rfBack">返回</button>`;
    sheet.querySelectorAll('[data-r]').forEach(b => {
      b.onclick = () => {
        WS.equipRelic(st, c.id, +b.dataset.r);
        A.snd('bought');
        changed();
        A.swapSheet(s => sheetCard(s, cid), true);
      };
    });
    $('rfBack').onclick = () => A.swapSheet(s => sheetCard(s, cid), true);
  }

  // ---------- 前世卡册 ----------
  function renderBook(force) {
    const st = S();
    const key = [st.cards.length, st.war.team.join(','), st.war.lv, WS.totalFeat(st), st.cards.map(c => c.relic).join(',')].join('|');
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
    const r = WS.relicOf(st, c);
    const slots = SLOT_NAME.map((n, i) => {
      const o = WS.findCard(st, st.war.team[i]);
      return `<button type="button" class="cd-slot${i === where ? ' on' : ''}" data-to="${i}"><b>${n}</b><span>${o ? WS.cardTitle(o) : '空'}</span></button>`;
    }).join('');
    const extras = [];
    if (v.crit) extras.push(`暴击 +${Math.round(v.crit * 100)}%`);
    if (v.leech) extras.push(`吸血 ${Math.round(v.leech * 100)}%`);
    if (v.ult) extras.push(`大招伤害 +${Math.round(v.ult * 100)}%`);
    if (v.guard) extras.push(`减伤 ${Math.round(v.guard * 100)}%`);
    if (v.en) extras.push(`开场怒气 ${Math.round(Math.min(100, v.en))}`);
    if (v.eg) extras.push(`攒怒气 +${Math.round(v.eg * 100)}%`);
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
      ${extras.length ? `<p class="muted center cd-extra">${extras.join(' · ')}</p>` : ''}
      <div class="cd-skill"><b>${sk.name}</b><span>${sk.desc}</span></div>
      <div class="cd-relic">
        ${r ? relicRow(st, r) : '<div class="relic-row empty"><span class="rl-glyph">宝</span><span class="rl-main"><span class="rl-name">还没戴法宝</span><span class="rl-desc">打赢了会掉，挂机也会捡到</span></span></div>'}
        <div class="btn-row"><button class="secondary" type="button" id="cdRelic">${r ? '换一件' : '挑一件'}</button>${r ? '<button class="secondary" type="button" id="cdRelicOff">摘下</button>' : ''}</div>
      </div>
      <ul class="kv">
        <li><span>那一世</span><b>${c.best ? `走到「${c.best}」` : '一个目标也没达成'}<span class="sub">功德 ${WS.fmtMerit(c.merit)}</span></b></li>
        <li><span>出战等级</span><b>Lv ${lv} / ${cap}<span class="sub">${lv >= cap ? '到这张卡的上限了，品级越高、那一世走得越远，上限越高' : '跟着魂魄境界走'}</span></b></li>
      </ul>
      <div class="muted">放到阵中</div>
      <div class="cd-slot-grid">${slots}</div>
      ${where >= 0 ? `<div class="btn-row"><button class="secondary" type="button" id="cdSwap">换一张到${SLOT_NAME[where]}</button><button class="secondary" type="button" id="cdOff">下阵</button></div>` : ''}
      <button class="secondary" type="button" id="cdClose">关闭</button>`;
    sheet.querySelectorAll('[data-to]').forEach(b => {
      b.onclick = () => {
        if (B) { A.toast('打完这一仗再换人'); return; }
        place(st, c.id, +b.dataset.to);
        A.swapSheet(s => sheetCard(s, id), true);
      };
    });
    $('cdRelic').onclick = () => {
      if (B) { A.toast('打完这一仗再换'); return; }
      A.swapSheet(s => sheetRelicFor(s, id), true);
    };
    if (r) {
      $('cdRelicOff').onclick = () => {
        if (B) { A.toast('打完这一仗再换'); return; }
        WS.unequipRelic(st, c.id);
        changed();
        A.swapSheet(s => sheetCard(s, id), true);
      };
    }
    if (where >= 0) {
      $('cdSwap').onclick = () => {
        if (B) { A.toast('打完这一仗再换人'); return; }
        A.swapSheet(s => sheetPicker(s, where), true);
      };
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
      renderCtrl(st);
      A.save();
    });
    $('warCast').addEventListener('click', () => {
      const st = S();
      st.war.autoCast = st.war.autoCast === false;
      if (B) B.bs.auto = st.war.autoCast;
      renderCtrl(st);
      A.snd('toggle');
      A.toast(st.war.autoCast ? '大招自动：轮到它就放；你也可以随时点亮着的卡提前放' : '大招手动：只有你点了才放，怒气可以攒着等首领蓄力', 'jade');
      A.save();
    });
    $('warAuto').addEventListener('change', e => { S().war.autoNext = !!e.target.checked; A.save(); });
    $('wbCollect').addEventListener('click', collect);
    $('soulUp').addEventListener('click', soulUp);
    $('teamAuto').addEventListener('click', autoTeam);
    $('relicAuto').addEventListener('click', autoEquip);
    $('relicBag').addEventListener('click', () => {
      if (B) { A.toast('打完这一仗再看'); return; }
      A.queueOverlay(sheetBag, true);
    });
    $('team').addEventListener('click', e => {
      const b = e.target.closest('[data-slot]');
      if (!b) return;
      const st = S();
      const c = WS.findCard(st, st.war.team[+b.dataset.slot]);
      if (c && !B) A.queueOverlay(sheet => sheetCard(sheet, c.id), true);
      else openPicker(+b.dataset.slot);
    });
    $('warField').addEventListener('pointerdown', e => {
      if (!B) return;
      const u = e.target.closest('.unit[data-i]');
      if (u) tapUnit(+u.dataset.i);
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
      if ($('warField')) $('warField').classList.remove('battling');
    },
    // 诸天页签上的小红点：有新卡，挂机攒了十分钟以上，或者捡到了法宝
    attention(st) {
      if (!WS.warUnlocked(st)) return false;
      return st.cards.length > (st.war.seenCards || 0) || st.war.box.sec >= 600 * A.spd() || st.war.box.relics > 0;
    },
    seen(st) {
      st.war.seenCards = st.cards.length;
      if (st.war.gift > 0 && !st.war.giftSeen) {
        st.war.giftSeen = true;
        A.toast(`诸天新加了法宝：按你打到的关补发了 ${st.war.gift} 件，在阵容下面的法宝囊里`);
      }
    },
    openCard(id) { A.queueOverlay(sheet => sheetCard(sheet, id), true); },
  };
})();
