/** Original procedural architectural scene. Offline master renderer; NOT shipped in the live UI. */
import {Engine,Scene,Vector3,Color3,Color4,MeshBuilder,StandardMaterial,DynamicTexture,FreeCamera,HemisphericLight,PointLight,DefaultRenderingPipeline,Mesh,Texture,Material} from '@babylonjs/core';
const canvas=document.getElementById('city') as HTMLCanvasElement;
const engine=new Engine(canvas,true,{preserveDrawingBuffer:true,stencil:true,disableWebGL2Support:false});engine.setHardwareScalingLevel(1);
const scene=new Scene(engine);scene.clearColor=new Color4(.008,.017,.045,1);scene.fogMode=Scene.FOGMODE_EXP2;scene.fogDensity=.0026;scene.fogColor=new Color3(.036,.070,.12);
const portrait=new URLSearchParams(location.search).has('portrait');
const camera=new FreeCamera('camera',portrait?new Vector3(12,91,-65):new Vector3(-8,89,-69),scene);
camera.setTarget(portrait?new Vector3(35,105,90):new Vector3(3,75,125));camera.fov=portrait?.91:.79;camera.minZ=.1;camera.maxZ=1500;
const hemi=new HemisphericLight('sky-light',new Vector3(0,1,-.3),scene);hemi.intensity=.3;hemi.diffuse=new Color3(.25,.38,.70);hemi.groundColor=new Color3(.02,.02,.05);
const rim=new PointLight('cyan-rim',new Vector3(-60,125,0),scene);rim.diffuse=new Color3(.06,.7,1);rim.intensity=35;rim.range=170;
const magenta=new PointLight('pink-rim',new Vector3(85,85,15),scene);magenta.diffuse=new Color3(.9,.035,.28);magenta.intensity=22;magenta.range=160;
let seed=41783;function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}const rnd=(a:number,b:number)=>a+(b-a)*rand();
function material(name:string,color:Color3,emission=0){const m=new StandardMaterial(name,scene);m.diffuseColor=color;m.specularColor=new Color3(.5,.65,.9);m.specularPower=96;m.emissiveColor=color.scale(emission);return m;}
const black=material('anodized-night-metal',new Color3(.021,.027,.047));
const concrete=material('wet-concrete',new Color3(.05,.06,.087));
const cyan=material('cyan-guidance-light',new Color3(.03,.67,1),2.3),pink=material('magenta-sign-light',new Color3(.85,.025,.27),1.9),gold=material('warm-window',new Color3(1,.51,.19),1.4);
function box(name:string,x:number,y:number,z:number,w:number,h:number,d:number,m:Material){const b=MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene);b.position.set(x,y,z);b.material=m;return b;}
function glassTexture(idx:number){
 const tex=new DynamicTexture('facade-'+idx,{width:1024,height:2048},scene,false,Texture.TRILINEAR_SAMPLINGMODE);const c=tex.getContext();c.fillStyle='#070d19';c.fillRect(0,0,1024,2048);
 const cols=idx%2?18:24,rows=70;const cw=1024/cols,ch=2048/rows;
 for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
  const n=rand(),warm=rand()<.42;const value=n<.5?rnd(8,25):rnd(55,188);const rgb=warm?[value,value*.71,value*.37]:[value*.38,value*.69,value];c.fillStyle=`rgb(${rgb[0]|0},${rgb[1]|0},${rgb[2]|0})`;c.fillRect(col*cw+3,row*ch+2,cw-7,ch-6);
  if(n>.75){c.fillStyle='rgba(0,5,16,.65)';for(let j=0;j<3;j++)c.fillRect(col*cw+3,row*ch+6+j*6,cw-7,2);}
  if(n>.60){c.fillStyle='rgba(2,7,18,.6)';c.fillRect(col*cw+cw*.5,row*ch+2,2,ch-6);}
 }
 for(let i=0;i<12;i++){c.fillStyle='rgba(10,18,34,.6)';c.fillRect(i*89,0,7,2048);}c.fillStyle='#162439';for(let i=0;i<20;i++)c.fillRect(0,i*103,1024,3);
 tex.update(false);const m=new StandardMaterial('glass-windows-'+idx,scene);m.diffuseTexture=tex;m.emissiveTexture=tex;m.emissiveColor=new Color3(.72,.8,1);m.diffuseColor=new Color3(.45,.51,.66);m.specularColor=new Color3(.38,.52,.85);m.specularPower=150;return m;
}
const glasses=Array.from({length:7},(_,i)=>glassTexture(i));
const structures:Mesh[]=[];
function tower(x:number,z:number,w:number,h:number,d:number,idx:number){
 const m=glasses[idx%glasses.length];let levels=rand()<.45?3:1;for(let j=0;j<levels;j++){const height=j===0?h*.82:h*(1-.82)/(levels-1);const yy=j===0?height/2:h*.82+(j-.5)*height;structures.push(box('tower',x,yy,z,w*(1-j*.14),height,d*(1-j*.12),m));}
 if(levels===1)structures.push(box('cornice',x,h+1,z,w+1.2,2,d+1.2,concrete));
 for(let k=0;k<3;k++)box('rooftop-plant',x+rnd(-w*.32,w*.32),h+rnd(1,2),z+rnd(-d*.3,d*.3),rnd(1.2,4.2),rnd(1.2,3),rnd(1.5,4.5),black);
 if(idx%5===0){const e=idx%10===0?pink:cyan;box('vertical-light',x-w*.38,h*.52,z-d/2-.06,.16,h*.86,.08,e);box('crown-light',x,h+.3,z-d/2-.07,w*.95,.22,.10,e);}
 for(let k=1;k<4;k++)if(idx%4===0)box('mechanical-floor',x,h*k/4,z,w+.25,.7,d+.25,black);
 if(h>80){box('antenna',x,h+6,z,.12,12,.12,black);const sphere=MeshBuilder.CreateSphere('aviation-marker',{diameter:.4,segments:5},scene);sphere.position.set(x,h+12,z);sphere.material=pink;}
}
for(let row=0;row<9;row++)for(let col=0;col<18;col++){
 const x=(col-8.5)*27+rnd(-7,7),z=22+row*35+rnd(-8,8);let h=rnd(25,104)+(row>4?rnd(5,24):0);if(Math.abs(x)<25&&row<2)h*=.55;
 tower(x,z,rnd(12,23),h,rnd(12,22),row*18+col);
}
tower(39,122,24,166,23,31);tower(-71,99,25,142,22,40);
box('left-landmark-roof',-71,145,99,29,2,25,cyan);box('right-landmark-crown',39,168,122,22,1,21,pink);
for(let i=0;i<4;i++)box('crown-columns',39-9+i*6,175,122,.55,15,17,black);
function billboard(x:number,y:number,z:number,w:number,h:number,color:Material){
 const panel=box('billboard-shell',x,y,z,w+.8,h+.8,.5,black);box('billboard-light',x,y,z-.3,w,h,.12,color);
 for(let i=0;i<6;i++)box('display-cut',x-w*.36+i*w*.14,y+rnd(-h*.32,h*.32),z-.39,rnd(.2,.8),h*rnd(.18,.55),.08,black);
 return panel;
}
billboard(39,118,109.9,11,18,pink);billboard(-71,94,87.5,12,6,cyan);billboard(88,79,43,14,10,gold);
const roadPath=Array.from({length:81},(_,i)=>{const x=-240+i*6;return new Vector3(x,27+Math.sin((x+80)/130)*5,50+Math.sin(x/105)*19);});
const road=MeshBuilder.CreateRibbon('expressway',{pathArray:[roadPath.map(p=>p.add(new Vector3(0,0,-4))),roadPath.map(p=>p.add(new Vector3(0,0,4)))],sideOrientation:Mesh.DOUBLESIDE},scene);road.material=concrete;
for(const side of [-1,1]){const p=roadPath.map(p=>p.add(new Vector3(0,.6,side*3.9)));const rail=MeshBuilder.CreateTube('expressway-edge',{path:p,radius:.10,tessellation:5},scene);rail.material=side===1?pink:cyan;}
for(let i=2;i<79;i+=6){const p=roadPath[i];box('viaduct-pillar',p.x,p.y/2,p.z,1.6,p.y,1.6,black);}
const vehicles:Array<{mesh:Mesh;offset:number;direction:number}>=[];
for(let i=0;i<32;i++){const car=box('car',0,0,0,1.4,.65,2.5,black);const front=box('headlamp',0,.1,-1.28,.9,.12,.10,i%2?gold:pink);front.parent=car;vehicles.push({mesh:car,offset:i/32,direction:i%2?1:-1});}
const train=box('midnight-train',0,59,220,27,2.5,2.5,concrete);for(let i=0;i<13;i++){const win=box('train-window',-12+i*1.9,.15,-1.3,1.2,1.3,.06,gold);win.parent=train;}
box('rail-bridge',0,57,220,490,1,4,black);
const sill=box('window-sill',0,-9.2,26,100,.9,9,black);sill.parent=camera;
for(const xx of portrait?[-12.8,13.8]:[-20.7,22.5]){const post=box('window-mullion',xx,0,27,.34,55,.45,black);post.parent=camera;const line=box('window-rim',xx-.18,0,26.7,.035,55,.035,cyan);line.parent=camera;}
const rimBase=box('sill-reflection',0,-8.7,25.1,100,.055,.18,pink);rimBase.parent=camera;
const pipeline=new DefaultRenderingPipeline('cinema',true,scene,[camera]);pipeline.samples=4;pipeline.fxaaEnabled=true;pipeline.bloomEnabled=true;pipeline.bloomThreshold=.8;pipeline.bloomWeight=.42;pipeline.bloomKernel=56;pipeline.bloomScale=.5;
scene.imageProcessingConfiguration.toneMappingEnabled=true;scene.imageProcessingConfiguration.toneMappingType=1;scene.imageProcessingConfiguration.exposure=1.28;scene.imageProcessingConfiguration.contrast=1.18;
scene.imageProcessingConfiguration.vignetteEnabled=true;scene.imageProcessingConfiguration.vignetteWeight=1.6;scene.imageProcessingConfiguration.vignetteColor=new Color4(.005,.008,.022,1);
function render(t:number){for(const v of vehicles){const f=(v.offset+v.direction*t/12+2)%1,x=-235+f*470;const z=50+Math.sin(x/105)*19;v.mesh.position.set(x,27+Math.sin((x+80)/130)*5+.8,z+(v.direction>0?1.8:-1.8));v.mesh.rotation.y=Math.PI/2+Math.atan(Math.cos(x/105)*19/105);}train.position.x=-260+(t/12%1)*520;scene.render();}
(window as any).__cityRender=render;(window as any).__cityResize=()=>engine.resize();
void scene.whenReadyAsync().then(()=>{render(0);(window as any).__cityReady=true;});
