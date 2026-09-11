import {readFile,writeFile,mkdir,unlink} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
// Reuse the checked conversation fixture; additional checks apply to actual rendered components.
let source=await readFile('scripts/companion-continuity-phone.mjs','utf8');
const replace=(from,to)=>{assert.equal(source.split(from).length,2,`Unique fixture anchor: ${from.slice(0,90)}`);source=source.replace(from,to);};
replace("const output='artifacts/companion-continuity';", "const output='artifacts/hitokoto-neon';");
replace('[{width:390,height:844},{width:375,height:667}]','[{width:390,height:844},{width:375,height:667},{width:320,height:568},{width:430,height:932},{width:1280,height:900}]');
// IntersectionObserver intentionally removes this cue once the card has been seen.
// If that happens during a click, require that it really disappeared; never ignore a broken present button.
replace('if(await available.count())await available.click();',`if(await available.count()){
   try{await available.click({timeout:1200});}catch(e){if(await available.count())throw e;}
  }`);
replace(" await page.getByRole('button',{name:'聊一会儿'}).click();",` await page.locator('[data-ui-release="neon-20260911"]').waitFor();
 await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Home horizontal overflow');
 assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.kc-root')).backgroundColor),'rgb(6, 9, 20)');
 await page.screenshot({path:output+'/home-'+viewport.width+'.png',fullPage:true});
 await page.getByRole('button',{name:'找个话题',exact:false}).click();
 await page.getByRole('dialog').waitFor();
 assert.equal(await page.locator('.neon-topic-list [data-lane]').count(),5);
 await page.screenshot({path:output+'/topics-'+viewport.width+'.png',fullPage:true});
 await page.getByRole('button',{name:'关闭面板',exact:true}).click();
 await page.getByRole('button',{name:'聊一会儿'}).click();
 if(await page.getByRole('button',{name:'对话与历史',exact:true}).count())await page.getByRole('button',{name:'对话与历史',exact:true}).click();`);
replace(" assert.equal(await page.locator('[data-release=\"repair-20260911\"]').count(),1);",` assert.equal(await page.locator('[data-release="repair-20260911"]').count(),1);
 assert.equal(await page.locator('[data-ui-release="neon-20260911"]').count(),1);
 await page.screenshot({path:output+'/waiting-'+viewport.width+'.png',fullPage:true});`);
replace(" await page.getByRole('button',{name:'开启麦克风',exact:true}).click();",` await page.getByRole('button',{name:'更多',exact:true}).click();
 await page.getByRole('dialog').waitFor();
 const motion=page.getByRole('button',{name:'霓虹动态效果',exact:false});
 await motion.click();
 assert.equal(await page.locator('.kc-root').getAttribute('data-motion'),'reduced');
 assert.equal(await page.evaluate(()=>window.__voice.micRequests),0);
 await page.screenshot({path:output+'/settings-'+viewport.width+'.png',fullPage:true});
 await page.getByRole('button',{name:'关闭面板',exact:true}).click();
 await page.getByRole('button',{name:'用文字聊',exact:true}).click();
 await page.getByRole('textbox',{name:'要说的话'}).fill('今日は家でゆっくりしたいです。');
 await page.screenshot({path:output+'/keyboard-'+viewport.width+'.png',fullPage:true});
 await page.getByRole('button',{name:'关闭面板',exact:true}).click();
 await page.getByRole('button',{name:'字幕已开',exact:true}).click();
 assert.equal(await page.locator('.kc-listen-only').count(),1);
 await page.getByRole('button',{name:'打开字幕',exact:true}).click();
 const mic=page.getByRole('button',{name:'开启麦克风',exact:true});
 const bounds=await mic.boundingBox();assert.ok(bounds&&bounds.y>=0&&bounds.y+bounds.height<=viewport.height,'Mic must be visible without document scrolling');
 const talk=await page.locator('.kc-conversation').boundingBox();assert.ok(talk&&talk.height>=100,'Conversation must retain usable height');
 await mic.click();`);
replace(" await page.screenshot({path:\x60${output}/multi-turn-${viewport.width}.png\x60,fullPage:true});",` await page.screenshot({path:output+'/multi-turn-'+viewport.width+'.png',fullPage:true});
 const dialogBox=await page.locator('.kc-conversation').boundingBox();
 const footerBox=await page.locator('.kc-chat-bottom').boundingBox();
 assert.ok(dialogBox&&footerBox&&dialogBox.y+dialogBox.height<=footerBox.y+1,'Dock must not cover messages');
 assert.ok(footerBox.y+footerBox.height<=viewport.height+1,'Dock must stay inside viewport');`);
replace(" await page.getByRole('button',{name:'结束聊天',exact:true}).click();",` await page.getByRole('button',{name:'结束聊天',exact:true}).click();
 await page.getByRole('button',{name:'回去看看',exact:true}).waitFor();
 await page.screenshot({path:output+'/end-'+viewport.width+'.png',fullPage:true});
 assert.equal(await page.locator('.neon-closed-status').count(),1);`);
replace("scope:'MOCKED_PROVIDER_AND_MEDIA_REAL_UI_NOT_HUMAN_IPHONE'", "scope:'REAL_NEON_UI_MOCKED_VOICE_NOT_HUMAN_IPHONE'");
await mkdir('artifacts/hitokoto-neon',{recursive:true});
const temp='scripts/.hitokoto-neon-phone.mjs';await writeFile(temp,source);
try{const r=spawnSync(process.execPath,[temp],{stdio:'inherit',timeout:240000});assert.equal(r.status,0,'Neon viewport regression failed');}finally{await unlink(temp).catch(()=>{});}
