import {describe,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {stripShareParameters,extractSharedMojiUrl} from './shareTarget';
const read=(name:string)=>readFileSync(name,'utf8');
function launch(path:string){
 const replace=vi.fn(),history=vi.fn(),document={title:'',documentElement:{dataset:{}}};
 runInNewContext(read('public/app-entry.js'),{URL,window:{location:{href:'https://app.example'+path,replace},history:{replaceState:history}},document});
 return {replace,history,document};
}
describe('actual installed app launch is the neon companion, not the former NHK root',()=>{
 it.each(['/','/index.html','/?ui=neon-20260911','/?v=20260911'])('opens neon for %s',path=>{const r=launch(path);expect(r.replace).toHaveBeenCalledTimes(1);expect(r.replace.mock.calls[0][0]).toBe('/companion.html'+new URL(path,'https://app.example').search);expect(r.history).not.toHaveBeenCalled();});
 it.each(['/?view=nhk','/?view=nhk&keep=1','/companion.html','/explore.html'])('does not loop or hijack explicit page %s',path=>expect(launch(path).replace).not.toHaveBeenCalled());
 it.each(['/?share_target=1&url=https%3A%2F%2Fwww.mojidict.com%2Farticle%2Fkeep','/?text=https%3A%2F%2Fm.mojidict.com%2Farticle%2Fkeep','/index.html?title=https%3A%2F%2Fwww.mojidict.com%2Farticle%2Fkeep'])('retains old share payload and durable NHK entry %s',path=>{const r=launch(path);expect(r.replace).not.toHaveBeenCalled();const canonical=r.history.mock.calls[0][2];expect(extractSharedMojiUrl(canonical)).toBe('https://www.mojidict.com/article/keep');expect(stripShareParameters(canonical)).toContain('view=nhk');expect(launch(stripShareParameters(canonical)).replace).not.toHaveBeenCalled();});
 it('retains legacy hash bookmarks instead of discarding them',()=>{const r=launch('/#article-one');expect(r.replace).not.toHaveBeenCalled();expect(r.history.mock.calls[0][2]).toBe('/?view=nhk#article-one');});
 it('does not use an external return URL',()=>expect(launch('/?next=https://evil.invalid').replace).toHaveBeenCalledWith('/companion.html?next=https://evil.invalid'));
 it('preserves installed identity, scope and share schema',()=>{const m=JSON.parse(read('public/manifest.webmanifest'));expect(m.id).toBe('/');expect(m.start_url).toBe('/');expect(m.scope).toBe('/');expect(m.short_name).toBe('HITOKOTO');expect(m.share_target.params).toEqual({title:'title',text:'text',url:'url'});expect(m.share_target.action).toContain('view=nhk');});
 it('runs the entry script before the old learning module',()=>{const h=read('index.html');expect(h.indexOf('/app-entry.js')).toBeLessThan(h.indexOf('/src/main.tsx'));});
 it('both installed pages register the same updating worker without force reload',()=>{expect(read('src/main.tsx')).toContain('registerAppWorker()');expect(read('src/companion/main.tsx')).toContain('registerAppWorker()');expect(read('src/appWorker.ts')).toContain("updateViaCache: 'none'");expect(read('src/appWorker.ts')).not.toContain('location.reload(');expect(read('companion.html')).toContain('href="/manifest.webmanifest"');});
 it('keeps explicit NHK links and a return to companion',()=>{expect(read('src/companion/CompanionApp.tsx').match(/href="\/\?view=nhk"/g)).toHaveLength(3);expect(read('src/App.tsx')).toContain('href="/companion.html"');});
});
function worker(){
 const handlers:Record<string,(event:any)=>void>={};
 const stores=new Map<string,Map<string,Response>>();
 const key=(x:any)=>new URL(typeof x==='string'?x:x.url,'https://app.example').href;
 const added:string[][]=[];
 const cache={open:async(name:string)=>{if(!stores.has(name))stores.set(name,new Map());const map=stores.get(name)!;return {addAll:async(paths:string[])=>{added.push(paths);},put:async(k:any,v:Response)=>{map.set(key(k),v.clone());},match:async(k:any)=>map.get(key(k))?.clone()};},keys:async()=>[...stores.keys()],delete:vi.fn(async(name:string)=>stores.delete(name))};
 const fetch=vi.fn(async(_request:any,_options?:any)=>new Response('ONLINE',{headers:{'content-type':'text/html'}}));
 const claim=vi.fn(),skipWaiting=vi.fn();
 const scope:any={URL,Response,fetch,caches:cache,self:{location:{origin:'https://app.example'},clients:{claim},skipWaiting,addEventListener:(name:string,fn:any)=>{handlers[name]=fn;}}};
 runInNewContext(read('public/sw.js'),scope);
 const navigate=async(path:string)=>{let result:Promise<Response>|undefined;handlers.fetch({request:{url:new URL(path,'https://app.example').href,method:'GET',mode:'navigate'},respondWith:(value:Promise<Response>)=>{result=value;}});return result;};
 const event=async(name:string)=>{let pending:any;handlers[name]({waitUntil:(p:any)=>{pending=p;}});await pending;};
 return {handlers,stores,cache,fetch,claim,skipWaiting,added,navigate,event,scope};
}
describe('independent app shells, never a global home-page cache fallback',()=>{
 it.each([['/','/'],['/index.html','/'],['/?view=nhk','/?view=nhk'],['/?share_target=1&url=x','/?view=nhk'],['/companion.html','/companion.html'],['/explore.html','/explore.html'],['/unknown',null]])('maps %s to %s',(path,key)=>{const w=worker();expect(w.scope.shellKey(new URL(path,'https://app.example'))).toBe(key);});
 it('serves the companion and NHK independently after going offline',async()=>{const w=worker();w.fetch.mockResolvedValueOnce(new Response('NEON',{headers:{'content-type':'text/html'}}));await w.navigate('/companion.html');w.fetch.mockResolvedValueOnce(new Response('NHK',{headers:{'content-type':'text/html'}}));await w.navigate('/?view=nhk');w.fetch.mockRejectedValue(new Error('offline'));expect(await (await w.navigate('/companion.html'))?.text()).toBe('NEON');expect(await (await w.navigate('/?view=nhk'))?.text()).toBe('NHK');expect(await (await w.navigate('/?share_target=1&text=private'))?.text()).toBe('NHK');});
 it('does not use a polluted legacy root as an offline companion',async()=>{const w=worker();await (await w.cache.open('nihongo-explore-isolated-20260906-v1')).put('/',new Response('OLD ROOT'));w.fetch.mockRejectedValue(new Error('offline'));expect((await w.navigate('/companion.html'))?.status).toBe(503);});
 it('does not cache private share text as a key',async()=>{const w=worker();await w.navigate('/?share_target=1&text=PRIVATE_TITLE');const keys=[...w.stores.values()].flatMap(m=>[...m.keys()]);expect(keys).toEqual(['https://app.example/?view=nhk']);});
 it('only removes superseded owned shell caches',async()=>{const w=worker();for(const name of ['nihongo-explore-isolated-20260906-v1','hitokoto-shell-old','hitokoto-shell-20260911-entry-v1','study-audio-cache','other-app-data'])await w.cache.open(name);await w.event('activate');expect(await w.cache.keys()).toEqual(['hitokoto-shell-20260911-entry-v1','study-audio-cache','other-app-data']);expect(w.claim).toHaveBeenCalled();});
 it('preloads both entries and the launcher before activation',async()=>{const w=worker();await w.event('install');expect(w.added[0]).toContain('/companion.html');expect(w.added[0]).toContain('/?view=nhk');expect(w.added[0]).toContain('/app-entry.js');expect(w.skipWaiting).toHaveBeenCalled();});
 it.each([['https://app.example/api/nhk-speech','GET'],['https://app.example/api/nhk-speech','POST'],['https://other.example/assets/clip.mp3','GET']])('does not capture API or third-party traffic %s %s',(url,method)=>{const w=worker(),respondWith=vi.fn();w.handlers.fetch({request:{url,method,mode:'cors'},respondWith});expect(respondWith).not.toHaveBeenCalled();});
 it('revalidates documents rather than reusing HTTP cache',async()=>{const w=worker();await w.navigate('/companion.html');expect(w.fetch.mock.calls[0][1]).toEqual({cache:'no-store'});});
 it('never erases study databases, storage or cookies',()=>{const source=read('public/sw.js')+read('public/app-entry.js')+read('src/appWorker.ts');expect(source).not.toMatch(/localStorage\.(clear|removeItem)|indexedDB\.deleteDatabase|document\.cookie\s*=/);});
});

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
