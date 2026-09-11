from pathlib import Path
p=Path('public/app-entry.js');s=p.read_text()
needle='  window.location.replace(`/companion.html${url.search}`);'
replacement="  document.documentElement.dataset.appEntry = 'companion';\n"+needle
assert s.count(needle)==1
if replacement not in s:p.write_text(s.replace(needle,replacement))
p=Path('src/main.tsx');s=p.read_text()
guard="if (document.documentElement.dataset.appEntry !== 'companion') {"
if guard not in s:
 assert s.count('let recoveryOK = true;')==1
 p.write_text(s.replace('let recoveryOK = true;',guard+'\nlet recoveryOK = true;',1)+'\n}\n')
p=Path('src/appEntry.test.ts');s=p.read_text()
s=s.replace("document={title:''};","document={title:'',documentElement:{dataset:{}}};")
if 'quota failure cannot replace successful network HTML' not in s:
 s+=r'''
describe('optional cache writes cannot break online opening',()=>{
 it('quota failure cannot replace successful network HTML',async()=>{
  const w=worker(),open=w.cache.open;
  w.cache.open=async name=>({...await open(name),put:async()=>{throw new Error('quota');}});
  const response=await w.navigate('/companion.html');
  expect(response?.status).toBe(200);expect(await response?.text()).toBe('ONLINE');
 });
 it('quota failure cannot discard a successful static asset response',async()=>{
  const w=worker(),open=w.cache.open;
  w.cache.open=async name=>({...await open(name),put:async()=>{throw new Error('quota');}});
  let response!:Promise<Response>;
  w.handlers.fetch({request:{url:'https://app.example/assets/current.js',method:'GET',mode:'cors'},respondWith:(r:Promise<Response>)=>{response=r;}});
  expect(await (await response).text()).toBe('ONLINE');
 });
});
'''
p.write_text(s)
assert "match:async(k:string)=>stored.get(k)?.clone()" in Path('src/explore/explore.test.ts').read_text()
p=Path('public/sw.js');s=p.read_text()
for old in ['await cache.put(key, online.clone());','await cache.put(request, online.clone());']:
 new=old[:-1]+'.catch(() => {});'
 if old in s:s=s.replace(old,new)
 else:assert new in s
p.write_text(s)
