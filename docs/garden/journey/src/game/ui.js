// 界面和操作：开始卡片（选旅人、选坐骑）、顶部地名和手记、横幅、步态 / 走法 / 工具按钮、换坐骑面板、结尾手记；
// 手势：默认左下角方向盘走（相对镜头的方向，推远走快），屏幕其他地方拖动转镜头；老操作是按住前进、左右拖动转向
// （飞的时候上下拖动爬升下降）；双指捏合切换俯视。
// 电脑上：W A S D / 方向键 往哪走（相对镜头，Shift 跑，C 换成慢慢走），按住鼠标拖动转镜头，滚轮拉远拉近；
// 空格 跳 / 展翅 / 扇翅膀，E 互动，F 飞 / 落地，R 骑马，G 步行，Q 往下压（飞的时候），T 俯视，M 地图，J 手记，P 拍照，N 下一个时辰。
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
  // 天气：平常跟着天变（显示现在的天气），点一下依次定成 晴 → 多云 → 小雨 → 起雾 → 下雪 → 再回到随天
  const bWx = $('bWx');
  bWx.addEventListener('click', () => h.cycleWeather?.());
  ui.weather = (name, lock) => { const t = lock ? name + '·定' : name; if (bWx.textContent !== t) bWx.textContent = t; bWx.classList.toggle('lock', !!lock); };
  // 横幅：进入一个新地方时显示几秒
  const banner = $('banner'); let bannerT = 0;
  ui.banner = (name, sub = '', dur = 4.5) => {
    banner.querySelector('b').textContent = name; banner.querySelector('small').textContent = sub;
    banner.classList.add('show'); clearTimeout(bannerT); bannerT = setTimeout(() => banner.classList.remove('show'), dur * 1000);
  };
  ui.bannerOff = () => { clearTimeout(bannerT); banner.classList.remove('show'); };
  // 新的见闻：左上角一张小卡片
  const found = $('found'); let foundT = 0;
  const KIND = { animal: '路上的动物', folk: '偶遇的人', vista: '观景点', sky: '天上的' };
  ui.found = (F, dur = 5) => {
    found.querySelector('i').textContent = F.kind === 'item' ? '新的材料 · 收进了行囊' : '新的见闻 · ' + (KIND[F.kind] || '');
    found.querySelector('b').textContent = F.name; found.querySelector('small').textContent = F.sub;
    found.classList.remove('show'); void found.offsetWidth; found.classList.add('show');
    clearTimeout(foundT); foundT = setTimeout(() => found.classList.remove('show'), dur * 1000);
  };
  // 身上的好处（吃了东西、烤了火）和“冷”：气力条上面一排小牌子。list: [{ t 文字, c 样式 }]
  const buffs = $('buffs'); let buffKey = '';
  ui.buffs = list => { const k = list.map(b => b.t).join('|'); if (k === buffKey) return; buffKey = k; buffs.innerHTML = list.map(b => `<span class="${b.c || ''}">${b.t}</span>`).join(''); };
  // 说话：底下一张卡片，点一下收起来
  const talk = $('talk'); let talkT = 0;
  ui.talk = (name, text, note = '') => {
    if (!name) { talk.classList.remove('show'); return; }
    talk.querySelector('b').textContent = name; talk.querySelector('p').textContent = text;
    const sm = talk.querySelector('small'); sm.textContent = note; sm.hidden = !note;
    talk.classList.add('show'); clearTimeout(talkT);
    talkT = setTimeout(() => talk.classList.remove('show'), Math.max(6, text.length * 0.2 + (note ? 2 : 0)) * 1000);
  };
  talk.addEventListener('click', () => { clearTimeout(talkT); talk.classList.remove('show'); });
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
  // 右下角的圆按钮：跳 / 展翅 / 蹬开 / 扇翅（按住接着扇）
  const bAct = $('bAct'); let actName = '';
  ui.actA = t => { if (t === actName) return; actName = t; bAct.textContent = t; bAct.hidden = !t; if (!t) h.act?.(false); };
  bAct.addEventListener('pointerdown', e => { try { bAct.setPointerCapture(e.pointerId); } catch {} h.act?.(true); e.preventDefault(); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) bAct.addEventListener(ev, () => h.act?.(false));
  bAct.addEventListener('contextmenu', e => e.preventDefault());
  // 气力：一排小格子，没用的时候藏起来
  const stam = $('stam'); let stKey = '', stFull = 0;
  ui.stamina = (S, dt) => {
    const n = Math.ceil(S.max / 20), ne = Math.ceil(S.extra / 20 - 1e-6);
    const full = S.v >= S.max - 0.5 && S.flash <= 0;
    stFull = full ? stFull + dt : 0;
    stam.classList.toggle('show', !S.free && (stFull < 1.1 || ne > 0 && stFull < 2.5));
    const key = `${n}|${ne}|${Math.round(S.v * 2)}|${Math.round(S.extra)}|${S.spent ? 1 : 0}`;
    if (key === stKey) return; stKey = key;
    if (stam.children.length !== n + ne) stam.innerHTML = '<i><b></b></i>'.repeat(n + ne);
    for (let i = 0; i < n + ne; i++) {
      const el = stam.children[i], ex = i >= n;
      const f = ex ? Math.min(1, Math.max(0, S.extra / 20 - (i - n))) : Math.min(1, Math.max(0, S.v / 20 - i));
      el.className = ex ? 'ex' : ''; el.firstChild.style.width = (f * 100).toFixed(0) + '%';
    }
    stam.classList.toggle('spent', S.spent);
  };
  // 气力会不会用完（手记底下换）
  const stBtns = [...document.querySelectorAll('#stPick button')];
  ui.free = on => { for (const b of stBtns) b.classList.toggle('on', (b.dataset.s === 'free') === !!on); };
  for (const b of stBtns) b.addEventListener('click', () => h.setFree?.(b.dataset.s === 'free'));
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
  // 滚轮：镜头拉远拉近
  canvas.addEventListener('wheel', e => { h.wheel?.(e.deltaY * (e.deltaMode === 1 ? 30 : 1)); e.preventDefault(); }, { passive: false });
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

  // ---------- 键盘 ----------
  // W A S D / 方向键当方向盘用：往哪按往哪走（相对镜头），Shift 跑，C 换成慢慢走（走近动物用）
  const keys = new Set();
  let slow = false, kStick = false;
  const has = (...ks) => ks.some(k => keys.has(k));
  const keyStick = () => {
    const x = (has('KeyD', 'ArrowRight') ? 1 : 0) - (has('KeyA', 'ArrowLeft') ? 1 : 0), y = (has('KeyW', 'ArrowUp') ? 1 : 0) - (has('KeyS', 'ArrowDown') ? 1 : 0);
    if (!x && !y) { if (kStick) { kStick = false; h.stick(null, true); } return; }
    const m = has('ShiftLeft', 'ShiftRight') ? 1 : slow ? 0.4 : 0.7, l = Math.hypot(x, y);
    kStick = true; h.stick({ x: x / l * m, y: y / l * m }, true);
  };
  const MOVE = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ShiftLeft', 'ShiftRight'];
  addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '')) return;
    if (MOVE.includes(e.code) || e.code === 'Space') e.preventDefault();
    if (e.repeat) return;
    keys.add(e.code);
    if (MOVE.includes(e.code)) keyStick();
    if (e.code === 'Space') h.act?.(true);
    if (e.code === 'KeyE' || e.code === 'Enter') { if (!act.hidden) h.action(actText); }
    if (e.code === 'KeyC') { slow = !slow; keyStick(); h.say?.(slow ? '慢慢走（再按 C 换回来）' : '正常走'); }
    if (e.code === 'KeyT') h.toggleCam();
    if (e.code === 'KeyF') h.flyKey?.();
    if (e.code === 'KeyR') h.mode('ride');
    if (e.code === 'KeyG') h.mode('foot');
    if (e.code === 'KeyN') h.skipTime?.();
    if (e.code === 'KeyM') h.openMap?.();
    if (e.code === 'KeyP') h.photo?.();
    if (e.code === 'KeyJ') h.openJournal?.();
    if (e.code === 'Escape') h.escape?.();
    if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') h.gait(+e.code.slice(5) - 1);
  });
  addEventListener('keyup', e => {
    if (!keys.delete(e.code)) return;
    if (MOVE.includes(e.code)) keyStick();
    if (e.code === 'Space') h.act?.(false);
  });
  // 切到别的窗口：按着的键都算松开
  addEventListener('blur', () => { if (!keys.size) return; keys.clear(); keyStick(); h.act?.(false); });
  ui.keysTurn = () => 0;
  ui.keysClimb = () => (keys.has('KeyQ') ? -1 : 0);
  return ui;
}
