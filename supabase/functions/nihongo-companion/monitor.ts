import WebSocket from 'npm:ws@8.18.0';
import {hangup,lease,ServiceError,type Lease} from './service.ts';
/** Observe usage only. The uninterrupted browser controller is the SOLE response scheduler.
 * A fencing owner and idempotent event IDs allow these short edge workers to overlap safely.
 * No speech, transcript, prompt, learner profile or raw event is written to the database/log.
 */
export async function ensureMonitor(key:string,callId:string){
  const owner=crypto.randomUUID();const claim=await lease('claim',callId,owner);
  if(!claim||claim.closed)throw new ServiceError('session_closed',409);
  if(claim.owner!==owner)return claim;
  const ws=new WebSocket(`wss://api.openai.com/v1/realtime?call_id=${encodeURIComponent(callId)}`,{headers:{Authorization:`Bearer ${key}`}});
  let ended=false;let timer:ReturnType<typeof setInterval>|undefined;let finish!:()=>void;let polling=false;
  const lifetime=new Promise<void>(resolve=>{finish=resolve;});
  const close=()=>{if(ended)return;ended=true;clearInterval(timer);ws.close();finish();};
  const stop=async()=>{if(ended)return;try{await lease('stop',callId);await hangup(key,callId);}finally{close();}};
  const inspect=(r:Lease|null)=>{if(!r||r.closed){void stop();return;}if(r.owner!==owner)close();};
  ws.on('message',raw=>{if(ended)return;try{const e=JSON.parse(raw.toString());
    if(e.type==='response.created'&&e.response?.id)void lease('generation',callId,owner,String(e.response.id)).then(inspect).catch(()=>void stop());
    if(e.type==='response.done'&&e.response?.id)void lease('account',callId,owner,String(e.response.id),Number(e.response?.usage?.total_tokens)||0).then(inspect).catch(()=>void stop());
    if(e.type==='session.updated'){const s=e.session||{};if((s.model&&s.model!=='gpt-realtime-2.1')||Number(s.max_output_tokens)>1024||s.audio?.input?.turn_detection?.create_response===true)void stop();}
  }catch{void stop();}});
  // An edge lifetime ending does not itself end the user's voice call; heartbeat reclaims it.
  ws.on('close',close);ws.on('error',close);EdgeRuntime.waitUntil(lifetime);
  try{await new Promise<void>((resolve,reject)=>{const t=setTimeout(()=>reject(new ServiceError('monitor_unavailable')),7000);ws.once('open',()=>{clearTimeout(t);resolve();});ws.once('error',()=>{clearTimeout(t);reject(new ServiceError('monitor_unavailable'));});});if(ended)throw new ServiceError('monitor_unavailable');
    timer=setInterval(async()=>{if(ended||polling)return;polling=true;try{const r=await lease('read',callId);inspect(r);if(!ended&&Date.now()>claim.ownerUntil+3000)close();}catch{await stop();}finally{polling=false;}},5000);
    return claim;
  }catch(e){close();throw e;}
}
