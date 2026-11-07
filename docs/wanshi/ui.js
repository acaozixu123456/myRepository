/* 万世洞天 · 界面
 * 把 core.js 的规则接到页面上：每一帧推进时间、刷新数字、响应点按，
 * 还有开场、轮回盘、投胎、一世总结、离线收益、设置这些弹层。
 */
(function () {
  'use strict';
  const WS = window.WS;
  const SAVE_KEY = 'wanshi-dongtian-v1';
  const KAI = '"Kaiti SC","STKaiti","KaiTi","BiauKai","TW-Kai","Songti SC","Noto Serif CJK SC",serif';
  const TAU = Math.PI * 2;
  const $ = id => document.getElementById(id);

  // ---------- 小工具 ----------
  function h(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function setText(e, s) { s = String(s); if (e.textContent !== s) e.textContent = s; }
  function setHTML(e, s) { if (e._html !== s) { e._html = s; e.innerHTML = s; } }
  function setDisabled(b, d) { if (b.disabled !== d) b.disabled = d; }
  function setClass(e, c) { if (e.className !== c) e.className = c; }
  const buzz = p => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* 不支持震动就算了 */ } };
  const reduceMotion = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const cssVar = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  const DIG = '零一二三四五六七八九';
  function cn(n) {
    n = Math.floor(n);
    if (n < 10) return DIG[n];
    if (n < 20) return '十' + (n % 10 ? DIG[n % 10] : '');
    if (n < 100) return DIG[Math.floor(n / 10)] + '十' + (n % 10 ? DIG[n % 10] : '');
    if (n < 1000) {
      const hd = Math.floor(n / 100), r = n % 100;
      if (!r) return DIG[hd] + '百';
      if (r < 10) return DIG[hd] + '百零' + DIG[r];
      return DIG[hd] + '百' + (r < 20 ? '一' : '') + cn(r);
    }
    return String(n);
  }
  const lifeTitle = n => `第${cn(n)}世`;
  const tierName = t => WS.TIERS[t].name;
  const pct = p => (p >= 0.1 ? Math.round(p * 100) + '%' : p >= 0.001 ? (p * 100).toFixed(1).replace(/\.0$/, '') + '%' : '<0.1%');
  const fmtMult = x => (x < 100 ? String(Math.round(x * 100) / 100) : WS.fmt(x));
  const fmtMinutes = m => (m < 1 ? `${Math.max(1, Math.round(m * 60))} 秒` : `${Math.round(m)} 分钟`);

  // ---------- 状态 ----------
  let state = null;
  let painter = null;
  let tab = 'life';
  let buyMode = 1;
  let lastTick = 0, lastRender = 0, lastSave = 0, lastPaint = 0;
  let started = false;
  const spd = () => state.speed || 1;

  // ---------- 声音 ----------
  const Sound = WS.Sound || null;
  const snd = (name, arg) => { if (Sound) Sound.play(name, arg); };
  function soundPrefs() {
    if (!state.sound || typeof state.sound !== 'object') state.sound = { music: true, sfx: true };
    return state.sound;
  }
  function applySound() {
    const S = soundPrefs();
    const b = $('btnSound');
    if (!Sound) { if (b) b.hidden = true; return; }
    Sound.setMusic(S.music);
    Sound.setSfx(S.sfx);
    const on = !!(S.music || S.sfx);
    b.classList.toggle('off', !on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  // 背景音乐跟着此刻的处境换调子；狐狸昼夜交替太快时（加速）不跟着来回切
  let moodWant = '', moodSince = 0, moodNow = '';
  function syncMood(force) {
    if (!Sound) return;
    const L = state.life;
    let m = 'between';
    if (L && !L.ended && !state.pending) m = L.form === 'fox' && WS.moonInfo(L).night ? 'fox-night' : L.form;
    const now = Date.now();
    if (m !== moodWant) { moodWant = m; moodSince = now; }
    const foxFlip = moodNow.indexOf('fox') === 0 && m.indexOf('fox') === 0;
    if (m !== moodNow && (force || !foxFlip || now - moodSince > 3000)) {
      moodNow = m;
      Sound.setMood(m);
    }
  }

  // ---------- 存档 ----------
  function migrate(s) {
    if (!s || typeof s !== 'object' || s.v !== 1) return null;
    const base = WS.newState();
    for (const k of Object.keys(base)) if (s[k] === undefined) s[k] = base[k];
    WS.FEATURES.forEach(f => { if (typeof s.feats[f.id] !== 'number') s.feats[f.id] = 0; });
    WS.FORM_ORDER.forEach(f => { if (!s.codex[f]) s.codex[f] = base.codex[f]; });
    if (s.life && !WS.FORMS[s.life.form]) { s.life = null; s.pending = { type: 'wheel', result: null }; }
    return s;
  }
  function load() {
    try { return migrate(JSON.parse(localStorage.getItem(SAVE_KEY) || 'null')); } catch (e) { return null; }
  }
  function save() {
    if (!state) return;
    state.lastSeen = Date.now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* 无痕模式等存不了档，照样能玩 */ }
  }

  // ---------- 提示 ----------
  function toast(text, kind) {
    const box = $('toasts');
    const t = h('div', 'toast' + (kind ? ' ' + kind : ''));
    t.textContent = text;
    box.appendChild(t);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => t.remove(), 2900);
  }

  function floatText(text, x, y) {
    const layer = $('floatLayer');
    if (layer.childElementCount > 14) layer.firstChild.remove();
    const r = layer.getBoundingClientRect();
    const f = h('div', 'float');
    f.textContent = text;
    f.style.left = (x - r.left) + 'px';
    f.style.top = (y - r.top - 22) + 'px';
    layer.appendChild(f);
    f.addEventListener('animationend', () => f.remove());
    setTimeout(() => f.remove(), 1200);
  }

  function flash(row) {
    if (!row) return;
    row.classList.remove('flash');
    void row.offsetWidth;
    row.classList.add('flash');
  }

  // ---------- 弹层队列 ----------
  // 同一时间只开一个弹层，其余的排队；“离开期间的收益”会排在“一世总结”前面
  const queue = [];
  let current = null;

  function queueOverlay(fn, dismiss) {
    queue.push({ fn, dismiss: !!dismiss });
    if (!current) nextOverlay();
  }
  function nextOverlay() {
    current = queue.shift() || null;
    const ov = $('overlay');
    if (!current) {
      ov.hidden = true;
      $('sheet').innerHTML = '';
      document.body.style.overflow = '';
      return;
    }
    ov.hidden = false;
    document.body.style.overflow = 'hidden';
    paintSheet(current.fn);
  }
  function paintSheet(fn) {
    const sheet = $('sheet');
    sheet.innerHTML = '';
    sheet.scrollTop = 0;
    sheet.style.animation = 'none';
    void sheet.offsetWidth;
    sheet.style.animation = '';
    fn(sheet);
    const first = sheet.querySelector('.primary');
    if (first) { try { first.focus({ preventScroll: true }); } catch (e) { /* 旧浏览器 */ } }
  }
  const closeSheet = () => nextOverlay();
  function swapSheet(fn, dismiss) {
    if (current) current.dismiss = !!dismiss;
    paintSheet(fn);
  }

  // ---------- 轮回之间：总结、轮回盘、投胎 ----------
  let pendingQueued = false;
  function showPending() {
    if (!state.pending || pendingQueued) return;
    pendingQueued = true;
    queueOverlay(renderPending, false);
  }
  function renderPending(sheet) {
    const p = state.pending;
    if (!p) { pendingQueued = false; closeSheet(); return; }
    if (p.type === 'summary') sheetSummary(sheet, p.summary);
    else if (p.result) sheetResult(sheet, p.result);
    else sheetWheel(sheet);
  }

  function sheetIntro(sheet) {
    sheet.innerHTML = `
      <div class="intro">
        <div class="intro-seal">万<br>世</div>
        <h3>万世洞天</h3>
        <p>你是一缕在轮回里漂了很久的魂魄。每一世活到寿终，都会在随身的洞天里留下一点东西。</p>
      </div>
      <p class="muted center">这一世也许是只蚂蚁，下一世也许是狐狸，是人。洞天越长越大，往后的每一世都会更顺。</p>
      <button class="primary" type="button" id="introGo">转动轮回盘</button>`;
    $('introGo').onclick = () => {
      state.introDone = true;
      save();
      pendingQueued = true;
      swapSheet(renderPending, false);
    };
  }

  function pityText() {
    const left = WS.PITY - state.pity;
    if (left <= 1) return '这一次<b>必出极品以上</b>';
    return `最多再转 <b>${left}</b> 次，必出极品以上`;
  }

  function formLine() {
    const parts = [];
    if (state.guarantee) parts.push(`这一世必定投胎为<b>${WS.FORMS[state.guarantee].name}</b>`);
    else parts.push('投胎为 ' + WS.formOdds(state).map(([f, p]) => `${WS.FORMS[f].name} ${pct(p)}`).join(' · '));
    const locked = WS.FORM_ORDER.find(f => state.unlocked.indexOf(f) < 0);
    if (locked) parts.push(`${WS.FORMS[locked].name}：${WS.FORMS[locked].unlockHint}后解锁`);
    return parts.join('<br>');
  }

  function cheapestFeature() {
    let best = null;
    for (const f of WS.FEATURES) {
      if (f.from) continue;
      const c = WS.featureCost(f, WS.featLv(state, f.id));
      if (!best || c < best) best = c;
    }
    return best;
  }

  function sheetWheel(sheet) {
    const odds = WS.tierOdds(state);
    const next = state.lifeNo + 1;
    const canShop = state.lingqi >= cheapestFeature();
    sheet.innerHTML = `
      <h3>轮回盘</h3>
      <p class="muted center">${lifeTitle(next)}${state.lifeNo ? ` · 上一世功德 ${WS.fmtMerit(state.lastMerit)}，好资质的机会 ×${WS.luckFactor(state).toFixed(2)}` : ''}</p>
      <div class="wheel-wrap" id="wheelWrap"><canvas width="580" height="580" id="wheelCanvas" role="img" aria-label="轮回盘"></canvas><div class="wheel-pointer" aria-hidden="true"></div></div>
      <div class="odds">${odds.map((p, i) => (p > 0 ? `<span class="t${i}"><b>${tierName(i)}</b>${pct(p)}</span>` : '')).join('')}</div>
      <p class="pity">${pityText()}</p>
      <p class="muted center">${formLine()}</p>
      <button class="primary" type="button" id="spinBtn">转动</button>
      ${canShop ? `<button class="secondary" type="button" id="shopFirst">先去洞天添置（灵气 ${WS.fmt(state.lingqi)}）</button>` : ''}`;
    const cv = $('wheelCanvas');
    drawWheel(cv, odds, 0);
    $('spinBtn').onclick = () => {
      const btn = $('spinBtn');
      btn.disabled = true;
      btn.textContent = '轮回中…';
      const shop = $('shopFirst');
      if (shop) shop.remove();
      const result = WS.spin(state);
      save();
      buzz(10);
      snd('spin');
      spinWheel(cv, result.odds, result.tier, () => swapSheet(s => sheetResult(s, result), false));
    };
    const shop = $('shopFirst');
    if (shop) {
      shop.onclick = () => {
        pendingQueued = false;
        closeSheet();
        setTab('cave');
      };
    }
  }

  function drawWheel(cv, odds, rot) {
    const ctx = cv.getContext('2d');
    const S = cv.width, c = S / 2, R = c - 18;
    const rim = cssVar('--ink-2'), paper2 = cssVar('--paper-2'), ink = cssVar('--ink'), onTier = cssVar('--on-tier');
    ctx.clearRect(0, 0, S, S);
    ctx.beginPath();
    ctx.arc(c, c, R + 12, 0, TAU);
    ctx.fillStyle = rim;
    ctx.fill();
    let acc = 0;
    odds.forEach((p, i) => {
      if (p <= 0) return;
      const a0 = -Math.PI / 2 + rot + acc * TAU, a1 = a0 + p * TAU;
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.arc(c, c, R, a0, a1);
      ctx.closePath();
      ctx.fillStyle = cssVar('--tier' + i);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = rim;
      ctx.stroke();
      if (p >= 0.045) {
        // 字从外圈往里竖排，转到指针下面时正好是正的
        const fs = Math.round(S * 0.064);
        ctx.save();
        ctx.translate(c, c);
        ctx.rotate((a0 + a1) / 2 + Math.PI / 2);
        ctx.fillStyle = onTier;
        ctx.font = `${fs}px ${KAI}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        tierName(i).split('').forEach((ch, j) => ctx.fillText(ch, 0, -(R - 26 - fs * 0.5) + j * fs * 1.08));
        ctx.restore();
      }
      acc += p;
    });
    // 外圈的刻度，像罗盘
    ctx.strokeStyle = paper2;
    ctx.lineWidth = 2;
    for (let i = 0; i < 60; i++) {
      const a = rot + (i / 60) * TAU;
      const r0 = R + (i % 5 ? 4 : 1), r1 = R + 10;
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0);
      ctx.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(c, c, R * 0.27, 0, TAU);
    ctx.fillStyle = paper2;
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = rim;
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.font = `${Math.round(S * 0.072)}px ${KAI}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('轮回', c, c + 2);
  }

  // 先定结果，再让盘子停到那一格：指针在正上方
  function spinWheel(cv, odds, tier, onDone) {
    const segStart = odds.slice(0, tier).reduce((a, b) => a + b, 0);
    const target = (segStart + odds[tier] * (0.15 + 0.7 * Math.random())) * TAU;
    const final = 6 * TAU + (((-target) % TAU) + TAU) % TAU;
    const dur = reduceMotion() ? 500 : 4200;
    let t0 = 0, skip = false, done = false, peg = 0;
    $('wheelWrap').onclick = () => { skip = true; };
    function tick(now) {
      if (done) return;
      if (!t0) t0 = now;
      let k = Math.min(1, (now - t0) / dur);
      if (skip) k = 1;
      const e = 1 - Math.pow(1 - k, 4);
      drawWheel(cv, odds, final * e);
      // 每转过一根“齿”响一下，越转越慢
      const p = Math.floor(final * e / (TAU / 12));
      if (p !== peg) { peg = p; snd('tick'); }
      if (k < 1) requestAnimationFrame(tick);
      else { done = true; setTimeout(onDone, 450); }
    }
    requestAnimationFrame(tick);
  }

  function sparks(box) {
    const cols = ['var(--tc)', 'var(--gold)', 'var(--seal)'];
    const n = 22;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + Math.random() * 0.3;
      const d = 70 + Math.random() * 80;
      const s = h('span', 'spark');
      s.style.setProperty('--dx', (Math.cos(a) * d).toFixed(1) + 'px');
      s.style.setProperty('--dy', (Math.sin(a) * d).toFixed(1) + 'px');
      s.style.setProperty('--c', cols[i % 3]);
      s.style.animationDelay = (Math.random() * 0.15).toFixed(2) + 's';
      box.appendChild(s);
    }
  }

  function sheetResult(sheet, r) {
    const F = WS.FORMS[r.form];
    const T = WS.TIERS[r.tier];
    const years = WS.lifespanFor(state, r.form, r.tier);
    const realMin = years * F.yearSec / spd() / 60;
    sheet.innerHTML = `
      <div class="result t${r.tier}">
        <div class="burst" id="burst"></div>
        <div class="result-glyph">${F.glyph}</div>
        <div class="result-tier">${T.name}</div>
        <div class="result-name">${F.name}</div>
        ${r.isNew ? '<div class="result-new">新的生灵</div>' : ''}
        <div class="result-stats">寿元 ${Math.round(years)} 年（约 ${fmtMinutes(realMin)}）· 产出 ×${T.mult}</div>
        <p class="result-intro">${F.intro}</p>
      </div>
      <button class="primary" type="button" id="bornBtn">投胎</button>`;
    if (r.tier >= 3 && !reduceMotion()) sparks($('burst'));
    if (r.tier >= 4) {
      const f = h('div', 'flash-screen');
      document.body.appendChild(f);
      setTimeout(() => f.remove(), 1000);
    }
    buzz(r.tier >= 3 ? [40, 60, 90] : 20);
    snd('result', r.tier);
    $('bornBtn').onclick = () => {
      WS.startLife(state, r);
      pendingQueued = false;
      save();
      closeSheet();
      setTab('life');
      syncMood(true);
      snd('born');
    };
  }

  function sheetSummary(sheet, s) {
    const F = WS.FORMS[s.form];
    const T = WS.TIERS[s.tier];
    const feat = WS.feature(s.legacy.id);
    sheet.innerHTML = `
      <div class="sum-head t${s.tier}">
        <div class="sum-glyph">${F.glyph}</div>
        <div>
          <div class="sum-title">${lifeTitle(s.no)} · ${T.name}${F.name}</div>
          <div class="muted">${s.reason === 'early' ? '提前坐化' : '寿终正寝'} · 活了 ${Math.floor(s.years)} 年</div>
        </div>
      </div>
      <ul class="kv">
        <li><span>这一世走到</span><b>${s.best || '还没达成目标'}</b></li>
        <li><span>功德</span><b>${WS.fmtMerit(s.merit)}<span class="sub">下一次轮回，好资质的机会 ×${WS.luckFactor(state).toFixed(2)}</span></b></li>
        <li><span>留在洞天</span><b>${feat.name} +${s.legacy.add}<span class="sub">现在 ${s.legacy.lv} 级，${WS.featureEffect(feat.id, s.legacy.lv)}</span></b></li>
        <li><span>洞天灵气</span><b>+${WS.fmt(s.lingqi)}</b></li>
      </ul>
      <p class="muted center">灵气可以在「洞天」页添置灵泉、云海、古松这些东西，每一样都会让往后的每一世更强。</p>
      <button class="primary" type="button" id="toWheel">进入轮回</button>`;
    $('toWheel').onclick = () => {
      state.pending = { type: 'wheel', result: null };
      save();
      swapSheet(renderPending, false);
    };
  }

  function sheetOffline(sheet, info) {
    const F = info.form && WS.FORMS[info.form];
    const rows = [`<li><span>洞天灵气</span><b>+${WS.fmt(info.lingqi)}</b></li>`];
    if (F && info.main > 0) rows.push(`<li><span>这一世的${F.mainName}</span><b>+${WS.fmt(info.main)}</b></li>`);
    if (info.milestones.length) rows.push(`<li><span>达成</span><b>${info.milestones.map(m => m.name).join('、')}</b></li>`);
    if (info.unlocks.length) rows.push(`<li><span>解锁新生灵</span><b>${info.unlocks.map(f => WS.FORMS[f].name).join('、')}</b></li>`);
    if (info.ended) rows.push('<li><span>这一世</span><b>在你离开时走完了</b></li>');
    sheet.innerHTML = `
      <h3>你回来了</h3>
      <p class="muted center">离开了 ${WS.fmtTime(info.realSec)}${info.capped ? `。离开时最多只算 ${WS.offlineCapHours(state)} 小时，洞天里的云海能延长` : ''}</p>
      <ul class="kv">${rows.join('')}</ul>
      <button class="primary" type="button" id="offOk">好</button>`;
    $('offOk').onclick = closeSheet;
  }

  function sheetSettings(sheet) {
    sheet.innerHTML = `
      <h3>设置</h3>
      <div class="setting">
        <div><b>背景音乐</b><div class="muted">古筝小调，每种前世一个调子</div></div>
        <div class="seg" id="musicSeg">${onOff(soundPrefs().music)}</div>
      </div>
      <div class="setting">
        <div><b>音效</b><div class="muted">敲木鱼、购买、转轮回盘的声音</div></div>
        <div class="seg" id="sfxSeg">${onOff(soundPrefs().sfx)}</div>
      </div>
      <p class="muted center small">听不到声音的话，看看手机是不是开了静音或把媒体音量调没了</p>
      <div class="setting">
        <div><b>试玩加速</b><div class="muted">时间按倍数流逝，用来快速体验一世又一世</div></div>
        <div class="seg" id="speedSeg">${[1, 5, 20].map(v => `<button type="button" data-v="${v}" class="${spd() === v ? 'on' : ''}">×${v}</button>`).join('')}</div>
      </div>
      <div class="setting">
        <div><b>重新开始</b><div class="muted">清空所有前世、洞天和灵气</div></div>
        <button class="danger" type="button" id="resetBtn">重来</button>
      </div>
      <p class="muted center">万世洞天 ${WS.VERSION} · 存档只保存在这台设备的浏览器里</p>
      <button class="secondary" type="button" id="setClose">关闭</button>`;
    sheet.querySelectorAll('#speedSeg button').forEach(b => {
      b.onclick = () => {
        state.speed = +b.dataset.v;
        sheet.querySelectorAll('#speedSeg button').forEach(x => x.classList.toggle('on', x === b));
        save();
        render(true);
      };
    });
    [['musicSeg', 'music'], ['sfxSeg', 'sfx']].forEach(([id, key]) => {
      sheet.querySelectorAll(`#${id} button`).forEach(b => {
        b.onclick = () => {
          soundPrefs()[key] = b.dataset.v === '1';
          sheet.querySelectorAll(`#${id} button`).forEach(x => x.classList.toggle('on', x === b));
          applySound();
          if (Sound) Sound.unlock();
          if (key === 'sfx') snd('toggle');
          save();
        };
      });
    });
    $('resetBtn').onclick = () => swapSheet(sheetReset, true);
    $('setClose').onclick = closeSheet;
  }
  const onOff = on => `<button type="button" data-v="1" class="${on ? 'on' : ''}">开</button><button type="button" data-v="0" class="${on ? '' : 'on'}">关</button>`;

  function sheetReset(sheet) {
    sheet.innerHTML = `
      <h3>真的要重来吗</h3>
      <p class="center">所有前世、图鉴、洞天和灵气都会清空，没法恢复。</p>
      <div class="btn-row">
        <button class="secondary" type="button" id="rsNo">算了</button>
        <button class="secondary warn" type="button" id="rsYes">清空重来</button>
      </div>`;
    $('rsNo').onclick = () => swapSheet(sheetSettings, true);
    $('rsYes').onclick = resetAll;
  }

  function sheetEndEarly(sheet) {
    const L = state.life;
    if (!L || L.ended) { closeSheet(); return; }
    sheet.innerHTML = `
      <h3>提前坐化</h3>
      <p class="center">这一世到此为止，功德和成就照常结算。<br>寿元还剩 ${Math.ceil(L.lifespan - L.age)} 年。</p>
      <div class="btn-row">
        <button class="secondary" type="button" id="eeNo">再活一会</button>
        <button class="secondary warn" type="button" id="eeYes">坐化</button>
      </div>`;
    $('eeNo').onclick = closeSheet;
    $('eeYes').onclick = () => {
      if (!WS.endLife(state, 'early')) { closeSheet(); return; }
      save();
      buzz(30);
      syncMood(true);
      snd('end');
      pendingQueued = true;
      swapSheet(renderPending, false);
    };
  }

  function resetAll() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* 无所谓 */ }
    const keepSound = soundPrefs();
    state = WS.newState();
    state.sound = keepSound;
    pendingQueued = false;
    queue.length = 0;
    current = null;
    built = ''; caveKey = ''; pastKey = '';
    save();
    setTab('life');
    queueOverlay(sheetIntro, false);
  }

  // ---------- 时间推进 ----------
  function handle(events) {
    for (const e of events) {
      if (e.type === 'milestone') {
        toast(`达成「${e.name}」· 功德 +${WS.fmtMerit(e.merit)}`, 'gold');
        buzz(15);
        snd('milestone');
      } else if (e.type === 'unlock') {
        const F = WS.FORMS[e.form];
        toast(`解锁新生灵：${F.name}。下一次轮回必定投胎为${F.name}`, 'jade');
        buzz([20, 40, 20]);
        snd('unlock');
      } else if (e.type === 'event') {
        const ev = state.life && WS.EVENTS.find(x => x.id === state.life.event);
        if (ev && tab !== 'life') toast(`村里有事：${ev.title}`);
        snd('event');
      } else if (e.type === 'bought') {
        toast(`攒够了，买下${e.name}`, 'gold');
        buzz(15);
        snd('bought');
      } else if (e.type === 'end') {
        onLifeEnded();
      }
    }
  }

  function onLifeEnded() {
    save();
    buzz([30, 60, 30]);
    syncMood(true);
    snd('end');
    showPending();
  }

  function afterAction() {
    const L = state.life;
    if (L && !L.ended) {
      const out = [];
      WS.checkMilestones(state, L, out);
      handle(out);
    }
    save();
    render(true);
  }

  function advance(sec, online) {
    let left = sec;
    while (left > 0) {
      const d = Math.min(5, left);
      left -= d;
      handle(WS.step(state, d, { online }));
      if (!state.life || state.life.ended || state.pending) {
        // 这一世已经结束，剩下的时间只给洞天攒灵气
        if (left > 0) WS.step(state, left, { online });
        break;
      }
    }
  }

  // 切回来时补算离开的这段时间
  function welcomeBack(gap) {
    const info = WS.catchUp(state, gap);
    if (gap >= 300) queueOverlay(s => sheetOffline(s, info), true);
    else if (info.lingqi >= 1) toast(`离开 ${WS.fmtTime(gap)}，灵气 +${WS.fmt(info.lingqi)}`);
    if (info.ended) onLifeEnded();
    save();
    render(true);
  }

  function frame() {
    requestAnimationFrame(frame);
    const now = Date.now();
    const gap = (now - lastTick) / 1000;
    lastTick = now;
    if (gap > 20) welcomeBack(gap);
    else if (gap > 0) advance(gap * spd(), true);
    if (now - lastRender >= 120) { lastRender = now; render(false); }
    if (tab === 'cave' && now - lastPaint >= 33) { lastPaint = now; painter.draw(performance.now() / 1000); }
    if (now - lastSave >= 5000) { lastSave = now; save(); }
  }

  // ---------- 画面 ----------
  function render(force) {
    syncMood(false);
    renderTop();
    if (tab === 'life') renderLife(force);
    else if (tab === 'cave') renderCave(force);
    else renderPast(force);
  }

  function renderTop() {
    const L = state.life;
    let sub = '轮回之间';
    if (L && !L.ended) sub = `${lifeTitle(state.lifeNo)} · ${WS.FORMS[L.form].realm}`;
    if (spd() > 1) sub += ` · 加速 ×${spd()}`;
    setText($('lifeNo'), sub);
    setText($('lqChipValue'), WS.fmt(state.lingqi));
  }

  function setTab(t) {
    tab = t;
    document.querySelectorAll('.tab').forEach(s => s.classList.toggle('is-active', s.id === 'tab-' + t));
    document.querySelectorAll('.tabbtn').forEach(b => {
      const on = b.dataset.tab === t;
      b.classList.toggle('is-active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    window.scrollTo(0, 0);
    if (t === 'cave') { painter.resize(); lastPaint = 0; }
    render(true);
  }

  // ---------- 此世 ----------
  let built = '';
  const LR = { genKey: '', upKey: '', genRows: [], upRows: [], eventId: undefined };

  const genOrder = F => WS.allGens(F).slice().sort((a, b) => a.cost - b.cost);

  function buildLife(L) {
    const F = WS.FORMS[L.form];
    built = state.lifeNo + ':' + L.form;
    setText($('lifeGlyph'), F.glyph);
    setClass($('lifeGlyph'), 'life-glyph t' + L.tier);
    setText($('lifeTier'), tierName(L.tier));
    setClass($('lifeTier'), 'tier-tag t' + L.tier);
    setText($('lifeName'), F.name);
    setText($('mainLabel'), F.mainName);
    setText($('tapName'), F.tapName);
    setText($('skillName'), F.skill.name);
    $('skillBtn').title = F.skill.desc;
    buildFormPanel(L);
    $('msChips').innerHTML = F.milestones.map(m => `<span class="ms-chip" data-id="${m.id}">${m.name}</span>`).join('');
    LR.genKey = '';
    LR.upKey = '';
    LR.eventId = undefined;
  }

  function buildFormPanel(L) {
    const p = $('formPanel');
    const auto = '<button class="chip chip-btn" type="button" id="fpAuto" hidden></button>';
    if (L.form === 'ant') {
      p.innerHTML = `<div class="chip-row"><span class="chip">蚁群 <b id="fpPop">1</b> 只</span>${auto}</div>`;
    } else if (L.form === 'fox') {
      p.innerHTML = `
        <div class="tails-box">
          <div class="tails" id="fpTails" aria-hidden="true">${'<span class="tail"></span>'.repeat(9)}</div>
          <div class="tails-foot"><span id="fpTailText"></span><button class="buy-btn jade" type="button" id="fpCondense"><span class="n">凝尾</span><span class="c" id="fpTailCost"></span></button></div>
        </div>
        <div class="chip-row"><span class="chip" id="fpMoon"></span>${auto}</div>`;
      $('fpCondense').onclick = () => {
        const Lx = state.life;
        if (!Lx || Lx.ended || Lx.tails >= 9) return;
        if (WS.condenseTail(state, Lx)) {
          if (isWanted(Lx, 'tail', 'tail')) Lx.saveFor = null;
          buzz(25);
          snd('condense');
          afterAction();
          return;
        }
        wantThis(Lx, { kind: 'tail', id: 'tail' }, '下一尾', WS.tailCost(Lx));
      };
    } else {
      p.innerHTML = `
        <div class="chip-row"><span class="chip" id="fpPeople"></span><span class="chip" id="fpWen"></span><span class="chip" id="fpRank"></span>${auto}</div>
        <div id="fpEvent"></div>`;
    }
    $('fpAuto').onclick = () => {
      const Lx = state.life;
      if (!Lx || Lx.ended) return;
      Lx.autoOff = !Lx.autoOff;
      snd('toggle');
      if (Lx.autoOff) toast('自动经营暂停了，钱都留给你自己花');
      else toast('自动经营继续', 'jade');
      save();
      render(true);
    };
  }

  // 点了买不起的东西：开着自动经营时，让它先攒钱买这个；再点一次就取消
  const isWanted = (L, kind, id) => !!(L.saveFor && L.saveFor.kind === kind && L.saveFor.id === id);

  function wantThis(L, target, name, cost) {
    const F = WS.FORMS[L.form];
    if (!WS.hasAuto(L) || L.autoOff) {
      toast(`${F.mainName}还差 ${WS.fmt(Math.max(0, cost - L.main))}`);
      return;
    }
    snd('want');
    if (isWanted(L, target.kind, target.id)) {
      L.saveFor = null;
      toast('不攒了，自动经营照常花钱');
    } else {
      L.saveFor = target;
      toast(`开始攒钱买${name}，攒够了自动买下`, 'jade');
    }
    save();
    render(true);
  }

  function buildEvent(L) {
    const box = $('fpEvent');
    if (!L.event) { box.innerHTML = ''; return; }
    const e = WS.EVENTS.find(x => x.id === L.event);
    box.innerHTML = `
      <div class="event-card">
        <div class="event-title">${e.title}</div>
        <p class="event-text">${e.text}</p>
        <div class="event-choices">
          <button type="button" data-k="a"><b>${e.a.label}</b><small>${e.a.desc}</small></button>
          <button type="button" data-k="b"><b>${e.b.label}</b><small>${e.b.desc}</small></button>
        </div>
      </div>`;
    box.querySelectorAll('button').forEach(b => {
      b.onclick = () => {
        const c = WS.resolveEvent(state, state.life, b.dataset.k);
        if (c) { toast(c.label); snd('choose'); }
        afterAction();
      };
    });
  }

  function rankName(L) {
    let r = '白身';
    for (const m of WS.FORMS.human.milestones) if (m.stat === 'wen' && L.ms.indexOf(m.id) >= 0) r = m.name;
    return r;
  }

  function renderFormPanel(L) {
    const sp = spd();
    const autoChip = $('fpAuto');
    if (autoChip) {
      const has = WS.hasAuto(L);
      autoChip.hidden = !has;
      if (has) {
        let txt;
        if (L.autoOff) txt = '自动经营已暂停 · 点这里继续';
        else if (L.saveFor) txt = `自动经营在攒钱买${WS.targetName(L)} · 点这里暂停`;
        else txt = '自动经营中 · 点这里暂停';
        setText(autoChip, txt);
        setClass(autoChip, 'chip chip-btn' + (L.autoOff ? ' off' : ''));
      }
    }
    if (L.form === 'ant') {
      setText($('fpPop'), WS.fmt(WS.antPop(L)));
    } else if (L.form === 'fox') {
      const tails = $('fpTails').children;
      for (let i = 0; i < 9; i++) tails[i].classList.toggle('on', i < L.tails);
      const full = L.tails >= 9;
      const cost = WS.tailCost(L);
      setText($('fpTailText'), `${cn(L.tails)}尾 · 月华 ×${fmtMult(Math.pow(WS.FORMS.fox.tail.mult, L.tails - 1))}`);
      setText($('fpTailCost'), full ? '圆满' : WS.fmt(cost));
      const cBtn = $('fpCondense');
      const cWant = isWanted(L, 'tail', 'tail');
      const cCan = !full && L.main >= cost;
      setClass(cBtn, 'buy-btn jade' + (cCan || full ? '' : ' cant') + (cWant ? ' want' : ''));
      setDisabled(cBtn, full);
      setText(cBtn.querySelector('.n'), cWant && !cCan ? '攒钱中' : '凝尾');
      const mi = WS.moonInfo(L);
      const left = WS.fmtClock(mi.left / sp);
      let txt, cls = 'chip';
      if (!mi.night) {
        txt = `白天 · ${left}后入夜` + (mi.toFull === 0 ? ' · 今夜满月' : '');
      } else {
        txt = `${mi.full ? '满月夜' : '夜里'} · 月华 ×${WS.nightMult(L)} · ${left}后天亮`;
        cls = mi.full ? 'chip full' : 'chip night';
      }
      const m = $('fpMoon');
      setText(m, txt);
      setClass(m, cls);
    } else {
      setHTML($('fpPeople'), `人丁 <b>${WS.fmt(L.people)}</b> · 产粮 +${WS.fmt(Math.round(WS.perPeople(L) * L.people * 100))}%`);
      const wr = WS.wenRate(state, L);
      setHTML($('fpWen'), `文气 <b>${WS.fmt(L.wenTotal)}</b>` + (wr > 0 ? ` +${WS.fmt(wr * sp)}/秒` : ' · 盖学堂才有'));
      setHTML($('fpRank'), `功名 <b>${rankName(L)}</b>`);
      if (LR.eventId !== L.event) { LR.eventId = L.event; buildEvent(L); }
    }
  }

  function prevThreshold(F, ms) {
    let prev = 1;
    for (const m of F.milestones) {
      if (m === ms) break;
      if (m.stat === ms.stat) prev = m.at;
    }
    return prev;
  }

  // 这一世明显走不动了，就提醒可以提前坐化
  function stallHint(L, F, next) {
    if (!next || !WS.canEndEarly(L)) return '';
    const leftSec = (L.lifespan - L.age) * F.yearSec;
    if (next.stat === 'tails') {
      const avgNight = (1 + (L.ups.night ? 3 : 2) * 1.2) / 2;
      const rate = WS.prodRate(state, L, { noSkill: true, noNight: true }) * avgNight;
      const need = WS.tailCost(L) - L.main;
      if (need > 0 && rate > 0 && need / rate > leftSec * 3) return '照现在的速度，这一世凝不出下一尾了。可以提前坐化，带着功德去下一世。';
      return '';
    }
    if (L.t - (L.lastMsT || 0) > 0.2 * L.lifespan * F.yearSec) return '进展慢下来了。也可以提前坐化，带着功德去下一世。';
    return '';
  }

  function renderGoal(L, F) {
    const next = F.milestones.find(m => L.ms.indexOf(m.id) < 0);
    let name, merit, p, txt;
    if (!next) {
      name = '此世圆满';
      merit = '';
      p = 1;
      txt = '目标都达成了。可以安心坐化，也可以继续攒到寿终。';
    } else {
      const v = WS.statValue(L, next.stat);
      name = next.name;
      merit = `功德 +${WS.fmtMerit(next.merit * WS.meritMult(state))}`;
      if (next.unlock && state.unlocked.indexOf(next.unlock) < 0) merit += ` · 解锁${WS.FORMS[next.unlock].name}`;
      if (next.stat === 'tails') {
        const c = WS.tailCost(L);
        p = L.main / c;
        txt = `月华 ${WS.fmt(L.main)} / ${WS.fmt(c)}，攒够就能凝出第${cn(L.tails + 1)}尾`;
      } else if (next.stat === 'people') {
        p = v / next.at;
        txt = `人丁 ${WS.fmt(v)} / ${WS.fmt(next.at)}`;
      } else {
        const prev = prevThreshold(F, next);
        p = (Math.log(Math.max(1, v)) - Math.log(prev)) / (Math.log(next.at) - Math.log(prev));
        txt = `${next.stat === 'pop' ? '蚁群' : '文气'} ${WS.fmt(v)} / ${WS.fmt(next.at)}`;
      }
    }
    setText($('goalName'), name);
    setText($('goalMerit'), merit);
    $('goalBar').style.width = (100 * Math.max(0, Math.min(1, p))).toFixed(1) + '%';
    setText($('goalText'), txt);
    const hint = stallHint(L, F, next);
    $('goalHint').hidden = !hint;
    setText($('goalHint'), hint);
    for (const chip of $('msChips').children) chip.classList.toggle('done', L.ms.indexOf(chip.dataset.id) >= 0);
  }

  function genDesc(L, g, owned, pm) {
    const sp = spd();
    if (g.people) return `每间住 ${g.people} 口人，每口人让产粮 +${Math.round(WS.perPeople(L) * 100)}%`;
    if (g.wen) {
      const per = g.wen * (1 + 0.15 * L.tier) * (L.ups.books ? 3 : 1) * sp;
      return `每座 +${WS.fmt(per)} 文气/秒` + (owned ? ` · 共 +${WS.fmt(per * owned)}` : '');
    }
    const per = g.prod * pm;
    let s = `每个 +${WS.fmt(per)}/秒`;
    if (owned) s += ` · 共 +${WS.fmt(per * owned)}/秒`;
    if (g.pop) s += ` · 添 ${WS.fmt(g.pop)} 只蚁`;
    return s;
  }

  function makeRow(id, glyph, name) {
    const row = h('div', 'row');
    row.dataset.id = id;
    row.innerHTML = `<div class="row-glyph" aria-hidden="true">${glyph}</div><div class="row-main"><div class="row-title"><span class="nm">${name}</span><span class="count"></span></div><div class="row-desc"></div></div>`;
    return row;
  }
  function addBuyBtn(row, jade) {
    const btn = h('button', 'buy-btn' + (jade ? ' jade' : ''), '<span class="n"></span><span class="c"></span>');
    btn.type = 'button';
    row.appendChild(btn);
    return btn;
  }

  function renderGens(L, F) {
    const order = genOrder(F);
    let n = 0;
    while (n < order.length && (n === 0 || (L.owned[order[n].id] || 0) > 0 || L.totalMain >= order[n].cost * 0.25)) n++;
    const key = L.form + ':' + n;
    if (LR.genKey !== key) {
      LR.genKey = key;
      const list = $('genList');
      list.innerHTML = '';
      LR.genRows = [];
      order.slice(0, Math.min(order.length, n + 1)).forEach((g, i) => {
        const row = makeRow(g.id, g.glyph, g.name);
        const locked = i >= n;
        if (locked) row.classList.add('locked');
        const btn = addBuyBtn(row, false);
        btn.setAttribute('aria-label', '购买' + g.name);
        btn.onclick = () => {
          const Lx = state.life;
          if (!Lx || Lx.ended || locked) return;
          if (WS.buyGen(state, Lx, g.id, buyMode) > 0) {
            if (isWanted(Lx, 'gen', g.id)) Lx.saveFor = null;
            flash(row);
            snd('buy');
            afterAction();
            return;
          }
          const k = buyMode === 10 ? 10 : 1;
          wantThis(Lx, { kind: 'gen', id: g.id, n: k }, g.name + (k > 1 ? ` ×${k}` : ''), WS.genCost(F, g, Lx.owned[g.id] || 0, k));
        };
        LR.genRows.push({
          g, row, btn, locked,
          count: row.querySelector('.count'),
          desc: row.querySelector('.row-desc'),
          n: btn.querySelector('.n'),
          c: btn.querySelector('.c'),
        });
        list.appendChild(row);
      });
    }
    const pm = WS.prodMult(state, L, { noSkill: true, noNight: true }) * spd();
    for (const r of LR.genRows) {
      const g = r.g, owned = L.owned[g.id] || 0;
      setText(r.count, owned ? '×' + owned : '');
      setText(r.desc, genDesc(L, g, owned, pm));
      let k = 1;
      if (buyMode === 10) k = 10;
      else if (buyMode === 'max') k = Math.max(1, WS.maxAfford(F, g, owned, L.main));
      const want = isWanted(L, 'gen', g.id);
      const cost = want ? WS.targetCost(state, L) : WS.genCost(F, g, owned, k);
      const can = cost <= L.main * (1 + 1e-9);
      setText(r.n, want ? (can ? '×' + (L.saveFor.n || 1) : '攒钱中') : '×' + k);
      setText(r.c, WS.fmt(cost));
      setClass(r.btn, 'buy-btn' + (can ? '' : ' cant') + (want ? ' want' : ''));
      setDisabled(r.btn, r.locked);
    }
  }

  function renderUps(L, F) {
    const learned = F.ups.filter(u => L.ups[u.id]);
    const key = L.form + ':' + learned.map(u => u.id).join(',');
    if (LR.upKey !== key) {
      LR.upKey = key;
      const list = $('upList');
      list.innerHTML = '';
      LR.upRows = [];
      F.ups.filter(u => !L.ups[u.id]).sort((a, b) => a.cost - b.cost).slice(0, 3).forEach(u => {
        const row = makeRow(u.id, u.name[0], u.name);
        setText(row.querySelector('.row-desc'), u.desc);
        const btn = addBuyBtn(row, true);
        setText(btn.querySelector('.n'), '习得');
        setText(btn.querySelector('.c'), WS.fmt(u.cost));
        btn.setAttribute('aria-label', '习得' + u.name);
        btn.onclick = () => {
          const Lx = state.life;
          if (!Lx || Lx.ended) return;
          if (WS.buyUp(state, Lx, u.id)) {
            if (isWanted(Lx, 'up', u.id)) Lx.saveFor = null;
            buzz(15);
            snd('learn');
            toast(`习得「${u.name}」`, 'jade');
            afterAction();
            return;
          }
          wantThis(Lx, { kind: 'up', id: u.id }, u.name, u.cost);
        };
        LR.upRows.push({ u, btn, n: btn.querySelector('.n') });
        list.appendChild(row);
      });
      if (learned.length) list.appendChild(h('div', 'learned-line', '已习得：' + learned.map(u => u.name).join('、')));
      setText($('upNote'), `${learned.length} / ${F.ups.length}`);
    }
    for (const r of LR.upRows) {
      const want = isWanted(L, 'up', r.u.id);
      const can = L.main >= r.u.cost;
      setClass(r.btn, 'buy-btn jade' + (can ? '' : ' cant') + (want ? ' want' : ''));
      setText(r.n, want && !can ? '攒钱中' : '习得');
    }
  }

  function renderLife() {
    const L = state.life;
    const alive = !!(L && !L.ended);
    $('emptyLife').hidden = alive;
    $('lifeView').hidden = !alive;
    if (!alive) {
      setText($('emptyText'), state.lifeNo ? '这一世已经走完了。' : '你还没有投胎。');
      built = '';
      return;
    }
    const F = WS.FORMS[L.form];
    if (built !== state.lifeNo + ':' + L.form) buildLife(L);
    const sp = spd();

    setText($('ageText'), `年岁 ${Math.floor(L.age)} / ${Math.round(L.lifespan)}`);
    setText($('meritText'), `功德 ${WS.fmtMerit(L.merit)}`);
    $('ageBar').style.width = (100 * L.age / L.lifespan).toFixed(2) + '%';

    setText($('mainValue'), WS.fmt(L.main));
    let rate = `+${WS.fmt(WS.prodRate(state, L) * sp)} / 秒`;
    if (L.skillActive > 0 && F.skill.mult) rate += ` <span class="boost">${F.skill.name} ×${F.skill.mult}</span>`;
    setHTML($('mainRate'), rate);

    renderFormPanel(L);

    setText($('tapGain'), '+' + WS.fmt(WS.tapGain(state, L)));
    let st, cls;
    if (L.skillActive > 0) { st = `生效中 ${WS.fmtClock(L.skillActive / sp)}`; cls = 'skill-btn active'; }
    else if (L.skillCd > 0) { st = `冷却 ${WS.fmtClock(L.skillCd / sp)}`; cls = 'skill-btn'; }
    else { st = F.skill.desc; cls = 'skill-btn ready'; }
    setText($('skillState'), st);
    setClass($('skillBtn'), cls);

    renderGoal(L, F);
    renderGens(L, F);
    renderUps(L, F);

    const can = WS.canEndEarly(L);
    setDisabled($('endLifeBtn'), !can);
    setText($('endLifeBtn'), can ? '提前坐化，进入轮回' : `活到 ${Math.ceil(L.lifespan / 5)} 岁后可以提前坐化`);
  }

  function doTap(e) {
    const L = state.life;
    if (!L || L.ended || state.pending) return;
    const g = WS.tap(state, L);
    snd('tap');
    const b = $('tapBtn').getBoundingClientRect();
    const x = e && e.clientX ? e.clientX + (Math.random() * 24 - 12) : b.left + b.width / 2;
    const y = e && e.clientY ? e.clientY : b.top + b.height / 2;
    floatText('+' + WS.fmt(g), x, y);
    setText($('mainValue'), WS.fmt(L.main));
  }

  function doSkill() {
    const L = state.life;
    if (!L || L.ended) return;
    const F = WS.FORMS[L.form];
    const before = L.main;
    if (!WS.useSkill(state, L)) { toast(`${F.skill.name}还在冷却`); return; }
    buzz(30);
    snd('skill');
    if (F.skill.instant) {
      const b = $('skillBtn').getBoundingClientRect();
      floatText('+' + WS.fmt(L.main - before), b.left + b.width / 2, b.top + b.height / 2);
      toast(`${F.skill.name}：${F.mainName} +${WS.fmt(L.main - before)}`, 'jade');
    } else {
      toast(`${F.skill.name}：${F.skill.desc}`, 'jade');
    }
    afterAction();
  }

  // ---------- 洞天 ----------
  let caveKey = '';
  let caveRows = [];

  function buildCave() {
    const list = $('featList');
    list.innerHTML = '';
    caveRows = [];
    for (const f of WS.FEATURES) {
      const lv = WS.featLv(state, f.id);
      const row = makeRow(f.id, f.glyph, f.name);
      const count = row.querySelector('.count');
      count.className = 'lv';
      count.textContent = `${lv} 级`;
      const desc = row.querySelector('.row-desc');
      let btn = null;
      if (f.from) {
        const F = WS.FORMS[f.from];
        desc.textContent = lv
          ? `${WS.featureEffect(f.id, lv)} · 灵气 +${WS.fmt(f.lingqi * lv)}/秒`
          : `还没有。投胎成${F.name}，走完一世就会留下`;
        row.appendChild(h('div', 'legacy-tag', `来自${F.name}前世`));
      } else {
        desc.innerHTML = (lv ? WS.featureEffect(f.id, lv) : '还没有') + `<span class="next">下一级：${WS.featureEffect(f.id, lv + 1)}</span>`;
        btn = addBuyBtn(row, true);
        setText(btn.querySelector('.n'), '添置');
        setText(btn.querySelector('.c'), WS.fmt(WS.featureCost(f, lv)));
        btn.setAttribute('aria-label', '添置' + f.name);
        btn.onclick = () => {
          if (!WS.buyFeature(state, f.id)) return;
          buzz(15);
          snd('feature');
          toast(`洞天添了${f.name}，现在 ${WS.featLv(state, f.id)} 级`, 'jade');
          save();
          render(true);
          flash(list.querySelector(`[data-id="${f.id}"]`));
        };
      }
      caveRows.push({ f, btn });
      list.appendChild(row);
    }
  }

  function renderCave() {
    setText($('lqValue'), WS.fmt(state.lingqi));
    setText($('lqRate'), `+${WS.fmt(WS.lingqiRate(state) * spd())} / 秒`);
    const key = JSON.stringify(state.feats) + '|' + state.lifeNo;
    if (caveKey !== key) {
      caveKey = key;
      buildCave();
      painter.setLevels(state.feats, state.lifeNo ? lifeTitle(state.lifeNo) : '');
    }
    for (const r of caveRows) {
      if (r.btn) setDisabled(r.btn, state.lingqi < WS.featureCost(r.f, WS.featLv(state, r.f.id)));
    }
    $('caveBetween').hidden = !(state.pending && !current);
  }

  // ---------- 前世 ----------
  let pastKey = '';

  function codexCard(glyph, name, meta, tier, locked) {
    return `<div class="codex-card${locked ? ' locked' : ''}"><div class="codex-glyph${tier >= 0 ? ' t' + tier : ''}">${glyph}</div><div class="codex-name">${name}</div><div class="codex-meta">${meta}</div></div>`;
  }

  function renderPast(force) {
    $('pastStats').innerHTML = [
      [state.lifeNo, '世轮回'],
      [WS.fmtMerit(state.meritTotal), '累计功德'],
      [WS.fmt(state.lingqiTotal), '累计灵气'],
    ].map(([v, l]) => `<div class="past-stat"><b>${v}</b><span>${l}</span></div>`).join('');
    const key = state.lifeNo + ':' + state.history.length + ':' + state.unlocked.join(',');
    if (!force && pastKey === key) return;
    pastKey = key;
    const cards = WS.FORM_ORDER.map(id => {
      const F = WS.FORMS[id], cx = state.codex[id];
      if (state.unlocked.indexOf(id) < 0) return codexCard(F.glyph, F.name, `未解锁<br>${F.unlockHint}`, -1, true);
      if (!cx.lives) return codexCard(F.glyph, F.name, '已解锁<br>还没投胎过', -1, false);
      return codexCard(F.glyph, F.name, `投胎 ${cx.lives} 次<br>最好：${cx.best || '—'}`, cx.bestTier, false);
    }).concat(WS.FUTURE_FORMS.map(f => codexCard(f.glyph, f.name, '尚未开放', -1, true)));
    $('codex').innerHTML = cards.join('');
    $('history').innerHTML = state.history.length
      ? state.history.map(s => {
        const F = WS.FORMS[s.form], T = WS.TIERS[s.tier], feat = WS.feature(s.legacy.id);
        return `<div class="hist-row"><div class="hist-glyph t${s.tier}">${F.glyph}</div><div><div class="hist-title">${lifeTitle(s.no)} · ${T.name}${F.name}${s.best ? ' · ' + s.best : ''}</div><div class="hist-meta">${s.reason === 'early' ? '提前坐化' : '寿终'} · ${Math.floor(s.years)} 年 · 功德 ${WS.fmtMerit(s.merit)} · ${feat.name} +${s.legacy.add}</div></div></div>`;
      }).join('')
      : '<div class="history-empty">还没有走完的一世。</div>';
  }

  // ---------- 绑定 ----------
  function bindUI() {
    document.querySelectorAll('.tabbtn').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
    $('lqChip').addEventListener('click', () => setTab('cave'));
    $('btnSettings').addEventListener('click', () => queueOverlay(sheetSettings, true));
    $('btnSound').addEventListener('click', () => {
      const S = soundPrefs();
      const on = !(S.music || S.sfx);
      S.music = on;
      S.sfx = on;
      applySound();
      if (on && Sound) { Sound.unlock(); snd('toggle'); }
      toast(on ? '声音开了' : '静音了');
      save();
    });
    // 浏览器只允许在用户点按之后出声：每次点按时看一眼，没开起来就开
    const wake = () => {
      const S = soundPrefs();
      if (Sound && (S.music || S.sfx) && !Sound.ready) Sound.unlock();
    };
    ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'].forEach(t => document.addEventListener(t, wake, { capture: true, passive: true }));
    $('btnToWheel').addEventListener('click', showPending);
    $('btnCaveWheel').addEventListener('click', showPending);

    const tapBtn = $('tapBtn');
    tapBtn.addEventListener('pointerdown', e => { if (e.button > 0) return; doTap(e); });
    tapBtn.addEventListener('click', e => { if (e.detail === 0) doTap(null); });
    $('skillBtn').addEventListener('click', doSkill);
    $('buyMode').addEventListener('click', () => {
      buyMode = buyMode === 1 ? 10 : buyMode === 10 ? 'max' : 1;
      setText($('buyMode'), '买 ' + (buyMode === 'max' ? '最多' : '×' + buyMode));
      render(true);
    });
    $('endLifeBtn').addEventListener('click', () => queueOverlay(sheetEndEarly, true));

    $('overlay').addEventListener('click', e => {
      if (e.target === $('overlay') && current && current.dismiss) closeSheet();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && current && current.dismiss) closeSheet();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) save();
      if (Sound) Sound.setHidden(document.hidden);
    });
    window.addEventListener('pagehide', save);
    window.addEventListener('resize', () => { if (tab === 'cave') painter.resize(); });

    const onTheme = () => { if (painter) painter.palette(); };
    if (window.matchMedia) {
      const mq = matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) mq.addEventListener('change', onTheme);
    }
    new MutationObserver(onTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  // ---------- 启动 ----------
  function start(data) {
    if (started) return;
    started = true;
    let s = null;
    if (data && typeof data.save === 'string') { try { s = migrate(JSON.parse(data.save)); } catch (e) { s = null; } }
    state = s || load() || WS.newState();
    painter = WS.Painter($('caveCanvas'));
    bindUI();
    applySound();

    if (!state.introDone) {
      queueOverlay(sheetIntro, false);
    } else {
      const gap = (Date.now() - (state.lastSeen || Date.now())) / 1000;
      if (gap > 5) {
        const info = WS.catchUp(state, gap);
        if (gap >= 300) queueOverlay(sh => sheetOffline(sh, info), true);
      }
      showPending();
    }
    lastTick = Date.now();
    save();
    render(true);
    requestAnimationFrame(frame);
  }

  // 方便调试：在控制台里推进时间
  window.__ws = {
    get state() { return state; },
    WS,
    advance(sec) { advance(sec, true); render(true); },
    save,
    load(s) {
      state = migrate(s);
      applySound();
      built = ''; caveKey = ''; pastKey = '';
      pendingQueued = false;
      queue.length = 0;
      current = null;
      nextOverlay();
      showPending();
      save();
      render(true);
    },
  };

  if ('serviceWorker' in navigator && /github\.io$/.test(location.hostname)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  const hot = window.claude && window.claude.hot;
  try { if (hot && hot.snapshot) hot.snapshot(() => ({ save: JSON.stringify(state) })); } catch (e) { /* 只在预览器里有 */ }
  if (hot && hot.ready) hot.ready(start);
  else start((hot && hot.data) || {});
})();
