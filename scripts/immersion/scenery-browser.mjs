import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
const base=process.env.IMMERSION_SCENE_BASE||'http://127.0.0.1:4173',out=process.env.IMMERSION_SCENE_OUT||'artifacts/immersion-scenery';await mkdir(out,{recursive:true});
const reports=[];let browser,page;
try{
 for(const engine of ['chromium','webkit'])for(const viewport of [{width:390,height:844},{width:1280,height:900}]){
  browser=await ({chromium,webkit})[engine].launch({headless:true});const context=await browser.newContext({viewport,reducedMotion:'no-preference',isMobile:viewport.width<600,hasTouch:viewport.width<600});
  let mic=0;await context.exposeBinding('__noPhysicalMic',()=>{mic++;});await context.addInitScript(()=>{Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{await window.__noPhysicalMic();throw Error('No physical microphone in scenery QA');}}});});
  page=await context.newPage();page.setDefaultTimeout(25000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/');await page.locator('[data-immersion-release]').waitFor();assert.equal(new URL(page.url()).pathname,'/companion.html');
  const video=page.locator('.imm-ambient video');await video.waitFor();
  await page.waitForFunction(()=>{const v=document.querySelector('.imm-ambient video');return v&&v.readyState>=2&&v.videoWidth>0&&!v.paused&&v.currentTime>.25;});
  const first=await video.evaluate(v=>{const c=document.createElement('canvas');c.width=160;c.height=90;const x=c.getContext('2d');x.drawImage(v,0,0,160,90);const data=x.getImageData(0,0,160,90).data;return{width:v.videoWidth,height:v.videoHeight,duration:v.duration,muted:v.muted,time:v.currentTime,source:v.currentSrc,pixels:Array.from(data),frames:v.getVideoPlaybackQuality?.().totalVideoFrames||null};});
  await page.waitForTimeout(1400);
  const second=await video.evaluate(v=>{const c=document.createElement('canvas');c.width=160;c.height=90;const x=c.getContext('2d');x.drawImage(v,0,0,160,90);return{time:v.currentTime,pixels:Array.from(x.getImageData(0,0,160,90).data),frames:v.getVideoPlaybackQuality?.().totalVideoFrames||null};});
  assert.equal(first.muted,true);assert.ok(first.duration>11.8&&first.duration<12.2);assert.ok(second.time!==first.time);assert.notDeepEqual(second.pixels,first.pixels,'Scenery must actually change, not just advance a static image timestamp');
  const brightness=first.pixels.filter((_,i)=>i%4!==3).reduce((a,b)=>a+b,0)/(160*90*3);assert.ok(brightness>5,'Black video is not a successful background');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:`${out}/${engine}-${viewport.width}-home.png`,fullPage:true});
  await page.getByRole('button',{name:'风景',exact:true}).click();await page.locator('.imm-scene-settings').waitFor();
  await page.getByRole('button',{name:'看全景 · 暂停麦克风',exact:true}).click();
  const exit=page.getByRole('button',{name:'← 返回陪练 · 麦克风已暂停',exact:true});await exit.waitFor();
  await page.waitForFunction(()=>{const v=document.querySelector('.imm-ambient video');return v&&!v.paused;});
  await page.screenshot({path:`${out}/${engine}-${viewport.width}-wallpaper.png`,fullPage:true});await exit.click();await page.getByRole('button',{name:'聊一会儿',exact:true}).waitFor();
  assert.equal(mic,0);assert.deepEqual(errors,[]);
  reports.push({engine,viewport,scope:'REAL_HOSTED_MEDIA_REAL_DECODER_NO_PHYSICAL_MICROPHONE',source:first.source,width:first.width,height:first.height,duration:first.duration,muted:true,decodedChangingFrames:true,brightness,normalEntry:true,wallpaperRoundTrip:true,micRequests:mic,pageErrors:errors});
  await context.close();await browser.close();browser=null;
 }
}catch(e){if(page&&!page.isClosed())await page.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});reports.push({ok:false,failure:e.stack||String(e)});process.exitCode=1;}finally{await browser?.close();await writeFile(out+'/result.json',JSON.stringify(reports,null,2));console.log('ACTUAL_SCENERY_CHECK',JSON.stringify(reports));}
