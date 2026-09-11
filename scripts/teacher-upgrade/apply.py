"""Apply the checksum-pinned, locally tested teacher upgrade. No execution of payload content."""
from pathlib import Path
import base64, hashlib, json, lzma
ROOT=Path('.').resolve()
raw=lzma.decompress(base64.b64decode(''.join((Path(__file__).parent/f'part{i}.b64').read_text().strip() for i in range(1,6)),validate=True))
assert len(raw)==130309
assert hashlib.sha256(raw).hexdigest()=='131404610c0891ea6d9692b0810db9399c42a88eda504a7e514367cfc830b8ea'
items=json.loads(raw)
assert len(items)==31
paths=[x['path'] for x in items]
assert len(set(paths))==len(paths)
for x in items:
 p=ROOT/x['path'];assert p.resolve().is_relative_to(ROOT) and not p.is_symlink()
 assert x['path'].startswith(('src/companion/','supabase/functions/nihongo-companion/','scripts/teacher-')) or x['path']=='server/companionProxy.ts'
 assert p.suffix in ['.ts','.tsx','.css','.mjs']
for x in items:
 if 'copy' in x:continue
 p=ROOT/x['path']
 if p.exists() and hashlib.sha256(p.read_bytes()).hexdigest()==x['sha256']:continue
 if 'content' in x:
  assert not p.exists(),f'Unreviewed pre-existing file: {p}'
  text=x['content']
 else:
  original=p.read_bytes();assert hashlib.sha256(original).hexdigest()==x['base'],f'Base changed: {p}'
  lines=original.decode().splitlines(keepends=True)
  for start,end,replacement in reversed(x['ops']):
   assert 0<=start<=end<=len(lines)
   lines[start:end]=[replacement]
  text=''.join(lines)
 assert hashlib.sha256(text.encode()).hexdigest()==x['sha256'],f'Patch mismatch: {p}'
 p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text)
for x in items:
 if 'copy' in x:
  assert x['copy'] in paths
  data=(ROOT/x['copy']).read_bytes();assert hashlib.sha256(data).hexdigest()==x['sha256']
  p=ROOT/x['path'];p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
for x in items:assert hashlib.sha256((ROOT/x['path']).read_bytes()).hexdigest()==x['sha256']
print('Applied or verified 31 checksum-pinned teacher source/test files. No credentials or saved user data touched.')
