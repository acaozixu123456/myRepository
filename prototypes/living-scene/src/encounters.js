import { places, opening } from './story.js';

export function encounters({ onFocus, onHover }) {
  const $ = (selector) => document.querySelector(selector);
  const subtitle = $('#subtitle');
  const completed = new Set();
  const read = new Set();
  let active = null, nodeId = null, origin = null, explained = false;
  const buttons = places.map(place => {
    const button = document.createElement('button');
    button.className = 'scene-hotspot';
    button.id = `hotspot-${place.id}`;
    button.setAttribute('aria-label', place.name);
    button.style.width = `${place.size[0]}px`;
    button.style.height = `${place.size[1]}px`;
    const label = document.createElement('span');
    label.className = 'hotspot-label'; label.lang = 'ja'; label.textContent = place.label;
    button.append(label);
    button.onpointerenter = button.onfocus = () => onHover(place);
    button.onpointerleave = button.onblur = () => onHover(null);
    button.onclick = () => open(place, button);
    $('#hotspots').append(button);
    const entry = document.createElement('button');
    entry.textContent = place.name;
    entry.onclick = () => open(place, $('#places-toggle'));
    $('#places-nav').append(entry);
    return { place, button };
  });
  function hideNav() {
    $('#places-nav').hidden = true;
    $('#places-toggle').setAttribute('aria-expanded', 'false');
  }
  function open(place, trigger) {
    origin = trigger;
    active = place;
    hideNav();
    subtitle.hidden = false;
    $('#hotspots').inert = true;
    onHover(null);
    onFocus(place);
    show(opening(place, completed));
  }
  function show(id) {
    nodeId = id;
    const node = active.nodes[id];
    read.add(`${active.id}/${id}`);
    explained = false;
    $('#speaker').textContent = active.speaker;
    $('#story-line').textContent = node.ja;
    $('#translation').textContent = node.zh;
    $('#word-note').textContent = node.note;
    $('#explanation').hidden = true;
    $('#explain').setAttribute('aria-expanded', 'false');
    $('#explain').textContent = '读懂这一句';
    $('#choices').replaceChildren();
    for (const choice of node.choices || []) {
      const button = document.createElement('button');
      const ja = document.createElement('span'), zh = document.createElement('span');
      ja.lang = 'ja'; ja.textContent = choice.text;
      zh.className = 'choice-translation'; zh.textContent = choice.zh; zh.hidden = true;
      button.append(ja, zh);
      button.onclick = () => show(choice.next);
      $('#choices').append(button);
    }
    $('#next').hidden = !node.next;
    $('#back').textContent = node.next || node.choices ? '先看一会儿街景' : '回到街景';
    if (!node.next && !node.choices) completed.add(active.id);
    subtitle.classList.remove('explained');
    $('#story-line').focus({ preventScroll: true });
  }
  function close() {
    if (!active) return;
    active = null; nodeId = null;
    subtitle.hidden = true;
    $('#hotspots').inert = false;
    onFocus(null);
    origin?.focus({ preventScroll: true });
  }
  $('#next').onclick = () => show(active.nodes[nodeId].next);
  $('#back').onclick = close;
  $('#explain').onclick = () => {
    explained = !explained;
    $('#explanation').hidden = !explained;
    $('#explain').setAttribute('aria-expanded', String(explained));
    $('#explain').textContent = explained ? '收起解释' : '读懂这一句';
    subtitle.classList.toggle('explained', explained);
    document.querySelectorAll('.choice-translation').forEach(el => el.hidden = !explained);
  };
  $('#places-toggle').onclick = () => {
    const show = $('#places-nav').hidden;
    $('#places-nav').hidden = !show;
    $('#places-toggle').setAttribute('aria-expanded', String(show));
  };
  addEventListener('keydown', e => {
    if (e.key === 'Escape') { close(); hideNav(); }
  });
  return {
    buttons,
    close,
    snapshot: () => ({ active: active?.id ?? null, node: nodeId, completed: [...completed], read: [...read] }),
  };
}
