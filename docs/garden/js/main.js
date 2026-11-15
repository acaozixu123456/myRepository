// 界面和存档，把规则（sim.js）和画面（scene.js）接在一起。
import * as S from './sim.js';
import { createWorld, phaseAt } from './scene.js';
import { PLANT_NAME, ANIMAL_NAME } from './notes.js';

const $ = id => document.getElementById(id);
const q = new URLSearchParams(location.search);
const DEMO = q.has('demo'), SPEED = +q.get('speed') || 1, AT = q.get('at'); // 调试用：?demo=23 预览第 23 天，?speed=600 快进，?at=21 指定几点
const KEY = DEMO || SPEED !== 1 ? 'garden.dev' : 'garden.v1';
const t0 = Date.now();
let offset = 0;
if (AT !== null) { const d = new Date(); d.setHours(Math.floor(+AT), (+AT % 1) * 60, 0, 0); offset = d.getTime() - t0; }
const now = () => t0 + offset + (Date.now() - t0) * SPEED;

// ---- 存档 ----
function load() {
  if (DEMO) {
    const days = +q.get('demo') || 23, start = now() - days * S.DAY, s = S.newState(start, 20261115);
    const words = ['今天也辛苦了', '慢慢来', '想家了', '下雨天也不错'];
    for (let h = 0; h <= days * 24; h += 6) {
      const t = start + h * S.HOUR; S.advance(s, t);
      if (h % 24 === 0) { S.water(s, t); const sp = S.SEEDABLE.filter(k => S.vitality(s, t) >= S.SPECIES[k].need).pop(); for (let i = 0; i < 30; i++) { const a = i * 2.4 + h, r = 2 + (i * 1.7 + h * 0.3) % 7; if (!S.plantSeed(s, sp, Math.cos(a) * r, Math.sin(a) * r, t)) break; } }
      const w = words[h / 120]; if (h % 120 === 0 && w) for (const [x, z] of [[1.5, -0.6], [-2.6, 3.2], [-1.6, -5.2], [6.4, -2.2]].slice(h / 120)) if (!S.plantMood(s, w, x, z, t)) break;
    }
    S.advance(s, now()); s.readAt = now() - 5 * S.HOUR; return s;
  }
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) return s; } catch (e) { /* 存档坏了就重新开始 */ }
  return S.newState(now());
}
function save() { if (!DEMO) try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 存不下就算了 */ } }
let state = load();

// ---- 小工具 ----
let toastTimer;
function toast(html, ms = 2600) { const t = $('toast'); t.innerHTML = html; t.hidden = false; t.style.animation = 'none'; void t.offsetWidth; t.style.animation = ''; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms); }
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hm = t => new Date(t).toTimeString().slice(0, 5);
function waitText(ms) { const m = Math.ceil(ms / 60e3); return m >= 60 ? `${Math.floor(m / 60)} 小时 ${m % 60} 分` : `${m} 分钟`; }

const world = await createWorld($('c'), $('stars'), $('sky'));
world.setClock(now);
world.setTime(now());
S.advance(state, now());
await world.sync(state, now(), true);
save();

// ---- 顶部和底部的信息 ----
function refresh() {
  const t = now(), label = world.setTime(t);
  $('dayLabel').textContent = `第 ${S.dayNumber(state, t)} 天 · ${label}`;
  $('vit').textContent = Math.round(S.vitality(state, t) * 100) + '%';
  const seeds = S.seedsNow(state, t);
  $('seedCount').textContent = seeds || '';
  $('bSeed').classList.toggle('wait', seeds === 0);
  $('bWater').classList.toggle('wait', S.waterWait(state, t) > 0);
  const notes = sortedNotes(), last = notes[0], unread = notes.filter(n => n.t > state.readAt && n.k !== 'you').length;
  $('noteText').textContent = last ? last.s : '';
  $('noteHead').textContent = unread > 1 ? '你不在的时候' : '观察笔记';
  $('unread').hidden = !unread; $('unread').textContent = unread;
}
const sortedNotes = () => [...state.notes].sort((a, b) => b.t - a.t);
refresh();

// ---- 定时推进 ----
async function step() {
  const t = now();
  if (Math.floor(t / S.HOUR) > state.lastHour) {
    const before = state.notes.length, added = S.advance(state, t);
    await world.sync(state, t); save();
    if (added && !document.hidden && !openSheet) toast(esc(state.notes[state.notes.length - 1].s), 4200);
    void before;
  }
  refresh();
}
setInterval(step, SPEED > 1 ? 1000 : 20000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) step(); });

// ---- 渲染循环（约 30 帧，省电）----
let last = performance.now(), skip = false;
function loop(ts) {
  requestAnimationFrame(loop);
  if (document.hidden) { last = ts; return; }
  skip = !skip; if (skip && !dragging) return;
  const dt = Math.min(0.1, (ts - last) / 1000); last = ts;
  world.frame(dt, ts / 1000);
}
requestAnimationFrame(loop);
$('loading').classList.add('done');

// ---- 弹出面板 ----
let openSheet = null;
function sheet(id) {
  if (openSheet) $(openSheet).hidden = true;
  openSheet = id; $('scrim').hidden = !id;
  if (id) $(id).hidden = false;
}
$('scrim').addEventListener('click', () => sheet(null));

// ---- 放置模式：选好要种什么，再点地面 ----
let placing = null; // {kind:'seed', sp} 或 {kind:'mood', text}
function startPlacing(p, text) { placing = p; $('placeText').textContent = text; $('placeBar').hidden = false; sheet(null); }
function stopPlacing() { placing = null; $('placeBar').hidden = true; }
$('placeCancel').addEventListener('click', stopPlacing);

async function tapGround(g) {
  const t = now();
  const why = placing.kind === 'seed' ? S.plantSeed(state, placing.sp, g.x, g.z, t) : S.plantMood(state, placing.text, g.x, g.z, t);
  if (why) { toast(why); return; }
  const wasMood = placing.kind === 'mood';
  if (wasMood || S.seedsNow(state, t) === 0) stopPlacing();
  await world.sync(state, t); save(); refresh();
  if (wasMood) toast('种下了。<small>大约十个小时后开花</small>');
}

// ---- 触摸：拖动旋转小岛，轻点是操作 ----
let dragging = false, down = null;
const cv = $('c');
cv.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, lx: e.clientX, t: performance.now(), moved: false, v: 0 }; cv.setPointerCapture(e.pointerId); world.fling(0); });
cv.addEventListener('pointermove', e => {
  if (!down) return;
  if (!down.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) { down.moved = true; dragging = true; }
  if (down.moved) { const dx = e.clientX - down.lx; world.drag(dx); down.v = dx * 60; }
  down.lx = e.clientX;
});
cv.addEventListener('pointerup', e => {
  if (!down) return; const d = down; down = null; dragging = false;
  if (d.moved) { world.fling(d.v); return; }
  const p = world.pick(e.clientX, e.clientY);
  if (placing) { if (p.ground) tapGround(p.ground); else toast('点在岛上才行'); return; }
  if (p.hit && p.hit.plant) {
    const pl = p.hit.plant, done = S.maturity(pl, now()) >= 1;
    toast(`「${esc(pl.q)}」<small>第 ${S.dayNumber(state, pl.born)} 天种下 · ${done ? '已经开花' : '还在长'}</small>`, 4200);
  } else if (p.hit && p.hit.animal) {
    const a = p.hit.animal; world.hop(p.hit.holder);
    const days = Math.max(1, Math.round((now() - a.since) / S.DAY));
    toast(`${ANIMAL_NAME[a.sp]}<small>来了 ${days} 天</small>`, 1800);
  }
});
cv.addEventListener('pointercancel', () => { down = null; dragging = false; });

// ---- 播种 ----
const SEED_ICON = { grass: '🌱', flower: '🌼', bush: '🌿', tree: '🌳', pine: '🌲' };
$('bSeed').addEventListener('click', () => {
  const t = now(), seeds = S.seedsNow(state, t), v = S.vitality(state, t);
  $('seedHint').textContent = seeds ? `还有 ${seeds} 粒种子。选一种，然后点岛上的空地。` : `种子用完了，${waitText(S.nextSeedIn(state, t))}后会有新的。`;
  $('seedList').innerHTML = S.SEEDABLE.map(sp => {
    const need = S.SPECIES[sp].need, locked = v < need;
    return `<button type="button" class="seed${locked || !seeds ? ' locked' : ''}" data-sp="${sp}" ${locked || !seeds ? 'disabled' : ''}><i>${SEED_ICON[sp]}</i>${PLANT_NAME[sp]}<small>${locked ? `生机 ${Math.round(need * 100)}%` : S.SPECIES[sp].dur < 24 ? S.SPECIES[sp].dur + ' 小时' : Math.round(S.SPECIES[sp].dur / 24) + ' 天'}</small></button>`;
  }).join('');
  sheet('sheetSeed');
});
$('seedList').addEventListener('click', e => {
  const b = e.target.closest('.seed'); if (!b || b.disabled) return;
  startPlacing({ kind: 'seed', sp: b.dataset.sp }, `种${PLANT_NAME[b.dataset.sp]}：点一下岛上的空地`);
});

// ---- 浇水 ----
$('bWater').addEventListener('click', async () => {
  const t = now(), why = S.water(state, t);
  if (why) { toast(`${why}<small>还要 ${waitText(S.waterWait(state, t))}</small>`); return; }
  world.rain(); await world.sync(state, t); save(); refresh();
  toast('浇了水。<small>正在长的植物会快一点</small>');
});

// ---- 写心情 ----
$('bMood').addEventListener('click', () => { sheet('sheetMood'); $('moodGo').disabled = !$('moodText').value.trim(); });
$('moodText').addEventListener('input', () => { $('moodGo').disabled = !$('moodText').value.trim(); });
$('moodGo').addEventListener('click', () => {
  const text = $('moodText').value.trim().replace(/\s+/g, ' '); if (!text) return;
  $('moodText').value = ''; $('moodText').blur();
  startPlacing({ kind: 'mood', text }, '点一下岛上的空地，把这句话种下去');
});

// ---- 笔记 ----
const ICON = { start: '🏜️', sprout: '🌱', grow: '🌿', animal: '🐾', land: '⛰️', mood: '💗', you: '✋', idle: '·' };
function openNotes() {
  let html = '', day = -1;
  for (const n of sortedNotes()) {
    const d = S.dayNumber(state, n.t);
    if (d !== day) { day = d; const dt = new Date(n.t); html += `<div class="dayHead">第 ${d} 天 · ${dt.getMonth() + 1}月${dt.getDate()}日</div>`; }
    html += `<div class="n${n.t > state.readAt ? ' new' : ''}"><time>${hm(n.t)}</time><span>${ICON[n.k] || '·'} ${esc(n.s)}</span></div>`;
  }
  $('noteList').innerHTML = html; $('noteList').scrollTop = 0;
  sheet('sheetNotes');
  state.readAt = now(); save(); refresh();
}
$('bNotes').addEventListener('click', openNotes);
$('noteChip').addEventListener('click', openNotes);

// ---- 收藏 ----
const PLANT_ICON = { grass: '🌱', flower: '🌼', bush: '🌿', tree: '🌳', pine: '🌲', mush: '🍄', mood: '💗' };
const ANIMAL_ICON = { chick: '🐥', bee: '🐝', bunny: '🐰', fish: '🐟', deer: '🦌', fox: '🦊', cat: '🐱' };
let resetArmed = 0;
$('bBook').addEventListener('click', () => {
  const t = now(), count = {}; state.plants.forEach(p => { count[p.sp] = (count[p.sp] || 0) + 1; });
  const card = (icon, name, sub, ok) => `<div class="card${ok ? '' : ' no'}"><i>${ok ? icon : '❔'}</i>${ok ? name : '还没见过'}<small>${ok ? sub : '&nbsp;'}</small></div>`;
  $('bookList').innerHTML = `<h3>植物</h3><div class="grid">${Object.keys(PLANT_ICON).map(sp => card(PLANT_ICON[sp], PLANT_NAME[sp], `现在有 ${count[sp] || 0}`, count[sp] || state.found[sp])).join('')}</div>`
    + `<h3>住下来的动物</h3><div class="grid">${Object.keys(ANIMAL_ICON).map(sp => { const a = state.animals.find(x => x.sp === sp); return card(ANIMAL_ICON[sp], ANIMAL_NAME[sp], a ? `第 ${S.dayNumber(state, a.since)} 天来的` : '', a); }).join('')}</div>`
    + `<h3>这块地</h3><div class="grid">${card('💧', '池塘', '有水了', state.pond)}${card('🏝️', '远处的小岛', `${state.islets} / 3 座绿了`, state.islets)}${card('✨', '写下的话', `${count.mood || 0} 句`, count.mood)}</div>`
    + `<button type="button" class="reset" id="reset">重新开始（清空这块地）</button>`;
  resetArmed = 0; sheet('sheetBook'); void t;
});
$('bookList').addEventListener('click', async e => {
  if (e.target.id !== 'reset') return;
  if (performance.now() - resetArmed > 4000) { resetArmed = performance.now(); e.target.textContent = '再点一次确认：所有植物、动物和笔记都会消失'; return; }
  localStorage.removeItem(KEY); location.reload();
});

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');
window.__ready = true;
