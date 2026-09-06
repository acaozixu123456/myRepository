from pathlib import Path
p=Path('src/explore/world.ts')
s=p.read_text()

def rep(old,new):
    global s
    if new in s:
        return
    assert s.count(old)==1, old[:140]
    s=s.replace(old,new)

rep("import {DefaultRenderingPipeline} from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline';", "import {DefaultRenderingPipeline} from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline';\nimport {ShaderMaterial} from '@babylonjs/core/Materials/shaderMaterial';")

start=s.index("  // Lightweight procedural atmosphere:")
end=s.index("  const hemi=new HemisphericLight",start)
shader="""  // Directional procedural sky. The horizon and visible sun glow share the same late-afternoon direction as the key light.\n  const skyMat=new ShaderMaterial('yanaka-sky-mat',scene,{\n    vertexSource:`precision highp float;attribute vec3 position;uniform mat4 worldViewProjection;varying vec3 vDir;void main(void){vDir=normalize(position);gl_Position=worldViewProjection*vec4(position,1.0);}`,\n    fragmentSource:`precision highp float;varying vec3 vDir;void main(void){vec3 d=normalize(vDir);float h=clamp(d.y*.5+.5,0.0,1.0);vec3 horizon=vec3(.78,.60,.44);vec3 middle=vec3(.55,.64,.66);vec3 zenith=vec3(.27,.39,.47);vec3 col=mix(horizon,middle,smoothstep(.48,.70,h));col=mix(col,zenith,smoothstep(.69,1.0,h));vec3 sunDir=normalize(vec3(-.52,.48,.70));float sd=max(dot(d,sunDir),0.0);float halo=pow(sd,12.0);float disc=pow(sd,260.0);col+=vec3(1.0,.58,.30)*halo*.26+vec3(1.0,.88,.68)*disc*1.15;float band=1.0-smoothstep(.48,.59,h);col=mix(col,vec3(.73,.64,.54),band*.11);gl_FragColor=vec4(col,1.0);}`\n  },{attributes:['position'],uniforms:['worldViewProjection']});\n  skyMat.backFaceCulling=false;skyMat.disableDepthWrite=true;\n  const sky=MeshBuilder.CreateSphere('yanaka-atmosphere',{diameter:390,segments:28,sideOrientation:Mesh.BACKSIDE},scene);sky.material=skyMat;sky.infiniteDistance=true;sky.isPickable=false;sky.applyFog=false;\n"""
s=s[:start]+shader+s[end:]
rep("const sun=new DirectionalLight('afternoon',new Vector3(-.72,-.66,.34),scene);sun.position=new Vector3(46,58,-18);sun.intensity=1.72;sun.diffuse=Color3.FromHexString('#f6c895');sun.specular=Color3.FromHexString('#f7dfc4');", "const sun=new DirectionalLight('afternoon',new Vector3(.52,-.48,-.70),scene);sun.position=new Vector3(-55,52,82);sun.intensity=1.62;sun.diffuse=Color3.FromHexString('#f4c48d');sun.specular=Color3.FromHexString('#f7dfc4');")

p.write_text(s)
