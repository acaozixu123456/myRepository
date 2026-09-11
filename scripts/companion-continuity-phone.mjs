import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:4173';
const output='artifacts/companion-continuity';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});const reports=[];
try{for(const viewport of [{width:390,height:844},{width:375,height:667}]){
 const context=await browser.newContext({viewport,isMobile:true,hasTouch:true});
 const page=await context.newPage();const errors=[],feedback=[];let failConfirmation=true;
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const state=window.__voice={micRequests:0,tracks:[],peers:0,events:[],dc:null};
  const getUserMedia=async()=>{state.micRequests++;const track={enabled:true,muted:false,readyState:'live',stop(){this.readyState='ended';}};state.tracks.push(track);return{getTracks:()=>[track],getAudioTracks:()=>[track]};};
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia}});
  window.RTCPeerConnection=class{
   connectionState='connected';localDescription=null;constructor(){state.peers++;}
   addTransceiver(){return{sender:{replaceTrack:async()=>{}}};}
   createDataChannel(){return state.dc={readyState:'connecting',send:s=>state.events.push(JSON.parse(s)),close(){},onopen:null,onmessage:null};}
   async createOffer(){return{type:'offer',sdp:'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n'};}
   async setLocalDescription(s){this.localDescription=s;}
   async setRemoteDescription(){state.dc.readyState='open';state.dc.onopen?.();}
   close(){}
  };
 });
 await page.route('**/api/nhk-speech',async route=>{
  const b=route.request().postDataJSON();
  if(b.action==='companion_start')return route.fulfill({json:{ok:true,contract:'nihongo-companion-v3',model:'gpt-realtime-2.1',sdp:'v=0',callId:'rtc_continuity_fixture',expiresAt:Date.now()+1200000,token:'a'.repeat(64)}});
  if(b.action==='companion_feedback'){
   const i=b.input;feedback.push(i);
   if(i.anchorId==='language_yes'&&failConfirmation){failConfirmation=false;return route.fulfill({status:503,json:{ok:false,reason:'service_unavailable'}});}
   if(i.source.includes('えっと'))return route.fulfill({json:{ok:true,note:null}});
   return route.fulfill({json:{ok:true,note:{id:i.requestId,anchorId:i.anchorId,source:i.source,kind:i.mode==='question'?'explanation':'wording',mode:i.mode,certainty:'clear',meaningPreserved:true,suggestion:i.mode==='question'?'このバンドが好きです。':'静かな猫の動画が好きです。',reasonZh:i.mode==='question'?'アーティスト是艺术家或歌手；バンド是乐队。':'可以借用这句，保留你刚才想说的意思。',detailZh:'这是字幕语境下的参考，不是发音评分。'}}});
  }
  if(b.action==='companion_topics')return route.fulfill({json:{ok:true,topics:[]}});
  return route.fulfill({json:{ok:true,observations:[]}});
 });
 const count=()=>page.evaluate(()=>window.__voice.events.filter(e=>e.type==='response.create').length);
 const reply=async text=>page.evaluate(text=>{
  const state=window.__voice,req=state.events.filter(e=>e.type==='response.create').at(-1);
  const id='r_'+req.response.metadata.seq,item='as_'+id,emit=e=>state.dc.onmessage({data:JSON.stringify(e)});
  emit({type:'response.created',response:{id,metadata:req.response.metadata}});
  emit({type:'response.output_item.added',response_id:id,item:{id:item,role:'assistant',type:'message'}});
  document.querySelector('audio').onplaying?.(new Event('playing'));
  emit({type:'output_audio_buffer.started',response_id:id});
  emit({type:'response.output_audio_transcript.done',response_id:id,item_id:item,transcript:text});
  emit({type:'response.done',response:{id,status:'completed',output:[{id:item,role:'assistant',content:[{transcript:text}]}]}});
  emit({type:'output_audio_buffer.stopped',response_id:id});
 },text);
 const utter=async(id,text,asr=true)=>page.evaluate(({id,text,asr})=>{
  const emit=e=>window.__voice.dc.onmessage({data:JSON.stringify(e)});
  emit({type:'input_audio_buffer.speech_started',item_id:id});
  emit({type:'input_audio_buffer.speech_stopped',item_id:id});
  emit({type:'input_audio_buffer.committed',item_id:id});
  if(asr)emit({type:'conversation.item.input_audio_transcription.completed',item_id:id,transcript:text});
 },{id,text,asr});
 const nextReply=async(previous,text)=>{
  await page.waitForFunction(n=>window.__voice.events.filter(e=>e.type==='response.create').length>n,previous);
  await reply(text);
 };
 const reveal=async id=>{
  const card=page.locator(`[data-note-for="${id}"]`);await card.waitFor();
  const available=page.getByRole('button',{name:'有新的文字提示 · 查看',exact:true});
  if(await available.count())await available.click();
  await card.scrollIntoViewIfNeeded();return card;
 };
 await page.goto(base+'/companion.html');
 await page.getByRole('button',{name:'聊一会儿'}).click();
 await page.waitForFunction(()=>window.__voice.events.some(e=>e.type==='response.create'));
 assert.equal(await page.locator('[data-release="repair-20260911"]').count(),1);
 assert.equal(await page.evaluate(()=>window.__voice.micRequests),0);
 await reply('寝る前は、どんな動画を見ますか。');
 await page.getByRole('button',{name:'开启麦克风',exact:true}).click();
 await page.waitForFunction(()=>window.__voice.micRequests===1);
 // A continuation within the new grace window cancels the earlier schedule, not the entire session.
 let before=await count();
 await utter('fragment','はい、えっと、そのまま、えっと');
 await page.waitForTimeout(450);assert.equal(await count(),before);
 await utter('continuation','静かな感じが好きです。',false);
 await nextReply(before,'静かな感じが好きなんですね。');
 assert.equal(await count(),before+1);
 const native=await page.evaluate(()=>window.__voice.events.filter(e=>e.type==='response.create').at(-1).response);
 assert.equal(native.input,undefined);assert.equal(native.conversation,undefined);
 await page.evaluate(()=>window.__voice.dc.onmessage({data:JSON.stringify({type:'conversation.item.input_audio_transcription.completed',item_id:'continuation',transcript:'静かな感じが好きです。'})}));
 await reveal('continuation');
 const anchors=[];
 for(let i=1;i<=5;i++){
  const previous=page.locator('.kc-written-note').last();
  const heading=previous.locator('.kc-note-heading');
  if(await heading.getAttribute('aria-expanded')==='false')await heading.click();
  await previous.locator('.kc-note-body').dispatchEvent('pointerdown');
  await previous.locator('.kc-note-body').dispatchEvent(i%2?'pointercancel':'pointerup');
  await previous.locator('.kc-note-detail > summary').click();
  before=await count();await utter('round_'+i,'猫動画好き。');
  await nextReply(before,'猫の動画なんですね。');
  const card=await reveal('round_'+i);anchors.push(await card.getAttribute('data-note-for'));
  assert.equal(await card.locator('.kc-note-heading').getAttribute('aria-expanded'),'true');
 }
 assert.equal(new Set(anchors).size,5);
 // Reproduce the screenshot with a confirmed meaning question, including a real UI error/retry.
 before=await count();await utter('language_question','アーティストの意味が分かりません。');
 await nextReply(before,'「アーティストやバンド」の意味を知りたいということですか？');
 before=await count();await utter('language_yes','はい。');
 await nextReply(before,'「アーティスト」の意味ですね。');
 await page.getByRole('button',{name:'重试文字提示',exact:true}).waitFor();
 assert.equal(feedback.filter(i=>i.anchorId==='language_yes').at(-1).mode,'question');
 const beforeRetry=await count();
 await page.getByRole('button',{name:'重试文字提示',exact:true}).click();
 const answer=await reveal('language_yes');
 assert.ok((await answer.innerText()).includes('バンド是乐队'));
 assert.equal(await count(),beforeRetry);
 assert.equal(feedback.filter(i=>i.anchorId==='language_yes').length,2);
 assert.equal(await page.getByRole('button',{name:'重试文字提示',exact:true}).count(),0);
 await page.screenshot({path:`${output}/multi-turn-${viewport.width}.png`,fullPage:true});
 // A new topic must not regenerate an old learner note out of the retained transcript history.
 const feedbackBeforeTopic=feedback.length;
 await page.getByRole('button',{name:'换个话题',exact:true}).click();
 await page.waitForTimeout(500);await reply('今日は、何を食べたいですか。');
 await page.waitForTimeout(1400);
 assert.equal(feedback.length,feedbackBeforeTopic);
 assert.equal(await page.locator('.kc-written-note').count(),0);
 assert.equal(await page.evaluate(()=>window.__voice.peers),1);
 assert.equal(await page.evaluate(()=>window.__voice.micRequests),1);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.getByRole('button',{name:'关闭麦克风',exact:true}).click();
 assert.equal(await page.evaluate(()=>window.__voice.tracks.every(t=>t.readyState==='ended')),true);
 await page.getByRole('button',{name:'结束聊天',exact:true}).click();
 assert.deepEqual(errors,[]);
 reports.push({viewport,scope:'MOCKED_PROVIDER_AND_MEDIA_REAL_UI_NOT_HUMAN_IPHONE',successiveNotes:anchors.length,readingPointerCancel:true,openDetailsDoesNotLock:true,confirmationExplained:true,failedHelpVisibleAndRetryable:true,retryDoesNotCreateVoiceReply:true,continuationCoalesced:true,nativeResponseBeforeAsr:true,oldTopicNotesExcluded:true,startsMuted:true,micTracksStopped:true,pageErrors:errors});
 await context.close();
}console.log(JSON.stringify(reports,null,2));}finally{await writeFile(`${output}/result.json`,JSON.stringify(reports,null,2));await browser.close();}
