import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {chromium,webkit} from 'playwright';
const out=process.env.NHK_EVIDENCE_DIR || '/tmp/nhk-artifacts';mkdirSync(out,{recursive:true});
execFileSync('node_modules/.bin/esbuild',['scripts/nhk-calm-fixture.ts','--bundle','--platform=node','--format=cjs',`--outfile=${out}/fixture.cjs`]);
execFileSync('node',[`${out}/fixture.cjs`],{env:{...process.env,FIXTURE_OUT:`${out}/reliable-fixture.json`}});
const fixture=JSON.parse(readFileSync(`${out}/reliable-fixture.json`,'utf8'));
const base=process.env.NHK_BASE_URL || 'http://127.0.0.1:5173';
const keys={articles:'nihongo-nhk-article-library-v1',knowledge:'nihongo-nhk-knowledge-library-v1',history:'nihongo-nhk-practice-history-v1',sessions:'nihongo-nhk-morning-v2'};
const report={status:'RUNNING',cases:[],errors:[]};const browsers=[];
const pass=name=>{report.cases.push(name);console.log(`PASS ${name}`);};
try {
 for(const engine of (process.env.NHK_ENGINES || 'chromium,webkit').split(',')) {
  const browser=await ({chromium,webkit})[engine].launch(engine==='chromium' && process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});browsers.push(browser);
  const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Tokyo',serviceWorkers:'block',acceptDownloads:true});
  const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let sentenceCalls=0;let wrongSentence=false;
  const routing=async route=>{
    const pathname=new URL(route.request().url()).pathname;
    if(pathname==='/api/nhk-sentence') {
      sentenceCalls++;const input=route.request().postDataJSON();
      const recommendation={...fixture.coach.recommendations[0],sentence:wrongSentence ? '別の文です。' : input.sentence,sentenceIndex:input.sentenceIndex,chunks:[input.sentence]};
      return route.fulfill({json:{ok:true,analysis:{version:1,model:'synthetic-test',generatedAt:Date.now(),recommendation}}});
    }
    if(pathname==='/api/nhk-coach')return route.fulfill({json:{ok:true,coach:fixture.coach,model:'test-fixture-not-ai'}});
    if(pathname==='/api/moji-article') {
      const url=route.request().postDataJSON().url;
      return route.fulfill({json:{ok:true,title:url.endsWith('/second') ? '二つ目の図書館のニュース' : fixture.title,sentences:fixture.sentences,sourceUrl:url}});
    }
    if(pathname==='/api/nhk-speech')return route.fulfill({json:{ok:false,reason:'test-audio-unavailable'}});
    throw new Error(`Unexpected route ${pathname}`);
  };
  await context.route('**/api/**',routing);
  await page.goto(base);await page.getByRole('button',{name:'导入第一篇',exact:true}).waitFor();
  await page.evaluate(({fixture,keys})=>{
    localStorage.setItem(keys.articles,JSON.stringify([fixture.article]));localStorage.setItem(keys.knowledge,JSON.stringify(fixture.knowledge));localStorage.setItem('nihongo-practice-mode-v1','quiet');
  },{fixture,keys});
  await page.reload();await page.getByRole('button',{name:'继续这一句',exact:true}).click();
  await page.getByRole('button',{name:'合上提示，想一想',exact:true}).click();
  await page.getByRole('textbox').fill('这是我第一次写的回想答案。');
  await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).attempts[0]?.answer==='这是我第一次写的回想答案。',keys.history);
  await page.reload();await page.getByRole('button',{name:'继续这一句',exact:true}).click();await page.getByRole('button',{name:'合上提示，想一想',exact:true}).click();
  assert.equal(await page.getByRole('textbox').inputValue(),'这是我第一次写的回想答案。');
  await page.getByRole('button',{name:'看看原句',exact:true}).click();await page.getByRole('button',{name:'想起来了',exact:true}).click();
  await page.getByRole('button',{name:'试着说一说',exact:true}).click();await page.locator('.nhk-quiet-response textarea').fill('一篇目の回答です。');await page.getByRole('button',{name:'保存这次表达',exact:true}).click();
  await page.getByRole('button',{name:'导入新文章',exact:true}).click();await page.getByRole('textbox',{name:'MOJi文章链接'}).fill('https://www.mojidict.com/article/second');await page.getByRole('button',{name:'解析',exact:true}).click();
  await page.waitForFunction(()=>!document.body.innerText.includes('AI 正在补全'));await page.getByRole('button',{name:'就从这一句开始',exact:true}).click();
  await page.getByRole('button',{name:'合上提示，想一想',exact:true}).click();await page.getByRole('button',{name:'看看原句',exact:true}).click();await page.getByRole('button',{name:'想起来了',exact:true}).click();await page.getByRole('button',{name:'试着说一说',exact:true}).click();await page.locator('.nhk-quiet-response textarea').fill('二篇目の回答です。');await page.getByRole('button',{name:'保存这次表达',exact:true}).click();
  const saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),keys.sessions);
  assert(saved.some(s=>s.recapText==='一篇目の回答です。'));assert(saved.some(s=>s.recapText==='二篇目の回答です。'));
  pass(`${engine}: draft survives reload; two same-day articles keep independent submitted answers`);
  const file=page.waitForEvent('download');await page.getByRole('button',{name:'导出备份',exact:true}).click();await (await file).saveAs(`${out}/${engine}-backup.json`);
  const data=JSON.parse(readFileSync(`${out}/${engine}-backup.json`));assert.equal(data.schemaVersion,2);assert(data.history.attempts[0].answer);
  const clean=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Tokyo',serviceWorkers:'block',acceptDownloads:true});await clean.route('**/api/**',routing);
  const restore=await clean.newPage();restore.setDefaultTimeout(15000);await restore.goto(base);await restore.getByText('备份与恢复',{exact:true}).click();
  await restore.getByLabel('选择学习备份').setInputFiles(`${out}/${engine}-backup.json`);
  await restore.getByRole('region',{name:'恢复预览'}).waitFor();
  const beforeRestore=restore.waitForEvent('download');await restore.getByRole('button',{name:'合并恢复（保留现有）',exact:true}).click();await beforeRestore;
  await restore.getByText('合并恢复成功，现有文章和回答已保留。',{exact:true}).waitFor();
  let recovered=await restore.evaluate(keys=>({articles:JSON.parse(localStorage.getItem(keys.articles)),sessions:JSON.parse(localStorage.getItem(keys.sessions)),history:JSON.parse(localStorage.getItem(keys.history))}),keys);
  assert.equal(recovered.articles.length,2);assert.equal(recovered.history.attempts.length,2);assert(recovered.sessions.some(s=>s.recapText==='一篇目の回答です。'));
  await restore.getByLabel('选择学习备份').setInputFiles(`${out}/${engine}-backup.json`);await restore.getByRole('button',{name:'合并恢复（保留现有）',exact:true}).click();
  await restore.getByText('合并恢复成功，现有文章和回答已保留。',{exact:true}).waitFor();
  assert.equal(await restore.evaluate(k=>JSON.parse(localStorage.getItem(k)).length,keys.sessions),recovered.sessions.length);
  await restore.screenshot({path:`${out}/${engine}-restore.png`,fullPage:true});
  await restore.getByLabel('选择学习备份').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"schemaVersion":99}')});await restore.getByRole('alert').waitFor();
  assert.equal(await restore.evaluate(k=>JSON.parse(localStorage.getItem(k)).length,keys.articles),2);
  pass(`${engine}: fresh-browser restore, idempotent reimport and invalid backup preserves existing data`);
  const extended={...fixture.article,sentences:[...fixture.sentences,...Array.from({length:20},(_,i)=>`第${i+4}の取り組みについて説明します。`)]};
  extended.sentences[19]='図書館を利用することができなくなるわけではありません。';
  await page.evaluate(({keys,extended})=>localStorage.setItem(keys.articles,JSON.stringify([extended])),{keys,extended});await page.reload();
  await page.getByRole('button',{name:'文章',exact:true}).click();await page.locator('.nhk-article-list > button').first().click();
  await page.getByText('查看完整正文句子',{exact:true}).click();await page.getByRole('button',{name:'精读第 20 句',exact:true}).click();
  assert.equal(await page.locator('.nhk-deep-analysis-card > h2').innerText(),extended.sentences[19]);
  wrongSentence=true;await page.getByRole('button',{name:'生成这句精讲',exact:true}).click();await page.getByRole('alert').waitFor();
  assert.equal((await page.evaluate(k=>JSON.parse(localStorage.getItem(k))[0].sentenceAnalyses?.length || 0,keys.articles)),0);
  wrongSentence=false;await page.getByRole('button',{name:'生成这句精讲',exact:true}).click();await page.getByRole('button',{name:'重新讲解这句',exact:true}).waitFor();
  assert.equal(await page.locator('.nhk-deep-analysis-card > h2').innerText(),extended.sentences[19]);
  const callCount=sentenceCalls;await page.reload();await page.getByRole('button',{name:'继续这一句',exact:true}).click();await page.getByRole('button',{name:'重新讲解这句',exact:true}).waitFor();assert.equal(sentenceCalls,callCount);
  await page.screenshot({path:`${out}/${engine}-sentence20.png`,fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1),false);assert.deepEqual(errors,[]);
  pass(`${engine}: sentence 20 binds exactly, rejects mismatched output and reuses saved explanation after reload`);
  await browser.close();
 }
 report.status='PASS';
} catch(error) {report.status='FAIL';report.errors.push(error.stack||String(error));console.error(error);process.exitCode=1;}
finally {await Promise.allSettled(browsers.map(b=>b.close()));writeFileSync(`${out}/reliability-browser.json`,JSON.stringify(report,null,2));}
