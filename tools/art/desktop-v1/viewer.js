/* Only isolated asset inspection. No game imports, state, service worker or NHK access. */
const B=BABYLON,canvas=document.querySelector('canvas'),engine=new B.Engine(canvas,true,{preserveDrawingBuffer:true,stencil:true,powerPreference:'high-performance'});
engine.setHardwareScalingLevel(1/Math.min(devicePixelRatio,1.5));
const scene=new B.Scene(engine);scene.clearColor=new B.Color4(.77,.80,.76,1);scene.useRightHandedSystem=false;
const camera=new B.ArcRotateCamera('review',-Math.PI/2,1.30,13,new B.Vector3(0,2.2,1.8),scene);camera.attachControl(canvas,true);camera.minZ=.04;camera.wheelPrecision=30;camera.lowerRadiusLimit=.25;
const sky=new B.HemisphericLight('neutral sky',new B.Vector3(0,1,0),scene);sky.intensity=.85;sky.groundColor=new B.Color3(.40,.43,.38);
const sun=new B.DirectionalLight('review key',new B.Vector3(.5,-1,.6),scene);sun.position.set(-8,14,-8);sun.intensity=2.1;
const shadow=new B.ShadowGenerator(2048,sun);shadow.usePercentageCloserFiltering=true;shadow.filteringQuality=B.ShadowGenerator.QUALITY_MEDIUM;shadow.bias=.0003;shadow.normalBias=.012;
scene.imageProcessingConfiguration.toneMappingEnabled=true;scene.imageProcessingConfiguration.toneMappingType=B.ImageProcessingConfiguration.TONEMAPPING_ACES;scene.imageProcessingConfiguration.exposure=1;
const ground=B.MeshBuilder.CreateGround('viewer ground',{width:40,height:40},scene);ground.position.y=-.23;ground.receiveShadows=true;const gm=new B.PBRMaterial('viewer ground',scene);gm.albedoColor=new B.Color3(.55,.59,.53);gm.roughness=1;ground.material=gm;
let container=null,kind='shop',turn=false,warm=false,frames=[],last=performance.now(),loadErrors=[],originalAnchors={},loaded=false;
const gl=engine._gl,dbg=gl.getExtension('WEBGL_debug_renderer_info');const renderer=dbg?gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
function pose(name){if(kind==='shop'){
 const table={front:[-Math.PI/2,1.35,13.5,[0,2.35,1.5]],detail:[-Math.PI/2,1.50,4.2,[0,1.65,3.85]],side:[-.33,1.17,17,[0,2.4,2.6]],back:[Math.PI/2,1.24,13,[0,2.4,2.9]]};const [a,b,r,t]=table[name];camera.setTarget(B.Vector3.FromArray(t));camera.alpha=a;camera.beta=b;camera.radius=r;
 }else{camera.setTarget(new B.Vector3(0,name==='detail'?1.42:.88,0));camera.alpha=({front:-Math.PI/2,detail:-Math.PI/2,side:0,back:Math.PI/2})[name];camera.beta=1.42;camera.radius=name==='detail'?1.25:3.35;} }
async function load(k){loaded=false;kind=k;ground.position.y=k==='shop'?-.23:-.002;if(container)container.dispose();shadow.getShadowMap().renderList=[];frames=[];loadErrors=[];
 try{container=await B.SceneLoader.LoadAssetContainerAsync('/public/explore/assets/desktop-v1/',k==='shop'?'yorimichi-shop.glb':'yorimichi-keeper.glb',scene);container.addAllToScene();
  originalAnchors={};for(const n of [...container.transformNodes,...container.meshes])if(n.name.startsWith('ANCHOR')){n.computeWorldMatrix(true);originalAnchors[n.name]=n.getAbsolutePosition().asArray();}
  for(const mesh of container.meshes){if(mesh.getTotalVertices()){mesh.receiveShadows=true;shadow.addShadowCaster(mesh);}}
  document.querySelector('#clip').innerHTML='<option value="">静止姿态</option>'+container.animationGroups.map(a=>'<option>'+a.name+'</option>').join('');
  pose('front');loaded=true;window.assetReady=true;
 }catch(e){loadErrors.push(String(e));document.querySelector('#status').textContent='加载失败：'+e;throw e;}}
function report(){let bounds=null;if(container){const mins=[Infinity,Infinity,Infinity],maxs=[-Infinity,-Infinity,-Infinity];for(const m of container.meshes)if(m.getTotalVertices()){m.computeWorldMatrix(true);const b=m.getBoundingInfo().boundingBox;for(let i=0;i<3;i++){mins[i]=Math.min(mins[i],b.minimumWorld.asArray()[i]);maxs[i]=Math.max(maxs[i],b.maximumWorld.asArray()[i]);}}bounds={min:mins,max:maxs};}let sorted=frames.slice().sort((a,b)=>a-b),q=p=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))]||null;
 return {asset:kind,bounds,babylon:B.Engine.Version,browser:navigator.userAgent,renderer,softwareRenderer:/swiftshader|llvmpipe|software/i.test(renderer),devicePixelRatio,screen:[screen.width,screen.height],viewport:[innerWidth,innerHeight],renderResolution:[engine.getRenderWidth(),engine.getRenderHeight()],frameSamples:frames.length,frameTimeMs:{p50:q(.5),p95:q(.95),p99:q(.99)},shadowResolution:2048,light:warm?'warm':'neutral',importedAnchors:originalAnchors,meshCount:container?.meshes.filter(m=>m.getTotalVertices()).length,triangles:container?.meshes.reduce((n,m)=>n+m.getTotalIndices()/3,0),vertices:container?.meshes.reduce((n,m)=>n+m.getTotalVertices(),0),materials:container?.materials.length,animationGroups:container?.animationGroups.map(g=>({name:g.name,from:g.from,to:g.to})),errors:loadErrors,loaded};}
window.review={report,pose,load,scene,camera,engine,startMeasurement(){frames=[];last=performance.now();},setRotation(v){turn=v;},play(name){container.animationGroups.forEach(g=>g.stop());container.animationGroups.find(g=>g.name===name)?.start(true);}};
engine.runRenderLoop(()=>{const now=performance.now();if(loaded&&document.visibilityState==='visible'&&frames.length<20000)frames.push(now-last);last=now;if(turn)camera.alpha+=engine.getDeltaTime()*.00018;scene.render();});
setInterval(()=>{if(loaded){const r=report();document.querySelector('#status').textContent=`${kind==='shop'?'便当店候选':'店员候选'} · Babylon.js ${r.babylon}\n${Math.round(r.triangles).toLocaleString()} 三角形 · ${r.materials} 材质\n${r.renderResolution.join(' × ')} · 中位帧时 ${r.frameTimeMs.p50?.toFixed(1)} ms\n${renderer}${r.softwareRenderer?'\n软件渲染：不能作为硬件验收':''}`;}},1000);
for(const name of ['front','detail','side','back'])document.getElementById(name).onclick=()=>pose(name);
document.querySelector('#asset').onchange=e=>load(e.target.value);document.querySelector('#rotate').onclick=()=>turn=!turn;
document.querySelector('#light').onclick=()=>{warm=!warm;sun.diffuse=B.Color3.FromHexString(warm?'#ffd6a0':'#ffffff');sky.diffuse=B.Color3.FromHexString(warm?'#c8d8e1':'#ffffff');};
document.querySelector('#clip').onchange=e=>window.review.play(e.target.value);
document.querySelector('#report').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(report(),null,2)],{type:'application/json'}));a.download=kind+'-browser-report.json';a.click();URL.revokeObjectURL(a.href);};
window.addEventListener('resize',()=>engine.resize());load(new URLSearchParams(location.search).get('asset')==='keeper'?'keeper':'shop');
