"""Read actual GLB headers/accessors, material and image budgets, and SHA-256 hashes."""
import pathlib,struct,json,hashlib
R=pathlib.Path(__file__).resolve().parents[3];out=[]
for kind in ['shop','keeper']:
 p=R/f'public/explore/assets/desktop-v1/yorimichi-{kind}.glb';b=p.read_bytes();magic,version,length=struct.unpack_from('<III',b);assert magic==0x46546c67 and version==2 and length==len(b)
 size,typ=struct.unpack_from('<II',b,12);j=json.loads(b[20:20+size]);binstart=20+size+8;images=[]
 for im in j.get('images',[]):
  view=j['bufferViews'][im['bufferView']];start=binstart+view.get('byteOffset',0);raw=b[start:start+view['byteLength']];assert raw[:8]==b'\x89PNG\r\n\x1a\n';w,h=struct.unpack_from('>II',raw,16);images.append({'name':im.get('name'),'width':w,'height':h,'embeddedBytes':len(raw)})
 triangles=vertices=0
 for mesh in j['meshes']:
  for prim in mesh['primitives']:
   assert prim.get('mode',4)==4;triangles+=j['accessors'][prim['indices']]['count']//3;vertices+=j['accessors'][prim['attributes']['POSITION']]['count']
 anims=[]
 for a in j.get('animations',[]):
  amin=min(j['accessors'][s['input']]['min'][0] for s in a['samplers']);amax=max(j['accessors'][s['input']]['max'][0] for s in a['samplers']);anims.append({'name':a['name'],'seconds':amax-amin,'channels':len(a['channels'])})
 out.append({'id':kind,'path':str(p.relative_to(R)),'sha256':hashlib.sha256(b).hexdigest(),'bytes':len(b),'triangles':triangles,'vertices':vertices,'meshes':len(j['meshes']),'materials':len(j['materials']),'images':images,'joints':len(j.get('skins',[{'joints':[]}])[0]['joints']),'animations':anims,'extensionsUsed':j.get('extensionsUsed',[]),'status':'candidate_for_Sol_review_not_accepted'})
report={'baseCommit':'0f3a4c4289b314791e9b7aee15fd5fca28cd425f','branch':'nihongo-art-assets-local-20260906','assets':out,'externalTextures':[]}
for p in sorted((R/'public/explore/assets/desktop-v1/textures').glob('*.png')):
 b=p.read_bytes();w,h=struct.unpack_from('>II',b,16);report['externalTextures'].append({'path':str(p.relative_to(R)),'width':w,'height':h,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
(R/'docs/art/desktop-v1/asset-manifest.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps([{k:v for k,v in a.items() if k not in ['images','animations','extensionsUsed']} for a in out],indent=2))
