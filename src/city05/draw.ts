import {flightPose,transitPose,trainPose,screenState,type SceneDefinition,type Billboard} from './scenes';
type C=CanvasRenderingContext2D;
export type CitySprites={craft:CanvasImageSource;train:CanvasImageSource};
function drawBillboard(c:C,b:Billboard,t:number,index:number){
 const s=screenState(t,index),x=b.x*1000,y=b.y*1000,w=b.w*1000,h=b.h*1000;
 c.save();c.transform(1,b.slant,0,1,x,y);c.beginPath();c.rect(0,0,w,h);c.clip();
 // Preserve the illustrated ad: animate its emissive material, scan and lower ticker.
 c.globalCompositeOperation='screen';c.fillStyle=`hsla(${b.hue},100%,66%,${.025+.025*s.brightness})`;c.fillRect(0,0,w,h);
 const yScan=s.scan*h,scan=c.createLinearGradient(0,yScan-5,0,yScan+5);scan.addColorStop(0,'rgba(90,214,255,0)');scan.addColorStop(.5,`hsla(${b.hue},100%,80%,.29)`);scan.addColorStop(1,'rgba(90,214,255,0)');c.fillStyle=scan;c.fillRect(0,yScan-5,w,10);
 c.globalCompositeOperation='source-over';
 const footer=c.createLinearGradient(0,h*.73,0,h);footer.addColorStop(0,'rgba(1,4,12,0)');footer.addColorStop(.3,'rgba(1,4,12,.73)');footer.addColorStop(1,'rgba(1,4,12,.88)');c.fillStyle=footer;c.fillRect(0,h*.73,w,h*.27);
 c.textAlign='center';c.fillStyle=`hsl(${b.hue},95%,82%)`;c.font=`600 ${Math.min(12,w*.115)}px monospace`;c.fillText(b.brand,w/2,h*.83,w*.94);
 c.fillStyle='#f0edff';c.font=`500 ${Math.min(9,w*.088)}px sans-serif`;c.fillText(b.words[s.page],w/2,h*.92,w*.91);
 c.fillStyle=`hsla(${b.hue},100%,70%,.65)`;c.fillRect(0,h-1.5,w*s.scan,1.5);c.restore();
}
function ship(c:C,sprite:CanvasImageSource,x:number,y:number,size:number,rotation:number,thrust:number,alpha=1,direction=1){
 c.save();c.translate(x,y);c.rotate(rotation);c.scale(direction,1);c.globalAlpha=alpha;
 if(thrust>.12)for(const ex of [-size*.14,size*.19]){
  const g=c.createLinearGradient(ex,0,ex,size*.25);g.addColorStop(0,`rgba(181,235,255,${thrust*.42})`);g.addColorStop(.24,`rgba(71,159,255,${thrust*.14})`);g.addColorStop(1,'rgba(29,98,230,0)');c.fillStyle=g;
  c.beginPath();c.moveTo(ex-size*.008,0);c.lineTo(ex+size*.025,size*.25);c.lineTo(ex-size*.025,size*.25);c.closePath();c.fill();
 }
 c.drawImage(sprite,-size/2,-size*.17,size,size*.375);c.restore();
}
/** Objects are precise photographic cutouts from the approved art, not flat placeholders. */
export function drawLive(c:C,scene:SceneDefinition,t:number,sprites:CitySprites,intensity:number){
 scene.boards.forEach((b,i)=>drawBillboard(c,b,t,i));
 for(let i=0;i<5;i++){const p=transitPose(t,i);ship(c,sprites.craft,p.x*1000,p.y*1000,p.scale*1000,0,.24,.92,p.direction);}
 const p=flightPose(t+4,scene.pad);ship(c,sprites.craft,p.x*1000,p.y*1000,p.scale*1000,p.rotation,p.thrust,p.alpha);
 const tr=trainPose(t,scene);
 if(scene.id==='rail'||scene.id==='canyon'){
  c.save();c.translate(tr.x*1000,tr.y*1000);c.rotate(tr.rotation);c.drawImage(sprites.train,-118,-15,236,23);c.restore();
 }else if(scene.id==='skyport')for(let i=0;i<3;i++){const car=trainPose(t+i*8,scene);ship(c,sprites.craft,car.x*1000,car.y*1000,58,car.rotation*.2,.18,.86);}
 const count=Math.round(30*intensity);for(let i=0;i<count;i++){const x=((i*.173+t*.014)%1)*1000,y=((i*.291+t*(.039+i%3*.009))%1)*1000;c.strokeStyle=i%3?'rgba(153,205,245,.16)':'rgba(246,143,245,.16)';c.lineWidth=.7;c.beginPath();c.moveTo(x,y);c.lineTo(x+1.7,y+10+i%7);c.stroke();}
 return{phase:p.phase,flightX:p.x,flightY:p.y,train:tr.progress,screen:screenState(t,0).page};
}
