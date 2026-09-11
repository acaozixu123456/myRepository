import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const out=process.env.IMMERSION_LIVE_OUT||'artifacts/immersion-live';await mkdir(out,{recursive:true});
execFileSync('node_modules/.bin/esbuild',['src/immersion/selectionFocus.ts','--bundle','--platform=node','--format=esm','--outfile=/tmp/immersion-focus.mjs']);
const {standaloneFocus}=await import('file:///tmp/immersion-focus.mjs');
const preview=process.env.IMMERSION_PREVIEW==='1',base='https://nihongo-discovery-v2-20260831.vercel.app';
const source=await readFile('api/nhk-speech.ts','utf8'),token=source.match(/const SUPABASE_ANON_KEY[^\n]*?'([^']+)'/)?.[1];assert.ok(token);
const clientKey=createHash('sha256').update('immersion03-live-'+(process.env.GITHUB_RUN_ID||randomUUID())).digest('hex').slice(0,48);let ticket,cookie='';
const trace=[],report={ok:false,scope:'ACTUAL_MODEL_TEXT_STUDY_NO_PHYSICAL_MICROPHONE_NO_REALTIME_START',preview,results:[],requests:[],physicalIPhoneTested:false};
async function request(action,input,credentials=true){
 const mapped=action==='health'?'companion_health':action==='study_session'?'companion_study_session':'companion_'+action;
 const headers=preview?{'Content-Type':'application/json',Authorization:'Bearer '+token,apikey:token}:{'Content-Type':'application/json',Origin:base,'User-Agent':'HITOKOTO-IMMERSION03-Bounded-QA',...(cookie?{Cookie:cookie}:{})};
 const body=preview?{action,clientKey,...(credentials?{studyTicket:ticket}:{}),...(input?{input}: {})}:{action:mapped,...(credentials?{studyTicket:ticket}:{}),...(input?{input}: {})};
 const url=preview?'https://kivebsjsdfdobxzaokbj.supabase.co/functions/v1/nihongo-companion-immersion-preview':base+'/api/nhk-speech';
 const r=await fetch(url,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(65000)});
 const setCookie=r.headers.getSetCookie?.();if(setCookie?.length)cookie=setCookie.map(s=>s.split(';')[0]).join('; ');
 let v;try{v=await r.json();}catch{v={ok:false,reason:'non_json_response'};}
 trace.push({action,status:r.status,ok:v.ok,reason:v.reason||null});return{status:r.status,value:v};
}
try{
 const bootstrap=await request('study_session',null,false);assert.equal(bootstrap.status,200,JSON.stringify(bootstrap.value));assert.ok(bootstrap.value.ticket?.token);ticket=bootstrap.value.ticket;
 for(const sample of [{text:'確認',source:'明日までに確認します。',intent:'meaning',expected:/确认|核实|检查/},{text:'つもりが',source:'五分だけ見るつもりが、一時間も見てしまいました。',intent:'breakdown',expected:/本来|打算|计划|结果/}]){
  const input={requestId:randomUUID(),focus:standaloneFocus(sample.text,'assistant',sample.source),intent:sample.intent,register:'natural'};
  const r=await request('study',input);assert.equal(r.status,200,JSON.stringify(r.value));assert.equal(r.value.requestId,input.requestId);assert.equal(r.value.result.original,sample.text);assert.match(r.value.result.meaningZh+' '+r.value.result.explanationZh,sample.expected);
  report.results.push({check:'contextual_selection',selected:sample.text,source:sample.source,result:r.value.result});
 }
 const brief={requestId:randomUUID(),text:'跟同事说明任务尚未完成，仍在调查。请不要把我说成已经完成。',difficulty:'N2',register:'business',entryMode:'chat'};
 const custom=await request('custom_topic',brief);assert.equal(custom.status,200,JSON.stringify(custom.value));assert.equal(custom.value.seed.origin.brief,brief.text);assert.equal(custom.value.seed.origin.difficulty,'N2');assert.equal(custom.value.seed.origin.register,'business');assert.ok(custom.value.seed.signature);report.results.push({check:'custom_topic_preserves_user_origin',seed:{...custom.value.seed,signature:'REDACTED'},subject:custom.value.subject});
 const prepare=await request('study_lesson',{task:'prepare',requestId:randomUUID(),subject:{phrase:'確認',meaningZh:'核实、确认。',kind:'explanation'},previousScene:''});assert.equal(prepare.status,200,JSON.stringify(prepare.value));const lesson=prepare.value.lesson;assert.equal(lesson.subject.phrase,'確認');assert.ok(lesson.signature);report.results.push({check:'standalone_signed_exercise',lesson:{...lesson,signature:'REDACTED'}});
 const assess=await request('study_lesson',{task:'assess',requestId:randomUUID(),lesson,answer:lesson.exampleJa,source:'typed',support:3});assert.equal(assess.status,200,JSON.stringify(assess.value));assert.ok(['communicated','revise','uncertain'].includes(assess.value.assessment.verdict));report.results.push({check:'assessment_of_explicit_example_not_independent_mastery',assessment:assess.value.assessment});
 const forged=await request('study_lesson',{task:'assess',requestId:randomUUID(),lesson:{...lesson,signature:'tampered'},answer:'確認します。',source:'typed',support:0});assert.ok([400,403].includes(forged.status));report.results.push({check:'forged_lesson_rejected',status:forged.status,reason:forged.value.reason});
 const old=ticket;ticket={...ticket,token:'invalid'};const rejected=await request('study',{requestId:randomUUID(),focus:standaloneFocus('確認','assistant','確認します。'),intent:'meaning',register:'natural'});ticket=old;assert.ok([400,403].includes(rejected.status));report.results.push({check:'forged_study_ticket_rejected',status:rejected.status,reason:rejected.value.reason});
 assert.ok(trace.every(r=>r.action!=='start'));report.ok=true;
}catch(e){report.failure=String(e.stack||e);process.exitCode=1;}finally{report.requests=trace;await writeFile(out+'/result.json',JSON.stringify(report,null,2));console.log('IMMERSION_REAL_PROVIDER',JSON.stringify(report));}
