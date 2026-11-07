/* 万世洞天 · 声音
 * 不用任何音频文件，全部用 Web Audio 现场合成。
 * 背景音乐：五声音阶上的古筝小调（拨弦、按音、摇指、刮奏），配低音、长音和混响。
 *   每个乐句先“问”后“答”：同一个小动机弹两遍，第一遍停在不稳的音上，第二遍落回主音。
 *   蚂蚁、狐狸（白天和夜里）、凡人、轮回之间各有各的调式和速度。
 * 打仗的时候换成战鼓配古筝。
 * 音效：木鱼、拨弦、铃、锣、鼓。浏览器要求先点一下页面才能出声，所以第一次点按时才真正启动。
 */
(function (root) {
  'use strict';
  const WS = root.WS = root.WS || {};

  // 五声调式（相对主音的半音数）
  const MODES = {
    gong: [0, 2, 4, 7, 9],    // 宫调，明亮
    shang: [0, 2, 5, 7, 10],  // 商调，空旷
    zhi: [0, 2, 5, 7, 9],     // 徵调，温和
    yu: [0, 3, 5, 7, 10],     // 羽调，幽静
    jue: [0, 3, 5, 8, 10],    // 角调，清冷
  };
  // 每种心境：调式、主音（MIDI 音高）、速度、弹奏的疏密、混响多少、摇指的机会、音量补偿（弹得稀的响一点）
  const MOODS = {
    between: { mode: 'shang', root: 52, bpm: 52, density: 0.3, wet: 0.6, bells: true, trem: 0.4, vol: 1.4 },
    ant: { mode: 'gong', root: 62, bpm: 92, density: 0.62, wet: 0.3, trem: 0.1, vol: 1 },
    fox: { mode: 'yu', root: 57, bpm: 70, density: 0.5, wet: 0.45, trem: 0.2, vol: 1.1 },
    'fox-night': { mode: 'yu', root: 57, bpm: 60, density: 0.36, wet: 0.7, bells: true, trem: 0.35, vol: 1.3 },
    human: { mode: 'zhi', root: 55, bpm: 78, density: 0.58, wet: 0.35, doubles: true, trem: 0.15, vol: 1.1 },
    // 修士：清冷的角调，慢，带磬声；龙：低沉宽阔；仙：高处飘着，混响最长
    xiu: { mode: 'jue', root: 54, bpm: 64, density: 0.42, wet: 0.5, bells: true, trem: 0.25, vol: 1.2 },
    dragon: { mode: 'gong', root: 50, bpm: 72, density: 0.5, wet: 0.55, doubles: true, trem: 0.22, vol: 1.1 },
    xian: { mode: 'yu', root: 64, bpm: 50, density: 0.32, wet: 0.75, bells: true, trem: 0.3, vol: 1.35 },
    // 征战诸天：快一些，配战鼓
    war: { mode: 'shang', root: 50, bpm: 116, density: 0.55, wet: 0.22, doubles: true, trem: 0.1, vol: 0.9, drums: true },
  };
  const MUSIC_VOL = 0.45, SFX_VOL = 1.1;
  // 同一种音效最短间隔（秒），免得一下子叠成一团
  const GAP = { tap: 0.045, tick: 0.03, hit: 0.06, crit: 0.06 };

  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const noop = () => {};
  const then = (p, ok, bad) => { if (p && p.then) p.then(ok || noop, bad || noop); else if (ok) ok(); };

  let ctx = null, master = null, musicBus = null, sfxBus = null, musicWet = null, reverb = null, noiseBuf = null;
  let musicOn = true, sfxOn = true, hidden = false, resuming = false;
  let mood = 'between';
  let nextTime = 0, step = 0, timer = null, padNodes = null;
  let motif = null, motifPlays = 0;
  const lastPlayed = {};

  function ensure() {
    if (ctx) return ctx;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { return null; }
    // 最后一道压限，几个声音叠在一起也不会破音
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.knee.value = 8;
    comp.ratio.value = 10;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    comp.connect(ctx.destination);
    master = ctx.createGain();
    master.gain.value = 1.2;
    master.connect(comp);
    reverb = ctx.createConvolver();
    reverb.buffer = impulse(3.2, 2.6);
    reverb.connect(master);
    musicBus = ctx.createGain();
    musicBus.gain.value = musicOn ? MUSIC_VOL : 0;
    musicBus.connect(master);
    musicWet = ctx.createGain();
    musicWet.gain.value = MOODS[mood].wet;
    musicBus.connect(musicWet);
    musicWet.connect(reverb);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = sfxOn ? SFX_VOL : 0;
    sfxBus.connect(master);
    const sfxWet = ctx.createGain();
    sfxWet.gain.value = 0.22;
    sfxBus.connect(sfxWet);
    sfxWet.connect(reverb);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }

  // 混响用的“回声”：一段慢慢消失的噪声
  function impulse(sec, decay) {
    const rate = ctx.sampleRate, len = Math.floor(rate * sec);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  // 该出声的时候（页面在前台、音乐或音效至少开着一样）让声音跑起来，否则先停下省电
  function sync() {
    if (!ctx) return;
    const want = !hidden && (musicOn || sfxOn);
    if (want && ctx.state !== 'running') {
      resuming = true;
      then(ctx.resume(), () => { resuming = false; nextTime = ctx.currentTime + 0.1; }, () => { resuming = false; });
    } else if (!want && ctx.state === 'running') {
      resuming = false;
      then(ctx.suspend());
    }
  }

  function out(dest, pan) {
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      p.connect(dest);
      return p;
    }
    return dest;
  }

  // ---------- 几种乐器 ----------
  // 拨弦：三角波加两个泛音，滤波器从亮到暗，像古筝；bend 是从下方滑上来的按音
  function pluck(freq, t, o) {
    o = o || {};
    const dest = out(o.bus || musicBus, o.pan || 0);
    const vel = o.vel || 0.3, dur = o.dur || 2.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.min(10000, freq * 9), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(260, freq * 1.4), t + dur * 0.7);
    g.connect(lp);
    lp.connect(dest);
    const parts = [['triangle', 1, 1], ['sine', 2.004, 0.34], ['sine', 3.012, 0.1]];
    for (const [type, ratio, amp] of parts) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq * ratio * (o.bend ? 0.972 : 1), t);
      if (o.bend) osc.frequency.linearRampToValueAtTime(freq * ratio, t + 0.14);
      const a = ctx.createGain();
      a.gain.value = amp;
      osc.connect(a);
      a.connect(g);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    }
  }

  // 摇指：同一根弦上快速连拨，最后留一声长音
  function tremolo(freq, t, dur, vel, pan, bus) {
    const gap = 0.065;
    const n = clamp(Math.round(dur / gap), 6, 16);
    for (let i = 0; i < n; i++) {
      const k = i / n;
      pluck(freq, t + i * gap, { bus, vel: vel * (0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, k * 1.4))), dur: 0.8, pan });
    }
    pluck(freq, t + n * gap, { bus, vel: vel * 0.8, dur: 2.8, pan });
  }

  // 刮奏：顺着音阶一口气划过去
  function gliss(M, from, to, t, gap, vel, bus) {
    const len = Math.abs(to - from), dir = to >= from ? 1 : -1;
    for (let i = 0; i <= len; i++) {
      const k = i / Math.max(1, len);
      pluck(mtof(note(M, from + i * dir)), t + i * gap, { bus, vel: vel * (0.6 + 0.4 * k), dur: 1.8, pan: (k - 0.5) * 0.6 * dir });
    }
  }

  // 铃、磬：不成谐波的几个分音，余音长
  function bell(freq, t, vel, dur, bus, pan) {
    const dest = out(bus || sfxBus, pan || 0);
    const parts = [[1, 1], [2.76, 0.45], [5.4, 0.2], [8.93, 0.08]];
    for (const [r, a] of parts) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * r;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vel * a, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur / (1 + r * 0.25));
      osc.connect(g);
      g.connect(dest);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    }
  }

  // 锣：低沉的铃声，再加一层慢慢涌起的噪声
  function gong(freq, t, vel, dur) {
    bell(freq, t, vel, dur, sfxBus);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq * 3.5;
    bp.Q.value = 1.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel * 0.5, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.7);
    src.connect(bp);
    bp.connect(g);
    g.connect(sfxBus);
    src.start(t);
    src.stop(t + dur);
  }

  // 木鱼：空心的一声“笃”，两个很快消失的共鸣加一点敲击的杂音
  function wood(t, pitch, vel) {
    for (const [r, a, d] of [[1, 1, 0.12], [2.32, 0.35, 0.05]]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(pitch * r * 1.5, t);
      osc.frequency.exponentialRampToValueAtTime(pitch * r, t + 0.02);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vel * a, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      osc.connect(g);
      g.connect(sfxBus);
      osc.start(t);
      osc.stop(t + d + 0.02);
    }
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2600;
    bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel * 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.015);
    src.connect(bp);
    bp.connect(g);
    g.connect(sfxBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + 0.02);
  }

  function noise(t, dur, f0, f1, vel) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(f0, t);
    bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp);
    bp.connect(g);
    g.connect(sfxBus);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  // 堂鼓：一声往下沉的低音，加一点鼓皮的噪声
  function drum(t, vel, pitch, bus) {
    bus = bus || musicBus;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime((pitch || 110) * 1.8, t);
    osc.frequency.exponentialRampToValueAtTime(pitch || 110, t + 0.06);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    osc.connect(g);
    g.connect(bus);
    osc.start(t);
    osc.stop(t + 0.5);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(vel * 0.5, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    src.connect(lp);
    lp.connect(ng);
    ng.connect(bus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + 0.1);
  }

  // 当前心境下的第 i 个音（可以跨八度）
  function note(M, i) {
    const sc = MODES[M.mode];
    const oct = Math.floor(i / sc.length);
    const k = ((i % sc.length) + sc.length) % sc.length;
    return M.root + 12 * oct + sc[k];
  }

  // ---------- 背景音乐：一拍一拍地往前排 ----------
  const MOVES = [-2, -1, -1, 0, 1, 1, 2];

  // 一个两小节的小动机：前 13 个八分音符里哪几拍弹、弹哪个音
  function makeMotif(M) {
    const notes = [];
    let d = pick([3, 4, 5, 5, 6]);
    for (let s = 0; s < 13; s++) {
      const strong = s % 4 === 0;
      if (s > 0 && Math.random() > M.density * (strong ? 1.3 : 0.9)) { notes.push(null); continue; }
      d = clamp(d + pick(MOVES), 0, 9);
      notes.push({
        d,
        vel: (strong ? 0.24 : 0.17) * (0.85 + Math.random() * 0.3),
        bend: Math.random() < 0.12,
        dbl: !!M.doubles && Math.random() < 0.2,
      });
    }
    return { notes, open: pick([1, 3, 4, 6]) };
  }

  function playStep(M, t, eighth) {
    const beat = step % 16;
    const jt = t + Math.random() * 0.012;
    if (M.drums) {
      // 咚 · 咚咚 · 咚，乐句末尾滚一串
      if (beat === 0 || beat === 8) drum(t, 0.5, 92);
      else if (beat === 3 || beat === 11) drum(t, 0.3, 120);
      else if (beat === 6 || beat === 14) drum(t, 0.36, 104);
      else if (beat === 15) { drum(t, 0.22, 140); drum(t + eighth / 2, 0.28, 130); }
    }
    if (beat === 0) {
      if (!motif || motifPlays >= 2) { motif = makeMotif(M); motifPlays = 0; }
      motifPlays++;
      pluck(mtof(note(M, 0) - 12), t, { vel: 0.22 * M.vol, dur: 3.6 });
      if (Math.random() < 0.5) pluck(mtof(note(M, 3) - 12), t + 0.02, { vel: 0.12 * M.vol, dur: 3 });
    } else if (beat === 8 && Math.random() < 0.6) {
      pluck(mtof(note(M, pick([3, 2, 0])) - 12), t, { vel: 0.13 * M.vol, dur: 2.6 });
    }
    if (!motif || beat >= 14) return;
    const second = motifPlays === 2;
    if (beat === 13) {
      // 第一遍停在不稳的音上（问），第二遍落回主音（答）
      const f = mtof(note(M, second ? pick([0, 5, 5]) : motif.open));
      const pan = (Math.random() - 0.5) * 0.5;
      if (second && Math.random() < M.trem) tremolo(f, jt, Math.min(1, eighth * 2.6), 0.2 * M.vol, pan);
      else pluck(f, jt, { vel: 0.26 * M.vol, dur: 3, bend: Math.random() < 0.3, pan });
      return;
    }
    const n = motif.notes[beat];
    if (!n) return;
    let d = n.d;
    if (second && Math.random() < 0.25) d = clamp(d + pick([-1, 1]), 0, 9); // 第二遍稍作变化
    const pan = (Math.random() - 0.5) * 0.7;
    const v = n.vel * M.vol;
    pluck(mtof(note(M, d)), jt, { vel: v, dur: 2.2, bend: n.bend, pan });
    if (n.dbl) pluck(mtof(note(M, d + 2)), jt + 0.03, { vel: v * 0.7, dur: 2, pan: -pan });
    if (M.bells && Math.random() < 0.07) bell(mtof(note(M, d + 10)), jt + 0.05, 0.05 * M.vol, 3.5, musicBus, pan);
  }

  function schedule() {
    if (!ctx || !musicOn || ctx.state !== 'running') return;
    const M = MOODS[mood] || MOODS.between;
    const eighth = 60 / M.bpm / 2;
    if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05;
    while (nextTime < ctx.currentTime + 0.3) {
      playStep(M, nextTime, eighth);
      nextTime += eighth;
      step++;
    }
  }

  // 一层很轻的长音垫底，换心境时淡入淡出
  function stopPad(t) {
    if (!padNodes) return;
    const old = padNodes;
    padNodes = null;
    old.g.gain.cancelScheduledValues(t);
    old.g.gain.setValueAtTime(old.g.gain.value, t);
    old.g.gain.linearRampToValueAtTime(0, t + 1.5);
    old.oscs.forEach(o => o.stop(t + 1.6));
  }
  function setPad() {
    if (!ctx) return;
    const t = ctx.currentTime;
    stopPad(t);
    const M = MOODS[mood] || MOODS.between;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + 2.5);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    g.connect(lp);
    lp.connect(musicBus);
    const oscs = [note(M, 0) - 12, note(M, 3) - 12, note(M, 0)].map((m, i) => {
      const o = ctx.createOscillator();
      o.type = i === 2 ? 'triangle' : 'sine';
      o.frequency.value = mtof(m);
      o.detune.value = (i - 1) * 4;
      const a = ctx.createGain();
      a.gain.value = i === 2 ? 0.25 : 0.5;
      o.connect(a);
      a.connect(g);
      o.start(t);
      return o;
    });
    padNodes = { g, oscs };
  }

  // ---------- 对外 ----------
  const Sound = {
    // 在用户点按的那一刻调用：建立声音环境、开始排背景音乐
    unlock() {
      if (!musicOn && !sfxOn) return;
      if (!ensure()) return;
      if (!timer) {
        timer = setInterval(schedule, 80);
        nextTime = ctx.currentTime + 0.15;
        if (musicOn) setPad();
      }
      if (ctx.state !== 'running') {
        sync();
        // 老版本 iOS 要在点按里真正播一点声音才算解锁
        try {
          const s = ctx.createBufferSource();
          s.buffer = ctx.createBuffer(1, 1, 22050);
          s.connect(ctx.destination);
          s.start(0);
        } catch (e) { /* 新浏览器不需要 */ }
      }
    },
    get ready() { return !!ctx && ctx.state === 'running'; },
    get info() { return { state: ctx ? ctx.state : 'none', mood, musicOn, sfxOn, hidden }; },
    setMood(m) {
      if (!MOODS[m] || m === mood) return;
      const wasFox = mood.indexOf('fox') === 0;
      mood = m;
      motif = null;
      step = 0;
      if (!ctx) return;
      musicWet.gain.setTargetAtTime(MOODS[m].wet, ctx.currentTime, 0.8);
      if (musicOn && timer) {
        setPad();
        // 狐狸的夜晚降临时敲一声远远的磬
        if (m === 'fox-night' && wasFox && ctx.state === 'running') bell(mtof(note(MOODS[m], 5)), ctx.currentTime + 0.05, 0.07, 4, musicBus);
      }
    },
    setMusic(on) {
      musicOn = !!on;
      if (!ctx) return;
      const t = ctx.currentTime;
      musicBus.gain.setTargetAtTime(musicOn ? MUSIC_VOL : 0, t, 0.15);
      if (musicOn) { nextTime = t + 0.1; if (timer) setPad(); }
      else stopPad(t);
      sync();
    },
    setSfx(on) {
      sfxOn = !!on;
      if (!ctx) return;
      sfxBus.gain.setTargetAtTime(sfxOn ? SFX_VOL : 0, ctx.currentTime, 0.05);
      sync();
    },
    // 切到后台就停，回来再接着响
    setHidden(h) {
      hidden = !!h;
      sync();
    },

    play(name, arg) {
      if (!ctx || !sfxOn || hidden || (ctx.state !== 'running' && !resuming)) return;
      const t = ctx.currentTime + 0.01;
      if (t - (lastPlayed[name] || -1) < (GAP[name] || 0.1)) return;
      lastPlayed[name] = t;
      const M = MOODS[mood] || MOODS.between;
      const n = i => mtof(note(M, i));
      switch (name) {
        case 'tap':
          wood(t, 560 + Math.random() * 50, 0.32);
          break;
        case 'buy':
          pluck(n(5 + Math.floor(Math.random() * 3)), t, { bus: sfxBus, vel: 0.22, dur: 1.2 });
          pluck(n(8), t + 0.07, { bus: sfxBus, vel: 0.16, dur: 1.2 });
          break;
        case 'want':
          wood(t, 640, 0.22);
          wood(t + 0.09, 760, 0.16);
          break;
        case 'learn':
          bell(n(10), t, 0.16, 2.6);
          pluck(n(5), t, { bus: sfxBus, vel: 0.2, dur: 1.8 });
          break;
        case 'bought':
          [5, 7, 10].forEach((d, i) => pluck(n(d), t + i * 0.07, { bus: sfxBus, vel: 0.2, dur: 1.6 }));
          break;
        case 'milestone':
          [5, 7, 9, 12].forEach((d, i) => pluck(n(d), t + i * 0.09, { bus: sfxBus, vel: 0.22, dur: 2 }));
          bell(n(12), t + 0.36, 0.12, 3);
          break;
        case 'unlock':
          gong(n(0) / 2, t, 0.3, 4.5);
          gliss(M, 0, 12, t + 0.15, 0.045, 0.2, sfxBus);
          break;
        case 'event':
          // 有人敲门
          wood(t, 430, 0.3);
          wood(t + 0.16, 430, 0.24);
          break;
        case 'choose':
          pluck(n(5), t, { bus: sfxBus, vel: 0.2, dur: 1.6 });
          pluck(n(7), t + 0.05, { bus: sfxBus, vel: 0.14, dur: 1.6 });
          break;
        case 'condense': {
          const o = ctx.createOscillator();
          o.type = 'sine';
          o.frequency.setValueAtTime(n(0), t);
          o.frequency.exponentialRampToValueAtTime(n(10), t + 0.5);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.12, t + 0.1);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
          o.connect(g);
          g.connect(sfxBus);
          o.start(t);
          o.stop(t + 0.65);
          bell(n(12), t + 0.5, 0.16, 3);
          break;
        }
        case 'skill':
          noise(t, 0.5, 300, 3200, 0.18);
          [0, 2, 4].forEach(d => pluck(n(d + 5), t + 0.3, { bus: sfxBus, vel: 0.15, dur: 2 }));
          break;
        case 'feature':
          bell(n(10), t, 0.14, 3);
          bell(n(12), t + 0.12, 0.1, 3);
          break;
        case 'toggle':
          pluck(n(7), t, { bus: sfxBus, vel: 0.24, dur: 1 });
          break;
        case 'spin':
          noise(t, 0.7, 200, 1400, 0.5);
          break;
        case 'tick': {
          const o = ctx.createOscillator();
          o.type = 'triangle';
          o.frequency.value = 1900 + Math.random() * 300;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.13, t + 0.001);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
          o.connect(g);
          g.connect(sfxBus);
          o.start(t);
          o.stop(t + 0.03);
          break;
        }
        case 'result': {
          const tier = arg || 0;
          if (tier <= 0) { pluck(n(5), t, { bus: sfxBus, vel: 0.26, dur: 2.4 }); break; }
          if (tier === 1) { [5, 8].forEach((d, i) => pluck(n(d), t + i * 0.1, { bus: sfxBus, vel: 0.24, dur: 2.4 })); break; }
          if (tier === 2) { [5, 7, 10].forEach((d, i) => pluck(n(d), t + i * 0.09, { bus: sfxBus, vel: 0.24, dur: 2.6 })); break; }
          gliss(M, 0, tier >= 4 ? 14 : 10, t, 0.035, 0.22, sfxBus);
          bell(n(12), t + 0.4, 0.18, 4);
          if (tier >= 4) {
            gong(n(0) / 2, t, 0.34, 5);
            for (let i = 0; i < 10; i++) bell(n(12 + Math.floor(Math.random() * 5)), t + 0.7 + i * 0.13, 0.06, 2.5, sfxBus, (Math.random() - 0.5) * 1.2);
          }
          break;
        }
        case 'born':
          // 投胎：用新一世的调子划一串刮奏
          gliss(M, 0, 7, t, 0.05, 0.18, sfxBus);
          bell(n(10), t + 0.4, 0.1, 3.5);
          break;
        case 'drum':
          drum(t, 0.6, 85, sfxBus);
          drum(t + 0.18, 0.45, 95, sfxBus);
          drum(t + 0.36, 0.7, 75, sfxBus);
          break;
        case 'hit':
          drum(t, 0.22, 170 + Math.random() * 40, sfxBus);
          noise(t, 0.08, 1800, 900, 0.09);
          break;
        case 'crit':
          drum(t, 0.32, 150, sfxBus);
          noise(t, 0.1, 2600, 1200, 0.12);
          bell(n(12), t + 0.02, 0.08, 1.2);
          break;
        case 'die':
          drum(t, 0.45, 70, sfxBus);
          pluck(n(3), t + 0.05, { bus: sfxBus, vel: 0.16, dur: 1.4, bend: true });
          break;
        case 'heal':
          bell(n(10), t, 0.08, 1.8);
          bell(n(12), t + 0.08, 0.06, 1.8);
          break;
        case 'cast':
          noise(t, 0.35, 400, 2600, 0.14);
          gliss(M, 3, 8, t + 0.05, 0.03, 0.14, sfxBus);
          break;
        case 'win':
          gliss(M, 0, 10, t, 0.04, 0.2, sfxBus);
          gong(n(0) / 2, t + 0.1, 0.24, 3.5);
          bell(n(12), t + 0.45, 0.12, 3);
          break;
        case 'lose':
          [7, 5, 3, 0].forEach((d, i) => pluck(n(d), t + i * 0.22, { bus: sfxBus, vel: 0.18, dur: 2, bend: i === 3 }));
          break;
        case 'collect':
          [7, 9, 12].forEach((d, i) => pluck(n(d), t + i * 0.05, { bus: sfxBus, vel: 0.16, dur: 1.2 }));
          wood(t, 900, 0.12);
          break;
        case 'lvup':
          gliss(M, 5, 12, t, 0.035, 0.16, sfxBus);
          bell(n(12), t + 0.3, 0.12, 2.6);
          break;
        case 'charge':
          // 首领蓄力：一串越来越急的低鼓，底下一阵往上涌的风声
          noise(t, 0.9, 180, 1500, 0.12);
          [0, 0.16, 0.3, 0.42, 0.52].forEach((d, i) => drum(t + d, 0.2 + i * 0.07, 66, sfxBus));
          break;
        case 'roar':
          // 首领的大招落下来
          drum(t, 0.75, 58, sfxBus);
          gong(n(0) / 2, t + 0.02, 0.3, 3);
          noise(t, 0.6, 1400, 220, 0.2);
          break;
        case 'break':
          // 打断：一声脆响
          drum(t, 0.35, 230, sfxBus);
          noise(t, 0.12, 4200, 2200, 0.14);
          bell(n(12), t + 0.01, 0.14, 1.6);
          bell(n(15), t + 0.07, 0.1, 1.6);
          break;
        case 'ascend':
          // 突破成功
          gong(n(0) / 2, t, 0.2, 3.5);
          gliss(M, 0, 12, t + 0.05, 0.03, 0.2, sfxBus);
          bell(n(14), t + 0.45, 0.14, 3.5);
          break;
        case 'fail':
          // 突破失败、跃门失手
          noise(t, 0.4, 900, 200, 0.1);
          [5, 3, 1, -2].forEach((d, i) => pluck(n(d), t + i * 0.12, { bus: sfxBus, vel: 0.17, dur: 1.4, bend: i === 3 }));
          break;
        case 'leap':
          // 鲤鱼跃过龙门
          drum(t, 0.5, 90, sfxBus);
          noise(t, 0.5, 600, 3200, 0.14);
          gliss(M, -3, 10, t + 0.05, 0.025, 0.2, sfxBus);
          bell(n(12), t + 0.35, 0.12, 2.6);
          break;
        case 'peach':
          // 摘桃
          pluck(n(7), t, { bus: sfxBus, vel: 0.2, dur: 1.2 });
          pluck(n(10), t + 0.07, { bus: sfxBus, vel: 0.18, dur: 1.4 });
          bell(n(14), t + 0.12, 0.08, 1.6);
          break;
        case 'end':
          gong(n(0) / 2, t, 0.3, 5);
          [9, 7, 5].forEach((d, i) => pluck(n(d), t + 0.4 + i * 0.35, { bus: sfxBus, vel: 0.18, dur: 2.8 }));
          break;
      }
    },
  };

  WS.Sound = Sound;
})(typeof window !== 'undefined' ? window : globalThis);
