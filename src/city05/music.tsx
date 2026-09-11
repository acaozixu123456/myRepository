import {useSyncExternalStore} from 'react';
import {Music2,Pause,Volume2} from 'lucide-react';
import {sceneById,type SceneId} from './scenes';
type MusicState={enabled:boolean;volume:number;scene:SceneId;status:'off'|'loading'|'playing'|'priority'|'blocked';error:string};
let state:MusicState={enabled:false,volume:.18,scene:'skyport',status:'off',error:''};
let audio:HTMLAudioElement|null=null,epoch=0,timer:ReturnType<typeof setInterval>|undefined,bound=false,gate={micOn:false,outputBusy:false,studying:false},hushUntil=0,cueUntil=0;
const subs=new Set<()=>void>();const snapshot=()=>state;const subscribe=(f:()=>void)=>{subs.add(f);return()=>{subs.delete(f);};};
const notify=(patch:Partial<MusicState>)=>{const next={...state,...patch};if(JSON.stringify(next)!==JSON.stringify(state)){state=next;for(const f of subs)f();}};
export const clampVolume=(n:number)=>Number.isFinite(n)?Math.max(0,Math.min(.65,n)):0;
export function musicLevel(enabled:boolean,volume:number,flags:{hidden:boolean;micOn:boolean;outputBusy:boolean;otherSpeech:boolean;studying:boolean;cue:boolean}){
 if(!enabled||flags.hidden||flags.micOn||flags.otherSpeech)return 0;
 return clampVolume(volume)*(flags.outputBusy ? .08 : flags.studying ? .24 : flags.cue ? .18 : 1);
}
function otherSpeech(){return Array.from(document.querySelectorAll('audio')).some(el=>!el.srcObject&&!el.muted&&!el.paused&&!el.ended&&el.volume>0);}
function desired(){return musicLevel(state.enabled,state.volume,{hidden:document.hidden,micOn:gate.micOn||performance.now()<hushUntil,outputBusy:gate.outputBusy,studying:gate.studying,otherSpeech:otherSpeech(),cue:performance.now()<cueUntil});}
function apply(){
 if(!audio)return;const target=desired();
 if(gate.micOn||document.hidden||!state.enabled||state.volume<=0||otherSpeech())audio.volume=0;else audio.volume=Math.abs(audio.volume-target)<.002?target:audio.volume+(target-audio.volume)*(target<audio.volume?.65:.13);
 if(state.enabled&&audio.readyState>=2&&!audio.paused)notify({status:target<state.volume*.4?'priority':'playing'});
}
export function updateCityMusicGate(next:Partial<typeof gate>){gate={...gate,...next};apply();}
export function hushCityMusic(ms=650){hushUntil=Math.max(hushUntil,performance.now()+ms);if(audio)audio.volume=0;}
function bind(){if(bound)return;bound=true;
 document.addEventListener('play',e=>{const el=e.target;if(el instanceof HTMLMediaElement&&!el.srcObject&&!el.muted&&el.volume>0)hushCityMusic(350);},true);
 document.addEventListener('hitokoto:learning-cue',()=>{cueUntil=performance.now()+600;apply();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){if(audio){audio.volume=0;audio.pause();}}else if(state.enabled&&audio)void audio.play().then(apply).catch(()=>notify({status:'blocked',error:'背景音乐等待播放，点关闭后重新开启即可。'}));});
 addEventListener('pagehide',disposeCityMusic);
}
function getAudio(){if(!audio){audio=new Audio();audio.loop=true;audio.preload='none';audio.dataset.cityMusic='true';audio.setAttribute('playsinline','');audio.volume=0;}return audio;}
export async function setCityMusic(enabled:boolean,scene:SceneId=state.scene){
 const current=++epoch;if(!enabled){stopCityMusic();return;}bind();const element=getAudio();element.pause();element.volume=0;const def=sceneById(scene);notify({enabled:true,scene,status:'loading',error:''});element.src='/city05/'+def.id+'.mp3';element.load();
 try{await element.play();if(current!==epoch){if(!state.enabled)element.pause();return;}clearInterval(timer);timer=setInterval(apply,90);apply();}
 catch{if(current!==epoch)return;clearInterval(timer);timer=undefined;element.pause();notify({enabled:false,status:'blocked',error:'背景音乐暂时不能播放；日语语音不受影响。再点开启可以重试。'});}
}
export function stopCityMusic(){epoch++;clearInterval(timer);timer=undefined;if(audio){audio.volume=0;audio.pause();}notify({enabled:false,status:'off',error:''});}
export function disposeCityMusic(){stopCityMusic();if(audio){audio.removeAttribute('src');audio.load();audio=null;}gate={micOn:false,outputBusy:false,studying:false};}
export function changeCityMusicScene(scene:SceneId){if(state.enabled)void setCityMusic(true,scene);else notify({scene});}
export function setCityMusicVolume(volume:number){notify({volume:clampVolume(volume)});apply();}
export function CityMusicControl({compact=false,scene}:{compact?:boolean;scene?:SceneId}){
 const s=useSyncExternalStore(subscribe,snapshot,snapshot);const def=sceneById(scene||s.scene);
 return <section className={'c05-music '+(compact?'compact':'')} aria-label="背景音乐控制"><button type="button" aria-label={s.enabled?'关闭背景音乐':'开启背景音乐'} aria-pressed={s.enabled} onClick={()=>void setCityMusic(!s.enabled,scene||s.scene)}>{s.enabled?<Pause size={15}/>:<Music2 size={16}/>}<span>{compact?(s.enabled?'音乐 · 开':'音乐 · 关'):s.enabled?'关闭背景音乐':'开启背景音乐'}</span>{s.enabled&&<i className={s.status==='playing'?'c05-eq active':'c05-eq'} aria-hidden="true"/>}</button>
 {!compact&&<><strong>{def.music}</strong><p>原创氛围电子音乐。无歌词、独立音量；开麦时静音，日语播放时自动让路。</p><label><Volume2 size={15}/>音乐音量<input aria-label="背景音乐音量" type="range" min="0" max="65" value={Math.round(s.volume*100)} onChange={e=>setCityMusicVolume(Number(e.target.value)/100)}/><span>{Math.round(s.volume*100)}%</span></label><small role="status">{s.status==='loading'?'正在载入音乐…':s.status==='priority'?'日语优先 · 音乐正在让路':s.status==='playing'?'正在播放 · 原创循环':s.error||'默认关闭；本次开启，不会下次自动响起。'}</small></>}
 {compact&&s.error&&<span className="c05-music-error" role="status">音乐暂不可用</span>}</section>;
}
