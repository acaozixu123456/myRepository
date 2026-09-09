import {AudioActivityMeter,type VoiceActivity} from './nhkAudioActivity';
import {TeacherTurnChannel,TEACHER_SPEED,TEACHER_SLOW_SPEED,teacherControl,teacherFrame,teacherVoiceInstructions,fallbackTeacherTurn,type TeacherTurn,type TeacherContext} from './nhkGentleTeacher';
import {TurnSupportChannel,type TurnSupportFrame} from './nhkTurnSupport';
import type {ExperienceMetric} from './nhkChatExperience';
import {SPEAKING_CONSENT} from './nhkSpeaking';
import {CHAT_CONTRACT, chatIntent, type ChatAction, type ChatLine, type ChatPlan} from './nhkChat';
export type ChatPhase='connecting'|'renewing'|'coach'|'listening'|'thinking'|'done'|'error';
export type ChatHooks={phase:(p:ChatPhase)=>void;assistant:(s:string)=>void;hint:(s:string)=>void;blocked:(v:boolean)=>void;error:(reason:string,retryAfter?:number)=>void;shuffle:()=>void;heard:(text:string)=>void;support?:(frame:TurnSupportFrame|null)=>void;metric?:(event:ExperienceMetric)=>void;pace?:(value:number)=>void;activity?:(value:VoiceActivity)=>void};
type Ticket={callId:string;expiresAt:number;stopToken:string};
type Job={kind:ChatAction|'simplify';heard:string;example?:string};
/** One user consent and microphone; topic changes reuse the peer. Audio never enters storage. */
export class NhkChatConnection{
  private stream:MediaStream|null=null;private pc:RTCPeerConnection|null=null;private dc:RTCDataChannel|null=null;private audio:HTMLAudioElement|null=null;
  private closed=false;private busyConnecting=false;private serial=0;private abort:AbortController|null=null;private ticket:Ticket|null=null;
  private accepting=false;private waiting=false;private talking=false;private blocked=false;private renewDue=false;private renewAt=0;
  private generation=false;private responseDone=false;private playbackDone=false;private responseId='';private requestSeq=0;private output='';private pending:Job|null=null;private activeJob:Job={kind:'start',heard:''};
  private committed=new Set<string>();private handled=new Set<string>();private history:ChatLine[]=[];private topicSerial=0;private responses=0;
  private deadline:ReturnType<typeof setTimeout>|undefined;private renewTimer:ReturnType<typeof setTimeout>|undefined;private watchdog:ReturnType<typeof setTimeout>|undefined;private idle:ReturnType<typeof setTimeout>|undefined;private shuffleTimer:ReturnType<typeof setTimeout>|undefined;
  private support:TurnSupportChannel;
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
  toggleMic(){return this.setMicEnabled(!this.wantMic);}
  private teacher:TeacherTurnChannel;private lastTeacher:TeacherTurn|null=null;private plannedTeacher:TeacherTurn|null=null;private speed=TEACHER_SPEED;private configuredSpeed=0;private voiceLimit:ReturnType<typeof setTimeout>|undefined;private clipped=false;
  constructor(private plan:ChatPlan,private hooks:ChatHooks){this.meter=new AudioActivityMeter((input,output,ready)=>{this.inputLevel=input;this.outputLevel=output;this.meterReady=ready;this.activity();});this.teacher=new TeacherTurnChannel(e=>this.emit(e));this.support=new TurnSupportChannel({send:e=>this.emit(e),update:f=>this.hooks.support?.(f),spend:()=>{if(!this.hooks.support||this.closed||this.busyConnecting||this.dc?.readyState!=='open'||this.responses>=22||Date.now()>this.renewAt-6000)return false;this.responses++;return true;}});}
  setSupportEnabled(on:boolean){this.support.setEnabled(on);}
  private prepareSupport(){
    if(this.pending||this.shuffleTimer||!this.output||!['start','answer','resume','simplify'].includes(this.activeJob.kind))return;
    const key=`${this.serial}-${this.topicSerial}-${this.requestSeq}`;
    const frame=this.plannedTeacher&&teacherFrame(key,this.plannedTeacher,this.output);
    if(frame&&(frame.words.length||frame.starter))this.support.adopt(frame);else this.support.begin(key,this.output,{learner:this.activeJob.heard,source:[]});
  }
  private teacherContext(job:Job):TeacherContext{return {kind:job.kind,plan:this.plan,history:this.history,heard:job.heard,previous:job.kind==='repeat'?(this.plannedTeacher||this.lastTeacher):this.lastTeacher};}
  slowDown(){if(this.closed)return;this.speed=TEACHER_SLOW_SPEED;this.hooks.pace?.(this.speed);this.hooks.hint('慢一点，还是刚才这一句。');this.repeat();}
  simplify(){if(this.closed)return;this.hooks.hint('不换话题，只把刚才那句变简单。');this.request({kind:'simplify',heard:''});}
  private stopLongVoice(){
    if(this.closed||this.clipped)return;this.clipped=true;this.audioPlaying=false;clearTimeout(this.voiceLimit);clearTimeout(this.watchdog);
    if(this.responseId)this.emit({type:'response.cancel',response_id:this.responseId});this.emit({type:'output_audio_buffer.clear'});
    this.support.cancelPending();this.generation=false;this.responseDone=true;this.playbackDone=true;
    this.hooks.hint('先停一下，一次只说一点。可以点“再简单点”。');this.listen();
  }
  async start(){if(this.closed||this.launched)return;this.launched=true;this.meter.unlock();this.hooks.phase('connecting');this.activity();try{if(!window.isSecureContext||typeof RTCPeerConnection==='undefined')throw new Error('unsupported');await this.connect({kind:'start',heard:''},false);}catch(e){if(!this.closed)this.fail(e instanceof Error?e.message:'connection_failed');}}
  private emit(value:Record<string,unknown>){if(!this.closed&&this.dc?.readyState==='open')this.dc.send(JSON.stringify(value));}
  private mic(on:boolean){this.accepting=on&&this.wantMic&&!!this.stream&&!this.closed&&!this.blocked;this.stream?.getAudioTracks().forEach(t=>{t.enabled=this.accepting;});this.activity();}
  private stopTicket(ticket:Ticket|null){if(!ticket)return;void fetch('/api/nhk-speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'speaking_stop',...ticket}),keepalive:true}).catch(()=>{});}
  private closePeer(){this.canListen=false;this.audioPlaying=false;this.mediaPlaying=false;this.sender=null;this.meter.detach('output');this.teacher.reset();this.configuredSpeed=0;clearTimeout(this.voiceLimit);this.support.reset();this.serial++;this.abort?.abort();clearTimeout(this.deadline);clearTimeout(this.renewTimer);clearTimeout(this.watchdog);this.mic(false);if(this.dc){this.dc.onmessage=null;this.dc.onclose=null;this.dc.onerror=null;this.dc.onopen=null;this.dc.close();this.dc=null;}if(this.pc){this.pc.onconnectionstatechange=null;this.pc.ontrack=null;this.pc.close();this.pc=null;}if(this.audio){this.audio.pause();this.audio.srcObject=null;this.audio.remove();this.audio=null;}this.stopTicket(this.ticket);this.ticket=null;this.committed.clear();this.handled.clear();this.generation=false;this.responseDone=false;this.playbackDone=false;this.waiting=false;this.talking=false;this.responseId='';}
  private async connect(job:Job,renew:boolean){
    if(this.closed||this.busyConnecting)return;
    this.busyConnecting=true;this.closePeer();const serial=this.serial;this.abort=new AbortController();this.responses=0;this.renewDue=false;this.pending=job;
    this.hooks.phase(renew?'renewing':'connecting');if(renew)this.hooks.hint('正在续接声音，话题和刚才的话都还在。');
    try{
      const pc=this.pc=new RTCPeerConnection();const audio=this.audio=document.createElement('audio');audio.autoplay=true;audio.setAttribute('playsinline','');audio.style.display='none';audio.onplaying=()=>{this.mediaPlaying=true;this.activity();};audio.onwaiting=()=>{this.mediaPlaying=false;this.activity();};audio.onpause=()=>{this.mediaPlaying=false;this.activity();};document.body.appendChild(audio);
      pc.ontrack=e=>{if(this.closed||serial!==this.serial)return;const remote=e.streams[0]||new MediaStream([e.track]);audio.srcObject=remote;this.meter.attach('output',remote);void audio.play().catch(()=>{if(!this.closed&&serial===this.serial){this.blocked=true;this.mic(false);this.hooks.blocked(true);}});};
      pc.onconnectionstatechange=()=>{if(this.closed||serial!==this.serial)return;if(['failed','disconnected','closed'].includes(pc.connectionState))this.fail('connection_lost');};
      this.sender=pc.addTransceiver('audio',{direction:'sendrecv'}).sender;if(this.stream&&this.wantMic)await this.sender.replaceTrack(this.stream.getAudioTracks()[0]);const dc=this.dc=pc.createDataChannel('oai-events');let negotiated=false;
      const begin=()=>{if(this.closed||serial!==this.serial||!negotiated||dc.readyState!=='open')return;clearTimeout(this.watchdog);this.busyConnecting=false;const next=this.pending||job;this.pending=null;this.request(next);};
      dc.onopen=begin;dc.onmessage=e=>{if(this.closed||serial!==this.serial)return;try{this.event(JSON.parse(String(e.data)));}catch{this.fail('invalid_voice_event');}};dc.onclose=()=>{if(!this.closed&&serial===this.serial)this.fail('connection_lost');};dc.onerror=()=>{if(!this.closed&&serial===this.serial)this.fail('connection_lost');};
      await pc.setLocalDescription(await pc.createOffer());if(this.closed||serial!==this.serial)return;
      const result=await fetch('/api/nhk-speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'speaking_start',consent:SPEAKING_CONSENT,clientRequestId:crypto.randomUUID(),plan:this.plan,sdp:pc.localDescription?.sdp}),signal:AbortSignal.any([this.abort.signal,AbortSignal.timeout(28000)])});
      const data=await result.json();const ticket=data.callId&&data.stopToken?{callId:data.callId,expiresAt:data.expiresAt,stopToken:data.stopToken}:null;
      if(this.closed||serial!==this.serial){this.stopTicket(ticket);return;}this.ticket=ticket;
      if(!result.ok||!data.ok){this.fail(data.reason||'connection_failed',data.retryAfterSeconds);return;}
      if(data.chatContract!==CHAT_CONTRACT||data.model!=='gpt-realtime-2.1'||typeof data.sdp!=='string'||!ticket||!Number.isFinite(data.expiresAt))throw new Error('chat_contract_mismatch');
      await pc.setRemoteDescription({type:'answer',sdp:data.sdp});if(this.closed||serial!==this.serial)return;
      this.renewAt=Math.min(data.expiresAt-25000,Date.now()+85000);
      this.renewTimer=setTimeout(()=>{this.renewDue=true;if(this.accepting&&!this.talking&&!this.waiting)this.rotate({kind:'resume',heard:''});},Math.max(1000,this.renewAt-Date.now()));
      // Transport lease is not a lesson end. Rotate rather than forcing a three-turn restart.
      this.deadline=setTimeout(()=>this.rotate(this.pending||{kind:'resume',heard:''}),Math.max(1000,data.expiresAt-Date.now()-5000));
      negotiated=true;this.watchdog=setTimeout(()=>this.fail('connection_timeout'),12000);begin();
    }catch(e){if(!this.closed&&serial===this.serial)this.fail(e instanceof Error?`${e.name}:${e.message}`:'connection_failed');}
  }
  private rotate(job:Job){if(this.closed||this.busyConnecting)return;this.hooks.metric?.('renew');clearTimeout(this.idle);this.pending=null;void this.connect(job,true);}
  private request(job:Job){
    if(this.closed)return;this.teacher.cancel();
    if(job.kind==='help'||job.kind==='repeat')this.support.cancelPending();else this.support.clear();
    this.canListen=false;this.mic(false);this.waiting=false;this.talking=false;clearTimeout(this.idle);clearTimeout(this.voiceLimit);
    if(this.busyConnecting){this.pending=job;return;}
    if(this.generation){this.pending=job;if(this.responseId)this.emit({type:'response.cancel',response_id:this.responseId});this.emit({type:'output_audio_buffer.clear'});return;}
    if(this.renewDue||Date.now()>=this.renewAt||this.responses>=22){this.rotate(job);return;}
    this.pending=null;this.committed.clear();this.emit({type:'input_audio_buffer.clear'});if(this.responses)this.emit({type:'output_audio_buffer.clear'});
    this.requestSeq++;this.responseId='';this.responseDone=false;this.playbackDone=false;this.clipped=false;this.output='';this.activeJob=job;
    this.hooks.assistant('');this.hooks.metric?.('request_sent');const key=`${this.serial}-${this.topicSerial}-${this.requestSeq}`;
    const context=this.teacherContext(job);
    if(['start','repeat','resume'].includes(job.kind)||(job.kind==='help'&&job.example)){
      if(job.kind==='help')context.previous={...(context.previous||fallbackTeacherTurn(context)),example:job.example!};
      this.playTeacher(job,fallbackTeacherTurn(context));return;
    }
    this.responses++;this.hooks.phase('thinking');this.activity();
    this.teacher.begin(key,context,turn=>{
      if(this.closed||key!==`${this.serial}-${this.topicSerial}-${this.requestSeq}`||this.pending||this.shuffleTimer)return;
      this.playTeacher(job,turn);
    });
  }
  private playTeacher(job:Job,turn:TeacherTurn){
    if(this.closed||this.busyConnecting)return;
    if(this.configuredSpeed!==this.speed){this.emit({type:'session.update',session:{type:'realtime',audio:{output:{speed:this.speed}}}});this.configuredSpeed=this.speed;}
    this.plannedTeacher=turn;if(job.kind!=='help'&&job.kind!=='repeat')this.lastTeacher=turn;
    this.responses++;this.generation=true;this.activeJob=job;this.hooks.phase('coach');this.activity();
    this.emit({type:'response.create',response:{conversation:'none',input:[],output_modalities:['audio'],max_output_tokens:384,instructions:teacherVoiceInstructions(turn),metadata:{purpose:CHAT_CONTRACT,seq:String(this.requestSeq),topic:String(this.topicSerial)}}});
    clearTimeout(this.watchdog);this.watchdog=setTimeout(()=>this.fail('response_timeout'),28000);
  }
  changeTopic(plan:ChatPlan){if(this.closed)return;this.teacher.cancel();this.lastTeacher=null;this.plannedTeacher=null;clearTimeout(this.voiceLimit);this.support.clear();this.hooks.metric?.('shuffle');this.plan=plan;this.topicSerial++;this.history=[];this.committed.clear();this.canListen=false;this.audioPlaying=false;this.mic(false);this.waiting=false;this.talking=false;this.output='';this.hooks.assistant('');this.hooks.hint('换个轻松的话头。一个词也可以。');clearTimeout(this.idle);clearTimeout(this.shuffleTimer);
    // Coalesce rapid taps. Only the last topic speaks; browsing never reconnects the peer.
    this.pending={kind:'start',heard:''};if(this.generation&&this.responseId)this.emit({type:'response.cancel',response_id:this.responseId});this.emit({type:'output_audio_buffer.clear'});this.emit({type:'input_audio_buffer.clear'});
    this.shuffleTimer=setTimeout(()=>{this.shuffleTimer=undefined;this.request({kind:'start',heard:''});},400);
  }
  help(){this.hooks.metric?.('help');this.request({kind:'help',heard:'',example:this.support.frame?.example||undefined});}repeat(){this.request({kind:'repeat',heard:''});}
  finishUtterance(){if(this.accepting&&this.talking&&!this.waiting){this.waiting=true;this.emit({type:'input_audio_buffer.commit'});this.hooks.phase('thinking');}else if(this.accepting)this.hooks.hint('不用点也可以，我会等你说完。');}
  async unlockAudio(){if(this.closed||!this.audio)return;try{await this.audio.play();if(this.closed)return;this.blocked=false;this.hooks.blocked(false);this.request({kind:'repeat',heard:''});}catch{this.hooks.hint('浏览器还没允许播放，再点一下“播放声音”。');}}
  private listen(){if(this.closed||this.blocked)return;if(this.renewDue){this.rotate({kind:'resume',heard:''});return;}this.waiting=false;this.talking=false;this.canListen=true;this.mic(true);this.hooks.phase('listening');this.activity();clearTimeout(this.idle);this.idle=setTimeout(()=>{this.hooks.hint('先帮你暂停了，声音已经关闭。话题还在，想聊时再接上。');this.end();},60000);}
  private release(){if(this.closed||!this.responseDone||!this.playbackDone)return;clearTimeout(this.watchdog);if(this.shuffleTimer)return;if(this.pending){const job=this.pending;this.pending=null;this.request(job);return;}this.listen();}
  private addHistory(role:ChatLine['role'],text:string){if(text.trim())this.history=[...this.history,{role,text:text.trim().slice(0,500)}].slice(-8);}
  private event(e:any){if(this.closed||!e||typeof e.type!=='string')return;if(this.teacher.handle(e)||this.support.handle(e))return;
    if(e.type==='response.created'){this.responseId=e.response?.id||'';if(e.response?.metadata?.topic&&e.response.metadata.topic!==String(this.topicSerial)){this.emit({type:'response.cancel',response_id:this.responseId});}else if(this.pending)this.emit({type:'response.cancel',response_id:this.responseId});return;}
    if(e.response_id&&this.responseId&&e.response_id!==this.responseId)return;
    switch(e.type){
      case'response.output_audio_transcript.delta':if(!this.pending&&!this.shuffleTimer&&!this.clipped){this.output=(this.output+String(e.delta||'')).slice(0,1000);this.hooks.assistant(this.output);if(this.output.length>64)this.stopLongVoice();}break;
      case'response.output_audio_transcript.done':if(!this.pending&&!this.shuffleTimer&&!this.clipped){this.output=String(e.transcript||this.output).slice(0,1000);this.hooks.assistant(this.output);this.prepareSupport();}break;
      case'output_audio_buffer.started':this.audioPlaying=true;this.activity();clearTimeout(this.voiceLimit);this.voiceLimit=setTimeout(()=>this.stopLongVoice(),16000);this.hooks.metric?.('audio_started');this.playbackDone=false;this.mic(false);break;
      case'output_audio_buffer.stopped':this.audioPlaying=false;this.activity();clearTimeout(this.voiceLimit);this.playbackDone=true;this.release();break;
      case'response.done':{
        if(e.response?.id&&this.responseId&&e.response.id!==this.responseId)break;this.generation=false;
        if(this.pending){clearTimeout(this.watchdog);if(!this.shuffleTimer){const job=this.pending;this.pending=null;this.request(job);}break;}
        if(e.response?.status==='cancelled'){if(this.clipped)this.listen();break;}
        if(e.response?.status!=='completed'){this.fail('response_failed');break;}
        if(this.output&&this.activeJob.kind!=='repeat')this.addHistory('assistant',this.output);
        this.prepareSupport();this.responseDone=true;this.release();break;
      }
      case'input_audio_buffer.speech_started':if(this.accepting){this.support.cancelPending();this.talking=true;this.waiting=false;clearTimeout(this.idle);this.hooks.phase('listening');this.hooks.hint('我在听，慢慢说。');}break;
      case'input_audio_buffer.speech_stopped':if(this.accepting){this.waiting=true;this.hooks.phase('thinking');}break;
      case'input_audio_buffer.committed':if((this.accepting||this.waiting)&&e.item_id)this.committed.add(String(e.item_id));break;
      case'conversation.item.input_audio_transcription.completed':{
        const id=String(e.item_id||'');if(!this.committed.has(id)||this.handled.has(id)||(!this.accepting&&!this.waiting))break;this.handled.add(id);if(this.handled.size>80)this.handled.delete(this.handled.values().next().value!);
        const text=String(e.transcript||'').slice(0,500);const intent=chatIntent(text);this.mic(false);this.waiting=false;this.talking=false;
        const control=teacherControl(text);if(control==='slow'){this.slowDown();break;}if(control==='simplify'){this.simplify();break;}
        if(intent==='end'){this.end();break;}if(intent==='shuffle'){this.hooks.shuffle();break;}if(intent==='filler'){this.hooks.hint('不用急，还在听。');this.listen();break;}
        if(intent==='help'){this.help();break;}if(intent==='repeat'){this.repeat();break;}
        this.hooks.metric?.('answer');this.hooks.heard(text);this.addHistory('user',text);this.request({kind:'answer',heard:text});break;
      }
      case'conversation.item.input_audio_transcription.failed':if(this.accepting||this.waiting){this.hooks.hint('这次没听清，不是你说错了。说一点就好。');this.listen();}break;
      case'error':{const code=String(e.error?.code||'voice_error');if(code==='response_cancel_not_active')break;if(code==='input_audio_buffer_commit_empty'){if(!this.generation)this.listen();break;}this.fail(code);break;}
    }
  }
  end(){if(this.closed)return;this.dispose();this.hooks.phase('done');}
  dispose(){if(this.closed)return;this.wantMic=false;this.micRequest++;this.closed=true;clearTimeout(this.idle);clearTimeout(this.shuffleTimer);this.closePeer();this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.history=[];this.meter.dispose();this.activity();}
  private fail(reason:string,retryAfter?:number){if(this.closed)return;this.dispose();this.hooks.error(reason,retryAfter);this.hooks.phase('error');}
}
