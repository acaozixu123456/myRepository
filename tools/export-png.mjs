// 把 assets/heroes/svg/*.svg 渲染成透明背景 PNG：node tools/export-png.mjs
import { chromium } from 'playwright-core';
import { readdirSync, readFileSync } from 'node:fs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 720, height: 810 }, deviceScaleFactor: 1 });
for (const f of readdirSync('assets/heroes/svg').filter((x) => x.endsWith('.svg'))) {
  const svg = readFileSync(`assets/heroes/svg/${f}`, 'utf8').replace('width="480" height="540"', 'width="720" height="810"');
  await p.setContent(`<body style="margin:0;background:transparent">${svg}</body>`);
  await p.screenshot({ path: `assets/heroes/${f.replace('.svg', '.png')}`, omitBackground: true });
}
await b.close();
