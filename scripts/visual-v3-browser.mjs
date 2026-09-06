import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const base=process.env.EXPLORE_BASE||'http://127.0.0.1:4173';
const out=process.env.EXPLORE_ARTIFACTS||'/tmp/visual-v3';mkdirSync(out,{recursive:true});
execFileSync('node_modules/.bin/esbuild',['scripts/explore-fixture.ts','--bundle','--platform=node','--outfile=/tmp/explore-fixture.cjs']);execFileSync('node',['/tmp/explore-fixture.cjs']);
const fixtures=JSON.parse(readFileSync('/tmp/explore-fixture.json','utf8'));
const report={scope:'Desktop visual/game acceptance only. No NHK regression and no mobile acceptance.',syntheticData:true,realAIRequests:0,cases:[],diagnostics:[],errors:[]};
const record=(name)=>{report.cases.push({name,result:'PASS'});console.log('PASS',name)};
let browser;
async function pageFor(fixture,viewport={width:1440,height:900}){
  const context=await browser.newContext({viewport,deviceScaleFactor:1,serviceWorkers:'block'});
  await context.addInitScript(({fixture})=>localStorage.setItem('nihongo.explore.yanaka.v1',JSON.stringify(fixture)),{fixture});
  const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',error=>report.errors.push(error.message));
  await page.route('**/api/nhk-speech',route=>route.fulfill({status:503,json:{ok:false,reason:'visual-test-no-ai'}}));
  await page.goto(base+'/explore.html?qa=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#explore-root')?.dataset.ready,{},{timeout:60000});
  assert.equal(await page.locator('#explore-root').getAttribute('data-ready'),'true');
  await page.waitForTimeout(1000);
  return {context,page};
}
async function snap(page,name){await page.screenshot({path:`${out}/${name}.png`,timeout:60000});}
try{
  browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  {
    const {context,page}=await pageFor(fixtures.fresh);await snap(page,'01-entry');await page.locator('#start').click();
    const before=(await page.evaluate(()=>window.__explore.read())).world.pose;
    await page.keyboard.down('w');await page.waitForTimeout(1800);await page.keyboard.up('w');
    const after=(await page.evaluate(()=>window.__explore.read())).world.pose;assert(after.z>before.z+.12,'desktop movement failed');
    await snap(page,'02-street');report.diagnostics.push({street:await page.evaluate(()=>window.__explore.read())});record('desktop scene renders and moves with cinematic HUD');await context.close();
  }
  {
    const {context,page}=await pageFor(fixtures.door,{width:1280,height:800});await page.locator('#start').click();
    const start=(await page.evaluate(()=>window.__explore.read())).world.pose;
    const inwardOf=p=>(p.x-start.x)*fixtures.normal.x+(p.z-start.z)*fixtures.normal.z;
    await page.keyboard.down('w');
    try{
      await page.waitForFunction(({start,normal})=>{const p=window.__explore.read().world.pose;const inward=(p.x-start.x)*normal.x+(p.z-start.z)*normal.z;return inward>1.58;},{start,normal:fixtures.normal},{timeout:45000});
      await page.waitForTimeout(5000);
    }finally{await page.keyboard.up('w');}
    const end=(await page.evaluate(()=>window.__explore.read())).world.pose;const inward=inwardOf(end);
    report.diagnostics.push({doorwayInward:inward,start,end});assert(inward>1.55,'shop doorway is blocked');assert(inward<4.7,'counter collision failed');
    await snap(page,'03-doorway');record('shop doorway remains walkable and counter remains solid after visual changes');await context.close();
  }
  {
    const {context,page}=await pageFor(fixtures.shop,{width:1280,height:800});await page.locator('#start').click();
    await page.waitForFunction(()=>window.__explore.read().world.nearest==='shop',{},{timeout:20000});await snap(page,'04-shop');
    await page.keyboard.press('e');await page.locator('#reply-form').waitFor();await snap(page,'05-dialogue-sheet');
    const box=await page.locator('.panel').boundingBox();assert(box&&box.y>300,'dialogue should preserve upper scene instead of covering the center');
    record('shop lighting and bottom dialogue sheet render');await context.close();
  }
  assert.deepEqual(report.errors,[],'uncaught browser errors');record('no uncaught renderer errors');
}catch(error){report.failure=String(error.stack||error);console.error(error);process.exitCode=1;}finally{writeFileSync(`${out}/visual-report.json`,JSON.stringify(report,null,2));await browser?.close();}
