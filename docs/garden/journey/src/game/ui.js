// 界面和操作：开始卡片、顶部地名和进度、横幅、步态和工具按钮、结尾卡片；
// 手势：按住前进、左右拖动看风景、双指捏合切换俯视。电脑上：空格/↑ 前进，←→ 看风景，T 俯视，1/2/3 步态。
const $ = id => document.getElementById(id);

export function initUI(h) {
  const body = document.body;
  const ui = {};
  // ---------- 开始卡片 ----------
  const go = $('go'), pick = $('horsePick');
  ui.loading = t => { $('loadText').textContent = t; };
  ui.ready = () => { go.disabled = false; go.textContent = '出发'; $('loadText').textContent = ''; };
  ui.failed = t => { go.disabled = true; go.textContent = '加载失败'; $('loadText').textContent = t; };
  pick.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    for (const x of pick.children) x.classList.toggle('on', x === b);
    h.pickHorse(b.dataset.h);
  });
  ui.setPick = k => { for (const x of pick.children) x.classList.toggle('on', x.dataset.h === k); };
  go.addEventListener('click', () => { if (!go.disabled) h.go(); });
  ui.playing = on => body.classList.toggle('playing', on);
  $('creditsBtn').addEventListener('click', () => { $('credits').hidden = false; });
  $('creditsClose').addEventListener('click', () => { $('credits').hidden = true; });

  // ---------- 顶部 ----------
  const place = document.querySelector('.place'), pName = $('placeName'), pSub = $('placeSub');
  ui.place = (name, sub = '') => { pName.textContent = name; pSub.textContent = sub; place.classList.toggle('show', !!name); };
  const bar = document.querySelector('#progress i');
  ui.progress = f => { bar.style.width = (Math.max(0, Math.min(1, f)) * 100).toFixed(1) + '%'; };
  const perf = $('perf');
  ui.perf = t => { perf.textContent = t; };
  perf.addEventListener('click', () => h.cycleQuality());
  // 横幅：进入一个新地方时显示几秒
  const banner = $('banner'); let bannerT = 0;
  ui.banner = (name, sub = '', dur = 4.5) => {
    banner.querySelector('b').textContent = name; banner.querySelector('small').textContent = sub;
    banner.classList.add('show'); clearTimeout(bannerT); bannerT = setTimeout(() => banner.classList.remove('show'), dur * 1000);
  };
  ui.bannerOff = () => { clearTimeout(bannerT); banner.classList.remove('show'); };
  const hint = $('hint');
  ui.hint = (t) => { if (t) hint.textContent = t; hint.classList.toggle('off', !t); };

  // ---------- 下方按钮 ----------
  const gaits = $('gaits');
  gaits.addEventListener('click', e => { const b = e.target.closest('button'); if (b) h.gait(+b.dataset.g); });
  ui.gait = i => { for (const b of gaits.children) b.classList.toggle('on', +b.dataset.g === i); };
  const tool = (id, f) => $(id).addEventListener('click', f);
  tool('bAuto', () => h.toggleAuto()); tool('bCam', () => h.toggleCam()); tool('bHorse', () => h.swapHorse()); tool('bSound', () => h.toggleSound());
  ui.tool = (id, on, text) => { const b = $(id); b.classList.toggle('on', !!on); if (text) b.textContent = text; };

  // ---------- 结尾 ----------
  ui.summary = (title, html) => { const s = $('summary'); s.querySelector('h2').textContent = title; $('sumText').innerHTML = html; s.hidden = false; };
  ui.summaryOff = () => { $('summary').hidden = true; };
  $('again').addEventListener('click', () => h.again(false));
  $('againSwap').addEventListener('click', () => h.again(true));
  ui.fade = (on) => body.classList.toggle('dim', on);

  // ---------- 手势 ----------
  const canvas = $('c');
  const pts = new Map();
  let pinch = null, multi = false;
  const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  const sync = () => h.hold(pts.size === 1 && !multi);
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
    if (pts.size === 1 && !multi) h.look(dx / innerWidth, dy / innerHeight);
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
  // 键盘
  const keys = new Set();
  addEventListener('keydown', e => {
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { h.hold(true); e.preventDefault(); }
    if (e.code === 'KeyT') h.toggleCam();
    if (e.code === 'KeyA' && e.shiftKey) h.toggleAuto();
    if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') h.gait(+e.code.slice(5) - 1);
  });
  addEventListener('keyup', e => {
    keys.delete(e.code);
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') h.hold(pts.size === 1);
  });
  ui.keysLook = () => (keys.has('ArrowLeft') ? -1 : 0) + (keys.has('ArrowRight') ? 1 : 0);
  return ui;
}
