// 无头浏览器调试：node tools/journey-eval.mjs <页面路径?参数（带 debug）> <js 文件> [输出.png] [宽 高 倍率]
// js 文件的内容在页面里执行（可以用 __J、__scene、__R、__cam、__W、__post），返回值打印出来；之后截一张图。
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const req = createRequire(import.meta.url);
let pw; try { pw = req('playwright'); } catch { pw = req(execSync('npm root -g').toString().trim() + '/playwright'); }
const [, , path, js, out, w = '1280', h = '720', dpr = '1'] = process.argv;
const port = 5490 + Math.floor(Math.random() * 300);
const server = await createServer({ server: { port }, logLevel: 'error' }); await server.listen();
const b = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dpr });
p.on('pageerror', e => console.error('PAGEERR', e.message));
p.on('console', m => { if (m.type() === 'error' || m.text().startsWith('[j]') || m.text().startsWith('THREE.WebGLProgram')) console.log('CONSOLE', m.type(), m.text().slice(0, 1500)); });
await p.goto(`http://localhost:${port}/${path}`);
await p.waitForFunction(() => window.__ready, null, { timeout: +(process.env.SHOT_TIMEOUT || 240000) });
const res = await p.evaluate(`(async () => { ${readFileSync(js, 'utf8')} })()`);
console.log(JSON.stringify(res));
if (out) await p.screenshot({ path: out });
await b.close(); await server.close();
