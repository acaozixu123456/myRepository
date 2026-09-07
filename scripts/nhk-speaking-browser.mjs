import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:4173';
await mkdir('artifacts/speaking',{recursive:true});
const browser=await chromium.launch({headless:true});
const results=[];
try{
  for(const viewport of [{width:1280,height:1000},{width:390,height:844}]){
    const context=await browser.newContext({viewport});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      const state=window.__voice={calls:0,stops:0,requests:[],events:[],tracks:[],dc:null};
      const getUserMedia=async()=>{state.calls++;const track={enabled:true,stop(){state.stops++;}};state.tracks.push(track);return{getTracks:()=>[track],getAudioTracks:()=>[track]};};
      Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia}});
      window.RTCPeerConnection=class{
        connectionState='connected';localDescription=null;onconnectionstatechange=null;ontrack=null;
        addTrack(){}createDataChannel(){const dc={readyState:'connecting',onmessage:null,onopen:null,onclose:null,onerror:null,send(s){state.events.push(JSON.parse(s));},close(){this.readyState='closed';}};state.dc=dc;return dc;}
        async createOffer(){return{type:'offer',sdp:'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n'};}async setLocalDescription(v){this.localDescription=v;}async setRemoteDescription(){state.dc.readyState='open';state.dc.onopen?.();}close(){}
      };
    });
    await page.route('**/api/**',async route=>{
      const body=route.request().postDataJSON();
      if(body?.action==='speaking_start'){await page.evaluate(v=>window.__voice.requests.push(v),body);return route.fulfill({json:{ok:true,model:'gpt-realtime-2.1',contractVersion:'nhk-speaking-v1',sdp:'v=0',callId:'rtc_browser_test',expiresAt:Date.now()+110000,stopToken:'a'.repeat(64)}});}
      if(body?.action==='speaking_stop')return route.fulfill({json:{ok:true}});
      return route.fulfill({status:503,json:{ok:false,reason:'qa_mock_no_external_calls'}});
    });
    await page.goto(base);await page.evaluate(async()=>{
      const {createNhkArticleRecord,saveNhkArticleRecords}=await import('/src/nhkLibrary.ts');
      const {buildFallbackCoach}=await import('/src/nhkCoach.ts');
      const sentences=['政府は子どもを守るために、この制度を変えたいと考えています。'];
      const coach=buildFallbackCoach('子どもを守るための新しい制度',sentences);
      coach.recommendations[0].chunks=['政府は','子どもを守るために','この制度を変えたいと考えています。'];
      coach.recommendations[0].vocabularyPoints=[{id:'test-word',word:'子ども',reading:'こども',meaningZh:'孩子',partOfSpeech:'名詞',nuanceZh:'',examples:[]}];
      saveNhkArticleRecords([createNhkArticleRecord({sourceUrl:'https://www.mojidict.com/article/qa-speaking-only',title:'子どもを守るための新しい制度',sentences,selectedSentences:sentences,coach,dateKey:'2026-09-07'})]);
    });await page.reload();
    await page.getByRole('button',{name:/我的文章/}).click();await page.locator('.nhk-article-list button').first().click();
    await page.getByRole('button',{name:'陪我说一句',exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>window.__voice.calls),0);
    const savedBefore=await page.evaluate(()=>localStorage.getItem('nihongo-nhk-article-library-v1'));
    await page.screenshot({path:`artifacts/speaking/entry-${viewport.width}.png`,fullPage:true});
    await page.getByRole('button',{name:'陪我说一句',exact:true}).click();await page.waitForFunction(()=>window.__voice.events.some(e=>e.type==='response.create'));
    assert.equal(await page.evaluate(()=>window.__voice.calls),1);
    const request=await page.evaluate(()=>window.__voice.requests[0]);assert.equal(request.consent,'realtime-audio-v1');assert.equal(request.plan.title,'子どもを守るための新しい制度');assert.equal(request.plan.steps[0].targetJa,'子ども');
    const reply=async(id)=>page.evaluate(id=>{const emit=e=>window.__voice.dc.onmessage({data:JSON.stringify(e)});emit({type:'response.created',response:{id}});emit({type:'output_audio_buffer.started',response_id:id});emit({type:'response.done',response:{id,status:'completed'}});emit({type:'output_audio_buffer.stopped',response_id:id});},id);
    const speak=async(id,text)=>page.evaluate(({id,text})=>{const emit=e=>window.__voice.dc.onmessage({data:JSON.stringify(e)});emit({type:'input_audio_buffer.speech_started'});emit({type:'input_audio_buffer.speech_stopped'});emit({type:'conversation.item.input_audio_transcription.completed',item_id:id,transcript:text});},{id,text});
    await reply('r1');await page.getByRole('button',{name:'帮我接',exact:true}).click();await reply('help');assert.equal(await page.locator('.nhk-speaking-step>strong').textContent(),'子ども');
    await page.screenshot({path:`artifacts/speaking/coach-${viewport.width}.png`,fullPage:true});
    await speak('a','子ども');await reply('r2');await speak('b','子どもを守るために');await reply('r3');await speak('c','まだよく分かりません');await reply('r4');
    await page.getByText('你已经开口了。',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.__voice.stops),1);
    assert.equal(await page.evaluate(()=>localStorage.getItem('nihongo-nhk-article-library-v1')),savedBefore);
    await page.getByRole('button',{name:'回到这篇新闻',exact:true}).click();await page.getByRole('button',{name:'陪我说一句',exact:true}).click();await page.waitForFunction(()=>window.__voice.calls===2);await page.getByRole('button',{name:'结束并关闭陪练',exact:true}).click();assert.equal(await page.evaluate(()=>window.__voice.stops),2);
    assert.deepEqual(errors,[]);results.push({viewport,ok:true,media:'MOCK',provider:'MOCK',sourceArticlePreserved:true,threeTurnsClose:true,dismissCloses:true});await context.close();
  }
  await writeFile('artifacts/speaking/browser.json',JSON.stringify(results,null,2));console.log(JSON.stringify({scope:'MOCKED_UI_AND_MEDIA_LIFECYCLE_ONLY',results},null,2));
}finally{await browser.close();}
