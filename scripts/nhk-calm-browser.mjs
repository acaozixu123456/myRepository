import {chromium, webkit} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const output = '/tmp/nhk-artifacts'; mkdirSync(output, {recursive: true});
execFileSync('node_modules/.bin/esbuild', ['scripts/nhk-calm-fixture.ts','--bundle','--platform=node','--outfile=/tmp/nhk-calm-fixture.cjs']);
execFileSync('node', ['/tmp/nhk-calm-fixture.cjs']);
const fixture = JSON.parse(readFileSync('/tmp/nhk-calm-fixture.json','utf8'));
const base = process.env.NHK_TEST_BASE || 'http://127.0.0.1:5173';
for (let i=0; i<30; i++) {try {if ((await fetch(base)).ok) break;} catch {} await new Promise(r => setTimeout(r,1000));}
const report = {syntheticData: true, realAIRequests: 0, results: [], audits: [], errors: []};
const keys = {articles:'nihongo-nhk-article-library-v1', knowledge:'nihongo-nhk-knowledge-library-v1', gentle:'nihongo-nhk-gentle-progress-v1', sessions:'nihongo-nhk-morning-v2'};
const result = (name, detail='') => {report.results.push({name, result:'PASS', detail}); console.log('PASS',name);};
async function audit(page, name) {
  const width = await page.evaluate(() => ({body:document.documentElement.scrollWidth,viewport:innerWidth}));
  assert(width.body <= width.viewport+1, `${name}: horizontal overflow ${JSON.stringify(width)}`);
  const targets = await page.locator('button:visible, input:visible, summary:visible').evaluateAll(elements => elements.filter(e => !e.disabled).map(e => ({name:e.textContent?.slice(0,40)||e.getAttribute('aria-label'),...(() => {const r=e.getBoundingClientRect(); return {width:r.width,height:r.height};})()})).filter(e => e.width<43.8 || e.height<43.8));
  assert.deepEqual(targets, [], `${name}: targets smaller than 44px`);
  const axe = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  report.audits.push({name, violations:axe.violations.map(v => ({id:v.id, impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))});
  assert.equal(axe.violations.filter(v => ['critical','serious'].includes(v.impact)).length, 0, `${name}: serious axe violations ${JSON.stringify(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})))}`);
  await page.screenshot({path:`${output}/${name}.png`, fullPage:true});
}
async function setFixture(page) {
  await page.evaluate(({fixture,keys}) => {
    localStorage.clear(); localStorage.setItem(keys.articles,JSON.stringify([fixture.article])); localStorage.setItem(keys.knowledge,JSON.stringify(fixture.knowledge)); localStorage.setItem('nihongo-practice-mode-v1','quiet');
  },{fixture,keys});
  await page.reload(); await page.getByRole('button',{name:'继续这一句',exact:true}).waitFor();
}
try {
 for (const config of [{engine:'chromium',width:390},{engine:'chromium',width:1280},{engine:'webkit',width:390},{engine:'chromium',width:320}]) {
  const browser = await ({chromium,webkit})[config.engine].launch();
  const context = await browser.newContext({viewport:{width:config.width,height:844}, timezoneId:'Asia/Tokyo',locale:'zh-CN',serviceWorkers:'block',reducedMotion:'reduce'});
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let parseFails=false, coachFails=false;
  await page.route('**/api/**',async route => {
    const url=new URL(route.request().url());
    if(url.pathname==='/api/moji-article') return route.fulfill({json:parseFails ? {ok:false,reason:'test-parse-failure'} : {ok:true,title:fixture.title,sentences:fixture.sentences,sourceUrl:fixture.article.sourceUrl}});
    if(url.pathname==='/api/nhk-coach') return route.fulfill({json:coachFails ? {ok:false,reason:'test-coach-failure'} : {ok:true,coach:fixture.coach,model:'test-fixture-not-ai'}});
    if(url.pathname==='/api/nhk-speech') return route.fulfill({json:{ok:false,reason:'test-audio-unavailable'}});
    throw new Error(`Unexpected API request ${url.pathname}`);
  });
  await page.clock.setFixedTime(new Date('2026-09-05T12:00:00+09:00'));
  await page.goto(base); await page.getByRole('button',{name:'导入第一篇',exact:true}).waitFor();
  const prefix=`${config.engine}-${config.width}`;
  await audit(page,`${prefix}-empty`);
  await setFixture(page); await audit(page,`${prefix}-home`);
  await page.getByRole('button',{name:'继续这一句',exact:true}).click();
  await page.getByRole('heading',{name:'一句精读',exact:true}).waitFor();
  assert.equal(await page.locator('.calm-explanation-folds details[open]').count(),0);
  await audit(page,`${prefix}-read`);
  await page.getByText('语法，拆开看看',{exact:true}).click();
  await page.locator('.nhk-point-card').first().waitFor();
  await audit(page,`${prefix}-grammar`);
  await page.getByRole('button',{name:'合上提示，想一想',exact:true}).click();
  await page.getByRole('heading',{name:'这句话，你会怎么说？',exact:true}).waitFor();
  assert(!(await page.locator('body').textContent()).includes(fixture.sentences[0]),'Original Japanese must be unmounted, not CSS hidden');
  await page.getByRole('button',{name:'看看原句',exact:true}).click();
  await page.getByRole('button',{name:'想起来了',exact:true}).click();
  await page.getByRole('heading',{name:'今天的小练习，完成了。',exact:true}).waitFor();
  await audit(page,`${prefix}-finish`);
  let persisted=await page.evaluate(keys=>({progress:JSON.parse(localStorage.getItem(keys.gentle)),articles:JSON.parse(localStorage.getItem(keys.articles))}),keys);
  assert.equal(persisted.progress.articles[fixture.article.id].checked.length,1);
  assert.equal(persisted.articles[0].completedAt,undefined,'micro practice must not claim whole article completion');
  await page.getByRole('button',{name:'今天到这里',exact:true}).click();
  await page.clock.setFixedTime(new Date('2026-09-06T12:00:00+09:00')); await page.reload();
  await page.getByRole('button',{name:'继续这一句',exact:true}).click();
  assert.equal((await page.locator('.nhk-deep-analysis-card > h2').textContent())?.trim(),fixture.sentences[0]);
  result(`${prefix}: cross-day resume and honest micro completion`);
  await page.getByRole('button',{name:'返回今日',exact:true}).click();
  await page.getByRole('button',{name:'复习',exact:true}).click();
  assert.equal(await page.locator('[data-testid="review-answer"]').count(),0);
  assert(await page.getByRole('button',{name:'想起来了',exact:true}).isDisabled());
  assert(!(await page.locator('body').innerText()).includes(fixture.knowledge[0].meaningZh));
  await audit(page,`${prefix}-review`);
  for(let i=0;i<3;i++) {await page.getByRole('button',{name:'揭晓解释',exact:true}).click(); await page.getByRole('button',{name:'想起来了',exact:true}).click();}
  await page.getByRole('heading',{name:'这一小组，回想完了。',exact:true}).waitFor();
  const knowledge=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),keys.knowledge);
  assert.equal(knowledge.length,5);assert.equal(knowledge.reduce((a,b)=>a+b.reviewCount,0),3);assert.equal(knowledge.filter(k=>k.reviewCount===0).length,2);
  result(`${prefix}: hidden answers, reveal gate, bounded review, backlog preserved`);
  await page.getByRole('button',{name:'全部收藏 · 5',exact:true}).click();
  await audit(page,`${prefix}-bookmarks`);
  await page.getByRole('button',{name:'文章',exact:true}).click();await audit(page,`${prefix}-archive`);
  await page.getByRole('button',{name:'导入文章',exact:true}).click();
  await page.getByRole('textbox',{name:'MOJi文章链接',exact:true}).fill(fixture.article.sourceUrl);
  await page.getByRole('button',{name:'解析',exact:true}).click();
  await page.getByRole('button',{name:'就从这一句开始',exact:true}).waitFor();
  await page.waitForFunction(() => !document.body.innerText.includes('AI 正在补全'));
  assert.equal(await page.locator('.nhk-sentence-list button.selected').count(),1);
  assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).length,keys.articles),1,'reimport must not duplicate archived article');
  await audit(page,`${prefix}-import`);
  await page.getByRole('button',{name:'就从这一句开始',exact:true}).click();
  await page.getByText('听一听这句话',{exact:true}).click();
  await page.getByRole('button',{name:'播放整句',exact:true}).click();
  await page.locator('.nhk-speech-error').waitFor();
  await page.getByRole('button',{name:'合上提示，想一想',exact:true}).click();await page.getByRole('button',{name:'看看原句',exact:true}).click();await page.getByRole('button',{name:'还有点模糊',exact:true}).click();
  await page.getByRole('button',{name:'试着说一说',exact:true}).click();
  await page.getByRole('button',{name:/静音学习/}).click();
  await page.locator('.nhk-quiet-response textarea').fill('図書館は、来月から夜も利用できるようになります。');
  await audit(page,`${prefix}-output`);
  assert(!(await page.getByRole('button',{name:'保存这次表达',exact:true}).isDisabled()),'opinion and microphone must not block quiet output');
  result(`${prefix}: import, one default sentence, audio failure and optional quiet output`);
  if(config.engine==='chromium' && config.width===390) {
    await page.getByRole('button',{name:'返回首页',exact:true}).click();
    await page.getByRole('button',{name:'导入新文章',exact:true}).click();parseFails=true;
    await page.getByRole('textbox',{name:'MOJi文章链接',exact:true}).fill('https://www.mojidict.com/article/test-error');await page.getByRole('button',{name:'解析',exact:true}).click();await page.locator('.nhk-parse-error').waitFor();
    assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).length,keys.articles),1);parseFails=false;coachFails=true;
    await page.getByRole('button',{name:'解析',exact:true}).click();await page.getByRole('button',{name:'就从这一句开始',exact:true}).click();
    await page.getByRole('button',{name:'重试精讲',exact:true}).waitFor();coachFails=false;await page.getByRole('button',{name:'重试精讲',exact:true}).click();
    await page.waitForFunction(()=>!document.querySelector('.calm-coach-status'));
    result('Parse failure preserves archive; fallback is explicit and retry recovers');
    await page.getByRole('button',{name:'返回今日',exact:true}).click();
    const download=page.waitForEvent('download');await page.getByRole('button',{name:'导出备份',exact:true}).click();
    const file=await download;await file.saveAs(`${output}/test-only-backup.json`);const backup=JSON.parse(readFileSync(`${output}/test-only-backup.json`,'utf8'));assert(backup.gentleProgress && backup.articles && backup.knowledge && backup.sessions);
    result('Backup includes original articles, bookmarks, sessions and new progress');
    await context.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('quota','QuotaExceededError');};});
    await page.reload();await page.getByRole('alert').waitFor();assert(await page.getByRole('button',{name:'导出备份',exact:true}).isVisible());
    result('Storage quota failure is visible; app stays usable');
  }
  assert.deepEqual(errors,[],`${prefix}: page runtime errors`);
  await browser.close();
 }
 report.status='PASS';
} catch(error) {report.status='FAIL';report.errors.push(error.stack || String(error));console.error(error);process.exit(1);}
finally {writeFileSync(`${output}/browser-results.json`,JSON.stringify(report,null,2));}
