import {readFile,writeFile,unlink,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
// Reuse the actual native audio harness. These edits affect ONLY this temporary test program.
let source=await readFile('scripts/companion-live.mjs','utf8');
const replace=(a,b)=>{assert.equal(source.split(a).length,2,`Unique quiet-teacher test anchor: ${a.slice(0,90)}`);source=source.replace(a,b);};
replace("scope:'REAL_OPENAI_NATIVE_CONVERSATION_SYNTHETIC_JAPANESE_AND_TYPED_HELP_NOT_HUMAN_PHONE'","scope:'REAL_NATIVE_AUDIO_WITH_ASYNC_TEXT_TEACHER_SYNTHETIC_INPUT_NOT_PHYSICAL_PHONE'");
replace('let browser,page;','let browser,page;let holdFeedback=false,releaseFeedback=()=>{};');
replace("const body=route.request().postDataJSON();if(body.action==='companion_start')","const body=route.request().postDataJSON();if(holdFeedback&&body.action==='companion_feedback'){await new Promise(r=>{releaseFeedback=r;});await route.fulfill({status:503,json:{ok:false,reason:'qa_injected_note_failure'}}).catch(()=>{});return;}if(body.action==='companion_start')");
replace("body.action!=='companion_stop'","!['companion_stop','companion_feedback'].includes(body.action)");
replace('const result=await call(body);if(!result.data.ok',"const result=await call(body);if(body.action==='companion_feedback'){report.feedbackRequests??=[];report.feedbackRequests.push({mode:body.input?.mode,status:result.status,reason:result.data.reason,note:result.data.note||null});}if(!result.data.ok");
replace("phase:'idle',lines:[],errors:[]","phase:'idle',lines:[],notes:[],errors:[]");
replace('policy:p=>state.policies.push(p)','policy:p=>state.policies.push(p),written:n=>state.notes.push(n)');
replace("const before=await count();await page.evaluate(()=>window.__companion.action('help'));report.help=await wait(before);assert.equal(await page.evaluate(()=>window.__micRequests),1);",`const before=await count(),noteCount=await page.evaluate(()=>window.__state.notes.length);
 await page.evaluate(()=>window.__companion.writtenHelp());
 await page.waitForFunction(n=>window.__state.notes.length>n,noteCount,{timeout:22000});
 report.help=(await page.evaluate(()=>window.__state.notes.at(-1))).suggestion;
 assert.equal(await count(),before,'Silent help must not produce or cancel a voice reply');
 assert.equal(await page.evaluate(()=>window.__micRequests),1);report.checks.push('explicit Help produces text only without an audio response or microphone request');`);
replace('await page.waitForTimeout(95000);','await page.waitForTimeout(1000);');
replace('assert.ok(report.heartbeats>=3);','assert.ok(report.heartbeats>=1);');
replace('same native peer survives monitor heartbeat/handoff; mute remains closed; prior contrast queried','same native peer retains context and mute during the quiet-teacher probe; long handoff was checked separately');
replace('await page.evaluate(()=>window.__companion.end());',`report.writtenNotes=await page.evaluate(()=>window.__state.notes);
 const ticket=await page.evaluate(()=>window.__companion.ticket); // Runtime-only test credential, NEVER print or persist.
 const fixtures=[
  {name:'minimal-past-tense',q:'昨日はどうでしたか。',u:'昨日は忙しいでした。',mode:'auto',expect:'past'},
  {name:'natural-no-correction',q:'昨日はどうでしたか。',u:'昨日は忙しかったです。',mode:'auto',expect:'none'},
  {name:'drink-word-extension',q:'何を飲みますか。',u:'コーヒー。',mode:'auto',expect:'drink'},
  {name:'preference-word-extension',q:'何が好きですか。',u:'コーヒー。',mode:'auto',expect:'like'},
  {name:'valid-choice-not-an-error',q:'コーヒーとお茶、どちらがいいですか。',u:'コーヒー。',mode:'auto',expect:'not-error'},
  {name:'self-repair-is-not-old-error',q:'昨日は忙しかったですか。',u:'昨日は忙しいでした、あ、忙しかったです。',mode:'auto',expect:'none'},
  {name:'word-meaning-in-text',q:'つい長く見ちゃいますか。',u:'つい是什么意思？',mode:'question',expect:'explanation'},
  {name:'preserve-morning-not-afternoon',q:'いつ回答しますか。',u:'原因还在调查，不是明天下午，是明天上午答复。',mode:'help',expect:'morning'},
  {name:'preserve-negation-in-help',q:'猫は飼っていますか。',u:'我没有养猫，只是喜欢看猫的视频。',mode:'help',expect:'not-own'},
 ];
 report.noteFixtures=[];
 for(const f of fixtures){const input={requestId:crypto.randomUUID(),mode:f.mode,anchorId:'fixture-user',source:f.u,target:0,context:[{id:'fixture-ai',role:'assistant',text:f.q,delivered:true,interrupted:false,assistance:'none'},{id:'fixture-user',role:'user',text:f.u,delivered:true,interrupted:false,assistance:'none'}]};const start=Date.now();const r=await call({action:'feedback',...ticket,input});const note=r.data.note;const ja=note?.suggestion||'';
  let pass=r.status===200;
  if(f.expect==='none')pass=pass&&!note;
  if(f.expect==='past')pass=pass&&note?.kind==='correction'&&ja.includes('忙しかった');
  if(f.expect==='drink')pass=pass&&(!note||(note.kind==='extension'&&/飲/.test(ja)));
  if(f.expect==='like')pass=pass&&(!note||(note.kind==='extension'&&/好き/.test(ja)));
  if(f.expect==='not-error')pass=pass&&!note;
  if(f.expect==='explanation')pass=pass&&note?.kind==='explanation'&&!!note.reasonZh;
  if(f.expect==='morning')pass=pass&&ja.includes('午前')&&(!ja.includes('午後')||/午後ではなく|午後じゃなく/.test(ja));
  if(f.expect==='not-own')pass=pass&&/(?:飼っていません|飼っていない|飼ってない)/.test(ja);
  report.noteFixtures.push({...f,status:r.status,note:note||null,reason:r.data.reason,ms:Date.now()-start,pass});
 }
 const badTicket=await call({action:'feedback',...ticket,token:'0'.repeat(64),input:{}});report.badTicketRejected=badTicket.status===403;assert.equal(report.badTicketRejected,true);
 // Deliberately stall ONLY the optional notes lane. A native answer must still finish.
 holdFeedback=true;await page.evaluate(()=>window.__companion.writtenHelp());await page.waitForTimeout(600);
 report.voiceWhileNoteBlocked=await typed('猫の動画の話に戻りましょう。');
 assert.ok(report.voiceWhileNoteBlocked);holdFeedback=false;releaseFeedback();await page.waitForTimeout(300);
 report.checks.push('native answer completed while text feedback was deliberately stalled and then failed');
 report.writtenSemanticChecksPass=report.noteFixtures.every(f=>f.pass);
 await page.evaluate(()=>window.__companion.end());`);
replace("assert.equal(health.data.mode,'native-stateful-audio');","assert.equal(health.data.mode,'native-stateful-audio');");
replace("console.log('COMPANION_NATIVE_TRANSPORT_PASS',JSON.stringify(report));","console.log('COMPANION_WRITTEN_REVIEW',JSON.stringify(report));assert.ok(report.writtenSemanticChecksPass,'Text feedback fixture failed; preserve actual generated notes for supervisor review');");
const temp='scripts/.companion-written-probe.mjs';await writeFile(temp,source);await mkdir('artifacts/companion-written',{recursive:true});
try{const result=spawnSync(process.execPath,[temp],{stdio:'inherit',timeout:520000});await writeFile('artifacts/companion-written/result.json',await readFile('artifacts/companion-live/result.json'));assert.equal(result.status,0,'Real quiet-teacher probe failed');}finally{await unlink(temp).catch(()=>{});}
