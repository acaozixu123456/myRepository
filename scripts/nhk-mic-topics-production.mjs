import {readFile,mkdir,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
// Existing gate checks exact deployed JS/CSS against this build and legacy teacher/TTS behavior.
await import('./nhk-teacher-production.mjs');
const html=await readFile('dist/index.html','utf8');const js=(await Promise.all([...html.matchAll(/src="(\/assets\/[^\"]+\.js)"/g)].map(m=>readFile(`dist${m[1]}`,'utf8')))).join('\n');
for(const marker of ['nhk-manual-mic-v1','nhk-topic-catalog-v1','开启麦克风','关闭麦克风'])assert.ok(js.includes(marker),`Missing promoted feature ${marker}`);
const base='https://nihongo-discovery-v2-20260831.vercel.app';const post=async(body,origin=base)=>{const r=await fetch(`${base}/api/nhk-speech`,{method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});return{status:r.status,data:await r.json()};};
const report={ok:false,source:process.env.GITHUB_SHA,health:null,negativeChecks:{}};
await mkdir('artifacts/mic-topics-production',{recursive:true});
try{const health=await post({action:'speaking_health'});report.health=health;assert.equal(health.status,200);assert.equal(health.data.model,'gpt-realtime-2.1');assert.equal(health.data.topicCatalog,'nhk-topic-catalog-v1');
 for(const [name,origin,status]of[['noOrigin','',403],['crossOrigin','https://unrelated.example',403],['invalidSource',base,400]]){const r=await post({action:'speaking_topics',exclude:[]},origin);report.negativeChecks[name]=r.status;assert.equal(r.status,status);}
 report.ok=true;console.log('PROMOTED_MIC_TOPICS_ASSETS',JSON.stringify(report));}finally{await writeFile('artifacts/mic-topics-production/assets.json',JSON.stringify(report,null,2));}
