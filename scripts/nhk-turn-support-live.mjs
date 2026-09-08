import {readFile,writeFile,unlink} from 'node:fs/promises';
// Apply nhk-chat-live-diagnostics.mjs first: real continuous synthetic microphone, never human audio.
let s=await readFile('scripts/nhk-chat-live.mjs','utf8');
const once=(a,b)=>{if(s.split(a).length!==2)throw new Error(`Support live anchor: ${a.slice(0,80)}`);s=s.replace(a,b);};
once("window.__state={phase:'idle',assistant:'',outputs:[],heard:[],errors:[]};","window.__state={phase:'idle',assistant:'',outputs:[],heard:[],errors:[],supportFrames:[],metrics:[],supportEvents:[]};");
once("{phase:p=>{window.__state.phase=p;}","{support:f=>{if(f)window.__state.supportFrames.push(f);},metric:e=>window.__state.metrics.push(e),phase:p=>{window.__state.phase=p;}");
once('  await window.__chat.start();',`  const oldSupport=window.__chat.support.handle.bind(window.__chat.support);
  window.__chat.support.handle=e=>{if(e.type==='error'||e.response?.metadata?.purpose==='nhk-turn-support-v1')window.__state.supportEvents.push({type:e.type,error:e.error,response:e.response});return oldSupport(e);};
  await window.__chat.start();`);
once(" await waitListening();assert.ok(report.responses[0].includes('動画'));",` const waitSupport=async()=>{try{await page.waitForFunction(()=>window.__state.supportFrames.at(-1)?.origin==='model',{},{timeout:9000});}catch(error){report.hintDiagnostic=await page.evaluate(()=>({frames:window.__state.supportFrames,events:window.__state.supportEvents,metrics:window.__state.metrics,phase:window.__state.phase,responses:window.__chat.responses,pending:window.__chat.support.pending}));throw error;}const frame=await page.evaluate(()=>window.__state.supportFrames.at(-1));assert.ok(frame.words.length||frame.starter);assert.equal(typeof frame.example,'string');report.supportExamples=report.supportExamples||[];report.supportExamples.push(frame);};
 await waitListening();assert.ok(report.responses[0].includes('動画'));await waitSupport();`);
once('await speak();let heard=', 'await speak();await waitSupport();let heard=');
once("report.errors.push(...await page.evaluate(()=>window.__state.errors));",`report.supportFrames=await page.evaluate(()=>window.__state.supportFrames.filter(f=>f.origin==='model'));report.metricNames=await page.evaluate(()=>window.__state.metrics);report.hintDiagnostics=await page.evaluate(()=>window.__state.supportEvents);assert.ok(report.supportFrames.length>=2);assert.ok(report.responses.every(s=>!s.includes('turnKey')),'JSON hints leaked into the spoken channel');report.turnSupportPass=true;
 report.errors.push(...await page.evaluate(()=>window.__state.errors));`);
const target='scripts/.nhk-turn-support-live-run.mjs';await writeFile(target,s);try{await import('./.nhk-turn-support-live-run.mjs');}finally{await unlink(target).catch(()=>{});}
