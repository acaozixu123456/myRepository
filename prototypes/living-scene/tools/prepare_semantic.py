"""V2 authored semantic envelopes + colour mattes; bounded edge repair for subpixel wind.
No depth bands are used to select shop, lantern, reflection or foreground vegetation.
"""
from pathlib import Path
import argparse, json, numpy as np, cv2
from PIL import Image,ImageDraw,ImageFilter
R=Path(__file__).resolve().parents[3];S=R/'art-source/living-scene';O=R/'prototypes/living-scene/public/scene';V=S/'v2'
parser=argparse.ArgumentParser()
parser.add_argument('--master',type=Path,default=S/'hero-original.png')
parser.add_argument('--work-dir',type=Path,default=V)
parser.add_argument('--evidence-dir',type=Path,default=R/'docs/living-scene/v2/evidence')
args=parser.parse_args(); V=args.work_dir
V.mkdir(exist_ok=True); cfg=json.loads((V/'semantic-regions.json').read_text());im=Image.open(args.master).convert('RGB');rgb=np.asarray(im);h,w=rgb.shape[:2];f=rgb.astype(np.float32)/255

def poly(points,blur=0):
 m=Image.new('L',(w,h));ImageDraw.Draw(m).polygon([(round(x*w),round(y*h))for x,y in points],fill=255)
 if blur:m=m.filter(ImageFilter.GaussianBlur(blur))
 return np.asarray(m).astype(np.float32)/255

def smooth(a,b,x):
 q=np.clip((x-a)/(b-a),0,1);return q*q*(3-2*q)
# Blue sky is the local backing colour. Fine twigs are dark; red leaves have positive R-B.
envelope=poly(cfg['foliage_envelope'],2)
red=smooth(-.015,.05,f[:,:,0]-f[:,:,2]);dark=1-smooth(.095,.185,f.max(axis=2))
leaf=np.maximum(red,dark)*envelope
# Keep narrow line coverage but remove isolated 1px chroma noise.
leaf=cv2.bilateralFilter(leaf,5,.1,2);leaf=smooth(.10,.78,leaf)
window=poly(cfg['window'],4);lantern=np.clip(sum(poly(p,2)for p in cfg['lanterns']),0,1)
reflection=poly(cfg['reflection'],15)*smooth(.005,.12,f[:,:,0]-f[:,:,2])*smooth(.10,.30,f.max(axis=2))
fog=poly(cfg['far_atmosphere'],24)
air=poly(cfg['shop_air'],12)*smooth(.08,.4,f.max(axis=2))
for name,a in [('foliage',leaf),('window',window),('lantern',lantern),('reflection',reflection),('fog',fog),('warm-air',air)]:
 Image.fromarray((a*255).round().astype(np.uint8)).save(V/f'matte-{name}.png')
# Foliage interior remains covered; repair only the 4px collar exposed by bounded 1px movement.
solid=(leaf>.05).astype(np.uint8)*255
repaired=cv2.inpaint(rgb,solid,3,cv2.INPAINT_TELEA)
inside=cv2.erode(solid,np.ones((9,9),np.uint8))
collar=np.clip((solid.astype(float)-inside)/255,0,1)
back=np.rint(rgb*(1-collar[:,:,None])+repaired*collar[:,:,None]).astype(np.uint8)
Image.fromarray(back).save(O/'foliage-back.webp',quality=96,method=6)
Image.fromarray(np.dstack([rgb,(leaf*255).round().astype(np.uint8)])).save(V/'foliage-rgba.png')
Image.fromarray((collar*255).astype(np.uint8)).save(V/'repair-collar.png')
# Two RGB atlases, three object IDs each. Full-resolution mattes remain editable above.
Image.fromarray((np.dstack([leaf,window,lantern])*255).round().astype(np.uint8)).save(O/'semantic-a.png')
Image.fromarray((np.dstack([reflection,fog,air])*255).round().astype(np.uint8)).save(O/'semantic-b.png')
# Local glow is baked from LDR highlights, not baked final lighting. Compared in A/B with runtime bloom.
linear=np.where(f<=.04045,f/12.92,((f+.055)/1.055)**2.4)
luma=np.sum(linear*np.array([.2126,.7152,.0722]),axis=2)
bright=linear*smooth(.40,.80,luma)[:,:,None]
glow=cv2.GaussianBlur(bright,(0,0),6)*.65+cv2.GaussianBlur(bright,(0,0),18)*.35
encoded=np.where(glow<=.0031308,glow*12.92,1.055*np.power(glow,1/2.4)-.055)
Image.fromarray(np.clip(encoded*255,0,255).astype(np.uint8)).resize((836,471),Image.Resampling.LANCZOS).save(O/'local-glow.webp',lossless=True,method=6)
# Inspection board, not a product image.
board=Image.new('RGB',(1500,660),(19,28,33));d=ImageDraw.Draw(board)
for i,name in enumerate(['foliage','window','lantern','reflection','fog','warm-air']):
 a=np.asarray(Image.open(V/f'matte-{name}.png'))/255
 tint=rgb*.33+np.dstack([a*150,a*200,a*30]);v=Image.fromarray(np.clip(tint,0,255).astype(np.uint8));v.thumbnail((490,282));x=i%3*500;y=i//3*330;board.paste(v,(x+5,y+32));d.text((x+12,y+10),name,fill='#f0dfba')
board.save(args.evidence_dir/'semantic-mattes.png')
report={'size':[w,h],'method':'authored object polygons + foreground colour matte; not depth thresholds','channels_a':['foliage','window','lantern'],'channels_b':['reflection','fog','warm_air'],'wind_max_source_pixels':[round(w*.00060,3),round(h*.00027,3)],'repair':'Telea radius 3px, applied only to a 4px inner foreground boundary collar; not global background reconstruction','coverage':{name:float(np.mean(a))for name,a in [('foliage',leaf),('window',window),('lantern',lantern),('reflection',reflection),('fog',fog),('warm_air',air)]}}
(V/'semantic-manifest.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
