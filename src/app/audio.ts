// 共用的 WebAudio 上下文 + 「解锁」：音效和背景音乐共用一个 AudioContext。
// 手机浏览器只在真正的用户手势里（点击 / 抬手 / 按键）允许开始发声，pointerdown 在触屏上不算；
// iPhone 在静音拨片打开时还会把 WebAudio 一起静音，所以第一次手势时顺带放一段循环的无声 <audio>，
// 把页面的音频会话切成「媒体播放」，这样和看视频一样有声音。
let ac: AudioContext | null = null;
let silent: HTMLAudioElement | null = null;
let armed = false;
const onUnlock: (() => void)[] = [];
let blockedHint: (() => void) | null = null;
let tries = 0;
/** 连续几次手势都没能出声时调用一次（多半是外层页面框架禁止了声音），用来提示玩家 */
export function onAudioBlocked(f: () => void) { blockedHint = f; }

/** 共用的 AudioContext（第一次调用时创建；浏览器不支持返回 null） */
export function audioCtx(): AudioContext | null {
  try {
    if (!ac) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
    }
    return ac;
  } catch { return null; }
}
export const audioRunning = () => ac?.state === 'running';

/** 一段 0.5 秒的无声 WAV（8 kHz 8 bit 单声道），做成 blob 地址 */
function silentWavUrl(): string {
  const n = 4000, buf = new ArrayBuffer(44 + n), v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); str(36, 'data'); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

/** 在用户手势里调用：恢复上下文、放一个空样本、启动无声 <audio>（iOS 静音拨片） */
export function unlockAudio() {
  const a = audioCtx();
  if (!a) return;
  try { (navigator as unknown as { audioSession?: { type: string } }).audioSession!.type = 'playback'; } catch { /* 不支持就算了 */ }
  if (a.state !== 'running') void a.resume().then(fire, () => {});
  try { const b = a.createBuffer(1, 1, 22050), s = a.createBufferSource(); s.buffer = b; s.connect(a.destination); s.start(0); } catch { /* 忽略 */ }
  if (!silent && /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document) {
    try {
      silent = document.createElement('audio');
      silent.setAttribute('x-webkit-airplay', 'deny'); silent.preload = 'auto'; silent.loop = true; silent.src = silentWavUrl();
      void silent.play().catch(() => { silent = null; });
    } catch { silent = null; }
  }
  fire();
}
function fire() { if (audioRunning()) for (const f of onUnlock.splice(0)) f(); }
/** 解锁成功（上下文开始运行）后执行一次 */
export function whenAudioReady(f: () => void) { if (audioRunning()) f(); else onUnlock.push(f); }

const GESTURES = ['pointerup', 'touchend', 'click', 'keydown'] as const;
/** 挂上全局手势监听：每次手势都尝试解锁，直到真的出声为止（不会只试一次就放弃） */
export function armAudio() {
  if (armed) return;
  armed = true;
  const h = () => {
    unlockAudio();
    // 一次点击会触发抬手 + click 两个事件，大约点三下还没出声就提示
    if (++tries === 6) setTimeout(() => { if (!audioRunning() && blockedHint) { blockedHint(); blockedHint = null; } }, 600);
    if (audioRunning() && (!silent || !silent.paused)) for (const g of GESTURES) window.removeEventListener(g, h, true);
  };
  for (const g of GESTURES) window.addEventListener(g, h, true);
  document.addEventListener('visibilitychange', () => {
    if (!ac) return;
    if (document.hidden) { void ac.suspend(); silent?.pause(); }
    else { void ac.resume().then(fire, () => {}); if (silent) void silent.play().catch(() => {}); }
  });
}
