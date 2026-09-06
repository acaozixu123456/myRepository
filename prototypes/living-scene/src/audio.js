// Adapted from Sol audio branch 873d2bdd6aef6903e4f9092e0b462090c361c98d.
const AudioCtx = globalThis.AudioContext || globalThis.webkitAudioContext;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const rand = (min, max) => min + Math.random() * (max - min);

function makeNoiseBuffer(ctx, seconds = 8) {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const out = buffer.getChannelData(0);
  let brown = 0;
  for (let i = 0; i < out.length; i++) {
    const white = Math.random() * 2 - 1;
    brown = (brown + 0.018 * white) / 1.018;
    out[i] = brown * 2.4 + white * 0.06;
  }
  return buffer;
}

function makeImpulse(ctx, seconds = 3.1, decay = 2.8) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (0.76 + Math.random() * 0.24);
    }
  }
  return impulse;
}

function setGain(param, value, when, tau = 0.22) {
  param.cancelScheduledValues(when);
  param.setTargetAtTime(value, when, tau);
}

class LivingSceneAudio {
  constructor(onState = () => {}) {
    this.onState = onState;
    this.ctx = null;
    this.enabled = false;
    this.started = false;
    this.hidden = false;
    this.focused = false;
    this.hovered = false;
    this.pointerX = 0;
    this.master = null;
    this.music = null;
    this.ambience = null;
    this.sfx = null;
    this.shop = null;
    this.reverb = null;
    this.reverbReturn = null;
    this.noiseSource = null;
    this.noiseGain = null;
    this.windLfo = null;
    this.windLfoGain = null;
    this.padOsc = [];
    this.padGain = [];
    this.chordIndex = 0;
    this.nextChordTimer = 0;
    this.nextMotifTimer = 0;
    this.nextDropTimer = 0;
    this.lastHoverCue = 0;
    this.lastFocusCue = 0;
    this.catState = "observing";
    this.catNear = false;
    this.catBus = null;
    this.purrGain = null;
    this.lastCatCue = -10000;
    this.preferred = false;
    try {
      this.preferred = localStorage.getItem("livingScene.audio") === "on";
    } catch {}
  }

  snapshot() {
    return {
      supported: !!AudioCtx,
      enabled: this.enabled,
      started: this.started,
      state: this.ctx?.state || "uninitialized",
      focused: this.focused,
      hovered: this.hovered,
      preferred: this.preferred,
      catState: this.catState,
      catNear: this.catNear,
      buses: this.ctx ? { music: this.music.gain.value, ambience: this.ambience.gain.value, cat: this.catBus.gain.value, purr: this.purrGain.gain.value } : null,
    };
  }

  _emit() {
    this.onState(this.snapshot());
  }

  async _ensure() {
    if (!AudioCtx) throw new Error("Web Audio API unavailable");
    if (this.ctx) return;
    const ctx = new AudioCtx({ latencyHint: "interactive" });
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 18;
    compressor.ratio.value = 2.2;
    compressor.attack.value = 0.025;
    compressor.release.value = 0.35;
    this.master.connect(compressor).connect(ctx.destination);
    this.output = compressor;

    this.music = ctx.createGain();
    this.ambience = ctx.createGain();
    this.sfx = ctx.createGain();
    this.shop = ctx.createGain();
    this.music.gain.value = 0.105;
    this.ambience.gain.value = 0.085;
    this.sfx.gain.value = 0.16;
    this.shop.gain.value = 0.0001;
    this.music.connect(this.master);
    this.ambience.connect(this.master);
    this.sfx.connect(this.master);
    this.shop.connect(this.master);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = makeImpulse(ctx);
    this.reverbReturn = ctx.createGain();
    this.reverbReturn.gain.value = 0.18;
    this.reverb.connect(this.reverbReturn).connect(this.master);

    // Reverb sends follow their buses so ducking reaches both dry and wet sound.
    this.music.connect(this.reverb);
    this.sfx.connect(this.reverb);
    this.catBus = ctx.createGain();
    this.catBus.gain.value = .11;
    this.catBus.connect(this.master);
    this._makeCatLayer();
    this._makeAmbience();
    this._makePad();
  }

  _makeAmbience() {
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = makeNoiseBuffer(ctx, 9);
    source.loop = true;
    const high = ctx.createBiquadFilter();
    high.type = "highpass";
    high.frequency.value = 120;
    const low = ctx.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = 1850;
    low.Q.value = 0.55;
    const gain = ctx.createGain();
    gain.gain.value = 0.24;
    source.connect(high).connect(low).connect(gain).connect(this.ambience);
    source.start();
    this.noiseSource = source;
    this.noiseGain = gain;

    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.071;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.055;
    lfo.connect(lfoGain).connect(gain.gain);
    lfo.start();
    this.windLfo = lfo;
    this.windLfoGain = lfoGain;

    const shopHum = ctx.createOscillator();
    const shopFifth = ctx.createOscillator();
    shopHum.type = "sine";
    shopFifth.type = "triangle";
    shopHum.frequency.value = 110;
    shopFifth.frequency.value = 164.81;
    const shopFilter = ctx.createBiquadFilter();
    shopFilter.type = "lowpass";
    shopFilter.frequency.value = 580;
    shopFilter.Q.value = 0.7;
    const shopTone = ctx.createGain();
    shopTone.gain.value = 0.018;
    shopHum.connect(shopFilter);
    shopFifth.connect(shopFilter);
    shopFilter.connect(shopTone).connect(this.shop);
    shopHum.start();
    shopFifth.start();
  }

  _makePad() {
    const ctx = this.ctx;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1150;
    filter.Q.value = 0.6;
    filter.connect(this.music);

    for (let i = 0; i < 4; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i % 2 ? "triangle" : "sine";
      osc.detune.value = i % 2 ? -4 : 3;
      gain.gain.value = 0.0001;
      osc.connect(gain).connect(filter);
      osc.start();
      this.padOsc.push(osc);
      this.padGain.push(gain);
    }
    this._setChord(0, true);
  }

  _setChord(index, immediate = false) {
    if (!this.ctx) return;
    const chords = [
      [146.83, 220.0, 293.66, 329.63],
      [123.47, 146.83, 220.0, 293.66],
      [98.0, 146.83, 164.81, 246.94],
      [110.0, 164.81, 220.0, 329.63],
    ];
    const now = this.ctx.currentTime;
    this.chordIndex = index % chords.length;
    chords[this.chordIndex].forEach((freq, i) => {
      const f = this.padOsc[i].frequency;
      f.cancelScheduledValues(now);
      immediate ? f.setValueAtTime(freq, now) : f.setTargetAtTime(freq, now, 2.8);
      const g = this.padGain[i].gain;
      g.cancelScheduledValues(now);
      g.setTargetAtTime(0.014 - i * 0.0017, now, immediate ? 0.2 : 1.2);
    });
  }

  _bell(freq, delay = 0, gainValue = 0.035, pan = 0) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const at = ctx.currentTime + delay;
    const carrier = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const modGain = ctx.createGain();
    const env = ctx.createGain();
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    carrier.type = "sine";
    mod.type = "sine";
    carrier.frequency.setValueAtTime(freq, at);
    mod.frequency.setValueAtTime(freq * 2.01, at);
    modGain.gain.setValueAtTime(freq * 0.45, at);
    modGain.gain.exponentialRampToValueAtTime(0.001, at + 1.7);
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(gainValue, at + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, at + 2.8);
    mod.connect(modGain).connect(carrier.frequency);
    carrier.connect(env);
    if (panner) {
      panner.pan.value = clamp(pan, -0.9, 0.9);
      env.connect(panner).connect(this.music);

    } else {
      env.connect(this.music);

    }
    carrier.start(at);
    mod.start(at);
    carrier.stop(at + 3.0);
    mod.stop(at + 3.0);
  }

  _drop(delay = 0, pan = 0) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const at = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    osc.type = "sine";
    osc.frequency.setValueAtTime(rand(960, 1450), at);
    osc.frequency.exponentialRampToValueAtTime(rand(430, 620), at + 0.17);
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(rand(0.018, 0.035), at + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, at + 0.28);
    osc.connect(env);
    if (panner) {
      panner.pan.value = pan;
      env.connect(panner).connect(this.sfx);

    } else {
      env.connect(this.sfx);

    }
    osc.start(at);
    osc.stop(at + 0.32);
  }

  _motif() {
    const notes = [293.66, 329.63, 440.0, 493.88, 587.33, 659.25];
    const root = Math.floor(rand(0, notes.length - 3));
    const count = Math.random() > 0.65 ? 3 : 2;
    for (let i = 0; i < count; i++) {
      const freq = notes[root + i];
      this._bell(freq, i * rand(0.48, 0.82), 0.026 - i * 0.004, rand(-0.45, 0.45));
    }
  }

  _schedule() {
    clearTimeout(this.nextChordTimer);
    clearTimeout(this.nextMotifTimer);
    clearTimeout(this.nextDropTimer);
    const chordLoop = () => {
      if (!this.enabled) return;
      this._setChord(this.chordIndex + 1);
      this.nextChordTimer = setTimeout(chordLoop, rand(9500, 13500));
    };
    const motifLoop = () => {
      if (!this.enabled) return;
      if (!this.focused || Math.random() > 0.45) this._motif();
      this.nextMotifTimer = setTimeout(motifLoop, rand(11000, 18000));
    };
    const dropLoop = () => {
      if (!this.enabled) return;
      const count = Math.random() > 0.72 ? 2 : 1;
      for (let i = 0; i < count; i++) this._drop(i * rand(0.08, 0.22), rand(-0.82, 0.82));
      this.nextDropTimer = setTimeout(dropLoop, rand(2300, 6200));
    };
    this.nextChordTimer = setTimeout(chordLoop, rand(9000, 12000));
    this.nextMotifTimer = setTimeout(motifLoop, rand(8000, 13000));
    this.nextDropTimer = setTimeout(dropLoop, rand(1200, 3600));
  }

  async enable() {
    try {
      await this._ensure();
      if (this.ctx.state === "suspended") await this.ctx.resume();
      this.enabled = true;
      this.started = true;
      this.preferred = true;
      try { localStorage.setItem("livingScene.audio", "on"); } catch {}
      const now = this.ctx.currentTime;
      setGain(this.master.gain, 0.72, now, 0.35);
      this.setCatState(this.catState, this.catNear);
      this._applySceneState();
      this._schedule();
      this._bell(440, 0.02, 0.025, -0.15);
      this._bell(587.33, 0.17, 0.018, 0.12);
      this._emit();
      return true;
    } catch (error) {
      console.warn("Living Scene audio unavailable", error);
      this.enabled = false;
      this._emit();
      return false;
    }
  }

  disable() {
    if (!this.ctx) return;
    this.enabled = false;
    this.preferred = false;
    try { localStorage.setItem("livingScene.audio", "off"); } catch {}
    clearTimeout(this.nextChordTimer);
    clearTimeout(this.nextMotifTimer);
    clearTimeout(this.nextDropTimer);
    setGain(this.master.gain, 0.0001, this.ctx.currentTime, 0.16);
    this._emit();
  }

  async toggle() {
    if (this.enabled) {
      this.disable();
      return false;
    }
    return this.enable();
  }

  setHidden(hidden) {
    this.hidden = hidden;
    if (!this.ctx || !this.started) return;
    if (hidden) {
      clearTimeout(this.nextChordTimer);clearTimeout(this.nextMotifTimer);clearTimeout(this.nextDropTimer);
      this.ctx.suspend().catch(() => {});
    } else if (this.enabled) {
      this.ctx.resume().then(() => this._schedule()).catch(() => {});
    }
  }

  setPointer(x) {
    this.pointerX = clamp(x, -1, 1);
  }

  setHover(value, place = "shop") {
    this.hoverPlace = place;
    if (this.hovered === value) return;
    this.hovered = value;
    this._applySceneState();

  }

  setFocus(value, place = "shop") {
    this.focusPlace = place;
    if (this.focused === value) return;
    this.focused = value;
    this._applySceneState();
    if (this.enabled && performance.now() - this.lastFocusCue > 700) {
      this.lastFocusCue = performance.now();
      if (value) {
        this._bell(329.63, 0, 0.028, 0.12);
        this._bell(440, 0.16, 0.022, 0.05);
      } else {
        this._bell(293.66, 0, 0.017, -0.08);
      }
    }
  }

  _makeCatLayer() {
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = makeNoiseBuffer(ctx, 6); source.loop = true;
    const low = ctx.createBiquadFilter(); low.type = "lowpass"; low.frequency.value = 420;
    const high = ctx.createBiquadFilter(); high.type = "highpass"; high.frequency.value = 70;
    const pulse = ctx.createGain(); pulse.gain.value = .5;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 25;
    const mod = ctx.createGain(); mod.gain.value = .38;
    lfo.connect(mod).connect(pulse.gain);
    this.purrGain = ctx.createGain(); this.purrGain.gain.value = 0;
    source.connect(high).connect(low).connect(pulse).connect(this.purrGain).connect(this.catBus);
    source.start(); lfo.start();
  }

  setCatState(state, near = false) {
    const changed = this.catState !== state;
    this.catState = state; this.catNear = near;
    if (this.ctx) {
      setGain(this.purrGain.gain, state === "purring" ? .30 : 0, this.ctx.currentTime, .18);
      this._applySceneState();
    }
    if (changed && ["attentive", "watching"].includes(state)) this.catCue();
  }

  catCue() {
    if (!this.ctx || !this.enabled || performance.now() - this.lastCatCue < 4000) return;
    this.lastCatCue = performance.now();
    const at = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource(); noise.buffer = makeNoiseBuffer(this.ctx, .2);
    const filter = this.ctx.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 650;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0, at); env.gain.linearRampToValueAtTime(.05, at + .025);
    env.gain.exponentialRampToValueAtTime(.0001, at + .18);
    noise.connect(filter).connect(env).connect(this.catBus); noise.start(); noise.stop(at + .2);
  }

  _applySceneState() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const warmFocus = this.focused && ["shop", "lantern"].includes(this.focusPlace);
    const warmHover = this.hovered && ["shop", "lantern"].includes(this.hoverPlace);
    const shop = warmFocus ? 0.19 : warmHover ? 0.085 : 0.0001;
    const music = this.catState === "purring" ? .048 : this.catState === "sleeping" ? .075 : this.focused ? .074 : .105;
    const ambience = this.catNear ? .062 : this.focused ? .062 : .085;
    setGain(this.shop.gain, shop, now, 0.28);
    setGain(this.music.gain, music, now, 0.45);
    setGain(this.ambience.gain, ambience, now, 0.4);
  }
}

export function createLivingSceneAudio(onState) {
  return new LivingSceneAudio(onState);
}
