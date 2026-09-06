from pathlib import Path
p=Path('src/explore/world.ts')
s=p.read_text()

def rep(old,new):
    global s
    if new in s:return
    assert s.count(old)==1,old[:160]
    s=s.replace(old,new)

rep("const roadMat=mat('#62635f');const roadTex=new DynamicTexture('paving',{width:512,height:512},scene,false);", "const roadMat=mat('#72736e');const roadTex=new DynamicTexture('paving',{width:512,height:512},scene,false);")
rep("c.fillStyle='#666762';c.fillRect(0,0,512,512);", "c.fillStyle='#747570';c.fillRect(0,0,512,512);")
rep("roadTex.update();roadTex.uScale=1.9;roadTex.vScale=7.2;roadMat.diffuseTexture=roadTex;roadMat.specularColor=new Color3(.025,.025,.023);roadMat.specularPower=20;", "roadTex.update();roadTex.uScale=1.9;roadTex.vScale=7.2;roadMat.diffuseTexture=roadTex;roadMat.specularColor=new Color3(.025,.025,.023);roadMat.specularPower=20;roadMat.emissiveColor=Color3.FromHexString('#777971').scale(.075);")
rep("const paving=box(7.3,.1,len+.18,0,0,0,'#62635f',root,true);paving.material=roadMat;", "const paving=box(7.3,.1,len+.18,0,0,0,'#72736e',root,true);paving.material=roadMat;")
p.write_text(s)
