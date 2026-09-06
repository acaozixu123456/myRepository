"""Serve only this art batch and externally installed pinned Babylon libraries, on loopback."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import argparse
p=argparse.ArgumentParser();p.add_argument('--vendor',required=True);p.add_argument('--port',type=int,default=8766);a=p.parse_args();root=Path(__file__).resolve().parents[3];vendor=Path(a.vendor).resolve()
class Handler(SimpleHTTPRequestHandler):
 def translate_path(self,path):
  from urllib.parse import unquote,urlsplit
  path=unquote(urlsplit(path).path)
  if path=='/':return str(root/'tools/art/desktop-v1/viewer.html')
  if path in ['/vendor/babylon.js','/vendor/babylonjs.loaders.min.js']:return str(vendor/Path(path).name)
  allowed=('tools/art/desktop-v1/','public/explore/assets/desktop-v1/','docs/art/desktop-v1/')
  rel=path.lstrip('/');target=(root/rel).resolve()
  if not rel.startswith(allowed) or not target.is_relative_to(root):return '/__not_served__'
  return str(target)
 def end_headers(self):
  self.send_header('Cache-Control','no-store');super().end_headers()
print('Art viewer http://127.0.0.1:'+str(a.port),flush=True)
ThreadingHTTPServer(('127.0.0.1',a.port),Handler).serve_forever()
