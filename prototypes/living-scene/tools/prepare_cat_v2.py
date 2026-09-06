"""Technical atlas slicing and alpha extraction, preserving unedited generated masters."""
from pathlib import Path
from PIL import Image, ImageDraw
import cv2, numpy as np, json
root=Path(__file__).resolve().parents[3]
source=root/'art-source/living-scene/cat-v2';out=root/'prototypes/living-scene/public/cat-v2'
out.mkdir(exist_ok=True);records=[];previews=[]
for atlas,cols,rows,names in [('walk',4,2,[f'walk-{d}-{i}' for d in ['left','right'] for i in range(4)]),('rest',3,1,['observing','attentive','content'])]:
    im=np.array(Image.open(source/f'{atlas}-atlas-raw.png').convert('RGB'));h,w=im.shape[:2]
    cells=[]
    for i,name in enumerate(names):
        x0=round(i%cols*w/cols);x1=round((i%cols+1)*w/cols)
        if atlas=='walk' and i>=4:
            # Observed generated placement crosses nominal cell edges at two tail tips.
            cuts=[0,390,760,1138,w];x0,x1=cuts[i%cols:i%cols+2]
        y0=round(i//cols*h/rows);y1=round((i//cols+1)*h/rows)
        rgb=im[y0:y1,x0:x1].copy();f=rgb.astype(float)
        green=(f[:,:,1]>f[:,:,0]*1.6)&(f[:,:,1]>f[:,:,2]*1.6)&(f[:,:,1]>110)
        if atlas=='rest':
            bg=(f.min(axis=2)>214)&((f.max(axis=2)-f.min(axis=2))<14)
            count,labels=cv2.connectedComponents(bg.astype(np.uint8))
            border=np.unique(np.r_[labels[0],labels[-1],labels[:,0],labels[:,-1]])
            exterior=np.isin(labels,border[border!=0]).astype(np.uint8)
            mask=np.where(exterior>0,cv2.GC_BGD,cv2.GC_PR_FGD).astype(np.uint8)
            mask[cv2.erode(1-exterior,np.ones((7,7),np.uint8))>0]=cv2.GC_FGD
            cv2.grabCut(rgb,mask,None,np.zeros((1,65),np.float64),np.zeros((1,65),np.float64),3,cv2.GC_INIT_WITH_MASK)
            alpha=((mask==cv2.GC_FGD)|(mask==cv2.GC_PR_FGD)).astype(np.uint8)
        else:
            alpha=(~green).astype(np.uint8)
        n,labels,stats,_=cv2.connectedComponentsWithStats(alpha)
        alpha=(labels==(1+np.argmax(stats[1:,cv2.CC_STAT_AREA]))).astype(float)
        alpha=cv2.GaussianBlur(alpha,(0,0),.4);alpha[alpha<.02]=0;alpha[alpha>.98]=1
        # Decontaminate only the thin antialiased green fringe; leave opaque fur alone.
        fringe=(alpha>0)&(alpha<.99)&(atlas=='walk')
        rgb[:,:,1]=np.where(fringe,np.minimum(rgb[:,:,1],np.maximum(rgb[:,:,0],rgb[:,:,2])*1.12),rgb[:,:,1])
        rgba=np.dstack([rgb,(alpha*255).astype(np.uint8)])
        ys,xs=np.where(alpha>.5);bounds=[int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)]
        cells.append((name,rgba,bounds,[x0,y0,x1,y1]))
    # One common transform per direction/pose family preserves scale and contact baseline.
    for row in range(rows):
        group=cells[row*cols:(row+1)*cols]
        # Register body translation introduced by atlas layout. Left-walk noses use left
        # bounds; resting bodies/right-walk noses use right bounds. Never resize per frame.
        edge=0 if atlas=='walk' and row==0 else 2
        reference=group[0][2][edge]
        shifts=[reference-c[2][edge] for c in group]
        left=min(c[2][0]+dx for c,dx in zip(group,shifts));right=max(c[2][2]+dx for c,dx in zip(group,shifts))
        top=min(c[2][1] for c in group);bottom=max(c[2][3] for c in group)
        scale=384*.88/(right-left);target=(round((right-left)*scale),round((bottom-top)*scale))
        for (name,rgba,bounds,cell),dx in zip(group,shifts):
            crop=Image.fromarray(rgba).crop((left-dx,top,right-dx,bottom)).resize(target,Image.Resampling.LANCZOS)
            canvas=Image.new('RGBA',(384,384));xy=((384-target[0])//2,round(384*.825)-target[1]);canvas.paste(crop,xy)
            canvas.save(source/f'{name}-rgba.png');canvas.save(out/f'{name}.webp',lossless=True,method=6)
            record={'name':name,'rawAtlas':f'{atlas}-atlas-raw.png','rawSize':[w,h],'cell':cell,'bounds':bounds,'familyCrop':[left,top,right,bottom],'registrationX':dx,'outputSize':[384,384],'scale':scale,'paste':xy,'method':'connected subject alpha, fringe cleanup, family scale and horizontal registration'}
            records.append(record)
            bg=Image.new('RGBA',canvas.size,(24,31,36,255));bg.alpha_composite(canvas);previews.append((name,bg.convert('RGB')))
sheet=Image.new('RGB',(1536,3*420),(24,31,36));draw=ImageDraw.Draw(sheet)
for i,(name,im) in enumerate(previews):
    x=(i%4)*384;y=(i//4)*420;sheet.paste(im,(x,y+30));draw.text((x+12,y+8),name,fill='#ead1a4')
sheet.save(root/'docs/living-scene/cat-v2/evidence/atlas-mattes.png')
(source/'atlas-manifest.json').write_text(json.dumps(records,indent=2)+'\n')
print(json.dumps({'sprites':len(records),'output':'384px registered RGBA/WebP; some frames resampled, not native 384px new detail'},indent=2))
