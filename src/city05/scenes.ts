export type SceneId='skyport'|'canyon'|'harbor'|'rail'|'classic';
export type CitySceneId=Exclude<SceneId,'classic'>;
export type Point={x:number;y:number};
export type Billboard={x:number;y:number;w:number;h:number;slant:number;hue:number;brand:string;words:string[]};
export type SceneDefinition={id:CitySceneId;name:string;subtitle:string;color:string;music:string;native:[number,number];pad:Point;rail:[Point,Point];boards:Billboard[]};
export const SCENES:SceneDefinition[]=[
 {id:'skyport',name:'空港露台',subtitle:'SKYPORT / 午夜航班',color:'#5deaff',music:'Midnight Signals',native:[855,846],pad:{x:.64,y:.59},rail:[{x:-.1,y:.31},{x:1.1,y:.65}],boards:[{x:.276,y:.0,w:.119,h:.309,slant:.04,hue:306,brand:'NEXUS',words:['感覚を更新','NEURAL / 24H','NEXT BODY']},{x:.820,y:.0,w:.097,h:.225,slant:-.03,hue:191,brand:'ORBIT',words:['FLIGHT 07','CITY TRANSIT','OPEN / 24H']}]},
 {id:'canyon',name:'霓虹峡谷',subtitle:'NEON CANYON / 层叠街区',color:'#f66fe8',music:'Afterimage',native:[775,847],pad:{x:.62,y:.69},rail:[{x:-.13,y:.415},{x:1.13,y:.74}],boards:[{x:.156,y:.022,w:.168,h:.349,slant:.05,hue:313,brand:'HITOKOTO',words:['未来を選べ','NEW SIGNAL','MAKE YOUR CITY']},{x:.465,y:.205,w:.115,h:.277,slant:.045,hue:279,brand:'TOKYO',words:['2142 / EAST','NIGHT SERVICE','CYBER MODS']}]},
 {id:'harbor',name:'机械雨港',subtitle:'EAST HARBOR / 重工航道',color:'#ffae67',music:'Heavy Rain / Dock 07',native:[920,847],pad:{x:.445,y:.61},rail:[{x:-.13,y:.80},{x:1.13,y:.61}],boards:[{x:.224,y:.014,w:.233,h:.246,slant:.02,hue:206,brand:'BAY / 07',words:['CARGO READY','航路を確認','NEXT DEPARTURE']},{x:.743,y:.17,w:.106,h:.264,slant:.04,hue:310,brand:'EAST PORT',words:['港を越えて','ORBITAL CARGO','DOCK 03 / OPEN']}]},
 {id:'rail',name:'高架轨道',subtitle:'NIGHT RAIL / 垂直东京',color:'#ca8cff',music:'Neon Lines',native:[885,847],pad:{x:.73,y:.45},rail:[{x:-.1,y:.438},{x:1.1,y:.729}],boards:[{x:.194,y:.001,w:.116,h:.343,slant:.055,hue:287,brand:'NEURAL',words:['別の自分へ','BODY / UPGRADE','STAY HUMAN']},{x:.687,y:.096,w:.10,h:.31,slant:.045,hue:307,brand:'TOKYO',words:['NEXT / 02:14','中央環状線','NIGHT EXPRESS']}]}
];
export const CITY_SCENE_KEY='hitokoto-city05-scene';
export function validScene(value:unknown):value is SceneId{return value==='classic'||SCENES.some(s=>s.id===value);}
export function readScene(store:Pick<Storage,'getItem'>|null):SceneId{try{const value=store?.getItem(CITY_SCENE_KEY);return validScene(value)?value:'skyport';}catch{return'skyport';}}
export function saveScene(store:Pick<Storage,'setItem'>|null,id:SceneId):boolean{if(!validScene(id))return false;try{store?.setItem(CITY_SCENE_KEY,id);return !!store;}catch{return false;}}
export const sceneById=(id:SceneId):SceneDefinition=>SCENES.find(s=>s.id===id)||SCENES[0];
export const ease=(v:number)=>{const n=Math.max(0,Math.min(1,v));return n*n*(3-2*n);};
export function flightPose(seconds:number,pad:Point){
 const t=((seconds%40)+40)%40;let x=pad.x,y=pad.y,scale=.2,rotation=0,thrust=.1,phase='docked',alpha=1;
 if(t<8){const u=ease(t/8);x=1.22+(pad.x-1.22)*u;y=.14+(pad.y-.17-.14)*u;scale=.075+.125*u;rotation=-.05*Math.sin(u*Math.PI);thrust=.5;phase='arrival';}
 else if(t<13){const u=ease((t-8)/5);y=pad.y-.17+.17*u;thrust=.9-.68*u;phase='landing';}
 else if(t<19){phase='docked';}
 else if(t<25){const u=ease((t-19)/6);y=pad.y-.23*u;thrust=.22+.78*Math.sin(Math.min(1,u+.15)*Math.PI/2);phase='takeoff';}
 else if(t<36){const u=ease((t-25)/11);x=pad.x+(-.35-pad.x)*u;y=pad.y-.23-.29*u;scale=.2-.13*u;rotation=-.09*Math.sin(u*Math.PI);thrust=.72;phase='departure';alpha=1-ease((t-34)/2);}
 else{phase='away';x=-.35;y=pad.y-.52;scale=.07;alpha=0;thrust=0;}
 return{x,y,scale,rotation,thrust,phase,alpha};
}
export function transitPose(seconds:number,lane:number){const duration=14+lane*7,u=((seconds/duration+lane*.271)%1+1)%1,reverse=lane%2===1;return{x:reverse?1.2-u*1.4:-.2+u*1.4,y:.08+lane*.073+Math.sin(u*Math.PI)*.017,scale:.020+lane*.005,direction:reverse?-1:1};}
export function trainPose(seconds:number,scene:SceneDefinition){const u=((seconds/24)%1+1)%1,a=scene.rail[0],b=scene.rail[1];return{x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,rotation:Math.atan2(b.y-a.y,b.x-a.x),progress:u};}
export function screenState(seconds:number,index:number){const t=seconds+index*2.63;return{page:Math.floor(t/7)%3,scan:(t*.13)%1,brightness:.90+.075*Math.sin(t*.85+index)};}
