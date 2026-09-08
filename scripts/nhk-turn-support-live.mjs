import {readFile,writeFile,unlink} from 'node:fs/promises';
// Apply nhk-chat-live-diagnostics.mjs first: real continuous synthetic microphone, never human audio.
let s=await readFile('scripts/nhk-chat-live.mjs','utf8');
const once=(a,b)=>{if(s.split(a).length!==2)throw new Error(`Support live anchor: ${a.slice(0,80)}`);s=s.replace(a,b);};
once("window.__state={phase:'idle',assistant:'',outputs:[],heard:[],errors:[]};","window.__state={phase:'idle',assistant:'',outputs:[],heard:[],errors:[],supportFrames:[],metrics:[]};");
once("{phase:p=>{window.__state.phase=p;}","{support:f=>{if(f)window.__state.supportFrames.push(f);},metric:e=>window.__state.metrics.push(e),phase:p=>{window.__state.phase=p;}");
once(" await waitListening();assert.ok(report.responses[0].includes('動画'));",` const waitSupport=async()=>{await page.waitForFunction(()=>window.__state.supportFrames.at(-1)?.origin==='model',{},{timeout:9000});const frame=await page.evaluate(()=>window.__state.supportFrames.at(-1));assert.ok(frame.words.length||frame.starter);assert.equal(typeof frame.example,'string');report.supportExamples=report.supportExamples||[];report.supportExamples.push(frame);};
 await waitListening();assert.ok(report.responses[0].includes('動画'));await waitSupport();`);
once('await speak();let heard=', 'await speak();await waitSupport();let heard=');
once("report.errors.push(...await page.evaluate(()=>window.__state.errors));",`report.supportFrames=await page.evaluate(()=>window.__state.supportFrames.filter(f=>f.origin==='model'));report.metricNames=await page.evaluate(()=>window.__state.metrics);assert.ok(report.supportFrames.length>=2);assert.ok(report.responses.every(s=>!s.includes('turnKey')),'JSON hints leaked into the spoken channel');report.turnSupportPass=true;
 report.errors.push(...await page.evaluate(()=>window.__state.errors));`);
const target='scripts/.nhk-turn-support-live-run.mjs';await writeFile(target,s);try{await import('./.nhk-turn-support-live-run.mjs');}finally{await unlink(target).catch(()=>{});}
