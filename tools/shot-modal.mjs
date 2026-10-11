import { chromium } from 'playwright-core';
const [url, out, w = '1280', h = '900', clickSel = '[data-open]'] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
await p.goto(url, { waitUntil: 'networkidle' });
await p.click(clickSel);
await p.waitForTimeout(600);
await p.screenshot({ path: out });
await b.close();
