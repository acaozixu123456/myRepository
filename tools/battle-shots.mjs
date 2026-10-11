// 逐帧步进战斗演示并截图：node tools/battle-shots.mjs "<query>" <outPrefix> <stepSec> <count> [startAt]
import { chromium } from 'playwright-core';
const [query = '', out = '.shots/bt', stepSec = '0.5', count = '12', startAt = '0'] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 980, height: 620 }, deviceScaleFactor: 1 });
p.on('pageerror', (e) => console.error('PAGEERROR', e.message));
p.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && console.error('CONSOLE', m.text()));
await p.goto(`http://127.0.0.1:5173/battle.html?test=1&${query}`, { waitUntil: 'networkidle' });
await p.waitForFunction(() => document.getElementById('loading').style.display === 'none', null, { timeout: 60000 });
if (+startAt > 0) await p.evaluate((s) => window.__demo.step(s), +startAt);
for (let i = 0; i < +count; i++) {
  await p.evaluate((s) => window.__demo.step(s), +stepSec);
  await (await p.$('canvas')).screenshot({ path: `${out}_${String(i).padStart(2, '0')}.png` });
}
console.log(await p.evaluate(() => document.getElementById('log').textContent));
await b.close();
