import {readFile,writeFile,mkdir,unlink} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const base='https://nihongo-discovery-v2-20260831.vercel.app';
await mkdir('artifacts/speaking-production',{recursive:true});
const report={base,checkedAt:new Date().toISOString(),staticFeature:false,proxyHealth:null,negativeChecks:{},legacyValidation:false,realProxyAudio:false};
try{
  for(let attempt=0;attempt<40;attempt++){
    try{
      const page=await fetch(`${base}/?speaking-deploy-check=${Date.now()}`,{cache:'no-store',signal:AbortSignal.timeout(12000)});
      const html=await page.text();
      const assets=[...html.matchAll(/src="([^"]+\.js)"/g)].map(m=>m[1]).filter(p=>p.startsWith('/assets/'));
      for(const asset of assets){const script=await fetch(`${base}${asset}`,{signal:AbortSignal.timeout(12000)}).then(r=>r.text());if(script.includes('nhk-speaking-v1')&&script.includes('gpt-realtime-2.1'))report.staticFeature=true;}
      if(report.staticFeature)break;
    }catch{}
    await new Promise(r=>setTimeout(r,6000));
  }
  assert.equal(report.staticFeature,true,'New speaking bundle has not reached production');
  const post=async(body,origin=base)=>{const r=await fetch(`${base}/api/nhk-speech`,{method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});return {status:r.status,data:await r.json()};};
  const health=await post({action:'speaking_health'});report.proxyHealth=health;assert.equal(health.status,200);assert.equal(health.data.modelReady,true);
  const noOrigin=await post({action:'speaking_start'},'');report.negativeChecks.noOrigin=noOrigin.status;assert.equal(noOrigin.status,403);
  const crossOrigin=await post({action:'speaking_start'},'https://unrelated.example');report.negativeChecks.crossOrigin=crossOrigin.status;assert.equal(crossOrigin.status,403);
  const noConsent=await post({action:'speaking_start'});report.negativeChecks.noConsent=noConsent.status;assert.equal(noConsent.status,400);assert.equal(noConsent.data.reason,'explicit_audio_consent_required');
  const invalid=await post({action:'speaking_start',consent:'realtime-audio-v1'});report.negativeChecks.invalidPlan=invalid.status;assert.equal(invalid.status,400);
  const legacy=await post({action:'tts',text:''});report.legacyValidation=legacy.status===400&&legacy.data.reason==='invalid_text';assert.equal(report.legacyValidation,true);
  // Reuse the already-passing REAL SDP/audio smoke, but go through the deployed Vercel proxy.
  // No provider/service credential is loaded into this runner or browser.
  let live=await readFile('scripts/nhk-speaking-live.mjs','utf8');
  const replaceOnce=(from,to)=>{assert.equal(live.split(from).length,2,`Unique live smoke anchor required: ${from.slice(0,60)}`);live=live.replace(from,to);};
  replaceOnce("const edge='https://kivebsjsdfdobxzaokbj.supabase.co/functions/v1/nihongo-speaking-session';",`const edge='${base}/api/nhk-speech';`);
  replaceOnce("headers:{Authorization:`Bearer ${anon}`,apikey:anon,'Content-Type':'application/json'}",`headers:{Origin:'${base}','Content-Type':'application/json'}`);
  replaceOnce('body:JSON.stringify(body)','body:JSON.stringify({...body,action:`speaking_${body.action}`})');
  replaceOnce("const report={scope:'REAL_MODEL_SDP_SIDEBAND_AND_ONE_GENERATED_AUDIO_RESPONSE_NO_HUMAN_MIC'", "const report={scope:'REAL_PRODUCTION_VERCEL_PROXY_SDP_AND_AUDIO_NO_HUMAN_MIC'");
  const temp='scripts/.nhk-speaking-production-live.mjs';await writeFile(temp,live);
  try{const child=spawnSync(process.execPath,[temp],{stdio:'inherit',timeout:150000});assert.equal(child.status,0,'Production real voice transport failed');report.realProxyAudio=true;}finally{await unlink(temp).catch(()=>{});}
  await writeFile('artifacts/speaking-production/live.json',await readFile('artifacts/speaking-live/result.json'));
  console.log('PRODUCTION_GATE_PASS',JSON.stringify(report));
}finally{await writeFile('artifacts/speaking-production/result.json',JSON.stringify(report,null,2));}
