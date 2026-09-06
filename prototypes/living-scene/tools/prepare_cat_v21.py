"""Technical alpha extraction and contact registration; no synthetic morph in-betweens.
Motion canvases have extra transparent space for unfolded legs/tail, at a constant
anatomical scale. The accepted resting sprite is kept pixel-for-pixel unchanged.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np, cv2, json, hashlib
root=Path(__file__).resolve().parents[3]
source=root/'art-source/living-scene/cat-v21';out=root/'prototypes/living-scene/public/cat-v21'
old=root/'art-source/living-scene/cat-v2'
size=640;baseline=round(size*.825);records=[];previews=[]
im=np.array(Image.open(source/'transition-atlas-raw.png').convert('RGB'));h,w=im.shape[:2]
# A single anatomical scale for the entire generated transition atlas. Never
# normalize the width of each pose: a standing body is naturally more extended.
scale=1.46
for d in ['left','right']:
 for frame in range(6):
  name=f'transition-{d}-{frame}';i=frame+(6 if d=='right' else 0)
  # The generated grid is not mathematically uniform. Cuts follow observed empty
  # gutters, including the lower-row ears and the rightmost tail tips.
  xc=[0,500,970,w];yc=[0,282,522,715,h]
  cell=[xc[i%3],yc[i//3],xc[i%3+1],yc[i//3+1]]
  rgb=im[cell[1]:cell[3],cell[0]:cell[2]].copy();f=rgb.astype(float)
  bg=(f.min(axis=2)>220)&(f.max(axis=2)-f.min(axis=2)<17)
  _,lab=cv2.connectedComponents(bg.astype(np.uint8));border=np.unique(np.r_[lab[0],lab[-1],lab[:,0],lab[:,-1]])
  exterior=np.isin(lab,border[border!=0]).astype(np.uint8)
  mask=np.where(exterior>0,cv2.GC_BGD,cv2.GC_PR_FGD).astype(np.uint8)
  mask[cv2.erode(1-exterior,np.ones((5,5),np.uint8))>0]=cv2.GC_FGD
  cv2.grabCut(rgb,mask,None,np.zeros((1,65)),np.zeros((1,65)),3,cv2.GC_INIT_WITH_MASK)
  alpha=((mask==cv2.GC_FGD)|(mask==cv2.GC_PR_FGD)).astype(np.uint8)
  _,lab,stats,_=cv2.connectedComponentsWithStats(alpha)
  alpha=(lab==(1+np.argmax(stats[1:,cv2.CC_STAT_AREA]))).astype(float)
  alpha=cv2.GaussianBlur(alpha,(0,0),.35);alpha[alpha<.03]=0;alpha[alpha>.97]=1
  ys,xs=np.where(alpha>.5);bounds=[int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)]
  rgba=Image.fromarray(np.dstack([rgb,(alpha*255).astype(np.uint8)]))
  crop=rgba.crop(bounds);target=(round(crop.width*scale),round(crop.height*scale));crop=crop.resize(target,Image.Resampling.LANCZOS)
  # Body contact centre excludes the progressively uncurled tail; the paws stay
  # on the same floor baseline. Right frame 0 is deliberately NOT mirrored.
  center=([.50,.48,.45,.44,.43,.43] if d=='left' else [.50,.48,.47,.55,.57,.57])[frame]
  canvas=Image.new('RGBA',(size,size));paste=(round(size*.5-target[0]*center),baseline-target[1]);canvas.paste(crop,paste)
  if frame==0:
   canvas=Image.new('RGBA',(size,size));rest=Image.open(old/'observing-rgba.png');paste=((size-384)//2,baseline-round(384*.825));canvas.paste(rest,paste)
  canvas.save(source/f'{name}-rgba.png');canvas.save(out/f'{name}.webp',lossless=True,method=6)
  records.append({'name':name,'cell':cell,'bounds':bounds,'scale':scale if frame else 1,'paste':paste,'size':[size,size],'source':'transition-atlas-raw.png' if frame else '../cat-v2/observing-rgba.png','baseline':baseline,'bodyCenterFraction':center})
  previews.append((name,canvas))
# Walking shares the transition head/body scale. Additional transparent canvas
# space is rendered at the same pixel density; this is not a runtime scale pulse.
walkScale=1.56
for d in ['left','right']:
 for frame in range(4):
  name=f'walk-{d}-{frame}';rgba=Image.open(old/f'{name}-rgba.png');b=rgba.getbbox();crop=rgba.crop(b)
  target=(round(crop.width*walkScale),round(crop.height*walkScale));crop=crop.resize(target,Image.Resampling.LANCZOS)
  center=.43 if d=='left' else .57
  canvas=Image.new('RGBA',(size,size));paste=(round(size*.5-target[0]*center),baseline-target[1]);canvas.paste(crop,paste)
  canvas.save(source/f'{name}-rgba.png');canvas.save(out/f'{name}.webp',lossless=True,method=6)
  records.append({'name':name,'source':f'../cat-v2/{name}-rgba.png','bounds':b,'scale':walkScale,'paste':paste,'size':[size,size],'baseline':baseline,'bodyCenterFraction':center})
  previews.append((name,canvas))
sheet=Image.new('RGB',(1536,5*280),(24,31,36));draw=ImageDraw.Draw(sheet)
for i,(name,canvas) in enumerate(previews):
 x=i%4*384;y=i//4*280;thumb=canvas.resize((256,256),Image.Resampling.LANCZOS);sheet.paste(thumb,(x+64,y+24),thumb);draw.text((x+12,y+8),name,fill='#ead1a4')
sheet.save(root/'docs/living-scene/cat-v21/evidence/atlas-mattes.png')
(source/'atlas-manifest.json').write_text(json.dumps({'canvas':size,'restCanvas':384,'transitionScale':scale,'walkScale':walkScale,'records':records},indent=2)+'\n')
(source/'source-inventory.json').write_text(json.dumps([{'file':str(p.relative_to(source)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in source.glob('*.png')],indent=2)+'\n')
print('20 contact-registered motion textures; first pose reuses the unchanged resting sprite.')
