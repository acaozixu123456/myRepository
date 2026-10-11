// 第二批猫猫剩余八段专属绝技画面（与 skills4 一起，让十四只新猫各有各的招）。软萌、不血腥。
import type { SkillFx } from './skills';
import { clamp, ease, hexA, lerp, mulberry } from './util';

const fade = (p: number, a = 0.15, b = 0.8) => (p < a ? p / a : p > b ? (1 - p) / (1 - b) : 1);
function focus(c: Parameters<SkillFx>[0], x: number, y: number, z: number, d: number) {
  const hw = 480 / z, hh = 300 / z;
  c.scene.focus(clamp(x, hw, 960 - hw), clamp(y, hh, 600 - hh), z, d);
}
function banner(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, col: string, wave: number, glyph = '') {
  ctx.save(); ctx.translate(x, y);
  ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -h); ctx.stroke();
  ctx.fillStyle = col; ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -h); ctx.quadraticCurveTo(26, -h + 6 + wave, 52, -h + 2); ctx.lineTo(46, -h + 28); ctx.quadraticCurveTo(24, -h + 34 + wave, 0, -h + 30); ctx.closePath(); ctx.fill(); ctx.stroke();
  if (glyph) { ctx.fillStyle = '#fff6dc'; ctx.font = '700 16px "ZCOOL KuaiLe","Noto Sans SC",sans-serif'; ctx.textAlign = 'center'; ctx.fillText(glyph, 24, -h + 22); }
  ctx.restore();
}

// 徐晃晃「亚夫整营」：一排军旗依次竖起，蓝色盾幕沿营线展开，营门前压出整齐的一道冲击。
const campDrill: SkillFx = async (c) => {
  const k = c.caster; const tg = c.targets.length ? c.targets : c.foes; const [ex, ey] = c.center(tg); const dir = k.facing;
  focus(c, lerp(k.x, ex, 0.5), 340, 1.08, 0.4); c.dim(0.3, 0.2); c.pose('guard', 0.25); c.glow(k, '#7aa8ff');
  c.vfx.glyph(k.x, k.by, { r: 80, color: '#7aa8ff', life: 1.3, points: 4 });
  await c.sleep(0.4);
  const xs = Array.from({ length: 7 }, (_, i) => lerp(k.x + dir * 40, ex - dir * 70, i / 6));
  c.vfx.custom(1.9, (ctx, p, t) => {
    ctx.save(); ctx.globalAlpha = fade(p, 0.04, 0.8);
    xs.forEach((x, i) => { const q = ease.outBack(clamp((p - i * 0.07) / 0.2)); if (q <= 0) return; banner(ctx, x, ey + 70, 130 * q, '#3f63ad', Math.sin(t * 6 + i) * 4, '整'); });
    ctx.restore();
  }, 'front');
  for (let i = 0; i < 7; i++) { c.vfx.ring(xs[i], ey + 70, { r0: 6, r1: 50, life: 0.3, color: '#cfe0ff', width: 4, squash: 0.4 }); await c.sleep(0.09); }
  await c.sleep(0.25);
  c.vfx.custom(0.9, (ctx, p) => { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const x = lerp(k.x, ex, ease.in(clamp(p / 0.6))); const g = ctx.createLinearGradient(x - dir * 120, 0, x, 0); g.addColorStop(0, hexA('#7aa8ff', 0)); g.addColorStop(1, hexA('#e8f0ff', 0.9 * fade(p, 0.1, 0.8))); ctx.fillStyle = g; ctx.fillRect(Math.min(x - dir * 120, x), ey - 70, 120, 150); ctx.restore(); }, 'front');
  await c.sleep(0.5);
  for (const t of tg) c.hitSpark(t, '#cfe0ff', 12);
  c.scene.shake(12, 0.35); c.scene.flash('#e8f0ff', 0.45); c.hit();
  await c.sleep(1.0);
};

// 姜喵维「再赴祁山」：水墨远山浮现，一行军旗翻过山脊，一杆长枪的光影从山后直刺而来。
const qishan: SkillFx = async (c) => {
  const k = c.caster; const tg = c.targets.length ? c.targets : c.foes; const [ex, ey] = c.center(tg); const dir = k.facing;
  focus(c, lerp(k.x, ex, 0.5), 330, 1.06, 0.4); c.dim(0.4, 0.3); void c.tint('#1a2a1a', 0.3, 0.4); c.pose('windup', 0.3); c.glow(k, '#9fe8b0');
  await c.sleep(0.3);
  c.vfx.custom(2.2, (ctx, p, t) => {
    ctx.save(); const a = fade(p, 0.12, 0.8);
    for (const [bx, w, h, al] of [[160, 300, 190, 0.5], [420, 360, 240, 0.65], [720, 320, 200, 0.5]] as number[][]) {
      const q = ease.outCubic(clamp(p / 0.35)); ctx.fillStyle = hexA('#2a4a3a', al * a); ctx.beginPath(); ctx.moveTo(bx - w / 2, 350); ctx.quadraticCurveTo(bx - w / 5, 350 - h * q, bx, 350 - h * q * 1.05); ctx.quadraticCurveTo(bx + w / 5, 350 - h * q * 0.8, bx + w / 2, 350); ctx.fill();
    }
    for (let i = 0; i < 6; i++) { const x = lerp(-40, 1000, ((t * 0.3 + i / 6) % 1)); const y = 330 - Math.sin((x / 1000) * Math.PI) * 70; ctx.globalAlpha = a; banner(ctx, dir > 0 ? x : 960 - x, y + 20, 70, '#4f9e5e', Math.sin(t * 6 + i) * 3, '蜀'); }
    ctx.restore();
  }, 'back');
  await c.sleep(1.0);
  const [sx, sy] = k.anchor('hand');
  c.vfx.custom(1.0, (ctx, p) => { const q = ease.in(clamp(p / 0.7)); const x = lerp(sx, ex, q), y = lerp(sy, ey - 20, q); ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createLinearGradient(sx, 0, x, 0); g.addColorStop(0, hexA('#9fe8b0', 0)); g.addColorStop(1, hexA('#e8fff0', 0.95)); ctx.strokeStyle = g; ctx.lineWidth = 14; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(x, y); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 16, 0, 6.3); ctx.fill(); ctx.restore(); }, 'front');
  c.pose('thrust', 0.1);
  await c.sleep(0.75);
  for (const t of tg) { c.hitSpark(t, '#e8fff0', 12); const [x, y] = t.anchor('chest'); c.vfx.ring(x, y, { r0: 8, r1: 80, life: 0.45, color: '#9fe8b0', width: 5 }); }
  c.scene.shake(12, 0.35); c.scene.flash('#e8fff0', 0.45); c.hit();
  await c.sleep(1.0);
};

// 甘宁宁「锦帆夜袭」：夜色里一面锦帆无声滑过，帆下的小铃铛叮叮响，铃声化作一道道亮线。
const silkSail: SkillFx = async (c) => {
  const k = c.caster; const tg = c.targets.length ? c.targets : c.foes; const [ex, ey] = c.center(tg); const dir = k.facing;
  focus(c, lerp(k.x, ex, 0.5), 340, 1.1, 0.4); c.dim(0.55, 0.3); void c.tint('#101a40', 0.45, 0.4); c.pose('windup', 0.25); c.glow(k, '#ff8a6a');
  const rnd = mulberry(4);
  const stars = Array.from({ length: 30 }, () => ({ x: rnd() * 960, y: rnd() * 260, s: 1 + rnd() * 2 }));
  c.vfx.custom(2.4, (ctx, p, t) => { ctx.save(); ctx.fillStyle = '#fff'; for (const s of stars) { ctx.globalAlpha = fade(p, 0.1, 0.85) * (0.4 + 0.6 * Math.abs(Math.sin(t * 2 + s.x))); ctx.fillRect(s.x, s.y, s.s, s.s); } ctx.restore(); }, 'back');
  await c.sleep(0.5);
  const x0 = dir > 0 ? -240 : 1200, x1 = dir > 0 ? 1200 : -240; const y = ey - 20;
  c.vfx.custom(1.6, (ctx, p, t) => {
    const x = lerp(x0, x1, ease.inOut(clamp(p / 0.9))); ctx.save(); ctx.globalAlpha = fade(p, 0.05, 0.9); ctx.translate(x, y); ctx.scale(dir, 1);
    ctx.fillStyle = '#2a1a20'; ctx.beginPath(); ctx.moveTo(-100, 70); ctx.lineTo(110, 70); ctx.lineTo(80, 100); ctx.lineTo(-70, 100); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#4a2a20'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, 70); ctx.lineTo(0, -90); ctx.stroke();
    const g = ctx.createLinearGradient(-60, -80, 70, 60); g.addColorStop(0, '#ff5a6a'); g.addColorStop(0.5, '#ffb24a'); g.addColorStop(1, '#ff6a8a'); ctx.fillStyle = g; ctx.strokeStyle = '#7a2a30'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(4, -86); ctx.quadraticCurveTo(90 + Math.sin(t * 5) * 10, -30, 62, 56); ctx.lineTo(4, 56); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = hexA('#fff3b0', 0.9); ctx.lineWidth = 2.5; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(8, -70 + i * 30); ctx.quadraticCurveTo(40, -60 + i * 30 + Math.sin(t * 5 + i) * 6, 56, -50 + i * 28); ctx.stroke(); }
    ctx.fillStyle = '#ffd24a'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(10 + i * 12, 60 + Math.sin(t * 20 + i) * 3, 5, 0, 6.3); ctx.fill(); }
    ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = hexA('#ffe27a', 0.5 * fade(p, 0.1, 0.8)); ctx.lineWidth = 3; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x, y + 60, ((t * 120 + i * 40) % 120) + 10, 0, 6.3); ctx.stroke(); } ctx.restore();
  }, 'front');
  await c.sleep(0.9);
  for (const t of tg) { const [x, y] = t.anchor('chest'); c.vfx.slash(x, y, { r: 70, width: 14, life: 0.3, color: '#ff8a6a', core: '#fff' }); c.hitSpark(t, '#ffd0a0', 12); }
  c.scene.shake(12, 0.3); c.scene.flash('#ffe0c0', 0.4); c.hit();
  await c.sleep(1.0);
};

// 陆喵逊「夷陵收火」：战场上的火苗一缕缕被收拢，盘成一条火龙，再一口气压向敌阵。
const gatherFire: SkillFx = async (c) => {
  const k = c.caster; const tg = c.targets.length ? c.targets : c.foes; const [ex, ey] = c.center(tg);
  focus(c, ex, 330, 1.06, 0.4); c.dim(0.4, 0.3); void c.tint('#3a1008', 0.4, 0.4); c.pose('cast', 0.25); c.glow(k, '#ff8a3a');
  const rnd = mulberry(16);
  const sp = Array.from({ length: 40 }, () => ({ a: rnd() * 6.28, r: 200 + rnd() * 240, d: rnd() * 0.5, s: 6 + rnd() * 10 }));
  c.vfx.custom(1.6, (ctx, p) => {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const f of sp) { const q = ease.inOut(clamp((p - f.d * 0.5) / 0.55)); const r = lerp(f.r, 24, q); const a = f.a + q * 4; const x = ex + Math.cos(a) * r, y = ey + 20 + Math.sin(a) * r * 0.5; const g = ctx.createRadialGradient(x, y, 1, x, y, f.s * 3); g.addColorStop(0, 'rgba(255,240,170,.95)'); g.addColorStop(0.5, 'rgba(255,130,40,.7)'); g.addColorStop(1, 'rgba(255,60,10,0)'); ctx.globalAlpha = fade(p, 0.05, 0.9); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, f.s * 3, 0, 6.3); ctx.fill(); }
    ctx.restore();
  }, 'front');
  await c.sleep(1.1);
  c.vfx.ring(ex, ey + 30, { r0: 10, r1: 360, life: 0.7, color: '#ff8a3a', width: 14, squash: 0.45 });
  for (const t of tg) { const [x, y] = t.anchor('foot'); c.vfx.pillar(x, y, { h: 210, w: 60, life: 0.8, color: '#ff8a2a' }); c.hitSpark(t, '#ffd070', 12); }
  c.scene.shake(16, 0.5); c.scene.flash('#ffd9a0', 0.6); c.hit();
  await c.sleep(1.1);
};

// 张角角「黄巾围拢」：一条条黄巾飘带从四面飞来，绕着敌人收紧成圈，系成一个大蝴蝶结。
const yellowRing: SkillFx = async (c) => {
  const k = c.caster; const tg = c.targets.length ? c.targets : c.foes; const [ex, ey] = c.center(tg);
  focus(c, ex, 335, 1.06, 0.4); c.dim(0.3, 0.2); c.pose('castUp', 0.25); c.glow(k, '#ffd24a');
  await c.sleep(0.35);
  c.vfx.custom(2.0, (ctx, p, t) => {
    ctx.save(); ctx.lineCap = 'round'; const a = fade(p, 0.08, 0.8);
    for (let i = 0; i < 9; i++) {
      const base = (i / 9) * 6.28; ctx.strokeStyle = hexA(i % 2 ? '#ffd24a' : '#ffb82a', a); ctx.lineWidth = 12 - (i % 3) * 2; ctx.beginPath();
      for (let j = 0; j <= 40; j++) { const u = j / 40; const q = ease.inOut(clamp(p / 0.6)); const ang = base + u * 3.2 + q * 2; const r = lerp(520 - u * 380, 120 + 6 * Math.sin(t * 6 + i), q) * (1 - u * 0.1); const x = ex + Math.cos(ang) * r, y = ey + 30 + Math.sin(ang) * r * 0.42; j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
    }
    const bow = ease.outBack(clamp((p - 0.55) / 0.2)); if (bow > 0) { ctx.fillStyle = '#ffd24a'; ctx.strokeStyle = '#a8761a'; ctx.lineWidth = 4; ctx.save(); ctx.translate(ex, ey - 120); ctx.scale(bow, bow); for (const sg of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(sg * 60, -50, sg * 70, 6); ctx.quadraticCurveTo(sg * 50, 30, 0, 0); ctx.fill(); ctx.stroke(); } ctx.beginPath(); ctx.arc(0, 0, 11, 0, 6.3); ctx.fill(); ctx.stroke(); ctx.restore(); }
    ctx.restore();
  }, 'front');
  await c.sleep(1.2);
  for (const t of tg) c.hitSpark(t, '#ffe27a', 12);
  c.scene.shake(10, 0.35); c.scene.flash('#fff0a0', 0.45); c.hit();
  await c.sleep(1.0);
};

// 孟优优「献宝护营」：礼盒从天而降，最大的一只“啪”地打开，撒出一圈金色的护身泡泡。
const tribute: SkillFx = async (c) => {
  const k = c.caster; const tg = c.targets.length ? c.targets : c.foes; const [ex, ey] = c.center(tg);
  focus(c, ex, 335, 1.06, 0.4); c.dim(0.3, 0.2); c.pose('castFwd', 0.25); c.glow(k, '#ffb83a');
  await c.sleep(0.3);
  const rnd = mulberry(77); const cols = ['#e8486e', '#4a95e0', '#55b24b', '#f0b73c'];
  const boxes = Array.from({ length: 8 }, (_, i) => ({ x: ex + (rnd() - 0.5) * 360, y: ey + (rnd() - 0.5) * 80 + 40, d: rnd() * 0.4, col: cols[i % 4], s: 0.8 + rnd() * 0.5 }));
  c.vfx.custom(1.3, (ctx, p) => {
    ctx.save(); for (const b of boxes) { const q = ease.in(clamp((p - b.d * 0.5) / 0.4)); if (q <= 0 || q >= 1.0 && p > 0.95) continue; const y = lerp(-60, b.y, q); ctx.globalAlpha = fade(p, 0.02, 0.85); ctx.save(); ctx.translate(b.x, y); ctx.scale(b.s, b.s); ctx.fillStyle = b.col; ctx.strokeStyle = '#4a2a10'; ctx.lineWidth = 3; ctx.fillRect(-20, -16, 40, 32); ctx.strokeRect(-20, -16, 40, 32); ctx.fillStyle = '#fff3b0'; ctx.fillRect(-4, -16, 8, 32); ctx.fillRect(-20, -3, 40, 6); ctx.restore(); }
    ctx.restore();
  }, 'front');
  await c.sleep(0.8);
  c.vfx.burst({ x: ex, y: ey, n: 50, speed: [120, 420], life: [0.6, 1.2], size: [4, 9], color: ['#ffd24a', '#ff9ac0', '#9fe8ff', '#8affb0'], shape: 'coin', gravity: 380, spread: 6.28 });
  c.vfx.ring(ex, ey + 30, { r0: 10, r1: 320, life: 0.6, color: '#ffd24a', width: 10, squash: 0.45 });
  for (const t of tg) c.hitSpark(t, '#ffe27a', 12);
  c.scene.shake(10, 0.3); c.scene.flash('#fff3b0', 0.4); c.hit();
  await c.sleep(1.0);
};

// 于吉吉「符水济众」：葫芦倾出一线清水，符纸飘落成雨，落在每只友方身上漾开涟漪。
const talismanWater: SkillFx = async (c) => {
  const k = c.caster; const mine = c.allies; const [cx, cy] = c.center(mine);
  focus(c, cx, 340, 1.06, 0.4); c.dim(0.25, 0.2); c.pose('castUp', 0.25); c.glow(k, '#8fd0ff');
  await c.sleep(0.3);
  const rnd = mulberry(21);
  const pap = Array.from({ length: 14 }, () => ({ x: cx + (rnd() - 0.5) * 420, d: rnd() * 0.5, rot: (rnd() - 0.5) * 1.2 }));
  c.vfx.custom(2.0, (ctx, p) => {
    ctx.save(); const a = fade(p, 0.1, 0.8);
    const q = ease.outCubic(clamp(p / 0.3)); ctx.strokeStyle = hexA('#8fd0ff', 0.85 * a); ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(k.x, k.by - 160); ctx.quadraticCurveTo(k.x + 40, k.by - 220, lerp(k.x, cx, q), lerp(k.by - 160, cy - 60, q)); ctx.stroke();
    for (const f of pap) { const s = clamp((p - f.d * 0.5) / 0.5); if (s <= 0) continue; const y = lerp(-30, cy + 10, ease.outCubic(s)); ctx.globalAlpha = a * (s < 1 ? 1 : 0.6); ctx.save(); ctx.translate(f.x, y); ctx.rotate(f.rot + (1 - s) * 2); ctx.fillStyle = '#fff3b0'; ctx.strokeStyle = '#a8761a'; ctx.lineWidth = 2; ctx.fillRect(-10, -16, 20, 32); ctx.strokeRect(-10, -16, 20, 32); ctx.strokeStyle = '#d6483c'; ctx.beginPath(); ctx.moveTo(-5, -8); ctx.lineTo(5, -8); ctx.moveTo(0, -8); ctx.lineTo(0, 8); ctx.stroke(); ctx.restore(); }
    ctx.restore();
  }, 'front');
  await c.sleep(0.9);
  for (const a of mine) { const [x, y] = a.anchor('foot'); c.vfx.ring(x, y, { r0: 8, r1: 80, life: 0.9, color: '#8fd0ff', width: 5, squash: 0.4 }); c.vfx.ring(x, y, { r0: 4, r1: 50, life: 0.7, color: '#ffffff', width: 3, squash: 0.4 }); }
  c.uplift(mine, ['#bfe8ff', '#ffffff', '#9fe8b0'], 'glow', 16);
  c.scene.flash('#e0f4ff', 0.35);
  await c.sleep(1.2);
};

// 南华喵「梦里留门」：半空浮出一扇暖黄色的小门，蝴蝶与花瓣从门缝涌出，友方被梦泡泡轻轻裹住。
const dreamDoor: SkillFx = async (c) => {
  const k = c.caster; const mine = c.allies; const [cx, cy] = c.center(mine);
  focus(c, cx, 335, 1.06, 0.4); c.dim(0.5, 0.3); void c.tint('#2a1a50', 0.4, 0.4); c.pose('cast', 0.25); c.glow(k, '#d8b8ff');
  await c.sleep(0.3);
  const dx = cx, dy = cy - 140;
  c.vfx.custom(2.6, (ctx, p, t) => {
    const q = ease.outBack(clamp(p / 0.25)); const open = ease.outCubic(clamp((p - 0.25) / 0.2)); ctx.save(); ctx.globalAlpha = fade(p, 0.06, 0.88);
    ctx.globalCompositeOperation = 'lighter'; const gl = ctx.createRadialGradient(dx, dy, 10, dx, dy, 190); gl.addColorStop(0, hexA('#ffe9a0', 0.8 * open)); gl.addColorStop(1, hexA('#ffb86a', 0)); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(dx, dy, 190, 0, 6.3); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
    ctx.translate(dx, dy); ctx.scale(q, q);
    ctx.fillStyle = '#6a4a8a'; ctx.strokeStyle = '#2a1a40'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-46, 80); ctx.lineTo(-46, -30); ctx.quadraticCurveTo(0, -96, 46, -30); ctx.lineTo(46, 80); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff0b8'; ctx.beginPath(); ctx.moveTo(-34 * open, 76); ctx.lineTo(-34 * open, -28); ctx.quadraticCurveTo(0, -80, 34 * open, -28); ctx.lineTo(34 * open, 76); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.globalAlpha = fade(p, 0.25, 0.85);
    for (let i = 0; i < 9; i++) { const u = ((t * 0.45 + i / 9) % 1); const x = dx + Math.sin(u * 8 + i) * 120 * u; const y = dy + 20 + u * 260; ctx.fillStyle = i % 2 ? '#ffb8d8' : '#bfe8ff'; ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 8 + i) * 0.5); const w = 9 + Math.sin(t * 14 + i) * 4; ctx.beginPath(); ctx.ellipse(-w / 2, 0, w, 6, 0.4, 0, 6.3); ctx.ellipse(w / 2, 0, w, 6, -0.4, 0, 6.3); ctx.fill(); ctx.restore(); }
    ctx.restore();
  }, 'front');
  await c.sleep(1.5);
  for (const a of mine) { const [x, y] = a.anchor('chest'); c.vfx.custom(1.2, (ctx, p) => { ctx.save(); ctx.globalAlpha = fade(p, 0.2, 0.7) * 0.8; const r = 56 * ease.outCubic(clamp(p * 3)); const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, 4, x, y, r); g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(0.8, 'rgba(216,184,255,.25)'); g.addColorStop(1, 'rgba(216,184,255,.75)'); ctx.fillStyle = g; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y, r * 0.85, r, 0, 0, 6.3); ctx.fill(); ctx.stroke(); ctx.restore(); }, 'front'); }
  c.uplift(mine, ['#ffe9a0', '#ffb8d8', '#ffffff'], 'star', 14);
  c.scene.flash('#f4e8ff', 0.35);
  await c.sleep(1.1);
};

export const SKILL_FX5: Record<string, SkillFx> = {
  'ult.campDrill': campDrill, 'ult.qishan': qishan, 'ult.silkSail': silkSail, 'ult.gatherFire': gatherFire,
  'ult.yellowRing': yellowRing, 'ult.tribute': tribute, 'ult.talismanWater': talismanWater, 'ult.dreamDoor': dreamDoor,
};
