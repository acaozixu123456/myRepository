import {chromium} from 'playwright';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const production='https://nihongo-discovery-v2-20260831.vercel.app';const useProxy=process.env.LIVE_PROXY==='1';
const anon=(await readFile('api/nhk-speech.ts','utf8')).match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)?.[0];if(!anon)throw new Error('Public project token not found');
const edge='https://kivebsjsdfdobxzaokbj.supabase.co/functions/v1/nihongo-speaking-session';
const clientKey=createHash('sha256').update(`nhk-chat-qa:${process.env.GITHUB_RUN_ID||'local'}`).digest('hex').slice(0,48);
const call=async(body)=>{const payload=useProxy?body:{...body,action:body.action.replace(/^speaking_/,''),...(body.action==='speaking_start'?{clientKey}:{})};const r=await fetch(useProxy?`${production}/api/nhk-speech`:edge,{method:'POST',headers:useProxy?{Origin:production,'Content-Type':'application/json'}:{Authorization:`Bearer ${anon}`,apikey:anon,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(35000)});return{status:r.status,data:await r.json()};};
await mkdir('artifacts/chat-live',{recursive:true});const report={scope:useProxy?'REAL_PRODUCTION_PROXY_REAL_WEBRTC_SYNTHETIC_AUDIO_NOT_HUMAN':'REAL_EDGE_REAL_WEBRTC_SYNTHETIC_AUDIO_NOT_HUMAN',starts:[],responses:[],heard:[],errors:[],ok:false};
const health=await call({action:'speaking_health'});report.health=health.data;assert.equal(health.status,200);assert.equal(health.data.chatContract,'nhk-chat-v2');
// Generate/cached-test speech only. No real microphone recording is uploaded or retained.
const fixture=await fetch(`${production}/api/nhk-speech`,{method:'POST',headers:{Origin:production,'Content-Type':'application/json'},body:JSON.stringify({action:'tts',text:'猫の動画が好きです。'}),signal:AbortSignal.timeout(35000)}).then(r=>r.json());assert.ok(fixture.ok&&fixture.url,'Test TTS unavailable');
const audioBase64=Buffer.from(await fetch(fixture.url).then(r=>r.arrayBuffer())).toString('base64');
const browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 await page.route('**/api/nhk-speech',async route=>{const body=route.request().postDataJSON();if(body.action==='speaking_start')report.starts.push(Date.now());const value=await call(body);if(!value.data.ok)report.errors.push(`${value.status}:${value.data.reason}`);await route.fulfill({status:value.status,json:value.data});});
 await page.goto('http://127.0.0.1:4173');
 await page.evaluate(async audioBase64=>{
  const {buildChatPlan}=await import('/src/nhkChat.ts');const {NhkChatConnection}=await import('/src/nhkChatConnection.ts');
  const ctx=window.__audioContext=new AudioContext();await ctx.resume();const dest=ctx.createMediaStreamDestination();const bytes=Uint8Array.from(atob(audioBase64),c=>c.charCodeAt(0));window.__fixtureAudio=await ctx.decodeAudioData(bytes.buffer);window.__dest=dest;window.__testTrack=dest.stream.getAudioTracks()[0];window.__micRequests=0;
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{window.__micRequests++;return dest.stream;}}});
  window.__state={phase:'idle',assistant:'',outputs:[],heard:[],errors:[]};window.__plan=buildChatPlan({id:'qa-chat-live',title:'SNSのニュース',sentences:['子どもがSNSを使うことについて、新しいニュースがありました。']});window.__plan.topicId='sns-video';
  window.__chat=new NhkChatConnection(window.__plan,{phase:p=>{window.__state.phase=p;},assistant:s=>{window.__state.assistant=s;},hint:()=>{},blocked:v=>{if(v)void window.__chat.unlockAudio();},error:r=>window.__state.errors.push(r),shuffle:()=>{},heard:t=>window.__state.heard.push(t)});
  await window.__chat.start();
 },audioBase64);
 const waitListening=async()=>{await page.waitForFunction(()=>['listening','error','done'].includes(window.__state.phase),{},{timeout:40000});const s=await page.evaluate(()=>window.__state);assert.equal(s.phase,'listening',JSON.stringify(s.errors));report.responses.push(s.assistant);};
 const speak=async()=>{const count=await page.evaluate(()=>window.__state.heard.length);await page.evaluate(()=>{const node=window.__audioContext.createBufferSource();node.buffer=window.__fixtureAudio;node.connect(window.__dest);node.start();});await page.waitForFunction(n=>window.__state.heard.length>n||window.__state.phase==='error',count,{timeout:25000});await waitListening();};
 await waitListening();assert.ok(report.responses[0].includes('動画'));
 await speak();let heard=await page.evaluate(()=>window.__state.heard);assert.ok(heard[0]?.includes('猫'));
 await page.evaluate(()=>window.__chat.help());await waitListening();
 await page.evaluate(()=>{window.__plan={...window.__plan,topicId:'sns-bed'};window.__chat.changeTopic(window.__plan);});await page.waitForTimeout(600);await waitListening();assert.ok(report.responses.at(-1).includes('寝る前'));
 assert.equal(report.starts.length,1,'Changing topic must not create another call');
 for(let i=0;i<3;i++)await speak();report.heard=await page.evaluate(()=>window.__state.heard);assert.ok(report.heard.length>=4);assert.equal(await page.evaluate(()=>window.__state.phase),'listening');
 report.multiTurnPass=true;report.shuffleSameConnection=true;
 // Keep the learner active, then wait for the real backend lease to renew once.
 const age=Date.now()-report.starts[0];if(age<45000)await page.waitForTimeout(45000-age);
 if(report.starts.length<2){await speak();await page.waitForFunction(()=>window.__state.phase==='renewing'||window.__state.phase==='error',{},{timeout:65000});await waitListening();}
 assert.ok(report.starts.length>=2,'Transport did not renew');assert.equal(await page.evaluate(()=>window.__micRequests),1);report.renewalKeepsMicrophone=true;
 await page.evaluate(()=>window.__chat.end());assert.equal(await page.evaluate(()=>window.__testTrack.readyState),'ended');report.closeStopsTrack=true;
 // A third valid rapid start is permitted (the original two-in-two-minutes failure).
 const sdp=await page.evaluate(async()=>{const pc=window.__thirdPeer=new RTCPeerConnection();pc.addTransceiver('audio',{direction:'sendrecv'});pc.createDataChannel('events');await pc.setLocalDescription(await pc.createOffer());return pc.localDescription.sdp;});
 const plan=await page.evaluate(()=>window.__plan);const third=await call({action:'speaking_start',consent:'realtime-audio-v1',clientRequestId:crypto.randomUUID(),plan,sdp});assert.equal(third.status,200);await call({action:'speaking_stop',callId:third.data.callId,expiresAt:third.data.expiresAt,stopToken:third.data.stopToken});report.thirdRapidStartAllowed=true;report.thirdStartElapsedMs=Date.now()-report.starts[0];
 report.errors.push(...await page.evaluate(()=>window.__state.errors));assert.deepEqual(report.errors,[]);report.ok=true;console.log('REAL_CHAT_PASS',JSON.stringify(report));
 await page.evaluate(()=>{window.__thirdPeer.close();void window.__audioContext.close();});await context.close();
}finally{await writeFile('artifacts/chat-live/result.json',JSON.stringify(report,null,2));await browser.close();}
