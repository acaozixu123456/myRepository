// 无头浏览器截图：node tools/journey-shot.mjs <页面路径?参数> <输出.png> [宽 高 倍率]
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const req = createRequire(import.meta.url);
let pw; try { pw = req('playwright'); } catch { pw = req(execSync('npm root -g').toString().trim() + '/playwright'); }
const [, , path, out, w = '1200', h = '800', dpr = '1'] = process.argv;
const port = 5190 + Math.floor(Math.random() * 300);
const server = await createServer({ server: { port }, logLevel: 'error' }); await server.listen();
const b = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dpr });
p.on('pageerror', e => console.error('PAGEERR', e.message));
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning' || m.text().startsWith('[j]')) console.log('CONSOLE', m.type(), m.text()); });
const t0 = Date.now();
await p.goto(`http://localhost:${port}/${path}`);
await p.waitForFunction(() => window.__ready, null, { timeout: +(process.env.SHOT_TIMEOUT || 240000) });
const info = await p.evaluate(() => window.__info || null);
await p.screenshot({ path: out });
console.log('shot', out, (Date.now() - t0) + 'ms', info ? JSON.stringify(info) : '');
await b.close(); await server.close();
