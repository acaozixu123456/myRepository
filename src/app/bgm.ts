// 程序合成的背景音乐（WebAudio，无音频文件）：五声音阶的八音盒旋律 + 轻柔的和弦垫底，四小节一循环。
// 第一次用户操作后才会发声；页面不可见时自动静音；设置里可关。
export const bgmState = { on: true };

const BPM = 76;
const BEAT = 60 / BPM;
/** C 大调五声音阶（Hz）：C4 D4 E4 G4 A4 C5 D5 E5 */
const P = { C4: 261.63, D4: 293.66, E4: 329.63, G4: 392, A4: 440, C5: 523.25, D5: 587.33, E5: 659.25, G3: 196, A3: 220, C3: 130.81, F3: 174.61 };
export interface BgmNote { f: number; t: number; d: number; type: OscillatorType; v: number }
/** 四小节循环：每小节 4 拍。和弦走向 C → Am → F → C（低音 + 五度），旋律每小节 6~8 个音。 */
const CHORDS: [number, number][] = [[P.C3, P.G3], [P.A3 / 2, P.E4 / 2], [P.F3 / 2, P.C3], [P.C3, P.G3]];
const MELODY: [number, number][][] = [
  [[0, P.E4], [1, P.G4], [1.5, P.A4], [2, P.G4], [3, P.E4]],
  [[0, P.C5], [1, P.A4], [2, P.G4], [2.5, P.E4], [3, P.G4]],
  [[0, P.A4], [0.5, P.C5], [1, P.D5], [2, P.C5], [3, P.A4]],
  [[0, P.G4], [1, P.E4], [1.5, P.D4], [2, P.E4], [3.5, P.C4]],
];
export const BAR_SECONDS = BEAT * 4;
export const LOOP_BARS = MELODY.length;
/** 第 i 小节（从 0 起，自动循环）里的所有音，时间以该小节开头为 0（秒） */
export function bgmBar(i: number): BgmNote[] {
  const b = ((i % LOOP_BARS) + LOOP_BARS) % LOOP_BARS;
  const out: BgmNote[] = [];
  for (const [beat, f] of MELODY[b]) { out.push({ f, t: beat * BEAT, d: BEAT * 1.6, type: 'triangle', v: 0.5 }); out.push({ f: f * 2, t: beat * BEAT, d: BEAT * 0.7, type: 'sine', v: 0.14 }); }
  const [lo, hi] = CHORDS[b];
  out.push({ f: lo, t: 0, d: BAR_SECONDS * 0.98, type: 'sine', v: 0.32 }, { f: hi, t: 0, d: BAR_SECONDS * 0.98, type: 'sine', v: 0.2 });
  return out;
}

let ac: AudioContext | null = null;
let gain: GainNode | null = null;
let timer = 0;
let nextBarAt = 0;
let barIndex = 0;
let armed = false;

function ensure(): AudioContext | null {
  try {
    if (!ac) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ac = new AC();
      gain = ac.createGain();
      gain.gain.value = 0.07;
      gain.connect(ac.destination);
    }
    return ac;
  } catch { return null; }
}
function scheduleBar(a: AudioContext, at: number, i: number) {
  for (const n of bgmBar(i)) {
    const o = a.createOscillator(), g = a.createGain(), s = at + n.t;
    o.type = n.type; o.frequency.value = n.f;
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(n.v, s + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, s + n.d);
    o.connect(g).connect(gain!);
    o.start(s); o.stop(s + n.d + 0.05);
  }
}
function tick() {
  const a = ac;
  if (!a || a.state !== 'running') return;
  if (nextBarAt < a.currentTime) nextBarAt = a.currentTime + 0.1;
  while (nextBarAt < a.currentTime + 1.5) { scheduleBar(a, nextBarAt, barIndex++); nextBarAt += BAR_SECONDS; }
}
export function startBgm() {
  if (!bgmState.on) return;
  const a = ensure();
  if (!a) return;
  if (a.state === 'suspended') void a.resume();
  if (!timer) { timer = window.setInterval(tick, 400); tick(); }
}
export function stopBgm() {
  if (timer) { clearInterval(timer); timer = 0; }
  if (ac && ac.state === 'running') void ac.suspend();
}
export function setBgmOn(on: boolean) { bgmState.on = on; if (on) startBgm(); else stopBgm(); }
/** 等第一次用户操作后开始播放；页面隐藏时暂停，回来时继续 */
export function armBgm() {
  if (armed) return;
  armed = true;
  const go = () => { startBgm(); document.removeEventListener('pointerdown', go); };
  document.addEventListener('pointerdown', go);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopBgm(); else if (bgmState.on && ac) startBgm(); });
}
