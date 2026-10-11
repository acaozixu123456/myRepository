// 乱点测试：随机点击所有可点击按钮 + 随机切换页面，捕获页面报错。需要先 npm run dev。
// 用法：node tools/monkey.mjs [种子] [步数]   （默认种子 1、130 步；每步约 1 秒）
import { chromium } from 'playwright-core';
const seed0 = Number(process.argv[2] || 1);
const STEPS = Number(process.argv[3] || 130);
let x = seed0 * 2654435761 % 4294967296;
const rnd = () => { x = (x * 1664525 + 1013904223) % 4294967296; return x / 4294967296; };
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args:['--no-sandbox']});
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = new Set();
p.on('pageerror', e => errs.add('pageerror: ' + e.message));
p.on('console', m => m.type()==='error' && !m.text().includes('404') && !m.text().includes('net::') && errs.add('console: ' + m.text().slice(0, 200)));
await p.goto('http://127.0.0.1:5173/app.html?nostory=1&rich=1');
await p.waitForTimeout(2000);
await p.evaluate(() => window.__app.loop.setSpeed(16));
const screens = ['home','lineup','gacha','campaign','bag','quests','shop','pay','social','events'];
let clicks = 0;
for (let i = 0; i < STEPS; i++) {
  if (rnd() < 0.12) { const s = screens[Math.floor(rnd() * screens.length)]; await p.evaluate((s) => { document.querySelectorAll('.mask').forEach(m => m.remove()); window.__app.go(s); }, s); await p.waitForTimeout(80); continue; }
  const els = await p.$$('[data-act]:not([disabled]):not([data-act=reset1]):not([data-act=reset2]):not([data-act=bgo]):not([data-act=g-boss-go]):not([data-act=dgo]):not([data-act=tgo]):not([data-act=arena-go]):not([data-act=ev-buy-ok]):not([data-act=pay-ok])');
  const vis = [];
  for (const e of els) if (await e.isVisible().catch(() => false)) vis.push(e);
  if (!vis.length) continue;
  const e = vis[Math.floor(rnd() * vis.length)];
  try { await e.click({ timeout: 800, force: true }); clicks++; } catch {}
  await p.waitForTimeout(60);
  if (rnd() < 0.25) await p.evaluate(() => document.querySelectorAll('.mask').forEach(m => m.remove()));
}
console.log('seed', seed0, 'clicks', clicks, errs.size ? [...errs].join('\n') : 'no errors');
if (errs.size) process.exitCode = 1;
await b.close();
