import {chromium,webkit} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:4173',out='artifacts/teacher-v2';await mkdir(out,{recursive:true});
const reports=[];let browser,page;
const phrase='五分だけ見るつもりが、一時間も見てしまいました。';
try{
 for(const engine of (process.env.TEACHER_ENGINES||'chromium,webkit').split(','))for(const viewport of [{width:390,height:844},{width:375,height:667},{width:1280,height:900}]){
  const errors=[],requests=[];let prepares=0,failAssessment=true;
  browser=await({chromium,webkit})[engine].launch({headless:true,...(engine==='chromium'?{args:['--autoplay-policy=no-user-gesture-required']}: {})});
  const context=await browser.newContext({viewport,isMobile:viewport.width<600,hasTouch:true,serviceWorkers:'block'});page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   const state=window.__voice={micRequests:0,tracks:[],events:[],dc:null};
   Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{state.micRequests++;const track={enabled:true,muted:false,readyState:'live',stop(){this.readyState='ended';}};state.tracks.push(track);return{getTracks:()=>[track],getAudioTracks:()=>[track]};}}});
   window.RTCPeerConnection=class{connectionState='connected';localDescription=null;addTransceiver(){return{sender:{replaceTrack:async()=>{}}};}createDataChannel(){return state.dc={readyState:'connecting',send:s=>state.events.push(JSON.parse(s)),close(){},onopen:null,onmessage:null};}async createOffer(){return{type:'offer',sdp:'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n'};}async setLocalDescription(s){this.localDescription=s;}async setRemoteDescription(){state.dc.readyState='open';state.dc.onopen?.();}close(){}};
  });
  await page.route('**/api/nhk-speech',async route=>{
   const b=route.request().postDataJSON();requests.push(b);
   if(b.action==='companion_start')return route.fulfill({json:{ok:true,contract:'nihongo-companion-v3',model:'gpt-realtime-2.1',sdp:'v=0',callId:'rtc_teacher_test',expiresAt:Date.now()+1200000,token:'a'.repeat(64)}});
   if(b.action==='companion_feedback'){const i=b.input;return route.fulfill({json:{ok:true,note:{id:i.requestId,anchorId:i.anchorId,source:i.source,kind:i.mode==='help'?'wording':'extension',mode:i.mode,certainty:'clear',meaningPreserved:true,suggestion:phrase,reasonZh:'つもりが：本来打算……，结果却……。原来的回答也能表达意思。',detailZh:'',...(i.mode==='help'?{scaffold:{keyword:'つもり',starter:'五分だけ見るつもりが、'}}:{})}}});}
   if(b.action==='companion_lesson'&&b.input.task==='prepare'){const i=b.input;prepares++;return route.fulfill({json:{ok:true,lesson:{id:i.requestId,subject:i.subject,focus:'〜つもりが',scene:['休息','购物','通勤','电影'][prepares%4],cueZh:'本来想稍微休息，结果睡着了。',keyword:'つもり',starter:'少し休むつもりが、',exampleJa:'少し休むつもりが、寝てしまいました。',signature:'f'.repeat(64)}}});}
   if(b.action==='companion_lesson'&&b.input.task==='assess'){if(failAssessment){failAssessment=false;return route.fulfill({status:503,json:{ok:false,reason:'temporary'}});}return route.fulfill({json:{ok:true,requestId:b.input.requestId,assessment:{verdict:'communicated',focusUsed:true,feedbackZh:'原来的打算与实际结果都表达出来了。',suggestionJa:''}}});}
   if(b.action==='companion_demo')return route.fulfill({status:503,json:{ok:false,reason:'fixture_demo_unavailable'}});
   return route.fulfill({json:{ok:true,observations:[],topics:[]}});
  });
  const count=()=>page.evaluate(()=>window.__voice.events.filter(e=>e.type==='response.create').length);
  const reply=async text=>page.evaluate(text=>{
   const state=window.__voice,r=state.events.filter(e=>e.type==='response.create').at(-1);const id='r'+r.response.metadata.seq,item='a'+id,emit=e=>state.dc.onmessage({data:JSON.stringify(e)}),isText=r.response.output_modalities[0]==='text';
   emit({type:'response.created',response:{id,metadata:r.response.metadata}});emit({type:'response.output_item.added',response_id:id,item:{id:item,role:'assistant'}});
   if(!isText){document.querySelector('audio').onplaying?.();emit({type:'output_audio_buffer.started',response_id:id});}
   emit({type:isText?'response.output_text.done':'response.output_audio_transcript.done',response_id:id,item_id:item,transcript:text,text});
   emit({type:'response.done',response:{id,status:'completed',output:[{id:item,role:'assistant',content:[isText?{text}:{transcript:text}]}]}});if(!isText)emit({type:'output_audio_buffer.stopped',response_id:id});
  },text);
  const speech=async(id,text)=>page.evaluate(({id,text})=>{const emit=e=>window.__voice.dc.onmessage({data:JSON.stringify(e)});emit({type:'input_audio_buffer.speech_started',item_id:id});emit({type:'input_audio_buffer.speech_stopped',item_id:id});emit({type:'input_audio_buffer.committed',item_id:id});emit({type:'conversation.item.input_audio_transcription.completed',item_id:id,transcript:text});},{id,text});
  const store=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('hitokoto-expression-learning-v1')||'null'));
  const endPractice=async()=>{await page.getByRole('button',{name:'继续聊天，不用做完',exact:true}).click();};
  const assess=async text=>{await page.getByRole('textbox',{name:'练习回答',exact:true}).fill(text);await page.getByRole('button',{name:'看看这句表达',exact:true}).click();};
  const review=async()=>{await page.getByRole('button',{name:'更多',exact:true}).click();await page.getByRole('button',{name:'表达本与复习',exact:false}).click();await page.getByRole('button',{name:'换个场景试试',exact:false}).first().click();await page.locator('.teacher-cue').waitFor();};
  await page.goto(base+'/companion.html');await page.locator('[data-teacher-release="teacher-20260911-v2"]').waitFor();assert.equal(await store(),null);
  await page.getByRole('button',{name:'聊一会儿',exact:true}).click();
  if(await page.getByRole('button',{name:'对话与历史',exact:true}).count())await page.getByRole('button',{name:'对话与历史',exact:true}).click();await page.waitForFunction(()=>window.__voice.events.some(e=>e.type==='response.create'));
  assert.equal(await page.evaluate(()=>window.__voice.micRequests),0);
  assert.equal(await page.evaluate(()=>window.__voice.events.filter(e=>e.type==='session.update').at(-1).session.audio.output.speed),1);
  await reply('つい長く見てしまう動画はありますか。');
  // No regenerated response masquerading as original replay.
  let before=await count();await page.getByRole('button',{name:'重播原音',exact:true}).click();assert.equal(await count(),before);assert.ok((await page.locator('.kc-notice').innerText()).includes('原音暂不可重播'));
  await page.getByRole('button',{name:'更多',exact:true}).click();await page.getByRole('button',{name:'从容 · 自然停顿',exact:true}).click();await page.getByRole('button',{name:'自然 · 恢复默认',exact:true}).click();await page.screenshot({path:`${out}/${engine}-${viewport.width}-preferences.png`,fullPage:true});await page.getByRole('button',{name:'关闭面板',exact:true}).click();
  // Captions off must not silently disable the teacher.
  await page.getByRole('button',{name:'字幕已开',exact:true}).click();await page.getByRole('button',{name:'开启麦克风',exact:true}).click();await page.waitForFunction(()=>window.__voice.micRequests===1);
  before=await count();await speech('ordinary','五分だけ見るつもりが、長く見ました。');await page.waitForFunction(n=>window.__voice.events.filter(e=>e.type==='response.create').length>n,before);await reply('つい長く見てしまったんですね。');
  await page.locator('.teacher-captionless-notes .kc-written-note').first().waitFor();assert.equal(await page.getByRole('button',{name:'打开字幕',exact:true}).count(),1);
  // Contextual help starts with a keyword, not an imposed full answer.
  await page.getByRole('button',{name:'接不上',exact:true}).click();await page.waitForTimeout(1300);
  const help=page.locator('.kc-written-note').last();await help.scrollIntoViewIfNeeded();await help.getByRole('button',{name:'完整示范',exact:true}).waitFor();assert.equal((await help.locator('.kc-note-japanese').innerText()).trim(),'つもり');await help.getByRole('button',{name:'给个开头',exact:true}).click();assert.ok((await help.locator('.kc-note-japanese').innerText()).includes('つもりが'));await help.getByRole('button',{name:'完整示范',exact:true}).click();assert.ok((await help.locator('.kc-note-japanese').innerText()).includes('一時間'));
  await help.getByRole('button',{name:'练一句',exact:true}).click();await page.locator('.teacher-cue').waitFor();assert.equal(await page.getByRole('textbox',{name:'练习回答',exact:true}).inputValue(),'');
  before=await count();await speech('practice-audio','少し休むつもりが、眠ってしまいました。');await page.waitForTimeout(1100);assert.equal(await count(),before);assert.equal(requests.filter(b=>b.action==='companion_lesson'&&b.input.task==='assess').length,0);
  await page.getByRole('button',{name:'给个词',exact:true}).click();await page.getByRole('button',{name:'确认这句，给我反馈',exact:true}).click();await page.waitForSelector('.teacher-error');await page.getByRole('button',{name:'确认这句，给我反馈',exact:true}).click();await page.locator('.teacher-result').waitFor();
  const attempts=requests.filter(b=>b.action==='companion_lesson'&&b.input.task==='assess');assert.equal(attempts.length,2);assert.equal(attempts[0].input.requestId,attempts[1].input.requestId);assert.equal(attempts[1].input.source,'confirmed_speech');assert.equal(await store(),null);
  await page.getByRole('button',{name:'收藏这个表达',exact:true}).click();await page.getByRole('button',{name:'开启本机保存',exact:true}).click();await page.getByRole('dialog').waitFor();assert.equal((await store()).items[0].evidence.at(-1).kind,'supported');await page.getByRole('button',{name:'关闭面板',exact:true}).click();await endPractice();
  // A fresh scene with no visible answer can produce independent evidence, then transfer.
  await review();await assess('少し休むつもりが、眠ってしまいました。');await page.locator('.teacher-result').waitFor();assert.equal((await store()).items[0].evidence.at(-1).kind,'independent');await endPractice();
  await review();await assess('ちょっと休むつもりが、寝てしまいました。');await page.locator('.teacher-result').waitFor();assert.equal((await store()).items[0].evidence.at(-1).kind,'transfer');await page.screenshot({path:`${out}/${engine}-${viewport.width}-practice.png`,fullPage:true});await endPractice();
  await page.getByRole('button',{name:'结束聊天',exact:true}).click();await page.locator('.session-takeaway').waitFor();assert.ok((await page.locator('.session-takeaway').innerText()).includes('换场景用过'));await page.screenshot({path:`${out}/${engine}-${viewport.width}-takeaway.png`,fullPage:true});
  const saved=await store();await page.reload();await page.locator('[data-teacher-release]').waitFor();assert.deepEqual(await store(),saved);await page.locator('.teacher-home-entry').click();await page.screenshot({path:`${out}/${engine}-${viewport.width}-library.png`,fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
  reports.push({engine,viewport,scope:'REAL_UI_MOCKED_NATIVE_AUDIO_AND_TEACHER_API',defaultSpeed:1,startsMuted:true,captionlessTeaching:true,layeredHelp:true,noAutomaticAssessmentOfAsr:true,sameIdOnRetry:true,optInPersistence:true,supportedIndependentTransfer:true,summaryAndReload:true,originalReplayNotRegenerated:true,errors});
  await context.close();await browser.close();browser=null;
 }
 console.log(JSON.stringify(reports,null,2));
}catch(e){if(page&&!page.isClosed()){await page.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});await writeFile(out+'/failure.html',await page.content().catch(()=>''));}await writeFile(out+'/failure.txt',String(e.stack||e));throw e;}
finally{await browser?.close();await writeFile(out+'/result.json',JSON.stringify(reports,null,2));}
