#!/usr/bin/env python3
"""把「旅途」用到的免费素材打包进 public/journey/res/（只需在更新素材时运行一次，产物提交到仓库）。

来源（下载方法见项目记忆 journey-game）：
  NATURE  Quaternius Stylized Nature MegaKit（CC0）的 glTF 目录
  UAA     Quaternius Ultimate Animated Animal Pack 的 Horse.gltf（CC0）
  KK      KayKit Adventurers 的 Ranger.glb（CC0）
  EXTRA   项目文件 assets-extra/（Kenney CC0 道具、粒子贴图）
  MUSIC   Kevin MacLeod “Morning”（CC BY 4.0）
  SFX     Mixkit 免费音效（编号见下）

用法：python3 tools/pack-journey.py  （需要 PIL、numpy、ffmpeg）
"""
import json, os, struct, shutil, subprocess, sys, base64
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'journey', 'res')
NATURE = os.environ.get('NATURE', '/tmp/claude-0/work/a/nature')
UAA = os.environ.get('UAA', '/tmp/claude-0/dl/uaa')
KK = os.environ.get('KK', '/tmp/claude-0/work/a/kk')
EXTRA = os.environ.get('EXTRA', '/mnt/project-files/assets-extra')
MUSIC = os.environ.get('MUSIC', '/tmp/claude-0/dl/music')
SFX = os.environ.get('SFX', '/tmp/claude-0/dl/sfx')
os.makedirs(OUT, exist_ok=True)

# ---------------- 植物：几个 glTF 合成一个二进制包 ----------------
MODELS = ['CommonTree_1', 'CommonTree_3', 'CommonTree_5', 'Pine_2', 'Bush_Common', 'Bush_Common_Flowers', 'Clover_1', 'Clover_2',
          'Fern_1', 'Flower_3_Group', 'Flower_4_Group', 'Grass_Common_Short', 'Grass_Wispy_Tall', 'Plant_1', 'Mushroom_Common',
          'Rock_Medium_1', 'Rock_Medium_2', 'Pebble_Round_2']
MAT = {'Bark_NormalTree': 'bark', 'Leaves_NormalTree': 'leaf', 'Leaves_TwistedTree': 'leaf', 'Leaves_Pine': 'pine', 'Leaves': 'atlas',
       'Flowers': 'flowers', 'Grass': 'grass', 'Mushrooms': 'mush', 'Rocks': 'rock', 'PathRocks': 'pebble'}

def accessor(g, binb, ai):
    a = g['accessors'][ai]; bv = g['bufferViews'][a['bufferView']]
    n = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
    dt = {5126: np.float32, 5123: np.uint16, 5121: np.uint8, 5125: np.uint32}[a['componentType']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    item = np.dtype(dt).itemsize * n
    stride = bv.get('byteStride', item)
    raw = np.frombuffer(binb, dtype=np.uint8, count=stride * (a['count'] - 1) + item, offset=off)
    if stride == item:
        arr = np.frombuffer(raw.tobytes(), dtype=dt).reshape(a['count'], n)
    else:
        arr = np.stack([np.frombuffer(raw[i * stride:i * stride + item].tobytes(), dtype=dt) for i in range(a['count'])])
    return arr.astype(np.float64) if dt == np.float32 else arr

def quat_to_mat(q):
    x, y, z, w = q
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])

def node_mats(g):
    """每个带 mesh 的节点的世界矩阵"""
    out = []
    def walk(ni, M):
        n = g['nodes'][ni]
        L = np.eye(4)
        if 'matrix' in n: L = np.array(n['matrix']).reshape(4, 4).T
        else:
            T = np.eye(4); T[:3, 3] = n.get('translation', [0, 0, 0])
            R = np.eye(4); R[:3, :3] = quat_to_mat(n.get('rotation', [0, 0, 0, 1]))
            S = np.diag(list(n.get('scale', [1, 1, 1])) + [1])
            L = T @ R @ S
        W = M @ L
        if 'mesh' in n: out.append((n['mesh'], W))
        for c in n.get('children', []): walk(c, W)
    for r in g['scenes'][g.get('scene', 0)]['nodes']: walk(r, np.eye(4))
    return out

def pack_flora():
    blob = bytearray(); meta = {}
    def put(arr):
        nonlocal blob
        while len(blob) % 4: blob.append(0)
        off = len(blob); blob += arr.tobytes(); return off
    for name in MODELS:
        g = json.load(open(os.path.join(NATURE, name + '.gltf')))
        binb = open(os.path.join(NATURE, g['buffers'][0]['uri']), 'rb').read()
        parts = {}
        for mi, W in node_mats(g):
            for p in g['meshes'][mi]['primitives']:
                mname = MAT[g['materials'][p['material']]['name']]
                pos = accessor(g, binb, p['attributes']['POSITION'])
                nor = accessor(g, binb, p['attributes']['NORMAL'])
                uv = accessor(g, binb, p['attributes']['TEXCOORD_0'])
                idx = accessor(g, binb, p['indices']).reshape(-1).astype(np.int64)
                pos = (np.c_[pos, np.ones(len(pos))] @ W.T)[:, :3]
                nor = nor @ W[:3, :3].T; nor /= np.linalg.norm(nor, axis=1, keepdims=True) + 1e-9
                P = parts.setdefault(mname, {'pos': [], 'nor': [], 'uv': [], 'idx': [], 'n': 0})
                P['pos'].append(pos); P['nor'].append(nor); P['uv'].append(uv); P['idx'].append(idx + P['n']); P['n'] += len(pos)
        mm = []
        for mname, P in parts.items():
            pos = np.concatenate(P['pos']); nor = np.concatenate(P['nor']); uv = np.concatenate(P['uv']); idx = np.concatenate(P['idx'])
            pmin = pos.min(0); pext = np.maximum(pos.max(0) - pmin, 1e-6)
            qp = np.round((pos - pmin) / pext * 65535).astype(np.uint16)
            qn = np.round(np.clip(nor, -1, 1) * 127).astype(np.int8); qn = np.c_[qn, np.zeros(len(qn), np.int8)]
            umin = uv.min(0); uext = np.maximum(uv.max(0) - umin, 1e-6)
            qu = np.round((uv - umin) / uext * 65535).astype(np.uint16)
            assert P['n'] < 65536
            mm.append({'mat': mname, 'count': int(P['n']), 'icount': int(len(idx)),
                       'pos': put(qp), 'pmin': pmin.round(5).tolist(), 'pext': pext.round(5).tolist(),
                       'nor': put(qn), 'uv': put(qu), 'umin': umin.round(5).tolist(), 'uext': uext.round(5).tolist(),
                       'idx': put(idx.astype(np.uint16))})
        allp = np.concatenate([np.concatenate(P['pos']) for P in parts.values()])
        meta[name] = {'parts': mm, 'min': allp.min(0).round(3).tolist(), 'max': allp.max(0).round(3).tolist()}
        print('flora', name, [(m['mat'], m['count'], m['icount'] // 3) for m in mm])
    open(os.path.join(OUT, 'flora.bin'), 'wb').write(blob)
    json.dump(meta, open(os.path.join(OUT, 'flora.json'), 'w'), separators=(',', ':'))
    print('flora.bin', len(blob))

def tex(src, dst, size, alpha=True, quant=0):
    im = Image.open(os.path.join(NATURE, src)).convert('RGBA' if alpha else 'RGB')
    im = im.resize((size, size), Image.LANCZOS)
    path = os.path.join(OUT, dst)
    if alpha:
        if quant:
            im = im.quantize(colors=quant, method=Image.FASTOCTREE, dither=Image.NONE)
        im.save(path, optimize=True)
    else:
        im.save(path, quality=82, optimize=True)
    print('tex', dst, os.path.getsize(path))

def warmGray(src, dst, size, mean):
    """这套石头贴图偏暗偏绿：去色、提亮，染成暖灰"""
    im = Image.open(os.path.join(NATURE, src)).convert('L').resize((size, size), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32); a = (a - a.mean()) * 1.25 + mean
    rgb = np.stack([a * 1.0, a * 0.95, a * 0.86], -1).clip(0, 255).astype(np.uint8)
    path = os.path.join(OUT, dst); Image.fromarray(rgb).save(path, quality=82, optimize=True)
    print('tex', dst, os.path.getsize(path))

def pack_textures():
    os.makedirs(OUT, exist_ok=True)
    tex('Leaves_NormalTree_C.png', 'leaf.png', 512, True, 128)
    tex('Leaf_Pine_C.png', 'pine.png', 512, True, 96)
    tex('Leaves.png', 'atlas.png', 1024, True, 192)
    tex('Flowers.png', 'flowers.png', 512, True, 160)
    tex('Grass.png', 'grass.png', 128, True, 64)
    tex('Bark_NormalTree.png', 'bark.jpg', 256, False)
    tex('Mushrooms.png', 'mush.jpg', 256, False)
    warmGray('Rocks_Diffuse.png', 'rock.jpg', 512, 150)
    warmGray('PathRocks_Diffuse.png', 'pebble.jpg', 256, 165)

# ---------------- 素材马：只留走、跑、站、吃草四个动作，转成 glb ----------------
def pack_horse():
    g = json.load(open(os.path.join(UAA, 'Horse.gltf')))
    keep = {'Walk', 'Gallop', 'Idle', 'Eating'}
    g['animations'] = [a for a in g['animations'] if a['name'] in keep]
    uri = g['buffers'][0]['uri']; data = base64.b64decode(uri.split(',', 1)[1])
    # 重新收集仍被引用的 bufferView，压缩二进制
    used_acc = set()
    for m in g['meshes']:
        for p in m['primitives']:
            used_acc.update(p['attributes'].values()); used_acc.add(p['indices'])
    for s in g.get('skins', []):
        if 'inverseBindMatrices' in s: used_acc.add(s['inverseBindMatrices'])
    for a in g['animations']:
        for smp in a['samplers']: used_acc.update([smp['input'], smp['output']])
    used_bv = sorted({g['accessors'][i]['bufferView'] for i in used_acc})
    remap_bv = {}; blob = bytearray(); new_bv = []
    for bi in used_bv:
        bv = g['bufferViews'][bi]
        while len(blob) % 4: blob.append(0)
        seg = data[bv.get('byteOffset', 0): bv.get('byteOffset', 0) + bv['byteLength']]
        nb = dict(bv); nb['byteOffset'] = len(blob); nb['buffer'] = 0
        remap_bv[bi] = len(new_bv); new_bv.append(nb); blob += seg
    used_acc_sorted = sorted(used_acc); remap_acc = {}; new_acc = []
    for ai in used_acc_sorted:
        a = dict(g['accessors'][ai]); a['bufferView'] = remap_bv[a['bufferView']]
        remap_acc[ai] = len(new_acc); new_acc.append(a)
    for m in g['meshes']:
        for p in m['primitives']:
            p['attributes'] = {k: remap_acc[v] for k, v in p['attributes'].items()}; p['indices'] = remap_acc[p['indices']]
    for s in g.get('skins', []):
        if 'inverseBindMatrices' in s: s['inverseBindMatrices'] = remap_acc[s['inverseBindMatrices']]
    for a in g['animations']:
        for smp in a['samplers']: smp['input'] = remap_acc[smp['input']]; smp['output'] = remap_acc[smp['output']]
    g['accessors'] = new_acc; g['bufferViews'] = new_bv
    while len(blob) % 4: blob.append(0)
    g['buffers'] = [{'byteLength': len(blob)}]
    js = json.dumps(g, separators=(',', ':')).encode()
    while len(js) % 4: js += b' '
    glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(blob)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(blob), 0x004E4942) + bytes(blob)
    open(os.path.join(OUT, 'horseA.glb'), 'wb').write(glb)
    print('horseA.glb', len(glb), [a['name'] for a in g['animations']])

def pack_misc():
    shutil.copy(os.path.join(KK, 'Ranger.glb'), os.path.join(OUT, 'rider.glb'))
    pd = os.path.join(OUT, 'props'); os.makedirs(pd, exist_ok=True)
    for f in ['campfire_stones.glb', 'log_stack.glb', 'stump_round.glb']:
        shutil.copy(os.path.join(EXTRA, 'kenney', f), os.path.join(pd, f))
    os.makedirs(os.path.join(pd, 'Textures'), exist_ok=True)
    for f in ['bench.glb', 'lantern-hanging.glb']:
        shutil.copy(os.path.join(EXTRA, 'kenney', 'holiday', f), os.path.join(pd, f))
    shutil.copy(os.path.join(EXTRA, 'kenney', 'holiday', 'Textures', 'colormap.png'), os.path.join(pd, 'Textures', 'colormap.png'))
    for f in ['spark_01.png']:
        im = Image.open(os.path.join(EXTRA, 'particles', f)).convert('RGBA').resize((128, 128), Image.LANCZOS)
        im.save(os.path.join(pd, f), optimize=True)
    print('misc ok')

# ---------------- 声音 ----------------
def ff(args):
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y'] + args, check=True)

def pack_audio():
    ad = os.path.join(OUT, 'audio'); os.makedirs(ad, exist_ok=True)
    ff(['-i', os.path.join(MUSIC, 'Morning.mp3'), '-ac', '2', '-b:a', '112k', os.path.join(ad, 'morning.mp3')])
    # 环境声：截取一段、两头交叉淡化做无缝循环（单声道 22kHz）
    def loop(src, dst, start, dur, fade=1.5, gain=1.0):
        tmp = os.path.join(ad, '_tmp.wav')
        ff(['-ss', str(start), '-t', str(dur + fade), '-i', os.path.join(SFX, src), '-ac', '1', '-ar', '22050', tmp])
        import wave
        w = wave.open(tmp); n = w.getnframes(); sr = w.getframerate(); x = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32); w.close()
        F = int(fade * sr); body = x[:len(x) - F].copy()
        t = np.linspace(0, 1, F)
        body[:F] = body[:F] * np.sqrt(t) + x[len(x) - F:] * np.sqrt(1 - t)   # 尾巴叠到开头
        body *= gain
        w2 = wave.open(tmp, 'wb'); w2.setnchannels(1); w2.setsampwidth(2); w2.setframerate(sr); w2.writeframes(np.clip(body, -32767, 32767).astype(np.int16).tobytes()); w2.close()
        ff(['-i', tmp, '-b:a', '48k', os.path.join(ad, dst)])
        os.remove(tmp)
        print('loop', dst, os.path.getsize(os.path.join(ad, dst)))
    loop('2452.mp3', 'river.mp3', 5, 24)          # River water flow and surroundings
    loop('2472.mp3', 'birds.mp3', 20, 30)         # Morning birds
    loop('2658.mp3', 'wind.mp3', 4, 20)           # Wind blowing ambience
    loop('1330.mp3', 'fire.mp3', 2, 16)           # Campfire crackles
    print('audio ok')

def pack_hooves():
    """从走路/小跑录音里切出单个蹄声，拼成一条“音效表”（每格 0.4 秒）"""
    ad = os.path.join(OUT, 'audio'); os.makedirs(ad, exist_ok=True)
    import wave
    def load(src):
        tmp = os.path.join(ad, '_h.wav'); ff(['-i', os.path.join(SFX, src), '-ac', '1', '-ar', '22050', tmp])
        w = wave.open(tmp); x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32); w.close(); os.remove(tmp)
        return x
    def onsets(x, sr=22050, minGap=0.16):
        hop = 128; env = np.array([np.sqrt(np.mean(x[i:i + 512] ** 2)) for i in range(0, len(x) - 512, hop)])
        d = np.maximum(0, np.diff(env)); thr = np.percentile(d, 97)
        out = []; last = -1e9
        for i, v in enumerate(d):
            t = i * hop / sr
            if v > thr and t - last > minGap: out.append(i * hop); last = t
        return out, env
    slots = []
    for src, n in [('78.mp3', 8), ('82.mp3', 6)]:
        x = load(src); on, env = onsets(x)
        cands = []
        for o in on:
            seg = x[max(0, o - 220): o - 220 + int(0.32 * 22050)]
            if len(seg) < int(0.3 * 22050): continue
            peak = np.max(np.abs(seg)); cands.append((peak, seg))
        cands.sort(key=lambda c: -c[0])
        picked = [c[1] for c in cands[2:2 + n]] if len(cands) > n + 2 else [c[1] for c in cands[:n]]
        for seg in picked:
            seg = seg / (np.max(np.abs(seg)) + 1) * 26000
            fade = np.ones(len(seg)); k = int(0.08 * 22050); fade[-k:] = np.linspace(1, 0, k) ** 2
            slots.append(seg * fade)
        print('hoof', src, 'onsets', len(on), 'picked', len(picked))
    L = int(0.4 * 22050); out = np.zeros(L * len(slots), np.float32)
    for i, s in enumerate(slots): out[i * L: i * L + len(s)] = s[:L]
    tmp = os.path.join(ad, '_h.wav'); w = wave.open(tmp, 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(22050); w.writeframes(out.astype(np.int16).tobytes()); w.close()
    ff(['-i', tmp, '-b:a', '64k', os.path.join(ad, 'hooves.mp3')]); os.remove(tmp)
    json.dump({'slot': 0.4, 'dirt': list(range(0, 8)), 'hard': list(range(8, len(slots)))}, open(os.path.join(ad, 'hooves.json'), 'w'))
    # 响鼻两声
    ff(['-i', os.path.join(SFX, '80.mp3'), '-ac', '1', '-ar', '22050', '-b:a', '48k', os.path.join(ad, 'snort1.mp3')])
    ff(['-i', os.path.join(SFX, '75.mp3'), '-ac', '1', '-ar', '22050', '-b:a', '48k', os.path.join(ad, 'snort2.mp3')])
    print('hooves ok', len(slots))

if __name__ == '__main__':
    what = sys.argv[1:] or ['flora', 'tex', 'horse', 'misc', 'audio', 'hooves']
    if 'flora' in what: pack_flora()
    if 'tex' in what: pack_textures()
    if 'horse' in what: pack_horse()
    if 'misc' in what: pack_misc()
    if 'audio' in what: pack_audio()
    if 'hooves' in what: pack_hooves()
