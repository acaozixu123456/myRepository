// 声音：一首曲子 + 流水、鸟叫、风、篝火的环境声（按离溪远近、地形高低自动调音量）+ 马蹄声、脚步、翅膀、口哨。
// 夜里有合成的虫鸣（几只蟋蟀，各自的音高和节奏）和偶尔的猫头鹰。
// iPhone：必须在点击里创建/恢复 AudioContext；把 audioSession 设成 playback，静音键打开时也能出声。

export class Sound {
  constructor(base) {
    this.base = base; this.ready = false; this.muted = false;
    this.loops = {}; this.hoof = null; this.hoofMap = null; this.snorts = [];
  }
  // 在“出发”的点击里调用
  async start() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = 1; this.master.connect(ctx.destination);
    this.musicGain = ctx.createGain(); this.musicGain.gain.value = 0; this.musicGain.connect(this.master);
    this.ambGain = ctx.createGain(); this.ambGain.gain.value = 0.9; this.ambGain.connect(this.master);
    this.sfxGain = ctx.createGain(); this.sfxGain.gain.value = 0.9; this.sfxGain.connect(this.master);
    // 音乐：用 <audio> 播放（长曲子解码成 PCM 太占内存）
    const el = this.music = new Audio(this.base + 'audio/morning.mp3');
    el.loop = true; el.preload = 'auto'; el.crossOrigin = 'anonymous'; el.playsInline = true;
    try { ctx.createMediaElementSource(el).connect(this.musicGain); } catch { el.volume = 0.5; }
    el.play().catch(() => {});
    ctx.resume?.();
    this.musicGain.gain.setTargetAtTime(0.42, ctx.currentTime + 0.5, 2.5);
    // 环境声和蹄声
    const load = async f => ctx.decodeAudioData(await (await fetch(this.base + 'audio/' + f)).arrayBuffer());
    const names = ['river', 'birds', 'wind', 'fire'];
    try {
      const [river, birds, wind, fire, hoof, s1, s2, map] = await Promise.all([
        ...names.map(n => load(n + '.mp3')), load('hooves.mp3'), load('snort1.mp3'), load('snort2.mp3'),
        fetch(this.base + 'audio/hooves.json').then(r => r.json()),
      ]);
      const bufs = { river, birds, wind, fire, crickets: this.makeCrickets() };
      for (const n of [...names, 'crickets']) {
        const src = ctx.createBufferSource(); src.buffer = bufs[n]; src.loop = true;
        const g = ctx.createGain(); g.gain.value = 0;
        const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        src.connect(g); if (pan) { g.connect(pan); pan.connect(this.ambGain); } else g.connect(this.ambGain);
        src.start(ctx.currentTime + Math.random() * 0.2, Math.random() * bufs[n].duration * 0.5);
        this.loops[n] = { src, g, pan, v: 0 };
      }
      this.hoof = hoof; this.hoofMap = map; this.snorts = [s1, s2];
      // 木桥上的蹄声：低通 + 中频共鸣，听起来像踩在木板上
      this.woodF = ctx.createBiquadFilter(); this.woodF.type = 'peaking'; this.woodF.frequency.value = 420; this.woodF.Q.value = 1.2; this.woodF.gain.value = 9;
      this.woodL = ctx.createBiquadFilter(); this.woodL.type = 'lowpass'; this.woodL.frequency.value = 2400;
      this.woodF.connect(this.woodL); this.woodL.connect(this.sfxGain);
      this.dirtL = ctx.createBiquadFilter(); this.dirtL.type = 'lowpass'; this.dirtL.frequency.value = 3200; this.dirtL.connect(this.sfxGain);
      this.ready = true;
    } catch (e) { console.warn('[j] audio', e); }
  }
  setMuted(m) {
    this.muted = m;
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.3);
    if (m) this.music?.pause(); else this.music?.play().catch(() => {});
  }
  // mix: { river, birds, wind, fire, riverPan }（0~1）
  update(mix) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const target = { river: 0.85 * mix.river, birds: 0.5 * mix.birds, wind: 0.45 * mix.wind, fire: 0.9 * mix.fire, crickets: 0.8 * (mix.crickets || 0) };
    for (const [n, L] of Object.entries(this.loops)) {
      L.g.gain.setTargetAtTime(target[n] || 0, t, 0.6);
      if (n === 'river' && L.pan) L.pan.pan.setTargetAtTime(mix.riverPan || 0, t, 0.3);
    }
  }
  musicLevel(v) { if (this.ctx) this.musicGain.gain.setTargetAtTime(v, this.ctx.currentTime, 1.5); }
  step(kind, gait, vol = 1) {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx, list = kind === 'wood' ? this.hoofMap.hard : this.hoofMap.dirt;
    const i = list[(Math.random() * list.length) | 0];
    const src = ctx.createBufferSource(); src.buffer = this.hoof;
    src.playbackRate.value = (kind === 'wood' ? 0.78 : 0.95) + Math.random() * 0.12;
    const g = ctx.createGain(); g.gain.value = (kind === 'wood' ? 0.55 : 0.32 + 0.18 * gait) * vol;
    src.connect(g); g.connect(kind === 'wood' ? this.woodF : this.dirtL);
    src.start(ctx.currentTime, i * this.hoofMap.slot, this.hoofMap.slot * 0.95);
  }
  // ---- 合成的小声音：脚步、翅膀扇风、口哨（不用额外下载） ----
  noise() {
    if (this._noise) return this._noise;
    const ctx = this.ctx, n = ctx.sampleRate, b = ctx.createBuffer(1, n, n), d = b.getChannelData(0);
    let last = 0; for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; last = last * 0.6 + w * 0.4; d[i] = last; }
    return (this._noise = b);
  }
  // 一段噪声：经过带通滤波，音量包络 a（起）→ d（落），可以让滤波频率滑动
  burst({ f0 = 900, f1 = f0, q = 1.2, a = 0.004, d = 0.1, vol = 0.3, delay = 0 }) {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const src = ctx.createBufferSource(); src.buffer = this.noise();
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + a + d);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    src.connect(f); f.connect(g); g.connect(this.sfxGain);
    src.start(t, Math.random() * 0.8, a + d + 0.05);
  }
  // 人的脚步：土路沙沙、木桥咚咚、水里哗啦
  foot(kind, run = 0, vol = 1) {
    const j = 0.85 + Math.random() * 0.3;
    if (kind === 'wood') this.burst({ f0: 260 * j, f1: 180, q: 2.5, d: 0.09, vol: 0.32 * vol });
    else if (kind === 'water') { this.burst({ f0: 1500 * j, f1: 700, q: 0.9, a: 0.01, d: 0.22, vol: 0.22 * vol }); this.burst({ f0: 3200 * j, f1: 2000, q: 1, d: 0.12, vol: 0.08 * vol, delay: 0.03 }); }
    else this.burst({ f0: 1100 * j, f1: 600, q: 0.8, d: 0.07 + run * 0.03, vol: (0.1 + run * 0.08) * vol });
  }
  // 翅膀扇一下
  whoosh(v = 0.5) { this.burst({ f0: 260, f1: 900, q: 0.7, a: 0.08, d: 0.32, vol: 0.18 * v }); }
  // 吹口哨叫坐骑：两声
  whistle() {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx, t0 = ctx.currentTime + 0.05;
    for (const [dt, fa, fb] of [[0, 1500, 1900], [0.28, 1500, 2300]]) {
      const o = ctx.createOscillator(), g = ctx.createGain(), t = t0 + dt;
      o.type = 'sine'; o.frequency.setValueAtTime(fa, t); o.frequency.exponentialRampToValueAtTime(fb, t + 0.16);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.connect(g); g.connect(this.sfxGain); o.start(t); o.stop(t + 0.22);
    }
  }
  // 虫鸣：6 秒一段循环。每只蟋蟀一个音高，几下短促的“唧”连成一声，隔一会儿再叫
  makeCrickets() {
    const ctx = this.ctx, sr = ctx.sampleRate, D = 6, len = Math.floor(sr * D), b = ctx.createBuffer(2, len, sr);
    const L = b.getChannelData(0), R = b.getChannelData(1);
    for (let k = 0; k < 8; k++) {
      const f = 3800 + Math.random() * 1700, n = Math.max(2, Math.round(D / (0.5 + Math.random() * 0.9))), per = D / n;
      const pulses = 2 + ((Math.random() * 3) | 0), pl = 0.012 + Math.random() * 0.012, gap = 0.016 + Math.random() * 0.014;
      const vol = (k < 3 ? 0.11 : 0.045) * (0.6 + Math.random() * 0.4), pan = Math.random() * 1.6 - 0.8, off = Math.random() * per;
      for (let c = 0; c < n; c++) {
        if (Math.random() < 0.15) continue;           // 偶尔停一下
        const t0 = off + c * per + (Math.random() - 0.5) * 0.05;
        for (let p = 0; p < pulses; p++) {
          const i0 = Math.floor((t0 + p * (pl + gap)) * sr), m = Math.floor(pl * sr);
          for (let i = 0; i < m; i++) {
            const j = (i0 + i) % len, e = Math.sin(Math.PI * i / m) ** 2;
            const v = (Math.sin(2 * Math.PI * f * i / sr) + 0.25 * Math.sin(4 * Math.PI * f * i / sr)) * e * vol;
            L[j] += v * (0.6 - pan * 0.4); R[j] += v * (0.6 + pan * 0.4);
          }
        }
      }
    }
    return b;
  }
  // 远处的猫头鹰：“咕——咕咕咕”
  owl(v = 0.5, pan = 0) {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx, t0 = ctx.currentTime + 0.05;
    const out = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    if (out) { out.pan.value = pan; lp.connect(out); out.connect(this.ambGain); } else lp.connect(this.ambGain);
    for (const [dt, dur, a] of [[0, 0.5, 1], [0.82, 0.17, 0.75], [1.06, 0.17, 0.75], [1.3, 0.55, 0.9]]) {
      const t = t0 + dt, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.setValueAtTime(400, t); o.frequency.linearRampToValueAtTime(372, t + dur * 0.4); o.frequency.linearRampToValueAtTime(352, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12 * v * a, t + 0.06);
      g.gain.setValueAtTime(0.12 * v * a, t + dur * 0.55); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.12);
      o.connect(g); g.connect(lp); o.start(t); o.stop(t + dur + 0.2);
    }
  }
  snort() {
    if (!this.ready || this.muted) return;
    const src = this.ctx.createBufferSource(); src.buffer = this.snorts[(Math.random() * 2) | 0];
    const g = this.ctx.createGain(); g.gain.value = 0.35; src.connect(g); g.connect(this.sfxGain); src.start();
  }
}
