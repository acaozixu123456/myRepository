// 拍照：游戏停下来（风、水、火还在动），镜头交给你摆。
// 「环绕」围着旅人转，拖动转镜头、双指拉远拉近；「眼前」站在旅人的位置往外看（人和坐骑藏起来），双指推拉焦距。
// 下面换滤镜，按快门拍下来（按高清重画一帧），收进相册和手记。
import * as THREE from 'three';
import { FILTERS, cssFilter, makePhoto } from './photos.js';
import { periodOf } from '../world/daytime.js';

const $ = id => document.getElementById(id);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const DEG = Math.PI / 180;
const _t = new THREE.Vector3(), _p = new THREE.Vector3();

// h: { J, renderer, scene, camera, album, setSize(), canvas, onShot(meta, first), openAlbum(), onExit() }
export class PhotoMode {
  constructor(h) {
    this.h = h; this.active = false; this.busy = false;
    this.view = 'orbit'; this.who = true; this.stamp = true; this.filter = FILTERS[0];
    this.o = { yaw: 0, pitch: 0.2, dist: 5, fov: 55, eyeYaw: 0, eyePitch: 0 };
    this.el = $('photo');
    $('pFilters').innerHTML = FILTERS.map(F => `<button type="button" data-f="${F.id}"${F.id === 'none' ? ' class="on"' : ''}>${F.name}</button>`).join('');
    $('pFilters').addEventListener('click', e => { const b = e.target.closest('button'); if (b) this.setFilter(b.dataset.f); });
    $('pClose').addEventListener('click', () => this.exit());
    $('pShot').addEventListener('click', () => this.shoot());
    $('pView').addEventListener('click', () => this.setView(this.view === 'orbit' ? 'eye' : 'orbit'));
    $('pWho').addEventListener('click', () => { this.who = !this.who; this.applyWho(); });
    $('pStamp').addEventListener('click', () => { this.stamp = !this.stamp; $('pStamp').classList.toggle('on', this.stamp); });
    $('pAlbum').addEventListener('click', () => { this.exit(); h.openAlbum(); });
    this.gestures();
  }
  // 拍谁：旅人胸口（骑着马时就是骑手）
  subject(out) { return this.h.J.T.bones.spine_03.getWorldPosition(out); }
  eye(out) { const b = this.h.J.T.bones.Head || this.h.J.T.bones.neck_01 || this.h.J.T.bones.spine_03; b.getWorldPosition(out); out.y += 0.08; return out; }
  enter() {
    if (this.active) return;
    const { J, camera } = this.h;
    this.active = true; J.holding = false; J.setStick?.(null);
    // 从现在的镜头位置接着摆，不跳
    this.subject(_t); _p.copy(camera.position).sub(_t);
    const d = Math.max(1.2, _p.length());
    Object.assign(this.o, { yaw: Math.atan2(_p.x, _p.z), pitch: Math.asin(clamp(_p.y / d, -0.3, 0.95)), dist: clamp(d, 1.5, 30), fov: camera.fov, fov0: camera.fov });
    const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
    this.o.eyeYaw = Math.atan2(fwd.x, fwd.z); this.o.eyePitch = Math.asin(clamp(fwd.y, -0.9, 0.9));
    this.vis = { T: J.T.root.visible, M: J.mount?.root.visible, W: J.wings.group.visible };
    document.body.classList.add('photo'); this.el.hidden = false;
    this.setView(this.view, true);
    this.setFilter(this.filter.id);
    $('pWho').classList.toggle('on', this.who); $('pStamp').classList.toggle('on', this.stamp);
    const P = J.placeHere();
    $('pPlace').textContent = P ? P.name : '路上';
    $('pTime').textContent = `第 ${J.dayN} 天 · ${periodOf(J.tod).name}`;
    this.lastThumb();
    const hint = $('pHint'); hint.classList.remove('off'); clearTimeout(this.hintT); this.hintT = setTimeout(() => hint.classList.add('off'), 3200);
  }
  exit() {
    if (!this.active) return;
    const { J, camera } = this.h;
    this.active = false;
    document.body.classList.remove('photo'); this.el.hidden = true;
    this.h.canvas.style.filter = '';
    J.T.root.visible = this.vis.T; if (J.mount) J.mount.root.visible = this.vis.M; J.wings.group.visible = this.vis.W;
    camera.fov = this.o.fov0; this.h.setSize();
    this.h.onExit?.();
  }
  setView(v, quiet) {
    this.view = v;
    $('pView').textContent = v === 'orbit' ? '环绕' : '眼前';
    $('pView').classList.toggle('eye', v === 'eye');
    $('pWho').hidden = v === 'eye';
    this.applyWho();
    if (!quiet) { const hint = $('pHint'); hint.textContent = v === 'orbit' ? '拖动转镜头，双指拉远拉近' : '拖动看四周，双指推近拉远'; hint.classList.remove('off'); clearTimeout(this.hintT); this.hintT = setTimeout(() => hint.classList.add('off'), 2600); }
  }
  applyWho() {
    const J = this.h.J, show = this.view === 'orbit' && this.who;
    J.T.root.visible = show && this.vis.T;
    if (J.mount) J.mount.root.visible = (show || J.mode !== 'ride') && this.vis.M;
    J.wings.group.visible = show && this.vis.W;
    $('pWho').classList.toggle('on', this.who);
  }
  setFilter(id) {
    this.filter = FILTERS.find(F => F.id === id) || FILTERS[0];
    for (const b of $('pFilters').children) b.classList.toggle('on', b.dataset.f === this.filter.id);
    this.h.canvas.style.filter = cssFilter(this.filter) === 'none' ? '' : cssFilter(this.filter);
    document.body.classList.toggle('pvig', !!this.filter.vig);
  }
  lastThumb() {
    const L = this.h.album.list, p = L[L.length - 1], im = $('pLast');
    if (p) { im.src = p.url; im.hidden = false; } else im.hidden = true;
  }
  // 每帧：摆镜头
  frame() {
    const { camera, J } = this.h, o = this.o;
    if (this.view === 'orbit') {
      this.subject(_t);
      const cp = Math.cos(o.pitch);
      camera.position.set(_t.x + Math.sin(o.yaw) * cp * o.dist, _t.y + Math.sin(o.pitch) * o.dist, _t.z + Math.cos(o.yaw) * cp * o.dist);
      const gy = J.groundAt(camera.position.x, camera.position.z) + 0.35;
      if (camera.position.y < gy) camera.position.y = gy;
      camera.lookAt(_t.x, _t.y + o.dist * 0.07, _t.z);
      camera.fov = o.fov0;
    } else {
      this.eye(_t); camera.position.copy(_t);
      const cp = Math.cos(o.eyePitch);
      camera.lookAt(_t.x + Math.sin(o.eyeYaw) * cp, _t.y + Math.sin(o.eyePitch), _t.z + Math.cos(o.eyeYaw) * cp);
      camera.fov = o.fov;
    }
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  gestures() {
    const el = $('photoTouch'), pts = new Map(); let pinch = null;
    const two = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
    el.addEventListener('pointerdown', e => {
      try { el.setPointerCapture(e.pointerId); } catch {}
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) pinch = { d0: two(), dist: this.o.dist, fov: this.o.fov };
      e.preventDefault();
    });
    el.addEventListener('pointermove', e => {
      const p = pts.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      const o = this.o, s = 3.2 / Math.min(innerWidth, 700);
      if (pts.size === 1 && !pinch) {
        if (this.view === 'orbit') { o.yaw -= dx * s; o.pitch = clamp(o.pitch + dy * s * 0.8, -0.25, 1.35); }
        else { const k = o.fov / 60; o.eyeYaw += dx * s * 0.6 * k; o.eyePitch = clamp(o.eyePitch + dy * s * 0.5 * k, -1.2, 1.25); }
      } else if (pts.size >= 2 && pinch) {
        const r = two() / Math.max(10, pinch.d0);
        if (this.view === 'orbit') o.dist = clamp(pinch.dist / r, 1.3, 32);
        else o.fov = clamp(pinch.fov / r, 18, 80);
      }
    });
    const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', e => {
      e.preventDefault(); const k = Math.exp(e.deltaY * 0.0012), o = this.o;
      if (this.view === 'orbit') o.dist = clamp(o.dist * k, 1.3, 32); else o.fov = clamp(o.fov * k, 18, 80);
    }, { passive: false });
  }
  // 按快门：按手机屏幕的清晰度（最多 2 倍）重画一帧，拍下来
  async shoot() {
    if (this.busy || !this.active) return;
    this.busy = true;
    const { renderer, scene, camera, J, album } = this.h;
    const fl = $('pFlash'); fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
    const pr0 = renderer.getPixelRatio(), hi = Math.min(2, Math.max(pr0, devicePixelRatio || 1));
    try {
      if (hi > pr0) { renderer.setPixelRatio(hi); renderer.setSize(innerWidth, innerHeight, false); }
      this.frame();
      renderer.render(scene, camera);
      const P = J.placeHere(), d = J.dayN, h = J.tod;
      const stamp = this.stamp ? `旅途 · ${P ? P.name : '路上'} · 第${d}天 ${periodOf(h).name}` : '';
      const shotP = makePhoto(renderer.domElement, this.filter, stamp);   // 画布在这一刻就复制走了
      const subj = [...(this.h.subjects?.(camera) || [])];                // 画面里拍到的动物、人、彩虹
      if (hi > pr0) { renderer.setPixelRatio(pr0); renderer.setSize(innerWidth, innerHeight, false); }
      const ph = await shotP;
      const id = 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
      const first = P ? album.of(P.id).length === 0 : false;
      const rec = { id, t: Date.now(), d, h: Math.round(h * 100) / 100, place: P ? P.id : null, name: P ? P.name : '路上', w: ph.w, h2: ph.h, f: this.filter.id, blob: ph.blob, thumb: ph.thumb, ...(subj.length ? { subj } : {}) };
      const r = await album.add(rec);
      J.note('photo', rec.place, id);
      this.lastThumb();
      this.h.onShot?.(r.meta, first, r.saved);
    } catch (e) {
      console.warn('[j] photo', e);
      this.toast('没拍成，再试一次');
      if (renderer.getPixelRatio() !== pr0) { renderer.setPixelRatio(pr0); renderer.setSize(innerWidth, innerHeight, false); }
    }
    this.busy = false;
  }
  toast(t, dur = 2.6) {
    const el = $('pToast'); el.textContent = t; el.classList.add('show');
    clearTimeout(this.toastT); this.toastT = setTimeout(() => el.classList.remove('show'), dur * 1000);
  }
}
