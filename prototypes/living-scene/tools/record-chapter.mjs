import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {recordBrowser} from './record-browser.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const out=path.join(root,'docs/living-scene/chapter1-v1/evidence');
const capture='/Users/xiaruonan/nihongo-art-work/toolchain/chapter1-capture';
const {chromium}=await import('/Users/xiaruonan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:false,args:['--use-angle=metal','--disable-backgrounding-occluded-windows']});
const page=await browser.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1});
const room=async id=>{await page.waitForFunction(id=>window.__chapter.snapshot().room===id&&!window.__chapter.snapshot().busy,id);await page.waitForTimeout(500);};
const talk=()=>page.locator('#room-hotspot').click();
try{
 await page.goto(process.env.SCENE_URL||'http://127.0.0.1:8781/?qa=1');
 const recording=await recordBrowser(page,capture,async p=>{
  await p.evaluate(()=>{
   const chunks=[];window.chapterRecorder=new MediaRecorder(window.__livingAudioCapture(),{mimeType:'audio/webm;codecs=opus'});
   window.chapterRecorder.ondataavailable=e=>chunks.push(e.data);
   window.chapterAudioDone=new Promise(resolve=>window.chapterRecorder.onstop=async()=>{const b=new Uint8Array(await new Blob(chunks).arrayBuffer());let s='';for(const n of b)s+=String.fromCharCode(n);resolve(btoa(s));});
   window.chapterAudioStart=Date.now()/1000;window.chapterRecorder.start();
  });
  await p.waitForTimeout(11500);
  await p.locator('#hotspot-shop').click();await p.locator('#story-enter').click();await room('shop');
  await p.mouse.move(800,400);await p.waitForTimeout(6500);await talk();await p.waitForTimeout(1700);
  await p.locator('#room-choices button').first().click();await p.waitForTimeout(1700);await p.locator('#room-choices button').first().click();await room('sento');
  await p.mouse.move(800,400);await p.waitForTimeout(6500);await talk();await p.locator('#room-choices button').first().click();await room('bath');
  await p.mouse.move(800,400);await p.waitForTimeout(9500);await talk();await p.locator('#room-choices button').first().click();await p.waitForTimeout(1800);
  await p.locator('#room-choices button').first().click();await room('sento');await p.mouse.move(800,890);await p.locator('#room-next').click();await room('shop');await talk();await p.waitForTimeout(1800);
  await p.locator('#room-choices button').first().click();await p.waitForTimeout(1400);await p.keyboard.press('Escape');await p.keyboard.press('Escape');await room('street');await p.waitForTimeout(1500);
  await p.evaluate(()=>window.chapterRecorder.stop());
 },{prepare:async p=>{await p.mouse.move(800,890);await p.locator('#sound').click();await p.mouse.move(800,400);}});
 const b64=await page.evaluate(()=>window.chapterAudioDone);
 await fs.writeFile(path.join(capture,'scene-audio.webm'),Buffer.from(b64,'base64'));
 const audio=await page.evaluate(async b64=>{
  const ctx=new AudioContext(),buffer=await ctx.decodeAudioData(Uint8Array.from(atob(b64),c=>c.charCodeAt(0)).buffer);
  const channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i));let sum=0,peak=0;
  const wav=new ArrayBuffer(44+buffer.length*channels.length*2),v=new DataView(wav),str=(o,s)=>[...s].forEach((c,i)=>v.setUint8(o+i,c.charCodeAt(0)));
  str(0,'RIFF');v.setUint32(4,wav.byteLength-8,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,channels.length,true);v.setUint32(24,buffer.sampleRate,true);v.setUint32(28,buffer.sampleRate*channels.length*2,true);v.setUint16(32,channels.length*2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,wav.byteLength-44,true);
  for(let i=0;i<buffer.length;i++)for(let c=0;c<channels.length;c++){const n=channels[c][i];sum+=n*n;peak=Math.max(peak,Math.abs(n));v.setInt16(44+(i*channels.length+c)*2,Math.round(Math.max(-1,Math.min(1,n))*32767),true);}
  let s='';for(const n of new Uint8Array(wav))s+=String.fromCharCode(n);await ctx.close();return{duration:buffer.duration,peak,rms:Math.sqrt(sum/(buffer.length*channels.length)),started:window.chapterAudioStart,wav:btoa(s)};
 },b64);
 await fs.writeFile(path.join(capture,'scene-audio.wav'),Buffer.from(audio.wav,'base64'));delete audio.wav;
 const frames=JSON.parse(await fs.readFile(path.join(capture,'timestamps.json'),'utf8'));audio.offsetSeconds=audio.started-frames[0].timestamp;
 if(audio.rms<.0001)throw Error('Recorded sound is silent');
 await fs.writeFile(path.join(capture,'audio-timing.json'),JSON.stringify(audio,null,2));
 await fs.writeFile(path.join(out,'recording.json'),JSON.stringify({recording,audio,scope:'Real browser viewport and the same page Web Audio output. 15 fps delivery encoding is not renderer FPS.'},null,2));
 console.log(JSON.stringify({recording,audio}));
}finally{await browser.close();}
