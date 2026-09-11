import {useEffect,useRef,useState} from 'react';
export type Quality='auto'|'1080'|'1440'|'2160';
type Variant={path:string;width:number;height:number;bytes:number;sha256:string};
type Orientation={poster:Variant;video:Record<'1080'|'1440'|'2160',Variant>};
export type AmbientManifest={release:string;title:string;duration:number;fps:number;source:string;landscape:Orientation;portrait:Orientation};
export const AMBIENT_MANIFEST='/ambient/immersion03/manifest.json';
export function validManifest(v:unknown):v is AmbientManifest{
 if(!v||typeof v!=='object')return false;const m=v as AmbientManifest;
 const asset=(a:Variant)=>a&&typeof a.path==='string'&&/^\/ambient\/immersion03\/[a-f0-9]{12}[-\w]+\.(mp4|webp)$/.test(a.path)&&Number.isFinite(a.width)&&a.width>0&&a.height>0&&a.width<=4096&&a.height<=4096&&a.bytes>0&&/^[a-f0-9]{64}$/.test(a.sha256);
 return m.release==='immersion03-city-v1'&&m.duration>=12&&m.duration<=20&&m.fps===30&&[m.landscape,m.portrait].every(o=>o&&asset(o.poster)&&['1080','1440','2160'].every(q=>asset(o.video[q as keyof typeof o.video])));
}
/** One silent decoder, separate from every speech element and every microphone operation. */
export function AmbientStage({quality,motion,paused,onStatus}:{quality:Quality;motion:boolean;paused:boolean;onStatus:(text:string)=>void}){
 const [manifest,setManifest]=useState<AmbientManifest|null>(null),[portrait,setPortrait]=useState(()=>innerHeight>innerWidth),[tier,setTier]=useState<'1080'|'1440'|'2160'>('1080'),[loaded,setLoaded]=useState(false),[hidden,setHidden]=useState(document.hidden),[retry,setRetry]=useState(0);
 const video=useRef<HTMLVideoElement>(null),particles=useRef<HTMLCanvasElement>(null),callback=useRef(onStatus);callback.current=onStatus;
 useEffect(()=>{const a=new AbortController();void fetch(AMBIENT_MANIFEST,{signal:a.signal}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(m=>{if(!validManifest(m))throw Error();setManifest(m);}).catch(()=>{if(!a.signal.aborted)callback.current('高清风景暂未加载，聊天照常；可在风景设置重试。');});return()=>a.abort();},[retry]);
 useEffect(()=>{const resize=()=>setPortrait(innerHeight>innerWidth);const visibility=()=>setHidden(document.hidden);addEventListener('resize',resize);document.addEventListener('visibilitychange',visibility);return()=>{removeEventListener('resize',resize);document.removeEventListener('visibilitychange',visibility);};},[]);
 useEffect(()=>{let stopped=false;setTier(quality==='auto'?'1080':quality);if(quality==='auto'&&!portrait&&navigator.mediaCapabilities&&manifest){const v=manifest.landscape.video['1440'];void navigator.mediaCapabilities.decodingInfo({type:'file',video:{contentType:'video/mp4; codecs="avc1.640033"',width:v.width,height:v.height,bitrate:Math.ceil(v.bytes*8/manifest.duration),framerate:30}}).then(c=>{if(!stopped&&c.supported&&c.smooth&&c.powerEfficient)setTier('1440');}).catch(()=>{});}return()=>{stopped=true;};},[quality,portrait,manifest]);
 const scene=manifest?.[portrait?'portrait':'landscape'],asset=scene?.video[tier];
 useEffect(()=>{const el=video.current;if(!el||!asset)return;setLoaded(false);let timer:ReturnType<typeof setTimeout>;el.pause();el.removeAttribute('src');el.load();if(!motion)return;
  timer=setTimeout(()=>{el.src=asset.path;el.load();if(motion&&!paused&&!document.hidden)void el.play().catch(()=>callback.current('动态风景等待播放，可点风景设置重新启用；语音不受影响。'));},400);
  return()=>{clearTimeout(timer);el.pause();el.removeAttribute('src');el.load();};
 },[asset?.path,retry,motion]);
 useEffect(()=>{const el=video.current;if(!el)return;if(!motion||paused||hidden)el.pause();else if(el.currentSrc)void el.play().catch(()=>{});},[motion,paused,hidden,asset?.path]);
 useEffect(()=>{const el=video.current;if(!el||!asset||!motion||paused||hidden)return;let prior={total:0,dropped:0},bad=0;
 const timer=setInterval(()=>{if(el.paused||typeof el.getVideoPlaybackQuality!=='function')return;const q=el.getVideoPlaybackQuality();const total=q.totalVideoFrames-prior.total,drop=q.droppedVideoFrames-prior.dropped;prior={total:q.totalVideoFrames,dropped:q.droppedVideoFrames};if(total>50&&drop/total>.10)bad++;else bad=0;if(bad>=2){bad=0;if(tier!=='1080'){setTier(tier==='2160'?'1440':'1080');callback.current('风景已自动降低一档，优先保持聊天流畅。');}else{el.pause();callback.current('当前设备播放有压力，已保留高清静帧；可重新启用动态。');}}},5000);return()=>clearInterval(timer);},[asset?.path,motion,paused,hidden,tier]);
 useEffect(()=>{const c=particles.current;if(!c||!motion||paused||hidden)return;const ctx=c.getContext('2d');if(!ctx)return;let frame=0,last=0;const dots=Array.from({length:36},(_,i)=>({x:((i*73.71)%100)/100,y:((i*31.17)%100)/100,r:1+(i%3),speed:.002+(i%5)*.0003}));
 const draw=(now:number)=>{frame=requestAnimationFrame(draw);if(now-last<33)return;last=now;const w=c.clientWidth,h=c.clientHeight;if(c.width!==w||c.height!==h){c.width=w;c.height=h;}ctx.clearRect(0,0,w,h);for(const [i,d] of dots.entries()){const x=(d.x+Math.sin(now/21000+i)*.04)*w,y=((d.y+now*d.speed/1000)%1)*h;ctx.fillStyle=i%3?'rgba(110,203,255,.16)':'rgba(255,88,179,.15)';ctx.beginPath();ctx.arc(x,y,d.r,0,Math.PI*2);ctx.fill();}};frame=requestAnimationFrame(draw);return()=>{cancelAnimationFrame(frame);ctx.clearRect(0,0,c.width,c.height);};},[motion,paused,hidden]);
 return <div className="imm-ambient" aria-hidden="true" data-ambient-quality={tier} data-ambient-loaded={loaded} data-ambient-source={manifest?.source||'loading'}>{scene&&<img src={scene.poster.path} alt="" className="imm-poster" fetchPriority="high"/>}<video ref={video} muted loop playsInline preload="none" className={loaded?'ready':''} onPlaying={()=>setLoaded(true)} onError={()=>{setLoaded(false);callback.current('动态暂不可用，已回退高清静帧。');}}/><div className="imm-ambient-shade"/><canvas ref={particles} className="imm-particles"/><button hidden tabIndex={-1} onClick={()=>setRetry(v=>v+1)}/></div>;
}
