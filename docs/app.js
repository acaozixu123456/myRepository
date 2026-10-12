'use strict';

/* ---------- 存储 ---------- */

const LOG_KEY = 'meditation.log.v1';
const SETTINGS_KEY = 'meditation.settings.v1';
const DEFAULTS = { minutes: 10, interval: 0, prep: true, wake: true, volume: 0.7 };
const PREP_SEC = 10;
const MIN_SAVE_SEC = 60;

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 私密模式等情况下可能写不进去，界面照常可用
  }
}

let settings = { ...DEFAULTS, ...load(SETTINGS_KEY, {}) };
let log = load(LOG_KEY, []);

function saveSettings() { save(SETTINGS_KEY, settings); }
function saveLog() {
  log.sort((a, b) => a.start.localeCompare(b.start));
  save(LOG_KEY, log);
}

/* ---------- 日期与统计 ---------- */

function dayKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shiftDay(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function computeStreak(entries, now = new Date()) {
  const days = new Set(entries.map(e => dayKey(e.start)));
  let cursor = days.has(dayKey(now)) ? now : shiftDay(now, -1);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor = shiftDay(cursor, -1);
  }
  return streak;
}

function stats(now = new Date()) {
  const today = dayKey(now);
  let totalSec = 0;
  let todaySec = 0;
  for (const e of log) {
    totalSec += e.sec;
    if (dayKey(e.start) === today) todaySec += e.sec;
  }
  return {
    streak: computeStreak(log, now),
    todayMin: Math.floor(todaySec / 60),
    totalMin: Math.floor(totalSec / 60),
  };
}

/* ---------- 声音（Web Audio 合成颂钵声，无需音频文件） ---------- */

let ctx = null;
let master = null;
let keepAlive = null;

function ensureAudio() {
  if (!ctx) {
    // iOS 17+：按“播放”类型处理，静音键打开时也尽量出声
    if (navigator.audioSession) {
      try { navigator.audioSession.type = 'playback'; } catch {}
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.connect(ctx.destination);
    master = ctx.createGain();
    master.gain.value = settings.volume;
    master.connect(comp);
  }
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  return ctx;
}

// 一次敲击：几组不成整数倍的泛音，每组两个略微失谐的正弦波产生颂钵特有的“嗡嗡”拍音
function strike(when, { f0, amp, decay }) {
  const nodes = [];
  const partials = [
    [1, 1, 1],
    [2.71, 0.45, 0.6],
    [5.15, 0.2, 0.35],
    [8.43, 0.08, 0.2],
  ];
  for (const [ratio, level, decayScale] of partials) {
    const d = decay * decayScale;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(amp * level, when + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, when + d);
    g.connect(master);
    for (const detune of [-0.7, 0.7]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f0 * ratio + detune * ratio;
      o.connect(g);
      o.start(when);
      o.stop(when + d + 0.1);
      nodes.push(o);
    }
  }
  // 敲击瞬间的一点木槌声
  const len = Math.floor(ctx.sampleRate * 0.04);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = f0 * 4;
  bp.Q.value = 1.5;
  const ng = ctx.createGain();
  ng.gain.value = amp * 0.25;
  noise.connect(bp).connect(ng).connect(master);
  noise.start(when);
  nodes.push(noise);
  return nodes;
}

const SOUNDS = {
  bowl: { f0: 220, amp: 0.5, decay: 10 },
  small: { f0: 523, amp: 0.25, decay: 4 },
};

function play(kind, delaySec = 0) {
  ensureAudio();
  return strike(ctx.currentTime + Math.max(0, delaySec) + 0.02, SOUNDS[kind]);
}

function cancelNodes(nodes) {
  for (const n of nodes) {
    try { n.stop(0); } catch {}
    try { n.disconnect(); } catch {}
  }
}

// 计时中放一个几乎听不到的音，让 iPhone 尽量保持音频运行（锁屏后能否继续由系统决定）
function startKeepAlive() {
  ensureAudio();
  if (keepAlive) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.value = 40;
  g.gain.value = 0.00001;
  o.connect(g).connect(ctx.destination);
  o.start();
  keepAlive = o;
}

function stopKeepAlive() {
  if (keepAlive) cancelNodes([keepAlive]);
  keepAlive = null;
}

/* ---------- 屏幕常亮 ---------- */

let wakeLock = null;

async function requestWake() {
  if (!settings.wake || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch {
    wakeLock = null;
  }
}

function releaseWake() {
  if (wakeLock) wakeLock.release().catch(() => {});
  wakeLock = null;
}

/* ---------- 计时器 ---------- */

// 所有时间都按真实时钟（Date.now）计算，切到后台再回来会自动校正
const timer = {
  phase: 'idle', // idle | prep | running | paused
  prepEndsAt: 0,
  plannedMs: 0,
  intervalMs: 0,
  elapsedBefore: 0,
  segStart: 0,
  startedAt: null,
  scheduled: [],     // 已经排进音频时钟的声音节点
  audioAnchor: null, // 排程时音频时钟与真实时钟的对应关系
  tickId: null,
};

function elapsedMs(now = Date.now()) {
  if (timer.phase === 'running') return timer.elapsedBefore + (now - timer.segStart);
  if (timer.phase === 'paused') return timer.elapsedBefore;
  return 0;
}

// 音频时钟是否一直在走（锁屏或后台时 iPhone 可能把它挂起）
function audioClockHealthy(now = Date.now()) {
  if (!ctx || ctx.state !== 'running' || !timer.audioAnchor) return false;
  const expected = timer.audioAnchor.ctxTime + (now - timer.audioAnchor.wall) / 1000;
  return Math.abs(ctx.currentTime - expected) < 1;
}

function unschedule() {
  for (const nodes of timer.scheduled) cancelNodes(nodes);
  timer.scheduled = [];
  timer.audioAnchor = null;
}

// 把接下来的开始钟、中途钟和结束钟提前排进音频时钟，这样即使 JS 计时被系统放慢，声音也尽量准时
function schedule(now = Date.now()) {
  unschedule();
  ensureAudio();
  timer.audioAnchor = { ctxTime: ctx.currentTime, wall: now };
  let offsetSec; // 距“正式开始”还有多久（准备阶段为正）
  let elapsed;
  if (timer.phase === 'prep') {
    offsetSec = (timer.prepEndsAt - now) / 1000;
    elapsed = 0;
    timer.scheduled.push(play('bowl', offsetSec));
  } else if (timer.phase === 'running') {
    offsetSec = 0;
    elapsed = elapsedMs(now);
  } else {
    return;
  }
  if (timer.intervalMs > 0) {
    for (let t = timer.intervalMs; t < timer.plannedMs - 1000; t += timer.intervalMs) {
      if (t > elapsed) timer.scheduled.push(play('small', offsetSec + (t - elapsed) / 1000));
    }
  }
  timer.scheduled.push(play('bowl', offsetSec + (timer.plannedMs - elapsed) / 1000));
}

function startSession() {
  ensureAudio();
  timer.plannedMs = settings.minutes * 60 * 1000;
  timer.intervalMs = settings.interval * 60 * 1000;
  timer.elapsedBefore = 0;
  timer.startedAt = null;
  const now = Date.now();
  if (settings.prep) {
    timer.phase = 'prep';
    timer.prepEndsAt = now + PREP_SEC * 1000;
  } else {
    beginRunning(now);
  }
  schedule(now);
  startKeepAlive();
  requestWake();
  show('session');
  renderSession();
  timer.tickId = setInterval(tick, 250);
}

function beginRunning(now) {
  timer.phase = 'running';
  timer.segStart = now;
  timer.startedAt = new Date(now).toISOString();
}

function skipPrep() {
  if (timer.phase !== 'prep') return;
  beginRunning(Date.now());
  schedule(); // 重新排程：开始钟立刻响
  renderSession();
}

function tick() {
  const now = Date.now();
  if (timer.phase === 'prep' && now >= timer.prepEndsAt) {
    const healthy = audioClockHealthy(now);
    beginRunning(timer.prepEndsAt);
    if (!healthy) {
      // 声音没按时响（例如刚从后台回来），补响并重新排程
      schedule(now);
      play('bowl');
    }
  }
  if (timer.phase === 'running' && elapsedMs(now) >= timer.plannedMs) {
    finish(true, now);
    return;
  }
  renderSession(now);
}

function togglePause() {
  const now = Date.now();
  if (timer.phase === 'running') {
    timer.elapsedBefore = elapsedMs(now);
    timer.phase = 'paused';
    unschedule();
  } else if (timer.phase === 'paused') {
    timer.phase = 'running';
    timer.segStart = now;
    schedule(now);
  }
  renderSession(now);
}

function stopEarly() {
  if (timer.phase === 'prep') {
    finish(false);
    return;
  }
  if (confirm('提前结束这次冥想？')) finish(false);
}

function finish(completed, now = Date.now()) {
  const wasPrep = timer.phase === 'prep';
  const elapsed = completed ? timer.plannedMs : elapsedMs(now);
  const healthy = audioClockHealthy(now);
  clearInterval(timer.tickId);
  timer.tickId = null;
  if (completed) {
    if (healthy) {
      // 结束钟已在音频时钟里响起，只取消还没响的节点
      timer.scheduled = [];
      timer.audioAnchor = null;
    } else {
      unschedule();
      play('bowl');
    }
  } else {
    unschedule();
  }
  timer.phase = 'idle';
  // 等结束钟响完再停掉保活音
  setTimeout(() => { if (timer.phase === 'idle') stopKeepAlive(); }, 12000);
  releaseWake();

  if (wasPrep) {
    show('home');
    renderHome();
    return;
  }

  const sec = Math.round(elapsed / 1000);
  const savedEntry = sec >= MIN_SAVE_SEC;
  if (savedEntry) {
    log.push({ start: timer.startedAt, sec, planned: Math.round(timer.plannedMs / 1000) });
    saveLog();
  }
  if (!completed && !savedEntry) {
    // 不足一分钟的提前结束不记录，直接回首页
    show('home');
    renderHome();
    return;
  }
  const s = stats();
  $('done-title').textContent = completed ? '完成' : '已结束';
  $('done-detail').textContent = `这次 ${formatDuration(sec)}，已连续 ${s.streak} 天`;
  show('done');
}

/* ---------- 界面 ---------- */

const $ = id => document.getElementById(id);
const RING_LEN = 2 * Math.PI * 90;

function show(id) {
  for (const el of document.querySelectorAll('.screen')) el.classList.toggle('active', el.id === id);
  window.scrollTo(0, 0);
}

function formatClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s} 秒`;
  return s ? `${m} 分 ${s} 秒` : `${m} 分钟`;
}

function renderSession(now = Date.now()) {
  const ring = $('ring');
  const session = $('session');
  session.classList.toggle('paused', timer.phase === 'paused');
  let fraction;
  if (timer.phase === 'prep') {
    const left = Math.max(0, timer.prepEndsAt - now);
    $('phase').textContent = '准备';
    $('time').textContent = String(Math.ceil(left / 1000));
    $('session-hint').textContent = '坐好，放松肩膀。轻点圆圈可跳过准备。';
    $('pause').hidden = true;
    $('stop').textContent = '取消';
    fraction = left / (PREP_SEC * 1000);
  } else {
    const left = timer.plannedMs - elapsedMs(now);
    $('phase').textContent = timer.phase === 'paused' ? '已暂停' : '冥想中';
    $('time').textContent = formatClock(left);
    $('session-hint').textContent = timer.phase === 'paused' ? '' : '专注呼吸。';
    $('pause').hidden = false;
    $('pause').textContent = timer.phase === 'paused' ? '继续' : '暂停';
    $('stop').textContent = '结束';
    fraction = left / timer.plannedMs;
  }
  ring.style.strokeDashoffset = String(RING_LEN * (1 - Math.max(0, Math.min(1, fraction))));
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function renderHome() {
  const s = stats();
  $('streak').textContent = s.streak;
  $('today').textContent = s.todayMin;
  $('total').textContent = s.totalMin;

  $('minutes').value = settings.minutes;
  for (const b of $('presets').children) b.classList.toggle('on', Number(b.dataset.min) === settings.minutes);
  $('interval').value = String(settings.interval);
  $('prep').checked = settings.prep;
  $('wake').checked = settings.wake;
  $('volume').value = String(settings.volume);

  const list = $('log');
  list.textContent = '';
  const recent = log.slice(-20).reverse();
  for (const e of recent) {
    const d = new Date(e.start);
    const li = document.createElement('li');
    const when = document.createElement('span');
    when.className = 'when';
    when.textContent = `${d.getMonth() + 1}月${d.getDate()}日 周${WEEKDAYS[d.getDay()]} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const dur = document.createElement('span');
    dur.textContent = formatDuration(e.sec);
    const del = document.createElement('button');
    del.className = 'del';
    del.setAttribute('aria-label', '删除这条记录');
    del.textContent = '×';
    del.addEventListener('click', () => {
      if (!confirm('删除这条记录？')) return;
      log = log.filter(x => x !== e);
      saveLog();
      renderHome();
    });
    const right = document.createElement('span');
    right.append(dur, del);
    li.append(when, right);
    list.append(li);
  }
  $('log-empty').hidden = log.length > 0;
}

function setMinutes(m) {
  const n = Math.round(Number(m));
  if (!Number.isFinite(n)) return;
  settings.minutes = Math.min(180, Math.max(1, n));
  saveSettings();
  renderHome();
}

/* ---------- 备份 ---------- */

async function exportLog() {
  const data = JSON.stringify({ app: 'meditation', version: 1, exportedAt: new Date().toISOString(), log }, null, 2);
  const name = `冥想记录-${dayKey(new Date())}.json`;
  const file = new File([data], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function importLog(file) {
  try {
    const parsed = JSON.parse(await file.text());
    const incoming = Array.isArray(parsed) ? parsed : parsed.log;
    if (!Array.isArray(incoming)) throw new Error('bad format');
    const known = new Set(log.map(e => e.start));
    let added = 0;
    for (const e of incoming) {
      if (!e || typeof e.start !== 'string' || isNaN(Date.parse(e.start)) || !(e.sec > 0)) continue;
      if (known.has(e.start)) continue;
      log.push({ start: e.start, sec: Math.round(e.sec), planned: Math.round(e.planned || e.sec) });
      known.add(e.start);
      added++;
    }
    saveLog();
    renderHome();
    alert(`导入完成，新增 ${added} 条记录。`);
  } catch {
    alert('这个文件不是有效的备份。');
  }
}

/* ---------- 事件 ---------- */

$('presets').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b) setMinutes(b.dataset.min);
});
$('minus').addEventListener('click', () => setMinutes(settings.minutes - 1));
$('plus').addEventListener('click', () => setMinutes(settings.minutes + 1));
$('minutes').addEventListener('change', e => setMinutes(e.target.value));
$('interval').addEventListener('change', e => { settings.interval = Number(e.target.value); saveSettings(); });
$('prep').addEventListener('change', e => { settings.prep = e.target.checked; saveSettings(); });
$('wake').addEventListener('change', e => { settings.wake = e.target.checked; saveSettings(); });
$('volume').addEventListener('input', e => {
  settings.volume = Number(e.target.value);
  if (master) master.gain.value = settings.volume;
  saveSettings();
});
$('test').addEventListener('click', () => play('bowl'));
$('start').addEventListener('click', startSession);
$('pause').addEventListener('click', togglePause);
$('stop').addEventListener('click', stopEarly);
document.querySelector('.ring-wrap').addEventListener('click', skipPrep);
$('back').addEventListener('click', () => { show('home'); renderHome(); });
$('export').addEventListener('click', exportLog);
$('import').addEventListener('change', e => {
  const f = e.target.files[0];
  if (f) importLog(f);
  e.target.value = '';
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || timer.phase === 'idle') return;
  // 回到前台：恢复音频、重新申请常亮、按真实时间校正
  ensureAudio();
  requestWake();
  tick();
  if ((timer.phase === 'prep' || timer.phase === 'running') && !audioClockHealthy()) schedule();
});

renderHome();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
