#!/bin/sh
# 用法: tools/ult-sheet.sh <heroId> [theme] [start] [step] [n]
H=$1; TH=${2:-meadow}; ST=${3:-7.2}; SP=${4:-0.2}; N=${5:-15}
rm -f .shots/u_${H}_*.png
node tools/battle-shots.mjs "a=$H&b=wei_xuhuchi,man_wutugu,qun_dongzhuo,xian_guanlu,wu_huanggai&energy=100&seed=3&theme=$TH" .shots/u_$H $SP $N $ST >/dev/null
python3 - "$H" <<'PY'
import sys,glob
from PIL import Image
h=sys.argv[1]
fs=sorted(glob.glob(f'/home/user/myRepository/.shots/u_{h}_*.png'))
ims=[Image.open(f).resize((520,325)) for f in fs]
cols=3
rows=(len(ims)+cols-1)//cols
sh=Image.new('RGB',(520*cols,325*rows))
for i,im in enumerate(ims): sh.paste(im,((i%cols)*520,(i//cols)*325))
sh.save(f'/home/user/myRepository/.shots/sheet_{h}.png')
PY
