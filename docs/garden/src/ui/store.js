// 游戏状态的唯一持有者：读档、存档（localStorage + IndexedDB 备份）、通知界面刷新。
import * as C from '../core/index.js';

const KEY = 'rpg.v2', OLD = 'rpg.v1', subs = new Set();
export const store = { s: null };
export const subscribe = f => { subs.add(f); return () => subs.delete(f); };
export const refresh = () => { for (const f of subs) f(); };

// ---- IndexedDB：localStorage 被清掉时的第二份 ----
const idb = (() => {
  let p = null;
  const open = () => p || (p = new Promise((res, rej) => { const r = indexedDB.open('fudao', 1); r.onupgradeneeded = () => r.result.createObjectStore('save'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
  const tx = (mode, fn) => open().then(db => new Promise((res, rej) => { const t = db.transaction('save', mode), q = fn(t.objectStore('save')); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }));
  return { get: () => tx('readonly', st => st.get('main')).catch(() => null), put: v => tx('readwrite', st => st.put(v, 'main')).catch(() => {}), del: () => tx('readwrite', st => st.delete('main')).catch(() => {}) };
})();

let idbTimer = 0;
export function save() {
  const s = store.s; if (!s) return;
  s.lastSeen = new Date().toISOString();
  const json = JSON.stringify(s);
  try { localStorage.setItem(KEY, json); } catch { /* 存不了就靠 IndexedDB */ }
  clearTimeout(idbTimer); idbTimer = setTimeout(() => idb.put(json), 800);
  refresh();
}
export const saveNow = () => { if (store.s) { clearTimeout(idbTimer); const json = JSON.stringify(store.s); try { localStorage.setItem(KEY, json); } catch { /* */ } idb.put(json); } };

export async function boot() {
  if (new URLSearchParams(location.search).has('reset')) await wipe(false);
  const parse = t => { try { return t ? JSON.parse(t) : null; } catch { return null; } };
  const a = C.load(parse(localStorage.getItem(KEY))), b = C.load(parse(await idb.get()));
  // 两份都在就用较新的那份
  let s = a && b ? (a.lastSeen >= b.lastSeen ? a : b) : a || b;
  if (!s) { s = C.load(parse(localStorage.getItem(OLD))); if (s) console.info('旧存档 rpg.v1 已迁移到 v2'); }
  store.s = s; store.prevSeen = s ? Date.parse(s.lastSeen) : 0;
  if (s) save();
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveNow(); });
  addEventListener('pagehide', saveNow);
  return s;
}
export function setState(s) { store.s = s; save(); }
export async function wipe(reload = true) {
  localStorage.removeItem(KEY); localStorage.removeItem(OLD); await idb.del(); store.s = null;
  if (reload) location.replace(location.pathname);
}
