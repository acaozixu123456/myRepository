#!/usr/bin/env python3
"""把 assets/heroes/illust/<id>.(png|webp|jpg) 的 AI 立绘整理成三种视图（full/card/head，webp，已裁边），
输出到 src/art/illust/，并生成索引 src/art/illust-index.ts。没有立绘的猫继续使用程序化造型。
用法：python3 tools/sync-illust.py"""
import glob, os, sys
from PIL import Image

SRC = 'assets/heroes/illust'
OUT = 'src/art/illust'
os.makedirs(OUT, exist_ok=True)
for f in glob.glob(f'{OUT}/*.webp'): os.remove(f)

def trim(im):
    if im.mode != 'RGBA': im = im.convert('RGBA')
    bb = im.getchannel('A').getbbox()
    return im.crop(bb) if bb else im

def near_white_to_alpha(im):
    # 纯白底的图：把接近白色的像素转为透明（简单抠图，边缘复杂的图请直接提供透明 PNG）
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r > 244 and g > 244 and b > 244: px[x, y] = (r, g, b, 0)
    return im

ids = []
for p in sorted(glob.glob(f'{SRC}/*')):
    base, ext = os.path.splitext(os.path.basename(p))
    if ext.lower() not in ('.png', '.webp', '.jpg', '.jpeg'): continue
    im = Image.open(p).convert('RGBA')
    if im.getchannel('A').getextrema()[0] == 255: im = near_white_to_alpha(im)
    im = trim(im)
    w, h = im.size
    def save(name, img, height):
        r = height / img.height
        img = img.resize((max(1, round(img.width * r)), height), Image.LANCZOS)
        img.save(f'{OUT}/{base}.{name}.webp', 'WEBP', quality=84, method=6)
    save('full', im, 720)
    save('card', im.crop((0, 0, w, round(h * 0.62))), 420)   # 头 + 胸
    save('head', im.crop((0, 0, w, round(h * 0.36))), 260)   # 头像
    ids.append(base)
    print('ok', base)

lines = ['// 自动生成：python3 tools/sync-illust.py。没有立绘的猫不在表里，会退回程序化造型。']
for i in ids:
    for v in ('full', 'card', 'head'):
        lines.append(f"import {i}_{v} from './illust/{i}.{v}.webp';")
lines.append('export const ILLUST: Record<string, { full: string; card: string; head: string }> = {')
for i in ids: lines.append(f"  {i}: {{ full: {i}_full, card: {i}_card, head: {i}_head }},")
lines.append('};')
open('src/art/illust-index.ts', 'w').write('\n'.join(lines) + '\n')
print(f'{len(ids)} 只猫已同步')
