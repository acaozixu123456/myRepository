import {chromium} from 'playwright';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const anon=(await readFile('api/nhk-speech.ts','utf8')).match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)?.[0];if(!anon)throw new Error('public app token missing');
const endpoint='https://kivebsjsdfdobxzaokbj.supabase.co/functions/v1/nihongo-companion';
const clientKey=createHash('sha256').update('notes-diagnostic:'+process.env.GITHUB_RUN_ID).digest('hex').slice(0,48);
const call=async(body)=>{const r=await fetch(endpoint,{method:'POST',headers:{Authorization:`Bearer ${anon}`,apikey:anon,'Content-Type':'application/json'},body:JSON.stringify({...body,clientKey}),signal:AbortSignal.timeout(45000)});return{status:r.status,data:await r.json()};};
const report={scope:'REAL_SIGNED_FEEDBACK_API_SYNTHETIC_TEXT_FIXTURES_NO_USER_MIC_NO_KEYS_IN_ARTIFACT',results:[]};
await mkdir('artifacts/notes-diagnostic',{recursive:true});const browser=await chromium.launch({headless:true});let ticket,timer;
try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:4173/companion.html');
 const data=await page.evaluate(async()=>{const {LOCAL_SEEDS}=await import('/src/companion/model.ts');const pc=window.__pc=new RTCPeerConnection();pc.addTransceiver('audio',{direction:'sendrecv'});window.__dc=pc.createDataChannel('oai-events');await pc.setLocalDescription(await pc.createOffer());return{sdp:pc.localDescription.sdp,seed:LOCAL_SEEDS[0]};});
 const start=await call({action:'start',consent:'companion-realtime-v3',clientRequestId:crypto.randomUUID(),...data});assert.equal(start.status,200,JSON.stringify({status:start.status,reason:start.data.reason}));
 ticket={callId:start.data.callId,expiresAt:start.data.expiresAt,token:start.data.token};timer=setInterval(()=>void call({action:'heartbeat',...ticket}).catch(()=>{}),25000);
 await page.evaluate(async sdp=>window.__pc.setRemoteDescription({type:'answer',sdp}),start.data.sdp);
 const fixtures=[
  ['past','昨日はどうでしたか。','昨日は忙しいでした。','auto'],
  ['correct','昨日はどうでしたか。','昨日は忙しかったです。','auto'],
  ['drink','何を飲みますか。','コーヒー。','auto'],
  ['like','何が好きですか。','コーヒー。','auto'],
  ['choice','コーヒーとお茶、どちらがいいですか。','コーヒー。','auto'],
  ['repair','昨日は忙しかったですか。','忙しいでした、あ、忙しかったです。','auto'],
  ['meaning','つい長く見ちゃいますか。','つい是什么意思？','question'],
  ['help','猫は飼っていますか。','我没养猫，只喜欢看猫的视频。','help'],
  ['time','いつ回答しますか。','不是明天下午，是明天上午答复。','help']
 ];
 for(const [name,q,u,mode] of fixtures){const input={requestId:crypto.randomUUID(),mode,anchorId:'fixture-user',source:u,target:0,context:[{id:'fixture-ai',role:'assistant',text:q,delivered:true,interrupted:false,assistance:'none'},{id:'fixture-user',role:'user',text:u,delivered:true,interrupted:false,assistance:'none'}]};const started=Date.now();const result=await call({action:'feedback',...ticket,input});report.results.push({name,q,u,mode,status:result.status,data:result.data,ms:Date.now()-started});console.log('NOTE_FIXTURE',JSON.stringify(report.results.at(-1)));}
 await page.evaluate(()=>window.__pc.close());
}finally{clearInterval(timer);if(ticket)await call({action:'stop',...ticket}).catch(()=>{});await writeFile('artifacts/notes-diagnostic/result.json',JSON.stringify(report,null,2));await browser.close();}
assert.ok(report.results.every(r=>r.status===200),'Feedback request failures are recorded, not treated as no correction needed');
