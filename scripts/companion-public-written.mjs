import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const url='https://nihongo-discovery-v2-202608-git-30bf70-acaozixu123456s-projects.vercel.app/companion.html';
const report={scope:'PUBLIC_DEPLOYED_MOBILE_UI_REAL_VERCEL_EDGE_OPENAI_TYPED_FIXTURES_NO_HUMAN_MIC',ok:false,url,notes:[],news:null,errors:[],voiceAnswers:[],micRequests:0};
await mkdir('artifacts/companion-public-written',{recursive:true});const browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});let page;
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 await page.addInitScript(()=>{
  const state=window.__qa={micRequests:0,creates:0,playing:false,generating:false,peers:[]};
  const native=window.RTCPeerConnection;window.RTCPeerConnection=class extends native{constructor(...args){super(...args);state.peers.push(this);}createDataChannel(...args){const dc=super.createDataChannel(...args),send=dc.send.bind(dc);dc.send=(value)=>{try{const e=JSON.parse(value);if(e.type==='response.create'){state.creates++;state.generating=true;}}catch{}return send(value);};dc.addEventListener('message',event=>{try{const e=JSON.parse(event.data);if(e.type==='output_audio_buffer.started')state.playing=true;if(['output_audio_buffer.stopped','output_audio_buffer.cleared'].includes(e.type))state.playing=false;if(e.type==='response.done')state.generating=false;}catch{}});return dc;}};
  if(navigator.mediaDevices){const get=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=(...args)=>{state.micRequests++;return get(...args);};}
 });
 page.on('response',async response=>{if(!response.url().endsWith('/api/nhk-speech'))return;try{const input=response.request().postDataJSON();const data=await response.json();if(input?.action==='companion_feedback')report.notes.push({mode:input.input?.mode,source:input.input?.source,status:response.status(),model:data.model,disposition:data.disposition,note:data.note||null});if(input?.action==='companion_topics'&&input.lane==='news')report.news={status:response.status(),reason:data.reason,topics:data.topics?.map(s=>({title:s.title,opening:s.opening,context:s.context,sources:s.sources}))};}catch{}});
 const load=await page.goto(url,{waitUntil:'domcontentloaded'});assert.equal(load.status(),200,'Preview must be ordinarily accessible, not authentication-bypassed');
 const beforeStorage=await page.evaluate(()=>JSON.stringify({...localStorage}));
 await page.getByRole('button',{name:'聊一会儿',exact:true}).click();
 const settled=async()=>page.waitForFunction(()=>window.__qa.creates>0&&!window.__qa.playing&&!window.__qa.generating,{timeout:45000});
 await page.waitForFunction(()=>window.__qa.creates>0);await settled();assert.equal(await page.evaluate(()=>window.__qa.micRequests),0);
 const typed=async(value)=>{const old=await page.evaluate(()=>window.__qa.creates);await page.getByRole('button',{name:'更多',exact:true}).click();await page.getByRole('button',{name:/用文字接一句/}).click();await page.getByRole('textbox',{name:'要说的话'}).fill(value);await page.getByRole('button',{name:'递过去',exact:true}).click();await page.waitForFunction(n=>window.__qa.creates>n,old,{timeout:15000});await settled();report.voiceAnswers.push({input:value,answer:await page.locator('.kc-line.assistant>p').last().textContent()});};
 await typed('昨日は忙しいでした。');
 const original=page.locator('.kc-line.user').filter({has:page.locator('p',{hasText:'昨日は忙しいでした。'})}).last();
 await original.locator('.kc-written-note[data-note-kind="correction"]').waitFor({timeout:25000});
 assert.ok((await original.locator('.kc-note-japanese').textContent()).includes('忙しかった'));
 assert.equal(await original.locator(':scope>p').textContent(),'昨日は忙しいでした。','The actual utterance must not be overwritten');
 await original.scrollIntoViewIfNeeded();await page.screenshot({path:'artifacts/companion-public-written/correction-390.png',fullPage:true});
 const responseCount=await page.evaluate(()=>window.__qa.creates);const priorCards=await page.locator('.kc-written-note').count();
 await page.getByRole('button',{name:'接不上',exact:true}).click();await page.waitForFunction(n=>document.querySelectorAll('.kc-written-note').length>n,priorCards,{timeout:25000});
 assert.equal(await page.evaluate(()=>window.__qa.creates),responseCount,'Help must not start voice teaching');assert.equal(await page.evaluate(()=>window.__qa.micRequests),0);
 await typed('这里的「忙しかったです」是什么意思？');
 await page.locator('.kc-written-note[data-note-kind="explanation"]').waitFor({timeout:25000});
 const spoken=report.voiceAnswers.at(-1).answer;assert.ok(spoken.length<60,'Language question should not become an unsolicited voice lesson');
 await page.screenshot({path:'artifacts/companion-public-written/meaning-390.png',fullPage:true});
 assert.equal(await page.evaluate(()=>JSON.stringify({...localStorage})),beforeStorage,'No hidden full-conversation or note storage');
 await page.getByRole('button',{name:'结束聊天',exact:true}).click();await page.waitForFunction(()=>window.__qa.peers.every(p=>p.connectionState==='closed'));report.micRequests=await page.evaluate(()=>window.__qa.micRequests);assert.equal(report.micRequests,0);
 await page.getByRole('button',{name:'回去看看',exact:true}).click();await page.locator('.kc-lane').click();await page.getByRole('button',{name:/世界的新鲜事/}).click();
 await page.waitForFunction(()=>!document.querySelector('.kc-topic-note')?.textContent?.includes('在找新的'),{timeout:55000});
 for(let i=0;i<55&&!report.news;i++)await page.waitForTimeout(1000);
 assert.equal(report.news?.status,200,'Real sourced news must pass its own public API gate');assert.ok(report.news.topics.length>0);assert.ok(report.news.topics.every(t=>t.sources?.length&&t.context.includes('发布日期：')));
 await page.screenshot({path:'artifacts/companion-public-written/news-390.png',fullPage:true});
 assert.deepEqual(report.errors,[]);report.ok=true;await context.close();console.log('PUBLIC_WRITTEN_GATE',JSON.stringify(report));
}catch(e){report.failure=e instanceof Error?e.message:String(e);throw e;}finally{if(page&&!page.isClosed()){await page.getByRole('button',{name:'结束聊天',exact:true}).click({timeout:1500}).catch(()=>{});}await writeFile('artifacts/companion-public-written/result.json',JSON.stringify(report,null,2));await browser.close();}
