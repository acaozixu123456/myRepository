import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.TEST_BASE_URL||'https://nihongo-discovery-v2-202608-git-30bf70-acaozixu123456s-projects.vercel.app';
assert.ok(['https://nihongo-discovery-v2-202608-git-30bf70-acaozixu123456s-projects.vercel.app','https://nihongo-discovery-v2-20260831.vercel.app'].includes(base));
const report={scope:'REAL_PUBLIC_UI_NATIVE_AUDIO_AND_SILENT_TEXT_WITH_SYNTHETIC_AUDIO_NOT_HUMAN_IPHONE',source:process.env.GITHUB_SHA,base,ok:false,turns:[],notes:[],checks:[],errors:[],news:null,syntheticFixtures:[]};
const out='artifacts/companion-release-live';await mkdir(out,{recursive:true});
let browser,page;const clips=[],texts=['猫。','寝ている猫。','寝る前に、猫の動画を見ます。','猫は飼っていません。'];
try{
 for(const text of texts){
  const origin='https://nihongo-discovery-v2-20260831.vercel.app';
  const r=await fetch(origin+'/api/nhk-speech',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({action:'tts',text}),signal:AbortSignal.timeout(45000)});const j=await r.json();report.syntheticFixtures.push({text,status:r.status,reason:j.reason,cached:j.cached});assert.ok(r.ok&&j.ok&&j.url,`Synthetic fixture unavailable: ${r.status} ${j.reason||'no_audio'} ${text}`);const bytes=await fetch(j.url);assert.ok(bytes.ok);clips.push(Buffer.from(await bytes.arrayBuffer()).toString('base64'));
 }
 browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 await page.addInitScript(()=>{
  const q=window.__release={micRequests:0,creates:0,completed:0,playing:false,generating:false,peers:[],errors:[],connectivity:[],inputTracks:[],silences:[]};
  const Native=window.RTCPeerConnection;window.RTCPeerConnection=class extends Native{constructor(...args){super(...args);q.peers.push(this);this.addEventListener('connectionstatechange',()=>q.connectivity.push({state:this.connectionState,at:Date.now()}));}createDataChannel(...args){const dc=super.createDataChannel(...args),send=dc.send.bind(dc);dc.send=v=>{const e=JSON.parse(v);if(e.type==='response.create'){q.creates++;q.generating=true;}return send(v);};dc.addEventListener('message',e=>{const v=JSON.parse(e.data);if(v.type==='output_audio_buffer.started')q.playing=true;if(['output_audio_buffer.stopped','output_audio_buffer.cleared'].includes(v.type))q.playing=false;if(v.type==='response.done'){q.generating=false;if(v.response?.status==='completed')q.completed++;}if(v.type==='error')q.errors.push(v.error?.code||'unknown');});return dc;}};
  if(navigator.mediaDevices)navigator.mediaDevices.getUserMedia=async()=>{q.micRequests++;const ctx=window.__context||(window.__context=new AudioContext());await ctx.resume();const dest=ctx.createMediaStreamDestination(),silence=ctx.createBufferSource();silence.buffer=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);silence.loop=true;silence.connect(dest);silence.start();q.silences.push(silence);q.inputTracks.push(...dest.stream.getTracks());window.__destination=dest;return dest.stream;};
 });
 let ticket=null,stall=false,releaseStall=()=>{};
 page.on('response',async r=>{if(!r.url().endsWith('/api/nhk-speech'))return;try{const b=r.request().postDataJSON(),j=await r.json();if(b.action==='companion_start'&&j.ok)ticket={callId:j.callId,expiresAt:j.expiresAt,token:j.token};if(b.action==='companion_feedback')report.notes.push({mode:b.input.mode,source:b.input.source,status:r.status(),note:j.note||null,disposition:j.disposition,model:j.model});if(b.action==='companion_topics'&&b.lane==='news')report.news={status:r.status(),reason:j.reason,topics:j.topics?.map(t=>({title:t.title,opening:t.opening,context:t.context,sources:t.sources}))};}catch{}});
 await page.route('**/api/nhk-speech',async route=>{const b=route.request().postDataJSON();if(stall&&b.action==='companion_feedback'){await new Promise(r=>releaseStall=r);await route.fulfill({status:503,json:{ok:false,reason:'intentional_test_only_feedback_failure'}}).catch(()=>{});return;}await route.continue();});
 assert.equal((await page.goto(base+'/companion.html')).status(),200);await page.locator('[data-release="quiet-20260910"]').waitFor();
 const oldStorage=await page.evaluate(()=>JSON.stringify({...localStorage}));
 const count=()=>page.evaluate(()=>window.__release.completed);
 const settled=async n=>{await page.waitForFunction(n=>window.__release.completed>n&&!window.__release.playing&&!window.__release.generating,n,{timeout:50000});await page.waitForTimeout(150);assert.equal(await page.locator('.kc-inline-error').count(),0,'Native conversation must remain available');return (await page.locator('.kc-line.assistant>p').last().textContent())||'';};
 await page.getByRole('button',{name:'聊一会儿',exact:true}).click();report.opening=await settled(0);assert.equal(await page.evaluate(()=>window.__release.micRequests),0);
 const typed=async text=>{const n=await count();await page.getByRole('button',{name:'更多',exact:true}).click();await page.getByRole('button',{name:/用文字接一句/}).click();await page.getByRole('textbox',{name:'要说的话'}).fill(text);await page.getByRole('button',{name:'递过去',exact:true}).click();const a=await settled(n);report.turns.push({kind:'typed',user:text,assistant:a});return a;};
 await typed('猫の動画の話をしたいです。寝る前に何を見るか、簡単に聞いてください。');
 await page.getByRole('button',{name:'打开麦克风',exact:true}).click();await page.waitForFunction(()=>!!window.__destination);
 for(const [i,b64] of clips.entries()){
  const n=await count();await page.evaluate(async b64=>{const ctx=window.__context;const buf=await ctx.decodeAudioData(Uint8Array.from(atob(b64),c=>c.charCodeAt(0)).buffer);const source=ctx.createBufferSource();source.buffer=buf;source.connect(window.__destination);source.start();},b64);const a=await settled(n);report.turns.push({kind:'synthetic_audio',user:texts[i],assistant:a});
 }
 await page.getByRole('button',{name:'关闭麦克风',exact:true}).click();assert.equal(await page.evaluate(()=>window.__release.inputTracks.every(t=>t.readyState==='ended')),true);report.checks.push('native conversation accepts four short synthetic word/phrase/sentence inputs; manual mute stops actual test tracks');
 await typed('昨日は忙しいでした。');
 const original=page.locator('.kc-line.user').filter({has:page.locator('p',{hasText:'昨日は忙しいでした。'})}).last();
 await original.locator('[data-note-kind="correction"]').waitFor({timeout:25000});assert.ok((await original.locator('.kc-note-japanese').textContent()).includes('忙しかった'));assert.equal(await original.locator(':scope>p').textContent(),'昨日は忙しいでした。');
 await original.scrollIntoViewIfNeeded();await page.screenshot({path:out+'/correction-390.png',fullPage:true});
 const before=await page.evaluate(()=>window.__release.creates),oldNotes=report.notes.length;
 await page.getByRole('button',{name:'接不上',exact:true}).click();for(let i=0;i<25&&!report.notes.slice(oldNotes).some(n=>n.mode==='help'&&n.note);i++)await page.waitForTimeout(1000);
 assert.ok(report.notes.slice(oldNotes).some(n=>n.mode==='help'&&n.note),'Help must return a usable note');assert.equal(await page.evaluate(()=>window.__release.creates),before,'Help must not launch a voice lesson');assert.equal(await page.evaluate(()=>window.__release.micRequests),1);report.checks.push('automatic correction preserves original; explicit Help is text-only and never reopens microphone');
 await typed('这里「忙しかったです」是什么意思？');await page.locator('[data-note-kind="explanation"]').waitFor({timeout:25000});assert.ok(report.turns.at(-1).assistant.length<80,'Spoken language question acknowledgement must stay brief');
 assert.ok(ticket,'Signed operational ticket needed');
 const fixtures=[
  {name:'natural',q:'昨日はどうでしたか。',u:'昨日は忙しかったです。',mode:'auto',check:n=>!n},
  {name:'choice-is-not-error',q:'コーヒーとお茶、どちらがいいですか。',u:'コーヒー。',mode:'auto',check:n=>!n},
  {name:'drink',q:'何を飲みますか。',u:'コーヒー。',mode:'auto',check:n=>!n||(n.kind==='extension'&&n.suggestion.includes('飲'))},
  {name:'preference',q:'何が好きですか。',u:'コーヒー。',mode:'auto',check:n=>!n||(n.kind==='extension'&&n.suggestion.includes('好き'))},
  {name:'self-repair',q:'昨日はどうでしたか。',u:'忙しいでした、あ、忙しかったです。',mode:'auto',check:n=>!n},
  {name:'morning',q:'いつ回答しますか。',u:'不是明天下午，是明天上午答复。',mode:'help',check:n=>!!n&&n.suggestion.includes('午前')&&(!n.suggestion.includes('午後')||/午後ではなく|午後じゃなく/.test(n.suggestion))},
  {name:'negation',q:'猫は飼っていますか。',u:'我没养猫，只喜欢看猫的视频。',mode:'help',check:n=>!!n&&/飼っていません|飼っていない|飼ってない/.test(n.suggestion)},
 ];report.fixtures=[];
 for(const f of fixtures){const input={requestId:crypto.randomUUID(),mode:f.mode,anchorId:'test-user',source:f.u,target:0,context:[{id:'test-ai',role:'assistant',text:f.q,delivered:true,interrupted:false,assistance:'none'},{id:'test-user',role:'user',text:f.u,delivered:true,interrupted:false,assistance:'none'}]};const r=await page.request.post(base+'/api/nhk-speech',{data:{action:'companion_feedback',...ticket,input},headers:{Origin:base},timeout:28000});const j=await r.json();const pass=r.ok()&&f.check(j.note);report.fixtures.push({name:f.name,status:r.status(),note:j.note||null,pass});assert.ok(pass,'Quiet feedback failed: '+f.name);}
 stall=true;await page.getByRole('button',{name:'接不上',exact:true}).click();await page.waitForTimeout(800);await typed('仕事の話をしましょう。原因はまだ調べています。');stall=false;releaseStall();await page.waitForTimeout(100);report.checks.push('native voice completed while optional teacher request was stalled and then failed');
 const repair=await typed('明日の午後ではなく、明日の午前に回答します。');assert.ok(!/午後に回答しますね/.test(repair));
 report.recall=await typed('さっき、私は猫を飼っていると言いましたか。');assert.ok(/飼っていない|飼っていません|飼ってない/.test(report.recall),'Native conversation must remember negation across topic changes');
 assert.equal(await page.evaluate(()=>JSON.stringify({...localStorage})),oldStorage,'No silent transcript/note/learning persistence');
 assert.equal(await page.evaluate(()=>window.__release.peers.length),1,'Do not silently restart voice during the conversation');
 report.connectivity=await page.evaluate(()=>window.__release.connectivity);report.checks.push('same native peer retains earlier meaning; no transcript/note storage');
 await page.getByRole('button',{name:'结束聊天',exact:true}).click();await page.waitForFunction(()=>window.__release.peers.every(p=>p.connectionState==='closed'));ticket=null;
 await page.getByRole('button',{name:'回去看看',exact:true}).click();await page.locator('.kc-lane').click();await page.getByRole('button',{name:/世界的新鲜事/}).click();for(let i=0;i<60&&!report.news;i++)await page.waitForTimeout(1000);
 assert.equal(report.news?.status,200,'Public sourced news generation must succeed');assert.ok(report.news.topics.length>0);assert.ok(report.news.topics.every(t=>t.sources?.length&&t.context.includes('发布日期：')&&t.context.includes('原文依据：')));await page.screenshot({path:out+'/news-390.png',fullPage:true});
 report.checks.push('separate news action returns dated publisher-linked context; factual claims reviewed separately');assert.deepEqual(report.errors,[]);report.nativeErrors=await page.evaluate(()=>window.__release.errors);assert.deepEqual(report.nativeErrors,[]);report.ok=true;await context.close();
}catch(e){report.failure=e.message;if(page&&!page.isClosed()){report.runtime=await page.evaluate(()=>({connectivity:window.__release?.connectivity,errors:window.__release?.errors,creates:window.__release?.creates,completed:window.__release?.completed,status:document.querySelector('.kc-inline-error')?.textContent})).catch(()=>null);await page.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});}process.exitCode=1;}
finally{if(page&&!page.isClosed())await page.getByRole('button',{name:'结束聊天',exact:true}).click({timeout:1500}).catch(()=>{});await writeFile(out+'/result.json',JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:report.checks,failure:report.failure,fixtureResults:report.fixtures?.map(f=>({name:f.name,pass:f.pass})),news:report.news?.status}));await browser?.close();}
