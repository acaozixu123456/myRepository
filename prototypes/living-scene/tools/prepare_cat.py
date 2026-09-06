"""Extract technical alpha mattes from imagegen-painted poses; preserve raw RGB originals.
Checkerboard in first two generated files is baked RGB, not transparency.
No real cat photograph is cut out or shipped. All character pixels were painted by imagegen.
"""
from pathlib import Path
import json, cv2, numpy as np
from PIL import Image, ImageDraw
R=Path(__file__).resolve().parents[3]
S=R/'art-source/living-scene/cat-v1'; O=R/'prototypes/living-scene/public/cat'
O.mkdir(exist_ok=True)
rows=[]; previews=[]
for name in ['alert-loaf','attentive','content']:
    rgb=np.array(Image.open(S/'raw'/f'latte-{name}.png').convert('RGB'))
    h,w=rgb.shape[:2]; f=rgb.astype(np.float32)
    if name=='content':
        bg=(f[:,:,2]>f[:,:,0]*1.15)&(f[:,:,1]>f[:,:,0]*1.08)&(f[:,:,0]<110)
    else:
        bg=(f.min(axis=2)>214)&((f.max(axis=2)-f.min(axis=2))<14)
    # Only background components connected to the frame count as certain background.
    count,labels=cv2.connectedComponents(bg.astype(np.uint8))
    border=np.unique(np.r_[labels[0],labels[-1],labels[:,0],labels[:,-1]])
    exterior=np.isin(labels,border[border!=0]).astype(np.uint8)
    foreground=1-exterior
    n,labels,stats,_=cv2.connectedComponentsWithStats(foreground)
    solid=(labels==(1+np.argmax(stats[1:,cv2.CC_STAT_AREA]))).astype(np.uint8)
    mask=np.full((h,w),cv2.GC_PR_BGD,np.uint8)
    mask[solid>0]=cv2.GC_PR_FGD
    mask[cv2.erode(solid,np.ones((9,9),np.uint8))>0]=cv2.GC_FGD
    mask[cv2.erode(exterior,np.ones((5,5),np.uint8))>0]=cv2.GC_BGD
    if name=='content':
        # The cool painted neck shares the backing hue: preserve its observed interior.
        protect=np.array([[.18,.48],[.15,.54],[.145,.61],[.15,.68],[.16,.74],[.23,.78],[.44,.73],[.43,.51]])
        cv2.fillPoly(mask,[(protect*np.array([w,h])).astype(np.int32)],cv2.GC_FGD)
    cv2.grabCut(rgb,mask,None,np.zeros((1,65),np.float64),np.zeros((1,65),np.float64),4,cv2.GC_INIT_WITH_MASK)
    a=((mask==cv2.GC_FGD)|(mask==cv2.GC_PR_FGD)).astype(np.uint8)
    # Remove isolated generated checker specks, retain interior coat highlights.
    n,lab,stats,_=cv2.connectedComponentsWithStats(a)
    a=(lab==(1+np.argmax(stats[1:,cv2.CC_STAT_AREA]))).astype(np.uint8)
    alpha=cv2.GaussianBlur(a.astype(np.float32),(0,0),.45)
    alpha[alpha<.02]=0;alpha[alpha>.98]=1
    rgba=np.dstack([rgb,(alpha*255).astype(np.uint8)])
    Image.fromarray(rgba).save(S/f'latte-{name}-rgba.png')
    Image.fromarray((alpha*255).astype(np.uint8)).save(S/f'matte-{name}.png')
    Image.fromarray(rgba).save(O/f'{name}.webp',lossless=True,method=6)
    bgcol=np.array([24,31,36]); preview=np.rint(rgb*alpha[:,:,None]+bgcol*(1-alpha[:,:,None])).astype(np.uint8)
    previews.append(Image.fromarray(preview))
    ys,xs=np.where(alpha>.5)
    rows.append({'pose':name,'size':[w,h],'source_alpha':False,'output_alpha':True,'bounds':[int(xs.min()),int(ys.min()),int(xs.max()),int(ys.max())],'coverage':float((alpha>.5).mean()),'method':'border-connected background classification + GrabCut + 0.45px edge softening','limits':'Fine white whiskers and subpixel fur may be lost; inspect against dark scene. Not a hand-perfect matte.'})
sheet=Image.new('RGB',(1500,535),(24,31,36));d=ImageDraw.Draw(sheet)
for i,im in enumerate(previews):
    im.thumbnail((500,500));sheet.paste(im,(i*500,35));d.text((i*500+15,12),rows[i]['pose'],fill='#e9d3b4')
sheet.save(R/'docs/living-scene/cat-v1/evidence/cat-mattes.png')
(S/'matte-manifest.json').write_text(json.dumps(rows,indent=2)+'\n')
print(json.dumps(rows,indent=2))
