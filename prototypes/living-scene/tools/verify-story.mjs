import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { places, opening } from '../src/story.js';
import { recordBrowser } from './record-browser.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const out = path.join(root, 'docs/living-scene/v3/evidence');
await fs.mkdir(out, {recursive:true});
// Branch integrity and re-entry, independent of the display implementation.
for (const place of places) {
  const seen = new Set();
  const visit = (id, stack = []) => {
    assert(place.nodes[id], `Missing ${place.id}/${id}`);
    assert(!stack.includes(id), `Unbounded story loop ${place.id}/${id}`);
    seen.add(id);
    const node = place.nodes[id];
    assert(node.ja && node.zh && node.note);
    for (const next of [node.next, ...(node.choices || []).map(c => c.next)].filter(Boolean)) visit(next, [...stack,id]);
  };
  visit(place.start);
  if (place.id === 'shop') visit('return');
  assert.equal(seen.size,Object.keys(place.nodes).length, `Unreachable lines in ${place.id}`);
}
assert.equal(opening(places[0], new Set()), 'greeting');
assert.equal(opening(places[0], new Set(['shop'])), 'greeting');
assert.equal(opening(places[0], new Set(['shop','reflection'])), 'return');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/Users/xiaruonan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser = await chromium.launch({executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:false,args:['--use-angle=metal']});
const p = await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
const errors=[], checks={branchGraph:true}, visited=[];
p.on('pageerror', e=>errors.push(String(e)));
p.on('console', m=>{if(m.type()==='error') errors.push(m.text());});
p.on('response', r=>{if(r.status()>=400) errors.push(`${r.status()} ${r.url()}`);});
const snap=()=>p.evaluate(()=>window.__livingScene.snapshot().story);
const screenshot=name=>p.screenshot({path:path.join(out,`${name}.png`)});
try {
  await p.goto(process.env.SCENE_URL || 'http://127.0.0.1:8772/');
  await p.waitForFunction(()=>window.__livingScene?.ready);
  await p.waitForTimeout(6200);
  checks.source3039=await p.evaluate(()=>document.querySelector('.still').naturalWidth===3039);
  checks.cleanFrame=await p.evaluate(()=>getComputedStyle(document.querySelector('header')).opacity==='0' && document.querySelector('#subtitle').hidden);
  await screenshot('hero-clean');
  await p.locator('#hotspot-shop').click();
  await p.waitForTimeout(1400);
  await screenshot('story-opening');
  checks.explanationOptIn=await p.locator('#explanation').isHidden();
  await p.locator('#explain').click();
  checks.explanationWorks=await p.locator('#explanation').isVisible();
  await screenshot('story-explanation');
  await p.keyboard.press('Escape');
  checks.cancelDoesNotComplete=(await snap()).completed.length===0;
  checks.escapeReturnsFocus=await p.evaluate(()=>document.activeElement.id==='hotspot-shop' && document.querySelector('#subtitle').hidden);
  // Traverse both choices of the initial encounters through real controls; test return entry last.
  for (const place of places) {
    for (const branch of [0,1]) {
      await p.locator(`#hotspot-${place.id}`).click();
      for (let steps=0; steps<20; steps++) {
        const state=await snap(); visited.push(`${place.id}/${state.node}`);
        const node=place.nodes[state.node];
        if (node.next) await p.locator('#next').click();
        else if (node.choices) await p.locator('#choices button').nth(Math.min(branch,node.choices.length-1)).click();
        else break;
      }
      checks[`${place.id}Completes`]=(await snap()).completed.includes(place.id);
      await p.locator('#back').click();
    }
  }
  await p.locator('#hotspot-shop').click();
  checks.ownerRemembers=(await snap()).node==='return';
  await p.waitForTimeout(1000); await screenshot('owner-return');
  for (let i=0;i<4;i++) {
    if(await p.locator('#choices button').count()) await p.locator('#choices button').first().click();
    else if(await p.locator('#next').isVisible()) await p.locator('#next').click();
  }
  checks.farewell=(await snap()).node==='farewell';
  await screenshot('farewell');
  await p.keyboard.press('Escape');
  await p.mouse.move(900,1070); await p.locator('#places-toggle').click();
  checks.menu=await p.locator('#places-nav').isVisible();
  await screenshot('walk-menu');
  await p.locator('#places-nav button').nth(3).click();
  checks.menuOpensObject=(await snap()).active==='maple';
  await p.keyboard.press('Escape');
  await p.mouse.move(1800,1070); await p.locator('#pause').click();
  const t=await p.evaluate(()=>window.__livingScene.snapshot().time);
  await p.waitForTimeout(350);
  checks.pause=await p.evaluate(t=>window.__livingScene.snapshot().time===t,t);
  await p.locator('#pause').click();
  await p.emulateMedia({reducedMotion:'reduce'});
  await p.waitForFunction(()=>window.__livingScene.snapshot().paused);
  checks.reducedMotion=true;
  await p.setViewportSize({width:390,height:844});
  await p.mouse.move(350,825); await p.locator('#places-toggle').click();
  await p.locator('#places-nav button').first().click(); await p.locator('#explain').click();
  checks.smallScreenNoHorizontalOverflow=await p.evaluate(()=>document.documentElement.scrollWidth===innerWidth);
  await screenshot('mobile-explanation');
  await p.keyboard.press('Escape');
  await p.emulateMedia({reducedMotion:'no-preference'});
  const capture = await recordBrowser(p, process.env.CAPTURE_DIR || '/Users/xiaruonan/nihongo-art-work/toolchain/living-scene-v3-capture', async page=>{
    await page.waitForTimeout(4000);
    for (const id of ['shop','reflection','maple','lantern','alley']) {
      await page.locator(`#hotspot-${id}`).hover(); await page.waitForTimeout(650);
      await page.locator(`#hotspot-${id}`).click(); await page.waitForTimeout(2500);
      if(id==='shop') {
        await page.locator('#choices button').last().click(); await page.waitForTimeout(1700);
        await page.locator('#explain').click(); await page.waitForTimeout(2200);
      }
      await page.keyboard.press('Escape'); await page.waitForTimeout(1400);
    }
  });
  const report={date:new Date().toISOString(),browser:browser.version(),hardware:await p.evaluate(()=>window.__livingScene.hardware),checks,errors,visited:[...new Set(visited)],capture,performance:'No performance benchmark run. This pass checks loading, interaction and visual evidence only.'};
  await fs.writeFile(path.join(out,'verification.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  assert.equal(errors.length,0); assert(Object.values(checks).every(Boolean));
} finally { await browser.close(); }
