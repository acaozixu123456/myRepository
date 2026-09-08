import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
// Existing verifier checks exact compiled JS/CSS bytes against the production alias.
await import('./nhk-turn-support-production.mjs');
const html=await readFile('dist/index.html','utf8');const jsPaths=[...html.matchAll(/src="(\/assets\/[^\"]+\.js)"/g)].map(m=>m[1]);
const js=(await Promise.all(jsPaths.map(p=>readFile(`dist${p}`,'utf8')))).join('\n');
for(const marker of ['nhk-gentle-teacher-v1','再简单点','慢一点','REFERENCE is intentionally absent'])assert.ok(js.includes(marker),`Teacher feature missing: ${marker}`);
const base='https://nihongo-discovery-v2-20260831.vercel.app';
const invalid=await fetch(`${base}/api/nhk-speech`,{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({action:'tts',text:''}),signal:AbortSignal.timeout(12000)});
assert.equal(invalid.status,400);assert.equal((await invalid.json()).reason,'invalid_text');
await mkdir('artifacts/teacher-production',{recursive:true});await writeFile('artifacts/teacher-production/markers.json',JSON.stringify({ok:true,sourceCommit:process.env.GITHUB_SHA,markers:true,legacyTtsValidation:true},null,2));
