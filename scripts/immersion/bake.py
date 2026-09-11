"""Original 4K AI plates plus authored, periodic local animation. No camera pan or zoom."""
from pathlib import Path
import argparse,hashlib,json,math,subprocess,time
import cv2
import numpy as np
from PIL import Image
DURATION=12;FPS=30;TAU=math.tau

def digest(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def path_points(o):
 if o=='landscape':return np.array([[.055,.805],[.15,.751],[.26,.686],[.38,.611],[.46,.550],[.502,.500],[.530,.460],[.535,.427],[.526,.407],[.511,.396]],np.float32)
 return np.array([[1.035,.858],[.95,.818],[.85,.774],[.735,.728],[.61,.684],[.49,.642],[.36,.601],[.24,.566],[.145,.547],[.075,.542]],np.float32)
class Scene:
 def __init__(self,path,orientation):
  self.orientation=orientation;self.base=cv2.imread(str(path),cv2.IMREAD_COLOR)
  if self.base is None:raise ValueError('Missing master image')
  self.h,self.w=self.base.shape[:2];expected=(2160,3840) if orientation=='landscape' else (3840,2160)
  assert (self.h,self.w)==expected,('Never silently resize the master',self.base.shape)
  self.f=self.base.astype(np.float32);sh,sw=(270,480) if orientation=='landscape' else (480,270)
  yy,xx=np.mgrid[0:sh,0:sw].astype(np.float32);self.x=xx/(sw-1);self.y=yy/(sh-1)
  self.haze_mask=np.exp(-((self.y-(.42 if orientation=='landscape' else .47))/(.17 if orientation=='landscape' else .14))**2)*np.exp(-((self.x-.5)/(.32 if orientation=='landscape' else .40))**2)
  b,g,r=cv2.split(self.base);self.neon=((r.astype(float)>g*1.20)&(b.astype(float)>g*1.15)&(np.maximum(r,b)>100)).astype(np.float32);self.neon=cv2.GaussianBlur(self.neon,(0,0),3)
  road=path_points(orientation)
  if orientation=='portrait':road[:,1]-=np.linspace(.018,0,len(road))
  self.road=road*np.array([self.w,self.h]);distances=np.linalg.norm(np.diff(self.road,axis=0),axis=1);self.cumulative=np.r_[0,np.cumsum(distances)];self.cumulative/=self.cumulative[-1]
  rng=np.random.default_rng(2711 if orientation=='landscape' else 9112)
  self.rain=[(float(rng.uniform(.06,.98)),float(rng.uniform(0,1)),float(rng.uniform(.2,.9)),int(rng.integers(2,5))) for _ in range(120)]
  self.drips=[(float(rng.uniform(.065,.185) if i<10 else rng.uniform(.947,.985)),float(rng.random()),float(rng.uniform(.6,1.3))) for i in range(14)]
  self.cars=[(float((i+.2)/24),1 if i%2 else -1) for i in range(24)]
 def along_road(self,p):
  i=max(0,min(len(self.road)-2,int(np.searchsorted(self.cumulative,p)-1)));u=(p-self.cumulative[i])/(self.cumulative[i+1]-self.cumulative[i]);pos=self.road[i]*(1-u)+self.road[i+1]*u;tangent=self.road[i+1]-self.road[i];tangent/=np.linalg.norm(tangent);return pos,tangent
 def frame(self,index):
  phase=(index%(DURATION*FPS))/(DURATION*FPS);theta=phase*TAU
  flow=(np.sin(self.x*16+self.y*7+theta)+np.cos(self.x*7-self.y*13-theta*2)+2)*.25
  mist=cv2.resize((.012+flow*.13)*self.haze_mask,(self.w,self.h),interpolation=cv2.INTER_LINEAR)[...,None]
  neon=(.065*np.sin(theta)+.024*np.sin(theta*2+.3))*self.neon[...,None]
  frame=np.clip(self.f*(1-mist+neon)+mist*np.array([137,89,73],np.float32),0,255).astype(np.uint8);overlay=np.zeros_like(frame)
  for x,y,depth,cycles in self.rain:
   p=(y+phase*cycles)%1;fade=math.sin(math.pi*p)**2;ix=int((x+.008*math.sin(theta))*self.w);iy=int(p*self.h*.94);length=int((8+depth*19)*self.h/2160);strength=int((15+depth*25)*fade)
   cv2.line(overlay,(ix,iy),(ix-int(length*.13),iy+length),(strength,strength//2,strength//3),1,cv2.LINE_AA)
  for offset,direction in self.cars:
   p=(offset+direction*phase)%1;fade=math.sin(math.pi*p)**.5;pos,tangent=self.along_road(p);normal=np.array([-tangent[1],tangent[0]]);scale=(1-p)*(1.0 if self.orientation=='landscape' else 1.15)+(.24 if self.orientation=='landscape' else .18);pos+=normal*direction*(5+scale*7)
   x,y=map(int,pos);radius=max(1,int(1+scale*1.3));trail=(pos-tangent*direction*(8+12*scale)).astype(int);color=tuple(int(v*fade) for v in ((175,194,232) if direction>0 else (40,50,205)))
   cv2.line(overlay,tuple(trail),(x,y),tuple(v//3 for v in color),max(1,radius),cv2.LINE_AA);cv2.circle(overlay,(x,y),radius,color,-1,cv2.LINE_AA);pair=(pos+normal*max(2,int(4*scale))).astype(int);cv2.circle(overlay,tuple(pair),radius,color,-1,cv2.LINE_AA)
  bloom=cv2.GaussianBlur(overlay,(0,0),2.5);frame=cv2.add(frame,overlay);frame=cv2.addWeighted(frame,1,bloom,.42,0)
  for x,y,size in self.drips:
   p=(y+phase)%1;fade=math.sin(math.pi*p)**3;ix=int((x+.0005*math.sin(theta*2+y*TAU))*self.w);iy=int((.035+p*.85)*self.h);rx=max(2,int(2.5*size*self.w/2160));ry=int(rx*2.6)
   if rx<ix<self.w-rx and ry+3<iy<self.h-ry-3:
    patch=self.base[iy-ry:iy+ry+1,ix-rx:ix+rx+1];refracted=np.roll(patch,2,axis=0);gy,gx=np.mgrid[-ry:ry+1,-rx:rx+1];mask=(gx*gx/(rx*rx)+gy*gy/(ry*ry)<=1).astype(np.float32)[...,None]*fade*.56
    frame[iy-ry:iy+ry+1,ix-rx:ix+rx+1]=(patch*(1-mask)+refracted*mask).astype(np.uint8);cv2.ellipse(frame,(ix,iy),(rx,ry),0,210,320,(int(117*fade),int(88*fade),int(71*fade)),1,cv2.LINE_AA);cv2.line(frame,(ix,iy-ry),(ix+1,iy-int(ry*5)),(int(28*fade),int(20*fade),int(17*fade)),1,cv2.LINE_AA)
  return frame

def encode(scene,output):
 command=['ffmpeg','-hide_banner','-loglevel','error','-y','-f','rawvideo','-pix_fmt','bgr24','-s',f'{scene.w}x{scene.h}','-r',str(FPS),'-i','pipe:0','-an','-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-profile:v','high','-level:v','5.1','-movflags','+faststart','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709',str(output)]
 start=time.monotonic();p=subprocess.Popen(command,stdin=subprocess.PIPE)
 try:
  for i in range(DURATION*FPS):
   p.stdin.write(scene.frame(i).tobytes())
   if i%90==0:print('RENDER',scene.orientation,i,'elapsed',round(time.monotonic()-start,1),flush=True)
  p.stdin.close();assert p.wait()==0
 except BaseException:p.kill();p.wait();raise

def publish(path,orientation,quality,out):
 h=digest(path);ext=Path(path).suffix;target=out/f'{h[:12]}-{orientation}-{quality}{ext}';Path(path).replace(target)
 if ext=='.webp':width,height=Image.open(target).size
 else:
  probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-of','json',str(target)]));assert not any(s['codec_type']=='audio' for s in probe['streams']);v=next(s for s in probe['streams'] if s['codec_type']=='video');width,height=v['width'],v['height'];assert v['r_frame_rate']=='30/1'
 return {'path':'/ambient/immersion03/'+target.name,'width':width,'height':height,'bytes':target.stat().st_size,'sha256':h}
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--masters',required=True);ap.add_argument('--output',required=True);ap.add_argument('--preview-only',action='store_true');args=ap.parse_args();masters=Path(args.masters);out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
 manifest={'release':'immersion03-city-v1','title':'雨夜 · 高层窗边的新东京','duration':DURATION,'fps':FPS,'source':'Original GPT Image 2.5 Sunburst 4K outputs + authored layered cinemagraph; no camera pan, zoom or image upscaling.','layers':['moving traffic lights on the depicted expressway','glass rain and refracting beads','distant haze','selective neon illumination'],'audioTracks':0};checks=[]
 for orientation in ['landscape','portrait']:
  scene=Scene(masters/(orientation+'.jpg'),orientation);first=scene.frame(0);middle=scene.frame(150);end=scene.frame(360);prior=scene.frame(359)
  cv2.imwrite(str(out/(orientation+'-frame0.jpg')),first,[cv2.IMWRITE_JPEG_QUALITY,93]);cv2.imwrite(str(out/(orientation+'-frame150.jpg')),middle,[cv2.IMWRITE_JPEG_QUALITY,93]);seam=float(np.abs(first.astype(np.float32)-prior).mean());change=float(np.abs(first.astype(np.float32)-middle).mean());exact=bool(np.array_equal(first,end));checks.append({'orientation':orientation,'originalSize':[scene.w,scene.h],'originalSha256':digest(masters/(orientation+'.jpg')),'exactPeriodicBoundary':exact,'adjacentSeamMeanAbsoluteDelta':seam,'midpointMeanAbsoluteDelta':change,'upscaled':False});assert exact and change>0 and seam<1.5
  if args.preview_only:continue
  master=out/(orientation+'-2160-tmp.mp4');encode(scene,master);videos={}
  for quality in ['1080','1440']:
   w,h=(int(quality)*16//9,int(quality)) if orientation=='landscape' else (int(quality),int(quality)*16//9);tmp=out/f'{orientation}-{quality}-tmp.mp4'
   subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(master),'-an','-vf',f'scale={w}:{h}:flags=lanczos','-c:v','libx264','-preset','veryfast','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart',str(tmp)],check=True);videos[quality]=publish(tmp,orientation,quality,out)
  videos['2160']=publish(master,orientation,'2160',out);poster=out/(orientation+'-poster-tmp.webp');Image.open(masters/(orientation+'.jpg')).save(poster,quality=92,method=6);manifest[orientation]={'poster':publish(poster,orientation,'poster',out),'video':videos}
 (out/'asset-checks.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2)+'\n')
 if not args.preview_only:(out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps(checks,ensure_ascii=False),flush=True)
if __name__=='__main__':main()
