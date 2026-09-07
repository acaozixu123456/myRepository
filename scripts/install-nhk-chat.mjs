import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const patch=(path,edits)=>{let s=readFileSync(path,'utf8');for(const [from,to]of edits){if(s.includes(to))continue;if(s.split(from).length!==2)throw new Error(`Nonunique integration anchor in ${path}: ${from.slice(0,80)}`);s=s.replace(from,to);}writeFileSync(path,s);};
patch('src/nhkChat.ts',[["from './nhkSpeaking';","from './nhkSpeaking.ts';"]]);
patch('src/NhkSpeakingCoach.tsx',[["import './nhkSpeaking.css';","import './nhkSpeaking.css';\nimport './nhkChat.css';"]]);
patch('server/nhkSpeakingProxy.ts',[["import {SPEAKING_CONSENT,validateSpeakingPlan} from '../src/nhkSpeaking.js';","import {SPEAKING_CONSENT,validateSpeakingPlan} from '../src/nhkSpeaking.js';\nimport {validateChatPlan} from '../src/nhkChat.js';"],["const plan=validateSpeakingPlan(body.plan),sdp=", "const plan=(body.plan as any)?.chatMode===true?validateChatPlan(body.plan):validateSpeakingPlan(body.plan);const sdp="]]);
const edge='supabase/functions/nihongo-speaking-session';
mkdirSync(edge,{recursive:true});
writeFileSync(`${edge}/nhkChat.ts`,readFileSync('src/nhkChat.ts','utf8'));
writeFileSync(`${edge}/nhkSpeaking.ts`,readFileSync('src/nhkSpeaking.ts','utf8'));
patch(`${edge}/index.ts`,[
 ["import WebSocket from 'npm:ws@8.18.0';","import WebSocket from 'npm:ws@8.18.0';\nimport {CHAT_CONTRACT,chatInstructions,validateChatPlan} from './nhkChat.ts';"],
 ["++replies>12","++replies>32"],
 ["maxResponses:12,globalStartsPerDay:30","maxResponses:32,globalStartsPerDay:120,chatContract:CHAT_CONTRACT,topicShuffleReconnects:false"],
 ["const plan=validateSpeakingPlan(body.plan);","const plan=validateSpeakingPlan(body.plan);\n    const chat=body.plan?.chatMode===true?validateChatPlan(body.plan):null;\n    if(body.plan?.chatMode===true&&!chat)return json({ok:false,reason:'invalid_chat_topic'},400);"],
 ["if(!await quota('speaking-global',30,1440)||!await quota(`speaking-client:${body.clientKey}`,8,60)||!await quota(`speaking-concurrent:${body.clientKey}`,2,2))return json({ok:false,reason:'speaking_quota'},429);", "// Guard anomalous connection creation, not ordinary conversation or local topic browsing.\n    if(!await quota(`speaking-burst-v2:${body.clientKey}`,12,1))return json({ok:false,reason:'app_burst_limited',retryAfterSeconds:60},429);\n    if(!await quota(`speaking-hour-v2:${body.clientKey}`,60,60))return json({ok:false,reason:'app_hourly_limit',retryAfterSeconds:3600},429);\n    if(!await quota('speaking-day-v2',120,1440))return json({ok:false,reason:'app_daily_limit'},429);"],
 ["instructions:speakingInstructions(plan,0,'start')","instructions:chat?chatInstructions(chat,'start'):speakingInstructions(plan,0,'start')"],
 ["upstream.status===429?'provider_quota'","upstream.status===429?(e.error?.code==='insufficient_quota'?'provider_insufficient_quota':'provider_rate_limited')"],
 ["ok:true,contractVersion:SPEAKING_CONTRACT,model:MODEL,sdp,callId", "ok:true,contractVersion:SPEAKING_CONTRACT,chatContract:CHAT_CONTRACT,model:MODEL,sdp,callId"]
]);
console.log('Chat integration: topic validation, unchanged speech route, explicit quota reasons. No secrets, database or learning storage modified.');
