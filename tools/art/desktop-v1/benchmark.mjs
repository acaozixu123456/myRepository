// Sustained actual-hardware measurements without recording or screenshot readback during sampling.
import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:false,args:['--use-angle=metal']});
const ctx=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:2});const page=await ctx.newPage();await page.goto('http://127.0.0.1:8766');await page.waitForFunction(()=>window.assetReady);
const runs=[];
for(const kind of ['shop','keeper']){
 if(kind==='keeper'){await page.locator('#asset').selectOption('keeper');await page.waitForFunction(()=>review.report().loaded&&review.report().asset==='keeper');await page.locator('#clip').selectOption('talk');}
 for(const scaling of [1/1.5,1]){
  await page.evaluate(s=>{review.engine.setHardwareScalingLevel(s);review.engine.resize();review.pose('front');review.setRotation(true);},scaling);await page.waitForTimeout(3000);await page.evaluate(()=>review.startMeasurement());await page.waitForTimeout(15000);runs.push({scenario:kind+' orbit; recording disabled',...await page.evaluate(()=>review.report())});
 }
 await page.evaluate(()=>{review.setRotation(false);review.pose('detail');review.startMeasurement();});
 for(let i=0;i<100;i++){await page.evaluate(({i,kind})=>{review.camera.alpha=-Math.PI/2+Math.sin(i/20)*.18;if(kind==='shop')review.camera.radius=4.2-i/100*2.6;},{i,kind});await page.waitForTimeout(100);}
 runs.push({scenario:kind==='shop'?'doorway-to-counter movement; recording disabled':'animated character close-up; recording disabled',...await page.evaluate(()=>review.report())});
}
await fs.writeFile(path.join(root,'docs/art/desktop-v1/evidence/performance-no-recording.json'),JSON.stringify({browserVersion:browser.version(),physicalPanel:[2880,1800],DPRContext:2,method:'headed Chrome ANGLE Metal; 1280x800 viewport; rAF interval distributions; three-second warmup before sustained orbit; no video or screenshot capture while measuring; no offline renderer running; not a full-game FPS result',runs},null,2)+'\n');console.log(JSON.stringify(runs.map(r=>({scenario:r.scenario,res:r.renderResolution,p50:r.frameTimeMs.p50,p95:r.frameTimeMs.p95,p99:r.frameTimeMs.p99,software:r.softwareRenderer}))));await browser.close();if(runs.some(r=>r.softwareRenderer||!r.frameSamples))process.exitCode=1;
