// 第二批绝技画面（#20 的十二只猫）：每个都围绕该猫的设定，软萌、不血腥。
import type { Actor } from './actor';
import type { SkillFx } from './skills';
import { clamp, ease, hexA, lerp, mulberry } from './util';

const FONT = '"ZCOOL KuaiLe","Noto Sans SC","WenQuanYi Zen Hei",sans-serif';
/** 镜头聚焦，限制在背景范围内，避免露出黑边 */
function focus(c: Parameters<SkillFx>[0], x: number, y: number, z: number, d: number) {
  const hw = 480 / z, hh = 300 / z;
  c.scene.focus(clamp(x, hw, 960 - hw), clamp(y, hh, 600 - hh), z, d);
}
const rndOf = (seed: number) => mulberry(seed);

function pawPrint(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.beginPath(); ctx.ellipse(0, 4, 9, 7, 0, 0, 6.3); ctx.fill();
  for (const [dx, dy] of [[-10, -6], [-4, -12], [4, -12], [10, -6]]) { ctx.beginPath(); ctx.ellipse(dx, dy, 3.6, 4.6, 0, 0, 6.3); ctx.fill(); }
  ctx.restore();
}
function yarnBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, col: string, spin: number) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(spin);
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#fff'); g.addColorStop(0.25, col); g.addColorStop(1, hexA('#000000', 0.35));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.3); ctx.fill();
  ctx.strokeStyle = hexA('#ffffff', 0.7); ctx.lineWidth = 2;
  for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.ellipse(0, 0, r * 0.95, r * (0.3 + Math.abs(i) * 0.1), i * 0.5, 0.2, 2.9); ctx.stroke(); }
  ctx.restore();
}

// 软萌虎形兽影：渐变身体 + 条纹 + 跑动的四条腿
function drawTiger(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number, t: number, alpha: number) {
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1); ctx.globalAlpha = alpha; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const out = '#6e3410';
  const run = Math.sin(t * 22);
  // 尾
  ctx.strokeStyle = out; ctx.lineWidth = 15; ctx.beginPath(); ctx.moveTo(-46, -4); ctx.quadraticCurveTo(-92, -18 + run * 8, -84, -58); ctx.stroke();
  ctx.strokeStyle = '#ffa23a'; ctx.lineWidth = 9; ctx.stroke();
  // 腿
  ctx.lineWidth = 15;
  for (const [lx, ph] of [[-34, 0], [-18, 2], [28, 1], [44, 3]] as [number, number][]) {
    const sw = Math.sin(t * 22 + ph * 1.6) * 16;
    ctx.strokeStyle = out; ctx.beginPath(); ctx.moveTo(lx, 10); ctx.lineTo(lx + sw, 38 - Math.max(0, -sw) * 0.4); ctx.stroke();
    ctx.strokeStyle = '#ffb454'; ctx.lineWidth = 9; ctx.stroke(); ctx.lineWidth = 15;
  }
  // 身体
  const g = ctx.createLinearGradient(0, -30, 0, 30); g.addColorStop(0, '#ffc060'); g.addColorStop(0.7, '#ff9a30'); g.addColorStop(1, '#fff0c8');
  ctx.fillStyle = g; ctx.strokeStyle = out; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(0, -4, 58, 30, 0, 0, 6.3); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = out; ctx.lineWidth = 5; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 20 - 4, -33); ctx.quadraticCurveTo(i * 20 + 2, -14, i * 20 - 2, -2); ctx.stroke(); }
  // 头
  ctx.fillStyle = '#ffae44'; ctx.strokeStyle = out; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(50, -40); ctx.lineTo(56, -64); ctx.lineTo(70, -46); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(78, -44); ctx.lineTo(90, -64); ctx.lineTo(96, -38); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(74, -26, 30, 25, 0, 0, 6.3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff0d0'; ctx.beginPath(); ctx.ellipse(84, -18, 14, 10, 0, 0, 6.3); ctx.fill();
  ctx.fillStyle = '#2b1d22'; ctx.beginPath(); ctx.ellipse(70, -32, 4, 5.5, 0, 0, 6.3); ctx.fill(); ctx.beginPath(); ctx.ellipse(88, -32, 4, 5.5, 0, 0, 6.3); ctx.fill();
  ctx.fillStyle = '#e0707a'; ctx.beginPath(); ctx.moveTo(80, -22); ctx.lineTo(88, -22); ctx.lineTo(84, -17); ctx.fill();
  ctx.strokeStyle = out; ctx.lineWidth = 3; for (const yy of [-48, -44]) { ctx.beginPath(); ctx.moveTo(72 + (yy + 48) * 2, yy); ctx.lineTo(76 + (yy + 48) * 2, yy + 10); ctx.stroke(); }
  ctx.restore();
}

const fade = (p: number, a = 0.15, b = 0.8) => (p < a ? p / a : p > b ? (1 - p) / (1 - b) : 1);
const shieldBubble = (c: Parameters<SkillFx>[0], a: Actor, color: string, life = 1.4, delay = 0) => {
  const [x, y] = a.anchor('chest');
  c.vfx.custom(life, (ctx, p) => {
    const q = clamp((p - delay) / (1 - delay)); if (q <= 0) return;
    const r = 70 * ease.outCubic(clamp(q * 3)) ;
    ctx.save(); ctx.globalAlpha = fade(q, 0.2, 0.7) * 0.85;
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, hexA('#ffffff', 0.45)); g.addColorStop(0.75, hexA(color, 0.2)); g.addColorStop(1, hexA(color, 0.7));
    ctx.fillStyle = g; ctx.strokeStyle = hexA('#ffffff', 0.9); ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(x, y, r * 0.85, r, 0, 0, 6.3); ctx.fill(); ctx.stroke(); ctx.restore();
  }, 'front');
};

// 夏侯墩「拔矢啖睛」：眼罩一闪，毛线球追着滚去，肉垫光点回流。
const yarnResolve: SkillFx = async (c) => {
  const k = c.caster; const [tx, ty] = c.targets[0].anchor('chest');
  focus(c, lerp(k.x, tx, 0.5), 340, 1.12, 0.35);
  c.pose('windup', 0.2); c.glow(k, '#7fc3ff');
  const [hx, hy] = k.anchor('head');
  await c.sleep(0.2);
  c.vfx.custom(0.5, (ctx, p) => { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - p; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
    const r = 8 + p * 40; ctx.beginPath(); ctx.moveTo(hx - r, hy); ctx.lineTo(hx + r, hy); ctx.moveTo(hx, hy - r); ctx.lineTo(hx, hy + r); ctx.stroke(); ctx.restore(); }, 'front');
  await c.pose('castFwd', 0.12);
  const [sx, sy] = k.anchor('hand');
  await c.vfx.projectile(sx, sy, tx, ty, { speed: 1500, arc: 40, draw: (ctx, x, y, _a, t) => yarnBall(ctx, x, y, 20, '#ff8fb0', t * 18), trail: { color: '#ffb6ca', shape: 'dot', size: [3, 6], n: 3 } });
  c.scene.shake(10, 0.25); c.scene.flash('#fff', 0.3);
  c.vfx.ring(tx, ty, { r1: 100, color: '#7fc3ff' });
  c.vfx.custom(0.9, (ctx, p) => { ctx.save(); ctx.globalAlpha = 1 - p; ctx.fillStyle = '#ffd7e2'; for (let i = 0; i < 5; i++) pawPrint(ctx, tx - 80 + i * 40, ty + 60 - Math.sin(i * 1.3) * 30 - p * 30, 0.8, i * 0.4 - 0.6); ctx.restore(); }, 'front');
  c.hit();
  for (let i = 0; i < 3; i++) { c.vfx.burst({ x: tx, y: ty, n: 8, speed: [120, 260], angle: Math.atan2(hy - ty, hx - tx), spread: 0.7, life: [0.4, 0.7], size: [4, 7], color: ['#ffd7e2', '#ffe9a0'], shape: 'glow', gravity: 0 }); await c.sleep(0.08); }
  c.uplift([k], ['#ffd7e2', '#fff'], 'glow', 10);
  await c.sleep(0.6);
};

// 许虎痴「虎头吼」：虎头帽放大成柔软声浪，鱼骨圈蓝色毛盾展开。
const tigerHoodRoar: SkillFx = async (c) => {
  const k = c.caster; const [hx, hy] = k.anchor('head');
  focus(c, k.x + c.dir * 80, 340, 1.14, 0.3);
  c.pose('windup', 0.2); c.glow(k, '#7fb8ff');
  await c.sleep(0.2); c.pose('cast', 0.1);
  c.vfx.custom(1.3, (ctx, p) => {
    ctx.save(); ctx.translate(hx, hy - 30); ctx.scale(1 + p * 0.5, 1 + p * 0.5); ctx.globalAlpha = (1 - ease.in(p)) * 0.9;
    ctx.fillStyle = '#ffd24a'; ctx.strokeStyle = '#7a4a10'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(0, 0, 50, 0, 6.3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7a4a10'; ctx.fillRect(-26, -22, 12, 6); ctx.fillRect(14, -22, 12, 6); ctx.fillRect(-4, -32, 8, 12);
    ctx.beginPath(); ctx.moveTo(-14, 6); ctx.lineTo(14, 6); ctx.lineTo(0, 18); ctx.fill(); ctx.restore(); }, 'front');
  for (let i = 0; i < 4; i++) {
    c.vfx.custom(0.9, (ctx, p) => { ctx.save(); ctx.globalAlpha = (1 - p) * 0.7; ctx.strokeStyle = '#bfe0ff'; ctx.lineWidth = 12 * (1 - p) + 3;
      ctx.beginPath(); ctx.arc(hx, hy, 30 + p * 360, c.dir > 0 ? -0.8 : Math.PI - 0.8, c.dir > 0 ? 0.8 : Math.PI + 0.8); ctx.stroke(); ctx.restore(); });
    await c.sleep(0.11);
  }
  c.scene.shake(10, 0.5);
  for (const a of c.allies) shieldBubble(c, a, '#7fb8ff', 1.6);
  for (const a of c.allies) {
    const [x, y] = a.anchor('chest');
    c.vfx.custom(1.6, (ctx, p, t) => { ctx.save(); ctx.globalAlpha = fade(p, 0.15, 0.75) * 0.9; ctx.strokeStyle = '#eaf4ff'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) { const ang = t * 1.5 + (i / 6) * 6.283; const bx = x + Math.cos(ang) * 62, by = y + Math.sin(ang) * 72;
        ctx.beginPath(); ctx.moveTo(bx - 7, by - 3); ctx.lineTo(bx + 7, by + 3); ctx.moveTo(bx - 7, by + 3); ctx.lineTo(bx - 4, by); ctx.moveTo(bx + 7, by - 3); ctx.lineTo(bx + 4, by); ctx.stroke(); } ctx.restore(); }, 'front');
  }
  c.hit(); await c.sleep(0.9);
};

// 郭嘉喵「别急，锦囊」：葫芦奶光洒开，小鱼干轻轻唤醒睡猫。
const partingPouch: SkillFx = async (c) => {
  const k = c.caster; const mine = c.allies; const [cx] = c.center(mine);
  focus(c, cx, 340, 1.08, 0.4);
  c.pose('cast', 0.25); c.glow(k, '#fff3d6');
  await c.sleep(0.3);
  const [sx, sy] = k.anchor('hand');
  c.vfx.custom(1.8, (ctx, p, t) => {
    const a = fade(p, 0.15, 0.7) * 0.55;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) { const x = sx + (i - 2.5) * 70 * ease.outCubic(clamp(p * 2)); const y = sy - 20 + Math.sin(t * 2 + i) * 14;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 70); g.addColorStop(0, hexA('#fff6e0', a)); g.addColorStop(1, hexA('#fff6e0', 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 70, 0, 6.3); ctx.fill(); }
    ctx.restore(); });
  for (const a of mine) {
    const [x, y] = a.anchor('top');
    c.vfx.custom(1.4, (ctx, p) => { const q = ease.outCubic(clamp(p * 1.2)); const px = lerp(sx, x, q), py = lerp(sy, y - 30, q) - Math.sin(q * Math.PI) * 60;
      ctx.save(); ctx.globalAlpha = fade(p, 0.1, 0.8); ctx.translate(px, py); ctx.rotate(q * 5);
      ctx.fillStyle = '#fff6e0'; ctx.strokeStyle = '#a07a40'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, 14, 7, 0, 0, 6.3); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-22, -6); ctx.lineTo(-22, 6); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }, 'front');
    await c.sleep(0.06);
  }
  await c.sleep(0.5);
  c.scene.flash('#fff6e0', 0.35); c.hit();
  for (const a of mine) c.vfx.custom(1.0, (ctx, p) => { const [x, y] = a.anchor('top'); ctx.save(); ctx.globalAlpha = 1 - p; ctx.fillStyle = '#ffe07a'; ctx.font = `900 22px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('Zzz→!', x, y - 10 - p * 30); ctx.restore(); }, 'front');
  c.uplift(mine, ['#fff6e0', '#ffd7a0'], 'star', 8);
  await c.sleep(0.8);
};

// 孙小霸「踏浪横扫」：冲进前排，长剑带翻水碗，水浪横扫过去，爪印浪花四溅。
const tideSweep: SkillFx = async (c) => {
  const k = c.caster; const foes = c.targets; const [ex, ey] = c.center(foes);
  focus(c, lerp(k.x, ex, 0.6), 350, 1.15, 0.35);
  c.pose('windup', 0.18); c.glow(k, '#6fd2ff');
  await c.sleep(0.2);
  await c.dashTo(foes[0], 90, 0.2);
  c.pose('strike', 0.08);
  const x0 = k.x, x1 = ex + c.dir * 150;
  for (let i = 0; i < 3; i++) {
    c.vfx.custom(0.8, (ctx, p, t) => {
      const head = ease.outCubic(clamp(p * 1.7));
      ctx.save(); ctx.lineCap = 'round'; ctx.globalAlpha = fade(p, 0.05, 0.55) * 0.9;
      for (const [col, w, dy] of [['#3fb0e8', 26 - i * 5, 0], ['#d8f6ff', 9, -6]] as [string, number, number][]) {
        ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
        for (let s2 = 0; s2 <= 40; s2++) { const u = (s2 / 40) * head; const x = lerp(x0, x1, u); const y = ey - 80 + i * 34 + dy + Math.sin(u * 14 - t * 12 + i) * 16 - Math.sin(u * Math.PI) * 24; if (s2) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
        ctx.stroke();
      }
      ctx.restore(); }, 'front');
    await c.sleep(0.08);
  }
  c.scene.shake(12, 0.35); c.scene.flash('#dff6ff', 0.4);
  for (const t of foes) { const [x, y] = t.anchor('foot'); c.vfx.burst({ x, y: y - 10, n: 18, speed: [80, 300], angle: -Math.PI / 2, spread: 1.3, life: [0.5, 0.9], size: [4, 9], color: ['#bff0ff', '#ffffff', '#58c4f0'], shape: 'dot', gravity: 520, radius: 30 }); }
  c.vfx.custom(1.1, (ctx, p) => { ctx.save(); ctx.globalAlpha = (1 - p) * 0.9; ctx.fillStyle = '#e8fbff'; for (const t of foes) { const [x, y] = t.anchor('foot'); pawPrint(ctx, x, y + 6, 0.9, 0.3); pawPrint(ctx, x + 40 * c.dir, y + 18, 0.8, -0.2); } ctx.restore(); }, 'back');
  c.hit();
  await c.sleep(0.5);
  await c.dashBack();
};

// 黄盖盖「降书与软毯」：老将把软毯分给同袍，空船上留下一点暖橙火光。
const surrenderBlanket: SkillFx = async (c) => {
  const k = c.caster; const mine = c.allies; const [cx, cy] = c.center(mine);
  focus(c, cx, 340, 1.08, 0.4);
  c.pose('cast', 0.25); c.glow(k, '#ffb067');
  await c.sleep(0.3);
  c.vfx.custom(1.8, (ctx, p, t) => {
    const w = ease.outCubic(clamp(p * 2)); const a = fade(p, 0.1, 0.75);
    ctx.save(); ctx.globalAlpha = a * 0.85; ctx.translate(cx, cy - 70 + (1 - w) * -60);
    const W = 340 * w, H = 120;
    const g = ctx.createLinearGradient(0, -H / 2, 0, H / 2); g.addColorStop(0, '#ffcf8a'); g.addColorStop(1, '#f08a4a');
    ctx.fillStyle = g; ctx.strokeStyle = '#a8501e'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-W / 2, 0);
    for (let i = 0; i <= 20; i++) { const x = -W / 2 + (W * i) / 20; ctx.lineTo(x, Math.sin(i * 0.9 + t * 3) * 10 - H / 2); }
    for (let i = 20; i >= 0; i--) { const x = -W / 2 + (W * i) / 20; ctx.lineTo(x, Math.sin(i * 0.9 + t * 3 + 1) * 10 + H / 2); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = hexA('#ffffff', 0.5); ctx.lineWidth = 3; ctx.setLineDash([10, 10]);
    ctx.beginPath(); ctx.moveTo(-W / 2 + 14, 0); ctx.lineTo(W / 2 - 14, 0); ctx.stroke(); ctx.restore(); }, 'front');
  for (const a of mine) shieldBubble(c, a, '#ffb067', 1.5, 0.25);
  for (let i = 0; i < 4; i++) { c.vfx.burst({ x: k.anchor('hand')[0], y: k.anchor('hand')[1], n: 8, speed: [30, 140], angle: -Math.PI / 2, spread: 1.4, life: [0.6, 1.2], size: [3, 6], color: ['#ffb067', '#ffe08a'], shape: 'ember', gravity: -80 }); await c.sleep(0.12); }
  c.scene.flash('#ffd7a0', 0.35); c.hit();
  c.uplift(mine, ['#ffb067', '#ffe08a'], 'star', 8);
  await c.sleep(0.9);
};

// 貂蝉喵「月下软绸」：两条软绸绕出逗猫棒的轮廓，薄荷光点让目标追错方向。
const moonRibbons: SkillFx = async (c) => {
  const k = c.caster; const tg = c.targets; const [ex, ey] = c.center(tg);
  focus(c, lerp(k.x, ex, 0.5), 340, 1.1, 0.4);
  c.pose('castUp', 0.25); c.glow(k, '#ff9ad0');
  c.vfx.custom(2.0, (ctx, p) => { const [mx, my] = [lerp(k.x, ex, 0.5), 110]; ctx.save(); ctx.globalAlpha = fade(p, 0.15, 0.8) * 0.9;
    const g = ctx.createRadialGradient(mx, my, 5, mx, my, 70); g.addColorStop(0, '#fffbe0'); g.addColorStop(1, hexA('#ffe9a0', 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mx, my, 70, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#fff6c8'; ctx.beginPath(); ctx.arc(mx, my, 34, 0, 6.3); ctx.fill(); ctx.fillStyle = '#1a1030'; ctx.beginPath(); ctx.arc(mx + 14, my - 6, 30, 0, 6.3); ctx.globalCompositeOperation = 'destination-out'; ctx.fill(); ctx.restore(); }, 'back');
  await c.sleep(0.4);
  const [sx, sy] = k.anchor('hand');
  for (let r = 0; r < 2; r++) {
    c.vfx.custom(1.5, (ctx, p, t) => {
      const q = ease.outCubic(clamp(p * 1.8)); ctx.save(); ctx.globalAlpha = fade(p, 0.1, 0.75); ctx.strokeStyle = r ? '#ffd0ea' : '#ff8cc6'; ctx.lineWidth = 9; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) { const u = (i / 40) * q; const x = lerp(sx, ex, u) + Math.sin(u * 9 + t * 4 + r * 3) * 36 * (1 - Math.abs(u - 0.5) * 1.4); const y = lerp(sy, ey, u) - Math.sin(u * Math.PI) * 90 + Math.cos(u * 8 + r * 3) * 22; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.stroke(); ctx.restore(); });
    await c.sleep(0.15);
  }
  await c.sleep(0.5);
  for (const t of tg) { const [x, y] = t.anchor('head'); c.vfx.burst({ x, y, n: 14, speed: [20, 120], angle: -Math.PI / 2, spread: 3, life: [0.7, 1.2], size: [4, 8], color: ['#b6ffb0', '#fff'], shape: 'leaf', gravity: -30, radius: 36 }); c.vfx.ring(x, y, { r1: 60, color: '#ff8cc6' }); }
  c.scene.flash('#ffd0ea', 0.3); c.hit(); await c.sleep(0.9);
};

// 董桌「开席」：饭桌轻轻转开，盘子原地打转，桌布围成厚实护盾。
const tableFeast: SkillFx = async (c) => {
  const k = c.caster; const mine = c.allies; const [cx, cy] = c.center(mine);
  focus(c, cx, 345, 1.08, 0.4);
  c.pose('cast', 0.25); c.glow(k, '#e0b070');
  await c.sleep(0.25);
  c.vfx.custom(2.0, (ctx, p, t) => { const w = ease.outBack ? ease.outBack(clamp(p * 2.5)) : ease.outCubic(clamp(p * 2.5)); ctx.save(); ctx.globalAlpha = fade(p, 0.1, 0.8);
    ctx.translate(cx, cy + 60); ctx.scale(1, 0.34); ctx.rotate(t * 0.8);
    ctx.fillStyle = '#c98a4a'; ctx.strokeStyle = '#6b3d14'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, 230 * w, 0, 6.3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff3d6'; ctx.beginPath(); ctx.arc(0, 0, 190 * w, 0, 6.3); ctx.fill();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283; ctx.save(); ctx.translate(Math.cos(a) * 140 * w, Math.sin(a) * 140 * w); ctx.rotate(-t * 2.4); ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#c9a070'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 26, 0, 6.3); ctx.fill(); ctx.stroke(); ctx.fillStyle = i % 2 ? '#ff9a6a' : '#9ad06a'; ctx.beginPath(); ctx.arc(0, 0, 11, 0, 6.3); ctx.fill(); ctx.restore(); }
    ctx.restore(); }, 'back');
  for (const a of mine) shieldBubble(c, a, '#ffd9a0', 1.6, 0.2);
  for (let i = 0; i < 3; i++) { c.uplift(mine, ['#ffe9b0', '#ff9a6a'], 'star', 4); await c.sleep(0.2); }
  c.scene.flash('#fff3d6', 0.3); c.hit(); await c.sleep(1.0);
};

// 木鹿大王「百兽鼓」：鼓面亮起图腾，虎形兽影按拍子奔出，留下草叶与小爪印。
const beastDrum: SkillFx = async (c) => {
  const k = c.caster; const foes = c.targets.length ? c.targets : c.foes; const [ex, ey] = c.center(foes);
  focus(c, lerp(k.x, ex, 0.5), 345, 1.1, 0.4);
  c.pose('windup', 0.18); c.glow(k, '#7fe08a');
  const [dx, dy] = k.anchor('chest');
  for (let i = 0; i < 4; i++) {
    c.vfx.custom(0.7, (ctx, p) => { ctx.save(); ctx.globalAlpha = (1 - p) * 0.9; ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 8 * (1 - p) + 2; ctx.beginPath(); ctx.ellipse(dx + c.dir * 40, dy + 20, 30 + p * 120, 14 + p * 52, 0, 0, 6.3); ctx.stroke(); ctx.restore(); }, 'front');
    c.scene.shake(5, 0.12); await c.sleep(0.15);
  }
  c.pose('castFwd', 0.1);
  const tigers = [0, 1, 2].map((i) => ({ y: ey + 20 + i * 36 - 36, d: i * 0.14 }));
  c.vfx.custom(1.4, (ctx, p, t) => {
    ctx.save();
    for (const tg of tigers) {
      const q = clamp((p - tg.d) / 0.6); if (q <= 0 || q >= 1.02) continue;
      const x = lerp(k.x, ex, ease.in(q)); const y = tg.y - Math.abs(Math.sin(q * 14)) * 22;
      drawTiger(ctx, x, y, c.dir, t, Math.min(1, (1 - q) * 3) * 0.95);
      if (Math.random() < 0.3) c.vfx.burst({ x: x - c.dir * 40, y: y + 26, n: 1, speed: [10, 40], life: [0.5, 0.9], size: [4, 7], color: '#8ae070', shape: 'leaf', gravity: 40 });
    }
    ctx.restore(); }, 'front');
  await c.sleep(0.85);
  c.scene.shake(14, 0.4); c.scene.flash('#fff0b8', 0.35);
  for (const t of foes) { const [x, y] = t.anchor('chest'); c.vfx.ring(x, y, { r1: 90, color: '#ffa23a' }); }
  c.vfx.custom(1.1, (ctx, p) => { ctx.save(); ctx.globalAlpha = (1 - p) * 0.9; ctx.fillStyle = '#6a8a3a'; for (const t of foes) { const [x, y] = t.anchor('foot'); pawPrint(ctx, x - 20, y + 4, 0.8, -0.3); pawPrint(ctx, x + 24, y + 16, 0.8, 0.3); } ctx.restore(); }, 'back');
  c.hit(); await c.sleep(0.8);
};

// 兀突骨「缩甲·藤窝」：藤窝慢慢合拢，暖色护盾与呼噜线绕在窝沿。
const rattanNest: SkillFx = async (c) => {
  const k = c.caster; const [x, y] = k.anchor('chest');
  focus(c, k.x, 350, 1.2, 0.4);
  c.pose('windup', 0.3); c.glow(k, '#b08a50');
  await c.sleep(0.3);
  c.vfx.custom(2.0, (ctx, p, t) => {
    const w = ease.outCubic(clamp(p * 2)); ctx.save(); ctx.globalAlpha = fade(p, 0.1, 0.8);
    ctx.lineCap = 'round';
    for (let i = 0; i < 10; i++) { const a0 = (i / 10) * 6.283 + t * 0.3; ctx.strokeStyle = i % 2 ? '#b98a4a' : '#8a5a2a'; ctx.lineWidth = 9;
      ctx.beginPath(); for (let s = 0; s <= 20; s++) { const u = s / 20; const ang = a0 + u * 2.4; const rr = (120 - 70 * w) * (0.7 + u * 0.3) + 12; const px = x + Math.cos(ang) * rr * 0.95; const py = y + Math.sin(ang) * rr * 1.1; if (s) ctx.lineTo(px, py); else ctx.moveTo(px, py); } ctx.stroke(); }
    ctx.strokeStyle = '#e0ffb0'; ctx.lineWidth = 3; for (let i = 0; i < 3; i++) { ctx.beginPath(); for (let s = 0; s <= 30; s++) { const ang = (s / 30) * 6.283; const rr = 100 + Math.sin(ang * 6 + t * 5 + i) * 6 + i * 8; const px = x + Math.cos(ang) * rr * 0.9; const py = y + Math.sin(ang) * rr; if (s) ctx.lineTo(px, py); else ctx.moveTo(px, py); } ctx.stroke(); }
    ctx.restore(); }, 'front');
  shieldBubble(c, k, '#ffd9a0', 1.8, 0.3);
  await c.sleep(0.9);
  c.uplift([k], ['#e0ffb0', '#ffe9b0'], 'leaf', 10); c.scene.flash('#fff3d6', 0.25); c.hit(); await c.sleep(0.9);
};

// 张爪「苍天已死」：黄巾扬起，符纸像小旗落进敌阵，毛线沿符边轻轻收拢。
const yellowHeaven: SkillFx = async (c) => {
  const k = c.caster; const tg = c.targets; const [ex, ey] = c.center(tg);
  focus(c, lerp(k.x, ex, 0.5), 335, 1.08, 0.4);
  c.pose('castUp', 0.25); c.glow(k, '#ffd24a');
  c.vfx.glyph(k.x, k.by, { r: 80, color: '#ffd24a', life: 1.4, points: 8 });
  await c.sleep(0.45);
  const rnd = rndOf(5);
  const sheets = Array.from({ length: 16 }, () => ({ x: ex + (rnd() - 0.5) * 340, y: ey + (rnd() - 0.5) * 140 + 30, d: rnd() * 0.5, rot: (rnd() - 0.5) * 0.9 }));
  c.vfx.custom(1.8, (ctx, p) => {
    ctx.save();
    for (const s of sheets) { const q = clamp((p - s.d * 0.5) / 0.45); if (q <= 0) continue; const yy = lerp(-60, s.y, ease.outCubic(q)); ctx.save(); ctx.translate(s.x, yy); ctx.rotate(s.rot + (1 - q) * 3); ctx.globalAlpha = fade(p, 0.05, 0.8);
      ctx.fillStyle = '#ffe36a'; ctx.strokeStyle = '#9a6a10'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.roundRect(-14, -22, 28, 44, 3); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#c43a2a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-6, -12); ctx.lineTo(6, -12); ctx.moveTo(0, -12); ctx.lineTo(0, 12); ctx.moveTo(-6, 4); ctx.lineTo(6, 8); ctx.stroke(); ctx.restore(); }
    ctx.restore(); }, 'front');
  await c.sleep(0.85);
  c.vfx.custom(1.0, (ctx, p) => { ctx.save(); ctx.globalAlpha = fade(p, 0.15, 0.7) * 0.9; ctx.strokeStyle = '#ff9ac0'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (const t of tg) { const [x, y] = t.anchor('chest'); ctx.beginPath(); ctx.ellipse(x, y, 60 * (1 - p * 0.5), 76 * (1 - p * 0.5), p * 3, 0, 5); ctx.stroke(); }
    ctx.restore(); }, 'front');
  c.scene.shake(8, 0.3); c.scene.flash('#fff0a0', 0.4); c.hit(); await c.sleep(0.9);
};

// 水镜喵「水镜观势」：水纹映出友猫轮廓，茶色光点落下，撑起透明薄盾。
const waterMirror: SkillFx = async (c) => {
  const k = c.caster; const mine = c.allies; const [cx, cy] = c.center(mine);
  focus(c, cx, 345, 1.08, 0.4);
  c.pose('cast', 0.25); c.glow(k, '#9fe8ff');
  await c.sleep(0.25);
  c.vfx.custom(2.0, (ctx, p, t) => { ctx.save(); ctx.globalAlpha = fade(p, 0.12, 0.75) * 0.8; ctx.translate(cx, cy + 62); ctx.scale(1, 0.3);
    const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 280); g.addColorStop(0, hexA('#e8fbff', 0.9)); g.addColorStop(1, hexA('#7fd0f0', 0.15)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 280 * ease.outCubic(clamp(p * 2)), 0, 6.3); ctx.fill();
    ctx.strokeStyle = hexA('#ffffff', 0.9); ctx.lineWidth = 4; for (let i = 0; i < 4; i++) { const r = ((t * 0.5 + i / 4) % 1) * 280; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.3); ctx.stroke(); } ctx.restore(); }, 'back');
  for (const a of mine) { const [x, y] = a.anchor('chest');
    c.vfx.custom(1.8, (ctx, p) => { ctx.save(); ctx.globalAlpha = fade(p, 0.15, 0.7) * 0.4; ctx.translate(x, y + 150); ctx.scale(1, -0.9); ctx.strokeStyle = '#d6f6ff'; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(0, 0, 30, 46, 0, 0, 6.3); ctx.stroke(); ctx.restore(); }, 'back'); }
  for (const a of mine) shieldBubble(c, a, '#9fe8ff', 1.7, 0.2);
  for (let i = 0; i < 4; i++) { for (const a of mine) { const [x, y] = a.anchor('top'); c.vfx.burst({ x, y: y - 30, n: 3, speed: [10, 40], angle: Math.PI / 2, spread: 0.6, life: [0.8, 1.3], size: [3, 6], color: ['#e8c890', '#fff0d0'], shape: 'dot', gravity: 60, radius: 30 }); } await c.sleep(0.15); }
  c.scene.flash('#e8fbff', 0.3); c.hit(); await c.sleep(0.9);
};

// 管辂喵「铜钱卦」：铜钱逐枚翻面，正面飞出卦纹、反面织成护盾，五枚正面串成小铜钱剑。
const coinDivination: SkillFx = async (c) => {
  const k = c.caster; const tg = c.targets.length ? c.targets : c.foes; const [ex, ey] = c.center(tg); const [sx, sy] = k.anchor('hand');
  focus(c, lerp(k.x, ex, 0.45), 335, 1.08, 0.4);
  c.pose('castUp', 0.25); c.glow(k, '#ffd24a');
  await c.sleep(0.3);
  const COINS = 5;
  c.vfx.custom(2.0, (ctx, p) => {
    ctx.save();
    for (let i = 0; i < COINS; i++) {
      const d = i * 0.1; const q = clamp((p - d) / 0.55); if (q <= 0) continue;
      const x = lerp(sx, sx + c.dir * (60 + i * 38), ease.outCubic(q)); const y = sy - 10 - Math.sin(q * Math.PI) * 95;
      const flipW = Math.abs(Math.cos(q * Math.PI * 5)); const heads = Math.cos(q * Math.PI * 5) > 0;
      const out = clamp((p - 0.6 - i * 0.04) / 0.3); const px = lerp(x, ex, ease.in(out)), py = lerp(y, ey, ease.in(out));
      ctx.globalAlpha = out >= 1 ? 0 : 1; ctx.save(); ctx.translate(px, py); ctx.scale(Math.max(0.12, flipW), 1);
      ctx.fillStyle = heads ? '#ffd24a' : '#d9a23a'; ctx.strokeStyle = '#8a5a10'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 26, 0, 6.3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#6a3a08'; ctx.fillRect(-8, -8, 16, 16); if (heads) { ctx.fillStyle = '#fff3b0'; ctx.fillRect(-4, -4, 8, 8); }
      ctx.restore();
    }
    ctx.restore(); }, 'front');
  await c.sleep(0.8);
  // 卦纹（正面）与护盾（反面）
  c.vfx.custom(1.2, (ctx, p) => { ctx.save(); ctx.globalAlpha = fade(p, 0.1, 0.7); ctx.fillStyle = '#ffe08a'; ctx.font = `900 54px ${FONT}`; ctx.textAlign = 'center'; ctx.strokeStyle = '#7a4a10'; ctx.lineWidth = 8;
    const g = ['☰', '☷', '☵', '☲']; for (let i = 0; i < 4; i++) { const x = ex - 120 + i * 80; const y = 120 + Math.sin(p * 6 + i) * 8 - p * 20; ctx.strokeText(g[i], x, y); ctx.fillText(g[i], x, y); } ctx.restore(); }, 'front');
  for (const a of c.allies) shieldBubble(c, a, '#ffd24a', 1.4, 0.1);
  c.scene.shake(8, 0.3); c.scene.flash('#fff3b0', 0.4);
  for (const t of tg) { const [x, y] = t.anchor('chest'); c.vfx.ring(x, y, { r1: 80, color: '#ffd24a' }); c.vfx.burst({ x, y, n: 12, speed: [100, 260], life: [0.4, 0.8], size: [4, 8], color: ['#ffd24a', '#fff'], shape: 'coin', gravity: 400 }); }
  c.hit(); await c.sleep(0.9);
};

export const SKILL_FX2: Record<string, SkillFx> = {
  'ult.yarnResolve': yarnResolve,
  'ult.tigerHoodRoar': tigerHoodRoar,
  'ult.partingPouch': partingPouch,
  'ult.tideSweep': tideSweep,
  'ult.surrenderBlanket': surrenderBlanket,
  'ult.moonRibbons': moonRibbons,
  'ult.tableFeast': tableFeast,
  'ult.beastDrum': beastDrum,
  'ult.rattanNest': rattanNest,
  'ult.yellowHeaven': yellowHeaven,
  'ult.waterMirror': waterMirror,
  'ult.coinDivination': coinDivination,
};
