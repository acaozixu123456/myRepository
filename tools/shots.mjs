// 截图工具：node tools/shots.mjs <url> <out.png> [width] [height] [selector]
import { chromium } from 'playwright-core';
const [url, out, w = '1280', h = '900', sel] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('PAGEERROR', e.message));
page.on('console', (m) => m.type() === 'error' && console.error('CONSOLE', m.text()));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
if (sel) await (await page.$(sel)).screenshot({ path: out });
else await page.screenshot({ path: out, fullPage: true });
await browser.close();
