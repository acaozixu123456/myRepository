// 声音：一首曲子 + 流水、鸟叫、风、篝火的环境声（按离溪远近、地形高低自动调音量）+ 马蹄声。
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
      const bufs = { river, birds, wind, fire };
      for (const n of names) {
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
    const target = { river: 0.85 * mix.river, birds: 0.5 * mix.birds, wind: 0.45 * mix.wind, fire: 0.9 * mix.fire };
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
  snort() {
    if (!this.ready || this.muted) return;
    const src = this.ctx.createBufferSource(); src.buffer = this.snorts[(Math.random() * 2) | 0];
    const g = this.ctx.createGain(); g.gain.value = 0.35; src.connect(g); g.connect(this.sfxGain); src.start();
  }
}
