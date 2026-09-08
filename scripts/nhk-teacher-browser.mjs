import {readFile,writeFile,unlink} from 'node:fs/promises';
let s=await readFile('scripts/nhk-chat-browser.mjs','utf8');
const once=(a,b)=>{if(s.split(a).length!==2)throw new Error(`Phone fixture anchor missing: ${a.slice(0,60)}`);s=s.replace(a,b);};
once('const reply=async()=>page.evaluate(id=>{const emit=e=>window.__voice.dc.onmessage({data:JSON.stringify(e)});',`const reply=async()=>page.evaluate(id=>{const emit=e=>window.__voice.dc.onmessage({data:JSON.stringify(e)});
 const req=window.__voice.events.filter(e=>e.type==='response.create'&&e.response.metadata?.purpose==='nhk-gentle-teacher-v1').at(-1);
 if(req){const metadata=req.response.metadata;const draft='draft-'+metadata.requestId;emit({type:'response.created',response:{id:draft,metadata}});emit({type:'response.done',response:{id:draft,metadata,status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({turnKey:metadata.turnKey,say:'かわいいですよね。猫は飼っていますか。',words:['飼っています','飼っていません'],starter:'今は…',example:'今は飼っていません。'})}]}]}});}
`);
once("assert.ok(lastRequest.response.instructions.includes('MOST RECENT question'));assert.ok(lastRequest.response.instructions.includes('猫は飼っていますか'));", "assert.ok(lastRequest.response.instructions.includes('今は飼っていません'));assert.ok(!lastRequest.response.instructions.includes('SNSについてのニュース'));");
once("results.checks.push('help uses current question');", `results.checks.push('help speaks checked current-question option, not news');
 await d.getByRole('button',{name:'慢一点',exact:true}).click();await reply();
 const pace=await page.evaluate(()=>window.__voice.events.filter(e=>e.type==='session.update').map(e=>e.session.audio.output.speed));assert.deepEqual(pace,[0.8,0.7]);
 await d.getByRole('button',{name:'再简单点',exact:true}).click();const draft=await page.evaluate(()=>window.__voice.events.filter(e=>e.type==='response.create').at(-1));assert.equal(draft.response.output_modalities[0],'text');assert.ok(draft.response.instructions.includes('ACTION=simplify'));await reply();
 assert.equal(await page.evaluate(()=>window.__voice.calls),1);results.checks.push('slow/rephrase keep same microphone and peer; checked text before audio');
 await d.evaluate(el=>{el.scrollTop=0;});await page.screenshot({path:'artifacts/chat/phone-gentle-teacher.png',fullPage:true});`);
const target='scripts/.nhk-teacher-browser-run.mjs';await writeFile(target,s);try{await import('./.nhk-teacher-browser-run.mjs');}finally{await unlink(target).catch(()=>{});}
