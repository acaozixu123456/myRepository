import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium,webkit} from 'playwright';
const base=process.env.ENTRY_BASE_URL||'http://127.0.0.1:4173';
const out=process.env.ENTRY_EVIDENCE_DIR||'artifacts/hitokoto-entry';mkdirSync(out,{recursive:true});
execFileSync('node_modules/.bin/esbuild',['scripts/nhk-calm-fixture.ts','--bundle','--platform=node','--format=cjs',`--outfile=${out}/fixture.cjs`]);
execFileSync('node',[`${out}/fixture.cjs`],{env:{...process.env,FIXTURE_OUT:`${out}/fixture.json`}});
const fixture=JSON.parse(readFileSync(`${out}/fixture.json`,'utf8'));
const keys={articles:'nihongo-nhk-article-library-v1',knowledge:'nihongo-nhk-knowledge-library-v1',probe:'hitokoto-entry-preservation-probe'};
const report={ok:false,base,scope:'REAL_BROWSER_PERSISTENT_PROFILE_REAL_SERVICE_WORKER_MOCKED_AI_NOT_PHYSICAL_IPHONE',cases:[],cacheBaselines:[],limitations:[],errors:[],stage:'start'};let context,profile;
try{
 for(const engine of (process.env.ENTRY_ENGINES||'chromium,webkit').split(',')){
  profile=mkdtempSync(join(tmpdir(),'hitokoto-entry-qa-'));
  context=await ({chromium,webkit})[engine].launchPersistentContext(profile,{headless:true,viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'allow'});
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
  report.stage=engine+': seed persistent profile';
  await page.goto(base+'/entry-probe-blank');
  await page.evaluate(async()=>{const c=await caches.open('baseline-private-cache');await c.put('/baseline',new Response('BASELINE'));});
  await page.reload();
  report.cacheBaselines.push({engine,cachePersistsAcrossBlankReload:await page.evaluate(async()=>!!(await (await caches.open('baseline-private-cache')).match('/baseline')))});
  const before=await page.evaluate(async({fixture,keys})=>{
   localStorage.setItem(keys.articles,JSON.stringify([fixture.article]));localStorage.setItem(keys.knowledge,JSON.stringify(fixture.knowledge));localStorage.setItem(keys.probe,'KEEP_THIS');
   const old=await caches.open('nihongo-explore-isolated-20260906-v1');await old.put('/',new Response('<html>OLD LIGHT ROOT</html>',{headers:{'Content-Type':'text/html'}}));
   const unrelated=await caches.open('private-study-cache');await unrelated.put('/private-marker',new Response('KEEP_CACHE'));
   if(!(await unrelated.match('/private-marker')))throw new Error('Harness cannot seed its own CacheStorage marker');
   await new Promise((resolve,reject)=>{const request=indexedDB.open('entry-data-preservation-qa',1);request.onupgradeneeded=()=>request.result.createObjectStore('records');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('records','readwrite');tx.objectStore('records').put('KEEP_DATABASE','probe');tx.oncomplete=()=>{db.close();resolve();};};});
   return Object.fromEntries(Object.values(keys).map(key=>[key,localStorage.getItem(key)]));
  },{fixture,keys});
  const neon=async()=>{await page.locator('[data-entry-release="entry-20260911"]').waitFor();assert.equal(new URL(page.url()).pathname,'/companion.html');assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.kc-root')).backgroundColor),'rgb(6, 9, 20)');};
  report.stage=engine+': normal default launch';
  await page.goto(base+'/');await neon();
  assert.deepEqual(await page.evaluate(keys=>Object.fromEntries(Object.values(keys).map(key=>[key,localStorage.getItem(key)])),keys),before);
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await page.waitForFunction(async()=>!(await caches.keys()).includes('nihongo-explore-isolated-20260906-v1'));
  const cacheCheck=await page.evaluate(async()=>({keys:await caches.keys(),marker:await (await (await caches.open('private-study-cache')).match('/private-marker'))?.text()}));
  assert.equal(cacheCheck.marker,'KEEP_CACHE',JSON.stringify({engine,cacheCheck}));
  await page.reload();await neon();await page.waitForLoadState('networkidle');
  await page.screenshot({path:`${out}/${engine}-normal-launch.png`,fullPage:true});
  report.stage=engine+': old index bookmark';
  await page.goto(base+'/index.html');await neon();
  report.stage=engine+': NHK links and refresh';
  await page.getByRole('link',{name:'NHK 学习',exact:true}).click();
  await page.locator('.nhk-only-app').waitFor();assert.equal(new URL(page.url()).searchParams.get('view'),'nhk');
  await page.reload();await page.locator('.nhk-only-app').waitFor();await page.waitForLoadState('networkidle');
  assert.equal(new URL(page.url()).searchParams.get('view'),'nhk');
  assert.ok(await page.evaluate(({keys,id})=>JSON.parse(localStorage.getItem(keys.articles)).some(a=>a.id===id),{keys,id:fixture.article.id}));
  await page.screenshot({path:`${out}/${engine}-nhk-retained.png`,fullPage:true});
  await page.getByRole('link',{name:'← HITOKOTO 日语陪聊',exact:true}).click();await neon();
  await page.waitForLoadState('networkidle');
  // Cache separation remains a required real-browser assertion in BOTH engines.
  const shells=await page.evaluate(async()=>{
   const c=await caches.open('hitokoto-shell-20260911-entry-v1');
   const result={};for(const p of ['/','/?view=nhk','/companion.html'])result[p]=await (await c.match(p))?.text()||'';
   return result;
  });
  assert.ok(shells['/'].includes('/app-entry.js'));assert.ok(shells['/?view=nhk'].includes('id="root"'));
  assert.ok(shells['/companion.html'].includes('id="companion-root"'));assert.notEqual(shells['/?view=nhk'],shells['/companion.html']);
  const offline={status:'not_attempted',root:false,nhk:false,companion:false};
  try{
   report.stage=engine+': offline default launch';
   await context.setOffline(true);await page.goto(base+'/');await neon();offline.root=true;
   report.stage=engine+': offline NHK';
   await page.goto(base+'/?view=nhk');await page.locator('.nhk-only-app').waitFor();offline.nhk=true;
   report.stage=engine+': offline companion';
   await page.goto(base+'/companion.html');await neon();offline.companion=true;offline.status='passed';
  }catch(e){
   // Retain the exact limitation in evidence rather than silently weakening or relabelling the test.
   // Playwright's SW integration is Chromium-only; its Linux WebKit can abort the navigation internally.
   // https://playwright.dev/docs/service-workers ; microsoft/playwright#34450.
   if(engine!=='webkit'||process.platform!=='linux'||!e.message.startsWith('page.goto: WebKit encountered an internal error'))throw e;
   offline.status='blocked';offline.reason=e.message.slice(0,450);
   report.limitations.push({engine,check:'offline_navigation',status:'NOT_VERIFIED',reason:offline.reason});
  }finally{await context.setOffline(false);}
  report.stage=engine+': online recovery after offline probe';
  await page.goto(base+'/');await neon();
  assert.equal(await page.evaluate(()=>localStorage.getItem('hitokoto-entry-preservation-probe')),'KEEP_THIS');
  const dbValue=await page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('entry-data-preservation-qa',1);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,q=db.transaction('records','readonly').objectStore('records').get('probe');q.onsuccess=()=>{resolve(q.result);db.close();};};}));assert.equal(dbValue,'KEEP_DATABASE');
  assert.equal(await page.evaluate(async()=>await (await (await caches.open('private-study-cache')).match('/private-marker'))?.text()),'KEEP_CACHE');
  report.stage=engine+': legacy shared article';
  const shared='https://www.mojidict.com/article/entry-share-test';
  await page.goto(base+'/?share_target=1&url='+encodeURIComponent(shared));
  await page.locator('.nhk-only-app').waitFor();
  await page.waitForFunction(()=>new URL(location.href).searchParams.get('view')==='nhk'&&!new URL(location.href).searchParams.has('url'));
  await page.waitForFunction(({keys,shared})=>JSON.parse(localStorage.getItem(keys.articles)||'[]').some(a=>a.sourceUrl===shared),{keys,shared});
  assert.ok(await page.evaluate(({keys,id})=>JSON.parse(localStorage.getItem(keys.articles)).some(a=>a.id===id),{keys,id:fixture.article.id}));
  await page.reload();await page.locator('.nhk-only-app').waitFor();
  assert.equal(new URL(page.url()).searchParams.get('view'),'nhk');assert.equal(micRequests,0);
  report.cases.push({engine,persistentProfile:true,normalRootLaunchNeon:true,indexBookmarkNeon:true,nhkLinkAndReload:true,legacyShareImportAndReload:true,oldArticlesRetained:true,cacheShellsSeparate:true,offline,onlyOwnedLegacyCacheRemoved:true,unrelatedCacheAndIndexedDBRetained:true,physicalMicRequests:micRequests});
  await context.close();context=null;rmSync(profile,{recursive:true,force:true});profile=null;
 }
 assert.deepEqual(report.errors,[]);report.ok=true;report.stage='complete';
}catch(e){report.failure=e.message;process.exitCode=1;}finally{await context?.close();if(profile)rmSync(profile,{recursive:true,force:true});writeFileSync(`${out}/result.json`,JSON.stringify(report,null,2));console.log('HITOKOTO_ENTRY_BROWSER',JSON.stringify(report));}
