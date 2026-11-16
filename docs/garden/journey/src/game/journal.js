// 旅行手记：三页 ——「地方」（去过的地方和营地，第一张照片当封面）、「相册」（拍过的照片）、「日记」（每天去了哪、在哪歇脚、拍了什么，自动写的）。
// 点地方看详情（照片、第一次去是哪天、在地图上看、一键过去）；点照片看大图（存到手机、设为封面、删掉）。
import { periodOf } from '../world/daytime.js';
import { FINDS, FIND_KINDS, findOf } from './finds.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const when = (d, h) => `第 ${d} 天 · ${periodOf(h).name}`;

// h: { J, album, covers(), setCover(place, id), openMap(id), travel(P), canTravel(), restart(), onClose() }
export class Journal {
  constructor(h) {
    this.h = h; this.tab = 'places'; this.isOpen = false;
    this.el = $('journalSheet'); this.body = $('jBody'); this.detail = $('jDetail'); this.viewer = $('viewer');
    $('journalClose').addEventListener('click', () => this.close());
    $('jTabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) this.show(b.dataset.t); });
    this.body.addEventListener('click', e => {
      const c = e.target.closest('[data-place]'); if (c) return this.openPlace(c.dataset.place);
      const f = e.target.closest('[data-find]'); if (f) return this.openFind(f.dataset.find);
      const p = e.target.closest('[data-photo]'); if (p) return this.openPhoto(p.dataset.photo, p.dataset.set || null);
    });
    this.detail.addEventListener('click', e => {
      if (e.target === this.detail) return this.closePlace();
      const p = e.target.closest('[data-photo]'); if (p) return this.openPhoto(p.dataset.photo, p.dataset.set || null);
      const b = e.target.closest('button[data-a]'); if (!b) return;
      if (b.dataset.a === 'close') return this.closePlace();
      if (b.dataset.a === 'fmap') { const id = this.detailId; this.close(); this.h.openMap(id); return; }
      const P = this.placeOf(this.detailId);
      if (b.dataset.a === 'map') { this.close(); this.h.openMap(P.id); }
      if (b.dataset.a === 'go') { this.close(); this.h.travel(P); }
    });
    // 从头再来：点两下才算（免得手滑）
    const rs = $('jRestart'); let armT = 0;
    rs.addEventListener('click', () => {
      if (!rs.classList.contains('arm')) { rs.classList.add('arm'); rs.textContent = '再点一下：清掉存档从头走（照片会留着）'; clearTimeout(armT); armT = setTimeout(() => { rs.classList.remove('arm'); rs.textContent = '从头再来'; }, 3500); return; }
      rs.classList.remove('arm'); rs.textContent = '从头再来'; this.close(); this.h.restart();
    });
    this.viewerInit();
    h.album.onChange = () => { if (this.isOpen) this.render(); };
  }
  placeOf(id) { return this.h.J.places.find(p => p.id === id); }
  open(tab) {
    this.isOpen = true; this.el.hidden = false;
    this.show(tab || this.tab);
  }
  close() { if (!this.isOpen) return; this.isOpen = false; this.el.hidden = true; this.closePlace(); this.viewer.hidden = true; this.h.onClose?.(); }
  show(tab) {
    this.tab = tab;
    for (const b of $('jTabs').children) b.classList.toggle('on', b.dataset.t === tab);
    this.render(); this.body.scrollTop = 0;
  }
  // 第一次到某个地方是哪天（老存档没有日记就不知道）
  firstVisit(id) { const e = this.h.J.log.find(e => e.k === 'visit' && e.id === id); return e ? when(e.d, e.h) : null; }
  cover(id) {
    const A = this.h.album, c = this.h.covers()[id];
    return (c && A.get(c)) || A.of(id)[0] || null;
  }
  render() {
    const J = this.h.J, A = this.h.album;
    const seen = J.places.filter(p => J.visited.includes(p.id)).length, camps = J.camps.size;
    const d = J.dist, km = v => v >= 1000 ? (v / 1000).toFixed(1) + ' 千米' : Math.round(v) + ' 米';
    const total = d.foot + d.ride + d.fly;
    const nf = Object.keys(J.found).length;
    $('jStats').textContent = `第 ${J.dayN} 天 · 到过 ${seen}/${J.places.length} 处 · 见闻 ${nf}/${FINDS.length} · 点过 ${camps} 堆篝火 · ${A.list.length} 张照片${total > 50 ? ' · 一共走了 ' + km(total) : ''}`;
    if (this.tab === 'places') this.body.innerHTML = this.placesHTML();
    else if (this.tab === 'album') this.body.innerHTML = this.albumHTML();
    else if (this.tab === 'finds') this.body.innerHTML = this.findsHTML();
    else this.body.innerHTML = this.diaryHTML();
  }
  placesHTML() {
    const J = this.h.J;
    const card = P => {
      const seen = J.visited.includes(P.id), c = this.cover(P.id), n = this.h.album.of(P.id).length;
      const camp = P.kind === 'camp', lit = camp && J.camps.has(P.id);
      const line = seen ? (this.firstVisit(P.id) || '到过') : P.where;
      return `<button type="button" class="pc ${seen ? 'seen' : 'todo'}${camp ? ' camp' : ''}" data-place="${P.id}">
        <span class="ph">${c ? `<img src="${c.url}" alt="">` : `<i>${seen ? '还没拍照' : '？'}</i>`}${n > 1 ? `<em>${n}</em>` : ''}${lit ? '<s title="篝火点过了"></s>' : ''}</span>
        <b>${esc(P.name)}</b><small>${esc(line)}</small></button>`;
    };
    const spots = J.places.filter(p => p.kind !== 'camp' && p.kind !== 'vista'), camps = J.places.filter(p => p.kind === 'camp');
    return `<h3>风景</h3><div class="grid">${spots.map(card).join('')}</div><h3>营地 <small>坐下烤火就点起篝火，夜里远远就看得见</small></h3><div class="grid">${camps.map(card).join('')}</div>`;
  }
  albumHTML() {
    const L = this.h.album.list;
    if (!L.length) return `<p class="empty">还没有照片。<br>走着走着看到好看的，点右下角的「拍照」。</p>`;
    const J = this.h.J;
    return `<div class="album">${L.slice().reverse().map(p => `<button type="button" data-photo="${p.id}" data-set="all"><img src="${p.url}" alt=""><small>${esc(p.name || '路上')}</small></button>`).join('')}</div>`
      + (this.h.album.ok ? '' : `<p class="empty">这个浏览器存不了照片（无痕模式？），关掉就没了。可以点开照片存到手机。</p>`);
  }
  diaryHTML() {
    const J = this.h.J, A = this.h.album, name = id => this.placeOf(id)?.name || '路上';
    const days = new Map();
    for (const e of J.log) { if (!days.has(e.d)) days.set(e.d, []); days.get(e.d).push(e); }
    if (!days.size) return `<p class="empty">${J.visited.length ? '以前走过的路没有记日记，从现在开始记。' : '还什么都没写。出发吧。'}</p>`;
    const line = e => {
      const P = this.placeOf(e.id);
      if (e.k === 'visit') { const t = P?.sub || ''; return `到了<b>${esc(name(e.id))}</b>。${esc(t)}${t && !/[。！？…]$/.test(t) ? '。' : ''}`; }
      if (e.k === 'camp') return `在<b>${esc(name(e.id))}</b>点起了篝火。`;
      if (e.k === 'rest') return `在<b>${esc(name(e.id))}</b>坐下来烤了会儿火。`;
      if (e.k === 'weather') return { cloudy: '云慢慢多了起来。', rain: '下起了小雨。', fog: '起雾了，远处的山看不见了。', snow: '飘起了雪。', clear: '天晴了。' }[e.id] || '';
      if (e.k === 'find') {
        const F = findOf(e.id); if (!F) return '';
        if (F.kind === 'folk') return `碰到一位<b>${esc(F.name)}</b>，聊了几句。`;
        if (F.kind === 'sky') return `看到了<b>${esc(F.name)}</b>！${esc(F.sub)}。`;
        return `遇见了<b>${esc(F.name)}</b>。${esc(F.sub)}。`;
      }
      if (e.k === 'sleep') return `在<b>${esc(name(e.id))}</b>的火边睡了一觉。`;
      if (e.k === 'photo') { const p = A.get(e.p); return `在<b>${esc(name(e.id))}</b>拍了张照片。${p ? `<button type="button" class="dthumb" data-photo="${p.id}" data-set="all"><img src="${p.url}" alt=""></button>` : ''}`; }
      return '';
    };
    return [...days.entries()].sort((a, b) => b[0] - a[0]).map(([d, es]) =>
      `<section class="day"><h3>第 ${d} 天</h3><ul>${es.map(e => `<li><i>${periodOf(e.h).name}</i><span>${line(e)}</span></li>`).join('')}</ul></section>`).join('');
  }
  // ---------- 见闻 ----------
  findPhoto(id) { const f = this.h.J.found[id]; return f?.photo ? this.h.album.get(f.photo) : null; }
  findsHTML() {
    const J = this.h.J;
    const card = F => {
      const f = J.found[F.id], ph = this.findPhoto(F.id) || (F.kind === 'vista' && f ? this.cover(F.id) : null), told = J.tips.has(F.id);
      const line = f ? `${when(f.d, f.h)}${F.kind === 'vista' ? ' 上去过' : ' 遇见'}` : (told ? '听说：' : '') + F.hint;
      return `<button type="button" class="pc find ${f ? 'seen' : 'todo'}" data-find="${F.id}">
        <span class="ph">${ph ? `<img src="${ph.url}" alt="">` : `<i class="g">${f ? F.g : '？'}</i>`}</span>
        <b>${esc(f ? F.name : F.kind === 'folk' || F.kind === 'vista' ? '？？？' : F.name)}</b><small class="${!f && told ? 'tip' : ''}">${esc(line)}</small></button>`;
    };
    return FIND_KINDS.map(K => {
      const L = FINDS.filter(F => F.kind === K.id), n = L.filter(F => J.found[F.id]).length;
      return `<h3>${K.name} ${n}/${L.length} <small>${esc(K.sub)}</small></h3><div class="grid">${L.map(card).join('')}</div>`;
    }).join('');
  }
  openFind(id) {
    const J = this.h.J, F = findOf(id); if (!F) return;
    this.detailId = id; this.detailKind = 'find';
    const f = J.found[id], told = J.tips.has(id);
    const ps = this.h.album.list.filter(p => (p.subj || []).includes(id) || (F.kind === 'vista' && p.place === id));
    const big = this.findPhoto(id) || ps[0];
    const onMap = this.h.markOf?.(id);
    const btns = onMap && (f || told) ? [['fmap', '在地图上看']] : [];
    this.detail.innerHTML = `<div class="card">
      <div class="big">${big ? `<img src="${big.url}" alt="">` : `<i>${f ? '还没拍到照片' : '还没遇见'}</i>`}</div>
      <b>${esc(f || F.kind === 'animal' || F.kind === 'sky' ? F.name : '？？？')}</b>
      <small>${esc(f ? F.sub : (told ? '听说：' : '线索：') + F.hint)}</small>
      <small>${f ? when(f.d, f.h) + (F.kind === 'vista' ? ' 第一次上来' : ' 第一次遇见') + (f.n ? ` · 打过 ${f.n} 次招呼` : '') : told ? '地图上标出来了' : ''}${ps.length ? ` · ${ps.length} 张照片` : ''}</small>
      ${ps.length ? `<div class="strip">${ps.map(p => `<button type="button" data-photo="${p.id}" data-set="all"><img src="${p.url}" alt=""></button>`).join('')}</div>` : ''}
      <div class="row">${btns.map(([a, t]) => `<button type="button" data-a="${a}">${t}</button>`).join('')}</div>
      <button type="button" class="link" data-a="close">回到手记</button></div>`;
    this.detail.hidden = false;
  }
  // ---------- 地方详情 ----------
  refreshDetail() { if (!this.detailId) return; if (this.detailKind === 'find') this.openFind(this.detailId); else this.openPlace(this.detailId); }
  openPlace(id) {
    const J = this.h.J, P = this.placeOf(id); if (!P) return;
    this.detailId = id; this.detailKind = 'place';
    const seen = J.visited.includes(id), ps = this.h.album.of(id), c = this.cover(id);
    const fv = this.firstVisit(id), camp = P.kind === 'camp';
    const btns = [];
    if (P.x !== undefined) btns.push(['map', '在地图上看']);
    if (seen && P.x !== undefined) btns.push(this.h.canTravel() ? ['go', '去这里'] : ['', '坐着呢，先站起来']);
    this.detail.innerHTML = `<div class="card">
      <div class="big">${c ? `<img src="${c.url}" alt="">` : `<i>${seen ? '还没在这儿拍过照' : '还没去过'}</i>`}</div>
      <b>${esc(P.name)}</b>
      <small>${esc(seen ? P.sub : P.where)}</small>
      <small>${seen ? (fv ? fv + ' 第一次来' : '来过') : '还没去过'}${camp ? (J.camps.has(id) ? ' · 篝火点过了' : ' · 篝火还没点') : ''}${ps.length ? ` · ${ps.length} 张照片` : ''}</small>
      ${ps.length ? `<div class="strip">${ps.map(p => `<button type="button" data-photo="${p.id}" data-set="place"><img src="${p.url}" alt=""></button>`).join('')}</div>` : ''}
      <div class="row">${btns.map(([a, t]) => `<button type="button" data-a="${a}"${a ? '' : ' disabled'}>${t}</button>`).join('')}</div>
      <button type="button" class="link" data-a="close">回到手记</button></div>`;
    this.detail.hidden = false;
  }
  closePlace() { this.detail.hidden = true; this.detailId = null; }
  // ---------- 看大图 ----------
  viewerInit() {
    const v = this.viewer;
    v.addEventListener('click', async e => {
      const b = e.target.closest('button[data-a]'); if (!b) { if (e.target === v || e.target.id === 'vImgBox') this.closePhoto(); return; }
      const a = b.dataset.a, p = this.h.album.get(this.vId);
      if (a === 'close') return this.closePhoto();
      if (a === 'prev' || a === 'next') return this.stepPhoto(a === 'next' ? 1 : -1);
      if (!p) return;
      if (a === 'save') return this.savePhoto(p);
      if (a === 'cover') { this.h.setCover(p.place, p.id); b.textContent = '已设为封面'; b.disabled = true; this.refreshDetail(); return; }
      if (a === 'del') {
        if (!b.classList.contains('arm')) { b.classList.add('arm'); b.textContent = '再点一下删掉'; return; }
        const set = this.vSet, i = set.indexOf(p.id);
        await this.h.album.remove(p.id);
        this.vSet = set.filter(id => id !== p.id);
        this.refreshDetail();
        if (!this.vSet.length) return this.closePhoto();
        this.showPhoto(this.vSet[Math.min(i, this.vSet.length - 1)]);
      }
    });
    // 左右滑换一张
    let sx = null;
    v.addEventListener('pointerdown', e => { sx = e.clientX; });
    v.addEventListener('pointerup', e => { if (sx === null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 50) this.stepPhoto(dx < 0 ? 1 : -1); });
  }
  openPhoto(id, set) {
    const A = this.h.album, p = A.get(id); if (!p) return;
    this.vSet = (set === 'place' ? A.of(p.place) : A.list.slice().reverse()).map(q => q.id);
    this.viewer.hidden = false;
    this.showPhoto(id);
  }
  async showPhoto(id) {
    const p = this.h.album.get(id); if (!p) return;
    this.vId = id;
    const img = $('vImg');
    img.src = p.url;                     // 先放小图，原图取到了再换
    if (this.vURL) { URL.revokeObjectURL(this.vURL); this.vURL = null; }
    $('vCap').textContent = `${p.name || '路上'} · ${when(p.d, p.h)}`;
    const i = this.vSet.indexOf(id);
    $('vPrev').disabled = i <= 0; $('vNext').disabled = i >= this.vSet.length - 1;
    const cv = this.h.covers()[p.place], isCover = p.place && (cv ? cv === p.id : this.h.album.of(p.place)[0]?.id === p.id);
    const cb = this.viewer.querySelector('[data-a="cover"]'); cb.hidden = !p.place; cb.disabled = isCover; cb.textContent = isCover ? '是封面' : '设为封面';
    const db = this.viewer.querySelector('[data-a="del"]'); db.classList.remove('arm'); db.textContent = '删掉';
    const blob = await this.h.album.blob(id);
    if (blob && this.vId === id) { this.vURL = URL.createObjectURL(blob); img.src = this.vURL; }
  }
  stepPhoto(k) { const i = this.vSet.indexOf(this.vId) + k; if (i >= 0 && i < this.vSet.length) this.showPhoto(this.vSet[i]); }
  closePhoto() { this.viewer.hidden = true; if (this.vURL) { URL.revokeObjectURL(this.vURL); this.vURL = null; } this.vId = null; }
  // 存到手机：iPhone 上弹出分享，选“存储图像”就进相册；电脑上直接下载
  async savePhoto(p) {
    const blob = await this.h.album.blob(p.id); if (!blob) return;
    const d = new Date(p.t), pad = n => String(n).padStart(2, '0');
    const fname = `旅途-${p.name || '路上'}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.jpg`;
    try {
      const file = new File([blob], fname, { type: 'image/jpeg' });
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file] }); return; }
    } catch (e) { if (e?.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fname;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
}
