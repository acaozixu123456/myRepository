import {readFileSync} from 'node:fs';
// Integration is committed. Do not replay historical one-shot patches over reviewed fixes.
for(const [path,marker] of [
 ['src/NhkSpeakingCoach.tsx','NhkChatConnection'],
 ['src/nhkChat.ts','nhk-chat-v2'],
 ['server/nhkSpeakingProxy.ts','proxySpeakingPlan'],
 ['supabase/functions/nihongo-speaking-session/index.ts','validateChatPlan'],
]){if(!readFileSync(path,'utf8').includes(marker))throw new Error(`Missing committed chat integration: ${path}`);}
console.log('Committed chat integration validated without rewriting runtime files.');
