import {Engine} from '@babylonjs/core/Engines/engine';
import {Scene} from '@babylonjs/core/scene';
import {FreeCamera} from '@babylonjs/core/Cameras/freeCamera';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import {Color3, Color4} from '@babylonjs/core/Maths/math.color';
import {HemisphericLight} from '@babylonjs/core/Lights/hemisphericLight';
import {DirectionalLight} from '@babylonjs/core/Lights/directionalLight';
import {PointLight} from '@babylonjs/core/Lights/pointLight';
import {Mesh} from '@babylonjs/core/Meshes/mesh';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import {DynamicTexture} from '@babylonjs/core/Materials/Textures/dynamicTexture';
import {TransformNode} from '@babylonjs/core/Meshes/transformNode';
import {ShadowGenerator} from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import {DefaultRenderingPipeline} from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline';
import {ShaderMaterial} from '@babylonjs/core/Materials/shaderMaterial';
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
  // Desktop renders at native canvas resolution; mobile may downscale. Supersampling here made the cinematic pass unnecessarily expensive.
  engine.setHardwareScalingLevel(coarse?1.18:1);
  const scene=new Scene(engine);
  scene.clearColor=new Color4(.43,.55,.60,1);
  scene.fogMode=Scene.FOGMODE_EXP2;scene.fogColor=Color3.FromHexString('#b8aa98');scene.fogDensity=.00355;
  scene.collisionsEnabled=true;
  scene.imageProcessingConfiguration.contrast=1.13;
  scene.imageProcessingConfiguration.exposure=.82;
  scene.imageProcessingConfiguration.toneMappingEnabled=true;
  const camera=new FreeCamera('eyes',new Vector3(0,1.68,8),scene);
  camera.minZ=.065;camera.maxZ=240;camera.fov=.94;camera.inputs.clear();
  const cinematic=new DefaultRenderingPipeline('cinematic',true,scene,[camera]);
  cinematic.samples=1;cinematic.fxaaEnabled=true;cinematic.bloomEnabled=true;cinematic.bloomThreshold=.90;cinematic.bloomWeight=.10;cinematic.bloomKernel=28;
  // Directional procedural sky. The horizon and visible sun glow share the same late-afternoon direction as the key light.
  const skyMat=new ShaderMaterial('yanaka-sky-mat',scene,{
    vertexSource:`precision highp float;attribute vec3 position;uniform mat4 worldViewProjection;varying vec3 vDir;void main(void){vDir=normalize(position);gl_Position=worldViewProjection*vec4(position,1.0);}`,
    fragmentSource:`precision highp float;varying vec3 vDir;void main(void){vec3 d=normalize(vDir);float h=clamp(d.y*.5+.5,0.0,1.0);vec3 horizon=vec3(.78,.60,.44);vec3 middle=vec3(.55,.64,.66);vec3 zenith=vec3(.27,.39,.47);vec3 col=mix(horizon,middle,smoothstep(.48,.70,h));col=mix(col,zenith,smoothstep(.69,1.0,h));vec3 sunDir=normalize(vec3(-.52,.48,.70));float sd=max(dot(d,sunDir),0.0);float halo=pow(sd,12.0);float disc=pow(sd,260.0);col+=vec3(1.0,.58,.30)*halo*.26+vec3(1.0,.88,.68)*disc*1.15;float band=1.0-smoothstep(.48,.59,h);col=mix(col,vec3(.73,.64,.54),band*.11);gl_FragColor=vec4(col,1.0);}`
  },{attributes:['position'],uniforms:['worldViewProjection']});
  skyMat.backFaceCulling=false;skyMat.disableDepthWrite=true;
  const sky=MeshBuilder.CreateSphere('yanaka-atmosphere',{diameter:390,segments:28,sideOrientation:Mesh.BACKSIDE},scene);sky.material=skyMat;sky.infiniteDistance=true;sky.isPickable=false;sky.applyFog=false;
  const hemi=new HemisphericLight('sky',new Vector3(.12,1,-.18),scene);hemi.intensity=.42;hemi.diffuse=Color3.FromHexString('#b8cbcc');hemi.groundColor=Color3.FromHexString('#6f5a48');
  const sun=new DirectionalLight('afternoon',new Vector3(.52,-.48,-.70),scene);sun.position=new Vector3(-55,52,82);sun.intensity=1.62;sun.diffuse=Color3.FromHexString('#f4c48d');sun.specular=Color3.FromHexString('#f7dfc4');
  sun.shadowMinZ=1;sun.shadowMaxZ=160;sun.autoCalcShadowZBounds=true;
  const shadows=new ShadowGenerator(coarse?512:2048,sun);shadows.useBlurExponentialShadowMap=true;shadows.useKernelBlur=true;shadows.blurKernel=coarse?12:28;shadows.bias=.0018;shadows.normalBias=.021;shadows.setDarkness(.36);
  // All shadow casters in this slice are static. Reuse the depth map instead of redrawing the entire street every frame.
  const shadowMap=shadows.getShadowMap();if(shadowMap)shadowMap.refreshRate=0;
  const mats=new Map<string,StandardMaterial>();
  function mat(color:string){let m=mats.get(color);if(!m){m=new StandardMaterial('m'+color,scene);const base=Color3.FromHexString(color);m.diffuseColor=base;m.specularColor=new Color3(.06,.055,.05);m.specularPower=42;m.ambientColor=base.scale(.08);if(color==='#f0c29f'||color==='#f2c7a5'){m.emissiveColor=base.scale(.035);m.specularPower=18;}mats.set(color,m);}return m;}
  function emissiveMat(name:string,color:string,strength=.35){const m=new StandardMaterial(name,scene);const c=Color3.FromHexString(color);m.diffuseColor=c.scale(.72);m.emissiveColor=c.scale(strength);m.specularColor=c.scale(.08);return m;}
  const warmWindow=emissiveMat('warm-window','#ffd59a',.42);const lampGlow=emissiveMat('lamp-glow','#ffc879',.58);
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
  const roadMat=mat('#7b7c77');const roadTex=new DynamicTexture('paving',{width:512,height:512},scene,false);const c=roadTex.getContext();
  c.fillStyle='#7b7c77';c.fillRect(0,0,512,512);let seed=19;const rand=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
  // Fine asphalt aggregate. Keep it irregular; the previous grid read like tiled flooring rather than a Japanese side street.
  for(let i=0;i<22000;i++){const v=68+Math.floor(rand()*92);const alpha=.09+rand()*.18;c.fillStyle=`rgba(${v},${v+Math.floor(rand()*5)},${v+Math.floor(rand()*4)},${alpha})`;const r=.45+rand()*1.35;c.fillRect(rand()*512,rand()*512,r,r);}
  // Subtle repaired seams and hairline cracks, intentionally sparse enough not to become a repeating pattern.
  for(let i=0;i<22;i++){let x=rand()*512,y=rand()*512;c.beginPath();c.moveTo(x,y);for(let k=0;k<4;k++){x+=-18+rand()*36;y+=10+rand()*38;c.lineTo(x,y);}c.strokeStyle=`rgba(40,42,40,${.07+rand()*.08})`;c.lineWidth=.6+rand()*1.1;c.stroke();}
  for(let i=0;i<8;i++){const y=rand()*512;c.fillStyle=`rgba(44,46,44,${.025+rand()*.035})`;c.fillRect(0,y,512,4+rand()*15);}
  roadTex.update();roadTex.uScale=1.9;roadTex.vScale=7.2;roadMat.diffuseTexture=roadTex;roadMat.specularColor=new Color3(.018,.018,.017);roadMat.specularPower=16;roadMat.emissiveColor=Color3.FromHexString('#858780').scale(.12);
  box(230,.2,270,0,-.23,80,'#77796c',undefined,true);
  for(let i=0;i<ROAD.length-1;i++){
    const a=ROAD[i],b=ROAD[i+1],len=Math.hypot(b.x-a.x,b.z-a.z),root=new TransformNode('road'+i,scene);root.position.set((a.x+b.x)/2,-.04,(a.z+b.z)/2);root.rotation.y=Math.atan2(b.x-a.x,b.z-a.z);
    const paving=box(7.3,.1,len+.18,0,0,0,'#7b7c77',root,true);paving.material=roadMat;
    for(const side of [-1,1]){box(.30,.13,len+.1,side*3.67,.025,0,'#85847d',root);box(.15,.028,len,side*3.47,.074,0,'#454846',root);for(let dz=-len/2+.7;dz<len/2;dz+=3.1)box(.06,.016,.44,side*3.45,.095,dz,'#343735',root);}
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
    // Deliberately stylized: larger head, simplified face, graphic hair and clothing. No realistic skin rendering.
    box(.17,.42,.21,-.105,.23,0,'#394247',group,false,false);box(.17,.42,.21,.105,.23,0,'#394247',group,false,false);
    box(.19,.095,.30,-.105,.05,-.04,'#eee4cf',group,false,false);box(.19,.095,.30,.105,.05,-.04,'#eee4cf',group,false,false);
    sphere(.34,.42,.22,0,.91,0,coat,group,false);
    for(const sign of [-1,1]){const arm=cyl(.13,.155,.47,sign*.34,.90,.015,coat,group,false);arm.rotation.z=sign*.19;sphere(.085,.105,.075,sign*.385,.62,-.025,'#f0c29f',group,false);}
    cyl(.16,.18,.13,0,1.28,0,'#f0c29f',group,false);
    sphere(.255,.30,.245,0,1.53,-.015,'#f2c7a5',group,false);
    sphere(.278,.235,.258,0,1.69,.045,'#3f3a37',group,false);
    for(const sign of [-1,1])sphere(.095,.19,.105,sign*.18,1.63,.02,'#3f3a37',group,false);
    for(const sign of [-1,1]){sphere(.026,.038,.016,sign*.088,1.525,-.246,'#343637',group,false);sphere(.052,.022,.012,sign*.13,1.44,-.229,'#df9a83',group,false);}
    box(.085,.010,.010,0,1.427,-.255,'#a8665c',group,false,false);
    if(apron){box(.41,.58,.05,0,.83,-.18,'#d9d2ac',group,false,false);box(.24,.12,.03,0,.78,-.215,'#a6b08f',group,false,false);for(const sign of [-1,1])box(.065,.24,.03,sign*.14,1.17,-.13,'#d9d2ac',group,false,false);}
    else{box(.075,.46,.027,0,.96,-.185,'#ede3d0',group,false,false);box(.14,.10,.03,-.13,1.03,-.185,'#a4b2a1',group,false,false);}
    animated.push(group);return group;
  }
  for(let s=9,index=0;s<ROAD_LENGTH-6;s+=9.4,index++){
    for(const side of [-1,1]){
      const point=sampleRoad(s),shop=side===1 && index===3,variant=(index*3+(side===1?1:4))%5;
      const setbacks=[0,.08,.18,.05,.24],widths=[8.42,8.70,8.86,8.54,8.76],heights=[5.02,5.40,5.86,5.20,5.64],depths=[5.45,5.80,5.62,5.94,5.35];
      const setback=shop?4.03:4.03+setbacks[variant],root=new TransformNode(`facade-${side}-${index}`,scene);root.position.set(point.x+point.tz*setback*side,0,point.z-point.tx*setback*side);root.rotation.y=Math.atan2(point.tz*side,-point.tx*side);
      if(shop)shopRoot=root;
      const w=shop?8.55:widths[variant],h=shop?5.65:heights[variant],d=shop?5.7:depths[variant],colors=palettes[(index+(side===1?0:2))%palettes.length];
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
        const shopLight=new PointLight('shop-warm-light',new Vector3(0,2.15,2.5),scene);shopLight.parent=root;shopLight.diffuse=Color3.FromHexString('#ffd3a0');shopLight.specular=Color3.FromHexString('#d99b68');shopLight.intensity=.72;shopLight.range=8.5;
        for(const lx of [-2.0,0,2.0]){const bulb=sphere(.055,.055,.055,lx,2.42,2.4,'#f4c27d',root,false);bulb.material=lampGlow;}
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
        const lowerXs=variant===1||variant===4?[-2.18,2.18]:variant===3?[-2.78,0,2.78]:[-2.62,0,2.62],lowerW=variant===1||variant===4?2.62:2.12;
        for(const x of lowerXs)windowFrame(root,x,1.45,lowerW,1.64,-.25);
      }
      for(const x of [-w/2+.14,w/2-.14])box(.17,h+.02,.21,x,h/2,-.23,'#817158',root);
      box(w+.13,.16,.32,0,2.64,-.21,'#786551',root);
      const upperXs=shop?[-2.55,0,2.55]:(variant===1||variant===4?[-2.12,2.12]:[-2.55,0,2.55]);
      for(const x of upperXs){windowFrame(root,x,4.09,variant===2?1.48:1.65,1.37,-.18);for(let k=0;k<5;k++)box(.035,.46,.04,x-.7+k*.35,3.56,-.53,'#6d7765',root);box(1.74,.05,.07,x,3.81,-.53,'#6d7765',root);}
      roof(root,w,h,d,colors[1]);
      const awningColor=shop?'#426b60':colors[2],awningWidth=shop?w-.16:(variant===1?w*.62:variant===4?w*.76:w-.16),awningX=shop?0:(variant===1?-.88:variant===4?.52:0),awningDepth=shop?1.2:(variant===3?.76:1.0+(variant%2)*.16);
      const awning=box(awningWidth,.10,awningDepth,awningX,2.79,-.65,awningColor,root);awning.rotation.x=-.14;
      box(awningWidth,.23,.055,awningX,2.59,-1.25,awningColor,root);
      const trimCount=Math.max(5,Math.floor(awningWidth/.7));for(let j=0;j<trimCount;j++){const trim=box(.17,.015,awningDepth,awningX-awningWidth/2+.35+j*.7,2.855,-.64,'#dfd5b5',root);trim.rotation.x=-.14;}
      const names=side===1?['花とくらし','喫茶 こもれび','暮らしの道具','よりみち弁当','甘味 ひなた','古書 あおば','手づくり工房','山の茶屋']:['パンと日々','うつわ','小さな本屋','珈琲 日和','まちの写真室','和菓子 つむぎ','くらしの雑貨','はなや'];
      label(shop?'よりみち弁当':names[index%names.length],shop?5.6:5.1,.74,0,3.05,-.37,shop?'#f0e5c9':'#e5dbc3',shop?'#32574d':'#665d4e',root,shop?'あたたかいごはん、あります。':'やなか ・ さんぽ');
      if(shop){for(const x of [-.71,0,.71]){const curtain=box(.67,.51,.026,x,2.28,-.08,'#4a7166',root);curtain.metadata={noren:true};}label('弁当',.49,.28,0,2.30,-.105,'#4a7166','#f4ead3',root);}
      // Lower facades carry the detail budget: varied setbacks, timber, tile, glazing and shop lights.
      for(const x of [-3.95,3.95])for(let k=0;k<5;k++)box(.075,2.20,.045,x+(x<0?1:-1)*k*.12,1.13,-.24,'#a88962',root);
      if(!shop&&index%4===0){for(let x=-3.5;x<3.6;x+=.34)box(.09,2.28,.06,x,1.22,-.34,'#745b45',root);box(7.55,.12,.42,0,.18,-.32,'#4e443a',root);}
      if(!shop&&index%4===1){for(let x=-3.1;x<=3.1;x+=2.05){const glow=box(1.48,1.32,.035,x,1.43,-.34,'#f2c98d',root);glow.material=warmWindow;}box(7.6,.18,.32,0,.18,-.28,'#655d50',root);}
      if(!shop&&index%4===2){for(let y=.45;y<2.5;y+=.34)box(7.2,.045,.05,0,y,-.36,'#9c7f61',root);box(2.4,1.1,.08,1.8,1.35,-.39,'#b6c5bc',root);}
      if(!shop&&index%4===3){box(7.1,2.15,.07,0,1.22,-.34,'#c8b59a',root);for(let x=-3;x<3.1;x+=1.0)box(.06,2.08,.045,x,1.22,-.40,'#7c6b57',root);}
      plant(root,-3.7,-.75,.94);if(index%2===0)plant(root,3.5,-.67,1.2);
      if(index%3===1){const stand=box(.69,1,.075,2.9,.60,-1.25,'#6b6150',root);stand.rotation.x=-.12;label(shop?'日替わり 650円':'本日のおすすめ',.60,.82,2.9,.64,-1.34,'#344a42','#eee4c6',root,shop?'袋 3円':'いらっしゃいませ');}
      if(shop){label('日替わり弁当',1.45,1.07,-2.45,1.41,-.32,'#f0e5c9','#365b50',root,'650円 ・ 袋 3円');targets.push({id:'menu',label:'菜单 · 日替わり弁当',point:global(root,new Vector3(-2.45,1.41,-.6)),radius:3.0});}
      if(index%3===0){const lantern=cyl(.30,.35,.55,-3.1,2.30,-.7,'#dca36a',root);lantern.material=lampGlow;lantern.rotation.z=.035;for(let k=0;k<6;k++){const ring=cyl(.348,.348,.012,-3.1,2.08+k*.078,-.7,'#c78c60',root);ring.material=lampGlow;}}
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
  for(let s=2;s<ROAD_LENGTH;s+=24){const p=sampleRoad(s),r=new TransformNode('tree'+s,scene);r.position.set(p.x+(s%2?10.5:-10.5),0,p.z);cyl(.20,.34,3.8,0,1.9,0,'#705d4b',r);for(let i=0;i<11;i++){const leaf=sphere(1.15+rand()*.65,.95+rand()*.42,1.05+rand()*.5,Math.cos(i*2.1)*1.15,3.65+rand()*1.15,Math.sin(i*2.1)*1.05,i%3===0?'#84945d':i%2?'#687f5a':'#536f57',r);leaf.rotation.y=rand()*Math.PI;}for(let i=0;i<3;i++)plant(r,-.8+i*.75,-.55,.65+rand()*.35);}
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
  let lastDraw=0;
  const render=()=>{
    if(disposed)return;const now=performance.now();if(paused&&now-lastDraw<100)return;lastDraw=now;const dt=Math.min(engine.getDeltaTime()/1000,.035);
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
    diagnostics(){return{fps,floorY:player.position.y,keys:[...keys],meshCount:scene.meshes.length,roadLength:ROAD_LENGTH,pose:{x:player.position.x,z:player.position.z,yaw,pitch},paused,nearest:near?.id||null,webgl:engine.webGLVersion};},
    dispose(){if(disposed)return;disposed=true;engine.stopRenderLoop(render);canvas.removeEventListener('webglcontextlost',lost);canvas.removeEventListener('pointerdown',down);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);document.removeEventListener('pointerlockchange',lock);window.removeEventListener('keydown',keyDown);window.removeEventListener('keyup',keyUp);window.removeEventListener('blur',clear);window.removeEventListener('resize',resize);document.removeEventListener('visibilitychange',visibility);if(document.pointerLockElement===canvas)document.exitPointerLock();scene.dispose();engine.dispose();},
  };
}
