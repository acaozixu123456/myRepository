#!/usr/bin/env python3
"""把 assets/world/<类别>/*.webp|png（Codex 交付的 AI 场景素材）缩成游戏内用的尺寸，输出到 src/world/assets/，
并生成索引 src/world/assets/index.ts（WORLD_TEX：名字 → 图片地址）。用法：python3 tools/sync-world-assets.py"""
import glob, os
from PIL import Image

SRC, OUT = 'assets/world', 'src/world/assets'
MAX = {'walls': 512, 'ground': 512, 'signs': 512, 'skyline': 2048, 'decals': 256}  # 各类别最长边
os.makedirs(OUT, exist_ok=True)
for f in glob.glob(f'{OUT}/*.webp'): os.remove(f)
names = []
for cat in sorted(os.listdir(SRC)):
    d = f'{SRC}/{cat}'
    if not os.path.isdir(d) or cat == 'reviews': continue
    for p in sorted(glob.glob(f'{d}/*')):
        base, ext = os.path.splitext(os.path.basename(p))
        if ext.lower() not in ('.webp', '.png', '.jpg', '.jpeg'): continue
        im = Image.open(p)
        im = im.convert('RGBA') if im.mode in ('RGBA', 'LA', 'P') and 'A' in im.getbands() else im.convert('RGB')
        m = MAX.get(cat, 512)
        if max(im.size) > m: r = m / max(im.size); im = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)
        im.save(f'{OUT}/{base}.webp', 'WEBP', quality=82, method=6)
        names.append(base)
        print('ok', cat, base, im.size)
lines = ['// 自动生成：python3 tools/sync-world-assets.py（素材来自 assets/world/**，已缩到游戏内尺寸）。']
for n in names: lines.append(f"import {n} from './{n}.webp';")
lines.append('export const WORLD_TEX: Record<string, string> = {')
for n in names: lines.append(f'  {n},')
lines.append('};')
open(f'{OUT}/index.ts', 'w').write('\n'.join(lines) + '\n')
print(len(names), '张素材已同步')
