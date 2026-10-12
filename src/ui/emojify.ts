// 把页面里的 emoji 文字换成内嵌的 Noto Emoji 矢量图：苹果 / 微软 / 安卓的 emoji 各长各的，这样全设备一致（图标集见 emoji.ts）。
// 监听 DOM 变化，新增 / 改动的文字节点里有 emoji 就替换；canvas 里画的文字和 title 提示不受影响。
import { EMOJI } from './emoji';

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const KEYS = Object.keys(EMOJI).sort((a, b) => b.length - a.length);
const RE = new RegExp(`(?:${KEYS.map(esc).join('|')})\\uFE0F?`, 'gu');
const TEST = new RegExp(RE.source, 'u');
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'CANVAS', 'svg', 'TITLE']);
let uid = 0;

function svgOf(e: string): string {
  const n = ++uid;
  const body = EMOJI[e].replace(/id="([^"]+)"/g, `id="$1_e${n}"`).replace(/url\(#([^)]+)\)/g, `url(#$1_e${n})`).replace(/href="#([^"]+)"/g, `href="#$1_e${n}"`);
  return `<svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;
}

function convert(t: Text) {
  const txt = t.nodeValue ?? '';
  if (!TEST.test(txt)) return;
  // 包一层 span：在 flex 容器里整段文字仍然只算一个子项（否则 emoji 和文字会被拆成两项竖着排）
  const frag = document.createElement('span');
  frag.className = 'et';
  let last = 0;
  for (const m of txt.matchAll(RE)) {
    const i = m.index ?? 0;
    if (i > last) frag.append(txt.slice(last, i));
    const e = m[0].replace(/️/g, '');
    const span = document.createElement('span');
    span.className = 'em'; span.setAttribute('role', 'img'); span.setAttribute('aria-label', e);
    span.innerHTML = svgOf(e);
    frag.append(span);
    last = i + m[0].length;
  }
  if (last < txt.length) frag.append(txt.slice(last));
  t.replaceWith(frag);
}

function scan(node: Node) {
  if (node.nodeType === Node.TEXT_NODE) { const p = node.parentElement; if (p && !SKIP.has(p.tagName) && !p.closest('[data-noemoji]')) convert(node as Text); return; }
  if (node.nodeType !== Node.ELEMENT_NODE || SKIP.has((node as Element).tagName) || (node as Element).closest('[data-noemoji]')) return;
  const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  const list: Text[] = [];
  for (let n = w.nextNode(); n; n = w.nextNode()) { const p = n.parentElement; if (p && !SKIP.has(p.tagName) && !p.closest('[data-noemoji]') && TEST.test(n.nodeValue ?? '')) list.push(n as Text); }
  for (const t of list) convert(t);
}

export const EMOJIFY_CSS = '.em{display:inline-block;width:1.18em;height:1.18em;vertical-align:-.24em;line-height:0}.em svg{width:100%;height:100%;display:block}';

export function startEmojify(root: HTMLElement) {
  scan(root);
  let pending = new Set<Node>(), queued = false;
  const flush = () => { queued = false; const list = [...pending]; pending = new Set(); for (const n of list) if (n.isConnected) scan(n); };
  new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData') pending.add(m.target);
      else for (const n of m.addedNodes) pending.add(n);
    }
    if (!queued && pending.size) { queued = true; queueMicrotask(flush); }
  }).observe(root, { childList: true, subtree: true, characterData: true });
}
