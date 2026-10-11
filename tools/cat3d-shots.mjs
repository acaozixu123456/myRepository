// 3D 小猫截图：先 `npm run dev`（默认 5173），再
//   node tools/cat3d-shots.mjs <out.png> "ids=wei_caomiaode,shu_guanyunmiao&poses=idle,windup,strike&yaw=32&w=300"
// 可用 poses：idle ready windup windupLow strike thrust cast castUp castFwd guard hurt dash victory slump
import { chromium } from 'playwright-core';
const [out = '.shots/cat3d.png', query = ''] = process.argv.slice(2);
const port = process.env.PORT ?? '5173';
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
p.on('pageerror', (e) => console.error('PAGEERROR', e.message));
await p.goto(`http://127.0.0.1:${port}/cat3d.html?${query}`, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.done, null, { timeout: 60000 });
await p.screenshot({ path: out, fullPage: true });
console.log('saved', out);
await b.close();
