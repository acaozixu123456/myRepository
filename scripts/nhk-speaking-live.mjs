import {chromium} from 'playwright';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
// Use only the existing PUBLIC project anon JWT. Provider/service secrets stay in the edge.
const source=await readFile('api/nhk-speech.ts','utf8');
const anon=source.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)?.[0];
if(!anon)throw new Error('Public app project token not found');
const edge='https://kivebsjsdfdobxzaokbj.supabase.co/functions/v1/nihongo-speaking-session';
const call=async(body)=>{const r=await fetch(edge,{method:'POST',headers:{Authorization:`Bearer ${anon}`,apikey:anon,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(35000)});return{status:r.status,data:await r.json()};};
await mkdir('artifacts/speaking-live',{recursive:true});
const report={scope:'REAL_MODEL_SDP_SIDEBAND_AND_ONE_GENERATED_AUDIO_RESPONSE_NO_HUMAN_MIC',health:null,consentRejected:false,duplicateRejected:false,audio:null,stopConfirmed:false};
const health=await call({action:'health'});report.health=health.data;console.log('HEALTH',JSON.stringify(health));
await writeFile('artifacts/speaking-live/result.json',JSON.stringify(report,null,2));
assert.equal(health.status,200,'Voice model/credential readiness failed');assert.equal(health.data.modelReady,true);
const missing=await call({action:'start'});report.consentRejected=missing.status===400&&missing.data.reason==='explicit_audio_consent_required';assert.equal(report.consentRejected,true);
const server=createServer((req,res)=>{res.setHeader('content-type','text/html');res.end('<!doctype html><title>Voice transport QA</title>');});
await new Promise(r=>server.listen(4179,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});let ticket;
try{
  const page=await browser.newPage();await page.goto('http://127.0.0.1:4179');
  const sdp=await page.evaluate(async()=>{
    const pc=window.__pc=new RTCPeerConnection();pc.addTransceiver('audio',{direction:'sendrecv'});
    const audio=document.createElement('audio');audio.autoplay=true;document.body.appendChild(audio);pc.ontrack=e=>{audio.srcObject=e.streams[0];audio.play().catch(()=>{});};
    const dc=window.__dc=pc.createDataChannel('oai-events');window.__events=[];dc.onmessage=e=>{const v=JSON.parse(e.data);window.__events.push(v);};
    await pc.setLocalDescription(await pc.createOffer());return pc.localDescription.sdp;
  });
  const plan={articleId:'qa-speaking-transport',title:'子どもを守る',source:['子どもを守るためです。'],steps:[{targetJa:'子ども'},{targetJa:'子どもを守るためです。'},{}]};
  const input={action:'start',consent:'realtime-audio-v1',clientRequestId:randomUUID(),clientKey:createHash('sha256').update(`qa:${process.env.GITHUB_RUN_ID||'manual'}`).digest('hex').slice(0,48),plan,sdp};
  const start=await call(input);
  if(!start.data.ok)console.log('START_FAILURE',JSON.stringify({status:start.status,reason:start.data.reason,upstreamStatus:start.data.upstreamStatus,parameter:start.data.parameter}));
  assert.equal(start.status,200,'Realtime handshake failed');assert.equal(start.data.model,'gpt-realtime-2.1');
  ticket={action:'stop',callId:start.data.callId,expiresAt:start.data.expiresAt,stopToken:start.data.stopToken};
  const duplicate=await call(input);report.duplicateRejected=duplicate.status===409;assert.equal(report.duplicateRejected,true);
  await page.evaluate(async sdp=>{await window.__pc.setRemoteDescription({type:'answer',sdp});},start.data.sdp);
  await page.waitForFunction(()=>window.__dc.readyState==='open',{},{timeout:20000});
  await page.evaluate(()=>window.__dc.send(JSON.stringify({type:'response.create',response:{output_modalities:['audio'],instructions:'Say only this natural Japanese sentence once: まず、子どもと言ってみましょう。',metadata:{purpose:'nhk-speaking-transport-smoke'}}})));
  await page.waitForFunction(()=>window.__events.some(e=>e.type==='response.done'||e.type==='error'),{},{timeout:25000});
  await page.waitForFunction(()=>window.__events.some(e=>e.type==='output_audio_buffer.stopped'),{},{timeout:20000});
  const result=await page.evaluate(async()=>{const events=window.__events;const done=events.find(e=>e.type==='response.done');const stats=await window.__pc.getStats();let bytes=0;stats.forEach(r=>{if(r.type==='inbound-rtp'&&r.kind==='audio')bytes+=r.bytesReceived||0;});return{peer:window.__pc.connectionState,status:done?.response?.status,receivedAudioBytes:bytes,playbackEnded:events.some(e=>e.type==='output_audio_buffer.stopped'),japaneseTranscript:events.find(e=>e.type==='response.output_audio_transcript.done')?.transcript||'',eventErrors:events.filter(e=>e.type==='error').map(e=>e.error?.code||'unknown')};});
  report.audio=result;assert.equal(result.status,'completed');assert.ok(result.receivedAudioBytes>0);assert.deepEqual(result.eventErrors,[]);assert.ok(result.japaneseTranscript.includes('子ども'));
  const stop=await call(ticket);ticket=null;report.stopConfirmed=stop.status===200;assert.equal(report.stopConfirmed,true);await page.evaluate(()=>window.__pc.close());
  console.log('REAL_TRANSPORT_RESULT',JSON.stringify(report));
}finally{if(ticket)await call(ticket).catch(()=>{});await writeFile('artifacts/speaking-live/result.json',JSON.stringify(report,null,2));await browser.close();await new Promise(r=>server.close(r));}
