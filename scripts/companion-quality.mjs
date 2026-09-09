import {readFile,writeFile,unlink} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
let source=await readFile('scripts/companion-live.mjs','utf8');
const replace=(a,b)=>{assert.equal(source.split(a).length,2,`Unique quality anchor required: ${a.slice(0,80)}`);source=source.replace(a,b);};
replace("['猫の動画は好きですが、猫は飼っていません。','犬ではなくて、猫の動画の話です。','寝る前に、よく猫の動画を見ます。','はい、寝ている猫を見ると、気持ちが落ち着きます。','でも、明日は早いので、今日は少しだけにします。']","['猫。','寝ている猫。','寝る前。','寝る前に、猫の動画を見ます。','猫は飼っていません。']");
replace('await page.waitForTimeout(95000);','await page.waitForTimeout(1000);');
replace('assert.ok(report.heartbeats>=3);','assert.ok(report.heartbeats>=1);');
replace("same native peer survives monitor heartbeat/handoff; mute remains closed; prior contrast queried","single native peer and explicit mute preserved during short beginner-quality probe; prior contrast queried");
replace("scope:'REAL_OPENAI_NATIVE_CONVERSATION_SYNTHETIC_JAPANESE_AND_TYPED_HELP_NOT_HUMAN_PHONE'","scope:'REAL_NATIVE_BEGINNER_WORD_TO_PHRASE_AND_DIRECT_TEACHER_HELP_NOT_HUMAN_PHONE'");
const temp='scripts/.companion-quality-probe.mjs';await writeFile(temp,source);
try{const result=spawnSync(process.execPath,[temp],{stdio:'inherit',timeout:440000});assert.equal(result.status,0,'Native beginner probe failed');const report=JSON.parse(await readFile('artifacts/companion-live/result.json','utf8'));
 assert.ok(/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(report.help),'Help must provide usable Japanese, not only an offer');
 assert.ok(report.turns.slice(0,3).every(t=>t.assistant.length<=120),'Beginner replies must not become multi-paragraph lectures');
 assert.ok(report.turns.find(t=>t.user.includes('本来只是'))?.assistant.match(/[\p{Script=Hiragana}\p{Script=Katakana}]/u),'How-to-say question must receive a Japanese phrase');
 report.qualityAutomaticChecks='PASS_STRUCTURE_ONLY_SUPERVISOR_MUST_REVIEW_MEANING';await writeFile('artifacts/companion-live/beginner-quality.json',JSON.stringify(report,null,2));
}finally{await unlink(temp).catch(()=>{});}
