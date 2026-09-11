import {useEffect,useRef} from 'react';
export type AtmosphereLevel='off'|'gentle'|'rich';
/** Decorative weather only. One bounded canvas, no audio, microphone, network or extra video. */
export function DesktopAtmosphere({enabled,level}:{enabled:boolean;level:AtmosphereLevel}){
 const canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const el=canvas.current,ctx=el?.getContext('2d');if(!el||!ctx)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),connection=(navigator as Navigator&{connection?:EventTarget&{saveData?:boolean}}).connection;
  let frame=0,last=0,time=0,width=0,height=0,active=false,dead=false,count=0,slow=0,interval=1000/30;
  const rich=level==='rich',drops=Array.from({length:rich?230:80},(_,i)=>({x:(i*.61803398875)%1,y:(i*.4142135623)%1,depth:(i%23)/23}));
  const resize=()=>{width=innerWidth;height=innerHeight;const ratio=Math.max(.5,Math.min(devicePixelRatio||1,2,Math.sqrt(5000000/Math.max(1,width*height))));el.width=Math.round(width*ratio);el.height=Math.round(height*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);};
  const haze=(x:number,y:number,rx:number,ry:number,alpha:number)=>{ctx.save();ctx.translate(x,y);ctx.scale(rx,ry);const g=ctx.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,`rgba(103,183,215,${alpha})`);g.addColorStop(1,'rgba(85,140,192,0)');ctx.fillStyle=g;ctx.fillRect(-1,-1,2,2);ctx.restore();};
  const draw=()=>{
   ctx.clearRect(0,0,width,height);
   for(let i=0;i<(rich?5:3);i++)haze(width*(.12+i*.22+Math.sin(time*.11+i*1.9)*.18),height*(.23+.11*(i%3)+Math.sin(time*.08+i)*.045),width*.3,height*(.06+.025*(i%2)),rich?.12:.045);
   ctx.lineCap='round';
   for(const d of drops){const speed=85+d.depth*390,length=8+d.depth*d.depth*(rich?64:30),y=(d.y*height+time*speed)%(height+120)-60,x=(d.x*width+time*speed*.13)%(width+120)-60;ctx.strokeStyle=`rgba(186,224,245,${.055+d.depth*(rich?.34:.15)})`;ctx.lineWidth=d.depth>.85?1.4:.7;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+length*.2,y+length);ctx.stroke();}
   for(let i=0;i<(rich?18:5);i++){const x=width*(.02+(i*.173)% .96),y=(i*.217*height+time*(12+i%5*3))%(height+180)-90;const g=ctx.createLinearGradient(x,y-64,x,y);g.addColorStop(0,'rgba(174,221,243,0)');g.addColorStop(1,'rgba(174,221,243,.24)');ctx.strokeStyle=g;ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(x-.5,y-64);ctx.lineTo(x,y-8);ctx.stroke();ctx.strokeStyle='rgba(200,233,250,.4)';ctx.beginPath();ctx.ellipse(x,y,2+i%3*.4,4.5+i%4,0,Math.PI*.75,Math.PI*1.85);ctx.stroke();}
   el.dataset.renderedFrames=String(++count);
  };
  const tick=(now:number)=>{if(dead||!active)return;frame=requestAnimationFrame(tick);if(!last){last=now;return;}const dt=now-last;if(dt<interval-1)return;slow=dt>100?slow+1:Math.max(0,slow-1);if(slow>10){interval=50;el.dataset.throttled='true';}time+=Math.min(dt,100)/1000;last=now;draw();};
  const update=()=>{cancelAnimationFrame(frame);last=0;active=enabled&&level!=='off'&&!document.hidden&&!reduced.matches&&!connection?.saveData;el.dataset.running=String(active);if(active){resize();frame=requestAnimationFrame(tick);}else ctx.clearRect(0,0,width,height);};
  addEventListener('resize',resize);document.addEventListener('visibilitychange',update);reduced.addEventListener('change',update);connection?.addEventListener('change',update);update();
  return()=>{dead=true;cancelAnimationFrame(frame);removeEventListener('resize',resize);document.removeEventListener('visibilitychange',update);reduced.removeEventListener('change',update);connection?.removeEventListener('change',update);ctx.clearRect(0,0,width,height);};
 },[enabled,level]);
 return <canvas ref={canvas} className="df-atmosphere" aria-hidden="true" data-atmosphere={level}/>;
}
