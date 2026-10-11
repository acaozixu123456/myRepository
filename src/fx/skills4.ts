// 第二批猫猫里原先“撞车”的六段绝技，各自补上专属画面（软萌、不血腥）。
import type { SkillFx } from './skills';
import { clamp, ease, hexA, lerp, mulberry } from './util';

const fade = (p: number, a = 0.15, b = 0.8) => (p < a ? p / a : p > b ? (1 - p) / (1 - b) : 1);
function focus(c: Parameters<SkillFx>[0], x: number, y: number, z: number, d: number) {
  const hw = 480 / z, hh = 300 / z;
  c.scene.focus(clamp(x, hw, 960 - hw), clamp(y, hh, 600 - hh), z, d);
}
function paw(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rot: number) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.beginPath(); ctx.ellipse(0, 4, 9, 7, 0, 0, 6.3); ctx.fill();
  for (const [dx, dy] of [[-10, -6], [-4, -12], [4, -12], [10, -6]]) { ctx.beginPath(); ctx.ellipse(dx, dy, 3.6, 4.6, 0, 0, 6.3); ctx.fill(); }
  ctx.restore();
}

// 马超超「锦马破阵」：锦缎织成的骏马剪影载着银枪冲过敌阵，身后拖出彩色锦带。
const brocadeCharge: SkillFx = async (c) => {
  const k = c.caster; const tg = c.targets.length ? c.targets : c.foes; const [ex, ey] = c.center(tg); const dir = k.facing;
  focus(c, lerp(k.x, ex, 0.5), 340, 1.08, 0.4); c.dim(0.3, 0.2);
  c.pose('windup', 0.25); c.glow(k, '#7fe0b8');
  c.vfx.glyph(k.x, k.by, { r: 70, color: '#7fe0b8', life: 1.0, points: 6 });
  await c.sleep(0.4);
  const x0 = dir > 0 ? -160 : 1120, x1 = dir > 0 ? 1120 : -160; const y = ey + 6;
  const ribbons = ['#ff6a8a', '#ffd24a', '#6ad0ff', '#8affb0'];
  c.vfx.custom(1.3, (ctx, p, t) => {
    const q = ease.in(clamp(p / 0.85)); const x = lerp(x0, x1, q);
    ctx.save();
    ribbons.forEach((col, i) => { ctx.strokeStyle = hexA(col, 0.85); ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y - 30 + i * 12); for (let j = 1; j <= 14; j++) { const bx = x - dir * j * 22; ctx.lineTo(bx, y - 30 + i * 12 + Math.sin(t * 14 + j * 0.7 + i) * 7 * (j / 14)); } ctx.stroke(); });
    ctx.globalAlpha = fade(p, 0.05, 0.9); ctx.translate(x, y - 26); ctx.scale(dir * 1.5, 1.5);
    const run = Math.sin(t * 26);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // 尾
    ctx.strokeStyle = '#e6a03a'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(-54, -10); ctx.quadraticCurveTo(-96, -26 + run * 8, -92, 14); ctx.stroke();
    // 腿（跑动）
    ctx.lineWidth = 9;
    for (const [lx, ph] of [[-38, 0], [-18, 2], [26, 1], [44, 3]] as [number, number][]) { const sw = Math.sin(t * 26 + ph * 1.6) * 20; ctx.strokeStyle = '#8a6a3a'; ctx.beginPath(); ctx.moveTo(lx, 12); ctx.lineTo(lx + sw, 52 - Math.max(0, -sw) * 0.5); ctx.stroke(); ctx.strokeStyle = '#fff7e2'; ctx.lineWidth = 5; ctx.stroke(); ctx.lineWidth = 9; }
    // 身 + 颈 + 头
    ctx.fillStyle = '#fff7e2'; ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(0, -2, 62, 30, 0, 0, 6.3); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(40, -16); ctx.quadraticCurveTo(70, -34, 74, -70); ctx.lineTo(94, -62); ctx.quadraticCurveTo(84, -20, 58, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(96, -62, 26, 15, 0.45, 0, 6.3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e6a03a'; ctx.beginPath(); ctx.moveTo(70, -72); ctx.lineTo(74, -92); ctx.lineTo(86, -72); ctx.fill(); // 耳
    for (let i = 0; i < 5; i++) { ctx.strokeStyle = ribbons[i % 4]; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(66 + i * 2, -64 + i * 8); ctx.quadraticCurveTo(40, -70 + i * 8 + run * 5, 22, -56 + i * 9); ctx.stroke(); } // 锦缎鬃
    ctx.fillStyle = '#2b1d22'; ctx.beginPath(); ctx.arc(100, -66, 3.4, 0, 6.3); ctx.fill();
    // 银枪
    ctx.strokeStyle = '#7ad4ff'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(10, -42); ctx.lineTo(150, -34); ctx.stroke(); ctx.fillStyle = '#e8f6ff'; ctx.beginPath(); ctx.moveTo(150, -44); ctx.lineTo(186, -34); ctx.lineTo(150, -24); ctx.fill();
    ctx.restore();
  }, 'front');
  await c.sleep(0.5);
  for (const t of tg) c.hitSpark(t, '#b8fff0', 14);
  c.scene.shake(14, 0.4); c.scene.flash('#e6fff6', 0.5); c.hit();
  await c.sleep(1.0);
};

// 赵喵云「长坂护归」：白光盘旋成一条护身白龙，绕过友方再冲向敌阵。
const whiteDragon: SkillFx = async (c) => {
  const k = c.caster; const tg = c.targets.length ? c.targets : c.foes; const [ex, ey] = c.center(tg); const mine = c.allies; const [mx, my] = c.center(mine);
  focus(c, (mx + ex) / 2, 335, 1.08, 0.4); c.dim(0.3, 0.2);
  c.pose('thrust', 0.2); c.glow(k, '#e8f6ff');
  c.vfx.glyph(mx, my + 40, { r: 160, color: '#e8f6ff', life: 1.6, points: 8, squash: 0.35 });
  await c.sleep(0.3);
  c.vfx.custom(1.7, (ctx, p) => {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    const N = 46; const q = clamp(p / 0.85);
    for (let i = 0; i < N; i++) {
      const u = i / N; const s = clamp(q * 1.25 - u * 0.25); if (s <= 0) continue;
      let x: number, yy: number;
      if (s < 0.55) { const a = s / 0.55 * Math.PI * 2.4; x = mx + Math.cos(a) * (150 - s * 120); yy = my - 10 + Math.sin(a) * 70 - s * 70; } else { const w = (s - 0.55) / 0.45; x = lerp(mx + 50, ex, ease.inOut(w)); yy = lerp(my - 60, ey - 20, w) + Math.sin(w * 6) * 20; }
      ctx.fillStyle = hexA(i < 4 ? '#ffffff' : '#8fc8f0', (1 - u) * 0.9 * fade(p, 0.05, 0.85)); ctx.beginPath(); ctx.arc(x, yy, 22 * (1 - u * 0.65), 0, 6.3); ctx.fill();
      if (i === 0) { // 龙首：双角 + 眼睛 + 须
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = fade(p, 0.05, 0.85); ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#3a78b8'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(x + 8, yy, 30, 22, 0.1, 0, 6.3); ctx.fill(); ctx.stroke(); ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x - 6, yy - 18); ctx.lineTo(x - 22, yy - 40); ctx.moveTo(x + 8, yy - 18); ctx.lineTo(x + 20, yy - 42); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + 18, yy + 4); ctx.quadraticCurveTo(x + 44, yy + 12, x + 54, yy - 6); ctx.moveTo(x + 18, yy + 10); ctx.quadraticCurveTo(x + 44, yy + 26, x + 58, yy + 14); ctx.stroke();
        ctx.fillStyle = '#2a4a78'; ctx.beginPath(); ctx.arc(x + 8, yy - 4, 4.5, 0, 6.3); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + 9.5, yy - 5.5, 1.5, 0, 6.3); ctx.fill();
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }, 'front');
  c.uplift(mine, ['#ffffff', '#bfe8ff'], 'star', 14);
  await c.sleep(1.1);
  for (const t of tg) c.hitSpark(t, '#ffffff', 14);
  c.scene.shake(10, 0.35); c.scene.flash('#ffffff', 0.5); c.hit();
  await c.sleep(0.9);
};

// 张喵辽「八百踏津」：无数小肉垫印踏过渡口，水花一路炸开。
const ford: SkillFx = async (c) => {
  const k = c.caster; const tg = c.targets.length ? c.targets : c.foes; const [ex, ey] = c.center(tg); const dir = k.facing;
  focus(c, lerp(k.x, ex, 0.55), 345, 1.1, 0.4); c.dim(0.28, 0.2);
  c.pose('windup', 0.22); c.glow(k, '#7ab8ff');
  await c.sleep(0.35);
  const rnd = mulberry(8);
  const pr = Array.from({ length: 36 }, (_, i) => ({ x: lerp(k.x, ex + dir * 60, i / 35), y: ey + 52 + (rnd() - 0.5) * 70, d: i / 35, r: (rnd() - 0.5) * 0.7 }));
  c.vfx.custom(1.5, (ctx, p) => {
    ctx.save(); ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#4a8ad0'; ctx.lineWidth = 2;
    const q = clamp(p / 0.6);
    for (const f of pr) { if (q < f.d) continue; const a = fade(clamp((p - f.d * 0.6) / 0.5), 0.1, 0.6); ctx.globalAlpha = a * 0.9; ctx.beginPath(); ctx.ellipse(f.x, f.y + 16, 30 * (1 - a * 0.2), 9, 0, 0, 6.3); ctx.strokeStyle = hexA('#bfe8ff', a); ctx.stroke(); ctx.fillStyle = '#e8f6ff'; paw(ctx, f.x, f.y, 1.1, f.r); }
    ctx.restore();
  }, 'back');
  for (let i = 0; i < 8; i++) { const f = pr[i * 4 + 3]; c.vfx.burst({ x: f.x, y: f.y + 10, n: 8, speed: [60, 180], angle: -Math.PI / 2, spread: 1.6, life: [0.4, 0.8], size: [3, 6], color: ['#e8f6ff', '#9fd0ff'], shape: 'dot', gravity: 300 }); await c.sleep(0.08); }
  await c.sleep(0.3);
  for (const t of tg) { const [x, y] = t.anchor('chest'); c.vfx.slash(x, y, { r: 60, width: 14, life: 0.3, color: '#bfe8ff', core: '#fff' }); c.hitSpark(t, '#bfe8ff', 10); }
  c.scene.shake(10, 0.3); c.scene.flash('#e8f6ff', 0.4); c.hit();
  await c.sleep(0.9);
};

// 沙摩柯「五溪送瘴」：五缕绿雾自远处飘来，绕着敌人盘成一圈，弹丸从雾里飞出。
const marshMist: SkillFx = async (c) => {
  const k = c.caster; const tg = c.targets.length ? c.targets : c.foes; const [ex, ey] = c.center(tg);
  focus(c, lerp(k.x, ex, 0.5), 340, 1.08, 0.4); c.dim(0.3, 0.2);
  c.pose('castFwd', 0.25); c.glow(k, '#8affb0');
  await c.sleep(0.3);
  c.vfx.custom(2.0, (ctx, p, t) => {
    ctx.save(); const a = fade(p, 0.15, 0.75);
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * 6.28 + t * 1.4; const r = lerp(260, 100, ease.outCubic(clamp(p / 0.4)));
      const x = ex + Math.cos(ang) * r, y = ey + 30 + Math.sin(ang) * r * 0.36;
      const g = ctx.createRadialGradient(x, y, 4, x, y, 90); g.addColorStop(0, hexA('#d8ffd0', 0.85 * a)); g.addColorStop(0.5, hexA('#5ac878', 0.5 * a)); g.addColorStop(1, hexA('#2a8a50', 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 90, 0, 6.3); ctx.fill();
    }
    ctx.restore();
  }, 'front');
  await c.sleep(0.9);
  for (const t of tg) { const [sx, sy] = k.anchor('hand'); const [x, y] = t.anchor('chest'); void c.vfx.projectile(sx, sy, x, y, { speed: 900, arc: 40, draw: (ctx, px, py) => { ctx.fillStyle = '#7a5a2a'; ctx.strokeStyle = '#3a2a10'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, 7, 0, 6.3); ctx.fill(); ctx.stroke(); }, trail: { color: '#8affb0', size: [3, 6], n: 2 } }); await c.sleep(0.08); }
  await c.sleep(0.4);
  for (const t of tg) c.hitSpark(t, '#8affb0', 10);
  c.scene.shake(8, 0.3); c.scene.flash('#d8ffd0', 0.35); c.hit();
  await c.sleep(1.0);
};

// 黄忠忠「百步铃箭」：一支系着小金铃的长箭飞出，铃声化作一圈圈声波，沿途越来越亮。
const bellArrow: SkillFx = async (c) => {
  const k = c.caster; const tg = c.targets.length ? c.targets : c.foes; const [ex, ey] = c.center(tg); const [sx, sy] = k.anchor('hand');
  focus(c, lerp(k.x, ex, 0.5), 330, 1.08, 0.4); c.dim(0.3, 0.2);
  c.pose('windup', 0.3); c.glow(k, '#ffd24a');
  c.vfx.ring(sx, sy, { r0: 40, r1: 6, life: 0.5, color: '#ffd24a', width: 5 });
  await c.sleep(0.55);
  c.pose('strike', 0.08);
  const tx = ex, ty = ey - 30;
  c.vfx.custom(1.0, (ctx, p, t) => {
    const q = ease.in(clamp(p / 0.7)); const x = lerp(sx, tx, q), y = lerp(sy, ty, q);
    const ang = Math.atan2(ty - sy, tx - sx);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) { const u = ((t * 3 + i / 6) % 1); const bx = lerp(sx, x, u), by = lerp(sy, y, u); ctx.strokeStyle = hexA('#ffe27a', (1 - u) * 0.8); ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(bx, by, 10 + u * 34, 0, 6.3); ctx.stroke(); }
    ctx.globalCompositeOperation = 'source-over'; ctx.translate(x, y); ctx.rotate(ang);
    ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-70, 0); ctx.lineTo(0, 0); ctx.stroke();
    ctx.fillStyle = '#dfe8f0'; ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(20, 0); ctx.lineTo(0, 7); ctx.fill();
    ctx.fillStyle = '#ffd24a'; ctx.strokeStyle = '#8a5a10'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(-34, 8, 8, 0, 6.3); ctx.fill(); ctx.stroke();
    ctx.restore();
  }, 'front');
  await c.sleep(0.75);
  for (const t of tg) { c.hitSpark(t, '#ffe27a', 14); const [x, y] = t.anchor('chest'); c.vfx.ring(x, y, { r0: 8, r1: 110, life: 0.6, color: '#ffe27a', width: 6 }); }
  c.scene.shake(12, 0.35); c.scene.flash('#fff3b0', 0.45); c.hit();
  await c.sleep(1.0);
};

// 华雄雄「温盏叫阵」：大斧落地，一盏热茶的蒸汽冲击波圈圈荡开。
const teaChallenge: SkillFx = async (c) => {
  const k = c.caster; const tg = c.targets.length ? c.targets : c.foes; const [ex, ey] = c.center(tg);
  focus(c, lerp(k.x, ex, 0.5), 345, 1.1, 0.4); c.dim(0.3, 0.2);
  c.pose('windup', 0.3); c.glow(k, '#c08aff');
  await c.sleep(0.4);
  await c.jump(90, 0.3);
  c.pose('strike', 0.08);
  c.scene.shake(16, 0.5); c.scene.flash('#f0e0ff', 0.5);
  c.vfx.ring(k.bx, k.by, { r0: 20, r1: 420, life: 0.9, color: '#c08aff', width: 12, squash: 0.4 });
  c.vfx.ring(k.bx, k.by, { r0: 10, r1: 300, life: 0.7, color: '#ffffff', width: 6, squash: 0.4 });
  c.vfx.custom(1.5, (ctx, p, t) => {
    ctx.save(); const a = fade(p, 0.05, 0.7);
    for (let i = 0; i < 7; i++) { const x = ex + (i - 3) * 55 + Math.sin(t * 3 + i) * 10; const y = ey + 40 - ((t * 60 + i * 30) % 160); ctx.fillStyle = hexA('#ffffff', a * (1 - ((t * 60 + i * 30) % 160) / 160) * 0.7); ctx.beginPath(); ctx.ellipse(x, y, 16, 22, 0, 0, 6.3); ctx.fill(); }
    ctx.restore();
  }, 'front');
  await c.sleep(0.5);
  for (const t of tg) c.hitSpark(t, '#e0c8ff', 14);
  c.hit();
  await c.sleep(1.0);
};

export const SKILL_FX4: Record<string, SkillFx> = {
  'ult.brocadeCharge': brocadeCharge,
  'ult.whiteDragon': whiteDragon,
  'ult.ford': ford,
  'ult.marshMist': marshMist,
  'ult.bellArrow': bellArrow,
  'ult.teaChallenge': teaChallenge,
};
