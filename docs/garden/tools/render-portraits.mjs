// 用无头浏览器把职业和怪物模型渲染成头像 PNG：npm run portraits
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
// playwright 用系统预装的那份，不进依赖
const req = createRequire(import.meta.url);
let pw; try { pw = req('playwright'); } catch { pw = req(execSync('npm root -g').toString().trim() + '/playwright'); }
const { chromium } = pw;
import { mkdirSync, writeFileSync } from 'node:fs';
const server = await createServer({ server: { port: 5191 }, logLevel: 'error' }); await server.listen();
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage(); p.on('pageerror', e => console.error(e));
await p.goto('http://localhost:5191/tools/portrait/index.html'); await p.waitForFunction(() => window.portraitReady);
const out = await p.evaluate(() => window.renderAll());
mkdirSync('public/portraits', { recursive: true });
for (const [k, url] of Object.entries(out)) writeFileSync(`public/portraits/${k}.png`, Buffer.from(url.split(',')[1], 'base64'));
console.log('头像已生成：', Object.keys(out).length, '张');
await b.close(); await server.close();
