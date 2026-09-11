import {chromium} from 'playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const out='artifacts/teacher-live';await mkdir(out,{recursive:true});
const report={ok:false,scope:'REAL_PROVIDER_SYNTHETIC_JAPANESE_INPUT_REMOTE_AUDIO_AND_TEXT_TEACHING_NOT_PHYSICAL_IPHONE',turns:[],checks:[],failures:[]};
const anon=(await readFile('api/nhk-speech.ts','utf8')).match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)?.[0];assert.ok(anon);
const slug=process.env.TEACHER_EDGE_SLUG||'nihongo-companion-teacher-preview';assert.ok(['nihongo-companion-teacher-preview','nihongo-companion'].includes(slug));report.edge=slug;
const edge='https://kivebsjsdfdobxzaokbj.supabase.co/functions/v1/'+slug;
const clientKey=createHash('sha256').update('teacher-v2-qa:'+process.env.GITHUB_RUN_ID+':'+Date.now()).digest('hex').slice(0,48);
let page,browser,ticket;
const call=async(body)=>{const action=body.action.replace(/^companion_/,'');const r=await fetch(edge,{method:'POST',headers:{Authorization:`Bearer ${anon}`,apikey:anon,'Content-Type':'application/json'},body:JSON.stringify({...body,action,clientKey}),signal:AbortSignal.timeout(40000)});const data=await r.json();if(!data.ok&&action!=='stop')report.failures.push({action,status:r.status,reason:data.reason});return{status:r.status,data};};
try{
 const h=await call({action:'health'});report.health={model:h.data.model,release:h.data.teacherRelease,speed:h.data.defaultSpeed};assert.equal(h.data.teacherRelease,'teacher-20260911-v2');assert.equal(h.data.defaultSpeed,1);
 browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});page=await browser.newPage();
 await page.route('**/api/nhk-speech',async route=>{try{const r=await call(route.request().postDataJSON());await route.fulfill({status:r.status,json:r.data});}catch{await route.fulfill({status:503,json:{ok:false,reason:'qa_transport'}}).catch(()=>{});}});
 await page.goto('http://127.0.0.1:4173/companion.html');
 await page.evaluate(async()=>{
  const {CompanionConnection}=await import('/src/companion/connection.ts'),{LOCAL_SEEDS,freshPolicy}=await import('/src/companion/model.ts');
  const s=window.__qa={phase:'idle',lines:[],notes:[],errors:[],activity:null,syntheticMicCalls:0,requests:[],speeds:[]};
  window.__c=new CompanionConnection(LOCAL_SEEDS.find(s=>s.id==='video-loop'),freshPolicy(),{phase:p=>s.phase=p,lines:l=>s.lines=l,policy:()=>{},notice:()=>{},error:e=>s.errors.push(e),activity:a=>{s.activity=a;if(a.output==='blocked')void window.__c.unlock();},written:n=>s.notes.push(n)});
  const emit=window.__c.emit.bind(window.__c);window.__c.emit=e=>{if(e.type==='response.create')s.requests.push(e.response.output_modalities);if(e.type==='session.update')s.speeds.push(e.session.audio.output.speed);emit(e);};
  await window.__c.start();
 });
 const count=()=>page.evaluate(()=>window.__qa.lines.filter(l=>l.role==='assistant'&&l.delivered&&!l.interrupted).length);
 const wait=async n=>{await page.waitForFunction(n=>window.__qa.errors.length||(window.__qa.phase==='ready'&&window.__qa.lines.filter(l=>l.role==='assistant'&&l.delivered&&!l.interrupted).length>n),n,{timeout:50000});const s=await page.evaluate(()=>window.__qa);assert.equal(s.errors.length,0,s.errors.join(';'));return s.lines.filter(l=>l.role==='assistant'&&l.delivered&&!l.interrupted).at(-1);};
 report.opening=(await wait(0)).text;ticket=await page.evaluate(()=>window.__c.ticket);assert.ok(ticket?.callId);
 const spokenQuestion='「つい」はどういう意味ですか。';const generated=await call({action:'demo',...ticket,input:{text:spokenQuestion}});assert.equal(generated.status,200);
 let previous=await count();await page.evaluate(async audio=>{
  const bytes=Uint8Array.from(atob(audio),c=>c.charCodeAt(0)),ctx=window.__inputCtx=new AudioContext();await ctx.resume();const buffer=await ctx.decodeAudioData(bytes.buffer),dest=ctx.createMediaStreamDestination(),src=ctx.createBufferSource();src.buffer=buffer;src.connect(dest);
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{window.__qa.syntheticMicCalls++;return dest.stream;}}});
  await window.__c.setMic(true);await new Promise(r=>setTimeout(r,250));src.start();
 },generated.data.audio);
 const spoken=await wait(previous);report.turns.push({input:spokenQuestion,source:'SYNTHETIC_AUDIO',answer:spoken.text,textOnly:!!spoken.textOnly});assert.equal(!!spoken.textOnly,false);assert.ok(spoken.text.length>10&&!/文字で説明しますね/.test(spoken.text));
 await page.evaluate(()=>window.__c.setMic(false));
 await page.waitForFunction(()=>window.__c.replay.ready,null,{timeout:8000});const beforeReplay=await page.evaluate(()=>window.__qa.requests.length);await page.evaluate(()=>window.__c.replayOriginal());await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>window.__qa.requests.length),beforeReplay);report.checks.push('actual remote AI original replay does not regenerate');
 const captured=await page.evaluate(async()=>Array.from(new Uint8Array(await window.__c.replay.blob.arrayBuffer())));await writeFile(out+'/spoken-explanation.webm',Buffer.from(captured));report.remoteAudioBytes=captured.length;
 previous=await count();await page.evaluate(()=>window.__c.sendText('「つい」是什么意思？请用中文解释，并给一个日语例句。'));const typed=await wait(previous);report.turns.push({source:'TYPED',answer:typed.text,textOnly:!!typed.textOnly});assert.equal(typed.textOnly,true);assert.ok(typed.text.length>10&&!/文字で説明しますね/.test(typed.text));
 const subject={phrase:'五分だけ見るつもりが、一時間も見てしまいました。',meaningZh:'本来打算只看五分钟，结果看了一小时。',kind:'extension'};
 const p=await call({action:'lesson',...ticket,input:{task:'prepare',requestId:crypto.randomUUID(),subject,previousScene:''}});assert.equal(p.status,200,JSON.stringify(p.data));const lesson=p.data.lesson;report.lesson={...lesson,signature:'[OMITTED]'};
 const assess=async answer=>{const r=await call({action:'lesson',...ticket,input:{task:'assess',requestId:crypto.randomUUID(),lesson,answer,source:'typed',support:0}});assert.equal(r.status,200);return r.data.assessment;};
 report.validExample=await assess(lesson.exampleJa);assert.equal(report.validExample.verdict,'communicated');assert.equal(report.validExample.focusUsed,true);
 report.chineseNotJapanese=await assess('我知道了。');assert.equal(report.chineseNotJapanese.focusUsed,false);
 const p2=await call({action:'lesson',...ticket,input:{task:'prepare',requestId:crypto.randomUUID(),subject,previousScene:lesson.scene}});assert.equal(p2.status,200);assert.notEqual(p2.data.lesson.scene,lesson.scene);report.transferLesson={...p2.data.lesson,signature:'[OMITTED]'};
 const demo=await call({action:'demo',...ticket,input:{text:lesson.exampleJa}});assert.equal(demo.status,200);assert.equal(demo.data.text,lesson.exampleJa);await writeFile(out+'/lesson-demonstration.mp3',Buffer.from(demo.data.audio,'base64'));report.demo={model:demo.data.model,text:demo.data.text,bytes:Buffer.from(demo.data.audio,'base64').length};
 const unsigned=await call({action:'lesson',...ticket,input:{task:'assess',requestId:crypto.randomUUID(),lesson:{...lesson,signature:'0'.repeat(64)},answer:'はい。',source:'typed',support:0}});assert.equal(unsigned.status,403);report.checks.push('tampered lesson rejected');
 report.speeds=await page.evaluate(()=>window.__qa.speeds);assert.ok(report.speeds.every(s=>s===1));report.syntheticMicCalls=await page.evaluate(()=>window.__qa.syntheticMicCalls);report.actualUserMicrophoneUsed=false;report.humanJapaneseListeningReview=false;report.ok=true;
}catch(e){report.error=String(e.message||e).replace(/sk-[\w-]+/g,'[REDACTED]').slice(0,900);process.exitCode=1;}
finally{if(page&&!page.isClosed()){ticket??=await page.evaluate(()=>window.__c?.ticket).catch(()=>null);await page.evaluate(()=>{window.__c?.end();void window.__inputCtx?.close();}).catch(()=>{});}if(ticket)await call({action:'stop',...ticket}).catch(()=>{});await browser?.close();await writeFile(out+'/result.json',JSON.stringify(report,null,2));console.log('TEACHER_REAL_PROVIDER',JSON.stringify(report));}
