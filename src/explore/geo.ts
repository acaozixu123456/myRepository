import {ROAD_COORDINATES} from './roadData';
export type Point={x:number;z:number};
const radians=Math.PI/180, radius=6371008.8;
const origin=ROAD_COORDINATES[0];
const last=ROAD_COORDINATES[ROAD_COORDINATES.length-1];
const east=(lon:number)=>(lon-origin[0])*radians*radius*Math.cos(origin[1]*radians);
const north=(lat:number)=>(lat-origin[1])*radians*radius;
const length=Math.hypot(east(last[0]),north(last[1]));
const axis={x:east(last[0])/length,z:north(last[1])/length};
export const ROAD:Point[]=ROAD_COORDINATES.map(([lon,lat])=>({x:east(lon)*axis.z-north(lat)*axis.x,z:east(lon)*axis.x+north(lat)*axis.z}));
const lengths=ROAD.slice(1).map((p,i)=>Math.hypot(p.x-ROAD[i].x,p.z-ROAD[i].z));
export const ROAD_LENGTH=lengths.reduce((a,b)=>a+b,0);
export function sampleRoad(distance:number):Point&{tx:number;tz:number}{
  let s=Math.max(0,Math.min(ROAD_LENGTH,distance));
  for(let i=0;i<lengths.length;i++){
    const len=lengths[i];
    if(s<=len||i===lengths.length-1){const a=ROAD[i],b=ROAD[i+1],t=Math.min(1,s/len);return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,tx:(b.x-a.x)/len,tz:(b.z-a.z)/len};}s-=len;
  }
  return {...ROAD[0],tx:0,tz:1};
}
export function distanceToRoad(p:Point):number{
  let best=Infinity;
  for(let i=0;i<ROAD.length-1;i++){
    const a=ROAD[i],b=ROAD[i+1],dx=b.x-a.x,dz=b.z-a.z;
    const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz)));
    best=Math.min(best,Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t));
  }
  return best;
}
