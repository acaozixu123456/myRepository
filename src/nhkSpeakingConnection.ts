import {acceptSpeakingTranscript, newSpeakingProgress, SPEAKING_CONSENT, SPEAKING_CONTRACT, SPEAKING_SECONDS, speakingInstructions, type SpeakingPlan, type SpeakingProgress, type SpeakingRequestKind} from './nhkSpeaking';
export type SpeakingPhase = 'connecting' | 'coach' | 'listening' | 'thinking' | 'done' | 'error';
type Hooks = {onPhase:(v:SpeakingPhase)=>void; onProgress:(v:SpeakingProgress)=>void; onAssistant:(v:string)=>void; onHint:(v:string)=>void; onBlocked:(v:boolean)=>void; onModel:(v:string)=>void; onError:(v:string)=>void};
type StopTicket = {callId:string; expiresAt:number; stopToken:string};
/** Owns exactly one microphone, peer and cancellation scope; never persists recordings. */
export class NhkSpeakingConnection {
  private abort = new AbortController();
  private pc:RTCPeerConnection|null=null; private dc:RTCDataChannel|null=null; private stream:MediaStream|null=null; private audio:HTMLAudioElement|null=null;
  private ticket:StopTicket|null=null;
  private timer:ReturnType<typeof setTimeout>|undefined; private watchdog:ReturnType<typeof setTimeout>|undefined; private idleHint:ReturnType<typeof setTimeout>|undefined;
  private closed=false; private negotiated=false; private started=false; private blocked=false; private accepting=false; private speechSeen=false; private waitingAsr=false;
  private responsePending=false; private responseId=''; private responseDone=false; private playbackDone=false; private responseKind:SpeakingRequestKind='start';
  private queued:{kind:SpeakingRequestKind;heard:string}|null=null;
  private progress=newSpeakingProgress(); private assistant=''; private sentResponses=0;
  constructor(private readonly plan:SpeakingPlan, private readonly hooks:Hooks) {}
  async start():Promise<void> {
    this.hooks.onPhase('connecting');
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection==='undefined') throw new Error('unsupported');
      const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
      if(this.closed){stream.getTracks().forEach(t=>t.stop());return;}
      this.stream=stream; stream.getAudioTracks().forEach(t=>{t.enabled=false;});
      const pc=new RTCPeerConnection(); this.pc=pc;
      const audio=document.createElement('audio'); audio.autoplay=true; audio.setAttribute('playsinline',''); audio.style.display='none'; document.body.appendChild(audio); this.audio=audio;
      pc.ontrack=e=>{if(!this.closed){audio.srcObject=e.streams[0]||new MediaStream([e.track]);void audio.play().catch(()=>{if(!this.closed){this.blocked=true;this.microphone(false);this.hooks.onBlocked(true);}});}};
      pc.onconnectionstatechange=()=>{if(!this.closed&&['failed','disconnected','closed'].includes(pc.connectionState))this.fail('connection_lost');};
      stream.getTracks().forEach(t=>pc.addTrack(t,stream));
      const dc=pc.createDataChannel('oai-events');this.dc=dc;
      dc.onopen=()=>this.maybeStart();dc.onclose=()=>{if(!this.closed)this.fail('connection_lost');};dc.onerror=()=>this.fail('connection_lost');
      dc.onmessage=e=>{if(this.closed)return;try{this.event(JSON.parse(String(e.data)));}catch{this.fail('invalid_voice_event');}};
      const offer=await pc.createOffer();if(this.closed)return;
      await pc.setLocalDescription(offer);const sdp=pc.localDescription?.sdp||offer.sdp;if(!sdp)throw new Error('missing_offer');
      const result=await fetch('/api/nhk-speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'speaking_start',consent:SPEAKING_CONSENT,clientRequestId:crypto.randomUUID(),plan:this.plan,sdp}),signal:AbortSignal.any([this.abort.signal,AbortSignal.timeout(28000)])});
      const data=await result.json();if(data?.callId&&data?.stopToken)this.ticket={callId:data.callId,expiresAt:data.expiresAt,stopToken:data.stopToken};
      if(this.closed){this.sendStop();return;}
      if(!result.ok||!data.ok)throw new Error(data.reason||'connection_failed');
      if(data.contractVersion!==SPEAKING_CONTRACT||data.model!=='gpt-realtime-2.1'||typeof data.sdp!=='string'||!Number.isFinite(data.expiresAt))throw new Error('voice_contract_mismatch');
      this.hooks.onModel(data.model);await pc.setRemoteDescription({type:'answer',sdp:data.sdp});if(this.closed)return;this.negotiated=true;
      this.timer=setTimeout(()=>{this.hooks.onHint('今天先到这里，已经说出的那一点也算开始。');this.end();},Math.max(1000,Math.min(SPEAKING_SECONDS*1000,data.expiresAt-Date.now()-1000)));
      this.watchdog=setTimeout(()=>{if(!this.started)this.fail('connection_timeout');},12000);this.maybeStart();
    }catch(e){if(!this.closed)this.fail(e instanceof Error?`${e.name}:${e.message}`:'connection_failed');}
  }
  private maybeStart(){if(this.closed||this.started||!this.negotiated||this.dc?.readyState!=='open')return;this.started=true;clearTimeout(this.watchdog);this.request('start');}
  private send(e:Record<string,unknown>){if(this.closed||this.dc?.readyState!=='open')return false;this.dc.send(JSON.stringify(e));return true;}
  private microphone(enabled:boolean){this.accepting=enabled&&!this.closed&&!this.blocked;this.stream?.getAudioTracks().forEach(t=>{t.enabled=this.accepting;});}
  private listen(){if(this.closed||this.blocked||this.progress.turn>=3)return;this.waitingAsr=false;this.speechSeen=false;this.microphone(true);this.hooks.onPhase('listening');clearTimeout(this.idleHint);this.idleHint=setTimeout(()=>{if(this.accepting)this.hooks.onHint('慢慢想。卡住的话，点“帮我接”就好。');},9000);}
  help(){this.request('help');} repeat(){this.request('repeat');}
  finishUtterance(){if(this.accepting&&this.speechSeen&&!this.waitingAsr){this.waitingAsr=true;this.send({type:'input_audio_buffer.commit'});this.hooks.onPhase('thinking');}else if(this.accepting)this.hooks.onHint('我会等你说完。只说屏幕上的一个词也可以。');}
  async unlockAudio(){if(this.closed||!this.audio)return;try{await this.audio.play();if(this.closed)return;this.blocked=false;this.hooks.onBlocked(false);if(this.responsePending)this.queued={kind:'repeat',heard:''};else this.request('repeat');}catch{this.hooks.onHint('浏览器还没有允许播放声音，请再点一次“播放声音”。');}}
  private request(kind:SpeakingRequestKind,heard=''){
    if(this.closed||!this.started)return;this.microphone(false);this.waitingAsr=false;clearTimeout(this.idleHint);
    if(this.responsePending){this.queued={kind,heard};if(this.responseId)this.send({type:'response.cancel',response_id:this.responseId});return;}
    if(this.sentResponses>=12){this.hooks.onHint('今天先到这里，之后再从这一句接着练。');this.end();return;}
    if(this.sentResponses>0)this.send({type:'output_audio_buffer.clear'});
    this.send({type:'input_audio_buffer.clear'});this.responsePending=true;this.responseId='';this.responseDone=false;this.playbackDone=false;this.responseKind=kind;this.assistant='';
    this.hooks.onAssistant('');this.hooks.onPhase('coach');this.sentResponses++;
    this.send({type:'response.create',response:{output_modalities:['audio'],instructions:speakingInstructions(this.plan,this.progress.turn,kind,heard),metadata:{purpose:'nhk-speaking',turn:String(this.progress.turn),kind}}});
    clearTimeout(this.watchdog);this.watchdog=setTimeout(()=>this.fail('voice_response_timeout'),28000);
  }
  private releaseAfterPlayback(){if(this.closed||!this.responseDone||!this.playbackDone)return;clearTimeout(this.watchdog);if(this.queued){const q=this.queued;this.queued=null;this.request(q.kind,q.heard);return;}if(this.responseKind==='finish'){this.end();return;}this.listen();}
  private event(e:any){
    if(this.closed||!e||typeof e.type!=='string')return;
    switch(e.type){
      case 'response.created':this.responseId=e.response?.id||'';if(this.queued&&this.responseId)this.send({type:'response.cancel',response_id:this.responseId});break;
      case 'response.output_audio_transcript.delta':this.assistant=(this.assistant+String(e.delta||'')).slice(0,800);this.hooks.onAssistant(this.assistant);break;
      case 'response.output_audio_transcript.done':this.assistant=String(e.transcript||this.assistant).slice(0,800);this.hooks.onAssistant(this.assistant);break;
      case 'output_audio_buffer.started':this.playbackDone=false;this.microphone(false);break;
      case 'output_audio_buffer.stopped':if(e.response_id&&this.responseId&&e.response_id!==this.responseId)break;this.playbackDone=true;this.releaseAfterPlayback();break;
      case 'response.done':{
        if(e.response?.id&&this.responseId&&e.response.id!==this.responseId)break;this.responsePending=false;const status=e.response?.status;
        if(status==='cancelled'&&this.queued){const q=this.queued;this.queued=null;this.request(q.kind,q.heard);break;}
        if(status!=='completed'){this.fail('voice_response_failed');break;}this.responseDone=true;this.releaseAfterPlayback();break;
      }
      case 'input_audio_buffer.speech_started':if(this.accepting){this.speechSeen=true;this.hooks.onHint('我在听，慢慢说。');clearTimeout(this.idleHint);}break;
      case 'input_audio_buffer.speech_stopped':if(this.accepting){this.waitingAsr=true;this.hooks.onPhase('thinking');}break;
      case 'conversation.item.input_audio_transcription.completed':{
        if(!this.accepting&&!this.waitingAsr)break;
        const next=acceptSpeakingTranscript(this.progress,this.plan,String(e.item_id||''),String(e.transcript||''));if(next===this.progress)break;
        this.progress=next;this.hooks.onProgress(next);this.microphone(false);this.waitingAsr=false;
        if(next.lastKind==='end'){this.end();break;}
        if(next.lastKind==='filler'){this.hooks.onHint('不用着急，我还在听。');this.listen();break;}
        if(next.lastKind==='help'||next.lastKind==='repeat'||next.lastKind==='chinese'){this.hooks.onHint('先借用这一句，再试着说一点。');this.request(next.lastKind,String(e.transcript||''));break;}
        this.hooks.onHint('说出了一点，就往前走了一点。');this.request(next.turn>=3?'finish':'next',String(e.transcript||''));break;
      }
      case 'conversation.item.input_audio_transcription.failed':if(this.accepting||this.waitingAsr){this.hooks.onHint('这次没听清，不是你说错了。可以只说一个词。');this.listen();}break;
      case 'error':{const code=String(e.error?.code||'voice_error');if(['response_cancel_not_active','input_audio_buffer_commit_empty'].includes(code)){if(code==='input_audio_buffer_commit_empty'&&(this.accepting||this.waitingAsr)){this.hooks.onHint('还没有收到清楚的声音，慢慢说就好。');this.listen();}break;}this.fail(code);break;}
    }
  }
  private sendStop(){const ticket=this.ticket;this.ticket=null;if(!ticket)return;void fetch('/api/nhk-speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'speaking_stop',...ticket}),keepalive:true}).catch(()=>{});}
  private cleanup(){if(this.closed)return;this.closed=true;this.accepting=false;this.abort.abort();clearTimeout(this.timer);clearTimeout(this.watchdog);clearTimeout(this.idleHint);this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;if(this.dc){this.dc.onmessage=null;this.dc.onclose=null;this.dc.onerror=null;this.dc.close();}if(this.pc){this.pc.onconnectionstatechange=null;this.pc.ontrack=null;this.pc.close();}if(this.audio){this.audio.pause();this.audio.srcObject=null;this.audio.remove();}this.sendStop();}
  private fail(reason:string){if(this.closed)return;this.cleanup();this.hooks.onError(reason);this.hooks.onPhase('error');}
  end(){if(!this.closed){this.cleanup();this.hooks.onPhase('done');}} dispose(){this.cleanup();}
}
