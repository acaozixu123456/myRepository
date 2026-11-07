/* 万世洞天 · 洞天画师
 * 用 Canvas 把洞天画成一幅水墨浮空岛。洞天里每样东西的等级决定画上出现什么。
 * 颜色全部读页面上的 CSS 变量，所以深色模式下自动变成夜景。
 */
(function (root) {
  'use strict';
  const WS = root.WS = root.WS || {};

  function hexToRgb(h) {
    h = (h || '#000').replace('#', '').trim();
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  // 固定种子的随机数，保证每次画出来的洞天长得一样
  function rng(seed) {
    let s = (seed * 2654435761) >>> 0 || 1;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  const KAI = '"Kaiti SC","STKaiti","KaiTi","BiauKai","TW-Kai","Songti SC","Noto Serif CJK SC",serif';

  WS.Painter = function (canvas) {
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, dpr = 1;
    let P = null;
    let lv = {};
    let layout = null;
    let texture = null;
    let title = '';

    function palette() {
      const cs = getComputedStyle(document.documentElement);
      const g = k => hexToRgb(cs.getPropertyValue(k));
      P = {
        paper: g('--paper'), ink: g('--ink'), jade: g('--jade'), azure: g('--azure'),
        fire: g('--fire'), gold: g('--gold'), seal: g('--seal'), cloud: g('--cloud'),
        water: g('--water'), moon: g('--moon'),
        cloudA: parseFloat(cs.getPropertyValue('--cloud-a')) || 0.7,
      };
      texture = null;
    }

    function resize() {
      const r = canvas.getBoundingClientRect();
      if (!r.width) return false;
      dpr = Math.min(2, root.devicePixelRatio || 1);
      W = r.width; H = r.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      layout = null;
      texture = null;
      return true;
    }

    function setLevels(levels, name) {
      lv = Object.assign({}, levels);
      title = name || '';
      layout = null;
    }

    const L = id => lv[id] || 0;

    // ---------- 版面：根据等级算出每样东西的位置 ----------
    function build() {
      const r = rng(1107);
      const total = WS.FEATURES.reduce((a, f) => a + L(f.id), 0);
      const cx = W * 0.5;
      const topY = H * 0.6;
      const IW = W * Math.min(0.82, 0.4 + 0.018 * total);
      const rx = IW / 2, ry = IW * 0.1;

      // 岛的底部：参差的山石
      const under = [];
      const n = 18;
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const prof = Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.05)), 1.25);
        const depth = IW * 0.5 * prof * (0.72 + 0.4 * r()) + (u > 0.45 && u < 0.62 ? IW * 0.12 : 0);
        under.push([cx - rx + u * 2 * rx + (r() - 0.5) * rx * 0.06, topY + ry * Math.sin(Math.PI * u) * 0.6 + depth]);
      }
      // 皴法笔触
      const strokes = [];
      for (let i = 0; i < 26; i++) {
        const u = 0.08 + r() * 0.84;
        const x = cx - rx + u * 2 * rx;
        const y = topY + ry * 0.7 + r() * IW * 0.28 * Math.sin(Math.PI * u);
        strokes.push([x, y, (r() - 0.5) * 8, 6 + r() * 14, 0.15 + r() * 0.25]);
      }

      // 在岛面上取一个点（u,v 在 -1..1 之间）
      const at = (u, v) => [cx + u * rx * 0.88, topY + v * ry * 0.78];

      const items = [];
      // 普通的树，和狐火林
      const plain = 3;
      const fw = L('foxwood');
      const nTrees = plain + Math.min(16, fw * 2);
      for (let i = 0; i < nTrees; i++) {
        const isFox = i >= plain;
        const u = isFox ? -0.82 + r() * 0.7 : (i === 0 ? -0.55 : i === 1 ? 0.62 : 0.1) + (r() - 0.5) * 0.1;
        const v = (r() - 0.5) * 1.4;
        const [x, y] = at(u, v);
        items.push({ k: 'tree', x, y, h: W * (0.05 + r() * 0.03) * (isFox ? 1.1 : 1), fox: isFox, i });
      }
      // 小村
      const vil = Math.min(8, L('village'));
      const housePos = [[0.22, -0.35], [0.42, -0.5], [0.12, 0.25], [0.6, -0.1], [0.32, 0.45], [0.7, 0.35], [0.05, -0.6], [0.5, 0.15]];
      for (let i = 0; i < vil; i++) {
        const [x, y] = at(housePos[i][0], housePos[i][1]);
        items.push({ k: 'house', x, y, s: W * 0.045, i });
      }
      // 灵泉
      if (L('spring') > 0) {
        const [x, y] = at(0.45, 0.62);
        items.push({ k: 'pond', x, y, rx: rx * (0.13 + Math.min(6, L('spring')) * 0.012), flat: true });
      }
      // 凉亭
      if (L('pavilion') > 0) {
        const [x, y] = at(-0.18, 0.62);
        items.push({ k: 'pavilion', x, y, s: W * (0.07 + Math.min(4, L('pavilion')) * 0.004) });
      }
      // 望月台
      if (L('terrace') > 0) {
        const [x, y] = at(0.72, -0.72);
        items.push({ k: 'terrace', x, y, s: W * 0.07 });
      }
      // 古松长在岛的左边缘
      if (L('pine') > 0) {
        const [x, y] = at(-0.98, 0.05);
        items.push({ k: 'pine', x, y, s: W * (0.12 + Math.min(5, L('pine')) * 0.008), n: 2 + L('pine') });
      }
      // 丹房：修士前世留下的，一座小屋带一口丹炉
      if (L('danfang') > 0) {
        const [x, y] = at(-0.5, -0.55);
        items.push({ k: 'danfang', x, y, s: W * (0.055 + Math.min(5, L('danfang')) * 0.004), n: L('danfang') });
      }
      // 龙潭：龙前世留下的，一汪深潭，潭里有条龙
      if (L('longtan') > 0) {
        const [x, y] = at(-0.42, 0.52);
        items.push({ k: 'longtan', x, y, rx: rx * (0.15 + Math.min(6, L('longtan')) * 0.012), n: L('longtan'), flat: true });
      }
      // 琼楼：仙前世留下的，一座几层高的楼阁，等级越高越高
      if (L('qionglou') > 0) {
        const [x, y] = at(-0.08, -0.86);
        items.push({ k: 'qionglou', x, y, s: W * 0.06, n: Math.min(5, 1 + L('qionglou')) });
      }
      // 沃土上的嫩芽
      const sprouts = [];
      const ns = Math.min(70, 6 + L('soil') * 7);
      for (let i = 0; i < ns; i++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r());
        sprouts.push([cx + Math.cos(a) * d * rx * 0.86, topY + Math.sin(a) * d * ry * 0.7, 2 + r() * 3]);
      }
      items.sort((a, b) => a.y - b.y);

      // 云
      const clouds = [];
      const nc = 2 + Math.min(6, L('cloud'));
      for (let i = 0; i < nc; i++) {
        clouds.push({ x: r(), y: H * (0.12 + r() * 0.3), s: W * (0.04 + r() * 0.035), v: 4 + r() * 8, back: true });
      }
      const nf = Math.min(4, L('cloud'));
      for (let i = 0; i < nf; i++) {
        clouds.push({ x: r(), y: topY + IW * (0.28 + r() * 0.25), s: W * (0.05 + r() * 0.04), v: 5 + r() * 6, back: false });
      }

      layout = { cx, topY, IW, rx, ry, under, strokes, items, sprouts, clouds, total };
    }

    // ---------- 各种笔墨 ----------
    function paperTexture() {
      const c = document.createElement('canvas');
      c.width = c.height = 160;
      const g = c.getContext('2d');
      const r = rng(42);
      for (let i = 0; i < 1600; i++) {
        g.fillStyle = rgba(P.ink, r() * 0.05);
        g.fillRect(r() * 160, r() * 160, 1 + r(), 1 + r());
      }
      for (let i = 0; i < 40; i++) {
        g.strokeStyle = rgba(P.ink, 0.025);
        g.beginPath();
        const x = r() * 160, y = r() * 160;
        g.moveTo(x, y);
        g.lineTo(x + (r() - 0.5) * 30, y + (r() - 0.5) * 6);
        g.stroke();
      }
      texture = ctx.createPattern(c, 'repeat');
    }

    function mountains() {
      const layers = 1 + Math.min(4, L('peak'));
      for (let i = 0; i < layers; i++) {
        const r = rng(100 + i * 17);
        const base = H * (0.34 + i * 0.055);
        const amp = H * (0.17 - i * 0.022);
        const alpha = 0.09 + i * 0.07;
        const bumps = [];
        const nb = 3 + Math.floor(r() * 3);
        for (let b = 0; b < nb; b++) bumps.push({ c: (r() * 1.2 - 0.1) * W, w: W * (0.08 + r() * 0.16), h: amp * (0.45 + r() * 0.65) });
        ctx.beginPath();
        ctx.moveTo(-10, H);
        const segs = 60;
        for (let s = 0; s <= segs; s++) {
          const x = -10 + s / segs * (W + 20);
          let y = base + amp * 0.55;
          for (const b of bumps) { const d = (x - b.c) / b.w; y -= b.h * Math.exp(-d * d * 1.8); }
          y += Math.sin(x * 0.08 + i * 3) * 1.5;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(W + 10, H);
        ctx.closePath();
        const g = ctx.createLinearGradient(0, base - amp, 0, base + amp * 0.9);
        g.addColorStop(0, rgba(P.ink, alpha));
        g.addColorStop(0.55, rgba(P.ink, alpha * 0.45));
        g.addColorStop(1, rgba(P.ink, 0));
        ctx.fillStyle = g;
        ctx.fill();
      }
    }

    function cloud(x, y, s, a) {
      ctx.fillStyle = rgba(P.cloud, a);
      ctx.beginPath();
      ctx.ellipse(x, y, s * 1.7, s * 0.5, 0, 0, Math.PI * 2);
      ctx.ellipse(x - s * 0.9, y + s * 0.1, s * 0.9, s * 0.38, 0, 0, Math.PI * 2);
      ctx.ellipse(x + s * 1.0, y + s * 0.08, s, s * 0.4, 0, 0, Math.PI * 2);
      ctx.ellipse(x + s * 0.15, y - s * 0.28, s * 0.85, s * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = rgba(P.ink, 0.08);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x - s * 0.5, y + s * 0.05, s * 0.32, Math.PI * 0.9, Math.PI * 1.9);
      ctx.stroke();
    }

    function drawClouds(t, back) {
      for (const c of layout.clouds) {
        if (c.back !== back) continue;
        const span = W + c.s * 6;
        const x = ((c.x * span + t * c.v) % span) - c.s * 3;
        cloud(x, c.y, c.s, P.cloudA * (back ? 0.9 : 1));
      }
    }

    function moon() {
      const n = L('terrace');
      if (!n) return;
      const x = W * 0.82, y = H * 0.17, r = W * (0.045 + Math.min(6, n) * 0.004);
      const g = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 2.6);
      g.addColorStop(0, rgba(P.moon, 0.35));
      g.addColorStop(1, rgba(P.moon, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r * 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = rgba(P.moon, 0.85);
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }

    function titleAndSeal() {
      const fs = Math.max(14, W * 0.05);
      ctx.fillStyle = rgba(P.ink, 0.82);
      ctx.font = `${fs}px ${KAI}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const chars = '万世洞天'.split('');
      const x = W * 0.08, y0 = H * 0.09;
      chars.forEach((c, i) => ctx.fillText(c, x, y0 + i * fs * 1.12));
      if (title) {
        ctx.font = `${fs * 0.55}px ${KAI}`;
        ctx.fillStyle = rgba(P.ink, 0.55);
        title.split('').forEach((c, i) => ctx.fillText(c, x + fs * 0.95, y0 + fs * 0.25 + i * fs * 0.62));
      }
      const s = fs * 1.15;
      const sy = y0 + chars.length * fs * 1.12 - fs * 0.2;
      ctx.fillStyle = rgba(P.seal, 0.88);
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x - s / 2, sy, s, s, 3); else ctx.rect(x - s / 2, sy, s, s);
      ctx.fill();
      ctx.fillStyle = rgba(P.paper, 0.95);
      ctx.font = `${s * 0.42}px ${KAI}`;
      ctx.fillText('洞', x, sy + s * 0.29);
      ctx.fillText('天', x, sy + s * 0.72);
    }

    function island() {
      const { cx, topY, rx, ry, under, strokes, IW } = layout;
      // 底部山石
      ctx.beginPath();
      ctx.moveTo(cx - rx, topY);
      for (const [x, y] of under) ctx.lineTo(x, y);
      ctx.lineTo(cx + rx, topY);
      ctx.ellipse(cx, topY, rx, ry, 0, 0, Math.PI, false);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, topY, 0, topY + IW * 0.62);
      g.addColorStop(0, rgba(P.ink, 0.62));
      g.addColorStop(0.5, rgba(P.ink, 0.3));
      g.addColorStop(1, rgba(P.ink, 0.04));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = 1;
      for (const [x, y, dx, len, a] of strokes) {
        ctx.strokeStyle = rgba(P.ink, a);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + dx * 0.5, y + len * 0.5, x + dx, y + len);
        ctx.stroke();
      }
      // 岛面
      ctx.beginPath();
      ctx.ellipse(cx, topY, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = rgba(P.paper, 1);
      ctx.fill();
      ctx.fillStyle = rgba(P.jade, 0.16 + Math.min(8, L('soil')) * 0.03);
      ctx.fill();
      ctx.strokeStyle = rgba(P.ink, 0.55);
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }

    function waterfall(t) {
      if (L('spring') < 3) return;
      const { cx, topY, rx, ry, IW } = layout;
      const x0 = cx + rx * 0.78, y0 = topY + ry * 0.5;
      const len = H - y0;
      ctx.save();
      ctx.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = rgba(P.water, 0.75 - i * 0.12);
        ctx.lineWidth = 2.2 - i * 0.3;
        ctx.setLineDash([8 + i * 3, 9 + i * 2]);
        ctx.lineDashOffset = -t * (55 + i * 8);
        ctx.beginPath();
        ctx.moveTo(x0 + i * 3, y0);
        ctx.quadraticCurveTo(x0 + i * 3 + 6, y0 + len * 0.15, x0 + i * 3 + 4, y0 + len);
        ctx.stroke();
      }
      ctx.restore();
      const g = ctx.createRadialGradient(x0 + 6, H - 4, 0, x0 + 6, H - 4, IW * 0.18);
      g.addColorStop(0, rgba(P.cloud, P.cloudA));
      g.addColorStop(1, rgba(P.cloud, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x0 - IW * 0.2, H - IW * 0.2, IW * 0.4, IW * 0.2);
    }

    function sprouts() {
      ctx.lineWidth = 1;
      for (const [x, y, s] of layout.sprouts) {
        ctx.strokeStyle = rgba(P.jade, 0.7);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - s * 0.6, y - s);
        ctx.moveTo(x, y);
        ctx.lineTo(x + s * 0.5, y - s * 0.9);
        ctx.stroke();
      }
    }

    function tree(it, t) {
      const { x, y, h, fox, i } = it;
      const r = rng(i * 31 + 7);
      ctx.strokeStyle = rgba(P.ink, 0.8);
      ctx.lineWidth = Math.max(1, h * 0.07);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + h * 0.1, y - h * 0.5, x - h * 0.04, y - h);
      ctx.stroke();
      for (let k = 0; k < 7; k++) {
        const a = r() * Math.PI * 2, d = r() * h * 0.32;
        ctx.fillStyle = rgba(fox ? P.ink : P.ink, 0.3 + r() * 0.4);
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(a) * d, y - h * 0.95 + Math.sin(a) * d * 0.6, h * 0.17, h * 0.11, r() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      if (fox) {
        for (let k = 0; k < 2; k++) {
          const f = 0.5 + 0.5 * Math.sin(t * (2.2 + k) + i * 1.7 + k);
          const fx = x + (r() - 0.5) * h * 0.7, fy = y - h * (0.65 + r() * 0.5);
          const rr = h * (0.22 + 0.06 * f);
          const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, rr);
          g.addColorStop(0, rgba(P.fire, 0.55 + 0.35 * f));
          g.addColorStop(1, rgba(P.fire, 0));
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(fx, fy, rr, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = rgba(P.fire, 0.95);
          ctx.beginPath(); ctx.arc(fx, fy - f * 1.5, Math.max(1, h * 0.04), 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    function house(it, t) {
      const { x, y, s, i } = it;
      ctx.lineWidth = 1;
      ctx.fillStyle = rgba(P.paper, 1);
      ctx.strokeStyle = rgba(P.ink, 0.75);
      ctx.beginPath();
      ctx.rect(x - s * 0.45, y - s * 0.5, s * 0.9, s * 0.5);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = rgba(P.ink, 0.6);
      ctx.fillRect(x - s * 0.08, y - s * 0.28, s * 0.16, s * 0.28);
      ctx.fillStyle = rgba(P.ink, 0.88);
      ctx.beginPath();
      ctx.moveTo(x - s * 0.72, y - s * 0.46);
      ctx.quadraticCurveTo(x - s * 0.45, y - s * 0.55, x - s * 0.32, y - s * 0.85);
      ctx.lineTo(x + s * 0.32, y - s * 0.85);
      ctx.quadraticCurveTo(x + s * 0.45, y - s * 0.55, x + s * 0.72, y - s * 0.46);
      ctx.quadraticCurveTo(x, y - s * 0.6, x - s * 0.72, y - s * 0.46);
      ctx.fill();
      if (i % 2 === 0) {
        ctx.strokeStyle = rgba(P.ink, 0.2);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        const sx = x + s * 0.22, sy = y - s * 0.88;
        for (let k = 0; k <= 14; k++) {
          const yy = sy - k * s * 0.14;
          const xx = sx + Math.sin(t * 1.4 + k * 0.55 + i) * s * 0.12 * (k / 14) + k * s * 0.035;
          if (k) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy);
        }
        ctx.stroke();
      }
    }

    function pond(it, t) {
      const { x, y, rx } = it;
      ctx.fillStyle = rgba(P.water, 0.7);
      ctx.beginPath(); ctx.ellipse(x, y, rx, rx * 0.34, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = rgba(P.ink, 0.45); ctx.lineWidth = 1; ctx.stroke();
      for (let k = 0; k < 2; k++) {
        const p = (t * 0.35 + k * 0.5) % 1;
        const rr = rx * (0.15 + p * 0.6);
        ctx.strokeStyle = rgba(P.ink, 0.28 * (1 - p));
        ctx.beginPath(); ctx.ellipse(x + rx * 0.1, y, rr, rr * 0.34, 0, 0, Math.PI * 2); ctx.stroke();
      }
    }

    function pavilion(it) {
      const { x, y, s } = it;
      ctx.fillStyle = rgba(P.ink, 0.5);
      ctx.fillRect(x - s * 0.45, y - s * 0.05, s * 0.9, s * 0.07);
      ctx.strokeStyle = rgba(P.ink, 0.85); ctx.lineWidth = 1.3;
      for (const dx of [-0.34, -0.12, 0.12, 0.34]) {
        ctx.beginPath(); ctx.moveTo(x + dx * s, y - s * 0.04); ctx.lineTo(x + dx * s, y - s * 0.5); ctx.stroke();
      }
      ctx.fillStyle = rgba(P.ink, 0.92);
      ctx.beginPath();
      ctx.moveTo(x - s * 0.64, y - s * 0.46);
      ctx.quadraticCurveTo(x - s * 0.4, y - s * 0.5, x - s * 0.12, y - s * 0.8);
      ctx.lineTo(x, y - s * 0.96);
      ctx.lineTo(x + s * 0.12, y - s * 0.8);
      ctx.quadraticCurveTo(x + s * 0.4, y - s * 0.5, x + s * 0.64, y - s * 0.46);
      ctx.quadraticCurveTo(x, y - s * 0.58, x - s * 0.64, y - s * 0.46);
      ctx.fill();
    }

    function terrace(it) {
      const { x, y, s } = it;
      ctx.fillStyle = rgba(P.ink, 0.5);
      ctx.beginPath();
      ctx.moveTo(x - s * 0.5, y); ctx.lineTo(x + s * 0.5, y);
      ctx.lineTo(x + s * 0.42, y - s * 0.22); ctx.lineTo(x - s * 0.42, y - s * 0.22);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = rgba(P.ink, 0.75); ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.42, y - s * 0.22); ctx.lineTo(x - s * 0.42, y - s * 0.42);
      ctx.lineTo(x + s * 0.42, y - s * 0.42); ctx.lineTo(x + s * 0.42, y - s * 0.22);
      for (let k = -3; k <= 3; k++) { ctx.moveTo(x + k * s * 0.12, y - s * 0.22); ctx.lineTo(x + k * s * 0.12, y - s * 0.42); }
      ctx.stroke();
    }

    function pine(it) {
      const { x, y, s, n } = it;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = rgba(P.ink, 0.88);
      ctx.lineWidth = Math.max(2, s * 0.07);
      ctx.beginPath();
      ctx.moveTo(x + s * 0.1, y);
      ctx.bezierCurveTo(x - s * 0.05, y - s * 0.35, x - s * 0.45, y - s * 0.45, x - s * 0.7, y - s * 0.9);
      ctx.stroke();
      const pads = [[-0.72, -0.92, 0.3], [-0.42, -0.6, 0.24], [-0.12, -0.38, 0.2], [-0.95, -0.68, 0.22], [-0.5, -1.08, 0.24], [-0.22, -0.82, 0.18], [-1.05, -1.02, 0.18]];
      for (let k = 0; k < Math.min(n, pads.length); k++) {
        const [px, py, pr] = pads[k];
        const X = x + px * s, Y = y + py * s, R = pr * s;
        ctx.fillStyle = rgba(P.ink, 0.72);
        ctx.beginPath(); ctx.ellipse(X, Y, R, R * 0.3, -0.12, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = rgba(P.ink, 0.55); ctx.lineWidth = 0.8;
        for (let j = -3; j <= 3; j++) {
          ctx.beginPath(); ctx.moveTo(X + j * R * 0.26, Y - R * 0.2); ctx.lineTo(X + j * R * 0.32, Y - R * 0.48); ctx.stroke();
        }
      }
      ctx.restore();
    }

    function danfang(it, t) {
      const { x, y, s, n } = it;
      // 小屋
      ctx.lineWidth = 1;
      ctx.fillStyle = rgba(P.paper, 1);
      ctx.strokeStyle = rgba(P.ink, 0.75);
      ctx.beginPath(); ctx.rect(x - s * 0.55, y - s * 0.55, s * 0.7, s * 0.5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = rgba(P.ink, 0.88);
      ctx.beginPath();
      ctx.moveTo(x - s * 0.78, y - s * 0.5);
      ctx.lineTo(x - s * 0.42, y - s * 0.88);
      ctx.lineTo(x + s * 0.06, y - s * 0.88);
      ctx.lineTo(x + s * 0.32, y - s * 0.5);
      ctx.closePath(); ctx.fill();
      // 丹炉：三足鼎，底下有火
      const fx = x + s * 0.48, fy = y;
      const f = 0.5 + 0.5 * Math.sin(t * 3.1);
      const g = ctx.createRadialGradient(fx, fy - s * 0.1, 0, fx, fy - s * 0.1, s * (0.45 + 0.08 * f));
      g.addColorStop(0, rgba(P.seal, 0.55 + 0.25 * f));
      g.addColorStop(1, rgba(P.seal, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(fx, fy - s * 0.1, s * 0.55, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = rgba(P.ink, 0.85); ctx.lineWidth = 1.2;
      for (const dx of [-0.16, 0, 0.16]) { ctx.beginPath(); ctx.moveTo(fx + dx * s, fy - s * 0.12); ctx.lineTo(fx + dx * s * 1.3, fy); ctx.stroke(); }
      ctx.fillStyle = rgba(P.gold, 0.9);
      ctx.beginPath(); ctx.ellipse(fx, fy - s * 0.24, s * 0.24, s * 0.16, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = rgba(P.ink, 0.7); ctx.stroke();
      ctx.fillStyle = rgba(P.ink, 0.8);
      ctx.fillRect(fx - s * 0.26, fy - s * 0.4, s * 0.52, s * 0.05);
      // 炉烟：等级越高，烟越多
      ctx.strokeStyle = rgba(P.ink, 0.18); ctx.lineWidth = 1.3;
      for (let k = 0; k < Math.min(3, n); k++) {
        ctx.beginPath();
        const sx = fx + (k - 1) * s * 0.1, sy = fy - s * 0.42;
        for (let j = 0; j <= 12; j++) {
          const yy = sy - j * s * 0.12;
          const xx = sx + Math.sin(t * 1.6 + j * 0.6 + k * 2) * s * 0.1 * (j / 12) + j * s * 0.02;
          if (j) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy);
        }
        ctx.stroke();
      }
    }

    function longtan(it, t) {
      const { x, y, rx, n } = it;
      const ry = rx * 0.36;
      ctx.fillStyle = rgba(P.water, 0.85);
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = rgba(P.ink, 0.22);
      ctx.beginPath(); ctx.ellipse(x, y + ry * 0.1, rx * 0.7, ry * 0.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = rgba(P.ink, 0.5); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
      // 龙：一条墨线绕着潭游，身子一起一伏
      const len = 0.9 + Math.min(4, n) * 0.12;
      const a0 = t * 0.5;
      const pts = [];
      for (let k = 0; k <= 24; k++) {
        const a = a0 - (k / 24) * len * Math.PI;
        const lift = Math.sin(k * 0.7 - t * 3) * ry * 0.35;
        pts.push([x + Math.cos(a) * rx * 0.62, y + Math.sin(a) * ry * 0.62 - ry * 0.25 + lift]);
      }
      ctx.save();
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let k = 0; k < pts.length - 1; k++) {
        ctx.strokeStyle = rgba(P.ink, 0.88);
        ctx.lineWidth = Math.max(1.2, rx * 0.075 * (1 - k / pts.length * 0.8));
        ctx.beginPath(); ctx.moveTo(pts[k][0], pts[k][1]); ctx.lineTo(pts[k + 1][0], pts[k + 1][1]); ctx.stroke();
      }
      const [hx, hy] = pts[0];
      ctx.fillStyle = rgba(P.ink, 0.92);
      ctx.beginPath(); ctx.ellipse(hx, hy, rx * 0.075, rx * 0.05, a0 + Math.PI / 2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = rgba(P.ink, 0.6); ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(hx, hy); ctx.quadraticCurveTo(hx + rx * 0.1, hy - rx * 0.08, hx + rx * 0.16, hy - rx * 0.02);
      ctx.moveTo(hx, hy); ctx.quadraticCurveTo(hx - rx * 0.06, hy - rx * 0.1, hx - rx * 0.1, hy - rx * 0.14);
      ctx.stroke();
      ctx.fillStyle = rgba(P.gold, 0.95);
      ctx.beginPath(); ctx.arc(hx + rx * 0.02, hy - rx * 0.01, Math.max(1, rx * 0.012), 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    function qionglou(it, t) {
      const { x, y, s, n } = it;
      // 仙气：楼后一圈淡淡的金光
      const glow = ctx.createRadialGradient(x, y - s * n * 0.5, 0, x, y - s * n * 0.5, s * (1.2 + n * 0.35));
      glow.addColorStop(0, rgba(P.gold, 0.18 + 0.05 * Math.sin(t * 1.3)));
      glow.addColorStop(1, rgba(P.gold, 0));
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(x, y - s * n * 0.5, s * (1.2 + n * 0.35), 0, Math.PI * 2); ctx.fill();
      let base = y;
      for (let k = 0; k < n; k++) {
        const w = s * (0.9 - k * 0.1), hh = s * 0.42;
        ctx.fillStyle = rgba(P.paper, 1);
        ctx.strokeStyle = rgba(P.ink, 0.75); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.rect(x - w * 0.36, base - hh, w * 0.72, hh); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = rgba(P.ink, 0.45);
        for (const dx of [-0.18, 0, 0.18]) { ctx.beginPath(); ctx.moveTo(x + dx * w, base - hh * 0.15); ctx.lineTo(x + dx * w, base - hh * 0.8); ctx.stroke(); }
        // 翘起的檐角
        const ey = base - hh;
        ctx.fillStyle = rgba(P.ink, 0.9);
        ctx.beginPath();
        ctx.moveTo(x - w * 0.62, ey - s * 0.08);
        ctx.quadraticCurveTo(x - w * 0.42, ey + s * 0.02, x - w * 0.3, ey - s * 0.12);
        ctx.lineTo(x + w * 0.3, ey - s * 0.12);
        ctx.quadraticCurveTo(x + w * 0.42, ey + s * 0.02, x + w * 0.62, ey - s * 0.08);
        ctx.quadraticCurveTo(x, ey - s * 0.02, x - w * 0.62, ey - s * 0.08);
        ctx.fill();
        ctx.strokeStyle = rgba(P.gold, 0.85); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(x - w * 0.6, ey - s * 0.085); ctx.quadraticCurveTo(x, ey - s * 0.03, x + w * 0.6, ey - s * 0.085); ctx.stroke();
        base = ey - s * 0.1;
      }
      // 楼顶的宝珠
      ctx.strokeStyle = rgba(P.ink, 0.85); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x, base - s * 0.22); ctx.stroke();
      ctx.fillStyle = rgba(P.gold, 0.95);
      ctx.beginPath(); ctx.arc(x, base - s * 0.25, Math.max(1.5, s * 0.05), 0, Math.PI * 2); ctx.fill();
    }

    function cranes(t) {
      const n = Math.min(5, L('crane'));
      for (let i = 0; i < n; i++) {
        const s = W * 0.018;
        const span = W + 80;
        const x = ((t * (14 + i * 3) + i * span / n) % span) - 40;
        const y = H * (0.2 + 0.045 * i) + Math.sin(t * 0.7 + i * 2) * 6;
        const flap = Math.sin(t * 5 + i * 1.3);
        ctx.strokeStyle = rgba(P.ink, 0.85);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x - s * 1.1, y + s * 0.1); ctx.lineTo(x + s * 1.2, y - s * 0.05);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x - s * 0.4, y - s * (0.3 + flap * 0.8), x - s * 0.9, y - s * (0.2 + flap * 1.2));
        ctx.moveTo(x + s * 0.1, y);
        ctx.quadraticCurveTo(x + s * 0.3, y - s * (0.3 + flap * 0.7), x + s * 0.7, y - s * (0.2 + flap * 1.1));
        ctx.stroke();
        ctx.fillStyle = rgba(P.seal, 0.95);
        ctx.beginPath(); ctx.arc(x + s * 1.25, y - s * 0.08, Math.max(1, s * 0.16), 0, Math.PI * 2); ctx.fill();
      }
    }

    function draw(t) {
      if (!W && !resize()) return;
      if (!P) palette();
      if (!layout) build();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = rgba(P.paper, 1);
      ctx.fillRect(0, 0, W, H);
      if (!texture) paperTexture();
      ctx.fillStyle = texture;
      ctx.fillRect(0, 0, W, H);
      const v = ctx.createRadialGradient(W / 2, H * 0.55, W * 0.3, W / 2, H * 0.55, W * 0.85);
      v.addColorStop(0, rgba(P.ink, 0));
      v.addColorStop(1, rgba(P.ink, 0.07));
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, W, H);

      moon();
      mountains();
      drawClouds(t, true);
      cranes(t);
      island();
      waterfall(t);
      sprouts();
      for (const it of layout.items) {
        if (it.k === 'pond') pond(it, t);
        else if (it.k === 'longtan') longtan(it, t);
      }
      for (const it of layout.items) {
        if (it.k === 'tree') tree(it, t);
        else if (it.k === 'house') house(it, t);
        else if (it.k === 'pavilion') pavilion(it);
        else if (it.k === 'terrace') terrace(it);
        else if (it.k === 'pine') pine(it);
        else if (it.k === 'danfang') danfang(it, t);
        else if (it.k === 'qionglou') qionglou(it, t);
      }
      drawClouds(t, false);
      titleAndSeal();
    }

    return { draw, resize, setLevels, palette };
  };
})(typeof window !== 'undefined' ? window : globalThis);
