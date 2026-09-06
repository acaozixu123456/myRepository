from pathlib import Path
import json, cv2, numpy as np
from PIL import Image, ImageDraw
p=Path(__file__).resolve().parents[3]/'art-source/living-scene/v3';m=json.loads((p/'compositing-manifest.json').read_text());q=p/'evaluation';q.mkdir(exist_ok=True)
W,H=m['proposed_composite_size'];sx=W/1672;sy=H/941
orig=cv2.imread(str(p/'inputs'/'hero-original.png'));base=cv2.resize(orig,(W,H),interpolation=cv2.INTER_LANCZOS4).astype(np.float32)
acc=np.zeros((H,W,3),np.float32);weights=np.zeros((H,W),np.float32);coverage=np.zeros((H,W),np.uint8)
S=np.diag([sx,sy,1]);layers=[]
for rec in m['tiles']:
 name=rec['id'];a=cv2.imread(str(p/'outputs'/f"{rec['id']}.png"));h,w=a.shape[:2];x,y,_,_=rec['source_box'];T=np.array([[1,0,x],[0,1,y],[0,0,1]],np.float64);M=S@T@np.array(rec['output_to_source_crop_homography'])
 warp=cv2.warpPerspective(a,M,(W,H),flags=cv2.INTER_LANCZOS4)
 rawmask=cv2.warpPerspective(np.ones((h,w),np.uint8),M,(W,H),flags=cv2.INTER_NEAREST)
 # Feather only inside each generated tile. Original is retained outside covered pixels.
 padded=np.pad(rawmask,1);dist=cv2.distanceTransform(padded,cv2.DIST_L2,5)[1:-1,1:-1];weight=np.clip(dist/36,0,1)
 acc+=warp*weight[:,:,None];weights+=weight;coverage|=rawmask
 rgba=cv2.cvtColor(warp,cv2.COLOR_BGR2BGRA);rgba[:,:,3]=(weight*255).astype(np.uint8);cv2.imwrite(str(q/f'{name}-registered-rgba.png'),rgba)
 rec['registered_evaluation_layer']=str(q/f'{name}-registered-rgba.png');layers.append(warp)
filtered=acc/np.maximum(weights[:,:,None],1e-6);alpha=np.minimum(weights,1)[:,:,None]
result=np.clip(filtered*alpha+base*(1-alpha),0,255).astype(np.uint8)
cv2.imwrite(str(q/'candidate-registered-3039x1710.png'),result)
cv2.imwrite(str(q/'generated-detail-coverage.png'),coverage*255)
cv2.imwrite(str(q/'generated-detail-contribution.png'),(alpha[:,:,0]*255).astype(np.uint8))
# Green=new generated coverage, magenta=original-only fallback. Yellow=blending boundaries.
coverageview=(base*.40).astype(np.uint8);coverageview[coverage==1]=np.clip(base[coverage==1]*.5+np.array([25,105,25]),0,255)
coverageview[coverage==0]=np.clip(base[coverage==0]*.4+np.array([125,10,125]),0,255)
transition=(weights>0)&(weights<1);coverageview[transition]=np.clip(base[transition]*.4+np.array([0,100,125]),0,255)
cv2.imwrite(str(q/'coverage-overlay.png'),coverageview)
yy,xx=np.indices((H,W));checker=((xx//160+yy//160)%2)==0
check=result.copy();check[checker]=base.astype(np.uint8)[checker];cv2.imwrite(str(q/'source-candidate-checkerboard.png'),check)
# Feature QA: full native tile with source correspondences mapped into output coordinates.
sift=cv2.SIFT_create(nfeatures=8000);matcher=cv2.BFMatcher()
for rec in m['tiles']:
 a=cv2.imread(str(p/'outputs'/f"{rec['id']}.png"));b=cv2.imread(str(p/'inputs'/f"{rec['id']}.png"));ka,da=sift.detectAndCompute(cv2.cvtColor(a,cv2.COLOR_BGR2GRAY),None);kb,db=sift.detectAndCompute(cv2.cvtColor(b,cv2.COLOR_BGR2GRAY),None)
 good=[u for u,v in matcher.knnMatch(da,db,k=2) if u.distance<.7*v.distance]
 src=np.float32([ka[u.queryIdx].pt for u in good]);dst=np.float32([kb[u.trainIdx].pt for u in good]);Hmat=np.array(rec['output_to_source_crop_homography']);pred=cv2.perspectiveTransform(src.reshape(-1,1,2),Hmat).reshape(-1,2);error=np.linalg.norm(pred-dst,axis=1)
 mapped=cv2.perspectiveTransform(dst.reshape(-1,1,2),np.linalg.inv(Hmat)).reshape(-1,2);overlay=a.copy()
 for v,z,e in zip(src,mapped,error):
  if e>3: continue
  v=tuple(np.round(v).astype(int));z=tuple(np.round(z).astype(int));cv2.circle(overlay,v,3,(0,255,255),1);cv2.circle(overlay,z,1,(255,255,0),-1);cv2.line(overlay,v,z,(0,255,0),1)
 cv2.putText(overlay,'Yellow=generated feature; Cyan=registered source match',(20,32),cv2.FONT_HERSHEY_SIMPLEX,.62,(255,255,255),1,cv2.LINE_AA)
 cv2.imwrite(str(q/f"{rec['id']}-feature-qa.png"),overlay)
# Plain 2x2 evidence contact sheet; previews are deliberately downsized for review.
items=[('Original 1672 x 941',cv2.cvtColor(orig,cv2.COLOR_BGR2RGB)),('Registered candidate 3039 x 1710',cv2.cvtColor(result,cv2.COLOR_BGR2RGB)),('Coverage: green generated / magenta original fallback',cv2.cvtColor(coverageview,cv2.COLOR_BGR2RGB)),('Source / candidate checkerboard',cv2.cvtColor(check,cv2.COLOR_BGR2RGB))]
sheet=Image.new('RGB',(1672*2,981*2),(18,21,26));draw=ImageDraw.Draw(sheet)
for idx,(label,data) in enumerate(items):
 x=(idx%2)*1672;y=(idx//2)*981;draw.text((x+16,y+14),label,fill=(235,235,235));im=Image.fromarray(data);im.thumbnail((1672,941));sheet.paste(im,(x,y+40))
sheet.save(q/'contact-sheet.png')
stats={'size':[W,H],'generated_any_coverage_percent':float((coverage>0).mean()*100),'original_only_fallback_percent':float((coverage==0).mean()*100),'generated_full_contribution_percent':float((weights>=1).mean()*100),'boundary_mixed_percent':float(transition.mean()*100),'warning':'Evaluation composite only; original fallback is Lanczos interpolated, explicitly not native new detail. Registered generated tiles have added native detail. Overlap seams need visual review. Homographies are near uniform scaling/translation fits and were not manually warped.'}
(q/'evaluation-stats.json').write_text(json.dumps(stats,indent=2));(p/'compositing-manifest.json').write_text(json.dumps(m,indent=2));print(json.dumps(stats,indent=2))
