import {useSyncExternalStore} from 'react';
import {Volume2,VolumeX} from 'lucide-react';
export type LearningCue='ready'|'hint'|'progress'|'adjust'|'saved';
export const CUE_NOTES:Record<LearningCue,readonly number[]>={ready:[523.25,659.25],hint:[659.25],progress:[523.25,659.25,783.99],adjust:[440,523.25],saved:[783.99,1046.5]};
export type SoundGate={micOn:boolean;outputBusy:boolean;hidden:boolean;mediaPlaying:boolean};
export const cueAllowed=(enabled:boolean,gate:SoundGate)=>enabled&&!gate.micOn&&!gate.outputBusy&&!gate.hidden&&!gate.mediaPlaying;
let preferences={enabled:false,volume:.35,error:''};
const subscribers=new Set<()=>void>();
const subscribe=(fn:()=>void)=>{subscribers.add(fn);return()=>{subscribers.delete(fn);};};
const snapshot=()=>preferences;
let enableEpoch=0;
let context:AudioContext|null=null,gate={micOn:false,outputBusy:false},lastCue=-Infinity,bound=false;
const active=new Set<OscillatorNode>();
const publish=()=>subscribers.forEach(fn=>fn());
export function stopLearningCues():void{for(const oscillator of active){try{oscillator.stop();}catch{}oscillator.disconnect();}active.clear();}
export function updateLearningSoundGate(next:{micOn:boolean;outputBusy:boolean}):void{gate=next;if(next.micOn||next.outputBusy)stopLearningCues();}
export function discreteMediaPlaying(el:Pick<HTMLMediaElement,'srcObject'|'muted'|'paused'|'ended'|'volume'>):boolean{
 // A continuous WebRTC stream remains playing during silence. Its actual voice activity is
 // guarded separately by updateLearningSoundGate; demo/replay media still use element state.
 return !el.srcObject&&!el.muted&&!el.paused&&!el.ended&&el.volume>0;
}
function playingMedia():boolean{return typeof document!=='undefined'&&Array.from(document.querySelectorAll('audio,video')).some(el=>el instanceof HTMLMediaElement&&discreteMediaPlaying(el));}
function bindPriority():void{
 if(bound)return;bound=true;
 document.addEventListener('play',event=>{const target=event.target;if(target instanceof HTMLMediaElement&&!target.muted&&target.volume>0)stopLearningCues();},true);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stopLearningCues();});
 window.addEventListener('pagehide',()=>{enableEpoch++;stopLearningCues();void context?.close().catch(()=>{});context=null;preferences={...preferences,enabled:false};publish();});
}
/** Synthesized short motifs only; no network, recording, ambient music, or speech-rate changes. */
export function scheduleLearningCue(ctx:BaseAudioContext,cue:LearningCue,volume:number,onOscillator?:(node:OscillatorNode)=>void):number{
 if(!Number.isFinite(volume)||volume<=0)return 0;
 const start=ctx.currentTime+.012,notes=CUE_NOTES[cue],strength=Math.max(0,Math.min(1,volume));
 for(const [i,hz] of notes.entries()){
  const t=start+i*.075,osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.value=hz;
  gain.gain.setValueAtTime(.0001,t);gain.gain.linearRampToValueAtTime(.085*strength,t+.008);gain.gain.exponentialRampToValueAtTime(.0001,t+.135);
  osc.connect(gain);gain.connect(ctx.destination);osc.onended=()=>{active.delete(osc);osc.disconnect();gain.disconnect();};onOscillator?.(osc);osc.start(t);osc.stop(t+.145);
 }
 return .012+(notes.length-1)*.075+.145;
}
export function playLearningCue(cue:LearningCue):boolean{
 if(typeof document==='undefined'||!context||preferences.volume<=0||context.state!=='running'||!cueAllowed(preferences.enabled,{...gate,hidden:document.hidden,mediaPlaying:playingMedia()}))return false;
 const now=performance.now();if(now-lastCue<420)return false;lastCue=now;stopLearningCues();
 try{scheduleLearningCue(context,cue,preferences.volume,node=>active.add(node));document.dispatchEvent(new CustomEvent('hitokoto:learning-cue',{detail:{cue}}));return true;}catch{stopLearningCues();return false;}
}
export async function setLearningSounds(enabled:boolean):Promise<void>{
 const epoch=++enableEpoch;stopLearningCues();preferences={...preferences,enabled:false,error:''};publish();if(!enabled)return;
 try{
  bindPriority();if(!context||context.state==='closed'){
   const Ctor=window.AudioContext||(window as Window&{webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
   if(!Ctor)throw Error('unsupported');context=new Ctor();
  }
  await context.resume();if(epoch!==enableEpoch)return;if(context.state!=='running')throw Error('locked');
  preferences={...preferences,enabled:true};publish();playLearningCue('ready');
 }catch{if(epoch!==enableEpoch)return;preferences={...preferences,enabled:false,error:'当前浏览器暂不能播放音效，日语语音不受影响。'};publish();}
}
export function setLearningVolume(volume:number):void{if(!Number.isFinite(volume))return;if(volume<=0)stopLearningCues();preferences={...preferences,volume:Math.max(0,Math.min(1,volume))};publish();}
export function LearningSoundControl({compact=false}:{compact?:boolean}){
 const settings=useSyncExternalStore(subscribe,snapshot,snapshot);
 return <section className={`df-sound ${compact?'compact':''}`} aria-label="学习音效">
  <button className="df-sound-toggle" aria-pressed={settings.enabled} onClick={()=>void setLearningSounds(!settings.enabled)}>{settings.enabled?<Volume2 size={16}/>:<VolumeX size={16}/>}学习音效 · {settings.enabled?'开':'关'}</button>
  {!compact&&<><p>轻提示、完成反馈和收藏提示。先开启再试听；开麦或日语播放时让路，不叠加背景音乐。</p><label>音效音量<input aria-label="学习音效音量" type="range" min="0" max="100" value={Math.round(settings.volume*100)} onChange={e=>setLearningVolume(Number(e.target.value)/100)}/></label><button disabled={!settings.enabled} onClick={()=>playLearningCue('progress')}>试听完成音效</button></>}
  {settings.error&&<small role="status">{settings.error}</small>}
 </section>;
}
