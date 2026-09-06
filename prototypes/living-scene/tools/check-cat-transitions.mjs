import assert from 'node:assert/strict';
import { createCatDirector,travelPose,riseSeconds,settleSeconds,catAnchors } from '../src/cat-director.js';
const result={};
for(const initial of [0,2]) {
 const d=createCatDirector(initial,()=>.5);let previous=d.snapshot(),seen=new Set(),rising=new Set(),settling=new Set();
 for(let i=0;i<4500;i++) {
  d.update(.02);const s=d.snapshot(),v=travelPose(s.trip);
  if(v){
   seen.add(v.phase);if(v.phase==='rising'||v.phase==='turning')rising.add(v.frame);if(v.phase==='settling')settling.add(v.frame);
   assert(Number.isInteger(v.frame));
   if(v.phase==='rising'||v.phase==='turning')assert.deepEqual(s.position,catAnchors[s.trip.from].uv);
   if(v.phase==='settling')assert(Math.hypot(...s.position.map((x,j)=>x-catAnchors[s.trip.to].uv[j]))<1e-12);
   // User attention, app pause and reduced motion must preserve the exact pose and contact.
   const old=JSON.stringify([s.position,s.trip,v]);d.update(.1,{blocked:true});
   assert.equal(JSON.stringify([d.snapshot().position,d.snapshot().trip,travelPose(d.snapshot().trip)]),old);
   d.update(5,{paused:true});assert.equal(JSON.stringify([d.snapshot().position,d.snapshot().trip,travelPose(d.snapshot().trip)]),old);
  }
  assert(Math.hypot(...s.position.map((x,j)=>x-previous.position[j]))<.001);
  previous=s;if(s.arrivals)break;
 }
 assert.equal(d.snapshot().arrivals,1);assert.equal(rising.size,6);assert.equal(settling.size,6);
 assert.deepEqual([...seen],['rising','turning','walking','settling']);
 result[initial===0?'right':'left']={allPhases:true,sixRiseFrames:true,sixSettleFrames:true,grounded:true,attentionHoldsPose:true,pauseHoldsPose:true,arrived:true};
}
assert.equal(travelPose(null),null);
console.log(JSON.stringify({riseSeconds,settleSeconds,checks:result},null,2));
