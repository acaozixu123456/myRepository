import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {COMPANION,CONSENT,VOICE_MODEL,LOCAL_SEEDS,validSeed,validPolicy,companionInstructions} from './model.ts';
import {credential,reply,quota,provider,ServiceError,lease,sign,validSignature,ticketValue,verifyTicket,hangup} from './service.ts';
import {ensureMonitor} from './monitor.ts';
import {topics,observe} from './content.ts';
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return reply({ok:false,reason:'method_not_allowed'},405);
 let body:any;try{const s=await req.text();if(s.length>100000)throw new Error();body=JSON.parse(s);if(!body||typeof body!=='object')throw new Error();}catch{return reply({ok:false,reason:'invalid_input'},400);}
 try{
  const action=String(body.action||'');
  if(action==='health'){const k=await credential();const r=await provider(k,`/models/${VOICE_MODEL}`,{method:'GET'},7000);return reply({ok:r.ok,contract:COMPANION,model:VOICE_MODEL,mode:'native-stateful-audio',scheduler:'client-committed-item',maxMinutes:20});}
  if(['heartbeat','stop','observe'].includes(action)){
   await verifyTicket(body);const k=await credential();
   if(action==='stop'){await lease('stop',body.callId);await hangup(k,body.callId);return reply({ok:true});}
   const row=await lease(action==='heartbeat'?'touch':'read',body.callId);if(!row||row.closed)return reply({ok:false,reason:'session_closed'},409);
   if(action==='heartbeat'){await ensureMonitor(k,body.callId);return reply({ok:true,expiresAt:row.expiresAt});}
   return reply({ok:true,observations:await observe(k,body)});
  }
  if(!/^[a-f0-9]{48}$/.test(body.clientKey||''))throw new ServiceError('invalid_client',400);
  if(action==='topics')return reply({ok:true,topics:await topics(await credential(),body)});
  if(action!=='start')throw new ServiceError('invalid_action',400);
  if(body.consent!==CONSENT)throw new ServiceError('audio_consent_required',400);
  if(typeof body.sdp!=='string'||body.sdp.length>64000||!body.sdp.startsWith('v=0')||!body.sdp.includes('m=audio')||!/^[a-zA-Z0-9-]{16,80}$/.test(body.clientRequestId||''))throw new ServiceError('invalid_input',400);
  const proposed=validSeed(body.seed);if(!proposed)throw new ServiceError('invalid_topic',400);
  const {signature,...unsigned}=proposed;const local=LOCAL_SEEDS.find(s=>s.id===proposed.id);const seed=local||proposed;
  if(!local&&!await validSignature({purpose:'companion-seed-v3',seed:unsigned},signature))throw new ServiceError('invalid_topic_signature',403);
  await quota(`companion-id:${body.clientRequestId}`,1,30);await quota(`companion-start:${body.clientKey}`,12,60);await quota('companion-start-global',120,1440);
  const k=await credential();const session={type:'realtime',model:VOICE_MODEL,instructions:companionInstructions(seed,validPolicy(body.policy)),output_modalities:['audio'],max_output_tokens:1024,tools:[],tool_choice:'none',audio:{input:{noise_reduction:{type:'near_field'},transcription:{model:'gpt-4o-mini-transcribe'},turn_detection:{type:'semantic_vad',eagerness:'low',create_response:false,interrupt_response:false}},output:{voice:'marin',speed:0.8}}};
  const form=new FormData();form.set('sdp',body.sdp);form.set('session',JSON.stringify(session));const r=await provider(k,'/realtime/calls',{method:'POST',body:form});const callId=r.headers.get('Location')?.split('/').pop();if(!callId||!/^rtc_[A-Za-z0-9_-]{4,200}$/.test(callId))throw new ServiceError('missing_call_id');
  try{const row=await lease('create',callId);if(!row)throw new ServiceError('lease_unavailable');await ensureMonitor(k,callId);const token=await sign(ticketValue(callId,row.expiresAt));return reply({ok:true,contract:COMPANION,model:VOICE_MODEL,sdp:await r.text(),callId,expiresAt:row.expiresAt,token});}catch(e){await hangup(k,callId);throw e;}
 }catch(e){return reply({ok:false,reason:e instanceof ServiceError?e.reason:'service_unavailable',...(e instanceof ServiceError&&e.providerFault?{provider:e.providerFault}:{})},e instanceof ServiceError?e.status:503);}
});
