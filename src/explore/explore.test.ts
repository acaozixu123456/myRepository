import {describe,it,expect} from 'vitest';
import {freshProgress,isProgress,loadProgress,saveProgress,SAVE_KEY,interpret,reply,markHint,recordSeen} from './state';
import {ROAD,ROAD_LENGTH,distanceToRoad,sampleRoad} from './geo';
import {ROAD_COORDINATES} from './roadData';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

describe('isolated exploration state',()=>{
  it('starts with independently validated game-only state',()=>{expect(isProgress(freshProgress())).toBe(true);});
  it.each([true,false])('keeps actual warm/bag choices and charges once: warm=%s',warm=>{
    let p=freshProgress();
    p=reply(p,'日替わり弁当を一つください。',false).progress;
    p=reply(p,warm?'温めてもらえますか。':'そのままでお願いします。',false).progress;
    p=reply(p,warm?'袋はいりません。':'一枚お願いします。',false).progress;
    expect(p.coins).toBe(1000);expect(p.purchase.warm).toBe(warm);expect(p.purchase.bag).toBe(!warm);
    p=reply(p,'千円でお願いします。',false).progress;
    expect(p.coins).toBe(warm?350:347);expect(p.purchase.step).toBe('done');expect(isProgress(p)).toBe(true);
    const duplicate=reply(p,'千円でお願いします。',false);expect(duplicate.accepted).toBe(false);expect(duplicate.progress).toEqual(p);
  });
  it('never misclassifies a viewed explanation as independently used',()=>{
    let p=recordSeen(freshProgress(),'directions');expect(p.learning.directions).toEqual({seen:1,assisted:0,independent:0});
    p=markHint(p);p=JSON.parse(JSON.stringify(p));p=reply(p,'お弁当を一つお願いします。',false).progress;
    expect(p.learning.order?.assisted).toBe(1);expect(p.learning.order?.independent).toBe(0);
  });
  it('only mutates the new namespaced key and preserves NHK bytes',()=>{
    const values=new Map([['nihongo.nhk.articleLibrary.v1','ORIGINAL-NHK-BYTES']]);
    expect(saveProgress({setItem:(k,v)=>{values.set(k,v);}},freshProgress())).toBe(true);
    expect(values.size).toBe(2);expect(values.get('nihongo.nhk.articleLibrary.v1')).toBe('ORIGINAL-NHK-BYTES');expect(values.has(SAVE_KEY)).toBe(true);
    expect(loadProgress({getItem:k=>values.get(k)??null}).writable).toBe(true);
  });
  it.each(['{','{"version":900}',JSON.stringify({...freshProgress(),coins:0}),JSON.stringify({...freshProgress(),bookmarked:['constructor']})])('preserves unknown/corrupt source without writes: %s',raw=>{
    const got=loadProgress({getItem:()=>raw});expect(got.writable).toBe(false);expect(got.warning).not.toBe('');
  });
  it('reports storage denial and rejects non-finite or contradictory saves',()=>{
    expect(loadProgress({getItem(){throw Error('denied');}}).writable).toBe(false);
    expect(saveProgress({setItem(){throw Error('quota');}},freshProgress())).toBe(false);
    const p=freshProgress();p.pose.x=NaN;expect(isProgress(p)).toBe(false);
    const q=freshProgress();q.purchase.step='heat';q.purchase.bag=true;expect(isProgress(q)).toBe(false);
  });
  it.each([
    ['heat','温めないでください。','no'],['heat','あたためてください。','yes'],['heat','はい。','yes'],
    ['bag','袋はいりません。','no'],['bag','袋を一枚ください。','yes'],['bag','大丈夫です。','unclear'],
    ['order','日替わり弁当を２つください。','unclear'],['order','<script>yes</script>','unclear'],
    ['pay','１０００円でお願いします。','accept'],
  ] as const)('handles bounded Japanese intent: %s %s',(step,text,result)=>expect(interpret(step,text)).toBe(result));
});

describe('real road geometry and disclosure',()=>{
  it('retains the exact two attributed OSM road ways in public data',()=>{
    const geo=JSON.parse(readFileSync('public/explore/yanaka-roads.geojson','utf8'));
    const ids=geo.features.map((f:any)=>f.properties.osm_id||f.properties.id||f.id);
    expect(geo.features).toHaveLength(2);expect(JSON.stringify(ids)).toContain('737745076');
    const joined=geo.features.flatMap((f:any)=>f.geometry.coordinates);
    for(const coord of ROAD_COORDINATES)expect(joined).toContainEqual([...coord]);
  });
  it('preserves a continuous approximately 167 metre road with bounded sampling',()=>{
    expect(ROAD_LENGTH).toBeGreaterThan(165);expect(ROAD_LENGTH).toBeLessThan(170);
    expect(ROAD[0]).toEqual({x:0,z:0});expect(sampleRoad(-100).x).toBe(0);
    expect(distanceToRoad(sampleRoad(50))).toBeLessThan(.0001);expect(distanceToRoad({x:40,z:40})).toBeGreaterThan(30);
    const last=sampleRoad(9999);expect(last.z).toBeCloseTo(ROAD.at(-1)!.z);
  });
});

describe('service worker game/NHK shell separation',()=>{
  async function exercise(path:string,offline=false,code=200){
    const handlers:Record<string,(event:any)=>void>={};const stored=new Map<string,Response>();stored.set('/',new Response('LAUNCH'));stored.set('/?view=nhk',new Response('NHK'));
    runInNewContext(readFileSync('public/sw.js','utf8'),{
      self:{location:{origin:'https://game.example'},addEventListener:(name:string,fn:any)=>{handlers[name]=fn;}},
      URL,Response,fetch:async()=>{if(offline)throw Error('offline');return new Response('GAME',{status:code,headers:{'Content-Type':'text/html'}});},
      caches:{open:async()=>({put:async(k:string,v:Response)=>{stored.set(k,v);},match:async(k:string)=>stored.get(k)?.clone()}),match:async(k:string)=>stored.get(k)?.clone()},
    });
    let response:Promise<Response>|undefined;handlers.fetch({request:{url:'https://game.example'+path,method:'GET',mode:'navigate'},respondWith:(p:Promise<Response>)=>{response=p;}});
    const r=await response!;await Promise.resolve();return{stored,r};
  }
  it('does not replace the NHK shell or launcher with game HTML',async()=>{
    const {stored}=await exercise('/explore.html?qa=1');expect(await stored.get('/')!.text()).toBe('LAUNCH');expect(await stored.get('/?view=nhk')!.text()).toBe('NHK');expect(await stored.get('/explore.html')!.text()).toBe('GAME');
  });
  it('does not return unrelated NHK HTML when game is unavailable offline',async()=>{const {r}=await exercise('/explore.html',true);expect(r.status).toBe(503);});
  it('keeps explicit NHK offline fallback and rejects error-response caching',async()=>{
    expect(await(await exercise('/?view=nhk',true)).r.text()).toBe('NHK');
    expect(await(await exercise('/',true)).r.text()).toBe('LAUNCH');
    expect((await exercise('/explore.html',false,500)).stored.has('/explore.html')).toBe(false);
  });
});
