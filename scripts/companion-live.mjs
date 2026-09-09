import {chromium} from 'playwright';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const production='https://nihongo-discovery-v2-20260831.vercel.app';
const anon=(await readFile('api/nhk-speech.ts','utf8')).match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)?.[0];if(!anon)throw new Error('Public app token unavailable');
const edge='https://kivebsjsdfdobxzaokbj.supabase.co/functions/v1/nihongo-companion';
const clientKey=createHash('sha256').update(`companion-live:${process.env.GITHUB_RUN_ID||Date.now()}`).digest('hex').slice(0,48);
const report={scope:'REAL_OPENAI_NATIVE_CONVERSATION_SYNTHETIC_JAPANESE_AND_TYPED_HELP_NOT_HUMAN_PHONE',ok:false,turns:[],checks:[],errors:[],starts:0,heartbeats:0,topics:[],policyUpdates:[]};
const call=async(body)=>{const r=await fetch(edge,{method:'POST',headers:{Authorization:`Bearer ${anon}`,apikey:anon,'Content-Type':'application/json'},body:JSON.stringify({...body,action:body.action.replace(/^companion_/,''),clientKey}),signal:AbortSignal.timeout(body.action.includes('topics')?55000:40000)});const data=await r.json().catch(()=>({ok:false,reason:'non_json'}));return{status:r.status,data};};
await mkdir('artifacts/companion-live',{recursive:true});let browser;
try{
 const health=await call({action:'health'});report.health=health.data;assert.equal(health.status,200);assert.equal(health.data.mode,'native-stateful-audio');
 const noConsent=await call({action:'start'});assert.equal(noConsent.data.reason,'audio_consent_required');report.checks.push('missing explicit consent rejected');
 const topicResult=await call({action:'topics',lane:'interests',avoid:['只当一天猫','手机休息一天']});assert.equal(topicResult.status,200,JSON.stringify(topicResult.data));assert.ok(topicResult.data.topics.length>=2);report.topics=topicResult.data.topics.map(s=>({title:s.title,opening:s.opening,lane:s.lane}));
 const generated=topicResult.data.topics[0];const tampered=await call({action:'start',consent:'companion-realtime-v3',clientRequestId:crypto.randomUUID(),seed:{...generated,opening:'改过的题目'},sdp:'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n'});assert.equal(tampered.data.reason,'invalid_topic_signature');report.checks.push('generated topic tampering rejected before voice start');
 const texts=['猫の動画は好きですが、猫は飼っていません。','犬ではなくて、猫の動画の話です。','寝る前に、よく猫の動画を見ます。'];const audio=[];
 for(const text of texts){const r=await fetch(production+'/api/nhk-speech',{method:'POST',headers:{Origin:production,'Content-Type':'application/json'},body:JSON.stringify({action:'tts',text}),signal:AbortSignal.timeout(45000)});const data=await r.json();assert.ok(data.ok&&data.url,'Synthetic test speech unavailable');audio.push(Buffer.from(await fetch(data.url).then(r=>r.arrayBuffer())).toString('base64'));}
 browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 await page.route('**/api/nhk-speech',async route=>{const body=route.request().postDataJSON();if(body.action==='companion_start')report.starts++;if(body.action==='companion_heartbeat')report.heartbeats++;const result=await call(body);if(!result.data.ok&&body.action!=='companion_stop')report.errors.push(`${body.action}:${result.status}:${result.data.reason}`);await route.fulfill({status:result.status,json:result.data});});
 await page.goto('http://127.0.0.1:4173/companion.html');
 await page.evaluate(async audio=>{const {CompanionConnection}=await import('/src/companion/connection.ts');const {LOCAL_SEEDS,freshPolicy}=await import('/src/companion/model.ts');const ctx=window.__ctx=new AudioContext();await ctx.resume();window.__clips=[];for(const item of audio)window.__clips.push(await ctx.decodeAudioData(Uint8Array.from(atob(item),c=>c.charCodeAt(0)).buffer));window.__streams=[];window.__silences=[];window.__micRequests=0;
 Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{window.__micRequests++;const dest=ctx.createMediaStreamDestination(),silence=ctx.createBufferSource();silence.buffer=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);silence.loop=true;silence.connect(dest);silence.start();window.__dest=dest;window.__streams.push(dest.stream);window.__silences.push(silence);return dest.stream;}}});
 const state=window.__state={phase:'idle',lines:[],errors:[],inputPeak:0,outputPeak:0,policies:[],outputs:[]};window.__companion=new CompanionConnection(LOCAL_SEEDS.find(s=>s.id==='video-loop'),freshPolicy(),{phase:p=>state.phase=p,lines:l=>{state.lines=l;},activity:a=>{state.activity=a;state.inputPeak=Math.max(state.inputPeak,a.inputLevel);state.outputPeak=Math.max(state.outputPeak,a.outputLevel);if(a.output==='blocked')void window.__companion.unlock();},notice:()=>{},error:e=>state.errors.push(e),policy:p=>state.policies.push(p)});await window.__companion.start();},audio);
 const wait=async(previous=0)=>{await page.waitForFunction(n=>{const s=window.__state;return s.phase==='error'||(s.phase==='ready'&&s.lines.filter(l=>l.role==='assistant'&&l.delivered&&!l.interrupted).length>n);},previous,{timeout:45000});const state=await page.evaluate(()=>window.__state);assert.notEqual(state.phase,'error',JSON.stringify(state.errors));const line=state.lines.filter(l=>l.role==='assistant'&&l.delivered&&!l.interrupted).at(-1);assert.ok(line?.text);return line.text;};
 const count=()=>page.evaluate(()=>window.__state.lines.filter(l=>l.role==='assistant'&&l.delivered&&!l.interrupted).length);
 const speak=async(index)=>{const before=await count();await page.evaluate(index=>{const s=window.__ctx.createBufferSource();s.buffer=window.__clips[index];s.connect(window.__dest);s.start();},index);const reply=await wait(before);report.turns.push({inputType:'SYNTHETIC_AUDIO',user:texts[index],assistant:reply});return reply;};
 const typed=async(text)=>{const before=await count();await page.evaluate(text=>window.__companion.sendText(text),text);const reply=await wait(before);report.turns.push({inputType:'TYPED_TEXT',user:text,assistant:reply});return reply;};
 report.opening=await wait();assert.equal(await page.evaluate(()=>window.__micRequests),0);report.checks.push('native opening with no getUserMedia');
 await page.evaluate(()=>window.__companion.setMic(true));await speak(0);await speak(1);await speak(2);
 assert.ok(await page.evaluate(()=>window.__state.inputPeak)>.02);assert.ok(await page.evaluate(()=>window.__state.outputPeak)>.02);report.checks.push('original synthetic audio drives replies; both real RMS meters active');
 await page.evaluate(()=>window.__companion.setMic(false));assert.equal(await page.evaluate(()=>window.__streams[0].getTracks()[0].readyState),'ended');
 await typed('这里「飼う」是什么意思？请用中文解释，不用让我跟读。');
 await typed('我想说“本来只是想休息一下，结果看了很久”，日语怎么说？');
 await typed('我不是说我养猫，我只是喜欢看猫的视频。你明白我的意思吗？');
 report.checks.push('mixed-language questions and explicit correction tested in the same native conversation');
 const before=await count();await page.evaluate(()=>window.__companion.action('help'));report.help=await wait(before);assert.equal(await page.evaluate(()=>window.__micRequests),1);
 await typed('今は仕事の日本語を話したいです。会議で聞き取れないとき、何と言えばいいですか。');
 const firstPeer=await page.evaluate(()=>window.__companion.pc.connectionState);assert.equal(firstPeer,'connected');
 // Cross a monitor-owner lease while retaining the actual same peer/native conversation.
 await page.waitForTimeout(95000);await typed('さっきは、猫を飼っていると言いましたか。飼っていないと言いましたか。');
 assert.equal(report.starts,1);assert.ok(report.heartbeats>=3);assert.equal(await page.evaluate(()=>window.__micRequests),1);report.checks.push('same native peer survives monitor heartbeat/handoff; mute remains closed; prior contrast queried');
 report.policyUpdates=await page.evaluate(()=>window.__state.policies);report.diagnosticTranscripts=await page.evaluate(()=>window.__state.lines.filter(l=>l.role==='user').map(l=>l.text));
 await page.evaluate(()=>window.__companion.end());assert.equal(await page.evaluate(()=>window.__streams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))),true);report.checks.push('end stops all actual synthetic input tracks');
 report.errors.push(...await page.evaluate(()=>window.__state.errors));assert.deepEqual(report.errors,[]);report.ok=true;report.semanticReview='PENDING_SUPERVISOR_ACTUAL_UTTERANCE_REVIEW_NOT_INFERRED_FROM_TRANSPORT';await page.evaluate(()=>{window.__silences.forEach(s=>s.stop());void window.__ctx.close();});await context.close();
 console.log('COMPANION_NATIVE_TRANSPORT_PASS',JSON.stringify(report));
}catch(e){report.failure=e instanceof Error?e.message:String(e);throw e;}finally{await writeFile('artifacts/companion-live/result.json',JSON.stringify(report,null,2));await browser?.close();}
