// 自动存档：存在这台手机的浏览器里（localStorage）。记住在哪、几点、第几天、骑的哪匹、去过哪些地方，
// 下次打开接着走。存不了（无痕模式等）就算了，不影响玩。
const KEY = 'journey.save.v1';

export function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    return s && s.v === 1 && typeof s.x === 'number' ? s : null;
  } catch { return null; }
}
export function writeSave(data) {
  try { localStorage.setItem(KEY, JSON.stringify({ v: 1, t: Date.now(), ...data })); return true; } catch { return false; }
}
export function clearSave() {
  try { localStorage.removeItem(KEY); } catch {}
}
