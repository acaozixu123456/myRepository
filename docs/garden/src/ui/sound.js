// 轻音效：全部用 WebAudio 现场合成，不用下载音频文件。设置里可以关。
let ctx = null, on = true;
export const setSound = v => { on = !!v; };
function ac() { if (!ctx) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ctx = new A(); } if (ctx.state === 'suspended') ctx.resume(); return ctx; }
// 一个音：频率从 f0 滑到 f1，type 波形，dur 秒，vol 音量
function tone(f0, f1, dur, type = 'sine', vol = 0.12, delay = 0) {
  const c = ac(); if (!c) return; const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol = 0.08, hp = 800) {
  const c = ac(); if (!c) return; const n = c.sampleRate * dur, buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol;
  src.buffer = buf; src.connect(f).connect(g).connect(c.destination); src.start();
}
const SFX = {
  tap: () => tone(880, 660, 0.06, 'triangle', 0.05),
  hit: () => { noise(0.12, 0.09, 1200); tone(220, 90, 0.12, 'square', 0.04); },
  crit: () => { noise(0.18, 0.14, 600); tone(330, 70, 0.2, 'sawtooth', 0.06); },
  heal: () => { tone(523, 784, 0.18, 'sine', 0.08); tone(784, 1046, 0.2, 'sine', 0.06, 0.08); },
  coin: () => { tone(1318, 1318, 0.06, 'square', 0.04); tone(1760, 1760, 0.12, 'square', 0.04, 0.06); },
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.16, 'triangle', 0.08, i * 0.09)),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, f * 0.98, 0.22, 'sine', 0.07, i * 0.14)),
  level: () => [523, 659, 784, 659, 1046].forEach((f, i) => tone(f, f, 0.14, 'triangle', 0.08, i * 0.08)),
  capture: () => { tone(400, 1200, 0.3, 'sine', 0.07); tone(1200, 1600, 0.15, 'triangle', 0.05, 0.3); },
  open: () => tone(392, 523, 0.1, 'sine', 0.05),
};
export function sfx(name) { if (!on) return; try { SFX[name]?.(); } catch { /* 没有声音也不影响玩 */ } }
// 所有按钮按下时都轻轻响一下
export function bindTaps(root) { root.addEventListener('pointerdown', e => { if (e.target.closest('button')) sfx('tap'); }, { passive: true }); }
