// Actual headed Chrome/Metal asset validation. Never opens the game or NHK entrypoints.
import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..'),out=path.join(root,'docs/art/desktop-v1/evidence');
const browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:false,args:['--use-angle=metal']});
const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:2});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))errors.push(`${r.status()} ${r.url()}`);});
await page.goto(process.env.VIEWER_URL||'http://127.0.0.1:8766');await page.waitForFunction(()=>window.assetReady,null,{timeout:60000});
await page.waitForTimeout(3000);
await page.evaluate(()=>{window.recordChunks=[];window.captureRecorder=new MediaRecorder(document.querySelector('canvas').captureStream(30),{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:1600000});captureRecorder.ondataavailable=e=>recordChunks.push(e.data);captureRecorder.start(1000);});
const reports={captureSettings:{canvasVideoRecording:true,recordingAffectsPerformance:true,headed:true,angle:'metal',deviceScaleFactor:2,viewport:[1280,800],hardwareScalingCap:1.5,physicalDisplayFromOS:[2880,1800],note:'DPR 2 context matches nominal Retina scale; viewport is controlled. Frame times are requestAnimationFrame intervals, not GPU timer queries. Only this isolated asset viewer was measured.'},runs:[]};
async function screenshot(name){await page.screenshot({path:path.join(out,name+'.png')});}
async function pose(name){await page.evaluate(n=>review.pose(n),name);await page.waitForTimeout(400);}
for(const name of ['front','detail','side','back']){await pose(name);await screenshot('shop-'+name+'-neutral');}
await page.locator('#light').click();await pose('front');await screenshot('shop-front-warm');await page.locator('#light').click();
// Door-to-counter rays at body heights are geometry checks only; the game collision system is untouched.
reports.doorClearance=await page.evaluate(()=>{const B=BABYLON,results=[];for(const x of [-.73,0,.73])for(const y of [.3,1.0,1.68,2.55]){const hit=review.scene.pickWithRay(new B.Ray(new B.Vector3(x,y,-.1),new B.Vector3(0,0,1),2.95),m=>m.name.startsWith('shop_'));results.push({x,y,blocked:!!hit?.hit,mesh:hit?.pickedMesh?.name||null});}return results;});
await pose('front');await page.evaluate(()=>{review.startMeasurement();review.setRotation(true);});await page.waitForTimeout(15000);reports.runs.push({scenario:'shop sustained exterior orbit 15s',...await page.evaluate(()=>review.report())});await page.evaluate(()=>review.setRotation(false));
await pose('detail');await page.evaluate(()=>review.startMeasurement());
for(let i=0;i<90;i++){await page.evaluate(i=>{review.camera.radius=4.2-i/90*2.65;review.camera.alpha=-Math.PI/2+Math.sin(i/15)*.16;},i);await page.waitForTimeout(100);}
reports.runs.push({scenario:'shop camera moves through doorway toward counter 9s; no game collisions',...await page.evaluate(()=>review.report())});await screenshot('shop-counter-close');
await page.locator('#asset').selectOption('keeper');await page.waitForFunction(()=>review.report().loaded&&review.report().asset==='keeper');await page.waitForTimeout(1500);
for(const name of ['front','detail','side','back']){await pose(name);await screenshot('keeper-'+name+'-neutral');}
await pose('detail');await page.locator('#light').click();await screenshot('keeper-detail-warm');await page.locator('#light').click();
for(const clip of ['idle','greet','talk']){
 await pose(clip==='greet'?'front':'detail');await page.locator('#clip').selectOption(clip);await page.evaluate(()=>review.startMeasurement());await page.waitForTimeout(1250);await screenshot('keeper-'+clip);await page.waitForTimeout(5000);reports.runs.push({scenario:'keeper '+clip+' active animation 6.25s',...await page.evaluate(()=>review.report())});
 // Bone palette must change during an actual clip, not merely exist in metadata.
 const first=await page.evaluate(()=>Array.from(review.scene.skeletons[0].getTransformMatrices(review.scene.meshes.find(m=>m.skeleton))));await page.waitForTimeout(400);const second=await page.evaluate(()=>Array.from(review.scene.skeletons[0].getTransformMatrices(review.scene.meshes.find(m=>m.skeleton))));reports.runs.at(-1).bonePaletteChanged=first.some((v,i)=>Math.abs(v-second[i])>1e-5);
}
await pose('front');await page.evaluate(()=>{review.startMeasurement();review.setRotation(true);});await page.waitForTimeout(12000);reports.runs.push({scenario:'keeper animated full body orbit 12s',...await page.evaluate(()=>review.report())});
reports.errors=errors;reports.browserVersion=browser.version();await fs.writeFile(path.join(out,'browser-hardware.json'),JSON.stringify(reports,null,2)+'\n');
const video64=await page.evaluate(()=>new Promise(resolve=>{captureRecorder.onstop=async()=>{const blob=new Blob(recordChunks,{type:'video/webm'});const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.readAsDataURL(blob);};captureRecorder.stop();}));await fs.writeFile(path.join(out,'asset-browser-capture.webm'),Buffer.from(video64,'base64'));await context.close();await browser.close();
console.log(JSON.stringify({runs:reports.runs.map(r=>({scenario:r.scenario,p50:r.frameTimeMs.p50,p95:r.frameTimeMs.p95,software:r.softwareRenderer,triangles:r.triangles,bonePaletteChanged:r.bonePaletteChanged})),errors,doorBlocked:reports.doorClearance.filter(r=>r.blocked)}));
if(errors.length||reports.runs.some(r=>r.softwareRenderer)||reports.doorClearance.some(r=>r.blocked)||reports.runs.some(r=>r.bonePaletteChanged===false))process.exitCode=1;
