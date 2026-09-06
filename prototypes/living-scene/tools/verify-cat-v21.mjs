/** Natural relocation acceptance; no fast-forward or forced product state. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCatDirector,catAnchors } from '../src/cat-director.js';
import { recordBrowser } from './record-browser.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const out=path.join(root,'docs/living-scene/cat-v21/evidence');
const capture='/Users/xiaruonan/nihongo-art-work/toolchain/cat-v21-capture';
const checks={},events=[];
const check=(name,value)=>{checks[name]=value;assert(value,name);};
for(const initial of [0,1,2]) {
 const d=createCatDirector(initial,()=>.5);let prev=d.snapshot().position,departures=0;
 for(let i=0;i<12000;i++) {
  const event=d.update(.02);const s=d.snapshot();if(event==='depart')departures++;
  assert(s.position[0]>=.69-1e-9&&s.position[0]<=.79+1e-9);
  assert(s.position[1]>=.215-1e-9&&s.position[1]<=.24+1e-9);
  assert(Math.hypot(s.position[0]-prev[0],s.position[1]-prev[1])<.001);
  prev=s.position;
 }
 check(`continuousDryPathFrom${initial}`,d.snapshot().arrivals>=2 && departures>=2);
}
const held=createCatDirector(0,()=>.5);
for(let i=0;i<8000;i++)held.update(.02,{blocked:true});
check('attentionPostponesDeparture',!held.snapshot().trip && held.snapshot().arrivals===0);
const frozen=held.snapshot();held.update(10,{paused:true});check('directorPause',held.snapshot().clock===frozen.clock);
const {chromium}=await import('/Users/xiaruonan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:false,args:['--use-angle=metal','--disable-backgrounding-occluded-windows']});
const p=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
const errors=[],states={};p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
p.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
const snap=()=>p.evaluate(()=>{const s=window.__livingScene.snapshot();return {cat:s.cat,audio:s.audio,story:s.story,paused:s.paused,time:s.time,errors:s.errors};});
const shot=n=>p.screenshot({path:path.join(out,`${n}.png`)});
try {
 await p.goto('http://127.0.0.1:8778/?qa=1');await p.bringToFront();await p.waitForFunction(()=>window.__livingScene?.ready);
 await p.mouse.move(800,450);await p.waitForTimeout(6200);await shot('hero-clean');
 check('nameConfirmed',await p.locator('#cat-hotspot').getAttribute('aria-label').then(t=>t.includes('拿铁')));
 check('defaultMuted',!(await snap()).audio.enabled);
 await p.locator('#cat-hotspot').click();await p.waitForTimeout(1000);await shot('cat-attentive');
 await p.locator('#cat-pet').click();await p.waitForTimeout(1100);await shot('cat-purring');
 check('petWorks',(await snap()).cat.state==='purring');
 await p.keyboard.press('Escape');await p.locator('#hotspot-shop').click();
 check('shopPreserved',(await snap()).story.active==='shop');await p.keyboard.press('Escape');
 await p.emulateMedia({reducedMotion:'reduce'});const stopped=await snap();await p.waitForTimeout(600);
 check('reducedMotionStopsTravel',(await snap()).cat.director.clock===stopped.cat.director.clock);
 await p.emulateMedia({reducedMotion:'no-preference'});
 console.log('Functional checks passed. Waiting for an unforced, naturally scheduled move.');
 const recording=await recordBrowser(p,capture,async page=>{
   await page.evaluate(()=>{window.transitionEvidence=[];let last='';window.collectCatTransition=true;function sample(){if(!window.collectCatTransition)return;const c=window.__livingScene.snapshot().cat;const key=JSON.stringify([c.motionPose,c.anchor.map(v=>v.toFixed(4))]);if(key!==last){window.transitionEvidence.push({at:performance.now(),pose:c.motionPose,anchor:c.anchor,travelMix:c.travelMix});last=key;}requestAnimationFrame(sample);}sample();});
   await page.evaluate(()=>{
     const stream=window.__livingAudioCapture();const chunks=[];
     window.catRecording=new MediaRecorder(stream,{mimeType:'audio/webm;codecs=opus'});
     window.catRecording.ondataavailable=e=>chunks.push(e.data);
     window.catAudioDone=new Promise(resolve=>window.catRecording.onstop=async()=>{
       const b=new Uint8Array(await new Blob(chunks).arrayBuffer());let binary='';for(const n of b)binary+=String.fromCharCode(n);resolve(btoa(binary));
     });window.catAudioStart=Date.now()/1000;window.catRecording.start();
   });
   await page.mouse.move(800,420);
   await page.waitForFunction(()=>!!window.__livingScene.snapshot().cat.director.trip,{},{timeout:12000});
   const start=await snap();states.departure=start;await shot('departure');
   await page.waitForFunction(()=>window.__livingScene.snapshot().cat.motionPose?.phase==='turning');await shot('turning');
   await page.waitForFunction(()=>window.__livingScene.snapshot().cat.motionPose?.phase==='walking');
   await page.waitForTimeout(450);await shot('mid-walk');
   await page.locator('#cat-hotspot').hover();await page.waitForTimeout(100);
   const held=await snap();await page.waitForTimeout(500);const still=await snap();
   check('approachHoldsExactPose',JSON.stringify(held.cat.motionPose)===JSON.stringify(still.cat.motionPose)&&JSON.stringify(held.cat.anchor)===JSON.stringify(still.cat.anchor)&&still.cat.travelMix===1);
   await shot('approach-hold');await page.mouse.move(800,420);
   await page.waitForFunction(()=>window.__livingScene.snapshot().cat.motionPose?.phase==='settling');await page.waitForTimeout(450);await shot('settling');
   await page.waitForFunction(()=>window.__livingScene.snapshot().cat.director.arrivals>0,{},{timeout:15000});
   await page.waitForTimeout(1200);states.arrival=await snap();await shot('arrival');
   check('actualAnchorChanged',states.arrival.cat.anchorIndex!==start.cat.anchorIndex);
   events.push(...await page.evaluate(()=>{window.collectCatTransition=false;return window.transitionEvidence;}));
   check('actualIntermediatePositions',new Set(events.map(e=>e.anchor[0].toFixed(4))).size>3);
   check('singleMotionSilhouette',events.every(e=>e.travelMix===0||e.travelMix===1));
   for(const phase of ['rising','turning','walking','settling'])check(`actualPhase_${phase}`,events.some(e=>e.pose?.phase===phase));
   check('allSixDeparturePoses',new Set(events.filter(e=>['rising','turning'].includes(e.pose?.phase)).map(e=>e.pose.frame)).size===6);
   check('allSixSettlePoses',new Set(events.filter(e=>e.pose?.phase==='settling').map(e=>e.pose.frame)).size===6);
   await page.locator('#cat-hotspot').click();await page.locator('#cat-pet').click();await page.waitForTimeout(2500);
   states.purring=await snap();check('audioStillDucks',states.purring.audio.buses.purr>.28&&states.purring.audio.buses.music<.06);
   await page.locator('#cat-rest').click();await page.waitForTimeout(3000);await page.keyboard.press('Escape');
   await page.mouse.move(800,420);await page.waitForTimeout(7000);await page.evaluate(()=>window.catRecording.stop());
 },{prepare:async page=>{
   await page.mouse.move(1550,890);await page.locator('#sound').click();await page.mouse.move(800,420);
   await page.waitForFunction(()=>{const d=window.__livingScene.snapshot().cat.director;return d.nextMove-d.clock<3;},{},{timeout:90000});
 }});
  const b64=await p.evaluate(()=>window.catAudioDone);await fs.writeFile(path.join(out,'scene-audio.webm'),Buffer.from(b64,'base64'));
  const audio=await p.evaluate(async b64=>{
    const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));const ctx=new AudioContext();
    const buffer=await ctx.decodeAudioData(bytes.buffer);let sum=0,peak=0;
    const channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i));
    for(const ch of channels)for(const v of ch){peak=Math.max(peak,Math.abs(v));sum+=v*v;}
    const wav=new ArrayBuffer(44+buffer.length*channels.length*2),view=new DataView(wav);
    const str=(offset,text)=>[...text].forEach((c,i)=>view.setUint8(offset+i,c.charCodeAt(0)));
    str(0,'RIFF');view.setUint32(4,wav.byteLength-8,true);str(8,'WAVE');str(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels.length,true);view.setUint32(24,buffer.sampleRate,true);view.setUint32(28,buffer.sampleRate*channels.length*2,true);view.setUint16(32,channels.length*2,true);view.setUint16(34,16,true);str(36,'data');view.setUint32(40,wav.byteLength-44,true);
    for(let i=0;i<buffer.length;i++)for(let c=0;c<channels.length;c++)view.setInt16(44+(i*channels.length+c)*2,Math.round(Math.max(-1,Math.min(1,channels[c][i]))*32767),true);
    let binary='';for(const n of new Uint8Array(wav))binary+=String.fromCharCode(n);
    await ctx.close();return {duration:buffer.duration,sampleRate:buffer.sampleRate,channels:channels.length,peak,rms:Math.sqrt(sum/(buffer.length*channels.length)),started:window.catAudioStart,wav:btoa(binary)};
  },b64);
  await fs.writeFile(path.join(capture,'scene-audio.wav'),Buffer.from(audio.wav,'base64'));delete audio.wav;
  const frames=JSON.parse(await fs.readFile(path.join(capture,'timestamps.json'),'utf8'));
  audio.offsetSeconds=audio.started-frames[0].timestamp;
  check('actualAudioNotSilent',audio.rms>.0001 && audio.peak<.99);
  await fs.writeFile(path.join(capture,'audio-timing.json'),JSON.stringify(audio,null,2));

 check('noBrowserErrors',errors.length===0);
 const hardware=await p.evaluate(()=>window.__livingScene.hardware);
 await fs.writeFile(path.join(out,'browser-report.json'),JSON.stringify({date:new Date().toISOString(),checks,states,events,errors,hardware,recording,audio,performance:'No FPS benchmark; natural elapsed time, not forced travel.'},null,2));
 console.log(JSON.stringify({checks,recording,audio},null,2));
} catch(error) {
 await shot('failure');await fs.writeFile(path.join(out,'failure.json'),JSON.stringify({failure:String(error),checks,current:await snap(),errors},null,2));throw error;
} finally {await browser.close();}
