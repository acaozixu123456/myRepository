from pathlib import Path

def change(path,old,new):
    p=Path(path);text=p.read_text()
    if new in text:return
    assert text.count(old)==1,(path,'unexpected revision',old[:80])
    p.write_text(text.replace(old,new))

change('src/explore/world.ts','shadows.usePoissonSampling=true;','shadows.useBlurExponentialShadowMap=true;shadows.useKernelBlur=true;shadows.blurKernel=12;')
change('src/explore/world.ts','const render=()=>{\n    if(disposed)return;const dt=','let lastDraw=0;\n  const render=()=>{\n    if(disposed)return;const now=performance.now();if(paused&&now-lastDraw<100)return;lastDraw=now;const dt=')
change('src/explore/world.ts','diagnostics(){return{fps,meshCount:','diagnostics(){return{fps,floorY:player.position.y,keys:[...keys],meshCount:')
change('scripts/explore-browser.mjs','viewport:{width:1440,height:900},deviceScaleFactor:1,','viewport:{width:1440,height:900},deviceScaleFactor:.75,')
change('scripts/explore-browser.mjs','viewport:{width:1280,height:800},serviceWorkers:', 'viewport:{width:1280,height:800},deviceScaleFactor:.75,serviceWorkers:')
change('scripts/explore-browser.mjs',"rendering:'Real WebGL with software GPU; not physical-device performance evidence'","rendering:'Real WebGL with software GPU; desktop DPR 0.75, mobile DPR 1; not physical-device performance evidence'")
change('scripts/explore-browser.mjs',"await page.keyboard.down('ArrowRight');await page.waitForTimeout(600);await page.keyboard.up('ArrowRight');\n assert((await page.evaluate(()=>window.__explore.read())).world.pose.yaw>after.yaw+.05,'look control failed');", "report.diagnostics.push({beforeMove:before,afterMove:after,current:await page.evaluate(()=>window.__explore.read())});\n await page.keyboard.down('ArrowRight');\n try{await page.waitForFunction(yaw=>{const current=window.__explore.read().world.pose.yaw;return Math.abs(Math.atan2(Math.sin(current-yaw),Math.cos(current-yaw)))>.15;},after.yaw,{timeout:15000});}finally{await page.keyboard.up('ArrowRight');}\n report.diagnostics.push({afterTurn:await page.evaluate(()=>window.__explore.read())});")
change('scripts/explore-browser.mjs',"await page.goto(base+'/explore.html?qa=1'", "await page.addInitScript(()=>{window.__inputLog=[];for(const type of ['keydown','keyup'])window.addEventListener(type,e=>{window.__inputLog.push({type,code:e.code,focus:document.hasFocus(),at:performance.now()});window.__inputLog=window.__inputLog.slice(-30);},true);});\n  await page.goto(base+'/explore.html?qa=1'")
change('scripts/explore-browser.mjs',"}finally{writeFileSync(`${out}/report.json`", "}finally{for(const context of browser?.contexts()||[])for(const page of context.pages()){try{report.diagnostics.push({final:await page.evaluate(()=>({state:window.__explore?.read(),input:window.__inputLog,focus:document.hasFocus()}))});}catch{}}writeFileSync(`${out}/report.json`")
p=Path('src/explore/style.css');text=p.read_text();extra='\n/* Touch targets stay operable even in the compact landscape HUD. */\nbutton,.round-button{min-height:44px}.icon-button,.toolbelt button{min-width:44px;min-height:44px}\n'
if extra not in text:p.write_text(text+extra)
