"""Offline reproducible Depth Anything V2 Small inference + non-generative asset extraction.
Usage: python prepare_scene.py --model-repo PATH --weights PATH
Weights and upstream code stay outside the product. CPU is explicit for this Intel Mac.
"""
from pathlib import Path
import argparse, sys, time, json, hashlib
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT/'art-source/living-scene'
OUT = ROOT/'prototypes/living-scene/public/scene'
p = argparse.ArgumentParser()
p.add_argument('--model-repo', type=Path, required=True)
p.add_argument('--weights', type=Path, required=True)
p.add_argument('--source-dir',type=Path,default=SOURCE)
p.add_argument('--output-dir',type=Path,default=OUT)
a = p.parse_args()
SOURCE=a.source_dir; OUT=a.output_dir
SOURCE.mkdir(parents=True,exist_ok=True); OUT.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(a.model_repo))
import torch, cv2
# Upstream image2tensor auto-selects MPS even when the model is on CPU.
# Force this offline process to use the documented CPU path.
torch.backends.mps.is_available = lambda: False
from depth_anything_v2.dpt import DepthAnythingV2

torch.set_num_threads(4)
model = DepthAnythingV2(encoder='vits',features=64,out_channels=[48,96,192,384])
model.load_state_dict(torch.load(a.weights,map_location='cpu',weights_only=True))
model.eval()
im = Image.open(SOURCE/'hero-original.png').convert('RGB')
rgb = np.array(im)
t0 = time.perf_counter()
with torch.inference_mode():
    raw = model.infer_image(cv2.cvtColor(rgb,cv2.COLOR_RGB2BGR), input_size=518)
elapsed = time.perf_counter()-t0
np.save(SOURCE/'depth-raw.npy',raw)
lo,hi = np.percentile(raw,[1,99])
depth = np.clip((raw-lo)/(hi-lo),0,1)
Image.fromarray((depth*65535).astype(np.uint16)).save(SOURCE/'depth-16bit.png')
Image.fromarray((depth*255).astype(np.uint8)).save(OUT/'depth.png')
im.save(OUT/'hero.webp',quality=94,method=6)
# Feathered depth bands are editable masks, not semantic object segmentation.
def smooth(a,b,x):
    q=np.clip((x-a)/(b-a),0,1); return q*q*(3-2*q)
h,w=depth.shape
y,x=np.mgrid[0:h,0:w].astype(np.float32);x/=w;y/=h
# Authored spatial envelopes intersect colour to prevent roof/sky wind distortion.
red=(rgb[:,:,0].astype(float)-rgb[:,:,2].astype(float))/255
wind=(1-smooth(.25,.48,y))*(1-smooth(.50,.64,x))*smooth(.015,.12,red)
wind=np.array(Image.fromarray((wind*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2)))/255
# Correct colour-supported foreground maple leaves misclassified as far by monocular inference.
depth=np.maximum(depth,wind*.94)
Image.fromarray((depth*65535).astype(np.uint16)).save(SOURCE/'depth-refined-16bit.png')
Image.fromarray((depth*255).astype(np.uint8)).save(OUT/'depth.png')
near=smooth(.50,.66,depth)
far=1-smooth(.15,.30,depth)
mid=1-near-far
for name,mask in [('far',far),('mid',mid),('near',near)]:
    alpha=(mask*255).round().astype(np.uint8)
    Image.fromarray(alpha).save(OUT/f'mask-{name}.png')
    Image.fromarray(np.dstack([rgb,alpha])).save(SOURCE/f'layer-{name}.png')
fog=np.exp(-(((x-.225)/.17)**2+((y-.57)/.20)**2))*(1-depth)
shop=np.exp(-(((x-.735)/.115)**2+((y-.555)/.115)**2))
Image.fromarray((np.dstack([wind,fog,shop])*255).astype(np.uint8)).save(OUT/'motion-masks.png')
# Exact original pixels and layer masks remain editable. No invented hidden background.
manifest={'source':'hero-original.png','size':[w,h],'depth':{'model':'Depth-Anything-V2-Small','encoder':'vits','license':'Apache-2.0','input_size':518,'device':'cpu','seconds':elapsed,'white':'near','normalization_percentiles':[1,99],'refinement':'colour-supported near maple override; raw depth preserved','weights_sha256':hashlib.sha256(a.weights.read_bytes()).hexdigest()},'layers':['layer-far.png','layer-mid.png','layer-near.png'],'motion_channels':{'R':'maple leaf wind','G':'distant atmospheric haze','B':'shop hover light'},'limits':'Relative monocular depth, feathered depth-band masks. Not semantic cutouts or hidden-surface reconstruction. Runtime uses bounded continuous depth reprojection; layers supplied for subsequent authoring.'}
(SOURCE/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
(OUT/'scene.json').write_text(json.dumps({'width':w,'height':h,'focus':[.735,.555],'depth':'white-near','parallax_uv_max':[.006,.003]},indent=2)+'\n')
print(json.dumps(manifest,indent=2))
