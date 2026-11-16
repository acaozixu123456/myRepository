// 界面和操作：开始卡片（选旅人、选坐骑）、顶部地名和手记、横幅、步态 / 走法 / 工具按钮、换坐骑面板、结尾手记；
// 手势：默认左下角方向盘走（相对镜头的方向，推远走快），屏幕其他地方拖动转镜头；老操作是按住前进、左右拖动转向
// （飞的时候上下拖动爬升下降）；双指捏合切换俯视。
// 电脑上：空格/W/↑ 前进，A/D/←/→ 转向，Q/E 下降/爬升，F 飞，R 骑马，G 步行，T 俯视，1/2/3 步态。
const $ = id => document.getElementById(id);

export function initUI(h) {
  const body = document.body;
  const ui = {};
  // ---------- 开始卡片 ----------
  const go = $('go'), pick = $('horsePick'), who = $('whoPick');
  ui.loading = t => { $('loadText').textContent = t; };
  let goLabel = '出发';
  ui.ready = () => { go.disabled = false; go.textContent = goLabel; $('loadText').textContent = ''; };
  // 有存档：按钮改成“接着走”，下面可以选从头开始
  ui.resume = (sub) => {
    goLabel = sub ? '接着走' : '出发';
    $('startSub').textContent = sub || '暖光谷地 · 随便走走';
    $('fresh').hidden = !sub;
    if (!go.disabled) go.textContent = goLabel;
  };
  $('fresh').addEventListener('click', () => h.fresh?.());
  ui.busy = t => { go.disabled = true; go.textContent = t; };
  ui.failed = t => { go.disabled = true; go.textContent = '加载失败'; $('loadText').textContent = t; };
  // 坐骑卡片（开始卡片和换坐骑面板共用）
  const card = m => `<button type="button" data-h="${m.key}"><b>${m.name}</b><small>${m.desc}</small></button>`;
  ui.setMounts = list => {
    pick.innerHTML = list.map(card).join('');
    $('mountList').innerHTML = list.map(card).join('');
  };
  const markMount = k => { for (const box of [pick, $('mountList')]) for (const x of box.children) x.classList.toggle('on', x.dataset.h === k); };
  ui.setPick = markMount;
  pick.addEventListener('click', e => { const b = e.target.closest('button'); if (!b || b.disabled) return; markMount(b.dataset.h); h.pickMount(b.dataset.h); });
  who.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    for (const x of who.children) x.classList.toggle('on', x === b);
    h.pickTraveler(b.dataset.t);
  });
  go.addEventListener('click', () => { if (!go.disabled) h.go(); });
  ui.playing = on => body.classList.toggle('playing', on);
  $('creditsBtn').addEventListener('click', () => { $('credits').hidden = false; });
  $('creditsClose').addEventListener('click', () => { $('credits').hidden = true; });
  // 换坐骑面板
  const sheet = $('mountSheet');
  ui.mountPicker = on => { sheet.hidden = !on; };
  $('mountList').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; sheet.hidden = true; markMount(b.dataset.h); h.pickMount(b.dataset.h); });
  $('mountClose').addEventListener('click', () => { sheet.hidden = true; });
  ui.mountChanged = k => markMount(k);

  // ---------- 顶部 ----------
  const place = document.querySelector('.place'), pName = $('placeName'), pSub = $('placeSub');
  ui.place = (name, sub = '') => { pName.textContent = name; pSub.textContent = sub; place.classList.toggle('show', !!name); };
  const bar = document.querySelector('#progress i');
  ui.progress = f => { bar.style.width = (Math.max(0, Math.min(1, f)) * 100).toFixed(1) + '%'; };
  const journal = $('journal');
  ui.journal = (n, N) => { journal.textContent = `手记 ${n}/${N}`; journal.classList.remove('pop'); void journal.offsetWidth; if (n) journal.classList.add('pop'); };
  // 手记（journal.js 画）
  journal.addEventListener('click', () => h.openJournal?.());
  $('bMap').addEventListener('click', () => h.openMap?.());
  // 标记点：屏幕上方一个小箭头指着方向，点一下打开地图
  const way = $('way'), wayArrow = $('wayArrow'), wayName = $('wayName'), wayDist = $('wayDist');
  let wayShown = null, wayAng = 1e9, wayD = '';
  way.addEventListener('click', () => h.openMap?.());
  ui.way = (w, ang, d) => {
    if (!w) { if (wayShown) { way.hidden = true; wayShown = null; } return; }
    if (wayShown !== w) { wayShown = w; way.hidden = false; wayName.textContent = w.name; wayAng = 1e9; }
    if (Math.abs(ang - wayAng) > 0.02) { wayAng = ang; wayArrow.style.transform = `rotate(${ang.toFixed(3)}rad)`; }
    const t = d < 1000 ? `${Math.max(1, Math.round(d / 5) * 5)} 米` : `${(d / 1000).toFixed(1)} 千米`;
    if (t !== wayD) { wayD = t; wayDist.textContent = t; }
  };
  const perf = $('perf');
  ui.perf = t => { perf.textContent = t; };
  perf.addEventListener('click', () => h.cycleQuality());
  // 时辰：点一下快进到下一个时辰
  const bTime = $('bTime');
  bTime.addEventListener('click', () => h.skipTime?.());
  ui.time = (name, ff) => { if (bTime.textContent !== name) bTime.textContent = name; bTime.classList.toggle('ff', !!ff); };
  // 横幅：进入一个新地方时显示几秒
  const banner = $('banner'); let bannerT = 0;
  ui.banner = (name, sub = '', dur = 4.5) => {
    banner.querySelector('b').textContent = name; banner.querySelector('small').textContent = sub;
    banner.classList.add('show'); clearTimeout(bannerT); bannerT = setTimeout(() => banner.classList.remove('show'), dur * 1000);
  };
  ui.bannerOff = () => { clearTimeout(bannerT); banner.classList.remove('show'); };
  const hint = $('hint'); let hintText = null;
  ui.hint = (t) => { if (t === hintText) return; hintText = t; if (t) hint.textContent = t; hint.classList.toggle('off', !t); };

  // ---------- 下方按钮 ----------
  const gaits = $('gaits');
  gaits.addEventListener('click', e => { const b = e.target.closest('button'); if (b) h.gait(+b.dataset.g); });
  ui.gait = i => { for (const b of gaits.children) b.classList.toggle('on', +b.dataset.g === i); };
  ui.gaitNames = names => { [...gaits.children].forEach((b, i) => { b.textContent = names[i]; }); };
  const modes = $('modes');
  modes.addEventListener('click', e => { const b = e.target.closest('button'); if (b) h.mode(b.dataset.m); });
  ui.mode = m => { for (const b of modes.children) b.classList.toggle('on', b.dataset.m === m); };
  const act = $('act'); let actText = '';
  act.addEventListener('click', () => h.action(actText));
  ui.action = t => { if (t === actText) return; actText = t; act.textContent = t; act.hidden = !t; };
  const tool = (id, f) => $(id).addEventListener('click', f);
  tool('bPhoto', () => h.photo?.()); tool('bAuto', () => h.toggleAuto()); tool('bCam', () => h.toggleCam()); tool('bMount', () => { sheet.hidden = !sheet.hidden; }); tool('bSound', () => h.toggleSound());
  ui.tool = (id, on, text) => { const b = $(id); b.classList.toggle('on', !!on); if (text) b.textContent = text; };

  // ---------- 营地歇脚 ----------
  // st: { name, sub, msg, times: [{ name, at, sleep }], busy } 或 null（不显示）
  const rest = $('rest'); let restKey = '';
  ui.rest = st => {
    const k = st ? JSON.stringify(st) : '';
    if (k === restKey) return; restKey = k;
    rest.hidden = !st; body.classList.toggle('resting', !!st); if (!st) return;
    $('restName').textContent = st.name; $('restSub').textContent = st.sub;
    $('restMsg').textContent = st.msg || ''; $('restMsg').hidden = !st.msg;
    rest.classList.toggle('busy', !!st.busy);
    $('restTimes').innerHTML = st.times.map(t => `<button type="button" data-at="${t.at}"${st.busy ? ' disabled' : ''}>${t.sleep ? '睡到' : '歇到'}${t.name}</button>`).join('');
  };
  $('restTimes').addEventListener('click', e => { const b = e.target.closest('button'); if (b && !b.disabled) h.restUntil(+b.dataset.at); });
  rest.querySelector('.restRow').addEventListener('click', e => { const b = e.target.closest('button'); if (b) h.restAct(b.dataset.a); });
  ui.fade = (on) => body.classList.toggle('dim', on);

  // ---------- 手势 ----------
  const canvas = $('c');
  const pts = new Map();
  let pinch = null, multi = false;
  const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  let ctl = 'stick';
  const sync = () => { if (ctl === 'hold') h.hold(pts.size === 1 && !multi); };
  canvas.addEventListener('pointerdown', e => {
    try { canvas.setPointerCapture(e.pointerId); } catch {}
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size >= 2) { multi = true; pinch = { d0: dist(), z0: h.zoom() }; }
    sync(); e.preventDefault();
  });
  canvas.addEventListener('pointermove', e => {
    const p = pts.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (pts.size === 1 && !multi) h.look(dx / Math.min(innerWidth, 600), dy / Math.min(innerHeight, 900));
    else if (pts.size >= 2 && pinch) {
      const r = dist() / Math.max(1, pinch.d0);
      h.setZoom(Math.max(0, Math.min(1, pinch.z0 + (1 - r) * 1.8)), false);
    }
  });
  const up = e => {
    if (!pts.delete(e.pointerId)) return;
    if (pts.size < 2 && pinch) { pinch = null; h.setZoom(h.zoom() > 0.5 ? 1 : 0, true); }
    if (pts.size === 0) multi = false;
    sync();
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up); canvas.addEventListener('lostpointercapture', up);
  // iOS：禁止双击放大、双指缩放网页
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });
  document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  // ---------- 方向盘 ----------
  // 平时停在左下角；在左下这一片按下去，方向盘就挪到手指下（不用对准）。另一只手指可以同时拖屏幕转镜头。
  const zone = $('stickZone'), stick = $('stick'), knob = $('knob'), sGait = $('stickGait');
  const R = 42;   // 小圆点最多推出去多远（px）
  let sId = null, c0 = null;
  const restC = () => { const q = stick.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; };
  const knobAt = (dx, dy) => { knob.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`; };
  zone.addEventListener('pointerdown', e => {
    if (sId !== null || ctl !== 'stick') return;
    sId = e.pointerId;
    try { zone.setPointerCapture(e.pointerId); } catch {}
    const rc = restC();
    // 离方向盘远：方向盘跟过来；就在上面：原地用
    const off = Math.hypot(e.clientX - rc.x, e.clientY - rc.y) > 56;
    c0 = off ? { x: e.clientX, y: e.clientY } : { x: rc.x, y: rc.y };
    if (off) stick.style.transform = `translate(${(e.clientX - rc.x).toFixed(1)}px, ${(e.clientY - rc.y).toFixed(1)}px)`;
    body.classList.add('sticking');
    move(e); e.preventDefault();
  });
  const move = e => {
    if (e.pointerId !== sId) return;
    let dx = e.clientX - c0.x, dy = e.clientY - c0.y; const d = Math.hypot(dx, dy);
    if (d > R) { dx *= R / d; dy *= R / d; }
    knobAt(dx, dy);
    h.stick({ x: dx / R, y: -dy / R });
  };
  zone.addEventListener('pointermove', move);
  const sUp = e => {
    if (e.pointerId !== sId) return;
    sId = null; knobAt(0, 0); stick.style.transform = ''; body.classList.remove('sticking');
    h.stick(null);
  };
  zone.addEventListener('pointerup', sUp); zone.addEventListener('pointercancel', sUp); zone.addEventListener('lostpointercapture', sUp);
  zone.addEventListener('contextmenu', e => e.preventDefault());
  ui.stickGait = t => { if (sGait.textContent !== t) sGait.textContent = t; };
  // 操作方式：方向盘 / 按住屏幕（开始卡片和手记里都能换）
  const ctlBtns = [...document.querySelectorAll('.ctlPick button')];
  ui.ctl = c => {
    ctl = c; body.classList.toggle('stick', c === 'stick'); body.classList.toggle('holdctl', c === 'hold');
    for (const b of ctlBtns) b.classList.toggle('on', b.dataset.c === c);
    if (sId !== null) { sId = null; knobAt(0, 0); stick.style.transform = ''; body.classList.remove('sticking'); h.stick(null); }
    pts.clear(); multi = false; pinch = null; h.hold(false);
  };
  for (const b of ctlBtns) b.addEventListener('click', () => h.setCtl(b.dataset.c));
  ui.goHint = () => ctl === 'stick' ? '左下角推着走\n拖屏幕转镜头' : '按住屏幕前进';

  // 键盘
  const keys = new Set();
  const FWD = ['Space', 'ArrowUp', 'KeyW'];
  addEventListener('keydown', e => {
    if (e.repeat) return;
    keys.add(e.code);
    if (FWD.includes(e.code)) { h.hold(true); e.preventDefault(); }
    if (e.code === 'KeyT') h.toggleCam();
    if (e.code === 'KeyF') h.mode('fly');
    if (e.code === 'KeyR') h.mode('ride');
    if (e.code === 'KeyG') h.mode('foot');
    if (e.code === 'KeyA' && e.shiftKey) h.toggleAuto();
    if (e.code === 'KeyN') h.skipTime?.();
    if (e.code === 'KeyM') h.openMap?.();
    if (e.code === 'KeyP') h.photo?.();
    if (e.code === 'KeyJ') h.openJournal?.();
    if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') h.gait(+e.code.slice(5) - 1);
  });
  addEventListener('keyup', e => {
    keys.delete(e.code);
    if (FWD.includes(e.code) && !FWD.some(k => keys.has(k))) h.hold(ctl === 'hold' && pts.size === 1);
  });
  ui.keysTurn = () => ((keys.has('ArrowLeft') || keys.has('KeyA')) ? -1 : 0) + ((keys.has('ArrowRight') || keys.has('KeyD')) ? 1 : 0);
  ui.keysClimb = () => (keys.has('KeyE') ? 1 : 0) - (keys.has('KeyQ') ? 1 : 0);
  return ui;
}
