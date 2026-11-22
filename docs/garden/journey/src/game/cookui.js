// 营地做饭的小卡片：从行囊里挑一到三样放进锅里，点「下锅」。做出来的可以现在吃，也可以带着路上吃。
// 以前做出来过的搭配会先告诉你是什么；没试过的要下锅才知道。
import { ITEMS, itemOf, dishOf, cookDish, effectText } from './cook.js';

const $ = id => document.getElementById(id);

// h: { J, sound, onChange()（行囊变了，存档）, onClose() }
export class CookUI {
  constructor(h) {
    this.h = h; this.el = $('cook'); this.body = $('cookBody');
    this.isOpen = false; this.pot = []; this.result = null; this.busy = false; this.msg = '';
    this.el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || b.disabled || this.busy) return;
      const d = b.dataset;
      if (d.add) { if (this.pot.length < 3) this.pot.push(d.add); this.msg = ''; return this.render(); }
      if (d.slot) { this.pot.splice(+d.slot, 1); return this.render(); }
      if (d.a === 'back') return this.close();
      if (d.a === 'go') return this.go();
      if (d.a === 'eat') { this.h.J.eat(this.result.dish); this.msg = `吃了${this.result.D.name}。${effectText(this.result.dish)}`; this.result = null; this.h.onChange?.(); return this.render(); }
      if (d.a === 'keep') { this.h.J.keepDish(this.result.dish); this.msg = `${this.result.D.name}装进了行囊，路上饿了打开手记的「行囊」吃`; this.result = null; this.h.onChange?.(); return this.render(); }
    });
  }
  open() { this.isOpen = true; this.pot = []; this.result = null; this.msg = ''; this.busy = false; this.el.hidden = false; this.h.J.showPot(); this.render(); }
  close() { if (!this.isOpen) return; if (this.result) { if (!this.h.J.keepDish(this.result.dish)) this.h.J.eat(this.result.dish); this.result = null; this.h.onChange?.(); } this.isOpen = false; this.el.hidden = true; this.h.onClose?.(); }
  go() {
    if (!this.pot.length) return;
    this.busy = true; this.h.sound?.bubble?.(); this.render();
    setTimeout(() => {
      this.busy = false;
      if (!this.isOpen) return;
      this.result = this.h.J.cook(this.pot); this.pot = [];
      if (!this.result) this.msg = '材料不够了';
      else this.h.sound?.chime?.(this.result.isNew ? 0.45 : 0.25);
      this.h.onChange?.(); this.render();
    }, 1500);
  }
  render() {
    const J = this.h.J;
    if (this.result) {
      const { dish, D, isNew } = this.result, full = J.dishes.length >= 12;
      $('cookSub').textContent = isNew ? '新菜谱，记进手记了' : '出锅了';
      this.body.innerHTML = `<div class="dish"><b>${D.name}${dish.s > 1.05 && dish.id !== 'stew' ? ' <i>加料</i>' : ''}</b><small>${D.sub}</small><em>${effectText(dish)}</em></div>
        <div class="restRow"><button type="button" data-a="eat" class="hot">现在吃</button><button type="button" data-a="keep"${full ? ' disabled' : ''}>${full ? '行囊装满了' : '带着路上吃'}</button></div>`;
      return;
    }
    const left = id => (J.bag[id] || 0) - this.pot.filter(k => k === id).length;
    const have = ITEMS.filter(I => (J.bag[I.id] || 0) > 0);
    $('cookSub').textContent = this.busy ? '咕嘟咕嘟…' : '挑一到三样放进锅里';
    const slots = [0, 1, 2].map(i => { const I = this.pot[i] && itemOf(this.pot[i]); return I ? `<button type="button" data-slot="${i}" class="in"><i>${I.g}</i>${I.name}</button>` : `<button type="button" disabled><i></i>空着</button>`; }).join('');
    let guess = '';
    if (this.pot.length && !this.busy) { const d = cookDish(this.pot); guess = J.recipes.has(d.id) ? `会做出：${dishOf(d.id).name}${d.s > 1.05 && d.id !== 'stew' ? '（加料）' : ''} · ${effectText(d)}` : '没试过的搭配，下锅才知道'; }
    const ings = have.length ? have.map(I => `<button type="button" data-add="${I.id}"${left(I.id) <= 0 || this.pot.length >= 3 || this.busy ? ' disabled' : ''}><i>${I.g}</i>${I.name}<em>${left(I.id)}</em></button>`).join('')
      : `<p class="none">行囊里还没有能下锅的东西。<br>路上看到一闪一闪的小亮光，走过去摘。</p>`;
    this.body.innerHTML = `<div class="potRow${this.busy ? ' busy' : ''}">${slots}</div>
      <p class="guess">${guess || this.msg || ''}</p>
      <div class="ings">${ings}</div>
      <div class="restRow"><button type="button" data-a="go" class="hot"${!this.pot.length || this.busy ? ' disabled' : ''}>下锅</button><button type="button" data-a="back"${this.busy ? ' disabled' : ''}>不做了</button></div>`;
  }
}
