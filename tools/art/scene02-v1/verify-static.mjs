// Actual browser presentation of static artwork, no animation/performance workload.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const out=path.join(root,'docs/living-scene/scene02-v1/evidence');
const {chromium}=await import('/Users/xiaruonan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:false,args:['--disable-backgrounding-occluded-windows']});
const page=await browser.newPage({viewport:{width:2560,height:1440},deviceScaleFactor:1});
const errors=[],images=[];page.on('pageerror',e=>errors.push(String(e)));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
try {
 for(const id of ['hero','dim','clear','latte-detail']) {
  await page.goto(`http://127.0.0.1:8779/docs/living-scene/scene02-v1/${id}.html`);
  await page.locator('img').evaluate(img=>img.decode());
  const dimensions=await page.locator('img').evaluate(img=>({native:[img.naturalWidth,img.naturalHeight],display:[img.clientWidth,img.clientHeight],loaded:img.complete}));
  if(!dimensions.loaded||dimensions.native[0]<1000)throw new Error('Missing or undersized artwork: '+id);
  await page.screenshot({path:path.join(out,`${id}-browser.png`)});
  images.push({id,...dimensions});
 }
 if(errors.length)throw new Error(errors.join('\n'));
 await fs.writeFile(path.join(out,'browser-check.json'),JSON.stringify({date:new Date().toISOString(),browser:await browser.version(),viewport:[2560,1440],deviceScaleFactor:1,images,errors,scope:'Static image loading and 16:9 presentation only. Browser viewport size is not native artwork resolution. No interaction or performance benchmark.'},null,2)+'\n');
 console.log(JSON.stringify({images,errors},null,2));
} finally {await browser.close();}
