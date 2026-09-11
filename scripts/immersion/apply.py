"""Lossless transport only. Exports the readable manifest/diff before testing; never deploys."""
from pathlib import Path
import base64, hashlib, json, lzma, subprocess
root=Path.cwd().resolve()
encoded=''.join((root/f'scripts/immersion/source.{i}.xz64').read_text().strip() for i in range(4))
raw=lzma.decompress(base64.b64decode(encoded,validate=True))
expected=(root/'scripts/immersion/reviewed-source.sha256').read_text().strip()
assert hashlib.sha256(raw).hexdigest()==expected,'Transport checksum mismatch; no source writes.'
records=json.loads(raw)
assert isinstance(records,list) and len(records)==38
out=root/'artifacts/immersion-gate';out.mkdir(parents=True,exist_ok=True)
(out/'readable-source-records.json').write_bytes(raw)
allowed=('src/','supabase/functions/nihongo-companion/','server/companionProxy.ts','scripts/immersion/browser.mjs','scripts/hitokoto-neon-phone.mjs','scripts/teacher-v2-phone.mjs','scripts/companion-phone.mjs')
for record in records:
 name=record['path'];p=(root/name).resolve();assert p.is_relative_to(root) and name.startswith(allowed) and '..' not in Path(name).parts and not (root/name).is_symlink(),name
 current=hashlib.sha256(p.read_bytes()).hexdigest() if p.exists() else None
 assert current in [record['old'],record['sha256']],f'Unreviewed current source: {name} ({current})'
for record in records:
 p=root/record['path'];current=hashlib.sha256(p.read_bytes()).hexdigest() if p.exists() else None
 if current==record['sha256']:continue
 if 'content' in record:
  p.parent.mkdir(parents=True,exist_ok=True);p.write_text(record['content'])
 else:
  subprocess.run(['git','apply','--check','-'],input=record['patch'].encode(),check=True)
  subprocess.run(['git','apply','-'],input=record['patch'].encode(),check=True)
 assert hashlib.sha256(p.read_bytes()).hexdigest()==record['sha256'],record['path']
print('IMMERSION_SOURCE_APPLIED',len(records),'reviewed source/test files; credentials and stored user data untouched.')
