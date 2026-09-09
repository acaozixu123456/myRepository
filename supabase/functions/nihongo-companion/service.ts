export const OPENAI='https://api.openai.com/v1';
type ProviderFault={status:number;code:string;param:string};
export class ServiceError extends Error {constructor(public reason:string,public status=503,public providerFault?:ProviderFault){super(reason);}}
export const reply=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const serviceRole=()=>Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
export async function rpc(name:string,body:Record<string,unknown>={}){
 const key=serviceRole();if(!key)throw new ServiceError('service_not_configured');
 const r=await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/${name}`,{method:'POST',headers:{Authorization:`Bearer ${key}`,apikey:key,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(7000)});
 if(!r.ok)throw new ServiceError('operation_unavailable');return r.json();
}
export async function credential(){const env=Deno.env.get('OPENAI_API_KEY');if(env?.startsWith('sk-'))return env;const value=await rpc('get_nihongo_openai_key');if(typeof value!=='string'||!value.startsWith('sk-'))throw new ServiceError('missing_openai_key');return value;}
export async function quota(bucket:string,limit:number,minutes:number){if(await rpc('consume_nihongo_coach_quota',{p_bucket:bucket,p_limit:limit,p_window_minutes:minutes})!==true)throw new ServiceError('app_usage_protection',429);}
export async function provider(key:string,path:string,init:RequestInit,timeout=23000){
 const r=await fetch(`${OPENAI}${path}`,{...init,headers:{...init.headers,Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(timeout)});
 if(!r.ok){const body=await r.json().catch(()=>({}));const raw=body?.error;const safe=(v:unknown)=>typeof v==='string'&&/^[a-zA-Z0-9_.\[\]-]{1,100}$/.test(v)?v:'';const code=safe(raw?.code),param=safe(raw?.param);
  // Never log provider messages, request content, headers, transcripts, or credentials.
  const fault={status:r.status,code,param};console.warn(JSON.stringify({event:'companion_provider_error',...fault}));
  throw new ServiceError(code==='insufficient_quota'?'provider_credit':r.status===429?'provider_busy':r.status===404?'model_unavailable':'provider_request_failed',r.status===429?429:502,fault);
 }return r;
}
export async function sign(value:unknown){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(serviceRole()),{name:'HMAC',hash:'SHA-256'},false,['sign']);const bytes=await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(JSON.stringify(value)));return Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');}
export async function validSignature(value:unknown,signature:unknown){if(typeof signature!=='string'||!/^[a-f0-9]{64}$/.test(signature))return false;const expected=await sign(value);let mismatch=0;for(let i=0;i<expected.length;i++)mismatch|=expected.charCodeAt(i)^signature.charCodeAt(i);return mismatch===0;}
export type Lease={closed:boolean;owner:string|null;ownerUntil:number;expiresAt:number;generations:number;tokens:number};
export async function lease(action:string,callId:string,owner:string|null=null,eventId:string|null=null,tokens=0):Promise<Lease|null>{return rpc('nihongo_companion_lease',{p_action:action,p_call_id:callId,p_owner:owner,p_event_id:eventId,p_tokens:Math.max(0,Math.floor(tokens))});}
export async function hangup(key:string,callId:string){await fetch(`${OPENAI}/realtime/calls/${callId}/hangup`,{method:'POST',headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(5000)}).catch(()=>{});}
export const ticketValue=(callId:string,expiresAt:number)=>({purpose:'companion-control-v3',callId,expiresAt});
export async function verifyTicket(body:any){if(typeof body.callId!=='string'||!/^rtc_[A-Za-z0-9_-]{4,200}$/.test(body.callId)||!Number.isFinite(body.expiresAt)||body.expiresAt<Date.now()-60000||body.expiresAt>Date.now()+1250000||!await validSignature(ticketValue(body.callId,body.expiresAt),body.token))throw new ServiceError('invalid_session_ticket',403);}
export async function jsonModel(key:string,request:Record<string,unknown>,timeout=23000){
 const send=(body:Record<string,unknown>)=>provider(key,'/responses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({store:false,...body})},timeout);
 let r:Response;
 try{r=await send(request);}catch(e){
  // Only an explicitly rejected optional search filter may use query-level domain hints.
  // Our independent URL/redirect/publisher/date/content checks remain mandatory afterwards.
  const tools=Array.isArray(request.tools)?request.tools:[];
  if(!(e instanceof ServiceError)||e.providerFault?.status!==400||!e.providerFault.param.includes('filters')||!tools.some(t=>t?.type==='web_search'&&t.filters))throw e;
  const domains=tools.flatMap(t=>Array.isArray(t?.filters?.allowed_domains)?t.filters.allowed_domains:[]);
  r=await send({...request,tools:tools.map(t=>{const {filters,...rest}=t;return t.type==='web_search'?rest:t;}),instructions:String(request.instructions||'')+`\nRestrict discovery to these publishers: ${domains.map((d:string)=>'site:'+d).join(' OR ')}. The server will reject other domains.`});
 }
 const data=await r.json();if(data.status!=='completed')throw new ServiceError('generation_incomplete',502);
 const text=(data.output||[]).flatMap((o:any)=>o.content||[]).filter((c:any)=>c.type==='output_text').map((c:any)=>c.text||'').join('');return {data,text};
}
