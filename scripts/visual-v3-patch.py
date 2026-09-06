from pathlib import Path
p=Path('src/explore/world.ts')
s=p.read_text()

def rep(old,new):
    global s
    if new in s:
        return
    assert s.count(old)==1, old[:120]
    s=s.replace(old,new)

rep("import {DirectionalLight} from '@babylonjs/core/Lights/directionalLight';", "import {DirectionalLight} from '@babylonjs/core/Lights/directionalLight';\nimport {PointLight} from '@babylonjs/core/Lights/pointLight';")
rep("engine.setHardwareScalingLevel(1/Math.min(devicePixelRatio||1,coarse?1.15:1.5));", "// Desktop renders at native canvas resolution; mobile may downscale. Supersampling here made the cinematic pass unnecessarily expensive.\n  engine.setHardwareScalingLevel(coarse?1.18:1);")
rep("scene.imageProcessingConfiguration.contrast=1.16;\n  scene.imageProcessingConfiguration.exposure=.91;", "scene.imageProcessingConfiguration.contrast=1.13;\n  scene.imageProcessingConfiguration.exposure=.82;")
rep("cinematic.samples=coarse?1:2;cinematic.fxaaEnabled=true;cinematic.bloomEnabled=true;cinematic.bloomThreshold=.82;cinematic.bloomWeight=.16;cinematic.bloomKernel=40;", "cinematic.samples=1;cinematic.fxaaEnabled=true;cinematic.bloomEnabled=true;cinematic.bloomThreshold=.90;cinematic.bloomWeight=.10;cinematic.bloomKernel=28;")
rep("const hemi=new HemisphericLight('sky',new Vector3(.12,1,-.18),scene);hemi.intensity=.48;hemi.diffuse=Color3.FromHexString('#bfd1d0');hemi.groundColor=Color3.FromHexString('#765f4a');", "const hemi=new HemisphericLight('sky',new Vector3(.12,1,-.18),scene);hemi.intensity=.42;hemi.diffuse=Color3.FromHexString('#b8cbcc');hemi.groundColor=Color3.FromHexString('#6f5a48');")
rep("const sun=new DirectionalLight('afternoon',new Vector3(-.72,-.66,.34),scene);sun.position=new Vector3(46,58,-18);sun.intensity=2.35;sun.diffuse=Color3.FromHexString('#ffd6a0');sun.specular=Color3.FromHexString('#fff2d8');", "const sun=new DirectionalLight('afternoon',new Vector3(-.72,-.66,.34),scene);sun.position=new Vector3(46,58,-18);sun.intensity=1.72;sun.diffuse=Color3.FromHexString('#f6c895');sun.specular=Color3.FromHexString('#f7dfc4');")
rep("function mat(color:string){let m=mats.get(color);if(!m){m=new StandardMaterial('m'+color,scene);m.diffuseColor=Color3.FromHexString(color);m.specularColor=new Color3(.085,.08,.07);m.specularPower=48;m.ambientColor=Color3.FromHexString(color).scale(.08);mats.set(color,m);}return m;}", "function mat(color:string){let m=mats.get(color);if(!m){m=new StandardMaterial('m'+color,scene);const base=Color3.FromHexString(color);m.diffuseColor=base;m.specularColor=new Color3(.06,.055,.05);m.specularPower=42;m.ambientColor=base.scale(.08);if(color==='#f0c29f'||color==='#f2c7a5'){m.emissiveColor=base.scale(.035);m.specularPower=18;}mats.set(color,m);}return m;}")
rep("const roadMat=mat('#b0a18a');const roadTex=new DynamicTexture('paving',{width:512,height:512},scene,false);", "const roadMat=mat('#958a77');const roadTex=new DynamicTexture('paving',{width:512,height:512},scene,false);")
rep("c.fillStyle='#b4a58f';c.fillRect(0,0,512,512);", "c.fillStyle='#9d927f';c.fillRect(0,0,512,512);")
rep("const paving=box(7.3,.1,len+.18,0,0,0,'#b0a18a',root,true);paving.material=roadMat;", "const paving=box(7.3,.1,len+.18,0,0,0,'#958a77',root,true);paving.material=roadMat;")
rep("label('本日の日替わり',2.8,.75,0,2.04,5.56,'#e9dfc4','#454f42',root,'手づくりのお弁当');\n        for(let i=0;i<4;i++)", "label('本日の日替わり',2.8,.75,0,2.04,5.56,'#e9dfc4','#454f42',root,'手づくりのお弁当');\n        const shopLight=new PointLight('shop-warm-light',new Vector3(0,2.15,2.5),scene);shopLight.parent=root;shopLight.diffuse=Color3.FromHexString('#ffd3a0');shopLight.specular=Color3.FromHexString('#d99b68');shopLight.intensity=.72;shopLight.range=8.5;\n        for(const lx of [-2.0,0,2.0]){const bulb=sphere(.055,.055,.055,lx,2.42,2.4,'#f4c27d',root,false);bulb.material=lampGlow;}\n        for(let i=0;i<4;i++)")

p.write_text(s)
