import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
const base=process.env.DESKTOP04_BASE||'http://127.0.0.1:4173';
const out=process.env.DESKTOP04_OUT||'artifacts/desktop04-browser';await mkdir(out,{recursive:true});
const report={ok:false,base,scope:'REAL_UI_AND_CANVAS_MOCKED_VOICE_AND_TEACHER_NOT_PHYSICAL_MICROPHONE',cases:[],errors:[],stage:'start'};
let browser;
try{
 for(const engine of ['chromium','webkit'])for(const viewport of [{width:390,height:844},{width:1280,height:900},{width:1920,height:1080}]){
  const desktop=viewport.width>=1100;report.stage=`${engine}-${viewport.width}: setup`;
  browser=await ({chromium,webkit})[engine].launch({headless:true});
  const context=await browser.newContext({viewport,isMobile:!desktop,hasTouch:!desktop,reducedMotion:'no-preference'});
  const page=await context.newPage();page.setDefaultTimeout(20000);const calls=[];let failOnce=true;
  page.on('pageerror',e=>report.errors.push({engine,width:viewport.width,error:e.message}));
  await page.addInitScript(()=>{
   const state=window.__desktop04={events:[],peers:0,micRequests:0,tracks:[],dc:null};
   Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{state.micRequests++;const track={enabled:true,muted:false,readyState:'live',stop(){this.readyState='ended';}};state.tracks.push(track);return{getTracks:()=>[track],getAudioTracks:()=>[track]};}}});
   window.RTCPeerConnection=class{
    connectionState='connected';localDescription=null;constructor(){state.peers++;}
    addTransceiver(){return{sender:{replaceTrack:async()=>{}}};}
    createDataChannel(){return state.dc={readyState:'connecting',send:s=>state.events.push(JSON.parse(s)),close(){},onopen:null,onmessage:null};}
    async createOffer(){return{type:'offer',sdp:'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n'};}
    async setLocalDescription(d){this.localDescription=d;}
    async setRemoteDescription(){state.dc.readyState='open';state.dc.onopen?.();}close(){}
   };
  });
  await page.route('**/api/nhk-speech',async route=>{
   const b=route.request().postDataJSON();calls.push(b);
   if(b.action==='companion_start')return route.fulfill({json:{ok:true,contract:'nihongo-companion-v3',model:'gpt-realtime-2.1',sdp:'v=0',callId:'rtc_desktop04_fixture',expiresAt:Date.now()+1200000,token:'a'.repeat(64)}});
   if(b.action==='companion_feedback'){
    const i=b.input;
    if(i.anchorId==='error-user'&&failOnce){failOnce=false;return route.fulfill({status:503,json:{ok:false,reason:'service_unavailable'}});}
    return route.fulfill({json:{ok:true,note:{id:i.requestId,anchorId:i.anchorId,source:i.source,mode:i.mode,kind:'grammar',certainty:'clear',meaningPreserved:true,suggestion:'昨日、長い時間ゲームをしました。',reasonZh:'说昨天发生的事情，可以用过去式「しました」。',detailZh:'本轮只练这一处：する → しました。'}}});
   }
   if(b.action==='companion_topics')return route.fulfill({json:{ok:true,topics:[]}});
   return route.fulfill({json:{ok:true,observations:[]}});
  });
  const responses=()=>page.evaluate(()=>window.__desktop04.events.filter(e=>e.type==='response.create').length);
  const reply=async text=>page.evaluate(text=>{
   const state=window.__desktop04,req=state.events.filter(e=>e.type==='response.create').at(-1),id='response_'+req.response.metadata.seq,item='assistant_'+id;
   const emit=e=>state.dc.onmessage({data:JSON.stringify(e)});
   emit({type:'response.created',response:{id,metadata:req.response.metadata}});
   emit({type:'response.output_item.added',response_id:id,item:{id:item,role:'assistant',type:'message'}});
   document.querySelector('audio').onplaying?.(new Event('playing'));
   emit({type:'output_audio_buffer.started',response_id:id});
   emit({type:'response.output_audio_transcript.done',response_id:id,item_id:item,transcript:text});
   emit({type:'response.done',response:{id,status:'completed',output:[{id:item,role:'assistant',content:[{transcript:text}]}]}});
   emit({type:'output_audio_buffer.stopped',response_id:id});
  },text);
  const turn=async(id,text)=>{
   const before=await responses();
   await page.evaluate(({id,text})=>{const emit=e=>window.__desktop04.dc.onmessage({data:JSON.stringify(e)});emit({type:'input_audio_buffer.speech_started',item_id:id});emit({type:'input_audio_buffer.speech_stopped',item_id:id});emit({type:'input_audio_buffer.committed',item_id:id});emit({type:'conversation.item.input_audio_transcription.completed',item_id:id,transcript:text});},{id,text});
   await page.waitForFunction(n=>window.__desktop04.events.filter(e=>e.type==='response.create').length>n,before);
   await reply('ゲームをしていたんですね。');
  };
  await page.goto(base+'/');await page.locator('[data-desktop-release="desktop-20260911-v4"]').waitFor();
  assert.equal(new URL(page.url()).pathname,'/companion.html');
  assert.equal(await page.evaluate(()=>window.__desktop04.micRequests),0);
  await page.getByRole('button',{name:'聊一会儿',exact:true}).click();
  await page.waitForFunction(()=>window.__desktop04.events.some(e=>e.type==='response.create'));
  await reply('昨日は、何をしましたか。');
  await page.getByRole('button',{name:'开启麦克风',exact:true}).click();
  await page.waitForFunction(()=>window.__desktop04.micRequests===1);
  report.stage=`${engine}-${viewport.width}: note from scenery`;
  assert.equal(await page.locator('.imm-scenery-now').count(),1);
  await turn('user1','昨日、長い時間ゲームをする。');
  if(desktop){
   await page.locator('.df-current-note [data-note-for="user1"] .kc-note-japanese').waitFor();
   assert.equal(await page.locator('.kc-note-available').count(),0);
   assert.equal(await page.locator('.imm-scenery-now').count(),1);
   assert.equal(await page.locator('[data-note-for="user1"]').count(),1);
   const rail=await page.locator('.df-teacher').boundingBox(),stage=await page.locator('.kc-conversation').boundingBox();
   assert.ok(rail.x>=stage.x+stage.width,JSON.stringify({rail,stage}));
   assert.ok(rail.height>viewport.height*.7);
   await page.getByRole('button',{name:'隐藏字幕',exact:true}).click();
   assert.equal(await page.locator('.df-current-note .kc-note-japanese').isVisible(),true,'Subtitles and teacher rail are independent');
   await page.getByRole('button',{name:'显示字幕',exact:true}).click();
   const before=await responses();await page.getByRole('button',{name:'对话与历史',exact:true}).click();
   assert.equal(await page.locator('[data-note-for="user1"]').count(),1);
   await page.getByRole('button',{name:'风景陪练',exact:true}).click();assert.equal(await responses(),before);
   // The word-selection toolbar must not hide its More menu 220ms after pointerup.
   const phrase=page.locator('.df-current-note .kc-note-japanese');
   await phrase.evaluate(el=>{const r=document.createRange();r.selectNodeContents(el);const s=window.getSelection();s.removeAllRanges();s.addRange(r);document.dispatchEvent(new Event('selectionchange'));});
   const toolbar=page.getByRole('toolbar',{name:'选中文字操作'});await toolbar.waitFor();
   await toolbar.getByRole('button',{name:'更多',exact:true}).click();await page.waitForTimeout(600);
   assert.equal(await toolbar.getByRole('button',{name:'选整句',exact:true}).isVisible(),true);
   await toolbar.getByRole('button',{name:'收起选词工具',exact:true}).click();
  }else{
   const banner=page.getByRole('button',{name:'有新的文字提示 · 查看',exact:true});await banner.waitFor();await banner.click();
   await page.locator('.kc-conversation [data-note-for="user1"] .kc-note-japanese').waitFor();
   assert.equal(await page.locator('.imm-scenery-now').count(),0,'Phone must reveal real history, not scroll an absent card');
  }
  for(let i=2;i<=3;i++){
   await turn('user'+i,'昨日、長い時間ゲームをする。');
   await page.locator(`${desktop?'.df-current-note':'.kc-conversation'} [data-note-for="user${i}"] .kc-note-japanese`).waitFor();
  }
  report.stage=`${engine}-${viewport.width}: error and retry`;
  await turn('error-user','昨日、長い時間ゲームをする。');
  const retry=page.getByRole('button',{name:'重试文字提示',exact:true});await retry.waitFor();const beforeRetry=await responses();
  await retry.click();await page.locator(`${desktop?'.df-current-note':'.kc-conversation'} [data-note-for="error-user"] .kc-note-japanese`).waitFor();
  assert.equal(await responses(),beforeRetry,'Retry is text-only');
  if(desktop){
   report.stage=`${engine}-${viewport.width}: actual weather frames`;
   await page.waitForFunction(()=>document.querySelector('.df-atmosphere')?.dataset.active==='true');
   const first=await page.locator('.df-atmosphere').evaluate(c=>({frames:Number(c.dataset.renderedFrames),pixels:c.toDataURL()}));
   await page.waitForTimeout(1000);
   const second=await page.locator('.df-atmosphere').evaluate(c=>({frames:Number(c.dataset.renderedFrames),pixels:c.toDataURL()}));
   assert.ok(second.frames>first.frames);assert.notEqual(second.pixels,first.pixels);
   assert.equal(await page.locator('.df-atmosphere').evaluate(c=>getComputedStyle(c).pointerEvents),'none');
   await page.getByRole('button',{name:'风景',exact:true}).click();
   await page.locator('.df-atmosphere-controls').getByRole('button',{name:'关闭',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('.df-atmosphere')?.dataset.active==='false');
   const stopped=await page.locator('.df-atmosphere').getAttribute('data-rendered-frames');await page.waitForTimeout(200);
   assert.equal(await page.locator('.df-atmosphere').getAttribute('data-rendered-frames'),stopped);
   await page.locator('.df-atmosphere-controls').getByRole('button',{name:'增强',exact:true}).click();
   await page.getByRole('button',{name:'关闭',exact:true}).filter({hasNot:page.locator('.df-atmosphere-controls')}).last().click().catch(async()=>{await page.locator('dialog[open] .kc-close').click();});
   await page.waitForFunction(()=>document.querySelector('.df-atmosphere')?.dataset.active==='true');
   await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelector('.df-atmosphere')?.dataset.active==='false');
   await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForFunction(()=>document.querySelector('.df-atmosphere')?.dataset.active==='true');
  }
  const geometry=await page.evaluate(()=>{const mic=document.querySelector('.kc-mic')?.getBoundingClientRect(),root=document.documentElement;return{width:innerWidth,height:innerHeight,overflow:root.scrollWidth-innerWidth,mic:mic?{x:mic.x,y:mic.y,width:mic.width,height:mic.height}:null};});
  assert.ok(geometry.overflow<=1,JSON.stringify(geometry));assert.ok(geometry.mic.y>=0&&geometry.mic.y+geometry.mic.height<=viewport.height,JSON.stringify(geometry));
  assert.equal(await page.evaluate(()=>window.__desktop04.peers),1);assert.equal(await page.evaluate(()=>window.__desktop04.micRequests),1);
  await page.screenshot({path:`${out}/${engine}-${viewport.width}-teacher-scenery.png`,fullPage:true});
  await page.screenshot({path:`${out}/${engine}-${viewport.width}-review.jpg`,type:'jpeg',quality:40,fullPage:true});
  // Mid-call responsive transitions must relocate notes without duplicating them or reconnecting.
  if(desktop&&viewport.width===1280){
   await page.setViewportSize({width:900,height:800});await page.waitForFunction(()=>document.querySelector('[data-desktop-focus]')?.dataset.desktopFocus==='false');
   assert.equal(await page.locator('.df-teacher').count(),0);assert.equal(await page.evaluate(()=>window.__desktop04.peers),1);
   await page.setViewportSize(viewport);await page.locator('.df-current-note .kc-note-japanese').waitFor();
   assert.equal(await page.locator('[data-note-for="error-user"]').count(),1);
  }
  await page.getByRole('button',{name:'关闭麦克风',exact:true}).click();assert.equal(await page.evaluate(()=>window.__desktop04.tracks.every(t=>t.readyState==='ended')),true);
  await page.getByRole('button',{name:'结束聊天',exact:true}).click();
  report.cases.push({engine,viewport,teacherRail:desktop,notesDelivered:4,noteReachableFromScenery:true,notesNotDuplicated:true,subtitlesIndependent:desktop,moreMenuPersistent:desktop,textRetryNoVoice:true,silentWeatherFrames:desktop,reducedMotionHonored:desktop,micAlwaysVisible:true,onePeer:true,micRequests:1,geometry});
  await context.close();await browser.close();browser=null;
 }
 assert.deepEqual(report.errors,[]);report.ok=true;report.stage='complete';
}catch(e){report.failure=String(e.stack||e);process.exitCode=1;}finally{await browser?.close();await writeFile(out+'/result.json',JSON.stringify(report,null,2));console.log('DESKTOP04_BROWSER',JSON.stringify(report));}
