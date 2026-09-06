// Authored dry-step paths. No road navigation or arbitrary target seeking.
export const catAnchors = [
  { id:'post', uv:[.69,.24], next:[1] },
  { id:'sill', uv:[.74,.229], next:[0,2] },
  { id:'eaves', uv:[.79,.215], next:[1] },
];
// Discrete authored poses: no whole-animal crossfade between incompatible silhouettes.
export const riseSeconds=1.35,settleSeconds=1.5;
export function travelPose(trip) {
  if(!trip)return null;
  const offset=trip.direction==='right'?6:0;
  if(trip.elapsed<riseSeconds) {
    const frame=Math.min(5,Math.floor(trip.elapsed/riseSeconds*6));
    return {phase:frame<3?'rising':'turning',family:'transition',frame:offset+frame};
  }
  if(trip.elapsed>=riseSeconds+trip.duration) {
    const frame=5-Math.min(5,Math.floor((trip.elapsed-riseSeconds-trip.duration)/settleSeconds*6));
    return {phase:'settling',family:'transition',frame:offset+frame};
  }
  return {phase:'walking',family:'walk',frame:(trip.direction==='right'?4:0)+Math.floor(trip.distance/.014*4)%4};
}
export function createCatDirector(initial=0,random=Math.random) {
  let anchorIndex=initial%catAnchors.length,position=[...catAnchors[anchorIndex].uv];
  let clock=0,idle=0,nextMove=45+random()*25,nextLook=12+random()*12,trip=null,arrivals=0;
  const range=(a,b)=>a+(b-a)*random();
  function attend() {
    idle=0;nextMove=Math.max(nextMove,clock+range(35,60));nextLook=clock+range(12,24);
  }
  function update(dt,{blocked=false,resting=false,paused=false}={}) {
    if(paused)return null;
    clock+=dt;
    if(blocked){attend();return null;}
    idle+=dt;
    if(trip){
      trip.elapsed+=dt;
      const progress=Math.max(0,Math.min(1,(trip.elapsed-riseSeconds)/trip.duration));
      // Ease the first/last 12% of the path, retaining a steady walking middle.
      const ease=t=>t<.12?t*t/.24:t>.88?.88-(1-t)*(1-t)/.24:t-.06;
      const distance=ease(progress)/.88;
      const a=catAnchors[trip.from].uv,b=catAnchors[trip.to].uv;
      position=[a[0]+(b[0]-a[0])*distance,a[1]+(b[1]-a[1])*distance];
      trip.distance=Math.hypot(position[0]-a[0],position[1]-a[1]);
      if(trip.elapsed>=trip.duration+riseSeconds+settleSeconds){
        anchorIndex=trip.to;position=[...b];trip=null;arrivals++;idle=0;
        nextMove=clock+range(65,110);nextLook=clock+range(12,24);
        return random()<.45?'rest':'arrived';
      }
      return null;
    }
    if(clock>=nextMove && idle>8){
      const next=catAnchors[anchorIndex].next,to=next[Math.floor(random()*next.length)];
      const a=position,b=catAnchors[to].uv;
      trip={from:anchorIndex,to,elapsed:0,duration:Math.hypot(b[0]-a[0],b[1]-a[1])/.012,direction:b[0]>a[0]?'right':'left',distance:0};
      return 'depart';
    }
    if(!resting && clock>=nextLook){
      nextLook=clock+range(20,38);
      const r=random();return r<.30?'glance':r<.45?'rest':null;
    }
    return null;
  }
  return {attend,update,snapshot:()=>({clock,idle,anchorIndex,position:[...position],trip:trip?{...trip}:null,arrivals,nextMove})};
}
