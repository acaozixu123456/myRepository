// Synthetic test material only. Never log credentials or send learner answers.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const out=process.env.NHK_EVIDENCE_DIR || '/tmp/nhk-artifacts';mkdirSync(out,{recursive:true});
const source=readFileSync('api/nhk-sentence.ts','utf8');
const key=source.match(/SUPABASE_ANON_KEY = .*\|\| '([^']+)'/)[1];
const endpoint='https://kivebsjsdfdobxzaokbj.supabase.co/functions/v1/nihongo-sentence';
const sentence='図書館を利用することができなくなるわけではありません。';
const input={title:'図書館の窓口変更（開発用の例）',sentence,sentenceIndex:19,before:['図書館では、来月から建物の工事を行います。','工事の間、窓口の場所が変わります。'],after:['オンラインのサービスも続けます。'],clientKey:'release-reliability-smoke'};
const call=async(body,auth=true)=>{const started=Date.now();const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:`Bearer ${key}`,apikey:key}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});return {status:r.status,durationMs:Date.now()-started,body:await r.json()};};
const result={scope:'Synthetic input through LIVE deployed edge; not an NHK article or human learning efficacy test',checks:[]};
try {
 const unauthorized=await call(input,false);assert.equal(unauthorized.status,401);result.checks.push('JWT required');
 const invalid=await call({...input,sentence:'日'.repeat(8001)});result.invalid=invalid;assert.equal(invalid.status,400);result.checks.push('Oversize rejected explicitly');
 const first=await call(input);result.first=first;assert.equal(first.status,200);assert.equal(first.body.ok,true);
 const r=first.body.analysis.recommendation;assert.equal(r.sentence,sentence);assert.equal(r.sentenceIndex,19);assert.equal(r.chunks.join('').replace(/\s/g,''),sentence);assert(r.translationZh.length>0);assert(r.structureZh.length>0);result.checks.push('Exact source/index/chunks, real nonempty explanation');
 const second=await call(input);assert.equal(second.status,200);assert.equal(second.body.cached,true);result.cacheDurationMs=second.durationMs;result.checks.push('Server cache reused');result.status='PASS';
} catch(e){result.status='FAIL';result.error=e.message;process.exitCode=1;}
writeFileSync(`${out}/live-sentence-smoke.json`,JSON.stringify(result,null,2));console.log(JSON.stringify({status:result.status,checks:result.checks,error:result.error}));
