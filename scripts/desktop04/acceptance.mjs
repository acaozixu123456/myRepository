import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {chromium,webkit} from 'playwright';
const base=process.env.DESKTOP04_BASE||'http://127.0.0.1:4173',out=process.env.DESKTOP04_OUT||'artifacts/desktop04-browser';await mkdir(out,{recursive:true});
execFileSync('node_modules/.bin/esbuild',['src/companion/learningSound.tsx','--bundle','--format=iife','--global-name=SoundTest',`--outfile=${out}/sound-test.js`]);
const reports=[];let browser,page;let stage='start';
const reference='先日更新していただいたファイルについて、ちょっと質問があります。';
try{
 for(const engine of ['chromium','webkit'])for(const viewport of [{width:390,height:844},{width:1280,height:900},{width:1536,height:960}]){
  stage=engine+' '+viewport.width+' init';browser=await({chromium,webkit})[engine].launch({headless:true});
  const context=await browser.newContext({viewport,isMobile:viewport.width<600,hasTouch:viewport.width<600,serviceWorkers:'block',reducedMotion:'no-preference'});
  page=await context.newPage();page.setDefaultTimeout(16000);const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   const s=window.__voice={micRequests:0,tracks:[],peers:0,events:[],dc:null,cues:[],oscillators:0};document.addEventListener('hitokoto:learning-cue',e=>s.cues.push(e.detail.cue));
   if(window.AudioContext){const original=AudioContext.prototype.createOscillator;AudioContext.prototype.createOscillator=function(...args){s.oscillators++;return original.apply(this,args);};}
   Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{s.micRequests++;const t={enabled:true,muted:false,readyState:'live',stop(){this.readyState='ended';}};s.tracks.push(t);return{getTracks:()=>[t],getAudioTracks:()=>[t]};}}});
   window.RTCPeerConnection=class{connectionState='connected';localDescription=null;constructor(){s.peers++;}addTransceiver(){return{sender:{replaceTrack:async()=>{}}};}createDataChannel(){return s.dc={readyState:'connecting',send:raw=>s.events.push(JSON.parse(raw)),close(){},onopen:null,onmessage:null};}async createOffer(){return{type:'offer',sdp:'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n'};}async setLocalDescription(d){this.localDescription=d;}async setRemoteDescription(){s.dc.readyState='open';s.dc.onopen?.();}close(){}};
  });
  await page.route('**/api/nhk-speech',async route=>{
   const b=route.request().postDataJSON();requests.push(b);const i=b.input;
   if(b.action==='companion_start')return route.fulfill({json:{ok:true,contract:'nihongo-companion-v3',model:'gpt-realtime-2.1',sdp:'v=0',callId:'rtc_desktop04_fixture',expiresAt:Date.now()+1200000,token:'a'.repeat(64)}});
   if(b.action==='companion_feedback')return route.fulfill({json:{ok:true,note:{id:i.requestId,anchorId:i.anchorId,source:i.source,kind:'wording',mode:i.mode,certainty:'clear',meaningPreserved:true,suggestion:reference,reasonZh:'文件是提问的对象时，可以用「ファイルについて」。',detailZh:'保留你要请教同事的意思。'}}});
   if((b.action==='companion_lesson'||b.action==='companion_study_lesson')&&i.task==='prepare')return route.fulfill({json:{ok:true,lesson:{id:i.requestId,subject:i.subject,focus:'ファイルについて',scene:'会议开始前向同事确认',cueZh:'对方前几天更新了文件，你想请教一个问题。',keyword:'について',starter:'先日更新していただいたファイルについて、',exampleJa:reference,signature:'f'.repeat(64)}}});
   if((b.action==='companion_lesson'||b.action==='companion_study_lesson')&&i.task==='assess')return route.fulfill({json:{ok:true,requestId:i.requestId,assessment:{verdict:'communicated',focusUsed:true,feedbackZh:'意思传达清楚。用「について」标明想提问的对象，会更容易理解。这是可选的表达调整，不是否定原意。',suggestionJa:reference}}});
   return route.fulfill({json:{ok:true,topics:[],observations:[]}});
  });
  const count=()=>page.evaluate(()=>window.__voice.events.filter(e=>e.type==='response.create').length);
  const reply=async text=>page.evaluate(text=>{const s=window.__voice,r=s.events.filter(e=>e.type==='response.create').at(-1),id='r'+r.response.metadata.seq,item='a'+id,emit=e=>s.dc.onmessage({data:JSON.stringify(e)});emit({type:'response.created',response:{id,metadata:r.response.metadata}});emit({type:'response.output_item.added',response_id:id,item:{id:item,role:'assistant'}});document.querySelector('audio').onplaying?.();emit({type:'output_audio_buffer.started',response_id:id});emit({type:'response.output_audio_transcript.done',response_id:id,item_id:item,transcript:text});emit({type:'response.done',response:{id,status:'completed',output:[{id:item,role:'assistant',content:[{transcript:text}]}]}});emit({type:'output_audio_buffer.stopped',response_id:id});},text);
  const speak=async(id,text)=>page.evaluate(({id,text})=>{const emit=e=>window.__voice.dc.onmessage({data:JSON.stringify(e)});emit({type:'input_audio_buffer.speech_started',item_id:id});emit({type:'input_audio_buffer.speech_stopped',item_id:id});emit({type:'input_audio_buffer.committed',item_id:id});emit({type:'conversation.item.input_audio_transcription.completed',item_id:id,transcript:text});},{id,text});
  stage=engine+' '+viewport.width+' normal root';await page.goto(base+'/');await page.locator('[data-desktop-release="desktop-20260911-v4"]').waitFor();assert.equal(new URL(page.url()).pathname,'/companion.html');
  assert.equal(await page.evaluate(()=>window.__voice.micRequests),0);assert.equal(await page.evaluate(()=>window.__voice.cues.length),0);
  await page.screenshot({path:`${out}/${engine}-${viewport.width}-home.png`,fullPage:true});
  await page.getByRole('button',{name:'聊一会儿',exact:true}).click();await page.waitForFunction(()=>window.__voice.events.some(e=>e.type==='response.create'));await reply('今日は、何を確認したいですか。');
  await page.getByRole('button',{name:'开启麦克风',exact:true}).click();const n=await count();await speak('learner-original','ファイルは、今、ちょっと質問があります。');await page.waitForFunction(n=>window.__voice.events.filter(e=>e.type==='response.create').length>n,n);await reply('確認中のファイルなんですね。');
  stage=engine+' '+viewport.width+' written note reaches visible UI';
  if(viewport.width>=1100){
   await page.locator('.df-current-note [data-note-for="learner-original"] .kc-note-body').waitFor();assert.equal(await page.locator('[data-note-for="learner-original"]').count(),1);assert.equal(await page.locator('.kc-note-available').count(),0);
   assert.equal(await page.locator('.kc-conversation .kc-written-note').count(),0);
   const talk=await page.locator('.kc-conversation').boundingBox(),rail=await page.locator('.df-teacher').boundingBox(),dock=await page.locator('.kc-chat-bottom').boundingBox();assert.ok(talk&&rail&&dock);assert.ok(talk.x+talk.width<=rail.x);assert.ok(dock.height<210);assert.ok(talk.y+talk.height<=dock.y+1);assert.ok(dock.y+dock.height<=viewport.height+1);
   await page.getByRole('button',{name:'字幕已开',exact:true}).click();await page.locator('.df-current-note .kc-note-body').waitFor();await page.getByRole('button',{name:'打开字幕',exact:true}).click();
  }else{
   const notice=page.getByRole('button',{name:'有新的文字提示 · 查看',exact:true});await notice.waitFor();await notice.click();await page.locator('[data-note-for="learner-original"] .kc-note-body').waitFor();assert.equal(await page.getByRole('button',{name:'对话与历史',exact:true}).getAttribute('aria-pressed'),'true');
  }
  await page.getByRole('button',{name:'关闭麦克风',exact:true}).click();
  await page.screenshot({path:`${out}/${engine}-${viewport.width}-teacher-rail.png`,fullPage:true});
  stage=engine+' '+viewport.width+' persistent native selection menu';
  await page.locator('.kc-line.assistant.latest p[lang=ja]').evaluate(el=>{const node=el.firstChild,r=document.createRange();r.setStart(node,0);r.setEnd(node,2);const s=getSelection();s.removeAllRanges();s.addRange(r);document.dispatchEvent(new Event('selectionchange'));});
  const tools=page.getByRole('toolbar',{name:'选中文字操作'});await tools.waitFor();await tools.getByRole('button',{name:'更多',exact:true}).click();await page.waitForTimeout(650);await tools.getByRole('button',{name:'选整句',exact:true}).waitFor();await tools.getByRole('button',{name:'收起选词工具',exact:true}).click();
  stage=engine+' '+viewport.width+' real sound opt-in';
  await page.getByRole('button',{name:'更多',exact:true}).click();const settings=page.locator('dialog.kc-sheet');await settings.getByRole('button',{name:'学习音效 · 关',exact:true}).click();await settings.getByRole('button',{name:'学习音效 · 开',exact:true}).waitFor();await page.waitForTimeout(500);await settings.getByRole('button',{name:'试听完成音效',exact:true}).click();assert.ok(await page.evaluate(()=>window.__voice.oscillators>0));await settings.getByRole('button',{name:'关闭面板',exact:true}).click();
  stage=engine+' '+viewport.width+' focused feedback';
  const current=viewport.width>=1100?page.locator('.df-current-note'):page.locator('[data-note-for="learner-original"]');await current.getByRole('button',{name:'练一句',exact:true}).click();await page.locator('.teacher-cue').waitFor();await page.getByRole('textbox',{name:'练习回答',exact:true}).fill('ファイルは、今、ちょっと質問があります。');await page.waitForTimeout(500);await page.getByRole('button',{name:'看看这句表达',exact:true}).click();
  await page.locator('.df-feedback').waitFor();assert.ok(await page.locator('.df-phrase-stage mark').count()>0);assert.equal(await page.locator('.df-result-detail').getAttribute('open'),null);
  assert.ok(await page.evaluate(()=>window.__voice.cues.includes('progress')));
  await page.getByRole('button',{name:'看变化',exact:true}).click();await page.locator('.df-comparison del').first().waitFor();await page.getByRole('button',{name:'遮住试说',exact:true}).click();assert.equal(await page.locator('.df-phrase-stage p[lang=ja]').count(),0);await page.getByRole('button',{name:'显示句子',exact:true}).click();
  await page.getByText('看老师的完整说明',{exact:true}).click();assert.ok((await page.locator('.df-result-detail p').innerText()).includes('不是否定原意'));await page.getByText('看老师的完整说明',{exact:true}).click();
  await page.screenshot({path:`${out}/${engine}-${viewport.width}-focused-feedback.png`,fullPage:true});
  stage=engine+' '+viewport.width+' sound must not leak into an open microphone';
  await page.getByRole('button',{name:'开启麦克风',exact:true}).click();await page.getByRole('button',{name:'更多',exact:true}).click();await page.waitForTimeout(500);const cuesBefore=await page.evaluate(()=>window.__voice.cues.length);await settings.getByRole('button',{name:'试听完成音效',exact:true}).click();assert.equal(await page.evaluate(()=>window.__voice.cues.length),cuesBefore);await settings.getByRole('button',{name:'关闭面板',exact:true}).click();await page.getByRole('button',{name:'关闭麦克风',exact:true}).click();
  await page.getByRole('button',{name:'继续聊天，不用做完',exact:true}).click();
  if(viewport.width>=1100){
   stage=engine+' '+viewport.width+' real weather and preference controls';await page.getByRole('button',{name:'风景',exact:true}).click();const weather=page.locator('.df-atmosphere-controls');await weather.getByRole('button',{name:'关闭',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.df-atmosphere').dataset.running==='false');await weather.getByRole('button',{name:'增强',exact:true}).click();await page.waitForFunction(()=>Number(document.querySelector('.df-atmosphere').dataset.renderedFrames)>2);
   await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelector('.df-atmosphere').dataset.running==='false');await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForFunction(()=>document.querySelector('.df-atmosphere').dataset.running==='true');await settings.getByRole('button',{name:'关闭面板',exact:true}).click();
   const peers=await page.evaluate(()=>window.__voice.peers);await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>!document.querySelector('.df-teacher'));await page.setViewportSize(viewport);await page.locator('.df-teacher').waitFor();assert.equal(await page.evaluate(()=>window.__voice.peers),peers);
  }
  stage=engine+' '+viewport.width+' offline-rendered real cue envelope';await page.addScriptTag({path:`${out}/sound-test.js`});
  const audio=await page.evaluate(async()=>{const ctx=new OfflineAudioContext(1,24000,48000);const duration=SoundTest.scheduleLearningCue(ctx,'progress',.35);const b=await ctx.startRendering(),data=b.getChannelData(0);return{duration,peak:Math.max(...data.map(Math.abs)),tail:Math.max(...data.slice(-200).map(Math.abs))};});assert.ok(audio.duration<.4&&audio.peak>.001&&audio.peak<.1&&audio.tail<.00001);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);const mic=await page.getByRole('button',{name:'开启麦克风',exact:true}).boundingBox();assert.ok(mic&&mic.y>=0&&mic.y+mic.height<=viewport.height);
  await page.getByRole('button',{name:'结束聊天',exact:true}).click();assert.equal(await page.evaluate(()=>window.__voice.tracks.every(t=>t.readyState==='ended')),true);assert.deepEqual(errors,[]);
  reports.push({engine,viewport,scope:'REAL_RENDERED_UI_AND_WEBAUDIO_MOCKED_SPEECH_AND_TEACHER_NOT_PHYSICAL_DEVICE',singleTeacherRail:viewport.width>=1100,phoneReveal:viewport.width<1100,nativeSelectionMorePersists:true,focusedReferenceAndExactDiff:true,fullFeedbackAccessible:true,coveredRecall:true,optionalCues:true,micSuppressesCues:true,realAudioEnvelope:audio,weatherAndResponsiveChecks:viewport.width>=1100,normalRootEntry:true,noHorizontalOverflow:true,pageErrors:errors});
  await context.close();await browser.close();browser=null;
 }
}catch(e){reports.push({ok:false,stage,failure:e.stack||String(e)});if(page&&!page.isClosed())await page.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});process.exitCode=1;}finally{await browser?.close();await writeFile(out+'/result.json',JSON.stringify(reports,null,2));console.log('DESKTOP04_ACCEPTANCE',JSON.stringify(reports));}
