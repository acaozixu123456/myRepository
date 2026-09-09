import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
// Integration is now committed. CI verifies exact files; it no longer edits runtime source.
const checks=[['vite.config.ts',"companion: 'companion.html'"],['api/nhk-speech.ts',"body.action.startsWith('companion_')"],['src/companion/connection.ts',"replace(/-/g,'').slice(0,24)"],['src/companion/CompanionApp.tsx','topicBusy=useRef(false)'],['src/companion/model.ts',"nativeCompanionPrompt"]];
for(const [path,anchor] of checks)assert.ok(readFileSync(path,'utf8').includes(anchor),`Reviewed integration missing in ${path}`);
for(const name of ['model.ts','prompt.ts'])assert.equal(readFileSync(`src/companion/${name}`,'utf8'),readFileSync(`supabase/functions/nihongo-companion/${name}`,'utf8'));
console.log('Committed native companion integration and shared policies match. No runtime source mutations.');
