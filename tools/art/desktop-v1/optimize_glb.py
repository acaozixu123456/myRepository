"""Remove unused UV/tangent attributes and unreferenced payload from a Blender GLB.
Tangents are retained for every normal-mapped primitive. No geometry/skin/animation changes.
"""
import json,struct,pathlib,sys

def optimize(p):
 p=pathlib.Path(p);b=p.read_bytes();n=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+n]);raw=b[28+n:]
 for m in j['meshes']:
  for prim in m['primitives']:
   material=j['materials'][prim['material']];attrs=prim['attributes']
   if 'normalTexture' not in material:attrs.pop('TANGENT',None)
   # Identify each TEXCOORD set actually referenced by this primitive's material.
   uv=set()
   def visit(o):
    if isinstance(o,dict):
     for k,v in o.items():
      if k.endswith('Texture') and isinstance(v,dict) and 'index' in v:uv.add(v.get('texCoord',0))
      visit(v)
    elif isinstance(o,list):
     for v in o:visit(v)
   visit(material)
   for k in list(attrs):
    if k.startswith('TEXCOORD_') and int(k.split('_')[1]) not in uv:del attrs[k]
 refs=[]
 for m in j['meshes']:
  for prim in m['primitives']:
   refs.extend((prim['attributes'],k) for k in prim['attributes'])
   if 'indices' in prim:refs.append((prim,'indices'))
   for t in prim.get('targets',[]):refs.extend((t,k) for k in t)
 for s in j.get('skins',[]):
  if 'inverseBindMatrices' in s:refs.append((s,'inverseBindMatrices'))
 for a in j.get('animations',[]):
  for s in a['samplers']:refs.extend([(s,'input'),(s,'output')])
 used=sorted({o[k] for o,k in refs});mapping={old:new for new,old in enumerate(used)}
 j['accessors']=[j['accessors'][i] for i in used]
 for o,k in refs:o[k]=mapping[o[k]]
 refs=[]
 for a in j['accessors']:
  if 'bufferView' in a:refs.append((a,'bufferView'))
  if 'sparse' in a:
   for k in ['indices','values']:refs.append((a['sparse'][k],'bufferView'))
 for im in j.get('images',[]):
  if 'bufferView' in im:refs.append((im,'bufferView'))
 used=sorted({o[k] for o,k in refs});mapping={old:new for new,old in enumerate(used)};views=[];data=bytearray()
 for i in used:
  v=j['bufferViews'][i];start=v.get('byteOffset',0);end=start+v['byteLength'];data.extend(b'\0'*((-len(data))%4));v['byteOffset']=len(data);v['buffer']=0;data.extend(raw[start:end]);views.append(v)
 for o,k in refs:o[k]=mapping[o[k]]
 j['bufferViews']=views;j['buffers']=[{'byteLength':len(data)}];data.extend(b'\0'*((-len(data))%4))
 text=json.dumps(j,separators=(',',':'),ensure_ascii=False).encode();text+=b' '*((-len(text))%4)
 result=struct.pack('<III',0x46546c67,2,28+len(text)+len(data))+struct.pack('<II',len(text),0x4e4f534a)+text+struct.pack('<II',len(data),0x004e4942)+data
 p.write_bytes(result);print(f'Pruned unused attributes: {p.name} {len(b)} -> {len(result)} bytes')
if __name__=='__main__':
 for p in sys.argv[1:]:optimize(p)
