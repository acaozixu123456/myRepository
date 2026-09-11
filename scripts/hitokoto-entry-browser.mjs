import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {chromium,webkit} from 'playwright';
const base=process.env.ENTRY_BASE_URL||'http://127.0.0.1:4173';
const out=process.env.ENTRY_EVIDENCE_DIR||'artifacts/hitokoto-entry';mkdirSync(out,{recursive:true});
execFileSync('node_modules/.bin/esbuild',['scripts/nhk-calm-fixture.ts','--bundle','--platform=node','--format=cjs',`--outfile=${out}/fixture.cjs`]);
execFileSync('node',[`${out}/fixture.cjs`],{env:{...process.env,FIXTURE_OUT:`${out}/fixture.json`}});
const fixture=JSON.parse(readFileSync(`${out}/fixture.json`,'utf8'));
const keys={articles:'nihongo-nhk-article-library-v1',knowledge:'nihongo-nhk-knowledge-library-v1',probe:'hitokoto-entry-preservation-probe'};
const report={ok:false,base,scope:'REAL_BROWSER_REAL_SERVICE_WORKER_MOCKED_AI_NOT_PHYSICAL_IPHONE',cases:[],errors:[]};let browser;
try{
 for(const engine of (process.env.ENTRY_ENGINES||'chromium,webkit').split(',')){
  browser=await ({chromium,webkit})[engine].launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'allow'});
  let micRequests=0;await context.exposeBinding('__entryMicRequested',()=>{micRequests++;});
  await context.addInitScript(()=>{Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{await window.__entryMicRequested();throw new Error('No physical microphone permitted in entry QA');}}});});
  await context.route('**/entry-probe-blank',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><head><title>Isolated QA origin</title></head><body></body></html>'}));
  await context.route('**/api/**',route=>{
   const path=new URL(route.request().url()).pathname;
   if(path==='/api/moji-article'){const {url}=route.request().postDataJSON();return route.fulfill({json:{ok:true,title:fixture.title,sentences:fixture.sentences,sourceUrl:url}});}
   if(path==='/api/nhk-coach')return route.fulfill({json:{ok:true,coach:fixture.coach,model:'isolated-qa'}});
   return route.fulfill({json:{ok:false,reason:'qa_no_live_provider'}});
  });
  const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>report.errors.push(`${engine}: ${e.message}`));
  await page.goto(base+'/entry-probe-blank');
  const before=await page.evaluate(async({fixture,keys})=>{
   localStorage.setItem(keys.articles,JSON.stringify([fixture.article]));localStorage.setItem(keys.knowledge,JSON.stringify(fixture.knowledge));localStorage.setItem(keys.probe,'KEEP_THIS');
   const old=await caches.open('nihongo-explore-isolated-20260906-v1');await old.put('/',new Response('<html>OLD LIGHT ROOT</html>',{headers:{'Content-Type':'text/html'}}));
   const unrelated=await caches.open('private-study-cache');await unrelated.put('/private-marker',new Response('KEEP_CACHE'));
   await new Promise((resolve,reject)=>{const request=indexedDB.open('entry-data-preservation-qa',1);request.onupgradeneeded=()=>request.result.createObjectStore('records');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('records','readwrite');tx.objectStore('records').put('KEEP_DATABASE','probe');tx.oncomplete=()=>{db.close();resolve();};};});
   return Object.fromEntries(Object.values(keys).map(key=>[key,localStorage.getItem(key)]));
  },{fixture,keys});
  const neon=async()=>{await page.locator('[data-entry-release="entry-20260911"]').waitFor();assert.equal(new URL(page.url()).pathname,'/companion.html');assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.kc-root')).backgroundColor),'rgb(6, 9, 20)');};
  // The important regression: open the exact installed start_url '/', not a special release URL.
  await page.goto(base+'/');await neon();
  assert.deepEqual(await page.evaluate(keys=>Object.fromEntries(Object.values(keys).map(key=>[key,localStorage.getItem(key)])),keys),before);
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await page.waitForFunction(async()=>!(await caches.keys()).includes('nihongo-explore-isolated-20260906-v1'));
  assert.equal(await page.evaluate(async()=>await (await (await caches.open('private-study-cache')).match('/private-marker')).text()),'KEEP_CACHE');
  await page.reload();await neon();await page.waitForLoadState('networkidle');
  await page.screenshot({path:`${out}/${engine}-normal-launch.png`,fullPage:true});
  await page.goto(base+'/index.html');await neon();
  await page.getByRole('link',{name:'NHK 学习',exact:true}).click();
  await page.locator('.nhk-only-app').waitFor();assert.equal(new URL(page.url()).searchParams.get('view'),'nhk');
  await page.reload();await page.locator('.nhk-only-app').waitFor();await page.waitForLoadState('networkidle');
  assert.equal(new URL(page.url()).searchParams.get('view'),'nhk');
  assert.ok(await page.evaluate(({keys,id})=>JSON.parse(localStorage.getItem(keys.articles)).some(a=>a.id===id),{keys,id:fixture.article.id}));
  await page.screenshot({path:`${out}/${engine}-nhk-retained.png`,fullPage:true});
  await page.getByRole('link',{name:'← HITOKOTO 日语陪聊',exact:true}).click();await neon();
  // Real offline requests must use distinct navigation shells, not another page's cached root.
  await context.setOffline(true);await page.goto(base+'/');await neon();
  await page.goto(base+'/?view=nhk');await page.locator('.nhk-only-app').waitFor();
  await page.goto(base+'/companion.html');await neon();await context.setOffline(false);
  assert.equal(await page.evaluate(()=>localStorage.getItem('hitokoto-entry-preservation-probe')),'KEEP_THIS');
  const dbValue=await page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('entry-data-preservation-qa',1);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,q=db.transaction('records','readonly').objectStore('records').get('probe');q.onsuccess=()=>{resolve(q.result);db.close();};};}));assert.equal(dbValue,'KEEP_DATABASE');
  const shared='https://www.mojidict.com/article/entry-share-test';
  await page.goto(base+'/?share_target=1&url='+encodeURIComponent(shared));
  await page.locator('.nhk-only-app').waitFor();
  await page.waitForFunction(()=>new URL(location.href).searchParams.get('view')==='nhk'&&!new URL(location.href).searchParams.has('url'));
  await page.waitForFunction(({keys,shared})=>JSON.parse(localStorage.getItem(keys.articles)||'[]').some(a=>a.sourceUrl===shared),{keys,shared});
  assert.ok(await page.evaluate(({keys,id})=>JSON.parse(localStorage.getItem(keys.articles)).some(a=>a.id===id),{keys,id:fixture.article.id}));
  await page.reload();await page.locator('.nhk-only-app').waitFor();
  assert.equal(new URL(page.url()).searchParams.get('view'),'nhk');assert.equal(micRequests,0);
  report.cases.push({engine,normalRootLaunchNeon:true,indexBookmarkNeon:true,nhkLinkAndReload:true,legacyShareImportAndReload:true,oldArticlesRetained:true,rootAndCompanionOfflineNeon:true,nhkOfflineRetained:true,onlyOwnedLegacyCacheRemoved:true,unrelatedCacheAndIndexedDBRetained:true,physicalMicRequests:micRequests});
  await context.close();await browser.close();browser=null;
 }
 assert.deepEqual(report.errors,[]);report.ok=true;
}catch(e){report.failure=e.message;process.exitCode=1;}finally{await browser?.close();writeFileSync(`${out}/result.json`,JSON.stringify(report,null,2));console.log('HITOKOTO_ENTRY_BROWSER',JSON.stringify(report));}
