export type VoiceActivity={micOn:boolean;input:'off'|'requesting'|'ready'|'receiving'|'paused'|'device-muted';output:'idle'|'preparing'|'playing'|'blocked';inputLevel:number;outputLevel:number;meterReady:boolean};
export const silentActivity=():VoiceActivity=>({micOn:false,input:'off',output:'idle',inputLevel:0,outputLevel:0,meterReady:false});
export function rmsLevel(samples:Uint8Array):number{if(!samples.length)return 0;let sum=0;for(const s of samples)sum+=((s-128)/128)**2;const rms=Math.sqrt(sum/samples.length);return Math.min(1,Math.max(0,(rms-.003)*9));}
type Side='input'|'output';
type Meter={source:MediaStreamAudioSourceNode;analyser:AnalyserNode;data:Uint8Array<ArrayBuffer>};
/** Samples in memory only. No recording, upload or output routing/echo. */
export class AudioActivityMeter {
  private ctx:AudioContext|null=null;private meters:Partial<Record<Side,Meter>>={};private timer:ReturnType<typeof setInterval>|undefined;private disposed=false;
  constructor(private update:(input:number,output:number,available:boolean)=>void){}
  unlock(){if(this.disposed)return;try{const AudioCtor=globalThis.AudioContext||(globalThis as any).webkitAudioContext;if(!AudioCtor)return;this.ctx??=new AudioCtor();void this.ctx!.resume().catch(()=>{});if(!this.timer)this.timer=setInterval(()=>this.sample(),80);}catch{/* Visual fallback must not break speech. */}}
  attach(side:Side,stream:MediaStream){this.detach(side);if(this.disposed||!this.ctx)return;try{const source=this.ctx.createMediaStreamSource(stream),analyser=this.ctx.createAnalyser();analyser.fftSize=256;source.connect(analyser);this.meters[side]={source,analyser,data:new Uint8Array(256)};}catch{/* Unsupported stream: show state, never a fake sound wave. */}}
  detach(side:Side){const m=this.meters[side];if(m){m.source.disconnect();m.analyser.disconnect();delete this.meters[side];}}
  private sample(){if(this.disposed)return;const level=(side:Side)=>{const m=this.meters[side];if(!m||this.ctx?.state!=='running')return 0;m.analyser.getByteTimeDomainData(m.data);return rmsLevel(m.data);};this.update(level('input'),level('output'),this.ctx?.state==='running');}
  dispose(){this.disposed=true;clearInterval(this.timer);this.detach('input');this.detach('output');void this.ctx?.close().catch(()=>{});this.ctx=null;this.update(0,0,false);}
}
