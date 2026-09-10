import {requestedTurnInstructions} from './requestedTurn';
import {AudioActivityMeter,type VoiceActivity} from '../nhkAudioActivity';
import {COMPANION,CONSENT,TranscriptLedger,companionInstructions,validPolicy,applyObservations,changeChallenge,type Seed,type Policy,type Line} from './model';
import {companionApi,sessionTicket,stopSession,fetchObservations,type Ticket} from './api';
import {NativeTurnGate} from './turns';
import {WrittenLane} from './writtenLane';
import type {WrittenNote} from './writtenFeedback';
export type Phase='connecting'|'ready'|'thinking'|'speaking'|'closed'|'error';
export type Hooks={phase:(p:Phase)=>void;lines:(l:Line[])=>void;activity:(v:VoiceActivity)=>void;notice:(s:string)=>void;error:(s:string)=>void;policy:(p:Policy)=>void;written?:(note:WrittenNote)=>void;writtenPending?:(busy:boolean)=>void};
type Action='opening'|'answer'|'help'|'repeat'|'simpler'|'repair'|'topic';
/** One native audio conversation. No transcript-to-plan-to-SAY reply pipeline. */
export class CompanionConnection {
  private pc:RTCPeerConnection|null=null;private dc:RTCDataChannel|null=null;private sender:RTCRtpSender|null=null;private stream:MediaStream|null=null;private audio:HTMLAudioElement|null=null;
  private ticket:Ticket|null=null;private abort=new AbortController();private observerAbort:AbortController|null=null;
  private gate=new NativeTurnGate();private ledger=new TranscriptLedger();private meter:AudioActivityMeter;
  private ended=false;private launched=false;private linked=false;private wantsMic=false;private micRequest=0;private acquiring=false;private blocked=false;private nativePlaying=false;private bufferPlaying=false;private inputLevel=0;private outputLevel=0;private meterReady=false;
  private responseId='';private responseSeq=0;private activeSeq=0;private currentAssistant='';private playbackEnded=true;private generationEnded=true;private discarded=new Set<string>();private topicEpoch=0;private speakingItem='';
  private queuedAction:Action|null=null;private speed=0.8;private nextPolicy:Policy|null=null;private pendingAssistance:Line['assistance']='none';private userTurns=0;private observedAt=0;private observing=false;
  private replyTimer:ReturnType<typeof setTimeout>|undefined;private deadline:ReturnType<typeof setTimeout>|undefined;private watchdog:ReturnType<typeof setTimeout>|undefined;private idle:ReturnType<typeof setTimeout>|undefined;private heartbeat:ReturnType<typeof setInterval>|undefined;private heartbeatBusy=false;
  private reconnectGrace:ReturnType<typeof setTimeout>|undefined;private written:WrittenLane|null=null;private policyEpoch=0;private noteSeen=new Set<string>();
  constructor(private seed:Seed,private policy:Policy,private hooks:Hooks){this.policy=validPolicy(policy);this.meter=new AudioActivityMeter((input,output,ready)=>{this.inputLevel=input;this.outputLevel=output;this.meterReady=ready;this.publishActivity();});if(hooks.written)this.written=new WrittenLane(async(input,signal)=>{if(this.ended||!this.ticket)throw new Error('session_closed');const r=await companionApi('feedback',{...this.ticket,input},signal);return r.note;},hooks.written,hooks.writtenPending);}
  get lines(){return this.ledger.ordered();}
  private publishActivity(){this.hooks.activity({micOn:this.wantsMic,input:!this.wantsMic?'off':this.acquiring?'requesting':this.stream?.getAudioTracks().some(t=>t.muted)?'device-muted':this.stream?(this.inputLevel>.025?'receiving':'ready'):'paused',output:this.blocked?'blocked':this.bufferPlaying&&this.nativePlaying?'playing':this.gate.active?'preparing':'idle',inputLevel:this.wantsMic&&this.stream?this.inputLevel:0,outputLevel:this.bufferPlaying&&this.nativePlaying?this.outputLevel:0,meterReady:this.meterReady});}
  private emit(event:Record<string,unknown>){if(!this.ended&&this.dc?.readyState==='open')this.dc.send(JSON.stringify(event));}
  private changed(){const lines=this.ledger.ordered();this.hooks.lines(lines);this.written?.update(lines,this.policy.target);}
  writtenHelp(){this.written?.help();}
  setWrittenEnabled(value:boolean){this.written?.setEnabled(value);}
  setReadingNote(value:boolean){this.written?.setReading(value);}
  dismissNote(anchorId:string){this.written?.dismiss(anchorId);}
  exposeNote(id:string){if(this.noteSeen.has(id)||this.ended)return;this.noteSeen.add(id);this.pendingAssistance='hint';this.policyEpoch++;this.nextPolicy=null;this.observerAbort?.abort();}
  async start(){
    if(this.launched||this.ended)return;this.launched=true;this.meter.unlock();this.hooks.phase('connecting');
    try{
      if(!window.isSecureContext||typeof RTCPeerConnection==='undefined')throw new Error('unsupported');
      const pc=this.pc=new RTCPeerConnection();this.sender=pc.addTransceiver('audio',{direction:'sendrecv'}).sender;
      const audio=this.audio=document.createElement('audio');audio.autoplay=true;audio.setAttribute('playsinline','');audio.style.display='none';document.body.appendChild(audio);
      audio.onplaying=()=>{this.nativePlaying=true;this.publishActivity();};audio.onwaiting=()=>{this.nativePlaying=false;this.publishActivity();};audio.onpause=()=>{this.nativePlaying=false;this.publishActivity();};
      pc.ontrack=e=>{if(this.ended)return;const remote=e.streams[0]||new MediaStream([e.track]);audio.srcObject=remote;this.meter.attach('output',remote);void audio.play().catch(()=>{if(!this.ended){this.blocked=true;this.hooks.notice('点一下对话上方的播放键，就能听见声音。');this.publishActivity();}});};
      pc.onconnectionstatechange=()=>{if(this.ended)return;if(pc.connectionState==='connected'){clearTimeout(this.reconnectGrace);return;}if(pc.connectionState==='disconnected'){clearTimeout(this.reconnectGrace);this.reconnectGrace=setTimeout(()=>{if(!this.ended&&pc.connectionState==='disconnected')this.fail('connection_lost');},6000);return;}if(['failed','closed'].includes(pc.connectionState))this.fail('connection_lost');};
      const dc=this.dc=pc.createDataChannel('oai-events');let negotiated=false;
      const ready=()=>{if(this.ended||this.linked||!negotiated||dc.readyState!=='open')return;this.linked=true;this.hooks.phase('ready');this.action('opening');};
      dc.onopen=ready;dc.onmessage=e=>{if(this.ended)return;try{this.event(JSON.parse(String(e.data)));}catch{this.fail('protocol_error');}};dc.onclose=()=>{if(!this.ended)this.fail('connection_lost');};dc.onerror=()=>this.fail('connection_lost');
      await pc.setLocalDescription(await pc.createOffer());if(this.ended)return;
      const data=await companionApi('start',{consent:CONSENT,clientRequestId:crypto.randomUUID(),seed:this.seed,policy:this.policy,sdp:pc.localDescription?.sdp},this.abort.signal);
      const ticket=sessionTicket(data);if(this.ended){stopSession(ticket);return;}this.ticket=ticket;
      await pc.setRemoteDescription({type:'answer',sdp:data.sdp});if(this.ended)return;negotiated=true;ready();
      this.heartbeat=setInterval(()=>void this.keepAlive(),25000);
      this.deadline=setTimeout(()=>{this.hooks.notice('这一段先到这里，休息一下再接着聊。');this.end();},Math.max(1000,ticket.expiresAt-Date.now()-2000));
    }catch(e){if(!this.ended)this.fail(e instanceof Error?`${e.name}:${e.message}`:'connection_error');}
  }
  private async keepAlive(){if(this.ended||!this.ticket||this.heartbeatBusy)return;this.heartbeatBusy=true;try{await companionApi('heartbeat',{...this.ticket},this.abort.signal);}catch(e){if(this.ended)return;try{await companionApi('heartbeat',{...this.ticket},this.abort.signal);}catch{if(!this.ended)this.fail(e instanceof Error?e.message:'heartbeat_failed');}}finally{this.heartbeatBusy=false;}}
  async setMic(on:boolean){
    if(this.ended||!this.linked||on===this.wantsMic)return;this.wantsMic=on;const request=++this.micRequest;
    if(!on){const unfinished=this.gate.speaking;this.gate.speaking=false;this.written?.setSpeaking(false);this.acquiring=false;this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.meter.detach('input');void this.sender?.replaceTrack(null).catch(()=>{});if(unfinished)this.emit({type:'input_audio_buffer.commit'});this.publishActivity();return;}
    this.meter.unlock();this.acquiring=true;this.publishActivity();
    try{const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});if(this.ended||!this.wantsMic||request!==this.micRequest){stream.getTracks().forEach(t=>t.stop());return;}
      this.stream=stream;stream.getAudioTracks().forEach(t=>{t.enabled=true;t.onended=()=>{if(this.stream===stream&&!this.ended){void this.setMic(false);this.hooks.notice('麦克风断开了，点一下可以重新开麦。');}};t.onmute=()=>this.publishActivity();t.onunmute=()=>this.publishActivity();});
      this.meter.attach('input',stream);await this.sender?.replaceTrack(stream.getAudioTracks()[0]);if(this.ended||!this.wantsMic||request!==this.micRequest){stream.getTracks().forEach(t=>t.stop());return;}this.acquiring=false;this.publishActivity();this.hooks.notice('');this.armIdle();
    }catch(e){if(this.ended||request!==this.micRequest)return;this.wantsMic=false;this.acquiring=false;this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.meter.detach('input');this.publishActivity();this.hooks.notice(e instanceof Error&&e.name==='NotAllowedError'?'请在浏览器里允许麦克风。现在仍可以听，也可以用文字聊。':'暂时无法打开麦克风，仍可以听。');}
  }
  toggleMic(){return this.setMic(!this.wantsMic);}
  async unlock(){if(this.ended||!this.audio)return;try{this.meter.unlock();await this.audio.play();this.blocked=false;this.publishActivity();this.action('repeat');}catch{this.hooks.notice('浏览器还没有允许声音，请再点一下播放。');}}
  private interrupt(){
    clearTimeout(this.replyTimer);clearTimeout(this.watchdog);
    this.activeSeq=-1;
    if(this.currentAssistant&&(!this.playbackEnded||!this.generationEnded)){this.ledger.upsert(this.currentAssistant,'assistant',{interrupted:true,delivered:false});this.changed();}
    if(this.gate.active&&this.responseId){this.discarded.add(this.responseId);this.emit({type:'response.cancel',response_id:this.responseId});}
    // For WebRTC this also synchronizes/truncates the unplayed part in the native conversation.
    if(this.bufferPlaying||this.gate.active)this.emit({type:'output_audio_buffer.clear'});
    this.bufferPlaying=false;this.playbackEnded=true;this.generationEnded=true;this.gate.finish();this.currentAssistant='';this.publishActivity();
  }
  action(action:Action){if(this.ended||!this.linked)return;if(action==='help'){this.writtenHelp();return;}this.interrupt();this.queuedAction=action;this.flushSoon();}
  sendText(value:string){const text=value.trim().slice(0,700);if(!text||this.ended||!this.linked)return;this.interrupt();this.queuedAction=null;const id=`typed_${crypto.randomUUID().replace(/-/g,'').slice(0,24)}`;this.ledger.upsert(id,'user',{text,assistance:this.pendingAssistance});this.pendingAssistance='none';this.emit({type:'conversation.item.create',item:{id,type:'message',role:'user',content:[{type:'input_text',text}]}});this.gate.commit(id);this.userTurns++;this.changed();this.flushSoon();}
  setTopic(seed:Seed){if(this.ended)return;this.seed=seed;this.topicEpoch++;this.written?.reset();this.observerAbort?.abort();this.nextPolicy=null;this.interrupt();this.gate.clear();this.action('topic');}
  setPace(value:number){this.speed=Math.max(.65,Math.min(1.05,value));if(!this.gate.active)this.configure();}
  changeDifficulty(delta:number){this.policyEpoch++;this.nextPolicy=null;this.observerAbort?.abort();this.policy=changeChallenge(this.policy,delta);this.hooks.policy(this.policy);if(!this.gate.active)this.configure();}
  private configure(){this.emit({type:'session.update',session:{type:'realtime',instructions:companionInstructions(this.seed,this.policy),audio:{output:{speed:this.speed}}}});}
  private flushSoon(){clearTimeout(this.replyTimer);this.replyTimer=setTimeout(()=>this.flush(),400);}
  private flush(){
    if(this.ended||!this.linked||this.gate.speaking||this.gate.active)return;
    const action=this.queuedAction||(this.gate.ready?'answer':null);if(!action)return;this.queuedAction=null;this.gate.consume();clearTimeout(this.idle);
    if(this.nextPolicy){this.policy=this.nextPolicy;this.nextPolicy=null;this.hooks.policy(this.policy);}this.configure();
    const request:Record<string,unknown>={output_modalities:['audio'],metadata:{purpose:COMPANION,seq:String(++this.responseSeq),topic:String(this.topicEpoch)}};this.activeSeq=this.responseSeq;
    const override=requestedTurnInstructions(action,this.ledger.ordered(),this.seed,this.policy);
    if(override)request.instructions=override;
    this.currentAssistant='';this.responseId='';this.playbackEnded=false;this.generationEnded=false;this.hooks.phase('thinking');this.publishActivity();
    // Omit conversation/input: use real default conversation including the original user audio.
    this.emit({type:'response.create',response:request});this.watchdog=setTimeout(()=>this.fail('response_timeout'),45000);
  }
  private finishPlayback(){if(!this.generationEnded||!this.playbackEnded)return;clearTimeout(this.watchdog);if(this.currentAssistant&&!this.discarded.has(this.responseId)){this.ledger.upsert(this.currentAssistant,'assistant',{delivered:true});this.changed();}this.gate.finish();this.hooks.phase('ready');this.publishActivity();this.armIdle();void this.observe();if(this.gate.hasPending||this.queuedAction)this.flushSoon();}
  private armIdle(){clearTimeout(this.idle);this.idle=setTimeout(()=>{this.hooks.notice('先帮你暂停了。准备好了，再开始就好。');this.end();},180000);}
  private async observe(){
    if(this.ended||this.observing||!this.ticket||this.userTurns-this.observedAt<5)return;
    const evidence=this.ledger.evidence();if(evidence.filter(l=>l.role==='user').length<4)return;
    this.observing=true;this.observedAt=this.userTurns;const epoch=this.topicEpoch,revision=this.policy.revision,policyEpoch=this.policyEpoch;const abort=this.observerAbort=new AbortController();
    try{const observations=await fetchObservations(this.ticket,evidence,AbortSignal.any([abort.signal,this.abort.signal]));if(this.ended||epoch!==this.topicEpoch||revision!==this.policy.revision||policyEpoch!==this.policyEpoch)return;const next=applyObservations(this.policy,observations,evidence);if(this.gate.active||this.gate.speaking)this.nextPolicy=next;else{this.policy=next;this.hooks.policy(next);this.configure();}}
    catch{/* Optional observation never substitutes a canned reply or blocks native chat. */}finally{this.observing=false;}
  }
  private event(e:any){
    if(this.ended||!e||typeof e.type!=='string')return;
    if(e.type==='response.created'){
      const m=e.response?.metadata,id=String(e.response?.id||'');if(m?.purpose!==COMPANION)return;
      if(Number(m.seq)!==this.activeSeq||Number(m.topic)!==this.topicEpoch){if(id){this.discarded.add(id);this.emit({type:'response.cancel',response_id:id});}return;}this.responseId=id;return;
    }
    const responseId=String(e.response_id||e.response?.id||'');if(responseId&&this.discarded.has(responseId))return;
    if(responseId&&this.responseId&&responseId!==this.responseId)return;
    switch(e.type){
      case'conversation.item.added':case'conversation.item.created':{const item=e.item;if(item?.type==='message'&&['user','assistant'].includes(item.role)){this.ledger.upsert(item.id,item.role,{previous:String(e.previous_item_id||'')});}break;}
      case'input_audio_buffer.speech_started':if(this.wantsMic&&this.stream){this.gate.speaking=true;this.written?.setSpeaking(true);this.speakingItem=String(e.item_id||'');this.queuedAction=null;clearTimeout(this.idle);this.interrupt();this.hooks.phase('ready');this.publishActivity();}break;
      case'input_audio_buffer.speech_stopped':if(!e.item_id||!this.speakingItem||e.item_id===this.speakingItem){this.gate.speaking=false;this.written?.setSpeaking(false);this.speakingItem='';if(this.gate.hasPending)this.flushSoon();}break;
      case'input_audio_buffer.committed':{const id=String(e.item_id||'');if(!this.gate.commit(id))break;if(!this.speakingItem||this.speakingItem===id){this.gate.speaking=false;this.written?.setSpeaking(false);this.speakingItem='';}this.ledger.upsert(id,'user',{previous:String(e.previous_item_id||''),assistance:this.pendingAssistance});this.pendingAssistance='none';this.userTurns++;this.flushSoon();break;}
      case'conversation.item.input_audio_transcription.completed':{const id=String(e.item_id||'');if(!id)break;this.ledger.upsert(id,'user',{text:String(e.transcript||'').slice(0,700)});this.changed();break;}
      case'conversation.item.input_audio_transcription.failed':this.hooks.notice('这句话的字幕没有识别出来，语音对话仍会继续。');break;
      case'response.output_item.added':case'response.output_item.created':if(e.item?.role==='assistant'){this.currentAssistant=String(e.item.id);this.ledger.upsert(this.currentAssistant,'assistant');}break;
      case'response.output_audio_transcript.delta':{const id=String(e.item_id||this.currentAssistant);if(!id)break;this.currentAssistant=id;const old=this.ledger.ordered().find(l=>l.id===id)?.text||'';this.ledger.upsert(id,'assistant',{text:(old+String(e.delta||'')).slice(0,3000)});this.changed();break;}
      case'response.output_audio_transcript.done':{const id=String(e.item_id||this.currentAssistant);if(id){this.currentAssistant=id;this.ledger.upsert(id,'assistant',{text:String(e.transcript||'').slice(0,3000)});this.changed();}break;}
      case'output_audio_buffer.started':this.bufferPlaying=true;this.playbackEnded=false;this.hooks.phase('speaking');this.publishActivity();break;
      case'output_audio_buffer.stopped':case'output_audio_buffer.cleared':this.bufferPlaying=false;this.playbackEnded=true;this.publishActivity();this.finishPlayback();break;
      case'response.done':{
        const r=e.response;if(r?.status==='cancelled'){this.generationEnded=true;this.gate.finish();if(this.queuedAction||this.gate.hasPending)this.flushSoon();break;}
        if(r?.status!=='completed'){this.fail('response_failed');break;}
        for(const item of r.output||[]){if(item.role!=='assistant')continue;this.currentAssistant=item.id;const transcript=(item.content||[]).map((c:any)=>c.transcript||c.text||'').join('');if(transcript)this.ledger.upsert(item.id,'assistant',{text:transcript.slice(0,3000)});}
        this.generationEnded=true;this.changed();this.finishPlayback();break;
      }
      case'conversation.item.truncated':if(e.item_id){this.ledger.upsert(e.item_id,'assistant',{interrupted:true,delivered:false});this.changed();}break;
      case'error':{const code=String(e.error?.code||'voice_error');if(['response_cancel_not_active','input_audio_buffer_commit_empty'].includes(code)){if(code==='input_audio_buffer_commit_empty'){this.gate.speaking=false;this.flushSoon();}break;}this.fail(code);break;}
    }
  }
  end(){if(this.ended)return;this.dispose();this.hooks.phase('closed');}
  dispose(){if(this.ended)return;this.ended=true;clearTimeout(this.reconnectGrace);this.written?.dispose();this.noteSeen.clear();this.wantsMic=false;this.micRequest++;this.abort.abort();this.observerAbort?.abort();clearTimeout(this.replyTimer);clearTimeout(this.deadline);clearTimeout(this.watchdog);clearTimeout(this.idle);clearInterval(this.heartbeat);this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;if(this.dc){this.dc.onclose=null;this.dc.onmessage=null;this.dc.onerror=null;this.dc.close();}if(this.pc){this.pc.onconnectionstatechange=null;this.pc.ontrack=null;this.pc.close();}if(this.audio){this.audio.pause();this.audio.srcObject=null;this.audio.remove();}this.meter.dispose();stopSession(this.ticket);this.ticket=null;this.ledger.clear();this.bufferPlaying=false;this.gate.clear();this.publishActivity();}
  private fail(reason:string){if(this.ended)return;this.dispose();this.hooks.error(reason);this.hooks.phase('error');}
}
