import { catSvg, setCatStyle } from '../art/cat';
import { HEROES } from '../data/heroes';
const q = new URLSearchParams(location.search);
setCatStyle(q.get('style') ?? 'A');
const from = +(q.get('from') ?? 0);
const n = +(q.get('n') ?? 12);
const w = +(q.get('w') ?? 240);
document.getElementById('app')!.innerHTML = HEROES.slice(from, from + n)
  .map((h) => `<div style="width:${w}px;text-align:center;font:14px sans-serif">${catSvg(h.look, { width: w })}${h.name}</div>`)
  .join('');
