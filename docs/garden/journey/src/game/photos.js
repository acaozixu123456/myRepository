// 相册：照片存在这台手机的浏览器里（IndexedDB，比 localStorage 能放的多得多）。
// 每张照片：{ id, t 拍的时间, d 第几天, h 钟点, place 地方 id, name 地方名, w, h2 尺寸, f 滤镜, blob 原图, thumb 小图 }
// 打开游戏时只读一遍列表（小图做成 objectURL 给手记用），原图看的时候再取。存不了（无痕模式等）就只在这次打开里看得到。
const DB = 'journey.photos', ST = 'photos';
let dbP = null;
function db() {
  if (!dbP) dbP = new Promise((res, rej) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(ST)) r.result.createObjectStore(ST, { keyPath: 'id' }); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    } catch (e) { rej(e); }
  });
  return dbP;
}
const tx = async (mode, f) => {
  const d = await db();
  return new Promise((res, rej) => { const t = d.transaction(ST, mode), st = t.objectStore(ST); const r = f(st); t.oncomplete = () => res(r && 'result' in r ? r.result : undefined); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
};

export class Album {
  constructor() {
    this.list = [];          // 按拍摄时间从早到晚
    this.mem = new Map();    // 存不进数据库时，原图留在内存里
    this.ok = typeof indexedDB !== 'undefined';
    this.ready = this.load();
    this.onChange = null;
  }
  async load() {
    if (!this.ok) return;
    try {
      const all = await tx('readonly', st => st.getAll());
      this.list = (all || []).filter(p => p && p.id && p.thumb).sort((a, b) => a.t - b.t).map(p => this.meta(p));
      // 尽量别让系统清掉（iPhone 添加到主屏幕后基本会保留）
      navigator.storage?.persist?.().catch(() => {});
    } catch (e) { console.warn('[j] album', e); this.ok = false; }
  }
  meta(p) {
    const { blob, ...m } = p;
    m.url = URL.createObjectURL(p.thumb);
    return m;
  }
  async add(rec) {
    const m = this.meta(rec);
    this.list.push(m);
    let saved = false;
    if (this.ok) { try { await tx('readwrite', st => st.put(rec)); saved = true; } catch (e) { console.warn('[j] album put', e); } }
    if (!saved) this.mem.set(rec.id, rec.blob);
    this.onChange?.();
    return { meta: m, saved };
  }
  async blob(id) {
    if (this.mem.has(id)) return this.mem.get(id);
    if (!this.ok) return null;
    try { const r = await tx('readonly', st => st.get(id)); return r?.blob || null; } catch { return null; }
  }
  async remove(id) {
    const i = this.list.findIndex(p => p.id === id); if (i < 0) return;
    URL.revokeObjectURL(this.list[i].url);
    this.list.splice(i, 1); this.mem.delete(id);
    if (this.ok) { try { await tx('readwrite', st => st.delete(id)); } catch {} }
    this.onChange?.();
  }
  async clear() {
    for (const p of this.list) URL.revokeObjectURL(p.url);
    this.list = []; this.mem.clear();
    if (this.ok) { try { await tx('readwrite', st => st.clear()); } catch {} }
    this.onChange?.();
  }
  of(place) { return this.list.filter(p => p.place === place); }
  get(id) { return this.list.find(p => p.id === id); }
}

// 滤镜：和 CSS filter 一样的几种颜色变换。预览时直接给画布加 CSS filter，拍下来时用同样的矩阵逐像素算（老 Safari 的 2D 画布不支持 filter）
export const FILTERS = [
  { id: 'none', name: '原色', ops: [] },
  { id: 'warm', name: '暖阳', ops: [['sepia', 0.22], ['saturate', 1.15], ['brightness', 1.04]] },
  { id: 'film', name: '胶片', ops: [['contrast', 0.9], ['sepia', 0.16], ['saturate', 0.85], ['brightness', 1.06]], vig: 0.32 },
  { id: 'cool', name: '清晨', ops: [['hue-rotate', -10], ['saturate', 0.88], ['brightness', 1.05], ['contrast', 0.96]] },
  { id: 'vivid', name: '浓郁', ops: [['saturate', 1.38], ['contrast', 1.06]] },
  { id: 'mono', name: '黑白', ops: [['grayscale', 1], ['contrast', 1.14], ['brightness', 1.02]], vig: 0.22 },
];
export const cssFilter = F => F.ops.map(([k, v]) => k === 'hue-rotate' ? `hue-rotate(${v}deg)` : `${k}(${v})`).join(' ') || 'none';
// 3×4 颜色矩阵（最后一列是偏移，0~1）
function opMatrix(k, a) {
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
  if (k === 'brightness') return [a, 0, 0, 0, 0, a, 0, 0, 0, 0, a, 0];
  if (k === 'contrast') { const o = 0.5 - 0.5 * a; return [a, 0, 0, o, 0, a, 0, o, 0, 0, a, o]; }
  if (k === 'saturate') return [0.213 + 0.787 * a, 0.715 - 0.715 * a, 0.072 - 0.072 * a, 0, 0.213 - 0.213 * a, 0.715 + 0.285 * a, 0.072 - 0.072 * a, 0, 0.213 - 0.213 * a, 0.715 - 0.715 * a, 0.072 + 0.928 * a, 0];
  if (k === 'grayscale') { const b = 1 - a; return [0.2126 + 0.7874 * b, 0.7152 - 0.7152 * b, 0.0722 - 0.0722 * b, 0, 0.2126 - 0.2126 * b, 0.7152 + 0.2848 * b, 0.0722 - 0.0722 * b, 0, 0.2126 - 0.2126 * b, 0.7152 - 0.7152 * b, 0.0722 + 0.9278 * b, 0]; }
  if (k === 'sepia') { const b = 1 - a; return [0.393 + 0.607 * b, 0.769 - 0.769 * b, 0.189 - 0.189 * b, 0, 0.349 - 0.349 * b, 0.686 + 0.314 * b, 0.168 - 0.168 * b, 0, 0.272 - 0.272 * b, 0.534 - 0.534 * b, 0.131 + 0.869 * b, 0]; }
  if (k === 'hue-rotate') {
    const r = a * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
    return [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928, 0,
      0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283, 0,
      0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072, 0];
  }
  return I;
}
const mul = (B, A) => {   // 先 A 后 B
  const o = new Array(12);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) o[i * 4 + j] = B[i * 4] * A[j] + B[i * 4 + 1] * A[4 + j] + B[i * 4 + 2] * A[8 + j];
    o[i * 4 + 3] = B[i * 4] * A[3] + B[i * 4 + 1] * A[7] + B[i * 4 + 2] * A[11] + B[i * 4 + 3];
  }
  return o;
};
// 给 2D 画布上的图套滤镜（CSS 的滤镜每一步都会截到 0~1，这里也一样逐步截）
export function applyFilter(ctx, w, h, F) {
  if (F.ops.length) {
    const img = ctx.getImageData(0, 0, w, h), D = img.data;
    const Ms = F.ops.map(([k, v]) => opMatrix(k, v));
    // 相邻的步骤合起来算（都在 0~1 里的时候结果一样），快很多
    const M = Ms.reduce((a, b) => mul(b, a));
    for (let i = 0; i < D.length; i += 4) {
      const r = D[i] / 255, g = D[i + 1] / 255, b = D[i + 2] / 255;
      D[i] = (M[0] * r + M[1] * g + M[2] * b + M[3]) * 255;
      D[i + 1] = (M[4] * r + M[5] * g + M[6] * b + M[7]) * 255;
      D[i + 2] = (M[8] * r + M[9] * g + M[10] * b + M[11]) * 255;
    }
    ctx.putImageData(img, 0, 0);
  }
  if (F.vig) {
    const g = ctx.createRadialGradient(w / 2, h * 0.47, Math.min(w, h) * 0.35, w / 2, h * 0.47, Math.hypot(w, h) * 0.58);
    g.addColorStop(0, 'rgba(30, 18, 12, 0)'); g.addColorStop(1, `rgba(30, 18, 12, ${F.vig})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
}
const toBlob = (cv, q) => new Promise(res => cv.toBlob(b => res(b), 'image/jpeg', q));
// 从 WebGL 画布拍一张：套滤镜、可选落款，返回原图和小图
export async function makePhoto(src, F, stamp) {
  const w = src.width, h = src.height;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.drawImage(src, 0, 0);
  applyFilter(g, w, h, F);
  if (stamp) {
    const s = Math.max(w, h) / 900, pad = 18 * s;
    g.font = `500 ${Math.round(15 * s)}px "Songti SC", "STSong", "Noto Serif SC", serif`;
    g.textAlign = 'right'; g.textBaseline = 'alphabetic';
    g.shadowColor = 'rgba(40, 20, 10, 0.55)'; g.shadowBlur = 6 * s;
    g.fillStyle = 'rgba(255, 246, 230, 0.92)';
    g.fillText(stamp, w - pad, h - pad);
    g.shadowBlur = 0;
  }
  const blob = await toBlob(cv, 0.9);
  const tw = 360, th = Math.round(h * tw / w);
  const tc = document.createElement('canvas'); tc.width = tw; tc.height = th;
  const tg = tc.getContext('2d'); tg.imageSmoothingQuality = 'high'; tg.drawImage(cv, 0, 0, tw, th);
  const thumb = await toBlob(tc, 0.8);
  return { blob, thumb, w, h };
}
