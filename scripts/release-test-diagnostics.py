from pathlib import Path
p=Path('scripts/companion-release-live.mjs')
s=p.read_text()
def patch(a,b):
 global s
 if b in s:return
 if s.count(a)!=1:raise RuntimeError('Release diagnostic anchor mismatch')
 s=s.replace(a,b)
patch('notes:[],checks:[],errors:[],news:null,syntheticFixtures:[]','notes:[],checks:[],errors:[],apiErrors:[],news:null,syntheticFixtures:[]')
patch("const b=r.request().postDataJSON(),j=await r.json();if(b.action==='companion_start'", "const b=r.request().postDataJSON(),j=await r.json();if(!r.ok())report.apiErrors.push({action:b.action,status:r.status(),reason:j.reason,provider:j.provider});if(b.action==='companion_start'")
patch("n=>window.__release.completed>n&&!window.__release.playing&&!window.__release.generating", "n=>!!document.querySelector('.kc-inline-error')||(window.__release.completed>n&&!window.__release.playing&&!window.__release.generating)")
p.write_text(s)
print('Test-only safe API status diagnostics applied; all product assertions unchanged.')
