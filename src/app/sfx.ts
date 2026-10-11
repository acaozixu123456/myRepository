// 程序合成的音效（WebAudio，无音频文件）。第一次用户操作后才会真正发声。
let ac: AudioContext | null = null;
let master: GainNode | null = null;
export const sfxState = { on: true };

function ctx(): AudioContext | null {
  if (!sfxState.on) return null;
  try {
    if (!ac) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = 0.5;
      master.connect(ac.destination);
    }
    if (ac.state === 'suspended') void ac.resume();
    return ac;
  } catch {
    return null;
  }
}

interface Tone { f: number; t?: number; d: number; type?: OscillatorType; v?: number; slide?: number }
function play(tones: Tone[]) {
  const a = ctx();
  if (!a || !master) return;
  const t0 = a.currentTime;
  for (const x of tones) {
    const o = a.createOscillator();
    const g = a.createGain();
    const s = t0 + (x.t ?? 0);
    o.type = x.type ?? 'sine';
    o.frequency.setValueAtTime(x.f, s);
    if (x.slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, x.f * x.slide), s + x.d);
    const v = x.v ?? 0.25;
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(v, s + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, s + x.d);
    o.connect(g).connect(master);
    o.start(s);
    o.stop(s + x.d + 0.03);
  }
}
const N = (semi: number) => 440 * 2 ** ((semi - 9) / 12); // 0 = C4

export const sfx = {
  tap: () => play([{ f: 620, d: 0.06, type: 'triangle', v: 0.12, slide: 1.3 }]),
  ok: () => play([{ f: N(7), d: 0.09, type: 'triangle', v: 0.18 }, { f: N(12), t: 0.07, d: 0.14, type: 'triangle', v: 0.18 }]),
  no: () => play([{ f: 220, d: 0.16, type: 'square', v: 0.09, slide: 0.7 }]),
  coin: () => play([{ f: N(19), d: 0.07, type: 'square', v: 0.09 }, { f: N(24), t: 0.07, d: 0.2, type: 'square', v: 0.09 }]),
  up: () => play([0, 4, 7, 12].map((s, i) => ({ f: N(s + 7), t: i * 0.07, d: 0.18, type: 'triangle' as const, v: 0.18 }))),
  rumble: () => play([{ f: 90, d: 1.3, type: 'sawtooth', v: 0.1, slide: 1.8 }, { f: 130, d: 1.3, type: 'triangle', v: 0.08, slide: 1.5 }]),
  burst: () => play([{ f: 300, d: 0.5, type: 'sawtooth', v: 0.1, slide: 4 }, { f: N(12), d: 0.35, type: 'triangle', v: 0.2 }]),
  reveal(r: 'SR' | 'SSR' | 'UR' | 'SP') {
    const seq = r === 'SP' ? [0, 4, 7, 12, 16, 19, 24, 28, 31] : r === 'UR' ? [0, 4, 7, 12, 16, 19, 24] : r === 'SSR' ? [0, 4, 7, 12, 16] : [0, 4, 7];
    play(seq.map((s, i) => ({ f: N(s + 5), t: i * 0.09, d: r === 'UR' || r === 'SP' ? 0.5 : 0.3, type: 'triangle' as const, v: r === 'UR' || r === 'SP' ? 0.2 : 0.16 })));
  },
  win: () => play([0, 4, 7, 12].map((s, i) => ({ f: N(s), t: i * 0.1, d: 0.25, type: 'triangle' as const, v: 0.16 }))),
  story: () => play([{ f: N(14), d: 0.05, type: 'sine', v: 0.06 }]),
};
