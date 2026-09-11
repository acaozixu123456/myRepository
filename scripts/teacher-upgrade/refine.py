from pathlib import Path
p=Path('scripts/teacher-replay-media.mjs')
p.write_text(r'''import {chromium,webkit} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const out='artifacts/teacher-replay';await mkdir(out,{recursive:true});const results=[];
execFileSync('node_modules/.bin/esbuild',['src/companion/remoteReplay.ts','--bundle','--format=iife','--global-name=ReplayModule',`--outfile=${out}/replay-bundle.js`]);
const bundle=await readFile(out+'/replay-bundle.js','utf8');
for(const engine of ['chromium','webkit']){
 const browser=await ({chromium,webkit})[engine].launch({headless:true});
 const page=await browser.newPage();page.setDefaultTimeout(12000);
 const record={engine,actualMediaRecorder:true,syntheticRemoteOutputOnly:true,noPhysicalMicrophone:true,ok:false,errors:[]};
 page.on('pageerror',e=>record.errors.push(e.message));
 try{
  // Pure isolated media test: use the actual class, not a Vite module lifecycle or mocked recorder.
  await page.setContent('<!doctype html><html><body><button>准备示范声音</button><button id="replay">重播原音</button></body></html>');
  await page.addScriptTag({content:bundle});
  await page.evaluate(()=>{
   window.__media={ready:false,playing:false,blocked:false};window.__diagnostic={events:[],started:false};
   const replay=window.__replay=new ReplayModule.RemoteReplay((ready,playing,blocked)=>window.__media={ready,playing,blocked});
   document.querySelector('button').onclick=async()=>{
    try{
     const ctx=window.__tone=new AudioContext();await ctx.resume();
     const dest=window.__destination=ctx.createMediaStreamDestination(),source=window.__source=ctx.createOscillator();
     source.frequency.value=440;source.connect(dest);source.start();
     window.__diagnostic.started=true;window.__diagnostic.context=ctx.state;
     replay.attachRemote(dest.stream);replay.begin();
     const recorder=replay.recorder;window.__diagnostic.mime=recorder?.mimeType;window.__diagnostic.state=recorder?.state;
     for(const name of ['start','stop','error','dataavailable'])recorder?.addEventListener(name,e=>window.__diagnostic.events.push({type:name,bytes:e.data?.size,error:e.error?.message,at:performance.now()}));
     setTimeout(()=>{replay.complete();source.stop();window.__diagnostic.completed=true;},1200);
    }catch(e){window.__diagnostic.error=e.message;}
   };
   document.querySelector('#replay').onclick=async()=>{try{await replay.playOriginal();}catch(e){window.__diagnostic.replayError=e.message;}};
  });
  await page.getByRole('button',{name:'准备示范声音',exact:true}).click();
  await page.waitForFunction(()=>window.__media?.ready||window.__diagnostic?.error,null,{timeout:8000});
  record.capture=await page.evaluate(()=>({media:window.__media,diagnostic:window.__diagnostic,bytes:window.__replay.blob?.size||0}));
  assert.equal(record.capture.media.ready,true,JSON.stringify(record.capture));assert.ok(record.capture.bytes>128);
  await page.getByRole('button',{name:'重播原音',exact:true}).click();
  await page.waitForFunction(()=>window.__media.playing,null,{timeout:5000});
  record.replayed=true;record.bytes=record.capture.bytes;
  await page.evaluate(()=>{window.__replay.dispose();void window.__tone.close();});
  assert.equal(await page.evaluate(()=>document.querySelectorAll('audio').length),0);
  assert.deepEqual(record.errors,[]);record.released=true;record.ok=true;
 }catch(e){record.failure=e.message;record.diagnostic=await page.evaluate(()=>({media:window.__media,diagnostic:window.__diagnostic,context:window.__tone?.state})).catch(()=>null);throw e;}
 finally{results.push(record);await browser.close();await writeFile(out+'/result.json',JSON.stringify(results,null,2));console.log('REMOTE_REPLY_MEDIA',JSON.stringify(record));}
}
''')
