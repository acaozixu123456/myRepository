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

css=Path('src/explore/cinematic-v3.css')
c=css.read_text()
def crep(old,new):
    global c
    if new in c:return
    assert c.count(old)==1,old[:180]
    c=c.replace(old,new)

crep("#explore-root #modal-layer{align-items:flex-end;justify-content:center;padding:0 28px 18px;background:linear-gradient(0deg,rgba(4,11,8,.42),rgba(4,11,8,.035) 48%,transparent 72%);backdrop-filter:none}", "#explore-root #modal-layer{align-items:flex-end;justify-content:flex-start;padding:0 28px 22px;background:radial-gradient(ellipse at 22% 100%,rgba(4,11,8,.34),rgba(4,11,8,.07) 45%,transparent 72%);backdrop-filter:none}")
crep("#modal-layer .panel,#modal-layer .panel.wide{width:min(860px,calc(100vw - 56px));max-height:38vh;padding:14px 18px 12px;border-radius:17px;background:linear-gradient(180deg,rgba(18,29,25,.72),rgba(11,20,17,.90));color:#f5edda;border:1px solid rgba(241,228,198,.14);box-shadow:0 16px 62px #0008;backdrop-filter:blur(17px) saturate(.88);scrollbar-color:#756d5c transparent;overflow:auto}", "#explore-root #modal-layer .panel,#explore-root #modal-layer .panel.wide{width:min(580px,calc(100vw - 56px));max-height:34vh;padding:12px 15px 10px;border-radius:15px;background:linear-gradient(180deg,rgba(18,29,25,.63),rgba(10,19,16,.84));color:#f5edda;border:1px solid rgba(241,228,198,.12);box-shadow:0 14px 46px #0007;backdrop-filter:blur(12px) saturate(.90);scrollbar-color:#756d5c transparent;overflow:auto}")
crep("#modal-layer .spoken>p{color:#fff4de;font-size:16px;line-height:1.45}", "#modal-layer .spoken>p{color:#fff4de;font-size:15px;line-height:1.42}")
css.write_text(c)
