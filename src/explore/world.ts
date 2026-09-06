import {Engine} from '@babylonjs/core/Engines/engine';
import {Scene} from '@babylonjs/core/scene';
import {FreeCamera} from '@babylonjs/core/Cameras/freeCamera';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import {Color3, Color4} from '@babylonjs/core/Maths/math.color';
import {HemisphericLight} from '@babylonjs/core/Lights/hemisphericLight';
import {DirectionalLight} from '@babylonjs/core/Lights/directionalLight';
import {Mesh} from '@babylonjs/core/Meshes/mesh';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import {DynamicTexture} from '@babylonjs/core/Materials/Textures/dynamicTexture';
import {TransformNode} from '@babylonjs/core/Meshes/transformNode';
import {ShadowGenerator} from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import {Ray} from '@babylonjs/core/Culling/ray';
import '@babylonjs/core/Collisions/collisionCoordinator';

import {ROAD, ROAD_LENGTH, sampleRoad, distanceToRoad} from './geo';
import type {Progress} from './state';

export type TargetId='shop'|'guide'|'menu'|'notice'|'cat';
export type Target={id:TargetId;label:string;point:Vector3;radius:number};
export type World={
  pause:(v:boolean)=>void;setMove:(x:number,y:number)=>void;look:(dx:number,dy:number)=>void;
  interact:()=>void;setProgress:(p:Progress)=>void;getPose:()=>Progress['pose'];
  resetPosition:()=>void;dispose:()=>void;diagnostics:()=>Record<string,unknown>;
};
export function createWorld(canvas:HTMLCanvasElement,initial:Progress,events:{near:(t:Target|null)=>void;interact:(id:TargetId)=>void;lock:(v:boolean)=>void;lost:()=>void}):World{
  const coarse=matchMedia('(pointer: coarse)').matches;
  const engine=new Engine(canvas,true,{preserveDrawingBuffer:false,stencil:true,audioEngine:false,powerPreference:'high-performance'});
  engine.setHardwareScalingLevel(1/Math.min(devicePixelRatio||1,coarse?1.15:1.5));
  const scene=new Scene(engine);
  scene.clearColor=new Color4(.78,.87,.86,1);
  scene.fogMode=Scene.FOGMODE_EXP2;scene.fogColor=new Color3(.78,.86,.83);scene.fogDensity=.0085;
  scene.collisionsEnabled=true;
  scene.imageProcessingConfiguration.contrast=1.08;
  scene.imageProcessingConfiguration.exposure=1.08;
  const camera=new FreeCamera('eyes',new Vector3(0,1.68,8),scene);
  camera.minZ=.065;camera.maxZ=220;camera.fov=.97;camera.inputs.clear();
  const hemi=new HemisphericLight('sky',new Vector3(0,1,0),scene);hemi.intensity=.83;hemi.groundColor=Color3.FromHexString('#a69678');
  const sun=new DirectionalLight('afternoon',new Vector3(-.65,-1,.45),scene);sun.position=new Vector3(35,60,10);sun.intensity=1.5;sun.diffuse=Color3.FromHexString('#fff0d8');
  sun.shadowMinZ=1;sun.shadowMaxZ=160;sun.autoCalcShadowZBounds=true;
  const shadows=new ShadowGenerator(coarse?1024:2048,sun);shadows.usePercentageCloserFiltering=true;shadows.filteringQuality=ShadowGenerator.QUALITY_LOW;shadows.bias=.002;shadows.normalBias=.025;shadows.setDarkness(.28);
  const mats=new Map<string,StandardMaterial>();
  function mat(color:string){let m=mats.get(color);if(!m){m=new StandardMaterial('m'+color,scene);m.diffuseColor=Color3.FromHexString(color);m.specularColor=new Color3(.055,.055,.045);mats.set(color,m);}return m;}
  let serial=0;const batches:Mesh[]=[];const animated:TransformNode[]=[];
  const blocked:Mesh[]=[];
  function finish(mesh:Mesh,color:string,parent?:TransformNode,collision=false,merge=true){
    mesh.material=mat(color);if(parent)mesh.parent=parent;mesh.receiveShadows=true;
    if(collision){mesh.checkCollisions=true;mesh.metadata={blocker:true};blocked.push(mesh);}else if(merge)batches.push(mesh);
    return mesh;
  }
  function box(w:number,h:number,d:number,x:number,y:number,z:number,color:string,parent?:TransformNode,collision=false,merge=true){const m=MeshBuilder.CreateBox('b'+serial++,{width:w,height:h,depth:d},scene);m.position.set(x,y,z);return finish(m,color,parent,collision,merge);}
  function sphere(rx:number,ry:number,rz:number,x:number,y:number,z:number,color:string,parent?:TransformNode,merge=true){const m=MeshBuilder.CreateSphere('s'+serial++,{diameter:2,segments:12},scene);m.scaling.set(rx,ry,rz);m.position.set(x,y,z);return finish(m,color,parent,false,merge);}
  function cyl(d1:number,d2:number,h:number,x:number,y:number,z:number,color:string,parent?:TransformNode,merge=true){const m=MeshBuilder.CreateCylinder('c'+serial++,{diameterTop:d1,diameterBottom:d2,height:h,tessellation:12},scene);m.position.set(x,y,z);return finish(m,color,parent,false,merge);}
  function tube(points:Vector3[],radius:number,color:string,parent?:TransformNode){return finish(MeshBuilder.CreateTube('t'+serial++,{path:points,radius,tessellation:6},scene),color,parent);}
  function label(text:string,w:number,h:number,x:number,y:number,z:number,bg:string,fg:string,parent?:TransformNode,sub=''){
    const texture=new DynamicTexture('sign'+serial++,{width:Math.round(w*160),height:Math.round(h*160)},scene,false);
    const ctx=texture.getContext() as CanvasRenderingContext2D,size=texture.getSize();ctx.fillStyle=bg;ctx.fillRect(0,0,size.width,size.height);ctx.fillStyle=fg;
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`600 ${Math.round(size.height*(sub?.43:.60))}px "Noto Sans CJK JP", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif`;
    ctx.fillText(text,size.width/2,size.height*(sub?.39:.5),size.width*.9);
    if(sub){ctx.font=`${Math.round(size.height*.17)}px sans-serif`;ctx.fillText(sub,size.width/2,size.height*.78,size.width*.85);}texture.update();
    const material=new StandardMaterial('ink'+serial++,scene);material.diffuseTexture=texture;material.specularColor=Color3.Black();material.emissiveColor=new Color3(.13,.13,.11);material.backFaceCulling=false;
    const plane=MeshBuilder.CreatePlane('text'+serial++,{width:w,height:h,sideOrientation:Mesh.DOUBLESIDE},scene);plane.material=material;plane.position.set(x,y,z);if(parent)plane.parent=parent;return plane;
  }
  // Small procedural materials are generated locally; no image CDN, map tiles or external fonts at runtime.
  const roadMat=mat('#b0a18a');const roadTex=new DynamicTexture('paving',{width:512,height:512},scene,false);const c=roadTex.getContext();
  c.fillStyle='#b4a58f';c.fillRect(0,0,512,512);let seed=19;const rand=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
  for(let i=0;i<14000;i++){const v=110+Math.floor(rand()*90);c.fillStyle=`rgba(${v},${v*.94},${v*.82},.24)`;c.fillRect(rand()*512,rand()*512,1+rand()*2,1+rand()*2);}
  c.strokeStyle='rgba(100,91,75,.2)';c.lineWidth=1;for(let y=0;y<512;y+=64){c.beginPath();c.moveTo(0,y);c.lineTo(512,y);c.stroke();for(let x=(y%128?32:0);x<512;x+=128){c.beginPath();c.moveTo(x,y);c.lineTo(x,y+64);c.stroke();}}
  roadTex.update();roadTex.uScale=1.3;roadTex.vScale=4;roadMat.diffuseTexture=roadTex;
  box(230,.2,270,0,-.23,80,'#b6bd99',undefined,true);
  for(let i=0;i<ROAD.length-1;i++){
    const a=ROAD[i],b=ROAD[i+1],len=Math.hypot(b.x-a.x,b.z-a.z),root=new TransformNode('road'+i,scene);root.position.set((a.x+b.x)/2,-.04,(a.z+b.z)/2);root.rotation.y=Math.atan2(b.x-a.x,b.z-a.z);
    const paving=box(7.3,.1,len+.18,0,0,0,'#b0a18a',root,true);paving.material=roadMat;
    for(const side of [-1,1]){box(.24,.15,len+.1,side*3.7,.035,0,'#d5c7af',root);box(.18,.04,len,side*3.48,.071,0,'#857f70',root);}
  }
  const targets:Target[]=[];
  const global=(root:TransformNode,p:Vector3)=>Vector3.TransformCoordinates(p,root.computeWorldMatrix(true));
  function plant(root:TransformNode,x:number,z:number,scale=1){
    cyl(.44*scale,.32*scale,.45*scale,x,.23*scale,z,'#bc8264',root);
    sphere(.26*scale,.1*scale,.26*scale,x,.46*scale,z,'#5d6540',root);
    for(let i=0;i<6;i++){const angle=i*Math.PI/3;const leaf=sphere(.13*scale,.36*scale,.055*scale,x+Math.cos(angle)*.16*scale,.72*scale,z+Math.sin(angle)*.16*scale,i%2?'#658767':'#80905c',root);leaf.rotation.z=Math.cos(angle)*.4;leaf.rotation.y=-angle;}
  }
  function windowFrame(root:TransformNode,x:number,y:number,w:number,h:number,z:number){
    box(w+.12,h+.12,.14,x,y,z,'#66594c',root);box(w,h,.06,x,y,z-.09,'#aec8bf',root);
    box(.05,h,.08,x,y,z-.15,'#efdfc2',root);box(w,.045,.08,x,y-.05,z-.15,'#efdfc2',root);
    // Glazing highlight and recessed sill.
    box(w*.36,h*.82,.02,x-w*.28,y+.025,z-.14,'#c3d5c8',root);box(w+.22,.11,.34,x,y-h/2-.08,z-.08,'#786e59',root);
  }
  function roof(root:TransformNode,w:number,h:number,d:number,color:string){
    const slope=.30,half=d/2;for(const sign of [-1,1]){const panel=box(w+.7,.18,half/Math.cos(slope)+.2,0,h+.55,half+sign*half/2-.2,color,root);panel.rotation.x=sign*slope;
      for(let x=-w/2-.3;x<w/2+.35;x+=.3){const rib=cyl(.075,.075,half/Math.cos(slope)+.28,x,h+.65,half+sign*half/2-.2,color,root);rib.rotation.x=Math.PI/2+sign*slope;}}
    box(w+.9,.17,.22,0,h+.09,-.5,color,root);box(w+.85,.14,.22,0,h+1.05,half-.2,color,root);
  }
  const palettes=[['#e8dcc1','#6d7b76','#365c58'],['#ead4bb','#9e7059','#a66145'],['#d9dfcc','#717b68','#6b805c'],['#e7d7c3','#727980','#35556b'],['#cfbca7','#776856','#78564c']];
  let shopRoot:TransformNode|null=null,keeper:TransformNode|null=null;
  let receiptBag:TransformNode|null=null,steam:Mesh[]=[];
  function person(root:TransformNode,x:number,z:number,coat:string,apron=false):TransformNode{
    const group=new TransformNode('person'+serial++,scene);group.parent=root;group.position.set(x,0,z);
    // A consistent hand-built stylized character, not a photorealistic or rigged asset.
    box(.15,.44,.20,-.115,.25,0,'#3b474b',group,false,false);box(.15,.44,.20,.115,.25,0,'#3b474b',group,false,false);
    box(.18,.10,.29,-.115,.05,-.045,'#ede1c9',group,false,false);box(.18,.10,.29,.115,.05,-.045,'#ede1c9',group,false,false);
    sphere(.30,.38,.18,0,.91,0,coat,group,false);
    for(const sign of [-1,1]){const arm=cyl(.12,.14,.49,sign*.33,.89,0,coat,group,false);arm.rotation.z=sign*.15;sphere(.075,.1,.07,sign*.36,.62,-.01,'#e6b392',group,false);}
    cyl(.15,.17,.16,0,1.27,0,'#e6b392',group,false);sphere(.215,.26,.21,0,1.50,0,'#edc4a3',group,false);
    sphere(.227,.18,.22,0,1.62,.023,'#423d38',group,false);
    box(.36,.10,.07,0,1.66,-.17,'#423d38',group,false,false);
    for(const sign of [-1,1]){sphere(.017,.026,.012,sign*.075,1.49,-.20,'#49443e',group,false);sphere(.04,.018,.01,sign*.12,1.43,-.187,'#d8927a',group,false);}
    box(.075,.012,.012,0,1.405,-.208,'#ad705e',group,false,false);
    if(apron){box(.39,.57,.045,0,.83,-.175,'#d6cfaa',group,false,false);box(.23,.11,.025,0,.79,-.208,'#aeb493',group,false,false);for(const sign of [-1,1])box(.06,.24,.03,sign*.13,1.16,-.12,'#d6cfaa',group,false,false);}
    else{box(.07,.46,.025,0,.96,-.18,'#e8ddc8',group,false,false);box(.13,.1,.03,-.13,1.03,-.18,'#a4b2a1',group,false,false);}
    animated.push(group);return group;
  }
  for(let s=9,index=0;s<ROAD_LENGTH-6;s+=9.4,index++){
    for(const side of [-1,1]){
      const point=sampleRoad(s),root=new TransformNode(`facade-${side}-${index}`,scene);root.position.set(point.x+point.tz*4.03*side,0,point.z-point.tx*4.03*side);root.rotation.y=Math.atan2(point.tz*side,-point.tx*side);
      const shop=side===1 && index===3; if(shop)shopRoot=root;
      const w=8.55,h=shop?5.65:5.25+(index%3)*.55,d=5.7,colors=palettes[(index+(side===1?0:2))%palettes.length];
      if(shop){
        box(w,.14,d,0,.01,d/2,'#bcaa88',root,true);
        box(.18,h,d,-w/2,h/2,d/2,colors[0],root,true);box(.18,h,d,w/2,h/2,d/2,colors[0],root,true);
        box(w,h,.2,0,h/2,d,colors[0],root,true);
        box((w-2)/2,2.65,.18,-(w+2)/4,1.35,0,'#9a8262',root,true);box((w-2)/2,2.65,.18,(w+2)/4,1.35,0,'#9a8262',root,true);
        box(w,h-2.6,.25,0,2.6+(h-2.6)/2,0,colors[0],root,true);
        box(w,.18,d,0,2.75,d/2,'#8a775b',root);
        box(w-.5,1.0,.65,0,.56,3.45,'#8a7155',root,true);box(w-.4,.11,.84,0,1.11,3.40,'#d8bf95',root,true);
        box(1.6,.72,.45,-2.8,1.54,5.30,'#d8c8a9',root);
        label('本日の日替わり',2.8,.75,0,2.04,5.56,'#e9dfc4','#454f42',root,'手づくりのお弁当');
        for(let i=0;i<4;i++){cyl(.40,.47,.2,-2.4+i*1.55,2.60,2,'#eee1bf',root);sphere(.15,.06,.15,-2.4+i*1.55,2.48,2,'#fff2c9',root);}
        keeper=person(root,.4,4.25,'#4a7166',true);
        const target=global(root,new Vector3(.4,1.42,4.25));targets.push({id:'shop',label:'和店员说话',point:target,radius:3.6});
        const item=new TransformNode('purchase',scene);item.parent=root;item.position.set(.1,1.22,3.05);receiptBag=item;
        box(.65,.10,.40,0,0,0,'#332c26',item,false,false);box(.58,.055,.33,0,.065,0,'#efdfbb',item,false,false);
        box(.23,.075,.29,-.15,.10,0,'#f3e8d0',item,false,false);sphere(.10,.035,.13,.14,.12,0,'#bd7742',item,false);
        for(let i=0;i<4;i++){const steamMesh=sphere(.028,.075,.028,0,.25+i*.10,0,'#f8f3df',item,false);steamMesh.visibility=0;steam.push(steamMesh);}
      }else{
        box(w,h,d,0,h/2,d/2,colors[0],root,true);
        box(w-.35,2.43,.10,0,1.25,-.14,'#806e58',root);
        for(const x of [-2.7,0,2.7])windowFrame(root,x,1.45,2.25,1.64,-.25);
      }
      for(const x of [-w/2+.14,w/2-.14])box(.17,h+.02,.21,x,h/2,-.23,'#817158',root);
      box(w+.13,.16,.32,0,2.64,-.21,'#786551',root);
      for(const x of [-2.55,0,2.55]){windowFrame(root,x,4.09,1.65,1.37,-.18);for(let k=0;k<5;k++)box(.035,.46,.04,x-.7+k*.35,3.56,-.53,'#6d7765',root);box(1.74,.05,.07,x,3.81,-.53,'#6d7765',root);}
      roof(root,w,h,d,colors[1]);
      const awningColor=shop?'#426b60':colors[2];
      const awning=box(w-.16,.10,1.2,0,2.79,-.65,awningColor,root);awning.rotation.x=-.14;
      box(w-.16,.23,.055,0,2.59,-1.25,awningColor,root);
      for(let j=0;j<12;j++){const trim=box(.17,.015,1.16,-w/2+.35+j*.7,2.855,-.64,'#dfd5b5',root);trim.rotation.x=-.14;}
      const names=side===1?['花とくらし','喫茶 こもれび','暮らしの道具','よりみち弁当','甘味 ひなた','古書 あおば','手づくり工房','山の茶屋']:['パンと日々','うつわ','小さな本屋','珈琲 日和','まちの写真室','和菓子 つむぎ','くらしの雑貨','はなや'];
      label(shop?'よりみち弁当':names[index%names.length],shop?5.6:5.1,.74,0,3.05,-.37,shop?'#f0e5c9':'#e5dbc3',shop?'#32574d':'#665d4e',root,shop?'あたたかいごはん、あります。':'やなか ・ さんぽ');
      if(shop){for(const x of [-.71,0,.71]){const curtain=box(.67,.51,.026,x,2.28,-.08,'#4a7166',root);curtain.metadata={noren:true};}label('弁当',.49,.28,0,2.30,-.105,'#4a7166','#f4ead3',root);}
      // Lower facades carry the detail budget: wood slats, lanterns, plants and menus.
      for(const x of [-3.95,3.95])for(let k=0;k<5;k++)box(.075,2.20,.045,x+(x<0?1:-1)*k*.12,1.13,-.24,'#b79c75',root);
      plant(root,-3.7,-.75,.94);if(index%2===0)plant(root,3.5,-.67,1.2);
      if(index%3===1){const stand=box(.69,1,.075,2.9,.60,-1.25,'#6b6150',root);stand.rotation.x=-.12;label(shop?'日替わり 650円':'本日のおすすめ',.60,.82,2.9,.64,-1.34,'#344a42','#eee4c6',root,shop?'袋 3円':'いらっしゃいませ');}
      if(shop){label('日替わり弁当',1.45,1.07,-2.45,1.41,-.32,'#f0e5c9','#365b50',root,'650円 ・ 袋 3円');targets.push({id:'menu',label:'菜单 · 日替わり弁当',point:global(root,new Vector3(-2.45,1.41,-.6)),radius:3.0});}
      if(index%3===0){const lantern=cyl(.30,.35,.55,-3.1,2.30,-.7,'#dca36a',root);lantern.rotation.z=.035;for(let k=0;k<6;k++)cyl(.348,.348,.012,-3.1,2.08+k*.078,-.7,'#c78c60',root);}
      if(index%4===2){box(.92,.64,.39,3.2,3.01,-.52,'#c7c4ae',root);for(let k=0;k<6;k++)box(.69,.027,.013,3.2,2.84+k*.07,-.723,'#878f81',root);tube([new Vector3(3.45,3,-.56),new Vector3(3.70,3,-.56),new Vector3(3.70,.6,-.56)],.028,'#e4d9bf',root);}
    }
  }
  if(!shopRoot)throw new Error('shop_missing');
  // An open forecourt at the entrance, plus poles and cables following the actual centerline.
  const start=sampleRoad(12),guideRoot=new TransformNode('guideRoot',scene);guideRoot.position.set(start.x-2.7,0,start.z);guideRoot.rotation.y=-.45;
  const guide=person(guideRoot,0,0,'#9cae96');targets.push({id:'guide',label:'和附近的居民聊聊',point:global(guide,new Vector3(0,1.45,0)),radius:3.6});
  const poleTops:Vector3[]=[];
  for(let s=7;s<ROAD_LENGTH;s+=25){const p=sampleRoad(s),r=new TransformNode('poleRoot'+s,scene);r.position.set(p.x-3.32,0,p.z);cyl(.18,.25,7.5,0,3.75,0,'#77796b',r);box(1.35,.09,.1,0,7.1,0,'#665f53',r);for(const x of [-.52,0,.52])cyl(.08,.09,.20,x,7.23,0,'#ccd0b7',r);poleTops.push(global(r,new Vector3(0,7.35,0)));}
  for(let i=0;i<poleTops.length-1;i++)for(const side of [-1,1]){const a=poleTops[i],b=poleTops[i+1];const path=[];for(let k=0;k<=12;k++){const t=k/12;path.push(new Vector3(a.x+(b.x-a.x)*t+side*.5,a.y+(b.y-a.y)*t-Math.sin(t*Math.PI)*.55,a.z+(b.z-a.z)*t));}tube(path,.018,'#605d51');}
  // Street arch and cloth flags establish depth without obscuring the walking path.
  for(const s of [5,82,ROAD_LENGTH-3]){const p=sampleRoad(s),r=new TransformNode('arch'+s,scene);r.position.set(p.x,0,p.z);r.rotation.y=Math.atan2(p.tx,p.tz);for(const side of [-1,1]){cyl(.13,.17,4.8,side*3.32,2.4,0,'#536d61',r);cyl(.28,.28,.12,side*3.32,4.7,0,'#bfab7a',r);}box(6.7,.13,.14,0,4.60,0,'#536d61',r);label('谷中を、歩こう。',3.1,.61,0,4.32,-.02,'#e6dcc0','#3f6054',r);}
  const noticeP=sampleRoad(68),notice=new TransformNode('noticeRoot',scene);notice.position.set(noticeP.x-2.9,0,noticeP.z);notice.rotation.y=-Math.PI/2;
  box(1.5,1.7,.10,0,1.35,0,'#87785e',notice);label('路地の小さな市',1.35,1.45,0,1.35,-.07,'#f0e5ca','#566853',notice,'今週末 ・ まちの広場');targets.push({id:'notice',label:'読む · 街角的告示',point:global(notice,new Vector3(0,1.4,-.2)),radius:3.0});
  for(let s=2;s<ROAD_LENGTH;s+=33){const p=sampleRoad(s),r=new TransformNode('tree'+s,scene);r.position.set(p.x+(s%2?12:-12),0,p.z);cyl(.18,.30,3.6,0,1.8,0,'#918169',r);for(let i=0;i<8;i++)sphere(1.25+rand()*.5,1.2,1.25,Math.cos(i*2.4)*1.1,3.7+rand()*.8,Math.sin(i*2.4),i%3===0?'#a5b57d':i%2?'#869d70':'#6e8b69',r);}
  const catP=sampleRoad(57),cat=new TransformNode('cat',scene);cat.position.set(catP.x-3.15,0,catP.z);sphere(.18,.24,.28,0,.28,0,'#c9a077',cat);sphere(.18,.17,.17,0,.52,-.16,'#c9a077',cat);for(const side of [-1,1]){const ear=cyl(0,.17,.19,side*.11,.69,-.13,'#aa8665',cat);ear.rotation.z=-side*.2;sphere(.017,.026,.015,side*.065,.52,-.32,'#4b5040',cat);}tube([new Vector3(0,.20,.2),new Vector3(.25,.15,.4),new Vector3(.42,.26,.3)],.045,'#c9a077',cat);targets.push({id:'cat',label:'路边有一只猫',point:global(cat,new Vector3(0,.4,0)),radius:2.6});
  // Keep the sample finite. Invisible bounds prevent falling out; both ends are visibly signposted.
  for(const z of [-.4,ROAD_LENGTH+.4]){const b=box(45,9,.3,0,4.5,z,'#eeeeee',undefined,true);b.isVisible=false;label('ここから先は、次のお散歩。',4,.6,0,1.8,z<0?1:ROAD_LENGTH-.8,'#d8dbc2','#425e52');}
  for(const x of [-25,25]){const b=box(.3,9,ROAD_LENGTH+10,x,4.5,ROAD_LENGTH/2,'#eeeeee',undefined,true);b.isVisible=false;}
  // Merge decorative geometry by material; leave walls and interactive objects individually addressable.
  const groups=new Map<StandardMaterial,Mesh[]>();
  for(const mesh of batches){mesh.computeWorldMatrix(true);const m=mesh.material as StandardMaterial;const list=groups.get(m)||[];list.push(mesh);groups.set(m,list);}
  for(const list of groups.values()){const merged=Mesh.MergeMeshes(list,true,true,undefined,false,false);if(merged){merged.receiveShadows=true;merged.isPickable=false;shadows.addShadowCaster(merged);merged.freezeWorldMatrix();}}
  for(const b of blocked){b.freezeWorldMatrix();if(b.isVisible)shadows.addShadowCaster(b);}
  for(const m of mats.values())m.freeze();
  const player=MeshBuilder.CreateBox('player',{size:1},scene);player.isVisible=false;player.isPickable=false;player.ellipsoid=new Vector3(.27,.80,.27);player.ellipsoidOffset=new Vector3(0,.83,0);
  let yaw=initial.pose.yaw,pitch=initial.pose.pitch,paused=true,disposed=false,near:Target|null=null,scanTimer=0;
  let joyX=0,joyY=0,progress=initial,frameCounter=0,lastFrame=performance.now(),fps=0;
  const keys=new Set<string>();
  function resetPosition(){const p=sampleRoad(9);player.position.set(p.x,.03,p.z);yaw=Math.atan2(p.tx,p.tz);pitch=-.015;}
  if(initial.pose.z<=1||initial.pose.z>=ROAD_LENGTH||distanceToRoad(initial.pose)>10.2){resetPosition();}else{player.position.set(initial.pose.x,.03,initial.pose.z);}
  function look(dx:number,dy:number){if(paused)return;yaw=((yaw+dx*.0029+Math.PI*3)%(Math.PI*2))-Math.PI;pitch=Math.max(-1.12,Math.min(1.12,pitch+dy*.0026));}
  function setMove(x:number,y:number){joyX=x;joyY=y;}
  const keyDown=(e:KeyboardEvent)=>{if(paused||e.ctrlKey||e.metaKey||e.altKey)return;if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyE','ShiftLeft'].includes(e.code)){e.preventDefault();keys.add(e.code);if(e.code==='KeyE'&&!e.repeat&&near)events.interact(near.id);}};
  const keyUp=(e:KeyboardEvent)=>keys.delete(e.code);
  const clear=()=>{keys.clear();joyX=0;joyY=0;};
  let drag:{id:number;x:number;y:number}|null=null;
  const down=(e:PointerEvent)=>{if(paused||e.pointerType==='touch'||e.button!==0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY};if(!coarse&&!document.pointerLockElement){try{const req=canvas.requestPointerLock();if(req && 'catch' in req)void req.catch(()=>{});}catch{/* Drag-to-look remains available. */}}};
  const move=(e:PointerEvent)=>{if(document.pointerLockElement===canvas)look(e.movementX,e.movementY);else if(drag&&drag.id===e.pointerId){look(e.clientX-drag.x,e.clientY-drag.y);drag={id:e.pointerId,x:e.clientX,y:e.clientY};}};
  const up=()=>{drag=null;};const lock=()=>{clear();events.lock(document.pointerLockElement===canvas);};
  const resize=()=>engine.resize();
  const lost=(e:Event)=>{e.preventDefault();paused=true;clear();events.lost();};
  canvas.addEventListener('webglcontextlost',lost);canvas.addEventListener('pointerdown',down);window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);document.addEventListener('pointerlockchange',lock);window.addEventListener('keydown',keyDown);window.addEventListener('keyup',keyUp);window.addEventListener('blur',clear);window.addEventListener('resize',resize);
  const render=()=>{
    if(disposed)return;const dt=Math.min(engine.getDeltaTime()/1000,.035);
    if(!paused){
      let x=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+joyX;
      let f=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-joyY;
      const n=Math.max(1,Math.hypot(x,f));x/=n;f/=n;
      if(keys.has('ArrowLeft'))yaw-=dt*1.4;if(keys.has('ArrowRight'))yaw+=dt*1.4;yaw=((yaw+Math.PI*3)%(Math.PI*2))-Math.PI;
      const speed=(keys.has('ShiftLeft')?4.4:2.8)*dt;
      player.moveWithCollisions(new Vector3((Math.cos(yaw)*x+Math.sin(yaw)*f)*speed,-.06,(Math.cos(yaw)*f-Math.sin(yaw)*x)*speed));
      if(player.position.y < -.4)resetPosition();
      scanTimer+=dt;
      if(scanTimer>.12){scanTimer=0;const eye=player.position.add(new Vector3(0,1.68,0)),forward=new Vector3(Math.sin(yaw)*Math.cos(pitch),-Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));let pick:Target|null=null,closest=Infinity;
        for(const t of targets){const dir=t.point.subtract(eye),dist=dir.length();if(dist>t.radius||Vector3.Dot(forward,dir.normalize())<.50||dist>closest)continue;const hit=scene.pickWithRay(new Ray(eye,dir,Math.max(.1,dist-.40)),m=>Boolean(m.metadata?.blocker)&&m.isVisible);if(!hit?.hit){pick=t;closest=dist;}}
        if(pick?.id!==near?.id){near=pick;events.near(near);}
      }
    }
    camera.position.copyFrom(player.position).addInPlace(new Vector3(0,1.68,0));camera.rotation.set(pitch,yaw,0);
    const time=performance.now()/1000;
    for(let i=0;i<animated.length;i++){const p=animated[i];p.scaling.y=1+Math.sin(time*1.7+i)*.009;}
    if(keeper)keeper.rotation.y=near?.id==='shop'?.06*Math.sin(time*.8):0;
    if(receiptBag)receiptBag.setEnabled(!progress.purchase.paid);
    for(let i=0;i<steam.length;i++){steam[i].visibility=progress.purchase.warm&&!progress.purchase.paid?.2+.15*Math.sin(time*2+i):0;steam[i].position.y=.20+((time*.15+i*.10)%.43);}
    scene.render();frameCounter++;if(performance.now()-lastFrame>1000){fps=Math.round(frameCounter*1000/(performance.now()-lastFrame));frameCounter=0;lastFrame=performance.now();}
  };
  const visibility=()=>{clear();if(document.hidden)engine.stopRenderLoop(render);else if(!disposed)engine.runRenderLoop(render);};document.addEventListener('visibilitychange',visibility);
  engine.runRenderLoop(render);
  return {
    pause(v){paused=v;clear();if(v){near=null;events.near(null);if(document.pointerLockElement===canvas)document.exitPointerLock();}},setMove,look,
    interact(){if(!paused&&near)events.interact(near.id);},setProgress(p){progress=p;},
    getPose(){return{x:player.position.x,z:player.position.z,yaw,pitch};},resetPosition,
    diagnostics(){return{fps,meshCount:scene.meshes.length,roadLength:ROAD_LENGTH,pose:{x:player.position.x,z:player.position.z,yaw,pitch},paused,nearest:near?.id||null,webgl:engine.webGLVersion};},
    dispose(){if(disposed)return;disposed=true;engine.stopRenderLoop(render);canvas.removeEventListener('webglcontextlost',lost);canvas.removeEventListener('pointerdown',down);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);document.removeEventListener('pointerlockchange',lock);window.removeEventListener('keydown',keyDown);window.removeEventListener('keyup',keyUp);window.removeEventListener('blur',clear);window.removeEventListener('resize',resize);document.removeEventListener('visibilitychange',visibility);if(document.pointerLockElement===canvas)document.exitPointerLock();scene.dispose();engine.dispose();},
  };
}
