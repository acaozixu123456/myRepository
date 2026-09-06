import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const base=process.env.EXPLORE_BASE||'http://127.0.0.1:4173';
const out=process.env.EXPLORE_ARTIFACTS||'/tmp/explore-artifacts';mkdirSync(out,{recursive:true});
execFileSync('node_modules/.bin/esbuild',['scripts/explore-fixture.ts','--bundle','--platform=node','--outfile=/tmp/explore-fixture.cjs']);execFileSync('node',['/tmp/explore-fixture.cjs']);
const f=JSON.parse(readFileSync('/tmp/explore-fixture.json','utf8'));
const report={syntheticData:true,realAIRequests:0,scope:'Sustained actual forward input against the rendered shop counter, not just a short doorway traversal.',samples:[],errors:[]};
let browser;
try{
  browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:800,height:520},deviceScaleFactor:1,serviceWorkers:'block'});
  await context.addInitScript(save=>localStorage.setItem('nihongo.explore.yanaka.v1',JSON.stringify(save)),f.shop);
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.route('**/api/**',route=>route.fulfill({status:503,json:{ok:false,reason:'synthetic-no-AI'}}));
  await page.goto(base+'/explore.html?qa=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#explore-root')?.dataset.ready==='true',undefined,{timeout:60000});
  await page.locator('#start').click();
  const initial=(await page.evaluate(()=>window.__explore.read())).world.pose;
  const inward=p=>(p.x-initial.x)*f.normal.x+(p.z-initial.z)*f.normal.z;
  await page.keyboard.down('w');
  try{
    await page.waitForFunction(({initial,normal})=>{const p=window.__explore.read().world.pose;return(p.x-initial.x)*normal.x+(p.z-initial.z)*normal.z>1.0;},{initial,normal:f.normal},{timeout:45000});
    for(let i=0;i<4;i++){await page.waitForTimeout(1000);const data=await page.evaluate(()=>window.__explore.read());assert(data.world.keys.includes('KeyW'));report.samples.push({pose:data.world.pose,inward:inward(data.world.pose),fps:data.world.fps});}
  }finally{await page.keyboard.up('w');}
  const last=report.samples.at(-1);assert(last.inward>1.0&&last.inward<1.50,'counter was not reached or was crossed');
  assert(Math.abs(last.inward-report.samples.at(-2).inward)<.08,'forward motion did not settle against the solid counter');
  assert.deepEqual(report.errors,[]);await page.screenshot({path:`${out}/11-counter-solid.png`,timeout:60000});
  report.status='PASS';
}catch(error){report.status='FAIL';report.failure=String(error.stack||error);process.exitCode=1;}finally{writeFileSync(`${out}/counter-report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser?.close();}
