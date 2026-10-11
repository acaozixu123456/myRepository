// 至尊 SP 的三段绝技画面：镜头更大、层次更多、金光更足。软萌不血腥。
import type { Actor } from './actor';
import type { SkillFx } from './skills';
import { clamp, ease, hexA, lerp, mulberry } from './util';

const FONT = '"ZCOOL KuaiLe","Noto Sans SC","WenQuanYi Zen Hei",sans-serif';
const fade = (p: number, a = 0.15, b = 0.8) => (p < a ? p / a : p > b ? (1 - p) / (1 - b) : 1);
function focus(c: Parameters<SkillFx>[0], x: number, y: number, z: number, d: number) {
  const hw = 480 / z, hh = 300 / z;
  c.scene.focus(clamp(x, hw, 960 - hw), clamp(y, hh, 600 - hh), z, d);
}
function star4(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.beginPath();
  for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * 0.22 : r; const a = (i / 8) * Math.PI * 2; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill(); ctx.restore();
}
function bubble(c: Parameters<SkillFx>[0], a: Actor, color: string, life = 1.6, delay = 0) {
  const [x, y] = a.anchor('chest');
  c.vfx.custom(life, (ctx, p) => {
    const q = clamp((p - delay) / (1 - delay)); if (q <= 0) return;
    const r = 72 * ease.outCubic(clamp(q * 3));
    ctx.save(); ctx.globalAlpha = fade(q, 0.2, 0.7) * 0.9;
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, hexA('#ffffff', 0.5)); g.addColorStop(0.75, hexA(color, 0.2)); g.addColorStop(1, hexA(color, 0.75));
    ctx.fillStyle = g; ctx.strokeStyle = hexA('#ffffff', 0.95); ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(x, y, r * 0.82, r, 0, 0, 6.3); ctx.fill(); ctx.stroke(); ctx.restore();
  }, 'front');
}

// ───────────────────────── 司马喵懿「冢虎出笼」─────────────────────────
// 夜空里先睁开一双金色竖瞳（狼顾），金锁链从瞳中垂下缠住敌阵，地面裂开，一只墨紫金纹的巨虎从冢中咆哮而出。
function tigerHead(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, open: number) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const g = ctx.createRadialGradient(0, -20, 10, 0, 0, 150);
  g.addColorStop(0, '#6a4c9a'); g.addColorStop(0.7, '#2e2050'); g.addColorStop(1, '#150e2a');
  // 耳
  ctx.fillStyle = '#2a1c48'; ctx.strokeStyle = '#ffd86a'; ctx.lineWidth = 5;
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * 70, -92); ctx.lineTo(sx * 118, -150); ctx.lineTo(sx * 134, -70); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  // 头
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -30, 128, 112, 0, 0, 6.3); ctx.fill(); ctx.stroke();
  // 金纹
  ctx.strokeStyle = '#ffd86a'; ctx.lineWidth = 7;
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(sx * (96 + i * 8), -100 + i * 22); ctx.quadraticCurveTo(sx * (60 + i * 6), -86 + i * 22, sx * (40 + i * 4), -60 + i * 22); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(0, -140); ctx.lineTo(0, -96); ctx.moveTo(-14, -128); ctx.lineTo(14, -128); ctx.moveTo(-10, -112); ctx.lineTo(10, -112); ctx.stroke();
  // 口鼻
  ctx.fillStyle = '#f4e8ff'; ctx.strokeStyle = '#1a1030'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.ellipse(0, 18, 62, 40, 0, 0, 6.3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ff9ab0'; ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(12, 0); ctx.lineTo(0, 14); ctx.closePath(); ctx.fill();
  // 张嘴
  const mh = 8 + open * 54;
  ctx.fillStyle = '#5a1230'; ctx.beginPath(); ctx.moveTo(-40, 30); ctx.quadraticCurveTo(0, 30 + mh * 1.7, 40, 30); ctx.quadraticCurveTo(0, 30 + mh * 0.5, -40, 30); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * 30, 31); ctx.lineTo(sx * 24, 31 + 14 + open * 8); ctx.lineTo(sx * 16, 32); ctx.fill(); }
  // 金色竖瞳
  const pulse = 0.7 + Math.sin(t * 14) * 0.3;
  for (const sx of [-1, 1]) {
    ctx.save(); ctx.translate(sx * 52, -48); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = hexA('#ffd24a', 0.5 * pulse); ctx.beginPath(); ctx.arc(0, 0, 30, 0, 6.3); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#ffe27a'; ctx.strokeStyle = '#1a1030'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(sx * 52, -48, 20, 15, sx * -0.35, 0, 6.3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#1a1030'; ctx.beginPath(); ctx.ellipse(sx * 52, -48, 4.5, 14, 0, 0, 6.3); ctx.fill();
  }
  ctx.restore();
}

const tigerTomb: SkillFx = async (c) => {
  const k = c.caster; const tg = c.targets.length ? c.targets : c.foes; const [ex, ey] = c.center(tg);
  c.dim(0.45, 0.3); void c.tint('#2a1450', 0.38, 0.4);
  focus(c, lerp(k.x, ex, 0.5), 330, 1.1, 0.5);
  c.pose('castUp', 0.3); c.glow(k, '#ffd24a');
  c.vfx.glyph(k.x, k.by, { r: 96, color: '#ffd86a', life: 1.8, points: 8 });
  c.vfx.glyph(k.x, k.by, { r: 64, color: '#b99aff', life: 1.8, points: 6, spin: -2 });
  // ① 夜空睁眼：一双巨大的金色竖瞳（狼顾）
  c.vfx.custom(1.5, (ctx, p, t) => {
    const a = fade(p, 0.2, 0.7); const open = ease.outCubic(clamp(p * 3));
    ctx.save(); ctx.globalAlpha = a * 0.95; ctx.globalCompositeOperation = 'lighter';
    for (const sx of [-1, 1]) {
      const x = ex + sx * 120, y = 120 + Math.sin(t * 2) * 4;
      const g = ctx.createRadialGradient(x, y, 6, x, y, 120); g.addColorStop(0, hexA('#fff2a8', 0.95)); g.addColorStop(0.35, hexA('#ffc83a', 0.55)); g.addColorStop(1, hexA('#ffc83a', 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 120, 0, 6.3); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const sx of [-1, 1]) {
      const x = ex + sx * 120, y = 120;
      ctx.fillStyle = '#ffe27a'; ctx.strokeStyle = '#2a1450'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(x, y, 62, 40 * open + 2, sx * -0.3, 0, 6.3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#1a0e30'; ctx.beginPath(); ctx.ellipse(x - sx * 8, y, 9, 36 * open + 1, 0, 0, 6.3); ctx.fill();
    }
    ctx.restore();
  }, 'back');
  await c.sleep(0.55);
  // ② 金锁链从瞳中垂下，缠向每一只敌人
  for (const t of tg) {
    const [tx, ty] = t.anchor('chest');
    c.vfx.custom(1.2, (ctx, p) => {
      const q = ease.outCubic(clamp(p * 2.2)); ctx.save(); ctx.globalAlpha = fade(p, 0.1, 0.75); ctx.lineWidth = 6; ctx.strokeStyle = '#ffd86a'; ctx.fillStyle = '#fff3b0';
      const n = 12; for (let i = 0; i < n; i++) { const u = (i / (n - 1)) * q; const x = lerp(ex, tx, u) + Math.sin(u * 6 + p * 5) * 22 * (1 - u); const y = lerp(60, ty, u); ctx.save(); ctx.translate(x, y); ctx.rotate(i % 2 ? 0.5 : -0.5); ctx.beginPath(); ctx.ellipse(0, 0, 11, 6, 0, 0, 6.3); ctx.stroke(); ctx.restore(); }
      ctx.globalCompositeOperation = 'lighter'; ctx.beginPath(); ctx.arc(lerp(ex, tx, q), lerp(60, ty, q), 12, 0, 6.3); ctx.fill(); ctx.restore();
    }, 'front');
  }
  await c.sleep(0.5);
  // ③ 地面裂开，金色裂纹放射
  const rnd = mulberry(11);
  const cracks = Array.from({ length: 14 }, (_, i) => ({ a: (i / 14) * 6.28 + rnd() * 0.3, len: 110 + rnd() * 200, w: 3 + rnd() * 3 }));
  c.vfx.custom(1.5, (ctx, p) => {
    ctx.save(); ctx.translate(ex, ey + 50); ctx.scale(1, 0.4);
    const q = ease.outCubic(clamp(p * 2.5)); ctx.globalAlpha = fade(p, 0.05, 0.75);
    const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 260 * q); g.addColorStop(0, hexA('#120a22', 0.95)); g.addColorStop(1, hexA('#120a22', 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 260 * q, 0, 6.3); ctx.fill();
    ctx.strokeStyle = '#ffd86a'; ctx.lineCap = 'round';
    for (const cr of cracks) { ctx.lineWidth = cr.w; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(cr.a) * cr.len * q * 0.5 + 12, Math.sin(cr.a) * cr.len * q * 0.5); ctx.lineTo(Math.cos(cr.a + 0.2) * cr.len * q, Math.sin(cr.a + 0.2) * cr.len * q); ctx.stroke(); }
    ctx.restore();
  }, 'back');
  c.scene.shake(7, 0.4); await c.sleep(0.35);
  // ④ 巨虎出笼（在敌阵身后升起，虎吼时前扑）
  c.vfx.custom(1.5, (ctx, p, t) => {
    const rise = ease.outBack(clamp(p / 0.35)); const open = ease.outCubic(clamp((p - 0.3) / 0.25));
    ctx.save(); ctx.globalAlpha = fade(p, 0.05, 0.75) * 0.96;
    const sc = lerp(0.3, 1.45, rise) + Math.sin(p * 30) * 0.015 * open;
    tigerHead(ctx, ex, lerp(ey + 260, ey - 20, rise), sc, t, open); ctx.restore();
  }, 'back');
  c.vfx.burst({ x: ex, y: ey + 30, n: 46, speed: [120, 460], angle: -Math.PI / 2, spread: 2.4, life: [0.6, 1.4], size: [3, 8], color: ['#ffd86a', '#b99aff', '#fff3b0'], shape: 'star', gravity: 160, drag: 0.97, radius: 60 });
  await c.sleep(0.4);
  c.pose('strike', 0.1);
  // ⑤ 咆哮：冲击波扫过全场
  c.vfx.ring(ex, ey, { r0: 20, r1: 520, life: 0.8, color: '#ffd86a', width: 12, squash: 0.45 });
  c.vfx.ring(ex, ey, { r0: 10, r1: 380, life: 0.7, color: '#b99aff', width: 8, squash: 0.45 });
  c.scene.shake(16, 0.6); c.scene.flash('#fff2b8', 0.75); c.hit();
  for (const t of tg) c.hitSpark(t, '#ffd86a', 16);
  await c.sleep(0.5);
  // ⑥ 友方金色护盾 + 金粉雨
  for (const a of c.allies) bubble(c, a, '#ffd86a', 1.6, 0.05);
  c.uplift(c.allies, ['#ffd86a', '#fff3b0'], 'star', 18);
  await c.sleep(0.9);
};

// ───────────────────────── 庞喵统「凤雏燎原」─────────────────────────
function phoenix(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, flap: number, dir: number, t: number) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s * dir, s); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.globalCompositeOperation = 'lighter'; const halo = ctx.createRadialGradient(0, 0, 20, 0, 0, 230); halo.addColorStop(0, 'rgba(255,170,50,.55)'); halo.addColorStop(1, 'rgba(255,90,20,0)'); ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(0, 0, 230, 0, 6.3); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
  // 尾羽：五根长长的弧线
  for (let i = 0; i < 5; i++) {
    const a = -0.5 + i * 0.25; const w = Math.sin(t * 6 + i) * 16;
    const g = ctx.createLinearGradient(-40, 0, -300, 0); g.addColorStop(0, hexA('#fff3b0', 1)); g.addColorStop(0.4, hexA('#ff8a2a', 0.95)); g.addColorStop(1, hexA('#d8242a', 0));
    ctx.strokeStyle = g; ctx.lineWidth = 16 - i * 1.5; ctx.beginPath(); ctx.moveTo(-40, 6);
    ctx.bezierCurveTo(-120, 40 * a * 4 + w, -200, 90 * a * 3 - w, -300, 120 * a * 3 + w * 0.5); ctx.stroke();
  }
  // 双翼：扇形羽片
  for (const sgn of [-1, 1]) {
    ctx.save(); ctx.translate(-6, -6); ctx.rotate(sgn * (-0.5 + flap * 0.9));
    for (let i = 0; i < 9; i++) {
      const ang = -Math.PI / 2 * sgn + sgn * (i * 0.17); const len = 150 - i * 6;
      const g = ctx.createLinearGradient(0, 0, Math.cos(ang) * len, Math.sin(ang) * len); g.addColorStop(0, hexA('#fff0a0', 0.9)); g.addColorStop(0.5, hexA('#ffa22a', 0.85)); g.addColorStop(1, hexA('#e0302a', 0.7));
      ctx.fillStyle = g; ctx.strokeStyle = '#8a1a10'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(Math.cos(ang - 0.14) * len * 0.7, Math.sin(ang - 0.14) * len * 0.7, Math.cos(ang) * len, Math.sin(ang) * len); ctx.quadraticCurveTo(Math.cos(ang + 0.14) * len * 0.7, Math.sin(ang + 0.14) * len * 0.7, 0, 0); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }
  // 身体 + 颈 + 头
  const bg = ctx.createRadialGradient(0, 0, 6, 0, 0, 56); bg.addColorStop(0, '#fffbe0'); bg.addColorStop(0.6, '#ffb83a'); bg.addColorStop(1, hexA('#e0402a', 0.6));
  ctx.fillStyle = bg; ctx.strokeStyle = '#8a1a10'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, 54, 32, -0.1, 0, 6.3); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(52, -26, 26, 22, 0, 0, 6.3); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#ffcf4a'; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(30, -6); ctx.quadraticCurveTo(50, -14, 50, -26); ctx.stroke();
  // 凤冠
  for (let i = 0; i < 3; i++) { ctx.strokeStyle = i % 2 ? '#ff6a2a' : '#ffe27a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(48 + i * 4, -42); ctx.quadraticCurveTo(40 + i * 8, -78 - i * 6, 22 + i * 12, -86 - i * 8 + Math.sin(t * 10 + i) * 4); ctx.stroke(); }
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.moveTo(74, -30); ctx.lineTo(96, -24); ctx.lineTo(74, -18); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#3a0e10'; ctx.beginPath(); ctx.arc(58, -30, 4.5, 0, 6.3); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(59.5, -31.5, 1.6, 0, 6.3); ctx.fill();
  ctx.restore();
}
function feather(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number, s: number, a: number) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s); ctx.globalAlpha = a;
  ctx.globalCompositeOperation = 'lighter'; const gl = ctx.createRadialGradient(0, -6, 4, 0, -6, 60); gl.addColorStop(0, 'rgba(255,170,50,.65)'); gl.addColorStop(1, 'rgba(255,90,20,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, -6, 60, 0, 6.3); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  const g = ctx.createLinearGradient(0, -40, 0, 26); g.addColorStop(0, '#fff6c0'); g.addColorStop(0.45, '#ffa42a'); g.addColorStop(1, '#d8302a');
  ctx.fillStyle = g; ctx.strokeStyle = '#8a1a10'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0, -42); ctx.quadraticCurveTo(18, -8, 0, 26); ctx.quadraticCurveTo(-18, -8, 0, -42); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#fff0a0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(0, 18); ctx.stroke(); ctx.restore();
}
const phoenixRain: SkillFx = async (c) => {
  const k = c.caster; const tg = c.targets.length ? c.targets : c.foes; const [ex, ey] = c.center(tg); const dir = k.facing;
  c.dim(0.5, 0.3); void c.tint('#3a0808', 0.5, 0.5);
  focus(c, lerp(k.x, ex, 0.5), 320, 1.08, 0.45);
  c.pose('castUp', 0.3); c.glow(k, '#ff9a2a');
  c.vfx.glyph(k.x, k.by, { r: 90, color: '#ff9a2a', life: 1.6, points: 5 });
  c.vfx.burst({ x: k.x, y: k.by - 30, n: 40, speed: [40, 200], angle: -Math.PI / 2, spread: 1.6, life: [0.7, 1.4], size: [3, 7], color: ['#ff6a2a', '#ffd24a', '#fff3b0'], shape: 'ember', gravity: -50, radius: 40 });
  await c.sleep(0.5);
  // ① 金凤凰自画面一侧斜飞而过，留下烈火尾迹
  const y0 = 110, sx = dir > 0 ? -140 : 1100, ex2 = dir > 0 ? 1100 : -140;
  const trail: [number, number][] = [];
  c.vfx.custom(1.6, (ctx, p, t) => {
    const q = ease.inOut(clamp(p / 0.9)); const x = lerp(sx, ex2, q); const y = y0 + Math.sin(q * Math.PI) * -40 + q * 140;
    trail.push([x, y]); if (trail.length > 36) trail.shift();
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    trail.forEach(([tx, ty], i) => { const u = i / trail.length; ctx.fillStyle = hexA(i % 2 ? '#ff6a1a' : '#ffc83a', u * 0.55); ctx.beginPath(); ctx.arc(tx - dir * 30, ty + 10, 14 + u * 34, 0, 6.3); ctx.fill(); });
    ctx.restore();
    ctx.save(); ctx.globalAlpha = fade(p, 0.05, 0.85); phoenix(ctx, x, y, 1.6, Math.sin(t * 9) * 0.5 + 0.5, dir, t); ctx.restore();
  }, 'front');
  for (let i = 0; i < 6; i++) { c.vfx.burst({ x: lerp(sx, ex2, 0.1 + i * 0.14), y: 120 + i * 24, n: 10, speed: [20, 80], life: [0.6, 1.1], size: [3, 6], color: ['#ffd24a', '#ff7a2a'], shape: 'ember', gravity: 120 }); await c.sleep(0.1); }
  await c.sleep(0.3);
  // ② 羽雨：两波燃烧的羽毛坠向敌阵，每片落地炸开火花
  const rnd = mulberry(23);
  for (let wave = 0; wave < 2; wave++) {
    const fs = Array.from({ length: 24 }, () => ({ x: ex + (rnd() - 0.5) * 420, y: ey + (rnd() - 0.5) * 120 + 40, d: rnd() * 0.5, rot: (rnd() - 0.5) * 0.8, s: 0.9 + rnd() * 0.7 }));
    c.vfx.custom(1.0, (ctx, p) => { for (const f of fs) { const q = clamp((p - f.d * 0.5) / 0.5); if (q <= 0 || q >= 1) continue; const yy = lerp(-40, f.y, ease.in(q)); feather(ctx, f.x, yy, f.rot + Math.PI, f.s * 1.9, 1); ctx.save(); ctx.globalCompositeOperation = 'lighter'; const tg2 = ctx.createLinearGradient(0, yy - 150, 0, yy); tg2.addColorStop(0, 'rgba(255,120,30,0)'); tg2.addColorStop(1, 'rgba(255,170,60,.55)'); ctx.fillStyle = tg2; ctx.beginPath(); ctx.moveTo(f.x - 10, yy - 20); ctx.lineTo(f.x + 10, yy - 20); ctx.lineTo(f.x, yy - 150); ctx.fill(); ctx.restore(); } }, 'front');
    await c.sleep(0.55);
    for (const f of fs) if (rnd() < 0.6) c.vfx.burst({ x: f.x, y: f.y, n: 5, speed: [60, 220], angle: -Math.PI / 2, spread: 2.4, life: [0.3, 0.7], size: [2, 5], color: ['#fff3b0', '#ff7a2a'], shape: 'spark', gravity: 260 });
    c.vfx.ring(ex, ey + 20, { r0: 20, r1: 340, life: 0.5, color: '#ff9a2a', width: 8, squash: 0.45 });
    for (const f of fs.slice(0, 10)) c.vfx.custom(0.5, (ctx, p) => { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const r = 30 + p * 70; const g = ctx.createRadialGradient(f.x, f.y, 2, f.x, f.y, r); g.addColorStop(0, `rgba(255,240,170,${0.9 * (1 - p)})`); g.addColorStop(0.5, `rgba(255,130,30,${0.6 * (1 - p)})`); g.addColorStop(1, 'rgba(255,60,10,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, 6.3); ctx.fill(); ctx.restore(); }, 'front');
    c.scene.shake(wave ? 14 : 8, 0.4); c.scene.flash('#ffd9a0', wave ? 0.6 : 0.35); c.hit(wave);
    for (const t of tg) { const [x, y] = t.anchor('foot'); c.vfx.pillar(x, y, { h: 180 + wave * 60, w: 56, life: 0.7, color: '#ff8a2a' }); }
    await c.sleep(0.45);
  }
  // ③ 引爆：灼烧层层炸开
  c.hit();
  for (const t of tg) { const [x, y] = t.anchor('chest'); c.vfx.ring(x, y, { r0: 8, r1: 90, life: 0.45, color: '#fff3b0', width: 6 }); c.vfx.burst({ x, y, n: 18, speed: [80, 300], life: [0.4, 0.9], size: [3, 7], color: ['#ff6a2a', '#ffd24a'], shape: 'ember', gravity: 40 }); }
  c.scene.shake(18, 0.5); c.scene.flash('#fff0c0', 0.8);
  c.uplift(c.allies, ['#ffb83a', '#ff6a2a'], 'star', 16);
  await c.sleep(1.0);
};

// ───────────────────────── 嫦喵「广寒月华」─────────────────────────
const moonPalace: SkillFx = async (c) => {
  const k = c.caster; const mine = c.allies; const [cx, cy] = c.center(mine);
  c.dim(0.5, 0.35); void c.tint('#14246a', 0.45, 0.5);
  focus(c, cx, 330, 1.06, 0.5);
  c.pose('castUp', 0.3); c.glow(k, '#bfe0ff');
  const rnd = mulberry(7);
  const stars = Array.from({ length: 60 }, () => ({ x: rnd() * 960, y: rnd() * 330, r: 1 + rnd() * 2.6, ph: rnd() * 6.3, sp: 1.5 + rnd() * 3 }));
  // ① 星空 + 巨大满月缓缓落下
  c.vfx.custom(3.4, (ctx, p, t) => {
    const a = fade(p, 0.1, 0.85);
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#fff';
    for (const s of stars) { ctx.globalAlpha = a * (0.4 + 0.6 * Math.abs(Math.sin(t * s.sp + s.ph))); star4(ctx, s.x, s.y, s.r * 2.2, t * 0.3); }
    ctx.restore();
    const my = lerp(-120, 150, ease.outCubic(clamp(p / 0.35))); const R = 150;
    ctx.save(); ctx.globalAlpha = a;
    const halo = ctx.createRadialGradient(cx, my, R * 0.6, cx, my, R * 3); halo.addColorStop(0, hexA('#d6ecff', 0.55)); halo.addColorStop(1, hexA('#d6ecff', 0)); ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, my, R * 3, 0, 6.3); ctx.fill();
    const mg = ctx.createRadialGradient(cx - 40, my - 40, 10, cx, my, R); mg.addColorStop(0, '#ffffff'); mg.addColorStop(0.7, '#e6f1ff'); mg.addColorStop(1, '#b8d2f4');
    ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(cx, my, R, 0, 6.3); ctx.fill();
    ctx.fillStyle = hexA('#9ab8e0', 0.45); for (const [dx, dy, r] of [[-50, -30, 22], [36, 20, 30], [-10, 62, 16], [60, -52, 14]] as number[][]) { ctx.beginPath(); ctx.arc(cx + dx, my + dy, r, 0, 6.3); ctx.fill(); }
    // 月中桂树与玉兔剪影
    ctx.fillStyle = hexA('#7c9cd0', 0.6); ctx.beginPath(); ctx.ellipse(cx + 30, my + 30, 20, 26, 0, 0, 6.3); ctx.fill(); ctx.beginPath(); ctx.ellipse(cx + 24, my - 4, 8, 22, -0.2, 0, 6.3); ctx.ellipse(cx + 40, my - 4, 8, 22, 0.2, 0, 6.3); ctx.fill();
    ctx.restore();
  }, 'back');
  await c.sleep(0.8);
  // ② 月光光柱笼罩己方，飘带环绕
  c.vfx.custom(2.4, (ctx, p, t) => {
    const a = fade(p, 0.12, 0.8); ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, 0, 0, 470); g.addColorStop(0, hexA('#e6f4ff', 0.0)); g.addColorStop(0.3, hexA('#cfe6ff', 0.5 * a)); g.addColorStop(1, hexA('#cfe6ff', 0.15 * a));
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(cx - 70, 40); ctx.lineTo(cx + 70, 40); ctx.lineTo(cx + 300, 480); ctx.lineTo(cx - 300, 480); ctx.closePath(); ctx.fill();
    for (let r = 0; r < 4; r++) { ctx.strokeStyle = hexA(r % 2 ? '#ffe9a8' : '#bfe0ff', 0.7 * a); ctx.lineWidth = 7 - r; ctx.lineCap = 'round'; ctx.beginPath();
      for (let i = 0; i <= 60; i++) { const u = i / 60; const x = cx + Math.sin(u * 6.3 * 2 + t * 2 + r * 1.5) * (160 + r * 28) * (0.4 + u * 0.6); const y = 80 + u * 400; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
    ctx.restore();
  }, 'front');
  c.vfx.glyph(cx, cy + 62, { r: 230, color: '#cfe6ff', life: 2.2, points: 8, squash: 0.3 });
  await c.sleep(0.5);
  // ③ 玉兔掠过前景，桂花与「月光珠」从天而落
  c.vfx.custom(2.0, (ctx, p) => {
    const x = lerp(-60, 1020, ease.inOut(p)); const hop = Math.abs(Math.sin(p * 18)) * 60; const y = 520 - hop;
    ctx.save(); ctx.globalAlpha = fade(p, 0.05, 0.9); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#b8c8e8'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(x, y, 34, 24, 0, 0, 6.3); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.ellipse(x + 30, y - 16, 18, 15, 0, 0, 6.3); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x + 26, y - 50, 7, 22, -0.2, 0, 6.3); ctx.ellipse(x + 40, y - 50, 7, 22, 0.2, 0, 6.3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff9ab0'; ctx.beginPath(); ctx.arc(x + 40, y - 18, 3, 0, 6.3); ctx.fill(); ctx.fillStyle = '#2a2040'; ctx.beginPath(); ctx.arc(x + 36, y - 20, 2.5, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - 34, y - 6, 9, 0, 6.3); ctx.fill(); ctx.stroke(); ctx.restore();
  }, 'front');
  for (let i = 0; i < 6; i++) {
    c.vfx.burst({ x: 480, y: -20, n: 16, speed: [10, 50], angle: Math.PI / 2, spread: 2.2, life: [1.4, 2.2], size: [4, 8], color: ['#ffe9a8', '#ffd24a'], shape: 'petal', gravity: 90, radius: 460, additive: false });
    c.vfx.burst({ x: 480, y: -20, n: 8, speed: [10, 40], angle: Math.PI / 2, spread: 1.6, life: [1.4, 2.0], size: [6, 10], color: ['#ffffff', '#bfe0ff'], shape: 'glow', gravity: 110, radius: 420 });
    await c.sleep(0.16);
  }
  // ④ 治疗：每只友方升起月白光点，护盾泡泡
  c.scene.flash('#e6f4ff', 0.6); c.scene.shake(4, 0.3);
  for (const a of mine) bubble(c, a, '#bfe0ff', 1.8, 0.05);
  c.uplift(mine, ['#ffffff', '#bfe0ff', '#ffe9a8'], 'star', 20);
  for (const a of mine) { const [x, y] = a.anchor('chest'); c.vfx.ring(x, y, { r0: 10, r1: 100, life: 0.7, color: '#bfe0ff', width: 6 }); }
  await c.sleep(1.2);
};

export const SKILL_FX3: Record<string, SkillFx> = {
  'ult.tigerTomb': tigerTomb,
  'ult.phoenixRain': phoenixRain,
  'ult.moonPalace': moonPalace,
};
void FONT;
