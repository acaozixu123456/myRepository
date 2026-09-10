import {chromium} from 'playwright';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const output='artifacts/companion-publication';await mkdir(output,{recursive:true});
const report={scope:'REAL_PROVIDER_TYPED_SYNTHETIC_INPUT_NATIVE_AUDIO_OUTPUT_NOT_HUMAN_IPHONE',status:'running',ok:false,turns:[],notes:[],fixtures:[],providerFailures:[]};
const anon=(await readFile('api/nhk-speech.ts','utf8')).match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)?.[0];
assert.ok(anon,'Existing public application token must be present');
const edge='https://kivebsjsdfdobxzaokbj.supabase.co/functions/v1/nihongo-companion';
const clientKey=createHash('sha256').update(`continuity-check:${process.env.GITHUB_RUN_ID||Date.now()}`).digest('hex').slice(0,48);
let browser,page,ticket;
const call=async body=>{
 const action=body.action.replace(/^companion_/,'');
 const r=await fetch(edge,{method:'POST',headers:{Authorization:`Bearer ${anon}`,apikey:anon,'Content-Type':'application/json'},body:JSON.stringify({...body,action,clientKey}),signal:AbortSignal.timeout(40000)});
 const data=await r.json().catch(()=>({ok:false,reason:'non_json'}));
 if(!data.ok&&action!=='stop')report.providerFailures.push({action,status:r.status,reason:String(data.reason||'unknown').slice(0,120)});
 return{status:r.status,data};
};
try{
 const health=await call({action:'health'});report.health={status:health.status,mode:health.data.mode,models:health.data.models};assert.equal(health.status,200);
 browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});page=await context.newPage();
 await page.route('**/api/nhk-speech',async route=>{try{const r=await call(route.request().postDataJSON());await route.fulfill({status:r.status,json:r.data});}catch{await route.fulfill({status:503,json:{ok:false,reason:'qa_transport_unavailable'}}).catch(()=>{});}});
 await page.goto('http://127.0.0.1:4173/companion.html');
 await page.evaluate(async()=>{
  const {CompanionConnection}=await import('/src/companion/connection.ts');
  const {LOCAL_SEEDS,freshPolicy}=await import('/src/companion/model.ts');
  window.__qaMicRequests=0;
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{window.__qaMicRequests++;throw new Error('Physical recording is prohibited in this QA probe');}}});
  const state=window.__qa={phase:'idle',lines:[],notes:[],errors:[],noteErrors:[],activity:null};
  window.__companion=new CompanionConnection(LOCAL_SEEDS.find(s=>s.id==='video-loop'),freshPolicy(),{phase:p=>state.phase=p,lines:l=>state.lines=l,activity:a=>{state.activity=a;if(a.output==='blocked')void window.__companion.unlock();},notice:()=>{},error:e=>state.errors.push(e),policy:()=>{},written:n=>state.notes.push(n),writtenError:e=>{if(e)state.noteErrors.push(e);}});
  await window.__companion.start();
 });
 const count=()=>page.evaluate(()=>window.__qa.lines.filter(l=>l.role==='assistant'&&l.delivered&&!l.interrupted).length);
 const wait=async previous=>{
  await page.waitForFunction(n=>{const s=window.__qa;return s.phase==='error'||(s.phase==='ready'&&s.lines.filter(l=>l.role==='assistant'&&l.delivered&&!l.interrupted).length>n);},previous,{timeout:45000});
  const state=await page.evaluate(()=>window.__qa);assert.notEqual(state.phase,'error',state.errors.join(';'));
  return state.lines.filter(l=>l.role==='assistant'&&l.delivered&&!l.interrupted).at(-1)?.text||'';
 };
 report.opening=await wait(0);
 const typed=async text=>{const before=await count();await page.evaluate(text=>window.__companion.sendText(text),text);const answer=await wait(before);assert.ok(answer);report.turns.push({inputType:'TYPED_SYNTHETIC',user:text,assistant:answer});};
 await typed('アーティストとバンドは、どういう意味ですか。');
 await page.waitForFunction(()=>window.__qa.notes.some(n=>n.kind==='explanation')||window.__qa.noteErrors.length>0,null,{timeout:22000});
 report.notes=await page.evaluate(()=>window.__qa.notes);assert.ok(report.notes.some(n=>n.kind==='explanation'&&n.reasonZh),'Actual written meaning answer must arrive');
 await typed('静かな感じが好きです。寝るためではなく、休憩中に動画を見るだけです。');
 await typed('眠る話ではありません。静かな動画の雰囲気が好き、という意味です。');
 // This short-lived ticket stays in process memory. Never log or persist credentials.
 ticket=await page.evaluate(()=>window.__companion.ticket);assert.ok(ticket?.callId);
 const fixtures=[
  {name:'confirmed-meaning-from-screenshot',mode:'question',q:'「アーティストやバンド」の意味を知りたいということですか？',u:'はい。'},
  {name:'minimal-past-tense-still-works',mode:'auto',q:'昨日はどうでしたか。',u:'昨日は忙しいでした。'}
 ];
 for(const f of fixtures){
  const input={requestId:crypto.randomUUID(),mode:f.mode,anchorId:'qa-user',source:f.u,target:0,context:[{id:'qa-assistant',role:'assistant',text:f.q,delivered:true,interrupted:false,assistance:'none'},{id:'qa-user',role:'user',text:f.u,delivered:true,interrupted:false,assistance:'none'}]};
  const r=await call({action:'feedback',...ticket,input}),n=r.data.note;
  const pass=r.status===200&&(f.mode==='question'?n?.kind==='explanation'&&/乐队|乐团/u.test(n.reasonZh)&&/艺术|歌手|音乐|创作/u.test(n.reasonZh):n?.kind==='correction'&&n.suggestion.includes('忙しかった'));
  report.fixtures.push({name:f.name,status:r.status,pass:!!pass,note:n||null,disposition:r.data.disposition});
 }
 report.noPhysicalMicrophone=await page.evaluate(()=>window.__qaMicRequests===0);
 report.stockPromiseNotObserved=report.turns.every(t=>!/文字で説明しますね/u.test(t.assistant));
 report.connectionStayedLive=await page.evaluate(()=>window.__companion.pc.connectionState==='connected');
 report.semanticReview='Actual generated utterances recorded for supervisor review; not inferred solely from transport.';
 assert.ok(report.noPhysicalMicrophone);assert.ok(report.connectionStayedLive);assert.ok(report.stockPromiseNotObserved);assert.ok(report.fixtures.every(f=>f.pass));
 report.ok=true;report.status='passed';
}catch(e){
 report.status=report.providerFailures.length?'blocked':'failed';
 report.failure=(e instanceof Error?e.message:String(e)).replace(/sk-[A-Za-z0-9_-]+/g,'[REDACTED]').slice(0,700);
 process.exitCode=1;
}finally{
 if(page&&!page.isClosed()){if(!ticket)ticket=await page.evaluate(()=>window.__companion?.ticket).catch(()=>null);await page.evaluate(()=>window.__companion?.end()).catch(()=>{});}
 if(ticket)await call({action:'stop',...ticket}).catch(()=>{});
 await browser?.close();
 await writeFile(`${output}/real-provider.json`,JSON.stringify(report,null,2));
 console.log('COMPANION_BOUNDED_REAL_PROVIDER',JSON.stringify(report));
}
