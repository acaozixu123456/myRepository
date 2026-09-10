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
# The app has consistently used 开启麦克风. Verify that source contract before
# repairing this obsolete locator. Keep native media and all product assertions.
app=Path('src/companion/CompanionApp.tsx').read_text()
if "aria-label={activity.micOn?'关闭麦克风':'开启麦克风'}" not in app:
 raise RuntimeError('Microphone accessible-name contract changed; review before testing')
patch("name:'打开麦克风',exact:true", "name:'开启麦克风',exact:true")
p.write_text(s)
print('Test-only safe diagnostics and exact microphone-name alignment applied; product assertions unchanged.')
