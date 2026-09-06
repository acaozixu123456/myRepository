from pathlib import Path
p=Path('src/explore/world.ts')
s=p.read_text()

def rep(old,new):
    global s
    if new in s:
        return
    assert s.count(old)==1, old[:140]
    s=s.replace(old,new)

rep("scene.clearColor=new Color4(.55,.66,.68,1);\n  scene.fogMode=Scene.FOGMODE_EXP2;scene.fogColor=Color3.FromHexString('#9eada9');scene.fogDensity=.0042;",
"scene.clearColor=new Color4(.43,.55,.60,1);\n  scene.fogMode=Scene.FOGMODE_EXP2;scene.fogColor=Color3.FromHexString('#b8aa98');scene.fogDensity=.00355;")

anchor="cinematic.samples=1;cinematic.fxaaEnabled=true;cinematic.bloomEnabled=true;cinematic.bloomThreshold=.90;cinematic.bloomWeight=.10;cinematic.bloomKernel=28;"
insert=anchor+"\n  // Lightweight procedural atmosphere: a cool upper sky, warm late-afternoon horizon and restrained haze.\n  // This intentionally avoids an HDRI dependency so the current prototype stays self-contained while hero assets are built separately.\n  const skyTex=new DynamicTexture('yanaka-sky',{width:1024,height:512},scene,false);\n  {const ctx=skyTex.getContext() as CanvasRenderingContext2D;const grad=ctx.createLinearGradient(0,0,0,512);\n    grad.addColorStop(0,'#536d79');grad.addColorStop(.28,'#738a91');grad.addColorStop(.57,'#9da7a2');grad.addColorStop(.76,'#c7ad8f');grad.addColorStop(1,'#b88f70');ctx.fillStyle=grad;ctx.fillRect(0,0,1024,512);\n    const glow=ctx.createRadialGradient(190,350,8,190,350,230);glow.addColorStop(0,'rgba(255,224,174,.62)');glow.addColorStop(.28,'rgba(249,194,139,.22)');glow.addColorStop(1,'rgba(249,194,139,0)');ctx.fillStyle=glow;ctx.fillRect(0,100,520,410);\n    ctx.globalAlpha=.10;ctx.fillStyle='#e8ddd0';for(const cloud of [[650,145,170,24],[760,205,120,18],[410,110,135,16],[900,95,90,12]]){ctx.beginPath();ctx.ellipse(cloud[0],cloud[1],cloud[2],cloud[3],0,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;skyTex.update();}\n  const skyMat=new StandardMaterial('yanaka-sky-mat',scene);skyMat.disableLighting=true;skyMat.backFaceCulling=false;skyMat.diffuseColor=Color3.Black();skyMat.specularColor=Color3.Black();skyMat.emissiveTexture=skyTex;skyMat.fogEnabled=false;\n  const sky=MeshBuilder.CreateSphere('yanaka-atmosphere',{diameter:390,segments:24,sideOrientation:Mesh.BACKSIDE},scene);sky.material=skyMat;sky.infiniteDistance=true;sky.isPickable=false;sky.applyFog=false;"
rep(anchor,insert)

p.write_text(s)
