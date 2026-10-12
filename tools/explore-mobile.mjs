// 手机视口检查：触屏、390×780，进探索场景，量技能按钮 / 战斗按钮 / 摇杆 / HUD 的尺寸与是否重叠，并真的用触摸点一下技能。先 npm run dev。
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const p = await ctx.newPage();
p.on('pageerror', (e) => console.error('PAGEERROR', e.message));
await p.goto('http://127.0.0.1:5173/?dev=1&nostory=1&rich=1&r3d=1', { waitUntil: 'networkidle' });
await p.waitForTimeout(1200);
await p.evaluate(() => document.querySelector('#nav [data-to=explore]').click());
await p.waitForFunction(() => getComputedStyle(document.getElementById('xload')).display === 'none', null, { timeout: 120000 });
await p.waitForTimeout(1500);
// 关掉首次帮助卡
await p.evaluate(() => document.querySelector('.mask [data-act=closedialog], .dialog [data-act=closedialog]')?.click());
await p.waitForTimeout(300);
const rects = await p.evaluate(() => {
  const q = (s) => [...document.querySelectorAll(s)].map((e) => { const r = e.getBoundingClientRect(); return { k: e.dataset.k ?? e.id ?? e.className, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; });
  return { skills: q('.xsk'), joy: q('#xjoy'), fight: q('#xfight'), side: q('.xplore button, [data-screen=explore] .xside button'), vw: innerWidth, vh: innerHeight };
});
const hit = (a, c) => a.x < c.x + c.w && c.x < a.x + a.w && a.y < c.y + c.h && c.y < a.y + a.h;
const problems = [];
for (const s of rects.skills) {
  if (s.h < 40) problems.push(`技能按钮 ${s.k} 高度 ${s.h}px < 40`);
  for (const j of rects.joy) if (hit(s, j)) problems.push(`技能按钮 ${s.k} 与摇杆重叠`);
  for (const f of rects.fight) if (f.w > 0 && hit(s, f)) problems.push(`技能按钮 ${s.k} 与战斗按钮重叠`);
  if (s.x < 0 || s.x + s.w > rects.vw) problems.push(`技能按钮 ${s.k} 超出屏幕`);
}
// 触摸点灵视（队里有谋士 / 医者时可用）
const before = await p.evaluate(() => document.querySelector('.xsk[data-k=reveal]')?.className);
const box = await p.evaluate(() => { const r = document.querySelector('.xsk[data-k=reveal]')?.getBoundingClientRect(); return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null; });
if (box) await p.touchscreen.tap(box.x, box.y);
await p.waitForTimeout(500);
const after = await p.evaluate(() => document.querySelector('.xsk[data-k=reveal]')?.className);
await p.screenshot({ path: '.shots/mobile-explore.png' });
console.log(JSON.stringify({ rects, problems, revealBefore: before, revealAfter: after }));
await b.close();
