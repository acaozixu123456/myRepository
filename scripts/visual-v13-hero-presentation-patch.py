from pathlib import Path
p=Path('src/explore/world.ts')
s=p.read_text()

def rep(old,new):
    global s
    if new in s:return
    assert s.count(old)==1,old[:220]
    s=s.replace(old,new)

rep("shopLight.intensity=.72;shopLight.range=8.5;", "shopLight.intensity=.98;shopLight.range=9.2;\n        const keeperFill=new PointLight('shop-keeper-fill',new Vector3(-.45,2.35,1.55),scene);keeperFill.parent=root;keeperFill.diffuse=Color3.FromHexString('#ffd7ad');keeperFill.specular=Color3.FromHexString('#d6a27f');keeperFill.intensity=.42;keeperFill.range=5.4;\n        const keeperRim=new PointLight('shop-keeper-rim',new Vector3(.65,2.55,5.15),scene);keeperRim.parent=root;keeperRim.diffuse=Color3.FromHexString('#f0b67c');keeperRim.specular=Color3.FromHexString('#d58f62');keeperRim.intensity=.26;keeperRim.range=3.8;")
p.write_text(s)
