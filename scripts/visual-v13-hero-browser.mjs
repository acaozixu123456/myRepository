import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const base=process.env.EXPLORE_BASE||'http://127.0.0.1:4173';
const out=process.env.EXPLORE_ARTIFACTS||'/tmp/visual-v13';mkdirSync(out,{recursive:true});
execFileSync('node_modules/.bin/esbuild',['scripts/explore-fixture.ts','--bundle','--platform=node','--outfile=/tmp/explore-fixture.cjs']);execFileSync('node',['/tmp/explore-fixture.cjs']);
const fixtures=JSON.parse(readFileSync('/tmp/explore-fixture.json','utf8'));
const report={scope:'Desktop hero presentation only: integrated GLB lighting and dialogue placement. No NHK or mobile regression.',syntheticData:true,realAIRequests:0,cases:[],diagnostics:[],errors:[]};
let browser;
const pass=name=>{report.cases.push({name,result:'PASS'});console.log('PASS',name)};
try{
  browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:.65,serviceWorkers:'block'});
  await context.addInitScript(fixture=>localStorage.setItem('nihongo.explore.yanaka.v1',JSON.stringify(fixture)),fixtures.shop);
  const page=await context.newPage();page.setDefaultTimeout(45000);page.on('pageerror',e=>report.errors.push(e.message));
  await page.route('**/api/nhk-speech',route=>route.fulfill({status:503,json:{ok:false,reason:'presentation-test-no-ai'}}));
  await page.goto(base+'/explore.html?qa=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#explore-root')?.dataset.ready==='true',undefined,{timeout:60000});
  await page.waitForFunction(()=>window.__explore.read().world.artStatus==='ready',undefined,{timeout:120000});
  await page.locator('#start').click();
  await page.waitForFunction(()=>window.__explore.read().world.nearest==='shop',undefined,{timeout:30000});
  const world=await page.evaluate(()=>window.__explore.read().world);assert.equal(world.artStatus,'ready');assert.equal(world.heroProxyVisible,0);assert.deepEqual([...world.artAnimations].sort(),['greet','idle','talk']);
  await page.screenshot({path:`${out}/01-keeper-presentation.png`,timeout:120000});pass('integrated keeper renders under local hero lighting');
  await page.keyboard.press('e');await page.locator('#reply-form').waitFor();
  const panel=await page.locator('#modal-layer .panel').boundingBox();assert(panel,'dialogue panel missing');assert(panel.x<80,'dialogue panel is not left anchored');assert(panel.width<=620,'dialogue panel is still too wide');assert(panel.y>430,'dialogue panel covers too much of the upper scene');
  report.diagnostics.push({world,panel});await page.screenshot({path:`${out}/02-dialogue-presentation.png`,timeout:120000});pass('dialogue stays left/bottom and preserves the hero character');
  assert.deepEqual(report.errors,[]);pass('no uncaught renderer errors');await context.close();
}catch(error){report.failure=String(error.stack||error);console.error(error);process.exitCode=1;}finally{writeFileSync(`${out}/presentation-report.json`,JSON.stringify(report,null,2));await browser?.close();}
