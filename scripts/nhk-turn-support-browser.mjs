import {readFile,writeFile,unlink} from 'node:fs/promises';
// Extend the already-established PHONE-only fixture; no live learner records or API calls.
let source=await readFile('scripts/nhk-chat-browser.mjs','utf8');
const once=(a,b)=>{if(source.split(a).length!==2)throw new Error(`Mobile support anchor: ${a.slice(0,70)}`);source=source.replace(a,b);};
once("transcript:'かわいいですよね。猫は飼っていますか。'", "transcript:window.__voice.events.filter(e=>e.type==='response.create'&&e.response.output_modalities[0]==='audio').at(-1)?.response.instructions.includes('MOST RECENT question')?'例えば、今は飼っていません。':'かわいいですよね。猫は飼っていますか。'");
once("await page.screenshot({path:'artifacts/chat/phone-entry.png',fullPage:true});",`assert.equal(await page.evaluate(()=>localStorage.getItem('nihongo-chat-experience-v1')),null);
 await page.locator('.nhk-experience-settings summary').click();await page.getByRole('checkbox',{name:'只在这台手机记录体验'}).check();await page.locator('.nhk-experience-settings summary').click();
 await page.screenshot({path:'artifacts/chat/phone-entry.png',fullPage:true});`);
once(" const d=page.getByRole('dialog');",` const finishHint=async(req,word='飼っています')=>page.evaluate(({req,word})=>{const metadata=req.response.metadata;const id='hint-'+metadata.requestId;const emit=e=>window.__voice.dc.onmessage({data:JSON.stringify(e)});emit({type:'response.created',response:{id,metadata}});emit({type:'response.done',response:{id,metadata,status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({turnKey:metadata.turnKey,words:[word,'飼っていません'],starter:'私は…',example:'今は飼っていません。'})}]}]}});},{req,word});
 const hintRequest=()=>page.evaluate(()=>window.__voice.events.filter(e=>e.type==='response.create'&&e.response.metadata?.purpose==='nhk-turn-support-v1').at(-1));
 const currentHint=await hintRequest();assert.ok(currentHint);await finishHint(currentHint);
 assert.ok((await page.locator('.nhk-turn-support-chips').textContent()).includes('飼っています'));
 assert.equal(await page.locator('.nhk-turn-support-example').count(),0);
 const d=page.getByRole('dialog');
 await d.getByRole('button',{name:'收起提示',exact:true}).click();assert.equal(await page.locator('.nhk-turn-support-chips').count(),0);
 await d.getByRole('button',{name:'显示提示',exact:true}).click();assert.ok((await page.locator('.nhk-turn-support-chips').textContent()).includes('飼っています'));
 results.checks.push('later-turn keywords, example collapsed, hide/show without reconnect');
 await page.screenshot({path:'artifacts/chat/phone-turn-support.png',fullPage:true});`);
once("results.checks.push('help uses current question');",`results.checks.push('help uses current question');assert.ok(lastRequest.response.instructions.includes('今は飼っていません'));
 assert.equal(await page.locator('.nhk-turn-support-example').count(),1);
 assert.ok((await page.locator('.nhk-turn-support-example').textContent()).includes('今は飼っていません'));
 await page.screenshot({path:'artifacts/chat/phone-support-help.png',fullPage:true});`);
once("await page.screenshot({path:'artifacts/chat/phone-chat.png',fullPage:true});",`await finishHint(currentHint,'古いヒント');assert.ok(!(await page.locator('.nhk-turn-support').textContent()).includes('古いヒント'));
 const newHint=await hintRequest();await finishHint(newHint);results.checks.push('late old hint cannot overwrite new topic');
 await page.screenshot({path:'artifacts/chat/phone-chat.png',fullPage:true});`);
once(" failNext=true;",` const ux=await page.evaluate(()=>JSON.parse(localStorage.getItem('nihongo-chat-experience-v1')));assert.equal(ux.rows.length,1);assert.equal(ux.rows[0].answerEvents,5);assert.ok(ux.rows[0].helpUses>=1);assert.ok(!JSON.stringify(ux).includes('猫'));assert.ok(!JSON.stringify(ux).includes('SNS'));results.checks.push('opt-in local event-only records, no transcript or article');
 await page.locator('.nhk-experience-settings summary').click();await page.getByRole('button',{name:'清除并关闭记录',exact:true}).click();assert.equal(await page.evaluate(()=>localStorage.getItem('nihongo-chat-experience-v1')),null);assert.equal(await page.evaluate(()=>localStorage.getItem('nihongo-nhk-article-library-v1')),savedBefore);
 failNext=true;`);
const target='scripts/.nhk-turn-support-browser-run.mjs';await writeFile(target,source);try{await import('./.nhk-turn-support-browser-run.mjs');}finally{await unlink(target).catch(()=>{});}
