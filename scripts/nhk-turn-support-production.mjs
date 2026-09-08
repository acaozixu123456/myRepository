import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const base='https://nihongo-discovery-v2-20260831.vercel.app';
const report={scope:'PRODUCTION_EXACT_MOBILE_APP_ASSETS_AND_EXISTING_VOICE_PROXY',ok:false,sourceCommit:process.env.GITHUB_SHA||'',assets:[],health:null};
await mkdir('artifacts/turn-support-production',{recursive:true});
try{
 const html=await readFile('dist/index.html','utf8');const assets=[...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+\.(?:js|css))"/g)].map(m=>m[1]);assert.ok(assets.length>0);
 const digest=b=>createHash('sha256').update(b).digest('hex');const expected=new Map();for(const path of assets)expected.set(path,digest(await readFile(`dist${path}`)));
 let matched=false;
 for(let attempt=0;attempt<30;attempt++){
  try{
   const live=await fetch(`${base}/?turn-support=${report.sourceCommit}`,{cache:'no-store',signal:AbortSignal.timeout(12000)});assert.equal(live.status,200);const page=await live.text();assert.ok(assets.every(a=>page.includes(a)),'New mobile assets not yet promoted');
   const found=[];for(const [path,sha]of expected){const r=await fetch(`${base}${path}`,{cache:'no-store',signal:AbortSignal.timeout(12000)});assert.equal(r.status,200);const bytes=Buffer.from(await r.arrayBuffer());assert.equal(digest(bytes),sha);found.push({path,sha256:sha});}
   const js=(await Promise.all(assets.filter(p=>p.endsWith('.js')).map(p=>readFile(`dist${p}`,'utf8')))).join('\n');for(const marker of ['nhk-turn-support-v1','收起提示','显示提示','nihongo-chat-experience-v1'])assert.ok(js.includes(marker),`Missing deployed ${marker}`);
   report.assets=found;matched=true;break;
  }catch(error){if(attempt===29)throw error;await new Promise(r=>setTimeout(r,6000));}
 }
 assert.equal(matched,true);
 const r=await fetch(`${base}/api/nhk-speech`,{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({action:'speaking_health'}),signal:AbortSignal.timeout(20000)});assert.equal(r.status,200);const health=await r.json();assert.equal(health.ok,true);assert.equal(health.model,'gpt-realtime-2.1');assert.equal(health.chatContract,'nhk-chat-v2');report.health=health;
 report.ok=true;console.log('TURN_SUPPORT_PRODUCTION_PASS',JSON.stringify(report));
}finally{await writeFile('artifacts/turn-support-production/result.json',JSON.stringify(report,null,2));}
