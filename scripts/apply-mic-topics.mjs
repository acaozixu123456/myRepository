import {readFileSync,writeFileSync} from 'node:fs';
function edit(path,fn){let s=readFileSync(path,'utf8');const once=(a,b)=>{if(s.split(a).length!==2)throw new Error(`Nonunique anchor ${path}: ${a.slice(0,100)}`);s=s.replace(a,b);};fn(once,()=>s,v=>{s=v;});writeFileSync(path,s);}
if(!readFileSync('src/nhkChatConnection.ts','utf8').includes('setMicEnabled('))edit('src/nhkChatConnection.ts',(once,get,set)=>{
 once("import {TeacherTurnChannel", "import {AudioActivityMeter,type VoiceActivity} from './nhkAudioActivity';\nimport {TeacherTurnChannel");
 once('pace?:(value:number)=>void};','pace?:(value:number)=>void;activity?:(value:VoiceActivity)=>void};');
 once('  private support:TurnSupportChannel;',`  private support:TurnSupportChannel;
  private wantMic=false;private micRequest=0;private acquiringMic=false;private canListen=false;private launched=false;
  private sender:RTCRtpSender|null=null;private audioPlaying=false;private mediaPlaying=false;private inputLevel=0;private outputLevel=0;private meterReady=false;
  private meter:AudioActivityMeter;
  private activity(){this.hooks.activity?.({micOn:this.wantMic,input:!this.wantMic?'off':this.acquiringMic?'requesting':this.stream?.getAudioTracks().some(t=>t.muted)?'device-muted':this.accepting?(this.inputLevel>.025?'receiving':'ready'):'paused',output:this.blocked?'blocked':this.audioPlaying&&this.mediaPlaying?'playing':this.generation||this.teacher.active||this.busyConnecting?'preparing':'idle',inputLevel:this.accepting?this.inputLevel:0,outputLevel:this.audioPlaying&&this.mediaPlaying?this.outputLevel:0,meterReady:this.meterReady});}
  async setMicEnabled(on:boolean){
    if(this.closed||on===this.wantMic)return;this.wantMic=on;const request=++this.micRequest;
    if(!on){
      const commit=this.talking&&!this.waiting;this.mic(false);this.acquiringMic=false;
      this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.meter.detach('input');void this.sender?.replaceTrack(null).catch(()=>{});
      if(commit){this.waiting=true;this.emit({type:'input_audio_buffer.commit'});this.hooks.phase('thinking');}
      else if(!this.waiting){this.committed.clear();this.emit({type:'input_audio_buffer.clear'});}
      this.hooks.hint('麦克风已关闭，对方的声音仍可播放。');this.activity();return;
    }
    this.meter.unlock();this.acquiringMic=true;this.activity();
    try{
      if(!navigator.mediaDevices?.getUserMedia)throw new Error('unsupported');
      const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
      if(this.closed||!this.wantMic||request!==this.micRequest){stream.getTracks().forEach(t=>t.stop());return;}
      stream.getAudioTracks().forEach(t=>{t.enabled=false;t.onended=()=>{if(!this.closed&&this.stream===stream){void this.setMicEnabled(false);this.hooks.hint('麦克风已断开，可以点一下重新开麦。');}};t.onmute=()=>this.activity();t.onunmute=()=>this.activity();});
      this.stream=stream;this.meter.attach('input',stream);await this.sender?.replaceTrack(stream.getAudioTracks()[0]);
      if(this.closed||!this.wantMic||request!==this.micRequest){stream.getTracks().forEach(t=>t.stop());return;}
      this.acquiringMic=false;this.hooks.metric?.('permission_ready');this.mic(this.canListen);this.hooks.hint(this.canListen?'已开麦，说一个词也可以。':'已开麦，等对方说完再接一句。');this.activity();
    }catch(e){if(this.closed||request!==this.micRequest)return;this.wantMic=false;this.acquiringMic=false;this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.meter.detach('input');this.mic(false);this.hooks.hint(e instanceof Error&&/NotAllowed|Permission/u.test(e.name)?'麦克风未获允许，仍然可以听。允许后再点开麦。':'暂时无法打开麦克风，仍然可以听，稍后再试。');this.activity();}
  }
  toggleMic(){return this.setMicEnabled(!this.wantMic);}`);
 once('constructor(private plan:ChatPlan,private hooks:ChatHooks){this.teacher=', 'constructor(private plan:ChatPlan,private hooks:ChatHooks){this.meter=new AudioActivityMeter((input,output,ready)=>{this.inputLevel=input;this.outputLevel=output;this.meterReady=ready;this.activity();});this.teacher=');
 const start=get().slice(get().indexOf('  async start(){'),get().indexOf('  private emit('));
 once(start,`  async start(){if(this.closed||this.launched)return;this.launched=true;this.meter.unlock();this.hooks.phase('connecting');this.activity();try{if(!window.isSecureContext||typeof RTCPeerConnection==='undefined')throw new Error('unsupported');await this.connect({kind:'start',heard:''},false);}catch(e){if(!this.closed)this.fail(e instanceof Error?e.message:'connection_failed');}}
`);
 once("this.accepting=on&&!this.closed&&!this.blocked;this.stream?.getAudioTracks().forEach(t=>{t.enabled=this.accepting;});", "this.accepting=on&&this.wantMic&&!!this.stream&&!this.closed&&!this.blocked;this.stream?.getAudioTracks().forEach(t=>{t.enabled=this.accepting;});this.activity();");
 once('private closePeer(){this.teacher.reset();','private closePeer(){this.canListen=false;this.audioPlaying=false;this.mediaPlaying=false;this.sender=null;this.meter.detach(\'output\');this.teacher.reset();');
 once('if(this.closed||this.busyConnecting||!this.stream)return;','if(this.closed||this.busyConnecting)return;');
 once("audio.style.display='none';document.body.appendChild(audio);", "audio.style.display='none';audio.onplaying=()=>{this.mediaPlaying=true;this.activity();};audio.onwaiting=()=>{this.mediaPlaying=false;this.activity();};audio.onpause=()=>{this.mediaPlaying=false;this.activity();};document.body.appendChild(audio);");
 once("audio.srcObject=e.streams[0]||new MediaStream([e.track]);", "const remote=e.streams[0]||new MediaStream([e.track]);audio.srcObject=remote;this.meter.attach('output',remote);");
 once("this.stream.getTracks().forEach(t=>pc.addTrack(t,this.stream!));const dc=", "this.sender=pc.addTransceiver('audio',{direction:'sendrecv'}).sender;if(this.stream&&this.wantMic)await this.sender.replaceTrack(this.stream.getAudioTracks()[0]);const dc=");
 once('    this.mic(false);this.waiting=false;this.talking=false;clearTimeout(this.idle);clearTimeout(this.voiceLimit);','    this.canListen=false;this.mic(false);this.waiting=false;this.talking=false;clearTimeout(this.idle);clearTimeout(this.voiceLimit);');
 once("this.responses++;this.hooks.phase('thinking');", "this.responses++;this.hooks.phase('thinking');this.activity();");
 once("this.hooks.phase('coach');", "this.hooks.phase('coach');this.activity();");
 once('this.history=[];this.committed.clear();this.mic(false);','this.history=[];this.committed.clear();this.canListen=false;this.audioPlaying=false;this.mic(false);');
 once("this.waiting=false;this.talking=false;this.mic(true);this.hooks.phase('listening');", "this.waiting=false;this.talking=false;this.canListen=true;this.mic(true);this.hooks.phase('listening');this.activity();");
 once("case'output_audio_buffer.started':clearTimeout", "case'output_audio_buffer.started':this.audioPlaying=true;this.activity();clearTimeout");
 once("case'output_audio_buffer.stopped':clearTimeout", "case'output_audio_buffer.stopped':this.audioPlaying=false;this.activity();clearTimeout");
 once('this.closed=true;clearTimeout(this.idle);','this.wantMic=false;this.micRequest++;this.closed=true;clearTimeout(this.idle);');
 once('this.stream=null;this.history=[];}','this.stream=null;this.history=[];this.meter.dispose();this.activity();}');
});
// Shared topic resolution: frontend structural validation plus mandatory backend HMAC verification.
for(const path of ['src/nhkChat.ts','supabase/functions/nihongo-speaking-session/nhkChat.ts'])if(!readFileSync(path,'utf8').includes('readTopicTicket'))edit(path,(once)=>{
 once('export type ChatPlan=SpeakingPlan&{chatMode:true;topicId:string};',`export type ChatPlan=SpeakingPlan&{chatMode:true;topicId:string;generated?:TopicTicket};`);
 once("export const CHAT_CONTRACT=",`import {readTopicTicket,type TopicTicket} from '${path.startsWith('src/')?'./nhkTopicCatalog.ts':'./topicCatalog.ts'}';\nexport const CHAT_CONTRACT=`);
 once('  return list;','  const generated=readTopicTicket((plan as ChatPlan).generated,plan.source);if(generated)list.unshift(generated.topic);\n  return list;');
 once("if(/食|料理|レストラン|弁当|野菜|果物|米|魚/u.test(text))", "if(/食べ|食品|食事|料理|レストラン|弁当|野菜|果物|お米|白米|米飯|魚/u.test(text))");
 once("!chatTopics(base).some(t=>t.id===r.topicId)","!chatTopics({...base,generated:r.generated} as ChatPlan).some(t=>t.id===r.topicId)");
 once('return{...base,chatMode:true,topicId:r.topicId};','const generated=readTopicTicket(r.generated,base.source);return{...base,chatMode:true,topicId:r.topicId,...(generated?{generated}:{})};');
});
writeFileSync('supabase/functions/nihongo-speaking-session/topicCatalog.ts',readFileSync('src/nhkTopicCatalog.ts','utf8'));
if(!readFileSync('supabase/functions/nihongo-speaking-session/index.ts','utf8').includes('generateTopics'))edit('supabase/functions/nihongo-speaking-session/index.ts',(once)=>{
 once("const MODEL=", "import {generateTopics,verifyTopic} from './topics.ts';\nconst MODEL=");
 once("    if(body.action==='stop'){",`    if(body.action==='topics'){
      const plan=validateSpeakingPlan(body.plan);
      if(!plan||!Array.isArray(body.exclude)||body.exclude.length>48||!body.exclude.every((s:unknown)=>typeof s==='string'&&s.length<=80)||!/^[a-f0-9]{48}$/.test(body.clientKey||''))return json({ok:false,reason:'invalid_topic_input'},400);
      const key=await apiKey();if(!key)return json({ok:false,reason:'missing_openai_key'},503);
      const result=await generateTopics(plan,body.exclude,body.clientKey,key,serviceKey(),quota);return json(result,result.ok?200:503);
    }
    if(body.action==='stop'){`);
 once('    const chat=body.plan?.chatMode===true?validateChatPlan(body.plan):null;',`    if(body.plan?.generated&&(!plan||!await verifyTopic(plan,body.plan.generated,serviceKey())))return json({ok:false,reason:'invalid_topic_signature'},400);
    const chat=body.plan?.chatMode===true?validateChatPlan(body.plan):null;`);
 once('topicShuffleReconnects:false,individualAccountAuth:false','topicShuffleReconnects:false,topicCatalog:\'nhk-topic-catalog-v1\',topicModel:\'gpt-4.1-mini\',individualAccountAuth:false');
});
if(!readFileSync('server/nhkSpeakingProxy.ts','utf8').includes('speaking_topics'))edit('server/nhkSpeakingProxy.ts',(once)=>{
 once('return {...base,chatMode:true,topicId:record.topicId};',`if(record.generated&&JSON.stringify(record.generated).length>2500)return null;
  return {...base,chatMode:true,topicId:record.topicId,...(record.generated?{generated:record.generated}:{})};`);
 once("    if(action==='speaking_start'){",`    if(action==='speaking_topics'){
      const plan=validateSpeakingPlan(body.plan);
      if(!plan||!Array.isArray(body.exclude)||body.exclude.length>48||!body.exclude.every(s=>typeof s==='string'&&s.length<=80))return res.status(400).json({ok:false,reason:'invalid_topic_input'});
      payload={action:'topics',plan,exclude:body.exclude,clientKey:config.clientKey};
    }else if(action==='speaking_start'){`);
 once("action==='speaking_start'?26000:12000", "['speaking_start','speaking_topics'].includes(action)?26000:12000");
});
if(!readFileSync('api/nhk-speech.ts','utf8').includes("'speaking_topics'"))edit('api/nhk-speech.ts',(once)=>once("'speaking_start', 'speaking_stop', 'speaking_health'","'speaking_start', 'speaking_stop', 'speaking_health', 'speaking_topics'"));
if(!readFileSync('src/NhkSpeakingCoach.tsx','utf8').includes('TopicDeck'))edit('src/NhkSpeakingCoach.tsx',(once)=>{
 once("import './nhkGentleTeacher.css';", "import './nhkGentleTeacher.css';\nimport {TopicDeck} from './nhkTopicDeck';\nimport {silentActivity,type VoiceActivity} from './nhkAudioActivity';\nimport NhkVoiceControls from './NhkVoiceControls';");
 once('  const selected=pool.find(t=>t.id===topicId)||pool[0];',`  const deck=useMemo(()=>new TopicDeck(base,pool),[base,pool]);const [,refreshTopics]=useState(0);
  const selected=deck.find(topicId)||pool[0];
  const [activity,setActivity]=useState<VoiceActivity>(silentActivity);
  useEffect(()=>()=>deck.dispose(),[deck]);`);
 once("const plan=(id=selected.id):ChatPlan=>({...base,chatMode:true,topicId:id});", "const plan=(id=selected.id):ChatPlan=>deck.plan(id);");
 once('const next=nextChatTopic(pool,seen.current);seen.current=next.seen;setTopicId(next.topic.id);','const topic=deck.choose(selected.id);const next={topic};setTopicId(topic.id);void deck.replenish(()=>refreshTopics(v=>v+1));');
 once("setOpen(true);setPhase('connecting');", "setOpen(true);setActivity(silentActivity());setPhase('connecting');");
 once('new NhkChatConnection(plan(),{pace:', 'new NhkChatConnection(plan(),{activity:v=>{if(current())setActivity(v);},pace:');
 once("phase==='listening'?'我在听，慢慢说'", "phase==='listening'?(activity.micOn?'慢慢说，一个词也可以':'点麦克风开口，也可以先听听')");
 once('<span>{selected.titleZh}</span>','<span>{selected.titleZh}{selected.id.startsWith(\'gen-\')&&<small className="nhk-topic-generated">新话头</small>}</span>');
 once('<Shuffle size={18}/>换个话题</button></div>', '<Shuffle size={18}/>换个话题</button><small className="nhk-topic-status" role="status">{deck.status||\'换题时按文章补充新话头，不必每次重开聊天\'}</small></div>');
 once('挑话题不需要开麦。点开始即同意将声音实时传给 OpenAI，声音由 AI 生成；App 不保存录音。','换题会按需用 OpenAI 生成一批新话头。进入聊天默认闭麦，点麦克风才授权收音，再点立即关闭；声音由 AI 生成，App 不保存录音。');
 once('<div className={`nhk-speaking-orb ${phase}`} aria-hidden="true">{[\'connecting\',\'renewing\',\'thinking\'].includes(phase)?<LoaderCircle size={26} className="nhk-speaking-spin"/>:running?<Mic size={27}/>:<MicOff size={27}/>}</div>', '<NhkVoiceControls activity={activity} disabled={!connected} toggle={()=>void connection.current?.toggleMic()}/>');
});
console.log('Applied mobile manual microphone, actual audio activity and signed generated topic batches.');
