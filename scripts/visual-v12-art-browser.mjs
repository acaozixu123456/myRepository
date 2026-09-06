import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const base=process.env.EXPLORE_BASE||'http://127.0.0.1:4173';
const out=process.env.EXPLORE_ARTIFACTS||'/tmp/visual-v12';mkdirSync(out,{recursive:true});
execFileSync('node_modules/.bin/esbuild',['scripts/explore-fixture.ts','--bundle','--platform=node','--outfile=/tmp/explore-fixture.cjs']);execFileSync('node',['/tmp/explore-fixture.cjs']);
const fixtures=JSON.parse(readFileSync('/tmp/explore-fixture.json','utf8'));
const report={scope:'Desktop GLB integration acceptance. No NHK regression and no mobile claim.',syntheticData:true,realAIRequests:0,cases:[],diagnostics:[],errors:[]};
const record=name=>{report.cases.push({name,result:'PASS'});console.log('PASS',name)};
let browser;
async function pageFor(fixture,{failArt=false}={}){
  const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:.75,serviceWorkers:'block'});
  await context.addInitScript(({fixture})=>localStorage.setItem('nihongo.explore.yanaka.v1',JSON.stringify(fixture)),{fixture});
  const page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',error=>report.errors.push(error.message));
  await page.route('**/api/nhk-speech',route=>route.fulfill({status:503,json:{ok:false,reason:'art-test-no-ai'}}));
  if(failArt)await page.route('**/explore/assets/desktop-v1/*.glb',route=>route.abort('failed'));
  await page.goto(base+'/explore.html?qa=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#explore-root')?.dataset.ready==='true',undefined,{timeout:60000});
  await page.waitForFunction(expected=>{const status=window.__explore.read().world.artStatus;return expected==='fail'?status==='failed':status==='ready';},failArt?'fail':'ready',{timeout:120000});
  return {context,page};
}
async function snap(page,name){await page.screenshot({path:`${out}/${name}.png`,timeout:120000});}
try{
  browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  {
    const {context,page}=await pageFor(fixtures.fresh);const state=await page.evaluate(()=>window.__explore.read());
    assert.equal(state.world.artStatus,'ready');assert(state.world.artMeshCount>20);assert.equal(state.world.heroProxyVisible,0);assert.deepEqual([...state.world.artAnimations].sort(),['greet','idle','talk']);
    await snap(page,'01-entry-art');await page.locator('#start').click();await page.keyboard.down('w');await page.waitForTimeout(1500);await page.keyboard.up('w');await snap(page,'02-street-art');
    report.diagnostics.push({loaded:state.world});record('shop and keeper GLBs replace procedural hero visuals');await context.close();
  }
  {
    const {context,page}=await pageFor(fixtures.door);await page.locator('#start').click();const start=(await page.evaluate(()=>window.__explore.read())).world.pose;
    await page.keyboard.down('w');try{await page.waitForFunction(({start,normal})=>{const p=window.__explore.read().world.pose;const d=(p.x-start.x)*normal.x+(p.z-start.z)*normal.z;return d>1.58;},{start,normal:fixtures.normal},{timeout:45000});}finally{await page.keyboard.up('w');}
    const end=(await page.evaluate(()=>window.__explore.read())).world.pose,inward=(end.x-start.x)*fixtures.normal.x+(end.z-start.z)*fixtures.normal.z;assert(inward<4.7,'counter proxy no longer blocks');
    report.diagnostics.push({doorwayInward:inward,start,end});record('GLB shop preserves doorway and collision proxy');await context.close();
  }
  {
    const {context,page}=await pageFor(fixtures.shop);await page.locator('#start').click();await page.waitForFunction(()=>window.__explore.read().world.nearest==='shop',undefined,{timeout:25000});await snap(page,'04-keeper-art');
    await page.keyboard.press('e');await page.locator('#reply-form').waitFor();await snap(page,'05-dialogue-art');record('integrated keeper remains visible with bottom dialogue UI');await context.close();
  }
  {
    const {context,page}=await pageFor(fixtures.shop,{failArt:true});const state=await page.evaluate(()=>window.__explore.read());assert.equal(state.world.artStatus,'failed');assert(state.world.heroProxyVisible>0,'procedural fallback was hidden after GLB failure');
    await page.locator('#start').click();record('failed GLB requests retain procedural fallback instead of blank shop');await context.close();
  }
  assert.deepEqual(report.errors,[],'uncaught browser errors');record('no uncaught renderer errors');
}catch(error){report.failure=String(error.stack||error);console.error(error);process.exitCode=1;}finally{writeFileSync(`${out}/art-integration-report.json`,JSON.stringify(report,null,2));await browser?.close();}
