import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const base=process.env.EXPLORE_BASE||'http://127.0.0.1:4173';
const out=process.env.EXPLORE_ARTIFACTS||'/tmp/visual-v14';mkdirSync(out,{recursive:true});
execFileSync('node_modules/.bin/esbuild',['scripts/explore-fixture.ts','--bundle','--platform=node','--outfile=/tmp/explore-fixture.cjs']);execFileSync('node',['/tmp/explore-fixture.cjs']);
const fixtures=JSON.parse(readFileSync('/tmp/explore-fixture.json','utf8'));
const report={scope:'Desktop cinematic dialogue + keeper animation only. No NHK or mobile regression.',syntheticData:true,realAIRequests:0,cases:[],diagnostics:[],errors:[]};
const pass=name=>{report.cases.push({name,result:'PASS'});console.log('PASS',name)};
let browser;
try{
  browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:.60,serviceWorkers:'block'});
  await context.addInitScript(fixture=>localStorage.setItem('nihongo.explore.yanaka.v1',JSON.stringify(fixture)),fixtures.shop);
  const page=await context.newPage();page.setDefaultTimeout(45000);page.on('pageerror',e=>report.errors.push(e.message));
  await page.route('**/api/nhk-speech',route=>route.fulfill({status:503,json:{ok:false,reason:'cinematic-test-no-ai'}}));
  await page.goto(base+'/explore.html?qa=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#explore-root')?.dataset.ready==='true',undefined,{timeout:60000});
  await page.waitForFunction(()=>window.__explore.read().world.artStatus==='ready',undefined,{timeout:120000});
  await page.locator('#start').click();await page.waitForFunction(()=>window.__explore.read().world.nearest==='shop',undefined,{timeout:30000});
  let state=await page.evaluate(()=>window.__explore.read().world);assert.equal(String(state.artActiveAnimation).toLowerCase(),'idle');
  await page.screenshot({path:`${out}/01-idle-keeper.png`,timeout:120000});pass('keeper idles naturally before interaction');

  await page.keyboard.press('e');await page.locator('#reply-form').waitFor();await page.waitForFunction(()=>String(window.__explore.read().world.artActiveAnimation).toLowerCase()==='talk',undefined,{timeout:5000});
  const panel=await page.locator('#modal-layer .panel').boundingBox();assert(panel);assert(panel.x<80);assert(panel.width<=580);assert(panel.y>500);
  const style=await page.locator('#modal-layer .panel').evaluate(el=>{const p=getComputedStyle(el),spoken=getComputedStyle(el.querySelector('.spoken')),avatar=getComputedStyle(el.querySelector('.avatar-dot'));return{background:p.backgroundColor,borderTop:p.borderTopWidth,boxShadow:p.boxShadow,spokenBackground:spoken.backgroundColor,avatarDisplay:avatar.display};});
  assert.equal(style.background,'rgba(0, 0, 0, 0)');assert.equal(style.borderTop,'0px');assert.equal(style.spokenBackground,'rgba(0, 0, 0, 0)');assert.equal(style.avatarDisplay,'none');
  state=await page.evaluate(()=>window.__explore.read().world);report.diagnostics.push({panel,style,state});
  await page.screenshot({path:`${out}/02-talk-subtitle.png`,timeout:120000});pass('shop dialogue reads as a cinematic subtitle layer while talk animation runs');

  await page.locator('.close-panel').click();await page.waitForFunction(()=>String(window.__explore.read().world.artActiveAnimation).toLowerCase()==='idle',undefined,{timeout:5000});pass('closing dialogue returns keeper to idle');
  assert.deepEqual(report.errors,[]);pass('no uncaught renderer errors');await context.close();
}catch(error){report.failure=String(error.stack||error);console.error(error);process.exitCode=1;}finally{writeFileSync(`${out}/cinematic-report.json`,JSON.stringify(report,null,2));await browser?.close();}
