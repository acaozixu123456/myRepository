// 声音：分区的曲子（两个播放器交叉过渡）+ 流水、叠水、鸟叫、风、红叶沙沙、篝火的环境声（按位置调音量和左右）
// + 马蹄声、脚步（土、木、水、雪、冰）、翅膀、口哨。夜里有合成的虫鸣和偶尔的猫头鹰；冰湖上偶尔有冰鸣和闷响。
// iPhone：必须在点击里创建/恢复 AudioContext，两个播放器也要在点击里各播一下才能以后自动换曲；
// 把 audioSession 设成 playback，静音键打开时也能出声。

// 曲子都是 Kevin MacLeod (incompetech.com)，CC BY 4.0；响度都调成和 Morning 一样（约 -18.5 LUFS）
const MUSIC = {
  valley: ['morning.mp3'],          // 谷地白天
  dusk: ['evening.m4a'],            // 谷地黄昏
  autumn: ['windswept.m4a'],        // 红叶谷
  snow: ['frozen-star.m4a'],        // 雪原山口、冰湖
  night: ['starry.m4a'],            // 夜里
  sky: ['skye-cuillin.m4a'],        // 飞得很高
  camp: ['midnight-tale.m4a'],      // 营地烤火
  coast: ['almost-bliss.m4a'],      // 西湾沙滩、海角
  bamboo: ['ascending-vale.m4a'],   // 竹林山坳
  rain: ['dreamer.m4a'],            // 下雨天
};
const FADE = 4;                     // 换曲时交叉过渡几秒

// 一小段静音：给第二个播放器在点击里先播一下
function silentWav() {
  const n = 800, b = new ArrayBuffer(44 + n * 2), v = new DataView(b);
  const w = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 16000, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  return URL.createObjectURL(new Blob([b], { type: 'audio/wav' }));
}

export class Sound {
  constructor(base) {
    this.base = base; this.ready = false; this.muted = false;
    this.loops = {}; this.hoof = null; this.hoofMap = null; this.snorts = [];
    this.decks = null; this.cur = 1; this.mood = null; this.want = null; this.wantT = 0; this.restUntil = 0; this.trackI = 0; this.pos = {}; this.hidden = false;
  }
  // 在“出发”的点击里调用；mood 是一开始该放哪种曲子
  async start(mood = 'valley') {
    if (this.ctx) { this.ctx.resume?.(); return; }
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = 1; this.master.connect(ctx.destination);
    this.musicGain = ctx.createGain(); this.musicGain.gain.value = 0; this.musicGain.connect(this.master);
    this.ambGain = ctx.createGain(); this.ambGain.gain.value = 0.9; this.ambGain.connect(this.master);
    this.sfxGain = ctx.createGain(); this.sfxGain.gain.value = 0.9; this.sfxGain.connect(this.master);
    // 音乐：两个 <audio> 播放器轮流用（长曲子解码成 PCM 太占内存），各接一个音量做交叉过渡
    this.decks = [0, 1].map(() => {
      const el = new Audio(); el.preload = 'auto'; el.crossOrigin = 'anonymous'; el.playsInline = true;
      const g = ctx.createGain(); g.gain.value = 0; g.connect(this.musicGain);
      let routed = true;
      try { ctx.createMediaElementSource(el).connect(g); } catch { routed = false; el.volume = 0.5; }
      const d = { el, g, routed, file: null, stopT: 0 };
      el.addEventListener('ended', () => this.ended(d));
      return d;
    });
    // 第二个播放器先放一小段静音，iPhone 以后才允许不经点击换曲
    const other = this.decks[1].el;
    other.src = silentWav(); other.play().then(() => other.pause()).catch(() => {});
    this.playMood(MUSIC[mood] ? mood : 'valley');
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
      // 名字：[声音, 播放速度, 低通频率]。叠水的轰响 = 流水放慢、去掉尖的
      const leavesB = this.makeLeaves();
      const defs = { river: [river], birds: [birds], wind: [wind], fire: [fire], crickets: [this.makeCrickets()],
        falls: [river, 0.6, 1300], leaves: [leavesB], bamboo: [leavesB, 1.3, 5200], surf: [this.makeSurf()], rain: [this.makeRain()] };
      for (const [n, [buf, rate = 1, lp = 0]] of Object.entries(defs)) {
        const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.playbackRate.value = rate;
        const g = ctx.createGain(); g.gain.value = 0;
        let head = src;
        if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; src.connect(f); head = f; }
        head.connect(g);
        const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        if (pan) { g.connect(pan); pan.connect(this.ambGain); } else g.connect(this.ambGain);
        src.start(ctx.currentTime + Math.random() * 0.2, Math.random() * buf.duration * 0.5);
        this.loops[n] = { src, g, pan };
      }
      this.hoof = hoof; this.hoofMap = map; this.snorts = [s1, s2];
      // 木桥上的蹄声：低通 + 中频共鸣，听起来像踩在木板上
      this.woodF = ctx.createBiquadFilter(); this.woodF.type = 'peaking'; this.woodF.frequency.value = 420; this.woodF.Q.value = 1.2; this.woodF.gain.value = 9;
      this.woodL = ctx.createBiquadFilter(); this.woodL.type = 'lowpass'; this.woodL.frequency.value = 2400;
      this.woodF.connect(this.woodL); this.woodL.connect(this.sfxGain);
      this.dirtL = ctx.createBiquadFilter(); this.dirtL.type = 'lowpass'; this.dirtL.frequency.value = 3200; this.dirtL.connect(this.sfxGain);
      // 雪里的蹄声闷闷的；冰上的清脆
      this.snowL = ctx.createBiquadFilter(); this.snowL.type = 'lowpass'; this.snowL.frequency.value = 900; this.snowL.connect(this.sfxGain);
      this.iceF = ctx.createBiquadFilter(); this.iceF.type = 'peaking'; this.iceF.frequency.value = 2600; this.iceF.Q.value = 1.5; this.iceF.gain.value = 6;
      const iceH = ctx.createBiquadFilter(); iceH.type = 'highpass'; iceH.frequency.value = 600; this.iceF.connect(iceH); iceH.connect(this.sfxGain);
      this.ready = true;
    } catch (e) { console.warn('[j] audio', e); }
  }
  setMuted(m) {
    this.muted = m;
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.3);
    if (m) for (const d of this.decks) d.el.pause(); else this.resumeMusic();
  }
  // 切到后台 / 回来
  pauseMusic() { this.hidden = true; for (const d of this.decks || []) d.el.pause(); }
  resumeMusic() {
    this.hidden = false;
    if (this.muted || !this.decks) return;
    const d = this.decks[this.cur];
    if (d.file && !this.restUntil && !d.el.ended) d.el.play().catch(() => {});
  }
  // mix: { river, birds, wind, fire, crickets, falls, leaves, riverPan, fallsPan }（0~1）
  update(mix) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const target = { river: 0.85 * mix.river, birds: 0.5 * mix.birds, wind: 0.45 * mix.wind, fire: 0.9 * mix.fire, crickets: 0.8 * (mix.crickets || 0),
      falls: 1.1 * (mix.falls || 0), leaves: 0.6 * (mix.leaves || 0), bamboo: 0.55 * (mix.bamboo || 0), surf: 0.9 * (mix.surf || 0), rain: 0.75 * (mix.rain || 0) };
    for (const [n, L] of Object.entries(this.loops)) {
      L.g.gain.setTargetAtTime(target[n] || 0, t, n === 'wind' ? 1.1 : 0.6);
      const p = n === 'river' ? mix.riverPan : n === 'falls' ? mix.fallsPan : n === 'surf' ? mix.surfPan : null;
      if (L.pan && p != null) L.pan.pan.setTargetAtTime(p, t, 0.3);
    }
  }

  // ---- 换曲 ----
  // 游戏每 0.2 秒告诉一次想听哪种；同一种持续几秒才换（坐下烤火很快就换），免得在边界上来回切
  wantMood(m, dt) {
    if (!this.decks) return;
    if (m !== this.want) { this.want = m; this.wantT = 0; } else this.wantT += dt;
    if (m !== this.mood && MUSIC[m] && this.wantT >= (m === 'camp' ? 1.5 : 6)) this.playMood(m);
    else if (this.restUntil && this.ctx.currentTime > this.restUntil) this.playMood(this.mood, true);
  }
  playMood(m, again = false) {
    const list = MUSIC[m];
    this.trackI = again ? (this.trackI + 1) % list.length : 0;
    this.mood = m; this.restUntil = 0;
    const file = list[this.trackI], t = this.ctx.currentTime;
    const old = this.decks[this.cur], d = this.decks[1 - this.cur];
    this.cur = 1 - this.cur;
    // 旧的慢慢淡出再停下，记住放到哪了（回到这里接着放）
    if (old.file && !old.el.paused && !old.el.ended) this.pos[old.file] = old.el.currentTime;
    old.g.gain.cancelScheduledValues(t); old.g.gain.setValueAtTime(old.g.gain.value, t); old.g.gain.linearRampToValueAtTime(0, t + FADE);
    clearTimeout(old.stopT);
    if (old.routed) old.stopT = setTimeout(() => { if (this.decks[this.cur] !== old) old.el.pause(); }, FADE * 1000 + 300);
    else old.el.pause();
    // 新的淡入
    clearTimeout(d.stopT);
    if (d.file !== file) { d.file = file; d.el.src = this.base + 'audio/' + file; }
    const at = this.pos[file] || 0;
    const seek = () => { try { d.el.currentTime = at > 0 && at < (d.el.duration || 0) - 25 ? at : 0; } catch {} };
    if (d.el.readyState >= 1) seek(); else d.el.addEventListener('loadedmetadata', seek, { once: true });
    d.g.gain.cancelScheduledValues(t); d.g.gain.setValueAtTime(d.g.gain.value, t); d.g.gain.linearRampToValueAtTime(1, t + FADE);
    if (!this.muted && !this.hidden) d.el.play().catch(() => {});
  }
  // 一首放完：先安静一会儿，只听风声水声，再接着放
  ended(d) {
    if (this.decks[this.cur] !== d) return;
    this.pos[d.file] = 0;
    this.restUntil = this.ctx.currentTime + 25 + Math.random() * 35;
  }
  musicLevel(v) { if (this.ctx) this.musicGain.gain.setTargetAtTime(v, this.ctx.currentTime, 1.5); }
  step(kind, gait, vol = 1) {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx, hard = kind === 'wood' || kind === 'ice', list = hard ? this.hoofMap.hard : this.hoofMap.dirt;
    const i = list[(Math.random() * list.length) | 0];
    const src = ctx.createBufferSource(); src.buffer = this.hoof;
    src.playbackRate.value = (kind === 'wood' ? 0.78 : kind === 'ice' ? 1.08 : 0.95) + Math.random() * 0.12;
    const g = ctx.createGain();
    g.gain.value = (kind === 'wood' ? 0.55 : kind === 'ice' ? 0.42 : kind === 'snow' ? 0.2 + 0.1 * gait : 0.32 + 0.18 * gait) * vol;
    src.connect(g); g.connect(kind === 'wood' ? this.woodF : kind === 'ice' ? this.iceF : kind === 'snow' ? this.snowL : this.dirtL);
    src.start(ctx.currentTime, i * this.hoofMap.slot, this.hoofMap.slot * 0.95);
    if (kind === 'snow') this.foot('snow', gait * 0.5, 0.9 * vol);
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
  // 人的脚步：土路沙沙、木桥咚咚、水里哗啦、雪里咯吱、冰上清脆
  foot(kind, run = 0, vol = 1) {
    const j = 0.85 + Math.random() * 0.3;
    if (kind === 'wood') this.burst({ f0: 260 * j, f1: 180, q: 2.5, d: 0.09, vol: 0.32 * vol });
    else if (kind === 'water') { this.burst({ f0: 1500 * j, f1: 700, q: 0.9, a: 0.01, d: 0.22, vol: 0.22 * vol }); this.burst({ f0: 3200 * j, f1: 2000, q: 1, d: 0.12, vol: 0.08 * vol, delay: 0.03 }); }
    else if (kind === 'snow') {
      for (let k = 0; k < 4; k++) this.burst({ f0: (1700 + Math.random() * 1400) * j, f1: 1200, q: 1.6, a: 0.002, d: 0.018 + Math.random() * 0.02, vol: (0.11 + run * 0.05) * vol, delay: k * 0.016 + Math.random() * 0.012 });
      this.burst({ f0: 320 * j, f1: 160, q: 1, d: 0.06, vol: 0.1 * vol });
    } else if (kind === 'ice') {
      this.burst({ f0: 3600 * j, f1: 2600, q: 3, a: 0.001, d: 0.025, vol: (0.18 + run * 0.06) * vol });
      this.burst({ f0: 1500 * j, f1: 1400, q: 14, a: 0.002, d: 0.12, vol: 0.08 * vol, delay: 0.004 });
    } else this.burst({ f0: 1100 * j, f1: 600, q: 0.8, d: 0.07 + run * 0.03, vol: (0.1 + run * 0.08) * vol });
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
  // 红叶沙沙：8 秒一段循环。很多下极短的细碎噪声（树叶互相蹭），疏密跟着一阵一阵的风走，底下垫一层很轻的沙沙声
  makeLeaves() {
    const ctx = this.ctx, sr = ctx.sampleRate, D = 8, len = Math.floor(sr * D), b = ctx.createBuffer(2, len, sr);
    const L = b.getChannelData(0), R = b.getChannelData(1);
    // 风的起伏：周期能整除 8 秒，循环接得上
    const gust = t => Math.max(0, 0.5 + 0.35 * Math.sin(2 * Math.PI * t / D + 0.7) + 0.2 * Math.sin(6 * Math.PI * t / D + 2.1));
    let pl = 0, pr = 0;
    for (let i = 0; i < len; i++) {
      const g = 0.006 + 0.012 * gust(i / sr), wl = Math.random() * 2 - 1, wr = Math.random() * 2 - 1;
      L[i] = (wl - pl) * g; R[i] = (wr - pr) * g; pl = wl; pr = wr;     // 前后相减 = 只留高频
    }
    for (let k = 0; k < 1400; k++) {
      const t0 = Math.random() * D;
      if (Math.random() > gust(t0)) continue;
      const m = Math.floor((0.008 + Math.random() * 0.045) * sr), i0 = Math.floor(t0 * sr);
      const vol = 0.05 * (0.3 + Math.random()), pan = Math.random() * 1.6 - 0.8, att = sr * 0.002;
      let prev = 0;
      for (let i = 0; i < m; i++) {
        const j = (i0 + i) % len, w = Math.random() * 2 - 1, v = (w - prev) * Math.exp(-i / (m * 0.3)) * Math.min(1, i / att) * vol;
        prev = w; L[j] += v * (0.6 - pan * 0.4); R[j] += v * (0.6 + pan * 0.4);
      }
    }
    return b;
  }
  // 海浪：12 秒一段循环，两层浪：低沉的涌起来、哗地拍上沙滩，再沙沙地退回去（碎石子、泡沫的细响）
  makeSurf() {
    const ctx = this.ctx, sr = ctx.sampleRate, D = 12, len = Math.floor(sr * D), b = ctx.createBuffer(2, len, sr);
    const L = b.getChannelData(0), R = b.getChannelData(1);
    // 每道浪的包络：慢慢涌起，到顶拍下，拖一条长长的尾巴
    const wave = (t, t0, dur) => { let u = (t - t0) / dur; u -= Math.floor(u); return u < 0.42 ? Math.pow(u / 0.42, 2.2) : Math.exp(-(u - 0.42) * 5.5); };
    let lo1 = 0, lo2 = 0, hiP = 0, lo3 = 0, lo4 = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const e1 = wave(t, 0, 6), e2 = wave(t, 3.3, 6);
      const w = Math.random() * 2 - 1, w2 = Math.random() * 2 - 1;
      lo1 += (w - lo1) * 0.035; lo2 += (lo1 - lo2) * 0.08;      // 低沉的轰
      lo3 += (w2 - lo3) * 0.25; lo4 += (w2 - lo4) * 0.5;
      const hiss = lo4 - lo3; hiP = w;                         // 沙沙（中高频）
      const body = lo2 * 3.2, crash = lo3 * 1.1;
      const vL = body * (0.35 + 0.65 * e1) * 0.6 + crash * e1 * 0.32 + hiss * Math.pow(e1, 0.6) * 0.18;
      const vR = body * (0.35 + 0.65 * e2) * 0.6 + crash * e2 * 0.32 + hiss * Math.pow(e2, 0.6) * 0.18;
      L[i] = vL * 0.75 + vR * 0.25; R[i] = vR * 0.75 + vL * 0.25;
    }
    // 循环接口处抹平
    const fade = Math.floor(sr * 0.05);
    for (let i = 0; i < fade; i++) { const k = i / fade; L[i] = L[i] * k + L[len - fade + i] * (1 - k); R[i] = R[i] * k + R[len - fade + i] * (1 - k); }
    return b;
  }
  // 雨：一层软软的沙沙（粉红噪声），上面撒满了细小的滴答（落在叶子、地上）
  makeRain() {
    const ctx = this.ctx, sr = ctx.sampleRate, D = 6, len = Math.floor(sr * D), b = ctx.createBuffer(2, len, sr);
    const L = b.getChannelData(0), R = b.getChannelData(1);
    let b0 = 0, b1 = 0, b2 = 0, c0 = 0, c1 = 0, c2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1, v = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0527;
      c0 = 0.99765 * c0 + v * 0.099; c1 = 0.963 * c1 + v * 0.2965; c2 = 0.57 * c2 + v * 1.0527;
      L[i] = (b0 + b1 + b2 + w * 0.1848) * 0.035; R[i] = (c0 + c1 + c2 + v * 0.1848) * 0.035;
    }
    for (let k = 0; k < 2600; k++) {
      const i0 = Math.floor(Math.random() * len), m = Math.floor((0.002 + Math.random() * 0.006) * sr);
      const f = 1800 + Math.random() * 4500, vol = 0.03 * Math.pow(Math.random(), 2), pan = Math.random() * 1.6 - 0.8;
      for (let i = 0; i < m; i++) {
        const j = (i0 + i) % len, v = Math.sin(2 * Math.PI * f * i / sr) * Math.exp(-i / (m * 0.25)) * vol;
        L[j] += v * (0.6 - pan * 0.4); R[j] += v * (0.6 + pan * 0.4);
      }
    }
    return b;
  }
  // 竹子被风吹得互相碰一下：空空的“笃、笃”两三声
  knock(v = 0.5, pan = 0) {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx, t0 = ctx.currentTime + 0.02, n = 1 + ((Math.random() * 3) | 0), f = 380 + Math.random() * 360;
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null, out = ctx.createGain(); out.gain.value = 1;
    if (p) { p.pan.value = pan; out.connect(p); p.connect(this.ambGain); } else out.connect(this.ambGain);
    for (let k = 0; k < n; k++) {
      const t = t0 + k * (0.13 + Math.random() * 0.12), ff = f * (1 + (Math.random() - 0.5) * 0.15);
      const o = ctx.createOscillator(), g = ctx.createGain(), o2 = ctx.createOscillator(), g2 = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(ff * 1.12, t); o.frequency.exponentialRampToValueAtTime(ff, t + 0.03);
      o2.type = 'sine'; o2.frequency.value = ff * 2.7;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16 * v, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      g2.gain.setValueAtTime(0.0001, t); g2.gain.exponentialRampToValueAtTime(0.05 * v, t + 0.002); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      o.connect(g); g.connect(out); o2.connect(g2); g2.connect(out);
      o.start(t); o.stop(t + 0.2); o2.start(t); o2.stop(t + 0.08);
    }
  }
  // 远处一声闷闷的雷（下大雨时偶尔）
  thunder(v = 0.5, pan = 0) {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime + 0.05, dur = 3 + Math.random() * 2.5;
    const src = ctx.createBufferSource(); src.buffer = this.noise(); src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(380, t); lp.frequency.exponentialRampToValueAtTime(60, t + dur);
    const g = ctx.createGain(), p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5 * v, t + 0.35); g.gain.setValueAtTime(0.5 * v, t + 0.8);
    g.gain.exponentialRampToValueAtTime(0.25 * v, t + 1.4); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(lp); lp.connect(g);
    if (p) { p.pan.value = pan; g.connect(p); p.connect(this.ambGain); } else g.connect(this.ambGain);
    src.start(t); src.stop(t + dur + 0.1);
  }
  // 冰鸣：冰面受力时“啾——”一声从高往低滑下去（像激光枪），在冰上来回传几下，回声一次比一次闷
  iceSing(v = 0.5, pan = 0) {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime + 0.03;
    const out = ctx.createGain(), p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (p) { p.pan.value = pan; out.connect(p); p.connect(this.ambGain); } else out.connect(this.ambGain);
    const dl = ctx.createDelay(1), fb = ctx.createGain(), lp = ctx.createBiquadFilter();
    dl.delayTime.value = 0.09 + Math.random() * 0.08; fb.gain.value = 0.42; lp.type = 'lowpass'; lp.frequency.value = 2500;
    dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(out);
    const n = 1 + ((Math.random() * 3) | 0);
    for (let k = 0; k < n; k++) {
      const t0 = t + k * (0.25 + Math.random() * 0.5), dur = 0.18 + Math.random() * 0.25, a = 0.13 * v * (k ? 0.6 : 1);
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(2200 + Math.random() * 2600, t0); o.frequency.exponentialRampToValueAtTime(140 + Math.random() * 120, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(a, t0 + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(out); g.connect(dl); o.start(t0); o.stop(t0 + dur + 0.05);
    }
    setTimeout(() => { try { fb.disconnect(); out.disconnect(); } catch {} }, 4000);
  }
  // 冰面深处偶尔“咚——”一声闷响
  iceBoom(v = 0.5, pan = 0) {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime + 0.03;
    const src = ctx.createBufferSource(); src.buffer = this.noise(); src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(260, t); lp.frequency.exponentialRampToValueAtTime(70, t + 1.4);
    const g = ctx.createGain(), p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.65 * v, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    src.connect(lp); lp.connect(g);
    if (p) { p.pan.value = pan; g.connect(p); p.connect(this.ambGain); } else g.connect(this.ambGain);
    src.start(t); src.stop(t + 1.7);
  }
  // 风车的木头吱呀一声：很低的锯齿波（一下下打滑）经过木头的共鸣，音高先上去再下来
  creak(v = 0.5, pan = 0) {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime + 0.02, dur = 0.5 + Math.random() * 0.5, f = 38 + Math.random() * 20;
    const o = ctx.createOscillator(), bp = ctx.createBiquadFilter(), bp2 = ctx.createBiquadFilter(), g = ctx.createGain();
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * 1.6, t + dur * 0.45); o.frequency.linearRampToValueAtTime(f * 0.9, t + dur);
    bp.type = 'bandpass'; bp.frequency.value = 750 + Math.random() * 400; bp.Q.value = 5;
    bp2.type = 'bandpass'; bp2.frequency.value = 1700 + Math.random() * 500; bp2.Q.value = 7;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.24 * v, t + 0.08);
    g.gain.setValueAtTime(0.24 * v, t + dur - 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(bp); o.connect(bp2); bp.connect(g); bp2.connect(g);
    if (p) { p.pan.value = pan; g.connect(p); p.connect(this.ambGain); } else g.connect(this.ambGain);
    o.start(t); o.stop(t + dur + 0.05);
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
  // 发现新东西：一串轻轻的风铃（五声音阶里随便挑三四个音）
  chime(v = 0.5) {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx, t0 = ctx.currentTime + 0.05, notes = [1046.5, 1174.7, 1318.5, 1568, 1760, 2093];
    const n = 3 + (Math.random() < 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const t = t0 + i * (0.13 + Math.random() * 0.08), f = notes[(Math.random() * notes.length) | 0];
      for (const [mul, a] of [[1, 1], [2.76, 0.25]]) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = f * mul;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.07 * v * a, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6 / mul);
        o.connect(g); g.connect(this.sfxGain); o.start(t); o.stop(t + 1.7);
      }
    }
  }
  // 一群鸟扑棱棱飞起来：很多下短短的翅膀声
  flutter(v = 0.5) {
    if (!this.ready || this.muted) return;
    for (let i = 0; i < 14; i++) this.burst({ f0: 1400 + Math.random() * 1200, f1: 700, q: 0.9, a: 0.004, d: 0.05 + Math.random() * 0.04, vol: 0.12 * v * (1 - i / 18), delay: i * 0.035 + Math.random() * 0.05 });
  }
  snort() {
    if (!this.ready || this.muted) return;
    const src = this.ctx.createBufferSource(); src.buffer = this.snorts[(Math.random() * 2) | 0];
    const g = this.ctx.createGain(); g.gain.value = 0.35; src.connect(g); g.connect(this.sfxGain); src.start();
  }
}
