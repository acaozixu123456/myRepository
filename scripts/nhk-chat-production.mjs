import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base='https://nihongo-discovery-v2-20260831.vercel.app';
await mkdir('artifacts/chat-production',{recursive:true});
const report={sourceCommit:process.env.GITHUB_SHA,checkedAt:new Date().toISOString(),bundle:false,health:null,checks:[],ok:false};
try{
 for(let i=0;i<36;i++){
  try{
   const html=await fetch(`${base}/?chat-check=${Date.now()}`,{cache:'no-store',signal:AbortSignal.timeout(10000)}).then(r=>r.text());
   for(const m of html.matchAll(/src="(\/assets\/[^" ]+\.js)"/g)){
    const s=await fetch(base+m[1],{signal:AbortSignal.timeout(10000)}).then(r=>r.text());
    if(s.includes('nhk-chat-v2')&&s.includes('app_burst_limited')&&s.includes('随机找个话头')){report.bundle=true;report.asset=m[1];}
   }
   if(report.bundle)break;
  }catch{}
  await new Promise(r=>setTimeout(r,5000));
 }
 assert.equal(report.bundle,true,'New chat bundle has not reached production');
 const post=async(body,origin=base)=>{const r=await fetch(`${base}/api/nhk-speech`,{method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(25000)});return{status:r.status,data:await r.json()};};
 const health=await post({action:'speaking_health'});report.health=health;assert.equal(health.status,200);assert.equal(health.data.chatContract,'nhk-chat-v2');assert.equal(health.data.modelReady,true);
 assert.equal((await post({action:'speaking_start'},'')).status,403);report.checks.push('origin required');
 assert.equal((await post({action:'speaking_start'},'https://unrelated.example')).status,403);report.checks.push('cross-origin rejected');
 const consent=await post({action:'speaking_start'});assert.equal(consent.data.reason,'explicit_audio_consent_required');report.checks.push('explicit consent required');
 assert.equal((await post({action:'speaking_start',consent:'realtime-audio-v1',plan:{chatMode:true,topicId:'invented'}})).status,400);report.checks.push('invalid topic/source rejected');
 assert.equal((await post({action:'tts',text:''})).data.reason,'invalid_text');report.checks.push('legacy TTS validation intact');
 report.ok=true;console.log('PRODUCTION_ASSETS_AND_PROXY_PASS',JSON.stringify(report));
}finally{await writeFile('artifacts/chat-production/result.json',JSON.stringify(report,null,2));}
