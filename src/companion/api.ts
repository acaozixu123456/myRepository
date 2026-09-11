import {COMPANION,validSeed,type Seed,type Lane,type Line,type Observation} from './model';
export type Ticket={callId:string;expiresAt:number;token:string};
export async function companionApi(action:string,body:Record<string,unknown>={},signal?:AbortSignal){
  const timeout=action==='topics'?55000:action==='start'?38000:action.startsWith('study')||action==='custom_topic'?33000:22000;
  const r=await fetch('/api/nhk-speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,action:`companion_${action}`}),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(timeout)]):AbortSignal.timeout(timeout)});
  const data=await r.json().catch(()=>({ok:false,reason:'connection_error'}));if(!r.ok||!data.ok)throw new Error(String(data.reason||'connection_error'));return data;
}
export async function fetchTopics(lane:Lane,avoid:string[],signal?:AbortSignal):Promise<Seed[]>{const r=await companionApi('topics',{lane,avoid},signal);return(Array.isArray(r.topics)?r.topics:[]).map((s:unknown)=>validSeed(s)).filter((s:Seed|null):s is Seed=>!!s);}
export async function fetchObservations(ticket:Ticket,lines:Line[],signal?:AbortSignal):Promise<Observation[]>{const r=await companionApi('observe',{...ticket,lines},signal);return Array.isArray(r.observations)?r.observations:[];}
export function stopSession(ticket:Ticket|null){if(ticket)void fetch('/api/nhk-speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'companion_stop',...ticket}),keepalive:true}).catch(()=>{});}
export function sessionTicket(data:any):Ticket{if(data?.contract!==COMPANION||data.model!=='gpt-realtime-2.1'||typeof data.sdp!=='string'||typeof data.callId!=='string'||typeof data.token!=='string'||!Number.isFinite(data.expiresAt))throw new Error('connection_contract');return{callId:data.callId,expiresAt:data.expiresAt,token:data.token};}
export function friendlyError(reason:string){
  if(/NotAllowed|Permission/u.test(reason))return '麦克风还没有获准使用。你仍然可以听，允许后再点一次开麦。';
  if(/NotFound|NotReadable/u.test(reason))return '暂时没有可用的麦克风。检查连接后再试，仍然可以听。';
  if(/provider_credit/u.test(reason))return 'OpenAI API 预付余额已用完，语音和文字服务暂时不可用。需要在 API 账单页充值，反复重试不会恢复。';
  if(/provider_spend_limit/u.test(reason))return 'OpenAI API 项目或组织的费用上限已达到。需要由账户管理者检查费用上限，不是临时繁忙。';
  if(/provider_usage_limit/u.test(reason))return 'OpenAI API 账户的用量上限已达到，需要在平台检查限制。反复重试不会恢复。';
  if(/provider_busy/u.test(reason))return '语音服务现在有点忙，稍等片刻再试。';
  if(/app_usage/u.test(reason))return '这段时间的用量保护已触发，稍后再接着聊。不是你说得不好。';
  if(/news_unavailable/u.test(reason))return '暂时没有查到可靠的新消息，先换个日常话题吧。';
  if(/session_closed/u.test(reason))return '这一段连接已经结束。回去挑个话头，就能重新开始。';
  return '这次声音没有接稳，麦克风已关闭。稍后再试，刚才不是你说错了。';
}
