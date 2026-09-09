import {readFile,writeFile,unlink} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
let source=await readFile('scripts/companion-live.mjs','utf8');
const replace=(a,b)=>{assert.equal(source.split(a).length,2,`Unique quality anchor required: ${a.slice(0,80)}`);source=source.replace(a,b);};
replace("['猫の動画は好きですが、猫は飼っていません。','犬ではなくて、猫の動画の話です。','寝る前に、よく猫の動画を見ます。','はい、寝ている猫を見ると、気持ちが落ち着きます。','でも、明日は早いので、今日は少しだけにします。']","['猫。','寝ている猫。','寝る前。','寝る前に、猫の動画を見ます。','猫は飼っていません。']");
replace('await page.waitForTimeout(95000);','await page.waitForTimeout(1000);');
replace('assert.ok(report.heartbeats>=3);','assert.ok(report.heartbeats>=1);');
replace('reason:news.data.reason,topics:','reason:news.data.reason,provider:news.data.provider,topics:');
replace("same native peer survives monitor heartbeat/handoff; mute remains closed; prior contrast queried","single native peer and explicit mute preserved during short beginner-quality probe; prior contrast queried");
replace("scope:'REAL_OPENAI_NATIVE_CONVERSATION_SYNTHETIC_JAPANESE_AND_TYPED_HELP_NOT_HUMAN_PHONE'","scope:'REAL_NATIVE_BEGINNER_WORD_TO_PHRASE_AND_DIRECT_TEACHER_HELP_NOT_HUMAN_PHONE'");
replace("await page.evaluate(()=>window.__companion.end());",`
 report.extraHelp=[];
 const requestHelp=async(label)=>{const n=await count();await page.evaluate(()=>window.__companion.action('help'));const answer=await wait(n);report.extraHelp.push({label,assistant:answer});assert.equal(await page.evaluate(()=>window.__micRequests),1);return answer;};
 await typed('我想表达：原因还在调查，明天下午给你答复。请只给一个简单日语说法。');
 await requestHelp('work-update');
 await typed('刚才说下午不对，我改成明天上午。日语怎么改？');
 await requestHelp('work-correction-morning');
 await typed('换个生活话题。我早上喝咖啡，但是晚上不喝。请用简单日语接着聊。');
 await requestHelp('coffee-not-at-night');
 report.checks.push('Help reviewed in three additional contexts without reconnecting or opening microphone');
 await page.evaluate(()=>window.__companion.end());
`);
const temp='scripts/.companion-quality-probe.mjs';await writeFile(temp,source);
try{const result=spawnSync(process.execPath,[temp],{stdio:'inherit',timeout:510000});assert.equal(result.status,0,'Native beginner probe failed');const report=JSON.parse(await readFile('artifacts/companion-live/result.json','utf8'));
 const checks={helpProvidesJapanese:/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(report.help),beginnerRepliesBounded:report.turns.slice(0,5).every(t=>t.assistant.length<=120),noUnrequestedRephrasing:!/(?:とても自然|そのままで通じ|柔らかく言うなら|より自然に|もっと自然に)/u.test(report.turns[3].assistant),howToSayGivesJapanese:!!report.turns.find(t=>t.user.includes('本来只是'))?.assistant.match(/[\p{Script=Hiragana}\p{Script=Katakana}]/u),additionalHelpIsJapanese:report.extraHelp.length===3&&report.extraHelp.every(t=>/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(t.assistant)),noCatTemplateLeak:report.extraHelp.every(t=>!/猫|ねこ|ネコ/u.test(t.assistant)),correctionKeepsMorning:/(?:午前|ごぜん|朝|あさ)/u.test(report.extraHelp.find(t=>t.label==='work-correction-morning')?.assistant||'')};
 report.qualityAutomaticChecks=checks;report.semanticReview='PENDING_SUPERVISOR_REVIEW_NOT_INFERRED_FROM_CHECKS';await writeFile('artifacts/companion-live/beginner-quality.json',JSON.stringify(report,null,2));assert.ok(Object.values(checks).every(Boolean),'Mechanical quality regression; keep actual failed reply for review');
}finally{await unlink(temp).catch(()=>{});}
