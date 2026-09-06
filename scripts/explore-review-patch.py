from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if new in text:
        return
    assert text.count(old) == 1, f'Unexpected source revision: {path}'
    p.write_text(text.replace(old, new))


replace_once('src/explore/world.ts',
    'const shadows=new ShadowGenerator(coarse?1024:2048,sun);shadows.usePercentageCloserFiltering=true;shadows.filteringQuality=ShadowGenerator.QUALITY_LOW;shadows.bias=.002;shadows.normalBias=.025;shadows.setDarkness(.28);',
    'const shadows=new ShadowGenerator(coarse?512:1024,sun);shadows.usePoissonSampling=true;shadows.bias=.002;shadows.normalBias=.025;shadows.setDarkness(.28);\n  // All shadow casters in this slice are static. Reuse the depth map instead of redrawing the entire street every frame.\n  const shadowMap=shadows.getShadowMap();if(shadowMap)shadowMap.refreshRate=0;')
replace_once('src/explore/main.ts',
    "window.addEventListener('pagehide',()=>{persist();speech.stop();});document.addEventListener('visibilitychange',()=>{if(document.hidden){persist();speech.stop();}});",
    "window.addEventListener('pagehide',event=>{persist();speech.stop();if(!event.persisted){clearInterval(saveTimer);speech.dispose();world?.dispose();}});document.addEventListener('visibilitychange',()=>{if(document.hidden){persist();speech.stop();}});")
replace_once('src/explore/main.ts',
    "window.addEventListener('beforeunload',()=>{clearInterval(saveTimer);speech.dispose();world?.dispose();},{once:true});",
    '// Keep the engine alive when the browser places this page in its back-forward cache.')
replace_once('scripts/explore-browser.mjs',
    'await page.waitForTimeout(2200);return page;',
    'await page.waitForTimeout(2200);report.diagnostics.push({tag,initial:await page.evaluate(()=>window.__explore.read())});writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));return page;')
replace_once('scripts/explore-browser.mjs',
    'await page.screenshot({path:`${out}/${name}.png`});',
    'await page.screenshot({path:`${out}/${name}.png`,timeout:60000});')
