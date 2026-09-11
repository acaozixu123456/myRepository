import {useEffect,useRef,useState} from 'react';
import {drawLive} from './draw';
import {sceneById,type CitySceneId} from './scenes';
import type {Quality} from '../immersion/AmbientStage';
export function CityStage({scene,motion,paused,quality,onStatus}:{scene:CitySceneId;motion:boolean;paused:boolean;quality:Quality;onStatus:(s:string)=>void}){
 const canvas=useRef<HTMLCanvasElement>(null),callback=useRef(onStatus),elapsed=useRef(0);callback.current=onStatus;
 const [assets,setAssets]=useState<{scene:CitySceneId;poster:HTMLImageElement;craft:HTMLImageElement;train:HTMLImageElement}|null>(null),[failed,setFailed]=useState(false);const sequence=useRef(0);
 useEffect(()=>{
  const id=++sequence.current;setFailed(false);callback.current('正在切换城市，语音连接保持不变。');
  const load=(path:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.decoding='async';image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('asset'));image.src=path;});
  void Promise.all([load('/city05/'+scene+'.webp'),load('/city05/av-'+(scene==='harbor'?'cargo':'sport')+'.webp'),load('/city05/maglev.webp')]).then(([poster,craft,train])=>{if(id!==sequence.current)return;setAssets({scene,poster,craft,train});callback.current('城市原画与独立动态层已就绪。');}).catch(()=>{if(id===sequence.current){setFailed(true);callback.current('新场景暂未加载，保留原来的雨夜风景；可重新加载。');}});
  return()=>{sequence.current++;};
 },[scene]);
 useEffect(()=>{
  const node=canvas.current;if(!node||!assets||failed)return;const {poster}=assets;
  const ctx=node.getContext('2d',{alpha:false});if(!ctx)return;ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  const def=sceneById(assets.scene),sprites={craft:assets.craft,train:assets.train};
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),connection=(navigator as Navigator&{connection?:EventTarget&{saveData?:boolean}}).connection;
  let frame=0,last=0,w=0,h=0,dpr=1,frames=0,slow=0,stride=1000/30,active=false;
  const layout=()=>{w=innerWidth;h=innerHeight;dpr=Math.min(devicePixelRatio||1,quality==='1080'?1:quality==='1440'?1.5:quality==='2160'?2:1.5,Math.sqrt(7000000/(w*h)));node.width=Math.round(w*dpr);node.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);};
  const paint=()=>{
   ctx.fillStyle='#070b18';ctx.fillRect(0,0,w,h);
   const rail=document.querySelector('.df-teacher')?.getBoundingClientRect();const wallpaper=document.querySelector('.imm-wallpaper');
   const viewWidth=rail&&!wallpaper?Math.min(w,rail.left+44):w;
   const scale=Math.max(viewWidth/poster.width,h/poster.height),pw=poster.width*scale,ph=poster.height*scale,x=Math.min(0,(viewWidth-pw)*.37),y=(h-ph)*.44;
   ctx.drawImage(poster,x,y,pw,ph);
   ctx.save();ctx.translate(x,y);ctx.scale(pw/1000,ph/1000);const state=drawLive(ctx,def,elapsed.current,sprites,w<700?.5:1);ctx.restore();
   if(viewWidth<w){const shade=ctx.createLinearGradient(viewWidth-50,0,Math.min(w,viewWidth+220),0);shade.addColorStop(0,'rgba(4,9,18,0)');shade.addColorStop(1,'rgba(4,9,18,.9)');ctx.fillStyle=shade;ctx.fillRect(viewWidth-50,0,w-viewWidth+50,h);}
   frames++;node.dataset.frames=String(frames);node.dataset.flightPhase=state.phase;node.dataset.flightX=String(state.flightX);node.dataset.flightY=String(state.flightY);node.dataset.trainPosition=String(state.train);node.dataset.screenPage=String(state.screen);node.dataset.scene=assets.scene;
  };
  const tick=(now:number)=>{frame=requestAnimationFrame(tick);if(!last){last=now;return;}const dt=now-last;if(dt<stride-1)return;slow=dt>90?slow+1:Math.max(0,slow-1);if(slow>12){stride=50;node.dataset.throttled='true';}elapsed.current+=Math.min(dt,100)/1000;last=now;paint();};
  const update=()=>{cancelAnimationFrame(frame);frame=0;last=0;active=motion&&!paused&&!document.hidden&&!reduced.matches&&!connection?.saveData;node.dataset.running=String(active);layout();paint();if(active)frame=requestAnimationFrame(tick);};
  const resize=()=>{layout();paint();};addEventListener('resize',resize);document.addEventListener('visibilitychange',update);reduced.addEventListener('change',update);connection?.addEventListener('change',update);update();
  return()=>{cancelAnimationFrame(frame);removeEventListener('resize',resize);document.removeEventListener('visibilitychange',update);reduced.removeEventListener('change',update);connection?.removeEventListener('change',update);};
 },[assets,motion,paused,quality,failed]);
 return <div className="c05-stage" aria-hidden="true" data-city-ready={!!assets&&!failed} data-rendered-scene={assets?.scene}><canvas ref={canvas}/><div className="c05-vignette"/></div>;
}
