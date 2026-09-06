"""Original deterministic, neutral PBR surface textures. Requires Pillow, numpy, OFL Noto Sans JP."""
import argparse, pathlib, numpy as np
from PIL import Image, ImageDraw, ImageFont
p=argparse.ArgumentParser();p.add_argument('--font',required=True);a=p.parse_args()
ROOT=pathlib.Path(__file__).resolve().parents[3]; OUT=ROOT/'public/explore/assets/desktop-v1/textures';OUT.mkdir(parents=True,exist_ok=True)
rng=np.random.default_rng(20260906);n=1024;y,x=np.mgrid[0:n,0:n]/n

def surface(name,color,height,rough,amp):
    noise=rng.normal(0,1,(n,n));v=height-height.mean()
    rgb=np.clip(np.array(color)[None,None,:]+v[:,:,None]*amp+noise[:,:,None]*.8,0,255).astype('uint8')
    Image.fromarray(rgb).save(OUT/(name+'_basecolor.png'))
    dy,dx=np.gradient(height);normal=np.stack((-dx*3,-dy*3,np.ones_like(x)),axis=-1);normal/=np.linalg.norm(normal,axis=-1,keepdims=True)
    Image.fromarray(np.uint8((normal*.5+.5)*255)).save(OUT/(name+'_normal.png'))
    # glTF ORM: R = unoccluded 1; G = roughness; B = metallic 0.
    orm=np.stack((np.ones_like(x)*255,np.clip(rough+v*8,0,255),np.zeros_like(x)),axis=-1).astype('uint8')
    Image.fromarray(orm).save(OUT/(name+'_orm.png'))

wood=np.sin(2*np.pi*(x*38+np.sin(y*2*np.pi)*.22+np.sin(y*6*np.pi)*.13))*.18
wood+=np.sin(2*np.pi*(x*120+np.sin(y*4*np.pi)*.5))*.075
wood+=np.cos(x*2*np.pi*4)*.3
surface('cedar',(151,109,73),wood,182,29)
plaster=rng.normal(0,.2,(n,n))+np.sin(x*2*np.pi*7)*np.cos(y*2*np.pi*5)*.05
surface('plaster',(221,215,191),plaster,230,9)
cloth=(np.cos(x*2*np.pi*256)+np.cos(y*2*np.pi*256))*.07+rng.normal(0,.025,(n,n))
surface('cloth',(55,89,79),cloth,240,22)
surface('roof',(77,90,87),np.sin(x*2*np.pi*14)*.08+rng.normal(0,.1,(n,n)),185,17)
# A single atlas for all labels. Each region is a complete editable text label in signs.json.
import json
spec=[('shop','よりみち弁当','あたたかいごはん、あります。'),('menu','日替わり弁当','650円　・　袋 3円'),('daily','本日の日替わり','手づくりのお弁当'),('noren','弁 当','よりみち'),('open','営業中','11:00—18:00'),('rice','ごはん大盛り','お気軽にどうぞ'),('price','鶏の照り焼き','650円'),('thanks','ありがとうございます','またお立ち寄りください')]
im=Image.new('RGB',(2048,2048),(238,231,209));d=ImageDraw.Draw(im)
for i,(key,title,sub) in enumerate(spec):
    row=i*256;bg=(55,89,79) if key=='noren' else (238,231,209);fg=(240,232,203) if key=='noren' else (45,76,65)
    d.rectangle((0,row,2047,row+255),fill=bg)
    d.line((60,row+25,1988,row+25),fill=fg,width=2);d.line((60,row+230,1988,row+230),fill=fg,width=2)
    width=[2048,384,1189,448,472,1024,869,1400][i]
    cx=width/2
    font=ImageFont.truetype(a.font,min(160,int(width*.85/len(title))))
    font.set_variation_by_axes([600])
    d.text((cx,row+90),title,font=font,fill=fg,anchor='mm')
    d.text((cx,row+188),sub,font=ImageFont.truetype(a.font,min(40,int(width*.90/len(sub)))),fill=fg,anchor='mm')
im.save(OUT/'signs_basecolor.png')
(ROOT/'art-source/desktop-v1/signs.json').write_text(json.dumps(spec,ensure_ascii=False,indent=2)+'\n')
print('Wrote 13 PNG textures, signs atlas is 2048²; surfaces 1024².')
