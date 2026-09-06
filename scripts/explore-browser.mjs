import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const base=process.env.EXPLORE_BASE||'http://127.0.0.1:4173';
const out=process.env.EXPLORE_ARTIFACTS||'/tmp/explore-artifacts';mkdirSync(out,{recursive:true});
execFileSync('node_modules/.bin/esbuild',['scripts/explore-fixture.ts','--bundle','--platform=node','--outfile=/tmp/explore-fixture.cjs']);execFileSync('node',['/tmp/explore-fixture.cjs']);
const fixtures=JSON.parse(readFileSync('/tmp/explore-fixture.json','utf8'));
const report={syntheticData:true,rendering:'Real WebGL with software GPU; not physical-device performance evidence',realAIRequests:0,cases:[],diagnostics:[],errors:[]};
let browser;
const record=(name,detail='')=>{report.cases.push({name,result:'PASS',detail});console.log('PASS',name);};
async function start(context,fixture,tag){
  await context.addInitScript(({fixture})=>{if(!sessionStorage.getItem('explore-fixture-loaded')){localStorage.setItem('nihongo.explore.yanaka.v1',JSON.stringify(fixture));localStorage.setItem('nhk-preservation-marker','KEEP-ORIGINAL-BYTES');sessionStorage.setItem('explore-fixture-loaded','1');}}, {fixture});
  const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',error=>report.errors.push({tag,message:error.message}));
  await page.route('**/api/nhk-speech',route=>route.fulfill({status:503,json:{ok:false,reason:'synthetic-audio-failure'}}));
  await page.goto(base+'/explore.html?qa=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#explore-root')?.dataset.ready,{},{timeout:60000});
  const ready=await page.locator('#explore-root').getAttribute('data-ready');
  if(ready!=='true'){await page.screenshot({path:`${out}/${tag}-render-error.png`});throw Error('Renderer failed: '+await page.locator('body').innerText());}
  await page.waitForTimeout(2200);report.diagnostics.push({tag,initial:await page.evaluate(()=>window.__explore.read())});writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));return page;
}
async function snap(page,name){await page.screenshot({path:`${out}/${name}.png`,timeout:60000});const size=await page.evaluate(()=>({content:document.documentElement.scrollWidth,width:innerWidth}));assert(size.content<=size.width+1,`${name} horizontal overflow`);}
try{
 browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1,serviceWorkers:'block'});
 const page=await start(context,fixtures.fresh,'desktop');await snap(page,'01-entry');await page.locator('#start').click();
 const before=(await page.evaluate(()=>window.__explore.read())).world.pose;
 await page.keyboard.down('w');await page.waitForTimeout(2300);await page.keyboard.up('w');
 const after=(await page.evaluate(()=>window.__explore.read())).world.pose;assert(after.z>before.z+.15,'W movement failed');
 await page.keyboard.down('ArrowRight');await page.waitForTimeout(600);await page.keyboard.up('ArrowRight');
 assert((await page.evaluate(()=>window.__explore.read())).world.pose.yaw>after.yaw+.05,'look control failed');
 record('desktop real WebGL, forward movement, independent turning');await snap(page,'02-street');report.diagnostics.push(await page.evaluate(()=>window.__explore.read()));
 await page.locator('#map').click();assert.equal((await page.evaluate(()=>window.__explore.read())).world.paused,true);await snap(page,'03-map');await page.getByRole('button',{name:'关闭',exact:true}).click();
 await page.locator('#about').click();assert((await page.locator('body').innerText()).includes('尚未接入 PLATEAU'));await page.getByRole('button',{name:'关闭',exact:true}).click();
 record('map and honest provenance modal pause movement');await context.close();
 // Start a separate synthetic save at the real doorway. No gameplay teleport/debug mutator exists.
 const shopContext=await browser.newContext({viewport:{width:1280,height:800},serviceWorkers:'block'});
 const shop=await start(shopContext,fixtures.shop,'shop');await shop.locator('#start').click();
 await shop.waitForFunction(()=>window.__explore.read().world.nearest==='shop',{},{timeout:20000});
 await snap(shop,'04-shop-interior');await shop.keyboard.press('e');await shop.locator('#reply-form').waitFor();
 await shop.locator('#reply-input').fill('日替わり弁当を一つください。');await shop.locator('#reply-form').evaluate(form=>form.requestSubmit());
 await shop.waitForFunction(()=>window.__explore.read().purchase.step==='heat');await shop.locator('#reply-input').fill('大丈夫です。');await shop.locator('#reply-form').evaluate(form=>form.requestSubmit());assert.equal((await shop.evaluate(()=>window.__explore.read())).purchase.step,'heat');assert((await shop.locator('#reply-error').innerText()).includes('明确'));record('ambiguous Japanese is not silently accepted');
 await shop.locator('#hint-toggle').click();await snap(shop,'05-dialogue');
 await shop.locator('[data-choice="1"]').click();await shop.waitForFunction(()=>window.__explore.read().purchase.step==='bag');
 await shop.locator('#reply-input').fill('袋はいりません。');await shop.locator('#reply-form').evaluate(form=>form.requestSubmit());
 await shop.waitForFunction(()=>window.__explore.read().purchase.step==='pay');assert.equal((await shop.evaluate(()=>window.__explore.read())).coins,1000);
 await shop.locator('#reply-input').fill('千円でお願いします。');await shop.locator('#reply-form').evaluate(form=>form.requestSubmit());await shop.locator('.receipt').waitFor();
 const paid=await shop.evaluate(()=>window.__explore.read());assert.equal(paid.purchase.warm,true);assert.equal(paid.purchase.bag,false);assert.equal(paid.coins,350);record('complete purchase, meaningful warm/no-bag state and exact one-time charge');await snap(shop,'06-receipt');
 await shop.locator('#leave').click();await shop.reload({waitUntil:'domcontentloaded'});await shop.waitForFunction(()=>window.__explore);assert.equal((await shop.evaluate(()=>window.__explore.read())).coins,350);assert.equal(await shop.evaluate(()=>localStorage.getItem('nhk-preservation-marker')),'KEEP-ORIGINAL-BYTES');record('reload preserves progress and untouched NHK marker');await shopContext.close();
 const doorContext=await browser.newContext({viewport:{width:960,height:600},serviceWorkers:'block'});const door=await start(doorContext,fixtures.door,'door');await door.locator('#start').click();
 const startPose=(await door.evaluate(()=>window.__explore.read())).world.pose;
 await door.keyboard.down('w');await door.waitForTimeout(6000);await door.keyboard.up('w');const endPose=(await door.evaluate(()=>window.__explore.read())).world.pose;
 const inward=(endPose.x-startPose.x)*fixtures.normal.x+(endPose.z-startPose.z)*fixtures.normal.z;report.diagnostics.push({doorwayInward:inward,endPose});assert(inward>1.6,'could not walk through real shop doorway');assert(inward<4.7,'walked through the shop counter');record('physical entry through open shop doorway and solid counter collision');await snap(door,'07-doorway');await doorContext.close();
 const mobileContext=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:1,isMobile:true,hasTouch:true,serviceWorkers:'block'});const mobile=await start(mobileContext,fixtures.fresh,'mobile');await snap(mobile,'08-mobile-entry');await mobile.locator('#start').click();
 const joy=await mobile.locator('#joystick').boundingBox();assert(joy,'touch joystick not visible');const mobileBefore=(await mobile.evaluate(()=>window.__explore.read())).world.pose;
 const cdp=await mobileContext.newCDPSession(mobile);const x=joy.x+joy.width/2,y=joy.y+joy.height/2;await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:y-25,id:1},{x:650,y:170,id:2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-25,id:1},{x:705,y:165,id:2}]});await mobile.waitForTimeout(2300);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const mobileAfter=(await mobile.evaluate(()=>window.__explore.read())).world.pose;assert(Math.hypot(mobileAfter.x-mobileBefore.x,mobileAfter.z-mobileBefore.z)>.1,'touch movement failed');assert(Math.abs(mobileAfter.yaw-mobileBefore.yaw)>.05,'simultaneous touch look failed');record('mobile landscape two-finger move and look');await snap(mobile,'09-mobile-street');
 await mobile.locator('#notebook').click();await snap(mobile,'10-mobile-notes');await mobileContext.close();
 assert.deepEqual(report.errors,[],'unhandled browser runtime errors');record('no uncaught JS errors in real renderer flows');
}catch(error){report.failure=String(error.stack||error);console.error(error);process.exitCode=1;}finally{writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));await browser?.close();}
