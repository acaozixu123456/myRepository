import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import WebSocket from 'npm:ws@8.18.0';
import {CHAT_CONTRACT,chatInstructions,validateChatPlan} from './nhkChat.ts';
import {SPEAKING_CONSENT,SPEAKING_CONTRACT,SPEAKING_SECONDS,speakingInstructions,validateSpeakingPlan} from './contract.ts';
const MODEL='gpt-realtime-2.1',OPENAI='https://api.openai.com/v1';
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const serviceKey=()=>Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
async function rpc(name:string,body:Record<string,unknown>={}){const r=await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/${name}`,{method:'POST',headers:{Authorization:`Bearer ${serviceKey()}`,apikey:serviceKey(),'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(5000)});if(!r.ok)throw new Error('quota_service_unavailable');return r.json();}
async function apiKey():Promise<string>{const env=Deno.env.get('OPENAI_API_KEY');if(env?.startsWith('sk-'))return env;try{const k=await rpc('get_nihongo_openai_key');return typeof k==='string'&&k.startsWith('sk-')?k:'';}catch{return '';}}
async function quota(bucket:string,limit:number,minutes:number){return await rpc('consume_nihongo_coach_quota',{p_bucket:bucket,p_limit:limit,p_window_minutes:minutes})===true;}
const hex=(v:ArrayBuffer)=>[...new Uint8Array(v)].map(n=>n.toString(16).padStart(2,'0')).join('');
async function signature(id:string,expiry:number){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(serviceKey()),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(`${SPEAKING_CONTRACT}|${id}|${expiry}`)));}
function equal(a:string,b:string){if(a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0;}
async function hangup(key:string,id:string){try{await fetch(`${OPENAI}/realtime/calls/${id}/hangup`,{method:'POST',headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(5000)});}catch{/* Browser also closes; never open another call to retry. */}}
/** Server-side guard is connected before the SDP is returned. */
async function guard(key:string,id:string,expiry:number){
  const ws=new WebSocket(`wss://api.openai.com/v1/realtime?call_id=${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${key}`}});
  let ended=false,replies=0,tokens=0;let finish!:()=>void;let timer:ReturnType<typeof setTimeout>|undefined;
  const lifetime=new Promise<void>(resolve=>{finish=resolve;});
  const stop=async(reason:string)=>{if(ended)return;ended=true;clearTimeout(timer);await hangup(key,id);ws.close();finish();console.info(JSON.stringify({contract:SPEAKING_CONTRACT,model:MODEL,reason,replies,totalTokens:tokens}));};
  const shuttingDown=()=>{void stop('worker_shutdown');};addEventListener('beforeunload',shuttingDown);
  ws.on('message',data=>{try{const e=JSON.parse(data.toString());if(e.type==='response.created'&&++replies>32)void stop('response_limit');if(e.type==='response.done'){tokens+=Math.max(0,Number(e.response?.usage?.total_tokens)||0);if(tokens>30000)void stop('token_limit');}if(e.type==='session.updated'){const s=e.session||{};if((s.model&&s.model!==MODEL)||Number(s.max_output_tokens)>384||s.audio?.input?.turn_detection?.create_response===true)void stop('session_policy_changed');}}catch{void stop('invalid_guard_event');}});
  ws.on('close',()=>{removeEventListener('beforeunload',shuttingDown);if(!ended)void stop('control_channel_closed');});ws.on('error',()=>{void stop('control_channel_error');});EdgeRuntime.waitUntil(lifetime);
  try{await new Promise<void>((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('guard_timeout')),7000);ws.once('open',()=>{clearTimeout(t);resolve();});ws.once('error',()=>{clearTimeout(t);reject(new Error('guard_unavailable'));});ws.once('close',()=>{clearTimeout(t);reject(new Error('guard_unavailable'));});});if(ended)throw new Error('guard_unavailable');timer=setTimeout(()=>{void stop('time_limit');},Math.max(1000,expiry-Date.now()));}catch(e){await stop('guard_unavailable');throw e;}
}
Deno.serve(async(request:Request)=>{
  if(request.method!=='POST')return json({ok:false,reason:'method_not_allowed'},405);
  if(Number(request.headers.get('Content-Length'))>100000)return json({ok:false,reason:'request_too_large'},413);
  let body:any;try{const raw=await request.text();if(raw.length>100000)return json({ok:false,reason:'request_too_large'},413);body=JSON.parse(raw);if(!body||typeof body!=='object')throw new Error();}catch{return json({ok:false,reason:'bad_json'},400);}
  try{
    if(body.action==='health'){
      const key=await apiKey();if(!key)return json({ok:false,reason:'missing_openai_key',contractVersion:SPEAKING_CONTRACT},503);
      if(!await quota('speaking-health',60,60))return json({ok:false,reason:'health_quota'},429);
      const probe=await fetch(`${OPENAI}/models/${MODEL}`,{headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(7000)});
      return json({ok:probe.ok,model:MODEL,modelReady:probe.ok,contractVersion:SPEAKING_CONTRACT,audioPersistedByApp:false,maxSeconds:SPEAKING_SECONDS,maxResponses:32,globalStartsPerDay:120,chatContract:CHAT_CONTRACT,topicShuffleReconnects:false,individualAccountAuth:false},probe.ok?200:503);
    }
    if(body.action==='stop'){
      if(typeof body.callId!=='string'||!/^rtc_[A-Za-z0-9_-]{4,200}$/.test(body.callId)||typeof body.stopToken!=='string'||!/^[a-f0-9]{64}$/.test(body.stopToken)||!Number.isFinite(body.expiresAt)||body.expiresAt<Date.now()-120000||body.expiresAt>Date.now()+180000)return json({ok:false,reason:'invalid_stop_ticket'},400);
      if(!equal(body.stopToken,await signature(body.callId,body.expiresAt)))return json({ok:false,reason:'invalid_stop_ticket'},403);
      const key=await apiKey();if(!key)return json({ok:false,reason:'missing_openai_key'},503);await hangup(key,body.callId);return json({ok:true,contractVersion:SPEAKING_CONTRACT});
    }
    if(body.action!=='start')return json({ok:false,reason:'invalid_action'},400);
    if(body.consent!==SPEAKING_CONSENT)return json({ok:false,reason:'explicit_audio_consent_required'},400);
    const plan=validateSpeakingPlan(body.plan);
    const chat=body.plan?.chatMode===true?validateChatPlan(body.plan):null;
    if(body.plan?.chatMode===true&&!chat)return json({ok:false,reason:'invalid_chat_topic'},400);
    if(!plan||typeof body.sdp!=='string'||body.sdp.length>64000||!body.sdp.startsWith('v=0')||!body.sdp.includes('m=audio')||typeof body.clientRequestId!=='string'||!/^[A-Za-z0-9-]{16,80}$/.test(body.clientRequestId)||!/^[a-f0-9]{48}$/.test(body.clientKey||''))return json({ok:false,reason:'invalid_speaking_input'},400);
    const key=await apiKey();if(!key)return json({ok:false,reason:'missing_openai_key'},503);
    if(!await quota(`speaking-request:${body.clientRequestId}`,1,10))return json({ok:false,reason:'duplicate_start'},409);
    // Guard anomalous connection creation, not ordinary conversation or local topic browsing.
    if(!await quota(`speaking-burst-v2:${body.clientKey}`,12,1))return json({ok:false,reason:'app_burst_limited',retryAfterSeconds:60},429);
    if(!await quota(`speaking-hour-v2:${body.clientKey}`,60,60))return json({ok:false,reason:'app_hourly_limit',retryAfterSeconds:3600},429);
    if(!await quota('speaking-day-v2',120,1440))return json({ok:false,reason:'app_daily_limit'},429);
    const session={type:'realtime',model:MODEL,instructions:chat?chatInstructions(chat,'start'):speakingInstructions(plan,0,'start'),output_modalities:['audio'],max_output_tokens:384,tools:[],tool_choice:'none',audio:{input:{noise_reduction:{type:'near_field'},transcription:{model:'gpt-4o-mini-transcribe',prompt:'The speaker is learning Japanese and may ask for help in Chinese. Transcribe only speech actually heard; never invent words from a lesson.'},turn_detection:{type:'semantic_vad',eagerness:'low',create_response:false,interrupt_response:false}},output:{voice:'marin',speed:0.93}}};
    const form=new FormData();form.set('sdp',body.sdp);form.set('session',JSON.stringify(session));
    const upstream=await fetch(`${OPENAI}/realtime/calls`,{method:'POST',headers:{Authorization:`Bearer ${key}`},body:form,signal:AbortSignal.timeout(16000)});
    if(!upstream.ok){const e=await upstream.json().catch(()=>({}));const parameter=typeof e.error?.param==='string'&&/^[a-zA-Z0-9._\[\]]{1,90}$/.test(e.error.param)?e.error.param:undefined;return json({ok:false,reason:upstream.status===404?'model_unavailable':upstream.status===429?(e.error?.code==='insufficient_quota'?'provider_insufficient_quota':'provider_rate_limited'):'realtime_config_error',upstreamStatus:upstream.status,parameter},502);}
    const callId=upstream.headers.get('Location')?.split('/').pop();if(!callId||!/^rtc_[A-Za-z0-9_-]{4,200}$/.test(callId))return json({ok:false,reason:'missing_call_id'},502);
    const sdp=await upstream.text(),expiresAt=Date.now()+SPEAKING_SECONDS*1000;
    try{await guard(key,callId,expiresAt);}catch{return json({ok:false,reason:'guard_unavailable'},502);}
    return json({ok:true,contractVersion:SPEAKING_CONTRACT,chatContract:CHAT_CONTRACT,model:MODEL,sdp,callId,expiresAt,stopToken:await signature(callId,expiresAt),audioPersistedByApp:false});
  }catch{return json({ok:false,reason:'speaking_service_unavailable'},503);}
});
